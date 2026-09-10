// one-shot server patch: RITE III — pay links (The Note) + view keys (The Seal) + private history. Run once from styx/.
const fs = require('fs'); const path = require('path');
const F = path.join(__dirname, '..', 'server', 'index.js'); let s = fs.readFileSync(F, 'utf8');
const rep = (a, b) => { const i = s.indexOf(a); if (i < 0) throw new Error('missing: ' + a.slice(0, 70)); s = s.slice(0, i) + b + s.slice(i + a.length); };

rep("const { generateKeyPairSync, sign, createHash, randomBytes, randomInt, diffieHellman, createCipheriv } = require('crypto');",
    "const { generateKeyPairSync, sign, createHash, createHmac, randomBytes, randomInt, diffieHellman, createCipheriv } = require('crypto');");

rep("// ---------- privacy primitives (real) ----------", `// ---------- RITE III: The Note (pay links) + The Seal (view keys) ----------
//   The Note : lock shielded sUSD behind a secret; anyone holding the link claims it into their own shielded balance.
//              No recipient address is ever named. On the ledger it is one nullifier + one commitment, like any private send.
//   The Seal : a read-only view key. Whoever holds it can read your private balance and history and can never spend.
//              Selective disclosure — show an auditor, a partner, a court exactly what you choose, and nobody else.
if (!db.links) db.links = {};
if (!db.viewSalt) db.viewSalt = base58(randomBytes(32));
const hist = (w, e) => { w.hist = w.hist || []; w.hist.unshift({ ts: Date.now(), ...e }); if (w.hist.length > 200) w.hist.pop(); };
const linkId = (secret) => base58(sha('note|' + secret));
function viewKeyOf(addr) { const mac = createHmac('sha256', db.viewSalt).update('seal|' + addr.toLowerCase()).digest().subarray(0, 16); return base58(Buffer.concat([Buffer.from(addr.slice(2), 'hex'), mac])); }
function walletOfViewKey(key) { try { let n = 0n; for (const ch of key) { const i = B58.indexOf(ch); if (i < 0) return null; n = n * 58n + BigInt(i); } let hex = n.toString(16); if (hex.length % 2) hex = '0' + hex; let buf = Buffer.from(hex, 'hex'); let lead = 0; for (const ch of key) { if (ch === '1') lead++; else break; } buf = Buffer.concat([Buffer.alloc(lead), buf]); if (buf.length !== 36) return null; const addr = '0x' + buf.subarray(0, 20).toString('hex'); return viewKeyOf(addr) === key ? addr : null; } catch (e) { return null; } }

// ---------- privacy primitives (real) ----------`);

// history on existing private ops
rep("const sn = toll('shield', s); w.susd -= s; w.priv += sn; sh.totalValue += sn;", "const sn = toll('shield', s); w.susd -= s; w.priv += sn; sh.totalValue += sn; hist(w, { type: 'shield', amt: sn });");
rep("const xn = toll('send', x); w.priv -= x; const r = W(d.to); r.priv += xn; sh.nullifiers++;", "const xn = toll('send', x); w.priv -= x; const r = W(d.to); r.priv += xn; sh.nullifiers++; hist(w, { type: 'sent', amt: x, to: d.to.toLowerCase() }); hist(r, { type: 'received', amt: xn });");
rep("const unn = toll('unshield', un); w.priv -= un; w.susd += unn;", "const unn = toll('unshield', un); w.priv -= un; w.susd += unn; hist(w, { type: 'unshield', amt: un });");

// routes
rep("    if (u === '/api/shield') {", `    if (u === '/api/note/create') { // lock shielded sUSD behind a secret link
      const x = num(d.amount, w.priv); if (!x) return json(res, 200, { error: 'not enough private balance' }); if (x < 1) return json(res, 200, { error: 'minimum 1 sUSD' });
      const secret = base58(randomBytes(16)); const id = linkId(secret); const xn = toll('send', x);
      w.priv -= x; sh.nullifiers++; const { C, note } = shieldNote(xn, shKeys[randomInt(0, shKeys.length)].pub);
      db.links[id] = { amt: xn, memo: String(d.memo || '').slice(0, 80), ts: Date.now(), claimed: false, from: base58(sha('from|' + d.wallet.toLowerCase() + '|' + secret)) };
      pushShTx({ sig: base58(randomBytes(32)), type: 'private', nullifier: nullifierOf('n', sh.notes), commitment: C, note, proof: simProof(), ts: Date.now() });
      hist(w, { type: 'note', amt: x, id }); save();
      return json(res, 200, { ok: true, secret, id, amt: xn, toll: x - xn, ...account(d.wallet) });
    }
    if (u === '/api/note/claim') { // anyone holding the secret claims it into THEIR shielded balance
      const L = db.links[linkId(String(d.secret || ''))]; if (!L) return json(res, 200, { error: 'no such note' }); if (L.claimed) return json(res, 200, { error: 'this note was already claimed' });
      L.claimed = true; L.claimedTs = Date.now(); w.priv += L.amt; hist(w, { type: 'claimed', amt: L.amt, memo: L.memo }); save();
      return json(res, 200, { ok: true, claimed: L.amt, memo: L.memo, ...account(d.wallet) });
    }
    if (u === '/api/seal') { return json(res, 200, { ok: true, viewKey: viewKeyOf(d.wallet) }); }
    if (u === '/api/shield') {`);

// wallet-less routes: peek a note, read with a view key
rep("    if (u === '/api/account') {", `    if (u === '/api/note/peek') { const L = db.links[linkId(String(d.secret || ''))]; if (!L) return json(res, 200, { error: 'no such note' }); return json(res, 200, { amt: L.amt, memo: L.memo, claimed: L.claimed, ts: L.ts }); }
    if (u === '/api/view') { const addr = walletOfViewKey(String(d.key || '')); if (!addr) return json(res, 200, { error: 'invalid view key' }); const v = W(addr); return json(res, 200, { ok: true, wallet: addr, priv: v.priv, staked: v.stake || 0, hist: (v.hist || []).slice(0, 100), notesOpen: Object.values(db.links).filter((L) => !L.claimed).length, root: sh.root, t: Date.now() }); }
    if (u === '/api/account') {`);

// serve /view
rep("if (u === '/') u = '/client/index.html';", "if (u === '/') u = '/client/index.html'; if (u === '/view') u = '/client/view.html';");

// metrics: notes stats
rep("deposits: { usdg: db.treasuryIn.usdg, n: db.treasuryIn.n },", "deposits: { usdg: db.treasuryIn.usdg, n: db.treasuryIn.n }, notes: { created: Object.keys(db.links).length, open: Object.values(db.links).filter((L) => !L.claimed).length, claimed: Object.values(db.links).filter((L) => L.claimed).length },");
fs.writeFileSync(F, s); console.log('server patched');
