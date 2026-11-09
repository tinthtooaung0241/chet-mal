// Best stars per level, kept in this browser. Purely a convenience: losing it loses nothing else.
import { readJson, writeJson } from "./storage";

const KEY = "kitchen.stars";

const load = () => readJson<Record<string, number>>(KEY, {});

export function bestStars(level: number): number {
  return load()[level] ?? 0;
}

/** Record a result; returns true if it beat the previous best. */
export function recordStars(level: number, stars: number): boolean {
  const all = load();
  if (stars <= (all[level] ?? 0)) return false;
  all[level] = stars;
  writeJson(KEY, all);
  return true;
}

const SCORES = "kitchen.scores";

/** Record a level's score; true if it's the best yet (overtime makes it a high-score chase). */
export function recordScore(level: number, score: number): boolean {
  const all = readJson<Record<string, number>>(SCORES, {});
  if (score <= (all[level] ?? 0)) return false;
  all[level] = score;
  writeJson(SCORES, all);
  return true;
}

export const starText = (n: number) => "★".repeat(n) + "☆".repeat(3 - n);
