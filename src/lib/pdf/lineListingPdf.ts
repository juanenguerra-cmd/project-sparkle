import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getThemeRgb, type Rgb } from '@/lib/pdf/pdfTheme';
import type { LineListingEntry, Outbreak } from '@/lib/types';
import { getTemplateForOutbreak, type LineListingFieldConfig } from '@/lib/lineListingTemplates';

interface LineListingPdfParams {
  outbreak: Outbreak;
  entries: LineListingEntry[];
  facility: string;
  enabledFields?: string[]; // Which fields to include
}

/**
 * Generate a fit-to-page Line Listing PDF with no column overflow.
 * Uses dynamic font sizing based on column count to ensure everything fits.
 */
export const generateLineListingPdf = (params: LineListingPdfParams) => {
  const { outbreak, entries, facility, enabledFields } = params;
  
  // Get the appropriate template
  const template = getTemplateForOutbreak(outbreak.name, outbreak.type);
  
  // Filter fields based on enabled list or use defaults
  const fieldsToShow = enabledFields 
    ? template.fields.filter(f => enabledFields.includes(f.id))
    : template.fields.filter(f => f.defaultEnabled);
  
  // Always use landscape for line listings to fit all columns
  const doc = new jsPDF({ 
    unit: 'pt', 
    format: 'letter', 
    orientation: 'landscape' 
  });

  // Landscape letter dimensions: 792 x 612 pt
  const pageWidth = doc.internal.pageSize.getWidth();  // 792
  const pageHeight = doc.internal.pageSize.getHeight(); // 612
  const margin = 30; // Consistent 30pt margins on all sides
  const availableWidth = pageWidth - margin * 2; // 732pt usable

  // Dynamic font sizing based on number of columns
  const totalColumns = 4 + fieldsToShow.length; // Fixed cols + dynamic fields
  const getFontSizes = (colCount: number) => {
    if (colCount <= 10) return { title: 11, subtitle: 9, table: 7, header: 7 };
    if (colCount <= 15) return { title: 10, subtitle: 8, table: 6, header: 6 };
    if (colCount <= 20) return { title: 10, subtitle: 8, table: 5.5, header: 5.5 };
    if (colCount <= 25) return { title: 9, subtitle: 7, table: 5, header: 5 };
    if (colCount <= 30) return { title: 9, subtitle: 7, table: 4.5, header: 4.5 };
    return { title: 8, subtitle: 6, table: 4, header: 4 }; // 30+ columns
  };
  const FONT = getFontSizes(totalColumns);

  const black: Rgb = [0, 0, 0];
  const headerBg = getThemeRgb('--warning', [251, 191, 36]);
  const lightGray: Rgb = [245, 245, 245];

  // ─────────────────────────────────────────────────────────────────────────
  // Header Section
  // ─────────────────────────────────────────────────────────────────────────
  let y = margin;
  doc.setTextColor(...black);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(FONT.title);
  
  // Title based on outbreak type - matching CDC format
  let title = outbreak.name.toUpperCase();
  if (title.includes('INFLUENZA') || title.includes('ILI')) {
    title = 'INFLUENZA-LIKE ILLNESS (ILI)';
  }
  
  doc.text(title, margin, y);
  
  // Facility and Date on right
  doc.setFontSize(FONT.subtitle);
  doc.text(`FACILITY: ${facility.toUpperCase()}`, pageWidth - margin, y, { align: 'right' });
  
  y += 12;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(FONT.subtitle);
  doc.text('LINE LIST', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.text(`DATE: ${new Date().toLocaleDateString()}`, pageWidth - margin, y, { align: 'right' });
  
  y += 8;

  // ─────────────────────────────────────────────────────────────────────────
  // Build Table Headers & Rows
  // ─────────────────────────────────────────────────────────────────────────
  // Fixed columns: #, Room, Resident Name, Onset Date
  const headers = [
    '#',
    'Rm',
    'Resident Name', 
    'Onset',
    ...fieldsToShow.map(f => f.shortLabel || f.label)
  ];

  // Build rows
  const rows = entries.map((entry, index) => {
    const baseRow = [
      String(index + 1),
      entry.room || '',
      (entry.residentName || '').replace('[Staff/Visitor] ', ''),
      entry.onsetDate 
        ? new Date(entry.onsetDate).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' }) 
        : '',
    ];
    
    // Add dynamic field values
    const fieldValues = fieldsToShow.map(field => {
      const value = entry.templateData?.[field.id];
      
      if (value === undefined || value === null || value === '') {
        return '';
      }
      
      if (field.type === 'checkbox') {
        return value ? '✓' : '';
      }
      
      if (field.type === 'date' && typeof value === 'string' && value) {
        try {
          return new Date(value).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
        } catch {
          return String(value);
        }
      }
      
      return String(value);
    });
    
    return [...baseRow, ...fieldValues];
  });

  // Add empty rows for manual entry (fill the page)
  const minRows = 20;
  const emptyRowsNeeded = Math.max(0, minRows - rows.length);
  for (let i = 0; i < emptyRowsNeeded; i++) {
    const rowNum = rows.length + 1;
    rows.push([String(rowNum), '', '', '', ...Array(fieldsToShow.length).fill('')]);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Calculate Column Widths (fit-to-page)
  // ─────────────────────────────────────────────────────────────────────────
  // Fixed column minimum widths
  const numWidth = 16;
  const roomWidth = 24;
  const nameMinWidth = 70;
  const onsetWidth = 32;
  const fixedColumnsWidth = numWidth + roomWidth + nameMinWidth + onsetWidth;
  
  // Remaining width for dynamic fields
  const remainingWidth = availableWidth - fixedColumnsWidth;
  const dynamicFieldCount = fieldsToShow.length;
  
  // Calculate per-field width, ensuring minimum readability
  let fieldWidth = dynamicFieldCount > 0 
    ? Math.floor(remainingWidth / dynamicFieldCount) 
    : 0;
  
  // Ensure minimum field width of 20pt for readability
  const minFieldWidth = 20;
  if (fieldWidth < minFieldWidth && dynamicFieldCount > 0) {
    fieldWidth = minFieldWidth;
  }
  
  // If total width exceeds available, scale down proportionally
  const totalCalculatedWidth = fixedColumnsWidth + (fieldWidth * dynamicFieldCount);
  const scaleFactor = totalCalculatedWidth > availableWidth 
    ? availableWidth / totalCalculatedWidth 
    : 1;
  
  // Apply scale factor to all widths
  const scaledNumWidth = Math.floor(numWidth * scaleFactor);
  const scaledRoomWidth = Math.floor(roomWidth * scaleFactor);
  const scaledNameWidth = Math.floor(nameMinWidth * scaleFactor);
  const scaledOnsetWidth = Math.floor(onsetWidth * scaleFactor);
  const scaledFieldWidth = Math.floor(fieldWidth * scaleFactor);

  // Build column styles
  const columnStyles: Record<number, { cellWidth: number; halign: 'left' | 'center' }> = {
    0: { cellWidth: scaledNumWidth, halign: 'center' },
    1: { cellWidth: scaledRoomWidth, halign: 'center' },
    2: { cellWidth: scaledNameWidth, halign: 'left' },
    3: { cellWidth: scaledOnsetWidth, halign: 'center' },
  };
  
  fieldsToShow.forEach((_, idx) => {
    columnStyles[idx + 4] = { cellWidth: scaledFieldWidth, halign: 'center' };
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Generate Table with autoTable
  // ─────────────────────────────────────────────────────────────────────────
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin, top: margin + 20, bottom: margin },
    head: [headers],
    body: rows,
    tableLineColor: black,
    tableLineWidth: 0.4,
    tableWidth: availableWidth, // Force table to fit available width
    styles: {
      font: 'helvetica',
      fontSize: FONT.table,
      textColor: black,
      lineColor: black,
      lineWidth: 0.4,
      cellPadding: { top: 1, right: 1, bottom: 1, left: 1 },
      valign: 'middle',
      overflow: 'ellipsize', // Truncate with ellipsis instead of overflow
      minCellHeight: 14,
    },
    headStyles: {
      fillColor: headerBg,
      textColor: black,
      fontStyle: 'bold',
      fontSize: FONT.header,
      halign: 'center',
      valign: 'middle',
      minCellHeight: 16,
      cellPadding: { top: 2, right: 1, bottom: 2, left: 1 },
    },
    bodyStyles: {
      fillColor: [255, 255, 255],
      minCellHeight: 14,
    },
    alternateRowStyles: {
      fillColor: lightGray,
    },
    columnStyles,
    showHead: 'everyPage',
    didDrawPage: (data) => {
      const currentPage = data.pageNumber;
      
      // Header on subsequent pages
      if (currentPage > 1) {
        doc.setFontSize(FONT.subtitle);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...black);
        doc.text(`${title} - LINE LIST (cont.)`, margin, margin - 5);
        doc.text(facility.toUpperCase(), pageWidth - margin, margin - 5, { align: 'right' });
      }
      
      // Page number footer
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.text(
        `Page ${currentPage}`,
        pageWidth / 2,
        pageHeight - 15,
        { align: 'center' }
      );
    },
  });

  return doc;
};

/**
 * Generate blank template for printing
 */
export const generateBlankLineListingPdf = (
  templateId: string,
  outbreakName: string,
  facility: string
) => {
  const outbreak: Outbreak = {
    id: 'blank',
    name: outbreakName,
    type: templateId === 'gi' ? 'gi' : templateId === 'skin' ? 'skin' : 'respiratory',
    startDate: new Date().toISOString(),
    status: 'active',
    affectedUnits: [],
    totalCases: 0,
    createdAt: new Date().toISOString(),
  };

  return generateLineListingPdf({
    outbreak,
    entries: [],
    facility,
  });
};
