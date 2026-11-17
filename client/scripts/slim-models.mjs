// Lighten kitchen models: weld, then simplify within a small error bound. Writes to an output
// folder (same tree); only models that shrink by a quarter or more are written.
//
//   npm i --no-save @gltf-transform/core @gltf-transform/functions @gltf-transform/extensions meshoptimizer
//   node client/scripts/slim-models.mjs assets/kitchen /tmp/slim 0.004
//
// Then copy the results over assets/kitchen, EXCEPT stations/: their flat steel tops come out
// blotchy. Characters (skinned) and anything under 1,200 triangles are left alone.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { weld, simplify, prune, dedup } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import fs from 'node:fs'; import path from 'node:path';
await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const [root, out, errArg] = process.argv.slice(2);
const error = Number(errArg ?? 0.004);
const tris = (doc) => { let t = 0; for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) { const i = p.getIndices(); t += (i ? i.getCount() : p.getAttribute('POSITION').getCount()) / 3; } return Math.round(t); };
const files = fs.readdirSync(root, { recursive: true }).filter(f => f.endsWith('.glb'));
let before = 0, after = 0;
for (const f of files) {
  const doc = await io.read(path.join(root, f));
  const b = tris(doc);
  if (doc.getRoot().listSkins().length || b < 1200) { before += b; after += b; continue; }
  await doc.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio: 0.3, error }), prune({ keepLeaves: true, keepAttributes: true }));
  const a = tris(doc);
  before += b;
  if (a <= b * 0.75) {
    after += a;
    const dest = path.join(out, f); fs.mkdirSync(path.dirname(dest), { recursive: true });
    await io.write(dest, doc);
    console.log(`${f}  ${b} -> ${a}`);
  } else after += b;
}
console.log('total', before, '->', after);
