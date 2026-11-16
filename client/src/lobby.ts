// The start screen: play solo, or create/join a kitchen and pick a chef.
import { LAYOUTS, PACES, VENUES, levelByNumber, levelsAt, paceById, type Role, type TwistId, type VenueId } from "@kitchen/shared";
import { loadBusiness, venueLock } from "./business";
import { bestStars, starText } from "./progress";
import type { LobbyState } from "./session";
import { dailyStatus, nextDailyBonus, todaysSpecial } from "./daily";
import { helperOn, setHelper } from "./helper";
import { myPace, setPace } from "./pace";
import { readText, writeText } from "./storage";
import { glyph } from "./ui/icons";
import { enhanceSelect } from "./ui/dropdown";
import { $ } from "./ui/dom";

const NAME_KEY = "kitchen.name";

export interface LobbyHandlers {
  solo(name: string): void;
  /** today's daily special, solo */
  daily(name: string): void;
  create(name: string): void;
  join(name: string, code: string): void;
  chooseRole(role: Role): void;
  /** a new name typed in the room */
  rename(name: string): void;
  chooseLevel(level: number, twist: TwistId | null): void;
  start(): void;
  /** a warm-up round in the tutorial kitchen for the whole crew */
  warmup(): void;
}

export class Lobby {
  /** the chef this player picked (its details stay open under the cards) */
  private myRole: Role | null = null;
  private shownChef: Role | null | undefined;
  /** shown before you pick: the first chef still free */
  private preview: Role | null = null;

  /**
   * Show a chef's job, strengths and limit under the cards. All three sit stacked in the panel,
   * one shown, so it's always as tall as the longest and nothing below it moves.
   */
  private showChef(role: Role | null) {
    if (role === this.shownChef) return;
    this.shownChef = role;
    const panel = $("chef-detail");
    if (!panel.querySelector(".cd-pane[data-role]")) {
      for (const card of this.dialog.querySelectorAll<HTMLElement>("#lobby-roles [data-role]")) {
        const pane = document.createElement("div");
        pane.className = "cd-pane";
        pane.dataset.role = card.dataset.role;
        pane.append(...["strong", ".cc-job", ".cc-list", ".cc-limit"].map((sel) => card.querySelector(sel)!.cloneNode(true)));
        panel.append(pane);
      }
    }
    panel.className = role ?? "";
    for (const pane of panel.querySelectorAll<HTMLElement>(".cd-pane")) pane.classList.toggle("on", (pane.dataset.role ?? null) === role);
  }


  private readonly dialog = $<HTMLDialogElement>("lobby");
  private readonly nameInput = $<HTMLInputElement>("player-name");
  private readonly codeInput = $<HTMLInputElement>("room-code");
  private readonly error = $("lobby-error");
  private readonly startPane = $("lobby-start");
  private readonly roomPane = $("lobby-room");
  private readonly startButton = $<HTMLButtonElement>("start-game");
  private readonly levelSelect = $<HTMLSelectElement>("level-select");
  private roomCode = "";
  private venue: VenueId = "street";
  private onLevel: (level: number, twist: TwistId | null) => void = () => {};
  /** the shift is today's daily special; in a room, the host's pick of it */
  private daily = false;
  private roomDailyLevel: number | null = null;

