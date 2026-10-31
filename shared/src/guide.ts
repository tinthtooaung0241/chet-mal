// The kitchen coach: for one chef, which order they're working towards, a checklist of every step
// of that dish (done, still to do, or done wrong), the very next step in words, and the station to
// go to. Read-only. The HUD shows it as a checklist and, in the guided first shift, as a coach with
// a glowing station; the blind chef hears the next step with Q.
import { ROLES } from "./roles";
import { FOOD_RULES, levelByNumber, spiceList, type RecipeItem, type Spice } from "./rules";
import { describeItem, stationName, type Bowl, type Chef, type Food, type Game, type Order, type Plate, type Station } from "./state";

export interface CheckStep {
  text: string;
  done: boolean;
  /** done the wrong way (e.g. salted after cooking); can't be fixed on this ingredient */
  wrong?: boolean;
  /** the step to do now */
  current?: boolean;
}

export interface Guide {
  order: Order;
  steps: CheckStep[];
  /** the next thing to do, as one short instruction */
  next: string | null;
  /** where to go for it */
  target: Station | null;
  /** at a fridge, pantry or spice rack: the item to choose there (index into its stock) */
  pick: number | null;
}

const lower = (k: string) => k.toLowerCase();
const food = (kind: string, state: string) => (state === "raw" ? lower(kind) : `${state} ${lower(kind)}`);

/** Orders this chef could know about: tickets need sight, phone orders hearing. */
function knownOrders(g: Game, chef: Chef): Order[] {
  const { sees, hears } = ROLES[chef.role];
  return g.orders.filter((o) => (o.channel === "ticket" ? sees : hears)).sort((a, b) => a.timeLeft - b.timeLeft);
}

const needsChop = (it: RecipeItem) => it.state === "chopped" || (it.state === "cooked" && FOOD_RULES[it.kind]?.cookFrom === "chopped");

function nearest(g: Game, chef: Chef, ok: (s: Station) => boolean): Station | null {
  let best: Station | null = null;
  let dist = Infinity;
  for (const s of g.stations) {
    if (!ok(s)) continue;
    const d = Math.hypot(s.x - chef.x, s.z - chef.z);
    if (d < dist) {
      dist = d;
      best = s;
    }
  }
  return best;
}

const storeFor = (g: Game, chef: Chef, kind: string) => nearest(g, chef, (s) => !!s.stock?.includes(kind) && s.kind !== "spice");
const spiceRack = (g: Game, chef: Chef) => nearest(g, chef, (s) => s.kind === "spice");
const freeOf = (g: Game, chef: Chef, kind: Station["kind"]) => nearest(g, chef, (s) => s.kind === kind && !s.item) ?? nearest(g, chef, (s) => s.kind === kind);

/** The steps one ingredient goes through for this recipe item, ticked against the real food. */
function foodSteps(it: RecipeItem, f: Food | null): CheckStep[] {
  const steps: CheckStep[] = [{ text: `Take ${lower(it.kind)}`, done: !!f }];
  const season = f?.season ?? [];
  const has = (sp: Spice, at?: string) => season.some((x) => x.spice === sp && (!at || x.at === at));
  if (needsChop(it)) steps.push({ text: "Chop it", done: !!f && f.state !== "raw" });
  if (it.season?.length && it.seasonAt === "before") {
    for (const sp of it.season) steps.push({ text: `Season: ${spiceList([sp])}`, done: has(sp, "before"), wrong: has(sp, "after") });
  }
  if (it.state === "cooked") steps.push({ text: f?.state === "burnt" ? "Burnt!" : "Fry it", done: f?.state === "cooked", wrong: f?.state === "burnt" });
  if (it.season?.length && it.seasonAt === "after") {
    for (const sp of it.season) steps.push({ text: `Then ${spiceList([sp])}`, done: has(sp, "after"), wrong: has(sp, "before") });
  }
  return steps;
}

