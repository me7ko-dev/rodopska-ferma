import * as THREE from 'three';
import { BUILDINGS, CROPS, ITEMS, TREES, ANIMALS, LANDS, START_LAND, HOME_TIERS, type BuildingDef, type Recipe } from './data';
import { S, save, addItem, addXP, addCoins, spend, emit, now, spaceFor, isSiloItem, takeAll, count, LAND_RECT, type Entity } from './state';
import { instance, animationsOf, has, loadModel } from '../engine/assets';
import { cropMesh, soilMesh } from './crops3d';
import { fence, yard, trough, beehive, orderBoard, overgrowth, saleSign } from './props';
import { flyTo, popText, marker, removeMarker, bounce, sparkle, type Marker } from './fx';
import { icon } from '../ui/icons';
import { UI } from '../ui/api';
import { sfx } from '../audio/sfx';
import { windify } from '../engine/wind';
import { FARM } from '../world/layout';
import type { CameraRig, GameInput, PointerInfo } from '../engine/camera';

for (const l of LANDS) LAND_RECT[l.id] = l.rect;

const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const proxyMat = new THREE.MeshBasicMaterial({ visible: false });

export interface View {
  e: Entity;
  def: BuildingDef;
  root: THREE.Group;
  proxy: THREE.Mesh;
  height: number;
  update(t: number, dt: number): void;
  tap(): void;
  dispose(): void;
  // по избор
  plant?(crop: string): boolean;
  harvest?(): boolean;
  isEmpty?(): boolean;
  isReady?(): boolean;
  start?(r: Recipe): boolean;
  collect?(): boolean;
  feedAll?(): number;
  buyAnimal?(): boolean;
  setVisual?(): void;
}

export function footprint(def: BuildingDef, rot: number): [number, number] {
  return rot % 2 ? [def.foot[1], def.foot[0]] : [def.foot[0], def.foot[1]];
}

export function centerOf(e: Entity) {
  const [w, d] = footprint(BUILDINGS[e.type], e.rot);
  return new THREE.Vector3(e.x + w / 2, 0, e.z + d / 2);
}

function clipBy(name: string, suffix: string) {
  const list = animationsOf(name);
  return list.find((c) => c.name.endsWith('|' + suffix)) ?? list.find((c) => c.name === suffix) ?? list.find((c) => c.name.endsWith(suffix));
}

// =====================================================================
export class Farm implements GameInput {
  views = new Map<number, View>();
  group = new THREE.Group();
  proxies: THREE.Object3D[] = [];
  extraPick: { obj: THREE.Object3D; tap: () => void }[] = [];
  W = FARM.maxX - FARM.minX;
  H = FARM.maxZ - FARM.minZ;
  grid = new Int32Array(this.W * this.H);
  tool: null | { kind: 'sow'; crop: string } | { kind: 'harvest' } = null;
  private brush = false;
  private brushed = new Set<number>();
  private suppressTap = false;
  landGroups = new Map<string, THREE.Group>();
  // поставяне
  place: null | { def: BuildingDef; x: number; z: number; rot: number; ghost: THREE.Group; plate: THREE.Mesh; view?: View; onDone?: (ok: boolean) => void; dragging: boolean } = null;

  constructor(public scene: THREE.Scene, public camera: THREE.PerspectiveCamera, public rig: CameraRig) {
    this.group.name = 'farm';
    scene.add(this.group);
  }

  // ---------- мрежа ----------
  idx(x: number, z: number) {
    return (z - FARM.minZ) * this.W + (x - FARM.minX);
  }
  unlocked(x: number, z: number) {
    const rects = [START_LAND, ...S.lands.map((id) => LAND_RECT[id])];
    return rects.some((r) => x >= r[0] && x < r[2] && z >= r[1] && z < r[3]);
  }
  canPlace(def: BuildingDef, x: number, z: number, rot: number, ignore = -1) {
    const [w, d] = footprint(def, rot);
    for (let i = x; i < x + w; i++)
      for (let j = z; j < z + d; j++) {
        if (i < FARM.minX || j < FARM.minZ || i >= FARM.maxX || j >= FARM.maxZ) return false;
        if (!this.unlocked(i, j)) return false;
        const o = this.grid[this.idx(i, j)];
        if (o && o !== ignore) return false;
      }
    return true;
  }
  occupy(e: Entity, uid: number) {
    const [w, d] = footprint(BUILDINGS[e.type], e.rot);
    for (let i = e.x; i < e.x + w; i++) for (let j = e.z; j < e.z + d; j++) if (i >= FARM.minX && j >= FARM.minZ && i < FARM.maxX && j < FARM.maxZ) this.grid[this.idx(i, j)] = uid;
  }

  /** Намира свободно място за обект (близо до дадена точка). */
  findSpot(def: BuildingDef, nearX = 0, nearZ = 0, rot = 0): [number, number] | null {
    let best: [number, number] | null = null, bd = 1e9;
    const [w, d] = footprint(def, rot);
    for (let z = FARM.minZ; z <= FARM.maxZ - d; z++)
      for (let x = FARM.minX; x <= FARM.maxX - w; x++) {
        const dist = Math.hypot(x + w / 2 - nearX, z + d / 2 - nearZ);
        if (dist >= bd) continue;
        if (this.canPlace(def, x, z, rot)) { best = [x, z]; bd = dist; }
      }
    return best;
  }

