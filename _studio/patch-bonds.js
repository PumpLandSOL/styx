// one-shot patch: BONDS (USDG -> discounted $STYX, 5-day vest, straight to reserve) + Vigil boost week + STYX payout queue + deposit CTA. Run once from styx/.
const fs = require('fs'); const path = require('path');
const F = path.join(__dirname, '..', 'server', 'index.js'); const H = path.join(__dirname, '..', 'client', 'index.html'); const A = path.join(__dirname, '..', 'client', 'src', 'app.js');
let s = fs.readFileSync(F, 'utf8'); let h = fs.readFileSync(H, 'utf8'); let a = fs.readFileSync(A, 'utf8');
const rep = (src, x, y) => { const i = src.indexOf(x); if (i < 0) throw new Error('missing: ' + x.slice(0, 70)); return src.slice(0, i) + y + src.slice(i + x.length); };

// ---- server ----
if (s.includes("BONDS: USDG in")) { console.log("server already patched"); } else {
// vigil boost week: apy is a function of time now
s = rep(s, "function vigilLive(now) {", `const VIGIL_BOOST = { apy: +(process.env.VIGIL_BOOST_APY || 1.00), end: +(process.env.VIGIL_BOOST_END || ${Date.UTC(2026, 8, 17)}) };   // 100% APY through 2026-09-17, then back to VIGIL.apy
const vigilApy = (now) => now < VIGIL_BOOST.end ? VIGIL_BOOST.apy : VIGIL.apy;
function vigilLive(now) {`);
s = rep(s, "u.stakeAcc = (u.stakeAcc || 0) + u.stake * VIGIL.apy * (t1 - t0) / 31536000000;", "u.stakeAcc = (u.stakeAcc || 0) + u.stake * vigilApy(t0) * (t1 - t0) / 31536000000;");
s = rep(s, "vigil: { ...VIGIL, live: vigilLive(Date.now()),", "vigil: { ...VIGIL, apy: vigilApy(Date.now()), baseApy: VIGIL.apy, boost: { apy: VIGIL_BOOST.apy, end: VIGIL_BOOST.end, live: Date.now() < VIGIL_BOOST.end, endsIn: Math.max(0, VIGIL_BOOST.end - Date.now()) }, live: vigilLive(Date.now()),");

// bonds
s = rep(s, "// ---------- privacy primitives (real) ----------", `// ---------- BONDS: USDG in, discounted $STYX out, vested. The USDG stays in reserve and mints NOTHING, so every bond over-collateralizes sUSD. ----------
const BOND = {
  discount: +(process.env.BOND_DISCOUNT || 0.20),          // 20% below market
  vestMs: +(process.env.BOND_VEST_DAYS || 5) * 864e5,      // linear vest
  capUsd: +(process.env.BOND_CAP_USD || 5000),             // per-day capacity
  end: +(process.env.BOND_END || ${Date.UTC(2026, 9, 11)}),  // same close as the vigil
  min: 50,
};
if (!db.bonds) db.bonds = { soldUsd: 0, soldStyx: 0, n: 0, day: 0, dayUsd: 0 };
function bondDay() { const d = Math.floor(Date.now() / 864e5); if (db.bonds.day !== d) { db.bonds.day = d; db.bonds.dayUsd = 0; } return db.bonds; }
const bondPrice = () => Math.max(0.000001, db.styxPrice) * (1 - BOND.discount);
function bondView(u, now) { const list = (u.bonds || []).map((b) => { const k = Math.min(1, Math.max(0, (now - b.ts) / BOND.vestMs)); const vested = b.styx * k; return { id: b.id, usd: b.usd, styx: b.styx, price: b.price, ts: b.ts, vestEnd: b.ts + BOND.vestMs, vested, claimable: Math.max(0, vested - b.claimed), claimed: b.claimed }; }); return { list, claimable: list.reduce((x, b) => x + b.claimable, 0), pending: list.reduce((x, b) => x + (b.styx - b.claimed), 0) }; }

// ---------- privacy primitives (real) ----------`);
s = rep(s, "    if (u === '/api/withdraw') { // USDG ledger -> payout queue (treasury pays by hand, then marks it paid)\n      const x = num(d.amount, w.usdg); if (!x) return json(res, 200, { error: 'nothing to withdraw' }); if (x < 1) return json(res, 200, { error: 'minimum 1 USDG' });\n      w.usdg -= x; const q = { id: base58(randomBytes(6)), wallet: d.wallet.toLowerCase(), amt: x, ts: Date.now(), status: 'queued', tx: null };",
`    if (u === '/api/bond') { // USDG ledger -> discounted STYX, vested. USDG stays in reserve. Nothing minted.
      const now = Date.now(); if (now > BOND.end) return json(res, 200, { error: 'bonds are closed' });
      const x = num(d.amount, w.usdg); if (!x) return json(res, 200, { error: 'not enough USDG — deposit first' }); if (x < BOND.min) return json(res, 200, { error: 'minimum bond is ' + BOND.min + ' USDG' });
      const B = bondDay(); if (B.dayUsd + x > BOND.capUsd) return json(res, 200, { error: 'today\\'s bond capacity is spent — ' + (BOND.capUsd - B.dayUsd).toFixed(2) + ' USDG left' });
      const price = bondPrice(); const styx = x / price;
      w.usdg -= x; db.collateralUsd += x; B.dayUsd += x; B.soldUsd += x; B.soldStyx += styx; B.n++;
      w.bonds = w.bonds || []; w.bonds.push({ id: base58(randomBytes(6)), usd: x, styx, price, ts: now, claimed: 0 }); hist(w, { type: 'bond', amt: x }); save();
      return json(res, 200, { ok: true, bonded: x, styx, price, market: db.styxPrice, ...account(d.wallet) });
    }
    if (u === '/api/bond/claim') { const now = Date.now(); let got = 0; for (const b of w.bonds || []) { const k = Math.min(1, (now - b.ts) / BOND.vestMs); const c = Math.max(0, b.styx * k - b.claimed); b.claimed += c; got += c; } if (got < 1e-9) return json(res, 200, { error: 'nothing vested yet' }); w.styx += got; save(); return json(res, 200, { ok: true, claimedStyx: got, ...account(d.wallet) }); }
    if (u === '/api/withdraw') { // ledger -> payout queue (treasury pays by hand, then marks it paid). asset: USDG (default) or STYX
      const asset = d.asset === 'STYX' ? 'STYX' : 'USDG';
      const x = num(d.amount, asset === 'STYX' ? w.styx : w.usdg); if (!x) return json(res, 200, { error: 'nothing to withdraw' }); if (asset === 'USDG' && x < 1) return json(res, 200, { error: 'minimum 1 USDG' });
      if (asset === 'STYX') w.styx -= x; else w.usdg -= x;
      const q = { id: base58(randomBytes(6)), wallet: d.wallet.toLowerCase(), amt: x, asset, ts: Date.now(), status: 'queued', tx: null };`);
s = rep(s, "deposited: w.deposited || 0, ref: w.ref || null,", "deposited: w.deposited || 0, bonds: bondView(w, now), ref: w.ref || null,");
s = rep(s, "deposits: { usdg: db.treasuryIn.usdg, n: db.treasuryIn.n },", "deposits: { usdg: db.treasuryIn.usdg, n: db.treasuryIn.n }, bonds: (() => { const B = bondDay(); return { discount: BOND.discount, vestDays: BOND.vestMs / 864e5, capUsd: BOND.capUsd, leftToday: Math.max(0, BOND.capUsd - B.dayUsd), soldUsd: B.soldUsd, soldStyx: B.soldStyx, n: B.n, price: bondPrice(), market: db.styxPrice, end: BOND.end, open: Date.now() <= BOND.end, min: BOND.min }; })(),");
fs.writeFileSync(F, s); }

