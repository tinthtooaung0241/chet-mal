import { ArcRotateCamera, Engine, Scene, Vector3 } from "@babylonjs/core";
import {
  EMOTES,
  ROLE_KEYS,
  ROLES,
  createGame,
  describeSurroundings,
  targetStation,
  type Action,
  type Chef,
  type Emote,
  type Game,
  type Input,
  type Role,
  type Station,
} from "@kitchen/shared";
import { AssetLibrary } from "./assets";
import { Feedback } from "./game/feedback";
import { Hud } from "./game/hud";
import { setupLook } from "./game/look";
import { PovController } from "./game/pov";
import { Effects } from "./game/effects";
import { GameView } from "./game/view";
import { RecipeBook } from "./game/recipeBook";
import { stockName } from "./game/hints";
import { Lobby } from "./lobby";
import { recordStars } from "./progress";
import { LocalSession, NetSession, type Session } from "./session";
import { hydrateIcons } from "./ui/icons";
import { Voice } from "./voice";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = $<HTMLCanvasElement>("scene");
hydrateIcons(); // fill every data-icon / data-img placeholder in the page

const engine = new Engine(canvas, true, { stencil: true });
const scene = new Scene(engine);

// Overhead view (V): looks at the whole floating restaurant from the terrace side.
const camera = new ArcRotateCamera("camera", -Math.PI / 2, 0.85, 12, new Vector3(0, 0, -1.1), scene);
camera.minZ = 0.05;
camera.fov = 0.7;
// Default view: first person from the chef's eyes.
const pov = new PovController(scene, canvas);
scene.activeCamera = camera;

const look = setupLook(scene, [pov.camera, camera]);
const effects = new Effects(scene);
const { shadows } = look;

const hud = new Hud();
const feedback = new Feedback($("announce-polite"), $("announce-urgent"), $<HTMLOListElement>("log"));
$<HTMLInputElement>("speak").addEventListener("change", (e) => {
  feedback.speak = (e.target as HTMLInputElement).checked;
});

let session: Session | null = null;
let view: GameView | null = null;
let paused = false;
let shownGameOver = false;

const meNow = (): Chef | null => session?.me ?? null;

// --- roles ----------------------------------------------------------------------

const ROLE_STORAGE_KEY = "kitchen.role";
let soloRole: Role = "full";
try {
  const saved = localStorage.getItem(ROLE_STORAGE_KEY) as Role | null;
  if (saved && saved in ROLES) soloRole = saved;
} catch {
  // ignore: fall back to all senses
}

function presentRole(role: Role) {
  feedback.setRole(role);
  hud.setRole(role);
}

/** Solo only: switch which chef you play (online, your role is picked in the lobby). */
function setSoloRole(role: Role) {
  if (!(session instanceof LocalSession)) return;
  soloRole = role;
  session.setRole(role);
  presentRole(role);
  try {
    localStorage.setItem(ROLE_STORAGE_KEY, role);
  } catch {
    // storage can be unavailable (private mode); the role just won't be remembered
  }
  feedback.say(`You are now the ${ROLES[role].name.toLowerCase()}. ${ROLES[role].summary}`);
}

for (const input of document.querySelectorAll<HTMLInputElement>("input[name=role]")) {
  input.addEventListener("change", () => setSoloRole(input.value as Role));
}

// --- actions ----------------------------------------------------------------------

function act(action: Action) {
  const me = meNow();
  if (!session || !me || paused) return;
  if ((action === "ping" || action === "bell") && !ROLES[me.role].signals) {
    feedback.say("You can talk, so signals are left to the mute chef.");
    return;
  }
  session.act(action);
}

function sendEmote(word: Emote) {
  const me = meNow();
  if (!session || !me || paused) return;
  if (!ROLES[me.role].signals) {
    feedback.say("You can talk, so signals are left to the mute chef.");
    return;
  }
  session.emote(word);
}

for (const button of document.querySelectorAll<HTMLButtonElement>("#signals [data-signal]")) {
  button.addEventListener("click", () => {
    feedback.unlock();
    act(button.dataset.signal === "ping" ? "ping" : "bell");
    canvas.focus();
  });
}

