import * as THREE from 'three';
import { Kit, M, kitMeshes, bucketMat } from '../engine/kit';
import { rng } from '../engine/noise';
import { instance, loadModel } from '../engine/assets';
import { instancedModel, type Placement } from '../engine/instancing';
import { carBuild, retroCarLite, wheelGeometry, RETRO_PAINTS, type RetroKind } from '../game/retro';
import { CITY, ROAD_Z } from './layout';
import { signTexture } from './railway';

// Големият град на изток: панелки, високи блокове, стари къщи с магазини, офис сграда,
// катедрала със златни куполи, площад с фонтан, парк, стадион, улици, лампи и коли.

const XS = [207, 252, 297, 342, 387, 432]; // улици север-юг (x)
const COLS: [number, number][] = [[213, 246], [258, 291], [303, 336], [348, 381], [393, 426], [438, 470]];
const ROWS: [number, number][] = [[-25, 26], [40, 65], [77, 102]];
const ZS = [-31, ROAD_Z, 71, 108]; // улици изток-запад (z)
type Plan = 'panel' | 'tower' | 'square' | 'church' | 'old' | 'office' | 'park' | 'stadium' | 'house';
const PLAN: Plan[][] = [
  ['panel', 'tower', 'square', 'church', 'old', 'panel'],
  ['old', 'old', 'office', 'park', 'tower', 'panel'],
  ['house', 'panel', 'panel', 'stadium', 'panel', 'house'],
];

// ---------- фасади (рисувани текстури с прозорци; нощем прозорците светят) ----------
type Style = 'panel' | 'old' | 'office' | 'house';
const BAYS = 8, FLOORS = 16, CW = 48, CH = 48;
const STYLE: Record<Style, { bay: number; floor: number }> = {
  panel: { bay: 3.0, floor: 2.8 },
  old: { bay: 3.4, floor: 3.4 },
  office: { bay: 2.6, floor: 3.4 },
  house: { bay: 3.2, floor: 3.0 },
};

function facade(style: Style) {
  const W = BAYS * CW, H = FLOORS * CH;
  const cv = document.createElement('canvas'), ce = document.createElement('canvas');
  cv.width = ce.width = W;
  cv.height = ce.height = H;
  const g = cv.getContext('2d')!, e = ce.getContext('2d')!;
  e.fillStyle = '#000';
  e.fillRect(0, 0, W, H);
  const r = rng(style.length * 31 + 7);
  const lit = (x: number, y: number, w: number, h: number, p: number) => {
    if (r() > p) return;
    const t = r();
    e.fillStyle = t < 0.12 ? '#9fc4ff' : t < 0.55 ? '#ffd27f' : '#ffe9bf';
    e.fillRect(x, y, w, h);
  };
  for (let f = 0; f < FLOORS; f++) {
    for (let b = 0; b < BAYS; b++) {
      const x = b * CW, y = (FLOORS - 1 - f) * CH;
      if (style === 'panel') {
        const v = 226 + ((r() * 14) | 0);
        g.fillStyle = `rgb(${v},${v - 4},${v - 12})`;
        g.fillRect(x, y, CW, CH);
        g.fillStyle = 'rgba(120,110,95,0.35)';
        g.fillRect(x, y + CH - 2, CW, 2);
        g.fillRect(x + CW - 2, y, 2, CH);
        if (f === 0 && b === 3) {
          g.fillStyle = '#5a4030';
          g.fillRect(x + 12, y + 14, 24, 34);
          g.fillStyle = '#9a9a9a';
          g.fillRect(x + 6, y + 8, 36, 6);
          lit(x + 14, y + 16, 20, 30, 0.8);
          continue;
        }
        g.fillStyle = '#f5f5f2';
        g.fillRect(x + 9, y + 10, 30, 26);
        g.fillStyle = '#34444f';
        g.fillRect(x + 11, y + 12, 26, 22);
        g.fillStyle = '#f5f5f2';
        g.fillRect(x + 23, y + 12, 2, 22);
        lit(x + 11, y + 12, 26, 22, 0.38);
        if (f > 0 && r() < 0.4) {
          // балкон с цветен парапет
          const cols = ['#c9784a', '#7e9cb5', '#d9b45a', '#9cb07a', '#c45a4a', '#e8e2d4'];
          g.fillStyle = cols[(r() * cols.length) | 0];
          g.fillRect(x + 3, y + 27, 42, 17);
          g.fillStyle = 'rgba(0,0,0,0.18)';
          g.fillRect(x + 3, y + 42, 42, 3);
          e.fillStyle = '#000';
          e.fillRect(x + 3, y + 27, 42, 17);
        }
      } else if (style === 'old' || style === 'house') {
        g.fillStyle = '#f4f0e6';
        g.fillRect(x, y, CW, CH);
        g.fillStyle = 'rgba(160,150,130,0.35)';
        g.fillRect(x, y + CH - 3, CW, 3);
        if (f === 0 && style === 'old') {
          // магазин на партера
          g.fillStyle = '#3d4b3c';
          g.fillRect(x + 3, y + 8, 42, 40);
          g.fillStyle = '#2b3a44';
          g.fillRect(x + 6, y + 11, 36, 37);
          g.fillStyle = '#3d4b3c';
          g.fillRect(x + 23, y + 11, 2, 37);
          lit(x + 6, y + 11, 36, 37, 0.75);
          continue;
        }
        const ww = style === 'house' ? 20 : 18, wx = x + (CW - ww) / 2;
        g.fillStyle = '#ffffff';
        g.fillRect(wx - 3, y + 6, ww + 6, 36);
        g.fillStyle = '#2f3d47';
        g.fillRect(wx, y + 9, ww, 30);
        g.fillStyle = '#ffffff';
        g.fillRect(wx + ww / 2 - 1, y + 9, 2, 30);
        g.fillRect(wx, y + 21, ww, 2);
        lit(wx, y + 9, ww, 30, 0.4);
        if (style === 'house') {
          g.fillStyle = '#6b4a2e';
          g.fillRect(wx - 9, y + 8, 6, 32);
          g.fillRect(wx + ww + 3, y + 8, 6, 32);
        } else {
          g.fillStyle = '#e6e0d2';
          g.fillRect(wx - 5, y + 3, ww + 10, 4);
          g.fillRect(wx - 4, y + 41, ww + 8, 3);
        }
      } else {
        // офис: ленти стъкло и бетон
        g.fillStyle = '#d9d5cc';
        g.fillRect(x, y, CW, CH);
        g.fillStyle = f === 0 ? '#2a3d45' : '#35525c';
        g.fillRect(x, y + (f === 0 ? 4 : 14), CW, CH - (f === 0 ? 4 : 14));
        g.fillStyle = 'rgba(255,255,255,0.18)';
        g.fillRect(x + 2, y + 16, CW - 4, 4);
        g.fillStyle = '#1d2a30';
        g.fillRect(x + CW - 2, y + 14, 2, CH - 14);
        e.fillStyle = r() < 0.5 ? '#dfe9ff' : '#000';
        if (r() < 0.45 || f === 0) e.fillRect(x, y + 14, CW - 2, CH - 14);
      }
    }
  }
  const tex = (c: HTMLCanvasElement, srgb: boolean) => {
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  return { map: tex(cv, true), emissive: tex(ce, true) };
}

/** Натрупва стени (4 правоъгълника) с UV според етажите и прозорците. */
class Walls {
  pos: number[] = [];
  nor: number[] = [];
  uv: number[] = [];
  col: number[] = [];
  constructor(public style: Style) {}
  add(x0: number, z0: number, x1: number, z1: number, h: number, tint: THREE.Color, uOff: number, y0 = 0) {
    const { bay, floor } = STYLE[this.style];
    const corners: [number, number][] = [[x0, z1], [x1, z1], [x1, z0], [x0, z0]];
    let u = uOff;
    for (let i = 0; i < 4; i++) {
      const [ax, az] = corners[i], [bx, bz] = corners[(i + 1) % 4];
      const len = Math.hypot(bx - ax, bz - az);
      const nx = -(bz - az) / len, nz = (bx - ax) / len; // навън
      const u0 = u / BAYS, u1 = (u + len / bay) / BAYS;
      const v0 = y0 / floor / FLOORS, v1 = (y0 + h) / floor / FLOORS;
      const P = [[ax, y0, az, u0, v0], [bx, y0, bz, u1, v0], [bx, y0 + h, bz, u1, v1], [ax, y0, az, u0, v0], [bx, y0 + h, bz, u1, v1], [ax, y0 + h, az, u0, v1]];
      for (const [px, py, pz, pu, pv] of P) {
        this.pos.push(px, py, pz);
        this.nor.push(nx, 0, nz);
        this.uv.push(pu, pv);
        this.col.push(tint.r, tint.g, tint.b);
      }
      u += Math.round(len / bay);
    }
  }
  mesh(mat: THREE.Material) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, mat);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  }
}

