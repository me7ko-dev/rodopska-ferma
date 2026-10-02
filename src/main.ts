import * as THREE from 'three';
import '@fontsource/rubik/400.css';
import '@fontsource/rubik/600.css';
import '@fontsource/rubik/800.css';
import './ui/style.css';
import './ui/game.css';
import { Engine } from './engine/engine';
import { CameraRig } from './engine/camera';
import { loadAll, instance } from './engine/assets';
import { windTime } from './engine/wind';
import { buildSky } from './world/sky';
import { buildTerrain, buildFarmGround, buildRoad, farmPaths } from './world/terrain';
import { buildPond } from './world/water';
import { buildNature } from './world/nature';
import { POND, FARM, DRIVE } from './world/layout';
import { fence } from './game/props';
import { S, save, now, addXP, addCoins } from './game/state';
import { BUILDINGS, HOME_TIERS, VILLAGE_HOUSES, ANIMALS, CARS } from './game/data';
import { Farm } from './game/world';
import { Village } from './game/village';
import { Vehicles } from './game/vehicles';
import { People } from './game/npc';
import { refillOrders } from './game/orders';
import { initFx, setFxScene, updateMarkers, updateBounces, updateSparks } from './game/fx';
import { bindUI, bindDayNight } from './ui/ui';
import { icon } from './ui/icons';
import { Ambient } from './world/ambient';
import { DayNight } from './world/daynight';
import { rainSound } from './audio/sfx';
import { UI } from './ui/api';

// Всички модели, които трябват веднага (останалите се зареждат при нужда).
const PRELOAD = [
  'n_pine4', 'n_pine2', 'n_pine3', 'n_tree1', 'n_tree5', 'tree_b', 'tree_d',
  'n_grass', 'n_grass_wispy2', 'n_grass_tall',
  'n_flower_group1', 'n_flower_group2', 'n_flower_single', 'n_petal_pink', 'n_petal_white', 'n_petal_purple', 'n_petal_yellow', 'n_petal_red',
  'n_bush_flowers', 'n_fern', 'n_plant_big1', 'n_plant1', 'n_plant2', 'n_plant_big2', 'n_clover1', 'n_rock1', 'n_rock2', 'n_rock3',
  'lilypad', 'mallard', 'duck', 'm_farmer', 'hen', 'chicken', 'bee',
  'man1', 'man2', 'woman1', 'woman_dress', 'woman_casual', 'man_sleeves', 'woman_tank', 'm_worker', 'w_worker',
  'car_sedan1', 'car_sedan2', 'car_taxi', 'car_suv', 'car_hatch', 'car_pickup', 'car_truck', 'car_sport1',
  'house_cottage', 'house_wood', 'barn_red', 'silo_house', 'windmill', 'coop', 'bench1', 'mailbox2', 'hay', 'barrel', 'well', 'market2', 'barn_open', 'sign',
];

const TIPS = [
  'Плъзни пръст по нивите, за да засееш много наведнъж.',
  'Смилянският фасул расте бавно, но се продава скъпо.',
  'Купи пикап — поръчките носят повече монети.',
  'Нахрани кокошките, за да снесат яйца.',
  'Къщите в селото носят наем всеки час.',
  'С трактора културите растат по-бързо.',
];

/** Нова игра: къща, хамбар, силоз, мелница, табло, 6 ниви, кокошарник и малко украса. */
function newFarm(farm: Farm) {
  farm.add('house', 0, -15);
  farm.add('silo', -6, -13);
  farm.add('barn', -15, -14);
  farm.add('feedmill', 10, -14);
  farm.add('board', 9, 8);
  for (const x of [-4, -1, 2]) for (const z of [-3, 0]) farm.add('field', x, z);
  // първите две ниви вече са засети и почти готови
  const fields = farm.fields();
  const t = now();
  [fields[0], fields[1]].forEach((f) => {
    f.e.crop = 'wheat';
    f.e.planted = t - 55000;
    f.e.ready = t + 5000;
    f.setVisual?.();
  });
  farm.add('coop', -16, -3, 0, { animals: [{ fed: null, ready: null }, { fed: null, ready: null }, { fed: null, ready: null }] });
  farm.add('d_bench', 9, -5);
  farm.add('d_flowers1', -2, -7);
  farm.add('d_flowers1', 8, -7);
  farm.add('d_mailbox', 9, 23);
  farm.add('d_hay', -13, -6);
  farm.add('d_hay', -9, -6);
  farm.add('d_barrel', -11, -6);
  farm.add('d_pine', 19, -15);
  farm.add('d_pine', -21, 12);
  farm.add('d_pine', 20, 16);
  farm.add('d_bush', 14, 10);
  farm.add('d_bush', -10, 12);
  farm.add('d_well', 11, 0);
  S.inv = { wheat: 4, corn: 2, feed_chicken: 3 };
  save(true);
}

