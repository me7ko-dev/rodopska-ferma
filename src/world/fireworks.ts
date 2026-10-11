import * as THREE from 'three';
import { sfx } from '../audio/sfx';

// Фойерверки: ракета се издига със следа и избухва в цветна топка искри.

function sparkTexture() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 32;
  const g = cv.getContext('2d')!;
  const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.3, 'rgba(255,255,255,0.8)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(cv);
}

const PALETTES = [['#ff3b30', '#ffd60a'], ['#30b0ff', '#ffffff'], ['#34c759', '#ffd60a'], ['#ff6fa8', '#c9a3ff'], ['#ff9500', '#ff3b30'], ['#ffffff', '#ffd60a']];

export class Fireworks {
  private N = 1400;
  private pts: THREE.Points;
  private pos: Float32Array;
  private col: Float32Array;
  private vel: Float32Array;
  private life: Float32Array;
  private max: Float32Array;
  private next = 0;
  private rockets: { p: THREE.Vector3; v: THREE.Vector3; t: number; pal: string[] }[] = [];
  private timer = 1;

  constructor(scene: THREE.Scene) {
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(this.N * 3);
    this.col = new Float32Array(this.N * 3);
    this.vel = new Float32Array(this.N * 3);
    this.life = new Float32Array(this.N);
    this.max = new Float32Array(this.N).fill(1);
    for (let i = 0; i < this.N; i++) this.pos[i * 3 + 1] = -999;
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.pts = new THREE.Points(g, new THREE.PointsMaterial({ size: 1.5, map: sparkTexture(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    this.pts.frustumCulled = false;
    scene.add(this.pts);
  }

  private emit(p: THREE.Vector3, v: THREE.Vector3, c: THREE.Color, life: number) {
    const i = this.next;
    this.next = (this.next + 1) % this.N;
    this.pos.set([p.x, p.y, p.z], i * 3);
    this.vel.set([v.x, v.y, v.z], i * 3);
    this.col.set([c.r, c.g, c.b], i * 3);
    this.life[i] = life;
    this.max[i] = life;
  }

  /** Изстрелва ракета от дадена точка. */
  launch(from: THREE.Vector3, height = 26) {
    const pal = PALETTES[(Math.random() * PALETTES.length) | 0];
    this.rockets.push({ p: from.clone(), v: new THREE.Vector3((Math.random() - 0.5) * 2, Math.sqrt(2 * 9.8 * height), (Math.random() - 0.5) * 2), t: 0, pal });
    sfx('cast');
  }

  private burst(p: THREE.Vector3, pal: string[]) {
    const c1 = new THREE.Color(pal[0]), c2 = new THREE.Color(pal[1]);
    const n = 110;
    for (let i = 0; i < n; i++) {
      const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, r = Math.sqrt(1 - u * u);
      const sp = 9 + Math.random() * 3;
      this.emit(p, new THREE.Vector3(r * Math.cos(a) * sp, u * sp, r * Math.sin(a) * sp), i % 3 ? c1 : c2, 1.4 + Math.random() * 0.8);
    }
    sfx('boom');
  }

  /** auto — сами се изстрелват около дадена точка (празник нощем). */
  update(dt: number, auto: THREE.Vector3 | null) {
    if (auto) {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.timer = 0.8 + Math.random() * 2.2;
        this.launch(new THREE.Vector3(auto.x + (Math.random() - 0.5) * 44, 0, auto.z + 4 - Math.random() * 12), 7 + Math.random() * 6);
      }
    }
    // ракетите и следата им
    for (let i = this.rockets.length - 1; i >= 0; i--) {
      const r = this.rockets[i];
      r.t += dt;
      r.v.y -= 9.8 * dt;
      r.p.addScaledVector(r.v, dt);
      this.emit(r.p, new THREE.Vector3((Math.random() - 0.5) * 0.6, -1, (Math.random() - 0.5) * 0.6), new THREE.Color('#ffd27a'), 0.5);
      if (r.v.y <= 0.5) { this.burst(r.p, r.pal); this.rockets.splice(i, 1); }
    }
    let any = false;
    for (let i = 0; i < this.N; i++) {
      if (this.life[i] <= 0) continue;
      any = true;
      this.life[i] -= dt;
      const k = Math.max(0, this.life[i] / this.max[i]);
      const j = i * 3;
      this.vel[j + 1] -= 4.5 * dt;
      const drag = Math.pow(0.35, dt);
      this.vel[j] *= drag; this.vel[j + 1] *= drag; this.vel[j + 2] *= drag;
      this.pos[j] += this.vel[j] * dt;
      this.pos[j + 1] += this.vel[j + 1] * dt;
      this.pos[j + 2] += this.vel[j + 2] * dt;
      if (this.life[i] <= 0) this.pos[j + 1] = -999;
      // избледняват към края (с лек блясък)
      const f = k * (0.75 + Math.random() * 0.25);
      this.col[j] *= 0.985 + 0.015 * f; this.col[j + 1] *= 0.985 + 0.015 * f; this.col[j + 2] *= 0.985 + 0.015 * f;
    }
    this.pts.visible = any;
    if (any) {
      this.pts.geometry.attributes.position.needsUpdate = true;
      this.pts.geometry.attributes.color.needsUpdate = true;
    }
  }
}
