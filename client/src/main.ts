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
  UPGRADES,
  TUTORIAL,
  targetStation,
  type Action,
  type Chef,
  type Emote,
  type Game,
  type Input,
  type Role,
  type Station,
  type VenueId,
  venueById,
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
import { addTakings, buyUpgrade, canPlay, loadBusiness } from "./business";
import { Lobby } from "./lobby";
import { enhanceSelect } from "./ui/dropdown";
import { setupMenuKeys } from "./ui/keyboard";
import { recordStars } from "./progress";
import { LocalSession, NetSession, type Session } from "./session";
import { glyph, hydrateIcons } from "./ui/icons";
import { TouchControls, canFullscreen, canTouch, goFullscreen, isFullscreen, toggleFullscreen, wantsTouch } from "./touch";
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

function act(action: Action) {
  const me = meNow();
  if (!session || !me || paused) return;
  if ((action === "ping" || action === "bell") && !ROLES[me.role].signals) {
    feedback.say("You can talk, so signals are left to the mute chef.");
    return;
  }
  session.act(action, action === "ping" ? crosshairSpot() : undefined);
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

for (const button of document.querySelectorAll<HTMLButtonElement>("#signals [data-signal], #emote-wheel [data-signal]")) {
  button.addEventListener("click", () => {
    feedback.unlock();
    showWheel(false);
    act(button.dataset.signal === "ping" ? "ping" : "bell");
    canvas.focus();
  });
}

// the sign wheel: hold T, move the mouse to a sign, let go (or click). A quick tap of T leaves it
// open to click; 1-6 and tapping its button work too.
const wheel = $("emote-wheel");
const wheelSigns = [...wheel.querySelectorAll<HTMLButtonElement>("[data-emote]")];
let wheelPick: HTMLButtonElement | null = null;
let wheelAim = { x: 0, y: 0 };
let wheelOpenedAt = 0;
const pickSign = (button: HTMLButtonElement | null) => {
  wheelPick?.classList.remove("picked");
  wheelPick = button;
  button?.classList.add("picked");
  wheel.classList.toggle("aiming", !!button);
  wheel.querySelector(".wheel-center")!.textContent = button?.dataset.emote ?? "Signs";
};
const showWheel = (on: boolean) => {
  wheel.hidden = !on || !meNow() || !ROLES[meNow()!.role].signals;
  pov.frozen = !wheel.hidden;
  wheelAim = { x: 0, y: 0 };
  wheelOpenedAt = performance.now();
  pickSign(null);
};
const sendPickedSign = () => {
  const word = wheelPick?.dataset.emote as Emote | undefined;
  if (word) sendEmote(word);
  showWheel(false);
};
// like a game's radial menu: the mouse's direction from the centre chooses the sign, with or
// without the pointer locked (with it there's no cursor, so its movement adds up instead)
document.addEventListener("mousemove", (e) => {
  if (wheel.hidden) return;
  if (document.pointerLockElement === canvas) {
    wheelAim.x += e.movementX;
    wheelAim.y += e.movementY;
  } else {
    const box = wheel.getBoundingClientRect();
    wheelAim = { x: e.clientX - box.left - box.width / 2, y: e.clientY - box.top - box.height / 2 };
  }
  const far = Math.hypot(wheelAim.x, wheelAim.y);
  if (far > 90) {
    wheelAim.x *= 90 / far;
    wheelAim.y *= 90 / far;
  }
  if (far < 25) return;
  const angle = (Math.atan2(wheelAim.y, wheelAim.x) * 180) / Math.PI + 90;
  wheel.style.setProperty("--aim", `${angle}deg`);
  pickSign(wheelSigns[(Math.round(angle / 60) + 6) % 6]);
});
$("wheel-button").addEventListener("click", () => showWheel(wheel.hidden !== false));
// tapping the kitchen closes it again
canvas.addEventListener("pointerdown", () => {
  if (!wheel.hidden && document.pointerLockElement === canvas) sendPickedSign();
  else showWheel(false);
});
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
  document.body.classList.remove("in-lobby");
  if (titleShowing()) showTitle(false);
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
  showBriefing();
}

