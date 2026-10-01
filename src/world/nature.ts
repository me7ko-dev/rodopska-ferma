import * as THREE from 'three';
import { rng, fbm } from '../engine/noise';
import { instancedModel, type Placement } from '../engine/instancing';
import { windify } from '../engine/wind';
import { heightAt, roadZAt, ROAD_W, FARM, VILLAGE_PLOTS, POND, DRIVE, ROAD_Z } from './layout';

/** Може ли да расте нещо тук (не е на пътя, във фермата, в двор на къща). */
function free(x: number, z: number, margin = 0) {
  if (Math.abs(z - roadZAt(x)) < ROAD_W / 2 + 2 + margin) return false;
  if (x > FARM.minX - 2 - margin && x < FARM.maxX + 2 + margin && z > FARM.minZ - 2 - margin && z < FARM.maxZ + 2 + margin) return false;
  for (const p of VILLAGE_PLOTS) if (Math.abs(x - p.x) < 8 + margin && Math.abs(z - p.z) < 8 + margin) return false;
  if (Math.abs(x - DRIVE.x) < 4 && z > FARM.maxZ - 2 && z < ROAD_Z) return false;
  if (x > 40 && x < 175 && Math.abs(z - ROAD_Z) < 24 && Math.abs(z - ROAD_Z) > 6 && margin === 0) {
    // между къщите в селото — оставяме по малко
    return ((x * 7 + z * 3) | 0) % 5 === 0;
  }
  return true;
}

