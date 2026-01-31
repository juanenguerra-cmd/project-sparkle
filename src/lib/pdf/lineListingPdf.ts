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

  const FONT = {
    title: 12,
    subtitle: 10,
    table: 6,
    tableHeader: 6,
  };

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const black: Rgb = [0, 0, 0];
  const headerBg = getThemeRgb('--warning', [251, 191, 36]);
  const lightGray: Rgb = [240, 240, 240];

  // Header
  let y = 25;
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
  
  y += 14;
  doc.text('LINE LIST', margin, y);
  doc.text(`DATE: ${new Date().toLocaleDateString()}`, pageWidth - margin, y, { align: 'right' });
  
  y += 6;

  // Build headers matching the exact CDC template layout
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
      entry.room,
      entry.residentName.replace('[Staff/Visitor] ', ''),
      entry.onsetDate ? new Date(entry.onsetDate).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' }) : '',
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
  const minRows = 25;
  const emptyRowsNeeded = Math.max(0, minRows - rows.length);
  for (let i = 0; i < emptyRowsNeeded; i++) {
    const rowNum = rows.length + 1;
    rows.push([String(rowNum), '', '', '', ...Array(fieldsToShow.length).fill('')]);
  }

  // Calculate column widths to fit landscape letter size
  const availableWidth = pageWidth - margin * 2;
  const numWidth = 18;
  const roomWidth = 28;
  const nameWidth = 85;
  const onsetWidth = 38;
  const fixedWidth = numWidth + roomWidth + nameWidth + onsetWidth;
  const remainingWidth = availableWidth - fixedWidth;
  const fieldWidth = Math.max(28, remainingWidth / fieldsToShow.length);

  const columnStyles: Record<number, { cellWidth: number; halign: 'left' | 'center' }> = {
    0: { cellWidth: numWidth, halign: 'center' },
    1: { cellWidth: roomWidth, halign: 'center' },
    2: { cellWidth: nameWidth, halign: 'left' },
    3: { cellWidth: onsetWidth, halign: 'center' },
  };
  
  fieldsToShow.forEach((_, idx) => {
    columnStyles[idx + 4] = { cellWidth: fieldWidth, halign: 'center' };
  });

  autoTable(doc, {
    startY: y + 6,
    margin: { left: margin, right: margin, top: 40, bottom: 20 },
    head: [headers],
    body: rows,
    tableLineColor: black,
    tableLineWidth: 0.5,
    styles: {
      font: 'helvetica',
      fontSize: FONT.table,
      textColor: black,
      lineColor: black,
      lineWidth: 0.5,
      cellPadding: { top: 1, right: 1, bottom: 1, left: 1 },
      valign: 'middle',
      overflow: 'linebreak',
      minCellHeight: 16,
    },
    headStyles: {
      fillColor: headerBg,
      textColor: black,
      fontStyle: 'bold',
      fontSize: FONT.tableHeader,
      halign: 'center',
      valign: 'middle',
      minCellHeight: 22,
    },
    bodyStyles: {
      fillColor: [255, 255, 255],
      minCellHeight: 16,
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
        doc.text(`${title} - LINE LIST (cont.)`, margin, 20);
        doc.text(facility.toUpperCase(), pageWidth - margin, 20, { align: 'right' });
      }
      
      // Page number footer
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(
        `Page ${currentPage}`,
        pageWidth / 2,
        pageHeight - 10,
        { align: 'center' }
      );
    },
  });

  return doc;
};
// Generate blank template for printing
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
