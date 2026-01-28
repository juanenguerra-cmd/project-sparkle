import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { parseABTMedlistRaw, ParsedABTRow, canonicalMRN, nowISO, computeTxDays, makeAbxRecordId } from '@/lib/parsers';
import { loadDB, saveDB, addAudit } from '@/lib/database';
import { useToast } from '@/hooks/use-toast';
import { Search, Check } from 'lucide-react';

interface ABTImportModalProps {
  open: boolean;
  onClose: () => void;
  onImportComplete: () => void;
}

const INFECTION_SOURCES = ['Urinary', 'Respiratory', 'GI', 'Skin/Soft Tissue', 'Bloodstream', 'Other'];

const ABTImportModal = ({ open, onClose, onImportComplete }: ABTImportModalProps) => {
  const [rawText, setRawText] = useState('');
  const [parsed, setParsed] = useState<ParsedABTRow[]>([]);
  const [included, setIncluded] = useState<Set<number>>(new Set());
  const [sources, setSources] = useState<Record<number, string>>({});
  const { toast } = useToast();

  const updateField = (idx: number, field: keyof ParsedABTRow, value: string) => {
    setParsed(prev => prev.map((row, i) => 
      i === idx ? { ...row, [field]: value } : row
    ));
  };

  const handleParse = useCallback(() => {
    const rows = parseABTMedlistRaw(rawText);
    setParsed(rows);
    
    // Default: include non-TOP rows
    const defaultIncluded = new Set<number>();
    const defaultSources: Record<number, string> = {};
    
    rows.forEach((r, idx) => {
      if (r._include) {
        defaultIncluded.add(idx);
      }
      defaultSources[idx] = r.infection_source;
    });
    
    setIncluded(defaultIncluded);
    setSources(defaultSources);
    
    toast({
      title: `Parsed ${rows.length} ABT records`,
      description: 'TOP routes are excluded by default. Select records to import.'
    });
  }, [rawText, toast]);

  const toggleInclude = (idx: number) => {
    const newSet = new Set(included);
    if (newSet.has(idx)) {
      newSet.delete(idx);
    } else {
      newSet.add(idx);
    }
    setIncluded(newSet);
  };

  const updateSource = (idx: number, value: string) => {
    setSources(prev => ({ ...prev, [idx]: value }));
  };

  const handleImport = () => {
    const db = loadDB();
    const now = nowISO();
    
    let added = 0;
    let duplicates = 0;
    let blocked = 0;
    
    const existingIds = new Set(db.records.abx.map(r => r.record_id || r.id));
    
    parsed.forEach((row, idx) => {
      if (!included.has(idx)) return;
      
      const source = sources[idx] || row.infection_source;
      if (!source) {
        blocked++;
        return;
      }
      
      // Attach census info
      const mrn = canonicalMRN(row.mrn);
      const resident = db.census.residentsByMrn[mrn];
      
      const record = {
        id: row.record_id || makeAbxRecordId(row),
        record_id: row.record_id || makeAbxRecordId(row),
        mrn,
        name: row.name || resident?.name || '',
        residentName: row.name || resident?.name || '',
        unit: resident?.unit || row.unit || '',
        room: resident?.room || row.room || '',
        med_name: row.med_name,
        medication: row.med_name,
        dose: row.dose,
        route: row.route,
        route_raw: row.route_raw,
        indication: row.indication,
        infection_source: source,
        start_date: row.start_date,
        startDate: row.start_date,
        end_date: row.end_date,
        endDate: row.end_date,
        tx_days: computeTxDays(row.start_date, row.end_date),
        daysOfTherapy: computeTxDays(row.start_date, row.end_date),
        status: 'active' as const,
        updated_at: now,
        createdAt: now,
        source: 'order_listing_rawtext'
      };
      
      if (existingIds.has(record.record_id)) {
        duplicates++;
        return;
      }
      
      db.records.abx.unshift(record);
      existingIds.add(record.record_id);
      added++;
    });
    
    db.settings.last_import_at = now;
    addAudit(db, 'abx_import', `ABX import: added ${added}, duplicates ${duplicates}, blocked ${blocked}`, 'abt');
    saveDB(db);
    
    toast({
      title: 'ABT Records Imported',
      description: `Added ${added} records. ${duplicates} duplicates skipped.`
    });
    
    onImportComplete();
    onClose();
    setParsed([]);
    setRawText('');
    setIncluded(new Set());
    setSources({});
  };

  const handleClose = () => {
    onClose();
    setParsed([]);
    setRawText('');
    setIncluded(new Set());
    setSources({});
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Import ABT Medlist</DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden flex flex-col gap-4">
          {/* Raw Text Input */}
          <div>
            <label className="text-sm font-medium mb-2 block">Paste ABT Order Listing Raw Text</label>
            <Textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Paste ABT Order Listing Report raw text here..."
              className="min-h-[100px] font-mono text-sm"
            />
          </div>
          
          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button onClick={handleParse}>
              <Search className="w-4 h-4 mr-2" />
              Parse
            </Button>
          </div>
          
          {/* Preview Table */}
          {parsed.length > 0 && (
            <div className="flex-1 overflow-hidden">
              <div className="text-sm text-muted-foreground mb-2">
                Parsed {parsed.length} rows. {included.size} selected for import. TOP routes excluded by default.
              </div>
              <ScrollArea className="h-[280px] border rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-muted sticky top-0">
                    <tr>
                      <th className="px-2 py-2 text-left w-10">✓</th>
                      <th className="px-2 py-2 text-left">MRN</th>
                      <th className="px-2 py-2 text-left">Name</th>
                      <th className="px-2 py-2 text-left">Medication</th>
                      <th className="px-2 py-2 text-left">Dose</th>
                      <th className="px-2 py-2 text-left">Route</th>
                      <th className="px-2 py-2 text-left max-w-[160px]">Indication</th>
                      <th className="px-2 py-2 text-left w-[140px]">Source</th>
                      <th className="px-2 py-2 text-left">Start</th>
                      <th className="px-2 py-2 text-left">End</th>
                      <th className="px-2 py-2 text-left">Days</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.map((row, idx) => (
                      <tr key={idx} className={`border-t hover:bg-muted/50 ${row.route === 'TOP' ? 'opacity-50' : ''}`}>
                        <td className="px-2 py-1">
                          <Checkbox
                            checked={included.has(idx)}
                            onCheckedChange={() => toggleInclude(idx)}
                          />
                        </td>
                        <td className="px-1 py-1">
                          <Input
                            value={row.mrn}
                            onChange={(e) => updateField(idx, 'mrn', e.target.value)}
                            className="h-7 text-xs font-mono w-20 px-1"
                          />
                        </td>
                        <td className="px-1 py-1">
                          <Input
                            value={row.name}
                            onChange={(e) => updateField(idx, 'name', e.target.value)}
                            className="h-7 text-xs w-28 px-1"
                          />
                        </td>
                        <td className="px-1 py-1">
                          <Input
                            value={row.med_name}
                            onChange={(e) => updateField(idx, 'med_name', e.target.value)}
                            className="h-7 text-xs font-medium w-32 px-1"
                          />
                        </td>
                        <td className="px-1 py-1">
                          <Input
                            value={row.dose}
                            onChange={(e) => updateField(idx, 'dose', e.target.value)}
                            className="h-7 text-xs w-16 px-1"
                          />
                        </td>
                        <td className="px-1 py-1">
                          <Input
                            value={row.route}
                            onChange={(e) => updateField(idx, 'route', e.target.value)}
                            className={`h-7 text-xs w-12 px-1 ${row.route === 'TOP' ? 'text-muted-foreground' : ''}`}
                          />
                        </td>
                        <td className="px-1 py-1">
                          <Input
                            value={row.indication}
                            onChange={(e) => updateField(idx, 'indication', e.target.value)}
                            className="h-7 text-xs w-28 px-1"
                            title={row.indication}
                          />
                        </td>
                        <td className="px-1 py-1">
                          <Select 
                            value={sources[idx] || row.infection_source} 
                            onValueChange={(v) => updateSource(idx, v)}
                          >
                            <SelectTrigger className="h-7 text-xs w-28">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {INFECTION_SOURCES.map(s => (
                                <SelectItem key={s} value={s}>{s}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-1 py-1">
                          <Input
                            value={row.start_date}
                            onChange={(e) => updateField(idx, 'start_date', e.target.value)}
                            className="h-7 text-xs w-24 px-1"
                          />
                        </td>
                        <td className="px-1 py-1">
                          <Input
                            value={row.end_date || ''}
                            onChange={(e) => updateField(idx, 'end_date', e.target.value)}
                            className="h-7 text-xs w-24 px-1"
                            placeholder="—"
                          />
                        </td>
                        <td className="px-2 py-1 text-xs text-center">{row.tx_days || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollArea>
            </div>
          )}
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleImport} disabled={included.size === 0}>
            <Check className="w-4 h-4 mr-2" />
            Import Selected ({included.size})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ABTImportModal;
