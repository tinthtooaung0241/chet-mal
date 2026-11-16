// The rules, the coach and the briefings are written for a keyboard ("hold F", "(key 2)"). With
// the touch layout showing, the same words point at the buttons instead, or drop the key.

/** The touch layout is showing (body.touch, set by the touch controls). */
const onTouch = () => document.body.classList.contains("touch");

const TOUCH_WORDS: [RegExp, string][] = [
  // "(key 2)", "(keys 1 and 2)": the tile itself is tapped
  [/\s*\(keys? \d[^)]*\)/g, ""],
  [/\bShift to dash\b/g, "Tap Dash to run"],
  [/\bPress R\b/g, "Tap the book"],
  [/\bpress R\b/g, "tap the book"],
  [/\bPoint with G\b/g, "Point with the pin"],
  [/\bring the bell with B\b/g, "ring the bell"],
  [/\bhold T, then move the mouse to a sign and let go\b/g, "tap Signs and pick one"],
  [/\bpress B at the pass\b/g, "tap the bell at the pass"],
  [/\s*Press Q any time to hear what's around you\./g, ""],
];

/** The words for the controls in use: unchanged with a keyboard, button words on touch. */
export function forControls(text: string): string {
  if (!onTouch()) return text;
  // chopping is a hold of Use, unless the player asked for a Hold button of its own
  const hold = document.body.classList.contains("hold-button") ? "the Hold button" : "Use";
  text = text.replace(/\bhold F\b/g, `hold ${hold}`).replace(/\bHold F\b/g, `Hold ${hold}`);
  return TOUCH_WORDS.reduce((t, [pattern, words]) => t.replace(pattern, words), text);
}
