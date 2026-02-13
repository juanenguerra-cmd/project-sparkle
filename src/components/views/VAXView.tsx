import { useEffect, useState, useMemo } from 'react';
import { Plus, RefreshCw, Download, Search, Eye, Edit, Check, X, Upload, Trash2, RotateCcw, Printer, AlertTriangle, BookOpen, Flame, ChevronLeft, ChevronRight, ClipboardCopy, CalendarCheck2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import SectionCard from '@/components/dashboard/SectionCard';
import TrackerSummary from '@/components/dashboard/TrackerSummary';
import { loadDB, getVaxDue, saveDB, addAudit } from '@/lib/database';
import { VaxRecord } from '@/lib/types';
import VAXImportModal from '@/components/modals/VAXImportModal';
import VAXCaseModal from '@/components/modals/VAXCaseModal';
import VaxEducationModal from '@/components/modals/VaxEducationModal';
import ReofferActionModal, { ReofferActionValues } from '@/components/modals/ReofferActionModal';
import SwipeableVaxRow from '@/components/vax/SwipeableVaxRow';
import { useToast } from '@/hooks/use-toast';
import { getReofferCandidates, ReofferCandidate, getReofferSummary } from '@/lib/vaccineReofferLogic';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useIsMobile } from '@/hooks/use-mobile';
import { SortableTableHeader, SortDirection } from '@/components/ui/sortable-table-header';
import { isoDateFromAny, mrnMatchKeys, todayISO } from '@/lib/parsers';

type VAXFilter = 'all' | 'due' | 'overdue' | 'given' | 'declined' | 'reoffer';

const ITEMS_PER_PAGE = 20;

