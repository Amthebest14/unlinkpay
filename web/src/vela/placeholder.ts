// A stand-in for Vela that runs in the browser. It follows the same rules as
// core/core.go, so the website behaves like the real thing. No real money moves.
import { USDC, type Money } from '../lib/money'
import { fingerprint, randomHex } from '../lib/secret'
import {
  VelaError,
  feeFor,
  type NoteInfo,
  type NoteState,
  type NoteStatus,
  type SizeStats,
  type Vela,
  type VelaConfig,
} from './types'

interface Note {
  denom: Money
  seq: number
  depositor: string
  lockedAt: number
  claimed: boolean
  refunded: boolean
}

interface State {
  balances: Record<string, Money>
  notes: Record<string, Note>
  nextSeq: Record<string, number>
  fees: Money
  locked: Record<string, Money>
  invited: Record<string, boolean>
  flagged: Record<string, boolean>
  clockOffset: number
}

export interface DemoControls {
  addCrowd(denom: Money, count: number): void
  skipAhead(secs: number): void
  reset(): void
  clockOffset(): number
}

export const DEMO_CONFIG: VelaConfig = {
  denominations: [100n * USDC, 1000n * USDC],
  minCrowd: 10,
  feeBps: 30n,
  minWaitSecs: 24 * 60 * 60,
  inviteOnly: false,
  maxLockPerWallet: 1000n * USDC,
}

const STORAGE_KEY = 'unlinkpay-demo-state-v1'

function emptyState(): State {
  return { balances: {}, notes: {}, nextSeq: {}, fees: 0n, locked: {}, invited: {}, flagged: {}, clockOffset: 0 }
}

function encode(state: State): string {
  return JSON.stringify(state, (_key, value) =>
    typeof value === 'bigint' ? { $big: value.toString() } : value,
  )
}

function decode(text: string): State {
  return JSON.parse(text, (_key, value) =>
    value && typeof value === 'object' && typeof value.$big === 'string' ? BigInt(value.$big) : value,
  )
}

export function browserStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

export interface PlaceholderOptions {
  config: VelaConfig
  storage?: Storage | null
  clock?: () => number
  latencyMs?: number
}

