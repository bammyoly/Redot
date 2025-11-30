import React, { useState } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  usePublicClient,
} from "wagmi";
import { parseEther, formatEther } from "viem";

import {
  FHENFT_AUCTION_ADDRESS,
  FHENFT_AUCTION_ABI,
} from "../libs/fheNftAuction";

import { FHENFT_COLLECTION_ADDRESS } from "../libs/fheNftCollection";

const CreateNftAuction = () => {
  const { address, isConnected } = useAccount();
  const { writeContractAsync, isPending } = useWriteContract();
  const publicClient = usePublicClient();

  // ---- Create auction form state ----
  const [nftAddress, setNftAddress] = useState(
    FHENFT_COLLECTION_ADDRESS || ""
  );
  const [tokenId, setTokenId] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("10");
  const [minBidEth, setMinBidEth] = useState("");
  const [txStatus, setTxStatus] = useState(null);

  // ---- View auction state ----
  const [viewAuctionId, setViewAuctionId] = useState("");
  const auctionIdBigInt =
    viewAuctionId && !Number.isNaN(Number(viewAuctionId))
      ? BigInt(viewAuctionId)
      : 0n;
  const shouldRead =
    viewAuctionId !== "" && !Number.isNaN(Number(viewAuctionId));

  const { data: auctionData } = useReadContract({
    address: FHENFT_AUCTION_ADDRESS,
    abi: FHENFT_AUCTION_ABI,
    functionName: "getAuction",
    args: [auctionIdBigInt],
    query: { enabled: shouldRead },
  });

  const { data: bidCount } = useReadContract({
    address: FHENFT_AUCTION_ADDRESS,
    abi: FHENFT_AUCTION_ABI,
    functionName: "getBidCount",
    args: [auctionIdBigInt],
    query: { enabled: shouldRead },
  });

  const handleCreateAuction = async (e) => {
    e.preventDefault();
    setTxStatus(null);

    if (!isConnected) {
      setTxStatus("Please connect your wallet first.");
      return;
    }
    if (!nftAddress || !tokenId || !durationMinutes || !minBidEth) {
      setTxStatus(
        "Please fill in all fields (including minimum bid)."
      );
      return;
    }

    let minBidWei;
    try {
      minBidWei = parseEther(minBidEth);
      if (minBidWei < 0n) {
        setTxStatus("Minimum bid must be >= 0.");
        return;
      }
    } catch (err) {
      console.error(err);
      setTxStatus("Invalid minimum bid value. Use a number like 0.01.");
      return;
    }

    try {
      setTxStatus("Sending transaction…");

      const nowSeconds = Math.floor(Date.now() / 1000);
      const endTime = BigInt(nowSeconds + Number(durationMinutes) * 60);

      const hash = await writeContractAsync({
        address: FHENFT_AUCTION_ADDRESS,
        abi: FHENFT_AUCTION_ABI,
        functionName: "createAuction",
        args: [nftAddress, BigInt(tokenId), endTime, minBidWei],
        gas: BigInt(1_000_000),
      });

      setTxStatus(`Tx sent: ${hash}. Waiting for confirmation…`);

      const receipt = await publicClient.waitForTransactionReceipt({
        hash,
      });

      if (receipt.status !== "success") {
        setTxStatus(
          "❌ Transaction reverted on-chain. Check explorer for the reason."
        );
        return;
      }

      // Get the new auction id = nextAuctionId - 1
      const nextId = await publicClient.readContract({
        address: FHENFT_AUCTION_ADDRESS,
        abi: FHENFT_AUCTION_ABI,
        functionName: "nextAuctionId",
        args: [],
      });

      const newAuctionId = BigInt(nextId) - 1n;

      // Auto-fill the View Auction field
      setViewAuctionId(newAuctionId.toString());

      setTxStatus(
        `✅ Auction created successfully. Auction ID: ${newAuctionId.toString()}`
      );
    } catch (err) {
      console.error(err);
      setTxStatus(
        err?.shortMessage || err?.message || "Failed to create auction."
      );
    }
  };

  // Decode auctionData (tuple) if present
  let auctionView = {};

  if (auctionData) {
    const [
      seller,
      nftAddr,
      token,
      endTime,
      active,
      settled,
      winner,
      winningBid,
      minBid, // uint64 in wei from contract
    ] = auctionData;

    auctionView = {
      seller,
      nftAddress: nftAddr,
      tokenId: token,
      endTime,
      active,
      settled,
      winner,
      winningBid,
      minBid,
    };
  }

  const formatTimestamp = (value) => {
    if (!value) return "-";
    const ms = Number(value) * 1000;
    if (!Number.isFinite(ms)) return value.toString();
    return new Date(ms).toLocaleString();
  };

  const formatMinBidEthView = () => {
    if (!auctionView.minBid) return "0";
    try {
      return formatEther(BigInt(auctionView.minBid));
    } catch {
      return auctionView.minBid.toString();
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white pt-24 pb-16">
      <div className="container mx-auto px-10 md:px-24 lg:px-40 space-y-12">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold text-white">
              Create Auction
            </h1>
            <p className="text-sm text-gray-400 mt-3 max-w-xl">
              List an NFT from your collection for a fully encrypted auction.
              Set the duration and minimum bid, then share the auction ID with
              bidders.
            </p>
          </div>
          <div className="text-xs text-right text-gray-400">
            {isConnected ? (
              <>
                <p className="font-semibold text-fuchsia-300">Wallet</p>
                <p className="font-mono text-[11px] truncate max-w-[220px]">
                  {address}
                </p>
              </>
            ) : (
              <>
                <p className="font-semibold text-fuchsia-300">
                  Not connected
                </p>
                <p>Connect your wallet in the navbar to start.</p>
              </>
            )}
          </div>
        </header>

        {/* Main grid: Create form + helper panel */}
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Create Auction Card */}
          <section className="lg:col-span-2 rounded-2xl bg-[#0c0c0c] border border-fuchsia-900/40 shadow-2xl shadow-fuchsia-900/20 p-6 md:p-8">
            <h2 className="text-lg md:text-xl font-semibold mb-2 text-white">
              Create a new auction
            </h2>
            <p className="text-xs text-gray-400 mb-5">
              One NFT per auction. The end time is calculated as{" "}
              <span className="font-mono">now + duration (minutes)</span>.
              Ensure the auction contract is approved to transfer your NFT.
            </p>

            <form
              onSubmit={handleCreateAuction}
              className="space-y-4 text-sm"
            >
              {/* NFT address */}
              <div className="space-y-1">
                <label className="block text-gray-200 text-xs uppercase tracking-wide">
                  NFT Contract Address
                </label>
                <input
                  type="text"
                  placeholder="0x..."
                  value={nftAddress}
                  onChange={(e) => setNftAddress(e.target.value)}
                  className="w-full rounded-lg bg-[#050505] border border-fuchsia-900/40 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-fuchsia-500"
                />
                <p className="text-[11px] text-gray-500 mt-1">
                  Default is your{" "}
                  <span className="font-mono">FHENftCollection</span>{" "}
                  address. Only change this if you know what you are doing.
                </p>
              </div>

              {/* Token ID + Duration */}
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 space-y-1">
                  <label className="block text-gray-200 text-xs uppercase tracking-wide">
                    Token ID
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={tokenId}
                    onChange={(e) => setTokenId(e.target.value)}
                    className="w-full rounded-lg bg-[#050505] border border-fuchsia-900/40 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-fuchsia-500"
                  />
                  <p className="text-[11px] text-gray-500 mt-1">
                    Use the token ID from the mint result or from your{" "}
                    <span className="font-mono">My NFTs</span> page.
                  </p>
                </div>
                <div className="flex-1 space-y-1">
                  <label className="block text-gray-200 text-xs uppercase tracking-wide">
                    Duration (minutes)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(e.target.value)}
                    className="w-full rounded-lg bg-[#050505] border border-fuchsia-900/40 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-fuchsia-500"
                  />
                  <p className="text-[11px] text-gray-500 mt-1">
                    The auction will close automatically after this time
                    elapses.
                  </p>
                </div>
              </div>

              {/* Minimum bid */}
              <div className="space-y-1">
                <label className="block text-gray-200 text-xs uppercase tracking-wide">
                  Minimum Bid (ETH)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 0.01"
                  value={minBidEth}
                  onChange={(e) => setMinBidEth(e.target.value)}
                  className="w-full rounded-lg bg-[#050505] border border-fuchsia-900/40 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-fuchsia-500"
                />
                <p className="text-[11px] text-gray-500 mt-1">
                  This will be converted to wei and enforced on-chain as the
                  minimum bid.
                </p>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isPending || !isConnected}
                className="mt-2 inline-flex items-center justify-center rounded-lg bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 disabled:cursor-not-allowed px-5 py-2.5 text-sm font-semibold text-white transition-colors duration-200"
              >
                {isPending ? "Creating…" : "Create Auction"}
              </button>

              {txStatus && (
                <p className="text-xs text-gray-200 mt-3 break-all">
                  {txStatus}
                </p>
              )}
            </form>
          </section>

          {/* Helper / Info card */}
          <section className="rounded-2xl bg-[#0c0c0c] border border-fuchsia-900/40 shadow-2xl 
          shadow-fuchsia-900/20 p-6 flex flex-col justify-between text-xs text-gray-300">
            <div>
              <h2 className="text-sm font-semibold text-white mb-2">
                Before you create
              </h2>
              <p className="text-[11px] text-gray-400 mb-3">
                Make sure you have:
              </p>
              <ul className="list-disc list-inside space-y-1 text-[11px]">
                <li>
                  Minted the NFT in{" "}
                  <span className="font-mono">Redot Collection (optional)</span>.
                </li>
                <li>
                  Approved the auction contract using the{" "}
                  <span className="font-mono">Approve Auction</span> button
                  on the Create NFT page (Important).
                </li>
                <li>
                  Confirmed the correct token ID and contract address.
                </li>
              </ul>
            </div>
            <div className="mt-4 pt-3 border-t border-fuchsia-900/30 text-[11px] text-gray-400">
              <p className="mb-1 font-semibold text-gray-200">
                Auction contract
              </p>
              <p className="font-mono break-all text-[10px]">
                {FHENFT_AUCTION_ADDRESS}
              </p>
              <p className="mt-2">
                New auctions will appear on the{" "}
                <span className="text-fuchsia-300 font-semibold">
                  Live NFT Auctions
                </span>{" "}
                page while they are active.
              </p>
            </div>
          </section>
        </div>

        {/* View Auction Card */}
        <section className="rounded-2xl bg-[#0c0c0c] border border-fuchsia-900/40 shadow-2xl shadow-fuchsia-900/20 p-6 md:p-8">
          <h2 className="text-lg md:text-xl font-semibold mb-2 text-white">
            View auction details
          </h2>
          <p className="text-xs text-gray-400 mb-4">
            Enter an auction ID to see its core on-chain data and bid count.
          </p>

          <div className="flex flex-col md:flex-row items-stretch md:items-end gap-3 text-sm mb-4">
            <div className="flex-1 space-y-1">
              <label className="block text-gray-200 text-xs uppercase tracking-wide">
                Auction ID
              </label>
              <input
                type="number"
                min="0"
                value={viewAuctionId}
                onChange={(e) => setViewAuctionId(e.target.value)}
                className="w-full rounded-lg bg-[#050505] border border-fuchsia-900/40 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-fuchsia-500"
              />
            </div>
          </div>

          {shouldRead && auctionData ? (
            <div className="mt-3 space-y-1 text-xs text-gray-200">
              <p>
                <span className="font-semibold text-gray-100">
                  Seller:
                </span>{" "}
                {auctionView.seller}
              </p>
              <p>
                <span className="font-semibold text-gray-100">NFT:</span>{" "}
                {auctionView.nftAddress} #
                {auctionView.tokenId?.toString()}
              </p>
              <p>
                <span className="font-semibold text-gray-100">
                  End time:
                </span>{" "}
                {formatTimestamp(auctionView.endTime)}
              </p>
              <p>
                <span className="font-semibold text-gray-100">
                  Active:
                </span>{" "}
                {auctionView.active ? "Yes" : "No"}
              </p>
              <p>
                <span className="font-semibold text-gray-100">
                  Settled:
                </span>{" "}
                {auctionView.settled ? "Yes" : "No"}
              </p>
              <p>
                <span className="font-semibold text-gray-100">
                  Winner:
                </span>{" "}
                {auctionView.winner ===
                "0x0000000000000000000000000000000000000000"
                  ? "—"
                  : auctionView.winner}
              </p>
              <p>
                <span className="font-semibold text-gray-100">
                  Winning bid (raw):
                </span>{" "}
                {auctionView.winningBid
                  ? auctionView.winningBid.toString()
                  : "—"}
              </p>
              <p>
                <span className="font-semibold text-gray-100">
                  Minimum bid:
                </span>{" "}
                {formatMinBidEthView()} ETH
              </p>
              <p>
                <span className="font-semibold text-gray-100">
                  Bid count:
                </span>{" "}
                {bidCount ? bidCount.toString() : "0"}
              </p>
            </div>
          ) : (
            <p className="text-xs text-gray-500">
              Enter a valid auction ID to load data.
            </p>
          )}
        </section>

      </div>
    </div>
  );
};

export default CreateNftAuction;
