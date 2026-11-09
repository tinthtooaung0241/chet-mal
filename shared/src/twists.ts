// Daily specials: one shift a day with a twist that changes how it plays. The date picks the
// shift and the twist, so friends cooking on the same day get the same special.
import type { KitchenEventKind } from "./rules";

export type TwistId = "busy" | "tippers" | "combo" | "storm" | "blackout" | "critics" | "picky" | "phones" | "short-menu";

export interface Twist {
  id: TwistId;
  name: string;
  /** what's different, in a few words */
  blurb: string;
  icon: string;
  /** orders come this many times as often */
  pace?: number;
  /** dishes pay this many times as much */
  pay?: number;
  /** customers wait this many times as long */
  patience?: number;
  /** combos last this many times as long, and their bonus is this many times bigger */
  combo?: number;
  /** a power cut or a storm this far through the shift (0-1), for this many seconds */
  event?: { kind: KitchenEventKind; at: number; duration: number };
  /** this many food critics visit */
  critics?: number;
  /** seasoning mistakes cost this many times as much */
  picky?: number;
  /** this share of orders come by phone, whatever the level */
  phones?: number;
  /** only the level's first this-many recipes are ordered */
  menu?: number;
}

export const TWISTS: Twist[] = [
  { id: "busy", name: "Busy day", blurb: "Orders come faster and pay more", icon: "hurry", pace: 1.3, pay: 1.2 },
  { id: "tippers", name: "Big tippers", blurb: "Double pay, but nobody waits long", icon: "coin", pay: 2, patience: 0.7 },
  { id: "combo", name: "Combo party", blurb: "Combos last longer and pay double", icon: "bolt", combo: 2 },
  { id: "storm", name: "Stormy night", blurb: "A storm drowns out every sound", icon: "storm", event: { kind: "storm", at: 0.35, duration: 30 } },
  { id: "blackout", name: "Power trouble", blurb: "The lights go out for a while", icon: "moon", event: { kind: "blackout", at: 0.55, duration: 20 } },
  { id: "picky", name: "Picky eaters", blurb: "Seasoning mistakes cost double", icon: "salt", picky: 2, pay: 1.15 },
  { id: "phones", name: "Phone frenzy", blurb: "Most orders come by phone: say them out loud", icon: "phone", phones: 0.75 },
  { id: "short-menu", name: "Half the menu", blurb: "Only two dishes, but twice as busy", icon: "ticket", menu: 2, pace: 1.6 },
  { id: "critics", name: "Critics in town", blurb: "Two food critics visit: quick and seasoned right", icon: "critic", critics: 2 },
];

export const twistById = (id: string | null | undefined): Twist | undefined => TWISTS.find((t) => t.id === id);

/** The same number for the same text on every machine (FNV-1a, then mixed so that neighbouring days differ). */
function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** The daily special for a day ("2026-11-09"), from the shifts a player has open. */
export function dailySpecial(day: string, levels: number[]): { level: number; twist: TwistId } {
  const [y, m, d] = day.split("-").map(Number);
  const n = Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
  // the twist moves on 2 or 3 places a day: every one comes round, never twice in a row
  const twist = (2 * n + Math.floor(n / 5)) % TWISTS.length;
  return { level: levels[hash(day) % levels.length] ?? 1, twist: TWISTS[twist].id };
}
