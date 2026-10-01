import * as THREE from 'three';
import { CARS } from './data';
import { S } from './state';
import { instance, has, loadModel } from '../engine/assets';
import { heightAt, roadZAt, ROAD_Z, DRIVE, FARM } from '../world/layout';
import type { Farm } from './world';
import { centerOf, footprint } from './world';
import { BUILDINGS } from './data';
import type { CameraRig } from '../engine/camera';
import { sfx } from '../audio/sfx';

/** Колите: паркирани до гаража, доставки и каране. */
export class Vehicles {
  parked = new THREE.Group();
  deliveries: { obj: THREE.Group; path: THREE.Vector3[]; t: number; len: number }[] = [];
  drive: null | {
    car: (typeof CARS)[number];
    obj: THREE.Group;
    speed: number;
    heading: number;
    keys: Set<string>;
    joy: { x: number; y: number; active: boolean };
    lastYaw: number;
    prevDist: number;
  } = null;
  onDriveChange: (on: boolean) => void = () => {};
  private engineT = 0;

  constructor(public scene: THREE.Scene, public farm: Farm, public rig: CameraRig) {
    scene.add(this.parked);
    addEventListener('keydown', (e) => this.drive?.keys.add(e.key.toLowerCase()));
    addEventListener('keyup', (e) => this.drive?.keys.delete(e.key.toLowerCase()));
    this.refresh();
  }

  garage() {
    return this.farm.byType('garage')[0];
  }

  /** Подрежда купените коли до гаража. */
  refresh() {
    const owned0 = CARS.filter((car) => S.cars.includes(car.id));
    const missing = owned0.map((c) => c.model).filter((m) => !has(m));
    if (missing.length) { Promise.all(missing.map((m) => loadModel(m))).then(() => this.refresh()); }
    this.parked.clear();
    const g = this.garage();
    if (!g) return;
    const c = centerOf(g.e);
    const [w, d] = footprint(BUILDINGS.garage, g.e.rot);
    const owned = CARS.filter((car) => S.cars.includes(car.id) && car.id !== this.drive?.car.id);
    owned.slice(0, 4).forEach((car, i) => {
      const o = instance(car.model, car.size);
      // под навеса и до него
      o.position.set(c.x - w / 2 + 1.8 + i * 2.6, 0, c.z + d / 2 + 2.2);
      o.rotation.y = Math.PI;
      if (i === 0) o.position.set(c.x, 0, c.z + 0.3);
      if (i === 0) o.rotation.y = 0;
      o.userData.car = car.id;
      this.parked.add(o);
    });
  }

  /** Пикапът отнася поръчката: тръгва от таблото, излиза на пътя и заминава. */
  deliverAnim() {
    const board = this.farm.byType('board')[0];
    const start = board ? centerOf(board.e) : new THREE.Vector3(DRIVE.x, 0, FARM.maxZ - 4);
    const model = S.cars.includes('truck') ? 'car_truck' : 'car_pickup';
    const obj = instance(model, model === 'car_truck' ? 6.8 : 5.4);
    const path = [
      new THREE.Vector3(start.x + 2, 0, start.z + 1),
      new THREE.Vector3(DRIVE.x, 0, start.z + 3),
      new THREE.Vector3(DRIVE.x, 0, ROAD_Z - 4),
      new THREE.Vector3(DRIVE.x + 4, 0, ROAD_Z + 1.7),
      new THREE.Vector3(DRIVE.x + 40, 0, ROAD_Z + 1.7),
      new THREE.Vector3(DRIVE.x + 220, 0, ROAD_Z + 1.7),
    ];
    let len = 0;
    for (let i = 1; i < path.length; i++) len += path[i].distanceTo(path[i - 1]);
    this.scene.add(obj);
    this.deliveries.push({ obj, path, t: 0, len });
    sfx('truck');
  }

  // ---------- каране ----------
  async startDrive(carId: string) {
    const car = CARS.find((c) => c.id === carId);
    if (!car) return;
    await loadModel(car.model);
    this.stopDrive();
    const obj = instance(car.model, car.size);
    const g = this.garage();
    const start = g ? centerOf(g.e).add(new THREE.Vector3(0, 0, 6)) : new THREE.Vector3(DRIVE.x, 0, 20);
    obj.position.copy(start);
    this.scene.add(obj);
    this.drive = { car, obj, speed: 0, heading: 0, keys: new Set(), joy: { x: 0, y: 0, active: false }, lastYaw: this.rig.goal.yaw, prevDist: this.rig.goal.distance };
    this.refresh();
    this.rig.follow = obj;
    this.rig.goal.distance = 30;
    this.onDriveChange(true);
    sfx('truck');
  }

  stopDrive() {
    if (!this.drive) return;
    this.scene.remove(this.drive.obj);
    this.rig.follow = null;
    this.rig.goal.distance = this.drive.prevDist;
    this.drive = null;
    this.refresh();
    this.onDriveChange(false);
  }

  honk() {
    sfx('truck');
  }

