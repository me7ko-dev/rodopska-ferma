import * as THREE from 'three';
import { Kit, M, kitMeshes } from '../engine/kit';
import { registerModel } from '../engine/assets';
import { itemModel } from './items3d';

// Сгради, направени с код (за неща, за които няма готов модел): рибарница, рудник, топилня, филигранна работилница, кей.
// Напред е +Z, земята е y = 0, размерите са в метри.

const W = { log: '#8a5a32', logDark: '#6e4626', plank: '#a8743e', roof: '#5a3a26', roofDark: '#4a2e1c', stone: '#9a948a', stoneDark: '#7a746a', door: '#5a3a22', glass: '#2a3a48', rope: '#c9a46b' };

/** Стена от хоризонтални трупи (по ос X), центрирана. */
function logWall(k: Kit, w: number, h: number, x: number, z: number, alongZ = false) {
  const r = 0.16;
  const n = Math.round(h / (r * 1.9));
  for (let i = 0; i < n; i++) {
    const y = 0.45 + r + i * r * 1.9;
    const col = i % 2 ? W.log : W.logDark;
    if (alongZ) k.cyl('trim', r, w + 0.3, col, M.at(x, y, z, Math.PI / 2, 0, 0), 8);
    else k.cyl('trim', r, w + 0.3, col, M.at(x, y, z, 0, 0, Math.PI / 2), 8);
  }
}

/** Двускатен покрив по ос X (билото е по X). */
function gableRoof(k: Kit, w: number, d: number, y: number, rise: number, color: string, over = 0.35) {
  const half = d / 2 + over;
  const len = Math.hypot(half, rise);
  const ang = Math.atan2(rise, half);
  for (const s of [-1, 1]) {
    k.box('trim', w + over * 2, 0.14, len, color, 0, y + rise / 2, s * half / 2, 0.02, [s * ang, 0, 0]);
    // редове керемиди/дъски
    for (let i = 1; i < 5; i++) {
      const t = i / 5;
      k.box('trim', w + over * 2 + 0.02, 0.05, 0.06, W.roofDark, 0, y + rise * (1 - t) + 0.09, s * half * t, 0, [s * ang, 0, 0]);
    }
  }
  k.box('trim', w + over * 2 + 0.1, 0.16, 0.2, W.roofDark, 0, y + rise + 0.04, 0);
  // фронтони (триъгълници отпред и отзад)
  const tri = new THREE.Shape([new THREE.Vector2(-d / 2, 0), new THREE.Vector2(d / 2, 0), new THREE.Vector2(0, rise)]);
  const tg = new THREE.ExtrudeGeometry(tri, { depth: 0.12, bevelEnabled: false });
  for (const sx of [-1, 1]) k.add('trim', tg.clone(), W.plank, M.at(sx * (w / 2) - (sx > 0 ? 0.12 : 0), y, 0, 0, Math.PI / 2, 0));
}

function smokehouse() {
  const g = new THREE.Group();
  const k = new Kit();
  // каменна основа
  k.box('trim', 5.0, 0.45, 4.2, W.stone, 0, 0.22, 0, 0.06);
  // стени от трупи
  const w = 4.4, d = 3.6, h = 2.5;
  logWall(k, w, h, 0, d / 2 - 0.16);
  logWall(k, w, h, 0, -d / 2 + 0.16);
  logWall(k, d, h, w / 2 - 0.16, 0, true);
  logWall(k, d, h, -w / 2 + 0.16, 0, true);
  // врата и прозорец отпред
  k.box('trim', 1.1, 1.9, 0.12, W.door, -0.8, 1.4, d / 2 + 0.05);
  k.box('trim', 1.3, 0.12, 0.16, W.logDark, -0.8, 2.4, d / 2 + 0.06);
  k.box('glass', 0.8, 0.7, 0.08, W.glass, 1.1, 1.75, d / 2 + 0.06);
  k.box('trim', 1.0, 0.1, 0.14, W.logDark, 1.1, 1.35, d / 2 + 0.08);
  k.box('trim', 0.08, 0.8, 0.12, W.logDark, 1.1, 1.75, d / 2 + 0.09);
  gableRoof(k, w, d, 0.45 + h, 1.5, W.roof);
  // каменен комин отзад вдясно
  k.box('trim', 0.8, 4.4, 0.8, W.stoneDark, 1.4, 2.6, -1.0, 0.04);
  k.box('trim', 0.95, 0.2, 0.95, W.stone, 1.4, 4.85, -1.0);
  // сушилня за риба вдясно
  for (const z of [-1.2, 1.2]) k.box('trim', 0.12, 2.2, 0.12, W.logDark, 3.3, 1.1, z);
  k.box('trim', 0.1, 0.1, 2.6, W.log, 3.3, 2.1, 0);
  // бъчва и лодка отпред вляво
  k.cyl('trim', 0.4, 0.9, '#8a5a30', M.at(-2.9, 0.45, 1.9), 14, 0.36);
  for (const y of [0.2, 0.7]) k.cyl('trim', 0.42, 0.06, '#3a3a3a', M.at(-2.9, y, 1.9), 14);
  const hull = new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
  // обърната лодка на брега
  k.add('trim', hull, '#3a6a8a', M.at(1.0, 0.02, 2.9, 0, 0.15, Math.PI, 1.7, 0.45, 0.6));
  k.box('trim', 3.3, 0.07, 0.1, '#d8d0b8', 1.0, 0.47, 2.9, 0, [0, 0.15, 0]);
  g.add(kitMeshes(k));
  // окачени риби
  const ids = ['f_carp', 'f_perch', 'f_crucian', 'f_carp'];
  ids.forEach((id, i) => {
    const f = itemModel(id);
    f.scale.setScalar(0.75);
    f.rotation.set(0, Math.PI / 2, -Math.PI / 2);
    f.position.set(3.3, 1.55, -0.9 + i * 0.6);
    g.add(f);
  });
  g.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

registerModel('pb_smokehouse', smokehouse);

/** Дървен кей с колчета (за риболова). Дължина по +Z. */
export function pier(len = 5.5) {
  const k = new Kit();
  const w = 1.8;
  for (let i = 0; i < Math.round(len / 0.32); i++) k.box('trim', w, 0.08, 0.28, i % 2 ? '#a8743e' : '#9a6a36', 0, 0.42, -0.2 + i * 0.32);
  for (const s of [-1, 1]) {
    k.box('trim', 0.1, 0.12, len, '#6e4626', s * (w / 2 - 0.1), 0.34, len / 2 - 0.2);
    for (let z = 0; z <= len; z += len / 3) k.cyl('trim', 0.1, 1.2, '#5a3a22', M.at(s * (w / 2), 0.1, z), 8);
  }
  const g = kitMeshes(k);
  return g;
}
