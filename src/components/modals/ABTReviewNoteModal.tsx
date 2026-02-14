import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Copy, FileText, Save } from 'lucide-react';
import { loadDB, saveDB } from '@/lib/database';
import { ABTRecord } from '@/lib/types';
import { isoDateFromAny, nowISO, todayISO } from '@/lib/parsers';
import { saveClinicalNoteWithAudit } from '@/lib/clinicalNoteHelpers';
import { copyToClipboardWithToast, formatDate, formatDateTime } from '@/lib/noteHelpers';
import { useToast } from '@/hooks/use-toast';

interface ABTReviewNoteModalProps {
  open: boolean;
  onClose: () => void;
  onSave?: () => void;
  abtRecord: ABTRecord;
}

interface ReviewFormData {
  reviewDate: string;
  reviewedBy: string;
  symptomsResolved: boolean;
  symptomsImproved: boolean;
  symptomsPersist: boolean;
  newSymptoms: string;
  noAdverseReactions: boolean;
  adverseReactionDetails: string;
  cultureStatus: 'pending' | 'negative' | 'positive' | 'not_collected';
  cultureOrganism: string;
  cultureSensitivity: string;
  vitalsStable: boolean;
  temperature: string;
  clinicalNotes: string;
  stewardshipDecision: 'continue' | 'modify' | 'discontinue' | 'de-escalate';
  modificationDetails: string;
  discontinueReason: string;
  duration: string;
  nextReviewDate: string;
  providerNotified: boolean;
  additionalRecommendations: string;
}

