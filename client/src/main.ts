import { ArcRotateCamera, Engine, Scene, Vector3, type TransformNode } from "@babylonjs/core";
import {
  EMOTES,
  ROLE_KEYS,
  ROLES,
  createGame,
  describeSurroundings,
  guideFor,
  levelByNumber,
  payingDiners,
  TUTORIAL,
  targetStation,
  type Action,
  type Chef,
  type Emote,
  type Game,
  type Input,
  type Role,
  type Station,
  venueById,
  currentSenses,
  perceivesEvent,
} from "@kitchen/shared";
import { AssetLibrary } from "./assets";
import { Atmosphere } from "./game/atmosphere";
import { Effects } from "./game/effects";
import { Feedback } from "./game/feedback";
import { stockName } from "./game/hints";
import { Hud } from "./game/hud";
import { setupLook } from "./game/look";
import { PovController } from "./game/pov";
import { RecipeBook } from "./game/recipeBook";
import { SignWheel } from "./game/signWheel";
import { GameView } from "./game/view";
import { addTakings, canPlay } from "./business";
import { finishDaily, todaysSpecial } from "./daily";
import { Lobby } from "./lobby";
import { recordScore, recordStars } from "./progress";
import { LocalSession, NetSession, type Session } from "./session";
import { Music } from "./music";
import { PREFS, level, pref, type PrefName } from "./prefs";
import { ownedDecor } from "./decor";
import { buildTerrace } from "./game/terrace";
import { checkLive, checkProgress, finishShift, hasSticker, startShift, type Sticker } from "./stickers";
import { readText, writeText } from "./storage";
import { startTelemetry, track } from "./telemetry";
import { TouchControls, canFullscreen, canTouch, goFullscreen, isFullscreen, toggleFullscreen, wantsTouch } from "./touch";
import { Album, StickerPop, showShiftStickers } from "./ui/album";
import { Briefing } from "./ui/briefing";
import { $, releasePointer } from "./ui/dom";
import { setupHowToPlay } from "./ui/howToPlay";
import { hydrateIcons } from "./ui/icons";
import { setupMenuKeys } from "./ui/keyboard";
import { saveViewPref, setupSettings, viewPref } from "./ui/settings";
import { Shop } from "./ui/shop";
import { TitleScreen } from "./ui/title";
import { Voice } from "./voice";
const canvas = $<HTMLCanvasElement>("scene");
void startTelemetry();
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
const title = new TitleScreen(camera, fitCamera);

const hud = new Hud();
const feedback = new Feedback($("announce-polite"), $("announce-urgent"), $<HTMLOListElement>("log"));
$<HTMLInputElement>("speak").addEventListener("change", (e) => {
  feedback.speak = (e.target as HTMLInputElement).checked;
});

let session: Session | null = null;
let view: GameView | null = null;
let paused = false;
let shownGameOver = false;
let lastCoach: string | null = null;

const meNow = (): Chef | null => session?.me ?? null;

// --- roles ----------------------------------------------------------------------

const ROLE_STORAGE_KEY = "kitchen.role";
const savedRole = readText(ROLE_STORAGE_KEY);
let soloRole: Role = savedRole && savedRole in ROLES ? (savedRole as Role) : "full";

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
  writeText(ROLE_STORAGE_KEY, role);
  feedback.say(`You are now the ${ROLES[role].name.toLowerCase()}. ${ROLES[role].summary}`);
}

for (const input of document.querySelectorAll<HTMLInputElement>("input[name=role]")) {
  input.addEventListener("change", () => setSoloRole(input.value as Role));
}

// --- actions ----------------------------------------------------------------------

/** Where the crosshair lands, in first person: the first thing in its way, or the floor. */
function crosshairSpot(): { x: number; z: number } | undefined {
  if (!pov.active) return undefined;
  const ray = pov.camera.getForwardRay(40);
  const hit = scene.pickWithRay(ray, (m) => m.isVisible && m.isEnabled() && !/ping|tag/i.test(m.name));
  if (hit?.hit && hit.pickedPoint) return { x: hit.pickedPoint.x, z: hit.pickedPoint.z };
  if (ray.direction.y >= 0) return undefined;
  const t = -ray.origin.y / ray.direction.y;
  return { x: ray.origin.x + ray.direction.x * t, z: ray.origin.z + ray.direction.z * t };
}

