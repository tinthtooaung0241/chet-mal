// The scoring check: the numbers a shift is scored by (lost customers, speed, combos, crew size,
// stars and upgrades), then one coached shift to see that the report at the end adds up to the
// score. Run it with `pnpm test:rules`.
import {
  COMBO_MAX,
  CRITIC_PENALTY,
  EXPIRED_PENALTY,
  LEVELS,
  PACES,
  RECIPES,
  SPEED_MAX,
  TILE,
  UPGRADES,
  addChef,
  burnTimeFor,
  comboBonus,
  createGame,
  crewPace,
  expiredPenalty,
  guideFor,
  interact,
  levelByNumber,
  speedBonus,
  starGoals,
  starsFor,
  stepWorld,
  targetStation,
  upgradesOnSale,
  type Chef,
  type Game,
  type Station,
} from "../src/index";

let failed = 0;
function check(name: string, ok: boolean, detail = "") {
  if (ok) return;
  failed++;
  console.log(`✗ ${name}${detail ? `: ${detail}` : ""}`);
}
const recipe = (id: string) => RECIPES.find((r) => r.id === id)!;

// --- a lost customer costs half the dish, never under the floor ---
for (const r of RECIPES) {
  const p = expiredPenalty(r);
  check(`penalty for ${r.id}`, p === Math.max(EXPIRED_PENALTY, Math.round(r.reward / 2)), `${p}`);
  check(`letting ${r.id} expire is never better than its price`, p <= r.reward);
  check(`critic penalty for ${r.id}`, expiredPenalty(r, true) >= CRITIC_PENALTY && expiredPenalty(r, true) >= p);
}
const cheap = [...RECIPES].sort((a, b) => a.reward - b.reward)[0];
const dear = [...RECIPES].sort((a, b) => b.reward - a.reward)[0];
check("a dear dish costs more to lose than a cheap one", expiredPenalty(dear) > expiredPenalty(cheap));

// --- speed ---
check("speed: served at once", speedBonus(60, 60) === SPEED_MAX);
check("speed: half the time left", speedBonus(30, 60) === Math.ceil(SPEED_MAX / 2));
check("speed: out of time", speedBonus(0, 60) === 0);
check("speed: never above the top", speedBonus(90, 60) === SPEED_MAX);

// --- combos ---
check("combo: first dish earns none", comboBonus(1) === 0);
check("combo: second dish", comboBonus(2) === 5);
check("combo: capped", comboBonus(3) === COMBO_MAX && comboBonus(12) === COMBO_MAX);
check("a full combo pays no more than serving fast", COMBO_MAX <= SPEED_MAX);
check("a full combo pays less than the cheapest dish", COMBO_MAX < cheap.reward);

// --- crew size ---
check("solo orders come less often than a pair's", crewPace(1) > crewPace(2));
check("three chefs' orders come more often", crewPace(3) < crewPace(2));
check("a crew of four plays as three", crewPace(4) === crewPace(3));
for (const level of LEVELS) {
  const [solo, pair, trio] = [1, 2, 3].map((n) => starGoals(level, n));
  check(`level ${level.n}: stars rise`, pair[0] < pair[1] && pair[1] < pair[2], `${pair}`);
  check(`level ${level.n}: solo stars are cheaper`, solo.every((s, i) => s < pair[i]), `${solo} / ${pair}`);
  check(`level ${level.n}: three chefs' stars cost more`, trio.every((s, i) => s > pair[i]), `${trio} / ${pair}`);
  check(`level ${level.n}: goals are round`, [...solo, ...pair, ...trio].every((s) => s % 5 === 0));
  check(`level ${level.n}: starsFor`, starsFor(level, pair[2], 2) === 3 && starsFor(level, pair[0] - 1, 2) === 0 && starsFor(level, pair[2] - 1, 1) === 3);
}

// --- upgrades ---
const firsts = UPGRADES.filter((u) => !u.needs);
check("every second tier follows a first", UPGRADES.filter((u) => u.needs).every((u) => firsts.some((f) => f.id === u.needs && u.id === `${f.id}2` && u.cost > f.cost)));
check("a new restaurant sells the first tier only", upgradesOnSale([]).every((u) => !u.needs) && upgradesOnSale([]).length === firsts.length);
check("owning knives puts the knife set on sale", upgradesOnSale(["knives"]).some((u) => u.id === "knives2"));
check("the knife set takes the knives' place", !upgradesOnSale(["knives", "knives2"]).some((u) => u.id === "knives"));
const plain = createGame(2);
const pans = createGame(2, ["pans"]);
const range = createGame(2, ["pans", "pans2"]);
check("pans slow burning, the range more", burnTimeFor(plain, "Steak") < burnTimeFor(pans, "Steak") && burnTimeFor(pans, "Steak") < burnTimeFor(range, "Steak"));

