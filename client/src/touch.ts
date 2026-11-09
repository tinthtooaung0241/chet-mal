// Phone and tablet controls: a thumb joystick on the left to walk, a big Use button on the right
// with the other actions in an arc around it, and drag-to-look in first person. Buttons press the
// same keys as the keyboard, so every action works the same way. The buttons light up when they'd
// do something, and Use shows what it will do ("Pick up", "Serve"...).

import { readText, writeText } from "./storage";
import { $ } from "./ui/dom";

/** Whether this device is mainly touch (a phone or tablet), or the page asked for touch controls. */
export const wantsTouch = () =>
  new URLSearchParams(location.search).has("touch") || (matchMedia("(pointer: coarse)").matches && navigator.maxTouchPoints > 0);

/** Whether this device can be touched at all (phones, tablets, touchscreen laptops). */
export const canTouch = () => new URLSearchParams(location.search).has("touch") || navigator.maxTouchPoints > 0;

type FsDoc = Document & { webkitFullscreenElement?: Element; webkitFullscreenEnabled?: boolean; webkitExitFullscreen?: () => void };
type FsEl = HTMLElement & { webkitRequestFullscreen?: () => void };
const fsDoc = document as FsDoc;

/** Already filling the screen: in full screen, or opened from the home screen as an app. */
export const isFullscreen = () =>
  !!(fsDoc.fullscreenElement || fsDoc.webkitFullscreenElement) ||
  matchMedia("(display-mode: fullscreen), (display-mode: standalone)").matches;

/** The browser can hide its own bars for a page (iPhone Safari can't: add to home screen instead). */
export const canFullscreen = () => !!(fsDoc.fullscreenEnabled || fsDoc.webkitFullscreenEnabled);

