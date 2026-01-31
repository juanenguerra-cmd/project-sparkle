import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { loadDB, saveDB, addAudit, getActiveResidents } from '@/lib/database';
import { VaxRecord, Resident } from '@/lib/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { nowISO } from '@/lib/parsers';

interface VAXCaseModalProps {
  open: boolean;
  onClose: () => void;
  onSave: () => void;
  editRecord?: VaxRecord | null;
}

const VACCINE_TYPES = ['FLU', 'COVID', 'PNA', 'RSV', 'Tdap', 'Shingles', 'Hep B', 'Other'];
const STATUS_OPTIONS = ['due', 'given', 'overdue', 'declined'];

const VAXCaseModal = ({ open, onClose, onSave, editRecord }: VAXCaseModalProps) => {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedResident, setSelectedResident] = useState<Resident | null>(null);
  
  const [formData, setFormData] = useState({
    mrn: '',
    residentName: '',
    unit: '',
    room: '',
    vaccine: 'FLU',
    dose: '',
    dateGiven: '',
    dueDate: '',
    status: 'due' as 'due' | 'given' | 'overdue' | 'declined',
    notes: '',
  });

  const db = loadDB();
  const residents = getActiveResidents(db);

  const filteredResidents = residents.filter(r => 
    r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.mrn.includes(searchTerm)
  );

  useEffect(() => {
    if (editRecord) {
      const resident = db.census.residentsByMrn[editRecord.mrn];
      if (resident) setSelectedResident(resident);
      
      setFormData({
        mrn: editRecord.mrn,
        residentName: editRecord.residentName || editRecord.name || '',
        unit: editRecord.unit,
        room: editRecord.room,
        vaccine: editRecord.vaccine || editRecord.vaccine_type || 'FLU',
        dose: editRecord.dose || '',
        dateGiven: editRecord.dateGiven || editRecord.date_given || '',
        dueDate: editRecord.dueDate || editRecord.due_date || '',
        status: editRecord.status,
        notes: editRecord.notes || '',
      });
      setSearchTerm(editRecord.residentName || editRecord.name || '');
    } else {
      resetForm();
    }
  }, [editRecord, open]);

  const resetForm = () => {
    setSelectedResident(null);
    setSearchTerm('');
    setFormData({
      mrn: '',
      residentName: '',
      unit: '',
      room: '',
      vaccine: 'FLU',
      dose: '',
      dateGiven: '',
      dueDate: '',
      status: 'due',
      notes: '',
    });
  };

  const handleResidentSelect = (resident: Resident) => {
    setSelectedResident(resident);
    setSearchTerm(resident.name);
    setFormData(prev => ({
      ...prev,
      mrn: resident.mrn,
      residentName: resident.name,
      unit: resident.unit,
      room: resident.room,
    }));
  };

  const handleSubmit = () => {
    if (!formData.mrn || !formData.vaccine) {
      toast({
        title: 'Missing required fields',
        description: 'Please select a resident and vaccine type.',
        variant: 'destructive'
      });
      return;
    }

    const now = nowISO();
    
    const recordData: VaxRecord = {
      id: editRecord?.id || `vax_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      record_id: editRecord?.record_id || editRecord?.id || `vax_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      mrn: formData.mrn,
      residentName: formData.residentName,
      name: formData.residentName,
      unit: formData.unit,
      room: formData.room,
      vaccine: formData.vaccine,
      vaccine_type: formData.vaccine,
      dose: formData.dose,
      dateGiven: formData.dateGiven,
      date_given: formData.dateGiven,
      dueDate: formData.dueDate,
      due_date: formData.dueDate,
      status: formData.status,
      notes: formData.notes,
      createdAt: editRecord?.createdAt || now,
    };

    const currentDb = loadDB();

    if (editRecord) {
      const idx = currentDb.records.vax.findIndex(r => r.id === editRecord.id);
      if (idx >= 0) {
        currentDb.records.vax[idx] = recordData;
        addAudit(currentDb, 'vax_update', `Updated VAX record for ${formData.residentName}: ${formData.vaccine}`, 'vax');
      }
    } else {
      currentDb.records.vax.unshift(recordData);
      addAudit(currentDb, 'vax_add', `Added VAX record for ${formData.residentName}: ${formData.vaccine}`, 'vax');
    }
    
    saveDB(currentDb);

    toast({
      title: editRecord ? 'VAX Record Updated' : 'VAX Record Added',
      description: `${formData.vaccine} for ${formData.residentName}`
    });

    resetForm();
    onSave();
    onClose();
  };

  const handleDelete = () => {
    if (!editRecord) return;
    
    if (!window.confirm('Are you sure you want to delete this VAX record?')) return;
    
    const currentDb = loadDB();
    const idx = currentDb.records.vax.findIndex(r => r.id === editRecord.id);
    if (idx >= 0) {
      currentDb.records.vax.splice(idx, 1);
      addAudit(currentDb, 'vax_delete', `Deleted VAX record for ${editRecord.residentName || editRecord.name}`, 'vax');
      saveDB(currentDb);
      
      toast({ title: 'VAX Record Deleted' });
      onSave();
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle>{editRecord ? 'Edit VAX Record' : 'Add VAX Record'}</DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-120px)] px-6">
          <div className="space-y-4 pb-4">
            {/* Resident Selection */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-primary">Resident Name *</Label>
              <div className="relative">
                <Input 
                  placeholder="Start typing name or MRN..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    if (!e.target.value) setSelectedResident(null);
                  }}
                  className="text-sm"
                />
                {searchTerm && !selectedResident && filteredResidents.length > 0 && (
                  <div className="absolute z-10 w-full bg-popover border rounded-md shadow-lg mt-1 max-h-40 overflow-auto">
                    {filteredResidents.slice(0, 10).map(r => (
                      <button
                        key={r.mrn}
                        type="button"
                        className="w-full text-left px-3 py-2 hover:bg-accent text-sm"
                        onClick={() => handleResidentSelect(r)}
                      >
                        {r.name} ({r.mrn})
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* MRN and Unit/Room */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-primary">MRN</Label>
                <Input 
                  value={formData.mrn}
                  onChange={(e) => setFormData(p => ({ ...p, mrn: e.target.value }))}
                  className="text-sm"
                  readOnly={!!selectedResident}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-primary">Unit</Label>
                <Input 
                  value={formData.unit}
                  onChange={(e) => setFormData(p => ({ ...p, unit: e.target.value }))}
                  className="text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-primary">Room</Label>
                <Input 
                  value={formData.room}
                  onChange={(e) => setFormData(p => ({ ...p, room: e.target.value }))}
                  className="text-sm"
                />
              </div>
            </div>

            {/* Vaccine and Dose */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-primary">Vaccine *</Label>
                <Select value={formData.vaccine} onValueChange={(v) => setFormData(p => ({ ...p, vaccine: v }))}>
                  <SelectTrigger className="text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VACCINE_TYPES.map(v => (
                      <SelectItem key={v} value={v}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-primary">
                  {formData.vaccine === 'Other' ? 'Vaccine Name *' : 'Dose'}
                </Label>
                <Input 
                  placeholder={formData.vaccine === 'Other' ? 'Enter vaccine name...' : 'e.g., 0.5mL, Dose 1, Booster...'}
                  value={formData.dose}
                  onChange={(e) => setFormData(p => ({ ...p, dose: e.target.value }))}
                  className="text-sm"
                />
              </div>
            </div>

            {/* Dates and Status */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-primary">Date Given</Label>
                <Input 
                  type="date"
                  value={formData.dateGiven}
                  onChange={(e) => setFormData(p => ({ ...p, dateGiven: e.target.value }))}
                  className="text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-primary">Due Date</Label>
                <Input 
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => setFormData(p => ({ ...p, dueDate: e.target.value }))}
                  className="text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-primary">Status</Label>
                <Select value={formData.status} onValueChange={(v: 'due' | 'given' | 'overdue' | 'declined') => setFormData(p => ({ ...p, status: v }))}>
                  <SelectTrigger className="text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="due">Due</SelectItem>
                    <SelectItem value="given">Given</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
                    <SelectItem value="declined">Declined</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-primary">Notes</Label>
              <Textarea 
                placeholder="Additional notes..."
                value={formData.notes}
                onChange={(e) => setFormData(p => ({ ...p, notes: e.target.value }))}
                className="text-sm h-20"
              />
            </div>
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="flex justify-between items-center px-6 py-4 border-t">
          <div>
            {editRecord && (
              <Button type="button" variant="destructive" onClick={handleDelete}>
                Delete Record
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="button" onClick={handleSubmit}>Save</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default VAXCaseModal;
