// one-shot client patch for real deposits + THE VIGIL. Run once from styx/.
const fs = require('fs'); const path = require('path');
const H = path.join(__dirname, '..', 'client', 'index.html'); const A = path.join(__dirname, '..', 'client', 'src', 'app.js');
let h = fs.readFileSync(H, 'utf8'); let a = fs.readFileSync(A, 'utf8');
const rep = (s, x, y) => { const i = s.indexOf(x); if (i < 0) throw new Error('missing: ' + x.slice(0, 70)); return s.slice(0, i) + y + s.slice(i + x.length); };

// ---- HTML ----
h = rep(h, '<button class="on" data-tab="mint">Mint</button>', '<button data-tab="deposit">Deposit</button><button class="on" data-tab="mint">Mint</button>');
h = rep(h, '<button data-tab="redeem">Redeem</button>', '<button data-tab="vigil">The Vigil</button><button data-tab="redeem">Redeem</button>');
h = rep(h, '.led .ty.burn{', `.vig{display:grid;grid-template-columns:repeat(5,1fr);background:linear-gradient(180deg,#0f1410,var(--stone));border:1px solid rgba(98,161,135,.4);border-radius:3px;position:relative;overflow:hidden}
.vig::before{content:"";position:absolute;inset:0;background:radial-gradient(60% 90% at 50% -20%,rgba(98,161,135,.16),transparent 70%);pointer-events:none}
.vig .stat .v{color:var(--ink)}.vig .stat .v.g{color:var(--verd);text-shadow:0 0 18px rgba(98,161,135,.4)}
.vig-note{font-size:14px;color:var(--dim);font-style:italic;margin:12px 2px 0}.vig-note b{font-style:normal;color:var(--verd)}
.tmp{font-family:'JetBrains Mono';font-size:10px;letter-spacing:.2em;color:#0a0807;background:var(--verd);padding:3px 7px;border-radius:2px;margin-left:12px;vertical-align:middle}
.led .ty.burn{`);
h = rep(h, '  <!-- THE PYRE -->', `  <!-- THE VIGIL -->
  <div class="sec" id="vigil"><span>The vigil · temporary staking<span class="tmp">30 DAYS</span></span></div>
  <div class="vig">
    <div class="stat"><div class="l">APY · paid in $STYX</div><div class="v g" id="v-apy">—</div></div>
    <div class="stat"><div class="l">sUSD keeping vigil</div><div class="v" id="v-staked">—</div></div>
    <div class="stat"><div class="l">reward pool left</div><div class="v" id="v-pool">—</div></div>
    <div class="stat"><div class="l">ends in</div><div class="v" id="v-ends">—</div></div>
    <div class="stat"><div class="l">watchers</div><div class="v" id="v-n">—</div></div>
  </div>
  <div class="vig-note">Temporary by design. Stake sUSD for <b>30 days</b> and earn a fixed APY paid in <b>$STYX from a pre-funded treasury pool</b>. Nothing is printed, no sUSD is created, and when the pool or the clock runs out the vigil ends. <b>This is how you avoid the Anchor problem:</b> a yield that has an end date cannot become the thing holding up the peg.</div>

  <!-- THE PYRE -->`);
h = rep(h, '<div class="ca" id="trbar" style="display:none"><span class="t">Treasury</span><code id="tr-addr"></code><button id="tr-copy">Copy</button></div>',
  '<div class="ca" id="trbar" style="display:none"><span class="t">Treasury</span><code id="tr-addr"></code><button id="tr-copy">Copy</button><span class="t" id="tr-chain" style="margin-left:10px"></span></div>');
h = rep(h, '<details><summary>What is The Pyre?</summary>', `<details><summary>Is my USDG actually deposited?</summary><div class="a">Yes. Minting starts with a real <b>USDG transfer on Robinhood Chain to the treasury</b>. The server reads the transaction receipt, checks the Transfer log is from your wallet to the treasury, and only then credits your ledger. Every deposited dollar sits in the treasury address you can see on the explorer. <i>Nothing on this site is paper any more.</i></div></details>
    <details><summary>How do I get USDG back out?</summary><div class="a">Redeem sUSD for USDG on the ledger, then <b>Withdraw</b>. Withdrawals go into a queue the treasury pays out by hand from a cold wallet, usually within 24 hours, and the payout tx hash is written next to your request. There is deliberately <b>no hot key on the server</b>.</div></details>
    <details><summary>What is The Vigil, and why is it temporary?</summary><div class="a">A 30-day staking window: stake sUSD, earn a fixed APY, paid in <b>$STYX from a pool the treasury set aside in advance</b>. It has a hard end date and a hard pool size. Anchor's 20% was permanent and subsidised, so it became the only reason to hold UST and the peg died with it. A yield that <i>ends</i> can't do that.</div></details>
    <details><summary>What is The Pyre?</summary>`);