  // ---------- обекти ----------
  add(type: string, x: number, z: number, rot = 0, extra: Partial<Entity> = {}) {
    const e: Entity = { uid: S.nextUid++, type, x, z, rot, ...extra };
    const def = BUILDINGS[type];
    if (def.kind === 'production') { e.queue ??= []; e.done ??= []; }
    if (def.kind === 'animal') e.animals ??= [];
    S.entities.push(e);
    this.spawn(e);
    save();
    return e;
  }

  remove(uid: number) {
    const v = this.views.get(uid);
    if (!v) return;
    this.occupyClear(v.e);
    v.dispose();
    this.group.remove(v.root);
    this.proxies = this.proxies.filter((p) => p !== v.proxy);
    this.views.delete(uid);
    S.entities = S.entities.filter((e) => e.uid !== uid);
    save();
  }

  occupyClear(e: Entity) {
    for (let i = 0; i < this.grid.length; i++) if (this.grid[i] === e.uid) this.grid[i] = 0;
  }

  spawn(e: Entity) {
    const def = BUILDINGS[e.type];
    if (!def) return;
    let v: View;
    switch (def.kind) {
      case 'field': v = new FieldView(e, def, this); break;
      case 'production': v = new ProductionView(e, def, this); break;
      case 'animal': v = new PenView(e, def, this); break;
      case 'tree': v = new TreeView(e, def, this); break;
      default: v = new BasicView(e, def, this);
    }
    this.positionView(v);
    this.group.add(v.root);
    this.proxies.push(v.proxy);
    this.views.set(e.uid, v);
    this.occupy(e, e.uid);
    return v;
  }

  positionView(v: View) {
    const c = centerOf(v.e);
    v.root.position.set(c.x, 0, c.z);
    v.root.rotation.y = -v.e.rot * (Math.PI / 2);
  }

  /** Всички ниви — за помощ при садене/жънене. */
  fields() {
    return [...this.views.values()].filter((v) => v.def.kind === 'field');
  }
  byType(type: string) {
    return [...this.views.values()].filter((v) => v.e.type === type);
  }

  load() {
    for (const e of S.entities) this.spawn(e);
    this.buildLands();
  }

