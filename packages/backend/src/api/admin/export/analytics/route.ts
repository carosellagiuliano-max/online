import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs/dist/exceljs.min.js';
import {
  analyticsSourceLabels,
  getAnalyticsData,
  normalizeAnalyticsFilters,
  type AnalyticsData,
} from '@/lib/domain/analytics';
import { requireExportAdmin } from '../_utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MONEY_FORMAT = '"CHF" #,##0.00;-"CHF" #,##0.00';
const DATE_FORMAT = 'dd.mm.yyyy';
const DATETIME_FORMAT = 'dd.mm.yyyy hh:mm';
const PERCENT_FORMAT = '0.0%';
const HEADER_FILL = 'FF222222';
const HEADER_FONT = 'FFFFFFFF';
const SECTION_FILL = 'FFE7F0EA';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireExportAdmin();
    if ('response' in auth) return auth.response;

    const params = request.nextUrl.searchParams;
    const data = await getAnalyticsData(auth.supabase, auth.salonId, normalizeAnalyticsFilters({
      period: params.get('period') || undefined,
      startDate: params.get('start') || undefined,
      endDate: params.get('end') || undefined,
      source: params.get('source') || undefined,
    }));

    const workbook = buildAnalyticsWorkbook(data);
    const buffer = await workbook.xlsx.writeBuffer();
    const filename = getExportFilename(data);

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('[AnalyticsExport] Export failed:', error);
    return NextResponse.json({ error: 'Analytics-Export konnte nicht erstellt werden' }, { status: 500 });
  }
}

function buildAnalyticsWorkbook(data: AnalyticsData) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'BeautifyPro Appointr';
  workbook.subject = 'Analytics Export';
  workbook.title = `${data.salonName} Analytics Export`;
  workbook.company = data.salonName;
  workbook.created = new Date();
  workbook.modified = new Date();

  addOverviewSheet(workbook, data);
  addRevenueSheet(workbook, data);
  addAppointmentsSheet(workbook, data);
  addCustomersSheet(workbook, data);
  addServicesSheet(workbook, data);
  addStaffSheet(workbook, data);
  addShopSheet(workbook, data);
  addRawAppointmentsSheet(workbook, data);
  addRawOrdersSheet(workbook, data);
  addNotesSheet(workbook, data);

  workbook.worksheets.forEach((sheet) => {
    if (sheet.name !== 'Übersicht' && sheet.name !== 'Hinweise') {
      sheet.views = [{ state: 'frozen', ySplit: 1 }];
    }
  });

  return workbook;
}

