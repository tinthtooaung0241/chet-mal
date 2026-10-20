// The start screen: practice solo, or create/join a kitchen and pick a chef.
import { LEVELS, ROLES, levelByNumber, type Role } from "@kitchen/shared";
import { bestStars, starText } from "./progress";
import type { LobbyState } from "./session";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const NAME_KEY = "kitchen.name";

export interface LobbyHandlers {
  solo(name: string): void;
  create(name: string): void;
  join(name: string, code: string): void;
  chooseRole(role: Role): void;
  chooseLevel(level: number): void;
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

  constructor(handlers: LobbyHandlers) {
    try {
      this.nameInput.value = localStorage.getItem(NAME_KEY) ?? "";
    } catch {
      // storage unavailable: start with an empty name
    }
    const invited = new URLSearchParams(location.search).get("room");
    if (invited) this.codeInput.value = invited.toUpperCase();

    this.refreshLevels();
    this.levelSelect.addEventListener("change", () => {
      this.showBlurb();
      handlers.chooseLevel(this.level);
    });

    // the lobby is the start screen: Esc shouldn't dismiss it
    this.dialog.addEventListener("cancel", (e) => e.preventDefault());
    $("play-solo").addEventListener("click", () => handlers.solo(this.name()));
    $("create-room").addEventListener("click", () => handlers.create(this.name()));
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
    try {
      localStorage.setItem(NAME_KEY, name);
    } catch {
      // ignore
    }
    return name;
  }

  get level(): number {
    return Number(this.levelSelect.value) || 1;
  }

  /** Level list with your best stars; call again after a round to update them. */
  refreshLevels(selected = this.level) {
    this.levelSelect.replaceChildren(
      ...LEVELS.map((l) => {
        const option = document.createElement("option");
        option.value = String(l.n);
        const best = bestStars(l.n);
        option.textContent = `${l.n}. ${l.name}  ${starText(best)}`;
        option.setAttribute("aria-label", `Level ${l.n}, ${l.name}, best ${best} of 3 stars`);
        return option;
      }),
    );
    this.levelSelect.value = String(selected);
    this.showBlurb();
  }

  private showBlurb() {
    $("level-blurb").textContent = levelByNumber(this.level).blurb;
  }

  show() {
    if (!this.dialog.open) this.dialog.showModal();
  }

  hide() {
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
    // the host picks the level; everyone sees it
    if (this.level !== state.level) {
      this.levelSelect.value = String(state.level);
      this.showBlurb();
    }
    this.levelSelect.disabled = !isHost;
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
