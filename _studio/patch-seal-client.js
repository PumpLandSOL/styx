// one-shot client patch: The Note (pay links) + The Seal (view keys). Run once from styx/.
const fs = require('fs'); const path = require('path');
const H = path.join(__dirname, '..', 'client', 'index.html'); const A = path.join(__dirname, '..', 'client', 'src', 'app.js');
let h = fs.readFileSync(H, 'utf8'); let a = fs.readFileSync(A, 'utf8');
const rep = (s, x, y) => { const i = s.indexOf(x); if (i < 0) throw new Error('missing: ' + x.slice(0, 70)); return s.slice(0, i) + y + s.slice(i + x.length); };

// ---- HTML: seal link in the private balance box, section + FAQ, roadmap tick ----
h = rep(h, '<span class="reveal" id="b-priv-eye">reveal</span>', '<span class="reveal" id="b-priv-eye">reveal</span><span class="reveal" id="b-seal" title="generate a read-only view key">seal</span>');
h = rep(h, '.led .ty.burn{', `.rite3{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.r3{background:linear-gradient(180deg,var(--stone2),var(--stone));border:1px solid var(--line2);border-radius:3px;padding:20px 22px}
.r3 .k{font-family:'JetBrains Mono';font-size:10px;letter-spacing:.2em;color:var(--verd);text-transform:uppercase}
.r3 h3{font-family:'Cinzel';font-weight:700;font-size:20px;margin:8px 0 8px;color:var(--gold2)}
.r3 p{font-size:15px;color:var(--dim);line-height:1.6;margin:0}.r3 p b{color:var(--ink);font-weight:500}
.linkbox{display:flex;gap:8px;align-items:center;margin-top:12px;border:1px solid var(--line2);background:#0c0906;padding:8px 10px;border-radius:2px}
.linkbox code{flex:1;font-family:'JetBrains Mono';font-size:12px;color:var(--gold);word-break:break-all}
.linkbox button{font-family:'Cinzel';font-size:11px;letter-spacing:.1em;border:1px solid var(--gold);background:none;color:var(--gold);padding:6px 10px;cursor:pointer}
@media(max-width:720px){.rite3{grid-template-columns:1fr}}
.led .ty.burn{`);
h = rep(h, '  <!-- THE VIGIL -->', `  <!-- RITE III -->
  <div class="sec" id="rite3"><span>Rite III · the note &amp; the seal<span class="tmp" style="background:var(--gold)">NEW</span></span></div>
  <div class="rite3">
    <div class="r3"><div class="k">The Note · pay anyone, no address</div><h3>Send private dollars as a link.</h3><p>Lock shielded sUSD behind a secret. Whoever opens the link claims it into <b>their own</b> shielded balance. No recipient is ever named, on the ledger it is one nullifier and one commitment, same as any private send. <b>Text it. DM it. Print it as a QR.</b></p></div>
    <div class="r3"><div class="k">The Seal · selective disclosure</div><h3>Prove it to one person. Hide it from everyone else.</h3><p>Generate a <b>view key</b> for your wallet. Whoever holds it can read your shielded balance and history on a sealed statement page. It <b>can never spend</b>. Give it to an accountant, a partner, a regulator — and to nobody else.</p></div>
  </div>

  <!-- THE VIGIL -->`);
h = rep(h, '<details><summary>Is my USDG actually deposited?</summary>', `<details><summary>What is a Note?</summary><div class="a">A pay link. You lock shielded sUSD behind a random secret and share the link. Whoever opens it connects a wallet and the sUSD lands in <b>their</b> shielded balance. The secret is only in the link fragment; the server stores a hash of it, and the ledger shows one nullifier and one commitment, indistinguishable from a private send. <i>One claim per note.</i></div></details>
    <details><summary>What is the Seal?</summary><div class="a">A <b>view key</b>: an HMAC over your address with a server salt, encoded with your address so the statement page can verify it. It reads your shielded balance and history. It has <b>no spending power</b>. This is the selective-disclosure model privacy coins use for audits: you choose who sees, and only they see.</div></details>
    <details><summary>Is my USDG actually deposited?</summary>`);
h = rep(h, '<div class="ph"><div class="no">RITE II</div>', '<div class="ph now"><div class="no">RITE III</div><div><div class="t">The Note &amp; the Seal</div><div class="d">Pay-by-link private transfers and read-only view keys for selective disclosure. Shipped.</div></div><span class="st">Live</span></div>\n    <div class="ph"><div class="no">RITE II</div>');
fs.writeFileSync(H, h);

