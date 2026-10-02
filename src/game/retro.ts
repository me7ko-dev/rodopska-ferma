import * as THREE from 'three';
import { Kit, M, roundedShape, sideExtrude, kitMeshes, bucketMat, type P2 } from '../engine/kit';
import { registerModel } from '../engine/assets';

// Стари коли, направени с код: пикапи от 50-те, малка кола, седани, джип, камион, автобус, кабриолет, бусче, мотор с кош.
// Посоката напред е +Z, земята е y = 0. Размерите са в метри.

type V2 = [number, number];
export interface WheelSpec { x: number; z: number; r: number; w: number; white?: boolean }
export interface CarBuild { kit: Kit; wheels: WheelSpec[] }

const C = {
  rubber: '#1d1d1f', chassis: '#2a2a2c', black: '#141416', grille: '#cfd4d9', wood: '#9b6b3c', woodDark: '#7a5230',
  seat: '#b9825a', cream: '#f2ead6', canvas: '#6f7350', glass: '#22303a', plate: '#f4f4ef', interior: '#3a3330',
};

// ---------- помощни ----------

/** Долна част на каросерията (профил отстрани) с изрязани арки над колелата. */
function lowerProfile(z0: number, z1: number, yb: number, arches: { z: number; r: number; cy: number }[], upper: P2[]): P2[] {
  const pts: P2[] = [[z0, yb]];
  for (const a of [...arches].sort((p, q) => p.z - q.z)) {
    const t0 = Math.asin(THREE.MathUtils.clamp((yb - a.cy) / a.r, -1, 1));
    for (let k = 0; k <= 10; k++) {
      const t = Math.PI - t0 - ((Math.PI - 2 * t0) * k) / 10;
      pts.push([a.z + Math.cos(t) * a.r, a.cy + Math.sin(t) * a.r]);
    }
  }
  pts.push([z1, yb]);
  return pts.concat(upper);
}

function body(kit: Kit, bucket: string, color: THREE.ColorRepresentation, pts: P2[], width: number, bevel = 0.06, x = 0) {
  kit.add(bucket, sideExtrude(roundedShape(pts), width, bevel), color, x ? M.at(x) : undefined);
}

/** Изместен навътре изпъкнал многоъгълник (за отворите на прозорците). */
function inset(pts: V2[], d: number): V2[] {
  const n = pts.length;
  let area = 0;
  for (let i = 0; i < n; i++) { const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % n]; area += x1 * y2 - x2 * y1; }
  const s = area > 0 ? 1 : -1;
  const lines = pts.map((p, i) => {
    const q = pts[(i + 1) % n];
    const dx = q[0] - p[0], dy = q[1] - p[1], l = Math.hypot(dx, dy);
    const nx = (-dy / l) * s, ny = (dx / l) * s; // навътре
    return { px: p[0] + nx * d, py: p[1] + ny * d, dx, dy };
  });
  return lines.map((L1, i) => {
    const L0 = lines[(i - 1 + n) % n];
    const den = L0.dx * L1.dy - L0.dy * L1.dx;
    if (Math.abs(den) < 1e-6) return [L1.px, L1.py] as V2;
    const t = ((L1.px - L0.px) * L1.dy - (L1.py - L0.py) * L1.dx) / den;
    return [L0.px + L0.dx * t, L0.py + L0.dy * t] as V2;
  });
}

/** Отрязва многоъгълник: остава частта с x между a и b. */
function clipX(pts: V2[], a: number, b: number): V2[] {
  const clip = (poly: V2[], keep: (p: V2) => boolean, x: number) => {
    const out: V2[] = [];
    for (let i = 0; i < poly.length; i++) {
      const P = poly[i], Q = poly[(i + 1) % poly.length];
      const ip = keep(P), iq = keep(Q);
      if (ip) out.push(P);
      if (ip !== iq) { const t = (x - P[0]) / (Q[0] - P[0]); out.push([x, P[1] + (Q[1] - P[1]) * t]); }
    }
    return out;
  };
  return clip(clip(pts, (p) => p[0] >= a, a), (p) => p[0] <= b, b);
}

/** Тънка плоча по отсечка A→B в профила (предно/задно стъкло), леко изнесена навън. */
function slab(kit: Kit, bucket: string, color: THREE.ColorRepresentation, A: V2, B: V2, w: number, out: number, margin = 0.06, thick = 0.025, center?: V2) {
  const dz = B[0] - A[0], dy = B[1] - A[1], L = Math.hypot(dz, dy);
  const th = Math.atan2(-dy, dz);
  let nz = -dy / L, ny = dz / L; // перпендикуляр
  if (center) { const mz = (A[0] + B[0]) / 2 - center[0], my = (A[1] + B[1]) / 2 - center[1]; if (nz * mz + ny * my < 0) { nz = -nz; ny = -ny; } }
  const cz = (A[0] + B[0]) / 2 + nz * out, cy = (A[1] + B[1]) / 2 + ny * out;
  kit.box(bucket, w, thick, Math.max(0.05, L - margin * 2), color, 0, cy, cz, 0, [th, 0, 0]);
}

