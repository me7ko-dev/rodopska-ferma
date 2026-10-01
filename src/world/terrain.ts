import * as THREE from 'three';
import { fbm, noise2, smooth, clamp, rng } from '../engine/noise';
import { heightAt, roadZAt, ROAD_W, FARM, DRIVE, ROAD_Z, VILLAGE_PLOTS, POND } from './layout';

const SIZE = 1500;
const CENTER_X = 50;

const C_GRASS = new THREE.Color('#62a034');
const C_GRASS_DARK = new THREE.Color('#4a8a2c');
const C_GRASS_LIGHT = new THREE.Color('#86bd45');
const C_FOREST = new THREE.Color('#3f6e2a');
const C_ROCK = new THREE.Color('#8a8a7c');
const C_DRY = new THREE.Color('#a3a356');

/** Цвят на тревата в дадена точка (един и същ за терена и за нарисуваната земя на фермата). */
export function grassColor(x: number, z: number, out: THREE.Color) {
  const n1 = fbm(x * 0.03, z * 0.03, 3);
  const n2 = noise2(x * 0.11 + 5, z * 0.11 - 3);
  out.copy(C_GRASS);
  if (n1 < 0.5) out.lerp(C_GRASS_DARK, Math.min(1, (0.5 - n1) * 2.2));
  else out.lerp(C_GRASS_LIGHT, Math.min(1, (n1 - 0.5) * 2.4));
  out.lerp(C_DRY, smooth(0.72, 0.95, n2) * 0.25);
  return out;
}

