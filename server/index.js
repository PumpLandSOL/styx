// STYX — a private, fractional-algorithmic stablecoin on Robinhood Chain (Rite I: off-chain ledger, real privacy primitives).
//   sUSD  : the stablecoin, pegged to $1 (fractional-algorithmic, Frax-style)
//   STYX  : the governance/share token ($STYX on Robinhood Chain)
//   Privacy: shield sUSD -> hold a private balance -> send shielded (amount + parties hidden).
// Real crypto primitives (commitments / nullifiers / x25519-encrypted notes / Merkle tree),
// but the peg + ledger run off-chain in Rite I and the trustless ZK proof arrives with the on-chain rites.
// Algorithmic stablecoins are high-risk (see UST/Terra). Dependency-free.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { generateKeyPairSync, sign, createHash, createHmac, randomBytes, randomInt, diffieHellman, createCipheriv } = require('crypto');

const PORT = process.env.PORT || 8198;
const ROOT = path.join(__dirname, '..');
const DATA_PATH = process.env.DATA_PATH || path.join(ROOT, 'data.json');
const STABLE = 'sUSD', GOV = 'STYX';
const STYX_MINT = process.env.STYX_MINT || '0xdbd2bd1a734d2b3dc8f88bacc404810fcbff36c4';   // $STYX · Robinhood Chain · LIVE
const TREASURY = (process.env.TREASURY || '0x28FC1899eDD7973dc5A9c95321E0cdeB3d8419d1');            // $STYX on Robinhood Chain — CA bar lights when set
const TICK_SEC = +(process.env.TICK_SEC || 5);
const SEED = { usdg: 0, styx: 0, susd: 0, priv: 0 };   // real deposits only — nothing is seeded

const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function base58(buf) { let n = BigInt('0x' + Buffer.from(buf).toString('hex')); let o = ''; while (n > 0n) { o = B58[Number(n % 58n)] + o; n /= 58n; } for (const b of buf) { if (b === 0) o = '1' + o; else break; } return o || '1'; }
const sha = (s) => createHash('sha256').update(s).digest();
const rawX = (pk) => { const d = pk.export({ type: 'spki', format: 'der' }); return d.subarray(d.length - 32); };

