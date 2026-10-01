// Сваля 3D моделите от poly.pizza в public/models и записва авторите в public/models/credits.json и CREDITS.md
// Пускане: npm run models   (вече свалените се прескачат; --force сваля всичко наново)
import fs from 'fs';
import path from 'path';

const root = path.resolve(import.meta.dirname, '..');
const list = JSON.parse(fs.readFileSync(path.join(root, 'tools/models.json'), 'utf8'));
const outDir = path.join(root, 'models-raw');
fs.mkdirSync(outDir, { recursive: true });
const credFile = path.join(outDir, 'credits.json');
const credits = fs.existsSync(credFile) ? JSON.parse(fs.readFileSync(credFile, 'utf8')) : {};
const force = process.argv.includes('--force');

async function info(id) {
  const html = await (await fetch(`https://poly.pizza/m/${id}`)).text();
  const i = html.indexOf('window.__SERVER_APP_STATE__ =');
  if (i < 0) throw new Error('няма данни');
  const j = html.indexOf('</script>', i);
  const d = JSON.parse(html.slice(i + 29, j).trim().replace(/;\s*$/, ''));
  const m = d.initialData.model ?? d.initialData;
  const glb = (html.match(/https:\/\/static\.poly\.pizza\/[a-f0-9-]+\.glb/) || [])[0];
  const lic = (html.match(/CC0 1\.0|CC-BY 3\.0/) || [])[0];
  const title = m.Title ?? m.title ?? (html.match(/<title>([^<|]+)/) || [])[1]?.trim();
  const creator = m.Creator?.Username ?? m.creator?.username ?? (JSON.stringify(m).match(/"Username":"([^"]+)"/) || [])[1];
  return { glb, lic, title, creator };
}

let ok = 0, fail = 0;
for (const [name, id] of Object.entries(list)) {
  const file = path.join(outDir, name + '.glb');
  if (!force && fs.existsSync(file) && credits[name]) { ok++; continue; }
  try {
    const m = await info(id);
    if (!m.glb) throw new Error('няма .glb');
    const buf = Buffer.from(await (await fetch(m.glb)).arrayBuffer());
    fs.writeFileSync(file, buf);
    credits[name] = { id, title: m.title, creator: m.creator, licence: m.lic, url: `https://poly.pizza/m/${id}` };
    console.log(`✓ ${name} (${(buf.length / 1024).toFixed(0)} KB) — ${m.title} / ${m.creator} / ${m.lic}`);
    ok++;
  } catch (e) {
    console.log(`✗ ${name} ${id}: ${e.message}`);
    fail++;
  }
}
fs.writeFileSync(credFile, JSON.stringify(credits, null, 1));

// CREDITS.md — авторите на моделите
const rows = Object.entries(credits).sort((a, b) => a[0].localeCompare(b[0]));
const by = rows.filter(([, c]) => c.licence !== 'CC0 1.0');
let md = '# Автори на 3D моделите\n\n';
md += 'Моделите са от [poly.pizza](https://poly.pizza). Повечето са на **Quaternius** с лиценз CC0 (свободни за всякаква употреба).\n';
md += 'Моделите с лиценз CC-BY 3.0 изискват да се посочи авторът — те са в първата таблица.\n\n';
md += '## CC-BY 3.0 (https://creativecommons.org/licenses/by/3.0/)\n\n| Модел | Автор | Линк |\n|---|---|---|\n';
md += by.map(([n, c]) => `| ${c.title} (${n}) | ${c.creator} | ${c.url} |`).join('\n') + '\n\n';
md += '## CC0 1.0\n\n| Модел | Автор | Линк |\n|---|---|---|\n';
md += rows.filter(([, c]) => c.licence === 'CC0 1.0').map(([n, c]) => `| ${c.title} (${n}) | ${c.creator} | ${c.url} |`).join('\n') + '\n';
fs.writeFileSync(path.join(root, 'CREDITS.md'), md);
console.log(`\nГотово: ${ok} модела, ${fail} грешки.`);
