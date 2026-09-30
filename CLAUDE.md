# UnlinkPay — instructions for Claude Code

Owner: Jack (no formal coding background, builds with AI). RULE: explain every piece in plain words before/as you add it. Nothing gets committed until Jack can explain it back. Keep answers short, direct, no hedging.

## What this is
Private wallet funding on Horizen Vela (TEE app, WASM built with TinyGo). User deposits a fixed size (100 or 1,000 USDC), locks it under the fingerprint (SHA-256) of a secret, and after K later same-size deposits a fresh wallet claims with the secret via a relayer. Fee 0.30% on claim. Refund path for the depositor.

## Done
- `core/`: pure-Go rules + 15 passing tests (`go test ./... -v`). No Vela dependencies. Includes leftover-credit withdrawal, refund without the secret (`NotesOf`), minimum wait, flagged = refund-only, invite list, per-wallet lock cap.
- Principle: money can always go back to the wallet it came from; rules only limit locking and claiming.

## Next (in order)
Vela access comes after the grant, so the web app is built first against a placeholder Vela. Full order in PLAN.md section 11.
1. (Done 2026-09-30.) Skipped "running count instead of scanning notes": loading the whole encrypted state each request costs more than the scan, so revisit once real Vela limits can be measured.
2. `web/` (Vite + React + TS, viem/wagmi) against a placeholder Vela: one file mimics Vela with the same rules, everything else talks only to that file. Wallet connection and secret generation are real. Screens: deposit, status, claim, refund, stats. Nudge users to claim at a random time after the 24 h wait. Clearly labelled demo.
3. After Vela access: clone https://github.com/HorizenOfficial/vela-starterkit, read CLAUDE.md and docs/2_private-transfer-app.md, run `cd dockerfiles && cp .env.dev .env && docker compose up` (local emulated TEE).
4. Read https://github.com/HorizenOfficial/vela-nova (reference WASM app, TinyGo). Copy its main.go bridge pattern.
5. Create `enclave/`: main.go exporting deploy, load_module, deposit, process_request; state JSON-serialised; types from github.com/HorizenOfficial/vela-common-go v0.2.0. Map: deposit() -> core.Deposit; process_request payload types "lock" / "claim" / "refund" -> core.Lock / Claim / Refund; claim returns a types.Withdrawal. Replace Money(uint64) with types.Uint256 at the bridge only. Also: `now` comes from the request (enclave has no clock of its own); only the owner may call Invite; Flag is driven by the screening result; NotesOf must only answer the wallet itself; WithdrawCredit needs a request type. Decided values: MinWaitSecs = 86400 (24 h), MaxLockPerWallet = 1000 USDC during invite-only (PLAN.md decisions 9 and 10).
6. Build with `tinygo build -o build/unlinkpay.wasm -target=wasi .` (install TinyGo first).
7. `relayer/` (submits claims so fresh wallet needs no gas), then swap the placeholder Vela in `web/` for the real client.

## Known design risks (do not ignore)
- submitRequestFor (meta-tx) records sender AND facilitator on-chain: don't let claim leak the depositor.
- Enclave has no network; external data must arrive in the request.
- Fuel is set by the developer per call.
- Claims of the earliest note should be tested for timing/ordering leaks.
- Screening (PureFi) at deposit is a stub on testnet.
