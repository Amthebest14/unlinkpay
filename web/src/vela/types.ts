import type { Money } from '../lib/money'

export interface VelaConfig {
  denominations: Money[]
  minCrowd: number
  feeBps: bigint
  minWaitSecs: number
  inviteOnly: boolean
  maxLockPerWallet: Money // 0n = no cap
}

export interface NoteInfo {
  fingerprint: string
  denom: Money
  seq: number
}

export type NoteState = 'waiting' | 'ready' | 'claimed' | 'refunded' | 'refund-only'

export interface NoteStatus {
  denom: Money
  state: NoteState
  crowd: number // later same-size notes still in the pool
  need: number // K
  unlocksAt: number // unix seconds when the minimum wait ends
}

export interface Payout {
  to: string
  amount: Money
}

export interface SizeStats {
  denom: Money
  locked: number
  claimed: number
  refunded: number
  waiting: number
}

export interface Stats {
  sizes: SizeStats[]
  volume: Money
  fees: Money
}

export type VelaErrorCode =
  | 'bad-denom'
  | 'no-balance'
  | 'duplicate'
  | 'unknown-note'
  | 'spent'
  | 'crowd-small'
  | 'not-owner'
  | 'too-soon'
  | 'flagged'
  | 'not-invited'
  | 'over-cap'

export class VelaError extends Error {
  readonly code: VelaErrorCode
  constructor(code: VelaErrorCode, message: string) {
    super(message)
    this.code = code
  }
}

// Everything the website needs from Vela. The placeholder implements it today;
// the real client (encrypted requests, relayer for claims) replaces it later.
export interface Vela {
  readonly config: VelaConfig
  now(): number
  deposit(wallet: string, amount: Money): Promise<void>
  lock(wallet: string, denom: Money, fingerprint: string): Promise<void>
  claim(secret: string, to: string): Promise<Payout>
  refund(wallet: string, fingerprint: string): Promise<Payout>
  withdrawCredit(wallet: string): Promise<Payout>
  creditOf(wallet: string): Promise<Money>
  lockedTotalOf(wallet: string): Promise<Money>
  notesOf(wallet: string): Promise<NoteInfo[]>
  statusOf(fingerprint: string): Promise<NoteStatus>
  stats(): Promise<Stats>
  subscribe(listener: () => void): () => void
}

export function feeFor(config: VelaConfig, denom: Money): Money {
  return (denom * config.feeBps) / 10_000n
}

export function errorText(e: unknown): string {
  return e instanceof VelaError ? e.message : 'Something went wrong. Try again.'
}
