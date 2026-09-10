'use strict';
const $ = (id) => document.getElementById(id);
const api = (u, b) => fetch(u, b ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) } : undefined).then((r) => r.json());
const fmt = (n, d = 2) => (n == null || !isFinite(n)) ? '—' : (+n).toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d });
const big = (n) => Math.abs(n) >= 1e6 ? fmt(n / 1e6, 2) + 'M' : Math.abs(n) >= 1e3 ? fmt(n / 1e3, 1) + 'K' : fmt(n, 0);
const ago = (ts) => { const s = Math.max(0, (Date.now() - ts) / 1000); return s < 60 ? Math.floor(s) + 's ago' : Math.floor(s / 60) + 'm ago'; };
function toast(m, err) { const t = $('toast'); t.textContent = m; t.className = 'toast on' + (err ? ' err' : ''); clearTimeout(toast._t); toast._t = setTimeout(() => t.className = 'toast', 2400); }

let M = null, A = null, tab = 'mint', reveal = false;
const dur = (ms) => { const d = Math.floor(ms / 864e5), hh = Math.floor(ms % 864e5 / 36e5), mm = Math.floor(ms % 36e5 / 6e4); return d > 0 ? d + 'd ' + hh + 'h' : hh + 'h ' + mm + 'm'; };
let wallet = localStorage.getItem('styx_w') || '';
let refParam = ''; try { const q = new URLSearchParams(location.search); if (/^0x[a-fA-F0-9]{40}$/.test(q.get('ref') || '')) { refParam = q.get('ref').toLowerCase(); localStorage.setItem('styx_ref', refParam); } else refParam = localStorage.getItem('styx_ref') || ''; } catch (e) {}

function setConnected() { const b = $('connect'); b.textContent = wallet ? wallet.slice(0, 4) + '…' + wallet.slice(-4) : 'Connect'; }
const CHAIN_HEX = '0x1237';
const evm = () => window.ethereum || null;
async function ensureChain(eth) { try { await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: CHAIN_HEX }] }); } catch (e) { if (e && e.code === 4902) { try { await eth.request({ method: 'wallet_addEthereumChain', params: [{ chainId: CHAIN_HEX, chainName: 'Robinhood Chain', nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: ['https://rpc.mainnet.chain.robinhood.com'], blockExplorerUrls: ['https://explorer.mainnet.chain.robinhood.com'] }] }); } catch (e2) {} } } }
async function connectPhantom() {                                // EVM wallet on Robinhood Chain (name kept for the call sites)
  const eth = evm();
  if (!eth) { $('wmodal').classList.add('on'); return; }          // fallback: paste an address
  try {
    const acc = await eth.request({ method: 'eth_requestAccounts' });
    if (!acc || !acc.length) throw new Error('no account');
    await ensureChain(eth);
    const pk = acc[0].toLowerCase();
    wallet = pk; localStorage.setItem('styx_w', pk); setConnected(); toast('wallet connected · Robinhood Chain'); await loadAccount();
  } catch (e) { toast('connection cancelled', true); }
}
if (window.ethereum && window.ethereum.on) window.ethereum.on('accountsChanged', (acc) => { if (acc && acc.length) { wallet = acc[0].toLowerCase(); localStorage.setItem('styx_w', wallet); setConnected(); loadAccount(); } });
$('connect').onclick = async () => {
  if (wallet) {                                                   // already connected -> disconnect
    wallet = ''; localStorage.removeItem('styx_w'); A = null; setConnected(); renderAccount(); toast('disconnected'); return;
  }
  await connectPhantom();
};
$('wmodal').onclick = (e) => { if (e.target.id === 'wmodal') $('wmodal').classList.remove('on'); };
$('wsave').onclick = async () => { const v = $('waddr').value.trim(); if (!/^0x[a-fA-F0-9]{40}$/.test(v)) return toast('invalid address', true); wallet = v.toLowerCase(); localStorage.setItem('styx_w', v); setConnected(); $('wmodal').classList.remove('on'); toast('file opened'); await loadAccount(); };
function needWallet() { if (!wallet) { connectPhantom(); return true; } return false; }
$('cta-demo').onclick = () => $('demo').scrollIntoView({ behavior: 'smooth' });

