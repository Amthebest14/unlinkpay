import { LockSimpleIcon } from '@phosphor-icons/react'
import { formatUsdc, type Money } from '../lib/money'

export function SecretTicket({ secret, amount, example = false }: { secret: string; amount: Money; example?: boolean }) {
  return (
    <div className="ticket">
      <div className="ticket-main">
        <p className="ticket-label">{example ? 'Example secret' : 'Your secret'}</p>
        <p className="ticket-amount">
          {formatUsdc(amount)} <span>USDC</span>
        </p>
        <code className="ticket-code">{secret}</code>
      </div>
      <div className="ticket-stub">
        <LockSimpleIcon size={20} aria-hidden="true" />
        <span>Keep private</span>
      </div>
    </div>
  )
}
