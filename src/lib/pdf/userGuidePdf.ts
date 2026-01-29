// User Guide PDF Generator for ICN Hub
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { getThemeRgb, Rgb } from './pdfTheme';

// Default header color (healthcare blue)
const getHeaderColor = (): { r: number; g: number; b: number } => {
  const rgb = getThemeRgb('--primary', [74, 144, 226]);
  return { r: rgb[0], g: rgb[1], b: rgb[2] };
};
interface TrackerCapability {
  feature: string;
  description: string;
  howToUse: string;
}

const TRACKER_CAPABILITIES: Record<string, TrackerCapability[]> = {
  'Census Management': [
    {
      feature: 'Import Census',
      description: 'Bulk import residents from EMR/facility census exports',
      howToUse: 'Go to Census tab → Click "Import Census" → Upload CSV/Excel file → Confirm mapping'
    },
    {
      feature: 'Add/Edit Resident',
      description: 'Manually add new residents or update existing records',
      howToUse: 'Go to Census tab → Click "Add Resident" or click on a row to edit'
    },
    {
      feature: 'Active/Inactive Status',
      description: 'Track which residents are currently on census',
      howToUse: 'Residents drop off active census after import if not in new file'
    }
  ],
  'Antibiotic Tracker (ABT)': [
    {
      feature: 'Import ABT',
      description: 'Bulk import antibiotic orders from pharmacy system',
      howToUse: 'Go to ABT tab → Click "Import" → Upload file → Confirm'
    },
    {
      feature: 'Add ABT Case',
      description: 'Manually enter new antibiotic therapy',
      howToUse: 'Go to ABT tab → Click "Add Case" → Fill medication, dose, route, indication'
    },
    {
      feature: 'Review Tracking',
      description: 'Track 72/96/120 hour stewardship reviews',
      howToUse: 'Set review cadence in Settings → Cases auto-flag when due for review'
    },
    {
      feature: 'Discontinue ABT',
      description: 'Mark antibiotic therapy as completed',
      howToUse: 'Click the case → Click "Discontinue" → Add end date'
    }
  ],
  'Infection Prevention (IP)': [
    {
      feature: 'Import IP Cases',
      description: 'Bulk import infection/precaution data',
      howToUse: 'Go to IP tab → Click "Import" → Upload file'
    },
    {
      feature: 'Add IP Case',
      description: 'Create new precaution (EBP or Isolation)',
      howToUse: 'Go to IP tab → Click "Add Case" → Select protocol, infection type, source'
    },
    {
      feature: 'Protocol Types',
      description: 'EBP (Enhanced Barrier Precautions) or Isolation',
      howToUse: 'EBP = 7-day reviews, Isolation = 3-day reviews (configurable in Settings)'
    },
    {
      feature: 'Resolve Case',
      description: 'Mark precaution as resolved',
      howToUse: 'Click case → Click "Resolve" → Add resolution date'
    }
  ],
  'Vaccination Tracker (VAX)': [
    {
      feature: 'Import VAX',
      description: 'Bulk import vaccination records',
      howToUse: 'Go to VAX tab → Click "Import" → Upload file'
    },
    {
      feature: 'Record Vaccination',
      description: 'Mark resident as vaccinated',
      howToUse: 'Click resident → Click "Mark Given" → Enter date'
    },
    {
      feature: 'Declination Tracking',
      description: 'Track residents who decline vaccination',
      howToUse: 'Click resident → Click "Mark Declined" → Reason auto-documented'
    },
    {
      feature: 'Flu Season Logic',
      description: 'Smart detection of outdated influenza vaccinations',
      howToUse: 'System auto-flags flu shots from before October of current season'
    }
  ],
  'Notes & Symptoms': [
    {
      feature: 'Add Clinical Note',
      description: 'Document observations, symptoms, and follow-up needs',
      howToUse: 'Go to Notes tab → Click "Add Note" → Select resident, add symptoms, narrative'
    },
    {
      feature: 'Symptom Surveillance',
      description: 'Track symptoms by category (Respiratory, GI, Skin, UTI)',
      howToUse: 'When adding note, check symptom boxes → System categorizes automatically'
    },
    {
      feature: 'Follow-up Tracking',
      description: 'Flag notes that require follow-up action',
      howToUse: 'When adding note, enable "Requires Follow-up" → Set follow-up date'
    }
  ],
  'Outbreak Management': [
    {
      feature: 'Create Outbreak',
      description: 'Declare a new outbreak for tracking',
      howToUse: 'Go to Outbreak tab → Click "New Outbreak" → Name, type, start date'
    },
    {
      feature: 'Line Listing',
      description: 'CDC-style case tracking for outbreaks',
      howToUse: 'Select outbreak → Click "Add Case" → Enter case details'
    },
    {
      feature: 'Contact Tracing',
      description: 'Track exposure contacts for cases',
      howToUse: 'Click case in line listing → Click "Add Contact" → Enter contact details'
    }
  ],
  'Reporting': [
    {
      feature: 'Daily Precaution List',
      description: 'Printable list for charge nurses',
      howToUse: 'Go to Reports → Select unit/shift → Click "Quick Generate"'
    },
    {
      feature: 'Standard of Care Report',
      description: 'Weekly summary of ABT, IP, VAX activity',
      howToUse: 'Go to Reports → Set date range → Click "Generate" on Standard of Care'
    },
    {
      feature: 'Survey Readiness Packet',
      description: 'Comprehensive compliance documentation',
      howToUse: 'Go to Reports → Executive Reports → Survey Readiness Packet'
    },
    {
      feature: 'Export Options',
      description: 'PDF, CSV, JSON, HTML export formats',
      howToUse: 'Generate report → Select format dropdown → Click "Export"'
    }
  ],
  'Data Management': [
    {
      feature: 'Backup Data',
      description: 'Export all data to JSON file for safekeeping',
      howToUse: 'Click "Data" in header → Click "Export All Data"'
    },
    {
      feature: 'Import Backup',
      description: 'Restore from previous backup',
      howToUse: 'Click "Data" in header → Click "Import Data Backup" → Select file'
    },
    {
      feature: 'Backup Reminders',
      description: 'Configurable reminders to backup data',
      howToUse: 'Banner appears based on settings → Click gear icon to configure frequency'
    }
  ]
};

