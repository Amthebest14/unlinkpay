import { useQuery } from '@tanstack/react-query'
import { formatUsdc } from '../lib/money'
import { IS_DEMO, vela } from '../vela'

export function Stats() {
  const stats = useQuery({ queryKey: ['vela', 'stats'], queryFn: () => vela.stats() })
  const waiting = stats.data?.sizes.reduce((sum, s) => sum + s.waiting, 0) ?? 0

  return (
    <div className="page-wide">
      <header className="page-head">
        <h1>Stats</h1>
        <p className="lead">
          Built only from public on-chain data: counts and totals, never who deposited or who claimed.
          {IS_DEMO && ' In this demo, the numbers come from the simulated Vela in your browser.'}
        </p>
      </header>

      {stats.isLoading && <div className="panel skeleton-card" aria-busy="true" aria-label="Loading stats" />}
      {stats.error && <p className="field-error">Couldn't load stats. Try again.</p>}

      {stats.data && (
        <>
          <dl className="figures figures-3">
            <div>
              <dt>Notes waiting now</dt>
              <dd>{waiting}</dd>
            </div>
            <div>
              <dt>Total locked so far</dt>
              <dd>{formatUsdc(stats.data.volume)} USDC</dd>
            </div>
            <div>
              <dt>Fees collected</dt>
              <dd>{formatUsdc(stats.data.fees)} USDC</dd>
            </div>
          </dl>

          <div className="size-stats">
            {stats.data.sizes.map((s) => (
              <section key={s.denom.toString()} className="panel">
                <h2 className="panel-title">{formatUsdc(s.denom)} USDC notes</h2>
                <p className="crowd-now">
                  <span className="crowd-number">{s.waiting}</span> in the crowd right now
                </p>
                <dl className="size-breakdown">
                  <div>
                    <dt>Locked</dt>
                    <dd>{s.locked}</dd>
                  </div>
                  <div>
                    <dt>Claimed</dt>
                    <dd>{s.claimed}</dd>
                  </div>
                  <div>
                    <dt>Refunded</dt>
                    <dd>{s.refunded}</dd>
                  </div>
                </dl>
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
