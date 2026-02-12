import { useEffect, useState } from 'react';
import { Copy, FileText } from 'lucide-react';
import { toast as sonnerToast } from 'sonner';

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { VaxRecord } from '@/lib/types';
import { todayISO } from '@/lib/parsers';
import { generateReofferProgressNote } from '@/lib/vaccineEducationScripts';

export type ReofferActionOutcome = 'consented' | 'declined';
export type ReofferActionDecisionMaker = 'resident' | 'family';

export interface ReofferActionValues {
  outcome: ReofferActionOutcome;
  decisionMaker: ReofferActionDecisionMaker;
  encounterDate: string;
  generatedNote: string;
}

interface ReofferActionModalProps {
  open: boolean;
  record: VaxRecord | null;
  onClose: () => void;
  onSubmit: (values: ReofferActionValues) => void;
}

const ReofferActionModal = ({ open, record, onClose, onSubmit }: ReofferActionModalProps) => {
  const [outcome, setOutcome] = useState<ReofferActionOutcome>('declined');
  const [decisionMaker, setDecisionMaker] = useState<ReofferActionDecisionMaker>('resident');
  const [administerDate, setAdministerDate] = useState(todayISO());
  const [generatedNote, setGeneratedNote] = useState('');

  useEffect(() => {
    if (!open) return;
    setOutcome('declined');
    setDecisionMaker('resident');
    setAdministerDate(todayISO());
  }, [open]);

  const residentName = record?.residentName || record?.name || 'Resident';
  const vaccineType = record?.vaccine || record?.vaccine_type || 'Vaccine';

  useEffect(() => {
    if (!open || !record) return;

    const encounterDate = outcome === 'consented' ? administerDate : todayISO();
    setGeneratedNote(
      generateReofferProgressNote(vaccineType, residentName, encounterDate, decisionMaker, outcome),
    );
  }, [administerDate, decisionMaker, open, outcome, record, residentName, vaccineType]);

  if (!record) return null;

  const handleSubmit = () => {
    const encounterDate = outcome === 'consented' ? administerDate : todayISO();
    onSubmit({ outcome, decisionMaker, encounterDate, generatedNote });
    onClose();
  };

  const handleCopyNote = async () => {
    await navigator.clipboard.writeText(generatedNote);
    sonnerToast.success('Progress note copied to clipboard.', {
      description: 'Review and paste into your EMR if needed.',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Re-offer Action</DialogTitle>
          <DialogDescription>
            Document the re-offer decision for {residentName} ({vaccineType}) and auto-generate a vaccine education note.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="space-y-2 border rounded-lg p-4">
              <h3 className="text-sm font-semibold">Re-offer Documentation</h3>
              <div className="space-y-2">
                <Label>Decision Maker</Label>
                <Select value={decisionMaker} onValueChange={(v) => setDecisionMaker(v as ReofferActionDecisionMaker)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="resident">Resident</SelectItem>
                    <SelectItem value="family">Family / Responsible Party</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Decision</Label>
                <Select value={outcome} onValueChange={(v) => setOutcome(v as ReofferActionOutcome)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="consented">Consented to Vaccination</SelectItem>
                    <SelectItem value="declined">Declined Vaccination</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {outcome === 'consented' && (
                <div className="space-y-2">
                  <Label htmlFor="administer-date">Date to Administer</Label>
                  <Input
                    id="administer-date"
                    type="date"
                    value={administerDate}
                    onChange={(e) => setAdministerDate(e.target.value)}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="border rounded-lg p-4 bg-gray-50 sticky top-0">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Generated Progress Note
                </h3>
                <Button variant="outline" size="sm" onClick={handleCopyNote}>
                  <Copy className="w-4 h-4 mr-2" />
                  Copy
                </Button>
              </div>
              <Textarea
                value={generatedNote}
                onChange={(e) => setGeneratedNote(e.target.value)}
                className="font-mono text-xs min-h-[400px] bg-white"
              />
              <p className="text-xs text-muted-foreground mt-2">✏️ Note auto-updates as you change the decision. Edit before saving if needed.</p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="outline" onClick={handleCopyNote}>Copy Only</Button>
          <Button onClick={handleSubmit}>Generate Note & Apply</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ReofferActionModal;
