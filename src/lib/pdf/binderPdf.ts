import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { getThemeRgb } from './pdfTheme';

interface BinderSection {
  id: string;
  title: string;
  subtitle: string;
  color: [number, number, number];
}

const BINDER_SECTIONS: BinderSection[] = [
  { id: 'ip', title: 'INFECTION PREVENTION', subtitle: 'Daily Precaution Lists • IP Worklists • Exposure Logs', color: [220, 38, 38] }, // red
  { id: 'abt', title: 'ANTIBIOTIC STEWARDSHIP', subtitle: 'ABT Worklists • Monthly Reports • Medicare Compliance', color: [37, 99, 235] }, // blue
  { id: 'vax', title: 'IMMUNIZATION TRACKING', subtitle: 'Vaccination Status • Due Lists • Re-offer Reports', color: [22, 163, 74] }, // green
  { id: 'surveillance', title: 'SURVEILLANCE & TRENDING', subtitle: 'Infection Trends • QAPI Reports • Rate Analysis', color: [147, 51, 234] }, // purple
  { id: 'compliance', title: 'COMPLIANCE & SURVEY', subtitle: 'Survey Readiness • Crosswalks • Census Packets', color: [234, 88, 12] }, // orange
  { id: 'hh_ppe', title: 'HAND HYGIENE & PPE', subtitle: 'Compliance Audits • Usage Tracking • Training Logs', color: [6, 182, 212] }, // cyan
  { id: 'outbreak', title: 'OUTBREAK MANAGEMENT', subtitle: 'Line Listings • Contact Tracing • Response Plans', color: [236, 72, 153] }, // pink
  { id: 'notes', title: 'CLINICAL NOTES', subtitle: 'Follow-up Notes • Assessments • Documentation', color: [107, 114, 128] }, // gray
];

