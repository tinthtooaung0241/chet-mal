// How a chef looks: a hat and its colour, bought with coins (or unlocked with stickers) and seen by
// everyone in the kitchen. Purely for fun: no hat changes how a chef plays.
export type HatId = "none" | "toque" | "beanie" | "cap" | "crown";

export interface Hat {
  id: HatId;
  name: string;
  /** coins in the shop (0 is free) */
  cost: number;
  /** or: unlocked by collecting this many stickers */
  stickers?: number;
}

export const HATS: Hat[] = [
  { id: "none", name: "No hat", cost: 0 },
  { id: "toque", name: "Chef's toque", cost: 0 },
  { id: "beanie", name: "Bobble beanie", cost: 60 },
  { id: "cap", name: "Diner cap", cost: 80 },
  { id: "crown", name: "Golden crown", cost: 0, stickers: 12 },
];

/** Hat colours (the crown is always gold). */
export const LOOK_COLORS = ["#f6a491", "#ffd257", "#a8dcae", "#9fc8ef", "#c9b3ea", "#f4f1ea", "#e4553f", "#3b4048"];

export interface ChefLook {
  hat: HatId;
  color: string;
}

/** A look from a message or a save, or null if it isn't one we know. */
export function validLook(look: unknown): ChefLook | null {
  const l = look as Partial<ChefLook> | null;
  if (!l || !HATS.some((h) => h.id === l.hat) || !LOOK_COLORS.includes(String(l.color))) return null;
  return { hat: l.hat!, color: l.color! };
}
