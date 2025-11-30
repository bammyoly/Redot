import React, { useState } from "react";
import { useAccount, useWriteContract, usePublicClient } from "wagmi";
import {
  FHENFT_COLLECTION_ADDRESS,
  FHENFT_COLLECTION_ABI,
} from "../libs/fheNftCollection";

import { FHENFT_AUCTION_ADDRESS } from "../libs/fheNftAuction";

const resolveImageUrl = (uri) => {
  if (!uri) return null;
  if (uri.startsWith("ipfs://")) {
    return `https://ipfs.io/ipfs/${uri.slice(7)}`;
  }
  return uri;
};

const CreateNft = () => {
  const { address, isConnected } = useAccount();
  const { writeContractAsync, isPending } = useWriteContract();
  const {
    writeContractAsync: writeApproveAsync,
    isPending: isApprovePending,
  } = useWriteContract();
  const publicClient = usePublicClient();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [status, setStatus] = useState(null);
  const [mintedTokenId, setMintedTokenId] = useState(null);

  const buildTokenURI = () => {
    return imageUrl; 
  };

  const handleMint = async (e) => {
    e.preventDefault();

    if (!isConnected) {
      setStatus("Please connect your wallet in the navbar.");
      return;
    }
    if (!name || !description || !imageUrl) {
      setStatus("Please fill in name, description and image URL.");
      return;
    }

    try {
      setStatus("Sending mint transaction…");

      const tokenURI = buildTokenURI();

      const hash = await writeContractAsync({
        address: FHENFT_COLLECTION_ADDRESS,
        abi: FHENFT_COLLECTION_ABI,
        functionName: "mint",
        args: [name, tokenURI],
      });

      setStatus(`Tx sent: ${hash}. Waiting for confirmation…`);

      await publicClient.waitForTransactionReceipt({ hash });

      const nextId = await publicClient.readContract({
        address: FHENFT_COLLECTION_ADDRESS,
        abi: FHENFT_COLLECTION_ABI,
        functionName: "nextTokenId",
        args: [],
      });

      const mintedId = BigInt(nextId) - 1n;
      setMintedTokenId(mintedId.toString());
      setStatus(
        "✅ NFT minted successfully. You can now approve it for the auction contract."
      );
    } catch (err) {
      console.error(err);
      setStatus(
        err?.shortMessage || err?.message || "Failed to mint NFT."
      );
    }
  };

  const handleApproveForAuction = async () => {
    if (!isConnected) {
      setStatus("Please connect your wallet in the navbar.");
      return;
    }
    if (!mintedTokenId) {
      setStatus("Mint an NFT first before approving.");
      return;
    }

    try {
      setStatus("Sending approval transaction…");

      const hash = await writeApproveAsync({
        address: FHENFT_COLLECTION_ADDRESS,
        abi: FHENFT_COLLECTION_ABI,
        functionName: "setApprovalForAll",
        args: [FHENFT_AUCTION_ADDRESS, true],
      });

      setStatus(`Approval tx sent: ${hash}. Waiting for confirmation…`);

      await publicClient.waitForTransactionReceipt({ hash });

      setStatus(
        "✅ Auction contract approved to transfer your NFTs. You can now create an auction with this token."
      );
    } catch (err) {
      console.error(err);
      setStatus(
        err?.shortMessage || err?.message || "Failed to approve for auction."
      );
    }
  };

  const previewImage = resolveImageUrl(imageUrl);

  return (
    <div className="min-h-screen bg-[#050505] text-white pt-24 pb-16">
      <div className="container mx-auto px-10 md:px-24 lg:px-40 space-y-12">
        <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold text-white">
          Mint An NFT
        </h1>

        {status && (
          <div className="p-4 rounded-lg bg-[#0c0c0c] border border-fuchsia-900/50 text-xs md:text-sm">
            <p className="text-gray-200 break-all">{status}</p>
          </div>
        )}

        <div className="rounded-2xl bg-[#0c0c0c] border border-fuchsia-900/40 shadow-2xl shadow-fuchsia-900/20 p-6 md:p-8 grid md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div>
              <p className="text-sm text-fuchsia-300 font-semibold mb-1">
                Mint a new NFT
              </p>
              <p className="text-xs text-gray-400">
                Enter a name, description, and image URL. The app will mint
                into <span className="font-mono text-[11px]">
                  {FHENFT_COLLECTION_ADDRESS?.slice(0, 6)}...
                  {FHENFT_COLLECTION_ADDRESS?.slice(-4)}
                </span>{" "}
                and show the token ID so you can auction it.
              </p>
            </div>

            <form onSubmit={handleMint} className="space-y-4 text-sm">
              <div className="space-y-1">
                <label className="block text-gray-200 text-xs uppercase tracking-wide">
                  Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Encrypted Art #1"
                  className="w-full rounded-lg bg-[#050505] border border-fuchsia-900/40 px-3 py-2 
                  text-sm focus:outline-none focus:ring-1 focus:ring-fuchsia-500"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-gray-200 text-xs uppercase tracking-wide">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="Short description of your NFT…"
                  className="w-full rounded-lg bg-[#050505] border border-fuchsia-900/40 px-3 py-2 
                  text-sm focus:outline-none focus:ring-1 focus:ring-fuchsia-500"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-gray-200 text-xs uppercase tracking-wide">
                  Image URL
                </label>
                <input
                  type="text"
                  placeholder="https://... or ipfs://..."
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  className="w-full rounded-lg bg-[#050505] border border-fuchsia-900/40 px-3 py-2 
                  text-sm focus:outline-none focus:ring-1 focus:ring-fuchsia-500"
                />
                <p className="mt-2 text-[11px] text-gray-400">
                  Need hosting?{" "}
                  <a
                    href="https://imgur.com/upload"
                    target="_blank"
                    rel="noreferrer"
                    className="text-fuchsia-400 underline"
                  >
                    Upload your image on Imgur for free
                  </a>
                  .
                </p>
              </div>

              <button
                type="submit"
                disabled={isPending || !isConnected}
                className="mt-2 inline-flex items-center justify-center rounded-lg 
                bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 
                disabled:cursor-not-allowed px-5 py-2.5 
                text-sm font-semibold text-white transition-colors duration-200"
              >
                {isPending ? "Minting…" : "Mint NFT"}
              </button>

              {!isConnected && (
                <p className="text-[11px] text-red-400 mt-2">
                  Wallet not connected. Connect your wallet to mint.
                </p>
              )}
            </form>

            {mintedTokenId && (
              <div className="mt-6 text-xs text-gray-200 space-y-2 border-t border-fuchsia-900/30 pt-4">
                <p className="font-semibold text-fuchsia-300">
                  Mint result
                </p>
                <p>
                  NFT Contract Address:{" "}
                  <span className="font-mono break-all">
                    {FHENFT_COLLECTION_ADDRESS}
                  </span>
                </p>
                <p>
                  Token ID:{" "}
                  <span className="font-mono">{mintedTokenId}</span>
                </p>

                <button
                  type="button"
                  onClick={handleApproveForAuction}
                  disabled={isApprovePending || !isConnected}
                  className="mt-2 inline-flex items-center justify-center rounded-lg 
                  bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 
                  disabled:cursor-not-allowed px-4 py-2 text-xs font-semibold text-white"
                >
                  {isApprovePending
                    ? "Approving…"
                    : "Approve Auction Contract"}
                </button>

                <p className="text-[11px] text-gray-400 mt-1">
                  After approval, use these values in your auction form:
                  <br />
                  • NFT CA = FHENftCollection address
                  <br />
                  • Token ID = {mintedTokenId}
                </p>
              </div>
            )}
          </div>

          {/* Right: live preview card */}
          <div className="flex flex-col">
            <p className="text-sm text-gray-300 mb-3 font-semibold">
              Live preview
            </p>
            <div className="rounded-xl bg-[#050505] border border-fuchsia-900/40 shadow-2xl shadow-fuchsia-900/20 flex flex-col overflow-hidden relative group flex-1">
              <div className="relative h-64 overflow-hidden bg-gray-900">
                {previewImage ? (
                  <img
                    src={previewImage}
                    alt={name || "NFT preview"}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.05]"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-500 text-xs px-4 text-center">
                    Your NFT image preview will appear here once you paste a
                    valid URL.
                  </div>
                )}

                <span className="absolute top-3 left-3 px-3 py-1 bg-fuchsia-600/90 text-white text-xs font-bold rounded-full z-10">
                  Preview
                </span>

                <div className="absolute bottom-0 left-0 right-0 px-4 py-3 bg-black/50 backdrop-blur-sm flex items-center justify-between text-white">
                  <div>
                    <p className="text-[10px] text-gray-400">Collection</p>
                    <p className="text-sm font-bold truncate max-w-[140px]">
                      FHE Auction NFT
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-gray-400">Owner</p>
                    <p className="text-sm font-bold">
                      {address
                        ? `${address.slice(0, 6)}...`
                        : "Not connected"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="px-5 pt-5 pb-4 flex-1 flex flex-col justify-between">
                <div className="mb-4">
                  <p className="text-xl font-bold text-white mb-1">
                    {name || "NFT Name"}
                  </p>
                  <p className="text-[11px] text-gray-400 line-clamp-3">
                    {description ||
                      "Your NFT description will appear here once you type it."}
                  </p>
                </div>

                <div className="mt-2 flex items-center justify-between text-[10px] text-gray-500">
                  <span>
                    Contract:{" "}
                    {FHENFT_COLLECTION_ADDRESS?.slice(0, 6)}...
                    {FHENFT_COLLECTION_ADDRESS?.slice(-4)}
                  </span>
                  <span>
                    Token ID:{" "}
                    {mintedTokenId ? mintedTokenId : "—"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateNft;
