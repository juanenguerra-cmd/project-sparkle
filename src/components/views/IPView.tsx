import { useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCw, Download, Search, Eye, Edit, Trash2, AlertTriangle, Upload, UserX, ArrowUpDown, ArrowUp, ArrowDown, Filter, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import SectionCard from '@/components/dashboard/SectionCard';
import TrackerSummary from '@/components/dashboard/TrackerSummary';
import { loadDB, getActiveIPCases, saveDB, addAudit, normalizeIPStatus } from '@/lib/database';
import { IPCase, ViewType } from '@/lib/types';
import IPCaseModal from '@/components/modals/IPCaseModal';
import { useToast } from '@/hooks/use-toast';
import { isoDateFromAny, mrnMatchKeys, todayISO } from '@/lib/parsers';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import TablePagination from '@/components/ui/table-pagination';

type IPFilter = 'all' | 'active' | 'ebp' | 'isolation' | 'standard' | 'resolved';
type SortField = 'name' | 'room' | 'onset' | 'review' | 'protocol' | 'status';
type SortDir = 'asc' | 'desc';

// Helper to escape CSV values
const escapeCSV = (val: string | number | boolean | null | undefined): string => {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

interface IPViewProps {
  onNavigate?: (view: ViewType) => void;
  initialStatusFilter?: 'active' | 'resolved';
}

const IPView = ({ onNavigate, initialStatusFilter }: IPViewProps) => {
  const { toast } = useToast();
  const [db, setDb] = useState(() => loadDB());
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<IPFilter>('active');
  const [unitFilter, setUnitFilter] = useState('all');
  const [protocolFilter, setProtocolFilter] = useState('all');
  const [showCaseModal, setShowCaseModal] = useState(false);
  const [editingCase, setEditingCase] = useState<IPCase | null>(null);
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [fromDateFilter, setFromDateFilter] = useState('');
  const [toDateFilter, setToDateFilter] = useState('');

  useEffect(() => {
    if (initialStatusFilter) {
      setActiveFilter(initialStatusFilter === 'resolved' ? 'resolved' : 'active');
    }
  }, [initialStatusFilter]);

  const normalizeStatus = (record: IPCase) => normalizeIPStatus(record.status || record.case_status);
  const normalizeProtocol = (protocol?: string) => {
    const normalized = (protocol || '').trim().toLowerCase();
    if (!normalized) return '';
    if (normalized.includes('ebp') || normalized.includes('edp') || normalized.includes('enhanced barrier')) return 'ebp';
    if (normalized.includes('standard')) return 'standard';
    if (normalized.includes('isolation')) return 'isolation';
    return normalized;
  };
  
  const records = db.records.ip_cases;
  const units = useMemo(
    () => [...new Set(records.map(r => r.unit).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [records],
  );

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

  // Filter and sort records
  const filteredRecords = useMemo(() => {
    let filtered = records.filter(r => {
      const name = r.residentName || r.name || '';
      const infectionType = r.infectionType || r.infection_type || '';
      const normalizedSearch = searchTerm.trim().toLowerCase();
      const matchesSearch = normalizedSearch.length === 0
        || name.toLowerCase().includes(normalizedSearch)
        || infectionType.toLowerCase().includes(normalizedSearch)
        || r.protocol.toLowerCase().includes(normalizedSearch)
        || (r.unit || '').toLowerCase().includes(normalizedSearch)
        || (r.room || '').toLowerCase().includes(normalizedSearch);
      
      if (!matchesSearch) return false;

      if (unitFilter !== 'all' && r.unit !== unitFilter) return false;
      if (protocolFilter !== 'all' && normalizeProtocol(r.protocol) !== protocolFilter) return false;

      if (fromDateFilter || toDateFilter) {
        const startDate = isoDateFromAny(r.onsetDate || r.onset_date || '');
        if (!startDate) return false;
        if (fromDateFilter && startDate < fromDateFilter) return false;
        if (toDateFilter && startDate > toDateFilter) return false;
      }
      
      // Normalize status for case-insensitive comparison
      const status = normalizeStatus(r);
      
      // For active views, exclude discharged residents from census
      if (activeFilter === 'active' || activeFilter === 'ebp' || activeFilter === 'isolation' || activeFilter === 'standard') {
        // Exclude Discharged/Resolved status (case-insensitive)
        if (status === 'discharged' || status === 'resolved') return false;
        // Exclude residents no longer on census
        if (!isActiveCensusMrn(r.mrn)) return false;
      }
      
      switch (activeFilter) {
        case 'active':
          return status === 'active';
        case 'ebp':
          return normalizeProtocol(r.protocol) === 'ebp' && status === 'active';
        case 'isolation':
          return normalizeProtocol(r.protocol) === 'isolation' && status === 'active';
        case 'standard':
          return normalizeProtocol(r.protocol) === 'standard' && status === 'active';
        case 'resolved':
          return status === 'resolved' || status === 'discharged';
        default:
          return true;
      }
    });
    
    // Sort records
    filtered.sort((a, b) => {
      let valA = '';
      let valB = '';
      
      switch (sortField) {
        case 'name':
          valA = (a.residentName || a.name || '').toLowerCase();
          valB = (b.residentName || b.name || '').toLowerCase();
          break;
        case 'room':
          valA = a.room || '';
          valB = b.room || '';
          break;
        case 'onset':
          valA = a.onsetDate || a.onset_date || '';
          valB = b.onsetDate || b.onset_date || '';
          break;
        case 'review':
          valA = a.nextReviewDate || a.next_review_date || '';
          valB = b.nextReviewDate || b.next_review_date || '';
          break;
        case 'protocol':
          valA = a.protocol;
          valB = b.protocol;
          break;
        case 'status': {
          const statusOrder: Record<string, number> = { active: 0, resolved: 1, discharged: 2 };
          const statusA = normalizeStatus(a);
          const statusB = normalizeStatus(b);
          const orderA = statusOrder[statusA] ?? 99;
          const orderB = statusOrder[statusB] ?? 99;
          const diff = orderA - orderB;
          if (diff !== 0) return sortDir === 'asc' ? diff : -diff;
          valA = statusA;
          valB = statusB;
          break;
        }
      }
      
      const cmp = valA.localeCompare(valB, undefined, { numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });
    
    return filtered;
  }, [records, searchTerm, activeFilter, activeCensusMrns, sortField, sortDir, unitFilter, protocolFilter, fromDateFilter, toDateFilter]);

  const pageSize = 20;
  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const pagedRecords = filteredRecords.slice(startIndex, startIndex + pageSize);
  const rangeStart = filteredRecords.length === 0 ? 0 : startIndex + 1;
  const rangeEnd = Math.min(startIndex + pageSize, filteredRecords.length);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, activeFilter, unitFilter, protocolFilter, fromDateFilter, toDateFilter]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const handlePrintFiltered = () => {
    const printContent = `
      <html>
        <head>
          <title>IP Tracker - Filtered Results</title>
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
          <h1>IP Tracker - Filtered Results</h1>
          <p>Status: ${activeFilter} • Unit: ${unitFilter === 'all' ? 'All units' : unitFilter} • Protocol: ${protocolFilter}</p>
          <p>Date range: ${fromDateFilter || 'Any'} to ${toDateFilter || 'Any'} • ${filteredRecords.length} record(s)</p>
          <table>
            <thead><tr><th>Resident</th><th>Unit/Room</th><th>Infection Type</th><th>Protocol</th><th>Onset</th><th>Next Review</th><th>Status</th></tr></thead>
            <tbody>
              ${filteredRecords.map(r => `<tr>
                <td>${r.residentName || r.name || '—'}</td>
                <td>${r.unit} / ${r.room}</td>
                <td>${r.infectionType || r.infection_type || '—'}</td>
                <td>${r.protocol || '—'}</td>
                <td>${r.onsetDate || r.onset_date || '—'}</td>
                <td>${r.nextReviewDate || r.next_review_date || '—'}</td>
                <td>${normalizeStatus(r) || '—'}</td>
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

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-30" />;
    return sortDir === 'asc' 
      ? <ArrowUp className="w-3 h-3 ml-1" />
      : <ArrowDown className="w-3 h-3 ml-1" />;
  };

  // Accurate active count - exclude discharged census residents (case-insensitive)
  const activeCount = records.filter(r => {
    const status = normalizeStatus(r);
    if (status !== 'active') return false;
    if (!isActiveCensusMrn(r.mrn)) return false;
    return true;
  }).length;
  
  const overdueCount = records.filter(r => {
    const status = normalizeStatus(r);
    if (status !== 'active') return false;
    if (!isActiveCensusMrn(r.mrn)) return false;
    const reviewDate = r.nextReviewDate || r.next_review_date;
    return reviewDate && new Date(reviewDate) < new Date();
  }).length;
  
  const ebpCount = records.filter(r => {
    const status = normalizeStatus(r);
    if (normalizeProtocol(r.protocol) !== 'ebp' || status !== 'active') return false;
    if (!isActiveCensusMrn(r.mrn)) return false;
    return true;
  }).length;
  
  const isolationCount = records.filter(r => {
    const status = normalizeStatus(r);
    if (normalizeProtocol(r.protocol) !== 'isolation' || status !== 'active') return false;
    if (!isActiveCensusMrn(r.mrn)) return false;
    return true;
  }).length;
  
  const standardCount = records.filter(r => {
    const status = normalizeStatus(r);
    if (normalizeProtocol(r.protocol) !== 'standard' || status !== 'active') return false;
    if (!isActiveCensusMrn(r.mrn)) return false;
    return true;
  }).length;
  
  const resolvedCount = records.filter(r => {
    const status = normalizeStatus(r);
    return status === 'resolved' || status === 'discharged';
  }).length;

  const handleRefresh = () => {
    setDb(loadDB());
  };

  const handleDataChange = () => {
    setDb(loadDB());
  };

  const handleDeleteCase = (record: IPCase) => {
    if (!window.confirm(`Delete IP case for ${record.residentName || record.name}?`)) return;
    
    const currentDb = loadDB();
    const idx = currentDb.records.ip_cases.findIndex(c => c.id === record.id);
    if (idx >= 0) {
      currentDb.records.ip_cases.splice(idx, 1);
      addAudit(currentDb, 'ip_delete', `Deleted IP case for ${record.residentName || record.name}`, 'ip');
      saveDB(currentDb);
      setDb(currentDb);
      toast({ title: 'IP Case Deleted' });
    }
  };

  const handleDischargeCase = (record: IPCase) => {
    if (!window.confirm(`Mark ${record.residentName || record.name} as discharged? This will close the IP case.`)) return;
    
    const today = todayISO();
    const currentDb = loadDB();
    const idx = currentDb.records.ip_cases.findIndex(c => c.id === record.id);
    if (idx >= 0) {
      currentDb.records.ip_cases[idx].status = 'Discharged';
      currentDb.records.ip_cases[idx].resolutionDate = today;
      currentDb.records.ip_cases[idx].resolution_date = today;
      currentDb.records.ip_cases[idx]._autoClosed = false;
      currentDb.records.ip_cases[idx]._autoClosedReason = 'Manual discharge';
      currentDb.records.ip_cases[idx].notes = `${currentDb.records.ip_cases[idx].notes || ''} [Manual discharge: ${today}]`.trim();
      addAudit(currentDb, 'ip_discharge', `Manually discharged IP case for ${record.residentName || record.name}`, 'ip');
      saveDB(currentDb);
      setDb(currentDb);
      toast({ title: 'IP Case Discharged', description: `${record.residentName || record.name} marked as discharged` });
    }
  };

  const handleExport = () => {
    const headers = [
      'ID', 'MRN', 'Resident Name', 'Unit', 'Room', 'Infection Type', 'Protocol',
      'Isolation Type', 'Source of Infection', 'Onset Date', 'Resolution Date',
      'Status', 'Next Review Date', 'Last Review Date', 'Review Notes',
      'Trigger Reason', 'High Contact Care', 'Signage Posted', 'Supplies Stocked',
      'Room Check Date', 'Exposure Linked', 'Outbreak ID', 'Required PPE',
      'Auto Closed', 'Auto Closed Reason', 'Notes', 'Created At'
    ];
    
    const rows = records.map(r => [
      escapeCSV(r.id),
      escapeCSV(r.mrn),
      escapeCSV(r.residentName || r.name),
      escapeCSV(r.unit),
      escapeCSV(r.room),
      escapeCSV(r.infectionType || r.infection_type),
      escapeCSV(r.protocol),
      escapeCSV(r.isolationType || r.isolation_type),
      escapeCSV(r.sourceOfInfection || r.source_of_infection),
      escapeCSV(r.onsetDate || r.onset_date),
      escapeCSV(r.resolutionDate || r.resolution_date),
      escapeCSV(r.status),
      escapeCSV(r.nextReviewDate || r.next_review_date),
      escapeCSV(r.lastReviewDate),
      escapeCSV(r.reviewNotes),
      escapeCSV(r.triggerReason),
      escapeCSV(r.highContactCare?.join('; ')),
      escapeCSV(r.signagePosted),
      escapeCSV(r.suppliesStocked),
      escapeCSV(r.roomCheckDate),
      escapeCSV(r.exposureLinked),
      escapeCSV(r.outbreakId),
      escapeCSV(r.requiredPPE),
      escapeCSV(r._autoClosed),
      escapeCSV(r._autoClosedReason),
      escapeCSV(r.notes),
      escapeCSV(r.createdAt)
    ].join(','));
    
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ip_cases_${todayISO()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };


  const downloadIpSubsetReport = (reportType: 'pathogen' | 'source', reportValue: string) => {
    const headers = ['Resident Name', 'MRN', 'Unit', 'Room', 'Protocol', 'Status', 'Onset Date', 'Resolution Date'];
    const normalizeValues = (value: string) => value.split(',').map((part) => part.trim().toLowerCase()).filter(Boolean);
    const rows = records
      .filter((record) => {
        const fieldValue = reportType === 'pathogen'
          ? (record.infectionType || record.infection_type || '')
          : (record.sourceOfInfection || record.source_of_infection || '');
        return normalizeValues(fieldValue).includes(reportValue.toLowerCase());
      })
      .map((record) => [
        escapeCSV(record.residentName || record.name),
        escapeCSV(record.mrn),
        escapeCSV(record.unit),
        escapeCSV(record.room),
        escapeCSV(record.protocol),
        escapeCSV(record.status),
        escapeCSV(record.onsetDate || record.onset_date),
        escapeCSV(record.resolutionDate || record.resolution_date),
      ].join(','));

    if (rows.length === 0) {
      toast({ title: 'No matching cases', description: `No IP cases found for ${reportValue}.` });
      return;
    }

    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ip_${reportType}_${reportValue.replace(/\s+/g, '_').toLowerCase()}_${todayISO()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const topPathogens = useMemo(() => {
    const map: Record<string, number> = {};
    records.forEach((record) => {
      const values = (record.infectionType || record.infection_type || '')
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean);
      values.forEach((value) => {
        map[value] = (map[value] || 0) + 1;
      });
    });
    return Object.entries(map).sort(([, a], [, b]) => b - a).slice(0, 6);
  }, [records]);

  const topSources = useMemo(() => {
    const map: Record<string, number> = {};
    records.forEach((record) => {
      const values = (record.sourceOfInfection || record.source_of_infection || '')
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean);
      values.forEach((value) => {
        map[value] = (map[value] || 0) + 1;
      });
    });
    return Object.entries(map).sort(([, a], [, b]) => b - a).slice(0, 6);
  }, [records]);

  const getStatusBadge = (status: string) => {
    const normalizedStatus = normalizeIPStatus(status);
    switch (normalizedStatus) {
      case 'active':
        return <span className="badge-status badge-warn">Active</span>;
      case 'resolved':
        return <span className="badge-status badge-ok">Resolved</span>;
      case 'discharged':
        return <span className="badge-status badge-muted">Discharged</span>;
      default:
        return <span className="badge-status badge-muted">{status}</span>;
    }
  };

  const getProtocolBadge = (protocol: string) => {
    switch (protocol) {
      case 'EBP':
        return <span className="badge-status badge-info">EBP</span>;
      case 'Isolation':
        return <span className="badge-status badge-ip">Isolation</span>;
      default:
        return <span className="badge-status badge-muted">{protocol}</span>;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">IP Tracker</h2>
          <p className="text-sm text-muted-foreground">
            Infection Prevention & Isolation Precautions
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
          <Button size="sm" onClick={() => { setEditingCase(null); setShowCaseModal(true); }}>
            <Plus className="w-4 h-4 mr-2" />
            Add IP Case
          </Button>
        </div>
      </div>

      {/* Trend Summary */}
      <TrackerSummary type="ip" />

      <SectionCard title="IP Reports by Type">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-semibold text-muted-foreground">Pathogen / Resistance</p>
            <div className="flex flex-wrap gap-2">
              {topPathogens.length === 0 ? (
                <span className="text-xs text-muted-foreground">No pathogen tags yet.</span>
              ) : (
                topPathogens.map(([value, count]) => (
                  <Button key={value} size="sm" variant="outline" onClick={() => downloadIpSubsetReport('pathogen', value)}>
                    {value} ({count})
                  </Button>
                ))
              )}
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold text-muted-foreground">Source Condition</p>
            <div className="flex flex-wrap gap-2">
              {topSources.length === 0 ? (
                <span className="text-xs text-muted-foreground">No source tags yet.</span>
              ) : (
                topSources.map(([value, count]) => (
                  <Button key={value} size="sm" variant="outline" onClick={() => downloadIpSubsetReport('source', value)}>
                    {value} ({count})
                  </Button>
                ))
              )}
            </div>
          </div>
        </div>
      </SectionCard>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="stat-card text-center">
          <div className="text-2xl font-bold text-warning">{activeCount}</div>
          <div className="text-sm text-muted-foreground">Active Cases</div>
        </div>
        <div className="stat-card text-center">
          <div className="text-2xl font-bold text-destructive">{overdueCount}</div>
          <div className="text-sm text-muted-foreground">Overdue Reviews</div>
        </div>
        <div className="stat-card text-center">
          <div className="text-2xl font-bold text-info">{ebpCount}</div>
          <div className="text-sm text-muted-foreground">EBP Cases</div>
        </div>
        <div className="stat-card text-center">
          <div className="text-2xl font-bold text-success">{resolvedCount}</div>
          <div className="text-sm text-muted-foreground">Resolved</div>
        </div>
      </div>

      {/* Alert */}
      {overdueCount > 0 && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0" />
          <div>
            <p className="font-medium text-destructive">Reviews Overdue</p>
            <p className="text-sm text-muted-foreground">{overdueCount} case(s) require immediate review</p>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="filter-panel">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Search by name, infection type, or protocol..." 
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={unitFilter} onValueChange={setUnitFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Unit" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All units</SelectItem>
                {units.map(unit => (
                  <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={protocolFilter} onValueChange={setProtocolFilter}>
              <SelectTrigger className="w-[170px]">
                <SelectValue placeholder="Protocol" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All protocols</SelectItem>
                <SelectItem value="ebp">EBP</SelectItem>
                <SelectItem value="isolation">Isolation</SelectItem>
                <SelectItem value="standard">Standard</SelectItem>
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
            <Badge 
              variant={activeFilter === 'all' ? 'default' : 'outline'} 
              className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
              onClick={() => setActiveFilter('all')}
            >
              All ({records.length})
            </Badge>
            <Badge 
              variant={activeFilter === 'active' ? 'default' : 'outline'} 
              className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
              onClick={() => setActiveFilter('active')}
            >
              Active ({activeCount})
            </Badge>
            <Badge 
              variant={activeFilter === 'ebp' ? 'default' : 'outline'} 
              className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
              onClick={() => setActiveFilter('ebp')}
            >
              EBP ({ebpCount})
            </Badge>
            <Badge 
              variant={activeFilter === 'isolation' ? 'default' : 'outline'} 
              className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
              onClick={() => setActiveFilter('isolation')}
            >
              Isolation ({isolationCount})
            </Badge>
            <Badge 
              variant={activeFilter === 'standard' ? 'default' : 'outline'} 
              className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
              onClick={() => setActiveFilter('standard')}
            >
              Standard ({standardCount})
            </Badge>
            <Badge 
              variant={activeFilter === 'resolved' ? 'default' : 'outline'} 
              className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
              onClick={() => setActiveFilter('resolved')}
            >
              Resolved ({resolvedCount})
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchTerm('');
                setActiveFilter('active');
                setUnitFilter('all');
                setProtocolFilter('all');
                setFromDateFilter('');
                setToDateFilter('');
              }}
            >
              Clear filters
            </Button>
          </div>
        </div>
      </div>

      {/* Table */}
      <SectionCard title="IP Cases" noPadding>
        <div className="overflow-x-auto">
          {filteredRecords.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <p>No IP cases found.</p>
              <p className="text-sm mt-2">Import data or add a new case to get started.</p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th className="cursor-pointer select-none" onClick={() => handleSort('name')}>
                    <span className="flex items-center">Resident <SortIcon field="name" /></span>
                  </th>
                  <th className="cursor-pointer select-none" onClick={() => handleSort('room')}>
                    <span className="flex items-center">Unit/Room <SortIcon field="room" /></span>
                  </th>
                  <th>Infection Type</th>
                  <th className="cursor-pointer select-none" onClick={() => handleSort('protocol')}>
                    <span className="flex items-center">Protocol <SortIcon field="protocol" /></span>
                  </th>
                  <th>Source</th>
                  <th className="cursor-pointer select-none" onClick={() => handleSort('onset')}>
                    <span className="flex items-center">Onset <SortIcon field="onset" /></span>
                  </th>
                  <th className="cursor-pointer select-none" onClick={() => handleSort('review')}>
                    <span className="flex items-center">Next Review <SortIcon field="review" /></span>
                  </th>
                  <th className="cursor-pointer select-none" onClick={() => handleSort('status')}>
                    <span className="flex items-center">Status <SortIcon field="status" /></span>
                  </th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pagedRecords.map((record) => {
                  const reviewDate = record.nextReviewDate || record.next_review_date;
                  const isOverdue = reviewDate && new Date(reviewDate) < new Date();
                  
                  return (
                    <tr key={record.id}>
                      <td className="font-medium">{record.residentName || record.name || '—'}</td>
                      <td>{record.unit} / {record.room}</td>
                      <td className="font-semibold">{record.infectionType || record.infection_type || '—'}</td>
                      <td>{getProtocolBadge(record.protocol)}</td>
                      <td>{record.sourceOfInfection || record.source_of_infection || '—'}</td>
                      <td>{record.onsetDate || record.onset_date || '—'}</td>
                      <td>
                        {isOverdue ? (
                          <span className="mini-indicator overdue">{reviewDate}</span>
                        ) : (
                          reviewDate || '—'
                        )}
                      </td>
                      <td>{getStatusBadge(record.status || record.case_status || '—')}</td>
                      <td>
                        <div className="flex items-center gap-1">
                          <button 
                            type="button"
                            className="row-action-btn" 
                            title="View"
                            onClick={() => { setEditingCase(record); setShowCaseModal(true); }}
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button 
                            type="button"
                            className="row-action-btn" 
                            title="Edit"
                            onClick={() => { setEditingCase(record); setShowCaseModal(true); }}
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button 
                            type="button"
                            className="row-action-btn" 
                            title="Delete"
                            onClick={() => handleDeleteCase(record)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          {normalizeStatus(record) === 'active' && (
                            <button 
                              type="button"
                              className="row-action-btn text-warning hover:text-warning" 
                              title="Discharge"
                              onClick={() => handleDischargeCase(record)}
                            >
                              <UserX className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        <TablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          totalItems={filteredRecords.length}
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
          itemLabel="cases"
        />
      </SectionCard>

      <IPCaseModal 
        open={showCaseModal}
        onClose={() => { setShowCaseModal(false); setEditingCase(null); }}
        onSave={handleDataChange}
        editCase={editingCase}
      />

      {onNavigate && (
        <SectionCard title="Next Steps">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => onNavigate('notes')}>
              Add Notes
            </Button>
            <Button size="sm" variant="outline" onClick={() => onNavigate('abt')}>
              Review ABT
            </Button>
            <Button size="sm" variant="outline" onClick={() => onNavigate('reports')}>
              Generate Report
            </Button>
          </div>
        </SectionCard>
      )}
    </div>
  );
};

export default IPView;
