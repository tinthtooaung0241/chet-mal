// A Session is where the game runs: in this browser (solo) or on the server (online).
// The rest of the client only talks to this interface.
import { helperOn } from "./helper";
import { myLook } from "./looks";
import { myPace } from "./pace";
import { setSeatedRoom } from "./resume";
import {
  SNAPSHOT_HZ,
  addBot,
  stepBots,
  addChef,
  chopHint,
  createGame,
  emote,
  findChef,
  hydrate,
  interact,
  moveChef,
  ping,
  ringBell,
  sniff,
  toggleHand,
  update,
  type Action,
  type Chef,
  type ClientMessage,
  type Emote,
  type Game,
  type GameEvent,
  type Pinch,
  type Input,
  type LobbyPlayer,
  type Role,
  type ServerMessage,
  type TwistId,
} from "@kitchen/shared";
import { loadBusiness } from "./business";

export interface Session {
  readonly online: boolean;
  /** null until an online round starts */
  readonly game: Game | null;
  readonly me: Chef | null;
  step(dt: number, input: Input): void;
  /** @param aim for a ping: the spot under the crosshair; pinch: how a pour went at the meter */
  act(action: Action, aim?: { x: number; z: number }, pinch?: Pinch): void;
  /** choose an item at a fridge or spice rack (index into its stock) */
  setPick(index: number): void;
  emote(word: Emote): void;
  drainEvents(): GameEvent[];
  /** play again, optionally on another level */
  restart(level?: number): void;
}

// --- solo -----------------------------------------------------------------------------

export class LocalSession implements Session {
  readonly online = false;
  game: Game;
  me: Chef;

  /** @param twist a daily special's twist; helper: a porter bot cooks alongside you */
  constructor(
    role: Role,
    level = 1,
    twist?: TwistId,
    private readonly helper = helperOn(),
  ) {
    this.game = createGame(level, loadBusiness().upgrades, twist, myPace());
    this.me = addChef(this.game, "solo", role, "You");
    this.me.look = myLook();
    if (helper) addBot(this.game);
  }

  /** A shift saved before a reload, carried on where it left off. */
  static resume(game: Game, meId: string, helper: boolean): LocalSession {
    const session = Object.create(LocalSession.prototype) as LocalSession;
    Object.assign(session, { online: false, helper, game, me: game.chefs.find((c) => c.id === meId)! });
    return session;
  }

  get hasHelper() {
    return this.helper;
  }

  setRole(role: Role) {
    this.me.role = role;
  }

  step(dt: number, input: Input) {
    stepBots(this.game, dt);
    update(this.game, this.me, dt, input);
  }

  act(action: Action, aim?: { x: number; z: number }, pinch?: Pinch) {
    if (action === "ping") return ping(this.game, this.me, aim);
    // the mini-games' quality rides along with these three
    if (action === "interact") return interact(this.game, this.me, pinch);
    if (action === "bell") return ringBell(this.game, this.me, pinch);
    ({ chopHint, ping, hand: toggleHand, sniff } as const)[action](this.game, this.me);
  }

  setPick(index: number) {
    this.me.pick = index;
  }

  emote(word: Emote) {
    emote(this.game, this.me, word);
  }

  drainEvents() {
    return this.game.events.splice(0);
  }

  restart(level = this.game.level) {
    const role = this.me.role;
    // playing again keeps a daily special's twist; another level is a normal shift
    const twist = level === this.game.level ? this.game.twist : undefined;
    this.game = createGame(level, loadBusiness().upgrades, twist, myPace()); // anything bought since is in place now
    this.me = addChef(this.game, "solo", role, "You");
    this.me.look = myLook();
    if (this.helper) addBot(this.game);
  }
}

// --- online ---------------------------------------------------------------------------

export interface LobbyState {
  you: string;
  room: string;
  host: string;
  players: LobbyPlayer[];
  playing: boolean;
  level: number;
  twist: TwistId | null;
}

const ID_KEY = "kitchen.playerId";
const MOVE_HZ = 20;

/** Online play. The server runs the kitchen; this client moves its own chef and reports it. */
/** how many times a dropped connection is retried (1, 2, 4, 8, 8, 8 s apart) */
const RECONNECT_TRIES = 6;

export class NetSession implements Session {
  readonly online = true;
  game: Game | null = null;
  lobby: LobbyState | null = null;
  private ws: WebSocket;
  private events: GameEvent[] = [];
  /** our chef as we last moved it, re-applied over each server snapshot */
  private local: { x: number; z: number; facing: number; pitch: number; guidedBy: string | null } | null = null;
  /** what we've chosen at a fridge or spice rack (ours, like our position) */
  private pick = 0;
  private sinceMove = 0;
  private lastSnapshotAt = 0;
  onLobby: (lobby: LobbyState) => void = () => {};
  onError: (message: string) => void = () => {};
  onStart: () => void = () => {};
  onRtc: (from: string, data: unknown) => void = () => {};
  /** the connection is gone for good (reconnecting didn't work, or there was never a kitchen) */
  onClose: () => void = () => {};
  /** the connection dropped and we're trying again (attempt 1, 2, ...); then back in */
  onReconnecting: (attempt: number) => void = () => {};
  onReconnected: () => void = () => {};
  /** failed reconnects in a row, and whether we've ever been let in */
  private retries = 0;
  private reconnecting = false;
  /** the next reconnect try, while one is waiting */
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  /** we closed it ourselves (leaving): never come back */
  private closed = false;

