import * as THREE from 'three';
import { BUILDINGS, OBSTACLE_REWARD } from './data';
import { S, save, now, addCoins, addXP, addDiamonds, landRects, VISIT } from './state';
import { flyTo, popText } from './fx';
import { rollDrop } from './loot';
import { track } from './tasks';
import { FARM } from '../world/layout';
import type { Farm, View, ObstacleView } from './world';

// Препятствия: растат сами из фермата (както в Hay Day) и дават награди, когато ги разчистиш.

const SMALL = ['o_bush', 'o_bush', 'o_dead', 'o_rock', 'o_rock', 'o_stump'];
const BIG = ['o_tree', 'o_pine', 'o_boulder', 'o_stump', 'o_tree'];
const MAX = 9;
const EVERY = 2.5 * 3600 * 1000;

const pickOne = (a: string[]) => a[(Math.random() * a.length) | 0];

/** Поставя препятствие на случайно свободно място (с по 1 клетка разстояние от всичко). */
export function spawnObstacle(farm: Farm, type: string, rect?: [number, number, number, number]) {
  const def = BUILDINGS[type];
  const rects = rect ? [rect] : landRects();
  const [w, d] = def.foot;
  for (let k = 0; k < 80; k++) {
    const r = rects[(Math.random() * rects.length) | 0];
    const x = r[0] + 1 + Math.floor(Math.random() * Math.max(1, r[2] - r[0] - w - 1));
    const z = r[1] + 1 + Math.floor(Math.random() * Math.max(1, r[3] - r[1] - d - 1));
    if (!farm.canPlace(def, x, z, 0)) continue;
    let free = true;
    for (let i = x - 1; i <= x + w && free; i++)
      for (let j = z - 1; j <= z + d && free; j++) {
        if (i < FARM.minX || j < FARM.minZ || i >= FARM.maxX || j >= FARM.maxZ) continue;
        if (farm.grid[farm.idx(i, j)]) free = false;
      }
    if (!free) continue;
    farm.add(type, x, z, 0);
    return true;
  }
  return false;
}

export function obstacleCount(farm: Farm) {
  let n = 0;
  for (const v of farm.views.values()) if (v.def.kind === 'obstacle') n++;
  return n;
}

/** Вика се от време на време: първия път слага няколко, после по едно на ~2,5 часа. */
export function tickObstacles(farm: Farm) {
  if (VISIT) return;
  const t = now();
  if (S.obsT == null) {
    S.obsT = t;
    for (let i = 0; i < 6; i++) spawnObstacle(farm, i < 2 ? pickOne(BIG) : pickOne(SMALL));
    save();
    return;
  }
  if (t - S.obsT < EVERY) return;
  // ако играта е била затворена дълго, поникват няколко наведнъж (най-много 3)
  let n = Math.min(3, Math.floor((t - S.obsT) / EVERY));
  S.obsT = t;
  while (n-- > 0 && obstacleCount(farm) < MAX) spawnObstacle(farm, Math.random() < 0.2 ? pickOne(BIG) : pickOne(SMALL));
  save();
}

/** Нова земя идва обрасла: няколко дървета, храсти и камъни. */
export function landObstacles(farm: Farm, rect: [number, number, number, number]) {
  const n = 3 + ((Math.random() * 3) | 0);
  for (let i = 0; i < n; i++) spawnObstacle(farm, i < 2 ? pickOne(BIG) : pickOne(SMALL), rect);
}

/** Разчистване: анимация, после награди. */
export function clearObstacle(farm: Farm, v: View) {
  const ov = v as ObstacleView;
  const pos = v.root.position.clone().setY(1.5);
  farm.rig.flyTo(pos.x, pos.z);
  ov.startClear(() => {
    const [coins, xp] = OBSTACLE_REWARD[v.def.id] ?? [10, 3];
    const c = Math.round(coins * (0.8 + Math.random() * 0.5) + S.level);
    addCoins(c);
    addXP(xp);
    flyTo('coin', pos, '#hud-coins', 4);
    flyTo('star', pos, '#hud-xp', 2, 150);
    popText(`+${c}`, pos.clone().setY(2.5), '#ffe066', true);
    S.stats.cleared = (S.stats.cleared ?? 0) + 1;
    track('clear');
    if (Math.random() < (v.def.tool === 'dynamite' ? 0.45 : 0.14)) {
      const dia = v.def.tool === 'dynamite' ? 2 : 1;
      addDiamonds(dia);
      flyTo('diamond', pos, '#hud-diamonds', dia, 300);
    }
    rollDrop('clear', pos.clone().add(new THREE.Vector3(0, 0.5, 0)));
    farm.remove(v.e.uid);
    save();
  });
}
