// Icons and contextual prompts for the HUD: what's in your hands, and what your keys would do
// right now ("[Space] Add to pot 2/3", "[F] Chop"). Read-only: it never changes the game.
import {
  boosterWanted,
  seatsKids,
  FOOD_RULES,
  MAX_PLATE_ITEMS,
  SPICE_NAMES,
  pickedItem,
  payingDiners,
  type Spice,
  potState,
  SOUP_SIZE,
  SOUP_TIME,
  chefInFront,
  describeItem,
  soupName,
  stationName,
  targetStation,
  type Chef,
  type Game,
  type Item,
  type FoodState,
  type Station,
  ROLES,
  spillUnder,
} from "@kitchen/shared";
import { pref } from "../prefs";
import { glyph, img, renderedIcon } from "../ui/icons";

const STATE_SUFFIXES: Record<FoodState, string[]> = {
  raw: [""],
  chopped: ["_Chopped", "_Sliced"],
  cooked: ["_Cooked", "_Fries", "_Fried", "_Toasted"],
  burnt: ["_Burnt"],
};

/** Name of the rendered icon for a food in a given state (falls back sensibly). */
export function foodIcon(kind: string, state: FoodState): string {
  for (const suffix of STATE_SUFFIXES[state]) if (renderedIcon(kind + suffix)) return kind + suffix;
  return state === "burnt" ? foodIcon(kind, "cooked") : kind;
}

export function soupIcon(kinds: string[]): string {
  if (kinds.includes("Coconut")) return "Soup_OhnNo";
  if (kinds.includes("Noodles")) return "Soup_Mohinga";
  if (kinds.every((k) => k === "Tomato")) return "Soup_Tomato";
  if (kinds.filter((k) => k === "Mushroom").length >= 2) return "Soup_Mushroom";
  return "Soup_Veg";
}

/** Icon for what a chef holds: the food itself, a plate with its food, a bowl of soup, or an open hand. */
export function itemIconNode(item: Item | null): HTMLElement {
  const box = document.createElement("span");
  box.className = "item-icon";
  if (!item) box.append(glyph("hand"));
  else if (item.type === "food") box.append(img(foodIcon(item.kind, item.state)));
  else if (item.type === "bowl") box.append(img(item.soup ? soupIcon(item.soup) : "Bowl"));
  else {
    box.append(img("Plate"));
    for (const f of item.contents.slice(0, 3)) {
      const food = img(foodIcon(f.kind, f.state));
      food.classList.add("on-plate");
      box.append(food);
    }
    box.dataset.count = String(item.contents.length);
  }
  return box;
}

const STATION_IMG: Partial<Record<Station["kind"], string>> = {
  board: "CuttingBoard",
  stove: "FryingPan",
  pot: "Pot",
  plates: "Plate",
  bowls: "Bowl",
  trash: "TrashBin",
};
const STATION_GLYPH: Partial<Record<Station["kind"], string>> = { serve: "bell", sink: "sink", counter: "counter" };
export const SPICE_GLYPHS: Record<string, string> = {
  Salt: "salt",
  Pepper: "pepper",
  OliveOil: "oil",
  Butter: "butter",
  Lemon: "lemon",
  Herbs: "herbs",
  Soy: "soy",
  Vinegar: "vinegar",
  Lime: "lime",
  Peanuts: "peanuts",
  Coriander: "coriander",
  Chili: "chili",
  GarlicOil: "garlicoil",
  FishSauce: "fishsauce",
  Turmeric: "turmeric",
};

/** Icon for one thing in a fridge or spice rack. */
export function stockIconNode(st: Station, item: string): Element {
  if (st.kind === "register") return glyph(item === "Card" ? "card" : "cash");
  return st.kind === "spice" ? glyph(SPICE_GLYPHS[item] ?? "salt") : img(foodIcon(item, "raw"));
}

/** Its display name: "Steak", "Olive oil". */
export function stockName(st: Station, item: string): string {
  if (st.kind !== "spice") return item;
  const name = SPICE_NAMES[item as Spice] ?? item;
  return name[0].toUpperCase() + name.slice(1);
}

export function stationIconNode(s: Station): Element {
  if (s.kind === "crate") return img(s.crate!);
  if (s.kind === "spice") return glyph("salt");
  if (s.kind === "fridge") return glyph("fridge");
  if (s.kind === "register") return glyph("coin");
  if (s.kind === "pantry") return glyph("crate");
  const name = STATION_IMG[s.kind];
  return name ? img(name) : glyph(STATION_GLYPH[s.kind] ?? "counter");
}

export interface Prompt {
  key?: string;
  text: string;
}

const article = (s: string) => (/^[aeiou]/i.test(s) ? `an ${s}` : `a ${s}`);

