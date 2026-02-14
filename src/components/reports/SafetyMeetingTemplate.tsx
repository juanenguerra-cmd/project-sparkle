import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Printer, Download, FileText } from 'lucide-react';
import { loadDB } from '@/lib/database';
import { formatDate } from '@/lib/noteHelpers';
import { toast as sonnerToast } from 'sonner';

interface SafetyMeetingTemplateProps {
  open: boolean;
  onClose: () => void;
}

interface MeetingData {
  facilityName: string;
  meetingDate: string;
  meetingTime: string;
  location: string;
  facilitator: string;
  currentMonthCases: number;
  previousMonthCases: number;
  activeCases: number;
  contactPrecautions: number;
  dropletPrecautions: number;
  airbornePrecautions: number;
  ebpCases: number;
  cdiffCases: number;
  topOrganisms: string[];
  fluVaccinated: number;
  fluTotal: number;
  covidVaccinated: number;
  covidTotal: number;
  residentsOnABT: number;
  reviewsCompleted: number;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const SafetyMeetingTemplate = ({ open, onClose }: SafetyMeetingTemplateProps) => {
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth());
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [meetingData, setMeetingData] = useState<MeetingData | null>(null);

  const calculateMeetingData = useCallback(() => {
    const db = loadDB();
    const facilityName = db.settings.facilityName || 'Healthcare Facility';

    const startDate = new Date(selectedYear, selectedMonth, 1);
    const endDate = new Date(selectedYear, selectedMonth + 1, 0);

    const currentMonthCases = db.records.ip_cases.filter(ipCase => {
      const caseDate = new Date(ipCase.onset_date || ipCase.createdAt);
      return caseDate >= startDate && caseDate <= endDate;
    });

    const prevStartDate = new Date(selectedYear, selectedMonth - 1, 1);
    const prevEndDate = new Date(selectedYear, selectedMonth, 0);
    const previousMonthCases = db.records.ip_cases.filter(ipCase => {
      const caseDate = new Date(ipCase.onset_date || ipCase.createdAt);
      return caseDate >= prevStartDate && caseDate <= prevEndDate;
    });

    const activeCases = currentMonthCases.filter(c =>
      c.status !== 'resolved' && c.status !== 'discontinued'
    );

    let contact = 0;
    let droplet = 0;
    let airborne = 0;
    let ebp = 0;
    let cdiff = 0;

    currentMonthCases.forEach(ipCase => {
      const type = ipCase.precaution_type?.toLowerCase() || '';
      if (type.includes('contact') && type.includes('plus')) cdiff++;
      else if (type.includes('contact')) contact++;
      else if (type.includes('droplet')) droplet++;
      else if (type.includes('airborne')) airborne++;
      else if (type.includes('ebp') || type.includes('enhanced')) ebp++;
    });

    const organismCounts: Record<string, number> = {};
    currentMonthCases.forEach(ipCase => {
      const organism = ipCase.organism || 'Unknown';
      organismCounts[organism] = (organismCounts[organism] || 0) + 1;
    });

    const topOrganisms = Object.entries(organismCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([org]) => org);

    const fluVax = db.records.vax.filter(v =>
      v.vaccine?.toLowerCase().includes('influenza') && v.status === 'given'
    );
    const fluTotal = db.records.vax.filter(v =>
      v.vaccine?.toLowerCase().includes('influenza')
    );

    const covidVax = db.records.vax.filter(v =>
      v.vaccine?.toLowerCase().includes('covid') && v.status === 'given'
    );
    const covidTotal = db.records.vax.filter(v =>
      v.vaccine?.toLowerCase().includes('covid')
    );

    const abtActive = db.records.abx.filter(a => a.status === 'active');
    const abtReviews = db.records.abx.filter(a => a.last_review_date);

    setMeetingData({
      facilityName,
      meetingDate: formatDate(new Date().toISOString().split('T')[0]),
      meetingTime: '10:00 AM',
      location: 'Conference Room',
      facilitator: 'Infection Preventionist',
      currentMonthCases: currentMonthCases.length,
      previousMonthCases: previousMonthCases.length,
      activeCases: activeCases.length,
      contactPrecautions: contact,
      dropletPrecautions: droplet,
      airbornePrecautions: airborne,
      ebpCases: ebp,
      cdiffCases: cdiff,
      topOrganisms,
      fluVaccinated: fluVax.length,
      fluTotal: fluTotal.length,
      covidVaccinated: covidVax.length,
      covidTotal: covidTotal.length,
      residentsOnABT: abtActive.length,
      reviewsCompleted: abtReviews.length,
    });
  }, [selectedMonth, selectedYear]);

