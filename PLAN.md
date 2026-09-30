# UnlinkPay: Build Plan

Private wallet funding on Horizen Vela. Owner: Jack. Name: UnlinkPay, domain unlinkpay.xyz (not yet bought).

Rule for this repo: **nothing is committed until Jack can explain it in plain words.** Claude Code must explain each piece before or as it adds it.

---

## 1. What it is (plain words)

You put money in from a wallet people know is yours. You get a secret. Later, any fresh wallet with that secret can pull the money out. Nobody can tell which deposit went to which fresh wallet, because many people deposited the same amount in between.

Why it matters: people need to fund a new wallet without linking it to their main one. Comparable products with real usage: Tornado Cash, Privacy Pools (0xbow), Railgun, Privacy Cash (Solana). Horizen's ecosystem has no unlinking tool today, and Vela lets us build one without writing custom zero-knowledge circuits.

## 2. The flow

1. **Deposit**: user sends a fixed size (100 or 1,000 USDC) from their known wallet. The app credits that wallet.
2. **Lock**: the browser makes a random secret (at least 256 bits). It sends only the secret's SHA-256 fingerprint. The app moves 100 or 1,000 USDC of the user's credit into a sealed note labelled with that fingerprint.
3. **Wait**: other people lock notes of the same size. Each later note is part of the crowd.
4. **Claim**: after at least **K = 10** later notes of the same size exist, the holder of the secret asks for payout to a fresh wallet. The relayer submits it, so the fresh wallet needs no gas. The app pays out amount minus the 0.30% fee.
5. **Refund** (safety exit): the original depositor can take back an unclaimed note, no fee. A refunded note stops counting as crowd.

The rules for steps 1 to 5 already exist in `core/core.go` with 15 passing tests.

## 3. Architecture

```
 Browser (web/)                Relayer (relayer/)              Vela (Base Sepolia, later mainnet)
 ─────────────                 ──────────────────              ─────────────────────────────────
 makes secret, encrypts  ───►  submits request, pays gas  ───► ProcessorEndpoint (on-chain, Horizen's)
 request to the enclave key                                          │ encrypted request
                                                                     ▼
                                                            AWS Nitro Enclave runs unlinkpay.wasm
                                                            (core rules; encrypted state)
                                                                     │ withdrawal instruction
                                                                     ▼
                                                            contract pays fresh wallet (pull-payment)

 Stats page  ◄──  subgraph (public on-chain events only: counts per size, crowd size, volume)
```

Four parts we write: `core/` (done), `enclave/`, `relayer/`, `web/`. Everything else is Horizen's Vela platform.

**How Vela works (the parts we rely on)**
- Our app is a WASM module compiled from Go with TinyGo, run inside an AWS Nitro Enclave (a sealed computer even the operator cannot look inside).
- State is JSON, encrypted by the Executor, stored between requests.
- The enclave has no network. Anything it needs must arrive in the request.
- Fuel (fees per call) is set by the developer in each result.
- One app per Vela environment today.

## 4. Tech stack