// ---- JS ----
a = rep(a, "$('b-priv-eye').onclick = () => { reveal = !reveal; renderPriv(); };", `$('b-priv-eye').onclick = () => { reveal = !reveal; renderPriv(); };
$('b-seal').onclick = async () => { if (needWallet()) return; const r = await api('/api/seal', { wallet }); if (r.error) return toast(r.error, true); tab = 'seal'; sealKey = r.viewKey; document.querySelectorAll('.tabs button').forEach((x) => x.classList.remove('on')); renderPanel(); $('demo').scrollIntoView({ behavior: 'smooth' }); };
let sealKey = '', claimSecret = '', lastNote = null;`);
a = rep(a, "  if (tab === 'deposit') {", `  if (tab === 'seal') {
    const url = location.origin + '/view#' + sealKey;
    p.innerHTML = \`<div class="note"><b>The Seal.</b> This view key opens a read-only statement of your shielded balance and history. It <b>cannot spend</b>. Give it only to who you want to see.</div>
      <div class="linkbox"><code id="vk">\${url}</code><button id="cp">Copy</button></div>
      <div class="kv" style="margin-top:12px"><span>opens</span><b><a href="\${url}" target="_blank" style="color:var(--gold)">sealed statement ↗</a></b></div>\`;
    $('cp').onclick = () => { navigator.clipboard.writeText(url); toast('view key copied'); };
  } else if (tab === 'claim') {
    p.innerHTML = \`<div class="note"><b>Someone sent you a Note.</b> Private sUSD is locked behind this link. Claim it into your shielded balance.</div>
      <div class="kv"><span>amount</span><b id="cl-amt">…</b></div><div class="kv"><span>memo</span><b id="cl-memo">—</b></div>
      <button class="btn wide" id="act" style="margin-top:14px">Claim into my shielded balance</button>\`;
    api('/api/note/peek', { secret: claimSecret }).then((r) => { if (r.error) { $('cl-amt').textContent = r.error; $('act').disabled = true; return; } $('cl-amt').textContent = r.claimed ? 'already claimed' : fmt(r.amt, 2) + ' sUSD'; $('cl-memo').textContent = r.memo || '—'; if (r.claimed) $('act').disabled = true; });
    $('act').onclick = () => doAct('/api/note/claim', { secret: claimSecret, amount: 1 }, (r) => { history.replaceState(null, '', location.pathname); tab = 'send'; renderPanel(); return \`claimed \${fmt(r.claimed, 2)} sUSD — privately\`; });
  } else if (tab === 'deposit') {`);
// send tab: add "pay by link"
a = rep(a, `<button class="btn wide" id="act" style="margin-top:14px">Send privately</button>\`;
    $('mx').onclick = () => { if (A) $('in').value = A.priv; };
    $('act').onclick = () => doAct('/api/send', { to: ($('to').value || '').trim(), amount: +$('in').value }, (r) => \`sent \${fmt(r.sent, 2)} sUSD — privately\`);`,
`<button class="btn wide" id="act" style="margin-top:14px">Send privately</button>
      <div class="note" style="margin:18px 0 8px"><b>Or write a Note:</b> no address needed. Lock the amount above behind a link and send the link to anyone.</div>
      <div class="field"><input id="memo" placeholder="memo (optional, seen only by the claimer)" maxlength="80"></div>
      <button class="btn ghost wide" id="act2">Create pay link</button>
      \${lastNote ? '<div class="linkbox"><code>' + lastNote + '</code><button id="cpn">Copy</button></div>' : ''}\`;
    $('mx').onclick = () => { if (A) $('in').value = A.priv; };
    $('act').onclick = () => doAct('/api/send', { to: ($('to').value || '').trim(), amount: +$('in').value }, (r) => \`sent \${fmt(r.sent, 2)} sUSD — privately\`);
    $('act2').onclick = () => doAct('/api/note/create', { amount: +$('in').value, memo: $('memo').value }, (r) => { lastNote = location.origin + '/#claim=' + r.secret; renderPanel(); return \`note written for \${fmt(r.amt, 2)} sUSD — copy the link\`; });
    if ($('cpn')) $('cpn').onclick = () => { navigator.clipboard.writeText(lastNote); toast('link copied'); };`);
// claim deep link
a = rep(a, "(function () { const q = new URLSearchParams(location.search);", "(function () { const q = new URLSearchParams(location.search); const hm = /claim=([1-9A-HJ-NP-Za-km-z]+)/.exec(location.hash || ''); if (hm) { claimSecret = hm[1]; tab = 'claim'; setTimeout(() => $('demo').scrollIntoView(), 400); }");
fs.writeFileSync(A, a); console.log('client patched');
