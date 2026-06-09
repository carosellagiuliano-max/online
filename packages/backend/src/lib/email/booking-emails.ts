// ============================================
// BOOKING EMAIL TEMPLATES
// ============================================

import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { sendEmail } from './send';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://beautifypro.demo';

// ============================================
// BOOKING CONFIRMATION EMAIL
// ============================================

export interface BookingConfirmationData {
  customerName: string;
  customerEmail: string;
  bookingNumber: string;
  appointmentId: string;
  startsAt: Date;
  endsAt: Date;
  staffName: string;
  services: { name: string; durationMinutes: number; priceCents: number }[];
  totalPriceCents: number;
  salonName: string;
  salonAddress: string;
  salonPhone: string;
}

export async function sendBookingConfirmationEmail(data: BookingConfirmationData) {
  console.log('[sendBookingConfirmationEmail] Called for:', data.customerEmail, 'booking:', data.bookingNumber);
  const formatPrice = (cents: number) => `CHF ${(cents / 100).toFixed(2)}`;

  const dateStr = format(data.startsAt, 'EEEE, d. MMMM yyyy', { locale: de });
  const timeStr = `${format(data.startsAt, 'HH:mm')} - ${format(data.endsAt, 'HH:mm')} Uhr`;

  const servicesHtml = data.services
    .map(
      (s) =>
        `<tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e5e5;">${s.name}</td>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e5e5; text-align: right;">${s.durationMinutes} Min.</td>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e5e5; text-align: right;">${formatPrice(s.priceCents)}</td>
        </tr>`
    )
    .join('');

  const html = `
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Buchungsbestätigung</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">

          <!-- Header -->
          <tr>
            <td style="background-color: #1a1a1a; padding: 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">BeautifyPRO</h1>
              <p style="margin: 8px 0 0; color: #a0a0a0; font-size: 14px;">Premium Friseursalon St. Gallen</p>
            </td>
          </tr>

          <!-- Success Banner -->
          <tr>
            <td style="background-color: #22c55e; padding: 20px; text-align: center;">
              <p style="margin: 0; color: #ffffff; font-size: 18px; font-weight: 500;">
                ✓ Buchung bestätigt
              </p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; color: #333; font-size: 16px;">
                Guten Tag ${data.customerName},
              </p>
              <p style="margin: 0 0 30px; color: #666; font-size: 15px; line-height: 1.6;">
                Vielen Dank für Ihre Buchung bei ${data.salonName}. Wir freuen uns auf Ihren Besuch!
              </p>

              <!-- Booking Number -->
              <div style="background-color: #f9f9f9; border-radius: 8px; padding: 20px; margin-bottom: 30px; text-align: center;">
                <p style="margin: 0 0 5px; color: #666; font-size: 13px; text-transform: uppercase;">Buchungsnummer</p>
                <p style="margin: 0; color: #1a1a1a; font-size: 24px; font-weight: 700; letter-spacing: 1px;">${data.bookingNumber}</p>
              </div>

              <!-- Appointment Details -->
              <h2 style="margin: 0 0 20px; color: #1a1a1a; font-size: 18px; font-weight: 600;">Termindetails</h2>

              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 30px;">
                <tr>
                  <td width="30" valign="top" style="padding: 10px 0;">
                    <span style="font-size: 18px;">📅</span>
                  </td>
                  <td style="padding: 10px 0;">
                    <p style="margin: 0; color: #333; font-weight: 500;">${dateStr}</p>
                    <p style="margin: 4px 0 0; color: #666; font-size: 14px;">${timeStr}</p>
                  </td>
                </tr>
                <tr>
                  <td width="30" valign="top" style="padding: 10px 0;">
                    <span style="font-size: 18px;">👤</span>
                  </td>
                  <td style="padding: 10px 0;">
                    <p style="margin: 0; color: #333; font-weight: 500;">${data.staffName}</p>
                    <p style="margin: 4px 0 0; color: #666; font-size: 14px;">Ihr Stylist</p>
                  </td>
                </tr>
                <tr>
                  <td width="30" valign="top" style="padding: 10px 0;">
                    <span style="font-size: 18px;">📍</span>
                  </td>
                  <td style="padding: 10px 0;">
                    <p style="margin: 0; color: #333; font-weight: 500;">${data.salonName}</p>
                    <p style="margin: 4px 0 0; color: #666; font-size: 14px;">${data.salonAddress}</p>
                  </td>
                </tr>
              </table>

              <!-- Services -->
              <h2 style="margin: 0 0 15px; color: #1a1a1a; font-size: 18px; font-weight: 600;">Gebuchte Leistungen</h2>

              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 20px;">
                <thead>
                  <tr>
                    <th style="padding: 10px 0; border-bottom: 2px solid #1a1a1a; text-align: left; font-size: 13px; color: #666;">Leistung</th>
                    <th style="padding: 10px 0; border-bottom: 2px solid #1a1a1a; text-align: right; font-size: 13px; color: #666;">Dauer</th>
                    <th style="padding: 10px 0; border-bottom: 2px solid #1a1a1a; text-align: right; font-size: 13px; color: #666;">Preis</th>
                  </tr>
                </thead>
                <tbody>
                  ${servicesHtml}
                </tbody>
                <tfoot>
                  <tr>
                    <td colspan="2" style="padding: 15px 0 0; font-weight: 600; font-size: 16px;">Gesamtbetrag</td>
                    <td style="padding: 15px 0 0; text-align: right; font-weight: 700; font-size: 18px; color: #1a1a1a;">${formatPrice(data.totalPriceCents)}</td>
                  </tr>
                </tfoot>
              </table>

              <!-- Important Notes -->
              <div style="background-color: #fef3c7; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
                <h3 style="margin: 0 0 10px; color: #92400e; font-size: 14px; font-weight: 600;">Wichtige Hinweise</h3>
                <ul style="margin: 0; padding: 0 0 0 20px; color: #92400e; font-size: 13px; line-height: 1.8;">
                  <li>Bitte erscheinen Sie pünktlich zu Ihrem Termin.</li>
                  <li>Bei Fragen erreichen Sie uns unter ${data.salonPhone}.</li>
                </ul>
              </div>

              <!-- CTA Button -->
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9f9f9; padding: 30px; text-align: center; border-top: 1px solid #e5e5e5;">
              <p style="margin: 0 0 10px; color: #666; font-size: 14px;">
                ${data.salonName} · ${data.salonAddress}
              </p>
              <p style="margin: 0 0 15px; color: #666; font-size: 14px;">
                Tel: ${data.salonPhone}
              </p>
              <p style="margin: 0; color: #999; font-size: 12px;">
                Diese E-Mail wurde automatisch generiert. Bitte antworten Sie nicht auf diese E-Mail.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const text = `
BeautifyPRO - Buchungsbestätigung

Guten Tag ${data.customerName},

Vielen Dank für Ihre Buchung bei ${data.salonName}. Wir freuen uns auf Ihren Besuch!

BUCHUNGSNUMMER: ${data.bookingNumber}

TERMINDETAILS
-------------
Datum: ${dateStr}
Uhrzeit: ${timeStr}
Stylist: ${data.staffName}
Adresse: ${data.salonName}, ${data.salonAddress}

GEBUCHTE LEISTUNGEN
-------------------
${data.services.map((s) => `- ${s.name} (${s.durationMinutes} Min.) - ${formatPrice(s.priceCents)}`).join('\n')}

Gesamtbetrag: ${formatPrice(data.totalPriceCents)}

WICHTIGE HINWEISE
-----------------
- Bitte erscheinen Sie pünktlich zu Ihrem Termin.
- Kostenlose Stornierung bis 24 Stunden vor dem Termin möglich.
- Bei Fragen erreichen Sie uns unter ${data.salonPhone}.

Termin verwalten: ${SITE_URL}/konto/termine

---
${data.salonName}
${data.salonAddress}
Tel: ${data.salonPhone}
  `.trim();

  return sendEmail({
    to: data.customerEmail,
    subject: `Buchungsbestätigung ${data.bookingNumber} - ${data.salonName}`,
    html,
    text,
  });
}

// ============================================
// CANCELLATION EMAIL
// ============================================

export interface CancellationEmailData {
  customerName: string;
  customerEmail: string;
  bookingNumber: string;
  startsAt: Date;
  staffName: string;
  services: { name: string }[];
  salonName: string;
  salonAddress: string;
  salonPhone: string;
  cancelledBy: 'customer' | 'salon';
  reason?: string;
}

export async function sendCancellationEmail(data: CancellationEmailData) {
  const dateStr = format(data.startsAt, 'EEEE, d. MMMM yyyy', { locale: de });
  const timeStr = format(data.startsAt, 'HH:mm');

  const cancelledByText = data.cancelledBy === 'customer'
    ? 'auf Ihren Wunsch'
    : 'durch den Salon';

  const html = `
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Stornierungsbestätigung</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">

          <!-- Header -->
          <tr>
            <td style="background-color: #1a1a1a; padding: 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">BeautifyPRO</h1>
              <p style="margin: 8px 0 0; color: #a0a0a0; font-size: 14px;">Premium Friseursalon St. Gallen</p>
            </td>
          </tr>

          <!-- Cancellation Banner -->
          <tr>
            <td style="background-color: #ef4444; padding: 20px; text-align: center;">
              <p style="margin: 0; color: #ffffff; font-size: 18px; font-weight: 500;">
                Termin storniert
              </p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; color: #333; font-size: 16px;">
                Guten Tag ${data.customerName},
              </p>
              <p style="margin: 0 0 30px; color: #666; font-size: 15px; line-height: 1.6;">
                Ihr Termin wurde ${cancelledByText} storniert.
              </p>

              <!-- Booking Number -->
              <div style="background-color: #fef2f2; border-radius: 8px; padding: 20px; margin-bottom: 30px; text-align: center;">
                <p style="margin: 0 0 5px; color: #666; font-size: 13px; text-transform: uppercase;">Buchungsnummer</p>
                <p style="margin: 0; color: #ef4444; font-size: 24px; font-weight: 700; letter-spacing: 1px; text-decoration: line-through;">${data.bookingNumber}</p>
              </div>

              <!-- Cancelled Appointment Details -->
              <h2 style="margin: 0 0 20px; color: #1a1a1a; font-size: 18px; font-weight: 600;">Stornierter Termin</h2>

              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 30px;">
                <tr>
                  <td width="30" valign="top" style="padding: 10px 0;">
                    <span style="font-size: 18px;">📅</span>
                  </td>
                  <td style="padding: 10px 0;">
                    <p style="margin: 0; color: #666; text-decoration: line-through;">${dateStr} um ${timeStr} Uhr</p>
                  </td>
                </tr>
                <tr>
                  <td width="30" valign="top" style="padding: 10px 0;">
                    <span style="font-size: 18px;">👤</span>
                  </td>
                  <td style="padding: 10px 0;">
                    <p style="margin: 0; color: #666;">${data.staffName}</p>
                  </td>
                </tr>
                <tr>
                  <td width="30" valign="top" style="padding: 10px 0;">
                    <span style="font-size: 18px;">✂️</span>
                  </td>
                  <td style="padding: 10px 0;">
                    <p style="margin: 0; color: #666;">${data.services.map(s => s.name).join(', ')}</p>
                  </td>
                </tr>
              </table>

              ${data.reason ? `
              <div style="background-color: #f9f9f9; border-radius: 8px; padding: 15px; margin-bottom: 30px;">
                <p style="margin: 0 0 5px; color: #666; font-size: 13px; font-weight: 600;">Grund der Stornierung</p>
                <p style="margin: 0; color: #333; font-size: 14px;">${data.reason}</p>
              </div>
              ` : ''}

              <!-- New Booking CTA -->
              <div style="text-align: center; padding-top: 20px;">
                <p style="margin: 0 0 20px; color: #666; font-size: 15px;">
                  Möchten Sie einen neuen Termin buchen?
                </p>
                <a href="${SITE_URL}/termin-buchen" style="display: inline-block; background-color: #1a1a1a; color: #ffffff; text-decoration: none; padding: 14px 30px; border-radius: 6px; font-weight: 500; font-size: 15px;">
                  Neuen Termin buchen
                </a>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9f9f9; padding: 30px; text-align: center; border-top: 1px solid #e5e5e5;">
              <p style="margin: 0 0 10px; color: #666; font-size: 14px;">
                ${data.salonName} · ${data.salonAddress}
              </p>
              <p style="margin: 0 0 15px; color: #666; font-size: 14px;">
                Tel: ${data.salonPhone}
              </p>
              <p style="margin: 0; color: #999; font-size: 12px;">
                Diese E-Mail wurde automatisch generiert.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const text = `
BeautifyPRO - Stornierungsbestätigung

Guten Tag ${data.customerName},

Ihr Termin wurde ${cancelledByText} storniert.

BUCHUNGSNUMMER: ${data.bookingNumber} (storniert)

STORNIERTER TERMIN
------------------
Datum: ${dateStr} um ${timeStr} Uhr
Stylist: ${data.staffName}
Leistungen: ${data.services.map(s => s.name).join(', ')}
${data.reason ? `\nGrund: ${data.reason}` : ''}

Möchten Sie einen neuen Termin buchen?
${SITE_URL}/termin-buchen

---
${data.salonName}
${data.salonAddress}
Tel: ${data.salonPhone}
  `.trim();

  return sendEmail({
    to: data.customerEmail,
    subject: `Stornierung Termin ${data.bookingNumber} - ${data.salonName}`,
    html,
    text,
  });
}

