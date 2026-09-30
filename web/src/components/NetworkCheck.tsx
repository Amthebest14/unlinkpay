import { useConnection, useSwitchChain } from 'wagmi'
import { baseSepolia } from 'viem/chains'
import { WarningIcon } from '@phosphor-icons/react'

export const TARGET_CHAIN = baseSepolia

export function useWrongNetwork(): boolean {
  const { isConnected, chainId } = useConnection()
  return isConnected && chainId !== TARGET_CHAIN.id
}

// Shown wherever a connected wallet will sign something (Deposit, Refund).
export function NetworkCheck() {
  const wrong = useWrongNetwork()
  const switchChain = useSwitchChain()
  if (!wrong) return null
  return (
    <div className="callout callout-warn" role="alert">
      <WarningIcon size={18} aria-hidden="true" />
      <div>
        <p>Your wallet is on a different network. UnlinkPay runs on {TARGET_CHAIN.name}.</p>
        <button
          type="button"
          className="btn btn-sm"
          disabled={switchChain.isPending}
          onClick={() => switchChain.mutate({ chainId: TARGET_CHAIN.id })}
        >
          {switchChain.isPending ? 'Switching…' : `Switch to ${TARGET_CHAIN.name}`}
        </button>
        {switchChain.error && (
          <p className="field-error">Your wallet didn't switch. Change the network to {TARGET_CHAIN.name} in your wallet.</p>
        )}
      </div>
    </div>
  )
}