/** Can this food still become (or already is) this recipe item? */
function fits(it: RecipeItem, f: Food): boolean {
  if (f.kind !== it.kind || f.spoiled || f.state === "burnt") return false;
  if (f.state === it.state) return true;
  if (f.state === "raw") return true;
  return f.state === "chopped" && it.state === "cooked";
}

/** Which order this held thing is for (the most urgent one it fits), or the first order if empty-handed in the guided shift. */
function pickOrder(g: Game, chef: Chef): Order | null {
  const orders = knownOrders(g, chef);
  const held = chef.held;
  if (!held) return levelByNumber(g.level).tutorial ? (orders[0] ?? null) : null;
  if (held.type === "food") return orders.find((o) => o.recipe.items.some((it) => fits(it, held))) ?? null;
  if (held.type === "bowl") {
    const soups = orders.filter((o) => o.recipe.vessel === "bowl");
    if (!held.soup) return soups[0] ?? null;
    const kinds = [...held.soup].sort().join();
    return soups.find((o) => o.recipe.items.map((i) => i.kind).sort().join() === kinds) ?? null;
  }
  const plates = orders.filter((o) => o.recipe.vessel === "plate");
  return (
    plates.find((o) => {
      const left = [...o.recipe.items];
      return held.contents.every((f) => {
        const i = left.findIndex((it) => it.kind === f.kind && it.state === f.state);
        return i >= 0 && !!left.splice(i, 1);
      });
    }) ?? null
  );
}

/** Everything on this plate belongs to the recipe (so it can be finished into it). */
function fitsPlate(recipe: { vessel: string; items: RecipeItem[] }, plate: Plate): boolean {
  if (recipe.vessel !== "plate") return false;
  const left = [...recipe.items];
  return plate.contents.every((f) => {
    const i = left.findIndex((it) => it.kind === f.kind && it.state === f.state);
    return i >= 0 && !!left.splice(i, 1);
  });
}

/** Ready-to-plate food of this item lying somewhere, or food on its way (raw on a board, in a pan). */
function foodInKitchen(g: Game, it: RecipeItem, skip: Set<Food>) {
  for (const s of g.stations) {
    const f = s.item?.type === "food" ? s.item : null;
    if (f && !skip.has(f) && fits(it, f)) return { food: f, at: s };
  }
  return null;
}

