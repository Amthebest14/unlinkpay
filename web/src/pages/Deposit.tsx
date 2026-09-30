import { useEffect, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useConnection } from 'wagmi'
import { CheckIcon, CopyIcon, DownloadSimpleIcon, LockSimpleIcon, WarningIcon } from '@phosphor-icons/react'
import { NetworkCheck, TARGET_CHAIN, useWrongNetwork } from '../components/NetworkCheck'
import { NoteStatusCard } from '../components/NoteStatusCard'
import { SecretTicket } from '../components/SecretTicket'
import { WalletButton } from '../components/WalletButton'
import { formatUsdc, type Money } from '../lib/money'
import { fingerprint, makeSecret, secretFileText } from '../lib/secret'
import { href } from '../router'
import { vela } from '../vela'
import { useVelaNow } from '../vela/hooks'
import { errorText, feeFor } from '../vela/types'

type StepState = 'done' | 'current' | 'upcoming'
type Phase = 'idle' | 'approving' | 'locking'

const RISK_KEY = 'unlinkpay-risk-ok'

function readRiskOk(): boolean {
  try {
    return localStorage.getItem(RISK_KEY) === '1'
  } catch {
    return false
  }
}

function saveRiskOk(ok: boolean) {
  try {
    if (ok) localStorage.setItem(RISK_KEY, '1')
    else localStorage.removeItem(RISK_KEY)
  } catch {
    // Storage blocked: the tick lasts for this visit only.
  }
}

function Step({
  n,
  title,
  state,
  summary,
  children,
}: {
  n: number
  title: string
  state: StepState
  summary?: ReactNode
  children?: ReactNode
}) {
  return (
    <li className={`step step-${state}`} aria-current={state === 'current' ? 'step' : undefined}>
      <div className="step-marker" aria-hidden="true">
        {state === 'done' ? <CheckIcon size={14} weight="bold" /> : n}
      </div>
      <div className="step-body">
        <h2 className="step-title">{title}</h2>
        {state === 'current' && children}
        {state === 'done' && summary && <p className="step-summary">{summary}</p>}
      </div>
    </li>
  )
}

function Locked({ denom, fp, onAgain }: { denom: Money; fp: string; onAgain: () => void }) {
  const now = useVelaNow()
  const cfg = vela.config
  const status = useQuery({ queryKey: ['vela', 'status', fp], queryFn: () => vela.statusOf(fp) })
  return (
    <div className="page-narrow">
      <header className="page-head">
        <h1>Your {formatUsdc(denom)} USDC is locked</h1>
        <p className="lead">
          It can be claimed to a fresh wallet once {cfg.minCrowd} more {formatUsdc(denom)} USDC deposits arrive and{' '}
          {cfg.minWaitSecs / 3600} hours pass. There's nothing else to do right now.
        </p>
      </header>
      {status.data && <NoteStatusCard status={status.data} now={now} />}
      <section className="panel">
        <h2 className="panel-title">What happens next</h2>
        <ol className="plain-list">
          <li>Keep the secret file somewhere only you can reach. Nobody can recover it for you.</li>
          <li>Check progress on the Status page whenever you like. Your note waits as long as it needs to.</li>
          <li>When it's ready, open Claim without connecting this wallet, ideally in a different browser.</li>
        </ol>
        <div className="actions">
          <a className="btn btn-primary" href={href('status')}>
            Check status
          </a>
          <button type="button" className="btn" onClick={onAgain}>
            Make another deposit
          </button>
        </div>
      </section>
    </div>
  )
}

