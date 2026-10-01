// Триъгълници, анимации и големина на всеки модел: node tools/stats.mjs [филтър]
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import fs from 'fs';
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const filt = process.argv[2] || '';
for (const f of fs.readdirSync('public/models').filter((f) => f.endsWith('.glb') && f.includes(filt)).sort()) {
  const doc = await io.read('public/models/' + f);
  let tris = 0;
  for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) {
    const idx = p.getIndices(); const pos = p.getAttribute('POSITION');
    tris += (idx ? idx.getCount() : pos.getCount()) / 3;
  }
  const anims = doc.getRoot().listAnimations().map((a) => a.getName());
  const mats = doc.getRoot().listMaterials().map((m) => m.getName()).join(',');
  console.log(f.padEnd(24), String(Math.round(tris)).padStart(6), 'tri', (fs.statSync('public/models/' + f).size / 1024).toFixed(0).padStart(5) + 'KB', anims.length ? 'anim:' + anims.join('|') : '', '| ' + mats.slice(0, 90));
}