/** Евтин бор от два конуса (за далечните гори по хълмовете — хиляди дървета). */
function cheapPineGeometry() {
  const trunk = new THREE.CylinderGeometry(0.18, 0.28, 1.6, 5).translate(0, 0.8, 0);
  const c1 = new THREE.ConeGeometry(1.6, 3.2, 7).translate(0, 2.6, 0);
  const c2 = new THREE.ConeGeometry(1.2, 2.6, 7).translate(0, 4.0, 0);
  const c3 = new THREE.ConeGeometry(0.75, 1.9, 7).translate(0, 5.2, 0);
  const geos = [trunk, c1, c2, c3];
  const colors = [new THREE.Color('#6b4a2f'), new THREE.Color('#2f6b36'), new THREE.Color('#357a3c'), new THREE.Color('#3d8a44')];
  geos.forEach((g, i) => {
    const n = g.attributes.position.count;
    const col = new Float32Array(n * 3);
    for (let j = 0; j < n; j++) {
      const k = i === 0 ? 1 : 0.85 + (g.attributes.position.getY(j) % 1) * 0.15;
      col[j * 3] = colors[i].r * k; col[j * 3 + 1] = colors[i].g * k; col[j * 3 + 2] = colors[i].b * k;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  });
  return mergeSimple(geos);
}

function mergeSimple(geos: THREE.BufferGeometry[]) {
  const pos: number[] = [], nor: number[] = [], col: number[] = [], idx: number[] = [];
  let off = 0;
  for (const g0 of geos) {
    const g = g0.index ? g0 : g0;
    const p = g.attributes.position, n = g.attributes.normal, c = g.attributes.color;
    for (let i = 0; i < p.count; i++) {
      pos.push(p.getX(i), p.getY(i), p.getZ(i));
      nor.push(n.getX(i), n.getY(i), n.getZ(i));
      col.push(c.getX(i), c.getY(i), c.getZ(i));
    }
    if (g.index) for (let i = 0; i < g.index.count; i++) idx.push(g.index.getX(i) + off);
    else for (let i = 0; i < p.count; i++) idx.push(i + off);
    off += p.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  out.setIndex(idx);
  return out;
}

export function buildNature(quality: 'low' | 'medium' | 'high') {
  const root = new THREE.Group();
  root.name = 'nature';
  const r = rng(1234);
  const q = quality === 'high' ? 1 : quality === 'medium' ? 0.65 : 0.4;

  // --- далечни гори по хълмовете (евтини борове) ---
  const far: THREE.Matrix4[] = [];
  const m = new THREE.Matrix4(), qq = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < 11000 * q; i++) {
    const x = -650 + r() * 1400, z = -700 + r() * 1400;
    const h = heightAt(x, z);
    if (h < 3 || h > 160) continue;
    const dens = fbm(x * 0.012, z * 0.012, 3);
    if (dens < 0.42 + (h > 110 ? 0.2 : 0)) continue;
    if (!free(x, z, 6)) continue;
    const sc = 1.6 + r() * 1.8;
    qq.setFromAxisAngle(up, r() * 6.28);
    s.set(sc, sc * (0.9 + r() * 0.4), sc);
    p.set(x, h - 0.3, z);
    far.push(m.compose(p, qq, s).clone());
  }
  const pineGeo = cheapPineGeometry();
  const pineMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true });
  const farMesh = new THREE.InstancedMesh(pineGeo, pineMat, far.length);
  far.forEach((mm, i) => farMesh.setMatrixAt(i, mm));
  farMesh.castShadow = false;
  farMesh.receiveShadow = true;
  farMesh.computeBoundingSphere();
  root.add(farMesh);

  // --- близки красиви дървета около фермата и селото ---
  const near: Record<string, Placement[]> = {};
  const add = (name: string, x: number, z: number, sc: number) => {
    (near[name] ||= []).push({ x, y: heightAt(x, z), z, rot: r() * 6.28, scale: sc });
  };
  const pines = ['n_pine4', 'n_pine4', 'n_pine2', 'n_pine3'];
  const leafy = ['tree_b', 'tree_d', 'tree_b', 'tree_d', 'n_tree5', 'n_tree1'];
  const nearMax = Math.round(200 * q);
  let nearCount = 0;
  for (let i = 0; i < 6000 && nearCount < nearMax; i++) {
    const x = -140 + r() * 360, z = -130 + r() * 230;
    const d = Math.max(0, Math.hypot(Math.max(FARM.minX - x, 0, x - 175), Math.max(FARM.minZ - z, 0, z - FARM.maxZ - 30)));
    if (d < 4 || d > 60) continue;
    const dens = fbm(x * 0.03 + 4, z * 0.03, 3) + (d > 30 ? 0.12 : 0);
    if (dens < 0.5) continue;
    if (!free(x, z, 1)) continue;
    if (Math.hypot((x - POND.x) / (POND.rx + 3), (z - POND.z) / (POND.rz + 3)) < 1) continue;
    const h = heightAt(x, z);
    nearCount++;
    const usePine = h > 6 || r() < 0.35;
    if (usePine) add(pines[(r() * pines.length) | 0], x, z, 1);
    else add(leafy[(r() * leafy.length) | 0], x, z, 1);
  }
  const sizes: Record<string, number> = { n_pine4: 10, n_pine2: 10, n_pine3: 9.5, n_tree1: 8, n_tree2: 7.5, n_tree5: 8.5, tree_b: 6.5, tree_d: 6 };
  for (const [name, list] of Object.entries(near)) {
    for (const pl of list) pl.scale = 0.75 + r() * 0.5;
    const g = instancedModel(name, sizes[name] ?? 8, list, { by: 'y' });
    windify(g, 10, 0.18, (mt) => /Leaves|Green/i.test(mt.name));
    root.add(g);
  }

  // --- трева, цветя, храсти, камъни ---
  const deco: Record<string, Placement[]> = {};
  const addD = (name: string, x: number, z: number, sc: number) => {
    (deco[name] ||= []).push({ x, y: heightAt(x, z), z, rot: r() * 6.28, scale: sc });
  };
  const grasses = ['n_grass', 'n_grass', 'n_grass', 'n_grass', 'n_grass_tall', 'n_grass_wispy2'];
  const flowers = ['n_petal_pink', 'n_petal_white', 'n_petal_purple', 'n_petal_yellow', 'n_petal_red', 'n_petal_pink', 'n_petal_white', 'n_petal_yellow', 'n_flower_single', 'n_flower_group2'];
  const plants = ['n_fern', 'n_plant_big1', 'n_plant1', 'n_clover1', 'n_plant2', 'n_plant_big2'];
  for (let i = 0; i < 6500 * q; i++) {
    const x = -95 + r() * 290, z = -80 + r() * 150;
    if (!free(x, z)) continue;
    const h = heightAt(x, z);
    if (h > 25) continue;
    const t = r();
    if (t < 0.62) addD(grasses[(r() * grasses.length) | 0], x, z, 0.8 + r() * 0.6);
    else if (t < 0.82) addD(flowers[(r() * flowers.length) | 0], x, z, 0.8 + r() * 0.5);
    else if (t < 0.97) addD(plants[(r() * plants.length) | 0], x, z, 0.8 + r() * 0.6);
    else addD(['n_rock1', 'n_rock2', 'n_rock3'][(r() * 3) | 0], x, z, 0.5 + r() * 1.2);
  }
  // по края на фермата — гъста ивица трева и цветя (като жив плет)
  for (let i = 0; i < 900 * q; i++) {
    const side = (r() * 4) | 0;
    let x = 0, z = 0;
    const o = 2.5 + r() * 3;
    if (side === 0) { x = FARM.minX - o; z = FARM.minZ + r() * (FARM.maxZ - FARM.minZ); }
    if (side === 1) { x = FARM.maxX + o; z = FARM.minZ + r() * (FARM.maxZ - FARM.minZ); }
    if (side === 2) { z = FARM.minZ - o; x = FARM.minX + r() * (FARM.maxX - FARM.minX); }
    if (side === 3) { z = FARM.maxZ + o; x = FARM.minX + r() * (FARM.maxX - FARM.minX); if (Math.abs(x - DRIVE.x) < 4) continue; }
    const t = r();
    if (t < 0.55) addD(grasses[(r() * grasses.length) | 0], x, z, 0.9 + r() * 0.7);
    else if (t < 0.85) addD(flowers[(r() * flowers.length) | 0], x, z, 0.9 + r() * 0.5);
    else if (r() < 0.25) addD('n_bush_flowers', x, z, 0.9 + r() * 0.6);
    else addD('n_flower_group1', x, z, 0.9 + r() * 0.4);
  }
  const dsize: Record<string, number> = {
    n_grass: 0.7, n_grass_wispy1: 0.9, n_grass_wispy2: 0.9, n_grass_tall: 1.2,
    n_flower_group1: 0.9, n_flower_group2: 0.8, n_flower_yellow: 0.8, n_flower_single: 0.7,
    n_petal_pink: 0.35, n_petal_white: 0.35, n_petal_purple: 0.35, n_petal_yellow: 0.35, n_petal_red: 0.35,
    n_bush_flowers: 1.6, n_fern: 1.1, n_plant_big1: 1.2, n_plant1: 0.8, n_plant2: 0.9, n_plant_big2: 1.1, n_clover1: 0.5, n_clover2: 0.5,
    n_rock1: 1.4, n_rock2: 1.2, n_rock3: 1.3,
  };
  for (const [name, list] of Object.entries(deco)) {
    const g = instancedModel(name, dsize[name] ?? 1, list, { shadow: /rock|bush/.test(name), by: 'y' });
    if (!/rock/.test(name)) windify(g, 1.2, 0.08);
    root.add(g);
  }
  return root;
}
