import { useState } from 'react'
import { EyeIcon, EyeSlashIcon } from '@phosphor-icons/react'

// A plain text field masked with CSS, so browsers don't offer to save the secret as a password.
export function SecretInput({
  id,
  value,
  onChange,
  error,
}: {
  id: string
  value: string
  onChange: (value: string) => void
  error?: string | null
}) {
  const [show, setShow] = useState(false)
  const describedBy = `${id}-${error ? 'error' : 'help'}`
  return (
    <div className="field">
      <label htmlFor={id}>Secret</label>
      <div className="input-row">
        <input
          id={id}
          className={show ? 'input mono' : 'input mono masked'}
          type="text"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          data-1p-ignore
          data-lpignore="true"
          placeholder="unlinkpay:…"
          value={value}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          className="btn btn-icon"
          aria-label={show ? 'Hide secret' : 'Show secret'}
          onClick={() => setShow((s) => !s)}
        >
          {show ? <EyeSlashIcon size={18} aria-hidden="true" /> : <EyeIcon size={18} aria-hidden="true" />}
        </button>
      </div>
      {error ? (
        <p id={describedBy} className="field-error">
          {error}
        </p>
      ) : (
        <p id={describedBy} className="field-help">
          Paste the whole secret from your saved file. It never leaves this page unencrypted.
        </p>
      )}
    </div>
  )
}
