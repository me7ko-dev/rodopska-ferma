import * as THREE from 'three';
import { instance, animationsOf } from '../engine/assets';
import { ITEMS, CARS } from './data';
import { S, save, takeAll, addCoins, addXP, count } from './state';
import { makeable } from './orders';
import { DRIVE, ROAD_Z, FARM } from '../world/layout';
import { marker, removeMarker, flyTo, type Marker } from './fx';
import { icon } from '../ui/icons';
import { UI } from '../ui/api';
import { sfx } from '../audio/sfx';
import type { Farm } from './world';
import { centerOf } from './world';

const NAMES = ['Баба Ремзие', 'Чичо Мустафа', 'Тодорка', 'Илиян', 'Фатме', 'Кольо', 'Сабрие', 'Митко', 'Айля', 'Наско'];
const MODELS = ['man1', 'man2', 'woman1', 'woman_dress', 'woman_casual', 'man_sleeves', 'woman_tank', 'm_worker', 'w_worker'];

interface Walker {
  obj: THREE.Group;
  mixer: THREE.AnimationMixer;
  walk?: THREE.AnimationAction;
  idle?: THREE.AnimationAction;
  path: THREE.Vector3[];
  speed: number;
  moving: boolean;
}

function makeWalker(model: string, height = 2.1): Walker {
  const obj = instance(model, height, 'y');
  const mixer = new THREE.AnimationMixer(obj);
  const clips = animationsOf(model);
  const walkC = clips.find((c) => /(\||_)Walk$/.test(c.name));
  const idleC = clips.find((c) => /(\||_)Idle$/.test(c.name)) ?? clips.find((c) => /Idle/.test(c.name));
  const walk = walkC ? mixer.clipAction(walkC) : undefined;
  const idle = idleC ? mixer.clipAction(idleC) : undefined;
  idle?.play();
  return { obj, mixer, walk, idle, path: [], speed: 2.2, moving: false };
}

function stepWalker(w: Walker, dt: number) {
  w.mixer.update(dt);
  if (!w.path.length) {
    if (w.moving) {
      w.moving = false;
      w.walk?.fadeOut(0.25);
      w.idle?.reset().fadeIn(0.25).play();
    }
    return true;
  }
  if (!w.moving) {
    w.moving = true;
    w.idle?.fadeOut(0.25);
    w.walk?.reset().fadeIn(0.25).play();
  }
  const p = w.obj.position, t = w.path[0];
  const dx = t.x - p.x, dz = t.z - p.z, d = Math.hypot(dx, dz);
  if (d < 0.15) { w.path.shift(); return false; }
  const s = Math.min(d, w.speed * dt);
  p.x += (dx / d) * s;
  p.z += (dz / d) * s;
  const ang = Math.atan2(dx, dz);
  let da = ang - w.obj.rotation.y;
  while (da > Math.PI) da -= Math.PI * 2;
  while (da < -Math.PI) da += Math.PI * 2;
  w.obj.rotation.y += da * Math.min(1, dt * 8);
  return false;
}

interface Visitor extends Walker {
  name: string;
  item: string;
  qty: number;
  coins: number;
  xp: number;
  state: 'come' | 'wait' | 'leave';
  mk: Marker;
  spot: THREE.Vector3;
  waitT: number;
}

export class People {
  farmer: Walker;
  farmerWait = 2;
  visitors: Visitor[] = [];
  nextVisitor = 25;
  group = new THREE.Group();

  constructor(public scene: THREE.Scene, public farm: Farm) {
    scene.add(this.group);
    this.farmer = makeWalker('m_farmer', 2.3);
    this.farmer.speed = 2.6;
    const house = farm.byType('house')[0];
    const c = house ? centerOf(house.e) : new THREE.Vector3(0, 0, 0);
    this.farmer.obj.position.set(c.x, 0, c.z + 5.5);
    this.group.add(this.farmer.obj);
  }

  /** Фермерът обикаля нивите, хамбара и къщата. */
  private farmerThink() {
    const targets = [...this.farm.views.values()].filter((v) => ['field', 'production', 'storage', 'special', 'animal'].includes(v.def.kind));
    if (!targets.length) return;
    const v = targets[(Math.random() * targets.length) | 0];
    const c = centerOf(v.e);
    const off = v.def.kind === 'field' ? 2.2 : v.def.foot[1] / 2 + 1.2;
    const to = new THREE.Vector3(c.x + (Math.random() - 0.5) * 2, 0, c.z + off);
    to.x = THREE.MathUtils.clamp(to.x, FARM.minX + 1, FARM.maxX - 1);
    to.z = THREE.MathUtils.clamp(to.z, FARM.minZ + 1, FARM.maxZ - 1);
    this.farmer.path = [to];
  }

