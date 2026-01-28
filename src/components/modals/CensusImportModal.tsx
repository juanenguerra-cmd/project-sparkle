import { useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { parseCensusRaw, ParsedCensusRow, canonicalMRN, nowISO, isValidUnit } from '@/lib/parsers';
import { loadDB, saveDB, addAudit } from '@/lib/database';
import { autoDischargeDroppedResidents } from '@/lib/autoDischarge';
import { useToast } from '@/hooks/use-toast';
import { Search, CheckSquare, Square, AlertTriangle, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CensusImportModalProps {
  open: boolean;
  onClose: () => void;
  onImportComplete: () => void;
}

type ValidationStatus = 'valid' | 'warning' | 'error';

interface ValidatedRow extends ParsedCensusRow {
  validation: {
    status: ValidationStatus;
    issues: string[];
  };
}

const validateRow = (row: ParsedCensusRow): ValidatedRow['validation'] => {
  const issues: string[] = [];
  
  if (!row.unit) {
    issues.push('Missing unit');
  } else if (!isValidUnit(row.unit)) {
    issues.push(`Invalid unit: ${row.unit}`);
  }
  
  if (!row.room || !row.room.trim()) {
    issues.push('Missing room');
  }
  
  if (!row.name || !row.name.trim()) {
    issues.push('Missing name');
  }
  
  if (!row.dob_raw || !row.dob_raw.trim()) {
    issues.push('Missing DOB');
  }
  
  let status: ValidationStatus = 'valid';
  if (issues.some(i => i.includes('Invalid unit') || i.includes('Missing unit'))) {
    status = 'error';
  } else if (issues.length > 0) {
    status = 'warning';
  }
  
  return { status, issues };
};

const VALID_UNITS = ['Unit 2', 'Unit 3', 'Unit 4'];

const CensusImportModal = ({ open, onClose, onImportComplete }: CensusImportModalProps) => {
  const [rawText, setRawText] = useState('');
  const [parsed, setParsed] = useState<ParsedCensusRow[]>([]);
  const [included, setIncluded] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  // Validate all parsed rows
  const validatedRows = useMemo((): ValidatedRow[] => {
    return parsed.map(row => ({
      ...row,
      validation: validateRow(row)
    }));
  }, [parsed]);

  // Summary counts
  const validationSummary = useMemo(() => {
    const valid = validatedRows.filter(r => r.validation.status === 'valid').length;
    const warnings = validatedRows.filter(r => r.validation.status === 'warning').length;
    const errors = validatedRows.filter(r => r.validation.status === 'error').length;
    return { valid, warnings, errors, total: validatedRows.length };
  }, [validatedRows]);

  const handleParse = useCallback(() => {
    const rows = parseCensusRaw(rawText);
    setParsed(rows);
    
    const defaultIncluded = new Set<string>();
    rows.forEach(r => {
      const validation = validateRow(r);
      if (validation.status !== 'error' && (r.room.trim() || r.dob_raw.trim())) {
        defaultIncluded.add(r.mrn);
      }
    });
    setIncluded(defaultIncluded);
    
    toast({
      title: `Parsed ${rows.length} rows`,
      description: 'Review and edit rows before importing.'
    });
  }, [rawText, toast]);

  // Edit a specific field in a row
  const handleEditRow = (mrn: string, field: keyof ParsedCensusRow, value: string) => {
    setParsed(prev => prev.map(row => 
      row.mrn === mrn ? { ...row, [field]: value } : row
    ));
  };

  const handleSelectAll = () => {
    setIncluded(new Set(parsed.map(r => r.mrn)));
  };

  const handleSelectValid = () => {
    const validMrns = validatedRows
      .filter(r => r.validation.status === 'valid')
      .map(r => r.mrn);
    setIncluded(new Set(validMrns));
  };

  const handleSelectNone = () => {
    setIncluded(new Set());
  };

  const toggleInclude = (mrn: string) => {
    const newSet = new Set(included);
    if (newSet.has(mrn)) {
      newSet.delete(mrn);
    } else {
      newSet.add(mrn);
    }
    setIncluded(newSet);
  };

  const handleApply = () => {
    const db = loadDB();
    const now = nowISO();
    const rowsToImport = parsed.filter(r => included.has(r.mrn));
    
    // Build set of canonical MRNs that are in the new census
    const seenCanonicalMRNs = new Set<string>();
    
    rowsToImport.forEach(r => {
      const mrn = canonicalMRN(r.mrn);
      if (!mrn) return;
      
      seenCanonicalMRNs.add(mrn);
      
      const prev = db.census.residentsByMrn[mrn];
      db.census.residentsByMrn[mrn] = {
        id: prev?.id || `res_${mrn}`,
        mrn,
        name: r.name || prev?.name || '',
        unit: r.unit || prev?.unit || '',
        room: r.room || prev?.room || '',
        dob_raw: r.dob_raw || prev?.dob_raw || '',
        status: r.status || prev?.status || '',
        payor: r.payor || prev?.payor || '',
        active_on_census: true,
        last_seen_census_at: now,
        last_missing_census_at: prev?.last_missing_census_at || null
      };
    });
    
    // Collect MRNs of residents being dropped from census
    const droppedMRNs: string[] = [];
    let dropped = 0;
    Object.keys(db.census.residentsByMrn).forEach(mrn => {
      // Compare using canonical MRNs to ensure proper matching
      if (!seenCanonicalMRNs.has(mrn)) {
        const rec = db.census.residentsByMrn[mrn];
        if (rec.active_on_census) {
          rec.active_on_census = false;
          rec.last_missing_census_at = now;
          droppedMRNs.push(mrn);
          dropped++;
          console.log(`[Auto-Discharge] Resident dropped from census: ${rec.name} (MRN: ${mrn})`);
        }
      }
    });
    
    // Auto-discharge all tracker records for dropped residents
    const dischargeResult = autoDischargeDroppedResidents(db, droppedMRNs);
    
    db.census.meta = { imported_at: now };
    db.settings.last_import_at = now;
    
    addAudit(db, 'census_import', `Census imported: ${rowsToImport.length} residents, ${dropped} marked inactive`, 'census');
    saveDB(db);
    
    // Build detailed toast message
    let description = `Imported ${rowsToImport.length} residents`;
    if (dropped > 0) {
      description += `, ${dropped} discharged`;
      const closedItems = [];
      if (dischargeResult.abtClosed > 0) closedItems.push(`${dischargeResult.abtClosed} ABT`);
      if (dischargeResult.ipClosed > 0) closedItems.push(`${dischargeResult.ipClosed} IP`);
      if (dischargeResult.vaxClosed > 0) closedItems.push(`${dischargeResult.vaxClosed} VAX`);
      if (closedItems.length > 0) {
        description += ` (auto-closed: ${closedItems.join(', ')})`;
      }
    }
    
    toast({
      title: 'Census Updated',
      description
    });
    
    onImportComplete();
    onClose();
    setParsed([]);
    setRawText('');
    setIncluded(new Set());
  };

  const handleClose = () => {
    onClose();
    setParsed([]);
    setRawText('');
    setIncluded(new Set());
  };

  const getRowClassName = (validation: ValidatedRow['validation']) => {
    switch (validation.status) {
      case 'error':
        return 'bg-destructive/10';
      case 'warning':
        return 'bg-warning/10';
      default:
        return '';
    }
  };

  const getStatusIcon = (status: ValidationStatus) => {
    switch (status) {
      case 'error':
        return <AlertTriangle className="w-4 h-4 text-destructive" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-warning" />;
      default:
        return <CheckCircle className="w-4 h-4 text-success" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="max-w-[95vw] w-[1200px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Update Census</DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden flex flex-col gap-4">
          {/* Raw Text Input */}
          <div>
            <label className="text-sm font-medium mb-2 block">Paste Census Raw Text</label>
            <Textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Paste daily census text here..."
              className="min-h-[100px] font-mono text-sm"
            />
          </div>
          
          {/* Action Buttons */}
          <div className="flex gap-2 flex-wrap">
            <Button onClick={handleParse}>
              <Search className="w-4 h-4 mr-2" />
              Parse
            </Button>
            <Button variant="outline" onClick={handleSelectAll} disabled={parsed.length === 0}>
              <CheckSquare className="w-4 h-4 mr-2" />
              Select All
            </Button>
            <Button variant="outline" onClick={handleSelectValid} disabled={parsed.length === 0}>
              <CheckCircle className="w-4 h-4 mr-2" />
              Select Valid Only
            </Button>
            <Button variant="outline" onClick={handleSelectNone} disabled={parsed.length === 0}>
              <Square className="w-4 h-4 mr-2" />
              Select None
            </Button>
          </div>
          
          {/* Validation Summary */}
          {parsed.length > 0 && (
            <div className="flex items-center gap-4 p-3 bg-muted rounded-lg text-sm flex-wrap">
              <span className="font-medium">Validation:</span>
              <span className="flex items-center gap-1">
                <CheckCircle className="w-4 h-4 text-success" />
                {validationSummary.valid} valid
              </span>
              {validationSummary.warnings > 0 && (
                <span className="flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4 text-warning" />
                  {validationSummary.warnings} warnings
                </span>
              )}
              {validationSummary.errors > 0 && (
                <span className="flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4 text-destructive" />
                  {validationSummary.errors} errors
                </span>
              )}
              <span className="text-muted-foreground ml-auto">
                {included.size} selected
              </span>
            </div>
          )}
          
          {/* Editable Preview Table */}
          {parsed.length > 0 && (
            <div className="flex-1 min-h-0">
              <ScrollArea className="h-[350px] border rounded-lg">
                <div className="min-w-[900px]">
                  <table className="w-full text-sm">
                    <thead className="bg-muted sticky top-0 z-10">
                      <tr>
                        <th className="px-2 py-2 text-left w-10">✓</th>
                        <th className="px-2 py-2 text-left w-10">Status</th>
                        <th className="px-2 py-2 text-left w-24">MRN</th>
                        <th className="px-2 py-2 text-left min-w-[180px]">Name</th>
                        <th className="px-2 py-2 text-left w-28">Unit</th>
                        <th className="px-2 py-2 text-left w-20">Room</th>
                        <th className="px-2 py-2 text-left w-28">DOB</th>
                        <th className="px-2 py-2 text-left w-24">Status</th>
                        <th className="px-2 py-2 text-left min-w-[150px]">Issues</th>
                      </tr>
                    </thead>
                    <tbody>
                      {validatedRows.map((row) => (
                        <tr 
                          key={row.mrn} 
                          className={cn(
                            "border-t hover:bg-muted/50 transition-colors",
                            getRowClassName(row.validation)
                          )}
                        >
                          <td className="px-2 py-1.5">
                            <Checkbox
                              checked={included.has(row.mrn)}
                              onCheckedChange={() => toggleInclude(row.mrn)}
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            {getStatusIcon(row.validation.status)}
                          </td>
                          <td className="px-2 py-1.5 font-mono text-xs">{row.mrn}</td>
                          <td className="px-2 py-1.5">
                            <Input
                              value={row.name}
                              onChange={(e) => handleEditRow(row.mrn, 'name', e.target.value)}
                              className={cn(
                                "h-7 text-sm",
                                !row.name && "border-destructive"
                              )}
                              placeholder="Name"
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <Select 
                              value={row.unit} 
                              onValueChange={(v) => handleEditRow(row.mrn, 'unit', v)}
                            >
                              <SelectTrigger className={cn(
                                "h-7 text-sm",
                                (!row.unit || !isValidUnit(row.unit)) && "border-destructive"
                              )}>
                                <SelectValue placeholder="Select unit" />
                              </SelectTrigger>
                              <SelectContent>
                                {VALID_UNITS.map(u => (
                                  <SelectItem key={u} value={u}>{u}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-2 py-1.5">
                            <Input
                              value={row.room}
                              onChange={(e) => handleEditRow(row.mrn, 'room', e.target.value)}
                              className={cn(
                                "h-7 text-sm w-16",
                                !row.room && "border-warning"
                              )}
                              placeholder="Room"
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <Input
                              value={row.dob_raw}
                              onChange={(e) => handleEditRow(row.mrn, 'dob_raw', e.target.value)}
                              className="h-7 text-sm w-24"
                              placeholder="MM/DD/YYYY"
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <Input
                              value={row.status}
                              onChange={(e) => handleEditRow(row.mrn, 'status', e.target.value)}
                              className="h-7 text-sm w-20"
                              placeholder="Status"
                            />
                          </td>
                          <td className="px-2 py-1.5 text-xs text-muted-foreground">
                            {row.validation.issues.length > 0 ? (
                              <span className={cn(
                                row.validation.status === 'error' && "text-destructive",
                                row.validation.status === 'warning' && "text-warning"
                              )}>
                                {row.validation.issues.join('; ')}
                              </span>
                            ) : (
                              <span className="text-success">✓</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </div>
          )}
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleApply} disabled={included.size === 0}>
            Apply Update ({included.size} residents)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CensusImportModal;
