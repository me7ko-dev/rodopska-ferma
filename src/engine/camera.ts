import * as THREE from 'three';
import { clamp, lerp } from './noise';

export interface PointerInfo {
  x: number;
  y: number;
  id: number;
  button: number;
}

/** Какво прави играта с докосванията. Ако onDown върне true, плъзгането е за играта (садене/жънене), не за камерата. */
export interface GameInput {
  onDown(p: PointerInfo): boolean;
  onDrag(p: PointerInfo): void;
  onUp(p: PointerInfo): void;
  onTap(p: PointerInfo): void;
  onHover?(p: PointerInfo): void;
}

const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();

/** Камера отгоре под ъгъл (като в Hay Day): местене с пръст, приближаване с два пръста/колелцето, въртене. */
export class CameraRig {
  target = new THREE.Vector3(0, 0, 4);
  distance = 62;
  yaw = Math.PI / 4;
  // желани стойности (камерата плавно ги догонва)
  goal = { x: 0, z: 4, distance: 62, yaw: Math.PI / 4 };
  minDist = 22;
  maxDist = 120;
  bounds = { minX: -70, maxX: 150, minZ: -60, maxZ: 60 };
  private vel = new THREE.Vector2();
  private pointers = new Map<number, { x: number; y: number }>();
  private gesture: null | { mode: 'pan' | 'game' | 'pinch' | 'rotate'; start: { x: number; y: number; t: number }; moved: boolean } = null;
  private pinch = { dist: 0, ang: 0, mid: new THREE.Vector2() };
  private lastPan = { x: 0, y: 0, t: 0 };
  input: GameInput | null = null;
  enabled = true;
  follow: THREE.Object3D | null = null;

