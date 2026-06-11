// SPDX-License-Identifier: MIT
pragma solidity >=0.8.26;

/// @title Faucet
/// @notice Mints test tokens for demo. Each registered token must have mint(address,uint256) callable by this contract.
contract Faucet {
    struct TokenInfo {
        address token;
        string symbol;
        uint256 amountPerClaim;
    }

    TokenInfo[] public tokens;
    mapping(address => uint256) public lastClaim;
    uint256 public constant CLAIM_COOLDOWN = 1 minutes;
    address public owner;

    event TokensClaimed(address indexed user, uint256 tokenCount);

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    function registerToken(address token, string memory symbol, uint256 amountPerClaim) external onlyOwner {
        tokens.push(TokenInfo({token: token, symbol: symbol, amountPerClaim: amountPerClaim}));
    }

    function claim() external {
        require(block.timestamp >= lastClaim[msg.sender] + CLAIM_COOLDOWN, "Wait 1 minute");

        for (uint256 i = 0; i < tokens.length; i++) {
            TokenInfo storage t = tokens[i];
            if (t.token == address(0)) continue;

            (bool ok,) = t.token.call(
                abi.encodeWithSignature("mint(address,uint256)", msg.sender, t.amountPerClaim)
            );
            require(ok, "Mint failed");
        }

        lastClaim[msg.sender] = block.timestamp;
        emit TokensClaimed(msg.sender, tokens.length);
    }

    function getTokens() external view returns (TokenInfo[] memory) {
        return tokens;
    }

    function getTokenCount() external view returns (uint256) {
        return tokens.length;
    }

    receive() external payable {}
}
