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
    const h = [0.35, 1.0, 1.7, 2.0][st];
    for (const [x, z] of grid(3, 4, 0.12, r)) {
      const hh = h * (0.9 + r() * 0.2);
      parts.push({ geo: place(P.cyl(0.065, hh, 6), x, 0, z), color: st < 3 ? '#6fb446' : '#93bf4c' });
      const nl = st === 0 ? 3 : 8;
      for (let i = 0; i < nl; i++) {
        const y = 0.05 + (i / nl) * hh * 0.85;
        parts.push({ geo: place(leafGeo(0.75 * (st ? 1 : 0.5), 0.13, 0.8), x, y, z, 0.7, (i * 2.4 + r()) % 6.28, 0), color: i % 2 ? G : G2, side: true });
      }
      if (st >= 2) parts.push({ geo: place(P.cone(0.08, 0.32, 6), x, hh, z), color: st === 3 ? '#e2c062' : '#a7c25a' });
      if (st === 3)
        for (let k = 0; k < 2; k++) {
          const a = r() * 6.28;
          parts.push({ geo: place(P.sph(0.1, 8, 6), x + Math.cos(a) * 0.11, hh * (0.45 + k * 0.15), z + Math.sin(a) * 0.11, 0.35, a, 0, [1, 2.5, 1]), color: '#f7c531' });
          parts.push({ geo: place(leafGeo(0.36, 0.09, -0.15), x + Math.cos(a) * 0.08, hh * (0.37 + k * 0.15), z + Math.sin(a) * 0.08, 0.2, a, 0), color: '#a8cc62', side: true });
        }
    }
    return parts;
  },
  potato(st, r) {
    const parts: Part[] = [];
    const s = [0.16, 0.3, 0.42, 0.46][st];
    for (const [x, z] of grid(3, 3, 0.1, r)) {
      for (let i = 0; i < 7; i++) parts.push({ geo: place(P.ico(s * (0.55 + r() * 0.35), 1), x + (r() - 0.5) * s * 1.2, s * 0.7 + r() * s * 0.5, z + (r() - 0.5) * s * 1.2, r(), r(), r()), color: i % 3 === 0 ? DARK : i % 2 ? G2 : G });
      if (st >= 2) for (let i = 0; i < 5; i++) parts.push({ geo: place(P.sph(0.06, 6, 4), x + (r() - 0.5) * 0.6, s * 1.45 + r() * 0.1, z + (r() - 0.5) * 0.6), color: r() < 0.5 ? '#ffffff' : '#c9a7e8' });
      if (st === 3) parts.push({ geo: place(P.sph(0.14, 7, 5), x + 0.3, 0.06, z + 0.25, 0, 0, 0, [1, 0.7, 0.8]), color: '#c99a5b' });
    }
    return parts;
  },
  carrot(st, r) {
    const parts: Part[] = [];
    const h = [0.22, 0.4, 0.56, 0.62][st];
    for (const [x, z] of grid(4, 5, 0.08, r)) {
      for (let i = 0; i < 7; i++) parts.push({ geo: place(leafGeo(h * (0.8 + r() * 0.4), 0.07, 0.45), x, 0.05, z, 0.35, (i / 7) * 6.28 + r(), 0), color: i % 2 ? G3 : G, side: true });
      if (st >= 2) parts.push({ geo: place(P.cone(st === 3 ? 0.1 : 0.06, 0.16, 7), x, 0.1, z, Math.PI), color: '#f28a1d' });
    }
    return parts;
  },
  beet(st, r) {
    const parts: Part[] = [];
    const h = [0.22, 0.42, 0.56, 0.62][st];
    for (const [x, z] of grid(3, 4, 0.08, r)) {
      for (let i = 0; i < 7; i++) parts.push({ geo: place(leafGeo(h * (0.8 + r() * 0.4), 0.15, 0.55), x, st >= 2 ? 0.14 : 0.03, z, 0.5, (i / 7) * 6.28 + r(), 0), color: i % 3 === 0 ? '#7a2f45' : i % 2 ? '#5da23a' : '#4f9433', side: true });
      if (st >= 2) parts.push({ geo: place(P.sph(st === 3 ? 0.17 : 0.1, 9, 7), x, 0.1, z), color: '#8e1f3c' });
    }
    return parts;
  },
  beans(st, r) {
    const parts: Part[] = [];
    const h = [0.3, 0.8, 1.35, 1.5][st];
    for (const [x, z] of grid(3, 3, 0.05, r)) {
      if (st >= 1) parts.push({ geo: place(P.cyl(0.03, 1.6, 5), x, 0, z, 0.03, 0, 0.03), color: '#9c7a4c' });
      const n = Math.round(h * 10);
      for (let i = 0; i < n; i++) {
        const y = 0.1 + (i / n) * h, a = i * 1.7;
        parts.push({ geo: place(P.ico(0.12 + r() * 0.05, 1), x + Math.cos(a) * 0.12, y, z + Math.sin(a) * 0.12), color: i % 2 ? G : G2 });
        if (st === 3 && i % 2 === 0) parts.push({ geo: place(P.sph(0.04, 6, 4), x + Math.cos(a + 1) * 0.2, y - 0.05, z + Math.sin(a + 1) * 0.2, 0, 0, 0.3, [1, 3.4, 1]), color: i % 4 ? '#efe0bd' : '#c76b5e' });
      }
    }
    return parts;
  },
  tomato(st, r) {
    const parts: Part[] = [];
    const s = [0.18, 0.34, 0.48, 0.52][st];
    for (const [x, z] of grid(3, 3, 0.05, r)) {
      if (st >= 1) parts.push({ geo: place(P.cyl(0.025, 1.1, 4), x + 0.14, 0, z), color: '#9c7a4c' });
      for (let i = 0; i < 7; i++) parts.push({ geo: place(P.ico(s * 0.42, 1), x + (r() - 0.5) * s * 1.1, s * 0.55 + r() * s, z + (r() - 0.5) * s * 1.1, r(), r(), r()), color: i % 2 ? G2 : G });
      if (st >= 2) for (let i = 0; i < 7; i++) {
        const a = r() * 6.28, rr = s * (0.45 + r() * 0.2);
        parts.push({ geo: place(P.sph(0.1, 9, 7), x + Math.cos(a) * rr, s * 0.4 + r() * s * 0.9, z + Math.sin(a) * rr), color: st === 3 ? (r() < 0.85 ? '#e8392c' : '#f27a2c') : '#9fcf62' });
      }
    }
    return parts;
  },
  pepper(st, r) {
    const parts: Part[] = [];
    const s = [0.18, 0.32, 0.45, 0.48][st];
    for (const [x, z] of grid(3, 3, 0.05, r)) {
      for (let i = 0; i < 7; i++) parts.push({ geo: place(P.ico(s * 0.4, 1), x + (r() - 0.5) * s * 1.1, s * 0.55 + r() * s * 0.8, z + (r() - 0.5) * s * 1.1, r(), r(), r()), color: i % 2 ? DARK : G2 });
      if (st >= 2) for (let i = 0; i < 6; i++) {
        const a = r() * 6.28, rr = s * (0.45 + r() * 0.2);
        parts.push({ geo: place(P.sph(0.07, 7, 5), x + Math.cos(a) * rr, s * 0.35 + r() * s * 0.7, z + Math.sin(a) * rr, 0, 0, (r() - 0.5) * 0.6, [1, 2.3, 1]), color: st === 3 ? (r() < 0.6 ? '#d8261d' : '#e7b51e') : '#6fb446' });
      }
    }
    return parts;
  },
  sunflower(st, r) {
    const parts: Part[] = [];
    const h = [0.35, 1.0, 1.6, 1.9][st];
    const tilt = -0.55;
    for (const [x, z] of grid(3, 3, 0.1, r)) {
      const hh = h * (0.9 + r() * 0.2);
      parts.push({ geo: place(P.cyl(0.05, hh, 6), x, 0, z), color: '#5f9c38' });
      for (let i = 0; i < 5; i++) parts.push({ geo: place(leafGeo(0.42, 0.2, 0.6), x, hh * (0.2 + i * 0.13), z, 0.95, i * 1.9, 0), color: i % 2 ? G2 : G, side: true });
      if (st >= 2) {
        const head = st === 3 ? 0.27 : 0.12;
        if (st === 3)
          for (let i = 0; i < 16; i++) {
            const g = leafGeo(0.24, 0.1, 0.06).translate(0, head * 0.8, 0).rotateZ((i / 16) * 6.28);
            g.applyMatrix4(new THREE.Matrix4().makeRotationX(tilt)).translate(x, hh, z + 0.05);
            parts.push({ geo: g, color: i % 2 ? '#ffcc1f' : '#ffd84a', side: true });
          }
        parts.push({ geo: place(new THREE.CylinderGeometry(head, head, 0.08, 14), x, hh, z + 0.06, tilt + Math.PI / 2, 0, 0), color: st === 3 ? '#5b3a1a' : '#7cae3c' });
      }
    }
    return parts;
  },
  pumpkin(st, r) {
    const parts: Part[] = [];
    const pts = grid(2, 2, 0.3, r);
    for (const [x, z] of grid(4, 4, 0.2, r)) parts.push({ geo: place(P.ico([0.14, 0.22, 0.28, 0.28][st], 1), x, 0.12, z, r(), r(), r(), [1.2, 0.6, 1.2]), color: r() < 0.5 ? G2 : G });
    if (st >= 2)
      for (const [x, z] of pts) {
        const s = st === 3 ? 0.4 : 0.2;
        for (let i = 0; i < 6; i++) parts.push({ geo: place(P.sph(s * 0.62, 10, 7), x + Math.cos(i) * s * 0.3, s * 0.55, z + Math.sin(i) * s * 0.3), color: st === 3 ? '#f07f1e' : '#a6c95a' });
        parts.push({ geo: place(P.cyl(0.04, 0.16, 5), x, s * 1.05, z), color: '#6b4a1f' });
      }
    return parts;
  },
  cabbage(st, r) {
    const parts: Part[] = [];
    const s = [0.14, 0.22, 0.3, 0.34][st];
    for (const [x, z] of grid(3, 3, 0.1, r)) {
      for (let i = 0; i < 7; i++) parts.push({ geo: place(leafGeo(s * 1.6, s * 0.9, -0.45), x, 0.03, z, 1.05, (i / 7) * 6.28 + r(), 0), color: i % 2 ? '#7fb84e' : '#93c75e', side: true });
      if (st >= 2) {
        parts.push({ geo: place(P.sph(s * 0.78, 12, 9), x, s * 0.68, z), color: '#b8dc7a' });
        parts.push({ geo: place(P.sph(s * 0.55, 10, 7), x, s * 1.0, z), color: '#d3eba0' });
      }
    }
    return parts;
  },
  strawberry(st, r) {
    const parts: Part[] = [];
    const s = [0.12, 0.2, 0.26, 0.28][st];
    for (const [x, z] of grid(4, 4, 0.1, r)) {
      for (let i = 0; i < 5; i++) parts.push({ geo: place(P.ico(s * 0.5, 1), x + (r() - 0.5) * s, s * 0.45, z + (r() - 0.5) * s, r(), r(), r(), [1, 0.6, 1]), color: i % 2 ? G2 : '#3f8f2d' });
      if (st === 2) for (let i = 0; i < 2; i++) parts.push({ geo: place(P.sph(0.05, 6, 4), x + (r() - 0.5) * 0.2, s * 0.9, z + (r() - 0.5) * 0.2), color: '#ffffff' });
      if (st === 3) for (let i = 0; i < 4; i++) parts.push({ geo: place(P.cone(0.075, 0.13, 7), x + (r() - 0.5) * 0.3, s * 0.55, z + (r() - 0.5) * 0.3, Math.PI), color: '#e0202f' });
    }
    return parts;
  },
  lavender(st, r) {
    const parts: Part[] = [];
    const s = [0.14, 0.24, 0.34, 0.38][st];
    for (const [x, z] of grid(3, 3, 0.05, r)) {
      parts.push({ geo: place(P.sph(s, 9, 7), x, s * 0.6, z, 0, 0, 0, [1, 0.8, 1]), color: '#7f9e62' });
      if (st >= 2)
        for (let i = 0; i < 22; i++) {
          const a = r() * 6.28, rr = r() * s * 0.95;
          parts.push({ geo: place(P.sph(0.04, 4, 3), x + Math.cos(a) * rr, s * 1.15 + r() * 0.18, z + Math.sin(a) * rr, 0, 0, 0, [1, 2.6, 1]), color: st === 3 ? (i % 2 ? '#8e6bd1' : '#7a57c2') : '#9fb08a' });
        }
    }
    return parts;
  },
  herbs(st, r) {
    const parts: Part[] = [];
    const s = [0.12, 0.2, 0.28, 0.32][st];
    for (const [x, z] of grid(3, 4, 0.08, r)) {
      for (let i = 0; i < 6; i++) parts.push({ geo: place(P.ico(s * 0.45, 1), x + (r() - 0.5) * s, s * 0.5 + r() * s * 0.4, z + (r() - 0.5) * s, r(), r(), r(), [1, 0.8, 1]), color: i % 2 ? '#8cb869' : '#a3c784' });
      if (st === 3) for (let i = 0; i < 5; i++) parts.push({ geo: place(P.sph(0.045, 5, 4), x + (r() - 0.5) * s * 1.2, s * 1.2 + r() * 0.08, z + (r() - 0.5) * s * 1.2, 0, 0, 0, [1, 1.6, 1]), color: '#f6f1c8' });
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