  // ---------- земя за купуване ----------
  buildLands() {
    for (const [, g] of this.landGroups) this.group.remove(g);
    this.landGroups.clear();
    this.extraPick = this.extraPick.filter((p) => !p.obj.userData.land);
    for (const l of LANDS) {
      if (S.lands.includes(l.id)) continue;
      const [x0, z0, x1, z1] = l.rect;
      const g = new THREE.Group();
      const w = x1 - x0, d = z1 - z0;
      g.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2);
      g.add(overgrowth(w, d, l.id.length * 31 + 7));
      const locked = S.level < l.level;
      const sign = saleSign(locked ? `Ниво ${l.level}` : 'Продава се', `${l.price.toLocaleString('bg-BG')} 🪙`);
      sign.rotation.y = Math.PI / 4;
      g.add(sign);
      const proxy = new THREE.Mesh(new THREE.BoxGeometry(w, 1.5, d), proxyMat);
      proxy.position.y = 0.75;
      proxy.userData.land = l.id;
      g.add(proxy);
      this.extraPick.push({ obj: proxy, tap: () => UI.openLand(l.id) });
      this.group.add(g);
      this.landGroups.set(l.id, g);
    }
  }

  buyLand(id: string) {
    const l = LANDS.find((x) => x.id === id)!;
    if (S.level < l.level) { UI.toast(`Трябва ниво ${l.level}`, 'warn'); return false; }
    if (!spend(l.price)) { UI.toast('Нямаш достатъчно монети', 'warn'); sfx('error'); return false; }
    S.lands.push(id);
    const g = this.landGroups.get(id);
    if (g) sparkle(g.position.clone().setY(1), 30);
    this.buildLands();
    addXP(Math.round(l.price / 20));
    sfx('build');
    save();
    return true;
  }

  // ---------- избиране с пръст ----------
  pick(sx: number, sy: number): View | null {
    ndc.set((sx / innerWidth) * 2 - 1, -(sy / innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, this.camera);
    const hits = ray.intersectObjects(this.proxies, false);
    if (!hits.length) return null;
    // предпочитаме по-малките обекти (ниви пред сгради)
    return (hits[0].object.userData.view as View) ?? null;
  }
  pickExtra(sx: number, sy: number) {
    ndc.set((sx / innerWidth) * 2 - 1, -(sy / innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, this.camera);
    const hits = ray.intersectObjects(this.extraPick.map((p) => p.obj), false);
    if (!hits.length) return null;
    return this.extraPick.find((p) => p.obj === hits[0].object) ?? null;
  }

  // ---------- GameInput ----------
  private longTimer = 0;

  onDown(p: PointerInfo) {
    this.suppressTap = false;
    clearTimeout(this.longTimer);
    if (this.place) {
      const g = this.rig.groundAt(p.x, p.y);
      if (g) {
        const [w, d] = footprint(this.place.def, this.place.rot);
        const cx = this.place.x + w / 2, cz = this.place.z + d / 2;
        if (Math.abs(g.x - cx) < w / 2 + 1.5 && Math.abs(g.z - cz) < d / 2 + 1.5) {
          this.place.dragging = true;
          return true;
        }
      }
      return false;
    }
    const v = this.pick(p.x, p.y);
    // задържане с пръст върху обект → местене (като в Hay Day)
    if (v && !(this.tool?.kind === 'sow' && v.isEmpty?.()) && !v.isReady?.()) {
      this.longTimer = window.setTimeout(async () => {
        if (this.rig.gestureMoved() || !this.rig.isPressing() || this.place) return;
        await this.beginPlace(v.e.type, undefined, v);
        const pl = this.place as Farm['place'];
        if (pl) {
          pl.dragging = true;
          this.rig.claim();
          this.suppressTap = true;
          sfx('pop');
          if (navigator.vibrate) navigator.vibrate(30);
        }
      }, 600);
    }
    if (v && v.def.kind === 'field') {
      if (this.tool?.kind === 'sow' && v.isEmpty!()) {
        this.brush = true;
        this.brushed.clear();
        this.applyBrush(v);
        this.suppressTap = true;
        return true;
      }
      if (v.isReady!()) {
        this.tool = { kind: 'harvest' };
        this.brush = true;
        this.brushed.clear();
        this.applyBrush(v);
        this.suppressTap = true;
        return true;
      }
    }
    return false;
  }

  onDrag(p: PointerInfo) {
    clearTimeout(this.longTimer);
    if (this.place?.dragging) {
      const g = this.rig.groundAt(p.x, p.y);
      if (g) this.moveGhost(g.x, g.z);
      return;
    }
    if (this.brush) {
      // проверяваме и точки между двете позиции, за да не пропуснем ниви при бързо плъзгане
      const v = this.pick(p.x, p.y);
      if (v && v.def.kind === 'field') this.applyBrush(v);
    }
  }

  onUp() {
    clearTimeout(this.longTimer);
    if (this.place) this.place.dragging = false;
    if (this.brush) {
      this.brush = false;
      if (this.tool?.kind === 'harvest') this.tool = null;
    }
  }

  onTap(p: PointerInfo) {
    if (this.suppressTap) { this.suppressTap = false; return; }
    if (this.place) {
      const g = this.rig.groundAt(p.x, p.y);
      if (g) this.moveGhost(g.x, g.z);
      return;
    }
    const v = this.pick(p.x, p.y);
    if (v) {
      if (this.tool?.kind === 'sow' && v.def.kind !== 'field') { this.tool = null; UI.sowMode(null); }
      bounce(v.root);
      v.tap();
      return;
    }
    const ex = this.pickExtra(p.x, p.y);
    if (ex) { ex.tap(); return; }
    if (this.tool) { this.tool = null; UI.sowMode(null); }
    UI.closeAll();
  }

  private applyBrush(v: View) {
    if (this.brushed.has(v.e.uid)) return;
    this.brushed.add(v.e.uid);
    if (this.tool?.kind === 'sow') {
      if (v.isEmpty!() && !v.plant!(this.tool.crop)) { this.brush = false; }
    } else if (this.tool?.kind === 'harvest') {
      if (v.isReady!()) v.harvest!();
    }
  }

  // ---------- поставяне на нов обект / местене ----------
  async beginPlace(type: string, onDone?: (ok: boolean) => void, view?: View) {
    this.cancelPlace();
    const def = BUILDINGS[type];
    // моделът може още да не е зареден (купува се за първи път)
    await ensureModels([def.model, def.kind === 'animal' ? ANIMALS[def.animal!]?.model ?? '' : '']);
    const rot = view ? view.e.rot : 0;
    let x: number, z: number;
    if (view) { x = view.e.x; z = view.e.z; }
    else {
      const t = this.rig.target;
      const spot = this.findSpot(def, t.x, t.z, rot);
      if (!spot) { UI.toast('Няма свободно място! Купи още земя.', 'warn'); onDone?.(false); return; }
      [x, z] = spot;
    }
    let ghost: THREE.Group;
    if (view) {
      ghost = view.root;
      this.occupyClear(view.e);
    } else {
      ghost = previewModel(def);
      this.group.add(ghost);
    }
    const [w, d] = footprint(def, rot);
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x6ee05a, transparent: true, opacity: 0.45, depthWrite: false }));
    plate.renderOrder = 3;
    this.group.add(plate);
    this.place = { def, x, z, rot, ghost, plate, view, onDone, dragging: false };
    this.updateGhost();
    this.rig.flyTo(x + w / 2, z + d / 2);
  }

  moveGhost(gx: number, gz: number) {
    if (!this.place) return;
    const [w, d] = footprint(this.place.def, this.place.rot);
    this.place.x = Math.round(gx - w / 2);
    this.place.z = Math.round(gz - d / 2);
    this.updateGhost();
  }

  rotateGhost() {
    if (!this.place) return;
    this.place.rot = (this.place.rot + 1) % 4;
    this.updateGhost();
  }

  updateGhost() {
    const p = this.place!;
    const [w, d] = footprint(p.def, p.rot);
    const ok = this.canPlace(p.def, p.x, p.z, p.rot, p.view?.e.uid ?? -1);
    p.ghost.position.set(p.x + w / 2, 0, p.z + d / 2);
    p.ghost.rotation.y = -p.rot * (Math.PI / 2);
    p.plate.position.set(p.x + w / 2, 0.08, p.z + d / 2);
    p.plate.scale.set(w, 1, d);
    (p.plate.material as THREE.MeshBasicMaterial).color.set(ok ? 0x6ee05a : 0xff4a3a);
    UI.placing(true, ok);
  }

  confirmPlace() {
    const p = this.place;
    if (!p) return false;
    if (!this.canPlace(p.def, p.x, p.z, p.rot, p.view?.e.uid ?? -1)) { sfx('error'); UI.toast('Тук не може — мястото е заето.', 'warn'); return false; }
    if (p.view) {
      p.view.e.x = p.x; p.view.e.z = p.z; p.view.e.rot = p.rot;
      this.occupy(p.view.e, p.view.e.uid);
      this.positionView(p.view);
      save();
    } else {
      this.group.remove(p.ghost);
      const e = this.add(p.def.id, p.x, p.z, p.rot);
      const v = this.views.get(e.uid)!;
      sparkle(centerOf(e).setY(1.5), 24);
      bounce(v.root);
    }
    sfx('build');
    this.group.remove(p.plate);
    const cb = p.onDone;
    this.place = null;
    UI.placing(false, true);
    cb?.(true);
    return true;
  }

  cancelPlace() {
    const p = this.place;
    if (!p) return;
    this.group.remove(p.plate);
    if (p.view) {
      this.occupy(p.view.e, p.view.e.uid);
      this.positionView(p.view);
    } else this.group.remove(p.ghost);
    this.place = null;
    UI.placing(false, true);
    p.onDone?.(false);
  }

  update(t: number, dt: number) {
    for (const v of this.views.values()) v.update(t, dt);
  }
}

