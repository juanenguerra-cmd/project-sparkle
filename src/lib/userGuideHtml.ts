// User Guide HTML Generator - For Word-compatible export
import { format } from 'date-fns';

interface GuideSection {
  title: string;
  steps: {
    action: string;
    description: string;
    tip?: string;
  }[];
}

const REPORT_GUIDE: GuideSection = {
  title: 'How to Generate Reports',
  steps: [
    {
      action: 'Navigate to Reports',
      description: 'Click on "Reports" in the left sidebar navigation menu.',
      tip: 'The Reports view shows all available report types organized by category.'
    },
    {
      action: 'Select Report Type',
      description: 'Choose from Operational Reports (Daily Precaution List, Active IP Cases) or Executive Reports (Survey Readiness, Surveillance Metrics).',
    },
    {
      action: 'Configure Date Range',
      description: 'Use the "Report As-of Date" picker to set the date for which the report should reflect active cases.',
      tip: 'For surveillance reports, you can select date ranges or use quarterly presets (Q1-Q4).'
    },
    {
      action: 'Apply Filters',
      description: 'Filter by Unit, Protocol type, or Status depending on the report type.',
    },
    {
      action: 'Generate & Export',
      description: 'Click "Quick Generate" for instant PDF or "Generate" to preview first. Select export format (PDF, CSV, JSON) from the dropdown.',
      tip: 'Use "Quick Generate" to trigger the print dialog directly for clean printing without browser headers.'
    },
  ]
};

const DATA_ENTRY_GUIDE: GuideSection = {
  title: 'How to Enter and Update Tracker Data',
  steps: [
    {
      action: 'Adding a New ABT Record',
      description: 'Go to ABT tab → Click "Add ABT" button → Fill in: Resident (select from census), Medication, Dose, Route, Indication, Infection Source, Start Date.',
      tip: 'The system auto-calculates Days of Therapy based on start/end dates.'
    },
    {
      action: 'Adding an IP Case',
      description: 'Go to IP tab → Click "Add IP Case" → Select Resident, Protocol (EBP or Isolation), Infection Type, Source, Onset Date. Next Review Date is auto-calculated.',
      tip: 'EBP cases default to 7-day reviews, Isolation to 3-day reviews (configurable in Settings).'
    },
    {
      action: 'Recording a Vaccination',
      description: 'Go to VAX tab → Click "Add Record" → Select Resident, Vaccine Type, Status (Given/Due/Declined), and enter Date Given if applicable.',
      tip: 'Use "Mark Given" or "Mark Declined" buttons in the table for quick status updates.'
    },
    {
      action: 'Adding a Clinical Note',
      description: 'Go to Notes tab → Click "Add Note" → Select Resident, Category, check relevant Symptoms, write the narrative note.',
      tip: 'Enable "Requires Follow-up" to add the note to the follow-up worklist.'
    },
    {
      action: 'Editing Existing Records',
      description: 'Click the Edit (pencil) icon on any row to open the edit modal. Make changes and click Save.',
    },
    {
      action: 'Importing Data from Files',
      description: 'Each tracker has an "Import" button. Upload CSV or Excel files. The system will map columns and preview before confirming.',
      tip: 'Column headers are matched flexibly (e.g., "Patient Name", "Resident Name", "Name" all work).'
    },
  ]
};

const BACKUP_GUIDE: GuideSection = {
  title: 'Data Backup and Recovery',
  steps: [
    {
      action: 'Creating a Backup',
      description: 'Click the "Data" button in the header → Click "Export All Data" → A JSON file containing all census, tracker data, and settings will download.',
      tip: 'Backup daily! The backup reminder banner will alert you based on your configured frequency.'
    },
    {
      action: 'Restoring from Backup',
      description: 'Click "Data" → "Import Data Backup" → Select your backup JSON file → Confirm the merge. Existing data is preserved, duplicates are skipped.',
    },
    {
      action: 'Configuring Backup Reminders',
      description: 'Click the gear icon on the backup reminder banner → Set reminder frequency (daily/3 days/weekly) → Reminders appear after the configured interval.',
    },
  ]
};

const LINE_LISTING_GUIDE: GuideSection = {
  title: 'Outbreak & Line Listing Management',
  steps: [
    {
      action: 'Creating an Outbreak',
      description: 'Go to Outbreak tab → Click "New Outbreak" → Enter Name (or select from presets), Type (ILI, GI, Skin, COVID), Start Date.',
    },
    {
      action: 'Adding Line Listing Entries',
      description: 'Select the outbreak → Click "Add Case" → For residents: select from census dropdown. For Staff/Visitors: enter name manually.',
      tip: 'Residents are sorted alphabetically for easy selection.'
    },
    {
      action: 'Configuring Line Listing Fields',
      description: 'Go to Settings → Line Listing Form Configuration → Select outbreak type → Enable/disable fields to match your CDC template requirements.',
    },
    {
      action: 'Printing Line Listings',
      description: 'Go to Reports → Line Listing Reports → Select the outbreak → Generate PDF in landscape format matching CDC templates.',
    },
  ]
};

