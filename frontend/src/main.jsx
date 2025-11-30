import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { BrowserRouter } from 'react-router-dom'
import { FheProvider } from './context/FheContext';

import '@rainbow-me/rainbowkit/styles.css'
import { getDefaultWallets, RainbowKitProvider } from '@rainbow-me/rainbowkit'
import { createConfig, WagmiConfig, http } from 'wagmi'
import { sepolia } from 'wagmi/chains'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const queryClient = new QueryClient()

const { connectors } = getDefaultWallets({
  appName: 'My Sepolia DApp',
  projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID,
  chains: [sepolia],
})

const wagmiConfig = createConfig({
  chains: [sepolia],
  connectors,
  transports: {
    [sepolia.id]: http(import.meta.env.VITE_SEPOLIA_RPC || 'https://rpc.sepolia.org'),
  },
  autoConnect: true,
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <FheProvider>
      <BrowserRouter>
        <QueryClientProvider client={queryClient}>
          <WagmiConfig config={wagmiConfig}>
            <RainbowKitProvider chains={[sepolia]}>
              <App />
            </RainbowKitProvider>
          </WagmiConfig>
        </QueryClientProvider>
      </BrowserRouter>
    </FheProvider>
  </React.StrictMode>
)
