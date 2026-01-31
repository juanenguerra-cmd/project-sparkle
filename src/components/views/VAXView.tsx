import { useState, useMemo } from 'react';
import { Plus, RefreshCw, Download, Search, Eye, Edit, Check, X, Upload, Trash2, RotateCcw, Printer, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import SectionCard from '@/components/dashboard/SectionCard';
import TrackerSummary from '@/components/dashboard/TrackerSummary';
import { loadDB, getVaxDue, saveDB, addAudit } from '@/lib/database';
import { VaxRecord } from '@/lib/types';
import VAXImportModal from '@/components/modals/VAXImportModal';
import VAXCaseModal from '@/components/modals/VAXCaseModal';
import { useToast } from '@/hooks/use-toast';
import { getReofferCandidates, ReofferCandidate, getReofferSummary } from '@/lib/vaccineReofferLogic';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

type VAXFilter = 'all' | 'due' | 'overdue' | 'given' | 'declined' | 'reoffer';

const VAXView = () => {
  const { toast } = useToast();
  const [db, setDb] = useState(() => loadDB());
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<VAXFilter>('due');
  const [showImportModal, setShowImportModal] = useState(false);
  const [showCaseModal, setShowCaseModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<VaxRecord | null>(null);
  
  const records = db.records.vax;

  // Get active resident MRNs from census
  const activeCensusMrns = new Set(
    Object.values(db.census.residentsByMrn)
      .filter(r => r.active_on_census)
      .map(r => r.mrn)
  );

  const dueRecords = getVaxDue(db);
  
  // CDC-based re-offer candidates (must be defined before use in filtering)
  const reofferCandidates = useMemo(() => 
    getReofferCandidates(records, activeCensusMrns), 
    [records, activeCensusMrns]
  );
  const reofferSummary = useMemo(() => 
    getReofferSummary(reofferCandidates), 
    [reofferCandidates]
  );
  const reofferMrnSet = useMemo(() => 
    new Set(reofferCandidates.map(c => `${c.record.mrn}_${c.record.vaccine || c.record.vaccine_type}`)), 
    [reofferCandidates]
  );

  const filteredRecords = activeFilter === 'reoffer' 
    ? reofferCandidates.map(c => c.record).filter(r => {
        const name = r.residentName || r.name || '';
        const vaccine = r.vaccine || r.vaccine_type || '';
        return name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          vaccine.toLowerCase().includes(searchTerm.toLowerCase());
      })
    : records.filter(r => {
        const name = r.residentName || r.name || '';
        const vaccine = r.vaccine || r.vaccine_type || '';
        const matchesSearch = name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          vaccine.toLowerCase().includes(searchTerm.toLowerCase());
        
        if (!matchesSearch) return false;
        
        // For due/overdue views, exclude discharged residents from census
        if (activeFilter === 'due' || activeFilter === 'overdue') {
          if (r.mrn && !activeCensusMrns.has(r.mrn)) return false;
        }
        
        switch (activeFilter) {
          case 'due':
            return r.status === 'due';
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
  
  // Helper to get reoffer info for a record
  const getReofferInfo = (record: VaxRecord): ReofferCandidate | undefined => {
    return reofferCandidates.find(c => c.record.id === record.id);
  };
  
  // Accurate counts - exclude discharged census residents for due/overdue
  const givenCount = records.filter(r => r.status === 'given').length;
  const dueCount = records.filter(r => {
    if (r.status !== 'due') return false;
    if (r.mrn && !activeCensusMrns.has(r.mrn)) return false;
    return true;
  }).length;
  const declinedCount = records.filter(r => r.status === 'declined').length;
  const overdueCount = records.filter(r => {
    if (r.status !== 'overdue') return false;
    if (r.mrn && !activeCensusMrns.has(r.mrn)) return false;
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
    const csvRows = [
      ['Resident', 'MRN', 'Unit', 'Room', 'Vaccine', 'Dose', 'Date Given', 'Due Date', 'Status'].join(','),
      ...records.map(r => [
        `"${r.residentName || r.name || ''}"`,
        r.mrn,
        r.unit,
        r.room,
        r.vaccine || r.vaccine_type || '',
        r.dose || '',
        r.dateGiven || r.date_given || '',
        r.dueDate || r.due_date || '',
        r.status
      ].join(','))
    ];
    
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vax_records_${new Date().toISOString().slice(0, 10)}.csv`;
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

  const handleClearReoffer = (record: VaxRecord) => {
    // Create a new 'due' record to clear the declined status
    const updatedDb = loadDB();
    const idx = updatedDb.records.vax.findIndex(r => r.id === record.id);
    if (idx !== -1) {
      updatedDb.records.vax[idx].status = 'due';
      updatedDb.records.vax[idx].dueDate = new Date().toISOString().slice(0, 10);
      addAudit(updatedDb, 'vax_reoffer_cleared', `Cleared re-offer for ${record.vaccine} - ${record.residentName || record.name}`, 'vax');
      saveDB(updatedDb);
      setDb(updatedDb);
      toast({ title: 'Re-offer Cleared', description: 'Status changed to Due' });
    }
  };

  const handleMarkGiven = (record: VaxRecord) => {
    const updatedDb = loadDB();
    const idx = updatedDb.records.vax.findIndex(r => r.id === record.id);
    if (idx !== -1) {
      updatedDb.records.vax[idx].status = 'given';
      updatedDb.records.vax[idx].dateGiven = new Date().toISOString().slice(0, 10);
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'given':
        return <span className="badge-status badge-ok">Given</span>;
      case 'due':
        return <span className="badge-status badge-info">Due</span>;
      case 'overdue':
        return <span className="badge-status badge-bad">Overdue</span>;
      case 'declined':
        return <span className="badge-status badge-muted">Declined</span>;
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
              onClick={() => setActiveFilter('all')}
            >
              All ({records.length})
            </Badge>
            <Badge 
              variant={activeFilter === 'due' ? 'default' : 'outline'} 
              className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
              onClick={() => setActiveFilter('due')}
            >
              Due ({dueCount})
            </Badge>
            <Badge 
              variant={activeFilter === 'overdue' ? 'default' : 'outline'} 
              className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
              onClick={() => setActiveFilter('overdue')}
            >
              Overdue ({overdueCount})
            </Badge>
            <Badge 
              variant={activeFilter === 'given' ? 'default' : 'outline'} 
              className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
              onClick={() => setActiveFilter('given')}
            >
              Given ({givenCount})
            </Badge>
            <Badge 
              variant={activeFilter === 'declined' ? 'default' : 'outline'} 
              className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
              onClick={() => setActiveFilter('declined')}
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
                  onClick={() => setActiveFilter('reoffer')}
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
        </div>
      </div>

      {/* Re-offer Alert Banner */}
      {reofferCount > 0 && activeFilter !== 'reoffer' && (
        <div className="flex items-center justify-between p-3 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-950/20 dark:border-amber-800">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span className="text-sm font-medium text-amber-800 dark:text-amber-200">
              {reofferCount} vaccine{reofferCount !== 1 ? 's' : ''} due for re-offer
              {reofferSummary.highPriority > 0 && (
                <span className="text-amber-600"> ({reofferSummary.highPriority} high priority)</span>
              )}
            </span>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            className="border-amber-500 text-amber-700 hover:bg-amber-100"
            onClick={() => setActiveFilter('reoffer')}
          >
            View List
          </Button>
        </div>
      )}

      {/* Re-offer Print Action */}
      {activeFilter === 'reoffer' && reofferCount > 0 && (
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted border border-border">
          <div className="text-sm">
            <span className="font-medium">{reofferCount} residents</span> on re-offer list
            {reofferSummary.highPriority > 0 && (
              <span className="ml-2 text-destructive">• {reofferSummary.highPriority} high priority</span>
            )}
            {reofferSummary.mediumPriority > 0 && (
              <span className="ml-2 text-amber-600">• {reofferSummary.mediumPriority} medium priority</span>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={handlePrintReofferList}>
            <Printer className="w-4 h-4 mr-2" />
            Print Re-offer List
          </Button>
        </div>
      )}

      {/* Table */}
      <SectionCard title={activeFilter === 'reoffer' ? 'Vaccine Re-offer List' : 'Vaccination Records'} noPadding>
        <div className="overflow-x-auto">
          {filteredRecords.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <p>No vaccination records found.</p>
              <p className="text-sm mt-2">Import data or add a new record to get started.</p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Resident</th>
                  <th>Unit/Room</th>
                  <th>Vaccine</th>
                  {activeFilter === 'reoffer' ? (
                    <>
                      <th>Days Since Decline</th>
                      <th>Priority</th>
                      <th>Reason</th>
                    </>
                  ) : (
                    <>
                      <th>Dose</th>
                      <th>Date Given</th>
                      <th>Due Date</th>
                      <th>Status</th>
                    </>
                  )}
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((record) => {
                  const reofferInfo = activeFilter === 'reoffer' ? getReofferInfo(record) : undefined;
                  return (
                    <tr key={record.id}>
                      <td className="font-medium">{record.residentName || record.name || '—'}</td>
                      <td>{record.unit} / {record.room}</td>
                      <td>
                        <span className="badge-status badge-vax">{record.vaccine || record.vaccine_type || '—'}</span>
                      </td>
                      {activeFilter === 'reoffer' && reofferInfo ? (
                        <>
                          <td>{reofferInfo.daysSinceDecline} days</td>
                          <td>
                            <Badge 
                              variant={reofferInfo.priority === 'high' ? 'destructive' : 'secondary'}
                              className={reofferInfo.priority === 'medium' ? 'bg-amber-500 text-white' : ''}
                            >
                              {reofferInfo.priority.toUpperCase()}
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
                })}
              </tbody>
            </table>
          )}
        </div>
      </SectionCard>

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
    </div>
  );
};

export default VAXView;
