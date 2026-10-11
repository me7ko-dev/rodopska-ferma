import { ITEMS, CROPS, BUILDINGS, ANIMALS, FISH_LEVEL, MINE_LEVEL } from './data';
import { S, save, now, addCoins, addXP, addDiamonds, addItem } from './state';
import { CARGO_LEVEL } from './cargo';

// Задачи: всичко, което играчът прави, минава през track(). От това живеят задачите за деня и седмичният събор.

export type Ev = 'harvest' | 'produce' | 'collect' | 'order' | 'crate' | 'fish' | 'mine' | 'clear' | 'visitor' | 'sell' | 'feed' | 'plant';

export interface Task { ev: Ev; id?: string; n: number; got: number; text: string; icon: string; coins: number; xp: number; done?: boolean; pts?: number; until?: number }

const listeners: (() => void)[] = [];
export const onTasks = (f: () => void) => listeners.push(f);

/** Отбелязва действие на играча. */
export function track(ev: Ev, id = '', n = 1) {
  if (!S.daily && !S.fair) return;
  let changed = false;
  const bump = (t: Task) => {
    if (t.done || t.ev !== ev || (t.id && t.id !== id)) return;
    if (t.until && now() > t.until) return;
    t.got = Math.min(t.n, t.got + n);
    changed = true;
  };
  S.daily?.tasks.forEach(bump);
  S.fair?.active.forEach(bump);
  if (changed) { save(); listeners.forEach((f) => f()); }
}

// ---------------------------------------------------------------- помощни
const rnd = (seed: number) => () => ((seed = (seed * 16807 + 11) % 2147483647) / 2147483647);
const dayKey = (t = now()) => new Date(t).toDateString();
const owned = (type: string) => S.entities.some((e) => e.type === type);

/** Възможни задачи според нивото и сградите на играча. */
function taskPool(scale: number, r: () => number): Omit<Task, 'got'>[] {
  const lv = S.level;
  const out: Omit<Task, 'got'>[] = [];
  const crops = Object.values(CROPS).filter((c) => c.level <= lv);
  for (let k = 0; k < 3; k++) {
    const c = crops[Math.floor(r() * crops.length)];
    const n = Math.max(6, Math.round((24 / Math.sqrt(c.time / 60)) * scale) * 2);
    out.push({ ev: 'harvest', id: c.id, n, text: `Ожъни ${n} × ${ITEMS[c.id].name}`, icon: c.id, coins: 0, xp: 0 });
  }
  const prods: { out: string; time: number }[] = [];
  for (const e of S.entities) for (const rc of BUILDINGS[e.type]?.recipes ?? []) if (ITEMS[rc.out].level <= lv && ITEMS[rc.out].kind !== 'tool') prods.push({ out: rc.out, time: rc.time });
  for (let k = 0; k < 3 && prods.length; k++) {
    const p = prods[Math.floor(r() * prods.length)];
    const n = Math.max(1, Math.round((3 * scale) / Math.max(1, p.time / 1200)));
    out.push({ ev: 'produce', id: p.out, n, text: `Направи ${n} × ${ITEMS[p.out].name}`, icon: p.out, coins: 0, xp: 0 });
  }
  const pens = S.entities.filter((e) => BUILDINGS[e.type]?.kind === 'animal' && (e.animals?.length ?? 0) > 0);
  if (pens.length) {
    const a = ANIMALS[BUILDINGS[pens[Math.floor(r() * pens.length)].type].animal!];
    const n = Math.max(3, Math.round(6 * scale * (600 / Math.max(600, a.time)) * 2));
    out.push({ ev: 'collect', id: a.product, n, text: `Събери ${n} × ${ITEMS[a.product].name}`, icon: a.product, coins: 0, xp: 0 });
  }
  out.push({ ev: 'order', n: Math.max(2, Math.round(3 * scale)), text: '', icon: 'b:board', coins: 0, xp: 0 });
  out.push({ ev: 'visitor', n: Math.max(1, Math.round(2 * scale)), text: '', icon: 'coin', coins: 0, xp: 0 });
  out.push({ ev: 'clear', n: Math.max(1, Math.round(1 * scale)), text: '', icon: 'axe', coins: 0, xp: 0 });
  if (lv >= FISH_LEVEL) out.push({ ev: 'fish', n: Math.max(2, Math.round(3 * scale)), text: '', icon: 'f_carp', coins: 0, xp: 0 });
  if (lv >= MINE_LEVEL) out.push({ ev: 'mine', n: Math.max(3, Math.round(5 * scale)), text: '', icon: 'pickaxe', coins: 0, xp: 0 });
  if (lv >= CARGO_LEVEL) out.push({ ev: 'crate', n: Math.max(2, Math.round(3 * scale)), text: '', icon: 'b:board', coins: 0, xp: 0 });
  if (owned('market') || lv >= 3) out.push({ ev: 'sell', n: Math.max(4, Math.round(8 * scale)), text: '', icon: 'b:market', coins: 0, xp: 0 });
  const texts: Partial<Record<Ev, (n: number) => string>> = {
    order: (n) => `Изпълни ${n} поръчки`, visitor: (n) => `Обслужи ${n} посетители`, clear: (n) => `Разчисти ${n} препятствия`,
    fish: (n) => `Хвани ${n} риби`, mine: (n) => `Копай ${n} пъти в рудника`, crate: (n) => `Напълни ${n} сандъка на влака`, sell: (n) => `Продай ${n} стоки`,
  };
  for (const t of out) if (!t.text) t.text = texts[t.ev]!(t.n);
  return out;
}

