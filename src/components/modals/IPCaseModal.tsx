import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { loadDB, saveDB, addAudit, getActiveResidents } from '@/lib/database';
import { IPCase, Resident } from '@/lib/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { todayISO, toLocalISODate } from '@/lib/parsers';
import PillInput from '@/components/ui/pill-input';
import { recordWorkflowMetric } from '@/lib/analytics/workflowMetrics';

interface IPCaseModalProps {
  open: boolean;
  onClose: () => void;
  onSave: () => void;
  editCase?: IPCase | null;
}

const NHSN_PATHOGEN_CODES = [
  { value: '', label: '—' },
  { value: 'MRSA', label: 'MRSA' },
  { value: 'VRE', label: 'VRE' },
  { value: 'CDIFF', label: 'C. difficile' },
  { value: 'CRE', label: 'CRE' },
  { value: 'ESBL', label: 'ESBL' },
  { value: 'MSSA', label: 'MSSA' },
  { value: 'OTHER', label: 'Other' },
];

const PRECAUTION_TYPES = [
  { value: '', label: '—' },
  { value: 'Standard Precautions', label: 'Standard Precautions' },
  { value: 'EBP', label: 'Enhanced Barrier Precautions (EBP)' },
  { value: 'Isolation', label: 'Transmission-Based Precautions' },
];

const ISOLATION_TYPES = [
  { value: '', label: '—' },
  { value: 'Contact', label: 'Contact' },
  { value: 'Droplet', label: 'Droplet' },
  { value: 'Airborne', label: 'Airborne' },
  { value: 'Contact+Droplet', label: 'Contact + Droplet' },
];

const VACCINE_STATUS_OPTIONS = [
  { value: '', label: '—' },
  { value: 'up_to_date', label: 'Up to Date' },
  { value: 'incomplete', label: 'Incomplete' },
  { value: 'declined', label: 'Declined' },
  { value: 'unknown', label: 'Unknown' },
];

const COMMON_AREAS = ['Dining', 'Rehab gym', 'Beauty shop'];
const SHARED_EQUIPMENT = ['Lift', 'Shower chair', 'Therapy gym'];

const getRecommendedPPE = (
  precaution: '' | 'Standard Precautions' | 'EBP' | 'Isolation',
  isolation: '' | 'Contact' | 'Droplet' | 'Airborne' | 'Contact+Droplet',
): string => {
  if (precaution === 'Standard Precautions') return 'Gloves, Gown (as needed)';
  if (precaution === 'EBP') return 'Gloves, Gown for high-contact activities';
  if (precaution === 'Isolation') {
    if (isolation === 'Contact') return 'Gloves, Gown';
    if (isolation === 'Droplet') return 'Gloves, Gown, Mask';
    if (isolation === 'Airborne') return 'Gloves, Gown, N95 Respirator';
    if (isolation === 'Contact+Droplet') return 'Gloves, Gown, Mask, Eye Protection';
  }
  return '';
};

