import React, { useEffect, useState } from "react";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { formatEther } from "viem";

import {
  FHENFT_AUCTION_ADDRESS,
  FHENFT_AUCTION_ABI,
} from "../libs/fheNftAuction";

// --- ERC721 metadata ABI ---
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

const resolveImageUrl = (uri) => {
  if (!uri) return null;
  if (uri.startsWith("ipfs://")) {
    return `https://ipfs.io/ipfs/${uri.slice(7)}`;
  }
  return uri;
};

// MM:SS or HH:MM:SS
const getTimeLeft = (endTime, nowSeconds) => {
  if (!endTime) return "—";
  const diff = Number(endTime) - nowSeconds;
  if (!Number.isFinite(diff) || diff <= 0) return "00:00";

  const totalSeconds = diff;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const hh = String(hours).padStart(2, "0");
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");

  if (hours > 0) {
    return `${hh}:${mm}:${ss}`;
  }
  return `${mm}:${ss}`;
};

const MyAuctions = () => {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync, isPending } = useWriteContract();

  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [txStatus, setTxStatus] = useState(null);

  const formatTimestamp = (seconds) => {
    if (!seconds) return "-";
    const ms = Number(seconds) * 1000;
    if (!Number.isFinite(ms)) return seconds.toString();
    return new Date(ms).toLocaleString();
  };

  const formatEth = (value) => {
    try {
      const v = typeof value === "bigint" ? value : BigInt(value || 0);
      return formatEther(v);
    } catch {
      return value?.toString?.() ?? "0";
    }
  };

  const loadMyAuctions = async () => {
    if (!publicClient || !address) return;

    try {
      setLoading(true);
      setError(null);
      setAuctions([]);

      const nextId = await publicClient.readContract({
        address: FHENFT_AUCTION_ADDRESS,
        abi: FHENFT_AUCTION_ABI,
        functionName: "nextAuctionId",
        args: [],
      });

      const total = Number(nextId || 0n);
      if (!Number.isFinite(total) || total === 0) {
        setAuctions([]);
        return;
      }

      const nowSecondsBase = Math.floor(Date.now() / 1000);

      const auctionCalls = [];
      const bidCountCalls = [];
      const decryptCalls = [];

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

        decryptCalls.push(
          publicClient.readContract({
            address: FHENFT_AUCTION_ADDRESS,
            abi: FHENFT_AUCTION_ABI,
            functionName: "decryptionRequested",
            args: [id],
          })
        );
      }

      const rawAuctionResults = await Promise.all(auctionCalls);
      const rawBidCounts = await Promise.all(bidCountCalls);
      const rawDecryptFlags = await Promise.all(decryptCalls);

      const myList = [];

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
        ] = rawAuctionResults[i];

        // 🔒 SELLER-ONLY VIEW
        if (
          !address ||
          !seller ||
          seller.toLowerCase() !== address.toLowerCase()
        ) {
          continue;
        }

        const endTimeNum = Number(endTime);
        const bidCount = rawBidCounts[i] || 0n;
        const decryptionRequested = Boolean(rawDecryptFlags[i]);
        const now = nowSecondsBase;
        const auctionEnded = endTimeNum <= now;

        let status = "Unknown";

        if (!auctionEnded && active && !settled) {
          status = "Active (bidding open)";
        } else if (auctionEnded && !settled) {
          status = "Ended (awaiting settlement)";
        } else if (settled) {
          if (
            winner &&
            winner !== "0x0000000000000000000000000000000000000000"
          ) {
            status = "Settled (winner decided)";
          } else {
            status = "Settled (no winner)";
          }
        }

        let imageUrl = null;
        let tokenName = null;

        // Only try metadata if nftAddress is not zero
        if (
          nftAddress &&
          nftAddress !== "0x0000000000000000000000000000000000000000"
        ) {
          try {
            const [tokenUri, nameFromContract] = await Promise.all([
              publicClient.readContract({
                address: nftAddress,
                abi: ERC721_EXTRA_ABI,
                functionName: "tokenURI",
                args: [tokenId],
              }),
              publicClient
                .readContract({
                  address: nftAddress,
                  abi: ERC721_EXTRA_ABI,
                  functionName: "getTokenName",
                  args: [tokenId],
                })
                .catch(() => null),
            ]);

            imageUrl = resolveImageUrl(tokenUri);
            tokenName = nameFromContract;
          } catch (metaErr) {
            console.warn("Metadata fetch failed for auction", i, metaErr);
          }
        }

        myList.push({
          auctionId: i,
          seller,
          nftAddress,
          tokenId,
          endTime: endTimeNum,
          active,
          settled,
          winner,
          winningBid,
          minBid,
          bidCount,
          decryptionRequested,
          status,
          imageUrl,
          tokenName,
        });
      }

      setAuctions(myList);
    } catch (err) {
      console.error(err);
      setError(
        err?.shortMessage || err?.message || "Failed to load your auctions."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isConnected && address) {
      loadMyAuctions();
    } else {
      setAuctions([]);
    }
  }, [isConnected, address, publicClient]);

  const handleRefresh = () => {
    setTxStatus(null);
    loadMyAuctions();
  };

  // Optional manual close (e.g. zero-bid auctions)
  const handleCloseAuction = async (auction) => {
    if (!isConnected || !address) {
      setTxStatus("Connect your wallet first.");
      return;
    }

    try {
      setTxStatus("Sending closeAuction transaction…");
      const hash = await writeContractAsync({
        address: FHENFT_AUCTION_ADDRESS,
        abi: FHENFT_AUCTION_ABI,
        functionName: "closeAuction",
        args: [BigInt(auction.auctionId)],
      });

      setTxStatus(`closeAuction tx sent: ${hash}`);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      if (receipt.status !== "success") {
        setTxStatus("❌ closeAuction transaction reverted.");
        return;
      }

      setTxStatus("✅ Auction closed.");
      loadMyAuctions();
    } catch (err) {
      console.error(err);
      setTxStatus(
        err?.shortMessage ||
          err?.message ||
          "Failed to close auction. Check explorer / console."
      );
    }
  };

  // Seller reclaim (zero bids only, after settlement)
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

      setTxStatus("✅ NFT claimed back to your wallet.");
      loadMyAuctions();
    } catch (err) {
      console.error(err);
      setTxStatus(
        err?.shortMessage ||
          err?.message ||
          "Failed to claim NFT back. Check explorer / console."
      );
    }
  };

  // --- Live Countdown Logic ---
  const [nowSeconds, setNowSeconds] = useState(Math.floor(Date.now() / 1000));

  useEffect(() => {
    const intervalId = setInterval(() => {
      setNowSeconds(Math.floor(Date.now() / 1000));
    }, 1000);
    return () => clearInterval(intervalId);
  }, []);
  // --- End Live Countdown Logic ---

  return (
    <div className="min-h-screen bg-[#050505] text-white pt-24 pb-16">
      <div className="container mx-auto px-10 md:px-24 lg:px-40 space-y-12">
        {/* Title */}
        <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold text-white">
          My Auctions
        </h1>

        {/* Status/Error box */}
        {(loading || error || txStatus) && (
          <div className="p-4 rounded-lg bg-[#0c0c0c] border border-fuchsia-900/50 text-sm">
            {loading && (
              <p className="text-fuchsia-400">Loading your auctions...</p>
            )}
            {error && <p className="text-red-500">Error: {error}</p>}
            {txStatus && <p className="text-gray-300">Status: {txStatus}</p>}
            {!loading && (
              <button
                onClick={handleRefresh}
                className="text-fuchsia-500 underline mt-2"
              >
                Refresh
              </button>
            )}
          </div>
        )}

        {/* Grid */}
        {!loading && auctions.length > 0 && (
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {auctions.map((a) => {
              const auctionEnded = a.endTime <= nowSeconds;

              const canClose =
                a.active &&
                !a.settled &&
                auctionEnded &&
                (a.bidCount || 0n) === 0n;

              const canReclaim =
                a.settled &&
                (!a.winner ||
                  a.winner ===
                    "0x0000000000000000000000000000000000000000") &&
                (a.bidCount || 0n) === 0n &&
                a.seller &&
                address &&
                a.seller.toLowerCase() === address.toLowerCase() &&
                a.nftAddress &&
                a.nftAddress !==
                  "0x0000000000000000000000000000000000000000";

              let buttonText = "Auction Active";
              let handler = null;
              let disabled = true;

              if (canClose) {
                buttonText = "Close Auction (No Bids)";
                handler = () => handleCloseAuction(a);
                disabled = isPending;
              } else if (canReclaim) {
                buttonText = "Claim NFT Back";
                handler = () => handleReclaimNft(a);
                disabled = isPending;
              } else if (
                a.settled &&
                a.winner &&
                a.winner !==
                  "0x0000000000000000000000000000000000000000"
              ) {
                buttonText = "Sold";
              } else if (auctionEnded && !a.settled) {
                buttonText = "Awaiting Settlement";
              } else if (!auctionEnded && a.active) {
                buttonText = "Auction Active";
              }

              return (
                <div
                  key={a.auctionId}
                  className="rounded-xl bg-[#0c0c0c] border border-fuchsia-900/40 shadow-2xl shadow-fuchsia-900/20 flex flex-col overflow-hidden relative group"
                >
                  {/* Image area */}
                  <div className="relative h-64 overflow-hidden bg-gray-900">
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

                    <span className="absolute top-3 left-3 px-3 py-1 bg-fuchsia-600/90 text-white text-xs font-bold rounded-full z-10">
                      Hot
                    </span>

                    <div className="absolute bottom-0 left-0 right-0 px-4 py-3 bg-black/50 backdrop-blur-sm flex items-center justify-between text-white">
                      <div>
                        <p className="text-[10px] text-gray-400">
                          Minimum Bid / Winning
                        </p>
                        <p className="text-sm font-bold">
                          {a.winningBid && a.winningBid !== 0n
                            ? `${formatEth(a.winningBid)} ETH`
                            : `${formatEth(a.minBid)} ETH`}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-gray-400">Ends in</p>
                        <p className="text-sm font-bold">
                          {getTimeLeft(a.endTime, nowSeconds)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Text + button */}
                  <div className="px-5 pt-5 pb-4 flex-1 flex flex-col justify-between">
                    <div className="mb-4">
                      <p className="text-xl font-bold text-white mb-1">
                        {a.tokenName ||
                          `Token #${a.tokenId?.toString?.() ?? a.tokenId}`}
                      </p>
                      <p className="text-sm text-fuchsia-300">
                        @{a.seller.slice(0, 6)}...
                      </p>
                      <p className="text-[11px] text-gray-500 mt-2">
                        Status: {a.status} | Bids:{" "}
                        {a.bidCount?.toString?.() ?? a.bidCount}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={disabled || !handler ? undefined : handler}
                      disabled={disabled || !handler}
                      className={`w-full inline-flex items-center justify-center rounded-lg px-6 py-3 font-semibold text-white transition-colors duration-200 ${
                        handler
                          ? "bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700"
                          : "bg-gray-700 cursor-default"
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {isPending && handler ? "Processing..." : buttonText}
                    </button>

                    <div className="mt-2 flex items-center justify-between text-[10px] text-gray-500">
                      <span>
                        Auction #{a.auctionId} •{" "}
                        {a.bidCount?.toString?.() ?? a.bidCount} bids
                      </span>
                      <span>Ends: {formatTimestamp(a.endTime)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Empty / disconnected states */}
        {!loading && !error && auctions.length === 0 && isConnected && (
          <div className="p-10 text-center rounded-xl bg-[#0c0c0c] border border-fuchsia-900/50">
            <p className="text-xl font-semibold mb-4 text-fuchsia-400">
              You have not created any auctions yet.
            </p>
            <p className="text-gray-400">Use “Create Auction” to list an NFT.</p>
          </div>
        )}

        {!loading && !error && !isConnected && (
          <div className="p-10 text-center rounded-xl bg-[#0c0c0c] border border-fuchsia-900/50">
            <p className="text-sm text-gray-300">
              Connect your wallet to view auctions you have created.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MyAuctions;
