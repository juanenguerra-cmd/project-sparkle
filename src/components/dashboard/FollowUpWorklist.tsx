import { useState } from 'react';
import { Check, AlertTriangle, Clock, ChevronRight, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { loadDB, saveDB, getNotesRequiringFollowUp } from '@/lib/database';
import { Note, SYMPTOM_OPTIONS, SymptomCategory } from '@/lib/types';
import { toast } from 'sonner';

interface FollowUpWorklistProps {
  onViewResident?: (mrn: string) => void;
  onAddFollowUpNote?: (note: Note) => void;
  compact?: boolean;
}

const CATEGORY_COLORS: Record<SymptomCategory, string> = {
  respiratory: 'bg-blue-100 text-blue-800',
  gi: 'bg-amber-100 text-amber-800',
  skin: 'bg-pink-100 text-pink-800',
  uti: 'bg-purple-100 text-purple-800',
  other: 'bg-gray-100 text-gray-800'
};

const FollowUpWorklist = ({ onViewResident, onAddFollowUpNote, compact = false }: FollowUpWorklistProps) => {
  const [refreshKey, setRefreshKey] = useState(0);
  const db = loadDB();
  const followUps = getNotesRequiringFollowUp(db);

  const handleMarkComplete = (note: Note) => {
    const db = loadDB();
    const idx = db.records.notes.findIndex(n => n.id === note.id);
    if (idx >= 0) {
      db.records.notes[idx] = {
        ...db.records.notes[idx],
        followUpStatus: 'completed',
        updatedAt: new Date().toISOString()
      };
      saveDB(db);
      toast.success(`Follow-up completed for ${note.residentName || note.name}`);
      setRefreshKey(k => k + 1);
    }
  };

  const handleEscalate = (note: Note) => {
    const db = loadDB();
    const idx = db.records.notes.findIndex(n => n.id === note.id);
    if (idx >= 0) {
      db.records.notes[idx] = {
        ...db.records.notes[idx],
        followUpStatus: 'escalated',
        updatedAt: new Date().toISOString()
      };
      saveDB(db);
      toast.warning(`Follow-up escalated for ${note.residentName || note.name}`);
      setRefreshKey(k => k + 1);
    }
  };

  const getSymptomNames = (symptomIds: string[]) => {
    return symptomIds
      .map(id => SYMPTOM_OPTIONS.find(s => s.id === id)?.name)
      .filter(Boolean)
      .slice(0, 3)
      .join(', ');
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();
    const isOverdue = date < today;
    
    return {
      text: isToday ? 'Today' : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      isOverdue: isOverdue && !isToday,
      isToday
    };
  };

  if (followUps.length === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground">
        <Check className="h-8 w-8 mx-auto mb-2 text-success" />
        <p className="text-sm">No follow-ups pending</p>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="space-y-2" key={refreshKey}>
        {followUps.slice(0, 5).map(note => {
          const dateInfo = note.followUpDate ? formatDate(note.followUpDate) : null;
          return (
            <div 
              key={note.id}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
              onClick={() => onViewResident?.(note.mrn)}
            >
              <div className={`w-2 h-2 rounded-full ${
                dateInfo?.isOverdue ? 'bg-destructive' : 
                dateInfo?.isToday ? 'bg-warning' : 'bg-primary'
              }`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{note.residentName || note.name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {note.symptoms?.length ? getSymptomNames(note.symptoms) : note.text.slice(0, 40)}
                </p>
              </div>
              {note.symptomCategory && (
                <Badge className={`${CATEGORY_COLORS[note.symptomCategory]} text-xs`}>
                  {note.symptomCategory.toUpperCase()}
                </Badge>
              )}
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          );
        })}
        {followUps.length > 5 && (
          <p className="text-xs text-muted-foreground text-center pt-2">
            +{followUps.length - 5} more follow-ups
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3" key={refreshKey}>
      {followUps.map(note => {
        const dateInfo = note.followUpDate ? formatDate(note.followUpDate) : null;
        return (
          <div 
            key={note.id}
            className={`p-4 border rounded-lg ${
              dateInfo?.isOverdue ? 'border-destructive/50 bg-destructive/5' : 
              dateInfo?.isToday ? 'border-warning/50 bg-warning/5' : ''
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  note.symptomCategory ? CATEGORY_COLORS[note.symptomCategory] : 'bg-muted'
                }`}>
                  <User className="h-5 w-5" />
                </div>
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-medium">{note.residentName || note.name}</h4>
                  <span className="text-sm text-muted-foreground">
                    {note.room} • {note.unit}
                  </span>
                </div>
                
                {note.symptoms && note.symptoms.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {note.symptoms.map(symptomId => {
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
                  </div>
                )}
                
                <p className="text-sm text-muted-foreground line-clamp-2">{note.text}</p>
                
                <div className="flex items-center gap-4 mt-3">
                  <div className="flex items-center gap-1 text-sm">
                    <Clock className="h-4 w-4" />
                    <span className={dateInfo?.isOverdue ? 'text-destructive font-medium' : ''}>
                      {dateInfo?.isOverdue && <AlertTriangle className="h-3 w-3 inline mr-1" />}
                      {dateInfo?.text || 'No date set'}
                    </span>
                  </div>
                  
                  {note.symptomCategory && (
                    <Badge className={CATEGORY_COLORS[note.symptomCategory]}>
                      {note.symptomCategory.toUpperCase()}
                    </Badge>
                  )}
                </div>
              </div>
              
              <div className="flex flex-col gap-2">
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => onAddFollowUpNote?.(note)}
                >
                  Add Note
                </Button>
                <Button 
                  size="sm"
                  onClick={() => handleMarkComplete(note)}
                >
                  <Check className="h-4 w-4 mr-1" />
                  Complete
                </Button>
                <Button 
                  size="sm" 
                  variant="destructive"
                  onClick={() => handleEscalate(note)}
                >
                  Escalate
                </Button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default FollowUpWorklist;