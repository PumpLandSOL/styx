// one-shot patch: CHARON'S CUT — referral engine on Notes + ferry links. 20% of every toll a referred wallet ever pays goes to the ferryman. Run once from styx/.
const fs = require('fs'); const path = require('path');
const F = path.join(__dirname, '..', 'server', 'index.js'); const H = path.join(__dirname, '..', 'client', 'index.html'); const A = path.join(__dirname, '..', 'client', 'src', 'app.js');
let s = fs.readFileSync(F, 'utf8'); let h = fs.readFileSync(H, 'utf8'); let a = fs.readFileSync(A, 'utf8');
const rep = (src, x, y, all) => { if (src.indexOf(x) < 0) throw new Error('missing: ' + x.slice(0, 70)); return all ? src.split(x).join(y) : src.replace(x, y); };

// ---- server ----
s = rep(s, "function toll(kind, amt) { const f = amt * TOLL[kind]; pyre.tollUsd += f; return amt - f; }",
`const FERRY_CUT = +(process.env.FERRY_CUT || 0.20);   // share of every toll that goes to the wallet who brought the payer across
function toll(kind, amt, w) {
  const f = amt * TOLL[kind]; let cut = 0;
  if (w && w.ref && db.wallets[w.ref]) { cut = f * FERRY_CUT; const fm = db.wallets[w.ref]; fm.susd += cut; fm.earned = (fm.earned || 0) + cut; db.ferry.paid += cut; }
  pyre.tollUsd += f - cut; return amt - f;
}
if (!db.ferry) db.ferry = { paid: 0, souls: 0 };
function bind(w, addr, refAddr) { refAddr = (refAddr || '').toLowerCase(); if (w.ref || !isWallet(refAddr) || refAddr === addr) return false; const fm = W(refAddr); w.ref = refAddr; w.refTs = Date.now(); fm.souls = (fm.souls || 0) + 1; db.ferry.souls++; hist(fm, { type: 'soul', amt: 0, to: addr }); return true; }
const redact = (addr) => addr.slice(0, 4) + '████' + addr.slice(-4);
function ferrymen() { return Object.entries(db.wallets).filter(([, x]) => (x.souls || 0) > 0).map(([addr, x]) => ({ who: redact(addr), souls: x.souls || 0, earned: x.earned || 0 })).sort((p, q) => q.souls - p.souls || q.earned - p.earned).slice(0, 10); }`);
// pass the payer into every user-side toll
s = rep(s, "const xn = toll('unshield', x); w.stake -= x;", "const xn = toll('unshield', x, w); w.stake -= x;");
s = rep(s, "const rn = toll('redeem', r);", "const rn = toll('redeem', r, w);");
s = rep(s, "const secret = base58(randomBytes(16)); const id = linkId(secret); const xn = toll('send', x);", "const secret = base58(randomBytes(16)); const id = linkId(secret); const xn = toll('send', x, w);");
s = rep(s, "const sn = toll('shield', s); w.susd -= s;", "const sn = toll('shield', s, w); w.susd -= s;");
s = rep(s, "const xn = toll('send', x); w.priv -= x; const r = W(d.to);", "const xn = toll('send', x, w); w.priv -= x; const r = W(d.to);");
s = rep(s, "const unn = toll('unshield', un); w.priv -= un;", "const unn = toll('unshield', un, w); w.priv -= un;");
// note remembers its author; claiming binds the claimer
s = rep(s, "claimed: false, from: base58(", "claimed: false, by: d.wallet.toLowerCase(), from: base58(");
s = rep(s, "L.claimed = true; L.claimedTs = Date.now(); w.priv += L.amt;", "L.claimed = true; L.claimedTs = Date.now(); w.priv += L.amt; if (L.by) bind(w, d.wallet.toLowerCase(), L.by);");
// ferry link: ?ref= on first account touch
s = rep(s, "if (u === '/api/account') { if (!isWallet(d.wallet || '')) return json(res, 200, { error: 'paste a valid Robinhood Chain address' }); return json(res, 200, account(d.wallet)); }",
  "if (u === '/api/account') { if (!isWallet(d.wallet || '')) return json(res, 200, { error: 'paste a valid Robinhood Chain address' }); const aw = W(d.wallet); if (d.ref) { const fresh = !(aw.deposited || 0) && !(aw.hist || []).length; if (fresh && bind(aw, d.wallet.toLowerCase(), d.ref)) save(); } return json(res, 200, account(d.wallet)); }");
