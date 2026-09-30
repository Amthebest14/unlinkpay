const PREFIX = 'unlinkpay:'
const SECRET_PATTERN = /^unlinkpay:[0-9a-f]{64}$/

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

export function randomHex(byteCount: number): string {
  const bytes = new Uint8Array(byteCount)
  crypto.getRandomValues(bytes)
  return toHex(bytes)
}

// 32 random bytes = 256 bits. Users never choose their own secret.
export function makeSecret(): string {
  return PREFIX + randomHex(32)
}

export function cleanSecret(input: string): string | null {
  const s = input.trim().toLowerCase()
  return SECRET_PATTERN.test(s) ? s : null
}

// Must match core.Fingerprint in Go: SHA-256 of the secret's text, as hex.
export async function fingerprint(secret: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret))
  return toHex(new Uint8Array(digest))
}

// Deliberately leaves out the depositing wallet: the file must not link the two.
export function secretFileText(secret: string, amountLabel: string): string {
  return [
    'UnlinkPay secret',
    '',
    'Keep this private. Anyone with this secret can claim the money.',
    '',
    `Amount: ${amountLabel} USDC (the claim pays this minus a 0.30% fee)`,
    `Secret: ${secret}`,
    '',
    'To claim: open UnlinkPay, go to Claim, and paste this secret with a brand-new wallet address.',
    'If you lose it, only the wallet you deposited from can take the money back (Refund).',
    '',
  ].join('\n')
}
