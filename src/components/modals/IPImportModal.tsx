import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { loadDB, saveDB, addAudit, getActiveResidents } from '@/lib/database';
import { IPCase } from '@/lib/types';

interface IPImportModalProps {
  open: boolean;
  onClose: () => void;
  onImport: () => void;
}

const IPImportModal = ({ open, onClose, onImport }: IPImportModalProps) => {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    mrn: '',
    infectionType: '',
    protocol: 'EBP' as 'EBP' | 'Isolation' | 'Standard Precautions',
    sourceOfInfection: '',
    onsetDate: new Date().toISOString().slice(0, 10),
    notes: ''
  });

  const db = loadDB();
  const residents = getActiveResidents(db);

  const handleSubmit = () => {
    if (!formData.mrn || !formData.infectionType) {
      toast({
        title: 'Missing required fields',
        description: 'Please select a resident and enter the infection type.',
        variant: 'destructive'
      });
      return;
    }

    const resident = db.census.residentsByMrn[formData.mrn];
    if (!resident) {
      toast({
        title: 'Resident not found',
        description: 'Please select a valid resident from the census.',
        variant: 'destructive'
      });
      return;
    }

    const newCase: IPCase = {
      id: `ip_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      mrn: formData.mrn,
      residentName: resident.name,
      name: resident.name,
      unit: resident.unit,
      room: resident.room,
      infectionType: formData.infectionType,
      infection_type: formData.infectionType,
      protocol: formData.protocol,
      sourceOfInfection: formData.sourceOfInfection,
      source_of_infection: formData.sourceOfInfection,
      onsetDate: formData.onsetDate,
      onset_date: formData.onsetDate,
      status: 'Active',
      notes: formData.notes,
      createdAt: new Date().toISOString()
    };

    // Calculate next review date based on protocol
    const reviewDays = formData.protocol === 'EBP' 
      ? db.settings.ipRules?.ebpReviewDays || 7
      : db.settings.ipRules?.isolationReviewDays || 3;
    
    const nextReview = new Date();
    nextReview.setDate(nextReview.getDate() + reviewDays);
    newCase.nextReviewDate = nextReview.toISOString().slice(0, 10);
    newCase.next_review_date = newCase.nextReviewDate;

    db.records.ip_cases.push(newCase);
    addAudit(db, 'ip_add', `Added IP case: ${formData.infectionType} for ${resident.name}`, 'ip');
    saveDB(db);

    toast({
      title: 'IP Case Added',
      description: `${formData.infectionType} case added for ${resident.name}`
    });

    // Reset form
    setFormData({
      mrn: '',
      infectionType: '',
      protocol: 'EBP',
      sourceOfInfection: '',
      onsetDate: new Date().toISOString().slice(0, 10),
      notes: ''
    });

    onImport();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add IP Case</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Resident *</Label>
            <Select value={formData.mrn} onValueChange={(v) => setFormData(p => ({ ...p, mrn: v }))}>
              <SelectTrigger>
                <SelectValue placeholder="Select resident..." />
              </SelectTrigger>
              <SelectContent>
                {residents.map(r => (
                  <SelectItem key={r.mrn} value={r.mrn}>
                    {r.name} ({r.unit}/{r.room})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Infection Type *</Label>
            <Input 
              placeholder="e.g., UTI, Pneumonia, C. diff, MRSA..."
              value={formData.infectionType}
              onChange={(e) => setFormData(p => ({ ...p, infectionType: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Protocol</Label>
              <Select 
                value={formData.protocol} 
                onValueChange={(v: 'EBP' | 'Isolation' | 'Standard Precautions') => setFormData(p => ({ ...p, protocol: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EBP">EBP</SelectItem>
                  <SelectItem value="Isolation">Isolation</SelectItem>
                  <SelectItem value="Standard Precautions">Standard Precautions</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Onset Date</Label>
              <Input 
                type="date"
                value={formData.onsetDate}
                onChange={(e) => setFormData(p => ({ ...p, onsetDate: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Source of Infection</Label>
            <Input 
              placeholder="e.g., Community, Facility, Healthcare-associated..."
              value={formData.sourceOfInfection}
              onChange={(e) => setFormData(p => ({ ...p, sourceOfInfection: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Input 
              placeholder="Additional notes..."
              value={formData.notes}
              onChange={(e) => setFormData(p => ({ ...p, notes: e.target.value }))}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit}>Add IP Case</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default IPImportModal;
