// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title RobotHuntCollection
/// @notice Minimal on-chain collection registry for ROBOT HUNT.
/// @dev Deploy on Robinhood Chain Testnet (chainId 46630). The game backend
///      proves the Human Challenge off-chain and authorizes claims via a
///      signature check inside `claim` (proof param). Ownership is recorded
///      per player address, so progress follows the wallet.
contract RobotHuntCollection {
    /// cardId (1-based) -> copies owned by a player
    mapping(address => mapping(uint256 => uint256)) public balance;

    /// cardId -> total copies claimed
    mapping(uint256 => uint256) public totalClaimed;

    /// Signs claim proofs for verified challenges
    address public signer;

    address public owner;

    /// 98 robots ship in the MVP dataset; update when the 99th lands.
    uint256 public constant TOTAL_CARDS = 98;

    event Claimed(address indexed player, uint256 indexed cardId, uint256 copies);
    event Burned(address indexed player, uint256 indexed cardId);
    event SignerUpdated(address indexed signer);

    constructor(address _signer) {
        owner = msg.sender;
        signer = _signer;
    }

    function setSigner(address _signer) external {
        require(msg.sender == owner, "only owner");
        signer = _signer;
        emit SignerUpdated(_signer);
    }

    /// @notice Claim one copy of a card. The proof must be a valid signature
    ///         from `signer` over (player, cardId) — minting is NOT open:
    ///         claims only succeed after the server verifies a successful
    ///         Human Challenge.
    function claim(uint256 cardId, bytes calldata proof) external {
        require(cardId >= 1 && cardId <= TOTAL_CARDS, "bad card");
        require(verifyClaimProof(msg.sender, cardId, proof), "bad proof");

        balance[msg.sender][cardId] += 1;
        totalClaimed[cardId] += 1;
        emit Claimed(msg.sender, cardId, balance[msg.sender][cardId]);
    }

    function burn(uint256 cardId) external {
        require(balance[msg.sender][cardId] > 0, "none owned");
        balance[msg.sender][cardId] -= 1;
        emit Burned(msg.sender, cardId);
    }

    /// @notice All card ids (1-based) a player owns at least one copy of.
    function ownedCards(address player) external view returns (uint256[] memory) {
        uint256 count;
        for (uint256 i = 1; i <= TOTAL_CARDS; i++) {
            if (balance[player][i] > 0) count++;
        }
        uint256[] memory ids = new uint256[](count);
        uint256 j;
        for (uint256 i = 1; i <= TOTAL_CARDS; i++) {
            if (balance[player][i] > 0) ids[j++] = i;
        }
        return ids;
    }

    /// @dev EIP-191 signature over keccak256(abi.encodePacked(player, cardId)).
    ///      Add a nonce to the digest before production use.
    function verifyClaimProof(address player, uint256 cardId, bytes calldata proof) internal view returns (bool) {
        bytes32 digest = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n52", player, cardId));
        bytes32 r;
        bytes32 s;
        uint8 v;
        require(proof.length == 65, "bad proof len");
        assembly {
            r := calldataload(proof.offset)
            s := calldataload(add(proof.offset, 32))
            v := byte(0, calldataload(add(proof.offset, 64)))
        }
        if (v < 27) v += 27;
        require(v == 27 || v == 28, "bad v");
        return ecrecover(digest, v, r, s) == signer;
    }
}