/** Модел за показване при поставяне (полупрозрачен). */
export function previewModel(def: BuildingDef) {
  const g = new THREE.Group();
  if (def.kind === 'field') g.add(soilMesh());
  else if (def.kind === 'animal') {
    const [w, d] = def.foot;
    g.add(fence(w - 0.6, d - 0.6));
    if (def.model && def.size) {
      const h = instance(def.model, def.size);
      h.position.set(-w / 2 + def.size / 2 + 0.4, 0, -d / 2 + def.size / 2 + 0.4);
      g.add(h);
    }
  } else if (def.model) g.add(instance(def.model, def.size, def.kind === 'tree' || def.id === 'd_pine' ? 'y' : 'max'));
  return g;
}

function makeProxy(v: View, w: number, h: number, d: number) {
  const p = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), proxyMat);
  p.position.y = h / 2;
  p.userData.view = v;
  return p;
}

// =====================================================================
// НИВА
class FieldView implements View {
  root = new THREE.Group();
  proxy: THREE.Mesh;
  height = 1;
  private plantObj: THREE.Object3D | null = null;
  private stage = -1;
  private readyFx = 0;
  constructor(public e: Entity, public def: BuildingDef, public farm: Farm) {
    this.root.add(soilMesh());
    this.proxy = makeProxy(this, 3, 0.6, 3);
    this.root.add(this.proxy);
    this.setVisual();
  }
  isEmpty() { return !this.e.crop; }
  isReady() { return !!this.e.crop && now() >= (this.e.ready ?? 0); }
  progress() {
    if (!this.e.crop) return 0;
    const p0 = this.e.planted!, p1 = this.e.ready!;
    return Math.min(1, (now() - p0) / Math.max(1, p1 - p0));
  }
  stageNow() {
    if (!this.e.crop) return -1;
    const p = this.progress();
    return p >= 1 ? 3 : p > 0.62 ? 2 : p > 0.28 ? 1 : 0;
  }
  setVisual() {
    const st = this.stageNow();
    if (st === this.stage) return;
    const grew = this.stage >= 0 && st > this.stage;
    this.stage = st;
    if (this.plantObj) this.root.remove(this.plantObj);
    this.plantObj = null;
    if (st >= 0 && this.e.crop) {
      this.plantObj = cropMesh(this.e.crop, st);
      this.plantObj.rotation.y = (this.e.uid % 2) * Math.PI;
      this.root.add(this.plantObj);
      if (grew) bounce(this.plantObj);
    }
  }
  plant(crop: string) {
    const c = CROPS[crop];
    if (!spend(c.seed)) { UI.toast('Нямаш монети за семена', 'warn'); sfx('error'); return false; }
    const t = now();
    const fast = S.cars.includes('tractor') ? 0.9 : 1;
    this.e.crop = crop;
    this.e.planted = t;
    this.e.ready = t + c.time * 1000 * fast;
    this.stage = -1;
    this.setVisual();
    if (this.plantObj) bounce(this.plantObj);
    sfx('plant');
    popText(`-${c.seed}`, this.root.position.clone().setY(1), '#ffe066');
    save();
    return true;
  }
  harvest() {
    const c = CROPS[this.e.crop!];
    const n = c.yield;
    if (spaceFor(c.id) < n) { UI.toast('Силозът е пълен! Продай нещо или го увеличи.', 'warn'); sfx('error'); return false; }
    addItem(c.id, n);
    const pos = this.root.position.clone().setY(1);
    flyTo(c.id, pos, '#hud-silo', n);
    const xp = ITEMS[c.id].xp;
    flyTo('star', pos, '#hud-xp', 1, 120);
    addXP(xp);
    S.stats.harvested += n;
    this.e.crop = undefined;
    this.e.planted = this.e.ready = undefined;
    this.setVisual();
    sparkle(pos, 8, 2);
    sfx('harvest');
    save();
    return true;
  }
  tap() {
    if (this.isEmpty()) UI.openSeeds(this);
    else if (this.isReady()) this.harvest();
    else UI.fieldInfo(this);
  }
  update(t: number, dt: number) {
    if (this.e.crop) this.setVisual();
    if (this.stage === 3) {
      this.readyFx -= dt;
      if (this.readyFx <= 0) { this.readyFx = 2 + Math.random() * 3; if (Math.random() < 0.3) sparkle(this.root.position.clone().setY(1.3), 3, 0); }
    }
  }
  dispose() {}
}

