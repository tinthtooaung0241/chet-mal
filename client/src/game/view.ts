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
  dinerDishSpot,
  burnTimeFor,
  pickedItem,
  dinerTable,
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
  Fish: "#d9902f",
  Noodles: "#e8c27a",
};

function soupColor(kinds: string[]): Color3 {
  const c = new Color3(0, 0, 0);
  for (const k of kinds) c.addInPlace(Color3.FromHexString(SOUP_COLORS[k] ?? "#c9a36b"));
  return kinds.length ? c.scale(1 / kinds.length).toLinearSpace() : new Color3(0.6, 0.7, 0.8);
}
const COUNTER_TOP = 0.9;

// a little heap of an ingredient in a pantry basket (x, z, yaw)
const BASKET_SPOTS: [number, number, number][] = [
  [-0.07, -0.04, 0.4],
  [0.07, 0.0, 2.2],
  [0, -0.1, 4.0],
];

// where the copies of an ingredient sit on a fridge shelf (x, z towards the glass, yaw)
const FRIDGE_SPOTS: [number, number, number][] = [
  [-0.07, -0.04, 0.3],
  [0.08, 0.05, 1.7],
];
/** Each restaurant's customers: everyday clothes at the street stand, longyi and htamein in Yangon. */
const DINER_MODELS: Record<string, string[]> = {
  street: ["Diner_A", "Diner_B", "Diner_C", "Diner_D"],
  burmese: ["Diner_MM_A", "Diner_MM_B", "Diner_MM_C", "Diner_MM_D"],
};
const TABLE_TOP = 0.78;

const MODEL_SUFFIXES: Record<FoodState, string[]> = {
  raw: [""],
  chopped: ["_Chopped", "_Sliced"],
  cooked: ["_Cooked", "_Fries", "_Fried", "_Toasted"],
  burnt: ["_Burnt"],
};

// height of the plate's well above its base, at game scale (the rim stands higher)
const PLATE_WELL = 0.016;

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

// One colour language for every bar in the kitchen (matches the HUD):
// mint = work in progress (chopping, filling the pot), honey = cooking, peach→tomato = about to burn.
const BAR = {
  frame: Color3.FromHexString("#3b2f27"),
  track: Color3.FromHexString("#f6ecdc"),
  work: Color3.FromHexString("#7fc98a"),
  cook: Color3.FromHexString("#f2a541"),
  safe: Color3.FromHexString("#f6c35b"),
  burn: Color3.FromHexString("#e4553f"),
};
/**
 * A small billboarded progress bar just above a station: dark outline, cream track, coloured fill.
 * Each layer draws in its own rendering group (depth cleared in between), so the fill always sits
 * cleanly on the track instead of flickering through it.
 */
class ProgressBar {
  private readonly root: TransformNode;
  private readonly fill: Mesh;
  private readonly fillMat: StandardMaterial;
  private static readonly WIDTH = 0.3;
  /** what it shows right now (the HUD reuses it for the station you're facing) */
  state: { progress: number; color: string } | null = null;

  constructor(scene: Scene, x: number, y: number, z: number) {
    this.root = new TransformNode("bar", scene);
    this.root.position.set(x, y, z);
    this.root.billboardMode = TransformNode.BILLBOARDMODE_ALL;
    const layer = (name: string, width: number, height: number, color: Color3, group: number) => {
      const mesh = MeshBuilder.CreatePlane(name, { width, height }, scene);
      const mat = unlitMaterial(scene, `${name}Mat`, color);
      mesh.material = mat;
      mesh.parent = this.root;
      mesh.isPickable = false;
      mesh.renderingGroupId = group;
      return { mesh, mat };
    };
    layer("barFrame", ProgressBar.WIDTH + 0.03, 0.07, BAR.frame, 1);
    layer("barTrack", ProgressBar.WIDTH + 0.006, 0.042, BAR.track, 2);
    const fill = layer("barFill", ProgressBar.WIDTH, 0.03, BAR.work, 3);
    this.fill = fill.mesh;
    this.fillMat = fill.mat;
    this.hide();
  }

