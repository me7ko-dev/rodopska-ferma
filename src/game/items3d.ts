import * as THREE from 'three';
import { rng } from '../engine/noise';

// Малки 3D модели на стоките (за иконите и за сергията). Всичко е от прости форми, но с меки цветове и светлина.

const matCache = new Map<string, THREE.MeshStandardMaterial>();
export function mat(color: string, rough = 0.6, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  const key = color + rough + JSON.stringify(extra);
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0, ...extra });
    matCache.set(key, m);
  }
  return m;
}

const G = {
  sphere: new THREE.SphereGeometry(1, 24, 16),
  sphereLo: new THREE.SphereGeometry(1, 12, 8),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 24),
  cylLo: new THREE.CylinderGeometry(1, 1, 1, 10),
  cone: new THREE.ConeGeometry(1, 1, 20),
  box: new THREE.BoxGeometry(1, 1, 1),
  torus: new THREE.TorusGeometry(1, 0.25, 10, 24),
};

function mesh(geo: THREE.BufferGeometry, m: THREE.Material, p: [number, number, number] = [0, 0, 0], s: [number, number, number] | number = 1, r: [number, number, number] = [0, 0, 0]) {
  const o = new THREE.Mesh(geo, m);
  o.position.set(...p);
  if (typeof s === 'number') o.scale.setScalar(s);
  else o.scale.set(...s);
  o.rotation.set(...r);
  o.castShadow = true;
  o.receiveShadow = true;
  return o;
}

function roundedBox(w: number, h: number, d: number, r: number) {
  const shape = new THREE.Shape();
  const x = -w / 2, y = -d / 2;
  shape.moveTo(x + r, y);
  shape.lineTo(x + w - r, y);
  shape.quadraticCurveTo(x + w, y, x + w, y + r);
  shape.lineTo(x + w, y + d - r);
  shape.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
  shape.lineTo(x + r, y + d);
  shape.quadraticCurveTo(x, y + d, x, y + d - r);
  shape.lineTo(x, y + r);
  shape.quadraticCurveTo(x, y, x + r, y);
  const g = new THREE.ExtrudeGeometry(shape, { depth: h - r * 2, bevelEnabled: true, bevelThickness: r, bevelSize: r * 0.9, bevelSegments: 3, curveSegments: 6 });
  g.rotateX(-Math.PI / 2);
  g.translate(0, r, 0);
  return g;
}

function lathe(points: [number, number][], seg = 28) {
  return new THREE.LatheGeometry(points.map(([x, y]) => new THREE.Vector2(x, y)), seg);
}

function leaf(len: number, w: number, color: string) {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.quadraticCurveTo(w, len * 0.4, 0, len);
  s.quadraticCurveTo(-w, len * 0.4, 0, 0);
  const g = new THREE.ShapeGeometry(s, 6);
  const m = mat(color, 0.6, { side: THREE.DoubleSide });
  return new THREE.Mesh(g, m);
}

// ---------- отделни модели ----------
function jar(fill: string, lid: string, cloth?: string) {
  const g = new THREE.Group();
  const body = lathe([[0, 0], [0.42, 0], [0.48, 0.08], [0.5, 0.5], [0.48, 0.82], [0.36, 0.9], [0.36, 1.0], [0, 1.0]]);
  g.add(mesh(body, mat(fill, 0.35, { transparent: false })));
  g.add(mesh(body, mat('#ffffff', 0.05, { transparent: true, opacity: 0.25 }), [0, 0, 0], [1.03, 1.0, 1.03]));
  if (cloth) {
    // плат с карета върху капачката
    g.add(mesh(G.cyl, mat(cloth, 0.8), [0, 1.03, 0], [0.5, 0.08, 0.5]));
    g.add(mesh(G.sphereLo, mat(cloth, 0.8), [0, 1.06, 0], [0.42, 0.1, 0.42]));
    g.add(mesh(G.torus, mat('#c9a46b', 0.7), [0, 0.98, 0], [0.38, 0.38, 0.5], [Math.PI / 2, 0, 0]));
  } else {
    g.add(mesh(G.cyl, mat(lid, 0.4, { metalness: 0.3 }), [0, 1.04, 0], [0.4, 0.1, 0.4]));
  }
  // етикет
  g.add(mesh(G.cyl, mat('#fff4dc', 0.7), [0, 0.48, 0], [0.505, 0.3, 0.505]));
  return g;
}

function bottle(fill: string, cap: string, h = 1.4) {
  const g = new THREE.Group();
  const body = lathe([[0, 0], [0.32, 0], [0.36, 0.06], [0.36, h * 0.55], [0.3, h * 0.66], [0.13, h * 0.78], [0.13, h * 0.92], [0, h * 0.92]]);
  g.add(mesh(body, mat(fill, 0.25)));
  g.add(mesh(G.cyl, mat(cap, 0.5), [0, h * 0.96, 0], [0.15, 0.1, 0.15]));
  g.add(mesh(G.cyl, mat('#fff4dc', 0.7), [0, h * 0.3, 0], [0.365, 0.28, 0.365]));
  return g;
}

function sack(label: string) {
  const g = new THREE.Group();
  g.add(mesh(G.sphere, mat('#d9c08a', 0.95), [0, 0.55, 0], [0.55, 0.6, 0.42]));
  g.add(mesh(G.cyl, mat('#cdb37b', 0.95), [0, 1.12, 0], [0.18, 0.18, 0.16]));
  g.add(mesh(G.sphereLo, mat('#d9c08a', 0.95), [0, 1.26, 0], [0.26, 0.12, 0.22]));
  g.add(mesh(G.torus, mat('#8a5a2b', 0.8), [0, 1.08, 0], [0.2, 0.2, 0.5], [Math.PI / 2, 0, 0]));
  // кръгъл етикет отпред
  g.add(mesh(G.cyl, mat(label, 0.6), [0, 0.6, 0.38], [0.26, 0.05, 0.26], [Math.PI / 2, 0, 0]));
  return g;
}

function basket(content: THREE.Object3D) {
  const g = new THREE.Group();
  const b = lathe([[0, 0], [0.55, 0], [0.75, 0.45], [0.72, 0.5], [0.52, 0.06], [0, 0.06]]);
  g.add(mesh(b, mat('#b98546', 0.9)));
  g.add(mesh(G.torus, mat('#9c6a33', 0.9), [0, 0.47, 0], [0.74, 0.74, 0.5], [Math.PI / 2, 0, 0]));
  content.position.y = 0.3;
  g.add(content);
  return g;
}

/** Купичка с ястие (съдържанието се добавя от fill). */
function bowl(color: string, fill: (b: THREE.Group, r: () => number) => void) {
  const g = new THREE.Group();
  g.add(mesh(lathe([[0, 0], [0.32, 0], [0.36, 0.04], [0.62, 0.22], [0.7, 0.38], [0.66, 0.4], [0.58, 0.3], [0, 0.3]], 32), mat(color, 0.35)));
  fill(g, rng(color.length * 7 + 3));
  return g;
}

/** Висока чаша със сок и сламка. */
function glass(fill: string, deco: string, leafy = false) {
  const g = new THREE.Group();
  g.add(mesh(lathe([[0, 0], [0.32, 0], [0.4, 1.0], [0, 1.0]]), mat('#ffffff', 0.05, { transparent: true, opacity: 0.35 })));
  g.add(mesh(lathe([[0, 0.04], [0.3, 0.04], [0.36, 0.82], [0, 0.82]]), mat(fill, 0.2)));
  g.add(mesh(G.cylLo, mat('#e5533d', 0.5), [0.12, 0.95, 0], [0.03, 0.7, 0.03], [0, 0, -0.25]));
  if (leafy) {
    const l = leaf(0.3, 0.12, deco);
    l.position.set(-0.2, 0.86, 0);
    l.rotation.z = 0.8;
    g.add(l);
  } else g.add(mesh(G.sphere, mat(deco, 0.4), [-0.36, 0.92, 0], [0.16, 0.14, 0.08]));
  return g;
}

/** Фунийка сладолед с две топки. */
function cone(cols: string[]) {
  const g = new THREE.Group();
  g.add(mesh(G.cone, mat('#d9a24e', 0.75), [0, 0.45, 0], [0.3, 0.9, 0.3], [Math.PI, 0, 0]));
  for (let i = 0; i < 6; i++) g.add(mesh(G.box, mat('#b5803a', 0.8), [0, 0.5, 0], [0.02, 0.9, 0.5], [0, (i / 6) * Math.PI, 0.32]));
  g.add(mesh(G.sphere, mat(cols[0], 0.5), [0, 1.0, 0], 0.32));
  g.add(mesh(G.sphere, mat(cols[1], 0.5), [0.05, 1.42, 0.02], 0.27));
  g.add(mesh(G.sphere, mat('#c4192a', 0.25), [0.05, 1.73, 0.02], 0.08));
  return g;
}

/** Сапунче с щампа. */
function soap(color: string, stamp: string) {
  const g = new THREE.Group();
  g.add(mesh(roundedBox(0.95, 0.4, 0.65, 0.12), mat(color, 0.5)));
  g.add(mesh(G.cyl, mat(stamp, 0.6), [0, 0.41, 0], [0.2, 0.02, 0.2]));
  g.add(mesh(G.box, mat('#c9a46b', 0.8), [0, 0.2, 0], [0.98, 0.42, 0.12]));
  return g;
}

/** Свещ (с чашка, ако е ароматна). */
function candle(color: string, glassCup: boolean) {
  const g = new THREE.Group();
  g.add(mesh(G.cyl, mat(color, 0.6), [0, 0.45, 0], [0.32, 0.9, 0.32]));
  g.add(mesh(G.cylLo, mat('#3a2a1a', 0.8), [0, 0.96, 0], [0.02, 0.1, 0.02]));
  g.add(mesh(G.sphere, mat('#ffb21e', 0.3, { emissive: '#ff9a1e', emissiveIntensity: 1.2 }), [0, 1.1, 0], [0.07, 0.14, 0.07]));
  if (glassCup) g.add(mesh(lathe([[0, 0], [0.42, 0], [0.44, 0.7], [0, 0.7]]), mat('#ffffff', 0.05, { transparent: true, opacity: 0.3 })));
  return g;
}

