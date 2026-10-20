// Pure game state + rules, shared by the browser (solo play and its own chef's movement) and the
// server (authoritative for everything else). No rendering or networking here.
//
// Every event says which senses carry it (sight, sound, touch). "touch" reaches only the chefs in
// `actors`, so each client can present just what its own chef could perceive.
import { KITCHEN, legend, type StationKind } from "./layout";
import { ROLES, type Emote, type Role, type Sense } from "./roles";
import {
  BUMP_COOLDOWN,
  CHEF_RADIUS,
  CHEF_SPEED,
  CHOP_TIME,
  EXPIRED_PENALTY,
  FOOD_RULES,
  MAX_ORDERS,
  MAX_PLATE_ITEMS,
  ORDER_INTERVAL,
  PERFECT_BONUS,
  PERFECT_DELAY,
  PERFECT_WINDOW,
  SOUP_BURN,
  SOUP_INGREDIENTS,
  SOUP_SIZE,
  SOUP_TIME,
  PING_TIME,
  REACH,
  TILE,
  describeFood,
  describeRecipe,
  SICK_PENALTY,
  levelByNumber,
  type FoodState,
  type OrderChannel,
  type Recipe,
  recipeById,
  soupName,
} from "./rules";

export interface Food {
  type: "food";
  id: number;
  kind: string;
  state: FoodState;
  /** 0..1 chopping progress */
  chop: number;
  /** seconds spent on the stove */
  cook: number;
  /** burn warning already given */
  warned: boolean;
  /** "the sizzle peaks" cue already given */
  perfectCued: boolean;
  /** taken off the stove inside the perfect window */
  perfect: boolean;
  /** gone off: mouldy to look at, bad to smell */
  spoiled: boolean;
}

export interface Plate {
  type: "plate";
  id: number;
  contents: Food[];
}

/** A soup bowl: empty, or holding the kinds of vegetables that went into the soup. */
export interface Bowl {
  type: "bowl";
  id: number;
  soup: string[] | null;
  spoiled: boolean;
  perfect: boolean;
}

export type Item = Food | Plate | Bowl;

/** The soup pot never leaves its station; chopped vegetables go in, soup comes out by the bowl. */
export interface Pot {
  contents: Food[];
  /** seconds boiling since it filled up */
  cook: number;
  state: "filling" | "cooking" | "done" | "burnt";
  warned: boolean;
  perfectCued: boolean;
}

export interface Station {
  id: number;
  kind: StationKind;
  crate?: string;
  col: number;
  row: number;
  x: number;
  z: number;
  /** yaw (radians) the station's front faces */
  facing: number;
  item: Item | null;
  /** only on soup pot stations */
  pot?: Pot;
}

export interface Chef {
  id: string;
  name: string;
  role: Role;
  x: number;
  z: number;
  /** yaw in radians; 0 faces +z (towards the back wall) */
  facing: number;
  held: Item | null;
  /** holding the chop key this frame */
  chopInput: boolean;
  chopping: boolean;
  /** id of the chef leading this one by the hand */
  guidedBy: string | null;
  /** last emote, shown above the chef for a moment */
  bubble: { text: string; ttl: number } | null;
  bumpCooldown: number;
  /** where the chef is looking up/down (radians, + is down); others see the head follow it */
  pitch: number;
  /** a short animation others should see: what this chef just did */
  gesture: { kind: Gesture; ttl: number; total: number } | null;
}

/** Body language: actions and emotes as animations everyone can watch. */
export type Gesture =
  | "pickup"
  | "place"
  | "trash"
  | "serve"
  | "give"
  | "receive"
  | "sniff"
  | "ping"
  | "bell"
  | "hand"
  | "yes"
  | "no"
  | "here"
  | "hurry"
  | "stop"
  | "done";

const GESTURE_TIME: Record<Gesture, number> = {
  pickup: 0.4,
  place: 0.4,
  trash: 0.5,
  serve: 0.7,
  give: 0.6,
  receive: 0.6,
  sniff: 1.1,
  ping: 1.0,
  bell: 0.7,
  hand: 0.6,
  yes: 1.2,
  no: 1.2,
  here: 1.4,
  hurry: 1.4,
  stop: 1.4,
  done: 1.6,
};

export function setGesture(chef: Chef, kind: Gesture) {
  chef.gesture = { kind, ttl: GESTURE_TIME[kind], total: GESTURE_TIME[kind] };
}

// Which gesture each kind of event plays on the chef who caused it.
const EVENT_GESTURES: Partial<Record<EventKind, Gesture>> = {
  pickup: "pickup",
  place: "place",
  trash: "trash",
  served: "serve",
  wrong: "serve",
  sick: "serve",
  handoff: "give",
  sniff: "sniff",
  ping: "ping",
  bell: "bell",
  hand: "hand",
};

export interface Order {
  id: number;
  recipe: Recipe;
  timeLeft: number;
  channel: OrderChannel;
  /** impatience cue already given */
  warned: boolean;
}

export interface Ping {
  id: number;
  x: number;
  z: number;
  label: string;
  ttl: number;
}

export type EventKind =
  | "pickup"
  | "place"
  | "handoff"
  | "hand"
  | "chop"
  | "chopped"
  | "cooked"
  | "perfect"
  | "smoking"
  | "burnt"
  | "served"
  | "wrong"
  | "sick"
  | "sniff"
  | "blackout"
  | "storm"
  | "order"
  | "phone"
  | "impatient"
  | "expired"
  | "trash"
  | "invalid"
  | "bump"
  | "ping"
  | "emote"
  | "bell"
  | "over"
  | "info";

export interface GameEvent {
  kind: EventKind;
  /** Spoken/visible message; events without text are cue-only. */
  text?: string;
  /** Which senses carry this event. */
  senses: readonly Sense[];
  /** Chefs who feel it ("touch"): the ones who did it. */
  actors?: string[];
  /** World position of the source, used to place sounds in 3D. */
  x: number;
  z: number;
  urgent?: boolean;
}