/** Малка повтаряща се текстура с шарка на трева — дава детайл отблизо. */
function detailTexture() {
  const s = 256;
  const cv = document.createElement('canvas');
  cv.width = cv.height = s;
  const g = cv.getContext('2d')!;
  const img = g.createImageData(s, s);
  const r = rng(7);
  for (let y = 0; y < s; y++)
    for (let x = 0; x < s; x++) {
      // безшевен шум: смесваме 4 отместени копия
      const fx = x / s, fy = y / s;
      const n = (a: number, b: number) => fbm(a * 9, b * 9, 3);
      const v = n(fx, fy) * (1 - fx) * (1 - fy) + n(fx - 1, fy) * fx * (1 - fy) + n(fx, fy - 1) * (1 - fx) * fy + n(fx - 1, fy - 1) * fx * fy;
      const k = 0.82 + v * 0.3 + (r() - 0.5) * 0.08;
      const i = (y * s + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = clamp(k * 235, 0, 255);
      img.data[i + 3] = 255;
    }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** Теренът: плоска долина с фермата и селото, а наоколо родопски хълмове и планини. */
export function buildTerrain() {
  const seg = 300;
  const geo = new THREE.PlaneGeometry(SIZE, SIZE, seg, seg);
  geo.rotateX(-Math.PI / 2);
  geo.translate(CENTER_X, 0, 0);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h = heightAt(x, z);
    pos.setY(i, h);
    grassColor(x, z, c);
    if (h > 2) {
      const f = fbm(x * 0.02 + 3, z * 0.02, 3);
      c.lerp(C_FOREST, smooth(4, 30, h) * (0.55 + f * 0.45));
      c.lerp(C_ROCK, smooth(95, 170, h + f * 30) * 0.75);
    }
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const tex = detailTexture();
  tex.repeat.set(SIZE / 7, SIZE / 7);
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, map: tex, roughness: 0.95, metalness: 0 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.name = 'terrain';
  return mesh;
}

/** Зоната с нарисувана земя (пътеки, разлики в тревата) около фермата и селото. */
export const DECAL = { minX: -84, maxX: 184, minZ: -68, maxZ: 68 };
const PX_PER_M = 7.6;

/** Земята на фермата: нарисувана с подробности текстура (пътечки, следи, по-тъмна/светла трева). */
export function buildFarmGround(paths: { pts: [number, number][]; w: number; kind: 'dirt' | 'gravel' }[]) {
  const W = Math.round((DECAL.maxX - DECAL.minX) * PX_PER_M);
  const H = Math.round((DECAL.maxZ - DECAL.minZ) * PX_PER_M);
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const g = cv.getContext('2d')!;
  const img = g.createImageData(W, H);
  const c = new THREE.Color();
  const r = rng(99);
  const fade = 14; // метра плавен преход към терена в краищата
  for (let py = 0; py < H; py++) {
    const z = DECAL.minZ + py / PX_PER_M;
    for (let px = 0; px < W; px++) {
      const x = DECAL.minX + px / PX_PER_M;
      grassColor(x, z, c);
      // фин шум като стръкчета трева
      const fine = noise2(x * 3.1, z * 3.1) * 0.5 + noise2(x * 7.3 + 9, z * 7.3) * 0.5;
      const k = 0.9 + fine * 0.2 + (r() - 0.5) * 0.05;
      const i = (py * W + px) * 4;
      img.data[i] = clamp(Math.pow(c.r, 1 / 2.2) * 255 * k, 0, 255);
      img.data[i + 1] = clamp(Math.pow(c.g, 1 / 2.2) * 255 * k, 0, 255);
      img.data[i + 2] = clamp(Math.pow(c.b, 1 / 2.2) * 255 * k, 0, 255);
      const e = Math.min(x - DECAL.minX, DECAL.maxX - x, z - DECAL.minZ, DECAL.maxZ - z);
      img.data[i + 3] = clamp(e / fade, 0, 1) * 255;
    }
  }
  g.putImageData(img, 0, 0);
  g.globalCompositeOperation = 'source-atop';
  const toPx = (x: number, z: number): [number, number] => [(x - DECAL.minX) * PX_PER_M, (z - DECAL.minZ) * PX_PER_M];

  // пътечки: първо по-тъмен ръб, после пръст/чакъл, после светли петна
  for (const p of paths) {
    const stroke = (w: number, style: string, alpha = 1) => {
      g.globalAlpha = alpha;
      g.strokeStyle = style;
      g.lineWidth = w * PX_PER_M;
      g.lineCap = 'round';
      g.lineJoin = 'round';
      g.beginPath();
      p.pts.forEach(([x, z], i) => (i ? g.lineTo(...toPx(x, z)) : g.moveTo(...toPx(x, z))));
      g.stroke();
    };
    if (p.kind === 'dirt') {
      stroke(p.w + 0.9, '#6d8a35', 0.55);
      stroke(p.w + 0.3, '#9c7a4c', 0.9);
      stroke(p.w - 0.2, '#b68e5c', 1);
      stroke(p.w * 0.45, '#c39c6a', 0.55);
    } else {
      stroke(p.w + 0.8, '#7d8f4a', 0.5);
      stroke(p.w, '#b9ad98', 1);
      stroke(p.w * 0.5, '#cbc1ae', 0.6);
    }
  }
  g.globalAlpha = 1;
  // песъчинки и камъчета по пътечките
  const data = g.getImageData(0, 0, W, H);
  for (let i = 0; i < W * H * 0.02; i++) {
    const px = (r() * W) | 0, py = (r() * H) | 0;
    const j = (py * W + px) * 4;
    const d = data.data;
    const isPath = d[j] > d[j + 1] * 0.98 && d[j + 3] > 200; // кафяво/сиво (не зелено)
    if (!isPath) continue;
    const v = r() < 0.5 ? 0.8 : 1.15;
    d[j] = clamp(d[j] * v, 0, 255); d[j + 1] = clamp(d[j + 1] * v, 0, 255); d[j + 2] = clamp(d[j + 2] * v, 0, 255);
  }
  g.putImageData(data, 0, 0);

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const geo = new THREE.PlaneGeometry(DECAL.maxX - DECAL.minX, DECAL.maxZ - DECAL.minZ);
  geo.rotateX(-Math.PI / 2);
  geo.translate((DECAL.minX + DECAL.maxX) / 2, 0.02, (DECAL.minZ + DECAL.maxZ) / 2);
  const mat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.95, metalness: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.renderOrder = -5;
  mesh.name = 'farm-ground';
  return mesh;
}

/** Текстура на асфалт с прекъсната бяла линия в средата. */
function asphaltTexture() {
  const cv = document.createElement('canvas');
  cv.width = 256;
  cv.height = 512;
  const g = cv.getContext('2d')!;
  g.fillStyle = '#5b5c60';
  g.fillRect(0, 0, 256, 512);
  const r = rng(3);
  for (let i = 0; i < 9000; i++) {
    const v = 70 + r() * 50;
    g.fillStyle = `rgba(${v},${v},${v + 4},${0.35 + r() * 0.4})`;
    g.fillRect(r() * 256, r() * 512, 1 + r() * 2, 1 + r() * 2);
  }
  // износени ръбове
  const grad = g.createLinearGradient(0, 0, 256, 0);
  grad.addColorStop(0, 'rgba(120,110,90,0.55)');
  grad.addColorStop(0.06, 'rgba(0,0,0,0)');
  grad.addColorStop(0.94, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(120,110,90,0.55)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 512);
  // бели линии отстрани и прекъсната в средата
  g.fillStyle = 'rgba(240,240,232,0.85)';
  g.fillRect(14, 0, 5, 512);
  g.fillRect(237, 0, 5, 512);
  g.fillRect(125, 40, 6, 200);
  g.fillRect(125, 296, 6, 200);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.ClampToEdgeWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

/** Главният път — лента по терена от запад до изток. */
export function buildRoad() {
  const x0 = -700, x1 = 800, step = 3;
  const n = Math.round((x1 - x0) / step) + 1;
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  let len = 0;
  let prev: THREE.Vector3 | null = null;
  for (let i = 0; i < n; i++) {
    const x = x0 + i * step;
    const z = roadZAt(x);
    const dz = (roadZAt(x + 0.5) - roadZAt(x - 0.5)) / 1;
    const nx = -dz, nz = 1;
    const nl = Math.hypot(nx, nz);
    const ox = (nx / nl) * (ROAD_W / 2), oz = (nz / nl) * (ROAD_W / 2);
    const cur = new THREE.Vector3(x, 0, z);
    if (prev) len += cur.distanceTo(prev);
    prev = cur;
    const hl = heightAt(x - ox, z - oz), hr = heightAt(x + ox, z + oz);
    const hc = Math.max(heightAt(x, z), (hl + hr) / 2);
    pos.push(x - ox, hc + 0.06, z - oz, x + ox, hc + 0.06, z + oz);
    uv.push(0, len / 14, 1, len / 14);
    if (i > 0) {
      const a = (i - 1) * 2;
      idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ map: asphaltTexture(), roughness: 0.88, metalness: 0, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.name = 'road';
  return mesh;
}

/** Пътечките във фермата и селото (рисуват се в земята). */
export function farmPaths() {
  const P: { pts: [number, number][]; w: number; kind: 'dirt' | 'gravel' }[] = [];
  // отбивката от пътя до двора
  P.push({ pts: [[DRIVE.x, ROAD_Z - 2], [DRIVE.x, FARM.maxZ - 2], [DRIVE.x - 1, 14]], w: DRIVE.w, kind: 'dirt' });
  // главна пътека през фермата (изток-запад) и към езерото
  P.push({ pts: [[-34, 12], [-18, 13], [0, 13.5], [DRIVE.x, 14], [20, 13], [34, 12]], w: 3, kind: 'dirt' });
  P.push({ pts: [[-34, 12], [-42, 10], [POND.x + 7, POND.z + 4]], w: 2.4, kind: 'dirt' });
  // пътечки до къщите в селото
  for (const p of VILLAGE_PLOTS) {
    const side = p.z < ROAD_Z ? 1 : -1;
    P.push({ pts: [[p.x, ROAD_Z - side * 3], [p.x, p.z + side * 3.5]], w: 2.2, kind: 'gravel' });
  }
  return P;
}
