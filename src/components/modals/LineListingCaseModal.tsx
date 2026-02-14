import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';
import { 
  getTemplateForOutbreak, 
  type LineListingFieldConfig,
  type CustomLineListingConfig 
} from '@/lib/lineListingTemplates';
import { SYMPTOM_OPTIONS, type Outbreak, type Resident, type LineListingEntry, type SymptomCategory } from '@/lib/types';
import { loadDB } from '@/lib/database';
import { todayISO } from '@/lib/parsers';
import { filterTemplateManagedFields, stripCoreFieldsFromTemplateData } from '@/lib/lineListingFieldFlow';

interface LineListingCaseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  outbreak: Outbreak | null;
  residents: Resident[];
  onSubmit: (data: {
    mrn: string;
    residentName: string;
    unit: string;
    room: string;
    isStaffOrVisitor: boolean;
    onsetDate: string;
    symptoms: string[];
    labResults: string;
    notes: string;
    templateData: Record<string, string | number | boolean | undefined>;
  }) => void;
  editingEntry?: LineListingEntry | null;
  mode?: 'add' | 'edit';
  prefill?: {
    mrn?: string;
    onsetDate?: string;
    symptoms?: string[];
    notes?: string;
  } | null;
}

const CATEGORY_ORDER = ['demographics', 'vaccines', 'predisposing', 'symptoms', 'outcomes', 'other'];
const CATEGORY_LABELS: Record<string, string> = {
  demographics: 'Demographics',
  vaccines: 'Vaccinations',
  predisposing: 'Predisposing Factors',
  symptoms: 'Symptoms',
  outcomes: 'Outcomes & Treatment',
  other: 'Other',
};

