import { RefreshCw, Zap, ChevronDown, Printer, Copy, Download, Trash, FileText, FileDown, Calendar, TrendingUp, BarChart3, Map, AlertTriangle, Filter, ClipboardCheck, Wand2, FolderOpen, Search, Pin, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import SectionCard from '@/components/dashboard/SectionCard';
import DataFlowVisual from '@/components/dashboard/DataFlowVisual';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useState, useRef, useMemo, useEffect } from 'react';
import { loadDB, getActiveResidents, getActiveABT, getActiveIPCases, getVaxDue, getActiveOutbreaks, getLineListingsByOutbreak } from '@/lib/database';
import {
  ReportData,
  generateDailyPrecautionList,
  generateDailyIPWorklist,
  generateABTWorklist,
  generateVaxDueList,
  generateActivePrecautionsByUnit,
  generateExposureLog,
  generateQAPISummary,
  generateSurveyReadinessPacket,
  generateInfectionTrends,
  generateComplianceCrosswalk,
  generateVaxSnapshotReport,
  generateStandardOfCareReport,
  generateFollowUpNotesReport,
  generateMonthlyABTReport,
  generateMedicareABTComplianceReport,
  generateIPReviewReport,
  generateVaxReofferReport,
  generateSurveyorPacket,
  generateHandHygieneReport,
  generatePPEUsageReport,
  generateHHPPEAuditSummary,
  generateAntibioticDurationReport,
  generateNewAdmissionScreeningReport,
  generateOutbreakSummaryReport,
  generateIPDailyMorningReport,
  generateDailyIpBinderReport,
  isIPDailyMorningReport,
  InfectionTrendReport
} from '@/lib/reportGenerators';
import { todayISO } from '@/lib/parsers';
import {
  generateInfectionSurveillanceTrend,
  generateInfectionAcquired,
  generateInfectionRateByCensus,
  generateInfectionRatePer1000Days,
  generateABTStartsPer1000Days,
  generateAntibioticUtilizationRatio,
  generateDeviceAssociatedInfectionReport,
  getQuarterDates,
  SurveillanceReportData,
  type IPDateField
} from '@/lib/reports/surveillanceReports';
import {
  generateQAPIInfectionControlReport,
  generateQAPIIPReport,
  generateQAPIVaxReport
} from '@/lib/reports/qapiReport';
import {
  buildQAPIInfectionControlPdf,
  buildQAPIIPPdf,
  buildQAPIVaxPdf
} from '@/lib/pdf/qapiPdf';
import {
  buildQAPIInfectionControlDocx,
  buildQAPIIPPdf as buildQAPIIPDocx,
  buildQAPIVaxDocx,
  saveDocx
} from '@/lib/docx/qapiDocx';
import { getReportDescription } from '@/lib/reportDescriptions';
import { generateLineListingPdf, generateBlankLineListingPdf } from '@/lib/pdf/lineListingPdf';
import { ALL_TEMPLATES } from '@/lib/lineListingTemplates';
import ReportPreview from '@/components/reports/ReportPreview';
import IPDailyMorningReportPreview from '@/components/reports/IPDailyMorningReportPreview';
import ReportListItem from '@/components/reports/ReportListItem';
import InfectionTrendChart from '@/components/reports/InfectionTrendChart';
import ScheduledReportsPanel from '@/components/reports/ScheduledReportsPanel';
import SurveyModePanel from '@/components/reports/SurveyModePanel';
import FloorLayoutHeatmap from '@/components/reports/FloorLayoutHeatmap';
import TrendPredictionPanel from '@/components/analytics/TrendPredictionPanel';
import NewAdmissionScreeningForm from '@/components/reports/NewAdmissionScreeningForm';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { buildDailyPrecautionListPdf, isDailyPrecautionListReport } from '@/lib/pdf/dailyPrecautionListPdf';
import { buildSurveyorPacketPdf, isSurveyorPacketReport } from '@/lib/pdf/surveyorPacketPdf';
import { generateBinderCoverPdf, generateBinderDividersPdf } from '@/lib/pdf/binderPdf';
import ReportBuilderWizard from '@/components/reports/builder/ReportBuilderWizard';
import { generateReportPdf } from '@/lib/pdf/universalPdfGenerator';
import { format, subDays, subMonths, parseISO } from 'date-fns';
import { Checkbox } from '@/components/ui/checkbox';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import InfectionControlMonthlyReport from '@/components/reports/InfectionControlMonthlyReport';
import SafetyMeetingTemplate from '@/components/reports/SafetyMeetingTemplate';
import { ViewType, type CustomReportTemplate, type ResidentFilterConfig } from '@/lib/types';
import { METRICS_DEFINITIONS } from '@/lib/metricsDefinitions';
import { generateCustomReport as generateCustomReportFromTemplate } from '@/lib/customReports/customReportGenerator';

interface ReportsViewProps {
  surveyorMode?: boolean;
  onNavigate?: (view: ViewType) => void;
}

