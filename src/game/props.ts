import * as THREE from 'three';
import { mat } from './items3d';
import { instancedModel, type Placement } from '../engine/instancing';

// Прости предмети от форми: огради, кошери, ясли, табела за поръчки, табела „Продава се“.

const box = new THREE.BoxGeometry(1, 1, 1);
const cyl = new THREE.CylinderGeometry(1, 1, 1, 8);

function m(geo: THREE.BufferGeometry, material: THREE.Material, p: [number, number, number], s: [number, number, number], r: [number, number, number] = [0, 0, 0]) {
  const o = new THREE.Mesh(geo, material);
  o.position.set(...p);
  o.scale.set(...s);
  o.rotation.set(...r);
  o.castShadow = true;
  o.receiveShadow = true;
  return o;
}

/**
 * Бяла дървена ограда около правоъгълник (w × d) с отвор (врата) отпред.
 * Връща една група с InstancedMesh за стълбовете и летвите.
 */
export function fence(w: number, d: number, color = '#f6f1e6', gate = 2.2, gateX = 0) {
  const g = new THREE.Group();
  const posts: THREE.Matrix4[] = [], rails: THREE.Matrix4[] = [];
  const M = (x: number, y: number, z: number, sx: number, sy: number, sz: number, ry = 0) =>
    new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), new THREE.Vector3(sx, sy, sz));
  const side = (x0: number, z0: number, x1: number, z1: number, skipMid = false) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const n = Math.max(1, Math.round(len / 1.4));
    const ang = Math.atan2(x1 - x0, z1 - z0);
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t;
      const mid = Math.abs((t - 0.5) * len + gateX) < gate / 2;
      if (skipMid && mid && i !== 0 && i !== n) continue;
      posts.push(M(x, 0.45, z, 0.13, 0.9, 0.13));
    }
    for (let i = 0; i < n; i++) {
      const t0 = i / n, t1 = (i + 1) / n;
      const tm = (t0 + t1) / 2;
      if (skipMid && Math.abs((tm - 0.5) * len + gateX) < gate / 2) continue;
      const x = x0 + (x1 - x0) * tm, z = z0 + (z1 - z0) * tm;
      const l = len / n;
      rails.push(M(x, 0.62, z, 0.07, 0.11, l, ang));
      rails.push(M(x, 0.32, z, 0.07, 0.11, l, ang));
    }
  };
  const hw = w / 2, hd = d / 2;
  side(-hw, -hd, hw, -hd);
  side(hw, -hd, hw, hd);
  side(hw, hd, -hw, hd, true);
  side(-hw, hd, -hw, -hd);
  const pm = new THREE.InstancedMesh(box, mat(color, 0.7), posts.length);
  posts.forEach((mm, i) => pm.setMatrixAt(i, mm));
  const rm = new THREE.InstancedMesh(box, mat(color, 0.7), rails.length);
  rails.forEach((mm, i) => rm.setMatrixAt(i, mm));
  // шапчици на стълбовете
  const capGeo = new THREE.ConeGeometry(0.11, 0.12, 4);
  const cm = new THREE.InstancedMesh(capGeo, mat(color, 0.7), posts.length);
  posts.forEach((mm, i) => {
    const p = new THREE.Vector3().setFromMatrixPosition(mm);
    cm.setMatrixAt(i, M(p.x, 0.96, p.z, 1, 1, 1, Math.PI / 4));
  });
  for (const im of [pm, rm, cm]) {
    im.castShadow = true;
    im.receiveShadow = true;
    g.add(im);
  }
  return g;
}

/** Пръстен двор (по-светла утъпкана трева) под заграждението. */
export function yard(w: number, d: number, color = '#b59a63') {
  const shape = new THREE.Shape();
  const r = 0.8, x = -w / 2, y = -d / 2;
  shape.moveTo(x + r, y);
  shape.lineTo(x + w - r, y);
  shape.quadraticCurveTo(x + w, y, x + w, y + r);
  shape.lineTo(x + w, y + d - r);
  shape.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
  shape.lineTo(x + r, y + d);
  shape.quadraticCurveTo(x, y + d, x, y + d - r);
  shape.lineTo(x, y + r);
  shape.quadraticCurveTo(x, y, x + r, y);
  const g = new THREE.ShapeGeometry(shape, 4).rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color, roughness: 1, transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
  mesh.position.y = 0.03;
  mesh.receiveShadow = true;
  mesh.renderOrder = -4;
  return mesh;
}

/** Ясла с храна. */
export function trough(full: boolean) {
  const g = new THREE.Group();
  const wood = mat('#9c6a3c', 0.85);
  g.add(m(box, wood, [0, 0.25, 0], [1.8, 0.1, 0.6]));
  g.add(m(box, wood, [0, 0.4, 0.3], [1.8, 0.35, 0.08]));
  g.add(m(box, wood, [0, 0.4, -0.3], [1.8, 0.35, 0.08]));
  g.add(m(box, wood, [0.9, 0.4, 0], [0.08, 0.35, 0.6]));
  g.add(m(box, wood, [-0.9, 0.4, 0], [0.08, 0.35, 0.6]));
  for (const x of [-0.75, 0.75]) g.add(m(box, wood, [x, 0.12, 0], [0.1, 0.25, 0.5]));
  const food = m(box, mat('#e2c060', 0.9), [0, 0.5, 0], [1.7, 0.12, 0.5]);
  food.name = 'food';
  food.visible = full;
  g.add(food);
  return g;
}

