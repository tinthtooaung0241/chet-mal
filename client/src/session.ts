// A Session is where the game runs: in this browser (solo) or on the server (online).
// The rest of the client only talks to this interface.
import {
  SNAPSHOT_HZ,
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
  type Input,
  type LobbyPlayer,
  type Role,
  type ServerMessage,
} from "@kitchen/shared";

export interface Session {
  readonly online: boolean;
  /** null until an online round starts */
  readonly game: Game | null;
  readonly me: Chef | null;
  step(dt: number, input: Input): void;
  act(action: Action): void;
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

  constructor(role: Role, level = 1) {
    this.game = createGame(level);
    this.me = addChef(this.game, "solo", role, "You");
  }

  setRole(role: Role) {
    this.me.role = role;
  }

  step(dt: number, input: Input) {
    update(this.game, this.me, dt, input);
  }

  act(action: Action) {
    ({ interact, chopHint, ping, bell: ringBell, hand: toggleHand, sniff } as const)[action](this.game, this.me);
  }

  emote(word: Emote) {
    emote(this.game, this.me, word);
  }

  drainEvents() {
    return this.game.events.splice(0);
  }

  restart(level = this.game.level) {
    const role = this.me.role;
    this.game = createGame(level);
    this.me = addChef(this.game, "solo", role, "You");
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
}

const ID_KEY = "kitchen.playerId";
const MOVE_HZ = 20;

/** Online play. The server runs the kitchen; this client moves its own chef and reports it. */
export class NetSession implements Session {
  readonly online = true;
  game: Game | null = null;
  lobby: LobbyState | null = null;
  private ws: WebSocket;
  private events: GameEvent[] = [];
  /** our chef as we last moved it, re-applied over each server snapshot */
  private local: { x: number; z: number; facing: number; guidedBy: string | null } | null = null;
  private sinceMove = 0;
  private lastSnapshotAt = 0;
  onLobby: (lobby: LobbyState) => void = () => {};
  onError: (message: string) => void = () => {};
  onStart: () => void = () => {};
  onRtc: (from: string, data: unknown) => void = () => {};
  onClose: () => void = () => {};

  constructor(name: string, room: string) {
    const proto = location.protocol === "https:" ? "wss" : "ws";
    this.ws = new WebSocket(`${proto}://${location.host}/ws`);
    this.ws.addEventListener("open", () => {
      let id: string | undefined;
      try {
        id = sessionStorage.getItem(ID_KEY) ?? undefined;
      } catch {
        // no storage: we just can't rejoin after a refresh
      }
      this.send({ t: "hello", name, room, id });
    });
    this.ws.addEventListener("message", (e) => this.receive(JSON.parse(e.data) as ServerMessage));
    this.ws.addEventListener("close", () => this.onClose());
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
        try {
          sessionStorage.setItem(ID_KEY, msg.you);
        } catch {
          // ignore
        }
        this.lobby = { you: msg.you, room: msg.room, host: "", players: [], playing: false, level: 1 };
        return;
      case "lobby":
        if (!this.lobby) return;
        this.lobby = { ...this.lobby, players: msg.players, host: msg.host, playing: msg.playing, level: msg.level };
        this.onLobby(this.lobby);
        return;
      case "snap": {
        const first = !this.game;
        const restarted = this.game && msg.game.timeLeft > this.game.timeLeft + 1;
        this.game = hydrate(msg.game);
        this.lastSnapshotAt = performance.now();
        const me = this.me;
        if (me) {
          if (!this.local || first || restarted) this.local = { x: me.x, z: me.z, facing: me.facing, guidedBy: me.guidedBy };
          // our own position is ours; hand-holding links are the server's
          me.x = this.local.x;
          me.z = this.local.z;
          me.facing = this.local.facing;
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

  chooseRole(role: Role) {
    this.send({ t: "role", role });
  }

  chooseLevel(level: number) {
    this.send({ t: "level", level });
  }

  start() {
    this.send({ t: "start" });
  }

  step(dt: number, input: Input) {
    const g = this.game;
    const me = this.me;
    if (!g || !me || !this.local) return;
    moveChef(g, me, dt, input);
    this.local = { x: me.x, z: me.z, facing: me.facing, guidedBy: me.guidedBy };
    // events from our own movement (bumps, letting go of a hand) stay local
    this.events.push(...g.events.splice(0));
    this.sinceMove += dt;
    if (this.sinceMove >= 1 / MOVE_HZ) {
      this.sinceMove = 0;
      this.send({ t: "move", x: me.x, z: me.z, facing: me.facing, chop: input.chop, guidedBy: me.guidedBy });
    }
  }

  act(action: Action) {
    this.send({ t: "act", action });
  }

  emote(word: Emote) {
    this.send({ t: "emote", word });
  }

  drainEvents() {
    return this.events.splice(0);
  }

  restart(level?: number) {
    this.send({ t: "restart", level });
  }

  close() {
    this.ws.close();
  }
}

export const SNAPSHOT_INTERVAL = 1 / SNAPSHOT_HZ;
