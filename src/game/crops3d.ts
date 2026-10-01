import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { rng } from '../engine/noise';
import { addWind } from '../engine/wind';

// Културите на нивата — 4 етапа (0 покълнало … 3 узряло). Всеки етап се слепва в няколко меша (по един на цвят).

type Part = { geo: THREE.BufferGeometry; color: string; side?: boolean };

const cmats = new Map<string, THREE.MeshStandardMaterial>();
function cmat(color: string, side = false) {
  const k = color + side;
  let m = cmats.get(k);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: 0.65, metalness: 0, side: side ? THREE.DoubleSide : THREE.FrontSide });
    addWind(m, 1.6, 0.05);
    cmats.set(k, m);
  }
  return m;
}

const P = {
  cyl: (r: number, h: number, seg = 5) => new THREE.CylinderGeometry(r * 0.75, r, h, seg).translate(0, h / 2, 0),
  sph: (r: number, w = 8, h = 6) => new THREE.SphereGeometry(r, w, h),
  cone: (r: number, h: number, seg = 6) => new THREE.ConeGeometry(r, h, seg).translate(0, h / 2, 0),
  ico: (r: number, d = 0) => new THREE.IcosahedronGeometry(r, d),
};

function leafGeo(len: number, w: number, bend = 0.3) {
  // лист: плоска форма, леко извита надолу
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.quadraticCurveTo(w, len * 0.45, 0, len);
  s.quadraticCurveTo(-w, len * 0.45, 0, 0);
  const g = new THREE.ShapeGeometry(s, 4);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    pos.setZ(i, Math.pow(y / len, 2) * len * bend);
  }
  g.computeVertexNormals();
  return g;
}

function place(g: THREE.BufferGeometry, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, s: number | [number, number, number] = 1) {
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz));
  const sc = typeof s === 'number' ? new THREE.Vector3(s, s, s) : new THREE.Vector3(...s);
  m.compose(new THREE.Vector3(x, y, z), q, sc);
  return g.clone().applyMatrix4(m);
}

/** Точки за растенията в нивата 2.6×2.6 м: редове × колони. */
function grid(rows: number, cols: number, jitter: number, r: () => number) {
  const out: [number, number][] = [];
  for (let i = 0; i < rows; i++)
    for (let j = 0; j < cols; j++)
      out.push([(-1 + (j + 0.5) * (2 / cols)) * 1.12 + (r() - 0.5) * jitter, (-1 + (i + 0.5) * (2 / rows)) * 1.12 + (r() - 0.5) * jitter]);
  return out;
}

const G = '#5fae3c', G2 = '#4f9a33', G3 = '#7cc24e', DARK = '#3f7f2a';