// --- a lost customer, in a real shift ---
{
  const g = createGame(2);
  addChef(g, "a", "full");
  g.score = 100;
  let lost: string | undefined;
  for (let t = 0; t < 400 && !lost; t += 0.1) {
    const open = g.orders.map((o) => ({ id: o.id, recipe: o.recipe, critic: o.critic }));
    stepWorld(g, 0.1);
    if (g.events.some((e) => e.kind === "expired")) {
      const gone = open.find((o) => !g.orders.some((x) => x.id === o.id))!;
      lost = gone.recipe.id;
      check("a lost customer takes their penalty off the score", g.score === 100 - expiredPenalty(gone.recipe, gone.critic), `${g.score}`);
      check("and it's in the report", g.tally.lost === 1 && g.tally.lostPoints === 100 - g.score);
    }
    g.events.length = 0;
  }
  check("an unserved order expires", !!lost);
}
{
  const g = createGame(2);
  addChef(g, "a", "full");
  for (let t = 0; t < 400 && g.tally.lost === 0; t += 0.1) stepWorld(g, 0.1);
  check("the score never goes below zero", g.score === 0);
}

// --- solo kitchens get fewer orders ---
function ordersIn(crew: number, seconds: number) {
  const g = createGame(1);
  for (let i = 0; i < crew; i++) addChef(g, `c${i}`, "full");
  let n = 0;
  let seen = new Set<number>();
  for (let t = 0; t < seconds; t += 0.1) {
    stepWorld(g, 0.1);
    for (const o of g.orders) if (!seen.has(o.id)) (seen.add(o.id), n++);
    g.orders.length = Math.min(g.orders.length, 1); // keep the rail clear so new orders aren't held back
  }
  return n;
}
check("fewer orders reach one chef than two", ordersIn(1, 80) <= ordersIn(2, 80) && ordersIn(1, 80) < ordersIn(3, 80), `${ordersIn(1, 80)} / ${ordersIn(2, 80)} / ${ordersIn(3, 80)}`);

// --- one coached shift: the report adds up to the score ---
PACES.classic.coach = true;
function standAt(g: Game, chef: Chef, s: Station) {
  for (const turn of [0, Math.PI / 2, -Math.PI / 2, Math.PI]) {
    const f = s.facing + turn;
    chef.x = s.x + Math.sin(f) * TILE;
    chef.z = s.z + Math.cos(f) * TILE;
    chef.facing = f + Math.PI;
    if (targetStation(g, chef)?.id === s.id) return true;
  }
  return false;
}
for (const n of [1, 4, 8]) {
  const g = createGame(n);
  const chef = addChef(g, "a", "full");
  let cool = 0;
  let combo = 0;
  for (let t = 0; g.phase === "playing" && t < 900; t += 0.1) {
    chef.chopInput = false;
    const guide = guideFor(g, chef);
    if (guide?.target && standAt(g, chef, guide.target)) {
      if (guide.pick !== null) chef.pick = guide.pick;
      const next = guide.next ?? "";
      if (/hold F|wash/i.test(next) && !chef.held) chef.chopInput = true;
      else if (!/watch it|wait/i.test(next) && cool <= t) {
        cool = t + 0.3;
        interact(g, chef);
      }
    }
    stepWorld(g, 0.1);
    for (const e of g.events.splice(0)) {
      const m = e.kind === "combo" && /Plus (\d+) bonus/.exec(e.text);
      if (m) combo = Math.max(combo, +m[1]);
    }
  }
  const t = g.tally;
  const earned = t.dishes + t.speed + t.perfect + t.seasoning + t.presented + t.extra + t.combo;
  check(`level ${n}: dishes were served`, g.served > 0);
  check(`level ${n}: speed points stay under the top`, t.speed <= g.served * SPEED_MAX, `${t.speed} for ${g.served}`);
  check(`level ${n}: no combo pays over the cap`, combo <= COMBO_MAX * 2, `${combo}`);
  const off = t.lostPoints + t.sickPoints + t.firePoints;
  check(`level ${n}: the report adds up`, earned - off === g.score, `earned ${earned}, lost ${off}, score ${g.score}`);
  check(`level ${n}: stars match the score`, starsFor(levelByNumber(n), g.score, 1) === starGoals(levelByNumber(n), 1).filter((s) => g.score >= s).length);
}

console.log(failed ? `${failed} checks failed` : "Scoring, crew sizes, stars and upgrades all check out.");
process.exit(failed ? 1 : 0);
