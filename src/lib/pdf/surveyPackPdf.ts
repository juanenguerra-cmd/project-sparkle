import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import type { ICNDatabase } from '@/lib/database';
import { 
  getActiveIPCases, 
  getActiveABT, 
  getVaxDue,
  getActiveResidents
} from '@/lib/database';
import { getThemeRgb, type Rgb } from './pdfTheme';
import {
  generateHandHygieneReport,
  generatePPEUsageReport,
  generateActivePrecautionsByUnit,
  generateDailyPrecautionList,
  generateDailyIPWorklist,
  generateVaxDueList,
  generateVaxReofferReport,
  ReportData
} from '@/lib/reportGenerators';

export type SurveyPackType = 'audit' | 'abt' | 'precautions' | 'vaccination' | 'complete';

interface SurveyPackParams {
  packType: SurveyPackType;
  db: ICNDatabase;
  facility: string;
  fromDate: string;
  toDate: string;
}

interface SurveyPackResult {
  doc: jsPDF;
  reportCount: number;
}

const COLORS = {
  primary: (): Rgb => getThemeRgb('--primary', [14, 165, 233]),
  amber: (): Rgb => getThemeRgb('--warning', [251, 191, 36]),
  black: [0, 0, 0] as Rgb,
  white: [255, 255, 255] as Rgb,
  gray: [100, 100, 100] as Rgb,
  lightGray: [240, 240, 240] as Rgb,
};

// Add cover page
const addCoverPage = (
  doc: jsPDF,
  packTitle: string,
  facility: string,
  fromDate: string,
  toDate: string,
  reports: string[]
) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  
  // Background header bar
  doc.setFillColor(...COLORS.amber());
  doc.rect(0, 0, pageWidth, 120, 'F');
  
  // Title
  doc.setTextColor(...COLORS.black);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(28);
  doc.text('SURVEY DOCUMENTATION', pageWidth / 2, 50, { align: 'center' });
  
  doc.setFontSize(20);
  doc.text(packTitle.toUpperCase(), pageWidth / 2, 80, { align: 'center' });
  
  // Facility name
  doc.setFontSize(16);
  doc.setTextColor(...COLORS.black);
  doc.text(facility, pageWidth / 2, 150, { align: 'center' });
  
  // Date range
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`Date Range: ${format(new Date(fromDate), 'MMMM d, yyyy')} - ${format(new Date(toDate), 'MMMM d, yyyy')}`, pageWidth / 2, 175, { align: 'center' });
  doc.text(`Generated: ${format(new Date(), 'MMMM d, yyyy h:mm a')}`, pageWidth / 2, 190, { align: 'center' });
  
  // Table of Contents
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('TABLE OF CONTENTS', pageWidth / 2, 230, { align: 'center' });
  
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  let y = 260;
  reports.forEach((report, idx) => {
    doc.text(`${idx + 1}. ${report}`, 80, y);
    y += 18;
  });
  
  // Footer
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.gray);
  doc.text('Confidential - For Survey Use Only', pageWidth / 2, pageHeight - 40, { align: 'center' });
};

// Add section divider page
const addSectionDivider = (
  doc: jsPDF,
  sectionTitle: string,
  sectionNumber: number,
  color: Rgb
) => {
  doc.addPage();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  
  // Color bar on left
  doc.setFillColor(...color);
  doc.rect(0, 0, 40, pageHeight, 'F');
  
  // Section number
  doc.setTextColor(...COLORS.white);
  doc.setFontSize(48);
  doc.setFont('helvetica', 'bold');
  doc.text(sectionNumber.toString(), 20, pageHeight / 2, { align: 'center' });
  
  // Section title
  doc.setTextColor(...COLORS.black);
  doc.setFontSize(24);
  doc.text(sectionTitle, 80, pageHeight / 2, { align: 'left' });
};