/** Signals and signs are the mute chef's voice; everyone else just talks. */
function maySignal(me: Chef): boolean {
  if (ROLES[me.role].signals) return true;
  feedback.say("You can talk, so signals are left to the mute chef.");
  return false;
}

function act(action: Action) {
  const me = meNow();
  if (!session || !me || paused) return;
  if ((action === "ping" || action === "bell") && !maySignal(me)) return;
  session.act(action, action === "ping" ? crosshairSpot() : undefined);
}

function sendEmote(word: Emote) {
  const me = meNow();
  if (!session || !me || paused || !maySignal(me)) return;
  session.emote(word);
}

const wheel = new SignWheel(
  canvas,
  () => !!meNow() && ROLES[meNow()!.role].signals,
  (word) => {
    feedback.unlock();
    sendEmote(word);
  },
  (open) => (pov.frozen = open),
);

for (const button of document.querySelectorAll<HTMLButtonElement>("#signals [data-signal], #emote-wheel [data-signal]")) {
  button.addEventListener("click", () => {
    feedback.unlock();
    wheel.show(false);
    act(button.dataset.signal === "ping" ? "ping" : "bell");
    canvas.focus();
  });
}

// --- pausing: solo, the kitchen waits while a menu, the recipe book, the keys, the shop or a
// briefing is open; online it keeps going, since your friends are still cooking

/** The dialogs that hold a solo kitchen still (listed once they all exist, below). */
const holding: HTMLDialogElement[] = [];

function holdKitchen() {
  if (!session?.game || session.game.phase !== "playing" || session.online || paused) return;
  paused = true;
  feedback.setPaused(true);
}

/** Starts the kitchen again once the last of those dialogs has closed; true if it did. */
function releaseKitchen(): boolean {
  if (!paused || holding.some((d) => d.open)) return false;
  paused = false;
  feedback.setPaused(false);
  return true;
}

// --- menus --------------------------------------------------------------------------

const pauseMenu = $<HTMLDialogElement>("pause-menu");
const helpCard = $<HTMLDialogElement>("help");

function openMenu() {
  const game = session?.game;
  if (!game || game.phase !== "playing" || pauseMenu.open) return;
  releasePointer();
  $("pause-note").textContent = session?.online ? "Your friends are still cooking — the kitchen doesn't stop online!" : "The kitchen is on hold.";
  $("pause-title").textContent = session?.online ? "Menu" : "Paused";
  holdKitchen();
  pauseMenu.showModal();
}

function closeMenu() {
  if (pauseMenu.open) pauseMenu.close();
}