// =====================================================================
// РАБОТИЛНИЦА
class ProductionView implements View {
  root = new THREE.Group();
  proxy: THREE.Mesh;
  height: number;
  model: THREE.Group;
  mk: Marker;
  private shownDone = '';
  private workT = 0;
  constructor(public e: Entity, public def: BuildingDef, public farm: Farm) {
    this.model = instance(def.model, def.size);
    this.root.add(this.model);
    const s = this.model.userData.size as THREE.Vector3;
    this.height = s?.y ?? 5;
    const [w, d] = def.foot;
    this.proxy = makeProxy(this, w * 0.9, this.height, d * 0.9);
    this.root.add(this.proxy);
    this.mk = marker(new THREE.Vector3(), '', 'mk bubble');
    this.mk.onClick = () => this.tap();
  }
  tick() {
    const t = now();
    const q = this.e.queue!;
    let changed = false;
    while (q.length && q[0].end <= t) {
      const it = q.shift()!;
      this.e.done!.push({ out: it.out, qty: it.qty });
      changed = true;
    }
    if (changed) save();
  }
  start(r: Recipe) {
    const q = this.e.queue!;
    if (q.length + this.e.done!.length >= (this.def.slots ?? 2) + 1 && q.length >= (this.def.slots ?? 2)) { UI.toast('Опашката е пълна', 'warn'); return false; }
    if (q.length >= (this.def.slots ?? 2)) { UI.toast('Опашката е пълна', 'warn'); return false; }
    if (!takeAll(r.needs)) { UI.toast('Не ти стигат съставките', 'warn'); sfx('error'); return false; }
    const t = now();
    const startAt = q.length ? q[q.length - 1].end : t;
    q.push({ out: r.out, qty: r.qty, start: startAt, end: startAt + r.time * 1000 });
    sfx('pop');
    bounce(this.root);
    save();
    return true;
  }
  collect() {
    const d = this.e.done!;
    if (!d.length) return false;
    let got = false;
    while (d.length) {
      const it = d[0];
      if (spaceFor(it.out) < it.qty) { UI.toast('Хамбарът е пълен! Продай нещо или го увеличи.', 'warn'); sfx('error'); break; }
      addItem(it.out, it.qty);
      const pos = this.root.position.clone().setY(this.height * 0.8);
      flyTo(it.out, pos, isSiloItem(it.out) ? '#hud-silo' : '#hud-barn', it.qty);
      flyTo('star', pos, '#hud-xp', 1, 150);
      addXP(ITEMS[it.out].xp * it.qty);
      S.stats.produced += it.qty;
      d.shift();
      got = true;
    }
    if (got) { sfx('collect'); save(); }
    return got;
  }
  tap() {
    this.tick();
    if (this.e.done!.length && this.collect()) return;
    UI.openProduction(this);
  }
  update(t: number, dt: number) {
    this.tick();
    const d = this.e.done!;
    this.mk.pos.copy(this.root.position).setY(this.height + 0.8);
    if (d.length) {
      const key = d[0].out + d.length;
      if (key !== this.shownDone) {
        this.shownDone = key;
        this.mk.el.innerHTML = `<img src="${icon(d[0].out)}">${d.length > 1 ? `<b>${d.length}</b>` : ''}`;
      }
      this.mk.visible = true;
    } else this.mk.visible = false;
    // докато работи — леко „диша“
    if (this.e.queue!.length) {
      this.workT += dt;
      const s = 1 + Math.sin(this.workT * 6) * 0.012;
      this.model.scale.set(1 / s, s, 1 / s);
    } else this.model.scale.set(1, 1, 1);
  }
  dispose() { removeMarker(this.mk); }
}

// =====================================================================
// СКЛАДОВЕ, КЪЩА, ТАБЛО, ГАРАЖ, УКРАСА
class BasicView implements View {
  root = new THREE.Group();
  proxy: THREE.Mesh;
  height = 3;
  model: THREE.Object3D;
  mk: Marker | null = null;
  constructor(public e: Entity, public def: BuildingDef, public farm: Farm) {
    this.model = this.makeModel();
    this.root.add(this.model);
    const [w, d] = def.foot;
    this.proxy = makeProxy(this, w * 0.95, Math.max(1.2, this.height), d * 0.95);
    this.root.add(this.proxy);
    if (def.id === 'house') {
      this.mk = marker(new THREE.Vector3(), `<img src="${icon('coin')}"><b>!</b>`, 'mk bubble gift');
      this.mk.onClick = () => this.tap();
    }
  }
  makeModel(): THREE.Object3D {
    const def = this.def;
    if (def.id === 'board') {
      const b = orderBoard();
      b.scale.setScalar(1.35);
      this.height = 3.2;
      return b;
    }
    if (def.id === 'house') {
      const tier = HOME_TIERS[S.home] ?? HOME_TIERS[0];
      const m = instance(tier.model, tier.size);
      this.height = (m.userData.size as THREE.Vector3).y;
      return m;
    }
    const by = def.id === 'd_pine' || def.id === 'd_scarecrow' ? 'y' : 'max';
    const m = instance(def.model, def.size, by);
    if (/^d_(pine|bush|flowers1|lavender)/.test(def.id)) windify(m, 4, 0.1);
    this.height = (m.userData.size as THREE.Vector3)?.y ?? 2;
    return m;
  }
  setVisual() {
    this.root.remove(this.model);
    this.model = this.makeModel();
    this.root.add(this.model);
  }
  tap() {
    sfx('tap');
    switch (this.def.id) {
      case 'house': UI.openHome(); break;
      case 'board': UI.openOrders(); break;
      case 'garage': UI.openGarage(); break;
      case 'market': UI.openMarket(); break;
      case 'barn': UI.openStorage(false); break;
      case 'silo': UI.openStorage(true); break;
      default: UI.openDeco(this);
    }
  }
  update() {
    if (this.mk) {
      const day = new Date().toDateString();
      this.mk.visible = new Date(S.lastDaily).toDateString() !== day;
      this.mk.pos.copy(this.root.position).setY(this.height + 1);
    }
    if (this.def.id === 'board') {
      const ready = S.orders.filter((o) => !o.wait);
      this.model.children.forEach((c) => {
        if (c.name.startsWith('paper')) c.visible = +c.name.slice(5) < ready.length;
      });
    }
  }
  dispose() { removeMarker(this.mk); }
}