/** Чаша чай с листенце. */
function tea(color: string) {
  const g = new THREE.Group();
  g.add(mesh(G.cyl, mat('#ffffff', 0.4), [0, 0.03, 0], [0.7, 0.05, 0.7]));
  g.add(mesh(lathe([[0, 0.05], [0.3, 0.05], [0.45, 0.45], [0.48, 0.55], [0, 0.55]]), mat('#ffffff', 0.3)));
  g.add(mesh(G.cyl, mat(color, 0.2), [0, 0.5, 0], [0.43, 0.04, 0.43]));
  g.add(mesh(G.torus, mat('#ffffff', 0.3), [0.5, 0.32, 0], [0.13, 0.13, 0.6]));
  const l = leaf(0.3, 0.12, '#6cc26a');
  l.position.set(-0.1, 0.55, 0.1);
  l.rotation.x = -1.2;
  g.add(l);
  return g;
}

/** Риба (за пъстървата). */
function fish(body: string, belly: string) {
  const g = new THREE.Group();
  g.add(mesh(G.sphere, mat(body, 0.4), [0, 0.3, 0], [0.7, 0.26, 0.16]));
  g.add(mesh(G.sphere, mat(belly, 0.4), [0, 0.24, 0], [0.62, 0.16, 0.15]));
  g.add(mesh(G.cone, mat(body, 0.5), [-0.78, 0.3, 0], [0.24, 0.3, 0.06], [0, 0, Math.PI / 2]));
  g.add(mesh(G.sphereLo, mat('#1a1a1a', 0.3), [0.5, 0.36, 0.11], 0.04));
  const r = rng(71);
  for (let i = 0; i < 10; i++) g.add(mesh(G.sphereLo, mat('#3a2a1a', 0.6), [(r() - 0.5) * 1.0, 0.36 + r() * 0.1, 0.12], 0.025));
  return g;
}

function wheatStalks(n: number, h: number, ear: string, stem: string) {
  const g = new THREE.Group();
  const r = rng(5);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, rr = 0.12 + r() * 0.12;
    const s = new THREE.Group();
    s.add(mesh(G.cylLo, mat(stem, 0.7), [0, h / 2, 0], [0.025, h, 0.025]));
    s.add(mesh(G.sphereLo, mat(ear, 0.55), [0, h + 0.18, 0], [0.07, 0.22, 0.07]));
    s.position.set(Math.cos(a) * rr * 0.4, 0, Math.sin(a) * rr * 0.4);
    s.rotation.set(Math.sin(a) * 0.25, 0, Math.cos(a) * 0.25);
    g.add(s);
  }
  return g;
}