// Add a report to the PDF
const addReportToPdf = (
  doc: jsPDF,
  report: ReportData,
  facility: string
) => {
  doc.addPage();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40;
  
  // Header
  let y = 40;
  doc.setTextColor(...COLORS.black);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(facility, pageWidth / 2, y, { align: 'center' });
  
  y += 16;
  doc.setFontSize(14);
  doc.text(report.title, pageWidth / 2, y, { align: 'center' });
  
  if (report.subtitle) {
    y += 14;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(report.subtitle, pageWidth / 2, y, { align: 'center' });
  }
  
  // Filters line
  y += 14;
  doc.setFontSize(9);
  const filterText = Object.entries(report.filters)
    .map(([k, v]) => `${k.toUpperCase()}: ${v}`)
    .join('    ');
  doc.text(filterText, pageWidth / 2, y, { align: 'center' });
  
  // Table
  const tableBody: unknown[][] = report.rows.length > 0
    ? report.rows
    : [[{ content: 'No data available', colSpan: report.headers.length, styles: { halign: 'center' } }]];
  
  autoTable(doc, {
    startY: y + 12,
    margin: { left: margin, right: margin, top: 60, bottom: 40 },
    head: [report.headers],
    body: tableBody,
    styles: {
      font: 'helvetica',
      fontSize: 9,
      textColor: COLORS.black,
      lineColor: COLORS.black,
      lineWidth: 0.5,
      cellPadding: { top: 3, right: 4, bottom: 3, left: 4 },
    },
    headStyles: {
      fillColor: COLORS.amber(),
      textColor: COLORS.black,
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: COLORS.lightGray,
    },
    showHead: 'everyPage',
    didDrawPage: (data) => {
      // Add page numbers
      const pageNumber = doc.getNumberOfPages();
      doc.setFontSize(9);
      doc.setTextColor(...COLORS.gray);
      doc.text(
        `Page ${data.pageNumber}`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 20,
        { align: 'center' }
      );
    },
  });
};

// Generate Active ABT List report
const generateActiveABTList = (db: ICNDatabase): ReportData => {
  const activeABT = getActiveABT(db);
  
  const sorted = [...activeABT].sort((a, b) => {
    const dateA = a.startDate || a.start_date || '';
    const dateB = b.startDate || b.start_date || '';
    return dateB.localeCompare(dateA); // Newest first
  });
  
  const rows = sorted.map(record => {
    const resident = db.census.residentsByMrn[record.mrn];
    const residentName = record.residentName || record.name || resident?.name || 'Unknown';
    const startDate = record.startDate || record.start_date || '';
    const endDate = record.endDate || record.end_date || 'Ongoing';
    const medication = record.medication || record.med_name || '';
    const days = record.daysOfTherapy || record.tx_days || 'N/A';
    
    return [
      residentName,
      record.room,
      medication,
      record.dose || '',
      record.frequency || '',
      record.route,
      record.indication || '',
      startDate,
      endDate,
      days.toString(),
    ];
  });
  
  return {
    title: 'ACTIVE ANTIBIOTICS LIST',
    subtitle: 'Current Active Antibiotic Courses',
    generatedAt: new Date().toISOString(),
    filters: {
      date: format(new Date(), 'MM/dd/yyyy'),
      status: 'Active Only',
    },
    headers: ['Resident', 'Room', 'Medication', 'Dose', 'Frequency', 'Route', 'Indication', 'Start', 'End', 'Days'],
    rows,
  };
};

