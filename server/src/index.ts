// Chet Mal game server: rooms of up to three chefs over WebSockets.
// The server owns the kitchen (stoves, orders, items, score). Each client moves its own chef
// and reports the position, so walking feels instant; everything else is decided here.
import { randomUUID } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import * as Sentry from "@sentry/node";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer, type WebSocket } from "ws";
import {
  EMOTES,
  MAX_PLAYERS,
  ROLES,
  SNAPSHOT_HZ,
  TICK_HZ,
  addChef,
  chopHint,
  createGame,
  emote,
  findChef,
  interact,
  makeRoomCode,
  paceById,
  TUTORIAL,
  twistById,
  validLook,
  addBot,
  stepBots,
  type Chef,
  type ChefLook,
  ping,
  levelByNumber,
  ringBell,
  snapshot,
  sniff,
  stepWorld,
  toggleHand,
  type ClientMessage,
  type Game,
  type LobbyPlayer,
  type Pace,
  type Role,
  type ServerMessage,
  type TwistId,
} from "@kitchen/shared";

const PORT = Number(process.env.PORT ?? 8787);
const STATIC_DIR = fileURLToPath(new URL("../../client/dist", import.meta.url));
// Error tracking: on only when SENTRY_DSN is set.
if (process.env.SENTRY_DSN) Sentry.init({ dsn: process.env.SENTRY_DSN, tracesSampleRate: 0 });

// Text files are gzipped once and kept; the CDN caches whatever we mark as cacheable.
const ZIPPABLE = new Set([".html", ".js", ".css", ".json", ".svg", ".gltf"]);
const zipped = new Map<string, Buffer>();
const EMPTY_ROOM_TTL_MS = 5 * 60 * 1000;

interface Player {
  id: string;
  name: string;
  role: Role | null;
  ws: WebSocket | null;
  /** the hat they wear (only for looks: it changes nothing in play) */
  look: ChefLook | null;
}

/** Put the player's hat on their chef. */
function dressChef(chef: Chef, p: Player) {
  if (p.look) chef.look = p.look;
}

class Room {
  readonly players = new Map<string, Player>();
  host = "";
  level = 1;
  game: Game | null = null;
  private loop: NodeJS.Timeout | null = null;
  private lastTick = 0;
  private sinceSnapshot = 0;
  emptySince: number | null = null;
  /** anyone can be put in here by Quick Play (not just friends with the code) */
  open = false;
  /** the host wants a helper bot in an empty seat */
  helper = false;
  /** how fast the host wants the shift to run */
  pace: Pace = "classic";

  constructor(readonly code: string) {}

  get connected(): Player[] {
    return [...this.players.values()].filter((p) => p.ws);
  }

  send(player: Player, msg: ServerMessage) {
    if (player.ws?.readyState === player.ws?.OPEN) player.ws!.send(JSON.stringify(msg));
  }

  broadcast(msg: ServerMessage) {
    const data = JSON.stringify(msg);
    for (const p of this.connected) p.ws!.send(data);
  }

  lobby() {
    const players: LobbyPlayer[] = [...this.players.values()].map((p) => ({
      id: p.id,
      name: p.name,
      role: p.role,
      connected: !!p.ws,
    }));
    this.broadcast({ t: "lobby", players, host: this.host, playing: !!this.game, level: this.level, twist: this.twist });
  }

  /** the host's restaurant equipment (sent with start / restart) */
  upgrades: string[] = [];
  /** a daily special's twist, chosen by the host with the level */
  twist: TwistId | null = null;

  /** @param warmup a round in the tutorial kitchen, where each chef does their job once (the chosen shift stays chosen) */
  start(warmup = false) {
    const g = warmup ? createGame(TUTORIAL.n, this.upgrades) : createGame(this.level, this.upgrades, this.twist ?? undefined, this.pace);
    for (const p of this.players.values()) dressChef(addChef(g, p.id, p.role!, `${p.name} (${ROLES[p.role!].name.toLowerCase()})`), p);
    // a porter bot in the empty seat, if the host asked for one
    if (this.helper && this.players.size < MAX_PLAYERS) addBot(g);
    this.game = g;
    this.lastTick = performance.now();
    this.sinceSnapshot = 0;
    this.loop ??= setInterval(() => this.tick(), 1000 / TICK_HZ);
    this.lobby();
    this.broadcast({ t: "snap", game: snapshot(g) });
  }

