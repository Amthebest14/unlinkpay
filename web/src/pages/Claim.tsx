import { useEffect, useState, type FormEvent } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useConnection, useDisconnect } from 'wagmi'
import { isAddress } from 'viem'
import { CheckIcon, InfoIcon, WarningIcon } from '@phosphor-icons/react'
import { NoteStatusCard, effectiveState } from '../components/NoteStatusCard'
import { SecretInput } from '../components/SecretInput'
import { formatDuration, shortAddress } from '../lib/format'
import { formatUsdc, type Money } from '../lib/money'
import { cleanSecret, fingerprint } from '../lib/secret'
import { href } from '../router'
import { vela } from '../vela'
import { useVelaNow } from '../vela/hooks'
import { VelaError, errorText, feeFor } from '../vela/types'
import { BAD_SECRET, NO_MATCH } from './Status'

interface Claimed {
  denom: Money
  fee: Money
  amount: Money
  to: string
}

const FEE_LABEL = `${(Number(vela.config.feeBps) / 100).toFixed(2)}%`

function ClaimedView({ result, onAgain }: { result: Claimed; onAgain: () => void }) {
  return (
    <div className="page-narrow">
      <header className="page-head">
        <h1>Claimed to your fresh wallet</h1>
        <p className="lead">
          {formatUsdc(result.amount)} USDC is on its way to <span className="mono">{shortAddress(result.to)}</span>. The
          relayer paid the gas.
        </p>
      </header>
      <section className="panel">
        <dl className="breakdown">
          <div>
            <dt>Note</dt>
            <dd>{formatUsdc(result.denom)} USDC</dd>
          </div>
          <div>
            <dt>Claim fee ({FEE_LABEL})</dt>
            <dd>{formatUsdc(result.fee)} USDC</dd>
          </div>
          <div>
            <dt>Fresh wallet receives</dt>
            <dd>{formatUsdc(result.amount)} USDC</dd>
          </div>
        </dl>
      </section>
      <div className="callout callout-ok" role="status">
        <CheckIcon size={18} aria-hidden="true" />
        <p>This secret is now used up. You can delete your saved copy.</p>
      </div>
      <p className="next-link">
        <a href={href('status')} onClick={onAgain}>
          Check another note
        </a>
      </p>
    </div>
  )
}

