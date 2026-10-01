import * as THREE from 'three';
import type { Engine } from '../engine/engine';
import { SKY } from './sky';
import { ROAD_Z, ROAD_W, POND } from './layout';

// Ден и нощ по истинския часовник: изгрев, ден, златен залез, лунна нощ със звезди, фенери и светулки.

type Key = { h: number; sun: string; sunI: number; sky: string; ground: string; hemiI: number; env: number; top: string; hor: string; fog: string; exp: number; elev: number; night: number };
const NIGHT: Omit<Key, 'h'> = { sun: '#7f9cff', sunI: 0.8, sky: '#4566b8', ground: '#1c2633', hemiI: 1.05, env: 0.25, top: '#0b1634', hor: '#26386a', fog: '#1d2b52', exp: 1.15, elev: 0.75, night: 1 };
const DAY: Omit<Key, 'h'> = { sun: '#fff1dc', sunI: 2.75, sky: '#cfe8ff', ground: '#7a9a48', hemiI: 1.15, env: 0.42, top: '#5aa7f0', hor: '#d9eefc', fog: '#cfe6f7', exp: 1.0, elev: 1, night: 0 };
const KEYS: Key[] = [
  { h: 0, ...NIGHT },
  { h: 5, ...NIGHT },
  { h: 6.5, sun: '#ffb27a', sunI: 1.8, sky: '#f0c8a8', ground: '#5a6a38', hemiI: 0.9, env: 0.3, top: '#5d8fd0', hor: '#ffc59a', fog: '#e8c4a8', exp: 1.05, elev: 0.35, night: 0.25 },
  { h: 8.5, ...DAY },
  { h: 17.5, ...DAY },
  { h: 19.3, sun: '#ff9a5a', sunI: 2.1, sky: '#f5b48a', ground: '#6a6a38', hemiI: 0.95, env: 0.32, top: '#4f78c0', hor: '#ffad7a', fog: '#f0b894', exp: 1.05, elev: 0.3, night: 0.15 },
  { h: 20.6, sun: '#b9a8ff', sunI: 1.0, sky: '#5a5f9a', ground: '#3a3a30', hemiI: 0.85, env: 0.25, top: '#1b2550', hor: '#6a5a8a', fog: '#3a3d66', exp: 1.12, elev: 0.6, night: 0.8 },
  { h: 21.5, ...NIGHT },
  { h: 24, ...NIGHT },
];

const c1 = new THREE.Color(), c2 = new THREE.Color();
function mix(a: string, b: string, t: number, out: THREE.Color) {
  return out.set(a).lerp(c2.set(b), t);
}

function glowTexture() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const g = cv.getContext('2d')!;
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,230,160,1)');
  gr.addColorStop(0.25, 'rgba(255,200,110,0.6)');
  gr.addColorStop(1, 'rgba(255,170,60,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export interface SkyRef {
  uniforms: Record<string, THREE.IUniform>;
  stars: THREE.Points;
  cloudMat: THREE.MeshStandardMaterial;
}

export class DayNight {
  mode: 'real' | 'day' = (localStorage.getItem('rf-daynight') as 'real' | 'day') || 'real';
  night = 0; // 0 ден … 1 нощ
  lamps = new THREE.Group();
  bulbMat = new THREE.MeshStandardMaterial({ color: '#fff2c4', emissive: '#ffd27a', emissiveIntensity: 0 });
  glowMat: THREE.SpriteMaterial;
  flies: { s: THREE.Sprite; base: THREE.Vector3; ph: number }[] = [];
  flyMat: THREE.SpriteMaterial;
  hourOverride: number | null = null;
  baseSun = new THREE.Vector3(-38, 62, 30);
  tint: HTMLDivElement;

