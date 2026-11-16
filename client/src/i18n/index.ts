// The game's language: English, or Burmese (မြန်မာ). Chosen in Settings (or on the title screen),
// remembered, and taken from the browser the first time ("my" → Burmese). Everything the player
// reads goes through tr(): the page (see dom.ts), the 3D labels and what's read aloud. Changing
// language reloads the page, so nothing has to switch over in the middle of a shift.
import { makeTranslator } from "./engine";
import { burmese } from "./my";
import { readText, writeText } from "../storage";

export type Lang = "en" | "my";

/** Each language in its own words, for the switches. */
export const LANG_NAMES: Record<Lang, string> = { en: "English", my: "မြန်မာ" };

const KEY = "kitchen.lang";

function detect(): Lang {
  // a link with ?lang=my (or en) chooses for this player from then on
  const asked = new URLSearchParams(location.search).get("lang");
  if (asked === "en" || asked === "my") {
    writeText(KEY, asked);
    return asked;
  }
  const saved = readText(KEY);
  if (saved === "en" || saved === "my") return saved;
  return navigator.languages?.some((l) => /^my\b/i.test(l)) ? "my" : "en";
}

export const LANG: Lang = detect();
export const isBurmese = LANG === "my";

const translator = isBurmese ? makeTranslator(burmese()) : null;

/** On touch the game says "hold Use" (or "hold the Hold button") where the keyboard text says "hold F". */
const TOUCH_HOLD = /\b([Hh])old (Use|the Hold button)\b/g;

/** Anything the player reads, in their language (unchanged in English). */
export function tr(text: string): string {
  if (!translator) return text;
  const button = text.match(TOUCH_HOLD)?.[0];
  if (button) {
    // lines are written (and translated) for the keyboard: translate that, then name the touch button
    const keyed = translator.tr(text.replace(TOUCH_HOLD, "$1old F"));
    if (keyed.includes("F ကို ဖိထား")) return keyed.replace(/F ကို ဖိထား/g, /Use/.test(button) ? "‘သုံး’ ကို ဖိထား" : "‘ဖိထား’ ခလုတ်ကို ဖိထား");
  }
  return translator.tr(text);
}

/** English pieces with no translation yet (dev console: __i18n.misses). */
export const misses = translator?.misses ?? new Set<string>();

/** Switch language: remembered, then the page starts again in it. */
export function setLang(lang: Lang) {
  if (lang === LANG) return;
  writeText(KEY, lang);
  const url = new URL(location.href);
  url.searchParams.delete("lang");
  location.replace(url.toString());
}

// --- reading aloud ------------------------------------------------------------------------

/** A Burmese voice on this device, if it has one (many phones and computers don't). */
function burmeseVoice(): SpeechSynthesisVoice | null {
  if (!("speechSynthesis" in window)) return null;
  return speechSynthesis.getVoices().find((v) => /^my(\b|-|_)/i.test(v.lang)) ?? null;
}

/**
 * What to say aloud for some English text: Burmese with a Burmese voice when there is one;
 * otherwise the English, so a phone order is still heard (a caller in English beats silence).
 */
export function utterance(english: string): SpeechSynthesisUtterance {
  const voice = isBurmese ? burmeseVoice() : null;
  const said = new SpeechSynthesisUtterance(voice ? tr(english) : english);
  if (voice) {
    said.voice = voice;
    said.lang = voice.lang;
  }
  return said;
}

if (import.meta.env.DEV) Object.assign(window, { __i18n: { lang: LANG, tr, misses } });