// the sign wheel: hold T (or tap its button), then pick a sign with 1-6 or a click
const wheel = $("emote-wheel");
const showWheel = (on: boolean) => {
  wheel.hidden = !on || !meNow() || !ROLES[meNow()!.role].signals;
};
$("wheel-button").addEventListener("click", () => showWheel(wheel.hidden !== false));
for (const button of wheel.querySelectorAll<HTMLButtonElement>("[data-emote]")) {
  button.addEventListener("click", () => {
    feedback.unlock();
    sendEmote(button.dataset.emote as Emote);
    showWheel(false);
    canvas.focus();
  });
}

// --- menus --------------------------------------------------------------------------

const pauseMenu = $<HTMLDialogElement>("pause-menu");
const helpCard = $<HTMLDialogElement>("help");

function openMenu() {
  const game = session?.game;
  if (!game || game.phase !== "playing" || pauseMenu.open) return;
  if (document.pointerLockElement) document.exitPointerLock();
  $("pause-note").textContent = session?.online ? "Your friends are still cooking — the kitchen doesn't stop online!" : "The kitchen is on hold.";
  $("pause-title").textContent = session?.online ? "Menu" : "Paused";
  if (!session?.online) {
    paused = true;
    feedback.setPaused(true);
  }
  pauseMenu.showModal();
}

function closeMenu() {
  if (pauseMenu.open) pauseMenu.close();
}

pauseMenu.addEventListener("close", () => {
  // going from the menu straight into the recipe book keeps the kitchen paused
  if (paused && !book.open) {
    paused = false;
    feedback.setPaused(false);
    feedback.say("Back to the kitchen!");
  }
  canvas.focus();
});
$("resume").addEventListener("click", closeMenu);
$("menu-button").addEventListener("click", () => {
  feedback.unlock();
  openMenu();
});
// --- recipe book (R) -------------------------------------------------------------

const book = new RecipeBook();

function openBook() {
  const game = session?.game;
  const me = meNow();
  if (!game || !me || game.phase !== "playing" || book.open) return;
  if (document.pointerLockElement) document.exitPointerLock();
  closeMenu();
  // solo: the kitchen waits while you read; online it keeps going
  if (!session?.online && !paused) {
    paused = true;
    feedback.setPaused(true);
  }
  book.show(game, me.role);
}

book.dialog.addEventListener("close", () => {
  if (paused && !pauseMenu.open) {
    paused = false;
    feedback.setPaused(false);
  }
  canvas.focus();
});
$("book-button").addEventListener("click", () => {
  feedback.unlock();
  openBook();
});
$("open-book").addEventListener("click", openBook);

$("open-help").addEventListener("click", () => helpCard.showModal());
$("close-help").addEventListener("click", () => helpCard.close());
helpCard.addEventListener("close", () => {
  if (!pauseMenu.open) canvas.focus();
});
$("quit").addEventListener("click", () => {
  // back to the title screen (the server keeps an online seat for a while if you return)
  location.href = location.pathname;
});

// --- sessions -----------------------------------------------------------------------

const voice = new Voice(
  (to, data) => (session instanceof NetSession ? session.send({ t: "rtc", to, data }) : undefined),
  () => feedback.audioContext,
  (message) => feedback.say(message),
);

function beginRound() {
  const me = meNow();
  if (!me) return;
  lobby.hide();
  view?.clearItems();
  paused = false;
  shownGameOver = false;
  hud.hideGameOver();
  hud.reset();
  feedback.clearLog();
  $("hud").hidden = false;
  presentRole(me.role);
  $("role-picker").hidden = session?.online ?? false;
  setFirstPerson(true);
  canvas.focus();
}

const lobby = new Lobby({
  solo() {
    feedback.unlock();
    session = new LocalSession(soloRole, lobby.level);
    beginRound();
    feedback.say("Practice kitchen open! Keys 0–3 switch chefs. Press Q any time to hear what's around you.");
  },
  create(name) {
    feedback.unlock();
    connect(name, "");
  },
  join(name, code) {
    feedback.unlock();
    connect(name, code);
  },
  chooseRole(role) {
    if (session instanceof NetSession) session.chooseRole(role);
  },
  chooseLevel(level) {
    if (session instanceof NetSession) session.chooseLevel(level);
  },
  start() {
    if (session instanceof NetSession) session.start();
  },
});

