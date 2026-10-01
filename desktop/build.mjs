// Прави release/RodopskaFerma-win32-x64/RodopskaFerma.exe: npm run exe (сглобява се в GitHub Actions)
// Самият Electron .exe НЕ се променя (само се преименува), за да не го блокира Windows Smart App Control.
import fs from 'fs';
import path from 'path';
import { createPackage } from '@electron/asar';

const OUT = 'release/RodopskaFerma-win32-x64';
const SRC = 'node_modules/electron/dist';
const STAGE = 'release/_app';

fs.rmSync(OUT, { recursive: true, force: true });
fs.rmSync(STAGE, { recursive: true, force: true });
fs.cpSync(SRC, OUT, { recursive: true });
fs.renameSync(path.join(OUT, 'electron.exe'), path.join(OUT, 'RodopskaFerma.exe'));
fs.rmSync(path.join(OUT, 'resources', 'default_app.asar'), { force: true });

fs.mkdirSync(path.join(STAGE, 'desktop'), { recursive: true });
fs.cpSync('dist', path.join(STAGE, 'dist'), { recursive: true });
fs.copyFileSync('desktop/main.cjs', path.join(STAGE, 'desktop/main.cjs'));
fs.copyFileSync('desktop/icon.png', path.join(STAGE, 'desktop/icon.png'));
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
fs.writeFileSync(path.join(STAGE, 'package.json'), JSON.stringify({ name: pkg.name, productName: pkg.productName, version: pkg.version, main: 'desktop/main.cjs' }, null, 2));
await createPackage(STAGE, path.join(OUT, 'resources', 'app.asar'));
fs.rmSync(STAGE, { recursive: true, force: true });
fs.copyFileSync('desktop/icon.ico', path.join(OUT, 'RodopskaFerma.ico'));
console.log('OK ' + OUT);
