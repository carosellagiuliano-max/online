import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs/dist/exceljs.min.js';
import { getFinanceData, normalizeFinanceFilters, type FinanceData } from '@/lib/domain/finance';
import { requireExportAdmin } from '../_utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MONEY_FORMAT = '"CHF" #,##0.00;-"CHF" #,##0.00';
const DATE_FORMAT = 'dd.mm.yyyy';
const DATETIME_FORMAT = 'dd.mm.yyyy hh:mm';
const HEADER_FILL = 'FF222222';
const HEADER_FONT = 'FFFFFFFF';
const SECTION_FILL = 'FFE7F0EA';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireExportAdmin();
    if ('response' in auth) return auth.response;

    const params = request.nextUrl.searchParams;
    const data = await getFinanceData(auth.supabase, auth.salonId, normalizeFinanceFilters({
      period: params.get('period') || undefined,
      startDate: params.get('start') || undefined,
      endDate: params.get('end') || undefined,
      source: params.get('source') || undefined,
      paymentState: params.get('state') || undefined,
      paymentMethod: params.get('method') || undefined,
    }));

    const workbook = await buildFinanceWorkbook(data);
    const buffer = await workbook.xlsx.writeBuffer();
    const filename = getExportFilename(data);

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('[FinanceExport] Export failed:', error);
    return NextResponse.json({ error: 'Finanzexport konnte nicht erstellt werden' }, { status: 500 });
  }
}

async function buildFinanceWorkbook(data: FinanceData) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'BeautifyPro Appointr';
  workbook.subject = 'Finanzexport';
  workbook.title = `${data.stats.salonName} Finanzexport`;
  workbook.company = data.stats.salonName;
  workbook.created = new Date();
  workbook.modified = new Date();

  addOverviewSheet(workbook, data);
  addRevenueSheet(workbook, data);
  addPaymentsSheet(workbook, data);
  addOpenItemsSheet(workbook, data);
  addAppointmentsSheet(workbook, data);
  addOrdersSheet(workbook, data);
  addBreakdownSheet(workbook, 'Produkte', data.productBreakdown);
  addBreakdownSheet(workbook, 'Mitarbeiter', data.employeeBreakdown);
  addBreakdownSheet(workbook, 'Kunden', data.customerBreakdown);
  addRefundsSheet(workbook, data);
  addRawDataSheet(workbook, data);
  addNotesSheet(workbook, data);

  workbook.worksheets.forEach((sheet) => {
    sheet.views = [{ state: 'frozen', ySplit: sheet.name === 'Übersicht' || sheet.name === 'Hinweise' ? 0 : 1 }];
  });

  return workbook;
}

function addOverviewSheet(workbook: ExcelJS.Workbook, data: FinanceData) {
  const sheet = workbook.addWorksheet('Übersicht');
  sheet.columns = [
    { header: '', key: 'label', width: 34 },
    { header: '', key: 'value', width: 28 },
    { header: '', key: 'note', width: 54 },
  ];

  const title = isBeautifyPRO(data) ? 'BeautifyPRO Finanzexport' : 'Finanzexport';
  sheet.mergeCells('A1:C1');
  sheet.getCell('A1').value = title;
  sheet.getCell('A1').font = { bold: true, size: 20, color: { argb: 'FF111111' } };
  sheet.getCell('A1').alignment = { vertical: 'middle' };
  sheet.getRow(1).height = 30;

  addInfoRow(sheet, 'Salon', data.stats.salonName);
  addInfoRow(sheet, 'Zeitraum', `${toExcelDate(data.stats.periodStart)} bis ${toExcelDate(data.stats.periodEnd)}`);
  addInfoRow(sheet, 'Exportiert am', new Date(), DATETIME_FORMAT);
  addInfoRow(sheet, 'Währung', data.stats.currency);
  addInfoRow(sheet, 'Quelle', data.filters.source);
  addInfoRow(sheet, 'Zahlungsstatus', data.filters.paymentState);
  addInfoRow(sheet, 'Zahlungsart', data.filters.paymentMethod);

  sheet.addRow([]);
  addSectionTitle(sheet, 'Kennzahlen');
  addCurrencyInfoRow(sheet, 'Bezahlter Umsatz', data.stats.paidRevenueCents);
  addCurrencyInfoRow(sheet, 'Netto nach Rückerstattungen', data.stats.netRevenueCents);
  addCurrencyInfoRow(sheet, 'Offene Beträge', data.stats.openAmountCents);
  addCurrencyInfoRow(sheet, 'Shop-Umsatz', data.stats.shopRevenueCents);
  addCurrencyInfoRow(sheet, 'Terminumsatz', data.stats.appointmentRevenueCents);
  addCurrencyInfoRow(sheet, 'Rückerstattungen', data.stats.totalRefundsCents);
  addInfoRow(sheet, 'Anzahl Zahlungen', data.stats.paymentCount);
  addCurrencyInfoRow(sheet, 'Durchschnittlicher Betrag', data.stats.averagePaymentCents);
  addInfoRow(sheet, 'Wichtigste Zahlungsart', data.paymentMethods[0]?.method || 'Keine Zahlungen');

  sheet.addRow([]);
  addSectionTitle(sheet, 'MwSt');
  addCurrencyInfoRow(sheet, 'Brutto nach Refunds', data.vatSummary.grossCents);
  addCurrencyInfoRow(sheet, 'Netto exkl. MwSt', data.vatSummary.netCents);
  addCurrencyInfoRow(sheet, `MwSt ${data.vatSummary.vatRate}%`, data.vatSummary.vatCents);

  sheet.addRow([]);
  addSectionTitle(sheet, 'Berechnungslogik');
  sheet.addRow(['Bezahlter Umsatz', 'Shop-Zahlungen mit erfolgreichem Status sowie im Admin erfasste Terminzahlungen.', 'Offene Beträge werden nicht als bezahlter Umsatz gezählt.']);
  sheet.addRow(['Refunds', 'Rückerstattungen werden separat ausgewiesen und vom Netto-Umsatz abgezogen.', 'Voll erstattete Shop-Bestellungen zählen nicht doppelt.']);
  sheet.addRow(['MwSt', 'Die MwSt wird aus dem Umsatz nach Refunds als enthaltene Steuer berechnet.', 'Für offizielle Steuerberatung bitte Buchhaltung prüfen lassen.']);

  styleOverview(sheet);
}

