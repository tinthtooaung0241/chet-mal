// Power cuts and storms: the lights fade out in a power cut, and a storm flashes lightning (so
// the deaf chef sees it coming) and turns voice chat down under the thunder.
import type { Game } from "@kitchen/shared";

export class Atmosphere {
  private darkness = 0;
  private lightning = 0;
  private nextFlash = 2;
  private ducked = false;

  constructor(
    private readonly setLight: (darkness: number, lightning: number) => void,
    private readonly duckVoices: (on: boolean) => void,
  ) {}

  update(game: Game, dt: number) {
    this.darkness += ((game.blackout > 0 ? 1 : 0) - this.darkness) * Math.min(1, dt * 3);
    this.lightning = Math.max(0, this.lightning - dt * 4);
    if (game.storm > 0 && (this.nextFlash -= dt) <= 0) {
      this.lightning = 1.4;
      this.nextFlash = 2 + Math.random() * 4;
    }
    this.setLight(this.darkness, this.lightning);
    if (this.ducked !== game.storm > 0) {
      this.ducked = game.storm > 0;
      this.duckVoices(this.ducked);
    }
  }
}
