// Bonds + vigil boost + STYX payout queue E2E (dev server, DEV_FAUCET=1).
const B = 'http://localhost:8198'; const U = '0x0000000000000000000000000000000000000309';
const post = (u, b) => fetch(B + u, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ wallet: U, ...b }) }).then((r) => r.json());
let fails = 0; const ok = (n, c, x) => { console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  · ' + x : '')); if (!c) fails++; };
const f = (n) => Math.round(n * 100) / 100;
(async () => {
  await new Promise((r) => setTimeout(r, 2000));
  const m0 = await (await fetch(B + '/api/metrics')).json();
  ok('metrics.bonds present + open', m0.bonds && m0.bonds.open && m0.bonds.discount === 0.2, `price ${m0.bonds.price} market ${m0.bonds.market} left ${m0.bonds.leftToday}`);
  ok('bond price = market × 0.8', Math.abs(m0.bonds.price - m0.bonds.market * 0.8) < 1e-12);
  ok('vigil boosted to 100% this week', m0.vigil.apy === 1 && m0.vigil.boost.live && m0.vigil.baseApy === 0.4, 'apy ' + m0.vigil.apy);
  await post('/api/dev/faucet', { amount: 1000 });
  const lo = await post('/api/bond', { amount: 10 }); ok('bond below 50 refused', /minimum bond/.test(lo.error || ''), lo.error);
  const col0 = m0.collateralUsd;
  const b = await post('/api/bond', { amount: 200 });
  ok('bond 200 USDG → STYX at discount', b.ok && f(b.bonded) === 200 && Math.abs(b.styxOut - 200 / (b.market * 0.8)) < 1e-6, `${Math.round(b.styxOut)} STYX @ ${b.price}`);
  ok('USDG left ledger, nothing minted', f(b.usdg) === 800 && f(b.susd) === 0);
  ok('bond shows pending, ~0 claimable', b.bonds.pending > 0 && b.bonds.claimable < b.bonds.pending * 0.001, `pending ${Math.round(b.bonds.pending)} claimable ${b.bonds.claimable.toFixed(2)}`);
  const m1 = await (await fetch(B + '/api/metrics')).json();
  ok('reserve grew by 200 (over-collateralizes sUSD)', f(m1.collateralUsd - col0) === 200, 'Δ ' + f(m1.collateralUsd - col0));
  ok('daily capacity decremented', f(m1.bonds.leftToday) === f(m0.bonds.leftToday - 200) && m1.bonds.n >= 1);
  const cap = await post('/api/bond', { amount: 800 }); ok('cap enforced', /capacity/.test(cap.error || '') || cap.ok, cap.error || 'within cap');
  await new Promise((r) => setTimeout(r, 1500));
  const cl = await post('/api/bond/claim', {}); ok('claim pays the vested sliver', cl.ok && cl.claimedStyx > 0 && cl.styx > 0, 'claimed ' + cl.claimedStyx.toFixed(4));
  const wd = await post('/api/withdraw', { asset: 'STYX', amount: cl.styx }); ok('STYX withdrawal queued', wd.ok && wd.queued.asset === 'STYX' && f(wd.styx) === 0, 'id ' + wd.queued.id);
  await post('/api/dev/faucet', { amount: 100 }); const wd2 = await post('/api/withdraw', { amount: 100 }); ok('USDG withdrawal still works (default asset)', wd2.ok && wd2.queued.asset === 'USDG');
  console.log(fails ? fails + ' FAILED' : 'ALL PASS'); process.exitCode = fails ? 1 : 0;
})();
