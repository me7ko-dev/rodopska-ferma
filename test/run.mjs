// Пуска играта и изпълнява скрипт в нея: node test/run.mjs скрипт.js [снимка.png] [ширина] [височина]
// Скриптът е тяло на async функция; има достъп до window.__rf. Каквото върне — се отпечатва.
// FRESH=1 — започва с нова ферма; TOUCH=1 — телефон; SHOTS=1 — скриптът може да вика window.__shot('име') за още снимки.
import { createRequire } from 'module';
import { execSync } from 'child_process';
import fs from 'fs';
const require = createRequire(import.meta.url);
const { chromium } = require(execSync('npm root -g').toString().trim() + '/playwright');
const [script, out, W = 1280, H = 720] = process.argv.slice(2);
const exe = process.env.CHROME_PATH || (process.env.LOCALAPPDATA + '/ms-playwright/chromium-1234/chrome-win64/chrome.exe');
const browser = await chromium.launch({ executablePath: exe, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: +W, height: +H }, deviceScaleFactor: 1, hasTouch: !!process.env.TOUCH, isMobile: !!process.env.TOUCH });
const logs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text()); else if (m.text().startsWith('§')) console.log(m.text().slice(1)); });
page.on('pageerror', (e) => logs.push('PAGEERROR: ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n')));
await page.addInitScript(() => {
  const real = Date.now.bind(Date);
  window.__skip = 0;
  Date.now = () => real() + window.__skip;
});
if (process.env.QUALITY) await page.addInitScript((q) => localStorage.setItem('rf-quality', q), process.env.QUALITY);
if (process.env.FRESH) await page.addInitScript(() => { if (!sessionStorage.getItem('fresh')) { localStorage.removeItem('rf-save-v1'); sessionStorage.setItem('fresh', '1'); } });
if (process.env.SAVE) await page.addInitScript((s) => { if (!sessionStorage.getItem('saved')) { localStorage.setItem('rf-save-v1', s); sessionStorage.setItem('saved', '1'); } }, fs.readFileSync(process.env.SAVE, 'utf8'));
let shotN = 0;
await page.exposeFunction('__shotNode', async (name) => { await page.screenshot({ path: `test/tmp/${name || 'step' + ++shotN}.png` }); });
await page.goto(process.env.URL || 'http://localhost:5191/');
await page.waitForFunction(() => window.__rf?.ready, null, { timeout: 120000 });
await page.evaluate(() => { window.__shot = (n) => window.__shotNode(n); window.__wait = (ms) => new Promise((r) => setTimeout(r, ms)); });
let res;
try {
  const body = fs.readFileSync(script, 'utf8');
  res = await page.evaluate(`(async () => { ${body} })()`);
} catch (e) { logs.push('СКРИПТ: ' + e.message); }
if (out) await page.screenshot({ path: out });
if (res !== undefined) console.log(typeof res === 'string' ? res : JSON.stringify(res, null, 1));
if (logs.length) console.log('--- грешки/предупреждения ---\n' + logs.slice(0, 25).join('\n'));
await browser.close();
