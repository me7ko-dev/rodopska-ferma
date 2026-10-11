import * as THREE from 'three';
import { ITEMS } from './data';
import { S, addItem, save } from './state';
import { flyTo, popText, sparkle } from './fx';
import { sfx } from '../audio/sfx';

// Находки: при жътва, събиране от животни и работилници понякога се намира материал или инструмент (като в Hay Day).

const TABLE: [string, number][] = [
  ['bolt', 9], ['plank', 9], ['tape', 9],
  ['nail', 9], ['screw', 9], ['panel', 9],
  ['axe', 13], ['shovel', 11], ['saw', 9], ['dynamite', 5], ['pickaxe', 6],
];
const CHANCE = { field: 0.055, tree: 0.09, animal: 0.07, prod: 0.065, order: 0.3, clear: 0.3 } as const;
export type DropSource = keyof typeof CHANCE;

function pick() {
  const list = TABLE.filter(([id]) => ITEMS[id].level <= S.level);
  const tot = list.reduce((a, [, w]) => a + w, 0);
  let r = Math.random() * tot;
  for (const [id, w] of list) if ((r -= w) <= 0) return id;
  return list[0][0];
}

/** Може би намираме нещо. Връща id на находката (или null). */
export function rollDrop(source: DropSource, at: THREE.Vector3 | { x: number; y: number }, mult = 1): string | null {
  if (S.level < 2) return null;
  // „късмет“: всеки празен опит леко вдига шанса, така че находка идва поне на ~25 опита
  const luck = S.luck ?? 0;
  const p = CHANCE[source] * mult + luck * 0.004;
  if (Math.random() > p) {
    S.luck = luck + 1;
    return null;
  }
  S.luck = 0;
  const id = pick();
  giveFound(id, 1, at);
  return id;
}

/** Дава находка с ефект (иконка лети към склада и надпис). */
export function giveFound(id: string, n: number, at: THREE.Vector3 | { x: number; y: number }) {
  addItem(id, n, true);
  S.stats.found = (S.stats.found ?? 0) + n;
  flyTo(id, at, '#hud-barn', Math.min(n, 4), 200);
  popText(`Намери: ${ITEMS[id].name}${n > 1 ? ' ×' + n : ''}!`, at, '#ffe066', true);
  if ('isVector3' in at) sparkle((at as THREE.Vector3).clone(), 12, 0);
  sfx('find');
  save();
}
