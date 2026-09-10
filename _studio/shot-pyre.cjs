// Screenshot the Pyre section of the live site, clipped to the element, 2x scale.
'use strict';
const { spawn } = require('child_process'); const fs = require('fs'); const path = require('path');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9484, W = 1200, H = 1400; const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const OUT = path.join(__dirname, '..', 'brand', 'styx-pyre-section.png');
(async () => {
  const chrome = spawn(CHROME, ['--headless=new', '--no-sandbox', '--hide-scrollbars', '--force-device-scale-factor=2', `--window-size=${W},${H}`, `--remote-debugging-port=${PORT}`, '--remote-allow-origins=*', `--user-data-dir=${path.join(__dirname, 'rec-profile-' + PORT)}`, 'http://localhost:8198/'], { stdio: 'ignore' });
  try {
    for (let i = 0; i < 80; i++) { try { if ((await fetch(`http://127.0.0.1:${PORT}/json/version`)).ok) break; } catch {} await sleep(200); }
    const p = (await (await fetch(`http://127.0.0.1:${PORT}/json`)).json()).find((t) => t.type === 'page');
    const ws = new WebSocket(p.webSocketDebuggerUrl); await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });
    let id = 0; const pending = new Map();
    ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { const { resolve, reject } = pending.get(m.id); pending.delete(m.id); m.error ? reject(new Error(m.error.message)) : resolve(m.result); } });
    const send = (method, params = {}) => new Promise((resolve, reject) => { const mid = ++id; pending.set(mid, { resolve, reject }); ws.send(JSON.stringify({ id: mid, method, params })); });
    await send('Page.enable'); await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 2, mobile: false });
    await sleep(4000);
    const r = await send('Runtime.evaluate', { returnByValue: true, expression: `(() => { document.querySelector('header').style.visibility='hidden'; const a = document.getElementById('pyre'); a.scrollIntoView(); const b = document.getElementById('pyrefeed').getBoundingClientRect(); const t = a.getBoundingClientRect(); return { x: t.left - 24, y: t.top - 24, w: t.width + 48, h: b.bottom - t.top + 48 }; })()` });
    await sleep(600);
    const c = r.result.value;
    const shot = await send('Page.captureScreenshot', { format: 'png', clip: { x: c.x, y: c.y, width: c.w, height: c.h, scale: 2 } });
    fs.writeFileSync(OUT, Buffer.from(shot.data, 'base64'));
    ws.close(); console.log('✓', OUT, JSON.stringify(c));
  } finally { chrome.kill(); }
})().catch((e) => { console.error(e); process.exit(1); });