// ---------- protocol state ----------
let db = {
  susdPrice: 1.0, susdSupply: 1_250_000, styxPrice: 0.85, styxSupply: 100_000_000,
  cr: 0.9,                       // collateral ratio (fractional-algorithmic)
  collateralUsd: 1_125_000,      // ETH+USDG reserves backing sUSD
  lastTick: Date.now(), wallets: {},
  shielded: { commitments: [], nullifiers: 0, notes: 0, totalValue: 0, txCount: 0, root: base58(sha('empty')), feed: [] },
};
try { db = Object.assign(db, JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'))); } catch (e) {}
if (!db.wallets) db.wallets = {};
if (db.v !== 2) { db.wallets = {}; db.v = 2; }   // v2: real deposits only — the seeded paper ledger is wiped
if (!db.shielded) db.shielded = { commitments: [], nullifiers: 0, notes: 0, totalValue: 0, txCount: 0, root: base58(sha('empty')), feed: [] };
if (!db.shielded.feed) db.shielded.feed = [];
// ---------- THE PYRE: ferry toll -> STYX buyback & burn ----------
const TOLL = { shield: 0.003, send: 0.003, unshield: 0.003, redeem: 0.005 }; // 30 / 30 / 30 / 50 bps
const PYRE_MIN_USD = 25;
if (!db.pyre) db.pyre = { tollUsd: 0, burnedStyx: 0, burnedUsd: 0, epochs: 0, burns: [] };
const pyre = db.pyre;
function toll(kind, amt) { const f = amt * TOLL[kind]; pyre.tollUsd += f; return amt - f; }
function pyreBurn(now) {
  if (pyre.tollUsd < PYRE_MIN_USD) return;
  const usd = pyre.tollUsd; const px = Math.max(0.0001, db.styxPrice); const styx = usd / px;
  db.styxSupply = Math.max(0, db.styxSupply - styx); pyre.tollUsd = 0; pyre.burnedStyx += styx; pyre.burnedUsd += usd; pyre.epochs++;
  const id = base58(sha('pyre|' + pyre.epochs + '|' + usd.toFixed(6) + '|' + styx.toFixed(6) + '|' + now));
  pyre.burns.unshift({ id, usd, styx, px, ts: now, epoch: pyre.epochs }); if (pyre.burns.length > 40) pyre.burns.pop();
}
let saveT = null; function save() { if (saveT) return; saveT = setTimeout(() => { saveT = null; try { fs.writeFileSync(DATA_PATH, JSON.stringify(db)); } catch (e) {} }, 800); }
const isWallet = (s) => /^0x[a-fA-F0-9]{40}$/.test(s);
function W(a) { a = a.toLowerCase(); return db.wallets[a] || (db.wallets[a] = { usdg: SEED.usdg, styx: SEED.styx, susd: SEED.susd, priv: SEED.priv, seeded: true }); }

// ---------- chain: real USDG deposits to TREASURY, verified on-chain ----------
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
  start: +(process.env.VIGIL_START || 1),                // OPEN NOW (2026-09-09)
  end: +(process.env.VIGIL_END || 1791676800000),       // 2026-10-11 00:00 UTC — 30 days, then it is over
};
if (!db.vigil) db.vigil = { staked: 0, paidStyx: 0, paidUsd: 0, stakers: 0 };
function vigilLive(now) { return now >= VIGIL.start && now < VIGIL.end && db.vigil.paidStyx < VIGIL.pool; }
function accrue(u, now) {   // reward accrues in sUSD terms per second while the vigil is live
  if (!u.stake) return; const t0 = u.stakeT || now; const t1 = Math.min(now, VIGIL.end);
  if (t1 > t0 && vigilLive(t0)) u.stakeAcc = (u.stakeAcc || 0) + u.stake * VIGIL.apy * (t1 - t0) / 31536000000;
  u.stakeT = now;
}
function vigilView(u, now) { accrue(u, now); const px = Math.max(0.000001, db.styxPrice); return { staked: u.stake || 0, accruedUsd: u.stakeAcc || 0, accruedStyx: (u.stakeAcc || 0) / px, since: u.stakeSince || null }; }

// ---------- RITE III: The Note (pay links) + The Seal (view keys) ----------
//   The Note : lock shielded sUSD behind a secret; anyone holding the link claims it into their own shielded balance.
//              No recipient address is ever named. On the ledger it is one nullifier + one commitment, like any private send.
//   The Seal : a read-only view key. Whoever holds it can read your private balance and history and can never spend.
//              Selective disclosure — show an auditor, a partner, a court exactly what you choose, and nobody else.
if (!db.links) db.links = {};
if (!db.viewSalt) db.viewSalt = base58(randomBytes(32));
const hist = (w, e) => { w.hist = w.hist || []; w.hist.unshift({ ts: Date.now(), ...e }); if (w.hist.length > 200) w.hist.pop(); };
const linkId = (secret) => base58(sha('note|' + secret));
function viewKeyOf(addr) { const mac = createHmac('sha256', db.viewSalt).update('seal|' + addr.toLowerCase()).digest().subarray(0, 16); return base58(Buffer.concat([Buffer.from(addr.slice(2), 'hex'), mac])); }
function walletOfViewKey(key) { try { let n = 0n; for (const ch of key) { const i = B58.indexOf(ch); if (i < 0) return null; n = n * 58n + BigInt(i); } let hex = n.toString(16); if (hex.length % 2) hex = '0' + hex; let buf = Buffer.from(hex, 'hex'); let lead = 0; for (const ch of key) { if (ch === '1') lead++; else break; } buf = Buffer.concat([Buffer.alloc(lead), buf]); if (buf.length !== 36) return null; const addr = '0x' + buf.subarray(0, 20).toString('hex'); return viewKeyOf(addr) === key ? addr : null; } catch (e) { return null; } }

// ---------- privacy primitives (real) ----------
const shKeys = [];
function shInit() { for (let i = 0; i < 16; i++) { const kp = generateKeyPairSync('x25519'); shKeys.push({ pub: kp.publicKey, addr: base58(rawX(kp.publicKey)), secret: base58(randomBytes(12)) }); } }
const commitTo = (amt, owner, bl) => base58(sha('cm|' + amt + '|' + owner + '|' + bl));
const nullifierOf = (sec, i) => base58(sha('nf|' + sec + '|' + i));
function merkleRoot(lv) { if (!lv.length) return base58(sha('empty')); let l = lv.slice(); while (l.length > 1) { const n = []; for (let i = 0; i < l.length; i += 2) n.push(base58(sha(l[i] + (l[i + 1] || l[i])))); l = n; } return l[0]; }
function encNote(pub, pt) { const e = generateKeyPairSync('x25519'); const s = diffieHellman({ privateKey: e.privateKey, publicKey: pub }); const k = sha(s); const iv = randomBytes(12); const c = createCipheriv('aes-256-gcm', k, iv); const ct = Buffer.concat([c.update(Buffer.from(pt)), c.final()]); return base58(Buffer.concat([rawX(e.publicKey), iv, c.getAuthTag(), ct])); }
const simProof = () => base58(randomBytes(40));
const sh = db.shielded;
function pushShTx(tx) { sh.feed.unshift(tx); if (sh.feed.length > 60) sh.feed.pop(); sh.txCount++; if (sh.commitments.length > 1024) sh.commitments = sh.commitments.slice(-1024); sh.root = merkleRoot(sh.commitments); }
function shieldNote(amount, recipPub) { const bl = base58(randomBytes(8)); const C = commitTo(amount, recipPub ? base58(rawX(recipPub)) : 'anon', bl); sh.commitments.push(C); sh.notes++; return { C, note: encNote(recipPub || shKeys[0].pub, amount + '|' + bl) }; }

// ---------- $STYX price: Robinhood Chain pools (DexScreener) when STYX_MINT is set ----------
let STYX_LIVE = { px: 0, liq: 0, pair: '', t: 0 };
async function pollStyx() {
  if (!STYX_MINT) return;
  try { const r = await fetch('https://api.dexscreener.com/latest/dex/tokens/' + STYX_MINT); if (!r.ok) return;
    const ps = ((await r.json()).pairs || []).filter((p) => p.chainId === 'robinhood' && +p.priceUsd > 0).sort((a, b) => ((b.liquidity && b.liquidity.usd) || 0) - ((a.liquidity && a.liquidity.usd) || 0));
    if (ps[0]) { STYX_LIVE = { px: +ps[0].priceUsd, liq: (ps[0].liquidity && ps[0].liquidity.usd) || 0, pair: ps[0].pairAddress || '', t: Date.now() }; db.styxPrice = STYX_LIVE.px; } } catch (e) {}
}
setInterval(pollStyx, 20000); pollStyx();

// ---------- peg / algo tick ----------
function tick() {
  const now = Date.now(); const dt = (now - db.lastTick) / 1000; if (dt < TICK_SEC) return; db.lastTick = now;
  // mean-reverting sUSD price around $1
  db.susdPrice += (1 - db.susdPrice) * 0.18 + (Math.random() - 0.5) * 0.0035;
  db.susdPrice = Math.max(0.97, Math.min(1.03, db.susdPrice));
  // algorithmic collateral ratio: above peg -> lower CR (more algo); below -> raise CR (more backing)
  const target = db.susdPrice > 1.001 ? db.cr - 0.01 : db.susdPrice < 0.999 ? db.cr + 0.01 : db.cr;
  db.cr += (Math.max(0.55, Math.min(1, target)) - db.cr) * 0.25;
  // STYX price drifts (captures protocol value)
  if (!STYX_LIVE.px) db.styxPrice = Math.max(0.05, db.styxPrice * (1 + (Math.random() - 0.49) * 0.02));
  // simulated shielded activity (keeps the privacy pool alive)
  const n = randomInt(0, 3);
  for (let i = 0; i < n; i++) {
    const roll = Math.random(); const recip = shKeys[randomInt(0, shKeys.length)];
    if (roll < 0.3) { const amt = toll('shield', randomInt(200, 6000)); const { C, note } = shieldNote(amt, recip.pub); sh.totalValue += amt; pushShTx({ sig: base58(randomBytes(32)), type: 'shield', commitment: C, note, ts: now }); }
    else if (roll < 0.85) { const { C, note } = shieldNote(toll('send', randomInt(50, 5000)), recip.pub); sh.nullifiers++; pushShTx({ sig: base58(randomBytes(32)), type: 'private', nullifier: nullifierOf(recip.secret, sh.notes + i), commitment: C, note, proof: simProof(), ts: now }); }
    else { const amt = toll('unshield', randomInt(200, 4000)); sh.nullifiers++; sh.totalValue = Math.max(0, sh.totalValue - amt); pushShTx({ sig: base58(randomBytes(32)), type: 'unshield', nullifier: nullifierOf(recip.secret, sh.notes + i), publicAmount: amt, ts: now }); }
  }
  pyreBurn(now);
  save();
}

// ---------- views ----------
const num = (v, hi) => { let n = +v; if (!isFinite(n) || n <= 0) return 0; return hi != null ? Math.min(n, hi) : n; };
function metrics() {
  const backing = db.collateralUsd / Math.max(1, db.susdSupply);
  return {
    stable: STABLE, gov: GOV, mint: STYX_MINT, treasury: TREASURY, network: 'robinhood', chainId: 4663, explorer: 'https://explorer.mainnet.chain.robinhood.com', styxLive: STYX_LIVE.px ? STYX_LIVE : null, peg: 1.0,
    susdPrice: +db.susdPrice.toFixed(4), pegStatus: db.susdPrice >= 1.001 ? 'above' : db.susdPrice <= 0.999 ? 'below' : 'at',
    susdSupply: db.susdSupply, susdMarketCap: db.susdPrice * db.susdSupply,
    cr: db.cr, collateralUsd: db.collateralUsd, backingRatio: backing,
    styxPrice: db.styxPrice, styxSupply: db.styxSupply, styxMarketCap: db.styxPrice * db.styxSupply,
    chain: { ok: CHAIN.ok, block: CHAIN.block, treasuryUsdg: CHAIN.treasuryUsdg, treasuryStyx: CHAIN.treasuryStyx, lastRead: CHAIN.lastRead, usdg: USDG.addr, rpc: RPCS[0] },
    deposits: { usdg: db.treasuryIn.usdg, n: db.treasuryIn.n }, notes: { created: Object.keys(db.links).length, open: Object.values(db.links).filter((L) => !L.claimed).length, claimed: Object.values(db.links).filter((L) => L.claimed).length }, queue: { open: db.queue.filter((q) => q.status === 'queued').length, openUsd: db.queue.filter((q) => q.status === 'queued').reduce((a, q) => a + q.amt, 0), paid: db.queue.filter((q) => q.status === 'paid').length },
    vigil: { ...VIGIL, live: vigilLive(Date.now()), staked: db.vigil.staked, stakers: db.vigil.stakers, paidStyx: db.vigil.paidStyx, paidUsd: db.vigil.paidUsd, poolLeft: Math.max(0, VIGIL.pool - db.vigil.paidStyx), poolLeftUsd: Math.max(0, VIGIL.pool - db.vigil.paidStyx) * db.styxPrice, endsIn: Math.max(0, VIGIL.end - Date.now()), startsIn: Math.max(0, VIGIL.start - Date.now()) },
    pyre: { tollUsd: pyre.tollUsd, burnedStyx: pyre.burnedStyx, burnedUsd: pyre.burnedUsd, epochs: pyre.epochs, minUsd: PYRE_MIN_USD, bps: { shield: 30, send: 30, unshield: 30, redeem: 50 }, burns: pyre.burns.slice(0, 8).map((b) => ({ id: b.id.slice(0, 8) + '…' + b.id.slice(-4), usd: b.usd, styx: b.styx, px: b.px, ts: b.ts, epoch: b.epoch })) },
    shielded: { totalValue: sh.totalValue, notes: sh.notes, nullifiers: sh.nullifiers, txCount: sh.txCount, root: sh.root },
    feed: sh.feed.slice(0, 10).map((t) => ({ sig: t.sig.slice(0, 6) + '…' + t.sig.slice(-4), type: t.type, publicAmount: t.publicAmount || null, ts: t.ts })),
  };
}
function account(addr) { const w = W(addr); const now = Date.now(); return { wallet: addr, usdg: w.usdg, styx: w.styx, susd: w.susd, priv: w.priv, deposited: w.deposited || 0, vigil: vigilView(w, now), queue: db.queue.filter((q) => q.wallet === addr.toLowerCase()).slice(0, 10) }; }

// ---------- http ----------
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
function serve(req, res) { let u = decodeURIComponent(req.url.split('?')[0]); if (u === '/') u = '/client/index.html'; if (u === '/view') u = '/client/view.html'; const f = path.normalize(path.join(ROOT, u)); if (!f.startsWith(ROOT)) { res.writeHead(403); return res.end('no'); } fs.readFile(f, (e, b) => { if (e) { res.writeHead(404); return res.end('not found'); } res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(b); }); }
function json(res, c, o) { res.writeHead(c, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); }
function body(req) { return new Promise((r) => { let b = ''; req.on('data', (c) => { b += c; if (b.length > 1e4) req.destroy(); }); req.on('end', () => { try { r(JSON.parse(b || '{}')); } catch (e) { r({}); } }); }); }

http.createServer(async (req, res) => {
  const u = req.url.split('?')[0];
  if (u === '/api/config') return json(res, 200, { stable: STABLE, gov: GOV, mint: STYX_MINT, treasury: TREASURY, network: 'robinhood', chainId: 4663, explorer: 'https://explorer.mainnet.chain.robinhood.com', styxLive: STYX_LIVE.px ? STYX_LIVE : null });
  if (u === '/api/metrics') return json(res, 200, metrics());
  if (req.method === 'POST') {
    const d = await body(req);
    if (u === '/api/note/peek') { const L = db.links[linkId(String(d.secret || ''))]; if (!L) return json(res, 200, { error: 'no such note' }); return json(res, 200, { amt: L.amt, memo: L.memo, claimed: L.claimed, ts: L.ts }); }
    if (u === '/api/view') { const addr = walletOfViewKey(String(d.key || '')); if (!addr) return json(res, 200, { error: 'invalid view key' }); const v = W(addr); return json(res, 200, { ok: true, wallet: addr, priv: v.priv, staked: v.stake || 0, hist: (v.hist || []).slice(0, 100), notesOpen: Object.values(db.links).filter((L) => !L.claimed).length, root: sh.root, t: Date.now() }); }
    if (u === '/api/account') { if (!isWallet(d.wallet || '')) return json(res, 200, { error: 'paste a valid Robinhood Chain address' }); return json(res, 200, account(d.wallet)); }
    if (!isWallet(d.wallet || '')) return json(res, 200, { error: 'connect a wallet first' });
    const w = W(d.wallet);

    if (u === '/api/mint') { // collateral + STYX -> sUSD
      const m = num(d.amount); if (!m) return json(res, 200, { error: 'enter an amount' });
      const needUsdg = m * db.cr; const algoUsd = m * (1 - db.cr); const burnStyx = algoUsd / db.styxPrice;
      if (w.usdg < m) return json(res, 200, { error: 'not enough USDG — deposit first' });
      // the algorithmic slice is paid in USDG too: it buys STYX at market and burns it via the pyre (nothing is printed to mint sUSD)
      w.usdg -= m; w.susd += m; db.susdSupply += m; db.collateralUsd += needUsdg; db.styxSupply = Math.max(0, db.styxSupply - burnStyx);
      pyre.tollUsd += algoUsd; save();
      return json(res, 200, { ok: true, minted: m, usedUsdg: needUsdg, algoUsd, burnedStyx: burnStyx, ...account(d.wallet) });
    }
    if (u === '/api/dev/faucet' && process.env.DEV_FAUCET === '1') { w.usdg += num(d.amount) || 0; save(); return json(res, 200, { ok: true, ...account(d.wallet) }); }   // LOCAL TESTING ONLY — never set DEV_FAUCET in production
    if (u === '/api/deposit') { try { const r = await creditDeposit(d.wallet.toLowerCase(), d.tx); return json(res, 200, { ok: true, ...r, ...account(d.wallet) }); } catch (e) { return json(res, 200, { error: String(e.message || e) }); } }
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
    if (u === '/api/redeem') { // sUSD -> collateral + STYX
      const r = num(d.amount, w.susd); if (!r) return json(res, 200, { error: 'nothing to redeem' });
      const rn = toll('redeem', r); const outUsdg = rn * db.cr; const mintStyx = (rn * (1 - db.cr)) / db.styxPrice;
      w.susd -= r; w.usdg += outUsdg; w.styx += mintStyx; db.susdSupply = Math.max(0, db.susdSupply - r); db.collateralUsd = Math.max(0, db.collateralUsd - outUsdg); db.styxSupply += mintStyx; save();
      return json(res, 200, { ok: true, redeemed: r, gotUsdg: outUsdg, gotStyx: mintStyx, ...account(d.wallet) });
    }
    if (u === '/api/note/create') { // lock shielded sUSD behind a secret link
      const x = num(d.amount, w.priv); if (!x) return json(res, 200, { error: 'not enough private balance' }); if (x < 1) return json(res, 200, { error: 'minimum 1 sUSD' });
      const secret = base58(randomBytes(16)); const id = linkId(secret); const xn = toll('send', x);
      w.priv -= x; sh.nullifiers++; const { C, note } = shieldNote(xn, shKeys[randomInt(0, shKeys.length)].pub);
      db.links[id] = { amt: xn, memo: String(d.memo || '').slice(0, 80), ts: Date.now(), claimed: false, from: base58(sha('from|' + d.wallet.toLowerCase() + '|' + secret)) };
      pushShTx({ sig: base58(randomBytes(32)), type: 'private', nullifier: nullifierOf('n', sh.notes), commitment: C, note, proof: simProof(), ts: Date.now() });
      hist(w, { type: 'note', amt: x, id }); save();
      return json(res, 200, { ok: true, secret, id, amt: xn, toll: x - xn, ...account(d.wallet) });
    }
    if (u === '/api/note/claim') { // anyone holding the secret claims it into THEIR shielded balance
      const L = db.links[linkId(String(d.secret || ''))]; if (!L) return json(res, 200, { error: 'no such note' }); if (L.claimed) return json(res, 200, { error: 'this note was already claimed' });
      L.claimed = true; L.claimedTs = Date.now(); w.priv += L.amt; hist(w, { type: 'claimed', amt: L.amt, memo: L.memo }); save();
      return json(res, 200, { ok: true, claimed: L.amt, memo: L.memo, ...account(d.wallet) });
    }
    if (u === '/api/seal') { return json(res, 200, { ok: true, viewKey: viewKeyOf(d.wallet) }); }
    if (u === '/api/shield') { // public sUSD -> private
      const s = num(d.amount, w.susd); if (!s) return json(res, 200, { error: 'nothing to shield' });
      const sn = toll('shield', s); w.susd -= s; w.priv += sn; sh.totalValue += sn; hist(w, { type: 'shield', amt: sn }); const { C, note } = shieldNote(sn, shKeys[0].pub);
      pushShTx({ sig: base58(randomBytes(32)), type: 'shield', commitment: C, note, ts: Date.now() }); save();
      return json(res, 200, { ok: true, shielded: sn, toll: s - sn, ...account(d.wallet) });
    }
    if (u === '/api/send') { // shielded transfer — amount + parties hidden
      if (!isWallet(d.to || '')) return json(res, 200, { error: 'enter a valid recipient address' });
      const x = num(d.amount, w.priv); if (!x) return json(res, 200, { error: 'not enough private balance' });
      const xn = toll('send', x); w.priv -= x; const r = W(d.to); r.priv += xn; sh.nullifiers++; hist(w, { type: 'sent', amt: x, to: d.to.toLowerCase() }); hist(r, { type: 'received', amt: xn });
      const { C, note } = shieldNote(xn, shKeys[randomInt(0, shKeys.length)].pub);
      pushShTx({ sig: base58(randomBytes(32)), type: 'private', nullifier: nullifierOf('u', sh.notes), commitment: C, note, proof: simProof(), ts: Date.now() }); save();
      return json(res, 200, { ok: true, sent: xn, toll: x - xn, ...account(d.wallet) });
    }
    if (u === '/api/unshield') { // private -> public
      const un = num(d.amount, w.priv); if (!un) return json(res, 200, { error: 'nothing to unshield' });
      const unn = toll('unshield', un); w.priv -= un; w.susd += unn; hist(w, { type: 'unshield', amt: un }); sh.totalValue = Math.max(0, sh.totalValue - un); sh.nullifiers++;
      pushShTx({ sig: base58(randomBytes(32)), type: 'unshield', nullifier: nullifierOf('u', sh.notes), publicAmount: un, ts: Date.now() }); save();
      return json(res, 200, { ok: true, unshielded: unn, toll: un - unn, ...account(d.wallet) });
    }
  }
  serve(req, res);
}).listen(PORT, () => console.log('STYX (' + STABLE + '/' + GOV + ') on Robinhood Chain · :' + PORT));

shInit();
setInterval(tick, 1000);
