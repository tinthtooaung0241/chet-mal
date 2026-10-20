import {
  Color3,
  DynamicTexture,
  Mesh,
  MeshBuilder,
  Scalar,
  StandardMaterial,
  TransformNode,
  type Vector3,
  type AbstractMesh,
  type Scene,
  type ShadowGenerator,
} from "@babylonjs/core";
import type { AssetLibrary } from "../assets";
import { ChefModel } from "./chef";
import {
  FOOD_RULES,
  SOUP_BURN,
  SOUP_SIZE,
  SOUP_TIME,
  targetStation,
  type Chef,
  type FoodState,
  type Game,
  type Item,
  type Role,
  type Station,
} from "@kitchen/shared";

const ITEM_SCALE = 2; // food and tools are real-size; scale up so they read at game distance
const PLATE_SCALE = 1.8;
const BOWL_SCALE = 1.8;
const POT_SCALE = 1.7;
const STOVE_TOP = 0.926; // top of the cast-iron grates

// Soup takes the colour of what went in.
const SOUP_COLORS: Record<string, string> = {
  Tomato: "#c8442c",
  Carrot: "#e07b2a",
  Onion: "#d6bd86",
  Potato: "#e6d6a2",
  Mushroom: "#8a6a4a",
};

function soupColor(kinds: string[]): Color3 {
  const c = new Color3(0, 0, 0);
  for (const k of kinds) c.addInPlace(Color3.FromHexString(SOUP_COLORS[k] ?? "#c9a36b"));
  return kinds.length ? c.scale(1 / kinds.length).toLinearSpace() : new Color3(0.6, 0.7, 0.8);
}
const COUNTER_TOP = 0.9;

const MODEL_SUFFIXES: Record<FoodState, string[]> = {
  raw: [""],
  chopped: ["_Chopped", "_Sliced"],
  cooked: ["_Cooked", "_Fries", "_Fried", "_Toasted"],
  burnt: ["_Burnt"],
};

// Small offsets so up to three foods sit side by side on a plate.
const PLATE_SLOTS = [
  [[0, 0]],
  [
    [-0.08, 0],
    [0.08, 0],
  ],
  [
    [-0.09, 0.05],
    [0.09, 0.05],
    [0, -0.08],
  ],
];

function meshesOf(node: TransformNode): AbstractMesh[] {
  return node.getChildMeshes(false);
}

function unlitMaterial(scene: Scene, name: string, color: Color3): StandardMaterial {
  const mat = new StandardMaterial(name, scene);
  mat.emissiveColor = color;
  mat.disableLighting = true;
  return mat;
}

/** A rounded, always-facing-you tag (station labels, ping labels, emote bubbles). */
function makeTag(scene: Scene, name: string, text: string, bg = "#2f3e4f", fg = "#f6f1e6"): Mesh {
  const texture = new DynamicTexture(name, { width: 256, height: 80 }, scene, true);
  texture.hasAlpha = true;
  const ctx = texture.getContext() as CanvasRenderingContext2D;
  ctx.clearRect(0, 0, 256, 80);
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.roundRect(4, 4, 248, 72, 36);
  ctx.fill();
  ctx.fillStyle = fg;
  // shrink long text (e.g. "plate of cooked steak and fries") to fit the tag
  let size = 40;
  do ctx.font = `bold ${size}px system-ui, sans-serif`;
  while (ctx.measureText(text).width > 228 && (size -= 2) > 16);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 128, 42);
  texture.update();
  // black emissive colour so only the texture shows (white would wash the text out)
  const mat = unlitMaterial(scene, `${name}Mat`, Color3.Black());
  mat.emissiveTexture = texture;
  mat.opacityTexture = texture;
  const plane = MeshBuilder.CreatePlane(name, { width: 0.42, height: 0.13 }, scene);
  plane.material = mat;
  plane.billboardMode = Mesh.BILLBOARDMODE_ALL;
  plane.isPickable = false;
  return plane;
}

/** A billboarded progress bar floating above a station. */
class ProgressBar {
  private readonly root: TransformNode;
  private readonly fill: Mesh;
  private readonly fillMat: StandardMaterial;
  private static readonly WIDTH = 0.5;

