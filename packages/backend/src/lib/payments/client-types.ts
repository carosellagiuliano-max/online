'use client';

// ============================================
// PAYMENT CLIENT PROVIDER - Generic Interface
// ============================================

export interface RedirectResult {
  error?: string;
}

export interface PaymentClientProvider {
  redirectToCheckout(sessionId: string): Promise<RedirectResult>;
  getElementsAppearance(): Record<string, unknown>;
  getPaymentElementOptions(): Record<string, unknown>;
}