// going from the menu straight into the recipe book or the tips keeps the kitchen paused
pauseMenu.addEventListener("close", () => {
  if (releaseKitchen()) feedback.say("Back to the kitchen!");
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
  releasePointer();
  closeMenu();
  holdKitchen();
  book.show(game, me.role);
}

book.dialog.addEventListener("close", () => {
  releaseKitchen();
  canvas.focus();
});
$("book-button").addEventListener("click", () => {
  feedback.unlock();
  openBook();
});
$("open-book").addEventListener("click", openBook);

function openHelp() {
  releasePointer();
  holdKitchen();
  helpCard.showModal();
}
$("open-help").addEventListener("click", openHelp);
$("close-help").addEventListener("click", () => helpCard.close());
for (const tab of helpCard.querySelectorAll<HTMLInputElement>("input[name=help-tab]")) {
  tab.addEventListener("change", () => {
    for (const panel of helpCard.querySelectorAll<HTMLElement>(".help-panel")) panel.hidden = panel.dataset.tab !== tab.value;
  });
}
helpCard.addEventListener("close", () => {
  releaseKitchen();
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
  const game = session?.game;
  if (!me || !game) return;
  startShift();
  lobby.hide();
  if (title.showing) title.show(false);
  view?.clearItems();
  paused = false;
  shownGameOver = false;
  hud.hideGameOver();
  hud.reset();
  feedback.clearLog();
  $("hud").hidden = false;
  presentRole(me.role);
  $("role-picker").hidden = session?.online ?? false;
  // the camera from Settings (phones default to third person: one thumb walks)
  setFirstPerson(viewPref() === "fpp");
  canvas.focus();
  lastCoach = null;
  track("shift_start", { level: game.level, role: me.role, players: game.chefs.length });
  showBriefing();
}

// --- shift briefing: what's new on this level, and how your chef plays ---------------------

const briefing = new Briefing();

/** @param force from the pause menu's Tips: show it again */
function showBriefing(force = false) {
  const game = session?.game;
  const me = meNow();
  if (!game || !me || !briefing.due(game.level, force || !!game.twist)) return;
  releasePointer();
  holdKitchen(); // solo waits while you read; online the kitchen keeps going
  briefing.open(game.level, me.role, feedback.speak, game.twist);
}

briefing.dialog.addEventListener("close", () => {
  releaseKitchen();
  canvas.focus();
});
$("open-briefing").addEventListener("click", () => {
  closeMenu();
  showBriefing(true);
});

// --- the upgrades shop (at the till, or from the play menu) ------------------------------

// --- stickers: earned in the middle of a shift (a toast) or at its end (on the end screen) ---

const album = new Album();
const stickerPop = new StickerPop();
checkProgress(); // progress from before there were stickers counts too
album.refreshButton();

function stickerToasts(stickers: Sticker[]) {
  if (!stickers.length) return;
  stickerPop.show(stickers);
  for (const s of stickers) feedback.sticker(`New sticker: ${s.name}!`);
}

const shop = new Shop((name, kind) => {
  if (kind === "decor") dressTerrace();
  feedback.say(kind === "upgrade" ? `Bought ${name}. It's in place from your next shift.` : `Bought ${name}.`, false, true, "paid");
  stickerToasts(checkProgress());
});

function openShop() {
  releasePointer();
  holdKitchen();
  shop.open();
}

$("open-shop").addEventListener("click", openShop);
shop.dialog.addEventListener("close", () => {
  releaseKitchen();
  if (session?.game) canvas.focus();
});

holding.push(pauseMenu, helpCard, book.dialog, briefing.dialog, shop.dialog);

// --- learning: the How to play guide and the tutorial kitchen (both from the title screen) ---

const how = setupHowToPlay(startTutorial);

function startTutorial() {
  how.close();
  if (title.showing) title.show(false);
  feedback.unlock();
  session = new LocalSession(soloRole, TUTORIAL.n);
  beginRound();
}

$("open-how").addEventListener("click", how.open);
$("title-how").addEventListener("click", how.open);
$("play-tutorial").addEventListener("click", startTutorial);

const lobby = new Lobby({
  solo() {
    feedback.unlock();
    session = new LocalSession(soloRole, lobby.level, lobby.twist ?? undefined);
    beginRound();
    feedback.say("Practice kitchen open! Keys 0–3 switch chefs. Press Q any time to hear what's around you.");
  },
  daily() {
    feedback.unlock();
    const { level, twist } = todaysSpecial();
    session = new LocalSession(soloRole, level, twist.id);
    beginRound();
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
  chooseLevel(level, twist) {
    if (session instanceof NetSession) session.chooseLevel(level, twist);
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
    const others = net.game!.chefs.filter((c) => !c.bot && c.id !== me.id).map((c) => c.id);
    void voice.start(me.id, me.role, others);
  };
  net.onRtc = (from, data) => void voice.handle(from, data as Parameters<Voice["handle"]>[1]);
  net.onReconnecting = (attempt) => {
    if (attempt > 1) return;
    if (net.game) feedback.say("Lost connection to the kitchen. Reconnecting…", true);
    else lobby.setError("Lost connection. Reconnecting…");
  };
  net.onReconnected = () => {
    lobby.setError("");
    if (net.game) feedback.say("Back in the kitchen!");
  };
  net.onClose = () => {
    voice.stop();
    if (net.game) feedback.say("Couldn't get back to the kitchen. Refresh to try again.", true);
    else lobby.setError("Couldn't reach the kitchen server. Is it running?");
  };
}

// --- input --------------------------------------------------------------------

const keys = new Set<string>();
const GAME_KEYS = new Set([
  "KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight",
  "Space", "KeyE", "KeyF", "KeyQ", "KeyP", "Escape", "KeyR", "KeyV", "KeyH",
  "KeyG", "KeyB", "KeyT", "KeyZ", "KeyN", "Slash", "F1", "Digit0", "Digit1", "Digit2", "Digit3", "Digit5", "Digit6",
  "Digit7", "Digit8", "BracketLeft", "BracketRight",
]);

const held = (...codes: string[]) => codes.some((c) => keys.has(c));
const axis = (plus: string[], minus: string[]) => Number(held(...plus)) - Number(held(...minus));

// --- touch: the joystick walks, the buttons press the same keys as the keyboard --------------
const touch = canTouch()
  ? new TouchControls(canvas, {
      press: (code) => window.dispatchEvent(new KeyboardEvent("keydown", { code })),
      release: (code) => window.dispatchEvent(new KeyboardEvent("keyup", { code })),
      look: (dx, dy) => {
        if (!pov.active) return;
        pov.yaw += dx * 0.006;
        pov.pitch = Math.min(1.1, Math.max(-0.6, pov.pitch + dy * 0.006));
      },
    }, wantsTouch())
  : null;
/** the touch layout is showing right now */
const touchMode = () => !!touch?.active;

// --- settings: the camera view and play stats, remembered between games
const openSettings = setupSettings(
  (view) => {
    if (session?.game) setFirstPerson(view === "fpp");
  },
  (name) => applyPref(name),
);

/** Put a comfort setting into effect (all of them once at startup). */
function applyPref(name: PrefName) {
  const root = document.documentElement;
  if (name === "sound") feedback.setVolume(level(pref("sound")));
  else if (name === "voices") voice.setVolume(level(pref("voices")));
  else if (name === "text") root.classList.toggle("large-text", pref("text") === "large");
  else if (name === "motion") root.classList.toggle("reduce-motion", pref("motion") === "reduced");
  else if (name === "graphics") {
    // phones get the fast setting unless told otherwise: fewer pixels and no shadows
    const fast = pref("graphics") === "low" || (pref("graphics") === "auto" && matchMedia("(pointer: coarse)").matches);
    engine.setHardwareScalingLevel(fast ? 1.5 : 1);
    scene.shadowsEnabled = !fast;
  }
}
for (const name of Object.keys(PREFS) as PrefName[]) applyPref(name);
for (const id of ["open-settings", "lobby-settings", "title-settings"]) $(id).addEventListener("click", openSettings);

if (touch) {
  hud.onHints = (hints) => touch.setHints(hints);
  // starting a game from a phone: fill the screen and hold it sideways
  document.addEventListener("click", (e) => {
    if (touchMode() && (e.target as Element).closest("#lobby button, #briefing button")) goFullscreen();
  });
  // the full-screen buttons: shown where the browser can hide its bars, lit while it has
  const fsButtons = document.querySelectorAll<HTMLButtonElement>(".fs-toggle");
  const showFs = () => {
    for (const b of fsButtons) {
      b.hidden = !canFullscreen() && !isFullscreen();
      b.classList.toggle("on", isFullscreen());
      b.setAttribute("aria-label", isFullscreen() ? "Leave full screen" : "Full screen");
    }
  };
  for (const b of fsButtons) b.addEventListener("click", toggleFullscreen);
  document.addEventListener("fullscreenchange", showFs);
  document.addEventListener("webkitfullscreenchange", showFs);
  showFs();
  // switching between fingers and keyboard / mouse: reframe the overhead camera for that layout
  touch.onChange = () => fitCamera();
}

// tapping an item in the fridge / spice picker chooses it, like its number key; tapping it again uses it
$("picker").addEventListener("click", (e) => {
  const chip = (e.target as Element).closest<HTMLElement>(".pick");
  if (!chip?.dataset.index) return;
  // a second tap on the chosen one takes it, like Use
  const code = chip.classList.contains("on") ? "Space" : `Digit${Number(chip.dataset.index) + 1}`;
  window.dispatchEvent(new KeyboardEvent("keydown", { code }));
  window.dispatchEvent(new KeyboardEvent("keyup", { code }));
});

function readInput(): Input {
  const chop = held("KeyF");
  const stick = touchMode() && (touch!.move.x || touch!.move.y) ? touch!.move : null;
  const forward = stick ? stick.y : axis(["KeyW", "ArrowUp"], ["KeyS", "ArrowDown"]);
  if (!pov.active) {
    // overhead: screen-relative movement, chef turns to where it walks
    return { moveX: stick ? stick.x : axis(["KeyD", "ArrowRight"], ["KeyA", "ArrowLeft"]), moveZ: forward, chop };
  }
  // first person: W/S walk where you look, A/D strafe (arrow left/right turn, see the loop)
  const strafe = stick ? stick.x : axis(["KeyD"], ["KeyA"]);
  const sin = Math.sin(pov.yaw);
  const cos = Math.cos(pov.yaw);
  return { moveX: sin * forward + cos * strafe, moveZ: cos * forward - sin * strafe, chop, facing: pov.yaw, pitch: pov.pitch };
}

function setFirstPerson(on: boolean) {
  const me = meNow();
  if (on && me) pov.yaw = me.facing;
  else if (!on) releasePointer();
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
  // a focused HUD button presses like any button
  if (target?.closest("button, a") && (e.code === "Space" || e.code === "Enter")) return;
  // after clicking a panel control (e.g. the speech checkbox), game keys go back to the game
  if (target?.closest("input, a, button")) canvas.focus();
  e.preventDefault();
  feedback.unlock();
  keys.add(e.code);
  if (e.repeat) return;
  const me = meNow();
  switch (e.code) {
    case "Space":
    case "KeyE": {
      // at the till with nobody waiting to pay, Space opens the upgrades shop
      const st = me && session.game.phase === "playing" ? targetStation(session.game, me) : null;
      if (st?.kind === "register" && payingDiners(session.game).length === 0) openShop();
      else act("interact");
      break;
    }
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
      if (me) {
        const next = guideFor(session.game, me)?.next;
        feedback.say(`${describeSurroundings(session.game, me)}${next ? ` Next: ${next}.` : ""}`);
      }
      break;
    case "KeyP":
    case "Escape":
      openMenu();
      break;
    case "Slash":
    case "F1":
      openHelp();
      break;
    case "KeyT":
      wheel.toggle();
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
      saveViewPref(pov.active ? "fpp" : "tpp");
      feedback.say(pov.active ? "First-person view." : "Overhead view.");
      break;
    default:
      if (e.code.startsWith("Digit")) {
        const digit = Number(e.code.slice(5));
        // with the wheel open 1-6 sends a sign; otherwise 0-3 picks the chef (solo practice)
        const stock = stockStation();
        if (wheel.open || keys.has("KeyT")) {
          const word = EMOTES[digit - 1];
          if (word) sendEmote(word);
          wheel.show(false);
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
  const me = meNow();
  if (st && me && session?.game) {
    // start on what the coach says you need here, else the first item
    const guide = guideFor(session.game, me);
    const pick = guide?.target?.id === st.id && guide.pick !== null ? guide.pick : 0;
    session.setPick(pick);
    feedback.pickCue(pick, stockName(st, st.stock![pick]), me);
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

window.addEventListener("keyup", (e) => keys.delete(e.code));
window.addEventListener("blur", () => keys.clear());
canvas.addEventListener("pointerdown", (e) => {
  feedback.unlock();
  canvas.focus();
  // mouse-look only: on a phone the lock grabs every touch (and the browser pops its exit banner)
  if (e.pointerType === "mouse" && pov.active && session?.game?.phase === "playing") pov.lockPointer();
});
$("restart").addEventListener("click", () => restart());
$("next-level").addEventListener("click", () => restart((session?.game?.level ?? 0) + 1));

const music = new Music(() => feedback.audioContext);

// --- power cut and storm ----------------------------------------------------------

const atmosphere = new Atmosphere(
  (darkness, lightning) => look.setAtmosphere(darkness, lightning),
  (ducked) => voice.setDucked(ducked),
);

// --- loop ---------------------------------------------------------------------

scene.onBeforeRenderObservable.add(() => {
  const game = session?.game;
  const me = meNow();
  if (!view || !session || !game || !me) return;
  if (`${game.venue}|${game.layout}` !== kitchenKey) buildKitchen(game); // another restaurant, or another layout
  const dt = Math.min(engine.getDeltaTime() / 1000, 0.05);
  // phones: the overhead camera glides after your chef
  if (touchMode() && !pov.active) {
    const k = 1 - Math.exp(-dt * 5);
    camera.target.x += (me.x - camera.target.x) * k;
    camera.target.z += (me.z - 0.2 - camera.target.z) * k;
  }
  if (!paused) {
    if (pov.active) pov.turn(axis(["ArrowRight"], ["ArrowLeft"]), dt);
    session.step(dt, readInput());
    resetPickOnNewStation();
  }
  for (const event of session.drainEvents()) {
    feedback.handle(event, me, game);
    if (event.kind === "served") effects.confetti(event.x, event.z);
    // points fly up out of the pass (and away, in red, when something costs them)
    const gained = event.kind === "served" || event.kind === "combo" || event.kind === "critic" ? event.text?.match(/[Pp]lus (\d+)/)?.[1] : undefined;
    const lost = event.text?.match(/[Mm]inus (\d+) points/)?.[1];
    const seen = currentSenses(game, me).sees && perceivesEvent(game, me, event);
    if (gained && seen) view.floatPoints(`+${gained}`, event.x, event.z);
    else if (lost && seen) view.floatPoints(`−${lost}`, event.x, event.z, false);
  }
  stickerToasts(checkLive(game, me));
  effects.sync(game);
  if (game.phase === "over" && !shownGameOver) {
    shownGameOver = true;
    addTakings(game.coins ?? 0); // the shift's takings go into the restaurant's money
    const stars = hud.showGameOver(game, me.id);
    track("shift_end", { level: game.level, stars, coins: game.coins ?? 0, players: game.chefs.length, twist: game.twist ?? null });
    if (game.twist) {
      // a daily special stands alone: no level stars, and no "next level"
      const daily = finishDaily(game.score, stars);
      if (daily.bonus) {
        addTakings(daily.bonus);
        feedback.say(`Daily special done! Plus ${daily.bonus} coins${daily.streak > 1 ? ` for a ${daily.streak}-day streak` : ""}.`, false, true, "paid");
      } else if (daily.best) feedback.say(`New best today: ${game.score} points!`);
      $("next-level").hidden = true;
    } else {
      if (recordStars(game.level, stars)) feedback.say(`New best on this level: ${stars} of 3 stars!`);
      if (recordScore(game.level, game.score) && game.overtime > 0) feedback.say(`New high score on this level: ${game.score}!`);
    }
    // the next shift may be at a restaurant that isn't open yet
    if (!canPlay(game.level + 1)) $("next-level").hidden = true;
    lobby.refreshLevels(game.level);
    showShiftStickers(finishShift(game, stars));
    album.refreshButton();
    releasePointer();
  }
  if (game.phase === "playing" && shownGameOver) {
    // an online round restarted by a teammate
    shownGameOver = false;
    hud.hideGameOver();
  }
  atmosphere.update(game, dt);
  music.update(game.phase === "playing" && !paused, game.rush > 0 || game.timeLeft <= 30, !currentSenses(game, me).hears);
  pov.sync(me.x, me.z);
  view.sync(game, me, paused ? 0 : dt, pov.active ? pov.handPosition() : null);
  if (!paused) feedback.update(game, me, dt);
  voice.update(game, me);
  const faced = game.phase === "playing" ? targetStation(game, me) : null;
  hud.update(game, me, pov.active, faced ? view.barState(faced.id) : null);

  // the coach: a checklist for what's in hand; in the guided first shift, the next step with an arrow
  const guide = guideFor(game, me);
  const tutorial = !!levelByNumber(game.level).tutorial;
  hud.syncGuide(game, guide, tutorial);
  view.setGuideTarget(tutorial ? (guide?.target ?? null) : null);
  if (tutorial && guide?.next && guide.next !== lastCoach && !briefing.open) {
    lastCoach = guide.next;
    feedback.coach(guide.next);
  }
});

if (import.meta.env.DEV) Object.assign(window, { getSession: () => session, isPaused: () => paused, scene, pov, voice }); // console debugging

// Footprint of the floating island in Kitchen_Room.glb (metres).
const ISLAND = { width: 11.1, depth: 10.6 };

/** Pull the overhead camera back just far enough that the whole island fits the canvas. */
function fitCamera() {
  if (title.showing) return; // the title screen frames its own view
  const aspect = engine.getRenderWidth() / engine.getRenderHeight();
  // phones: frame the area around your chef (the camera follows you), not the whole island
  const halfWidth = touchMode() ? 3.6 : ISLAND.width / 2 + 0.3;
  // depth is foreshortened by the camera tilt; add room for the walls and the HUD
  const halfHeight = touchMode() ? 2.6 : (ISLAND.depth / 2) * Math.cos(camera.beta) + 1.8;
  const hFov = 2 * Math.atan(Math.tan(camera.fov / 2) * aspect);
  camera.radius = Math.max(halfWidth / Math.tan(hFov / 2), halfHeight / Math.tan(camera.fov / 2));
}

// --- the title screen --------------------------------------------------------------

setupMenuKeys();
$("title-play").addEventListener("click", () => {
  feedback.unlock();
  if (touchMode()) goFullscreen();
  // the very first time, straight into the tutorial kitchen (unless a friend's invite is waiting)
  if (firstVisit()) {
    writeText(WELCOMED_KEY, "1");
    startTutorial();
    return;
  }
  lobby.show();
});

const WELCOMED_KEY = "kitchen.welcomed";

function firstVisit(): boolean {
  if (new URLSearchParams(location.search).has("room")) return false;
  return [WELCOMED_KEY, "kitchen.stars", "kitchen.business"].every((key) => readText(key) === null) && !hasSticker("tutorial");
}

engine.runRenderLoop(() => scene.render());
window.addEventListener("resize", () => {
  engine.resize();
  fitCamera();
});
fitCamera();

/** the terrace decor you've bought (rebuilt with the kitchen, or after buying more) */
let terrace: TransformNode | null = null;
function dressTerrace() {
  terrace?.dispose(false, true);
  terrace = buildTerrace(scene, ownedDecor());
}

let library: AssetLibrary | null = null;
let room: TransformNode | null = null;
/** the restaurant and layout the 3D kitchen was built for */
let kitchenKey: string | null = null;

/** Build (or rebuild) the room and stations for the restaurant this game is at. */
function buildKitchen(game: Game) {
  if (!library) return;
  view?.dispose();
  room?.dispose(false, false);
  // The room is modelled in Blender around the station grid; turning it half a circle maps
  // Blender's (x, y) onto the game's (x, z).
  const name = venueById(game.venue).room;
  room = library.spawn(library.has(name) ? name : "Kitchen_Room");
  dressTerrace();
  room.rotation.y = Math.PI;
  for (const mesh of room.getChildMeshes()) {
    mesh.receiveShadows = true;
    if (/Terrace|Nature|RangeHood|Shelves|Window|WallDecor|Decor/.test(mesh.name)) shadows.addShadowCaster(mesh);
  }
  // stations never move during a shift, so the game's layout builds the kitchen
  view = new GameView(scene, library, shadows, game);
  view.onFootstep = (chefId, x, z) => {
    const me = meNow();
    if (me && session?.game) feedback.footstep(x, z, me, session.game, chefId === me.id);
  };
  kitchenKey = `${game.venue}|${game.layout}`;
}

AssetLibrary.load(scene)
  .then((lib) => {
    library = lib;
    buildKitchen(createGame());
    $("loading").hidden = true;
    presentRole(soloRole);
    title.show(true);
    // an invite link goes straight to the room code
    if (new URLSearchParams(location.search).has("room")) lobby.show();
  })
  .catch((error) => {
    $("loading").textContent = "Could not load the kitchen. See the console for details.";
    console.error(error);
  });
