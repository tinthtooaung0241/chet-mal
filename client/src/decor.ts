// Decor for the terrace, bought with the restaurant's coins and kept in this browser. Purely for
// looks: you see your own restaurant's decor (online too).
import { spendCoins } from "./business";
import { readJson, writeJson } from "./storage";

export type DecorId = "palm" | "flowers" | "lanterns" | "sign";

export interface Decor {
  id: DecorId;
  name: string;
  blurb: string;
  cost: number;
}

export const DECOR: Decor[] = [
  { id: "flowers", name: "Flower boxes", blurb: "Bright flowers along the terrace steps.", cost: 40 },
  { id: "palm", name: "Potted palms", blurb: "Two leafy palms in the terrace corners.", cost: 60 },
  { id: "lanterns", name: "Paper lanterns", blurb: "Glowing lanterns over the tables.", cost: 80 },
  { id: "sign", name: "Welcome sign", blurb: "A chalkboard by the steps: Open!", cost: 90 },
];

const KEY = "kitchen.decor";

export const ownedDecor = (): DecorId[] => readJson<DecorId[]>(KEY, []).filter((id) => DECOR.some((d) => d.id === id));

/** Buy a piece of decor; false if it's owned already or there isn't enough money. */
export function buyDecor(decor: Decor): boolean {
  const owned = ownedDecor();
  if (owned.includes(decor.id) || !spendCoins(decor.cost)) return false;
  writeJson(KEY, [...owned, decor.id]);
  return true;
}
