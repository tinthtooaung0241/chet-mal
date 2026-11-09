// Helper bots: a kitchen porter that fills an empty seat, solo or online. It does the support
// jobs first (smother a fire, mop a spill, bring dirty dishes in from the pass, wash up) and otherwise keeps the boards stocked: it
// fetches an ingredient an order needs, chops it and leaves it on the board for the cooks. It
// never plates, cooks or serves, so the real chefs still run the kitchen.
import { FOOD_RULES, TILE } from "./rules";
import { addChef, colToX, interact, moveChef, rowToZ, spillUnder, type Chef, type Game, type Input, type Station } from "./state";

type Cell = [row: number, col: number];

const colOf = (g: Game, x: number) => Math.round(x / TILE + (g.cols - 1) / 2);
const rowOf = (g: Game, z: number) => Math.round((g.rows - 1) / 2 - z / TILE);
const floor = (g: Game, [r, c]: Cell) => r >= 0 && r < g.rows && c >= 0 && c < g.cols && g.grid[r][c] === null;
const SIDES: Cell[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/** A porter joins the kitchen. It doesn't count towards the crew (it can't take orders or cook). */
export function addBot(g: Game, n = 1): Chef {
  const bot = addChef(g, `bot-${n}`, "full", "Porter (bot)");
  bot.bot = true;
  g.crew = g.chefs.filter((c) => !c.bot).length;
  return bot;
}

/** Shortest walk over open floor from one cell to any of the goal cells (empty if there's none). */
function path(g: Game, from: Cell, goals: Cell[]): Cell[] | null {
  const key = ([r, c]: Cell) => r * 100 + c;
  const want = new Set(goals.map(key));
  const came = new Map<number, number>([[key(from), -1]]);
  const queue: Cell[] = [from];
  while (queue.length) {
    const cell = queue.shift()!;
    if (want.has(key(cell))) {
      const out: Cell[] = [];
      for (let k = key(cell); k !== -1; k = came.get(k)!) out.unshift([Math.floor(k / 100), k % 100]);
      return out;
    }
    for (const [dr, dc] of SIDES) {
      const next: Cell = [cell[0] + dr, cell[1] + dc];
      if (!floor(g, next) || came.has(key(next))) continue;
      came.set(key(next), key(cell));
      queue.push(next);
    }
  }
  return null;
}

/** Open floor cells next to a station, where a chef can stand to use it. */
const besides = (g: Game, s: Station): Cell[] => SIDES.map(([dr, dc]): Cell => [s.row + dr, s.col + dc]).filter((cell) => floor(g, cell));

/** What the bot is after this moment: where to stand, what to face, and what to do there. */
interface Goal {
  cells: Cell[];
  /** the stations it could use (it faces whichever one is beside where it stands) */
  face?: Station[];
  /** hold the chop key there (chop, wash, smother, mop) or press use once (take, put down) */
  hold?: boolean;
  use?: () => void;
}

/** Ingredients the open orders need chopped that nobody has out yet, in order. */
function wanted(g: Game): string[] {
  const out = new Set<string>();
  const outThere = new Set<string>();
  for (const s of g.stations) if (s.item?.type === "food" && s.item.state !== "cooked" && s.item.state !== "burnt") outThere.add(s.item.kind);
  for (const c of g.chefs) if (c.held?.type === "food") outThere.add(c.held.kind);
  for (const o of g.orders) {
    for (const item of o.recipe.items) {
      const rule = FOOD_RULES[item.kind];
      const chopped = item.state === "chopped" || (item.state === "cooked" && rule?.cookFrom === "chopped");
      if (rule?.chop && chopped && !outThere.has(item.kind)) out.add(item.kind);
    }
  }
  return [...out];
}

function goalFor(g: Game, bot: Chef): Goal | null {
  const held = bot.held;
  // 1. fires, 2. spills, 3. a pile of washing up
  const fire = g.stations.find((s) => s.fire);
  if (fire) return { cells: besides(g, fire), face: [fire], hold: true };
  const spill = !held && g.spills[0];
  if (spill) return { cells: [[rowOf(g, spill.z), colOf(g, spill.x)]], hold: true };
  // dirty dishes customers left on the pass: carry them to the sink
  if (held && held.type !== "food" && held.dirty) {
    const sink = g.stations.find((s) => s.kind === "sink" && besides(g, s).length);
    return sink ? { cells: besides(g, sink), face: [sink], use: () => interact(g, bot) } : null;
  }
  const returned = !held ? g.stations.find((s) => (s.item?.type === "plate" || s.item?.type === "bowl") && !!s.item.dirty && besides(g, s).length) : undefined;
  if (returned) return { cells: besides(g, returned), face: [returned], use: () => interact(g, bot) };
  if (!held && g.dishes && g.dishes.dirtyPlates + g.dishes.dirtyBowls >= 2) {
    const sinks = g.stations.filter((s) => s.kind === "sink" && besides(g, s).length);
    if (sinks.length) return { cells: sinks.flatMap((s) => besides(g, s)), face: sinks, hold: true };
  }
  // 4. the boards: bin anything mouldy, put a fetched ingredient on a free board, chop it
  if (held?.type === "food") {
    const rule = FOOD_RULES[held.kind];
    const target = held.spoiled || !rule?.chop || held.state !== "raw" ? g.stations.find((s) => s.kind === "trash") : g.stations.find((s) => s.kind === "board" && !s.item);
    return target ? { cells: besides(g, target), face: [target], use: () => interact(g, bot) } : null;
  }
  if (held) return null; // a plate or bowl in hand: not a porter's job (it shouldn't happen)
  const board = g.stations.find((s) => s.kind === "board" && s.item?.type === "food" && s.item.state === "raw" && FOOD_RULES[s.item.kind]?.chop && !s.item.spoiled);
  if (board) return { cells: besides(g, board), face: [board], hold: true };
  if (!g.stations.some((s) => s.kind === "board" && !s.item)) return null;
  for (const kind of wanted(g)) {
    const store = g.stations.find((s) => s.crate === kind || s.stock?.includes(kind));
    if (!store || !besides(g, store).length) continue;
    return {
      cells: besides(g, store),
      face: [store],
      use: () => {
        if (store.stock) bot.pick = store.stock.indexOf(kind);
        interact(g, bot);
      },
    };
  }
  return null;
}

/** One step for every bot: walk towards its goal, then do the job there. */
export function stepBots(g: Game, dt: number) {
  if (g.phase !== "playing") return;
  for (const bot of g.chefs) {
    if (!bot.bot) continue;
    const input: Input = { moveX: 0, moveZ: 0, chop: false };
    const goal = goalFor(g, bot);
    const here: Cell = [rowOf(g, bot.z), colOf(g, bot.x)];
    const route = goal && goal.cells.length ? path(g, here, goal.cells) : null;
    if (goal && route) {
      // aim for the next cell's centre (or this one's, once we're there)
      const [r, c] = route[1] ?? route[0];
      const dx = colToX(g, c) - bot.x;
      const dz = rowToZ(g, r) - bot.z;
      const arrived = route.length === 1 && Math.hypot(dx, dz) < 0.12;
      if (!arrived) {
        input.moveX = dx;
        input.moveZ = dz;
      } else {
        const face = goal.face?.find((st) => Math.abs(st.row - here[0]) + Math.abs(st.col - here[1]) === 1);
        if (face) input.facing = Math.atan2(face.x - bot.x, face.z - bot.z);
        input.chop = !!goal.hold;
        bot.botWait = (bot.botWait ?? 0) - dt;
        if (goal.use && bot.botWait <= 0) {
          moveChef(g, bot, dt, input); // turn to face it first
          goal.use();
          bot.botWait = 0.4; // a short beat between hand actions, like a person
          continue;
        }
      }
    }
    // standing in a puddle with empty hands is how mopping works
    if (!goal?.face && !bot.held && spillUnder(g, bot)) input.chop = true;
    moveChef(g, bot, dt, input);
  }
}
