// SPDX-License-Identifier: MIT
pragma solidity >=0.8.26;

import {OptionsMarketplace} from "./OptionsMarketplace.sol";
import {BlackScholes} from "./BlackScholes.sol";

/// @title StraddleManager
/// @notice Reads user's SLP positions, computes net exposure, suggests + executes straddles
contract StraddleManager {
    using BlackScholes for int256;

    int256 private constant WAD = 1e18;
    int256 private constant DEFAULT_VOLATILITY = 3e17; // 30% annualized
    int256 private constant DEFAULT_EXPIRY_DAYS = 7;
    int256 private constant RISK_FREE_RATE = 5e16;

    OptionsMarketplace public marketplace;

    struct Exposure {
        address asset;
        int256 netAmount;
        int256 usdValue;
    }

    struct StraddleSuggestion {
        uint256 callOptionId;
        uint256 putOptionId;
        int256 strikePrice;
        int256 totalPremium;
        int256 breakEvenUp;
        int256 breakEvenDown;
        uint256 expiry;
    }

    struct HedgeResult {
        int256 unhedgedIL;
        int256 hedgedIL;
        int256 optionsPayout;
        int256 premiumPaid;
        int256 netImprovement;
    }

    mapping(bytes32 => mapping(address => Exposure[])) public userExposures;

    struct UserHedge {
        uint256 callPositionId;
        uint256 putPositionId;
        int256 strikePrice;
        int256 premiumPaid;
        bool active;
    }

    mapping(address => mapping(bytes32 => UserHedge)) public userHedges;

    event StraddleSuggested(address indexed user, bytes32 indexed poolId, uint256 callOptionId, uint256 putOptionId);
    event HedgeExecuted(address indexed user, bytes32 indexed poolId, int256 unhedgedIL, int256 optionsPayout);
    event HedgeRegistered(address indexed user, bytes32 indexed poolId, uint256 callPositionId, uint256 putPositionId);

    constructor(address _marketplace) {
        marketplace = OptionsMarketplace(_marketplace);
    }

    function analyzeExposure(
        address user,
        bytes32 poolId,
        address[] memory assets,
        int256[] memory amounts,
        int256[] memory usdValues
    ) external returns (Exposure[] memory) {
        require(assets.length == amounts.length, "length mismatch");
        require(assets.length == usdValues.length, "length mismatch");

        Exposure[] memory exposures = new Exposure[](assets.length);
        for (uint256 i = 0; i < assets.length; i++) {
            exposures[i] = Exposure({
                asset: assets[i],
                netAmount: amounts[i],
                usdValue: usdValues[i]
            });
        }
        userExposures[poolId][user] = exposures;
        return exposures;
    }

    function suggestStraddle(
        address user,
        bytes32 poolId,
        int256 spotPrice,
        int256 hedgeRatio
    ) external returns (StraddleSuggestion memory) {
        require(hedgeRatio > 0 && hedgeRatio <= WAD, "invalid hedge ratio");

        uint256 expiry = block.timestamp + uint256(DEFAULT_EXPIRY_DAYS) * 1 days;
        int256 sigma = DEFAULT_VOLATILITY;
        int256 r = RISK_FREE_RATE;
        int256 strike = spotPrice;

        uint256 callId = marketplace.createOption(
            address(0), OptionsMarketplace.OptionType.Call, strike, expiry, sigma
        );
        uint256 putId = marketplace.createOption(
            address(0), OptionsMarketplace.OptionType.Put, strike, expiry, sigma
        );

        int256 callPremium = marketplace.getPremium(callId, spotPrice);
        int256 putPremium = marketplace.getPremium(putId, spotPrice);
        int256 totalPremium = callPremium + putPremium;

        int256 breakEvenUp = strike + totalPremium;
        int256 breakEvenDown = strike - totalPremium;

        emit StraddleSuggested(user, poolId, callId, putId);

        return StraddleSuggestion({
            callOptionId: callId,
            putOptionId: putId,
            strikePrice: strike,
            totalPremium: totalPremium,
            breakEvenUp: breakEvenUp,
            breakEvenDown: breakEvenDown,
            expiry: expiry
        });
    }

    function buyStraddle(
        uint256 callOptionId,
        uint256 putOptionId,
        uint256 amount,
        int256 spotPrice
    ) external returns (uint256 callPositionId, uint256 putPositionId) {
        callPositionId = marketplace.buyOption(callOptionId, amount, spotPrice);
        putPositionId = marketplace.buyOption(putOptionId, amount, spotPrice);
    }

    function exerciseAndSettle(
        uint256 callPositionId,
        uint256 putPositionId,
        int256 currentPrice,
        int256 unhedgedIL,
        int256 premiumPaid
    ) external returns (HedgeResult memory) {
        int256 payout = marketplace.exerciseStraddle(callPositionId, putPositionId, currentPrice);

        int256 hedgedIL = unhedgedIL + payout;
        int256 netImprovement = hedgedIL - unhedgedIL;

        return HedgeResult({
            unhedgedIL: unhedgedIL,
            hedgedIL: hedgedIL,
            optionsPayout: payout,
            premiumPaid: premiumPaid,
            netImprovement: netImprovement
        });
    }

    function exerciseStraddle(
        uint256 callPositionId,
        uint256 putPositionId,
        int256 currentPrice
    ) external returns (int256 totalPayoff) {
        return marketplace.exerciseStraddle(callPositionId, putPositionId, currentPrice);
    }

    /// @notice Called by Aqua0StraddleHook when user removes liquidity.
    ///         Exercises the user's straddle and returns the payout.
    /// @param user The user removing liquidity
    /// @param poolId The pool being removed from (bytes32 form of PoolId)
    /// @param unhedgedIL The computed impermanent loss from removal
    function exerciseHedgeOnWithdraw(
        address user,
        bytes32 poolId,
        int256 unhedgedIL
    ) external returns (int256 payout) {
        UserHedge storage hedge = userHedges[user][poolId];
        require(hedge.active, "no active hedge");

        // Get current price from the marketplace (use strike as proxy)
        int256 currentPrice = hedge.strikePrice;
        payout = marketplace.exerciseStraddle(
            hedge.callPositionId,
            hedge.putPositionId,
            currentPrice
        );

        hedge.active = false;
        emit HedgeExecuted(user, poolId, unhedgedIL, payout);
    }

    /// @notice Register a user's hedge positions for a pool so the hook can exercise on withdraw
    function registerHedge(
        address user,
        bytes32 poolId,
        uint256 callPositionId,
        uint256 putPositionId,
        int256 strikePrice,
        int256 premiumPaid
    ) external {
        userHedges[user][poolId] = UserHedge({
            callPositionId: callPositionId,
            putPositionId: putPositionId,
            strikePrice: strikePrice,
            premiumPaid: premiumPaid,
            active: true
        });
        emit HedgeRegistered(user, poolId, callPositionId, putPositionId);
    }

    function setupDemoStraddle(
        int256 spotPrice,
        uint256 amount
    ) external returns (
        uint256 callOptionId,
        uint256 putOptionId,
        uint256 callPositionId,
        uint256 putPositionId,
        int256 totalPremium
    ) {
        uint256 expiry = block.timestamp + uint256(DEFAULT_EXPIRY_DAYS) * 1 days;

        callOptionId = marketplace.createOption(
            address(0), OptionsMarketplace.OptionType.Call, spotPrice, expiry, DEFAULT_VOLATILITY
        );
        putOptionId = marketplace.createOption(
            address(0), OptionsMarketplace.OptionType.Put, spotPrice, expiry, DEFAULT_VOLATILITY
        );

        int256 callPremium = marketplace.getPremium(callOptionId, spotPrice);
        int256 putPremium = marketplace.getPremium(putOptionId, spotPrice);
        totalPremium = (callPremium + putPremium) * int256(amount);

        callPositionId = marketplace.buyOption(callOptionId, amount, spotPrice);
        putPositionId = marketplace.buyOption(putOptionId, amount, spotPrice);
    }

    /// @notice Setup demo straddle and register it for a specific pool
    function setupDemoStraddleForPool(
        address user,
        bytes32 poolId,
        int256 spotPrice,
        uint256 amount
    ) external returns (
        uint256 callPositionId,
        uint256 putPositionId,
        int256 totalPremium
    ) {
        uint256 expiry = block.timestamp + uint256(DEFAULT_EXPIRY_DAYS) * 1 days;

        uint256 callOptionId = marketplace.createOption(
            address(0), OptionsMarketplace.OptionType.Call, spotPrice, expiry, DEFAULT_VOLATILITY
        );
        uint256 putOptionId = marketplace.createOption(
            address(0), OptionsMarketplace.OptionType.Put, spotPrice, expiry, DEFAULT_VOLATILITY
        );

        int256 callPremium = marketplace.getPremium(callOptionId, spotPrice);
        int256 putPremium = marketplace.getPremium(putOptionId, spotPrice);
        totalPremium = (callPremium + putPremium) * int256(amount);

        callPositionId = marketplace.buyOption(callOptionId, amount, spotPrice);
        putPositionId = marketplace.buyOption(putOptionId, amount, spotPrice);

        userHedges[user][poolId] = UserHedge({
            callPositionId: callPositionId,
            putPositionId: putPositionId,
            strikePrice: spotPrice,
            premiumPaid: totalPremium,
            active: true
        });
        emit HedgeRegistered(user, poolId, callPositionId, putPositionId);
    }
}