// ---------- metrics ----------
async function loadMetrics() { M = await api('/api/metrics'); renderMetrics(); }
function renderMetrics() {
  if (!M) return;
  const pegEl = $('s-peg'); pegEl.textContent = '$' + fmt(M.susdPrice, 4); pegEl.className = 'v peg ' + M.pegStatus;
  $('s-cr').textContent = fmt(M.cr * 100, 1) + '%';
  $('s-col').textContent = '$' + big(M.collateralUsd);
  $('s-sup').textContent = big(M.susdSupply) + ' sUSD';
  $('s-shd').textContent = big(M.shielded.totalValue) + ' sUSD';
  if (M.mint) { $('cabar').style.display = 'flex'; $('ca-mint').textContent = M.mint; }
  if (M.treasury) { $('trbar').style.display = 'flex'; $('tr-addr').textContent = M.treasury; }
  if (M.vigil) { const V = M.vigil;
    $('v-apy').textContent = fmt(V.apy * 100, 0) + '%'; $('v-staked').textContent = big(V.staked) + ' / ' + big(V.cap);
    $('v-pool').textContent = big(V.poolLeft) + ' STYX'; $('v-ends').textContent = V.startsIn > 0 ? 'opens in ' + dur(V.startsIn) : V.live ? dur(V.endsIn) : 'ended'; $('v-n').textContent = fmt(V.stakers, 0);
  }
  if (M.chain && M.chain.ok) $('tr-chain').textContent = '· on-chain: ' + fmt(M.chain.treasuryUsdg, 2) + ' USDG · ' + big(M.chain.treasuryStyx) + ' STYX';
  if (M.ferry) { const Fm = M.ferry;
    $('ferryboard').innerHTML = Fm.board.map((b, i) => `<div class="r"><span class="ty">#${i + 1}</span><span class="sg">${b.who}</span><span class="am">${b.souls} soul${b.souls === 1 ? '' : 's'} · ${fmt(b.earned, 2)} sUSD</span></div>`).join('') || '<div class="r"><span class="sg">no souls carried yet — write the first Note</span></div>';
  }
  if (M.pyre) { const P = M.pyre;
    $('p-styx').textContent = big(P.burnedStyx) + ' STYX'; $('p-usd').textContent = '$' + big(P.burnedUsd);
    $('p-toll').textContent = '$' + fmt(P.tollUsd, 2) + ' / $' + P.minUsd; $('p-ep').textContent = fmt(P.epochs, 0);
    $('pyrefeed').innerHTML = P.burns.map((b) => `<div class="r"><span class="ty burn">burn</span><span class="sg">epoch ${b.epoch} · ${b.id} · @ $${fmt(b.px, 6)}</span><span class="am">🔥 ${fmt(b.styx, 1)} STYX</span></div>`).join('') || '<div class="r"><span class="sg">the pyre is gathering its first toll…</span></div>';
  }
  $('feed').innerHTML = (M.feed.length ? M.feed : []).map((t) => {
    const right = t.type === 'private' ? '<span class="redact">█████</span>'
      : t.publicAmount != null ? fmt(t.publicAmount, 0) + ' sUSD' : '<span class="redact">████</span>';
    const ty = t.type === 'private' ? 'private' : t.type;
    return `<div class="r"><span class="ty ${t.type}">${ty}</span><span class="sg">${t.sig}</span><span class="am">${right}</span></div>`;
  }).join('') || '<div class="r"><span class="sg">no entries yet</span></div>';
}