/**
 * Купе: боядисана рамка с отвори за страничните прозорци, стъкло вътре, предно и задно стъкло.
 * zr/zf — задна/предна основа, yb — линия на прозорците, yt — покрив, fr/rr — колко е наклонено стъклото отпред/отзад.
 */
function cabin(kit: Kit, o: { zr: number; zf: number; yb: number; yt: number; fr: number; rr: number; w: number; roofR?: number; pillar?: number; split?: number[]; roofColor?: string; bucket?: string; color?: string }) {
  const p = o.pillar ?? 0.08;
  const outline: V2[] = [[o.zr, o.yb], [o.zf, o.yb], [o.zf - o.fr, o.yt], [o.zr + o.rr, o.yt]];
  const shape = roundedShape([[o.zr, o.yb], [o.zf, o.yb], [o.zf - o.fr, o.yt, o.roofR ?? 0.12], [o.zr + o.rr, o.yt, o.roofR ?? 0.12]]);
  // отвори: изместеният навътре контур, разделен на прозорци от колоните
  const win = inset(outline, p).map(([z, y]) => [z, Math.max(y, o.yb + 0.06)] as V2);
  const zs = [Math.min(...win.map((q) => q[0])), ...(o.split ?? []), Math.max(...win.map((q) => q[0]))];
  for (let i = 0; i < zs.length - 1; i++) {
    const a = zs[i] + (i ? p / 2 : 0), b = zs[i + 1] - (i < zs.length - 2 ? p / 2 : 0);
    const hole = clipX(win, a, b);
    if (hole.length >= 3) shape.holes.push(new THREE.Path(hole.map(([x, y]) => new THREE.Vector2(x, y))));
  }
  kit.add(o.bucket ?? 'paint', sideExtrude(shape, o.w, 0.04), o.color ?? '#ffffff');
  // стъклото вътре
  kit.add('glass', sideExtrude(roundedShape(inset(outline, 0.03)), o.w - 0.1, 0.0), C.glass);
  const ctr: V2 = [(o.zr + o.zf) / 2, (o.yb + o.yt) / 2];
  slab(kit, 'glass', C.glass, [o.zf, o.yb + 0.03], [o.zf - o.fr, o.yt - 0.02], o.w - 0.2, 0.045, 0.05, 0.025, ctr);
  slab(kit, 'glass', C.glass, [o.zr, o.yb + 0.03], [o.zr + o.rr, o.yt - 0.02], o.w - 0.24, 0.045, 0.06, 0.025, ctr);
  if (o.roofColor) {
    const roof = roundedShape([[o.zr + o.rr - 0.05, o.yt - 0.05], [o.zf - o.fr + 0.05, o.yt - 0.05], [o.zf - o.fr - 0.02, o.yt + 0.03, 0.05], [o.zr + o.rr + 0.02, o.yt + 0.03, 0.05]]);
    kit.add('trim', sideExtrude(roof, o.w + 0.02, 0.04), o.roofColor);
  }
}

function headlight(kit: Kit, x: number, y: number, z: number, r = 0.11, rim = true) {
  kit.cyl('head', r, 0.06, '#ffffff', M.at(x, y, z + 0.02, Math.PI / 2), 16);
  if (rim) kit.add('chrome', new THREE.TorusGeometry(r, 0.022, 6, 18), '#ffffff', M.at(x, y, z + 0.03));
}

function taillight(kit: Kit, x: number, y: number, z: number, w = 0.12, h = 0.1) {
  kit.box('tail', w, h, 0.05, '#ffffff', x, y, z, 0.015);
}

function bumper(kit: Kit, w: number, y: number, z: number, h = 0.13, d = 0.14, color?: string) {
  kit.box(color ? 'trim' : 'chrome', w, h, d, color ?? '#ffffff', 0, y, z, 0.05);
}

function plate(kit: Kit, y: number, z: number, front: boolean) {
  kit.box('trim', 0.42, 0.11, 0.02, C.plate, 0, y, z + (front ? 0.01 : -0.01));
}

/** Решетка от хромирани пръчки. */
function grille(kit: Kit, w: number, h: number, y: number, z: number, bars = 5, vertical = false) {
  kit.box('trim', w, h, 0.04, C.black, 0, y, z - 0.01);
  for (let i = 0; i < bars; i++) {
    const t = (i + 0.5) / bars - 0.5;
    if (vertical) kit.box('chrome', 0.03, h, 0.05, '#ffffff', t * w, y, z);
    else kit.box('chrome', w, 0.03, 0.05, '#ffffff', 0, y + t * h, z);
  }
  kit.box('chrome', w + 0.06, h + 0.06, 0.03, '#ffffff', 0, y, z - 0.02);
}

