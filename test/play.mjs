// Робот, който играе: жъне, сее, храни, прави фураж, изпълнява поръчка, купува и поставя сграда.
// node test/play.mjs   (сървърът трябва да върви: npx vite --port 5191)
import { createRequire } from 'module';
import { execSync } from 'child_process';
const require = createRequire(import.meta.url);
const { chromium } = require(execSync('npm root -g').toString().trim() + '/playwright');
const exe = process.env.CHROME_PATH || (process.env.LOCALAPPDATA + '/ms-playwright/chromium-1234/chrome-win64/chrome.exe');
const W = +(process.env.W || 1280), H = +(process.env.H || 720);
const browser = await chromium.launch({ executablePath: exe, headless: !process.env.HEADED, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: W, height: H }, hasTouch: !!process.env.TOUCH, isMobile: !!process.env.TOUCH });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
await page.goto(process.env.URL || 'http://localhost:5191/');
await page.waitForFunction(() => window.__rf?.ready, null, { timeout: 120000 });
await page.waitForTimeout(1500);

let step = 0;
const shot = async (name) => { await page.screenshot({ path: `test/tmp/play-${String(++step).padStart(2, '0')}-${name}.png` }); };
const ok = (cond, msg) => { console.log((cond ? '✓ ' : '✗ ') + msg); if (!cond) errors.push('ПРОВАЛ: ' + msg); };
const st = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__rf.S)));
/** Екранни координати на обект от даден тип (n-тият). */
const screenOf = (type, n = 0, dy = 0) => page.evaluate(([type, n, dy]) => {
  const rf = window.__rf;
  const v = [...rf.farm.views.values()].filter((v) => v.e.type === type)[n];
  if (!v) return null;
  const p = v.root.position.clone(); p.y += dy;
  p.project(rf.engine.camera);
  return { x: (p.x + 1) / 2 * innerWidth, y: (1 - p.y) / 2 * innerHeight };
}, [type, n, dy]);
const flyTo = (type, n = 0, dist = 34) => page.evaluate(([type, n, dist]) => {
  const rf = window.__rf;
  const v = [...rf.farm.views.values()].filter((v) => v.e.type === type)[n];
  rf.rig.flyTo(v.root.position.x, v.root.position.z, dist);
}, [type, n, dist]);
const tap = async (p) => { if (process.env.TOUCH) await page.touchscreen.tap(p.x, p.y); else await page.mouse.click(p.x, p.y); await page.waitForTimeout(450); };

// 1) жътва на готовата пшеница (първите 2 ниви узряват след 5 сек)
await page.waitForTimeout(4500);
await flyTo('field', 0, 30);
await page.waitForTimeout(1200);
let s0 = await st();
const f0 = await screenOf('field', 0);
await tap(f0);
await page.waitForTimeout(300);
let s1 = await st();
ok((s1.inv.wheat || 0) > (s0.inv.wheat || 0), `жътва: пшеница ${s0.inv.wheat} → ${s1.inv.wheat}`);
// жътва с плъзгане по втората нива
const f1 = await screenOf('field', 1);
await tap(f1);
s1 = await st();
ok((s1.inv.wheat || 0) >= (s0.inv.wheat || 0) + 4, `и втората нива: пшеница ${s1.inv.wheat}`);
await shot('harvest');

// 2) сеене: натискаме празна нива → лента със семена → пшеница
const f2 = await screenOf('field', 2);
await tap(f2);
await page.waitForTimeout(400);
const seedsShown = await page.evaluate(() => document.getElementById('seeds').classList.contains('show'));
ok(seedsShown, 'лентата със семена се показва');
await shot('seeds');
await page.click('.seed[data-act="seed:wheat"]');
await page.waitForTimeout(400);
s1 = await st();
const planted = s1.entities.filter((e) => e.type === 'field' && e.crop).length;
ok(planted >= 1, `засети ниви: ${planted}`);
// плъзгане по още ниви (садене)
const f3 = await screenOf('field', 3), f4 = await screenOf('field', 4), f5 = await screenOf('field', 5);
if (!process.env.TOUCH) {
  await page.mouse.move(f3.x, f3.y);
  await page.mouse.down();
  for (const f of [f4, f5]) await page.mouse.move(f.x, f.y, { steps: 8 });
  await page.mouse.up();
} else {
  // истинско плъзгане с пръст (през DevTools протокола)
  const cdp = await page.context().newCDPSession(page);
  const pt = (p) => [{ x: p.x, y: p.y, id: 1, radiusX: 8, radiusY: 8, force: 1 }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(f3) });
  let prev = f3;
  for (const f of [f4, f5]) {
    for (let k = 1; k <= 8; k++) {
      const q = { x: prev.x + (f.x - prev.x) * k / 8, y: prev.y + (f.y - prev.y) * k / 8 };
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(q) });
      await page.waitForTimeout(16);
    }
    prev = f;
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}
await page.waitForTimeout(400);
s1 = await st();
ok(s1.entities.filter((e) => e.type === 'field' && e.crop).length >= 3, `след плъзгане засети: ${s1.entities.filter((e) => e.type === 'field' && e.crop).length}`);
await shot('sown');
await page.click('[data-act="sowdone"]').catch(() => {});

