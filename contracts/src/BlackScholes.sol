// SPDX-License-Identifier: MIT
pragma solidity >=0.8.26;

/// @title BlackScholes
/// @notice Black-Scholes options pricing in Solidity using WAD (1e18) fixed-point math
/// @dev T = time to expiry in DAYS (plain int), S/K = prices in WAD, r/sigma = fractions in WAD
library BlackScholes {
    int256 private constant WAD = 1e18;
    int256 private constant LN100 = 4605170185988091368;
    int256 private constant INV_SQRT_2PI = 398942280401432678;

    function blackScholesCall(
        int256 S, int256 K, int256 T, int256 r, int256 sigma
    ) internal pure returns (int256 price) {
        if (T <= 0 || S <= 0 || K <= 0) return 0;

        int256 T_wad = T * WAD / 365;
        int256 sqrtT = _sqrt(T_wad);
        int256 sigmaSqrtT = sigma * sqrtT / WAD;

        int256 d1num = _log(S * WAD / K) + (r + sigma * sigma / (2 * WAD)) * T_wad / WAD;
        int256 d1 = d1num * WAD / sigmaSqrtT;
        int256 d2 = d1 - sigmaSqrtT;

        int256 discount = _exp(-r * T_wad / WAD);
        price = S * _normCdf(d1) / WAD - K * _normCdf(d2) / WAD * discount / WAD;
        if (price < 0) price = 0;
    }

    function blackScholesPut(
        int256 S, int256 K, int256 T, int256 r, int256 sigma
    ) internal pure returns (int256 price) {
        if (T <= 0 || K <= 0) return 0;
        if (S <= 0) return K;

        int256 T_wad = T * WAD / 365;
        int256 sqrtT = _sqrt(T_wad);
        int256 sigmaSqrtT = sigma * sqrtT / WAD;

        int256 d1num = _log(S * WAD / K) + (r + sigma * sigma / (2 * WAD)) * T_wad / WAD;
        int256 d1 = d1num * WAD / sigmaSqrtT;
        int256 d2 = d1 - sigmaSqrtT;

        int256 discount = _exp(-r * T_wad / WAD);
        price = K * _normCdf(-d2) / WAD * discount / WAD - S * _normCdf(-d1) / WAD;
        if (price < 0) price = 0;
    }

    function straddlePrice(
        int256 S, int256 K, int256 T, int256 r, int256 sigma
    ) internal pure returns (int256) {
        return blackScholesCall(S, K, T, r, sigma) + blackScholesPut(S, K, T, r, sigma);
    }

    function straddlePayoff(int256 S, int256 K) internal pure returns (int256) {
        int256 callPayoff = S > K ? S - K : int256(0);
        int256 putPayoff = K > S ? K - S : int256(0);
        return callPayoff + putPayoff;
    }

    function _normCdf(int256 x) internal pure returns (int256) {
        bool neg = x < 0;
        if (neg) x = -x;

        int256 t = WAD * WAD / (WAD + x * 231641900000000000 / WAD);
        int256 t2 = t * t / WAD;
        int256 t3 = t2 * t / WAD;
        int256 t4 = t3 * t / WAD;
        int256 t5 = t4 * t / WAD;

        int256 poly = 319381530000000000 * t / WAD;
        poly = poly - 356563782000000000 * t2 / WAD;
        poly = poly + 1781477937000000000 * t3 / WAD;
        poly = poly - 1821255978000000000 * t4 / WAD;
        poly = poly + 1330274429000000000 * t5 / WAD;

        int256 x2over2 = x * x / WAD / 2;
        int256 gaussian = INV_SQRT_2PI * _exp(-x2over2) / WAD;

        int256 cdf = WAD - gaussian * poly / WAD;
        if (neg) cdf = WAD - cdf;
        return cdf;
    }

    function _log(int256 x) internal pure returns (int256) {
        require(x > 0, "BS: log(0)");
        if (x < WAD) return -_log(WAD * WAD / x);

        int256 r = 0;
        int256 v = x;
        while (v >= 100 * WAD) {
            v = v / 100;
            r += LN100;
        }

        int256 y = (v - WAD) * WAD / (v + WAD);
        int256 y2 = y * y / WAD;
        int256 term = y;
        int256 sum = term;
        term = term * y2 / WAD; sum += term / 3;
        term = term * y2 / WAD; sum += term / 5;
        term = term * y2 / WAD; sum += term / 7;
        term = term * y2 / WAD; sum += term / 9;
        term = term * y2 / WAD; sum += term / 11;

        return r + 2 * sum;
    }

    function _exp(int256 x) internal pure returns (int256) {
        if (x < -42e18) return 0;
        if (x > 130e18) return type(int256).max;

        bool neg = x < 0;
        if (neg) x = -x;

        int256 LN2 = 693147180559945309;
        int256 q = x / LN2;
        int256 rem = x - q * LN2;

        int256 e = WAD;
        int256 term = WAD;
        for (int256 i = 1; i <= 20; i++) {
            term = term * rem / (i * WAD);
            e += term;
        }

        for (int256 i = 0; i < q; i++) e *= 2;

        if (neg) e = WAD * WAD / e;
        return e;
    }

    function _sqrt(int256 x) internal pure returns (int256) {
        if (x <= 0) return 0;
        int256 raw = x * WAD;
        int256 z = (raw + 1) / 2;
        int256 y = raw;
        while (z < y) {
            y = z;
            z = (raw / z + z) / 2;
        }
        return y;
    }
}
