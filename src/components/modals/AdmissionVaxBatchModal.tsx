import { useEffect, useState } from 'react';
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
import { calculateAge, formatDate, formatDateTime } from '@/lib/noteHelpers';
import { useToast } from '@/hooks/use-toast';
import { useClinicalNote } from '@/hooks/useClinicalNote';

interface VaxEntry {
  vaccine_type: 'Pneumococcal' | 'Influenza' | 'COVID-19' | 'RSV';
  status: 'consented' | 'declined';
  administered_by: string;
  decline_reason: string;
  dose_number: string;
}

interface AdmissionVaxBatchModalProps {
  open: boolean;
  onClose: () => void;
  onSave: () => void;
  resident: Resident;
}

const VACCINE_TYPES: VaxEntry['vaccine_type'][] = ['Pneumococcal', 'Influenza', 'COVID-19', 'RSV'];
const buildDefaultVaccines = (): VaxEntry[] =>
  VACCINE_TYPES.map((type) => ({
    vaccine_type: type,
    status: 'declined',
    administered_by: '',
    decline_reason: '',
    dose_number: '1',
  }));

const AdmissionVaxBatchModal = ({ open, onClose, onSave, resident }: AdmissionVaxBatchModalProps) => {
  const { toast } = useToast();
  const [vaccines, setVaccines] = useState<VaxEntry[]>(buildDefaultVaccines());
  const [customNurse, setCustomNurse] = useState('');

  useEffect(() => {
    if (open) {
      setVaccines(buildDefaultVaccines());
      setCustomNurse('');
    }
  }, [open, resident.mrn]);


  const updateVaxField = (index: number, field: keyof VaxEntry, value: string) => {
    setVaccines((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleToggleStatus = (index: number, status: 'consented' | 'declined') => {
    setVaccines((prev) => {
      const updated = [...prev];
      const next = { ...updated[index], status };
      if (status === 'consented' && !next.administered_by && customNurse) {
        next.administered_by = customNurse;
      }
      updated[index] = next;
      return updated;
    });
  };

  const buildGeneratedNote = (): string => {
    const age = calculateAge(resident.dob || '');
    const gender = resident.sex || 'resident';
    const admitDate = formatDate(resident.admitDate || todayISO());
    const consenting = vaccines.filter((v) => v.status === 'consented');
    const declined = vaccines.filter((v) => v.status === 'declined');

    let note = `ADMISSION SCREENING - VACCINATION & INFECTION PREVENTION

`;
    note += `RESIDENT INFORMATION:
`;
    note += `${resident.name} is ${age !== '[age]' ? `a ${age} year old` : 'a'} ${gender} admitted on ${admitDate} to ${resident.unit || '[unit]'}, Room ${resident.room || '[room]'}.

`;

    note += 'VACCINATION SCREENING SUMMARY:';
    note += `\n- Vaccines addressed: ${vaccines.length}`;
    note += `\n- Consented/administered: ${consenting.length}`;
    note += `\n- Declined: ${declined.length}`;

    if (consenting.length > 0) {
      note += '\n\nVACCINES ADMINISTERED/CONSENTED:';
      consenting.forEach((entry) => {
        const administeredBy = entry.administered_by || customNurse || '[nurse]';
        note += `\n- ${entry.vaccine_type}: consented, documented by ${administeredBy}.`;
      });
    }

    if (declined.length > 0) {
      note += '\n\nVACCINES DECLINED:';
      declined.forEach((entry) => {
        note += `\n- ${entry.vaccine_type}: declined (${entry.decline_reason || 'resident preference'}).`;
      });
    }

    const isolationStatus = resident.isolationActive ? 'Active isolation precautions present on admission' : 'No active isolation precautions on admission';
    const antibioticStatus = resident.activeAntibiotic ? 'Resident admitted on active antibiotic therapy' : 'No active antibiotic therapy on admission';

    note += '\n\nIP SCREENING SUMMARY:';
    note += `\n- Isolation status on admission: ${isolationStatus}.`;
    note += `\n- Antibiotic status on admission: ${antibioticStatus}.`;
    note += '\n- Admission paperwork reviewed and reconciled.';
    note += '\n\nResident monitored per facility policy. No adverse reactions noted at time of documentation.';
    note += '\nWill continue to monitor, reinforce education as appropriate, and notify provider of any change in condition, isolation status, antibiotic therapy, or vaccination decision.';
    note += '\nDocumentation completed per facility infection prevention protocol and CMS admission screening requirements.';
    note += '\n\nDocumented by: [Your Name/Credentials]';
    note += `\nDate/Time: ${formatDateTime(new Date())}`;
    return note;
  };

  const { generatedNote, setGeneratedNote, handleCopyNote: handleCopyGeneratedNote } = useClinicalNote({
    generateNote: buildGeneratedNote,
    dependencies: [resident, vaccines, customNurse],
    autoGenerate: open,
  });

  const handleCopyNote = async () => {
    await handleCopyGeneratedNote();
  };

  const handleSaveAll = () => {
    const currentDb = loadDB();
    const now = nowISO();
    const vaccinationDate = todayISO();
    const newRecords: VaxRecord[] = vaccines.map((vax) => ({
      id: `vax_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      mrn: resident.mrn,
      residentName: resident.name,
      name: resident.name,
      unit: resident.unit,
      room: resident.room,
      vaccine: vax.vaccine_type,
      vaccine_type: vax.vaccine_type,
      status: vax.status === 'consented' ? 'given' : 'declined',
      dateGiven: vax.status === 'consented' ? vaccinationDate : undefined,
      date_given: vax.status === 'consented' ? vaccinationDate : undefined,
      administered_by: vax.status === 'consented' ? vax.administered_by : undefined,
      dose_number: vax.status === 'consented' ? vax.dose_number : undefined,
      decline_reason: vax.status === 'declined' ? vax.decline_reason : undefined,
      notes: `Admission vaccination entry - ${vax.status}`,
      context: 'admission_screening',
      createdAt: now,
      updated_at: now,
    }));

    currentDb.records.vax = [...newRecords, ...currentDb.records.vax];

    const consentedCount = vaccines.filter((v) => v.status === 'consented').length;
    const declinedCount = vaccines.filter((v) => v.status === 'declined').length;
    addAudit(currentDb, 'vax_batch_add', `Admission vax batch for ${resident.name}: ${consentedCount} consented, ${declinedCount} declined`, 'vax');

    saveDB(currentDb);
    toast({ title: 'Vaccinations Recorded', description: `${vaccines.length} vaccination entries saved for ${resident.name}` });
    onSave();
    onClose();
  };

  const consentedCount = vaccines.filter((v) => v.status === 'consented').length;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Syringe className="w-5 h-5" />
            Admission IP Screening & Vaccination Entry
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="text-sm">
              <strong className="text-base">{resident.name}</strong> | MRN: {resident.mrn} | Room: {resident.room} | Unit: {resident.unit} | Admitted: {formatDate(resident.admitDate || '')}
            </div>
          </div>

          <div className="border rounded-lg p-3 bg-muted/30">
            <Label className="text-sm font-semibold">Default Nurse/Administrator (applies to all Consented vaccines)</Label>
            <Input
              placeholder="e.g., Jane Doe, RN"
              value={customNurse}
              onChange={(e) => {
                const nurse = e.target.value;
                setCustomNurse(nurse);
                setVaccines((prev) => prev.map((v) => (v.status === 'consented' ? { ...v, administered_by: nurse } : v)));
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
                    <th className="p-3 text-left font-semibold">Decline Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {vaccines.map((vax, idx) => (
                    <tr key={vax.vaccine_type} className={`border-t ${vax.status === 'consented' ? 'bg-green-50' : ''}`}>
                      <td className="p-3 font-medium">{vax.vaccine_type}</td>
                      <td className="p-3">
                        <Label className="sr-only" htmlFor={`vax-status-${idx}`}>{`${vax.vaccine_type} status`}</Label>
                        <Select value={vax.status} onValueChange={(val: 'consented' | 'declined') => handleToggleStatus(idx, val)}>
                          <SelectTrigger id={`vax-status-${idx}`} className="w-32" title={`${vax.vaccine_type} status`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="consented">✓ Consented</SelectItem>
                            <SelectItem value="declined">✗ Declined</SelectItem>
                          </SelectContent>
                        </Select>
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
              <h3 className="font-semibold">Auto-Generated Admission IP Screening Progress Note</h3>
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
              aria-label="Generated admission IP screening progress note"
            />
          </div>
        </div>

        <div className="flex justify-between items-center pt-4 border-t">
          <p className="text-sm text-muted-foreground">
            {consentedCount} vaccine{consentedCount !== 1 ? 's' : ''} marked as consented | {vaccines.length} total entries will be saved
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
