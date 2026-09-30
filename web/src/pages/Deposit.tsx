import { useEffect, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useConnection } from 'wagmi'
import { CheckIcon, CopyIcon, DownloadSimpleIcon, WarningIcon } from '@phosphor-icons/react'
import { SecretTicket } from '../components/SecretTicket'
import { WalletButton } from '../components/WalletButton'
import { shortAddress } from '../lib/format'
import { formatUsdc, type Money } from '../lib/money'
import { fingerprint, makeSecret, secretFileText } from '../lib/secret'
import { href } from '../router'
import { vela } from '../vela'
import { errorText, feeFor } from '../vela/types'

type StepState = 'done' | 'current' | 'upcoming'
type Phase = 'idle' | 'depositing' | 'locking' | 'done'

function Step({ n, title, state, children }: { n: number; title: string; state: StepState; children?: ReactNode }) {
  return (
    <li className={`step step-${state}`} aria-current={state === 'current' ? 'step' : undefined}>
      <div className="step-marker" aria-hidden="true">
        {state === 'done' ? <CheckIcon size={14} weight="bold" /> : n}
      </div>
      <div className="step-body">
        <h2 className="step-title">{title}</h2>
        {state !== 'upcoming' && children}
      </div>
    </li>
  )
}

export function Deposit() {
  const { address } = useConnection()
  const cfg = vela.config
  const [denom, setDenom] = useState<Money | null>(null)
  const [secret, setSecret] = useState<string | null>(null)
  const [downloaded, setDownloaded] = useState(false)
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [phase, setPhase] = useState<Phase>('idle')
  const [lockedDenom, setLockedDenom] = useState<Money | null>(null)
  const [error, setError] = useState<string | null>(null)

  const lockedTotal = useQuery({
    queryKey: ['vela', 'lockedTotal', address ?? ''],
    queryFn: () => vela.lockedTotalOf(address!),
    enabled: !!address,
  })

  function reset() {
    setDenom(null)
    setSecret(null)
    setDownloaded(false)
    setCopied(false)
    setCopyError(false)
    setConfirmed(false)
    setPhase('idle')
    setLockedDenom(null)
    setError(null)
  }

  // A different wallet means a different deposit: start over.
  useEffect(reset, [address])

  const remaining =
    cfg.maxLockPerWallet > 0n && lockedTotal.data !== undefined ? cfg.maxLockPerWallet - lockedTotal.data : null
  // A failed copy still unlocks the checkbox: the secret can be selected and copied by hand.
  const hasSaved = downloaded || copied || copyError
  const saved = hasSaved && confirmed
  const busy = phase === 'depositing' || phase === 'locking'

  function download() {
    if (!secret || !denom) return
    const blob = new Blob([secretFileText(secret, formatUsdc(denom))], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `unlinkpay-secret-${formatUsdc(denom).replace(',', '')}-usdc.txt`
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    setDownloaded(true)
  }

  function copy() {
    if (!secret) return
    navigator.clipboard.writeText(secret).then(
      () => {
        setCopied(true)
        setCopyError(false)
      },
      () => setCopyError(true),
    )
  }

  async function depositAndLock() {
    if (!address || !denom || !secret) return
    setError(null)
    let stage: Phase = 'depositing'
    try {
      setPhase(stage)
      // If an earlier try deposited but failed to lock, reuse that credit.
      if ((await vela.creditOf(address)) < denom) await vela.deposit(address, denom)
      stage = 'locking'
      setPhase(stage)
      await vela.lock(address, denom, await fingerprint(secret))
      setLockedDenom(denom)
      setSecret(null)
      setPhase('done')
    } catch (e) {
      setPhase('idle')
      setError(
        stage === 'locking'
          ? `${errorText(e)} Your deposit is kept as credit. You can withdraw it on the Refund page.`
          : errorText(e),
      )
    }
  }

  if (phase === 'done' && lockedDenom) {
    return (
      <div className="page-narrow">
        <header className="page-head">
          <h1>Your {formatUsdc(lockedDenom)} USDC is locked</h1>
          <p className="lead">
            It now waits for 10 later deposits of the same size and 24 hours. After that, whoever holds your secret can
            claim it.
          </p>
        </header>
        <section className="panel">
          <h2 className="panel-title">What to do next</h2>
          <ul className="plain-list">
            <li>Keep your secret file somewhere safe and private.</li>
            <li>
              Check progress anytime on the <a href={href('status')}>Status</a> page.
            </li>
            <li>
              When it's ready, claim from a brand-new wallet on the <a href={href('claim')}>Claim</a> page. Don't
              connect this wallet there.
            </li>
            <li>
              Changed your mind? This wallet can take the money back on the <a href={href('refund')}>Refund</a> page,
              with no fee.
            </li>
          </ul>
          <button type="button" className="btn" onClick={reset}>
            Make another deposit
          </button>
        </section>
      </div>
    )
  }

  return (
    <div className="page-narrow">
      <header className="page-head">
        <h1>Deposit</h1>
        <p className="lead">Lock a fixed amount under a secret only you hold. Later, a fresh wallet claims it with that secret.</p>
      </header>

      <ol className="steps">
        <Step n={1} title="Connect the wallet you're paying from" state={address ? 'done' : 'current'}>
          {address ? (
            <p>
              Paying from <span className="mono">{shortAddress(address)}</span>. This wallet is public, and that's fine:
              it's the side you're unlinking from.
            </p>
          ) : (
            <>
              <p>This is your known wallet. The money leaves from here.</p>
              <WalletButton />
            </>
          )}
        </Step>

        <Step n={2} title="Choose an amount" state={!address ? 'upcoming' : denom ? 'done' : 'current'}>
          <div className="size-options" role="radiogroup" aria-label="Amount">
            {cfg.denominations.map((d) => {
              const overLimit = remaining !== null && d > remaining
              const classes = ['size-option', denom === d && 'is-selected', overLimit && 'is-disabled']
              return (
                <label key={d.toString()} className={classes.filter(Boolean).join(' ')}>
                  <input
                    type="radio"
                    name="denom"
                    value={d.toString()}
                    checked={denom === d}
                    disabled={overLimit || !!secret || busy}
                    onChange={() => setDenom(d)}
                  />
                  <span className="size-amount">
                    {formatUsdc(d)} <small>USDC</small>
                  </span>
                  <span className="size-detail">
                    {overLimit ? 'Over your pilot limit' : `The claim receives ${formatUsdc(d - feeFor(cfg, d))} USDC`}
                  </span>
                </label>
              )
            })}
          </div>
          {remaining !== null && (
            <p className="field-help">
              During the invite-only pilot, each wallet can lock up to {formatUsdc(cfg.maxLockPerWallet)} USDC in total.
              You have {formatUsdc(remaining)} USDC left.
            </p>
          )}
          {secret && (
            <button type="button" className="btn btn-quiet btn-sm" onClick={reset} disabled={busy}>
              Change amount and start over
            </button>
          )}
        </Step>

        <Step n={3} title="Save your secret" state={!denom ? 'upcoming' : saved ? 'done' : 'current'}>
          {denom && !secret && (
            <>
              <p>Your browser makes a random secret. Only its fingerprint is sent, never the secret itself.</p>
              <button type="button" className="btn btn-primary" onClick={() => setSecret(makeSecret())}>
                Create my secret
              </button>
            </>
          )}
          {denom && secret && (
            <>
              <div className="callout callout-warn">
                <WarningIcon size={18} aria-hidden="true" />
                <p>
                  This is shown once. Anyone with it can claim the money. If you lose it, only this wallet can take the
                  money back.
                </p>
              </div>
              <SecretTicket secret={secret} amount={denom} />
              <div className="actions">
                <button type="button" className="btn" onClick={download}>
                  {downloaded ? <CheckIcon size={16} aria-hidden="true" /> : <DownloadSimpleIcon size={16} aria-hidden="true" />}
                  {downloaded ? 'Downloaded' : 'Download file'}
                </button>
                <button type="button" className="btn" onClick={copy}>
                  {copied ? <CheckIcon size={16} aria-hidden="true" /> : <CopyIcon size={16} aria-hidden="true" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              {copyError && (
                <p className="field-error">Copy didn't work here. Download the file, or select the secret and copy it.</p>
              )}
              <label className={hasSaved ? 'check' : 'check is-disabled'}>
                <input
                  type="checkbox"
                  value="saved"
                  checked={confirmed}
                  disabled={!hasSaved}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                <span>I saved my secret somewhere safe and private.</span>
              </label>
              {!hasSaved && <p className="field-help">Download or copy the secret first.</p>}
            </>
          )}
        </Step>

        <Step n={4} title="Deposit and lock" state={saved ? 'current' : 'upcoming'}>
          {denom && (
            <>
              <ul className="progress">
                <li className={phase === 'depositing' ? 'is-active' : phase === 'locking' ? 'is-done' : ''}>
                  Send {formatUsdc(denom)} USDC from your wallet
                </li>
                <li className={phase === 'locking' ? 'is-active' : ''}>Lock it under your secret's fingerprint</li>
              </ul>
              <p className="field-help">
                In the real app, your wallet asks you to approve USDC and then confirm the deposit. The demo skips those
                prompts.
              </p>
              <button type="button" className="btn btn-primary" onClick={depositAndLock} disabled={busy}>
                {phase === 'depositing' ? 'Depositing…' : phase === 'locking' ? 'Locking…' : `Deposit and lock ${formatUsdc(denom)} USDC`}
              </button>
              {error && (
                <p className="field-error" role="alert">
                  {error}
                </p>
              )}
            </>
          )}
        </Step>
      </ol>

      <p className="page-foot">
        If Vela stops running, there is no way to withdraw on your own yet. Start with an amount you're comfortable
        leaving in a new system.
      </p>
    </div>
  )
}
