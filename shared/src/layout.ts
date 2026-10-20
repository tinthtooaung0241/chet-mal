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
  | "sink";

interface LegendEntry {
  kind: StationKind;
  crate?: string;
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
};

// Row 0 is the back wall (far from the camera). "." is walkable floor.
// Restaurant layout: pans and the soup pot under the hood, a sink under the window, the pantry
// along the back and left walls, chopping on the right, and the pass facing the dining terrace.
// Must match the room built in Blender (assets/kitchen/environment/Kitchen_Room.glb).
export const KITCHEN = [
  "ebOOOPKCcnm",
  "t.........C",
  "l.........B",
  "p.........B",
  "s.........B",
  "f.........C",
  "kXCWWWCUDCC",
];

export function legend(char: string): LegendEntry | null {
  if (char === ".") return null;
  const entry = LEGEND[char];
  if (!entry) throw new Error(`Unknown kitchen tile "${char}"`);
  return entry;
}
