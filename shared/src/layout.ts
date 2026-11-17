import { BURMESE_SPICES, PAYMENTS, SPICES, type VenueId } from "./rules";

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
  /** the till on the pass: customers pay here, cooks ring them up (and buy upgrades between payers) */
  | "register"
  /** beside the till: customers leave their dirty dishes here (self-service); chefs take them to the sink */
  | "returns"
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
  // the till on the pass counter: 1 cash, 2 card
  R: { kind: "register", stock: [...PAYMENTS], label: "till" },
  // beside the till: the dirty dish counter, where customers leave their plates
  Q: { kind: "returns", label: "dirty dish counter" },
  // the spice rack, by the stoves
  S: { kind: "spice", stock: [...SPICES], label: "spice rack" },
};

// Row 0 is the back wall (far from the camera). "." is walkable floor.
// Restaurant layout, laid out along the way a dish travels:
//   storage (back right: two pantry shelves, two fridges round the corner)
//   -> chopping boards right beside the fridges
//   -> a spice rack next to the stoves (season before cooking), stoves and the soup pot under the hood
//   -> plating counters along the pass, plates and bowls on rolling dish carts down the left wall
//   -> the till beside the pass, where customers pay on their way out.
// A double sink sits under the window, away from the customers.
//   -> the pass, facing the terrace.
// Prep counters sit at the back of the left wall; the corners hold decoration only.
export const KITCHEN = [
  "ZSOOOPKKAHZ",
  "C.........F",
  "C.........G",
  "D.........B",
  "U.........B",
  "..........B",
  ".XCWWWCRQCC",
];

/**
 * The Burmese kitchen in Yangon: the same footprint (so the room, terrace and customers' paths
 * fit), stocked for Burmese cooking. Storage holds noodles, rice, coconut milk, tea leaves, cabbage and Shan tofu; the
 * fridges hold chicken, fish and eggs; the rack holds the toppings.
 */
const BURMESE_LEGEND: Record<string, LegendEntry> = {
  F: { kind: "fridge", stock: ["Chicken", "Fish", "Egg"], label: "meat and fish fridge" },
  G: { kind: "fridge", stock: ["Cabbage", "TeaLeaf", "Tofu"], label: "greens and tea leaf fridge" },
  A: { kind: "pantry", stock: ["Noodles", "Rice", "Coconut"], label: "noodle and rice shelf" },
  H: { kind: "pantry", stock: ["Tomato", "Onion"], label: "tomato and onion shelf" },
  S: { kind: "spice", stock: [...BURMESE_SPICES], label: "topping rack" },
};

/**
 * Other ways to lay out the same room, so each level's routes and teamwork change. The ring of
 * stations along the walls stays where the room's walls, hood and windows are; the middle changes.
 */
export type LayoutId = "standard" | "island" | "split" | "corridor";

export const LAYOUTS: Record<LayoutId, { name: string; blurb: string; grid: string[] }> = {
  standard: { name: "The usual kitchen", blurb: "Open floor in the middle", grid: KITCHEN },
  // the chopping boards move onto an island between the stoves and the pass: walk round it
  island: {
    name: "Island kitchen",
    blurb: "Boards on an island: walk round it",
    grid: ["ZSOOOPKKAHZ", "C.........F", "C..CBBBC..G", "D.........C", "U.........C", "..........C", ".XCWWWCRQCC"],
  },
  // a wall of counters splits prep (storage, boards) from cooking (stoves, plates, the pass)
  split: {
    name: "Split kitchen",
    blurb: "A wall splits prep from cooking: pass food over it",
    grid: ["ZSOOOPKKAHZ", "C.....C...F", "C.....C...G", "D.....C...B", "U.........B", "..........B", ".XCWWWCRQCC"],
  },
  // a long counter shuts the stoves into a back corridor, open only at the ends
  corridor: {
    name: "Corridor kitchen",
    blurb: "The stoves are behind a long counter",
    grid: ["ZSOOOPKKAHZ", "C.........F", "C.........G", "D.CCCBCC..B", "U.........B", "..........B", ".XCWWWCRQCC"],
  },
};


const LEGENDS: Record<VenueId, Record<string, LegendEntry>> = {
  street: LEGEND,
  burmese: { ...LEGEND, ...BURMESE_LEGEND },
};

export function legend(char: string, venue: VenueId = "street"): LegendEntry | null {
  if (char === ".") return null;
  const entry = LEGENDS[venue][char];
  if (!entry) throw new Error(`Unknown kitchen tile "${char}"`);
  return entry;
}
