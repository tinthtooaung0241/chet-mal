// Recipe check: every dish on every shift's menu can really be made in that kitchen, by the
// rules of the food it uses, and no two dishes on one menu are the same thing on the plate.
// Also prints what each dish costs to make beside what it pays, to keep the menu balanced.
//
//   npm run test:recipes
import { CHOP_TIME, FOOD_RULES, LEVELS, RECIPES, SOUP_TIME, TUTORIAL, createGame, recipeById, type Recipe } from "../src/index";

const problems: string[] = [];
const fail = (text: string) => problems.push(text);

/** What a kitchen has on its shelves, in its fridges and on its spice rack. */
function stockOf(level: number) {
  const g = createGame(level);
  const food = new Set<string>();
  const spices = new Set<string>();
  for (const s of g.stations) {
    if (s.kind === "spice") for (const k of s.stock ?? []) spices.add(k);
    else if (s.kind === "crate" && s.crate) food.add(s.crate);
    else if (s.kind === "fridge" || s.kind === "pantry") for (const k of s.stock ?? []) food.add(k);
  }
  return { food, spices };
}

/** Can this ingredient reach this state, and be seasoned when the recipe says? */
function checkItems(recipe: Recipe) {
  for (const it of recipe.items) {
    const rule = FOOD_RULES[it.kind];
    if (!rule) {
      fail(`${recipe.id}: no such ingredient ${it.kind}`);
      continue;
    }
    if (recipe.vessel === "bowl") {
      if (!rule.potFrom) fail(`${recipe.id}: ${it.kind} can't go in the pot`);
      else if (rule.potFrom !== it.state) fail(`${recipe.id}: ${it.kind} goes in the pot ${rule.potFrom}, the recipe says ${it.state}`);
      if (it.season?.length) fail(`${recipe.id}: soup is seasoned in the bowl, not on the ${it.kind}`);
      continue;
    }
    if (it.state === "chopped" && !rule.chop) fail(`${recipe.id}: ${it.kind} can't be chopped`);
    if (it.state === "cooked" && !rule.cookFrom) fail(`${recipe.id}: ${it.kind} can't be cooked`);
    if (it.state === "burnt") fail(`${recipe.id}: nobody orders burnt ${it.kind}`);
    if (it.seasonAt && it.state !== "cooked") fail(`${recipe.id}: "${it.seasonAt} cooking" on ${it.kind}, which isn't cooked`);
    if (it.season?.length && it.state === "cooked" && !it.seasonAt) fail(`${recipe.id}: say when the ${it.kind} is seasoned`);
  }
  if (recipe.vessel === "bowl" && recipe.items.length !== 3) fail(`${recipe.id}: a pot of soup takes three things`);
  if (recipe.vessel === "plate" && recipe.items.length > 3) fail(`${recipe.id}: a plate holds three things`);
}

const seasoningOf = (r: Recipe) => JSON.stringify([r.items.map((i) => [i.kind, i.state, [...(i.season ?? [])].sort(), i.seasonAt]).sort(), [...(r.finish ?? [])].sort()]);
const plateOf = (r: Recipe) => `${r.vessel}:${r.items.map((i) => (r.vessel === "bowl" ? i.kind : `${i.kind}:${i.state}`)).sort().join()}`;

/** Rough seconds for one chef: a trip for everything fetched, chopping, half of the cooking (it runs by itself), a trip per seasoning, plating and serving. */
function effort(r: Recipe): number {
  const TRIP = 3;
  let t = 2 * TRIP; // a plate or bowl, and the walk to the pass
  for (const it of r.items) {
    const rule = FOOD_RULES[it.kind] ?? {};
    t += TRIP;
    const chopped = it.state === "chopped" || (it.state === "cooked" && rule.cookFrom === "chopped");
    if (chopped) t += TRIP + CHOP_TIME;
    if (it.state === "cooked") t += TRIP + (rule.cookTime ?? 0) / 2;
    t += (it.season?.length ?? 0) * TRIP;
  }
  if (r.vessel === "bowl") t += TRIP + SOUP_TIME / 2;
  t += (r.finish?.length ?? 0) * TRIP;
  return Math.round(t);
}

for (const r of RECIPES) checkItems(r);
if (new Set(RECIPES.map((r) => r.id)).size !== RECIPES.length) fail("two recipes share an id");

for (const level of [TUTORIAL, ...LEVELS]) {
  const { food, spices } = stockOf(level.n);
  const menu = level.recipes.map(recipeById);
  for (const r of menu) {
    for (const it of r.items) if (!food.has(it.kind)) fail(`shift ${level.n} (${level.name}): ${r.id} needs ${it.kind}, which this kitchen doesn't stock`);
    for (const sp of [...(r.finish ?? []), ...r.items.flatMap((i) => i.season ?? [])]) {
      if (!spices.has(sp)) fail(`shift ${level.n} (${level.name}): ${r.id} needs ${sp}, which isn't on this kitchen's rack`);
    }
  }
  // two dishes that look the same on the plate must at least be seasoned differently
  for (const a of menu) {
    for (const b of menu) {
      if (a.id < b.id && plateOf(a) === plateOf(b) && seasoningOf(a) === seasoningOf(b)) fail(`shift ${level.n}: ${a.id} and ${b.id} are the same dish`);
    }
  }
}

console.log("dish                     work(s)  pays  waits  pays per 10s of work");
for (const r of RECIPES) {
  const e = effort(r);
  // no dish is a bargain or a chore: pay stays near 9 points for 10 seconds of work, and the
  // customer waits about twice as long as the dish takes one chef
  const rate = (r.reward / e) * 10;
  if (rate < 6.5 || rate > 11.5) fail(`${r.id}: pays ${rate.toFixed(1)} points per 10 s of work (keep it between 6.5 and 11.5)`);
  if (r.time < e * 1.7) fail(`${r.id}: customers wait ${r.time}s for about ${e}s of work (give them at least ${Math.ceil(e * 1.7)}s)`);
  if ((r.finish?.length ?? 0) > 2 && !["mohinga", "lahpet"].includes(r.id)) fail(`${r.id}: more than two finishing touches`);
  console.log(`${r.id.padEnd(24)} ${String(e).padStart(6)} ${String(r.reward).padStart(5)} ${String(r.time).padStart(6)}  ${((r.reward / e) * 10).toFixed(1)}`);
}
if (problems.length) {
  console.error(`\n${problems.length} problem${problems.length > 1 ? "s" : ""}:\n- ${problems.join("\n- ")}`);
  process.exit(1);
}
console.log(`\n${RECIPES.length} dishes, ${LEVELS.length + 1} shifts: every dish can be made where it's ordered.`);
