# UnlinkPay — instructions for Claude Code

Owner: Jack (no formal coding background, builds with AI). RULE: explain every piece in plain words before/as you add it. Nothing gets committed until Jack can explain it back. Keep answers short, direct, no hedging.

## What this is
Private wallet funding on Horizen Vela (TEE app, WASM built with TinyGo). User deposits a fixed size (100 or 1,000 USDC), locks it under the fingerprint (SHA-256) of a secret, and after K later same-size deposits a fresh wallet claims with the secret via a relayer. Fee 0.30% on claim. Refund path for the depositor.

## Done
- `core/`: pure-Go rules + 15 passing tests (`go test ./... -v`). No Vela dependencies. Includes leftover-credit withdrawal, refund without the secret (`NotesOf`), minimum wait, flagged = refund-only, invite list, per-wallet lock cap.
- Principle: money can always go back to the wallet it came from; rules only limit locking and claiming.
- `web/`: Vite 8 + React 19 + TS 7 + wagmi 3 (hooks: `useConnection`, `useConnect().mutate`, `useConnectors`; no `useAccount`). Pages: home, deposit, status, claim, refund, stats. Placeholder Vela in `web/src/vela/placeholder.ts` mirrors `core/` (9 vitest tests); `web/src/vela/index.ts` is the only file that picks which Vela is used. Run: `npm --prefix web run dev` (port 5173), `npm --prefix web test`, `npm --prefix web run build`.
- Look: all tokens in `web/src/styles.css` (calm statement: off-white, ink, one deep green, Geist + Geist Mono self-hosted). Taste skill installed in `.claude/skills/design-taste-frontend` (applies to the landing page only).
- Privacy rule for the site: no third-party requests (no CDNs, remote fonts, remote images, analytics). The home page promises this, so the real RPC must be self-hosted or proxied, or the copy changed. `vercel.json` enforces it with a CSP of `'self'` only: adding any outside origin needs a deliberate CSP change.
- Hosting: GitHub private repo Amthebest14/unlinkpay (branch main), connected to Vercel project "unlinkpay", so every push to main deploys. Live at https://unlinkpay.vercel.app and https://unlinkpay.xyz (domain bought through Vercel; www redirects to the apex). Manual deploy: `vercel deploy --prod` from the repo root. Preview deployments are behind Vercel login by default.

## Next (in order)
Vela access comes after the grant, so the web app is built first against a placeholder Vela. Full order in PLAN.md section 11.
1. (Done 2026-09-30.) Skipped "running count instead of scanning notes": loading the whole encrypted state each request costs more than the scan, so revisit once real Vela limits can be measured.
2. (Done 2026-09-30.) `web/` against the placeholder Vela. Next for web: apply the Claude Design look by editing `styles.css` tokens and components, keeping all logic. Then work through PLAN.md section 15 (frontend gaps) in its stated order. The logo came from Nano Banana as a PNG: trace it to SVG before using it.
3. After Vela access: clone https://github.com/HorizenOfficial/vela-starterkit, read CLAUDE.md and docs/2_private-transfer-app.md, run `cd dockerfiles && cp .env.dev .env && docker compose up` (local emulated TEE).
4. Read https://github.com/HorizenOfficial/vela-nova (reference WASM app, TinyGo). Copy its main.go bridge pattern.
5. Create `enclave/`: main.go exporting deploy, load_module, deposit, process_request; state JSON-serialised; types from github.com/HorizenOfficial/vela-common-go v0.2.0. Map: deposit() -> core.Deposit; process_request payload types "lock" / "claim" / "refund" -> core.Lock / Claim / Refund; claim returns a types.Withdrawal. Replace Money(uint64) with types.Uint256 at the bridge only. Also: `now` comes from the request (enclave has no clock of its own); only the owner may call Invite; Flag is driven by the screening result; NotesOf must only answer the wallet itself; WithdrawCredit needs a request type. Decided values: MinWaitSecs = 86400 (24 h), MaxLockPerWallet = 1000 USDC during invite-only (PLAN.md decisions 9 and 10).
6. Build with `tinygo build -o build/unlinkpay.wasm -target=wasi .` (install TinyGo first).
7. `relayer/` (submits claims so fresh wallet needs no gas), then swap the placeholder Vela in `web/src/vela/index.ts` for the real client. When going real: remove the demo wallet (`mock` connector in `web/src/wagmi.ts`), the demo banner and `DemoPanel` (all keyed off `IS_DEMO` / `demo`).

## Known design risks (do not ignore)
- submitRequestFor (meta-tx) records sender AND facilitator on-chain: don't let claim leak the depositor.
- Enclave has no network; external data must arrive in the request.
- Fuel is set by the developer per call.
- Claims of the earliest note should be tested for timing/ordering leaks.
- Screening (PureFi) at deposit is a stub on testnet.
