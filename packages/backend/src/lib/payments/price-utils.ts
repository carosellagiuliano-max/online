// ============================================
// PRICE UTILITIES (provider-agnostic)
// ============================================

/**
 * Formats amount in cents to CHF display format
 */
export function formatChfPrice(amountCents: number): string {
  return new Intl.NumberFormat('de-CH', {
    style: 'currency',
    currency: 'CHF',
  }).format(amountCents / 100);
}

/**
 * Converts CHF to cents
 */
export function chfToCents(chf: number): number {
  return Math.round(chf * 100);
}

/**
 * Converts cents to CHF
 */
export function centsToChf(cents: number): number {
  return cents / 100;
}

/**
 * Calculates Swiss VAT (8.1%)
 */
export function calculateVat(amountCents: number, vatRate: number = 0.081): {
  netCents: number;
  vatCents: number;
  grossCents: number;
} {
  const netCents = Math.round(amountCents / (1 + vatRate));
  const vatCents = amountCents - netCents;

  return {
    netCents,
    vatCents,
    grossCents: amountCents,
  };
}
