// The daily special: today's shift and twist, your best score today and how many days in a row
// you've cooked one. Kept in this browser.
import { LEVELS, dailySpecial, twistById, type Twist } from "@kitchen/shared";
import { canPlay } from "./business";
import { readJson, writeJson } from "./storage";

const KEY = "kitchen.daily";
/** coins for the first daily special finished each day (with a star), plus a little per day of streak */
const DAILY_BONUS = 40;
const STREAK_BONUS = 10;

interface DailyRecord {
  /** the last day a daily special was finished */
  day: string;
  best: number;
  streak: number;
}

/** A day as the player's calendar has it: "2026-11-09". */
export function dayKey(date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function yesterday(): string {
  const now = new Date();
  return dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
}

/** Today's special: a shift you have open, and a twist. */
export function todaysSpecial(): { level: number; twist: Twist } {
  const open = LEVELS.filter((l) => canPlay(l.n)).map((l) => l.n);
  const pick = dailySpecial(dayKey(), open.length ? open : [1]);
  return { level: pick.level, twist: twistById(pick.twist)! };
}

const record = () => readJson<DailyRecord>(KEY, { day: "", best: 0, streak: 0 });

/** Today's best, and the streak (still alive if the last special was yesterday). */
export function dailyStatus(): { playedToday: boolean; best: number; streak: number } {
  const r = record();
  const today = r.day === dayKey();
  return { playedToday: today, best: today ? r.best : 0, streak: today || r.day === yesterday() ? r.streak : 0 };
}

/** A daily special finished: the bonus coins it earned (only the first each day), a new best? and the streak. */
export function finishDaily(score: number, stars: number): { bonus: number; best: boolean; streak: number } {
  const r = record();
  const today = dayKey();
  const first = r.day !== today;
  const streak = first ? (r.day === yesterday() ? r.streak + 1 : 1) : r.streak;
  writeJson(KEY, { day: today, best: first ? score : Math.max(score, r.best), streak });
  const bonus = first && stars > 0 ? DAILY_BONUS + STREAK_BONUS * Math.min(streak - 1, 5) : 0;
  return { bonus, best: first || score > r.best, streak };
}
