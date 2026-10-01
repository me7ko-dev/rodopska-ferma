// Windows версия на Родопска ферма: същата игра в собствен прозорец на цял екран (F11 превключва).
const { app, BrowserWindow, Menu } = require('electron');
const http = require('http'), fs = require('fs'), path = require('path');

const ROOT = path.join(__dirname, '..', 'dist');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.png': 'image/png',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.glb': 'model/gltf-binary', '.svg': 'image/svg+xml' };

// малък вътрешен сървър (ES модулите не се зареждат от file://); винаги на един и същ порт, за да се пази прогресът
function serve(port) {
  return new Promise((resolve, reject) => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p === '/') p = '/index.html';
      const file = path.join(ROOT, path.normalize(p));
      if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
      fs.readFile(file, (err, data) => {
        if (err) { res.writeHead(404); return res.end('404'); }
        res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
        res.end(data);
      });
    });
    srv.on('error', reject);
    srv.listen(port, '127.0.0.1', () => resolve(srv.address().port));
  });
}

// 3D играта иска истинската видеокарта (на лаптопа има и вградена Intel)
app.commandLine.appendSwitch('force_high_performance_gpu');

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);
  let port;
  try { port = await serve(47851); } catch { port = await serve(0); }
  const win = new BrowserWindow({
    width: 1600, height: 900, fullscreen: true, backgroundColor: '#79b83f', title: 'Родопска ферма',
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: { backgroundThrottling: false },
  });
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') { win.setFullScreen(!win.isFullScreen()); e.preventDefault(); }
    if (input.type === 'keyDown' && input.key === 'Escape' && win.isFullScreen()) { win.setFullScreen(false); e.preventDefault(); }
  });
  await win.loadURL(`http://127.0.0.1:${port}/`);
});
app.on('window-all-closed', () => app.quit());
