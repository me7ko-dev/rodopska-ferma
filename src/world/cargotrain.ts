import * as THREE from 'three';
import { Kit, kitMeshes } from '../engine/kit';
import { RAIL, SIDING, SIDING_Z, STATIONS, cargoZAt } from './layout';
import { locomotive, bogies, gravelTexture, signTexture, Smoke, RAIL_Y, GAUGE, type Car, type Railway } from './railway';
import { S } from '../game/state';
import { icon } from '../ui/icons';
import { sfx } from '../audio/sfx';

// Товарният влак: собствен коловоз между гарата и фермата, локомотив и 3 открити вагона по 3 сандъка.
// Влакът идва от западния тунел, отбива се към товарната гара и спира срещу фермата.

const X0 = RAIL.west - 40, X1 = RAIL.east + 60; // от западния тунел до източния
const STOP_X = STATIONS[0].x + 18; // къде спира предницата

// ---------- пътят (дължина по дъгата) ----------
const STEP = 0.25;
const xs: number[] = [], ss: number[] = [];
{
  let s = 0, px = X0, pz = cargoZAt(X0);
  for (let x = X0; x <= X1; x += STEP) {
    const z = cargoZAt(x);
    s += Math.hypot(x - px, z - pz);
    xs.push(x);
    ss.push(s);
    px = x; pz = z;
  }
}
const S_END = ss[ss.length - 1];
function xAt(s: number) {
  if (s <= 0) return X0 + s;
  if (s >= S_END) return X1 + (s - S_END);
  let lo = 0, hi = ss.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (ss[m] < s) lo = m; else hi = m; }
  const k = (s - ss[lo]) / Math.max(1e-6, ss[hi] - ss[lo]);
  return xs[lo] + (xs[hi] - xs[lo]) * k;
}
function sAtX(x: number) {
  const i = Math.max(0, Math.min(ss.length - 1, Math.round((x - X0) / STEP)));
  return ss[i];
}
const tmp = new THREE.Vector3();
function poseAt(s: number, out: THREE.Vector3) {
  const x = xAt(s);
  out.set(x, RAIL_Y, cargoZAt(x));
  const z2 = cargoZAt(x + 0.5), z1 = cargoZAt(x - 0.5);
  return Math.atan2(1, (z2 - z1)); // ъгъл на завъртане (y) — напред е +x
}

// ---------- коловозът ----------
function buildTrack() {
  const root = new THREE.Group();
  root.name = 'cargo-track';
  const seg: { x: number; z: number; a: number; l: number }[] = [];
  for (let x = SIDING.w0 - 2; x < SIDING.e1 + 2; x += 1.5) {
    const z = cargoZAt(x), z2 = cargoZAt(x + 1.5);
    seg.push({ x: x + 0.75, z: (z + z2) / 2, a: Math.atan2(z2 - z, 1.5), l: Math.hypot(1.5, z2 - z) });
  }
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const gt = gravelTexture();
  const ballast = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.3, 3.1), new THREE.MeshStandardMaterial({ map: gt, roughness: 1, color: '#d8d2c6' }), seg.length);
  seg.forEach((g, i) => ballast.setMatrixAt(i, m.compose(p.set(g.x, 0.15, g.z), q.setFromAxisAngle(up, -g.a), sc.set(g.l + 0.08, 1, 1))));
  ballast.receiveShadow = true;
  root.add(ballast);
  // траверси
  const sl: THREE.Matrix4[] = [];
  for (let x = SIDING.w0 - 2; x < SIDING.e1 + 2; x += 0.8) {
    const z = cargoZAt(x), a = Math.atan2(cargoZAt(x + 0.3) - cargoZAt(x - 0.3), 0.6);
    sl.push(m.compose(p.set(x, 0.38, z), q.setFromAxisAngle(up, -a), sc.set(1, 1, 1)).clone());
  }
  const sleepers = new THREE.InstancedMesh(new THREE.BoxGeometry(0.24, 0.14, 2.1), new THREE.MeshStandardMaterial({ color: '#5b4632', roughness: 0.95 }), sl.length);
  sl.forEach((mm, i) => sleepers.setMatrixAt(i, mm));
  sleepers.receiveShadow = true;
  root.add(sleepers);
  // релсите
  const steel = new THREE.MeshStandardMaterial({ color: '#b7b9bb', roughness: 0.32, metalness: 0.75 });
  steel.userData.noSnow = true;
  const rails = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.13, 0.09), steel, seg.length * 2);
  let k = 0;
  for (const g of seg) for (const s of [-1, 1]) {
    const nx = -Math.sin(g.a) * (s * GAUGE) / 2, nz = Math.cos(g.a) * (s * GAUGE) / 2;
    rails.setMatrixAt(k++, m.compose(p.set(g.x + nx, RAIL_Y - 0.065, g.z + nz), q.setFromAxisAngle(up, -g.a), sc.set(g.l + 0.04, 1, 1)));
  }
  root.add(rails);
  for (const im of [ballast, sleepers, rails]) im.computeBoundingSphere();
  // табела „ТОВАРНА ГАРА“ и малка рампа с бъчви
  const k2 = new Kit();
  for (const x of [-3.2, 3.2]) k2.box('trim', 0.18, 2.6, 0.18, '#5a3a22', x, 1.3, 0);
  k2.box('trim', 7.2, 0.12, 0.25, '#5a3a22', 0, 2.62, 0);
  const sg = kitMeshes(k2);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(6.6, 1.1), new THREE.MeshStandardMaterial({ map: signTexture('ТОВАРНА ГАРА', '#5a3a22', '#ffe9b0'), roughness: 0.6 }));
  sign.position.set(0, 2.05, 0.11);
  sg.add(sign);
  const back = sign.clone();
  back.rotation.y = Math.PI;
  back.position.z = -0.11;
  sg.add(back);
  sg.position.set(STATIONS[0].x - 4, 0, SIDING_Z - 3.2);
  root.add(sg);
  return root;
}