// Generate Timeout Due List report
const generateTimeoutDueList = (db: ICNDatabase): ReportData => {
  const activeABT = getActiveABT(db);
  const today = new Date();
  
  // Filter for ABT needing 48-72h review (started 2-3 days ago without review)
  const needsReview = activeABT.filter(record => {
    const startDate = record.startDate || record.start_date;
    if (!startDate) return false;
    
    const start = new Date(startDate);
    const daysSinceStart = Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    
    // Needs review if 2+ days since start and no next review date set
    return daysSinceStart >= 2 && !record.nextReviewDate;
  });
  
  const sorted = [...needsReview].sort((a, b) => {
    const dateA = a.startDate || a.start_date || '';
    const dateB = b.startDate || b.start_date || '';
    return dateA.localeCompare(dateB); // Oldest first (most overdue)
  });
  
  const rows = sorted.map(record => {
    const resident = db.census.residentsByMrn[record.mrn];
    const residentName = record.residentName || record.name || resident?.name || 'Unknown';
    const startDate = record.startDate || record.start_date || '';
    const medication = record.medication || record.med_name || '';
    
    const start = new Date(startDate);
    const daysSinceStart = Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const daysOverdue = daysSinceStart - 2; // Review due at 48h (2 days)
    
    return [
      residentName,
      record.room,
      medication,
      record.dose || '',
      record.frequency || '',
      startDate,
      format(new Date(start.getTime() + 2 * 24 * 60 * 60 * 1000), 'MM/dd/yyyy'),
      daysOverdue > 0 ? `${daysOverdue} days` : 'Due today',
      'Pending',
    ];
  });
  
  return {
    title: 'ABT TIME-OUT REVIEW DUE',
    subtitle: 'Antibiotic Courses Requiring 48-72h Review',
    generatedAt: new Date().toISOString(),
    filters: {
      date: format(new Date(), 'MM/dd/yyyy'),
      threshold: '48-72 hours',
    },
    headers: ['Resident', 'Room', 'Medication', 'Dose', 'Frequency', 'Start Date', 'Review Due', 'Days Overdue', 'Status'],
    rows,
  };
};

// Generate Missing Indications Report
const generateMissingIndicationsReport = (db: ICNDatabase): ReportData => {
  const activeABT = getActiveABT(db);
  
  const missing = activeABT.filter(record => !record.indication || record.indication.trim() === '');
  
  const rows = missing.map(record => {
    const resident = db.census.residentsByMrn[record.mrn];
    const residentName = record.residentName || record.name || resident?.name || 'Unknown';
    const medication = record.medication || record.med_name || '';
    const startDate = record.startDate || record.start_date || '';
    
    return [
      residentName,
      record.room,
      medication,
      record.dose || '',
      record.frequency || '',
      record.route,
      startDate,
      'MISSING',
    ];
  });
  
  return {
    title: 'MISSING INDICATIONS REPORT',
    subtitle: 'Active Antibiotics Without Documented Indication (F881 Compliance)',
    generatedAt: new Date().toISOString(),
    filters: {
      date: format(new Date(), 'MM/dd/yyyy'),
      compliance: 'F881 Antibiotic Stewardship',
    },
    headers: ['Resident', 'Room', 'Medication', 'Dose', 'Frequency', 'Route', 'Start Date', 'Indication'],
    rows,
  };
};

// Generate Missing Stop Dates Report
const generateMissingStopDatesReport = (db: ICNDatabase): ReportData => {
  const activeABT = getActiveABT(db);
  
  const missing = activeABT.filter(record => {
    const endDate = record.endDate || record.end_date;
    return !endDate || endDate.trim() === '';
  });
  
  const rows = missing.map(record => {
    const resident = db.census.residentsByMrn[record.mrn];
    const residentName = record.residentName || record.name || resident?.name || 'Unknown';
    const medication = record.medication || record.med_name || '';
    const startDate = record.startDate || record.start_date || '';
    const daysSinceStart = startDate 
      ? Math.floor((new Date().getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24))
      : 0;
    
    return [
      residentName,
      record.room,
      medication,
      record.dose || '',
      record.frequency || '',
      startDate,
      'NOT SET',
      `${daysSinceStart} days`,
      daysSinceStart > 7 ? 'REVIEW' : 'Monitor',
    ];
  });
  
  return {
    title: 'MISSING STOP DATES REPORT',
    subtitle: 'Active Antibiotics Without Planned Stop Date',
    generatedAt: new Date().toISOString(),
    filters: {
      date: format(new Date(), 'MM/dd/yyyy'),
    },
    headers: ['Resident', 'Room', 'Medication', 'Dose', 'Frequency', 'Start Date', 'Stop Date', 'Duration', 'Action'],
    rows,
  };
};

