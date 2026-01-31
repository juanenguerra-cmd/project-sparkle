// Release Notes PDF Generator - Feature Milestones & Capabilities
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { getThemeRgb } from './pdfTheme';

const getHeaderColor = (): { r: number; g: number; b: number } => {
  const rgb = getThemeRgb('--primary', [74, 144, 226]);
  return { r: rgb[0], g: rgb[1], b: rgb[2] };
};

interface ReleaseNote {
  version: string;
  date: string;
  title: string;
  features: string[];
}

const RELEASE_NOTES: ReleaseNote[] = [
  {
    version: '2.0.0',
    date: 'January 2025',
    title: 'Full F-Tag Compliance & Outbreak Management',
    features: [
      'Line Listing System with CDC-compliant templates (ILI, GI, Skin, COVID)',
      'Configurable line listing forms with custom field support',
      'Outbreak tracking with contact tracing capabilities',
      'Staff/Visitor line listing entries for comprehensive tracking',
      'Landscape PDF exports matching CDC surveillance formats',
      'Enhanced symptom surveillance with auto-classification',
      'Follow-up note tracking with reminder system',
    ]
  },
  {
    version: '1.5.0',
    date: 'December 2024',
    title: 'Surveillance & Executive Reporting',
    features: [
      'Antibiotic & Infection Surveillance Module with NHSN metrics',
      'Infection Rate per 1000 Resident Days calculation',
      'Antibiotic Utilization Ratio (AUR) with national benchmarks',
      'Quarterly reporting with Q1-Q4 date range filtering',
      'Infection trend charts (Line, Bar, Pie, Area)',
      'Survey Readiness Packet generation',
      'Floor Layout Heatmap for unit-based visualization',
    ]
  },
  {
    version: '1.4.0',
    date: 'November 2024',
    title: 'Enhanced Stewardship & IP Tracking',
    features: [
      'F881 Antibiotic Stewardship fields (prescriber, culture results, timeout)',
      'F880 Enhanced IP Case fields (high-contact care, PPE, signage)',
      '72/96/120 hour review tracking with configurable cadence',
      'Adverse effects and C.diff risk documentation',
      'Review notes and last review date tracking',
      'Overdue review alerts and notifications',
    ]
  },
  {
    version: '1.3.0',
    date: 'October 2024',
    title: 'Vaccination Compliance & F883/F887',
    features: [
      'Flu season logic with automatic outdated detection',
      'Vaccination offer date and education tracking',
      'Declination documentation with reason capture',
      'Consent form and lot number fields',
      'Manufacturer and administration site tracking',
      'Vaccination compliance rate calculations',
    ]
  },
  {
    version: '1.2.0',
    date: 'September 2024',
    title: 'Clinical Notes & Symptom Tracking',
    features: [
      'Symptom surveillance with category auto-classification',
      'Respiratory, GI, Skin, UTI symptom categories',
      'Follow-up flagging with date and status tracking',
      'Note-to-line-listing linking capability',
      'Recent notes dashboard widget (last 7 days)',
      'Notes export and search functionality',
    ]
  },
  {
    version: '1.1.0',
    date: 'August 2024',
    title: 'Report Suite & PDF Generation',
    features: [
      'Daily Precaution List with shift-based filtering',
      'Active IP Case Report with protocol breakdown',
      'Standard of Care weekly summary report',
      'ABT Review Report with stewardship metrics',
      'PDF export with facility branding',
      'CSV and JSON export formats',
      'Custom report descriptions in settings',
    ]
  },
  {
    version: '1.0.0',
    date: 'July 2024',
    title: 'Initial Release - Core Tracker Suite',
    features: [
      'Census management with import/export',
      'Antibiotic Therapy (ABT) Tracker',
      'Infection Prevention (IP) Case Tracker',
      'Vaccination (VAX) Tracker',
      'Dashboard with real-time metrics',
      'Data backup and restore functionality',
      'Audit log for change tracking',
      'Configurable facility settings',
    ]
  },
];

