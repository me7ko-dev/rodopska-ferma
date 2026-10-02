// Симулация на баланса: робот играе „умно“ няколко часа игрово време (времето се превърта),
// за да видим кога се стига всяко ниво и дали играчът не засяда. node test/sim.mjs [часове]
import { createRequire } from 'module';
import { execSync } from 'child_process';
const require = createRequire(import.meta.url);
const { chromium } = require(execSync('npm root -g').toString().trim() + '/playwright');
const exe = process.env.CHROME_PATH || (process.env.LOCALAPPDATA + '/ms-playwright/chromium-1234/chrome-win64/chrome.exe');
const hours = +(process.argv[2] || 3);
const browser = await chromium.launch({ executablePath: exe, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
// превъртане на времето: Date.now() = истинското + отместване
await page.addInitScript(() => {
  const real = Date.now.bind(Date);
  window.__skip = 0;
  Date.now = () => real() + window.__skip;
});
await page.goto('http://localhost:5191/');
await page.waitForFunction(() => window.__rf?.ready, null, { timeout: 120000 });

const log = await page.evaluate(async (hours) => {
  const rf = window.__rf;
  const { S, addItem, count, takeAll, spend, addCoins, spaceFor, isSiloItem } = rf.mod.state;
  const { CROPS, BUILDINGS, ANIMALS, ITEMS, xpForLevel } = rf.mod.data;
  const { refillOrders, canDeliver, deliver } = rf.mod.orders;
  const farm = rf.farm;
  const out = [];
  let lastLevel = S.level;
  const step = 20; // секунди на ход
  const turns = (hours * 3600) / step;
  const buyOrder = ['bakery', 'field', 'field', 'coop', 'field', 'field', 'dairy', 'cowshed', 'field', 'field', 'sugarmill', 'field', 'garage', 'field', 'sheepfold', 'loom', 'tree_apple', 'juicer', 'field', 'beehive', 'oilpress', 'field', 'cannery'];
  let bi = 0;
  const sells = {};
  for (let t = 0; t < turns; t++) {
    window.__skip += step * 1000;
    const views = [...farm.views.values()];
    // 1) жътва
    for (const v of views) if (v.def.kind === 'field' && v.isReady()) v.harvest();
    // 2) работилници: събиране + нови поръчки според нуждите
    for (const v of views) if (v.def.kind === 'production') {
      v.tick?.();
      if (v.e.done.length) v.collect();
      for (const r of v.def.recipes) {
        if (v.e.queue.length >= (v.def.slots ?? 2)) break;
        if (ITEMS[r.out].level > S.level) continue;
        const want = ITEMS[r.out].kind === 'feed' ? 6 : 3;
        if (count(r.out) >= want) continue;
        if (Object.entries(r.needs).every(([k, n]) => count(k) >= n)) v.start(r);
      }
    }
    // 3) животни
    for (const v of views) if (v.def.kind === 'animal') { v.collect(); v.feedAll(); }
    // 4) дървета
    for (const v of views) if (v.def.kind === 'tree' && v.isReady()) v.harvest();
    // 5) поръчки
    refillOrders();
    for (const o of [...S.orders]) if (canDeliver(o)) deliver(o);
    // 6) садене: какво липсва най-много (за поръчки/рецепти), иначе пшеница/царевица
    const need = {};
    for (const o of S.orders) if (!o.wait) for (const [k, n] of Object.entries(o.items)) need[k] = (need[k] || 0) + n;
    const feedNeeds = { wheat: 4, corn: 4, potato: 2, carrot: 2, beet: 2 };
    for (const [k, n] of Object.entries(feedNeeds)) need[k] = (need[k] || 0) + n;
    const crops = Object.values(CROPS).filter((c) => c.level <= S.level);
    const pick = () => {
      let best = 'wheat', bs = -1;
      for (const c of crops) {
        const deficit = (need[c.id] || 0) - count(c.id);
        const score = deficit > 0 ? deficit * 10 - c.time / 600 : -c.time / 60;
        if (score > bs) { bs = score; best = c.id; }
      }
      return best;
    };
    for (const v of views) if (v.def.kind === 'field' && v.isEmpty()) { const c = pick(); if (S.coins >= CROPS[c].seed) { v.plant(c); need[c] = (need[c] || 0) - 2; } }
    // 7) пълен склад → продаваме най-многото
    for (const silo of [true, false]) {
      const used = Object.entries(S.inv).filter(([k]) => isSiloItem(k) === silo).reduce((a, [, n]) => a + n, 0);
      const cap = silo ? S.siloCap : S.barnCap;
      if (used > cap * 0.85) {
        const [k, n] = Object.entries(S.inv).filter(([k]) => isSiloItem(k) === silo).sort((a, b) => b[1] - a[1])[0];
        const q = Math.ceil(n / 2);
        takeAll({ [k]: q });
        addCoins(ITEMS[k].price * q);
        sells[k] = (sells[k] || 0) + q;
      }
    }
    // 8) купуване (сгради, ниви, животни, склад)
    if (bi < buyOrder.length) {
      const id = buyOrder[bi];
      const b = BUILDINGS[id];
      const owned = farm.byType(id).length;
      if (b.unique && owned) bi++;
      else if (b.level <= S.level) {
        const price = id === 'field' ? (owned < 6 ? 0 : Math.round(8 + Math.pow(owned - 5, 1.6) * 6)) : b.price;
        if (S.coins >= price + 60) {
          const spot = farm.findSpot(b, 0, 0, 0);
          if (spot) {
            spend(price);
            await farm.beginPlace(id);
            farm.confirmPlace();
            out.push(`  ${(t * step / 60).toFixed(0)} мин: купи ${b.name} за ${price}`);
          } else if (!S.lands.includes('east') && S.level >= 3 && S.coins >= 400) farm.buyLand('east');
          bi++;
        }
      }
    }
    for (const v of [...farm.views.values()]) if (v.def.kind === 'animal' && v.e.animals.length < 4 && S.coins > ANIMALS[v.def.animal].price * 2 + 100) v.buyAnimal();
    if (S.siloCap - 0 < 100 && S.coins > 800) { /* увеличаване на склада */ }
    if (S.level !== lastLevel) {
      out.push(`${(t * step / 60).toFixed(0)} мин → НИВО ${S.level}  (монети ${S.coins}, диаманти ${S.diamonds}, поръчки ${S.stats.orders}, ниви ${farm.byType('field').length})`);
      lastLevel = S.level;
    }
  }
  out.push(`\nКрай след ${hours} ч: ниво ${S.level} (${S.xp}/${xpForLevel(S.level)}), монети ${S.coins}, поръчки ${S.stats.orders}, ожънати ${S.stats.harvested}, произведени ${S.stats.produced}`);
  out.push('Продадено на пазара: ' + JSON.stringify(sells));
  out.push('Склад: ' + JSON.stringify(S.inv));
  return out;
}, hours);
console.log(log.join('\n'));
console.log(errors.length ? 'ГРЕШКИ: ' + errors.slice(0, 5).join(' | ') : 'без грешки');
await browser.close();
