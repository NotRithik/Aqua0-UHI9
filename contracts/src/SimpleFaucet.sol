// SPDX-License-Identifier: MIT
pragma solidity >=0.8.26;

/// @title SimpleFaucet - Transfers tokens from its own balance (no minting needed)
contract SimpleFaucet {
    struct TokenInfo {
        address token;
        string symbol;
        uint256 amountPerClaim;
    }

    TokenInfo[] public tokens;
    mapping(address => uint256) public lastClaim;
    uint256 public constant CLAIM_COOLDOWN = 1 minutes;

    event TokensClaimed(address indexed user, uint256 tokenCount);

    function registerToken(address token, string memory symbol, uint256 amountPerClaim) external {
        tokens.push(TokenInfo({token: token, symbol: symbol, amountPerClaim: amountPerClaim}));
    }

    function claim() external {
        require(block.timestamp >= lastClaim[msg.sender] + CLAIM_COOLDOWN, "Wait 1 minute");

        for (uint256 i = 0; i < tokens.length; i++) {
            TokenInfo storage t = tokens[i];
            if (t.token == address(0)) continue;

            // ERC20 transfer(address,uint256) = 0xa9059cbb
            (bool ok,) = t.token.call(
                abi.encodeWithSignature("transfer(address,uint256)", msg.sender, t.amountPerClaim)
            );
            require(ok, "Transfer failed");
        }

        lastClaim[msg.sender] = block.timestamp;
        emit TokensClaimed(msg.sender, tokens.length);
    }

    function getTokenCount() external view returns (uint256) {
        return tokens.length;
    }

    function getTokens() external view returns (TokenInfo[] memory) {
        return tokens;
    }

    receive() external payable {}
}
