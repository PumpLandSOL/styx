// Charon's Cut E2E: bind via note claim + via ?ref, 20% toll cut credited forever, leaderboard, one-ferryman-per-soul.
const B = 'http://localhost:8198'; const F = '0x00000000000000000000000000000000000000e5', S1 = '0x00000000000000000000000000000000000000f6', S2 = '0x0000000000000000000000000000000000000107';
const post = (u, b) => fetch(B + u, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) }).then((r) => r.json());
let fails = 0; const ok = (n, c, x) => { console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  · ' + x : '')); if (!c) fails++; };
const f = (n) => Math.round(n * 10000) / 10000;
(async () => {
  await new Promise((r) => setTimeout(r, 2000));
  await post('/api/dev/faucet', { wallet: F, amount: 1000 }); await post('/api/mint', { wallet: F, amount: 500 }); await post('/api/shield', { wallet: F, amount: 400 });
  const n = await post('/api/note/create', { wallet: F, amount: 50, memo: 'cross' });
  const cl = await post('/api/note/claim', { wallet: S1, secret: n.secret }); ok('S1 claimed note and got bound to F', cl.ok && cl.ref === F, 'ref ' + cl.ref);
  const fa = await post('/api/account', { wallet: F }); ok('F has 1 soul', fa.souls === 1);
  const e0 = fa.earned; const m0 = (await (await fetch(B + '/api/metrics')).json()).pyre.tollUsd;
  const un = await post('/api/unshield', { wallet: S1, amount: 40 }); // toll 0.12 → F gets 0.024
  const fb = await post('/api/account', { wallet: F }); ok('F earned 20% of S1 toll', f(fb.earned - e0) === 0.024, 'earned +' + f(fb.earned - e0) + ' (toll ' + f(un.toll) + ')');
  ok('F sUSD credited', f(fb.susd - fa.susd) === 0.024);
  const m1 = (await (await fetch(B + '/api/metrics')).json()); ok('pyre got the other 80%', f(m1.pyre.tollUsd - m0) === 0.096 || m1.pyre.epochs > 0, 'delta ' + f(m1.pyre.tollUsd - m0));
  const s2 = await post('/api/account', { wallet: S2, ref: F }); ok('S2 bound via ?ref on first touch', s2.ref === F);
  const s2b = await post('/api/account', { wallet: S2, ref: S1 }); ok('ferryman set once, never changed', s2b.ref === F);
  const self = await post('/api/account', { wallet: '0x0000000000000000000000000000000000000208', ref: '0x0000000000000000000000000000000000000208' }); ok('cannot refer yourself', self.ref === null);
  ok('board lists F redacted with 2 souls', m1.ferry.board.length >= 1 && (await (await fetch(B + '/api/metrics')).json()).ferry.board[0].souls === 2 && /████/.test(m1.ferry.board[0].who), JSON.stringify(m1.ferry.board[0]));
  const fv = await post('/api/view', { key: (await post('/api/seal', { wallet: F })).viewKey }); ok('seal history shows soul events', fv.hist.some((x) => x.type === 'soul'));
  console.log(fails ? fails + ' FAILED' : 'ALL PASS'); process.exitCode = fails ? 1 : 0;
})();