// ---------- открит вагон със сандъци ----------
interface CrateObj { g: THREE.Group; lid: THREE.Object3D; goods: THREE.Mesh; label: THREE.Sprite; key: string }
const wood = new THREE.MeshStandardMaterial({ color: '#b07a45', roughness: 0.85 });
const woodDark = new THREE.MeshStandardMaterial({ color: '#8a5a30', roughness: 0.9 });
function crate(): CrateObj {
  const g = new THREE.Group();
  const box = new THREE.BoxGeometry(1, 1, 1);
  const W = 1.5, H = 1.0;
  const add = (mt: THREE.Material, x: number, y: number, z: number, sx: number, sy: number, sz: number) => {
    const o = new THREE.Mesh(box, mt);
    o.position.set(x, y, z);
    o.scale.set(sx, sy, sz);
    o.castShadow = true;
    g.add(o);
    return o;
  };
  add(woodDark, 0, 0.05, 0, W, 0.1, W);
  for (const s of [-1, 1]) {
    add(wood, s * (W / 2 - 0.05), H / 2, 0, 0.1, H, W);
    add(wood, 0, H / 2, s * (W / 2 - 0.05), W, H, 0.1);
    add(woodDark, s * (W / 2 - 0.02), H * 0.75, 0, 0.06, 0.12, W + 0.02);
    add(woodDark, 0, H * 0.25, s * (W / 2 - 0.02), W + 0.02, 0.12, 0.06);
  }
  const goods = add(new THREE.MeshStandardMaterial({ color: '#e8c060', roughness: 0.8 }), 0, H - 0.12, 0, W - 0.2, 0.2, W - 0.2);
  const lid = new THREE.Group();
  const l1 = new THREE.Mesh(box, wood);
  l1.scale.set(W + 0.06, 0.1, W + 0.06);
  l1.castShadow = true;
  lid.add(l1);
  for (const z of [-0.45, 0, 0.45]) { const b = new THREE.Mesh(box, woodDark); b.scale.set(W + 0.08, 0.05, 0.12); b.position.set(0, 0.07, z); lid.add(b); }
  lid.position.y = H + 0.05;
  g.add(lid);
  const label = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false }));
  label.position.y = H + 1.15;
  label.scale.setScalar(1.35);
  g.add(label);
  return { g, lid, goods, label, key: '' };
}

