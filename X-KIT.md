# STYX — X (Twitter) Kit

**Handle:** @styxrh · **URL:** x.com/styxrh · **Site:** styxrh.xyz
**Palette:** antique gold `#c9a25e` · verdigris `#62a187` · black stone `#080706`
**Type:** Cinzel (display) · EB Garamond (body) · JetBrains Mono (data)

---

## Profile assets (on Desktop)

| Slot | File | Size |
|------|------|------|
| Profile picture | `styx-pfp.png` | 2000×2000 (owl coin + STYX) |
| Header / banner | `styx-banner.png` | 3000×1000 |
| Pinned / OG keyart | `styx-keyart.png` | 2400×1350 ($STYX) |
| Reply — how it works | `styx-howitworks.png` | 2400×1350 (3 rites) |
| Reply — mechanism | `styx-mechanism.png` | 2400×1350 (peg) |
| Reply — why STYX | `styx-pillars.png` | 2400×1350 |

Regenerate: `cd styx/_studio && node build.js && node render.js`

---

## Name & bio

**Display name:** `STYX ⚱`

**Bio (≤160):**
> Private dollars on Robinhood Chain. sUSD — a fractional-algorithmic stablecoin you carry unseen. Shield it and the amount & both parties vanish from the ledger. ⚱

**Location:** `the crossing` · **Website:** `styxrh.xyz`

---

## Launch thread

**1/ (pin — attach `styx-keyart.png`)**
> ⚱ Introducing STYX — the coin for the crossing.
>
> sUSD is a private, fractional-algorithmic stablecoin on Robinhood Chain. Hold it. Send it. And when you shield it, the amount & both parties vanish from the ledger.
>
> Private money, carried unseen.
> styxrh.xyz

**2/ (attach `styx-howitworks.png`)**
> Three rites:
>
> I. Strike sUSD — post USDG collateral + burn a small STYX share
> II. Carry it unseen — shield it into a note encrypted only to you
> III. Pay across the river — send it, amount & parties hidden
>
> Redeem any time.

**3/ (attach `styx-mechanism.png`)**
> Why it holds $1:
>
> Every sUSD is struck from hard USDG collateral + a burned STYX share. The protocol shifts that ratio to defend the peg — more collateral below $1, more algorithmic above it.
>
> Backed and algorithmic. USDG + STYX = sUSD.

**4/ (CTA — attach `styx-pillars.png`)**
> The privacy is real crypto — encrypted notes, commitments, nullifiers, a Merkle root. Not a mock.
>
> Public when you choose. Hidden when you don't.
>
> ⚱ styxrh.xyz
> $STYX — CA dropping soon. Turn on notifs. 🔔

---

## One-liners
- Private money, carried unseen.
- The coin you carry across the river.
- Public when you choose. Hidden when you don't.
- Backed and algorithmic — USDG + STYX = sUSD.
- sUSD: private dollars on Robinhood Chain.

---

⚠ Voice/compliance: never market as live / safe / audited. It's a Rite-I (Phase-0) demo — simulated peg & ledger, real privacy primitives, ZK proof simulated. Algorithmic stablecoins are high-risk (UST/Terra).

## CA (Robinhood Chain)
0xdbd2bd1a734d2b3dc8f88bacc404810fcbff36c4

## Treasury
0x28FC1899eDD7973dc5A9c95321E0cdeB3d8419d1

---

## LUNA comparison #2 — "anatomy of a death spiral" (deep dive)
Graphic: `brand/styx-vs-luna-deep.png` (2400×1900)

LUNA didn't die because people sold.
It died because of what the protocol did when they sold.

1 UST redeemed → $1 of LUNA printed. No cap, no collateral. 346M LUNA became 6.5 trillion in six days. The thing backing the dollar was the thing being printed.

$STYX runs the same first step and then does the opposite:

→ redemption pays USDG reserves FIRST, STYX only fills the gap
→ below peg the collateral ratio goes UP, not down. less STYX printed per redeem, not more
→ hard floor: CR can never drop below 55%

Reflexive backing loops forever. Exogenous backing terminates.

Not yield. Plumbing.

styxrh.xyz

### Short version (≤160 chars)
LUNA printed $1 of itself per UST redeemed. No cap, no collateral. $40B to $0.

$STYX redeems in USDG first, raises collateral under stress, floors at 55%.

---

