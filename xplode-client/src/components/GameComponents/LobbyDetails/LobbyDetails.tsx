import React, { useState, useRef } from 'react';
import { Coins, Grid, Bomb, Users, UserPlus } from 'lucide-react';
import { useWalletStore } from '../../../stores/walletStore';
import MaintenanceModal from '../MaintenanceModal/MaintenanceModal';

interface LobbyDetailsProps {
  betAmount: number;
  setBetAmount: (amount: number) => void;
  playGame: (gridSize: number, bombs: number, minPlayers: number) => void;
  createGameRoom: (gridSize: number, bombs: number, minPlayers: number) => void;
  isConnected: boolean;
}

const LobbyDetails: React.FC<LobbyDetailsProps> = ({
  betAmount,
  setBetAmount,
  playGame,
  createGameRoom,
  isConnected,
}) => {
  const walletBalance = useWalletStore(state => state.balance);
  const [gridSize, setGridSize] = useState<number>(5);
  const [bombs, setBombs] = useState<number>(3);
  const [minPlayers, setMinPlayers] = useState<number>(2);
  const [activeTab, setActiveTab] = useState<'random' | 'create'>('random');
  const [modalOpen, setModalOpen] = useState<boolean>(false);

  const findClosestQuickBet = (bet: number) => {
    let closestQuickBet = 0;
    for (let i = quickBets.length - 1; i >= 0; i--) {
      if (quickBets[i] <= bet) {
        closestQuickBet = quickBets[i];
        break;  
      }
    }
    return closestQuickBet;
  };

  const handleBetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const numValue = value === "" ? 0 : Number(value);

    const closestQuickBet = findClosestQuickBet(Math.min(numValue, walletBalance));
    setBetAmount(closestQuickBet);
  };

  const quickBets = [0.001, 0.5, 1, 2, 5, 10];
  const gridSizes = [3, 4, 5, 6, 7, 8];

  const clickSound = useRef(new Audio('/assets/sounds/click.wav'));
  const startGameSound = useRef(new Audio('/assets/sounds/start_game.wav'));

  const playClickSound = () => {
    clickSound.current.play();
  };

  return (
    <div className="relative w-full max-w-3xl mx-auto space-y-8">
      {/* Status Bar */}
      <div className="flex justify-between items-center px-4 py-2 bg-black/40 rounded-lg border border-emerald-500/20 shadow-lg shadow-emerald-500/5">
        <div className="flex items-center gap-2">
          <Coins className="w-4 h-4 text-emerald-400" />
          <span className="text-zinc-300">Balance:</span>
          <span className="text-emerald-400 font-mono">{walletBalance.toFixed(3)} ETH</span>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
          <span className="text-zinc-300">{isConnected ? 'Connected' : 'Connecting...'}</span>
        </div>
      </div>

      {/* Main Panel */}
      <div className="bg-black/60 backdrop-blur-sm border border-emerald-500/10 rounded-lg overflow-hidden shadow-xl shadow-emerald-500/5">
        {/* Tab Selection */}
        <div className="flex border-b border-emerald-500/10">
          <button
            onClick={() => {
              playClickSound();
              setActiveTab('random');
            }}
            className={`flex-1 py-3 px-4 flex items-center justify-center gap-2 transition-all ${
              activeTab === 'random' 
                ? 'bg-emerald-500/20 text-emerald-400' 
                : 'text-emerald-400/70 hover:bg-emerald-500/10'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Join Random</span>
          </button>
          <button
            onClick={() => {
              playClickSound();
              setActiveTab('create');
            }}
            className={`flex-1 py-3 px-4 flex items-center justify-center gap-2 transition-all ${
              activeTab === 'create' 
                ? 'bg-emerald-500/20 text-emerald-400' 
                : 'text-emerald-400/70 hover:bg-emerald-500/10'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            <span>Create Game Room</span>
          </button>
        </div>

        {/* Bet Amount Section */}
        <div className="p-6 border-b border-emerald-500/10">
          <h3 className="text-emerald-400/80 text-sm font-medium mb-4 tracking-wider">PLACE YOUR BET</h3>
          <div className="space-y-4">
            <input
              type="number"
              value={betAmount || ''}
              onChange={handleBetChange}
              placeholder="Enter bet amount"
              className="w-full bg-black/40 px-4 py-3 rounded-lg font-mono text-emerald-400 border border-emerald-500/20 focus:outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/10 transition-all"
            />
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {quickBets.map(bet => (
                <button
                  key={bet}
                  onClick={() => {
                    playClickSound();
                    handleBetChange({ target: { value: bet.toString() } } as unknown as React.ChangeEvent<HTMLInputElement>);
                  }}
                  className="py-2 font-mono text-sm bg-black/40 text-emerald-400/80 border border-emerald-500/20 rounded-lg hover:bg-emerald-500/10 hover:border-emerald-500/40 transition-all duration-300"
                >
                  {bet}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Game Settings */}
        <div className="p-6 space-y-6">
          {/* Grid Size */}
          <div>
            <div className="flex items-center gap-2 text-emerald-400/80 text-sm mb-3">
              <Grid className="w-4 h-4" />
              <h3 className="font-medium tracking-wider">GRID SIZE</h3>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {gridSizes.map(size => (
                <button
                  key={size}
                  onClick={() => {
                    playClickSound();
                    setGridSize(size);
                  }}
                  className={`p-3 rounded-lg font-mono text-sm border transition-all duration-300 ${
                    gridSize === size
                      ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400 shadow-lg shadow-emerald-500/10'
                      : 'bg-black/40 border-emerald-500/20 text-emerald-400/70 hover:bg-emerald-500/10'
                  }`}
                >
                  {size}×{size}
                </button>
              ))}
            </div>
          </div>

          {/* Mines */}
          <div>
            <div className="flex items-center gap-2 text-emerald-400/80 text-sm mb-3">
              <Bomb className="w-4 h-4" />
              <h3 className="font-medium tracking-wider">NUMBER OF MINES</h3>
            </div>
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
              {Array.from({ length: 8 }, (_, i) => i + 1).map(mines => (
                <button
                  key={mines}
                  onClick={() => {
                    playClickSound();
                    setBombs(mines);
                  }}
                  className={`p-3 rounded-lg font-mono text-sm border transition-all duration-300 ${
                    bombs === mines
                      ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400 shadow-lg shadow-emerald-500/10'
                      : 'bg-black/40 border-emerald-500/20 text-emerald-400/70 hover:bg-emerald-500/10'
                  }`}
                >
                  {mines}
                </button>
              ))}
            </div>
          </div>

          {/* Players */}
          <div>
            <div className="flex items-center gap-2 text-emerald-400/80 text-sm mb-3">
              <Users className="w-4 h-4" />
              <h3 className="font-medium tracking-wider">TOTAL PLAYERS</h3>
            </div>
            <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
              {Array.from({ length: 7 }, (_, i) => i + 2).map(players => (
                <button
                  key={players}
                  onClick={() => {
                    playClickSound();
                    setMinPlayers(players);
                  }}
                  className={`p-3 rounded-lg font-mono text-sm border transition-all duration-300 ${
                    minPlayers === players
                      ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400 shadow-lg shadow-emerald-500/10'
                      : 'bg-black/40 border-emerald-500/20 text-emerald-400/70 hover:bg-emerald-500/10'
                  }`}
                >
                  {players}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Start Button */}
        <div className="p-6 border-t border-emerald-500/10">
          <button
            onClick={() => {
              startGameSound.current.play();
              if (activeTab === 'random') {
                playGame(gridSize, bombs, minPlayers);
                // Instead of directly calling playGame, show the modal
                // setModalOpen(true);
              } else {
                createGameRoom(gridSize, bombs, minPlayers);
              }
            }}
            disabled={!isConnected || betAmount <= 0 || betAmount > walletBalance}
            className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:hover:bg-emerald-500
              text-black font-bold py-3 rounded-lg transition-all duration-300 transform hover:scale-[1.02] shadow-lg shadow-emerald-500/20"
          >
            {activeTab === 'random' ? 'JOIN RANDOM GAME' : 'CREATE GAME ROOM'}
          </button>
        </div>
      </div>

      <MaintenanceModal 
        isOpen={modalOpen} 
        onClose={() => setModalOpen(false)} 
      />
    </div>
  );
}


export default React.memo(LobbyDetails);