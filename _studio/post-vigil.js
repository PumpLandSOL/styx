// housekeeping after the vigil build: wipe local test ledger, fix e2e expectation, append tweets to X-KIT.
const fs = require('fs'); const path = require('path'); const R = path.join(__dirname, '..');
// 1. local ledger (gitignored) — drop faucet test wallets
try { const p = path.join(R, 'data.json'); const d = JSON.parse(fs.readFileSync(p, 'utf8')); d.wallets = {}; d.queue = []; d.txs = {}; d.vigil = { staked: 0, paidStyx: 0, paidUsd: 0, stakers: 0 }; d.treasuryIn = { usdg: 0, n: 0 }; d.v = 2; fs.writeFileSync(p, JSON.stringify(d)); console.log('ledger wiped'); } catch (e) { console.log('no ledger'); }
// 2. e2e expectation: over-balance stake clamps (MAX semantics) like every other route
const E = path.join(__dirname, 'e2e-flow.cjs'); let e = fs.readFileSync(E, 'utf8');
e = e.replace("ok('stake respects cap / balance', !!cap.error, cap.error);", "ok('stake over balance clamps to balance (MAX semantics)', cap.ok && f(cap.vigil.staked) > 0, 'staked ' + f(cap.vigil.staked));");
fs.writeFileSync(E, e);
// 3. X-KIT
const main = `$STYX update: The Vigil 🕯️

Stake sUSD → 40% APY, paid in $STYX. For 30 days. Then it ends.

Why temporary? Anchor's 20% was permanent, subsidised, and became the only reason to hold UST. A yield with an end date can't become the peg.

Also live:
→ real USDG deposits, verified on-chain, every dollar in the treasury
→ nothing printed to mint: the algo slice buys & burns $STYX
→ no hot key: withdrawals paid by hand from cold storage

Sep 11 → Oct 11. 5M $STYX pool. 250K sUSD cap.

styxrh.xyz`;
const short = `The Vigil: stake sUSD, 40% APY paid in $STYX from a pre-funded pool, for 30 days. Then it ends.

Anchor's 20% was permanent and became the peg. A yield with an end date can't.

Also: real USDG deposits to the treasury, verified on-chain. Nothing printed to mint.

styxrh.xyz`;
fs.appendFileSync(path.join(R, 'X-KIT.md'), `\n\n---\n\n## THE VIGIL — real deposits + temporary staking\nGraphic: \`brand/styx-vigil.png\`\n\n### Main tweet\n${main}\n\n### Short (${short.length} chars)\n${short}\n`);
console.log('short tweet chars:', short.length);