  constructor(public camera: THREE.PerspectiveCamera, public dom: HTMLElement) {
    dom.addEventListener('pointerdown', (e) => this.down(e));
    addEventListener('pointermove', (e) => this.move(e));
    addEventListener('pointerup', (e) => this.up(e));
    addEventListener('pointercancel', (e) => this.up(e));
    dom.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (!this.enabled) return;
      const f = Math.exp(e.deltaY * 0.0012);
      this.zoomAt(f, e.clientX, e.clientY);
    }, { passive: false });
    dom.addEventListener('contextmenu', (e) => e.preventDefault());
    addEventListener('keydown', (e) => {
      if (!this.enabled || (e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (e.key === 'q' || e.key === 'Q' || e.key === 'й') this.goal.yaw += Math.PI / 8;
      if (e.key === 'e' || e.key === 'E' || e.key === 'е') this.goal.yaw -= Math.PI / 8;
      if (e.key === '+' || e.key === '=') this.goal.distance = clamp(this.goal.distance * 0.85, this.minDist, this.maxDist);
      if (e.key === '-') this.goal.distance = clamp(this.goal.distance * 1.18, this.minDist, this.maxDist);
    });
  }

  /** Текущото плъзгане става „на играта“ (напр. след задържане върху сграда — местим я, а не камерата). */
  claim() {
    if (this.gesture) this.gesture.mode = 'game';
  }
  gestureMoved() {
    return !!this.gesture?.moved;
  }
  isPressing() {
    return this.pointers.size === 1 && !!this.gesture;
  }

  /** Наклонът зависи от разстоянието: отблизо камерата е по-ниско (по-красиво), отдалеч гледа повече отгоре. */
  pitchFor(d: number) {
    const t = clamp((d - this.minDist) / (this.maxDist - this.minDist), 0, 1);
    return lerp(0.6, 0.98, t);
  }

  groundAt(sx: number, sy: number, out = new THREE.Vector3()) {
    ndc.set((sx / innerWidth) * 2 - 1, -(sy / innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, this.camera);
    return ray.ray.intersectPlane(ground, out);
  }

  zoomAt(f: number, sx: number, sy: number) {
    const before = this.groundAt(sx, sy);
    const nd = clamp(this.goal.distance * f, this.minDist, this.maxDist);
    const real = nd / this.goal.distance;
    this.goal.distance = nd;
    if (before) {
      // приближаваме към точката под пръста
      this.goal.x = before.x + (this.goal.x - before.x) * real;
      this.goal.z = before.z + (this.goal.z - before.z) * real;
    }
  }

  flyTo(x: number, z: number, distance?: number) {
    this.goal.x = x;
    this.goal.z = z;
    if (distance) this.goal.distance = clamp(distance, this.minDist, this.maxDist);
    this.vel.set(0, 0);
  }

  private down(e: PointerEvent) {
    if (!this.enabled) return;
    this.dom.setPointerCapture?.(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    this.vel.set(0, 0);
    if (this.pointers.size === 2) {
      // втори пръст: преминаваме към приближаване/въртене
      if (this.gesture?.mode === 'game') this.input?.onUp({ x: e.clientX, y: e.clientY, id: e.pointerId, button: 0 });
      const [a, b] = [...this.pointers.values()];
      this.pinch.dist = Math.hypot(a.x - b.x, a.y - b.y);
      this.pinch.ang = Math.atan2(b.y - a.y, b.x - a.x);
      this.pinch.mid.set((a.x + b.x) / 2, (a.y + b.y) / 2);
      this.gesture = { mode: 'pinch', start: { x: e.clientX, y: e.clientY, t: performance.now() }, moved: true };
      return;
    }
    if (this.pointers.size > 2) return;
    const p: PointerInfo = { x: e.clientX, y: e.clientY, id: e.pointerId, button: e.button };
    let mode: 'pan' | 'game' | 'rotate' = 'pan';
    if (e.button === 2) mode = 'rotate';
    else if (this.input?.onDown(p)) mode = 'game';
    this.gesture = { mode, start: { x: e.clientX, y: e.clientY, t: performance.now() }, moved: false };
    this.lastPan = { x: e.clientX, y: e.clientY, t: performance.now() };
  }

  private move(e: PointerEvent) {
    if (!this.pointers.has(e.pointerId)) {
      if (e.pointerType === 'mouse' && this.input?.onHover) this.input.onHover({ x: e.clientX, y: e.clientY, id: e.pointerId, button: -1 });
      return;
    }
    const prev = this.pointers.get(e.pointerId)!;
    const cur = { x: e.clientX, y: e.clientY };
    this.pointers.set(e.pointerId, cur);
    const g = this.gesture;
    if (!g) return;
    if (g.mode === 'pinch' && this.pointers.size >= 2) {
      const [a, b] = [...this.pointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const ang = Math.atan2(b.y - a.y, b.x - a.x);
      const mid = new THREE.Vector2((a.x + b.x) / 2, (a.y + b.y) / 2);
      if (this.pinch.dist > 0) this.zoomAt(this.pinch.dist / dist, mid.x, mid.y);
      let da = ang - this.pinch.ang;
      if (da > Math.PI) da -= Math.PI * 2;
      if (da < -Math.PI) da += Math.PI * 2;
      this.goal.yaw -= da;
      this.panScreen(this.pinch.mid.x, this.pinch.mid.y, mid.x, mid.y);
      this.pinch.dist = dist; this.pinch.ang = ang; this.pinch.mid.copy(mid);
      return;
    }
    if (!g.moved && Math.hypot(cur.x - g.start.x, cur.y - g.start.y) > 9) {
      g.moved = true;
      if (g.mode !== 'game') this.input?.onDrag({ x: cur.x, y: cur.y, id: e.pointerId, button: -2 });
    }
    if (!g.moved) return;
    const p: PointerInfo = { x: cur.x, y: cur.y, id: e.pointerId, button: e.button };
    if (g.mode === 'game') this.input?.onDrag(p);
    else if (g.mode === 'rotate') this.goal.yaw -= (cur.x - prev.x) * 0.006;
    else if (g.mode === 'pan') {
      this.panScreen(prev.x, prev.y, cur.x, cur.y);
      const now = performance.now();
      const dtp = Math.max(1, now - this.lastPan.t);
      const a = this.groundAt(this.lastPan.x, this.lastPan.y), b = this.groundAt(cur.x, cur.y);
      if (a && b) this.vel.set(((a.x - b.x) / dtp) * 1000, ((a.z - b.z) / dtp) * 1000);
      this.lastPan = { x: cur.x, y: cur.y, t: now };
    }
  }

  private up(e: PointerEvent) {
    if (!this.pointers.has(e.pointerId)) return;
    this.pointers.delete(e.pointerId);
    const g = this.gesture;
    const p: PointerInfo = { x: e.clientX, y: e.clientY, id: e.pointerId, button: e.button };
    if (g && this.pointers.size === 0) {
      if (g.mode === 'game') {
        if (!g.moved) this.input?.onTap(p);
        this.input?.onUp(p);
      } else if (!g.moved && g.mode !== 'pinch' && performance.now() - g.start.t < 600) {
        this.input?.onTap(p);
      }
      if (g.mode !== 'pan' || performance.now() - this.lastPan.t > 80) this.vel.set(0, 0);
      this.gesture = null;
    } else if (g?.mode === 'pinch' && this.pointers.size === 1) {
      // остава един пръст — продължаваме с местене
      const [only] = [...this.pointers.values()];
      this.gesture = { mode: 'pan', start: { x: only.x, y: only.y, t: performance.now() }, moved: true };
      this.lastPan = { x: only.x, y: only.y, t: performance.now() };
    }
  }

  /** Местим камерата така, че точката под пръста да остане под пръста. */
  private panScreen(x0: number, y0: number, x1: number, y1: number) {
    const a = this.groundAt(x0, y0), b = this.groundAt(x1, y1);
    if (!a || !b) return;
    this.goal.x += a.x - b.x;
    this.goal.z += a.z - b.z;
    this.target.x += a.x - b.x;
    this.target.z += a.z - b.z;
  }

  update(dt: number) {
    const g = this.goal;
    if (this.follow) {
      // следим колата плътно и гледаме малко напред по посоката ѝ
      const f = this.follow;
      const ahead = (f.userData.speed ?? 0) * 0.35;
      g.x = f.position.x + Math.sin(f.rotation.y) * ahead;
      g.z = f.position.z + Math.cos(f.rotation.y) * ahead;
      this.target.x = g.x;
      this.target.z = g.z;
    }
    if (!this.gesture && this.vel.lengthSq() > 0.01) {
      g.x += this.vel.x * dt;
      g.z += this.vel.y * dt;
      this.vel.multiplyScalar(Math.pow(0.04, dt));
    }
    if (!this.follow) {
      g.x = clamp(g.x, this.bounds.minX, this.bounds.maxX);
      g.z = clamp(g.z, this.bounds.minZ, this.bounds.maxZ);
    }
    const k = 1 - Math.pow(0.0008, dt);
    this.target.x = lerp(this.target.x, g.x, k);
    this.target.z = lerp(this.target.z, g.z, k);
    this.distance = lerp(this.distance, g.distance, k);
    this.yaw = lerp(this.yaw, g.yaw, k);
    const pitch = this.pitchFor(this.distance);
    const c = this.camera;
    const h = Math.sin(pitch) * this.distance, r = Math.cos(pitch) * this.distance;
    c.position.set(this.target.x + Math.sin(this.yaw) * r, h, this.target.z + Math.cos(this.yaw) * r);
    c.lookAt(this.target.x, 0, this.target.z);
  }
}
