// Messages between browser and server. Plain JSON over one WebSocket per player.
import type { Emote, Role } from "./roles";
import type { TwistId } from "./twists";
import type { Pace } from "./rules";
import type { ChefLook } from "./looks";
import { rebuildGrid, type Game, type GameEvent } from "./state";

export const MAX_PLAYERS = 3;
export const TICK_HZ = 20;
export const SNAPSHOT_HZ = 15;

export interface LobbyPlayer {
  id: string;
  name: string;
  role: Role | null;
  connected: boolean;
}

export type Action = "interact" | "chopHint" | "ping" | "bell" | "hand" | "sniff";

export type ClientMessage =
  /** room "" creates a new kitchen and "*" joins any open one (Quick Play); id rejoins after a refresh */
  | { t: "hello"; name: string; room: string; id?: string; look?: ChefLook }
  | { t: "role"; role: Role }
  /** twist: a daily special's twist (null for a normal shift) */
  | { t: "level"; level: number; twist?: TwistId | null }
  /** upgrades: the host's restaurant equipment, used for this shift */
  /** helper: put a porter bot in an empty seat; pace: how fast the shift runs; warmup: a round in the tutorial kitchen first */
  | { t: "start"; upgrades?: string[]; helper?: boolean; pace?: Pace; warmup?: boolean }
  /** play again, optionally on another level */
  | { t: "restart"; level?: number; upgrades?: string[] }
  /** own chef's movement: clients move their chef locally and report where it is */
  | { t: "move"; x: number; z: number; facing: number; pitch: number; chop: boolean; guidedBy: string | null }
  /** pick: the item chosen at a fridge or spice rack, so the server uses the same one */
  | { t: "act"; action: Action; pick?: number; aim?: { x: number; z: number } }
  | { t: "emote"; word: Emote }
  /** WebRTC signalling relayed to one other player */
  | { t: "rtc"; to: string; data: unknown };

export type ServerMessage =
  | { t: "welcome"; you: string; room: string }
  | { t: "lobby"; players: LobbyPlayer[]; host: string; playing: boolean; level: number; twist: TwistId | null }
  | { t: "snap"; game: Game }
  | { t: "events"; events: GameEvent[] }
  | { t: "rtc"; from: string; data: unknown }
  | { t: "error"; message: string };

/** Game state without the bulky/derived parts, ready for JSON. */
export function snapshot(g: Game): Game {
  return { ...g, grid: [], events: [] };
}

/** Restore derived parts after a snapshot arrives. */
export function hydrate(g: Game): Game {
  rebuildGrid(g);
  g.events = [];
  return g;
}

/** Short, unambiguous room codes (no 0/O, 1/I). */
export function makeRoomCode(): string {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  return Array.from({ length: 4 }, () => letters[Math.floor(Math.random() * letters.length)]).join("");
}
