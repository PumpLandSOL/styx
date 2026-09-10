// one-shot patch: real USDG deposits, withdrawal queue, THE VIGIL staking, USDG-only mint. Run once from styx/.
const fs = require('fs'); const path = require('path');
const F = path.join(__dirname, '..', 'server', 'index.js'); let s = fs.readFileSync(F, 'utf8');
const rep = (a, b) => { const i = s.indexOf(a); if (i < 0) throw new Error('missing: ' + a.slice(0, 70)); s = s.slice(0, i) + b + s.slice(i + a.length); };

rep("const SEED = { usdg: 10000, styx: 500, susd: 0, priv: 0 };", "const SEED = { usdg: 0, styx: 0, susd: 0, priv: 0 };   // real deposits only — nothing is seeded");

rep("// ---------- privacy primitives (real) ----------", `// ---------- chain: real USDG deposits to TREASURY, verified on-chain ----------
const USDG = { addr: (process.env.USDG_ADDR || '0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168').toLowerCase(), dec: 6 };   // USDG on Robinhood Chain (6 dp)
const RPCS = (process.env.RH_RPCS || 'https://rpc.mainnet.chain.robinhood.com').split(',');
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const CHAIN = { ok: false, block: 0, treasuryUsdg: 0, treasuryStyx: 0, lastRead: 0, errs: 0 };
const hexToNum = (h, dec) => { if (!h || h === '0x') return 0; const bi = BigInt(h); const d = 10n ** BigInt(dec || 18); return Number(bi / d) + Number(bi % d) / Number(d); };
async function rpc(method, params) {
  let err; for (const u of RPCS) { try { const ac = new AbortController(); const tm = setTimeout(() => ac.abort(), 8000);
    const r = await fetch(u, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }), signal: ac.signal }); clearTimeout(tm);
    const j = await r.json(); if (j.error) throw new Error(j.error.message); return j.result; } catch (e) { err = e; CHAIN.errs++; } }
  throw err || new Error('rpc');
}
const balOf = (token, dec, who) => rpc('eth_call', [{ to: token, data: '0x70a08231' + who.slice(2).padStart(64, '0') }, 'latest']).then((r) => hexToNum(r, dec));
async function pollChain() { try { CHAIN.block = Number(BigInt(await rpc('eth_blockNumber', []))); CHAIN.treasuryUsdg = await balOf(USDG.addr, USDG.dec, TREASURY); CHAIN.treasuryStyx = await balOf(STYX_MINT, 18, TREASURY); CHAIN.ok = true; CHAIN.lastRead = Date.now(); } catch (e) { CHAIN.ok = false; } }
setInterval(pollChain, 30000); pollChain();
if (!db.txs) db.txs = {};
if (!db.treasuryIn) db.treasuryIn = { usdg: 0, n: 0 };
async function creditDeposit(w, txHash) {
  if (!/^0x[a-fA-F0-9]{64}$/.test(txHash || '')) throw 'paste the transaction hash';
  txHash = txHash.toLowerCase(); if (db.txs[txHash]) throw 'already credited';
  const [tx, rc] = await Promise.all([rpc('eth_getTransactionByHash', [txHash]), rpc('eth_getTransactionReceipt', [txHash])]);
  if (!tx) throw 'tx not found'; if (!rc) throw 'pending — try again in a few seconds'; if (rc.status !== '0x1') throw 'tx reverted';
  if ((tx.from || '').toLowerCase() !== w) throw 'tx not from your wallet';
  let amt = 0;
  for (const lg of rc.logs || []) {
    if ((lg.address || '').toLowerCase() !== USDG.addr || lg.topics[0] !== TRANSFER_TOPIC) continue;
    const from = '0x' + lg.topics[1].slice(26), to = '0x' + lg.topics[2].slice(26);
    if (from.toLowerCase() === w && to.toLowerCase() === TREASURY.toLowerCase()) amt += hexToNum(lg.data, USDG.dec);
  }
  if (!(amt > 0)) throw 'no USDG transfer to the treasury in this tx';
  const u = W(w); u.usdg += amt; u.deposited = (u.deposited || 0) + amt;
  db.txs[txHash] = { w, amt, block: Number(BigInt(rc.blockNumber)), ts: Date.now() }; db.treasuryIn.usdg += amt; db.treasuryIn.n++; save();
  return { amt, tx: txHash, block: db.txs[txHash].block };
}
// ---------- withdrawals: USDG leaves the ledger into a queue the treasury pays out by hand (no hot key on this server) ----------
if (!db.queue) db.queue = [];
const ADMIN_KEY = process.env.ADMIN_KEY || '';

// ---------- THE VIGIL: temporary sUSD staking, paid in $STYX from a FIXED pre-funded pool. No printing. Hard end. ----------
const VIGIL = {
  apy: +(process.env.VIGIL_APY || 0.40),               // 40% APY, in sUSD terms
  pool: +(process.env.VIGIL_POOL || 5_000_000),         // STYX set aside by the treasury for the whole season
  cap: +(process.env.VIGIL_CAP || 250_000),             // max sUSD staked protocol-wide
  start: +(process.env.VIGIL_START || 1757548800000),   // 2026-09-11 00:00 UTC
  end: +(process.env.VIGIL_END || 1760140800000),       // 2026-10-11 00:00 UTC — 30 days, then it is over
};
if (!db.vigil) db.vigil = { staked: 0, paidStyx: 0, paidUsd: 0, stakers: 0 };
function vigilLive(now) { return now >= VIGIL.start && now < VIGIL.end && db.vigil.paidStyx < VIGIL.pool; }
function accrue(u, now) {   // reward accrues in sUSD terms per second while the vigil is live
  if (!u.stake) return; const t0 = u.stakeT || now; const t1 = Math.min(now, VIGIL.end);
  if (t1 > t0 && vigilLive(t0)) u.stakeAcc = (u.stakeAcc || 0) + u.stake * VIGIL.apy * (t1 - t0) / 31536000000;
  u.stakeT = now;
}
function vigilView(u, now) { accrue(u, now); const px = Math.max(0.000001, db.styxPrice); return { staked: u.stake || 0, accruedUsd: u.stakeAcc || 0, accruedStyx: (u.stakeAcc || 0) / px, since: u.stakeSince || null }; }

// ---------- privacy primitives (real) ----------`);

