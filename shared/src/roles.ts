// Who perceives what. Pure data, shared by the rules, the HUD and the audio.

/**
 * How a piece of information reaches the kitchen.
 * - sight: anyone who can see
 * - sound: anyone who can hear
 * - touch: only the chef who did it (your own hands always tell you what you picked up)
 */
export type Sense = "sight" | "sound" | "touch";

export type Role = "full" | "blind" | "deaf" | "mute";

export interface RoleInfo {
  name: string;
  summary: string;
  sees: boolean;
  hears: boolean;
  /** uses pings, emotes and the bell instead of a voice */
  signals: boolean;
}

export const ROLES: Record<Role, RoleInfo> = {
  full: {
    name: "All senses (solo)",
    summary: "You see and hear everything. Good for learning the kitchen alone.",
    sees: true,
    hears: true,
    signals: true,
  },
  blind: {
    name: "Blind chef",
    summary: "You play by sound: phone orders, sizzles, beacons. Only you can hear the perfect sizzle best. Q to feel around.",
    sees: false,
    hears: true,
    signals: false,
  },
  deaf: {
    name: "Deaf chef",
    summary: "You play by sight: tickets, colours, smoke. No sound reaches you, so watch the bars and the log.",
    sees: true,
    hears: false,
    signals: false,
  },
  mute: {
    name: "Mute chef",
    summary: "You see and hear everything but can't talk. Signal with G (ping), T + 1–6 (emotes) and B (bell).",
    sees: true,
    hears: true,
    signals: true,
  },
};

export const ROLE_KEYS: Record<string, Role> = { Digit0: "full", Digit1: "blind", Digit2: "deaf", Digit3: "mute" };

/** @param isActor whether this chef caused the event (only then does "touch" reach it) */
export function perceives(role: Role, senses: readonly Sense[], isActor = true): boolean {
  const r = ROLES[role];
  return (isActor && senses.includes("touch")) || (r.sees && senses.includes("sight")) || (r.hears && senses.includes("sound"));
}

export const EMOTES = ["Yes", "No", "Here", "Hurry", "Stop", "Done"] as const;
export type Emote = (typeof EMOTES)[number];
