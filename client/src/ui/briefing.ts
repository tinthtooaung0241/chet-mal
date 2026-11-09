// The shift briefing: what's new on this level and how your chef plays. It pops up the first
// time this browser plays a level (every time in the tutorial), and again from the menu's Tips.
import { LAYOUTS, levelByNumber, twistById, type Role, type TwistId } from "@kitchen/shared";
import { readJson, writeJson } from "../storage";
import { $ } from "./dom";
import { glyph } from "./icons";

/** How each chef plays, read aloud after the briefing when speech is on. */
const ROLE_TIPS: Record<Role, string> = {
  full: "Practising alone: you see and hear everything. Switch chef with keys 0–3 to try each role.",
  head: "You run the pass. You see every ticket, hear every phone order, and your tickets show how each dish is coming along. You don't cook: tell your cooks what to make, then plate, finish and serve, and ring customers up at the till.",
  deaf: "You can't hear. Watch tickets, bars, smoke and your teammates' signs. Phone orders only reach the others.",
  mute: "You can't talk. Point with G, ring the bell with B, and hold T, then move the mouse to a sign and let go. Only you can charm customers: press B at the pass to wave, and every table waits a little longer.",
};

/** The short version of each chef's job, on the card. */
const BRIEF_ROLE: Record<Role, [string, string]> = {
  full: ["star", "All senses: practise every job"],
  head: ["chef", "Head chef: call orders, plate, serve, run the till"],
  deaf: ["ear", "Deaf chef: watch tickets and signs"],
  mute: ["voice", "Mute chef: point, sign, charm customers"],
};

const BRIEFED_KEY = "kitchen.briefed";

/** Levels whose briefing this browser has already shown. */
function briefed(): number[] {
  const seen = readJson<unknown>(BRIEFED_KEY, []);
  return Array.isArray(seen) ? seen : [];
}

export class Briefing {
  readonly dialog = $<HTMLDialogElement>("briefing");

  constructor() {
    $("briefing-go").addEventListener("click", () => this.dialog.close());
    this.dialog.addEventListener("close", () => {
      if ("speechSynthesis" in window) speechSynthesis.cancel();
    });
  }

  /** Whether the level's card should pop up: the first time, always in the tutorial, or when asked. */
  due(levelN: number, force = false): boolean {
    const level = levelByNumber(levelN);
    return force || !!level.tutorial || !briefed().includes(level.n);
  }

  /** @param twistId a daily special's twist, which leads the card */
  open(levelN: number, role: Role, speak: boolean, twistId?: TwistId) {
    const level = levelByNumber(levelN);
    const twist = twistById(twistId);
    const seen = briefed();
    if (!seen.includes(level.n)) writeJson(BRIEFED_KEY, [...seen, level.n]);
    $("briefing-level").textContent = level.tutorial ? "Tutorial" : twist ? `Daily special · ${level.name}` : `Level ${level.n} · ${level.name}`;
    $("briefing-title").textContent = twist ? twist.name : level.teach.title;
    // a kitchen laid out differently: say how, first
    const layout = level.layout && level.layout !== "standard" ? [{ icon: "counter", text: `${LAYOUTS[level.layout].name}. ${LAYOUTS[level.layout].blurb}` }] : [];
    const lines = [...(twist ? [{ icon: twist.icon, text: twist.blurb }] : []), ...layout, ...level.teach.lines];
    $("briefing-lines").replaceChildren(
      ...lines.map((line) => {
        const li = document.createElement("li");
        li.append(glyph(line.icon), line.text);
        return li;
      }),
    );
    const [roleIcon, roleWords] = BRIEF_ROLE[role];
    $("briefing-role").replaceChildren(glyph(roleIcon), roleWords);
    if (!this.dialog.open) this.dialog.showModal();
    $("briefing-go").focus();
    if (speak && "speechSynthesis" in window) {
      speechSynthesis.cancel();
      const said = lines.map((l) => l.text).join(". ");
      speechSynthesis.speak(new SpeechSynthesisUtterance(`${level.name}. ${twist ? twist.name : level.teach.title}. ${said}. ${ROLE_TIPS[role]}`));
    }
  }
}
