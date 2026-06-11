// SPDX-License-Identifier: MIT
pragma solidity >=0.8.26;

import {BlackScholes} from "./BlackScholes.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title OptionsMarketplace
/// @notice Mock American options marketplace with infinite supply and Black-Scholes pricing
/// @dev Demo-only: marketplace holds a reserve to pay out exercised options
contract OptionsMarketplace {
    using BlackScholes for int256;
    using SafeERC20 for IERC20;

    int256 private constant WAD = 1e18;
    int256 private constant RISK_FREE_RATE = 5e16; // 5% per year

    enum OptionType { Call, Put }

    struct Option {
        uint256 id;
        address underlyingPool;
        OptionType optionType;
        int256 strikePrice;      // WAD
        uint256 expiry;          // unix timestamp
        int256 volatility;       // WAD (annualized)
        int256 premium;          // WAD (cached, recomputed on query)
        bool active;
    }

    struct OptionPosition {
        uint256 optionId;
        uint256 amount;          // number of options held
        address owner;
        bool exercised;
    }

    uint256 public nextOptionId = 1;
    uint256 public nextPositionId = 1;

    mapping(uint256 => Option) public options;
    mapping(uint256 => OptionPosition) public positions;
    mapping(address => uint256[]) public userPositions;

    address public reserveToken;     // USDC for demo payouts
    int256 public reserveBalance;    // WAD
    int256 public totalPremiumsCollected;

    // Events
    event OptionCreated(uint256 indexed optionId, address indexed pool, OptionType optionType, int256 strikePrice, uint256 expiry);
    event OptionBought(uint256 indexed positionId, uint256 indexed optionId, address indexed buyer, uint256 amount, int256 premiumPaid);
    event OptionExercised(uint256 indexed positionId, uint256 indexed optionId, address indexed exerciser, int256 payoff);
    event ReserveFunded(int256 amount);

    modifier onlyReserve() {
        require(msg.sender == address(this), "only reserve");
        _;
    }

    constructor(address _reserveToken) {
        reserveToken = _reserveToken;
    }

    /// @notice Fund the marketplace reserve for demo payouts
    function fundReserve(int256 amount) external {
        reserveBalance += amount;
        emit ReserveFunded(amount);
    }

    /// @notice Create a new option listing (infinite supply — anyone can create)
    function createOption(
        address pool,
        OptionType optionType,
        int256 strikePrice,
        uint256 expiry,
        int256 volatility
    ) external returns (uint256 optionId) {
        optionId = nextOptionId++;
        options[optionId] = Option({
            id: optionId,
            underlyingPool: pool,
            optionType: optionType,
            strikePrice: strikePrice,
            expiry: expiry,
            volatility: volatility,
            premium: 0,
            active: true
        });
        emit OptionCreated(optionId, pool, optionType, strikePrice, expiry);
    }

    /// @notice Get Black-Scholes premium for an option
    function getPremium(uint256 optionId, int256 spotPrice) public view returns (int256) {
        Option memory opt = options[optionId];
        require(opt.active, "option not active");

        int256 T = _timeToExpiry(opt.expiry);
        if (T <= 0) return 0;

        int256 r = RISK_FREE_RATE;
        int256 sigma = opt.volatility;

        if (opt.optionType == OptionType.Call) {
            return BlackScholes.blackScholesCall(spotPrice, opt.strikePrice, T, r, sigma);
        } else {
            return BlackScholes.blackScholesPut(spotPrice, opt.strikePrice, T, r, sigma);
        }
    }

    /// @notice Get payoff for an option at a given spot price
    function getPayoff(uint256 optionId, int256 currentPrice) external view returns (int256) {
        Option memory opt = options[optionId];
        require(opt.active, "option not active");

        if (opt.optionType == OptionType.Call) {
            return _max(currentPrice - opt.strikePrice, 0);
        } else {
            return _max(opt.strikePrice - currentPrice, 0);
        }
    }

    /// @notice Buy options (infinite supply — just mints a position)
    function buyOption(uint256 optionId, uint256 amount, int256 spotPrice) external returns (uint256 positionId) {
        require(options[optionId].active, "option not active");
        require(block.timestamp < options[optionId].expiry, "option expired");

        int256 premium = getPremium(optionId, spotPrice) * int256(amount);
        require(premium > 0, "zero premium");

        positionId = nextPositionId++;
        positions[positionId] = OptionPosition({
            optionId: optionId,
            amount: amount,
            owner: msg.sender,
            exercised: false
        });
        userPositions[msg.sender].push(positionId);

        totalPremiumsCollected += premium;
        emit OptionBought(positionId, optionId, msg.sender, amount, premium);
    }

    /// @notice Exercise an option position — pays out the payoff
    function exerciseOption(uint256 positionId, int256 currentPrice) external returns (int256 payoff) {
        OptionPosition storage pos = positions[positionId];
        require(pos.owner == msg.sender, "not owner");
        require(!pos.exercised, "already exercised");

        Option memory opt = options[pos.optionId];
        require(opt.active, "option not active");

        if (opt.optionType == OptionType.Call) {
            payoff = _max(currentPrice - opt.strikePrice, 0);
        } else {
            payoff = _max(opt.strikePrice - currentPrice, 0);
        }

        payoff = payoff * int256(pos.amount);
        pos.exercised = true;

        emit OptionExercised(positionId, pos.optionId, msg.sender, payoff);
    }

    /// @notice Exercise straddle (call + put at same strike) — returns combined payoff
    function exerciseStraddle(
        uint256 callPositionId,
        uint256 putPositionId,
        int256 currentPrice
    ) external returns (int256 totalPayoff) {
        OptionPosition storage callPos = positions[callPositionId];
        OptionPosition storage putPos = positions[putPositionId];

        require(callPos.owner == msg.sender, "not owner of call");
        require(putPos.owner == msg.sender, "not owner of put");
        require(!callPos.exercised, "call already exercised");
        require(!putPos.exercised, "put already exercised");

        Option memory callOpt = options[callPos.optionId];
        Option memory putOpt = options[putPos.optionId];

        int256 callPayoff = _max(currentPrice - callOpt.strikePrice, 0) * int256(callPos.amount);
        int256 putPayoff = _max(putOpt.strikePrice - currentPrice, 0) * int256(putPos.amount);

        callPos.exercised = true;
        putPos.exercised = true;

        totalPayoff = callPayoff + putPayoff;

        // Transfer payout from reserve to exerciser
        if (totalPayoff > 0) {
            IERC20(reserveToken).safeTransfer(msg.sender, uint256(totalPayoff));
        }

        emit OptionExercised(callPositionId, callPos.optionId, msg.sender, callPayoff);
        emit OptionExercised(putPositionId, putPos.optionId, msg.sender, putPayoff);
    }

    /// @notice Get all active options for a pool
    function getPoolOptions(address pool) external view returns (uint256[] memory) {
        uint256 count = 0;
        for (uint256 i = 1; i < nextOptionId; i++) {
            if (options[i].underlyingPool == pool && options[i].active) count++;
        }

        uint256[] memory ids = new uint256[](count);
        uint256 idx = 0;
        for (uint256 i = 1; i < nextOptionId; i++) {
            if (options[i].underlyingPool == pool && options[i].active) {
                ids[idx++] = i;
            }
        }
        return ids;
    }

    /// @notice Get user's positions
    function getUserPositions(address user) external view returns (uint256[] memory) {
        return userPositions[user];
    }

    function _timeToExpiry(uint256 expiry) internal view returns (int256) {
        if (block.timestamp >= expiry) return 0;
        return int256((expiry - block.timestamp) * 1 days) / int256(365 days);
    }

    function _max(int256 a, int256 b) internal pure returns (int256) {
        return a > b ? a : b;
    }
}