// --- shift briefing: what's new on this level, and how your chef plays ---------------------

const briefing = $<HTMLDialogElement>("briefing");
const ROLE_TIPS: Record<Role, string> = {
  full: "Practising alone: you see and hear everything. Switch chef with keys 0–3 to try each role.",
  head: "You run the pass. You see every ticket, hear every phone order, and your tickets show how each dish is coming along. You don't cook: tell your cooks what to make, then plate, finish and serve.",
  deaf: "You can't hear. Watch tickets, bars, smoke and your teammates' signs. Phone orders only reach the others.",
  mute: "You can't talk. Point with G, ring the bell with B, and hold T, then move the mouse to a sign and let go. Only you can charm customers: press B at the pass to wave, and every table waits 12 seconds longer.",
};

/** The short version of each chef's job, on the shift briefing. */
const BRIEF_ROLE: Record<Role, [string, string]> = {
  full: ["star", "All senses: practise every job"],
  head: ["chef", "Head chef: call orders, plate and serve"],
  deaf: ["ear", "Deaf chef: watch tickets and signs"],
  mute: ["voice", "Mute chef: point, sign, charm customers"],
};

const BRIEFED_KEY = "kitchen.briefed";

/** Levels whose briefing this browser has already shown (it only pops up the first time). */
function briefed(): number[] {
  try {
    return JSON.parse(localStorage.getItem(BRIEFED_KEY) ?? "[]") as number[];
  } catch {
    return [];
  }
}

/** @param force from the pause menu's "Level tips": show it again */
function showBriefing(force = false) {
  const game = session?.game;
  const me = meNow();
  if (!game || !me) return;
  const level = levelByNumber(game.level);
  const seen = briefed();
  if (!force && !level.tutorial && seen.includes(level.n)) return;
  if (!seen.includes(level.n)) {
    try {
      localStorage.setItem(BRIEFED_KEY, JSON.stringify([...seen, level.n]));
    } catch {
      // no storage: it'll just show again next time
    }
  }
  $("briefing-level").textContent = level.tutorial ? "Tutorial" : `Level ${level.n} · ${level.name}`;
  $("briefing-title").textContent = level.teach.title;
  $("briefing-lines").replaceChildren(
    ...level.teach.lines.map((line) => {
      const li = document.createElement("li");
      li.append(glyph(line.icon), line.text);
      return li;
    }),
  );
  const [roleIcon, roleWords] = BRIEF_ROLE[me.role];
  $("briefing-role").replaceChildren(glyph(roleIcon), roleWords);
  if (document.pointerLockElement) document.exitPointerLock();
  // solo waits while you read; online the kitchen keeps going
  if (!session?.online) {
    paused = true;
    feedback.setPaused(true);
  }
  if (!briefing.open) briefing.showModal();
  $("briefing-go").focus();
  if (feedback.speak) {
    if ("speechSynthesis" in window) {
      speechSynthesis.cancel();
      speechSynthesis.speak(new SpeechSynthesisUtterance(`${level.name}. ${level.teach.title}. ${level.teach.lines.map((l) => l.text).join(". ")} ${ROLE_TIPS[me.role]}`));
    }
  }
}

$("briefing-go").addEventListener("click", () => briefing.close());
$("open-briefing").addEventListener("click", () => {
  closeMenu();
  showBriefing(true);
});

// --- the upgrades shop (at the till, or from the title screen) ---------------------------

const shop = $<HTMLDialogElement>("shop");

function renderShop() {
  const business = loadBusiness();
  $("shop-coins").textContent = String(business.coins);
  $("shop-list").replaceChildren(
    ...UPGRADES.map((up) => {
      const li = document.createElement("li");
      const owned = business.upgrades.includes(up.id);
      li.className = owned ? "owned" : "";
      const text = document.createElement("div");
      const name = document.createElement("strong");
      name.textContent = up.name;
      const blurb = document.createElement("span");
      blurb.textContent = up.blurb;
      text.append(name, blurb);
      const buy = document.createElement("button");
      buy.type = "button";
      if (owned) {
        buy.textContent = "Owned";
        buy.disabled = true;
      } else {
        buy.className = "primary";
        buy.textContent = `${up.cost} coins`;
        buy.disabled = business.coins < up.cost;
        buy.addEventListener("click", () => {
          if (buyUpgrade(up.id)) feedback.say(`Bought ${up.name}. It's in place from your next shift.`, false, true, "paid");
          renderShop();
        });
      }
      li.append(text, buy);
      return li;
    }),
  );
}

