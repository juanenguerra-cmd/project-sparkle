import { useState } from 'react';
import { Plus, Search, Edit, Trash2, AlertTriangle, Check, Clock, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import SectionCard from '@/components/dashboard/SectionCard';
import FollowUpWorklist from '@/components/dashboard/FollowUpWorklist';
import NoteModal from '@/components/modals/NoteModal';
import { loadDB, saveDB, addAudit } from '@/lib/database';
import { Note, SYMPTOM_OPTIONS, SymptomCategory } from '@/lib/types';
import { toast } from 'sonner';

const CATEGORY_COLORS: Record<SymptomCategory, string> = {
  respiratory: 'bg-blue-100 text-blue-800',
  gi: 'bg-amber-100 text-amber-800',
  skin: 'bg-pink-100 text-pink-800',
  uti: 'bg-purple-100 text-purple-800',
  other: 'bg-gray-100 text-gray-800'
};

const NotesView = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [symptomFilter, setSymptomFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  
  const db = loadDB();
  const notes = db.records.notes;

  const filteredNotes = notes.filter(n => {
    const name = n.residentName || n.name || '';
    const text = n.text || '';
    const category = n.category || '';
    
    const matchesSearch = name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      text.toLowerCase().includes(searchTerm.toLowerCase()) ||
      category.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = categoryFilter === 'all' || n.category === categoryFilter;
    const matchesSymptom = symptomFilter === 'all' || n.symptomCategory === symptomFilter;
    
    return matchesSearch && matchesCategory && matchesSymptom;
  });

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
    
    const today = new Date().toISOString().slice(0, 10);
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
        <Button size="sm" onClick={() => { setEditingNote(null); setShowModal(true); }}>
          <Plus className="w-4 h-4 mr-2" />
          Add Note
        </Button>
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
          </div>
        </div>
      </div>

      {/* Notes Table */}
      <SectionCard title={`All Notes (${filteredNotes.length})`} noPadding>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date/Time</th>
                <th>Name</th>
                <th>Room</th>
                <th>Category</th>
                <th>Symptoms</th>
                <th>Note</th>
                <th>Follow-up</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredNotes.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-muted-foreground">
                    No notes found
                  </td>
                </tr>
              ) : (
                filteredNotes.map((note) => (
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
      </SectionCard>

      {/* Note Modal */}
      <NoteModal
        open={showModal}
        onClose={() => { setShowModal(false); setEditingNote(null); }}
        onSave={() => setRefreshKey(k => k + 1)}
        note={editingNote}
      />
    </div>
  );
};

export default NotesView;