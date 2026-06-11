export function safeParseBigInt(str: string | undefined | null): bigint {
  if (!str) return 0n;
  const cleanStr = String(str).trim();
  const isNegative = cleanStr.startsWith('-');
  const absoluteStr = isNegative ? cleanStr.substring(1) : cleanStr;
  
  let result = 0n;
  if (/^\d+$/.test(absoluteStr)) {
    result = BigInt(absoluteStr);
  } else if (/[eE]/.test(absoluteStr)) {
    const [mantissa, exponent] = absoluteStr.toLowerCase().split('e');
    const exp = parseInt(exponent, 10);
    if (isNaN(exp)) {
      result = 0n;
    } else {
      const dotIndex = mantissa.indexOf('.');
      if (dotIndex === -1) {
        if (exp >= 0) {
          result = BigInt(mantissa + '0'.repeat(exp));
        } else {
          result = BigInt(mantissa) / (10n ** BigInt(-exp));
        }
      } else {
        const integerPart = mantissa.substring(0, dotIndex);
        const fractionalPart = mantissa.substring(dotIndex + 1);
        const fractionalLength = fractionalPart.length;
        const combined = integerPart + fractionalPart;
        const newExp = exp - fractionalLength;
        if (newExp >= 0) {
          result = BigInt(combined + '0'.repeat(newExp));
        } else {
          result = BigInt(combined) / (10n ** BigInt(-newExp));
        }
      }
    }
  } else if (absoluteStr.includes('.')) {
    result = BigInt(Math.floor(Number(absoluteStr)));
  } else {
    try {
      result = BigInt(absoluteStr);
    } catch {
      try {
        result = BigInt(Math.floor(Number(absoluteStr)));
      } catch {
        result = 0n;
      }
    }
  }
  
  return isNegative ? -result : result;
}
