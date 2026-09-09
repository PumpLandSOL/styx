'use strict';
// STYX brand-kit generator. Writes one self-contained HTML per asset into _studio/out/,
// then render.js rasterizes each with headless Chrome to the Desktop as styx-*.png.
// Aesthetic mirrors the live site: numismatic relic — black stone, antique gold + verdigris,
// Athenian-owl coin, Greek-key frieze, Cinzel + EB Garamond.
const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });

const FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600;700;800&family=EB+Garamond:ital,wght@0,400;0,500;1,400&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">`;

const BASE = `
:root{--bg:#080706;--stone:#100c09;--stone2:#181109;--ink:#e9ddc6;--dim:#a58f6a;--mut:#6a5942;
  --gold:#c9a25e;--gold2:#e9cf95;--verd:#62a187;--ox:#b3502f;
  --line:rgba(201,162,94,.18);--line2:rgba(201,162,94,.34);}
*{margin:0;padding:0;box-sizing:border-box}
html,body{font-family:'EB Garamond',serif;color:var(--ink);background:#080706;overflow:hidden}
.stage{position:relative;overflow:hidden;background:
  radial-gradient(120% 80% at 50% -10%,rgba(201,162,94,.07),transparent 55%),
  radial-gradient(90% 60% at 50% 118%,rgba(98,161,135,.06),transparent 60%),
  #080706}
.ci{font-family:'Cinzel',serif}.mo{font-family:'JetBrains Mono',monospace}
.gold{color:var(--gold)}.verd{color:var(--verd)}
.grain{position:absolute;inset:0;opacity:.05;background-image:radial-gradient(rgba(233,221,198,.5) .5px,transparent .6px);background-size:3px 3px}
`;

// Athenian-owl coin (size px). spin=false for static stills.
function coin(size) {
  const s = size;
  return `<svg width="${s}" height="${s}" viewBox="0 0 200 200" style="filter:drop-shadow(0 6px 28px rgba(201,162,94,.22))">
    <defs><radialGradient id="disc" cx="40%" cy="34%" r="70%"><stop offset="0" stop-color="#241c12"/><stop offset="1" stop-color="#0d0a06"/></radialGradient></defs>
    <circle cx="100" cy="100" r="96" fill="url(#disc)" stroke="#c9a25e" stroke-width="2.5"/>
    <circle cx="100" cy="100" r="88" fill="none" stroke="#c9a25e" stroke-width="1" stroke-dasharray="2 6" opacity=".7"/>
    <circle cx="100" cy="100" r="82" fill="none" stroke="rgba(201,162,94,.35)" stroke-width="1"/>
    <g fill="none" stroke="#d8b873" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="84" cy="92" r="15"/><circle cx="116" cy="92" r="15"/>
      <circle cx="84" cy="92" r="4.5" fill="#d8b873"/><circle cx="116" cy="92" r="4.5" fill="#d8b873"/>
      <path d="M71 78 Q84 70 96 80 M104 80 Q116 70 129 78"/>
      <path d="M100 100 L93 112 L107 112 Z" fill="#d8b873" stroke="none"/>
      <path d="M82 120 Q100 138 118 120"/>
      <path d="M88 132 L86 142 M100 136 L100 146 M112 132 L114 142"/>
      <path d="M150 70 Q146 92 158 108" opacity=".85"/>
      <path d="M150 70 L142 76 M153 82 L145 88 M156 95 L148 100" opacity=".85"/>
      <path d="M44 96 A20 20 0 0 0 58 70" opacity=".85"/>
    </g>
  </svg>`;
}

// Greek-key meander frieze, full width, height h
const frieze = (h = 26) => `<div style="height:${h}px;width:100%;background:left center/${h * 2}px ${h}px repeat-x;background-image:url(&quot;data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='40' height='20'><path d='M2 16 H10 V4 H30 V16 H22 V9 H15 V20' fill='none' stroke='%23c9a25e' stroke-width='2' opacity='.55'/></svg>&quot;)"></div>`;

function page(w, h, css, inner) {
  return `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>${BASE}
  .stage{width:${w}px;height:${h}px}${css}</style></head>
  <body><div class="stage"><div class="grain"></div>${inner}</div></body></html>`;
}

