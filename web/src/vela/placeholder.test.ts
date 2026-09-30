import { describe, expect, it } from 'vitest'
import { USDC, type Money } from '../lib/money'
import { cleanSecret, fingerprint, makeSecret } from '../lib/secret'
import { createPlaceholderVela, DEMO_CONFIG } from './placeholder'
import { VelaError, type Vela, type VelaConfig } from './types'

const HUNDRED = 100n * USDC
const THOUSAND = 1000n * USDC
const DAY = 24 * 60 * 60

function setup(overrides: Partial<VelaConfig> = {}, storage: Storage | null = null) {
  let t = 1_000_000
  const made = createPlaceholderVela({ config: { ...DEMO_CONFIG, ...overrides }, clock: () => t, storage })
  return { ...made, advance: (secs: number) => (t += secs) }
}

async function lockNew(vela: Vela, wallet: string, denom: Money = HUNDRED): Promise<string> {
  const secret = makeSecret()
  await vela.deposit(wallet, denom)
  await vela.lock(wallet, denom, await fingerprint(secret))
  return secret
}

async function errorCode(p: Promise<unknown>): Promise<string> {
  try {
    await p
    return 'ok'
  } catch (e) {
    return e instanceof VelaError ? e.code : String(e)
  }
}

function memoryStorage(): Storage {
  const m = new Map<string, string>()
  return {
    get length() {
      return m.size
    },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, v),
  }
}

describe('secret', () => {
  it('is 256 random bits with the unlinkpay prefix', () => {
    const a = makeSecret()
    expect(cleanSecret(a)).toBe(a)
    expect(a).toMatch(/^unlinkpay:[0-9a-f]{64}$/)
    expect(makeSecret()).not.toBe(a)
  })

  it('fingerprints the same way as core.Fingerprint (SHA-256 hex)', async () => {
    expect(await fingerprint('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })
})

describe('placeholder vela follows the core rules', () => {
  it('needs 10 later deposits and 24 hours before a claim, then pays minus 0.30%', async () => {
    const { vela, demo, advance } = setup()
    const secret = await lockNew(vela, '0xAlice')
    demo.addCrowd(HUNDRED, 9)
    advance(DAY)
    expect(await errorCode(vela.claim(secret, '0xFresh'))).toBe('crowd-small')
    demo.addCrowd(HUNDRED, 1)
    const payout = await vela.claim(secret, '0xFresh')
    expect(payout).toEqual({ to: '0xFresh', amount: 99_700_000n })
    expect(await errorCode(vela.claim(secret, '0xFresh'))).toBe('spent')
  })

  it('blocks a claim during the waiting period', async () => {
    const { vela, demo, advance } = setup()
    const secret = await lockNew(vela, '0xAlice')
    demo.addCrowd(HUNDRED, 10)
    advance(DAY - 1)
    expect(await errorCode(vela.claim(secret, '0xFresh'))).toBe('too-soon')
    advance(1)
    expect(await errorCode(vela.claim(secret, '0xFresh'))).toBe('ok')
  })

  it('lets the depositor refund without the secret, and refunded notes leave the crowd', async () => {
    const { vela, demo, advance } = setup()
    const secret = await lockNew(vela, '0xAlice')
    await lockNew(vela, '0xBob')
    demo.addCrowd(HUNDRED, 9)
    advance(DAY)
    const [bobNote] = await vela.notesOf('0xbob')
    expect(await errorCode(vela.refund('0xMallory', bobNote.fingerprint))).toBe('not-owner')
    expect(await vela.refund('0xBob', bobNote.fingerprint)).toEqual({ to: '0xBob', amount: HUNDRED })
    expect(await vela.notesOf('0xBob')).toEqual([])
    expect(await errorCode(vela.claim(secret, '0xFresh'))).toBe('crowd-small')
  })

  it('does not mix crowds of different sizes', async () => {
    const { vela, demo, advance } = setup()
    const secret = await lockNew(vela, '0xAlice')
    demo.addCrowd(THOUSAND, 10)
    advance(DAY)
    expect(await errorCode(vela.claim(secret, '0xFresh'))).toBe('crowd-small')
  })

  it('enforces the 1,000 USDC pilot cap and returns leftover credit', async () => {
    const { vela } = setup()
    await lockNew(vela, '0xAlice', THOUSAND)
    await vela.deposit('0xAlice', 150n * USDC)
    expect(await errorCode(vela.lock('0xAlice', HUNDRED, await fingerprint(makeSecret())))).toBe('over-cap')
    expect(await vela.withdrawCredit('0xAlice')).toEqual({ to: '0xAlice', amount: 150n * USDC })
    expect(await errorCode(vela.withdrawCredit('0xAlice'))).toBe('no-balance')
  })

  it('only allows the fixed note sizes', async () => {
    const { vela } = setup()
    await vela.deposit('0xAlice', 50n * USDC)
    expect(await errorCode(vela.lock('0xAlice', 50n * USDC, await fingerprint(makeSecret())))).toBe('bad-denom')
  })

  it('keeps demo state across a reload, including large amounts', async () => {
    const storage = memoryStorage()
    const first = setup({}, storage)
    await lockNew(first.vela, '0xAlice', THOUSAND)
    const second = setup({}, storage)
    const stats = await second.vela.stats()
    expect(stats.volume).toBe(THOUSAND)
    expect(await second.vela.notesOf('0xalice')).toHaveLength(1)
  })
})
