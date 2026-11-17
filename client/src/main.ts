import { ArcRotateCamera, Engine, Scene, Vector3, type TransformNode } from "@babylonjs/core";
import {
  EMOTES,
  ROLE_KEYS,
  ROLES,
  createGame,
  describeSurroundings,
  guideFor,
  LEVELS,
  levelByNumber,
  paceOf,
  payingDiners,
  seasonTarget,
  type Pinch,
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
  VENUES,
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
import { bestStars, recordScore, recordStars } from "./progress";
import { LocalSession, NetSession, type Session } from "./session";
import { clearSolo, saveSolo, savedSolo, seatedRoom, setSeatedRoom } from "./resume";
import { PourMeter, type PourResult } from "./ui/pour";
import { Music } from "./music";
import { PREFS, level, lookSpeed, pref, resetProgress, savePref, type PrefName } from "./prefs";
import { ownedDecor } from "./decor";
import { buildTerrace } from "./game/terrace";
import { checkLive, checkProgress, finishShift, hasSticker, startShift, type Sticker } from "./stickers";
import { readText, writeText } from "./storage";
import { startTelemetry, track } from "./telemetry";
import { TouchControls, canFullscreen, canTouch, goFullscreen, isFullscreen, keepAwake, toggleFullscreen, wantsTouch } from "./touch";
import { Album, StickerPop, showShiftStickers } from "./ui/album";
import { Briefing } from "./ui/briefing";
import { $, releasePointer } from "./ui/dom";
import { glyph, hydrateIcons } from "./ui/icons";
import { setupMenuKeys } from "./ui/keyboard";
import { saveViewPref, setupSettings, viewPref } from "./ui/settings";
import { Shop } from "./ui/shop";
import { TitleScreen } from "./ui/title";
import { Voice } from "./voice";
import { LANG, LANG_NAMES, setLang, utterance } from "./i18n";
import { localizePage } from "./i18n/dom";
const canvas = $<HTMLCanvasElement>("scene");
void startTelemetry();
hydrateIcons(); // fill every data-icon / data-img placeholder in the page
localizePage(); // the page in the player's language (Burmese is translated as it's shown)

const engine = new Engine(canvas, true, { stencil: true });
const scene = new Scene(engine);
// nothing in the kitchen reacts to the mouse hovering or clicking a mesh (aiming uses its own ray),
// so skip Babylon's picking on every pointer event: hundreds of meshes, every move
scene.skipPointerMovePicking = true;
scene.skipPointerDownPicking = true;
scene.skipPointerUpPicking = true;

// Overhead view (V): looks at the whole floating restaurant from the terrace side.
const camera = new ArcRotateCamera("camera", -Math.PI / 2, 0.85, 12, new Vector3(0, 0, -1.1), scene);
camera.minZ = 0.05;
camera.fov = 0.7;
// Default view: first person from the chef's eyes.
const pov = new PovController(scene, canvas);
scene.activeCamera = camera;

const look = setupLook(scene, [pov.camera, camera]);
const effects = new Effects(scene);
const { shadows, roomShadows } = look;
const title = new TitleScreen(camera, fitCamera);

const hud = new Hud();
const feedback = new Feedback($("announce-polite"), $("announce-urgent"), $<HTMLOListElement>("log"));
// read aloud and the microphone: in Settings, and one tap away in the pause menu
for (const name of ["speak", "mic"] as const) {
  $<HTMLInputElement>(name).addEventListener("change", (e) => {
    savePref(name, (e.target as HTMLInputElement).checked ? "on" : "off");
    applyPref(name);
  });
}

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

/** @param pinch with a spice bottle by the food: how the pour went at the meter */
function act(action: Action, pinch?: Pinch) {
  const me = meNow();
  if (!session || !me || paused) return;
  if ((action === "ping" || action === "bell") && !maySignal(me)) return;
  session.act(action, action === "ping" ? crosshairSpot() : undefined, pinch);
}

// --- the pour meter: hold Use with a spice bottle by the food, let go in the band -------------
const pour = new PourMeter();

/** Use pressed: with a spice bottle by something to season, start pouring instead of using. */
function startPour(): boolean {
  if (pour.active) return true; // already pouring (Space and E both held)
  const me = meNow();
  const game = session?.game;
  if (!me?.spice || !game || paused || pref("meter") === "off" || !seasonTarget(game, me)) return false;
  pour.begin(me.spice.spice, me.role, game.pace ?? "classic");
  return true;
}

/** Use let go (or the pour ran over): season, unless it was too little to count. */
function finishPour(result: PourResult | null) {
  if (!result) return;
  feedback.pinch(result);
  if (result !== "light") act("interact", result);
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

/** A phone held upright: the "turn sideways" card is over the kitchen, so a solo shift waits. */
const upright = () => document.body.classList.contains("touch") && matchMedia("(orientation: portrait)").matches;
matchMedia("(orientation: portrait)").addEventListener("change", () => {
  if (upright()) holdKitchen();
  else if (releaseKitchen()) canvas.focus();
});

/** The dialogs that hold a solo kitchen still (listed once they all exist, below). */
const holding: HTMLDialogElement[] = [];

function holdKitchen() {
  if (!session?.game || session.game.phase !== "playing" || session.online || paused) return;
  paused = true;
  feedback.setPaused(true);
}

/** Starts the kitchen again once the last of those dialogs has closed; true if it did. */
function releaseKitchen(): boolean {
  if (!paused || holding.some((d) => d.open) || upright()) return false;
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

function openBook(recipeId?: string) {
  const game = session?.game;
  const me = meNow();
  if (!game || !me || game.phase !== "playing" || book.open) return;
  releasePointer();
  closeMenu();
  holdKitchen();
  book.show(game, me.role, recipeId);
}
hud.onRecipe = (recipeId) => {
  feedback.unlock();
  openBook(recipeId);
};

book.dialog.addEventListener("close", () => {
  releaseKitchen();
  canvas.focus();
});
$("book-button").addEventListener("click", () => {
  feedback.unlock();
  openBook();
});
$("open-book").addEventListener("click", () => openBook());

/** How to play: Basics, Cooking and Controls. In a shift it opens on the controls. */
function openHelp() {
  const playing = !!session?.game;
  if (playing) {
    releasePointer();
    holdKitchen();
  }
  $("help-tutorial").hidden = playing || !!session;
  const tab = helpCard.querySelector<HTMLInputElement>(`input[name=help-tab][value=${playing ? "keys" : "basics"}]`)!;
  tab.checked = true;
  tab.dispatchEvent(new Event("change"));
  helpCard.showModal();
}
for (const id of ["open-help", "open-how", "title-how", "room-how"]) $(id).addEventListener("click", openHelp);
$("help-tutorial").addEventListener("click", () => startTutorial());
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
/** Back to the title screen (the server keeps an online seat for a while if you return). */
function leaveKitchen() {
  leaving = true; // so the page going away doesn't save the shift again
  clearSolo();
  setSeatedRoom(null);
  location.href = location.pathname;
}
// Leave and Restart ask first: a stray tap mid-shift would throw the shift away. The pair turns
// into Yes and No in place, each button keeping its size, and the line under them asks the question.
// No is where Leave was, so a double tap on Leave cancels; Yes ignores taps for a moment after the swap.
{
  const yes = $<HTMLButtonElement>("restart-shift");
  const no = $<HTMLButtonElement>("quit");
  const row = yes.parentElement!;
  const note = $("confirm-note");
  const faces = [
    { button: yes, label: $("restart-shift-label"), icon: "restart", words: "Restart", asking: "check", answer: "Yes" },
    { button: no, label: $("quit-label"), icon: "exit", words: "Leave", asking: "cross", answer: "No" },
  ];
  let pending: "leave" | "restart" | null = null;
  let since = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let wasHidden = false;
  const settle = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    if (!pending) return;
    pending = null;
    row.classList.remove("asking");
    note.textContent = "";
    yes.hidden = wasHidden;
    for (const f of faces) {
      f.button.style.width = "";
      f.button.querySelector("i")!.replaceChildren(glyph(f.icon));
      f.label.textContent = f.words;
    }
  };
  const ask = (what: "leave" | "restart") => {
    // online there's no Restart: Yes borrows its place, as wide as Leave
    const widths = faces.map((f) => (f.button.hidden ? no : f.button).getBoundingClientRect().width);
    wasHidden = yes.hasAttribute("hidden");
    yes.hidden = false;
    pending = what;
    since = performance.now();
    row.classList.add("asking");
    note.textContent = what === "restart" ? "Start this shift over?" : session?.online ? "Leave the kitchen?" : "Leave? This shift ends.";
    faces.forEach((f, i) => {
      f.button.style.width = `${widths[i]}px`;
      f.button.querySelector("i")!.replaceChildren(glyph(f.asking));
      f.label.textContent = f.answer;
    });
    timer = setTimeout(settle, 5000);
  };
  yes.addEventListener("click", () => {
    if (!pending) return ask("restart");
    if (performance.now() - since < 400) return;
    const what = pending;
    settle();
    if (what === "leave") return leaveKitchen();
    closeMenu();
    restart();
  });
  no.addEventListener("click", () => (pending ? settle() : ask("leave")));
  pauseMenu.addEventListener("close", settle);
}

/** A solo shift is over (or skipped): back to the play menu, without loading the page again. */
function backToMenu() {
  clearSolo();
  session = null;
  hud.hideGameOver();
  $("hud").hidden = true;
  setFirstPerson(false);
  view?.clearItems();
  showContinue();
  keepAwake(false);
  title.show(true);
  lobby.show();
}

// the end screen's way out: solo, straight back to the play menu; online, leave the kitchen
$("over-menu").addEventListener("click", () => {
  if (!session || session.online) return leaveKitchen();
  backToMenu();
});

/** The title's Continue: straight into the next shift, once there are stars to continue from. */
let continueLevel = 0;
function showContinue() {
  const done = LEVELS.filter((l) => bestStars(l.n) > 0).map((l) => l.n);
  const last = Math.max(0, ...done);
  continueLevel = last && canPlay(last + 1) ? last + 1 : last;
  const button = $<HTMLButtonElement>("title-continue");
  button.hidden = !continueLevel;
  if (continueLevel) button.textContent = `Continue · ${levelByNumber(continueLevel).name}`;
}
$("title-continue").addEventListener("click", () => {
  feedback.unlock();
  if (touchMode()) goFullscreen();
  title.show(false);
  session = new LocalSession(soloRole, continueLevel);
  beginRound();
});

// the tutorial's card has a way out for players who know this kind of game
$("briefing-skip").addEventListener("click", () => {
  writeText(WELCOMED_KEY, "1");
  briefing.dialog.close();
  backToMenu();
});

// --- sessions -----------------------------------------------------------------------

const voice = new Voice(
  (to, data) => (session instanceof NetSession ? session.send({ t: "rtc", to, data }) : undefined),
  () => feedback.audioContext,
  (message) => feedback.say(message),
);

/** @param resumed carrying on a shift from before a reload: no fresh start, no briefing */
function beginRound(resumed = false) {
  const me = meNow();
  const game = session?.game;
  if (!me || !game) return;
  if (!resumed) startShift();
  lobby.hide();
  if (title.showing) title.show(false);
  view?.clearItems();
  paused = false;
  shownGameOver = false;
  hud.hideGameOver();
  hud.reset();
  feedback.clearLog();
  $("hud").hidden = false;
  keepAwake(true);
  if (upright()) holdKitchen();
  presentRole(me.role);
  $("role-picker").hidden = session?.online ?? false;
  $("mic-toggle").hidden = !session?.online;
  $("restart-shift").hidden = !!session?.online;
  $("toggle-view-label").textContent = pov.active ? "Chef's eyes" : "From above";
  // the camera from Settings (phones default to third person: one thumb walks)
  setFirstPerson(viewPref() === "fpp");
  canvas.focus();
  lastCoach = null;
  if (resumed) return;
  track("shift_start", { level: game.level, role: me.role, players: game.chefs.length, pace: game.pace ?? "classic" });
  showBriefing();
}

/** A solo shift saved before a reload: back where it was, paused, so nothing happens behind the loading screen. */
function resumeSolo(): boolean {
  const saved = savedSolo();
  if (!saved) return false;
  session = LocalSession.resume(saved.game, saved.me, saved.helper);
  beginRound(true);
  openMenu();
  $("pause-note").textContent = "Welcome back! Your shift is just as you left it.";
  return true;
}

// save a solo shift now and then, and as the page goes, so a reload can carry on
let lastSave = 0;
let leaving = false;
function saveNow() {
  if (!leaving && session instanceof LocalSession) saveSolo(session.game, session.me.id, session.hasHelper);
}
window.addEventListener("pagehide", saveNow);

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
  $("briefing-skip").hidden = force || session!.online || game.level !== TUTORIAL.n;
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
// the end screen's Shop: there when the till can buy something, the moment players want to spend
$("over-shop").addEventListener("click", openShop);
shop.dialog.addEventListener("close", () => ($("over-shop").hidden = !shop.affordable()));
shop.dialog.addEventListener("close", () => {
  releaseKitchen();
  if (session?.game) canvas.focus();
});

holding.push(pauseMenu, helpCard, book.dialog, briefing.dialog, shop.dialog);

// --- learning: the How to play guide and the tutorial kitchen (both from the title screen) ---

function startTutorial() {
  if (helpCard.open) helpCard.close();
  if (title.showing) title.show(false);
  feedback.unlock();
  session = new LocalSession(soloRole, TUTORIAL.n);
  beginRound();
}


const lobby = new Lobby({
  solo() {
    feedback.unlock();
    session = new LocalSession(soloRole, lobby.level, lobby.twist ?? undefined);
    beginRound();
    feedback.say("Solo kitchen open! Switch chefs from the menu. Press Q any time to hear what's around you.");
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
  rename(name) {
    if (session instanceof NetSession) session.rename(name);
  },
  chooseRole(role) {
    if (session instanceof NetSession) session.chooseRole(role);
  },
  chooseLevel(level, twist) {
    if (session instanceof NetSession) session.chooseLevel(level, twist);
  },
  warmup() {
    if (session instanceof NetSession) session.start(true);
  },
  start() {
    if (session instanceof NetSession) session.start();
  },
});

function connect(name: string, code: string) {
  clearSolo(); // online now: a solo shift from before isn't coming back
  const net = new NetSession(name, code);
  session = net;
  net.onLobby = (state) => {
    keepAwake(true); // waiting for friends: the phone shouldn't lock in the meantime
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
    if (net.game) feedback.say("Couldn't get back to the kitchen. It tries again when your connection is back, or refresh.", true);
    else lobby.setError("Couldn't reach the kitchen server. Is it running?");
  };
}

// --- input --------------------------------------------------------------------

const keys = new Set<string>();
const GAME_KEYS = new Set([
  "KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "ShiftLeft", "ShiftRight",
  "Space", "KeyE", "KeyF", "KeyQ", "KeyP", "Escape", "KeyR", "KeyV", "KeyH",
  "KeyG", "KeyB", "KeyT", "KeyZ", "KeyN", "Slash", "F1", "Digit0", "Digit1", "Digit2", "Digit3", "Digit4", "Digit5", "Digit6",
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
        pov.yaw += dx * 0.006 * pov.lookSpeed;
        pov.pitch = Math.min(1.1, Math.max(-0.6, pov.pitch + dy * 0.006 * pov.lookSpeed));
      },
      pinch: (scale) => {
        if (pov.active) return;
        pinchZoom = Math.min(1.6, Math.max(0.7, pinchZoom / scale));
        writeText("kitchen.zoom", pinchZoom.toFixed(2));
        fitCamera();
      },
    }, wantsTouch())
  : null;
/** phones, from above: how far a pinch has pulled the camera back (1 = the usual framing) */
let pinchZoom = Math.min(1.6, Math.max(0.7, Number(readText("kitchen.zoom")) || 1));
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
  else if (name === "colors") root.classList.toggle("safe-colors", pref("colors") === "safe");
  else if (name === "holdButton" || name === "buttonSize" || name === "hand") {
    document.body.classList.toggle("hold-button", pref("holdButton") === "on");
    document.body.classList.toggle("big-buttons", pref("buttonSize") === "large");
    document.body.classList.toggle("left-handed", pref("hand") === "left");
    touch?.refresh();
  }
  else if (name === "look") pov.lookSpeed = lookSpeed();
  else if (name === "speak") {
    feedback.speak = pref("speak") === "on";
    $<HTMLInputElement>("speak").checked = feedback.speak;
  } else if (name === "mic") {
    voice.setMicOn(pref("mic") === "on");
    $<HTMLInputElement>("mic").checked = pref("mic") === "on";
  } else if (name === "graphics") {
    applyGraphics();
  }
}

// --- graphics: three steps, and Auto finds the right one by watching the frame rate -----------
// 0 High: the screen's own sharpness (up to 2x), shadows, ambient occlusion and bloom.
// 1 Fast: one pixel per CSS pixel, none of those effects (soft discs stand in for shadows).
// 2 Fastest: two thirds of that sharpness, for phones that still struggle.
type Tier = 0 | 1 | 2;
const TIER_KEY = "kitchen.autoTier";
const TRIED_HIGH_KEY = "kitchen.autoTriedHigh";
const touchScreen = matchMedia("(pointer: coarse)").matches;
/** a tablet has the pixels and usually the chip for High: worth one try (a phone never is) */
const bigTouchScreen = touchScreen && Math.min(screen.width, screen.height) >= 700;
const savedTier = readText(TIER_KEY);
let autoTier: Tier = savedTier === "0" ? 0 : savedTier === "1" ? 1 : savedTier === "2" ? 2 : touchScreen ? 1 : 0;
const graphicsTier = (): Tier => (pref("graphics") === "high" ? 0 : pref("graphics") === "low" ? 1 : autoTier);

function applyGraphics() {
  const tier = graphicsTier();
  const sharp = Math.min(window.devicePixelRatio || 1, 2);
  // the scaling level is screen pixels per drawn pixel: under 1 draws more than the CSS size
  engine.setHardwareScalingLevel(tier === 0 ? 1 / sharp : tier === 1 ? 1 : 1.5);
  scene.shadowsEnabled = tier === 0;
  look.setFast(tier > 0);
}

const frames = { warmUp: 3, time: 0, count: 0, changes: 0 };
/** Auto graphics: a few seconds into a shift, step down if it's choppy (or, once, up on a smooth tablet). */
function watchFrameRate(dt: number) {
  const playing = session?.game?.phase === "playing" && !paused && !document.hidden && document.hasFocus();
  // a long gap is the tab being throttled or a hitch while loading, not the kitchen being slow
  if (pref("graphics") !== "auto" || frames.changes >= 3 || !playing || dt > 0.25) {
    frames.warmUp = 3;
    frames.time = frames.count = 0;
    return;
  }
  if ((frames.warmUp -= dt) > 0) return;
  frames.time += dt;
  frames.count += 1;
  if (frames.time < 4) return;
  const fps = frames.count / frames.time;
  frames.warmUp = 3;
  frames.time = frames.count = 0;
  let next: Tier = autoTier;
  if (autoTier === 0 && fps < 40) next = 1;
  else if (autoTier === 1 && fps < 32) next = 2;
  else if (autoTier === 1 && fps >= 57 && bigTouchScreen && readText(TRIED_HIGH_KEY) !== "1") {
    writeText(TRIED_HIGH_KEY, "1");
    next = 0;
  }
  // settled: this step holds the frame rate, so stop watching for this visit
  if (next === autoTier) return void (frames.changes = 3);
  autoTier = next;
  frames.changes += 1;
  writeText(TIER_KEY, String(next));
  applyGraphics();
  track("graphics_auto", { tier: next, fps: Math.round(fps) });
}
for (const name of Object.keys(PREFS) as PrefName[]) applyPref(name);
for (const id of ["open-settings", "lobby-settings", "title-settings", "room-settings"]) {
  $(id).addEventListener("click", () => {
    // a new language starts the page again, which would drop you from an online kitchen mid-shift
    const busy = !!session?.online && !!session.game;
    for (const radio of document.querySelectorAll<HTMLInputElement>("input[name=lang]")) radio.disabled = busy;
    $("lang-note").textContent = busy ? "Change it from the menu, after the shift" : "Starts the game again";
    $("reset-progress").hidden = !!session?.game;
    openSettings();
  });
}

// Reset progress: asks once more on the button itself, then starts the game fresh
{
  const reset = $<HTMLButtonElement>("reset-progress");
  let sure = false;
  reset.addEventListener("click", () => {
    if (!sure) {
      sure = true;
      reset.textContent = "Tap again to erase stars, coins and stickers";
      return;
    }
    resetProgress();
    location.reload();
  });
  $<HTMLDialogElement>("settings").addEventListener("close", () => {
    sure = false;
    reset.textContent = "Reset progress";
  });
}

// the language: in Settings, and one tap away on the title screen (named in the other language,
// so its readers can find it); either starts the page again in it
for (const radio of document.querySelectorAll<HTMLInputElement>("input[name=lang]")) {
  radio.checked = radio.value === LANG;
  radio.addEventListener("change", () => setLang(radio.value as typeof LANG));
}
const otherLang = LANG === "my" ? "en" : "my";
const langButton = $("title-lang");
langButton.textContent = LANG_NAMES[otherLang];
langButton.lang = otherLang;
langButton.setAttribute("translate", "no");
langButton.addEventListener("click", () => setLang(otherLang));

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
  // iPhone Safari can't hide its bars for a page: once, say how to get the game full screen
  const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const tip = $("ios-tip");
  tip.hidden = !(iOS && !canFullscreen() && !isFullscreen() && readText("kitchen.iosTip") !== "1");
  tip.querySelector("button")?.addEventListener("click", () => {
    tip.hidden = true;
    writeText("kitchen.iosTip", "1");
  });
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
  const dash = held("ShiftLeft", "ShiftRight");
  const stick = touchMode() && (touch!.move.x || touch!.move.y) ? touch!.move : null;
  const forward = stick ? stick.y : axis(["KeyW", "ArrowUp"], ["KeyS", "ArrowDown"]);
  if (!pov.active) {
    // overhead: screen-relative movement, chef turns to where it walks
    return { moveX: stick ? stick.x : axis(["KeyD", "ArrowRight"], ["KeyA", "ArrowLeft"]), moveZ: forward, chop, dash };
  }
  // first person: W/S walk where you look, A/D strafe (arrow left/right turn, see the loop)
  const strafe = stick ? stick.x : axis(["KeyD"], ["KeyA"]);
  const sin = Math.sin(pov.yaw);
  const cos = Math.cos(pov.yaw);
  return { moveX: sin * forward + cos * strafe, moveZ: cos * forward - sin * strafe, chop, dash, facing: pov.yaw, pitch: pov.pitch };
}