/** Двускатен покрив (с фронтони) над правоъгълник. */
function gableRoof(x0: number, z0: number, x1: number, z1: number, y: number, color: string, wall: THREE.Color) {
  const o = 0.45;
  const alongX = x1 - x0 >= z1 - z0;
  const w = alongX ? z1 - z0 : x1 - x0;
  const rh = Math.min(4.5, w * 0.36);
  const tri: number[] = [], cols: number[] = [];
  const c = new THREE.Color(color), cw = wall;
  const push = (pts: number[][], col: THREE.Color) => { for (const p of pts) { tri.push(...p); cols.push(col.r, col.g, col.b); } };
  if (alongX) {
    const zm = (z0 + z1) / 2, X0 = x0 - o, X1 = x1 + o, Z0 = z0 - o, Z1 = z1 + o;
    push([[X0, y, Z1], [X1, y, Z1], [X1, y + rh, zm], [X0, y, Z1], [X1, y + rh, zm], [X0, y + rh, zm]], c);
    push([[X1, y, Z0], [X0, y, Z0], [X0, y + rh, zm], [X1, y, Z0], [X0, y + rh, zm], [X1, y + rh, zm]], c);
    push([[x0, y, z0], [x0, y, z1], [x0, y + rh * ((z1 - z0) / 2) / ((Z1 - Z0) / 2), zm]], cw);
    push([[x1, y, z1], [x1, y, z0], [x1, y + rh * ((z1 - z0) / 2) / ((Z1 - Z0) / 2), zm]], cw);
  } else {
    const xm = (x0 + x1) / 2, X0 = x0 - o, X1 = x1 + o, Z0 = z0 - o, Z1 = z1 + o;
    push([[X1, y, Z1], [X1, y, Z0], [xm, y + rh, Z0], [X1, y, Z1], [xm, y + rh, Z0], [xm, y + rh, Z1]], c);
    push([[X0, y, Z0], [X0, y, Z1], [xm, y + rh, Z1], [X0, y, Z0], [xm, y + rh, Z1], [xm, y + rh, Z0]], c);
    push([[x1, y, z0], [x0, y, z0], [xm, y + rh * ((x1 - x0) / 2) / ((X1 - X0) / 2), z0]], cw);
    push([[x0, y, z1], [x1, y, z1], [xm, y + rh * ((x1 - x0) / 2) / ((X1 - X0) / 2), z1]], cw);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(tri, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  g.computeVertexNormals();
  return g;
}

/** Кутия с UV в метри (за паважа, тревата и асфалта). */
function uvBox(w: number, h: number, d: number, x: number, y: number, z: number, tile: number) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv as THREE.BufferAttribute, nrm = g.attributes.normal as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) {
    const ax = Math.abs(nrm.getX(i)), ay = Math.abs(nrm.getY(i));
    const su = ax > 0.5 ? d : w, sv = ay > 0.5 ? d : h;
    uv.setXY(i, (uv.getX(i) * su) / tile, (uv.getY(i) * sv) / tile);
  }
  g.translate(x, y, z);
  return g;
}

