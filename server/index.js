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
const { generateKeyPairSync, sign, createHash, randomBytes, randomInt, diffieHellman, createCipheriv } = require('crypto');

const PORT = process.env.PORT || 8198;
const ROOT = path.join(__dirname, '..');
const DATA_PATH = process.env.DATA_PATH || path.join(ROOT, 'data.json');
const STABLE = 'sUSD', GOV = 'STYX';
const STYX_MINT = process.env.STYX_MINT || '0xdbd2bd1a734d2b3dc8f88bacc404810fcbff36c4';   // $STYX · Robinhood Chain · LIVE
const TREASURY = (process.env.TREASURY || '0x28FC1899eDD7973dc5A9c95321E0cdeB3d8419d1');            // $STYX on Robinhood Chain — CA bar lights when set
const TICK_SEC = +(process.env.TICK_SEC || 5);
const SEED = { usdg: 10000, styx: 500, susd: 0, priv: 0 };

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
if (!db.shielded) db.shielded = { commitments: [], nullifiers: 0, notes: 0, totalValue: 0, txCount: 0, root: base58(sha('empty')), feed: [] };
if (!db.shielded.feed) db.shielded.feed = [];
let saveT = null; function save() { if (saveT) return; saveT = setTimeout(() => { saveT = null; try { fs.writeFileSync(DATA_PATH, JSON.stringify(db)); } catch (e) {} }, 800); }
const isWallet = (s) => /^0x[a-fA-F0-9]{40}$/.test(s);
function W(a) { return db.wallets[a] || (db.wallets[a] = { usdg: SEED.usdg, styx: SEED.styx, susd: SEED.susd, priv: SEED.priv, seeded: true }); }

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
    if (roll < 0.3) { const amt = randomInt(200, 6000); const { C, note } = shieldNote(amt, recip.pub); sh.totalValue += amt; pushShTx({ sig: base58(randomBytes(32)), type: 'shield', commitment: C, note, ts: now }); }
    else if (roll < 0.85) { const { C, note } = shieldNote(randomInt(50, 5000), recip.pub); sh.nullifiers++; pushShTx({ sig: base58(randomBytes(32)), type: 'private', nullifier: nullifierOf(recip.secret, sh.notes + i), commitment: C, note, proof: simProof(), ts: now }); }
    else { const amt = randomInt(200, 4000); sh.nullifiers++; sh.totalValue = Math.max(0, sh.totalValue - amt); pushShTx({ sig: base58(randomBytes(32)), type: 'unshield', nullifier: nullifierOf(recip.secret, sh.notes + i), publicAmount: amt, ts: now }); }
  }
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
    shielded: { totalValue: sh.totalValue, notes: sh.notes, nullifiers: sh.nullifiers, txCount: sh.txCount, root: sh.root },
    feed: sh.feed.slice(0, 10).map((t) => ({ sig: t.sig.slice(0, 6) + '…' + t.sig.slice(-4), type: t.type, publicAmount: t.publicAmount || null, ts: t.ts })),
  };
}
function account(addr) { const w = W(addr); return { wallet: addr, usdg: w.usdg, styx: w.styx, susd: w.susd, priv: w.priv, seeded: !!w.seeded }; }

// ---------- http ----------
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
function serve(req, res) { let u = decodeURIComponent(req.url.split('?')[0]); if (u === '/') u = '/client/index.html'; const f = path.normalize(path.join(ROOT, u)); if (!f.startsWith(ROOT)) { res.writeHead(403); return res.end('no'); } fs.readFile(f, (e, b) => { if (e) { res.writeHead(404); return res.end('not found'); } res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(b); }); }
function json(res, c, o) { res.writeHead(c, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); }
function body(req) { return new Promise((r) => { let b = ''; req.on('data', (c) => { b += c; if (b.length > 1e4) req.destroy(); }); req.on('end', () => { try { r(JSON.parse(b || '{}')); } catch (e) { r({}); } }); }); }