/** With a spice bottle in hand: what Space would season, or swap or put back at a rack. */
function spiceHints(g: Game, me: Chef, st: Station | null): Prompt[] {
  const spice = me.spice!.spice;
  const name = SPICE_NAMES[spice];
  const use = (text: string): Prompt => ({ key: "Space", text });
  // seasoning with the meter on: hold to pour, let go in the band
  const pourIt = (text: string): Prompt => ({ key: "Space", text: pref("meter") === "on" ? `Hold: ${text[0].toLowerCase()}${text.slice(1)}` : text });
  if (!st) {
    const mate = chefInFront(g, me);
    const who = mate?.name.split(" (")[0];
    if (mate?.held) return [pourIt(`Season ${who}'s ${mate.held.type === "food" ? mate.held.kind.toLowerCase() : mate.held.type}: ${name}`)];
    if (mate && !mate.spice) return [use(`Hand the ${name} to ${who}`)];
    return [{ text: `Take the ${name} to some food or a dish` }];
  }
  if (st.kind === "spice") {
    const chosen = pickedItem(st, me) as Spice;
    return [use(chosen === spice ? `Put the ${name} back` : `Swap for the ${SPICE_NAMES[chosen]}`), { key: `1–${st.stock!.length}`, text: "choose" }];
  }
  const item = st.item;
  if (!item) return [{ text: "Nothing here to season" }];
  if (item.type === "food") {
    const kind = item.kind.toLowerCase();
    if (!ROLES[me.role].cooks) return [{ text: "Cooks season the ingredients" }];
    if (item.state === "burnt") return [{ text: "Too late, it's burnt" }];
    if ((item.season ?? []).some((x) => x.spice === spice)) return [{ text: `The ${kind} already has ${name}` }];
    return [pourIt(`Season the ${item.state} ${kind}: ${name}`)];
  }
  if (item.type === "plate" ? !item.contents.length : !item.soup) return [{ text: "Put the food in first" }];
  if (item.season.includes(spice)) return [{ text: `Already has ${name}` }];
  return [pourIt(`Add ${name}`)];
}