  constructor(public engine: Engine, public sky: SkyRef, public scene: THREE.Scene) {
    // син нощен оттенък върху картината (под интерфейса)
    this.tint = document.createElement('div');
    this.tint.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:1;background:#5f78c8;mix-blend-mode:multiply;opacity:0;';
    document.body.appendChild(this.tint);
    const tex = glowTexture();
    this.glowMat = new THREE.SpriteMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 });
    this.flyMat = new THREE.SpriteMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0, color: '#d8ff7a' });
    scene.add(this.lamps);
    // фенери по пътя в селото и пред фермата
    const post = new THREE.CylinderGeometry(0.07, 0.1, 3.4, 6).translate(0, 1.7, 0);
    const arm = new THREE.BoxGeometry(0.7, 0.07, 0.07).translate(0.3, 3.35, 0);
    const lantern = new THREE.BoxGeometry(0.32, 0.4, 0.32).translate(0.6, 3.1, 0);
    const postMat = new THREE.MeshStandardMaterial({ color: '#3a3530', roughness: 0.6, metalness: 0.4 });
    const addLamp = (x: number, z: number, rot: number) => {
      const g = new THREE.Group();
      const p = new THREE.Mesh(post, postMat), a = new THREE.Mesh(arm, postMat), l = new THREE.Mesh(lantern, this.bulbMat);
      p.castShadow = true;
      g.add(p, a, l);
      g.position.set(x, 0, z);
      g.rotation.y = rot;
      const s = new THREE.Sprite(this.glowMat);
      s.position.set(0.6, 3.1, 0);
      s.scale.setScalar(4.5);
      g.add(s);
      this.lamps.add(g);
    };
    for (let x = 30; x <= 180; x += 18) {
      addLamp(x, ROAD_Z - ROAD_W / 2 - 1, -Math.PI / 2);
      addLamp(x + 9, ROAD_Z + ROAD_W / 2 + 1, Math.PI / 2);
    }
    addLamp(1, ROAD_Z - ROAD_W / 2 - 1.2, -Math.PI / 2);
    addLamp(11.5, ROAD_Z - ROAD_W / 2 - 1.2, -Math.PI / 2);
    // светулки край езерото и гората
    for (let i = 0; i < 46; i++) {
      const s = new THREE.Sprite(this.flyMat);
      const a = Math.random() * 6.28, r = 6 + Math.random() * 10;
      const base = i < 26
        ? new THREE.Vector3(POND.x + Math.cos(a) * r, 0.8 + Math.random() * 1.4, POND.z + Math.sin(a) * r)
        : new THREE.Vector3(-50 + Math.random() * 110, 0.8 + Math.random(), -36 - Math.random() * 10);
      s.position.copy(base);
      s.scale.setScalar(0.5);
      this.scene.add(s);
      this.flies.push({ s, base, ph: Math.random() * 100 });
    }
  }

  setMode(m: 'real' | 'day') {
    this.mode = m;
    localStorage.setItem('rf-daynight', m);
  }

  hour() {
    if (this.hourOverride != null) return this.hourOverride;
    if (this.mode === 'day') return 12;
    const d = new Date();
    return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
  }

  update(dt: number, t: number, rainDim = 0) {
    const h = this.hour();
    let i = 0;
    while (i < KEYS.length - 2 && KEYS[i + 1].h <= h) i++;
    const a = KEYS[i], b = KEYS[i + 1];
    const k = THREE.MathUtils.clamp((h - a.h) / Math.max(0.0001, b.h - a.h), 0, 1);
    const L = (x: number, y: number) => x + (y - x) * k;
    const e = this.engine;
    mix(a.sun, b.sun, k, e.sun.color);
    e.sun.intensity = L(a.sunI, b.sunI) * (1 - rainDim * 0.55);
    mix(a.sky, b.sky, k, e.hemi.color);
    mix(a.ground, b.ground, k, e.hemi.groundColor);
    e.hemi.intensity = L(a.hemiI, b.hemiI) * (1 - rainDim * 0.3);
    this.scene.environmentIntensity = L(a.env, b.env);
    e.renderer.toneMappingExposure = L(a.exp, b.exp);
    (this.sky.uniforms.top.value as THREE.Color).copy(mix(a.top, b.top, k, c1));
    (this.sky.uniforms.horizon.value as THREE.Color).copy(mix(a.hor, b.hor, k, c1));
    SKY.fog.copy(mix(a.fog, b.fog, k, c1));
    const night = L(a.night, b.night);
    this.night = night;
    (this.sky.stars.material as THREE.PointsMaterial).opacity = Math.max(0, night - 0.3) * 1.3;
    this.sky.cloudMat.emissiveIntensity = 0.45 * (1 - night * 0.8);
    this.sky.cloudMat.color.setScalar(1 - night * 0.6);
    // слънцето е по-ниско при изгрев и залез (по-дълги сенки)
    const elev = L(a.elev, b.elev);
    e.setSunOffset(this.baseSun.x * (2 - elev), this.baseSun.y * (0.35 + elev * 0.65), this.baseSun.z * (2 - elev));
    // фенерите светят нощем
    const lampOn = THREE.MathUtils.clamp((night - 0.35) / 0.4, 0, 1);
    this.bulbMat.emissiveIntensity = lampOn * 2.2;
    this.glowMat.opacity = lampOn;
    this.tint.style.opacity = String(Math.max(0, night - 0.2) * 0.5);
    // светулки
    this.flyMat.opacity = Math.max(0, night - 0.6) * 2;
    if (night > 0.5)
      for (const f of this.flies) {
        f.ph += dt;
        f.s.position.set(f.base.x + Math.sin(f.ph * 0.7) * 1.5, f.base.y + Math.sin(f.ph * 1.3) * 0.4, f.base.z + Math.cos(f.ph * 0.6) * 1.5);
        f.s.scale.setScalar(0.35 + Math.max(0, Math.sin(f.ph * 3 + t)) * 0.4);
      }
  }
}
