// The kitchen coach: for one chef, which order they're working towards, a checklist of every step
// of that dish (done, still to do, or done wrong), the very next step in words, and the station to
// go to. Read-only. The HUD shows it as a checklist and, in the guided first shift and at a cozy
// pace, as a coach with a glowing station. The coach knows the team: cooks split the orders, the
// head chef plates and serves, and whoever runs the till hears about customers waiting to pay.
import { ROLES } from "./roles";
import { FOOD_RULES, SPICE_NAMES, levelByNumber, paceOf, spiceList, type RecipeItem, type Spice } from "./rules";
import { describeItem, stationName, targetStation, type Bowl, type Chef, type Food, type Game, type Order, type Plate, type Station } from "./state";
import { payingDiners, tableNumber } from "./diners";

export interface CheckStep {
  text: string;
  done: boolean;
  /** done the wrong way (e.g. salted after cooking); can't be fixed on this ingredient */
  wrong?: boolean;
  /** the step to do now */
  current?: boolean;
  /** a teammate is already carrying it (their first name) */
  by?: string;
}

export interface Guide {
  /** the dish this is about (null for a job that isn't one: the till, washing up) */
  order: Order | null;
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

/** The spices this ingredient still needs at the step it's at: before cooking while it's raw or chopped, after once it's cooked. */
function spicesNow(it: RecipeItem, f: Food): Spice[] {
  if (!it.season?.length || f.state === "burnt" || f.spoiled) return [];
  const now = f.state === "cooked" ? "after" : "before";
  if ((it.seasonAt ?? "before") !== now) return [];
  return it.season.filter((sp) => !(f.season ?? []).some((x) => x.spice === sp));
}

const sameSoup = (b: Bowl, recipe: { items: RecipeItem[] }) => !!b.soup && [...b.soup].sort().join() === recipe.items.map((i) => i.kind).sort().join();

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

/** Which order this chef's held thing is for: the most urgent one it fits. */
function heldOrder(g: Game, chef: Chef): Order | null {
  const held = chef.held;
  if (!held || (held.type !== "food" && held.dirty)) return null; // a dirty dish is for the sink, not an order
  const orders = knownOrders(g, chef);
  if (held.type === "food") {
    // spoiled or burnt food fits nothing, but it's still for the dish it was meant for: bin it
    const ruined = held.spoiled || held.state === "burnt";
    const fitting = orders.filter((o) => o.recipe.items.some((it) => fits(it, held) || (ruined && it.kind === held.kind)));
    // an order it can move on now first: a soup waits while the pot is busy, a plate doesn't
    const pot = g.stations.find((s) => s.pot)?.pot;
    const stuck = (o: Order) => o.recipe.vessel === "bowl" && !!pot && pot.state !== "filling";
    return fitting.find((o) => !stuck(o)) ?? fitting[0] ?? null;
  }
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

/** The coach leads empty hands to an order, and shows the next step, in the guided first shift and at a cozy pace. */
const coachOn = (g: Game) => !!levelByNumber(g.level).tutorial || paceOf(g).coach;

const firstName = (c: Chef) => c.name.split(" (")[0];

/** The checklist and next step for one chef, or null when there's nothing to guide. */
export function guideFor(g: Game, chef: Chef): Guide | null {
  if (g.phase !== "playing") return null;
  let guide: Guide | null = null;
  const held = chef.held;
  if (chef.spice) guide = spiceJob(g, chef);
  else if (held) {
    const order = heldOrder(g, chef);
    if (order) guide = orderGuide(g, chef, order);
    else if (coachOn(g) || (held.type === "food" && (held.spoiled || held.state === "burnt"))) guide = strayGuide(g, chef);
  } else if (coachOn(g)) guide = nextJob(g, chef);
  if (!coachOn(g)) return guide;
  guide = withTill(g, chef, guide);
  return guide?.next ? guide : whenIdle(g, chef, guide);
}

/** Free hands and nothing for you on the tickets: wash up if there's washing, else say all's in hand. */
function whenIdle(g: Game, chef: Chef, guide: Guide | null): Guide | null {
  // only orders this chef can perceive count: a deaf cook mustn't learn of a phone order this way
  if (chef.held || chef.spice || !knownOrders(g, chef).length) return guide;
  const keep = { order: guide?.order ?? null, steps: guide?.steps ?? [], pick: null };
  // dirty dishes customers left on the pass go to the sink first, then get washed
  const waiting = nearest(g, chef, (s) => (s.item?.type === "plate" || s.item?.type === "bowl") && !!s.item.dirty);
  if (waiting) return { ...keep, next: `Nothing waiting on you: take the dirty ${waiting.item!.type} from the pass to the sink`, target: waiting };
  const dirty = g.dishes ? g.dishes.dirtyPlates + g.dishes.dirtyBowls : 0;
  const sink = dirty ? nearest(g, chef, (s) => s.kind === "sink") : null;
  const next = sink ? "Nothing waiting on you: wash up at the sink (hold F)" : "Everything's on the go: keep an eye on the tickets";
  return { ...keep, next, target: sink };
}

/**
 * Holding something no order wants (ruined, or its customer gave up): an empty plate or bowl goes
 * back on its rack, raw food back where it came from, anything else in the bin.
 */
function strayGuide(g: Game, chef: Chef): Guide | null {
  const held = chef.held!;
  const trash = () => nearest(g, chef, (s) => s.kind === "trash");
  let next: string;
  let target: Station | null;
  if (held.type !== "food" && held.dirty) [next, target] = [`Take the dirty ${held.type} to the sink`, nearest(g, chef, (s) => s.kind === "sink")];
  else if (held.type === "plate" && !held.contents.length) [next, target] = ["Nothing needs this plate now: put it back on the plate rack", nearest(g, chef, (s) => s.kind === "plates")];
  else if (held.type === "bowl" && !held.soup) [next, target] = ["Nothing needs this bowl now: put it back on the bowl rack", nearest(g, chef, (s) => s.kind === "bowls")];
  else if (held.type === "food" && held.state === "raw" && !held.spoiled && ROLES[chef.role].cooks) {
    const store = nearest(g, chef, (s) => s.kind === "crate" ? s.crate === held.kind : s.kind !== "spice" && !!s.stock?.includes(held.kind));
    [next, target] = store ? [`No order needs the ${lower(held.kind)} now: put it back`, store] : [`No order needs the ${lower(held.kind)} now: bin it`, trash()];
  } else [next, target] = [`No order needs the ${describeItem(held)} now: bin it`, trash()];
  return { order: null, steps: [], next, target, pick: null };
}

/** Something ruined in the way (burnt or spoiled food left on a station, a burnt pot): a cook with free hands clears it first. */
function cleanup(g: Game, chef: Chef): { next: string; target: Station } | null {
  if (chef.held || chef.spice || !ROLES[chef.role].cooks) return null;
  const ruined = nearest(g, chef, (s) => s.item?.type === "food" && (s.item.spoiled || s.item.state === "burnt"));
  if (ruined?.item) return { next: `Bin the ${describeItem(ruined.item)}: pick it up and take it to the bin`, target: ruined };
  const pot = nearest(g, chef, (s) => s.pot?.state === "burnt");
  if (pot) return { next: "The soup burnt: scrape out the pot (use it with empty hands)", target: pot };
  return null;
}

/**
 * Empty-handed: the most urgent order with something for this chef to do, trying first the orders
 * no teammate is carrying anything for, so friends split the work instead of doubling up.
 */
function nextJob(g: Game, chef: Chef): Guide | null {
  const taken = new Set(g.chefs.filter((c) => c !== chef && c.held).map((c) => heldOrder(g, c)?.id));
  const orders = knownOrders(g, chef);
  const guides = [...orders.filter((o) => !taken.has(o.id)), ...orders.filter((o) => taken.has(o.id))].map((o) => orderGuide(g, chef, o));
  const guide = guides.find((gd) => gd.next && gd.target) ?? guides.find((gd) => gd.next) ?? guides[0] ?? null;
  const clear = cleanup(g, chef);
  return guide && clear ? { ...guide, ...clear, pick: null } : guide;
}

/**
 * A spice bottle in hand: season what still wants it (an ingredient at its step, or a dish's
 * finishing touch), else swap it for a spice something else needs, else put it back.
 */
function spiceJob(g: Game, chef: Chef): Guide {
  const { spice, rack } = chef.spice!;
  const name = SPICE_NAMES[spice];
  const cooks = ROLES[chef.role].cooks;
  const orders = knownOrders(g, chef);
  /** what this item still wants, for one of the orders (ingredients only for cooks) */
  const wants = (item: Station["item"]): { order: Order; spices: Spice[] } | null => {
    if (!item) return null;
    for (const order of orders) {
      const recipe = order.recipe;
      if (item.type === "food") {
        const it = cooks ? recipe.items.find((i) => fits(i, item)) : undefined;
        const spices = it ? spicesNow(it, item) : [];
        if (spices.length) return { order, spices };
      } else if (item.type === "plate" ? recipe.vessel === "plate" && item.contents.length > 0 && fitsPlate(recipe, item) : recipe.vessel === "bowl" && sameSoup(item, recipe)) {
        const spices = (recipe.finish ?? []).filter((sp) => !item.season.includes(sp));
        if (spices.length) return { order, spices };
      }
    }
    return null;
  };
  const byDistance = [...g.stations].sort((a, b) => Math.hypot(a.x - chef.x, a.z - chef.z) - Math.hypot(b.x - chef.x, b.z - chef.z));
  const here = byDistance.find((s) => wants(s.item)?.spices.includes(spice));
  if (here?.item) {
    const { order } = wants(here.item)!;
    return { order, steps: orderGuide(g, chef, order).steps, next: `Season the ${describeItem(here.item)} with ${name}`, target: here, pick: null };
  }
  const other = byDistance.map((s) => wants(s.item)).find((w) => w)?.spices[0];
  const shelf = (want: Spice) => nearest(g, chef, (s) => s.kind === "spice" && !!s.stock?.includes(want));
  if (other) {
    const at = shelf(other);
    const i = at?.stock?.indexOf(other) ?? -1;
    return { order: null, steps: [], next: `Swap the ${name} for the ${SPICE_NAMES[other]} at the spice rack${i >= 0 ? ` (key ${i + 1})` : ""}`, target: at, pick: i >= 0 ? i : null };
  }
  const home = g.stations.find((s) => s.id === rack) ?? shelf(spice);
  const i = home?.stock?.indexOf(spice) ?? -1;
  return { order: null, steps: [], next: `Put the ${name} back on the spice rack${i >= 0 ? ` (key ${i + 1})` : ""}`, target: home, pick: i >= 0 ? i : null };
}

/** Who rings up the till: the head chef if there is one, else whoever has free hands nearest to it. */
function cashier(g: Game): Chef | null {
  const head = g.chefs.find((c) => !c.bot && !ROLES[c.role].cooks);
  if (head) return head;
  const till = g.stations.find((s) => s.kind === "register");
  if (!till) return null;
  const free = g.chefs.filter((c) => !c.bot && !c.held && !c.spice);
  free.sort((a, b) => Math.hypot(a.x - till.x, a.z - till.z) - Math.hypot(b.x - till.x, b.z - till.z));
  return free[0] ?? null;
}

/** A customer waiting to pay comes first for whoever runs the till (even with no dish to guide). */
function withTill(g: Game, chef: Chef, guide: Guide | null): Guide | null {
  const payer = payingDiners(g)[0];
  const till = g.stations.find((s) => s.kind === "register");
  if (!payer || !till || cashier(g) !== chef || chef.spice) return guide;
  const i = till.stock?.indexOf(payer.pay) ?? -1;
  const how = payer.pay.toLowerCase();
  return {
    order: guide?.order ?? null,
    steps: guide?.steps ?? [],
    next: `Table ${tableNumber(payer.seat)} wants to pay by ${how}: ring them up at the till${i >= 0 ? ` (key ${i + 1})` : ""}`,
    target: till,
    pick: i >= 0 ? i : null,
  };
}

/** The checklist and next step for one chef working on one order. */
function orderGuide(g: Game, chef: Chef, order: Order): Guide {
  const recipe = order.recipe;
  const held = chef.held;
  const steps: CheckStep[] = [];
  let next: string | null = null;
  let target: Station | null = null;
  let pick: number | null = null;
  /** an empty station of this kind, or null when every one is in use */
  const free = (kind: Station["kind"]) => nearest(g, chef, (s) => s.kind === kind && !s.item);
  // who does what: cooks fetch, chop and cook; the head chef (when there is one) plates and serves,
  // unless the pass is backed up (not a counter free), when the cooks plate too. A cook already
  // holding a plate or bowl is plating.
  const cooks = ROLES[chef.role].cooks;
  const headMate = g.chefs.some((c) => c !== chef && !c.bot && !ROLES[c.role].cooks);
  const plates = !cooks || !headMate || held?.type === "plate" || held?.type === "bowl" || !free("counter");
  /** @param item what to choose at the target, if it's a fridge, pantry or spice rack */
  const go = (text: string, at: Station | null, item?: string) => {
    if (next) return;
    const i = item && at?.stock ? at.stock.indexOf(item) : -1;
    next = i >= 0 ? `${text} (key ${i + 1})` : text;
    target = at;
    pick = i >= 0 ? i : null;
  };
  /** a teammate already carrying food for this recipe item (each piece of food counts once) */
  const carried = new Set<Food>();
  const mateWith = (it: RecipeItem): Chef | null => {
    const mate = g.chefs.find((c) => c !== chef && c.held?.type === "food" && !carried.has(c.held) && fits(it, c.held));
    if (mate?.held?.type === "food") carried.add(mate.held);
    return mate ?? null;
  };
  /** a teammate chopping at this board right now */
  const choppedBy = (st: Station) => g.chefs.some((c) => c !== chef && c.chopping && targetStation(g, c)?.id === st.id);
  const plateRack = () => nearest(g, chef, (s) => s.kind === "plates");
  /** the head chef asks a cook (or, practising alone, hears how to get one: a cook's seat or the helper bot) */
  const askCook = (what: string) =>
    go(g.chefs.some((c) => c !== chef && ROLES[c.role].cooks) ? `Ask a cook for ${what}` : "The head chef doesn't cook: play as a cook, or add the helper bot", null);
  /** where to put something down: an empty bowl or plate back on its rack, anything else on a free counter */
  const spotFor = (item: Plate | Bowl | Food | null) => {
    if (item && item.type !== "food" && item.dirty) return sink();
    if (item?.type === "bowl" && !item.soup) return nearest(g, chef, (s) => s.kind === "bowls");
    if (item?.type === "plate" && !item.contents.length) return nearest(g, chef, (s) => s.kind === "plates");
    return free("counter") ?? (item?.type === "food" ? free("board") : null);
  };
  /** none free: wait for one, or, if something ruined is in the way, put this down and clear it */
  const busy = (kind: Station["kind"], what: string, thing: string) => {
    const blocked = nearest(g, chef, (s) => s.kind === kind && s.item?.type === "food" && (s.item.spoiled || s.item.state === "burnt"));
    if (blocked?.item) go(`Put the ${thing} down, then bin the ${describeItem(blocked.item)} from the ${what}`, spotFor(held));
    else go(`Every ${what} is in use: wait for one to free up`, nearest(g, chef, (s) => s.kind === kind));
  };
  const sink = () => nearest(g, chef, (s) => s.kind === "sink");
  /** out of clean ones: wash what's in the sink, else bring a dirty one in from the pass, else wait */
  const noClean = (what: "plate" | "bowl") => {
    const inSink = g.dishes ? g.dishes.dirtyPlates + g.dishes.dirtyBowls : 0;
    const waiting = nearest(g, chef, (s) => (s.item?.type === "plate" || s.item?.type === "bowl") && !!s.item.dirty);
    if (inSink) go(`No clean ${what}s: hold F at the sink to wash one`, sink());
    else if (waiting && !held) go(`No clean ${what}s: take the dirty ${waiting.item!.type} from the pass to the sink`, waiting);
    else go(`No clean ${what}s: wait for a customer to bring one back`, null);
  };

  if (held?.type === "food") {
    // one ingredient: its own procedure, then the plate
    const it = recipe.items.find((i) => fits(i, held)) ?? recipe.items.find((i) => i.kind === held.kind)!;
    const list = foodSteps(it, held);
    steps.push(...list);
    steps.push({ text: recipe.vessel === "bowl" ? "Into the soup pot" : "Onto a plate", done: false });
    const todo = list.find((s) => !s.done && !s.wrong);
    if (held.state === "burnt" || held.spoiled) go(`Bin the ${lower(held.kind)} and start again`, nearest(g, chef, (s) => s.kind === "trash"));
    else if (todo?.text === "Chop it") {
      const board = free("board");
      if (board) go(`Chop the ${lower(held.kind)}: put it on a cutting board, then hold F`, board);
      else busy("board", "cutting board", lower(held.kind));
    }
    else if (todo?.text.startsWith("Season") || todo?.text.startsWith("Then")) {
      // seasoning happens where the food is: put it down, then bring the bottle to it
      const missing = (it.season ?? []).filter((sp) => !(held.season ?? []).some((x) => x.spice === sp));
      go(`Put the ${lower(held.kind)} down, then bring the ${spiceList(missing)} to it`, spotFor(held));
    } else if (todo?.text === "Fry it") {
      const stove = free("stove");
      if (stove) go(`Fry the ${lower(held.kind)}: put it on a stove`, stove);
      else busy("stove", "stove", lower(held.kind));
    } else if (recipe.vessel === "bowl") {
      const pot = nearest(g, chef, (s) => s.kind === "pot");
      const state = pot?.pot?.state;
      if (state === "filling") go(`Put the ${lower(held.kind)} in the soup pot`, pot);
      else if (state === "burnt") go(`The soup burnt: put the ${lower(held.kind)} down, then scrape out the pot`, spotFor(held));
      else go(`The pot is busy: put the ${lower(held.kind)} down on a counter for the next soup`, spotFor(held));
    }
    else {
      // a plate this dish is being built on, with room for this
      const plated = nearest(g, chef, (s) => s.item?.type === "plate" && !s.item.dirty && fitsPlate(recipe, { ...s.item, contents: [...s.item.contents, held] }));
      if (plated) go(`Add the ${describeItem(held)} to the plate`, plated);
      else if (!spotFor(held)) go("Every counter is full: hand it to a teammate, or wait for a space", null);
      else if (headMate) go(`Put the ${describeItem(held)} down on a counter: the head chef plates it`, spotFor(held));
      else go("Put it down on a counter and fetch a plate", spotFor(held));
    }
  } else if (held?.type === "plate" || held?.type === "bowl" || !held) {
    // the whole dish: every ingredient, the finishing touches, then the pass. Empty-handed, a
    // half-built plate waiting on a counter counts as the dish.
    const plateAt = !held
      ? nearest(g, chef, (s) => (recipe.vessel === "bowl" ? s.item?.type === "bowl" && sameSoup(s.item, recipe) : s.item?.type === "plate" && !s.item.dirty && fitsPlate(recipe, s.item)))
      : null;
    const dish: Plate | Bowl | null = held ?? ((plateAt?.item as Plate | Bowl | undefined) ?? null);
    const remote = !!plateAt;
    const onPlate = new Set<Food>();
    if (recipe.vessel === "bowl") {
      const soup = dish?.type === "bowl" && !!dish.soup;
      steps.push({ text: `Soup of ${spiceList(recipe.items.map((i) => lower(i.kind)))}`, done: soup });
      if (!soup) {
        const pot = nearest(g, chef, (s) => s.kind === "pot");
        const state = pot?.pot?.state;
        const bowls = () => nearest(g, chef, (s) => s.kind === "bowls");
        if (state === "burnt") {
          if (cooks) go(dish ? `Put the ${dish.type} down, then scrape out the burnt pot` : "The soup burnt: scrape out the pot (use it with empty hands)", dish ? spotFor(dish) : pot);
        } else if (state === "done" || state === "cooking") {
          // the soup is on: a bowl, then the ladle (the head chef's job when there is one)
          if (!plates) {
            // nothing for this cook: the head chef ladles it out
          } else if (!dish && g.dishes?.bowls === 0) noClean("bowl");
          else if (state === "done") go(dish ? "Ladle the soup into your bowl" : "Take a bowl from the bowl rack", dish ? pot : bowls());
          else if (dish) go("The soup is boiling: wait by the pot with your bowl", pot);
          else go("The soup is boiling: grab a bowl and wait", bowls());
        } else {
          const have = pot?.pot?.contents.map((f) => f.kind) ?? [];
          const want = [...recipe.items];
          for (const k of have) {
            const i = want.findIndex((w) => w.kind === k);
            if (i >= 0) want.splice(i, 1);
          }
          const count = `(${have.length} of ${recipe.items.length} in)`;
          const used = new Set<Food>();
          for (const veg of want) {
            if (next) break;
            if (mateWith(veg)) continue; // a teammate is carrying it to the pot
            // already in the kitchen: chopped and ready, raw on a board, or put down somewhere
            const lying = foodInKitchen(g, veg, used);
            if (lying) used.add(lying.food);
            if (lying && (!cooks || choppedBy(lying.at))) continue; // a cook's job, or a teammate is chopping it
            const kind = lower(veg.kind);
            if (cooks && held) go(`Put the ${held.type} ${held.type === "bowl" && !held.soup ? "back" : "down"}, then fetch the ${kind} for the pot`, spotFor(held));
            else if (lying?.food.state === veg.state) go(`Pick up the ${food(veg.kind, veg.state)} and put it in the soup pot ${count}`, lying.at);
            else if (lying?.at.kind === "board" && needsChop(veg)) go(`Chop the ${kind} for the pot: hold F at the board`, lying.at);
            else if (lying) go(`Pick up the ${kind} for the pot`, lying.at);
            else if (cooks) go(`Take a ${kind} ${veg.state === "chopped" ? "to chop for the pot" : "for the pot"} ${count}`, storeFor(g, chef, veg.kind), veg.kind);
            else askCook(`a ${kind} for the soup ${count}`);
          }
        }
      }
    } else {
      for (const it of recipe.items) {
        const f = dish?.type === "plate" ? dish.contents.find((x) => !onPlate.has(x) && x.kind === it.kind && x.state === it.state) : undefined;
        if (f) onPlate.add(f);
        const sub = foodSteps(it, f ?? null).slice(1); // "take" is implied by being on the plate
        const missed = sub.some((s) => s.wrong || !s.done);
        const mate = f ? null : mateWith(it);
        const lying = f || mate ? null : foodInKitchen(g, it, onPlate);
        // ready: cooked (or chopped) as the recipe wants, with any after-cooking spices on
        const ready = !!lying && lying.food.state === it.state && !spicesNow(it, lying.food).length;
        // a cook's part is done once it's ready and waiting on a counter for the head chef to plate
        const handedOver = ready && !plates && lying!.at.kind !== "stove" && lying!.at.kind !== "board";
        const seasoned = it.season?.length ? ` (${spiceList(it.season)} ${it.seasonAt === "after" ? "after" : "before"} cooking)` : "";
        steps.push({
          text: `${food(it.kind, it.state)}${seasoned}${mate ? ` · ${firstName(mate)} has it` : ""}`,
          done: (!!f && !missed) || handedOver,
          wrong: !!f && missed,
          ...(mate ? { by: firstName(mate) } : {}),
        });
        if (f || mate || handedOver || next) continue;
        // empty-handed or holding the plate: what's the next ingredient to work on?
        const name = food(it.kind, it.state);
        if (ready && !plates && lying!.at.kind === "board") {
          // keep the boards free: ready food waits for the head chef on a counter
          go(dish ? `Put the ${dish.type} down, then move the ${name} off the board` : `Move the ${name} off the board onto a counter for the head chef`, dish ? spotFor(dish) : lying!.at);
          continue;
        }
        if (!cooks) {
          // the head chef plates what's ready, and asks the cooks for the rest
          if (ready && remote) go(`Pick up the plate, then add the ${name}`, plateAt);
          else if (ready && dish) go(`Add the ${name} to your plate`, lying!.at);
          else if (ready && g.dishes?.plates === 0) noClean("plate");
          else if (ready) go(`Get a plate, then add the ${name}`, plateRack());
          else if (!lying) askCook(`the ${name}`);
          // on a board or in a pan: a cook is on it
          continue;
        }
        if (ready && remote) {
          go(`Pick up the ${name} and add it to the plate`, lying!.at);
        } else if (ready && !dish && lying!.at.kind !== "stove") {
          if (g.dishes?.plates === 0) noClean("plate");
          else go(`Get a plate, then add the ${name}`, plateRack());
        } else if (ready) {
          go(`${dish ? "Add" : "Pick up"} the ${name}`, lying!.at);
        } else if (lying?.at.kind === "board" && lying.food.state === "raw" && needsChop(it)) {
          if (choppedBy(lying.at)) continue; // a teammate is chopping it
          go(dish && !remote ? `Put the plate down, then chop the ${lower(it.kind)} (hold F)` : `Chop the ${lower(it.kind)}: hold F at the board`, dish && !remote ? spotFor(dish) : lying.at);
        } else if (lying && spicesNow(it, lying.food).length && !(lying.at.kind === "stove" && lying.food.state === "cooked")) {
          // seasoning: the food stays where it is and the bottle comes to it
          const sp = spicesNow(it, lying.food)[0];
          if (dish && !remote) go(`Put the ${dish.type} down, then season the ${describeItem(lying.food)}`, spotFor(dish));
          else go(`Take the ${spiceList([sp])} from the spice rack for the ${lower(it.kind)}`, spiceRack(g, chef), sp);
        } else if (lying?.at.kind === "stove") {
          const [is, them] = /s$/.test(it.kind) ? ["are", "them"] : ["is", "it"];
          go(lying.food.state === "cooked" ? `Take the ${lower(it.kind)} off the stove!` : `The ${lower(it.kind)} ${is} cooking: watch ${them}`, lying.at);
        } else if (lying) {
          // half-done and put down somewhere (say, chopped and still to fry): pick it up and carry on
          if (dish && !remote) go(`Put the plate down, then pick up the ${describeItem(lying.food)}`, spotFor(dish));
          else go(`Pick up the ${describeItem(lying.food)}`, lying.at);
        } else {
          const store = storeFor(g, chef, it.kind);
          if (dish && !remote) go(`Put the plate down, then fetch ${lower(it.kind)}`, spotFor(dish));
          else go(`Take ${/^[aeiou]/i.test(it.kind) ? "an" : "a"} ${lower(it.kind)} from the ${store ? stationName(store) : "store"}`, store, it.kind);
        }
      }
    }
    const itemsDone = steps.every((s) => s.done || s.wrong);
    const toFinish = (recipe.finish ?? []).filter((sp) => !dish?.season.includes(sp));
    for (const sp of recipe.finish ?? []) steps.push({ text: `Finish: ${spiceList([sp])}`, done: !!dish && dish.season.includes(sp) });
    if (itemsDone && dish && toFinish.length && plates) {
      // the finishing touches: the dish stays put and the bottle comes to it
      if (remote) go(`Take the ${spiceList([toFinish[0]])} from the spice rack for the ${dish.type}`, spiceRack(g, chef), toFinish[0]);
      else go(`Put the ${dish.type} down, then bring the ${spiceList([toFinish[0]])} to it`, spotFor(dish));
    }
    if (remote && plates && itemsDone && !toFinish.length) go(`Pick up the ${dish!.type}`, plateAt);
    const ready = !!dish && !remote && steps.every((s) => s.done || s.wrong);
    steps.push({ text: "Serve at the pass", done: false });
    if (ready) go("Serve it at the pass!", nearest(g, chef, (s) => s.kind === "serve"));
  }

  const current = steps.find((s) => !s.done && !s.wrong && !s.by);
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
