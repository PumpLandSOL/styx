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


---

## vs LUNA + Zcash (triad)
Graphic: `brand/styx-vs-luna-zcash.png`

### Tweet (220 chars)
UST was a dollar with no privacy. It went to $0.
Zcash is privacy with no dollar.

sUSD is the third thing: a private dollar with a floor. 55% hard USDG minimum, view keys, pay-by-link, every use burns $STYX.

styxrh.xyz

How-to (hands-on): `brand/styx-howto-15s.mp4` — 15s drawn walkthrough of deposit → mint → shield → pay-by-link with a live cursor; not a screen recording.

### How-to video tweet (275 chars)
How to cross, in 15 seconds:

01 Deposit USDG from your wallet. It lands in the treasury, verified on-chain
02 Mint sUSD. 90% collateral, 10% buys & burns $STYX
03 Shield it. Your balance reads ████
04 Send it as a link. No address, no name

That's private money.

styxrh.xyz


---

## vs ZEC (market cap)
Graphic: `brand/styx-vs-zec.png` (caps: CoinGecko/DexScreener, Sep 10 2026)

### Tweet (258 chars)
ZEC is a $19.8B privacy coin. Ten years in, you still can't price rent in it. You convert out before you pay.

sUSD is the private dollar. Shielded, pegged, 55% hard USDG floor, pay anyone by link.

$STYX is $132K today. 1% of ZEC's cap is $199M.

styxrh.xyz


---

## REFERRALS
Video: `brand/styx-ferry-10s.mp4` (10s, rendered)

### Tweet
Referrals are live on $STYX.

Anyone who claims your Note or joins through your link is your referral. You earn 20% of every toll they ever pay. Shield, send, unshield, redeem. Forever.

Not a one-time bonus. A cut of their crossings for life.

styxrh.xyz/?ref=you


---

## BONDS + VIGIL BOOST
Video: `brand/styx-bonds-10s.mp4` (10s, rendered) · deposit link: styxrh.xyz/?tab=bond

### Tweet (276 chars)
$STYX is on sale. Bonds are live.

Deposit USDG → take $STYX at 20% below market, vested 5 days. Your USDG goes straight into the sUSD reserve. Nothing minted.

Vigil boosted: 40% → 100% APY on staked sUSD this week.

Daily cap. First come, first served.

styxrh.xyz/?tab=bond

---

## "Privacy is the future" positioning tweets

### Bold (267)
Privacy is the future. Everyone says it. Nobody builds the dollar.

STYX stands alone: the only algorithmic private stablecoin on Robinhood Chain, and the only one anywhere on-chain that ships with a hard collateral floor.

A dollar you carry unseen. $STYX

styxrh.xyz

### Unassailable (279)
Privacy is the future. Everyone says it. Nobody builds the dollar.

STYX is the first and only private algorithmic stablecoin on Robinhood Chain. Not a coin you hide. A dollar you hide, with a 55% hard floor no death spiral can break.

One of one. $STYX

styxrh.xyz

Graphic: `brand/styx-one-of-one.png` (quadrant map: stable×private, sUSD alone)


---

## THE DARK POOL — private stock exposure
Video: `brand/styx-darkpool-10s.mp4` (10s, rendered) · link: styxrh.xyz/?tab=dark

### Tweet (331 chars)
The Dark Pool is live on $STYX.

Every stock on Robinhood Chain trades in public. Every position, every size, every wallet.

Not anymore. Commit shielded sUSD to HOOD, TSLA, NVDA, SPY. Long or short, off the live tape. Ticker, size and P&L stay in the shield.

The first private stock desk on Robinhood Chain.

styxrh.xyz/?tab=dark

---

## DAY ONE COMPLETE — feature checklist (212 chars)
Graphic: `brand/styx-day-one.png` (2400×1350)

Day one complete ⚱

✅ sUSD mint/redeem
✅ Shielded pool
✅ Notes + Seal
✅ USDG treasury
✅ The Vigil (staking)
✅ The Pyre (burn)
✅ Bonds
✅ Referrals
✅ Dark Pool

styxrh.xyz
0xdbd2bd1a734d2b3dc8f88bacc404810fcbff36c4

---

## vs LUNA + ZEC — v2 (post day one, market caps)
Graphic: `brand/styx-vs-luna-zec-v2.png` (2400×2300). Caps: LUNA ATH $40B (Apr 2022), ZEC ATH $19.85B, $STYX day-one ATH $500K.
1% of LUNA ATH = $400M (800×). 1% of ZEC ATH = $199M (397×).

### Tweet (279 chars)
UST hit $40B with no privacy and no backing. $0 in six days.
ZEC hit $19.85B with privacy and no dollar. Ten years, still can't price rent in it.

$STYX hit $500K on day one with both, plus a 55% USDG floor, staking, bonds, referrals and a dark pool for stocks.

1% of LUNA = $400M
1% of ZEC = $199M

styxrh.xyz
