// Customers on the dining terrace. Each order brings a diner who walks in, sits at a table and
// waits. When their dish is served at the pass they walk over, collect it, carry it back and
// eat; if their order runs out they storm off. Pure state, stepped with the world, so every
// player sees the same diners. Seats and walking lanes match the terrace in Kitchen_Room.glb.
import { PAY_WAIT, paceOf, type Payment } from "./rules";
import type { Bowl, Game, Plate } from "./state";

type Point = [number, number];

/** Where diners appear (the steps up to the terrace) and the crossroads behind the tables. */
const ENTRANCE: Point = [0, -6.6];
const HUB: Point = [0, -5.8];
/** the aisle along the kitchen wall, in front of the pass */
const FRONT = -3.2;

interface Seat {
  x: number;
  z: number;
  /** the table this chair faces */
  table: Point;
  /** waypoints from the hub to the chair (the chair itself is the last stop) */
  route: Point[];
}

const seat = (x: number, z: number, table: Point, route: Point[]): Seat => ({ x, z, table, route: [...route, [x, z]] });

const T1: Point = [-1.15, -4.8];
const T2: Point = [3.4, -4.8];
const T3: Point = [-3.4, -4.3];
const T4: Point = [1.15, -4.3];

export const SEATS: Seat[] = [
  seat(-1.15, -5.42, T1, [HUB, [-1.15, -5.8]]),
  seat(-1.15, -4.18, T1, [HUB, [0, FRONT], [-1.15, FRONT]]),
  seat(-1.77, -4.8, T1, [HUB, [-2.45, -5.8], [-2.45, -4.8]]),
  seat(-0.53, -4.8, T1, [HUB, [0, -4.8]]),
  seat(3.4, -5.42, T2, [HUB, [3.4, -5.8]]),
  seat(3.4, -4.18, T2, [HUB, [0, FRONT], [3.4, FRONT]]),
  seat(2.78, -4.8, T2, [HUB, [2.25, -5.8], [2.25, -4.8]]),
  seat(4.02, -4.8, T2, [HUB, [4.45, -5.8], [4.45, -4.8]]),
  seat(-3.4, -4.92, T3, [HUB, [-3.4, -5.8]]),
  seat(-3.4, -3.68, T3, [HUB, [0, FRONT], [-3.4, FRONT]]),
  seat(1.15, -4.92, T4, [HUB, [1.15, -5.8]]),
  seat(1.15, -3.68, T4, [HUB, [0, FRONT], [1.15, FRONT]]),
];

/** How many different diner characters there are (Diner_A, Diner_B, ...). */
export const DINER_LOOKS = 4;
const SPEED = 1.3;
const STORM_OFF_SPEED = 1.9;
const EAT_TIME = 9;

export type DinerState = "arriving" | "waiting" | "fetching" | "returning" | "eating" | "checkout" | "paying" | "leaving";

export interface Diner {
  id: number;
  orderId: number;
  seat: number;
  /** which character model */
  look: number;
  x: number;
  z: number;
  facing: number;
  state: DinerState;
  /** waypoints still to walk */
  path: Point[];
  timer: number;
  /** their dish once it's been served: waiting on the pass, carried, then on the table */
  dish: Plate | Bowl | null;
  mood: "happy" | "angry" | "sick" | null;
  /** where they collect from at the pass */
  pickup: Point;
  /** how they'll pay at the till, and how much (set when their dish is served) */
  pay: Payment;
  bill: number;
  /** their place in the queue at the till */
  slot: number;
  /** a kid (drawn smaller) */
  kid?: boolean;
}

/** Tables on the terrace, numbered left to right (as on the tickets). */
const TABLES = [...new Set(SEATS.map((s) => s.table.join()))].sort((a, b) => Number(a.split(",")[0]) - Number(b.split(",")[0]));
export const tableNumber = (seat: number) => TABLES.indexOf(SEATS[seat].table.join()) + 1;

/** Places to stand in line at the till, along the front aisle. */
const TILL_SLOTS = [0, 0.6, -0.6, 1.2];

const seatOf = (d: Diner) => SEATS[d.seat];

function facingTo(fromX: number, fromZ: number, [x, z]: Point) {
  return Math.atan2(x - fromX, z - fromZ);
}

/** From the chair to the pass: back along the chair's route until a lane that reaches the front aisle. */
function seatToPass(s: Seat, pickup: Point): Point[] {
  const back = s.route.slice(0, -1).reverse();
  const path: Point[] = [];
  for (const p of back) {
    path.push(p);
    if (p[1] === FRONT || p[0] === 0) break;
  }
  const last = path.at(-1)!;
  if (last[1] !== FRONT) path.push([0, FRONT]);
  path.push(pickup);
  return path;
}

function passToSeat(s: Seat, pickup: Point): Point[] {
  return [...seatToPass(s, pickup).slice(0, -1).reverse(), [s.x, s.z]];
}

function seatToExit(s: Seat): Point[] {
  return [...s.route.slice(0, -1).reverse(), ENTRANCE];
}

/** A new order brings a customer to a free chair (none if the terrace is full). */
export function addDiner(g: Game, orderId: number, kid = false) {
  const taken = new Set(g.diners.map((d) => d.seat));
  const free = SEATS.map((_, i) => i).filter((i) => !taken.has(i));
  if (!free.length) return;
  const seatIndex = free[Math.floor(Math.random() * free.length)];
  const passes = g.stations.filter((s) => s.kind === "serve");
  const counter = passes.length ? passes[orderId % passes.length] : { x: 0 };
  g.diners.push({
    id: g.nextId++,
    orderId,
    seat: seatIndex,
    look: Math.floor(Math.random() * DINER_LOOKS),
    x: ENTRANCE[0],
    z: ENTRANCE[1],
    facing: 0,
    state: "arriving",
    path: [...SEATS[seatIndex].route],
    timer: 0,
    dish: null,
    mood: null,
    pickup: [counter.x, FRONT],
    pay: Math.random() < 0.5 ? "Cash" : "Card",
    bill: 0,
    slot: 0,
    ...(kid ? { kid } : {}),
  });
}

