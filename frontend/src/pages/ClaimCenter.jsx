import React, { useEffect, useState } from "react";
import {
  useAccount,
  usePublicClient,
  useWriteContract,
} from "wagmi";
import { formatEther } from "viem";

import {
  FHENFT_AUCTION_ADDRESS,
  FHENFT_AUCTION_ABI,
} from "../libs/fheNftAuction";

const ERC721_EXTRA_ABI = [
  {
    type: "function",
    name: "tokenURI",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "string" }],
  },
  {
    type: "function",
    name: "getTokenName",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "string" }],
  },
];

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const resolveImageUrl = (uri) => {
  if (!uri) return null;
  if (uri.startsWith("ipfs://")) {
    return `https://ipfs.io/ipfs/${uri.slice(7)}`;
  }
  return uri;
};

const formatEth = (value) => {
  try {
    const v = typeof value === "bigint" ? value : BigInt(value || 0);
    return formatEther(v);
  } catch {
    return value?.toString?.() ?? "0";
  }
};

const formatTimestamp = (seconds) => {
  if (!seconds) return "-";
  const ms = Number(seconds) * 1000;
  if (!Number.isFinite(ms)) return seconds.toString();
  return new Date(ms).toLocaleString();
};

const ClaimCenter = () => {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync, isPending } = useWriteContract();

  const [wonAuctions, setWonAuctions] = useState([]);
  const [reclaimableAuctions, setReclaimableAuctions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [txStatus, setTxStatus] = useState(null);

  const loadSettledAuctions = async () => {
    if (!publicClient || !address) return;

    try {
      setLoading(true);
      setError(null);
      setWonAuctions([]);
      setReclaimableAuctions([]);

      const nextId = await publicClient.readContract({
        address: FHENFT_AUCTION_ADDRESS,
        abi: FHENFT_AUCTION_ABI,
        functionName: "nextAuctionId",
        args: [],
      });

      const total = Number(nextId || 0n);
      if (!Number.isFinite(total) || total === 0) {
        return;
      }

      const auctionCalls = [];
      const bidCountCalls = [];

      for (let i = 0; i < total; i++) {
        const id = BigInt(i);

        auctionCalls.push(
          publicClient.readContract({
            address: FHENFT_AUCTION_ADDRESS,
            abi: FHENFT_AUCTION_ABI,
            functionName: "getAuction",
            args: [id],
          })
        );

        bidCountCalls.push(
          publicClient.readContract({
            address: FHENFT_AUCTION_ADDRESS,
            abi: FHENFT_AUCTION_ABI,
            functionName: "getBidCount",
            args: [id],
          })
        );
      }

      const rawAuctions = await Promise.all(auctionCalls);
      const rawBidCounts = await Promise.all(bidCountCalls);

      const wonList = [];
      const reclaimList = [];

      for (let i = 0; i < total; i++) {
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
        ] = rawAuctions[i];

        const bidCount = rawBidCounts[i] || 0n;

        // must be settled and still holding the NFT
        if (!settled || !nftAddress || nftAddress === ZERO_ADDRESS) {
          continue;
        }

        const auctionId = i;
        const tokenIdNum = tokenId;
        const endTimeNum = Number(endTime);

        const lowerSeller = seller?.toLowerCase?.();
        const lowerWinner = winner?.toLowerCase?.();
        const lowerUser = address?.toLowerCase?.();

        const isWinnerClaim =
          lowerUser &&
          lowerWinner &&
          lowerWinner === lowerUser &&
          nftAddress !== ZERO_ADDRESS;

        const isReclaimableNoBids =
          lowerUser &&
          lowerSeller &&
          lowerSeller === lowerUser &&
          bidCount === 0n &&
          nftAddress !== ZERO_ADDRESS;

        if (!isWinnerClaim && !isReclaimableNoBids) continue;

        let imageUrl = null;
        let tokenName = null;

        try {
          const [tokenUri, nameFromContract] = await Promise.all([
            publicClient.readContract({
              address: nftAddress,
              abi: ERC721_EXTRA_ABI,
              functionName: "tokenURI",
              args: [tokenIdNum],
            }),
            publicClient
              .readContract({
                address: nftAddress,
                abi: ERC721_EXTRA_ABI,
                functionName: "getTokenName",
                args: [tokenIdNum],
              })
              .catch(() => null),
          ]);

          imageUrl = resolveImageUrl(tokenUri);
          tokenName = nameFromContract;
        } catch (metaErr) {
          console.warn("Metadata fetch failed for auction", i, metaErr);
        }

        const auctionObj = {
          auctionId,
          seller,
          nftAddress,
          tokenId: tokenIdNum,
          endTime: endTimeNum,
          active,
          settled,
          winner,
          winningBid,
          minBid,
          bidCount,
          imageUrl,
          tokenName,
        };

        if (isWinnerClaim) {
          wonList.push(auctionObj);
        }
        if (isReclaimableNoBids) {
          reclaimList.push(auctionObj);
        }
      }

      setWonAuctions(wonList);
      setReclaimableAuctions(reclaimList);
    } catch (err) {
      console.error(err);
      setError(
        err?.shortMessage || err?.message || "Failed to load claimable auctions."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isConnected && address) {
      loadSettledAuctions();
    } else {
      setWonAuctions([]);
      setReclaimableAuctions([]);
    }
  }, [isConnected, address, publicClient]);

  const handleClaimNft = async (auction) => {
    if (!isConnected || !address) {
      setTxStatus("Connect your wallet first.");
      return;
    }

    try {
      setTxStatus("Sending claimNft transaction…");
      const hash = await writeContractAsync({
        address: FHENFT_AUCTION_ADDRESS,
        abi: FHENFT_AUCTION_ABI,
        functionName: "claimNft",
        args: [BigInt(auction.auctionId)],
      });

      setTxStatus(`claimNft tx sent: ${hash}`);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      if (receipt.status !== "success") {
        setTxStatus("❌ claimNft transaction reverted.");
        return;
      }

      setTxStatus("✅ NFT claimed successfully.");
      await loadSettledAuctions();
    } catch (err) {
      console.error(err);
      setTxStatus(
        err?.shortMessage ||
          err?.message ||
          "Failed to claim NFT. Check explorer / console."
      );
    }
  };

  const handleReclaimNft = async (auction) => {
    if (!isConnected || !address) {
      setTxStatus("Connect your wallet first.");
      return;
    }

    try {
      setTxStatus("Sending reclaimNft transaction…");
      const hash = await writeContractAsync({
        address: FHENFT_AUCTION_ADDRESS,
        abi: FHENFT_AUCTION_ABI,
        functionName: "reclaimNft",
        args: [BigInt(auction.auctionId)],
      });

      setTxStatus(`reclaimNft tx sent: ${hash}`);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      if (receipt.status !== "success") {
        setTxStatus("❌ reclaimNft transaction reverted.");
        return;
      }

      setTxStatus("✅ NFT reclaimed back to your wallet.");
      await loadSettledAuctions();
    } catch (err) {
      console.error(err);
      setTxStatus(
        err?.shortMessage ||
          err?.message ||
          "Failed to reclaim NFT. Check explorer / console."
      );
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white pt-24 pb-16">
      <div className="container mx-auto px-10 md:px-24 lg:px-40 space-y-10">
        {/* Header */}
        <header className="space-y-3">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight">
            Claim Center
          </h1>
          <p className="text-sm md:text-base text-gray-400 max-w-2xl">
            Claim NFTs from auctions you won, or reclaim NFTs from your auctions
            that ended with zero bids. Everything here is already settled
            on-chain and ready for action.
          </p>
        </header>

        {(loading || error || txStatus) && (
          <div className="p-4 rounded-lg bg-[#0c0c0c] border border-fuchsia-900/50 text-sm">
            {loading && (
              <p className="text-fuchsia-400">Loading claimable auctions…</p>
            )}
            {error && <p className="text-red-500">Error: {error}</p>}
            {txStatus && <p className="text-gray-300">Status: {txStatus}</p>}
            {!loading && (
              <button
                type="button"
                onClick={() => {
                  setTxStatus(null);
                  loadSettledAuctions();
                }}
                className="text-fuchsia-400 underline mt-2"
              >
                Refresh
              </button>
            )}
          </div>
        )}

        {!loading &&
          !error &&
          wonAuctions.length === 0 &&
          reclaimableAuctions.length === 0 && (
            <div className="p-10 text-center rounded-xl bg-[#0c0c0c] border border-fuchsia-900/50 text-sm text-gray-400">
              <p className="text-fuchsia-300 font-semibold mb-2">
                No claimable items found
              </p>
              <p>
                When you win an auction, or when an auction you created ends
                with zero bids, those NFTs will appear here for claiming or
                reclaiming.
              </p>
            </div>
          )}

        {/* Auctions you won */}
        {wonAuctions.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-lg md:text-xl font-semibold text-fuchsia-300">
              Auctions You Won – Claim NFT
            </h2>
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {wonAuctions.map((a) => (
                <div
                  key={`won-${a.auctionId}`}
                  className="rounded-xl bg-[#0c0c0c] border border-fuchsia-900/40 shadow-2xl shadow-fuchsia-900/20 flex flex-col overflow-hidden group"
                >
                  <div className="relative h-56 bg-gray-900 overflow-hidden">
                    {a.imageUrl ? (
                      <img
                        src={a.imageUrl}
                        alt={
                          a.tokenName ||
                          `NFT #${a.tokenId?.toString?.() ?? a.tokenId}`
                        }
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.05]"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-500 text-xs">
                        NFT Image Unavailable
                      </div>
                    )}
                    <span className="absolute top-3 left-3 px-3 py-1 bg-emerald-600/90 text-white text-[10px] font-bold rounded-full">
                      Won
                    </span>
                  </div>
                  <div className="px-4 pt-4 pb-3 flex-1 flex flex-col justify-between text-xs">
                    <div>
                      <p className="text-sm font-semibold text-white mb-1">
                        {a.tokenName ||
                          `Token #${a.tokenId?.toString?.() ?? a.tokenId}`}
                      </p>
                      <p className="text-[11px] text-gray-400">
                        Auction #{a.auctionId} • Winning bid:{" "}
                        {a.winningBid && a.winningBid !== 0n
                          ? `${formatEth(a.winningBid)} ETH`
                          : "—"}
                      </p>
                      <p className="text-[11px] text-gray-500 mt-1">
                        Ended: {formatTimestamp(a.endTime)}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={isPending || !isConnected}
                      onClick={() => handleClaimNft(a)}
                      className="mt-3 w-full inline-flex items-center justify-center rounded-lg px-4 py-2 font-semibold text-white text-xs bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 disabled:cursor-not-allowed transition-colors"
                    >
                      {isPending ? "Processing…" : "Claim NFT"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Auctions you can reclaim */}
        {reclaimableAuctions.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-lg md:text-xl font-semibold text-fuchsia-300">
              No-Bid Auctions – Reclaim NFT
            </h2>
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {reclaimableAuctions.map((a) => (
                <div
                  key={`reclaim-${a.auctionId}`}
                  className="rounded-xl bg-[#0c0c0c] border border-fuchsia-900/40 shadow-2xl shadow-fuchsia-900/20 flex flex-col overflow-hidden group"
                >
                  <div className="relative h-56 bg-gray-900 overflow-hidden">
                    {a.imageUrl ? (
                      <img
                        src={a.imageUrl}
                        alt={
                          a.tokenName ||
                          `NFT #${a.tokenId?.toString?.() ?? a.tokenId}`
                        }
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.05]"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-500 text-xs">
                        NFT Image Unavailable
                      </div>
                    )}
                    <span className="absolute top-3 left-3 px-3 py-1 bg-amber-600/90 text-white text-[10px] font-bold rounded-full">
                      No Bids
                    </span>
                  </div>
                  <div className="px-4 pt-4 pb-3 flex-1 flex flex-col justify-between text-xs">
                    <div>
                      <p className="text-sm font-semibold text-white mb-1">
                        {a.tokenName ||
                          `Token #${a.tokenId?.toString?.() ?? a.tokenId}`}
                      </p>
                      <p className="text-[11px] text-gray-400">
                        Auction #{a.auctionId} • Bids:{" "}
                        {a.bidCount?.toString?.() ?? a.bidCount}
                      </p>
                      <p className="text-[11px] text-gray-500 mt-1">
                        Ended: {formatTimestamp(a.endTime)}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={isPending || !isConnected}
                      onClick={() => handleReclaimNft(a)}
                      className="mt-3 w-full inline-flex items-center justify-center rounded-lg px-4 py-2 font-semibold text-white text-xs bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 disabled:cursor-not-allowed transition-colors"
                    >
                      {isPending ? "Processing…" : "Reclaim NFT (no bids)"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export default ClaimCenter;
