// Icons and contextual prompts for the HUD: what's in your hands, and what your keys would do
// right now ("[Space] Add to pot 2/3", "[F] Chop"). Read-only: it never changes the game.
import {
  FOOD_RULES,
  MAX_PLATE_ITEMS,
  SOUP_INGREDIENTS,
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
} from "@kitchen/shared";
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

export function stationIconNode(s: Station): Element {
  if (s.kind === "crate") return img(s.crate!);
  const name = STATION_IMG[s.kind];
  return name ? img(name) : glyph(STATION_GLYPH[s.kind] ?? "counter");
}

export interface Prompt {
  key?: string;
  text: string;
}

const article = (s: string) => (/^[aeiou]/i.test(s) ? `an ${s}` : `a ${s}`);

/** What Space (use) and F (chop) would do for this chef right now. */
export function actionHints(g: Game, me: Chef): Prompt[] {
  if (g.phase !== "playing") return [];
  const held = me.held;
  const st = targetStation(g, me);
  if (!st) {
    const mate = chefInFront(g, me);
    if (mate && held?.type === "food" && mate.held?.type === "plate") return [{ key: "Space", text: `Put on ${mate.name.split(" (")[0]}'s plate` }];
    if (mate && held && !mate.held) return [{ key: "Space", text: `Hand to ${mate.name.split(" (")[0]}` }];
    if (mate) return [{ key: "H", text: `Take ${mate.name.split(" (")[0]}'s hand` }];
    return [];
  }
  const use = (text: string): Prompt => ({ key: "Space", text });
  switch (st.kind) {
    case "crate":
      if (!held) return [use(`Take ${article(st.crate!.toLowerCase())}`)];
      if (held.type === "food" && held.state === "raw" && held.kind === st.crate) return [use("Put it back")];
      if (held.type === "plate") return [held.contents.length < MAX_PLATE_ITEMS ? use(`Add ${article(st.crate!.toLowerCase())} to the plate`) : { text: "Plate is full" }];
      return [{ text: "Hands full" }];
    case "plates":
    case "bowls": {
      const thing = st.kind === "plates" ? "plate" : "bowl";
      if (!held) return [use(`Take a ${thing}`)];
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
      return [{ text: held?.type === "food" ? "Plate it first" : "Bring a finished dish" }];
    case "sink":
      return [];
    case "pot": {
      const pot = st.pot!;
      if (pot.state === "burnt") return held ? [{ text: "Burnt! Empty hands to scrape" }] : [use("Scrape out the burnt soup")];
      if (held?.type === "food" && pot.state === "filling") {
        if (!SOUP_INGREDIENTS.includes(held.kind)) return [{ text: "Not a soup vegetable" }];
        if (held.state !== "chopped") return [{ text: "Chop it first" }];
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
      prompts.push(plate.contents.length < MAX_PLATE_ITEMS ? use("Add to the plate") : { text: "Plate is full" });
    }
    else prompts.push({ text: `${stationName(st)} is taken` });
  }
  return prompts;
}
