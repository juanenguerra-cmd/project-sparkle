// QAPI Report PDF Generator
// Builds professional QAPI PDF with PDCA framework, tables, and charts

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { 
  QAPIReportData, 
  QAPIIPReportData, 
  QAPIVaxReportData,
  QAPI_CATEGORIES
} from '../reports/qapiReport';

// PDF Theme colors (static for PDF generation)
const PDF_THEME = {
  primary: { r: 37, g: 99, b: 235 },    // Blue
  secondary: { r: 16, g: 185, b: 129 }, // Green
  accent: { r: 251, g: 191, b: 36 },    // Amber/Gold
  dark: { r: 30, g: 41, b: 59 }         // Slate
};

// =====================================================
// INFECTION CONTROL / ABT QAPI PDF
// =====================================================

export const buildQAPIInfectionControlPdf = (
  data: QAPIReportData
): jsPDF => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  let yPos = margin;

  // Helper for new page
  const checkNewPage = (needed: number) => {
    if (yPos + needed > pageHeight - 60) {
      doc.addPage();
      yPos = margin;
    }
  };

  // ===== COVER PAGE =====
  doc.setFillColor(PDF_THEME.primary.r, PDF_THEME.primary.g, PDF_THEME.primary.b);
  doc.rect(0, 0, pageWidth, 120, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text(data.facilityName, pageWidth / 2, 50, { align: 'center' });
  
  doc.setFontSize(18);
  doc.text(`QA/PI Report: Infection Control ${data.quarter} ${data.year}`, pageWidth / 2, 80, { align: 'center' });
  
  doc.setTextColor(0, 0, 0);
  yPos = 150;
  
  // PLAN Section
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('PLAN:', margin, yPos);
  yPos += 25;
  
  // Goals section
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('1) GOALS AND OBJECTIVE:', margin, yPos);
  yPos += 15;
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const goalsText = `${data.facilityName} is committed to providing quality care to its residents in accordance with the expectations and requirements of applicable laws. The facility must provide staff with guidance on meeting the supervisory requirements of applicable laws with respect to creating a safe, sanitary, and comfortable environment and preventing the development and transmission of communicable diseases and infections.`;
  const goalsLines = doc.splitTextToSize(goalsText, pageWidth - margin * 2);
  doc.text(goalsLines, margin, yPos);
  yPos += goalsLines.length * 12 + 15;
  
  // Data Source
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('2) DATA SOURCE:', margin, yPos);
  yPos += 15;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('24 Hour Report, Residents\' Medical Records, e-Quality Audits, MD McGeer Criteria Progress Note, Antibiotic Reports.', margin, yPos);
  yPos += 20;
  
  // Duration
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('4) DURATION OF DATA COLLECTION:', margin, yPos);
  yPos += 15;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(data.periodRange, margin, yPos);
  yPos += 20;
  
  // Sample Size
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('5) SAMPLE SIZE:', margin, yPos);
  yPos += 15;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Average of ${data.sampleSize} patients`, margin, yPos);
  yPos += 20;
  
  // Indicator
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('6) INDICATOR:', margin, yPos);
  yPos += 15;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('F880 §483.80(a) Infection prevention and control program', margin, yPos);
  yPos += 30;

  // DO Section
  doc.addPage();
  yPos = margin;
  
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('DO:', margin, yPos);
  yPos += 25;
  
  const doItems = [
    'Assessed all residents admitted and readmitted for presence of infection and/or antibiotic use.',
    'Checked and ensured that all residents admitted/readmitted had actual or risk for infection care plans with appropriate goals and interventions.',
    'Informed and engaged family in the plan of care. Documented family notification regarding infections and antibiotic use.',
    'Checked and ensured that the C.N.A. Accountability form includes the appropriate transmission-based precautions.',
    'Reviewed 24-hour report and E-Quality audit daily in morning huddle to cross reference infections and antibiotic use.',
    'Provide a root cause analysis of all residents with a healthcare-associated infection.',
    'Provide continuous surveillance of residents for early identification of new potential infections.',
    'Continuously observe and train staff on proper hand hygiene practices and disinfection protocols.',
    'Review antibiotics use monthly against McGeer criteria for classification of infections.',
    'Implemented Enhanced Barrier Precaution as an intervention to prevent MDRO transmission.'
  ];
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doItems.forEach((item, idx) => {
    checkNewPage(30);
    doc.text(`${idx + 1}. ${item}`, margin, yPos, { maxWidth: pageWidth - margin * 2 });
    yPos += 20;
  });
  
  // CHECK Section - Tables
  doc.addPage();
  yPos = margin;
  
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('CHECK:', margin, yPos);
  yPos += 10;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Measures of performance tracked over the quarter. See attached data reports.', margin, yPos);
  yPos += 30;
  
  // Table 1: Infection Rate per 1000 Resident Days
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Table 1: Infection Rate per 1000 Resident Days', margin, yPos);
  yPos += 15;
  
  const table1Headers = ['MONTH', ...QAPI_CATEGORIES.map(c => `New ${c.slice(0,4)}.`), ...QAPI_CATEGORIES.map(c => `${c.slice(0,4)}. Rate`), 'Total', 'Rate'];
  const table1Rows = data.infectionRatePer1000.months.map(m => [
    m.monthLabel.split(' ')[0], // Just month name
    ...QAPI_CATEGORIES.map(cat => m.newInfections[cat].toString()),
    ...QAPI_CATEGORIES.map(cat => m.residentDays > 0 ? ((m.newInfections[cat] / m.residentDays) * 1000).toFixed(2) : '0'),
    m.totalInfections.toString(),
    m.residentDays > 0 ? ((m.totalInfections / m.residentDays) * 1000).toFixed(2) : '0'
  ]);
  
  // Add quarter total row
  const qTotal = data.infectionRatePer1000.quarterTotal;
  const totalResidentDays = data.infectionRatePer1000.months.reduce((s, m) => s + m.residentDays, 0);
  const totalInfections = data.infectionRatePer1000.months.reduce((s, m) => s + m.totalInfections, 0);
  table1Rows.push([
    `${data.quarter} TOTAL`,
    ...QAPI_CATEGORIES.map(cat => qTotal[cat].count.toString()),
    ...QAPI_CATEGORIES.map(cat => qTotal[cat].rate.toFixed(2)),
    totalInfections.toString(),
    (totalResidentDays > 0 ? (totalInfections / totalResidentDays) * 1000 : 0).toFixed(2)
  ]);
  
  autoTable(doc, {
    startY: yPos,
    head: [table1Headers],
    body: table1Rows,
    theme: 'grid',
    headStyles: { fillColor: [251, 191, 36], textColor: [0, 0, 0], fontSize: 7, fontStyle: 'bold' },
    bodyStyles: { fontSize: 7 },
    margin: { left: margin, right: margin },
    tableWidth: 'auto'
  });
  
  yPos = (doc as any).lastAutoTable.finalY + 10;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.text(`* Previous Quarter (${data.previousQuarter} ${data.previousYear}) Total New Infections = ${data.infectionRatePer1000.previousQuarterTotal}`, margin, yPos);
  yPos += 30;
  
  // Table 2: Infection Rate by Census
  checkNewPage(150);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Table 2: Infection Rate by Census', margin, yPos);
  yPos += 15;
  
  const table2Headers = ['MONTH', 'AVG CENSUS', ...QAPI_CATEGORIES.map(c => `${c.slice(0,4)}.`), ...QAPI_CATEGORIES.map(c => `${c.slice(0,4)}. Rate`), 'Total', 'Rate'];
  const table2Rows = data.infectionRateByCensus.months.map(m => [
    m.monthLabel.split(' ')[0],
    m.avgCensus.toString(),
    ...QAPI_CATEGORIES.map(cat => m.newInfections[cat].toString()),
    ...QAPI_CATEGORIES.map(cat => m.avgCensus > 0 ? ((m.newInfections[cat] / m.avgCensus) * 100).toFixed(2) : '0'),
    m.totalInfections.toString(),
    m.avgCensus > 0 ? ((m.totalInfections / m.avgCensus) * 100).toFixed(2) : '0'
  ]);
  
  const avgCensusTotal = Math.round(data.infectionRateByCensus.months.reduce((s, m) => s + m.avgCensus, 0) / data.infectionRateByCensus.months.length);
  table2Rows.push([
    `${data.quarter} TOTAL`,
    avgCensusTotal.toString(),
    ...QAPI_CATEGORIES.map(cat => qTotal[cat].count.toString()),
    ...QAPI_CATEGORIES.map(cat => avgCensusTotal > 0 ? ((qTotal[cat].count / avgCensusTotal) * 100).toFixed(2) : '0'),
    totalInfections.toString(),
    avgCensusTotal > 0 ? ((totalInfections / avgCensusTotal) * 100).toFixed(2) : '0'
  ]);
  
  autoTable(doc, {
    startY: yPos,
    head: [table2Headers],
    body: table2Rows,
    theme: 'grid',
    headStyles: { fillColor: [251, 191, 36], textColor: [0, 0, 0], fontSize: 7, fontStyle: 'bold' },
    bodyStyles: { fontSize: 7 },
    margin: { left: margin, right: margin }
  });
  
  yPos = (doc as any).lastAutoTable.finalY + 30;
  
  // Table 3: ABT Starts per 1000 Resident Days
  checkNewPage(150);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Table 3: Antibiotic Starts per 1000 Resident Days', margin, yPos);
  yPos += 15;
  
  const table3Headers = ['MONTH', ...QAPI_CATEGORIES.map(c => `New ${c.slice(0,4)}.`), ...QAPI_CATEGORIES.map(c => `${c.slice(0,4)}. Rate`), 'Total', 'Rate'];
  const table3Rows = data.abtStartsPer1000.months.map(m => [
    m.monthLabel.split(' ')[0],
    ...QAPI_CATEGORIES.map(cat => m.abtStarts[cat].toString()),
    ...QAPI_CATEGORIES.map(cat => m.residentDays > 0 ? ((m.abtStarts[cat] / m.residentDays) * 1000).toFixed(2) : '0'),
    m.totalABTStarts.toString(),
    m.residentDays > 0 ? ((m.totalABTStarts / m.residentDays) * 1000).toFixed(2) : '0'
  ]);
  
  const abtTotal = data.abtStartsPer1000.quarterTotal;
  const totalABT = data.abtStartsPer1000.months.reduce((s, m) => s + m.totalABTStarts, 0);
  table3Rows.push([
    `${data.quarter} TOTAL`,
    ...QAPI_CATEGORIES.map(cat => abtTotal[cat].count.toString()),
    ...QAPI_CATEGORIES.map(cat => abtTotal[cat].rate.toFixed(2)),
    totalABT.toString(),
    (totalResidentDays > 0 ? (totalABT / totalResidentDays) * 1000 : 0).toFixed(2)
  ]);
  
  autoTable(doc, {
    startY: yPos,
    head: [table3Headers],
    body: table3Rows,
    theme: 'grid',
    headStyles: { fillColor: [251, 191, 36], textColor: [0, 0, 0], fontSize: 7, fontStyle: 'bold' },
    bodyStyles: { fontSize: 7 },
    margin: { left: margin, right: margin }
  });
  
  yPos = (doc as any).lastAutoTable.finalY + 10;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.text(`* Previous Quarter (${data.previousQuarter} ${data.previousYear}) ABT Starts Total = ${data.abtStartsPer1000.previousQuarterTotal}`, margin, yPos);
  yPos += 30;
  
  // Table 4: AUR
  checkNewPage(150);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Table 4: Antibiotic Utilization Ratio (AUR)', margin, yPos);
  yPos += 5;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('DOT = Days of Therapy, AUR = DOT per 1000 Resident Days', margin, yPos);
  yPos += 15;
  
  const table4Headers = ['MONTH', ...QAPI_CATEGORIES.map(c => `${c.slice(0,4)}. DOT`), ...QAPI_CATEGORIES.map(c => `${c.slice(0,4)}. AUR`), 'Total DOT', 'Total AUR'];
  const table4Rows = data.aur.months.map(m => [
    m.month.split(' ')[0],
    ...QAPI_CATEGORIES.map(cat => m.dot[cat].toString()),
    ...QAPI_CATEGORIES.map(cat => m.aur[cat].toFixed(2)),
    m.totalDOT.toString(),
    m.totalAUR.toFixed(2)
  ]);
  
  const aurTotal = data.aur.quarterTotal;
  table4Rows.push([
    `${data.quarter} TOTAL`,
    ...QAPI_CATEGORIES.map(cat => aurTotal.dot[cat].toString()),
    ...QAPI_CATEGORIES.map(cat => aurTotal.aur[cat].toFixed(2)),
    aurTotal.totalDOT.toString(),
    aurTotal.totalAUR.toFixed(2)
  ]);
  
  autoTable(doc, {
    startY: yPos,
    head: [table4Headers],
    body: table4Rows,
    theme: 'grid',
    headStyles: { fillColor: [251, 191, 36], textColor: [0, 0, 0], fontSize: 7, fontStyle: 'bold' },
    bodyStyles: { fontSize: 7 },
    margin: { left: margin, right: margin }
  });
  
  yPos = (doc as any).lastAutoTable.finalY + 10;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.text(`* Previous Quarter (${data.previousQuarter} ${data.previousYear}) Total DOT = ${data.aur.previousQuarterDOT}`, margin, yPos);
  
  // ACT Section
  doc.addPage();
  yPos = margin;
  
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('ACT:', margin, yPos);
  yPos += 25;
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const actText = `Summary analysis leads to continued monitoring and implementation of interventions to manage infection rates. We will continue with our interventions including focusing on hydration for urinary infection prevention, dietary considerations to increase immunity, PPE compliance, hand hygiene practices, skin care monitoring, and infection control training.

Other infection control standards will continue to be maintained to prevent the spread of infection by offering available vaccines and adhering to the implementation of Enhanced Barrier Precautions which maintains a reduction in the possible spread of MDROs.`;
  const actLines = doc.splitTextToSize(actText, pageWidth - margin * 2);
  doc.text(actLines, margin, yPos);
  yPos += actLines.length * 12 + 30;
  
  // Executive Summary
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Executive Summary:', margin, yPos);
  yPos += 20;
  
  const es = data.executiveSummary;
  const summaryItems = [
    `Our total new infections went from ${es.previousTotalInfections} to ${es.totalNewInfections} in ${data.quarter}.`,
    `With an average census of ${data.sampleSize} for the quarter, our infection rate is ${es.infectionRateByCensus.toFixed(2)} per 1000 resident days (previous: ${es.previousInfectionRate.toFixed(2)}).`,
    `Our healthcare associated infections: ${es.totalHAI} this quarter vs ${es.previousHAI} last quarter.`,
    `Our antibiotic starts went from ${es.previousABTStarts} to ${es.totalABTStarts} total.`,
    `Our days of therapy went from ${es.previousDOT} days last quarter to ${es.totalDOT} days this quarter.`
  ];
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  summaryItems.forEach(item => {
    checkNewPage(20);
    doc.text(`• ${item}`, margin, yPos, { maxWidth: pageWidth - margin * 2 });
    yPos += 18;
  });
  
  // Footer with generation date
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(128, 128, 128);
    doc.text(`Generated: ${format(new Date(), 'MM/dd/yyyy HH:mm')} | Page ${i} of ${totalPages}`, pageWidth / 2, pageHeight - 20, { align: 'center' });
    doc.setTextColor(0, 0, 0);
  }
  
  return doc;
};

// =====================================================
// IP (PRECAUTIONS) QAPI PDF
// =====================================================

export const buildQAPIIPPdf = (data: QAPIIPReportData): jsPDF => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  let yPos = margin;

  // Header
  doc.setFillColor(PDF_THEME.primary.r, PDF_THEME.primary.g, PDF_THEME.primary.b);
  doc.rect(0, 0, pageWidth, 80, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(data.facilityName, pageWidth / 2, 35, { align: 'center' });
  
  doc.setFontSize(14);
  doc.text(`QAPI Report: Infection Prevention ${data.quarter} ${data.year}`, pageWidth / 2, 55, { align: 'center' });
  
  doc.setTextColor(0, 0, 0);
  yPos = 100;
  
  // Precautions Summary
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Active Precautions Summary', margin, yPos);
  yPos += 20;
  
  const ps = data.precautionsSummary;
  autoTable(doc, {
    startY: yPos,
    head: [['Protocol Type', 'Count', 'Percentage']],
    body: [
      ['Enhanced Barrier Precautions (EBP)', ps.ebpCount.toString(), `${ps.totalActive > 0 ? ((ps.ebpCount / ps.totalActive) * 100).toFixed(1) : 0}%`],
      ['Isolation - Contact', ps.contactCount.toString(), `${ps.totalActive > 0 ? ((ps.contactCount / ps.totalActive) * 100).toFixed(1) : 0}%`],
      ['Isolation - Droplet', ps.dropletCount.toString(), `${ps.totalActive > 0 ? ((ps.dropletCount / ps.totalActive) * 100).toFixed(1) : 0}%`],
      ['Isolation - Airborne', ps.airborneCount.toString(), `${ps.totalActive > 0 ? ((ps.airborneCount / ps.totalActive) * 100).toFixed(1) : 0}%`],
      ['TOTAL ACTIVE', ps.totalActive.toString(), '100%']
    ],
    theme: 'grid',
    headStyles: { fillColor: [251, 191, 36], textColor: [0, 0, 0], fontStyle: 'bold' },
    margin: { left: margin, right: margin }
  });
  
  yPos = (doc as any).lastAutoTable.finalY + 30;
  
  // By Infection Type
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Cases by Infection Type', margin, yPos);
  yPos += 20;
  
  const typeRows = Object.entries(data.byInfectionType).map(([type, count]) => [type, count.toString()]);
  if (typeRows.length === 0) {
    typeRows.push(['No cases in period', '-']);
  }
  
  autoTable(doc, {
    startY: yPos,
    head: [['Infection Type', 'Count']],
    body: typeRows,
    theme: 'grid',
    headStyles: { fillColor: [251, 191, 36], textColor: [0, 0, 0], fontStyle: 'bold' },
    margin: { left: margin, right: margin },
    tableWidth: 250
  });
  
  yPos = (doc as any).lastAutoTable.finalY + 30;
  
  // Resolution Rates
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Resolution Metrics', margin, yPos);
  yPos += 20;
  
  autoTable(doc, {
    startY: yPos,
    head: [['Metric', 'Value']],
    body: [
      ['Cases Resolved', data.resolutionRate.resolved.toString()],
      ['Cases Still Active', data.resolutionRate.active.toString()],
      ['Resolution Rate', `${data.resolutionRate.rate.toFixed(1)}%`]
    ],
    theme: 'grid',
    headStyles: { fillColor: [251, 191, 36], textColor: [0, 0, 0], fontStyle: 'bold' },
    margin: { left: margin, right: margin },
    tableWidth: 250
  });
  
  yPos = (doc as any).lastAutoTable.finalY + 30;
  
  // Room Check Compliance
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Room Check Compliance', margin, yPos);
  yPos += 20;
  
  autoTable(doc, {
    startY: yPos,
    head: [['Check Item', 'Compliance Rate']],
    body: [
      ['Signage Posted', `${data.roomChecks.signageCompliance.toFixed(1)}%`],
      ['Supplies Stocked', `${data.roomChecks.suppliesCompliance.toFixed(1)}%`],
      ['PPE Available', `${data.roomChecks.ppeCompliance.toFixed(1)}%`]
    ],
    theme: 'grid',
    headStyles: { fillColor: [251, 191, 36], textColor: [0, 0, 0], fontStyle: 'bold' },
    margin: { left: margin, right: margin },
    tableWidth: 250
  });
  
  // Monthly Trends
  doc.addPage();
  yPos = margin;
  
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Monthly Precaution Trends', margin, yPos);
  yPos += 20;
  
  autoTable(doc, {
    startY: yPos,
    head: [['Month', 'New Cases', 'Resolved', 'Net Active', 'Avg Days']],
    body: data.monthlyTrends.map(m => [
      m.month,
      m.newCases.toString(),
      m.resolvedCases.toString(),
      m.activeCases.toString(),
      m.avgDaysOnPrecaution.toString()
    ]),
    theme: 'grid',
    headStyles: { fillColor: [251, 191, 36], textColor: [0, 0, 0], fontStyle: 'bold' },
    margin: { left: margin, right: margin }
  });
  
  // Footer
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(128, 128, 128);
    doc.text(`Generated: ${format(new Date(), 'MM/dd/yyyy HH:mm')} | Page ${i} of ${totalPages}`, pageWidth / 2, pageHeight - 20, { align: 'center' });
    doc.setTextColor(0, 0, 0);
  }
  
  return doc;
};

// =====================================================
// VAX (VACCINATION) QAPI PDF
// =====================================================

export const buildQAPIVaxPdf = (data: QAPIVaxReportData): jsPDF => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  let yPos = margin;

  // Header
  doc.setFillColor(PDF_THEME.primary.r, PDF_THEME.primary.g, PDF_THEME.primary.b);
  doc.rect(0, 0, pageWidth, 80, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(data.facilityName, pageWidth / 2, 35, { align: 'center' });
  
  doc.setFontSize(14);
  doc.text(`QAPI Report: Vaccination ${data.quarter} ${data.year}`, pageWidth / 2, 55, { align: 'center' });
  
  doc.setTextColor(0, 0, 0);
  yPos = 100;
  
  // Census info
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Active Census: ${data.activeCensus} residents | Period: ${data.periodRange}`, margin, yPos);
  yPos += 25;
  
  // Coverage Summary
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Vaccination Coverage Summary', margin, yPos);
  yPos += 20;
  
  const cov = data.coverage;
  autoTable(doc, {
    startY: yPos,
    head: [['Vaccine Type', 'Given', 'Total Eligible', 'Coverage Rate', 'Status']],
    body: [
      ['Influenza', cov.influenza.given.toString(), cov.influenza.total.toString(), `${cov.influenza.rate.toFixed(1)}%`, cov.influenza.rate >= 85 ? '✓ COMPLIANT' : '⚠ REVIEW'],
      ['Pneumococcal', cov.pneumococcal.given.toString(), cov.pneumococcal.total.toString(), `${cov.pneumococcal.rate.toFixed(1)}%`, cov.pneumococcal.rate >= 85 ? '✓ COMPLIANT' : '⚠ REVIEW'],
      ['COVID-19', cov.covid.given.toString(), cov.covid.total.toString(), `${cov.covid.rate.toFixed(1)}%`, cov.covid.rate >= 85 ? '✓ COMPLIANT' : '⚠ REVIEW'],
      ['Tdap', cov.tdap.given.toString(), cov.tdap.total.toString(), `${cov.tdap.rate.toFixed(1)}%`, cov.tdap.rate >= 85 ? '✓ COMPLIANT' : '⚠ REVIEW'],
      ['Other', cov.other.given.toString(), cov.other.total.toString(), `${cov.other.rate.toFixed(1)}%`, '-']
    ],
    theme: 'grid',
    headStyles: { fillColor: [251, 191, 36], textColor: [0, 0, 0], fontStyle: 'bold' },
    margin: { left: margin, right: margin }
  });
  
  yPos = (doc as any).lastAutoTable.finalY + 30;
  
  // Due/Overdue Summary
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Due/Overdue Vaccinations', margin, yPos);
  yPos += 20;
  
  autoTable(doc, {
    startY: yPos,
    head: [['Status', 'Count']],
    body: [
      ['Due (Upcoming)', data.dueOverdue.due.toString()],
      ['Overdue', data.dueOverdue.overdue.toString()],
      ['TOTAL ACTION REQUIRED', data.dueOverdue.total.toString()]
    ],
    theme: 'grid',
    headStyles: { fillColor: [251, 191, 36], textColor: [0, 0, 0], fontStyle: 'bold' },
    margin: { left: margin, right: margin },
    tableWidth: 250
  });
  
  yPos = (doc as any).lastAutoTable.finalY + 30;
  
  // Declinations
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Declination Summary', margin, yPos);
  yPos += 20;
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Total Declinations: ${data.declinations.total}`, margin, yPos);
  yPos += 20;
  
  // By Vaccine
  const declByVax = Object.entries(data.declinations.byVaccine);
  if (declByVax.length > 0) {
    autoTable(doc, {
      startY: yPos,
      head: [['Vaccine', 'Declined']],
      body: declByVax.map(([vax, count]) => [vax, count.toString()]),
      theme: 'grid',
      headStyles: { fillColor: [251, 191, 36], textColor: [0, 0, 0], fontStyle: 'bold' },
      margin: { left: margin, right: margin },
      tableWidth: 200
    });
    yPos = (doc as any).lastAutoTable.finalY + 20;
  }
  
  // By Reason
  const declByReason = Object.entries(data.declinations.byReason);
  if (declByReason.length > 0) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Declination Reasons:', margin, yPos);
    yPos += 15;
    
    autoTable(doc, {
      startY: yPos,
      head: [['Reason', 'Count']],
      body: declByReason.map(([reason, count]) => [reason, count.toString()]),
      theme: 'grid',
      headStyles: { fillColor: [251, 191, 36], textColor: [0, 0, 0], fontStyle: 'bold' },
      margin: { left: margin, right: margin },
      tableWidth: 300
    });
    yPos = (doc as any).lastAutoTable.finalY + 30;
  }
  
  // Re-offer Tracking
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Re-offer Tracking', margin, yPos);
  yPos += 20;
  
  autoTable(doc, {
    startY: yPos,
    head: [['Metric', 'Count']],
    body: [
      ['Due for Re-offer', data.reofferTracking.dueForReoffer.toString()],
      ['Re-offered This Quarter', data.reofferTracking.reofferedThisQuarter.toString()],
      ['Accepted After Re-offer', data.reofferTracking.acceptedAfterReoffer.toString()]
    ],
    theme: 'grid',
    headStyles: { fillColor: [251, 191, 36], textColor: [0, 0, 0], fontStyle: 'bold' },
    margin: { left: margin, right: margin },
    tableWidth: 250
  });
  
  // Monthly Administration
  doc.addPage();
  yPos = margin;
  
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Monthly Vaccination Administration', margin, yPos);
  yPos += 20;
  
  autoTable(doc, {
    startY: yPos,
    head: [['Month', 'Given', 'Declined', 'Due Count']],
    body: data.monthlyAdministration.map(m => [
      m.month,
      m.given.toString(),
      m.declined.toString(),
      m.dueCount.toString()
    ]),
    theme: 'grid',
    headStyles: { fillColor: [251, 191, 36], textColor: [0, 0, 0], fontStyle: 'bold' },
    margin: { left: margin, right: margin }
  });
  
  // Footer
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(128, 128, 128);
    doc.text(`Generated: ${format(new Date(), 'MM/dd/yyyy HH:mm')} | Page ${i} of ${totalPages}`, pageWidth / 2, pageHeight - 20, { align: 'center' });
    doc.setTextColor(0, 0, 0);
  }
  
  return doc;
};

// =====================================================
// COMBINED COMPLETE QAPI PACK
// =====================================================

export const buildCompleteQAPIPack = (
  infectionData: QAPIReportData,
  ipData: QAPIIPReportData,
  vaxData: QAPIVaxReportData
): jsPDF => {
  // Build each section
  const infectionPdf = buildQAPIInfectionControlPdf(infectionData);
  const ipPdf = buildQAPIIPPdf(ipData);
  const vaxPdf = buildQAPIVaxPdf(vaxData);
  
  // Combine into single PDF
  // For simplicity, we'll create a master PDF and copy pages
  // Note: jsPDF doesn't have native page copy, so we build sequentially
  
  const doc = buildQAPIInfectionControlPdf(infectionData);
  
  // Add section divider for IP
  doc.addPage();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  
  doc.setFillColor(PDF_THEME.secondary.r, PDF_THEME.secondary.g, PDF_THEME.secondary.b);
  doc.rect(0, pageHeight / 2 - 60, pageWidth, 120, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.text('SECTION 2', pageWidth / 2, pageHeight / 2 - 20, { align: 'center' });
  doc.setFontSize(20);
  doc.text('Infection Prevention (IP) Report', pageWidth / 2, pageHeight / 2 + 15, { align: 'center' });
  doc.setTextColor(0, 0, 0);
  
  // Add IP content (simplified - would need full page copy for production)
  // For now, add key summary
  doc.addPage();
  let yPos = 40;
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('IP Summary - See Separate IP QAPI Report', 40, yPos);
  
  // Add section divider for VAX
  doc.addPage();
  doc.setFillColor(PDF_THEME.accent.r, PDF_THEME.accent.g, PDF_THEME.accent.b);
  doc.rect(0, pageHeight / 2 - 60, pageWidth, 120, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.text('SECTION 3', pageWidth / 2, pageHeight / 2 - 20, { align: 'center' });
  doc.setFontSize(20);
  doc.text('Vaccination (VAX) Report', pageWidth / 2, pageHeight / 2 + 15, { align: 'center' });
  doc.setTextColor(0, 0, 0);
  
  // Add VAX content summary
  doc.addPage();
  yPos = 40;
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('VAX Summary - See Separate VAX QAPI Report', 40, yPos);
  
  return doc;
};