/** Кошер (бял със жълт покрив). */
export function beehive() {
  const g = new THREE.Group();
  g.add(m(box, mat('#7a5a3a', 0.9), [0, 0.15, 0], [0.9, 0.3, 0.9]));
  const cols = ['#f6f1e6', '#f3d36b', '#f6f1e6'];
  cols.forEach((c, i) => g.add(m(box, mat(c, 0.7), [0, 0.5 + i * 0.36, 0], [0.8, 0.34, 0.8])));
  g.add(m(box, mat('#d9a43a', 0.7), [0, 1.62, 0], [0.95, 0.12, 0.95]));
  g.add(m(box, mat('#3a2a1a', 0.9), [0, 0.42, 0.41], [0.35, 0.06, 0.02]));
  return g;
}

/** Табло за поръчки: дървена дъска с листчета. */
export function orderBoard() {
  const g = new THREE.Group();
  const wood = mat('#8d5a2b', 0.85), light = mat('#c48a4a', 0.8);
  g.add(m(box, wood, [-1.0, 1.0, 0], [0.16, 2.0, 0.16]));
  g.add(m(box, wood, [1.0, 1.0, 0], [0.16, 2.0, 0.16]));
  g.add(m(box, light, [0, 1.35, 0], [2.3, 1.3, 0.1]));
  g.add(m(box, wood, [0, 2.06, 0], [2.6, 0.14, 0.3]));
  const papers = ['#fffaf0', '#fff1c9', '#f5fff0', '#fffaf0', '#fde8e8', '#fff1c9'];
  papers.forEach((c, i) => {
    const p = m(box, mat(c, 0.9), [-0.72 + (i % 3) * 0.72, 1.6 - Math.floor(i / 3) * 0.55, 0.07], [0.5, 0.42, 0.02], [0, 0, (i % 2 ? 0.06 : -0.05)]);
    p.name = 'paper' + i;
    g.add(p);
    g.add(m(cyl, mat('#d93a2f', 0.5), [p.position.x, p.position.y + 0.15, 0.09], [0.035, 0.03, 0.035], [Math.PI / 2, 0, 0]));
  });
  return g;
}

/** Табела „Продава се“ с надпис. */
export function saleSign(text: string, sub: string) {
  const g = new THREE.Group();
  const wood = mat('#8d5a2b', 0.85);
  g.add(m(box, wood, [0, 0.8, 0], [0.12, 1.6, 0.12]));
  const cv = document.createElement('canvas');
  cv.width = 256;
  cv.height = 128;
  const c = cv.getContext('2d')!;
  c.fillStyle = '#fff6df';
  c.fillRect(0, 0, 256, 128);
  c.strokeStyle = '#b5763c';
  c.lineWidth = 10;
  c.strokeRect(5, 5, 246, 118);
  c.fillStyle = '#c0392b';
  c.font = 'bold 40px Rubik, sans-serif';
  c.textAlign = 'center';
  c.fillText(text, 128, 56);
  c.fillStyle = '#4a2f16';
  c.font = 'bold 30px Rubik, sans-serif';
  c.fillText(sub, 128, 102);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const board = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.8, 0.06), [wood, wood, wood, wood, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 }), wood]);
  board.position.set(0, 1.55, 0.08);
  board.castShadow = true;
  g.add(board);
  return g;
}

/** Буренясала земя (храсти, дървета, камъни, пънове) — показва, че парцелът още не е твой. */
export function overgrowth(w: number, d: number, seed: number) {
  const g = new THREE.Group();
  let s = seed;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const n = Math.round((w * d) / 10);
  const lists: Record<string, Placement[]> = {};
  const add = (name: string, x: number, z: number, sc: number) => (lists[name] ||= []).push({ x, y: 0, z, rot: r() * 6.28, scale: sc });
  for (let i = 0; i < n; i++) {
    const x = (r() - 0.5) * (w - 1.5), z = (r() - 0.5) * (d - 1.5);
    const t = r();
    if (t < 0.12) add(r() < 0.5 ? 'tree_b' : 'tree_d', x, z, 0.7 + r() * 0.5);
    else if (t < 0.22) add('n_pine4', x, z, 0.6 + r() * 0.4);
    else if (t < 0.45) add('n_bush_flowers', x, z, 0.9 + r() * 0.8);
    else if (t < 0.62) add(['n_rock1', 'n_rock2', 'n_rock3'][(r() * 3) | 0], x, z, 0.8 + r() * 1.2);
    else if (t < 0.7) add('n_fern', x, z, 1 + r());
    else add(r() < 0.5 ? 'n_grass_tall' : 'n_grass_wispy2', x, z, 1 + r() * 0.8);
  }
  const sizes: Record<string, number> = { tree_b: 5.5, tree_d: 5, n_pine4: 8, n_bush_flowers: 1.8, n_rock1: 1.3, n_rock2: 1.1, n_rock3: 1.2, n_fern: 1.1, n_grass_tall: 1.1, n_grass_wispy2: 0.9 };
  for (const [name, list] of Object.entries(lists)) g.add(instancedModel(name, sizes[name] ?? 1, list, { by: 'y', shadow: !/grass|fern/.test(name) }));
  return g;
}