function pickTasks(n: number, scale: number, seed: number) {
  const r = rnd(seed);
  const pool = taskPool(scale, r);
  const res: Task[] = [];
  const usedEv = new Set<string>();
  for (let k = 0; k < 60 && res.length < n; k++) {
    const t = pool[Math.floor(r() * pool.length)];
    const key = t.ev;
    if (usedEv.has(key) && (n <= 3 || r() < 0.8)) continue;
    if (res.some((x) => x.ev === t.ev && x.id === t.id)) continue;
    usedEv.add(key);
    res.push({ ...t, got: 0 });
  }
  return res;
}

// ---------------------------------------------------------------- задачи за деня
export interface DailyState { day: string; tasks: Task[]; chest: boolean; streak: number; lastDone?: string }

export function daily(): DailyState | null {
  if (S.level < 2) return null;
  const d = dayKey();
  if (!S.daily || S.daily.day !== d) {
    const prevDone = S.daily?.lastDone;
    const yesterday = dayKey(now() - 86400000);
    const tasks = pickTasks(3, 1 + S.level / 25, Math.floor(now() / 86400000) * 7 + S.level);
    const lv = S.level;
    for (const t of tasks) { t.coins = Math.round(30 + lv * 9); t.xp = Math.round(8 + lv * 2.2); }
    S.daily = { day: d, tasks, chest: false, streak: prevDone === yesterday ? S.daily?.streak ?? 0 : 0, lastDone: prevDone };
    save();
  }
  return S.daily;
}

export function claimTask(i: number) {
  const t = S.daily?.tasks[i];
  if (!t || t.done || t.got < t.n) return null;
  t.done = true;
  addCoins(t.coins);
  addXP(t.xp);
  save();
  return t;
}

/** Сандъчето за трите задачи: диаманти, материал и (по серия дни) още диаманти. */
export function claimChest() {
  const d = S.daily;
  if (!d || d.chest || !d.tasks.every((t) => t.done)) return null;
  d.chest = true;
  d.streak = (d.streak ?? 0) + 1;
  d.lastDone = d.day;
  const dia = 2 + Math.min(5, Math.floor(d.streak / 2));
  const mats = ['bolt', 'plank', 'tape', 'nail', 'screw', 'panel'];
  const m = mats[Math.floor(Math.random() * mats.length)];
  addDiamonds(dia);
  addItem(m, 2, true);
  save();
  return { dia, mat: m, streak: d.streak };
}

// ---------------------------------------------------------------- подарък за всеки ден (7 дни)
export const LOGIN_GIFTS: { coins?: number; dia?: number; items?: Record<string, number>; text: string; icon: string }[] = [
  { coins: 150, text: '150 монети', icon: 'coin' },
  { items: { axe: 2, shovel: 1 }, text: '2 брадви и лопата', icon: 'axe' },
  { dia: 3, text: '3 диаманта', icon: 'diamond' },
  { items: { bait: 10, pickaxe: 2 }, text: '10 стръв и 2 кирки', icon: 'bait' },
  { coins: 500, text: '500 монети', icon: 'coin' },
  { items: { bolt: 1, plank: 1, tape: 1, nail: 1, screw: 1, panel: 1 }, text: 'по 1 от всички материали', icon: 'plank' },
  { dia: 10, items: { dynamite: 2 }, text: '10 диаманта и 2 динамита', icon: 'diamond' },
];

export function loginState() {
  const L = (S.login ??= { day: '', n: 0 });
  return { can: L.day !== dayKey(), next: L.n % 7, total: L.n };
}

export function claimLogin() {
  const L = (S.login ??= { day: '', n: 0 });
  if (L.day === dayKey()) return null;
  const g = LOGIN_GIFTS[L.n % 7];
  L.day = dayKey();
  L.n++;
  if (g.coins) addCoins(g.coins);
  if (g.dia) addDiamonds(g.dia);
  for (const [k, n] of Object.entries(g.items ?? {})) addItem(k, n, true);
  save();
  return g;
}