// ============================================
// APPOINTMENT REMINDER EMAIL (24h before)
// ============================================

export interface ReminderEmailData {
  customerName: string;
  customerEmail: string;
  bookingNumber: string;
  startsAt: Date;
  endsAt: Date;
  staffName: string;
  services: { name: string }[];
  salonName: string;
  salonAddress: string;
  salonPhone: string;
}

// ============================================
// APPOINTMENT RESCHEDULED EMAIL
// ============================================

export interface RescheduledEmailData {
  customerName: string;
  customerEmail: string;
  bookingNumber: string;
  oldStartsAt: Date;
  newStartsAt: Date;
  newEndsAt: Date;
  staffName: string;
  services: { name: string }[];
  salonName: string;
  salonAddress: string;
  salonPhone: string;
}

export async function sendAppointmentRescheduledEmail(data: RescheduledEmailData) {
  const oldDateStr = format(data.oldStartsAt, 'EEEE, d. MMMM yyyy', { locale: de });
  const oldTimeStr = format(data.oldStartsAt, 'HH:mm');
  const newDateStr = format(data.newStartsAt, 'EEEE, d. MMMM yyyy', { locale: de });
  const newTimeStr = `${format(data.newStartsAt, 'HH:mm')} - ${format(data.newEndsAt, 'HH:mm')} Uhr`;

  const html = `
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Terminverschiebung</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">

          <!-- Header -->
          <tr>
            <td style="background-color: #1a1a1a; padding: 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">BeautifyPRO</h1>
              <p style="margin: 8px 0 0; color: #a0a0a0; font-size: 14px;">Premium Friseursalon St. Gallen</p>
            </td>
          </tr>

          <!-- Info Banner -->
          <tr>
            <td style="background-color: #f59e0b; padding: 20px; text-align: center;">
              <p style="margin: 0; color: #ffffff; font-size: 18px; font-weight: 500;">
                Termin verschoben
              </p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; color: #333; font-size: 16px;">
                Guten Tag ${data.customerName},
              </p>
              <p style="margin: 0 0 30px; color: #666; font-size: 15px; line-height: 1.6;">
                Ihr Termin bei ${data.salonName} wurde verschoben. Bitte beachten Sie die neuen Termindetails.
              </p>

              <!-- Booking Number -->
              <div style="background-color: #f9f9f9; border-radius: 8px; padding: 20px; margin-bottom: 30px; text-align: center;">
                <p style="margin: 0 0 5px; color: #666; font-size: 13px; text-transform: uppercase;">Buchungsnummer</p>
                <p style="margin: 0; color: #1a1a1a; font-size: 24px; font-weight: 700; letter-spacing: 1px;">${data.bookingNumber}</p>
              </div>

              <!-- Old vs New Time -->
              <div style="background-color: #fef3c7; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding-bottom: 15px;">
                      <p style="margin: 0 0 5px; color: #92400e; font-size: 12px; font-weight: 600; text-transform: uppercase;">Alter Termin</p>
                      <p style="margin: 0; color: #666; font-size: 15px; text-decoration: line-through;">${oldDateStr} um ${oldTimeStr} Uhr</p>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <p style="margin: 0 0 5px; color: #059669; font-size: 12px; font-weight: 600; text-transform: uppercase;">Neuer Termin</p>
                      <p style="margin: 0; color: #059669; font-size: 17px; font-weight: 600;">${newDateStr}</p>
                      <p style="margin: 4px 0 0; color: #059669; font-size: 15px;">${newTimeStr}</p>
                    </td>
                  </tr>
                </table>
              </div>

              <!-- Appointment Details -->
              <h2 style="margin: 0 0 20px; color: #1a1a1a; font-size: 18px; font-weight: 600;">Termindetails</h2>

              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 30px;">
                <tr>
                  <td width="30" valign="top" style="padding: 10px 0;">
                    <span style="font-size: 18px;">👤</span>
                  </td>
                  <td style="padding: 10px 0;">
                    <p style="margin: 0; color: #333; font-weight: 500;">${data.staffName}</p>
                    <p style="margin: 4px 0 0; color: #666; font-size: 14px;">Ihr Stylist</p>
                  </td>
                </tr>
                <tr>
                  <td width="30" valign="top" style="padding: 10px 0;">
                    <span style="font-size: 18px;">✂️</span>
                  </td>
                  <td style="padding: 10px 0;">
                    <p style="margin: 0; color: #333;">${data.services.map(s => s.name).join(', ')}</p>
                  </td>
                </tr>
                <tr>
                  <td width="30" valign="top" style="padding: 10px 0;">
                    <span style="font-size: 18px;">📍</span>
                  </td>
                  <td style="padding: 10px 0;">
                    <p style="margin: 0; color: #333; font-weight: 500;">${data.salonName}</p>
                    <p style="margin: 4px 0 0; color: #666; font-size: 14px;">${data.salonAddress}</p>
                  </td>
                </tr>
              </table>

              <!-- Important Notes -->
              <div style="background-color: #f0fdf4; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
                <h3 style="margin: 0 0 10px; color: #166534; font-size: 14px; font-weight: 600;">Hinweis</h3>
                <p style="margin: 0; color: #166534; font-size: 13px; line-height: 1.6;">
                  Falls Ihnen der neue Termin nicht passt, kontaktieren Sie uns bitte unter ${data.salonPhone}.
                </p>
              </div>

              <!-- CTA Button -->
              <div style="text-align: center;">
                <a href="${SITE_URL}/konto/termine" style="display: inline-block; background-color: #1a1a1a; color: #ffffff; text-decoration: none; padding: 14px 30px; border-radius: 6px; font-weight: 500; font-size: 15px;">
                  Termin verwalten
                </a>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9f9f9; padding: 30px; text-align: center; border-top: 1px solid #e5e5e5;">
              <p style="margin: 0 0 10px; color: #666; font-size: 14px;">
                ${data.salonName} · ${data.salonAddress}
              </p>
              <p style="margin: 0 0 15px; color: #666; font-size: 14px;">
                Tel: ${data.salonPhone}
              </p>
              <p style="margin: 0; color: #999; font-size: 12px;">
                Diese E-Mail wurde automatisch generiert.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const text = `
BeautifyPRO - Terminverschiebung

Guten Tag ${data.customerName},

Ihr Termin bei ${data.salonName} wurde verschoben.

BUCHUNGSNUMMER: ${data.bookingNumber}

TERMINÄNDERUNG
--------------
Alter Termin: ${oldDateStr} um ${oldTimeStr} Uhr
Neuer Termin: ${newDateStr}, ${newTimeStr}

TERMINDETAILS
-------------
Stylist: ${data.staffName}
Leistungen: ${data.services.map(s => s.name).join(', ')}
Adresse: ${data.salonName}, ${data.salonAddress}

Falls Ihnen der neue Termin nicht passt, kontaktieren Sie uns bitte unter ${data.salonPhone}.

Termin verwalten: ${SITE_URL}/konto/termine

---
${data.salonName}
${data.salonAddress}
Tel: ${data.salonPhone}
  `.trim();

  return sendEmail({
    to: data.customerEmail,
    subject: `Terminverschiebung ${data.bookingNumber} - ${data.salonName}`,
    html,
    text,
  });
}

export async function sendReminderEmail(data: ReminderEmailData) {
  const dateStr = format(data.startsAt, 'EEEE, d. MMMM yyyy', { locale: de });
  const timeStr = `${format(data.startsAt, 'HH:mm')} - ${format(data.endsAt, 'HH:mm')} Uhr`;

  const html = `
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Terminerinnerung</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">

          <!-- Header -->
          <tr>
            <td style="background-color: #1a1a1a; padding: 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">BeautifyPRO</h1>
              <p style="margin: 8px 0 0; color: #a0a0a0; font-size: 14px;">Premium Friseursalon St. Gallen</p>
            </td>
          </tr>

          <!-- Reminder Banner -->
          <tr>
            <td style="background-color: #3b82f6; padding: 20px; text-align: center;">
              <p style="margin: 0; color: #ffffff; font-size: 18px; font-weight: 500;">
                ⏰ Terminerinnerung - Morgen
              </p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; color: #333; font-size: 16px;">
                Guten Tag ${data.customerName},
              </p>
              <p style="margin: 0 0 30px; color: #666; font-size: 15px; line-height: 1.6;">
                Wir möchten Sie an Ihren morgigen Termin bei ${data.salonName} erinnern.
              </p>

              <!-- Appointment Details -->
              <div style="background-color: #eff6ff; border-radius: 8px; padding: 25px; margin-bottom: 30px;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td width="30" valign="top" style="padding: 8px 0;">
                      <span style="font-size: 18px;">📅</span>
                    </td>
                    <td style="padding: 8px 0;">
                      <p style="margin: 0; color: #1e40af; font-weight: 600; font-size: 16px;">${dateStr}</p>
                      <p style="margin: 4px 0 0; color: #3b82f6; font-size: 14px;">${timeStr}</p>
                    </td>
                  </tr>
                  <tr>
                    <td width="30" valign="top" style="padding: 8px 0;">
                      <span style="font-size: 18px;">👤</span>
                    </td>
                    <td style="padding: 8px 0;">
                      <p style="margin: 0; color: #333;">${data.staffName}</p>
                    </td>
                  </tr>
                  <tr>
                    <td width="30" valign="top" style="padding: 8px 0;">
                      <span style="font-size: 18px;">✂️</span>
                    </td>
                    <td style="padding: 8px 0;">
                      <p style="margin: 0; color: #333;">${data.services.map(s => s.name).join(', ')}</p>
                    </td>
                  </tr>
                  <tr>
                    <td width="30" valign="top" style="padding: 8px 0;">
                      <span style="font-size: 18px;">📍</span>
                    </td>
                    <td style="padding: 8px 0;">
                      <p style="margin: 0; color: #333;">${data.salonAddress}</p>
                    </td>
                  </tr>
                </table>
              </div>

              <p style="margin: 0 0 30px; color: #666; font-size: 14px; text-align: center;">
                Buchungsnummer: <strong>${data.bookingNumber}</strong>
              </p>

              <!-- CTA -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${SITE_URL}/konto/termine" style="display: inline-block; background-color: #1a1a1a; color: #ffffff; text-decoration: none; padding: 14px 30px; border-radius: 6px; font-weight: 500; font-size: 15px;">
                      Termin verwalten
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9f9f9; padding: 30px; text-align: center; border-top: 1px solid #e5e5e5;">
              <p style="margin: 0 0 10px; color: #666; font-size: 14px;">
                Bei Verhinderung bitten wir um rechtzeitige Absage unter ${data.salonPhone}.
              </p>
              <p style="margin: 0; color: #999; font-size: 12px;">
                Diese E-Mail wurde automatisch generiert.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const text = `
BeautifyPRO - Terminerinnerung

Guten Tag ${data.customerName},

Wir möchten Sie an Ihren morgigen Termin erinnern:

TERMIN
------
Datum: ${dateStr}
Uhrzeit: ${timeStr}
Stylist: ${data.staffName}
Leistungen: ${data.services.map(s => s.name).join(', ')}
Adresse: ${data.salonAddress}

Buchungsnummer: ${data.bookingNumber}

Termin verwalten: ${SITE_URL}/konto/termine

Bei Verhinderung bitten wir um rechtzeitige Absage unter ${data.salonPhone}.

---
${data.salonName}
${data.salonAddress}
  `.trim();

  return sendEmail({
    to: data.customerEmail,
    subject: `Terminerinnerung für morgen - ${data.salonName}`,
    html,
    text,
  });
}
