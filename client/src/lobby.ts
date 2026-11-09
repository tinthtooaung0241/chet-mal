// The start screen: practice solo, or create/join a kitchen and pick a chef.
import { LAYOUTS, ROLES, VENUES, levelByNumber, levelsAt, type Role, type TwistId, type VenueId } from "@kitchen/shared";
import { loadBusiness, venueLock } from "./business";
import { bestStars, starText } from "./progress";
import type { LobbyState } from "./session";
import { dailyStatus, todaysSpecial } from "./daily";
import { helperOn, setHelper } from "./helper";
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
  chooseLevel(level: number, twist: TwistId | null): void;
  start(): void;
}

export class Lobby {
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
      button.addEventListener("click", () => handlers.chooseRole(button.dataset.role as Role));
    }
    this.startButton.addEventListener("click", () => handlers.start());
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
    this.showBlurb();
    this.showSummary();
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

  /** The chosen shift, under the play menu's Restaurant & Shift button. */
  private showSummary() {
    const name = this.levelSelect.selectedOptions[0]?.textContent ?? "";
    const shift = this.daily ? `Daily special · ${todaysSpecial().twist.name}` : name.replace(/[☆★\s]+$/, "");
    $("setup-summary").textContent = helperOn() ? `${shift} · helper bot` : shift;
  }

  show() {
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
    history.replaceState(null, "", `?room=${state.room}`);

    const mine = state.players.find((p) => p.id === state.you);
    for (const button of this.dialog.querySelectorAll<HTMLButtonElement>("#lobby-roles button")) {
      const role = button.dataset.role as Role;
      const holder = state.players.find((p) => p.role === role);
      button.setAttribute("aria-pressed", String(mine?.role === role));
      button.disabled = !!holder && holder.id !== state.you;
    }

    const list = $("lobby-players");
    list.replaceChildren(
      ...state.players.map((p) => {
        const li = document.createElement("li");
        const role = p.role ? ROLES[p.role].name : "choosing…";
        const tags = [p.id === state.host ? "host" : "", p.id === state.you ? "you" : "", p.connected ? "" : "away"].filter(Boolean);
        li.textContent = `${p.name} — ${role}${tags.length ? ` (${tags.join(", ")})` : ""}`;
        return li;
      }),
    );

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
    $("lobby-status").textContent = isHost
      ? everyoneReady
        ? state.players.length < 3
          ? "You can start now, or wait for all three chefs."
          : "Everyone's ready!"
        : "Waiting for everyone to pick a chef…"
      : "Waiting for the host to start…";
  }
}
