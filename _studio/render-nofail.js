'use strict';
const { spawnSync } = require('child_process');
const p = require('path'); const os = require('os'); const fs = require('fs');
const html = 'file:///' + p.resolve(__dirname, 'graphic-nofail.html').split(p.sep).join('/');
const png = p.resolve(__dirname, '..', 'brand', 'styx-cant-fail-like-ust.png');
const r = spawnSync('C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', '--no-sandbox', '--hide-scrollbars', '--force-device-scale-factor=1',
  '--user-data-dir=' + p.join(os.tmpdir(), 'styxl2_' + Date.now()),
  '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--window-size=2400,1180', '--virtual-time-budget=6000',
  '--screenshot=' + png, html,
], { stdio: 'ignore', timeout: 90000 });
console.log(r.status, fs.existsSync(png) ? fs.statSync(png).size : 0, png);