const wheelCache = new Map<string, THREE.BufferGeometry>();
/** Колело: гума с меки ръбове, джанта и (за старите коли) бял страничен кант. */
export function wheelGeometry(r: number, w: number, white = false) {
  const key = `${r}|${w}|${white}`;
  let g = wheelCache.get(key);
  if (g) return g;
  const k = new Kit();
  const prof = [[r * 0.58, -w / 2], [r * 0.9, -w / 2], [r, -w / 2 + w * 0.22], [r, w / 2 - w * 0.22], [r * 0.9, w / 2], [r * 0.58, w / 2]].map(([a, b]) => new THREE.Vector2(a, b));
  k.add('t', new THREE.LatheGeometry(prof, 22), C.rubber, M.at(0, 0, 0, 0, 0, Math.PI / 2));
  if (white) k.cyl('t', r * 0.82, w + 0.01, '#f4f1ea', M.at(0, 0, 0, 0, 0, Math.PI / 2), 22);
  k.cyl('t', r * 0.6, w + 0.02, '#c9ced3', M.at(0, 0, 0, 0, 0, Math.PI / 2), 18);
  k.cyl('t', r * 0.24, w + 0.05, '#eef1f4', M.at(0, 0, 0, 0, 0, Math.PI / 2), 12);
  g = k.merged('t')!;
  wheelCache.set(key, g);
  return g;
}

// ---------- колите ----------

function pickup(k: Kit, wood = false): WheelSpec[] {
  const r = 0.38, fz = 1.5, rz = -1.45;
  // капак на двигателя
  body(k, 'paint', '#fff', [[0.5, 0.55], [2.36, 0.55], [2.38, 0.98, 0.25], [1.9, 1.16, 0.3], [0.5, 1.2]], 1.2);
  // предни калници — заоблени, над колелата
  for (const s of [-1, 1]) {
    body(k, 'paint', '#fff', lowerProfile(0.2, 2.45, 0.42, [{ z: fz, r: r + 0.07, cy: r }], [[2.47, 0.66, 0.22], [2.1, 1.0, 0.35], [1.0, 1.0, 0.35], [0.35, 0.72, 0.3]]), 0.44, 0.07, s * 0.74);
    headlight(k, s * 0.74, 0.86, 2.27, 0.12);
    // задни калници (издадени отстрани на каросерията)
    body(k, 'paint', '#fff', lowerProfile(-2.05, -0.85, 0.48, [{ z: rz, r: r + 0.07, cy: r }], [[-0.82, 0.62, 0.15], [-1.1, 0.95, 0.3], [-1.9, 0.95, 0.3], [-2.08, 0.62, 0.15]]), 0.3, 0.06, s * 0.9);
    taillight(k, s * 0.9, 0.82, -2.1, 0.1, 0.16);
    // стъпенка
    k.box('trim', 0.3, 0.06, 1.25, C.black, s * 0.86, 0.47, -0.2, 0.02);
  }
  // кабина
  body(k, 'paint', '#fff', [[-0.62, 0.45], [0.62, 0.45], [0.62, 1.22], [-0.62, 1.22]], 1.66, 0.06);
  cabin(k, { zr: -0.6, zf: 0.6, yb: 1.2, yt: 1.86, fr: 0.25, rr: 0.05, w: 1.6, roofR: 0.2 });
  // каросерия отзад
  k.box('trim', 1.5, 0.08, 1.85, wood ? C.wood : C.woodDark, 0, 0.78, -1.62);
  for (const s of [-1, 1]) {
    if (wood) for (let i = 0; i < 3; i++) k.box('trim', 0.06, 0.12, 1.85, C.wood, s * 0.75, 0.9 + i * 0.16, -1.62, 0.01);
    else k.box('paint', 0.08, 0.5, 1.85, '#fff', s * 0.76, 1.02, -1.62, 0.02);
  }
  k.box(wood ? 'trim' : 'paint', 1.6, 0.5, 0.08, wood ? C.wood : '#fff', 0, 1.02, -2.52, 0.02);
  k.box('trim', 1.52, 0.42, 0.06, C.black, 0, 0.72, -2.4);
  // отпред: решетка, броня, номер
  grille(k, 0.78, 0.36, 0.78, 2.4, 5);
  bumper(k, 1.9, 0.45, 2.55, 0.14, 0.14);
  bumper(k, 1.7, 0.48, -2.6, 0.12, 0.12);
  plate(k, 0.62, -2.57, false);
  // огледала
  for (const s of [-1, 1]) k.box('chrome', 0.04, 0.12, 0.08, '#fff', s * 0.9, 1.38, 0.55, 0.01);
  return [fz, rz].flatMap((z) => [-1, 1].map((s) => ({ x: s * 0.74, z, r, w: 0.26 })));
}