export interface Input {
  /** world-space movement direction (any length) */
  moveX: number;
  moveZ: number;
  chop: boolean;
  /** first-person: the chef faces where the camera looks; otherwise it faces where it walks */
  facing?: number;
  /** first-person look up/down */
  pitch?: number;
}

export interface Game {
  cols: number;
  rows: number;
  stations: Station[];
  /** grid[row][col]; rebuilt from `stations` after a network snapshot */
  grid: (Station | null)[][];
  chefs: Chef[];
  orders: Order[];
  pings: Ping[];
  score: number;
  served: number;
  perfects: number;
  timeLeft: number;
  nextOrderIn: number;
  phase: "playing" | "over";
  level: number;
  /** seconds since the round began */
  elapsed: number;
  /** seconds of power cut left: nobody can see */
  blackout: number;
  /** seconds of storm left: nobody can hear */
  storm: number;
  /** how many of the level's events have started */
  eventsFired: number;
  /** Drained by the caller every frame/tick. */
  events: GameEvent[];
  nextId: number;
}

// Sense sets used below.
const FELT: Sense[] = ["touch"]; // only the chef(s) who did it know
const SEEN: Sense[] = ["sight"];
const HEARD: Sense[] = ["sound"];
const SEEN_HEARD: Sense[] = ["sight", "sound"];
const EVERYONE: Sense[] = ["touch", "sight", "sound"];

const SPAWNS = [
  [0, 0],
  [-1.2, -0.6],
  [1.2, -0.6],
  [0, -1.2],
];

// --- grid helpers -------------------------------------------------------------

export const colToX = (g: Game, col: number) => (col - (g.cols - 1) / 2) * TILE;
export const rowToZ = (g: Game, row: number) => ((g.rows - 1) / 2 - row) * TILE;
const xToCol = (g: Game, x: number) => Math.round(x / TILE + (g.cols - 1) / 2);
const zToRow = (g: Game, z: number) => Math.round((g.rows - 1) / 2 - z / TILE);

function inGrid(g: Game, row: number, col: number) {
  return row >= 0 && row < g.rows && col >= 0 && col < g.cols;
}

function stationAt(g: Game, col: number, row: number): Station | null {
  return inGrid(g, row, col) ? g.grid[row][col] : null;
}

/** Rebuild the grid lookup (it is left out of network snapshots). */
export function rebuildGrid(g: Game) {
  g.grid = Array.from({ length: g.rows }, () => Array<Station | null>(g.cols).fill(null));
  for (const s of g.stations) g.grid[s.row][s.col] = s;
}

export function findChef(g: Game, id: string | null | undefined): Chef | undefined {
  return id ? g.chefs.find((c) => c.id === id) : undefined;
}

// --- setup --------------------------------------------------------------------

export function createGame(levelNumber = 1): Game {
  const level = levelByNumber(levelNumber);
  const rows = KITCHEN.length;
  const cols = KITCHEN[0].length;
  const g: Game = {
    cols,
    rows,
    stations: [],
    grid: [],
    chefs: [],
    orders: [],
    pings: [],
    score: 0,
    served: 0,
    perfects: 0,
    timeLeft: level.time,
    nextOrderIn: ORDER_INTERVAL,
    phase: "playing",
    events: [],
    level: level.n,
    elapsed: 0,
    blackout: 0,
    storm: 0,
    eventsFired: 0,
    nextId: 1,
  };

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const entry = legend(KITCHEN[row][col]);
      if (!entry) continue;
      g.stations.push({
        id: g.nextId++,
        kind: entry.kind,
        crate: entry.crate,
        col,
        row,
        x: colToX(g, col),
        z: rowToZ(g, row),
        facing: Math.PI,
        item: null,
      });
    }
  }
  rebuildGrid(g);
  for (const s of g.stations) if (s.kind === "pot") s.pot = emptyPot();

  // Turn every station to face the walkable floor next to it.
  const isFloor = (row: number, col: number) => inGrid(g, row, col) && KITCHEN[row][col] === ".";
  for (const s of g.stations) {
    if (isFloor(s.row + 1, s.col)) s.facing = Math.PI;
    else if (isFloor(s.row - 1, s.col)) s.facing = 0;
    else if (isFloor(s.row, s.col + 1)) s.facing = Math.PI / 2;
    else if (isFloor(s.row, s.col - 1)) s.facing = -Math.PI / 2;
  }

  // two orders to start; on levels with phones, one of each channel so every chef has something to do
  addOrder(g, recipeById(level.recipes[0]), "ticket");
  addOrder(g, recipeById(level.recipes[1]), level.channels.includes("phone") ? "phone" : "ticket");
  return g;
}

export function addChef(g: Game, id: string, role: Role, name = ROLES[role].name): Chef {
  const [x, z] = SPAWNS[g.chefs.length % SPAWNS.length];
  const chef: Chef = {
    id,
    name,
    role,
    x,
    z,
    facing: 0,
    held: null,
    chopInput: false,
    chopping: false,
    guidedBy: null,
    bubble: null,
    bumpCooldown: 0,
    pitch: 0,
    gesture: null,
  };
  g.chefs.push(chef);
  return chef;
}

export function removeChef(g: Game, id: string) {
  g.chefs = g.chefs.filter((c) => c.id !== id);
  for (const c of g.chefs) if (c.guidedBy === id) c.guidedBy = null;
}

// --- descriptions (shared by announcements and the HUD) ---------------------------

export function describeItem(item: Item): string {
  if (item.type === "bowl") return item.soup ? `bowl of ${soupName(item.soup)}` : "empty bowl";
  if (item.type === "food") return describeFood(item.kind, item.state);
  if (item.contents.length === 0) return "empty plate";
  return `plate of ${item.contents.map((f) => describeFood(f.kind, f.state)).join(" and ")}`;
}

