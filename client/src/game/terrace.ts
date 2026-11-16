// The terrace decor you've bought, built from simple shapes around the tables (clear of the paths
// the customers walk).
import { Color3, DynamicTexture, MeshBuilder, StandardMaterial, TransformNode, type Mesh, type Scene } from "@babylonjs/core";
import type { DecorId } from "../decor";
import { tr } from "../i18n";

const FONTS = `system-ui, "Noto Sans Myanmar", "Myanmar Text", "Myanmar Sangam MN", sans-serif`;

function mat(scene: Scene, name: string, hex: string, glow = false): StandardMaterial {
  const m = new StandardMaterial(`decor-${name}`, scene);
  m.diffuseColor = Color3.FromHexString(hex);
  m.specularColor = new Color3(0.05, 0.05, 0.05);
  if (glow) m.emissiveColor = Color3.FromHexString(hex).scale(0.8);
  return m;
}

/** Builds every owned piece under one node (dispose it to take them all away). */
export function buildTerrace(scene: Scene, owned: DecorId[]): TransformNode {
  const root = new TransformNode("terrace-decor", scene);
  const put = (mesh: Mesh, material: StandardMaterial, x: number, y: number, z: number) => {
    mesh.material = material;
    mesh.parent = root;
    mesh.position.set(x, y, z);
    mesh.isPickable = false;
    return mesh;
  };
  if (owned.includes("flowers")) {
    const box = mat(scene, "box", "#a86b3c");
    const petals = ["#f6a491", "#ffd257", "#c9b3ea", "#f4f1ea"].map((c, i) => mat(scene, `petal${i}`, c));
    const leaf = mat(scene, "leaf", "#5cbf6b");
    for (const side of [-1, 1]) {
      const x = side * 2.4;
      put(MeshBuilder.CreateBox("flowerbox", { width: 1.1, height: 0.25, depth: 0.3 }, scene), box, x, 0.125, -6.2);
      for (let i = 0; i < 6; i++) {
        put(MeshBuilder.CreateSphere("leaves", { diameter: 0.2, segments: 6 }, scene), leaf, x - 0.45 + i * 0.18, 0.3, -6.2);
        put(MeshBuilder.CreateSphere("flower", { diameter: 0.12, segments: 6 }, scene), petals[(i + side + 4) % 4], x - 0.45 + i * 0.18, 0.4, -6.2 + (i % 2 ? 0.05 : -0.05));
      }
    }
  }
  if (owned.includes("palm")) {
    const pot = mat(scene, "pot", "#d9806b");
    const trunk = mat(scene, "trunk", "#8a5530");
    const fronds = mat(scene, "fronds", "#4f9a3a");
    for (const x of [-4.6, 4.6]) {
      put(MeshBuilder.CreateCylinder("palmpot", { diameterTop: 0.5, diameterBottom: 0.36, height: 0.45, tessellation: 12 }, scene), pot, x, 0.225, -6.1);
      put(MeshBuilder.CreateCylinder("trunk", { diameter: 0.1, height: 1.1, tessellation: 8 }, scene), trunk, x, 0.95, -6.1);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const frond = put(MeshBuilder.CreateSphere("frond", { diameter: 0.6, segments: 6 }, scene), fronds, x + Math.sin(a) * 0.28, 1.5, -6.1 + Math.cos(a) * 0.28);
        frond.scaling.set(1, 0.25, 0.45);
        frond.rotation.y = a;
      }
    }
  }
  if (owned.includes("lanterns")) {
    const colors = ["#f6a491", "#ffd257", "#c9b3ea", "#9fc8ef"];
    const tables: [number, number][] = [
      [-1.15, -4.8],
      [3.4, -4.8],
      [-3.4, -4.3],
      [1.15, -4.3],
    ];
    tables.forEach(([x, z], i) => {
      const lantern = put(MeshBuilder.CreateSphere("lantern", { diameter: 0.34, segments: 10 }, scene), mat(scene, `lantern${i}`, colors[i], true), x, 2.25, z);
      lantern.scaling.y = 1.25;
    });
  }
  if (owned.includes("sign")) {
    const wood = mat(scene, "signwood", "#8a5530");
    const board = new StandardMaterial("decor-chalk", scene);
    const tex = new DynamicTexture("decor-chalk-tex", { width: 256, height: 320 }, scene, true);
    const ctx = tex.getContext() as CanvasRenderingContext2D;
    ctx.fillStyle = "#2f3a33";
    ctx.fillRect(0, 0, 256, 320);
    ctx.fillStyle = "#fffaf0";
    ctx.textAlign = "center";
    ctx.font = `bold 64px ${FONTS}`;
    ctx.fillText(tr("Open!"), 128, 130);
    ctx.font = `bold 34px ${FONTS}`;
    ctx.fillStyle = "#ffd257";
    ctx.fillText(tr("Today's"), 128, 210);
    ctx.fillText(tr("special ★"), 128, 254);
    tex.update();
    board.diffuseTexture = tex;
    board.emissiveColor = new Color3(0.35, 0.35, 0.35);
    board.backFaceCulling = false;
    for (const [legX, tilt] of [[-0.3, 0.25], [0.3, -0.25]] as const) {
      const leg = put(MeshBuilder.CreateBox("signleg", { width: 0.05, height: 1.0, depth: 0.05 }, scene), wood, 1.05 + legX, 0.48, -6.25);
      leg.rotation.z = tilt * 0.4;
    }
    const face = put(MeshBuilder.CreatePlane("signface", { width: 0.55, height: 0.7 }, scene), board, 1.05, 0.62, -6.3);
    face.rotation.x = -0.15; // leaning back, towards the steps the customers come up
  }
  return root;
}
