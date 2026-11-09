// The sticker album (from the play menu), and the stickers a shift earned on its end screen.
import { STICKERS, hasSticker, markStickersSeen, stickerCount, unseenStickers, type Sticker } from "../stickers";
import { $ } from "./dom";
import { glyph } from "./icons";

const TINTS = ["#d9c9f2", "#bfdcf5", "#bfe5c4", "#f8c9ba", "#fbe09a"];

function face(sticker: Sticker, i: number): HTMLElement {
  const el = document.createElement("span");
  // die-cut shapes take turns, like a real sheet of stickers: round, flower, squircle, blob
  el.className = `sticker-face shape-${i % 4}`;
  el.style.setProperty("--tint", TINTS[i % TINTS.length]);
  el.style.setProperty("--tilt", `${((i * 37) % 9) - 4}deg`);
  el.append(glyph(sticker.icon));
  return el;
}

export class Album {
  readonly dialog = $<HTMLDialogElement>("album");
  private readonly grid = $<HTMLUListElement>("album-grid");
  private readonly count = $("album-count");
  private readonly button = $<HTMLButtonElement>("open-album");

  constructor() {
    this.button.addEventListener("click", () => this.open());
    $("close-album").addEventListener("click", () => this.dialog.close());
    this.dialog.addEventListener("close", () => this.refreshButton());
    this.refreshButton();
  }

  open() {
    this.render();
    markStickersSeen();
    this.dialog.showModal();
  }

  /** A dot on the play menu's button while there are stickers you haven't looked at. */
  refreshButton() {
    const fresh = unseenStickers();
    this.button.classList.toggle("has-new", fresh > 0);
    this.button.setAttribute("aria-label", `Stickers: ${stickerCount()} of ${STICKERS.length}${fresh ? `, ${fresh} new` : ""}`);
  }

  private render() {
    this.count.textContent = `${stickerCount()} / ${STICKERS.length}`;
    this.grid.replaceChildren(
      ...STICKERS.map((sticker, i) => {
        const li = document.createElement("li");
        li.className = hasSticker(sticker.id) ? "got" : "locked";
        li.style.setProperty("--tint-bg", TINTS[i % TINTS.length]);
        const name = document.createElement("strong");
        name.textContent = sticker.name;
        const how = document.createElement("small");
        how.textContent = sticker.how;
        li.append(face(sticker, i), name, how);
        return li;
      }),
    );
  }
}

/** A sticker earned mid-shift pops up above the hands for a moment, one at a time. */
export class StickerPop {
  private readonly el = $("sticker-pop");
  private readonly queue: Sticker[] = [];
  private busy = false;

  show(stickers: Sticker[]) {
    this.queue.push(...stickers);
    if (!this.busy) this.next();
  }

  private next() {
    const sticker = this.queue.shift();
    this.busy = !!sticker;
    if (!sticker) return;
    const label = document.createElement("small");
    label.textContent = "New sticker";
    const name = document.createElement("strong");
    name.textContent = sticker.name;
    const words = document.createElement("span");
    words.append(label, name);
    this.el.replaceChildren(face(sticker, STICKERS.indexOf(sticker)), words);
    // restart the animation for each sticker in the queue
    this.el.classList.remove("show");
    void this.el.offsetWidth;
    this.el.classList.add("show");
    setTimeout(() => this.next(), 2500);
  }
}

/** The end screen's line of stickers this shift earned (hidden when there are none). */
export function showShiftStickers(stickers: Sticker[]) {
  const box = $("final-stickers");
  box.hidden = stickers.length === 0;
  // the faces show which; the names are for screen readers and a hover
  const words = document.createElement("span");
  words.textContent = stickers.length === 1 ? `New sticker: ${stickers[0].name}` : `${stickers.length} new stickers`;
  const names = document.createElement("span");
  names.className = "visually-hidden";
  names.textContent = stickers.length > 1 ? `: ${stickers.map((s) => s.name).join(", ")}` : "";
  box.title = stickers.map((s) => s.name).join(", ");
  box.replaceChildren(...stickers.slice(0, 5).map((s) => face(s, STICKERS.indexOf(s))), words, names);
}