/** The checklist and next step for one chef, or null when there's nothing to guide. */
export function guideFor(g: Game, chef: Chef): Guide | null {
  if (g.phase !== "playing") return null;
  const order = pickOrder(g, chef);
  if (!order) return null;
  const recipe = order.recipe;
  const held = chef.held;
  const steps: CheckStep[] = [];
  let next: string | null = null;
  let target: Station | null = null;
  let pick: number | null = null;
  /** @param item what to choose at the target, if it's a fridge, pantry or spice rack */
  const go = (text: string, at: Station | null, item?: string) => {
    if (next) return;
    const i = item && at?.stock ? at.stock.indexOf(item) : -1;
    next = i >= 0 ? `${text} (key ${i + 1})` : text;
    target = at;
    pick = i >= 0 ? i : null;
  };

  if (held?.type === "food") {
    // one ingredient: its own procedure, then the plate
    const it = recipe.items.find((i) => fits(i, held))!;
    const list = foodSteps(it, held);
    steps.push(...list);
    steps.push({ text: recipe.vessel === "bowl" ? "Into the soup pot" : "Onto a plate", done: false });
    const todo = list.find((s) => !s.done && !s.wrong);
    if (held.state === "burnt" || held.spoiled) go(`Bin the ${lower(held.kind)} and start again`, nearest(g, chef, (s) => s.kind === "trash"));
    else if (todo?.text === "Chop it") go(`Chop the ${lower(held.kind)}: put it on a cutting board, then hold F`, freeOf(g, chef, "board"));
    else if (todo?.text.startsWith("Season") || todo?.text.startsWith("Then")) {
      const missing = (it.season ?? []).filter((sp) => !(held.season ?? []).some((x) => x.spice === sp));
      go(`Season the ${lower(held.kind)} with ${spiceList(missing)} at a spice rack`, spiceRack(g, chef), missing[0]);
    } else if (todo?.text === "Fry it") go(`Fry the ${lower(held.kind)}: put it on a stove`, freeOf(g, chef, "stove"));
    else if (recipe.vessel === "bowl") go(`Put the ${lower(held.kind)} in the soup pot`, nearest(g, chef, (s) => s.kind === "pot"));
    else {
      const plated = nearest(g, chef, (s) => s.item?.type === "plate");
      go(plated ? `Add the ${describeItem(held)} to the plate` : "Put it down on a counter and fetch a plate", plated ?? freeOf(g, chef, "counter"));
    }
  } else if (held?.type === "plate" || held?.type === "bowl" || !held) {
    // the whole dish: every ingredient, the finishing touches, then the pass. Empty-handed, a
    // half-built plate waiting on a counter counts as the dish.
    const plateAt = !held ? nearest(g, chef, (s) => s.item?.type === "plate" && fitsPlate(recipe, s.item)) : null;
    const dish: Plate | Bowl | null = held ?? ((plateAt?.item as Plate | undefined) ?? null);
    const remote = !!plateAt;
    const onPlate = new Set<Food>();
    if (recipe.vessel === "bowl") {
      const soup = dish?.type === "bowl" && !!dish.soup;
      steps.push({ text: `Soup of ${spiceList(recipe.items.map((i) => lower(i.kind)))}`, done: soup });
      if (!soup) {
        const pot = nearest(g, chef, (s) => s.kind === "pot");
        if (pot?.pot?.state === "done") go(dish ? "Ladle the soup into your bowl" : "Take a bowl from the bowl rack", dish ? pot : nearest(g, chef, (s) => s.kind === "bowls"));
        else if (pot?.pot?.state === "cooking") go("The soup is boiling: grab a bowl and wait", nearest(g, chef, (s) => s.kind === "bowls"));
        else {
          const have = pot?.pot?.contents.map((f) => f.kind) ?? [];
          const want = [...recipe.items];
          for (const k of have) {
            const i = want.findIndex((w) => w.kind === k);
            if (i >= 0) want.splice(i, 1);
          }
          const nextVeg = want[0];
          if (nextVeg) go(`Take a ${lower(nextVeg.kind)} to chop for the pot (${have.length} of ${recipe.items.length} in)`, storeFor(g, chef, nextVeg.kind), nextVeg.kind);
        }
      }
    } else {
      for (const it of recipe.items) {
        const f = dish?.type === "plate" ? dish.contents.find((x) => !onPlate.has(x) && x.kind === it.kind && x.state === it.state) : undefined;
        if (f) onPlate.add(f);
        const sub = foodSteps(it, f ?? null).slice(1); // "take" is implied by being on the plate
        const missed = sub.some((s) => s.wrong || !s.done);
        steps.push({ text: `${food(it.kind, it.state)}${it.season?.length ? ` (${spiceList(it.season)} ${it.seasonAt === "after" ? "after" : "before"} cooking)` : ""}`, done: !!f && !missed, wrong: !!f && missed });
        if (!f && !next) {
          // empty-handed or holding the plate: what's the next ingredient to work on?
          const lying = foodInKitchen(g, it, onPlate);
          if (lying && lying.food.state === it.state && remote) {
            go(`Pick up the ${food(it.kind, it.state)} and add it to the plate`, lying.at);
          } else if (lying && lying.food.state === it.state && !dish && lying.at.kind !== "stove") {
            go(`Get a plate, then add the ${food(it.kind, it.state)}`, nearest(g, chef, (s) => s.kind === "plates"));
          } else if (lying && lying.food.state === it.state) {
            go(`${dish ? "Add" : "Pick up"} the ${food(it.kind, it.state)}`, lying.at);
          } else if (lying?.at.kind === "board" && lying.food.state === "raw" && needsChop(it)) {
            go(dish && !remote ? `Put the plate down, then chop the ${lower(it.kind)} (hold F)` : `Chop the ${lower(it.kind)}: hold F at the board`, dish && !remote ? freeOf(g, chef, "counter") : lying.at);
          } else if (lying?.at.kind === "stove") {
            go(lying.food.state === "cooked" ? `Take the ${lower(it.kind)} off the stove!` : `The ${lower(it.kind)} is cooking: watch it`, lying.at);
          } else {
            const store = storeFor(g, chef, it.kind);
            if (dish && !remote) go(`Put the plate down, then fetch ${lower(it.kind)}`, freeOf(g, chef, "counter"));
            else go(`Take ${/^[aeiou]/i.test(it.kind) ? "an" : "a"} ${lower(it.kind)} from the ${store ? stationName(store) : "store"}`, store, it.kind);
          }
        }
      }
    }
    if (remote && steps.every((s) => s.done || s.wrong)) go("Pick up the plate", plateAt);
    for (const sp of recipe.finish ?? []) {
      const done = !!dish && dish.season.includes(sp);
      steps.push({ text: `Finish: ${spiceList([sp])}`, done });
      if (!done && dish && !remote && steps.every((s) => s.done || s.wrong || s.text.startsWith("Finish"))) go(`Finish it with ${spiceList([sp])} at a spice rack`, spiceRack(g, chef), sp);
    }
    const ready = !!dish && !remote && steps.every((s) => s.done || s.wrong);
    steps.push({ text: "Serve at the pass", done: false });
    if (ready) go("Serve it at the pass!", nearest(g, chef, (s) => s.kind === "serve"));
  }

  const current = steps.find((s) => !s.done && !s.wrong);
  if (current) current.current = true;
  return { order, steps, next, target, pick };
}


