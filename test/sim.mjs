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
// напредъкът се показва веднага (не чакаме края)
page.on('console', (m) => { const t = m.text(); if (t.startsWith('§')) console.log(t.slice(1)); });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
// превъртане на времето: Date.now() = истинското + отместване
await page.addInitScript(() => {
  const real = Date.now.bind(Date);
  window.__skip = 0;
  Date.now = () => real() + window.__skip;
});
await page.addInitScript(() => localStorage.setItem('rf-quality', 'low'));
await page.goto(process.env.URL || 'http://localhost:5191/');
await page.waitForFunction(() => window.__rf?.ready, null, { timeout: 120000 });

const log = await page.evaluate(async (hours) => {
  const rf = window.__rf;
  const { S, addItem, count, takeAll, spend, addCoins, spaceFor, isSiloItem } = rf.mod.state;
  const { CROPS, BUILDINGS, ANIMALS, ITEMS, xpForLevel } = rf.mod.data;
  const { refillOrders, canDeliver, deliver } = rf.mod.orders;
  const farm = rf.farm;
  const out = [];
  const log = (t) => { out.push(t); console.log('§' + t); };
  let lastLevel = S.level;
  const step = 20; // секунди на ход
  const turns = (hours * 3600) / step;
  const { LANDS, TREES, MAX_ANIMALS, HOME_TIERS, VILLAGE_HOUSES } = rf.mod.data;
  const fieldPrice = (n) => (n < 6 ? 0 : Math.round(8 + Math.pow(n - 5, 1.6) * 6));
  const levelTimes = {};
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
        if (v.e.queue.length >= (v.def.slots ?? 2) + (v.e.extra ?? 0)) break;
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
    for (const v of views) if (v.def.kind === 'production') for (const r of v.def.recipes) if (ITEMS[r.out].level <= S.level) for (const [k, n] of Object.entries(r.needs)) need[k] = (need[k] || 0) + n;
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
    // 8) купуване: най-евтиното ново нещо, после земя, животни, склад, къща
    if (t % 3 === 0) {
      const cands = [];
      for (const b of Object.values(BUILDINGS)) {
        if (b.level > S.level || b.kind === 'deco' || b.kind === 'pet') continue;
        const owned = farm.byType(b.id).length;
        if (b.kind === 'field') { if (owned < Math.min(6 + S.level * 2, 36)) cands.push([b, fieldPrice(owned)]); continue; }
        if (b.kind === 'tree') { if (owned < 2) cands.push([b, b.price]); continue; }
        if (b.unique || b.kind === 'animal') { if (!owned) cands.push([b, b.price]); continue; }
      }
      cands.sort((a, b) => a[1] - b[1]);
      const c = cands[0];
      if (c && S.coins >= c[1] * 1.15 + 50) {
        const spot = farm.findSpot(c[0], 0, 0, 0);
        if (spot) {
          spend(c[1]);
          await farm.beginPlace(c[0].id);
          farm.confirmPlace();
          if (c[0].kind !== 'field') log(`  ${(t * step / 3600).toFixed(1)} ч: купи ${c[0].name} за ${c[1]}`);
        } else {
          const l = LANDS.find((l) => !S.lands.includes(l.id) && l.level <= S.level);
          if (l && S.coins >= l.price) { farm.buyLand(l.id); log(`  ${(t * step / 3600).toFixed(1)} ч: купи земя ${l.id}`); }
        }
      }
      for (const v of [...farm.views.values()]) if (v.def.kind === 'animal' && v.e.animals.length < (MAX_ANIMALS[v.def.animal] ?? 4) && S.coins > rf.mod.data.ANIMALS[v.def.animal].price * 1.5 + 100) v.buyAnimal();
      // склад
      for (const silo of [true, false]) {
        const used = Object.entries(S.inv).filter(([k]) => isSiloItem(k) === silo).reduce((a, [, n]) => a + n, 0);
        const cap = silo ? S.siloCap : S.barnCap;
        const up = Math.round(150 * Math.pow(1.42, (cap - 50) / 25) / 10) * 10;
        if (used > cap * 0.7 && S.coins > up * 2) { spend(up); if (silo) S.siloCap += 25; else S.barnCap += 25; }
      }
      // къща — дневни монети
      if (new Date(S.lastDaily).toDateString() !== new Date().toDateString()) { S.lastDaily = Date.now(); addCoins(HOME_TIERS[S.home].daily); }
      const nh = HOME_TIERS[S.home + 1];
      if (nh && nh.level <= S.level && S.coins > nh.price * 3) { spend(nh.price); S.home++; }
    }
    if (S.level !== lastLevel) {
      log(`${(t * step / 3600).toFixed(1)} ч → НИВО ${S.level}  (монети ${S.coins}, поръчки ${S.stats.orders}, ниви ${farm.byType('field').length}, сгради ${farm.views.size})`);
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