function mini(k: Kit): WheelSpec[] {
  const r = 0.29, fz = 1.18, rz = -1.18;
  body(k, 'paint', '#fff', lowerProfile(-1.78, 1.78, 0.26, [{ z: fz, r: r + 0.05, cy: r }, { z: rz, r: r + 0.05, cy: r }], [[1.8, 0.6, 0.2], [1.55, 0.78, 0.3], [0.6, 0.86], [-1.5, 0.88, 0.2], [-1.8, 0.7, 0.2]]), 1.5, 0.08);
  cabin(k, { zr: -1.3, zf: 0.55, yb: 0.86, yt: 1.38, fr: 0.42, rr: 0.18, w: 1.42, split: [-0.25], roofR: 0.15, roofColor: C.cream });
  for (const s of [-1, 1]) {
    headlight(k, s * 0.52, 0.62, 1.74, 0.1);
    taillight(k, s * 0.55, 0.7, -1.8, 0.14, 0.1);
  }
  k.box('trim', 1.1, 0.06, 0.04, C.grille, 0, 0.6, 1.79);
  bumper(k, 1.5, 0.32, 1.83, 0.1, 0.1, '#9aa0a6');
  bumper(k, 1.5, 0.32, -1.83, 0.1, 0.1, '#9aa0a6');
  plate(k, 0.34, -1.88, false);
  return [fz, rz].flatMap((z) => [-1, 1].map((s) => ({ x: s * 0.63, z, r, w: 0.17 })));
}

function sedan(k: Kit, taxi = false): WheelSpec[] {
  const r = 0.31, fz = 1.28, rz = -1.22;
  body(k, 'paint', '#fff', lowerProfile(-2.05, 2.05, 0.3, [{ z: fz, r: r + 0.06, cy: r }, { z: rz, r: r + 0.06, cy: r }], [[2.07, 0.78, 0.1], [1.95, 0.86, 0.1], [0.62, 0.9], [-1.0, 0.92], [-2.0, 0.9, 0.1], [-2.07, 0.6, 0.1]]), 1.62, 0.06);
  cabin(k, { zr: -1.05, zf: 0.62, yb: 0.9, yt: 1.42, fr: 0.5, rr: 0.42, w: 1.52, split: [-0.25], roofR: 0.08, pillar: 0.07 });
  // двойни кръгли фарове, хромирана решетка
  for (const s of [-1, 1]) {
    headlight(k, s * 0.62, 0.68, 2.05, 0.085);
    headlight(k, s * 0.42, 0.68, 2.05, 0.085);
    taillight(k, s * 0.6, 0.72, -2.08, 0.3, 0.12);
  }
  grille(k, 0.62, 0.17, 0.68, 2.07, 4);
  bumper(k, 1.66, 0.42, 2.12, 0.1, 0.1);
  bumper(k, 1.66, 0.42, -2.12, 0.1, 0.1);
  plate(k, 0.42, 2.18, true);
  // хромирана лайсна отстрани
  for (const s of [-1, 1]) k.box('chrome', 0.02, 0.03, 3.6, '#fff', s * 0.82, 0.66, 0, 0.01);
  if (taxi) {
    for (const s of [-1, 1]) for (let i = 0; i < 10; i++) k.box('trim', 0.02, 0.07, 0.17, i % 2 ? '#111' : '#fff', s * 0.82, 0.78, -1.5 + i * 0.34);
    k.box('trim', 0.5, 0.16, 0.24, '#ffd400', 0, 1.5, -0.2, 0.04);
    k.box('trim', 0.52, 0.06, 0.26, '#111', 0, 1.5, -0.2);
  }
  return [fz, rz].flatMap((z) => [-1, 1].map((s) => ({ x: s * 0.68, z, r, w: 0.19 })));
}

function classic(k: Kit): WheelSpec[] {
  const r = 0.36, fz = 1.5, rz = -1.4;
  body(k, 'paint', '#fff', lowerProfile(-2.4, 2.4, 0.34, [{ z: fz, r: r + 0.07, cy: r }, { z: rz, r: r + 0.07, cy: r }], [[2.44, 0.62, 0.25], [2.2, 0.9, 0.35], [0.7, 1.0, 0.2], [-0.9, 1.0], [-2.1, 0.86, 0.4], [-2.44, 0.55, 0.2]]), 1.8, 0.09);
  cabin(k, { zr: -1.05, zf: 0.7, yb: 0.99, yt: 1.6, fr: 0.55, rr: 0.7, w: 1.66, split: [-0.12], roofR: 0.3, pillar: 0.07 });
  for (const s of [-1, 1]) {
    headlight(k, s * 0.66, 0.8, 2.36, 0.13);
    taillight(k, s * 0.7, 0.72, -2.42, 0.14, 0.14);
    k.box('chrome', 0.02, 0.04, 4.0, '#fff', s * 0.91, 0.72, 0, 0.01);
  }
  grille(k, 1.1, 0.26, 0.6, 2.42, 0, true);
  for (let i = 0; i < 9; i++) k.box('chrome', 0.03, 0.24, 0.05, '#fff', -0.5 + i * 0.125, 0.6, 2.43);
  k.box('chrome', 0.06, 0.08, 0.3, '#fff', 0, 1.0, 2.1, 0.02); // фигурка на капака
  bumper(k, 1.86, 0.42, 2.52, 0.15, 0.15);
  bumper(k, 1.86, 0.42, -2.52, 0.15, 0.15);
  plate(k, 0.42, -2.6, false);
  return [fz, rz].flatMap((z) => [-1, 1].map((s) => ({ x: s * 0.76, z, r, w: 0.22, white: true })));
}

