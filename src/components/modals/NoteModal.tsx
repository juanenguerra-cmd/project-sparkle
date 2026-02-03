import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertTriangle, Plus, X } from 'lucide-react';
import { Note, SYMPTOM_OPTIONS, SymptomCategory, Resident } from '@/lib/types';
import { loadDB, saveDB, addAudit, classifySymptoms, getResidentLineListing } from '@/lib/database';
import { toLocalISODate } from '@/lib/parsers';
import { toast } from 'sonner';

interface NoteModalProps {
  open: boolean;
  onClose: () => void;
  onSave: () => void;
  note?: Note | null;
  preselectedResident?: Resident | null;
}

const CATEGORY_OPTIONS = [
  'General',
  'Clinical',
  'Symptoms',
  'Follow-up',
  'Lab Result',
  'Physician Order',
  'Family Communication',
  'Other'
];

const CATEGORY_COLORS: Record<SymptomCategory, string> = {
  respiratory: 'bg-blue-100 text-blue-800 border-blue-300',
  gi: 'bg-amber-100 text-amber-800 border-amber-300',
  skin: 'bg-pink-100 text-pink-800 border-pink-300',
  uti: 'bg-purple-100 text-purple-800 border-purple-300',
  other: 'bg-gray-100 text-gray-800 border-gray-300'
};

