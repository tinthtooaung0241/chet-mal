// Particles that make the kitchen feel alive and add visual cues for sighted chefs:
// steam while cooking, grey smoke when food is about to burn, black smoke once it has,
// bits flying off the board while chopping, and confetti at the pass for a served dish.
// (The "perfect" moment stays sound-only by design, so there is no sparkle for it.)
import {
  Color4,
  DynamicTexture,
  ParticleSystem,
  Vector3,
  type Scene,
} from "@babylonjs/core";
import { FOOD_RULES, potPhase, stovePhase, targetStation, type Game } from "@kitchen/shared";

type Kind = "steam" | "smoke" | "burnt" | "bits";

const BITS_COLOR: Record<string, string> = {
  Tomato: "#d8392b",
  Lettuce: "#7cc04a",
  Carrot: "#ee7a22",
  Onion: "#f1e6ef",
  Potato: "#f2e1a6",
  Mushroom: "#d9c3a5",
  Cheese: "#f4c442",
  Bread: "#f0d9a6",
};

function softDot(scene: Scene): DynamicTexture {
  const tex = new DynamicTexture("softDot", { width: 64, height: 64 }, scene, false);
  const ctx = tex.getContext() as CanvasRenderingContext2D;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.5, "rgba(255,255,255,0.5)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  tex.hasAlpha = true;
  tex.update();
  return tex;
}

const hex = (h: string, a = 1) => {
  const n = parseInt(h.slice(1), 16);
  return new Color4(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, a);
};

export class Effects {
  private readonly dot: DynamicTexture;
  /** one emitter per station and kind, switched on and off as the kitchen changes */
  private readonly emitters = new Map<string, ParticleSystem>();

  constructor(private readonly scene: Scene) {
    this.dot = softDot(scene);
  }

  private make(kind: Kind, at: Vector3): ParticleSystem {
    const ps = new ParticleSystem(`fx-${kind}`, kind === "bits" ? 80 : 160, this.scene);
    ps.particleTexture = this.dot;
    ps.emitter = at.clone();
    ps.blendMode = ParticleSystem.BLENDMODE_STANDARD;
    switch (kind) {
      case "steam":
        ps.minEmitBox = new Vector3(-0.08, 0, -0.08);
        ps.maxEmitBox = new Vector3(0.08, 0, 0.08);
        // slightly grey so it reads against the white tiles
        ps.color1 = new Color4(0.93, 0.94, 0.96, 0.55);
        ps.color2 = new Color4(0.85, 0.87, 0.9, 0.4);
        ps.colorDead = new Color4(0.9, 0.9, 0.92, 0);
        ps.minSize = 0.08;
        ps.maxSize = 0.2;
        ps.minLifeTime = 1.0;
        ps.maxLifeTime = 1.8;
        ps.direction1 = new Vector3(-0.08, 1, -0.08);
        ps.direction2 = new Vector3(0.08, 1, 0.08);
        ps.minEmitPower = 0.25;
        ps.maxEmitPower = 0.45;
        ps.addSizeGradient(0, 0.5);
        ps.addSizeGradient(1, 2.2);
        break;
      case "smoke":
      case "burnt":
        ps.minEmitBox = new Vector3(-0.07, 0, -0.07);
        ps.maxEmitBox = new Vector3(0.07, 0, 0.07);
        ps.color1 = kind === "smoke" ? new Color4(0.55, 0.55, 0.55, 0.5) : new Color4(0.12, 0.11, 0.1, 0.7);
        ps.color2 = kind === "smoke" ? new Color4(0.4, 0.4, 0.42, 0.4) : new Color4(0.2, 0.18, 0.16, 0.6);
        ps.colorDead = new Color4(0.3, 0.3, 0.3, 0);
        ps.minSize = 0.1;
        ps.maxSize = 0.22;
        ps.minLifeTime = 1.4;
        ps.maxLifeTime = 2.4;
        ps.direction1 = new Vector3(-0.15, 1, -0.15);
        ps.direction2 = new Vector3(0.15, 1, 0.15);
        ps.minEmitPower = 0.35;
        ps.maxEmitPower = 0.6;
        ps.addSizeGradient(0, 0.6);
        ps.addSizeGradient(1, 2.6);
        break;
      case "bits":
        ps.minEmitBox = new Vector3(-0.05, 0, -0.05);
        ps.maxEmitBox = new Vector3(0.05, 0, 0.05);
        ps.minSize = 0.012;
        ps.maxSize = 0.025;
        ps.minLifeTime = 0.25;
        ps.maxLifeTime = 0.45;
        ps.direction1 = new Vector3(-0.6, 1.4, -0.6);
        ps.direction2 = new Vector3(0.6, 2.2, 0.6);
        ps.minEmitPower = 0.5;
        ps.maxEmitPower = 0.9;
        ps.gravity = new Vector3(0, -9, 0);
        break;
    }
    ps.emitRate = 0;
    ps.start();
    return ps;
  }

