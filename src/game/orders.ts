import { ITEMS, BUILDINGS, CROPS, TREES, ANIMALS } from './data';
import { S, save, takeAll, addCoins, addXP, now, hasAll, type Order } from './state';

const NAMES = [
  'Баба Фатме', 'Дядо Иван', 'Айше', 'Мехмед', 'Леля Мария', 'Хасан', 'Елена', 'Салих', 'Бай Петър', 'Зюмбюл',
  'Емине', 'Георги', 'Ахмед', 'Сашка', 'Рамадан', 'Неврие', 'Стоян', 'Гюлсюм', 'Учителката Ани', 'Кметът',
];
export const SLOTS = 6;
const WAIT_AFTER_DELETE = 60 * 1000;

/** Стоките, които играчът вече може да прави. */
export function makeable(): string[] {
  const out = new Set<string>();
  for (const c of Object.values(CROPS)) if (c.level <= S.level) out.add(c.id);
  const recipes = [];
  for (const e of S.entities) {
    const b = BUILDINGS[e.type];
    if (!b) continue;
    if (b.recipes) recipes.push(...b.recipes.filter((r) => ITEMS[r.out].level <= S.level));
    if (b.animal && (e.animals?.length ?? 0) > 0) out.add(ANIMALS[b.animal].product);
    if (TREES[e.type]) out.add(TREES[e.type].fruit);
  }
  // рецепта е възможна, ако всичките ѝ съставки са възможни (повтаряме, докато има промяна)
  let changed = true;
  while (changed) {
    changed = false;
    for (const r of recipes) if (!out.has(r.out) && Object.keys(r.needs).every((n) => out.has(n))) { out.add(r.out); changed = true; }
  }
  // фуражите не се поръчват
  return [...out].filter((id) => ITEMS[id].kind !== 'feed');
}

export function newOrder(): Order {
  let pool = makeable();
  // първите поръчки са лесни — само реколта, която вече расте
  if (S.stats.orders < 3) {
    const easy = pool.filter((id) => ITEMS[id].kind === 'crop');
    if (easy.length) pool = easy;
  }
  const lv = S.level;
  const nTypes = Math.min(pool.length, 1 + (Math.random() < 0.5 ? 1 : 0) + (lv > 6 && Math.random() < 0.35 ? 1 : 0));
  // по-скъпите стоки — по-рядко и по-малко
  const weighted = pool.flatMap((id) => {
    const w = ITEMS[id].kind === 'crop' ? 3 : ITEMS[id].kind === 'food' ? 2 : 2;
    return Array(w).fill(id);
  });
  const items: Record<string, number> = {};
  let guard = 0;
  while (Object.keys(items).length < nTypes && guard++ < 50) {
    const id = weighted[(Math.random() * weighted.length) | 0];
    if (items[id]) continue;
    const price = ITEMS[id].price;
    const maxQ = price < 10 ? 4 + Math.floor(lv / 2) : price < 30 ? 2 + Math.floor(lv / 4) : price < 100 ? 1 + Math.floor(lv / 6) : 1;
    items[id] = Math.max(1, Math.min(maxQ, 1 + Math.floor(Math.random() * maxQ)));
  }
  let value = 0, xp = 0;
  for (const [id, q] of Object.entries(items)) {
    value += ITEMS[id].price * q;
    xp += ITEMS[id].xp * q;
  }
  const coins = Math.round(value * (1.6 + Math.random() * 0.5)) + 6 + lv * 2;
  return { id: S.nextOrder++, items, coins, xp: Math.max(3, Math.round(xp * 1.5) + 1), who: NAMES[(Math.random() * NAMES.length) | 0] };
}

/** Попълва празните места и подменя изтритите, когато им дойде времето. */
export function refillOrders() {
  let changed = false;
  while (S.orders.length < SLOTS) {
    S.orders.push(newOrder());
    changed = true;
  }
  const t = now();
  S.orders = S.orders.map((o) => {
    if (o.wait && t >= o.wait) {
      changed = true;
      return newOrder();
    }
    return o;
  });
  if (changed) save();
}

export function canDeliver(o: Order) {
  return !o.wait && hasAll(o.items);
}

export function carBonus() {
  let pct = 0, flat = 0, xp = 0;
  if (S.cars.includes('pickup')) pct += 5;
  if (S.cars.includes('suv')) pct += 5;
  if (S.cars.includes('truck')) pct += 10;
  if (S.cars.includes('hatch')) flat += 5;
  if (S.cars.includes('sedan')) xp += 3;
  return { pct, flat, xp };
}

export function deliver(o: Order) {
  if (!canDeliver(o)) return null;
  takeAll(o.items);
  const b = carBonus();
  const coins = Math.round(o.coins * (1 + b.pct / 100)) + b.flat;
  const xp = o.xp + b.xp;
  addCoins(coins);
  addXP(xp);
  S.stats.orders++;
  const i = S.orders.indexOf(o);
  if (i >= 0) S.orders[i] = newOrder();
  save();
  return { coins, xp };
}

export function trash(o: Order) {
  o.wait = now() + WAIT_AFTER_DELETE;
  save();
}