function addRevenueSheet(workbook: ExcelJS.Workbook, data: FinanceData) {
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

  data.dailySales.forEach((day) => {
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

  addTotalRow(sheet, ['Summe', '', '', centsToNumber(data.stats.shopRevenueCents), centsToNumber(data.stats.appointmentRevenueCents), centsToNumber(data.stats.totalRefundsCents), centsToNumber(data.stats.netRevenueCents)], [4, 5, 6, 7]);
  finalizeTable(sheet);
}

function addPaymentsSheet(workbook: ExcelJS.Workbook, data: FinanceData) {
  const sheet = workbook.addWorksheet('Zahlungen');
  setupTable(sheet, [
    ['Datum', 20],
    ['Kunde', 24],
    ['Quelle', 14],
    ['Referenz', 18],
    ['Zahlungsart', 18],
    ['Status', 18],
    ['Bruttobetrag', 16],
    ['Rückerstattung', 16],
    ['Netto', 16],
    ['Mitarbeiter', 20],
    ['Notiz', 28],
  ]);

  data.transactions.forEach((payment) => {
    const row = sheet.addRow([
      new Date(payment.date),
      payment.customerName,
      sourceLabel(payment.source),
      payment.reference,
      payment.method,
      payment.status,
      centsToNumber(payment.grossCents),
      centsToNumber(payment.refundCents),
      centsToNumber(payment.netCents),
      payment.staffName || '',
      payment.note || '',
    ]);
    row.getCell(1).numFmt = DATETIME_FORMAT;
    [7, 8, 9].forEach((index) => row.getCell(index).numFmt = MONEY_FORMAT);
  });

  finalizeTable(sheet);
}

function addOpenItemsSheet(workbook: ExcelJS.Workbook, data: FinanceData) {
  const sheet = workbook.addWorksheet('Offene Beträge');
  setupTable(sheet, [
    ['Kunde', 24],
    ['Referenz', 18],
    ['Datum', 20],
    ['Betrag', 16],
    ['Bezahlt', 16],
    ['Offen', 16],
    ['Quelle', 14],
    ['Status', 18],
    ['Kontakt', 28],
  ]);

  data.openItems.forEach((item) => {
    const row = sheet.addRow([
      item.customerName,
      item.reference,
      new Date(item.date),
      centsToNumber(item.totalCents),
      centsToNumber(item.paidCents),
      centsToNumber(item.openCents),
      item.source === 'shop' ? 'Shop' : 'Termin',
      item.status,
      item.customerEmail || item.customerPhone || '',
    ]);
    row.getCell(3).numFmt = DATETIME_FORMAT;
    [4, 5, 6].forEach((index) => row.getCell(index).numFmt = MONEY_FORMAT);
  });

  finalizeTable(sheet);
}

function addAppointmentsSheet(workbook: ExcelJS.Workbook, data: FinanceData) {
  const sheet = workbook.addWorksheet('Termine');
  setupTable(sheet, [
    ['Termin-Datum', 20],
    ['Kunde', 24],
    ['Mitarbeiter', 22],
    ['Referenz', 18],
    ['Status', 18],
    ['Zahlungsstatus', 18],
    ['Betrag', 16],
    ['Bezahlt am', 20],
    ['Zahlungsart', 18],
  ]);

  data.appointmentRows.forEach((appointment) => {
    const row = sheet.addRow([
      new Date(appointment.date),
      appointment.customerName,
      appointment.staffName || '',
      appointment.reference,
      appointment.note || '',
      appointment.status,
      centsToNumber(appointment.grossCents),
      appointment.grossCents > 0 ? new Date(appointment.date) : '',
      appointment.method,
    ]);
    row.getCell(1).numFmt = DATETIME_FORMAT;
    if (appointment.grossCents > 0) row.getCell(8).numFmt = DATETIME_FORMAT;
    row.getCell(7).numFmt = MONEY_FORMAT;
  });

  finalizeTable(sheet);
}

function addOrdersSheet(workbook: ExcelJS.Workbook, data: FinanceData) {
  const sheet = workbook.addWorksheet('Bestellungen');
  setupTable(sheet, [
    ['Bestellnummer', 20],
    ['Datum', 20],
    ['Kunde', 24],
    ['Status', 18],
    ['Zahlungsstatus', 18],
    ['Betrag', 16],
    ['Rückerstattung', 16],
    ['Netto', 16],
    ['Zahlungsart', 18],
  ]);

  data.orderRows.forEach((order) => {
    const row = sheet.addRow([
      order.reference,
      new Date(order.date),
      order.customerName,
      order.note || '',
      order.status,
      centsToNumber(order.grossCents),
      centsToNumber(order.refundCents),
      centsToNumber(order.netCents),
      order.method,
    ]);
    row.getCell(2).numFmt = DATETIME_FORMAT;
    [6, 7, 8].forEach((index) => row.getCell(index).numFmt = MONEY_FORMAT);
  });

  finalizeTable(sheet);
}

function addBreakdownSheet(workbook: ExcelJS.Workbook, name: string, rows: FinanceData['productBreakdown']) {
  const sheet = workbook.addWorksheet(name);
  setupTable(sheet, [
    [name === 'Produkte' ? 'Produkt/Leistung' : name === 'Mitarbeiter' ? 'Mitarbeiter' : 'Kunde', 34],
    ['Anzahl', 12],
    ['Umsatz', 16],
    ['Rückerstattung', 16],
    ['Offen', 16],
    ['Netto', 16],
  ]);

  rows.forEach((item) => {
    const row = sheet.addRow([
      item.label,
      item.count,
      centsToNumber(item.grossCents),
      centsToNumber(item.refundCents),
      centsToNumber(item.openCents),
      centsToNumber(item.netCents),
    ]);
    [3, 4, 5, 6].forEach((index) => row.getCell(index).numFmt = MONEY_FORMAT);
  });

  finalizeTable(sheet);
}

function addRefundsSheet(workbook: ExcelJS.Workbook, data: FinanceData) {
  const sheet = workbook.addWorksheet('Rückerstattungen');
  setupTable(sheet, [
    ['Datum', 20],
    ['Kunde', 24],
    ['Quelle', 14],
    ['Referenz', 18],
    ['Zahlungsart', 18],
    ['Status', 18],
    ['Betrag', 16],
    ['Grund', 32],
  ]);

  data.refunds.forEach((refund) => {
    const row = sheet.addRow([
      new Date(refund.date),
      refund.customerName,
      sourceLabel(refund.source),
      refund.reference,
      refund.method,
      refund.status,
      centsToNumber(refund.amountCents),
      refund.reason || '',
    ]);
    row.getCell(1).numFmt = DATETIME_FORMAT;
    row.getCell(7).numFmt = MONEY_FORMAT;
  });

  finalizeTable(sheet);
}

function addRawDataSheet(workbook: ExcelJS.Workbook, data: FinanceData) {
  const sheet = workbook.addWorksheet('Rohdaten');
  setupTable(sheet, [
    ['Typ', 16],
    ['ID', 38],
    ['Datum', 20],
    ['Kunde', 24],
    ['Quelle', 14],
    ['Referenz', 18],
    ['Status', 18],
    ['Zahlungsart', 18],
    ['Brutto', 16],
    ['Refund', 16],
    ['Netto', 16],
    ['Notiz', 30],
  ]);

  [...data.orderRows, ...data.appointmentRows, ...data.transactions].forEach((row) => {
    const excelRow = sheet.addRow([
      row.source,
      row.id,
      new Date(row.date),
      row.customerName,
      sourceLabel(row.source),
      row.reference,
      row.status,
      row.method,
      centsToNumber(row.grossCents),
      centsToNumber(row.refundCents),
      centsToNumber(row.netCents),
      row.note || '',
    ]);
    excelRow.getCell(3).numFmt = DATETIME_FORMAT;
    [9, 10, 11].forEach((index) => excelRow.getCell(index).numFmt = MONEY_FORMAT);
  });

  finalizeTable(sheet);
}

function addNotesSheet(workbook: ExcelJS.Workbook, data: FinanceData) {
  const sheet = workbook.addWorksheet('Hinweise');
  sheet.columns = [
    { header: 'Bereich', key: 'area', width: 28 },
    { header: 'Hinweis', key: 'note', width: 90 },
  ];
  styleHeader(sheet.getRow(1));
  sheet.addRow(['Zeitraum', `${toExcelDate(data.stats.periodStart)} bis ${toExcelDate(data.stats.periodEnd)}`]);
  sheet.addRow(['Filter', `Quelle: ${data.filters.source}, Zahlungsstatus: ${data.filters.paymentState}, Zahlungsart: ${data.filters.paymentMethod}`]);
  sheet.addRow(['Datenstand', `Exportiert am ${new Date().toLocaleString('de-CH')}`]);
  sheet.addRow(['Umsatz', 'Gezählt werden bezahlte Shop-Bestellungen und im Admin erfasste Terminzahlungen. Offene Beträge werden separat ausgewiesen.']);
  sheet.addRow(['Refunds', 'Rückerstattungen werden separat ausgewiesen und vom Netto-Umsatz abgezogen.']);
  sheet.addRow(['Nicht vorhanden', 'Im aktuellen Schema gibt es keine eigenständigen Rechnungs- oder Belegtabellen. Der Export basiert auf Orders, Appointments, Refunds und daraus abgeleiteten Zahlungsständen.']);
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
        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      };
    });
  });
}