function jeep(k: Kit): WheelSpec[] {
  const r = 0.4, fz = 1.25, rz = -1.15;
  body(k, 'paint', '#fff', lowerProfile(-1.95, 2.0, 0.5, [{ z: fz, r: r + 0.08, cy: r }, { z: rz, r: r + 0.08, cy: r }], [[2.02, 1.12, 0.06], [0.75, 1.18], [-1.95, 1.18, 0.06]]), 1.8, 0.05);
  cabin(k, { zr: -1.9, zf: 0.72, yb: 1.18, yt: 2.0, fr: 0.12, rr: 0.0, w: 1.74, split: [-0.1, -1.0], roofR: 0.06, pillar: 0.07, bucket: 'trim', color: C.canvas });
  for (const s of [-1, 1]) {
    headlight(k, s * 0.6, 0.95, 2.0, 0.12);
    taillight(k, s * 0.78, 0.9, -1.98, 0.1, 0.14);
    // калници отпред
    k.box('paint', 0.3, 0.06, 0.9, '#fff', s * 0.78, 1.0, 1.55, 0.02);
  }
  grille(k, 0.8, 0.4, 0.92, 2.03, 7, true);
  bumper(k, 1.9, 0.55, 2.12, 0.14, 0.14, '#2b2b2b');
  bumper(k, 1.8, 0.55, -2.02, 0.12, 0.12, '#2b2b2b');
  // резервна гума отзад
  k.add('trim', wheelGeometry(0.38, 0.24), '#ffffff', M.at(0.3, 1.1, -2.1, 0, Math.PI / 2, 0));
  return [fz, rz].flatMap((z) => [-1, 1].map((s) => ({ x: s * 0.76, z, r, w: 0.28 })));
}

function truck(k: Kit): WheelSpec[] {
  const r = 0.48, fz = 2.1, rz = -1.55;
  // капак и калници
  body(k, 'paint', '#fff', [[1.3, 0.85], [3.05, 0.85], [3.1, 1.42, 0.3], [2.6, 1.62, 0.3], [1.3, 1.66]], 1.2);
  for (const s of [-1, 1]) {
    body(k, 'paint', '#fff', lowerProfile(1.0, 3.15, 0.62, [{ z: fz, r: r + 0.08, cy: r }], [[3.18, 0.9, 0.25], [2.7, 1.3, 0.4], [1.5, 1.3, 0.4], [1.0, 0.95, 0.3]]), 0.5, 0.07, s * 0.92);
    headlight(k, s * 0.92, 1.18, 2.95, 0.14);
    k.box('trim', 0.4, 0.06, 0.6, C.black, s * 1.02, 0.7, 0.7, 0.02);
  }
  body(k, 'paint', '#fff', [[0.25, 0.7], [1.35, 0.7], [1.35, 1.7], [0.25, 1.7]], 2.1, 0.06);
  cabin(k, { zr: 0.27, zf: 1.33, yb: 1.68, yt: 2.5, fr: 0.18, rr: 0.0, w: 2.0, roofR: 0.22 });
  grille(k, 0.95, 0.6, 1.15, 3.12, 8, true);
  bumper(k, 2.2, 0.6, 3.3, 0.16, 0.16, '#2b2b2b');
  // рама и дървена каросерия
  k.box('trim', 1.0, 0.25, 5.0, C.chassis, 0, 0.62, 0.3);
  k.box('trim', 2.3, 0.12, 3.6, C.woodDark, 0, 1.12, -1.55);
  for (const [x, w, d, z] of [[-1.12, 0.08, 3.6, -1.55], [1.12, 0.08, 3.6, -1.55], [0, 2.3, 0.08, -3.32], [0, 2.3, 0.08, 0.22]] as const) {
    for (let i = 0; i < 4; i++) k.box('trim', w, 0.15, d, i % 2 ? C.wood : '#a87645', x, 1.28 + i * 0.17, z, 0.01);
  }
  for (const s of [-1, 1]) taillight(k, s * 0.95, 0.95, -3.36, 0.14, 0.1);
  plate(k, 0.95, -3.37, false);
  return [
    ...[-1, 1].map((s) => ({ x: s * 0.92, z: fz, r, w: 0.3 })),
    ...[-1, 1].map((s) => ({ x: s * 0.86, z: rz, r, w: 0.5 })),
  ];
}