  private spawnVisitor() {
    const pool = makeable();
    if (!pool.length) return;
    const item = pool[(Math.random() * pool.length) | 0];
    const it = ITEMS[item];
    const qty = it.price < 15 ? 2 + ((Math.random() * 4) | 0) : it.price < 60 ? 1 + ((Math.random() * 2) | 0) : 1;
    const taxi = S.cars.includes('taxi') ? 1.1 : 1;
    const w = makeWalker(MODELS[(Math.random() * MODELS.length) | 0]) as Visitor;
    w.name = NAMES[(Math.random() * NAMES.length) | 0];
    w.item = item;
    w.qty = qty;
    w.coins = Math.round(it.price * qty * (1.45 + Math.random() * 0.4) * taxi);
    w.xp = Math.max(1, Math.round(it.xp * qty * 1.2));
    w.state = 'come';
    w.waitT = 240;
    const n = this.visitors.length;
    const board = this.farm.byType('board')[0];
    const base = board ? centerOf(board.e) : new THREE.Vector3(DRIVE.x, 0, FARM.maxZ - 6);
    w.spot = new THREE.Vector3(DRIVE.x - 2.2 - n * 1.6, 0, base.z + 2.5 + n * 0.5);
    w.obj.position.set(DRIVE.x + (Math.random() < 0.5 ? -18 : 18), 0, ROAD_Z + 4.6);
    w.path = [new THREE.Vector3(DRIVE.x + 1.2, 0, ROAD_Z + 4.6), new THREE.Vector3(DRIVE.x + 1.2, 0, ROAD_Z - 3), new THREE.Vector3(DRIVE.x, 0, w.spot.z + 1.5), w.spot.clone()];
    w.speed = 2.9;
    w.mk = marker(new THREE.Vector3(), `<img src="${icon(item)}"><b>${qty}</b>`, 'mk bubble visitor');
    w.mk.onClick = () => this.talk(w);
    this.group.add(w.obj);
    this.visitors.push(w);
  }

  talk(w: Visitor) {
    if (w.state !== 'wait') return;
    UI.openVisitor(w, () => {
      if (count(w.item) < w.qty) { UI.toast('Нямаш достатъчно', 'warn'); sfx('error'); return; }
      takeAll({ [w.item]: w.qty });
      addCoins(w.coins);
      addXP(w.xp);
      S.stats.visitors++;
      save();
      const pos = w.obj.position.clone().setY(2.2);
      flyTo('coin', pos, '#hud-coins', 4);
      flyTo('star', pos, '#hud-xp', 1, 150);
      sfx('coin');
      this.leave(w);
    }, () => this.leave(w));
  }

  leave(w: Visitor) {
    w.state = 'leave';
    w.mk.visible = false;
    w.path = [new THREE.Vector3(DRIVE.x - 1.2, 0, w.obj.position.z + 1), new THREE.Vector3(DRIVE.x - 1.2, 0, ROAD_Z - 3), new THREE.Vector3(DRIVE.x - 1.2, 0, ROAD_Z + 4.6), new THREE.Vector3(DRIVE.x - 70, 0, ROAD_Z + 4.6)];
  }

  update(dt: number) {
    // фермер
    if (stepWalker(this.farmer, dt)) {
      this.farmerWait -= dt;
      if (this.farmerWait <= 0) { this.farmerWait = 3 + Math.random() * 6; this.farmerThink(); }
    }
    // посетители
    if (this.farm.byType('board').length) {
      this.nextVisitor -= dt;
      if (this.nextVisitor <= 0 && this.visitors.length < 3 && S.level >= 2) {
        this.nextVisitor = 70 + Math.random() * 110;
        this.spawnVisitor();
      }
    }
    for (let i = this.visitors.length - 1; i >= 0; i--) {
      const w = this.visitors[i];
      const done = stepWalker(w, dt);
      if (w.state === 'come' && done) {
        w.state = 'wait';
        w.obj.rotation.y = 0;
      }
      if (w.state === 'wait') {
        w.mk.visible = true;
        w.mk.pos.copy(w.obj.position).setY(3.1);
        w.waitT -= dt;
        if (w.waitT <= 0) this.leave(w);
      }
      if (w.state === 'leave' && done) {
        this.group.remove(w.obj);
        removeMarker(w.mk);
        this.visitors.splice(i, 1);
      }
    }
  }
}

void CARS;
