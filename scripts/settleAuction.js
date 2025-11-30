
require('dotenv').config();
const { createPublicClient, createWalletClient, http } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const { sepolia } = require('viem/chains'); // change if not on Sepolia

const RPC_URL = process.env.RPC_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const FHENFT_AUCTION_ADDRESS = process.env.AUCTION_ADDRESS; // put in .env

const FHENFT_AUCTION_ABI = [
  {
    type: 'function',
    name: 'nextAuctionId',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256', name: '' }],
  },
  {
    type: 'function',
    name: 'getAuction',
    stateMutability: 'view',
    inputs: [{ type: 'uint256', name: 'auctionId' }],
    outputs: [
      { type: 'address', name: 'seller' },
      { type: 'address', name: 'nftAddress' },
      { type: 'uint256', name: 'tokenId' },
      { type: 'uint256', name: 'endTime' },
      { type: 'bool', name: 'active' },
      { type: 'bool', name: 'settled' },
      { type: 'address', name: 'winner' },
      { type: 'uint64', name: 'winningBid' },
      { type: 'uint64', name: 'minBid' },
    ],
  },
  {
    type: 'function',
    name: 'closeAuctionPlain',
    stateMutability: 'nonpayable',
    inputs: [{ type: 'uint256', name: 'auctionId' }],
    outputs: [],
  },
];

if (!RPC_URL || !PRIVATE_KEY || !FHENFT_AUCTION_ADDRESS) {
  console.error('Missing RPC_URL, PRIVATE_KEY or AUCTION_ADDRESS in .env');
  process.exit(1);
}

const account = privateKeyToAccount(PRIVATE_KEY);

const publicClient = createPublicClient({
  chain: sepolia, // change if needed
  transport: http(RPC_URL),
});

const walletClient = createWalletClient({
  chain: sepolia,
  transport: http(RPC_URL),
  account,
});

async function main() {
  console.log('Keeper running with address:', account.address);

  const nextId = await publicClient.readContract({
    address: FHENFT_AUCTION_ADDRESS,
    abi: FHENFT_AUCTION_ABI,
    functionName: 'nextAuctionId',
    args: [],
  });

  const total = Number(nextId || 0n);
  if (!Number.isFinite(total) || total === 0) {
    console.log('No auctions yet.');
    return;
  }

  const block = await publicClient.getBlock();
  const now = Number(block.timestamp);

  for (let i = 0; i < total; i++) {
    const auctionId = BigInt(i);

    const [
      seller,
      nftAddress,
      tokenId,
      endTime,
      active,
      settled,
      winner,
      winningBid,
      minBid,
    ] = await publicClient.readContract({
      address: FHENFT_AUCTION_ADDRESS,
      abi: FHENFT_AUCTION_ABI,
      functionName: 'getAuction',
      args: [auctionId],
    });

    const endTimeNum = Number(endTime);

    // only settle: active, not settled, ended
    if (!active || settled || now < endTimeNum) continue;

    console.log(`Settling auction #${i}...`);

    try {
      const { request } = await publicClient.simulateContract({
        address: FHENFT_AUCTION_ADDRESS,
        abi: FHENFT_AUCTION_ABI,
        functionName: 'closeAuctionPlain',
        args: [auctionId],
        account,
      });

      const txHash = await walletClient.writeContract(request);
      console.log(` closeAuctionPlain tx: ${txHash}`);

      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
      });

      if (receipt.status === 'success') {
        console.log(` ✅ Auction #${i} settled`);
      } else {
        console.log(` ❌ Auction #${i} reverted in receipt`);
      }
    } catch (err) {
      console.error(
        ` ❌ closeAuctionPlain failed for #${i}:`,
        err?.shortMessage || err?.message || err,
      );
    }
  }

  console.log('Done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