export function Claim() {
  const { address: connected } = useConnection()
  const disconnect = useDisconnect()
  const now = useVelaNow()
  const [secretText, setSecretText] = useState('')
  const [to, setTo] = useState('')
  const [fp, setFp] = useState<string | null>(null)
  const [touched, setTouched] = useState(false)
  const [result, setResult] = useState<Claimed | null>(null)

  const secret = cleanSecret(secretText)

  useEffect(() => {
    let live = true
    if (!secret) {
      setFp(null)
      return
    }
    void fingerprint(secret).then((f) => live && setFp(f))
    return () => {
      live = false
    }
  }, [secret])

  const status = useQuery({
    queryKey: ['vela', 'status', fp ?? ''],
    queryFn: () => vela.statusOf(fp!),
    enabled: !!fp,
  })

  const claim = useMutation({
    mutationFn: () => vela.claim(secret!, to.trim()),
    onSuccess: (payout) => {
      const denom = status.data?.denom ?? payout.amount
      setResult({ denom, fee: denom - payout.amount, amount: payout.amount, to: payout.to })
      setSecretText('')
      setTo('')
      setTouched(false)
    },
  })

  const toClean = to.trim()
  const toValid = isAddress(toClean)
  const sameAsConnected = !!connected && toClean.toLowerCase() === connected.toLowerCase()
  const note = status.data
  const state = note ? effectiveState(note, now) : null
  const notFound = status.error instanceof VelaError && status.error.code === 'unknown-note'
  const fee = note ? feeFor(vela.config, note.denom) : null
  const payout = note && fee !== null ? note.denom - fee : null

  const secretError = secretText.trim() && !secret ? BAD_SECRET : notFound ? NO_MATCH : null
  const toError =
    touched && toClean && !toValid
      ? "That isn't a complete address. It starts with 0x followed by 40 letters and numbers."
      : sameAsConnected
        ? "That's the wallet connected in this browser. Use a brand-new address instead."
        : null

  let blocker: string | null = null
  if (!secretText.trim()) blocker = 'Paste your secret to check whether it can be claimed.'
  else if (secretError) blocker = 'Fix the secret above first.'
  else if (!note) blocker = 'Checking your note…'
  else if (state === 'waiting') {
    const parts: string[] = []
    const missing = note.need - note.crowd
    if (missing > 0) parts.push(`${missing} more later deposit${missing === 1 ? '' : 's'}`)
    if (note.unlocksAt > now) parts.push(`${formatDuration(note.unlocksAt - now)} of waiting`)
    blocker = `Not ready yet. It still needs ${parts.join(' and ')}.`
  } else if (state === 'claimed') blocker = 'This note has already been claimed.'
  else if (state === 'refunded') blocker = "This note was refunded, so it can't be claimed."
  else if (state === 'refund-only') blocker = 'This note can only be refunded to the wallet it came from.'
  else if (!toClean) blocker = 'Add the fresh wallet address that should receive the money.'
  else if (!toValid || sameAsConnected) blocker = 'Fix the address above first.'

  function submit(e: FormEvent) {
    e.preventDefault()
    setTouched(true)
    if (!blocker && !claim.isPending) claim.mutate()
  }

  if (result) {
    return (
      <ClaimedView
        result={result}
        onAgain={() => {
          setResult(null)
          claim.reset()
        }}
      />
    )
  }

  const amountLabel = payout !== null ? `${formatUsdc(payout)} USDC` : ''

  return (
    <div className="page-narrow">
      <header className="page-head">
        <h1>Claim</h1>
        <p className="lead">Send a note to a brand-new wallet using your secret.</p>
      </header>

      {connected ? (
        <div className="callout callout-warn" role="alert">
          <WarningIcon size={18} aria-hidden="true" />
          <div>
            <p>
              A wallet is connected. If it's the one you deposited from, disconnect it before you claim, or the two can
              be linked.
            </p>
            <button type="button" className="btn btn-sm" onClick={() => disconnect.mutate()}>
              Disconnect wallet
            </button>
          </div>
        </div>
      ) : (
        <div className="callout" role="note">
          <InfoIcon size={18} aria-hidden="true" />
          <p>
            Don't connect the wallet you deposited from. You don't need a wallet here at all: the relayer pays the gas,
            so the fresh wallet can be completely empty.
          </p>
        </div>
      )}

      <form className="panel form" onSubmit={submit} noValidate>
        <SecretInput id="claim-secret" value={secretText} onChange={setSecretText} error={secretError} />

        <div className="field">
          <label htmlFor="claim-to">Fresh wallet address</label>
          <input
            id="claim-to"
            className="input mono"
            type="text"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            placeholder="0x…"
            value={to}
            aria-invalid={toError ? true : undefined}
            aria-describedby="claim-to-help"
            onChange={(e) => setTo(e.target.value)}
            onBlur={() => setTouched(true)}
          />
          {toError ? (
            <p id="claim-to-help" className="field-error" role="alert">
              {toError}
            </p>
          ) : (
            <p id="claim-to-help" className="field-help">
              A wallet that has never touched the one you deposited from.
            </p>
          )}
        </div>

        {note && <NoteStatusCard status={note} now={now} />}

        <div className="submit-row">
          {claim.isPending ? (
            <>
              <button type="button" className="btn btn-primary" aria-disabled="true">
                Claiming {amountLabel}…
              </button>
              <p className="field-help" aria-live="polite">
                Sending through the relayer. Keep this page open.
              </p>
            </>
          ) : (
            <>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={!!blocker}
                aria-describedby="claim-reason"
              >
                {amountLabel ? `Claim ${amountLabel}` : 'Claim'}
              </button>
              <p id="claim-reason" className="field-help">
                {blocker ?? (fee !== null && `${formatUsdc(fee)} USDC fee. The relayer pays the gas.`)}
              </p>
            </>
          )}
        </div>
        {claim.error && (
          <p className="field-error" role="alert">
            {errorText(claim.error)}
          </p>
        )}
      </form>
    </div>
  )
}