export function Deposit() {
  const { address } = useConnection()
  const cfg = vela.config
  const [picked, setPicked] = useState<Money | null>(null)
  const [secret, setSecret] = useState<string | null>(null)
  const [downloaded, setDownloaded] = useState(false)
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [continued, setContinued] = useState(false)
  const [phase, setPhase] = useState<Phase>('idle')
  const [locked, setLocked] = useState<{ denom: Money; fp: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [riskOk, setRiskOk] = useState(readRiskOk)
  const wrongNetwork = useWrongNetwork()

  const lockedTotal = useQuery({
    queryKey: ['vela', 'lockedTotal', address ?? ''],
    queryFn: () => vela.lockedTotalOf(address!),
    enabled: !!address,
  })

  function reset() {
    setPicked(null)
    setSecret(null)
    setDownloaded(false)
    setCopied(false)
    setCopyError(false)
    setConfirmed(false)
    setContinued(false)
    setPhase('idle')
    setLocked(null)
    setError(null)
  }

  // A different wallet means a different deposit: start over.
  useEffect(reset, [address])

  const remaining =
    cfg.maxLockPerWallet > 0n && lockedTotal.data !== undefined ? cfg.maxLockPerWallet - lockedTotal.data : null
  const fits = (d: Money) => remaining === null || d <= remaining
  const denom = picked ?? cfg.denominations.find(fits) ?? null
  // A failed copy still unlocks the checkbox: the secret can be selected and copied by hand.
  const hasSaved = downloaded || copied || copyError
  const busy = phase !== 'idle'

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
    let stage: Phase = 'approving'
    try {
      setPhase(stage)
      // If an earlier try deposited but failed to lock, reuse that credit.
      if ((await vela.creditOf(address)) < denom) await vela.deposit(address, denom)
      stage = 'locking'
      setPhase(stage)
      const fp = await fingerprint(secret)
      await vela.lock(address, denom, fp)
      setSecret(null)
      setLocked({ denom, fp })
    } catch (e) {
      setError(
        stage === 'locking'
          ? `${errorText(e)} Your deposit is kept as credit. You can withdraw it on the Refund page.`
          : errorText(e),
      )
    } finally {
      setPhase('idle')
    }
  }

  if (locked) return <Locked denom={locked.denom} fp={locked.fp} onAgain={reset} />

  const s1: StepState = address ? 'done' : 'current'
  const s2: StepState = !address ? 'upcoming' : secret ? 'done' : 'current'
  const s3: StepState = !secret ? 'upcoming' : continued ? 'done' : 'current'
  const s4: StepState = continued ? 'current' : 'upcoming'
  const rowNote = (row: 1 | 2) =>
    row === 1
      ? phase === 'approving'
        ? 'Confirm in your wallet'
        : phase === 'locking'
          ? 'Done'
          : ''
      : phase === 'locking'
        ? 'Confirm in your wallet'
        : ''

  return (
    <div className="page-narrow">
      <header className="page-head">
        <h1>Deposit</h1>
        <p className="lead">Lock a fixed amount under a secret only you hold. Later, a fresh wallet claims it with that secret.</p>
      </header>

      <NetworkCheck />

      <ol className="steps">
        <Step n={1} title="Connect the wallet you're paying from" state={s1} summary="Wallet connected.">
          <p>This is your known wallet. The money leaves from here.</p>
          <WalletButton />
        </Step>

        <Step
          n={2}
          title="Choose an amount"
          state={s2}
          summary={denom && `${formatUsdc(denom)} USDC. The claim receives ${formatUsdc(denom - feeFor(cfg, denom))} USDC.`}
        >
          <p>Every note of a size looks the same, so the amount is fixed.</p>
          <div className="size-options" role="radiogroup" aria-label="Note size">
            {cfg.denominations.map((d) => {
              const over = !fits(d)
              const classes = ['size-option', denom === d && 'is-selected', over && 'is-disabled']
              return (
                <label key={d.toString()} className={classes.filter(Boolean).join(' ')}>
                  <input
                    type="radio"
                    name="denom"
                    value={d.toString()}
                    checked={denom === d}
                    disabled={over}
                    onChange={() => setPicked(d)}
                  />
                  <span className="size-amount">
                    {formatUsdc(d)} <small>USDC</small>
                  </span>
                  <span className="size-detail">
                    {over && remaining !== null
                      ? `More than the ${formatUsdc(remaining)} USDC left in your pilot limit`
                      : `The claim receives ${formatUsdc(d - feeFor(cfg, d))} USDC`}
                  </span>
                </label>
              )
            })}
          </div>
          <p className="field-help">
            {remaining !== null && `You can deposit ${formatUsdc(remaining)} more USDC during the invite-only pilot. `}
            The size can't be changed once your secret exists.
          </p>
          {denom ? (
            <>
              <label className="check">
                <input
                  type="checkbox"
                  value="risk"
                  checked={riskOk}
                  onChange={(e) => {
                    setRiskOk(e.target.checked)
                    saveRiskOk(e.target.checked)
                  }}
                />
                <span>
                  I've read the <a href={href('risks')}>risk notice</a>
                </span>
              </label>
              <div className="submit-row">
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={!riskOk}
                  aria-describedby={riskOk ? undefined : 'dep-risk-why'}
                  onClick={() => setSecret(makeSecret())}
                >
                  Create my secret
                </button>
                {!riskOk && (
                  <p id="dep-risk-why" className="field-help">
                    Read the risk notice and tick the box first.
                  </p>
                )}
              </div>
            </>
          ) : (
            <p className="field-error">This wallet has reached its limit for the invite-only pilot.</p>
          )}
        </Step>

        <Step n={3} title="Save your secret" state={s3} summary="Secret saved. It won't be shown again.">
          {secret && denom && (
            <>
              <div className="callout callout-warn">
                <WarningIcon size={18} aria-hidden="true" />
                <p>This is shown once. Anyone with it can claim the money, so save it before you go on.</p>
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
              {copied && (
                <p className="field-help">
                  Copied. Clipboard history can keep it, so clear it once the secret is saved somewhere safe.
                </p>
              )}
              <label className={hasSaved ? 'check' : 'check is-disabled'}>
                <input
                  type="checkbox"
                  value="saved"
                  checked={confirmed}
                  disabled={!hasSaved}
                  aria-describedby={hasSaved ? undefined : 'dep-check-help'}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                <span>I saved my secret somewhere only I can reach</span>
              </label>
              {!hasSaved && (
                <p id="dep-check-help" className="field-help">
                  Download or copy the secret first.
                </p>
              )}
              <div className="submit-row">
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={!confirmed}
                  aria-describedby={confirmed ? undefined : 'dep-continue-why'}
                  onClick={() => setContinued(true)}
                >
                  Continue
                </button>
                {!confirmed && (
                  <p id="dep-continue-why" className="field-help">
                    Tick the box once your secret is saved.
                  </p>
                )}
              </div>
            </>
          )}
        </Step>

        <Step n={4} title="Deposit and lock" state={s4}>
          {denom && (
            <>
              <p>Two transactions in your wallet. Keep this page open until both finish.</p>
              <ul className="progress" aria-live="polite">
                <li className={phase === 'approving' ? 'is-active' : phase === 'locking' ? 'is-done' : ''}>
                  <span>Approve {formatUsdc(denom)} USDC</span>
                  <span className="progress-note">{rowNote(1)}</span>
                </li>
                <li className={phase === 'locking' ? 'is-active' : ''}>
                  <span>Deposit and lock the note</span>
                  <span className="progress-note">{rowNote(2)}</span>
                </li>
              </ul>
              {!busy && (
                <div className="submit-row">
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={wrongNetwork}
                    aria-describedby={wrongNetwork ? 'dep-network-why' : undefined}
                    onClick={depositAndLock}
                  >
                    <LockSimpleIcon size={16} aria-hidden="true" />
                    Deposit and lock {formatUsdc(denom)} USDC
                  </button>
                  {wrongNetwork && (
                    <p id="dep-network-why" className="field-help">
                      Switch your wallet to {TARGET_CHAIN.name} first.
                    </p>
                  )}
                </div>
              )}
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
