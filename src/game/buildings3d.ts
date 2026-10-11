import * as THREE from 'three';
import { Kit, M, kitMeshes } from '../engine/kit';
import { registerModel, instance } from '../engine/assets';
import { signTexture } from '../world/railway';
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

const glowMat = new THREE.MeshStandardMaterial({ color: '#ffb347', emissive: '#ff7a1a', emissiveIntensity: 2.2, roughness: 0.5 });
glowMat.userData.noSnow = true;

/** Топилня: каменна пещ с жарава, комин, мех, наковалня и купчина руда под навес. */
function smelter() {
  const g = new THREE.Group();
  const k = new Kit();
  k.box('trim', 5.4, 0.3, 4.6, W.stoneDark, 0, 0.15, 0, 0.05);
  // пещта — каменна кула (осмоъгълна, стеснява се нагоре)
  k.add('trim', new THREE.CylinderGeometry(1.15, 1.55, 3.0, 8), W.stone, M.at(-0.9, 1.8, -0.4));
  for (let i = 0; i < 5; i++) k.add('trim', new THREE.CylinderGeometry(1.57 - i * 0.08, 1.57 - i * 0.08, 0.08, 8), W.stoneDark, M.at(-0.9, 0.6 + i * 0.6, -0.4));
  k.cyl('trim', 0.42, 2.6, W.stoneDark, M.at(-0.9, 4.5, -0.4), 8, 0.5);
  k.cyl('trim', 0.5, 0.18, '#3a3a3a', M.at(-0.9, 5.8, -0.4), 8);
  // мех
  k.box('trim', 0.9, 0.35, 1.2, '#6e4626', 0.6, 0.85, -0.6, 0.05, [0, 0, 0.25]);
  k.cyl('trim', 0.08, 0.8, '#3a3a3a', M.at(0.1, 0.85, -0.5, 0, 0, Math.PI / 2), 8);
  // наковалня на пън
  k.cyl('trim', 0.35, 0.6, W.log, M.at(1.4, 0.6, 1.2), 10);
  k.box('trim', 0.8, 0.25, 0.35, '#3a3d40', 1.4, 1.02, 1.2, 0.03);
  k.box('trim', 0.4, 0.15, 0.25, '#3a3d40', 1.85, 1.05, 1.2, 0.03);
  // навес на стълбове
  for (const [x, z] of [[-2.5, -2.1], [2.5, -2.1], [-2.5, 2.1], [2.5, 2.1]]) k.box('trim', 0.2, 2.9, 0.2, W.logDark, x, 1.6, z);
  k.box('trim', 5.6, 0.12, 4.9, W.roof, 0.0, 3.15, 0, 0.02, [0.12, 0, 0]);
  // купчини руда
  for (let i = 0; i < 9; i++) k.add('trim', new THREE.IcosahedronGeometry(0.22 + (i % 3) * 0.06, 0), i % 2 ? '#6b6e74' : '#8a7a5a', M.at(1.6 + (i % 3) * 0.32, 0.4 + Math.floor(i / 3) * 0.12, -1.3 + Math.floor(i / 3) * 0.3));
  // кюлчета на рафт
  k.box('trim', 1.4, 0.08, 0.5, W.plank, 1.4, 1.3, -1.9);
  for (let i = 0; i < 4; i++) k.box(i < 2 ? 'chrome' : 'gold', 0.28, 0.12, 0.16, i < 2 ? '#d8dce0' : '#ffcc3a', 0.95 + i * 0.3, 1.41, -1.9, 0.02);
  g.add(kitMeshes(k));
  // жаравата в отвора на пещта
  const fire = new THREE.Mesh(new THREE.CircleGeometry(0.42, 16), glowMat);
  fire.position.set(-0.9, 1.15, 1.13);
  fire.rotation.x = -0.3;
  g.add(fire);
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.9, 0.3), new THREE.MeshStandardMaterial({ color: '#1a1410', roughness: 1 }));
  mouth.position.set(-0.9, 1.15, 1.0);
  g.add(mouth);
  g.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}
registerModel('pb_smelter', smelter);

