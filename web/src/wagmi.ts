import { createConfig, http } from 'wagmi'
import { injected, mock } from 'wagmi/connectors'
import { baseSepolia } from 'viem/chains'

// A fake address for trying the demo without a wallet extension.
export const DEMO_WALLET = `0x5eed${'0'.repeat(32)}d3a0` as const

export const wagmiConfig = createConfig({
  chains: [baseSepolia],
  connectors: [injected(), mock({ accounts: [DEMO_WALLET] })],
  transports: { [baseSepolia.id]: http() },
})

declare module 'wagmi' {
  interface Register {
    config: typeof wagmiConfig
  }
}