function groundTex(kind: 'asphalt' | 'paving' | 'grass' | 'plaza') {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const g = cv.getContext('2d')!;
  const r = rng(kind.length * 17);
  if (kind === 'asphalt') {
    g.fillStyle = '#56575b';
    g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 2600; i++) { const v = 60 + r() * 50; g.fillStyle = `rgba(${v},${v},${v + 3},0.6)`; g.fillRect(r() * 128, r() * 128, 1 + r() * 2, 1 + r() * 2); }
  } else if (kind === 'grass') {
    g.fillStyle = '#5f9a3b';
    g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 2600; i++) { const v = r(); g.fillStyle = v < 0.5 ? 'rgba(80,140,50,0.6)' : 'rgba(120,175,70,0.5)'; g.fillRect(r() * 128, r() * 128, 1, 2 + r() * 3); }
  } else {
    const base = kind === 'paving' ? [196, 191, 182] : [214, 200, 178];
    g.fillStyle = `rgb(${base.join(',')})`;
    g.fillRect(0, 0, 128, 128);
    const n = kind === 'paving' ? 4 : 8;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const v = (r() - 0.5) * 18;
      g.fillStyle = `rgb(${base[0] + v},${base[1] + v},${base[2] + v})`;
      g.fillRect((i * 128) / n + 1, (j * 128) / n + 1, 128 / n - 2, 128 / n - 2);
    }
  }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

const PASTELS = ['#f3d9a4', '#e9b9a2', '#bcd4e6', '#d8e6c4', '#f1e1c9', '#e6c6d3', '#f5efe0', '#cfe0d8', '#f0c98c'];
const PANEL_TINTS = ['#ffffff', '#f4ead6', '#e7eef3', '#f3e3d8', '#e9f1e2', '#f6f2ea'];

interface Box2 { x0: number; z0: number; x1: number; z1: number }

export class City {
  root = new THREE.Group();
  mats: THREE.MeshStandardMaterial[] = [];
  solids: Box2[] = [];
  movers: { obj: THREE.Group; path: THREE.Vector3[]; seg: number; t: number; speed: number; yaw: number }[] = [];
  glows: THREE.Points;
  glowMat: THREE.PointsMaterial;
  floodMat = new THREE.MeshStandardMaterial({ color: '#fffbe8', emissive: '#fff4cc', emissiveIntensity: 0 });

