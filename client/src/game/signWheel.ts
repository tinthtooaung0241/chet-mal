// The mute chef's sign wheel. Hold T, move the mouse towards a sign and let go (or click it); a
// quick tap of T leaves it open to click. Arrows go round it, Enter sends, Esc closes, and 1-6
// or tapping its button work too.
import type { Emote } from "@kitchen/shared";
import { $ } from "../ui/dom";

export class SignWheel {
  private readonly el = $("emote-wheel");
  private readonly signs = [...this.el.querySelectorAll<HTMLButtonElement>("[data-emote]")];
  private picked: HTMLButtonElement | null = null;
  private aim = { x: 0, y: 0 };
  private openedAt = 0;

  /**
   * @param canOpen whether you're a chef who signs, right now
   * @param send sends the chosen sign
   * @param onToggle told when it opens or closes (the camera holds still while it's open)
   */
  constructor(
    canvas: HTMLCanvasElement,
    private readonly canOpen: () => boolean,
    private readonly send: (word: Emote) => void,
    private readonly onToggle: (open: boolean) => void,
  ) {
    document.addEventListener("mousemove", (e) => this.aimWith(e, canvas));
    $("wheel-button").addEventListener("click", () => this.toggle());
    // tapping the kitchen sends the sign aimed at with the pointer locked, else closes the wheel
    canvas.addEventListener("pointerdown", () => {
      if (this.open && document.pointerLockElement === canvas) this.sendPicked();
      else this.show(false);
    });
    for (const button of this.signs) {
      button.addEventListener("click", () => {
        this.send(button.dataset.emote as Emote);
        this.show(false);
        canvas.focus();
      });
    }
    // the keyboard reaches the wheel before the game's own keys
    window.addEventListener("keydown", (e) => this.key(e), true);
    // let go of T on a sign to send it; a quick tap with nothing chosen leaves the wheel open
    window.addEventListener("keyup", (e) => {
      if (e.code === "KeyT" && this.open && (this.picked || performance.now() - this.openedAt > 350)) this.sendPicked();
    });
  }

  get open(): boolean {
    return this.el.hidden === false;
  }

  show(on: boolean) {
    this.el.hidden = !on || !this.canOpen();
    this.onToggle(this.open);
    this.aim = { x: 0, y: 0 };
    this.openedAt = performance.now();
    this.pick(null);
  }

  toggle() {
    this.show(!this.open);
  }

  private pick(button: HTMLButtonElement | null) {
    this.picked?.classList.remove("picked");
    this.picked = button;
    button?.classList.add("picked");
    this.el.classList.toggle("aiming", !!button);
    this.el.querySelector(".wheel-center")!.textContent = button?.dataset.emote ?? "Signs";
  }

  private sendPicked() {
    const word = this.picked?.dataset.emote as Emote | undefined;
    if (word) this.send(word);
    this.show(false);
  }

  // like a game's radial menu: the mouse's direction from the centre chooses the sign, with or
  // without the pointer locked (with it there's no cursor, so its movement adds up instead)
  private aimWith(e: MouseEvent, canvas: HTMLCanvasElement) {
    if (!this.open) return;
    if (document.pointerLockElement === canvas) {
      this.aim.x += e.movementX;
      this.aim.y += e.movementY;
    } else {
      const box = this.el.getBoundingClientRect();
      this.aim = { x: e.clientX - box.left - box.width / 2, y: e.clientY - box.top - box.height / 2 };
    }
    const far = Math.hypot(this.aim.x, this.aim.y);
    if (far > 90) {
      this.aim.x *= 90 / far;
      this.aim.y *= 90 / far;
    }
    if (far < 25) return;
    const angle = (Math.atan2(this.aim.y, this.aim.x) * 180) / Math.PI + 90;
    this.el.style.setProperty("--aim", `${angle}deg`);
    this.pick(this.signs[(Math.round(angle / 60) + 6) % 6]);
  }

  private key(e: KeyboardEvent) {
    if (!this.open) return;
    const step = e.code === "ArrowRight" || e.code === "ArrowDown" ? 1 : e.code === "ArrowLeft" || e.code === "ArrowUp" ? -1 : 0;
    if (step) {
      const at = this.picked ? this.signs.indexOf(this.picked) : step > 0 ? -1 : 0;
      this.pick(this.signs[(at + step + this.signs.length) % this.signs.length]);
    } else if (e.code === "Enter") this.sendPicked();
    else if (e.code === "Escape") this.show(false);
    else return;
    e.preventDefault();
    e.stopImmediatePropagation();
  }
}
