// THE PYRE hype video — deterministic render: seek each frame, screenshot, encode locked 30fps (zero dropped frames).
'use strict';
const { spawn, execFile } = require('child_process');
const { promisify } = require('util');
const fs = require('fs'); const path = require('path');
const pexec = promisify(execFile);
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const W = 1280, H = 720, FPS = 30, DUR = 10, PORT = 9497;
const OUT = path.join(__dirname, '..', 'brand', 'styx-ferry-10s.mp4');
const FRAMES = path.join(__dirname, 'ferry-frames');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  fs.rmSync(FRAMES, { recursive: true, force: true }); fs.mkdirSync(FRAMES);
  const url = 'file:///' + path.join(__dirname, 'ferry-video.html').split(path.sep).join('/');
  const chrome = spawn(CHROME, ['--headless=new', '--no-sandbox', '--hide-scrollbars', '--force-device-scale-factor=1', `--window-size=${W},${H}`, `--remote-debugging-port=${PORT}`, '--remote-allow-origins=*', `--user-data-dir=${path.join(__dirname, 'rec-profile-' + PORT)}`, url], { stdio: 'ignore' });
  try {
    for (let i = 0; i < 80; i++) { try { if ((await fetch(`http://127.0.0.1:${PORT}/json/version`)).ok) break; } catch {} await sleep(200); }
    const p = (await (await fetch(`http://127.0.0.1:${PORT}/json`)).json()).find((t) => t.type === 'page');
    const ws = new WebSocket(p.webSocketDebuggerUrl); await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });
    let id = 0; const pending = new Map();
    ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { const { resolve, reject } = pending.get(m.id); pending.delete(m.id); m.error ? reject(new Error(m.error.message)) : resolve(m.result); } });
    const send = (method, params = {}) => new Promise((resolve, reject) => { const mid = ++id; pending.set(mid, { resolve, reject }); ws.send(JSON.stringify({ id: mid, method, params })); });
    await send('Page.enable'); await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
    await sleep(1500);
    await send('Runtime.evaluate', { expression: 'window.__ready', awaitPromise: true });
    const N = FPS * DUR;
    for (let f = 0; f < N; f++) {
      await send('Runtime.evaluate', { expression: `window.__seek(${(f / FPS).toFixed(4)})`, returnByValue: true });
      const shot = await send('Page.captureScreenshot', { format: 'jpeg', quality: 94 });
      fs.writeFileSync(path.join(FRAMES, `f_${String(f).padStart(4, '0')}.jpg`), Buffer.from(shot.data, 'base64'));
      if (f % 60 === 0) console.log('frame', f, '/', N);
    }
    ws.close();
  } finally { chrome.kill(); }
  await pexec('ffmpeg', ['-y', '-framerate', String(FPS), '-i', path.join(FRAMES, 'f_%04d.jpg'), '-vf', 'format=yuv420p', '-c:v', 'libx264', '-crf', '18', '-preset', 'slow', '-movflags', '+faststart', OUT], { maxBuffer: 1 << 27 });
  fs.rmSync(FRAMES, { recursive: true, force: true });
  console.log('✓', OUT);
})().catch((e) => { console.error(e); process.exit(1); });
