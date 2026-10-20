// Pure game data: no Babylon imports, so this can move to a shared package for the server later.

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
  items: RecipeItem[];
  reward: number;
  /** Seconds the customer will wait. */
  time: number;
}

export const RECIPES: Recipe[] = [
  {
    id: "salad",
    name: "Salad",
    items: [
      { kind: "Tomato", state: "chopped" },
      { kind: "Lettuce", state: "chopped" },
    ],
    reward: 20,
    time: 60,
  },
  {
    id: "steak-fries",
    name: "Steak & fries",
    items: [
      { kind: "Steak", state: "cooked" },
      { kind: "Potato", state: "cooked" },
    ],
    reward: 35,
    time: 85,
  },
  {
    id: "grilled-fish",
    name: "Grilled fish",
    items: [{ kind: "Fish", state: "cooked" }],
    reward: 20,
    time: 60,
  },
  {
    id: "fish-chips",
    name: "Fish & chips",
    items: [
      { kind: "Fish", state: "cooked" },
      { kind: "Potato", state: "cooked" },
    ],
    reward: 35,
    time: 85,
  },
  {
    id: "steak-salad",
    name: "Steak salad",
    items: [
      { kind: "Steak", state: "cooked" },
      { kind: "Lettuce", state: "chopped" },
    ],
    reward: 30,
    time: 80,
  },
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

const ALL_RECIPES = ["salad", "grilled-fish", "steak-fries", "fish-chips", "steak-salad"];

export const LEVELS: Level[] = [
  {
    n: 1,
    name: "Opening day",
    blurb: "Printed tickets only. Learn the kitchen and hand food to each other.",
    recipes: ["salad", "grilled-fish"],
    channels: ["ticket"],
    time: 150,
    spoilChance: 0,
    events: [],
    stars: [40, 80, 120],
  },
  {
    n: 2,
    name: "The grill",
    blurb: "Steak and fish all night. Listen for the sizzle to whistle: that's a perfect cook.",
    recipes: ["grilled-fish", "steak-fries", "steak-salad"],
    channels: ["ticket"],
    time: 180,
    spoilChance: 0,
    events: [],
    stars: [60, 120, 180],
  },
  {
    n: 3,
    name: "Phone lines",
    blurb: "Orders come by ticket and by phone. Whoever hears or reads one has to pass it on.",
    recipes: ALL_RECIPES,
    channels: ["ticket", "phone"],
    time: 180,
    spoilChance: 0,
    events: [],
    stars: [60, 115, 170],
  },
  {
    n: 4,
    name: "Bad batch",
    blurb: "Some produce has gone off. Spot the mould, or sniff it (Z). Never serve it!",
    recipes: ALL_RECIPES,
    channels: ["ticket", "phone"],
    time: 180,
    spoilChance: 0.25,
    events: [],
    stars: [55, 110, 160],
  },
  {
    n: 5,
    name: "Storm night",
    blurb: "The power cuts out, then a storm drowns every sound. Your blind and deaf chefs lead the way.",
    recipes: ALL_RECIPES,
    channels: ["ticket", "phone"],
    time: 200,
    spoilChance: 0.15,
    events: [
      { at: 50, kind: "blackout", duration: 22 },
      { at: 125, kind: "storm", duration: 22 },
    ],
    stars: [55, 110, 160],
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
};

export function describeFood(kind: string, state: FoodState): string {
  return SPECIAL_NAMES[`${kind}:${state}`] ?? `${state} ${kind.toLowerCase()}`;
}

export function describeRecipe(recipe: Recipe): string {
  return recipe.items.map((i) => describeFood(i.kind, i.state)).join(" + ");
}