// account + metrics views
s = rep(s, "deposited: w.deposited || 0, vigil: vigilView(w, now),", "deposited: w.deposited || 0, ref: w.ref || null, souls: w.souls || 0, earned: w.earned || 0, vigil: vigilView(w, now),");
s = rep(s, "deposits: { usdg: db.treasuryIn.usdg, n: db.treasuryIn.n },", "deposits: { usdg: db.treasuryIn.usdg, n: db.treasuryIn.n }, ferry: { cut: FERRY_CUT, souls: db.ferry.souls, paid: db.ferry.paid, board: ferrymen() },");
fs.writeFileSync(F, s);

// ---- client html ----
h = rep(h, "  <!-- THE VIGIL -->", `  <!-- CHARON'S CUT -->
  <div class="sec" id="ferry"><span>Charon&rsquo;s cut · the ferryman program<span class="tmp" style="background:var(--gold)">NEW</span></span></div>
  <div class="rite3">
    <div class="r3"><div class="k">how it works</div><h3>Bring a soul across. Earn from every crossing they make. Forever.</h3><p>Anyone who claims your <b>Note</b>, or arrives through your <b>ferry link</b>, becomes your soul. From then on <b>20% of every toll they ever pay</b> — shield, send, unshield, redeem — is credited to you in sUSD. Not once. Every time. The Pyre takes the other 80%.</p>
      <div class="linkbox" id="ferrybox" style="display:none"><code id="ferrylink"></code><button id="ferrycopy">Copy</button></div>
      <div class="kv" style="margin-top:10px"><span>your souls</span><b id="f-souls">—</b></div><div class="kv"><span>earned from their tolls</span><b id="f-earned">—</b></div></div>
    <div class="r3"><div class="k">the ferrymen · top ten</div><div class="led" id="ferryboard" style="margin-top:10px"></div>
      <p style="margin-top:10px;font-size:13px">Addresses are redacted. Souls are counted, never named.</p></div>
  </div>

  <!-- THE VIGIL -->`);
h = rep(h, "<details><summary>What is a Note?</summary>", `<details><summary>What is Charon&rsquo;s Cut?</summary><div class="a">A referral engine built into the Note. When someone claims your Note or connects through your ferry link (<b>styxrh.xyz/?ref=your-address</b>) for the first time, they are bound to you. <b>20% of every toll they pay from then on</b> is credited to your public sUSD balance, forever. The remaining 80% still goes to The Pyre. One ferryman per soul, set once, never changed.</div></details>
    <details><summary>What is a Note?</summary>`);
fs.writeFileSync(H, h);

// ---- client js ----
a = rep(a, "let wallet = localStorage.getItem('styx_w') || '';", "let wallet = localStorage.getItem('styx_w') || '';\nlet refParam = ''; try { const q = new URLSearchParams(location.search); if (/^0x[a-fA-F0-9]{40}$/.test(q.get('ref') || '')) { refParam = q.get('ref').toLowerCase(); localStorage.setItem('styx_ref', refParam); } else refParam = localStorage.getItem('styx_ref') || ''; } catch (e) {}");
a = rep(a, "A = await api('/api/account', { wallet });", "A = await api('/api/account', { wallet, ref: refParam || undefined });");
a = rep(a, "  if (M.pyre) { const P = M.pyre;", `  if (M.ferry) { const Fm = M.ferry;
    $('ferryboard').innerHTML = Fm.board.map((b, i) => \`<div class="r"><span class="ty">#\${i + 1}</span><span class="sg">\${b.who}</span><span class="am">\${b.souls} soul\${b.souls === 1 ? '' : 's'} · \${fmt(b.earned, 2)} sUSD</span></div>\`).join('') || '<div class="r"><span class="sg">no souls carried yet — write the first Note</span></div>';
  }
  if (M.pyre) { const P = M.pyre;`);
a = rep(a, "function renderAccount() {", `function renderAccount() {
  if (wallet) { $('ferrybox').style.display = 'flex'; $('ferrylink').textContent = location.origin + '/?ref=' + wallet; } else $('ferrybox').style.display = 'none';
  $('f-souls').textContent = A ? fmt(A.souls, 0) : '—'; $('f-earned').textContent = A ? fmt(A.earned, 2) + ' sUSD' : '—';`);
a = rep(a, "$('ca-copy').onclick = () => {", "$('ferrycopy').onclick = () => { navigator.clipboard.writeText(location.origin + '/?ref=' + wallet); toast('ferry link copied'); };\n$('ca-copy').onclick = () => {");
fs.writeFileSync(A, a); console.log('patched');
