// Your restaurant as a business: the money taken at the till over every shift, and the equipment
// bought with it. Kept in this browser; online, the host's equipment is what the kitchen uses.
import { LEVELS, UPGRADES, VENUES, levelByNumber, levelsAt, type Venue } from "@kitchen/shared";
import { bestStars } from "./progress";

const KEY = "kitchen.business";

export interface Business {
  /** money to spend on upgrades */
  coins: number;
  /** every coin ever taken at the till: never goes down, and opens new restaurants */
  totalSales: number;
  upgrades: string[];
}

export function loadBusiness(): Business {
  try {
    const b = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<Business>;
    const coins = Math.max(0, Math.floor(b.coins ?? 0));
    // saves from before total sales existed: at least what's in the bank was sold
    const totalSales = Math.max(coins, Math.floor(b.totalSales ?? 0));
    return { coins, totalSales, upgrades: (b.upgrades ?? []).filter((id) => UPGRADES.some((u) => u.id === id)) };
  } catch {
    return { coins: 0, totalSales: 0, upgrades: [] };
  }
}

function save(b: Business) {
  try {
    localStorage.setItem(KEY, JSON.stringify(b));
  } catch {
    // storage unavailable: the business just isn't remembered
  }
}

/** A shift's takings go into the restaurant's money. */
export function addTakings(coins: number) {
  if (coins <= 0) return;
  const b = loadBusiness();
  b.coins += coins;
  b.totalSales += coins;
  save(b);
}

/** What still stands between you and a restaurant: sales to make, and the big night before it. */
export function venueLock(venue: Venue): { sales: number; bigNight: string | null } | null {
  // in development every restaurant is open, so new kitchens can be tried straight away
  if (import.meta.env.DEV) return null;
  const i = VENUES.indexOf(venue);
  if (i <= 0) return null;
  const sales = Math.max(0, venue.unlockSales - loadBusiness().totalSales);
  const last = levelsAt(VENUES[i - 1].id).at(-1);
  const bigNight = last && bestStars(last.n) === 0 ? last.name : null;
  return sales || bigNight ? { sales, bigNight } : null;
}

/** Whether this level's restaurant is open. */
export const canPlay = (level: number) => LEVELS.some((l) => l.n === level) && !venueLock(VENUES.find((v) => v.id === levelByNumber(level).venue)!);

/** Buy an upgrade; false if it's owned already or there isn't enough money. */
export function buyUpgrade(id: string): boolean {
  const b = loadBusiness();
  const up = UPGRADES.find((u) => u.id === id);
  if (!up || b.upgrades.includes(id) || b.coins < up.cost) return false;
  b.coins -= up.cost;
  b.upgrades.push(id);
  save(b);
  return true;
}