  useEffect(() => {
    if (open) {
      calculateMeetingData();
    }
  }, [calculateMeetingData, open]);

  const generateHTML = (): string => {
    if (!meetingData) return '';

    const fluRate = meetingData.fluTotal > 0
      ? ((meetingData.fluVaccinated / meetingData.fluTotal) * 100).toFixed(1)
      : '0.0';
    const covidRate = meetingData.covidTotal > 0
      ? ((meetingData.covidVaccinated / meetingData.covidTotal) * 100).toFixed(1)
      : '0.0';
    const percentChange = meetingData.previousMonthCases > 0
      ? (((meetingData.currentMonthCases - meetingData.previousMonthCases) / meetingData.previousMonthCases) * 100).toFixed(1)
      : '0.0';

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Infection Control Safety Meeting - ${MONTHS[selectedMonth]} ${selectedYear}</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 11pt; color: #000; padding: 0.5in; }
    .page-header { text-align: center; margin-bottom: 20px; border-bottom: 3px solid #2c5aa0; padding-bottom: 15px; }
    .page-header h1 { font-size: 18pt; color: #2c5aa0; margin-bottom: 5px; }
    .page-header h2 { font-size: 14pt; color: #555; font-weight: normal; }
    .meeting-info { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px; background: #f5f5f5; padding: 15px; border-radius: 5px; }
    .meeting-info-item { display: flex; }
    .meeting-info-item strong { width: 120px; color: #2c5aa0; }
    .meeting-info-item span { flex: 1; border-bottom: 1px dotted #999; padding-left: 5px; }
    .section-title { background: #2c5aa0; color: white; padding: 8px 12px; font-size: 12pt; font-weight: bold; margin-bottom: 10px; border-radius: 3px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
    th { background: #e8eef7; color: #2c5aa0; font-weight: bold; padding: 8px; border: 1px solid #ccc; font-size: 10pt; text-align: left; }
    td { padding: 8px; border: 1px solid #ccc; font-size: 10pt; }
    .metrics-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 20px; }
    .metric-card { background: #f8f9fa; border: 2px solid #dee2e6; border-radius: 5px; padding: 15px; text-align: center; }
    .metric-value { font-size: 24pt; font-weight: bold; color: #2c5aa0; display: block; margin-bottom: 5px; }
    .metric-label { font-size: 9pt; color: #666; text-transform: uppercase; }
    .bullet-list { padding-left: 25px; margin-bottom: 15px; }
    .footer { margin-top: 20px; text-align: center; font-size: 8pt; color: #666; border-top: 1px solid #ccc; padding-top: 5px; }
  </style>
</head>
<body>
  <div class="page-header">
    <h1>${meetingData.facilityName}</h1>
    <h2>Infection Control & Safety Meeting Minutes</h2>
  </div>

  <div class="meeting-info">
    <div class="meeting-info-item"><strong>Meeting Date:</strong><span contenteditable="true">${meetingData.meetingDate}</span></div>
    <div class="meeting-info-item"><strong>Meeting Time:</strong><span contenteditable="true">${meetingData.meetingTime}</span></div>
    <div class="meeting-info-item"><strong>Location:</strong><span contenteditable="true">${meetingData.location}</span></div>
    <div class="meeting-info-item"><strong>Facilitator:</strong><span contenteditable="true">${meetingData.facilitator}</span></div>
  </div>

  <div class="section-title">Surveillance Data - ${MONTHS[selectedMonth]} ${selectedYear}</div>
  <div class="metrics-grid">
    <div class="metric-card"><span class="metric-value">${meetingData.currentMonthCases}</span><span class="metric-label">Total Cases</span></div>
    <div class="metric-card"><span class="metric-value">${meetingData.activeCases}</span><span class="metric-label">Active Cases</span></div>
    <div class="metric-card"><span class="metric-value">${meetingData.cdiffCases}</span><span class="metric-label">C. diff Cases</span></div>
  </div>

  <table>
    <thead>
      <tr><th>Precaution Type</th><th style="text-align:center;">Current</th><th style="text-align:center;">Previous</th><th style="text-align:center;">Change</th></tr>
    </thead>
    <tbody>
      <tr><td>Contact</td><td style="text-align:center;"><strong>${meetingData.contactPrecautions}</strong></td><td style="text-align:center;" contenteditable="true">-</td><td style="text-align:center;" contenteditable="true">-</td></tr>
      <tr><td>Droplet</td><td style="text-align:center;"><strong>${meetingData.dropletPrecautions}</strong></td><td style="text-align:center;" contenteditable="true">-</td><td style="text-align:center;" contenteditable="true">-</td></tr>
      <tr><td>Airborne</td><td style="text-align:center;"><strong>${meetingData.airbornePrecautions}</strong></td><td style="text-align:center;" contenteditable="true">-</td><td style="text-align:center;" contenteditable="true">-</td></tr>
      <tr><td>Enhanced Barrier (EBP)</td><td style="text-align:center;"><strong>${meetingData.ebpCases}</strong></td><td style="text-align:center;" contenteditable="true">-</td><td style="text-align:center;" contenteditable="true">-</td></tr>
      <tr><td>Contact Plus (C. diff)</td><td style="text-align:center;"><strong>${meetingData.cdiffCases}</strong></td><td style="text-align:center;" contenteditable="true">-</td><td style="text-align:center;" contenteditable="true">-</td></tr>
    </tbody>
  </table>

  <div class="section-title">Vaccination Status</div>
  <table>
    <thead><tr><th>Vaccine</th><th style="text-align:center;">Vaccinated</th><th style="text-align:center;">Total</th><th style="text-align:center;">Rate</th></tr></thead>
    <tbody>
      <tr><td>Influenza</td><td style="text-align:center;"><strong>${meetingData.fluVaccinated}</strong></td><td style="text-align:center;"><strong>${meetingData.fluTotal}</strong></td><td style="text-align:center;"><strong>${fluRate}%</strong></td></tr>
      <tr><td>COVID-19</td><td style="text-align:center;"><strong>${meetingData.covidVaccinated}</strong></td><td style="text-align:center;"><strong>${meetingData.covidTotal}</strong></td><td style="text-align:center;"><strong>${covidRate}%</strong></td></tr>
    </tbody>
  </table>

  <div class="section-title">Antibiotic Stewardship</div>
  <ul class="bullet-list">
    <li>Residents currently on antibiotics: <strong>${meetingData.residentsOnABT}</strong></li>
    <li>Stewardship reviews completed: <strong>${meetingData.reviewsCompleted}</strong></li>
  </ul>

  <div class="footer">Generated: ${new Date().toLocaleDateString()} | Change vs previous month: ${percentChange}%</div>
</body>
</html>
`;
  };

  const handlePrint = () => {
    const html = generateHTML();
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 500);
    }
  };

  const handleDownload = () => {
    const html = generateHTML();
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `IC_Safety_Meeting_${MONTHS[selectedMonth]}_${selectedYear}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    sonnerToast.success('Meeting report downloaded!');
  };

  const handlePreview = () => {
    const html = generateHTML();
    const previewWindow = window.open('', '_blank');
    if (previewWindow) {
      previewWindow.document.write(html);
      previewWindow.document.close();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Safety Meeting Report Generator
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Report Month</Label>
              <Select
                value={selectedMonth.toString()}
                onValueChange={(val) => setSelectedMonth(parseInt(val, 10))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((month, idx) => (
                    <SelectItem key={idx} value={idx.toString()}>{month}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Year</Label>
              <Select
                value={selectedYear.toString()}
                onValueChange={(val) => setSelectedYear(parseInt(val, 10))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[2024, 2025, 2026, 2027, 2028].map(year => (
                    <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {meetingData && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-semibold text-sm mb-2">Data Preview:</h4>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div><strong>Total Cases:</strong> {meetingData.currentMonthCases}</div>
                <div><strong>Active Cases:</strong> {meetingData.activeCases}</div>
                <div><strong>C. diff:</strong> {meetingData.cdiffCases}</div>
                <div><strong>Flu Vax:</strong> {meetingData.fluVaccinated}/{meetingData.fluTotal}</div>
                <div><strong>COVID Vax:</strong> {meetingData.covidVaccinated}/{meetingData.covidTotal}</div>
                <div><strong>On ABT:</strong> {meetingData.residentsOnABT}</div>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <Button onClick={handlePreview} variant="outline" className="flex-1">
              <FileText className="w-4 h-4 mr-2" />
              Preview
            </Button>
            <Button onClick={handleDownload} variant="outline" className="flex-1">
              <Download className="w-4 h-4 mr-2" />
              Download HTML
            </Button>
            <Button onClick={handlePrint} className="flex-1">
              <Printer className="w-4 h-4 mr-2" />
              Print
            </Button>
          </div>

          <div className="text-xs text-muted-foreground space-y-1">
            <p>✅ Auto-populated: Surveillance data, vaccination rates, precaution counts</p>
            <p>✏️ Editable: All fields can be edited in the generated report before printing</p>
            <p>🖨️ Print-optimized with proper page breaks and formatting</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SafetyMeetingTemplate;
