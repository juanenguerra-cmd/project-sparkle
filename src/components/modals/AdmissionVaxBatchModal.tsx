import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Copy, Syringe } from 'lucide-react';
import { addAudit, loadDB, saveDB } from '@/lib/database';
import { Resident, VaxRecord } from '@/lib/types';
import { nowISO, todayISO } from '@/lib/parsers';
import { useToast } from '@/hooks/use-toast';
import { toast as sonnerToast } from 'sonner';

interface VaxEntry {
  vaccine_type: 'Pneumococcal' | 'Influenza' | 'COVID-19' | 'RSV';
  status: 'given' | 'declined';
  dateGiven: string;
  lot: string;
  site: string;
  administered_by: string;
  decline_reason: string;
  manufacturer: string;
  dose_number: string;
}

interface AdmissionVaxBatchModalProps {
  open: boolean;
  onClose: () => void;
  onSave: () => void;
  resident: Resident;
}

const VACCINE_TYPES: VaxEntry['vaccine_type'][] = ['Pneumococcal', 'Influenza', 'COVID-19', 'RSV'];
const INJECTION_SITES = ['L Deltoid', 'R Deltoid', 'L Thigh', 'R Thigh', 'L Gluteal', 'R Gluteal'];

const buildDefaultVaccines = (): VaxEntry[] =>
  VACCINE_TYPES.map((type) => ({
    vaccine_type: type,
    status: 'declined',
    dateGiven: todayISO(),
    lot: '',
    site: 'R Deltoid',
    administered_by: '',
    decline_reason: '',
    manufacturer: '',
    dose_number: '1',
  }));

