// wagmi saves the last connected wallet (its address included) in localStorage under "wagmi.*",
// and keeps "wagmi.recentConnectorId" even after a disconnect. A claim made in the same browser
// could be tied back to that wallet, so the Claim page warns about it and offers to clear it.
const PREFIX = 'wagmi.'

export function browserRemembersWallet(): boolean {
  try {
    if (localStorage.getItem(`${PREFIX}recentConnectorId`)) return true
    return (localStorage.getItem(`${PREFIX}store`) ?? '').includes('"accounts":["0x')
  } catch {
    return false
  }
}

export function forgetWallets(): void {
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(PREFIX)) localStorage.removeItem(key)
    }
  } catch {
    // Storage blocked: nothing was saved to begin with.
  }
}
