// Смалява моделите от models-raw/ в public/models/ (текстури webp до 512px + meshopt компресия).
// Пускане: node tools/optimize-models.mjs   (прескача вече смалените; --force прави всички наново)
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

const root = path.resolve(import.meta.dirname, '..');
const src = path.join(root, 'models-raw');
const dst = path.join(root, 'public/models');
fs.mkdirSync(dst, { recursive: true });
const force = process.argv.includes('--force');
const cli = path.join(root, 'node_modules/@gltf-transform/cli/bin/cli.js');

let total = 0, n = 0;
for (const f of fs.readdirSync(src).filter((f) => f.endsWith('.glb')).sort()) {
  const a = path.join(src, f), b = path.join(dst, f);
  if (!force && fs.existsSync(b) && fs.statSync(b).mtimeMs > fs.statSync(a).mtimeMs) { total += fs.statSync(b).size; n++; continue; }
  try {
    execFileSync(process.execPath, [cli, 'optimize', a, b, '--compress', 'meshopt', '--texture-compress', 'webp', '--texture-size', '512', '--simplify', 'false'], { stdio: 'pipe' });
    const s = fs.statSync(b).size; total += s; n++;
    console.log(`✓ ${f} ${(fs.statSync(a).size / 1024).toFixed(0)} KB → ${(s / 1024).toFixed(0)} KB`);
  } catch (e) {
    console.log(`✗ ${f}: ${String(e.stderr || e.message).split('\n').slice(-3).join(' ')}`);
  }
}
fs.copyFileSync(path.join(src, 'credits.json'), path.join(dst, 'credits.json'));
console.log(`\n${n} модела, общо ${(total / 1024 / 1024).toFixed(1)} MB`);
