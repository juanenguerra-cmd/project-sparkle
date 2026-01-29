import { useState } from 'react';
import { Plus, RefreshCw, Download, Search, Eye, Edit, Trash2, Upload, UserX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import SectionCard from '@/components/dashboard/SectionCard';
import TrackerSummary from '@/components/dashboard/TrackerSummary';
import ABTImportModal from '@/components/modals/ABTImportModal';
import ABTCaseModal from '@/components/modals/ABTCaseModal';
import { loadDB, getActiveABT, saveDB, addAudit } from '@/lib/database';
import { ABTRecord } from '@/lib/types';
import { isoDateFromAny, computeTxDays } from '@/lib/parsers';
import { useToast } from '@/hooks/use-toast';

const ABTView = () => {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed'>('active');
  const [showImportModal, setShowImportModal] = useState(false);
  const [showCaseModal, setShowCaseModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<ABTRecord | null>(null);
  const [db, setDb] = useState(() => loadDB());
  
  const records = db.records.abx;
  const today = new Date().toISOString().slice(0, 10);

  const handleDeleteRecord = (record: ABTRecord) => {
    if (!window.confirm(`Delete ABT record for ${record.residentName || record.name}?`)) return;
    
    const currentDb = loadDB();
    const idx = currentDb.records.abx.findIndex(r => r.id === record.id);
    if (idx >= 0) {
      currentDb.records.abx.splice(idx, 1);
      addAudit(currentDb, 'abx_delete', `Deleted ABT record for ${record.residentName || record.name}`, 'abt');
      saveDB(currentDb);
      setDb(currentDb);
      toast({ title: 'ABT Record Deleted' });
    }
  };

  const handleDischargeRecord = (record: ABTRecord) => {
    if (!window.confirm(`Mark ${record.residentName || record.name} as discharged? This will close the ABT record.`)) return;
    
    const currentDb = loadDB();
    const idx = currentDb.records.abx.findIndex(r => r.id === record.id);
    if (idx >= 0) {
      currentDb.records.abx[idx].status = 'discontinued';
      currentDb.records.abx[idx].endDate = today;
      currentDb.records.abx[idx].end_date = today;
      currentDb.records.abx[idx].notes = `${currentDb.records.abx[idx].notes || ''} [Manual discharge: ${today}]`.trim();
      addAudit(currentDb, 'abx_discharge', `Manually discharged ABT record for ${record.residentName || record.name}`, 'abt');
      saveDB(currentDb);
      setDb(currentDb);
      toast({ title: 'ABT Record Discharged', description: `${record.residentName || record.name} marked as discharged` });
    }
  };

  // Get active resident MRNs from census
  const activeCensusMrns = new Set(
    Object.values(db.census.residentsByMrn)
      .filter(r => r.active_on_census)
      .map(r => r.mrn)
  );

  const filteredRecords = records.filter(r => {
    // Always exclude discontinued records from active view
    if (r.status === 'discontinued') {
      // Only show discontinued in 'completed' filter or 'all' filter
      if (statusFilter === 'active') return false;
    }
    
    // Check if resident is still in census (unless viewing completed/all)
    if (statusFilter === 'active') {
      if (r.mrn && !activeCensusMrns.has(r.mrn)) {
        return false; // Resident discharged from census
      }
    }
    
    // Search filter
    const name = r.residentName || r.name || '';
    const medication = r.medication || r.med_name || '';
    const indication = r.indication || '';
    
    const matchesSearch = 
      name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      medication.toLowerCase().includes(searchTerm.toLowerCase()) ||
      indication.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (!matchesSearch) return false;
    
    // Status filter
    if (statusFilter === 'all') return true;
    if (statusFilter === 'active') {
      const endDate = r.endDate || r.end_date;
      const isActive = r.status === 'active' || !endDate || isoDateFromAny(endDate) >= today;
      return isActive;
    }
    if (statusFilter === 'completed') {
      return r.status === 'completed' || r.status === 'discontinued';
    }
    return true;
  });

  // Sort by start date descending
  const sortedRecords = [...filteredRecords].sort((a, b) => {
    const dateA = isoDateFromAny(a.startDate || a.start_date || '');
    const dateB = isoDateFromAny(b.startDate || b.start_date || '');
    return dateB.localeCompare(dateA);
  });

  const activeCount = records.filter(r => {
    if (r.status === 'discontinued') return false;
    if (r.mrn && !activeCensusMrns.has(r.mrn)) return false;
    const endDate = r.endDate || r.end_date;
    return r.status === 'active' || !endDate || isoDateFromAny(endDate) >= today;
  }).length;

  const completedCount = records.filter(r => r.status === 'completed' || r.status === 'discontinued').length;

  const getStatusBadge = (record: typeof records[0]) => {
    const endDate = record.endDate || record.end_date;
    const isActive = record.status === 'active' || !endDate || isoDateFromAny(endDate) >= today;
    
    if (record.status === 'discontinued') {
      return <span className="badge-status badge-bad">Discontinued</span>;
    }
    if (isActive) {
      return <span className="badge-status badge-warn">Active</span>;
    }
    return <span className="badge-status badge-ok">Completed</span>;
  };

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return '—';
    const iso = isoDateFromAny(dateStr);
    if (!iso) return dateStr;
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
  };

  const handleRefresh = () => {
    setDb(loadDB());
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">ABT Management</h2>
          <p className="text-sm text-muted-foreground">Antibiotic Therapy Tracking & Stewardship</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowImportModal(true)}>
            <Upload className="w-4 h-4 mr-2" />
            Import
          </Button>
          <Button size="sm" onClick={() => { setEditingRecord(null); setShowCaseModal(true); }}>
            <Plus className="w-4 h-4 mr-2" />
            Add ABT
          </Button>
        </div>
      </div>

      {/* Trend Summary */}
      <TrackerSummary type="abt" />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="stat-card text-center">
          <div className="text-2xl font-bold text-primary">{activeCount}</div>
          <div className="text-sm text-muted-foreground">Active Courses</div>
        </div>
        <div className="stat-card text-center">
          <div className="text-2xl font-bold text-foreground">{records.length}</div>
          <div className="text-sm text-muted-foreground">Total Records</div>
        </div>
        <div className="stat-card text-center">
          <div className="text-2xl font-bold text-success">{completedCount}</div>
          <div className="text-sm text-muted-foreground">Completed</div>
        </div>
        <div className="stat-card text-center">
          <div className="text-2xl font-bold text-warning">
            {records.length > 0 
              ? Math.round(records.reduce((sum, r) => sum + (r.tx_days || r.daysOfTherapy || 0), 0) / records.length)
              : 0}
          </div>
          <div className="text-sm text-muted-foreground">Avg. Days Therapy</div>
        </div>
      </div>

      {/* Filter */}
      <div className="filter-panel">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Search by name, medication, or indication..." 
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Badge 
              variant="outline" 
              className={`cursor-pointer ${statusFilter === 'all' ? 'bg-primary text-primary-foreground' : 'hover:bg-primary hover:text-primary-foreground'}`}
              onClick={() => setStatusFilter('all')}
            >
              All ({records.length})
            </Badge>
            <Badge 
              variant="outline" 
              className={`cursor-pointer ${statusFilter === 'active' ? 'bg-primary text-primary-foreground' : 'hover:bg-primary hover:text-primary-foreground'}`}
              onClick={() => setStatusFilter('active')}
            >
              Active ({activeCount})
            </Badge>
            <Badge 
              variant="outline" 
              className={`cursor-pointer ${statusFilter === 'completed' ? 'bg-primary text-primary-foreground' : 'hover:bg-primary hover:text-primary-foreground'}`}
              onClick={() => setStatusFilter('completed')}
            >
              Completed ({completedCount})
            </Badge>
          </div>
        </div>
      </div>

      {/* Table */}
      <SectionCard title={`ABT Records (${sortedRecords.length})`} noPadding>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Resident</th>
                <th>Unit/Room</th>
                <th>Medication</th>
                <th>Dose</th>
                <th>Route</th>
                <th>Indication</th>
                <th>Source</th>
                <th>Start</th>
                <th>End</th>
                <th>Days</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedRecords.length === 0 ? (
                <tr>
                  <td colSpan={12} className="text-center py-8 text-muted-foreground">
                    No ABT records found. Import data or add a new record.
                  </td>
                </tr>
              ) : (
                sortedRecords.map((record, idx) => (
                  <tr key={record.id || idx}>
                    <td className="font-medium">{record.residentName || record.name}</td>
                    <td className="text-sm">{record.unit} / {record.room}</td>
                    <td>
                      <span className="font-semibold text-primary text-sm">{record.medication || record.med_name}</span>
                    </td>
                    <td className="text-sm">{record.dose}</td>
                    <td className="text-sm">
                      <span className="badge-status badge-abt">{record.route || '—'}</span>
                    </td>
                    <td className="text-sm max-w-[120px] truncate" title={record.indication}>
                      {record.indication}
                    </td>
                    <td>
                      <span className="badge-status badge-abt text-xs">{record.infection_source || '—'}</span>
                    </td>
                    <td className="text-sm">{formatDate(record.startDate || record.start_date)}</td>
                    <td className="text-sm">{formatDate(record.endDate || record.end_date)}</td>
                    <td className="font-semibold">{record.tx_days || record.daysOfTherapy || '—'}</td>
                    <td>{getStatusBadge(record)}</td>
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
                        {(record.status === 'active' || (!record.endDate && !record.end_date) || (record.endDate && record.endDate >= today) || (record.end_date && record.end_date >= today)) && (
                          <button 
                            type="button"
                            className="row-action-btn text-warning hover:text-warning" 
                            title="Discharge"
                            onClick={() => handleDischargeRecord(record)}
                          >
                            <UserX className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <ABTImportModal 
        open={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImportComplete={() => setDb(loadDB())}
      />
      
      <ABTCaseModal 
        open={showCaseModal}
        onClose={() => { setShowCaseModal(false); setEditingRecord(null); }}
        onSave={() => setDb(loadDB())}
        editRecord={editingRecord}
      />
    </div>
  );
};

export default ABTView;