export function stationName(s: Station): string {
  switch (s.kind) {
    case "crate":
      return `${s.crate!.toLowerCase()} crate`;
    case "board":
      return "cutting board";
    case "plates":
      return "plate rack";
    case "bowls":
      return "bowl rack";
    case "pot":
      return "soup pot";
    case "serve":
      return "pass";
    case "trash":
      return "bin";
    default:
      return s.kind;
  }
}

/** What a chef can tell by touch and memory; its role decides which orders it knows. */
export function describeSurroundings(g: Game, chef: Chef): string {
  const { sees, hears } = ROLES[chef.role];
  const held = chef.held ? `You are holding ${describeItem(chef.held)}.` : "Your hands are empty.";
  const target = targetStation(g, chef);
  const mate = target ? undefined : chefInFront(g, chef);
  const contents = target?.pot ? ` with ${describePot(target.pot)}` : target?.item ? ` with ${describeItem(target.item)}` : "";
  const facing = target
    ? `In front of you: ${stationName(target)}${contents}.`
    : mate
      ? `In front of you: ${mate.name}.`
      : "Nothing is in front of you.";
  const guide = chef.guidedBy ? ` ${findChef(g, chef.guidedBy)?.name ?? "Someone"} is leading you by the hand.` : "";
  const known = g.orders.filter((o) => (o.channel === "ticket" ? sees : hears));
  const orders = known.length
    ? `Orders you know about: ${known.map((o) => `${o.recipe.name} (${o.channel})`).join("; ")}.`
    : "You don't know of any orders right now.";
  return `${held} ${facing}${guide} ${orders}`;
}

// --- events -------------------------------------------------------------------

function emit(
  g: Game,
  kind: EventKind,
  text: string | undefined,
  at: { x: number; z: number },
  senses: readonly Sense[],
  actors?: string[],
  urgent = false,
) {
  if (text) text = text[0].toUpperCase() + text.slice(1);
  // the chef who did it shows it: a dip to pick up, an arm out to point, a sniff…
  const gesture = EVENT_GESTURES[kind];
  const doer = findChef(g, actors?.[0]);
  if (gesture && doer && !(kind === "hand" && doer.guidedBy)) setGesture(doer, gesture);
  const receiver = kind === "handoff" ? findChef(g, actors?.[1]) : undefined;
  if (receiver) setGesture(receiver, "receive");
  g.events.push({ kind, text, senses, actors, x: at.x, z: at.z, urgent });
}

// --- queries ------------------------------------------------------------------

export function targetStation(g: Game, chef: Chef): Station | null {
  const { x, z, facing } = chef;
  return stationAt(g, xToCol(g, x + Math.sin(facing) * REACH), zToRow(g, z + Math.cos(facing) * REACH));
}

/** Another chef close by and roughly in front of this one. */
export function chefInFront(g: Game, chef: Chef, range = 1.1): Chef | undefined {
  let best: Chef | undefined;
  let bestDist = range;
  for (const other of g.chefs) {
    if (other.id === chef.id) continue;
    const dx = other.x - chef.x;
    const dz = other.z - chef.z;
    const dist = Math.hypot(dx, dz);
    const ahead = (dx * Math.sin(chef.facing) + dz * Math.cos(chef.facing)) / (dist || 1);
    if (dist < bestDist && ahead > 0.55) {
      best = other;
      bestDist = dist;
    }
  }
  return best;
}

function canCook(food: Food): boolean {
  const rule = FOOD_RULES[food.kind];
  return !!rule?.cookFrom && (food.state === rule.cookFrom || food.state === "cooked");
}

export type StovePhase = "cooking" | "cooked" | "perfect" | "smoking";

/** Where food on a stove is in its cook. "perfect" is only ever conveyed by sound. */
export function stovePhase(food: Food): StovePhase | null {
  const rule = FOOD_RULES[food.kind];
  if (!rule?.cookFrom) return null;
  if (food.state === rule.cookFrom) return "cooking";
  if (food.state !== "cooked") return null;
  const over = food.cook - (rule.cookTime ?? 6);
  if (over >= PERFECT_DELAY && over < PERFECT_DELAY + PERFECT_WINDOW) return "perfect";
  return food.warned ? "smoking" : "cooked";
}

function cookHint(food: Food): string {
  const rule = FOOD_RULES[food.kind];
  const name = describeFood(food.kind, food.state);
  if (food.state === "burnt") return `The ${name} is ruined. Throw it in the bin.`;
  if (rule?.cookFrom === "chopped" && food.state === "raw") return `Chop the ${food.kind.toLowerCase()} before cooking it.`;
  return `${name} can't go on the stove.`;
}

// --- movement (runs on the moving chef's own client, or locally in solo play) ---------

function blocked(g: Game, x: number, z: number): boolean {
  const half = TILE / 2;
  const col = xToCol(g, x);
  const row = zToRow(g, z);
  for (let r = row - 1; r <= row + 1; r++) {
    for (let c = col - 1; c <= col + 1; c++) {
      const solid = !inGrid(g, r, c) || g.grid[r][c] !== null;
      if (!solid) continue;
      const cx = colToX(g, c);
      const cz = rowToZ(g, r);
      const nx = Math.max(cx - half, Math.min(x, cx + half));
      const nz = Math.max(cz - half, Math.min(z, cz + half));
      if ((x - nx) ** 2 + (z - nz) ** 2 < CHEF_RADIUS ** 2) return true;
    }
  }
  return false;
}

const GUIDE_GAP = 0.85; // a guided chef walks this far behind its guide
const GUIDE_BREAK = 3.5; // hands slip apart beyond this

