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
  /** each role's strength, so all three pull their weight: how fast they chop and walk (1 = usual),
   *  the points each dish they serve adds for presentation, and whether they see the perfect moment
   *  (a golden shimmer) as well as hear it */
  chopRate: number;
  walkRate: number;
  presentation: number;
  seesPerfect: boolean;
  /** how fast they wash up (1 = usual) */
  washRate: number;
  /** a quick burst of speed on Shift, with a cooldown (see DASH in rules) */
  dash: boolean;
  /** carries a second plate or bowl on a tray: two dishes to the pass in one trip */
  tray: boolean;
  /** the eyes of the kitchen: early warnings (burning food, leaving customers) and a check mark on
   *  every plate */
  eyes: boolean;
  /** the strength in a few words (role cards, briefing) */
  strength: string;
  /** each role's edge at the pour meter, all about the same size: a slower pour (fill), a taller
   *  "just right" band (band), or a wider perfect line (core); and its name on the meter */
  pour: { fill: number; band: number; core: number; edge: string | null };
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
    chopRate: 1,
    walkRate: 1,
    presentation: 0,
    seesPerfect: false,
    washRate: 1,
    dash: false,
    tray: false,
    eyes: false,
    strength: "Every job, one at a time",
    pour: { fill: 1, band: 1, core: 1, edge: null },
  },
  head: {
    name: "Head chef",
    summary:
      "You run the pass: you see every ticket, hear every phone order and can see how each dish is coming along. You don't cook: tell your cooks what to make next, then plate, finish and serve, and ring up the till.",
    sees: true,
    hears: true,
    signals: true,
    cooks: false,
    charms: false,
    chopRate: 1,
    walkRate: 1,
    presentation: 5,
    seesPerfect: false,
    washRate: 1,
    dash: false,
    tray: false,
    eyes: false,
    strength: "Presentation: +5 points on every dish they serve",
    // the finishing touches are the head chef's job: a generous band for them
    pour: { fill: 1, band: 1.35, core: 1, edge: "Flourish" },
  },
  deaf: {
    name: "Deaf chef",
    summary: "You play by sight: tickets, colours, smoke. No sound reaches you, so watch the bars and the log.",
    sees: true,
    hears: false,
    signals: false,
    cooks: true,
    charms: false,
    chopRate: 1.3,
    walkRate: 1,
    presentation: 0,
    seesPerfect: true,
    washRate: 1,
    dash: false,
    tray: false,
    eyes: true,
    strength: "The eyes: chops fast, spots trouble early, checks every plate",
    pour: { fill: 1, band: 1, core: 1, edge: null },
  },
  mute: {
    name: "Mute chef",
    summary: "You see and hear everything but can't talk. Signal with G (ping), T + 1–6 (emotes) and B (bell). Only you can charm the customers: press B at the pass to wave, and every table waits longer.",
    sees: true,
    hears: true,
    signals: true,
    cooks: true,
    charms: true,
    chopRate: 1,
    walkRate: 1.15,
    presentation: 0,
    seesPerfect: false,
    washRate: 1.6,
    dash: true,
    tray: true,
    eyes: false,
    strength: "Quick hands: dashes (Shift), carries two dishes on a tray, washes up fast",
    // steady hands (they talk with them): the pour rises more slowly
    pour: { fill: 1.3, band: 1, core: 1, edge: "Steady hands" },
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
