# UnlinkPay

Private wallet funding on Horizen Vela. Put money in from a known wallet, take it out to a fresh one, and nobody can link the two.

Website (planned): unlinkpay.xyz

## Status
- `core/` — the rules (deposit, lock, claim after a crowd of K later deposits, refund, fee). Pure Go, fully tested. **Done (slice 1).**
- `web/` — home, deposit, status, claim, refund and stats pages, running against a placeholder Vela in the browser. **Demo working.** Run it with `npm --prefix web install` once, then `npm --prefix web run dev` and open http://localhost:5173.
- `enclave/` — thin bridge that plugs `core` into Vela's WASM exports. *After Vela access.*
- `relayer/` — sends the claim so the fresh wallet needs no gas. *After Vela access.*

## Run the tests
    go test ./... -v

## Rule of this repo
Nothing gets committed until the owner can explain it in plain words.
