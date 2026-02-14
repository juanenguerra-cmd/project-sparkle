import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Copy, FileText, TrendingUp, Shield, AlertTriangle, CheckCircle, Printer } from 'lucide-react';
import { loadDB, normalizeIPStatus } from '@/lib/database';
import { copyToClipboardWithToast, formatDate, formatDateTime } from '@/lib/noteHelpers';
import { toast as sonnerToast } from 'sonner';

interface MonthlyReportData {
  month: string;
  year: number;
  totalCases: number;
  activeCases: number;
  resolvedCases: number;
  newCases: number;
  byType: {
    contact: number;
    droplet: number;
    airborne: number;
    ebp: number;
    contactPlus: number;
  };
  byOrganism: Record<string, number>;
  averageDuration: number;
  longestDuration: number;
  reviewsCompleted: number;
  reviewsOverdue: number;
  previousMonthTotal: number;
  percentChange: number;
}

interface InfectionControlMonthlyReportProps {
  open: boolean;
  onClose: () => void;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const toDate = (value?: string) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const isResolvedStatus = (status?: string) => {
  const normalizedStatus = normalizeIPStatus(status);
  return normalizedStatus === 'resolved' || normalizedStatus === 'discharged';
};

const isCaseActiveOnDate = (ipCase: Record<string, unknown>, date: Date) => {
  const onsetDate = toDate((ipCase.onset_date as string) || (ipCase.onsetDate as string) || (ipCase.createdAt as string));
  if (!onsetDate || onsetDate > date) return false;

  const resolutionDate = toDate((ipCase.resolution_date as string) || (ipCase.resolutionDate as string));
  if (resolutionDate && resolutionDate <= date) return false;

  return !isResolvedStatus((ipCase.status as string) || (ipCase.case_status as string));
};

export const calculateInfectionControlMonthlyReportData = (
  db: ReturnType<typeof loadDB>,
  selectedMonth: number,
  selectedYear: number,
): MonthlyReportData => {
  const startDate = new Date(selectedYear, selectedMonth, 1);
  const endDate = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59, 999);
  const prevEndDate = new Date(selectedYear, selectedMonth, 0, 23, 59, 59, 999);
  const prevStartDate = new Date(selectedYear, selectedMonth - 1, 1);

  const newCases = db.records.ip_cases.filter(ipCase => {
    const onsetDate = toDate(ipCase.onset_date || ipCase.onsetDate || ipCase.createdAt);
    if (!onsetDate) return false;
    return onsetDate >= startDate && onsetDate <= endDate;
  });

  const carryoverCases = db.records.ip_cases.filter(ipCase => {
    const onsetDate = toDate(ipCase.onset_date || ipCase.onsetDate || ipCase.createdAt);
    if (!onsetDate || onsetDate >= startDate) return false;

    const resolutionDate = toDate(ipCase.resolution_date || ipCase.resolutionDate);
    if (resolutionDate && resolutionDate < startDate) return false;

    return true;
  });

  const resolvedCases = db.records.ip_cases.filter(ipCase => {
    const resolutionDate = toDate(ipCase.resolution_date || ipCase.resolutionDate);
    if (resolutionDate) {
      return resolutionDate >= startDate && resolutionDate <= endDate;
    }

    return false;
  });

  const activeCases = db.records.ip_cases.filter(ipCase => isCaseActiveOnDate(ipCase, endDate));

  const reportingPeriodCases = db.records.ip_cases.filter(ipCase => {
    const onsetDate = toDate(ipCase.onset_date || ipCase.onsetDate || ipCase.createdAt);
    if (!onsetDate || onsetDate > endDate) return false;

    const resolutionDate = toDate(ipCase.resolution_date || ipCase.resolutionDate);
    if (resolutionDate && resolutionDate < startDate) return false;

    return true;
  });

  const prevMonthCases = db.records.ip_cases.filter(ipCase => {
    const onsetDate = toDate(ipCase.onset_date || ipCase.onsetDate || ipCase.createdAt);
    if (!onsetDate || onsetDate > prevEndDate) return false;

    const resolutionDate = toDate(ipCase.resolution_date || ipCase.resolutionDate);
    if (resolutionDate && resolutionDate < prevStartDate) return false;

    return true;
  });

  const byType = {
    contact: 0,
    droplet: 0,
    airborne: 0,
    ebp: 0,
    contactPlus: 0,
  };

  reportingPeriodCases.forEach(ipCase => {
      const type = (ipCase.isolationType || ipCase.isolation_type || ipCase.protocol || '').toLowerCase();
      if (type.includes('contact') && (type.includes('plus') || type.includes('c. diff'))) {
        byType.contactPlus++;
      } else if (type.includes('contact')) {
        byType.contact++;
      } else if (type.includes('droplet')) {
        byType.droplet++;
      } else if (type.includes('airborne')) {
        byType.airborne++;
      } else if (type.includes('ebp') || type.includes('enhanced')) {
        byType.ebp++;
      } else if ((ipCase.protocol || '').toLowerCase().includes('ebp')) {
        byType.ebp++;
      }
    });

