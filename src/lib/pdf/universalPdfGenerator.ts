import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { ReportData } from '@/lib/reportGenerators';
import { getLayoutForReport, type StandardLayoutConfig } from './standardLayout';
import { calculateColumnWidths, detectColumnConfig } from './tableLayout';
import { isProtectedReport } from './protectedLayouts';
import { buildDailyPrecautionListPdf } from './dailyPrecautionListPdf';

export interface PdfGenerationOptions {
  facilityName: string;
  layoutOverride?: Partial<StandardLayoutConfig>;
}

export const generateReportPdf = (
  report: ReportData,
  options: PdfGenerationOptions
): jsPDF => {
  if (isProtectedReport(report.title)) {
    return buildDailyPrecautionListPdf({ report, facility: options.facilityName });
  }

  return generateUniversalPdf(report, options);
};

const generateUniversalPdf = (
  report: ReportData,
  options: PdfGenerationOptions
): jsPDF => {
  const layout = { ...getLayoutForReport(report.title), ...options.layoutOverride } as StandardLayoutConfig;
  const doc = new jsPDF({ unit: 'pt', format: layout.pageSize, orientation: layout.orientation });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const { margins, fonts } = layout;

  let yPosition = margins.top;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(fonts.facilityName);
  doc.text(options.facilityName, pageWidth / 2, yPosition, { align: 'center' });

  yPosition += layout.headerSpacing;
  doc.setFontSize(fonts.reportTitle);
  doc.text(report.title, pageWidth / 2, yPosition, { align: 'center' });

  if (report.subtitle) {
    yPosition += fonts.filters * 1.4;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(fonts.filters);
    doc.text(report.subtitle, pageWidth / 2, yPosition, { align: 'center' });
  }

  if (report.filters) {
    const filterText = Object.entries(report.filters)
      .filter(([, value]) => value)
      .map(([key, value]) => `${key}: ${value}`)
      .join('  |  ');

    if (filterText) {
      yPosition += fonts.filters * 1.6;
      doc.setFontSize(fonts.filters);
      doc.text(filterText, pageWidth / 2, yPosition, { align: 'center', maxWidth: pageWidth - margins.left - margins.right });
    }
  }

  yPosition += layout.tableTopMargin;

  const columns = detectColumnConfig(report.title);
  const availableWidth = pageWidth - margins.left - margins.right;
  const columnWidths = columns && columns.length === report.headers.length
    ? calculateColumnWidths(columns, availableWidth)
    : distributeEvenWidths(report.headers.length, availableWidth);

  autoTable(doc, {
    startY: yPosition,
    margin: { left: margins.left, right: margins.right },
    head: [report.headers],
    body: report.rows.length > 0
      ? report.rows
      : [[{ content: 'No records found', colSpan: report.headers.length, styles: { halign: 'center' } }]],
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: fonts.tableBody,
      textColor: [25, 25, 25],
      lineColor: layout.tableBorders.color,
      lineWidth: layout.tableBorders.width,
      cellPadding: layout.cellPadding,
      valign: 'middle',
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: layout.tableHeaderBg,
      textColor: layout.tableHeaderText,
      fontStyle: 'bold',
      fontSize: fonts.tableHeader,
      halign: 'left',
    },
    columnStyles: columnWidths.reduce<Record<number, { cellWidth: number; halign: 'left' | 'center' | 'right' }>>((acc, width, idx) => {
      acc[idx] = { cellWidth: width, halign: columns?.[idx]?.alignment || 'left' };
      return acc;
    }, {}),
    didDrawPage: () => {
      const pageNumber = doc.getCurrentPageInfo().pageNumber;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(fonts.disclaimer);
      doc.text(`Page ${pageNumber}`, pageWidth - margins.right, pageHeight - margins.bottom / 2, { align: 'right' });
    },
  });

  const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? yPosition;
  let footerY = finalY + layout.footerTopMargin;

  if (report.footer) {
    if (footerY + 70 > pageHeight - margins.bottom) {
      doc.addPage();
      footerY = margins.top;
    }

    doc.setFontSize(fonts.footer);
    doc.setFont('helvetica', 'bold');

    const leftX = margins.left;
    const rightX = pageWidth / 2 + 20;

    doc.text('Prepared by:', leftX, footerY);
    doc.line(leftX + 70, footerY + 2, leftX + 220, footerY + 2);
    doc.text('Title:', rightX, footerY);
    doc.line(rightX + 32, footerY + 2, pageWidth - margins.right, footerY + 2);

    footerY += 20;
    doc.text('Signature:', leftX, footerY);
    doc.line(leftX + 58, footerY + 2, leftX + 220, footerY + 2);
    doc.text('Date/Time:', rightX, footerY);
    doc.line(rightX + 60, footerY + 2, pageWidth - margins.right, footerY + 2);

    if (report.footer.disclaimer) {
      footerY += 18;
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(fonts.disclaimer);
      const lines = doc.splitTextToSize(`* ${report.footer.disclaimer}`, pageWidth - margins.left - margins.right);
      lines.forEach((line: string) => {
        doc.text(line, margins.left, footerY);
        footerY += fonts.disclaimer * 1.3;
      });
    }
  }

  return doc;
};

const distributeEvenWidths = (count: number, total: number): number[] => {
  const safeCount = Math.max(1, count);
  const width = total / safeCount;
  return Array(safeCount).fill(width);
};
