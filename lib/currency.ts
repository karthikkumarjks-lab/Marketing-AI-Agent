// Supported currencies for a client's Company DNA. Keep this list short and
// obvious rather than exhaustive — add more only when a real client needs one.

export interface CurrencyDef {
  code: string;
  symbol: string;
  label: string;
  locale: string;
  // Rough monthly spend below which splitting budget across multiple paid
  // channels stops being viable (too little data per channel to learn from).
  // These are deliberately approximate, currency-native figures — not a
  // live FX conversion — good enough for a "too thin to split" judgment call.
  paidViableThreshold: number;
}

export const CURRENCIES: CurrencyDef[] = [
  { code: "USD", symbol: "$", label: "US Dollar", locale: "en-US", paidViableThreshold: 500 },
  { code: "INR", symbol: "₹", label: "Indian Rupee", locale: "en-IN", paidViableThreshold: 30000 },
  { code: "GBP", symbol: "£", label: "British Pound", locale: "en-GB", paidViableThreshold: 400 },
  { code: "EUR", symbol: "€", label: "Euro", locale: "en-IE", paidViableThreshold: 450 },
  { code: "AUD", symbol: "A$", label: "Australian Dollar", locale: "en-AU", paidViableThreshold: 750 },
  { code: "CAD", symbol: "C$", label: "Canadian Dollar", locale: "en-CA", paidViableThreshold: 700 },
  { code: "SGD", symbol: "S$", label: "Singapore Dollar", locale: "en-SG", paidViableThreshold: 700 },
  { code: "AED", symbol: "د.إ", label: "UAE Dirham", locale: "ar-AE", paidViableThreshold: 1800 },
  { code: "JPY", symbol: "¥", label: "Japanese Yen", locale: "ja-JP", paidViableThreshold: 70000 },
  { code: "CNY", symbol: "¥", label: "Chinese Yuan", locale: "zh-CN", paidViableThreshold: 3500 },
  { code: "CHF", symbol: "Fr.", label: "Swiss Franc", locale: "de-CH", paidViableThreshold: 450 },
  { code: "NZD", symbol: "NZ$", label: "New Zealand Dollar", locale: "en-NZ", paidViableThreshold: 800 },
  { code: "ZAR", symbol: "R", label: "South African Rand", locale: "en-ZA", paidViableThreshold: 9000 },
  { code: "BRL", symbol: "R$", label: "Brazilian Real", locale: "pt-BR", paidViableThreshold: 2500 },
  { code: "MXN", symbol: "MX$", label: "Mexican Peso", locale: "es-MX", paidViableThreshold: 9000 },
  { code: "HKD", symbol: "HK$", label: "Hong Kong Dollar", locale: "en-HK", paidViableThreshold: 4000 },
];

export const DEFAULT_CURRENCY = "USD";

export function getCurrency(code: string | null | undefined): CurrencyDef {
  return CURRENCIES.find((c) => c.code === code) ?? CURRENCIES.find((c) => c.code === DEFAULT_CURRENCY)!;
}

export function formatMoney(amount: number | null | undefined, currencyCode: string | null | undefined): string {
  if (amount == null) return "Not specified";
  const currency = getCurrency(currencyCode);
  return `${currency.symbol}${amount.toLocaleString(currency.locale)}`;
}

export function paidViableThreshold(currencyCode: string | null | undefined): number {
  return getCurrency(currencyCode).paidViableThreshold;
}
