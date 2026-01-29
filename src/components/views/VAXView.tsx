import { useState } from 'react';
import { Plus, RefreshCw, Download, Search, Eye, Edit, Check, X, Upload, Trash2 } from 'lucide-react';
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

type VAXFilter = 'all' | 'due' | 'overdue' | 'given' | 'declined';

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

  const filteredRecords = records.filter(r => {
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

  const dueRecords = getVaxDue(db);
  
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
          </div>
        </div>
      </div>

      {/* Table */}
      <SectionCard title="Vaccination Records" noPadding>
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
                  <th>Dose</th>
                  <th>Date Given</th>
                  <th>Due Date</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((record) => (
                  <tr key={record.id}>
                    <td className="font-medium">{record.residentName || record.name || '—'}</td>
                    <td>{record.unit} / {record.room}</td>
                    <td>
                      <span className="badge-status badge-vax">{record.vaccine || record.vaccine_type || '—'}</span>
                    </td>
                    <td>{record.dose || '—'}</td>
                    <td>{record.dateGiven || record.date_given || '—'}</td>
                    <td>{record.dueDate || record.due_date || '—'}</td>
                    <td>{getStatusBadge(record.status)}</td>
                    <td>
                      <div className="flex items-center gap-1">
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
                      </div>
                    </td>
                  </tr>
                ))}
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
