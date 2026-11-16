// Pure game state + rules, shared by the browser (solo play and its own chef's movement) and the
// server (authoritative for everything else). No rendering or networking here.
//
// Every event says which senses carry it (sight, sound, touch). "touch" reaches only the chefs in
// `actors`, so each client can present just what its own chef could perceive.
import { LAYOUTS, legend, type LayoutId, type StationKind } from "./layout";
import { ROLES, type Emote, type Role, type Sense } from "./roles";
import { twistById, type Twist, type TwistId } from "./twists";
import type { ChefLook } from "./looks";
import { addDiner, boosterOut, boosterWanted, dinerGivesUp, dinerPaid, dinerServed, payingDiners, stepDiners, tableNumber, type Diner } from "./diners";
import {
  COLD_LIMIT,
  COLD_WARN,
  SEASON_BONUS,
  SEASON_PENALTY,
  PINCH_BONUS,
  HEAVY_PENALTY,
  PLATING_POINTS,
  CHARM_SECONDS,
  type Pinch,
  SPICE_NAMES,
  seasonedWith,
  spiceList,
  type Spice,
  type SeasonTime,
  seasonTimeOf,
  UPGRADES,
  BUMP_COOLDOWN,
  CHEF_RADIUS,
  CHEF_SPEED,
  CHOP_TIME,
  EXPIRED_PENALTY,
  FOOD_RULES,
  COMBO_MAX,
  COMBO_STEP,
  COMBO_WINDOW,
  OVERTIME_MAX,
  paceOf,
  type Pace,
  starGoals,
  CLEAN_BOWLS,
  CLEAN_PLATES,
  FIRE_AFTER,
  FIRE_PENALTY,
  FIRE_SPREAD,
  SMOTHER_TIME,
  SPILL_RADIUS,
  SPILL_SLOW,
  MOP_TIME,
  hasFires,
  spillsAt,
  hasWashing,
  hasBoosters,
  WASH_TIME,
  KID_CHANCE,
  plainRecipe,
  CRITIC_PATIENCE,
  CRITIC_PENALTY,
  CRITIC_RAVE,
  CRITIC_TIP,
  criticsAt,
  MAX_ORDERS,
  MAX_PLATE_ITEMS,
  ORDER_INTERVAL,
  RUSH_PACE,
  RUSH_PAY,
  RUSH_TIME,
  crewPace,
  hasRush,
  PERFECT_BONUS,
  PERFECT_DELAY,
  PERFECT_WINDOW,
  SOUP_BURN,
  potState,
  displayKind,
  type VenueId,
  SOUP_SIZE,
  SOUP_TIME,
  PING_TIME,
  DASH,
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
  /** seconds a fridge ingredient has spent out of the fridge (raw or chopped) */
  out: number;
  /** "it's been out a while" warning already given */
  warm: boolean;
  /** seasoning on this ingredient, and whether it went on before or after cooking */
  season: { spice: Spice; at: SeasonTime }[];
  /** how each pinch went at the pour meter (missing: "good") */
  pinches?: Partial<Record<Spice, Pinch>>;
}

export interface Plate {
  type: "plate";
  id: number;
  contents: Food[];
  season: Spice[];
  pinches?: Partial<Record<Spice, Pinch>>;
  /** eaten off (or its food wasted): it goes in the sink before it's used again */
  dirty?: boolean;
}

/** A soup bowl: empty, or holding the kinds of vegetables that went into the soup. */
export interface Bowl {
  type: "bowl";
  id: number;
  soup: string[] | null;
  spoiled: boolean;
  perfect: boolean;
  season: Spice[];
  pinches?: Partial<Record<Spice, Pinch>>;
  /** eaten from (or its soup wasted): it goes in the sink before it's used again */
  dirty?: boolean;
}

export type Item = Food | Plate | Bowl;

/** The dirty dish counter's pile: plates and bowls customers left, waiting to go to the sink. */
export interface Returns {
  plates: number;
  bowls: number;
}

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
  /** fridges and spice racks: what's inside, in picking order */
  stock?: string[];
  /** a fuller name ("meat and fish fridge") */
  label?: string;
  col: number;
  row: number;
  x: number;
  z: number;
  /** yaw (radians) the station's front faces */
  facing: number;
  item: Item | null;
  /** only on soup pot stations */
  pot?: Pot;
  /** a sink: how far through scrubbing the next dirty dish (0-1) */
  wash?: number;
  /** a stove: seconds the burnt food on it has been left there */
  charred?: number;
  /** a stove on fire: seconds it has burned (0 or missing: no fire); and how far it's smothered (0-1) */
  fire?: number;
  smother?: number;
  /** the dirty dish counter's pile */
  returns?: Returns;
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
  /** a second plate or bowl on a tray (the mute chef): it slides into the hands once they're free */
  tray?: Item | null;
  /** the dash: seconds of it left, and until the next one */
  dashT?: number;
  dashCd?: number;
  /** holding the chop key this frame */
  chopInput: boolean;
  chopping: boolean;
  /** id of the chef leading this one by the hand */
  guidedBy: string | null;
  /** a spice bottle taken from a rack to season food where it is (instead of carrying anything else) */
  spice?: { spice: Spice; rack: number } | null;
  /** last emote, shown above the chef for a moment */
  bubble: { text: string; ttl: number } | null;
  bumpCooldown: number;
  /** where the chef is looking up/down (radians, + is down); others see the head follow it */
  pitch: number;
  /** a short animation others should see: what this chef just did */
  gesture: { kind: Gesture; ttl: number; total: number } | null;
  /** which item this chef has chosen at a fridge or spice rack (index into its stock) */
  pick: number;
  /** what this chef did this shift, for the awards at the end */
  stats: ChefStats;
  /** a hat and its colour (none: the plain chef) */
  look?: ChefLook;
  /** a helper bot (see bots.ts), and its pause between hand actions */
  bot?: boolean;
  botWait?: number;
}

export interface ChefStats {
  served: number;
  chopped: number;
  /** food taken off the heat at the perfect moment */
  perfect: number;
  /** pings, signs and bells */
  signs: number;
  charms: number;
  /** customers rung up at the till */
  paid: number;
  handoffs: number;
}

const noStats = (): ChefStats => ({ served: 0, chopped: 0, perfect: 0, signs: 0, charms: 0, paid: 0, handoffs: 0 });

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
  | "wave"
  | "hand"
  | "season"
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
  wave: 1.5,
  hand: 0.6,
  season: 0.8,
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
  season: "season",
};

export interface Order {
  id: number;
  recipe: Recipe;
  timeLeft: number;
  channel: OrderChannel;
  /** impatience cue already given */
  warned: boolean;
  /** a food critic: less patient, and a quick, well-seasoned dish earns a rave review (bonus points, a double bill) */
  critic?: boolean;
  /** a kid: the dish with no seasoning at all */
  kid?: boolean;
}

/** Where a shift's points came from and went (the report at the end), and moments worth a sticker. */
export interface Tally {
  /** the dishes' prices */
  dishes: number;
  /** the head chef's presentation points */
  presented: number;
  /** served with time to spare */
  speed: number;
  /** perfect cooking */
  perfect: number;
  /** seasoning: a bonus when just right, less for each mistake */
  seasoning: number;
  /** dishes seasoned just right */
  seasonedRight: number;
  combo: number;
  /** rush hour, the critics' raves, the daily twist */
  extra: number;
  /** customers who gave up waiting, and the points that cost */
  lost: number;
  lostPoints: number;
  /** customers made sick by spoiled food, and the points that cost */
  sick: number;
  sickPoints: number;
  /** dishes nobody ordered */
  wrong: number;
  /** customers who left the till without paying */
  unpaid: number;
  bestCombo: number;
  /** dishes served in rush hour, in a power cut, in a storm */
  rushServed: number;
  darkServed: number;
  stormServed: number;
  /** critics served, and how many of them raved */
  critics: number;
  raves: number;
  /** spoiled food binned before it reached anyone */
  binned: number;
  /** fires, and the points they cost */
  fires: number;
  firePoints: number;
  /** dishes washed, spills mopped */
  washed: number;
  mopped: number;
}

export const noTally = (): Tally => ({
  dishes: 0,
  presented: 0,
  speed: 0,
  perfect: 0,
  seasoning: 0,
  seasonedRight: 0,
  combo: 0,
  extra: 0,
  lost: 0,
  lostPoints: 0,
  sick: 0,
  sickPoints: 0,
  wrong: 0,
  unpaid: 0,
  bestCombo: 0,
  rushServed: 0,
  darkServed: 0,
  stormServed: 0,
  critics: 0,
  raves: 0,
  binned: 0,
  fires: 0,
  firePoints: 0,
  washed: 0,
  mopped: 0,
});

