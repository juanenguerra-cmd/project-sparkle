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
  
  // Determine orientation based on field count
  const orientation = fieldsToShow.length > 10 ? 'landscape' : 'portrait';
  
  const doc = new jsPDF({ 
    unit: 'pt', 
    format: 'letter', 
    orientation 
  });

  const FONT = {
    title: 14,
    subtitle: 11,
    table: 7,
  };

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 30;
  const black: Rgb = [0, 0, 0];
  const headerBg = getThemeRgb('--warning', [251, 191, 36]);

  // Header
  let y = 35;
  doc.setTextColor(...black);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(FONT.title);
  
  // Title based on outbreak type
  const title = outbreak.name.toUpperCase().includes('INFLUENZA') 
    ? 'INFLUENZA-LIKE ILLNESS'
    : outbreak.name.toUpperCase();
  
  doc.text(title, margin, y);
  
  // Facility and Date on right
  doc.text(`FACILITY: ${facility}`, pageWidth - margin, y, { align: 'right' });
  
  y += 16;
  doc.setFontSize(FONT.subtitle);
  doc.text('LINE LIST', margin, y);
  doc.text(`DATE: ${new Date().toLocaleDateString()}`, pageWidth - margin, y, { align: 'right' });
  
  y += 8;

  // Build headers - Room, Resident, then dynamic fields
  const headers = [
    'Rm',
    'Resident', 
    ...fieldsToShow.map(f => f.shortLabel || f.label)
  ];

  // Build rows
  const rows = entries.map(entry => {
    const baseRow = [
      entry.room,
      entry.residentName.replace('[Staff/Visitor] ', ''),
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

  // Add empty rows for manual entry (at least 15 total rows)
  const minRows = 15;
  const emptyRowsNeeded = Math.max(0, minRows - rows.length);
  for (let i = 0; i < emptyRowsNeeded; i++) {
    rows.push(Array(headers.length).fill(''));
  }

  // Calculate column widths
  const availableWidth = pageWidth - margin * 2;
  const roomWidth = 35;
  const nameWidth = 80;
  const remainingWidth = availableWidth - roomWidth - nameWidth;
  const fieldWidth = Math.max(30, remainingWidth / fieldsToShow.length);

  const columnStyles: Record<number, { cellWidth: number; halign: 'left' | 'center' }> = {
    0: { cellWidth: roomWidth, halign: 'left' },
    1: { cellWidth: nameWidth, halign: 'left' },
  };
  
  fieldsToShow.forEach((_, idx) => {
    columnStyles[idx + 2] = { cellWidth: fieldWidth, halign: 'center' };
  });

  autoTable(doc, {
    startY: y + 10,
    margin: { left: margin, right: margin, top: 50, bottom: 30 },
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
      cellPadding: { top: 2, right: 2, bottom: 2, left: 2 },
      valign: 'middle',
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: headerBg,
      textColor: black,
      fontStyle: 'bold',
      halign: 'center',
      valign: 'middle',
      minCellHeight: 28,
    },
    bodyStyles: {
      fillColor: [255, 255, 255],
      minCellHeight: 18,
    },
    columnStyles,
    showHead: 'everyPage',
    didDrawPage: (data) => {
      const pageNumber = doc.getNumberOfPages();
      if (pageNumber > 1 && data.pageNumber > 1) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...black);
        doc.text(`${title} - LINE LIST (cont.)`, margin, 25);
        doc.text(facility, pageWidth - margin, 25, { align: 'right' });
      }
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
