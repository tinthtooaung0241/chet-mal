// Pure game data: recipes, timings, levels. No rendering or networking.
import { describeFood, type FoodState } from "./ingredients";
export * from "./ingredients";

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
// Cold food out of the fridge: a warning, then it goes off (like real food safety, sped up).
export const COLD_WARN = 35;
export const COLD_LIMIT = 50;

// Seasoning from the spice racks (keys 1-8 at a rack): the short things on the front row (1-4),
// the tall bottles on the raised back step (5-8), each row left to right.
export const SPICES = ["Salt", "Butter", "Lemon", "Herbs", "Pepper", "OliveOil", "Soy", "Vinegar"] as const;
/** The Burmese kitchen's rack: toppings and seasonings for noodles, salads and curry. */
export const BURMESE_SPICES = ["Salt", "Lime", "Peanuts", "Coriander", "Chili", "GarlicOil", "FishSauce", "Turmeric"] as const;
export type Spice = (typeof SPICES)[number] | (typeof BURMESE_SPICES)[number];
export const SPICE_NAMES: Record<Spice, string> = {
  Lime: "lime",
  Peanuts: "crushed peanuts",
  Coriander: "coriander",
  Chili: "chili flakes",
  GarlicOil: "crispy garlic oil",
  FishSauce: "fish sauce",
  Turmeric: "turmeric",
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

// --- the business: money and equipment upgrades ----------------------------------------

/** How customers pay at the till (keys 1 and 2 there). */
export const PAYMENTS = ["Cash", "Card"] as const;
export type Payment = (typeof PAYMENTS)[number];
/** seconds a customer waits at the till before leaving without paying */
export const PAY_WAIT = 30;

export interface Upgrade {
  id: string;
  name: string;
  /** what it does, in a few words */
  blurb: string;
  cost: number;
}

/** Equipment bought with the restaurant's takings; it's in place from the next shift. */
export const UPGRADES: Upgrade[] = [
  { id: "knives", name: "Sharp knives", blurb: "Chopping is a third faster.", cost: 60 },
  { id: "fridge", name: "Better fridge seals", blurb: "Cold food stays good twice as long out of the fridge.", cost: 70 },
  { id: "pans", name: "Heavy copper pans", blurb: "Cooked food takes half as long again to burn.", cost: 90 },
  { id: "tipjar", name: "Tip jar", blurb: "Customers leave a fifth more at the till.", cost: 80 },
  { id: "sign", name: "Neon sign", blurb: "Customers wait a quarter longer for their food.", cost: 120 },
];

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

  // --- the Burmese restaurant ---
  // mohinga: fish and onion simmered with rice noodles, finished with lime, chili and coriander
  {
    id: "mohinga",
    name: "Mohinga",
    vessel: "bowl",
    items: [item("Fish", "chopped"), item("Onion", "chopped"), item("Noodles", "raw")],
    reward: 45,
    time: 100,
    finish: ["FishSauce", "Lime", "Coriander"],
  },
  // lahpet thoke: tea leaf salad, the crunch and garlic oil go on last
  {
    id: "lahpet",
    name: "Tea leaf salad",
    vessel: "plate",
    items: [item("TeaLeaf", "raw"), item("Cabbage", "chopped"), item("Tomato", "chopped")],
    reward: 35,
    time: 80,
    finish: ["Peanuts", "GarlicOil", "Lime"],
  },
  // shan noodles: noodles from the pan with chicken, peanuts on top
  { id: "shan-noodles", name: "Shan noodles", vessel: "plate", items: [item("Noodles", "cooked"), pre("Chicken", "Turmeric")], reward: 40, time: 90, finish: ["Peanuts", "Coriander"] },
  // a homely chicken curry with rice: turmeric on the chicken before it cooks
  { id: "chicken-curry", name: "Chicken curry & rice", vessel: "plate", items: [pre("Chicken", "Turmeric", "Chili"), item("Rice", "cooked"), item("Onion", "cooked")], reward: 45, time: 100, finish: ["Coriander"] },
  // htamin kyaw: fried rice with egg, a tea-shop favourite
  { id: "fried-rice", name: "Burmese fried rice", vessel: "plate", items: [item("Rice", "cooked"), post("Egg", "Salt"), item("Onion", "cooked")], reward: 40, time: 90, finish: ["FishSauce"] },
];

