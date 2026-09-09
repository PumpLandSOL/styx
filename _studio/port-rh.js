// One-shot port: OBOL (Solana) → OBOL on Robinhood Chain. Run from obol-rh/: node _studio/port-rh.js
// Function-form replacements only (the `$'` gotcha).
'use strict';
const fs = require('fs'); const path = require('path');
const R = path.join(__dirname, '..');
const rd = (f) => fs.readFileSync(path.join(R, f), 'utf8'); const wr = (f, s) => fs.writeFileSync(path.join(R, f), s);
const rep = (s, a, b) => { if (!s.includes(a)) console.log('  MISS:', a.slice(0, 80)); return s.split(a).join(b); };
const EXPLORER = 'https://explorer.mainnet.chain.robinhood.com';

// ── server ────────────────────────────────────────────────────────────────────
let s = rd('server/index.js');
s = rep(s, '// OBOL — a private, fractional-algorithmic stablecoin (Phase-0 DEMO / proof-of-concept).', '// OBOL — a private, fractional-algorithmic stablecoin on Robinhood Chain (Rite I: off-chain ledger, real privacy primitives).');
s = rep(s, '//   OBOL  : the governance/share token (the Pump.fun launch token)', '//   OBOL  : the governance/share token ($OBOL on Robinhood Chain)');
s = rep(s, '// but the peg + ledger are SIMULATED off-chain and the trustless ZK proof is simulated on testnet.\n// NOT a live protocol — a demo. Algorithmic stablecoins are high-risk (see UST/Terra). Dependency-free.', '// but the peg + ledger run off-chain in Rite I and the trustless ZK proof arrives with the on-chain rites.\n// Algorithmic stablecoins are high-risk (see UST/Terra). Dependency-free.');
s = rep(s, "const PORT = process.env.PORT || 8109;", "const PORT = process.env.PORT || 8198;");
s = rep(s, "const OBOL_MINT = process.env.OBOL_MINT || '';            // CA bar (dormant)", "const OBOL_MINT = process.env.OBOL_MINT || '';            // $OBOL on Robinhood Chain — CA bar lights when set");
s = rep(s, "const SEED = { usdc: 10000, obol: 500, ousd: 0, priv: 0 };", "const SEED = { usdg: 10000, obol: 500, ousd: 0, priv: 0 };");
s = rep(s, '// SOL+USDC reserves backing oUSD', '// ETH+USDG reserves backing oUSD');
s = rep(s, "const isWallet = (s) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s);", "const isWallet = (s) => /^0x[a-fA-F0-9]{40}$/.test(s);");
s = rep(s, "db.wallets[a] || (db.wallets[a] = { usdc: SEED.usdc,", "db.wallets[a] || (db.wallets[a] = { usdg: SEED.usdg,");
// real $OBOL price from Robinhood Chain pools once the mint is set (overrides the drift)
s = rep(s, "// ---------- peg / algo tick ----------", `// ---------- $OBOL price: Robinhood Chain pools (DexScreener) when OBOL_MINT is set ----------
let OBOL_LIVE = { px: 0, liq: 0, pair: '', t: 0 };
async function pollObol() {
  if (!OBOL_MINT) return;
  try { const r = await fetch('https://api.dexscreener.com/latest/dex/tokens/' + OBOL_MINT); if (!r.ok) return;
    const ps = ((await r.json()).pairs || []).filter((p) => p.chainId === 'robinhood' && +p.priceUsd > 0).sort((a, b) => ((b.liquidity && b.liquidity.usd) || 0) - ((a.liquidity && a.liquidity.usd) || 0));
    if (ps[0]) { OBOL_LIVE = { px: +ps[0].priceUsd, liq: (ps[0].liquidity && ps[0].liquidity.usd) || 0, pair: ps[0].pairAddress || '', t: Date.now() }; db.obolPrice = OBOL_LIVE.px; } } catch (e) {}
}
setInterval(pollObol, 20000); pollObol();

// ---------- peg / algo tick ----------`);
s = rep(s, "  db.obolPrice = Math.max(0.05, db.obolPrice * (1 + (Math.random() - 0.49) * 0.02));", "  if (!OBOL_LIVE.px) db.obolPrice = Math.max(0.05, db.obolPrice * (1 + (Math.random() - 0.49) * 0.02));");
s = s.split("network: 'testnet'").join("network: 'robinhood', chainId: 4663, explorer: '" + EXPLORER + "', obolLive: OBOL_LIVE.px ? OBOL_LIVE : null");
s = rep(s, "{ wallet: addr, usdc: w.usdc,", "{ wallet: addr, usdg: w.usdg,");
s = rep(s, "'paste a valid Solana wallet'", "'paste a valid Robinhood Chain address'");
s = s.split('needUsdc').join('needUsdg').split('outUsdc').join('outUsdg').split('usedUsdc').join('usedUsdg').split('gotUsdc').join('gotUsdg');
s = rep(s, "if (w.usdc < needUsdg) return json(res, 200, { error: 'not enough USDC collateral' });", "if (w.usdg < needUsdg) return json(res, 200, { error: 'not enough USDG collateral' });");
s = rep(s, "w.usdc -= needUsdg;", "w.usdg -= needUsdg;");
s = rep(s, "w.ousd -= r; w.usdc += outUsdg;", "w.ousd -= r; w.usdg += outUsdg;");
s = rep(s, "console.log('OBOL (' + STABLE + '/' + GOV + ') private stablecoin demo on :' + PORT)", "console.log('OBOL (' + STABLE + '/' + GOV + ') on Robinhood Chain · :' + PORT)");
wr('server/index.js', s);
console.log('server: leftovers', (s.match(/usdc|USDC|Solana|solana|testnet|demo/gi) || []).slice(0, 10));

