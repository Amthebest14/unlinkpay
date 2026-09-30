import { useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { NoteStatusCard, effectiveState } from '../components/NoteStatusCard'
import { SecretInput } from '../components/SecretInput'
import { cleanSecret, fingerprint } from '../lib/secret'
import { href } from '../router'
import { vela } from '../vela'
import { useVelaNow } from '../vela/hooks'
import { VelaError } from '../vela/types'

export const BAD_SECRET =
  "That doesn't look like an UnlinkPay secret. It starts with unlinkpay: followed by 64 letters and numbers."
export const NO_MATCH = 'No note matches this secret. Check that you copied all of it.'

export function SkeletonCard({ label }: { label: string }) {
  return (
    <div className="panel skeleton-lines" aria-busy="true" aria-label={label}>
      <span />
      <span />
      <span />
    </div>
  )
}

export function Status() {
  const now = useVelaNow()
  const [text, setText] = useState('')
  const [fp, setFp] = useState<string | null>(null)
  const [inputError, setInputError] = useState<string | null>(null)

  const status = useQuery({
    queryKey: ['vela', 'status', fp ?? ''],
    queryFn: () => vela.statusOf(fp!),
    enabled: !!fp,
  })

  async function check(e: FormEvent) {
    e.preventDefault()
    const secret = cleanSecret(text)
    if (!secret) {
      setInputError(BAD_SECRET)
      setFp(null)
      return
    }
    setInputError(null)
    setFp(await fingerprint(secret))
  }

  const notFound = status.error instanceof VelaError && status.error.code === 'unknown-note'

  return (
    <div className="page-narrow">
      <header className="page-head">
        <h1>Status</h1>
        <p className="lead">See how close your note is to being claimable. Your secret stays on this page.</p>
      </header>

      <form className="panel form" onSubmit={check} noValidate>
        <SecretInput
          id="status-secret"
          value={text}
          onChange={(v) => {
            setText(v)
            setInputError(null)
          }}
          error={inputError ?? (notFound ? NO_MATCH : null)}
        />
        <button type="submit" className="btn btn-primary">
          Check status
        </button>
      </form>

      {status.isLoading && <SkeletonCard label="Checking your note" />}
      {status.error && !notFound && <p className="field-error">Couldn't load the status. Try again.</p>}
      {status.data && (
        <>
          <NoteStatusCard status={status.data} now={now} />
          {effectiveState(status.data, now) === 'ready' && (
            <p className="next-link">
              When you're ready, <a href={href('claim')}>go to Claim</a>.
            </p>
          )}
        </>
      )}
    </div>
  )
}
