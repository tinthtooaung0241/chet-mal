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
  /** Kept in the fridge: goes off if left out raw for too long (see COLD_LIMIT). */
  cold?: boolean;
}

export const FOOD_RULES: Record<string, FoodRule> = {
  // pantry (room temperature)
  Tomato: { chop: true },
  Carrot: { chop: true },
  Onion: { chop: true, cookFrom: "chopped", cookTime: 5, burnTime: 6 },
  Potato: { chop: true, cookFrom: "chopped", cookTime: 7, burnTime: 7 },
  Bread: { chop: true, cookFrom: "chopped", cookTime: 4, burnTime: 5 },
  // fridge
  Lettuce: { chop: true, cold: true },
  Cheese: { chop: true, cold: true },
  Mushroom: { chop: true, cookFrom: "chopped", cookTime: 5, burnTime: 6, cold: true },
  Steak: { cookFrom: "raw", cookTime: 8, burnTime: 7, cold: true },
  Fish: { cookFrom: "raw", cookTime: 7, burnTime: 6, cold: true },
  Egg: { cookFrom: "raw", cookTime: 4, burnTime: 5, cold: true },
};

// Cold food out of the fridge: a warning, then it goes off (like real food safety, sped up).
export const COLD_WARN = 35;
export const COLD_LIMIT = 50;

// Seasoning from the spice racks (keys 1-8 at a rack): the short things on the front row (1-4),
// the tall bottles on the raised back step (5-8), each row left to right.
export const SPICES = ["Salt", "Butter", "Lemon", "Herbs", "Pepper", "OliveOil", "Soy", "Vinegar"] as const;
export type Spice = (typeof SPICES)[number];
export const SPICE_NAMES: Record<Spice, string> = {
  Salt: "salt",
  Pepper: "black pepper",
  OliveOil: "olive oil",
  Butter: "butter",
  Lemon: "lemon",
  Herbs: "fresh herbs",
  Soy: "soy sauce",
  Vinegar: "malt vinegar",
};
export const SEASON_BONUS = 5;
export const SEASON_PENALTY = 5;

