import { useEffect, useMemo, useState } from 'react';
import { Upload, Download, Search, UserPlus, Eye, Edit, Trash2, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import SectionCard from '@/components/dashboard/SectionCard';
import CensusImportModal from '@/components/modals/CensusImportModal';
import ResidentDetailModal from '@/components/modals/ResidentDetailModal';
import { loadDB } from '@/lib/database';
import { Resident, ViewType } from '@/lib/types';
import { SortableTableHeader, useSortableTable } from '@/components/ui/sortable-table-header';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import TablePagination from '@/components/ui/table-pagination';

interface CensusViewProps {
  onNavigate?: (view: ViewType) => void;
}

const CensusView = ({ onNavigate }: CensusViewProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [unitFilter, setUnitFilter] = useState('all');
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedResident, setSelectedResident] = useState<Resident | null>(null);
  const [db, setDb] = useState(() => loadDB());
  const [currentPage, setCurrentPage] = useState(1);
  
  const residents = Object.values(db.census.residentsByMrn);
  const activeCount = residents.filter(r => r.active_on_census).length;

  const units = useMemo(
    () => [...new Set(residents.map(r => r.unit).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [residents],
  );

  const filteredResidents = useMemo(() => residents.filter(r => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const matchesSearch = normalizedSearch.length === 0
      || (r.name || '').toLowerCase().includes(normalizedSearch)
      || (r.mrn || '').toLowerCase().includes(normalizedSearch)
      || (r.unit || '').toLowerCase().includes(normalizedSearch)
      || (r.room || '').toLowerCase().includes(normalizedSearch);
    const matchesStatus = statusFilter === 'all'
      || (statusFilter === 'active' ? r.active_on_census : !r.active_on_census);
    const matchesUnit = unitFilter === 'all' || r.unit === unitFilter;
    return matchesSearch && matchesStatus && matchesUnit;
  }), [residents, searchTerm, statusFilter, unitFilter]);

  const { sortKey, sortDirection, handleSort, sortedData: sortedResidents } = useSortableTable(filteredResidents, 'name');
  const pageSize = 20;
  const totalPages = Math.max(1, Math.ceil(sortedResidents.length / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const pagedResidents = sortedResidents.slice(startIndex, startIndex + pageSize);
  const rangeStart = sortedResidents.length === 0 ? 0 : startIndex + 1;
  const rangeEnd = Math.min(startIndex + pageSize, sortedResidents.length);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, unitFilter]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

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
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search by name, MRN, unit, or room..." 
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as 'all' | 'active' | 'inactive')}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active only</SelectItem>
                <SelectItem value="inactive">Inactive only</SelectItem>
              </SelectContent>
            </Select>
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
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('all');
                setUnitFilter('all');
              }}
            >
              Clear filters
            </Button>
          </div>
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
                pagedResidents.map((resident) => (
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
        <TablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          totalItems={sortedResidents.length}
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
          itemLabel="residents"
        />
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