// fractional-algo split bar (collateral / STYX share)
const splitBar = (h = 80) => `
  <div style="display:flex;height:${h}px;border:1px solid var(--line2);width:100%">
    <div style="flex:0 0 90%;background:linear-gradient(90deg,#1b140c,#241a0e);display:flex;align-items:center;justify-content:center;gap:14px;color:var(--gold);font-size:${h * 0.26}px;letter-spacing:.06em" class="ci">USDG COLLATERAL · 90%</div>
    <div style="flex:0 0 10%;background:linear-gradient(90deg,#173027,#1d3a30);display:flex;align-items:center;justify-content:center;color:var(--verd);font-size:${h * 0.2}px" class="ci">STYX</div>
  </div>`;

const assets = {};

// 1) PFP 2000x2000 — circle-safe
assets['styx-pfp'] = page(2000, 2000, `
  .wrap{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:40px}
  .name{font-size:300px;font-weight:800;letter-spacing:14px}
  .tag{font-size:62px;color:var(--dim);font-style:italic;letter-spacing:.04em}`,
  `<div class="wrap">
     ${coin(1000)}
     <div class="name ci gold">STYX</div>
     <div class="tag">the coin for the crossing</div>
   </div>`);

// 2) BANNER 3000x1000
assets['styx-banner'] = page(3000, 1000, `
  .row{position:absolute;inset:0;display:flex;align-items:center;padding:0 150px;gap:120px}
  .lname{font-size:120px;font-weight:800;letter-spacing:10px;margin-top:26px;text-align:center}
  .mid{flex:1}
  .h{font-size:128px;font-weight:700;line-height:1.05;letter-spacing:.02em}
  .h em{font-style:normal;color:var(--gold)}
  .sub{font-size:42px;color:var(--dim);font-style:italic;margin-top:30px;max-width:1500px;line-height:1.5}
  .chips{display:flex;gap:18px;margin-top:38px}
  .chip{font-size:30px;padding:13px 26px;border:1px solid var(--line2);color:var(--ink);background:rgba(201,162,94,.05)}
  .chip b{color:var(--gold);font-weight:500}`,
  `<div class="row">
     <div style="text-align:center;flex:0 0 auto">${coin(440)}<div class="lname ci gold">STYX</div></div>
     <div class="mid">
       <div class="h ci">Private money,<br><em>carried unseen.</em></div>
       <div class="sub">A fractional-algorithmic stablecoin you hold &amp; send privately — the coin paid across the river.</div>
       <div class="chips"><div class="chip mo"><b>sUSD</b> · pegged $1</div><div class="chip mo">shielded</div><div class="chip mo">styxrh.xyz</div></div>
     </div>
   </div>`);

// 3) KEYART 2400x1350
assets['styx-keyart'] = page(2400, 1350, `
  .wrap{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:0 200px}
  .coinbg{position:absolute;top:-120px;opacity:.5}
  .eye{font-size:34px;color:var(--dim);letter-spacing:.3em;text-transform:uppercase;margin-bottom:40px}
  .h{font-size:280px;font-weight:800;letter-spacing:12px;line-height:.95}
  .sub{font-size:48px;color:var(--dim);font-style:italic;margin:44px 0 60px;max-width:1600px;line-height:1.5}`,
  `<div class="coinbg">${coin(720)}</div>
   <div class="wrap">
     <div class="eye mo">ΣΤΥΞ · the river you cross</div>
     <div class="h ci gold">$STYX</div>
     <div class="sub">Private dollars on Robinhood Chain. Shield sUSD and the amount &amp; both parties vanish from the ledger.</div>
     <div style="width:1340px">${splitBar(86)}</div>
   </div>`);

// 4) HOW IT WORKS 2400x1350 — three rites
const rite = (n, t, d) => `<div style="flex:1;background:linear-gradient(180deg,var(--stone2),var(--stone));border:1px solid var(--line);padding:56px">
  <div class="ci" style="font-size:40px;color:var(--gold);font-weight:700;letter-spacing:.1em">RITE ${n}</div>
  <div class="ci" style="font-size:50px;font-weight:600;margin:26px 0 22px;color:var(--ink)">${t}</div>
  <div style="font-size:34px;color:var(--dim);line-height:1.5">${d}</div></div>`;