const ABTReviewNoteModal = ({ open, onClose, onSave, abtRecord }: ABTReviewNoteModalProps) => {
  const { toast } = useToast();
  const [generatedNote, setGeneratedNote] = useState('');
  const [formData, setFormData] = useState<ReviewFormData>({
    reviewDate: todayISO(),
    reviewedBy: '',
    symptomsResolved: false,
    symptomsImproved: false,
    symptomsPersist: false,
    newSymptoms: '',
    noAdverseReactions: true,
    adverseReactionDetails: '',
    cultureStatus: 'not_collected',
    cultureOrganism: '',
    cultureSensitivity: '',
    vitalsStable: true,
    temperature: '',
    clinicalNotes: '',
    stewardshipDecision: 'continue',
    modificationDetails: '',
    discontinueReason: '',
    duration: '',
    nextReviewDate: '',
    providerNotified: false,
    additionalRecommendations: '',
  });

  useEffect(() => {
    if (open && abtRecord) {
      setFormData(prev => ({
        ...prev,
        reviewedBy: abtRecord.prescriber || '',
        cultureStatus: abtRecord.cultureCollected
          ? (abtRecord.cultureResult ? 'positive' : 'pending')
          : 'not_collected',
        cultureOrganism: abtRecord.cultureResult || '',
        adverseReactionDetails: abtRecord.adverseEffects || '',
        noAdverseReactions: !abtRecord.adverseEffects,
        nextReviewDate: abtRecord.nextReviewDate || '',
      }));
    }
  }, [open, abtRecord]);

  useEffect(() => {
    generateProgressNote();
  }, [formData]);

  const calculateAge = (dob: string): string => {
    if (!dob) return '[age]';
    const birth = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return Number.isFinite(age) ? age.toString() : '[age]';
  };

  const calculateDaysOfTherapy = (): number => {
    const startDate = isoDateFromAny(abtRecord.startDate || abtRecord.start_date);
    if (!startDate) return 0;
    const today = new Date();
    const start = new Date(`${startDate}T00:00:00`);
    const diffTime = Math.abs(today.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const generateProgressNote = () => {
    const db = loadDB();
    const resident = db.census.residentsByMrn[abtRecord.mrn];
    const age = resident ? calculateAge(resident.dob || '') : '[age]';
    const gender = resident?.sex || 'patient';
    const daysOfTherapy = calculateDaysOfTherapy();

    let note = `ANTIBIOTIC STEWARDSHIP REVIEW - ${abtRecord.medication || abtRecord.med_name}\n\nRESIDENT INFORMATION:\n${abtRecord.residentName || abtRecord.name} is ${age !== '[age]' ? `a ${age} year old` : 'a'} ${gender} currently residing in ${abtRecord.unit || '[unit]'}, Room ${abtRecord.room || '[room]'}.\n\nANTIBIOTIC THERAPY UNDER REVIEW:\nMedication: ${abtRecord.medication || abtRecord.med_name} ${abtRecord.dose || ''} ${abtRecord.route || ''} ${abtRecord.frequency || ''}\nIndication: ${abtRecord.indication || '[indication not documented]'}\nInfection Source: ${abtRecord.infection_source || 'Not specified'}\nStart Date: ${formatDate(abtRecord.startDate || abtRecord.start_date || '')}\nDays of Therapy: ${daysOfTherapy} days\nPrescriber: ${abtRecord.prescriber || 'Not documented'}`;

    if (abtRecord.plannedStopDate) {
      note += `\nPlanned Stop Date: ${formatDate(abtRecord.plannedStopDate)}`;
    }

    note += `\n\nREVIEW DATE: ${formatDate(formData.reviewDate)}`;
    note += '\n\nCLINICAL ASSESSMENT:';

    if (formData.symptomsResolved) {
      note += `\nSymptoms related to ${abtRecord.indication || 'infection'} have resolved. `;
    } else if (formData.symptomsImproved) {
      note += `\nSymptoms related to ${abtRecord.indication || 'infection'} are improving. `;
    } else if (formData.symptomsPersist) {
      note += `\nSymptoms related to ${abtRecord.indication || 'infection'} persist. `;
    }

    if (formData.newSymptoms) {
      note += `New symptoms noted: ${formData.newSymptoms}. `;
    } else {
      note += 'No new symptoms reported. ';
    }

    if (formData.vitalsStable) {
      note += 'Vital signs remain stable. ';
    }

    if (formData.temperature) {
      note += `Temperature: ${formData.temperature}°F. `;
    }

    if (formData.clinicalNotes) {
      note += `${formData.clinicalNotes} `;
    }

    note += '\n\nADVERSE REACTIONS:';
    if (formData.noAdverseReactions) {
      note += `\nNo adverse reactions to ${abtRecord.medication || abtRecord.med_name} have been identified or reported at this time. Resident tolerating therapy well.`;
    } else if (formData.adverseReactionDetails) {
      note += `\n${formData.adverseReactionDetails}`;
    }

    note += '\n\nCULTURE/LABORATORY RESULTS:';
    switch (formData.cultureStatus) {
      case 'not_collected':
        note += '\nNo culture obtained. Therapy initiated based on clinical presentation and facility antibiogram.';
        break;
      case 'pending':
        note += `\nCulture collected on ${abtRecord.cultureReviewedDate ? formatDate(abtRecord.cultureReviewedDate) : '[date]'}. Results pending.`;
        break;
      case 'negative':
        note += '\nCulture results negative. No organism identified.';
        break;
      case 'positive':
        note += `\nCulture results: ${formData.cultureOrganism || abtRecord.cultureResult || '[organism]'}.`;
        if (formData.cultureSensitivity) {
          note += ` Sensitivity: ${formData.cultureSensitivity}.`;
        }
        note += ` Current therapy ${formData.cultureSensitivity.toLowerCase().includes('resistant') ? 'may not be' : 'is'} appropriate based on sensitivities.`;
        break;
    }

    note += '\n\nSTEWARDSHIP REVIEW AND RECOMMENDATIONS (F881 COMPLIANCE):';
    switch (formData.stewardshipDecision) {
      case 'continue':
        note += '\nAfter review, recommend continuing current antibiotic therapy. ';
        if (formData.duration) note += `Planned duration: ${formData.duration}. `;
        note += 'Clinical improvement noted and therapy remains appropriate for indication.';
        break;
      case 'modify':
        note += `\nRecommend modification of antibiotic therapy. ${formData.modificationDetails || 'Details discussed with provider.'}`;
        break;
      case 'discontinue':
        note += `\nRecommend discontinuation of antibiotic therapy. ${formData.discontinueReason || 'Clinical improvement sufficient to warrant therapy cessation.'}`;
        break;
      case 'de-escalate':
        note += `\nRecommend de-escalation of antibiotic therapy based on culture results and clinical improvement. ${formData.modificationDetails || 'Narrower spectrum alternative discussed with provider.'}`;
        break;
    }

    if (formData.nextReviewDate) {
      note += `\n\nNext stewardship review scheduled: ${formatDate(formData.nextReviewDate)}`;
    }

    if (formData.additionalRecommendations) {
      note += `\n\nAdditional Recommendations: ${formData.additionalRecommendations}`;
    }

    if (formData.providerNotified) {
      note += '\n\nProvider notified of stewardship review findings and recommendations. ';
    }

    note += '\n\nAntibiotic stewardship documentation completed per CMS F881 requirements and facility infection prevention protocols. Resident/family education provided regarding antibiotic therapy.';
    note += `\n\nReviewed by: ${formData.reviewedBy || '[Name], RN, IP'}`;
    note += `\nDate/Time: ${formatDateTime(new Date())}`;

    setGeneratedNote(note);
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
      const currentDb = loadDB();
      const now = nowISO();

      saveClinicalNoteWithAudit(
        'abt_review',
        abtRecord.mrn,
        abtRecord.residentName || abtRecord.name || '',
        generatedNote,
        formData.reviewDate,
        formData.reviewedBy,
        'abt_review',
        `Stewardship review completed for ${abtRecord.residentName || abtRecord.name}: ${abtRecord.medication || abtRecord.med_name} - ${formData.stewardshipDecision}`,
        'abt',
        abtRecord.id,
      );

      const abtIdx = currentDb.records.abx.findIndex(r => r.id === abtRecord.id);
      if (abtIdx >= 0) {
        currentDb.records.abx[abtIdx] = {
          ...currentDb.records.abx[abtIdx],
          timeoutReviewDate: formData.reviewDate,
          timeoutOutcome: formData.stewardshipDecision === 'continue'
            ? 'continue'
            : formData.stewardshipDecision === 'discontinue'
              ? 'stop'
              : 'change',
          nextReviewDate: formData.nextReviewDate,
          adverseEffects: formData.adverseReactionDetails || currentDb.records.abx[abtIdx].adverseEffects,
          stewardshipNotes: `${currentDb.records.abx[abtIdx].stewardshipNotes || ''}\n[${formData.reviewDate}] ${formData.stewardshipDecision.toUpperCase()}: ${formData.modificationDetails || formData.discontinueReason || 'Review completed'}`.trim(),
          updated_at: now,
        };
      }

      saveDB(currentDb);
      toast({
        title: 'Review Note Saved',
        description: 'Progress note and ABT record updated successfully',
      });

      onSave?.();
      onClose();
    } catch (error) {
      console.error('Failed to save review note:', error);
      toast({
        title: 'Save failed',
        description: 'Please try again',
        variant: 'destructive',
      });
    }
  };

  const updateFormField = <K extends keyof ReviewFormData>(field: K, value: ReviewFormData[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            ABT Stewardship Review Progress Note
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="text-sm space-y-1">
                <div><strong>{abtRecord.residentName || abtRecord.name}</strong></div>
                <div>MRN: {abtRecord.mrn} | Room: {abtRecord.room}</div>
                <div className="text-xs font-medium text-blue-700 mt-2">
                  {abtRecord.medication || abtRecord.med_name} - {abtRecord.indication}
                </div>
              </div>
            </div>

            <div className="space-y-4 border rounded-lg p-4">
              <h3 className="font-semibold text-sm">Review Details</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Review Date</Label>
                  <Input type="date" value={formData.reviewDate} onChange={(e) => updateFormField('reviewDate', e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Reviewed By</Label>
                  <Input placeholder="Name, RN, IP" value={formData.reviewedBy} onChange={(e) => updateFormField('reviewedBy', e.target.value)} />
                </div>
              </div>
            </div>

            <div className="space-y-4 border rounded-lg p-4">
              <h3 className="font-semibold text-sm">Clinical Assessment</h3>
              <div className="space-y-2">
                <Label className="text-xs font-medium">Symptom Status</Label>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Checkbox checked={formData.symptomsResolved} onCheckedChange={(checked) => {
                      updateFormField('symptomsResolved', !!checked);
                      if (checked) {
                        updateFormField('symptomsImproved', false);
                        updateFormField('symptomsPersist', false);
                      }
                    }} />
                    <span className="text-sm">Symptoms resolved</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox checked={formData.symptomsImproved} onCheckedChange={(checked) => {
                      updateFormField('symptomsImproved', !!checked);
                      if (checked) {
                        updateFormField('symptomsResolved', false);
                        updateFormField('symptomsPersist', false);
                      }
                    }} />
                    <span className="text-sm">Symptoms improving</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox checked={formData.symptomsPersist} onCheckedChange={(checked) => {
                      updateFormField('symptomsPersist', !!checked);
                      if (checked) {
                        updateFormField('symptomsResolved', false);
                        updateFormField('symptomsImproved', false);
                      }
                    }} />
                    <span className="text-sm">Symptoms persist</span>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">New Symptoms (if any)</Label>
                <Input placeholder="e.g., Increased cough, rash..." value={formData.newSymptoms} onChange={(e) => updateFormField('newSymptoms', e.target.value)} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2">
                  <Checkbox checked={formData.vitalsStable} onCheckedChange={(checked) => updateFormField('vitalsStable', !!checked)} />
                  <span className="text-sm">Vitals stable</span>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Temperature</Label>
                  <Input placeholder="98.6" value={formData.temperature} onChange={(e) => updateFormField('temperature', e.target.value)} />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Additional Clinical Notes</Label>
                <Textarea placeholder="Any additional clinical observations..." value={formData.clinicalNotes} onChange={(e) => updateFormField('clinicalNotes', e.target.value)} className="text-sm h-16" />
              </div>
            </div>

            <div className="space-y-4 border rounded-lg p-4">
              <h3 className="font-semibold text-sm">Adverse Reactions</h3>
              <div className="flex items-center gap-2">
                <Checkbox checked={formData.noAdverseReactions} onCheckedChange={(checked) => {
                  updateFormField('noAdverseReactions', !!checked);
                  if (checked) updateFormField('adverseReactionDetails', '');
                }} />
                <span className="text-sm">No adverse reactions noted</span>
              </div>
              {!formData.noAdverseReactions && (
                <div className="space-y-1">
                  <Label className="text-xs">Adverse Reaction Details</Label>
                  <Textarea placeholder="Describe any adverse reactions..." value={formData.adverseReactionDetails} onChange={(e) => updateFormField('adverseReactionDetails', e.target.value)} className="text-sm h-16" />
                </div>
              )}
            </div>

            <div className="space-y-4 border rounded-lg p-4">
              <h3 className="font-semibold text-sm">Culture/Laboratory Results</h3>
              <div className="space-y-1">
                <Label className="text-xs">Culture Status</Label>
                <Select value={formData.cultureStatus} onValueChange={(val: ReviewFormData['cultureStatus']) => updateFormField('cultureStatus', val)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="not_collected">Not collected</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="negative">Negative</SelectItem>
                    <SelectItem value="positive">Positive</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.cultureStatus === 'positive' && (
                <>
                  <div className="space-y-1">
                    <Label className="text-xs">Organism</Label>
                    <Input placeholder="e.g., E. coli, Strep pneumoniae" value={formData.cultureOrganism} onChange={(e) => updateFormField('cultureOrganism', e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Sensitivity/Resistance</Label>
                    <Input placeholder="e.g., Sensitive to current therapy" value={formData.cultureSensitivity} onChange={(e) => updateFormField('cultureSensitivity', e.target.value)} />
                  </div>
                </>
              )}
            </div>

            <div className="space-y-4 border rounded-lg p-4 bg-yellow-50">
              <h3 className="font-semibold text-sm">Stewardship Decision (F881)</h3>
              <div className="space-y-1">
                <Label className="text-xs">Recommendation</Label>
                <Select value={formData.stewardshipDecision} onValueChange={(val: ReviewFormData['stewardshipDecision']) => updateFormField('stewardshipDecision', val)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="continue">Continue current therapy</SelectItem>
                    <SelectItem value="modify">Modify therapy</SelectItem>
                    <SelectItem value="de-escalate">De-escalate therapy</SelectItem>
                    <SelectItem value="discontinue">Discontinue therapy</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {(formData.stewardshipDecision === 'modify' || formData.stewardshipDecision === 'de-escalate') && (
                <div className="space-y-1">
                  <Label className="text-xs">Modification Details</Label>
                  <Textarea placeholder="Describe recommended changes..." value={formData.modificationDetails} onChange={(e) => updateFormField('modificationDetails', e.target.value)} className="text-sm h-16" />
                </div>
              )}

              {formData.stewardshipDecision === 'discontinue' && (
                <div className="space-y-1">
                  <Label className="text-xs">Discontinue Reason</Label>
                  <Textarea placeholder="Reason for discontinuation..." value={formData.discontinueReason} onChange={(e) => updateFormField('discontinueReason', e.target.value)} className="text-sm h-16" />
                </div>
              )}

              {formData.stewardshipDecision === 'continue' && (
                <div className="space-y-1">
                  <Label className="text-xs">Planned Duration</Label>
                  <Input placeholder="e.g., 7 days, until [date]" value={formData.duration} onChange={(e) => updateFormField('duration', e.target.value)} />
                </div>
              )}

              <div className="space-y-1">
                <Label className="text-xs">Next Review Date</Label>
                <Input type="date" value={formData.nextReviewDate} onChange={(e) => updateFormField('nextReviewDate', e.target.value)} />
              </div>

              <div className="flex items-center gap-2">
                <Checkbox checked={formData.providerNotified} onCheckedChange={(checked) => updateFormField('providerNotified', !!checked)} />
                <span className="text-sm">Provider notified of recommendations</span>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Additional Recommendations</Label>
                <Textarea placeholder="Any additional stewardship recommendations..." value={formData.additionalRecommendations} onChange={(e) => updateFormField('additionalRecommendations', e.target.value)} className="text-sm h-16" />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="border rounded-lg p-4 bg-gray-50 sticky top-0">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">Generated Progress Note</h3>
                <Button variant="outline" size="sm" onClick={handleCopyNote}>
                  <Copy className="w-4 h-4 mr-2" />
                  Copy
                </Button>
              </div>
              <Textarea
                value={generatedNote}
                onChange={(e) => setGeneratedNote(e.target.value)}
                className="font-mono text-xs min-h-[600px] bg-white"
                placeholder="Progress note will generate as you fill out the review form..."
              />
              <p className="text-xs text-muted-foreground mt-2">✏️ Note auto-updates as you complete the review. Edit before copying/saving.</p>
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center pt-4 border-t">
          <p className="text-xs text-muted-foreground">F881 Antibiotic Stewardship Documentation</p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button variant="outline" onClick={handleCopyNote}>
              <Copy className="w-4 h-4 mr-2" />
              Copy Only
            </Button>
            <Button onClick={handleSaveNote}>
              <Save className="w-4 h-4 mr-2" />
              Save &amp; Update Record
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ABTReviewNoteModal;
