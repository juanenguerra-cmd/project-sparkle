import { useState, useMemo } from 'react';
import { Search, User, Pill, ShieldAlert, Syringe, FileText, Plus, AlertTriangle, Eye, ChevronRight, Zap } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import SectionCard from '@/components/dashboard/SectionCard';
import ResidentDetailModal from '@/components/modals/ResidentDetailModal';
import QuickAddModal from '@/components/modals/QuickAddModal';
import IPCaseModal from '@/components/modals/IPCaseModal';
import ABTCaseModal from '@/components/modals/ABTCaseModal';
import VAXCaseModal from '@/components/modals/VAXCaseModal';
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
  const [expandedMrns, setExpandedMrns] = useState<Set<string>>(new Set());
  
  // Quick add modal states
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickAddResident, setQuickAddResident] = useState<Resident | null>(null);
  const [showIPModal, setShowIPModal] = useState(false);
  const [showABTModal, setShowABTModal] = useState(false);
  const [showVAXModal, setShowVAXModal] = useState(false);

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

      {/* Resident List - Single line expandable */}
      <SectionCard title={`Residents (${sortedResidents.length})`} noPadding>
        <div className="divide-y divide-border">
          {sortedResidents.map((resident) => {
            const status = residentStatus[resident.mrn];
            const isExpanded = expandedMrns.has(resident.mrn);
            const records = isExpanded ? getResidentRecords(resident.mrn) : null;
            
            const toggleExpanded = () => {
              setExpandedMrns(prev => {
                const next = new Set(prev);
                if (next.has(resident.mrn)) next.delete(resident.mrn);
                else next.add(resident.mrn);
                return next;
              });
            };

            return (
              <Collapsible key={resident.mrn} open={isExpanded} onOpenChange={toggleExpanded}>
                {/* Collapsed single line */}
                <div className="flex items-center gap-3 py-2 px-4 hover:bg-muted/50 transition-colors">
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 shrink-0">
                      <ChevronRight className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                    </Button>
                  </CollapsibleTrigger>
                  
                  {/* Alert indicator */}
                  {status?.hasAlert ? (
                    <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
                  ) : (
                    <User className="w-4 h-4 text-muted-foreground shrink-0" />
                  )}
                  
                  {/* Room */}
                  <span className="text-sm font-medium w-16 shrink-0">{resident.room}</span>
                  
                  {/* Name */}
                  <span className="font-medium flex-1 truncate">{resident.name}</span>
                  
                  {/* Status badges */}
                  <div className="flex items-center gap-1 shrink-0">
                    {status?.activeAbt > 0 && (
                      <Badge variant="outline" className="text-xs bg-destructive/10 text-destructive border-destructive/30">
                        <Pill className="w-3 h-3 mr-1" />{status.activeAbt}
                      </Badge>
                    )}
                    {status?.activeIp > 0 && (
                      <Badge variant="outline" className="text-xs bg-warning/10 text-warning border-warning/30">
                        <ShieldAlert className="w-3 h-3 mr-1" />{status.activeIp}
                      </Badge>
                    )}
                    {status?.vaxDue > 0 && (
                      <Badge variant="outline" className="text-xs bg-info/10 text-info border-info/30">
                        <Syringe className="w-3 h-3 mr-1" />{status.vaxDue}
                      </Badge>
                    )}
                    {status?.notes > 0 && (
                      <Badge variant="outline" className="text-xs">
                        <FileText className="w-3 h-3 mr-1" />{status.notes}
                      </Badge>
                    )}
                  </div>
                  
                  {/* Quick actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        setQuickAddResident(resident);
                        setShowQuickAdd(true);
                      }}
                      title="Quick Add"
                    >
                      <Zap className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0"
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
                      className="h-7 px-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddNote(resident);
                      }}
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      Note
                    </Button>
                  </div>
                </div>
                
                {/* Expanded Details */}
                <CollapsibleContent>
                  {records && (
                    <div className="px-10 py-4 bg-muted/20 space-y-4 border-t">
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        {/* Resident Info */}
                        <div className="text-sm">
                          <p className="text-muted-foreground">MRN: {resident.mrn}</p>
                          <p className="text-muted-foreground">Unit: {resident.unit}</p>
                          {resident.physician && <p className="text-muted-foreground">Dr: {resident.physician}</p>}
                        </div>
                        
                        {/* Active ABT */}
                        <div>
                          <h4 className="text-xs font-semibold text-destructive flex items-center gap-1 mb-1">
                            <Pill className="w-3 h-3" /> Active ABT
                          </h4>
                          {records.abt.filter(r => r.status === 'active').length === 0 ? (
                            <p className="text-xs text-muted-foreground">None</p>
                          ) : (
                            records.abt.filter(r => r.status === 'active').map(r => (
                              <div key={r.id} className="text-xs p-1 bg-destructive/5 rounded mb-1">
                                {r.medication || r.med_name} • {r.dose}
                              </div>
                            ))
                          )}
                        </div>
                        
                        {/* Active IP */}
                        <div>
                          <h4 className="text-xs font-semibold text-warning flex items-center gap-1 mb-1">
                            <ShieldAlert className="w-3 h-3" /> Active IP
                          </h4>
                          {records.ip.filter(r => r.status === 'Active').length === 0 ? (
                            <p className="text-xs text-muted-foreground">None</p>
                          ) : (
                            records.ip.filter(r => r.status === 'Active').map(r => (
                              <div key={r.id} className="text-xs p-1 bg-warning/5 rounded mb-1">
                                {r.infectionType || r.infection_type} • {r.protocol}
                              </div>
                            ))
                          )}
                        </div>
                        
                        {/* VAX Due */}
                        <div>
                          <h4 className="text-xs font-semibold text-info flex items-center gap-1 mb-1">
                            <Syringe className="w-3 h-3" /> VAX Due
                          </h4>
                          {records.vax.filter(r => r.status === 'due' || r.status === 'overdue').length === 0 ? (
                            <p className="text-xs text-muted-foreground">None</p>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {records.vax.filter(r => r.status === 'due' || r.status === 'overdue').map(r => (
                                <Badge 
                                  key={r.id} 
                                  variant={r.status === 'overdue' ? 'destructive' : 'outline'}
                                  className="text-xs"
                                >
                                  {r.vaccine || r.vaccine_type}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Recent Notes */}
                      {records.notes.length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold text-success flex items-center gap-1 mb-2">
                            <FileText className="w-3 h-3" /> Recent Notes
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {records.notes.slice(0, 4).map(n => (
                              <div key={n.id} className="p-2 bg-muted/50 rounded text-xs">
                                <div className="flex items-center gap-2 mb-1">
                                  <Badge variant="secondary" className="text-xs">{n.category}</Badge>
                                  <span className="text-muted-foreground">
                                    {new Date(n.createdAt).toLocaleDateString()}
                                  </span>
                                </div>
                                <p className="text-foreground truncate">{n.text}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>
      </SectionCard>

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

      {/* Quick Add Modal */}
      <QuickAddModal
        open={showQuickAdd}
        onClose={() => setShowQuickAdd(false)}
        resident={quickAddResident}
        onSelectIPCase={() => setShowIPModal(true)}
        onSelectABTCase={() => setShowABTModal(true)}
        onSelectVAXCase={() => setShowVAXModal(true)}
        onSelectOutbreakCase={() => {}}
      />

      <IPCaseModal open={showIPModal} onClose={() => setShowIPModal(false)} onSave={() => setDb(loadDB())} editCase={null} />
      <ABTCaseModal open={showABTModal} onClose={() => setShowABTModal(false)} onSave={() => setDb(loadDB())} editRecord={null} />
      <VAXCaseModal open={showVAXModal} onClose={() => setShowVAXModal(false)} onSave={() => setDb(loadDB())} editRecord={null} />
    </div>
  );
};

export default ResidentOverviewView;