/** Филигранна работилница: бяла родопска къща с кафяв чардак, витрина и табела. */
function jeweler() {
  const g = new THREE.Group();
  const k = new Kit();
  const w = 4.6, d = 3.8;
  k.box('trim', w + 0.4, 0.4, d + 0.4, W.stone, 0, 0.2, 0, 0.05);
  // каменен приземен етаж и бял горен етаж с издаден чардак
  k.box('trim', w, 2.0, d, '#b5ab9a', 0, 1.4, 0, 0.04);
  k.box('trim', w + 0.6, 1.9, d + 0.5, '#f4efe4', 0, 3.35, 0.25, 0.04);
  for (let i = 0; i < 6; i++) k.box('trim', 0.1, 1.9, 0.08, W.logDark, -w / 2 - 0.25 + i * ((w + 0.5) / 5), 3.35, d / 2 + 0.52);
  k.box('trim', w + 0.7, 0.14, 0.14, W.logDark, 0, 2.45, d / 2 + 0.52);
  k.box('trim', w + 0.7, 0.14, 0.14, W.logDark, 0, 4.25, d / 2 + 0.52);
  // покрив от каменни плочи (тикли)
  const roof = new THREE.ConeGeometry(1, 1, 4, 1);
  roof.rotateY(Math.PI / 4);
  k.add('trim', roof, '#6f6a62', M.at(0, 5.05, 0.25, 0, 0, 0, (w + 1.6) * 0.72, 1.7, (d + 1.6) * 0.72));
  k.box('trim', 0.5, 1.3, 0.5, '#f4efe4', 1.2, 5.6, -0.6, 0.03);
  // врата, витрина с бижута, прозорци горе
  k.box('trim', 1.0, 1.8, 0.1, W.door, -1.2, 1.3, d / 2 + 0.03);
  k.box('glass', 1.7, 1.1, 0.08, '#9fc4d8', 0.9, 1.55, d / 2 + 0.04);
  k.box('trim', 1.9, 0.12, 0.25, W.logDark, 0.9, 0.95, d / 2 + 0.1);
  for (let i = 0; i < 3; i++) k.box('chrome', 0.2, 0.2, 0.06, '#e0e4e8', 0.4 + i * 0.5, 1.15, d / 2 + 0.16, 0.02);
  for (const x of [-1.4, 0, 1.4]) k.box('glass', 0.7, 0.8, 0.08, W.glass, x, 3.45, d / 2 + 0.56);
  g.add(kitMeshes(k));
  // табела с пръстен
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.55), new THREE.MeshStandardMaterial({ map: signTexture('ФИЛИГРАН', '#3a2a5a', '#ffe9b0', 512, 108), roughness: 0.6 }));
  sign.position.set(0, 2.2, d / 2 + 0.07);
  g.add(sign);
  g.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}
registerModel('pb_jeweler', jeweler);

