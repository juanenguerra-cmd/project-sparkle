import { useMemo, useState } from 'react';
import { format, startOfMonth } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { AlertTriangle, ClipboardCheck, FileDown } from 'lucide-react';
import { toast } from 'sonner';
import { loadDB } from '@/lib/database';
import { buildSurveyPack, type SurveyPackType } from '@/lib/pdf/surveyPackPdf';

const PACKET_OPTIONS = [
  { id: 'survey_entrance', label: 'Survey Entrance', packType: 'audit' as SurveyPackType },
  { id: 'monthly', label: 'Monthly', packType: 'precautions' as SurveyPackType },
  { id: 'outbreak', label: 'Outbreak', packType: 'audit' as SurveyPackType },
  { id: 'unit_pull', label: 'Unit Pull', packType: 'precautions' as SurveyPackType },
  { id: 'custom', label: 'Custom', packType: 'vaccination' as SurveyPackType },
] as const;

type PacketPreset = (typeof PACKET_OPTIONS)[number]['id'];

type PacketAuditTrail = {
  packet_id: string;
  timestamp: string;
  preset: PacketPreset;
  filters: { fromDate: string; toDate: string; unit: string; resident: string };
  includedEvidence: string[];
};

const AUDIT_KEY = 'ip_command_dashboard_packet_audit';

const IPCommandDashboardPanel = () => {
  const [preset, setPreset] = useState<PacketPreset>('survey_entrance');
  const [fromDate, setFromDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [toDate, setToDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [unit, setUnit] = useState('all');
  const [resident, setResident] = useState('');
  const [busy, setBusy] = useState(false);

  const db = loadDB();
  const units = useMemo(() => Array.from(new Set(Object.values(db.census.residentsByMrn).map((r) => r.unit).filter(Boolean))).sort(), [db.census.residentsByMrn]);

  const runReadinessCheck = () => {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!fromDate || !toDate) errors.push('Date range is required.');
    if (fromDate > toDate) errors.push('From date must be on or before To date.');
    if (Object.keys(db.census.residentsByMrn).length === 0) warnings.push('No census residents loaded.');
    if (db.records.ip_cases.length === 0) warnings.push('No IP cases available for evidence pages.');

    return { errors, warnings };
  };

  const saveAudit = (entry: PacketAuditTrail) => {
    const existing = JSON.parse(localStorage.getItem(AUDIT_KEY) || '[]') as PacketAuditTrail[];
    existing.unshift(entry);
    localStorage.setItem(AUDIT_KEY, JSON.stringify(existing.slice(0, 25)));
  };

  const handleBuildPacket = async () => {
    const readiness = runReadinessCheck();
    if (readiness.errors.length > 0) {
      toast.error('Readiness check failed', { description: readiness.errors.join(' ') });
      return;
    }

    setBusy(true);
    try {
      const selectedPack = PACKET_OPTIONS.find((option) => option.id === preset);
      if (!selectedPack) return;

      const result = await buildSurveyPack({
        packType: selectedPack.packType,
        db,
        facility: db.settings.facilityName || 'Healthcare Facility',
        fromDate,
        toDate,
      });

      const packetId = `packet_${Date.now()}`;
      result.doc.save(`IP_Command_${preset}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);

      saveAudit({
        packet_id: packetId,
        timestamp: new Date().toISOString(),
        preset,
        filters: { fromDate, toDate, unit, resident },
        includedEvidence: [selectedPack.packType, 'cover', 'toc', 'appendix:data-gaps'],
      });

      const warnings = runReadinessCheck().warnings;
      toast.success('Packet assembled', {
        description: warnings.length > 0 ? `Built with warnings: ${warnings.join(' ')}` : 'Packet ready for binder export.',
      });
    } catch (error) {
      console.error(error);
      toast.error('Failed to build packet');
    } finally {
      setBusy(false);
    }
  };

  const readiness = runReadinessCheck();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><ClipboardCheck className="h-5 w-5" />IP Command Dashboard</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-5">
          <Select value={preset} onValueChange={(value) => setPreset(value as PacketPreset)}>
            <SelectTrigger><SelectValue placeholder="Preset" /></SelectTrigger>
            <SelectContent>{PACKET_OPTIONS.map((option) => <SelectItem key={option.id} value={option.id}>{option.label}</SelectItem>)}</SelectContent>
          </Select>
          <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          <Select value={unit} onValueChange={setUnit}>
            <SelectTrigger><SelectValue placeholder="Unit" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Units</SelectItem>
              {units.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input value={resident} onChange={(e) => setResident(e.target.value)} placeholder="Resident (optional)" />
        </div>

        {(readiness.errors.length > 0 || readiness.warnings.length > 0) && (
          <div className="rounded border bg-muted/40 p-3 text-sm">
            <p className="mb-1 font-medium flex items-center gap-1"><AlertTriangle className="h-4 w-4" />Data Gaps</p>
            {readiness.errors.map((item) => <p key={item} className="text-destructive">• {item}</p>)}
            {readiness.warnings.map((item) => <p key={item} className="text-muted-foreground">• {item}</p>)}
          </div>
        )}

        <Button onClick={handleBuildPacket} disabled={busy} className="gap-2">
          <FileDown className="h-4 w-4" />
          {busy ? 'Assembling Packet...' : 'Assemble Packet'}
        </Button>
      </CardContent>
    </Card>
  );
};

export default IPCommandDashboardPanel;
