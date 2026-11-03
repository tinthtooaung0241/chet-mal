// The ingredient library: every food any restaurant uses, and how it behaves. Recipes, kitchens,
// the recipe book and the HUD all read from here, so a new restaurant only adds entries.
// Models and icons follow the same names: <Kind>.glb raw, <Kind>_Chopped / _Cooked / _Burnt for
// the other states (see assets/kitchen/ingredients and ingredient_states).

export type FoodState = "raw" | "chopped" | "cooked" | "burnt";

export interface FoodRule {
  chop?: boolean;
  /** The state an ingredient must be in before it can go on the stove. */
  cookFrom?: "raw" | "chopped";
  cookTime?: number;
  /** Extra seconds on the stove after "cooked" before it burns. */
  burnTime?: number;
  /** Kept in the fridge: goes off if left out raw for too long (see COLD_LIMIT). */
  cold?: boolean;
  /** Goes in the soup pot, and in what state (most soup vegetables are chopped first). */
  potFrom?: "raw" | "chopped";
}

export interface Ingredient extends FoodRule {
  /** Friendlier names for some states: "fries", "toast", "boiled noodles". */
  names?: Partial<Record<FoodState, string>>;
}

export const INGREDIENTS: Record<string, Ingredient> = {
  // --- room temperature: pantry shelves ---
  Tomato: { chop: true, potFrom: "chopped", names: { chopped: "chopped tomato" } },
  Carrot: { chop: true, potFrom: "chopped" },
  Onion: { chop: true, cookFrom: "chopped", cookTime: 5, burnTime: 6, potFrom: "chopped", names: { cooked: "fried onions" } },
  Potato: { chop: true, cookFrom: "chopped", cookTime: 7, burnTime: 7, potFrom: "chopped", names: { cooked: "fries" } },
  Bread: { chop: true, cookFrom: "chopped", cookTime: 4, burnTime: 5, names: { chopped: "sliced bread", cooked: "toast" } },
  /** dried rice noodles: boiled in the pan for shan noodles, or straight into the mohinga pot */
  Noodles: { cookFrom: "raw", cookTime: 4, burnTime: 6, potFrom: "raw", names: { raw: "rice noodles", cooked: "boiled noodles" } },
  Rice: { cookFrom: "raw", cookTime: 6, burnTime: 7, names: { raw: "rice", cooked: "steamed rice" } },
  /** lahpet: fermented tea leaves, eaten as they are */
  // kept chilled in the Burmese kitchen's greens fridge
  TeaLeaf: { cold: true, names: { raw: "pickled tea leaves" } },
  Cabbage: { chop: true, cold: true, names: { chopped: "shredded cabbage" } },
  // --- cold: reach-in fridges ---
  Lettuce: { chop: true, cold: true },
  Cheese: { chop: true, cold: true, names: { chopped: "sliced cheese" } },
  Mushroom: { chop: true, cookFrom: "chopped", cookTime: 5, burnTime: 6, cold: true, potFrom: "chopped", names: { cooked: "fried mushrooms" } },
  Steak: { cookFrom: "raw", cookTime: 8, burnTime: 7, cold: true },
  Fish: { chop: true, cookFrom: "raw", cookTime: 7, burnTime: 6, cold: true, potFrom: "chopped" },
  Egg: { cookFrom: "raw", cookTime: 4, burnTime: 5, cold: true, names: { cooked: "fried egg" } },
  Chicken: { chop: true, cookFrom: "chopped", cookTime: 7, burnTime: 6, cold: true, names: { chopped: "diced chicken", cooked: "cooked chicken" } },
};

/** Behaviour of every ingredient, keyed by kind. */
export const FOOD_RULES: Record<string, FoodRule> = INGREDIENTS;

/** Everything that can go in a soup pot. */
export const SOUP_INGREDIENTS = Object.keys(INGREDIENTS).filter((k) => INGREDIENTS[k].potFrom);

/** The state a food must be in to go in the pot (undefined: it doesn't). */
export const potState = (kind: string) => INGREDIENTS[kind]?.potFrom;

/** "fries", "sliced bread", otherwise "chopped tomato". */
export function describeFood(kind: string, state: FoodState): string {
  return INGREDIENTS[kind]?.names?.[state] ?? `${state} ${displayKind(kind).toLowerCase()}`;
}

/** A kind as people say it: "TeaLeaf" -> "Tea leaf". */
export function displayKind(kind: string): string {
  const words = kind.replace(/([a-z])([A-Z])/g, "$1 $2");
  return words[0] + words.slice(1).toLowerCase();
}