export const generateUserGuideHtml = (facilityName: string): string => {
  const sections = [REPORT_GUIDE, DATA_ENTRY_GUIDE, BACKUP_GUIDE, LINE_LISTING_GUIDE];
  
  const css = `
    <style>
      body { font-family: Calibri, Arial, sans-serif; max-width: 8.5in; margin: 0 auto; padding: 1in; line-height: 1.6; }
      h1 { color: #2563eb; font-size: 28pt; border-bottom: 3px solid #2563eb; padding-bottom: 10px; }
      h2 { color: #1e40af; font-size: 18pt; margin-top: 30px; border-left: 4px solid #2563eb; padding-left: 12px; }
      h3 { color: #374151; font-size: 14pt; margin-top: 20px; }
      .meta { color: #6b7280; font-size: 11pt; margin-bottom: 30px; }
      .step { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; margin: 15px 0; }
      .step-number { display: inline-block; width: 28px; height: 28px; background: #2563eb; color: white; border-radius: 50%; text-align: center; line-height: 28px; font-weight: bold; margin-right: 10px; }
      .step-action { font-weight: bold; font-size: 13pt; color: #1f2937; }
      .step-desc { margin-top: 8px; color: #374151; }
      .tip { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 10px 15px; margin-top: 10px; font-size: 10pt; }
      .tip::before { content: "💡 Tip: "; font-weight: bold; }
      .screenshot-placeholder { border: 2px dashed #d1d5db; background: #f9fafb; padding: 40px; text-align: center; color: #9ca3af; margin: 15px 0; border-radius: 8px; }
      .toc { background: #f1f5f9; padding: 20px; border-radius: 8px; margin: 20px 0; }
      .toc ul { list-style: none; padding-left: 0; }
      .toc li { padding: 5px 0; }
      .footer { margin-top: 50px; padding-top: 20px; border-top: 1px solid #e2e8f0; color: #6b7280; font-size: 10pt; text-align: center; }
    </style>
  `;
  
  const toc = `
    <div class="toc">
      <h3>Table of Contents</h3>
      <ul>
        ${sections.map((s, i) => `<li>${i + 1}. ${s.title}</li>`).join('')}
        <li>5. Quick Reference</li>
      </ul>
    </div>
  `;
  
  const sectionHtml = sections.map((section, sIdx) => `
    <h2>${sIdx + 1}. ${section.title}</h2>
    ${section.steps.map((step, stepIdx) => `
      <div class="step">
        <div>
          <span class="step-number">${stepIdx + 1}</span>
          <span class="step-action">${step.action}</span>
        </div>
        <div class="step-desc">${step.description}</div>
        ${step.tip ? `<div class="tip">${step.tip}</div>` : ''}
        <div class="screenshot-placeholder">[Screenshot Placeholder: ${step.action}]</div>
      </div>
    `).join('')}
  `).join('');
  
  const quickRef = `
    <h2>5. Quick Reference</h2>
    <table style="width:100%; border-collapse: collapse; margin-top: 15px;">
      <tr style="background: #2563eb; color: white;">
        <th style="padding: 10px; text-align: left;">Action</th>
        <th style="padding: 10px; text-align: left;">Location</th>
      </tr>
      <tr style="background: #f8fafc;"><td style="padding: 8px; border: 1px solid #e2e8f0;">Add ABT case</td><td style="padding: 8px; border: 1px solid #e2e8f0;">ABT Tab → Add ABT button</td></tr>
      <tr><td style="padding: 8px; border: 1px solid #e2e8f0;">Add IP precaution</td><td style="padding: 8px; border: 1px solid #e2e8f0;">IP Tab → Add IP Case button</td></tr>
      <tr style="background: #f8fafc;"><td style="padding: 8px; border: 1px solid #e2e8f0;">Record vaccination</td><td style="padding: 8px; border: 1px solid #e2e8f0;">VAX Tab → Add Record or Mark Given</td></tr>
      <tr><td style="padding: 8px; border: 1px solid #e2e8f0;">Add clinical note</td><td style="padding: 8px; border: 1px solid #e2e8f0;">Notes Tab → Add Note button</td></tr>
      <tr style="background: #f8fafc;"><td style="padding: 8px; border: 1px solid #e2e8f0;">Generate report</td><td style="padding: 8px; border: 1px solid #e2e8f0;">Reports Tab → Quick Generate</td></tr>
      <tr><td style="padding: 8px; border: 1px solid #e2e8f0;">Backup data</td><td style="padding: 8px; border: 1px solid #e2e8f0;">Header → Data → Export All Data</td></tr>
      <tr style="background: #f8fafc;"><td style="padding: 8px; border: 1px solid #e2e8f0;">Create outbreak</td><td style="padding: 8px; border: 1px solid #e2e8f0;">Outbreak Tab → New Outbreak</td></tr>
      <tr><td style="padding: 8px; border: 1px solid #e2e8f0;">Configure settings</td><td style="padding: 8px; border: 1px solid #e2e8f0;">Settings Tab (sidebar)</td></tr>
    </table>
  `;
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>ICN Hub User Guide - ${facilityName}</title>
      ${css}
    </head>
    <body>
      <h1>ICN Hub User Guide</h1>
      <div class="meta">
        <strong>Facility:</strong> ${facilityName}<br>
        <strong>Generated:</strong> ${format(new Date(), 'PPPP')}<br>
        <strong>Version:</strong> 2.0.0
      </div>
      
      ${toc}
      ${sectionHtml}
      ${quickRef}
      
      <div class="footer">
        <p>ICN Hub - Infection Control Nurse Hub</p>
        <p>For questions or support, contact your system administrator.</p>
      </div>
    </body>
    </html>
  `;
};

// Export as downloadable Word-compatible HTML file
export const downloadUserGuideAsWord = (facilityName: string): void => {
  const html = generateUserGuideHtml(facilityName);
  const blob = new Blob([html], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ICN_Hub_User_Guide_${facilityName.replace(/\s+/g, '_')}.doc`;
  a.click();
  URL.revokeObjectURL(url);
};