function connect(name: string, code: string) {
  const net = new NetSession(name, code);
  session = net;
  net.onLobby = (state) => {
    if (!state.playing || !net.game) lobby.showRoom(state);
  };
  net.onError = (message) => {
    if (net.game) feedback.say(message);
    else lobby.setError(message);
  };
  net.onStart = () => {
    beginRound();
    const me = net.me!;
    feedback.say(`Kitchen open! You are the ${ROLES[me.role].name.toLowerCase()}. ${ROLES[me.role].summary}`);
    const others = net.game!.chefs.map((c) => c.id).filter((id) => id !== me.id);
    void voice.start(me.id, me.role, others);
  };
  net.onRtc = (from, data) => void voice.handle(from, data as Parameters<Voice["handle"]>[1]);
  net.onClose = () => {
    voice.stop();
    if (net.game) feedback.say("Lost connection to the kitchen. Refresh to rejoin.", true);
    else lobby.setError("Couldn't reach the kitchen server. Is it running?");
  };
}

// --- input --------------------------------------------------------------------

const keys = new Set<string>();
const GAME_KEYS = new Set([
  "KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight",
  "Space", "KeyE", "KeyF", "KeyQ", "KeyP", "Escape", "KeyR", "KeyV", "KeyH",
  "KeyG", "KeyB", "KeyT", "KeyZ", "KeyN", "Slash", "F1", "Digit0", "Digit1", "Digit2", "Digit3", "Digit4", "Digit5", "Digit6",
  "Digit7", "Digit8", "BracketLeft", "BracketRight",
]);

const held = (...codes: string[]) => codes.some((c) => keys.has(c));
const axis = (plus: string[], minus: string[]) => Number(held(...plus)) - Number(held(...minus));

function readInput(): Input {
  const chop = held("KeyF");
  const forward = axis(["KeyW", "ArrowUp"], ["KeyS", "ArrowDown"]);
  if (!pov.active) {
    // overhead: screen-relative movement, chef turns to where it walks
    return { moveX: axis(["KeyD", "ArrowRight"], ["KeyA", "ArrowLeft"]), moveZ: forward, chop };
  }
  // first person: W/S walk where you look, A/D strafe (arrow left/right turn, see the loop)
  const strafe = axis(["KeyD"], ["KeyA"]);
  const sin = Math.sin(pov.yaw);
  const cos = Math.cos(pov.yaw);
  return { moveX: sin * forward + cos * strafe, moveZ: cos * forward - sin * strafe, chop, facing: pov.yaw, pitch: pov.pitch };
}

function setFirstPerson(on: boolean) {
  const me = meNow();
  if (on && me) pov.yaw = me.facing;
  else if (!on && document.pointerLockElement) document.exitPointerLock();
  scene.activeCamera = on ? pov.camera : camera;
  view?.setSelfVisible(!on);
  $("crosshair").hidden = !on;
}

function restart(level?: number) {
  if (!session) return;
  session.restart(level);
  if (!session.online) {
    beginRound();
    feedback.say("New round! Check the orders.");
  }
}

