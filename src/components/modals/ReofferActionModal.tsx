import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { VaxRecord } from '@/lib/types';
import { todayISO } from '@/lib/parsers';

export type ReofferActionOutcome = 'consented' | 'declined';
export type ReofferActionDecisionMaker = 'resident' | 'family';

export interface ReofferActionValues {
  outcome: ReofferActionOutcome;
  decisionMaker: ReofferActionDecisionMaker;
  encounterDate: string;
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

  useEffect(() => {
    if (!open) return;
    setOutcome('declined');
    setDecisionMaker('resident');
    setAdministerDate(todayISO());
  }, [open]);

  if (!record) return null;

  const residentName = record.residentName || record.name || 'Resident';
  const vaccineType = record.vaccine || record.vaccine_type || 'Vaccine';

  const handleSubmit = () => {
    const encounterDate = outcome === 'consented' ? administerDate : todayISO();
    onSubmit({ outcome, decisionMaker, encounterDate });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Re-offer Action</DialogTitle>
          <DialogDescription>
            Document the re-offer decision for {residentName} ({vaccineType}) and auto-generate a vaccine education note.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
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

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit}>Generate Note & Apply</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ReofferActionModal;