export function createPlaceholderVela(opts: PlaceholderOptions): { vela: Vela; demo: DemoControls } {
  const { config, storage = null, latencyMs = 0 } = opts
  const clock = opts.clock ?? (() => Math.floor(Date.now() / 1000))
  const listeners = new Set<() => void>()
  let state = load()

  function load(): State {
    if (!storage) return emptyState()
    try {
      const text = storage.getItem(STORAGE_KEY)
      return text ? decode(text) : emptyState()
    } catch {
      return emptyState()
    }
  }

  function commit() {
    if (storage) {
      try {
        storage.setItem(STORAGE_KEY, encode(state))
      } catch {
        // Storage blocked: the demo keeps working in memory for this visit.
      }
    }
    listeners.forEach((listener) => listener())
  }

  const pause = (ms: number) => (ms > 0 ? new Promise<void>((r) => setTimeout(r, ms)) : Promise.resolve())
  const slow = () => pause(latencyMs)
  const quick = () => pause(latencyMs / 3)
  const key = (wallet: string) => wallet.toLowerCase()
  const now = () => clock() + state.clockOffset
  const allowed = (denom: Money) => config.denominations.includes(denom)

  function crowdAfter(note: Note): number {
    let count = 0
    for (const other of Object.values(state.notes)) {
      if (other.denom === note.denom && other.seq > note.seq && !other.refunded) count++
    }
    return count
  }

  function lockNow(wallet: string, denom: Money, fp: string) {
    const w = key(wallet)
    const lockedSoFar = state.locked[w] ?? 0n
    const balance = state.balances[w] ?? 0n
    if (!allowed(denom)) throw new VelaError('bad-denom', 'That amount is not an allowed note size.')
    if (state.flagged[w]) throw new VelaError('flagged', 'This wallet was flagged. It can only take its own money back.')
    if (config.inviteOnly && !state.invited[w]) throw new VelaError('not-invited', 'This wallet is not on the invite list yet.')
    if (config.maxLockPerWallet > 0n && lockedSoFar + denom > config.maxLockPerWallet) {
      throw new VelaError('over-cap', 'This wallet has reached its limit for the invite-only pilot.')
    }
    if (balance < denom) throw new VelaError('no-balance', 'Not enough deposited credit to lock that amount.')
    if (state.notes[fp]) throw new VelaError('duplicate', 'That secret is already in use. Create a new one.')
    const sizeKey = denom.toString()
    state.balances[w] = balance - denom
    state.locked[w] = lockedSoFar + denom
    state.nextSeq[sizeKey] = (state.nextSeq[sizeKey] ?? 0) + 1
    state.notes[fp] = { denom, seq: state.nextSeq[sizeKey], depositor: w, lockedAt: now(), claimed: false, refunded: false }
  }

  function statusOfNote(note: Note): NoteStatus {
    const crowd = crowdAfter(note)
    const unlocksAt = note.lockedAt + config.minWaitSecs
    let st: NoteState = 'waiting'
    if (note.claimed) st = 'claimed'
    else if (note.refunded) st = 'refunded'
    else if (state.flagged[note.depositor]) st = 'refund-only'
    else if (crowd >= config.minCrowd && now() >= unlocksAt) st = 'ready'
    return { denom: note.denom, state: st, crowd, need: config.minCrowd, unlocksAt }
  }

  const vela: Vela = {
    config,
    now,

    async deposit(wallet, amount) {
      await slow()
      const w = key(wallet)
      state.balances[w] = (state.balances[w] ?? 0n) + amount
      commit()
    },

    async lock(wallet, denom, fp) {
      await slow()
      lockNow(wallet, denom, fp)
      commit()
    },

    async claim(secret, to) {
      await slow()
      const note = state.notes[await fingerprint(secret)]
      if (!note) throw new VelaError('unknown-note', 'No note matches that secret.')
      if (note.claimed || note.refunded) throw new VelaError('spent', 'This note was already claimed or refunded.')
      if (state.flagged[note.depositor]) throw new VelaError('flagged', 'This note can only be refunded to the wallet it came from.')
      if (now() < note.lockedAt + config.minWaitSecs) throw new VelaError('too-soon', 'This note is still in its waiting period.')
      const have = crowdAfter(note)
      if (have < config.minCrowd) {
        throw new VelaError('crowd-small', `The crowd is not big enough yet: ${have} of ${config.minCrowd} later deposits.`)
      }
      const fee = feeFor(config, note.denom)
      note.claimed = true
      state.fees += fee
      commit()
      return { to, amount: note.denom - fee }
    },

    async refund(wallet, fp) {
      await slow()
      const note = state.notes[fp]
      if (!note) throw new VelaError('unknown-note', 'No note matches that fingerprint.')
      if (note.claimed || note.refunded) throw new VelaError('spent', 'This note was already claimed or refunded.')
      if (note.depositor !== key(wallet)) throw new VelaError('not-owner', 'Only the wallet that deposited can refund this note.')
      note.refunded = true
      commit()
      return { to: wallet, amount: note.denom }
    },

    async withdrawCredit(wallet) {
      await slow()
      const w = key(wallet)
      const amount = state.balances[w] ?? 0n
      if (amount === 0n) throw new VelaError('no-balance', 'There is no unlocked credit to withdraw.')
      delete state.balances[w]
      commit()
      return { to: wallet, amount }
    },

    async creditOf(wallet) {
      await quick()
      return state.balances[key(wallet)] ?? 0n
    },

    async lockedTotalOf(wallet) {
      await quick()
      return state.locked[key(wallet)] ?? 0n
    },

    async notesOf(wallet) {
      await quick()
      const w = key(wallet)
      const out: NoteInfo[] = []
      for (const [fp, note] of Object.entries(state.notes)) {
        if (note.depositor === w && !note.claimed && !note.refunded) {
          out.push({ fingerprint: fp, denom: note.denom, seq: note.seq })
        }
      }
      return out.sort((a, b) => (a.denom === b.denom ? a.seq - b.seq : a.denom < b.denom ? -1 : 1))
    },

    async statusOf(fp) {
      await quick()
      const note = state.notes[fp]
      if (!note) throw new VelaError('unknown-note', 'No note matches that secret.')
      return statusOfNote(note)
    },

    async stats() {
      await quick()
      const sizes: SizeStats[] = config.denominations.map((denom) => ({ denom, locked: 0, claimed: 0, refunded: 0, waiting: 0 }))
      let volume = 0n
      for (const note of Object.values(state.notes)) {
        const s = sizes.find((x) => x.denom === note.denom)
        if (!s) continue
        s.locked++
        volume += note.denom
        if (note.claimed) s.claimed++
        else if (note.refunded) s.refunded++
        else s.waiting++
      }
      return { sizes, volume, fees: state.fees }
    },

    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }

  const demo: DemoControls = {
    addCrowd(denom, count) {
      for (let i = 0; i < count; i++) {
        const w = `demo-crowd-${randomHex(8)}`
        state.balances[w] = denom
        if (config.inviteOnly) state.invited[w] = true
        lockNow(w, denom, randomHex(32))
      }
      commit()
    },
    skipAhead(secs) {
      state.clockOffset += secs
      commit()
    },
    reset() {
      state = emptyState()
      commit()
    },
    clockOffset: () => state.clockOffset,
  }

  return { vela, demo }
}
