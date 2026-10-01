// Купува и поставя всяка сграда/животно/дърво/украса и проверява, че има видим 3D модел. node test/buildall.mjs
import { createRequire } from 'module';
import { execSync } from 'child_process';
const require = createRequire(import.meta.url);
const { chromium } = require(execSync('npm root -g').toString().trim() + '/playwright');
const exe = process.env.CHROME_PATH || (process.env.LOCALAPPDATA + '/ms-playwright/chromium-1234/chrome-win64/chrome.exe');
const browser = await chromium.launch({ executablePath: exe, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' || /липсва модел/.test(m.text())) errors.push(m.text()); });
await page.goto('http://localhost:5191/');
await page.waitForFunction(() => window.__rf?.ready, null, { timeout: 120000 });
const res = await page.evaluate(async () => {
  const rf = window.__rf;
  rf.S.level = 20; rf.S.coins = 1e7;
  // купуваме цялата земя
  for (const id of ['east', 'west', 'north', 'ne', 'nw']) rf.farm.buyLand(id);
  const { BUILDINGS } = await import('/src/game/data.ts');
  const out = [];
  for (const b of Object.values(BUILDINGS)) {
    if (b.unique && rf.farm.byType(b.id).length) continue;
    if (b.kind === 'field') continue;
    await rf.farm.beginPlace(b.id);
    if (!rf.farm.place) { out.push(b.id + ': няма място'); continue; }
    rf.farm.confirmPlace();
    const v = rf.farm.byType(b.id).slice(-1)[0];
    let meshes = 0;
    v?.root.traverse((o) => { if (o.isMesh && !o.userData.view && o.material?.visible !== false) meshes++; });
    out.push(`${b.id}: ${meshes > 1 ? 'OK' : 'ПРАЗНО'} (${meshes})`);
    if (v?.buyAnimal) for (let i = 0; i < 3; i++) v.buyAnimal();
  }
  return out;
});
console.log(res.join('\n'));
await page.evaluate(() => { const rf = window.__rf; rf.rig.flyTo(0, -2, 95); });
await page.waitForTimeout(5000);
await page.screenshot({ path: 'test/tmp/buildall.png' });
console.log(errors.length ? 'ГРЕШКИ:\n' + [...new Set(errors)].slice(0, 15).join('\n') : 'без грешки');
await browser.close();