## THE PYRE — feature drop (buyback & burn)
Video: `brand/styx-pyre-15s.mp4` (15s, 1280×720, locked 30fps, rendered not screen-recorded) · Still: `brand/styx-pyre-section.png`

### Main tweet
Every private payment now burns $STYX.

Introducing THE PYRE 🔥

→ 30 bps toll on every shield, send and unshield. 50 bps on redeem
→ tolls gather in USDG, each epoch the protocol buys $STYX at market and burns it
→ every burn gets a public receipt

Privacy usage → permanent scarcity.

The burn is public. The payer never is.

styxrh.xyz

### Short (≤160)
Every private payment now burns $STYX. 30 bps toll on shield/send/unshield, 50 on redeem, bought back at market, burned with a receipt. The Pyre is lit. 🔥

### Reply thread
1/ Why a toll? Because a private stablecoin needs a reason for $STYX to exist beyond the mint share. Now every crossing feeds the fire.
2/ Why buy at market instead of minting less? Because buying is a bid. Burning is a promise. Both are visible on the receipt.
3/ Nothing about this is yield. It's plumbing. Use sUSD, and the share token gets scarcer. That's the whole mechanism.

---

## Tech recap tweet
Graphic: `brand/styx-tech-recap.png`

$STYX, the whole stack in one picture:

01 Mint sUSD: USDG collateral + burn STYX. CR floats 55–100%
02 Shield: a note encrypted only to you. Balance reads ████
03 Send: no amount, no parties
04 Redeem: USDG pays first

Every crossing pays a toll. The toll burns $STYX. 🔥

styxrh.xyz

---

## "UST could go to $0. sUSD can't." (stress-test graphic)
Graphic: `brand/styx-cant-fail-like-ust.png`

UST went from $40B to $0 because its only backing was LUNA, the token it printed to defend the peg. Printing was unbounded. No floor.

sUSD is backed by USDG the protocol cannot mint. CR floors at 55% and rises under stress. If $STYX hit $0, sUSD still holds hard USDG.


---

## THE VIGIL — real deposits + temporary staking
Graphic: `brand/styx-vigil.png`

### Main tweet
$STYX update: The Vigil 🕯️

Stake sUSD → 40% APY, paid in $STYX. For 30 days. Then it ends.

Why temporary? Anchor's 20% was permanent, subsidised, and became the only reason to hold UST. A yield with an end date can't become the peg.

Also live:
→ real USDG deposits, verified on-chain, every dollar in the treasury
→ nothing printed to mint: the algo slice buys & burns $STYX
→ no hot key: withdrawals paid by hand from cold storage

Open now → Oct 11. 5M $STYX pool. 250K sUSD cap.

styxrh.xyz

### Short (274 chars)
The Vigil: stake sUSD, 40% APY paid in $STYX from a pre-funded pool, for 30 days. Then it ends.

Anchor's 20% was permanent and became the peg. A yield with an end date can't.

Also: real USDG deposits to the treasury, verified on-chain. Nothing printed to mint.

styxrh.xyz

Video: `brand/styx-vigil-15s.mp4` (15s, 1280x720, locked 30fps, rendered) — pair with the main Vigil tweet.

### Video tweet (222 chars)
The Vigil is open 🕯️

Stake sUSD → 40% APY, paid in $STYX from a pre-funded pool. 30 days, then it ends.

Anchor never ended. That's the problem.

Real USDG deposits, verified on-chain. Nothing printed to mint.

styxrh.xyz

---

## RITE III — The Note & The Seal
Video: `brand/styx-rite3-10s.mp4` (10s, 1280x720, locked 30fps, rendered)

### Main tweet
Private dollars just got two new powers. Rite III is live on $STYX.

THE NOTE: send shielded sUSD to anyone as a link. No address, no name. On the ledger it is one nullifier and one commitment, same as any private send. Text it, DM it, print the QR.

THE SEAL: a read-only view key. Hand it to your accountant, a partner, a regulator. They see your shielded balance and history on a sealed statement. They can never spend. Nobody else sees anything.

Pay anyone. Prove it to one person. Hide it from everyone else.

styxrh.xyz

### Short (≤275)
Rite III is live on $STYX.

THE NOTE: send shielded sUSD to anyone as a link. No address, no name.
THE SEAL: a read-only view key. Prove your balance to one person, hide it from everyone else. It can never spend.

Pay anyone. Prove it to one. Hide it from all.

styxrh.xyz
