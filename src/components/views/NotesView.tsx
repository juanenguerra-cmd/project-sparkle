import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, Edit, Trash2, AlertTriangle, Check, Clock, Filter, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import SectionCard from '@/components/dashboard/SectionCard';
import FollowUpWorklist from '@/components/dashboard/FollowUpWorklist';
import NoteModal from '@/components/modals/NoteModal';
import QuickAddModal from '@/components/modals/QuickAddModal';
import IPCaseModal from '@/components/modals/IPCaseModal';
import ABTCaseModal from '@/components/modals/ABTCaseModal';
import VAXCaseModal from '@/components/modals/VAXCaseModal';
import { loadDB, saveDB, addAudit } from '@/lib/database';
import { Note, SYMPTOM_OPTIONS, SymptomCategory, Resident, ViewType } from '@/lib/types';
import { todayISO } from '@/lib/parsers';
import { toast } from 'sonner';
import { SortableTableHeader, useSortableTable } from '@/components/ui/sortable-table-header';
import TablePagination from '@/components/ui/table-pagination';

const CATEGORY_COLORS: Record<SymptomCategory, string> = {
  respiratory: 'bg-blue-100 text-blue-800',
  gi: 'bg-amber-100 text-amber-800',
  skin: 'bg-pink-100 text-pink-800',
  uti: 'bg-purple-100 text-purple-800',
  other: 'bg-gray-100 text-gray-800'
};

interface NotesViewProps {
  onNavigate?: (view: ViewType) => void;
}