export function moveChef(g: Game, chef: Chef, dt: number, input: Input) {
  chef.chopInput = input.chop;
  if (g.phase !== "playing") return;
  if (input.facing !== undefined) chef.facing = input.facing;
  chef.pitch = input.pitch ?? 0;
  chef.bumpCooldown = Math.max(0, chef.bumpCooldown - dt);

  let mx = input.moveX;
  let mz = input.moveZ;
  let speed = CHEF_SPEED;
  // being led by the hand: with no input of your own, you follow your guide
  const guide = findChef(g, chef.guidedBy);
  if (chef.guidedBy && !guide) chef.guidedBy = null;
  if (guide && Math.hypot(mx, mz) < 0.01) {
    const dx = guide.x - chef.x;
    const dz = guide.z - chef.z;
    const dist = Math.hypot(dx, dz);
    if (dist > GUIDE_BREAK) {
      chef.guidedBy = null;
      emit(g, "hand", `You lost ${guide.name}'s hand.`, chef, FELT, [chef.id]);
    } else if (dist > GUIDE_GAP) {
      mx = dx;
      mz = dz;
      speed = CHEF_SPEED * Math.min(1, (dist - GUIDE_GAP) * 3);
      if (input.facing === undefined) chef.facing = Math.atan2(dx, dz);
    }
  }

  const len = Math.hypot(mx, mz);
  if (len < 0.01) return;
  const nx = mx / len;
  const nz = mz / len;
  if (input.facing === undefined && !guide) chef.facing = Math.atan2(nx, nz);
  const step = speed * dt;
  let bumped = false;
  if (!blocked(g, chef.x + nx * step, chef.z)) chef.x += nx * step;
  else bumped ||= Math.abs(nx) > 0.5;
  if (!blocked(g, chef.x, chef.z + nz * step)) chef.z += nz * step;
  else bumped ||= Math.abs(nz) > 0.5;
  if (bumped && chef.bumpCooldown === 0) {
    // you feel the counter you walked into; the thud helps a blind chef map the room
    chef.bumpCooldown = BUMP_COOLDOWN;
    emit(g, "bump", undefined, { x: chef.x + nx * 0.4, z: chef.z + nz * 0.4 }, FELT, [chef.id]);
  }
}

// --- world update (server-authoritative in multiplayer) -------------------------------

export function stepWorld(g: Game, dt: number) {
  if (g.phase !== "playing") return;

  // chopping (hold the chop key, empty hands, facing a board)
  for (const chef of g.chefs) {
    chef.chopping = false;
    if (chef.bubble && (chef.bubble.ttl -= dt) <= 0) chef.bubble = null;
    if (chef.gesture && (chef.gesture.ttl -= dt) <= 0) chef.gesture = null;
    const target = targetStation(g, chef);
    if (!chef.chopInput || chef.held || target?.kind !== "board" || target.item?.type !== "food") continue;
    const food = target.item;
    if (!FOOD_RULES[food.kind]?.chop || food.state !== "raw") continue;
    chef.chopping = true;
    const before = Math.floor(food.chop * 6);
    food.chop = Math.min(1, food.chop + dt / CHOP_TIME);
    if (food.chop >= 1) {
      food.state = "chopped";
      emit(g, "chopped", `${describeFood(food.kind, "chopped")} is ready.`, target, EVERYONE, [chef.id]);
    } else if (Math.floor(food.chop * 6) > before) {
      emit(g, "chop", undefined, target, SEEN_HEARD);
    }
  }

  // stoves
  for (const s of g.stations) {
    if (s.kind !== "stove" || s.item?.type !== "food" || !canCook(s.item)) continue;
    const food = s.item;
    const rule = FOOD_RULES[food.kind];
    const cookTime = rule.cookTime ?? 6;
    const burnTime = rule.burnTime ?? 6;
    const kind = food.kind.toLowerCase();
    food.cook += dt;
    if (food.state !== "cooked" && food.cook >= cookTime) {
      food.state = "cooked";
      // the colour turns golden and the sizzle changes: both senses get it
      emit(g, "cooked", `The ${kind} is cooked. Take it off the stove!`, s, SEEN_HEARD);
    } else if (food.state === "cooked" && !food.perfectCued && food.cook >= cookTime + PERFECT_DELAY) {
      food.perfectCued = true;
      emit(g, "perfect", `The ${kind}'s sizzle peaks. Take it off now for a perfect dish!`, s, HEARD);
    } else if (food.state === "cooked" && !food.warned && food.cook >= cookTime + burnTime * 0.5) {
      food.warned = true;
      emit(g, "smoking", `The ${kind} is smoking. It's about to burn!`, s, SEEN_HEARD, undefined, true);
    } else if (food.state === "cooked" && food.cook >= cookTime + burnTime) {
      food.state = "burnt";
      emit(g, "burnt", `The ${kind} burnt.`, s, SEEN_HEARD, undefined, true);
    }
  }

  // soup pots: boil once full, then a perfect window (heard only), then they boil dry
  for (const s of g.stations) {
    const pot = s.pot;
    if (!pot || (pot.state !== "cooking" && pot.state !== "done")) continue;
    pot.cook += dt;
    const name = soupName(pot.contents.map((f) => f.kind));
    if (pot.state === "cooking" && pot.cook >= SOUP_TIME) {
      pot.state = "done";
      emit(g, "cooked", `The ${name} is ready. Ladle it into a bowl!`, s, SEEN_HEARD);
    } else if (pot.state === "done" && !pot.perfectCued && pot.cook >= SOUP_TIME + PERFECT_DELAY) {
      pot.perfectCued = true;
      emit(g, "perfect", `The ${name} bubbles just right. Ladle it now for a perfect bowl!`, s, HEARD);
    } else if (pot.state === "done" && !pot.warned && pot.cook >= SOUP_TIME + SOUP_BURN * 0.5) {
      pot.warned = true;
      emit(g, "smoking", `The ${name} is boiling dry!`, s, SEEN_HEARD, undefined, true);
    } else if (pot.state === "done" && pot.cook >= SOUP_TIME + SOUP_BURN) {
      pot.state = "burnt";
      emit(g, "burnt", `The ${name} burnt to the bottom of the pot.`, s, SEEN_HEARD, undefined, true);
    }
  }

  // orders (sounds and messages come from the pass)
  const pass = g.stations.find((s) => s.kind === "serve") ?? { x: 0, z: 0 };
  for (const order of [...g.orders]) {
    order.timeLeft -= dt;
    if (!order.warned && order.timeLeft < order.recipe.time * 0.25) {
      order.warned = true;
      // a ticket turns red (seen); a phone customer calls back, sighing (heard)
      const ticket = order.channel === "ticket";
      emit(
        g,
        "impatient",
        ticket ? `The ${order.recipe.name} ticket is running out of time.` : `The phone customer sighs: "Where's my ${order.recipe.name}?"`,
        pass,
        ticket ? SEEN : HEARD,
      );
    }
    if (order.timeLeft <= 0) {
      g.orders.splice(g.orders.indexOf(order), 1);
      g.score = Math.max(0, g.score - EXPIRED_PENALTY);
      emit(g, "expired", `A customer gave up on their ${order.recipe.name}. Minus ${EXPIRED_PENALTY} points.`, pass, SEEN_HEARD, undefined, true);
    }
  }
  g.nextOrderIn -= dt;
  if (g.nextOrderIn <= 0) {
    g.nextOrderIn = ORDER_INTERVAL;
    if (g.orders.length < MAX_ORDERS) addOrder(g);
  }

  // the level's chaos events: a power cut (nobody sees) and a storm (nobody hears)
  g.elapsed += dt;
  const everyone = g.chefs.map((c) => c.id);
  const scripted = levelByNumber(g.level).events;
  const next = scripted[g.eventsFired];
  if (next && g.elapsed >= next.at) {
    g.eventsFired += 1;
    // everyone notices the change itself, whatever their senses: it's felt
    if (next.kind === "blackout") {
      g.blackout = next.duration;
      emit(g, "blackout", "The power cuts out! The kitchen is pitch dark. Your blind chef knows the way.", pass, EVERYONE, everyone, true);
    } else {
      g.storm = next.duration;
      emit(g, "storm", "A storm hits! Thunder drowns out every sound. Watch your deaf chef.", pass, EVERYONE, everyone, true);
    }
  }
  if (g.blackout > 0 && (g.blackout -= dt) <= 0) {
    g.blackout = 0;
    emit(g, "blackout", "The lights flicker back on.", pass, EVERYONE, everyone);
  }
  if (g.storm > 0 && (g.storm -= dt) <= 0) {
    g.storm = 0;
    emit(g, "storm", "The storm passes. You can hear again.", pass, EVERYONE, everyone);
  }

  // pings fade
  for (const p of g.pings) p.ttl -= dt;
  g.pings = g.pings.filter((p) => p.ttl > 0);

  // round timer
  g.timeLeft = Math.max(0, g.timeLeft - dt);
  if (g.timeLeft === 0) {
    g.phase = "over";
    for (const chef of g.chefs) chef.chopping = false;
    const perfect = g.perfects ? `, ${g.perfects} of them perfect` : "";
    emit(g, "over", `Time's up! You served ${g.served} dishes${perfect}, and scored ${g.score} points.`, pass, [...EVERYONE], g.chefs.map((c) => c.id), true);
  }
}