function bus(k: Kit): WheelSpec[] {
  const r = 0.5, fz = 3.1, rz = -2.9;
  const L = 4.7, W = 2.45;
  body(k, 'paint', '#fff', lowerProfile(-L, L, 0.5, [{ z: fz, r: r + 0.1, cy: r }, { z: rz, r: r + 0.1, cy: r }], [[L + 0.02, 1.4, 0.3]]).concat([[-L - 0.02, 1.4, 0.3]] as P2[]), W, 0.08);
  // горната част: крем, с прозорци в редица
  cabin(k, { zr: -L + 0.05, zf: L - 0.05, yb: 1.4, yt: 2.85, fr: 0.35, rr: 0.25, w: W - 0.02, roofR: 0.45, split: [-3.3, -2.2, -1.1, 0, 1.1, 2.2, 3.4], pillar: 0.1, bucket: 'trim', color: C.cream });
  for (const s of [-1, 1]) {
    headlight(k, s * 0.85, 0.95, L + 0.05, 0.13);
    taillight(k, s * 0.95, 1.0, -L - 0.05, 0.14, 0.18);
    k.box('chrome', 0.02, 0.05, 2 * L - 0.4, '#fff', s * (W / 2 + 0.01), 1.38, 0, 0.01);
  }
  grille(k, 1.0, 0.3, 0.9, L + 0.07, 6);
  bumper(k, W + 0.05, 0.55, L + 0.12, 0.16, 0.14);
  bumper(k, W + 0.05, 0.55, -L - 0.12, 0.16, 0.14);
  k.box('trim', 1.1, 0.22, 0.04, '#1b2a3a', 0, 2.55, L - 0.05); // табела с маршрута
  return [fz, rz].flatMap((z) => [-1, 1].map((s) => ({ x: s * 1.0, z, r, w: 0.36 })));
}

function roadster(k: Kit): WheelSpec[] {
  const r = 0.33, fz = 1.35, rz = -1.25;
  body(k, 'paint', '#fff', lowerProfile(-2.1, 2.15, 0.3, [{ z: fz, r: r + 0.07, cy: r }, { z: rz, r: r + 0.07, cy: r }], [[2.18, 0.55, 0.22], [1.8, 0.82, 0.35], [0.5, 0.86, 0.1], [0.3, 0.86], [-0.9, 0.86], [-1.15, 0.86, 0.1], [-1.85, 0.8, 0.35], [-2.12, 0.55, 0.2]]), 1.68, 0.1);
  // отворено купе: седалки и волан
  k.box('trim', 1.36, 0.12, 1.3, C.interior, 0, 0.82, -0.32, 0.03);
  for (const s of [-1, 1]) {
    k.box('trim', 0.5, 0.18, 0.55, C.seat, s * 0.33, 0.9, -0.35, 0.06);
    k.box('trim', 0.5, 0.55, 0.14, C.seat, s * 0.33, 1.12, -0.7, 0.06);
    headlight(k, s * 0.6, 0.72, 2.0, 0.12);
    taillight(k, s * 0.62, 0.68, -2.12, 0.12, 0.08);
  }
  k.add('trim', new THREE.TorusGeometry(0.17, 0.025, 6, 16), C.black, M.at(-0.33, 1.08, 0.18, -0.4));
  // предно стъкло в хромирана рамка
  slab(k, 'glass', C.glass, [0.42, 0.9], [0.25, 1.28], 1.3, 0.0, 0.0, 0.02);
  slab(k, 'chrome', '#fff', [0.43, 0.88], [0.43, 0.92], 1.36, 0.0, 0.0, 0.05);
  grille(k, 0.5, 0.2, 0.45, 2.2, 4);
  bumper(k, 1.7, 0.36, 2.25, 0.08, 0.08);
  bumper(k, 1.7, 0.36, -2.18, 0.08, 0.08);
  for (const s of [-1, 1]) k.box('chrome', 0.02, 0.025, 3.6, '#fff', s * 0.85, 0.6, 0, 0.01);
  return [fz, rz].flatMap((z) => [-1, 1].map((s) => ({ x: s * 0.72, z, r, w: 0.2, white: true })));
}

