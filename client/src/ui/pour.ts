// The pour meter: with a spice bottle by the food (or a dish), hold Use to shake it and the meter
// rises, bounces off the top and comes back down, up and down for as long as Use is held; let go in
// the honey "just right" band, and on the mint line for a perfect pinch. Below the band adds nothing
// yet (try again); above it is too much.
// Each role has an edge of about the same size (see ROLES[role].pour), and the cozy pace widens the
// band. The meter only decides how the pour went: the rules do the seasoning.
import { PACES, POUR, ROLES, SPICE_NAMES, type Pace, type Pinch, type Role, type Spice } from "@kitchen/shared";
import { $ } from "./dom";
import { glyph } from "./icons";
import { SPICE_GLYPHS } from "../game/hints";

export type PourResult = Pinch | "light";

/** how a pour went, in words (for hover and screen readers) */
const VERDICT: Record<PourResult, { label: string }> = {
  perfect: { label: "Perfect season!" },
  good: { label: "Just right" },
  heavy: { label: "Too much!" },
  light: { label: "A little more" },
};

export class PourMeter {
  private readonly el = $("pour");
  private readonly bar = this.el.querySelector<HTMLElement>(".pour-bar")!;
  private readonly band = this.el.querySelector<HTMLElement>(".pour-band")!;
  private readonly core = this.el.querySelector<HTMLElement>(".pour-core")!;
  private readonly fill = this.el.querySelector<HTMLElement>(".pour-fill")!;
  private readonly name = this.el.querySelector<HTMLElement>(".pour-name")!;
  private readonly edge = this.el.querySelector<HTMLElement>(".pour-edge")!;
  private readonly say = this.el.querySelector<HTMLElement>(".pour-say")!;
  private started = 0;
  private fillTime = POUR.fill;
  /** the band and its perfect line, as shares of the meter from the bottom */
  private low = 0;
  private high = 0;
  private coreLow = 0;
  private coreHigh = 0;
  private hideAt = 0;
  active = false;

  /** Start pouring: a fresh band somewhere up the meter, so it never becomes muscle memory. */
  begin(spice: Spice, role: Role, pace: Pace) {
    const edge = ROLES[role].pour;
    this.fillTime = POUR.fill * edge.fill;
    const height = Math.min(0.4, POUR.band * edge.band * PACES[pace].pourBand);
    this.low = 0.38 + Math.random() * (0.88 - 0.38 - height);
    this.high = this.low + height;
    const core = height * Math.min(0.9, POUR.core * edge.core);
    this.coreLow = this.low + (height - core) / 2;
    this.coreHigh = this.coreLow + core;
    this.band.style.bottom = `${this.low * 100}%`;
    this.band.style.height = `${height * 100}%`;
    this.core.style.bottom = `${((this.coreLow - this.low) / height) * 100}%`;
    this.core.style.height = `${(core / height) * 100}%`;
    // the spice's icon on top (its name for hover and screen readers)
    this.name.replaceChildren(glyph(SPICE_GLYPHS[spice]));
    this.name.title = SPICE_NAMES[spice];
    this.edge.textContent = edge.edge ?? "";
    this.edge.hidden = !edge.edge;
    this.el.dataset.result = "";
    this.fill.style.height = "0%";
    this.started = performance.now();
    this.active = true;
    this.hideAt = 0;
    this.el.hidden = false;
  }

  /**
   * How far up the pour is (0 to 1): it rises slow then quicker, like a shaker tipping, bounces
   * off the top and sinks back the same way, over and over while Use is held, so a missed band
   * comes round again.
   */
  private level(now: number) {
    const p = ((now - this.started) / 1000 / this.fillTime) % 2;
    return (p <= 1 ? p : 2 - p) ** 1.35;
  }

  /** Each frame: draws the pour (it only ends when Use is let go). */
  update(now: number): PourResult | null {
    if (this.hideAt && now > this.hideAt) {
      this.el.hidden = true;
      this.hideAt = 0;
    }
    if (!this.active) return null;
    const level = this.level(now);
    this.fill.style.height = `${level * 100}%`;
    this.bar.classList.toggle("in-band", level >= this.low && level <= this.high);
    return null;
  }

  /** Let go: how the pour went. */
  release(): PourResult | null {
    if (!this.active) return null;
    const level = this.level(performance.now());
    const result: PourResult =
      level < this.low ? "light" : level > this.high ? "heavy" : level >= this.coreLow && level <= this.coreHigh ? "perfect" : "good";
    return this.end(result);
  }

  /** Walked away, or a menu opened: no pour. */
  cancel() {
    if (!this.active) return;
    this.active = false;
    this.el.hidden = true;
  }

  private end(result: PourResult): PourResult {
    this.active = false;
    this.bar.classList.remove("in-band");
    // the verdict shows as the bar's colour for a moment (the card never changes size)
    this.el.dataset.result = result;
    this.el.title = VERDICT[result].label;
    // and pops up above the bar (floating, so the card never changes size)
    this.say.textContent = VERDICT[result].label;
    this.say.classList.remove("pop");
    void this.say.offsetWidth;
    this.say.classList.add("pop");
    // the verdict stays up a moment, then the meter tucks away
    this.hideAt = performance.now() + 900;
    return result;
  }
}