function openShop() {
  if (document.pointerLockElement) document.exitPointerLock();
  if (session?.game && !session.online && session.game.phase === "playing" && !paused) {
    paused = true;
    feedback.setPaused(true);
  }
  renderShop();
  if (!shop.open) shop.showModal();
}

$("open-shop").addEventListener("click", openShop);
$("close-shop").addEventListener("click", () => shop.close());
shop.addEventListener("close", () => {
  if (paused && !pauseMenu.open && !book.open && !briefing.open) {
    paused = false;
    feedback.setPaused(false);
  }
  if (session?.game) canvas.focus();
});

// --- learning: the How to play guide and the tutorial kitchen (both from the title screen) ---

const howToPlay = $<HTMLDialogElement>("how-to-play");

function startTutorial() {
  if (howToPlay.open) howToPlay.close();
  if (titleShowing()) showTitle(false);
  feedback.unlock();
  session = new LocalSession(soloRole, TUTORIAL.n);
  beginRound();
}

// one idea per page: Next walks through them, Back returns (and leaves from the first page)
const howPages = [...howToPlay.querySelectorAll<HTMLElement>(".how-page")];
const howDots = [...howToPlay.querySelectorAll(".how-dots i")];
let howPage = 0;
function showHowPage(page: number) {
  howPage = page;
  howPages.forEach((p, i) => (p.hidden = i !== page));
  howDots.forEach((d, i) => d.classList.toggle("on", i === page));
  const last = page === howPages.length - 1;
  $("how-next").hidden = last;
  $("how-tutorial").hidden = !last;
  if (howToPlay.open) $(last ? "how-tutorial" : "how-next").focus();
}
function openHow() {
  showHowPage(0);
  howToPlay.showModal();
  $("how-next").focus();
}
$("open-how").addEventListener("click", openHow);
$("how-next").addEventListener("click", () => showHowPage(howPage + 1));
// left and right turn the pages
howToPlay.addEventListener("keydown", (e) => {
  const to = e.key === "ArrowRight" ? howPage + 1 : e.key === "ArrowLeft" ? howPage - 1 : -1;
  if (to < 0 || to >= howPages.length) return;
  showHowPage(to);
  e.preventDefault();
  e.stopPropagation();
});
$("how-close").addEventListener("click", () => {
  if (howPage > 0) showHowPage(howPage - 1);
  else howToPlay.close();
});
$("how-tutorial").addEventListener("click", startTutorial);
$("play-tutorial").addEventListener("click", startTutorial);
briefing.addEventListener("close", () => {
  if (paused && !pauseMenu.open && !book.open) {
    paused = false;
    feedback.setPaused(false);
  }
  if ("speechSynthesis" in window) speechSynthesis.cancel();
  canvas.focus();
});

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

// --- settings: the camera view, remembered between games
type ViewPref = "fpp" | "tpp";
function viewPref(): ViewPref {
  try {
    const v = localStorage.getItem("view");
    if (v === "fpp" || v === "tpp") return v;
  } catch {
    // no storage: use the default
  }
  return "fpp";
}
function saveViewPref(v: ViewPref) {
  try {
    localStorage.setItem("view", v);
  } catch {
    // private mode: it only lasts this game
  }
}
const settings = $<HTMLDialogElement>("settings");
function openSettings() {
  for (const r of settings.querySelectorAll<HTMLInputElement>('input[name="view"]')) r.checked = r.value === viewPref();
  settings.showModal();
}
$("open-settings").addEventListener("click", openSettings);
$("lobby-settings").addEventListener("click", openSettings);
$("settings-done").addEventListener("click", () => settings.close());
settings.addEventListener("change", (e) => {
  const r = e.target as HTMLInputElement;
  if (r.name !== "view") return;
  saveViewPref(r.value as ViewPref);
  if (session?.game) setFirstPerson(r.value === "fpp");
});

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