const LineListingCaseModal = ({
  open,
  onOpenChange,
  outbreak,
  residents,
  onSubmit,
  editingEntry,
  mode = 'add',
  prefill = null,
}: LineListingCaseModalProps) => {
  // Get saved field configuration from settings
  const db = loadDB();
  const savedConfig = outbreak 
    ? (db.settings.lineListingConfigs as Record<string, CustomLineListingConfig>)?.[getTemplateForOutbreak(outbreak.name, outbreak.type).id]
    : null;

  // Get template based on outbreak
  const template = useMemo(() => {
    if (!outbreak) return null;
    return getTemplateForOutbreak(outbreak.name, outbreak.type);
  }, [outbreak]);

  // Get enabled fields
  const enabledFields = useMemo(() => {
    if (!template) return [];
    
    if (savedConfig?.enabledFields) {
      const baseFields = template.fields.filter(f => savedConfig.enabledFields.includes(f.id));
      const customFields = savedConfig.customFields || [];
      return filterTemplateManagedFields([...baseFields, ...customFields]);
    }
    
    return filterTemplateManagedFields(template.fields.filter(f => f.defaultEnabled));
  }, [template, savedConfig]);

  // Form state
  const [isStaffOrVisitor, setIsStaffOrVisitor] = useState(false);
  const [caseMrn, setCaseMrn] = useState('');
  const [staffVisitorName, setStaffVisitorName] = useState('');
  const [caseOnsetDate, setCaseOnsetDate] = useState(todayISO());
  const [caseSymptoms, setCaseSymptoms] = useState<string[]>([]);
  const [caseLabResults, setCaseLabResults] = useState('');
  const [caseNotes, setCaseNotes] = useState('');
  const [templateData, setTemplateData] = useState<Record<string, string | number | boolean | undefined>>({});
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['demographics', 'symptoms']));

  // Reset form when modal opens/closes
  useEffect(() => {
    if (open) {
      if (editingEntry && mode === 'edit') {
        setIsStaffOrVisitor(editingEntry.mrn.startsWith('staff_'));
        setCaseMrn(editingEntry.mrn);
        setStaffVisitorName(editingEntry.residentName.replace('[Staff/Visitor] ', ''));
        setCaseOnsetDate(editingEntry.onsetDate);
        setCaseSymptoms(editingEntry.symptoms);
        setCaseLabResults(editingEntry.labResults || '');
        setCaseNotes(editingEntry.notes || '');
        setTemplateData(editingEntry.templateData || {});
      } else {
        setIsStaffOrVisitor(false);
        setCaseMrn('');
        setStaffVisitorName('');
        setCaseOnsetDate(todayISO());
        setCaseSymptoms([]);
        setCaseLabResults('');
        setCaseNotes('');
        setTemplateData({});
      }
    }
  }, [open, editingEntry, mode]);

  useEffect(() => {
    if (!open || mode !== 'add' || editingEntry) return;
    if (prefill?.mrn) {
      setIsStaffOrVisitor(false);
      setCaseMrn(prefill.mrn);
    }
    if (prefill?.onsetDate) {
      setCaseOnsetDate(prefill.onsetDate);
    }
    if (prefill?.symptoms) {
      setCaseSymptoms(prefill.symptoms);
    }
    if (prefill?.notes) {
      setCaseNotes(prefill.notes);
    }
  }, [open, mode, editingEntry, prefill]);

  const getSymptomOptions = (category: SymptomCategory) => 
    SYMPTOM_OPTIONS.filter(s => s.category === category);

  const handleFieldChange = (fieldId: string, value: string | number | boolean | undefined) => {
    setTemplateData(prev => ({ ...prev, [fieldId]: value }));
  };

  const handleSubmit = () => {
    let residentName = '';
    let unit = '';
    let room = '';
    let mrn = '';

    if (isStaffOrVisitor) {
      residentName = `[Staff/Visitor] ${staffVisitorName}`;
      mrn = `staff_${Date.now()}`;
      unit = 'N/A';
      room = 'N/A';
    } else {
      const resident = residents.find(r => r.mrn === caseMrn);
      if (!resident && mode === 'add') return;
      residentName = resident?.name || editingEntry?.residentName || '';
      mrn = resident?.mrn || editingEntry?.mrn || '';
      unit = resident?.unit || editingEntry?.unit || '';
      room = resident?.room || editingEntry?.room || '';
    }

    onSubmit({
      mrn,
      residentName,
      unit,
      room,
      isStaffOrVisitor,
      onsetDate: caseOnsetDate,
      symptoms: caseSymptoms,
      labResults: caseLabResults,
      notes: caseNotes,
      templateData: stripCoreFieldsFromTemplateData(templateData),
    });
  };

  const renderField = (field: LineListingFieldConfig) => {
    const value = templateData[field.id];

    switch (field.type) {
      case 'checkbox':
        return (
          <div key={field.id} className="flex items-center gap-2">
            <Checkbox
              id={field.id}
              checked={value === true}
              onCheckedChange={(checked) => handleFieldChange(field.id, checked === true)}
            />
            <Label htmlFor={field.id} className="text-sm cursor-pointer">
              {field.label}
            </Label>
          </div>
        );
      case 'select':
        return (
          <div key={field.id} className="space-y-1">
            <Label className="text-xs text-muted-foreground">{field.label}</Label>
            <Select 
              value={String(value || '')} 
              onValueChange={(v) => handleFieldChange(field.id, v)}
            >
              <SelectTrigger className="h-8">
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent>
                {field.options?.map(opt => (
                  <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );
      case 'date':
        return (
          <div key={field.id} className="space-y-1">
            <Label className="text-xs text-muted-foreground">{field.label}</Label>
            <Input
              type="date"
              value={String(value || '')}
              onChange={(e) => handleFieldChange(field.id, e.target.value)}
              className="h-8"
            />
          </div>
        );
      case 'number':
        return (
          <div key={field.id} className="space-y-1">
            <Label className="text-xs text-muted-foreground">{field.label}</Label>
            <Input
              type="number"
              value={String(value || '')}
              onChange={(e) => handleFieldChange(field.id, e.target.value ? Number(e.target.value) : undefined)}
              className="h-8"
            />
          </div>
        );
      default:
        return (
          <div key={field.id} className="space-y-1">
            <Label className="text-xs text-muted-foreground">{field.label}</Label>
            <Input
              value={String(value || '')}
              onChange={(e) => handleFieldChange(field.id, e.target.value)}
              className="h-8"
              placeholder={field.label}
            />
          </div>
        );
    }
  };

  // Group fields by category
  const groupedFields = useMemo(() => {
    const groups: Record<string, LineListingFieldConfig[]> = {};
    enabledFields.forEach(field => {
      const cat = field.category || 'other';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(field);
    });
    return groups;
  }, [enabledFields]);

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  if (!outbreak) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/*
        IMPORTANT: Make the modal itself the scroll container.
        This is the most reliable approach for mouse-wheel scrolling in dialogs on desktop.
      */}
      <DialogContent className="max-w-2xl max-h-[90vh] p-0 overflow-y-auto">
        <div className="flex min-h-0 flex-col">
          {/* Sticky header */}
          <div className="sticky top-0 z-10 bg-background border-b p-6 pb-4 pr-12">
            <DialogHeader>
              <DialogTitle>
                {mode === 'edit' ? `Edit Case: ${editingEntry?.residentName}` : 'Add Case to Line Listing'}
              </DialogTitle>
              <p className="text-sm text-muted-foreground">
                {outbreak.name} • {template?.name || 'Generic'} Template
              </p>
            </DialogHeader>
          </div>

          {/* Content */}
          <div className="space-y-4 p-6 pt-4 pb-24">
            {/* Basic Info */}
            <div className="space-y-4 border-b pb-4">
              {/* Staff/Visitor Toggle */}
              {mode === 'add' && (
                <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg">
                  <Checkbox
                    id="staffVisitor"
                    checked={isStaffOrVisitor}
                    onCheckedChange={(checked) => {
                      setIsStaffOrVisitor(checked === true);
                      if (checked) setCaseMrn('');
                    }}
                  />
                  <Label htmlFor="staffVisitor" className="text-sm font-medium cursor-pointer">
                    Staff or Visitor (not a resident)
                  </Label>
                </div>
              )}

              {isStaffOrVisitor ? (
                <div className="space-y-2">
                  <Label>Staff/Visitor Name</Label>
                  <Input
                    value={staffVisitorName}
                    onChange={(e) => setStaffVisitorName(e.target.value)}
                    placeholder="Enter name..."
                  />
                </div>
              ) : mode === 'add' ? (
                <div className="space-y-2">
                  <Label>Resident</Label>
                  <Select value={caseMrn} onValueChange={setCaseMrn}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select resident..." />
                    </SelectTrigger>
                    <SelectContent>
                      {residents.map((r) => (
                        <SelectItem key={r.mrn} value={r.mrn}>
                          {r.name} - {r.room} ({r.unit})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}

              <div className="space-y-2">
                <Label>Onset Date</Label>
                <Input type="date" value={caseOnsetDate} onChange={(e) => setCaseOnsetDate(e.target.value)} />
              </div>
            </div>

            {/* Template Fields by Category */}
            {CATEGORY_ORDER.map((category) => {
              const fields = groupedFields[category];
              if (!fields || fields.length === 0) return null;

              const checkboxFields = fields.filter((f) => f.type === 'checkbox');
              const otherFields = fields.filter((f) => f.type !== 'checkbox');

              return (
                <Collapsible
                  key={category}
                  open={expandedCategories.has(category)}
                  onOpenChange={() => toggleCategory(category)}
                >
                  <CollapsibleTrigger className="flex items-center justify-between w-full p-2 bg-muted/50 rounded-lg hover:bg-muted/70">
                    <span className="text-sm font-medium">{CATEGORY_LABELS[category]}</span>
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${expandedCategories.has(category) ? 'rotate-180' : ''}`}
                    />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-3">
                    <div className="space-y-3">
                      {/* Non-checkbox fields in grid */}
                      {otherFields.length > 0 && (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                          {otherFields.map((field) => renderField(field))}
                        </div>
                      )}

                      {/* Checkbox fields in flex wrap */}
                      {checkboxFields.length > 0 && (
                        <div className="flex flex-wrap gap-x-4 gap-y-2 p-3 bg-muted/30 rounded-lg">
                          {checkboxFields.map((field) => renderField(field))}
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}

            {/* Legacy Symptoms (for backwards compatibility) */}
            <Collapsible
              open={expandedCategories.has('legacy_symptoms')}
              onOpenChange={() => toggleCategory('legacy_symptoms')}
            >
              <CollapsibleTrigger className="flex items-center justify-between w-full p-2 bg-muted/50 rounded-lg hover:bg-muted/70">
                <span className="text-sm font-medium">Quick Symptoms Select</span>
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${expandedCategories.has('legacy_symptoms') ? 'rotate-180' : ''}`}
                />
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-3">
                <div className="flex flex-wrap gap-2 p-3 border rounded-lg max-h-32 overflow-y-auto">
                  {getSymptomOptions(outbreak.type).map((symptom) => (
                    <Badge
                      key={symptom.id}
                      variant={caseSymptoms.includes(symptom.id) ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => {
                        setCaseSymptoms((prev) =>
                          prev.includes(symptom.id) ? prev.filter((s) => s !== symptom.id) : [...prev, symptom.id],
                        );
                      }}
                    >
                      {symptom.name}
                    </Badge>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Lab Results & Notes */}
            <div className="space-y-4 border-t pt-4">
              <div className="space-y-2">
                <Label>Lab Results</Label>
                <Input
                  value={caseLabResults}
                  onChange={(e) => setCaseLabResults(e.target.value)}
                  placeholder="e.g., COVID+ PCR, Flu A+"
                />
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea value={caseNotes} onChange={(e) => setCaseNotes(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Sticky footer */}
          <div className="sticky bottom-0 z-10 bg-background border-t p-6 pt-4">
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmit}>{mode === 'edit' ? 'Update' : 'Add to Line Listing'}</Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LineListingCaseModal;