fs.writeFileSync(H, h);

// ---- JS ----
a = rep(a, "let M = null, A = null, tab = 'mint', reveal = false;", "let M = null, A = null, tab = 'mint', reveal = false;\nconst dur = (ms) => { const d = Math.floor(ms / 864e5), hh = Math.floor(ms % 864e5 / 36e5), mm = Math.floor(ms % 36e5 / 6e4); return d > 0 ? d + 'd ' + hh + 'h' : hh + 'h ' + mm + 'm'; };");
a = rep(a, "  if (M.pyre) { const P = M.pyre;", `  if (M.vigil) { const V = M.vigil;
    $('v-apy').textContent = fmt(V.apy * 100, 0) + '%'; $('v-staked').textContent = big(V.staked) + ' / ' + big(V.cap);
    $('v-pool').textContent = big(V.poolLeft) + ' STYX'; $('v-ends').textContent = V.startsIn > 0 ? 'opens in ' + dur(V.startsIn) : V.live ? dur(V.endsIn) : 'ended'; $('v-n').textContent = fmt(V.stakers, 0);
  }
  if (M.chain && M.chain.ok) $('tr-chain').textContent = '· on-chain: ' + fmt(M.chain.treasuryUsdg, 2) + ' USDG · ' + big(M.chain.treasuryStyx) + ' STYX';
  if (M.pyre) { const P = M.pyre;`);

// deposit + vigil panels, withdraw in redeem
a = rep(a, "  if (tab === 'mint') {", `  if (tab === 'deposit') {
    p.innerHTML = \`<div class="note">Send <b>USDG on Robinhood Chain</b> to the treasury and it is credited to your ledger once the receipt confirms. <b>Every deposited dollar sits in the treasury address</b> — see the on-chain balance in the Treasury bar below.</div>
      <div class="field"><input id="in" type="number" placeholder="0.00" min="0"><span class="u">USDG</span></div>
      <div class="kv"><span>Treasury</span><b>\${M && M.treasury ? M.treasury.slice(0, 8) + '…' + M.treasury.slice(-6) : '—'}</b></div>
      <div class="kv"><span>Credited so far</span><b>\${A ? fmt(A.deposited, 2) + ' USDG' : '—'}</b></div>
      <button class="btn wide" id="act" style="margin-top:14px">Send USDG from wallet</button>
      <div class="note" style="margin-top:14px;margin-bottom:8px">Already sent? Paste the transaction hash:</div>
      <div class="field"><input id="tx" placeholder="0x… transaction hash" spellcheck="false"></div>
      <button class="btn ghost wide" id="act2">Credit my deposit</button>\`;
    $('act').onclick = () => sendUsdg(+$('in').value);
    $('act2').onclick = () => doAct('/api/deposit', { tx: ($('tx').value || '').trim(), amount: 1 }, (r) => \`credited \${fmt(r.amt, 2)} USDG from the treasury deposit\`);
  } else if (tab === 'vigil') {
    const V = M && M.vigil, me = A && A.vigil;
    p.innerHTML = \`<div class="note">Stake public sUSD in <b>The Vigil</b>: <b>\${V ? fmt(V.apy * 100, 0) : '—'}% APY</b> for 30 days, paid in <b>$STYX</b> from a pre-funded pool. Unstake any time (30 bps toll). \${V && !V.live ? '<b>The vigil is ' + (V.startsIn > 0 ? 'not open yet' : 'over') + '.</b>' : ''}</div>
      <div class="field"><input id="in" type="number" placeholder="0.00" min="0"><span class="u">sUSD</span><span class="mx" id="mx">MAX</span></div>
      <div class="kv"><span>Public sUSD</span><b>\${A ? fmt(A.susd, 2) : '—'}</b></div>
      <div class="kv"><span>Keeping vigil</span><b>\${me ? fmt(me.staked, 2) + ' sUSD' : '—'}</b></div>
      <div class="kv"><span>Earned · claimable</span><b>\${me ? fmt(me.accruedStyx, 1) + ' STYX (≈ $' + fmt(me.accruedUsd, 4) + ')' : '—'}</b></div>
      <div style="display:flex;gap:10px;margin-top:14px"><button class="btn" id="act" style="flex:1">Stake</button><button class="btn ghost" id="act2" style="flex:1">Unstake</button><button class="btn ghost" id="act3" style="flex:1">Claim STYX</button></div>\`;
    $('mx').onclick = () => { if (A) $('in').value = A.susd; };
    $('act').onclick = () => doAct('/api/stake', { amount: +$('in').value }, (r) => \`\${fmt(r.staked, 2)} sUSD keeps vigil\`);
    $('act2').onclick = () => doAct('/api/unstake', { amount: +$('in').value }, (r) => \`unstaked \${fmt(r.unstaked, 2)} sUSD\`);
    $('act3').onclick = () => doAct('/api/claim', { amount: 1 }, (r) => \`claimed \${fmt(r.claimedStyx, 1)} STYX\`);
  } else if (tab === 'mint') {`);
