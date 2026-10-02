import * as THREE from 'three';
import { Kit, M, roundedShape, sideExtrude, kitMeshes, bucketMat } from '../engine/kit';
import { RAIL, RAIL_Z, STATIONS } from './layout';
import { rng } from '../engine/noise';
import { sfx } from '../audio/sfx';

// Родопската теснолинейка: релси между два тунела, гари до фермата и в града, парен влак с вагони.

const RAIL_Y = 0.58; // горе на релсата
const GAUGE = 1.1;

// ---------- текстури ----------
function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, repeat = false) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  draw(cv.getContext('2d')!);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function gravelTexture() {
  const r = rng(77);
  return canvasTex(128, 128, (g) => {
    g.fillStyle = '#8a8378';
    g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 1400; i++) {
      const v = 95 + r() * 90;
      g.fillStyle = `rgb(${v},${v - 6},${v - 14})`;
      g.fillRect(r() * 128, r() * 128, 1 + r() * 3, 1 + r() * 3);
    }
  }, true);
}

export function stoneTexture(base = '#9b968c') {
  const r = rng(5);
  return canvasTex(256, 256, (g) => {
    g.fillStyle = '#5d5952';
    g.fillRect(0, 0, 256, 256);
    // зидария от дялан камък
    for (let row = 0; row < 8; row++) {
      let x = row % 2 ? -16 : 0;
      while (x < 256) {
        const w = 26 + r() * 22;
        const c = new THREE.Color(base).offsetHSL(0, 0, (r() - 0.5) * 0.12);
        g.fillStyle = '#' + c.getHexString();
        g.fillRect(x + 2, row * 32 + 2, w - 4, 28);
        x += w;
      }
    }
  }, true);
}

