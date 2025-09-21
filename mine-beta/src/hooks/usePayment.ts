import { useState } from "react";
import { useArbitrumPayment } from "./useArbitrumPayment";
import { useWithdraw } from "./useWithdraw";
import { useWalletStore } from "../stores/walletStore";

interface UsePaymentProps {
  userId?: number;
  tx_type?: string;
  gif_id?: number;
}

export const usePayment = ({ userId }: UsePaymentProps) => {
  const [ethAmount, setEthAmount] = useState("");
  const setBalance = useWalletStore((state) => state.setBalance);

  const {
    paymentStatus,
    processingPayment,
    initiatePayment,
    cancelPayment,
    isWalletConnected,
  } = useArbitrumPayment({
    userId,
    onPaymentComplete: (balance) => {
      setBalance(balance); // Update global store
      setEthAmount("");
    },
    onPaymentFailed: (error) => {
      console.error("Payment failed:", error);
    },
  });

  const { withdrawStatus, processingWithdraw, initiateWithdraw } = useWithdraw({
    userId,
    onWithdrawComplete: (balance) => {
      setBalance(balance); // Update global store
    },
    onWithdrawFailed: (error) => {
      console.error("Withdrawal failed:", error);
    },
  });

  const handlePayment = async () => {
    if (!ethAmount || Number(ethAmount) <= 0) {
      alert("Please enter a valid amount");
      return;
    }

    if (!isWalletConnected) {
      alert("Please connect your wallet first");
      return;
    }

    try {
      await initiatePayment(ethAmount);
    } catch (error) {
      console.error("Error initiating payment:", error);
    }
  };

  const handleWithdraw = async (amount: string, withdrawAddress: string) => {
    try {
      await initiateWithdraw(amount, withdrawAddress);
    } catch (error) {
      console.error("Error initiating withdrawal:", error);
    }
  };

  const handleCancelPayment = () => {
    cancelPayment();
  };

  return {
    ethAmount, // Changed from solanaAmount to ethAmount
    setEthAmount, // Changed from setSolanaAmount to setEthAmount
    handleCancelPayment,
    handlePayment,
    handleWithdraw,
    paymentStatus,
    withdrawStatus,
    processingPayment,
    processingWithdraw,
    isWalletConnected,
  };
};