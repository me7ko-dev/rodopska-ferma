import { ITEMS, xpForLevel, START_LAND } from './data';

export interface QueueItem { out: string; qty: number; start: number; end: number }
export interface AnimalState { fed: number | null; ready: number | null } // fed = кога е нахранено; ready = кога продуктът е готов
export interface Entity {
  uid: number;
  type: string;
  x: number; // долен ляв ъгъл на заеманите клетки
  z: number;
  rot: number; // 0..3 (по 90°)
  crop?: string;
  planted?: number;
  ready?: number;
  queue?: QueueItem[];
  done?: { out: string; qty: number }[];
  animals?: AnimalState[];
}

export interface Order {
  id: number;
  items: Record<string, number>;
  coins: number;
  xp: number;
  who: string;
  wait?: number; // ако е изтрита — кога идва нова
}

export interface Save {
  v: 1;
  name: string;
  coins: number;
  diamonds: number;
  xp: number;
  level: number;
  inv: Record<string, number>;
  entities: Entity[];
  nextUid: number;
  lands: string[];
  home: number;
  cars: string[];
  village: Record<number, { bought: number; last: number }>;
  orders: Order[];
  nextOrder: number;
  barnCap: number;
  siloCap: number;
  lastDaily: number;
  tut: number;
  sound: boolean;
  music: boolean;
  stats: { harvested: number; produced: number; orders: number; earned: number; visitors: number };
  ach: Record<string, number>;
  created: number;
  last: number;
}

type Listener = (what: string) => void;
const listeners: Listener[] = [];
export const on = (f: Listener) => listeners.push(f);
export const emit = (what: string) => listeners.forEach((f) => f(what));

const KEY = 'rf-save-v1';

export function now() {
  return Date.now();
}

export function freshSave(): Save {
  const t = now();
  return {
    v: 1,
    name: 'Моята ферма',
    coins: 250,
    diamonds: 15,
    xp: 0,
    level: 1,
    inv: { wheat: 6, corn: 4, feed_chicken: 3 },
    entities: [],
    nextUid: 1,
    lands: [],
    home: 0,
    cars: [],
    village: {},
    orders: [],
    nextOrder: 1,
    barnCap: 50,
    siloCap: 50,
    lastDaily: 0,
    tut: 0,
    sound: true,
    music: true,
    stats: { harvested: 0, produced: 0, orders: 0, earned: 0, visitors: 0 },
    ach: {},
    created: t,
    last: t,
  };
}

export let S: Save = load();

function load(): Save {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw) as Save;
      if (s && s.v === 1) return { ...freshSave(), ...s };
    }
  } catch (e) {
    console.warn('save', e);
  }
  return freshSave();
}

let saveTimer = 0;
export function save(immediate = false) {
  S.last = now();
  const write = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(S));
    } catch (e) {
      console.warn('save', e);
    }
  };
  if (immediate) return write();
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(write, 400);
}
addEventListener('beforeunload', () => save(true));
document.addEventListener('visibilitychange', () => document.hidden && save(true));

export function resetSave() {
  localStorage.removeItem(KEY);
  S = freshSave();
}

// ---------- склад ----------
export const isSiloItem = (id: string) => ITEMS[id]?.kind === 'crop' || ITEMS[id]?.kind === 'fruit';
export function used(silo: boolean) {
  let n = 0;
  for (const [k, v] of Object.entries(S.inv)) if (isSiloItem(k) === silo) n += v;
  return n;
}
export function cap(silo: boolean) {
  return silo ? S.siloCap : S.barnCap;
}
export function spaceFor(id: string) {
  const silo = isSiloItem(id);
  return cap(silo) - used(silo);
}
export const count = (id: string) => S.inv[id] || 0;

/** Добавя стока; връща колко реално са влезли (ако складът е пълен — по-малко). */
export function addItem(id: string, n: number, force = false) {
  const room = force ? n : Math.max(0, Math.min(n, spaceFor(id)));
  if (room > 0) {
    S.inv[id] = count(id) + room;
    emit('inv');
    save();
  }
  return room;
}

export function hasAll(needs: Record<string, number>) {
  return Object.entries(needs).every(([k, v]) => count(k) >= v);
}

export function takeAll(needs: Record<string, number>) {
  if (!hasAll(needs)) return false;
  for (const [k, v] of Object.entries(needs)) {
    S.inv[k] = count(k) - v;
    if (S.inv[k] <= 0) delete S.inv[k];
  }
  emit('inv');
  save();
  return true;
}

// ---------- пари и опит ----------
export function addCoins(n: number) {
  S.coins += n;
  if (n > 0) S.stats.earned += n;
  emit('coins');
  save();
}
export function spend(n: number) {
  if (S.coins < n) return false;
  S.coins -= n;
  emit('coins');
  save();
  return true;
}
export function spendDiamonds(n: number) {
  if (S.diamonds < n) return false;
  S.diamonds -= n;
  emit('diamonds');
  save();
  return true;
}
export function addDiamonds(n: number) {
  S.diamonds += n;
  emit('diamonds');
  save();
}

export function addXP(n: number) {
  S.xp += n;
  let up = false;
  while (S.xp >= xpForLevel(S.level)) {
    S.xp -= xpForLevel(S.level);
    S.level++;
    up = true;
    emit('levelup');
  }
  emit('xp');
  save();
  return up;
}

// ---------- земя ----------
export function landRects(): [number, number, number, number][] {
  return [START_LAND, ...S.lands.map((id) => LAND_RECT[id]).filter(Boolean)];
}
export const LAND_RECT: Record<string, [number, number, number, number]> = {};

/** Колко диаманта струва да се свърши веднага нещо, което иска още `sec` секунди. */
export function skipCost(sec: number) {
  if (sec <= 0) return 0;
  return Math.max(1, Math.ceil(Math.sqrt(sec / 60) * 1.3));
}

// ---------- постижения ----------
import { ACHIEVEMENTS } from './data';
export function achValue(id: string) {
  switch (id) {
    case 'houses': return Object.keys(S.village).length;
    case 'cars': return S.cars.length;
    case 'level': return S.level;
    default: return (S.stats as Record<string, number>)[id] ?? 0;
  }
}
/** Колко постижения чакат да се вземат наградите им. */
export function achReady() {
  let n = 0;
  for (const a of ACHIEVEMENTS) {
    const got = S.ach[a.id] ?? 0;
    if (got < a.tiers.length && achValue(a.id) >= a.tiers[got]) n++;
  }
  return n;
}