async function boot() {
  const fill = document.getElementById('load-fill')!;
  document.getElementById('load-tip')!.textContent = TIPS[(Math.random() * TIPS.length) | 0];
  const canvas = document.getElementById('game') as HTMLCanvasElement;
  const engine = new Engine(canvas);
  const rig = new CameraRig(engine.camera, canvas);
  const sky = buildSky(engine.scene);
  const scene = engine.scene;

  // модели на сградите, които има на фермата
  const need = new Set(PRELOAD);
  for (const e of S.entities) {
    const def = BUILDINGS[e.type];
    if (def?.model) need.add(def.model);
  }
  need.add(HOME_TIERS[S.home].model);
  for (const h of VILLAGE_HOUSES) need.add(h.model);
  for (const a of Object.values(ANIMALS)) if (a.model) need.add(a.model);
  await loadAll([...need], (d, t) => (fill.style.width = `${Math.round((d / t) * 100)}%`));

  scene.add(buildTerrain());
  scene.add(buildFarmGround(farmPaths()));
  scene.add(buildRoad());
  scene.add(buildPond(POND.x, POND.z, POND.rx, POND.rz));
  scene.add(buildNature(engine.quality));

  // живот в езерото: водни лилии и патици
  const pondLife = new THREE.Group();
  for (let i = 0; i < 7; i++) {
    const l = instance('lilypad', 1.1 + Math.random() * 0.6);
    const a = Math.random() * 6.28, r = 0.3 + Math.random() * 0.55;
    l.position.set(POND.x + Math.cos(a) * POND.rx * r, 0.18, POND.z + Math.sin(a) * POND.rz * r);
    l.rotation.y = Math.random() * 6;
    pondLife.add(l);
  }
  const ducks: { o: THREE.Group; a: number; r: number; s: number }[] = [];
  for (let i = 0; i < 4; i++) {
    const o = instance(i === 0 ? 'mallard' : 'duck', i === 0 ? 1.0 : 0.8);
    pondLife.add(o);
    ducks.push({ o, a: Math.random() * 6.28, r: 0.35 + Math.random() * 0.4, s: (0.15 + Math.random() * 0.1) * (i % 2 ? 1 : -1) });
  }
  scene.add(pondLife);

  initFx(engine.camera);
  setFxScene(scene);

  const farm = new Farm(scene, engine.camera, rig);
  rig.input = farm;
  if (!S.entities.length) newFarm(farm);
  else farm.load();
  farm.buildLands();
  refillOrders();
  // дървена ограда около цялата ферма, с вход откъм пътя
  const fw = FARM.maxX - FARM.minX + 1.6, fd = FARM.maxZ - FARM.minZ + 1.6;
  const farmFence = fence(fw, fd, '#a0703f', DRIVE.w + 1.5, DRIVE.x - (FARM.minX + FARM.maxX) / 2);
  farmFence.position.set((FARM.minX + FARM.maxX) / 2, 0, (FARM.minZ + FARM.maxZ) / 2);
  scene.add(farmFence);

  const village = new Village(scene, farm.extraPick);
  const vehicles = new Vehicles(scene, farm, rig);
  const people = new People(scene, farm);
  bindUI({ farm, village, vehicles, people, engine });
  const ambient = new Ambient(scene, farm, engine);
  const daynight = new DayNight(engine, sky, scene);
  bindDayNight(daynight);
  // топла светлина от прозорците на къщата нощем
  const hv = farm.byType('house')[0];
  if (hv) {
    const glow = new THREE.Sprite(daynight.glowMat);
    glow.position.set(0, 1.8, hv.def.foot[1] / 2 - 1.2);
    glow.scale.setScalar(6);
    hv.root.add(glow);
  }
  ambient.onRain = (on) => {
    rainSound(on);
    UI.toast(on ? '🌧 Вали дъжд — културите растат два пъти по-бързо!' : '☀️ Дъждът спря', on ? 'ok' : 'info');
  };

  // камера над фермата
  const dist = innerWidth < innerHeight ? 50 : 38;
  rig.flyTo(0, -1, dist);
  rig.target.set(0, 0, -1);
  rig.distance = dist;
  rig.update(1);

  let t0 = performance.now();
  engine.onUpdate((dt) => {
    windTime.value += dt;
    rig.update(dt);
    sky.update(dt);
    farm.update(engine.time.value, dt);
    village.update(dt);
    vehicles.update(dt);
    people.update(dt);
    ambient.update(dt, engine.time.value);
    daynight.update(dt, engine.time.value, ambient.rainAmt);
    for (const d of ducks) {
      d.a += d.s * dt;
      d.o.position.set(POND.x + Math.cos(d.a) * POND.rx * d.r, 0.14 + Math.sin(engine.time.value * 2 + d.r * 9) * 0.02, POND.z + Math.sin(d.a) * POND.rz * d.r);
      d.o.rotation.y = -d.a + (d.s > 0 ? 0 : Math.PI);
    }
    updateBounces(dt);
    updateSparks(dt);
    updateMarkers();
    engine.followShadow(rig.target, Math.min(90, rig.distance * 0.95));
    // поръчките се попълват от само себе си
    if (performance.now() - t0 > 5000) { t0 = performance.now(); refillOrders(); }
  });
  engine.start();
  // останалите модели (сгради за купуване, коли, къщи) — тихо във фонов режим
  setTimeout(() => {
    const rest = new Set<string>();
    for (const b of Object.values(BUILDINGS)) if (b.model) rest.add(b.model);
    for (const c of CARS) rest.add(c.model);
    for (const h of HOME_TIERS) rest.add(h.model);
    loadAll([...rest]);
  }, 3000);
  (window as any).__rf = { engine, rig, farm, village, vehicles, people, ambient, daynight, S, THREE, icon, addXP, addCoins, ready: true };
  const ld = document.getElementById('loading')!;
  ld.classList.add('hide');
  setTimeout(() => ld.remove(), 700);
}

// офлайн режим (само в публикуваната версия)
if (import.meta.env.PROD && 'serviceWorker' in navigator && location.protocol === 'https:') {
  addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}

boot().catch((e) => {
  console.error(e);
  const el = document.querySelector('.load-sub');
  if (el) el.textContent = 'Грешка: ' + e.message;
});