const plants: Record<string, (stage: number, r: () => number) => Part[]> = {
  wheat(st, r) {
    const parts: Part[] = [];
    const h = [0.2, 0.55, 0.95, 1.1][st];
    const col = ['#79c04a', '#7cc24e', '#b3c34c', '#e8b545'][st];
    const ear = ['#79c04a', '#86c552', '#d2c25a', '#f6c84f'][st];
    for (const [x, z] of grid(9, 12, 0.16, r)) {
      const hh = h * (0.85 + r() * 0.3);
      const tx = (r() - 0.5) * 0.35, tz = (r() - 0.5) * 0.35;
      parts.push({ geo: place(P.cyl(0.024, hh, 3), x, 0, z, tx, 0, tz), color: col });
      if (st >= 2) parts.push({ geo: place(P.sph(0.055, 5, 4), x - Math.sin(tz) * hh, hh + 0.08, z + Math.sin(tx) * hh, tx, 0, tz, [1, 2.5, 1]), color: ear });
      if (st <= 1 && r() < 0.6) parts.push({ geo: place(leafGeo(0.22 + st * 0.15, 0.035), x, 0, z, 0, r() * 6, 0.45), color: G3, side: true });
    }
    // гъст „килим“ от стръкове в основата, за да изглежда нивата пълна
    if (st >= 1) for (const [x, z] of grid(5, 5, 0.3, r)) parts.push({ geo: place(P.sph(0.32, 6, 4), x, h * 0.25, z, 0, r() * 3, 0, [1, h * 0.9, 1]), color: st === 3 ? '#c9a23a' : st === 2 ? '#9db548' : '#6fb446' });
    return parts;
  },
  corn(st, r) {
    const parts: Part[] = [];
    const h = [0.3, 0.9, 1.6, 1.9][st];
    for (const [x, z] of grid(3, 3, 0.15, r)) {
      const hh = h * (0.9 + r() * 0.2);
      parts.push({ geo: place(P.cyl(0.05, hh, 5), x, 0, z), color: st < 3 ? '#6fb446' : '#8fbf4a' });
      const nl = st === 0 ? 3 : 6;
      for (let i = 0; i < nl; i++) {
        const y = (i / nl) * hh * 0.8;
        parts.push({ geo: place(leafGeo(0.55 * (st ? 1 : 0.5), 0.08, 0.7), x, y, z, 0.6, (i * 2.4 + r()) % 6.28, 0), color: i % 2 ? G : G2, side: true });
      }
      if (st >= 2) parts.push({ geo: place(P.cone(0.06, 0.25, 5), x, hh, z), color: st === 3 ? '#d9b75a' : '#a7c25a' });
      if (st === 3) {
        const a = r() * 6.28;
        parts.push({ geo: place(P.sph(0.07, 6, 5), x + Math.cos(a) * 0.08, hh * 0.55, z + Math.sin(a) * 0.08, 0.4, a, 0, [1, 2.6, 1]), color: '#f7c531' });
        parts.push({ geo: place(leafGeo(0.3, 0.07, -0.2), x + Math.cos(a) * 0.06, hh * 0.45, z + Math.sin(a) * 0.06, 0.25, a, 0), color: '#9cc65a', side: true });
      }
    }
    return parts;
  },
  potato(st, r) {
    const parts: Part[] = [];
    const s = [0.12, 0.25, 0.38, 0.42][st];
    for (const [x, z] of grid(3, 3, 0.1, r)) {
      for (let i = 0; i < 5; i++) parts.push({ geo: place(P.ico(s * (0.7 + r() * 0.4), 0), x + (r() - 0.5) * s, s * 0.8 + r() * s * 0.5, z + (r() - 0.5) * s, r(), r(), r()), color: i % 2 ? G2 : DARK });
      if (st === 3) {
        for (let i = 0; i < 4; i++) parts.push({ geo: place(P.sph(0.05, 5, 4), x + (r() - 0.5) * 0.5, s * 1.6 + r() * 0.1, z + (r() - 0.5) * 0.5), color: r() < 0.5 ? '#f5f0ff' : '#c9a7e8' });
        parts.push({ geo: place(P.sph(0.12, 6, 5), x + 0.25, 0.05, z + 0.2, 0, 0, 0, [1, 0.7, 0.8]), color: '#c99a5b' });
      }
    }
    return parts;
  },
  carrot(st, r) {
    const parts: Part[] = [];
    const h = [0.15, 0.3, 0.45, 0.5][st];
    for (const [x, z] of grid(4, 4, 0.1, r)) {
      for (let i = 0; i < 5; i++) parts.push({ geo: place(leafGeo(h, 0.05, 0.4), x, 0, z, 0.3, (i / 5) * 6.28 + r(), 0), color: i % 2 ? G3 : G, side: true });
      if (st === 3) parts.push({ geo: place(P.cone(0.07, 0.12, 6), x, 0.03, z, Math.PI), color: '#f28a1d' });
    }
    return parts;
  },
  beet(st, r) {
    const parts: Part[] = [];
    const h = [0.15, 0.32, 0.45, 0.5][st];
    for (const [x, z] of grid(3, 4, 0.1, r)) {
      for (let i = 0; i < 6; i++) parts.push({ geo: place(leafGeo(h, 0.11, 0.5), x, st === 3 ? 0.12 : 0, z, 0.45, (i / 6) * 6.28 + r(), 0), color: i % 2 ? '#5da23a' : '#4f9433', side: true });
      if (st >= 2) parts.push({ geo: place(P.sph(st === 3 ? 0.13 : 0.08, 7, 6), x, 0.06, z), color: '#8e1f3c' });
    }
    return parts;
  },
  beans(st, r) {
    const parts: Part[] = [];
    const h = [0.25, 0.7, 1.3, 1.45][st];
    for (const [x, z] of grid(3, 3, 0.05, r)) {
      if (st >= 1) parts.push({ geo: place(P.cyl(0.025, 1.55, 4), x, 0, z, 0.03, 0, 0.03), color: '#9c7a4c' });
      const n = Math.round(h * 9);
      for (let i = 0; i < n; i++) {
        const y = 0.1 + (i / n) * h, a = i * 1.7;
        parts.push({ geo: place(P.ico(0.1 + r() * 0.04, 0), x + Math.cos(a) * 0.1, y, z + Math.sin(a) * 0.1), color: i % 2 ? G : G2 });
        if (st === 3 && i % 2 === 0) parts.push({ geo: place(P.sph(0.03, 5, 4), x + Math.cos(a + 1) * 0.16, y - 0.05, z + Math.sin(a + 1) * 0.16, 0, 0, 0.3, [1, 3.4, 1]), color: i % 4 ? '#e8d9b5' : '#c76b5e' });
      }
    }
    return parts;
  },
  tomato(st, r) {
    const parts: Part[] = [];
    const s = [0.15, 0.3, 0.45, 0.48][st];
    for (const [x, z] of grid(3, 3, 0.05, r)) {
      if (st >= 1) parts.push({ geo: place(P.cyl(0.02, 1.0, 4), x + 0.12, 0, z), color: '#9c7a4c' });
      for (let i = 0; i < 6; i++) parts.push({ geo: place(P.ico(s * 0.45, 0), x + (r() - 0.5) * s, s * 0.6 + r() * s, z + (r() - 0.5) * s, r(), r(), r()), color: i % 2 ? G2 : G });
      if (st >= 2) for (let i = 0; i < 4; i++) parts.push({ geo: place(P.sph(0.075, 7, 6), x + (r() - 0.5) * s * 1.2, s * 0.4 + r() * s * 0.9, z + (r() - 0.5) * s * 1.2), color: st === 3 ? (r() < 0.85 ? '#e8392c' : '#f27a2c') : '#8fc35a' });
    }
    return parts;
  },
  pepper(st, r) {
    const parts: Part[] = [];
    const s = [0.15, 0.3, 0.42, 0.45][st];
    for (const [x, z] of grid(3, 3, 0.05, r)) {
      for (let i = 0; i < 6; i++) parts.push({ geo: place(P.ico(s * 0.42, 0), x + (r() - 0.5) * s, s * 0.6 + r() * s * 0.8, z + (r() - 0.5) * s, r(), r(), r()), color: i % 2 ? DARK : G2 });
      if (st >= 2) for (let i = 0; i < 4; i++) parts.push({ geo: place(P.sph(0.05, 6, 5), x + (r() - 0.5) * s * 1.1, s * 0.4 + r() * s * 0.7, z + (r() - 0.5) * s * 1.1, 0, 0, (r() - 0.5) * 0.6, [1, 2.4, 1]), color: st === 3 ? (r() < 0.6 ? '#d8261d' : '#e7b51e') : '#6fb446' });
    }
    return parts;
  },
  sunflower(st, r) {
    const parts: Part[] = [];
    const h = [0.3, 0.9, 1.5, 1.8][st];
    for (const [x, z] of grid(3, 3, 0.1, r)) {
      const hh = h * (0.9 + r() * 0.2);
      parts.push({ geo: place(P.cyl(0.04, hh, 5), x, 0, z), color: '#5f9c38' });
      for (let i = 0; i < 4; i++) parts.push({ geo: place(leafGeo(0.3, 0.14, 0.5), x, hh * (0.25 + i * 0.15), z, 0.9, i * 1.9, 0), color: G2, side: true });
      if (st >= 2) {
        const head = st === 3 ? 0.22 : 0.1;
        const tilt = -0.5;
        if (st === 3)
          for (let i = 0; i < 12; i++) {
            const g = place(leafGeo(0.17, 0.06, 0.05), 0, 0, 0, 0, 0, (i / 12) * 6.28);
            g.applyMatrix4(new THREE.Matrix4().makeRotationX(tilt)).translate(x, hh, z + 0.05);
            parts.push({ geo: g, color: '#ffcc1f', side: true });
          }
        parts.push({ geo: place(new THREE.CylinderGeometry(head, head, 0.06, 12), x, hh, z + 0.05, tilt + Math.PI / 2, 0, 0), color: st === 3 ? '#5b3a1a' : '#7cae3c' });
      }
    }
    return parts;
  },
  pumpkin(st, r) {
    const parts: Part[] = [];
    const pts = grid(2, 2, 0.3, r);
    for (const [x, z] of grid(4, 4, 0.2, r)) parts.push({ geo: place(P.ico([0.12, 0.2, 0.26, 0.26][st], 0), x, 0.12, z, r(), r(), r(), [1.2, 0.6, 1.2]), color: r() < 0.5 ? G2 : G });
    if (st >= 2)
      for (const [x, z] of pts) {
        const s = st === 3 ? 0.38 : 0.18;
        for (let i = 0; i < 6; i++) parts.push({ geo: place(P.sph(s * 0.62, 8, 6), x + Math.cos(i) * s * 0.3, s * 0.55, z + Math.sin(i) * s * 0.3), color: st === 3 ? '#f07f1e' : '#a6c95a' });
        parts.push({ geo: place(P.cyl(0.035, 0.14, 4), x, s * 1.05, z), color: '#6b4a1f' });
      }
    return parts;
  },
  cabbage(st, r) {
    const parts: Part[] = [];
    const s = [0.12, 0.2, 0.28, 0.32][st];
    for (const [x, z] of grid(3, 3, 0.1, r)) {
      for (let i = 0; i < 6; i++) parts.push({ geo: place(leafGeo(s * 1.4, s * 0.8, -0.4), x, 0.02, z, 1.0, (i / 6) * 6.28 + r(), 0), color: '#7fb84e', side: true });
      if (st >= 2) parts.push({ geo: place(P.sph(s * 0.75, 9, 7), x, s * 0.65, z), color: '#b8dc7a' });
    }
    return parts;
  },
  strawberry(st, r) {
    const parts: Part[] = [];
    const s = [0.1, 0.18, 0.24, 0.26][st];
    for (const [x, z] of grid(4, 4, 0.1, r)) {
      for (let i = 0; i < 4; i++) parts.push({ geo: place(P.ico(s * 0.5, 0), x + (r() - 0.5) * s, s * 0.45, z + (r() - 0.5) * s, r(), r(), r(), [1, 0.6, 1]), color: i % 2 ? G2 : '#3f8f2d' });
      if (st === 2) parts.push({ geo: place(P.sph(0.04, 5, 4), x, s * 0.9, z), color: '#ffffff' });
      if (st === 3) for (let i = 0; i < 3; i++) parts.push({ geo: place(P.cone(0.05, 0.09, 6), x + (r() - 0.5) * 0.25, s * 0.5, z + (r() - 0.5) * 0.25, Math.PI), color: '#e0202f' });
    }
    return parts;
  },
  lavender(st, r) {
    const parts: Part[] = [];
    const s = [0.12, 0.22, 0.32, 0.36][st];
    for (const [x, z] of grid(3, 3, 0.05, r)) {
      parts.push({ geo: place(P.sph(s, 8, 6), x, s * 0.6, z, 0, 0, 0, [1, 0.8, 1]), color: '#7f9e62' });
      if (st >= 2)
        for (let i = 0; i < 14; i++) {
          const a = r() * 6.28, rr = r() * s * 0.9;
          parts.push({ geo: place(P.sph(0.035, 4, 3), x + Math.cos(a) * rr, s * 1.2 + r() * 0.15, z + Math.sin(a) * rr, 0, 0, 0, [1, 2.2, 1]), color: st === 3 ? (i % 2 ? '#8e6bd1' : '#7a57c2') : '#9fb08a' });
        }
    }
    return parts;
  },
  herbs(st, r) {
    const parts: Part[] = [];
    const s = [0.1, 0.18, 0.26, 0.3][st];
    for (const [x, z] of grid(4, 4, 0.1, r)) {
      for (let i = 0; i < 5; i++) parts.push({ geo: place(leafGeo(s * 1.4, 0.05, 0.2), x, 0, z, 0.2, (i / 5) * 6.28 + r(), 0), color: i % 2 ? '#8cb869' : '#a3c784', side: true });
      if (st === 3) parts.push({ geo: place(P.sph(0.05, 5, 4), x, s * 1.4, z, 0, 0, 0, [1, 1.6, 1]), color: '#f1ebb0' });
    }
    return parts;
  },
};