const AdmissionVaxBatchModal = ({ open, onClose, onSave, resident }: AdmissionVaxBatchModalProps) => {
  const { toast } = useToast();
  const [vaccines, setVaccines] = useState<VaxEntry[]>(buildDefaultVaccines());
  const [generatedNote, setGeneratedNote] = useState('');
  const [customNurse, setCustomNurse] = useState('');

  useEffect(() => {
    if (open) {
      setVaccines(buildDefaultVaccines());
      setCustomNurse('');
    }
  }, [open, resident.mrn]);

  const calculateAge = (dob: string): string => {
    if (!dob) return '[age]';
    try {
      const birth = new Date(dob);
      const today = new Date();
      let age = today.getFullYear() - birth.getFullYear();
      const monthDiff = today.getMonth() - birth.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        age -= 1;
      }
      return age.toString();
    } catch {
      return '[age]';
    }
  };

  const formatDate = (dateStr: string): string => {
    if (!dateStr) return '[date]';
    try {
      const date = new Date(`${dateStr}T00:00:00`);
      return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const formatDateTime = (date: Date): string =>
    date.toLocaleString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  const updateVaxField = (index: number, field: keyof VaxEntry, value: string) => {
    setVaccines((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleToggleStatus = (index: number, status: 'given' | 'declined') => {
    setVaccines((prev) => {
      const updated = [...prev];
      const next = { ...updated[index], status };
      if (status === 'given' && !next.administered_by && customNurse) {
        next.administered_by = customNurse;
      }
      updated[index] = next;
      return updated;
    });
  };

  const generated = useMemo(() => {
    const db = loadDB();
    const facilityName = db.settings.facilityName || '[Facility Name]';
    const age = calculateAge(resident.dob || '');
    const gender = resident.sex || 'resident';
    const admitSource = resident.notes || '[Hospital/Facility Name]';
    const admitDate = formatDate(resident.admitDate || todayISO());
    const activeIpCases = db.records.ip_cases.filter((ip) => ip.mrn === resident.mrn && String(ip.status || '').toLowerCase() === 'active');
    const activeAbx = db.records.abx.filter((abx) => abx.mrn === resident.mrn && String(abx.status || '').toLowerCase() === 'active');
    const hasIsolation = activeIpCases.some((ip) => String(ip.protocol || '').toLowerCase().includes('isolation'));
    const hasEbp = activeIpCases.some((ip) => String(ip.protocol || '').toLowerCase().includes('ebp'));
    const isolationStatus = hasIsolation ? 'on isolation precautions' : hasEbp ? 'on enhanced barrier precautions' : 'not on isolation precautions';
    const antibioticStatus = activeAbx.length > 0 ? 'currently on active antibiotic therapy' : 'not currently on antibiotics';

    const templateSettings = db.settings.admissionNoteTemplates || {};
    const isolationStatusLine = (templateSettings.isolationStatusLine || 'Current admission isolation status: {isolationStatus}.')
      .replace('{isolationStatus}', isolationStatus);
    const paperworkReviewLine = templateSettings.paperworkReviewLine || 'Resident admission paperwork was reviewed.';
    const antibioticStatusLine = (templateSettings.antibioticStatusLine || 'On admission, resident antibiotic status: {antibioticStatus}.')
      .replace('{antibioticStatus}', antibioticStatus);

    const givenVax = vaccines.filter((v) => v.status === 'given');
    const declinedVax = vaccines.filter((v) => v.status === 'declined');

    let note = `ADMISSION VACCINATION DOCUMENTATION\n\n${resident.name} is ${age !== '[age]' ? `a ${age} year old` : 'a'} ${gender} admitted to ${facilityName} from ${admitSource} on ${admitDate}.\n${isolationStatusLine}\n${paperworkReviewLine}\n${antibioticStatusLine}\n\nPer facility protocol and CMS F883/F887 requirements, resident was offered recommended vaccinations appropriate for long-term care admission. Education was provided regarding benefits, risks, contraindications, and alternatives for each vaccination. Resident/responsible party verbalized understanding.`;

    if (givenVax.length > 0) {
      note += '\n\nVACCINATIONS ADMINISTERED:';
      givenVax.forEach((v) => {
        note += `\n\n- ${v.vaccine_type}`;
        note += `\n  Date: ${formatDate(v.dateGiven)}`;
        note += `\n  Lot Number: ${v.lot || 'Not documented'}`;
        if (v.manufacturer) note += `\n  Manufacturer: ${v.manufacturer}`;
        note += `\n  Site: ${v.site}`;
        note += `\n  Administered by: ${v.administered_by || 'Licensed nurse'}`;
        if (v.dose_number) note += `\n  Dose: ${v.dose_number}`;
        note += '\n  No immediate adverse reactions observed.';
      });
    }

    if (declinedVax.length > 0) {
      note += '\n\nVACCINATIONS DECLINED:';
      declinedVax.forEach((v) => {
        note += `\n\n- ${v.vaccine_type}: Resident/responsible party declined at this time.`;
        if (v.decline_reason) note += `\n  Reason: ${v.decline_reason}`;
        note += '\n  Education provided. Resident aware of benefits and risks of declining. Will re-offer per facility policy.';
      });
    }

    note += '\n\nResident monitored per facility policy. No adverse reactions noted at time of documentation.';
    note += '\nDocumentation completed per F887 immunization requirements and facility infection prevention protocols.';
    note += '\n\nDocumented by: [Your Name/Credentials]';
    note += `\nDate/Time: ${formatDateTime(new Date())}`;
    return note;
  }, [resident, vaccines]);

  useEffect(() => {
    setGeneratedNote(generated);
  }, [generated]);

  const handleCopyNote = async () => {
    try {
      await navigator.clipboard.writeText(generatedNote);
      sonnerToast.success('Progress note copied to clipboard!', {
        description: 'Paste into your EMR documentation.',
      });
    } catch {
      sonnerToast.error('Unable to copy note. Please copy manually.');
    }
  };

  const handleSaveAll = () => {
    const givenVaccines = vaccines.filter((v) => v.status === 'given');
    if (givenVaccines.length === 0) {
      toast({
        title: 'No vaccinations recorded',
        description: 'Please mark at least one vaccine as given.',
        variant: 'destructive',
      });
      return;
    }

    for (const vax of givenVaccines) {
      if (!vax.dateGiven) {
        toast({ title: 'Missing date', description: `Please enter date given for ${vax.vaccine_type}`, variant: 'destructive' });
        return;
      }
      if (!vax.lot) {
        toast({
          title: 'Missing lot number',
          description: `Lot number required for ${vax.vaccine_type} per documentation standards`,
          variant: 'destructive',
        });
        return;
      }
    }

    const currentDb = loadDB();
    const now = nowISO();
    const newRecords: VaxRecord[] = vaccines.map((vax) => ({
      id: `vax_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      mrn: resident.mrn,
      residentName: resident.name,
      name: resident.name,
      unit: resident.unit,
      room: resident.room,
      vaccine: vax.vaccine_type,
      vaccine_type: vax.vaccine_type,
      status: vax.status,
      dateGiven: vax.status === 'given' ? vax.dateGiven : undefined,
      date_given: vax.status === 'given' ? vax.dateGiven : undefined,
      lot: vax.status === 'given' ? vax.lot : undefined,
      site: vax.status === 'given' ? vax.site : undefined,
      administered_by: vax.status === 'given' ? vax.administered_by : undefined,
      manufacturer: vax.status === 'given' ? vax.manufacturer : undefined,
      dose_number: vax.status === 'given' ? vax.dose_number : undefined,
      decline_reason: vax.status === 'declined' ? vax.decline_reason : undefined,
      notes: `Admission vaccination entry - ${vax.status}`,
      context: 'admission_screening',
      createdAt: now,
      updated_at: now,
    }));

    currentDb.records.vax = [...newRecords, ...currentDb.records.vax];

    const givenCount = vaccines.filter((v) => v.status === 'given').length;
    const declinedCount = vaccines.filter((v) => v.status === 'declined').length;
    addAudit(currentDb, 'vax_batch_add', `Admission vax batch for ${resident.name}: ${givenCount} given, ${declinedCount} declined`, 'vax');

    saveDB(currentDb);
    toast({ title: 'Vaccinations Recorded', description: `${vaccines.length} vaccination entries saved for ${resident.name}` });
    onSave();
    onClose();
  };

  const givenCount = vaccines.filter((v) => v.status === 'given').length;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Syringe className="w-5 h-5" />
            Admission Vaccination Batch Entry
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="text-sm">
              <strong className="text-base">{resident.name}</strong> | MRN: {resident.mrn} | Room: {resident.room} | Unit: {resident.unit} | Admitted: {formatDate(resident.admitDate || '')}
            </div>
          </div>

          <div className="border rounded-lg p-3 bg-muted/30">
            <Label className="text-sm font-semibold">Default Nurse/Administrator (applies to all Given vaccines)</Label>
            <Input
              placeholder="e.g., Jane Doe, RN"
              value={customNurse}
              onChange={(e) => {
                const nurse = e.target.value;
                setCustomNurse(nurse);
                setVaccines((prev) => prev.map((v) => (v.status === 'given' ? { ...v, administered_by: nurse } : v)));
              }}
              className="mt-2"
            />
          </div>

          <div className="border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="p-3 text-left font-semibold">Vaccine</th>
                    <th className="p-3 text-center font-semibold">Status *</th>
                    <th className="p-3 text-center font-semibold">Date Given *</th>
                    <th className="p-3 text-center font-semibold">Lot # *</th>
                    <th className="p-3 text-center font-semibold">Site *</th>
                    <th className="p-3 text-center font-semibold">Manufacturer</th>
                    <th className="p-3 text-left font-semibold">Decline Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {vaccines.map((vax, idx) => (
                    <tr key={vax.vaccine_type} className={`border-t ${vax.status === 'given' ? 'bg-green-50' : ''}`}>
                      <td className="p-3 font-medium">{vax.vaccine_type}</td>
                      <td className="p-3">
                        <Label className="sr-only" htmlFor={`vax-status-${idx}`}>{`${vax.vaccine_type} status`}</Label>
                        <Select value={vax.status} onValueChange={(val: 'given' | 'declined') => handleToggleStatus(idx, val)}>
                          <SelectTrigger id={`vax-status-${idx}`} className="w-32" title={`${vax.vaccine_type} status`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="given">✓ Given</SelectItem>
                            <SelectItem value="declined">✗ Declined</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-3">
                        {vax.status === 'given' && (
                          <Input
                            type="date"
                            aria-label={`${vax.vaccine_type} date given`}
                            value={vax.dateGiven}
                            onChange={(e) => updateVaxField(idx, 'dateGiven', e.target.value)}
                            className="w-40"
                          />
                        )}
                      </td>
                      <td className="p-3">
                        {vax.status === 'given' && (
                          <Input
                            placeholder="Lot #"
                            aria-label={`${vax.vaccine_type} lot number`}
                            value={vax.lot}
                            onChange={(e) => updateVaxField(idx, 'lot', e.target.value)}
                            className="w-32"
                          />
                        )}
                      </td>
                      <td className="p-3">
                        {vax.status === 'given' && (
                          <Select value={vax.site} onValueChange={(val) => updateVaxField(idx, 'site', val)}>
                            <SelectTrigger className="w-32" title={`${vax.vaccine_type} injection site`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {INJECTION_SITES.map((site) => (
                                <SelectItem key={site} value={site}>{site}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </td>
                      <td className="p-3">
                        {vax.status === 'given' && (
                          <Input
                            placeholder="Optional"
                            aria-label={`${vax.vaccine_type} manufacturer`}
                            value={vax.manufacturer}
                            onChange={(e) => updateVaxField(idx, 'manufacturer', e.target.value)}
                            className="w-32"
                          />
                        )}
                      </td>
                      <td className="p-3">
                        {vax.status === 'declined' && (
                          <Input
                            placeholder="Optional reason..."
                            aria-label={`${vax.vaccine_type} decline reason`}
                            value={vax.decline_reason}
                            onChange={(e) => updateVaxField(idx, 'decline_reason', e.target.value)}
                            className="w-full"
                          />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="border rounded-lg p-4 bg-gray-50">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Auto-Generated Progress Note for EMR</h3>
              <Button variant="outline" size="sm" onClick={handleCopyNote} title="Copy note to clipboard">
                <Copy className="w-4 h-4 mr-2" />
                Copy to Clipboard
              </Button>
            </div>
            <Textarea
              value={generatedNote}
              onChange={(e) => setGeneratedNote(e.target.value)}
              className="font-mono text-xs min-h-[350px] bg-white"
              placeholder="Progress note will generate automatically as you enter vaccination data..."
              aria-label="Generated admission vaccination progress note"
            />
          </div>
        </div>

        <div className="flex justify-between items-center pt-4 border-t">
          <p className="text-sm text-muted-foreground">
            {givenCount} vaccine{givenCount !== 1 ? 's' : ''} marked as given | {vaccines.length} total entries will be saved
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSaveAll}>
              <Syringe className="w-4 h-4 mr-2" />
              Save All Vaccinations
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AdmissionVaxBatchModal;
