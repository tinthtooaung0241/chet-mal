// Burmese (မြန်မာ), put together: the fixed strings, the kitchen words, the sentence patterns, and
// the grammar for compound noun phrases the game builds ("plate of chopped tomato and chopped
// lettuce, with salt" → "ခရမ်းချဉ်သီးလှီးနဲ့ ဆလတ်ရွက်လှီး ပါတဲ့ ပန်းကန်ပြား (ဆား ခတ်ထား)").
import type { Language, Tools } from "../engine";
import { buildTerms } from "./terms";
import { RULES } from "./rules";
import { UI } from "./ui";

/** "A၊ B နဲ့ C": Burmese lists join with ၊ and end with နဲ့ ("and"). */
export function joinList(items: string[]): string {
  return items.length > 1 ? `${items.slice(0, -1).join("၊ ")}နဲ့ ${items.at(-1)}` : (items[0] ?? "");
}

const HAS_LATIN = /[A-Za-z]/;

/** "salt, black pepper and fresh herbs", "chopped tomato + chopped lettuce" → a Burmese list, or null. */
function list(text: string, t: Tools): string | null {
  const parts = text.split(/, | and | \+ /).map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  const mine = parts.map((p) => t.P(p));
  // a piece still in English: it wasn't a list of things we know
  if (mine.some((m, i) => m === parts[i] && HAS_LATIN.test(m))) return null;
  return joinList(mine);
}

/** A noun phrase the term list doesn't have outright. */
function phrase(text: string, t: Tools): string | null {
  let m: RegExpMatchArray | null;
  // articles: Burmese has none
  if ((m = text.match(/^(?:a|an|the|some|your|their) (.+)$/i))) return t.P(m[1]);
  // a recipe's finishing seasonings: "…, finished with lemon and fresh herbs"
  if ((m = text.match(/^(.+), finished with (.+)$/))) return `${t.P(m[1])} (${t.P(m[2])} ထည့်ပြီး အဆုံးသတ်)`;
  // a recipe's items: "steak (salt … before cooking) + fries (salt after cooking)"
  if (text.includes(" + ")) return text.split(" + ").map((item) => t.P(item)).join("၊ ");
  // a seasoned food or dish: "…, with salt and black pepper"
  if ((m = text.match(/^(.+), with (.+)$/))) return `${t.P(m[1])} (${t.P(m[2])} ခတ်ထား)`;
  // a recipe item: "steak (salt and black pepper before cooking)"
  if ((m = text.match(/^(.+) \((.+) (before|after) cooking\)$/)))
    return `${t.P(m[1])} (${t.P(m[2])} ${m[3] === "before" ? "မချက်ခင်" : "ချက်ပြီးမှ"} ခတ်)`;
  // the soup pot: "tomato soup, ready" / "…, boiling" / "2 chopped tomato, chopped onion (3 of 3)"
  if ((m = text.match(/^(.+), (ready|boiling)$/))) return `${t.P(m[1])} — ${m[2] === "ready" ? "အဆင်သင့်" : "ဆူနေတယ်"}`;
  if ((m = text.match(/^(.+) \((\d+) of (\d+)\)$/))) return `${t.P(m[1])} (${m[3]} ခုမှာ ${m[2]} ခု)`;
  // plates, bowls and soups of things
  if ((m = text.match(/^plate of (.+)$/i))) return `${list(m[1], t) ?? t.P(m[1])} ပါတဲ့ ပန်းကန်ပြား`;
  if ((m = text.match(/^bowl of (.+)$/i))) return `${t.P(m[1])} တစ်ပန်းကန်`;
  if ((m = text.match(/^soup of (.+)$/i))) return `${list(m[1], t) ?? t.P(m[1])} စွပ်ပြုတ်`;
  if ((m = text.match(/^dirty (.+)$/i))) return `${t.P(m[1])}ညစ်`;
  // counts: "2 chopped tomato", "3 tomatoes"
  if ((m = text.match(/^(\d+) (.+)$/))) {
    const one = t.P(m[2]);
    return `${one} ${m[1]} ခု`;
  }
  // lists of known things
  const joined = list(text, t);
  if (joined) return joined;
  // a capitalised name ("Tomato", "Olive oil") or a plural ("plates") the terms have in another form
  const lower = text.toLowerCase();
  if (lower !== text) {
    const again = t.P(lower);
    if (again !== lower) return again;
  }
  if (/s$/.test(lower) && lower.length > 3) {
    const single = t.P(lower.replace(/(?:es|s)$/, ""));
    if (!HAS_LATIN.test(single)) return single;
  }
  return null;
}

/** The whole Burmese language, ready for the translator. */
export function burmese(): Language {
  return {
    exact: UI,
    terms: buildTerms(),
    rules: RULES,
    phrase,
    joinSentences: (parts) => parts.join(" "),
    fullStop: "။",
  };
}
