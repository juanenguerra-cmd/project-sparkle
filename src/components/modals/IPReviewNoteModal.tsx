import { useEffect, useState } from 'react';
import { Copy, Save, Shield } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { loadDB, saveDB } from '@/lib/database';
import { nowISO, todayISO, isoDateFromAny } from '@/lib/parsers';
import { copyToClipboardWithToast, formatDate, formatDateTime } from '@/lib/noteHelpers';
import { IPCase } from '@/lib/types';
import { saveClinicalNoteWithAudit } from '@/lib/clinicalNoteHelpers';

interface IPReviewNoteModalProps {
  open: boolean;
  onClose: () => void;
  onSave?: () => void;
  ipCase: IPCase;
}

interface IPReviewFormData {
  reviewDate: string;
  reviewedBy: string;
  symptomsResolved: boolean;
  symptomsImproved: boolean;
  symptomsPersist: boolean;
  symptomDetails: string;
  precautionType: string;
  mdroStatus: 'colonized' | 'infected' | 'cleared' | 'unknown';
  organism: string;
  cultureStatus: 'pending' | 'negative' | 'positive' | 'not_indicated';
  cultureDate: string;
  cultureResult: string;
  clearanceCultures: number;
  clearanceCulturesRequired: number;
  ppeCompliance: boolean;
  staffEducation: boolean;
  signagePosted: boolean;
  roomCleaning: 'routine' | 'enhanced' | 'terminal';
  dedicatedEquipment: boolean;
  reviewDecision: 'continue' | 'discontinue' | 'modify' | 'escalate';
  discontinueReason: string;
  modificationDetails: string;
  nextReviewDate: string;
  additionalRecommendations: string;
  providerNotified: boolean;
  infectionPreventionistNotified: boolean;
}