// =====================================================================
// ЖИВОТНИ
interface AnimalObj {
  obj: THREE.Group;
  mixer?: THREE.AnimationMixer;
  walk?: THREE.AnimationAction;
  idle?: THREE.AnimationAction;
  eat?: THREE.AnimationAction;
  target: THREE.Vector3;
  wait: number;
  moving: boolean;
  mk: Marker;
  phase: number;
  speed: number;
}

class PenView implements View {
  root = new THREE.Group();
  proxy: THREE.Mesh;
  height = 3;
  animals: AnimalObj[] = [];
  trough: THREE.Group;
  kind: string;
  house: THREE.Group | null = null;
  hungryMk: Marker;
  private soundT = 3 + Math.random() * 10;
  constructor(public e: Entity, public def: BuildingDef, public farm: Farm) {
    this.kind = def.animal!;
    const [w, d] = def.foot;
    this.root.add(yard(w - 0.4, d - 0.4, this.kind === 'bee' ? '#8fbf5a' : '#c2a46a'));
    this.root.add(fence(w - 0.6, d - 0.6));
    if (this.kind === 'bee') {
      // кошерите са самите „животни“
      for (let i = 0; i < 6; i++) {
        const f = instance(['n_flower_group1', 'n_petal_pink', 'n_petal_yellow', 'n_flower_single'][i % 4], i % 4 === 0 ? 1.1 : 0.45);
        f.position.set(-w / 2 + 1 + (i % 3) * 1.6, 0, d / 2 - 1.2 - Math.floor(i / 3) * 0.8);
        this.root.add(f);
      }
    } else if (def.model && def.size) {
      this.house = instance(def.model, def.size);
      const hs = this.house.userData.size as THREE.Vector3;
      this.house.position.set(-w / 2 + hs.x / 2 + 0.5, 0, -d / 2 + hs.z / 2 + 0.5);
      this.root.add(this.house);
      this.height = hs.y;
    }
    this.trough = trough(false);
    this.trough.position.set(w / 2 - 1.6, 0, -d / 2 + 1.3);
    if (this.kind !== 'bee') this.root.add(this.trough);
    this.proxy = makeProxy(this, w, 2.2, d);
    this.root.add(this.proxy);
    this.hungryMk = marker(new THREE.Vector3(), '', 'mk bubble hungry');
    this.hungryMk.onClick = () => this.tap();
    for (let i = 0; i < this.e.animals!.length; i++) this.spawnAnimal(i);
  }
  bounds() {
    const [w, d] = this.def.foot;
    return { x0: -w / 2 + 1, x1: w / 2 - 1, z0: -d / 2 + 1, z1: d / 2 - 1 };
  }
  randomSpot() {
    const b = this.bounds();
    const hs = this.house ? (this.house.userData.size as THREE.Vector3) : null;
    for (let k = 0; k < 20; k++) {
      const x = b.x0 + Math.random() * (b.x1 - b.x0), z = b.z0 + Math.random() * (b.z1 - b.z0);
      if (hs && x < b.x0 + hs.x + 0.3 && z < b.z0 + hs.z + 0.3) continue;
      return new THREE.Vector3(x, 0, z);
    }
    return new THREE.Vector3(b.x1 - 1, 0, b.z1 - 1);
  }
  spawnAnimal(i: number) {
    const a = ANIMALS[this.kind];
    let obj: THREE.Group;
    let mixer: THREE.AnimationMixer | undefined, walk, idle, eat;
    if (this.kind === 'bee') {
      obj = new THREE.Group();
      obj.add(beehive());
      const [w, d] = this.def.foot;
      obj.position.set(-w / 2 + 1.5 + i * 1.7, 0, -d / 2 + 1.6);
      const bee = instance('bee', 0.35);
      bee.name = 'bee';
      obj.add(bee);
    } else {
      const model = this.kind === 'chicken' ? (i % 3 === 2 ? 'chicken' : 'hen') : a.model;
      obj = instance(model, a.size);
      obj.position.copy(this.randomSpot());
      obj.rotation.y = Math.random() * 6.28;
      if (animationsOf(model).length) {
        mixer = new THREE.AnimationMixer(obj);
        const w = clipBy(model, 'Walk'), id = clipBy(model, 'Idle'), ea = clipBy(model, 'Eating') ?? clipBy(model, 'Idle_Headlow');
        if (w) walk = mixer.clipAction(w);
        if (id) idle = mixer.clipAction(id);
        if (ea) eat = mixer.clipAction(ea);
        idle?.play();
        mixer.update(Math.random() * 3);
      }
    }
    this.root.add(obj);
    const mk = marker(new THREE.Vector3(), `<img src="${icon(a.product)}">`, 'mk bubble small');
    mk.onClick = () => this.tap();
    this.animals[i] = { obj, mixer, walk, idle, eat, target: obj.position.clone(), wait: Math.random() * 3, moving: false, mk, phase: Math.random() * 10, speed: this.kind === 'chicken' ? 1.1 : 0.9 };
  }
  isAnimalReady(i: number) {
    const s = this.e.animals![i];
    return s.ready != null && now() >= s.ready;
  }
  collect() {
    const a = ANIMALS[this.kind];
    let n = 0;
    this.e.animals!.forEach((s, i) => {
      if (!this.isAnimalReady(i)) return;
      if (spaceFor(a.product) < 1) return;
      addItem(a.product, 1);
      const pos = this.root.localToWorld(this.animals[i].obj.position.clone()).setY(1.5);
      flyTo(a.product, pos, '#hud-barn', 1, n * 80);
      n++;
      if (this.kind === 'bee') { s.fed = now(); s.ready = now() + a.time * 1000; }
      else { s.fed = null; s.ready = null; }
    });
    if (n) {
      addXP(ITEMS[a.product].xp * n);
      flyTo('star', this.root.position.clone().setY(2), '#hud-xp', 1, 200);
      sfx('collect');
      save();
    } else if (this.e.animals!.some((_, i) => this.isAnimalReady(i))) {
      UI.toast('Хамбарът е пълен!', 'warn');
      sfx('error');
    }
    return n > 0;
  }
  feedAll() {
    const a = ANIMALS[this.kind];
    if (!a.feed) return 0;
    let n = 0;
    for (const s of this.e.animals!) {
      if (s.fed != null) continue;
      if (count(a.feed) < 1) break;
      takeAll({ [a.feed]: 1 });
      s.fed = now();
      s.ready = now() + a.time * 1000;
      n++;
    }
    if (n) {
      popText(`Нахранени: ${n}`, this.root.position.clone().setY(2.5), '#fff');
      sfx(this.kind === 'cow' ? 'moo' : this.kind === 'sheep' || this.kind === 'goat' ? 'baa' : 'cluck');
      save();
    }
    return n;
  }
  buyAnimal() {
    const a = ANIMALS[this.kind];
    const max = 6;
    if (this.e.animals!.length >= max) { UI.toast('Няма място за още', 'warn'); return false; }
    if (!spend(a.price)) { UI.toast('Нямаш достатъчно монети', 'warn'); sfx('error'); return false; }
    const s = this.kind === 'bee' ? { fed: now(), ready: now() + a.time * 1000 } : { fed: null, ready: null };
    this.e.animals!.push(s);
    this.spawnAnimal(this.e.animals!.length - 1);
    sparkle(this.root.position.clone().setY(1), 16);
    addXP(Math.max(2, Math.round(a.price / 25)));
    sfx(this.kind === 'cow' ? 'moo' : this.kind === 'sheep' || this.kind === 'goat' ? 'baa' : this.kind === 'bee' ? 'buzz' : 'cluck');
    save();
    return true;
  }
  tap() {
    if (this.collect()) return;
    const a = ANIMALS[this.kind];
    const hungry = this.e.animals!.filter((s) => s.fed == null).length;
    if (a.feed && hungry && count(a.feed) > 0) { this.feedAll(); return; }
    UI.openAnimals(this);
  }
  update(t: number, dt: number) {
    const a = ANIMALS[this.kind];
    let hungry = 0;
    this.animals.forEach((an, i) => {
      if (!an) return;
      const s = this.e.animals![i];
      if (s.fed == null && a.feed) hungry++;
      const ready = this.isAnimalReady(i);
      an.mk.visible = ready;
      an.mk.pos.copy(this.root.localToWorld(an.obj.position.clone())).setY(this.kind === 'bee' ? 2.6 : a.size * 0.9 + 1.0);
      an.mixer?.update(dt);
      if (this.kind === 'bee') {
        const bee = an.obj.getObjectByName('bee');
        if (bee) {
          an.phase += dt;
          bee.position.set(Math.cos(an.phase * 1.7) * 0.9, 1.6 + Math.sin(an.phase * 3.1) * 0.3, Math.sin(an.phase * 1.3) * 0.9);
          bee.rotation.y = -an.phase * 1.7;
        }
        return;
      }
      // разходка из двора
      if (an.moving) {
        const p = an.obj.position;
        const dx = an.target.x - p.x, dz = an.target.z - p.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 0.1) {
          an.moving = false;
          an.wait = 2 + Math.random() * 6;
          an.walk?.fadeOut(0.3);
          const next = Math.random() < 0.5 && an.eat ? an.eat : an.idle;
          next?.reset().fadeIn(0.3).play();
        } else {
          const sp = an.speed * dt;
          p.x += (dx / dist) * Math.min(sp, dist);
          p.z += (dz / dist) * Math.min(sp, dist);
          const ang = Math.atan2(dx, dz);
          let da = ang - an.obj.rotation.y;
          while (da > Math.PI) da -= Math.PI * 2;
          while (da < -Math.PI) da += Math.PI * 2;
          an.obj.rotation.y += da * Math.min(1, dt * 6);
          if (!an.mixer) {
            // без анимация: подрусване при ходене
            an.phase += dt * 12;
            an.obj.children[0].position.y = Math.abs(Math.sin(an.phase)) * 0.08 * a.size;
            an.obj.children[0].rotation.z = Math.sin(an.phase) * 0.08;
          }
        }
      } else {
        an.wait -= dt;
        if (!an.mixer) {
          an.phase += dt * 3;
          // кълве / мърда глава
          an.obj.children[0].rotation.x = Math.max(0, Math.sin(an.phase)) * (this.kind === 'chicken' ? 0.35 : 0.12);
          an.obj.children[0].position.y = 0;
          an.obj.children[0].rotation.z = 0;
        }
        if (an.wait <= 0) {
          an.target = this.randomSpot();
          an.moving = true;
          an.idle?.fadeOut(0.3);
          an.eat?.fadeOut(0.3);
          an.walk?.reset().fadeIn(0.3).play();
        }
      }
    });
    const food = this.trough.getObjectByName('food');
    if (food) food.visible = this.e.animals!.some((s) => s.fed != null);
    this.hungryMk.visible = hungry > 0 && !!a.feed;
    if (this.hungryMk.visible) {
      const key = `${a.feed}${count(a.feed!) > 0}`;
      if (this.hungryMk.el.dataset.k !== key) {
        this.hungryMk.el.dataset.k = key;
        this.hungryMk.el.innerHTML = `<img src="${icon(a.feed!)}">${count(a.feed!) > 0 ? '' : '<i>!</i>'}`;
      }
      this.hungryMk.pos.copy(this.trough.getWorldPosition(new THREE.Vector3())).setY(2);
    }
    this.soundT -= dt;
    if (this.soundT <= 0) {
      this.soundT = 8 + Math.random() * 20;
      // звук само ако е близо до камерата
      const d = this.root.position.distanceTo(this.farm.rig.target);
      if (d < 25 && this.animals.length) sfx(this.kind === 'cow' ? 'moo' : this.kind === 'sheep' || this.kind === 'goat' ? 'baa' : this.kind === 'bee' ? 'buzz' : 'cluck');
    }
  }
  dispose() {
    for (const a of this.animals) removeMarker(a?.mk);
    removeMarker(this.hungryMk);
  }
}

