import { useState, useMemo } from 'react';
import { Search, User, Pill, ShieldAlert, Syringe, FileText, Plus, AlertTriangle, Eye } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import SectionCard from '@/components/dashboard/SectionCard';
import ResidentDetailModal from '@/components/modals/ResidentDetailModal';
import { loadDB, saveDB, addAudit, getActiveResidents } from '@/lib/database';
import { Resident, Note } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

const NOTE_CATEGORIES = ['General', 'ABT', 'IP', 'VAX', 'Family', 'Follow-up', 'Alert'];

const ResidentOverviewView = () => {
  const { toast } = useToast();
  const [db, setDb] = useState(() => loadDB());
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedResident, setSelectedResident] = useState<Resident | null>(null);
  const [detailResident, setDetailResident] = useState<Resident | null>(null);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [noteResident, setNoteResident] = useState<Resident | null>(null);
  const [noteText, setNoteText] = useState('');
  const [noteCategory, setNoteCategory] = useState('General');

  const residents = getActiveResidents(db);

  // Calculate status for each resident
  const residentStatus = useMemo(() => {
    const statusMap: Record<string, {
      activeAbt: number;
      activeIp: number;
      vaxDue: number;
      notes: number;
      hasAlert: boolean;
    }> = {};

    residents.forEach(r => {
      const abt = db.records.abx.filter(rec => rec.mrn === r.mrn && rec.status === 'active');
      const ip = db.records.ip_cases.filter(rec => rec.mrn === r.mrn && rec.status === 'Active');
      const vax = db.records.vax.filter(rec => rec.mrn === r.mrn && (rec.status === 'due' || rec.status === 'overdue'));
      const notes = db.records.notes.filter(rec => rec.mrn === r.mrn);
      
      statusMap[r.mrn] = {
        activeAbt: abt.length,
        activeIp: ip.length,
        vaxDue: vax.length,
        notes: notes.length,
        hasAlert: abt.length > 0 || ip.length > 0 || vax.some(v => v.status === 'overdue')
      };
    });

    return statusMap;
  }, [residents, db.records]);

  const filteredResidents = residents.filter(r =>
    r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.mrn.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.unit.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Sort: alerts first, then by name
  const sortedResidents = [...filteredResidents].sort((a, b) => {
    const aAlert = residentStatus[a.mrn]?.hasAlert ? 1 : 0;
    const bAlert = residentStatus[b.mrn]?.hasAlert ? 1 : 0;
    if (bAlert !== aAlert) return bAlert - aAlert;
    return a.name.localeCompare(b.name);
  });

  const handleAddNote = (resident: Resident) => {
    setNoteResident(resident);
    setNoteText('');
    setNoteCategory('General');
    setShowNoteModal(true);
  };

  const handleSaveNote = () => {
    if (!noteResident || !noteText.trim()) {
      toast({ title: 'Please enter note text', variant: 'destructive' });
      return;
    }

    const updatedDb = loadDB();
    const newNote: Note = {
      id: `note_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      mrn: noteResident.mrn,
      residentName: noteResident.name,
      name: noteResident.name,
      unit: noteResident.unit,
      room: noteResident.room,
      category: noteCategory,
      text: noteText.trim(),
      createdAt: new Date().toISOString()
    };

    updatedDb.records.notes.push(newNote);
    addAudit(updatedDb, 'note_add', `Added note for ${noteResident.name}: ${noteCategory}`, 'notes');
    saveDB(updatedDb);
    setDb(updatedDb);

    toast({ title: 'Note saved', description: `Note added for ${noteResident.name}` });
    setShowNoteModal(false);
    setNoteResident(null);
    setNoteText('');
  };

  const getResidentRecords = (mrn: string) => {
    return {
      abt: db.records.abx.filter(r => r.mrn === mrn),
      ip: db.records.ip_cases.filter(r => r.mrn === mrn),
      vax: db.records.vax.filter(r => r.mrn === mrn),
      notes: db.records.notes.filter(r => r.mrn === mrn).sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
    };
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Resident Overview</h2>
          <p className="text-sm text-muted-foreground">
            Comprehensive view of each resident's current situation • {residents.length} active residents
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="filter-panel">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, MRN, or unit..."
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Resident Cards Grid */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {sortedResidents.map((resident) => {
          const status = residentStatus[resident.mrn];
          const records = selectedResident?.mrn === resident.mrn ? getResidentRecords(resident.mrn) : null;
          const isExpanded = selectedResident?.mrn === resident.mrn;

          return (
            <div
              key={resident.mrn}
              className={`section-card transition-all duration-200 ${isExpanded ? 'md:col-span-2 xl:col-span-3' : ''}`}
            >
              {/* Card Header */}
              <div 
                className="section-card-header cursor-pointer"
                onClick={() => setSelectedResident(isExpanded ? null : resident)}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-full ${status?.hasAlert ? 'bg-destructive/10' : 'bg-primary/10'}`}>
                    {status?.hasAlert ? (
                      <AlertTriangle className="w-5 h-5 text-destructive" />
                    ) : (
                      <User className="w-5 h-5 text-primary" />
                    )}
                  </div>
                  <div>
                    <div className="font-semibold text-foreground">{resident.name}</div>
                    <div className="text-xs text-muted-foreground">
                      MRN: {resident.mrn} • {resident.unit}/{resident.room}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDetailResident(resident);
                    }}
                    title="View Details"
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAddNote(resident);
                    }}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Note
                  </Button>
                </div>
              </div>

              {/* Status Summary Bar */}
              <div className="grid grid-cols-4 gap-2 px-4 py-3 bg-muted/30 border-b">
                <div className="text-center">
                  <div className={`text-sm font-bold ${status?.activeAbt > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                    {status?.activeAbt || 0}
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                    <Pill className="w-3 h-3" /> ABT
                  </div>
                </div>
                <div className="text-center">
                  <div className={`text-sm font-bold ${status?.activeIp > 0 ? 'text-warning' : 'text-muted-foreground'}`}>
                    {status?.activeIp || 0}
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                    <ShieldAlert className="w-3 h-3" /> IP
                  </div>
                </div>
                <div className="text-center">
                  <div className={`text-sm font-bold ${status?.vaxDue > 0 ? 'text-info' : 'text-muted-foreground'}`}>
                    {status?.vaxDue || 0}
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                    <Syringe className="w-3 h-3" /> VAX
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-sm font-bold text-success">
                    {status?.notes || 0}
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                    <FileText className="w-3 h-3" /> Notes
                  </div>
                </div>
              </div>

              {/* Expanded Details */}
              {isExpanded && records && (
                <div className="section-card-body space-y-4">
                  {/* Active ABT */}
                  {records.abt.filter(r => r.status === 'active').length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-destructive flex items-center gap-2 mb-2">
                        <Pill className="w-4 h-4" /> Active Antibiotics
                      </h4>
                      <div className="space-y-2">
                        {records.abt.filter(r => r.status === 'active').map(r => (
                          <div key={r.id} className="p-2 bg-destructive/5 rounded-lg border border-destructive/20 text-sm">
                            <span className="font-medium">{r.medication || r.med_name}</span>
                            <span className="text-muted-foreground"> • {r.dose} {r.route}</span>
                            {r.indication && <span className="text-muted-foreground"> • {r.indication}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Active IP */}
                  {records.ip.filter(r => r.status === 'Active').length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-warning flex items-center gap-2 mb-2">
                        <ShieldAlert className="w-4 h-4" /> Active IP Cases
                      </h4>
                      <div className="space-y-2">
                        {records.ip.filter(r => r.status === 'Active').map(r => (
                          <div key={r.id} className="p-2 bg-warning/5 rounded-lg border border-warning/20 text-sm">
                            <span className="font-medium">{r.infectionType || r.infection_type}</span>
                            <Badge variant="outline" className="ml-2 text-xs">{r.protocol}</Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* VAX Due */}
                  {records.vax.filter(r => r.status === 'due' || r.status === 'overdue').length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-info flex items-center gap-2 mb-2">
                        <Syringe className="w-4 h-4" /> Vaccinations Due
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {records.vax.filter(r => r.status === 'due' || r.status === 'overdue').map(r => (
                          <Badge 
                            key={r.id} 
                            variant={r.status === 'overdue' ? 'destructive' : 'outline'}
                          >
                            {r.vaccine || r.vaccine_type}
                            {r.status === 'overdue' && ' (Overdue)'}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recent Notes */}
                  <div>
                    <h4 className="text-sm font-semibold text-success flex items-center gap-2 mb-2">
                      <FileText className="w-4 h-4" /> Recent Notes
                    </h4>
                    {records.notes.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No notes for this resident.</p>
                    ) : (
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {records.notes.slice(0, 5).map(n => (
                          <div key={n.id} className="p-2 bg-muted/50 rounded-lg text-sm">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="secondary" className="text-xs">{n.category}</Badge>
                              <span className="text-xs text-muted-foreground">
                                {new Date(n.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                            <p className="text-foreground">{n.text}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {sortedResidents.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <User className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No residents found. Import census data to get started.</p>
        </div>
      )}

      {/* Add Note Modal */}
      <Dialog open={showNoteModal} onOpenChange={setShowNoteModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Add Note for {noteResident?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={noteCategory} onValueChange={setNoteCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NOTE_CATEGORIES.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Note</Label>
              <Textarea
                placeholder="Enter note..."
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNoteModal(false)}>Cancel</Button>
            <Button onClick={handleSaveNote}>Save Note</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Resident Detail Modal */}
      <ResidentDetailModal
        open={!!detailResident}
        onClose={() => {
          setDetailResident(null);
          setDb(loadDB()); // Refresh data after closing
        }}
        resident={detailResident}
      />
    </div>
  );
};

export default ResidentOverviewView;