a = rep(a, `<div class="kv"><span>USDG collateral</span><b id="o1">—</b></div><div class="kv"><span>STYX burned</span><b id="o2">—</b></div>`,
  `<div class="kv"><span>USDG collateral (\${fmt(cr * 100, 0)}%)</span><b id="o1">—</b></div><div class="kv"><span>USDG → buys &amp; burns STYX (\${fmt((1 - cr) * 100, 0)}%)</span><b id="o2">—</b></div>`);
a = rep(a, "Mint $1-pegged <b>sUSD</b> by posting <b>${fmt(cr * 100, 0)}% USDG collateral</b> and burning the <b>${fmt((1 - cr) * 100, 0)}% algorithmic share</b> in STYX.",
  "Mint $1-pegged <b>sUSD</b> with deposited USDG: <b>${fmt(cr * 100, 0)}% goes to collateral</b>, the <b>${fmt((1 - cr) * 100, 0)}% algorithmic share buys STYX at market and burns it</b>. Nothing is printed.");
a = rep(a, "$('o2').textContent = fmt((m * (1 - cr)) / vp, 2) + ' STYX'; };", "$('o2').textContent = fmt(m * (1 - cr), 2) + ' USDG ≈ ' + fmt((m * (1 - cr)) / vp, 0) + ' STYX'; };");
a = rep(a, `<div style="display:flex;gap:10px;margin-top:14px"><button class="btn ghost" id="act2" style="flex:1">Unshield</button><button class="btn" id="act" style="flex:1">Redeem</button></div>\`;`,
  `<div class="kv"><span>USDG on ledger</span><b>\${A ? fmt(A.usdg, 2) : '—'}</b></div>
      <div style="display:flex;gap:10px;margin-top:14px"><button class="btn ghost" id="act2" style="flex:1">Unshield</button><button class="btn" id="act" style="flex:1">Redeem</button><button class="btn ghost" id="act3" style="flex:1">Withdraw USDG</button></div>
      \${A && A.queue && A.queue.length ? '<div class="note" style="margin-top:14px">' + A.queue.map((q) => '<div class="kv"><span>withdraw ' + fmt(q.amt, 2) + ' USDG · ' + q.id + '</span><b>' + (q.status === 'paid' ? 'paid' + (q.tx ? ' · ' + q.tx.slice(0, 10) + '…' : '') : 'queued · treasury pays within 24h') + '</b></div>').join('') + '</div>' : ''}\`;`);
a = rep(a, "$('act2').onclick = () => doAct('/api/unshield', { amount: +$('in').value }, (r) => `unshielded ${fmt(r.unshielded, 2)} sUSD`);",
  "$('act2').onclick = () => doAct('/api/unshield', { amount: +$('in').value }, (r) => `unshielded ${fmt(r.unshielded, 2)} sUSD`);\n    $('act3').onclick = () => doAct('/api/withdraw', { amount: +$('in').value }, (r) => `queued ${fmt(r.queued.amt, 2)} USDG for payout`);");

// send USDG via wallet (ERC-20 transfer to treasury), then credit by hash
a = rep(a, "async function doAct(url, payload, msg) {", `async function sendUsdg(amount) {
  if (needWallet()) return; if (!amount || amount <= 0) return toast('enter an amount', true);
  const eth = evm(); if (!eth) return toast('open a wallet to send USDG, or paste a tx hash', true);
  if (!M || !M.chain || !M.chain.usdg || !M.treasury) return toast('treasury not configured', true);
  try {
    await ensureChain(eth);
    const units = BigInt(Math.round(amount * 1e6)).toString(16).padStart(64, '0');
    const data = '0xa9059cbb' + M.treasury.slice(2).toLowerCase().padStart(64, '0') + units;
    const tx = await eth.request({ method: 'eth_sendTransaction', params: [{ from: wallet, to: M.chain.usdg, data }] });
    toast('sent · waiting for the receipt…');
    for (let i = 0; i < 40; i++) { await new Promise((r) => setTimeout(r, 3000)); const r = await api('/api/deposit', { wallet, tx }); if (r.ok) { A = r; renderAccount(); loadMetrics(); return toast(\`credited \${fmt(r.amt, 2)} USDG\`); } if (r.error && !/pending|not found/.test(r.error)) return toast(r.error, true); }
    toast('still pending — paste the hash to credit later', true);
  } catch (e) { toast('transaction cancelled', true); }
}
async function doAct(url, payload, msg) {`);
fs.writeFileSync(A, a); console.log('client patched');
