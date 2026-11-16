// Burmese (မြန်မာ) words for everything in the kitchen. Food in every state, dishes, spices and
// stations are generated from the game's own data, so a new ingredient only needs its Burmese name
// added here. The style rules and the reasons behind each word are in docs/BURMESE.md.
import {
  INGREDIENTS,
  RECIPES,
  SPICE_NAMES,
  describeFood,
  displayKind,
  legend,
  type FoodState,
} from "@kitchen/shared";

// --- food --------------------------------------------------------------------------------

/** Each ingredient as a cook says it, whole. */
export const FOOD: Record<string, string> = {
  Tomato: "ခရမ်းချဉ်သီး",
  Lettuce: "ဆလတ်ရွက်",
  Potato: "အာလူး",
  Steak: "အမဲသား",
  Fish: "ငါး",
  Egg: "ကြက်ဥ",
  Bread: "ပေါင်မုန့်",
  Cheese: "ဒိန်ခဲ",
  Onion: "ကြက်သွန်နီ",
  Mushroom: "မှို",
  Carrot: "မုန်လာဥနီ",
  Chicken: "ကြက်သား",
  Cabbage: "ဂေါ်ဖီထုပ်",
  TeaLeaf: "လက်ဖက်",
  Noodles: "ဆန်ခေါက်ဆွဲ",
  Rice: "ဆန်",
};

/**
 * Prepared food, the way Burmese recipes name it: a noun with the cut or the cooking after it
 * ("ကြက်သွန်နီလှီး" sliced onion, "ငါးတုံး" fish pieces, "ပေါင်မုန့်ကင်" toast). Anything not
 * listed uses the general forms in foodName().
 */
const PREPARED: Partial<Record<string, Partial<Record<FoodState, string>>>> = {
  Potato: { chopped: "အာလူးချောင်း", cooked: "အာလူးချောင်းကြော်" },
  Onion: { cooked: "ကြက်သွန်နီကြော်" },
  Bread: { chopped: "ပေါင်မုန့်ချပ်", cooked: "ပေါင်မုန့်ကင်" },
  Noodles: { cooked: "ခေါက်ဆွဲပြုတ်" },
  Rice: { cooked: "ထမင်း" },
  Cheese: { chopped: "ဒိန်ခဲချပ်" },
  Mushroom: { cooked: "မှိုကြော်" },
  Steak: { cooked: "အမဲသားကင်" },
  Fish: { chopped: "ငါးတုံး" },
  Egg: { cooked: "ကြက်ဥကြော်" },
  Chicken: { chopped: "ကြက်သားတုံး" },
};

/** A food in a state: raw is just its name; chopped is "<name>လှီး"; cooked and burnt describe it. */
export function foodName(kind: string, state: FoodState): string {
  const base = FOOD[kind] ?? kind;
  const own = PREPARED[kind]?.[state];
  if (own) return own;
  if (state === "raw") return base;
  if (state === "chopped") return `${base}လှီး`;
  if (state === "cooked") return `ကျက်ပြီးသား ${base}`;
  return `တူးသွားတဲ့ ${base}`;
}

// --- seasonings ----------------------------------------------------------------------------

export const SPICE: Record<string, string> = {
  salt: "ဆား",
  "black pepper": "ငရုတ်ကောင်း",
  "olive oil": "သံလွင်ဆီ",
  butter: "ထောပတ်",
  lemon: "လီမွန်သီး",
  "fresh herbs": "အမွှေးရွက်",
  "soy sauce": "ပဲငံပြာရည်",
  "malt vinegar": "ရှာလကာရည်",
  lime: "သံပုရာသီး",
  "crushed peanuts": "မြေပဲထောင်း",
  coriander: "နံနံပင်",
  "chili flakes": "ငရုတ်သီးမှုန့်",
  "crispy garlic oil": "ကြက်သွန်ဖြူကြော်ဆီ",
  "fish sauce": "ငံပြာရည်",
  turmeric: "နနွင်း",
};

// --- dishes --------------------------------------------------------------------------------