function styleHeader(row: ExcelJS.Row) {
  row.font = { bold: true, color: { argb: HEADER_FONT } };
  row.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: HEADER_FILL },
  };
  row.alignment = { vertical: 'middle' };
}

function addInfoRow(sheet: ExcelJS.Worksheet, label: string, value: string | number | Date, numberFormat?: string) {
  const row = sheet.addRow([label, value]);
  row.getCell(1).font = { bold: true };
  if (numberFormat) row.getCell(2).numFmt = numberFormat;
}

function addCurrencyInfoRow(sheet: ExcelJS.Worksheet, label: string, cents: number) {
  const row = sheet.addRow([label, centsToNumber(cents)]);
  row.getCell(1).font = { bold: true };
  row.getCell(2).numFmt = MONEY_FORMAT;
}

function addSectionTitle(sheet: ExcelJS.Worksheet, title: string) {
  const row = sheet.addRow([title]);
  row.font = { bold: true };
  row.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: SECTION_FILL },
  };
}

function addTotalRow(sheet: ExcelJS.Worksheet, values: Array<string | number>, moneyColumns: number[]) {
  const row = sheet.addRow(values);
  row.font = { bold: true };
  moneyColumns.forEach((index) => row.getCell(index).numFmt = MONEY_FORMAT);
}

function centsToNumber(cents: number) {
  return Math.round(cents) / 100;
}

function sourceLabel(source: string) {
  if (source === 'shop') return 'Shop';
  if (source === 'appointment') return 'Termin';
  return 'Zahlung';
}

function toExcelDate(value: string) {
  return new Intl.DateTimeFormat('de-CH', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value));
}

function getExportFilename(data: FinanceData) {
  const from = data.stats.periodStart.slice(0, 10);
  const to = data.stats.periodEnd.slice(0, 10);
  const prefix = isBeautifyPRO(data) ? 'beauty-finanzen' : 'finanzen-export';
  return `${prefix}-${from}_bis_${to}.xlsx`;
}

function isBeautifyPRO(data: FinanceData) {
  return data.stats.salonName.toLowerCase().includes('beauty');
}

function styleOverview(sheet: ExcelJS.Worksheet) {
  sheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.alignment = { vertical: 'middle', wrapText: true };
      cell.border = {
        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      };
    });
  });
}
