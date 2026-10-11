import { ITEMS } from './data';
import { S, save, now, count, takeAll, addCoins, addXP, addDiamonds, addItem, emit, VISIT } from './state';
import { makeable } from './orders';

// Товарният влак (като кораба в Hay Day): идва на товарната гара до фермата с 3 вагона по 3 сандъка.
// Всеки напълнен сандък се плаща веднага; ако напълниш всичките 9 — голяма награда.

export const CARGO_LEVEL = 7;
export const CARGO_STAY = 5 * 3600 * 1000; // колко стои на гарата
export const CARGO_RETURN = 80 * 60 * 1000; // след колко се връща

export interface Crate { item: string; qty: number; coins: number; xp: number; done?: boolean }
export interface CargoState {
  st: 'away' | 'here';
  t: number; // кога идва (away) или кога тръгва (here)
  crates: Crate[];
  bonus: { coins: number; xp: number; loot: Record<string, number>; dia: number };
  n: number; // колко влака са обслужени
}

const LOOT = ['bolt', 'plank', 'tape', 'nail', 'screw', 'panel', 'axe', 'saw', 'dynamite', 'shovel'];

export function cargoUnlocked() {
  return S.level >= CARGO_LEVEL;
}

export function cargo(): CargoState | null {
  if (!cargoUnlocked() || VISIT) return null;
  if (!S.cargo) S.cargo = { st: 'away', t: now() + 20 * 1000, crates: [], bonus: { coins: 0, xp: 0, loot: {}, dia: 0 }, n: 0 };
  return S.cargo;
}

function pickItems(): string[] {
  const pool = makeable().filter((id) => ITEMS[id].price >= 8 || S.level < 10);
  const by = (k: string[]) => pool.filter((id) => k.includes(ITEMS[id].kind));
  const groups = [by(['crop', 'fruit']), by(['animal']), by(['food']), pool];
  const out: string[] = [];
  for (const g of groups) {
    const left = g.filter((id) => !out.includes(id));
    if (!left.length) continue;
    // по-нови стоки — малко по-често
    left.sort((a, b) => ITEMS[b].level - ITEMS[a].level);
    const id = left[Math.floor(Math.pow(Math.random(), 1.6) * left.length)];
    out.push(id);
    if (out.length === 3) break;
  }
  while (out.length < 3) out.push(pool[(Math.random() * pool.length) | 0] ?? 'wheat');
  return out;
}

/** Нов влак: 3 вагона × 3 еднакви сандъка. */
function newTrain(c: CargoState) {
  const items = pickItems();
  const target = 45 + S.level * 14;
  c.crates = [];
  let sum = 0, sxp = 0;
  for (const id of items) {
    const it = ITEMS[id];
    const qty = Math.max(1, Math.min(14, Math.round(target / it.price)));
    const v = it.price * qty;
    const coins = Math.round(v * 1.25 + 10 + S.level);
    const xp = Math.max(2, Math.round(it.xp * qty * 1.3));
    for (let k = 0; k < 3; k++) c.crates.push({ item: id, qty, coins, xp });
    sum += coins * 3;
    sxp += xp * 3;
  }
  const loot: Record<string, number> = {};
  for (let i = 0; i < 2 + (Math.random() < 0.5 ? 1 : 0); i++) {
    const id = LOOT[(Math.random() * LOOT.length) | 0];
    loot[id] = (loot[id] ?? 0) + 1;
  }
  c.bonus = { coins: Math.round(sum * 0.5), xp: Math.round(sxp * 0.5), loot, dia: Math.random() < 0.35 ? 3 : 0 };
}

export type CargoEvent = 'arrive' | 'leave' | 'fill' | 'complete';
const listeners: ((e: CargoEvent) => void)[] = [];
export const onCargo = (f: (e: CargoEvent) => void) => listeners.push(f);
const fire = (e: CargoEvent) => listeners.forEach((f) => f(e));

/** Вика се редовно: пристигане и тръгване по часовник. */
export function tickCargo() {
  const c = cargo();
  if (!c) return;
  const t = now();
  if (c.st === 'away' && t >= c.t) {
    newTrain(c);
    c.st = 'here';
    c.t = t + CARGO_STAY;
    save();
    fire('arrive');
  } else if (c.st === 'here' && t >= c.t) {
    c.st = 'away';
    c.t = t + CARGO_RETURN;
    c.crates = [];
    save();
    fire('leave');
  }
}

export function canFill(cr: Crate) {
  return !cr.done && count(cr.item) >= cr.qty;
}

/** Пълни сандък; връща наградата. Ако всички са пълни — влакът тръгва с голямата награда. */
export function fillCrate(i: number) {
  const c = cargo();
  if (!c || c.st !== 'here') return null;
  const cr = c.crates[i];
  if (!cr || cr.done || !takeAll({ [cr.item]: cr.qty })) return null;
  cr.done = true;
  addCoins(cr.coins);
  addXP(cr.xp);
  save();
  fire('fill');
  if (c.crates.every((x) => x.done)) complete(c);
  return { coins: cr.coins, xp: cr.xp };
}

function complete(c: CargoState) {
  const b = c.bonus;
  addCoins(b.coins);
  addXP(b.xp);
  for (const [k, n] of Object.entries(b.loot)) addItem(k, n, true);
  if (b.dia) addDiamonds(b.dia);
  S.stats.trains = (S.stats.trains ?? 0) + 1;
  c.n++;
  c.st = 'away';
  c.t = now() + CARGO_RETURN;
  save();
  fire('complete');
  emit('inv');
}

/** Повикай влака веднага (за диаманти). */
export function callNow() {
  const c = cargo();
  if (!c || c.st !== 'away') return;
  c.t = now();
  tickCargo();
}

export function filledCount() {
  return S.cargo?.crates.filter((x) => x.done).length ?? 0;
}