const NotesView = ({ onNavigate }: NotesViewProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [symptomFilter, setSymptomFilter] = useState('all');
  const [followUpFilter, setFollowUpFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  
  // Quick add modal states
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showIPModal, setShowIPModal] = useState(false);
  const [showABTModal, setShowABTModal] = useState(false);
  const [showVAXModal, setShowVAXModal] = useState(false);
  const [quickAddResident, setQuickAddResident] = useState<Resident | null>(null);
  
  const db = loadDB();
  const notes = db.records.notes;

  const filteredNotes = useMemo(() => notes.filter(n => {
    const today = todayISO();
    const name = n.residentName || n.name || '';
    const text = n.text || '';
    const category = n.category || '';
    
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const matchesSearch = normalizedSearch.length === 0
      || name.toLowerCase().includes(normalizedSearch)
      || text.toLowerCase().includes(normalizedSearch)
      || category.toLowerCase().includes(normalizedSearch)
      || (n.room || '').toLowerCase().includes(normalizedSearch);
    
    const matchesCategory = categoryFilter === 'all' || n.category === categoryFilter;
    const matchesSymptom = symptomFilter === 'all' || n.symptomCategory === symptomFilter;

    let followUpStatus = 'none';
    if (n.requiresFollowUp) {
      if (n.followUpStatus === 'completed') {
        followUpStatus = 'completed';
      } else if (n.followUpStatus === 'escalated') {
        followUpStatus = 'escalated';
      } else if (n.followUpDate && n.followUpDate < today) {
        followUpStatus = 'overdue';
      } else {
        followUpStatus = 'pending';
      }
    }
    const matchesFollowUp = followUpFilter === 'all' || followUpStatus === followUpFilter;
    
    return matchesSearch && matchesCategory && matchesSymptom && matchesFollowUp;
  }).map(n => ({
    ...n,
    _name: n.residentName || n.name || '',
    _createdAt: n.createdAt || n.created_at || ''
  })), [notes, searchTerm, categoryFilter, symptomFilter, followUpFilter]);

  const { sortKey, sortDirection, handleSort, sortedData: sortedNotes } = useSortableTable(filteredNotes, '_createdAt', 'desc');
  const pageSize = 20;
  const totalPages = Math.max(1, Math.ceil(sortedNotes.length / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const pagedNotes = sortedNotes.slice(startIndex, startIndex + pageSize);
  const rangeStart = sortedNotes.length === 0 ? 0 : startIndex + 1;
  const rangeEnd = Math.min(startIndex + pageSize, sortedNotes.length);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, categoryFilter, symptomFilter, followUpFilter]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const handleEdit = (note: Note) => {
    setEditingNote(note);
    setShowModal(true);
  };

  const handleDelete = (note: Note) => {
    if (!confirm(`Delete note for ${note.residentName || note.name}?`)) return;
    
    const db = loadDB();
    db.records.notes = db.records.notes.filter(n => n.id !== note.id);
    addAudit(db, 'note_deleted', `Deleted note for ${note.residentName || note.name}`, 'notes');
    saveDB(db);
    toast.success('Note deleted');
    setRefreshKey(k => k + 1);
  };

  const handleAddFollowUpNote = (originalNote: Note) => {
    // Pre-fill with resident info and open modal
    setEditingNote({
      ...originalNote,
      id: '', // Will be generated on save
      text: `Follow-up: `,
      createdAt: ''
    });
    setShowModal(true);
  };

  const getSymptomBadges = (note: Note) => {
    if (!note.symptoms || note.symptoms.length === 0) return null;
    
    return (
      <div className="flex flex-wrap gap-1">
        {note.symptoms.slice(0, 3).map(symptomId => {
          const symptom = SYMPTOM_OPTIONS.find(s => s.id === symptomId);
          if (!symptom) return null;
          return (
            <Badge 
              key={symptomId}
              variant="outline"
              className={`text-xs ${CATEGORY_COLORS[symptom.category]}`}
            >
              {symptom.name}
            </Badge>
          );
        })}
        {note.symptoms.length > 3 && (
          <Badge variant="outline" className="text-xs">
            +{note.symptoms.length - 3}
          </Badge>
        )}
      </div>
    );
  };

  const getFollowUpStatus = (note: Note) => {
    if (!note.requiresFollowUp) return null;
    
    const today = todayISO();
    const isOverdue = note.followUpDate && note.followUpDate < today && note.followUpStatus !== 'completed';
    const isCompleted = note.followUpStatus === 'completed';
    const isEscalated = note.followUpStatus === 'escalated';
    
    if (isCompleted) {
      return <Badge className="bg-success/20 text-success"><Check className="h-3 w-3 mr-1" />Done</Badge>;
    }
    if (isEscalated) {
      return <Badge className="bg-destructive/20 text-destructive"><AlertTriangle className="h-3 w-3 mr-1" />Escalated</Badge>;
    }
    if (isOverdue) {
      return <Badge className="bg-destructive/20 text-destructive"><Clock className="h-3 w-3 mr-1" />Overdue</Badge>;
    }
    return <Badge className="bg-warning/20 text-warning"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
  };

  // Get unique categories for filter
  const categories = [...new Set(notes.map(n => n.category))].filter(Boolean);

  return (
    <div className="space-y-6 animate-fade-in" key={refreshKey}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Notes & Symptom Tracking</h2>
          <p className="text-sm text-muted-foreground">Clinical notes with symptom monitoring and follow-up tracking</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowQuickAdd(true)}>
            <Zap className="w-4 h-4 mr-2" />
            Quick Add
          </Button>
          <Button size="sm" onClick={() => { setEditingNote(null); setShowModal(true); }}>
            <Plus className="w-4 h-4 mr-2" />
            Add Note
          </Button>
        </div>
      </div>

      {/* Follow-up Worklist */}
      <SectionCard 
        title="Today's Follow-ups" 
        actions={
          <Badge variant="outline" className="bg-warning/10 text-warning">
            Action Required
          </Badge>
        }
      >
        <FollowUpWorklist 
          onAddFollowUpNote={handleAddFollowUpNote}
          compact={false}
        />
      </SectionCard>

      {/* Filters */}
      <div className="filter-panel">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search notes..." 
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={symptomFilter} onValueChange={setSymptomFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Symptom Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="respiratory">Respiratory</SelectItem>
                <SelectItem value="gi">GI</SelectItem>
                <SelectItem value="skin">Skin</SelectItem>
                <SelectItem value="uti">UTI</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
            <Select value={followUpFilter} onValueChange={setFollowUpFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Follow-up" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All follow-ups</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="escalated">Escalated</SelectItem>
                <SelectItem value="none">No follow-up</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchTerm('');
                setCategoryFilter('all');
                setSymptomFilter('all');
                setFollowUpFilter('all');
              }}
            >
              Clear filters
            </Button>
          </div>
        </div>
      </div>

      {/* Notes Table */}
      <SectionCard title={`All Notes (${sortedNotes.length})`} noPadding>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <SortableTableHeader label="Date/Time" sortKey="_createdAt" currentSortKey={sortKey} currentSortDirection={sortDirection} onSort={handleSort} />
                <SortableTableHeader label="Name" sortKey="_name" currentSortKey={sortKey} currentSortDirection={sortDirection} onSort={handleSort} />
                <SortableTableHeader label="Room" sortKey="room" currentSortKey={sortKey} currentSortDirection={sortDirection} onSort={handleSort} />
                <SortableTableHeader label="Category" sortKey="category" currentSortKey={sortKey} currentSortDirection={sortDirection} onSort={handleSort} />
                <th>Symptoms</th>
                <th>Note</th>
                <SortableTableHeader label="Follow-up" sortKey="followUpDate" currentSortKey={sortKey} currentSortDirection={sortDirection} onSort={handleSort} />
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedNotes.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-muted-foreground">
                    No notes found
                  </td>
                </tr>
              ) : (
                pagedNotes.map((note) => (
                  <tr key={note.id}>
                    <td className="text-sm whitespace-nowrap">{formatDate(note.createdAt || note.created_at || '')}</td>
                    <td className="font-medium">{note.residentName || note.name}</td>
                    <td>{note.room}</td>
                    <td>
                      {note.symptomCategory ? (
                        <Badge className={CATEGORY_COLORS[note.symptomCategory]}>
                          {note.symptomCategory.toUpperCase()}
                        </Badge>
                      ) : (
                        <span className="badge-status badge-muted">{note.category}</span>
                      )}
                    </td>
                    <td>{getSymptomBadges(note)}</td>
                    <td className="max-w-xs truncate">{note.text}</td>
                    <td>{getFollowUpStatus(note)}</td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button 
                          className="row-action-btn" 
                          title="Edit"
                          onClick={() => handleEdit(note)}
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button 
                          className="row-action-btn" 
                          title="Delete"
                          onClick={() => handleDelete(note)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
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
          totalItems={sortedNotes.length}
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
          itemLabel="notes"
        />
      </SectionCard>

      {/* Note Modal */}
      <NoteModal
        open={showModal}
        onClose={() => { setShowModal(false); setEditingNote(null); }}
        onSave={() => setRefreshKey(k => k + 1)}
        note={editingNote}
      />

      {/* Quick Add Modal */}
      <QuickAddModal
        open={showQuickAdd}
        onClose={() => setShowQuickAdd(false)}
        resident={quickAddResident}
        onSelectIPCase={() => setShowIPModal(true)}
        onSelectABTCase={() => setShowABTModal(true)}
        onSelectVAXCase={() => setShowVAXModal(true)}
        onSelectOutbreakCase={() => {
          toast.info('Navigate to Outbreak view to add cases');
        }}
      />

      {/* IP Case Modal */}
      <IPCaseModal
        open={showIPModal}
        onClose={() => setShowIPModal(false)}
        onSave={() => setRefreshKey(k => k + 1)}
        editCase={null}
      />

      {/* ABT Case Modal */}
      <ABTCaseModal
        open={showABTModal}
        onClose={() => setShowABTModal(false)}
        onSave={() => setRefreshKey(k => k + 1)}
        editRecord={null}
      />

      {/* VAX Case Modal */}
      <VAXCaseModal
        open={showVAXModal}
        onClose={() => setShowVAXModal(false)}
        onSave={() => setRefreshKey(k => k + 1)}
        editRecord={null}
      />

      {onNavigate && (
        <SectionCard title="Next Steps">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => onNavigate('ip')}>
              Review IP Cases
            </Button>
            <Button size="sm" variant="outline" onClick={() => onNavigate('abt')}>
              Review ABT
            </Button>
            <Button size="sm" variant="outline" onClick={() => onNavigate('reports')}>
              Run Reports
            </Button>
          </div>
        </SectionCard>
      )}
    </div>
  );
};

export default NotesView;
