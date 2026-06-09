// Currency utilities for Swiss Francs (CHF)

const CURRENCY = 'CHF';
const LOCALE = 'de-CH';

// Format amount as CHF currency
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat(LOCALE, {
    style: 'currency',
    currency: CURRENCY,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

// Format amount without currency symbol
export function formatAmount(amount: number): string {
  return new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

// Calculate VAT from gross amount
export function calculateVat(grossAmount: number, vatRate: number): number {
  return grossAmount - grossAmount / (1 + vatRate / 100);
}

// Calculate net amount from gross
export function calculateNetAmount(grossAmount: number, vatRate: number): number {
  return grossAmount / (1 + vatRate / 100);
}

// Calculate gross amount from net
export function calculateGrossAmount(netAmount: number, vatRate: number): number {
  return netAmount * (1 + vatRate / 100);
}

// Round to 5 Rappen (Swiss rounding)
export function roundToFiveRappen(amount: number): number {
  return Math.round(amount * 20) / 20;
}

// Parse currency string to number
export function parseCurrency(value: string): number {
  const cleaned = value.replace(/[^\d.,]/g, '').replace(',', '.');
  return parseFloat(cleaned) || 0;
}

// Format percentage
export function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`;
}
