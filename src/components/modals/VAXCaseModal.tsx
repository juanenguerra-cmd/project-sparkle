import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { loadDB, saveDB, addAudit, getActiveResidents } from '@/lib/database';
import { VaxRecord, Resident } from '@/lib/types';
import { nowISO, todayISO } from '@/lib/parsers';
import { getEducationScript } from '@/lib/vaccineEducationScripts';
import { recordWorkflowMetric } from '@/lib/analytics/workflowMetrics';
import { checkDuplicateVax, formatValidationErrors, validateVaxRecord } from '@/lib/validators';
import { createAuditLog } from '@/lib/audit';
import { normalizeVaccineName } from '@/lib/regulatory';
import { normalizeVaxRecordShape } from '@/lib/vaxRecordFields';

interface VAXCaseModalProps {
  open: boolean;
  onClose: () => void;
  onSave: () => void;
  editRecord?: VaxRecord | null;
}

const VACCINE_TYPES = ['Flu', 'COVID', 'Pneumo', 'RSV', 'Tdap', 'Shingles', 'Hep B', 'Other'];
const VAXCaseModal = ({ open, onClose, onSave, editRecord }: VAXCaseModalProps) => {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedResident, setSelectedResident] = useState<Resident | null>(null);
  
  const [formData, setFormData] = useState({
    mrn: '',
    residentName: '',
    unit: '',
    room: '',
    vaccine: 'Flu',
    dose: '',
    dateGiven: '',
    dueDate: '',
    status: 'due' as 'due' | 'given' | 'declined',
    notes: '',
    administrationSource: '' as '' | 'historical' | 'in_house',
  });

  const db = loadDB();
  const residents = getActiveResidents(db);

  const filteredResidents = residents.filter(r => 
    r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.mrn.includes(searchTerm)
  );


  useEffect(() => {
    if (!open) return;
    recordWorkflowMetric({
      eventName: 'workflow_modal_open',
      view: 'vax',
      mrn: editRecord?.mrn,
      metadata: { caseType: 'vax', mode: editRecord ? 'edit' : 'create' },
    });
  }, [open, editRecord?.mrn]);

  useEffect(() => {

    if (editRecord) {
      const resident = db.census.residentsByMrn[editRecord.mrn];
      if (resident) setSelectedResident(resident);
      
      setFormData({
        mrn: editRecord.mrn,
        residentName: editRecord.residentName || editRecord.name || '',
        unit: editRecord.unit,
        room: editRecord.room,
        vaccine: normalizeVaccineName(editRecord.vaccine || editRecord.vaccine_type || 'Flu'),
        dose: editRecord.dose || '',
        dateGiven: editRecord.dateGiven || editRecord.date_given || '',
        dueDate: editRecord.dueDate || editRecord.due_date || '',
        status: editRecord.status === 'overdue' ? 'due' : editRecord.status,
        notes: editRecord.notes || '',
        administrationSource: editRecord.administrationSource || (editRecord.status === 'given' ? 'historical' : ''),
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
      vaccine: 'Flu',
      dose: '',
      dateGiven: '',
      dueDate: '',
      status: 'due',
      notes: '',
      administrationSource: '',
    });
  };

  const isVaccinated = formData.status === 'given';
  const isDeclined = formData.status === 'declined';
  const isHistorical = isVaccinated && formData.administrationSource === 'historical';
  const isInHouse = isVaccinated && formData.administrationSource === 'in_house';
  const showDueDate = formData.status === 'due' || isInHouse;
  const educationNote = useMemo(() => {
    const residentName = formData.residentName || selectedResident?.name || 'Resident';
    const script = getEducationScript(formData.vaccine || 'Other');
    const date = todayISO();

    return `**${script.shortTitle} Provided**\n\nDate: ${date}\nResident: ${residentName}\n\n**Key Points Discussed:**\n${script.keyPoints.map(point => `• ${point}`).join('\n')}\n\n**Benefits:** ${script.benefitsStatement}\n\n**Risks Discussed:** ${script.riskStatement}\n\n---\nEducation documented per F883/F887 requirements.`;
  }, [formData.residentName, formData.vaccine, selectedResident?.name]);

  useEffect(() => {
    if (!isVaccinated) return;

    if (formData.administrationSource === 'in_house') {
      const today = todayISO();
      setFormData(prev => ({
        ...prev,
        dateGiven: prev.dateGiven || today,
        dueDate: prev.dueDate || today,
      }));
    }

    if (formData.administrationSource === 'historical' && formData.dueDate) {
      setFormData(prev => ({ ...prev, dueDate: '' }));
    }
  }, [formData.administrationSource, isVaccinated, formData.dueDate]);

  useEffect(() => {
    if (!isDeclined) return;

    const today = todayISO();
    setFormData(prev => ({
      ...prev,
      dateGiven: prev.dateGiven || today,
    }));
  }, [isDeclined]);

  const handleResidentSelect = (resident: Resident) => {
    recordWorkflowMetric({
      eventName: 'workflow_resident_selected',
      view: 'vax',
      residentId: resident.residentId || resident.id,
      mrn: resident.mrn,
      metadata: { caseType: 'vax' },
    });
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

    if (isVaccinated && !formData.administrationSource) {
      toast({
        title: 'Vaccination source required',
        description: 'Select Historical or In-House for vaccinated records.',
        variant: 'destructive'
      });
      return;
    }

    if (isHistorical && !formData.dateGiven) {
      toast({
        title: 'Date given required',
        description: 'Enter the historical vaccination date.',
        variant: 'destructive'
      });
      return;
    }

    if (isDeclined && !formData.dateGiven) {
      toast({
        title: 'Declined date required',
        description: 'Enter the date the vaccine was declined.',
        variant: 'destructive'
      });
      return;
    }

    const now = nowISO();
    
    const vaccineName = normalizeVaccineName(formData.vaccine);
    const recordData: VaxRecord = normalizeVaxRecordShape({
      id: editRecord?.id || editRecord?.record_id || `vax_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      record_id: editRecord?.record_id || editRecord?.id || `vax_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      residentId: selectedResident?.residentId || selectedResident?.id || editRecord?.residentId,
      mrn: formData.mrn,
      residentName: formData.residentName,
      name: formData.residentName,
      unit: formData.unit,
      room: formData.room,
      vaccine: vaccineName,
      vaccine_type: vaccineName,
      dose: formData.dose,
      dateGiven: isVaccinated || isDeclined ? formData.dateGiven : '',
      date_given: isVaccinated || isDeclined ? formData.dateGiven : '',
      dueDate: showDueDate ? formData.dueDate : '',
      due_date: showDueDate ? formData.dueDate : '',
      status: formData.status,
      notes: formData.notes,
      createdAt: editRecord?.createdAt || now,
      administrationSource: formData.administrationSource || undefined,
    }) as VaxRecord;

    const currentDb = loadDB();


    const validation = validateVaxRecord(recordData);
    if (!validation.valid) {
      toast({
        title: 'Validation Failed',
        description: formatValidationErrors(validation.errors),
        variant: 'destructive',
      });
      return;
    }

    if (recordData.status === 'given' && recordData.dateGiven) {
      const duplicate = checkDuplicateVax(recordData.mrn, recordData.vaccine, recordData.dateGiven, currentDb.records.vax, editRecord?.id);
      if (duplicate && !editRecord) {
        toast({
          title: 'Possible Duplicate',
          description: `${recordData.vaccine} already given on ${duplicate.dateGiven || duplicate.date_given}`,
        });
      }
    }

    if (editRecord) {
      const idx = currentDb.records.vax.findIndex((r) => {
        if (editRecord.id && r.id === editRecord.id) return true;
        return !!editRecord.record_id && r.record_id === editRecord.record_id;
      });
      if (idx >= 0) {
        currentDb.records.vax[idx] = recordData;
        addAudit(currentDb, 'vax_update', `Updated VAX record for ${formData.residentName}: ${formData.vaccine}`, 'vax');
      } else {
        // Imported rows may only have `record_id`; ensure updates persist by upserting.
        currentDb.records.vax.unshift(recordData);
        addAudit(currentDb, 'vax_update', `Updated VAX record for ${formData.residentName}: ${formData.vaccine}`, 'vax');
      }
    } else {
      currentDb.records.vax.unshift(recordData);
      addAudit(currentDb, 'vax_add', `Added VAX record for ${formData.residentName}: ${formData.vaccine}`, 'vax');
    }
    
    saveDB(currentDb);
    createAuditLog(editRecord ? 'update' : 'create', 'vax', recordData.id, formData.residentName);

    recordWorkflowMetric({
      eventName: 'workflow_save_success',
      view: 'vax',
      residentId: selectedResident?.residentId || selectedResident?.id,
      mrn: formData.mrn,
      metadata: { caseType: 'vax', mode: editRecord ? 'edit' : 'create' },
    });

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

  const handleCopyEducationNote = async () => {
    try {
      await navigator.clipboard.writeText(educationNote);
      toast({
        title: 'Education note copied',
        description: 'The education note is ready to paste into your progress note.',
      });
    } catch (error) {
      toast({
        title: 'Copy failed',
        description: 'Unable to copy the education note. Please copy it manually.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0 overflow-hidden flex flex-col">
        <DialogHeader className="px-6 pt-6 pb-2 flex-shrink-0">
          <DialogTitle>{editRecord ? 'Edit VAX Record' : 'Add VAX Record'}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-6">
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

            {/* Status */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-primary">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(v: 'due' | 'given' | 'declined') =>
                    setFormData(p => ({
                      ...p,
                      status: v,
                      administrationSource: v === 'given' ? p.administrationSource : '',
                      dateGiven: v === 'given' ? p.dateGiven : v === 'declined' ? (p.dateGiven || todayISO()) : '',
                      dueDate: v === 'due' ? p.dueDate : '',
                    }))
                  }
                >
                  <SelectTrigger className="text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="given">Vaccinated</SelectItem>
                    <SelectItem value="due">Due</SelectItem>
                    <SelectItem value="declined">Decline</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {isVaccinated && (
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <input
                    id="vax-source-historical"
                    type="checkbox"
                    className="h-4 w-4 rounded border-input text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    checked={formData.administrationSource === 'historical'}
                    onChange={() =>
                      setFormData(p => ({
                        ...p,
                        administrationSource: p.administrationSource === 'historical' ? '' : 'historical',
                      }))
                    }
                  />
                  <Label htmlFor="vax-source-historical" className="text-xs font-semibold text-primary">
                    Historical
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    id="vax-source-inhouse"
                    type="checkbox"
                    className="h-4 w-4 rounded border-input text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    checked={formData.administrationSource === 'in_house'}
                    onChange={() =>
                      setFormData(p => ({
                        ...p,
                        administrationSource: p.administrationSource === 'in_house' ? '' : 'in_house',
                      }))
                    }
                  />
                  <Label htmlFor="vax-source-inhouse" className="text-xs font-semibold text-primary">
                    In-House
                  </Label>
                </div>
              </div>
            )}

            {(isHistorical || showDueDate || isDeclined) && (
              <div className="grid grid-cols-2 gap-4">
                {isHistorical && (
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-primary">Date Given</Label>
                    <Input
                      type="date"
                      value={formData.dateGiven}
                      onChange={(e) => setFormData(p => ({ ...p, dateGiven: e.target.value }))}
                      className="text-sm"
                    />
                  </div>
                )}
                {showDueDate && (
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-primary">
                      Due Date{isInHouse ? ' (auto)' : ''}
                    </Label>
                    <Input
                      type="date"
                      value={formData.dueDate}
                      onChange={(e) => setFormData(p => ({ ...p, dueDate: e.target.value }))}
                      className="text-sm"
                      readOnly={isInHouse}
                    />
                  </div>
                )}
                {isDeclined && (
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-primary">Declined Date</Label>
                    <Input
                      type="date"
                      value={formData.dateGiven}
                      onChange={(e) => setFormData(p => ({ ...p, dateGiven: e.target.value }))}
                      className="text-sm"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Education Note */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-primary">Education Note (auto)</Label>
                <Button type="button" variant="outline" size="sm" onClick={handleCopyEducationNote}>
                  Copy
                </Button>
              </div>
              <Textarea
                value={educationNote}
                readOnly
                className="text-sm h-40"
              />
              <p className="text-xs text-muted-foreground">
                Auto-populated education documentation based on vaccine type.
              </p>
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
        </div>

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