/** Табела с надпис. */
export function signTexture(text: string, bg = '#1f3a5f', fg = '#ffffff', w = 512, h = 96) {
  return canvasTex(w, h, (g) => {
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    g.strokeStyle = fg;
    g.lineWidth = 6;
    g.strokeRect(6, 6, w - 12, h - 12);
    g.fillStyle = fg;
    g.font = `800 ${Math.round(h * 0.52)}px Rubik, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2 + 2, w - 40);
  });
}

function clockTexture() {
  return canvasTex(128, 128, (g) => {
    g.fillStyle = '#fbf7ec';
    g.beginPath(); g.arc(64, 64, 60, 0, 7); g.fill();
    g.strokeStyle = '#222'; g.lineWidth = 6; g.stroke();
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      g.fillStyle = '#222';
      g.fillRect(64 + Math.sin(a) * 48 - 3, 64 - Math.cos(a) * 48 - 3, 6, 6);
    }
    g.lineWidth = 7; g.beginPath(); g.moveTo(64, 64); g.lineTo(64, 30); g.stroke();
    g.lineWidth = 5; g.beginPath(); g.moveTo(64, 64); g.lineTo(92, 74); g.stroke();
  });
}

// ---------- релси и тунели ----------
function buildTrack(quality: string) {
  const root = new THREE.Group();
  root.name = 'railway';
  const x0 = RAIL.west - 6, x1 = RAIL.east + 6, L = x1 - x0, cx = (x0 + x1) / 2;
  // насип от чакъл (трапец)
  const sh = new THREE.Shape([new THREE.Vector2(-2.0, 0), new THREE.Vector2(2.0, 0), new THREE.Vector2(1.25, 0.32), new THREE.Vector2(-1.25, 0.32)]);
  const bal = new THREE.ExtrudeGeometry(sh, { depth: L, bevelEnabled: false });
  bal.translate(0, 0.02, -L / 2);
  bal.rotateY(Math.PI / 2);
  bal.translate(cx, 0, RAIL_Z);
  const uv = bal.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.4, uv.getY(i) * 0.4);
  const gt = gravelTexture();
  const ballast = new THREE.Mesh(bal, new THREE.MeshStandardMaterial({ map: gt, roughness: 1, color: '#d8d2c6' }));
  ballast.receiveShadow = true;
  root.add(ballast);
  // траверси
  const step = quality === 'low' ? 1.0 : 0.75;
  const n = Math.floor(L / step);
  const sleepers = new THREE.InstancedMesh(new THREE.BoxGeometry(0.24, 0.14, 2.1), new THREE.MeshStandardMaterial({ color: '#5b4632', roughness: 0.95 }), n);
  const m = new THREE.Matrix4();
  for (let i = 0; i < n; i++) sleepers.setMatrixAt(i, m.makeTranslation(x0 + i * step, 0.38, RAIL_Z));
  sleepers.receiveShadow = true;
  sleepers.computeBoundingSphere();
  root.add(sleepers);
  // релсите
  const steel = new THREE.MeshStandardMaterial({ color: '#b7b9bb', roughness: 0.32, metalness: 0.75 });
  for (const s of [-1, 1]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(L, 0.13, 0.09), steel);
    rail.position.set(cx, RAIL_Y - 0.065, RAIL_Z + (s * GAUGE) / 2);
    rail.castShadow = true;
    root.add(rail);
  }
  root.add(portal(RAIL.west, 1), portal(RAIL.east, -1));
  return root;
}

/** Каменен портал на тунел; face = +1 гледа на изток. */
function portal(x: number, face: number) {
  const g = new THREE.Group();
  const W = 34, H = 15, aw = 3.1, ah = 4.2;
  const s = new THREE.Shape([new THREE.Vector2(-W / 2, -1), new THREE.Vector2(W / 2, -1), new THREE.Vector2(W / 2 - 4, H), new THREE.Vector2(-W / 2 + 4, H)]);
  const hole = new THREE.Path();
  hole.moveTo(-aw, -1);
  hole.lineTo(aw, -1);
  hole.lineTo(aw, ah);
  hole.absarc(0, ah, aw, 0, Math.PI, false);
  hole.lineTo(-aw, -1);
  s.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(s, { depth: 2.2, bevelEnabled: true, bevelThickness: 0.2, bevelSize: 0.2, bevelSegments: 2 });
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 8, uv.getY(i) / 8);
  const tex = stoneTexture();
  const wall = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
  wall.castShadow = true;
  wall.receiveShadow = true;
  // профилът е в равнината z-y на света: x на формата → z, дълбочината → навътре в планината
  wall.rotation.y = face > 0 ? -Math.PI / 2 : Math.PI / 2;
  wall.position.set(x - face * 0.2, 0, RAIL_Z);
  g.add(wall);
  // корниз и ключов камък
  const cap = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.6, W - 7), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, color: '#d8d4cc' }));
  cap.position.set(x - face * 1.0, H + 0.2, RAIL_Z);
  g.add(cap);
  // тъмнината вътре — влакът изчезва в нея
  const dark = new THREE.MeshBasicMaterial({ color: '#070707' });
  const tube = new THREE.Mesh(new THREE.BoxGeometry(8, ah + aw + 1, aw * 2 + 0.4), new THREE.MeshBasicMaterial({ color: '#0d0d0d', side: THREE.BackSide }));
  tube.position.set(x - face * 4.5, (ah + aw) / 2, RAIL_Z);
  g.add(tube);
  const curtainS = new THREE.Shape();
  curtainS.moveTo(-aw - 0.3, -0.5);
  curtainS.lineTo(aw + 0.3, -0.5);
  curtainS.lineTo(aw + 0.3, ah);
  curtainS.absarc(0, ah, aw + 0.3, 0, Math.PI, false);
  curtainS.lineTo(-aw - 0.3, -0.5);
  const curtain = new THREE.Mesh(new THREE.ShapeGeometry(curtainS), dark);
  curtain.rotation.y = face > 0 ? Math.PI / 2 : -Math.PI / 2;
  curtain.position.set(x - face * 7.5, 0, RAIL_Z);
  g.add(curtain);
  return g;
}

// ---------- гари ----------
function station(x: number, name: string, city: boolean) {
  const k = new Kit();
  const pz = RAIL_Z + 3.3; // перонът е откъм юг
  const len = city ? 64 : 44;
  // перон
  k.box('trim', len, 0.55, 3.6, '#b9b4aa', 0, 0.28, pz - RAIL_Z, 0.04);
  k.box('trim', len, 0.06, 0.25, '#f2d24b', 0, 0.58, pz - RAIL_Z - 1.6);
  // сградата
  const bz = pz - RAIL_Z + 7.2;
  const bw = city ? 34 : 14, bd = city ? 10 : 7, bh = city ? 8.4 : 4.6;
  const wall = city ? '#e8d9b5' : '#e9c77b';
  k.box('trim', bw, bh, bd, wall, 0, bh / 2, bz, 0.05);
  k.box('trim', bw + 0.3, 0.5, bd + 0.3, '#f6f1e4', 0, 0.25, bz);
  k.box('trim', bw + 0.4, 0.25, bd + 0.4, '#f6f1e4', 0, bh, bz);
  // покрив на четири ската
  const roof = new THREE.ConeGeometry(1, 1, 4, 1);
  roof.rotateY(Math.PI / 4);
  k.add('trim', roof, '#b5482e', M.at(0, bh + 1.7, bz, 0, 0, 0, (bw + 1.6) * 0.7071, 3.4, (bd + 1.6) * 0.7071));
  // прозорци и врати от двете страни (към перона и към фермата)
  const floors = city ? 2 : 1;
  const nwin = city ? 9 : 4;
  for (const side of [-1, 1]) {
    const fz = bz + side * (bd / 2 + 0.03);
    for (let f = 0; f < floors; f++) {
      const y = 1.6 + f * 3.8;
      for (let i = 0; i < nwin; i++) {
        const wx = -bw / 2 + (bw / nwin) * (i + 0.5);
        const door = f === 0 && (city ? i % 4 === 0 : i === 1);
        const hh = door ? 2.6 : 1.7;
        k.box('trim', door ? 1.6 : 1.3, hh + 0.25, 0.1, '#f6f1e4', wx, door ? 1.35 : y + 0.5, fz);
        k.box('glass', door ? 1.2 : 0.95, hh, 0.1, door ? '#5a3a22' : '#2a3a48', wx, door ? 1.3 : y + 0.5, fz + side * 0.04);
        if (!door) k.box('trim', 1.15, 0.08, 0.06, '#f6f1e4', wx, y + 0.5, fz + side * 0.06);
      }
    }
  }
  // комин
  k.box('trim', 0.7, 2.2, 0.7, '#c06a4a', bw * 0.25, bh + 2.2, bz + 1, 0.03);
  // навес над перона (само пред сградата — да не крие влака)
  const cl = city ? 30 : 12;
  for (let i = 0; i < 4; i++) k.box('trim', 0.16, 3.4, 0.16, '#3f4a4f', -cl / 2 + 1 + i * ((cl - 2) / 3), 2.25, pz - RAIL_Z + 1.2);
  k.box('trim', cl, 0.14, 3.0, '#7b8a8f', 0, 4.0, pz - RAIL_Z + 1.6, 0, [-0.08, 0, 0]);
  // пейки
  for (const bx of city ? [-20, -8, 8, 20] : [-12, 12]) {
    k.box('trim', 2.2, 0.08, 0.5, '#8b5a33', bx, 1.05, pz - RAIL_Z + 1.0);
    k.box('trim', 2.2, 0.45, 0.07, '#8b5a33', bx, 1.35, pz - RAIL_Z + 1.25);
    k.box('trim', 0.1, 0.45, 0.4, '#333', bx - 0.9, 0.8, pz - RAIL_Z + 1.0);
    k.box('trim', 0.1, 0.45, 0.4, '#333', bx + 0.9, 0.8, pz - RAIL_Z + 1.0);
  }
  if (city) {
    // часовникова кула в средата
    k.box('trim', 6, 6, 6, wall, 0, bh + 3, bz, 0.05);
    k.box('trim', 6.6, 0.4, 6.6, '#f6f1e4', 0, bh + 6.2, bz);
    const tr = new THREE.ConeGeometry(1, 1, 4, 1);
    tr.rotateY(Math.PI / 4);
    k.add('trim', tr, '#3f6b5a', M.at(0, bh + 8.2, bz, 0, 0, 0, 5.2, 4, 5.2));
  }
  const g = kitMeshes(k);
  g.position.set(x, 0, RAIL_Z);
  // табела с името
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(city ? 12 : 6.4, city ? 1.4 : 1.2), new THREE.MeshStandardMaterial({ map: signTexture(name), roughness: 0.6 }));
  sign.rotation.y = Math.PI;
  sign.position.set(0, city ? bh - 1.1 : bh - 0.9, bz - bd / 2 - 0.1);
  g.add(sign);
  const back = sign.clone();
  back.rotation.y = 0;
  back.position.z = bz + bd / 2 + 0.1;
  g.add(back);
  if (city) {
    const clockMat = new THREE.MeshStandardMaterial({ map: clockTexture(), roughness: 0.5 });
    for (const [rx, px, pz2] of [[Math.PI, 0, bz - 3.05], [0, 0, bz + 3.05]] as const) {
      const c = new THREE.Mesh(new THREE.CircleGeometry(1.5, 28), clockMat);
      c.rotation.y = rx;
      c.position.set(px, bh + 3.2, pz2);
      g.add(c);
    }
  }
  return g;
}

// ---------- влакът ----------
interface Car { obj: THREE.Group; len: number; wheels: THREE.Mesh[]; rods?: { m: THREE.Mesh; y: number; z: number }[]; chimney?: THREE.Vector3 }

function wheelPair(r: number, color: string, spokes = false) {
  const k = new Kit();
  for (const s of [-1, 1]) {
    k.cyl('w', r, 0.12, color, M.at((s * GAUGE) / 2, 0, 0, 0, 0, Math.PI / 2), 20);
    k.cyl('w', r * 1.08, 0.04, '#2b2b2b', M.at((s * GAUGE) / 2 - s * 0.06, 0, 0, 0, 0, Math.PI / 2), 20);
    k.cyl('w', r * 0.25, 0.16, '#d6d6d6', M.at((s * GAUGE) / 2 + s * 0.02, 0, 0, 0, 0, Math.PI / 2), 10);
    if (spokes) for (let i = 0; i < 4; i++) k.box('w', 0.03, r * 1.7, 0.06, '#7a1c16', (s * GAUGE) / 2 + s * 0.065, 0, 0, 0, [(i * Math.PI) / 4, 0, 0]);
  }
  k.cyl('w', 0.07, GAUGE, '#333', M.at(0, 0, 0, 0, 0, Math.PI / 2), 8);
  return k.merged('w')!;
}

function locomotive(): Car {
  const k = new Kit();
  const black = '#1e1f21', green = '#24513b', red = '#b3261e', brass = '#c9a24a';
  // рама и буфери
  k.box('trim', 1.7, 0.35, 7.6, black, 0, 1.0, 0.1, 0.03);
  k.box('trim', 2.3, 0.45, 0.18, red, 0, 1.0, 3.9);
  k.box('trim', 2.3, 0.45, 0.18, red, 0, 1.0, -3.7);
  for (const s of [-1, 1]) {
    k.cyl('chrome', 0.13, 0.35, '#fff', M.at(s * 0.75, 1.0, 4.1, Math.PI / 2), 12);
    k.cyl('chrome', 0.13, 0.35, '#fff', M.at(s * 0.75, 1.0, -3.9, Math.PI / 2), 12);
    // цилиндри на парната машина
    k.cyl('trim', 0.28, 1.0, black, M.at(s * 1.0, 0.95, 2.7, Math.PI / 2), 14);
    // стълби и перила
    k.box('trim', 0.05, 0.05, 3.6, '#c8c8c8', s * 0.82, 2.25, 1.2);
  }
  // котел
  k.cyl('paint', 0.78, 4.2, green, M.at(0, 2.0, 1.2, Math.PI / 2), 28);
  for (const z of [-0.6, 0.6, 1.8, 3.0]) k.cyl('chrome', 0.8, 0.07, brass, M.at(0, 2.0, z, Math.PI / 2), 28);
  k.cyl('trim', 0.82, 0.9, black, M.at(0, 2.0, 3.5, Math.PI / 2), 28); // димна кутия
  k.cyl('trim', 0.62, 0.06, '#2b2b2b', M.at(0, 2.0, 3.97, Math.PI / 2), 24);
  k.cyl('chrome', 0.1, 0.1, brass, M.at(0, 2.0, 4.02, Math.PI / 2), 10);
  // комин, купол за пара, пясъчник
  k.cyl('trim', 0.3, 1.1, black, M.at(0, 3.15, 3.35), 18, 0.22);
  k.cyl('trim', 0.36, 0.16, black, M.at(0, 3.72, 3.35), 18);
  k.cyl('chrome', 0.32, 0.45, brass, M.at(0, 2.9, 1.7), 18);
  k.add('chrome', new THREE.SphereGeometry(0.32, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), brass, M.at(0, 3.12, 1.7));
  k.cyl('paint', 0.28, 0.4, green, M.at(0, 2.85, 0.4), 16);
  k.add('paint', new THREE.SphereGeometry(0.28, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), green, M.at(0, 3.05, 0.4));
  k.cyl('chrome', 0.05, 0.4, brass, M.at(0.3, 3.0, -0.4), 8); // свирка
  // кабина
  const cab = roundedShape([[-2.75, 1.15], [-0.85, 1.15], [-0.85, 3.4], [-1.0, 3.62, 0.3], [-2.6, 3.62, 0.3], [-2.75, 3.4]]);
  for (const [z0, z1] of [[-2.55, -1.95], [-1.65, -1.05]]) cab.holes.push(new THREE.Path([new THREE.Vector2(z0, 2.35), new THREE.Vector2(z1, 2.35), new THREE.Vector2(z1, 3.2), new THREE.Vector2(z0, 3.2)]));
  k.add('paint', sideExtrude(cab, 2.2, 0.05), green);
  k.add('glass', sideExtrude(roundedShape([[-2.6, 2.3], [-1.0, 2.3], [-1.0, 3.25], [-2.6, 3.25]]), 2.0, 0), '#2a3a48');
  k.box('trim', 2.45, 0.12, 2.15, black, 0, 3.72, -1.8, 0.04);
  k.box('trim', 2.25, 0.2, 2.0, red, 0, 1.3, -1.8);
  // тендер с въглища
  k.box('paint', 2.1, 1.25, 1.3, green, 0, 1.85, -3.0, 0.05);
  k.add('trim', new THREE.IcosahedronGeometry(0.75, 0), '#101010', M.at(0, 2.55, -3.0, 0, 0, 0, 1.25, 0.35, 0.8));
  // фар и звезда отпред
  k.cyl('head', 0.17, 0.25, '#fff', M.at(0, 3.05, 3.98, Math.PI / 2), 16);
  k.cyl('trim', 0.21, 0.3, black, M.at(0, 3.05, 3.88, Math.PI / 2), 16);
  for (const s of [-1, 1]) k.cyl('tail', 0.07, 0.08, '#fff', M.at(s * 0.85, 1.35, -3.8, Math.PI / 2), 10);
  const obj = kitMeshes(k, green);
  const wheels: THREE.Mesh[] = [];
  const addW = (r: number, z: number, color: string, spokes: boolean) => {
    const w = new THREE.Mesh(wheelPair(r, color, spokes), bucketMat('trim'));
    w.position.set(0, r, z);
    w.userData.r = r;
    w.castShadow = true;
    obj.add(w);
    wheels.push(w);
  };
  addW(0.36, 3.1, red, false);
  for (const z of [1.75, 0.55, -0.65]) addW(0.55, z, red, true);
  addW(0.36, -2.6, red, false);
  // свързващи пръти между големите колела
  const rods: Car['rods'] = [];
  for (const s of [-1, 1]) {
    const rod = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.09, 2.6), bucketMat('chrome'));
    rod.position.set(s * (GAUGE / 2 + 0.12), 0.55, 0.55);
    obj.add(rod);
    rods.push({ m: rod, y: 0.55, z: 0.55 });
  }
  return { obj, len: 8.2, wheels, rods, chimney: new THREE.Vector3(0, 3.9, 3.35) };
}

function bogies(obj: THREE.Group, zs: number[], wheels: THREE.Mesh[]) {
  const k = new Kit();
  for (const z of zs) {
    k.box('trim', 1.6, 0.3, 2.2, '#222', 0, 0.75, z, 0.03);
    for (const s of [-1, 1]) k.box('trim', 0.12, 0.22, 2.0, '#2d2d2d', s * (GAUGE / 2 + 0.1), 0.42, z);
  }
  obj.add(kitMeshes(k));
  for (const z of zs) for (const dz of [-0.65, 0.65]) {
    const w = new THREE.Mesh(wheelPair(0.36, '#3a3a3a'), bucketMat('trim'));
    w.position.set(0, 0.36, z + dz);
    w.userData.r = 0.36;
    obj.add(w);
    wheels.push(w);
  }
}

function passengerCar(color: string): Car {
  const k = new Kit();
  const L = 9.6, W = 2.35, yb = 1.05, yt = 2.95;
  const sh = roundedShape([[-L / 2, yb], [L / 2, yb], [L / 2, yt], [-L / 2, yt]]);
  const n = 6;
  for (let i = 0; i < n; i++) {
    const z0 = -L / 2 + 0.9 + i * ((L - 1.8) / n) + 0.15, z1 = z0 + (L - 1.8) / n - 0.3;
    sh.holes.push(new THREE.Path([new THREE.Vector2(z0, 1.85), new THREE.Vector2(z1, 1.85), new THREE.Vector2(z1, 2.6), new THREE.Vector2(z0, 2.6)]));
  }
  k.add('paint', sideExtrude(sh, W, 0.05), color);
  k.add('glass', sideExtrude(roundedShape([[-L / 2 + 0.2, 1.8], [L / 2 - 0.2, 1.8], [L / 2 - 0.2, 2.65], [-L / 2 + 0.2, 2.65]]), W - 0.12, 0), '#2a3a48');
  // крем ивица под прозорците и покрив
  for (const s of [-1, 1]) k.box('trim', 0.03, 0.18, L - 0.1, '#efe4c8', s * (W / 2 + 0.04), 1.65, 0);
  const rs = new THREE.Shape();
  rs.moveTo(-W / 2 - 0.08, 0);
  rs.quadraticCurveTo(0, 0.75, W / 2 + 0.08, 0);
  rs.lineTo(-W / 2 - 0.08, 0);
  const roof = new THREE.ExtrudeGeometry(rs, { depth: L + 0.3, bevelEnabled: false, curveSegments: 10 });
  roof.translate(0, yt, -(L + 0.3) / 2);
  k.add('trim', roof, '#4a4d50');
  // площадки с перила в краищата
  for (const s of [-1, 1]) {
    k.box('trim', W - 0.2, 0.12, 0.8, '#2b2b2b', 0, 1.0, s * (L / 2 + 0.4));
    k.box('trim', W - 0.2, 0.05, 0.05, '#c8c8c8', 0, 1.9, s * (L / 2 + 0.78));
    for (const x of [-1, 1]) k.box('trim', 0.05, 0.9, 0.05, '#c8c8c8', x * (W / 2 - 0.15), 1.45, s * (L / 2 + 0.78));
    k.box('trim', 0.6, 0.05, 0.3, '#2b2b2b', s * 0, 0.7, s * (L / 2 + 0.6));
  }
  k.box('trim', 1.8, 0.25, L, '#262626', 0, 0.98, 0);
  for (const s of [-1, 1]) k.cyl('tail', 0.06, 0.06, '#fff', M.at(s * 0.9, 1.25, -L / 2 - 0.85, Math.PI / 2), 8);
  const obj = kitMeshes(k, color);
  const wheels: THREE.Mesh[] = [];
  bogies(obj, [-3.3, 3.3], wheels);
  return { obj, len: L + 1.8, wheels };
}

function freightCar(kind: 'logs' | 'tank' | 'box'): Car {
  const k = new Kit();
  const L = 8.4;
  k.box('trim', 2.3, 0.3, L, '#3b2f27', 0, 1.1, 0, 0.03);
  if (kind === 'logs') {
    for (let row = 0; row < 3; row++) for (let i = 0; i < 4 - row; i++) {
      const x = -0.75 + i * 0.5 + row * 0.25;
      k.cyl('trim', 0.25, L - 0.6, row % 2 ? '#8a5a35' : '#7a4e2c', M.at(x, 1.5 + row * 0.42, 0, Math.PI / 2), 10);
    }
    for (const z of [-3.2, 0, 3.2]) for (const s of [-1, 1]) k.box('trim', 0.1, 1.4, 0.1, '#2b2b2b', s * 1.08, 1.9, z);
  } else if (kind === 'tank') {
    k.cyl('paint', 1.05, L - 1.2, '#2e2e30', M.at(0, 2.3, 0, Math.PI / 2), 24);
    for (const s of [-1, 1]) k.add('paint', new THREE.SphereGeometry(1.05, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), '#2e2e30', M.at(0, 2.3, s * (L / 2 - 0.6), (s * Math.PI) / 2, 0, 0, 1, 0.35, 1));
    k.cyl('trim', 0.3, 0.3, '#2e2e30', M.at(0, 3.4, 0), 12);
    k.box('trim', 0.05, 0.05, L - 1.5, '#c8c8c8', 0.9, 3.0, 0);
  } else {
    k.box('paint', 2.3, 2.1, L - 0.3, '#8c3a2b', 0, 2.3, 0, 0.04);
    for (let i = 0; i < 9; i++) for (const s of [-1, 1]) k.box('trim', 0.04, 2.0, 0.06, '#5c2419', s * 1.17, 2.3, -L / 2 + 0.5 + i * ((L - 1) / 8));
    k.box('trim', 2.45, 0.12, L - 0.1, '#55595c', 0, 3.4, 0, 0.04);
    for (const s of [-1, 1]) k.box('trim', 0.05, 1.7, 1.8, '#6e2a1f', s * 1.19, 2.2, 0);
  }
  const obj = kitMeshes(k, kind === 'box' ? '#8c3a2b' : '#2e2e30');
  const wheels: THREE.Mesh[] = [];
  bogies(obj, [-2.8, 2.8], wheels);
  return { obj, len: L + 1.0, wheels };
}

/** Пушек от комина. */
class Smoke {
  pool: { s: THREE.Sprite; v: THREE.Vector3; life: number; max: number }[] = [];
  next = 0;
  constructor(public parent: THREE.Object3D, n: number) {
    const tex = canvasTex(64, 64, (g) => {
      const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(255,255,255,1)');
      gr.addColorStop(0.5, 'rgba(240,240,240,0.55)');
      gr.addColorStop(1, 'rgba(230,230,230,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, 64, 64);
    });
    for (let i = 0; i < n; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0, color: '#eceae6' }));
      s.visible = false;
      parent.add(s);
      this.pool.push({ s, v: new THREE.Vector3(), life: 1, max: 1 });
    }
  }
  emit(p: THREE.Vector3, vx: number, dark = false) {
    const it = this.pool[this.next];
    this.next = (this.next + 1) % this.pool.length;
    it.s.position.copy(p);
    it.v.set(vx * 0.35 + (Math.random() - 0.5) * 0.6, 2.4 + Math.random() * 0.8, (Math.random() - 0.5) * 0.6);
    it.life = 0;
    it.max = 2.2 + Math.random() * 1.2;
    (it.s.material as THREE.SpriteMaterial).color.set(dark ? '#9a9894' : '#eceae6');
    it.s.visible = true;
  }
  update(dt: number) {
    for (const p of this.pool) {
      if (!p.s.visible) continue;
      p.life += dt;
      const k = p.life / p.max;
      if (k >= 1) { p.s.visible = false; continue; }
      p.v.y *= Math.pow(0.6, dt);
      p.s.position.addScaledVector(p.v, dt);
      p.s.scale.setScalar(0.9 + k * 4.5);
      (p.s.material as THREE.SpriteMaterial).opacity = (1 - k) * 0.75;
    }
  }
}

export class Railway {
  group = new THREE.Group();
  cars: Car[] = [];
  dir = 1;
  head = RAIL.west - 30; // x на предния край на влака
  speed = 0;
  vmax = 13;
  state: 'run' | 'stop' | 'hidden' = 'hidden';
  wait = 4;
  stopsLeft: number[] = [];
  trip = 0;
  smoke: Smoke;
  smokeT = 0;
  whistled = false;
  onWhistle: (x: number) => void = () => {};

  constructor(public scene: THREE.Scene, quality: string) {
    this.group.name = 'train';
    scene.add(buildTrack(quality));
    for (const st of STATIONS) scene.add(station(st.x, st.name, st.city));
    scene.add(this.group);
    this.smoke = new Smoke(scene, quality === 'low' ? 18 : 34);
    this.compose(true);
  }

  get length() {
    return this.cars.reduce((a, c) => a + c.len, 0);
  }

  /** Сглобява влака: пътнически или товарен (редуват се). */
  compose(passenger: boolean) {
    for (const c of this.cars) this.group.remove(c.obj);
    const loco = locomotive();
    const list: Car[] = [loco];
    if (passenger) {
      const cols = ['#2f6b4f', '#2f6b4f', '#8e2f28', '#2f6b4f'];
      for (const c of cols) list.push(passengerCar(c));
    } else {
      for (const k of ['logs', 'box', 'tank', 'logs', 'box'] as const) list.push(freightCar(k));
    }
    this.cars = list;
    for (const c of list) this.group.add(c.obj);
  }

  private startTrip() {
    this.trip++;
    this.dir = this.trip % 2 ? 1 : -1;
    this.compose(this.trip % 3 !== 0);
    const L = this.length;
    // тръгваме от тъмното на тунела
    this.head = this.dir > 0 ? RAIL.west - 12 : RAIL.east + 12;
    const stops = STATIONS.map((s) => s.x + (this.dir * L) / 2);
    this.stopsLeft = this.dir > 0 ? stops.sort((a, b) => a - b) : stops.sort((a, b) => b - a);
    this.state = 'run';
    this.speed = this.vmax * 0.8;
    this.whistled = false;
  }

  /** Текст за табелата на гарата: кога идва влакът. */
  status() {
    const farmX = STATIONS[0].x, L = this.length;
    const center = this.head - (this.dir * L) / 2;
    if (this.state === 'stop' && Math.abs(center - farmX) < 3) return `🚂 Влакът е на гарата! Тръгва след ${Math.ceil(this.wait)} с.`;
    const v = this.vmax * 0.85;
    let secs: number;
    if (this.state === 'hidden') secs = this.wait + Math.abs(farmX - (this.dir > 0 ? RAIL.east : RAIL.west)) / v + 6;
    else {
      const ahead = (farmX - center) * this.dir;
      if (ahead > 0) secs = ahead / v + 6;
      else {
        // вече е минал — ще се върне в обратна посока
        const end = this.dir > 0 ? RAIL.east : RAIL.west;
        secs = (Math.abs(end - center) + L) / v + 30 + Math.abs(end - farmX) / v + 6 + (this.stopsLeft.length ? 16 : 0);
      }
    }
    const m = Math.max(1, Math.round(secs / 60));
    return secs < 60 ? `🚂 Влакът пристига след ${Math.max(5, Math.round(secs))} с.` : `🚂 Следващият влак пристига след около ${m} мин.`;
  }

  update(dt: number) {
    if (this.state === 'hidden') {
      this.wait -= dt;
      this.group.visible = false;
      if (this.wait <= 0) this.startTrip();
      else return;
    }
    this.group.visible = true;
    const L = this.length;
    if (this.state === 'stop') {
      this.wait -= dt;
      this.speed = 0;
      if (this.wait < 2.5 && !this.whistled) { this.whistled = true; this.onWhistle(this.head); }
      if (this.wait <= 0) { this.state = 'run'; this.whistled = false; }
    } else {
      const a = 1.1;
      const stop = this.stopsLeft[0];
      let vt = this.vmax;
      if (stop !== undefined) {
        const d = (stop - this.head) * this.dir;
        vt = Math.min(this.vmax, Math.sqrt(2 * a * Math.max(0, d)));
        if (d < 25 && !this.whistled) { this.whistled = true; this.onWhistle(this.head); }
        if (d <= 0.05 && this.speed < 1.2) {
          this.head = stop;
          this.stopsLeft.shift();
          this.state = 'stop';
          this.wait = 16;
          this.whistled = false;
        }
      }
      if (this.state === 'run') {
        this.speed += THREE.MathUtils.clamp(vt - this.speed, -a * 1.5 * dt, a * dt);
        this.head += this.dir * this.speed * dt;
      }
      // напълно влезе в другия тунел
      const tail = this.head - this.dir * L;
      if ((this.dir > 0 && tail > RAIL.east + 10) || (this.dir < 0 && tail < RAIL.west - 10)) {
        this.state = 'hidden';
        this.wait = 25 + Math.random() * 15;
        this.group.visible = false;
        return;
      }
    }
    // разполагаме вагоните
    let off = 0;
    const dist = this.speed * dt;
    for (const c of this.cars) {
      const cx = this.head - this.dir * (off + c.len / 2);
      off += c.len;
      c.obj.position.set(cx, RAIL_Y, RAIL_Z);
      c.obj.rotation.y = this.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      for (const w of c.wheels) w.rotation.x += dist / (w.userData.r as number);
      if (c.rods) {
        const ang = c.wheels[1].rotation.x;
        for (const r of c.rods) r.m.position.set(r.m.position.x, r.y + Math.cos(ang) * 0.22, r.z - Math.sin(ang) * 0.22);
      }
    }
    // пушек от комина (по-гъст, когато потегля)
    const loco = this.cars[0];
    this.smokeT -= dt;
    if (loco.chimney && this.smokeT <= 0) {
      const busy = this.state === 'run' && this.speed < this.vmax * 0.7;
      this.smokeT = this.state === 'stop' ? 0.45 : busy ? 0.09 : 0.16;
      const p = loco.chimney.clone();
      loco.obj.localToWorld(p);
      this.smoke.emit(p, -this.dir * this.speed, busy);
    }
    this.smoke.update(dt);
  }
}

export function whistleNear(x: number, camX: number) {
  if (Math.abs(x - camX) < 220) sfx('whistle');
}