function addOverviewSheet(workbook: ExcelJS.Workbook, data: AnalyticsData) {
  const sheet = workbook.addWorksheet('Übersicht');
  sheet.columns = [
    { header: '', key: 'label', width: 34 },
    { header: '', key: 'value', width: 28 },
    { header: '', key: 'note', width: 58 },
  ];

  sheet.mergeCells('A1:C1');
  sheet.getCell('A1').value = isBeautifyPRO(data) ? 'BeautifyPRO Analytics Export' : 'Analytics Export';
  sheet.getCell('A1').font = { bold: true, size: 20, color: { argb: 'FF111111' } };
  sheet.getRow(1).height = 30;

  addInfoRow(sheet, 'Salon', data.salonName);
  addInfoRow(sheet, 'Zeitraum', `${toExcelDate(data.periodStart, data.timezone)} bis ${toExcelDate(data.periodEnd, data.timezone)}`);
  addInfoRow(sheet, 'Exportiert am', new Date(), DATETIME_FORMAT);
  addInfoRow(sheet, 'Währung', data.currency);
  addInfoRow(sheet, 'Quelle', analyticsSourceLabels[data.filters.source]);

  sheet.addRow([]);
  addSectionTitle(sheet, 'Kennzahlen');
  addCurrencyInfoRow(sheet, 'Gesamtumsatz bezahlt', data.kpis.totalRevenueCents);
  addCurrencyInfoRow(sheet, 'Netto nach Refunds', data.kpis.netRevenueCents);
  addCurrencyInfoRow(sheet, 'Terminumsatz', data.kpis.appointmentRevenueCents);
  addCurrencyInfoRow(sheet, 'Shop-Umsatz', data.kpis.shopRevenueCents);
  addCurrencyInfoRow(sheet, 'Offene Beträge', data.kpis.openAmountCents);
  addInfoRow(sheet, 'Termine gesamt', data.kpis.totalAppointments);
  addInfoRow(sheet, 'Abgeschlossene Termine', data.kpis.completedAppointments);
  addInfoRow(sheet, 'Stornierte Termine', data.kpis.cancelledAppointments);
  addInfoRow(sheet, 'No-Shows', data.kpis.noShowAppointments);
  addCurrencyInfoRow(sheet, 'Durchschnittlicher Terminwert', data.kpis.averageAppointmentValueCents);
  addInfoRow(sheet, 'Neukunden', data.kpis.newCustomers);
  addInfoRow(sheet, 'Wiederkehrende Kunden', data.kpis.returningCustomers);
  addInfoRow(sheet, 'Top-Leistung', data.topServices[0]?.name || 'Keine Daten');
  addInfoRow(sheet, 'Top-Mitarbeiter', data.topStaff[0]?.name || 'Keine Daten');

  sheet.addRow([]);
  addSectionTitle(sheet, 'Berechnungslogik');
  sheet.addRow(['Umsatz', 'Verwendet dieselbe Umsatzlogik wie /admin/finanzen.', 'Offene Zahlungen werden separat gezeigt und nicht als bezahlter Umsatz gezählt.']);
  sheet.addRow(['Termine', 'Termine werden nach Termin-Datum im Salonzeitraum gezählt.', 'Storniert und No-Show werden nicht als Umsatztreiber interpretiert.']);
  sheet.addRow(['Shop', 'Shop-Umsatz basiert auf bezahlten Bestellungen und berücksichtigt Refunds.', 'Bestellungen sind salonbezogen gefiltert.']);

  styleOverview(sheet);
}

function addRevenueSheet(workbook: ExcelJS.Workbook, data: AnalyticsData) {
  const sheet = workbook.addWorksheet('Umsatz');
  setupTable(sheet, [
    ['Datum', 14],
    ['Bestellungen', 14],
    ['Termine', 12],
    ['Shop-Umsatz', 16],
    ['Termin-Umsatz', 16],
    ['Rückerstattungen', 18],
    ['Netto', 16],
  ]);

  data.dailyRevenue.forEach((day) => {
    const row = sheet.addRow([
      new Date(`${day.date}T12:00:00`),
      day.orderCount,
      day.appointmentCount,
      centsToNumber(day.orderRevenue),
      centsToNumber(day.appointmentRevenue),
      centsToNumber(day.refundAmount),
      centsToNumber(day.totalRevenue),
    ]);
    row.getCell(1).numFmt = DATE_FORMAT;
    [4, 5, 6, 7].forEach((index) => row.getCell(index).numFmt = MONEY_FORMAT);
  });

  addTotalRow(sheet, ['Summe', '', '', centsToNumber(data.kpis.shopRevenueCents), centsToNumber(data.kpis.appointmentRevenueCents), centsToNumber(data.finance.stats.totalRefundsCents), centsToNumber(data.kpis.netRevenueCents)], [4, 5, 6, 7]);
  finalizeTable(sheet);
}

