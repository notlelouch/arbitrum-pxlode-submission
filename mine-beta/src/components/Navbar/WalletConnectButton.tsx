import { usePrivy } from '@privy-io/react-auth';
import { Wallet } from 'lucide-react';
import { useEffect } from 'react';

export const WalletConnectButton = () => {
  const { login, ready, authenticated, user } = usePrivy();

  // Log Privy state for debugging
  useEffect(() => {
    if (ready) {
      // console.log("Privy state:", { authenticated, userId: user?.id });
    }
  }, [ready, authenticated, user]);

  // Handle connecting an Ethereum wallet
  const handleConnectEthereum = async () => {
    try {
      // First make sure user is logged in with Privy
      if (!authenticated) {
        console.log("User not authenticated, logging in first");
        await login();
      }
      
      // Request account access from MetaMask
      if (window.ethereum) {
        await window.ethereum.request({ method: 'eth_requestAccounts' });
        console.log("Requested Ethereum wallet connection");
      } else {
        console.log("Please install MetaMask");
      }
    } catch (error) {
      console.error("Error connecting Ethereum wallet:", error);
    }
  };

  return (
    <button
      onClick={handleConnectEthereum}
      className="px-4 py-2 rounded-xl font-medium
                bg-gradient-to-r from-emerald-500/20 to-emerald-500/10
                text-emerald-400 border border-emerald-500/20
                hover:border-emerald-500/40 hover:from-emerald-500/30 
                transition-all duration-200 flex items-center gap-2"
    >
      <Wallet size={16} className="text-emerald-400" />
      <span>Connect Ethereum Wallet</span>
    </button>
  );
};