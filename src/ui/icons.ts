import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { itemModel, hasItemModel } from '../game/items3d';
import { instance, loadModel, has } from '../engine/assets';
import { BUILDINGS, CARS, ANIMALS } from '../game/data';

// Иконите се рисуват веднъж от 3D моделите в отделен малък рендерер и се пазят като картинки.

const SIZE = 160;
let R: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene, cam: THREE.PerspectiveCamera;
const cache = new Map<string, string>();
const waiting = new Set<string>();

function setup() {
  if (R) return;
  const cv = document.createElement('canvas');
  cv.width = cv.height = SIZE;
  R = new THREE.WebGLRenderer({ canvas: cv, alpha: true, antialias: true, preserveDrawingBuffer: true });
  R.setPixelRatio(1);
  R.setSize(SIZE, SIZE, false);
  R.outputColorSpace = THREE.SRGBColorSpace;
  R.toneMapping = THREE.NeutralToneMapping;
  R.toneMappingExposure = 1.1;
  R.setClearColor(0x000000, 0);
  scene = new THREE.Scene();
  const pm = new THREE.PMREMGenerator(R);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.7;
  scene.add(new THREE.HemisphereLight(0xffffff, 0xb59a74, 1.3));
  const key = new THREE.DirectionalLight(0xfff4e0, 2.6);
  key.position.set(-2, 4, 3);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xdfefff, 1.2);
  rim.position.set(3, 2, -3);
  scene.add(rim);
  cam = new THREE.PerspectiveCamera(30, 1, 0.01, 200);
}

function render(obj: THREE.Object3D, view: 'item' | 'model' = 'item') {
  setup();
  const holder = new THREE.Group();
  holder.add(obj);
  scene.add(holder);
  holder.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(holder);
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  const dir = view === 'item' ? new THREE.Vector3(0.35, 0.55, 1) : new THREE.Vector3(0.9, 0.75, 1);
  dir.normalize();
  const dist = (sphere.radius / Math.sin(THREE.MathUtils.degToRad(cam.fov / 2))) * 1.02;
  cam.position.copy(sphere.center).addScaledVector(dir, dist);
  cam.lookAt(sphere.center);
  cam.near = dist / 50;
  cam.far = dist * 4;
  cam.updateProjectionMatrix();
  R!.render(scene, cam);
  const url = R!.domElement.toDataURL('image/png');
  scene.remove(holder);
  return url;
}

function modelFor(id: string): { name: string; size: number } | null {
  if (id.startsWith('b:')) {
    const b = BUILDINGS[id.slice(2)];
    return b && b.model ? { name: b.model, size: b.size || 4 } : null;
  }
  if (id.startsWith('car:')) {
    const c = CARS.find((c) => c.id === id.slice(4));
    return c ? { name: c.model, size: c.size } : null;
  }
  if (id.startsWith('m:')) return { name: id.slice(2), size: 4 };
  if (id.startsWith('animal:')) {
    const a = ANIMALS[id.slice(7)];
    return a && a.model ? { name: a.model, size: 2 } : null;
  }
  return null;
}

/** Връща картинката (data URL) веднага, ако е готова; иначе празен низ и я подготвя. */
export function icon(id: string): string {
  const c = cache.get(id);
  if (c) return c;
  if (hasItemModel(id) || !modelFor(id)) {
    const url = render(itemModel(hasItemModel(id) ? id : 'coin'));
    cache.set(id, url);
    return url;
  }
  const mf = modelFor(id)!;
  if (has(mf.name)) {
    const url = render(instance(mf.name, mf.size), 'model');
    cache.set(id, url);
    return url;
  }
  if (!waiting.has(id)) {
    waiting.add(id);
    loadModel(mf.name).then(() => {
      waiting.delete(id);
      icon(id);
      document.querySelectorAll<HTMLImageElement>(`img[data-icon="${CSS.escape(id)}"]`).forEach((im) => (im.src = cache.get(id) || ''));
    });
  }
  return '';
}

const BLANK = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
export function img(id: string, cls = 'ic') {
  return `<img class="${cls}" data-icon="${id}" src="${icon(id) || BLANK}" alt="" draggable="false">`;
}