  private set(key: string, kind: Kind, at: Vector3, rate: number, color?: string) {
    let ps = this.emitters.get(key);
    if (!ps) {
      if (rate <= 0) return;
      ps = this.make(kind, at);
      this.emitters.set(key, ps);
    }
    ps.emitRate = rate;
    if (color) {
      ps.color1 = hex(color);
      ps.color2 = hex(color, 0.9);
      ps.colorDead = hex(color, 0);
    }
  }

  /** Called every frame with the current game. */
  sync(game: Game) {
    for (const s of game.stations) {
      const top = new Vector3(s.x, 0.97, s.z);
      let steam = 0;
      let smoke = 0;
      let burnt = 0;
      if (s.kind === "stove" && s.item?.type === "food") {
        const phase = stovePhase(s.item);
        if (s.item.state === "burnt" && FOOD_RULES[s.item.kind]?.cookFrom) burnt = 14;
        else if (phase === "smoking") smoke = 26;
        else if (phase) steam = phase === "cooking" ? 8 : 12;
      }
      if (s.pot) {
        top.y = 1.2;
        const phase = potPhase(s.pot);
        if (s.pot.state === "burnt") burnt = 16;
        else if (phase === "smoking") smoke = 30;
        else if (phase) steam = phase === "cooking" ? 22 : 30;
      }
      this.set(`steam-${s.id}`, "steam", top, steam);
      this.set(`smoke-${s.id}`, "smoke", top, smoke);
      this.set(`burnt-${s.id}`, "burnt", top, burnt);
    }

    // chopping: bits fly off the board in the ingredient's colour
    const chopping = new Map<number, string>();
    for (const chef of game.chefs) {
      if (!chef.chopping) continue;
      const board = targetStation(game, chef);
      if (board?.item?.type === "food") chopping.set(board.id, board.item.kind);
    }
    for (const s of game.stations) {
      if (s.kind !== "board") continue;
      const kind = chopping.get(s.id);
      this.set(`bits-${s.id}`, "bits", new Vector3(s.x, 0.97, s.z), kind ? 40 : 0, kind ? (BITS_COLOR[kind] ?? "#dddddd") : undefined);
    }
  }

  /** A short celebratory burst (served dish). */
  confetti(x: number, z: number) {
    const ps = new ParticleSystem("confetti", 120, this.scene);
    ps.particleTexture = this.dot;
    ps.emitter = new Vector3(x, 1.25, z);
    ps.minEmitBox = new Vector3(-0.2, 0, -0.1);
    ps.maxEmitBox = new Vector3(0.2, 0, 0.1);
    ps.color1 = hex("#f2a541");
    ps.color2 = hex("#5fd07a");
    ps.colorDead = new Color4(1, 1, 1, 0);
    ps.minSize = 0.025;
    ps.maxSize = 0.05;
    ps.minLifeTime = 0.7;
    ps.maxLifeTime = 1.2;
    ps.direction1 = new Vector3(-1, 3, -1);
    ps.direction2 = new Vector3(1, 4, 1);
    ps.minEmitPower = 0.6;
    ps.maxEmitPower = 1.1;
    ps.gravity = new Vector3(0, -6, 0);
    ps.manualEmitCount = 90;
    ps.targetStopDuration = 0.2;
    ps.disposeOnStop = true;
    ps.blendMode = ParticleSystem.BLENDMODE_ADD;
    ps.start();
  }
}