function addAppointmentsSheet(workbook: ExcelJS.Workbook, data: AnalyticsData) {
  const sheet = workbook.addWorksheet('Termine');
  setupTable(sheet, [
    ['Datum', 20],
    ['Kunde', 24],
    ['Mitarbeiter', 22],
    ['Leistung(en)', 34],
    ['Status', 18],
    ['Zahlungsstatus', 18],
    ['Betrag', 16],
    ['Bezahlt', 16],
    ['Quelle', 14],
  ]);

  data.appointmentRows.forEach((appointment) => {
    const row = sheet.addRow([
      new Date(appointment.startTime),
      appointment.customerName,
      appointment.staffName,
      appointment.services,
      appointment.status,
      appointment.paymentStatus,
      centsToNumber(appointment.amountCents),
      centsToNumber(appointment.paidAmountCents),
      appointment.source,
    ]);
    row.getCell(1).numFmt = DATETIME_FORMAT;
    [7, 8].forEach((index) => row.getCell(index).numFmt = MONEY_FORMAT);
  });

  finalizeTable(sheet);
}

function addCustomersSheet(workbook: ExcelJS.Workbook, data: AnalyticsData) {
  const sheet = workbook.addWorksheet('Kunden');
  setupTable(sheet, [
    ['Kunde', 26],
    ['E-Mail', 30],
    ['Telefon', 18],
    ['Termine', 12],
    ['Bestellungen', 14],
    ['Gesamtumsatz', 16],
    ['Letzte Aktivität', 20],
    ['Typ', 16],
  ]);

  data.topCustomers.forEach((customer) => {
    const row = sheet.addRow([
      customer.name,
      customer.email,
      customer.phone,
      customer.appointments,
      customer.orders,
      centsToNumber(customer.revenueCents),
      new Date(customer.lastActivityAt),
      customer.customerType === 'new' ? 'Neukunde' : 'Wiederkehrend',
    ]);
    row.getCell(6).numFmt = MONEY_FORMAT;
    row.getCell(7).numFmt = DATETIME_FORMAT;
  });

  finalizeTable(sheet);
}

function addServicesSheet(workbook: ExcelJS.Workbook, data: AnalyticsData) {
  const sheet = workbook.addWorksheet('Leistungen');
  setupTable(sheet, [
    ['Leistung', 34],
    ['Buchungen', 12],
    ['Umsatz', 16],
    ['Durchschnitt', 16],
    ['Umsatzanteil', 14],
  ]);

  data.topServices.forEach((service) => {
    const row = sheet.addRow([
      service.name,
      service.bookings,
      centsToNumber(service.revenueCents),
      centsToNumber(service.averagePriceCents),
      service.sharePercent / 100,
    ]);
    [3, 4].forEach((index) => row.getCell(index).numFmt = MONEY_FORMAT);
    row.getCell(5).numFmt = PERCENT_FORMAT;
  });

  finalizeTable(sheet);
}

function addStaffSheet(workbook: ExcelJS.Workbook, data: AnalyticsData) {
  const sheet = workbook.addWorksheet('Mitarbeiter');
  setupTable(sheet, [
    ['Mitarbeiter', 26],
    ['Termine', 12],
    ['Abgeschlossen', 14],
    ['Storniert', 12],
    ['No-Shows', 12],
    ['Umsatz', 16],
    ['Ø Terminwert', 16],
  ]);

  data.topStaff.forEach((staff) => {
    const row = sheet.addRow([
      staff.name,
      staff.appointments,
      staff.completedAppointments,
      staff.cancelledAppointments,
      staff.noShowAppointments,
      centsToNumber(staff.revenueCents),
      centsToNumber(staff.averageAppointmentValueCents),
    ]);
    [6, 7].forEach((index) => row.getCell(index).numFmt = MONEY_FORMAT);
  });

  finalizeTable(sheet);
}

function addShopSheet(workbook: ExcelJS.Workbook, data: AnalyticsData) {
  const sheet = workbook.addWorksheet('Shop');
  setupTable(sheet, [
    ['Bestellnummer', 20],
    ['Datum', 20],
    ['Kunde', 24],
    ['Produkte', 42],
    ['Status', 18],
    ['Zahlungsstatus', 18],
    ['Quelle', 14],
    ['Betrag', 16],
    ['Refund', 16],
    ['Netto', 16],
  ]);

  data.orderRows.forEach((order) => {
    const row = sheet.addRow([
      order.orderNumber,
      new Date(order.createdAt),
      order.customerName,
      order.products,
      order.status,
      order.paymentStatus,
      order.source,
      centsToNumber(order.totalCents),
      centsToNumber(order.refundCents),
      centsToNumber(order.netCents),
    ]);
    row.getCell(2).numFmt = DATETIME_FORMAT;
    [8, 9, 10].forEach((index) => row.getCell(index).numFmt = MONEY_FORMAT);
  });

  finalizeTable(sheet);
}

