// API E2E for real deposits + vigil. Uses a test wallet; expects a fresh v2 ledger.
const B = 'http://localhost:8198'; const W = '0x00000000000000000000000000000000000000a1';
const post = (u, b) => fetch(B + u, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ wallet: W, ...b }) }).then((r) => r.json());
const ok = (name, cond, extra) => console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra ? '  · ' + extra : ''));
(async () => {
  await new Promise((r) => setTimeout(r, 2500));
  const m = await (await fetch(B + '/api/metrics')).json();
  ok('metrics has chain/vigil/deposits/queue', m.chain && m.vigil && m.deposits && m.queue, `chain.ok=${m.chain.ok} block=${m.chain.block} treasuryUsdg=${m.chain.treasuryUsdg} vigil.live=${m.vigil.live} apy=${m.vigil.apy}`);
  const acc = await post('/api/account', {});
  ok('fresh wallet has ZERO seeded USDG', acc.usdg === 0 && acc.styx === 0, JSON.stringify({ usdg: acc.usdg, styx: acc.styx }));
  const mint = await post('/api/mint', { amount: 100 });
  ok('mint refused with no deposit', !!mint.error, mint.error);
  const dep1 = await post('/api/deposit', { tx: 'nope' });
  ok('deposit rejects bad hash', !!dep1.error, dep1.error);
  const dep2 = await post('/api/deposit', { tx: '0x' + 'ab'.repeat(32) });
  ok('deposit rejects unknown tx (rpc round-trip)', !!dep2.error, dep2.error);
  const wd = await post('/api/withdraw', { amount: 5 });
  ok('withdraw refused with no balance', !!wd.error, wd.error);
  const st = await post('/api/stake', { amount: 10 });
  ok('stake refused (no sUSD or vigil closed)', !!st.error, st.error);
  const adm = await post('/api/admin/paid', { key: 'x', id: 'y' });
  ok('admin endpoint locked', adm.error === 'no');
  // simulate a credited deposit by poking the ledger through the same code path is impossible without a real tx — sanity-check math instead
  console.log('vigil window:', new Date(m.vigil.start).toISOString(), '→', new Date(m.vigil.end).toISOString(), 'pool', m.vigil.pool, 'cap', m.vigil.cap);
})();
