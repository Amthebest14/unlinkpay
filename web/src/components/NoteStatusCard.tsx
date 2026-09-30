import { useState } from 'react'
import { dayWord, formatDuration } from '../lib/format'
import { formatUsdc } from '../lib/money'
import type { NoteState, NoteStatus } from '../vela/types'

export const STATE_LABEL: Record<NoteState, string> = {
  waiting: 'Waiting',
  ready: 'Ready to claim',
  claimed: 'Claimed',
  refunded: 'Refunded',
  'refund-only': 'Refund only',
}

const STATE_TEXT: Partial<Record<NoteState, string>> = {
  claimed: "This note has been claimed. Its secret can't be used again.",
  refunded: 'This note was refunded to the wallet it came from. Its secret no longer works.',
  'refund-only': "This deposit didn't pass the sanctions check, so it can only be refunded to the wallet it came from.",
}

// Time moves on after the status was fetched, so readiness is re-checked here.
export function effectiveState(status: NoteStatus, now: number): NoteState {
  if (status.state === 'waiting' && status.crowd >= status.need && now >= status.unlocksAt) return 'ready'
  return status.state
}

function CrowdTicks({ have, need }: { have: number; need: number }) {
  return (
    <div className="ticks" role="img" aria-label={`${have} of ${need} later deposits`}>
      {Array.from({ length: need }, (_, i) => (
        <span key={i} className={i < have ? 'tick tick-on' : 'tick'} />
      ))}
    </div>
  )
}

// A random moment 1 to 48 hours ahead, rounded to 5 minutes, so claims don't cluster at the unlock time.
function randomClaimTime(now: number): number {
  const r = crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32
  return Math.round((now + 3600 + r * 47 * 3600) / 300) * 300
}

function SuggestedTime({ now }: { now: number }) {
  const [at, setAt] = useState(() => randomClaimTime(now))
  return (
    <div className="status-tip">
      <p>
        For more privacy, don't claim the moment it's ready. Try around <strong>{dayWord(at, now)}</strong>, so claims
        don't cluster at the unlock time.
      </p>
      <button type="button" className="btn btn-sm" onClick={() => setAt(randomClaimTime(now))}>
        Suggest another time
      </button>
    </div>
  )
}

export function NoteStatusCard({ status, now }: { status: NoteStatus; now: number }) {
  const state = effectiveState(status, now)
  const waitLeft = status.unlocksAt - now
  const open = state === 'waiting' || state === 'ready'
  const text = STATE_TEXT[state]

  return (
    <section className="panel status-card" aria-live="polite">
      <div className="status-head">
        <p className="status-amount">{formatUsdc(status.denom)} USDC</p>
        <span className={`badge badge-${state}`}>{STATE_LABEL[state]}</span>
      </div>

      {open && (
        <dl className="status-rows">
          <div>
            <dt>Crowd</dt>
            <dd>
              <CrowdTicks have={Math.min(status.crowd, status.need)} need={status.need} />
              <span>
                {Math.min(status.crowd, status.need)} of {status.need} later deposits
              </span>
            </dd>
          </div>
          <div>
            <dt>Wait</dt>
            <dd>
              <span>
                {waitLeft > 0
                  ? `${formatDuration(waitLeft)} left, ends ${dayWord(status.unlocksAt, now)}`
                  : '24-hour wait is over'}
              </span>
            </dd>
          </div>
        </dl>
      )}

      {state === 'ready' && <SuggestedTime now={now} />}
      {text && <p className="status-note">{text}</p>}
    </section>
  )
}