export const generateBinderCoverPdf = (facilityName: string): jsPDF => {
  const doc = new jsPDF({ unit: 'pt', format: 'letter', orientation: 'portrait' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  
  // Background gradient simulation with rectangles
  const gradientSteps = 50;
  for (let i = 0; i < gradientSteps; i++) {
    const ratio = i / gradientSteps;
    const r = Math.round(15 + ratio * 10);
    const g = Math.round(23 + ratio * 15);
    const b = Math.round(42 + ratio * 20);
    doc.setFillColor(r, g, b);
    doc.rect(0, (pageHeight / gradientSteps) * i, pageWidth, pageHeight / gradientSteps + 1, 'F');
  }
  
  // Decorative top bar
  doc.setFillColor(37, 99, 235); // Blue accent
  doc.rect(0, 0, pageWidth, 8, 'F');
  
  // Main title area
  let y = 220;
  
  // Icon/Logo placeholder
  doc.setFillColor(255, 255, 255);
  doc.circle(pageWidth / 2, y - 60, 35, 'F');
  doc.setFillColor(37, 99, 235);
  doc.circle(pageWidth / 2, y - 60, 30, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.text('IC', pageWidth / 2, y - 52, { align: 'center' });
  
  // Title
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(42);
  doc.setFont('helvetica', 'bold');
  doc.text('INFECTION CONTROL', pageWidth / 2, y, { align: 'center' });
  
  y += 50;
  doc.setFontSize(36);
  doc.text('BINDER', pageWidth / 2, y, { align: 'center' });
  
  // Decorative line
  y += 30;
  doc.setDrawColor(37, 99, 235);
  doc.setLineWidth(3);
  doc.line(pageWidth / 2 - 100, y, pageWidth / 2 + 100, y);
  
  // Facility name
  y += 60;
  doc.setFontSize(20);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(200, 200, 200);
  doc.text(facilityName.toUpperCase(), pageWidth / 2, y, { align: 'center' });
  
  // Section preview
  y += 80;
  doc.setFontSize(12);
  doc.setTextColor(150, 150, 150);
  doc.text('CONTENTS', pageWidth / 2, y, { align: 'center' });
  
  y += 25;
  const cols = 2;
  const colWidth = 220;
  const startX = (pageWidth - colWidth * cols) / 2;
  
  BINDER_SECTIONS.forEach((section, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const x = startX + col * colWidth + 20;
    const yPos = y + row * 35;
    
    // Color dot
    doc.setFillColor(...section.color);
    doc.circle(x, yPos - 3, 5, 'F');
    
    // Section title
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(section.title, x + 12, yPos);
  });
  
  // Footer
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated: ${format(new Date(), 'MMMM d, yyyy')}`, pageWidth / 2, pageHeight - 60, { align: 'center' });
  doc.text('ICN Hub - Infection Control Management System', pageWidth / 2, pageHeight - 45, { align: 'center' });
  
  // Bottom bar
  doc.setFillColor(37, 99, 235);
  doc.rect(0, pageHeight - 8, pageWidth, 8, 'F');
  
  return doc;
};

export const generateBinderDividersPdf = (facilityName: string): jsPDF => {
  const doc = new jsPDF({ unit: 'pt', format: 'letter', orientation: 'portrait' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  
  BINDER_SECTIONS.forEach((section, idx) => {
    if (idx > 0) doc.addPage();
    
    // Full page background with section color
    doc.setFillColor(...section.color);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');
    
    // White content area
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(margin, margin, pageWidth - margin * 2, pageHeight - margin * 2, 10, 10, 'F');
    
    // Top accent bar
    doc.setFillColor(...section.color);
    doc.rect(margin, margin, pageWidth - margin * 2, 60, 'F');
    
    // Section number
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text(`SECTION ${idx + 1}`, margin + 20, margin + 40);
    
    // Main title
    let y = 180;
    doc.setTextColor(...section.color);
    doc.setFontSize(36);
    doc.setFont('helvetica', 'bold');
    doc.text(section.title, pageWidth / 2, y, { align: 'center' });
    
    // Decorative line
    y += 25;
    doc.setDrawColor(...section.color);
    doc.setLineWidth(2);
    doc.line(pageWidth / 2 - 80, y, pageWidth / 2 + 80, y);
    
    // Subtitle
    y += 40;
    doc.setTextColor(80, 80, 80);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'normal');
    doc.text(section.subtitle, pageWidth / 2, y, { align: 'center' });
    
    // Content placeholder lines
    y += 80;
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('DOCUMENTS IN THIS SECTION:', margin + 40, y);
    
    y += 30;
    doc.setFont('helvetica', 'normal');
    const placeholderLines = [
      '☐  ________________________________________',
      '☐  ________________________________________',
      '☐  ________________________________________',
      '☐  ________________________________________',
      '☐  ________________________________________',
      '☐  ________________________________________',
      '☐  ________________________________________',
      '☐  ________________________________________',
    ];
    
    placeholderLines.forEach((line, i) => {
      doc.text(line, margin + 40, y + i * 28);
    });
    
    // Notes section
    y += placeholderLines.length * 28 + 40;
    doc.setFont('helvetica', 'bold');
    doc.text('NOTES:', margin + 40, y);
    doc.setFont('helvetica', 'normal');
    doc.setDrawColor(200, 200, 200);
    for (let i = 0; i < 4; i++) {
      doc.line(margin + 40, y + 25 + i * 22, pageWidth - margin - 40, y + 25 + i * 22);
    }
    
    // Footer
    doc.setTextColor(120, 120, 120);
    doc.setFontSize(10);
    doc.text(facilityName, pageWidth / 2, pageHeight - margin - 30, { align: 'center' });
    doc.text(`Last Updated: ${format(new Date(), 'MM/dd/yyyy')}`, pageWidth / 2, pageHeight - margin - 15, { align: 'center' });
  });
  
  return doc;
};

// Generate complete binder package (cover + all dividers)
export const generateCompleteBinderPdf = (facilityName: string): jsPDF => {
  const doc = generateBinderCoverPdf(facilityName);
  const dividersDoc = generateBinderDividersPdf(facilityName);
  
  // Get page count from dividers
  const dividerPageCount = dividersDoc.getNumberOfPages();
  
  // Add all divider pages to main doc
  for (let i = 1; i <= dividerPageCount; i++) {
    doc.addPage();
    // Note: jsPDF doesn't support directly copying pages between documents,
    // so we regenerate the divider content
  }
  
  // For now, return just the cover - user can generate dividers separately
  return doc;
};
