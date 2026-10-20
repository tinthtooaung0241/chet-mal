// Best stars per level, kept in this browser. Purely a convenience: losing it loses nothing else.
const KEY = "kitchen.stars";

function load(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, number>;
  } catch {
    return {};
  }
}

export function bestStars(level: number): number {
  return load()[level] ?? 0;
}

/** Record a result; returns true if it beat the previous best. */
export function recordStars(level: number, stars: number): boolean {
  const all = load();
  if (stars <= (all[level] ?? 0)) return false;
  all[level] = stars;
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // storage unavailable: the result just isn't remembered
  }
  return true;
}

export const starText = (n: number) => "★".repeat(n) + "☆".repeat(3 - n);