  constructor(public scene: THREE.Scene, public quality: string) {
    this.root.name = 'city';
    const r = rng(2024);
    const walls: Record<Style, Walls> = { panel: new Walls('panel'), old: new Walls('old'), office: new Walls('office'), house: new Walls('house') };
    const roofs = new Kit(), det = new Kit();
    const trees: Placement[] = [], bigTrees: Placement[] = [];
    const lamps: THREE.Vector3[] = [];
    const tint = new THREE.Color();

    // --- сгради ---
    const flatRoof = (x0: number, z0: number, x1: number, z1: number, h: number, color = '#7d7b78', extras = true) => {
      roofs.box('roof', x1 - x0, 0.25, z1 - z0, color, (x0 + x1) / 2, h + 0.12, (z0 + z1) / 2);
      // борд около покрива
      const cxm = (x0 + x1) / 2, czm = (z0 + z1) / 2, W = x1 - x0, D = z1 - z0;
      det.box('d', W + 0.3, 0.7, 0.3, '#c9c4ba', cxm, h + 0.35, z0);
      det.box('d', W + 0.3, 0.7, 0.3, '#c9c4ba', cxm, h + 0.35, z1);
      det.box('d', 0.3, 0.7, D, '#c9c4ba', x0, h + 0.35, czm);
      det.box('d', 0.3, 0.7, D, '#c9c4ba', x1, h + 0.35, czm);
      if (!extras) return;
      // шахта на асансьора, антени, вентилация
      det.box('d', 4, 2.6, 3.5, '#bdb7ab', cxm + (r() - 0.5) * W * 0.4, h + 1.3, czm + (r() - 0.5) * D * 0.3, 0.05);
      for (let i = 0; i < 3; i++) det.box('d', 1.0, 0.8, 1.0, '#a9a9a9', x0 + 2 + r() * (W - 4), h + 0.5, z0 + 2 + r() * (D - 4), 0.05);
      for (let i = 0; i < 2; i++) {
        const ax = x0 + 2 + r() * (W - 4), az = z0 + 2 + r() * (D - 4);
        det.cyl('d', 0.05, 3, '#555', M.at(ax, h + 1.5, az), 6);
        det.box('d', 1.6, 0.06, 0.06, '#555', ax, h + 2.6, az);
      }
    };
    const building = (style: Style, x0: number, z0: number, x1: number, z1: number, floors: number, color: string, roof: 'flat' | 'gable') => {
      const h = floors * STYLE[style].floor;
      tint.set(color);
      walls[style].add(x0, z0, x1, z1, h, tint, (r() * BAYS) | 0);
      if (roof === 'flat') flatRoof(x0, z0, x1, z1, h, style === 'office' ? '#6f7275' : '#86817a');
      else {
        const roofCols = ['#b0472f', '#9e3f2b', '#b8563a', '#8f3a2a'];
        roofs.add('roof', gableRoof(x0, z0, x1, z1, h, roofCols[(r() * roofCols.length) | 0], tint.clone()), '#ffffff');
        det.box('d', x1 - x0 + 0.5, 0.35, z1 - z0 + 0.5, '#efe9dc', (x0 + x1) / 2, h - 0.1, (z0 + z1) / 2);
        // комини
        det.box('d', 0.8, 2.2, 0.8, '#8a5a44', x0 + (x1 - x0) * 0.25, h + 1.6, (z0 + z1) / 2 + 0.6);
      }
      this.solids.push({ x0, z0, x1, z1 });
      return h;
    };
    /** Тенти над магазините на партера. */
    const awnings = (x0: number, z0: number, x1: number, z1: number, side: number) => {
      const cols = ['#c23b32', '#2f6f4f', '#d9a43a', '#2d5f8f', '#8e3b6b'];
      const z = side > 0 ? z1 : z0;
      const n = Math.max(1, Math.floor((x1 - x0) / 3.4));
      for (let i = 0; i < n; i++) {
        if (r() < 0.35) continue;
        const ax = x0 + (i + 0.5) * ((x1 - x0) / n);
        det.box('d', 2.8, 0.12, 1.3, cols[(r() * cols.length) | 0], ax, 2.85, z + side * 0.6, 0.03, [side * 0.35, 0, 0]);
      }
    };

    ROWS.forEach(([rz0, rz1], ri) => COLS.forEach(([cx0, cx1], ci) => {
      const plan = PLAN[ri][ci];
      const x0 = cx0 + 3, x1 = cx1 - 3, z0 = rz0 + 3, z1 = rz1 - 3; // вътре в тротоара
      const W = x1 - x0, D = z1 - z0;
      switch (plan) {
        case 'panel': {
          const fl = 6 + ((r() * 3) | 0);
          const col = PANEL_TINTS[(r() * PANEL_TINTS.length) | 0];
          if (D > 30) {
            building('panel', x0, z0, x1, z0 + 12, fl, col, 'flat');
            building('panel', x0, z1 - 12, x1, z1, fl + 1, PANEL_TINTS[(r() * PANEL_TINTS.length) | 0], 'flat');
            for (let i = 0; i < 6; i++) trees.push({ x: x0 + 3 + r() * (W - 6), y: 0.2, z: z0 + 16 + r() * (D - 32), rot: r() * 6, scale: 0.8 + r() * 0.4 });
          } else building('panel', x0, z0 + (D - 12) / 2, x1, z0 + (D + 12) / 2, fl, col, 'flat');
          break;
        }
        case 'tower': {
          if (D > 30) {
            building('panel', x0 + (W - 16) / 2, z0, x0 + (W + 16) / 2, z0 + 16, 13 + ((r() * 4) | 0), PANEL_TINTS[(r() * 6) | 0], 'flat');
            building('panel', x0 + (W - 16) / 2, z1 - 16, x0 + (W + 16) / 2, z1, 12 + ((r() * 4) | 0), PANEL_TINTS[(r() * 6) | 0], 'flat');
          } else {
            building('old', x0, z0, x1, z1, 1, '#ece6da', 'flat');
            building('panel', x0 + (W - 15) / 2, z0 + (D - 15) / 2, x0 + (W + 15) / 2, z0 + (D + 15) / 2, 15, PANEL_TINTS[(r() * 6) | 0], 'flat');
            awnings(x0, z0, x1, z1, -1);
            awnings(x0, z0, x1, z1, 1);
          }
          break;
        }
        case 'office': {
          building('old', x0, z0, x1, z1, 1, '#e4e0d8', 'flat');
          building('office', x0 + 2, z0 + (D - 13) / 2, x1 - 2, z0 + (D + 13) / 2, 17, '#ffffff', 'flat');
          det.box('d', W - 6, 1.2, 1.0, '#c23b32', (x0 + x1) / 2, 17 * 3.4 + 1.3, z0 + (D - 13) / 2 + 0.6); // реклама на покрива
          awnings(x0, z0, x1, z1, -1);
          break;
        }
        case 'old': {
          // редица стари къщи по краищата на квартала
          const row = (ax0: number, ax1: number, bz0: number, bz1: number, side: number) => {
            let x = ax0;
            while (x < ax1 - 5) {
              const w = Math.min(ax1 - x, 8 + r() * 5);
              const fl = 3 + ((r() * 3) | 0);
              building('old', x, bz0, x + w, bz1, fl, PASTELS[(r() * PASTELS.length) | 0], r() < 0.75 ? 'gable' : 'flat');
              awnings(x, bz0, x + w, bz1, side);
              x += w;
            }
          };
          row(x0, x1, z0, z0 + 11, -1);
          if (D > 24) row(x0, x1, z1 - 11, z1, 1);
          for (let i = 0; i < 3; i++) trees.push({ x: x0 + 4 + r() * (W - 8), y: 0.2, z: z0 + 13 + r() * Math.max(1, D - 26), rot: r() * 6, scale: 0.7 + r() * 0.3 });
          break;
        }
        case 'house': {
          for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {
            const hx = x0 + 1 + i * (W / 3), hz = z0 + 1 + j * (D / 2);
            const hw = W / 3 - 3, hd = Math.min(9, D / 2 - 3);
            building('house', hx, hz, hx + hw, hz + hd, 2, PASTELS[(r() * PASTELS.length) | 0], 'gable');
            if (r() < 0.8) trees.push({ x: hx + hw + 1, y: 0.2, z: hz + hd + 0.8, rot: r() * 6, scale: 0.55 + r() * 0.2 });
          }
          det.add('grass', uvBox(W, 0.05, D, (x0 + x1) / 2, 0.3, (z0 + z1) / 2, 4), '#6aa846');
          break;
        }
        case 'square': this.square(det, x0, z0, x1, z1, bigTrees, lamps); break;
        case 'church': this.church(det, x0, z0, x1, z1); break;
        case 'park': {
          det.add('grass', uvBox(W, 0.05, D, (x0 + x1) / 2, 0.3, (z0 + z1) / 2, 4), '#64a443');
          det.box('d', W, 0.04, 2.4, '#d9ccb2', (x0 + x1) / 2, 0.34, (z0 + z1) / 2);
          det.box('d', 2.4, 0.04, D, '#d9ccb2', (x0 + x1) / 2, 0.34, (z0 + z1) / 2);
          for (let i = 0; i < 9; i++) {
            const tx = x0 + 2 + r() * (W - 4), tz = z0 + 2 + r() * (D - 4);
            if (Math.abs(tx - (x0 + x1) / 2) < 2.5 || Math.abs(tz - (z0 + z1) / 2) < 2.5) continue;
            bigTrees.push({ x: tx, y: 0.3, z: tz, rot: r() * 6, scale: 0.8 + r() * 0.4 });
          }
          loadModel('gazebo').then(() => { const gz = instance('gazebo', 6); gz.position.set(x0 + W * 0.75, 0.3, z0 + D * 0.3); this.root.add(gz); }).catch(() => {});
          break;
        }
        case 'stadium': this.stadium(det, x0, z0, x1, z1, lamps); break;
      }
    }));

    // --- материали на фасадите ---
    for (const st of ['panel', 'old', 'office', 'house'] as Style[]) {
      const f = facade(st);
      const mat = new THREE.MeshStandardMaterial({ map: f.map, emissiveMap: f.emissive, emissive: '#ffffff', emissiveIntensity: 0, roughness: 0.85, vertexColors: true });
      this.mats.push(mat);
      if (walls[st].pos.length) {
        const m = walls[st].mesh(mat);
        m.castShadow = this.quality !== 'low';
        this.root.add(m);
      }
    }
    const roofMeshes = kitMeshes(roofs, undefined, this.quality !== 'low');
    roofMeshes.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) m.material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, side: THREE.DoubleSide }); });
    this.root.add(roofMeshes);

    // --- улици, тротоари, маркировка ---
    this.streets(det, lamps, trees);
    const detMeshes = kitMeshes(det, undefined, this.quality !== 'low');
    detMeshes.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      if (m.name === 'grass') { m.material = new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, roughness: 0.95 }); m.castShadow = false; }
      if (m.name === 'flood') m.material = this.floodMat;
    });
    this.root.add(detMeshes);
    this.ground();

    // --- дървета ---
    if (trees.length) this.root.add(instancedModel('tree_d', 5.5, trees, { by: 'y', shadow: this.quality !== 'low' }));
    if (bigTrees.length) this.root.add(instancedModel('tree_b', 7, bigTrees, { by: 'y', shadow: this.quality !== 'low' }));

    // --- улични лампи: стълбове + светлини (една точка за всяка лампа) ---
    const post = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.08, 0.12, 5, 6).translate(0, 2.5, 0), new THREE.MeshStandardMaterial({ color: '#33383c', roughness: 0.5, metalness: 0.4 }), lamps.length);
    const head = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.25, 0.9).translate(0, 5.05, 0), this.floodMat, lamps.length);
    const m4 = new THREE.Matrix4();
    lamps.forEach((p, i) => { m4.makeTranslation(p.x, 0.25, p.z); post.setMatrixAt(i, m4); head.setMatrixAt(i, m4); });
    post.castShadow = this.quality !== 'low';
    post.computeBoundingSphere();
    head.computeBoundingSphere();
    this.root.add(post, head);
    const gp = new Float32Array(lamps.length * 3);
    lamps.forEach((p, i) => gp.set([p.x, 5.0, p.z], i * 3));
    const gg = new THREE.BufferGeometry();
    gg.setAttribute('position', new THREE.BufferAttribute(gp, 3));
    this.glowMat = new THREE.PointsMaterial({ map: glowSprite(), size: 7, sizeAttenuation: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, color: '#ffd59a' });
    this.glows = new THREE.Points(gg, this.glowMat);
    this.glows.frustumCulled = false;
    this.root.add(this.glows);

    this.parkedCars();
    this.traffic();
    this.welcomeSign();
    scene.add(this.root);
  }

  // ---------- площад ----------
  private square(det: Kit, x0: number, z0: number, x1: number, z1: number, trees: Placement[], lamps: THREE.Vector3[]) {
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, W = x1 - x0, D = z1 - z0;
    det.add('plaza', uvBox(W + 6, 0.06, D + 6, cx, 0.3, cz, 3), '#ffffff');
    // кръгли цветни лехи около фонтана
    det.cyl('d', 7.5, 0.25, '#bfb6a6', M.at(cx, 0.4, cz), 40);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      det.cyl('d', 2.6, 0.4, '#8a7e6c', M.at(cx + Math.cos(a) * 12, 0.45, cz + Math.sin(a) * 12), 24);
      det.cyl('d', 2.4, 0.42, '#5e9a3a', M.at(cx + Math.cos(a) * 12, 0.5, cz + Math.sin(a) * 12), 24);
      for (let k = 0; k < 10; k++) {
        const b = r01() * 6.28, rr = r01() * 2;
        det.add('d', new THREE.SphereGeometry(0.28, 6, 4), ['#e2463c', '#f2c94c', '#f5f5f5', '#c86bd6'][k % 4], M.at(cx + Math.cos(a) * 12 + Math.cos(b) * rr, 0.8, cz + Math.sin(a) * 12 + Math.sin(b) * rr));
      }
    }
    // паметник в северния край
    det.box('d', 4, 3, 4, '#cfc8bb', cx, 1.8, z0 + 5, 0.08);
    det.box('d', 3, 0.5, 3, '#bfb7a8', cx, 3.5, z0 + 5, 0.05);
    det.box('gold', 1.0, 3.6, 1.0, '#b08a4a', cx, 5.6, z0 + 5, 0.3);
    det.add('gold', new THREE.SphereGeometry(0.55, 14, 10), '#b08a4a', M.at(cx, 7.7, z0 + 5));
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      trees.push({ x: cx + Math.cos(a) * (W / 2 - 1.5), y: 0.3, z: cz + Math.sin(a) * (D / 2 - 2), rot: a, scale: 0.75 });
      lamps.push(new THREE.Vector3(cx + Math.cos(a + 0.4) * 9.5, 0, cz + Math.sin(a + 0.4) * 9.5));
    }
    loadModel('fountain').then(() => { const f = instance('fountain', 8); f.position.set(cx, 0.3, cz); this.root.add(f); }).catch(() => {});
    loadModel('bench1').then(() => {
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const b = instance('bench1', 2.2);
        b.position.set(cx + Math.cos(a) * 8.6, 0.3, cz + Math.sin(a) * 8.6);
        b.rotation.y = -a - Math.PI / 2;
        this.root.add(b);
      }
    }).catch(() => {});
    this.solids.push({ x0: cx - 8, z0: cz - 8, x1: cx + 8, z1: cz + 8 }, { x0: cx - 2.5, z0: z0 + 2.5, x1: cx + 2.5, z1: z0 + 7.5 });
  }

  // ---------- катедралата ----------
  private church(k: Kit, x0: number, z0: number, x1: number, z1: number) {
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2 + 2;
    const stone = '#efe8d8', green = '#4f8a72', gold = '#e2b445';
    k.add('plaza', uvBox(x1 - x0 + 6, 0.06, z1 - z0 + 6, (x0 + x1) / 2, 0.3, (z0 + z1) / 2, 3), '#ffffff');
    // кръстовиден план
    k.box('d', 16, 11, 26, stone, cx, 5.8, cz, 0.1);
    k.box('d', 28, 9, 11, stone, cx, 4.8, cz, 0.1);
    k.cyl('d', 7.5, 10, stone, M.at(cx, 5.3, cz - 13), 24); // апсида
    // покриви на корабите
    for (const [len, half, y, ry] of [[26.6, 8.3, 11.3, Math.PI / 2], [28.6, 5.8, 9.3, 0]] as const) {
      const g = new THREE.CylinderGeometry(1, 1, 1, 24, 1, false, 0, Math.PI);
      g.rotateZ(Math.PI / 2);
      k.add('d', g, green, M.at(cx, y, cz, 0, ry, 0, len, 2.2, half));
    }
    // централен купол с барабан
    k.cyl('d', 5.2, 5, stone, M.at(cx, 14, cz), 28);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      k.box('glass', 0.7, 2.6, 0.2, '#2f3d47', cx + Math.cos(a) * 5.2, 14, cz + Math.sin(a) * 5.2, 0, [0, -a + Math.PI / 2, 0]);
    }
    k.add('gold', new THREE.SphereGeometry(5.5, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), gold, M.at(cx, 16.4, cz));
    k.cyl('gold', 0.7, 2, gold, M.at(cx, 22.6, cz), 12);
    k.add('gold', new THREE.SphereGeometry(0.75, 12, 8), gold, M.at(cx, 23.8, cz));
    k.box('gold', 0.15, 2.6, 0.15, gold, cx, 25.6, cz);
    k.box('gold', 1.3, 0.15, 0.15, gold, cx, 26.1, cz);
    // малки куполи
    for (const [dx, dz] of [[-6, 7], [6, 7], [-6, -7], [6, -7]]) {
      k.cyl('d', 2.2, 3, stone, M.at(cx + dx, 12.2, cz + dz), 18);
      k.add('d', new THREE.SphereGeometry(2.4, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), green, M.at(cx + dx, 13.6, cz + dz));
      k.box('gold', 0.1, 1.4, 0.1, gold, cx + dx, 16.6, cz + dz);
    }
    // камбанария отпред (към главния път)
    const bz = cz + 16;
    k.box('d', 7, 20, 7, stone, cx, 10, bz, 0.1);
    for (const y of [5, 11, 16]) k.box('d', 7.4, 0.5, 7.4, '#ddd4c0', cx, y, bz);
    for (const [dx, dz, ry] of [[0, 3.55, 0], [0, -3.55, 0], [3.55, 0, Math.PI / 2], [-3.55, 0, Math.PI / 2]] as const) k.box('glass', 2, 3.6, 0.2, '#2a2420', cx + dx, 17.8, bz + dz, 0, [0, ry, 0]);
    k.add('gold', new THREE.SphereGeometry(3.3, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), gold, M.at(cx, 20, bz));
    k.box('gold', 0.14, 2.6, 0.14, gold, cx, 24.3, bz);
    k.box('gold', 1.2, 0.14, 0.14, gold, cx, 24.8, bz);
    // високи сводести прозорци и голяма врата
    for (const s of [-1, 1]) for (let i = 0; i < 4; i++) k.box('glass', 0.2, 4, 1.4, '#2f3d47', cx + s * 8.05, 5.5, cz - 9 + i * 6);
    k.box('glass', 2.6, 4.2, 0.2, '#4a3020', cx, 2.4, bz + 3.6);
    this.solids.push({ x0: cx - 14, z0: cz - 21, x1: cx + 14, z1: bz + 3.6 });
  }

  // ---------- стадион ----------
  private stadium(k: Kit, x0: number, z0: number, x1: number, z1: number, lamps: THREE.Vector3[]) {
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, W = x1 - x0, D = z1 - z0;
    k.add('grass', uvBox(W, 0.05, D, cx, 0.3, cz, 3), '#4f9a3a');
    // ивици на тревата и бели линии
    for (let i = 0; i < 6; i += 2) k.box('d', W * 0.8 / 6, 0.02, D - 9, '#5aa846', cx - W * 0.4 + (i + 0.5) * (W * 0.8 / 6), 0.34, cz);
    const lw = 0.15, fw = W * 0.8, fd = D - 9;
    k.box('d', fw, 0.03, lw, '#fff', cx, 0.36, cz - fd / 2);
    k.box('d', fw, 0.03, lw, '#fff', cx, 0.36, cz + fd / 2);
    k.box('d', lw, 0.03, fd, '#fff', cx - fw / 2, 0.36, cz);
    k.box('d', lw, 0.03, fd, '#fff', cx + fw / 2, 0.36, cz);
    k.box('d', lw, 0.03, fd, '#fff', cx, 0.36, cz);
    k.add('d', new THREE.TorusGeometry(2.4, 0.08, 4, 32), '#fff', M.at(cx, 0.36, cz, Math.PI / 2));
    for (const s of [-1, 1]) {
      // врати
      k.box('d', 0.12, 1.6, 4, '#fff', cx + s * (fw / 2), 1.1, cz);
      k.box('d', 0.12, 0.12, 4, '#fff', cx + s * (fw / 2), 1.9, cz);
      // трибуни по дългите страни
      for (let j = 0; j < 4; j++) k.box('d', fw, 0.6, 1.0, j % 2 ? '#c9c4bb' : '#b8b2a8', cx, 0.6 + j * 0.6, cz + s * (fd / 2 + 1.2 + j * 1.0));
      for (let j = 0; j < 4; j++) k.box('d', fw - 2, 0.25, 0.4, j % 2 ? '#d64a3a' : '#3a6fb0', cx, 1.0 + j * 0.6, cz + s * (fd / 2 + 1.0 + j * 1.0));
    }
    // прожектори
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const px = cx + dx * (W / 2 - 1), pz = cz + dz * (D / 2 - 1);
      k.cyl('d', 0.2, 16, '#5a5f63', M.at(px, 8.3, pz), 6);
      k.box('flood', 2.4, 1.4, 0.4, '#fff', px, 16.5, pz, 0.05);
      lamps.push(new THREE.Vector3(px, 0, pz));
    }
    this.solids.push({ x0: cx - fw / 2, z0: cz - fd / 2 - 5, x1: cx + fw / 2, z1: cz - fd / 2 - 1 }, { x0: cx - fw / 2, z0: cz + fd / 2 + 1, x1: cx + fw / 2, z1: cz + fd / 2 + 5 });
  }

  // ---------- улици ----------
  private streets(det: Kit, lamps: THREE.Vector3[], trees: Placement[]) {
    const r = rng(9);
    // тротоари: повдигнати плочи около всеки квартал
    for (const [rz0, rz1] of ROWS) for (const [cx0, cx1] of COLS) det.add('paving', uvBox(cx1 - cx0, 0.3, rz1 - rz0, (cx0 + cx1) / 2, 0.15, (rz0 + rz1) / 2, 2), '#ffffff');
    // бордюри (по-светли)
    // прекъсната средна линия и пешеходни пътеки
    const near = (v: number, arr: number[], d: number) => arr.some((a) => Math.abs(v - a) < d);
    for (const z of ZS) {
      if (z === ROAD_Z) continue;
      for (let x = CITY.minX; x < CITY.maxX; x += 6) if (!near(x + 1.5, XS, 8)) det.box('d', 3, 0.02, 0.18, '#f2f2ee', x + 1.5, 0.06, z);
    }
    for (const x of XS) for (let z = CITY.minZ; z < CITY.maxZ; z += 6) if (!near(z + 1.5, ZS, 8)) det.box('d', 0.18, 0.02, 3, '#f2f2ee', x, 0.06, z + 1.5);
    for (const x of XS) for (const z of ZS) {
      // „зебри“ на всяко кръстовище
      for (let i = -3; i <= 3; i++) {
        det.box('d', 0.55, 0.02, 3, '#f4f4f0', x + i * 1.1, 0.09, z + (z === ROAD_Z ? 9.2 : 7.6));
        det.box('d', 3, 0.02, 0.55, '#f4f4f0', x + 7.6, 0.09, z + i * 1.1);
      }
    }
    // лампи и дървета по тротоарите
    for (const [rz0, rz1] of ROWS) for (const [cx0, cx1] of COLS) {
      for (let x = cx0 + 4; x < cx1 - 2; x += 14) {
        lamps.push(new THREE.Vector3(x, 0, rz0 + 0.8), new THREE.Vector3(x + 7, 0, rz1 - 0.8));
        if (rz1 === ROWS[0][1] || rz0 === ROWS[1][0]) {
          trees.push({ x: x + 3.5, y: 0.3, z: rz1 === ROWS[0][1] ? rz1 - 1.3 : rz0 + 1.3, rot: r() * 6, scale: 0.75 + r() * 0.2 });
        }
      }
    }
    for (const x of XS) for (let z = -20; z < 100; z += 22) if (!near(z, ZS, 10)) lamps.push(new THREE.Vector3(x - 5.2, 0, z));
  }

  private ground() {
    const asph = new THREE.Mesh(uvBox(CITY.maxX - CITY.minX + 8, 0.06, CITY.maxZ - CITY.minZ + 4, (CITY.minX + CITY.maxX) / 2 + 2, 0.0, (CITY.minZ + CITY.maxZ) / 2, 6), new THREE.MeshStandardMaterial({ map: groundTex('asphalt'), roughness: 0.92, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
    asph.receiveShadow = true;
    this.root.add(asph);
    // материали на паважа, площада и тревата
    this.root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      if (m.name === 'paving') m.material = new THREE.MeshStandardMaterial({ map: groundTex('paving'), roughness: 0.9, vertexColors: true });
      if (m.name === 'plaza') m.material = new THREE.MeshStandardMaterial({ map: groundTex('plaza'), roughness: 0.85, vertexColors: true });
      if (m.name === 'grass') m.material = new THREE.MeshStandardMaterial({ map: groundTex('grass'), roughness: 0.95, vertexColors: true });
      if (m.name === 'paving' || m.name === 'plaza' || m.name === 'grass') { m.castShadow = false; m.receiveShadow = true; }
    });
  }

  // ---------- коли ----------
  private parkedCars() {
    const r = rng(31);
    const kinds: RetroKind[] = ['sedan', 'mini', 'pickup', 'classic', 'van', 'jeep', 'sedan', 'mini'];
    const spots: { kind: RetroKind; x: number; z: number; rot: number; paint: string }[] = [];
    const near = (v: number, arr: number[], d: number) => arr.some((a) => Math.abs(v - a) < d);
    for (const z of ZS) {
      if (z === ROAD_Z) continue;
      for (const side of [-1, 1]) for (let x = CITY.minX + 4; x < CITY.maxX - 3; x += 6.2) {
        if (near(x, XS, 9) || r() < 0.45) continue;
        spots.push({ kind: kinds[(r() * kinds.length) | 0], x, z: z + side * 4.4, rot: side > 0 ? -Math.PI / 2 : Math.PI / 2, paint: RETRO_PAINTS[(r() * RETRO_PAINTS.length) | 0] });
      }
    }
    for (const x of XS) for (let z = CITY.minZ + 4; z < CITY.maxZ - 3; z += 6.2) {
      if (near(z, ZS, 10) || r() < 0.55) continue;
      spots.push({ kind: kinds[(r() * kinds.length) | 0], x: x + 4.4, z, rot: Math.PI, paint: RETRO_PAINTS[(r() * RETRO_PAINTS.length) | 0] });
    }
    const byKind = new Map<RetroKind, typeof spots>();
    for (const s of spots) (byKind.get(s.kind) ?? byKind.set(s.kind, []).get(s.kind)!).push(s);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3(), c = new THREE.Color();
    for (const [kind, list] of byKind) {
      const b = carBuild(kind);
      const wk = new Kit();
      for (const w of b.wheels) wk.add('trim', wheelGeometry(w.r, w.w, w.white), '#ffffff', M.at(w.x, w.r, w.z));
      const geos: [string, THREE.BufferGeometry][] = Object.keys(b.kit.parts).map((k) => [k, b.kit.merged(k)!]);
      geos.push(['trim', wk.merged('trim')!]);
      for (const [bucket, geo] of geos) {
        const im = new THREE.InstancedMesh(geo, bucketMat(bucket, '#ffffff'), list.length);
        list.forEach((s, i) => {
          im.setMatrixAt(i, m.compose(p.set(s.x, 0.06, s.z), q.setFromAxisAngle(up, s.rot), one));
          if (bucket === 'paint') im.setColorAt(i, c.set(s.paint));
        });
        im.castShadow = bucket !== 'glass' && this.quality !== 'low';
        im.receiveShadow = true;
        im.computeBoundingSphere();
        this.root.add(im);
      }
      for (const s of list) this.solids.push({ x0: s.x - 1.2, z0: s.z - 1.2, x1: s.x + 1.2, z1: s.z + 1.2 });
    }
  }

  /** Коли, които обикалят по улиците на града (дясно движение). */
  private traffic() {
    const loops: [number, number, number, number][] = [[XS[1], ZS[0], XS[3], ZS[2]], [XS[0], ZS[2], XS[2], ZS[3]], [XS[3], ZS[2], XS[5], ZS[3]], [XS[3], ZS[0], XS[5], ZS[2]]];
    const kinds: RetroKind[] = ['taxi', 'sedan', 'van', 'classic', 'mini', 'pickup', 'bus', 'taxi'];
    let n = 0;
    for (const [ax, az, bx, bz] of loops) {
      const corners = [new THREE.Vector3(ax, 0, az), new THREE.Vector3(bx, 0, az), new THREE.Vector3(bx, 0, bz), new THREE.Vector3(ax, 0, bz)];
      const path: THREE.Vector3[] = [];
      // изместваме в дясната лента
      for (let i = 0; i < 4; i++) {
        const a = corners[i], b = corners[(i + 1) % 4];
        const f = b.clone().sub(a).normalize();
        const right = new THREE.Vector3(-f.z, 0, f.x).multiplyScalar(1.8);
        path.push(a.clone().add(right), b.clone().add(right));
      }
      for (let k = 0; k < (this.quality === 'low' ? 1 : 2); k++) {
        const kind = kinds[n % kinds.length];
        const obj = retroCarLite(kind, kind === 'taxi' ? '#f2c230' : kind === 'bus' ? '#3b7fb0' : RETRO_PAINTS[(n * 7) % RETRO_PAINTS.length]);
        n++;
        this.root.add(obj);
        this.movers.push({ obj, path, seg: k * 4, t: 0, speed: kind === 'bus' ? 6 : 7 + Math.random() * 2, yaw: 0 });
      }
    }
  }

  private welcomeSign() {
    const g = new THREE.Group();
    const board = new THREE.Mesh(new THREE.PlaneGeometry(9, 1.8), new THREE.MeshStandardMaterial({ map: signTexture('ДОБРЕ ДОШЛИ В ГРАДА', '#2f6b4f'), roughness: 0.6 }));
    board.position.set(0, 3.4, 0);
    board.rotation.y = -Math.PI / 2;
    const back = board.clone();
    back.rotation.y = Math.PI / 2;
    back.position.x = 0.02;
    const k = new Kit();
    k.box('d', 0.15, 3.2, 0.15, '#444', 0, 1.6, -3.8);
    k.box('d', 0.15, 3.2, 0.15, '#444', 0, 1.6, 3.8);
    g.add(board, back, kitMeshes(k));
    g.position.set(196, 0, ROAD_Z - 7);
    this.root.add(g);
  }

  /** Сблъсък за каране из града. */
  blocked(x: number, z: number, rad = 1.3) {
    if (x < CITY.minX - 10 || x > CITY.maxX + 10 || z < CITY.minZ - 12 || z > CITY.maxZ + 8) return false;
    for (const b of this.solids) if (x > b.x0 - rad && x < b.x1 + rad && z > b.z0 - rad && z < b.z1 + rad) return true;
    return false;
  }

  update(dt: number, night: number) {
    const on = THREE.MathUtils.clamp((night - 0.3) / 0.4, 0, 1);
    for (const m of this.mats) m.emissiveIntensity = on * 1.25;
    this.floodMat.emissiveIntensity = on * 2.4;
    this.glowMat.opacity = on * 0.9;
    for (const c of this.movers) {
      let a = c.path[c.seg], b = c.path[(c.seg + 1) % c.path.length];
      let len = a.distanceTo(b);
      c.t += c.speed * dt;
      while (c.t > len) {
        c.t -= len;
        c.seg = (c.seg + 1) % c.path.length;
        a = c.path[c.seg];
        b = c.path[(c.seg + 1) % c.path.length];
        len = a.distanceTo(b);
      }
      c.obj.position.lerpVectors(a, b, c.t / len).setY(0.06);
      const want = Math.atan2(b.x - a.x, b.z - a.z);
      let d = want - c.yaw;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      c.yaw += d * Math.min(1, dt * 6);
      c.obj.rotation.y = c.yaw;
    }
  }
}

let seed = 99;
function r01() {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
}

function glowSprite() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const g = cv.getContext('2d')!;
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,240,200,1)');
  gr.addColorStop(0.3, 'rgba(255,210,140,0.5)');
  gr.addColorStop(1, 'rgba(255,180,90,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
