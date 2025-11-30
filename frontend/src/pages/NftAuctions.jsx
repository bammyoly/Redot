import React, { useEffect, useState } from "react";
import {
  usePublicClient,
  useAccount,
  useWriteContract,
} from "wagmi";
import { formatEther, parseEther } from "viem";

import {
  FHENFT_AUCTION_ADDRESS,
  FHENFT_AUCTION_ABI,
} from "../libs/fheNftAuction";

// 🔐 FHE context
import { useFhe } from "../context/FheContext";

// Minimal ABI for metadata + custom name getter
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
  const trimmed = uri.trim();

  if (trimmed.startsWith("ipfs://")) {
    return `https://ipfs.io/ipfs/${trimmed.slice(7)}`;
  }

  if (/^(baf[0-9a-z]+|Qm[0-9A-Za-z]+)$/i.test(trimmed)) {
    return `https://ipfs.io/ipfs/${trimmed}`;
  }

  if (
    trimmed.startsWith("https://") ||
    trimmed.startsWith("http://")
  ) {
    return trimmed;
  }

  return null;
};

const NftAuctions = () => {
  const publicClient = usePublicClient();
  const { address, isConnected } = useAccount();
  const { writeContractAsync, isPending } = useWriteContract();

  // 🔐 FHE hook
  const { encryptBid, ready: fheReady, error: fheError } = useFhe();

  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Modal state
  const [selectedAuction, setSelectedAuction] = useState(null);
  const [plaintextBidEth, setPlaintextBidEth] = useState("");
  const [bidStatus, setBidStatus] = useState(null);
  const [isEncrypting, setIsEncrypting] = useState(false); // 👈 new

  // ⏱️ global "now" in seconds for countdown
  const [nowSeconds, setNowSeconds] = useState(
    Math.floor(Date.now() / 1000)
  );

  // Tick "now" every second for live countdown
  useEffect(() => {
    const interval = setInterval(() => {
      setNowSeconds(Math.floor(Date.now() / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Load all active auctions
  const loadAuctions = async () => {
    if (!publicClient) return;

    try {
      setLoading(true);
      setError(null);

      const nextId = await publicClient.readContract({
        address: FHENFT_AUCTION_ADDRESS,
        abi: FHENFT_AUCTION_ABI,
        functionName: "nextAuctionId",
        args: [],
      });

      const total = Number(nextId);
      if (!Number.isFinite(total) || total === 0) {
        setAuctions([]);
        return;
      }

      const nowSecondsFetch = Math.floor(Date.now() / 1000);

      const auctionCalls = [];
      const bidCountCalls = [];

      for (let i = 0; i < total; i++) {
        auctionCalls.push(
          publicClient.readContract({
            address: FHENFT_AUCTION_ADDRESS,
            abi: FHENFT_AUCTION_ABI,
            functionName: "getAuction",
            args: [BigInt(i)],
          })
        );

        bidCountCalls.push(
          publicClient.readContract({
            address: FHENFT_AUCTION_ADDRESS,
            abi: FHENFT_AUCTION_ABI,
            functionName: "getBidCount",
            args: [BigInt(i)],
          })
        );
      }

      const auctionResults = await Promise.all(auctionCalls);
      const bidCounts = await Promise.all(bidCountCalls);

      const list = [];

      for (let i = 0; i < total; i++) {
        const [
          seller,
          nftAddr,
          token,
          endTime,
          active,
          settled,
          winner,
          winningBid,
          minBid,
        ] = auctionResults[i];

        const endTimeNum = Number(endTime);
        const isOpen =
          active &&
          !settled &&
          endTimeNum > nowSecondsFetch &&
          nftAddr !== "0x0000000000000000000000000000000000000000";

        if (!isOpen) continue;

        const bidCount = bidCounts[i];

        let imageUrl = null;
        let nftName = "";

        try {
          const [tokenUri, tokenName] = await Promise.all([
            publicClient.readContract({
              address: nftAddr,
              abi: ERC721_EXTRA_ABI,
              functionName: "tokenURI",
              args: [token],
            }),
            publicClient.readContract({
              address: nftAddr,
              abi: ERC721_EXTRA_ABI,
              functionName: "getTokenName",
              args: [token],
            }),
          ]);

          imageUrl = resolveImageUrl(tokenUri);
          nftName = tokenName;
        } catch (err) {
          console.error("Failed to fetch metadata for auction", i, err);
        }

        list.push({
          auctionId: i,
          seller,
          nftAddress: nftAddr,
          tokenId: token,
          endTime: endTimeNum,
          minBid,
          bidCount,
          imageUrl,
          nftName,
        });
      }

      setAuctions(list);
    } catch (err) {
      console.error(err);
      setError(
        err?.shortMessage || err?.message || "Failed to load auctions."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAuctions();
  }, [publicClient]);

  // Helpers
  const formatTimestamp = (seconds) => {
    if (!seconds) return "-";
    const ms = Number(seconds) * 1000;
    if (!Number.isFinite(ms)) return seconds.toString();
    return new Date(ms).toLocaleString();
  };

  const truncateAddress = (addr) => {
    if (!addr) return "";
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const formatMinBidEth = (minBid) => {
    if (minBid == null) return "0";
    try {
      const value = typeof minBid === "bigint" ? minBid : BigInt(minBid);
      return formatEther(value);
    } catch {
      return minBid.toString();
    }
  };

  const getTimeRemaining = (endTimeSec) => {
    if (!endTimeSec) return "-";

    const end = Number(endTimeSec);
    const diff = end - nowSeconds;

    if (!Number.isFinite(diff) || diff <= 0) {
      return "Ended";
    }

    const days = Math.floor(diff / 86400);
    const hours = Math.floor((diff % 86400) / 3600);
    const minutes = Math.floor((diff % 3600) / 60);
    const seconds = diff % 60;

    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    }
    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  };

  const isSellerOfSelected =
    !!selectedAuction &&
    !!address &&
    selectedAuction.seller &&
    address.toLowerCase() === selectedAuction.seller.toLowerCase();

  // FHE engine status text (for UI under wallet)
  const fheStatusText = (() => {
    if (fheError) {
      return `FHE Engine: Error – ${String(fheError)}`;
    }
    if (!fheReady) {
      return "FHE Engine: Initialising…";
    }
    return "FHE Engine: Ready";
  })();

  // 🔐 Encrypted bidding handler
  const handlePlaceBid = async (e) => {
    e.preventDefault();
    setBidStatus(null);

    if (!isConnected) {
      setBidStatus("Please connect your wallet first.");
      return;
    }

    if (!selectedAuction) {
      setBidStatus("No auction selected.");
      return;
    }

    if (isSellerOfSelected) {
      setBidStatus("You cannot bid on your own auction.");
      return;
    }

    if (!plaintextBidEth) {
      setBidStatus("Enter a bid amount in ETH.");
      return;
    }

    if (!fheReady) {
      setBidStatus("FHE encryption not ready yet. Please wait a moment.");
      return;
    }

    if (selectedAuction.endTime <= nowSeconds) {
      setBidStatus("This auction has already ended.");
      return;
    }

    let bidWei;
    try {
      bidWei = parseEther(plaintextBidEth);
    } catch (err) {
      setBidStatus("Invalid bid amount. Use a number like 0.05.");
      return;
    }

    try {
      const minBid = BigInt(selectedAuction.minBid || 0n);
      if (bidWei < minBid) {
        setBidStatus(
          `Bid must be at least ${formatMinBidEth(
            selectedAuction.minBid
          )} ETH.`
        );
        return;
      }
    } catch {
      // Let contract enforce if anything odd
    }

    try {
      setIsEncrypting(true);
      setBidStatus("Encrypting bid…");

      console.log("Calling encryptBid with:", {
        contract: FHENFT_AUCTION_ADDRESS,
        user: address,
        bidWei: bidWei.toString(),
      });

      const { encryptedAmount, inputProof } = await encryptBid(
        FHENFT_AUCTION_ADDRESS,
        address,
        bidWei
      );

      setBidStatus("Sending encrypted bid transaction…");

      const hash = await writeContractAsync({
        address: FHENFT_AUCTION_ADDRESS,
        abi: FHENFT_AUCTION_ABI,
        functionName: "placeBid",
        args: [
          BigInt(selectedAuction.auctionId),
          encryptedAmount,
          inputProof,
        ],
      });

      setBidStatus(`Tx sent: ${hash}. Waiting for confirmation…`);

      const receipt = await publicClient.waitForTransactionReceipt({
        hash,
      });

      if (receipt.status !== "success") {
        setBidStatus(
          "❌ Bid transaction reverted. Check block explorer for details."
        );
        return;
      }

      setBidStatus("✅ Encrypted bid placed successfully.");
      setPlaintextBidEth("");
      await loadAuctions();
    } catch (err) {
      console.error("Bid failed:", err);
      setBidStatus(
        err?.shortMessage ||
          err?.message ||
          "Failed to place encrypted bid."
      );
    } finally {
      setIsEncrypting(false);
    }
  };

  const closeModal = () => {
    setSelectedAuction(null);
    setPlaintextBidEth("");
    setBidStatus(null);
    setIsEncrypting(false);
  };

  return (
    <div className="min-h-screen bg-[#050505] text-slate-50 pt-24 pb-16">
      <div className="container mx-auto px-10 md:px-24 lg:px-40 space-y-12">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold text-white">
              Live NFT Auctions
            </h1>
            <p className="text-sm text-gray-400 mt-3 max-w-xl">
              All active auctions currently open for bidding. Bids are encrypted
              on the client and sent via{" "}
              <span className="font-mono">placeBid</span> using Zama FHE.
            </p>
          </div>
          <div className="text-xs text-right text-gray-400">
            {isConnected ? (
              <>
                <p className="font-semibold text-fuchsia-300">Wallet</p>
                <p className="font-mono text-[11px] truncate max-w-[220px]">
                  {address}
                </p>
                <p className="mt-1 text-[10px] text-gray-400">
                  {fheStatusText}
                </p>
              </>
            ) : (
              <>
                <p className="font-semibold text-fuchsia-300">
                  Not connected
                </p>
                <p>Connect your wallet in the navbar to bid.</p>
                <p className="mt-1 text-[10px] text-gray-500">
                  {fheStatusText}
                </p>
              </>
            )}
          </div>
        </header>

        {/* Status / error */}
        {(loading || error || fheError) && (
          <div className="p-4 rounded-lg bg-[#0c0c0c] border border-fuchsia-900/50 text-sm">
            {loading && (
              <p className="text-fuchsia-400">Loading auctions…</p>
            )}
            {error && <p className="text-red-500">Error: {error}</p>}
            {fheError && (
              <p className="text-amber-400">
                FHE initialisation issue: {String(fheError)}
              </p>
            )}
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && auctions.length === 0 && (
          <div className="p-10 text-center rounded-xl bg-[#0c0c0c] border border-fuchsia-900/50">
            <p className="text-xl font-semibold mb-4 text-fuchsia-400">
              No active auctions found.
            </p>
            <p className="text-gray-400">
              Once sellers list NFTs for auction, they will appear here for
              bidding.
            </p>
          </div>
        )}

        {/* Grid of auctions */}
        {!loading && !error && auctions.length > 0 && (
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {auctions.map((a) => (
              <div
                key={a.auctionId}
                className="rounded-xl bg-[#0c0c0c] border border-fuchsia-900/40 shadow-2xl shadow-fuchsia-900/20 flex flex-col overflow-hidden relative group"
              >
                {/* Image area */}
                <div className="relative h-64 overflow-hidden bg-gray-900">
                  {a.imageUrl ? (
                    <img
                      src={a.imageUrl}
                      alt={a.nftName || `NFT ${a.tokenId?.toString()}`}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.05]"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-500 text-xs">
                      NFT Image Unavailable
                    </div>
                  )}

                  <span className="absolute top-3 left-3 px-3 py-1 bg-fuchsia-600/90 text-white text-xs font-bold rounded-full z-10">
                    Live
                  </span>

                  <div className="absolute bottom-0 left-0 right-0 px-4 py-3 bg-black/50 backdrop-blur-sm flex items-center justify-between text-white">
                    <div>
                      <p className="text-[10px] text-gray-400">
                        Minimum Bid
                      </p>
                      <p className="text-sm font-bold">
                        {formatMinBidEth(a.minBid)} ETH
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-gray-400">Time Left</p>
                      <p className="text-sm font-bold">
                        {getTimeRemaining(a.endTime)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Text + button */}
                <div className="px-5 pt-5 pb-4 flex-1 flex flex-col justify-between">
                  <div className="mb-4">
                    <p className="text-xl font-bold text-white mb-1">
                      {a.nftName ||
                        `Token #${a.tokenId?.toString?.() ?? a.tokenId}`}
                    </p>
                    <p className="text-sm text-fuchsia-300">
                      @{truncateAddress(a.seller)}
                    </p>
                    <p className="text-[11px] text-gray-500 mt-2">
                      Auction #{a.auctionId} • Bids:{" "}
                      {a.bidCount?.toString?.() ?? a.bidCount}
                    </p>
                    <p className="text-[11px] text-gray-500">
                      Ends: {formatTimestamp(a.endTime)}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedAuction(a);
                      setPlaintextBidEth("");
                      setBidStatus(null);
                      setIsEncrypting(false);
                    }}
                    className="w-full inline-flex items-center justify-center rounded-lg px-6 py-3 font-semibold text-white transition-colors duration-200 bg-purple-600 hover:bg-purple-500"
                  >
                    View &amp; Place Bid
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {selectedAuction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-xl rounded-2xl bg-[#050505] border border-fuchsia-900/60 shadow-2xl shadow-fuchsia-900/30 overflow-hidden relative">
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-fuchsia-900/40 via-purple-900/40 to-black">
              <div>
                <p className="text-xs text-gray-300 uppercase tracking-wide">
                  Auction Detail
                </p>
                <h2 className="text-lg font-semibold text-white">
                  Auction #{selectedAuction.auctionId}
                </h2>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="text-gray-300 hover:text-white text-xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* Top: image + info */}
              <div className="flex flex-col md:flex-row gap-4">
                <div className="md:w-1/2">
                  <div className="relative h-52 md:h-56 overflow-hidden rounded-xl bg-gray-900 border border-fuchsia-900/40">
                    {selectedAuction.imageUrl ? (
                      <img
                        src={selectedAuction.imageUrl}
                        alt={
                          selectedAuction.nftName ||
                          `NFT ${selectedAuction.tokenId?.toString()}`
                        }
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-500 text-xs px-3 text-center">
                        NFT preview unavailable.
                      </div>
                    )}
                    <span className="absolute top-3 left-3 px-3 py-1 bg-fuchsia-600/90 text-white text-[10px] font-bold rounded-full">
                      Live Auction
                    </span>
                  </div>
                </div>

                <div className="md:w-1/2 flex flex-col justify-between text-xs text-gray-200 space-y-2">
                  <div>
                    <p className="text-sm font-semibold text-white mb-1">
                      {selectedAuction.nftName ||
                        `Token #${
                          selectedAuction.tokenId?.toString?.() ??
                          selectedAuction.tokenId
                        }`}
                    </p>
                    <p className="text-[11px] text-fuchsia-300 mb-2">
                      Seller: {truncateAddress(selectedAuction.seller)}
                    </p>

                    <p>
                      <span className="font-semibold text-gray-100">
                        Token ID:
                      </span>{" "}
                      {selectedAuction.tokenId?.toString()}
                    </p>
                    <p>
                      <span className="font-semibold text-gray-100">
                        Minimum bid:
                      </span>{" "}
                      {formatMinBidEth(selectedAuction.minBid)} ETH
                    </p>
                    <p>
                      <span className="font-semibold text-gray-100">
                        Bids:
                      </span>{" "}
                      {selectedAuction.bidCount?.toString?.() ??
                        selectedAuction.bidCount}
                    </p>
                    <p>
                      <span className="font-semibold text-gray-100">
                        Ends:
                      </span>{" "}
                      {formatTimestamp(selectedAuction.endTime)}
                    </p>
                    <p>
                      <span className="font-semibold text-gray-100">
                        Time left:
                      </span>{" "}
                      {getTimeRemaining(selectedAuction.endTime)}
                    </p>
                  </div>

                  <div className="mt-2 text-[11px] text-gray-400">
                    <p>
                      Bids are encrypted using Zama FHE before going on-chain.
                      Amounts stay hidden until the auction is settled via the
                      FHE decryption callback.
                    </p>
                  </div>
                </div>
              </div>

              {/* Bid form */}
              <div className="border-t border-fuchsia-900/40 pt-4">
                <h3 className="text-sm font-semibold text-white mb-2">
                  Place your encrypted bid
                </h3>
                <p className="text-[11px] text-gray-400 mb-3">
                  Enter the amount in ETH you want to bid. The value is
                  encrypted with FHE before being sent to the smart contract.
                </p>

                <form
                  onSubmit={handlePlaceBid}
                  className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center"
                >
                  <div className="flex-1">
                    <label className="text-[11px] text-gray-300 mb-1 block">
                      Bid amount (ETH)
                    </label>
                    <input
                      type="text"
                      placeholder="0.05"
                      value={plaintextBidEth}
                      onChange={(e) => setPlaintextBidEth(e.target.value)}
                      className="w-full rounded-lg bg-[#050505] border border-fuchsia-900/40 px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-fuchsia-500"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={
                      isPending ||
                      isEncrypting ||
                      !isConnected ||
                      isSellerOfSelected ||
                      !fheReady
                    }
                    className="sm:w-40 inline-flex items-center justify-center rounded-lg bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 disabled:cursor-not-allowed px-4 py-2.5 text-xs font-semibold text-white transition-colors duration-200"
                  >
                    {isPending
                      ? "Sending tx…"
                      : isEncrypting
                      ? "Encrypting…"
                      : fheReady
                      ? "Place Encrypted Bid"
                      : "Initialising FHE…"}
                  </button>
                </form>

                {isSellerOfSelected && (
                  <p className="text-[11px] text-amber-300 mt-2">
                    You are the seller of this auction. Sellers cannot bid on
                    their own items.
                  </p>
                )}

                {bidStatus && (
                  <p className="text-[11px] text-gray-200 mt-2 break-all">
                    {bidStatus}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NftAuctions;