// ---- html ----
h = rep(h, '<button data-tab="deposit">Deposit</button><button class="on" data-tab="mint">Mint</button>', '<button data-tab="deposit">Deposit</button><button data-tab="bond">Bonds</button><button class="on" data-tab="mint">Mint</button>');
h = rep(h, '<button class="btn fill" id="cta-demo">Enter the crossing ↓</button>', '<button class="btn fill" id="cta-demo">Deposit USDG · Bond at −20% ↓</button>');
h = rep(h, "  <!-- CHARON'S CUT -->", `  <!-- BONDS -->
  <div class="sec" id="bonds"><span>Bonds · deposit USDG, take $STYX at a discount<span class="tmp" style="background:var(--red);color:#fff">−20%</span></span></div>
  <div class="pyre" style="border-color:rgba(201,162,94,.5);background:linear-gradient(180deg,#141008,var(--stone))">
    <div class="stat"><div class="l">bond price · $STYX</div><div class="v" id="bd-price" style="color:var(--gold2)">—</div></div>
    <div class="stat"><div class="l">market price</div><div class="v" id="bd-market">—</div></div>
    <div class="stat"><div class="l">capacity left today</div><div class="v" id="bd-left">—</div></div>
    <div class="stat"><div class="l">bonded so far</div><div class="v" id="bd-sold">—</div></div>
  </div>
  <div class="pyre-note">Deposit USDG and take <b>$STYX at 20% below market</b>, vesting linearly over <b>5 days</b>. The USDG goes straight into the reserve and mints <b>nothing</b>, so every bond makes sUSD more collateralized. Daily capacity is capped, first come first served. Minimum 50 USDG.</div>

  <!-- CHARON'S CUT -->`);
