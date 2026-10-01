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

  constructor(public canvas: HTMLCanvasElement) {
    this.quality = detectQuality();
    const r = new THREE.WebGLRenderer({ canvas, antialias: this.quality !== 'low', powerPreference: 'high-performance', stencil: false });
    this.renderer = r;
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.NeutralToneMapping;
    r.toneMappingExposure = 1.0;
    r.shadowMap.enabled = true;
    r.shadowMap.type = this.quality === 'low' ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
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
    const ms = this.quality === 'high' ? 4096 : this.quality === 'medium' ? 2048 : 1024;
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
    const cap = this.quality === 'high' ? 2 : this.quality === 'medium' ? 1.5 : 1;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, cap));
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
      this.renderer.render(this.scene, this.camera);
    };
    requestAnimationFrame(loop);
  }
}
