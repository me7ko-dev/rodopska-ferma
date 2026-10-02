import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export type Quality = 'low' | 'medium' | 'high';

export const IS_TOUCH = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

function detectQuality(): Quality {
  const saved = localStorage.getItem('rf-quality') as Quality | null;
  if (saved === 'low' || saved === 'medium' || saved === 'high') return saved;
  const cores = navigator.hardwareConcurrency || 4;
  if (IS_TOUCH) return cores >= 8 ? 'medium' : 'low';
  return 'high';
}

export type Updater = (dt: number, t: number) => void;

/** Текущото качество (за модули, които нямат достъп до Engine). */
export const QUALITY: { value: Quality } = { value: 'high' };

/** Рендерер, сцена, светлини и главният цикъл. */
export class Engine {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  sun: THREE.DirectionalLight;
  hemi: THREE.HemisphereLight;
  quality: Quality;
  time = { value: 0 };
  private updaters: Updater[] = [];
  private last = performance.now();
  private sunOffset = new THREE.Vector3(-38, 62, 30);
  fps = 60;
  /** Динамична резолюция: рисуваме възможно най-рязко, без да падат кадрите. */
  private prMax = 1;
  private prMin = 1;
  private prCeil = 1;
  private pr = 1;
  private prSlow = 0;
  private prGood = 0;
  private prStart = performance.now();
  private prSpan = 3000;
  private prFrames = 0;

  constructor(public canvas: HTMLCanvasElement) {
    this.quality = detectQuality();
    QUALITY.value = this.quality;
    // изглаждане на ръбовете (MSAA) винаги — без него всичко е назъбено и „на точки“
    const r = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', stencil: false });
    this.renderer = r;
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.NeutralToneMapping;
    r.toneMappingExposure = 1.0;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    this.applyPixelRatio();

    this.camera = new THREE.PerspectiveCamera(32, 1, 1, 1600);

    // Меко околно осветление (отражения по боята и пластмасата)
    const pmrem = new THREE.PMREMGenerator(r);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.42;

    this.hemi = new THREE.HemisphereLight(0xcfe8ff, 0x7a9a48, 1.15);
    this.scene.add(this.hemi);

    const sun = new THREE.DirectionalLight(0xfff1dc, 2.75);
    sun.castShadow = true;
    const ms = this.quality === 'high' ? 4096 : 2048;
    sun.shadow.mapSize.set(ms, ms);
    const sc = sun.shadow.camera;
    sc.left = -60; sc.right = 60; sc.top = 60; sc.bottom = -60; sc.near = 1; sc.far = 260;
    sun.shadow.bias = -0.00025;
    sun.shadow.normalBias = 0.035;
    sun.shadow.radius = 3;
    this.sun = sun;
    this.scene.add(sun, sun.target);

    addEventListener('resize', () => this.resize());
    this.resize();
  }

  applyPixelRatio() {
    const dpr = devicePixelRatio || 1;
    // На екран с ниска плътност (обикновен монитор) рисуваме по-едро и смаляваме — още по-гладки ръбове
    const cap = this.quality === 'high' ? 3 : this.quality === 'medium' ? 2.5 : 2;
    this.prMax = Math.min(Math.max(dpr, this.quality === 'high' ? 1.5 : 1), cap);
    this.prMin = Math.min(this.prMax, this.quality === 'low' ? 0.85 : 1);
    this.prCeil = this.prMax;
    this.setPR(this.prMax);
  }

  private setPR(v: number) {
    v = Math.round(Math.min(this.prCeil, Math.max(this.prMin, v)) * 100) / 100;
    if (v === this.pr && this.renderer.getPixelRatio() === v) return;
    this.pr = v;
    this.renderer.setPixelRatio(v);
    this.renderer.setSize(innerWidth, innerHeight, false);
  }

  /** Веднъж в секунда: ако кадрите не стигат — малко по-ниска резолюция; ако има запас — по-висока. */
  private adaptResolution(now: number) {
    this.prFrames++;
    const span = now - this.prStart;
    if (span < this.prSpan) return;
    // истински кадри в секунда за последния интервал (не изгладени и не орязани)
    const fps = (this.prFrames * 1000) / span;
    this.prFrames = 0;
    this.prStart = now;
    this.prSpan = 1000;
    if (document.hidden || span > 5000) return; // скрит раздел или пауза — не съдим
    const step = 0.25;
    if (fps < 48) {
      if (++this.prSlow >= 2 && this.pr > this.prMin) {
        // нивото, на което не стигна, става таван (за да не скача напред-назад)
        this.prCeil = Math.max(this.prMin, this.pr - step);
        this.setPR(this.pr - (fps < 35 ? 2 * step : step));
        this.prSlow = 0;
        this.prGood = 0;
        this.prSpan = 2000; // новата резолюция се успокоява
      }
      return;
    }
    this.prSlow = 0;
    if (fps > 56) {
      this.prGood++;
      // след дълго спокойствие таванът бавно се вдига обратно
      if (this.prGood % 30 === 0 && this.prCeil < this.prMax) this.prCeil = Math.min(this.prMax, this.prCeil + step);
      if (this.prGood >= 4 && this.pr < this.prCeil) {
        this.setPR(this.pr + step);
        this.prGood = 0;
      }
    } else this.prGood = 0;
  }

  setQuality(q: Quality) {
    localStorage.setItem('rf-quality', q);
    location.reload();
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // На тесен (вертикален) екран разширяваме зрителния ъгъл, за да се вижда повече от фермата
    this.camera.fov = w < h ? 44 : 32;
    this.camera.updateProjectionMatrix();
  }

  /** Сянката следва мястото, което гледаме (за по-остри сенки). */
  followShadow(target: THREE.Vector3, span: number) {
    const s = Math.max(40, span);
    const sc = this.sun.shadow.camera;
    if (Math.abs(sc.right - s) > 2) {
      sc.left = -s; sc.right = s; sc.top = s; sc.bottom = -s;
      sc.updateProjectionMatrix();
    }
    // закръгляме към пиксел на сянката, за да не трепти при местене
    const texel = (2 * s) / this.sun.shadow.mapSize.x;
    const tx = Math.round(target.x / texel) * texel, tz = Math.round(target.z / texel) * texel;
    this.sun.target.position.set(tx, 0, tz);
    this.sun.position.set(tx + this.sunOffset.x, this.sunOffset.y, tz + this.sunOffset.z);
  }

  setSunOffset(x: number, y: number, z: number) {
    this.sunOffset.set(x, y, z);
  }

  onUpdate(f: Updater) {
    this.updaters.push(f);
  }

  start() {
    const loop = (now: number) => {
      requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      this.fps = this.fps * 0.95 + (1 / Math.max(dt, 0.001)) * 0.05;
      this.time.value += dt;
      for (const u of this.updaters) u(dt, this.time.value);
      this.adaptResolution(now);
      this.renderer.render(this.scene, this.camera);
    };
    requestAnimationFrame(loop);
  }
}
