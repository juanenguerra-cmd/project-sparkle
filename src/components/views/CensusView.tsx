import { useState, useMemo } from 'react';
import { Upload, Download, Search, UserPlus, Eye, Edit, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import SectionCard from '@/components/dashboard/SectionCard';
import CensusImportModal from '@/components/modals/CensusImportModal';
import ResidentDetailModal from '@/components/modals/ResidentDetailModal';
import { loadDB } from '@/lib/database';
import { Resident, ViewType } from '@/lib/types';
import { SortableTableHeader, useSortableTable } from '@/components/ui/sortable-table-header';

interface CensusViewProps {
  onNavigate?: (view: ViewType) => void;
}

const CensusView = ({ onNavigate }: CensusViewProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedResident, setSelectedResident] = useState<Resident | null>(null);
  const [db, setDb] = useState(() => loadDB());
  
  const residents = Object.values(db.census.residentsByMrn);
  const activeCount = residents.filter(r => r.active_on_census).length;

  const filteredResidents = useMemo(() => residents.filter(r => 
    (r.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (r.mrn || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (r.unit || '').toLowerCase().includes(searchTerm.toLowerCase())
  ), [residents, searchTerm]);

  const { sortKey, sortDirection, handleSort, sortedData: sortedResidents } = useSortableTable(filteredResidents, 'name');

  const handleRowClick = (resident: Resident) => {
    setSelectedResident(resident);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Census</h2>
          <p className="text-sm text-muted-foreground">Resident management and census tracking</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowImportModal(true)}>
            <Upload className="w-4 h-4 mr-2" />
            Import Census
          </Button>
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button size="sm">
            <UserPlus className="w-4 h-4 mr-2" />
            Add Resident
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="stat-card text-center">
          <div className="text-2xl font-bold text-primary">{activeCount}</div>
          <div className="text-sm text-muted-foreground">Active Residents</div>
        </div>
        <div className="stat-card text-center">
          <div className="text-2xl font-bold text-foreground">{new Set(residents.map(r => r.unit)).size}</div>
          <div className="text-sm text-muted-foreground">Units</div>
        </div>
        <div className="stat-card text-center">
          <div className="text-2xl font-bold text-success">{residents.length}</div>
          <div className="text-sm text-muted-foreground">Total Residents</div>
        </div>
        <div className="stat-card text-center">
          <div className="text-2xl font-bold text-muted-foreground">{residents.length - activeCount}</div>
          <div className="text-sm text-muted-foreground">Inactive</div>
        </div>
      </div>

      <div className="filter-panel">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search by name, MRN, or unit..." 
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <SectionCard title="Resident List" noPadding>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <SortableTableHeader label="Name" sortKey="name" currentSortKey={sortKey} currentSortDirection={sortDirection} onSort={handleSort} />
                <SortableTableHeader label="MRN" sortKey="mrn" currentSortKey={sortKey} currentSortDirection={sortDirection} onSort={handleSort} />
                <SortableTableHeader label="Unit" sortKey="unit" currentSortKey={sortKey} currentSortDirection={sortDirection} onSort={handleSort} />
                <SortableTableHeader label="Room" sortKey="room" currentSortKey={sortKey} currentSortDirection={sortDirection} onSort={handleSort} />
                <SortableTableHeader label="DOB" sortKey="dob" currentSortKey={sortKey} currentSortDirection={sortDirection} onSort={handleSort} />
                <SortableTableHeader label="Status" sortKey="status" currentSortKey={sortKey} currentSortDirection={sortDirection} onSort={handleSort} />
                <SortableTableHeader label="Active" sortKey="active_on_census" currentSortKey={sortKey} currentSortDirection={sortDirection} onSort={handleSort} />
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedResidents.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-muted-foreground">
                    No residents found. Import a census to get started.
                  </td>
                </tr>
              ) : (
                sortedResidents.map((resident) => (
                  <tr 
                    key={resident.mrn} 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleRowClick(resident)}
                  >
                    <td className="font-medium">{resident.name}</td>
                    <td className="font-mono text-sm">{resident.mrn}</td>
                    <td>{resident.unit}</td>
                    <td>{resident.room}</td>
                    <td>{resident.dob_raw || resident.dob || '—'}</td>
                    <td>{resident.status || '—'}</td>
                    <td>
                      {resident.active_on_census ? (
                        <span className="badge-status badge-ok">Active</span>
                      ) : (
                        <span className="badge-status badge-muted">Inactive</span>
                      )}
                    </td>
                    <td>
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <button 
                          className="row-action-btn" 
                          title="View"
                          onClick={() => handleRowClick(resident)}
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button className="row-action-btn" title="Edit"><Edit className="w-4 h-4" /></button>
                        <button className="row-action-btn" title="Delete"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <CensusImportModal 
        open={showImportModal} 
        onClose={() => setShowImportModal(false)}
        onImportComplete={() => setDb(loadDB())}
      />

      <ResidentDetailModal
        open={!!selectedResident}
        onClose={() => setSelectedResident(null)}
        resident={selectedResident}
      />

      {onNavigate && (
        <SectionCard title="Next Steps">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => onNavigate('ip')}>
              Review IP Cases
            </Button>
            <Button size="sm" variant="outline" onClick={() => onNavigate('abt')}>
              Review ABT Courses
            </Button>
            <Button size="sm" variant="outline" onClick={() => onNavigate('notes')}>
              Add Notes
            </Button>
          </div>
        </SectionCard>
      )}
    </div>
  );
};

export default CensusView;