assets['styx-howitworks'] = page(2400, 1350, `
  .wrap{position:absolute;inset:0;padding:120px 130px;display:flex;flex-direction:column}
  .ey{font-size:34px;letter-spacing:.28em;color:var(--gold);text-transform:uppercase;margin-bottom:20px}
  .h{font-size:104px;font-weight:700;letter-spacing:.02em;margin-bottom:70px}
  .steps{display:flex;gap:30px}`,
  `<div class="wrap">
     <div class="ey ci">How the crossing works</div>
     <div class="h ci">Strike it. Hide it. <span class="gold">Pay across.</span></div>
     <div class="steps">
       ${rite('I', 'Strike sUSD', 'Post USDG collateral &amp; burn a small STYX share to strike $1-pegged sUSD. Redeem any time.')}
       ${rite('II', 'Carry it unseen', 'Move sUSD into the shielded pool — a note encrypted only to you. Your balance reads ████ on-chain.')}
       ${rite('III', 'Pay across the river', 'Send shielded sUSD — amount &amp; both parties stay hidden. The ledger keeps only a nullifier.')}
     </div>
   </div>`);

// 5) MECHANISM 2400x1350 — fractional-algorithmic peg
assets['styx-mechanism'] = page(2400, 1350, `
  .wrap{position:absolute;inset:0;padding:130px 150px;display:flex;flex-direction:column}
  .ey{font-size:34px;letter-spacing:.28em;color:var(--gold);text-transform:uppercase;margin-bottom:20px}
  .h{font-size:104px;font-weight:700;margin-bottom:30px}
  .lead{font-size:42px;color:var(--dim);font-style:italic;margin-bottom:70px;max-width:1700px;line-height:1.5}
  .lab{display:flex;justify-content:space-between;font-size:30px;color:var(--dim);margin:26px 4px 0}
  .out{display:flex;align-items:center;justify-content:center;gap:24px;margin-top:64px;font-size:60px}
  .pill{border:1px solid var(--line2);padding:24px 44px;color:var(--gold);background:rgba(201,162,94,.05)}`,
  `<div class="wrap">
     <div class="ey ci">The reckoning · fractional-algorithmic</div>
     <div class="h ci">Backed <span class="gold">and</span> algorithmic.</div>
     <div class="lead">Every sUSD is struck from a ratio of hard USDG collateral plus a burned STYX share. The protocol shifts that ratio to defend the $1 peg.</div>
     ${splitBar(96)}
     <div class="lab mo"><span>← more collateral when below peg</span><span>more algorithmic when above peg →</span></div>
     <div class="out ci"><span class="pill">USDG</span><span style="color:var(--dim)">+</span><span class="pill verd" style="color:var(--verd)">STYX</span><span style="color:var(--dim)">=</span><span class="pill" style="font-weight:700">sUSD · $1.00</span></div>
   </div>`);

// 6) WHY STYX — 4 pillars 2400x1350
const pillar = (t, d) => `<div style="background:linear-gradient(180deg,var(--stone2),var(--stone));border:1px solid var(--line);padding:46px">
  <div class="ci" style="font-size:32px;font-weight:600;letter-spacing:.06em;color:var(--gold);margin-bottom:20px">${t}</div>
  <div style="font-size:33px;color:var(--dim);line-height:1.5">${d}</div></div>`;
assets['styx-pillars'] = page(2400, 1350, `
  .wrap{position:absolute;inset:0;padding:120px 140px;display:flex;flex-direction:column}
  .ey{font-size:34px;letter-spacing:.28em;color:var(--verd);text-transform:uppercase;margin-bottom:20px}
  .h{font-size:104px;font-weight:700;margin-bottom:60px}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:30px}`,
  `<div class="wrap">
     <div class="ey ci">Why STYX</div>
     <div class="h ci">The coin you carry <span class="gold">unseen.</span></div>
     <div class="grid">
       ${pillar('Private by default', 'Shield sUSD and the amount &amp; both parties vanish — only a nullifier and a fresh commitment remain on-chain.')}
       ${pillar('Fractional-algorithmic', 'Each sUSD is part hard USDG collateral, part burned STYX share. The ratio flexes to hold the $1 peg.')}
       ${pillar('Always redeemable', 'Burn sUSD to recover your collateral plus the STYX share — public or shielded, the door swings both ways.')}
       ${pillar('Real primitives', 'Encrypted notes, commitments, nullifiers, a Merkle root — the privacy is real crypto, not a mock.')}
     </div>
   </div>`);

for (const [name, html] of Object.entries(assets)) {
  fs.writeFileSync(path.join(OUT, name + '.html'), html);
  console.log('wrote', name + '.html');
}
console.log('done:', Object.keys(assets).length, 'assets');