const ReportsView = ({ surveyorMode = false, onNavigate }: ReportsViewProps) => {
  const [executiveOpen, setExecutiveOpen] = useState(false);
  const [operationalOpen, setOperationalOpen] = useState(true);
  const [surveillanceOpen, setSurveillanceOpen] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState('all');
  const [selectedShift, setSelectedShift] = useState('Day');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [currentReport, setCurrentReport] = useState<ReportData | null>(null);
  const [trendReport, setTrendReport] = useState<InfectionTrendReport | null>(null);
  const [exportFormat, setExportFormat] = useState('PDF');
  const [printFontSize, setPrintFontSize] = useState<'normal' | 'compact'>('normal');
  const [printColumnWidth, setPrintColumnWidth] = useState<'wide' | 'narrow'>('wide');
  const reportRef = useRef<HTMLDivElement>(null);

  // Surveillance report filters
  const [surveillancePeriodType, setSurveillancePeriodType] = useState<'range' | 'quarter'>('range');
  const [surveillanceQuarter, setSurveillanceQuarter] = useState<'1' | '2' | '3' | '4'>(() => {
    const currentQuarter = Math.floor(new Date().getMonth() / 3) + 1;
    return currentQuarter.toString() as '1' | '2' | '3' | '4';
  });
  const [surveillanceYear, setSurveillanceYear] = useState(new Date().getFullYear().toString());
  const [surveillanceFromDate, setSurveillanceFromDate] = useState(() => format(subMonths(new Date(), 5), 'yyyy-MM-dd'));
  const [surveillanceToDate, setSurveillanceToDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [surveillanceDateField, setSurveillanceDateField] = useState<IPDateField>('onset');

  const db = loadDB();

  const surveillanceReports = [
    { id: 'surv_trend', name: 'Infection Surveillance Trend', description: 'Monthly infection counts by category with trending analysis' },
    { id: 'surv_acquired', name: 'Infections Acquired', description: 'Facility-acquired infections with onset dates and classification' },
    { id: 'surv_rate_census', name: 'Infection Rate by Census', description: 'Infection rates calculated against average monthly census' },
    { id: 'surv_rate_1000', name: 'Infection Rate per 1000 Resident Days', description: 'Infection rates per 1,000 resident days by category' },
    { id: 'surv_aur', name: 'Antibiotic Utilization Ratio (AUR)', description: 'Days of therapy (DOT) per 1,000 resident days with benchmark comparison' },
    { id: 'surv_device_assoc', name: 'Device-Associated Infection Tracking', description: 'Device-associated infections with HAI/device fields and lab status' },
  ];

  const handleGenerateReport = async (reportId: string) => {
    const db = loadDB();

    switch (reportId) {
      case 'surv_device_assoc': {
        const startDate = surveillanceFromDate ? parseISO(surveillanceFromDate) : subMonths(new Date(), 5);
        const endDate = surveillanceToDate ? parseISO(surveillanceToDate) : new Date();
        const report = generateDeviceAssociatedInfectionReport(db, startDate, endDate, surveillanceDateField);
        setCurrentReport(report);
        toast.success(`Generated: ${report.title}`);
        return;
      }
      default:
        return;
    }
  };

  return (
    <div className="space-y-6">
      <div id="report-surveillance">
        <Collapsible open={surveillanceOpen} onOpenChange={setSurveillanceOpen}>
          <SectionCard title="Antibiotic & Infection Surveillance">
            <CollapsibleContent>
              <div className="bg-muted/30 rounded-lg p-4 mb-4">
                <div className="flex flex-wrap items-end gap-4">
                  <div className="min-w-[190px]">
                    <label className="text-sm font-medium mb-2 block">Date Field</label>
                    <Select value={surveillanceDateField} onValueChange={(v) => setSurveillanceDateField(v as IPDateField)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="onset">Onset Date</SelectItem>
                        <SelectItem value="specimen">Specimen Collected</SelectItem>
                        <SelectItem value="event_detected">Event Detected</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {surveillancePeriodType === 'range' && (
                    <>
                      <div className="min-w-[150px]">
                        <label className="text-sm font-medium mb-2 block">From Date</label>
                        <Input type="date" value={surveillanceFromDate} onChange={(e) => setSurveillanceFromDate(e.target.value)} />
                      </div>
                      <div className="min-w-[150px]">
                        <label className="text-sm font-medium mb-2 block">To Date</label>
                        <Input type="date" value={surveillanceToDate} onChange={(e) => setSurveillanceToDate(e.target.value)} />
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="divide-y divide-border">
                {surveillanceReports.map((report) => (
                  <ReportListItem key={report.id} report={report} onGenerate={handleGenerateReport} onDescriptionChange={() => {}} />
                ))}
              </div>

              <div ref={reportRef}>
                {currentReport && (
                  <ReportPreview report={currentReport} printFontSize={printFontSize} columnWidth={printColumnWidth} />
                )}
              </div>
            </CollapsibleContent>
          </SectionCard>
        </Collapsible>
      </div>
    </div>
  );
};

export default ReportsView;
