// The title screen: a slow look at the restaurant from the terrace, and a small menu that the
// mouse, the arrows or W/S walk through (Enter or Space picks).
import type { ArcRotateCamera, Vector3 } from "@babylonjs/core";
import { $ } from "./dom";

export class TitleScreen {
  private readonly el = $("title-menu");
  private readonly all = [...this.el.querySelectorAll<HTMLButtonElement>("button")];
  /** the menu as it stands: Continue is only there once there's progress */
  private get buttons() {
    return this.all.filter((b) => !b.hidden);
  }
  /** where the overhead camera was before the title took it over */
  private saved: { alpha: number; beta: number; target: Vector3 };

  /** @param onHide frames the game's camera again once the title has gone */
  constructor(
    private readonly camera: ArcRotateCamera,
    private readonly onHide: () => void,
  ) {
    this.saved = { alpha: camera.alpha, beta: camera.beta, target: camera.target.clone() };
    camera.getScene().onBeforeRenderObservable.add(() => {
      if (this.showing && !document.documentElement.classList.contains("reduce-motion")) camera.alpha = -Math.PI / 2 + Math.sin(performance.now() / 9000) * 0.14;
    });
    for (const button of this.all) {
      button.addEventListener("pointerenter", () => this.select(button));
      button.addEventListener("focus", () => this.select(button));
    }
    window.addEventListener("keydown", (e) => this.key(e), true);
  }

  get showing(): boolean {
    return this.el.hidden === false;
  }

  show(on: boolean) {
    const camera = this.camera;
    this.el.hidden = !on;
    if (on) {
      this.select(this.buttons[0]);
      this.saved = { alpha: camera.alpha, beta: camera.beta, target: camera.target.clone() };
      camera.getScene().activeCamera = camera;
      camera.beta = 1.32;
      camera.radius = 8.5;
      camera.target.set(-0.8, 1, 0);
    } else {
      camera.alpha = this.saved.alpha;
      camera.beta = this.saved.beta;
      camera.target.copyFrom(this.saved.target);
      this.onHide();
    }
  }

  private select(button: HTMLButtonElement) {
    for (const b of this.all) b.classList.toggle("on", b === button);
  }

  private key(e: KeyboardEvent) {
    if (!this.showing || document.querySelector("dialog[open]")) return;
    const buttons = this.buttons;
    const at = buttons.findIndex((b) => b.classList.contains("on"));
    if (e.code === "ArrowDown" || e.code === "KeyS") this.select(buttons[(at + 1) % buttons.length]);
    else if (e.code === "ArrowUp" || e.code === "KeyW") this.select(buttons[(at + buttons.length - 1) % buttons.length]);
    else if (e.code === "Enter" || e.code === "Space") buttons[at]?.click();
    else return;
    e.preventDefault();
    e.stopPropagation();
  }
}
