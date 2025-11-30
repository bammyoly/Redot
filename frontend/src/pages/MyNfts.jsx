import React, { useEffect, useState } from "react";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";

import {
  FHENFT_COLLECTION_ADDRESS,
  FHENFT_COLLECTION_ABI,
} from "../libs/fheNftCollection";

import { FHENFT_AUCTION_ADDRESS } from "../libs/fheNftAuction";

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
  {
    type: "function",
    name: "ownerOf",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "isApprovedForAll",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "operator", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "getApproved",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
];

const resolveImageUrl = (uri) => {
  if (!uri) return null;
  if (uri.startsWith("ipfs://")) {
    return `https://ipfs.io/ipfs/${uri.slice(7)}`;
  }
  return uri;
};

const MyNfts = () => {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync, isPending } = useWriteContract();

  const [tokens, setTokens] = useState([]); // { tokenId, tokenName, imageUrl, approvedForAuction }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [txStatus, setTxStatus] = useState(null);

  const loadMyNfts = async () => {
    if (!publicClient || !address) return;

    try {
      setLoading(true);
      setError(null);
      setTokens([]);

      // Check if collection-wide approval is set
      let isCollectionApproved = false;
      try {
        const approvedForAll = await publicClient.readContract({
          address: FHENFT_COLLECTION_ADDRESS,
          abi: ERC721_EXTRA_ABI,
          functionName: "isApprovedForAll",
          args: [address, FHENFT_AUCTION_ADDRESS],
        });
        isCollectionApproved = Boolean(approvedForAll);
      } catch (err) {
        console.warn("isApprovedForAll check failed", err);
      }

      const nextId = await publicClient.readContract({
        address: FHENFT_COLLECTION_ADDRESS,
        abi: FHENFT_COLLECTION_ABI,
        functionName: "nextTokenId",
        args: [],
      });

      const total = Number(nextId || 0n);
      if (!Number.isFinite(total) || total <= 1) {
        setTokens([]);
        return;
      }

      const myTokens = [];

      for (let i = 1; i < total; i++) {
        const tokenId = BigInt(i);

        try {
          const owner = await publicClient.readContract({
            address: FHENFT_COLLECTION_ADDRESS,
            abi: ERC721_EXTRA_ABI,
            functionName: "ownerOf",
            args: [tokenId],
          });

          if (!owner || owner.toLowerCase() !== address.toLowerCase()) {
            continue;
          }

          let imageUrl = null;
          let tokenName = null;
          let tokenApprovedForAuction = false;

          try {
            const [tokenUri, nameFromContract, approvedAddress] =
              await Promise.all([
                publicClient.readContract({
                  address: FHENFT_COLLECTION_ADDRESS,
                  abi: ERC721_EXTRA_ABI,
                  functionName: "tokenURI",
                  args: [tokenId],
                }),
                publicClient
                  .readContract({
                    address: FHENFT_COLLECTION_ADDRESS,
                    abi: ERC721_EXTRA_ABI,
                    functionName: "getTokenName",
                    args: [tokenId],
                  })
                  .catch(() => null),
                publicClient.readContract({
                  address: FHENFT_COLLECTION_ADDRESS,
                  abi: ERC721_EXTRA_ABI,
                  functionName: "getApproved",
                  args: [tokenId],
                }),
              ]);

            imageUrl = resolveImageUrl(tokenUri);
            tokenName = nameFromContract;
            tokenApprovedForAuction =
              isCollectionApproved ||
              (approvedAddress &&
                approvedAddress.toLowerCase() ===
                  FHENFT_AUCTION_ADDRESS.toLowerCase());
          } catch (metaErr) {
            console.warn("Metadata/approval fetch failed for token", i, metaErr);
            tokenApprovedForAuction = isCollectionApproved;
          }

          myTokens.push({
            tokenId,
            tokenName,
            imageUrl,
            approvedForAuction: tokenApprovedForAuction,
          });
        } catch (ownErr) {
          continue;
        }
      }

      setTokens(myTokens);
    } catch (err) {
      console.error(err);
      setError(
        err?.shortMessage || err?.message || "Failed to load your NFTs."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isConnected && address) {
      loadMyNfts();
    } else {
      setTokens([]);
    }
  }, [isConnected, address, publicClient]);

  const handleRefresh = () => {
    setTxStatus(null);
    loadMyNfts();
  };

  const handleApproveToken = async (tokenId) => {
    if (!isConnected || !address) {
      setTxStatus("Please connect your wallet first.");
      return;
    }

    try {
      setTxStatus(`Sending approval for token #${tokenId.toString()}…`);

      const hash = await writeContractAsync({
        address: FHENFT_COLLECTION_ADDRESS,
        abi: FHENFT_COLLECTION_ABI,
        functionName: "approve",
        args: [FHENFT_AUCTION_ADDRESS, tokenId],
      });

      setTxStatus(
        `Approval tx sent for token #${tokenId.toString()}: ${hash}. Waiting for confirmation…`
      );

      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      if (receipt.status !== "success") {
        setTxStatus("❌ Approval transaction reverted.");
        return;
      }

      setTxStatus(
        `✅ Token #${tokenId.toString()} approved for the auction contract.`
      );
      // Refresh approvals
      loadMyNfts();
    } catch (err) {
      console.error(err);
      setTxStatus(
        err?.shortMessage ||
          err?.message ||
          "Failed to approve token for auction."
      );
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white pt-24 pb-16">
      <div className="container mx-auto px-10 md:px-24 lg:px-40 space-y-10">
        {/* Title */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold text-white">
              My NFTs
            </h1>
            <p className="mt-2 text-sm text-gray-400">
              Approve individual NFTs for auction directly from your wallet.
            </p>
          </div>
        </div>

        {/* Status/Error box */}
        {(loading || error || txStatus) && (
          <div className="p-4 rounded-lg bg-[#0c0c0c] border border-fuchsia-900/50 text-sm">
            {loading && (
              <p className="text-fuchsia-400">Loading your NFTs…</p>
            )}
            {error && <p className="text-red-500">Error: {error}</p>}
            {txStatus && <p className="text-gray-300">Status: {txStatus}</p>}
            {!loading && (
              <button
                onClick={handleRefresh}
                className="text-fuchsia-500 underline mt-2 text-xs"
              >
                Refresh
              </button>
            )}
          </div>
        )}

        {/* Grid of NFTs */}
        {!loading && tokens.length > 0 && (
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {tokens.map((t) => {
              const approved = t.approvedForAuction;

              return (
                <div
                  key={t.tokenId.toString()}
                  className="rounded-xl bg-[#0c0c0c] border border-fuchsia-900/40 shadow-2xl shadow-fuchsia-900/20 flex flex-col overflow-hidden relative group"
                >
                  {/* Image */}
                  <div className="relative h-64 overflow-hidden bg-gray-900">
                    {t.imageUrl ? (
                      <img
                        src={t.imageUrl}
                        alt={
                          t.tokenName ||
                          `NFT #${t.tokenId?.toString?.() ?? t.tokenId}`
                        }
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.05]"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-500 text-xs">
                        NFT Image Unavailable
                      </div>
                    )}

                    <span
                      className={`absolute top-3 left-3 px-3 py-1 text-white text-xs font-bold rounded-full z-10 ${
                        approved
                          ? "bg-emerald-600/90"
                          : "bg-amber-500/90 text-black"
                      }`}
                    >
                      {approved ? "Approved for Auction" : "Approval Needed"}
                    </span>

                    <div className="absolute bottom-0 left-0 right-0 px-4 py-3 bg-black/50 backdrop-blur-sm flex items-center justify-between text-white">
                      <div>
                        <p className="text-[10px] text-gray-400">Token ID</p>
                        <p className="text-sm font-bold">
                          {t.tokenId?.toString?.() ?? t.tokenId}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-gray-400">Collection</p>
                        <p className="text-[11px] font-semibold text-fuchsia-300">
                          Redot Collection
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Text + button */}
                  <div className="px-5 pt-5 pb-4 flex-1 flex flex-col justify-between gap-3">
                    <div>
                      <p className="text-xl font-bold text-white mb-1">
                        {t.tokenName ||
                          `Token #${t.tokenId?.toString?.() ?? t.tokenId}`}
                      </p>
                      <p className="text-xs text-gray-500">
                        Contract:{" "}
                        <span className="font-mono text-[10px]">
                          {FHENFT_COLLECTION_ADDRESS.slice(0, 8)}…
                          {FHENFT_COLLECTION_ADDRESS.slice(-6)}
                        </span>
                      </p>
                    </div>

                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={
                          approved
                            ? undefined
                            : () => handleApproveToken(t.tokenId)
                        }
                        disabled={approved || isPending || !isConnected}
                        className={`w-full inline-flex items-center justify-center rounded-lg px-6 py-3 font-semibold text-white transition-colors duration-200 ${
                          approved
                            ? "bg-gray-700 cursor-default"
                            : "bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700"
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        {approved
                          ? "Approved for Auction"
                          : isPending
                          ? "Approving…"
                          : "Approve for Auction"}
                      </button>

                      <p className="text-[11px] text-gray-500">
                        Once approved, you can create an auction using this
                        token ID on the{" "}
                        <span className="text-fuchsia-300 font-medium">
                          Create Auction
                        </span>{" "}
                        page.
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Empty / disconnected states */}
        {!loading && !error && tokens.length === 0 && isConnected && (
          <div className="p-10 text-center rounded-xl bg-[#0c0c0c] border border-fuchsia-900/50">
            <p className="text-xl font-semibold mb-4 text-fuchsia-400">
              You do not have any NFTs in this collection yet.
            </p>
            <p className="text-gray-400 text-sm">
              Mint one from the{" "}
              <span className="text-fuchsia-300 font-medium">Mint NFT</span>{" "}
              page to get started.
            </p>
          </div>
        )}

        {!loading && !error && !isConnected && (
          <div className="p-10 text-center rounded-xl bg-[#0c0c0c] border border-fuchsia-900/50">
            <p className="text-sm text-gray-300">
              Connect your wallet to view and approve your NFTs.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MyNfts;
