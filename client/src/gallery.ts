import {
  ArcRotateCamera,
  Color3,
  Color4,
  DirectionalLight,
  Engine,
  HemisphericLight,
  MeshBuilder,
  PointerEventTypes,
  Scalar,
  Scene,
  ShadowGenerator,
  StandardMaterial,
  Vector3,
  type AbstractMesh,
  type Node,
} from "@babylonjs/core";
import { ASSET_ENTRIES, CATEGORY_LABELS, CATEGORY_ORDER, loadAsset, type AssetEntry } from "./assets";

const canvas = document.getElementById("scene") as HTMLCanvasElement;
const statusEl = document.getElementById("status") as HTMLParagraphElement;
const listEl = document.getElementById("asset-list") as HTMLElement;
const resetButton = document.getElementById("reset-view") as HTMLButtonElement;

const engine = new Engine(canvas, true, { stencil: true });
const scene = new Scene(engine);
scene.clearColor = new Color4(0.11, 0.125, 0.14, 1);

// --- camera -----------------------------------------------------------------

const HOME = { target: new Vector3(0, 0.4, 0.3), radius: 7.5, alpha: -Math.PI / 2, beta: 1.0 };

const camera = new ArcRotateCamera("camera", HOME.alpha, HOME.beta, HOME.radius, HOME.target.clone(), scene);
camera.attachControl(canvas, true);
camera.minZ = 0.01;
camera.lowerRadiusLimit = 0.25;
camera.upperRadiusLimit = 20;
camera.upperBetaLimit = Math.PI / 2 - 0.05;
camera.wheelDeltaPercentage = 0.02;
camera.panningSensibility = 400;

// Smoothly glide the camera to a focus point; any manual input cancels it.
let focus: { target: Vector3; radius: number } | null = null;
scene.onBeforeRenderObservable.add(() => {
  if (!focus) return;
  const t = Math.min(1, (engine.getDeltaTime() / 1000) * 6);
  camera.target = Vector3.Lerp(camera.target, focus.target, t);
  camera.radius = Scalar.Lerp(camera.radius, focus.radius, t);
  if (Vector3.Distance(camera.target, focus.target) < 0.001 && Math.abs(camera.radius - focus.radius) < 0.001) {
    focus = null;
  }
});
canvas.addEventListener("pointerdown", () => (focus = null));
canvas.addEventListener("wheel", () => (focus = null), { passive: true });

// --- lighting and floor -----------------------------------------------------

new HemisphericLight("sky", new Vector3(0, 1, 0), scene).intensity = 0.55;
const sun = new DirectionalLight("sun", new Vector3(-0.4, -1, 0.5), scene);
sun.position = new Vector3(4, 10, -6);
sun.intensity = 1.2;
const shadows = new ShadowGenerator(2048, sun);
shadows.usePercentageCloserFiltering = true;

const floor = MeshBuilder.CreateGround("floor", { width: 14, height: 9 }, scene);
const floorMat = new StandardMaterial("floorMat", scene);
floorMat.diffuseColor = Color3.FromHexString("#8c8070");
floorMat.specularColor = Color3.Black();
floor.material = floorMat;
floor.receiveShadows = true;

// --- gallery layout ---------------------------------------------------------

// One row per category; +Z is "back" from the default camera.
const ROW_Z: Record<string, number> = { stations: 1.8, tools: 0.7, ingredients: -0.1, ingredient_states: -0.9 };
const ROW_GAP: Record<string, number> = { stations: 0.08, tools: 0.18, ingredients: 0.15, ingredient_states: 0.12 };

interface LoadedAsset {
  entry: AssetEntry;
  root: AbstractMesh;
  button?: HTMLButtonElement;
}
const loaded: LoadedAsset[] = [];
const byRoot = new Map<Node, LoadedAsset>();

