import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider } from 'wagmi'
import '@fontsource-variable/geist/index.css'
import '@fontsource-variable/geist-mono/index.css'
import './styles.css'
import { wagmiConfig } from './wagmi'
import { vela } from './vela'
import { App } from './App'

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

// Every change inside Vela refreshes whatever the screens are showing.
vela.subscribe(() => {
  void queryClient.invalidateQueries({ queryKey: ['vela'] })
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </WagmiProvider>
  </StrictMode>,
)
