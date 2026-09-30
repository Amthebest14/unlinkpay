import { useState } from 'react'
import { SlidersHorizontalIcon, XIcon } from '@phosphor-icons/react'
import { formatDuration } from '../lib/format'
import { applyTheme, savedTheme, type ThemeChoice } from '../lib/theme'
import { demo, vela } from '../vela'
import { useVelaNow } from '../vela/hooks'
import { STATE_LABEL, effectiveState } from './NoteStatusCard'

const THEMES: [ThemeChoice, string][] = [
  ['system', 'System'],
  ['light', 'Light'],
  ['dark', 'Dark'],
]

// Only exists while Vela is simulated. The real app has no controls like these.
export function DemoPanel() {
  const [open, setOpen] = useState(false)
  const [theme, setTheme] = useState<ThemeChoice>(savedTheme)
  const now = useVelaNow()
  if (!demo) return null
  const controls = demo
  const cfg = vela.config

  if (!open) {
    return (
      <button type="button" className="btn btn-sm demo-toggle" aria-expanded="false" onClick={() => setOpen(true)}>
        <SlidersHorizontalIcon size={16} aria-hidden="true" />
        Demo controls
      </button>
    )
  }

  const note = controls.latestNote()
  let noteText = 'Make a deposit and your demo note shows up here.'
  if (note) {
    const state = effectiveState(note, now)
    const waitLeft = note.unlocksAt - now
    noteText =
      state === 'waiting' || state === 'ready'
        ? `Your demo note: ${Math.min(note.crowd, note.need)} of ${note.need} later deposits, ${
            waitLeft > 0 ? `${formatDuration(waitLeft)} of waiting left` : 'wait is over'
          }.`
        : `Your demo note is ${STATE_LABEL[state].toLowerCase()}.`
  }

  const pickTheme = (choice: ThemeChoice) => {
    applyTheme(choice)
    setTheme(choice)
  }

  return (
    <aside className="demo-panel" aria-label="Demo controls">
      <div className="demo-head">
        <p className="demo-title">Demo controls</p>
        <button type="button" className="btn btn-icon" aria-label="Close demo controls" onClick={() => setOpen(false)}>
          <XIcon size={16} aria-hidden="true" />
        </button>
      </div>
      <p className="demo-note">Not part of the real app. It simulates other people and time passing.</p>
      <p className="demo-note" aria-live="polite">
        {noteText}
      </p>
      <div className="demo-actions">
        <button type="button" className="btn btn-sm" onClick={() => cfg.denominations.forEach((d) => controls.addCrowd(d, 1))}>
          Someone else deposits
        </button>
        <button type="button" className="btn btn-sm" onClick={() => controls.skipAhead(6 * 3600)}>
          Skip 6 hours
        </button>
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => cfg.denominations.forEach((d) => controls.addCrowd(d, cfg.minCrowd))}
        >
          Fill the crowd
        </button>
        <button type="button" className="btn btn-sm" onClick={() => controls.skipAhead(cfg.minWaitSecs)}>
          End the wait
        </button>
      </div>
      <div className="demo-section">
        <span className="demo-label">Theme</span>
        <div className="chip-row">
          {THEMES.map(([id, label]) => (
            <button
              key={id}
              type="button"
              className="btn btn-sm"
              aria-pressed={theme === id}
              onClick={() => pickTheme(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <button
        type="button"
        className="btn btn-quiet btn-sm btn-danger-quiet"
        style={{ justifySelf: 'start' }}
        onClick={() => window.confirm('Reset the demo? All demo notes and credit are cleared.') && controls.reset()}
      >
        Reset demo
      </button>
    </aside>
  )
}
