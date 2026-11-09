// The coach check: a simulated player does whatever the coach says, on every level, at both paces,
// solo, as two cooks, and as a head chef with two cooks. It steps straight to each station rather
// than walking, so it checks the rules and the coach for dead ends, not the balance. It fails on
// any refused action ("you can't do that") or on a chef told the same thing for 25 s with nothing
// changing. Run it with `npm run test:coach`.
import { PACES, LEVELS, TILE, TUTORIAL, addChef, createGame, guideFor, interact, stepWorld, targetStation, type Chef, type Game, type Role, type Station } from "../src/index";

// classic shifts don't coach empty hands; switch the coach on to check it against classic timings too
PACES.classic.coach = true;

/** Stand on the floor next to a station, facing it. */
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
  const chefs = roles.map((role, i) => addChef(g, `c${i}`, role, `Chef${i} (${role})`));
  const problems = new Map<string, number>();
  const note = (text: string) => problems.set(text, (problems.get(text) ?? 0) + 1);
  const cool = new Map<string, number>();
  const same = new Map<string, { key: string; since: number }>();
  let served = 0;
  let t = 0;
  while (g.phase === "playing" && t < 900) {
    for (const chef of chefs) {
      chef.chopInput = false;
      const fire = g.stations.find((s) => s.fire);
      if (fire && !chef.held && standAt(g, chef, fire)) {
        chef.chopInput = true;
        continue;
      }
      const guide = guideFor(g, chef);
      const key = `${guide?.next}|${JSON.stringify(chef.held)}`;
      const was = same.get(chef.id);
      if (was?.key !== key) same.set(chef.id, { key, since: t });
      else if (t - was.since > 25 && guide?.next && !/watch it|wait|Ask a cook|boiling|on the go/.test(guide.next)) {
        note(`stuck (${chef.role}): ${guide.next}`);
        was.since = t;
      }
      if (!guide?.target) continue;
      if (!standAt(g, chef, guide.target)) {
        note(`can't reach the ${guide.target.kind}`);
        continue;
      }
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
    for (const e of g.events.splice(0)) {
      if (e.kind === "served") served++;
      // smothering a fire and moving through the oil are the simulation's shortcuts, not the coach's
      else if ((e.kind === "invalid" || e.kind === "wasted") && !/fire|smother/i.test(e.text)) note(e.text);
    }
  }
  return { served, problems };
}

const crews: [string, Role[]][] = [
  ["solo", ["full"]],
  ["two cooks", ["deaf", "mute"]],
  ["head chef + two cooks", ["head", "deaf", "mute"]],
];
let failed = 0;
for (const level of [TUTORIAL.n, ...LEVELS.map((l) => l.n)]) {
  for (const pace of ["cozy", "classic"] as const) {
    for (const [name, roles] of crews) {
      const { served, problems } = play(level, pace, roles);
      const bad = [...problems];
      const label = `level ${level}, ${pace}, ${name}: ${served} served`;
      if (!bad.length && served > 0) continue;
      failed++;
      console.log(`✗ ${label}`);
      for (const [text, n] of bad.slice(0, 5)) console.log(`    ${n}× ${text}`);
    }
  }
}
console.log(failed ? `${failed} shifts had problems` : "Every shift played through: no refused actions, no loops.");
process.exit(failed ? 1 : 0);
