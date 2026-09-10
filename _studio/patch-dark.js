// one-shot patch: THE DARK POOL — shielded 1x exposure to tokenized stocks off the live exchange tape, settled in shielded sUSD. Run once from styx/.
const fs = require('fs'); const path = require('path');
const F = path.join(__dirname, '..', 'server', 'index.js'); const H = path.join(__dirname, '..', 'client', 'index.html'); const A = path.join(__dirname, '..', 'client', 'src', 'app.js');
let s = fs.readFileSync(F, 'utf8'); let h = fs.readFileSync(H, 'utf8'); let a = fs.readFileSync(A, 'utf8');
const rep = (src, x, y) => { const i = src.indexOf(x); if (i < 0) throw new Error('missing: ' + x.slice(0, 70)); return src.slice(0, i) + y + src.slice(i + x.length); };

// ---- server ----
if (!s.includes('THE DARK POOL')) {
s = rep(s, "// ---------- privacy primitives (real) ----------", `// ---------- THE DARK POOL: shielded 1x exposure to tokenized stocks, priced off the exchange tape, settled in shielded sUSD ----------
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

// ---------- privacy primitives (real) ----------`);
s = rep(s, "    if (u === '/api/shield') {", `    if (u === '/api/dark/open') { // shielded sUSD -> a hidden position
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
    if (u === '/api/shield') {`);
s = rep(s, "deposited: w.deposited || 0, bonds: bondView(w, now),", "deposited: w.deposited || 0, dark: darkView(w), bonds: bondView(w, now),");
s = rep(s, "deposits: { usdg: db.treasuryIn.usdg, n: db.treasuryIn.n },", "deposits: { usdg: db.treasuryIn.usdg, n: db.treasuryIn.n }, dark: { markets: Object.keys(DARK_FEED).map((sym) => ({ sym, px: TAPE[sym] ? TAPE[sym].px : null, ts: TAPE[sym] ? TAPE[sym].ts : null, fresh: tapeFresh(sym) })), open: db.dark.open, opened: db.dark.opened, closed: db.dark.closed, volume: db.dark.volume, fees: db.dark.fees, liqs: db.dark.liqs, fee: DARK.fee, maxPos: DARK.maxPos, maxOi: DARK.maxOi, full: db.dark.oi >= DARK.maxOi },");
fs.writeFileSync(F, s); console.log('server patched'); } else console.log('server already patched');

// ---- html ----
h = rep(h, '<button data-tab="send">Send Unseen</button>', '<button data-tab="send">Send Unseen</button><button data-tab="dark">Dark Pool</button>');
h = rep(h, '.led .ty.burn{', `.tape{display:flex;gap:0;overflow:hidden;border:1px solid var(--line2);border-radius:3px;background:var(--stone)}
.tape .m{flex:1;padding:12px 10px;text-align:center;border-right:1px solid var(--line)}.tape .m:last-child{border-right:none}
.tape .s{font-family:'Cinzel';font-weight:700;font-size:13px;letter-spacing:.1em;color:var(--gold)}.tape .p{font-family:'JetBrains Mono';font-size:13px;color:var(--ink);margin-top:4px}.tape .m.closed .p{color:var(--mut)}
.tape .st{font-family:'JetBrains Mono';font-size:9px;letter-spacing:.14em;color:var(--verd);margin-top:3px;text-transform:uppercase}.tape .m.closed .st{color:var(--mut)}
.dark{display:grid;grid-template-columns:repeat(4,1fr);background:linear-gradient(180deg,#0b0a10,var(--stone));border:1px solid rgba(201,162,94,.4);border-radius:3px;margin-top:14px}
.dark .stat .v{color:var(--gold2)}
.pos{display:flex;align-items:center;gap:12px;padding:10px 0;border-top:1px solid var(--line);font-size:14px}.pos b{font-family:'Cinzel';color:var(--gold)}.pos .pnl{margin-left:auto;font-family:'JetBrains Mono';font-weight:500}.pos .pnl.up{color:var(--verd)}.pos .pnl.dn{color:var(--red)}
.pos button{font-family:'Cinzel';font-size:10px;letter-spacing:.1em;border:1px solid var(--line2);background:none;color:var(--dim);padding:5px 9px;cursor:pointer}.pos button:hover{color:var(--gold);border-color:var(--gold)}
.led .ty.burn{`);
h = rep(h, '  <!-- BONDS -->', `  <!-- THE DARK POOL -->
  <div class="sec" id="darkpool"><span>The dark pool · stocks, unseen<span class="tmp" style="background:var(--gold)">NEW</span></span></div>
  <div class="tape" id="tape"></div>
  <div class="dark">
    <div class="stat"><div class="l">positions open</div><div class="v" id="dk-open">—</div></div>
    <div class="stat"><div class="l">notional inside</div><div class="v"><span class="redact">██████</span></div></div>
    <div class="stat"><div class="l">volume crossed</div><div class="v" id="dk-vol">—</div></div>
    <div class="stat"><div class="l">fees → the pyre</div><div class="v" id="dk-fees">—</div></div>
  </div>
  <div class="pyre-note">Take exposure to <b>tokenized stocks with shielded sUSD</b>. Long or short, 1x, priced off the live exchange tape. Ticker, size, side and P&amp;L stay inside the shield — the ledger sees one nullifier and one commitment, same as any private send. <b>30 bps</b> each way to The Pyre. Trades only clear while the tape is live.</div>

  <!-- BONDS -->`);