  show(progress: number, color: Color3, visible = true) {
    const p = Scalar.Clamp(progress, 0.02, 1);
    this.fill.scaling.x = p;
    this.fill.position.x = (-(1 - p) * ProgressBar.WIDTH) / 2;
    this.fillMat.emissiveColor = color;
    this.root.setEnabled(visible);
    this.state = { progress: p, color: color.toHexString() };
  }

  dispose() {
    this.root.dispose(false, true);
  }

  hide() {
    this.root.setEnabled(false);
    this.state = null;
  }
}

// Apron colours tell the chefs apart at a glance.
const APRON: Record<Role, Color3> = {
  full: Color3.FromHexString("#3a6ea5"),
  head: Color3.FromHexString("#c98a2e"),
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
  /** points floating up from the pass, fading as they rise */
  private readonly floaters: { mesh: Mesh; age: number }[] = [];
  /** puddles of spilled oil on the floor */
  private readonly puddles = new Map<number, Mesh>();
  private puddleMat: StandardMaterial | null = null;
  /** plates waiting by each sink, shown as many as there are dirty dishes (up to the stack's size) */
  private readonly dirtyStacks = new Map<number, TransformNode[]>();
  private readonly items = new Map<number, { node: TransformNode; key: string }>();
  private readonly chefs = new Map<string, ChefEntry>();
  private readonly racks = new Map<number, { parts: Map<string, { node: TransformNode; restY: number }>; lit: string | null }>();
  private readonly diners = new Map<number, { model: ChefModel; bubble: { text: string; mesh: Mesh } | null; fade: number }>();
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
      model.setLook(chef.look);
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
        this.bars.set(s.id, new ProgressBar(this.scene, s.x, 1.22, s.z));
        break;
      }
      case "pot": {
        this.spawnInto(root, "Stove");
        this.spawnInto(root, "Pot", STOVE_TOP, POT_SCALE);
        const ladle = this.spawnInto(root, "Ladle", STOVE_TOP + 0.12, 1.5);
        ladle.position.set(0.05, STOVE_TOP + 0.13, 0.04);
        ladle.rotation.set(0, 0.6, 0.9); // bowl down in the pot, handle up over the rim
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
        this.buildDishCart(root, s, "Bowl", 0.045, BOWL_SCALE);
        break;
      case "stove": {
        this.spawnInto(root, "Stove");
        const pan = this.spawnInto(root, "FryingPan", 0.926, 1.6); // resting on the grates
        pan.rotation.y = Math.PI / 2; // handle points sideways, not at the chef
        surface = 0.926 + 0.008 * 1.6;
        this.bars.set(s.id, new ProgressBar(this.scene, s.x, 1.22, s.z));
        break;
      }
      case "fridge":
        this.buildFridge(root, s);
        break;
      case "pantry":
        this.buildPantry(root, s);
        break;
      case "decor":
        if (this.lib.has("CornerDecor")) this.spawnInto(root, "CornerDecor");
        break;
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
        this.buildDishCart(root, s, "Plate", 0.035, PLATE_SCALE);
        break;
      case "serve":
        // the pass: steel counter under heat lamps, facing the dining terrace
        this.spawnInto(root, "PassCounter");
        break;
      case "trash":
        this.spawnInto(root, "TrashBin", 0, 1.15);
        break;
      case "sink": {
        this.spawnInto(root, "Sink");
        // dirty dishes pile up on the edge of the sink until someone washes them
        const stack = [0, 1, 2, 3].map((i) => {
          const plate = this.spawnInto(root, "Plate", COUNTER_TOP + 0.01 + i * 0.03, PLATE_SCALE);
          plate.position.x = 0.28;
          plate.position.z = 0.12;
          plate.rotation.y = i * 0.7;
          plate.setEnabled(false);
          return plate;
        });
        this.dirtyStacks.set(s.id, stack);
        this.bars.set(s.id, new ProgressBar(this.scene, s.x, 1.22, s.z));
        break;
      }
      case "register": {
        // the till sits on the pass counter, its screen and card reader facing both sides
        this.spawnInto(root, "Counter");
        if (this.lib.has("CashRegister")) {
          const till = this.spawnInto(root, "CashRegister", COUNTER_TOP, 1.4);
          till.position.z = 0.05;
        }
        this.label(s, "Till", 1.45);
        break;
      }
      case "spice": {
        // a counter with the spice rack pushed to the back, leaving room to put a dish down
        this.spawnInto(root, "Counter");
        // the Burmese kitchen has its own topping rack, laid out the same way
        const model = s.stock?.includes("Lime") && this.lib.has("BurmeseSpiceRack") ? "BurmeseSpiceRack" : "SpiceRack";
        if (this.lib.has(model)) {
          // big enough to fill the whole counter, so every bottle reads from across the kitchen
          const rack = this.spawnInto(root, model, COUNTER_TOP, 2.4);
          rack.position.z = 0.02;
          // each seasoning is its own part, so the chosen one can light up
          const parts = new Map<string, { node: TransformNode; restY: number }>();
          for (const spice of s.stock ?? []) {
            const node = rack.getDescendants(false).find((n) => n.name.endsWith(`SpiceRack_${spice}`)) as TransformNode | undefined;
            if (node) parts.set(spice, { node, restY: node.position.y });
          }
          this.racks.set(s.id, { parts, lit: null });
        }
        this.label(s, model === "BurmeseSpiceRack" ? "Toppings" : "Spices", 1.4);
        break;
      }
    }
    this.surfaceY.set(s.id, surface);
  }

  /** A rolling steel dish cart: tall stacks of clean plates (or bowls) on top, spares below. */
  private buildDishCart(root: TransformNode, s: Station, dish: string, step: number, scale: number) {
    const cart = this.lib.has("DishCart");
    this.spawnInto(root, cart ? "DishCart" : "Counter");
    const top = cart ? 0.885 : COUNTER_TOP;
    const stacks: [number, number, number][] = cart
      ? [
          [-0.18, -0.08, 6], // [x, z, how many]
          [0.18, -0.08, 5],
        ]
      : [[0, 0, 3]];
    for (const [x, z, n] of stacks) {
      for (let i = 0; i < n; i++) {
        const d = this.spawnInto(root, dish, top + i * step, scale);
        d.position.x = x;
        d.position.z = z;
      }
    }
    if (cart) {
      for (const x of [-0.18, 0.18]) {
        for (let i = 0; i < 3; i++) {
          const d = this.spawnInto(root, dish, 0.345 + i * step, scale);
          d.position.x = x;
        }
      }
    }
    this.label(s, dish === "Plate" ? "Plates" : "Bowls", 1.4);
  }

  /** The pantry shelf: a woven basket of each room-temperature ingredient, in picking order. */
  private buildPantry(root: TransformNode, s: Station) {
    if (!this.lib.has("PantryShelf")) {
      this.spawnInto(root, "ProduceRack");
      return;
    }
    this.spawnInto(root, "PantryShelf");
    // baskets: left/right on three shelves, top to bottom (matches keys 1-5)
    const baskets: [number, number][] = [
      [-0.19, 1.12],
      [0.19, 1.12],
      [-0.19, 0.7],
      [0.19, 0.7],
      [-0.19, 0.28],
      [0.19, 0.28],
    ];
    // up to three ingredients fill a whole shelf each (both baskets), top down
    const stock = s.stock ?? [];
    const wide = stock.length <= 3;
    stock.forEach((kind, i) => {
      const spots = wide ? [baskets[i * 2], baskets[i * 2 + 1]] : [baskets[i] ?? baskets.at(-1)!];
      for (const [bx, by] of spots) for (const [ox, oz, yaw] of BASKET_SPOTS) {
        const sample = this.spawnInto(root, kind, by + 0.03, ITEM_SCALE * 0.75);
        // local +x is the chef's right-hand side looking at the shelf, so mirror to read left to right
        sample.position.x = -(bx + ox);
        sample.position.z = oz;
        sample.rotation.set(-0.25, yaw + i, 0);
      }
    });
    this.label(s, s.label === "root vegetable shelf" ? "Roots" : s.label === "bread and tomato shelf" ? "Bread & tomatoes" : "Pantry", 1.75);
  }

  /** A door of the reach-in fridge: each shelf is stocked with one of its ingredients. */
  private buildFridge(root: TransformNode, s: Station) {
    if (!this.lib.has("ReachInFridge")) {
      this.spawnInto(root, "ProduceRack");
      return;
    }
    const fridge = this.spawnInto(root, "ReachInFridge");
    // clear glass: keep the sky's reflection faint so the food inside reads from across the room
    for (const mesh of meshesOf(fridge)) {
      const mat = mesh.material as { name?: string; alpha?: number; environmentIntensity?: number } | null;
      if (mat?.name === "LP_FridgeGlass") {
        mat.alpha = 0.1;
        mat.environmentIntensity = 0.15;
      }
    }
    // up to three ingredients: one per shelf, top down; more: two per shelf, left to right
    const shelves = [1.17, 0.82, 0.44];
    const stock = s.stock ?? [];
    const wide = stock.length <= shelves.length;
    stock.forEach((kind, i) => {
      const y = shelves[wide ? i : Math.floor(i / 2)] ?? shelves.at(-1)!;
      const sides = wide ? [-0.19, 0.19] : [i % 2 === 0 ? -0.19 : 0.19];
      for (const side of sides) for (const [ox, oz, yaw] of FRIDGE_SPOTS) {
        const sample = this.spawnInto(root, kind, y, ITEM_SCALE * 0.8);
        sample.position.x = -(side + ox); // mirrored: local +x is the chef's right
        sample.position.z = oz;
        sample.rotation.y = yaw + i;
      }
    });
    this.label(s, s.label === "meat and fish fridge" ? "Meat & fish" : s.label === "dairy and greens fridge" ? "Dairy & greens" : "Fridge", 1.75);
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
      const slots = PLATE_SLOTS[Math.min(item.contents.length, PLATE_SLOTS.length) - 1] ?? [];
      const cos = Math.cos(yaw);
      const sin = Math.sin(yaw);
      item.contents.forEach((food, i) => {
        // slots turn with the plate so food never hangs over the rim, whichever way it faces
        const [ox, oz] = slots[i % slots.length] ?? [0, 0];
        const dx = ox * cos + oz * sin;
        const dz = -ox * sin + oz * cos;
        this.placeItem(food, x + dx * shrink, y + PLATE_WELL * shrink, z + dz * shrink, yaw + i * 0.7, ITEM_SCALE * 0.75 * shrink, seen);
      });
    }
  }

  /** Remove everything this view built (switching to another restaurant's kitchen). */
  dispose() {
    this.clearItems();
    for (const [id, entry] of [...this.chefs]) this.disposeChef(id, entry);
    for (const node of this.stationNodes.values()) node.dispose(false, false);
    for (const bar of this.bars.values()) bar.dispose();
    for (const { mesh } of this.potSoup.values()) mesh.dispose(false, true);
    for (const { root } of this.pings.values()) root.dispose(false, true);
    for (const tag of this.labels) tag.dispose(false, true);
    this.guideArrow?.dispose(false, true);
    this.stationNodes.clear();
    this.bars.clear();
    this.potSoup.clear();
    this.pings.clear();
    this.racks.clear();
    this.labels.length = 0;
  }

  clearItems() {
    for (const { node } of this.items.values()) node.dispose();
    this.items.clear();
    // and a new round's floor is clean, with no points still floating
    for (const disc of this.puddles.values()) disc.dispose();
    this.puddles.clear();
    for (const f of this.floaters) {
      f.mesh.material?.dispose(true, true);
      f.mesh.dispose();
    }
    this.floaters.length = 0;
    // a new round starts its ids again, so forget the old customers too
    for (const entry of this.diners.values()) {
      entry.model.root.dispose(false, false);
      entry.bubble?.mesh.dispose(false, true);
    }
    this.diners.clear();
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
    this.syncDiners(game, dt, seen);
    for (const [id, entry] of this.items) {
      if (!seen.has(id)) {
        entry.node.dispose();
        this.items.delete(id);
      }
    }

    this.syncHighlight(game.phase === "playing" ? targetStation(game, me) : null);
    this.syncRacks(game, me);
    const faced = !this.selfVisible && game.phase === "playing" ? (targetStation(game, me)?.id ?? null) : null;
    this.syncBars(game, faced);
    this.syncDirty(game);
    this.syncPuddles(game);
    this.syncFloaters(dt);
    this.syncPots(game);
    this.syncSignals(game);
  }

  // --- customers --------------------------------------------------------------------

  private syncDiners(game: Game, dt: number, seen: Set<number>) {
    const live = new Set<number>();
    const orders = new Map(game.orders.map((o) => [o.id, o]));
    for (const d of game.diners) {
      live.add(d.id);
      let entry = this.diners.get(d.id);
      if (!entry) {
        const looks = DINER_MODELS[game.venue] ?? DINER_MODELS.street;
        const model = new ChefModel(this.scene, this.shadows, this.lib, "full", APRON.full, looks[d.look % looks.length]);
        model.root.position.set(d.x, 0, d.z);
        model.root.rotation.y = d.facing;
        entry = { model, bubble: null, fade: 0 };
        this.diners.set(d.id, entry);
      }
      const sitting = d.state === "waiting" || d.state === "eating";
      const spot = dinerDishSpot(d);
      entry.model.update(
        {
          x: d.x,
          z: d.z,
          facing: d.facing,
          pitch: sitting ? 0.25 : 0,
          chopping: false,
          holding: spot === "hands",
          stirring: false,
          gesture: null,
          guided: false,
          guiding: false,
          look: null,
          sitting,
          eating: d.state === "eating" && d.mood !== "sick",
        },
        dt,
        this.time,
        true,
      );
      // fade in at the terrace steps, fade out as they leave
      entry.fade = Math.min(1, entry.fade + dt * 2);
      entry.model.root.scaling.setAll((0.75 + 0.25 * entry.fade) * (d.kid ? 0.7 : 1));

      // their dish: on the pass, in their hands, then on the table
      if (d.dish && spot) {
        const at = entry.model.root.position;
        if (spot === "pass") {
          this.placeItem(d.dish, d.pickup[0], COUNTER_TOP + 0.12, -2.62, Math.PI, ITEM_SCALE, seen);
        } else if (spot === "hands") {
          const palms = entry.model.carryPoint();
          if (palms) this.placeItem(d.dish, palms.x, palms.y - 0.03, palms.z, d.facing, ITEM_SCALE, seen);
        } else {
          const [tx, tz] = dinerTable(d);
          const k = 0.55; // most of the way from the chair to the table centre
          this.placeItem(d.dish, at.x + (tx - at.x) * k, TABLE_TOP, at.z + (tz - at.z) * k, d.facing, ITEM_SCALE, seen);
        }
      }

      // a little speech bubble for how they feel
      const order = orders.get(d.orderId);
      const text =
        d.state === "paying"
          ? `${d.pay}, please!`
          : d.mood === "angry"
          ? "Hmph!"
          : d.mood === "sick" && d.state === "leaving"
            ? "Ugh…"
            : d.state === "eating" && d.mood === "happy"
              ? "Yum!"
              : d.state === "leaving"
                ? "Thanks!"
                : order?.warned
                  ? "Hungry!"
                  : order?.critic
                    ? "Critic"
                    : null;
      if (text !== (entry.bubble?.text ?? null)) {
        entry.bubble?.mesh.dispose(false, true);
        const color = d.mood === "angry" || text === "Hungry!" ? "#f6a491" : text === "Critic" ? "#f6c35b" : "#fffaf0";
        entry.bubble = text ? { text, mesh: makeTag(this.scene, `diner-${d.id}`, text, color, "#3b2f27") } : null;
      }
      const at = entry.model.root.position;
      entry.bubble?.mesh.position.set(at.x, sitting ? 1.75 : 2.1, at.z);
    }
    for (const [id, entry] of this.diners) {
      if (live.has(id)) continue;
      entry.model.root.dispose(false, false);
      entry.bubble?.mesh.dispose(false, true);
      this.diners.delete(id);
    }
  }

  /** The seasoning you've chosen glows and lifts out of its slot, so the number bar matches the rack. */
  private syncRacks(game: Game, me: Chef) {
    const target = game.phase === "playing" ? targetStation(game, me) : null;
    for (const [id, rack] of this.racks) {
      const st = target?.id === id ? target : null;
      const want = st ? pickedItem(st, me) : null;
      if (want !== rack.lit) {
        const glow = (spice: string | null, on: boolean) => {
          const part = spice ? rack.parts.get(spice) : undefined;
          if (!part) return;
          for (const mesh of meshesOf(part.node).concat(part.node instanceof Mesh ? [part.node] : [])) {
            mesh.renderOverlay = on;
            mesh.overlayColor = Color3.FromHexString("#f6c35b");
            mesh.overlayAlpha = 0.45;
          }
        };
        glow(rack.lit, false);
        glow(want, true);
        rack.lit = want;
      }
      for (const [spice, part] of rack.parts) {
        const lift = spice === rack.lit ? 0.025 + Math.sin(this.time * 5) * 0.004 : 0;
        part.node.position.y += (part.restY + lift - part.node.position.y) * 0.3;
      }
    }
  }

  // --- the coach's arrow ------------------------------------------------------------

  private guideArrow: TransformNode | null = null;
  private guided: Station | null = null;

  /** Point at the station the coach wants next: a bobbing arrow above it and a soft honey glow. */
  setGuideTarget(st: Station | null) {
    if (st?.id !== this.guided?.id) {
      this.glowStation(this.guided, false);
      this.guided = st;
    }
    if (!st) {
      this.guideArrow?.setEnabled(false);
      return;
    }
    if (!this.guideArrow) {
      const root = new TransformNode("guideArrow", this.scene);
      const mat = unlitMaterial(this.scene, "guideArrowMat", Color3.FromHexString("#f6c35b"));
      const head = MeshBuilder.CreateCylinder("guideArrowHead", { diameterTop: 0, diameterBottom: 0.26, height: 0.24, tessellation: 4 }, this.scene);
      head.rotation.x = Math.PI; // point down
      const shaft = MeshBuilder.CreateBox("guideArrowShaft", { width: 0.09, depth: 0.09, height: 0.2 }, this.scene);
      shaft.position.y = 0.22;
      for (const m of [head, shaft]) {
        m.material = mat;
        m.parent = root;
        m.isPickable = false;
        m.renderingGroupId = 1;
      }
      this.guideArrow = root;
    }
    const bob = Math.sin(this.time * 4) * 0.06;
    this.guideArrow.setEnabled(true);
    this.guideArrow.position.set(st.x, 1.95 + bob, st.z);
    this.guideArrow.rotation.y = this.time * 1.5;
    this.glowStation(st, true);
  }

  private glowStation(st: Station | null, on: boolean) {
    const node = st && this.stationNodes.get(st.id);
    if (!node) return;
    const pulse = 0.18 + 0.14 * (0.5 + 0.5 * Math.sin(this.time * 5));
    for (const mesh of meshesOf(node)) {
      if (on) {
        mesh.renderOverlay = true;
        mesh.overlayColor = Color3.FromHexString("#f6c35b");
        mesh.overlayAlpha = pulse;
      } else {
        // back to the normal "you're facing it" highlight, or nothing
        mesh.renderOverlay = st?.id === this.highlighted?.id;
        mesh.overlayColor = Color3.White();
        mesh.overlayAlpha = 0.22;
      }
    }
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

  /** The bar shown over a station right now, if any (for the HUD's target tag). */
  barState(stationId: number): { progress: number; color: string } | null {
    return this.bars.get(stationId)?.state ?? null;
  }

  /** @param faced in first person, the station you're facing: its bar moves into the HUD so it's not in your face */
  private syncBars(game: Game, faced: number | null) {
    for (const s of game.stations) {
      const bar = this.bars.get(s.id);
      if (!bar) continue;
      const visible = s.id !== faced;
      const food = s.item?.type === "food" ? s.item : null;
      const rule = food && FOOD_RULES[food.kind];
      if (s.kind === "board" && food && rule?.chop && food.state === "raw" && food.chop > 0) {
        bar.show(food.chop, BAR.work, visible);
      } else if (s.kind === "stove" && food && rule?.cookFrom && food.state === rule.cookFrom) {
        bar.show(food.cook / (rule.cookTime ?? 6), BAR.cook, visible);
      } else if (s.kind === "stove" && food && rule?.cookFrom && food.state === "cooked") {
        // counts down to burning; flashes red once the warning has been given
        const left = 1 - (food.cook - (rule.cookTime ?? 6)) / burnTimeFor(game, food.kind);
        this.showBurnCountdown(bar, left, food.warned, visible);
      } else if (s.fire && (s.smother ?? 0) > 0) {
        bar.show(s.smother!, BAR.work, visible);
      } else if (s.kind === "sink" && (s.wash ?? 0) > 0) {
        bar.show(s.wash!, BAR.work, visible);
      } else if (s.pot && s.pot.state === "filling" && s.pot.contents.length) {
        bar.show(s.pot.contents.length / SOUP_SIZE, BAR.work, visible);
      } else if (s.pot && s.pot.state === "cooking") {
        bar.show(s.pot.cook / SOUP_TIME, BAR.cook, visible);
      } else if (s.pot && s.pot.state === "done") {
        this.showBurnCountdown(bar, 1 - (s.pot.cook - SOUP_TIME) / SOUP_BURN, s.pot.warned, visible);
      } else {
        bar.hide();
      }
    }
  }

  /** "+35" rising from where a dish was served (a bigger tag for a bigger score). */
  floatPoints(text: string, x: number, z: number, good = true) {
    const mesh = makeTag(this.scene, `float-${this.time}`, text, good ? "#5cbf6b" : "#e4553f", "#ffffff");
    // several at once (a dish, its combo, a rave) stack instead of overlapping
    mesh.position.set(x, 1.5 - 0.17 * this.floaters.filter((f) => f.age < 0.4).length, z);
    mesh.scaling.setAll(1.3);
    this.floaters.push({ mesh, age: 0 });
  }

  private syncFloaters(dt: number) {
    for (const f of [...this.floaters]) {
      f.age += dt;
      f.mesh.position.y += dt * 0.55;
      f.mesh.visibility = Math.min(1, 2.4 - f.age * 1.6);
      if (f.age < 1.5) continue;
      f.mesh.material?.dispose(true, true);
      f.mesh.dispose();
      this.floaters.splice(this.floaters.indexOf(f), 1);
    }
  }

  /** Spilled oil: a glossy amber puddle that shrinks as it's mopped. */
  private syncPuddles(game: Game) {
    const live = new Set<number>();
    for (const spill of game.spills ?? []) {
      live.add(spill.id);
      let disc = this.puddles.get(spill.id);
      if (!disc) {
        if (!this.puddleMat) {
          this.puddleMat = new StandardMaterial("puddle", this.scene);
          this.puddleMat.diffuseColor = new Color3(0.86, 0.66, 0.2);
          this.puddleMat.specularColor = new Color3(0.9, 0.85, 0.6);
          this.puddleMat.alpha = 0.8;
        }
        disc = MeshBuilder.CreateDisc(`puddle-${spill.id}`, { radius: 0.42, tessellation: 18 }, this.scene);
        disc.rotation.x = Math.PI / 2;
        disc.position.set(spill.x, 0.012, spill.z);
        disc.scaling.y = 0.75; // a squashed, puddle-ish oval
        disc.material = this.puddleMat;
        disc.isPickable = false;
        this.puddles.set(spill.id, disc);
      }
      const left = 1 - spill.mop * 0.7;
      disc.scaling.x = left;
      disc.scaling.y = 0.75 * left;
    }
    for (const [id, disc] of this.puddles) {
      if (live.has(id)) continue;
      disc.dispose();
      this.puddles.delete(id);
    }
  }

  /** Dirty dishes waiting by the sinks: the first sink's stack fills up, then the next. */
  private syncDirty(game: Game) {
    let left = game.dishes ? game.dishes.dirtyPlates + game.dishes.dirtyBowls : 0;
    for (const stack of this.dirtyStacks.values()) {
      stack.forEach((plate, k) => plate.setEnabled(k < left));
      left = Math.max(0, left - stack.length);
    }
  }

  private showBurnCountdown(bar: ProgressBar, left: number, warned: boolean, visible: boolean) {
    const flash = warned && Math.floor(this.time * 6) % 2 === 0;
    bar.show(left, flash ? BAR.frame : Color3.Lerp(BAR.burn, BAR.safe, left), visible);
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
