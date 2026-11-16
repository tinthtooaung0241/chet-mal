import {
  LoadAssetContainerAsync,
  Mesh,
  PBRMaterial,
  TransformNode,
  type AbstractMesh,
  type AssetContainer,
  type Scene,
} from "@babylonjs/core";
import "@babylonjs/loaders/glTF";

// Every GLB exported from Blender into assets/kitchen/<category>/ is picked up automatically.
const files = import.meta.glob("../../assets/kitchen/**/*.glb", {
  query: "?url",
  import: "default",
  eager: true,
}) as Record<string, string>;

export const CATEGORY_ORDER = ["stations", "tools", "ingredients", "ingredient_states"] as const;

export const CATEGORY_LABELS: Record<string, string> = {
  stations: "Stations",
  tools: "Tools",
  ingredients: "Ingredients",
  ingredient_states: "Chopped / cooked / burnt",
};

export interface AssetEntry {
  name: string;
  category: string;
  url: string;
}

export const ASSET_ENTRIES: AssetEntry[] = Object.entries(files)
  .map(([path, url]) => {
    const match = path.match(/kitchen\/([^/]+)\/([^/]+)\.glb$/);
    if (!match) throw new Error(`Unexpected asset path: ${path}`);
    return { category: match[1], name: match[2], url };
  })
  .sort((a, b) => a.name.localeCompare(b.name));

async function loadContainer(entry: AssetEntry, scene: Scene): Promise<AssetContainer> {
  const container = await LoadAssetContainerAsync(entry.url, scene, { pluginExtension: ".glb" });
  for (const material of container.materials) {
    // There is no environment map yet, so fully metallic surfaces would render black.
    // Keep the flat low-poly look readable until we add one.
    if (material instanceof PBRMaterial) {
      material.metallic = Math.min(material.metallic ?? 0, 0.2);
    }
  }
  return container;
}

/**
 * Loads every kitchen GLB once and hands out copies. A spawned node faces +Z at rotation 0
 * (Blender's front, -Y, arrives as +Z), matching the game's yaw convention.
 */
export class AssetLibrary {
  private constructor(
    private readonly scene: Scene,
    private readonly containers: Map<string, AssetContainer>,
  ) {}

  /**
   * @param later models to leave out for now (another restaurant's room): `ensure` fetches them
   * @param progress told as each model arrives (for the loading screen)
   */
  static async load(scene: Scene, later: string[] = [], progress?: (done: number, total: number) => void): Promise<AssetLibrary> {
    const now = ASSET_ENTRIES.filter((e) => !later.includes(e.name));
    let done = 0;
    const loaded = await Promise.all(
      now.map(async (entry) => {
        const container = await loadContainer(entry, scene);
        progress?.(++done, now.length);
        return [entry.name, container] as const;
      }),
    );
    return new AssetLibrary(scene, new Map(loaded));
  }

  private readonly pending = new Map<string, Promise<void>>();

  /** Load a model left out at the start (once; later calls share the same download). */
  ensure(name: string): Promise<void> {
    if (this.containers.has(name)) return Promise.resolve();
    const entry = ASSET_ENTRIES.find((e) => e.name === name);
    if (!entry) return Promise.resolve();
    let job = this.pending.get(name);
    if (!job) {
      job = loadContainer(entry, this.scene).then((c) => {
        this.containers.set(name, c);
        this.pending.delete(name);
      });
      this.pending.set(name, job);
    }
    return job;
  }

  has(name: string): boolean {
    return this.containers.has(name);
  }

  /** A model that exists but hasn't been loaded yet. */
  waiting(name: string): boolean {
    return !this.containers.has(name) && ASSET_ENTRIES.some((e) => e.name === name);
  }

  spawn(name: string): TransformNode {
    const container = this.containers.get(name);
    if (!container) throw new Error(`No asset named ${name}`);
    // Real mesh copies (not instances) so each copy can be tinted or highlighted on its own.
    const entries = container.instantiateModelsToScene((source) => `${name}/${source}`, false, {
      doNotInstantiate: true,
    });
    const holder = new TransformNode(name, this.scene);
    for (const root of entries.rootNodes) root.parent = holder;
    return holder;
  }
}

export async function loadAsset(entry: AssetEntry, scene: Scene): Promise<AbstractMesh> {
  const container = await loadContainer(entry, scene);
  container.addAllToScene();
  // Blender's front (-Y) arrives facing +Z; turn it so fronts face the default camera (-Z).
  const holder = new Mesh(entry.name, scene);
  container.meshes[0].parent = holder; // the glTF "__root__" node
  holder.rotation.y = Math.PI;
  return holder;
}