// Generate Room Check Template
const generateRoomCheckTemplate = (db: ICNDatabase): ReportData => {
  const residents = getActiveResidents(db);
  const activeCases = getActiveIPCases(db);
  
  // Get unique units
  const units = [...new Set(residents.map(r => r.unit).filter(Boolean))].sort();
  
  const rows: string[][] = [];
  
  units.forEach(unit => {
    const unitResidents = residents
      .filter(r => r.unit === unit)
      .sort((a, b) => a.room.localeCompare(b.room, undefined, { numeric: true }));
    
    unitResidents.forEach((resident, idx) => {
      const hasIP = activeCases.some(c => c.mrn === resident.mrn);
      
      rows.push([
        idx === 0 ? unit : '',
        resident.room,
        resident.name,
        hasIP ? '☑' : '☐',
        '☐',
        '☐',
        '',
      ]);
    });
    
    // Add spacing row between units
    if (unit !== units[units.length - 1]) {
      rows.push(['', '', '', '', '', '', '']);
    }
  });
  
  return {
    title: 'ROOM CHECK TEMPLATE',
    subtitle: 'Unit-by-Unit Compliance Checklist',
    generatedAt: new Date().toISOString(),
    filters: {
      date: format(new Date(), 'MM/dd/yyyy'),
    },
    headers: ['Unit', 'Room', 'Resident', 'On Precaution', 'Signage Posted', 'PPE Available', 'Notes'],
    rows,
    footer: {
      preparedBy: '',
      signature: '',
      disclaimer: 'Check each item during room inspection. Document any deficiencies in Notes column.',
    },
  };
};

// Generate Corrections Log Template
const generateCorrectionsLogTemplate = (): ReportData => {
  // Generate blank rows for manual entry
  const rows: string[][] = Array(15).fill(['', '', '', '', '', '']);
  
  return {
    title: 'AUDIT CORRECTIONS LOG',
    subtitle: 'Documentation of Findings and Corrective Actions',
    generatedAt: new Date().toISOString(),
    filters: {
      date: format(new Date(), 'MM/dd/yyyy'),
    },
    headers: ['Date', 'Finding Description', 'Corrective Action', 'Responsible Party', 'Due Date', 'Status'],
    rows,
    footer: {
      disclaimer: 'Use this log to document audit findings and track corrective actions to completion.',
    },
  };
};

// Generate EBP Eligibility Report
const generateEBPEligibilityReport = (db: ICNDatabase): ReportData => {
  const activeCases = getActiveIPCases(db);
  const ebpCases = activeCases.filter(c => c.protocol === 'EBP');
  
  const rows = ebpCases.map(ipCase => {
    const resident = db.census.residentsByMrn[ipCase.mrn];
    const residentName = ipCase.residentName || ipCase.name || resident?.name || 'Unknown';
    const onsetDate = ipCase.onsetDate || ipCase.onset_date || '';
    const lastReview = ipCase.lastReviewDate || 'Not reviewed';
    
    return [
      residentName,
      ipCase.room,
      ipCase.unit,
      ipCase.infectionType || ipCase.infection_type || '',
      onsetDate,
      lastReview,
      'Active',
    ];
  });
  
  return {
    title: 'EBP ELIGIBILITY REVIEW',
    subtitle: 'Enhanced Barrier Precautions Cases',
    generatedAt: new Date().toISOString(),
    filters: {
      date: format(new Date(), 'MM/dd/yyyy'),
      protocol: 'EBP',
    },
    headers: ['Resident', 'Room', 'Unit', 'Infection Type', 'Onset', 'Last Review', 'Status'],
    rows,
  };
};