// ---------------------------------------------------------------- Родопски събор (седмично състезание)
export const FAIR_LEVEL = 8;
export const FAIR_TASKS = 12; // колко задачи може да вземе за седмицата
export const FAIR_ACTIVE = 2; // колко наведнъж
const RIVALS = ['Ферма „Бяла река“', 'Чифлик „Смолянчанка“', 'Стопанство „Кестен“', 'Ферма „Орфей“', 'Двор „Момина вода“', 'Ферма „Карлък“', 'Чифлик „Перелик“'];
export const FAIR_MILESTONES: { pts: number; coins?: number; dia?: number; items?: Record<string, number> }[] = [
  { pts: 400, coins: 400 },
  { pts: 1000, items: { dynamite: 1, pickaxe: 3, bait: 10 } },
  { pts: 1800, dia: 8 },
  { pts: 2600, coins: 2000, items: { bolt: 2, plank: 2, tape: 2 } },
];
export const FAIR_PRIZES = [30, 20, 12, 6, 4, 3, 2, 2];

export interface FairState { week: string; offer: Task[]; active: Task[]; taken: number; pts: number; ms: number; seed: number; ended?: boolean; rank?: number }

/** Понеделник на текущата седмица (ключ). */
export function weekStart(t = now()) {
  const d = new Date(t);
  const day = (d.getDay() + 6) % 7;
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - day);
  return d.getTime();
}
const weekKey = (t = now()) => new Date(weekStart(t)).toDateString();

function fairOffer(f: FairState) {
  const lv = S.level;
  const tasks = pickTasks(6, 1.6 + lv / 15, f.seed + f.taken * 31);
  for (const t of tasks) {
    const big = t.n * (t.ev === 'produce' ? 4 : t.ev === 'harvest' ? 1 : 3);
    t.pts = Math.round(Math.min(320, 120 + big * 4) / 10) * 10;
    t.coins = 0;
    t.xp = Math.round(10 + lv * 1.5);
  }
  f.offer = tasks;
}

/** Седмицата: нова — нови задачи; стара — класиране и награди. */
export function fair(): FairState | null {
  if (S.level < FAIR_LEVEL) return null;
  const wk = weekKey();
  if (S.fair && S.fair.week !== wk && !S.fair.ended) {
    // предишната седмица свърши — изчисляваме мястото (наградата се взима с бутон)
    S.fair.rank = rankOf(S.fair, weekStart(new Date(S.fair.week).getTime()) + 7 * 86400000);
    S.fair.ended = true;
    save();
  }
  if (!S.fair || (S.fair.week !== wk && S.fair.ended && S.fair.rank === -1)) {
    const f: FairState = { week: wk, offer: [], active: [], taken: 0, pts: 0, ms: 0, seed: Math.floor(weekStart() / 86400000) * 13 + (S.owner ?? 7) };
    fairOffer(f);
    S.fair = f;
    save();
  }
  return S.fair;
}

/** Награда за миналата седмица (ако има). Връща диамантите. */
export function claimFairEnd() {
  const f = S.fair;
  if (!f?.ended || f.rank == null || f.rank < 0) return null;
  const dia = FAIR_PRIZES[f.rank] ?? 2;
  addDiamonds(dia);
  if (f.rank === 0) addItem('dynamite', 2, true);
  const rank = f.rank;
  f.rank = -1;
  save();
  fair();
  return { dia, rank };
}

export function takeFairTask(i: number) {
  const f = fair();
  if (!f || f.ended || f.active.length >= FAIR_ACTIVE || f.taken >= FAIR_TASKS) return null;
  const t = f.offer[i];
  if (!t) return null;
  const hours = 2 + Math.round((t.pts ?? 100) / 60);
  t.until = now() + hours * 3600 * 1000;
  f.active.push(t);
  f.taken++;
  fairOffer(f);
  save();
  return t;
}

export function finishFairTask(i: number) {
  const f = S.fair;
  const t = f?.active[i];
  if (!f || !t) return null;
  if (t.got >= t.n) {
    f.pts += t.pts ?? 0;
    addXP(t.xp);
  }
  f.active.splice(i, 1);
  save();
  return t;
}

/** Взима следващата награда по пътя (ако точките стигат). */
export function claimMilestone() {
  const f = S.fair;
  if (!f) return null;
  const m = FAIR_MILESTONES[f.ms];
  if (!m || f.pts < m.pts) return null;
  f.ms++;
  if (m.coins) addCoins(m.coins);
  if (m.dia) addDiamonds(m.dia);
  for (const [k, n] of Object.entries(m.items ?? {})) addItem(k, n, true);
  save();
  return m;
}

/** Съперниците: точките им растат през седмицата (всеки със свой ритъм). */
export function rivals(f: FairState, at = now()) {
  const start = weekStart(new Date(f.week).getTime());
  const k = Math.max(0, Math.min(1, (at - start) / (7 * 86400000)));
  const r = rnd(f.seed);
  const lvScale = 0.8 + Math.min(1.2, S.level / 30);
  return RIVALS.map((name) => {
    const goal = (700 + r() * 2300) * lvScale;
    const shape = 0.7 + r() * 0.8; // кой бърза в началото, кой — накрая
    const lazy = r() < 0.2 ? 0.45 : 1;
    return { name, pts: Math.round((goal * lazy * Math.pow(k, shape)) / 10) * 10 };
  });
}

export function rankOf(f: FairState, at = now()) {
  const list = rivals(f, at);
  return list.filter((x) => x.pts > f.pts).length;
}