rep(`      const needUsdg = m * db.cr; const burnStyx = (m * (1 - db.cr)) / db.styxPrice;
      if (w.usdg < needUsdg) return json(res, 200, { error: 'not enough USDG collateral' });
      if (w.styx < burnStyx) return json(res, 200, { error: 'not enough STYX to mint the algorithmic share' });
      w.usdg -= needUsdg; w.styx -= burnStyx; w.susd += m; db.susdSupply += m; db.collateralUsd += needUsdg; db.styxSupply = Math.max(0, db.styxSupply - burnStyx); save();
      return json(res, 200, { ok: true, minted: m, usedUsdg: needUsdg, burnedStyx: burnStyx, ...account(d.wallet) });`,
`      const needUsdg = m * db.cr; const algoUsd = m * (1 - db.cr); const burnStyx = algoUsd / db.styxPrice;
      if (w.usdg < m) return json(res, 200, { error: 'not enough USDG — deposit first' });
      // the algorithmic slice is paid in USDG too: it buys STYX at market and burns it via the pyre (nothing is printed to mint sUSD)
      w.usdg -= m; w.susd += m; db.susdSupply += m; db.collateralUsd += needUsdg; db.styxSupply = Math.max(0, db.styxSupply - burnStyx);
      pyre.tollUsd += algoUsd; save();
      return json(res, 200, { ok: true, minted: m, usedUsdg: needUsdg, algoUsd, burnedStyx: burnStyx, ...account(d.wallet) });`);