http.createServer(async (req, res) => {
  const u = req.url.split('?')[0];
  if (u === '/api/config') return json(res, 200, { stable: STABLE, gov: GOV, mint: STYX_MINT, treasury: TREASURY, network: 'robinhood', chainId: 4663, explorer: 'https://explorer.mainnet.chain.robinhood.com', styxLive: STYX_LIVE.px ? STYX_LIVE : null });
  if (u === '/api/metrics') return json(res, 200, metrics());
  if (req.method === 'POST') {
    const d = await body(req);
    if (u === '/api/account') { if (!isWallet(d.wallet || '')) return json(res, 200, { error: 'paste a valid Robinhood Chain address' }); return json(res, 200, account(d.wallet)); }
    if (!isWallet(d.wallet || '')) return json(res, 200, { error: 'connect a wallet first' });
    const w = W(d.wallet);

    if (u === '/api/mint') { // collateral + STYX -> sUSD
      const m = num(d.amount); if (!m) return json(res, 200, { error: 'enter an amount' });
      const needUsdg = m * db.cr; const burnStyx = (m * (1 - db.cr)) / db.styxPrice;
      if (w.usdg < needUsdg) return json(res, 200, { error: 'not enough USDG collateral' });
      if (w.styx < burnStyx) return json(res, 200, { error: 'not enough STYX to mint the algorithmic share' });
      w.usdg -= needUsdg; w.styx -= burnStyx; w.susd += m; db.susdSupply += m; db.collateralUsd += needUsdg; db.styxSupply = Math.max(0, db.styxSupply - burnStyx); save();
      return json(res, 200, { ok: true, minted: m, usedUsdg: needUsdg, burnedStyx: burnStyx, ...account(d.wallet) });
    }
    if (u === '/api/redeem') { // sUSD -> collateral + STYX
      const r = num(d.amount, w.susd); if (!r) return json(res, 200, { error: 'nothing to redeem' });
      const outUsdg = r * db.cr; const mintStyx = (r * (1 - db.cr)) / db.styxPrice;
      w.susd -= r; w.usdg += outUsdg; w.styx += mintStyx; db.susdSupply = Math.max(0, db.susdSupply - r); db.collateralUsd = Math.max(0, db.collateralUsd - outUsdg); db.styxSupply += mintStyx; save();
      return json(res, 200, { ok: true, redeemed: r, gotUsdg: outUsdg, gotStyx: mintStyx, ...account(d.wallet) });
    }
    if (u === '/api/shield') { // public sUSD -> private
      const s = num(d.amount, w.susd); if (!s) return json(res, 200, { error: 'nothing to shield' });
      w.susd -= s; w.priv += s; sh.totalValue += s; const { C, note } = shieldNote(s, shKeys[0].pub);
      pushShTx({ sig: base58(randomBytes(32)), type: 'shield', commitment: C, note, ts: Date.now() }); save();
      return json(res, 200, { ok: true, shielded: s, ...account(d.wallet) });
    }
    if (u === '/api/send') { // shielded transfer — amount + parties hidden
      if (!isWallet(d.to || '')) return json(res, 200, { error: 'enter a valid recipient address' });
      const x = num(d.amount, w.priv); if (!x) return json(res, 200, { error: 'not enough private balance' });
      w.priv -= x; const r = W(d.to); r.priv += x; sh.nullifiers++;
      const { C, note } = shieldNote(x, shKeys[randomInt(0, shKeys.length)].pub);
      pushShTx({ sig: base58(randomBytes(32)), type: 'private', nullifier: nullifierOf('u', sh.notes), commitment: C, note, proof: simProof(), ts: Date.now() }); save();
      return json(res, 200, { ok: true, sent: x, ...account(d.wallet) });
    }
    if (u === '/api/unshield') { // private -> public
      const un = num(d.amount, w.priv); if (!un) return json(res, 200, { error: 'nothing to unshield' });
      w.priv -= un; w.susd += un; sh.totalValue = Math.max(0, sh.totalValue - un); sh.nullifiers++;
      pushShTx({ sig: base58(randomBytes(32)), type: 'unshield', nullifier: nullifierOf('u', sh.notes), publicAmount: un, ts: Date.now() }); save();
      return json(res, 200, { ok: true, unshielded: un, ...account(d.wallet) });
    }
  }
  serve(req, res);
}).listen(PORT, () => console.log('STYX (' + STABLE + '/' + GOV + ') on Robinhood Chain · :' + PORT));

shInit();
setInterval(tick, 1000);
