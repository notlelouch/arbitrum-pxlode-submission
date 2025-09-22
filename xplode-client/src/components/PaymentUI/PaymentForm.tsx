import React, { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { debounce } from 'lodash';

interface PaymentFormProps {
  ethAmount: string; // Changed from solanaAmount to ethAmount
  onAmountChange: (value: string) => void;
  onSubmit: () => void;
  processingPayment: boolean;
  isWalletConnected?: boolean;
}

export const PaymentForm: React.FC<PaymentFormProps> = ({
  ethAmount, // Changed from solanaAmount
  onAmountChange,
  onSubmit,
  processingPayment,
  isWalletConnected,
}) => {
  // Local state for immediate updates
  const [localAmount, setLocalAmount] = useState(ethAmount || "");

  // Update local state when prop changes
  useEffect(() => {
    if (ethAmount !== undefined) {
      setLocalAmount(ethAmount);
    }
  }, [ethAmount]);

  // Debounce the parent state update
  const debouncedAmountChange = useCallback(
    debounce((value: string) => {
      if (typeof onAmountChange === 'function') {
        onAmountChange(value);
      }
    }, 300),
    [] // Remove onAmountChange from dependencies to avoid exhaustive-deps warning
  );

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setLocalAmount(value); // Update local state immediately
    debouncedAmountChange(value); // Debounce the parent update
  };

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="ethAmount" className="block text-emerald-400 text-sm font-medium mb-2">
          Amount (ETH)
        </label>
        <div className="relative">
          <input
            type="number"
            id="ethAmount"
            value={localAmount}
            onChange={handleInputChange}
            placeholder="0.00"
            min="0"
            step="0.001" // Changed step for ETH (smaller denominations)
            disabled={processingPayment}
            className="w-full py-3 px-4 rounded-lg font-medium
                     bg-black/40 border border-emerald-500/20
                     text-emerald-400 placeholder-zinc-500
                     focus:outline-none focus:border-emerald-500
                     focus:ring-2 focus:ring-emerald-500/20
                     transition-all duration-200 backdrop-blur-sm
                     appearance-none"
          />
        </div>
      </div>

      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={onSubmit}
        disabled={processingPayment || !isWalletConnected}
        className={`w-full py-3 rounded-lg font-medium transition-all duration-200
                  ${processingPayment
                    ? 'bg-zinc-800/50 text-zinc-500 cursor-not-allowed'
                    : !isWalletConnected
                      ? 'bg-zinc-800/50 text-zinc-500 cursor-not-allowed'
                      : 'bg-gradient-to-r from-emerald-500/20 to-emerald-500/10 text-emerald-400 ' +
                        'hover:from-emerald-500/30 hover:to-emerald-500/20 border border-emerald-500/30'}`}
      >
        {processingPayment 
          ? 'Processing...' 
          : !isWalletConnected 
            ? 'Connect Wallet First' 
            : 'Add Funds'}
      </motion.button>
    </div>
  );
};