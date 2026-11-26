const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.mp3': 'audio/mpeg', '.glb': 'model/gltf-binary' };
const { createStore, createWishApi } = require('./shared-wish-api.cjs');
const online = process.env.RENDER === 'true' || process.env.WISH_REQUIRE_DB === '1';
const host = online ? '0.0.0.0' : '127.0.0.1';
const wishStore = createStore();
const wishApi = createWishApi(wishStore, online);
let port = Number(process.env.PORT || (online ? 10000 : 8080));
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${host}`);
  if (await wishApi(req, res, url)) return;
  const name = url.pathname === '/' ? '/index.html' : url.pathname;
  if (!['GET', 'HEAD'].includes(req.method)) {
    res.writeHead(405).end();
    return;
  }
  const staticFiles = ['/index.html', '/app.js', '/local-wishes.js', '/shared-wishes.js', '/weather-audio.js', '/wooden-sign.js', '/winter-scene.js', '/season-scene.js', '/tree.png', '/assets/models/wooden-sign.glb'];
  const voice = /^\/voices\/en-(?:ask|got)[1-4]\.mp3$/.test(name);
  const ambience = /^\/assets\/ambience\/(?:day-birds|night-crickets|calm-wind|wind-leaves|autumn-wind|winter-wind|winter-gust)\.mp3$/.test(name);
  if (!staticFiles.includes(name) && !voice && !ambience) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
    return;
  }
  const file = path.join(__dirname, name.slice(1));
  fs.stat(file, (err, stat) => {
    if (err || !stat.isFile()) { res.writeHead(404).end(); return; }
    const headers = { 'Content-Type': mime[path.extname(file)], 'Cache-Control': /\.(mp3|glb|png)$/.test(file) ? 'public, max-age=86400' : 'no-store', 'Accept-Ranges': 'bytes' };
    let start = 0;
    let end = stat.size - 1;
    let status = 200;
    if (req.headers.range) {
      const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
      if (range && (range[1] || range[2])) {
        if (range[1]) {
          start = Number(range[1]);
          if (range[2]) end = Math.min(Number(range[2]), end);
        } else start = Math.max(0, stat.size - Number(range[2]));
      }
      if (!range || !(range[1] || range[2]) || start > end || start < 0 || !Number.isSafeInteger(start) || !Number.isSafeInteger(end)) {
        res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` }).end();
        return;
      }
      status = 206;
      headers['Content-Range'] = `bytes ${start}-${end}/${stat.size}`;
    }
    headers['Content-Length'] = end - start + 1;
    res.writeHead(status, headers);
    if (req.method === 'HEAD') res.end();
    else {
      const stream = fs.createReadStream(file, { start, end });
      stream.on('error', () => res.destroy());
      res.on('close', () => stream.destroy());
      stream.pipe(res);
    }
  });
});
server.on('error', error => {
  if (!online && error.code === 'EADDRINUSE' && port < 8090) { server.listen(++port, host); return; }
  console.error(error.message); process.exitCode = 1;
});
server.on('listening', () => {
  const url = `http://${host}:${port}/`;
  console.log(`Cay uoc nguyen / Wishing Tree v11: ${url}`);
  console.log(wishStore ? 'Shared wish API enabled.' : 'Local browser wishes enabled.');
  console.log('Press Ctrl+C to stop.');
  if (!online && process.platform === 'win32' && !process.env.NO_BROWSER) {
    spawn('cmd.exe', ['/d', '/c', 'start', '', url], { detached: true, stdio: 'ignore' }).unref();
  }
});
server.listen(port, host);