/** Menu names: Burmese dishes by their own names, the others the way a Yangon menu writes them. */
export const DISH: Record<string, string> = {
  Salad: "ဆလတ်သုပ်",
  "Fried mushrooms": "မှိုကြော်",
  "Grilled fish": "ငါးကင်",
  "Cheese toastie": "ဒိန်ခဲ ပေါင်မုန့်ကင်",
  "Steak & fries": "အမဲသားကင်နဲ့ အာလူးချောင်းကြော်",
  "Steak & onions": "အမဲသားကင်နဲ့ ကြက်သွန်နီကြော်",
  "Steak salad": "အမဲသားသုပ်",
  "Fish & chips": "ငါးကြော်နဲ့ အာလူးချောင်းကြော်",
  "Full breakfast": "မနက်စာ အပြည့်အစုံ",
  "Soy-glazed fish": "ပဲငံပြာရည် ငါးကြော်",
  "Mushroom stir-fry": "မှိုနဲ့ ကြက်သွန် ကြော်",
  "Tomato soup": "ခရမ်းချဉ်သီး စွပ်ပြုတ်",
  "Vegetable soup": "ဟင်းသီးဟင်းရွက် စွပ်ပြုတ်",
  "Mushroom soup": "မှို စွပ်ပြုတ်",
  Mohinga: "မုန့်ဟင်းခါး",
  "Tea leaf salad": "လက်ဖက်သုပ်",
  "Shan noodles": "ရှမ်းခေါက်ဆွဲ",
  "Chicken curry & rice": "ကြက်သားဟင်းနဲ့ ထမင်း",
  "Burmese fried rice": "မြန်မာ ထမင်းကြော်",
};

// --- the kitchen ---------------------------------------------------------------------------

export const STATION: Record<string, string> = {
  counter: "ကောင်တာ",
  "cutting board": "စဉ်းတီတုံး",
  board: "စဉ်းတီတုံး",
  stove: "မီးဖို",
  pan: "ဒယ်အိုး",
  "soup pot": "စွပ်ပြုတ်အိုး",
  pot: "စွပ်ပြုတ်အိုး",
  "plate rack": "ပန်းကန်ပြားစင်",
  "plate cart": "ပန်းကန်ပြားစင်",
  "bowl rack": "ပန်းကန်လုံးစင်",
  pass: "ဟင်းထုတ်ကောင်တာ",
  bin: "အမှိုက်ပုံး",
  sink: "ဘေစင်",
  fridge: "ရေခဲသေတ္တာ",
  pantry: "စင်",
  shelf: "စင်",
  store: "စတိုစင်",
  "spice rack": "ဟင်းခတ်စင်",
  "topping rack": "အဆာပလာစင်",
  till: "ငွေရှင်းကောင်တာ",
  "dirty dish counter": "ပန်းကန်ညစ်ကောင်တာ",
  "meat and fish fridge": "အသားငါး ရေခဲသေတ္တာ",
  "dairy and greens fridge": "ဒိန်ခဲနဲ့ အရွက် ရေခဲသေတ္တာ",
  "greens and tea leaf fridge": "အရွက်နဲ့ လက်ဖက် ရေခဲသေတ္တာ",
  "root vegetable shelf": "ဥမျိုး စင်",
  "bread and tomato shelf": "ပေါင်မုန့်နဲ့ ခရမ်းချဉ်သီး စင်",
  "noodle and rice shelf": "ခေါက်ဆွဲနဲ့ ဆန် စင်",
  "tomato and onion shelf": "ခရမ်းချဉ်နဲ့ ကြက်သွန် စင်",
  terrace: "ဆိုင်ရှေ့ စားပွဲ",
  kitchen: "မီးဖိုချောင်",
};

/** Things you can hold or find on a counter that aren't food. */
const THINGS: Record<string, string> = {
  plate: "ပန်းကန်ပြား",
  plates: "ပန်းကန်ပြား",
  bowl: "ပန်းကန်လုံး",
  bowls: "ပန်းကန်လုံး",
  "empty plate": "ပန်းကန်ပြား အလွတ်",
  "empty bowl": "ပန်းကန်လုံး အလွတ်",
  "dirty plate": "ပန်းကန်ပြားညစ်",
  "dirty bowl": "ပန်းကန်လုံးညစ်",
  "dirty dish": "ပန်းကန်ညစ်",
  "dirty dishes": "ပန်းကန်ညစ်",
  dish: "ဟင်းပွဲ",
  dishes: "ဟင်းပွဲ",
  food: "အစားအစာ",
  "some food": "အစားအစာ",
  "a dish": "ဟင်းပွဲ",
  spice: "ဟင်းခတ်",
  bottle: "ပုလင်း",
  soup: "စွပ်ပြုတ်",
  "burnt soup": "တူးသွားတဲ့ စွပ်ပြုတ်",
  "mixed soup": "ရောစပ် စွပ်ပြုတ်",
  "nothing yet": "ဘာမှ မထည့်ရသေး",
  nothing: "ဘာမှမရှိ",
  vegetables: "ဟင်းသီးဟင်းရွက်",
  "chopped vegetables": "ဟင်းသီးဟင်းရွက်လှီး",
  veg: "ဟင်းသီးဟင်းရွက်",
  "chopped veg": "ဟင်းသီးဟင်းရွက်လှီး",
  "booster seat": "ကလေးထိုင်ခုံ",
  tray: "ဗန်း",
  everything: "အားလုံး",
  "ingredients": "ဟင်းချက်ပစ္စည်း",
  ingredient: "ဟင်းချက်ပစ္စည်း",
  coins: "ဒင်္ဂါး",
  points: "အမှတ်",
  cash: "ငွေသား",
  card: "ကတ်",
};