  private tick() {
    const g = this.game;
    if (!g) return;
    const now = performance.now();
    const dt = Math.min((now - this.lastTick) / 1000, 0.1);
    this.lastTick = now;
    stepBots(g, dt);
    stepWorld(g, dt);
    const events = g.events.splice(0);
    if (events.length) this.broadcast({ t: "events", events });
    this.sinceSnapshot += dt;
    if (this.sinceSnapshot >= 1 / SNAPSHOT_HZ) {
      this.sinceSnapshot = 0;
      this.broadcast({ t: "snap", game: snapshot(g) });
    }
  }

  stop() {
    if (this.loop) clearInterval(this.loop);
    this.loop = null;
  }
}

const rooms = new Map<string, Room>();

function newRoom(open = false): Room {
  let code = makeRoomCode();
  while (rooms.has(code)) code = makeRoomCode();
  const room = new Room(code);
  room.open = open;
  rooms.set(code, room);
  return room;
}

/** Quick Play: an open kitchen still waiting for chefs, or a new open one for others to find. */
function quickRoom(): Room {
  const waiting = [...rooms.values()].find((r) => r.open && !r.game && r.players.size < MAX_PLAYERS && [...r.players.values()].some((p) => p.ws));
  return waiting ?? newRoom(true);
}

// --- WebSocket handling ----------------------------------------------------------

function handle(ws: WebSocket) {
  let room: Room | null = null;
  let player: Player | null = null;
  const fail = (message: string) => ws.send(JSON.stringify({ t: "error", message } satisfies ServerMessage));

  ws.on("message", (raw) => {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(String(raw));
    } catch {
      return;
    }

    if (msg.t === "hello") {
      const code = msg.room.trim().toUpperCase();
      // "*" is Quick Play; no code makes a private kitchen
      room = code === "*" ? quickRoom() : code ? (rooms.get(code) ?? null) : newRoom();
      if (!room) return fail(`There's no kitchen with the code ${code}.`);
      // rejoin with the same id after a refresh or a dropped connection
      const returning = msg.id ? room.players.get(msg.id) : undefined;
      if (returning && !returning.ws) {
        player = returning;
        player.ws = ws;
      } else {
        if (room.players.size >= MAX_PLAYERS) return fail("That kitchen already has three chefs.");
        if (room.game) return fail("That kitchen is already cooking. Ask them for a new round.");
        player = { id: randomUUID().slice(0, 8), name: msg.name.trim().slice(0, 20) || "Chef", role: null, ws, look: null };
        room.players.set(player.id, player);
      }
      player.look = validLook(msg.look);
      room.emptySince = null;
      if (!room.host || !room.players.get(room.host)?.ws) room.host = player.id;
      room.send(player, { t: "welcome", you: player.id, room: room.code });
      room.lobby();
      if (room.game) room.send(player, { t: "snap", game: snapshot(room.game) });
      return;
    }

    if (!room || !player) return;
    const g = room.game;
    const chef = g ? findChef(g, player.id) : undefined;

    switch (msg.t) {
      case "role": {
        if (room.game || !(msg.role in ROLES)) return;
        const taken = [...room.players.values()].some((p) => p !== player && p.role === msg.role && msg.role !== "full");
        if (taken) return fail(`Someone is already the ${ROLES[msg.role].name.toLowerCase()}.`);
        player.role = msg.role;
        room.lobby();
        return;
      }
      case "level":
        if (player.id !== room.host || room.game) return;
        room.level = levelByNumber(msg.level).n;
        room.twist = twistById(msg.twist)?.id ?? null;
        room.lobby();
        return;
      case "start":
        if (player.id !== room.host || room.game) return;
        if ([...room.players.values()].some((p) => !p.role)) return fail("Everyone needs to pick a chef first.");
        if (Array.isArray(msg.upgrades)) room.upgrades = msg.upgrades.filter((u): u is string => typeof u === "string").slice(0, 16);
        room.helper = msg.helper === true;
        room.pace = paceById(msg.pace);
        room.start(msg.warmup === true);
        return;
      case "restart":
        // the host picks what comes next (play again, the next level, or the shift after a warm-up)
        if (room.game?.phase !== "over" || player.id !== room.host) return;
        if (msg.level) {
          const level = levelByNumber(msg.level).n;
          if (level !== room.level) room.twist = null; // the next shift is a normal one
          room.level = level;
        }
        if (player.id === room.host && Array.isArray(msg.upgrades)) room.upgrades = msg.upgrades.filter((u): u is string => typeof u === "string").slice(0, 16);
        room.start();
        return;
      case "move":
        if (!chef) return;
        chef.x = msg.x;
        chef.z = msg.z;
        chef.facing = msg.facing;
        chef.pitch = Math.max(-1.2, Math.min(1.2, msg.pitch ?? 0));
        chef.chopInput = msg.chop;
        if (msg.guidedBy === null) chef.guidedBy = null; // clients may let go, but only the server links hands
        return;
      case "act":
        if (!g || !chef) return;
        if ((msg.action === "ping" || msg.action === "bell") && !ROLES[chef.role].signals) return;
        if (typeof msg.pick === "number" && Number.isFinite(msg.pick)) chef.pick = Math.max(0, Math.min(15, Math.floor(msg.pick)));
        if (msg.action === "ping" && msg.aim && Number.isFinite(msg.aim.x) && Number.isFinite(msg.aim.z)) {
          ping(g, chef, { x: msg.aim.x, z: msg.aim.z });
          return;
        }
        ({ interact, chopHint, ping, bell: ringBell, hand: toggleHand, sniff } as const)[msg.action](g, chef);
        return;
      case "emote":
        if (g && chef && ROLES[chef.role].signals && EMOTES.includes(msg.word)) emote(g, chef, msg.word);
        return;
      case "rtc": {
        const to = room.players.get(msg.to);
        if (to) room.send(to, { t: "rtc", from: player.id, data: msg.data });
        return;
      }
    }
  });

  ws.on("close", () => {
    if (!room || !player) return;
    player.ws = null;
    if (!room.game) room.players.delete(player.id); // in the lobby, just leave
    if (room.host === player.id) room.host = room.connected[0]?.id ?? "";
    if (room.connected.length === 0) room.emptySince = Date.now();
    room.lobby();
  });
}

