/**
 * Currency helpers. All monetary values are stored as integer minor units
 * (e.g. cents) to avoid floating-point error. The number of minor-unit
 * decimals varies by currency (USD=2, JPY=0, KWD=3).
 */

export type CurrencyMeta = {
  code: string;
  name: string;
  symbol: string;
  decimals: number;
};

// Common ISO 4217 currencies. Frankfurter (our FX source) covers most of the
// 2-decimal ones; others are still usable with a manual exchange rate.
export const CURRENCIES: CurrencyMeta[] = [
  { code: "USD", name: "US Dollar", symbol: "$", decimals: 2 },
  { code: "EUR", name: "Euro", symbol: "€", decimals: 2 },
  { code: "GBP", name: "British Pound", symbol: "£", decimals: 2 },
  { code: "JPY", name: "Japanese Yen", symbol: "¥", decimals: 0 },
  { code: "CHF", name: "Swiss Franc", symbol: "CHF", decimals: 2 },
  { code: "AUD", name: "Australian Dollar", symbol: "A$", decimals: 2 },
  { code: "CAD", name: "Canadian Dollar", symbol: "C$", decimals: 2 },
  { code: "NZD", name: "New Zealand Dollar", symbol: "NZ$", decimals: 2 },
  { code: "SEK", name: "Swedish Krona", symbol: "kr", decimals: 2 },
  { code: "NOK", name: "Norwegian Krone", symbol: "kr", decimals: 2 },
  { code: "DKK", name: "Danish Krone", symbol: "kr", decimals: 2 },
  { code: "PLN", name: "Polish Złoty", symbol: "zł", decimals: 2 },
  { code: "CZK", name: "Czech Koruna", symbol: "Kč", decimals: 2 },
  { code: "HUF", name: "Hungarian Forint", symbol: "Ft", decimals: 2 },
  { code: "RON", name: "Romanian Leu", symbol: "lei", decimals: 2 },
  { code: "BGN", name: "Bulgarian Lev", symbol: "лв", decimals: 2 },
  { code: "TRY", name: "Turkish Lira", symbol: "₺", decimals: 2 },
  { code: "INR", name: "Indian Rupee", symbol: "₹", decimals: 2 },
  { code: "IDR", name: "Indonesian Rupiah", symbol: "Rp", decimals: 2 },
  { code: "THB", name: "Thai Baht", symbol: "฿", decimals: 2 },
  { code: "MYR", name: "Malaysian Ringgit", symbol: "RM", decimals: 2 },
  { code: "PHP", name: "Philippine Peso", symbol: "₱", decimals: 2 },
  { code: "SGD", name: "Singapore Dollar", symbol: "S$", decimals: 2 },
  { code: "HKD", name: "Hong Kong Dollar", symbol: "HK$", decimals: 2 },
  { code: "KRW", name: "South Korean Won", symbol: "₩", decimals: 0 },
  { code: "CNY", name: "Chinese Yuan", symbol: "¥", decimals: 2 },
  { code: "ZAR", name: "South African Rand", symbol: "R", decimals: 2 },
  { code: "MXN", name: "Mexican Peso", symbol: "$", decimals: 2 },
  { code: "BRL", name: "Brazilian Real", symbol: "R$", decimals: 2 },
  { code: "AED", name: "UAE Dirham", symbol: "د.إ", decimals: 2 },
  { code: "ILS", name: "Israeli Shekel", symbol: "₪", decimals: 2 },
  { code: "VND", name: "Vietnamese Dong", symbol: "₫", decimals: 0 },
  { code: "ISK", name: "Icelandic Króna", symbol: "kr", decimals: 0 },
  { code: "KWD", name: "Kuwaiti Dinar", symbol: "KD", decimals: 3 },
  { code: "BHD", name: "Bahraini Dinar", symbol: "BD", decimals: 3 },
];

const CURRENCY_MAP: Record<string, CurrencyMeta> = Object.fromEntries(
  CURRENCIES.map((c) => [c.code, c]),
);

export function isKnownCurrency(code: string): boolean {
  return code in CURRENCY_MAP;
}

export function getCurrency(code: string): CurrencyMeta {
  return (
    CURRENCY_MAP[code] ?? { code, name: code, symbol: code, decimals: 2 }
  );
}

export function currencyDecimals(code: string): number {
  return getCurrency(code).decimals;
}

/**
 * Normalize a user-typed amount so it parses regardless of locale. Mobile
 * numeric keyboards (e.g. iOS in Poland) emit a decimal comma; convert it to a
 * dot so `Number()`/`toMinorUnits` accept it.
 */
export function normalizeDecimalInput(input: string): string {
  return input.replace(",", ".");
}

/**
 * Parse a human-entered amount string (e.g. "12.34") into integer minor units
 * for the given currency. Throws on invalid input.
 */
export function toMinorUnits(input: string | number, code: string): number {
  const decimals = currencyDecimals(code);
  const value =
    typeof input === "number"
      ? input
      : Number(normalizeDecimalInput(input.trim()));
  if (!Number.isFinite(value)) {
    throw new Error(`Invalid amount: ${input}`);
  }
  return Math.round(value * 10 ** decimals);
}

/** Convert integer minor units back to a major-unit number (e.g. 1234 -> 12.34). */
export function toMajorUnits(minor: number, code: string): number {
  const decimals = currencyDecimals(code);
  return minor / 10 ** decimals;
}

/**
 * Format minor units as a localized currency string (e.g. 1234 USD -> "$12.34").
 */
export function formatMoney(minor: number, code: string): string {
  const decimals = currencyDecimals(code);
  const major = toMajorUnits(minor, code);
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: code,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(major);
  } catch {
    // Unknown currency code — fall back to "<code> <amount>".
    const { symbol } = getCurrency(code);
    return `${symbol} ${major.toFixed(decimals)}`;
  }
}

/**
 * Convert an amount in minor units of `from` to minor units of `to` using the
 * given exchange rate (1 unit of `from` = `rate` units of `to`). Handles the
 * decimals difference between currencies (e.g. EUR cents -> JPY whole yen).
 */
export function convertMinorUnits(
  minor: number,
  rate: number,
  from: string,
  to: string,
): number {
  const fromDecimals = currencyDecimals(from);
  const toDecimals = currencyDecimals(to);
  const major = minor / 10 ** fromDecimals;
  const convertedMajor = major * rate;
  return Math.round(convertedMajor * 10 ** toDecimals);
}
