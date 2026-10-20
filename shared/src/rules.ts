// Pure game data: recipes, timings, levels. No rendering or networking.

export const TILE = 0.85; // metres per kitchen grid cell (stations are ~0.8 m wide)
export const CHEF_RADIUS = 0.28;
export const CHEF_SPEED = 3.2; // m/s
export const REACH = 0.65; // how far ahead of the chef we look for a station
export const CHOP_TIME = 1.8; // seconds of chopping per ingredient
export const ROUND_TIME = 180;
export const MAX_ORDERS = 4;
export const ORDER_INTERVAL = 20;
export const EXPIRED_PENALTY = 10;
export const MAX_PLATE_ITEMS = 3;
/** The perfect window opens this long after food is cooked... */
export const PERFECT_DELAY = 0.8;
/** ...and stays open this long. It is only announced by sound (the sizzle peaks). */
export const PERFECT_WINDOW = 1.6;
export const PERFECT_BONUS = 10;
export const PING_TIME = 5;
export const SICK_PENALTY = 15;
export const BUMP_COOLDOWN = 0.4;

// Soup: three chopped ingredients go in the pot, it boils, then it's ladled into a bowl.
export const SOUP_SIZE = 3;
export const SOUP_TIME = 10;
/** extra seconds after the soup is ready before it boils dry and burns */
export const SOUP_BURN = 12;
export const SOUP_INGREDIENTS = ["Tomato", "Onion", "Carrot", "Potato", "Mushroom"];

export type FoodState = "raw" | "chopped" | "cooked" | "burnt";

export interface FoodRule {
  chop?: boolean;
  /** The state an ingredient must be in before it can go on the stove. */
  cookFrom?: "raw" | "chopped";
  cookTime?: number;
  /** Extra seconds on the stove after "cooked" before it burns. */
  burnTime?: number;
}

export const FOOD_RULES: Record<string, FoodRule> = {
  Tomato: { chop: true },
  Lettuce: { chop: true },
  Carrot: { chop: true },
  Cheese: { chop: true },
  Onion: { chop: true, cookFrom: "chopped", cookTime: 5, burnTime: 6 },
  Mushroom: { chop: true, cookFrom: "chopped", cookTime: 5, burnTime: 6 },
  Potato: { chop: true, cookFrom: "chopped", cookTime: 7, burnTime: 7 },
  Bread: { chop: true, cookFrom: "chopped", cookTime: 4, burnTime: 5 },
  Steak: { cookFrom: "raw", cookTime: 8, burnTime: 7 },
  Fish: { cookFrom: "raw", cookTime: 7, burnTime: 6 },
  Egg: { cookFrom: "raw", cookTime: 4, burnTime: 5 },
};

export interface RecipeItem {
  kind: string;
  state: FoodState;
}

export interface Recipe {
  id: string;
  name: string;
  /** plated dishes, or soup served in a bowl (items are the chopped soup ingredients) */
  vessel: "plate" | "bowl";
  items: RecipeItem[];
  reward: number;
  /** Seconds the customer will wait. */
  time: number;
}

const item = (kind: string, state: FoodState): RecipeItem => ({ kind, state });
const soup = (...kinds: string[]): RecipeItem[] => kinds.map((k) => item(k, "chopped"));

export const RECIPES: Recipe[] = [
  { id: "salad", name: "Salad", vessel: "plate", items: [item("Tomato", "chopped"), item("Lettuce", "chopped")], reward: 20, time: 60 },
  { id: "grilled-fish", name: "Grilled fish", vessel: "plate", items: [item("Fish", "cooked")], reward: 20, time: 60 },
  { id: "cheese-toastie", name: "Cheese toastie", vessel: "plate", items: [item("Bread", "cooked"), item("Cheese", "chopped")], reward: 25, time: 70 },
  { id: "steak-fries", name: "Steak & fries", vessel: "plate", items: [item("Steak", "cooked"), item("Potato", "cooked")], reward: 35, time: 85 },
  { id: "steak-onions", name: "Steak & onions", vessel: "plate", items: [item("Steak", "cooked"), item("Onion", "cooked")], reward: 35, time: 85 },
  { id: "steak-salad", name: "Steak salad", vessel: "plate", items: [item("Steak", "cooked"), item("Lettuce", "chopped")], reward: 30, time: 80 },
  { id: "fish-chips", name: "Fish & chips", vessel: "plate", items: [item("Fish", "cooked"), item("Potato", "cooked")], reward: 35, time: 85 },
  {
    id: "breakfast",
    name: "Full breakfast",
    vessel: "plate",
    items: [item("Egg", "cooked"), item("Bread", "cooked"), item("Mushroom", "cooked")],
    reward: 45,
    time: 100,
  },
  { id: "tomato-soup", name: "Tomato soup", vessel: "bowl", items: soup("Tomato", "Tomato", "Tomato"), reward: 35, time: 90 },
  { id: "veg-soup", name: "Vegetable soup", vessel: "bowl", items: soup("Carrot", "Onion", "Potato"), reward: 40, time: 95 },
  { id: "mushroom-soup", name: "Mushroom soup", vessel: "bowl", items: soup("Mushroom", "Mushroom", "Onion"), reward: 40, time: 95 },
];