  const byOrganism: Record<string, number> = {};
  reportingPeriodCases.forEach(ipCase => {
    const organism = ipCase.suspectedOrConfirmedOrganism || ipCase.infectionType || ipCase.infection_type || 'Unknown';
    byOrganism[organism] = (byOrganism[organism] || 0) + 1;
  });

  const durations: number[] = [];
  reportingPeriodCases.forEach(ipCase => {
    const start = toDate(ipCase.onset_date || ipCase.onsetDate);
    const end = toDate(ipCase.resolution_date || ipCase.resolutionDate);
    if (!start || !end) return;
    const days = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    durations.push(Math.max(days, 0));
  });

  const averageDuration = durations.length > 0
    ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
    : 0;
  const longestDuration = durations.length > 0 ? Math.max(...durations) : 0;

  const today = new Date();
  const reviewsOverdue = activeCases.filter(ipCase => {
    const nextReviewDate = toDate(ipCase.next_review_date || ipCase.nextReviewDate);
    if (!nextReviewDate) return false;
    return nextReviewDate < today;
  }).length;

  const reviewsCompleted = reportingPeriodCases.filter(ipCase => !!toDate(ipCase.lastReviewDate)).length;

  const totalCases = carryoverCases.length + newCases.length;
  const percentChange = prevMonthCases.length > 0
    ? Math.round(((totalCases - prevMonthCases.length) / prevMonthCases.length) * 100)
    : 0;

  return {
    month: MONTHS[selectedMonth],
    year: selectedYear,
    totalCases,
    activeCases: activeCases.length,
    resolvedCases: resolvedCases.length,
    newCases: newCases.length,
    byType,
    byOrganism,
    averageDuration,
    longestDuration,
    reviewsCompleted,
    reviewsOverdue,
    previousMonthTotal: prevMonthCases.length,
    percentChange,
  };
};