export const spiceList = (spices: readonly string[]) => {
  const names = spices.map((s) => SPICE_NAMES[s as Spice] ?? s.toLowerCase());
  return names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}` : (names[0] ?? "");
};

export interface RecipeItem {
  kind: string;
  state: FoodState;
  /** seasoning that goes on this ingredient itself... */
  season?: Spice[];
  /** ...before it's cooked (salt the steak, butter the bread) or straight after (salt the fries) */
  seasonAt?: SeasonTime;
}

/** When an ingredient was seasoned: before it hit the pan, or once it was cooked. */
export type SeasonTime = "before" | "after";

/** Seasoning applied now counts as "before" until the food is cooked. */
export const seasonTimeOf = (state: FoodState): SeasonTime => (state === "cooked" || state === "burnt" ? "after" : "before");

export interface Recipe {
  id: string;
  name: string;
  /** plated dishes, or soup served in a bowl (items are the chopped soup ingredients) */
  vessel: "plate" | "bowl";
  items: RecipeItem[];
  reward: number;
  /** Seconds the customer will wait. */
  time: number;
  /** finishing touches on the plate or bowl, added last (lemon, herbs, a drizzle of oil) */
  finish?: Spice[];
}

const item = (kind: string, state: FoodState, season?: Spice[], seasonAt?: SeasonTime): RecipeItem => ({ kind, state, season, seasonAt });
/** seasoned before cooking: salt the steak, butter the bread */
const pre = (kind: string, ...season: Spice[]) => item(kind, "cooked", season, "before");
/** seasoned straight out of the pan: salt the fries */
const post = (kind: string, ...season: Spice[]) => item(kind, "cooked", season, "after");
const soup = (...kinds: string[]): RecipeItem[] => kinds.map((k) => item(k, "chopped"));

// Seasoned the way each dish really is, at the step it really happens.
export const RECIPES: Recipe[] = [
  { id: "salad", name: "Salad", vessel: "plate", items: [item("Tomato", "chopped"), item("Lettuce", "chopped")], reward: 20, time: 60, finish: ["OliveOil", "Lemon", "Salt"] },
  { id: "grilled-fish", name: "Grilled fish", vessel: "plate", items: [pre("Fish", "Salt")], reward: 20, time: 60, finish: ["Lemon", "Herbs"] },
  { id: "cheese-toastie", name: "Cheese toastie", vessel: "plate", items: [pre("Bread", "Butter"), item("Cheese", "chopped")], reward: 25, time: 70 },
  { id: "steak-fries", name: "Steak & fries", vessel: "plate", items: [pre("Steak", "Salt", "Pepper"), post("Potato", "Salt")], reward: 35, time: 85 },
  { id: "steak-onions", name: "Steak & onions", vessel: "plate", items: [pre("Steak", "Salt", "Pepper"), item("Onion", "cooked")], reward: 35, time: 85, finish: ["Butter"] },
  { id: "steak-salad", name: "Steak salad", vessel: "plate", items: [pre("Steak", "Salt", "Pepper"), item("Lettuce", "chopped")], reward: 30, time: 80, finish: ["OliveOil"] },
  { id: "fish-chips", name: "Fish & chips", vessel: "plate", items: [pre("Fish", "Salt"), post("Potato", "Salt")], reward: 35, time: 85, finish: ["Vinegar"] },
  {
    id: "breakfast",
    name: "Full breakfast",
    vessel: "plate",
    items: [post("Egg", "Salt", "Pepper"), pre("Bread", "Butter"), pre("Mushroom", "Butter")],
    reward: 45,
    time: 100,
  },
  { id: "soy-fish", name: "Soy-glazed fish", vessel: "plate", items: [pre("Fish", "Soy")], reward: 25, time: 65, finish: ["Lemon"] },
  { id: "stir-fry", name: "Mushroom stir-fry", vessel: "plate", items: [item("Mushroom", "cooked"), item("Onion", "cooked")], reward: 35, time: 85, finish: ["Soy", "Pepper"] },
  { id: "tomato-soup", name: "Tomato soup", vessel: "bowl", items: soup("Tomato", "Tomato", "Tomato"), reward: 35, time: 90, finish: ["Salt", "Pepper", "Herbs"] },
  { id: "veg-soup", name: "Vegetable soup", vessel: "bowl", items: soup("Carrot", "Onion", "Potato"), reward: 40, time: 95, finish: ["Salt", "Pepper", "Herbs"] },
  { id: "mushroom-soup", name: "Mushroom soup", vessel: "bowl", items: soup("Mushroom", "Mushroom", "Onion"), reward: 40, time: 95, finish: ["Salt", "Butter", "Herbs"] },
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
    blurb: "Printed tickets only. Take cold food from the fridges and season each dish the way the ticket asks.",
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
    blurb: "Steak and fish all night. Season at the spice racks, and listen for the sizzle to whistle: that's a perfect cook.",
    recipes: ["grilled-fish", "steak-fries", "steak-onions", "steak-salad", "soy-fish"],
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
    recipes: ["breakfast", "mushroom-soup", "fish-chips", "stir-fry", "steak-onions"],
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
    return `soup of ${parts.join(" + ")}${finishedWith(recipe.finish)}`;
  }
  const parts = recipe.items.map((i) => {
    const how = i.season?.length ? ` (${spiceList(i.season)} ${i.seasonAt === "after" ? "after cooking" : "before cooking"})` : "";
    return describeFood(i.kind, i.state) + how;
  });
  return parts.join(" + ") + finishedWith(recipe.finish);
}

/** ", finished with lemon and fresh herbs" (or nothing) */
export function finishedWith(finish: readonly string[] | undefined): string {
  return finish?.length ? `, finished with ${spiceList(finish)}` : "";
}

/** Every seasoning a recipe uses, in order. */
export function recipeSpices(recipe: Recipe): Spice[] {
  return [...new Set([...recipe.items.flatMap((i) => i.season ?? []), ...(recipe.finish ?? [])])];
}

/** ", with salt and black pepper" (or nothing) */
export function seasonedWith(season: readonly string[] | undefined): string {
  return season?.length ? `, with ${spiceList(season)}` : "";
}
