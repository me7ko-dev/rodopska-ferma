import * as THREE from 'three';
import { FARM } from './layout';
import { S, save, now } from '../game/state';
import type { Farm } from '../game/world';
import type { Engine } from '../engine/engine';
import { SKY } from './sky';

// Живот наоколо: пеперуди, птици, дим от работилниците и дъжд.

function softTexture(color = '#ffffff') {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const g = cv.getContext('2d')!;
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, color);
  gr.addColorStop(0.5, color + 'aa');
  gr.addColorStop(1, color + '00');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Ambient {
  group = new THREE.Group();
  butterflies: { o: THREE.Group; home: THREE.Vector3; ph: number; sp: number; l: THREE.Mesh; r: THREE.Mesh }[] = [];
  birds: { o: THREE.Group; c: THREE.Vector3; rad: number; ph: number; sp: number; h: number; l: THREE.Mesh; r: THREE.Mesh }[] = [];
  puffs: { s: THREE.Sprite; v: THREE.Vector3; life: number; max: number }[] = [];
  smokeMat: THREE.SpriteMaterial;
  smokeT = 0;
  // дъжд
  rain: THREE.LineSegments;
  raining = false;
  rainLeft = 0;
  nextWeather = 240 + Math.random() * 240;
  onRain: (on: boolean) => void = () => {};
  private rainAmt = 0;
  private baseSun = 2.75;
  private baseHemi = 1.15;

  constructor(public scene: THREE.Scene, public farm: Farm, public engine: Engine) {
    scene.add(this.group);
    this.baseSun = engine.sun.intensity;
    this.baseHemi = engine.hemi.intensity;
    // пеперуди
    const wing = new THREE.CircleGeometry(0.16, 8).translate(0.14, 0, 0);
    const cols = ['#ffd23f', '#ffffff', '#ff8fb1', '#8ecbff', '#ffa94d', '#c9a3ff'];
    for (let i = 0; i < 26; i++) {
      const o = new THREE.Group();
      const m = new THREE.MeshStandardMaterial({ color: cols[i % cols.length], side: THREE.DoubleSide, roughness: 0.6, emissive: cols[i % cols.length], emissiveIntensity: 0.15 });
      const l = new THREE.Mesh(wing, m), r = new THREE.Mesh(wing, m);
      r.scale.x = -1;
      o.add(l, r);
      const side = i % 4;
      const t = Math.random();
      const home = new THREE.Vector3(
        side < 2 ? (side === 0 ? FARM.minX - 4 : FARM.maxX + 4) : FARM.minX + t * (FARM.maxX - FARM.minX),
        1,
        side >= 2 ? (side === 2 ? FARM.minZ - 4 : FARM.maxZ + 4) : FARM.minZ + t * (FARM.maxZ - FARM.minZ),
      );
      if (i % 3 === 0) home.set((Math.random() - 0.5) * 30, 1, (Math.random() - 0.5) * 24);
      o.position.copy(home);
      this.group.add(o);
      this.butterflies.push({ o, home, ph: Math.random() * 100, sp: 0.6 + Math.random() * 0.6, l, r });
    }
    // птици (прости силуети в небето)
    const bwing = new THREE.BufferGeometry();
    bwing.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -0.15, 0, 0, 0.25, 1.1, 0.05, 0.05], 3));
    bwing.computeVertexNormals();
    const bm = new THREE.MeshBasicMaterial({ color: '#3a3a44', side: THREE.DoubleSide, fog: true });
    for (let i = 0; i < 9; i++) {
      const o = new THREE.Group();
      const l = new THREE.Mesh(bwing, bm), r = new THREE.Mesh(bwing, bm);
      r.scale.x = -1;
      o.add(l, r);
      o.scale.setScalar(1.3);
      this.group.add(o);
      this.birds.push({ o, c: new THREE.Vector3((Math.random() - 0.5) * 120, 0, (Math.random() - 0.5) * 90 - 20), rad: 25 + Math.random() * 40, ph: Math.random() * 6, sp: 0.08 + Math.random() * 0.06, h: 30 + Math.random() * 25, l, r });
    }
    // дим
    this.smokeMat = new THREE.SpriteMaterial({ map: softTexture('#ffffff'), transparent: true, depthWrite: false, opacity: 0.6, fog: true });
    // дъжд — черти около камерата
    const n = engine.quality === 'low' ? 900 : 2200;
    const pos = new Float32Array(n * 6);
    for (let i = 0; i < n; i++) {
      const x = (Math.random() - 0.5) * 90, y = Math.random() * 45, z = (Math.random() - 0.5) * 90;
      pos.set([x, y, z, x + 0.15, y - 1.1, z + 0.1], i * 6);
    }
    const rg = new THREE.BufferGeometry();
    rg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.rain = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: '#cfe3f2', transparent: true, opacity: 0.0 }));
    this.rain.frustumCulled = false;
    this.rain.visible = false;
    this.group.add(this.rain);
  }

  startRain(sec = 75) {
    this.raining = true;
    this.rainLeft = sec;
    this.rain.visible = true;
    this.onRain(true);
  }

  update(dt: number, t: number) {
    // пеперуди: пърхат около „дома“ си
    for (const b of this.butterflies) {
      b.ph += dt * b.sp;
      const p = b.o.position;
      const tx = b.home.x + Math.sin(b.ph * 1.3) * 3 + Math.sin(b.ph * 0.37) * 4;
      const tz = b.home.z + Math.cos(b.ph * 1.1) * 3 + Math.cos(b.ph * 0.29) * 4;
      const ty = 0.9 + Math.sin(b.ph * 2.3) * 0.5 + 0.4;
      const dx = tx - p.x, dz = tz - p.z;
      p.x += dx * dt * 1.2;
      p.z += dz * dt * 1.2;
      p.y += (ty - p.y) * dt * 2;
      b.o.rotation.y = Math.atan2(dx, dz);
      const flap = Math.sin(t * 22 + b.ph * 10) * 1.1;
      b.l.rotation.z = flap;
      b.r.rotation.z = -flap;
      b.o.visible = !this.raining;
    }
    // птици
    for (const b of this.birds) {
      b.ph += dt * b.sp;
      const x = b.c.x + Math.cos(b.ph) * b.rad, z = b.c.z + Math.sin(b.ph) * b.rad;
      b.o.position.set(x, b.h + Math.sin(b.ph * 3) * 2, z);
      b.o.rotation.y = -b.ph + Math.PI;
      const flap = Math.sin(t * 7 + b.ph * 20) * 0.6;
      b.l.rotation.z = flap;
      b.r.rotation.z = -flap;
    }
    // дим от работилниците, които работят
    this.smokeT -= dt;
    if (this.smokeT <= 0) {
      this.smokeT = 0.35;
      for (const v of this.farm.views.values()) {
        if (v.def.kind !== 'production' || !v.e.queue?.length) continue;
        const s = new THREE.Sprite(this.smokeMat.clone());
        s.position.copy(v.root.position).add(new THREE.Vector3((Math.random() - 0.5) * 1.2, v.height * 0.95, (Math.random() - 0.5) * 1.2));
        s.scale.setScalar(0.8);
        this.group.add(s);
        this.puffs.push({ s, v: new THREE.Vector3(0.4 + Math.random() * 0.3, 1.2 + Math.random() * 0.5, 0.1), life: 0, max: 3 + Math.random() });
      }
    }
    for (let i = this.puffs.length - 1; i >= 0; i--) {
      const p = this.puffs[i];
      p.life += dt;
      const k = p.life / p.max;
      p.s.position.addScaledVector(p.v, dt);
      p.s.scale.setScalar(0.8 + k * 2.4);
      (p.s.material as THREE.SpriteMaterial).opacity = 0.5 * (1 - k) * Math.min(1, p.life * 3);
      if (k >= 1) {
        this.group.remove(p.s);
        (p.s.material as THREE.Material).dispose();
        this.puffs.splice(i, 1);
      }
    }
    // време: понякога вали
    if (!this.raining) {
      this.nextWeather -= dt;
      if (this.nextWeather <= 0) {
        this.nextWeather = 300 + Math.random() * 400;
        if (Math.random() < 0.45) this.startRain(60 + Math.random() * 40);
      }
    } else {
      this.rainLeft -= dt;
      // дъждът ускорява растежа: всяка секунда нивите „печелят“ още една секунда
      const ms = dt * 1000;
      for (const v of this.farm.views.values()) {
        if (v.def.kind === 'field' && v.e.crop && (v.e.ready ?? 0) > now()) {
          v.e.ready! -= ms;
          v.e.planted! -= ms;
        }
      }
      if (this.rainLeft <= 0) {
        this.raining = false;
        this.onRain(false);
        save();
      }
    }
    const target = this.raining ? 1 : 0;
    this.rainAmt += (target - this.rainAmt) * Math.min(1, dt * 0.6);
    const a = this.rainAmt;
    this.rain.visible = a > 0.02;
    (this.rain.material as THREE.LineBasicMaterial).opacity = 0.55 * a;
    if (this.rain.visible) {
      const c = this.farm.rig.target;
      const pos = this.rain.geometry.attributes.position as THREE.BufferAttribute;
      const arr = pos.array as Float32Array;
      const fall = dt * 32;
      for (let i = 0; i < arr.length; i += 6) {
        arr[i + 1] -= fall;
        arr[i + 4] -= fall;
        if (arr[i + 4] < 0) {
          const x = (Math.random() - 0.5) * 90, y = 40 + Math.random() * 8, z = (Math.random() - 0.5) * 90;
          arr[i] = x; arr[i + 1] = y; arr[i + 2] = z;
          arr[i + 3] = x + 0.15; arr[i + 4] = y - 1.1; arr[i + 5] = z + 0.1;
        }
      }
      pos.needsUpdate = true;
      this.rain.position.set(c.x, 0, c.z);
    }
    // по-тъмно и сиво, докато вали
    this.engine.sun.intensity = this.baseSun * (1 - a * 0.55);
    this.engine.hemi.intensity = this.baseHemi * (1 - a * 0.3);
    const fog = this.scene.fog as THREE.Fog;
    fog.color.copy(SKY.fog).lerp(new THREE.Color('#9aa6b0'), a * 0.8);
    fog.near = 260 - a * 160;
    void S;
  }
}