/** Where you are and the next step (Q, or a tap on the checklist). */
function whatsNext() {
  const game = session?.game;
  const me = meNow();
  if (!game || !me) return;
  const next = guideFor(game, me)?.next;
  feedback.say(`${describeSurroundings(game, me)}${next ? ` Next: ${next}.` : ""}`);
}
hud.onNext = whatsNext;

/** The other camera (V, or the pause menu's View button), remembered. */
function switchView() {
  setFirstPerson(!pov.active);
  saveViewPref(pov.active ? "fpp" : "tpp");
  feedback.say(pov.active ? "First-person view." : "Overhead view.");
}
$("toggle-view").addEventListener("click", () => {
  switchView();
  closeMenu();
});

function setFirstPerson(on: boolean) {
  const me = meNow();
  if (on && me) pov.yaw = me.facing;
  else if (!on) releasePointer();
  scene.activeCamera = on ? pov.camera : camera;
  view?.setSelfVisible(!on);
  $("crosshair").hidden = !on;
}

/** Online, only the host picks what comes next; everyone else waits on the end screen. */
const guestOnline = () => session instanceof NetSession && !!session.lobby && session.lobby.host !== session.lobby.you;

function restart(level?: number) {
  if (!session || guestOnline()) return;
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
      else if (!startPour()) act("interact");
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
      whatsNext();
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
      switchView();
      break;
    default:
      if (e.code.startsWith("Digit")) {
        const digit = Number(e.code.slice(5));
        // with the wheel open 1-6 sends a sign; Alt + 0-3 switches chef (solo practice), so a
        // number pressed a little off a fridge never turns you into someone else
        const stock = stockStation();
        if (wheel.open || keys.has("KeyT")) {
          const word = EMOTES[digit - 1];
          if (word) sendEmote(word);
          wheel.show(false);
        } else if (stock && digit >= 1 && digit <= stock.stock!.length) {
          // at a fridge or spice rack a number takes (or adds) that item straight away
          choosePick(digit - 1, stock);
          act("interact");
        } else if (e.altKey && ROLE_KEYS[e.code]) {
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

window.addEventListener("keyup", (e) => {
  keys.delete(e.code);
  if ((e.code === "Space" || e.code === "KeyE") && pour.active) finishPour(pour.release());
});
window.addEventListener("blur", () => {
  keys.clear();
  pour.cancel();
});
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
  // another restaurant, or another layout; its room may still be on its way (the kitchen waits)
  if (`${game.venue}|${game.layout}` !== kitchenKey && !buildKitchen(game)) return;
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
  // the pour: drawn each frame, over the top on its own, or dropped if you walk off or pause
  if (pour.active && (paused || game.phase !== "playing" || !seasonTarget(game, me))) pour.cancel();
  finishPour(pour.update(performance.now()));
  if (game.phase === "playing" && performance.now() - lastSave > 2000) {
    lastSave = performance.now();
    saveNow();
  }
  if (game.phase === "over" && !shownGameOver) {
    shownGameOver = true;
    clearSolo();
    $("next-level").hidden = false; // each end screen decides afresh (a daily special, a locked restaurant or a warm-up hides it)
    addTakings(game.coins ?? 0); // the shift's takings go into the restaurant's money
    const stars = hud.showGameOver(game, me.id);
    track("shift_end", { level: game.level, stars, coins: game.coins ?? 0, players: game.chefs.length, twist: game.twist ?? null, pace: game.pace ?? "classic" });
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
    // after a warm-up online, the crew goes on to the shift the host chose
    const warmedUp = session.online && game.level === TUTORIAL.n;
    $("restart-label").textContent = warmedUp ? "Start the shift" : "Play again";
    $("over-menu-label").textContent = session.online ? "Leave" : "Menu";
    $("restart").classList.toggle("primary", warmedUp);
    if (warmedUp) $("next-level").hidden = true;
    // a guest waits for the host's pick
    const guest = guestOnline();
    $("restart").hidden = guest;
    if (guest) $("next-level").hidden = true;
    $("host-picks").hidden = !guest;
    // no star yet: say why there's no Next level (when there is a next shift to open)
    $("next-locked").hidden = !(stars === 0 && !game.twist && !guest && !warmedUp && canPlay(game.level + 1));
    lobby.refreshLevels(game.level);
    $("over-shop").hidden = !shop.affordable();
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

  // the coach: a checklist for what's in hand; in the guided first shift and at a cozy pace, the next step with an arrow
  const guide = guideFor(game, me);
  const coached = !!levelByNumber(game.level).tutorial || paceOf(game).coach;
  hud.syncGuide(game, guide, coached);
  view.setGuideTarget(coached ? (guide?.target ?? null) : null);
  if (coached && guide?.next && guide.next !== lastCoach && !briefing.open) {
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
  camera.radius = Math.max(halfWidth / Math.tan(hFov / 2), halfHeight / Math.tan(camera.fov / 2)) * (touchMode() ? pinchZoom : 1);
}

// --- the title screen --------------------------------------------------------------

setupMenuKeys();
$("title-play").addEventListener("click", () => {
  feedback.unlock();
  shoutName();
  if (touchMode()) goFullscreen();
  // the very first time, straight into the tutorial kitchen (unless a friend's invite is waiting)
  if (firstVisit()) {
    writeText(WELCOMED_KEY, "1");
    startTutorial();
    return;
  }
  lobby.show();
});

/** Chet calls the game's name as you start: "Chet Mal!" (said "chet-meh", let's cook in Burmese) */
function shoutName() {
  const volume = level(pref("sound"));
  if (!volume || !("speechSynthesis" in window)) return;
  // in Burmese, a Burmese voice says it properly: ချက်မယ်!
  const shout = utterance("Chet meh!");
  shout.volume = volume;
  shout.pitch = 1.5;
  shout.rate = 1.05;
  speechSynthesis.cancel();
  speechSynthesis.speak(shout);
}

const WELCOMED_KEY = "kitchen.welcomed";

function firstVisit(): boolean {
  if (new URLSearchParams(location.search).has("room")) return false;
  return [WELCOMED_KEY, "kitchen.stars", "kitchen.business"].every((key) => readText(key) === null) && !hasSticker("tutorial");
}

engine.runRenderLoop(() => {
  scene.render();
  watchFrameRate(engine.getDeltaTime() / 1000);
});
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

/**
 * Build (or rebuild) the room and stations for the restaurant this game is at. False while that
 * restaurant's room is still downloading (the loading screen shows until it's in).
 */
function buildKitchen(game: Game): boolean {
  if (!library) return false;
  // The room is modelled in Blender around the station grid; turning it half a circle maps
  // Blender's (x, y) onto the game's (x, z).
  const name = venueById(game.venue).room;
  if (library.waiting(name)) {
    const loading = $("loading");
    if (loading.hidden) {
      loading.hidden = false;
      setLoadText("Setting up the restaurant");
      void library.ensure(name).then(() => (loading.hidden = true));
    }
    return false;
  }
  view?.dispose();
  room?.dispose(false, false);
  room = library.spawn(library.has(name) ? name : "Kitchen_Room");
  dressTerrace();
  room.rotation.y = Math.PI;
  room.computeWorldMatrix(true);
  for (const mesh of room.getChildMeshes()) {
    mesh.receiveShadows = true;
    if (/Terrace|Nature|RangeHood|Shelves|Window|WallDecor|Decor/.test(mesh.name)) roomShadows.addShadowCaster(mesh);
    // the room never moves: work out where each part is once, not every frame
    mesh.freezeWorldMatrix();
    mesh.doNotSyncBoundingInfo = true;
  }
  // stations never move during a shift, so the game's layout builds the kitchen
  view = new GameView(scene, library, shadows, roomShadows, game);
  // the room's shadows are drawn once: now, and again once every model has reached the graphics card
  look.redrawRoomShadows();
  for (const ms of [400, 1500]) setTimeout(() => look.redrawRoomShadows(), ms);
  view.onFootstep = (chefId, x, z) => {
    const me = meNow();
    if (me && session?.game) feedback.footstep(x, z, me, session.game, chefId === me.id);
  };
  kitchenKey = `${game.venue}|${game.layout}`;
  return true;
}

function setLoadText(text: string) {
  const el = document.querySelector("#loading .load-text");
  if (el) el.textContent = text;
}

// the first restaurant's room comes with everything else; the others follow once the title is up
const firstRoom = venueById(createGame().venue).room;
const laterRooms = VENUES.map((v) => v.room).filter((r) => r !== firstRoom);
AssetLibrary.load(scene, laterRooms, (done, total) => setLoadText(`Warming up the kitchen ${Math.round((done / total) * 100)}%`))
  .then((lib) => {
    library = lib;
    buildKitchen(createGame());
    $("loading").hidden = true;
    presentRole(soloRole);
    showContinue();
    title.show(true);
    setTimeout(() => laterRooms.forEach((r) => void lib.ensure(r)), 3000);
    // a reload carries on: a solo shift comes back paused, and a seat in an online kitchen is
    // taken again straight away; an invite link goes to the play menu with its code filled in
    const room = new URLSearchParams(location.search).get("room")?.toUpperCase();
    if (room && seatedRoom() === room) {
      feedback.unlock();
      connect(readText("kitchen.name") ?? "Chef", room);
    } else if (room) lobby.show();
    else resumeSolo();
  })
  .catch((error) => {
    $("loading").textContent = "Could not load the kitchen. See the console for details.";
    console.error(error);
  });