/** Входът на рудника: скали, дървена рамка, тъмен тунел, релси с вагонетка, фенери и табела. Гледа към +X. */
export function mineEntrance() {
  const g = new THREE.Group();
  // скалите (хълмче)
  const rocks: [string, number, number, number, number][] = [['n_rock1', 15, -6, 0, 0.4], ['n_rock3', 11, -4, -6, 2.1], ['n_rock2', 10, -4.5, 6, 4.0], ['n_rock1', 7, -1, -8.5, 1.2], ['n_rock3', 6, -1.5, 8, 3.1]];
  for (const [n, s, x, z, r] of rocks) {
    const o = instance(n, s);
    o.position.set(x, -0.6, z);
    o.rotation.y = r;
    g.add(o);
  }
  const k = new Kit();
  // дървена рамка на входа
  for (const z of [-1.6, 1.6]) k.box('trim', 0.45, 3.4, 0.45, W.logDark, 0.6, 1.7, z, 0.04);
  k.box('trim', 0.55, 0.5, 4.2, W.log, 0.6, 3.5, 0, 0.04);
  for (const z of [-1.0, 1.0]) k.box('trim', 0.3, 0.3, 1.0, W.logDark, 0.6, 3.05, z * 1.15, 0.02, [z * 0.6, 0, 0]);
  // тъмнината вътре
  k.box('trim', 2.5, 3.0, 3.0, '#0a0806', -1.0, 1.5, 0);
  // релси и траверси навън
  for (let x = -0.5; x < 7; x += 0.7) k.box('trim', 0.22, 0.1, 1.5, '#5b4632', x, 0.05, 0);
  for (const z of [-0.45, 0.45]) k.box('chrome', 7.6, 0.08, 0.07, '#9a9ca0', 3.2, 0.13, z);
  // табела
  for (const z of [3.2, 5.2]) k.box('trim', 0.15, 2.2, 0.15, W.logDark, 2.0, 1.1, z);
  g.add(kitMeshes(k));
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.6), new THREE.MeshStandardMaterial({ map: signTexture('РУДНИК', '#3a2a1a', '#ffe9b0', 512, 128), roughness: 0.6 }));
  sign.position.set(2.1, 1.9, 4.2);
  sign.rotation.y = Math.PI / 2;
  g.add(sign);
  // фенери до входа
  const lampMat = new THREE.MeshStandardMaterial({ color: '#fff2c4', emissive: '#ffb347', emissiveIntensity: 1.5 });
  lampMat.userData.noSnow = true;
  for (const z of [-2.0, 2.0]) {
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.35, 0.25), lampMat);
    l.position.set(0.95, 2.7, z);
    g.add(l);
  }
  // вагонетка с руда
  const cart = new THREE.Group();
  const ck = new Kit();
  ck.box('trim', 1.6, 0.7, 1.1, '#6a6e74', 0, 0.75, 0, 0.05);
  ck.box('trim', 1.4, 0.1, 0.9, '#3a3a3a', 0, 1.08, 0);
  for (let i = 0; i < 7; i++) ck.add('trim', new THREE.IcosahedronGeometry(0.2, 0), i % 3 ? '#7a6a4a' : '#c8b8e8', M.at(-0.5 + (i % 4) * 0.33, 1.15 + (i % 2) * 0.08, -0.2 + Math.floor(i / 4) * 0.4));
  for (const x of [-0.5, 0.5]) for (const z of [-0.45, 0.45]) ck.cyl('trim', 0.2, 0.08, '#2a2a2a', M.at(x, 0.22, z, Math.PI / 2, 0, 0), 12);
  cart.add(kitMeshes(ck));
  cart.position.set(4.5, 0.05, 0);
  cart.rotation.y = Math.PI / 2;
  cart.name = 'cart';
  g.add(cart);
  g.traverse((o) => { if ((o as THREE.Mesh).isMesh && o.parent !== g) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

// ---------- сезонна украса ----------
function snowman() {
  const g = new THREE.Group();
  const k = new Kit();
  const snow = '#f4f8ff';
  k.add('trim', new THREE.SphereGeometry(0.75, 20, 14), snow, M.at(0, 0.7, 0));
  k.add('trim', new THREE.SphereGeometry(0.55, 20, 14), snow, M.at(0, 1.65, 0));
  k.add('trim', new THREE.SphereGeometry(0.4, 20, 14), snow, M.at(0, 2.35, 0));
  for (const y of [1.45, 1.7, 1.95]) k.add('trim', new THREE.SphereGeometry(0.06, 8, 6), '#1a1a1a', M.at(0, y, 0.52));
  for (const x of [-0.14, 0.14]) k.add('trim', new THREE.SphereGeometry(0.05, 8, 6), '#1a1a1a', M.at(x, 2.45, 0.35));
  k.add('trim', new THREE.ConeGeometry(0.07, 0.45, 10), '#f07a1a', M.at(0, 2.35, 0.55, Math.PI / 2, 0, 0));
  for (let i = 0; i < 5; i++) { const a = (i / 4 - 0.5) * 1.6; k.add('trim', new THREE.SphereGeometry(0.03, 6, 4), '#1a1a1a', M.at(Math.sin(a) * 0.2, 2.2 - Math.cos(a) * 0.06, 0.36)); }
  // шал и шапка
  k.add('trim', new THREE.TorusGeometry(0.42, 0.09, 8, 20), '#d8283a', M.at(0, 2.05, 0, Math.PI / 2, 0, 0));
  k.box('trim', 0.2, 0.55, 0.1, '#d8283a', 0.25, 1.8, 0.38, 0.03, [0, 0, 0.2]);
  k.cyl('trim', 0.42, 0.06, '#222', M.at(0, 2.68, 0), 20);
  k.cyl('trim', 0.28, 0.42, '#222', M.at(0, 2.9, 0), 20);
  k.cyl('trim', 0.285, 0.08, '#d8283a', M.at(0, 2.75, 0), 20);
  // ръце от клонки
  for (const s of [-1, 1]) k.cyl('trim', 0.035, 0.9, '#6b4a2a', M.at(s * 0.8, 1.85, 0, 0, 0, s * 1.05), 6);
  g.add(kitMeshes(k));
  g.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}
registerModel('pb_snowman', snowman);

function pumpkins() {
  const g = new THREE.Group();
  const k = new Kit();
  k.box('trim', 1.6, 0.9, 1.0, '#e2c060', -0.3, 0.45, -0.2, 0.12);
  for (let i = 0; i < 6; i++) k.box('trim', 1.62, 0.04, 1.02, '#c9a440', -0.3, 0.15 + i * 0.13, -0.2);
  const pump = (x: number, z: number, s: number, c: string) => {
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; k.add('trim', new THREE.SphereGeometry(0.22 * s, 12, 10), c, M.at(x + Math.cos(a) * 0.17 * s, 0.25 * s, z + Math.sin(a) * 0.17 * s, 0, 0, 0, 1, 1.1, 1)); }
    k.cyl('trim', 0.04 * s, 0.18 * s, '#5a7a2a', M.at(x, 0.52 * s, z), 6);
  };
  pump(0.9, 0.4, 1.4, '#f08a1e');
  pump(0.4, 0.75, 1.0, '#e8761a');
  pump(-0.6, 0.6, 1.1, '#f0a03a');
  pump(-0.3, -0.1, 0.9, '#f08a1e');
  // сноп царевица
  for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; k.cyl('trim', 0.04, 2.0, '#c8b060', M.at(1.0 + Math.cos(a) * 0.15, 1.0, -0.5 + Math.sin(a) * 0.15, Math.sin(a) * 0.15, 0, Math.cos(a) * 0.15), 5); }
  k.cyl('trim', 0.2, 0.12, '#8a5a2a', M.at(1.0, 0.9, -0.5), 10);
  g.add(kitMeshes(k));
  g.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}
