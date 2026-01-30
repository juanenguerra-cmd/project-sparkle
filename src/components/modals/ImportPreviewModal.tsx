import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { AlertTriangle, CheckCircle2, Users, Pill, Shield, Syringe, FileText, AlertCircle } from 'lucide-react';
import { canonicalMRN } from '@/lib/parsers';

export type ImportMode = 'merge' | 'replace';

export interface BackupPreview {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  counts: {
    residents: number;
    abt: number;
    ipCases: number;
    vax: number;
    notes: number;
    outbreaks: number;
    contacts: number;
  };
  exportedAt?: string;
  version?: string;
}

export interface ImportPreviewModalProps {
  open: boolean;
  file: File | null;
  onClose: () => void;
  onConfirm: (mode: ImportMode) => void;
  preview: BackupPreview | null;
  loading: boolean;
}

export const parseBackupPreview = async (file: File): Promise<BackupPreview> => {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    
    // Detect schema format
    const hasCensus = data.census?.residentsByMrn || data.residentsByMrn;
    const hasRecords = data.records || data.abx || data.ip_cases || data.vax || data.notes;
    
    if (!hasCensus && !hasRecords) {
      errors.push('Invalid backup file: missing census or records data');
      return { isValid: false, errors, warnings, counts: { residents: 0, abt: 0, ipCases: 0, vax: 0, notes: 0, outbreaks: 0, contacts: 0 } };
    }
    
    // Normalize structure
    const census = data.census || (data.residentsByMrn ? { residentsByMrn: data.residentsByMrn } : { residentsByMrn: {} });
    const records = data.records || {
      abx: data.abx || data.abt_worklist || [],
      ip_cases: data.ip_cases || [],
      vax: data.vax || data.vax_due || [],
      notes: data.notes || [],
      line_listings: data.line_listings || [],
      outbreaks: data.outbreaks || [],
      contacts: data.contacts || []
    };
    
    // Count records
    const residents = Object.keys(census.residentsByMrn || {}).length;
    const abt = Array.isArray(records.abx) ? records.abx.length : 0;
    const ipCases = Array.isArray(records.ip_cases) ? records.ip_cases.length : 0;
    const vax = Array.isArray(records.vax) ? records.vax.length : 0;
    const notes = Array.isArray(records.notes) ? records.notes.length : 0;
    const outbreaks = Array.isArray(records.outbreaks) ? records.outbreaks.length : 0;
    const contacts = Array.isArray(records.contacts) ? records.contacts.length : 0;
    
    // Validate data quality
    if (residents === 0 && abt === 0 && ipCases === 0 && vax === 0) {
      warnings.push('Backup file appears to be empty or contains no recognized data');
    }
    
    // Check for MRN format issues
    const residentMrns = Object.keys(census.residentsByMrn || {});
    const invalidMrns = residentMrns.filter(mrn => {
      const canonical = canonicalMRN(mrn);
      return !canonical || canonical.length < 3;
    });
    if (invalidMrns.length > 0) {
      warnings.push(`${invalidMrns.length} resident(s) have potentially invalid MRN formats`);
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      counts: { residents, abt, ipCases, vax, notes, outbreaks, contacts },
      exportedAt: data.exported_at,
      version: data.version
    };
  } catch (e) {
    errors.push(`Failed to parse JSON: ${e instanceof Error ? e.message : 'Unknown error'}`);
    return { isValid: false, errors, warnings, counts: { residents: 0, abt: 0, ipCases: 0, vax: 0, notes: 0, outbreaks: 0, contacts: 0 } };
  }
};

