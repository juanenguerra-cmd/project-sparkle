import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { loadDB, saveDB, addAudit, getActiveResidents } from '@/lib/database';
import { ABTRecord, Resident } from '@/lib/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { computeTxDays, nowISO, isoDateFromAny } from '@/lib/parsers';

interface ABTCaseModalProps {
  open: boolean;
  onClose: () => void;
  onSave: () => void;
  editRecord?: ABTRecord | null;
}

const INFECTION_SOURCES = ['Urinary', 'Respiratory', 'GI', 'Skin/Soft Tissue', 'Bloodstream', 'Other'];
const ROUTES = ['PO', 'IV', 'IM', 'TOP', 'INH', 'PR', 'SL', 'TD'];
const FREQUENCIES = ['QD', 'BID', 'TID', 'QID', 'Q4H', 'Q6H', 'Q8H', 'Q12H', 'PRN', 'STAT', 'Other'];
const TIMEOUT_OUTCOMES = [
  { value: '', label: '— Select —' },
  { value: 'continue', label: 'Continue' },
  { value: 'change', label: 'Change' },
  { value: 'stop', label: 'Stop' },
];

const ABTCaseModal = ({ open, onClose, onSave, editRecord }: ABTCaseModalProps) => {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedResident, setSelectedResident] = useState<Resident | null>(null);
  
  const [formData, setFormData] = useState({
    mrn: '',
    residentName: '',
    unit: '',
    room: '',
    medication: '',
    dose: '',
    route: 'PO',
    frequency: '',
    indication: '',
    infectionSource: 'Other',
    startDate: '',
    endDate: '',
    plannedStopDate: '',
    status: 'active' as 'active' | 'completed' | 'discontinued',
    notes: '',
    // F881 Stewardship Fields
    prescriber: '',
    cultureCollected: false,
    cultureResult: '',
    cultureReviewedDate: '',
    timeoutReviewDate: '',
    timeoutOutcome: '' as '' | 'continue' | 'change' | 'stop',
    adverseEffects: '',
    stewardshipNotes: '',
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
        medication: editRecord.medication || editRecord.med_name || '',
        dose: editRecord.dose,
        route: editRecord.route || 'PO',
        frequency: editRecord.frequency || '',
        indication: editRecord.indication,
        infectionSource: editRecord.infection_source || 'Other',
        startDate: editRecord.startDate || editRecord.start_date || '',
        endDate: editRecord.endDate || editRecord.end_date || '',
        plannedStopDate: editRecord.plannedStopDate || '',
        status: editRecord.status,
        notes: editRecord.notes || '',
        prescriber: editRecord.prescriber || '',
        cultureCollected: editRecord.cultureCollected || false,
        cultureResult: editRecord.cultureResult || '',
        cultureReviewedDate: editRecord.cultureReviewedDate || '',
        timeoutReviewDate: editRecord.timeoutReviewDate || '',
        timeoutOutcome: editRecord.timeoutOutcome || '',
        adverseEffects: editRecord.adverseEffects || '',
        stewardshipNotes: editRecord.stewardshipNotes || '',
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
      medication: '',
      dose: '',
      route: 'PO',
      frequency: '',
      indication: '',
      infectionSource: 'Other',
      startDate: new Date().toISOString().slice(0, 10),
      endDate: '',
      plannedStopDate: '',
      status: 'active',
      notes: '',
      prescriber: '',
      cultureCollected: false,
      cultureResult: '',
      cultureReviewedDate: '',
      timeoutReviewDate: '',
      timeoutOutcome: '',
      adverseEffects: '',
      stewardshipNotes: '',
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
    // Hard-stop validation per F881 stewardship requirements
    if (!formData.mrn || !formData.medication) {
      toast({
        title: 'Missing required fields',
        description: 'Please select a resident and enter medication.',
        variant: 'destructive'
      });
      return;
    }

    if (!formData.indication) {
      toast({
        title: 'Missing indication',
        description: 'Per F881 requirements, indication is required for antibiotic stewardship.',
        variant: 'destructive'
      });
      return;
    }

    if (!formData.startDate) {
      toast({
        title: 'Missing start date',
        description: 'Start date is required.',
        variant: 'destructive'
      });
      return;
    }

    if (!formData.plannedStopDate && !formData.timeoutReviewDate) {
      toast({
        title: 'Missing stop date or timeout review',
        description: 'Per F881, either planned stop date OR timeout review date is required.',
        variant: 'destructive'
      });
      return;
    }

    const now = nowISO();
    const today = new Date().toISOString().slice(0, 10);
    const txDays = computeTxDays(formData.startDate, formData.endDate || today);
    const plannedStopDate = formData.endDate || formData.plannedStopDate;
    const normalizedStatus = formData.status === 'discontinued'
      ? 'discontinued'
      : (formData.endDate && isoDateFromAny(formData.endDate) < today ? 'completed' : 'active');
    
    const recordData: ABTRecord = {
      id: editRecord?.id || `abx_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      record_id: editRecord?.record_id || editRecord?.id || `abx_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      mrn: formData.mrn,
      residentName: formData.residentName,
      name: formData.residentName,
      unit: formData.unit,
      room: formData.room,
      medication: formData.medication,
      med_name: formData.medication,
      dose: formData.dose,
      route: formData.route,
      frequency: formData.frequency,
      indication: formData.indication,
      infection_source: formData.infectionSource,
      startDate: formData.startDate,
      start_date: formData.startDate,
      endDate: formData.endDate,
      end_date: formData.endDate,
      plannedStopDate,
      status: normalizedStatus,
      tx_days: txDays,
      daysOfTherapy: txDays,
      notes: formData.notes,
      // F881 Stewardship fields
      prescriber: formData.prescriber,
      cultureCollected: formData.cultureCollected,
      cultureResult: formData.cultureResult,
      cultureReviewedDate: formData.cultureReviewedDate,
      timeoutReviewDate: formData.timeoutReviewDate,
      timeoutOutcome: formData.timeoutOutcome || null,
      adverseEffects: formData.adverseEffects,
      stewardshipNotes: formData.stewardshipNotes,
      createdAt: editRecord?.createdAt || now,
      updated_at: now,
    };

    const currentDb = loadDB();

    if (editRecord) {
      const idx = currentDb.records.abx.findIndex(r => r.id === editRecord.id);
      if (idx >= 0) {
        currentDb.records.abx[idx] = recordData;
        addAudit(currentDb, 'abx_update', `Updated ABT record for ${formData.residentName}: ${formData.medication}`, 'abt');
      }
    } else {
      currentDb.records.abx.unshift(recordData);
      addAudit(currentDb, 'abx_add', `Added ABT record for ${formData.residentName}: ${formData.medication}`, 'abt');
    }
    
    saveDB(currentDb);

    toast({
      title: editRecord ? 'ABT Record Updated' : 'ABT Record Added',
      description: `${formData.medication} for ${formData.residentName}`
    });

    resetForm();
    onSave();
    onClose();
  };

  const handleDelete = () => {
    if (!editRecord) return;
    
    if (!window.confirm('Are you sure you want to delete this ABT record?')) return;
    
    const currentDb = loadDB();
    const idx = currentDb.records.abx.findIndex(r => r.id === editRecord.id);
    if (idx >= 0) {
      currentDb.records.abx.splice(idx, 1);
      addAudit(currentDb, 'abx_delete', `Deleted ABT record for ${editRecord.residentName || editRecord.name}`, 'abt');
      saveDB(currentDb);
      
      toast({ title: 'ABT Record Deleted' });
      onSave();
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0 overflow-hidden flex flex-col">
        <DialogHeader className="px-6 pt-6 pb-2 flex-shrink-0">
          <DialogTitle>{editRecord ? 'Edit ABT Record' : 'Add ABT Record'}</DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0 px-6">
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

            {/* Medication */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-primary">Medication *</Label>
              <Input 
                placeholder="e.g., Amoxicillin, Ciprofloxacin..."
                value={formData.medication}
                onChange={(e) => setFormData(p => ({ ...p, medication: e.target.value }))}
                className="text-sm"
              />
            </div>

            {/* Dose, Route, Frequency */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-primary">Dose</Label>
                <Input 
                  placeholder="e.g., 500mg"
                  value={formData.dose}
                  onChange={(e) => setFormData(p => ({ ...p, dose: e.target.value }))}
                  className="text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-primary">Route</Label>
                <Select value={formData.route} onValueChange={(v) => setFormData(p => ({ ...p, route: v }))}>
                  <SelectTrigger className="text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROUTES.map(r => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-primary">Frequency</Label>
                <Select value={formData.frequency} onValueChange={(v) => setFormData(p => ({ ...p, frequency: v }))}>
                  <SelectTrigger className="text-sm">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {FREQUENCIES.map(f => (
                      <SelectItem key={f} value={f}>{f}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Prescriber */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-primary">Prescriber</Label>
              <Input 
                placeholder="Ordering physician name"
                value={formData.prescriber}
                onChange={(e) => setFormData(p => ({ ...p, prescriber: e.target.value }))}
                className="text-sm"
              />
            </div>

            {/* Indication and Source */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-primary">Indication *</Label>
                <Input 
                  placeholder="e.g., UTI, Pneumonia..."
                  value={formData.indication}
                  onChange={(e) => setFormData(p => ({ ...p, indication: e.target.value }))}
                  className="text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-primary">Infection Source</Label>
                <Select value={formData.infectionSource} onValueChange={(v) => setFormData(p => ({ ...p, infectionSource: v }))}>
                  <SelectTrigger className="text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INFECTION_SOURCES.map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-4 gap-4">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-primary">Start Date *</Label>
                <Input 
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData(p => ({ ...p, startDate: e.target.value }))}
                  className="text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-primary">Planned Stop Date *</Label>
                <Input 
                  type="date"
                  value={formData.plannedStopDate}
                  onChange={(e) => setFormData(p => ({ ...p, plannedStopDate: e.target.value }))}
                  className="text-sm"
                />
                <p className="text-[10px] text-muted-foreground">Or set Timeout Review</p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-primary">Actual End Date</Label>
                <Input 
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData(p => ({ ...p, endDate: e.target.value }))}
                  className="text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-primary">Status</Label>
                <Select value={formData.status} onValueChange={(v: 'active' | 'completed' | 'discontinued') => setFormData(p => ({ ...p, status: v }))}>
                  <SelectTrigger className="text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="discontinued">Discontinued</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Time-out Review (F881) */}
            <div className="p-3 border rounded-lg bg-muted/30">
              <p className="text-xs font-semibold text-primary mb-2">48-72h Time-out Review (F881)</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs">Timeout Review Date *</Label>
                  <Input 
                    type="date"
                    value={formData.timeoutReviewDate}
                    onChange={(e) => setFormData(p => ({ ...p, timeoutReviewDate: e.target.value }))}
                    className="text-sm"
                  />
                  <p className="text-[10px] text-muted-foreground">Required if no Planned Stop Date</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Timeout Outcome</Label>
                  <Select value={formData.timeoutOutcome} onValueChange={(v: '' | 'continue' | 'change' | 'stop') => setFormData(p => ({ ...p, timeoutOutcome: v }))}>
                    <SelectTrigger className="text-sm">
                      <SelectValue placeholder="— Select —" />
                    </SelectTrigger>
                    <SelectContent>
                      {TIMEOUT_OUTCOMES.map(o => (
                        <SelectItem key={o.value || 'none'} value={o.value || 'none'}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Culture Tracking */}
            <div className="p-3 border rounded-lg bg-muted/30">
              <p className="text-xs font-semibold text-primary mb-2">Culture Tracking</p>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1 flex items-center gap-2 pt-5">
                  <input 
                    type="checkbox"
                    checked={formData.cultureCollected}
                    onChange={(e) => setFormData(p => ({ ...p, cultureCollected: e.target.checked }))}
                    className="h-4 w-4"
                  />
                  <Label className="text-xs">Culture Collected</Label>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Culture Result</Label>
                  <Input 
                    placeholder="e.g., E. coli"
                    value={formData.cultureResult}
                    onChange={(e) => setFormData(p => ({ ...p, cultureResult: e.target.value }))}
                    className="text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Date Reviewed</Label>
                  <Input 
                    type="date"
                    value={formData.cultureReviewedDate}
                    onChange={(e) => setFormData(p => ({ ...p, cultureReviewedDate: e.target.value }))}
                    className="text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Adverse Effects */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-primary">Adverse Effects / C. diff Risk</Label>
              <Input 
                placeholder="Document any adverse reactions..."
                value={formData.adverseEffects}
                onChange={(e) => setFormData(p => ({ ...p, adverseEffects: e.target.value }))}
                className="text-sm"
              />
            </div>

            {/* Notes and Stewardship Communication */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-primary">Clinical Notes</Label>
                <Textarea 
                  placeholder="Additional notes..."
                  value={formData.notes}
                  onChange={(e) => setFormData(p => ({ ...p, notes: e.target.value }))}
                  className="text-sm h-20"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-primary">Stewardship Communication Log</Label>
                <Textarea 
                  placeholder="Provider/pharmacy communications..."
                  value={formData.stewardshipNotes}
                  onChange={(e) => setFormData(p => ({ ...p, stewardshipNotes: e.target.value }))}
                  className="text-sm h-20"
                />
              </div>
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

export default ABTCaseModal;