// ---------- account ----------
async function loadAccount() { if (!wallet) { A = null; renderAccount(); return; } A = await api('/api/account', { wallet, ref: refParam || undefined }); if (A.error) { toast(A.error, true); A = null; } renderAccount(); }
function renderAccount() {
  if (wallet) { $('ferrybox').style.display = 'flex'; $('ferrylink').textContent = location.origin + '/?ref=' + wallet; } else $('ferrybox').style.display = 'none';
  $('f-souls').textContent = A ? fmt(A.souls, 0) : '—'; $('f-earned').textContent = A ? fmt(A.earned, 2) + ' sUSD' : '—';
  $('b-usdg').textContent = A ? fmt(A.usdg, 0) : '—';
  $('b-styx').textContent = A ? fmt(A.styx, 1) : '—';
  $('b-susd').textContent = A ? fmt(A.susd, 2) : '—';
  renderPriv();
  renderPanel();
}
function renderPriv() {
  const red = $('b-priv-red'), val = $('b-priv-val');
  if (reveal && A) { red.style.display = 'none'; val.style.display = ''; val.textContent = fmt(A.priv, 2); $('b-priv-eye').textContent = 'hide'; }
  else { red.style.display = ''; val.style.display = 'none'; $('b-priv-eye').textContent = 'reveal'; }
}
$('b-priv-eye').onclick = () => { reveal = !reveal; renderPriv(); };
$('b-seal').onclick = async () => { if (needWallet()) return; const r = await api('/api/seal', { wallet }); if (r.error) return toast(r.error, true); tab = 'seal'; sealKey = r.viewKey; document.querySelectorAll('.tabs button').forEach((x) => x.classList.remove('on')); renderPanel(); $('demo').scrollIntoView({ behavior: 'smooth' }); };
let sealKey = '', claimSecret = '', lastNote = null;

