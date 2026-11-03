// Who perceives what. Pure data, shared by the rules, the HUD and the audio.

/**
 * How a piece of information reaches the kitchen.
 * - sight: anyone who can see
 * - sound: anyone who can hear
 * - touch: only the chef who did it (your own hands always tell you what you picked up)
 */
export type Sense = "sight" | "sound" | "touch";

export type Role = "full" | "head" | "deaf" | "mute";

export interface RoleInfo {
  name: string;
  summary: string;
  sees: boolean;
  hears: boolean;
  /** uses pings, emotes and the bell (the mute cook instead of a voice; the head chef as well as one) */
  signals: boolean;
  /** handles raw food: fetches, chops, cooks and seasons ingredients (the head chef only plates and serves) */
  cooks: boolean;
  /** can wave to the tables from the pass to buy every waiting customer time (the mute chef's gift) */
  charms: boolean;
}

export const ROLES: Record<Role, RoleInfo> = {
  full: {
    name: "All senses (solo)",
    summary: "You see and hear everything. Good for learning the kitchen alone.",
    sees: true,
    hears: true,
    signals: true,
    cooks: true,
    charms: true,
  },
  head: {
    name: "Head chef",
    summary:
      "You run the pass: you see every ticket, hear every phone order and can see how each dish is coming along. You don't cook: plate, finish and serve, and tell your cooks what to make next.",
    sees: true,
    hears: true,
    signals: true,
    cooks: false,
    charms: false,
  },
  deaf: {
    name: "Deaf chef",
    summary: "You play by sight: tickets, colours, smoke. No sound reaches you, so watch the bars and the log.",
    sees: true,
    hears: false,
    signals: false,
    cooks: true,
    charms: false,
  },
  mute: {
    name: "Mute chef",
    summary: "You see and hear everything but can't talk. Signal with G (ping), T + 1–6 (emotes) and B (bell). Only you can charm the customers: press B at the pass to wave, and every table waits longer.",
    sees: true,
    hears: true,
    signals: true,
    cooks: true,
    charms: true,
  },
};

export const ROLE_KEYS: Record<string, Role> = { Digit0: "full", Digit1: "head", Digit2: "deaf", Digit3: "mute" };

/** @param isActor whether this chef caused the event (only then does "touch" reach it) */
export function perceives(role: Role, senses: readonly Sense[], isActor = true): boolean {
  const r = ROLES[role];
  return (isActor && senses.includes("touch")) || (r.sees && senses.includes("sight")) || (r.hears && senses.includes("sound"));
}

export const EMOTES = ["Yes", "No", "Here", "Hurry", "Stop", "Done"] as const;
export type Emote = (typeof EMOTES)[number];