  constructor(handlers: LobbyHandlers) {
    this.nameInput.value = readText(NAME_KEY) ?? "";
    const invited = new URLSearchParams(location.search).get("room");
    if (invited) this.codeInput.value = invited.toUpperCase();

    this.onLevel = (level, twist) => handlers.chooseLevel(level, twist);
    this.refreshLevels();
    // filled in from the start, so it keeps its space (and the card its height) while hidden
    this.renderDailyShift();
    this.levelSelect.addEventListener("change", () => {
      this.showBlurb();
      this.renderMap();
      handlers.chooseLevel(this.level, this.twist);
    });

    // name, restaurant and shift live in their own dialog; the play menu shows what's chosen
    const setup = $<HTMLDialogElement>("setup");
    const shifts = enhanceSelect(this.levelSelect);
    for (const id of ["open-setup", "room-setup"]) {
      $(id).addEventListener("click", () => {
        shifts.render();
        setup.showModal();
      });
    }
    $("setup-done").addEventListener("click", () => setup.close());
    // the pace: cozy (more time, an arrow for every step) or classic; online, the host's counts
    const paces = setup.querySelectorAll<HTMLInputElement>('input[name="pace"]');
    for (const radio of paces) {
      radio.checked = radio.value === myPace();
      radio.addEventListener("change", () => {
        setPace(paceById(radio.value));
        this.showPaceNote();
      });
    }
    this.showPaceNote();
    // the helper bot: solo, or in an empty seat of a kitchen you host
    const helpers = setup.querySelectorAll<HTMLInputElement>('input[name="helper"]');
    for (const radio of helpers) {
      radio.checked = (radio.value === "on") === helperOn();
      radio.addEventListener("change", () => setHelper(radio.value === "on"));
    }
    for (const radio of this.shiftKinds) {
      radio.addEventListener("change", () => {
        this.setDaily(radio.value === "daily");
        this.onLevel(this.level, this.twist);
      });
    }
    $("play-daily").addEventListener("click", () => handlers.daily(this.name()));
    setup.addEventListener("close", () => this.showSummary());

    // Esc never dismisses the lobby itself: it steps back from the play menu to the title
    // (but not out of a room you've joined)
    this.dialog.addEventListener("cancel", (e) => {
      e.preventDefault();
      if (this.roomPane.hidden) this.hide();
    });
    $("lobby-back").addEventListener("click", () => this.hide());
    // your name, on the room screen too: a friend who came by invite link never saw the shift dialog
    const roomName = $<HTMLInputElement>("room-name");
    roomName.addEventListener("change", () => {
      this.nameInput.value = roomName.value;
      handlers.rename(this.name());
    });
    $("play-solo").addEventListener("click", () => handlers.solo(this.name()));
    $("create-room").addEventListener("click", () => handlers.create(this.name()));
    $("quick-play").addEventListener("click", () => handlers.join(this.name(), "*"));
    $<HTMLFormElement>("join-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const code = this.codeInput.value.trim().toUpperCase();
      if (code.length !== 4) return this.setError("Kitchen codes are four letters.");
      handlers.join(this.name(), code);
    });
    for (const button of this.dialog.querySelectorAll<HTMLButtonElement>("#lobby-roles button")) {
      button.addEventListener("click", () => {
        handlers.chooseRole(button.dataset.role as Role);
        this.showChef(button.dataset.role as Role);
      });
      // a peek while hovering; back to your own pick after
      button.addEventListener("pointerenter", () => this.showChef(button.dataset.role as Role));
      button.addEventListener("pointerleave", () => this.showChef(this.myRole ?? this.preview));
    }
    this.startButton.addEventListener("click", () => handlers.start());
    $("warm-up").addEventListener("click", () => handlers.warmup());
    $("copy-link").addEventListener("click", () => {
      const link = `${location.origin}${location.pathname}?room=${this.roomCode}`;
      void navigator.clipboard?.writeText(link).then(
        () => ($("lobby-status").textContent = "Invite link copied. Send it to your friends!"),
        () => ($("lobby-status").textContent = link),
      );
    });
  }

  private name(): string {
    const name = this.nameInput.value.trim() || "Chef";
    writeText(NAME_KEY, name);
    return name;
  }

  get level(): number {
    if (this.daily) return this.roomDailyLevel ?? todaysSpecial().level;
    return Number(this.levelSelect.value) || 1;
  }

  /** the daily special's twist, when that's the shift */
  get twist(): TwistId | null {
    return this.daily ? todaysSpecial().twist.id : null;
  }

  private get shiftKinds() {
    return document.querySelectorAll<HTMLInputElement>('#shift-kind input[name="shift-kind"]');
  }

  private setDaily(on: boolean) {
    this.daily = on;
    for (const radio of this.shiftKinds) radio.checked = radio.value === (on ? "daily" : "normal");
    $("normal-shift").hidden = on;
    $("daily-shift").hidden = !on;
    this.renderDailyShift();
    this.showBlurb();
    this.showSummary();
  }

  /** Your shift, with the daily special chosen: today's twist, the shift it's on, the reward and your streak. */
  private renderDailyShift() {
    const { level, twist } = todaysSpecial();
    const shift = levelByNumber(level);
    const status = dailyStatus();
    const bonus = nextDailyBonus();
    const row = (icon: string, text: string) => {
      const li = document.createElement("li");
      li.append(glyph(icon), text);
      return li;
    };
    const head = document.createElement("div");
    head.className = "daily-head";
    const badge = document.createElement("span");
    badge.className = "daily-badge";
    badge.append(glyph(twist.icon));
    const title = document.createElement("strong");
    title.textContent = twist.name;
    const blurb = document.createElement("small");
    blurb.textContent = twist.blurb;
    const words = document.createElement("span");
    words.append(title, blurb);
    head.append(badge, words);
    const list = document.createElement("ul");
    list.append(
      row("flag", `Today's shift: ${shift.name} (${VENUES.find((v) => v.id === shift.venue)?.name ?? ""})`),
      row("coin", bonus ? `Finish with a star: +${bonus} coins` : `Done today: best ${status.best} points`),
      row("flame", status.streak ? `${status.streak}-day streak` : "Start a streak: play it each day"),
      row("chef", "Same twist for all your friends today"),
    );
    $("daily-shift").replaceChildren(head, list);
  }

  /** The play menu's daily special card: today's twist and shift, and your streak. */
  renderDaily() {
    const { level, twist } = todaysSpecial();
    const status = dailyStatus();
    $("daily-icon").replaceChildren(glyph(twist.icon));
    $("daily-summary").textContent = status.playedToday ? `${twist.name} · best ${status.best}` : `${twist.name} · ${levelByNumber(level).name}`;
    const streak = $("daily-streak");
    streak.hidden = status.streak < 1;
    streak.replaceChildren(glyph("flame"), String(status.streak));
    streak.title = `${status.streak}-day streak`;
  }

  /** Restaurants and their shifts with your best stars; call again after a round to update them. */
  refreshLevels(selected = this.level) {
    this.venue = levelByNumber(selected).venue;
    this.renderVenues();
    this.levelSelect.replaceChildren(
      ...levelsAt(this.venue).map((l, i) => {
        const option = document.createElement("option");
        option.value = String(l.n);
        const best = bestStars(l.n);
        option.textContent = `${i + 1}. ${l.name}  ${starText(best)}`;
        option.setAttribute("aria-label", `Shift ${i + 1}, ${l.name}, best ${best} of 3 stars`);
        return option;
      }),
    );
    this.levelSelect.value = String(levelByNumber(selected).venue === this.venue ? selected : levelsAt(this.venue)[0].n);
    this.showBlurb();
    this.renderMap();
  }

  /** The restaurant's shifts as a path of cards: number, name, best stars and how the kitchen is laid out. */
  private renderMap() {
    const chosen = Number(this.levelSelect.value);
    $("level-map").replaceChildren(
      ...levelsAt(this.venue).map((l, i) => {
        const card = document.createElement("button");
        card.type = "button";
        card.className = "level-card";
        card.setAttribute("role", "radio");
        card.setAttribute("aria-checked", String(l.n === chosen));
        card.disabled = this.levelSelect.disabled; // in a room, only the host picks
        const best = bestStars(l.n);
        card.setAttribute("aria-label", `Shift ${i + 1}, ${l.name}, best ${best} of 3 stars`);
        const num = document.createElement("b");
        num.textContent = String(i + 1);
        const name = document.createElement("strong");
        name.textContent = l.name;
        const stars = document.createElement("span");
        stars.className = "level-stars";
        stars.append(...[0, 1, 2].map((k) => {
          const star = glyph("star");
          if (k >= best) star.classList.add("empty");
          return star;
        }));
        const layout = document.createElement("small");
        layout.textContent = LAYOUTS[l.layout ?? "standard"].name.replace(" kitchen", "");
        card.append(num, name, stars, layout);
        card.addEventListener("click", () => {
          this.levelSelect.value = String(l.n);
          this.levelSelect.dispatchEvent(new Event("change"));
        });
        return card;
      }),
    );
  }

  /** A card per restaurant: open ones can be picked, locked ones say what's still needed. */
  private renderVenues() {
    const sales = loadBusiness().totalSales;
    $("venue-picker").replaceChildren(
      ...VENUES.map((v) => {
        const lock = venueLock(v);
        const card = document.createElement("button");
        card.type = "button";
        card.className = `venue-card ${v.id}`;
        card.setAttribute("role", "radio");
        card.setAttribute("aria-checked", String(v.id === this.venue));
        card.disabled = !!lock;
        const name = document.createElement("strong");
        name.textContent = v.name;
        const sub = document.createElement("small");
        if (!lock) {
          const shifts = levelsAt(v.id);
          const stars = shifts.reduce((n, l) => n + bestStars(l.n), 0);
          sub.textContent = `${stars} of ${shifts.length * 3} stars`;
        } else {
          const needs = [lock.sales ? `sell ${lock.sales} more coins` : "", lock.bigNight ? `clear ${lock.bigNight}` : ""].filter(Boolean);
          sub.textContent = `Locked: ${needs.join(" and ")}`;
          const bar = document.createElement("span");
          bar.className = "venue-progress";
          bar.style.setProperty("--done", `${Math.min(100, (sales / v.unlockSales) * 100)}%`);
          card.append(bar);
        }
        card.prepend(name, sub);
        card.addEventListener("click", () => {
          if (lock || v.id === this.venue) return;
          this.refreshLevels(levelsAt(v.id)[0].n);
          this.onLevel(this.level, this.twist);
        });
        return card;
      }),
    );
  }

  private showBlurb() {
    const level = levelByNumber(this.level);
    const twist = this.daily ? todaysSpecial().twist : null;
    $("level-blurb").textContent = twist ? `${twist.name}: ${twist.blurb.toLowerCase()}. Today's shift is ${level.name}.` : level.blurb;
  }

  private showPaceNote() {
    $("pace-note").textContent = PACES[myPace()].blurb;
  }

  /** The chosen shift, under the play menu's Restaurant & Shift button. */
  private showSummary() {
    const name = this.levelSelect.selectedOptions[0]?.textContent ?? "";
    const shift = this.daily ? `Daily special · ${todaysSpecial().twist.name}` : name.replace(/[☆★\s]+$/, "");
    $("setup-summary").textContent = [shift, PACES[myPace()].name, ...(helperOn() ? ["helper bot"] : [])].join(" · ");
  }

  show() {
    $("shift-kind").hidden = true;
    document.body.classList.add("in-lobby");
    this.showSummary();
    this.renderDaily();
    if (!this.dialog.open) this.dialog.showModal();
  }

  hide() {
    document.body.classList.remove("in-lobby");
    if (this.dialog.open) this.dialog.close();
  }

  setError(message: string) {
    this.error.textContent = message;
  }

  showRoom(state: LobbyState) {
    this.setError("");
    this.roomCode = state.room;
    this.startPane.hidden = true;
    this.roomPane.hidden = false;
    $("room-code-display").textContent = state.room;
    const roomName = $<HTMLInputElement>("room-name");
    if (document.activeElement !== roomName) roomName.value = this.nameInput.value.trim();
    // the daily special switch is the host's way to pick it; solo has its own button on the menu
    $("shift-kind").hidden = false;
    history.replaceState(null, "", `?room=${state.room}`);

    const mine = state.players.find((p) => p.id === state.you);
    for (const button of this.dialog.querySelectorAll<HTMLButtonElement>("#lobby-roles button")) {
      const role = button.dataset.role as Role;
      const holder = state.players.find((p) => p.role === role);
      button.setAttribute("aria-pressed", String(mine?.role === role));
      button.disabled = !!holder && holder.id !== state.you;
      // a corner badge: yours, or who took it
      const badge = button.querySelector<HTMLElement>(".cc-badge")!;
      badge.hidden = !holder;
      badge.textContent = !holder
        ? ""
        : [holder.id === state.you ? "You" : holder.name, holder.id === state.host ? "Host" : "", holder.connected ? "" : "away"].filter(Boolean).join(" · ");
      badge.classList.toggle("away", !!holder && !holder.connected);
      button.classList.toggle("taken", !!holder && holder.id !== state.you);
    }
    this.myRole = mine?.role ?? null;
    // nothing picked yet: show the first chef still free, so the panel is never empty
    const free = [...this.dialog.querySelectorAll<HTMLButtonElement>("#lobby-roles button")].find((b) => !b.disabled);
    this.preview = (free?.dataset.role as Role | undefined) ?? null;
    this.showChef(this.myRole ?? this.preview);

    // how many have joined, next to the kitchen code
    $("room-count").textContent = `${state.players.length} / 3 chefs`;

    const isHost = state.host === state.you;
    // the host picks the level (or the daily special); everyone sees it
    this.roomDailyLevel = state.twist ? state.level : null;
    if (this.daily !== !!state.twist) this.setDaily(!!state.twist);
    if (!state.twist && this.level !== state.level) this.levelSelect.value = String(state.level);
    this.showBlurb();
    this.showSummary();
    this.levelSelect.disabled = !isHost;
    this.renderMap();
    for (const radio of this.shiftKinds) radio.disabled = !isHost;
    const everyoneReady = state.players.length > 0 && state.players.every((p) => p.role);
    this.startButton.hidden = !isHost;
    this.startButton.disabled = !everyoneReady;
    const warmUp = $<HTMLButtonElement>("warm-up");
    warmUp.hidden = !isHost;
    warmUp.disabled = !everyoneReady;
    $("lobby-status").textContent = isHost
      ? everyoneReady
        ? state.players.length < 3
          ? "You can start now, or wait for all three chefs."
          : "Everyone's ready!"
        : `Waiting for ${listNames(state.players.filter((p) => !p.role).map((p) => (p.id === state.you ? "you" : p.name)))} to pick a chef…`
      : `Waiting for ${state.players.find((p) => p.id === state.host)?.name ?? "the host"} (host) to start…`;
  }
}

/** "Sam", "Sam and Alex", "Sam, Alex and Mia" */
function listNames(names: string[]): string {
  return names.length < 2 ? (names[0] ?? "everyone") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}