/** Fill the screen and hold landscape, where the browser allows it (needs a tap to ask). */
export function goFullscreen() {
  if (isFullscreen()) return;
  const el = document.documentElement as FsEl;
  const lock = () => (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.("landscape").catch(() => {});
  if (el.requestFullscreen) el.requestFullscreen({ navigationUI: "hide" }).then(lock).catch(() => {});
  else el.webkitRequestFullscreen?.();
}

/** The full-screen button: in, or back out to the browser. */
export function toggleFullscreen() {
  if (fsDoc.fullscreenElement) document.exitFullscreen().catch(() => {});
  else if (fsDoc.webkitFullscreenElement) fsDoc.webkitExitFullscreen?.();
  else goFullscreen();
}

/** A tiny buzz under the thumb, on phones that have one. */
const buzz = (ms: number) => navigator.vibrate?.(ms);

export interface TouchHandlers {
  /** a button went down / up: the keyboard code it stands for */
  press(code: string): void;
  release(code: string): void;
  /** a drag on the scene, in pixels (first-person look) */
  look(dx: number, dy: number): void;
}

const JOY_RADIUS = 50; // px the knob can travel from the centre

/** Keep a finger's events coming to this element (it can refuse, e.g. for a finger already lifted). */
function capture(el: Element, pointerId: number) {
  try {
    el.setPointerCapture(pointerId);
  } catch {
    // not capturable: events still arrive while the finger stays on the element
  }
}

export class TouchControls {
  /** the joystick, -1..1 on each axis (y is up the screen) */
  readonly move = { x: 0, y: 0 };
  private readonly root = $("touch");
  private readonly useLabel = $("touch-use-label");
  private lastHints = "";
  /** whether the touch layout is showing (else the keyboard-and-mouse one) */
  active = false;
  /** called when the layout switches between touch and keyboard-and-mouse */
  onChange?: (active: boolean) => void;

  constructor(canvas: HTMLCanvasElement, handlers: TouchHandlers, startActive: boolean) {
    this.setActive(startActive);
    // the layout follows the last thing used: a finger on the screen, or a key / the mouse
    window.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "touch") this.setActive(true);
    }, true);
    window.addEventListener("pointermove", (e) => {
      if (e.pointerType === "mouse" && (e.movementX || e.movementY)) this.setActive(false);
    }, true);
    window.addEventListener("keydown", (e) => {
      if (e.isTrusted) this.setActive(false);
    }, true);

    // --- the joystick: wherever the thumb lands in the left zone becomes its centre
    const zone = $("touch-joy");
    const base = $("touch-joy-base");
    const knob = $("touch-joy-knob");
    let joyId: number | null = null;
    let cx = 0;
    let cy = 0;
    const setKnob = (dx: number, dy: number) => {
      const d = Math.hypot(dx, dy);
      const k = d > JOY_RADIUS ? JOY_RADIUS / d : 1;
      knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
      // a small dead zone, then full speed at the rim
      const m = Math.min(1, d / JOY_RADIUS);
      const live = m < 0.15 ? 0 : (m - 0.15) / 0.85;
      this.move.x = d ? (dx / d) * live : 0;
      this.move.y = d ? (-dy / d) * live : 0;
    };
    // at rest the stick waits in the corner; a thumb anywhere in the zone moves it there
    const home = () => {
      base.style.position = "";
      base.style.left = "";
      base.style.top = "";
    };
    // the first time only: a little "Move" over the stick
    const hint = $("touch-joy-hint");
    hint.hidden = readText("moved") === "1";
    zone.addEventListener("pointerdown", (e) => {
      // a new thumb on the stick always takes it, even if the phone swallowed the last one's lift
      // (an edge swipe in full screen goes to the system and never tells the page)
      if (!hint.hidden) {
        hint.hidden = true;
        writeText("moved", "1");
      }
      e.preventDefault();
      joyId = e.pointerId;
      capture(zone, e.pointerId);
      // the stick is fixed to the screen, so it lands right under the thumb whatever the zone's box
      cx = e.clientX;
      cy = e.clientY;
      base.style.position = "fixed";
      base.style.left = `${cx}px`;
      base.style.top = `${cy}px`;
      base.classList.add("on");
      setKnob(0, 0);
    });
    zone.addEventListener("pointermove", (e) => {
      if (e.pointerId === joyId) setKnob(e.clientX - cx, e.clientY - cy);
    });
    const endJoy = (e: PointerEvent) => {
      if (e.pointerId !== joyId) return;
      joyId = null;
      base.classList.remove("on");
      home();
      setKnob(0, 0);
    };
    zone.addEventListener("pointerup", endJoy);
    zone.addEventListener("pointercancel", endJoy);
    zone.addEventListener("lostpointercapture", endJoy);

    // --- buttons: press on touch, release on lift (Chop and Signs are held)
    for (const button of document.querySelectorAll<HTMLButtonElement>("#touch [data-key], .touch-only[data-key]")) {
      const code = button.dataset.key!;
      let down = false;
      button.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        capture(button, e.pointerId);
        down = true;
        button.classList.add("down");
        buzz(8);
        handlers.press(code);
      });
      const up = () => {
        if (!down || !button.classList.contains("down")) return;
        down = false;
        button.classList.remove("down");
        handlers.release(code);
      };
      button.addEventListener("pointerup", up);
      button.addEventListener("pointercancel", up);
      button.addEventListener("lostpointercapture", up);
      button.addEventListener("contextmenu", (e) => e.preventDefault());
    }

    // --- look: drag on the scene itself
    let lookId: number | null = null;
    let lx = 0;
    let ly = 0;
    canvas.addEventListener("pointerdown", (e) => {
      if (e.pointerType !== "touch") return;
      lookId = e.pointerId;
      // keep this finger even when it slides over the tickets or the top bar (looking up)
      capture(canvas, e.pointerId);
      lx = e.clientX;
      ly = e.clientY;
    });
    canvas.addEventListener("pointermove", (e) => {
      if (e.pointerId !== lookId) return;
      handlers.look(e.clientX - lx, e.clientY - ly);
      lx = e.clientX;
      ly = e.clientY;
    });
    const endLook = (e: PointerEvent) => {
      if (e.pointerId === lookId) lookId = null;
    };
    canvas.addEventListener("pointerup", endLook);
    canvas.addEventListener("pointercancel", endLook);
    canvas.addEventListener("lostpointercapture", endLook);

    // the phone took over (full screen change, rotation, an app switch): let go of everything,
    // so no key stays held and the next touch starts fresh
    const letGo = () => {
      joyId = null;
      lookId = null;
      base.classList.remove("on");
      home();
      setKnob(0, 0);
      for (const b of this.root.querySelectorAll<HTMLElement>(".down")) {
        b.classList.remove("down");
        handlers.release(b.dataset.key!);
      }
    };
    document.addEventListener("fullscreenchange", letGo);
    document.addEventListener("visibilitychange", letGo);
    window.addEventListener("orientationchange", letGo);
    window.addEventListener("blur", letGo);
  }

  setActive(on: boolean) {
    if (on === this.active) return;
    this.active = on;
    this.root.hidden = !on;
    document.body.classList.toggle("touch", on);
    if (!on) for (const k of ["x", "y"] as const) this.move[k] = 0;
    this.onChange?.(on);
  }

  /**
   * What each key would do right now (the HUD's action hints): light up the buttons that would
   * do something, and put the Use action's words on the Use button.
   */
  setHints(hints: { key?: string; text: string }[]) {
    const key = hints.map((h) => `${h.key}:${h.text}`).join("|");
    if (key === this.lastHints) return;
    this.lastHints = key;
    const ready = new Set(hints.map((h) => h.key));
    for (const b of this.root.querySelectorAll<HTMLElement>("[data-key]")) {
      const k = b.dataset.key!.replace(/^Key/, "");
      b.classList.toggle("ready", ready.has(k));
    }
    this.useLabel.textContent = hints.find((h) => h.key === "Space")?.text ?? "Use";
  }
}