/** Their dish went out: they come to the pass for it (a spoiled dish still gets eaten...). */
/** @param bill what they'll pay at the till (nothing if it made them sick) */
export function dinerServed(g: Game, orderId: number, dish: Plate | Bowl, sick: boolean, bill = 0) {
  const d = g.diners.find((x) => x.orderId === orderId);
  if (!d) return;
  d.bill = sick ? 0 : bill;
  d.dish = structuredClone(dish);
  d.mood = sick ? "sick" : "happy";
  if (d.state === "waiting") startFetching(d);
  // still on their way in: they fetch it as soon as they reach the chair
}

/** Waited too long: up and off, fast. */
export function dinerGivesUp(g: Game, orderId: number) {
  const d = g.diners.find((x) => x.orderId === orderId);
  if (!d) return;
  const seated = d.state === "waiting";
  d.mood = "angry";
  d.dish = null;
  d.state = "leaving";
  d.path = seated ? seatToExit(seatOf(d)) : [HUB, ENTRANCE];
}

function startFetching(d: Diner) {
  d.state = "fetching";
  d.path = seatToPass(seatOf(d), d.pickup);
}

function sitDown(d: Diner) {
  const s = seatOf(d);
  d.x = s.x;
  d.z = s.z;
  d.facing = facingTo(s.x, s.z, s.table);
}

/** Something a diner did that the kitchen should hear about. */
export type DinerNews = "at-till" | "left-unpaid" | "finished";

/** The customers waiting at the till, first in line first. */
export function payingDiners(g: Game): Diner[] {
  return g.diners.filter((d) => d.state === "paying").sort((a, b) => b.timer - a.timer);
}

/** They've paid: off they go, happy. */
export function dinerPaid(d: Diner) {
  d.state = "leaving";
  d.mood = "happy";
  d.path = [[0, FRONT], HUB, ENTRANCE];
}

function goToTill(g: Game, d: Diner) {
  const till = g.stations.find((s) => s.kind === "register");
  if (!till || d.bill <= 0) {
    d.state = "leaving";
    d.path = seatToExit(seatOf(d));
    return;
  }
  const taken = new Set(g.diners.filter((x) => x !== d && (x.state === "checkout" || x.state === "paying")).map((x) => x.slot));
  d.slot = TILL_SLOTS.findIndex((_, i) => !taken.has(i));
  if (d.slot < 0) d.slot = 0;
  d.state = "checkout";
  d.path = seatToPass(seatOf(d), [till.x + TILL_SLOTS[d.slot], FRONT]);
}

export function stepDiners(g: Game, dt: number, news?: (d: Diner, what: DinerNews) => void) {
  for (const d of [...g.diners]) {
    // walk the path
    if (d.path.length) {
      let budget = (d.mood === "angry" ? STORM_OFF_SPEED : SPEED) * dt;
      while (budget > 0 && d.path.length) {
        const [tx, tz] = d.path[0];
        const dist = Math.hypot(tx - d.x, tz - d.z);
        if (dist > 1e-4) d.facing = facingTo(d.x, d.z, [tx, tz]);
        if (dist <= budget) {
          d.x = tx;
          d.z = tz;
          budget -= dist;
          d.path.shift();
        } else {
          d.x += ((tx - d.x) / dist) * budget;
          d.z += ((tz - d.z) / dist) * budget;
          budget = 0;
        }
      }
      if (d.path.length) continue;
      // arrived somewhere
      switch (d.state) {
        case "arriving":
          sitDown(d);
          if (d.dish) startFetching(d);
          else d.state = "waiting";
          break;
        case "fetching":
          d.facing = 0; // facing the pass while picking up
          d.state = "returning";
          d.timer = 0.6; // a moment to pick it up
          break;
        case "returning":
          sitDown(d);
          d.state = "eating";
          d.timer = EAT_TIME;
          break;
        case "checkout":
          d.facing = 0; // facing the till
          d.state = "paying";
          d.timer = PAY_WAIT * paceOf(g).patience;
          news?.(d, "at-till");
          break;
        case "leaving":
          g.diners.splice(g.diners.indexOf(d), 1);
          break;
      }
      continue;
    }
    if (d.state === "paying" && (d.timer -= dt) <= 0) {
      d.mood = "angry";
      d.state = "leaving";
      d.path = [[0, FRONT], HUB, ENTRANCE];
      news?.(d, "left-unpaid");
      continue;
    }
    if (d.state === "returning" && d.timer > 0 && (d.timer -= dt) <= 0) {
      d.path = passToSeat(seatOf(d), d.pickup);
    } else if (d.state === "eating" && (d.timer -= dt) <= 0) {
      news?.(d, "finished");
      goToTill(g, d); // happy customers pay on the way out; a sick one just leaves
    }
  }
}

/** Where a diner's dish is drawn: on the pass while they come for it, otherwise with them. */
export function dinerDishSpot(d: Diner): "pass" | "hands" | "table" | null {
  if (!d.dish) return null;
  if (d.state === "fetching" || d.state === "arriving" || d.state === "waiting") return "pass";
  if (d.state === "returning") return d.timer > 0 ? "pass" : "hands";
  if (d.state === "eating") return "table";
  return null;
}

export function dinerTable(d: Diner): Point {
  return seatOf(d).table;
}