export const recipeById = (id: string): Recipe => {
  const recipe = RECIPES.find((r) => r.id === id);
  if (!recipe) throw new Error(`Unknown recipe ${id}`);
  return recipe;
};

// --- levels -------------------------------------------------------------------------

/** Tickets are printed (seen); phone orders are spoken once (heard). */
export type OrderChannel = "ticket" | "phone";

/** Mid-shift chaos that flips who leads: a blind chef doesn't mind the dark, a deaf chef doesn't mind the noise. */
export type KitchenEventKind = "blackout" | "storm";

export interface Level {
  n: number;
  name: string;
  blurb: string;
  recipes: string[];
  channels: OrderChannel[];
  time: number;
  /** chance that produce from a crate has gone off */
  spoilChance: number;
  events: { at: number; kind: KitchenEventKind; duration: number }[];
  /** points for one, two and three stars */
  stars: [number, number, number];
}

const ALL_RECIPES = RECIPES.map((r) => r.id);

export const LEVELS: Level[] = [
  {
    n: 1,
    name: "Opening day",
    blurb: "Printed tickets only. Learn the kitchen and hand food to each other.",
    recipes: ["salad", "grilled-fish", "cheese-toastie"],
    channels: ["ticket"],
    time: 150,
    spoilChance: 0,
    events: [],
    stars: [40, 85, 130],
  },
  {
    n: 2,
    name: "The grill",
    blurb: "Steak and fish all night. Listen for the sizzle to whistle: that's a perfect cook.",
    recipes: ["grilled-fish", "steak-fries", "steak-onions", "steak-salad"],
    channels: ["ticket"],
    time: 180,
    spoilChance: 0,
    events: [],
    stars: [60, 120, 180],
  },
  {
    n: 3,
    name: "Soup's on",
    blurb: "Three chopped vegetables in the pot, let it boil, ladle it into a bowl. The phone starts ringing too.",
    recipes: ["tomato-soup", "veg-soup", "salad", "cheese-toastie"],
    channels: ["ticket", "phone"],
    time: 180,
    spoilChance: 0,
    events: [],
    stars: [60, 120, 175],
  },
  {
    n: 4,
    name: "Breakfast rush",
    blurb: "Eggs, toast and mushrooms on one plate, soups and fish on the side. Keep the pans moving!",
    recipes: ["breakfast", "mushroom-soup", "fish-chips", "cheese-toastie", "steak-onions"],
    channels: ["ticket", "phone"],
    time: 190,
    spoilChance: 0,
    events: [],
    stars: [60, 125, 185],
  },
  {
    n: 5,
    name: "Bad batch",
    blurb: "Some produce has gone off. Spot the mould, or sniff it (Z). Never serve it!",
    recipes: ALL_RECIPES,
    channels: ["ticket", "phone"],
    time: 190,
    spoilChance: 0.25,
    events: [],
    stars: [55, 115, 170],
  },
  {
    n: 6,
    name: "Storm night",
    blurb: "The power cuts out, then a storm drowns every sound. Your blind and deaf chefs lead the way.",
    recipes: ALL_RECIPES,
    channels: ["ticket", "phone"],
    time: 210,
    spoilChance: 0.15,
    events: [
      { at: 55, kind: "blackout", duration: 22 },
      { at: 135, kind: "storm", duration: 22 },
    ],
    stars: [55, 115, 170],
  },
];

export const levelByNumber = (n: number): Level => LEVELS.find((l) => l.n === n) ?? LEVELS[0];

export function starsFor(level: Level, score: number): number {
  return level.stars.filter((s) => score >= s).length;
}

const SPECIAL_NAMES: Record<string, string> = {
  "Potato:cooked": "fries",
  "Bread:chopped": "sliced bread",
  "Bread:cooked": "toast",
  "Cheese:chopped": "sliced cheese",
  "Egg:cooked": "fried egg",
  "Onion:cooked": "fried onions",
  "Mushroom:cooked": "fried mushrooms",
};

export function describeFood(kind: string, state: FoodState): string {
  return SPECIAL_NAMES[`${kind}:${state}`] ?? `${state} ${kind.toLowerCase()}`;
}

/** "tomato soup" when all three are the same, otherwise "vegetable soup" / "mushroom soup". */
export function soupName(kinds: string[]): string {
  const unique = [...new Set(kinds)];
  if (unique.length === 1) return `${unique[0].toLowerCase()} soup`;
  const recipe = RECIPES.find(
    (r) => r.vessel === "bowl" && r.items.map((i) => i.kind).sort().join() === [...kinds].sort().join(),
  );
  return recipe ? recipe.name.toLowerCase() : "mixed soup";
}

export function describeRecipe(recipe: Recipe): string {
  if (recipe.vessel === "bowl") {
    const counts = new Map<string, number>();
    for (const i of recipe.items) counts.set(i.kind, (counts.get(i.kind) ?? 0) + 1);
    const parts = [...counts].map(([k, n]) => `${n > 1 ? `${n} ` : ""}chopped ${k.toLowerCase()}`);
    return `soup of ${parts.join(" + ")}`;
  }
  return recipe.items.map((i) => describeFood(i.kind, i.state)).join(" + ");
}
