import React from 'react'
import ReactDOM from 'react-dom/client'
import MainApp from './MainApp'
import { PrivyProvider } from '@privy-io/react-auth'
// import {toSolanaWalletConnectors} from '@privy-io/react-auth/solana';
import { arbitrumSepolia } from 'viem/chains';
// const solanaConnectors = toSolanaWalletConnectors();

const PRIVVY_APP_ID = import.meta.env.VITE_PRIVVY_APP_ID

if (!PRIVVY_APP_ID) {
  throw new Error('Missing Privvy App ID')
}


ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* <PrivyProvider appId={PRIVVY_APP_ID}> */}
    <PrivyProvider
      appId={PRIVVY_APP_ID}
      config={{
        supportedChains: [arbitrumSepolia],
        appearance: {
            theme: 'dark',
            showWalletLoginFirst: true,
          // logo: 'https://ibb.co/1YDLXsFX', 
          // landingHeader: 'Xplode', 
          // loginMessage: 'Welcome Gaurdian!', 
            walletChainType: 'ethereum-only'
        },
        // externalWallets: {
        //   solana: {connectors: solanaConnectors}
        // },
        // embeddedWallets: { 
        //   ethereum: { 
        //     createOnLogin: 'users-without-wallets', // defaults to 'off'
        //   }, 
        //   solana: { 
        //     createOnLogin: 'users-without-wallets', // defaults to 'off'
        //   }, 
        // }, 
      }}
    >
      <MainApp />
    </PrivyProvider>
  </React.StrictMode>
)