registerModel('pb_pumpkins', pumpkins);

function tulips() {
  const g = new THREE.Group();
  const k = new Kit();
  k.box('trim', 2.8, 0.35, 1.6, '#8a5a32', 0, 0.17, 0, 0.04);
  k.box('trim', 2.6, 0.06, 1.4, '#5a3a22', 0, 0.36, 0);
  const cols = ['#e5332a', '#ffd23a', '#ff6fa8', '#f08a1e', '#ffffff', '#a84ad8'];
  for (let i = 0; i < 24; i++) {
    const x = -1.15 + (i % 8) * 0.33 + ((Math.floor(i / 8) % 2) * 0.15), z = -0.5 + Math.floor(i / 8) * 0.48;
    const h = 0.55 + ((i * 37) % 10) / 40;
    k.cyl('trim', 0.025, h, '#4a8a2a', M.at(x, 0.36 + h / 2, z), 5);
    k.add('trim', new THREE.SphereGeometry(0.1, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.62), cols[(i * 5) % cols.length], M.at(x, 0.36 + h + 0.05, z, Math.PI, 0, 0, 1, 1.5, 1));
    k.add('trim', new THREE.SphereGeometry(0.09, 8, 6), '#5aa03a', M.at(x + 0.06, 0.5, z, 0, 0, 0.6, 0.4, 1.4, 0.2));
  }
  g.add(kitMeshes(k));
  g.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}
registerModel('pb_tulips', tulips);

function parasol() {
  const g = new THREE.Group();
  const k = new Kit();
  k.cyl('trim', 0.05, 2.6, '#e8e0d0', M.at(0, 1.3, 0), 8);
  for (let i = 0; i < 8; i++) {
    const seg = new THREE.ConeGeometry(1.6, 0.6, 2, 1, true, (i / 8) * Math.PI * 2, Math.PI / 4);
    k.add('trim', seg, i % 2 ? '#e5332a' : '#ffffff', M.at(0, 2.75, 0));
  }
  k.cyl('trim', 0.25, 0.1, '#bbb', M.at(0, 0.05, 0), 12);
  for (const s of [-1, 1]) {
    const x = s * 1.25;
    k.box('trim', 0.7, 0.08, 1.7, '#3a7ac0', x, 0.4, 0.3, 0.03, [0, 0, 0]);
    k.box('trim', 0.7, 0.08, 0.8, '#3a7ac0', x, 0.68, -0.75, 0.03, [0.7, 0, 0]);
    for (const z of [-0.4, 1.0]) for (const dx of [-0.3, 0.3]) k.cyl('trim', 0.025, 0.4, '#d8d0c0', M.at(x + dx, 0.2, z), 6);
  }
  k.cyl('trim', 0.35, 0.05, '#c8a46b', M.at(0, 0.55, 1.2), 14);
  k.cyl('trim', 0.04, 0.55, '#c8a46b', M.at(0, 0.27, 1.2), 6);
  k.cyl('trim', 0.06, 0.2, '#f2e2a0', M.at(0.1, 0.68, 1.15), 10);
  g.add(kitMeshes(k));
  g.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}
registerModel('pb_parasol', parasol);

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
