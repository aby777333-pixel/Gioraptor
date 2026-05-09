import Decimal from 'decimal.js';

/** ISO codes the portal supports for client-facing wallets. */
export const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'GBP', 'INR', 'USDT'] as const;
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

/** Symbol shown next to an amount; falls back to the ISO code. */
export function currencySymbol(c: string): string {
  switch (c.toUpperCase()) {
    case 'USD': return '$';
    case 'EUR': return '€';
    case 'GBP': return '£';
    case 'INR': return '₹';
    case 'USDT': return '₮';
    default:    return `${c} `;
  }
}

/**
 * Format a Decimal-safe amount string (or number) with thousands separators
 * and 2 fractional digits. Always uses the canonical Decimal pipeline —
 * no JS Number is ever used for currency arithmetic.
 */
export function formatMoney(amount: Decimal | string | number, currency: string): string {
  const d = amount instanceof Decimal ? amount : new Decimal(amount);
  const [whole, frac] = d.toFixed(2).split('.');
  const wholeWithSep = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${currencySymbol(currency)}${wholeWithSep}${frac ? '.' + frac : ''}`;
}

/** Per-method lower bounds (in account currency). */
export const METHOD_MIN: Record<string, Decimal> = {
  bank_wire: new Decimal('100'),
  card:      new Decimal('50'),
  upi:       new Decimal('500'),
  crypto:    new Decimal('20'),
  local:     new Decimal('20'),
  voucher:   new Decimal('10'),
};

/** Per-method upper bounds (currency-agnostic for v1; tighten per region later). */
export const METHOD_MAX: Record<string, Decimal> = {
  bank_wire: new Decimal('1000000'),
  card:      new Decimal('5000'),
  upi:       new Decimal('500000'),
  crypto:    new Decimal('1000000'),
  local:     new Decimal('100000'),
  voucher:   new Decimal('5000'),
};

/** Per-method fee rate (e.g. 0.018 = 1.8%). */
export const METHOD_FEE_RATE: Record<string, Decimal> = {
  bank_wire: new Decimal('0'),
  card:      new Decimal('0.018'),
  upi:       new Decimal('0'),
  crypto:    new Decimal('0'),
  local:     new Decimal('0.005'),
  voucher:   new Decimal('0'),
};

/**
 * Computes fee + net credited amount for a deposit. All math runs through
 * Decimal — string inputs are coerced once at the boundary.
 */
export function computeDeposit(method: string, amount: string | number) {
  const gross = new Decimal(amount || 0);
  const rate = METHOD_FEE_RATE[method] ?? new Decimal('0');
  const fee = gross.times(rate);
  const net = gross.minus(fee);
  return {
    gross: gross.toFixed(2),
    fee: fee.toFixed(2),
    net: net.toFixed(2),
  };
}