  /** Сблъсък с обектите във фермата (кръг срещу правоъгълник). */
  private blocked(x: number, z: number) {
    if (Math.abs(x) > 420 || z < -110 || z > 140) return true;
    if (heightAt(x, z) > 7) return true;
    const r = 1.4;
    for (const v of this.farm.views.values()) {
      if (v.def.kind === 'field' || v.def.kind === 'deco') continue;
      const c = centerOf(v.e);
      const [w, d] = footprint(v.def, v.e.rot);
      const hw = w / 2 - 0.4, hd = d / 2 - 0.4;
      if (x > c.x - hw - r && x < c.x + hw + r && z > c.z - hd - r && z < c.z + hd + r) {
        if (v.def.kind === 'animal') return true;
        if (Math.abs(x - c.x) < hw * 0.8 + r && Math.abs(z - c.z) < hd * 0.8 + r) return true;
      }
    }
    return false;
  }

  update(dt: number) {
    // доставки
    for (let i = this.deliveries.length - 1; i >= 0; i--) {
      const d = this.deliveries[i];
      d.t += dt * 9;
      if (d.t >= d.len) {
        this.scene.remove(d.obj);
        this.deliveries.splice(i, 1);
        continue;
      }
      let rem = d.t;
      for (let k = 1; k < d.path.length; k++) {
        const a = d.path[k - 1], b = d.path[k];
        const l = a.distanceTo(b);
        if (rem <= l) {
          const p = a.clone().lerp(b, rem / l);
          d.obj.position.set(p.x, 0.05, p.z);
          d.obj.rotation.y = Math.atan2(b.x - a.x, b.z - a.z);
          break;
        }
        rem -= l;
      }
    }

    const dv = this.drive;
    if (!dv) return;
    const k = dv.keys;
    const max = (dv.car.speed / 3.6) * 0.55; // м/с (малко по-бавно — да е приятно на малката карта)
    let throttle = 0, steer = 0;
    if (k.has('w') || k.has('arrowup') || k.has('ц')) throttle += 1;
    if (k.has('s') || k.has('arrowdown') || k.has('с')) throttle -= 1;
    if (k.has('a') || k.has('arrowleft') || k.has('а')) steer += 1;
    if (k.has('d') || k.has('arrowright') || k.has('д')) steer -= 1;
    if (dv.joy.active) {
      // джойстикът показва посоката спрямо екрана — колата завива натам
      const mag = Math.min(1, Math.hypot(dv.joy.x, dv.joy.y));
      if (mag > 0.15) {
        const camYaw = this.rig.yaw;
        const want = camYaw + Math.PI - Math.atan2(dv.joy.x, dv.joy.y);
        let da = want - dv.heading;
        while (da > Math.PI) da -= Math.PI * 2;
        while (da < -Math.PI) da += Math.PI * 2;
        steer = THREE.MathUtils.clamp(da * 2.2, -1, 1);
        throttle = mag * (Math.abs(da) > 2.4 ? 0.4 : 1);
      }
    }
    const acc = throttle > 0 ? 9 : throttle < 0 ? (dv.speed > 0 ? 16 : 6) : 0;
    if (throttle !== 0) dv.speed += throttle * acc * dt;
    else dv.speed *= Math.pow(0.35, dt);
    dv.speed = THREE.MathUtils.clamp(dv.speed, -max * 0.35, max);
    const turn = steer * dt * 2.2 * THREE.MathUtils.clamp(Math.abs(dv.speed) / 4, 0, 1) * Math.sign(dv.speed || 1);
    dv.heading += turn;
    const nx = dv.obj.position.x + Math.sin(dv.heading) * dv.speed * dt;
    const nz = dv.obj.position.z + Math.cos(dv.heading) * dv.speed * dt;
    if (this.blocked(nx, nz)) {
      if (Math.abs(dv.speed) > 4) sfx('error');
      dv.speed = -dv.speed * 0.25;
    } else {
      dv.obj.position.x = nx;
      dv.obj.position.z = nz;
    }
    const h = Math.max(0, heightAt(dv.obj.position.x, dv.obj.position.z));
    dv.obj.position.y = h + 0.05;
    dv.obj.rotation.y = dv.heading;
    dv.obj.userData.speed = dv.speed;
    // наклон по терена
    const ahead = heightAt(dv.obj.position.x + Math.sin(dv.heading) * 2, dv.obj.position.z + Math.cos(dv.heading) * 2);
    dv.obj.rotation.x = -Math.atan2(Math.max(0, ahead) - h, 2) * 0.8;
    // камерата е зад колата
    if (Math.abs(dv.speed) > 2) {
      let target = dv.heading + Math.PI;
      let da = target - this.rig.goal.yaw;
      while (da > Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      this.rig.goal.yaw += da * Math.min(1, dt * 1.5);
    }
    this.engineT -= dt;
    if (this.engineT <= 0 && Math.abs(dv.speed) > 1) this.engineT = 0.5;
    void roadZAt;
  }

  speedKmh() {
    return Math.round(Math.abs(this.drive?.speed ?? 0) * 3.6 / 0.55);
  }
}
