// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IMieBunnies {
    function getBunnyId(uint256 _tokenId) external view returns (uint8);
}