// the sign wheel by keyboard: arrows go round it, Enter sends, Esc closes
window.addEventListener(
  "keydown",
  (e) => {
    if (wheel.hidden !== false) return;
    const step = e.code === "ArrowRight" || e.code === "ArrowDown" ? 1 : e.code === "ArrowLeft" || e.code === "ArrowUp" ? -1 : 0;
    if (step) {
      const at = wheelPick ? wheelSigns.indexOf(wheelPick) : step > 0 ? -1 : 0;
      pickSign(wheelSigns[(at + step + wheelSigns.length) % wheelSigns.length]);
    } else if (e.code === "Enter") sendPickedSign();
    else if (e.code === "Escape") showWheel(false);
    else return;
    e.preventDefault();
    e.stopImmediatePropagation();
  },
  true,
);

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
      if (document.pointerLockElement) document.exitPointerLock();
      helpCard.showModal();
      break;
    case "KeyT":
      showWheel(wheel.hidden !== false);
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
        if (!wheel.hidden || keys.has("KeyT")) {
          const word = EMOTES[digit - 1];
          if (word) sendEmote(word);
          showWheel(false);
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

window.addEventListener("keyup", (e) => {
  keys.delete(e.code);
  // let go on a sign to send it; a quick tap with nothing chosen leaves the wheel open
  if (e.code === "KeyT" && !wheel.hidden && (wheelPick || performance.now() - wheelOpenedAt > 350)) sendPickedSign();
});
window.addEventListener("blur", () => keys.clear());
canvas.addEventListener("pointerdown", (e) => {
  feedback.unlock();
  canvas.focus();
  // mouse-look only: on a phone the lock grabs every touch (and the browser pops its exit banner)
  if (e.pointerType === "mouse" && pov.active && session?.game?.phase === "playing") pov.lockPointer();
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
  if (game.venue !== kitchenVenue) buildKitchen(game); // a shift at another restaurant
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
  }
  effects.sync(game);
  if (game.phase === "over" && !shownGameOver) {
    shownGameOver = true;
    addTakings(game.coins ?? 0); // the shift's takings go into the restaurant's money
    const stars = hud.showGameOver(game);
    if (recordStars(game.level, stars)) feedback.say(`New best on this level: ${stars} of 3 stars!`);
    // the next shift may be at a restaurant that isn't open yet
    if (!canPlay(game.level + 1)) $("next-level").hidden = true;
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

let lastCoach: string | null = null;

if (import.meta.env.DEV) Object.assign(window, { getSession: () => session, scene, pov, voice }); // console debugging

// Footprint of the floating island in Kitchen_Room.glb (metres).
const ISLAND = { width: 11.1, depth: 10.6 };

/** Pull the overhead camera back just far enough that the whole island fits the canvas. */
function fitCamera() {
  if ($("title-menu").hidden === false) return; // the title screen frames its own view
  const aspect = engine.getRenderWidth() / engine.getRenderHeight();
  // phones: frame the area around your chef (the camera follows you), not the whole island
  const halfWidth = touchMode() ? 3.6 : ISLAND.width / 2 + 0.3;
  // depth is foreshortened by the camera tilt; add room for the walls and the HUD
  const halfHeight = touchMode() ? 2.6 : (ISLAND.depth / 2) * Math.cos(camera.beta) + 1.8;
  const hFov = 2 * Math.atan(Math.tan(camera.fov / 2) * aspect);
  camera.radius = Math.max(halfWidth / Math.tan(hFov / 2), halfHeight / Math.tan(camera.fov / 2));
}

// --- the title screen: a slow look at the restaurant from the terrace, and a small menu ---------

const titleMenu = $("title-menu");
const titleButtons = [...titleMenu.querySelectorAll<HTMLButtonElement>("button")];
const gameCamera = { alpha: camera.alpha, beta: camera.beta, target: camera.target.clone() };
const titleShowing = () => titleMenu.hidden === false;

function showTitle(on: boolean) {
  titleMenu.hidden = !on;
  if (on) {
    gameCamera.alpha = camera.alpha;
    gameCamera.beta = camera.beta;
    gameCamera.target = camera.target.clone();
    scene.activeCamera = camera;
    camera.beta = 1.32;
    camera.radius = 8.5;
    camera.target.set(-0.8, 1, 0);
  } else {
    camera.alpha = gameCamera.alpha;
    camera.beta = gameCamera.beta;
    camera.target.copyFrom(gameCamera.target);
    fitCamera();
  }
}
scene.onBeforeRenderObservable.add(() => {
  if (titleShowing()) camera.alpha = -Math.PI / 2 + Math.sin(performance.now() / 9000) * 0.14;
});
const titleSelect = (button: HTMLButtonElement) => {
  for (const b of titleButtons) b.classList.toggle("on", b === button);
};
for (const button of titleButtons) {
  button.addEventListener("pointerenter", () => titleSelect(button));
  button.addEventListener("focus", () => titleSelect(button));
}
// Esc steps back from the play menu to the title (not out of a room you've joined)
$("lobby").addEventListener("cancel", () => {
  if ($("lobby-room").hidden) $("lobby-back").click();
});
setupMenuKeys();
$("title-play").addEventListener("click", () => {
  feedback.unlock();
  if (touchMode()) goFullscreen();
  document.body.classList.add("in-lobby");
  lobby.show();
});
$("title-settings").addEventListener("click", openSettings);
// name, restaurant and shift live in their own dialog; the menu shows what's chosen
const setup = $<HTMLDialogElement>("setup");
const shiftDropdown = enhanceSelect($<HTMLSelectElement>("level-select"));
const showSetupSummary = () => {
  const level = $<HTMLSelectElement>("level-select");
  const name = level.selectedOptions[0]?.textContent ?? "";
  $("setup-summary").textContent = name.replace(/[☆★\s]+$/, "");
};
for (const id of ["open-setup", "room-setup"]) $(id).addEventListener("click", () => {
  shiftDropdown.render();
  setup.showModal();
});
$("setup-done").addEventListener("click", () => setup.close());
setup.addEventListener("close", showSetupSummary);
$("title-play").addEventListener("click", showSetupSummary);
$("title-how").addEventListener("click", openHow);
$("lobby-back").addEventListener("click", () => {
  lobby.hide();
  document.body.classList.remove("in-lobby");
});
window.addEventListener(
  "keydown",
  (e) => {
    if (!titleShowing() || document.querySelector("dialog[open]")) return;
    const at = titleButtons.findIndex((b) => b.classList.contains("on"));
    if (e.code === "ArrowDown" || e.code === "KeyS") titleSelect(titleButtons[(at + 1) % titleButtons.length]);
    else if (e.code === "ArrowUp" || e.code === "KeyW") titleSelect(titleButtons[(at + titleButtons.length - 1) % titleButtons.length]);
    else if (e.code === "Enter" || e.code === "Space") titleButtons[at].click();
    else return;
    e.preventDefault();
    e.stopPropagation();
  },
  true,
);

engine.runRenderLoop(() => scene.render());
window.addEventListener("resize", () => {
  engine.resize();
  fitCamera();
});
fitCamera();

let library: AssetLibrary | null = null;
let room: TransformNode | null = null;
let kitchenVenue: VenueId | null = null;

/** Build (or rebuild) the room and stations for the restaurant this game is at. */
function buildKitchen(game: Game) {
  if (!library) return;
  view?.dispose();
  room?.dispose(false, false);
  // The room is modelled in Blender around the station grid; turning it half a circle maps
  // Blender's (x, y) onto the game's (x, z).
  const name = venueById(game.venue).room;
  room = library.spawn(library.has(name) ? name : "Kitchen_Room");
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
  kitchenVenue = game.venue;
}

AssetLibrary.load(scene)
  .then((lib) => {
    library = lib;
    buildKitchen(createGame());
    $("loading").hidden = true;
    presentRole(soloRole);
    // an invite link goes straight to the room code
    showTitle(true);
    if (new URLSearchParams(location.search).has("room")) {
      document.body.classList.add("in-lobby");
      lobby.show();
    }
  })
  .catch((error) => {
    $("loading").textContent = "Could not load the kitchen. See the console for details.";
    console.error(error);
  });