function flatCar(): Car & { crates: CrateObj[] } {
  const k = new Kit();
  const L = 8.4;
  k.box('trim', 2.4, 0.3, L, '#3b2f27', 0, 1.1, 0, 0.03);
  k.box('trim', 2.5, 0.12, L + 0.1, '#6b4a2e', 0, 1.3, 0);
  for (const z of [-3.6, -1.2, 1.2, 3.6]) for (const s of [-1, 1]) k.box('trim', 0.1, 0.9, 0.1, '#2b2b2b', s * 1.2, 1.8, z);
  for (const s of [-1, 1]) k.box('trim', 0.06, 0.08, L - 0.6, '#2b2b2b', s * 1.2, 2.2, 0);
  const obj = kitMeshes(k, '#6b4a2e');
  const wheels: THREE.Mesh[] = [];
  bogies(obj, [-2.8, 2.8], wheels);
  const crates: CrateObj[] = [];
  for (let i = 0; i < 3; i++) {
    const c = crate();
    c.g.position.set(0, 1.36, (i - 1) * 2.55);
    obj.add(c.g);
    crates.push(c);
  }
  return { obj, len: L + 1.0, wheels, crates };
}

// ---------- картинка на сандъка: иконка + брой ----------
const labelCache = new Map<string, THREE.Texture>();
function labelTexture(item: string, qty: number, done: boolean) {
  const key = `${item}|${qty}|${done}`;
  let t = labelCache.get(key);
  if (t) return t;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const g = cv.getContext('2d')!;
  t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  labelCache.set(key, t);
  const im = new Image();
  im.onload = () => {
    g.clearRect(0, 0, 128, 128);
    g.fillStyle = done ? 'rgba(236,255,217,0.95)' : 'rgba(255,253,246,0.95)';
    g.strokeStyle = done ? '#4fa52c' : '#c98f4f';
    g.lineWidth = 7;
    g.beginPath();
    g.arc(64, 60, 52, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.globalAlpha = done ? 1 : 0.92;
    g.drawImage(im, 18, 14, 92, 92);
    g.globalAlpha = 1;
    if (done) {
      g.fillStyle = '#4fa52c';
      g.beginPath(); g.arc(98, 98, 22, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#fff'; g.lineWidth = 7;
      g.beginPath(); g.moveTo(87, 98); g.lineTo(95, 107); g.lineTo(110, 88); g.stroke();
    } else {
      g.font = '800 34px Rubik, sans-serif';
      g.textAlign = 'center';
      g.lineWidth = 8;
      g.strokeStyle = '#4a2f16';
      g.strokeText('×' + qty, 92, 116);
      g.fillStyle = '#fff';
      g.fillText('×' + qty, 92, 116);
    }
    t!.needsUpdate = true;
  };
  im.src = icon(item) || icon('coin');
  return t;
}

// ---------- влакът ----------
export class CargoTrain {
  group = new THREE.Group();
  cars: (Car & { crates?: CrateObj[] })[] = [];
  state: 'hidden' | 'arriving' | 'parked' | 'leaving' = 'hidden';
  head = 0; // s на предницата
  speed = 0;
  smoke: Smoke;
  smokeT = 0;
  proxy: THREE.Mesh;
  private stopS = sAtX(STOP_X);
  private pending: 'arrive' | 'leave' | null = null;
  onWhistle: (x: number) => void = () => {};

  constructor(scene: THREE.Scene, public railway: Railway) {
    scene.add(buildTrack());
    this.group.name = 'cargo-train';
    scene.add(this.group);
    const loco = locomotive();
    this.cars.push(loco);
    for (let i = 0; i < 3; i++) this.cars.push(flatCar());
    for (const c of this.cars) this.group.add(c.obj);
    this.group.visible = false;
    this.smoke = new Smoke(scene, 16);
    const len = this.length();
    this.proxy = new THREE.Mesh(new THREE.BoxGeometry(len + 2, 5, 5), new THREE.MeshBasicMaterial({ visible: false }));
    this.proxy.position.set(STOP_X - len / 2, 2.5, SIDING_Z);
    this.proxy.visible = false;
    scene.add(this.proxy);
  }

  length() {
    return this.cars.reduce((a, c) => a + c.len, 0);
  }

  /** Стои ли на гарата (за натискане). */
  get here() {
    return this.state === 'parked' || this.state === 'arriving';
  }

  /** Сандъците — иконка, брой и капак според състоянието на поръчката. */
  refreshCrates() {
    const cr = S.cargo?.crates ?? [];
    let i = 0;
    for (const c of this.cars) for (const o of c.crates ?? []) {
      const d = cr[i++];
      o.g.visible = !!d;
      if (!d) continue;
      const key = `${d.item}|${d.qty}|${!!d.done}`;
      if (o.key === key) continue;
      o.key = key;
      o.lid.visible = !!d.done;
      o.goods.visible = !!d.done;
      (o.label.material as THREE.SpriteMaterial).map = labelTexture(d.item, d.qty, !!d.done);
      (o.label.material as THREE.SpriteMaterial).needsUpdate = true;
    }
  }

  /** Подреждане според състоянието в записа (при зареждане на играта). */
  sync(animate: boolean) {
    const here = S.cargo?.st === 'here';
    if (here) {
      this.refreshCrates();
      if (this.state === 'parked' || this.state === 'arriving') return;
      if (animate) this.pending = 'arrive';
      else { this.state = 'parked'; this.head = this.stopS; this.speed = 0; this.place(0); }
    } else if (this.state === 'parked' || this.state === 'arriving') {
      if (animate) this.pending = 'leave';
      else { this.state = 'hidden'; this.group.visible = false; }
    }
  }

  private place(dist: number) {
    let off = 0;
    for (const c of this.cars) {
      const s = this.head - off - c.len / 2;
      off += c.len;
      const a = poseAt(s, tmp);
      c.obj.position.copy(tmp);
      c.obj.rotation.y = a;
      for (const w of c.wheels) w.rotation.x += dist / (w.userData.r as number);
      if (c.rods) {
        const ang = c.wheels[1].rotation.x;
        for (const r of c.rods) r.m.position.set(r.m.position.x, r.y + Math.cos(ang) * 0.22, r.z - Math.sin(ang) * 0.22);
      }
    }
    this.group.visible = true;
  }

  update(dt: number) {
    // главният влак да не е на същия път: тръгваме само когато е в тунела и няма да ни срещне
    const rw = this.railway;
    const nextDir = (rw.trip + 1) % 2 ? 1 : -1;
    const clear = rw.state === 'hidden' && (this.pending === 'arrive' ? nextDir < 0 || rw.wait > 18 : nextDir > 0);
    if (this.pending && clear) {
      if (this.pending === 'arrive') { this.state = 'arriving'; this.head = 0; this.speed = 9; this.onWhistle(-120); }
      else { this.state = 'leaving'; this.speed = 0.5; this.onWhistle(STOP_X); }
      this.pending = null;
    }
    this.proxy.visible = false;
    if (this.state === 'hidden') { this.group.visible = false; this.smoke.update(dt); return; }
    const a = 1.2;
    if (this.state === 'arriving') {
      const d = this.stopS - this.head;
      const vt = Math.min(9, Math.sqrt(2 * a * Math.max(0, d)));
      this.speed += THREE.MathUtils.clamp(vt - this.speed, -a * 1.6 * dt, a * dt);
      if (d < 0.05 || (d < 0.6 && this.speed < 0.4)) { this.head = this.stopS; this.speed = 0; this.state = 'parked'; sfx('truck'); }
    } else if (this.state === 'leaving') {
      this.speed = Math.min(11, this.speed + a * dt);
      if (this.head - this.length() > S_END - 5) { this.state = 'hidden'; this.group.visible = false; return; }
    }
    const dist = this.speed * dt;
    this.head += dist;
    this.place(dist);
    if (this.state === 'parked' || this.state === 'arriving') this.proxy.visible = true;
    // пушек
    const loco = this.cars[0];
    this.smokeT -= dt;
    if (loco.chimney && this.smokeT <= 0) {
      const busy = this.state === 'leaving' && this.speed < 6;
      this.smokeT = this.state === 'parked' ? 0.6 : busy ? 0.1 : 0.18;
      const p = loco.chimney.clone();
      loco.obj.localToWorld(p);
      this.smoke.emit(p, -this.speed, busy);
    }
    this.smoke.update(dt);
  }
}

export const CARGO_VIEW = { x: STOP_X - 18, z: SIDING_Z + 4 };
