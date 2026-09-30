import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useConnection } from 'wagmi'
import { CheckIcon } from '@phosphor-icons/react'
import { WalletButton } from '../components/WalletButton'
import { shortAddress } from '../lib/format'
import { formatUsdc } from '../lib/money'
import { href } from '../router'
import { vela } from '../vela'
import { errorText, type NoteInfo, type Payout } from '../vela/types'

function NoteRow({ note, wallet, onDone }: { note: NoteInfo; wallet: string; onDone: (p: Payout) => void }) {
  const [confirming, setConfirming] = useState(false)
  const status = useQuery({
    queryKey: ['vela', 'status', note.fingerprint],
    queryFn: () => vela.statusOf(note.fingerprint),
  })
  const refund = useMutation({ mutationFn: () => vela.refund(wallet, note.fingerprint), onSuccess: onDone })

  return (
    <li className="note-row">
      <div className="note-info">
        <p className="note-amount">{formatUsdc(note.denom)} USDC</p>
        <p className="note-meta">
          Note {note.seq} of this size
          {status.data && `. ${status.data.crowd} of ${status.data.need} later deposits so far`}
        </p>
      </div>
      {confirming ? (
        <div className="note-confirm">
          <p>
            Refund {formatUsdc(note.denom)} USDC to {shortAddress(wallet)}? Refunds are public, so this note stops hiding
            anyone.
          </p>
          <div className="actions">
            <button type="button" className="btn btn-primary btn-sm" disabled={refund.isPending} onClick={() => refund.mutate()}>
              {refund.isPending ? 'Refunding…' : 'Yes, refund'}
            </button>
            <button type="button" className="btn btn-quiet btn-sm" onClick={() => setConfirming(false)}>
              Keep it
            </button>
          </div>
          {refund.error && <p className="field-error">{errorText(refund.error)}</p>}
        </div>
      ) : (
        <button type="button" className="btn btn-sm" onClick={() => setConfirming(true)}>
          Refund
        </button>
      )}
    </li>
  )
}

export function Refund() {
  const { address } = useConnection()
  const [done, setDone] = useState<Payout | null>(null)
  const notes = useQuery({
    queryKey: ['vela', 'notesOf', address ?? ''],
    queryFn: () => vela.notesOf(address!),
    enabled: !!address,
  })
  const credit = useQuery({
    queryKey: ['vela', 'credit', address ?? ''],
    queryFn: () => vela.creditOf(address!),
    enabled: !!address,
  })
  const withdraw = useMutation({ mutationFn: () => vela.withdrawCredit(address!), onSuccess: setDone })

  return (
    <div className="page-narrow">
      <header className="page-head">
        <h1>Refund</h1>
        <p className="lead">
          Take back a note that hasn't been claimed. The full amount returns to the wallet it came from, with no fee. You
          don't need your secret.
        </p>
      </header>

      {!address ? (
        <section className="panel">
          <p>Connect the wallet you deposited from.</p>
          <WalletButton />
        </section>
      ) : (
        <>
          {done && (
            <div className="callout callout-ok" role="status">
              <CheckIcon size={18} aria-hidden="true" />
              <p>
                {formatUsdc(done.amount)} USDC sent back to {shortAddress(done.to)}. Demo only: no real money moved.
              </p>
            </div>
          )}

          <section className="panel">
            <h2 className="panel-title">Waiting notes from {shortAddress(address)}</h2>
            {notes.isLoading && <div className="skeleton-line" aria-busy="true" aria-label="Loading notes" />}
            {notes.data && notes.data.length === 0 && (
              <div className="empty">
                <p>This wallet has no waiting notes.</p>
                <a className="btn btn-sm" href={href('deposit')}>
                  Start a deposit
                </a>
              </div>
            )}
            {notes.data && notes.data.length > 0 && (
              <ul className="note-list">
                {notes.data.map((n) => (
                  <NoteRow key={n.fingerprint} note={n} wallet={address} onDone={setDone} />
                ))}
              </ul>
            )}
          </section>

          {credit.data !== undefined && credit.data > 0n && (
            <section className="panel">
              <h2 className="panel-title">Unlocked credit</h2>
              <p>
                {formatUsdc(credit.data)} USDC was deposited from this wallet but never locked into a note. It can only go
                back to this wallet.
              </p>
              <button type="button" className="btn" disabled={withdraw.isPending} onClick={() => withdraw.mutate()}>
                {withdraw.isPending ? 'Withdrawing…' : `Withdraw ${formatUsdc(credit.data)} USDC`}
              </button>
              {withdraw.error && <p className="field-error">{errorText(withdraw.error)}</p>}
            </section>
          )}
        </>
      )}
    </div>
  )
}