window.addEventListener("keydown", (e) => {
  if (!GAME_KEYS.has(e.code) || !session?.game || !view) return;
  const target = e.target instanceof Element ? e.target : null;
  if (target?.closest("dialog") && e.code !== "KeyR") return;
  // after clicking a panel control (e.g. the speech checkbox), game keys go back to the game
  if (target?.closest("input, a, button")) canvas.focus();
  e.preventDefault();
  feedback.unlock();
  keys.add(e.code);
  if (e.repeat) return;
  const me = meNow();
  switch (e.code) {
    case "Space":
    case "KeyE":
      act("interact");
      break;
    case "KeyF":
      act("chopHint");
      break;
    case "KeyH":
      act("hand");
      break;
    case "KeyZ":
      act("sniff");
      break;
    case "KeyN":
      if (session.game.phase === "over" && !$<HTMLButtonElement>("next-level").hidden) restart(session.game.level + 1);
      break;
    case "KeyG":
      act("ping");
      break;
    case "KeyB":
      act("bell");
      break;
    case "KeyQ":
      if (me) feedback.say(describeSurroundings(session.game, me));
      break;
    case "KeyP":
    case "Escape":
      openMenu();
      break;
    case "Slash":
    case "F1":
      if (document.pointerLockElement) document.exitPointerLock();
      helpCard.showModal();
      break;
    case "KeyT":
      showWheel(true);
      break;
    case "KeyR":
      if (session.game.phase === "over") restart();
      else if (book.open) book.close();
      else if (!target?.closest("dialog")) openBook();
      break;
    case "BracketLeft":
    case "BracketRight": {
      const stock = stockStation();
      if (stock && me) choosePick(me.pick + (e.code === "BracketRight" ? 1 : -1), stock);
      break;
    }
    case "KeyV":
      setFirstPerson(!pov.active);
      feedback.say(pov.active ? "First-person view." : "Overhead view.");
      break;
    default:
      if (e.code.startsWith("Digit")) {
        const digit = Number(e.code.slice(5));
        // hold T and press 1-6 to emote; otherwise 0-3 picks the chef (solo practice)
        const stock = stockStation();
        if (keys.has("KeyT")) {
          const word = EMOTES[digit - 1];
          if (word) sendEmote(word);
        } else if (stock && digit >= 1 && digit <= stock.stock!.length) {
          // at a fridge or spice rack a number takes (or adds) that item straight away
          choosePick(digit - 1, stock);
          act("interact");
        } else if (ROLE_KEYS[e.code]) {
          setSoloRole(ROLE_KEYS[e.code]);
        }
      }
      break;
  }
});
// --- fridges and spice racks: choosing what to take or add ----------------------------

/** The fridge or spice rack this chef is facing, if any. */
function stockStation(): Station | null {
  const game = session?.game;
  const me = meNow();
  if (!game || !me || game.phase !== "playing") return null;
  const st = targetStation(game, me);
  return st?.stock?.length ? st : null;
}

function choosePick(index: number, st: Station) {
  const me = meNow();
  if (!session || !me) return;
  const n = st.stock!.length;
  const i = ((index % n) + n) % n;
  if (i === me.pick && st.id === lastStock) return;
  session.setPick(i);
  feedback.pickCue(i, stockName(st, st.stock![i]), me);
}

let lastStock: number | null = null;
/** Walking up to a different fridge or rack starts again at its first item. */
function resetPickOnNewStation() {
  const st = stockStation();
  const id = st?.id ?? null;
  if (id === lastStock) return;
  lastStock = id;
  if (st) {
    session?.setPick(0);
    const me = meNow();
    if (me) feedback.pickCue(0, stockName(st, st.stock![0]), me);
  }
}

canvas.addEventListener(
  "wheel",
  (e) => {
    const st = stockStation();
    const me = meNow();
    if (!st || !me || !pov.active) return;
    e.preventDefault();
    choosePick(me.pick + (e.deltaY > 0 ? 1 : -1), st);
  },
  { passive: false },
);

window.addEventListener("keyup", (e) => {
  keys.delete(e.code);
  if (e.code === "KeyT") showWheel(false);
});
window.addEventListener("blur", () => keys.clear());
canvas.addEventListener("pointerdown", () => {
  feedback.unlock();
  canvas.focus();
  if (pov.active && session?.game?.phase === "playing") pov.lockPointer();
});
$("restart").addEventListener("click", () => restart());
$("next-level").addEventListener("click", () => restart((session?.game?.level ?? 0) + 1));

// --- power cut and storm ----------------------------------------------------------

let darkness = 0;
let lightning = 0;
let nextFlash = 2;
let ducked = false;