// 3) кокошките: натискаме кокошарника → храним
await flyTo('coop', 0, 32);
await page.waitForTimeout(1200);
s0 = await st();
await tap(await screenOf('coop', 0));
s1 = await st();
const fed = s1.entities.find((e) => e.type === 'coop').animals.filter((a) => a.fed).length;
ok(fed > 0, `нахранени кокошки: ${fed} (храна ${s0.inv.feed_chicken} → ${s1.inv.feed_chicken || 0})`);
await shot('coop');

// 4) мелницата: прозорец + правим храна (трябва ниво 2 за храна за кокошки — проверяваме прозореца)
await flyTo('feedmill', 0, 36);
await page.waitForTimeout(1200);
await tap(await screenOf('feedmill', 0, 2));
await page.waitForTimeout(500);
const prodOpen = await page.evaluate(() => document.getElementById('panel-wrap').classList.contains('show') && document.getElementById('panel-title').textContent);
ok(!!prodOpen, `прозорец на мелницата: ${prodOpen}`);
await shot('feedmill');
await page.click('[data-act="close"]');
await page.waitForTimeout(300);

// 5) поръчки
await page.click('#btn-orders');
await page.waitForTimeout(600);
await shot('orders');
const canSend = await page.$$eval('.order.ok [data-act="send"]', (b) => b.length);
if (canSend) {
  s0 = await st();
  await page.click('.order.ok [data-act="send"]');
  await page.waitForTimeout(600);
  s1 = await st();
  ok(s1.coins > s0.coins, `изпълнена поръчка: монети ${s0.coins} → ${s1.coins}`);
} else console.log('• няма поръчка, която може да се изпълни сега');
await page.click('[data-act="close"]');
await page.waitForTimeout(300);

// 6) склад
await page.click('#hud-barn');
await page.waitForTimeout(500);
await shot('storage');
await page.click('[data-act="close"]');
await page.waitForTimeout(300);

// 7) магазин → купуваме пейка и я поставяме
await page.click('#btn-shop');
await page.waitForTimeout(600);
await page.click('.tab[data-tab="deco"]');
await page.waitForTimeout(500);
await shot('shop');
s0 = await st();
await page.click('.card[data-id="d_bench"]');
await page.waitForTimeout(800);
const placing = await page.evaluate(() => !!window.__rf.farm.place);
ok(placing, 'режим на поставяне');
await shot('placing');
await page.click('[data-act="pok"]');
await page.waitForTimeout(600);
s1 = await st();
ok(s1.entities.filter((e) => e.type === 'd_bench').length > s0.entities.filter((e) => e.type === 'd_bench').length, `пейката е поставена, монети ${s0.coins} → ${s1.coins}`);

// 8) имоти
await page.click('#btn-home');
await page.waitForTimeout(600);
await shot('home');
await page.click('.tab[data-tab="village"]');
await page.waitForTimeout(600);
await shot('village');
await page.click('[data-act="close"]');

// 9) настройки
await page.click('[data-open="settings"]');
await page.waitForTimeout(800);
await shot('settings');
await page.click('[data-act="close"]');

// 10) нивото
await page.evaluate(() => { const S = window.__rf.S; });
const fin = await st();
console.log(`\nНиво ${fin.level}, опит ${fin.xp}, монети ${fin.coins}, склад: ${JSON.stringify(fin.inv)}`);
console.log(errors.length ? '\nГРЕШКИ:\n' + errors.slice(0, 20).join('\n') : '\nБез грешки в конзолата.');
await browser.close();
process.exit(errors.some((e) => e.startsWith('ПРОВАЛ') || e.startsWith('PAGEERROR')) ? 1 : 0);