const getCaseField = (ipCase: IPCase, key: string): string => {
  const value = (ipCase as unknown as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : '';
};

const IPReviewNoteModal = ({ open, onClose, onSave, ipCase }: IPReviewNoteModalProps) => {
  const { toast } = useToast();
  const [generatedNote, setGeneratedNote] = useState('');
  const [formData, setFormData] = useState<IPReviewFormData>({
    reviewDate: todayISO(),
    reviewedBy: '',
    symptomsResolved: false,
    symptomsImproved: false,
    symptomsPersist: false,
    symptomDetails: '',
    precautionType: getCaseField(ipCase, 'precaution_type') || getCaseField(ipCase, 'isolation_type') || ipCase.isolationType || 'Contact',
    mdroStatus: 'unknown',
    organism: '',
    cultureStatus: 'not_indicated',
    cultureDate: '',
    cultureResult: '',
    clearanceCultures: 0,
    clearanceCulturesRequired: 3,
    ppeCompliance: true,
    staffEducation: true,
    signagePosted: true,
    roomCleaning: 'enhanced',
    dedicatedEquipment: true,
    reviewDecision: 'continue',
    discontinueReason: '',
    modificationDetails: '',
    nextReviewDate: '',
    additionalRecommendations: '',
    providerNotified: false,
    infectionPreventionistNotified: false,
  });

  useEffect(() => {
    if (open) {
      setFormData(prev => ({
        ...prev,
        precautionType: getCaseField(ipCase, 'precaution_type') || getCaseField(ipCase, 'isolation_type') || ipCase.isolationType || 'Contact',
        organism: getCaseField(ipCase, 'organism') || ipCase.infectionType || ipCase.infection_type || '',
        symptomDetails: getCaseField(ipCase, 'symptoms') || '',
        cultureResult: getCaseField(ipCase, 'culture_result') || '',
      }));
    }
  }, [open, ipCase]);

  useEffect(() => {
    const db = loadDB();
    const resident = db.census.residentsByMrn[ipCase.mrn];
    const facilityName = db.settings.facilityName || '[Facility Name]';
    const age = resident?.dob ? calculateAge(resident.dob) : '[age]';
    const gender = resident?.gender || 'resident';
    const daysOnPrecaution = calculateDaysOnPrecaution();

    let note = `INFECTION PREVENTION REVIEW - ${formData.precautionType.toUpperCase()}\n\n`;
    note += `FACILITY: ${facilityName}\n\n`;
    note += `RESIDENT INFORMATION:\n`;
    note += `${ipCase.residentName || ipCase.name || '[Resident]'} is ${age !== '[age]' ? `a ${age} year old` : 'a'} ${gender} currently residing in ${ipCase.unit || '[unit]'}, Room ${ipCase.room || '[room]'}.\n\n`;
    note += `ISOLATION/PRECAUTION UNDER REVIEW:\n`;
    note += `Type: ${getPrecautionDescription(formData.precautionType)}\n`;
    if (formData.organism) note += `Organism/Condition: ${formData.organism}\n`;
    if (formData.mdroStatus !== 'unknown') note += `MDRO Status: ${formData.mdroStatus.charAt(0).toUpperCase() + formData.mdroStatus.slice(1)}\n`;
    note += `Start Date: ${formatDate(ipCase.onsetDate || ipCase.onset_date || getCaseField(ipCase, 'start_date'))}\n`;
    note += `Days on Precaution: ${daysOnPrecaution} days\n`;
    note += `PPE Requirements: ${getPPERequirements(formData.precautionType)}\n\n`;

    note += `REVIEW DATE: ${formatDate(formData.reviewDate)}\n\n`;
    note += 'CLINICAL ASSESSMENT:\n';
    if (formData.symptomsResolved) {
      note += `Symptoms related to ${formData.organism || 'infection/colonization'} have resolved. `;
    } else if (formData.symptomsImproved) {
      note += `Symptoms related to ${formData.organism || 'infection/colonization'} are improving. `;
    } else if (formData.symptomsPersist) {
      note += `Symptoms related to ${formData.organism || 'infection/colonization'} persist. `;
    } else {
      note += 'Resident remains asymptomatic. ';
    }
    if (formData.symptomDetails) note += `${formData.symptomDetails} `;

    if (formData.cultureStatus !== 'not_indicated') {
      note += '\n\nCULTURE/LABORATORY RESULTS:\n';
      if (formData.cultureStatus === 'pending') {
        note += `Culture collected on ${formData.cultureDate ? formatDate(formData.cultureDate) : '[date]'}. Results pending.`;
      } else if (formData.cultureStatus === 'negative') {
        note += `Culture results negative for ${formData.organism || 'target organism'}.`;
        if (formData.clearanceCultures > 0) {
          note += ` Clearance culture ${formData.clearanceCultures} of ${formData.clearanceCulturesRequired} completed.`;
        }
      } else {
        note += `Culture results positive: ${formData.cultureResult || formData.organism || '[organism]'}.`;
        if (formData.mdroStatus === 'colonized') note += ' Resident remains colonized without active infection.';
        if (formData.mdroStatus === 'infected') note += ' Active infection present.';
      }
    }

    note += '\n\nINFECTION CONTROL MEASURES IN PLACE:';
    note += `\n- Isolation signage posted: ${formData.signagePosted ? 'Yes' : 'No'}`;
    note += `\n- PPE compliance observed: ${formData.ppeCompliance ? 'Yes, staff demonstrating appropriate use' : 'Education needed'}`;
    note += `\n- Staff education completed: ${formData.staffEducation ? 'Yes' : 'In progress'}`;
    note += `\n- Dedicated equipment in room: ${formData.dedicatedEquipment ? 'Yes' : 'N/A'}`;
    note += `\n- Room cleaning protocol: ${formData.roomCleaning === 'enhanced' ? 'Enhanced cleaning daily' : formData.roomCleaning === 'terminal' ? 'Terminal cleaning scheduled' : 'Routine daily cleaning'}`;

    note += '\n\nREGULATORY COMPLIANCE:';
    if (formData.precautionType === 'EBP') {
      note += '\nReview conducted per CMS QSO-23-09-NH Enhanced Barrier Precautions guidelines. EBP implemented for residents with MDRO history or risk factors. Gown and gloves used for high-contact care activities including wound care, device care, and assistance with ADLs.';
    } else if (formData.precautionType.includes('Contact')) {
      note += '\nReview conducted per CMS F880/F882 requirements and CDC/HICPAC guidelines. Contact precautions maintained for prevention of transmission via direct or indirect contact.';
    }
    note += ' Facility adhering to NYS DOH 10 NYCRR Part 415 infection control standards.';

    note += '\n\nINFECTION PREVENTION REVIEW AND RECOMMENDATION:';
    if (formData.reviewDecision === 'continue') {
      note += `\nAfter review, recommend continuing current ${formData.precautionType} precautions. `;
      if (formData.precautionType === 'EBP' || formData.precautionType.includes('Contact')) {
        if (formData.mdroStatus === 'colonized') {
          note += `Resident remains colonized with ${formData.organism || 'MDRO'}. Precautions to remain in place per CDC guidelines as colonization may persist indefinitely. `;
        } else if (formData.symptomsPersist) {
          note += 'Active symptoms present. Precautions to continue until clinical improvement documented. ';
        }
      }
      if (formData.nextReviewDate) note += `Next review scheduled for ${formatDate(formData.nextReviewDate)}.`;
    }

    if (formData.reviewDecision === 'discontinue') {
      note += `\nRecommend discontinuation of ${formData.precautionType} precautions. `;
      if (formData.discontinueReason) {
        note += `${formData.discontinueReason} `;
      } else {
        if (formData.clearanceCultures >= formData.clearanceCulturesRequired) {
          note += `Required clearance cultures (${formData.clearanceCulturesRequired}) completed and negative. `;
        }
        if (formData.symptomsResolved) {
          note += 'Symptoms resolved and appropriate time period elapsed per CDC guidelines. ';
        }
      }
      note += `Precautions may be discontinued effective ${formatDate(formData.reviewDate)}. Room will receive terminal cleaning prior to new admission.`;
    }

    if (formData.reviewDecision === 'modify') {
      note += `\nRecommend modification of precautions. ${formData.modificationDetails || 'Level of precaution to be adjusted based on current clinical status and risk assessment.'}`;
    }

    if (formData.reviewDecision === 'escalate') {
      note += `\nRecommend escalation of precautions. ${formData.modificationDetails || 'Additional precautions warranted based on clinical presentation and transmission risk.'}`;
    }

    if (formData.additionalRecommendations) {
      note += `\n\nAdditional Recommendations: ${formData.additionalRecommendations}`;
    }

    if (formData.providerNotified || formData.infectionPreventionistNotified) {
      note += '\n\nCOMMUNICATION:';
      if (formData.providerNotified) note += '\n- Provider notified of review findings and recommendations';
      if (formData.infectionPreventionistNotified) note += '\n- Infection Preventionist notified';
    }

    note += '\n\nResident/family education provided regarding infection prevention measures and precaution requirements. Monitoring continues per facility infection prevention protocols.';
    note += '\n\nDocumentation completed per CMS F880/F882/F883, CDC/HICPAC guidelines, and NYS DOH 10 NYCRR Part 415 requirements.';
    note += `\n\nReviewed by: ${formData.reviewedBy || '[Name], RN, IP'}`;
    note += `\nDate/Time: ${formatDateTime(new Date())}`;

    setGeneratedNote(note);
  }, [formData, ipCase]);

  const calculateAge = (dob: string): string => {
    try {
      const birth = new Date(dob);
      if (Number.isNaN(birth.getTime())) return '[age]';
      const today = new Date();
      let age = today.getFullYear() - birth.getFullYear();
      const monthDiff = today.getMonth() - birth.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age--;
      return age.toString();
    } catch {
      return '[age]';
    }
  };

  const calculateDaysOnPrecaution = (): number => {
    const startDate = isoDateFromAny(ipCase.onsetDate || ipCase.onset_date || getCaseField(ipCase, 'start_date'));
    if (!startDate) return 0;
    const today = new Date();
    const start = new Date(`${startDate}T00:00:00`);
    const diffTime = Math.abs(today.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const getPrecautionDescription = (type: string): string => ({
    Contact: 'Contact Precautions for transmission of infectious agents via direct or indirect contact',
    Droplet: 'Droplet Precautions for transmission via respiratory droplets',
    Airborne: 'Airborne Precautions for transmission via airborne particles',
    'Contact Plus': 'Contact Plus Precautions (Contact + Droplet) for enhanced protection',
    EBP: 'Enhanced Barrier Precautions for MDRO prevention per CMS QSO-23-09-NH',
    Protective: 'Protective Isolation for immunocompromised residents',
  }[type] || `${type} Precautions`);

  const getPPERequirements = (type: string): string => ({
    Contact: 'gown and gloves for all interactions',
    Droplet: 'surgical mask and eye protection within 6 feet',
    Airborne: 'N95 respirator and negative pressure room',
    'Contact Plus': 'gown, gloves, and surgical mask',
    EBP: 'gown and gloves for high-contact resident care activities',
    Protective: 'mask and strict hand hygiene for all entering room',
  }[type] || 'appropriate PPE per facility policy');

  const updateFormField = <K extends keyof IPReviewFormData>(field: K, value: IPReviewFormData[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleCopyNote = async () => {
    await copyToClipboardWithToast(
      generatedNote,
      'Progress note copied to clipboard!',
      'Paste into your EMR documentation.',
    );
  };

  const handleSaveNote = () => {
    try {
      const db = loadDB();
      const now = nowISO();
      const residentName = ipCase.residentName || ipCase.name || 'Resident';

      saveClinicalNoteWithAudit(
        'ip_assessment',
        ipCase.mrn,
        residentName,
        generatedNote,
        formData.reviewDate,
        formData.reviewedBy,
        'ip_review',
        `IP review completed for ${residentName}: ${formData.precautionType} - ${formData.reviewDecision}`,
        'ip',
        ipCase.id,
      );

      const idx = db.records.ip_cases.findIndex(r => r.id === ipCase.id);
      if (idx >= 0) {
        const current = db.records.ip_cases[idx];
        const summary = `[${formData.reviewDate}] IP Review: ${formData.reviewDecision.toUpperCase()} - ${formData.discontinueReason || formData.modificationDetails || 'Precautions continue'}`;
        db.records.ip_cases[idx] = {
          ...current,
          lastReviewDate: formData.reviewDate,
          nextReviewDate: formData.nextReviewDate || current.nextReviewDate,
          next_review_date: formData.nextReviewDate || current.next_review_date,
          updated_at: now,
          notes: `${current.notes || ''}\n${summary}`.trim(),
          ...(formData.reviewDecision === 'discontinue'
            ? {
                status: 'Resolved',
                resolutionDate: formData.reviewDate,
                resolution_date: formData.reviewDate,
              }
            : {}),
        } as IPCase;
      }

      saveDB(db);
      toast({ title: 'Review Note Saved', description: 'Progress note and IP case updated successfully' });
      onSave?.();
      onClose();
    } catch (error) {
      console.error('Failed to save review note:', error);
      toast({ title: 'Save failed', description: 'Please try again', variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            IP/Isolation Precaution Review Progress Note
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-6">
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="text-sm space-y-1">
                <div><strong>{ipCase.residentName || ipCase.name}</strong></div>
                <div>MRN: {ipCase.mrn} | Room: {ipCase.room}</div>
                <div className="text-xs font-medium text-red-700 mt-2">
                  {formData.precautionType} - {formData.organism || ipCase.infectionType || ipCase.infection_type || 'Infection'}
                </div>
              </div>
            </div>

            <div className="space-y-4 border rounded-lg p-4">
              <h3 className="font-semibold text-sm">Review Details</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label className="text-xs">Review Date</Label><Input type="date" value={formData.reviewDate} onChange={(e) => updateFormField('reviewDate', e.target.value)} /></div>
                <div className="space-y-1"><Label className="text-xs">Reviewed By</Label><Input placeholder="Name, RN, IP" value={formData.reviewedBy} onChange={(e) => updateFormField('reviewedBy', e.target.value)} /></div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Precaution Type</Label>
                <Select value={formData.precautionType} onValueChange={(val) => updateFormField('precautionType', val)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Contact">Contact Precautions</SelectItem>
                    <SelectItem value="Droplet">Droplet Precautions</SelectItem>
                    <SelectItem value="Airborne">Airborne Precautions</SelectItem>
                    <SelectItem value="Contact Plus">Contact Plus</SelectItem>
                    <SelectItem value="EBP">Enhanced Barrier Precautions (EBP)</SelectItem>
                    <SelectItem value="Protective">Protective Isolation</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-4 border rounded-lg p-4">
              <h3 className="font-semibold text-sm">Clinical Assessment</h3>
              <div className="space-y-2">
                <Label className="text-xs font-medium">Symptom Status</Label>
                {[
                  ['symptomsResolved', 'Symptoms resolved', ['symptomsImproved', 'symptomsPersist']],
                  ['symptomsImproved', 'Symptoms improving', ['symptomsResolved', 'symptomsPersist']],
                  ['symptomsPersist', 'Symptoms persist', ['symptomsResolved', 'symptomsImproved']],
                ].map(([key, label, resetKeys]) => (
                  <div className="flex items-center gap-2" key={key}>
                    <Checkbox
                      checked={formData[key as keyof IPReviewFormData] as boolean}
                      onCheckedChange={(checked) => {
                        updateFormField(key as keyof IPReviewFormData, !!checked as never);
                        if (checked) (resetKeys as string[]).forEach(resetKey => updateFormField(resetKey as keyof IPReviewFormData, false as never));
                      }}
                    />
                    <span className="text-sm">{label}</span>
                  </div>
                ))}
              </div>
              <div className="space-y-1"><Label className="text-xs">Symptom Details</Label><Textarea value={formData.symptomDetails} onChange={(e) => updateFormField('symptomDetails', e.target.value)} className="text-sm h-16" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">MDRO Status</Label>
                  <Select value={formData.mdroStatus} onValueChange={(val: IPReviewFormData['mdroStatus']) => updateFormField('mdroStatus', val)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unknown">Unknown</SelectItem>
                      <SelectItem value="colonized">Colonized</SelectItem>
                      <SelectItem value="infected">Infected</SelectItem>
                      <SelectItem value="cleared">Cleared</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label className="text-xs">Organism</Label><Input value={formData.organism} onChange={(e) => updateFormField('organism', e.target.value)} placeholder="e.g., MRSA, C. diff" /></div>
              </div>
            </div>

            <div className="space-y-4 border rounded-lg p-4">
              <h3 className="font-semibold text-sm">Culture/Laboratory Results</h3>
              <div className="space-y-1">
                <Label className="text-xs">Culture Status</Label>
                <Select value={formData.cultureStatus} onValueChange={(val: IPReviewFormData['cultureStatus']) => updateFormField('cultureStatus', val)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="not_indicated">Not indicated</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="negative">Negative</SelectItem>
                    <SelectItem value="positive">Positive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {formData.cultureStatus !== 'not_indicated' && (
                <>
                  <div className="space-y-1"><Label className="text-xs">Culture Date</Label><Input type="date" value={formData.cultureDate} onChange={(e) => updateFormField('cultureDate', e.target.value)} /></div>
                  {formData.cultureStatus === 'positive' && <div className="space-y-1"><Label className="text-xs">Culture Result</Label><Input value={formData.cultureResult} onChange={(e) => updateFormField('cultureResult', e.target.value)} placeholder="Organism and details" /></div>}
                  {formData.cultureStatus === 'negative' && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1"><Label className="text-xs">Clearance Cultures</Label><Input type="number" min="0" value={formData.clearanceCultures} onChange={(e) => updateFormField('clearanceCultures', parseInt(e.target.value, 10) || 0)} /></div>
                      <div className="space-y-1"><Label className="text-xs">Required</Label><Input type="number" min="1" value={formData.clearanceCulturesRequired} onChange={(e) => updateFormField('clearanceCulturesRequired', parseInt(e.target.value, 10) || 3)} /></div>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="space-y-4 border rounded-lg p-4 bg-blue-50">
              <h3 className="font-semibold text-sm">Infection Control Measures</h3>
              {[
                ['signagePosted', 'Isolation signage posted'],
                ['ppeCompliance', 'PPE compliance observed'],
                ['staffEducation', 'Staff education completed'],
                ['dedicatedEquipment', 'Dedicated equipment in room'],
              ].map(([key, label]) => (
                <div className="flex items-center gap-2" key={key}>
                  <Checkbox checked={formData[key as keyof IPReviewFormData] as boolean} onCheckedChange={(checked) => updateFormField(key as keyof IPReviewFormData, !!checked as never)} />
                  <span className="text-sm">{label}</span>
                </div>
              ))}
              <div className="space-y-1">
                <Label className="text-xs">Room Cleaning Protocol</Label>
                <Select value={formData.roomCleaning} onValueChange={(val: IPReviewFormData['roomCleaning']) => updateFormField('roomCleaning', val)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="routine">Routine daily cleaning</SelectItem>
                    <SelectItem value="enhanced">Enhanced cleaning daily</SelectItem>
                    <SelectItem value="terminal">Terminal cleaning</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-4 border rounded-lg p-4 bg-yellow-50">
              <h3 className="font-semibold text-sm">Review Decision</h3>
              <div className="space-y-1">
                <Label className="text-xs">Recommendation</Label>
                <Select value={formData.reviewDecision} onValueChange={(val: IPReviewFormData['reviewDecision']) => updateFormField('reviewDecision', val)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="continue">Continue precautions</SelectItem>
                    <SelectItem value="discontinue">Discontinue precautions</SelectItem>
                    <SelectItem value="modify">Modify precautions</SelectItem>
                    <SelectItem value="escalate">Escalate precautions</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {formData.reviewDecision === 'discontinue' && <div className="space-y-1"><Label className="text-xs">Discontinue Reason</Label><Textarea value={formData.discontinueReason} onChange={(e) => updateFormField('discontinueReason', e.target.value)} className="text-sm h-16" /></div>}
              {(formData.reviewDecision === 'modify' || formData.reviewDecision === 'escalate') && <div className="space-y-1"><Label className="text-xs">Modification Details</Label><Textarea value={formData.modificationDetails} onChange={(e) => updateFormField('modificationDetails', e.target.value)} className="text-sm h-16" /></div>}
              {formData.reviewDecision === 'continue' && <div className="space-y-1"><Label className="text-xs">Next Review Date</Label><Input type="date" value={formData.nextReviewDate} onChange={(e) => updateFormField('nextReviewDate', e.target.value)} /></div>}
              <div className="space-y-1"><Label className="text-xs">Additional Recommendations</Label><Textarea value={formData.additionalRecommendations} onChange={(e) => updateFormField('additionalRecommendations', e.target.value)} className="text-sm h-16" /></div>
              <div className="space-y-2">
                <div className="flex items-center gap-2"><Checkbox checked={formData.providerNotified} onCheckedChange={(checked) => updateFormField('providerNotified', !!checked)} /><span className="text-sm">Provider notified</span></div>
                <div className="flex items-center gap-2"><Checkbox checked={formData.infectionPreventionistNotified} onCheckedChange={(checked) => updateFormField('infectionPreventionistNotified', !!checked)} /><span className="text-sm">Infection Preventionist notified</span></div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="border rounded-lg p-4 bg-gray-50 sticky top-0">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">Generated Progress Note</h3>
                <Button variant="outline" size="sm" onClick={handleCopyNote}><Copy className="w-4 h-4 mr-2" />Copy</Button>
              </div>
              <Textarea value={generatedNote} onChange={(e) => setGeneratedNote(e.target.value)} className="font-mono text-xs min-h-[600px] bg-white" />
              <p className="text-xs text-muted-foreground mt-2">✏️ Note auto-updates as you complete the review. Edit before copying/saving.</p>
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center pt-4 border-t">
          <p className="text-xs text-muted-foreground">CMS F880/F882 & NYS DOH 10 NYCRR Part 415 Compliance</p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button variant="outline" onClick={handleCopyNote}><Copy className="w-4 h-4 mr-2" />Copy Only</Button>
            <Button onClick={handleSaveNote}><Save className="w-4 h-4 mr-2" />Save & Update Case</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default IPReviewNoteModal;