export const generateReleaseNotesPdf = (facilityName: string): jsPDF => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const headerColor = getHeaderColor();
  
  // Title Page
  doc.setFillColor(headerColor.r, headerColor.g, headerColor.b);
  doc.rect(0, 0, pageWidth, 70, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(32);
  doc.setFont('helvetica', 'bold');
  doc.text('ICN Hub', pageWidth / 2, 32, { align: 'center' });
  
  doc.setFontSize(18);
  doc.setFont('helvetica', 'normal');
  doc.text('Release Notes & Feature Milestones', pageWidth / 2, 50, { align: 'center' });
  
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(12);
  doc.text(`Facility: ${facilityName}`, pageWidth / 2, 90, { align: 'center' });
  doc.text(`Generated: ${format(new Date(), 'PPP')}`, pageWidth / 2, 100, { align: 'center' });
  
  // Version Summary
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Version History', 14, 125);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  const summaryRows = RELEASE_NOTES.map(r => [r.version, r.date, r.title]);
  
  autoTable(doc, {
    startY: 132,
    head: [['Version', 'Date', 'Milestone']],
    body: summaryRows,
    styles: { fontSize: 10, cellPadding: 4 },
    headStyles: {
      fillColor: [headerColor.r, headerColor.g, headerColor.b],
      textColor: [255, 255, 255],
      fontStyle: 'bold'
    },
    columnStyles: {
      0: { cellWidth: 25, fontStyle: 'bold' },
      1: { cellWidth: 35 },
      2: { cellWidth: 'auto' }
    }
  });
  
  // Detailed Release Notes
  RELEASE_NOTES.forEach((release, idx) => {
    doc.addPage();
    
    // Version header
    doc.setFillColor(headerColor.r, headerColor.g, headerColor.b);
    doc.rect(0, 0, pageWidth, 30, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(`Version ${release.version}`, 14, 18);
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(`${release.date} — ${release.title}`, 14, 26);
    
    doc.setTextColor(0, 0, 0);
    
    // Feature list
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('Features & Capabilities', 14, 45);
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    
    let y = 55;
    release.features.forEach((feature, fIdx) => {
      if (y > pageHeight - 30) {
        doc.addPage();
        y = 30;
      }
      
      doc.setFillColor(240, 245, 250);
      doc.roundedRect(14, y - 5, pageWidth - 28, 12, 2, 2, 'F');
      
      doc.setTextColor(headerColor.r, headerColor.g, headerColor.b);
      doc.text(`${fIdx + 1}.`, 18, y + 3);
      
      doc.setTextColor(0, 0, 0);
      doc.text(feature, 30, y + 3);
      
      y += 16;
    });
    
    // Page number
    doc.setFontSize(9);
    doc.setTextColor(128, 128, 128);
    doc.text(`Page ${idx + 2}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
  });
  
  // Footer page
  doc.addPage();
  
  doc.setFillColor(headerColor.r, headerColor.g, headerColor.b);
  doc.rect(0, 0, pageWidth, 30, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Coming Soon', 14, 20);
  
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  
  const roadmap = [
    'Cloudflare D1 database integration for multi-device sync',
    'Scheduled report email notifications',
    'Role-based access control',
    'Mobile-responsive survey mode',
    'Integration with pharmacy/EMR systems via API',
    'Advanced analytics with trend prediction',
  ];
  
  let roadmapY = 50;
  roadmap.forEach((item, idx) => {
    doc.setFillColor(250, 250, 250);
    doc.roundedRect(14, roadmapY - 5, pageWidth - 28, 12, 2, 2, 'F');
    doc.text(`• ${item}`, 18, roadmapY + 3);
    roadmapY += 16;
  });
  
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text('For feature requests or feedback, contact your system administrator.', pageWidth / 2, pageHeight - 20, { align: 'center' });
  
  return doc;
};

// Export release notes as structured data for Word export
export const getReleaseNotesData = () => RELEASE_NOTES;