export const generateUserGuidePdf = (facilityName: string): jsPDF => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const headerColor = getHeaderColor();
  
  // Title Page
  doc.setFillColor(headerColor.r, headerColor.g, headerColor.b);
  doc.rect(0, 0, pageWidth, 60, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.text('ICN Hub', pageWidth / 2, 30, { align: 'center' });
  
  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.text('Infection Control Nurse Hub - User Guide', pageWidth / 2, 42, { align: 'center' });
  
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(12);
  doc.text(`Facility: ${facilityName}`, pageWidth / 2, 80, { align: 'center' });
  doc.text(`Generated: ${format(new Date(), 'PPP')}`, pageWidth / 2, 90, { align: 'center' });
  
  // Table of Contents
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Table of Contents', 14, 115);
  
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  let tocY = 128;
  let pageNum = 2;
  Object.keys(TRACKER_CAPABILITIES).forEach((section, idx) => {
    doc.text(`${idx + 1}. ${section}`, 20, tocY);
    doc.text(`${pageNum}`, pageWidth - 20, tocY, { align: 'right' });
    tocY += 8;
    pageNum++;
  });
  
  // Generate each section
  Object.entries(TRACKER_CAPABILITIES).forEach(([sectionName, capabilities], sectionIdx) => {
    doc.addPage();
    
    // Section header
    doc.setFillColor(headerColor.r, headerColor.g, headerColor.b);
    doc.rect(0, 0, pageWidth, 25, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(`${sectionIdx + 1}. ${sectionName}`, 14, 17);
    
    // Capabilities table
    doc.setTextColor(0, 0, 0);
    
    autoTable(doc, {
      startY: 35,
      head: [['Feature', 'Description', 'How to Use']],
      body: capabilities.map(cap => [cap.feature, cap.description, cap.howToUse]),
      styles: {
        fontSize: 9,
        cellPadding: 4,
        valign: 'top'
      },
      headStyles: {
        fillColor: [240, 240, 240],
        textColor: [0, 0, 0],
        fontStyle: 'bold'
      },
      columnStyles: {
        0: { cellWidth: 35, fontStyle: 'bold' },
        1: { cellWidth: 55 },
        2: { cellWidth: 'auto' }
      },
      alternateRowStyles: {
        fillColor: [250, 250, 250]
      }
    });
    
    // Page number
    doc.setFontSize(9);
    doc.setTextColor(128, 128, 128);
    doc.text(`Page ${sectionIdx + 2}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
  });
  
  // Quick Reference Card (last page)
  doc.addPage();
  
  doc.setFillColor(headerColor.r, headerColor.g, headerColor.b);
  doc.rect(0, 0, pageWidth, 25, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Quick Reference Card', 14, 17);
  
  doc.setTextColor(0, 0, 0);
  
  const quickRef = [
    ['Action', 'Shortcut / Location'],
    ['Add new ABT case', 'ABT Tab → Add Case button'],
    ['Add new IP precaution', 'IP Tab → Add Case button'],
    ['Record vaccination', 'VAX Tab → Click resident → Mark Given'],
    ['Add clinical note', 'Notes Tab → Add Note button'],
    ['Generate daily report', 'Reports Tab → Quick Generate button'],
    ['Backup your data', 'Header → Data button → Export'],
    ['Configure settings', 'Settings Tab (sidebar)'],
    ['View audit log', 'Audit Tab (sidebar)'],
    ['Search residents', 'Census Tab → Search field'],
    ['Filter by unit', 'Any tracker → Unit dropdown'],
  ];
  
  autoTable(doc, {
    startY: 35,
    head: [quickRef[0]],
    body: quickRef.slice(1),
    styles: {
      fontSize: 10,
      cellPadding: 5
    },
    headStyles: {
      fillColor: [74, 144, 226],
      textColor: [255, 255, 255],
      fontStyle: 'bold'
    },
    alternateRowStyles: {
      fillColor: [245, 248, 255]
    }
  });
  
  // Tips section
  const finalY = (doc as any).lastAutoTable?.finalY || 100;
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Pro Tips', 14, finalY + 15);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const tips = [
    '• Back up your data daily - reminders help ensure you never lose work',
    '• Use the "Surveyor Mode" toggle to highlight compliance-critical items',
    '• Review the Follow-up Notes Report weekly to catch overdue items',
    '• Set up scheduled report reminders for consistent documentation',
    '• Use date filters to generate time-specific reports for QAPI meetings'
  ];
  
  tips.forEach((tip, idx) => {
    doc.text(tip, 14, finalY + 25 + (idx * 7));
  });
  
  // Footer
  doc.setFontSize(9);
  doc.setTextColor(128, 128, 128);
  doc.text('ICN Hub User Guide - For questions, contact your system administrator', pageWidth / 2, pageHeight - 10, { align: 'center' });
  
  return doc;
};

export const generateTrackerCapabilitiesPdf = (facilityName: string): jsPDF => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const headerColor = getHeaderColor();
  
  // Header
  doc.setFillColor(headerColor.r, headerColor.g, headerColor.b);
  doc.rect(0, 0, pageWidth, 30, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('ICN Hub - Tracker Capabilities Summary', 14, 20);
  
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  doc.text(`${facilityName} | Generated: ${format(new Date(), 'PPP')}`, 14, 40);
  
  // Build summary table
  const rows: string[][] = [];
  
  Object.entries(TRACKER_CAPABILITIES).forEach(([section, capabilities]) => {
    // Section header row
    rows.push([section, '', '']);
    
    capabilities.forEach(cap => {
      rows.push(['  • ' + cap.feature, cap.description, '']);
    });
    
    rows.push(['', '', '']); // Spacer
  });
  
  autoTable(doc, {
    startY: 48,
    head: [['Module / Feature', 'Purpose', '']],
    body: rows.filter(r => r[0] || r[1]),
    styles: {
      fontSize: 9,
      cellPadding: 3
    },
    headStyles: {
      fillColor: [74, 144, 226],
      textColor: [255, 255, 255],
      fontStyle: 'bold'
    },
    columnStyles: {
      0: { cellWidth: 60 },
      1: { cellWidth: 'auto' }
    },
    didParseCell: (data) => {
      // Bold section headers
      if (data.section === 'body' && data.column.index === 0) {
        const text = data.cell.text.join('');
        if (!text.startsWith('  •') && text.length > 0) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [240, 245, 250];
        }
      }
    }
  });
  
  return doc;
};
