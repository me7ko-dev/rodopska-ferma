import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Малък „конструктор“ за модели от код: части с цвят се събират в няколко общи геометрии
// (боя, детайли, хром, стъкло, фарове) — така една кола е само няколко рисувания.

export type Bucket = 'paint' | 'trim' | 'chrome' | 'glass' | 'head' | 'tail';
export type P2 = [number, number] | [number, number, number]; // x, y, радиус на заобляне

const tmpC = new THREE.Color();

/** Подготвя геометрия за сливане: без индекси и UV, с цвят за всеки връх. */
function prep(g: THREE.BufferGeometry, color: THREE.ColorRepresentation, m?: THREE.Matrix4, keepUV = false) {
  let geo = g.index ? g.toNonIndexed() : g.clone();
  for (const k of Object.keys(geo.attributes)) if (k !== 'position' && k !== 'normal' && !(keepUV && k === 'uv')) geo.deleteAttribute(k);
  if (!geo.attributes.normal) geo.computeVertexNormals();
  if (m) geo.applyMatrix4(m);
  tmpC.set(color);
  const n = geo.attributes.position.count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) col.set([tmpC.r, tmpC.g, tmpC.b], i * 3);
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.groups = [];
  return geo;
}

export const M = {
  /** Матрица от позиция, завъртане (радиани) и мащаб. */
  at(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
    return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
  },
};

/** Затворен контур със заоблени ъгли (за профили на коли, вагони, арки). */
export function roundedShape(pts: P2[], seg = 5): THREE.Shape {
  const s = new THREE.Shape();
  const n = pts.length;
  const P = (i: number) => pts[(i + n) % n];
  for (let i = 0; i < n; i++) {
    const [x, y, r = 0] = P(i);
    if (!r) {
      if (i === 0) s.moveTo(x, y);
      else s.lineTo(x, y);
      continue;
    }
    const [px, py] = P(i - 1), [nx, ny] = P(i + 1);
    const l1 = Math.hypot(px - x, py - y), l2 = Math.hypot(nx - x, ny - y);
    const rr = Math.min(r, l1 / 2, l2 / 2);
    const ax = x + ((px - x) / l1) * rr, ay = y + ((py - y) / l1) * rr;
    const bx = x + ((nx - x) / l2) * rr, by = y + ((ny - y) / l2) * rr;
    if (i === 0) s.moveTo(ax, ay);
    else s.lineTo(ax, ay);
    // гладка дъга през ъгъла
    for (let k = 1; k <= seg; k++) {
      const t = k / seg, u = 1 - t;
      s.lineTo(u * u * ax + 2 * u * t * x + t * t * bx, u * u * ay + 2 * u * t * y + t * t * by);
    }
  }
  s.closePath();
  return s;
}

/**
 * Профил, гледан отстрани (x = дължина напред, y = височина), изтеглен на ширина.
 * Резултатът е центриран по ширина (ос X в света), а дължината е по ос Z (напред = +Z).
 */
export function sideExtrude(shape: THREE.Shape, width: number, bevel = 0.06, curveSegments = 6) {
  const depth = Math.max(0.01, width - bevel * 2);
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments });
  g.translate(0, 0, -depth / 2);
  g.rotateY(-Math.PI / 2);
  return g;
}

/** Кутия със заоблени ръбове. */
export function rbox(w: number, h: number, d: number, r = 0.05) {
  r = Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001);
  if (r <= 0.002) return new THREE.BoxGeometry(w, h, d);
  // скосяването разширява контура с r — затова рисуваме контура по-малък
  const a = d / 2 - r, b = h / 2 - r, c = Math.min(r, a, b) * 0.8;
  const s = roundedShape([[-a, -b, c], [a, -b, c], [a, b, c], [-a, b, c]], 3);
  return sideExtrude(s, w, r, 4);
}

export class Kit {
  parts: Record<string, THREE.BufferGeometry[]> = {};
  /** Части с текстура (паваж, трева) пазят UV координатите си. */
  static UV = new Set(['paving', 'plaza', 'grass']);

