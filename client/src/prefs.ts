// Comfort settings, remembered in this browser: how loud the game and the voices are, text size,
// graphics quality and motion. Each is a small choice of named levels (radio buttons in Settings).
import { readText, writeText } from "./storage";

export const PREFS = {
  sound: ["off", "low", "on"],
  voices: ["off", "low", "on"],
  text: ["normal", "large"],
  graphics: ["auto", "low", "high"],
  motion: ["full", "reduced"],
  /** the pour meter for seasoning: off, every pinch is just right (no perfect pinches either) */
  meter: ["on", "off"],
  /** your microphone in voice chat */
  mic: ["on", "off"],
  /** orders, tips and what's around you, said out loud */
  speak: ["off", "on"],
  /** how fast the view turns with the mouse or a finger */
  look: ["slow", "normal", "fast"],
  /** safe: order timers in blue and orange with stripes, for players who can't tell red from green */
  colors: ["normal", "safe"],
  /** touch: a Hold button of its own for chopping (off: holding Use chops) */
  holdButton: ["off", "on"],
  /** touch: how big the thumb buttons are */
  buttonSize: ["normal", "large"],
  /** touch: which thumb walks (left: the stick moves to the right side) */
  hand: ["right", "left"],
} as const;

export type PrefName = keyof typeof PREFS;
export type PrefValue<N extends PrefName> = (typeof PREFS)[N][number];

const DEFAULTS: { [N in PrefName]: () => PrefValue<N> } = {
  sound: () => "on",
  voices: () => "on",
  text: () => "normal",
  graphics: () => "auto",
  // the system's own reduced-motion setting counts
  motion: () => (matchMedia("(prefers-reduced-motion: reduce)").matches ? "reduced" : "full"),
  meter: () => "on",
  mic: () => "on",
  speak: () => "off",
  look: () => "normal",
  colors: () => "normal",
  holdButton: () => "off",
  buttonSize: () => "normal",
  hand: () => "right",
};

export function pref<N extends PrefName>(name: N): PrefValue<N> {
  const saved = readText(`kitchen.${name}`);
  return (PREFS[name] as readonly string[]).includes(saved ?? "") ? (saved as PrefValue<N>) : DEFAULTS[name]();
}

export const savePref = (name: PrefName, value: string) => writeText(`kitchen.${name}`, value);

/** off / low / on as a volume */
export const level = (value: "off" | "low" | "on") => ({ off: 0, low: 0.4, on: 1 })[value];

/** the Look speed setting as a multiplier */
export const lookSpeed = () => ({ slow: 0.6, normal: 1, fast: 1.6 })[pref("look")];

/** Kept by Reset progress: who you are and how you like the game, not what you've earned. */
const KEEP = new Set(["kitchen.lang", "kitchen.name", "kitchen.music", "kitchen.noStats", "kitchen.playerId", ...Object.keys(PREFS).map((n) => `kitchen.${n}`)]);

/** Forget stars, coins, upgrades, stickers and looks (settings stay). */
export function resetProgress() {
  try {
    for (const key of Object.keys(localStorage)) if (key.startsWith("kitchen.") && !KEEP.has(key)) localStorage.removeItem(key);
    sessionStorage.clear();
  } catch {
    // storage is blocked: there was nothing saved to forget
  }
}
