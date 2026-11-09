// Comfort settings, remembered in this browser: how loud the game and the voices are, text size,
// graphics quality and motion. Each is a small choice of named levels (radio buttons in Settings).
import { readText, writeText } from "./storage";

export const PREFS = {
  sound: ["off", "low", "on"],
  voices: ["off", "low", "on"],
  text: ["normal", "large"],
  graphics: ["auto", "low", "high"],
  motion: ["full", "reduced"],
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
};

export function pref<N extends PrefName>(name: N): PrefValue<N> {
  const saved = readText(`kitchen.${name}`);
  return (PREFS[name] as readonly string[]).includes(saved ?? "") ? (saved as PrefValue<N>) : DEFAULTS[name]();
}

export const savePref = (name: PrefName, value: string) => writeText(`kitchen.${name}`, value);

/** off / low / on as a volume */
export const level = (value: "off" | "low" | "on") => ({ off: 0, low: 0.4, on: 1 })[value];