/** Solo play: one client runs everything. */
export function update(g: Game, chef: Chef, dt: number, input: Input) {
  moveChef(g, chef, dt, input);
  stepWorld(g, dt);
}

function addOrder(g: Game, recipe?: Recipe, channel?: OrderChannel) {
  const level = levelByNumber(g.level);
  recipe ??= recipeById(level.recipes[Math.floor(Math.random() * level.recipes.length)]);
  channel ??= level.channels[Math.floor(Math.random() * level.channels.length)];
  g.orders.push({ id: g.nextId++, recipe, timeLeft: recipe.time, channel, warned: false });
  const pass = g.stations.find((s) => s.kind === "serve") ?? { x: 0, z: 0 };
  const items = describeRecipe(recipe);
  if (channel === "ticket") {
    emit(g, "order", `New ticket: ${recipe.name} (${items}).`, pass, SEEN);
  } else {
    // spoken once by the caller: only chefs who can hear ever learn about it
    emit(g, "phone", `Phone order: "Hi! One ${recipe.name} please. That's ${items}."`, pass, HEARD);
  }
}

// --- actions ------------------------------------------------------------------

function newFood(g: Game, kind: string): Food {
  const spoiled = Math.random() < levelByNumber(g.level).spoilChance;
  return { type: "food", id: g.nextId++, kind, state: "raw", chop: 0, cook: 0, warned: false, perfectCued: false, perfect: false, spoiled };
}

/** Taking food off a stove locks in whether it was perfect. */
function liftFrom(station: Station, item: Item) {
  if (station.kind === "stove" && item.type === "food") item.perfect = stovePhase(item) === "perfect";
}

function addToPlate(g: Game, chef: Chef, plate: Plate, food: Food, at: Station): boolean {
  if (plate.contents.length >= MAX_PLATE_ITEMS) {
    emit(g, "invalid", "The plate is full.", at, FELT, [chef.id]);
    return false;
  }
  plate.contents.push(food);
  emit(g, "place", `Added ${describeItem(food)} to the plate.`, at, EVERYONE, [chef.id]);
  return true;
}

function sameDish(recipe: Recipe, dish: Plate | Bowl): boolean {
  if (dish.type === "bowl") {
    if (recipe.vessel !== "bowl" || !dish.soup) return false;
    return recipe.items.map((i) => i.kind).sort().join() === [...dish.soup].sort().join();
  }
  const contents = dish.contents;
  if (recipe.vessel !== "plate" || recipe.items.length !== contents.length) return false;
  const want = recipe.items.map((i) => `${i.kind}:${i.state}`).sort();
  const have = contents.map((f) => `${f.kind}:${f.state}`).sort();
  return want.every((k, i) => k === have[i]);
}

