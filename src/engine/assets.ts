import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);

interface Entry {
  gltf: GLTF;
  size: THREE.Vector3;
  skinned: boolean;
}

const cache = new Map<string, Entry>();
const pending = new Map<string, Promise<Entry>>();
const BASE = import.meta.env.BASE_URL + 'models/';

/** Оправя материалите: без метален вид, листата с изрязване (а не прозрачност), сенки. */
function fixMaterials(root: THREE.Object3D) {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.castShadow = true;
    m.receiveShadow = true;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    for (const mat of mats as THREE.MeshStandardMaterial[]) {
      if (!mat) continue;
      if ('metalness' in mat) {
        mat.metalness = Math.min(mat.metalness, 0.15);
        mat.roughness = Math.max(mat.roughness, 0.55);
      }
      if (mat.transparent && mat.map) {
        mat.transparent = false;
        mat.alphaTest = 0.45;
        // с MSAA листата и тревата получават меки ръбове вместо назъбени точки
        mat.alphaToCoverage = true;
        mat.depthWrite = true;
        mat.side = THREE.DoubleSide;
      }
      if (mat.map) mat.map.anisotropy = 8;
    }
  });
}

export function loadModel(name: string): Promise<Entry> {
  const c = cache.get(name);
  if (c) return Promise.resolve(c);
  let p = pending.get(name);
  if (p) return p;
  p = loader.loadAsync(BASE + name + '.glb').then((gltf) => {
    fixMaterials(gltf.scene);
    let skinned = false;
    gltf.scene.traverse((o) => { if ((o as THREE.SkinnedMesh).isSkinnedMesh) skinned = true; });
    gltf.scene.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(gltf.scene);
    const e: Entry = { gltf, size: box.getSize(new THREE.Vector3()), skinned };
    cache.set(name, e);
    return e;
  });
  pending.set(name, p);
  return p;
}

export async function loadAll(names: string[], onProgress?: (done: number, total: number) => void) {
  let done = 0;
  const uniq = [...new Set(names)];
  await Promise.all(
    uniq.map((n) =>
      loadModel(n)
        .catch((e) => console.warn('модел', n, e))
        .finally(() => onProgress?.(++done, uniq.length)),
    ),
  );
}

export function has(name: string) {
  return cache.has(name);
}

export function animationsOf(name: string) {
  return cache.get(name)?.gltf.animations ?? [];
}

/**
 * Копие на модел. size — желаната големина по най-голямото измерение (или по височина с by='y').
 * Моделът се центрира по X/Z и стъпва на земята (y=0).
 */
export function instance(name: string, size?: number, by: 'max' | 'x' | 'y' | 'z' = 'max'): THREE.Group {
  const e = cache.get(name);
  const wrap = new THREE.Group();
  wrap.name = name;
  if (!e) {
    console.warn('липсва модел', name);
    wrap.userData.size = new THREE.Vector3(size ?? 1, size ?? 1, size ?? 1);
    // зареждаме го и го слагаме, щом пристигне
    loadModel(name).then(() => {
      const real = instance(name, size, by);
      wrap.add(...real.children);
      wrap.userData.size = real.userData.size;
    }).catch(() => {});
    return wrap;
  }
  const obj = e.skinned ? SkeletonUtils.clone(e.gltf.scene) : e.gltf.scene.clone(true);
  const box = new THREE.Box3().setFromObject(e.gltf.scene);
  const s = e.size;
  let k = 1;
  if (size) {
    const ref = by === 'max' ? Math.max(s.x, s.y, s.z) : s[by];
    k = size / (ref || 1);
  }
  obj.scale.multiplyScalar(k);
  const c = box.getCenter(new THREE.Vector3());
  obj.position.set(-c.x * k, -box.min.y * k, -c.z * k);
  wrap.add(obj);
  wrap.userData.size = s.clone().multiplyScalar(k);
  return wrap;
}

/** Смяна на цвета на материал по име (напр. да пребоядисаме кола). Материалите се копират, за да не се боядисат всички. */
export function recolor(root: THREE.Object3D, match: (mat: THREE.MeshStandardMaterial) => boolean, color: THREE.ColorRepresentation) {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    const next = mats.map((mat) => {
      const sm = mat as THREE.MeshStandardMaterial;
      if (!match(sm)) return mat;
      const c = sm.clone();
      c.color = new THREE.Color(color);
      return c;
    });
    m.material = Array.isArray(m.material) ? next : next[0];
  });
}

export function sizeOf(name: string) {
  return cache.get(name)?.size.clone() ?? new THREE.Vector3(1, 1, 1);
}
