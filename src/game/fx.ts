import * as THREE from 'three';
import { icon } from '../ui/icons';

// Ефекти: летящи иконки към горната лента, изскачащ текст, маркери над обектите, подскачане.

let camera: THREE.PerspectiveCamera;
const layer = document.createElement('div');
layer.id = 'fx';
const markerLayer = document.createElement('div');
markerLayer.id = 'markers';

export function initFx(cam: THREE.PerspectiveCamera) {
  camera = cam;
  document.body.appendChild(markerLayer);
  document.body.appendChild(layer);
}

const v = new THREE.Vector3();
export function toScreen(p: THREE.Vector3): { x: number; y: number; vis: boolean } {
  v.copy(p).project(camera);
  return { x: ((v.x + 1) / 2) * innerWidth, y: ((1 - v.y) / 2) * innerHeight, vis: v.z < 1 && v.z > -1 };
}

/** Иконка лети от точка в света до елемент от горната лента (напр. #hud-coins). */
export function flyTo(iconId: string, from: THREE.Vector3 | { x: number; y: number }, targetSel: string, qty = 1, delay = 0) {
  const start = 'isVector3' in from ? toScreen(from as THREE.Vector3) : (from as { x: number; y: number });
  const target = document.querySelector(targetSel) as HTMLElement | null;
  const tr = target?.getBoundingClientRect();
  const tx = tr ? tr.left + tr.width / 2 : innerWidth - 60;
  const ty = tr ? tr.top + tr.height / 2 : 30;
  const n = Math.min(qty, 6);
  for (let i = 0; i < n; i++) {
    const el = document.createElement('img');
    el.src = icon(iconId);
    el.className = 'fly';
    layer.appendChild(el);
    const ox = (Math.random() - 0.5) * 60, oy = (Math.random() - 0.5) * 40;
    const t0 = performance.now() + delay + i * 70;
    const dur = 750 + Math.random() * 150;
    el.style.transform = `translate(${start.x - 24}px, ${start.y - 24}px) scale(0)`;
    const step = (now: number) => {
      const t = (now - t0) / dur;
      if (t < 0) return requestAnimationFrame(step);
      if (t >= 1) {
        el.remove();
        if (target) {
          target.classList.remove('bump');
          void target.offsetWidth;
          target.classList.add('bump');
        }
        return;
      }
      // първо изскача нагоре, после лети по дъга
      const pop = Math.min(1, t / 0.25);
      const k = t < 0.25 ? 0 : (t - 0.25) / 0.75;
      const e = k * k * (3 - 2 * k);
      const sx = start.x + ox * pop, sy = start.y + oy * pop - 40 * pop;
      const x = sx + (tx - sx) * e;
      const y = sy + (ty - sy) * e - Math.sin(e * Math.PI) * 80;
      const s = t < 0.25 ? 0.5 + pop * 0.7 : 1.2 - e * 0.5;
      el.style.transform = `translate(${x - 24}px, ${y - 24}px) scale(${s})`;
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
}

/** Изскачащ текст (напр. „+5“ или „Складът е пълен!“). */
export function popText(text: string, at: THREE.Vector3 | { x: number; y: number }, color = '#fff', big = false) {
  const p = 'isVector3' in at ? toScreen(at as THREE.Vector3) : (at as { x: number; y: number });
  const el = document.createElement('div');
  el.className = 'pop' + (big ? ' big' : '');
  el.textContent = text;
  el.style.color = color;
  el.style.left = p.x + 'px';
  el.style.top = p.y + 'px';
  layer.appendChild(el);
  setTimeout(() => el.remove(), 1400);
}

// ---------- маркери над обектите ----------
export interface Marker {
  el: HTMLElement;
  pos: THREE.Vector3;
  visible: boolean;
  onClick?: () => void;
}
const markers = new Set<Marker>();

export function marker(pos: THREE.Vector3, html = '', cls = 'mk'): Marker {
  const el = document.createElement('div');
  el.className = cls;
  el.innerHTML = html;
  markerLayer.appendChild(el);
  const m: Marker = { el, pos: pos.clone(), visible: false };
  el.addEventListener('pointerdown', (e) => {
    if (m.onClick) {
      e.stopPropagation();
      m.onClick();
    }
  });
  markers.add(m);
  return m;
}

export function removeMarker(m: Marker | null | undefined) {
  if (!m) return;
  m.el.remove();
  markers.delete(m);
}

export function updateMarkers() {
  for (const m of markers) {
    if (!m.visible) {
      if (m.el.style.display !== 'none') m.el.style.display = 'none';
      continue;
    }
    const s = toScreen(m.pos);
    if (!s.vis || s.x < -60 || s.y < -60 || s.x > innerWidth + 60 || s.y > innerHeight + 60) {
      m.el.style.display = 'none';
      continue;
    }
    m.el.style.display = '';
    m.el.style.transform = `translate(${s.x}px, ${s.y}px)`;
  }
}

// ---------- подскачане на 3D обект ----------
const bounces: { o: THREE.Object3D; t: number; base: THREE.Vector3 }[] = [];
export function bounce(o: THREE.Object3D) {
  if (bounces.some((b) => b.o === o)) return;
  bounces.push({ o, t: 0, base: o.scale.clone() });
}
export function updateBounces(dt: number) {
  for (let i = bounces.length - 1; i >= 0; i--) {
    const b = bounces[i];
    b.t += dt;
    const t = b.t / 0.35;
    if (t >= 1) {
      b.o.scale.copy(b.base);
      bounces.splice(i, 1);
      continue;
    }
    const s = 1 + Math.sin(t * Math.PI) * 0.12 * (1 - t);
    const sy = 1 - Math.sin(t * Math.PI * 2) * 0.06 * (1 - t);
    b.o.scale.set(b.base.x * s, b.base.y * sy * s, b.base.z * s);
  }
}

// ---------- искрици (3D частици) ----------
const sparkGeo = new THREE.OctahedronGeometry(0.12, 0);
const sparkMats = ['#ffe066', '#ffffff', '#9be15d', '#ffb347'].map((c) => new THREE.MeshBasicMaterial({ color: c, transparent: true }));
const sparks: { m: THREE.Mesh; v: THREE.Vector3; life: number }[] = [];
let fxScene: THREE.Scene | null = null;
export function setFxScene(s: THREE.Scene) {
  fxScene = s;
}
export function sparkle(at: THREE.Vector3, n = 14, colorIdx?: number) {
  if (!fxScene) return;
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(sparkGeo, sparkMats[colorIdx ?? (i % sparkMats.length)].clone());
    m.position.copy(at);
    const a = Math.random() * Math.PI * 2, up = 3 + Math.random() * 4;
    sparks.push({ m, v: new THREE.Vector3(Math.cos(a) * (1 + Math.random() * 2.5), up, Math.sin(a) * (1 + Math.random() * 2.5)), life: 0.8 + Math.random() * 0.5 });
    fxScene.add(m);
  }
}
export function updateSparks(dt: number) {
  for (let i = sparks.length - 1; i >= 0; i--) {
    const s = sparks[i];
    s.life -= dt;
    s.v.y -= 9 * dt;
    s.m.position.addScaledVector(s.v, dt);
    s.m.rotation.x += dt * 6;
    s.m.rotation.y += dt * 4;
    (s.m.material as THREE.MeshBasicMaterial).opacity = Math.min(1, s.life * 2);
    if (s.life <= 0 || s.m.position.y < 0) {
      fxScene?.remove(s.m);
      (s.m.material as THREE.Material).dispose();
      sparks.splice(i, 1);
    }
  }
}