// --- the crew ------------------------------------------------------------------------------

export const ROLE_NAME: Record<string, string> = {
  "all senses (solo)": "အာရုံအားလုံး (တစ်ယောက်တည်း)",
  "head chef": "စားဖိုမှူးချုပ်",
  "deaf chef": "နားမကြားတဲ့ စားဖိုမှူး",
  "mute chef": "စကားမပြောနိုင်တဲ့ စားဖိုမှူး",
  cook: "စားဖိုမှူး",
  cooks: "စားဖိုမှူးတွေ",
  chef: "စားဖိုမှူး",
  chefs: "စားဖိုမှူးတွေ",
};

// --- all of it, keyed by the English the game writes ---------------------------------------

/** Every term, lower-case English → Burmese. */
export function buildTerms(): Map<string, string> {
  const terms = new Map<string, string>();
  const add = (en: string, my: string) => terms.set(en.toLowerCase(), my);
  const states: FoodState[] = ["raw", "chopped", "cooked", "burnt"];
  for (const kind of Object.keys(INGREDIENTS)) {
    const word = displayKind(kind).toLowerCase(); // "tea leaf"
    add(kind, FOOD[kind] ?? kind);
    add(word, FOOD[kind] ?? kind);
    // the game's own names ("fries", "sliced bread") and the plain ones ("cooked potato")
    for (const state of states) {
      add(describeFood(kind, state), foodName(kind, state));
      add(`${state} ${word}`, foodName(kind, state));
    }
    // a raw one, as the coach says it: "a raw steak"
    add(`raw ${word}`, foodName(kind, "raw"));
  }
  // plurals the recipe book uses ("3 tomatoes" is handled as a count; these are the bare words)
  add("tomatoes", FOOD.Tomato);
  add("potatoes", FOOD.Potato);
  add("mushrooms", FOOD.Mushroom);
  add("onions", FOOD.Onion);
  add("carrots", FOOD.Carrot);
  for (const [key, name] of Object.entries(SPICE_NAMES)) {
    const my = SPICE[name] ?? name;
    add(name, my);
    add(key, my);
  }
  for (const [en, my] of Object.entries(SPICE)) add(en, my);
  add("pepper", SPICE["black pepper"]);
  add("herbs", SPICE["fresh herbs"]);
  add("soy", SPICE["soy sauce"]);
  add("vinegar", SPICE["malt vinegar"]);
  add("peanuts", SPICE["crushed peanuts"]);
  add("chili", SPICE["chili flakes"]);
  add("garlic oil", SPICE["crispy garlic oil"]);
  for (const recipe of RECIPES) {
    const my = DISH[recipe.name] ?? recipe.name;
    add(recipe.name, my);
  }
  // soups the pot can make that aren't on a menu: "carrot soup", "mixed soup"
  for (const kind of Object.keys(INGREDIENTS)) add(`${kind.toLowerCase()} soup`, `${FOOD[kind] ?? kind} စွပ်ပြုတ်`);
  for (const [en, my] of Object.entries(STATION)) add(en, my);
  for (const kind of Object.keys(INGREDIENTS)) {
    const word = FOOD[kind] ?? kind;
    add(`${kind.toLowerCase()} crate`, `${word}ခြင်း`);
    add(`${kind.toLowerCase()} fridge`, `${word} ရေခဲသေတ္တာ`);
  }
  for (const [en, my] of Object.entries(THINGS)) add(en, my);
  for (const [en, my] of Object.entries(ROLE_NAME)) add(en, my);
  // the station labels in each kitchen must all be here (a quick check while building)
  for (const ch of "FGAHRQS") {
    for (const venue of ["street", "burmese"] as const) {
      const label = legend(ch, venue)?.label;
      if (label && !terms.has(label.toLowerCase())) console.warn(`Burmese: no word for the station "${label}"`);
    }
  }
  return terms;
}