const builders: Record<string, () => THREE.Object3D> = {
  wheat() {
    const g = wheatStalks(14, 1.3, '#f2c14e', '#e0b04a');
    g.add(mesh(G.torus, mat('#b5651d', 0.8), [0, 0.55, 0], [0.13, 0.13, 0.6], [Math.PI / 2, 0, 0]));
    return g;
  },
  corn() {
    const g = new THREE.Group();
    const cob = lathe([[0, 0], [0.22, 0.05], [0.28, 0.4], [0.26, 0.9], [0.14, 1.25], [0, 1.3]]);
    const c = mesh(cob, mat('#f7c531', 0.45));
    g.add(c);
    // зрънца (точки)
    const r = rng(2);
    for (let i = 0; i < 70; i++) {
      const y = 0.15 + r() * 1.0, a = r() * Math.PI * 2;
      const rad = 0.27 - Math.pow((y - 0.6) / 0.7, 2) * 0.12;
      g.add(mesh(G.sphereLo, mat('#ffd84d', 0.4), [Math.cos(a) * rad, y, Math.sin(a) * rad], 0.06));
    }
    for (let i = 0; i < 3; i++) {
      const l = leaf(1.15, 0.28, '#6fb446');
      l.position.y = 0.05;
      l.rotation.set(0.35, (i / 3) * Math.PI * 2, 0);
      g.add(l);
    }
    g.rotation.z = -0.5;
    return g;
  },
  potato() {
    const g = new THREE.Group();
    const m = mat('#c99a5b', 0.85);
    g.add(mesh(G.sphere, m, [-0.25, 0.32, 0], [0.42, 0.32, 0.34], [0, 0.4, 0.2]));
    g.add(mesh(G.sphere, m, [0.3, 0.3, 0.1], [0.36, 0.3, 0.3], [0, -0.3, -0.1]));
    g.add(mesh(G.sphere, m, [0.02, 0.6, -0.05], [0.34, 0.26, 0.28], [0.2, 0.9, 0]));
    const r = rng(3);
    for (let i = 0; i < 14; i++) g.add(mesh(G.sphereLo, mat('#9e7440', 0.9), [(r() - 0.5) * 0.9, 0.2 + r() * 0.55, 0.25 + r() * 0.08], 0.03));
    return g;
  },
  carrot() {
    const g = new THREE.Group();
    for (let k = 0; k < 2; k++) {
      const c = new THREE.Group();
      c.add(mesh(G.cone, mat('#f28a1d', 0.55), [0, -0.55, 0], [0.2, 1.2, 0.2], [Math.PI, 0, 0]));
      for (let i = 0; i < 4; i++) {
        const l = leaf(0.7, 0.12, '#5fae3c');
        l.rotation.set(0, (i / 4) * Math.PI * 2, (i % 2 ? 0.3 : -0.3));
        c.add(l);
      }
      c.position.set(k ? 0.22 : -0.15, 1.1, k ? 0.1 : -0.05);
      c.rotation.z = k ? -0.5 : 0.35;
      g.add(c);
    }
    return g;
  },
  beet() {
    const g = new THREE.Group();
    g.add(mesh(G.sphere, mat('#8e1f3c', 0.5), [0, 0.45, 0], [0.42, 0.4, 0.42]));
    g.add(mesh(G.cone, mat('#8e1f3c', 0.5), [0, 0.06, 0], [0.12, 0.3, 0.12], [Math.PI, 0, 0]));
    for (let i = 0; i < 5; i++) {
      const l = leaf(0.8, 0.22, i % 2 ? '#5da23a' : '#4f9433');
      l.position.y = 0.8;
      l.rotation.set(0.15, (i / 5) * Math.PI * 2, 0.35);
      g.add(l);
    }
    return g;
  },
  beans() {
    const g = new THREE.Group();
    const r = rng(9);
    // торбичка с фасул (смилянският е бял с червени шарки)
    g.add(mesh(lathe([[0, 0], [0.6, 0], [0.7, 0.3], [0.62, 0.62], [0.55, 0.66], [0, 0.66]]), mat('#e2c28a', 0.95)));
    for (let i = 0; i < 26; i++) {
      const a = r() * Math.PI * 2, rr = r() * 0.5;
      const bm = mesh(G.sphere, mat(r() < 0.5 ? '#f3e9dc' : '#e8c6b0', 0.45), [Math.cos(a) * rr, 0.7 + r() * 0.15, Math.sin(a) * rr], [0.14, 0.09, 0.09], [r() * 3, r() * 3, r() * 3]);
      g.add(bm);
      if (r() < 0.6) g.add(mesh(G.sphereLo, mat('#a8323a', 0.5), [bm.position.x, bm.position.y + 0.05, bm.position.z], [0.06, 0.04, 0.05]));
    }
    return g;
  },
  tomato() {
    const g = new THREE.Group();
    const one = (x: number, z: number, s: number) => {
      const t = new THREE.Group();
      t.add(mesh(G.sphere, mat('#e8392c', 0.35), [0, 0.4, 0], [0.45, 0.38, 0.45]));
      for (let i = 0; i < 5; i++) {
        const l = leaf(0.22, 0.07, '#3f8f2d');
        l.position.y = 0.76;
        l.rotation.set(-1.3, (i / 5) * Math.PI * 2, 0);
        t.add(l);
      }
      t.add(mesh(G.cylLo, mat('#3f8f2d', 0.6), [0, 0.82, 0], [0.03, 0.12, 0.03]));
      t.position.set(x, 0, z);
      t.scale.setScalar(s);
      return t;
    };
    g.add(one(-0.25, 0, 1), one(0.3, 0.1, 0.85));
    return g;
  },
  pepper() {
    const g = new THREE.Group();
    const p = lathe([[0, 0], [0.12, 0.05], [0.28, 0.4], [0.33, 0.8], [0.3, 1.0], [0.12, 1.05], [0, 1.05]]);
    const a = mesh(p, mat('#d8261d', 0.3), [-0.2, 0.2, 0], 1, [0, 0, 0.5]);
    const b = mesh(p, mat('#e7b51e', 0.3), [0.25, 0.15, 0.1], 0.9, [0, 0, -0.3]);
    g.add(a, b);
    g.add(mesh(G.cylLo, mat('#3e8a2a', 0.6), [-0.68, 1.1, 0], [0.05, 0.25, 0.05], [0, 0, 0.5]));
    g.add(mesh(G.cylLo, mat('#3e8a2a', 0.6), [-0.05, 1.05, 0.1], [0.05, 0.22, 0.05], [0, 0, -0.3]));
    return g;
  },
  sunflower() {
    const g = new THREE.Group();
    g.add(mesh(G.cylLo, mat('#5f9c38', 0.7), [0, 0.45, 0], [0.05, 0.9, 0.05]));
    const head = new THREE.Group();
    for (let i = 0; i < 18; i++) {
      const l = leaf(0.45, 0.13, '#ffcc1f');
      l.rotation.z = (i / 18) * Math.PI * 2;
      l.position.z = 0.01;
      head.add(l);
    }
    head.add(mesh(G.cyl, mat('#5b3a1a', 0.9), [0, 0, 0.05], [0.28, 0.08, 0.28], [Math.PI / 2, 0, 0]));
    head.position.y = 1.05;
    head.rotation.x = -0.35;
    g.add(head);
    return g;
  },
  pumpkin() {
    const g = new THREE.Group();
    for (let i = 0; i < 8; i++) g.add(mesh(G.sphere, mat('#f07f1e', 0.5), [Math.cos((i / 8) * 6.28) * 0.18, 0.42, Math.sin((i / 8) * 6.28) * 0.18], [0.36, 0.38, 0.36]));
    g.add(mesh(G.cylLo, mat('#6b4a1f', 0.8), [0, 0.85, 0], [0.06, 0.2, 0.06], [0.2, 0, 0.2]));
    const l = leaf(0.4, 0.2, '#4f9433');
    l.position.set(0.05, 0.82, 0);
    l.rotation.set(-1, 0.5, 0);
    g.add(l);
    return g;
  },
  cabbage() {
    const g = new THREE.Group();
    g.add(mesh(G.sphere, mat('#b8dc7a', 0.6), [0, 0.45, 0], 0.42));
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      g.add(mesh(G.sphere, mat(i % 2 ? '#8fc35a' : '#a2cf68', 0.6), [Math.cos(a) * 0.12, 0.38, Math.sin(a) * 0.12], [0.46, 0.38, 0.46], [Math.cos(a) * 0.5, 0, Math.sin(a) * 0.5]));
    }
    g.add(mesh(G.sphere, mat('#d3eba0', 0.6), [0, 0.62, 0], 0.26));
    return g;
  },
  strawberry() {
    const g = new THREE.Group();
    const one = (x: number, z: number, rz: number) => {
      const s = new THREE.Group();
      s.add(mesh(lathe([[0, 0], [0.12, 0.08], [0.3, 0.45], [0.28, 0.6], [0.12, 0.7], [0, 0.7]]), mat('#e0202f', 0.35)));
      const r = rng(Math.round(x * 100 + 50));
      for (let i = 0; i < 16; i++) {
        const a = r() * 6.28, y = 0.15 + r() * 0.45;
        const rad = 0.08 + y * 0.45;
        s.add(mesh(G.sphereLo, mat('#ffe27a', 0.5), [Math.cos(a) * rad, y, Math.sin(a) * rad], 0.022));
      }
      for (let i = 0; i < 5; i++) {
        const l = leaf(0.2, 0.08, '#3f9a2f');
        l.position.y = 0.68;
        l.rotation.set(-1.2, (i / 5) * 6.28, 0);
        s.add(l);
      }
      s.position.set(x, 0.05, z);
      s.rotation.z = rz;
      return s;
    };
    g.add(one(-0.2, 0, 0.4), one(0.22, 0.1, -0.3));
    return g;
  },
  lavender() {
    const g = new THREE.Group();
    const r = rng(4);
    for (let i = 0; i < 9; i++) {
      const s = new THREE.Group();
      s.add(mesh(G.cylLo, mat('#6f9a4a', 0.7), [0, 0.5, 0], [0.02, 1, 0.02]));
      for (let j = 0; j < 7; j++) s.add(mesh(G.sphereLo, mat(j % 2 ? '#8e6bd1' : '#7a57c2', 0.5), [0, 1.0 + j * 0.06, 0], [0.06, 0.05, 0.06]));
      s.rotation.set((r() - 0.5) * 0.6, 0, (r() - 0.5) * 0.6);
      g.add(s);
    }
    g.add(mesh(G.torus, mat('#e8d7b0', 0.7), [0, 0.45, 0], [0.09, 0.09, 0.8], [Math.PI / 2, 0, 0]));
    return g;
  },
  herbs() {
    const g = new THREE.Group();
    const r = rng(8);
    for (let i = 0; i < 8; i++) {
      const s = new THREE.Group();
      s.add(mesh(G.cylLo, mat('#7a9a55', 0.7), [0, 0.5, 0], [0.02, 1, 0.02]));
      for (let j = 0; j < 6; j++) {
        const l = leaf(0.18, 0.07, '#8cb869');
        l.position.y = 0.4 + j * 0.12;
        l.rotation.set(0.8, j * 2.1, 0);
        s.add(l);
      }
      s.add(mesh(G.sphereLo, mat('#e9e3a0', 0.6), [0, 1.08, 0], [0.07, 0.1, 0.07]));
      s.rotation.set((r() - 0.5) * 0.5, 0, (r() - 0.5) * 0.5);
      g.add(s);
    }
    g.add(mesh(G.torus, mat('#b5651d', 0.8), [0, 0.35, 0], [0.08, 0.08, 0.8], [Math.PI / 2, 0, 0]));
    return g;
  },
  apple() {
    const g = new THREE.Group();
    const one = (x: number, c: string) => {
      const a = new THREE.Group();
      a.add(mesh(lathe([[0, 0.05], [0.25, 0], [0.42, 0.18], [0.46, 0.42], [0.36, 0.66], [0.15, 0.7], [0.04, 0.62], [0, 0.62]]), mat(c, 0.35)));
      a.add(mesh(G.cylLo, mat('#6b4a1f', 0.8), [0, 0.72, 0], [0.025, 0.18, 0.025], [0, 0, 0.3]));
      const l = leaf(0.28, 0.1, '#4f9a33');
      l.position.set(0.04, 0.78, 0);
      l.rotation.set(0, 0, -1.1);
      a.add(l);
      a.position.x = x;
      return a;
    };
    g.add(one(-0.28, '#d9302a'), one(0.3, '#e24a2b'));
    return g;
  },
  plum() {
    const g = new THREE.Group();
    for (let i = 0; i < 3; i++) g.add(mesh(G.sphere, mat('#5b2a7a', 0.3), [(i - 1) * 0.36, 0.32 + (i === 1 ? 0.18 : 0), i === 1 ? -0.1 : 0.05], [0.28, 0.32, 0.26]));
    const l = leaf(0.4, 0.14, '#4f9a33');
    l.position.set(0.1, 0.75, 0);
    l.rotation.z = -0.8;
    g.add(l);
    return g;
  },
  cherry() {
    const g = new THREE.Group();
    g.add(mesh(G.sphere, mat('#b3121f', 0.25), [-0.25, 0.28, 0], 0.28));
    g.add(mesh(G.sphere, mat('#c4192a', 0.25), [0.28, 0.24, 0.05], 0.27));
    const curve = (x: number) => mesh(G.cylLo, mat('#6f8f2c', 0.6), [x * 0.5, 0.75, 0], [0.025, 0.95, 0.025], [0, 0, x * 0.7]);
    g.add(curve(-0.4), curve(0.45));
    const l = leaf(0.4, 0.15, '#4f9a33');
    l.position.set(0, 1.15, 0);
    l.rotation.z = -0.6;
    g.add(l);
    return g;
  },
  walnut() {
    const g = new THREE.Group();
    const m = mat('#a87843', 0.95);
    for (let i = 0; i < 3; i++) {
      const w = mesh(G.sphere, m, [(i - 1) * 0.42, 0.3 + (i === 1 ? 0.25 : 0), i === 1 ? -0.1 : 0.05], [0.32, 0.3, 0.3]);
      g.add(w);
      g.add(mesh(G.torus, mat('#8a5f32', 0.95), w.position.toArray() as [number, number, number], [0.3, 0.3, 0.3], [0, 0, Math.PI / 2]));
    }
    return g;
  },
  egg() {
    const e = new THREE.Group();
    const egg = lathe([[0, 0], [0.18, 0.03], [0.26, 0.18], [0.25, 0.38], [0.16, 0.55], [0, 0.6]]);
    e.add(mesh(egg, mat('#fbeee0', 0.4), [-0.22, 0, 0], 1, [0, 0, 0.25]));
    e.add(mesh(egg, mat('#f3d9b8', 0.4), [0.22, 0, 0.05], 1, [0, 0, -0.2]));
    e.add(mesh(egg, mat('#fff8ef', 0.4), [0, 0.05, -0.2], 0.95));
    return basket(e);
  },
  milk() {
    const g = bottle('#ffffff', '#2f7fd6', 1.5);
    return g;
  },
  goatmilk() {
    const g = new THREE.Group();
    // кана
    g.add(mesh(lathe([[0, 0], [0.4, 0], [0.45, 0.15], [0.42, 0.6], [0.32, 0.9], [0.36, 1.0], [0, 1.0]]), mat('#f4f1ea', 0.35)));
    g.add(mesh(G.torus, mat('#f4f1ea', 0.35), [0.42, 0.55, 0], [0.22, 0.22, 0.8], [0, 0, Math.PI / 2]));
    g.add(mesh(G.cyl, mat('#7ab8e0', 0.6), [0, 0.5, 0], [0.43, 0.15, 0.43]));
    return g;
  },
  wool() {
    const g = new THREE.Group();
    const r = rng(6);
    for (let i = 0; i < 14; i++) g.add(mesh(G.sphere, mat(i % 3 ? '#fbf8f2' : '#efe9de', 0.95), [(r() - 0.5) * 0.7, 0.35 + r() * 0.4, (r() - 0.5) * 0.6], 0.25 + r() * 0.12));
    return g;
  },
  honey() {
    const g = jar('#f0a020', '#c88a2a', '#d9534f');
    g.add(mesh(G.cylLo, mat('#c79a5b', 0.7), [0.35, 1.0, 0], [0.04, 0.9, 0.04], [0, 0, -0.5]));
    g.add(mesh(G.sphereLo, mat('#c79a5b', 0.7), [0.58, 1.38, 0], [0.12, 0.16, 0.12]));
    return g;
  },
  feed_chicken: () => sack('#f2c14e'),
  feed_cow: () => sack('#8a5a2b'),
  feed_sheep: () => sack('#4a90d9'),
  feed_goat: () => sack('#6cbf4a'),
  bread() {
    const g = new THREE.Group();
    g.add(mesh(G.sphere, mat('#c8803a', 0.7), [0, 0.35, 0], [0.75, 0.38, 0.42]));
    for (let i = 0; i < 3; i++) g.add(mesh(G.box, mat('#efcf91', 0.8), [(i - 1) * 0.35, 0.7, 0], [0.08, 0.04, 0.5], [0, 0.5, 0]));
    return g;
  },
  cornbread() {
    const g = new THREE.Group();
    g.add(mesh(roundedBox(1.1, 0.45, 0.7, 0.12), mat('#e8b436', 0.7)));
    g.add(mesh(roundedBox(1.12, 0.12, 0.72, 0.05), mat('#c98a26', 0.75), [0, 0.38, 0]));
    return g;
  },
  banitsa() {
    const g = new THREE.Group();
    // тава
    g.add(mesh(lathe([[0, 0], [0.75, 0], [0.82, 0.2], [0.78, 0.22], [0.7, 0.04], [0, 0.04]], 32), mat('#9aa3ad', 0.35, { metalness: 0.5 })));
    // спирала от кори
    const pts: THREE.Vector3[] = [];
    for (let t = 0; t < 1; t += 0.01) {
      const a = t * Math.PI * 7, rr = 0.08 + t * 0.6;
      pts.push(new THREE.Vector3(Math.cos(a) * rr, 0.14, Math.sin(a) * rr));
    }
    const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 200, 0.065, 8, false);
    g.add(mesh(tube, mat('#e7a94a', 0.6)));
    g.add(mesh(G.cyl, mat('#f3cf86', 0.8), [0, 0.1, 0], [0.7, 0.06, 0.7]));
    return g;
  },
  honeybread() {
    const g = new THREE.Group();
    g.add(mesh(G.sphere, mat('#d99a4e', 0.6), [0, 0.2, 0], [0.75, 0.25, 0.75]));
    g.add(mesh(G.sphere, mat('#f2a51e', 0.15), [0, 0.3, 0], [0.55, 0.16, 0.55]));
    for (let i = 0; i < 6; i++) g.add(mesh(G.sphereLo, mat('#f6d27a', 0.6), [Math.cos(i) * 0.5, 0.36, Math.sin(i) * 0.5], 0.05));
    return g;
  },
  yogurt() {
    const g = new THREE.Group();
    // глинено гърне с родопско мляко
    g.add(mesh(lathe([[0, 0], [0.4, 0], [0.55, 0.3], [0.52, 0.62], [0.45, 0.7], [0.48, 0.76], [0, 0.76]]), mat('#b8643a', 0.85)));
    g.add(mesh(G.cyl, mat('#fffaf0', 0.5), [0, 0.74, 0], [0.43, 0.06, 0.43]));
    g.add(mesh(G.cyl, mat('#e9d9b5', 0.9), [0, 0.35, 0], [0.555, 0.12, 0.555]));
    return g;
  },
  cheese() {
    const g = new THREE.Group();
    g.add(mesh(roundedBox(1.0, 0.55, 0.7, 0.06), mat('#fbf6ea', 0.55)));
    const r = rng(11);
    for (let i = 0; i < 8; i++) g.add(mesh(G.sphereLo, mat('#efe6cf', 0.6), [(r() - 0.5) * 0.8, 0.25 + r() * 0.2, 0.35], 0.04));
    // листо от бурканче (саламура)
    g.add(mesh(G.box, mat('#9fd3e8', 0.2, { transparent: true, opacity: 0.25 }), [0, 0.06, 0], [1.15, 0.12, 0.85]));
    return g;
  },
  butter() {
    const g = new THREE.Group();
    g.add(mesh(G.box, mat('#f4f0e6', 0.7), [0, 0.04, 0], [1.1, 0.06, 0.75]));
    g.add(mesh(roundedBox(0.8, 0.42, 0.5, 0.05), mat('#ffe27a', 0.45), [0, 0.07, 0]));
    return g;
  },
  kashkaval() {
    const g = new THREE.Group();
    const wedge = new THREE.CylinderGeometry(0.75, 0.75, 0.5, 32, 1, false, 0, Math.PI * 1.6);
    g.add(mesh(wedge, mat('#f7c948', 0.45), [0, 0.25, 0]));
    g.add(mesh(new THREE.CylinderGeometry(0.76, 0.76, 0.5, 32, 1, true, 0, Math.PI * 1.6), mat('#e0a92b', 0.5, { side: THREE.DoubleSide }), [0, 0.25, 0]));
    return g;
  },
  sugar() {
    const g = new THREE.Group();
    const r = rng(12);
    g.add(mesh(lathe([[0, 0], [0.62, 0], [0.7, 0.25], [0.68, 0.3], [0, 0.3]]), mat('#5aa9d6', 0.5)));
    for (let i = 0; i < 10; i++) g.add(mesh(roundedBox(0.26, 0.26, 0.26, 0.04), mat('#ffffff', 0.7), [(r() - 0.5) * 0.7, 0.3 + (i > 6 ? 0.25 : 0), (r() - 0.5) * 0.7], 1, [0, r() * 3, 0]));
    return g;
  },
  syrup: () => bottle('#a8551f', '#3b2614', 1.4),
  yarn() {
    const g = new THREE.Group();
    g.add(mesh(G.sphere, mat('#d8453b', 0.9), [0, 0.5, 0], 0.48));
    for (let i = 0; i < 6; i++) g.add(mesh(G.torus, mat('#e8574c', 0.9), [0, 0.5, 0], [0.47, 0.47, 0.25], [i * 0.5, i * 0.9, 0]));
    g.add(mesh(G.cylLo, mat('#c9a46b', 0.7), [0.3, 0.6, 0.35], [0.03, 1.1, 0.03], [0.5, 0, -0.8]));
    return g;
  },
  blanket() {
    const g = new THREE.Group();
    const cols = ['#c4262e', '#f2b134', '#2e6db4', '#c4262e', '#f2b134', '#3d8a3a'];
    for (let i = 0; i < 4; i++) {
      const layer = new THREE.Group();
      cols.forEach((c, j) => layer.add(mesh(G.box, mat(c, 0.95), [(j - 2.5) * 0.18, 0, 0], [0.18, 0.12, 0.9])));
      layer.position.y = 0.08 + i * 0.13;
      g.add(layer);
    }
    g.add(mesh(G.cylLo, mat('#fff2d0', 0.9), [0.58, 0.28, 0], [0.04, 0.55, 0.9], [0, 0, 0]));
    return g;
  },
  socks() {
    const g = new THREE.Group();
    const one = (x: number, c1: string, c2: string) => {
      const s = new THREE.Group();
      for (let i = 0; i < 4; i++) s.add(mesh(G.cyl, mat(i % 2 ? c1 : c2, 0.95), [0, 0.6 + i * 0.16, 0], [0.18, 0.16, 0.18]));
      s.add(mesh(G.cyl, mat(c1, 0.95), [0, 0.4, 0], [0.18, 0.3, 0.18]));
      s.add(mesh(G.sphere, mat(c2, 0.95), [0.12, 0.18, 0], [0.32, 0.17, 0.19]));
      s.position.x = x;
      return s;
    };
    g.add(one(-0.22, '#d8453b', '#f4f0e6'), one(0.24, '#2e6db4', '#f2b134'));
    return g;
  },
  lyutenitsa: () => jar('#c0321f', '#c9c9c9', '#d9534f'),
  pickles() {
    const g = jar('#c8d98a', '#c9c9c9');
    const r = rng(14);
    for (let i = 0; i < 6; i++) g.add(mesh(G.sphere, mat(i % 2 ? '#3f8f2d' : '#e2412a', 0.4), [(r() - 0.5) * 0.4, 0.2 + i * 0.12, 0.3], [0.08, 0.16, 0.08], [0, 0, r()]));
    return g;
  },
  jam: () => jar('#b5122b', '#c9c9c9', '#e8e2d0'),
  oil: () => bottle('#f2c230', '#2f8f3a', 1.5),
  baklava() {
    const g = new THREE.Group();
    g.add(mesh(G.box, mat('#9aa3ad', 0.35, { metalness: 0.5 }), [0, 0.05, 0], [1.3, 0.1, 1.0]));
    for (let i = 0; i < 4; i++)
      for (let j = 0; j < 3; j++) {
        const p = mesh(G.box, mat('#d9a249', 0.55), [(i - 1.5) * 0.3, 0.18, (j - 1) * 0.3], [0.2, 0.16, 0.2], [0, Math.PI / 4, 0]);
        g.add(p);
        g.add(mesh(G.sphereLo, mat('#5f8f3a', 0.6), [p.position.x, 0.27, p.position.z], 0.04));
      }
    return g;
  },
  pumpkinpie() {
    const g = new THREE.Group();
    g.add(mesh(lathe([[0, 0], [0.72, 0], [0.8, 0.2], [0.74, 0.24], [0, 0.24]], 32), mat('#d7a356', 0.7)));
    const pts: THREE.Vector3[] = [];
    for (let t = 0; t < 1; t += 0.01) { const a = t * Math.PI * 6, rr = 0.06 + t * 0.6; pts.push(new THREE.Vector3(Math.cos(a) * rr, 0.26, Math.sin(a) * rr)); }
    g.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 180, 0.06, 8, false), mat('#e9944a', 0.6)));
    return g;
  },
  cake() {
    const g = new THREE.Group();
    g.add(mesh(G.cyl, mat('#fbe6ef', 0.6), [0, 0.3, 0], [0.7, 0.6, 0.7]));
    g.add(mesh(G.cyl, mat('#f4a8c2', 0.6), [0, 0.3, 0], [0.71, 0.1, 0.71]));
    g.add(mesh(G.torus, mat('#ffffff', 0.6), [0, 0.6, 0], [0.62, 0.62, 0.5], [Math.PI / 2, 0, 0]));
    for (let i = 0; i < 6; i++) g.add(mesh(G.sphere, mat('#e0202f', 0.3), [Math.cos(i) * 0.4, 0.7, Math.sin(i) * 0.4], [0.12, 0.14, 0.12]));
    return g;
  },
  tea() {
    const g = new THREE.Group();
    g.add(mesh(G.cyl, mat('#ffffff', 0.4), [0, 0.03, 0], [0.7, 0.05, 0.7]));
    g.add(mesh(lathe([[0, 0.05], [0.3, 0.05], [0.45, 0.45], [0.48, 0.55], [0, 0.55]]), mat('#ffffff', 0.3)));
    g.add(mesh(G.cyl, mat('#c9782f', 0.2), [0, 0.5, 0], [0.43, 0.04, 0.43]));
    g.add(mesh(G.torus, mat('#ffffff', 0.3), [0.5, 0.32, 0], [0.13, 0.13, 0.6], [0, 0, 0]));
    const l = leaf(0.3, 0.1, '#7aa857');
    l.position.set(-0.1, 0.55, 0.1);
    l.rotation.x = -1.2;
    g.add(l);
    return g;
  },
  lavoil() {
    const g = bottle('#9a7ad6', '#4a3a2a', 1.1);
    return g;
  },
  applejuice() {
    const g = new THREE.Group();
    g.add(mesh(lathe([[0, 0], [0.32, 0], [0.4, 1.0], [0, 1.0]]), mat('#ffffff', 0.05, { transparent: true, opacity: 0.35 })));
    g.add(mesh(lathe([[0, 0.04], [0.3, 0.04], [0.36, 0.8], [0, 0.8]]), mat('#f6b62a', 0.2)));
    g.add(mesh(G.sphere, mat('#d9302a', 0.35), [0.42, 0.95, 0], [0.18, 0.16, 0.08]));
    return g;
  },
  compote: () => jar('#6a2a6e', '#c9c9c9', '#d9534f'),

  // ---- нови култури ----
  onion() {
    const g = new THREE.Group();
    const one = (x: number, z: number, c: string, s: number) => {
      const o = new THREE.Group();
      o.add(mesh(lathe([[0, 0], [0.18, 0.04], [0.4, 0.3], [0.38, 0.55], [0.15, 0.82], [0.04, 0.95], [0, 0.95]]), mat(c, 0.45)));
      o.add(mesh(G.cylLo, mat('#7aa857', 0.6), [0, 1.1, 0], [0.03, 0.4, 0.03]));
      o.position.set(x, 0, z);
      o.scale.setScalar(s);
      return o;
    };
    g.add(one(-0.25, 0, '#d9a35a', 1), one(0.3, 0.1, '#a8436a', 0.85));
    return g;
  },
  garlic() {
    const g = new THREE.Group();
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      g.add(mesh(G.sphere, mat(i % 2 ? '#f4efe2' : '#ece3d0', 0.5), [Math.cos(a) * 0.2, 0.38, Math.sin(a) * 0.2], [0.24, 0.36, 0.24], [Math.sin(a) * 0.3, 0, Math.cos(a) * 0.3]));
    }
    g.add(mesh(G.cone, mat('#e8dcc4', 0.6), [0, 0.85, 0], [0.12, 0.35, 0.12]));
    return g;
  },
  cucumber() {
    const g = new THREE.Group();
    const one = (x: number, rz: number) => {
      const c = mesh(G.sphere, mat('#3f7f2a', 0.45), [x, 0.3, 0], [0.2, 0.62, 0.2], [0, 0, rz]);
      return c;
    };
    g.add(one(-0.18, 0.9), one(0.18, -0.6));
    const r = rng(21);
    for (let i = 0; i < 16; i++) g.add(mesh(G.sphereLo, mat('#6fae4a', 0.5), [(r() - 0.5) * 0.9, 0.3 + (r() - 0.5) * 0.2, 0.17], 0.025));
    const fl = mesh(G.cone, mat('#ffd84a', 0.6), [0.5, 0.55, 0], [0.1, 0.12, 0.1], [0, 0, -1.2]);
    g.add(fl);
    return g;
  },
  raspberry() {
    const g = new THREE.Group();
    const one = (x: number, z: number) => {
      const b = new THREE.Group();
      for (let i = 0; i < 22; i++) {
        const y = 0.12 + (i / 22) * 0.45, a = i * 2.4;
        const rad = 0.2 * Math.sin(Math.PI * (0.25 + (i / 22) * 0.7));
        b.add(mesh(G.sphereLo, mat(i % 3 ? '#d7263d' : '#b5172e', 0.35), [Math.cos(a) * rad, y, Math.sin(a) * rad], 0.09));
      }
      b.position.set(x, 0, z);
      return b;
    };
    g.add(one(-0.22, 0), one(0.24, 0.1));
    const l = leaf(0.5, 0.2, '#4f9a33');
    l.position.set(0, 0.55, -0.15);
    l.rotation.set(-0.6, 0, 0.3);
    g.add(l);
    return g;
  },
  blueberry() {
    const g = new THREE.Group();
    g.add(mesh(lathe([[0, 0], [0.55, 0], [0.62, 0.3], [0, 0.3]]), mat('#f4efe2', 0.5)));
    const r = rng(23);
    for (let i = 0; i < 26; i++) {
      const a = r() * 6.28, rr = r() * 0.48;
      g.add(mesh(G.sphere, mat(r() < 0.6 ? '#3b4fa8' : '#2c3a85', 0.3), [Math.cos(a) * rr, 0.36 + r() * 0.12, Math.sin(a) * rr], 0.11));
    }
    return g;
  },
  watermelon() {
    const g = new THREE.Group();
    g.add(mesh(G.sphere, mat('#2f7a2a', 0.4), [-0.15, 0.42, 0], [0.55, 0.42, 0.45]));
    for (let k = 0; k < 6; k++) g.add(mesh(G.torus, mat('#7cc24e', 0.5), [-0.15, 0.42, 0], [0.55, 0.42, 0.06], [0, (k / 6) * Math.PI, 0]));
    // резен
    const slice = new THREE.CylinderGeometry(0.5, 0.5, 0.12, 24, 1, false, 0, Math.PI / 2.5);
    g.add(mesh(slice, mat('#e8394a', 0.5), [0.42, 0.28, 0.25], 1, [Math.PI / 2, 0, 0.2]));
    g.add(mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.125, 24, 1, true, 0, Math.PI / 2.5), mat('#2f7a2a', 0.5, { side: THREE.DoubleSide }), [0.42, 0.28, 0.25], 1, [Math.PI / 2, 0, 0.2]));
    return g;
  },
  melon() {
    const g = new THREE.Group();
    g.add(mesh(G.sphere, mat('#e8c45a', 0.6), [0, 0.42, 0], [0.5, 0.42, 0.42]));
    const r = rng(25);
    for (let i = 0; i < 18; i++) {
      const a = r() * 6.28, y = 0.15 + r() * 0.55;
      g.add(mesh(G.box, mat('#d8b24a', 0.7), [Math.cos(a) * 0.48, y, Math.sin(a) * 0.4], [0.02, 0.2, 0.02], [r(), r(), r()]));
    }
    g.add(mesh(G.cylLo, mat('#6b4a1f', 0.8), [0.48, 0.45, 0], [0.04, 0.12, 0.04], [0, 0, Math.PI / 2]));
    return g;
  },
  eggplant() {
    const g = new THREE.Group();
    const one = (x: number, rz: number, s: number) => {
      const e = new THREE.Group();
      e.add(mesh(lathe([[0, 0], [0.2, 0.06], [0.32, 0.35], [0.26, 0.7], [0.14, 0.95], [0, 1.0]]), mat('#4b1f5c', 0.25)));
      e.add(mesh(G.cone, mat('#4f8a33', 0.6), [0, 1.02, 0], [0.18, 0.18, 0.18], [Math.PI, 0, 0]));
      e.add(mesh(G.cylLo, mat('#4f8a33', 0.6), [0, 1.15, 0], [0.035, 0.15, 0.035]));
      e.position.x = x;
      e.rotation.z = rz;
      e.scale.setScalar(s);
      return e;
    };
    g.add(one(-0.2, 0.35, 1), one(0.25, -0.25, 0.85));
    return g;
  },
  rose() {
    const g = new THREE.Group();
    const one = (x: number, z: number, rz: number, c: string) => {
      const f = new THREE.Group();
      f.add(mesh(G.cylLo, mat('#3f7f2a', 0.6), [0, 0.45, 0], [0.025, 0.9, 0.025]));
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        const pr = i < 4 ? 0.07 : 0.15;
        f.add(mesh(G.sphere, mat(c, 0.45), [Math.cos(a) * pr, 1.0 + (i < 4 ? 0.06 : 0), Math.sin(a) * pr], [0.13, 0.16, 0.08], [0.3, -a, 0]));
      }
      f.add(mesh(G.sphere, mat(c, 0.4), [0, 1.05, 0], [0.1, 0.14, 0.1]));
      const l = leaf(0.25, 0.1, '#4f9a33');
      l.position.y = 0.55;
      l.rotation.set(0, 0, -0.9);
      f.add(l);
      f.position.set(x, 0, z);
      f.rotation.z = rz;
      return f;
    };
    g.add(one(-0.15, 0, 0.25, '#e2457a'), one(0.18, 0.08, -0.2, '#f06a98'), one(0, -0.1, 0, '#c92a5e'));
    return g;
  },
  mint() {
    const g = new THREE.Group();
    const r = rng(27);
    for (let i = 0; i < 6; i++) {
      const s = new THREE.Group();
      s.add(mesh(G.cylLo, mat('#5a8f3a', 0.7), [0, 0.45, 0], [0.02, 0.9, 0.02]));
      for (let j = 0; j < 5; j++) {
        const l = leaf(0.28, 0.13, j % 2 ? '#6cc26a' : '#58b05a');
        l.position.y = 0.3 + j * 0.15;
        l.rotation.set(0.9, j * 1.6, 0);
        s.add(l);
      }
      s.rotation.set((r() - 0.5) * 0.6, 0, (r() - 0.5) * 0.6);
      g.add(s);
    }
    g.add(mesh(G.torus, mat('#8a6a4a', 0.9), [0, 0.3, 0], [0.07, 0.07, 0.5], [Math.PI / 2, 0, 0]));
    return g;
  },
  mushroom() {
    const g = new THREE.Group();
    const one = (x: number, z: number, s: number, c: string) => {
      const m = new THREE.Group();
      m.add(mesh(lathe([[0, 0], [0.16, 0], [0.12, 0.3], [0.13, 0.5], [0, 0.5]]), mat('#f2ead8', 0.6)));
      m.add(mesh(new THREE.SphereGeometry(0.42, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat(c, 0.55), [0, 0.45, 0], [1, 0.7, 1]));
      m.add(mesh(G.cyl, mat('#e8dcc4', 0.8), [0, 0.46, 0], [0.4, 0.02, 0.4]));
      m.position.set(x, 0, z);
      m.scale.setScalar(s);
      return m;
    };
    g.add(one(-0.2, 0, 1, '#8a5a32'), one(0.3, 0.15, 0.7, '#a06a3a'));
    return g;
  },
  saffron() {
    const g = new THREE.Group();
    g.add(mesh(G.cylLo, mat('#5d9c3c', 0.6), [0, 0.3, 0], [0.03, 0.6, 0.03]));
    for (let i = 0; i < 6; i++) {
      const l = leaf(0.55, 0.2, i % 2 ? '#9a6ad8' : '#8a58c8');
      l.position.y = 0.55;
      l.rotation.set(-0.45, (i / 6) * Math.PI * 2, 0);
      g.add(l);
    }
    for (let i = 0; i < 3; i++) g.add(mesh(G.cylLo, mat('#e8401c', 0.5), [Math.cos(i * 2.1) * 0.05, 0.85, Math.sin(i * 2.1) * 0.05], [0.025, 0.4, 0.025], [Math.cos(i * 2.1) * 0.3, 0, Math.sin(i * 2.1) * 0.3]));
    return g;
  },

  // ---- нови плодове ----
  pear() {
    const g = new THREE.Group();
    const one = (x: number, c: string, s: number) => {
      const p = new THREE.Group();
      p.add(mesh(lathe([[0, 0.02], [0.3, 0.05], [0.42, 0.3], [0.32, 0.55], [0.2, 0.75], [0.14, 0.92], [0.04, 0.98], [0, 0.98]]), mat(c, 0.4)));
      p.add(mesh(G.cylLo, mat('#6b4a1f', 0.8), [0, 1.05, 0], [0.025, 0.18, 0.025], [0, 0, 0.3]));
      p.position.x = x;
      p.scale.setScalar(s);
      return p;
    };
    g.add(one(-0.25, '#d9c43a', 1), one(0.3, '#c8b830', 0.85));
    return g;
  },
  peach() {
    const g = new THREE.Group();
    g.add(mesh(G.sphere, mat('#f59a5a', 0.55), [-0.22, 0.38, 0], 0.38));
    g.add(mesh(G.sphere, mat('#e8704a', 0.55), [0.28, 0.33, 0.1], 0.33));
    const l = leaf(0.4, 0.14, '#4f9a33');
    l.position.set(-0.1, 0.72, 0);
    l.rotation.z = -1;
    g.add(l);
    return g;
  },
  apricot() {
    const g = new THREE.Group();
    for (let i = 0; i < 3; i++) g.add(mesh(G.sphere, mat(i === 1 ? '#f08a1e' : '#f5a623', 0.5), [(i - 1) * 0.34, 0.3 + (i === 1 ? 0.18 : 0), i === 1 ? -0.1 : 0.05], 0.28));
    const l = leaf(0.35, 0.13, '#4f9a33');
    l.position.set(0.1, 0.75, 0);
    l.rotation.z = -0.8;
    g.add(l);
    return g;
  },
  quince() {
    const g = new THREE.Group();
    g.add(mesh(lathe([[0, 0.02], [0.3, 0.04], [0.46, 0.3], [0.42, 0.6], [0.24, 0.8], [0.06, 0.86], [0, 0.86]]), mat('#e8c53a', 0.6)));
    g.add(mesh(G.cylLo, mat('#6b4a1f', 0.8), [0, 0.92, 0], [0.03, 0.14, 0.03]));
    const l = leaf(0.4, 0.15, '#4f9a33');
    l.position.set(0.04, 0.95, 0);
    l.rotation.z = -1.1;
    g.add(l);
    return g;
  },
  hazelnut() {
    const g = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * 6.28;
      g.add(mesh(lathe([[0, 0], [0.18, 0.04], [0.24, 0.2], [0.2, 0.38], [0.06, 0.48], [0, 0.48]]), mat('#9a6a3a', 0.6), [Math.cos(a) * 0.3, 0.02, Math.sin(a) * 0.3], 1, [0.3 * Math.sin(a), 0, 0.3 * Math.cos(a)]));
      g.add(mesh(G.sphereLo, mat('#d9c08a', 0.9), [Math.cos(a) * 0.3, 0.05, Math.sin(a) * 0.3], [0.2, 0.06, 0.2]));
    }
    return g;
  },

  // ---- от животни ----
  duckegg() {
    const e = new THREE.Group();
    const egg = lathe([[0, 0], [0.22, 0.04], [0.32, 0.22], [0.3, 0.46], [0.19, 0.66], [0, 0.72]]);
    e.add(mesh(egg, mat('#e9f2ee', 0.4), [-0.25, 0, 0], 1, [0, 0, 0.25]));
    e.add(mesh(egg, mat('#d9ece6', 0.4), [0.25, 0, 0.05], 1, [0, 0, -0.2]));
    return basket(e);
  },
  truffle() {
    const g = new THREE.Group();
    const r = rng(31);
    for (let k = 0; k < 2; k++) {
      const t = new THREE.Group();
      t.add(mesh(new THREE.IcosahedronGeometry(0.32, 1), mat('#3a2a22', 0.95, { flatShading: true }), [0, 0.3, 0], [1, 0.85, 1]));
      for (let i = 0; i < 10; i++) t.add(mesh(G.sphereLo, mat('#4a382c', 0.95), [(r() - 0.5) * 0.5, 0.3 + (r() - 0.5) * 0.4, (r() - 0.5) * 0.5], 0.08));
      t.position.set(k ? 0.32 : -0.22, 0, k ? 0.1 : 0);
      t.scale.setScalar(k ? 0.75 : 1);
      g.add(t);
    }
    return g;
  },
  buffmilk() {
    const g = new THREE.Group();
    g.add(mesh(lathe([[0, 0], [0.45, 0], [0.5, 0.1], [0.5, 1.0], [0.42, 1.08], [0.42, 1.25], [0.48, 1.3], [0, 1.3]]), mat('#b8c2cc', 0.3, { metalness: 0.6 })));
    g.add(mesh(G.torus, mat('#9aa3ad', 0.3, { metalness: 0.6 }), [0, 1.0, 0], [0.5, 0.5, 0.4], [Math.PI / 2, 0, 0]));
    g.add(mesh(G.cyl, mat('#fffaf0', 0.5), [0, 1.27, 0], [0.42, 0.03, 0.42]));
    return g;
  },
  llamawool() {
    const g = new THREE.Group();
    const r = rng(33);
    for (let i = 0; i < 14; i++) g.add(mesh(G.sphere, mat(i % 3 ? '#e8d4b0' : '#d8bf98', 0.95), [(r() - 0.5) * 0.7, 0.35 + r() * 0.4, (r() - 0.5) * 0.6], 0.25 + r() * 0.12));
    g.add(mesh(G.torus, mat('#c4262e', 0.8), [0, 0.5, 0], [0.42, 0.42, 0.4], [Math.PI / 2, 0, 0]));
    return g;
  },
  trout() {
    return fish('#9a8e6a', '#e88a7a');
  },

  // ---- фуражи ----
  feed_duck: () => sack('#5ac8c8'),
  feed_pig: () => sack('#f0a0b0'),
  feed_buffalo: () => sack('#5a4a3a'),
  feed_llama: () => sack('#c8a878'),
  feed_fish: () => sack('#3a7ad8'),

  // ---- нови храни и стоки ----
  goatcheese() {
    const g = new THREE.Group();
    g.add(mesh(G.cyl, mat('#f9f6ee', 0.6), [0, 0.25, 0], [0.6, 0.5, 0.6]));
    g.add(mesh(G.cyl, mat('#e9e2d0', 0.7), [0, 0.51, 0], [0.55, 0.03, 0.55]));
    const l = leaf(0.3, 0.1, '#7aa857');
    l.position.set(0, 0.53, 0);
    l.rotation.x = -1.5;
    g.add(l);
    return g;
  },
  walnutoil: () => bottle('#c8a040', '#6b4a1f', 1.4),
  shopska: () => bowl('#f6f1e6', (b, r) => {
    for (let i = 0; i < 9; i++) b.add(mesh(G.box, mat(i % 3 === 0 ? '#e8392c' : i % 3 === 1 ? '#7cc24e' : '#f6f1e6', 0.5), [(r() - 0.5) * 0.6, 0.36, (r() - 0.5) * 0.6], 0.14, [r(), r(), r()]));
    // настъргано сирене отгоре
    for (let i = 0; i < 14; i++) b.add(mesh(G.box, mat('#ffffff', 0.7), [(r() - 0.5) * 0.4, 0.45 + r() * 0.08, (r() - 0.5) * 0.4], [0.03, 0.03, 0.12], [r() * 3, r() * 3, r() * 3]));
  }),
  tarator: () => bowl('#e8f2f8', (b, r) => {
    b.add(mesh(G.cyl, mat('#f6f8f2', 0.4), [0, 0.32, 0], [0.55, 0.02, 0.55]));
    for (let i = 0; i < 12; i++) b.add(mesh(G.box, mat('#6fae4a', 0.5), [(r() - 0.5) * 0.7, 0.34, (r() - 0.5) * 0.7], [0.08, 0.02, 0.08]));
    for (let i = 0; i < 5; i++) b.add(mesh(G.sphereLo, mat('#a87843', 0.8), [(r() - 0.5) * 0.5, 0.35, (r() - 0.5) * 0.5], 0.05));
  }),
  pearjuice: () => glass('#e8d86a', '#d9c43a'),
  patatnik() {
    const g = new THREE.Group();
    g.add(mesh(lathe([[0, 0], [0.78, 0], [0.85, 0.22], [0.8, 0.24], [0.72, 0.04], [0, 0.04]], 32), mat('#2f2f33', 0.5, { metalness: 0.4 })));
    g.add(mesh(G.cyl, mat('#d99a4e', 0.6), [0, 0.13, 0], [0.74, 0.16, 0.74]));
    const r = rng(41);
    for (let i = 0; i < 12; i++) g.add(mesh(G.sphereLo, mat(r() < 0.5 ? '#b5702e' : '#e8b45a', 0.6), [(r() - 0.5) * 1.1, 0.22, (r() - 0.5) * 1.1], [0.12, 0.04, 0.12]));
    return g;
  },
  kozunak() {
    const g = new THREE.Group();
    // плетен козунак: три извити „въжета“
    for (let k = 0; k < 3; k++) {
      const pts: THREE.Vector3[] = [];
      for (let t = 0; t <= 1; t += 0.05) pts.push(new THREE.Vector3((t - 0.5) * 1.3, 0.25 + Math.sin(t * Math.PI) * 0.05, Math.sin(t * Math.PI * 4 + k * 2.1) * 0.13));
      g.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.17, 10, false), mat('#c97a32', 0.55)));
    }
    const r = rng(43);
    for (let i = 0; i < 18; i++) g.add(mesh(G.sphereLo, mat('#fff8e8', 0.7), [(r() - 0.5) * 1.1, 0.42, (r() - 0.5) * 0.3], 0.03));
    return g;
  },
  icecream: () => cone(['#f4a8c2', '#e0202f']),
  blueice: () => cone(['#8a7ad8', '#3b4fa8']),
  minticecream: () => cone(['#a8e8c0', '#6cc26a']),
  sorbet() {
    const g = new THREE.Group();
    g.add(mesh(lathe([[0, 0], [0.25, 0], [0.08, 0.1], [0.06, 0.4], [0.5, 0.55], [0.55, 0.65], [0, 0.6]]), mat('#ffffff', 0.05, { transparent: true, opacity: 0.4 })));
    g.add(mesh(G.sphere, mat('#f05a6a', 0.5), [0, 0.72, 0], [0.36, 0.25, 0.36]));
    const slice = new THREE.CylinderGeometry(0.3, 0.3, 0.08, 16, 1, false, 0, Math.PI / 2.5);
    g.add(mesh(slice, mat('#e8394a', 0.5), [0.35, 0.75, 0], 1, [Math.PI / 2, 0, 0.6]));
    return g;
  },
  raspcake() {
    const g = new THREE.Group();
    g.add(mesh(G.cyl, mat('#fbe6ef', 0.6), [0, 0.3, 0], [0.7, 0.6, 0.7]));
    g.add(mesh(G.cyl, mat('#d7263d', 0.5), [0, 0.3, 0], [0.71, 0.12, 0.71]));
    for (let i = 0; i < 9; i++) g.add(mesh(G.sphere, mat('#d7263d', 0.35), [Math.cos(i * 0.7) * 0.45, 0.66, Math.sin(i * 0.7) * 0.45], 0.1));
    return g;
  },
  kachamak() {
    return bowl('#b8643a', (b, r) => {
      b.add(mesh(G.sphere, mat('#f2c84a', 0.6), [0, 0.32, 0], [0.55, 0.12, 0.55]));
      for (let i = 0; i < 8; i++) b.add(mesh(G.box, mat('#fffaf0', 0.7), [(r() - 0.5) * 0.5, 0.42, (r() - 0.5) * 0.5], [0.1, 0.05, 0.1], [0, r() * 3, 0]));
      b.add(mesh(G.sphere, mat('#ffe27a', 0.3), [0.05, 0.44, 0.05], [0.14, 0.05, 0.14]));
    });
  },
  bluejam: () => jar('#2c3a85', '#c9c9c9', '#4a90d9'),
  apricotjam: () => jar('#f08a1e', '#c9c9c9', '#e8d0a0'),
  quincejam: () => jar('#e8a83a', '#c9c9c9', '#c4262e'),
  kyopolu: () => jar('#9a4a2a', '#c9c9c9', '#6a2a6e'),
  peachnectar: () => glass('#f5b07a', '#f59a5a'),
  lemonade: () => glass('#f2f0b0', '#58b05a', true),
  muffins() {
    const g = new THREE.Group();
    const one = (x: number, z: number) => {
      const m = new THREE.Group();
      m.add(mesh(lathe([[0, 0], [0.22, 0], [0.3, 0.3], [0, 0.3]]), mat('#5aa9d6', 0.6)));
      m.add(mesh(G.sphere, mat('#d99a4e', 0.65), [0, 0.32, 0], [0.32, 0.22, 0.32]));
      const r = rng(Math.round(x * 100) + 60);
      for (let i = 0; i < 6; i++) m.add(mesh(G.sphereLo, mat('#3b4fa8', 0.4), [(r() - 0.5) * 0.4, 0.4 + r() * 0.08, (r() - 0.5) * 0.4], 0.05));
      m.position.set(x, 0, z);
      return m;
    };
    g.add(one(-0.3, 0), one(0.3, 0.05), one(0, -0.3));
    return g;
  },
  candle: () => candle('#f6e6a0', false),
  aromacandle: () => candle('#c8b0e8', true),
  buffyogurt() {
    const g = new THREE.Group();
    g.add(mesh(lathe([[0, 0], [0.4, 0], [0.55, 0.3], [0.52, 0.62], [0.45, 0.7], [0.48, 0.76], [0, 0.76]]), mat('#5a4a3a', 0.85)));
    g.add(mesh(G.cyl, mat('#fffaf0', 0.5), [0, 0.74, 0], [0.43, 0.06, 0.43]));
    g.add(mesh(G.cyl, mat('#e9d9b5', 0.9), [0, 0.35, 0], [0.555, 0.12, 0.555]));
    return g;
  },
  goatsoap: () => soap('#f6f1e6', '#d9c8a0'),
  lavsoap: () => soap('#b8a0e0', '#8e6bd1'),
  rosesoap: () => soap('#f4a8c2', '#e2457a'),
  imam() {
    const g = new THREE.Group();
    g.add(mesh(G.cyl, mat('#ffffff', 0.4), [0, 0.03, 0], [0.75, 0.05, 0.75]));
    for (let k = 0; k < 2; k++) {
      const e = new THREE.Group();
      e.add(mesh(G.sphere, mat('#4b1f5c', 0.3), [0, 0.18, 0], [0.22, 0.16, 0.5]));
      const r = rng(50 + k);
      for (let i = 0; i < 8; i++) e.add(mesh(G.box, mat(i % 2 ? '#e8392c' : '#f2c84a', 0.5), [(r() - 0.5) * 0.2, 0.32, (r() - 0.5) * 0.6], 0.09));
      e.position.x = k ? 0.25 : -0.25;
      g.add(e);
    }
    return g;
  },
  roseoil: () => bottle('#f06a98', '#c9a046', 1.1),
  rosewater: () => bottle('#fbd6e4', '#f6f1e6', 1.5),
  lokum() {
    const g = new THREE.Group();
    const r = rng(53);
    for (let i = 0; i < 8; i++) g.add(mesh(roundedBox(0.3, 0.3, 0.3, 0.05), mat(i % 2 ? '#f4a8c2' : '#ffffff', 0.7), [((i % 3) - 1) * 0.36, 0.0 + Math.floor(i / 3) * 0.28, (r() - 0.5) * 0.3], 1, [0, r(), 0]));
    return g;
  },
  scarf() {
    const g = new THREE.Group();
    const pts: THREE.Vector3[] = [];
    for (let t = 0; t <= 1; t += 0.05) pts.push(new THREE.Vector3(Math.cos(t * 7) * 0.45 * (1 - t * 0.3), 0.15 + t * 0.5, Math.sin(t * 7) * 0.45 * (1 - t * 0.3)));
    g.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.14, 8, false), mat('#e8d4b0', 0.95), [0, 0, 0], [1, 1, 1]));
    for (let i = 0; i < 4; i++) g.add(mesh(G.box, mat('#c4262e', 0.9), [0.3 + i * 0.06, 0.08, 0.35], [0.04, 0.2, 0.04]));
    return g;
  },
  sweater() {
    const g = new THREE.Group();
    const m = mat('#c4262e', 0.95);
    // изправен пуловер, гледа към нас
    g.add(mesh(roundedBox(0.8, 0.22, 0.9, 0.08), m, [0, 0.1, 0], 1, [Math.PI / 2, 0, 0]));
    g.add(mesh(G.cyl, m, [-0.52, 0.45, 0.1], [0.14, 0.75, 0.12], [0, 0, -0.5]));
    g.add(mesh(G.cyl, m, [0.52, 0.45, 0.1], [0.14, 0.75, 0.12], [0, 0, 0.5]));
    for (let i = 0; i < 3; i++) g.add(mesh(G.box, mat(i % 2 ? '#f2b134' : '#f6f1e6', 0.9), [0, 0.35 + i * 0.16, 0.22], [0.78, 0.07, 0.03]));
    g.add(mesh(G.torus, mat('#a81e26', 0.9), [0, 0.98, 0.1], [0.18, 0.12, 0.5], [Math.PI / 2, 0, 0]));
    return g;
  },
  costume() {
    const g = new THREE.Group();
    // родопски сукман: тъмносиня рокля, бяла риза с ръкави, пъстра престилка и колан
    g.add(mesh(lathe([[0, 0], [0.5, 0], [0.42, 0.6], [0.26, 1.0], [0.2, 1.15], [0, 1.15]]), mat('#2a3a62', 0.9)));
    g.add(mesh(G.sphere, mat('#fffaf0', 0.8), [0, 1.16, 0], [0.26, 0.14, 0.22]));
    g.add(mesh(G.cyl, mat('#fffaf0', 0.8), [-0.3, 0.98, 0], [0.09, 0.42, 0.09], [0, 0, -0.45]));
    g.add(mesh(G.cyl, mat('#fffaf0', 0.8), [0.3, 0.98, 0], [0.09, 0.42, 0.09], [0, 0, 0.45]));
    g.add(mesh(G.cyl, mat('#c4262e', 0.8), [0, 0.78, 0], [0.37, 0.07, 0.37]));
    const cols = ['#c4262e', '#f2b134', '#2e6db4', '#3d8a3a', '#c4262e'];
    cols.forEach((c, i) => {
      const y = 0.12 + i * 0.13;
      const rr = 0.5 - (0.08 / 0.6) * y + 0.03;
      g.add(mesh(G.box, mat(c, 0.9), [0, y, rr], [0.44 - i * 0.03, 0.12, 0.03], [-0.13, 0, 0]));
    });
    return g;
  },
  minttea: () => tea('#7ac87a'),
  saffrontea: () => tea('#e8902a'),
  halva() {
    const g = new THREE.Group();
    g.add(mesh(roundedBox(1.0, 0.45, 0.7, 0.05), mat('#d9c08a', 0.95)));
    const r = rng(57);
    for (let i = 0; i < 20; i++) g.add(mesh(G.box, mat('#c9a86a', 0.95), [(r() - 0.5) * 0.9, 0.46, (r() - 0.5) * 0.6], [0.06, 0.01, 0.02], [0, r() * 3, 0]));
    g.add(mesh(G.box, mat('#ffffff', 0.4), [0.28, 0.25, 0.36], [0.3, 0.2, 0.01]));
    return g;
  },
  jelly() {
    const g = new THREE.Group();
    const cols = ['#d7263d', '#f2b134', '#58b05a', '#8e6bd1', '#f06a98', '#e8902a'];
    const r = rng(59);
    for (let i = 0; i < 9; i++) g.add(mesh(lathe([[0, 0], [0.14, 0], [0.12, 0.18], [0, 0.2]], 12), mat(cols[i % cols.length], 0.15, { transparent: true, opacity: 0.85 }), [(r() - 0.5) * 0.8, 0.02 + (i > 5 ? 0.15 : 0), (r() - 0.5) * 0.6], 1.2));
    return g;
  },
  grilledtrout() {
    const g = new THREE.Group();
    g.add(mesh(G.cyl, mat('#ffffff', 0.4), [0, 0.03, 0], [0.8, 0.05, 0.8]));
    const f = fish('#c8904a', '#a8682a');
    f.position.y = 0.1;
    f.rotation.y = 0.3;
    g.add(f);
    for (let i = 0; i < 4; i++) g.add(mesh(G.box, mat('#3a2a1a', 0.9), [-0.3 + i * 0.2, 0.32, 0], [0.02, 0.02, 0.3]));
    g.add(mesh(G.sphereLo, mat('#f6e05a', 0.4), [0.55, 0.12, 0.3], [0.14, 0.1, 0.1]));
    return g;
  },
  fishsoup: () => bowl('#f6f1e6', (b, r) => {
    b.add(mesh(G.cyl, mat('#e8a83a', 0.4), [0, 0.32, 0], [0.55, 0.02, 0.55]));
    for (let i = 0; i < 8; i++) b.add(mesh(G.box, mat(i % 2 ? '#f28a1d' : '#f6f1e6', 0.5), [(r() - 0.5) * 0.6, 0.34, (r() - 0.5) * 0.6], 0.1, [r(), r(), r()]));
    for (let i = 0; i < 6; i++) b.add(mesh(G.box, mat('#6fae4a', 0.5), [(r() - 0.5) * 0.6, 0.35, (r() - 0.5) * 0.6], [0.06, 0.02, 0.06]));
  }),
  mushsoup: () => bowl('#f6f1e6', (b, r) => {
    b.add(mesh(G.cyl, mat('#c8a070', 0.5), [0, 0.32, 0], [0.55, 0.02, 0.55]));
    for (let i = 0; i < 6; i++) b.add(mesh(new THREE.SphereGeometry(0.1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat('#8a5a32', 0.6), [(r() - 0.5) * 0.6, 0.33, (r() - 0.5) * 0.6], [1, 0.6, 1]));
    b.add(mesh(G.cyl, mat('#fffaf0', 0.5), [0.1, 0.34, 0.1], [0.12, 0.02, 0.12]));
  }),
  truffleoil() {
    const g = bottle('#c8a040', '#3a2a22', 1.3);
    g.add(mesh(new THREE.IcosahedronGeometry(0.18, 1), mat('#3a2a22', 0.95, { flatShading: true }), [0.45, 0.16, 0.2]));
    return g;
  },
  pralines() {
    const g = new THREE.Group();
    g.add(mesh(roundedBox(1.1, 0.12, 0.8, 0.04), mat('#c4262e', 0.6)));
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < 2; j++) {
        g.add(mesh(G.sphere, mat('#5a3420', 0.35), [(i - 1) * 0.32, 0.22, (j - 0.5) * 0.32], [0.13, 0.11, 0.13]));
        g.add(mesh(G.sphereLo, mat('#c9a46b', 0.6), [(i - 1) * 0.32, 0.33, (j - 0.5) * 0.32], 0.04));
      }
    return g;
  },
  trufflepasta() {
    return bowl('#ffffff', (b, r) => {
      for (let i = 0; i < 10; i++) {
        const pts: THREE.Vector3[] = [];
        const a0 = r() * 6.28;
        for (let t = 0; t <= 1; t += 0.1) pts.push(new THREE.Vector3(Math.cos(a0 + t * 5) * (0.1 + t * 0.4), 0.34 + r() * 0.06, Math.sin(a0 + t * 5) * (0.1 + t * 0.4)));
        b.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 20, 0.025, 5, false), mat('#f2d080', 0.5)));
      }
      for (let i = 0; i < 6; i++) b.add(mesh(G.cyl, mat('#3a2a22', 0.8), [(r() - 0.5) * 0.4, 0.43, (r() - 0.5) * 0.4], [0.07, 0.01, 0.07], [r() * 0.5, 0, r() * 0.5]));
    });
  },
  perfume() {
    const g = new THREE.Group();
    g.add(mesh(roundedBox(0.7, 0.8, 0.4, 0.12), mat('#f06a98', 0.05, { transparent: true, opacity: 0.75 })));
    g.add(mesh(G.cyl, mat('#e0b040', 0.3, { metalness: 0.7 }), [0, 0.9, 0], [0.12, 0.2, 0.12]));
    g.add(mesh(G.sphere, mat('#f6c0d6', 0.2), [0, 1.08, 0], 0.14));
    return g;
  },
  saffronoil: () => bottle('#e8902a', '#c9a046', 1.2),
  giftbasket() {
    const inner = new THREE.Group();
    const j = jar('#b5122b', '#c9c9c9', '#e8e2d0');
    j.scale.setScalar(0.45);
    j.position.set(-0.22, 0, 0);
    const h = jar('#f0a020', '#c88a2a', '#d9534f');
    h.scale.setScalar(0.45);
    h.position.set(0.2, 0, 0.05);
    const s = soap('#f6f1e6', '#d9c8a0');
    s.scale.setScalar(0.4);
    s.position.set(0, 0.05, 0.3);
    inner.add(j, h, s);
    const b = basket(inner);
    b.add(mesh(G.torus, mat('#9c6a33', 0.9), [0, 0.5, 0], [0.7, 0.7, 0.6], [0, 0, 0]));
    b.add(mesh(G.sphere, mat('#e2457a', 0.6), [0, 1.2, 0], [0.15, 0.1, 0.15]));
    return b;
  },
  heart() {
    const s = new THREE.Shape();
    s.moveTo(0, -0.6);
    s.bezierCurveTo(-0.9, 0, -0.6, 0.75, 0, 0.35);
    s.bezierCurveTo(0.6, 0.75, 0.9, 0, 0, -0.6);
    const geo = new THREE.ExtrudeGeometry(s, { depth: 0.2, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.08, bevelSegments: 3 });
    geo.center();
    const g = new THREE.Group();
    g.add(mesh(geo, mat('#ef4a6a', 0.3)));
    return g;
  },
  friends() {
    const g = new THREE.Group();
    const person = (x: number, c: string, s: number) => {
      const p = new THREE.Group();
      p.add(mesh(lathe([[0, 0], [0.3, 0], [0.28, 0.4], [0.18, 0.55], [0, 0.55]]), mat(c, 0.6)));
      p.add(mesh(G.sphere, mat('#f2c8a0', 0.6), [0, 0.75, 0], 0.2));
      p.position.x = x;
      p.scale.setScalar(s);
      return p;
    };
    g.add(person(-0.3, '#2f8fdc', 0.9), person(0.3, '#e5533d', 0.9), person(0, '#4fa52c', 1.1));
    return g;
  },
  trophy() {
    const g = new THREE.Group();
    const gold = mat('#ffc928', 0.25, { metalness: 0.6 });
    g.add(mesh(lathe([[0, 0], [0.4, 0], [0.4, 0.1], [0.12, 0.18], [0.08, 0.45], [0.42, 0.6], [0.5, 1.05], [0, 1.0]]), gold));
    g.add(mesh(G.torus, gold, [0.5, 0.82, 0], [0.18, 0.18, 0.5]));
    g.add(mesh(G.torus, gold, [-0.5, 0.82, 0], [0.18, 0.18, 0.5]));
    g.add(mesh(G.box, mat('#7a4a22', 0.8), [0, 0.06, 0], [0.9, 0.12, 0.5]));
    return g;
  },
  globe() {
    const g = new THREE.Group();
    g.add(mesh(G.sphere, mat('#3aa0e8', 0.4), [0, 0.6, 0], 0.55));
    const r = rng(61);
    for (let i = 0; i < 9; i++) {
      const a = r() * 6.28, b = (r() - 0.5) * 2;
      g.add(mesh(G.sphere, mat('#5fb636', 0.6), [Math.cos(a) * Math.cos(b) * 0.5, 0.6 + Math.sin(b) * 0.5, Math.sin(a) * Math.cos(b) * 0.5], [0.18, 0.12, 0.18]));
    }
    return g;
  },

  // ---- общи иконки ----
  coin() {
    const g = new THREE.Group();
    g.add(mesh(G.cyl, mat('#ffcc2e', 0.25, { metalness: 0.6 }), [0, 0, 0], [0.7, 0.16, 0.7], [Math.PI / 2, 0, 0]));
    g.add(mesh(G.cyl, mat('#ffde6b', 0.25, { metalness: 0.6 }), [0, 0, 0.06], [0.55, 0.06, 0.55], [Math.PI / 2, 0, 0]));
    return g;
  },
  diamond() {
    const g = new THREE.Group();
    g.add(mesh(new THREE.OctahedronGeometry(0.6, 0), mat('#4ad7f0', 0.1, { metalness: 0.3, flatShading: true }), [0, 0, 0], [1, 1.2, 1]));
    return g;
  },
  star() {
    const s = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2, rr = i % 2 ? 0.32 : 0.7;
      i ? s.lineTo(Math.cos(a) * rr, -Math.sin(a) * rr) : s.moveTo(Math.cos(a) * rr, -Math.sin(a) * rr);
    }
    const geo = new THREE.ExtrudeGeometry(s, { depth: 0.18, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06, bevelSegments: 2 });
    geo.center();
    const g = new THREE.Group();
    g.add(mesh(geo, mat('#ffc928', 0.3, { metalness: 0.3 })));
    return g;
  },
};

export function hasItemModel(id: string) {
  return id in builders;
}

export function itemModel(id: string): THREE.Object3D {
  const f = builders[id];
  if (!f) return builders.coin();
  return f();
}