function serve(g: Game, chef: Chef, dish: Plate | Bowl, at: Station) {
  chef.held = null;
  const order = g.orders
    .filter((o) => sameDish(o.recipe, dish))
    .sort((a, b) => a.timeLeft - b.timeLeft)[0];
  if (!order) {
    emit(g, "wrong", `Nobody ordered ${describeItem(dish)}. The dish was wasted.`, at, EVERYONE, [chef.id], true);
    return;
  }
  const bad = dish.type === "bowl" ? (dish.spoiled ? dish.soup! : []) : dish.contents.filter((f) => f.spoiled).map((f) => f.kind);
  if (bad.length) {
    // the customer eats it and gets sick: no points, a penalty, and they leave
    g.orders.splice(g.orders.indexOf(order), 1);
    g.score = Math.max(0, g.score - SICK_PENALTY);
    const what = [...new Set(bad)].map((k) => k.toLowerCase()).join(" and ");
    emit(g, "sick", `A customer got sick from spoiled ${what}! Minus ${SICK_PENALTY} points.`, at, EVERYONE, [chef.id], true);
    return;
  }
  const perfect = dish.type === "bowl" ? (dish.perfect ? ["soup"] : []) : dish.contents.filter((f) => f.perfect).map((f) => f.kind.toLowerCase());
  const bonus = perfect.length * PERFECT_BONUS;
  const points = order.recipe.reward + Math.ceil((order.timeLeft / order.recipe.time) * 10) + bonus;
  g.score += points;
  g.served += 1;
  g.perfects += perfect.length;
  g.orders.splice(g.orders.indexOf(order), 1);
  const praise = perfect.length ? ` Perfect ${perfect.join(" and ")}!` : "";
  emit(g, "served", `Served ${order.recipe.name}!${praise} Plus ${points} points.`, at, EVERYONE, [chef.id]);
  if (g.orders.length === 0) g.nextOrderIn = Math.min(g.nextOrderIn, 2);
}

// --- the soup pot ---------------------------------------------------------------------

function emptyPot(): Pot {
  return { contents: [], cook: 0, state: "filling", warned: false, perfectCued: false };
}

/** Where a pot is in its boil, using the same phases as a pan so audio and bars can share them. */
export function potPhase(pot: Pot): StovePhase | null {
  if (pot.state === "cooking") return "cooking";
  if (pot.state !== "done") return null;
  const over = pot.cook - SOUP_TIME;
  if (over >= PERFECT_DELAY && over < PERFECT_DELAY + PERFECT_WINDOW) return "perfect";
  return pot.warned ? "smoking" : "cooked";
}

export function describePot(pot: Pot): string {
  if (pot.state === "burnt") return "burnt soup";
  if (!pot.contents.length) return "nothing yet";
  const counts = new Map<string, number>();
  for (const f of pot.contents) counts.set(f.kind, (counts.get(f.kind) ?? 0) + 1);
  const list = [...counts].map(([k, n]) => `${n > 1 ? `${n} ` : ""}chopped ${k.toLowerCase()}`).join(", ");
  if (pot.state === "filling") return `${list} (${pot.contents.length} of ${SOUP_SIZE})`;
  return `${soupName(pot.contents.map((f) => f.kind))}${pot.state === "done" ? ", ready" : ", boiling"}`;
}

function usePot(g: Game, chef: Chef, st: Station) {
  const me = [chef.id];
  const pot = st.pot!;
  const held = chef.held;
  if (pot.state === "burnt") {
    if (held) emit(g, "invalid", "The soup burnt. Empty-handed, scrape it out first.", st, FELT, me);
    else {
      st.pot = emptyPot();
      emit(g, "trash", "You scrape the burnt soup out of the pot.", st, EVERYONE, me);
    }
    return;
  }
  if (!held) {
    emit(g, "invalid", `The soup pot has ${describePot(pot)}.`, st, FELT, me);
    return;
  }
  if (held.type === "food") {
    if (pot.state !== "filling") {
      emit(g, "invalid", "The pot is already full.", st, FELT, me);
      return;
    }
    if (!SOUP_INGREDIENTS.includes(held.kind)) {
      emit(g, "invalid", `${held.kind} doesn't go in soup.`, st, FELT, me);
      return;
    }
    if (held.state !== "chopped") {
      emit(g, "invalid", held.state === "raw" ? `Chop the ${held.kind.toLowerCase()} before it goes in the pot.` : "Only chopped vegetables go in the soup.", st, FELT, me);
      return;
    }
    pot.contents.push(held);
    chef.held = null;
    if (pot.contents.length < SOUP_SIZE) {
      emit(g, "place", `Added ${describeItem(held)} to the pot (${pot.contents.length} of ${SOUP_SIZE}).`, st, EVERYONE, me);
    } else {
      pot.state = "cooking";
      pot.cook = 0;
      emit(g, "place", `Added ${describeItem(held)}. The pot is full and starts to boil.`, st, EVERYONE, me);
    }
    return;
  }
  if (held.type === "plate") {
    emit(g, "invalid", "Soup goes in a bowl, not on a plate.", st, FELT, me);
    return;
  }
  if (held.soup) {
    emit(g, "invalid", "That bowl is already full.", st, FELT, me);
    return;
  }
  if (pot.state !== "done") {
    emit(
      g,
      "invalid",
      pot.state === "cooking" ? "The soup is still boiling." : `The pot needs ${SOUP_SIZE - pot.contents.length} more chopped vegetables.`,
      st,
      FELT,
      me,
    );
    return;
  }
  held.soup = pot.contents.map((f) => f.kind);
  held.spoiled = pot.contents.some((f) => f.spoiled);
  held.perfect = potPhase(pot) === "perfect";
  st.pot = emptyPot();
  emit(g, "pickup", `Ladled ${soupName(held.soup)} into the bowl.`, st, EVERYONE, me);
}