// ── app.js ────────────────────────────────────────────────────────────────────
let a = rd('client/src/app.js');
a = rep(a, "const phantom = () => (window.phantom && window.phantom.solana) || (window.solana && window.solana.isPhantom ? window.solana : null);", "const CHAIN_HEX = '0x1237';\nconst evm = () => window.ethereum || null;\nasync function ensureChain(eth) { try { await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: CHAIN_HEX }] }); } catch (e) { if (e && e.code === 4902) { try { await eth.request({ method: 'wallet_addEthereumChain', params: [{ chainId: CHAIN_HEX, chainName: 'Robinhood Chain', nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: ['https://rpc.mainnet.chain.robinhood.com'], blockExplorerUrls: ['" + EXPLORER + "'] }] }); } catch (e2) {} } } }");
a = rep(a, `async function connectPhantom() {
  const p = phantom();
  if (!p) { $('wmodal').classList.add('on'); return; }            // fallback: paste-to-play
  try {
    const res = await p.connect();
    const pk = (res && res.publicKey ? res.publicKey : p.publicKey).toString();
    wallet = pk; localStorage.setItem('obol_w', pk); setConnected(); toast('phantom connected'); await loadAccount();
  } catch (e) { toast('connection cancelled', true); }
}`, `async function connectPhantom() {                                // EVM wallet on Robinhood Chain (name kept for the call sites)
  const eth = evm();
  if (!eth) { $('wmodal').classList.add('on'); return; }          // fallback: paste an address
  try {
    const acc = await eth.request({ method: 'eth_requestAccounts' });
    if (!acc || !acc.length) throw new Error('no account');
    await ensureChain(eth);
    const pk = acc[0].toLowerCase();
    wallet = pk; localStorage.setItem('obol_w', pk); setConnected(); toast('wallet connected · Robinhood Chain'); await loadAccount();
  } catch (e) { toast('connection cancelled', true); }
}
if (window.ethereum && window.ethereum.on) window.ethereum.on('accountsChanged', (acc) => { if (acc && acc.length) { wallet = acc[0].toLowerCase(); localStorage.setItem('obol_w', wallet); setConnected(); loadAccount(); } });`);
a = rep(a, "    try { const p = phantom(); if (p && p.disconnect) await p.disconnect(); } catch (e) {}\n", "");
a = rep(a, "if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v)) return toast('invalid address', true); wallet = v;", "if (!/^0x[a-fA-F0-9]{40}$/.test(v)) return toast('invalid address', true); wallet = v.toLowerCase();");
a = rep(a, "$('b-usdc').textContent = A ? fmt(A.usdc, 0) : '—';", "$('b-usdg').textContent = A ? fmt(A.usdg, 0) : '—';");
a = a.split('USDC').join('USDG');
a = rep(a, "placeholder=\"recipient Solana address…\"", "placeholder=\"recipient Robinhood Chain address…\"");
wr('client/src/app.js', a);
console.log('app: leftovers', (a.match(/phantom\(|solana|USDC|usdc/gi) || []).slice(0, 10));

// ── index.html ────────────────────────────────────────────────────────────────
let h = rd('client/index.html');
h = rep(h, 'id="b-usdc"', 'id="b-usdg"');
h = h.split('USDC').join('USDG');
h = rep(h, 'https://x.com/ObolCash', 'https://x.com/ObolOnRH');
h = rep(h, 'On-chain oUSD (devnet)', 'On-chain oUSD (Robinhood Chain)');
h = h.replace(/Anchor programs:/g, () => 'Solidity contracts on Robinhood Chain:');
h = rep(h, 'No Phantom wallet detected. Paste a Solana address to begin the rite — a paste-to-play demo ledger. (Install Phantom to connect directly.)', 'No EVM wallet detected. Paste a Robinhood Chain address to open your ledger. (Install MetaMask or Rabby to connect directly.)');
h = rep(h, 'placeholder="Solana address…"', 'placeholder="0x… Robinhood Chain address"');
h = h.replace(/<b>This is a Rite-I demo, not a live protocol\.<\/b>/g, () => '<b>This is Rite I.</b>');
h = h.split('Solana').join('Robinhood Chain');
wr('client/index.html', h);
console.log('html: leftovers', (h.match(/Solana|Phantom|USDC|devnet|demo/gi) || []).slice(0, 12));

// ── studio + X kit ────────────────────────────────────────────────────────────
for (const f of ['_studio/build.js', 'X-KIT.md']) {
  let t = rd(f);
  t = t.split('USDC').join('USDG').split('Solana').join('Robinhood Chain').split('obolcash.xyz').join('obolrh.xyz').split('@ObolCash').join('@ObolOnRH').split('x.com/ObolCash').join('x.com/ObolOnRH');
  wr(f, t);
}
console.log('done');