h = rep(h, '<details><summary>What are Bonds?</summary>', `<details><summary>What is the Dark Pool?</summary><div class="a">Private exposure to tokenized stocks. You commit shielded sUSD to a long or short on HOOD, TSLA, NVDA, SPY and others, 1x, no leverage, priced off the live exchange tape. When you close, P&amp;L settles back into your shielded balance. <b>Nobody can see what you hold, how much, or which way.</b> Positions are capped per wallet and pool-wide, shorts stop out at 95% loss, and trades only clear while the tape is fresh. The protocol is the counterparty; fees go to The Pyre.</div></details>
    <details><summary>What are Bonds?</summary>`);
fs.writeFileSync(H, h);

// ---- js ----
a = rep(a, "  if (M.bonds) { const Bd = M.bonds;", `  if (M.dark) { const D = M.dark;
    $('tape').innerHTML = D.markets.map((m) => \`<div class="m \${m.fresh ? '' : 'closed'}"><div class="s">\${m.sym}</div><div class="p">\${m.px ? '$' + fmt(m.px, m.px < 10 ? 4 : 2) : '—'}</div><div class="st">\${m.fresh ? 'live' : 'closed'}</div></div>\`).join('');
    $('dk-open').textContent = fmt(D.open, 0); $('dk-vol').textContent = '$' + big(D.volume); $('dk-fees').textContent = '$' + fmt(D.fees, 2);
  }
  if (M.bonds) { const Bd = M.bonds;`);
a = rep(a, "  } else if (tab === 'bond') {", `  } else if (tab === 'dark') {
    const D = M && M.dark, pos = (A && A.dark) || [];
    p.innerHTML = \`<div class="note"><b>The Dark Pool.</b> Commit shielded sUSD to a stock. Long or short, 1x, live tape. Ticker, size and P&amp;L stay in the shield. 30 bps each way.</div>
      <div style="display:flex;gap:10px"><div class="field" style="flex:1"><select id="sym" style="flex:1;background:none;border:none;color:var(--ink);font-family:'JetBrains Mono';font-size:15px;outline:none">\${(D ? D.markets : []).map((m) => \`<option value="\${m.sym}" \${m.fresh ? '' : 'disabled'}>\${m.sym} \${m.px ? '· $' + fmt(m.px, 2) : ''}\${m.fresh ? '' : ' · closed'}</option>\`).join('')}</select></div>
      <div class="field" style="flex:0 0 150px"><select id="side" style="flex:1;background:none;border:none;color:var(--ink);font-family:'JetBrains Mono';font-size:15px;outline:none"><option value="long">LONG</option><option value="short">SHORT</option></select></div></div>
      <div class="field"><input id="in" type="number" placeholder="10.00 minimum" min="10"><span class="u">sUSD</span><span class="mx" id="mx">MAX</span></div>
      <div class="kv"><span>Shielded balance</span><b>\${A ? (reveal ? fmt(A.priv, 2) : '████') : '—'}</b></div><div class="kv"><span>Per position · pool</span><b>\${D ? 'max ' + fmt(D.maxPos, 0) + ' · ' + (D.full ? 'full' : 'open') : '—'}</b></div>
      <button class="btn fill wide" id="act" style="margin-top:14px">Open unseen</button>
      \${pos.length ? '<div style="margin-top:16px">' + pos.map((q) => \`<div class="pos"><b>\${q.sym}</b><span>\${q.side}</span><span class="sg" style="font-family:'JetBrains Mono';font-size:12px;color:var(--mut)">\${fmt(q.notional, 2)} @ \${fmt(q.entry, 2)} → \${fmt(q.px, 2)}</span><span class="pnl \${q.pnl >= 0 ? 'up' : 'dn'}">\${q.pnl >= 0 ? '+' : ''}\${fmt(q.pnl, 2)}</span><button data-close="\${q.id}" \${q.fresh ? '' : 'disabled'}>Close</button></div>\`).join('') + '</div>' : ''}\`;
    $('mx').onclick = () => { if (A) $('in').value = Math.min(A.priv, D ? D.maxPos : 1000); };
    $('act').onclick = () => doAct('/api/dark/open', { sym: $('sym').value, side: $('side').value, amount: +$('in').value }, (r) => \`opened \${r.opened.side} \${r.opened.sym} — unseen\`);
    p.querySelectorAll('[data-close]').forEach((b) => b.onclick = () => doAct('/api/dark/close', { id: b.dataset.close, amount: 1 }, (r) => \`closed · \${r.closed.pnl >= 0 ? '+' : ''}\${fmt(r.closed.pnl, 2)} sUSD\`));
  } else if (tab === 'bond') {`);
fs.writeFileSync(A, a); console.log('client patched');
