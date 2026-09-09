// STYX hype — 10s on the real hero (owl coin), kinetic Cinzel titles.
'use strict';
const path = require('path');
const { record } = require('./rec.cjs');
const OVERLAY = require('./overlay.cjs');
const SITE = process.env.SITE || 'http://localhost:8198';
record({ site: SITE + '/', out: path.join(__dirname, '..', 'brand', 'styx-hype-10s.mp4'), port: 9471, script: async ({ ev, sleep }) => {
  await ev(OVERLAY, true); await sleep(1500);
  await ev("window.__title('Every ledger<br><em>remembers.</em>','who paid whom · how much · forever','solid')"); await sleep(1800);
  await ev("window.__title('Shield it.<br><i>It forgets.</i>','amount hidden · parties hidden · a note only you can read','solid')"); await sleep(1800);
  await ev("window.__title('sUSD.<br>Backed <em>and</em> algorithmic.','USDG collateral + a burned STYX share · pegged $1','solid')"); await sleep(1800);
  await ev('window.__titleHide()'); await sleep(1400);
  await ev("window.__title('<em>STYX</em>','private money, carried unseen · styxrh.xyz · $STYX','solid')"); await sleep(1400);
} }).catch((e) => { console.error(e); process.exit(1); });