  constructor(
    private name: string,
    private room: string,
  ) {
    this.ws = this.open();
    // a phone that slept or switched apps (or lost signal) tries again as soon as it's back,
    // however many tries ran out while it was away
    const revive = () => {
      if (document.visibilityState !== "visible" || !this.lobby || this.closed) return;
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) return;
      if (this.retryTimer) clearTimeout(this.retryTimer);
      this.retryTimer = null;
      this.retries = 1;
      this.reconnecting = true;
      this.onReconnecting(1);
      this.ws = this.open();
    };
    document.addEventListener("visibilitychange", revive);
    window.addEventListener("online", revive);
  }

  /** Connect (again): the server gives a returning chef their seat back, by id. */
  private open(): WebSocket {
    const proto = location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${proto}://${location.host}/ws`);
    ws.addEventListener("open", () => {
      let id: string | undefined;
      try {
        id = sessionStorage.getItem(ID_KEY) ?? undefined;
      } catch {
        // no storage: we just can't rejoin after a refresh
      }
      this.send({ t: "hello", name: this.name, room: this.lobby?.room ?? this.room, id, look: myLook() });
    });
    ws.addEventListener("message", (e) => this.receive(JSON.parse(e.data) as ServerMessage));
    ws.addEventListener("close", () => this.dropped());
    return ws;
  }

  /** Lost the connection: once we've been in a kitchen, try again a few times, waiting longer each time. */
  private dropped() {
    if (!this.lobby || this.closed || this.retries >= RECONNECT_TRIES) {
      this.onClose();
      return;
    }
    this.retries += 1;
    this.reconnecting = true;
    this.onReconnecting(this.retries);
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.ws = this.open();
    }, Math.min(8000, 1000 * 2 ** (this.retries - 1)));
  }

  get me(): Chef | null {
    return this.game && this.lobby ? (findChef(this.game, this.lobby.you) ?? null) : null;
  }

  /** Seconds since the last snapshot; the view uses it to smooth other chefs. */
  get snapshotAge(): number {
    return (performance.now() - this.lastSnapshotAt) / 1000;
  }

  send(msg: ClientMessage) {
    if (this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  private receive(msg: ServerMessage) {
    switch (msg.t) {
      case "welcome":
        this.retries = 0;
        if (this.reconnecting) {
          this.reconnecting = false;
          this.onReconnected();
        }
        try {
          sessionStorage.setItem(ID_KEY, msg.you);
        } catch {
          // ignore
        }
        setSeatedRoom(msg.room);
        this.lobby = { you: msg.you, room: msg.room, host: "", players: [], playing: false, level: 1, twist: null };
        return;
      case "lobby":
        if (!this.lobby) return;
        this.lobby = { ...this.lobby, players: msg.players, host: msg.host, playing: msg.playing, level: msg.level, twist: msg.twist ?? null };
        this.onLobby(this.lobby);
        return;
      case "snap": {
        const first = !this.game;
        const restarted = this.game && msg.game.timeLeft > this.game.timeLeft + 1;
        this.game = hydrate(msg.game);
        this.lastSnapshotAt = performance.now();
        const me = this.me;
        if (me) {
          if (!this.local || first || restarted) this.local = { x: me.x, z: me.z, facing: me.facing, pitch: me.pitch, guidedBy: me.guidedBy };
          // our own position is ours; hand-holding links are the server's
          me.x = this.local.x;
          me.z = this.local.z;
          me.facing = this.local.facing;
          me.pitch = this.local.pitch;
          me.pick = this.pick;
          this.local.guidedBy = me.guidedBy;
        }
        if (first || restarted) this.onStart();
        return;
      }
      case "events":
        this.events.push(...msg.events);
        return;
      case "rtc":
        this.onRtc(msg.from, msg.data);
        return;
      case "error":
        this.onError(msg.message);
        return;
    }
  }

  rename(name: string) {
    this.name = name;
    this.send({ t: "name", name });
  }

  chooseRole(role: Role) {
    this.send({ t: "role", role });
  }

  chooseLevel(level: number, twist: TwistId | null = null) {
    this.send({ t: "level", level, twist });
  }

  /** @param warmup a round in the tutorial kitchen first */
  start(warmup = false) {
    this.send({ t: "start", upgrades: loadBusiness().upgrades, helper: helperOn(), pace: myPace(), warmup });
  }

  step(dt: number, input: Input) {
    const g = this.game;
    const me = this.me;
    if (!g || !me || !this.local) return;
    moveChef(g, me, dt, input);
    this.local = { x: me.x, z: me.z, facing: me.facing, pitch: me.pitch, guidedBy: me.guidedBy };
    // events from our own movement (bumps, letting go of a hand) stay local
    this.events.push(...g.events.splice(0));
    this.sinceMove += dt;
    if (this.sinceMove >= 1 / MOVE_HZ) {
      this.sinceMove = 0;
      this.send({ t: "move", x: me.x, z: me.z, facing: me.facing, pitch: me.pitch, chop: input.chop, guidedBy: me.guidedBy });
    }
  }

  act(action: Action, aim?: { x: number; z: number }, pinch?: Pinch) {
    this.send({ t: "act", action, pick: this.pick, aim, pinch });
  }

  setPick(index: number) {
    this.pick = index;
    if (this.me) this.me.pick = index;
  }

  emote(word: Emote) {
    this.send({ t: "emote", word });
  }

  drainEvents() {
    return this.events.splice(0);
  }

  restart(level?: number) {
    this.send({ t: "restart", level, upgrades: loadBusiness().upgrades });
  }

  close() {
    this.closed = true; // on purpose: don't come back
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.ws.close();
  }
}

export const SNAPSHOT_INTERVAL = 1 / SNAPSHOT_HZ;