const cache = new Map<string, THREE.Group>();

/** Растенията на една нива (споделена геометрия — евтино за много ниви). */
export function cropMesh(crop: string, stage: number): THREE.Group {
  const key = crop + ':' + stage;
  let proto = cache.get(key);
  if (!proto) {
    proto = new THREE.Group();
    const f = plants[crop] ?? plants.wheat;
    const parts = f(stage, rng(crop.length * 97 + stage * 13 + 1));
    const byColor = new Map<string, THREE.BufferGeometry[]>();
    for (const p of parts) {
      const k = p.color + (p.side ? '|s' : '');
      const g = p.geo.index ? p.geo.toNonIndexed() : p.geo;
      g.deleteAttribute('uv');
      (byColor.get(k) ?? byColor.set(k, []).get(k)!).push(g);
    }
    for (const [k, geos] of byColor) {
      const [color, s] = k.split('|');
      const merged = mergeGeometries(geos, false);
      if (!merged) continue;
      const m = new THREE.Mesh(merged, cmat(color, s === 's'));
      m.castShadow = true;
      m.receiveShadow = true;
      proto.add(m);
    }
    cache.set(key, proto);
  }
  return proto.clone();
}

// ---------- почвата на нивата ----------
let soilGeo: THREE.BufferGeometry | null = null;
const soilMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 });

