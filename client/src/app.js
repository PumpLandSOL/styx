'use strict';
const $ = (id) => document.getElementById(id);
const api = (u, b) => fetch(u, b ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) } : undefined).then((r) => r.json());
const fmt = (n, d = 2) => (n == null || !isFinite(n)) ? '—' : (+n).toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d });
const big = (n) => Math.abs(n) >= 1e6 ? fmt(n / 1e6, 2) + 'M' : Math.abs(n) >= 1e3 ? fmt(n / 1e3, 1) + 'K' : fmt(n, 0);
const ago = (ts) => { const s = Math.max(0, (Date.now() - ts) / 1000); return s < 60 ? Math.floor(s) + 's ago' : Math.floor(s / 60) + 'm ago'; };
function toast(m, err) { const t = $('toast'); t.textContent = m; t.className = 'toast on' + (err ? ' err' : ''); clearTimeout(toast._t); toast._t = setTimeout(() => t.className = 'toast', 2400); }

let M = null, A = null, tab = 'mint', reveal = false;
let wallet = localStorage.getItem('styx_w') || '';

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
  $('feed').innerHTML = (M.feed.length ? M.feed : []).map((t) => {
    const right = t.type === 'private' ? '<span class="redact">█████</span>'
      : t.publicAmount != null ? fmt(t.publicAmount, 0) + ' sUSD' : '<span class="redact">████</span>';
    const ty = t.type === 'private' ? 'private' : t.type;
    return `<div class="r"><span class="ty ${t.type}">${ty}</span><span class="sg">${t.sig}</span><span class="am">${right}</span></div>`;
  }).join('') || '<div class="r"><span class="sg">no entries yet</span></div>';
}

// ---------- account ----------
async function loadAccount() { if (!wallet) { A = null; renderAccount(); return; } A = await api('/api/account', { wallet }); if (A.error) { toast(A.error, true); A = null; } renderAccount(); }
function renderAccount() {
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

// ---------- demo tabs ----------
document.querySelectorAll('.tabs button').forEach((b) => b.onclick = () => { tab = b.dataset.tab; document.querySelectorAll('.tabs button').forEach((x) => x.classList.toggle('on', x === b)); renderPanel(); });
function renderPanel() {
  const p = $('panel'); const cr = M ? M.cr : 0.9, vp = M ? M.styxPrice : 0.85;
  if (tab === 'mint') {
    p.innerHTML = `<div class="note">Mint $1-pegged <b>sUSD</b> by posting <b>${fmt(cr * 100, 0)}% USDG collateral</b> and burning the <b>${fmt((1 - cr) * 100, 0)}% algorithmic share</b> in STYX.</div>
      <div class="field"><input id="in" type="number" placeholder="0.00" min="0"><span class="u">sUSD</span></div>
      <div class="kv"><span>USDG collateral</span><b id="o1">—</b></div><div class="kv"><span>STYX burned</span><b id="o2">—</b></div>
      <button class="btn wide" id="act" style="margin-top:14px">Mint sUSD</button>`;
    $('in').oninput = () => { const m = +$('in').value || 0; $('o1').textContent = fmt(m * cr, 2) + ' USDG'; $('o2').textContent = fmt((m * (1 - cr)) / vp, 2) + ' STYX'; };
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
      <button class="btn wide" id="act" style="margin-top:14px">Send privately</button>`;
    $('mx').onclick = () => { if (A) $('in').value = A.priv; };
    $('act').onclick = () => doAct('/api/send', { to: ($('to').value || '').trim(), amount: +$('in').value }, (r) => `sent ${fmt(r.sent, 2)} sUSD — privately`);
  } else {
    p.innerHTML = `<div class="note">Burn sUSD to recover your <b>${fmt(cr * 100, 0)}% USDG</b> plus the <b>${fmt((1 - cr) * 100, 0)}% STYX</b> share. (Unshield private sUSD first to redeem it.)</div>
      <div class="field"><input id="in" type="number" placeholder="0.00" min="0"><span class="u">sUSD</span><span class="mx" id="mx">MAX</span></div>
      <div class="kv"><span>Public sUSD</span><b>${A ? fmt(A.susd, 2) : '—'}</b></div>
      <div style="display:flex;gap:10px;margin-top:14px"><button class="btn ghost" id="act2" style="flex:1">Unshield</button><button class="btn" id="act" style="flex:1">Redeem</button></div>`;
    $('mx').onclick = () => { if (A) $('in').value = A.susd; };
    $('act').onclick = () => doAct('/api/redeem', { amount: +$('in').value }, (r) => `redeemed ${fmt(r.redeemed, 0)} sUSD`);
    $('act2').onclick = () => doAct('/api/unshield', { amount: +$('in').value }, (r) => `unshielded ${fmt(r.unshielded, 2)} sUSD`);
  }
}
async function doAct(url, payload, msg) {
  if (needWallet()) return;
  if (!payload.amount) return toast('enter an amount', true);
  const r = await api(url, Object.assign({ wallet }, payload));
  if (r.error) return toast(r.error, true);
  A = r; renderAccount(); loadMetrics(); toast(msg(r));
}
$('ca-copy').onclick = () => { navigator.clipboard.writeText(M.mint); toast('copied'); };
$('tr-copy').onclick = () => { navigator.clipboard.writeText(M.treasury); toast('copied'); };

// deep-link / capture: ?w=<address> opens a wallet's ledger, &tab=<mint|shield|send|redeem>, &reveal=1
(function () { const q = new URLSearchParams(location.search);
  if (q.get('w')) wallet = q.get('w');
  if (q.get('tab')) tab = q.get('tab');
  if (q.get('reveal') === '1') reveal = true; })();

document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));

(async function () { await api('/api/config'); setConnected(); await loadMetrics(); await loadAccount(); renderPanel(); setInterval(loadMetrics, 5000); })();
