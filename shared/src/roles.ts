// Who perceives what. Pure data, shared by the rules, the HUD and the audio.

/**
 * How a piece of information reaches the kitchen.
 * - sight: anyone who can see
 * - sound: anyone who can hear
 * - touch: only the chef who did it (your own hands always tell you what you picked up)
 */
export type Sense = "sight" | "sound" | "touch";

export type Role = "full" | "head" | "deaf" | "mute" | "blind";

export interface RoleInfo {
  name: string;
  summary: string;
  sees: boolean;
  hears: boolean;
  /** uses pings, emotes and the bell (the mute cook instead of a voice; the head chef as well as one) */
  signals: boolean;
  /** handles raw food: fetches, chops, cooks and seasons ingredients (the head chef only plates and serves) */
  cooks: boolean;
}

export const ROLES: Record<Role, RoleInfo> = {
  full: {
    name: "All senses (solo)",
    summary: "You see and hear everything. Good for learning the kitchen alone.",
    sees: true,
    hears: true,
    signals: true,
    cooks: true,
  },
  head: {
    name: "Head chef",
    summary:
      "You run the pass: you see every ticket, hear every phone order and can see how each dish is coming along. You don't cook: plate, finish and serve, and tell your cooks what to make next.",
    sees: true,
    hears: true,
    signals: true,
    cooks: false,
  },
  deaf: {
    name: "Deaf chef",
    summary: "You play by sight: tickets, colours, smoke. No sound reaches you, so watch the bars and the log.",
    sees: true,
    hears: false,
    signals: false,
    cooks: true,
  },
  mute: {
    name: "Mute chef",
    summary: "You see and hear everything but can't talk. Signal with G (ping), T + 1–6 (emotes) and B (bell).",
    sees: true,
    hears: true,
    signals: true,
    cooks: true,
  },
  // accessibility option for players who are blind: the whole game by sound
  blind: {
    name: "Blind cook (audio)",
    summary: "You play by sound: phone orders, sizzles, beacons. Only you can hear the perfect sizzle best. Q to feel around.",
    sees: false,
    hears: true,
    signals: false,
    cooks: true,
  },
};

export const ROLE_KEYS: Record<string, Role> = { Digit0: "full", Digit1: "head", Digit2: "deaf", Digit3: "mute", Digit4: "blind" };

/** @param isActor whether this chef caused the event (only then does "touch" reach it) */
export function perceives(role: Role, senses: readonly Sense[], isActor = true): boolean {
  const r = ROLES[role];
  return (isActor && senses.includes("touch")) || (r.sees && senses.includes("sight")) || (r.hears && senses.includes("sound"));
}

export const EMOTES = ["Yes", "No", "Here", "Hurry", "Stop", "Done"] as const;
export type Emote = (typeof EMOTES)[number];