// Generate Vaccination Coverage Summary
const generateVaxCoverageSummary = (db: ICNDatabase): ReportData => {
  const allVax = db.records.vax;
  const activeResidents = getActiveResidents(db);
  const totalResidents = activeResidents.length;
  
  const vaccineTypes = ['flu', 'pneumo', 'covid', 'rsv'];
  
  const rows = vaccineTypes.map(type => {
    const typeVax = allVax.filter(v => 
      (v.vaccine || v.vaccine_type || '').toLowerCase().includes(type)
    );
    const given = typeVax.filter(v => v.status === 'given').length;
    const declined = typeVax.filter(v => v.status === 'declined').length;
    const due = typeVax.filter(v => v.status === 'due' || v.status === 'overdue').length;
    const rate = totalResidents > 0 ? ((given / totalResidents) * 100).toFixed(1) : '0.0';
    
    return [
      type.charAt(0).toUpperCase() + type.slice(1),
      given.toString(),
      declined.toString(),
      due.toString(),
      totalResidents.toString(),
      `${rate}%`,
      parseFloat(rate) >= 85 ? 'COMPLIANT' : 'REVIEW',
    ];
  });
  
  return {
    title: 'VACCINATION COVERAGE SUMMARY',
    subtitle: 'Active Resident Vaccination Rates by Type',
    generatedAt: new Date().toISOString(),
    filters: {
      date: format(new Date(), 'MM/dd/yyyy'),
      population: 'Active Residents Only',
    },
    headers: ['Vaccine', 'Given', 'Declined', 'Due/Overdue', 'Total', 'Rate', 'Status'],
    rows,
  };
};

// Generate Declination Summary
const generateDeclinationSummary = (db: ICNDatabase): ReportData => {
  const allVax = db.records.vax;
  
  const declined = allVax.filter(v => v.status === 'declined');
  
  const rows = declined.map(vax => {
    const resident = db.census.residentsByMrn[vax.mrn];
    const residentName = vax.residentName || vax.name || resident?.name || 'Unknown';
    const vaccine = vax.vaccine || vax.vaccine_type || '';
    const dateGiven = vax.dateGiven || vax.date_given || '';
    
    return [
      residentName,
      vax.room,
      vax.unit,
      vaccine,
      dateGiven,
      'Declined',
      vax.notes || '',
    ];
  });
  
  return {
    title: 'VACCINATION DECLINATION SUMMARY',
    subtitle: 'Residents Who Declined Vaccination',
    generatedAt: new Date().toISOString(),
    filters: {
      date: format(new Date(), 'MM/dd/yyyy'),
    },
    headers: ['Resident', 'Room', 'Unit', 'Vaccine', 'Offer Date', 'Status', 'Notes'],
    rows,
  };
};