const InfectionControlMonthlyReport = ({ open, onClose }: InfectionControlMonthlyReportProps) => {
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth());
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [generatedReport, setGeneratedReport] = useState('');

  const calculateReportData = (): MonthlyReportData => {
    const db = loadDB();
    return calculateInfectionControlMonthlyReportData(db, selectedMonth, selectedYear);
  };

  const data = useMemo(() => (open ? calculateReportData() : null), [open, selectedMonth, selectedYear]);

  const generateReport = () => {
    const db = loadDB();
    const facilityName = db.settings.facilityName || '[Facility Name]';
    const reportData = calculateReportData();

    const trendIndicator = reportData.percentChange > 0 ? '↑' : reportData.percentChange < 0 ? '↓' : '→';
    const trendText = reportData.percentChange > 0 ? 'INCREASE' : reportData.percentChange < 0 ? 'DECREASE' : 'NO CHANGE';

    const topOrganisms = Object.entries(reportData.byOrganism)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10);

    const report = `
═══════════════════════════════════════════════════════════════════════════════
                    INFECTION CONTROL & SAFETY MEETING REPORT
                              ${reportData.month} ${reportData.year}
                              ${facilityName}
═══════════════════════════════════════════════════════════════════════════════

Report Generated: ${formatDateTime(new Date())}
Reporting Period: ${reportData.month} 1, ${reportData.year} - ${reportData.month} ${new Date(reportData.year, selectedMonth + 1, 0).getDate()}, ${reportData.year}

═══════════════════════════════════════════════════════════════════════════════
EXECUTIVE SUMMARY
═══════════════════════════════════════════════════════════════════════════════

Total Isolation/EBP Cases: ${reportData.totalCases}
  • Active Cases: ${reportData.activeCases}
  • Resolved Cases: ${reportData.resolvedCases}
  • New Cases This Month: ${reportData.newCases}

Month-over-Month Trend: ${trendIndicator} ${Math.abs(reportData.percentChange)}% ${trendText}
  (Previous Month: ${reportData.previousMonthTotal} cases)

═══════════════════════════════════════════════════════════════════════════════
ISOLATION PRECAUTION BREAKDOWN
═══════════════════════════════════════════════════════════════════════════════

Precaution Type Distribution:

  Contact Precautions:           ${reportData.byType.contact.toString().padStart(3)} cases (${((reportData.byType.contact / reportData.totalCases) * 100 || 0).toFixed(1)}%)
  Droplet Precautions:           ${reportData.byType.droplet.toString().padStart(3)} cases (${((reportData.byType.droplet / reportData.totalCases) * 100 || 0).toFixed(1)}%)
  Airborne Precautions:          ${reportData.byType.airborne.toString().padStart(3)} cases (${((reportData.byType.airborne / reportData.totalCases) * 100 || 0).toFixed(1)}%)
  Enhanced Barrier Precautions:  ${reportData.byType.ebp.toString().padStart(3)} cases (${((reportData.byType.ebp / reportData.totalCases) * 100 || 0).toFixed(1)}%)
  Contact Plus (C. diff):        ${reportData.byType.contactPlus.toString().padStart(3)} cases (${((reportData.byType.contactPlus / reportData.totalCases) * 100 || 0).toFixed(1)}%)

═══════════════════════════════════════════════════════════════════════════════
ORGANISM/INFECTION ANALYSIS
═══════════════════════════════════════════════════════════════════════════════

Top Organisms/Conditions Requiring Precautions:

${topOrganisms.map(([organism, count], idx) =>
  `  ${(idx + 1).toString().padStart(2)}. ${organism.padEnd(35)} ${count.toString().padStart(3)} cases (${((count / reportData.totalCases) * 100 || 0).toFixed(1)}%)`
).join('\n')}

${topOrganisms.length === 0 ? '  No organism data available for this period.' : ''}

═══════════════════════════════════════════════════════════════════════════════
DURATION ANALYSIS
═══════════════════════════════════════════════════════════════════════════════

Average Duration of Precautions: ${reportData.averageDuration} days
Longest Duration This Month: ${reportData.longestDuration} days

═══════════════════════════════════════════════════════════════════════════════
REVIEW COMPLIANCE & SURVEILLANCE
═══════════════════════════════════════════════════════════════════════════════

Case Reviews Completed: ${reportData.reviewsCompleted} / ${reportData.totalCases} (${((reportData.reviewsCompleted / reportData.totalCases) * 100 || 0).toFixed(1)}%)
Overdue Reviews (Active Cases): ${reportData.reviewsOverdue}

${reportData.reviewsOverdue > 0 ? '⚠️  ACTION REQUIRED: Follow up on overdue case reviews.' : '✓  All active cases reviewed on schedule.'}

═══════════════════════════════════════════════════════════════════════════════
REGULATORY COMPLIANCE
═══════════════════════════════════════════════════════════════════════════════

CMS F880 - Infection Prevention & Control Program: Documentation maintained
CMS F882 - Antibiotic Stewardship: Coordinated with IP surveillance
QSO-23-09-NH - EBP Implementation: ${reportData.byType.ebp} EBP cases documented
NYS DOH 10 NYCRR §415.19: Infection control protocols followed

═══════════════════════════════════════════════════════════════════════════════
Prepared by: [Infection Preventionist Name/Credentials]
Next Report: ${MONTHS[(selectedMonth + 1) % 12]} ${selectedMonth === 11 ? reportData.year + 1 : reportData.year}
═══════════════════════════════════════════════════════════════════════════════
`.trim();

    setGeneratedReport(report);
  };

  const handleGenerateReport = () => {
    generateReport();
    sonnerToast.success('Report generated!', {
      description: `Infection Control report for ${MONTHS[selectedMonth]} ${selectedYear}`
    });
  };

  const handleCopyReport = async () => {
    if (!generatedReport) return;
    await copyToClipboardWithToast(
      generatedReport,
      'Report copied to clipboard!',
      'Paste into your documentation or meeting notes.',
    );
  };

  const handlePrintReport = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Infection Control Report - ${MONTHS[selectedMonth]} ${selectedYear}</title>
          <style>
            body { font-family: 'Courier New', monospace; white-space: pre-wrap; margin: 20px; }
            @media print { body { margin: 0; } }
          </style>
        </head>
        <body>${escapeHtml(generatedReport)}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Infection Control & Safety Meeting Report
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Report Period</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium">Month</label>
                  <Select
                    value={selectedMonth.toString()}
                    onValueChange={(val) => setSelectedMonth(parseInt(val, 10))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTHS.map((month, idx) => (
                        <SelectItem key={month} value={idx.toString()}>{month}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium">Year</label>
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

                <Button onClick={handleGenerateReport} className="w-full" variant="default">
                  <FileText className="w-4 h-4 mr-2" />
                  Generate Report
                </Button>
              </CardContent>
            </Card>

            {data && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Quick Stats</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Total Cases</span>
                    <span className="text-lg font-bold">{data.totalCases}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      Active
                    </span>
                    <span className="text-lg font-bold text-orange-600">{data.activeCases}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" />
                      Resolved
                    </span>
                    <span className="text-lg font-bold text-green-600">{data.resolvedCases}</span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" />
                      vs Last Month
                    </span>
                    <span className={`text-lg font-bold ${data.percentChange > 0 ? 'text-red-600' : data.percentChange < 0 ? 'text-green-600' : 'text-gray-600'}`}>
                      {data.percentChange > 0 ? '+' : ''}{data.percentChange}%
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Generated Report</h3>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleCopyReport} disabled={!generatedReport}>
                  <Copy className="w-4 h-4 mr-2" />
                  Copy
                </Button>
                <Button variant="outline" size="sm" onClick={handlePrintReport} disabled={!generatedReport}>
                  <Printer className="w-4 h-4 mr-2" />
                  Print
                </Button>
              </div>
            </div>

            <Textarea
              value={generatedReport || `Select month/year and click "Generate Report".\nToday's date: ${formatDate(new Date().toISOString())}`}
              onChange={(e) => setGeneratedReport(e.target.value)}
              className="font-mono text-xs min-h-[700px] bg-white"
              placeholder="Report will appear here..."
            />
          </div>
        </div>

        <div className="flex justify-between items-center pt-4 border-t">
          <p className="text-xs text-muted-foreground">CMS F880/F882 Infection Control Monthly Surveillance Report</p>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default InfectionControlMonthlyReport;