| Part | Choice | Why |
|---|---|---|
| Enclave app | Go 1.24 + TinyGo, target `wasi` | Required by Vela. Shared types from `vela-common-go` v0.2.0 |
| Rules | Pure Go package `core/` | Tested without any blockchain |
| Client crypto | `@horizen/vela-common-ts` | Key derivation, request encryption, event decryption |
| Frontend | Vite + React + TypeScript, viem/wagmi | Simple, works with the TS client |
| Relayer | Node 22 + TypeScript, viem | Small service that pays gas |
| Stats | Subgraph (Graph Node, in the starter kit's docker stack) | Reads public events only |
| Local testing | Docker Compose from `vela-starterkit` (Anvil + emulated TEE) | Free, fast, no permissions |
| Testnet | Base Sepolia via Horizen Discord access | Needs an access request |

## 5. Smart contracts

**We deploy no custom contracts in v1.** Vela provides them:

- `ProcessorEndpoint`: where requests are submitted. Request types: DEPLOYAPP (0), PROCESS (1), DEANONYMIZATION (2), ASSOCIATEKEY (3), TRUSTPROCESS (4).
- `TokenAllowlist`: which tokens can be deposited. We allow USDC only.
- `AuthorityRegistry`: addresses allowed to request a deanonymization report. This is our compliance path (auditor-only, not public).
- Trigger contracts (`AbstractTrigger`): not needed in v1.

Our app maps onto Vela like this:

| Vela export | What we do |
|---|---|
| `deploy` | Read config (sizes, K, fee), build empty state. Set fuel |
| `load_module` | Return the same default state (cache warm-up) |
| `deposit` | `core.Deposit(sender, amount)` |
| `process_request` | payload `type` = `lock`, `claim` or `refund` → `core.Lock / Claim / Refund`. `claim` returns a `Withdrawal` |

Deanonymization (requestType 2) returns an encrypted report to registered authorities only.

## 6. Frontend (web/)

Screens:
1. **Deposit**: pick 100 or 1,000 USDC, approve and deposit, then Lock. Show the secret **once**, force the user to save it (download file plus copy button). Losing the secret means losing the money unless they refund.
2. **Status**: shows "X of 10 later deposits so far". Claim is disabled until K is met.
3. **Claim**: paste secret, paste fresh wallet address, submit through the relayer.
4. **Refund**: for the depositor wallet.
5. **Stats**: deposits per size, current crowd size, total volume, fees. Built only from public events.

Security rules for the frontend: secret generated with `crypto.getRandomValues`, never sent anywhere in plaintext, never logged, never stored in analytics.

## 7. Relayer (relayer/)

- Accepts an already-encrypted claim, submits it to the endpoint, pays the gas.
- It sees only ciphertext. It cannot read the secret or the destination.
- Charges a flat fee at cost, separate from the 0.30% protocol fee.
- Fixed ETH gas drop to fresh wallets is a possible later addition.

## 8. Economics

- Protocol fee: **0.30% on claim**. About $3,000 a month per $1M of monthly withdrawals.
- Relayer fee: flat, at cost.
- 20% of protocol fees go to the ZEN staking pool (Horizen participants give 15 to 20%).
- No token planned.

## 9. Decisions made

1. Product: **private wallet funding**, chosen because unlinking has the most proven real usage and fees per transaction. It needs no custom ZK circuits on Vela.
2. Fixed sizes only: 100 and 1,000 USDC.
3. Crowd rule: **K = 10 later same-size notes** before a claim works. Enforced inside the enclave.
4. Fee: 0.30% on claim, no fee on refund.
5. Refund path exists, and refunded notes do not count as crowd.
6. Compliance: PureFi screening at deposit (stub on testnet), refund-only for flagged deposits, auditor-only report via AuthorityRegistry, geoblocking, invite-only cohorts of 25 users a week with deposit caps.
7. Funding: Horizen Ecosystem Fund Season 2, wildcard / New project path, **$25,000 ask** (dev $9,000, audit $12,000 placeholder, ops $4,000, growth $0).
8. Application draft lives in the Claude Docs artifact: https://claude.ai/artifact/Lyfii4UWeFUeE8LrqSYdN6
9. Minimum wait before claim: **24 hours** (decided 2026-09-30). Gives late sanctions flags (e.g. a hack) time to land before a claim, and blocks deposit-then-withdraw-at-once timing. The web app nudges users to wait a random extra time, so "exactly 24 hours later" does not become a pattern.
10. Lock limit per wallet during invite-only: **1,000 USDC total** (decided 2026-09-30). One 1,000 note or ten 100 notes. Caps loss at about 25,000 USDC per weekly cohort if the young platform breaks. Raise after the audit and a few clean weeks.

## 10. Milestones

| # | Target | What ships |
|---|---|---|
| M0 | now | `core/` rules + tests (done) |
| M1 | January 2027 | Enclave bridge running on local Docker devnet, then Base Sepolia; relayer; basic deposit, claim, refund web app |
| Audit | Feb to Mar 2027 | External audit of enclave app, fixes |
| M2 | between | Stats page and subgraph, invite-only cohort controls, screening integration |
| M3 | July 2027, or 90 days after Vela mainnet | Mainnet launch (Base mainnet has no public date yet) |

Typical payout: 10% at approval, 20% at M1, rest across M2 and M3.

## 11. Build order for Claude Code

Order changed 2026-09-30: Vela access comes after the grant, so `web/` is built first against a placeholder Vela.

1. Install Go 1.24+. `go test ./... -v` (expect 8 passing).
2. Finish `core/` (**done 2026-09-30, 15 tests**): fixed the "need X more" error message, leftover credit goes back to its wallet, the depositor wallet can refund without the secret (section 6), minimum wait before claim (section 12), compliance rules from decision 6 (flagged = refund-only, per-wallet lock cap, invite list). The "running count per size" change was skipped: loading the whole encrypted state each request costs more than counting notes, so it is revisited once Vela can be measured.
3. (**Done 2026-09-30**, look to be refined with Claude Design.) Build `web/` against a placeholder Vela: one file mimics Vela with the same rules, everything else talks only to that file. Wallet connection and secret generation are real. All five screens from section 6, plus the warnings from section 12, plus a nudge to claim at a random time after the 24-hour wait. Clearly labelled demo.
4. After Vela access: clone `github.com/HorizenOfficial/vela-starterkit`. Read its `CLAUDE.md` and `docs/2_private-transfer-app.md`. Run `cd dockerfiles && cp .env.dev .env && docker compose up`.
5. Read `github.com/HorizenOfficial/vela-nova` (reference app). Copy its `main.go` bridge pattern.
6. Create `enclave/` with the four exports. Swap `Money(uint64)` for `types.Uint256` **at the bridge only**, keep `core` simple.
7. Build: `tinygo build -o build/unlinkpay.wasm -target=wasi .` Add an integration test against the local runtime.
8. Deploy the app on the local devnet through DEPLOYAPP. Run deposit, lock, claim, refund end to end. Test that claim never reveals the depositor.
9. Build `relayer/`, then swap the placeholder Vela in `web/` for the real client.
10. Add the subgraph and real stats.
11. Move to Base Sepolia.

## 12. Open risks (do not ignore)

- **Sender metadata leak**: `submitRequestFor` (the meta-transaction path) records both the sender and the facilitator on-chain. Test that `claim` never reveals the depositor. Claim should go through the relayer only.
- **Timing and ordering leaks**: claiming the moment K is reached, or claiming the oldest note first, can weaken the crowd. Consider a minimum delay and test it.
- **Liveness**: if Vela halts, users have no self-serve exit yet. Say so in the UI and docs.
- **Young platform**: Vela is v0.2.0 and its docs are thin. Expect breakage. Pin versions.
- **Lost secret**: unrecoverable by design. Warn loudly.
- **Weak secrets**: the fingerprint is only safe if the secret has 256 bits of randomness. Never let users choose their own.
- **Regulatory**: mixers have been prosecuted (Tornado Cash's developer was prosecuted). Keep the compliance controls in decision 6 and get legal advice before mainnet.
- **Testnet access**: needs a request in Horizen's Discord. Do this first.

## 13. Jack's open items (not code)

- Application: website URL (Q10), team questions (31 to 35), runway (Q55), admin questions (79 to 84).
- Buy unlinkpay.xyz.
- Update the application draft to the new name (it may still say Airlock).
- Submit through the Tally form.
- Ask for Vela testnet access in the Horizen Discord.

## 14. Links

- Starter kit: https://github.com/HorizenOfficial/vela-starterkit
- Vela: https://github.com/HorizenOfficial/vela
- Reference app: https://github.com/HorizenOfficial/vela-nova
- Shared Go types: https://github.com/HorizenOfficial/vela-common-go
- TS client: https://github.com/HorizenOfficial/vela-common-ts
- Builder fund: https://horizen.io/builder-fund/

## 15. Frontend: not handled yet (listed 2026-09-30)

Order: (1) apply the Claude Design look, (2) Claim-page privacy fixes, (3) legal pages and FAQ, (4) wrong-network check. Reown and real transactions wait for Vela access.

**Wallets and transactions**
- Reown (WalletConnect) for mobile and QR wallets. Needs a Reown project ID and routes through Reown's relay servers, which breaks the "no third-party requests" promise: decide between accepting it (and changing the home page copy) or offering it only when the user picks it.
- (Done 2026-09-30) Wrong network: `web/src/components/NetworkCheck.tsx` warns on Deposit and Refund and offers a switch to Base Sepolia; Deposit and lock is disabled until it matches. Not yet tried with a real browser wallet (the demo wallet is always on Base Sepolia).
- Real USDC: balance, approve plus deposit transactions, allowance, gas estimate, "not enough USDC" and "not enough ETH for gas".
- Transaction states: waiting for wallet, pending, confirmed, failed or rejected, block explorer link.
- Waiting on Vela after a transaction: a "processing" state, timeout and retry.

**Privacy leaks in the site itself**
- (Done 2026-09-30) wagmi remembers the last connected wallet (address included) in browser storage. Claim now warns when a wallet is connected or remembered, offers "Disconnect and forget" / "Forget wallets in this browser" (`web/src/lib/walletMemory.ts`), and lists "Before you claim" steps: no wallet needed, different browser or private window, VPN or Tor or another network, random time.
- (Done 2026-09-30) Clipboard: Deposit warns after Copy; the claim success screen says to clear it.
- Relayer: show its fee, whether it is online, and what to do if it is down. Waits for the real relayer.

**Compliance and legal (decision 6)**
- Invite code or waitlist for the invite-only pilot.
- Geoblocking: needs a server-side check, which pulls against privacy. Decide how.
- (Done 2026-09-30) Plain-language risk notice (`#/risks`), ticked before "Create my secret" on Deposit. Still needed: real terms of use and a privacy policy written with a lawyer.

**Missing pages**
- (Done 2026-09-30) Questions page (`#/faq`) with the trust model and the "UnlinkPay will never ask for your secret" note (also in the footer).
- Still missing: a service-status page (Vela and relayer) and a 404 page (hash routes fall back to home for now).

**Security and hosting**
- (Done 2026-09-30) Vercel, project "unlinkpay", config in `vercel.json` at the repo root (builds `web/`, strict CSP allowing only this site, no-referrer, HSTS, www redirects to the apex). Code on GitHub as a private repo.
- Automated browser tests (Playwright) for the full flow.

**Brand and polish**
- Logo (made in Nano Banana, to be traced to SVG), favicon, link-preview image.
- Stats from the subgraph instead of demo numbers.
- Keyboard and screen reader check of every screen.
