import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { ReportData } from '@/lib/reportGenerators';

import { drawLabeledLineField } from '@/lib/pdf/pdfFields';
import { getThemeRgb, type Rgb } from '@/lib/pdf/pdfTheme';

export const isDailyPrecautionListReport = (report: ReportData) => {
  const title = (report.title || '').toUpperCase();
  const headers = (report.headers || []).map((h) => h.toUpperCase());
  return (
    title.includes('PRECAUTIONS') ||
    title.includes('ISOLATION')
  ) &&
    headers.length === 5 &&
    headers[0].includes('RM') &&
    headers[1].includes("RESIDENT") &&
    headers[3].includes('INFECT') &&
    headers[4].includes('DURATION');
};

export const buildDailyPrecautionListPdf = (params: { report: ReportData; facility: string }) => {
  const { report, facility } = params;
  const doc = new jsPDF({ unit: 'pt', format: 'letter', orientation: 'portrait' });

  // Fill Letter page better: use pt-based sizing (1 pt = 1/72 in). No px→pt shrink.
  const FONT = {
    facility: 16, // larger so facility name is prominent
    title: 14,
    filters: 11,
    table: 11,
    footer: 11,
    disclaimer: 9,
  };

  const pageWidth = doc.internal.pageSize.getWidth(); // 612 pt
  const pageHeight = doc.internal.pageSize.getHeight(); // 792 pt
  const margin = 40; // 0.56 in

  const warningRgb = getThemeRgb('--warning', [251, 191, 36]);
  const black: Rgb = [0, 0, 0];

  // Header
  let y = 50;
  doc.setTextColor(...black);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(FONT.facility);
  doc.text(facility, pageWidth / 2, y, { align: 'center' });

  y += 18;
  doc.setFontSize(FONT.title);
  doc.text(report.title, pageWidth / 2, y, { align: 'center' });

  // Filters row (UNIT / DATE / SHIFT) — positioned after title
  doc.setFontSize(FONT.filters);
  const yFilters = y + 20;
  const blockGap = 18;
  const unitBlock = 170;
  const dateBlock = 190;
  const shiftBlock = 140;
  const total = unitBlock + dateBlock + shiftBlock + blockGap * 2;
  const startX = (pageWidth - total) / 2;

  drawLabeledLineField(doc, {
    x: startX,
    y: yFilters,
    width: unitBlock,
    label: 'UNIT:',
    value: report.filters.unit || '',
  });
  drawLabeledLineField(doc, {
    x: startX + unitBlock + blockGap,
    y: yFilters,
    width: dateBlock,
    label: 'DATE:',
    value: report.filters.date || '',
  });
  drawLabeledLineField(doc, {
    x: startX + unitBlock + blockGap + dateBlock + blockGap,
    y: yFilters,
    width: shiftBlock,
    label: 'SHIFT:',
    value: report.filters.shift && report.filters.shift !== '—' ? report.filters.shift : '',
  });

  // Table (strict column order + widths)
  const baseWidths = [60, 220, 180, 140, 140];
  const baseTotal = baseWidths.reduce((a, b) => a + b, 0);
  const availableWidth = pageWidth - margin * 2;
  const scale = availableWidth / baseTotal;
  const colWidths = baseWidths.map((w) => Math.round(w * scale));

  const tableBody: any[] =
    report.rows.length > 0
      ? report.rows
      : [
          [
            {
              content: 'No records found for the selected filters',
              colSpan: 5,
              styles: { halign: 'center' },
            },
          ],
        ];

  autoTable(doc, {
    startY: yFilters + 22,
    margin: { left: margin, right: margin },
    head: [[
      'RM. #',
      "RESIDENT'S NAME",
      'PRECAUTION/ISOLATION',
      'INFECTED\nSOURCE',
      'DURATION',
    ]],
    body: tableBody,
    tableLineColor: black,
    tableLineWidth: 1,
    styles: {
      font: 'helvetica',
      fontSize: FONT.table,
      textColor: black,
      lineColor: black,
      lineWidth: 1,
      cellPadding: { top: 3, right: 4, bottom: 3, left: 4 },
      valign: 'middle',
    },
    headStyles: {
      fillColor: warningRgb,
      textColor: black,
      fontStyle: 'bold',
      halign: 'left',
      valign: 'middle',
    },
    bodyStyles: {
      fillColor: [255, 255, 255],
    },
    columnStyles: {
      0: { cellWidth: colWidths[0], halign: 'left' },
      1: { cellWidth: colWidths[1], halign: 'left' },
      2: { cellWidth: colWidths[2], halign: 'left' },
      3: { cellWidth: colWidths[3], halign: 'center' },
      4: { cellWidth: colWidths[4], halign: 'left' },
    },
  });

  // Footer (Prepared by/Title and Signature/Date/Time lines)
  const finalY = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? 104;
  let footerY = finalY + 28;
  if (footerY + 90 > pageHeight - margin) {
    doc.addPage();
    footerY = margin;
  }

  doc.setFontSize(FONT.footer);
  doc.setTextColor(...black);

  const leftX = margin;
  const rightX = pageWidth / 2 + 20;

  doc.setFont('helvetica', 'bold');
  doc.text('Prepared by:', leftX, footerY);
  doc.setLineWidth(1);
  doc.line(leftX + 70, footerY + 2, leftX + 250, footerY + 2);

  doc.text('Title:', rightX, footerY);
  doc.line(rightX + 30, footerY + 2, pageWidth - margin, footerY + 2);

  footerY += 18;

  doc.text('Signature:', leftX, footerY);
  doc.line(leftX + 62, footerY + 2, leftX + 250, footerY + 2);

  doc.text('Date/Time:', rightX, footerY);
  doc.line(rightX + 55, footerY + 2, pageWidth - margin, footerY + 2);

  // Disclaimer
  const disclaimer = report.footer?.disclaimer;
  if (disclaimer) {
    doc.setFontSize(FONT.disclaimer);
    doc.setFont('helvetica', 'italic');
    doc.text(`* ${disclaimer}`, margin, footerY + 20, { maxWidth: pageWidth - margin * 2 });
  }

  return doc;
};