h = rep(h, '<div class="stat"><div class="l">APY · paid in $STYX</div><div class="v g" id="v-apy">—</div></div>', '<div class="stat"><div class="l">APY · paid in $STYX</div><div class="v g" id="v-apy">—</div><div class="l" id="v-boost" style="margin-top:6px;color:var(--verd)"></div></div>');
h = rep(h, '<details><summary>What is The Vigil, and why is it temporary?</summary>', `<details><summary>What are Bonds?</summary><div class="a">The fastest way to grow the reserve. You deposit USDG and receive <b>$STYX at 20% below market</b>, vesting linearly over 5 days, claimable as it vests and withdrawable to your wallet from the treasury. Your USDG goes into the sUSD reserve and <b>mints nothing</b>, so bonds push the collateral ratio up, not down. Capacity is capped per day and the program closes with the Vigil on Oct 11.</div></details>
    <details><summary>What is The Vigil, and why is it temporary?</summary>`);
fs.writeFileSync(H, h);

// ---- js ----
a = rep(a, "  if (M.vigil) { const V = M.vigil;", `  if (M.bonds) { const Bd = M.bonds;
    $('bd-price').textContent = '$' + fmt(Bd.price, 6); $('bd-market').textContent = '$' + fmt(Bd.market, 6); $('bd-left').textContent = '$' + fmt(Bd.leftToday, 0) + ' / $' + fmt(Bd.capUsd, 0); $('bd-sold').textContent = '$' + fmt(Bd.soldUsd, 0) + ' · ' + big(Bd.soldStyx) + ' STYX';
  }
  if (M.vigil) { const V = M.vigil;`);
a = rep(a, "$('v-apy').textContent = fmt(V.apy * 100, 0) + '%';", "$('v-apy').textContent = fmt(V.apy * 100, 0) + '%'; $('v-boost').textContent = V.boost && V.boost.live ? '⚡ boosted from ' + fmt(V.baseApy * 100, 0) + '% · ' + dur(V.boost.endsIn) + ' left' : '';");
a = rep(a, "  } else if (tab === 'deposit') {", `  } else if (tab === 'bond') {
    const Bd = M && M.bonds, me = A && A.bonds;
    p.innerHTML = \`<div class="note"><b>Bond USDG for $STYX at \${Bd ? fmt(Bd.discount * 100, 0) : 20}% below market.</b> Vests over \${Bd ? Bd.vestDays : 5} days. Your USDG goes to the reserve and mints nothing. \${Bd && !Bd.open ? '<b>Bonds are closed.</b>' : ''}</div>
      <div class="field"><input id="in" type="number" placeholder="50.00 minimum" min="50"><span class="u">USDG</span><span class="mx" id="mx">MAX</span></div>
      <div class="kv"><span>USDG on ledger</span><b>\${A ? fmt(A.usdg, 2) : '—'}</b></div>
      <div class="kv"><span>bond price · market</span><b>\${Bd ? '$' + fmt(Bd.price, 6) + ' · $' + fmt(Bd.market, 6) : '—'}</b></div>
      <div class="kv"><span>you receive</span><b id="o1">—</b></div>
      <div class="kv"><span>vesting · claimable now</span><b>\${me ? big(me.pending) + ' · ' + big(me.claimable) + ' STYX' : '—'}</b></div>
      <div style="display:flex;gap:10px;margin-top:14px"><button class="btn fill" id="act" style="flex:1.4">Bond USDG</button><button class="btn ghost" id="act2" style="flex:1">Claim vested</button><button class="btn ghost" id="act3" style="flex:1">Withdraw STYX</button></div>
      <div class="note" style="margin-top:12px;margin-bottom:0">No USDG yet? <a href="#" id="go-dep" style="color:var(--gold)">Deposit first →</a></div>\`;
    $('mx').onclick = () => { if (A) $('in').value = A.usdg; };
    $('in').oninput = () => { const x = +$('in').value || 0; $('o1').textContent = Bd ? big(x / Bd.price) + ' STYX (' + big(x / Bd.market) + ' at market)' : '—'; };
    $('act').onclick = () => doAct('/api/bond', { amount: +$('in').value }, (r) => \`bonded \${fmt(r.bonded, 2)} USDG → \${big(r.styx)} STYX vesting\`);
    $('act2').onclick = () => doAct('/api/bond/claim', { amount: 1 }, (r) => \`claimed \${big(r.claimedStyx)} STYX\`);
    $('act3').onclick = () => doAct('/api/withdraw', { asset: 'STYX', amount: A ? A.styx : 0 }, (r) => \`queued \${big(r.queued.amt)} STYX for payout\`);
    $('go-dep').onclick = (e) => { e.preventDefault(); tab = 'deposit'; document.querySelectorAll('.tabs button').forEach((x) => x.classList.toggle('on', x.dataset.tab === 'deposit')); renderPanel(); };
  } else if (tab === 'deposit') {`);
a = rep(a, "'<div class=\"kv\"><span>withdraw ' + fmt(q.amt, 2) + ' USDG · ' + q.id + '</span>", "'<div class=\"kv\"><span>withdraw ' + fmt(q.amt, 2) + ' ' + (q.asset || 'USDG') + ' · ' + q.id + '</span>");
fs.writeFileSync(A, a); console.log('patched');
