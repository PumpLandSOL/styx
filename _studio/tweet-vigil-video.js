const fs = require('fs'); const path = require('path'); const K = path.join(__dirname, '..', 'X-KIT.md');
const t = `The Vigil is open 🕯️

Stake sUSD → 40% APY, paid in $STYX from a pre-funded pool. 30 days, then it ends.

Anchor never ended. That's the problem.

Real USDG deposits, verified on-chain. Nothing printed to mint.

styxrh.xyz`;
let s = fs.readFileSync(K, 'utf8'); const i = s.lastIndexOf('### Video tweet');
s = s.slice(0, i) + `### Video tweet (${[...t].length} chars)\n` + t + '\n'; fs.writeFileSync(K, s);
console.log([...t].length); console.log(t);
