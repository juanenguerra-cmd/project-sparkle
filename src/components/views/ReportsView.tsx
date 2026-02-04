import { RefreshCw, Zap, ChevronDown, Printer, Copy, Download, Trash, FileText, FileDown, Calendar, TrendingUp, BarChart3, Map, AlertTriangle, Filter, ClipboardCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import SectionCard from '@/components/dashboard/SectionCard';
import DataFlowVisual from '@/components/dashboard/DataFlowVisual';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useState, useRef, useMemo } from 'react';
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
  getQuarterDates,
  SurveillanceReportData
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
  buildQAPIIPDocx,
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
import { format, subDays, subMonths, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { Checkbox } from '@/components/ui/checkbox';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Badge } from '@/components/ui/badge';
import { ViewType } from '@/lib/types';

interface ReportsViewProps {
  surveyorMode?: boolean;
  onNavigate?: (view: ViewType) => void;
}

const ReportsView = ({ surveyorMode = false, onNavigate }: ReportsViewProps) => {
  const [executiveOpen, setExecutiveOpen] = useState(false);
  const [operationalOpen, setOperationalOpen] = useState(false);
  const [surveillanceOpen, setSurveillanceOpen] = useState(false);
  const [floorLayoutOpen, setFloorLayoutOpen] = useState(false);
  const [admissionScreeningOpen, setAdmissionScreeningOpen] = useState(false);
  const [lineListingOpen, setLineListingOpen] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState('all');
  const [selectedShift, setSelectedShift] = useState('Day');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [currentReport, setCurrentReport] = useState<ReportData | null>(null);
  const [trendReport, setTrendReport] = useState<InfectionTrendReport | null>(null);
  const [exportFormat, setExportFormat] = useState('PDF');
  const [printFontSize, setPrintFontSize] = useState<'normal' | 'compact'>('normal');
  const [printColumnWidth, setPrintColumnWidth] = useState<'wide' | 'narrow'>('wide');
  const [showPageBreaks, setShowPageBreaks] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);
  const [lastAction, setLastAction] = useState<string | null>(null);
  const [lastActionAt, setLastActionAt] = useState<Date | null>(null);
  
  // New filter states for extended reports
  const [selectedVaccineType, setSelectedVaccineType] = useState('all');
  const [selectedFollowUpStatus, setSelectedFollowUpStatus] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth().toString());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [selectedProtocol, setSelectedProtocol] = useState('all');
  
  // Surveyor packet options
  const [surveyorIncludeABT, setSurveyorIncludeABT] = useState(true);
  const [surveyorIncludeIP, setSurveyorIncludeIP] = useState(true);
  
  // QAPI export format preference
  const [qapiExportFormat, setQapiExportFormat] = useState<'word' | 'pdf'>('word');
  
  // Description refresh trigger
  const [, setDescriptionRefresh] = useState(0);
  
  // Surveillance report filters
  const [surveillancePeriodType, setSurveillancePeriodType] = useState<'range' | 'quarter'>('range');
  const [surveillanceQuarter, setSurveillanceQuarter] = useState<'1' | '2' | '3' | '4'>(() => {
    const currentQuarter = Math.floor(new Date().getMonth() / 3) + 1;
    return currentQuarter.toString() as '1' | '2' | '3' | '4';
  });
  const [surveillanceYear, setSurveillanceYear] = useState(new Date().getFullYear().toString());
  const [surveillanceFromDate, setSurveillanceFromDate] = useState(() => 
    format(subMonths(new Date(), 5), 'yyyy-MM-dd')
  );
  const [surveillanceToDate, setSurveillanceToDate] = useState(() => 
    format(new Date(), 'yyyy-MM-dd')
  );

  const db = loadDB();
  const activeResidents = getActiveResidents(db).length;
  const activeABT = getActiveABT(db).length;
  const activeIP = getActiveIPCases(db).length;
  const vaxDue = getVaxDue(db).length;
  const activeOutbreaks = getActiveOutbreaks(db);

  // Get unique units from census
  const units = [...new Set(
    Object.values(db.census.residentsByMrn)
      .filter(r => r.active_on_census && r.unit)
      .map(r => r.unit)
  )].sort();
  
  // Generate month options for the last 12 months
  const monthOptions = useMemo(() => {
    const options = [];
    for (let i = 0; i < 12; i++) {
      options.push({
        value: i.toString(),
        label: format(new Date(2024, i, 1), 'MMMM')
      });
    }
    return options;
  }, []);
  
  // Generate year options
  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return [currentYear - 1, currentYear, currentYear + 1].map(y => ({
      value: y.toString(),
      label: y.toString()
    }));
  }, []);

  const recordAction = (action: string) => {
    setLastAction(action);
    setLastActionAt(new Date());
  };

  const formatTimestamp = (timestamp?: string) => {
    if (!timestamp) return '—';
    const parsed = new Date(timestamp);
    if (Number.isNaN(parsed.getTime())) return '—';
    return format(parsed, 'MMM d, yyyy h:mm a');
  };

  const getReportRowCount = (report: ReportData) => {
    if (report.sections && report.sections.length > 0) {
      return report.sections.reduce((total, section) => total + section.rows.length, 0);
    }
    return report.rows.length;
  };

  const isPrintSafeRecommended = (report: ReportData) => {
    const totalRows = getReportRowCount(report);
    const title = report.title.toLowerCase();
    return (
      totalRows > 25 ||
      report.headers.length >= 8 ||
      title.includes('line list') ||
      title.includes('line listing') ||
      title.includes('outbreak') ||
      title.includes('exposure') ||
      title.includes('follow-up') ||
      title.includes('survey') ||
      title.includes('standard of care') ||
      title.includes('hand hygiene') ||
      title.includes('ppe')
    );
  };

  const applyExportDefaults = (report: ReportData) => {
    if (isPrintSafeRecommended(report)) {
      setExportFormat('PDF');
    }
  };

  const hasGeneratedReport = Boolean(currentReport);
  const hasFiltersApplied = Boolean(
    fromDate ||
    toDate ||
    selectedUnit !== 'all' ||
    selectedShift !== 'Day' ||
    selectedVaccineType !== 'all' ||
    selectedFollowUpStatus !== 'all' ||
    selectedProtocol !== 'all'
  );
  const hasSharedReport = Boolean(lastAction && ['Copied report', 'Printed report'].includes(lastAction));
  const hasExportedReport = Boolean(lastAction && lastAction.startsWith('Exported'));
  const hasCompletedOutput = hasExportedReport || hasSharedReport;
  const printSafeRecommended = currentReport ? isPrintSafeRecommended(currentReport) : false;
  
  // Surveillance reports definition
  const surveillanceReports = [
    { 
      id: 'surv_trend', 
      name: 'Infection Surveillance Trend', 
      description: 'Monthly infection counts by category with trending analysis' 
    },
    { 
      id: 'surv_acquired', 
      name: 'Infections Acquired', 
      description: 'Facility-acquired infections with onset dates and classification' 
    },
    { 
      id: 'surv_rate_census', 
      name: 'Infection Rate by Census', 
      description: 'Infection rates calculated against average monthly census' 
    },
    { 
      id: 'surv_rate_1000', 
      name: 'Infection Rate per 1000 Resident Days', 
      description: 'Infection rates per 1,000 resident days by category' 
    },
    { 
      id: 'surv_abt_1000', 
      name: 'ABT Starts per 1000 Resident Days', 
      description: 'Antibiotic prescription starts per 1,000 resident days' 
    },
    { 
      id: 'surv_aur', 
      name: 'Antibiotic Utilization Ratio (AUR)', 
      description: 'Days of therapy (DOT) per 1,000 resident days with benchmark comparison' 
    },
  ];

  const executiveReports = [
    { id: 'survey_readiness', name: 'Survey Readiness Packet', description: 'Comprehensive compliance documentation for CMS surveys' },
    { id: 'surveyor_packet', name: 'Surveyor Census Packet', description: 'Active residents list with ABT/IP status for surveyor reference' },
    { id: 'qapi', name: 'QAPI Report', description: 'Quality metrics and performance indicators' },
    { id: 'qapi_infection', name: 'QAPI: Infection Control/ABT', description: 'Full PDCA report with 5 tables: infection rates, ABT starts, AUR' },
    { id: 'qapi_ip', name: 'QAPI: Infection Prevention (IP)', description: 'Precautions summary, resolution rates, room check compliance' },
    { id: 'qapi_vax', name: 'QAPI: Vaccination', description: 'Coverage rates, declinations, re-offer tracking by vaccine type' },
    { id: 'infection_trends', name: 'Infection Rate Trends', description: 'Monthly/quarterly infection rate analysis' },
    { id: 'compliance', name: 'Compliance Crosswalk', description: 'Regulatory compliance status overview' },
    { id: 'medicare_compliance', name: 'Medicare ABT Compliance', description: 'Flag inappropriate antibiotic indications' },
    { id: 'hh_ppe_summary', name: 'Hand Hygiene & PPE Audit Summary', description: 'Compliance documentation for surveyor review' },
  ];

  const operationalReports = [
    { id: 'ip_daily_morning', name: 'IP Daily Morning Report', description: 'Combined morning IP report with IP precautions, ABT, VAX due today, line listings, and follow-up notes' },
    { id: 'daily_ip', name: 'Daily IP Worklist', description: 'Active isolation precautions and EBP cases' },
    { id: 'abt_review', name: 'ABT Review Worklist', description: 'Antibiotic courses requiring review' },
    { id: 'abt_duration', name: 'Antibiotic Duration Analysis', description: 'Prolonged ABT courses (≥7 days) requiring stewardship review' },
    { id: 'vax_due', name: 'Vaccination Due List', description: 'Residents with upcoming or overdue vaccinations' },
    { id: 'vax_reoffer', name: 'Vaccine Re-offer List', description: 'Residents due for vaccine re-offer (Flu: 30 days, COVID: 180 days)' },
    { id: 'precautions_list', name: 'Active Precautions List', description: 'Current isolation precautions by unit' },
    { id: 'exposure_log', name: 'Exposure Tracking Log', description: 'Potential exposure events and follow-ups' },
    { id: 'new_admit_screening', name: 'New Admission Screening', description: 'Recent admissions needing IP screening (flags overdue >3 days)' },
    { id: 'outbreak_summary', name: 'Outbreak Summary', description: 'Infection pattern analysis with outbreak alerts' },
    { id: 'vax_snapshot', name: 'Vaccination Snapshot', description: 'Active residents vaccination count (excludes discharged)' },
    { id: 'standard_of_care', name: 'Standard of Care Report', description: 'Weekly ABT, IP, VAX declinations by date range' },
    { id: 'followup_notes', name: 'Follow-up Notes Report', description: 'Overdue and pending follow-up items' },
    { id: 'monthly_abt', name: 'Monthly ABT Report', description: 'Residents on antibiotics for selected month' },
    { id: 'ip_review', name: 'IP Review Worklist', description: 'Cases due for review by protocol cadence' },
    { id: 'hand_hygiene', name: 'Hand Hygiene Compliance Report', description: 'CDC 5 Moments monitoring audit template' },
    { id: 'ppe_usage', name: 'PPE Usage Tracking Report', description: 'Personal protective equipment monitoring by unit' },
  ];

  const handleGenerateReport = async (reportId: string) => {
    const db = loadDB();
    let report: ReportData | null = null;

    switch (reportId) {
      case 'ip_daily_morning':
        report = generateIPDailyMorningReport(db);
        break;
      case 'precautions_list':
        report = generateDailyPrecautionList(db, selectedUnit, selectedShift);
        break;
      case 'daily_ip':
        report = generateDailyIPWorklist(db, selectedUnit);
        break;
      case 'abt_review':
        report = generateABTWorklist(db, selectedUnit);
        break;
      case 'vax_due':
        report = generateVaxDueList(db, selectedUnit);
        break;
      case 'active_precautions':
        report = generateActivePrecautionsByUnit(db);
        break;
      case 'exposure_log':
        report = generateExposureLog(db, fromDate || undefined, toDate || undefined);
        break;
      case 'qapi':
        report = generateQAPISummary(db);
        break;
      case 'survey_readiness':
        report = generateSurveyReadinessPacket(db);
        break;
      case 'infection_trends':
        const trendData = generateInfectionTrends(db);
        setTrendReport(trendData);
        setCurrentReport(trendData);
        applyExportDefaults(trendData);
        recordAction('Generated report');
        toast.success(`Generated: ${trendData.title}`);
        return;
      case 'compliance':
        report = generateComplianceCrosswalk(db);
        break;
      // New reports
      case 'vax_snapshot':
        report = generateVaxSnapshotReport(db, fromDate || undefined, toDate || undefined, selectedVaccineType);
        break;
      case 'standard_of_care':
        if (!fromDate || !toDate) {
          // Default to last 7 days if not specified
          const defaultTo = format(new Date(), 'yyyy-MM-dd');
          const defaultFrom = format(subDays(new Date(), 7), 'yyyy-MM-dd');
          report = generateStandardOfCareReport(db, fromDate || defaultFrom, toDate || defaultTo);
        } else {
          report = generateStandardOfCareReport(db, fromDate, toDate);
        }
        break;
      case 'followup_notes':
        report = generateFollowUpNotesReport(db, selectedFollowUpStatus);
        break;
      case 'monthly_abt':
        report = generateMonthlyABTReport(db, parseInt(selectedMonth), parseInt(selectedYear));
        break;
      case 'medicare_compliance':
        report = generateMedicareABTComplianceReport(db);
        break;
      case 'ip_review':
        report = generateIPReviewReport(db, fromDate || undefined, toDate || undefined, selectedProtocol);
        break;
      case 'vax_reoffer':
        report = generateVaxReofferReport(db, selectedVaccineType);
        break;
      case 'surveyor_packet':
        report = generateSurveyorPacket(db, surveyorIncludeABT, surveyorIncludeIP);
        break;
      case 'hand_hygiene':
        report = generateHandHygieneReport(db, fromDate || undefined, toDate || undefined);
        break;
      case 'ppe_usage':
        report = generatePPEUsageReport(db, fromDate || undefined, toDate || undefined);
        break;
      case 'hh_ppe_summary':
        report = generateHHPPEAuditSummary(db, fromDate || undefined, toDate || undefined);
        break;
      // NEW HIGH-VALUE REPORTS
      case 'abt_duration':
        report = generateAntibioticDurationReport(db, 7); // 7-day threshold
        break;
      case 'new_admit_screening':
        report = generateNewAdmissionScreeningReport(db, 14); // Last 14 days
        break;
      case 'outbreak_summary':
        report = generateOutbreakSummaryReport(db, 30); // Last 30 days
        break;
      // QAPI Reports (Word or PDF based on selection)
      case 'qapi_infection': {
        const quarterNum = parseInt(surveillanceQuarter) as 1 | 2 | 3 | 4;
        const year = parseInt(surveillanceYear);
        const qapiData = generateQAPIInfectionControlReport(db, quarterNum, year);
        
        if (qapiExportFormat === 'word') {
          const docx = buildQAPIInfectionControlDocx(qapiData);
          await saveDocx(docx, `QAPI_Infection_Control_${qapiData.quarter}_${year}.docx`);
          toast.success('QAPI Infection Control/ABT report downloaded (Word)');
        } else {
          const pdfDoc = buildQAPIInfectionControlPdf(qapiData);
          pdfDoc.save(`QAPI_Infection_Control_${qapiData.quarter}_${year}.pdf`);
          toast.success('QAPI Infection Control/ABT report downloaded (PDF)');
        }
        return;
      }
      case 'qapi_ip': {
        const quarterNum = parseInt(surveillanceQuarter) as 1 | 2 | 3 | 4;
        const year = parseInt(surveillanceYear);
        const ipData = generateQAPIIPReport(db, quarterNum, year);
        
        if (qapiExportFormat === 'word') {
          const docx = buildQAPIIPDocx(ipData);
          await saveDocx(docx, `QAPI_IP_${ipData.quarter}_${year}.docx`);
          toast.success('QAPI IP (Precautions) report downloaded (Word)');
        } else {
          const pdfDoc = buildQAPIIPPdf(ipData);
          pdfDoc.save(`QAPI_IP_${ipData.quarter}_${year}.pdf`);
          toast.success('QAPI IP (Precautions) report downloaded (PDF)');
        }
        return;
      }
      case 'qapi_vax': {
        const quarterNum = parseInt(surveillanceQuarter) as 1 | 2 | 3 | 4;
        const year = parseInt(surveillanceYear);
        const vaxData = generateQAPIVaxReport(db, quarterNum, year);
        
        if (qapiExportFormat === 'word') {
          const docx = buildQAPIVaxDocx(vaxData);
          await saveDocx(docx, `QAPI_VAX_${vaxData.quarter}_${year}.docx`);
          toast.success('QAPI Vaccination report downloaded (Word)');
        } else {
          const pdfDoc = buildQAPIVaxPdf(vaxData);
          pdfDoc.save(`QAPI_VAX_${vaxData.quarter}_${year}.pdf`);
          toast.success('QAPI Vaccination report downloaded (PDF)');
        }
        return;
      }
      // Surveillance Reports
      case 'surv_trend':
      case 'surv_acquired':
      case 'surv_rate_census':
      case 'surv_rate_1000':
      case 'surv_abt_1000':
      case 'surv_aur': {
        // Determine date range based on period type
        let startDate: Date;
        let endDate: Date;
        
        if (surveillancePeriodType === 'quarter') {
          const quarterNum = parseInt(surveillanceQuarter) as 1 | 2 | 3 | 4;
          const year = parseInt(surveillanceYear);
          const dates = getQuarterDates(quarterNum, year);
          startDate = dates.start;
          endDate = dates.end;
        } else {
          startDate = surveillanceFromDate ? parseISO(surveillanceFromDate) : subMonths(new Date(), 5);
          endDate = surveillanceToDate ? parseISO(surveillanceToDate) : new Date();
        }
        
        let survReport: SurveillanceReportData;
        switch (reportId) {
          case 'surv_trend':
            survReport = generateInfectionSurveillanceTrend(db, startDate, endDate);
            break;
          case 'surv_acquired':
            survReport = generateInfectionAcquired(db, startDate, endDate);
            break;
          case 'surv_rate_census':
            survReport = generateInfectionRateByCensus(db, startDate, endDate);
            break;
          case 'surv_rate_1000':
            survReport = generateInfectionRatePer1000Days(db, startDate, endDate);
            break;
          case 'surv_abt_1000':
            survReport = generateABTStartsPer1000Days(db, startDate, endDate);
            break;
          case 'surv_aur':
          default:
            survReport = generateAntibioticUtilizationRatio(db, startDate, endDate);
            break;
        }
        
        setCurrentReport(survReport);
        applyExportDefaults(survReport);
        recordAction('Generated report');
        setTrendReport(null);
        toast.success(`Generated: ${survReport.title}`);
        return;
      }
      default:
        toast.error('Unknown report type');
        return;
    }

    if (report) {
      setCurrentReport(report);
      applyExportDefaults(report);
      setTrendReport(null);
      recordAction('Generated report');
      toast.success(`Generated: ${report.title}`);
    }
  };

  const handleQuickStatClick = (type: string) => {
    const db = loadDB();
    let report: ReportData | null = null;

    switch (type) {
      case 'residents':
        // Generate a census summary
        const residents = getActiveResidents(db);
        report = {
          title: 'ACTIVE RESIDENTS SUMMARY',
          generatedAt: new Date().toISOString(),
          filters: { date: new Date().toLocaleDateString() },
          headers: ['Room', 'Name', 'MRN', 'Unit', 'Physician', 'Status'],
          rows: residents.map(r => [r.room, r.name, r.mrn, r.unit, r.physician || '', r.status || 'Active'])
        };
        break;
      case 'abt':
        report = generateABTWorklist(db, 'all');
        break;
      case 'ip':
        report = generateDailyPrecautionList(db, 'all', selectedShift);
        break;
      case 'vax':
        report = generateVaxDueList(db, 'all');
        break;
    }

    if (report) {
      setCurrentReport(report);
      applyExportDefaults(report);
      recordAction('Generated report');
      toast.success(`Generated: ${report.title}`);
    }
  };

  const handlePrint = () => {
    if (!currentReport) {
      toast.error('Generate a report first');
      return;
    }

    // Daily Precaution List: print the exact same PDF template (prevents browser URL/footer clutter)
    if (isDailyPrecautionListReport(currentReport)) {
      const db = loadDB();
      const facility = db.settings.facilityName || 'Healthcare Facility';
      const doc = buildDailyPrecautionListPdf({ report: currentReport, facility });
      doc.autoPrint();
      const blobUrl = doc.output('bloburl');
      const pdfWindow = window.open(blobUrl, '_blank');
      if (!pdfWindow) {
        toast.error('Please allow popups to print');
      }
      recordAction('Printed report');
      return;
    }
    
    const printContent = document.getElementById('report-content');
    if (!printContent) return;
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Please allow popups to print');
      return;
    }
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${currentReport.title}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            table { width: 100%; border-collapse: collapse; table-layout: fixed; }
            th, td { border: 1px solid black; padding: 8px; text-align: left; word-break: break-word; overflow-wrap: anywhere; }
            th { background-color: #f0f0f0; font-weight: bold; }
            h1, h2 { text-align: center; margin: 0; }
            .header { text-align: center; margin-bottom: 20px; }
            .filters { display: flex; justify-content: center; gap: 30px; margin: 10px 0; flex-wrap: wrap; }
            .footer { margin-top: 30px; }
            .disclaimer { font-size: 11px; font-style: italic; margin-top: 20px; }
            tr { page-break-inside: avoid; }
            @media print { 
              body { margin: 0; }
              @page { margin: 0.5in; }
            }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
      </html>
    `);
    
    printWindow.document.close();
    printWindow.print();
    recordAction('Printed report');
  };

  const handleCopy = async () => {
    if (!currentReport) {
      toast.error('Generate a report first');
      return;
    }
    
    const filterLine = Object.entries(currentReport.filters).map(([k, v]) => `${k}: ${v}`).join(' | ');
    const lines = [
      currentReport.title,
      currentReport.subtitle || '',
      '',
      filterLine,
      ''
    ];

    if (currentReport.sections && currentReport.sections.length > 0) {
      currentReport.sections.forEach(section => {
        lines.push(section.title);
        lines.push(section.headers.join('\t'));
        section.rows.forEach(row => {
          lines.push(row.join('\t'));
        });
        lines.push('');
      });
    } else {
      lines.push(currentReport.headers.join('\t'));
      lines.push(...currentReport.rows.map(row => row.join('\t')));
    }
    
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      toast.success('Report copied to clipboard');
      recordAction('Copied report');
    } catch {
      toast.error('Failed to copy');
    }
  };

  const exportReportAsPdf = (report: ReportData, actionLabel = 'PDF') => {
    const sanitizedTitle = report.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const dateStr = todayISO();
    const db = loadDB();
    const facility = db.settings.facilityName || 'Healthcare Facility';

    // Daily Precaution List: strict template PDF (matches on-screen preview)
    if (isDailyPrecautionListReport(report)) {
      const doc = buildDailyPrecautionListPdf({ report, facility });
      const filename = `${sanitizedTitle}_${dateStr}.pdf`;
      doc.save(filename);
      recordAction(`Exported ${actionLabel}`);
      toast.success(`Exported as ${filename}`);
      return;
    }

    // Surveyor Packet: no footer, repeating headers
    if (isSurveyorPacketReport(report)) {
      const doc = buildSurveyorPacketPdf({ report, facility });
      const filename = `${sanitizedTitle}_${dateStr}.pdf`;
      doc.save(filename);
      recordAction(`Exported ${actionLabel}`);
      toast.success(`Exported as ${filename}`);
      return;
    }

    if (isIPDailyMorningReport(report)) {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const headerBottomY = 40;

      const drawHeader = () => {
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text(facility, pageWidth / 2, 15, { align: 'center' });

        doc.setFontSize(12);
        doc.text(report.title, pageWidth / 2, 22, { align: 'center' });

        if (report.subtitle) {
          doc.setFontSize(10);
          doc.setFont('helvetica', 'normal');
          doc.text(report.subtitle, pageWidth / 2, 28, { align: 'center' });
        }

        doc.setFontSize(9);
        const filterParts = [];
        if (report.filters.unit) filterParts.push(`Unit: ${report.filters.unit}`);
        if (report.filters.date) filterParts.push(`Date: ${report.filters.date}`);
        if (report.filters.shift) filterParts.push(`Shift: ${report.filters.shift}`);
        if (filterParts.length > 0) {
          doc.text(filterParts.join('  |  '), pageWidth / 2, 34, { align: 'center' });
        }
      };

      const ensureSpace = (currentY: number, neededSpace = 14) => {
        if (currentY + neededSpace > pageHeight - 20) {
          doc.addPage();
          drawHeader();
          return headerBottomY;
        }
        return currentY;
      };

      drawHeader();

      let startY = headerBottomY;
      report.sections?.forEach(section => {
        startY = ensureSpace(startY, 18);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(section.title, 14, startY);
        startY += 4;
        autoTable(doc, {
          head: [section.headers],
          body: section.rows,
          startY,
          margin: { top: headerBottomY },
          styles: { fontSize: 8, cellPadding: 3 },
          headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [250, 250, 250] },
          tableLineColor: [0, 0, 0],
          tableLineWidth: 0.1,
          didDrawPage: () => {
            drawHeader();
          }
        });
        startY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY || startY;
        startY += 8;
      });

      const filename = `${sanitizedTitle}_${dateStr}.pdf`;
      doc.save(filename);
      recordAction(`Exported ${actionLabel}`);
      toast.success(`Exported as ${filename}`);
      return;
    }

    const doc = new jsPDF();

    // Header
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(facility, doc.internal.pageSize.getWidth() / 2, 15, { align: 'center' });

    doc.setFontSize(12);
    doc.text(report.title, doc.internal.pageSize.getWidth() / 2, 22, { align: 'center' });

    if (report.subtitle) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(report.subtitle, doc.internal.pageSize.getWidth() / 2, 28, { align: 'center' });
    }

    // Filters line
    doc.setFontSize(9);
    const filterParts = [];
    if (report.filters.unit) filterParts.push(`Unit: ${report.filters.unit}`);
    if (report.filters.date) filterParts.push(`Date: ${report.filters.date}`);
    if (report.filters.shift) filterParts.push(`Shift: ${report.filters.shift}`);
    if (filterParts.length > 0) {
      doc.text(filterParts.join('  |  '), doc.internal.pageSize.getWidth() / 2, 34, { align: 'center' });
    }

    if (report.sections && report.sections.length > 0) {
      let startY = 40;
      report.sections.forEach(section => {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(section.title, 14, startY);
        startY += 4;
        autoTable(doc, {
          head: [section.headers],
          body: section.rows,
          startY,
          styles: { fontSize: 8, cellPadding: 3 },
          headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [250, 250, 250] },
          tableLineColor: [0, 0, 0],
          tableLineWidth: 0.1,
        });
        startY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY || startY;
        startY += 8;
      });
    } else {
      // Table
      autoTable(doc, {
        head: [report.headers],
        body: report.rows,
        startY: 40,
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [250, 250, 250] },
        tableLineColor: [0, 0, 0],
        tableLineWidth: 0.1,
      });

      // Footer
      const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY || 40;
      if (report.footer) {
        doc.setFontSize(9);
        doc.text(`Prepared by: ________________________`, 14, finalY + 15);
        doc.text(`Signature: ________________________`, 14, finalY + 22);
        doc.text(`Title: ________________________`, 110, finalY + 15);
        doc.text(`Date/Time: ${report.footer.dateTime || new Date().toLocaleString()}`, 110, finalY + 22);

        if (report.footer.disclaimer) {
          doc.setFontSize(8);
          doc.setFont('helvetica', 'italic');
          doc.text(`* ${report.footer.disclaimer}`, 14, finalY + 35, { maxWidth: 180 });
        }
      }
    }

    const filename = `${sanitizedTitle}_${dateStr}.pdf`;
    doc.save(filename);
    recordAction(`Exported ${actionLabel}`);
    toast.success(`Exported as ${filename}`);
  };

  const handleExport = () => {
    if (!currentReport) {
      toast.error('Generate a report first');
      return;
    }
    
    const sanitizedTitle = currentReport.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const dateStr = todayISO();
    
    if (exportFormat === 'PDF') {
      exportReportAsPdf(currentReport, exportFormat);
      return;
    }
    
    let content: string;
    let filename: string;
    let mimeType: string;
    
    switch (exportFormat) {
      case 'CSV':
        if (currentReport.sections && currentReport.sections.length > 0) {
          content = currentReport.sections
            .map(section => {
              const rows = section.rows.map(row => row.map(cell => `"${cell}"`).join(','));
              return [`"${section.title}"`, section.headers.join(','), ...rows, ''].join('\n');
            })
            .join('\n');
        } else {
          content = [
            currentReport.headers.join(','),
            ...currentReport.rows.map(row => row.map(cell => `"${cell}"`).join(','))
          ].join('\n');
        }
        filename = `${sanitizedTitle}_${dateStr}.csv`;
        mimeType = 'text/csv';
        break;
      case 'JSON':
        content = JSON.stringify(currentReport, null, 2);
        filename = `${sanitizedTitle}_${dateStr}.json`;
        mimeType = 'application/json';
        break;
      case 'HTML':
      default:
        const printContent = document.getElementById('report-content');
        content = `
          <!DOCTYPE html>
          <html>
            <head>
              <title>${currentReport.title}</title>
              <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                table { width: 100%; border-collapse: collapse; }
                th, td { border: 1px solid black; padding: 8px; text-align: left; }
                th { background-color: #f0f0f0; }
              </style>
            </head>
            <body>${printContent?.innerHTML || ''}</body>
          </html>
        `;
        filename = `${sanitizedTitle}_${dateStr}.html`;
        mimeType = 'text/html';
        break;
    }
    
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    
    recordAction(`Exported ${exportFormat}`);
    toast.success(`Exported as ${filename}`);
  };

  const handlePrintSafeExport = () => {
    if (!currentReport) {
      toast.error('Generate a report first');
      return;
    }
    exportReportAsPdf(currentReport, 'PDF (print-safe)');
  };

  const handleClear = () => {
    setCurrentReport(null);
    recordAction('Cleared report');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Centralized Reporting Hub</h2>
          <p className="text-sm text-muted-foreground">Generate comprehensive reports from integrated data</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh All
          </Button>
          <Button size="sm" onClick={() => handleGenerateReport('precautions_list')}>
            <Zap className="w-4 h-4 mr-2" />
            Quick Precautions
          </Button>
        </div>
      </div>

      {/* Survey Mode Quick Packs - Shown when surveyor mode is active */}
      <SurveyModePanel surveyorMode={surveyorMode} />

      {/* Data Flow */}
      <SectionCard title="Integrated Data Flow">
        <DataFlowVisual />
      </SectionCard>

      {/* Quick Stats - Clickable */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div 
          className="quick-stat cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all"
          onClick={() => handleQuickStatClick('residents')}
        >
          <div className="text-2xl font-bold text-primary">{activeResidents}</div>
          <div className="text-sm text-muted-foreground">Active Residents</div>
          <div className="text-xs text-primary mt-1">Click for Full Report</div>
        </div>
        <div 
          className="quick-stat cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all"
          onClick={() => handleQuickStatClick('abt')}
        >
          <div className="text-2xl font-bold text-destructive">{activeABT}</div>
          <div className="text-sm text-muted-foreground">Active ABT Courses</div>
          <div className="text-xs text-primary mt-1">Click for Full Report</div>
        </div>
        <div 
          className="quick-stat cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all"
          onClick={() => handleQuickStatClick('ip')}
        >
          <div className="text-2xl font-bold text-warning">{activeIP}</div>
          <div className="text-sm text-muted-foreground">Active IP Cases</div>
          <div className="text-xs text-primary mt-1">Click for Full Report</div>
        </div>
        <div 
          className="quick-stat cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all"
          onClick={() => handleQuickStatClick('vax')}
        >
          <div className="text-2xl font-bold text-success">{vaxDue}</div>
          <div className="text-sm text-muted-foreground">Vaccinations Due</div>
          <div className="text-xs text-primary mt-1">Click for Full Report</div>
        </div>
      </div>

      {/* Report Sections */}
      <Collapsible open={executiveOpen} onOpenChange={setExecutiveOpen}>
        <SectionCard 
          title="Executive & Regulatory Reports"
          actions={
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm">
                <ChevronDown className={`w-4 h-4 transition-transform ${executiveOpen ? '' : '-rotate-90'}`} />
              </Button>
            </CollapsibleTrigger>
          }
        >
          <CollapsibleContent>
            {/* QAPI Reports Settings Panel */}
            <div className="bg-muted/30 rounded-lg p-4 mb-4">
              <div className="text-sm font-medium mb-3">QAPI Report Settings</div>
              <div className="flex flex-wrap items-end gap-4">
                {/* Quarter Selection */}
                <div className="min-w-[120px]">
                  <label className="text-sm font-medium mb-2 block">Quarter</label>
                  <Select 
                    value={surveillanceQuarter} 
                    onValueChange={(v) => setSurveillanceQuarter(v as '1' | '2' | '3' | '4')}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Q1 (Jan-Mar)</SelectItem>
                      <SelectItem value="2">Q2 (Apr-Jun)</SelectItem>
                      <SelectItem value="3">Q3 (Jul-Sep)</SelectItem>
                      <SelectItem value="4">Q4 (Oct-Dec)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {/* Year Selection - Extended range */}
                <div className="min-w-[100px]">
                  <label className="text-sm font-medium mb-2 block">Year</label>
                  <Select value={surveillanceYear} onValueChange={setSurveillanceYear}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[
                        new Date().getFullYear() - 3,
                        new Date().getFullYear() - 2,
                        new Date().getFullYear() - 1,
                        new Date().getFullYear(),
                        new Date().getFullYear() + 1
                      ].map(y => (
                        <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                {/* Export Format Selection */}
                <div>
                  <label className="text-sm font-medium mb-2 block">Export Format</label>
                  <div className="inline-flex rounded-md border border-input overflow-hidden">
                    <button
                      className={`px-4 py-2 text-sm font-medium transition-colors ${
                        qapiExportFormat === 'word'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-background text-foreground hover:bg-muted'
                      }`}
                      onClick={() => setQapiExportFormat('word')}
                    >
                      Word (.docx)
                    </button>
                    <button
                      className={`px-4 py-2 text-sm font-medium transition-colors border-l border-input ${
                        qapiExportFormat === 'pdf'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-background text-foreground hover:bg-muted'
                      }`}
                      onClick={() => setQapiExportFormat('pdf')}
                    >
                      PDF
                    </button>
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                {qapiExportFormat === 'word' 
                  ? 'Word format allows editing narrative sections (ACT, Executive Summary) before submission.'
                  : 'PDF format provides a finalized, non-editable document.'}
              </p>
            </div>
            
            <div className="divide-y divide-border">
              {executiveReports.map((report) => (
                <ReportListItem
                  key={report.id}
                  report={report}
                  onGenerate={handleGenerateReport}
                  onDescriptionChange={() => setDescriptionRefresh(n => n + 1)}
                />
              ))}
            </div>
          </CollapsibleContent>
        </SectionCard>
      </Collapsible>

      <Collapsible open={operationalOpen} onOpenChange={setOperationalOpen}>
        <SectionCard 
          title="Operational Management Reports"
          actions={
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm">
                <ChevronDown className={`w-4 h-4 transition-transform ${operationalOpen ? '' : '-rotate-90'}`} />
              </Button>
            </CollapsibleTrigger>
          }
        >
          <CollapsibleContent>
            <div className="divide-y divide-border">
              {operationalReports.map((report) => (
                <ReportListItem
                  key={report.id}
                  report={report}
                  onGenerate={handleGenerateReport}
                  onDescriptionChange={() => setDescriptionRefresh(n => n + 1)}
                />
              ))}
            </div>
          </CollapsibleContent>
        </SectionCard>
      </Collapsible>

      {/* Trend Prediction Analytics */}
      <SectionCard title="Trend Prediction & Forecasting">
        <TrendPredictionPanel />
      </SectionCard>

      {/* Antibiotic & Infection Surveillance Reports */}
      <Collapsible open={surveillanceOpen} onOpenChange={setSurveillanceOpen}>
        <SectionCard 
          title="Antibiotic & Infection Surveillance"
          actions={
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm">
                <ChevronDown className={`w-4 h-4 transition-transform ${surveillanceOpen ? '' : '-rotate-90'}`} />
              </Button>
            </CollapsibleTrigger>
          }
        >
          <CollapsibleContent>
            {/* Date Range / Quarter Selector */}
            <div className="bg-muted/30 rounded-lg p-4 mb-4">
              <div className="flex flex-wrap items-end gap-4">
                {/* Period Type Toggle */}
                <div>
                  <label className="text-sm font-medium mb-2 block">Period Type</label>
                  <div className="inline-flex rounded-md border border-input overflow-hidden">
                    <button
                      className={`px-4 py-2 text-sm font-medium transition-colors ${
                        surveillancePeriodType === 'range'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-background text-foreground hover:bg-muted'
                      }`}
                      onClick={() => setSurveillancePeriodType('range')}
                    >
                      Date Range
                    </button>
                    <button
                      className={`px-4 py-2 text-sm font-medium transition-colors border-l border-input ${
                        surveillancePeriodType === 'quarter'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-background text-foreground hover:bg-muted'
                      }`}
                      onClick={() => setSurveillancePeriodType('quarter')}
                    >
                      Quarter
                    </button>
                  </div>
                </div>

                {surveillancePeriodType === 'range' ? (
                  <>
                    <div className="min-w-[150px]">
                      <label className="text-sm font-medium mb-2 block">From Date</label>
                      <Input 
                        type="date" 
                        value={surveillanceFromDate} 
                        onChange={e => setSurveillanceFromDate(e.target.value)} 
                      />
                    </div>
                    <div className="min-w-[150px]">
                      <label className="text-sm font-medium mb-2 block">To Date</label>
                      <Input 
                        type="date" 
                        value={surveillanceToDate} 
                        onChange={e => setSurveillanceToDate(e.target.value)} 
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="min-w-[120px]">
                      <label className="text-sm font-medium mb-2 block">Quarter</label>
                      <Select 
                        value={surveillanceQuarter} 
                        onValueChange={(v) => setSurveillanceQuarter(v as '1' | '2' | '3' | '4')}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">Q1 (Jan-Mar)</SelectItem>
                          <SelectItem value="2">Q2 (Apr-Jun)</SelectItem>
                          <SelectItem value="3">Q3 (Jul-Sep)</SelectItem>
                          <SelectItem value="4">Q4 (Oct-Dec)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="min-w-[100px]">
                      <label className="text-sm font-medium mb-2 block">Year</label>
                      <Select value={surveillanceYear} onValueChange={setSurveillanceYear}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[new Date().getFullYear() - 1, new Date().getFullYear(), new Date().getFullYear() + 1].map(y => (
                            <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
              </div>
              
              <p className="text-xs text-muted-foreground mt-3">
                Reports will be generated with monthly breakdowns for the selected period. 
                Rates are calculated per average census and resident days.
              </p>
            </div>

            {/* Report List */}
            <div className="divide-y divide-border">
              {surveillanceReports.map((report) => (
                <ReportListItem
                  key={report.id}
                  report={report}
                  onGenerate={handleGenerateReport}
                  onDescriptionChange={() => setDescriptionRefresh(n => n + 1)}
                />
              ))}
            </div>
          </CollapsibleContent>
        </SectionCard>
      </Collapsible>

      {/* Floor Layout Heatmap */}
      <Collapsible open={floorLayoutOpen} onOpenChange={setFloorLayoutOpen}>
        <SectionCard 
          title="Floor Layout Heatmap"
          actions={
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm">
                <ChevronDown className={`w-4 h-4 transition-transform ${floorLayoutOpen ? '' : '-rotate-90'}`} />
              </Button>
            </CollapsibleTrigger>
          }
        >
          <CollapsibleContent>
            <p className="text-sm text-muted-foreground mb-4">
              Visual representation of active precautions by room. Select unit and as-of date to view historical status.
            </p>
            <FloorLayoutHeatmap />
          </CollapsibleContent>
        </SectionCard>
      </Collapsible>

      {/* New Admission Screening */}
      <Collapsible open={admissionScreeningOpen} onOpenChange={setAdmissionScreeningOpen}>
        <SectionCard 
          title="New Admission IP Screening"
          actions={
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm">
                <ChevronDown className={`w-4 h-4 transition-transform ${admissionScreeningOpen ? '' : '-rotate-90'}`} />
              </Button>
            </CollapsibleTrigger>
          }
        >
          <CollapsibleContent>
            <p className="text-sm text-muted-foreground mb-4">
              Track new admissions requiring infection prevention screening. Flags overdue screenings (&gt;72 hours per CMS).
              Print individual screening forms with vaccination offers and clinical assessment checkboxes.
            </p>
            <NewAdmissionScreeningForm daysBack={14} />
          </CollapsibleContent>
        </SectionCard>
      </Collapsible>

      {/* Line Listing Reports */}
      <Collapsible open={lineListingOpen} onOpenChange={setLineListingOpen}>
        <SectionCard 
          title="Line Listing Reports"
          actions={
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm">
                <ChevronDown className={`w-4 h-4 transition-transform ${lineListingOpen ? '' : '-rotate-90'}`} />
              </Button>
            </CollapsibleTrigger>
          }
        >
          <CollapsibleContent>
            <p className="text-sm text-muted-foreground mb-4">
              Generate line listing reports matching CDC/CMS templates for outbreak documentation.
              Customize form fields in Settings → Line Listing Form Configuration.
            </p>
            
            {/* Active Outbreaks */}
            {activeOutbreaks.length > 0 ? (
              <div className="space-y-3">
                <h4 className="text-sm font-medium">Active Outbreaks</h4>
                {activeOutbreaks.map(outbreak => {
                  const entries = getLineListingsByOutbreak(db, outbreak.id);
                  return (
                    <div 
                      key={outbreak.id} 
                      className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className={
                          outbreak.type === 'respiratory' ? 'bg-blue-100 text-blue-800' :
                          outbreak.type === 'gi' ? 'bg-amber-100 text-amber-800' :
                          outbreak.type === 'skin' ? 'bg-pink-100 text-pink-800' :
                          'bg-gray-100 text-gray-800'
                        }>
                          {outbreak.type.toUpperCase()}
                        </Badge>
                        <div>
                          <p className="font-medium text-sm">{outbreak.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {entries.length} cases • Started {new Date(outbreak.startDate).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const facility = db.settings.facilityName || 'Healthcare Facility';
                          const doc = generateLineListingPdf({
                            outbreak,
                            entries,
                            facility
                          });
                          doc.save(`${outbreak.name.replace(/\s+/g, '_')}_Line_List.pdf`);
                          toast.success('Line listing PDF generated');
                        }}
                      >
                        <Printer className="w-4 h-4 mr-2" />
                        Print
                      </Button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No active outbreaks. Create an outbreak from the Outbreak & Line Listing view.</p>
              </div>
            )}

            {/* Blank Templates */}
            <div className="mt-6 pt-4 border-t">
              <h4 className="text-sm font-medium mb-3">Print Blank Templates</h4>
              <div className="flex flex-wrap gap-2">
                {ALL_TEMPLATES.map(template => (
                  <Button
                    key={template.id}
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const facility = db.settings.facilityName || 'Healthcare Facility';
                      const doc = generateBlankLineListingPdf(template.id, template.name, facility);
                      doc.save(`${template.name.replace(/\s+/g, '_')}_Blank_Template.pdf`);
                      toast.success(`${template.name} blank template downloaded`);
                    }}
                  >
                    <FileDown className="w-4 h-4 mr-1" />
                    {template.name}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Download blank line listing forms for manual documentation during outbreaks.
              </p>
            </div>
          </CollapsibleContent>
        </SectionCard>
      </Collapsible>

      <SectionCard title="Infection Control Binder Organization">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Generate printable cover pages and section dividers for organizing your physical Infection Control binder.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button 
              variant="outline" 
              onClick={() => {
                const facility = db.settings.facilityName || 'Healthcare Facility';
                const doc = generateBinderCoverPdf(facility);
                doc.save(`infection_control_binder_cover_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
                toast.success('Binder cover page downloaded');
              }}
            >
              <FileDown className="w-4 h-4 mr-2" />
              Download Cover Page
            </Button>
            <Button 
              variant="outline" 
              onClick={() => {
                const facility = db.settings.facilityName || 'Healthcare Facility';
                const doc = generateBinderDividersPdf(facility);
                doc.save(`infection_control_binder_dividers_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
                toast.success('Binder dividers downloaded (8 sections)');
              }}
            >
              <FileDown className="w-4 h-4 mr-2" />
              Download Section Dividers
            </Button>
          </div>
          <div className="text-xs text-muted-foreground mt-2">
            <strong>Sections included:</strong> Infection Prevention • Antibiotic Stewardship • Immunization Tracking • 
            Surveillance & Trending • Compliance & Survey • Hand Hygiene & PPE • Outbreak Management • Clinical Notes
          </div>
        </div>
      </SectionCard>

      {/* Scheduled Reports */}
      <SectionCard title="Scheduled Reports">
        <ScheduledReportsPanel />
      </SectionCard>

      <SectionCard title="Reporting Process & QA">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                <FileText className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-medium">1. Pick the right report</p>
                <p className="text-xs text-muted-foreground">Choose Executive, Operational, or Surveillance based on the audience.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Filter className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-medium">2. Apply filters intentionally</p>
                <p className="text-xs text-muted-foreground">Use unit, date, and protocol filters to keep data precise.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                <ClipboardCheck className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-medium">3. QA the preview</p>
                <p className="text-xs text-muted-foreground">Verify counts, dates, and compliance notes before distribution.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Download className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-medium">4. Export or share</p>
                <p className="text-xs text-muted-foreground">Deliver PDF, CSV, or copy/paste for team follow-up.</p>
              </div>
            </div>
            <div className="grid gap-2 rounded-lg border border-border bg-muted/20 p-4">
              <p className="text-xs font-medium text-muted-foreground">Process checklist</p>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={hasGeneratedReport} />
                Report generated
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={hasFiltersApplied} />
                Filters applied
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={hasGeneratedReport} />
                Preview reviewed
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={hasCompletedOutput} />
                Exported/Shared
              </label>
            </div>
          </div>

          <div className="space-y-4 rounded-lg border border-border bg-muted/20 p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Current report status</p>
              <Badge variant={currentReport ? 'default' : 'secondary'}>
                {currentReport ? 'Ready' : 'Not generated'}
              </Badge>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Report</span>
                <span className="text-right font-medium">{currentReport?.title || '—'}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Generated</span>
                <span className="text-right">{formatTimestamp(currentReport?.generatedAt)}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Last action</span>
                <span className="text-right">{lastAction ? `${lastAction}${lastActionAt ? ` • ${format(lastActionAt, 'MMM d, h:mm a')}` : ''}` : '—'}</span>
              </div>
            </div>
            <div className="rounded-md border border-border bg-background p-3">
              <p className="text-xs font-medium text-muted-foreground">Filters summary</p>
              <p className="text-sm">
                {currentReport
                  ? Object.entries(currentReport.filters)
                      .filter(([, value]) => value)
                      .map(([key, value]) => `${key}: ${value}`)
                      .join(' • ') || 'No filters applied'
                  : 'Generate a report to see applied filters.'}
              </p>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* Report Output */}
      <SectionCard title="Report Output">
        <div className="filter-panel mb-6">
          {/* Row 1: Common filters */}
          <div className="flex flex-wrap items-end gap-4 mb-4">
            {/* Export Format - Toggle Group Style */}
            <div className="flex-shrink-0">
              <label className="text-sm font-medium mb-2 block">Export Format</label>
              <div className="inline-flex rounded-md border border-input overflow-hidden">
                {['PDF', 'HTML', 'CSV', 'JSON'].map((fmt, idx) => (
                  <button 
                    key={fmt}
                    className={`px-3 py-2 text-sm font-medium transition-colors ${
                      exportFormat === fmt 
                        ? 'bg-primary text-primary-foreground' 
                        : 'bg-background text-foreground hover:bg-muted'
                    } ${idx > 0 ? 'border-l border-input' : ''}`}
                    onClick={() => setExportFormat(fmt)}
                  >
                    {fmt}
                  </button>
                ))}
              </div>
            </div>

            {/* Print Fit */}
            <div className="min-w-[220px]">
              <label className="text-sm font-medium mb-2 block">Print Fit</label>
              <div className="flex flex-wrap items-center gap-3">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Font size</p>
                  <ToggleGroup
                    type="single"
                    value={printFontSize}
                    onValueChange={(value) => {
                      if (value) setPrintFontSize(value as 'normal' | 'compact');
                    }}
                    className="inline-flex rounded-md border border-input overflow-hidden"
                  >
                    <ToggleGroupItem value="normal" className="text-xs px-2 py-1">Normal</ToggleGroupItem>
                    <ToggleGroupItem value="compact" className="text-xs px-2 py-1">Small</ToggleGroupItem>
                  </ToggleGroup>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Columns</p>
                  <ToggleGroup
                    type="single"
                    value={printColumnWidth}
                    onValueChange={(value) => {
                      if (value) setPrintColumnWidth(value as 'wide' | 'narrow');
                    }}
                    className="inline-flex rounded-md border border-input overflow-hidden"
                  >
                    <ToggleGroupItem value="wide" className="text-xs px-2 py-1">Wide</ToggleGroupItem>
                    <ToggleGroupItem value="narrow" className="text-xs px-2 py-1">Narrow</ToggleGroupItem>
                  </ToggleGroup>
                </div>
              </div>
            </div>

            {/* Page-break Preview */}
            <div className="min-w-[180px]">
              <label className="text-sm font-medium mb-2 block">Preview Aids</label>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="page-break-preview"
                  checked={showPageBreaks}
                  onCheckedChange={(value) => setShowPageBreaks(value === true)}
                />
                <label htmlFor="page-break-preview" className="text-sm text-muted-foreground">
                  Page-break preview
                </label>
              </div>
            </div>

            {/* Unit */}
            <div className="min-w-[140px]">
              <label className="text-sm font-medium mb-2 block">Unit</label>
              <Select value={selectedUnit} onValueChange={setSelectedUnit}>
                <SelectTrigger>
                  <SelectValue placeholder="All Units" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Units</SelectItem>
                  {units.map(unit => (
                    <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Shift */}
            <div className="min-w-[120px]">
              <label className="text-sm font-medium mb-2 block">Shift</label>
              <Select value={selectedShift} onValueChange={setSelectedShift}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Day">Day</SelectItem>
                  <SelectItem value="Evening">Evening</SelectItem>
                  <SelectItem value="Night">Night</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* From Date */}
            <div className="min-w-[140px]">
              <label className="text-sm font-medium mb-2 block">From</label>
              <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} />
            </div>

            {/* To Date */}
            <div className="min-w-[140px]">
              <label className="text-sm font-medium mb-2 block">To / As of</label>
              <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} />
            </div>
          </div>
          
          {/* Row 2: Extended report filters */}
          <div className="flex flex-wrap items-end gap-4 pt-3 border-t border-border">
            {/* Vaccine Type */}
            <div className="min-w-[140px]">
              <label className="text-sm font-medium mb-2 block">Vaccine Type</label>
              <Select value={selectedVaccineType} onValueChange={setSelectedVaccineType}>
                <SelectTrigger>
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="flu">Influenza</SelectItem>
                  <SelectItem value="pneumo">Pneumonia</SelectItem>
                  <SelectItem value="covid">COVID-19</SelectItem>
                  <SelectItem value="rsv">RSV</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Follow-up Status */}
            <div className="min-w-[140px]">
              <label className="text-sm font-medium mb-2 block">Follow-up Status</label>
              <Select value={selectedFollowUpStatus} onValueChange={setSelectedFollowUpStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="escalated">Escalated</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Month Selector */}
            <div className="min-w-[140px]">
              <label className="text-sm font-medium mb-2 block">Month</label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Year Selector */}
            <div className="min-w-[100px]">
              <label className="text-sm font-medium mb-2 block">Year</label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Protocol Filter */}
            <div className="min-w-[140px]">
              <label className="text-sm font-medium mb-2 block">Protocol</label>
              <Select value={selectedProtocol} onValueChange={setSelectedProtocol}>
                <SelectTrigger>
                  <SelectValue placeholder="All Protocols" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Protocols</SelectItem>
                  <SelectItem value="EBP">EBP (7-day review)</SelectItem>
                  <SelectItem value="Isolation">Isolation (3-day review)</SelectItem>
                  <SelectItem value="Standard Precautions">Standard Precautions</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Surveyor Packet Options */}
            <div className="min-w-[200px] border-l border-border pl-4">
              <label className="text-sm font-medium mb-2 block">Surveyor Packet Options</label>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={surveyorIncludeABT} 
                    onChange={(e) => setSurveyorIncludeABT(e.target.checked)}
                    className="rounded border-input"
                  />
                  Include ABT Details
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={surveyorIncludeIP} 
                    onChange={(e) => setSurveyorIncludeIP(e.target.checked)}
                    className="rounded border-input"
                  />
                  Include IP Details
                </label>
              </div>
            </div>
          </div>
        </div>

        <div ref={reportRef} className="border border-border rounded-lg overflow-hidden relative">
          {currentReport && showPageBreaks && (
            <div
              className="pointer-events-none absolute inset-0 z-10"
              style={{
                backgroundImage:
                  'linear-gradient(to bottom, rgba(59, 130, 246, 0.45) 0, rgba(59, 130, 246, 0.45) 1px, transparent 1px, transparent 11in)',
                backgroundSize: '100% 11in',
                backgroundRepeat: 'repeat'
              }}
            />
          )}
          {currentReport ? (
            <>
              {trendReport && trendReport.chartData && (
                <InfectionTrendChart data={trendReport.chartData} />
              )}
              {isIPDailyMorningReport(currentReport) ? (
                <IPDailyMorningReportPreview
                  report={currentReport}
                  printFontSize={printFontSize}
                  columnWidth={printColumnWidth}
                />
              ) : (
                <ReportPreview
                  report={currentReport}
                  printFontSize={printFontSize}
                  columnWidth={printColumnWidth}
                />
              )}
            </>
          ) : (
            <div className="bg-muted/30 min-h-[200px] flex items-center justify-center">
              <p className="text-muted-foreground">Select a report to generate preview...</p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" size="sm" onClick={handleClear} disabled={!currentReport}>
            <Trash className="w-4 h-4 mr-2" />
            Clear
          </Button>
          <Button variant="outline" size="sm" onClick={handleCopy} disabled={!currentReport}>
            <Copy className="w-4 h-4 mr-2" />
            Copy
          </Button>
          {printSafeRecommended && (
            <Button variant="outline" size="sm" onClick={handlePrintSafeExport} disabled={!currentReport}>
              <FileDown className="w-4 h-4 mr-2" />
              Export PDF (print-safe)
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleExport} disabled={!currentReport}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button size="sm" onClick={handlePrint} disabled={!currentReport}>
            <Printer className="w-4 h-4 mr-2" />
            Print
          </Button>
        </div>
      </SectionCard>

      {onNavigate && (
        <SectionCard title="Next Steps">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => onNavigate('audit')}>
              Review Audit Trail
            </Button>
            <Button size="sm" variant="outline" onClick={() => onNavigate('dashboard')}>
              Return to Dashboard
            </Button>
            <Button size="sm" variant="outline" onClick={() => onNavigate('outbreak')}>
              Review Outbreaks
            </Button>
          </div>
        </SectionCard>
      )}
    </div>
  );
};

export default ReportsView;