/** Lights fade out in a power cut; a storm flashes lightning (so the deaf chef sees it coming). */
function updateAtmosphere(game: Game, dt: number) {
  darkness += ((game.blackout > 0 ? 1 : 0) - darkness) * Math.min(1, dt * 3);
  lightning = Math.max(0, lightning - dt * 4);
  if (game.storm > 0 && (nextFlash -= dt) <= 0) {
    lightning = 1.4;
    nextFlash = 2 + Math.random() * 4;
  }
  look.setAtmosphere(darkness, lightning);
  if (ducked !== game.storm > 0) {
    ducked = game.storm > 0;
    voice.setDucked(ducked);
  }
}

// --- loop ---------------------------------------------------------------------

scene.onBeforeRenderObservable.add(() => {
  const game = session?.game;
  const me = meNow();
  if (!view || !session || !game || !me) return;
  const dt = Math.min(engine.getDeltaTime() / 1000, 0.05);
  if (!paused) {
    if (pov.active) pov.turn(axis(["ArrowRight"], ["ArrowLeft"]), dt);
    session.step(dt, readInput());
    resetPickOnNewStation();
  }
  for (const event of session.drainEvents()) {
    feedback.handle(event, me, game);
    if (event.kind === "served") effects.confetti(event.x, event.z);
  }
  effects.sync(game);
  if (game.phase === "over" && !shownGameOver) {
    shownGameOver = true;
    const stars = hud.showGameOver(game);
    if (recordStars(game.level, stars)) feedback.say(`New best on this level: ${stars} of 3 stars!`);
    lobby.refreshLevels(game.level);
    if (document.pointerLockElement) document.exitPointerLock();
  }
  if (game.phase === "playing" && shownGameOver) {
    // an online round restarted by a teammate
    shownGameOver = false;
    hud.hideGameOver();
  }
  updateAtmosphere(game, dt);
  pov.sync(me.x, me.z);
  view.sync(game, me, paused ? 0 : dt, pov.active ? pov.handPosition() : null);
  if (!paused) feedback.update(game, me, dt);
  voice.update(game, me);
  hud.update(game, me, pov.active);
});

if (import.meta.env.DEV) Object.assign(window, { getSession: () => session, scene, pov, voice }); // console debugging

// Footprint of the floating island in Kitchen_Room.glb (metres).
const ISLAND = { width: 11.1, depth: 10.6 };

/** Pull the overhead camera back just far enough that the whole island fits the canvas. */
function fitCamera() {
  const aspect = engine.getRenderWidth() / engine.getRenderHeight();
  const halfWidth = ISLAND.width / 2 + 0.3;
  // depth is foreshortened by the camera tilt; add room for the walls and the HUD
  const halfHeight = (ISLAND.depth / 2) * Math.cos(camera.beta) + 1.8;
  const hFov = 2 * Math.atan(Math.tan(camera.fov / 2) * aspect);
  camera.radius = Math.max(halfWidth / Math.tan(hFov / 2), halfHeight / Math.tan(camera.fov / 2));
}

engine.runRenderLoop(() => scene.render());
window.addEventListener("resize", () => {
  engine.resize();
  fitCamera();
});
fitCamera();

AssetLibrary.load(scene)
  .then((lib) => {
    // The room is modelled in Blender around the station grid; turning it half a circle maps
    // Blender's (x, y) onto the game's (x, z).
    const room = lib.spawn("Kitchen_Room");
    room.rotation.y = Math.PI;
    for (const mesh of room.getChildMeshes()) {
      mesh.receiveShadows = true;
      if (/Terrace|Nature|RangeHood|Shelves|Window|WallDecor/.test(mesh.name)) shadows.addShadowCaster(mesh);
    }
    // stations never move, so any game's layout builds the kitchen
    view = new GameView(scene, lib, shadows, createGame());
    view.onFootstep = (chefId, x, z) => {
      const me = meNow();
      if (me && session?.game) feedback.footstep(x, z, me, session.game, chefId === me.id);
    };
    $("loading").hidden = true;
    presentRole(soloRole);
    lobby.show();
  })
  .catch((error) => {
    $("loading").textContent = "Could not load the kitchen. See the console for details.";
    console.error(error);
  });