  constructor(scene: Scene, x: number, y: number, z: number) {
    this.root = new TransformNode("bar", scene);
    this.root.position.set(x, y, z);
    this.root.billboardMode = TransformNode.BILLBOARDMODE_ALL;
    const bg = MeshBuilder.CreatePlane("barBg", { width: ProgressBar.WIDTH + 0.04, height: 0.09 }, scene);
    bg.material = unlitMaterial(scene, "barBgMat", new Color3(0.08, 0.08, 0.09));
    bg.parent = this.root;
    this.fill = MeshBuilder.CreatePlane("barFill", { width: ProgressBar.WIDTH, height: 0.05 }, scene);
    this.fillMat = unlitMaterial(scene, "barFillMat", Color3.White());
    this.fillMat.zOffset = -2; // draw over the background
    this.fill.material = this.fillMat;
    this.fill.parent = this.root;
    this.hide();
  }

  show(progress: number, color: Color3) {
    const p = Scalar.Clamp(progress, 0.001, 1);
    this.fill.scaling.x = p;
    this.fill.position.x = (-(1 - p) * ProgressBar.WIDTH) / 2;
    this.fillMat.emissiveColor = color;
    this.root.setEnabled(true);
  }

  hide() {
    this.root.setEnabled(false);
  }
}

// Apron colours tell the chefs apart at a glance.
const APRON: Record<Role, Color3> = {
  full: Color3.FromHexString("#3a6ea5"),
  blind: Color3.FromHexString("#2a9d8f"),
  deaf: Color3.FromHexString("#e07a3f"),
  mute: Color3.FromHexString("#8e6bbf"),
};

interface ChefEntry {
  model: ChefModel;
  tag: Mesh | null;
  role: Role;
  bubble: { text: string; mesh: Mesh } | null;
}

/** Renders a Game. Holds no game rules: it only reads state every frame. */
export class GameView {
  private readonly stationNodes = new Map<number, TransformNode>();
  private readonly surfaceY = new Map<number, number>();
  private readonly bars = new Map<number, ProgressBar>();
  private readonly items = new Map<number, { node: TransformNode; key: string }>();
  private readonly chefs = new Map<string, ChefEntry>();
  private readonly potSoup = new Map<number, { mesh: Mesh; mat: StandardMaterial }>();
  /** a chef put a foot down (for positional footstep sounds) */
  onFootstep: ((chefId: string, x: number, z: number) => void) | null = null;
  private readonly pings = new Map<number, { root: TransformNode; ring: Mesh; glow: StandardMaterial }>();
  private highlighted: Station | null = null;
  private selfVisible = false;
  private readonly labels: Mesh[] = [];
  private time = 0;

  constructor(
    private readonly scene: Scene,
    private readonly lib: AssetLibrary,
    private readonly shadows: ShadowGenerator,
    game: Game,
  ) {
    for (const station of game.stations) this.buildStation(station);
  }

  // --- chefs --------------------------------------------------------------------

  private chefEntry(chef: Chef, isMe: boolean): ChefEntry {
    let entry = this.chefs.get(chef.id);
    if (!entry || entry.role !== chef.role) {
      if (entry) this.disposeChef(chef.id, entry);
      const model = new ChefModel(this.scene, this.shadows, this.lib, chef.role, APRON[chef.role]);
      const id = chef.id;
      model.onStep = (x, z) => this.onFootstep?.(id, x, z);
      model.root.position.set(chef.x, 0, chef.z);
      // name tags only over other players' chefs
      const tag = isMe ? null : makeTag(this.scene, `name-${chef.id}`, chef.name, "#1d2024");
      entry = { model, tag, role: chef.role, bubble: null };
      this.chefs.set(chef.id, entry);
    }
    return entry;
  }

  private disposeChef(id: string, entry: ChefEntry) {
    // keep materials: they're shared with every other copy of this character model
    entry.model.root.dispose(false, false);
    entry.tag?.dispose(false, true);
    entry.bubble?.mesh.dispose(false, true);
    this.chefs.delete(id);
  }