function addRawAppointmentsSheet(workbook: ExcelJS.Workbook, data: AnalyticsData) {
  const sheet = workbook.addWorksheet('Rohdaten Termine');
  setupTable(sheet, [
    ['ID', 38],
    ['Buchungsnummer', 20],
    ['Datum', 20],
    ['Kunde', 24],
    ['Mitarbeiter', 22],
    ['Leistung(en)', 42],
    ['Status', 18],
    ['Zahlungsstatus', 18],
    ['Betrag', 16],
    ['Bezahlt', 16],
    ['Quelle', 14],
  ]);

  data.appointmentRows.forEach((appointment) => {
    const row = sheet.addRow([
      appointment.id,
      appointment.bookingNumber,
      new Date(appointment.startTime),
      appointment.customerName,
      appointment.staffName,
      appointment.services,
      appointment.status,
      appointment.paymentStatus,
      centsToNumber(appointment.amountCents),
      centsToNumber(appointment.paidAmountCents),
      appointment.source,
    ]);
    row.getCell(3).numFmt = DATETIME_FORMAT;
    [9, 10].forEach((index) => row.getCell(index).numFmt = MONEY_FORMAT);
  });

  finalizeTable(sheet);
}

function addRawOrdersSheet(workbook: ExcelJS.Workbook, data: AnalyticsData) {
  const sheet = workbook.addWorksheet('Rohdaten Bestellungen');
  setupTable(sheet, [
    ['ID', 38],
    ['Bestellnummer', 20],
    ['Datum', 20],
    ['Kunde', 24],
    ['Produkte', 42],
    ['Status', 18],
    ['Zahlungsstatus', 18],
    ['Quelle', 14],
    ['Betrag', 16],
    ['Refund', 16],
    ['Netto', 16],
  ]);

  data.orderRows.forEach((order) => {
    const row = sheet.addRow([
      order.id,
      order.orderNumber,
      new Date(order.createdAt),
      order.customerName,
      order.products,
      order.status,
      order.paymentStatus,
      order.source,
      centsToNumber(order.totalCents),
      centsToNumber(order.refundCents),
      centsToNumber(order.netCents),
    ]);
    row.getCell(3).numFmt = DATETIME_FORMAT;
    [9, 10, 11].forEach((index) => row.getCell(index).numFmt = MONEY_FORMAT);
  });

  finalizeTable(sheet);
}

function addNotesSheet(workbook: ExcelJS.Workbook, data: AnalyticsData) {
  const sheet = workbook.addWorksheet('Hinweise');
  sheet.columns = [
    { header: 'Bereich', key: 'area', width: 28 },
    { header: 'Hinweis', key: 'note', width: 92 },
  ];
  styleHeader(sheet.getRow(1));
  sheet.addRow(['Zeitraum', `${toExcelDate(data.periodStart, data.timezone)} bis ${toExcelDate(data.periodEnd, data.timezone)}`]);
  sheet.addRow(['Filter', `Quelle: ${analyticsSourceLabels[data.filters.source]}`]);
  sheet.addRow(['Datenstand', `Exportiert am ${new Date().toLocaleString('de-CH')}`]);
  sheet.addRow(['Umsatz', 'Umsatz wird aus der gemeinsamen Finanzlogik übernommen: bezahlte Shop-Bestellungen und erfasste Terminzahlungen minus Refunds.']);
  sheet.addRow(['Termine', 'Termin-Kennzahlen werden nach Termin-Datum im Salonzeitraum gezählt. Stornierte Termine und No-Shows werden separat ausgewiesen.']);
  sheet.addRow(['Kunden', 'Neukunden basieren auf created_at im Zeitraum; wiederkehrende Kunden sind aktive Kunden mit Aktivität im Zeitraum, die nicht neu sind.']);
  sheet.addRow(['Datenschutz', 'Business-Sheets enthalten Namen und Kontaktdaten nur dort, wo sie für Admin-Auswertungen sinnvoll sind. Rohdaten enthalten technische IDs zur Nachvollziehbarkeit.']);
  finalizeTable(sheet);
}

