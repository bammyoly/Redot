// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract FHENftCollection is ERC721URIStorage, Ownable {
    uint256 private _nextTokenId;
    mapping(uint256 => string) private _tokenNames;

    event NFTMinted(
        address indexed to,
        uint256 indexed tokenId,
        string name,
        string tokenURI
    );

    constructor() ERC721("FHE Auction NFT", "FHENFT") Ownable(msg.sender) {
        _nextTokenId = 1;
    }

    function mint(string calldata name, string calldata tokenURI)
        external
        returns (uint256 tokenId)
    {
        tokenId = _nextTokenId;
        _nextTokenId++;

        _safeMint(msg.sender, tokenId);
        _setTokenURI(tokenId, tokenURI);
        _tokenNames[tokenId] = name;

        emit NFTMinted(msg.sender, tokenId, name, tokenURI);
    }

    function nextTokenId() external view returns (uint256) {
        return _nextTokenId;
    }

    function getTokenName(uint256 tokenId) external view returns (string memory) {
        // Will revert with "ERC721: invalid token ID" if token doesn't exist
        ownerOf(tokenId);
        return _tokenNames[tokenId];
    }
}