  private syncChefs(game: Game, me: Chef, dt: number) {
    const live = new Set<string>();
    for (const chef of game.chefs) {
      live.add(chef.id);
      const isMe = chef.id === me.id;
      const entry = this.chefEntry(chef, isMe);
      const target = game.phase === "playing" ? targetStation(game, chef) : null;
      entry.model.update(
        {
          x: chef.x,
          z: chef.z,
          facing: chef.facing,
          pitch: chef.pitch,
          chopping: chef.chopping,
          holding: !!chef.held,
          gesture: chef.gesture,
          guided: !!chef.guidedBy,
          guiding: game.chefs.some((c) => c.guidedBy === chef.id),
          stirring: !!target?.pot && (target.pot.state === "cooking" || target.pot.state === "done") && !chef.held,
          look: target ? { x: target.x, z: target.z } : null,
        },
        dt,
        this.time,
        !isMe,
      );
      entry.model.root.setEnabled(!isMe || this.selfVisible);
      const at = entry.model.root.position;
      entry.tag?.position.set(at.x, 2.05, at.z);
      const text = chef.bubble?.text ?? null;
      if (text !== (entry.bubble?.text ?? null)) {
        entry.bubble?.mesh.dispose(false, true);
        entry.bubble = text ? { text, mesh: makeTag(this.scene, `bubble-${chef.id}`, text, "#f2a541", "#1d2024") } : null;
      }
      entry.bubble?.mesh.position.set(at.x, entry.tag ? 2.25 : 2.15, at.z);
    }
    for (const [id, entry] of this.chefs) if (!live.has(id)) this.disposeChef(id, entry);
  }

  // --- stations ---------------------------------------------------------------

  private spawnInto(parent: TransformNode, name: string, y = 0, scale = 1): TransformNode {
    const node = this.lib.spawn(name);
    node.parent = parent;
    node.position.y = y;
    node.scaling.setAll(scale);
    for (const mesh of meshesOf(node)) {
      this.shadows.addShadowCaster(mesh);
      mesh.receiveShadows = true;
    }
    return node;
  }

  private buildStation(s: Station) {
    const root = new TransformNode(`station-${s.id}`, this.scene);
    root.position.set(s.x, 0, s.z);
    root.rotation.y = s.facing;
    this.stationNodes.set(s.id, root);
    let surface = COUNTER_TOP;

    switch (s.kind) {
      case "counter":
        this.spawnInto(root, "Counter");
        break;
      case "board": {
        this.spawnInto(root, "Counter");
        this.spawnInto(root, "CuttingBoard", COUNTER_TOP, ITEM_SCALE);
        // a knife resting by the board (the chopping chef holds their own)
        const knife = this.spawnInto(root, "Knife", COUNTER_TOP + 0.002, 1.6);
        knife.position.set(0.3, COUNTER_TOP + 0.002, -0.22);
        knife.rotation.y = 1.4;
        surface = COUNTER_TOP + 0.021 * ITEM_SCALE;
        this.bars.set(s.id, new ProgressBar(this.scene, s.x, 1.3, s.z));
        break;
      }
      case "pot": {
        this.spawnInto(root, "Stove");
        this.spawnInto(root, "Pot", STOVE_TOP, POT_SCALE);
        const ladle = this.spawnInto(root, "Ladle", STOVE_TOP + 0.12, 1.5);
        ladle.position.set(0.05, STOVE_TOP + 0.13, 0.04);
        ladle.rotation.set(0, 0.6, -0.9);
        // the soup surface rises as vegetables go in, and takes their colour
        const surfaceMesh = MeshBuilder.CreateDisc(`potSoup-${s.id}`, { radius: 0.15, tessellation: 20 }, this.scene);
        surfaceMesh.rotation.x = Math.PI / 2;
        surfaceMesh.parent = root;
        const mat = new StandardMaterial(`potSoupMat-${s.id}`, this.scene);
        mat.specularColor = new Color3(0.3, 0.3, 0.3);
        surfaceMesh.material = mat;
        surfaceMesh.isPickable = false;
        this.potSoup.set(s.id, { mesh: surfaceMesh, mat });
        this.bars.set(s.id, new ProgressBar(this.scene, s.x, 1.45, s.z));
        break;
      }
      case "bowls":
        this.spawnInto(root, "Counter");
        for (let i = 0; i < 3; i++) this.spawnInto(root, "Bowl", COUNTER_TOP + i * 0.045, BOWL_SCALE);
        break;
      case "stove": {
        this.spawnInto(root, "Stove");
        const pan = this.spawnInto(root, "FryingPan", 0.926, 1.6); // resting on the grates
        pan.rotation.y = Math.PI / 2; // handle points sideways, not at the chef
        surface = 0.926 + 0.008 * 1.6;
        this.bars.set(s.id, new ProgressBar(this.scene, s.x, 1.3, s.z));
        break;
      }
      case "crate": {
        // wire rack with an open crate on top, filled with a few of its ingredient
        this.spawnInto(root, "ProduceRack");
        // heaped up and tilted towards the chef so they show over the crate's slats
        const spots: [number, number, number, number][] = [
          [-0.16, 0.06, 0.4, 0.8],
          [0.15, -0.04, 2.1, 0.82],
          [0.0, 0.16, 4.0, 0.86],
          [0.02, -0.14, 1.2, 0.84],
        ];
        for (const [ox, oz, yaw, y] of spots) {
          const sample = this.spawnInto(root, s.crate!, y, ITEM_SCALE * 1.1);
          sample.position.x = ox;
          sample.position.z = oz;
          sample.rotation.set(-0.45, yaw, 0);
        }
        this.label(s, s.crate!, 1.22);
        break;
      }
      case "plates":
        this.spawnInto(root, "Counter");
        for (let i = 0; i < 3; i++) this.spawnInto(root, "Plate", COUNTER_TOP + i * 0.035, PLATE_SCALE);
        break;
      case "serve":
        // the pass: steel counter under heat lamps, facing the dining terrace
        this.spawnInto(root, "PassCounter");
        break;
      case "trash":
        this.spawnInto(root, "TrashBin", 0, 1.15);
        break;
      case "sink":
        this.spawnInto(root, "Sink");
        break;
    }
    this.surfaceY.set(s.id, surface);
  }