function setupTable(sheet: ExcelJS.Worksheet, columns: Array<[string, number]>) {
  sheet.columns = columns.map(([header, width], index) => ({
    header,
    key: `col${index}`,
    width,
  }));
  styleHeader(sheet.getRow(1));
}

function finalizeTable(sheet: ExcelJS.Worksheet) {
  const range = sheet.rowCount > 1 ? `A1:${sheet.getColumn(sheet.columnCount).letter}${sheet.rowCount}` : `A1:${sheet.getColumn(sheet.columnCount).letter}1`;
  sheet.autoFilter = range;
  sheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.alignment = { vertical: 'middle', wrapText: true };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      };
    });
  });
}

function styleHeader(row: ExcelJS.Row) {
  row.font = { bold: true, color: { argb: HEADER_FONT } };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
  row.alignment = { vertical: 'middle', wrapText: true };
  row.height = 22;
}

function styleOverview(sheet: ExcelJS.Worksheet) {
  sheet.eachRow((row, rowNumber) => {
    row.eachCell((cell) => {
      cell.alignment = { vertical: 'middle', wrapText: true };
      if (rowNumber > 1 && row.getCell(1).value) {
        row.getCell(1).font = { bold: true };
      }
    });
  });
}

function addInfoRow(sheet: ExcelJS.Worksheet, label: string, value: string | number | Date, numFmt?: string) {
  const row = sheet.addRow([label, value]);
  if (numFmt) row.getCell(2).numFmt = numFmt;
}

function addCurrencyInfoRow(sheet: ExcelJS.Worksheet, label: string, cents: number) {
  const row = sheet.addRow([label, centsToNumber(cents)]);
  row.getCell(2).numFmt = MONEY_FORMAT;
}

function addSectionTitle(sheet: ExcelJS.Worksheet, title: string) {
  const row = sheet.addRow([title]);
  row.font = { bold: true };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SECTION_FILL } };
}

function addTotalRow(sheet: ExcelJS.Worksheet, values: Array<string | number>, moneyColumns: number[]) {
  const row = sheet.addRow(values);
  row.font = { bold: true };
  moneyColumns.forEach((index) => row.getCell(index).numFmt = MONEY_FORMAT);
}

function centsToNumber(cents: number): number {
  return Math.round(cents) / 100;
}

function toExcelDate(value: string, timezone = 'Europe/Zurich'): string {
  return new Intl.DateTimeFormat('de-CH', {
    timeZone: timezone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value));
}

function toDateKey(value: string, timezone = 'Europe/Zurich'): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(value));
  const year = parts.find((part) => part.type === 'year')?.value || '1970';
  const month = parts.find((part) => part.type === 'month')?.value || '01';
  const day = parts.find((part) => part.type === 'day')?.value || '01';
  return `${year}-${month}-${day}`;
}

function getExportFilename(data: AnalyticsData): string {
  const start = toDateKey(data.periodStart, data.timezone);
  const end = toDateKey(data.periodEnd, data.timezone);
  const prefix = isBeautifyPRO(data) ? 'beauty-analytics' : 'analytics-export';
  return `${prefix}-${start}_bis_${end}.xlsx`;
}

function isBeautifyPRO(data: AnalyticsData): boolean {
  return data.salonName.toLowerCase().includes('beauty');
}
