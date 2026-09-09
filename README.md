# STYX — sUSD on Robinhood Chain

**The coin for the crossing.** sUSD is a private, fractional-algorithmic stablecoin: struck from USDG collateral plus a burned $STYX share, shielded into notes encrypted only to you, sent with amount and parties hidden.

Robinhood Chain (chainId 4663, EVM). Dependency-free Node ≥18. `node server/index.js` (port 8198).

Env: `PORT`, `DATA_PATH`, `STYX_MINT` ($STYX token on Robinhood Chain — lights the CA bar and reads the live price from Robinhood Chain pools), `TICK_SEC`.

Rite I: real privacy primitives (x25519-encrypted notes, commitments, nullifiers, Merkle root) with the peg and ledger kept off-chain. Algorithmic stablecoins are high-risk.

MIT.
