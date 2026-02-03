import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BookOpen, FileText, Check, X, Clock } from 'lucide-react';
import { VaxRecord } from '@/lib/types';
import { getEducationScript, generateEducationNote } from '@/lib/vaccineEducationScripts';
import { loadDB, saveDB, addAudit } from '@/lib/database';
import { useToast } from '@/hooks/use-toast';
import { todayISO } from '@/lib/parsers';

interface VaxEducationModalProps {
  open: boolean;
  onClose: () => void;
  record: VaxRecord | null;
  onSave: () => void;
}

const VaxEducationModal = ({ open, onClose, record, onSave }: VaxEducationModalProps) => {
  const { toast } = useToast();
  const [outcome, setOutcome] = useState<'accepted' | 'declined' | 'deferred'>('declined');
  const [addToNotes, setAddToNotes] = useState(true);
  const [additionalNotes, setAdditionalNotes] = useState('');

  if (!record) return null;

  const vaccineType = record.vaccine || record.vaccine_type || 'Other';
  const script = getEducationScript(vaccineType);
  const residentName = record.residentName || record.name || 'Unknown';
  const today = todayISO();

  const handleSave = () => {
    const db = loadDB();
    
    // Update VAX record with education tracking
    const idx = db.records.vax.findIndex(r => r.id === record.id);
    if (idx !== -1) {
      db.records.vax[idx].educationProvided = true;
      db.records.vax[idx].educationDate = today;
      db.records.vax[idx].educationOutcome = outcome;
      
      // If accepted, mark as given
      if (outcome === 'accepted') {
        db.records.vax[idx].status = 'given';
        db.records.vax[idx].dateGiven = today;
      }
      
      addAudit(db, 'vax_education', `Education provided for ${vaccineType} to ${residentName} - ${outcome}`, 'vax');
    }
    
    // Add to clinical notes if checked
    if (addToNotes) {
      const noteText = generateEducationNote(vaccineType, residentName, today, outcome) + 
        (additionalNotes ? `\n\n**Additional Notes:** ${additionalNotes}` : '');
      
      db.records.notes.push({
        id: `note_${Date.now()}_${Math.random().toString(16).slice(2)}`,
        mrn: record.mrn,
        residentName,
        name: residentName,
        unit: record.unit,
        room: record.room,
        category: 'Vaccination',
        text: noteText,
        createdAt: new Date().toISOString(),
        created_at: new Date().toISOString()
      });
      
      addAudit(db, 'note_add', `Vaccine education note added for ${residentName}`, 'notes');
    }
    
    saveDB(db);
    toast({
      title: 'Education Documented',
      description: outcome === 'accepted' 
        ? 'Vaccine marked as given' 
        : 'Education recorded, resident ' + outcome
    });
    onSave();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            Vaccine Education - {vaccineType}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0">
          <div className="space-y-6 p-1">
            {/* Resident Info */}
            <div className="p-3 bg-muted rounded-lg">
              <div className="font-medium">{residentName}</div>
              <div className="text-sm text-muted-foreground">
                {record.unit} / Room {record.room} • MRN: {record.mrn}
              </div>
            </div>

            {/* Education Script */}
            <div className="space-y-4">
              <h3 className="font-semibold text-sm uppercase text-muted-foreground">
                Education Talking Points
              </h3>
              
              <div className="p-4 border rounded-lg bg-card space-y-4">
                <div>
                  <Label className="text-sm font-medium">Key Points to Discuss:</Label>
                  <ul className="mt-2 space-y-1">
                    {script.keyPoints.map((point, i) => (
                      <li key={i} className="text-sm flex items-start gap-2">
                        <Check className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <Label className="text-sm font-medium text-success">Benefits:</Label>
                  <p className="text-sm mt-1">{script.benefitsStatement}</p>
                </div>

                <div>
                  <Label className="text-sm font-medium text-amber-600">Potential Side Effects:</Label>
                  <p className="text-sm mt-1">{script.riskStatement}</p>
                </div>

                <div className="pt-2 border-t">
                  <Label className="text-sm font-medium">Suggested Script:</Label>
                  <p className="text-sm mt-1 italic text-muted-foreground">
                    "{script.fullScript}"
                  </p>
                </div>
              </div>
            </div>

            {/* Outcome */}
            <div className="space-y-2">
              <Label>Outcome After Education</Label>
              <Select value={outcome} onValueChange={(v) => setOutcome(v as typeof outcome)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="accepted">
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-success" />
                      Accepted - Mark as Given
                    </div>
                  </SelectItem>
                  <SelectItem value="declined">
                    <div className="flex items-center gap-2">
                      <X className="w-4 h-4 text-destructive" />
                      Declined - Continue Re-offer Tracking
                    </div>
                  </SelectItem>
                  <SelectItem value="deferred">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-amber-500" />
                      Deferred - Will Follow Up
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Add to Notes */}
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="addToNotes" 
                checked={addToNotes}
                onCheckedChange={(checked) => setAddToNotes(!!checked)}
              />
              <Label htmlFor="addToNotes" className="flex items-center gap-2 cursor-pointer">
                <FileText className="w-4 h-4" />
                Auto-add education documentation to Notes
              </Label>
            </div>

            {/* Additional Notes */}
            <div className="space-y-2">
              <Label>Additional Notes (optional)</Label>
              <Textarea
                placeholder="Document any specific concerns discussed, family involvement, etc..."
                value={additionalNotes}
                onChange={(e) => setAdditionalNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave}>
            <BookOpen className="w-4 h-4 mr-2" />
            Document Education
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default VaxEducationModal;
