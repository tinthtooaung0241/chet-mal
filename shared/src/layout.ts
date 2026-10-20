export type StationKind = "counter" | "crate" | "board" | "stove" | "plates" | "serve" | "trash" | "sink";

interface LegendEntry {
  kind: StationKind;
  crate?: string;
}

const LEGEND: Record<string, LegendEntry> = {
  C: { kind: "counter" },
  B: { kind: "board" },
  O: { kind: "stove" },
  D: { kind: "plates" },
  W: { kind: "serve" },
  X: { kind: "trash" },
  K: { kind: "sink" },
  t: { kind: "crate", crate: "Tomato" },
  l: { kind: "crate", crate: "Lettuce" },
  p: { kind: "crate", crate: "Potato" },
  s: { kind: "crate", crate: "Steak" },
  f: { kind: "crate", crate: "Fish" },
};

// Row 0 is the back wall (far from the camera). "." is walkable floor.
// Restaurant layout: stoves under the hood, sinks under the window, produce racks on the
// left wall, chopping on the right, and the pass (serving window) facing the dining terrace.
// Must match the room built in Blender (assets/kitchen/environment/Kitchen_Room.glb).
export const KITCHEN = [
  "CCOOOCKKC",
  "t.......C",
  "l.......B",
  "p.......B",
  "s.......C",
  "f.......D",
  "CXCWWWCCC",
];

export function legend(char: string): LegendEntry | null {
  if (char === ".") return null;
  const entry = LEGEND[char];
  if (!entry) throw new Error(`Unknown kitchen tile "${char}"`);
  return entry;
}