function van(k: Kit): WheelSpec[] {
  const r = 0.33, fz = 1.35, rz = -1.15;
  body(k, 'paint', '#fff', lowerProfile(-2.1, 2.15, 0.32, [{ z: fz, r: r + 0.06, cy: r }, { z: rz, r: r + 0.06, cy: r }], [[2.18, 1.1, 0.35], [-2.1, 1.1, 0.3]]), 1.74, 0.08);
  cabin(k, { zr: -2.08, zf: 2.13, yb: 1.08, yt: 1.95, fr: 0.12, rr: 0.05, w: 1.72, roofR: 0.35, split: [1.25, 0.2, -0.85], pillar: 0.1, bucket: 'trim', color: C.cream });
  // крем „V“ отпред
  for (const s of [-1, 1]) k.box('trim', 0.06, 0.62, 0.05, C.cream, s * 0.3, 0.82, 2.21, 0.02, [0, 0, s * 0.75]);
  k.add('trim', new THREE.CircleGeometry(0.13, 18), '#e8e8e8', M.at(0, 0.78, 2.235));
  for (const s of [-1, 1]) {
    headlight(k, s * 0.62, 0.72, 2.17, 0.11);
    taillight(k, s * 0.75, 0.75, -2.12, 0.08, 0.18);
  }
  bumper(k, 1.74, 0.38, 2.26, 0.1, 0.1, '#ece9e2');
  bumper(k, 1.74, 0.38, -2.18, 0.1, 0.1, '#ece9e2');
  return [fz, rz].flatMap((z) => [-1, 1].map((s) => ({ x: s * 0.74, z, r, w: 0.2 })));
}

function moto(k: Kit): WheelSpec[] {
  const r = 0.32;
  // рама, резервоар, седалка
  k.box('trim', 0.12, 0.12, 1.2, C.black, 0, 0.55, 0.0, 0.04, [0.15, 0, 0]);
  body(k, 'paint', '#fff', [[-0.15, 0.78], [0.45, 0.74, 0.1], [0.42, 0.98, 0.12], [-0.1, 1.0, 0.12]], 0.3, 0.06);
  k.box('trim', 0.28, 0.1, 0.6, C.black, 0, 0.92, -0.45, 0.05);
  k.box('chrome', 0.32, 0.25, 0.3, '#fff', 0, 0.48, 0.08, 0.06); // двигател
  k.box('chrome', 0.07, 0.07, 0.9, '#fff', 0.2, 0.38, -0.4, 0.03); // ауспух
  k.box('chrome', 0.05, 0.6, 0.05, '#fff', 0, 0.85, 0.72, 0.02, [-0.35, 0, 0]); // вилка
  k.box('chrome', 0.7, 0.04, 0.04, '#fff', 0, 1.18, 0.6, 0.02);
  headlight(k, 0, 1.0, 0.78, 0.1);
  taillight(k, 0, 0.85, -0.8, 0.12, 0.06);
  // калници
  k.add('paint', new THREE.TorusGeometry(r + 0.06, 0.07, 6, 14, Math.PI * 0.8), '#fff', M.at(0, r, 0.88, 0, Math.PI / 2, Math.PI * 0.15));
  // кош отстрани
  body(k, 'paint', '#fff', [[-0.55, 0.32], [0.45, 0.32], [0.65, 0.55, 0.25], [0.4, 0.78, 0.15], [-0.6, 0.78, 0.15]], 0.7, 0.08, 0.85);
  k.box('trim', 0.42, 0.16, 0.42, C.seat, 0.85, 0.82, -0.25, 0.05);
  k.box('trim', 0.06, 0.06, 0.6, C.black, 0.45, 0.42, 0.0);
  return [
    { x: 0, z: 0.88, r, w: 0.12 },
    { x: 0, z: -0.75, r, w: 0.14 },
    { x: 0.95, z: -0.05, r: 0.26, w: 0.12 },
  ];
}

const BUILDERS: Record<string, (k: Kit) => WheelSpec[]> = {
  pickup: (k) => pickup(k),
  pickup_wood: (k) => pickup(k, true),
  mini, sedan: (k) => sedan(k), taxi: (k) => sedan(k, true), classic, jeep, truck, bus, roadster, van, moto,
};

export type RetroKind = keyof typeof BUILDERS;

const buildCache = new Map<string, CarBuild>();
export function carBuild(kind: RetroKind): CarBuild {
  let b = buildCache.get(kind);
  if (!b) {
    const kit = new Kit();
    const wheels = BUILDERS[kind](kit);
    b = { kit, wheels };
    buildCache.set(kind, b);
  }
  return b;
}

const liteCache = new Map<string, Kit>();
/** Олекотен вариант за колите по пътищата: колелата, стоповете и хромът са в едно тяло. */
function liteKit(kind: RetroKind) {
  let k = liteCache.get(kind);
  if (k) return k;
  const b = carBuild(kind);
  k = new Kit();
  for (const [bucket, list] of Object.entries(b.kit.parts)) {
    const to = bucket === 'tail' || bucket === 'chrome' ? 'trim' : bucket;
    for (const g of list) (k.parts[to] ||= []).push(g);
  }
  for (const w of b.wheels) k.add('trim', wheelGeometry(w.r, w.w, w.white), '#ffffff', M.at(w.x, w.r, w.z));
  liteCache.set(kind, k);
  return k;
}

