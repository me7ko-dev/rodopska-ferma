// Иконите на играта (icon-192/512 и maskable) — снимка от самата игра: node test/icons.mjs
import { createRequire } from 'module';
import { execSync } from 'child_process';
const require = createRequire(import.meta.url);
const { chromium } = require(execSync('npm root -g').toString().trim() + '/playwright');
const exe = process.env.CHROME_PATH || (process.env.LOCALAPPDATA + '/ms-playwright/chromium-1234/chrome-win64/chrome.exe');
const browser = await chromium.launch({ executablePath: exe, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 800, height: 800 } });
await page.goto('http://localhost:5191/');
await page.waitForFunction(() => window.__rf?.ready, null, { timeout: 120000 });
await page.evaluate(() => {
  for (const id of ['ui', 'markers', 'fx']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
  const rf = window.__rf;
  const t = Date.now();
  // всички ниви узрели — златна пшеница
  for (const v of rf.farm.views.values()) if (v.def.kind === 'field') { v.e.crop = 'wheat'; v.e.planted = t - 70000; v.e.ready = t - 1000; }
  rf.rig.flyTo(-6, -6, 30);
  rf.rig.goal.yaw = Math.PI / 4 + 0.15;
});
await page.waitForTimeout(6000);
await page.screenshot({ path: 'test/tmp/icon-src.png' });
await browser.close();
execSync("python tools/make_icons.py", { stdio: "inherit" });
/*
from PIL import Image, ImageDraw
src = Image.open('test/tmp/icon-src.png').convert('RGB')
w, h = src.size
s = min(w, h)
sq = src.crop(((w-s)//2, (h-s)//2, (w+s)//2, (h+s)//2))
def rounded(img, r):
    m = Image.new('L', img.size, 0); ImageDraw.Draw(m).rounded_rectangle([0,0,img.size[0]-1,img.size[1]-1], r, fill=255)
    out = Image.new('RGBA', img.size, (0,0,0,0)); out.paste(img, (0,0), m); return out
big = sq.resize((512,512), Image.LANCZOS)
rounded(big, 96).save('public/icon-512.png')
rounded(sq.resize((192,192), Image.LANCZOS), 36).save('public/icon-192.png')
big.save('public/icon-maskable-512.png')
*/
console.log('иконите са готови');
