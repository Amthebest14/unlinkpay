// Money is counted in USDC's smallest unit (6 decimals), same as core/core.go.
export type Money = bigint

export const USDC: Money = 1_000_000n

export function formatUsdc(amount: Money): string {
  const whole = (amount / USDC).toLocaleString('en-US')
  const cents = (amount % USDC) / 10_000n
  return cents === 0n ? whole : `${whole}.${cents.toString().padStart(2, '0')}`
}