/** Pass what you hold to the chef in front of you. */
function handOff(g: Game, chef: Chef, mate: Chef) {
  if (!chef.held) {
    emit(g, "invalid", `${mate.name} is in front of you. You have nothing to give.`, chef, FELT, [chef.id]);
    return;
  }
  if (mate.held) {
    emit(g, "invalid", `${mate.name}'s hands are full.`, chef, FELT, [chef.id]);
    return;
  }
  const item = chef.held;
  mate.held = item;
  chef.held = null;
  emit(g, "handoff", `${chef.name} handed ${describeItem(item)} to ${mate.name}.`, mate, EVERYONE, [chef.id, mate.id]);
}

/** The single "use" button: pick up, put down, combine, serve, bin or hand over. */
export function interact(g: Game, chef: Chef) {
  if (g.phase !== "playing") return;
  const st = targetStation(g, chef);
  if (!st) {
    const mate = chefInFront(g, chef);
    if (mate) handOff(g, chef, mate);
    else emit(g, "invalid", "There's nothing in front of you.", chef, FELT, [chef.id]);
    return;
  }
  const me = [chef.id];
  const held = chef.held;
  const here = stationName(st);

  switch (st.kind) {
    case "crate":
      if (!held) {
        chef.held = newFood(g, st.crate!);
        emit(g, "pickup", `Took a raw ${st.crate!.toLowerCase()}.`, st, EVERYONE, me);
      } else if (held.type === "food" && held.state === "raw" && held.kind === st.crate) {
        chef.held = null;
        emit(g, "place", `Put the ${held.kind.toLowerCase()} back.`, st, EVERYONE, me);
      } else {
        emit(g, "invalid", "Your hands are full.", st, FELT, me);
      }
      return;
    case "plates":
      if (!held) {
        chef.held = { type: "plate", id: g.nextId++, contents: [] };
        emit(g, "pickup", "Took a clean plate.", st, EVERYONE, me);
      } else if (held.type === "plate" && held.contents.length === 0) {
        chef.held = null;
        emit(g, "place", "Put the plate back.", st, EVERYONE, me);
      } else {
        emit(g, "invalid", "Your hands are full.", st, FELT, me);
      }
      return;
    case "bowls":
      if (!held) {
        chef.held = { type: "bowl", id: g.nextId++, soup: null, spoiled: false, perfect: false };
        emit(g, "pickup", "Took a clean bowl.", st, EVERYONE, me);
      } else if (held.type === "bowl" && !held.soup) {
        chef.held = null;
        emit(g, "place", "Put the bowl back.", st, EVERYONE, me);
      } else {
        emit(g, "invalid", "Your hands are full.", st, FELT, me);
      }
      return;
    case "pot":
      usePot(g, chef, st);
      return;
    case "trash":
      if (!held) emit(g, "invalid", "You have nothing to throw away.", st, FELT, me);
      else if (held.type === "plate") {
        if (held.contents.length === 0) emit(g, "invalid", "The plate is already empty.", st, FELT, me);
        else {
          held.contents = [];
          emit(g, "trash", "Emptied the plate into the bin.", st, EVERYONE, me);
        }
      } else if (held.type === "bowl") {
        if (!held.soup) emit(g, "invalid", "The bowl is already empty.", st, FELT, me);
        else {
          held.soup = null;
          held.spoiled = held.perfect = false;
          emit(g, "trash", "Poured the soup away.", st, EVERYONE, me);
        }
      } else {
        chef.held = null;
        emit(g, "trash", `Threw away the ${describeItem(held)}.`, st, EVERYONE, me);
      }
      return;
    case "serve":
      if (!held) emit(g, "invalid", "Bring a plated dish or a bowl of soup here to serve it.", st, FELT, me);
      else if (held.type === "food") emit(g, "invalid", "Put it on a plate first.", st, FELT, me);
      else if (held.type === "plate" && held.contents.length === 0) emit(g, "invalid", "The plate is empty.", st, FELT, me);
      else if (held.type === "bowl" && !held.soup) emit(g, "invalid", "The bowl is empty. Fill it at the soup pot.", st, FELT, me);
      else serve(g, chef, held, st);
      return;
    case "sink":
      emit(g, "invalid", "The sink isn't used yet.", st, FELT, me);
      return;
  }

  // counter, board and stove: surfaces that hold one item
  const onTop = st.item;
  if (!held) {
    if (!onTop) {
      emit(g, "invalid", `The ${here} is empty.`, st, FELT, me);
      return;
    }
    liftFrom(st, onTop);
    st.item = null;
    chef.held = onTop;
    emit(g, "pickup", `Picked up ${describeItem(onTop)}.`, st, EVERYONE, me);
    return;
  }

  if (!onTop) {
    if (st.kind === "stove" && (held.type !== "food" || !canCook(held))) {
      emit(g, "invalid", held.type === "food" ? cookHint(held) : `${held.type === "plate" ? "Plates" : "Bowls"} don't go on the stove.`, st, FELT, me);
      return;
    }
    if (st.kind === "board" && held.type !== "food") {
      emit(g, "invalid", `${held.type === "plate" ? "Plates" : "Bowls"} go on a counter, not the cutting board.`, st, FELT, me);
      return;
    }
    if (st.kind === "stove" && held.type === "food") held.perfect = false;
    st.item = held;
    chef.held = null;
    const cooking = st.kind === "stove" && held.type === "food" && held.state !== "cooked" ? " Cooking…" : "";
    emit(g, "place", `Put ${describeItem(held)} on the ${here}.${cooking}`, st, EVERYONE, me);
    return;
  }

  if (held.type === "plate" && onTop.type === "food") {
    liftFrom(st, onTop);
    if (addToPlate(g, chef, held, onTop, st)) st.item = null;
    return;
  }
  if (held.type === "food" && onTop.type === "plate") {
    if (addToPlate(g, chef, onTop, held, st)) chef.held = null;
    return;
  }
  if ((held.type === "bowl" && onTop.type === "food") || (held.type === "food" && onTop.type === "bowl")) {
    emit(g, "invalid", "Food goes on a plate; bowls are for soup from the pot.", st, FELT, me);
    return;
  }
  emit(g, "invalid", `The ${here} already has ${describeItem(onTop)}.`, st, FELT, me);
}