// close rooms nobody has been in for a while
setInterval(() => {
  for (const [code, room] of rooms) {
    if (room.emptySince && Date.now() - room.emptySince > EMPTY_ROOM_TTL_MS) {
      room.stop();
      rooms.delete(code);
    }
  }
}, 30_000);

// --- static files (the built client) for production --------------------------------

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".glb": "model/gltf-binary",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

async function serveStatic(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? "/", "http://localhost");
  const path = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, "");
  const file = join(STATIC_DIR, path === "/" ? "index.html" : path);
  if (!file.startsWith(STATIC_DIR)) {
    res.writeHead(403).end();
    return;
  }
  try {
    let body: Buffer = await readFile(file);
    const ext = extname(file);
    const headers: Record<string, string> = {
      "content-type": TYPES[ext] ?? "application/octet-stream",
      // Vite puts a hash in built file names, so those never change; the page itself must stay fresh
      "cache-control": path.startsWith("/assets/") ? "public, max-age=31536000, immutable" : ext === ".html" || path === "/" ? "no-cache" : "public, max-age=86400",
      vary: "accept-encoding",
    };
    if (ZIPPABLE.has(ext) && /\bgzip\b/.test(String(req.headers["accept-encoding"] ?? ""))) {
      let gz = zipped.get(file);
      if (!gz) zipped.set(file, (gz = gzipSync(body)));
      body = gz;
      headers["content-encoding"] = "gzip";
    }
    res.writeHead(200, headers).end(body);
  } catch {
    res.writeHead(404, { "content-type": "text/plain" }).end("Not found. In development, open the Vite dev server instead.");
  }
}

const server = createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ ok: true, rooms: rooms.size }));
    return;
  }
  void serveStatic(req, res);
});

const wss = new WebSocketServer({ server, path: "/ws" });
wss.on("connection", handle);

server.listen(PORT, () => console.log(`Kitchen server listening on http://localhost:${PORT} (WebSocket at /ws)`));
