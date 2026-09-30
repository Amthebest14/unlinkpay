import { useEffect, useState, type FormEvent } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useConnection, useDisconnect } from 'wagmi'
import { isAddress } from 'viem'
import { CheckIcon, InfoIcon, WarningIcon } from '@phosphor-icons/react'
import { NoteStatusCard, effectiveState } from '../components/NoteStatusCard'
import { SecretInput } from '../components/SecretInput'
import { shortAddress } from '../lib/format'
import { formatUsdc } from '../lib/money'
import { cleanSecret, fingerprint } from '../lib/secret'
import { vela } from '../vela'
import { useVelaNow } from '../vela/hooks'
import { VelaError, errorText, feeFor, type Payout } from '../vela/types'
import { BAD_SECRET, NO_MATCH } from './Status'

export function Claim() {
  const { address: connected } = useConnection()
  const disconnect = useDisconnect()
  const now = useVelaNow()
  const [secretText, setSecretText] = useState('')
  const [to, setTo] = useState('')
  const [fp, setFp] = useState<string | null>(null)
  const [touched, setTouched] = useState(false)
  const [result, setResult] = useState<Payout | null>(null)

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
      setResult(payout)
      setSecretText('')
      setTo('')
      setTouched(false)
    },
  })

  const toClean = to.trim()
  const toValid = isAddress(toClean)
  const sameAsConnected = !!connected && toClean.toLowerCase() === connected.toLowerCase()
  const state = status.data ? effectiveState(status.data, now) : null
  const notFound = status.error instanceof VelaError && status.error.code === 'unknown-note'
  const payout = status.data ? status.data.denom - feeFor(vela.config, status.data.denom) : null

  const secretError = secretText.trim() && !secret ? BAD_SECRET : notFound ? NO_MATCH : null
  const toError =
    touched && toClean && !toValid
      ? 'Enter a full wallet address that starts with 0x.'
      : sameAsConnected
        ? "That's the wallet connected in this browser. Use a brand-new address instead."
        : null

  let blocker: string | null = null
  if (!secret) blocker = 'Paste your secret to check whether it can be claimed.'
  else if (status.isLoading || !status.data) blocker = notFound ? 'This secret has no note.' : 'Checking your note…'
  else if (state === 'waiting') blocker = 'Claim unlocks after 10 later deposits and the 24-hour wait.'
  else if (state !== 'ready') blocker = 'This note cannot be claimed.'
  else if (!toValid) blocker = 'Add the fresh wallet address.'
  else if (sameAsConnected) blocker = 'Use a different address from your connected wallet.'

  function submit(e: FormEvent) {
    e.preventDefault()
    setTouched(true)
    if (!blocker) claim.mutate()
  }

  if (result) {
    return (
      <div className="page-narrow">
        <header className="page-head">
          <h1>Claimed</h1>
          <p className="lead">
            {formatUsdc(result.amount)} USDC is on its way to <span className="mono">{shortAddress(result.to)}</span>.
          </p>
        </header>
        <section className="panel">
          <div className="callout callout-ok">
            <CheckIcon size={18} aria-hidden="true" />
            <p>
              In the real app, the relayer submits this for you and pays the gas. The fresh wallet never touches your old
              one. This demo moved no real money.
            </p>
          </div>
          <button
            type="button"
            className="btn"
            onClick={() => {
              setResult(null)
              claim.reset()
            }}
          >
            Claim another note
          </button>
        </section>
      </div>
    )
  }

  return (
    <div className="page-narrow">
      <header className="page-head">
        <h1>Claim</h1>
        <p className="lead">Send a note to a brand-new wallet using your secret.</p>
      </header>

      {connected ? (
        <div className="callout callout-warn">
          <WarningIcon size={18} aria-hidden="true" />
          <div>
            <p>
              A wallet is connected in this browser ({shortAddress(connected)}). For privacy, disconnect it before you
              claim.
            </p>
            <button type="button" className="btn btn-sm" onClick={() => disconnect.mutate()}>
              Disconnect
            </button>
          </div>
        </div>
      ) : (
        <div className="callout">
          <InfoIcon size={18} aria-hidden="true" />
          <p>
            You don't need to connect a wallet here. The relayer pays the gas, so the fresh wallet can be completely
            empty.
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
            inputMode="text"
            autoComplete="off"
            spellCheck={false}
            placeholder="0x…"
            value={to}
            aria-invalid={toError ? true : undefined}
            aria-describedby={toError ? 'claim-to-error' : 'claim-to-help'}
            onChange={(e) => setTo(e.target.value)}
            onBlur={() => setTouched(true)}
          />
          {toError ? (
            <p id="claim-to-error" className="field-error">
              {toError}
            </p>
          ) : (
            <p id="claim-to-help" className="field-help">
              A wallet that has never touched the one you deposited from.
            </p>
          )}
        </div>

        {status.data && <NoteStatusCard status={status.data} now={now} />}

        <div className="submit-row">
          <button type="submit" className="btn btn-primary" disabled={!!blocker || claim.isPending}>
            {claim.isPending ? 'Claiming…' : payout !== null ? `Claim ${formatUsdc(payout)} USDC` : 'Claim'}
          </button>
          {blocker && <p className="field-help">{blocker}</p>}
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
