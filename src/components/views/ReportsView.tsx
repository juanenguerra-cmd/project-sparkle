import { RefreshCw, Zap, ChevronDown, Printer, Copy, Download, Trash, FileText, FileDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import SectionCard from '@/components/dashboard/SectionCard';
import DataFlowVisual from '@/components/dashboard/DataFlowVisual';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useState, useRef } from 'react';
import { loadDB, getActiveResidents, getActiveABT, getActiveIPCases, getVaxDue } from '@/lib/database';
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
  InfectionTrendReport
} from '@/lib/reportGenerators';
import ReportPreview from '@/components/reports/ReportPreview';
import InfectionTrendChart from '@/components/reports/InfectionTrendChart';
import ScheduledReportsPanel from '@/components/reports/ScheduledReportsPanel';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { buildDailyPrecautionListPdf, isDailyPrecautionListReport } from '@/lib/pdf/dailyPrecautionListPdf';

const ReportsView = () => {
  const [executiveOpen, setExecutiveOpen] = useState(true);
  const [operationalOpen, setOperationalOpen] = useState(true);
  const [selectedUnit, setSelectedUnit] = useState('all');
  const [selectedShift, setSelectedShift] = useState('Day');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [currentReport, setCurrentReport] = useState<ReportData | null>(null);
  const [trendReport, setTrendReport] = useState<InfectionTrendReport | null>(null);
  const [exportFormat, setExportFormat] = useState('PDF');
  const reportRef = useRef<HTMLDivElement>(null);

  const db = loadDB();
  const activeResidents = getActiveResidents(db).length;
  const activeABT = getActiveABT(db).length;
  const activeIP = getActiveIPCases(db).length;
  const vaxDue = getVaxDue(db).length;

  // Get unique units from census
  const units = [...new Set(
    Object.values(db.census.residentsByMrn)
      .filter(r => r.active_on_census && r.unit)
      .map(r => r.unit)
  )].sort();

  const executiveReports = [
    { id: 'survey_readiness', name: 'Survey Readiness Packet', description: 'Comprehensive compliance documentation for CMS surveys' },
    { id: 'qapi', name: 'QAPI Report', description: 'Quality metrics and performance indicators' },
    { id: 'infection_trends', name: 'Infection Rate Trends', description: 'Monthly/quarterly infection rate analysis' },
    { id: 'compliance', name: 'Compliance Crosswalk', description: 'Regulatory compliance status overview' },
  ];

  const operationalReports = [
    { id: 'daily_ip', name: 'Daily IP Worklist', description: 'Active isolation precautions and EBP cases' },
    { id: 'abt_review', name: 'ABT Review Worklist', description: 'Antibiotic courses requiring review' },
    { id: 'vax_due', name: 'Vaccination Due List', description: 'Residents with upcoming or overdue vaccinations' },
    { id: 'precautions_list', name: 'Active Precautions List', description: 'Current isolation precautions by unit' },
    { id: 'exposure_log', name: 'Exposure Tracking Log', description: 'Potential exposure events and follow-ups' },
  ];

  const handleGenerateReport = (reportId: string) => {
    const db = loadDB();
    let report: ReportData | null = null;

    switch (reportId) {
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
        toast.success(`Generated: ${trendData.title}`);
        return;
      case 'compliance':
        report = generateComplianceCrosswalk(db);
        break;
      default:
        toast.error('Unknown report type');
        return;
    }

    if (report) {
      setCurrentReport(report);
      setTrendReport(null);
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
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid black; padding: 8px; text-align: left; }
            th { background-color: #f0f0f0; font-weight: bold; }
            h1, h2 { text-align: center; margin: 0; }
            .header { text-align: center; margin-bottom: 20px; }
            .filters { display: flex; justify-content: center; gap: 30px; margin: 10px 0; }
            .footer { margin-top: 30px; }
            .disclaimer { font-size: 11px; font-style: italic; margin-top: 20px; }
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
  };

  const handleCopy = async () => {
    if (!currentReport) {
      toast.error('Generate a report first');
      return;
    }
    
    // Create a text version of the report
    const lines = [
      currentReport.title,
      currentReport.subtitle || '',
      '',
      Object.entries(currentReport.filters).map(([k, v]) => `${k}: ${v}`).join(' | '),
      '',
      currentReport.headers.join('\t'),
      ...currentReport.rows.map(row => row.join('\t'))
    ];
    
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      toast.success('Report copied to clipboard');
    } catch {
      toast.error('Failed to copy');
    }
  };

  const handleExport = () => {
    if (!currentReport) {
      toast.error('Generate a report first');
      return;
    }
    
    const sanitizedTitle = currentReport.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const dateStr = new Date().toISOString().slice(0, 10);
    
    if (exportFormat === 'PDF') {
      const db = loadDB();
      const facility = db.settings.facilityName || 'Healthcare Facility';

      // Daily Precaution List: strict template PDF (matches on-screen preview)
      if (isDailyPrecautionListReport(currentReport)) {
        const doc = buildDailyPrecautionListPdf({ report: currentReport, facility });
        const filename = `${sanitizedTitle}_${dateStr}.pdf`;
        doc.save(filename);
        toast.success(`Exported as ${filename}`);
        return;
      }
      
      const doc = new jsPDF();
      
      // Header
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(facility, doc.internal.pageSize.getWidth() / 2, 15, { align: 'center' });
      
      doc.setFontSize(12);
      doc.text(currentReport.title, doc.internal.pageSize.getWidth() / 2, 22, { align: 'center' });
      
      if (currentReport.subtitle) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(currentReport.subtitle, doc.internal.pageSize.getWidth() / 2, 28, { align: 'center' });
      }
      
      // Filters line
      doc.setFontSize(9);
      const filterParts = [];
      if (currentReport.filters.unit) filterParts.push(`Unit: ${currentReport.filters.unit}`);
      if (currentReport.filters.date) filterParts.push(`Date: ${currentReport.filters.date}`);
      if (currentReport.filters.shift) filterParts.push(`Shift: ${currentReport.filters.shift}`);
      if (filterParts.length > 0) {
        doc.text(filterParts.join('  |  '), doc.internal.pageSize.getWidth() / 2, 34, { align: 'center' });
      }
      
      // Table
      autoTable(doc, {
        head: [currentReport.headers],
        body: currentReport.rows,
        startY: 40,
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [250, 250, 250] },
        tableLineColor: [0, 0, 0],
        tableLineWidth: 0.1,
      });
      
      // Footer
      const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY || 40;
      if (currentReport.footer) {
        doc.setFontSize(9);
        doc.text(`Prepared by: ________________________`, 14, finalY + 15);
        doc.text(`Signature: ________________________`, 14, finalY + 22);
        doc.text(`Title: ________________________`, 110, finalY + 15);
        doc.text(`Date/Time: ${currentReport.footer.dateTime || new Date().toLocaleString()}`, 110, finalY + 22);
        
        if (currentReport.footer.disclaimer) {
          doc.setFontSize(8);
          doc.setFont('helvetica', 'italic');
          doc.text(`* ${currentReport.footer.disclaimer}`, 14, finalY + 35, { maxWidth: 180 });
        }
      }
      
      const filename = `${sanitizedTitle}_${dateStr}.pdf`;
      doc.save(filename);
      toast.success(`Exported as ${filename}`);
      return;
    }
    
    let content: string;
    let filename: string;
    let mimeType: string;
    
    switch (exportFormat) {
      case 'CSV':
        content = [
          currentReport.headers.join(','),
          ...currentReport.rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');
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
    
    toast.success(`Exported as ${filename}`);
  };

  const handleClear = () => {
    setCurrentReport(null);
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
            <div className="grid md:grid-cols-2 gap-4">
              {executiveReports.map((report) => (
                <div key={report.id} className="border border-border rounded-lg p-4 hover:border-primary/50 transition-colors">
                  <div className="flex items-start gap-3">
                    <FileText className="w-5 h-5 text-primary mt-0.5" />
                    <div className="flex-1">
                      <h4 className="font-semibold mb-1">{report.name}</h4>
                      <p className="text-sm text-muted-foreground mb-3">{report.description}</p>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleGenerateReport(report.id)}
                      >
                        Generate
                      </Button>
                    </div>
                  </div>
                </div>
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
            <div className="grid md:grid-cols-2 gap-4">
              {operationalReports.map((report) => (
                <div key={report.id} className="border border-border rounded-lg p-4 hover:border-primary/50 transition-colors">
                  <div className="flex items-start gap-3">
                    <FileText className="w-5 h-5 text-primary mt-0.5" />
                    <div className="flex-1">
                      <h4 className="font-semibold mb-1">{report.name}</h4>
                      <p className="text-sm text-muted-foreground mb-3">{report.description}</p>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleGenerateReport(report.id)}
                      >
                        Generate
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </SectionCard>
      </Collapsible>

      {/* Scheduled Reports */}
      <SectionCard title="Scheduled Reports">
        <ScheduledReportsPanel />
      </SectionCard>

      {/* Report Output */}
      <SectionCard title="Report Output">
        <div className="filter-panel mb-6">
          {/* All controls in one row */}
          <div className="flex flex-wrap items-end gap-4">
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
        </div>

        <div ref={reportRef} className="border border-border rounded-lg overflow-hidden">
          {currentReport ? (
            <>
              {trendReport && trendReport.chartData && (
                <InfectionTrendChart data={trendReport.chartData} />
              )}
              <ReportPreview report={currentReport} />
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
    </div>
  );
};

export default ReportsView;
