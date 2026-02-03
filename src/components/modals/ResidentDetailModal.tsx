import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Pill, ShieldAlert, Syringe, FileText, User, Edit, Trash2, Calendar, MapPin, Phone, Clock, Plus, AlertTriangle } from 'lucide-react';
import { Resident, ABTRecord, IPCase, VaxRecord, Note } from '@/lib/types';
import { loadDB, saveDB, addAudit } from '@/lib/database';
import { todayISO } from '@/lib/parsers';
import { useToast } from '@/hooks/use-toast';

interface ResidentDetailModalProps {
  open: boolean;
  onClose: () => void;
  resident: Resident | null;
}

const deriveAbtStatus = (record: ABTRecord, today: string): 'active' | 'completed' | 'discontinued' => {
  const status = (record.status || '').toLowerCase();
  if (status === 'discontinued') return 'discontinued';
  const endDate = record.endDate || record.end_date;
  if (endDate) return 'completed';
  return 'active';
};

const ResidentDetailModal = ({ open, onClose, resident }: ResidentDetailModalProps) => {
  const { toast } = useToast();
  const [db, setDb] = useState(() => loadDB());
  const [editingRecord, setEditingRecord] = useState<{ type: string; record: any } | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  
  if (!resident) return null;

  const today = todayISO();

  const refreshData = () => setDb(loadDB());
  
  // Filter records for this resident
  const abtRecords = db.records.abx.filter(r => r.mrn === resident.mrn);
  const ipCases = db.records.ip_cases.filter(r => r.mrn === resident.mrn);
  const vaxRecords = db.records.vax.filter(r => r.mrn === resident.mrn);
  const notes = db.records.notes.filter(r => r.mrn === resident.mrn).sort((a, b) => 
    new Date(b.createdAt || b.created_at || '').getTime() - new Date(a.createdAt || a.created_at || '').getTime()
  );

  const activeAbt = abtRecords.filter(r => deriveAbtStatus(r, today) === 'active');
  const activeIp = ipCases.filter(r => r.status === 'Active');
  const dueVax = vaxRecords.filter(r => r.status === 'due' || r.status === 'overdue');
  const hasAlerts = activeAbt.length > 0 || activeIp.length > 0 || dueVax.some(v => v.status === 'overdue');

  const handleDelete = (type: string, id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete this ${type} record?`)) return;
    
    const updatedDb = loadDB();
    
    switch (type) {
      case 'abt':
        updatedDb.records.abx = updatedDb.records.abx.filter(r => r.id !== id);
        addAudit(updatedDb, 'abt_delete', `Deleted ABT record: ${name}`, 'abx');
        break;
      case 'ip':
        updatedDb.records.ip_cases = updatedDb.records.ip_cases.filter(r => r.id !== id);
        addAudit(updatedDb, 'ip_delete', `Deleted IP case: ${name}`, 'ip');
        break;
      case 'vax':
        updatedDb.records.vax = updatedDb.records.vax.filter(r => r.id !== id);
        addAudit(updatedDb, 'vax_delete', `Deleted VAX record: ${name}`, 'vax');
        break;
      case 'note':
        updatedDb.records.notes = updatedDb.records.notes.filter(r => r.id !== id);
        addAudit(updatedDb, 'note_delete', `Deleted note`, 'notes');
        break;
    }
    
    saveDB(updatedDb);
    setDb(updatedDb);
    toast({ title: 'Record deleted', description: `${type.toUpperCase()} record has been removed.` });
  };

  const handleEdit = (type: string, record: any) => {
    setEditingRecord({ type, record: { ...record } });
  };

  const handleSaveEdit = () => {
    if (!editingRecord) return;
    
    const updatedDb = loadDB();
    const { type, record } = editingRecord;
    
    switch (type) {
      case 'abt':
        const abtIdx = updatedDb.records.abx.findIndex(r => r.id === record.id);
        if (abtIdx !== -1) {
          updatedDb.records.abx[abtIdx] = { ...updatedDb.records.abx[abtIdx], ...record };
          addAudit(updatedDb, 'abt_edit', `Updated ABT: ${record.medication || record.med_name}`, 'abx');
        }
        break;
      case 'ip':
        const ipIdx = updatedDb.records.ip_cases.findIndex(r => r.id === record.id);
        if (ipIdx !== -1) {
          updatedDb.records.ip_cases[ipIdx] = { ...updatedDb.records.ip_cases[ipIdx], ...record };
          addAudit(updatedDb, 'ip_edit', `Updated IP: ${record.infectionType}`, 'ip');
        }
        break;
      case 'vax':
        const vaxIdx = updatedDb.records.vax.findIndex(r => r.id === record.id);
        if (vaxIdx !== -1) {
          updatedDb.records.vax[vaxIdx] = { ...updatedDb.records.vax[vaxIdx], ...record };
          addAudit(updatedDb, 'vax_edit', `Updated VAX: ${record.vaccine}`, 'vax');
        }
        break;
      case 'note':
        const noteIdx = updatedDb.records.notes.findIndex(r => r.id === record.id);
        if (noteIdx !== -1) {
          updatedDb.records.notes[noteIdx] = { ...updatedDb.records.notes[noteIdx], ...record };
          addAudit(updatedDb, 'note_edit', `Updated note`, 'notes');
        }
        break;
    }
    
    saveDB(updatedDb);
    setDb(updatedDb);
    setEditingRecord(null);
    toast({ title: 'Record updated', description: 'Changes have been saved.' });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-primary/10">
              <User className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="text-xl">{resident.name}</div>
              <div className="text-sm font-normal text-muted-foreground">
                MRN: {resident.mrn} • {resident.unit}/{resident.room}
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>

        {/* Summary Stats */}
        <div className="grid grid-cols-4 gap-3 py-3 border-b">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-lg font-bold text-destructive">
              <Pill className="w-4 h-4" />
              {activeAbt.length}
            </div>
            <div className="text-xs text-muted-foreground">Active ABT</div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-lg font-bold text-warning">
              <ShieldAlert className="w-4 h-4" />
              {activeIp.length}
            </div>
            <div className="text-xs text-muted-foreground">Active IP</div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-lg font-bold text-info">
              <Syringe className="w-4 h-4" />
              {dueVax.length}
            </div>
            <div className="text-xs text-muted-foreground">VAX Due</div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-lg font-bold text-success">
              <FileText className="w-4 h-4" />
              {notes.length}
            </div>
            <div className="text-xs text-muted-foreground">Notes</div>
          </div>
        </div>

        <Tabs defaultValue="overview" className="flex-1 overflow-hidden flex flex-col" value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-5 w-full">
            <TabsTrigger value="overview" className="gap-1">
              <User className="w-3.5 h-3.5" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="abt" className="gap-1">
              <Pill className="w-3.5 h-3.5" />
              ABT ({abtRecords.length})
            </TabsTrigger>
            <TabsTrigger value="ip" className="gap-1">
              <ShieldAlert className="w-3.5 h-3.5" />
              IP ({ipCases.length})
            </TabsTrigger>
            <TabsTrigger value="vax" className="gap-1">
              <Syringe className="w-3.5 h-3.5" />
              VAX ({vaxRecords.length})
            </TabsTrigger>
            <TabsTrigger value="notes" className="gap-1">
              <FileText className="w-3.5 h-3.5" />
              Notes ({notes.length})
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 min-h-0 mt-4">
            {/* Overview Tab */}
            <TabsContent value="overview" className="mt-0 space-y-4">
              {/* Alerts Section */}
              {hasAlerts && (
                <div className="space-y-2">
                  {activeAbt.length > 0 && (
                    <div className="flex items-center gap-3 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                      <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0" />
                      <div>
                        <p className="font-medium text-destructive">Active Antibiotics ({activeAbt.length})</p>
                        <p className="text-sm text-muted-foreground">
                          {activeAbt.map(r => r.medication || r.med_name).join(', ')}
                        </p>
                      </div>
                    </div>
                  )}
                  {activeIp.length > 0 && (
                    <div className="flex items-center gap-3 p-3 bg-warning/10 border border-warning/20 rounded-lg">
                      <ShieldAlert className="w-5 h-5 text-warning flex-shrink-0" />
                      <div>
                        <p className="font-medium text-warning">Active IP Cases ({activeIp.length})</p>
                        <p className="text-sm text-muted-foreground">
                          {activeIp.map(r => `${r.infectionType || r.infection_type} (${r.protocol})`).join(', ')}
                        </p>
                      </div>
                    </div>
                  )}
                  {dueVax.some(v => v.status === 'overdue') && (
                    <div className="flex items-center gap-3 p-3 bg-info/10 border border-info/20 rounded-lg">
                      <Syringe className="w-5 h-5 text-info flex-shrink-0" />
                      <div>
                        <p className="font-medium text-info">Overdue Vaccinations</p>
                        <p className="text-sm text-muted-foreground">
                          {dueVax.filter(v => v.status === 'overdue').map(r => r.vaccine || r.vaccine_type).join(', ')}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Resident Info Card */}
              <div className="border rounded-lg p-4 bg-card">
                <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Resident Information
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Full Name</span>
                    <p className="font-medium">{resident.name}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">MRN</span>
                    <p className="font-medium font-mono">{resident.mrn}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">DOB</span>
                    <p className="font-medium">{resident.dob || resident.dob_raw || '—'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Unit</span>
                    <p className="font-medium">{resident.unit}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Room</span>
                    <p className="font-medium">{resident.room}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Census Status</span>
                    <p className="font-medium">
                      <Badge variant={resident.active_on_census ? 'default' : 'secondary'}>
                        {resident.active_on_census ? 'Active' : 'Inactive'}
                      </Badge>
                    </p>
                  </div>
                  {resident.physician && (
                    <div>
                      <span className="text-muted-foreground">Physician</span>
                      <p className="font-medium">{resident.physician}</p>
                    </div>
                  )}
                  {resident.payor && (
                    <div>
                      <span className="text-muted-foreground">Payor</span>
                      <p className="font-medium">{resident.payor}</p>
                    </div>
                  )}
                  {resident.admitDate && (
                    <div>
                      <span className="text-muted-foreground">Admit Date</span>
                      <p className="font-medium">{resident.admitDate}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Summary Cards */}
              <div className="grid grid-cols-2 gap-4">
                {/* Recent ABT */}
                <div className="border rounded-lg p-4 bg-card">
                  <h4 className="text-sm font-semibold text-destructive flex items-center gap-2 mb-2">
                    <Pill className="w-4 h-4" /> Recent Antibiotics
                  </h4>
                  {abtRecords.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No ABT records</p>
                  ) : (
                    <div className="space-y-2">
                      {abtRecords.slice(0, 3).map(r => (
                        <div key={r.id} className="text-sm p-2 bg-muted/50 rounded">
                          <span className="font-medium">{r.medication || r.med_name}</span>
                          <Badge variant={r.status === 'active' ? 'destructive' : 'secondary'} className="ml-2 text-xs">
                            {r.status}
                          </Badge>
                        </div>
                      ))}
                      {abtRecords.length > 3 && (
                        <Button variant="ghost" size="sm" className="w-full" onClick={() => setActiveTab('abt')}>
                          View all {abtRecords.length} records →
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                {/* Recent IP Cases */}
                <div className="border rounded-lg p-4 bg-card">
                  <h4 className="text-sm font-semibold text-warning flex items-center gap-2 mb-2">
                    <ShieldAlert className="w-4 h-4" /> IP Cases
                  </h4>
                  {ipCases.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No IP cases</p>
                  ) : (
                    <div className="space-y-2">
                      {ipCases.slice(0, 3).map(r => (
                        <div key={r.id} className="text-sm p-2 bg-muted/50 rounded">
                          <span className="font-medium">{r.infectionType || r.infection_type}</span>
                          <Badge variant={r.status === 'Active' ? 'default' : 'secondary'} className="ml-2 text-xs">
                            {r.status}
                          </Badge>
                        </div>
                      ))}
                      {ipCases.length > 3 && (
                        <Button variant="ghost" size="sm" className="w-full" onClick={() => setActiveTab('ip')}>
                          View all {ipCases.length} records →
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                {/* VAX Status */}
                <div className="border rounded-lg p-4 bg-card">
                  <h4 className="text-sm font-semibold text-info flex items-center gap-2 mb-2">
                    <Syringe className="w-4 h-4" /> Vaccination Status
                  </h4>
                  {vaxRecords.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No VAX records</p>
                  ) : (
                    <div className="space-y-2">
                      {vaxRecords.slice(0, 3).map(r => (
                        <div key={r.id} className="text-sm p-2 bg-muted/50 rounded flex items-center justify-between">
                          <span className="font-medium">{r.vaccine || r.vaccine_type}</span>
                          <Badge 
                            variant={r.status === 'given' ? 'default' : r.status === 'overdue' ? 'destructive' : 'outline'} 
                            className="text-xs"
                          >
                            {r.status}
                          </Badge>
                        </div>
                      ))}
                      {vaxRecords.length > 3 && (
                        <Button variant="ghost" size="sm" className="w-full" onClick={() => setActiveTab('vax')}>
                          View all {vaxRecords.length} records →
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                {/* Recent Notes */}
                <div className="border rounded-lg p-4 bg-card">
                  <h4 className="text-sm font-semibold text-success flex items-center gap-2 mb-2">
                    <FileText className="w-4 h-4" /> Recent Notes
                  </h4>
                  {notes.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No notes</p>
                  ) : (
                    <div className="space-y-2">
                      {notes.slice(0, 2).map(n => (
                        <div key={n.id} className="text-sm p-2 bg-muted/50 rounded">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="secondary" className="text-xs">{n.category}</Badge>
                            <span className="text-xs text-muted-foreground">
                              {new Date(n.createdAt || n.created_at || '').toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-muted-foreground line-clamp-2">{n.text}</p>
                        </div>
                      ))}
                      {notes.length > 2 && (
                        <Button variant="ghost" size="sm" className="w-full" onClick={() => setActiveTab('notes')}>
                          View all {notes.length} notes →
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* Other Tabs */}
            <TabsContent value="abt" className="mt-0">
              <AbtList records={abtRecords} onEdit={(r) => handleEdit('abt', r)} onDelete={(id, name) => handleDelete('abt', id, name)} />
            </TabsContent>
            <TabsContent value="ip" className="mt-0">
              <IpList records={ipCases} onEdit={(r) => handleEdit('ip', r)} onDelete={(id, name) => handleDelete('ip', id, name)} />
            </TabsContent>
            <TabsContent value="vax" className="mt-0">
              <VaxList records={vaxRecords} onEdit={(r) => handleEdit('vax', r)} onDelete={(id, name) => handleDelete('vax', id, name)} />
            </TabsContent>
            <TabsContent value="notes" className="mt-0">
              <NotesList records={notes} onEdit={(r) => handleEdit('note', r)} onDelete={(id) => handleDelete('note', id, '')} />
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>

      {/* Edit Modal */}
      {editingRecord && (
        <EditRecordModal
          type={editingRecord.type}
          record={editingRecord.record}
          onSave={handleSaveEdit}
          onCancel={() => setEditingRecord(null)}
          onChange={(updated) => setEditingRecord({ ...editingRecord, record: updated })}
        />
      )}
    </Dialog>
  );
};

// Action Buttons Component
const RecordActions = ({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) => (
  <div className="flex items-center gap-1 ml-2" onClick={(e) => e.stopPropagation()}>
    <button 
      type="button"
      onClick={(e) => { e.stopPropagation(); onEdit(); }} 
      className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-primary transition-colors" 
      title="Edit"
    >
      <Edit className="w-3.5 h-3.5" />
    </button>
    <button 
      type="button"
      onClick={(e) => { e.stopPropagation(); onDelete(); }} 
      className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors" 
      title="Delete"
    >
      <Trash2 className="w-3.5 h-3.5" />
    </button>
  </div>
);

// ABT List Component
const AbtList = ({ records, onEdit, onDelete }: { records: ABTRecord[]; onEdit: (r: ABTRecord) => void; onDelete: (id: string, name: string) => void }) => {
  if (records.length === 0) {
    return <EmptyState message="No antibiotic records found for this resident." />;
  }

  const today = todayISO();

  return (
    <div className="space-y-3">
      {records.map((r) => (
        <div key={r.id} className="p-3 border rounded-lg bg-card">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="font-semibold text-foreground">
                {r.medication || r.med_name}
              </div>
              <div className="text-sm text-muted-foreground">
                {r.dose} • {r.route} • {r.indication || 'No indication'}
              </div>
            </div>
            <div className="flex items-center">
              <Badge variant={deriveAbtStatus(r, today) === 'active' ? 'destructive' : 'secondary'}>
                {deriveAbtStatus(r, today)}
              </Badge>
              <RecordActions onEdit={() => onEdit(r)} onDelete={() => onDelete(r.id, r.medication || r.med_name || '')} />
            </div>
          </div>
          <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
            <span>Start: {r.startDate || r.start_date || '—'}</span>
            <span>End: {r.endDate || r.end_date || '—'}</span>
            {r.infection_source && <span>Source: {r.infection_source}</span>}
          </div>
        </div>
      ))}
    </div>
  );
};

// IP List Component
const IpList = ({ records, onEdit, onDelete }: { records: IPCase[]; onEdit: (r: IPCase) => void; onDelete: (id: string, name: string) => void }) => {
  if (records.length === 0) {
    return <EmptyState message="No infection prevention cases found for this resident." />;
  }

  return (
    <div className="space-y-3">
      {records.map((r) => (
        <div key={r.id} className="p-3 border rounded-lg bg-card">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="font-semibold text-foreground">
                {r.infectionType || r.infection_type}
              </div>
              <div className="text-sm text-muted-foreground">
                Protocol: {r.protocol}
                {(r.sourceOfInfection || r.source_of_infection) && 
                  ` • Source: ${r.sourceOfInfection || r.source_of_infection}`}
              </div>
            </div>
            <div className="flex items-center">
              <Badge variant={r.status === 'Active' ? 'default' : 'secondary'}>
                {r.status}
              </Badge>
              <RecordActions onEdit={() => onEdit(r)} onDelete={() => onDelete(r.id, r.infectionType || r.infection_type || '')} />
            </div>
          </div>
          <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
            <span>Onset: {r.onsetDate || r.onset_date || '—'}</span>
            <span>Next Review: {r.nextReviewDate || r.next_review_date || '—'}</span>
          </div>
        </div>
      ))}
    </div>
  );
};

// VAX List Component
const VaxList = ({ records, onEdit, onDelete }: { records: VaxRecord[]; onEdit: (r: VaxRecord) => void; onDelete: (id: string, name: string) => void }) => {
  if (records.length === 0) {
    return <EmptyState message="No vaccination records found for this resident." />;
  }

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'given': return 'default';
      case 'due': return 'outline';
      case 'overdue': return 'destructive';
      case 'declined': return 'secondary';
      default: return 'outline';
    }
  };

  return (
    <div className="space-y-3">
      {records.map((r) => (
        <div key={r.id} className="p-3 border rounded-lg bg-card">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="font-semibold text-foreground">
                {r.vaccine || r.vaccine_type}
                {r.dose && <span className="font-normal text-muted-foreground"> ({r.dose})</span>}
              </div>
            </div>
            <div className="flex items-center">
              <Badge variant={getStatusVariant(r.status)}>
                {r.status}
              </Badge>
              <RecordActions onEdit={() => onEdit(r)} onDelete={() => onDelete(r.id, r.vaccine || r.vaccine_type || '')} />
            </div>
          </div>
          <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
            {(r.dateGiven || r.date_given) && <span>Given: {r.dateGiven || r.date_given}</span>}
            {(r.dueDate || r.due_date) && <span>Due: {r.dueDate || r.due_date}</span>}
          </div>
        </div>
      ))}
    </div>
  );
};

// Notes List Component
const NotesList = ({ records, onEdit, onDelete }: { records: Note[]; onEdit: (r: Note) => void; onDelete: (id: string) => void }) => {
  if (records.length === 0) {
    return <EmptyState message="No notes found for this resident." />;
  }

  return (
    <div className="space-y-3">
      {records.map((r) => (
        <div key={r.id} className="p-3 border rounded-lg bg-card">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <Badge variant="outline" className="mb-2">{r.category}</Badge>
              <div className="text-sm text-foreground">{r.text}</div>
            </div>
            <RecordActions onEdit={() => onEdit(r)} onDelete={() => onDelete(r.id)} />
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            {new Date(r.createdAt || r.created_at || '').toLocaleDateString()}
          </div>
        </div>
      ))}
    </div>
  );
};

// Empty State Component
const EmptyState = ({ message }: { message: string }) => (
  <div className="py-8 text-center text-muted-foreground">
    <p>{message}</p>
  </div>
);

// Edit Record Modal
const EditRecordModal = ({ 
  type, 
  record, 
  onSave, 
  onCancel, 
  onChange 
}: { 
  type: string; 
  record: any; 
  onSave: () => void; 
  onCancel: () => void;
  onChange: (updated: any) => void;
}) => {
  const updateField = (field: string, value: any) => {
    onChange({ ...record, [field]: value });
  };

  return (
    <Dialog open onOpenChange={onCancel}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit {type.toUpperCase()} Record</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {type === 'abt' && (
            <>
              <div className="space-y-2">
                <Label>Medication</Label>
                <Input value={record.medication || record.med_name || ''} onChange={(e) => updateField('medication', e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Dose</Label>
                  <Input value={record.dose || ''} onChange={(e) => updateField('dose', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Route</Label>
                  <Input value={record.route || ''} onChange={(e) => updateField('route', e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Indication</Label>
                <Input value={record.indication || ''} onChange={(e) => updateField('indication', e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Input type="date" value={record.startDate || record.start_date || ''} onChange={(e) => updateField('startDate', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Input type="date" value={record.endDate || record.end_date || ''} onChange={(e) => updateField('endDate', e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={record.status} onValueChange={(v) => updateField('status', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="discontinued">Discontinued</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {type === 'ip' && (
            <>
              <div className="space-y-2">
                <Label>Infection Type</Label>
                <Input value={record.infectionType || record.infection_type || ''} onChange={(e) => updateField('infectionType', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Protocol</Label>
                <Select value={record.protocol} onValueChange={(v) => updateField('protocol', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EBP">EBP</SelectItem>
                    <SelectItem value="Isolation">Isolation</SelectItem>
                    <SelectItem value="Standard Precautions">Standard Precautions</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={record.status} onValueChange={(v) => updateField('status', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Resolved">Resolved</SelectItem>
                    <SelectItem value="Discharged">Discharged</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Next Review Date</Label>
                <Input type="date" value={record.nextReviewDate || record.next_review_date || ''} onChange={(e) => updateField('nextReviewDate', e.target.value)} />
              </div>
            </>
          )}

          {type === 'vax' && (
            <>
              <div className="space-y-2">
                <Label>Vaccine</Label>
                <Input value={record.vaccine || record.vaccine_type || ''} onChange={(e) => updateField('vaccine', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={record.status} onValueChange={(v) => updateField('status', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="due">Due</SelectItem>
                    <SelectItem value="given">Given</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
                    <SelectItem value="declined">Declined</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Date Given</Label>
                  <Input type="date" value={record.dateGiven || record.date_given || ''} onChange={(e) => updateField('dateGiven', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Due Date</Label>
                  <Input type="date" value={record.dueDate || record.due_date || ''} onChange={(e) => updateField('dueDate', e.target.value)} />
                </div>
              </div>
            </>
          )}

          {type === 'note' && (
            <>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={record.category} onValueChange={(v) => updateField('category', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="General">General</SelectItem>
                    <SelectItem value="ABT">ABT</SelectItem>
                    <SelectItem value="IP">IP</SelectItem>
                    <SelectItem value="VAX">VAX</SelectItem>
                    <SelectItem value="Family">Family</SelectItem>
                    <SelectItem value="Follow-up">Follow-up</SelectItem>
                    <SelectItem value="Alert">Alert</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Note</Label>
                <Textarea value={record.text || ''} onChange={(e) => updateField('text', e.target.value)} rows={4} />
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button onClick={onSave}>Save Changes</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ResidentDetailModal;
