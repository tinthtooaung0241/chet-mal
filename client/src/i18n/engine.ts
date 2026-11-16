// The translator. The game's rules, coach and HUD all write English, often built from pieces
// ("Took a raw tomato from the fridge."), and a server sends the same English to every player, so
// each player's game translates what it shows. A language is a list of exact strings, sentence
// patterns and food and kitchen words (a "term" list) used inside those patterns. Compound text is
// split and translated piece by piece: sentences, "A · B", "Label: value", "Thing (detail)".
// Anything it can't match comes back in English and is noted, so a test can list what's missing.
// Pure functions only: no DOM, so the coverage test runs it in Node.

/** Helpers a sentence pattern uses to translate the pieces it captured. */
export interface Tools {
  /** any text: exact, a pattern, or split into pieces */
  tr(text: string): string;
  /** a noun phrase: a food, dish, station, item, spice list... */
  P(phrase: string): string;
}

/** A sentence pattern and how to say it; returning null passes the text on to the next pattern. */
export type Rule = [RegExp, (m: RegExpMatchArray, t: Tools) => string | null];

export interface Language {
  /** whole strings, exactly as the game writes them */
  exact: Record<string, string>;
  /** words and noun phrases (foods in every state, dishes, stations, spices), matched without case */
  terms: Map<string, string>;
  /** sentence patterns, tried in order; each must match the whole (trimmed) text */
  rules: Rule[];
  /** noun phrases the term list doesn't have outright: plates of food, lists, counts */
  phrase(text: string, t: Tools): string | null;
  /** joins pieces of a compound text back together */
  joinSentences(parts: string[]): string;
  /** the language's full stop, for an exact string the game ends with "." */
  fullStop: string;
}

export interface Translator {
  tr(text: string): string;
  P(phrase: string): string;
  /** English pieces that came back untranslated (for the coverage test and the dev console) */
  misses: Set<string>;
}

const HAS_LETTERS = /[A-Za-z]/;
/**
 * keys, numbers and symbols stay as they are: "F", "R", "1–8", "Space", "×3", "0:45". Not "Shift":
 * on its own that's a kitchen shift (the key is always inside <kbd>, which is never translated).
 */
const KEEP = /^(?:[A-Z]|F\d+|Space|Enter|Esc|Tab|[\d\s:+\-–×%./·★☆✓✗…!?()]+)$/;

/**
 * The sentences in a text: split after . ! ? or … and a space, before a capital, a digit or a quote,
 * but never inside quotation marks (a caller's words stay one piece).
 */
export function splitSentences(text: string): string[] {
  const out: string[] = [];
  let quoted = false;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') quoted = !quoted;
    if (quoted || text[i + 1] !== " ") continue;
    const ends = /[.!?…]/.test(c) || (c === '"' && /[.!?…]/.test(text[i - 1] ?? ""));
    if (ends && /["“(A-Z0-9]/.test(text[i + 2] ?? "")) {
      out.push(text.slice(start, i + 1));
      start = i + 2;
    }
  }
  out.push(text.slice(start));
  return out.filter((s) => s.trim());
}

export function makeTranslator(lang: Language): Translator {
  const cache = new Map<string, string>();
  const misses = new Set<string>();
  const exactLower = new Map<string, string>();
  for (const [en, out] of Object.entries(lang.exact)) exactLower.set(en.toLowerCase(), out);

  const tools: Tools = { tr, P };

  /** A noun phrase: terms first, then the language's grammar for compound phrases. */
  function P(phrase: string): string {
    const text = phrase.trim();
    if (!text || !HAS_LETTERS.test(text)) return text;
    const term = lang.terms.get(text.toLowerCase());
    if (term !== undefined) return term;
    const out = exactLower.get(text.toLowerCase()) ?? lang.phrase(text, tools);
    if (out !== undefined && out !== null) return out;
    misses.add(text);
    return text;
  }

  function byRules(text: string): string | null {
    for (const [pattern, build] of lang.rules) {
      const m = text.match(pattern);
      const out = m ? build(m, tools) : null;
      if (out !== null) return out;
    }
    return null;
  }

  /** The whole text, or null if nothing matches it as one piece. */
  function whole(text: string): string | null {
    const exact = lang.exact[text] ?? exactLower.get(text.toLowerCase());
    if (exact !== undefined) return exact;
    // a known label made into a sentence: "Practice every job."
    const bare = text.endsWith(".") ? exactLower.get(text.slice(0, -1).toLowerCase()) : undefined;
    if (bare !== undefined) return bare + lang.fullStop;
    const said = byRules(text);
    if (said !== null) return said;
    // a sentence shown without its full stop (a toast is often just the first sentence)
    if (!/[.!?…]$/.test(text)) {
      const again = byRules(`${text}.`);
      if (again !== null) return again.replace(new RegExp(`[.${lang.fullStop}]$`), "");
    }
    const term = lang.terms.get(text.toLowerCase());
    if (term !== undefined) return term;
    return null;
  }

  /** Split a compound text and translate its pieces; null if it isn't one. */
  function pieces(text: string): string | null {
    // "A · B · C" (summaries, badges)
    if (text.includes(" · ")) return text.split(" · ").map(tr).join(" · ");
    // "Thing (detail)"
    const paren = text.match(/^(.+?) \(([^()]+)\)$/);
    if (paren) return `${tr(paren[1])} (${tr(paren[2])})`;
    // "Label: value"
    const colon = text.match(/^([^:]{2,40}): (.+)$/);
    if (colon) return `${tr(colon[1])}: ${tr(colon[2])}`;
    return null;
  }

  function tr(text: string): string {
    if (!text || !HAS_LETTERS.test(text)) return text;
    const cached = cache.get(text);
    if (cached !== undefined) return cached;
    // spaces and the invisible marks screen-reader messages carry stay where they were
    const lead = text.match(/^[\s\u200b]*/)![0];
    const trail = text.match(/[\s\u200b]*$/)![0];
    const core = text.slice(lead.length, text.length - trail.length);
    let out: string;
    if (KEEP.test(core)) out = core;
    else {
      // several sentences are translated one by one (a key the coach adds, "(key 3)", likewise)
      const sentences = splitSentences(core);
      const key = core.match(/^(.+) \((key \d+)\)$/);
      const found =
        (lang.exact[core] ?? exactLower.get(core.toLowerCase())) ??
        (sentences.length > 1 ? lang.joinSentences(sentences.map(tr)) : null) ??
        (key ? `${tr(key[1])} (${tr(key[2])})` : null) ??
        whole(core) ??
        pieces(core) ??
        lang.phrase(core, tools);
      // (text already partly in the other language, built from translated pieces, isn't a miss)
      if (found === null && !/[^\P{L}\p{Script=Latin}]/u.test(core)) misses.add(core);
      out = found ?? core;
    }
    const result = lead + out + trail;
    if (cache.size > 4000) cache.clear();
    cache.set(text, result);
    return result;
  }

  return { tr, P, misses };
}