/** Spilled oil: slows anyone walking through it until it's mopped up. */
export interface Spill {
  id: number;
  x: number;
  z: number;
  /** how far it's been mopped (0-1) */
  mop: number;
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
  | "season"
  | "warm"
  | "arrive"
  | "checkout"
  | "paid"
  | "combo"
  | "rush"
  | "critic"
  | "washed"
  | "fire"
  | "spill"
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
  /** dash (Shift), for chefs who can */
  dash?: boolean;
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
  /** customers on the terrace, one per order */
  diners: Diner[];
  /** money taken at the till this shift */
  coins: number;
  /** equipment the restaurant owns (ids from UPGRADES) */
  upgrades: string[];
  pings: Ping[];
  score: number;
  served: number;
  perfects: number;
  /** seconds until the mute chef can charm the customers again */
  charmWait: number;
  /** the most chefs this shift has had: bigger crews get busier kitchens */
  crew: number;
  /** dishes served in a row, each soon after the last; and the seconds left to serve the next */
  combo: number;
  comboLeft: number;
  /** seconds of rush hour left (orders come faster and pay more); it comes once a shift */
  rush: number;
  rushDone: boolean;
  /** a daily special's twist (none on a normal shift) */
  twist?: TwistId;
  /** how fast the shift runs (see PACES): cozy gives more time and a coach on every step */
  pace?: Pace;
  /** clean and dirty plates and bowls, on shifts with washing up (null: the racks never run out) */
  dishes: { plates: number; bowls: number; dirtyPlates: number; dirtyBowls: number } | null;
  /** seconds of overtime played after a 3-star shift (0: none), and the score when it began */
  overtime: number;
  overtimeFrom: number;
  /** puddles of spilled oil on the floor, and when the shift's next spills happen (seconds in) */
  spills: Spill[];
  spillAt: number[];
  /** when the food critics still to come arrive (seconds into the shift) */
  criticAt: number[];
  tally: Tally;
  timeLeft: number;
  nextOrderIn: number;
  phase: "playing" | "over";
  level: number;
  /** the restaurant this shift is at */
  venue: VenueId;
  /** how its kitchen is laid out */
  layout: LayoutId;
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

/** Whether the restaurant owns this upgrade. */
export const hasUpgrade = (g: Game, id: string) => g.upgrades?.includes(id) ?? false;

/** Seconds a cooked food takes to burn (heavy pans and a cozy pace give more leeway). */
export const burnTimeFor = (g: Game, kind: string) => (FOOD_RULES[kind]?.burnTime ?? 6) * (hasUpgrade(g, "pans") ? 1.5 : 1) * paceOf(g).leeway;

/** Seconds a ready soup takes to boil dry. */
export const soupBurnFor = (g: Game) => SOUP_BURN * paceOf(g).leeway;

/** How long the shift lasts before the bell (a cozy pace makes it longer). */
export const shiftTime = (g: Game) => levelByNumber(g.level).time * paceOf(g).time;

/** Most orders open at once: one fewer at a cozy pace, but never under two (the tutorial keeps its one). */
export function maxOrdersFor(g: Game) {
  const most = levelByNumber(g.level).maxOrders ?? MAX_ORDERS;
  return paceOf(g).calm ? Math.max(Math.min(most, 2), most - 1) : most;
}

/** The twist of a daily special, or nothing on a normal shift. */
export const twistOf = (g: Game): Twist | undefined => twistById(g.twist);

/** How long a combo waits for the next dish (a daily twist can stretch it). */
export const comboWindow = (g: Game) => COMBO_WINDOW * (twistOf(g)?.combo ?? 1) * paceOf(g).time;

/** The level's power cuts and storms, with the daily twist's one among them (later in a longer, cozy shift). */
function kitchenEvents(g: Game) {
  const level = levelByNumber(g.level);
  const extra = twistOf(g)?.event;
  const stretch = paceOf(g).time;
  const events = stretch === 1 ? level.events : level.events.map((e) => ({ ...e, at: Math.round(e.at * stretch) }));
  if (!extra) return events;
  return [...events, { ...extra, at: Math.round(extra.at * shiftTime(g)) }].sort((a, b) => a.at - b.at);
}

/**
 * @param upgrades equipment the restaurant has bought (unknown ids are ignored)
 * @param pace how fast the shift runs (the tutorial always keeps its own gentle pace)
 */
export function createGame(levelNumber = 1, upgrades: string[] = [], twist?: TwistId, pace: Pace = "classic"): Game {
  const level = levelByNumber(levelNumber);
  if (level.tutorial) pace = "classic";
  const stretch = paceOf({ pace }).time;
  const layout: LayoutId = level.layout ?? "standard";
  const kitchen = LAYOUTS[layout].grid;
  const rows = kitchen.length;
  const cols = kitchen[0].length;
  const g: Game = {
    cols,
    rows,
    stations: [],
    grid: [],
    chefs: [],
    orders: [],
    diners: [],
    coins: 0,
    upgrades: upgrades.filter((id) => UPGRADES.some((u) => u.id === id)),
    pings: [],
    score: 0,
    served: 0,
    perfects: 0,
    timeLeft: level.time * stretch,
    charmWait: 0,
    crew: 0,
    combo: 0,
    comboLeft: 0,
    rush: 0,
    rushDone: false,
    ...(twistById(twist) ? { twist } : {}),
    pace,
    dishes: hasWashing(level) ? { plates: CLEAN_PLATES, bowls: CLEAN_BOWLS, dirtyPlates: 0, dirtyBowls: 0 } : null,
    overtime: 0,
    overtimeFrom: 0,
    spills: [],
    spillAt: [],
    criticAt: [],
    tally: noTally(),
    nextOrderIn: ORDER_INTERVAL * stretch,
    phase: "playing",
    events: [],
    level: level.n,
    venue: level.venue,
    layout,
    elapsed: 0,
    blackout: 0,
    storm: 0,
    eventsFired: 0,
    nextId: 1,
  };

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const entry = legend(kitchen[row][col], level.venue);
      if (!entry) continue;
      g.stations.push({
        id: g.nextId++,
        kind: entry.kind,
        crate: entry.crate,
        stock: entry.stock,
        label: entry.label,
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
  for (const s of g.stations) if (s.kind === "returns") s.returns = { plates: 0, bowls: 0 };

  // the critics come at a random moment in the middle of the shift, spread out if there are two
  const critics = twistOf(g)?.critics ?? criticsAt(level);
  const spills = paceOf(g).mishaps ? spillsAt(level) : 0;
  const shift = shiftTime(g);
  for (let i = 0; i < spills; i++) g.spillAt.push(Math.round(shift * (0.25 + (0.55 * (i + Math.random())) / spills)));
  for (let i = 0; i < critics; i++) g.criticAt.push(Math.round(shift * (0.2 + (0.5 * (i + Math.random())) / critics)));

  // Turn every station to face the walkable floor next to it.
  const isFloor = (row: number, col: number) => inGrid(g, row, col) && kitchen[row][col] === ".";
  // When more than one side is open floor, face the side that leads into the room (towards its
  // middle), not a nook along the wall.
  const midRow = (rows - 1) / 2;
  const midCol = (cols - 1) / 2;
  for (const s of g.stations) {
    const sides: [number, number, number][] = [
      [1, 0, Math.PI],
      [-1, 0, 0],
      [0, 1, Math.PI / 2],
      [0, -1, -Math.PI / 2],
    ];
    let best = -Infinity;
    for (const [dr, dc, facing] of sides) {
      if (!isFloor(s.row + dr, s.col + dc)) continue;
      const inward = dr * (midRow - s.row) + dc * (midCol - s.col);
      if (inward > best) {
        best = inward;
        s.facing = facing;
      }
    }
  }

  // two orders to start (one in the guided shift, and at a cozy pace); with phones, one of each channel so every chef has something to do
  addOrder(g, recipeById(level.recipes[0]), "ticket");
  if (maxOrdersFor(g) > 1 && !paceOf(g).calm) addOrder(g, recipeById(level.recipes[1] ?? level.recipes[0]), level.channels.includes("phone") ? "phone" : "ticket");
  return g;
}

export function addChef(g: Game, id: string, role: Role, name = ROLES[role].name): Chef {
  const [x, z] = freeSpot(g, ...(SPAWNS[g.chefs.length % SPAWNS.length] as [number, number]));
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
    spice: null,
    bubble: null,
    bumpCooldown: 0,
    pitch: 0,
    gesture: null,
    pick: 0,
    stats: noStats(),
  };
  g.chefs.push(chef);
  g.crew = Math.max(g.crew, g.chefs.length);
  return chef;
}

/** The spawn point, or (when a layout puts a counter there) the nearest open floor nobody stands on. */
function freeSpot(g: Game, x: number, z: number): [number, number] {
  const taken = (cx: number, cz: number) => g.chefs.some((c) => (c.x - cx) ** 2 + (c.z - cz) ** 2 < 0.6 ** 2);
  if (!blocked(g, x, z) && !taken(x, z)) return [x, z];
  let best: [number, number] = [x, z];
  let bestD = Infinity;
  for (let row = 1; row < g.rows - 1; row++) {
    for (let col = 1; col < g.cols - 1; col++) {
      const cx = colToX(g, col);
      const cz = rowToZ(g, row);
      const d = (cx - x) ** 2 + (cz - z) ** 2;
      if (g.grid[row][col] === null && !taken(cx, cz) && d < bestD) {
        best = [cx, cz];
        bestD = d;
      }
    }
  }
  return best;
}

export function removeChef(g: Game, id: string) {
  g.chefs = g.chefs.filter((c) => c.id !== id);
  for (const c of g.chefs) if (c.guidedBy === id) c.guidedBy = null;
}

// --- descriptions (shared by announcements and the HUD) ---------------------------

export function describeItem(item: Item): string {
  if (item.type !== "food" && item.dirty) return `dirty ${item.type}`;
  if (item.type === "bowl") return item.soup ? `bowl of ${soupName(item.soup)}${seasonedWith(item.season)}` : "empty bowl";
  if (item.type === "food") return describeFood(item.kind, item.state) + seasonedWith((item.season ?? []).map((x) => x.spice));
  if (item.contents.length === 0) return "empty plate";
  return `plate of ${item.contents.map((f) => describeFood(f.kind, f.state)).join(" and ")}${seasonedWith(item.season)}`;
}

export function stationName(s: Station): string {
  switch (s.kind) {
    case "crate":
      return `${s.crate!.toLowerCase()} ${FOOD_RULES[s.crate!]?.cold ? "fridge" : "crate"}`;
    case "fridge":
    case "pantry":
    case "spice":
    case "register":
    case "returns":
      return s.label ?? s.kind;
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
  const stock = target?.stock
    ? `, holding ${target.stock.map((k, i) => `${i + 1} ${target.kind === "spice" ? SPICE_NAMES[k as Spice] : k.toLowerCase()}`).join(", ")}. You have ${(target.kind === "spice" ? SPICE_NAMES[pickedItem(target, chef) as Spice] : pickedItem(target, chef)?.toLowerCase()) ?? "nothing"} chosen`
    : "";
  const contents = target?.pot ? ` with ${describePot(target.pot)}` : target?.item ? ` with ${describeItem(target.item)}` : stock;
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
  const st = stationAt(g, xToCol(g, x + Math.sin(facing) * REACH), zToRow(g, z + Math.cos(facing) * REACH));
  return st?.kind === "decor" ? null : st; // scenery is never something you use
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
  // spilled oil: careful steps
  let speed = CHEF_SPEED * ROLES[chef.role].walkRate * (spillUnder(g, chef) ? SPILL_SLOW : 1);
  // the dash: a short burst, then a cooldown
  chef.dashT = Math.max(0, (chef.dashT ?? 0) - dt);
  chef.dashCd = Math.max(0, (chef.dashCd ?? 0) - dt);
  if (input.dash && ROLES[chef.role].dash && !chef.dashCd && Math.hypot(input.moveX, input.moveZ) > 0.01) {
    chef.dashT = DASH.time;
    chef.dashCd = DASH.cooldown;
  }
  if (chef.dashT) speed *= DASH.speed;
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
    // you feel the counter you walked into; the thud says why you stopped
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
    // hands free: the dish on the tray slides into them
    if (!chef.held && !chef.spice && chef.tray) {
      chef.held = chef.tray;
      chef.tray = null;
    }
    if (chef.bubble && (chef.bubble.ttl -= dt) <= 0) chef.bubble = null;
    if (chef.gesture && (chef.gesture.ttl -= dt) <= 0) chef.gesture = null;
    const target = targetStation(g, chef);
    // washing up (hold the chop key at the sink): anyone can, the head chef too
    if (target?.kind === "sink" && chef.chopInput && !chef.held && !chef.spice && g.dishes && g.dishes.dirtyPlates + g.dishes.dirtyBowls > 0) {
      washStep(g, chef, target, dt);
      continue;
    }
    // a fire: anyone can smother it; a puddle: anyone empty-handed can mop it
    if (target?.fire && chef.chopInput) {
      smotherStep(g, target, dt);
      continue;
    }
    const puddle = chef.chopInput && !chef.held && !chef.spice ? spillUnder(g, chef) : undefined;
    if (puddle) {
      puddle.mop += dt / MOP_TIME;
      if (puddle.mop >= 1) {
        g.spills = g.spills.filter((p) => p !== puddle);
        g.tally.mopped += 1;
        emit(g, "spill", "Mopped up the spill.", puddle, SEEN_HEARD, [chef.id]);
      }
      continue;
    }
    if (!ROLES[chef.role].cooks) continue;
    if (!chef.chopInput || chef.held || chef.spice || target?.kind !== "board" || target.item?.type !== "food") continue;
    const food = target.item;
    if (!FOOD_RULES[food.kind]?.chop || food.state !== "raw") continue;
    chef.chopping = true;
    const before = Math.floor(food.chop * 6);
    food.chop = Math.min(1, food.chop + (dt / CHOP_TIME) * (hasUpgrade(g, "knives") ? 1.35 : 1) * ROLES[chef.role].chopRate);
    if (food.chop >= 1) {
      food.state = "chopped";
      chef.stats.chopped += 1;
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
    const burnTime = burnTimeFor(g, food.kind);
    const kind = food.kind.toLowerCase();
    // "the noodles are", "take them off"
    const [is, it] = /s$/.test(kind) ? ["are", "them"] : ["is", "it"];
    food.cook += dt;
    if (food.state !== "cooked" && food.cook >= cookTime) {
      food.state = "cooked";
      // the colour turns golden and the sizzle changes: both senses get it
      emit(g, "cooked", `The ${kind} ${is} cooked. Take ${it} off the stove!`, s, SEEN_HEARD);
    } else if (food.state === "cooked" && !food.perfectCued && food.cook >= cookTime + PERFECT_DELAY) {
      food.perfectCued = true;
      emit(g, "perfect", `The ${kind}${is === "are" ? "'" : "'s"} sizzle peaks. Take ${it} off now for a perfect dish!`, s, HEARD);
      shimmer(g, s, `The ${kind} shimmers golden. Take ${it} off now for a perfect dish!`);
    } else if (food.state === "cooked" && !food.warned && food.cook >= cookTime + burnTime * 0.5) {
      food.warned = true;
      emit(g, "smoking", `The ${kind} ${is} smoking. ${is === "are" ? "They're" : "It's"} about to burn!`, s, SEEN_HEARD, undefined, true);
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
      shimmer(g, s, `The ${name} shimmers golden. Ladle it now for a perfect bowl!`);
    } else if (pot.state === "done" && !pot.warned && pot.cook >= SOUP_TIME + soupBurnFor(g) * 0.5) {
      pot.warned = true;
      emit(g, "smoking", `The ${name} is boiling dry!`, s, SEEN_HEARD, undefined, true);
    } else if (pot.state === "done" && pot.cook >= SOUP_TIME + soupBurnFor(g)) {
      pot.state = "burnt";
      emit(g, "burnt", `The ${name} burnt to the bottom of the pot.`, s, SEEN_HEARD, undefined, true);
    }
  }

  // kitchen mishaps: burnt food left on a stove catches fire, and a fire spreads along the stoves
  if (hasFires(levelByNumber(g.level)) && paceOf(g).mishaps) {
    for (const s of g.stations) {
      if (s.kind !== "stove") continue;
      if (s.fire) {
        s.fire += dt;
        if (s.fire >= FIRE_SPREAD) {
          s.fire = dt;
          const next = g.stations.find((n) => n.kind === "stove" && !n.fire && n.row === s.row && Math.abs(n.col - s.col) === 1);
          if (next) ignite(g, next, "The fire spread to the next stove!");
        }
      } else if (s.item?.type === "food" && s.item.state === "burnt") {
        s.charred = (s.charred ?? 0) + dt;
        if (s.charred >= FIRE_AFTER) ignite(g, s, `The burnt ${s.item.kind.toLowerCase()} caught fire!`);
      } else s.charred = 0;
    }
  }
  if (g.spillAt.length && g.elapsed >= g.spillAt[0]) {
    g.spillAt.shift();
    spillOil(g);
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
      dinerGivesUp(g, order.id);
      const penalty = order.critic ? CRITIC_PENALTY : EXPIRED_PENALTY;
      const before = g.score;
      g.score = Math.max(0, g.score - penalty);
      g.tally.lost += 1;
      g.tally.lostPoints += before - g.score;
      breakCombo(g);
      const text = order.critic
        ? `The food critic walked out on their ${order.recipe.name}! A bad review: minus ${penalty} points.`
        : `A customer gave up on their ${order.recipe.name}. Minus ${penalty} points.`;
      emit(g, "expired", text, pass, SEEN_HEARD, undefined, true);
      if (g.overtime > 0) {
        endShift(g);
        return;
      }
    }
  }
  // a food critic comes in as soon as there's room for their order
  const maxOrders = maxOrdersFor(g);
  if (g.criticAt.length && g.elapsed >= g.criticAt[0] && g.orders.length < maxOrders) {
    g.criticAt.shift();
    addOrder(g, undefined, undefined, true);
  }
  g.nextOrderIn -= dt * (g.rush > 0 ? RUSH_PACE : 1) * (twistOf(g)?.pace ?? 1) * (1 + g.overtime / 40);
  if (g.nextOrderIn <= 0) {
    g.nextOrderIn = ORDER_INTERVAL * crewPace(g.crew) * paceOf(g).time;
    if (g.orders.length < maxOrders) addOrder(g);
  }

  // rush hour: once a shift, from halfway, when no power cut or storm is on and there's time for it
  const level = levelByNumber(g.level);
  const rushTime = Math.round(RUSH_TIME * paceOf(g).time);
  if (!g.rushDone && hasRush(level) && g.elapsed >= shiftTime(g) * 0.45 && !g.blackout && !g.storm && g.timeLeft > rushTime + 10) {
    g.rushDone = true;
    g.rush = rushTime;
    g.nextOrderIn = Math.min(g.nextOrderIn, 1.5);
    emit(g, "rush", `Rush hour! Orders come twice as fast for ${rushTime} seconds, and every dish pays 50% more.`, pass, EVERYONE, g.chefs.map((c) => c.id), true);
  } else if (g.rush > 0 && (g.rush -= dt) <= 0) {
    g.rush = 0;
    emit(g, "rush", "Rush hour is over. Breathe!", pass, EVERYONE, g.chefs.map((c) => c.id));
  }
  // a combo lapses when the next dish doesn't come in time
  if (g.comboLeft > 0 && (g.comboLeft -= dt) <= 0) breakCombo(g);

  // the level's chaos events: a power cut (nobody sees) and a storm (nobody hears)
  g.elapsed += dt;
  const everyone = g.chefs.map((c) => c.id);
  const scripted = kitchenEvents(g);
  const next = scripted[g.eventsFired];
  if (next && g.elapsed >= next.at) {
    g.eventsFired += 1;
    // everyone notices the change itself, whatever their senses: it's felt
    if (next.kind === "blackout") {
      g.blackout = next.duration;
      emit(g, "blackout", "The power cuts out! The kitchen is pitch dark. Talk each other through it.", pass, EVERYONE, everyone, true);
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

  warmUp(g, dt);
  stepDiners(g, dt, (d, what) => {
    const at = { x: d.x, z: d.z };
    const table = `Table ${tableNumber(d.seat)}`;
    // they ask out loud and hold up their card or cash: both the deaf and the hearing chefs can tell
    if (what === "finished") {
      // they take their dirty dish with them to the till (and leave it on the pass); a customer
      // who doesn't stop to pay leaves it to go straight to the sink
      if (d.dish && g.dishes) {
        if (d.bill > 0) d.dish = soiled(d.dish);
        else {
          dirty(g, d.dish);
          d.dish = null;
        }
      }
      return;
    }
    if (what === "at-till") {
      const left = d.dish?.dirty ? leaveOnPass(g, d.dish) : null;
      const dish = d.dish?.type ?? "plate";
      if (d.dish?.dirty) d.dish = null;
      emit(g, "checkout", `${table} is at the till to pay by ${d.pay.toLowerCase()}${left ? `, and left their dirty ${dish} on the ${left.returns ? "dirty dish counter" : "pass"}` : ""}.`, at, SEEN_HEARD);
    }
    else {
      g.tally.unpaid += 1;
      emit(g, "expired", `${table} got tired of waiting at the till and left without paying.`, at, SEEN_HEARD, undefined, true);
    }
  });

  // pings fade
  for (const p of g.pings) p.ttl -= dt;
  g.pings = g.pings.filter((p) => p.ttl > 0);

  // round timer; a 3-star shift goes into overtime instead of ending
  g.charmWait = Math.max(0, g.charmWait - dt);
  if (g.overtime > 0) {
    g.overtime += dt;
    if (g.overtime >= OVERTIME_MAX) endShift(g);
    return;
  }
  g.timeLeft = Math.max(0, g.timeLeft - dt);
  if (g.timeLeft > 0) return;
  if (!level.tutorial && g.score >= starGoals(level, g.crew)[2]) {
    g.overtime = dt;
    g.overtimeFrom = g.score;
    emit(g, "rush", "Three stars! Overtime: keep cooking until a customer gives up. It only gets busier!", pass, EVERYONE, everyone, true);
  } else endShift(g);
}

function endShift(g: Game) {
  const pass = g.stations.find((s) => s.kind === "serve") ?? { x: 0, z: 0 };
  g.phase = "over";
  for (const chef of g.chefs) chef.chopping = false;
  const perfect = g.perfects ? `, ${g.perfects} of them perfect` : "";
  const extra = g.overtime > 0 ? ` Overtime added ${g.score - g.overtimeFrom}.` : "";
  emit(g, "over", `Time's up! You served ${g.served} dishes${perfect}, and scored ${g.score} points.${extra}`, pass, [...EVERYONE], g.chefs.map((c) => c.id), true);
}

/** A little more scrubbing; a plate (or else a bowl) goes back on its rack when it's clean. */
function washStep(g: Game, chef: Chef, sink: Station, dt: number) {
  const dishes = g.dishes!;
  const before = Math.floor((sink.wash ?? 0) * 4);
  sink.wash = (sink.wash ?? 0) + (dt / WASH_TIME) * ROLES[chef.role].washRate;
  if (sink.wash < 1) {
    // a splash now and then while scrubbing
    if (Math.floor(sink.wash * 4) > before) emit(g, "chop", undefined, sink, SEEN_HEARD);
    return;
  }
  sink.wash = 0;
  g.tally.washed += 1;
  const plate = dishes.dirtyPlates > 0;
  if (plate) {
    dishes.dirtyPlates -= 1;
    dishes.plates += 1;
  } else {
    dishes.dirtyBowls -= 1;
    dishes.bowls += 1;
  }
  const left = dishes.dirtyPlates + dishes.dirtyBowls;
  emit(g, "washed", `Washed a ${plate ? "plate" : "bowl"}.${left ? ` ${left} still to wash.` : " All clean!"}`, sink, SEEN_HEARD, [chef.id]);
}

/** A stove catches fire: it can't be used until someone smothers it, and it costs points. */
function ignite(g: Game, s: Station, what: string) {
  s.fire = 0.001; // alight (0 is no fire)
  s.charred = 0;
  s.smother = 0;
  const before = g.score;
  g.score = Math.max(0, g.score - FIRE_PENALTY);
  g.tally.fires += 1;
  g.tally.firePoints += before - g.score;
  // fire is never one sense only: everyone sees the flames and hears the alarm
  emit(g, "fire", `${what} Hold F at the stove to smother it. Minus ${FIRE_PENALTY} points.`, s, SEEN_HEARD, undefined, true);
}
function smotherStep(g: Game, s: Station, dt: number) {
  s.smother = (s.smother ?? 0) + dt / SMOTHER_TIME;
  if (s.smother < 1) return;
  s.fire = 0;
  s.smother = 0;
  s.item = null; // what was burning is ash now
  emit(g, "fire", "The fire's out. The stove is free again.", s, SEEN_HEARD);
}

/** A bottle of oil goes over somewhere on the open floor, away from the chefs. */
function spillOil(g: Game) {
  const spots: { x: number; z: number }[] = [];
  for (let row = 1; row < g.rows - 1; row++) {
    for (let col = 1; col < g.cols - 1; col++) {
      const x = colToX(g, col);
      const z = rowToZ(g, row);
      const clear = g.grid[row][col] === null && !g.chefs.some((c) => (c.x - x) ** 2 + (c.z - z) ** 2 < 1) && !g.spills.some((p) => p.x === x && p.z === z);
      if (clear) spots.push({ x, z });
    }
  }
  const at = spots[Math.floor(Math.random() * spots.length)];
  if (!at) return;
  g.spills.push({ id: g.nextId++, x: at.x, z: at.z, mop: 0 });
  emit(g, "spill", "A bottle of oil smashed on the floor! It's slippery: hold F on the puddle to mop it.", at, SEEN_HEARD, undefined, true);
}

/** The puddle a chef is standing in, if any. */
export function spillUnder(g: Game, chef: { x: number; z: number }): Spill | undefined {
  return g.spills?.find((p) => (p.x - chef.x) ** 2 + (p.z - chef.z) ** 2 < SPILL_RADIUS ** 2);
}

/** A dish comes back to the sink dirty (eaten, or wasted at the pass). */
/** The same plate or bowl, emptied and dirty (it goes back through the sink before it's used again). */
/** The perfect moment, seen: a golden shimmer only chefs with sharp eyes (the deaf chef) can make out. */
function shimmer(g: Game, at: { x: number; z: number }, text: string) {
  const eyes = g.chefs.filter((c) => ROLES[c.role].seesPerfect).map((c) => c.id);
  if (eyes.length) emit(g, "perfect", text, at, FELT, eyes);
}

function soiled(dish: Plate | Bowl): Plate | Bowl {
  return dish.type === "plate"
    ? { type: "plate", id: dish.id, contents: [], season: [], dirty: true }
    : { type: "bowl", id: dish.id, soup: null, spoiled: false, perfect: false, season: [], dirty: true };
}

/**
 * A customer on their way to pay leaves their dirty dish on the pass: on the free counter nearest
 * the till (a chef takes it to the sink). With nowhere free, it goes straight to the sink.
 */
function leaveOnPass(g: Game, dish: Plate | Bowl): Station | null {
  // the dirty dish counter beside the till takes any number (self-service)
  const returns = g.stations.find((s) => s.returns);
  if (returns?.returns) {
    if (dish.type === "plate") returns.returns.plates += 1;
    else returns.returns.bowls += 1;
    return returns;
  }
  const till = g.stations.find((s) => s.kind === "register");
  const passRow = till?.row ?? g.rows - 1;
  const spots = g.stations
    .filter((s) => s.kind === "counter" && s.row === passRow && !s.item)
    .sort((a, b) => Math.abs(a.col - (till?.col ?? 0)) - Math.abs(b.col - (till?.col ?? 0)));
  if (!spots[0]) {
    dirty(g, dish);
    return null;
  }
  spots[0].item = dish;
  return spots[0];
}

function dirty(g: Game, dish: Item) {
  if (!g.dishes || dish.type === "food") return;
  if (dish.type === "plate") g.dishes.dirtyPlates += 1;
  else g.dishes.dirtyBowls += 1;
}

/** Solo play: one client runs everything. */
export function update(g: Game, chef: Chef, dt: number, input: Input) {
  moveChef(g, chef, dt, input);
  stepWorld(g, dt);
}

function addOrder(g: Game, recipe?: Recipe, channel?: OrderChannel, critic = false) {
  const level = levelByNumber(g.level);
  const twist = twistOf(g);
  const menu = level.recipes.slice(0, twist?.menu ?? level.recipes.length);
  recipe ??= recipeById(menu[Math.floor(Math.random() * menu.length)]);
  channel ??= twist?.phones ? (Math.random() < twist.phones ? "phone" : "ticket") : level.channels[Math.floor(Math.random() * level.channels.length)];
  const id = g.nextId++;
  const boosters = hasBoosters(level);
  // booster shifts bring families more often, so the head chef gets a few seats to set out
  const kid = !critic && !level.tutorial && level.n >= 3 && Math.random() < KID_CHANCE * (boosters ? 1.75 : 1);
  if (kid) recipe = plainRecipe(recipe);
  const wait = recipe.time * (level.patience ?? 1) * (twistOf(g)?.patience ?? 1) * paceOf(g).patience * (hasUpgrade(g, "sign") ? 1.25 : 1) * (critic ? CRITIC_PATIENCE : 1);
  g.orders.push({ id, recipe: { ...recipe, time: wait }, timeLeft: wait, channel, warned: false, ...(critic ? { critic } : {}), ...(kid ? { kid } : {}) });
  addDiner(g, id, kid, boosters);
  const pass = g.stations.find((s) => s.kind === "serve") ?? { x: 0, z: 0 };
  if (channel === "ticket") {
    // just the dish: how to make it is in the recipe book
    emit(g, "order", `New ticket: ${recipe.name}${kid ? ", kid's, no seasoning" : ""}.`, pass, SEEN);
  } else {
    const items = describeRecipe(recipe);
    // spoken once by the caller: only chefs who can hear ever learn about it
    const plain = kid ? " It's for my kid, so no seasoning at all, please!" : "";
    emit(g, "phone", `Phone order: "Hi! One ${recipe.name} please. That's ${items}.${plain}"`, pass, HEARD);
  }
  // the terrace door chimes as they come in (a cue, no words)
  emit(g, "arrive", undefined, { x: 0, z: -6.2 }, SEEN_HEARD);
  if (critic) {
    // everyone notices who just walked in, but only the ticket or the call says what they want
    const seat = g.diners.find((d) => d.orderId === id)?.seat;
    const where = seat === undefined ? "" : `, for Table ${tableNumber(seat)}`;
    emit(g, "critic", `A food critic just walked in${where}. Be quick, and season it just right!`, pass, SEEN_HEARD);
  }
}

// --- actions ------------------------------------------------------------------

function newFood(g: Game, kind: string): Food {
  const spoiled = Math.random() < levelByNumber(g.level).spoilChance;
  return { type: "food", id: g.nextId++, kind, state: "raw", chop: 0, cook: 0, warned: false, perfectCued: false, perfect: false, spoiled, out: 0, warm: false, season: [] };
}

/** Taking food off a stove locks in whether it was perfect. */
function liftFrom(station: Station, item: Item, chef: Chef) {
  if (station.kind !== "stove" || item.type !== "food") return;
  item.perfect = stovePhase(item) === "perfect";
  if (item.perfect) chef.stats.perfect += 1;
}

function addToPlate(g: Game, chef: Chef, plate: Plate, food: Food, at: { x: number; z: number }): boolean {
  if (plate.dirty) {
    emit(g, "invalid", "That plate's dirty: wash it at the sink first.", at, FELT, [chef.id]);
    return false;
  }
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

/**
 * The deaf chef's plate check: "ready" if it matches an open order, "track" if everything on it
 * belongs to one (just not finished), "wrong" if no order wants it; null for an empty plate.
 */
export function plateCheck(g: Game, dish: Plate | Bowl): "ready" | "track" | "wrong" | null {
  if (dish.type === "plate" ? !dish.contents.length : !dish.soup) return null;
  if (g.orders.some((o) => sameDish(o.recipe, dish))) return "ready";
  if (dish.type === "bowl") return "wrong";
  const have = dish.contents.map((f) => `${f.kind}:${f.state}`);
  const fits = g.orders.some((o) => {
    if (o.recipe.vessel !== "plate") return false;
    const want = o.recipe.items.map((i) => `${i.kind}:${i.state}`);
    return have.every((k) => {
      const i = want.indexOf(k);
      if (i < 0) return false;
      want.splice(i, 1);
      return true;
    });
  });
  return fits ? "track" : "wrong";
}

/** @param plating how the head chef's plating swirl went (their presentation points) */
function serve(g: Game, chef: Chef, dish: Plate | Bowl, at: Station, plating: Pinch = "good") {
  chef.held = null;
  const order = g.orders
    .filter((o) => sameDish(o.recipe, dish))
    .sort((a, b) => a.timeLeft - b.timeLeft)[0];
  if (!order) {
    breakCombo(g);
    g.tally.wrong += 1;
    // the food is wasted; the plate (now dirty) stays in your hands for the sink
    if (g.dishes) chef.held = soiled(dish);
    emit(g, "wrong", `Nobody ordered ${describeItem(dish)}. The dish was wasted${g.dishes ? ": take the dirty plate to the sink" : ""}.`, at, EVERYONE, [chef.id], true);
    return;
  }
  const bad = dish.type === "bowl" ? (dish.spoiled ? dish.soup! : []) : dish.contents.filter((f) => f.spoiled).map((f) => f.kind);
  if (bad.length) {
    // the customer eats it and gets sick: no points, a penalty, and they leave
    g.orders.splice(g.orders.indexOf(order), 1);
    dinerServed(g, order.id, dish, true);
    const before = g.score;
    g.score = Math.max(0, g.score - SICK_PENALTY);
    g.tally.sick += 1;
    g.tally.sickPoints += before - g.score;
    breakCombo(g);
    const what = [...new Set(bad)].map((k) => k.toLowerCase()).join(" and ");
    emit(g, "sick", `A customer got sick from spoiled ${what}! Minus ${SICK_PENALTY} points.`, at, EVERYONE, [chef.id], true);
    return;
  }
  const perfect = dish.type === "bowl" ? (dish.perfect ? ["soup"] : []) : dish.contents.filter((f) => f.perfect).map((f) => f.kind.toLowerCase());
  const bonus = perfect.length * PERFECT_BONUS;
  const taste = tasteDish(order.recipe, dish);
  const speed = Math.ceil((order.timeLeft / order.recipe.time) * 10);
  // picky eaters: every seasoning mistake costs more; at a cozy pace, slips cost nothing
  const slips = taste.points >= 0 ? taste.points : paceOf(g).forgiving ? 0 : taste.points * (twistOf(g)?.picky ?? 1);
  const seasoning = slips + taste.pinch;
  const earned = Math.max(5, order.recipe.reward + speed + bonus + seasoning);
  // a critic raves about a dish with nothing wrong with its seasoning, served before their ticket turns red
  const rave = !!order.critic && taste.clean && order.timeLeft >= order.recipe.time * 0.25;
  const pay = (g.rush > 0 ? RUSH_PAY : 1) * (twistOf(g)?.pay ?? 1);
  // the head chef's strength: a dish they serve is presented beautifully
  const presented = ROLES[chef.role].presentation ? PLATING_POINTS[plating] : 0;
  const points = Math.round(earned * pay) + (rave ? CRITIC_RAVE : 0) + presented;
  const t = g.tally;
  t.dishes += order.recipe.reward;
  t.speed += speed;
  t.perfect += bonus;
  t.seasoning += seasoning;
  if (taste.clean && taste.points > 0) t.seasonedRight += 1;
  t.presented += presented;
  t.extra += points - (order.recipe.reward + speed + bonus + seasoning + presented);
  if (g.rush > 0) t.rushServed += 1;
  if (g.blackout > 0) t.darkServed += 1;
  if (g.storm > 0) t.stormServed += 1;
  if (order.critic) {
    t.critics += 1;
    if (rave) t.raves += 1;
  }
  g.score += points;
  g.served += 1;
  g.perfects += perfect.length;
  chef.stats.served += 1;
  g.orders.splice(g.orders.indexOf(order), 1);
  dinerServed(g, order.id, dish, false, Math.round(points * (hasUpgrade(g, "tipjar") ? 1.2 : 1) * (rave ? CRITIC_TIP : 1)));
  const praise = perfect.length ? ` Perfect ${perfect.join(" and ")}!` : "";
  const plated = !ROLES[chef.role].presentation ? "" : plating === "perfect" ? " A picture-perfect plate!" : plating === "good" ? " Beautifully presented!" : "";
  emit(g, "served", `Served ${order.recipe.name}!${praise}${taste.note}${plated} Plus ${points} points.`, at, EVERYONE, [chef.id]);
  if (order.critic) {
    const verdict = rave
      ? `A rave review! The critic loved their ${order.recipe.name}: plus ${CRITIC_RAVE} points, and they'll pay double at the till.`
      : `The critic's verdict: "${taste.points < 0 ? "The seasoning was off" : "Tasty, but slow"}." No rave review this time.`;
    emit(g, "critic", verdict, at, EVERYONE, [chef.id]);
  }
  // a combo: the second dish in a row earns COMBO_STEP more, the third twice that...
  g.combo = g.comboLeft > 0 ? g.combo + 1 : 1;
  g.comboLeft = comboWindow(g);
  t.bestCombo = Math.max(t.bestCombo, g.combo);
  if (g.combo >= 2) {
    const extra = Math.min(COMBO_MAX, (g.combo - 1) * COMBO_STEP) * (twistOf(g)?.combo ?? 1);
    g.score += extra;
    t.combo += extra;
    emit(g, "combo", `Combo ×${g.combo}! Plus ${extra} bonus points. Serve the next dish within ${Math.round(g.comboLeft)} seconds to keep it going.`, at, SEEN_HEARD, [chef.id]);
  }
  if (g.orders.length === 0) g.nextOrderIn = Math.min(g.nextOrderIn, 2);
}

/** A combo ends with a lost customer, a wrong or bad dish, or too long a wait between dishes. */
function breakCombo(g: Game) {
  g.combo = 0;
  g.comboLeft = 0;
}

/** The item a chef has chosen at a fridge or spice rack. */
export function pickedItem(st: Station, chef: Chef): string | null {
  const stock = st.stock;
  if (!stock?.length) return null;
  return stock[Math.min(Math.max(0, Math.floor(chef.pick || 0)), stock.length - 1)];
}

/** At the till: take payment from the first customer in line, the way they want to pay. */
function ringUp(g: Game, chef: Chef, st: Station) {
  const me = [chef.id];
  const d = payingDiners(g)[0];
  if (!d) {
    emit(g, "invalid", "Nobody is waiting to pay.", st, FELT, me);
    return;
  }
  const chosen = pickedItem(st, chef);
  const table = `Table ${tableNumber(d.seat)}`;
  if (chosen !== d.pay) {
    emit(g, "invalid", `${table} wants to pay by ${d.pay.toLowerCase()}, not ${chosen?.toLowerCase()}.`, st, [...FELT, "sound"], me);
    return;
  }
  g.coins += d.bill;
  chef.stats.paid += 1;
  emit(g, "paid", `${table} paid ${d.bill} coins by ${d.pay.toLowerCase()}. Thank you!`, st, EVERYONE, me);
  dinerPaid(d);
}

/** Taking from, or putting back into, a fridge or the pantry shelf. */
function useStore(g: Game, chef: Chef, st: Station) {
  const where = st.kind === "fridge" ? "the fridge" : "the pantry";
  const me = [chef.id];
  const held = chef.held;
  if (!held) {
    const kind = pickedItem(st, chef)!;
    chef.held = newFood(g, kind);
    emit(g, "pickup", `Took ${describeFood(kind, "raw").replace(/^raw /, "a raw ")} from ${where}.`, st, EVERYONE, me);
    return;
  }
  if (held.type === "food" && st.stock?.includes(held.kind) && (held.state === "raw" || held.state === "chopped")) {
    chef.held = null;
    emit(g, "place", `Put the ${describeItem(held)} back in ${where}.`, st, EVERYONE, me);
    return;
  }
  emit(g, "invalid", held.type === "food" ? `The ${held.kind.toLowerCase()} doesn't go in ${where}.` : "Your hands are full.", st, FELT, me);
}

/** At a spice rack with free hands: take the chosen bottle, to carry it to the food. */
function takeSpice(g: Game, chef: Chef, st: Station) {
  const me = [chef.id];
  const spice = pickedItem(st, chef) as Spice;
  const name = SPICE_NAMES[spice];
  if (chef.held) {
    const what = chef.held.type === "food" ? `the ${chef.held.kind.toLowerCase()}` : `the ${chef.held.type}`;
    emit(g, "invalid", `Put ${what} down, then bring the ${name} to it.`, st, FELT, me);
    return;
  }
  chef.spice = { spice, rack: st.id };
  emit(g, "pickup", `Took the ${name}. Use it on the food or dish to season it.`, st, EVERYONE, me);
}

/**
 * With a spice bottle in hand: season the food or dish in front of you (on a stove, a board, a
 * counter, or held out by a teammate), or put the bottle back at a rack (or swap it for another).
 */
function useSpice(g: Game, chef: Chef, st: Station | null, pinch: Pinch) {
  const me = [chef.id];
  const { spice } = chef.spice!;
  const name = SPICE_NAMES[spice];
  if (!st) {
    const mate = chefInFront(g, chef);
    if (mate?.held) seasonItem(g, chef, mate.held, mate, pinch);
    else if (mate && !mate.spice) {
      mate.spice = chef.spice;
      chef.spice = null;
      chef.stats.handoffs += 1;
      emit(g, "handoff", `${chef.name} handed the ${name} to ${mate.name}.`, mate, EVERYONE, [chef.id, mate.id]);
    } else emit(g, "invalid", `Use the ${name} on some food or a dish, or put it back on a spice rack.`, chef, FELT, me);
    return;
  }
  if (st.kind === "spice") {
    const chosen = pickedItem(st, chef) as Spice;
    if (chosen === spice || !st.stock?.includes(chosen)) {
      chef.spice = null;
      emit(g, "place", `Put the ${name} back.`, st, EVERYONE, me);
    } else {
      chef.spice = { spice: chosen, rack: st.id };
      emit(g, "pickup", `Swapped the ${name} for the ${SPICE_NAMES[chosen]}.`, st, EVERYONE, me);
    }
    return;
  }
  if (st.fire) {
    emit(g, "invalid", "It's on fire! Put the bottle back and hold F to smother it.", st, FELT, me);
    return;
  }
  if (st.item) seasonItem(g, chef, st.item, st, pinch);
  else emit(g, "invalid", `Nothing here to season. Use the ${name} on some food or a dish, or put it back on a spice rack.`, st, FELT, me);
}

/**
 * Seasoning, the way a cook really does it: on an ingredient (salt the raw steak, salt the fries
 * as they come out of the pan) or as a finishing touch on the plated dish.
 */
function seasonItem(g: Game, chef: Chef, item: Item, at: { x: number; z: number }, pinch: Pinch) {
  const me = [chef.id];
  const spice = chef.spice!.spice;
  const name = SPICE_NAMES[spice];
  /** the words for how the pour went */
  const how = (what: string) =>
    pinch === "perfect" ? `A perfect pinch of ${name} on the ${what}!` : pinch === "heavy" ? `Too much ${name} on the ${what}!` : null;
  if (item.type === "food") {
    if (!ROLES[chef.role].cooks) {
      emit(g, "invalid", "The head chef doesn't season the ingredients: finish the plated dish instead.", at, FELT, me);
      return;
    }
    if (item.state === "burnt") {
      emit(g, "invalid", `No amount of ${name} will save a burnt ${item.kind.toLowerCase()}.`, at, FELT, me);
      return;
    }
    item.season ??= [];
    if (item.season.some((x) => x.spice === spice)) {
      emit(g, "invalid", `The ${item.kind.toLowerCase()} already has ${name}.`, at, FELT, me);
      return;
    }
    const what = describeItem(item);
    item.season.push({ spice, at: seasonTimeOf(item.state) });
    item.pinches = { ...item.pinches, [spice]: pinch };
    emit(g, "season", how(item.kind.toLowerCase()) ?? `Seasoned the ${what} with ${name}.`, at, EVERYONE, me);
    return;
  }
  if (item.type === "plate" ? item.contents.length === 0 : !item.soup) {
    emit(g, "invalid", `Put the food in first, then add ${name}.`, at, FELT, me);
    return;
  }
  if (item.season.includes(spice)) {
    emit(g, "invalid", `It already has ${name}.`, at, FELT, me);
    return;
  }
  const what = describeItem(item);
  item.season.push(spice);
  item.pinches = { ...item.pinches, [spice]: pinch };
  emit(g, "season", how(item.type === "plate" ? "plate" : "bowl") ?? `Finished the ${what} with ${name}.`, at, EVERYONE, me);
}

/**
 * What a spice bottle in hand would season right now (the food or dish in front of you, or held out
 * by a teammate), or null when using it would do something else (swap, put back, hand it over) or
 * nothing. The client starts the pour meter only when there's something to season.
 */
export function seasonTarget(g: Game, chef: Chef): Item | null {
  if (g.phase !== "playing" || !chef.spice) return null;
  const spice = chef.spice.spice;
  const st = targetStation(g, chef);
  const item = st ? (st.kind === "spice" || st.fire ? null : st.item) : (chefInFront(g, chef)?.held ?? null);
  if (!item) return null;
  if (item.type === "food") {
    if (!ROLES[chef.role].cooks || item.state === "burnt" || (item.season ?? []).some((x) => x.spice === spice)) return null;
    return item;
  }
  if (item.type === "plate" ? !item.contents.length : !item.soup) return null;
  return item.season.includes(spice) ? null : item;
}

const TIMING_PENALTY = 3;

/**
 * Customers taste the seasoning: each ingredient seasoned with the right things at the right step
 * (before or after cooking), and the dish finished right. All correct earns a bonus; each mistake
 * costs a little and the customer says what was off.
 */
export function tasteDish(recipe: Recipe, dish: Plate | Bowl): { points: number; note: string; clean: boolean; pinch: number } {
  const notes: string[] = [];
  let points = 0;
  let perfectPinches = 0;
  const lower = (k: string) => k.toLowerCase();
  if (dish.type === "plate") {
    const unused = [...dish.contents];
    for (const want of recipe.items) {
      const i = unused.findIndex((f) => f.kind === want.kind && f.state === want.state);
      if (i < 0) continue;
      const food = unused.splice(i, 1)[0];
      const got = food.season ?? [];
      const wanted = want.season ?? [];
      const missing = wanted.filter((sp) => !got.some((x) => x.spice === sp));
      const extra = got.filter((x) => !wanted.includes(x.spice)).map((x) => x.spice);
      const late = got.filter((x) => wanted.includes(x.spice) && want.seasonAt && x.at !== want.seasonAt).map((x) => x.spice);
      // how each wanted pinch went at the pour meter
      const onTime = got.filter((x) => wanted.includes(x.spice) && !late.includes(x.spice)).map((x) => x.spice);
      perfectPinches += onTime.filter((sp) => food.pinches?.[sp] === "perfect").length;
      const heavy = onTime.filter((sp) => food.pinches?.[sp] === "heavy");
      points -= (missing.length + extra.length) * SEASON_PENALTY + late.length * TIMING_PENALTY + heavy.length * HEAVY_PENALTY;
      if (heavy.length) notes.push(`too much ${spiceList(heavy)} on the ${lower(food.kind)}`);
      if (missing.length) notes.push(`the ${lower(food.kind)} needed ${spiceList(missing)}`);
      if (extra.length) notes.push(`no ${spiceList(extra)} on the ${lower(food.kind)}`);
      if (late.length) notes.push(`${spiceList(late)} ${late.length > 1 ? "go" : "goes"} on the ${lower(food.kind)} ${want.seasonAt === "before" ? "before cooking" : "after cooking"}`);
    }
  }
  const finish = recipe.finish ?? [];
  const missing = finish.filter((sp) => !dish.season.includes(sp));
  const extra = dish.season.filter((sp) => !finish.includes(sp));
  const wantedOn = dish.season.filter((sp) => finish.includes(sp));
  perfectPinches += wantedOn.filter((sp) => dish.pinches?.[sp] === "perfect").length;
  const heavyOn = wantedOn.filter((sp) => dish.pinches?.[sp] === "heavy");
  points -= (missing.length + extra.length) * SEASON_PENALTY + heavyOn.length * HEAVY_PENALTY;
  if (heavyOn.length) notes.push(`too much ${spiceList(heavyOn)} on top`);
  if (missing.length) notes.push(`it needed ${spiceList(missing)} to finish`);
  if (extra.length) notes.push(`they didn't want ${spiceList(extra)} on top`);
  // a perfect pinch earns its bonus even when something else was off
  const pinch = perfectPinches * PINCH_BONUS;
  if (!notes.length) {
    const seasoned = finish.length || recipe.items.some((i) => i.season?.length);
    const praise = perfectPinches ? ` Seasoned just right, ${perfectPinches === 1 ? "with a perfect pinch" : `${perfectPinches} perfect pinches`}!` : " Seasoned just right!";
    return seasoned ? { points: SEASON_BONUS, note: praise, clean: true, pinch } : { points: 0, note: "", clean: true, pinch: 0 };
  }
  const shown = notes.slice(0, 2).join("; ");
  return { points, note: ` ${shown[0].toUpperCase()}${shown.slice(1)}${notes.length > 2 ? "…" : "."}`, clean: false, pinch };
}

/** Every food in play, with whoever is holding it (for cold-food timers). */
function* allFood(g: Game): Generator<{ food: Food; at: { x: number; z: number }; holder: Chef | null; cooking: boolean }> {
  for (const s of g.stations) {
    const item = s.item;
    if (item?.type === "food") yield { food: item, at: s, holder: null, cooking: s.kind === "stove" };
    else if (item?.type === "plate") for (const f of item.contents) yield { food: f, at: s, holder: null, cooking: false };
  }
  for (const c of g.chefs) {
    const item = c.held;
    if (item?.type === "food") yield { food: item, at: c, holder: c, cooking: false };
    else if (item?.type === "plate") for (const f of item.contents) yield { food: f, at: c, holder: c, cooking: false };
  }
}

/** Fridge ingredients left out raw (or chopped) warm up and, eventually, go off. */
function warmUp(g: Game, dt: number) {
  if (!levelByNumber(g.level).coldFood) return; // taught from the breakfast rush onwards
  for (const { food, at, holder, cooking } of allFood(g)) {
    if (!FOOD_RULES[food.kind]?.cold || food.spoiled || cooking) continue;
    if (food.state !== "raw" && food.state !== "chopped") continue;
    food.out = (food.out ?? 0) + dt;
    const kind = food.kind.toLowerCase();
    // you can see it sweating, and whoever holds it can feel it's no longer cold
    const senses: Sense[] = holder ? ["sight", "touch"] : ["sight"];
    const actors = holder ? [holder.id] : undefined;
    const limit = (hasUpgrade(g, "fridge") ? 2 : 1) * paceOf(g).leeway;
    if (food.out >= COLD_LIMIT * limit) {
      food.spoiled = true;
      emit(g, "warm", `The ${kind} sat out of the fridge too long and has gone off. Bin it!`, at, senses, actors, true);
    } else if (!food.warm && food.out >= COLD_WARN * limit) {
      food.warm = true;
      emit(g, "warm", `The ${kind} has been out of the fridge a while. Use it soon or it'll go off.`, at, senses, actors);
    }
  }
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
    const needs = potState(held.kind);
    if (!needs) {
      emit(g, "invalid", `${displayKind(held.kind)} doesn't go in soup.`, st, FELT, me);
      return;
    }
    if (held.state !== needs) {
      emit(g, "invalid", held.state === "raw" ? `Chop the ${displayKind(held.kind).toLowerCase()} before it goes in the pot.` : `The ${displayKind(held.kind).toLowerCase()} goes in ${needs}.`, st, FELT, me);
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
  if (held.dirty) {
    emit(g, "invalid", "That bowl's dirty: wash it at the sink first.", st, FELT, me);
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
  if (chef.held.type === "food" && !ROLES[mate.role].cooks && mate.held?.type !== "plate") {
    emit(g, "invalid", `${mate.name} doesn't handle raw food. Hand it over on a plate.`, chef, FELT, [chef.id]);
    return;
  }
  // food straight onto the plate a teammate is holding out
  if (chef.held.type === "food" && mate.held?.type === "plate") {
    if (addToPlate(g, chef, mate.held, chef.held, mate)) chef.held = null;
    return;
  }
  if (mate.held || mate.spice) {
    emit(g, "invalid", `${mate.name}'s hands are full.`, chef, FELT, [chef.id]);
    return;
  }
  const item = chef.held;
  mate.held = item;
  chef.held = null;
  chef.stats.handoffs += 1;
  emit(g, "handoff", `${chef.name} handed ${describeItem(item)} to ${mate.name}.`, mate, EVERYONE, [chef.id, mate.id]);
}

/** How many spoiled things are in (or are) this item. */
function spoiledIn(item: Item): number {
  if (item.type === "food") return Number(item.spoiled);
  if (item.type === "bowl") return Number(!!item.soup && item.spoiled);
  return item.contents.filter((f) => f.spoiled).length;
}

/** What a head chef would be doing here that's a cook's job (null if it's fine). */
/** Who sets booster seats out: the head chef, or anyone when the kitchen has no head chef (solo, two cooks). */
export function seatsKids(g: Game, chef: Chef): boolean {
  return !ROLES[chef.role].cooks || !g.chefs.some((c) => !c.bot && !ROLES[c.role].cooks);
}

/** Empty-handed at the pass while a kid needs a booster seat: put one out for them to fetch. */
function setOutBooster(g: Game, chef: Chef, st: Station) {
  const kid = boosterWanted(g)!;
  if (!seatsKids(g, chef)) {
    emit(g, "invalid", "The head chef hands out booster seats.", st, FELT, [chef.id]);
    return;
  }
  boosterOut(kid);
  emit(g, "place", `Booster seat out for the kid at Table ${tableNumber(kid.seat)}.`, st, EVERYONE, [chef.id]);
}

function headChefCant(st: Station, held: Item | null): string | null {
  if (st.kind === "crate" || st.kind === "fridge" || st.kind === "pantry") return "fetch the ingredients";
  if (st.kind === "pot") return held?.type === "bowl" ? null : "make the soup";
  if (held?.type === "food") return "take this";
  // empty-handed at a surface with food on it: bring a plate to plate it instead
  if (!held && st.item?.type === "food") return st.kind === "board" ? "chop that" : "handle the food, or bring a plate to plate it";
  return null;
}

/**
 * The single "use" button: pick up, put down, combine, serve, bin or hand over.
 * @param pinch with a spice bottle in hand: how the pour went at the meter
 */
export function interact(g: Game, chef: Chef, pinch: Pinch = "good") {
  if (g.phase !== "playing") return;
  const st = targetStation(g, chef);
  if (chef.spice) {
    useSpice(g, chef, st, pinch);
    return;
  }
  if (!st) {
    const mate = chefInFront(g, chef);
    if (mate) handOff(g, chef, mate);
    else emit(g, "invalid", "There's nothing in front of you.", chef, FELT, [chef.id]);
    return;
  }
  const me = [chef.id];
  const held = chef.held;
  const here = stationName(st);
  if (st.fire) {
    emit(g, "invalid", "It's on fire! Hold F to smother it.", st, FELT, me);
    return;
  }

  // the head chef runs the pass: plates, bowls, finishing and serving, never raw food
  const handsOff = !ROLES[chef.role].cooks ? headChefCant(st, held) : null;
  if (handsOff) {
    emit(g, "invalid", `The head chef doesn't cook. Ask a cook to ${handsOff}.`, st, FELT, me);
    return;
  }

  switch (st.kind) {
    case "crate":
      if (!held) {
        chef.held = newFood(g, st.crate!);
        emit(g, "pickup", `Took a raw ${st.crate!.toLowerCase()}.`, st, EVERYONE, me);
      } else if (held.type === "food" && held.state === "raw" && held.kind === st.crate) {
        chef.held = null;
        emit(g, "place", `Put the ${held.kind.toLowerCase()} back in the ${stationName(st).split(" ").at(-1)}.`, st, EVERYONE, me);
      } else if (held.type === "plate") {
        // a fresh one straight onto the plate (salad leaves, bread…)
        addToPlate(g, chef, held, newFood(g, st.crate!), st);
      } else {
        emit(g, "invalid", "Your hands are full.", st, FELT, me);
      }
      return;
    case "plates":
      if ((!held || held.type === "food") && g.dishes && g.dishes.plates <= 0) {
        emit(g, "invalid", "No clean plates! Wash some at the sink.", st, [...FELT, "sight"], me);
      } else if (!held) {
        if (g.dishes) g.dishes.plates -= 1;
        chef.held = { type: "plate", id: g.nextId++, contents: [], season: [] };
        emit(g, "pickup", "Took a clean plate.", st, EVERYONE, me);
      } else if (held.type === "plate" && held.dirty) {
        emit(g, "invalid", "That plate's dirty: wash it at the sink first.", st, FELT, me);
      } else if (held.type === "plate" && held.contents.length === 0) {
        if (g.dishes) g.dishes.plates += 1;
        chef.held = null;
        emit(g, "place", "Put the plate back.", st, EVERYONE, me);
      } else if (held.type === "food") {
        // food in hand at the rack: take a plate with it already on
        if (g.dishes) g.dishes.plates -= 1;
        chef.held = { type: "plate", id: g.nextId++, contents: [held], season: [] };
        emit(g, "place", `Plated ${describeItem(held)}.`, st, EVERYONE, me);
      } else {
        emit(g, "invalid", "Your hands are full.", st, FELT, me);
      }
      return;
    case "bowls":
      if (!held && g.dishes && g.dishes.bowls <= 0) {
        emit(g, "invalid", "No clean bowls! Wash some at the sink.", st, [...FELT, "sight"], me);
      } else if (!held) {
        if (g.dishes) g.dishes.bowls -= 1;
        chef.held = { type: "bowl", id: g.nextId++, soup: null, spoiled: false, perfect: false, season: [] };
        emit(g, "pickup", "Took a clean bowl.", st, EVERYONE, me);
      } else if (held.type === "bowl" && held.dirty) {
        emit(g, "invalid", "That bowl's dirty: wash it at the sink first.", st, FELT, me);
      } else if (held.type === "bowl" && !held.soup) {
        if (g.dishes) g.dishes.bowls += 1;
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
      if (held) g.tally.binned += spoiledIn(held);
      if (!held) emit(g, "invalid", "You have nothing to throw away.", st, FELT, me);
      else if (held.type === "plate") {
        if (held.contents.length === 0) emit(g, "invalid", "The plate is already empty.", st, FELT, me);
        else {
          held.contents = [];
          held.season = [];
          emit(g, "trash", "Emptied the plate into the bin.", st, EVERYONE, me);
        }
      } else if (held.type === "bowl") {
        if (!held.soup) emit(g, "invalid", "The bowl is already empty.", st, FELT, me);
        else {
          held.soup = null;
          held.spoiled = held.perfect = false;
          held.season = [];
          emit(g, "trash", "Poured the soup away.", st, EVERYONE, me);
        }
      } else {
        chef.held = null;
        emit(g, "trash", `Threw away the ${describeItem(held)}.`, st, EVERYONE, me);
      }
      return;
    case "serve":
      if (!held && boosterWanted(g)) setOutBooster(g, chef, st);
      else if (!held) emit(g, "invalid", "Bring a plated dish or a bowl of soup here to serve it.", st, FELT, me);
      else if (held.type === "food") emit(g, "invalid", "Put it on a plate first.", st, FELT, me);
      else if (held.type === "plate" && held.contents.length === 0) emit(g, "invalid", "The plate is empty.", st, FELT, me);
      else if (held.type === "bowl" && !held.soup) emit(g, "invalid", "The bowl is empty. Fill it at the soup pot.", st, FELT, me);
      else serve(g, chef, held, st, pinch);
      return;
    case "sink":
      if (g.dishes && (held?.type === "plate" || held?.type === "bowl") && held.dirty) {
        dirty(g, held);
        chef.held = null;
        emit(g, "place", `Put the dirty ${held.type} in the sink. Hold F to wash it.`, st, EVERYONE, me);
      } else if (!g.dishes) emit(g, "invalid", "No washing up in this kitchen: there are plenty of clean plates.", st, FELT, me);
      else if (g.dishes.dirtyPlates + g.dishes.dirtyBowls === 0) emit(g, "invalid", "Nothing to wash yet.", st, FELT, me);
      else emit(g, "invalid", "Hold F to wash the dishes.", st, FELT, me);
      return;
    case "spice":
      takeSpice(g, chef, st);
      return;
    case "returns": {
      const pile = st.returns!;
      if (!held) {
        const type = pile.plates > 0 ? "plate" : pile.bowls > 0 ? "bowl" : null;
        if (!type) {
          emit(g, "invalid", "No dirty dishes here yet. Customers leave them here after eating.", st, FELT, me);
          return;
        }
        if (type === "plate") pile.plates -= 1;
        else pile.bowls -= 1;
        chef.held = type === "plate" ? { type, id: g.nextId++, contents: [], season: [], dirty: true } : { type, id: g.nextId++, soup: null, spoiled: false, perfect: false, season: [], dirty: true };
        emit(g, "pickup", `Took a dirty ${type}. Take it to the sink.`, st, EVERYONE, me);
      } else if (held.type !== "food" && held.dirty) {
        if (held.type === "plate") pile.plates += 1;
        else pile.bowls += 1;
        chef.held = null;
        emit(g, "place", `Put the dirty ${held.type} back on the pile.`, st, EVERYONE, me);
      } else emit(g, "invalid", "This counter is for dirty dishes.", st, FELT, me);
      return;
    }
    case "fridge":
    case "pantry":
      useStore(g, chef, st);
      return;
    case "register":
      ringUp(g, chef, st);
      return;
  }

  // counter, board and stove: surfaces that hold one item
  const onTop = st.item;
  if (!held) {
    if (!onTop) {
      emit(g, "invalid", `The ${here} is empty.`, st, FELT, me);
      return;
    }
    liftFrom(st, onTop, chef);
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
    liftFrom(st, onTop, chef);
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
  // the mute chef's tray: a second plate or bowl rides along with the one in hand
  if (ROLES[chef.role].tray && !chef.tray && held.type !== "food" && onTop.type !== "food") {
    liftFrom(st, onTop, chef);
    st.item = null;
    chef.tray = onTop;
    emit(g, "pickup", `Put ${describeItem(onTop)} on your tray: two dishes in one trip.`, st, EVERYONE, me);
    return;
  }
  emit(g, "invalid", `The ${here} already has ${describeItem(onTop)}.`, st, FELT, me);
}

/** Called when the chop key is first pressed, to explain why nothing happens. */
export function chopHint(g: Game, chef: Chef) {
  if (g.phase !== "playing") return;
  const me = [chef.id];
  if (!ROLES[chef.role].cooks) {
    emit(g, "invalid", "The head chef doesn't chop. Ask a cook to.", chef, FELT, me);
    return;
  }
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

const CHARM_COOLDOWN = 35;

/** Mark the station in front of you (or the spot ahead). Seen as a marker, heard as a chime. */
export function ping(g: Game, chef: Chef, aim?: { x: number; z: number }) {
  if (g.phase !== "playing") return;
  // aimed with the crosshair: the station there, or that exact spot
  const st = aim ? stationAt(g, xToCol(g, aim.x), zToRow(g, aim.z)) : targetStation(g, chef);
  const at = st ?? aim ?? { x: chef.x + Math.sin(chef.facing) * 1.2, z: chef.z + Math.cos(chef.facing) * 1.2 };
  // name what you're holding, or else what's on the station you point at, so a sign can name a dish
  const shown = chef.held ?? st?.item ?? null;
  const label = chef.spice ? SPICE_NAMES[chef.spice.spice].toLowerCase() : shown ? describeItem(shown) : "here";
  g.pings.push({ id: g.nextId++, x: at.x, z: at.z, label, ttl: PING_TIME });
  chef.stats.signs += 1;
  emit(g, "ping", `${chef.name} pings: ${label}${st ? ` at the ${stationName(st)}` : ""}.`, at, SEEN_HEARD, [chef.id]);
}

export function emote(g: Game, chef: Chef, word: Emote) {
  if (g.phase !== "playing") return;
  chef.bubble = { text: word, ttl: 2.5 };
  chef.stats.signs += 1;
  setGesture(chef, word.toLowerCase() as Gesture);
  emit(g, "emote", `${chef.name} signals: ${word}!`, chef, SEEN_HEARD, [chef.id]);
}

/** Whether a charm would work right now: a charmer at the pass, with orders waiting and the charm rested. */
export function canCharm(g: Game, chef: Chef): boolean {
  return g.phase === "playing" && ROLES[chef.role].charms && g.charmWait <= 0 && g.orders.length > 0 && targetStation(g, chef)?.kind === "serve";
}

/**
 * Whether Use would serve a finished dish right now (the head chef's plating swirl starts here):
 * at the pass, holding a plate with food or a bowl of soup.
 */
export function servingNow(g: Game, chef: Chef): boolean {
  const held = chef.held;
  if (g.phase !== "playing" || !held || held.type === "food" || held.dirty || chef.spice) return false;
  if (targetStation(g, chef)?.kind !== "serve") return false;
  return held.type === "plate" ? held.contents.length > 0 : !!held.soup;
}

/** @param charm how the mute chef's charm signs went (a miss charms nobody, and there's no wait to try again) */
export function ringBell(g: Game, chef: Chef, charm: Pinch = "good") {
  if (g.phase !== "playing") return;
  // the mute chef's gift: at the pass, a wave to the tables buys every waiting customer time
  if (canCharm(g, chef)) {
    if (charm === "heavy") {
      chef.bubble = { text: "…?", ttl: 1.5 };
      emit(g, "invalid", "The tables didn't follow your signs. Try again!", chef, FELT, [chef.id]);
      return;
    }
    g.charmWait = CHARM_COOLDOWN;
    chef.stats.charms += 1;
    const seconds = CHARM_SECONDS[charm];
    for (const order of g.orders) {
      order.timeLeft = Math.min(order.recipe.time, order.timeLeft + seconds);
      order.warned = false;
    }
    chef.bubble = { text: "Thank you for waiting!", ttl: 2.5 };
    emit(g, "bell", `${chef.name} waves to the tables${charm === "perfect" ? " with a flourish" : ""}. Everyone is happy to wait ${seconds} seconds longer.`, chef, SEEN_HEARD, [chef.id]);
    setGesture(chef, "wave");
    return;
  }
  chef.stats.signs += 1;
  emit(g, "bell", "Ding! The bell rings.", chef, HEARD, [chef.id]);
}
