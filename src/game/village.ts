import * as THREE from 'three';
import { VILLAGE_HOUSES } from './data';
import { QUALITY } from '../engine/engine';
import { S, save, spend, addCoins, addXP, now } from './state';
import { VILLAGE_PLOTS, ROAD_Z, ROAD_W, roadZAt, heightAt } from '../world/layout';
import { instance, animationsOf } from '../engine/assets';
import { saleSign, fence } from './props';
import { marker, removeMarker, flyTo, sparkle, bounce, type Marker } from './fx';
import { icon } from '../ui/icons';
import { UI } from '../ui/api';
import { sfx } from '../audio/sfx';

const proxyMat = new THREE.MeshBasicMaterial({ visible: false });
export const RENT_CAP_H = 12; // наемът се трупа най-много 12 часа

/** Колко монети наем са се натрупали за къща (максимум 12 часа). */
export function rentDue(plot: number) {
  const v = S.village[plot];
  if (!v) return 0;
  const h = VILLAGE_HOUSES[plot];
  const hours = Math.min(RENT_CAP_H, (now() - v.last) / 3600000);
  return Math.floor(h.rent * hours);
}

export class Village {
  group = new THREE.Group();
  plots: { g: THREE.Group; proxy: THREE.Mesh; mk: Marker | null; owned: boolean }[] = [];
  cars: { obj: THREE.Group; x: number; dir: number; speed: number; lane: number }[] = [];
  walkers: { obj: THREE.Group; mixer: THREE.AnimationMixer; x: number; z: number; dir: number; speed: number }[] = [];

  constructor(public scene: THREE.Scene, public picks: { obj: THREE.Object3D; tap: () => void }[]) {
    this.group.name = 'village';
    scene.add(this.group);
    this.build();
    this.spawnTraffic();
  }

