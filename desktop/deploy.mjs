// Качва папката dist в клона gh-pages (GitHub Pages): npm run deploy
import { execSync } from 'child_process';
import fs from 'fs';
const sh = (c, cwd) => execSync(c, { cwd, stdio: 'inherit' });
const url = execSync('git remote get-url origin').toString().trim();
fs.writeFileSync('dist/.nojekyll', '');
fs.rmSync('dist/.git', { recursive: true, force: true });
sh('git init -q -b gh-pages', 'dist');
sh('git add -A', 'dist');
sh('git -c user.name=me7ko-dev -c user.email=roikata.u@gmail.com commit -q -m "Публикуване"', 'dist');
sh(`git push -f ${url} gh-pages`, 'dist');
fs.rmSync('dist/.git', { recursive: true, force: true });
console.log('OK: https://me7ko-dev.github.io/rodopska-ferma/');
