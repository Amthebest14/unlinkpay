import { useState } from 'react'
import { formatDuration, formatWhen } from '../lib/format'
import { formatUsdc } from '../lib/money'
import type { NoteState, NoteStatus } from '../vela/types'

const STATE_LABEL: Record<NoteState, string> = {
  waiting: 'Waiting',
  ready: 'Ready to claim',
  claimed: 'Claimed',
  refunded: 'Refunded',
  'refund-only': 'Refund only',
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

function SuggestedTime({ now }: { now: number }) {
  // A random moment 1 to 48 hours from now, picked once per visit.
  const [at] = useState(() => {
    const r = crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32
    return now + 3600 + Math.floor(r * 47 * 3600)
  })
  return (
    <p className="status-tip">
      For better privacy, don't claim the moment it unlocks. A random time such as <strong>{formatWhen(at)}</strong> is
      harder to link to your deposit.
    </p>
  )
}

export function NoteStatusCard({ status, now }: { status: NoteStatus; now: number }) {
  const state = effectiveState(status, now)
  const waitLeft = status.unlocksAt - now
  const open = state === 'waiting' || state === 'ready'

  return (
    <section className="panel status-card" aria-live="polite">
      <div className="status-head">
        <p className="status-amount">{formatUsdc(status.denom)} USDC note</p>
        <span className={`badge badge-${state}`}>{STATE_LABEL[state]}</span>
      </div>

      {open && (
        <dl className="status-rows">
          <div>
            <dt>Crowd</dt>
            <dd>
              <CrowdTicks have={Math.min(status.crowd, status.need)} need={status.need} />
              <span>
                {status.crowd} of {status.need} later deposits
              </span>
            </dd>
          </div>
          <div>
            <dt>Wait</dt>
            <dd>
              {waitLeft > 0 ? (
                <span>
                  {formatDuration(waitLeft)} left, ends {formatWhen(status.unlocksAt)}
                </span>
              ) : (
                <span>24-hour wait is over</span>
              )}
            </dd>
          </div>
        </dl>
      )}

      {state === 'ready' && <SuggestedTime now={now} />}
      {state === 'claimed' && <p className="status-note">This note was already claimed.</p>}
      {state === 'refunded' && <p className="status-note">This note was refunded to the wallet it came from.</p>}
      {state === 'refund-only' && (
        <p className="status-note">
          The depositing wallet was flagged by the sanctions check. This note can only be refunded to it.
        </p>
      )}
    </section>
  )
}