// Build the survey pack
export const buildSurveyPack = async (params: SurveyPackParams): Promise<SurveyPackResult> => {
  const { packType, db, facility, fromDate, toDate } = params;
  const doc = new jsPDF({ unit: 'pt', format: 'letter', orientation: 'portrait' });
  
  let reports: { title: string; data: ReportData }[] = [];
  let packTitle = '';
  
  switch (packType) {
    case 'audit':
      packTitle = 'Audit & Compliance Pack';
      reports = [
        { title: 'Hand Hygiene Compliance Report', data: generateHandHygieneReport(db, fromDate, toDate) },
        { title: 'PPE Usage & Compliance', data: generatePPEUsageReport(db, fromDate, toDate) },
        { title: 'Room Check Template', data: generateRoomCheckTemplate(db) },
        { title: 'Corrections Log Template', data: generateCorrectionsLogTemplate() },
      ];
      break;
      
    case 'abt':
      packTitle = 'Active ABT Pack';
      reports = [
        { title: 'Active Antibiotics List', data: generateActiveABTList(db) },
        { title: 'ABT Time-out Review Due', data: generateTimeoutDueList(db) },
        { title: 'Missing Indications Report', data: generateMissingIndicationsReport(db) },
        { title: 'Missing Stop Dates Report', data: generateMissingStopDatesReport(db) },
      ];
      break;
      
    case 'precautions':
      packTitle = 'Precautions Roster Pack';
      reports = [
        { title: 'Active Precautions by Unit', data: generateActivePrecautionsByUnit(db) },
        { title: 'Daily Precaution List', data: generateDailyPrecautionList(db, 'all', 'Day') },
        { title: 'Daily IP Worklist', data: generateDailyIPWorklist(db, 'all') },
        { title: 'EBP Eligibility Review', data: generateEBPEligibilityReport(db) },
      ];
      break;
      
    case 'vaccination':
      packTitle = 'Vaccination Pack';
      reports = [
        { title: 'Vaccination Coverage Summary', data: generateVaxCoverageSummary(db) },
        { title: 'Due/Overdue List', data: generateVaxDueList(db, 'all') },
        { title: 'Declination Summary', data: generateDeclinationSummary(db) },
        { title: 'Re-offer List', data: generateVaxReofferReport(db, 'all') },
      ];
      break;
      
    case 'complete':
      packTitle = 'Complete Survey Pack';
      reports = [
        // Audit section
        { title: 'Hand Hygiene Compliance Report', data: generateHandHygieneReport(db, fromDate, toDate) },
        { title: 'PPE Usage & Compliance', data: generatePPEUsageReport(db, fromDate, toDate) },
        { title: 'Room Check Template', data: generateRoomCheckTemplate(db) },
        { title: 'Corrections Log Template', data: generateCorrectionsLogTemplate() },
        // ABT section
        { title: 'Active Antibiotics List', data: generateActiveABTList(db) },
        { title: 'ABT Time-out Review Due', data: generateTimeoutDueList(db) },
        { title: 'Missing Indications Report', data: generateMissingIndicationsReport(db) },
        { title: 'Missing Stop Dates Report', data: generateMissingStopDatesReport(db) },
        // Precautions section
        { title: 'Active Precautions by Unit', data: generateActivePrecautionsByUnit(db) },
        { title: 'Daily Precaution List', data: generateDailyPrecautionList(db, 'all', 'Day') },
        { title: 'Daily IP Worklist', data: generateDailyIPWorklist(db, 'all') },
        { title: 'EBP Eligibility Review', data: generateEBPEligibilityReport(db) },
        // Vaccination section
        { title: 'Vaccination Coverage Summary', data: generateVaxCoverageSummary(db) },
        { title: 'Due/Overdue List', data: generateVaxDueList(db, 'all') },
        { title: 'Declination Summary', data: generateDeclinationSummary(db) },
        { title: 'Re-offer List', data: generateVaxReofferReport(db, 'all') },
      ];
      break;
  }
  
  // Add cover page
  addCoverPage(doc, packTitle, facility, fromDate, toDate, reports.map(r => r.title));
  
  // Add section dividers for complete pack
  if (packType === 'complete') {
    const sections = [
      { title: 'Audit & Compliance', startIdx: 0, endIdx: 4, color: COLORS.primary() },
      { title: 'Antibiotic Stewardship', startIdx: 4, endIdx: 8, color: [34, 197, 94] as Rgb },
      { title: 'Infection Precautions', startIdx: 8, endIdx: 12, color: COLORS.amber() },
      { title: 'Vaccinations', startIdx: 12, endIdx: 16, color: [168, 85, 247] as Rgb },
    ];
    
    let sectionNum = 1;
    sections.forEach(section => {
      addSectionDivider(doc, section.title, sectionNum, section.color);
      sectionNum++;
      
      for (let i = section.startIdx; i < section.endIdx && i < reports.length; i++) {
        addReportToPdf(doc, reports[i].data, facility);
      }
    });
  } else {
    // Just add reports without section dividers
    reports.forEach(report => {
      addReportToPdf(doc, report.data, facility);
    });
  }
  
  return {
    doc,
    reportCount: reports.length,
  };
};
