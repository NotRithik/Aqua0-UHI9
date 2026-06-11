// SPDX-License-Identifier: MIT
pragma solidity >=0.8.26;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title MintableToken
/// @notice ERC20 with public mint. Owner can transfer minting rights to a faucet.
contract MintableToken is ERC20 {
    uint8 private _dec;
    address public minter;

    constructor(string memory name, string memory symbol, uint8 dec, uint256 supply, address to) ERC20(name, symbol) {
        _dec = dec;
        minter = msg.sender;
        _mint(to, supply);
    }

    function decimals() public view override returns (uint8) { return _dec; }

    function mint(address to, uint256 amount) external {
        require(msg.sender == minter, "not minter");
        _mint(to, amount);
    }

    function setMinter(address newMinter) external {
        require(msg.sender == minter, "not minter");
        minter = newMinter;
    }
}