export const recipeById = (id: string): Recipe => {
  const recipe = RECIPES.find((r) => r.id === id);
  if (!recipe) throw new Error(`Unknown recipe ${id}`);
  return recipe;
};

// --- restaurants -------------------------------------------------------------------

export type VenueId = "street" | "burmese";

export interface Venue {
  id: VenueId;
  name: string;
  /** a word or two for tight spaces (the HUD) */
  short: string;
  blurb: string;
  /** total sales (all the money ever taken at the till) needed to open it */
  unlockSales: number;
  /** the 3D room it's in (a GLB under assets/kitchen/environment) */
  room: string;
}

/** The restaurants, in the order they open as the business grows. */
export const VENUES: Venue[] = [
  { id: "street", name: "Street food stand", short: "Street stand", blurb: "Where it all starts: toasties, grills, soups and fries.", unlockSales: 0, room: "Kitchen_Room" },
  {
    id: "burmese",
    name: "Burmese restaurant",
    short: "Burmese",
    blurb: "A tea-shop kitchen in Yangon: mohinga, tea leaf salad, shan noodles and curry.",
    unlockSales: 500,
    room: "Kitchen_Myanmar",
  },
];

export const venueById = (id: VenueId): Venue => VENUES.find((v) => v.id === id) ?? VENUES[0];

// --- levels -------------------------------------------------------------------------

/** Tickets are printed (seen); phone orders are spoken once (heard). */
export type OrderChannel = "ticket" | "phone";

/** Mid-shift chaos that flips who leads: in the dark everyone talks it through; a deaf chef doesn't mind the noise. */
export type KitchenEventKind = "blackout" | "storm";

export interface Level {
  n: number;
  /** which restaurant this shift is at */
  venue: VenueId;
  name: string;
  blurb: string;
  /** what this level introduces, shown on the briefing card before the shift */
  /** what a shift teaches: a short title, then a few icon-and-words lines (icon names from the client) */
  teach: { title: string; lines: { icon: string; text: string }[] };
  recipes: string[];
  channels: OrderChannel[];
  time: number;
  /** chance that produce from a crate has gone off */
  spoilChance: number;
  /** fridge food goes off if left out (introduced once the basics are learned) */
  coldFood: boolean;
  /** guided first shift: one order at a time, patient customers, a coach showing every step */
  tutorial?: boolean;
  /** most orders open at once (default MAX_ORDERS) */
  maxOrders?: number;
  /** how many times longer customers wait than usual */
  patience?: number;
  events: { at: number; kind: KitchenEventKind; duration: number }[];
  /** points for one, two and three stars */
  stars: [number, number, number];
}

const BURMESE = ["mohinga", "lahpet", "shan-noodles", "chicken-curry", "fried-rice"];
const ALL_RECIPES = RECIPES.map((r) => r.id).filter((id) => !BURMESE.includes(id));

// The tutorial kitchen: entered from the title screen, not part of the level list.
export const TUTORIAL: Level = {
  n: 0,
  venue: "street",
  name: "Tutorial kitchen",
  blurb: "A guided shift: the coach shows every step of a salad. No rush.",
  teach: {
    title: "Your first salad",
    lines: [
      { icon: "sparkle", text: "Follow the glowing station" },
      { icon: "knife", text: "Chop tomato and lettuce (hold F)" },
      { icon: "salt", text: "Season at the rack" },
      { icon: "bell", text: "Serve at the pass" },
    ],
  },
  recipes: ["salad"],
  channels: ["ticket"],
  time: 240,
  spoilChance: 0,
  coldFood: false,
  tutorial: true,
  maxOrders: 1,
  patience: 4,
  events: [],
  stars: [20, 45, 70],
};