const liteMeshCache = new Map<string, THREE.BufferGeometry>();
/** Кола за движението по пътищата — само 4 рисувания (без въртящи се колела). */
export function retroCarLite(kind: RetroKind, paint: THREE.ColorRepresentation) {
  const k = liteKit(kind);
  const g = new THREE.Group();
  for (const bucket of Object.keys(k.parts)) {
    const key = kind + '|' + bucket;
    let geo = liteMeshCache.get(key);
    if (!geo) { geo = k.merged(bucket)!; liteMeshCache.set(key, geo); }
    const m = new THREE.Mesh(geo, bucketMat(bucket, paint));
    m.castShadow = bucket === 'paint' || bucket === 'trim';
    m.receiveShadow = bucket !== 'glass';
    g.add(m);
  }
  return g;
}

/** Готова кола (група) с отделни колела, които могат да се въртят. */
export function retroCar(kind: RetroKind, paint: THREE.ColorRepresentation) {
  const b = carBuild(kind);
  const g = kitMeshes(b.kit, paint);
  const wheels: THREE.Mesh[] = [];
  for (const w of b.wheels) {
    const m = new THREE.Mesh(wheelGeometry(w.r, w.w, w.white), bucketMat('trim'));
    m.position.set(w.x, w.r, w.z);
    m.castShadow = true;
    m.name = 'wheel';
    m.userData.r = w.r;
    wheels.push(m);
    g.add(m);
  }
  g.userData.retro = kind;
  return g;
}

/** Колелата на кола (за въртене); търси се веднъж и се пази. */
export function wheelsOf(obj: THREE.Object3D): THREE.Mesh[] {
  if (obj.userData.wheels) return obj.userData.wheels;
  const list: THREE.Mesh[] = [];
  obj.updateMatrixWorld(true);
  const base = obj.getWorldScale(new THREE.Vector3()).x, v = new THREE.Vector3();
  obj.traverse((o) => {
    if (o.name !== 'wheel') return;
    // истинският радиус (моделът може да е смален или уголемен)
    o.userData.rr = (o.userData.r as number) * (o.getWorldScale(v).x / base);
    list.push(o as THREE.Mesh);
  });
  obj.userData.wheels = list;
  return list;
}

/** Върти колелата според изминатия път (метри). */
export function spinWheels(obj: THREE.Object3D, dist: number) {
  for (const w of wheelsOf(obj)) w.rotation.x += dist / (w.userData.rr as number);
}

// Регистрирани модели за магазина, гаража и доставките
export const RETRO_MODELS: Record<string, { kind: RetroKind; paint: string }> = {
  retro_moto: { kind: 'moto', paint: '#7b3f8f' },
  retro_mini: { kind: 'mini', paint: '#7fb2c9' },
  retro_pickup: { kind: 'pickup', paint: '#3f7fb5' },
  retro_pickup_red: { kind: 'pickup_wood', paint: '#b8352b' },
  retro_sedan: { kind: 'sedan', paint: '#d9c9a3' },
  retro_jeep: { kind: 'jeep', paint: '#5d6b3b' },
  retro_truck: { kind: 'truck', paint: '#3d6e8c' },
  retro_taxi: { kind: 'taxi', paint: '#f2c230' },
  retro_classic: { kind: 'classic', paint: '#2f4a3d' },
  retro_roadster: { kind: 'roadster', paint: '#c42a2a' },
  retro_roadster_white: { kind: 'roadster', paint: '#f3f0e8' },
  retro_van: { kind: 'van', paint: '#d2553b' },
  retro_bus: { kind: 'bus', paint: '#d1462f' },
  // по-високите нива
  retro_classic_red: { kind: 'classic', paint: '#9b2335' },
  retro_van_blue: { kind: 'van', paint: '#2e6f9e' },
  retro_jeep_white: { kind: 'jeep', paint: '#ece6d6' },
  retro_bus_blue: { kind: 'bus', paint: '#2e6f9e' },
  retro_truck_red: { kind: 'truck', paint: '#b8352b' },
  retro_roadster_gold: { kind: 'roadster', paint: '#d4a63a' },
};
for (const [name, m] of Object.entries(RETRO_MODELS)) registerModel(name, () => retroCar(m.kind, m.paint));

/** Цветове за колите по улиците — избелели, като от 70-те. */
export const RETRO_PAINTS = ['#c0392b', '#2e6f9e', '#e8e2d0', '#3f7a52', '#d9a441', '#7a8a99', '#8e3b46', '#f0efe8', '#4b5d7a', '#b5651d', '#6aa3b5', '#2b2b2b'];