  private label(s: Station, text: string, y = 1.4) {
    const tag = makeTag(this.scene, `label-${s.id}`, text);
    tag.position.set(s.x, y, s.z);
    tag.setEnabled(this.selfVisible);
    this.labels.push(tag);
  }

  // --- pings and the emote bubble ---------------------------------------------------

  private syncSignals(game: Game) {
    const live = new Set<number>();
    for (const p of game.pings) {
      live.add(p.id);
      let entry = this.pings.get(p.id);
      if (!entry) {
        const root = new TransformNode(`ping-${p.id}`, this.scene);
        root.position.set(p.x, 0, p.z);
        const glow = unlitMaterial(this.scene, `pingMat-${p.id}`, new Color3(1, 0.78, 0.25));
        glow.alpha = 0.55;
        const beam = MeshBuilder.CreateCylinder("pingBeam", { height: 2.4, diameter: 0.05, tessellation: 8 }, this.scene);
        beam.position.y = 1.2;
        const ring = MeshBuilder.CreateTorus("pingRing", { diameter: 0.55, thickness: 0.035, tessellation: 24 }, this.scene);
        ring.position.y = 0.96;
        for (const m of [beam, ring]) {
          m.material = glow;
          m.parent = root;
          m.isPickable = false;
        }
        const tag = makeTag(this.scene, `pingTag-${p.id}`, p.label, "#c9871c");
        tag.parent = root;
        tag.position.y = 2.15;
        entry = { root, ring, glow };
        this.pings.set(p.id, entry);
      }
      entry.ring.scaling.setAll(1 + 0.25 * Math.sin(this.time * 6));
      entry.glow.alpha = 0.55 * Math.min(1, p.ttl);
    }
    for (const [id, entry] of this.pings) {
      if (!live.has(id)) {
        entry.root.dispose(false, true);
        this.pings.delete(id);
      }
    }
  }

  // --- items ------------------------------------------------------------------

  private foodModel(kind: string, state: FoodState): { name: string; burnt: boolean } {
    for (const suffix of MODEL_SUFFIXES[state]) {
      if (this.lib.has(kind + suffix)) return { name: kind + suffix, burnt: false };
    }
    // no dedicated burnt model: darken the cooked one
    if (state === "burnt") return { ...this.foodModel(kind, "cooked"), burnt: true };
    return { name: kind, burnt: false };
  }