// One new idea per level, so nobody has to learn the whole kitchen at once.
export const LEVELS: Level[] = [
  {
    n: 1,
    venue: "street",
    name: "Opening day",
    blurb: "The stove opens. Season the fish and the bread before they cook.",
    teach: {
      title: "The stove",
      lines: [
        { icon: "flame", text: "Take food off before it burns" },
        { icon: "salt", text: "Some seasoning goes on first" },
        { icon: "ticket", text: "Spices before the flame go first" },
      ],
    },
    recipes: ["salad", "grilled-fish", "cheese-toastie"],
    channels: ["ticket"],
    time: 170,
    spoilChance: 0,
    coldFood: false,
    maxOrders: 3,
    patience: 1.5,
    events: [],
    stars: [40, 85, 130],
  },
  {
    n: 2,
    venue: "street",
    name: "The grill",
    blurb: "Steaks all night. Salt and pepper before, salt the fries after, and listen for the perfect sizzle.",
    teach: {
      title: "The perfect sizzle",
      lines: [
        { icon: "salt", text: "Spices after the flame go on last" },
        { icon: "sparkle", text: "Whistling? Take it off for a bonus" },
      ],
    },
    recipes: ["grilled-fish", "steak-fries", "steak-onions", "steak-salad", "soy-fish"],
    channels: ["ticket"],
    time: 180,
    spoilChance: 0,
    coldFood: false,
    events: [],
    stars: [60, 120, 180],
  },
  {
    n: 3,
    venue: "street",
    name: "Soup's on",
    blurb: "Three chopped vegetables in the pot, ladle into a bowl. The phone starts ringing too.",
    teach: {
      title: "Soup and phone orders",
      lines: [
        { icon: "knife", text: "Pot: three chopped vegetables" },
        { icon: "phone", text: "Phone orders are heard once. Tell your team!" },
      ],
    },
    recipes: ["tomato-soup", "veg-soup", "salad", "cheese-toastie"],
    channels: ["ticket", "phone"],
    time: 180,
    spoilChance: 0,
    coldFood: false,
    events: [],
    stars: [60, 120, 175],
  },
  {
    n: 4,
    venue: "street",
    name: "Breakfast rush",
    blurb: "Busy mornings. Cold food now goes off if it sits out of the fridge too long.",
    teach: {
      title: "Keep food cold",
      lines: [
        { icon: "snow", text: "Fridge food warms up outside" },
        { icon: "bin", text: "Left too long, it goes off" },
      ],
    },
    recipes: ["breakfast", "mushroom-soup", "fish-chips", "stir-fry", "steak-onions"],
    channels: ["ticket", "phone"],
    time: 190,
    spoilChance: 0,
    coldFood: true,
    events: [],
    stars: [60, 125, 185],
  },
  {
    n: 5,
    venue: "street",
    name: "Bad batch",
    blurb: "Some produce has gone off. Spot the mould, or sniff it (Z). Never serve it!",
    teach: {
      title: "Spoiled food",
      lines: [
        { icon: "smell", text: "Sniff it with Z" },
        { icon: "sick", text: "Mouldy food makes customers sick" },
      ],
    },
    recipes: ALL_RECIPES,
    channels: ["ticket", "phone"],
    time: 190,
    spoilChance: 0.25,
    coldFood: true,
    events: [],
    stars: [55, 115, 170],
  },
  {
    n: 6,
    venue: "street",
    name: "Storm night",
    blurb: "The power cuts out, then a storm drowns every sound. Talk each other through the dark; follow the deaf chef in the storm.",
    teach: {
      title: "Blackouts and storms",
      lines: [
        { icon: "moon", text: "Dark? Say where you are" },
        { icon: "storm", text: "Storm? Watch the deaf chef" },
      ],
    },
    recipes: ALL_RECIPES,
    channels: ["ticket", "phone"],
    time: 210,
    spoilChance: 0.15,
    coldFood: true,
    events: [
      { at: 55, kind: "blackout", duration: 22 },
      { at: 135, kind: "storm", duration: 22 },
    ],
    stars: [55, 115, 170],
  },

  // --- the Burmese restaurant (opens once the street stand has sold enough) ---
  {
    n: 7,
    venue: "burmese",
    name: "Tea shop morning",
    blurb: "Yangon wakes up hungry. Tea leaf salad and shan noodles, crunchy toppings last.",
    teach: {
      title: "A Burmese kitchen",
      lines: [
        { icon: "crate", text: "New ingredients on the shelves" },
        { icon: "chili", text: "New toppings on the rack" },
        { icon: "book", text: "Press R for new recipes" },
      ],
    },
    recipes: ["lahpet", "shan-noodles"],
    channels: ["ticket"],
    time: 180,
    spoilChance: 0,
    coldFood: false,
    maxOrders: 3,
    patience: 1.4,
    events: [],
    stars: [45, 95, 145],
  },
  {
    n: 8,
    venue: "burmese",
    name: "Mohinga Monday",
    blurb: "The breakfast soup. Fish, onion and rice noodles go in the pot; the phone rings too.",
    teach: {
      title: "Mohinga",
      lines: [
        { icon: "knife", text: "Pot: chopped fish, onion and noodles" },
        { icon: "fishsauce", text: "Finish: fish sauce, lime, coriander" },
      ],
    },
    recipes: ["mohinga", "lahpet", "shan-noodles"],
    channels: ["ticket", "phone"],
    time: 190,
    spoilChance: 0,
    coldFood: false,
    events: [],
    stars: [55, 115, 170],
  },
  {
    n: 9,
    venue: "burmese",
    name: "Curry house",
    blurb: "Chicken curry and fried rice for the lunch crowd. Keep the chicken cold!",
    teach: {
      title: "Rice and curry",
      lines: [
        { icon: "flame", text: "Rice and noodles cook in the pan" },
        { icon: "snow", text: "Use chicken soon" },
      ],
    },
    recipes: ["chicken-curry", "fried-rice", "mohinga", "shan-noodles"],
    channels: ["ticket", "phone"],
    time: 200,
    spoilChance: 0,
    coldFood: true,
    events: [],
    stars: [60, 125, 185],
  },
  {
    n: 10,
    venue: "burmese",
    name: "Thingyan festival",
    blurb: "The water festival! Full house, a power cut, and a storm of drums. The big night.",
    teach: {
      title: "The big night",
      lines: [
        { icon: "star", text: "The whole menu, all at once" },
        { icon: "moon", text: "Dark? Talk it through" },
        { icon: "storm", text: "Loud? Watch the deaf chef" },
      ],
    },
    recipes: BURMESE,
    channels: ["ticket", "phone"],
    time: 220,
    spoilChance: 0.1,
    coldFood: true,
    events: [
      { at: 60, kind: "blackout", duration: 20 },
      { at: 145, kind: "storm", duration: 20 },
    ],
    stars: [60, 125, 190],
  },
];