function layoutRow(category: string, items: LoadedAsset[]) {
  const gap = ROW_GAP[category] ?? 0.15;
  const z = ROW_Z[category] ?? -1.7;
  let cursor = 0;
  for (const { root } of items) {
    const { min, max } = root.getHierarchyBoundingVectors(true);
    root.position.x += cursor - min.x;
    root.position.z += z - (min.z + max.z) / 2;
    root.position.y -= min.y; // sit on the floor
    cursor += max.x - min.x + gap;
  }
  const shift = -(cursor - gap) / 2;
  for (const { root } of items) root.position.x += shift;
}

function focusOn(asset: LoadedAsset) {
  const { min, max } = asset.root.getHierarchyBoundingVectors(true);
  const size = Math.max(max.x - min.x, max.y - min.y, max.z - min.z);
  focus = { target: Vector3.Center(min, max), radius: Math.max(0.35, size * 2.4) };
  announce(asset);
}

function announce(asset: LoadedAsset) {
  statusEl.textContent = `${asset.entry.name.replace(/_/g, " ")} — ${CATEGORY_LABELS[asset.entry.category] ?? asset.entry.category}`;
  for (const other of loaded) other.button?.setAttribute("aria-pressed", String(other === asset));
}

function buildList() {
  const categories = [...CATEGORY_ORDER, ...new Set(loaded.map((a) => a.entry.category))].filter(
    (c, i, all) => all.indexOf(c) === i && loaded.some((a) => a.entry.category === c),
  );
  for (const category of categories) {
    const section = document.createElement("section");
    const heading = document.createElement("h2");
    heading.textContent = CATEGORY_LABELS[category] ?? category;
    const list = document.createElement("ul");
    for (const asset of loaded.filter((a) => a.entry.category === category)) {
      const li = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = asset.entry.name.replace(/_/g, " ");
      button.setAttribute("aria-pressed", "false");
      button.addEventListener("click", () => focusOn(asset));
      asset.button = button;
      li.append(button);
      list.append(li);
    }
    section.append(heading, list);
    listEl.append(section);
  }
}

async function buildGallery() {
  const results = await Promise.allSettled(
    ASSET_ENTRIES.map(async (entry) => ({ entry, root: await loadAsset(entry, scene) })),
  );
  const failed: string[] = [];
  results.forEach((result, i) => {
    if (result.status === "fulfilled") loaded.push(result.value);
    else {
      failed.push(ASSET_ENTRIES[i].name);
      console.error(`Failed to load ${ASSET_ENTRIES[i].url}`, result.reason);
    }
  });

  for (const asset of loaded) {
    byRoot.set(asset.root, asset);
    for (const mesh of asset.root.getChildMeshes()) {
      shadows.addShadowCaster(mesh);
      mesh.receiveShadows = true;
    }
  }
  for (const category of new Set(loaded.map((a) => a.entry.category))) {
    layoutRow(category, loaded.filter((a) => a.entry.category === category));
  }
  buildList();

  statusEl.textContent =
    `${loaded.length} assets loaded. Drag to orbit, scroll to zoom, right-drag to pan.` +
    (failed.length ? ` Failed: ${failed.join(", ")}.` : "");
}

// Clicking an object in the scene names it in the panel.
scene.onPointerObservable.add((info) => {
  if (info.type !== PointerEventTypes.POINTERPICK) return;
  let node: Node | null = info.pickInfo?.pickedMesh ?? null;
  while (node && !byRoot.has(node)) node = node.parent;
  if (node) announce(byRoot.get(node)!);
});

resetButton.addEventListener("click", () => {
  camera.alpha = HOME.alpha;
  camera.beta = HOME.beta;
  focus = { target: HOME.target.clone(), radius: HOME.radius };
  for (const asset of loaded) asset.button?.setAttribute("aria-pressed", "false");
});

if (import.meta.env.DEV) Object.assign(window, { scene }); // handy for console debugging

engine.runRenderLoop(() => scene.render());
window.addEventListener("resize", () => engine.resize());

buildGallery().catch((error) => {
  statusEl.textContent = "Could not load the kitchen assets. See the console for details.";
  console.error(error);
});
