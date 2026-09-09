// STYX product demo — 15s. Seeds a wallet through the API, then walks the real app: strike → shield → send unseen → ledger.
'use strict';
const path = require('path');
const { record } = require('./rec.cjs');
const OVERLAY = require('./overlay.cjs');
const SITE = process.env.SITE || 'http://localhost:8198';
const W = '0x5a7d3e9c1b2f4a6d8e0c2b4a6d8f0e2c4a6b8d0f';
const post = (u, b) => fetch(SITE + u, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(Object.assign({ wallet: W }, b)) }).then((r) => r.json());
(async () => {
  await post('/api/mint', { amount: 1500 }); await post('/api/shield', { amount: 900 }); await post('/api/send', { to: '0x1c9e4b7a2d5f8c3e6a9b1d4f7c0e3a6b9d2f5c8e', amount: 250 });
  await record({ site: SITE + '/?w=' + W + '&tab=mint', out: path.join(__dirname, '..', 'brand', 'styx-demo-15s.mp4'), port: 9472, script: async ({ ev, sleep }) => {
    await ev(OVERLAY, true); await sleep(900);
    await ev("window.__cap('styxrh.xyz','A private, fractional-algorithmic stablecoin on <b>Robinhood Chain.</b>')"); await sleep(1500);
    await ev('window.__capHide()');
    await ev("window.__scrollToSel('#demo',1000,.08)", true);
    await ev("window.__cap('rite I · strike','Post USDG collateral, burn a small STYX share, <b>mint $1 sUSD.</b>')"); await sleep(1900);
    await ev("document.querySelector('.tabs button[data-tab=shield]').click()"); await sleep(200);
    await ev("window.__cap('rite II · shield','sUSD becomes a note <b>encrypted only to you.</b> The ledger reads ████.')"); await sleep(1900);
    await ev("document.querySelector('.tabs button[data-tab=send]').click()"); await sleep(200);
    await ev("window.__cap('rite III · send unseen','Amount hidden. Both parties hidden. <b>Only a nullifier and a commitment.</b>')"); await sleep(1900);
    await ev('window.__capHide()');
    await ev("window.__scrollToSel('#feed',900,.2)", true);
    await ev("window.__cap('the unseen ledger','Real commitments, nullifiers and a Merkle root, <b>live.</b>')"); await sleep(1800);
    await ev('window.__capHide()'); await sleep(100);
    await ev("window.__title('<em>STYX</em>','private money, carried unseen · styxrh.xyz · $STYX','solid')"); await sleep(1500);
  } });
})().catch((e) => { console.error(e); process.exit(1); });
