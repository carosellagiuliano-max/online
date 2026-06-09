// ============================================
// Order Email Templates
// ============================================

import { sendEmail, type SendResult } from './send';
import type { Order, OrderItem } from '@/lib/domain/order/types';

// Default salon name fallback (actual name comes from database via callers)
const DEFAULT_SALON_NAME = 'Salon';

// ============================================
// TYPES
// ============================================

interface OrderEmailData {
  order: Order;
  salonName?: string;
  salonAddress?: string;
  salonPhone?: string;
  salonEmail?: string;
  logoUrl?: string;
}

interface VoucherEmailData {
  voucherCode: string;
  amount: number;
  recipientName?: string;
  senderName?: string;
  personalMessage?: string;
  expiresAt: Date;
  salonName: string;
}

// ============================================
// HELPERS
// ============================================

function formatPrice(cents: number): string {
  return new Intl.NumberFormat('de-CH', {
    style: 'currency',
    currency: 'CHF',
  }).format(cents / 100);
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('de-CH', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

function getStatusText(status: string): string {
  const statusMap: Record<string, string> = {
    pending: 'Offen',
    processing: 'In Bearbeitung',
    shipped: 'Versendet',
    completed: 'Abgeschlossen',
    cancelled: 'Storniert',
  };
  return statusMap[status] || status;
}

// ============================================
// BASE LAYOUT
// ============================================

function getEmailLayout(content: string, salonName: string = DEFAULT_SALON_NAME): string {
  return `
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${salonName}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #1a1a1a;
      margin: 0;
      padding: 0;
      background-color: #f5f5f5;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
    }
    .header {
      background-color: #1a1a1a;
      padding: 24px;
      text-align: center;
    }
    .header h1 {
      color: #ffffff;
      margin: 0;
      font-size: 24px;
      font-weight: 600;
      letter-spacing: 2px;
    }
    .content {
      padding: 32px 24px;
    }
    .footer {
      background-color: #f5f5f5;
      padding: 24px;
      text-align: center;
      font-size: 12px;
      color: #666666;
    }
    h2 {
      font-size: 20px;
      margin: 0 0 16px 0;
      color: #1a1a1a;
    }
    p {
      margin: 0 0 16px 0;
    }
    .button {
      display: inline-block;
      background-color: #1a1a1a;
      color: #ffffff !important;
      text-decoration: none;
      padding: 12px 24px;
      border-radius: 4px;
      font-weight: 500;
      margin: 16px 0;
    }
    .order-table {
      width: 100%;
      border-collapse: collapse;
      margin: 16px 0;
    }
    .order-table th,
    .order-table td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid #e5e5e5;
    }
    .order-table th {
      background-color: #f5f5f5;
      font-weight: 600;
    }
    .order-table .amount {
      text-align: right;
    }
    .totals-table {
      width: 100%;
      border-collapse: collapse;
      margin: 16px 0;
    }
    .totals-table td {
      padding: 8px 12px;
    }
    .totals-table .label {
      text-align: right;
      color: #666666;
    }
    .totals-table .value {
      text-align: right;
      width: 100px;
    }
    .totals-table .total-row {
      font-weight: 600;
      font-size: 18px;
      border-top: 2px solid #1a1a1a;
    }
    .info-box {
      background-color: #f5f5f5;
      padding: 16px;
      border-radius: 4px;
      margin: 16px 0;
    }
    .voucher-box {
      background: linear-gradient(135deg, #1a1a1a 0%, #333333 100%);
      color: #ffffff;
      padding: 32px;
      border-radius: 8px;
      text-align: center;
      margin: 24px 0;
    }
    .voucher-code {
      font-family: monospace;
      font-size: 28px;
      letter-spacing: 4px;
      background-color: #ffffff;
      color: #1a1a1a;
      padding: 16px 24px;
      border-radius: 4px;
      margin: 16px 0;
      display: inline-block;
    }
    .voucher-amount {
      font-size: 36px;
      font-weight: bold;
      margin: 16px 0;
    }
    .divider {
      border: none;
      border-top: 1px solid #e5e5e5;
      margin: 24px 0;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${salonName}</h1>
    </div>
    <div class="content">
      ${content}
    </div>
    <div class="footer">
      <p>${salonName}</p>
      <p>Diese E-Mail wurde automatisch generiert. Bitte antworten Sie nicht direkt auf diese E-Mail.</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

// ============================================
// ORDER CONFIRMATION
// ============================================

export async function sendOrderConfirmationEmail(
  data: OrderEmailData
): Promise<SendResult> {
  const { order, salonName = DEFAULT_SALON_NAME } = data;

  const itemsHtml = order.items
    .map(
      (item) => `
      <tr>
        <td>${item.itemName}${item.voucherType ? ' (Gutschein)' : ''}</td>
        <td style="text-align: center;">${item.quantity}</td>
        <td class="amount">${formatPrice(item.totalCents)}</td>
      </tr>
    `
    )
    .join('');

  const shippingAddressHtml = order.shippingAddress
    ? `
      <div class="info-box">
        <strong>Lieferadresse:</strong><br>
        ${order.shippingAddress.name}<br>
        ${order.shippingAddress.street}${order.shippingAddress.street2 ? '<br>' + order.shippingAddress.street2 : ''}<br>
        ${order.shippingAddress.zip} ${order.shippingAddress.city}<br>
        ${order.shippingAddress.country}
      </div>
    `
    : '';

  const content = `
    <h2>Vielen Dank für Ihre Bestellung!</h2>

    <p>Liebe/r ${order.customerName || 'Kunde/Kundin'},</p>

    <p>Ihre Bestellung wurde erfolgreich aufgenommen. Nachfolgend finden Sie eine Übersicht Ihrer Bestellung.</p>

    <div class="info-box">
      <strong>Bestellnummer:</strong> ${order.orderNumber}<br>
      <strong>Datum:</strong> ${formatDate(order.createdAt)}<br>
      <strong>Status:</strong> ${getStatusText(order.status)}
    </div>

    <h3>Bestellübersicht</h3>

    <table class="order-table">
      <thead>
        <tr>
          <th>Artikel</th>
          <th style="text-align: center;">Menge</th>
          <th class="amount">Preis</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
      </tbody>
    </table>

    <table class="totals-table">
      <tr>
        <td class="label">Zwischensumme:</td>
        <td class="value">${formatPrice(order.subtotalCents)}</td>
      </tr>
      ${
        order.discountCents > 0
          ? `
      <tr>
        <td class="label">Rabatt:</td>
        <td class="value">-${formatPrice(order.discountCents)}</td>
      </tr>
      `
          : ''
      }
      ${
        order.voucherDiscountCents > 0
          ? `
      <tr>
        <td class="label">Gutschein:</td>
        <td class="value">-${formatPrice(order.voucherDiscountCents)}</td>
      </tr>
      `
          : ''
      }
      ${
        order.shippingCents > 0
          ? `
      <tr>
        <td class="label">Versand:</td>
        <td class="value">${formatPrice(order.shippingCents)}</td>
      </tr>
      `
          : ''
      }
      <tr class="total-row">
        <td class="label">Gesamtbetrag:</td>
        <td class="value">${formatPrice(order.totalCents)}</td>
      </tr>
    </table>

    <p style="font-size: 12px; color: #666666;">inkl. ${formatPrice(order.taxCents)} MwSt. (8.1%)</p>

    ${shippingAddressHtml}

    <hr class="divider">

    <p>Bei Fragen zu Ihrer Bestellung können Sie uns jederzeit kontaktieren.</p>

    <p>Freundliche Grüsse<br>${salonName}</p>
  `;

  return sendEmail({
    to: order.customerEmail,
    subject: `Bestellbestätigung - ${order.orderNumber}`,
    html: getEmailLayout(content, salonName),
  });
}

// ============================================
// ORDER SHIPPED
// ============================================

export async function sendOrderShippedEmail(
  data: OrderEmailData & { trackingUrl?: string }
): Promise<SendResult> {
  const { order, salonName = DEFAULT_SALON_NAME, trackingUrl } = data;

  const trackingHtml = order.trackingNumber
    ? `
      <div class="info-box">
        <strong>Sendungsnummer:</strong> ${order.trackingNumber}
        ${trackingUrl ? `<br><a href="${trackingUrl}" class="button" style="margin-top: 12px;">Sendung verfolgen</a>` : ''}
      </div>
    `
    : '';

  const content = `
    <h2>Ihre Bestellung wurde versendet!</h2>

    <p>Liebe/r ${order.customerName || 'Kunde/Kundin'},</p>

    <p>Gute Neuigkeiten! Ihre Bestellung <strong>${order.orderNumber}</strong> wurde versendet und ist auf dem Weg zu Ihnen.</p>

    ${trackingHtml}

    <div class="info-box">
      <strong>Lieferadresse:</strong><br>
      ${order.shippingAddress?.name || order.customerName}<br>
      ${order.shippingAddress?.street || ''}<br>
      ${order.shippingAddress?.zip || ''} ${order.shippingAddress?.city || ''}
    </div>

    <p>Die Lieferung erfolgt in der Regel innerhalb von 2-4 Werktagen.</p>

    <hr class="divider">

    <p>Freundliche Grüsse<br>${salonName}</p>
  `;

  return sendEmail({
    to: order.customerEmail,
    subject: `Ihre Bestellung ${order.orderNumber} wurde versendet`,
    html: getEmailLayout(content, salonName),
  });
}

// ============================================
// ORDER CANCELLED
// ============================================

export async function sendOrderCancelledEmail(
  data: OrderEmailData & { reason?: string }
): Promise<SendResult> {
  const { order, salonName = DEFAULT_SALON_NAME, reason } = data;

  const content = `
    <h2>Bestellung storniert</h2>

    <p>Liebe/r ${order.customerName || 'Kunde/Kundin'},</p>

    <p>Ihre Bestellung <strong>${order.orderNumber}</strong> wurde storniert.</p>

    ${reason ? `<p><strong>Grund:</strong> ${reason}</p>` : ''}

    ${
      order.paymentStatus === 'succeeded'
        ? `
      <div class="info-box">
        <strong>Rückerstattung:</strong><br>
        Der bezahlte Betrag von ${formatPrice(order.totalCents)} wird innerhalb von 5-10 Werktagen auf Ihr Zahlungsmittel zurückerstattet.
      </div>
    `
        : ''
    }

    <p>Bei Fragen stehen wir Ihnen gerne zur Verfügung.</p>

    <hr class="divider">

    <p>Freundliche Grüsse<br>${salonName}</p>
  `;

  return sendEmail({
    to: order.customerEmail,
    subject: `Bestellung ${order.orderNumber} storniert`,
    html: getEmailLayout(content, salonName),
  });
}

// ============================================
// VOUCHER EMAIL
// ============================================

export async function sendVoucherEmail(data: VoucherEmailData): Promise<SendResult> {
  const {
    voucherCode,
    amount,
    recipientName,
    senderName,
    personalMessage,
    expiresAt,
    salonName,
  } = data;

  // This email is sent to the recipient
  const content = `
    <h2>Sie haben einen Gutschein erhalten!</h2>

    <p>Liebe/r ${recipientName || 'Beschenkte/r'},</p>

    ${senderName ? `<p>${senderName} hat Ihnen einen Gutschein geschenkt!</p>` : ''}

    ${
      personalMessage
        ? `
      <div class="info-box" style="font-style: italic;">
        "${personalMessage}"
      </div>
    `
        : ''
    }

    <div class="voucher-box">
      <p style="margin: 0; opacity: 0.8;">Gutschein</p>
      <div class="voucher-amount">${formatPrice(amount)}</div>
      <div class="voucher-code">${voucherCode}</div>
      <p style="margin: 0; opacity: 0.8; font-size: 12px;">
        Gültig bis ${formatDate(expiresAt)}
      </p>
    </div>

    <p>So lösen Sie Ihren Gutschein ein:</p>
    <ol>
      <li>Besuchen Sie unser Geschäft oder unseren Online-Shop</li>
      <li>Geben Sie den Gutscheincode bei der Bezahlung an</li>
      <li>Der Wert wird automatisch abgezogen</li>
    </ol>

    <hr class="divider">

    <p>Wir freuen uns auf Ihren Besuch!</p>

    <p>Herzliche Grüsse<br>${salonName}</p>
  `;

  // Note: The recipient email is passed when calling this function
  // This is a template - actual recipient comes from the order item
  return {
    success: false,
    error: 'Recipient email must be provided when calling this function',
  };
}

/**
 * Send voucher to recipient (wrapper with recipient email)
 */
export async function sendVoucherToRecipient(
  recipientEmail: string,
  data: VoucherEmailData
): Promise<SendResult> {
  const content = generateVoucherContent(data);

  return sendEmail({
    to: recipientEmail,
    subject: `Sie haben einen Gutschein erhalten - ${data.salonName}`,
    html: getEmailLayout(content, data.salonName),
  });
}

function generateVoucherContent(data: VoucherEmailData): string {
  const {
    voucherCode,
    amount,
    recipientName,
    senderName,
    personalMessage,
    expiresAt,
    salonName,
  } = data;

  return `
    <h2>Sie haben einen Gutschein erhalten!</h2>

    <p>Liebe/r ${recipientName || 'Beschenkte/r'},</p>

    ${senderName ? `<p>${senderName} hat Ihnen einen Gutschein geschenkt!</p>` : ''}

    ${
      personalMessage
        ? `
      <div class="info-box" style="font-style: italic;">
        "${personalMessage}"
      </div>
    `
        : ''
    }

    <div class="voucher-box">
      <p style="margin: 0; opacity: 0.8;">Gutschein</p>
      <div class="voucher-amount">${formatPrice(amount)}</div>
      <div class="voucher-code">${voucherCode}</div>
      <p style="margin: 0; opacity: 0.8; font-size: 12px;">
        Gültig bis ${formatDate(expiresAt)}
      </p>
    </div>

    <p>So lösen Sie Ihren Gutschein ein:</p>
    <ol>
      <li>Besuchen Sie unser Geschäft oder unseren Online-Shop</li>
      <li>Geben Sie den Gutscheincode bei der Bezahlung an</li>
      <li>Der Wert wird automatisch abgezogen</li>
    </ol>

    <hr class="divider">

    <p>Wir freuen uns auf Ihren Besuch!</p>

    <p>Herzliche Grüsse<br>${salonName}</p>
  `;
}

// ============================================
// PAYMENT FAILED
// ============================================

export async function sendPaymentFailedEmail(
  data: OrderEmailData & { retryUrl?: string }
): Promise<SendResult> {
  const { order, salonName = DEFAULT_SALON_NAME, retryUrl } = data;

  const content = `
    <h2>Zahlung fehlgeschlagen</h2>

    <p>Liebe/r ${order.customerName || 'Kunde/Kundin'},</p>

    <p>Leider konnte die Zahlung für Ihre Bestellung <strong>${order.orderNumber}</strong> nicht verarbeitet werden.</p>

    <div class="info-box">
      <strong>Bestellwert:</strong> ${formatPrice(order.totalCents)}
    </div>

    <p>Bitte versuchen Sie es erneut oder wählen Sie eine andere Zahlungsmethode.</p>

    ${
      retryUrl
        ? `
      <p style="text-align: center;">
        <a href="${retryUrl}" class="button">Zahlung erneut versuchen</a>
      </p>
    `
        : ''
    }

    <p>Falls das Problem weiterhin besteht, kontaktieren Sie uns bitte.</p>

    <hr class="divider">

    <p>Freundliche Grüsse<br>${salonName}</p>
  `;

  return sendEmail({
    to: order.customerEmail,
    subject: `Zahlung fehlgeschlagen - Bestellung ${order.orderNumber}`,
    html: getEmailLayout(content, salonName),
  });
}

// ============================================
// REFUND CONFIRMATION
// ============================================

export async function sendRefundConfirmationEmail(
  data: OrderEmailData & { refundAmount: number; isPartial: boolean }
): Promise<SendResult> {
  const { order, salonName = DEFAULT_SALON_NAME, refundAmount, isPartial } = data;

  const content = `
    <h2>Rückerstattung bestätigt</h2>

    <p>Liebe/r ${order.customerName || 'Kunde/Kundin'},</p>

    <p>Wir haben eine ${isPartial ? 'Teilrückerstattung' : 'Rückerstattung'} für Ihre Bestellung <strong>${order.orderNumber}</strong> veranlasst.</p>

    <div class="info-box">
      <strong>Erstattungsbetrag:</strong> ${formatPrice(refundAmount)}<br>
      ${isPartial ? `<strong>Ursprünglicher Betrag:</strong> ${formatPrice(order.totalCents)}` : ''}
    </div>

    <p>Die Gutschrift wird innerhalb von 5-10 Werktagen auf Ihrem ursprünglichen Zahlungsmittel erscheinen.</p>

    <hr class="divider">

    <p>Bei Fragen stehen wir Ihnen gerne zur Verfügung.</p>

    <p>Freundliche Grüsse<br>${salonName}</p>
  `;

  return sendEmail({
    to: order.customerEmail,
    subject: `Rückerstattung für Bestellung ${order.orderNumber}`,
    html: getEmailLayout(content, salonName),
  });
}