// ---------- demo tabs ----------
document.querySelectorAll('.tabs button').forEach((b) => b.onclick = () => { tab = b.dataset.tab; document.querySelectorAll('.tabs button').forEach((x) => x.classList.toggle('on', x === b)); renderPanel(); });
function renderPanel() {
  const p = $('panel'); const cr = M ? M.cr : 0.9, vp = M ? M.styxPrice : 0.85;
  if (tab === 'seal') {
    const url = location.origin + '/view#' + sealKey;
    p.innerHTML = `<div class="note"><b>The Seal.</b> This view key opens a read-only statement of your shielded balance and history. It <b>cannot spend</b>. Give it only to who you want to see.</div>
      <div class="linkbox"><code id="vk">${url}</code><button id="cp">Copy</button></div>
      <div class="kv" style="margin-top:12px"><span>opens</span><b><a href="${url}" target="_blank" style="color:var(--gold)">sealed statement ↗</a></b></div>`;
    $('cp').onclick = () => { navigator.clipboard.writeText(url); toast('view key copied'); };
  } else if (tab === 'claim') {
    p.innerHTML = `<div class="note"><b>Someone sent you a Note.</b> Private sUSD is locked behind this link. Claim it into your shielded balance.</div>
      <div class="kv"><span>amount</span><b id="cl-amt">…</b></div><div class="kv"><span>memo</span><b id="cl-memo">—</b></div>
      <button class="btn wide" id="act" style="margin-top:14px">Claim into my shielded balance</button>`;
    api('/api/note/peek', { secret: claimSecret }).then((r) => { if (r.error) { $('cl-amt').textContent = r.error; $('act').disabled = true; return; } $('cl-amt').textContent = r.claimed ? 'already claimed' : fmt(r.amt, 2) + ' sUSD'; $('cl-memo').textContent = r.memo || '—'; if (r.claimed) $('act').disabled = true; });
    $('act').onclick = () => doAct('/api/note/claim', { secret: claimSecret, amount: 1 }, (r) => { history.replaceState(null, '', location.pathname); tab = 'send'; renderPanel(); return `claimed ${fmt(r.claimed, 2)} sUSD — privately`; });
  } else if (tab === 'deposit') {
    p.innerHTML = `<div class="note">Send <b>USDG on Robinhood Chain</b> to the treasury and it is credited to your ledger once the receipt confirms. <b>Every deposited dollar sits in the treasury address</b> — see the on-chain balance in the Treasury bar below.</div>
      <div class="field"><input id="in" type="number" placeholder="50.00 minimum" min="50"><span class="u">USDG</span></div>
      <div class="kv"><span>Treasury</span><b>${M && M.treasury ? M.treasury.slice(0, 8) + '…' + M.treasury.slice(-6) : '—'}</b></div>
      <div class="kv"><span>Credited so far</span><b>${A ? fmt(A.deposited, 2) + ' USDG' : '—'}</b></div>
      <button class="btn wide" id="act" style="margin-top:14px">Send USDG from wallet</button>
      <div class="note" style="margin-top:14px;margin-bottom:8px">Already sent? Paste the transaction hash:</div>
      <div class="field"><input id="tx" placeholder="0x… transaction hash" spellcheck="false"></div>
      <button class="btn ghost wide" id="act2">Credit my deposit</button>`;
    $('act').onclick = () => sendUsdg(+$('in').value);
    $('act2').onclick = () => doAct('/api/deposit', { tx: ($('tx').value || '').trim(), amount: 1 }, (r) => `credited ${fmt(r.amt, 2)} USDG from the treasury deposit`);
  } else if (tab === 'vigil') {
    const V = M && M.vigil, me = A && A.vigil;
    p.innerHTML = `<div class="note">Stake public sUSD in <b>The Vigil</b>: <b>${V ? fmt(V.apy * 100, 0) : '—'}% APY</b> for 30 days, paid in <b>$STYX</b> from a pre-funded pool. Unstake any time (30 bps toll). ${V && !V.live ? '<b>The vigil is ' + (V.startsIn > 0 ? 'not open yet' : 'over') + '.</b>' : ''}</div>
      <div class="field"><input id="in" type="number" placeholder="0.00" min="0"><span class="u">sUSD</span><span class="mx" id="mx">MAX</span></div>
      <div class="kv"><span>Public sUSD</span><b>${A ? fmt(A.susd, 2) : '—'}</b></div>
      <div class="kv"><span>Keeping vigil</span><b>${me ? fmt(me.staked, 2) + ' sUSD' : '—'}</b></div>
      <div class="kv"><span>Earned · claimable</span><b>${me ? fmt(me.accruedStyx, 1) + ' STYX (≈ $' + fmt(me.accruedUsd, 4) + ')' : '—'}</b></div>
      <div style="display:flex;gap:10px;margin-top:14px"><button class="btn" id="act" style="flex:1">Stake</button><button class="btn ghost" id="act2" style="flex:1">Unstake</button><button class="btn ghost" id="act3" style="flex:1">Claim STYX</button></div>`;
    $('mx').onclick = () => { if (A) $('in').value = A.susd; };
    $('act').onclick = () => doAct('/api/stake', { amount: +$('in').value }, (r) => `${fmt(r.staked, 2)} sUSD keeps vigil`);
    $('act2').onclick = () => doAct('/api/unstake', { amount: +$('in').value }, (r) => `unstaked ${fmt(r.unstaked, 2)} sUSD`);
    $('act3').onclick = () => doAct('/api/claim', { amount: 1 }, (r) => `claimed ${fmt(r.claimedStyx, 1)} STYX`);
  } else if (tab === 'mint') {
    p.innerHTML = `<div class="note">Mint $1-pegged <b>sUSD</b> with deposited USDG: <b>${fmt(cr * 100, 0)}% goes to collateral</b>, the <b>${fmt((1 - cr) * 100, 0)}% algorithmic share buys STYX at market and burns it</b>. Nothing is printed.</div>
      <div class="field"><input id="in" type="number" placeholder="0.00" min="0"><span class="u">sUSD</span></div>
      <div class="kv"><span>USDG collateral (${fmt(cr * 100, 0)}%)</span><b id="o1">—</b></div><div class="kv"><span>USDG → buys &amp; burns STYX (${fmt((1 - cr) * 100, 0)}%)</span><b id="o2">—</b></div>
      <button class="btn wide" id="act" style="margin-top:14px">Mint sUSD</button>`;
    $('in').oninput = () => { const m = +$('in').value || 0; $('o1').textContent = fmt(m * cr, 2) + ' USDG'; $('o2').textContent = fmt(m * (1 - cr), 2) + ' USDG ≈ ' + fmt((m * (1 - cr)) / vp, 0) + ' STYX'; };
    $('act').onclick = () => doAct('/api/mint', { amount: +$('in').value }, (r) => `minted ${fmt(r.minted, 0)} sUSD`);
  } else if (tab === 'shield') {
    p.innerHTML = `<div class="note">Move public sUSD into the <b>shielded pool</b>. It becomes a note <b>encrypted only to you</b> — your balance reads <span class="redact">████</span> on-chain.</div>
      <div class="field"><input id="in" type="number" placeholder="0.00" min="0"><span class="u">sUSD</span><span class="mx" id="mx">MAX</span></div>
      <div class="kv"><span>Public sUSD available</span><b>${A ? fmt(A.susd, 2) : '—'}</b></div>
      <button class="btn wide" id="act" style="margin-top:14px">Shield sUSD</button>`;
    $('mx').onclick = () => { if (A) $('in').value = A.susd; };
    $('act').onclick = () => doAct('/api/shield', { amount: +$('in').value }, (r) => `shielded ${fmt(r.shielded, 2)} sUSD`);
  } else if (tab === 'send') {
    p.innerHTML = `<div class="note">Send shielded sUSD. The <b>amount and both parties are hidden</b> — the ledger records only a nullifier + a new commitment.</div>
      <div class="field"><input id="to" placeholder="recipient Robinhood Chain address…" spellcheck="false"></div>
      <div class="field"><input id="in" type="number" placeholder="0.00" min="0"><span class="u">sUSD</span><span class="mx" id="mx">MAX</span></div>
      <div class="kv"><span>Your private balance</span><b>${A ? (reveal ? fmt(A.priv, 2) : '████') : '—'}</b></div>
      <button class="btn wide" id="act" style="margin-top:14px">Send privately</button>
      <div class="note" style="margin:18px 0 8px"><b>Or write a Note:</b> no address needed. Lock the amount above behind a link and send the link to anyone.</div>
      <div class="field"><input id="memo" placeholder="memo (optional, seen only by the claimer)" maxlength="80"></div>
      <button class="btn ghost wide" id="act2">Create pay link</button>
      ${lastNote ? '<div class="linkbox"><code>' + lastNote + '</code><button id="cpn">Copy</button></div>' : ''}`;
    $('mx').onclick = () => { if (A) $('in').value = A.priv; };
    $('act').onclick = () => doAct('/api/send', { to: ($('to').value || '').trim(), amount: +$('in').value }, (r) => `sent ${fmt(r.sent, 2)} sUSD — privately`);
    $('act2').onclick = () => doAct('/api/note/create', { amount: +$('in').value, memo: $('memo').value }, (r) => { lastNote = location.origin + '/#claim=' + r.secret; renderPanel(); return `note written for ${fmt(r.amt, 2)} sUSD — copy the link`; });
    if ($('cpn')) $('cpn').onclick = () => { navigator.clipboard.writeText(lastNote); toast('link copied'); };
  } else {
    p.innerHTML = `<div class="note">Burn sUSD to recover your <b>${fmt(cr * 100, 0)}% USDG</b> plus the <b>${fmt((1 - cr) * 100, 0)}% STYX</b> share. (Unshield private sUSD first to redeem it.)</div>
      <div class="field"><input id="in" type="number" placeholder="0.00" min="0"><span class="u">sUSD</span><span class="mx" id="mx">MAX</span></div>
      <div class="kv"><span>Public sUSD</span><b>${A ? fmt(A.susd, 2) : '—'}</b></div>
      <div class="kv"><span>USDG on ledger</span><b>${A ? fmt(A.usdg, 2) : '—'}</b></div>
      <div style="display:flex;gap:10px;margin-top:14px"><button class="btn ghost" id="act2" style="flex:1">Unshield</button><button class="btn" id="act" style="flex:1">Redeem</button><button class="btn ghost" id="act3" style="flex:1">Withdraw USDG</button></div>
      ${A && A.queue && A.queue.length ? '<div class="note" style="margin-top:14px">' + A.queue.map((q) => '<div class="kv"><span>withdraw ' + fmt(q.amt, 2) + ' USDG · ' + q.id + '</span><b>' + (q.status === 'paid' ? 'paid' + (q.tx ? ' · ' + q.tx.slice(0, 10) + '…' : '') : 'queued · treasury pays within 24h') + '</b></div>').join('') + '</div>' : ''}`;
    $('mx').onclick = () => { if (A) $('in').value = A.susd; };
    $('act').onclick = () => doAct('/api/redeem', { amount: +$('in').value }, (r) => `redeemed ${fmt(r.redeemed, 0)} sUSD`);
    $('act2').onclick = () => doAct('/api/unshield', { amount: +$('in').value }, (r) => `unshielded ${fmt(r.unshielded, 2)} sUSD`);
    $('act3').onclick = () => doAct('/api/withdraw', { amount: +$('in').value }, (r) => `queued ${fmt(r.queued.amt, 2)} USDG for payout`);
  }
}
async function sendUsdg(amount) {
  if (needWallet()) return; if (!amount || amount <= 0) return toast('enter an amount', true); const minDep = (M && M.minDeposit) || 50; if (amount < minDep) return toast('minimum deposit is ' + minDep + ' USDG', true);
  const eth = evm(); if (!eth) return toast('open a wallet to send USDG, or paste a tx hash', true);
  if (!M || !M.chain || !M.chain.usdg || !M.treasury) return toast('treasury not configured', true);
  try {
    await ensureChain(eth);
    const units = BigInt(Math.round(amount * 1e6)).toString(16).padStart(64, '0');
    const data = '0xa9059cbb' + M.treasury.slice(2).toLowerCase().padStart(64, '0') + units;
    const tx = await eth.request({ method: 'eth_sendTransaction', params: [{ from: wallet, to: M.chain.usdg, data }] });
    toast('sent · waiting for the receipt…');
    for (let i = 0; i < 40; i++) { await new Promise((r) => setTimeout(r, 3000)); const r = await api('/api/deposit', { wallet, tx }); if (r.ok) { A = r; renderAccount(); loadMetrics(); return toast(`credited ${fmt(r.amt, 2)} USDG`); } if (r.error && !/pending|not found/.test(r.error)) return toast(r.error, true); }
    toast('still pending — paste the hash to credit later', true);
  } catch (e) { toast('transaction cancelled', true); }
}
async function doAct(url, payload, msg) {
  if (needWallet()) return;
  if (!payload.amount) return toast('enter an amount', true);
  const r = await api(url, Object.assign({ wallet }, payload));
  if (r.error) return toast(r.error, true);
  A = r; renderAccount(); loadMetrics(); toast(msg(r));
}
$('ferrycopy').onclick = () => { navigator.clipboard.writeText(location.origin + '/?ref=' + wallet); toast('ferry link copied'); };
$('ca-copy').onclick = () => { navigator.clipboard.writeText(M.mint); toast('copied'); };
$('tr-copy').onclick = () => { navigator.clipboard.writeText(M.treasury); toast('copied'); };

// deep-link / capture: ?w=<address> opens a wallet's ledger, &tab=<mint|shield|send|redeem>, &reveal=1
(function () { const q = new URLSearchParams(location.search); const hm = /claim=([1-9A-HJ-NP-Za-km-z]+)/.exec(location.hash || ''); if (hm) { claimSecret = hm[1]; tab = 'claim'; setTimeout(() => $('demo').scrollIntoView(), 400); }
  if (q.get('w')) wallet = q.get('w');
  if (q.get('tab')) tab = q.get('tab');
  if (q.get('reveal') === '1') reveal = true; })();

document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));

(async function () { await api('/api/config'); setConnected(); await loadMetrics(); await loadAccount(); renderPanel(); setInterval(loadMetrics, 5000); })();
