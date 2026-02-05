import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { loadDB, saveDB, addAudit, getActiveResidents } from '@/lib/database';
import { VaxRecord } from '@/lib/types';
import { todayISO } from '@/lib/parsers';

interface VAXImportModalProps {
  open: boolean;
  onClose: () => void;
  onImport: () => void;
}

const VACCINE_TYPES = ['FLU', 'COVID', 'PNA', 'TDAP', 'HEP-B', 'SHINGRIX', 'OTHER'];

const VAXImportModal = ({ open, onClose, onImport }: VAXImportModalProps) => {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    mrn: '',
    vaccine: 'FLU',
    dose: '',
    status: 'due' as 'given' | 'due' | 'declined',
    dateGiven: '',
    dueDate: todayISO(),
    notes: ''
  });

  const db = loadDB();
  const residents = getActiveResidents(db);

  const handleSubmit = () => {
    if (!formData.mrn || !formData.vaccine) {
      toast({
        title: 'Missing required fields',
        description: 'Please select a resident and vaccine type.',
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

    const newRecord: VaxRecord = {
      id: `vax_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      record_id: `vax_${formData.mrn}_${formData.vaccine}`,
      mrn: formData.mrn,
      residentName: resident.name,
      name: resident.name,
      unit: resident.unit,
      room: resident.room,
      vaccine: formData.vaccine,
      vaccine_type: formData.vaccine,
      dose: formData.dose,
      status: formData.status,
      dateGiven: formData.status === 'given' ? formData.dateGiven || todayISO() : undefined,
      date_given: formData.status === 'given' ? formData.dateGiven || todayISO() : undefined,
      dueDate: formData.dueDate,
      due_date: formData.dueDate,
      notes: formData.notes,
      createdAt: new Date().toISOString()
    };

    db.records.vax.push(newRecord);
    addAudit(db, 'vax_add', `Added ${formData.vaccine} record for ${resident.name}`, 'vax');
    saveDB(db);

    toast({
      title: 'VAX Record Added',
      description: `${formData.vaccine} record added for ${resident.name}`
    });

    // Reset form
    setFormData({
      mrn: '',
      vaccine: 'FLU',
      dose: '',
      status: 'due',
      dateGiven: '',
      dueDate: todayISO(),
      notes: ''
    });

    onImport();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Add Vaccination Record</DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Vaccine Type *</Label>
              <Select value={formData.vaccine} onValueChange={(v) => setFormData(p => ({ ...p, vaccine: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VACCINE_TYPES.map(v => (
                    <SelectItem key={v} value={v}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Dose</Label>
              <Input 
                placeholder="e.g., 1st, 2nd, Booster..."
                value={formData.dose}
                onChange={(e) => setFormData(p => ({ ...p, dose: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select 
                value={formData.status} 
                onValueChange={(v: 'given' | 'due' | 'declined') => setFormData(p => ({ ...p, status: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="due">Due</SelectItem>
                  <SelectItem value="given">Vaccinated</SelectItem>
                  <SelectItem value="declined">Decline</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{formData.status === 'given' ? 'Date Given' : 'Due Date'}</Label>
              <Input 
                type="date"
                value={formData.status === 'given' ? formData.dateGiven : formData.dueDate}
                onChange={(e) => setFormData(p => ({ 
                  ...p, 
                  [formData.status === 'given' ? 'dateGiven' : 'dueDate']: e.target.value 
                }))}
              />
            </div>
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
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit}>Add Record</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default VAXImportModal;
