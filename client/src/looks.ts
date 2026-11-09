// Your chef's look: the hats you own and the one you wear, kept in this browser.
import { HATS, LOOK_COLORS, validLook, type ChefLook, type Hat, type HatId } from "@kitchen/shared";
import { spendCoins } from "./business";
import { stickerCount } from "./stickers";
import { readJson, writeJson } from "./storage";

const KEY = "kitchen.looks";

interface Wardrobe {
  owned: HatId[];
  look: ChefLook;
}

function load(): Wardrobe {
  const w = readJson<Partial<Wardrobe> | null>(KEY, null) ?? {};
  const owned = Array.isArray(w.owned) ? w.owned.filter((id) => HATS.some((h) => h.id === id)) : [];
  return { owned, look: validLook(w.look) ?? { hat: "toque", color: LOOK_COLORS[5] } };
}

/** Free hats, bought ones, and the ones your stickers have earned. */
export function hasHat(hat: Hat): boolean {
  if (hat.stickers) return stickerCount() >= hat.stickers;
  return hat.cost === 0 || load().owned.includes(hat.id);
}

export const myLook = (): ChefLook => load().look;

export function wear(look: ChefLook) {
  writeJson(KEY, { ...load(), look });
}

/** Buy a hat with the restaurant's coins and put it on; false if there isn't enough money. */
export function buyHat(hat: Hat): boolean {
  const w = load();
  if (hasHat(hat) || !spendCoins(hat.cost)) return false;
  writeJson(KEY, { owned: [...w.owned, hat.id], look: { ...w.look, hat: hat.id } });
  return true;
}