const ImportPreviewModal = ({ open, file, onClose, onConfirm, preview, loading }: ImportPreviewModalProps) => {
  const [importMode, setImportMode] = useState<ImportMode>('merge');

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {preview?.isValid ? (
              <CheckCircle2 className="w-5 h-5 text-green-500" />
            ) : (
              <AlertCircle className="w-5 h-5 text-destructive" />
            )}
            Import Preview
          </DialogTitle>
          <DialogDescription>
            {file?.name && <span className="font-medium">{file.name}</span>}
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="py-8 text-center">
            <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-muted-foreground">Analyzing backup file...</p>
          </div>
        )}

        {!loading && preview && (
          <div className="space-y-4">
            {/* Errors */}
            {preview.errors.length > 0 && (
              <Card className="border-destructive bg-destructive/5">
                <CardContent className="pt-4">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      {preview.errors.map((err, i) => (
                        <p key={i} className="text-sm text-destructive">{err}</p>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Warnings */}
            {preview.warnings.length > 0 && (
              <Card className="border-warning bg-warning/5">
                <CardContent className="pt-4">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      {preview.warnings.map((warn, i) => (
                        <p key={i} className="text-sm text-warning">{warn}</p>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Record Counts */}
            {preview.isValid && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <CountBadge icon={<Users className="w-3.5 h-3.5" />} label="Residents" count={preview.counts.residents} />
                  <CountBadge icon={<Pill className="w-3.5 h-3.5" />} label="ABT Records" count={preview.counts.abt} />
                  <CountBadge icon={<Shield className="w-3.5 h-3.5" />} label="IP Cases" count={preview.counts.ipCases} />
                  <CountBadge icon={<Syringe className="w-3.5 h-3.5" />} label="Vaccinations" count={preview.counts.vax} />
                  <CountBadge icon={<FileText className="w-3.5 h-3.5" />} label="Notes" count={preview.counts.notes} />
                  <CountBadge icon={<AlertCircle className="w-3.5 h-3.5" />} label="Outbreaks" count={preview.counts.outbreaks} />
                </div>

                {preview.exportedAt && (
                  <p className="text-xs text-muted-foreground text-center">
                    Exported: {new Date(preview.exportedAt).toLocaleString()}
                    {preview.version && ` • Version: ${preview.version}`}
                  </p>
                )}

                {/* Import Mode Selection */}
                <div className="space-y-3 p-3 border rounded-lg bg-muted/30">
                  <Label className="text-sm font-medium">Import Mode</Label>
                  <RadioGroup
                    value={importMode}
                    onValueChange={(v) => setImportMode(v as ImportMode)}
                    className="flex flex-col gap-2"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="merge" id="preview-merge" />
                      <Label htmlFor="preview-merge" className="text-sm font-normal cursor-pointer">
                        Merge with existing data
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="replace" id="preview-replace" />
                      <Label htmlFor="preview-replace" className="text-sm font-normal cursor-pointer">
                        Replace all existing data
                      </Label>
                    </div>
                  </RadioGroup>
                  <p className="text-xs text-muted-foreground">
                    {importMode === 'merge'
                      ? 'New records will be added. Existing records with the same ID will be updated.'
                      : 'All current data will be cleared before importing.'}
                  </p>
                </div>

                {importMode === 'replace' && (
                  <Card className="border-destructive bg-destructive/5">
                    <CardContent className="pt-4">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-destructive">
                          Warning: This will permanently delete all current data before importing!
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          {preview?.isValid && (
            <Button
              onClick={() => onConfirm(importMode)}
              variant={importMode === 'replace' ? 'destructive' : 'default'}
            >
              {importMode === 'replace' ? 'Replace & Import' : 'Merge & Import'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const CountBadge = ({ icon, label, count }: { icon: React.ReactNode; label: string; count: number }) => (
  <div className="flex items-center gap-2 p-2 rounded-md bg-muted/50">
    <span className="text-muted-foreground">{icon}</span>
    <span className="text-sm text-muted-foreground">{label}</span>
    <Badge variant={count > 0 ? 'default' : 'secondary'} className="ml-auto">
      {count}
    </Badge>
  </div>
);

export default ImportPreviewModal;