// =====================================================================
// ПЛОДНО ДЪРВО
class TreeView implements View {
  root = new THREE.Group();
  proxy: THREE.Mesh;
  height = 4.5;
  fruits = new THREE.Group();
  mk: Marker;
  info: { fruit: string; time: number; yield: number };
  constructor(public e: Entity, public def: BuildingDef, public farm: Farm) {
    this.info = TREES[def.id];
    const m = instance(def.model, def.size, 'y');
    windify(m, 5, 0.1, (mt) => /Leaves|Green/i.test(mt.name));
    this.root.add(m);
    this.height = def.size;
    // плодовете — топчета в короната
    const col = { apple: '#e0302a', plum: '#5b2a7a', cherry: '#c4192a', walnut: '#8a6a3a' }[this.info.fruit] ?? '#e0302a';
    const g = new THREE.SphereGeometry(0.16, 8, 6);
    const mt = new THREE.MeshStandardMaterial({ color: col, roughness: 0.35 });
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + i * 0.7;
      const r = 0.9 + (i % 3) * 0.35;
      const f = new THREE.Mesh(g, mt);
      f.position.set(Math.cos(a) * r, def.size * (0.5 + (i % 4) * 0.09), Math.sin(a) * r);
      f.castShadow = true;
      this.fruits.add(f);
    }
    this.root.add(this.fruits);
    this.proxy = makeProxy(this, 2.6, def.size, 2.6);
    this.root.add(this.proxy);
    this.mk = marker(new THREE.Vector3(), `<img src="${icon(this.info.fruit)}">`, 'mk bubble small');
    this.mk.onClick = () => this.tap();
    if (this.e.ready == null) this.e.ready = now() + this.info.time * 1000;
  }
  isReady() { return now() >= (this.e.ready ?? 0); }
  harvest() {
    const n = this.info.yield;
    if (spaceFor(this.info.fruit) < n) { UI.toast('Силозът е пълен!', 'warn'); sfx('error'); return false; }
    addItem(this.info.fruit, n);
    const pos = this.root.position.clone().setY(this.height * 0.6);
    flyTo(this.info.fruit, pos, '#hud-silo', n);
    addXP(ITEMS[this.info.fruit].xp);
    flyTo('star', pos, '#hud-xp', 1, 120);
    this.e.ready = now() + this.info.time * 1000;
    sfx('harvest');
    save();
    return true;
  }
  tap() {
    if (this.isReady()) this.harvest();
    else UI.openTree(this);
  }
  update() {
    const r = this.isReady();
    const p = Math.min(1, 1 - ((this.e.ready ?? 0) - now()) / (this.info.time * 1000));
    this.fruits.visible = p > 0.35;
    this.fruits.scale.setScalar(0.4 + Math.min(1, p) * 0.6);
    this.mk.visible = r;
    this.mk.pos.copy(this.root.position).setY(this.height + 0.6);
  }
  dispose() { removeMarker(this.mk); }
}

export { FieldView, ProductionView, PenView, TreeView, BasicView };
export const ensureModels = async (names: string[]) => { await Promise.all(names.filter((n) => n && !has(n)).map((n) => loadModel(n))); };
export { emit };
