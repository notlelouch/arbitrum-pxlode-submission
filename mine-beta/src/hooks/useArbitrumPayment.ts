import { useState } from "react";

interface UseArbitrumPaymentProps {
  userId?: number;
  onPaymentComplete: (balance: number) => void;
  onPaymentFailed: (error: string) => void;
}

export const useArbitrumPayment = ({
  userId,
  onPaymentComplete,
  onPaymentFailed,
}: UseArbitrumPaymentProps) => {
  const [paymentStatus, setPaymentStatus] = useState<string>("");
  const [processingPayment, setProcessingPayment] = useState(false);

  // Arbitrum connection setup - equivalent to your Solana connection
  const rpcUrl = import.meta.env.VITE_ARBITRUM_RPC_URL || "https://sepolia-rollup.arbitrum.io/rpc";
  
  // This is the game's merchant wallet address where funds will be sent
  const MERCHANT_WALLET_ADDRESS = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

  // Check if MetaMask is connected
  const checkWalletConnection = async () => {
    if (!window.ethereum) return null;
    try {
      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      return accounts.length > 0 ? accounts[0] : null;
    } catch {
      return null;
    }
  };

  const initiatePayment = async (amount: string) => {
    if (!amount || Number(amount) <= 0) {
      throw new Error("Please enter a valid amount");
    }

    if (!window.ethereum) {
      throw new Error("Please install MetaMask");
    }

    if (!userId) {
      throw new Error("No user ID available");
    }

    try {
      setProcessingPayment(true);
      setPaymentStatus("processing");

      // Request account access first
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      const walletAddress = accounts[0];
      
      console.log("Using wallet address:", walletAddress);

      // Convert ETH amount to wei - fix potential precision issues
      const amountInEth = parseFloat(amount);
      const amountInWei = Math.floor(amountInEth * 1e18).toString(16);

      console.log("Amount in ETH:", amountInEth);
      console.log("Amount in Wei (hex):", '0x' + amountInWei);

      // Simplified transaction parameters
      const txParams = {
        from: walletAddress,
        to: MERCHANT_WALLET_ADDRESS,
        value: '0x' + amountInWei,
      };

      console.log("Transaction params:", txParams);

      // Send transaction
      const txHash = await window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [txParams],
      });

      console.log("Transaction sent with hash:", txHash);
      setPaymentStatus("confirming");

      // Wait for confirmation using RPC connection
      try {
        const receipt = await waitForTransactionReceipt(txHash, rpcUrl);
        console.log("Transaction confirmed:", receipt);
      } catch (confErr) {
        console.warn(
          "Confirmation error (but transaction may still succeed):",
          confErr
        );
      }

      // Notify the backend about the deposit
      await verifyTransaction(txHash, amount);

      return txHash;
    } catch (error) {
      console.error("Payment error:", error);
      setPaymentStatus("failed");
      onPaymentFailed(
        error instanceof Error ? error.message : "Failed to process payment"
      );
      throw error;
    } finally {
      setProcessingPayment(false);
    }
  };

  // Add Arbitrum Sepolia network to MetaMask and switch to it
  const switchToArbitrumSepolia = async () => {
    const arbitrumSepoliaChainId = '0x66eee'; // 421614 in hex
    
    try {
      // First check current network to avoid unnecessary switch
      const currentChainId = await window.ethereum.request({ method: 'eth_chainId' });
      
      if (currentChainId === arbitrumSepoliaChainId) {
        console.log('Already on Arbitrum Sepolia');
        return; // Already on correct network
      }

      // Try to switch to Arbitrum Sepolia
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: arbitrumSepoliaChainId }],
      });
    } catch (switchError: any) {
      // This error code indicates that the chain has not been added to MetaMask
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: arbitrumSepoliaChainId,
                chainName: 'Arbitrum Sepolia',
                nativeCurrency: {
                  name: 'Ethereum',
                  symbol: 'ETH',
                  decimals: 18,
                },
                rpcUrls: [rpcUrl],
                blockExplorerUrls: ['https://sepolia.arbiscan.io/'],
              },
            ],
          });
        } catch (addError) {
          throw new Error('Failed to add Arbitrum Sepolia network to MetaMask');
        }
      } else {
        throw new Error('Failed to switch to Arbitrum Sepolia network');
      }
    }
  };

  // Helper function to wait for transaction receipt - equivalent to Solana's confirmTransaction
  const waitForTransactionReceipt = async (txHash: string, rpcUrl: string) => {
    const maxAttempts = 30; // 30 attempts
    const delayMs = 2000; // 2 seconds between attempts
    
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const response = await fetch(rpcUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'eth_getTransactionReceipt',
            params: [txHash],
            id: 1,
          }),
        });

        const result = await response.json();
        
        if (result.result && result.result.status === '0x1') {
          return result.result; // Transaction confirmed successfully
        } else if (result.result && result.result.status === '0x0') {
          throw new Error('Transaction failed');
        }
        
        // If no receipt yet, wait and retry
        await new Promise(resolve => setTimeout(resolve, delayMs));
      } catch (error) {
        if (i === maxAttempts - 1) throw error;
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
    
    throw new Error('Transaction confirmation timeout');
  };

  const verifyTransaction = async (txHash: string, amount: string) => {
    try {
      if (!userId) {
        throw new Error("No user ID available");
      }

      const depositData = {
        user_id: userId,
        amount: Number(amount),
        currency: "SOL", // Keep as SOL for now to not break backend
        tx_hash: txHash,
        tx_type: "DEPOSIT"
      };

      const response = await fetch(
        import.meta.env.VITE_PAYMENT_DEPOSIT_ENDPOINT_URL,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(depositData),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Deposit failed: ${errorText}`);
      }

      const result = await response.json();

      if (typeof result.balance === "number") {
        onPaymentComplete(result.balance);
        setPaymentStatus("completed");
      } else {
        throw new Error("Invalid balance received from server");
      }
    } catch (err) {
      setPaymentStatus("failed");
      onPaymentFailed(
        err instanceof Error ? err.message : "Failed to process deposit"
      );
    }
  };

  const cancelPayment = () => {
    setPaymentStatus("cancelled");
    setProcessingPayment(false);
    onPaymentFailed("Payment cancelled by user");
  };

  const isWalletConnected = async () => {
    const address = await checkWalletConnection();
    return !!address;
  };

  return {
    paymentStatus,
    processingPayment,
    initiatePayment,
    cancelPayment,
    isWalletConnected: isWalletConnected().catch(() => false),
  };
};

declare global {
  interface Window {
    ethereum?: any;
  }
}