const NoteModal = ({ open, onClose, onSave, note, preselectedResident }: NoteModalProps) => {
  const [db] = useState(() => loadDB());
  const [mrn, setMrn] = useState('');
  const [category, setCategory] = useState('General');
  const [text, setText] = useState('');
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [requiresFollowUp, setRequiresFollowUp] = useState(false);
  const [followUpDate, setFollowUpDate] = useState('');
  const [showSymptomPicker, setShowSymptomPicker] = useState(false);

  const residents = Object.values(db.census.residentsByMrn).filter(r => r.active_on_census);
  const selectedResident = residents.find(r => r.mrn === mrn);
  
  // Auto-classify symptoms
  const symptomCategory = selectedSymptoms.length > 0 ? classifySymptoms(selectedSymptoms) : null;
  
  // Check if resident has existing line listing
  const existingLineListing = mrn ? getResidentLineListing(db, mrn) : null;

  useEffect(() => {
    if (note) {
      setMrn(note.mrn);
      setCategory(note.category);
      setText(note.text);
      setSelectedSymptoms(note.symptoms || []);
      setRequiresFollowUp(note.requiresFollowUp || false);
      setFollowUpDate(note.followUpDate || '');
    } else if (preselectedResident) {
      setMrn(preselectedResident.mrn);
    } else {
      resetForm();
    }
  }, [note, preselectedResident, open]);

  const resetForm = () => {
    setMrn('');
    setCategory('General');
    setText('');
    setSelectedSymptoms([]);
    setRequiresFollowUp(false);
    setFollowUpDate('');
    setShowSymptomPicker(false);
  };

  const toggleSymptom = (symptomId: string) => {
    setSelectedSymptoms(prev => 
      prev.includes(symptomId) 
        ? prev.filter(s => s !== symptomId)
        : [...prev, symptomId]
    );
    // Auto-enable follow-up when symptoms are added
    if (!selectedSymptoms.includes(symptomId)) {
      setRequiresFollowUp(true);
      if (!followUpDate) {
        // Default to tomorrow
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        setFollowUpDate(toLocalISODate(tomorrow));
      }
    }
  };

  const handleSave = () => {
    if (!mrn || !text.trim()) {
      toast.error('Please select a resident and enter note text');
      return;
    }

    const resident = residents.find(r => r.mrn === mrn);
    if (!resident) {
      toast.error('Invalid resident selected');
      return;
    }

    const now = new Date().toISOString();
    const noteData: Note = {
      id: note?.id || `note_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      mrn,
      residentName: resident.name,
      name: resident.name,
      unit: resident.unit,
      room: resident.room,
      category: selectedSymptoms.length > 0 ? 'Symptoms' : category,
      text,
      symptoms: selectedSymptoms.length > 0 ? selectedSymptoms : undefined,
      symptomCategory: symptomCategory || undefined,
      requiresFollowUp,
      followUpDate: requiresFollowUp ? followUpDate : undefined,
      followUpStatus: requiresFollowUp ? 'pending' : undefined,
      linkedLineListingId: existingLineListing?.id,
      createdAt: note?.createdAt || now,
      updatedAt: now
    };

    const db = loadDB();
    if (note) {
      const idx = db.records.notes.findIndex(n => n.id === note.id);
      if (idx >= 0) {
        db.records.notes[idx] = noteData;
      }
      addAudit(db, 'note_updated', `Updated note for ${resident.name}`, 'notes');
    } else {
      db.records.notes.unshift(noteData);
      addAudit(db, 'note_created', `Created note for ${resident.name}${selectedSymptoms.length > 0 ? ` with symptoms (${symptomCategory})` : ''}`, 'notes');
    }

    saveDB(db);
    
    // Show appropriate toast
    if (selectedSymptoms.length > 0) {
      if (existingLineListing) {
        toast.success(`Note saved and linked to existing ${symptomCategory?.toUpperCase()} line listing`);
      } else {
        toast.success(`Note saved with ${symptomCategory?.toUpperCase()} symptoms flagged for follow-up`, {
          action: {
            label: 'Add to Line Listing',
            onClick: () => {
              // This would open the line listing modal - handled by parent
              toast.info('Open the Outbreak view to add this resident to a line listing');
            }
          }
        });
      }
    } else {
      toast.success(note ? 'Note updated' : 'Note created');
    }

    onSave();
    onClose();
    resetForm();
  };

  const getSymptomsByCategory = (cat: SymptomCategory) => 
    SYMPTOM_OPTIONS.filter(s => s.category === cat);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{note ? 'Edit Note' : 'Add Clinical Note'}</DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-4 py-4">
          {/* Resident Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Resident</label>
            <Select value={mrn} onValueChange={setMrn}>
              <SelectTrigger>
                <SelectValue placeholder="Select resident..." />
              </SelectTrigger>
              <SelectContent>
                {residents.map(r => (
                  <SelectItem key={r.mrn} value={r.mrn}>
                    {r.name} - {r.room} ({r.unit})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Existing Line Listing Alert */}
          {existingLineListing && (
            <div className="flex items-center gap-2 p-3 bg-warning/10 border border-warning/30 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-warning" />
              <div className="flex-1">
                <p className="text-sm font-medium">Active Line Listing</p>
                <p className="text-xs text-muted-foreground">
                  This resident is on the {existingLineListing.symptomCategory?.toUpperCase()} line listing. 
                  New symptoms will be linked automatically.
                </p>
              </div>
            </div>
          )}

          {/* Category */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Category</label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_OPTIONS.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Symptoms Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Symptoms</label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowSymptomPicker(!showSymptomPicker)}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Symptoms
              </Button>
            </div>

            {/* Selected Symptoms */}
            {selectedSymptoms.length > 0 && (
              <div className="flex flex-wrap gap-2 p-3 bg-muted/50 rounded-lg">
                {selectedSymptoms.map(symptomId => {
                  const symptom = SYMPTOM_OPTIONS.find(s => s.id === symptomId);
                  if (!symptom) return null;
                  return (
                    <Badge 
                      key={symptomId}
                      variant="outline"
                      className={`${CATEGORY_COLORS[symptom.category]} cursor-pointer`}
                      onClick={() => toggleSymptom(symptomId)}
                    >
                      {symptom.name}
                      <X className="h-3 w-3 ml-1" />
                    </Badge>
                  );
                })}
              </div>
            )}

            {/* Auto-classification badge */}
            {symptomCategory && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Auto-classified as:</span>
                <Badge className={CATEGORY_COLORS[symptomCategory]}>
                  {symptomCategory.toUpperCase()}
                </Badge>
              </div>
            )}

            {/* Symptom Picker */}
            {showSymptomPicker && (
              <div className="border rounded-lg p-4 space-y-4 bg-background">
                {(['respiratory', 'gi', 'skin', 'uti', 'other'] as SymptomCategory[]).map(cat => (
                  <div key={cat}>
                    <h4 className="text-sm font-medium capitalize mb-2">{cat === 'gi' ? 'GI' : cat === 'uti' ? 'UTI' : cat}</h4>
                    <div className="flex flex-wrap gap-2">
                      {getSymptomsByCategory(cat).map(symptom => (
                        <Badge
                          key={symptom.id}
                          variant={selectedSymptoms.includes(symptom.id) ? "default" : "outline"}
                          className={`cursor-pointer transition-all ${
                            selectedSymptoms.includes(symptom.id) 
                              ? CATEGORY_COLORS[symptom.category]
                              : 'hover:bg-muted'
                          }`}
                          onClick={() => toggleSymptom(symptom.id)}
                        >
                          {symptom.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Note Text */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Note</label>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Enter clinical note..."
              rows={4}
            />
          </div>

          {/* Follow-up Section */}
          <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
            <div className="flex items-center gap-3">
              <Checkbox
                id="followUp"
                checked={requiresFollowUp}
                onCheckedChange={(checked) => setRequiresFollowUp(checked as boolean)}
              />
              <label htmlFor="followUp" className="text-sm font-medium cursor-pointer">
                Requires Follow-up
              </label>
            </div>

            {requiresFollowUp && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Follow-up Date</label>
                <Input
                  type="date"
                  value={followUpDate}
                  onChange={(e) => setFollowUpDate(e.target.value)}
                />
              </div>
            )}
          </div>
          </div>
        </ScrollArea>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave}>
            {note ? 'Update Note' : 'Save Note'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NoteModal;
