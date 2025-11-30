Below is a **clean, professionally formatted README.md** for your project **Redot**.
It explains the architecture, private bidding model, Zama FHE integration, security benefits, and how the dApp works.

You can copy–paste this directly into your repo.

---

# 🟥 **Redot – Private NFT Auction Platform**

*A privacy-preserving NFT auction dApp powered by Fully Homomorphic Encryption (FHE).*

---

## 📌 **Overview**

Redot is a **private NFT auction platform** designed to protect bidders by encrypting all bid values using **Zama FHE (Fully Homomorphic Encryption)**.
The auction process is completely on-chain, but every bid is stored in encrypted form, preventing:

* Bid manipulation
* On-chain snooping
* Frontrunning
* Value exposure

Only the final winning bid is revealed and settled, creating the fairest possible auction for all participants.

---

## 🧩 **Project Structure**

```
redot/
│
├── contract/      # Hardhat smart contracts for encrypted private auctions
├── frontend/      # Vite + React client UI
└── scripts/       # Node settlement scripts (final winner evaluation & payouts)
```

---

## 🔐 **Why Private Auctions?**

Traditional on-chain auctions expose all bid values publicly.
This leads to several problems:

* Competitors monitor the chain and outbid instantly.
* Whales can intimidate smaller bidders.
* Bots perform frontrunning and bid-copying.
* Users hesitate to place real bids because they reveal willingness to pay.

**Redot solves all of this.**

---

## 🛡️ **FHE: Fully Homomorphic Encryption (Powered by Zama)**

Redot integrates **Zama’s FHE technology**, allowing bid computations *directly on encrypted data*.

### 🔑 What this means:

* **Bid values never appear in plaintext** — not even inside the smart contract.
* The contract only sees `euint64` encrypted values.
* Comparisons and maximum-bid calculations happen **without decryption**.
* Only the winning bid is decrypted at the end of the auction.

### 🧠 Benefits of FHE in Redot

* **True Privacy**
  Bidders can place bids without revealing ANY amounts to anyone else.

* **Anti-Frontrunning**
  Bots and MEV cannot react to unseen values.

* **Fairness & Neutrality**
  The system cannot be manipulated since all bids remain hidden.

* **Security by Design**
  Only the final highest bid is decrypted — nothing earlier leaks.

* **Trustless Mechanism**
  No central authority is needed to see or manage bids.

---

## 🏛️ **Core Features**

### ✔️ **Encrypted Private Bids**

All bids are encrypted with Zama FHE before being sent on-chain.

### ✔️ **On-chain Auction Logic**

Smart contract handles:

* Auction creation
* Encrypted comparisons
* Tracking highest encrypted bid
* Preventing sellers from bidding on their own NFTs
* Counting bids without revealing values

### ✔️ **Sealed-Bid Model**

Users compete without seeing each other's amounts.

### ✔️ **Vercel Frontend**

Fast, lightweight UI for interacting with:

* NFT creation
* Auction creation
* Encrypted bidding
* Auction settlement
* NFT display (IPFS image + metadata)

### ✔️ **Scripted Settlement**

The Node `scripts/` folder runs the:

* Final decryption request
* Settlement logic
* NFT transfer + fund payout

---

## 🏗️ **Tech Stack**

### 🔸 Smart Contracts

* Hardhat
* Solidity
* Zama FHE Solidity Library
* OpenZeppelin ERC721

### 🔸 Frontend

* React (Vite)
* Wagmi
* Viem
* Zama Relayer SDK
* IPFS (Pinata / web3.storage)

### 🔸 Backend Scripts

* Node.js
* Viem / Ethers
* Auction settlement logic

---

## 🚀 **How the Auction Works**

### 1️⃣ Seller creates an auction

* NFT transferred to the contract
* Minimum bid set
* Auction activated

### 2️⃣ User encrypts their bid on the frontend

* Bid value → converted to `euint64`
* Encryption happens client-side using Zama FHE
* Encrypted bid is sent on-chain

### 3️⃣ Smart contract compares encrypted values

* Uses FHE operators to determine the current highest bid
* No plaintext is ever exposed

### 4️⃣ When auction ends

* Node settlement script requests decryption of the final highest bid
* Winner is paid out automatically
* NFT transferred to winner

---

## 🔒 **Security Considerations**

* All `.env` files excluded from GitHub
* No private keys in repository
* Encrypted bids stored on-chain
* Zama Relayer prevents key exposure
* Contract prevents seller self-bidding

---

## 🌐 **Deployment**

### **Frontend → Vercel**

* Connect GitHub repo
* Set environment variables
* Build command:

  ```
  npm run build
  ```
* Output directory:

  ```
  dist
  ```

### **Contracts → Any EVM chain**

* Hardhat deployment scripts
* Configurable environment variables for RPC + private keys

---

## 🟥 **Why the Name “Redot”?**

Redot represents **a new mark in NFT auctions** —
a system that puts privacy, fairness, and decentralization first.

No more manipulation.
No more frontrunning.
No more transparent bidding wars.

Just **pure, private, trustless competition.**

---

## 📬 **Future Enhancements**

* Encrypted reserve price
* Multi-item encrypted auctions
* Mobile UI optimization
* Email/Webhook notification system
* Seller-defined bid reveal rules
