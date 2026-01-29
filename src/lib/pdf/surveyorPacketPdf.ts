import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { ReportData } from '@/lib/reportGenerators';
import { getThemeRgb, type Rgb } from '@/lib/pdf/pdfTheme';

export const isSurveyorPacketReport = (report: ReportData) => {
  const title = (report.title || '').toUpperCase();
  return title.includes('SURVEYOR') && title.includes('PACKET');
};

export const buildSurveyorPacketPdf = (params: { report: ReportData; facility: string }) => {
  const { report, facility } = params;
  const doc = new jsPDF({ unit: 'pt', format: 'letter', orientation: 'portrait' });

  const FONT = {
    facility: 14,
    title: 12,
    filters: 10,
    table: 9,
  };

  const pageWidth = doc.internal.pageSize.getWidth(); // 612 pt
  const margin = 40;

  const warningRgb = getThemeRgb('--warning', [251, 191, 36]);
  const black: Rgb = [0, 0, 0];

  // Header
  let y = 40;
  doc.setTextColor(...black);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(FONT.facility);
  doc.text(facility, pageWidth / 2, y, { align: 'center' });

  y += 16;
  doc.setFontSize(FONT.title);
  doc.text(report.title, pageWidth / 2, y, { align: 'center' });

  // Filters row: UNIT / DATE / SHIFT
  doc.setFontSize(FONT.filters);
  const yFilters = y + 16;
  const filtersText = `UNIT: ${report.filters.unit || 'All'}    DATE: ${report.filters.date || ''}SHIFT: ${report.filters.shift || '—'}`;
  doc.setFont('helvetica', 'bold');
  doc.text(filtersText, pageWidth / 2, yFilters, { align: 'center' });

  // Calculate column widths for 5 columns
  const colWidths = [180, 60, 60, 70, 140]; // Resident Name, Room, Unit, Active ABT, Active IP
  const totalWidth = colWidths.reduce((a, b) => a + b, 0);
  const availableWidth = pageWidth - margin * 2;
  const scale = availableWidth / totalWidth;
  const scaledWidths = colWidths.map(w => Math.round(w * scale));

  // Table with repeating headers on page break
  const tableBody: unknown[][] =
    report.rows.length > 0
      ? report.rows
      : [
          [
            {
              content: 'No active residents found',
              colSpan: 5,
              styles: { halign: 'center' },
            },
          ],
        ];

  autoTable(doc, {
    startY: yFilters + 18,
    margin: { left: margin, right: margin, top: 60, bottom: 30 },
    head: [report.headers],
    body: tableBody,
    tableLineColor: black,
    tableLineWidth: 0.5,
    styles: {
      font: 'helvetica',
      fontSize: FONT.table,
      textColor: black,
      lineColor: black,
      lineWidth: 0.5,
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
      0: { cellWidth: scaledWidths[0], halign: 'left' },
      1: { cellWidth: scaledWidths[1], halign: 'left' },
      2: { cellWidth: scaledWidths[2], halign: 'left' },
      3: { cellWidth: scaledWidths[3], halign: 'center' },
      4: { cellWidth: scaledWidths[4], halign: 'left' },
    },
    // KEY: Repeat headers on every page break
    showHead: 'everyPage',
    // Add page header with facility name on continuation pages
    didDrawPage: (data) => {
      const pageNumber = doc.getNumberOfPages();
      if (pageNumber > 1 && data.pageNumber > 1) {
        doc.setFontSize(FONT.facility);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...black);
        doc.text(facility, pageWidth / 2, 30, { align: 'center' });
        doc.setFontSize(FONT.title);
        doc.text(report.title, pageWidth / 2, 44, { align: 'center' });
      }
    },
  });

  // NO footer per user request - clean surveyor document

  return doc;
};
