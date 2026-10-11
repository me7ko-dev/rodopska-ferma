import * as THREE from 'three';
import { Kit, kitMeshes } from '../engine/kit';
import { signTexture } from './railway';
import { DRIVE, FARM } from './layout';
import type { Holiday } from '../game/holidays';

// Празнична украса над входа на фермата: два стълба, надпис и гирлянд (лампички, фенери или мартенички).

export class Garland {
  group = new THREE.Group();
  private glow: THREE.MeshStandardMaterial[] = [];
  private t = 0;

  constructor(scene: THREE.Scene, h: Holiday) {
    const k = new Kit();
    const half = DRIVE.w / 2 + 1.6;
    for (const s of [-1, 1]) {
      k.box('trim', 0.22, 5.2, 0.22, '#7a4a22', s * half, 2.6, 0);
      k.box('trim', 0.34, 0.2, 0.34, '#5a3418', s * half, 5.25, 0);
    }
    this.group.add(kitMeshes(k));
    const text = h.id === 'newyear' ? 'ЧЕСТИТА НОВА ГОДИНА!' : h.id === 'martenitsa' ? 'ЧЕСТИТА БАБА МАРТА!' : `ЧЕСТИТ ${h.name.toUpperCase()}!`;
    const bg = h.id === 'martenitsa' ? '#c0392b' : h.id === 'newyear' ? '#1f3a5f' : '#2f6b4f';
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(half * 2 - 0.3, 0.95), new THREE.MeshStandardMaterial({ map: signTexture(text, bg, '#ffe9b0', 1024, 140), side: THREE.DoubleSide, roughness: 0.7 }));
    banner.position.set(0, 4.55, 0);
    banner.material.userData.noSnow = true;
    this.group.add(banner);
    // гирлянд по провиснала линия
    const n = 13;
    const cols = h.deco === 'bulbs' ? ['#ff3b30', '#ffd60a', '#34c759', '#30b0ff', '#ff6fa8'] : h.deco === 'lanterns' ? ['#ff9a1e', '#2ecc71', '#e5332a', '#ffd23a'] : ['#e5332a', '#ffffff'];
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 24; i++) {
      const u = i / 24;
      pts.push(new THREE.Vector3(-half + u * half * 2, 3.85 - Math.sin(u * Math.PI) * 0.55, 0.05));
    }
    const rope = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.02, 4), new THREE.MeshStandardMaterial({ color: '#3a2a1a' }));
    this.group.add(rope);
    for (let i = 1; i < n; i++) {
      const u = i / n;
      const x = -half + u * half * 2, y = 3.85 - Math.sin(u * Math.PI) * 0.55;
      const c = cols[i % cols.length];
      const m = new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.3, roughness: 0.4 });
      m.userData.noSnow = true;
      this.glow.push(m);
      let o: THREE.Object3D;
      if (h.deco === 'bulbs') o = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), m);
      else if (h.deco === 'lanterns') {
        o = new THREE.Group();
        o.add(new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.32, 10), m));
        const cap = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.12, 10), new THREE.MeshStandardMaterial({ color: '#c9a046', metalness: 0.6, roughness: 0.3 }));
        cap.position.y = 0.22;
        o.add(cap);
        o.position.y = -0.22;
      } else {
        // мартеничка: червен и бял пискюл
        o = new THREE.Group();
        const red = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 0.32, 8), i % 2 ? m : new THREE.MeshStandardMaterial({ color: '#e5332a' }));
        const white = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 0.32, 8), new THREE.MeshStandardMaterial({ color: '#f6f1e6' }));
        red.position.x = -0.09; white.position.x = 0.09;
        o.add(red, white);
        o.position.y = -0.2;
      }
      const g = new THREE.Group();
      g.position.set(x, y, 0.05);
      g.add(o);
      this.group.add(g);
    }
    this.group.position.set(DRIVE.x, 0, FARM.maxZ + 1.1);
    this.group.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; });
    scene.add(this.group);
  }

  update(dt: number, night: number) {
    this.t += dt;
    this.glow.forEach((m, i) => (m.emissiveIntensity = 0.3 + night * (1.6 + Math.sin(this.t * 3 + i * 1.7) * 0.6)));
  }
}
