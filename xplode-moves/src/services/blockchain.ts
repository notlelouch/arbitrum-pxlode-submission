import { ethers } from "ethers";
import { InitializeGameRequest, RecordMoveRequest } from "../types";

const XPLODE_ABI = [
  "function initializeGame(string memory gameId, uint256 gridSize, tuple(uint256,uint256)[] memory bombPositions) external",
  "function recordMove(string memory gameId, string memory playerName, uint256 x, uint256 y) external",
  "function delegateGame(string memory gameId) external",
  "function commitAndUndelegateGame(string memory gameId) external",
  "function gameExists(string memory gameId) external view returns (bool)",
  "function getGridSize(string memory gameId) external view returns (uint256)",
  "function getMoveCount(string memory gameId) external view returns (uint256)",
  "event GameInitialized(string indexed gameId, uint256 gridSize, address gameServer)",
  "event MoveMade(string indexed gameId, string playerName, uint256 x, uint256 y, uint256 timestamp)",
  "event GameDelegated(string indexed gameId, address gameServer)",
  "event GameCommitted(string indexed gameId, address gameServer)"
];

export class BlockchainService {
  private provider: ethers.Provider;
  private wallet: ethers.Wallet;
  private contract: ethers.Contract;

  constructor() {
    this.provider = new ethers.JsonRpcProvider(
      process.env.ARBITRUM_NOVA_RPC_URL || "http://localhost:8547"
    );

    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
      throw new Error("PRIVATE_KEY environment variable is required");
    }

    this.wallet = new ethers.Wallet(privateKey, this.provider);

    const contractAddress = process.env.XPLODE_CONTRACT_ADDRESS;
    if (!contractAddress) {
      throw new Error("XPLODE_CONTRACT_ADDRESS environment variable is required");
    }

    this.contract = new ethers.Contract(contractAddress, XPLODE_ABI, this.wallet);

    console.log("Arbitrum Blockchain Service initialized");
    console.log("Wallet address:", this.wallet.address);
    console.log("Contract address:", contractAddress);
  }

  async initializeGame(request: InitializeGameRequest): Promise<string> {
    try {
      console.log("Initialize game request:", request);

      const bombPositions = request.bombPositions.map(pos => [
        ethers.toBigInt(pos.x),
        ethers.toBigInt(pos.y)
      ]);

      const gasEstimate = await this.contract.initializeGame.estimateGas(
        request.gameId,
        ethers.toBigInt(request.gridSize),
        bombPositions
      );

      const tx = await this.contract.initializeGame(
        request.gameId,
        ethers.toBigInt(request.gridSize),
        bombPositions,
        {
          gasLimit: gasEstimate * 120n / 100n
        }
      );

      console.log("Transaction sent:", tx.hash);
      const receipt = await tx.wait(1);
      console.log("Transaction confirmed in block:", receipt.blockNumber);

      // // Auto-delegate
      // try {
      //   await this.delegateGame(request.gameId);
      // } catch (delegateError) {
      //   console.warn("Auto-delegation failed:", delegateError);
      // }

      return tx.hash;
    } catch (error) {
      console.error("Error initializing game:", error);
      throw error;
    }
  }

  async recordMove(request: RecordMoveRequest): Promise<string> {
    try {
      console.log("Record move request:", request);

      const gasEstimate = await this.contract.recordMove.estimateGas(
        request.gameId,
        request.playerName,
        ethers.toBigInt(request.cell.x),
        ethers.toBigInt(request.cell.y)
      );

      const tx = await this.contract.recordMove(
        request.gameId,
        request.playerName,
        ethers.toBigInt(request.cell.x),
        ethers.toBigInt(request.cell.y),
        {
          gasLimit: gasEstimate * 120n / 100n
        }
      );

      console.log("Move transaction sent:", tx.hash);
      const receipt = await tx.wait(1);
      console.log("Move confirmed in block:", receipt.blockNumber);

      return tx.hash;
    } catch (error) {
      console.error("Error recording move:", error);
      throw error;
    }
  }

  private async delegateGame(gameId: string): Promise<string> {
    try {
      const tx = await this.contract.delegateGame(gameId);
      console.log("Delegation transaction sent:", tx.hash);
      const receipt = await tx.wait(1);
      console.log("Game delegated in block:", receipt.blockNumber);
      return tx.hash;
    } catch (error) {
      console.error("Error delegating game:", error);
      throw error;
    }
  }

  async commitAndUndelegate(gameId: string): Promise<string> {
    try {
      console.log("Commit and undelegate request for game:", gameId);

      const gasEstimate = await this.contract.commitAndUndelegateGame.estimateGas(gameId);

      const tx = await this.contract.commitAndUndelegateGame(gameId, {
        gasLimit: gasEstimate * 120n / 100n
      });

      console.log("Commit transaction sent:", tx.hash);
      const receipt = await tx.wait(1);
      console.log("Game committed in block:", receipt.blockNumber);

      return tx.hash;
    } catch (error) {
      console.error("Error committing and undelegating game:", error);
      throw error;
    }
  }
}