/** How far along one recipe item is anywhere in the kitchen. */
export type ItemProgress = "ready" | "working" | "todo";

/**
 * The head chef's view of an order: for each recipe item, whether it's ready (in its final state,
 * on a plate or waiting to be plated), being worked on (fetched, chopping, in a pan) or not started.
 * Greedy and approximate on purpose: it's a glance for calling the shots, not a rule.
 */
export function orderProgress(g: Game, order: Order): ItemProgress[] {
  const recipe = order.recipe;
  if (recipe.vessel === "bowl") {
    const kinds = recipe.items.map((i) => i.kind).sort().join();
    const bowls = [...g.stations.map((s) => s.item), ...g.chefs.map((c) => c.held)].filter((i): i is Bowl => i?.type === "bowl");
    if (bowls.some((b) => b.soup && [...b.soup].sort().join() === kinds)) return recipe.items.map(() => "ready");
    const pot = g.stations.find((s) => s.pot)?.pot;
    const inPot = [...(pot?.contents.map((f) => f.kind) ?? [])];
    const done = pot?.state === "done";
    return recipe.items.map((it) => {
      const i = inPot.indexOf(it.kind);
      if (i < 0) return "todo";
      inPot.splice(i, 1);
      return done ? "ready" : "working";
    });
  }
  // every food in play, wherever it is (loose, on plates, in hands)
  const foods: Food[] = [];
  const collect = (item: Plate | Bowl | Food | null | undefined) => {
    if (item?.type === "food") foods.push(item);
    else if (item?.type === "plate") foods.push(...item.contents);
  };
  for (const s of g.stations) collect(s.item);
  for (const c of g.chefs) collect(c.held);
  const used = new Set<Food>();
  return recipe.items.map((it) => {
    const done = foods.find((f) => !used.has(f) && f.kind === it.kind && f.state === it.state && !f.spoiled);
    if (done) {
      used.add(done);
      return "ready";
    }
    const going = foods.find((f) => !used.has(f) && fits(it, f));
    if (going) {
      used.add(going);
      return "working";
    }
    return "todo";
  });
}