  add(bucket: string, g: THREE.BufferGeometry, color: THREE.ColorRepresentation = '#ffffff', m?: THREE.Matrix4) {
    (this.parts[bucket] ||= []).push(prep(g, color, m, Kit.UV.has(bucket)));
    return this;
  }
  box(bucket: string, w: number, h: number, d: number, color: THREE.ColorRepresentation, x: number, y: number, z: number, r = 0, rot: [number, number, number] = [0, 0, 0]) {
    return this.add(bucket, r ? rbox(w, h, d, r) : new THREE.BoxGeometry(w, h, d), color, M.at(x, y, z, ...rot));
  }
  /** Цилиндър по ос X (колела, фарове завъртени отделно и т.н.). */
  cyl(bucket: string, r: number, len: number, color: THREE.ColorRepresentation, m: THREE.Matrix4, seg = 16, r2 = r) {
    return this.add(bucket, new THREE.CylinderGeometry(r2, r, len, seg), color, m);
  }
  /** Всички части от един вид в една геометрия. */
  merged(bucket: string) {
    const list = this.parts[bucket];
    if (!list?.length) return null;
    const g = mergeGeometries(list, false)!;
    g.computeBoundingSphere();
    return g;
  }
}

// ---------- общи материали ----------
const matCache = new Map<string, THREE.Material>();
function cached<T extends THREE.Material>(key: string, make: () => T): T {
  let m = matCache.get(key) as T | undefined;
  if (!m) { m = make(); matCache.set(key, m); }
  return m;
}

/** Нощни светлини (фарове, прозорци) — силата им се сменя от деня и нощта. */
export const NIGHT_LIGHTS = { value: 0 };
export const headMat = new THREE.MeshStandardMaterial({ color: '#fff8e0', emissive: '#ffe9b0', emissiveIntensity: 0.15, roughness: 0.3, vertexColors: true });
export const tailMat = new THREE.MeshStandardMaterial({ color: '#b3121b', emissive: '#ff2a1a', emissiveIntensity: 0.1, roughness: 0.4, vertexColors: true });

export function bucketMat(bucket: Bucket | string, paint?: THREE.ColorRepresentation): THREE.Material {
  switch (bucket) {
    case 'paint': {
      const c = new THREE.Color(paint ?? '#ffffff').getHexString();
      return cached('paint' + c, () => new THREE.MeshStandardMaterial({ color: '#' + c, roughness: 0.38, metalness: 0.08, vertexColors: true }));
    }
    case 'chrome': return cached('chrome', () => new THREE.MeshStandardMaterial({ color: '#dfe3e8', roughness: 0.22, metalness: 0.85, vertexColors: true }));
    case 'glass': return cached('glass', () => new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.12, metalness: 0.2, envMapIntensity: 0.45, vertexColors: true }));
    case 'head': return headMat;
    case 'tail': return tailMat;
    case 'gold': return cached('gold', () => new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.25, metalness: 0.9, vertexColors: true }));
    default: return cached('trim', () => new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.62, metalness: 0.05, vertexColors: true }));
  }
}

/** Прави група с по едно тяло за всеки вид части. */
export function kitMeshes(kit: Kit, paint?: THREE.ColorRepresentation, shadow = true) {
  const g = new THREE.Group();
  for (const b of Object.keys(kit.parts)) {
    const geo = kit.merged(b);
    if (!geo) continue;
    const mesh = new THREE.Mesh(geo, bucketMat(b, paint));
    mesh.name = b;
    mesh.castShadow = shadow && b !== 'glass' && b !== 'head' && b !== 'tail';
    mesh.receiveShadow = true;
    g.add(mesh);
  }
  return g;
}

export function setNightLights(v: number) {
  NIGHT_LIGHTS.value = v;
  headMat.emissiveIntensity = 0.15 + v * 2.6;
  tailMat.emissiveIntensity = 0.1 + v * 1.6;
}
