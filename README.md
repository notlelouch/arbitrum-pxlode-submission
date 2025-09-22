# 💥 Xplode — The On-Chain Battlefield on Arbitrum Nova

Xplode Game · Arbitrum Nova · Stylus · Rust · React · PostgreSQL · Redis  

🎮 **Play Now** | 🐦 **Follow Us**

> “No house. No mercy. Just mind games.”  
> — The most ruthless on-chain PvP grid game, now on Arbitrum Nova.

---

## 🎮 What is Xplode?
Xplode is a **real-time, on-chain PvP strategy game** inspired by Minesweeper — reimagined as a high-stakes, grid-based battle royale.  
Every move is public. Every decision counts. No house edge. Just pure strategy.  

For the Arbitrum Hackathon, Xplode was deployed on **Arbitrum Nova with Stylus-powered Rust contracts**, enabling **gasless, lightning-fast gameplay** while keeping all moves transparent and trustless on-chain.  

---

## 🚀 Why It’s 🔥
- ⚡ **Arbitrum Nova** – low-cost, high-throughput chain purpose-built for gaming & social apps  
- 🦀 **Stylus-Powered Rust Contracts** – advanced game logic & performance  
- 🎯 **Fully On-Chain PvP** – turns, locks, and wins are transparently recorded  
- 💸 **Gasless Gameplay** – players focus on strategy, not fees  
- 👥 **Multiplayer Battle Royale** – head-to-head grid battles with instant outcomes  

---

## 🕹️ Core Gameplay
- 💎 **Strategic Grid Battles** – Reveal diamonds, avoid bombs  
- ⏱️ **Blazing Turn Timers** – 30s move phase · 5s lock phase  
- 🔒 **Lock System** – Block your opponent’s moves (2 locks per player)  
- 🧠 **Mind Over Luck** – Outsmart instead of outguessing  
- 🎭 **On-Chain Emotes** – NFT-based taunts during battle  
- 👥 **Custom Lobbies** – Play with friends or battle randoms  

---

# 🚀 Running Xplode Locally (Arbitrum Nova + Stylus)

To run the full Xplode stack locally, follow the steps below in order.

---

## 1️⃣ Start Local Nitro Dev Node
**Repository:** `stylus-blockchain-service/nitro-devnode`

```bash
./run-dev-node.sh
```

## 2️⃣ Deploy Stylus Contracts
**Repository:** `stylus-blockchain-service/xplode-game`

```bash
# Check contracts
cargo stylus check

# Deploy contracts to local Nova node
cargo stylus deploy \
  --endpoint https://nova.arbitrum.io/rpc \
  --private-key="ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" \
  --no-verify
```

## 3️⃣ Run Blockchain Service
**Repository:** `xplode-moves`

```bash
npm run dev
```

## 4️⃣ Run Backend
**Repository:** `xplode-engine`

```bash
# Start main game server
cargo run --release --bin server

# Run browser wallet server
cargo run --release --bin browser-wallet
```

## 5️⃣ Run Frontend
**Repository:** `xplode-client`

```bash
npm run dev
```

