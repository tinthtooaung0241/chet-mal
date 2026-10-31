import { SPICES } from "./rules";

export type StationKind =
  | "counter"
  | "crate"
  | "board"
  | "stove"
  | "pot"
  | "plates"
  | "bowls"
  | "serve"
  | "trash"
  | "sink"
  | "fridge"
  | "pantry"
  | "spice"
  /** scenery: takes up its tile but is never used (a corner nobody can reach comfortably) */
  | "decor";

interface LegendEntry {
  kind: StationKind;
  crate?: string;
  /** what a fridge or spice rack holds, in picking order (keys 1, 2, 3...) */
  stock?: string[];
  /** a fuller name for the station */
  label?: string;
}

const LEGEND: Record<string, LegendEntry> = {
  C: { kind: "counter" },
  B: { kind: "board" },
  O: { kind: "stove" },
  P: { kind: "pot" },
  D: { kind: "plates" },
  U: { kind: "bowls" },
  W: { kind: "serve" },
  X: { kind: "trash" },
  K: { kind: "sink" },
  t: { kind: "crate", crate: "Tomato" },
  l: { kind: "crate", crate: "Lettuce" },
  p: { kind: "crate", crate: "Potato" },
  s: { kind: "crate", crate: "Steak" },
  f: { kind: "crate", crate: "Fish" },
  e: { kind: "crate", crate: "Egg" },
  b: { kind: "crate", crate: "Bread" },
  c: { kind: "crate", crate: "Cheese" },
  n: { kind: "crate", crate: "Onion" },
  m: { kind: "crate", crate: "Mushroom" },
  k: { kind: "crate", crate: "Carrot" },
  // two reach-in fridges side by side: proteins in one, dairy and greens in the other
  F: { kind: "fridge", stock: ["Steak", "Fish", "Egg"], label: "meat and fish fridge" },
  G: { kind: "fridge", stock: ["Cheese", "Lettuce", "Mushroom"], label: "dairy and greens fridge" },
  // flour sacks and a pot of herbs filling the back-left corner (just for looks)
  Z: { kind: "decor" },
  // two pantry shelves for what's kept at room temperature (one ingredient per shelf, top down)
  A: { kind: "pantry", stock: ["Potato", "Onion", "Carrot"], label: "root vegetable shelf" },
  H: { kind: "pantry", stock: ["Bread", "Tomato"], label: "bread and tomato shelf" },
  // spice racks: one by the stoves, one by the pass for finishing
  S: { kind: "spice", stock: [...SPICES], label: "spice rack" },
};

// Row 0 is the back wall (far from the camera). "." is walkable floor.
// Restaurant layout, laid out along the way a dish travels:
//   storage (back right: two pantry shelves, two fridges round the corner)
//   -> chopping boards right beside the fridges
//   -> a spice rack next to the stoves (season before cooking), stoves and the soup pot under the hood
//   -> plates and bowls by the pass, with the second spice rack beside them for finishing touches
//   -> the pass, facing the terrace.
// Prep counters line the left wall and sit beside the sink; the corners hold decoration only.
export const KITCHEN = [
  "ZSOOOPKCAHZ",
  "C.........F",
  "C.........G",
  "C.........B",
  "C.........B",
  "..........B",
  ".XCWWWCUDSC",
];

export function legend(char: string): LegendEntry | null {
  if (char === ".") return null;
  const entry = LEGEND[char];
  if (!entry) throw new Error(`Unknown kitchen tile "${char}"`);
  return entry;
}