  build() {
    for (const p of this.plots) {
      this.group.remove(p.g);
      removeMarker(p.mk);
      const i = this.picks.findIndex((x) => x.obj === p.proxy);
      if (i >= 0) this.picks.splice(i, 1);
    }
    this.plots = [];
    VILLAGE_PLOTS.forEach((pl, i) => {
      const h = VILLAGE_HOUSES[i];
      const g = new THREE.Group();
      g.position.set(pl.x, 0, pl.z);
      const owned = !!S.village[i];
      const house = instance(h.model, h.size);
      house.rotation.y = pl.rot;
      if (QUALITY.value === 'low') house.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = false; });
      g.add(house);
      if (!owned) {
        // къща за продан: малко посивяла + табела
        house.traverse((o) => {
          const m = o as THREE.Mesh;
          if (!m.isMesh) return;
          const grey = (mt: THREE.Material) => {
            const c = (mt as THREE.MeshStandardMaterial).clone();
            c.color.lerp(new THREE.Color('#b8b0a0'), 0.45);
            return c;
          };
          m.material = Array.isArray(m.material) ? m.material.map(grey) : grey(m.material);
        });
        const locked = S.level < h.level;
        const sign = saleSign(locked ? `Ниво ${h.level}` : 'Продава се', `${h.price.toLocaleString('bg-BG')} 🪙`);
        sign.position.set(4.5, 0, pl.rot ? -5.5 : 5.5);
        sign.rotation.y = pl.rot ? Math.PI : 0;
        g.add(sign);
      } else {
        const f = fence(13, 12, '#f6f1e6', 2.6);
        f.rotation.y = pl.rot;
        g.add(f);
      }
      const proxy = new THREE.Mesh(new THREE.BoxGeometry(11, 6, 11), proxyMat);
      proxy.position.y = 3;
      g.add(proxy);
      this.picks.push({ obj: proxy, tap: () => { bounce(house); UI.openVillageHouse(i); } });
      let mk: Marker | null = null;
      if (owned) {
        mk = marker(new THREE.Vector3(pl.x, (house.userData.size as THREE.Vector3).y + 1.2, pl.z), `<img src="${icon('coin')}">`, 'mk bubble small');
        mk.onClick = () => this.collect(i);
      }
      this.group.add(g);
      this.plots.push({ g, proxy, mk, owned });
    });
  }

  buy(i: number) {
    const h = VILLAGE_HOUSES[i];
    if (S.level < h.level) { UI.toast(`Трябва ниво ${h.level}`, 'warn'); return false; }
    if (!spend(h.price)) { UI.toast('Нямаш достатъчно монети', 'warn'); sfx('error'); return false; }
    S.village[i] = { bought: now(), last: now() };
    addXP(Math.round(h.price / 30));
    save();
    this.build();
    sparkle(new THREE.Vector3(VILLAGE_PLOTS[i].x, 3, VILLAGE_PLOTS[i].z), 40);
    sfx('build');
    return true;
  }

  collect(i: number) {
    const due = rentDue(i);
    if (due <= 0) return 0;
    S.village[i].last = now();
    addCoins(due);
    flyTo('coin', new THREE.Vector3(VILLAGE_PLOTS[i].x, 5, VILLAGE_PLOTS[i].z), '#hud-coins', Math.min(6, 1 + Math.floor(due / 50)));
    sfx('coin');
    save();
    return due;
  }

  spawnTraffic() {
    const models = ['car_sedan1', 'car_sedan2', 'car_taxi', 'car_suv', 'car_hatch', 'car_pickup', 'car_truck', 'car_sport1'];
    for (let i = 0; i < 7; i++) {
      const name = models[i % models.length];
      const sz = name === 'car_truck' ? 6.8 : name === 'car_pickup' ? 5.4 : 4.6;
      const obj = instance(name, sz);
      const dir = i % 2 ? 1 : -1;
      this.cars.push({ obj, x: -500 + Math.random() * 1000, dir, speed: 9 + Math.random() * 6, lane: dir * 1.7 });
      this.group.add(obj);
    }
    // хора, които се разхождат по пътя в селото
    const people = ['man1', 'man2', 'woman1', 'woman_dress', 'woman_casual', 'man_sleeves'];
    for (let i = 0; i < 6; i++) {
      const name = people[i];
      const obj = instance(name, 2.0, 'y');
      const mixer = new THREE.AnimationMixer(obj);
      const clip = animationsOf(name).find((c) => /Walk$/.test(c.name));
      if (clip) mixer.clipAction(clip).play();
      mixer.update(Math.random() * 2);
      const dir = i % 2 ? 1 : -1;
      this.walkers.push({ obj, mixer, x: 30 + Math.random() * 150, z: ROAD_Z + dir * (ROAD_W / 2 + 0.9), dir, speed: 1.2 + Math.random() * 0.4 });
      this.group.add(obj);
    }
  }

  update(dt: number) {
    for (const c of this.cars) {
      c.x += c.dir * c.speed * dt;
      if (c.x > 760) c.x = -680;
      if (c.x < -680) c.x = 760;
      const z = roadZAt(c.x) + c.lane;
      const z2 = roadZAt(c.x + c.dir * 2) + c.lane;
      const y = Math.max(heightAt(c.x, z), 0) + 0.06;
      c.obj.position.set(c.x, y, z);
      c.obj.rotation.y = Math.atan2(c.dir * 2, z2 - z);
    }
    for (const w of this.walkers) {
      w.mixer.update(dt);
      w.x += w.dir * w.speed * dt;
      if (w.x > 185) { w.dir = -1; }
      if (w.x < 20) { w.dir = 1; }
      w.obj.position.set(w.x, 0, w.z);
      w.obj.rotation.y = w.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    }
    this.plots.forEach((p, i) => {
      if (p.mk) p.mk.visible = rentDue(i) >= Math.max(5, VILLAGE_HOUSES[i].rent * 0.25);
    });
  }
}
