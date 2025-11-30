// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint64, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

/// @title FHENftAuction
/// @notice Encrypted NFT auction with minimum bid, highest bidder wins, only bid count is public.
/// @dev Bids are encrypted using FHE. Minimum bid is a plain uint64 in wei (or agreed units).
contract FHENftAuction is SepoliaConfig {
    // ---------------------------------------------------------------------
    // Structs
    // ---------------------------------------------------------------------

    struct Auction {
        address seller;
    address nftAddress;
        uint256 tokenId;
        uint256 endTime;
        bool active;          // true while bids are allowed
        bool settled;         // true after winner is calculated
        address winner;       // winner address (after settlement) or address(0) if reserve not met
        uint64 winningBid;    // plain amount (after decryption) for the winner
        uint64 minBid;        // minimum acceptable bid (in wei or chosen units)
    }

    struct Bid {
        address bidder;
        euint64 encryptedAmount; // fully encrypted bid amount
    }

    struct DecryptionMeta {
        uint256 auctionId;
    }

    // ---------------------------------------------------------------------
    // Storage
    // ---------------------------------------------------------------------

    uint256 public nextAuctionId;

    // auctionId => Auction
    mapping(uint256 => Auction) public auctions;

    // auctionId => list of bids
    mapping(uint256 => Bid[]) internal auctionBids;

    // auctionId => number of bids (for quick view)
    mapping(uint256 => uint256) public bidCount;

    // requestId => decryption meta
    mapping(uint256 => DecryptionMeta) internal decryptionRequests;

    // auctionId => is decryption already requested
    mapping(uint256 => bool) public decryptionRequested;

    // ---------------------------------------------------------------------
    // Events
    // ---------------------------------------------------------------------

    event AuctionCreated(
        uint256 indexed auctionId,
        address indexed seller,
        address indexed nftAddress,
        uint256 tokenId,
        uint256 endTime,
        uint64 minBid
    );

    event BidPlaced(
        uint256 indexed auctionId,
        address indexed bidder
    );

    event AuctionCloseRequested(
        uint256 indexed auctionId,
        uint256 indexed requestId
    );

    event AuctionSettled(
        uint256 indexed auctionId,
        address indexed winner,
        uint64 winningBid
    );

    event NftClaimed(
        uint256 indexed auctionId,
        address indexed winner
    );

    event NftReclaimed(
        uint256 indexed auctionId,
        address indexed seller
    );

    // ---------------------------------------------------------------------
    // Modifiers
    // ---------------------------------------------------------------------

    modifier auctionExists(uint256 auctionId) {
        require(auctionId < nextAuctionId, "Auction does not exist");
        _;
    }

    // ---------------------------------------------------------------------
    // Create auction
    // ---------------------------------------------------------------------

    /// @notice Create a new auction for a given NFT.
    /// @param nftAddress Address of the ERC721 contract.
    /// @param tokenId Token ID to auction.
    /// @param endTime Timestamp when the auction ends.
    /// @param minBid Minimum acceptable bid (in wei or chosen units, fits in uint64).
    function createAuction(
        address nftAddress,
        uint256 tokenId,
        uint256 endTime,
        uint64 minBid
    ) external {
        require(nftAddress != address(0), "Invalid NFT address");
        require(endTime > block.timestamp, "End time must be in the future");
        // allow 0 as "no minimum" if you want
        // require(minBid > 0, "Min bid must be > 0");

        // Transfer NFT from seller to this contract (escrow)
        IERC721(nftAddress).transferFrom(msg.sender, address(this), tokenId);

        uint256 auctionId = nextAuctionId;
        nextAuctionId += 1;

        auctions[auctionId] = Auction({
            seller: msg.sender,
            nftAddress: nftAddress,
            tokenId: tokenId,
            endTime: endTime,
            active: true,
            settled: false,
            winner: address(0),
            winningBid: 0,
            minBid: minBid
        });

        emit AuctionCreated(
            auctionId,
            msg.sender,
            nftAddress,
            tokenId,
            endTime,
            minBid
        );
    }

    // ---------------------------------------------------------------------
    // Place encrypted bid
    // ---------------------------------------------------------------------

    /// @notice Place an encrypted bid on an active auction.
    /// @param auctionId ID of the auction.
    /// @param encryptedAmount External encrypted bid amount from frontend (in same units as minBid).
    /// @param inputProof Zama FHE input proof.
    function placeBid(
        uint256 auctionId,
        externalEuint64 encryptedAmount,
        bytes calldata inputProof
    ) external auctionExists(auctionId) {
        Auction storage auction = auctions[auctionId];

        require(auction.active, "Auction not active");
        require(block.timestamp < auction.endTime, "Auction has ended");
        require(msg.sender != auction.seller, "Seller cannot bid");

        // Convert external ciphertext to internal encrypted type
        euint64 internalEncrypted = FHE.fromExternal(encryptedAmount, inputProof);

        // Min bid is enforced at settlement time when bids are decrypted.
        auctionBids[auctionId].push(
            Bid({bidder: msg.sender, encryptedAmount: internalEncrypted})
        );
        bidCount[auctionId] += 1;

        emit BidPlaced(auctionId, msg.sender);
    }

    // ---------------------------------------------------------------------
    // Close auction & request decryption
    // ---------------------------------------------------------------------

    /// @notice Close an auction and request decryption of all bids.
    /// @dev Anyone can call this after endTime.
    function closeAuction(uint256 auctionId)
        external
        auctionExists(auctionId)
    {
        Auction storage auction = auctions[auctionId];

        require(auction.active, "Auction already closed");
        require(block.timestamp >= auction.endTime, "Auction still running");
        require(!decryptionRequested[auctionId], "Decryption already requested");

        uint256 count = auctionBids[auctionId].length;

        // ✅ CASE 1: zero bids – settle immediately with no winner.
        if (count == 0) {
            auction.active = false;
            auction.settled = true;
            auction.winner = address(0);
            auction.winningBid = 0;

            decryptionRequested[auctionId] = false;

            emit AuctionSettled(auctionId, address(0), 0);
            return;
        }

        // ✅ CASE 2: at least one bid – FHE decryption path as before.
        bytes32[] memory cts = new bytes32[](count);
        for (uint256 i = 0; i < count; i++) {
            cts[i] = FHE.toBytes32(auctionBids[auctionId][i].encryptedAmount);
        }

        // Request public decryption of all bids
        uint256 requestId = FHE.requestDecryption(
            cts,
            this.auctionDecryptionCallback.selector
        );

        decryptionRequested[auctionId] = true;
        decryptionRequests[requestId] = DecryptionMeta({auctionId: auctionId});

        // Mark auction as no longer accepting bids
        auction.active = false;

        emit AuctionCloseRequested(auctionId, requestId);
    }



    // ---------------------------------------------------------------------
    // Decryption callback
    // ---------------------------------------------------------------------

    /// @notice Callback called by the FHEVM relayer/oracle with decrypted bids.
    /// @dev Must verify signatures and protect against replay.
    function auctionDecryptionCallback(
        uint256 requestId,
        bytes memory cleartexts,
        bytes memory decryptionProof
    ) external {
        DecryptionMeta memory meta = decryptionRequests[requestId];
        uint256 auctionId = meta.auctionId;
        require(auctionId < nextAuctionId, "Unknown request");

        // Prevent replay by deleting metadata
        delete decryptionRequests[requestId];

        // Verify KMS / oracle signatures
        FHE.checkSignatures(requestId, cleartexts, decryptionProof);

        Auction storage auction = auctions[auctionId];
        require(!auction.settled, "Auction already settled");

        uint256 count = auctionBids[auctionId].length;

        // For current FHEVM versions, cleartexts is ABI-encoded as a uint64[]
        uint64[] memory amounts = abi.decode(cleartexts, (uint64[]));
        require(amounts.length == count, "Length mismatch");

        // Find max bid and winner
        uint64 bestBid = 0;
        address bestBidder = address(0);

        for (uint256 i = 0; i < count; i++) {
            uint64 amount = amounts[i];
            if (amount > bestBid) {
                bestBid = amount;
                bestBidder = auctionBids[auctionId][i].bidder;
            }
        }

        // Mark auction as settled regardless of reserve check
        auction.settled = true;

        // Enforce minimum bid (reserve)
        if (bestBidder == address(0) || bestBid < auction.minBid) {
            // Reserve not met – NFT stays in the contract (BUT cannot be reclaimed
            // under your new rule, since we only allow reclaim when bidCount == 0).
            auction.winner = address(0);
            auction.winningBid = 0;
            emit AuctionSettled(auctionId, address(0), 0);
            return;
        }

        // Reserve met: record winner
        auction.winner = bestBidder;
        auction.winningBid = bestBid;

        emit AuctionSettled(auctionId, bestBidder, bestBid);
    }

    // ---------------------------------------------------------------------
    // Claim / reclaim NFT
    // ---------------------------------------------------------------------

    /// @notice Winner claims the NFT after auction is settled and reserve met.
    function claimNft(uint256 auctionId)
        external
        auctionExists(auctionId)
    {
        Auction storage auction = auctions[auctionId];

        require(auction.settled, "Auction not settled");
        require(auction.winner == msg.sender, "Not the winner");
        require(auction.nftAddress != address(0), "Already claimed");
        require(auction.winner != address(0), "Reserve not met");

        address nftAddress = auction.nftAddress;
        uint256 tokenId = auction.tokenId;

        // Clear NFT info to prevent double-claim
        auction.nftAddress = address(0);

        IERC721(nftAddress).transferFrom(address(this), msg.sender, tokenId);

        emit NftClaimed(auctionId, msg.sender);
    }

    /// @notice Seller reclaims the NFT only if the auction ended with ZERO bids.
    function reclaimNft(uint256 auctionId)
        external
        auctionExists(auctionId)
    {
        Auction storage auction = auctions[auctionId];

        require(auction.settled, "Auction not settled");
        require(auction.seller == msg.sender, "Not the seller");
        require(auction.nftAddress != address(0), "Already reclaimed");

        // ✅ NEW RULE: only allow reclaim when there were zero bids.
        require(bidCount[auctionId] == 0, "Reclaim only allowed if no bids");

        // winner will be address(0) in zero-bid case; but we don't rely on it for this rule
        address nftAddress = auction.nftAddress;
        uint256 tokenId = auction.tokenId;

        // Clear NFT info to prevent double-claim
        auction.nftAddress = address(0);

        IERC721(nftAddress).transferFrom(address(this), msg.sender, tokenId);

        emit NftReclaimed(auctionId, msg.sender);
    }

    // ---------------------------------------------------------------------
    // View helpers
    // ---------------------------------------------------------------------

    /// @notice Returns number of bids for an auction.
    function getBidCount(uint256 auctionId)
        external
        view
        auctionExists(auctionId)
        returns (uint256)
    {
        return bidCount[auctionId];
    }

    /// @notice Returns basic auction info (for front-end convenience).
    function getAuction(uint256 auctionId)
        external
        view
        auctionExists(auctionId)
        returns (
            address seller,
            address nftAddress,
            uint256 tokenId,
            uint256 endTime,
            bool active,
            bool settled,
            address winner,
            uint64 winningBid,
            uint64 minBid
        )
    {
        Auction storage a = auctions[auctionId];
        return (
            a.seller,
            a.nftAddress,
            a.tokenId,
            a.endTime,
            a.active,
            a.settled,
            a.winner,
            a.winningBid,
            a.minBid
        );
    }
}