  private makeItem(item: Item): TransformNode {
    if (item.type === "plate") return this.lib.spawn("Plate");
    if (item.type === "bowl") {
      const node = this.lib.spawn("Bowl");
      for (const mesh of meshesOf(node)) this.shadows.addShadowCaster(mesh);
      if (item.soup) {
        // the soup surface, just under the rim (bowl model is 0.07 m tall before scaling)
        const surface = MeshBuilder.CreateDisc("soup", { radius: 0.07, tessellation: 16 }, this.scene);
        surface.rotation.x = Math.PI / 2;
        surface.position.y = 0.055;
        const mat = new StandardMaterial("soupMat", this.scene);
        mat.diffuseColor = soupColor(item.soup);
        mat.specularColor = new Color3(0.25, 0.25, 0.25);
        if (item.spoiled) mat.diffuseColor = Color3.Lerp(mat.diffuseColor, new Color3(0.3, 0.45, 0.1), 0.5);
        surface.material = mat;
        surface.parent = node;
      }
      return node;
    }
    const { name, burnt } = this.foodModel(item.kind, item.state);
    const node = this.lib.spawn(name);
    for (const mesh of meshesOf(node)) {
      this.shadows.addShadowCaster(mesh);
      if (burnt) {
        mesh.renderOverlay = true;
        mesh.overlayColor = new Color3(0.05, 0.03, 0.02);
        mesh.overlayAlpha = 0.8;
      } else if (item.spoiled) {
        // mould: something only a chef who can see will notice
        mesh.renderOverlay = true;
        mesh.overlayColor = new Color3(0.35, 0.5, 0.12);
        mesh.overlayAlpha = 0.55;
      }
    }
    return node;
  }

  private placeItem(item: Item, x: number, y: number, z: number, yaw: number, scale: number, seen: Set<number>) {
    seen.add(item.id);
    const key =
      item.type === "plate"
        ? "plate"
        : item.type === "bowl"
          ? `bowl:${item.soup?.join() ?? ""}:${item.spoiled}`
          : `${item.kind}:${item.state}:${item.spoiled ? "mould" : ""}`;
    let entry = this.items.get(item.id);
    if (!entry || entry.key !== key) {
      entry?.node.dispose();
      entry = { node: this.makeItem(item), key };
      this.items.set(item.id, entry);
    }
    entry.node.position.set(x, y, z);
    entry.node.rotation.y = yaw;
    // plates and bowls follow the same shrink as food when held close to the eye
    const shrink = scale / ITEM_SCALE;
    entry.node.scaling.setAll(item.type === "plate" ? PLATE_SCALE * shrink : item.type === "bowl" ? BOWL_SCALE * shrink : scale);
    if (item.type === "plate") {
      const slots = PLATE_SLOTS[item.contents.length - 1] ?? [];
      item.contents.forEach((food, i) => {
        const [ox, oz] = slots[i] ?? [0, 0];
        this.placeItem(food, x + ox * shrink, y + 0.012 * shrink, z + oz * shrink, yaw, ITEM_SCALE * 0.75 * shrink, seen);
      });
    }
  }

  clearItems() {
    for (const { node } of this.items.values()) node.dispose();
    this.items.clear();
  }

  // --- per frame ----------------------------------------------------------------

  /** First person hides your own chef's body (the camera sits inside it). */
  setSelfVisible(visible: boolean) {
    // overhead view: show crate labels; first person has the HUD target tag instead
    for (const tag of this.labels) tag.setEnabled(visible);
    this.selfVisible = visible;
  }

  /**
   * @param me the chef this screen belongs to
   * @param hand world position for my held item in first person; null in the overhead view
   */
  sync(game: Game, me: Chef, dt: number, hand: Vector3 | null = null) {
    this.time += dt;
    this.syncChefs(game, me, dt);
    const seen = new Set<number>();
    for (const s of game.stations) {
      if (s.item) this.placeItem(s.item, s.x, this.surfaceY.get(s.id)!, s.z, s.facing, ITEM_SCALE, seen);
    }
    for (const chef of game.chefs) {
      if (!chef.held) continue;
      if (chef.id === me.id && hand) {
        // close to the eye, so near real size; the 2x game scale would fill the screen
        this.placeItem(chef.held, hand.x, hand.y, hand.z, chef.facing, 1, seen);
        continue;
      }
      // carried in the chef model's hands (fallback: in front of it)
      const model = this.chefs.get(chef.id)?.model;
      const yaw = model?.root.rotation.y ?? chef.facing;
      const palms = model?.carryPoint();
      if (palms) {
        this.placeItem(chef.held, palms.x, palms.y - 0.03, palms.z, yaw, ITEM_SCALE, seen);
      } else {
        const x = model?.root.position.x ?? chef.x;
        const z = model?.root.position.z ?? chef.z;
        this.placeItem(chef.held, x + Math.sin(yaw) * 0.48, 0.98, z + Math.cos(yaw) * 0.48, yaw, ITEM_SCALE, seen);
      }
    }
    for (const [id, entry] of this.items) {
      if (!seen.has(id)) {
        entry.node.dispose();
        this.items.delete(id);
      }
    }

    this.syncHighlight(game.phase === "playing" ? targetStation(game, me) : null);
    this.syncBars(game);
    this.syncPots(game);
    this.syncSignals(game);
  }

