import { useState } from 'react'
import { SlidersHorizontalIcon, XIcon } from '@phosphor-icons/react'
import { formatDuration, formatWhen } from '../lib/format'
import { USDC } from '../lib/money'
import { demo } from '../vela'
import { useVelaNow } from '../vela/hooks'

// Only exists while Vela is simulated. The real app has no controls like these.
export function DemoPanel() {
  const [open, setOpen] = useState(false)
  const now = useVelaNow()
  if (!demo) return null
  const controls = demo
  const offset = controls.clockOffset()

  if (!open) {
    return (
      <button type="button" className="btn btn-sm demo-toggle" onClick={() => setOpen(true)}>
        <SlidersHorizontalIcon size={16} aria-hidden="true" />
        Demo controls
      </button>
    )
  }

  return (
    <aside className="demo-panel" aria-label="Demo controls">
      <div className="demo-head">
        <p className="demo-title">Demo controls</p>
        <button type="button" className="btn btn-icon" aria-label="Close demo controls" onClick={() => setOpen(false)}>
          <XIcon size={16} aria-hidden="true" />
        </button>
      </div>
      <p className="demo-note">Stand-ins for other people and for time passing. Not part of the real app.</p>
      <div className="demo-actions">
        <button type="button" className="btn btn-sm" onClick={() => controls.addCrowd(100n * USDC, 10)}>
          Add 10 deposits of 100
        </button>
        <button type="button" className="btn btn-sm" onClick={() => controls.addCrowd(1000n * USDC, 10)}>
          Add 10 deposits of 1,000
        </button>
        <button type="button" className="btn btn-sm" onClick={() => controls.skipAhead(24 * 3600)}>
          Skip ahead 24 hours
        </button>
        <button
          type="button"
          className="btn btn-sm btn-danger-quiet"
          onClick={() => window.confirm('Reset the demo? All demo notes and credit are cleared.') && controls.reset()}
        >
          Reset demo
        </button>
      </div>
      <p className="demo-clock">
        Demo clock: {formatWhen(now)}
        {offset > 0 && <span> (+{formatDuration(offset)})</span>}
      </p>
    </aside>
  )
}