// Helper to escape CSV values
const escapeCSV = (val: string | number | boolean | null | undefined): string => {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

interface VAXViewProps {
  initialStatusFilter?: 'due' | 'overdue' | 'due_or_overdue' | 'all';
}

const VAXView = ({ initialStatusFilter }: VAXViewProps) => {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [db, setDb] = useState(() => loadDB());
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<VAXFilter>('due');
  const [showImportModal, setShowImportModal] = useState(false);
  const [showCaseModal, setShowCaseModal] = useState(false);
  const [showEducationModal, setShowEducationModal] = useState(false);
  const [showReofferActionModal, setShowReofferActionModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<VaxRecord | null>(null);
  const [unitFilter, setUnitFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortKey, setSortKey] = useState<string | null>('_name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [fromDateFilter, setFromDateFilter] = useState('');
  const [toDateFilter, setToDateFilter] = useState('');


  useEffect(() => {
    if (!initialStatusFilter) return;
    if (initialStatusFilter === 'all') {
      setActiveFilter('all');
      return;
    }
    if (initialStatusFilter === 'overdue') {
      setActiveFilter('overdue');
      return;
    }
    setActiveFilter('due');
  }, [initialStatusFilter]);
  const records = db.records.vax;
  const activeOutbreaks = db.records.outbreaks.filter(o => o.status === 'active');

  // Get active resident MRNs from census
  const activeCensusMrns = new Set<string>();
  Object.values(db.census.residentsByMrn)
    .filter(r => r.active_on_census)
    .forEach(r => {
      mrnMatchKeys(r.mrn).forEach(key => activeCensusMrns.add(key));
    });

  const isActiveCensusMrn = (mrn?: string) => {
    const matchKeys = mrnMatchKeys(mrn || '');
    if (matchKeys.length === 0) return true;
    return matchKeys.some(key => activeCensusMrns.has(key));
  };

  const getVaxStartDate = (record: VaxRecord): string => {
    const status = (record.status || '').toLowerCase();

    if (status === 'given') {
      return isoDateFromAny(record.dateGiven || record.date_given || '');
    }

    if (status === 'due' || status === 'overdue') {
      return isoDateFromAny(record.dueDate || record.due_date || '');
    }

    if (status === 'declined') {
      return isoDateFromAny(
        record.educationDate
          || record.offerDate
          || record.dateGiven
          || record.date_given
          || record.createdAt
          || ''
      );
    }

    return '';
  };

  const dueRecords = getVaxDue(db);
  
  // CDC-based re-offer candidates with outbreak integration
  const reofferCandidates = useMemo(() => 
    getReofferCandidates(records, activeCensusMrns, activeOutbreaks), 
    [records, activeCensusMrns, activeOutbreaks]
  );
  const reofferSummary = useMemo(() => 
    getReofferSummary(reofferCandidates), 
    [reofferCandidates]
  );
  const reofferMrnSet = useMemo(() => 
    new Set(reofferCandidates.map(c => `${c.record.mrn}_${c.record.vaccine || c.record.vaccine_type}`)), 
    [reofferCandidates]
  );
  
  // Count outbreak-linked re-offers
  const outbreakLinkedCount = reofferCandidates.filter(c => c.outbreakLinked).length;

  // Get unique units for filter
  const availableUnits = useMemo(() => {
    const units = new Set(records.map(r => r.unit).filter(Boolean));
    return Array.from(units).sort();
  }, [records]);

  const filteredRecords = useMemo(() => {
    let result = activeFilter === 'reoffer' 
      ? reofferCandidates.map(c => c.record)
      : records;
    
    // Apply unit filter
    if (unitFilter !== 'all') {
      result = result.filter(r => r.unit === unitFilter);
    }
    
    // Apply search filter
    result = result.filter(r => {
      const name = r.residentName || r.name || '';
      const vaccine = r.vaccine || r.vaccine_type || '';
      return name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        vaccine.toLowerCase().includes(searchTerm.toLowerCase());
    });
    
    // Apply start date filters (requires valid start date whenever date filtering is active)
    if (fromDateFilter || toDateFilter) {
      result = result.filter(r => {
        const startDate = getVaxStartDate(r);
        if (!startDate) return false;
        if (fromDateFilter && startDate < fromDateFilter) return false;
        if (toDateFilter && startDate > toDateFilter) return false;
        return true;
      });
    }

    // Apply status filter (except reoffer which is already filtered)
    if (activeFilter !== 'reoffer') {
      result = result.filter(r => {
        // For due/overdue views, exclude discharged residents from census
        if (activeFilter === 'due' || activeFilter === 'overdue') {
          if (r.mrn && !isActiveCensusMrn(r.mrn)) return false;
        }
        
        switch (activeFilter) {
          case 'due':
            return initialStatusFilter === 'due_or_overdue' ? (r.status === 'due' || r.status === 'overdue') : r.status === 'due';
          case 'overdue':
            return r.status === 'overdue';
          case 'given':
            return r.status === 'given';
          case 'declined':
            return r.status === 'declined';
          default:
            return true;
        }
      });
    }
    
    // Add sortable fields
    return result.map(r => ({
      ...r,
      _name: r.residentName || r.name || '',
      _vaccine: r.vaccine || r.vaccine_type || '',
      _dateGiven: r.dateGiven || r.date_given || '',
      _dueDate: r.dueDate || r.due_date || ''
    }));
  }, [activeFilter, reofferCandidates, records, unitFilter, searchTerm, activeCensusMrns, fromDateFilter, toDateFilter]);

  // Sort the filtered records
  const sortedRecords = useMemo(() => {
    if (!sortKey || !sortDirection) return filteredRecords;
    
    return [...filteredRecords].sort((a, b) => {
      const aVal = (a as any)[sortKey];
      const bVal = (b as any)[sortKey];
      
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return sortDirection === 'asc' ? 1 : -1;
      if (bVal == null) return sortDirection === 'asc' ? -1 : 1;
      
      let comparison = 0;
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        comparison = aVal.localeCompare(bVal, undefined, { numeric: true, sensitivity: 'base' });
      } else {
        comparison = String(aVal).localeCompare(String(bVal));
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [filteredRecords, sortKey, sortDirection]);

  const handlePrintFiltered = () => {
    const rowsToPrint = sortedRecords;
    const printContent = `
      <html>
        <head>
          <title>VAX Tracker - Filtered Results</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            h1 { font-size: 16px; margin-bottom: 5px; }
            p { font-size: 11px; color: #666; }
            table { width: 100%; border-collapse: collapse; font-size: 10px; }
            th, td { border: 1px solid #ccc; padding: 4px 6px; text-align: left; }
            th { background: #f5f5f5; }
          </style>
        </head>
        <body>
          <h1>VAX Tracker - Filtered Results</h1>
          <p>Unit: ${unitFilter === 'all' ? 'All Units' : unitFilter} • Status: ${activeFilter} • Date: ${new Date().toLocaleString()}</p>
          <p>Filters: ${fromDateFilter || 'Any'} to ${toDateFilter || 'Any'} • ${rowsToPrint.length} record(s)</p>
          <table>
            <thead><tr><th>Resident</th><th>Unit/Room</th><th>Vaccine</th><th>Status</th><th>Start Date</th></tr></thead>
            <tbody>
              ${rowsToPrint.map(r => `<tr>
                <td>${r.residentName || r.name || '—'}</td>
                <td>${r.unit} / ${r.room}</td>
                <td>${r.vaccine || r.vaccine_type || '—'}</td>
                <td>${r.status}</td>
                <td>${getVaxStartDate(r) || '—'}</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;
    const w = window.open('', '_blank');
    if (w) {
      w.document.write(printContent);
      w.document.close();
      w.print();
    }
  };

  const handleSort = (key: string) => {
    if (sortKey === key) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortKey(null);
        setSortDirection(null);
      }
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  // Pagination
  const totalPages = Math.ceil(sortedRecords.length / ITEMS_PER_PAGE);
  const paginatedRecords = useMemo(() => {
    const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;
    return sortedRecords.slice(startIdx, startIdx + ITEMS_PER_PAGE);
  }, [sortedRecords, currentPage]);

  // Reset page when filters change
  const handleFilterChange = (newFilter: VAXFilter) => {
    setActiveFilter(newFilter);
    setCurrentPage(1);
  };

  const handleUnitFilterChange = (unit: string) => {
    setUnitFilter(unit);
    setCurrentPage(1);
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [fromDateFilter, toDateFilter]);
  
  // Helper to get reoffer info for a record
  const getReofferInfo = (record: VaxRecord): ReofferCandidate | undefined => {
    return reofferCandidates.find(c => c.record.id === record.id);
  };
  
  // Accurate counts - exclude discharged census residents for due/overdue
  const givenCount = records.filter(r => r.status === 'given').length;
  const dueCount = records.filter(r => {
    if (r.status !== 'due') return false;
    if (r.mrn && !isActiveCensusMrn(r.mrn)) return false;
    return true;
  }).length;
  const declinedCount = records.filter(r => r.status === 'declined').length;
  const overdueCount = records.filter(r => {
    if (r.status !== 'overdue') return false;
    if (r.mrn && !isActiveCensusMrn(r.mrn)) return false;
    return true;
  }).length;
  const reofferCount = reofferCandidates.length;

  const handleRefresh = () => {
    setDb(loadDB());
  };

  const handleDataChange = () => {
    setDb(loadDB());
  };

  const handleDeleteRecord = (record: VaxRecord) => {
    if (!window.confirm(`Delete VAX record for ${record.residentName || record.name}?`)) return;
    
    const currentDb = loadDB();
    const idx = currentDb.records.vax.findIndex(r => r.id === record.id);
    if (idx >= 0) {
      currentDb.records.vax.splice(idx, 1);
      addAudit(currentDb, 'vax_delete', `Deleted VAX record for ${record.residentName || record.name}`, 'vax');
      saveDB(currentDb);
      setDb(currentDb);
      toast({ title: 'VAX Record Deleted' });
    }
  };

  const handleExport = () => {
    const headers = [
      'ID', 'MRN', 'Resident Name', 'Unit', 'Room', 'Vaccine', 'Dose', 'Status',
      'Date Given', 'Due Date', 'Next Due Date', 'Offer Date', 'Education Provided',
      'Education Date', 'Education Outcome', 'Manufacturer', 'Lot Number',
      'Administration Site', 'Decline Reason', 'Consent Form Attached', 'Notes', 'Created At'
    ];
    
    const rows = records.map(r => [
      escapeCSV(r.id),
      escapeCSV(r.mrn),
      escapeCSV(r.residentName || r.name),
      escapeCSV(r.unit),
      escapeCSV(r.room),
      escapeCSV(r.vaccine || r.vaccine_type),
      escapeCSV(r.dose),
      escapeCSV(r.status),
      escapeCSV(r.dateGiven || r.date_given),
      escapeCSV(r.dueDate || r.due_date),
      escapeCSV(r.nextDueDate),
      escapeCSV(r.offerDate),
      escapeCSV(r.educationProvided),
      escapeCSV(r.educationDate),
      escapeCSV(r.educationOutcome),
      escapeCSV(r.manufacturer),
      escapeCSV(r.lotNumber),
      escapeCSV(r.administrationSite),
      escapeCSV(r.declineReason),
      escapeCSV(r.consentFormAttached),
      escapeCSV(r.notes),
      escapeCSV(r.createdAt)
    ].join(','));
    
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vax_records_${todayISO()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrintReofferList = () => {
    const printContent = `
      <html>
        <head>
          <title>Vaccine Re-offer List - ${new Date().toLocaleDateString()}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            h1 { font-size: 18px; margin-bottom: 5px; }
            h2 { font-size: 14px; color: #666; margin-top: 0; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 11px; }
            th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
            th { background: #f5f5f5; font-weight: bold; }
            .high { color: #dc2626; font-weight: bold; }
            .medium { color: #d97706; }
            .low { color: #6b7280; }
            .footer { margin-top: 20px; font-size: 10px; color: #666; }
          </style>
        </head>
        <body>
          <h1>Vaccine Re-offer List</h1>
          <h2>Generated: ${new Date().toLocaleString()} | ${reofferCandidates.length} residents</h2>
          <table>
            <thead>
              <tr>
                <th>Resident</th>
                <th>Unit/Room</th>
                <th>Vaccine</th>
                <th>Days Since Decline</th>
                <th>Priority</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              ${reofferCandidates.map(c => `
                <tr>
                  <td>${c.record.residentName || c.record.name || '—'}</td>
                  <td>${c.record.unit} / ${c.record.room}</td>
                  <td>${c.record.vaccine || c.record.vaccine_type || '—'}</td>
                  <td>${c.daysSinceDecline} days</td>
                  <td class="${c.priority}">${c.priority.toUpperCase()}</td>
                  <td>${c.reason}${c.seasonalContext ? ` (${c.seasonalContext})` : ''}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div class="footer">
            <p>Re-offer recommendations based on CDC vaccination guidelines. High priority = immediate action recommended.</p>
          </div>
        </body>
      </html>
    `;
    
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const handleSaveReofferAction = async (record: VaxRecord, values: ReofferActionValues) => {
    const note = values.generatedNote;

    const updatedDb = loadDB();
    const idx = updatedDb.records.vax.findIndex(r => r.id === record.id);

    if (idx !== -1) {
      const updatedRecord = updatedDb.records.vax[idx];
      updatedRecord.educationProvided = true;
      updatedRecord.educationDate = values.encounterDate;
      updatedRecord.educationOutcome = values.outcome === 'consented' ? 'accepted' : 'declined';
      updatedRecord.offerDate = values.encounterDate;

      if (values.outcome === 'consented') {
        updatedRecord.status = 'given';
        updatedRecord.dateGiven = values.encounterDate;
        addAudit(updatedDb, 'vax_reoffer_consented', `Re-offer consented for ${updatedRecord.vaccine} - ${updatedRecord.residentName || updatedRecord.name}`, 'vax');
      } else {
        updatedRecord.status = 'declined';
        addAudit(updatedDb, 'vax_reoffer_declined', `Re-offer declined for ${updatedRecord.vaccine} - ${updatedRecord.residentName || updatedRecord.name}`, 'vax');
      }

      updatedDb.records.notes.push({
        id: `note_${Date.now()}_${Math.random().toString(16).slice(2)}`,
        mrn: updatedRecord.mrn,
        residentName: updatedRecord.residentName || updatedRecord.name,
        name: updatedRecord.residentName || updatedRecord.name,
        unit: updatedRecord.unit,
        room: updatedRecord.room,
        category: 'Vaccination',
        text: note,
        createdAt: new Date().toISOString(),
        created_at: new Date().toISOString()
      });
      addAudit(updatedDb, 'note_add', `Re-offer note generated for ${updatedRecord.residentName || updatedRecord.name}`, 'notes');

      saveDB(updatedDb);
      setDb(updatedDb);
    }

    try {
      await navigator.clipboard.writeText(note);
      toast({
        title: 'Re-offer documented',
        description: 'Education note generated and copied to clipboard.',
      });
    } catch (error) {
      toast({
        title: 'Re-offer documented',
        description: 'Note was generated and saved, but clipboard copy failed.',
        variant: 'destructive',
      });
    }
  };

  const handleOpenReofferAction = (record: VaxRecord) => {
    setEditingRecord(record);
    setShowReofferActionModal(true);
  };

  const handleClearReoffer = (record: VaxRecord) => {
    // Create a new 'due' record to clear the declined status
    const updatedDb = loadDB();
    const idx = updatedDb.records.vax.findIndex(r => r.id === record.id);
    if (idx !== -1) {
      updatedDb.records.vax[idx].status = 'due';
      updatedDb.records.vax[idx].dueDate = todayISO();
      addAudit(updatedDb, 'vax_reoffer_cleared', `Cleared re-offer for ${record.vaccine} - ${record.residentName || record.name}`, 'vax');
      saveDB(updatedDb);
      setDb(updatedDb);
      toast({ title: 'Re-offer Cleared', description: 'Status changed to Due' });
    }
  };

  const handleMarkCurrentSeason = (record: VaxRecord) => {
    const updatedDb = loadDB();
    const idx = updatedDb.records.vax.findIndex(r => r.id === record.id);
    if (idx !== -1) {
      const today = todayISO();
      updatedDb.records.vax[idx].seasonOverrideCurrent = true;
      updatedDb.records.vax[idx].seasonOverrideAt = today;
      updatedDb.records.vax[idx].status = 'given';
      updatedDb.records.vax[idx].dateGiven = today;
      updatedDb.records.vax[idx].date_given = today;
      addAudit(
        updatedDb,
        'vax_season_override',
        `Marked ${record.vaccine || record.vaccine_type} updated with current season for ${record.residentName || record.name}`,
        'vax'
      );
      saveDB(updatedDb);
      setDb(updatedDb);
      toast({ title: 'Updated with current season', description: 'Record removed from outdated/re-offer detection.' });
    }
  };

  const handleMarkGiven = (record: VaxRecord) => {
    const updatedDb = loadDB();
    const idx = updatedDb.records.vax.findIndex(r => r.id === record.id);
    if (idx !== -1) {
      updatedDb.records.vax[idx].status = 'given';
      updatedDb.records.vax[idx].dateGiven = todayISO();
      addAudit(updatedDb, 'vax_given', `Marked ${record.vaccine} as given for ${record.residentName || record.name}`, 'vax');
      saveDB(updatedDb);
      setDb(updatedDb);
    }
  };

  const handleMarkDeclined = (record: VaxRecord) => {
    const updatedDb = loadDB();
    const idx = updatedDb.records.vax.findIndex(r => r.id === record.id);
    if (idx !== -1) {
      updatedDb.records.vax[idx].status = 'declined';
      addAudit(updatedDb, 'vax_declined', `Marked ${record.vaccine} as declined for ${record.residentName || record.name}`, 'vax');
      saveDB(updatedDb);
      setDb(updatedDb);
    }
  };

  const handleOpenEducation = (record: VaxRecord) => {
    setEditingRecord(record);
    setShowEducationModal(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'given':
        return <span className="badge-status badge-ok">Vaccinated</span>;
      case 'due':
        return <span className="badge-status badge-info">Due</span>;
      case 'overdue':
        return <span className="badge-status badge-bad">Overdue</span>;
      case 'declined':
        return <span className="badge-status badge-muted">Decline</span>;
      default:
        return <span className="badge-status badge-muted">{status}</span>;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">VAX Tracker</h2>
          <p className="text-sm text-muted-foreground">
            Vaccination Management & Immunization Status
            {records.length > 0 && ` • ${records.length} total records`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrintFiltered}>
            <Printer className="w-4 h-4 mr-2" />
            Print Filtered
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowImportModal(true)}>
            <Upload className="w-4 h-4 mr-2" />
            Import
          </Button>
          <Button size="sm" onClick={() => { setEditingRecord(null); setShowCaseModal(true); }}>
            <Plus className="w-4 h-4 mr-2" />
            Add Record
          </Button>
        </div>
      </div>

      {/* Trend Summary */}
      <TrackerSummary type="vax" />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="stat-card text-center">
          <div className="text-2xl font-bold text-success">{givenCount}</div>
          <div className="text-sm text-muted-foreground">Vaccinated</div>
        </div>
        <div className="stat-card text-center">
          <div className="text-2xl font-bold text-info">{dueCount}</div>
          <div className="text-sm text-muted-foreground">Due Soon</div>
        </div>
        <div className="stat-card text-center">
          <div className="text-2xl font-bold text-destructive">{overdueCount}</div>
          <div className="text-sm text-muted-foreground">Overdue</div>
        </div>
        <div className="stat-card text-center">
          <div className="text-2xl font-bold text-muted-foreground">{declinedCount}</div>
          <div className="text-sm text-muted-foreground">Declined</div>
        </div>
      </div>

      {/* Filter */}
      <div className="filter-panel">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Search by name or vaccine..." 
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Badge 
              variant={activeFilter === 'all' ? 'default' : 'outline'} 
              className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
              onClick={() => handleFilterChange('all')}
            >
              All ({records.length})
            </Badge>
            <Badge 
              variant={activeFilter === 'due' ? 'default' : 'outline'} 
              className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
              onClick={() => handleFilterChange('due')}
            >
              Due ({dueCount})
            </Badge>
            <Badge 
              variant={activeFilter === 'overdue' ? 'default' : 'outline'} 
              className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
              onClick={() => handleFilterChange('overdue')}
            >
              Overdue ({overdueCount})
            </Badge>
            <Badge 
              variant={activeFilter === 'given' ? 'default' : 'outline'} 
              className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
              onClick={() => handleFilterChange('given')}
            >
              Given ({givenCount})
            </Badge>
            <Badge 
              variant={activeFilter === 'declined' ? 'default' : 'outline'} 
              className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
              onClick={() => handleFilterChange('declined')}
            >
              Declined ({declinedCount})
            </Badge>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge 
                  variant={activeFilter === 'reoffer' ? 'default' : 'outline'} 
                  className={`cursor-pointer ${
                    activeFilter === 'reoffer' 
                      ? 'bg-amber-500 hover:bg-amber-600' 
                      : 'border-amber-500 text-amber-600 hover:bg-amber-500 hover:text-white'
                  }`}
                  onClick={() => handleFilterChange('reoffer')}
                >
                  <RotateCcw className="w-3 h-3 mr-1" />
                  Re-offer ({reofferCount})
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p className="font-medium">CDC-based Re-offer List</p>
                <p className="text-xs text-muted-foreground">
                  Declined vaccines due for re-offer per CDC guidelines
                </p>
              </TooltipContent>
            </Tooltip>
          </div>
          <Select value={unitFilter} onValueChange={handleUnitFilterChange}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="All Units" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Units</SelectItem>
              {availableUnits.map(u => (
                <SelectItem key={u} value={u}>{u}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="date"
            value={fromDateFilter}
            onChange={(e) => setFromDateFilter(e.target.value)}
            className="w-[150px]"
            aria-label="From date filter"
          />
          <Input
            type="date"
            value={toDateFilter}
            onChange={(e) => setToDateFilter(e.target.value)}
            className="w-[150px]"
            aria-label="To date filter"
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearchTerm('');
              setActiveFilter('due');
              setUnitFilter('all');
              setFromDateFilter('');
              setToDateFilter('');
              setCurrentPage(1);
            }}
          >
            Clear filters
          </Button>
        </div>
      </div>

      {/* Re-offer Alert Banner */}
      {reofferCount > 0 && activeFilter !== 'reoffer' && (
        <div className="flex items-center justify-between p-3 rounded-lg bg-warning/10 border border-warning/30">
          <div className="flex items-center gap-2">
            {outbreakLinkedCount > 0 ? (
              <Flame className="w-4 h-4 text-destructive" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-warning" />
            )}
            <span className="text-sm font-medium text-foreground">
              {reofferCount} vaccine{reofferCount !== 1 ? 's' : ''} due for re-offer
              {reofferSummary.highPriority > 0 && (
                <span className="text-destructive"> ({reofferSummary.highPriority} high priority)</span>
              )}
              {outbreakLinkedCount > 0 && (
                <span className="text-destructive font-semibold ml-1">
                  • {outbreakLinkedCount} outbreak-linked
                </span>
              )}
            </span>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setActiveFilter('reoffer')}
          >
            View List
          </Button>
        </div>
      )}

      {/* Re-offer Print Action */}
      {activeFilter === 'reoffer' && reofferCount > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg bg-muted border border-border">
          <div className="text-sm">
            <span className="font-medium">{reofferCount} residents</span> on re-offer list
            {reofferSummary.highPriority > 0 && (
              <span className="ml-2 text-destructive">• {reofferSummary.highPriority} high priority</span>
            )}
            {reofferSummary.mediumPriority > 0 && (
              <span className="ml-2 text-warning">• {reofferSummary.mediumPriority} medium priority</span>
            )}
            {outbreakLinkedCount > 0 && (
              <span className="ml-2 text-destructive font-semibold">
                <Flame className="w-3 h-3 inline mr-1" />
                {outbreakLinkedCount} linked to active outbreak
              </span>
            )}
          </div>
          <div className="flex gap-2">
            {isMobile && (
              <span className="text-xs text-muted-foreground flex items-center">
                ← Swipe rows for quick actions →
              </span>
            )}
            <Button variant="outline" size="sm" onClick={handlePrintReofferList}>
              <Printer className="w-4 h-4 mr-2" />
              Print
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      <SectionCard title={activeFilter === 'reoffer' ? 'Vaccine Re-offer List' : 'Vaccination Records'} noPadding>
        <div className="overflow-x-auto">
          {sortedRecords.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <p>No vaccination records found.</p>
              <p className="text-sm mt-2">Import data or add a new record to get started.</p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <SortableTableHeader label="Resident" sortKey="_name" currentSortKey={sortKey} currentSortDirection={sortDirection} onSort={handleSort} />
                  <SortableTableHeader label="Unit/Room" sortKey="unit" currentSortKey={sortKey} currentSortDirection={sortDirection} onSort={handleSort} />
                  <SortableTableHeader label="Vaccine" sortKey="_vaccine" currentSortKey={sortKey} currentSortDirection={sortDirection} onSort={handleSort} />
                  {activeFilter === 'reoffer' ? (
                    <>
                      <th>Last Dose</th>
                      <th>Days Since Decline</th>
                      <th>Priority</th>
                      <th>Reason</th>
                    </>
                  ) : (
                    <>
                      <SortableTableHeader label="Dose" sortKey="dose" currentSortKey={sortKey} currentSortDirection={sortDirection} onSort={handleSort} />
                      <SortableTableHeader label="Date Given" sortKey="_dateGiven" currentSortKey={sortKey} currentSortDirection={sortDirection} onSort={handleSort} />
                      <SortableTableHeader label="Due Date" sortKey="_dueDate" currentSortKey={sortKey} currentSortDirection={sortDirection} onSort={handleSort} />
                      <SortableTableHeader label="Status" sortKey="status" currentSortKey={sortKey} currentSortDirection={sortDirection} onSort={handleSort} />
                    </>
                  )}
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
              {paginatedRecords.map((record) => {
                  const reofferInfo = activeFilter === 'reoffer' ? getReofferInfo(record) : undefined;
                  
                  const rowContent = (
                    <tr key={record.id}>
                      <td className="font-medium">
                        {record.residentName || record.name || '—'}
                        {record.educationProvided && (
                          <Badge variant="outline" className="ml-2 text-xs">
                            <BookOpen className="w-3 h-3 mr-1" />
                            Educated
                          </Badge>
                        )}
                      </td>
                      <td>{record.unit} / {record.room}</td>
                      <td>
                        <div className="flex items-center gap-1">
                          <span className="badge-status badge-vax">{record.vaccine || record.vaccine_type || '—'}</span>
                          {reofferInfo?.outbreakLinked && (
                            <Tooltip>
                              <TooltipTrigger>
                                <Flame className="w-4 h-4 text-destructive" />
                              </TooltipTrigger>
                              <TooltipContent>
                                Linked to outbreak: {reofferInfo.outbreakName}
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </td>
                      {activeFilter === 'reoffer' && reofferInfo ? (
                        <>
                          <td>
                            {record.dateGiven || record.date_given || record.dose || 'No documented dose'}
                          </td>
                          <td>{reofferInfo.daysSinceDecline} days</td>
                          <td>
                            <Badge 
                              variant={reofferInfo.priority === 'high' ? 'destructive' : 'secondary'}
                              className={reofferInfo.priority === 'medium' ? 'bg-warning text-warning-foreground' : ''}
                            >
                              {reofferInfo.priority.toUpperCase()}
                              {reofferInfo.outbreakLinked && ' 🔥'}
                            </Badge>
                          </td>
                          <td className="text-xs max-w-[200px]">
                            {reofferInfo.reason}
                            {reofferInfo.seasonalContext && (
                              <span className="block text-muted-foreground">{reofferInfo.seasonalContext}</span>
                            )}
                          </td>
                        </>
                      ) : (
                        <>
                          <td>{record.dose || '—'}</td>
                          <td>{record.dateGiven || record.date_given || '—'}</td>
                          <td>{record.dueDate || record.due_date || '—'}</td>
                          <td>{getStatusBadge(record.status)}</td>
                        </>
                      )}
                      <td>
                        <div className="flex items-center gap-1">
                          {activeFilter === 'reoffer' ? (
                            <>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button 
                                    type="button"
                                    className="row-action-btn text-primary" 
                                    title="Provide Education"
                                    onClick={() => handleOpenEducation(record)}
                                  >
                                    <BookOpen className="w-4 h-4" />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent>Provide Education</TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    type="button"
                                    className="row-action-btn text-primary"
                                    title="Re-offer Action"
                                    onClick={() => handleOpenReofferAction(record)}
                                  >
                                    <ClipboardCopy className="w-4 h-4" />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent>Re-offer Action & Note</TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button 
                                    type="button"
                                    className="row-action-btn text-success" 
                                    title="Mark Given"
                                    onClick={() => handleMarkGiven(record)}
                                  >
                                    <Check className="w-4 h-4" />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent>Mark as Given</TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    type="button"
                                    className="row-action-btn text-success"
                                    title="Updated with current Season"
                                    onClick={() => handleMarkCurrentSeason(record)}
                                  >
                                    <CalendarCheck2 className="w-4 h-4" />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent>Updated with current Season</TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button 
                                    type="button"
                                    className="row-action-btn" 
                                    title="Clear Re-offer (set to Due)"
                                    onClick={() => handleClearReoffer(record)}
                                  >
                                    <RotateCcw className="w-4 h-4" />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent>Clear & Set to Due</TooltipContent>
                              </Tooltip>
                              <button 
                                type="button"
                                className="row-action-btn" 
                                title="Edit"
                                onClick={() => { setEditingRecord(record); setShowCaseModal(true); }}
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button 
                                type="button"
                                className="row-action-btn" 
                                title="View"
                                onClick={() => { setEditingRecord(record); setShowCaseModal(true); }}
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              {record.status !== 'given' && (
                                <button 
                                  type="button"
                                  className="row-action-btn" 
                                  title="Mark Given"
                                  onClick={() => handleMarkGiven(record)}
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                              )}
                              {record.status !== 'declined' && record.status !== 'given' && (
                                <button 
                                  type="button"
                                  className="row-action-btn" 
                                  title="Mark Declined"
                                  onClick={() => handleMarkDeclined(record)}
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              )}
                              <button 
                                type="button"
                                className="row-action-btn" 
                                title="Edit"
                                onClick={() => { setEditingRecord(record); setShowCaseModal(true); }}
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button 
                                type="button"
                                className="row-action-btn" 
                                title="Delete"
                                onClick={() => handleDeleteRecord(record)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                  
                  // On mobile re-offer view, use swipeable rows
                  if (isMobile && activeFilter === 'reoffer') {
                    return (
                      <SwipeableVaxRow
                        key={record.id}
                        onMarkGiven={() => handleMarkGiven(record)}
                        onClearReoffer={() => handleClearReoffer(record)}
                        onMarkCurrentSeason={() => handleMarkCurrentSeason(record)}
                        onEdit={() => { setEditingRecord(record); setShowCaseModal(true); }}
                        onEducation={() => handleOpenEducation(record)}
                      >
                        {rowContent}
                      </SwipeableVaxRow>
                    );
                  }
                  
                  return rowContent;
                })}
              </tbody>
            </table>
          )}
        </div>
      </SectionCard>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between p-4 border border-border border-t-0 rounded-b-lg bg-background">
          <span className="text-sm text-muted-foreground">
            Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, filteredRecords.length)} of {filteredRecords.length}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => p - 1)}
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Previous
            </Button>
            <span className="text-sm px-2">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(p => p + 1)}
            >
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>

          </div>
        </div>
      )}

      <VAXImportModal 
        open={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImport={handleDataChange}
      />

      <VAXCaseModal 
        open={showCaseModal}
        onClose={() => { setShowCaseModal(false); setEditingRecord(null); }}
        onSave={() => setDb(loadDB())}
        editRecord={editingRecord}
      />

      <VaxEducationModal
        open={showEducationModal}
        onClose={() => { setShowEducationModal(false); setEditingRecord(null); }}
        record={editingRecord}
        onSave={() => setDb(loadDB())}
      />

      <ReofferActionModal
        open={showReofferActionModal}
        record={editingRecord}
        onClose={() => { setShowReofferActionModal(false); setEditingRecord(null); }}
        onSubmit={(values) => {
          if (editingRecord) {
            void handleSaveReofferAction(editingRecord, values);
          }
        }}
      />
    </div>
  );
};

export default VAXView;