  private syncHighlight(target: Station | null) {
    if (target?.id === this.highlighted?.id) return;
    const set = (s: Station | null, on: boolean) => {
      const node = s && this.stationNodes.get(s.id);
      if (!node) return;
      for (const mesh of meshesOf(node)) {
        mesh.renderOverlay = on;
        mesh.overlayColor = Color3.White();
        mesh.overlayAlpha = 0.22;
      }
    };
    set(this.highlighted, false);
    set(target, true);
    this.highlighted = target;
  }

  private syncBars(game: Game) {
    for (const s of game.stations) {
      const bar = this.bars.get(s.id);
      if (!bar) continue;
      const food = s.item?.type === "food" ? s.item : null;
      const rule = food && FOOD_RULES[food.kind];
      if (s.kind === "board" && food && rule?.chop && food.state === "raw" && food.chop > 0) {
        bar.show(food.chop, new Color3(0.92, 0.92, 0.92));
      } else if (s.kind === "stove" && food && rule?.cookFrom && food.state === rule.cookFrom) {
        bar.show(food.cook / (rule.cookTime ?? 6), new Color3(1, 0.6, 0.1));
      } else if (s.kind === "stove" && food && rule?.cookFrom && food.state === "cooked") {
        // counts down to burning; flashes red once the warning has been given
        const left = 1 - (food.cook - (rule.cookTime ?? 6)) / (rule.burnTime ?? 6);
        this.showBurnCountdown(bar, left, food.warned);
      } else if (s.pot && s.pot.state === "filling" && s.pot.contents.length) {
        bar.show(s.pot.contents.length / SOUP_SIZE, new Color3(0.92, 0.92, 0.92));
      } else if (s.pot && s.pot.state === "cooking") {
        bar.show(s.pot.cook / SOUP_TIME, new Color3(1, 0.6, 0.1));
      } else if (s.pot && s.pot.state === "done") {
        this.showBurnCountdown(bar, 1 - (s.pot.cook - SOUP_TIME) / SOUP_BURN, s.pot.warned);
      } else {
        bar.hide();
      }
    }
  }

  private showBurnCountdown(bar: ProgressBar, left: number, warned: boolean) {
    const flash = warned && Math.floor(this.time * 6) % 2 === 0;
    bar.show(left, flash ? new Color3(1, 0.15, 0.1) : Color3.Lerp(new Color3(1, 0.2, 0.1), new Color3(0.3, 0.85, 0.35), left));
  }

  /** Soup level and colour in each pot. */
  private syncPots(game: Game) {
    for (const s of game.stations) {
      const view = s.pot && this.potSoup.get(s.id);
      if (!view || !s.pot) continue;
      const pot = s.pot;
      const fill = pot.state === "filling" ? pot.contents.length / SOUP_SIZE : 1;
      view.mesh.setEnabled(pot.contents.length > 0 || pot.state === "burnt");
      // the surface sits inside the pot model (0.14 m deep before scaling)
      view.mesh.position.y = STOVE_TOP + 0.02 + (0.05 + 0.07 * fill) * POT_SCALE;
      const base = soupColor(pot.contents.map((f) => f.kind));
      const burnt = new Color3(0.08, 0.05, 0.03);
      view.mat.diffuseColor =
        pot.state === "burnt"
          ? burnt
          : pot.state === "filling"
            ? Color3.Lerp(new Color3(0.55, 0.62, 0.68), base, 0.45) // still mostly water
            : pot.warned
              ? Color3.Lerp(base, burnt, 0.45)
              : base;
      if (pot.contents.some((f) => f.spoiled)) view.mat.diffuseColor = Color3.Lerp(view.mat.diffuseColor, new Color3(0.3, 0.45, 0.1), 0.45);
    }
  }
}
