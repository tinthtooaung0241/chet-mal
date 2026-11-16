// The Burmese check: plays every shift as each crew (the coach's moves, like the coach check), and
// translates everything the game says along the way, the coach's steps, what Q describes, every
// level, recipe, role, twist, upgrade, sticker and award. Lists any English left untranslated.
// Run it with `npm run test:burmese`.
import {
  HATS,
  LAYOUTS,
  LEVELS,
  PACES,
  RECIPES,
  ROLES,
  TILE,
  TUTORIAL,
  TWISTS,
  UPGRADES,
  VENUES,
  addChef,
  createGame,
  describeRecipe,
  describeSurroundings,
  guideFor,
  interact,
  stepWorld,
  targetStation,
  type Chef,
  type Game,
  type Role,
  type Station,
} from "@kitchen/shared";
import { makeTranslator } from "../src/i18n/engine";
import { burmese } from "../src/i18n/my";
import { STICKERS } from "../src/stickers";
import { DECOR } from "../src/decor";
import { shiftReport, nextTimeTip } from "../src/game/report";
import { teamAwards } from "../src/game/awards";

const said = new Set<string>();
const say = (text: string | null | undefined) => {
  if (text) said.add(text);
};

// --- everything that's data ---------------------------------------------------------------
for (const level of [TUTORIAL, ...LEVELS]) {
  say(level.name);
  say(level.blurb);
  say(level.teach.title);
  for (const line of level.teach.lines) say(line.text);
}
for (const recipe of RECIPES) {
  say(recipe.name);
  say(describeRecipe(recipe));
}
for (const role of Object.values(ROLES)) {
  say(role.name);
  say(role.summary);
  say(role.strength);
  say(role.pour.edge);
}
for (const twist of TWISTS) {
  say(twist.name);
  say(twist.blurb);
}
for (const u of UPGRADES) {
  say(u.name);
  say(u.blurb);
}
for (const v of VENUES) {
  say(v.name);
  say(v.short);
  say(v.blurb);
}
for (const l of Object.values(LAYOUTS)) {
  say(l.name);
  say(l.blurb);
}
for (const p of Object.values(PACES)) {
  say(p.name);
  say(p.blurb);
}
for (const h of HATS) say(h.name);
for (const s of STICKERS) {
  say(s.name);
  say(s.how);
}
for (const d of DECOR) {
  say(d.name);
  say(d.blurb);
}

// --- everything said in a shift --------------------------------------------------------------
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

function play(level: number, pace: "cozy" | "classic", roles: Role[]) {
  const g = createGame(level, [], undefined, pace);
  const chefs = roles.map((role, i) => addChef(g, `c${i}`, role, `Chef${i} (${ROLES[role].name.toLowerCase()})`));
  const cool = new Map<string, number>();
  let t = 0;
  while (g.phase === "playing" && t < 600) {
    for (const chef of chefs) {
      chef.chopInput = false;
      const fire = g.stations.find((s) => s.fire);
      if (fire && !chef.held && standAt(g, chef, fire)) {
        chef.chopInput = true;
        continue;
      }
      const guide = guideFor(g, chef);
      say(guide?.next);
      for (const step of guide?.steps ?? []) say(step.text);
      if (Math.round(t * 10) % 50 === 0) say(describeSurroundings(g, chef));
      if (!guide?.target || !standAt(g, chef, guide.target)) continue;
      if (guide.pick !== null) chef.pick = guide.pick;
      const next = guide.next ?? "";
      if (/hold F|wash/i.test(next) && !chef.held) chef.chopInput = true;
      else if (!/watch it|wait/i.test(next) && (cool.get(chef.id) ?? 0) <= t) {
        cool.set(chef.id, t + 0.3);
        interact(g, chef);
      }
    }
    stepWorld(g, 0.1);
    t += 0.1;
    for (const e of g.events.splice(0)) say(e.text);
  }
  // the end screen
  for (const line of shiftReport(g)) say(line.label);
  for (const role of roles) say(nextTimeTip(g, role));
  for (const award of teamAwards(g)) {
    say(award.title);
    say(award.detail);
  }
}

const crews: Role[][] = [["full"], ["deaf", "mute"], ["head", "deaf", "mute"]];
for (const level of [TUTORIAL.n, ...LEVELS.map((l) => l.n)]) {
  for (const pace of ["cozy", "classic"] as const) for (const roles of crews) play(level, pace, roles);
}

// --- translate it all ---------------------------------------------------------------------
const { tr, misses } = makeTranslator(burmese());
const latin = /\b(?!Chef\d)[A-Za-z]{3,}\b/; // English words left over (keys and chef names are fine)
const leftovers: string[] = [];
for (const text of said) {
  const out = tr(text);
  if (latin.test(out.replace(/Chef\d+/g, "").replace(/\b(Shift|Space|Enter|Share|Add to Home Screen|Esc)\b/g, ""))) leftovers.push(`${text}\n    → ${out}`);
}

console.log(`${said.size} different things said; ${misses.size} pieces without Burmese.`);
if (misses.size) {
  console.log("\nNo Burmese for:");
  for (const m of [...misses].sort()) console.log(`  • ${m}`);
}
if (leftovers.length) {
  console.log(`\nStill partly English (${leftovers.length}):`);
  for (const l of leftovers.slice(0, 60)) console.log(`  • ${l}`);
}
process.exit(misses.size || leftovers.length ? 1 : 0);