/** Called when the chop key is first pressed, to explain why nothing happens. */
export function chopHint(g: Game, chef: Chef) {
  if (g.phase !== "playing") return;
  const me = [chef.id];
  const st = targetStation(g, chef);
  if (st?.kind !== "board") {
    emit(g, "invalid", "Face a cutting board to chop.", chef, FELT, me);
    return;
  }
  if (chef.held) {
    emit(g, "invalid", "Put down what you're holding to chop.", st, FELT, me);
    return;
  }
  const food = st.item;
  if (!food) emit(g, "invalid", "Put an ingredient on the board first.", st, FELT, me);
  else if (food.type !== "food") emit(g, "invalid", "You can't chop that.", st, FELT, me);
  else if (food.state !== "raw") emit(g, "invalid", `The ${describeItem(food)} is already done.`, st, FELT, me);
  else if (!FOOD_RULES[food.kind]?.chop) emit(g, "invalid", `${food.kind} doesn't need chopping.`, st, FELT, me);
}

/** Take (or let go of) the hand of the chef in front of you; they follow when you walk. */
export function toggleHand(g: Game, chef: Chef) {
  if (g.phase !== "playing") return;
  if (chef.guidedBy) {
    const guide = findChef(g, chef.guidedBy);
    chef.guidedBy = null;
    emit(g, "hand", `You let go of ${guide?.name ?? "your guide"}'s hand.`, chef, EVERYONE, [chef.id, guide?.id ?? chef.id]);
    return;
  }
  const following = g.chefs.find((c) => c.guidedBy === chef.id);
  if (following) {
    following.guidedBy = null;
    emit(g, "hand", `${chef.name} lets go of ${following.name}'s hand.`, chef, EVERYONE, [chef.id, following.id]);
    return;
  }
  const mate = chefInFront(g, chef, 1.4);
  if (!mate) {
    emit(g, "invalid", "Face a teammate to take their hand.", chef, FELT, [chef.id]);
    return;
  }
  mate.guidedBy = chef.id;
  emit(g, "hand", `${chef.name} takes ${mate.name}'s hand and leads the way.`, mate, EVERYONE, [chef.id, mate.id]);
}

/** Smell what you hold (or what's in front of you). Spoiled food smells off; anyone can sniff. */
export function sniff(g: Game, chef: Chef) {
  if (g.phase !== "playing") return;
  const me = [chef.id];
  const target = targetStation(g, chef);
  const item = chef.held ?? target?.item ?? null;
  if (!item) {
    emit(g, "sniff", "You sniff the air. Nothing to smell up close.", chef, FELT, me);
    return;
  }
  const bad =
    item.type === "bowl"
      ? item.spoiled
        ? ["soup"]
        : []
      : (item.type === "plate" ? item.contents : [item]).filter((f) => f.spoiled).map((f) => f.kind.toLowerCase());
  const text = bad.length ? `Ugh! The ${bad.join(" and ")} smells off. Bin it!` : `The ${describeItem(item)} smells fresh.`;
  emit(g, "sniff", text, chef, FELT, me, bad.length > 0);
}

// --- perception ----------------------------------------------------------------------

/** What a chef can sense right now: their role, minus whatever the power cut or storm takes away. */
export function currentSenses(g: Game, chef: Chef): { sees: boolean; hears: boolean } {
  const r = ROLES[chef.role];
  return { sees: r.sees && g.blackout <= 0, hears: r.hears && g.storm <= 0 };
}

export function perceivesEvent(g: Game, chef: Chef, event: GameEvent): boolean {
  const { sees, hears } = currentSenses(g, chef);
  const felt = event.senses.includes("touch") && (event.actors?.includes(chef.id) ?? false);
  return felt || (sees && event.senses.includes("sight")) || (hears && event.senses.includes("sound"));
}

// --- the mute chef's voice: pings, emotes, the bell ---------------------------------

/** Mark the station in front of you (or the spot ahead). Seen as a marker, heard as a chime. */
export function ping(g: Game, chef: Chef) {
  if (g.phase !== "playing") return;
  const st = targetStation(g, chef);
  const at = st ?? { x: chef.x + Math.sin(chef.facing) * 1.2, z: chef.z + Math.cos(chef.facing) * 1.2 };
  const label = chef.held ? describeItem(chef.held) : "here";
  g.pings.push({ id: g.nextId++, x: at.x, z: at.z, label, ttl: PING_TIME });
  emit(g, "ping", `${chef.name} pings: ${label}${st ? ` at the ${stationName(st)}` : ""}.`, at, SEEN_HEARD, [chef.id]);
}

export function emote(g: Game, chef: Chef, word: Emote) {
  if (g.phase !== "playing") return;
  chef.bubble = { text: word, ttl: 2.5 };
  setGesture(chef, word.toLowerCase() as Gesture);
  emit(g, "emote", `${chef.name} signals: ${word}!`, chef, SEEN_HEARD, [chef.id]);
}

export function ringBell(g: Game, chef: Chef) {
  if (g.phase !== "playing") return;
  emit(g, "bell", "Ding! The bell rings.", chef, HEARD, [chef.id]);
}
