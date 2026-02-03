import { useState, useMemo } from 'react';
import { Plus, RefreshCw, Download, Search, Eye, Edit, Trash2, AlertTriangle, Upload, UserX, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import SectionCard from '@/components/dashboard/SectionCard';
import TrackerSummary from '@/components/dashboard/TrackerSummary';
import { loadDB, getActiveIPCases, saveDB, addAudit } from '@/lib/database';
import { IPCase, ViewType } from '@/lib/types';
import IPCaseModal from '@/components/modals/IPCaseModal';
import { useToast } from '@/hooks/use-toast';
import { todayISO } from '@/lib/parsers';

type IPFilter = 'all' | 'active' | 'ebp' | 'isolation' | 'standard' | 'resolved';
type SortField = 'name' | 'room' | 'onset' | 'review' | 'protocol';
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
}

const IPView = ({ onNavigate }: IPViewProps) => {
  const { toast } = useToast();
  const [db, setDb] = useState(() => loadDB());
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<IPFilter>('active');
  const [showCaseModal, setShowCaseModal] = useState(false);
  const [editingCase, setEditingCase] = useState<IPCase | null>(null);
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  
  const records = db.records.ip_cases;

  // Get active resident MRNs from census
  const activeCensusMrns = new Set(
    Object.values(db.census.residentsByMrn)
      .filter(r => r.active_on_census)
      .map(r => r.mrn)
  );

  // Filter and sort records
  const filteredRecords = useMemo(() => {
    let filtered = records.filter(r => {
      const name = r.residentName || r.name || '';
      const infectionType = r.infectionType || r.infection_type || '';
      const matchesSearch = name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        infectionType.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.protocol.toLowerCase().includes(searchTerm.toLowerCase());
      
      if (!matchesSearch) return false;
      
      // Normalize status for case-insensitive comparison
      const status = (r.status || '').toLowerCase();
      
      // For active views, exclude discharged residents from census
      if (activeFilter === 'active' || activeFilter === 'ebp' || activeFilter === 'isolation' || activeFilter === 'standard') {
        // Exclude Discharged/Resolved status (case-insensitive)
        if (status === 'discharged' || status === 'resolved') return false;
        // Exclude residents no longer on census
        if (r.mrn && !activeCensusMrns.has(r.mrn)) return false;
      }
      
      switch (activeFilter) {
        case 'active':
          return status === 'active';
        case 'ebp':
          return r.protocol === 'EBP' && status === 'active';
        case 'isolation':
          return r.protocol === 'Isolation' && status === 'active';
        case 'standard':
          return r.protocol === 'Standard Precautions' && status === 'active';
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
      }
      
      const cmp = valA.localeCompare(valB, undefined, { numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });
    
    return filtered;
  }, [records, searchTerm, activeFilter, activeCensusMrns, sortField, sortDir]);

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
    const status = (r.status || '').toLowerCase();
    if (status !== 'active') return false;
    if (r.mrn && !activeCensusMrns.has(r.mrn)) return false;
    return true;
  }).length;
  
  const overdueCount = records.filter(r => {
    const status = (r.status || '').toLowerCase();
    if (status !== 'active') return false;
    if (r.mrn && !activeCensusMrns.has(r.mrn)) return false;
    const reviewDate = r.nextReviewDate || r.next_review_date;
    return reviewDate && new Date(reviewDate) < new Date();
  }).length;
  
  const ebpCount = records.filter(r => {
    const status = (r.status || '').toLowerCase();
    if (r.protocol !== 'EBP' || status !== 'active') return false;
    if (r.mrn && !activeCensusMrns.has(r.mrn)) return false;
    return true;
  }).length;
  
  const isolationCount = records.filter(r => {
    const status = (r.status || '').toLowerCase();
    if (r.protocol !== 'Isolation' || status !== 'active') return false;
    if (r.mrn && !activeCensusMrns.has(r.mrn)) return false;
    return true;
  }).length;
  
  const standardCount = records.filter(r => {
    const status = (r.status || '').toLowerCase();
    if (r.protocol !== 'Standard Precautions' || status !== 'active') return false;
    if (r.mrn && !activeCensusMrns.has(r.mrn)) return false;
    return true;
  }).length;
  
  const resolvedCount = records.filter(r => {
    const status = (r.status || '').toLowerCase();
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

  const getStatusBadge = (status: string) => {
    const normalizedStatus = (status || '').toLowerCase();
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
          <Button size="sm" onClick={() => { setEditingCase(null); setShowCaseModal(true); }}>
            <Plus className="w-4 h-4 mr-2" />
            Add IP Case
          </Button>
        </div>
      </div>

      {/* Trend Summary */}
      <TrackerSummary type="ip" />

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
          <div className="flex gap-2 flex-wrap">
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
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((record) => {
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
                      <td>{getStatusBadge(record.status)}</td>
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
                          {(record.status || '').toLowerCase() === 'active' && (
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