/** Изорана нива 2.9×2.9 м със заоблени ръбове и бразди. */
export function soilMesh() {
  if (!soilGeo) {
    const n = 36, size = 2.9;
    const g = new THREE.PlaneGeometry(size, size, n, n);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position;
    const col = new Float32Array(pos.count * 3);
    const r = rng(77);
    const c1 = new THREE.Color('#6e4528'), c2 = new THREE.Color('#8a5a34'), edge = new THREE.Color('#9a6c42');
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const ex = 1 - Math.pow(Math.abs(x) / (size / 2), 6), ez = 1 - Math.pow(Math.abs(z) / (size / 2), 6);
      const e = Math.max(0, ex * ez);
      const furrow = (Math.sin((z / size) * Math.PI * 2 * 4.5 + Math.PI / 2) * 0.5 + 0.5);
      pos.setY(i, 0.04 + e * (0.1 + furrow * 0.07) + (r() - 0.5) * 0.012);
      const c = c1.clone().lerp(c2, furrow * 0.8 + (r() - 0.5) * 0.15).lerp(edge, (1 - e) * 0.7);
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.computeVertexNormals();
    soilGeo = g;
  }
  const m = new THREE.Mesh(soilGeo, soilMat);
  m.receiveShadow = true;
  return m;
}
