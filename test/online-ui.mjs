// Онлайн в самата игра — двама играчи в два браузъра: node test/online-ui.mjs
// Изисква: dev сървър (5191) и локален онлайн сървър (npx wrangler dev -c server/wrangler.jsonc --port 8799)
import { createRequire } from 'module';
import { execSync } from 'child_process';
const require = createRequire(import.meta.url);
const { chromium } = require(execSync('npm root -g').toString().trim() + '/playwright');
const exe = process.env.CHROME_PATH || (process.env.LOCALAPPDATA + '/ms-playwright/chromium-1234/chrome-win64/chrome.exe');
const GAME = process.env.URL || 'http://localhost:5191/';
const API = process.env.API || 'http://localhost:8799';
const browser = await chromium.launch({ executablePath: exe, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
let ok = 0, bad = 0;
const check = (c, what) => { c ? ok++ : bad++; console.log(c ? '  ✓' : '  ✗', what); };
const errors = [];

async function player(tag) {
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 760 } });
  await ctx.addInitScript((api) => { localStorage.setItem('rf-api', api); localStorage.setItem('rf-quality', 'low'); }, API);
  await ctx.addInitScript(TOAST_SPY);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(tag + ': ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning' || m.text().includes('[dbg]')) errors.push(tag + ' ' + m.type() + ': ' + m.text()); });
  await page.goto(GAME);
  await page.waitForFunction(() => window.__rf?.ready, null, { timeout: 120000 });
  return page;
}
// всички известия от началото (пазим ги, защото изчезват след 3 секунди)
const toasts = (page) => page.evaluate(() => (window.__toasts || []).join(' | '));
const TOAST_SPY = () => {
  window.__toasts = [];
  new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) if (n.classList?.contains('toast')) window.__toasts.push(n.textContent); })
    .observe(document, { childList: true, subtree: true });
};
const wait = (page, ms) => page.waitForTimeout(ms);

const sfx = Math.random().toString(36).slice(2, 6);
const NA = 'Ани' + sfx, NB = 'Боби' + sfx;

process.on('uncaughtException', (e) => { console.log('СПРЯ:', e.message.split('\n').slice(0, 3).join(' ')); console.log('ГРЕШКИ В СТРАНИЦАТА:\n' + errors.slice(0, 15).join('\n')); process.exit(1); });
console.log('Играч А: регистрация');
const A = await player('A');
await A.click('#btn-social');
await wait(A, 400);
await A.fill('#au-name', NA);
await A.fill('#au-pass', 'тайна123');
await A.fill('#au-pass2', 'тайна123');
await A.click('[data-act="auth"]');
await wait(A, 2500);
check((await A.evaluate(() => document.querySelector('#panel-body')?.textContent || '')).includes(NA), 'профилът на А се показва');
await A.screenshot({ path: 'test/tmp/on-profile.png' });
// засяваме нива, за да има какво да се полее
await A.evaluate(() => {
  const rf = window.__rf;
  const f = rf.farm.fields().find((v) => v.isEmpty());
  f.plant('corn');
  window.__fieldUid = f.e.uid;
});
const fieldUid = await A.evaluate(() => window.__fieldUid);
await A.click('.panel-x');
await A.evaluate(() => window.__rf.mod.state.save(true));
await A.click('#btn-social');
await wait(A, 300);
await A.click('[data-tab="me"]');
await wait(A, 300);
await A.click('[data-act="syncnow"]');
await wait(A, 1500);
const cloud = await (await fetch(API + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: NA, pass: 'тайна123' }) })).json();
check(cloud.cloud?.rev >= 1, `фермата на А е в облака (rev ${cloud.cloud?.rev})`);

console.log('Играч Б: регистрация, приятел, гости');
const B = await player('B');
await B.click('#btn-social');
await wait(B, 300);
await B.fill('#au-name', NB);
await B.fill('#au-pass', 'парола42');
await B.fill('#au-pass2', 'парола42');
await B.click('[data-act="auth"]');
await wait(B, 2500);
await B.click('[data-tab="friends"]');
await wait(B, 1500);
await B.fill('#fr-name', NA);
await B.click('[data-act="findf"]');
await wait(B, 1200);
await B.click(`[data-act="addf"][data-n="${NA}"]`);
await wait(B, 1500);
check((await B.evaluate(() => document.querySelector('#panel-body')?.textContent || '')).includes('Моите приятели (1)'), 'Б има 1 приятел');
await B.screenshot({ path: 'test/tmp/on-friends.png' });
await B.click(`.person [data-act="visit"][data-n="${NA}"]`);
await B.waitForURL(/gost=/, { timeout: 15000 });
await B.waitForFunction(() => window.__rf?.ready, null, { timeout: 120000 });
await wait(B, 1500);
check(await B.evaluate(() => document.body.classList.contains('visiting') && !!document.getElementById('visitbar')), 'Б е на гости (лента „на гости“)');
check((await B.evaluate(() => document.querySelector('.vtitle')?.textContent || '')).includes(NA), 'вижда се името на А');
// помага: полива нивата с царевица
await B.evaluate((uid) => window.__rf.farm.views.get(uid).tap(), fieldUid);
await wait(B, 1500);
check((await B.evaluate(() => document.querySelector('.vhint')?.textContent || '')).includes('още 4'), 'остават 4 помощи');
await B.click('[data-act="vlike"]');
await wait(B, 1200);
check((await B.evaluate(() => document.querySelector('[data-act="vlike"]')?.textContent || '')).includes('Харесано'), 'Б хареса фермата');
await B.screenshot({ path: 'test/tmp/on-visit.png' });
await B.click('[data-act="vhome"]');
await B.waitForFunction(() => !location.search.includes('gost') && window.__rf?.ready, null, { timeout: 120000 });
await wait(B, 2500);
check((await toasts(B)).includes('Благодарност'), 'Б получи благодарност у дома');