rep("    if (u === '/api/redeem') {", `    if (u === '/api/deposit') { try { const r = await creditDeposit(d.wallet.toLowerCase(), d.tx); return json(res, 200, { ok: true, ...r, ...account(d.wallet) }); } catch (e) { return json(res, 200, { error: String(e.message || e) }); } }
    if (u === '/api/withdraw') { // USDG ledger -> payout queue (treasury pays by hand, then marks it paid)
      const x = num(d.amount, w.usdg); if (!x) return json(res, 200, { error: 'nothing to withdraw' }); if (x < 1) return json(res, 200, { error: 'minimum 1 USDG' });
      w.usdg -= x; const q = { id: base58(randomBytes(6)), wallet: d.wallet.toLowerCase(), amt: x, ts: Date.now(), status: 'queued', tx: null }; db.queue.unshift(q); if (db.queue.length > 500) db.queue.pop(); save();
      return json(res, 200, { ok: true, queued: q, ...account(d.wallet) });
    }
    if (u === '/api/admin/paid') { if (!ADMIN_KEY || d.key !== ADMIN_KEY) return json(res, 200, { error: 'no' }); const q = db.queue.find((x) => x.id === d.id); if (!q) return json(res, 200, { error: 'no such item' }); q.status = 'paid'; q.tx = d.tx || null; q.paidTs = Date.now(); save(); return json(res, 200, { ok: true, q }); }
    if (u === '/api/stake') { // sUSD -> the vigil
      const now = Date.now(); if (!vigilLive(now)) return json(res, 200, { error: 'the vigil is not open' });
      const x = num(d.amount, w.susd); if (!x) return json(res, 200, { error: 'nothing to stake' });
      if (db.vigil.staked + x > VIGIL.cap) return json(res, 200, { error: 'the vigil is full — cap ' + VIGIL.cap.toLocaleString() + ' sUSD' });
      accrue(w, now); if (!w.stake) { db.vigil.stakers++; w.stakeSince = now; } w.susd -= x; w.stake = (w.stake || 0) + x; w.stakeT = now; db.vigil.staked += x; save();
      return json(res, 200, { ok: true, staked: x, ...account(d.wallet) });
    }
    if (u === '/api/unstake') { const now = Date.now(); accrue(w, now); const x = num(d.amount, w.stake || 0); if (!x) return json(res, 200, { error: 'nothing staked' });
      const xn = toll('unshield', x); w.stake -= x; w.susd += xn; db.vigil.staked = Math.max(0, db.vigil.staked - x); if (w.stake <= 0) { w.stake = 0; db.vigil.stakers = Math.max(0, db.vigil.stakers - 1); } save();
      return json(res, 200, { ok: true, unstaked: xn, toll: x - xn, ...account(d.wallet) });
    }
    if (u === '/api/claim') { const now = Date.now(); accrue(w, now); const usd = w.stakeAcc || 0; if (usd < 0.01) return json(res, 200, { error: 'nothing to claim yet' });
      const px = Math.max(0.000001, db.styxPrice); let styx = usd / px; const left = VIGIL.pool - db.vigil.paidStyx; if (left <= 0) return json(res, 200, { error: 'the pool is spent — the vigil is over' }); if (styx > left) styx = left;
      w.stakeAcc = 0; w.styx += styx; db.vigil.paidStyx += styx; db.vigil.paidUsd += styx * px; save();
      return json(res, 200, { ok: true, claimedStyx: styx, claimedUsd: styx * px, ...account(d.wallet) });
    }
    if (u === '/api/redeem') {`);

rep("function account(addr) { const w = W(addr); return { wallet: addr, usdg: w.usdg, styx: w.styx, susd: w.susd, priv: w.priv, seeded: !!w.seeded }; }",
  "function account(addr) { const w = W(addr); const now = Date.now(); return { wallet: addr, usdg: w.usdg, styx: w.styx, susd: w.susd, priv: w.priv, deposited: w.deposited || 0, vigil: vigilView(w, now), queue: db.queue.filter((q) => q.wallet === addr.toLowerCase()).slice(0, 10) }; }");

rep("pyre: { tollUsd: pyre.tollUsd,", `chain: { ok: CHAIN.ok, block: CHAIN.block, treasuryUsdg: CHAIN.treasuryUsdg, treasuryStyx: CHAIN.treasuryStyx, lastRead: CHAIN.lastRead, usdg: USDG.addr, rpc: RPCS[0] },
    deposits: { usdg: db.treasuryIn.usdg, n: db.treasuryIn.n }, queue: { open: db.queue.filter((q) => q.status === 'queued').length, openUsd: db.queue.filter((q) => q.status === 'queued').reduce((a, q) => a + q.amt, 0), paid: db.queue.filter((q) => q.status === 'paid').length },
    vigil: { ...VIGIL, live: vigilLive(Date.now()), staked: db.vigil.staked, stakers: db.vigil.stakers, paidStyx: db.vigil.paidStyx, paidUsd: db.vigil.paidUsd, poolLeft: Math.max(0, VIGIL.pool - db.vigil.paidStyx), poolLeftUsd: Math.max(0, VIGIL.pool - db.vigil.paidStyx) * db.styxPrice, endsIn: Math.max(0, VIGIL.end - Date.now()), startsIn: Math.max(0, VIGIL.start - Date.now()) },
    pyre: { tollUsd: pyre.tollUsd,`);

rep("if (!db.wallets) db.wallets = {};", "if (!db.wallets) db.wallets = {};\nif (db.v !== 2) { db.wallets = {}; db.v = 2; }   // v2: real deposits only — the seeded paper ledger is wiped");
rep("function W(a) { return db.wallets[a] ||", "function W(a) { a = a.toLowerCase(); return db.wallets[a] ||");
fs.writeFileSync(F, s); console.log('patched');