const IPCaseModal = ({ open, onClose, onSave, editCase }: IPCaseModalProps) => {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedResident, setSelectedResident] = useState<Resident | null>(null);
  const [ppeManuallyEdited, setPpeManuallyEdited] = useState(false);
  
  const [formData, setFormData] = useState({
    residentName: '',
    mrn: '',
    dob: '',
    room: '',
    unit: '',
    censusStatus: '',
    precautionType: '' as '' | 'Standard Precautions' | 'EBP' | 'Isolation',
    isolationType: '' as '' | 'Contact' | 'Droplet' | 'Airborne' | 'Contact+Droplet',
    onsetDate: '',
    resolutionDate: '',
    status: 'Active' as 'Active' | 'Resolved' | 'Discharged',
    sourceConditions: [] as string[],
    pathogenResistances: [] as string[],
    nhsnPathogenCode: '',
    vaccineStatus: '',
    requiredPPE: '',
    staffAssignments: '',
    closeContacts: '',
    commonAreasVisited: [] as string[],
    sharedEquipment: [] as string[],
    otherEquipment: '',
    notes: '',
  });

  const db = loadDB();
  const residents = getActiveResidents(db);

  // Filter residents based on search
  const filteredResidents = residents.filter(r => 
    r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.mrn.includes(searchTerm)
  );


  useEffect(() => {
    if (!open) return;
    recordWorkflowMetric({
      eventName: 'workflow_modal_open',
      view: 'ip',
      mrn: editCase?.mrn,
      metadata: { caseType: 'ip', mode: editCase ? 'edit' : 'create' },
    });
  }, [open, editCase?.mrn]);

  useEffect(() => {
    if (editCase) {
      const resident = db.census.residentsByMrn[editCase.mrn];
      if (resident) setSelectedResident(resident);
      setSearchTerm(editCase.residentName || editCase.name || resident?.name || '');
      
      setPpeManuallyEdited(false);
      setFormData({
        residentName: editCase.residentName || editCase.name || '',
        mrn: editCase.mrn,
        dob: resident?.dob || editCase.dob || '',
        room: editCase.room,
        unit: editCase.unit,
        censusStatus: resident?.status || 'Active',
        precautionType: editCase.protocol || '',
        isolationType: (editCase.isolationType || editCase.isolation_type || '') as any,
        onsetDate: editCase.onsetDate || editCase.onset_date || '',
        resolutionDate: editCase.resolutionDate || editCase.resolution_date || '',
        status: editCase.status,
        sourceConditions: (editCase.sourceOfInfection || editCase.source_of_infection || '').split(',').map(v => v.trim()).filter(Boolean),
        pathogenResistances: (editCase.infectionType || editCase.infection_type || '').split(',').map(v => v.trim()).filter(Boolean),
        nhsnPathogenCode: editCase.nhsnPathogenCode || '',
        vaccineStatus: editCase.vaccineStatus || '',
        requiredPPE: editCase.requiredPPE || '',
        staffAssignments: editCase.staffAssignments || '',
        closeContacts: editCase.closeContacts || '',
        commonAreasVisited: editCase.commonAreasVisited || [],
        sharedEquipment: editCase.sharedEquipment || [],
        otherEquipment: editCase.otherEquipment || '',
        notes: editCase.notes || '',
      });
    } else {
      resetForm();
    }
  }, [editCase, open]);

  const resetForm = () => {
    setSelectedResident(null);
    setSearchTerm('');
    setPpeManuallyEdited(false);
    setFormData({
      residentName: '',
      mrn: '',
      dob: '',
      room: '',
      unit: '',
      censusStatus: '',
      precautionType: '',
      isolationType: '',
      onsetDate: todayISO(),
      resolutionDate: '',
      status: 'Active',
      sourceConditions: [],
      pathogenResistances: [],
      nhsnPathogenCode: '',
      vaccineStatus: '',
      requiredPPE: '',
      staffAssignments: '',
      closeContacts: '',
      commonAreasVisited: [],
      sharedEquipment: [],
      otherEquipment: '',
      notes: '',
    });
  };

  const handleResidentSelect = (resident: Resident) => {
    recordWorkflowMetric({
      eventName: 'workflow_resident_selected',
      view: 'ip',
      residentId: resident.residentId || resident.id,
      mrn: resident.mrn,
      metadata: { caseType: 'ip' },
    });
    setSelectedResident(resident);
    setSearchTerm(resident.name);
    
    // Auto-detect unit from room number
    let detectedUnit = resident.unit;
    if (!detectedUnit && resident.room) {
      if (resident.room.startsWith('2')) detectedUnit = 'Unit 2';
      else if (resident.room.startsWith('3')) detectedUnit = 'Unit 3';
      else if (resident.room.startsWith('4')) detectedUnit = 'Unit 4';
    }
    
    setFormData(prev => ({
      ...prev,
      residentName: resident.name,
      mrn: resident.mrn,
      dob: resident.dob || '',
      room: resident.room,
      unit: detectedUnit,
      censusStatus: resident.status || 'Active',
    }));
  };

  const applyPPERules = () => {
    const ppe = getRecommendedPPE(formData.precautionType, formData.isolationType);
    setPpeManuallyEdited(false);
    setFormData(prev => ({ ...prev, requiredPPE: ppe }));
    toast({ title: 'PPE Rules Applied', description: ppe || 'No specific PPE requirements' });
  };

  useEffect(() => {
    if (!open || ppeManuallyEdited) return;
    const ppe = getRecommendedPPE(formData.precautionType, formData.isolationType);
    setFormData(prev => (prev.requiredPPE === ppe ? prev : { ...prev, requiredPPE: ppe }));
  }, [formData.precautionType, formData.isolationType, open, ppeManuallyEdited]);

  const handleSubmit = () => {
    if (!formData.mrn) {
      toast({
        title: 'Missing required fields',
        description: 'Please select a resident.',
        variant: 'destructive'
      });
      return;
    }

    const protocol = formData.precautionType || 'Standard Precautions';
    
    const caseData: IPCase = {
      id: editCase?.id || editCase?.record_id || `ip_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      record_id: editCase?.record_id || editCase?.id || `ip_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      mrn: formData.mrn,
      residentName: formData.residentName,
      name: formData.residentName,
      unit: formData.unit,
      room: formData.room,
      infectionType: formData.pathogenResistances.join(', '),
      infection_type: formData.pathogenResistances.join(', '),
      protocol: protocol as 'EBP' | 'Isolation' | 'Standard Precautions',
      isolationType: formData.isolationType as any,
      isolation_type: formData.isolationType,
      sourceOfInfection: formData.sourceConditions.join(', '),
      source_of_infection: formData.sourceConditions.join(', '),
      dob: formData.dob,
      onsetDate: formData.onsetDate,
      onset_date: formData.onsetDate,
      resolutionDate: formData.resolutionDate,
      resolution_date: formData.resolutionDate,
      status: formData.status,
      notes: formData.notes,
      requiredPPE: formData.requiredPPE,
      staffAssignments: formData.staffAssignments,
      closeContacts: formData.closeContacts,
      commonAreasVisited: formData.commonAreasVisited,
      sharedEquipment: formData.sharedEquipment,
      otherEquipment: formData.otherEquipment,
      nhsnPathogenCode: formData.nhsnPathogenCode,
      vaccineStatus: formData.vaccineStatus,
      createdAt: editCase?.createdAt || new Date().toISOString(),
    };

    // Calculate next review date
    const reviewDays = protocol === 'EBP' 
      ? db.settings.ipRules?.ebpReviewDays || 7
      : db.settings.ipRules?.isolationReviewDays || 3;
    
    const nextReview = new Date();
    nextReview.setDate(nextReview.getDate() + reviewDays);
    caseData.nextReviewDate = toLocalISODate(nextReview);
    caseData.next_review_date = caseData.nextReviewDate;

    if (editCase) {
      const idx = db.records.ip_cases.findIndex((c) => {
        if (editCase.id && c.id === editCase.id) return true;
        return !!editCase.record_id && c.record_id === editCase.record_id;
      });
      if (idx >= 0) {
        db.records.ip_cases[idx] = caseData;
        addAudit(db, 'ip_update', `Updated IP case for ${formData.residentName}`, 'ip');
      } else {
        // Imported rows may only have `record_id`; ensure updates persist by upserting.
        db.records.ip_cases.push(caseData);
        addAudit(db, 'ip_update', `Updated IP case for ${formData.residentName}`, 'ip');
      }
    } else {
      db.records.ip_cases.push(caseData);
      addAudit(db, 'ip_add', `Added IP case: ${formData.pathogenResistances.join(', ') || 'Unknown'} for ${formData.residentName}`, 'ip');
    }
    
    saveDB(db);

    recordWorkflowMetric({
      eventName: 'workflow_save_success',
      view: 'ip',
      residentId: selectedResident?.residentId || selectedResident?.id,
      mrn: formData.mrn,
      metadata: { caseType: 'ip', mode: editCase ? 'edit' : 'create' },
    });

    toast({
      title: editCase ? 'IP Case Updated' : 'IP Case Added',
      description: `Case ${editCase ? 'updated' : 'added'} for ${formData.residentName}`
    });

    resetForm();
    onSave();
    onClose();
  };

  const handleDelete = () => {
    if (!editCase) return;
    
    if (!window.confirm('Are you sure you want to delete this IP case?')) return;
    
    const idx = db.records.ip_cases.findIndex(c => c.id === editCase.id);
    if (idx >= 0) {
      db.records.ip_cases.splice(idx, 1);
      addAudit(db, 'ip_delete', `Deleted IP case for ${editCase.residentName || editCase.name}`, 'ip');
      saveDB(db);


      toast({ title: 'IP Case Deleted' });
      onSave();
      onClose();
    }
  };

  const toggleArrayItem = (arr: string[], item: string) => {
    return arr.includes(item) ? arr.filter(i => i !== item) : [...arr, item];
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[90vh] max-h-[90vh] p-0 overflow-hidden flex flex-col">
        <DialogHeader className="px-6 pt-6 pb-2 flex-shrink-0">
          <DialogTitle>{editCase ? 'Edit Case' : 'Add Case'}</DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0 px-6 pb-6">
          <div className="space-y-6">
            {/* Row 1: Resident Name, MRN, DOB, Room */}
            <div className="grid grid-cols-4 gap-4">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-primary">Resident Name</Label>
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
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-primary">MRN</Label>
                <Input 
                  placeholder="MRN"
                  value={formData.mrn}
                  onChange={(e) => setFormData(p => ({ ...p, mrn: e.target.value }))}
                  className="text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-primary">DOB</Label>
                <Input 
                  placeholder="MM/DD/YYYY"
                  value={formData.dob}
                  onChange={(e) => setFormData(p => ({ ...p, dob: e.target.value }))}
                  className="text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-primary">Room</Label>
                <Input 
                  placeholder="e.g., 250-A"
                  value={formData.room}
                  onChange={(e) => setFormData(p => ({ ...p, room: e.target.value }))}
                  className="text-sm"
                />
              </div>
            </div>

            {/* Row 2: Unit, Census Status, Precaution Type, Isolation Type */}
            <div className="grid grid-cols-4 gap-4">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-primary">Unit</Label>
                <Select value={formData.unit} onValueChange={(v) => setFormData(p => ({ ...p, unit: v }))}>
                  <SelectTrigger className="text-sm">
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Unit 2">Unit 2</SelectItem>
                    <SelectItem value="Unit 3">Unit 3</SelectItem>
                    <SelectItem value="Unit 4">Unit 4</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground">Auto-detect from room starts with 2/3/4 if blank.</p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-primary">Census Status</Label>
                <Input 
                  placeholder="Active / Hold / etc."
                  value={formData.censusStatus}
                  onChange={(e) => setFormData(p => ({ ...p, censusStatus: e.target.value }))}
                  className="text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-primary">Precaution Type</Label>
                <Select value={formData.precautionType} onValueChange={(v: any) => setFormData(p => ({ ...p, precautionType: v }))}>
                  <SelectTrigger className="text-sm">
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    {PRECAUTION_TYPES.map(pt => (
                      <SelectItem key={pt.value} value={pt.value || 'none'}>{pt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-primary">Isolation Type (if Isolation)</Label>
                <Select value={formData.isolationType} onValueChange={(v: any) => setFormData(p => ({ ...p, isolationType: v }))}>
                  <SelectTrigger className="text-sm">
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    {ISOLATION_TYPES.map(it => (
                      <SelectItem key={it.value} value={it.value || 'none'}>{it.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Row 3: Onset Date, Resolution Date, Status, Source Condition */}
            <div className="grid grid-cols-4 gap-4">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-primary">Onset Date</Label>
                <Input 
                  placeholder="YYYY-MM-DD or MM/DD/YYYY"
                  type="date"
                  value={formData.onsetDate}
                  onChange={(e) => setFormData(p => ({ ...p, onsetDate: e.target.value }))}
                  className="text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-primary">Resolution Date</Label>
                <Input 
                  placeholder="YYYY-MM-DD or MM/DD/YYYY"
                  type="date"
                  value={formData.resolutionDate}
                  onChange={(e) => setFormData(p => ({ ...p, resolutionDate: e.target.value }))}
                  className="text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-primary">Status</Label>
                <Select value={formData.status} onValueChange={(v: 'Active' | 'Resolved' | 'Discharged') => setFormData(p => ({ ...p, status: v }))}>
                  <SelectTrigger className="text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">ACTIVE</SelectItem>
                    <SelectItem value="Resolved">RESOLVED</SelectItem>
                    <SelectItem value="Discharged">DISCHARGED</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-primary">Source Condition / Reason</Label>
                <PillInput
                  value={formData.sourceConditions}
                  onChange={(values) => setFormData((prev) => ({ ...prev, sourceConditions: values }))}
                  placeholder="Type and press Enter (e.g., COVID positive)"
                />
              </div>
            </div>

            {/* Row 4: Pathogen/Resistance, NHSN Code, Vaccine Status */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-primary">Pathogen / Resistance (free text)</Label>
                <PillInput
                  value={formData.pathogenResistances}
                  onChange={(values) => setFormData((prev) => ({ ...prev, pathogenResistances: values }))}
                  placeholder="Type and press Enter (e.g., MRSA)"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-primary">NHSN Pathogen Code</Label>
                <Select value={formData.nhsnPathogenCode} onValueChange={(v) => setFormData(p => ({ ...p, nhsnPathogenCode: v }))}>
                  <SelectTrigger className="text-sm">
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    {NHSN_PATHOGEN_CODES.map(code => (
                      <SelectItem key={code.value} value={code.value || 'none'}>{code.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-primary">Vaccine Status</Label>
                <Select value={formData.vaccineStatus} onValueChange={(v) => setFormData(p => ({ ...p, vaccineStatus: v }))}>
                  <SelectTrigger className="text-sm">
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    {VACCINE_STATUS_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value || 'none'}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Auto Required PPE Section */}
            <div className="border border-primary/30 rounded-lg p-4 bg-primary/5">
              <Label className="text-xs font-semibold text-primary">Auto Required PPE</Label>
              <p className="text-xs text-muted-foreground mb-2">Required PPE</p>
              <div className="flex gap-2">
                <Input 
                  placeholder="Auto-filled based on precaution rules"
                  value={formData.requiredPPE}
                  onChange={(e) => {
                    setPpeManuallyEdited(true);
                    setFormData(p => ({ ...p, requiredPPE: e.target.value }));
                  }}
                  className="text-sm flex-1"
                />
                <Button type="button" variant="outline" onClick={applyPPERules}>
                  Apply PPE Rules
                </Button>
              </div>
            </div>

            {/* Contact Tracing / Exposures Section */}
            <div className="border border-primary/30 rounded-lg p-4 bg-primary/5">
              <Label className="text-xs font-semibold text-primary mb-3 block">Contact Tracing / Exposures</Label>
              
              <div className="grid grid-cols-4 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Staff assignments (48h pre-onset)</Label>
                  <Textarea 
                    placeholder="One per line: Name/ID | last exposure date/time | PPE lapse yes/no"
                    value={formData.staffAssignments}
                    onChange={(e) => setFormData(p => ({ ...p, staffAssignments: e.target.value }))}
                    className="text-sm h-20"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Close contacts</Label>
                  <Textarea 
                    placeholder="One per line: Resident room(s) + staff IDs"
                    value={formData.closeContacts}
                    onChange={(e) => setFormData(p => ({ ...p, closeContacts: e.target.value }))}
                    className="text-sm h-20"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Common areas visited</Label>
                  <div className="flex flex-wrap gap-3 mt-2">
                    {COMMON_AREAS.map(area => (
                      <div key={area} className="flex items-center gap-1.5">
                        <Checkbox 
                          id={`area-${area}`}
                          checked={formData.commonAreasVisited.includes(area)}
                          onCheckedChange={() => setFormData(p => ({ 
                            ...p, 
                            commonAreasVisited: toggleArrayItem(p.commonAreasVisited, area)
                          }))}
                        />
                        <label htmlFor={`area-${area}`} className="text-xs cursor-pointer">{area}</label>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Shared equipment</Label>
                  <div className="flex flex-wrap gap-3 mt-2">
                    {SHARED_EQUIPMENT.map(eq => (
                      <div key={eq} className="flex items-center gap-1.5">
                        <Checkbox 
                          id={`eq-${eq}`}
                          checked={formData.sharedEquipment.includes(eq)}
                          onCheckedChange={() => setFormData(p => ({ 
                            ...p, 
                            sharedEquipment: toggleArrayItem(p.sharedEquipment, eq)
                          }))}
                        />
                        <label htmlFor={`eq-${eq}`} className="text-xs cursor-pointer">{eq}</label>
                      </div>
                    ))}
                  </div>
                  <Input 
                    placeholder="Other equipment (free text)"
                    value={formData.otherEquipment}
                    onChange={(e) => setFormData(p => ({ ...p, otherEquipment: e.target.value }))}
                    className="text-sm mt-2"
                  />
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="flex justify-between items-center px-6 py-4 border-t">
          <div>
            {editCase && (
              <Button type="button" variant="destructive" onClick={handleDelete}>
                Delete Case
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

export default IPCaseModal;
