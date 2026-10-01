import * as THREE from 'three';
import { instance } from './assets';

export interface Placement {
  x: number;
  y: number;
  z: number;
  rot: number;
  scale: number;
}

/**
 * Много копия на един модел с малко рисувания (InstancedMesh за всяка част на модела).
 * size — големина на модела (както в instance()).
 */
export function instancedModel(name: string, size: number, list: Placement[], opts: { shadow?: boolean; by?: 'max' | 'x' | 'y' | 'z' } = {}) {
  const group = new THREE.Group();
  group.name = 'inst:' + name;
  if (!list.length) return group;
  const proto = instance(name, size, opts.by ?? 'max');
  proto.updateMatrixWorld(true);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  proto.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const local = mesh.matrixWorld.clone();
    const im = new THREE.InstancedMesh(mesh.geometry, mesh.material, list.length);
    list.forEach((pl, i) => {
      q.setFromAxisAngle(up, pl.rot);
      s.setScalar(pl.scale);
      p.set(pl.x, pl.y, pl.z);
      m.compose(p, q, s).multiply(local);
      im.setMatrixAt(i, m);
    });
    im.castShadow = opts.shadow ?? true;
    im.receiveShadow = true;
    im.computeBoundingSphere();
    group.add(im);
  });
  return group;
}