/** What Space (use) and F (chop) would do for this chef right now. */
export function actionHints(g: Game, me: Chef): Prompt[] {
  if (g.phase !== "playing") return [];
  const held = me.held;
  const st = targetStation(g, me);
  if (me.spice) return spiceHints(g, me, st);
  if (!st) {
    if (!held && spillUnder(g, me)) return [{ key: "F", text: "Hold to mop the spill" }];
    const mate = chefInFront(g, me);
    if (mate && held?.type === "food" && mate.held?.type === "plate") return [{ key: "Space", text: `Put on ${mate.name.split(" (")[0]}'s plate` }];
    if (mate && held && !mate.held) return [{ key: "Space", text: `Hand to ${mate.name.split(" (")[0]}` }];
    if (mate) return [{ key: "H", text: `Take ${mate.name.split(" (")[0]}'s hand` }];
    return [];
  }
  const use = (text: string): Prompt => ({ key: "Space", text });
  if (st.fire) return [{ key: "F", text: "Hold to smother the fire!" }];
  if (!held && spillUnder(g, me)) return [{ key: "F", text: "Hold to mop the spill" }];
  switch (st.kind) {
    case "crate":
      if (!held) return [use(`Take ${article(st.crate!.toLowerCase())}`)];
      if (held.type === "food" && held.state === "raw" && held.kind === st.crate) return [use(FOOD_RULES[st.crate!]?.cold ? "Back in the fridge" : "Put it back")];
      if (held.type === "plate") return [held.contents.length < MAX_PLATE_ITEMS ? use(`Add ${article(st.crate!.toLowerCase())} to the plate`) : { text: "Plate is full" }];
      return [{ text: "Hands full" }];
    case "plates":
    case "bowls": {
      const thing = st.kind === "plates" ? "plate" : "bowl";
      if (held && held.type !== "food" && held.dirty) return [{ text: "Dirty: wash it at the sink first" }];
      const clean = g.dishes ? (thing === "plate" ? g.dishes.plates : g.dishes.bowls) : null;
      if (clean === 0 && (!held || (thing === "plate" && held.type === "food"))) return [{ text: `No clean ${thing}s: wash some at the sink` }];
      if (!held) return [use(`Take a ${thing}${clean === null ? "" : ` (${clean} clean)`}`)];
      if (held.type === thing && (held.type === "plate" ? !held.contents.length : !held.soup)) return [use("Put it back")];
      if (thing === "plate" && held.type === "food") return [use("Plate it")];
      return [{ text: "Hands full" }];
    }
    case "trash":
      if (!held) return [];
      if (held.type === "plate") return held.contents.length ? [use("Empty the plate")] : [];
      if (held.type === "bowl") return held.soup ? [use("Pour it away")] : [];
      return [use("Bin it")];
    case "serve":
      if (held?.type === "plate" && held.contents.length) return [use("Serve!")];
      if (held?.type === "bowl" && held.soup) return [use("Serve!")];
      if (!held && boosterWanted(g)) return [seatsKids(g, me) ? use("Put out a booster seat") : { text: "The head chef hands out booster seats" }];
      if (ROLES[me.role].charms && g.orders.length) {
        return [{ text: held?.type === "food" ? "Plate it first" : "Bring a finished dish" }, g.charmWait > 0 ? { text: `Wave again in ${Math.ceil(g.charmWait)}s` } : { key: "B", text: "Wave: tables wait longer" }];
      }
      return [{ text: held?.type === "food" ? "Plate it first" : "Bring a finished dish" }];
    case "returns": {
      const pile = st.returns ? st.returns.plates + st.returns.bowls : 0;
      if (held && held.type !== "food" && held.dirty) return [use("Put it back on the pile")];
      if (held) return [{ text: "For dirty dishes" }];
      return pile ? [use(`Take a dirty dish (${pile} here)`)] : [{ text: "No dirty dishes yet" }];
    }
    case "sink": {
      if (held && held.type !== "food" && held.dirty) return [use(`Put the dirty ${held.type} in the sink`)];
      const dirty = g.dishes ? g.dishes.dirtyPlates + g.dishes.dirtyBowls : 0;
      if (!dirty) return [{ text: "Nothing to wash" }];
      return [held ? { text: "Empty hands to wash up" } : { key: "F", text: `Hold to wash (${dirty} dirty)` }];
    }
    case "register": {
      const payer = payingDiners(g)[0];
      if (!payer) return [{ key: "Space", text: "Upgrades shop" }];
      const choice = pickedItem(st, me);
      return [use(`Take ${payer.bill} coins by ${choice?.toLowerCase()}`), { key: "1–2", text: "cash / card" }];
    }
    case "spice": {
      // the bottle goes to the food: take one with free hands
      const name = SPICE_NAMES[pickedItem(st, me) as Spice];
      if (held) return [{ text: "Put it down, then bring the spice to it" }];
      return [use(`Take the ${name}`), { key: `1–${st.stock!.length}`, text: "choose" }];
    }
    case "fridge":
    case "pantry": {
      const choose = { key: `1–${st.stock!.length}`, text: "choose" };
      if (!held) return [use(`Take ${article(pickedItem(st, me)!.toLowerCase())}`), choose];
      if (held.type === "food" && st.stock!.includes(held.kind) && (held.state === "raw" || held.state === "chopped")) return [use(st.kind === "fridge" ? "Back in the fridge" : "Back on the shelf")];
      return [{ text: "Hands full" }];
    }
    case "pot": {
      const pot = st.pot!;
      if (pot.state === "burnt") return held ? [{ text: "Burnt! Empty hands to scrape" }] : [use("Scrape out the burnt soup")];
      if (held?.type === "food" && pot.state === "filling") {
        const needs = potState(held.kind);
        if (!needs) return [{ text: "Doesn't go in soup" }];
        if (held.state !== needs) return [{ text: held.state === "raw" ? "Chop it first" : "Not like that" }];
        return [use(`Add to pot (${pot.contents.length + 1}/${SOUP_SIZE})`)];
      }
      if (held?.type === "bowl" && !held.soup && pot.state === "done") return [use(`Ladle ${soupName(pot.contents.map((f) => f.kind))}`)];
      if (pot.state === "cooking") return [{ text: `Boiling… ${Math.ceil(SOUP_TIME - pot.cook)}s` }];
      if (pot.state === "done") return [{ text: "Soup's ready — bring a bowl" }];
      return [{ text: `Pot: ${pot.contents.length}/${SOUP_SIZE} chopped veg` }];
    }
  }

  // counters, boards and stoves hold one item
  const onTop = st.item;
  const prompts: Prompt[] = [];
  if (st.kind === "board" && !held && onTop?.type === "food" && onTop.state === "raw" && FOOD_RULES[onTop.kind]?.chop) {
    prompts.push({ key: "F", text: "Hold to chop" });
  }
  if (!held && onTop) prompts.push(use(st.kind === "stove" && onTop.type === "food" && onTop.state === "cooked" ? "Take it off — now!" : `Pick up ${describeItem(onTop)}`));
  else if (held && !onTop) {
    if (st.kind === "stove") {
      const rule = held.type === "food" ? FOOD_RULES[held.kind] : undefined;
      const cookable = held.type === "food" && !!rule?.cookFrom && (held.state === rule.cookFrom || held.state === "cooked");
      prompts.push(cookable ? use("Cook it") : { text: held.type === "food" && rule?.cookFrom === "chopped" && held.state === "raw" ? "Chop it first" : "Can't cook that" });
    } else if (st.kind === "board" && held.type !== "food") prompts.push({ text: "Plates go on a counter" });
    else prompts.push(use(st.kind === "board" ? "Put on the board" : "Put it down"));
  } else if (held && onTop) {
    const plate = held.type === "plate" ? held : onTop.type === "plate" ? onTop : null;
    if (plate && (held.type === "food" || onTop.type === "food")) {
      prompts.push(plate.dirty ? { text: "That plate's dirty" } : plate.contents.length < MAX_PLATE_ITEMS ? use("Add to the plate") : { text: "Plate is full" });
    }
    else if (ROLES[me.role].tray && !me.tray && held.type !== "food" && onTop.type !== "food") prompts.push(use("Put on your tray"));
    else prompts.push({ text: `${stationName(st)} is taken` });
  }
  return prompts;
}
