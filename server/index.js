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
const FERRY_CUT = +(process.env.FERRY_CUT || 0.20);   // share of every toll that goes to the wallet who brought the payer across
function toll(kind, amt, w) {
  const f = amt * TOLL[kind]; let cut = 0;
  if (w && w.ref && db.wallets[w.ref]) { cut = f * FERRY_CUT; const fm = db.wallets[w.ref]; fm.susd += cut; fm.earned = (fm.earned || 0) + cut; db.ferry.paid += cut; }
  pyre.tollUsd += f - cut; return amt - f;
}
if (!db.ferry) db.ferry = { paid: 0, souls: 0 };
function bind(w, addr, refAddr) { refAddr = (refAddr || '').toLowerCase(); if (w.ref || !isWallet(refAddr) || refAddr === addr) return false; const fm = W(refAddr); w.ref = refAddr; w.refTs = Date.now(); fm.souls = (fm.souls || 0) + 1; db.ferry.souls++; hist(fm, { type: 'soul', amt: 0, to: addr }); return true; }
const redact = (addr) => addr.slice(0, 4) + '████' + addr.slice(-4);
function ferrymen() { return Object.entries(db.wallets).filter(([, x]) => (x.souls || 0) > 0).map(([addr, x]) => ({ who: redact(addr), souls: x.souls || 0, earned: x.earned || 0 })).sort((p, q) => q.souls - p.souls || q.earned - p.earned).slice(0, 10); }
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
const MIN_DEPOSIT = +(process.env.MIN_DEPOSIT || 50);   // USDG — smaller transfers are NOT credited
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
  if (amt < MIN_DEPOSIT) throw 'minimum deposit is ' + MIN_DEPOSIT + ' USDG — this transfer (' + amt.toFixed(2) + ') is not credited';
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
const VIGIL_BOOST = { apy: +(process.env.VIGIL_BOOST_APY || 1.00), end: +(process.env.VIGIL_BOOST_END || 1789603200000) };   // 100% APY through 2026-09-17, then back to VIGIL.apy
const vigilApy = (now) => now < VIGIL_BOOST.end ? VIGIL_BOOST.apy : VIGIL.apy;
function vigilLive(now) { return now >= VIGIL.start && now < VIGIL.end && db.vigil.paidStyx < VIGIL.pool; }
function accrue(u, now) {   // reward accrues in sUSD terms per second while the vigil is live
  if (!u.stake) return; const t0 = u.stakeT || now; const t1 = Math.min(now, VIGIL.end);
  if (t1 > t0 && vigilLive(t0)) u.stakeAcc = (u.stakeAcc || 0) + u.stake * vigilApy(t0) * (t1 - t0) / 31536000000;
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

// ---------- BONDS: USDG in, discounted $STYX out, vested. The USDG stays in reserve and mints NOTHING, so every bond over-collateralizes sUSD. ----------
const BOND = {
  discount: +(process.env.BOND_DISCOUNT || 0.20),          // 20% below market
  vestMs: +(process.env.BOND_VEST_DAYS || 5) * 864e5,      // linear vest
  capUsd: +(process.env.BOND_CAP_USD || 5000),             // per-day capacity
  end: +(process.env.BOND_END || 1791676800000),  // same close as the vigil
  // THE FORGE: lock the bond. Deeper discount, hard 48-hour lock, and the locked STYX earns APY in STYX paid from the Vigil pool (fixed, no printing).
  lockDiscount: +(process.env.FORGE_DISCOUNT || 0.30), lockMs: +(process.env.FORGE_LOCK_DAYS || 2) * 864e5, lockApy: +(process.env.FORGE_APY || 0.80),
  min: 50,
};
if (!db.bonds) db.bonds = { soldUsd: 0, soldStyx: 0, n: 0, day: 0, dayUsd: 0 };
if (!db.forge) db.forge = { lockedStyx: 0, usd: 0, n: 0, yieldStyx: 0 };
const forgePrice = () => Math.max(0.000001, db.styxPrice) * (1 - BOND.lockDiscount);
const forgeYield = (b, now) => b.lock ? b.styx * BOND.lockApy * (Math.min(now, b.ts + BOND.lockMs) - b.ts) / 31536000000 : 0;
function bondDay() { const d = Math.floor(Date.now() / 864e5); if (db.bonds.day !== d) { db.bonds.day = d; db.bonds.dayUsd = 0; } return db.bonds; }
const bondPrice = () => Math.max(0.000001, db.styxPrice) * (1 - BOND.discount);
function bondView(u, now) { const list = (u.bonds || []).map((b) => { const len = b.lock ? BOND.lockMs : BOND.vestMs; let k = Math.min(1, Math.max(0, (now - b.ts) / len)); if (b.lock && k < 1) k = 0; const vested = b.styx * k; const y = forgeYield(b, now); return { id: b.id, usd: b.usd, styx: b.styx, price: b.price, ts: b.ts, lock: !!b.lock, vestEnd: b.ts + len, vested, yieldStyx: y, claimable: Math.max(0, vested - b.claimed) + (b.lock && k >= 1 && !b.yieldPaid ? y : 0), claimed: b.claimed }; }); return { list, claimable: list.reduce((x, b) => x + b.claimable, 0), pending: list.reduce((x, b) => x + (b.styx - b.claimed), 0), locked: list.filter((b) => b.lock && b.claimed < b.styx).reduce((x, b) => x + b.styx, 0), forging: list.filter((b) => b.lock && b.claimed < b.styx).reduce((x, b) => x + b.yieldStyx, 0) }; }

// ---------- THE DARK POOL: shielded 1x exposure to tokenized stocks, priced off the exchange tape, settled in shielded sUSD ----------
//   Ticker, size, side and P&L live inside the shield. The ledger sees one nullifier + one commitment per open/close, same as any private send.
//   No leverage. Position and open-interest caps. Tape must be fresh (< 15 min) or the market is closed to new trades. Shorts are capped at 95% loss.
const YF = 'https://query1.finance.yahoo.com/v8/finance/chart/';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128 Safari/537.36';
const DARK_FEED = { HOOD: 'HOOD', TSLA: 'TSLA', NVDA: 'NVDA', AAPL: 'AAPL', SPY: 'SPY', COIN: 'COIN', MSTR: 'MSTR', GLD: 'GLD', BTC: 'BTC-USD', ETH: 'ETH-USD' };
const DARK = { fee: +(process.env.DARK_FEE || 0.003), maxPos: +(process.env.DARK_MAX_POS || 1000), maxOi: +(process.env.DARK_MAX_OI || 25000), fresh: 15 * 60e3, liq: 0.95 };
const TAPE = {};   // sym -> { px, ts, at }
async function pollTape() {
  for (const [sym, q] of Object.entries(DARK_FEED)) {
    try { const ac = new AbortController(); const tm = setTimeout(() => ac.abort(), 9000);
      const r = await fetch(YF + encodeURIComponent(q) + '?range=1d&interval=1m&includePrePost=true', { headers: { accept: 'application/json', 'user-agent': UA }, signal: ac.signal }); clearTimeout(tm); if (!r.ok) continue;
      const res = (await r.json()).chart.result[0]; const m = res.meta; let v = +m.regularMarketPrice, ts = m.regularMarketTime * 1000;
      const T = res.timestamp || [], C = (res.indicators.quote[0] && res.indicators.quote[0].close) || [];
      for (let i = C.length - 1; i >= 0; i--) if (C[i] != null && T[i] * 1000 > ts) { v = +C[i]; ts = T[i] * 1000; break; }
      if (v > 0) TAPE[sym] = { px: v, ts, at: Date.now() };
    } catch (e) {}
    await new Promise((r) => setTimeout(r, 100));
  }
  markDark();
}
setInterval(pollTape, 30000); pollTape();
const tapeFresh = (sym) => { const t = TAPE[sym]; return !!t && (Date.now() - t.ts) < DARK.fresh; };
if (!db.dark) db.dark = { oi: 0, open: 0, opened: 0, closed: 0, volume: 0, fees: 0, housePnl: 0, liqs: 0 };
const posPnl = (p, px) => p.side === 'long' ? p.notional * (px - p.entry) / p.entry : p.notional * (p.entry - px) / p.entry;
function closePos(w, p, px, why) {   // settle into the shield
  let pnl = posPnl(p, px); if (pnl < -p.notional * DARK.liq) pnl = -p.notional * DARK.liq;
  const fee = p.notional * DARK.fee; const back = Math.max(0, p.notional + pnl - fee);
  w.priv += back; pyre.tollUsd += fee; db.dark.fees += fee; db.dark.housePnl -= pnl; db.dark.oi = Math.max(0, db.dark.oi - p.notional); db.dark.open = Math.max(0, db.dark.open - 1); db.dark.closed++; if (why === 'liq') db.dark.liqs++;
  w.dark = (w.dark || []).filter((x) => x.id !== p.id); hist(w, { type: 'dark-close', amt: back, memo: p.sym + ' ' + p.side + ' · ' + (pnl >= 0 ? '+' : '') + pnl.toFixed(2) });
  sh.nullifiers++; const { C, note } = shieldNote(back, shKeys[randomInt(0, shKeys.length)].pub); pushShTx({ sig: base58(randomBytes(32)), type: 'private', nullifier: nullifierOf('d', sh.notes), commitment: C, note, proof: simProof(), ts: Date.now() });
  return { pnl, fee, back };
}
function markDark() {   // auto-close anything past the loss cap
  for (const [addr, w] of Object.entries(db.wallets)) for (const p of (w.dark || []).slice()) { const t = TAPE[p.sym]; if (!t) continue; if (posPnl(p, t.px) <= -p.notional * DARK.liq) closePos(w, p, t.px, 'liq'); }
}
function darkView(u) { return (u.dark || []).map((p) => { const t = TAPE[p.sym]; const px = t ? t.px : p.entry; const pnl = Math.max(-p.notional * DARK.liq, posPnl(p, px)); return { ...p, px, pnl, fresh: tapeFresh(p.sym) }; }); }

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
    minDeposit: MIN_DEPOSIT, chain: { ok: CHAIN.ok, block: CHAIN.block, treasuryUsdg: CHAIN.treasuryUsdg, treasuryStyx: CHAIN.treasuryStyx, lastRead: CHAIN.lastRead, usdg: USDG.addr, rpc: RPCS[0] },
    deposits: { usdg: db.treasuryIn.usdg, n: db.treasuryIn.n }, dark: { markets: Object.keys(DARK_FEED).map((sym) => ({ sym, px: TAPE[sym] ? TAPE[sym].px : null, ts: TAPE[sym] ? TAPE[sym].ts : null, fresh: tapeFresh(sym) })), open: db.dark.open, opened: db.dark.opened, closed: db.dark.closed, volume: db.dark.volume, fees: db.dark.fees, liqs: db.dark.liqs, fee: DARK.fee, maxPos: DARK.maxPos, maxOi: DARK.maxOi, full: db.dark.oi >= DARK.maxOi }, bonds: (() => { const B = bondDay(); return { discount: BOND.discount, vestDays: BOND.vestMs / 864e5, capUsd: BOND.capUsd, leftToday: Math.max(0, BOND.capUsd - B.dayUsd), soldUsd: B.soldUsd, soldStyx: B.soldStyx, n: B.n, price: bondPrice(), market: db.styxPrice, end: BOND.end, open: Date.now() <= BOND.end, min: BOND.min, forge: { discount: BOND.lockDiscount, lockDays: BOND.lockMs / 864e5, apy: BOND.lockApy, price: forgePrice(), lockedStyx: db.forge.lockedStyx, usd: db.forge.usd, n: db.forge.n, yieldStyx: db.forge.yieldStyx } }; })(), ferry: { cut: FERRY_CUT, souls: db.ferry.souls, paid: db.ferry.paid, board: ferrymen() }, notes: { created: Object.keys(db.links).length, open: Object.values(db.links).filter((L) => !L.claimed).length, claimed: Object.values(db.links).filter((L) => L.claimed).length }, queue: { open: db.queue.filter((q) => q.status === 'queued').length, openUsd: db.queue.filter((q) => q.status === 'queued').reduce((a, q) => a + q.amt, 0), paid: db.queue.filter((q) => q.status === 'paid').length },
    vigil: { ...VIGIL, apy: vigilApy(Date.now()), baseApy: VIGIL.apy, boost: { apy: VIGIL_BOOST.apy, end: VIGIL_BOOST.end, live: Date.now() < VIGIL_BOOST.end, endsIn: Math.max(0, VIGIL_BOOST.end - Date.now()) }, live: vigilLive(Date.now()), staked: db.vigil.staked, stakers: db.vigil.stakers, paidStyx: db.vigil.paidStyx, paidUsd: db.vigil.paidUsd, poolLeft: Math.max(0, VIGIL.pool - db.vigil.paidStyx), poolLeftUsd: Math.max(0, VIGIL.pool - db.vigil.paidStyx) * db.styxPrice, endsIn: Math.max(0, VIGIL.end - Date.now()), startsIn: Math.max(0, VIGIL.start - Date.now()) },
    pyre: { tollUsd: pyre.tollUsd, burnedStyx: pyre.burnedStyx, burnedUsd: pyre.burnedUsd, epochs: pyre.epochs, minUsd: PYRE_MIN_USD, bps: { shield: 30, send: 30, unshield: 30, redeem: 50 }, burns: pyre.burns.slice(0, 8).map((b) => ({ id: b.id.slice(0, 8) + '…' + b.id.slice(-4), usd: b.usd, styx: b.styx, px: b.px, ts: b.ts, epoch: b.epoch })) },
    shielded: { totalValue: sh.totalValue, notes: sh.notes, nullifiers: sh.nullifiers, txCount: sh.txCount, root: sh.root },
    feed: sh.feed.slice(0, 10).map((t) => ({ sig: t.sig.slice(0, 6) + '…' + t.sig.slice(-4), type: t.type, publicAmount: t.publicAmount || null, ts: t.ts })),
  };
}
function account(addr) { const w = W(addr); const now = Date.now(); return { wallet: addr, usdg: w.usdg, styx: w.styx, susd: w.susd, priv: w.priv, deposited: w.deposited || 0, dark: darkView(w), bonds: bondView(w, now), ref: w.ref || null, souls: w.souls || 0, earned: w.earned || 0, vigil: vigilView(w, now), queue: db.queue.filter((q) => q.wallet === addr.toLowerCase()).slice(0, 10) }; }

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
    if (u === '/api/account') { if (!isWallet(d.wallet || '')) return json(res, 200, { error: 'paste a valid Robinhood Chain address' }); const aw = W(d.wallet); if (d.ref) { const fresh = !(aw.deposited || 0) && !(aw.hist || []).length; if (fresh && bind(aw, d.wallet.toLowerCase(), d.ref)) save(); } return json(res, 200, account(d.wallet)); }
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
    if (u === '/api/bond') { // USDG ledger -> discounted STYX, vested. USDG stays in reserve. Nothing minted.
      const now = Date.now(); if (now > BOND.end) return json(res, 200, { error: 'bonds are closed' });
      const x = num(d.amount, w.usdg); if (!x) return json(res, 200, { error: 'not enough USDG — deposit first' }); if (x < BOND.min) return json(res, 200, { error: 'minimum bond is ' + BOND.min + ' USDG' });
      const B = bondDay(); if (B.dayUsd + x > BOND.capUsd) return json(res, 200, { error: 'today\'s bond capacity is spent — ' + (BOND.capUsd - B.dayUsd).toFixed(2) + ' USDG left' });
      const lock = !!d.lock; const price = lock ? forgePrice() : bondPrice(); const styx = x / price;
      w.usdg -= x; db.collateralUsd += x; B.dayUsd += x; B.soldUsd += x; B.soldStyx += styx; B.n++; if (lock) { db.forge.lockedStyx += styx; db.forge.usd += x; db.forge.n++; }
      w.bonds = w.bonds || []; w.bonds.push({ id: base58(randomBytes(6)), usd: x, styx, price, ts: now, claimed: 0, lock }); hist(w, { type: lock ? 'forge' : 'bond', amt: x }); save();
      return json(res, 200, { ok: true, bonded: x, styxOut: styx, price, market: db.styxPrice, lock, unlockAt: lock ? now + BOND.lockMs : now + BOND.vestMs, apy: lock ? BOND.lockApy : 0, ...account(d.wallet) });
    }
    if (u === '/api/bond/claim') { const now = Date.now(); let got = 0, forged = 0; for (const b of w.bonds || []) { if (b.lock) { if (now < b.ts + BOND.lockMs) continue; const c = b.styx - b.claimed; if (c > 0) { b.claimed = b.styx; got += c; db.forge.lockedStyx = Math.max(0, db.forge.lockedStyx - c); } if (!b.yieldPaid) { let y = forgeYield(b, now); const left = VIGIL.pool - db.vigil.paidStyx; if (y > left) y = Math.max(0, left); b.yieldPaid = true; forged += y; db.vigil.paidStyx += y; db.vigil.paidUsd += y * db.styxPrice; db.forge.yieldStyx += y; } continue; } const k = Math.min(1, (now - b.ts) / BOND.vestMs); const c = Math.max(0, b.styx * k - b.claimed); b.claimed += c; got += c; } if (got + forged < 1e-9) return json(res, 200, { error: 'nothing vested or unlocked yet' }); w.styx += got + forged; save(); return json(res, 200, { ok: true, claimedStyx: got + forged, forgedStyx: forged, ...account(d.wallet) }); }
    if (u === '/api/withdraw') { // ledger -> payout queue (treasury pays by hand, then marks it paid). asset: USDG (default) or STYX
      const asset = d.asset === 'STYX' ? 'STYX' : 'USDG';
      const x = num(d.amount, asset === 'STYX' ? w.styx : w.usdg); if (!x) return json(res, 200, { error: 'nothing to withdraw' }); if (asset === 'USDG' && x < 1) return json(res, 200, { error: 'minimum 1 USDG' });
      if (asset === 'STYX') w.styx -= x; else w.usdg -= x;
      const q = { id: base58(randomBytes(6)), wallet: d.wallet.toLowerCase(), amt: x, asset, ts: Date.now(), status: 'queued', tx: null }; db.queue.unshift(q); if (db.queue.length > 500) db.queue.pop(); save();
      return json(res, 200, { ok: true, queued: q, ...account(d.wallet) });
    }
    if (u === '/api/admin/queue') { if (!ADMIN_KEY || d.key !== ADMIN_KEY) return json(res, 200, { error: 'no' }); return json(res, 200, { ok: true, queue: db.queue.slice(0, 100), deposits: Object.entries(db.txs).map(([tx, t]) => ({ tx, ...t })).slice(-50) }); }
    if (u === '/api/admin/paid') { if (!ADMIN_KEY || d.key !== ADMIN_KEY) return json(res, 200, { error: 'no' }); const q = db.queue.find((x) => x.id === d.id); if (!q) return json(res, 200, { error: 'no such item' }); q.status = 'paid'; q.tx = d.tx || null; q.paidTs = Date.now(); save(); return json(res, 200, { ok: true, q }); }
    if (u === '/api/stake') { // sUSD -> the vigil
      const now = Date.now(); if (!vigilLive(now)) return json(res, 200, { error: 'the vigil is not open' });
      const x = num(d.amount, w.susd); if (!x) return json(res, 200, { error: 'nothing to stake' });
      if (db.vigil.staked + x > VIGIL.cap) return json(res, 200, { error: 'the vigil is full — cap ' + VIGIL.cap.toLocaleString() + ' sUSD' });
      accrue(w, now); if (!w.stake) { db.vigil.stakers++; w.stakeSince = now; } w.susd -= x; w.stake = (w.stake || 0) + x; w.stakeT = now; db.vigil.staked += x; save();
      return json(res, 200, { ok: true, staked: x, ...account(d.wallet) });
    }
    if (u === '/api/unstake') { const now = Date.now(); accrue(w, now); const x = num(d.amount, w.stake || 0); if (!x) return json(res, 200, { error: 'nothing staked' });
      const xn = toll('unshield', x, w); w.stake -= x; w.susd += xn; db.vigil.staked = Math.max(0, db.vigil.staked - x); if (w.stake <= 0) { w.stake = 0; db.vigil.stakers = Math.max(0, db.vigil.stakers - 1); } save();
      return json(res, 200, { ok: true, unstaked: xn, toll: x - xn, ...account(d.wallet) });
    }
    if (u === '/api/claim') { const now = Date.now(); accrue(w, now); const usd = w.stakeAcc || 0; if (usd < 0.01) return json(res, 200, { error: 'nothing to claim yet' });
      const px = Math.max(0.000001, db.styxPrice); let styx = usd / px; const left = VIGIL.pool - db.vigil.paidStyx; if (left <= 0) return json(res, 200, { error: 'the pool is spent — the vigil is over' }); if (styx > left) styx = left;
      w.stakeAcc = 0; w.styx += styx; db.vigil.paidStyx += styx; db.vigil.paidUsd += styx * px; save();
      return json(res, 200, { ok: true, claimedStyx: styx, claimedUsd: styx * px, ...account(d.wallet) });
    }
    if (u === '/api/redeem') { // sUSD -> collateral + STYX
      const r = num(d.amount, w.susd); if (!r) return json(res, 200, { error: 'nothing to redeem' });
      const rn = toll('redeem', r, w); const outUsdg = rn * db.cr; const mintStyx = (rn * (1 - db.cr)) / db.styxPrice;
      w.susd -= r; w.usdg += outUsdg; w.styx += mintStyx; db.susdSupply = Math.max(0, db.susdSupply - r); db.collateralUsd = Math.max(0, db.collateralUsd - outUsdg); db.styxSupply += mintStyx; save();
      return json(res, 200, { ok: true, redeemed: r, gotUsdg: outUsdg, gotStyx: mintStyx, ...account(d.wallet) });
    }
    if (u === '/api/note/create') { // lock shielded sUSD behind a secret link
      const x = num(d.amount, w.priv); if (!x) return json(res, 200, { error: 'not enough private balance' }); if (x < 1) return json(res, 200, { error: 'minimum 1 sUSD' });
      const secret = base58(randomBytes(16)); const id = linkId(secret); const xn = toll('send', x, w);
      w.priv -= x; sh.nullifiers++; const { C, note } = shieldNote(xn, shKeys[randomInt(0, shKeys.length)].pub);
      db.links[id] = { amt: xn, memo: String(d.memo || '').slice(0, 80), ts: Date.now(), claimed: false, by: d.wallet.toLowerCase(), from: base58(sha('from|' + d.wallet.toLowerCase() + '|' + secret)) };
      pushShTx({ sig: base58(randomBytes(32)), type: 'private', nullifier: nullifierOf('n', sh.notes), commitment: C, note, proof: simProof(), ts: Date.now() });
      hist(w, { type: 'note', amt: x, id }); save();
      return json(res, 200, { ok: true, secret, id, amt: xn, toll: x - xn, ...account(d.wallet) });
    }
    if (u === '/api/note/claim') { // anyone holding the secret claims it into THEIR shielded balance
      const L = db.links[linkId(String(d.secret || ''))]; if (!L) return json(res, 200, { error: 'no such note' }); if (L.claimed) return json(res, 200, { error: 'this note was already claimed' });
      L.claimed = true; L.claimedTs = Date.now(); w.priv += L.amt; if (L.by) bind(w, d.wallet.toLowerCase(), L.by); hist(w, { type: 'claimed', amt: L.amt, memo: L.memo }); save();
      return json(res, 200, { ok: true, claimed: L.amt, memo: L.memo, ...account(d.wallet) });
    }
    if (u === '/api/seal') { return json(res, 200, { ok: true, viewKey: viewKeyOf(d.wallet) }); }
    if (u === '/api/dark/open') { // shielded sUSD -> a hidden position
      const sym = String(d.sym || '').toUpperCase(); if (!DARK_FEED[sym]) return json(res, 200, { error: 'unknown market' });
      if (!tapeFresh(sym)) return json(res, 200, { error: sym + ' tape is closed right now — try when the market is open' });
      const side = d.side === 'short' ? 'short' : 'long'; const x = num(d.amount, w.priv); if (!x) return json(res, 200, { error: 'not enough shielded sUSD' }); if (x < 10) return json(res, 200, { error: 'minimum 10 sUSD' });
      if (x > DARK.maxPos) return json(res, 200, { error: 'max ' + DARK.maxPos + ' sUSD per position' }); if (db.dark.oi + x > DARK.maxOi) return json(res, 200, { error: 'the pool is full for now' });
      const fee = x * DARK.fee; const notional = x - fee; const px = TAPE[sym].px;
      w.priv -= x; pyre.tollUsd += fee; db.dark.fees += fee; db.dark.oi += notional; db.dark.open++; db.dark.opened++; db.dark.volume += notional;
      const p = { id: base58(randomBytes(6)), sym, side, notional, entry: px, ts: Date.now() }; w.dark = w.dark || []; w.dark.push(p); hist(w, { type: 'dark-open', amt: x, memo: sym + ' ' + side });
      sh.nullifiers++; const { C, note } = shieldNote(notional, shKeys[randomInt(0, shKeys.length)].pub); pushShTx({ sig: base58(randomBytes(32)), type: 'private', nullifier: nullifierOf('d', sh.notes), commitment: C, note, proof: simProof(), ts: Date.now() }); save();
      return json(res, 200, { ok: true, opened: p, ...account(d.wallet) });
    }
    if (u === '/api/dark/close') { const p = (w.dark || []).find((x) => x.id === d.id); if (!p) return json(res, 200, { error: 'no such position' }); if (!tapeFresh(p.sym)) return json(res, 200, { error: p.sym + ' tape is closed — closes settle when the market is open' });
      const r = closePos(w, p, TAPE[p.sym].px, 'user'); save(); return json(res, 200, { ok: true, closed: r, ...account(d.wallet) }); }
    if (u === '/api/shield') { // public sUSD -> private
      const s = num(d.amount, w.susd); if (!s) return json(res, 200, { error: 'nothing to shield' });
      const sn = toll('shield', s, w); w.susd -= s; w.priv += sn; sh.totalValue += sn; hist(w, { type: 'shield', amt: sn }); const { C, note } = shieldNote(sn, shKeys[0].pub);
      pushShTx({ sig: base58(randomBytes(32)), type: 'shield', commitment: C, note, ts: Date.now() }); save();
      return json(res, 200, { ok: true, shielded: sn, toll: s - sn, ...account(d.wallet) });
    }
    if (u === '/api/send') { // shielded transfer — amount + parties hidden
      if (!isWallet(d.to || '')) return json(res, 200, { error: 'enter a valid recipient address' });
      const x = num(d.amount, w.priv); if (!x) return json(res, 200, { error: 'not enough private balance' });
      const xn = toll('send', x, w); w.priv -= x; const r = W(d.to); r.priv += xn; sh.nullifiers++; hist(w, { type: 'sent', amt: x, to: d.to.toLowerCase() }); hist(r, { type: 'received', amt: xn });
      const { C, note } = shieldNote(xn, shKeys[randomInt(0, shKeys.length)].pub);
      pushShTx({ sig: base58(randomBytes(32)), type: 'private', nullifier: nullifierOf('u', sh.notes), commitment: C, note, proof: simProof(), ts: Date.now() }); save();
      return json(res, 200, { ok: true, sent: xn, toll: x - xn, ...account(d.wallet) });
    }
    if (u === '/api/unshield') { // private -> public
      const un = num(d.amount, w.priv); if (!un) return json(res, 200, { error: 'nothing to unshield' });
      const unn = toll('unshield', un, w); w.priv -= un; w.susd += unn; hist(w, { type: 'unshield', amt: un }); sh.totalValue = Math.max(0, sh.totalValue - un); sh.nullifiers++;
      pushShTx({ sig: base58(randomBytes(32)), type: 'unshield', nullifier: nullifierOf('u', sh.notes), publicAmount: un, ts: Date.now() }); save();
      return json(res, 200, { ok: true, unshielded: unn, toll: un - unn, ...account(d.wallet) });
    }
  }
  serve(req, res);
}).listen(PORT, () => console.log('STYX (' + STABLE + '/' + GOV + ') on Robinhood Chain · :' + PORT));

shInit();
setInterval(tick, 1000);