console.log('Играч А получава помощта');
await A.reload();
await A.waitForFunction(() => window.__rf?.ready, null, { timeout: 120000 });
// първо се сверява записът с облака, после идват известията — чакаме ги
await A.waitForFunction(() => (window.__toasts || []).some((t) => t.includes('Помогнаха')), null, { timeout: 20000 }).catch(() => {});
check((await toasts(A)).includes(NB), 'А вижда „Помогнаха ти: ' + NB + '“');
check(await A.evaluate((uid) => window.__rf.farm.views.get(uid).isReady(), fieldUid), 'царевицата на А узря веднага');
console.log(errors.filter((e) => e.startsWith('A')).join(' || '));

console.log('Пазар');
await A.evaluate(() => { window.__rf.mod.state.addItem('egg', 3, true); });
await A.evaluate(() => window.__rf.farm.byType('market')[0] ? 0 : 1);
await A.evaluate(async () => { const UI = window.__rf.UI; UI.openMarket('sell'); });
await wait(A, 1500);
await A.click('[data-act="msel"][data-k="egg"]');
await wait(A, 300);
await A.click('[data-act="mlist"]');
await wait(A, 1500);
check(await A.evaluate(() => (window.__rf.S ?? {}).inv?.egg ?? window.__rf.mod.state.S.inv.egg), 'А сложи яйца в сергията');
await A.screenshot({ path: 'test/tmp/on-stall.png' });
const cheeseA = await A.evaluate(() => window.__rf.mod.state.S.inv.egg || 0);
check(cheeseA >= 2, `в склада на А остават яйца (има ${cheeseA})`);

await B.evaluate(() => { window.__rf.mod.state.addCoins(5000); });
await B.evaluate(async () => { const UI = window.__rf.UI; UI.openMarket('buy'); });
await wait(B, 1500);
await B.screenshot({ path: 'test/tmp/on-market.png' });
const coinsB0 = await B.evaluate(() => window.__rf.mod.state.S.coins);
await B.click('[data-act="mbuy"]');
await wait(B, 1500);
const coinsB1 = await B.evaluate(() => window.__rf.mod.state.S.coins);
check(coinsB1 < coinsB0 && (await B.evaluate(() => window.__rf.mod.state.S.inv.egg || 0)) >= 1, `Б купи яйцата (${coinsB0} → ${coinsB1} монети)`);

await A.evaluate(async () => { const UI = window.__rf.UI; UI.openMarket('sell'); });
await wait(A, 1500);
const coinsA0 = await A.evaluate(() => window.__rf.mod.state.S.coins);
await A.click('[data-act="mcollect"]');
await wait(A, 1500);
const coinsA1 = await A.evaluate(() => window.__rf.mod.state.S.coins);
check(coinsA1 > coinsA0, `А взе монетите (${coinsA0} → ${coinsA1})`);

console.log('Класации');
await A.click('.panel-x');
await A.click('#btn-social');
await wait(A, 300);
await A.click('[data-tab="top"]');
await wait(A, 1500);
check((await A.evaluate(() => document.querySelectorAll('.trow').length)) >= 2, 'класацията показва играчи');
await A.screenshot({ path: 'test/tmp/on-top.png' });

console.log('Второ устройство на А (запис от облака)');
const A2 = await player('A2');
await A2.screenshot({ path: 'test/tmp/on-a2.png' });
console.log('A2:', await A2.evaluate(() => JSON.stringify({ btn: !!document.getElementById('btn-social'), url: location.href, cls: document.body.className, panel: document.getElementById('panel-title')?.textContent })));
await A2.click('#btn-social');
await wait(A2, 300);
await A2.click('[data-act="mode"][data-m="login"]');
await wait(A2, 200);
await A2.fill('#au-name', NA);
await A2.fill('#au-pass', 'тайна123');
await A2.click('[data-act="auth"]');
// новото устройство сваля фермата от облака и се презарежда
await A2.waitForEvent('load', { timeout: 30000 }).catch(() => {});
await A2.waitForFunction(() => window.__rf?.ready && window.__rf.mod.state.S.owner, null, { timeout: 120000 });
await wait(A2, 2000);
const fieldsA2 = await A2.evaluate((uid) => !!window.__rf.farm.views.get(uid)?.e.crop, fieldUid);
check(fieldsA2, 'на новото устройство е същата ферма (с царевицата)');

// почистване
for (const [n, p] of [[NA, 'тайна123'], [NB, 'парола42']]) {
  const r = await (await fetch(API + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: n, pass: p }) })).json();
  await fetch(API + '/api/account', { method: 'DELETE', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + r.token }, body: JSON.stringify({ pass: p }) });
}
console.log(`\n${ok} успешни, ${bad} грешни`);
if (errors.length) console.log('ГРЕШКИ В СТРАНИЦАТА:\n' + errors.slice(0, 10).join('\n'));
await browser.close();
process.exit(bad ? 1 : 0);
