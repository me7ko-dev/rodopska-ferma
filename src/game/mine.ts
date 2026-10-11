import { ITEMS, MINE_LEVEL, MINE_LOOT } from './data';
import { S, save, count, takeAll, addItem, addXP, spaceFor } from './state';
import { track } from './tasks';

// Рудникът „Мадан“: стена от скала 6×5. Кирката разбива една клетка (твърдата — с два удара), динамитът — кръст от 5.
// Всеки ден има 3 безплатни удара. Когато разкопаеш цялата стена, слизаш на по-дълбок етаж с по-ценни руди.

export const MINE_W = 6, MINE_H = 5;
export const FREE_HITS = 3;

const today = () => new Date().toDateString();

function roll(depth: number) {
  const list = MINE_LOOT.map((l) => ({ id: l.id, w: Math.max(l.id ? 0.5 : 22, l.w + l.dw * (depth - 1)) }));
  let r = Math.random() * list.reduce((a, b) => a + b.w, 0);
  for (const l of list) if ((r -= l.w) <= 0) return l.id;
  return '';
}

function newWall(depth: number) {
  const cells = [];
  for (let i = 0; i < MINE_W * MINE_H; i++) {
    const it = roll(depth);
    // ценното е в по-твърда скала
    const hard = it && ITEMS[it].price >= 60 ? Math.random() < 0.7 : Math.random() < 0.2;
    cells.push({ it, hp: hard ? 2 : 1 });
  }
  return cells;
}

export function mine() {
  if (S.level < MINE_LEVEL) return null;
  if (!S.mine) S.mine = { depth: 1, cells: newWall(1), free: FREE_HITS, day: today() };
  if (S.mine.day !== today()) { S.mine.day = today(); S.mine.free = FREE_HITS; }
  return S.mine;
}

export const wallDone = () => !!S.mine && S.mine.cells.every((c) => c.hp <= 0);

/** Удар с кирка (или безплатен) по клетка. Връща намереното (или '' / null, ако няма удар). */
export function hit(i: number, tool: 'pickaxe' | 'dynamite'): { found: string[]; broke: number[] } | null {
  const m = mine();
  if (!m) return null;
  const c = m.cells[i];
  if (!c || c.hp <= 0) return null;
  if (tool === 'pickaxe') {
    if (m.free > 0) m.free--;
    else if (!takeAll({ pickaxe: 1 })) return null;
  } else if (!takeAll({ dynamite: 1 })) return null;
  const targets = tool === 'dynamite' ? cross(i) : [i];
  const found: string[] = [], broke: number[] = [];
  for (const j of targets) {
    const cc = m.cells[j];
    if (!cc || cc.hp <= 0) continue;
    cc.hp -= tool === 'dynamite' ? 9 : 1;
    if (cc.hp > 0) { cc.cr = true; continue; }
    broke.push(j);
    if (cc.it && spaceFor(cc.it) > 0) {
      addItem(cc.it, 1);
      cc.got = true;
      found.push(cc.it);
      addXP(ITEMS[cc.it].xp);
    }
  }
  S.stats.mined = (S.stats.mined ?? 0) + 1;
  track('mine');
  save();
  return { found, broke };
}

/** Кръст: клетката и четирите ѝ съседи. */
export function cross(i: number) {
  const x = i % MINE_W, y = Math.floor(i / MINE_W);
  const out = [i];
  if (x > 0) out.push(i - 1);
  if (x < MINE_W - 1) out.push(i + 1);
  if (y > 0) out.push(i - MINE_W);
  if (y < MINE_H - 1) out.push(i + MINE_W);
  return out;
}

/** Взима руда, която е останала (ако складът е бил пълен). */
export function pickLeft(i: number) {
  const c = S.mine?.cells[i];
  if (!c || c.hp > 0 || !c.it || c.got) return false;
  if (spaceFor(c.it) < 1) return false;
  addItem(c.it, 1);
  c.got = true;
  save();
  return true;
}

/** Слизане на по-долен етаж (когато стената е разкопана). */
export function descend() {
  const m = mine();
  if (!m || !wallDone()) return false;
  m.depth++;
  m.cells = newWall(m.depth);
  addXP(10 + m.depth * 3);
  save();
  return true;
}

export const mineTools = () => ({ pickaxe: count('pickaxe'), dynamite: count('dynamite'), free: S.mine?.free ?? 0 });