/** A restaurant's shifts, in order; the last is its big night. */
export const levelsAt = (venue: VenueId): Level[] => LEVELS.filter((l) => l.venue === venue);

export const levelByNumber = (n: number): Level => (n === TUTORIAL.n ? TUTORIAL : (LEVELS.find((l) => l.n === n) ?? LEVELS[0]));

export function starsFor(level: Level, score: number): number {
  return level.stars.filter((s) => score >= s).length;
}

/** "tomato soup" when all three are the same, otherwise "vegetable soup" / "mushroom soup". */
export function soupName(kinds: string[]): string {
  const unique = [...new Set(kinds)];
  const recipe = RECIPES.find(
    (r) => r.vessel === "bowl" && r.items.map((i) => i.kind).sort().join() === [...kinds].sort().join(),
  );
  if (recipe) return recipe.name.toLowerCase();
  return unique.length === 1 ? `${unique[0].toLowerCase()} soup` : "mixed soup";
}

export function describeRecipe(recipe: Recipe): string {
  if (recipe.vessel === "bowl") {
    const counts = new Map<string, number>();
    for (const i of recipe.items) counts.set(i.kind, (counts.get(i.kind) ?? 0) + 1);
    const parts = [...counts].map(([k, n]) => `${n > 1 ? `${n} ` : ""}${describeFood(k, recipe.items.find((i) => i.kind === k)!.state)}`);
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
