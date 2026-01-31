import { useState } from 'react';
import { Plus, AlertTriangle, Users, FileText, ChevronDown, Check, Clock, X, UserPlus, UserRoundPlus, Edit, Trash2, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import SectionCard from '@/components/dashboard/SectionCard';
import LineListingCaseModal from '@/components/modals/LineListingCaseModal';
import { 
  loadDB, 
  saveDB, 
  addAudit, 
  getActiveOutbreaks, 
  getLineListingsByOutbreak, 
  createOutbreak, 
  addToLineListing,
  addContact,
  getContactsByLineListing
} from '@/lib/database';
import { 
  Outbreak, 
  LineListingEntry, 
  ContactEntry, 
  SymptomCategory, 
  SYMPTOM_OPTIONS,
  Resident 
} from '@/lib/types';
import { generateLineListingPdf } from '@/lib/pdf/lineListingPdf';
import { toast } from 'sonner';

const CATEGORY_COLORS: Record<SymptomCategory, string> = {
  respiratory: 'bg-blue-100 text-blue-800 border-blue-300',
  gi: 'bg-amber-100 text-amber-800 border-amber-300',
  skin: 'bg-pink-100 text-pink-800 border-pink-300',
  uti: 'bg-purple-100 text-purple-800 border-purple-300',
  other: 'bg-gray-100 text-gray-800 border-gray-300'
};

const OutbreakView = () => {
  const [refreshKey, setRefreshKey] = useState(0);
  const [showNewOutbreakModal, setShowNewOutbreakModal] = useState(false);
  const [showAddCaseModal, setShowAddCaseModal] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [showEditCaseModal, setShowEditCaseModal] = useState(false);
  const [selectedOutbreak, setSelectedOutbreak] = useState<Outbreak | null>(null);
  const [selectedLineListing, setSelectedLineListing] = useState<LineListingEntry | null>(null);
  const [editingLineListing, setEditingLineListing] = useState<LineListingEntry | null>(null);
  const [expandedOutbreaks, setExpandedOutbreaks] = useState<Set<string>>(new Set());

  const db = loadDB();
  const activeOutbreaks = getActiveOutbreaks(db);
  const resolvedOutbreaks = db.records.outbreaks.filter(o => o.status === 'resolved');
  const residents = Object.values(db.census.residentsByMrn)
    .filter(r => r.active_on_census)
    .sort((a, b) => a.name.localeCompare(b.name)); // Alphabetical sorting

  // Predefined outbreak name options
  const OUTBREAK_NAME_OPTIONS = [
    'COVID-19 Outbreak',
    'Influenza Outbreak',
    'Norovirus/GI Outbreak',
    'Respiratory Illness Outbreak',
    'Scabies Outbreak',
    'MRSA Cluster',
    'C. diff Cluster',
    'Other'
  ];

  // New Outbreak Form State
  const [outbreakNameType, setOutbreakNameType] = useState<string>('COVID-19 Outbreak');
  const [customOutbreakName, setCustomOutbreakName] = useState('');
  const [newOutbreakType, setNewOutbreakType] = useState<SymptomCategory>('respiratory');
  const [newOutbreakNotes, setNewOutbreakNotes] = useState('');
  const [outbreakStartDate, setOutbreakStartDate] = useState(new Date().toISOString().slice(0, 10));

  // Add Case Form State
  const [isStaffOrVisitor, setIsStaffOrVisitor] = useState(false);
  const [caseMrn, setCaseMrn] = useState('');
  const [staffVisitorName, setStaffVisitorName] = useState('');
  const [caseOnsetDate, setCaseOnsetDate] = useState(new Date().toISOString().slice(0, 10));
  const [caseSymptoms, setCaseSymptoms] = useState<string[]>([]);
  const [caseLabResults, setCaseLabResults] = useState('');
  const [caseNotes, setCaseNotes] = useState('');

  // Contact Form State
  const [contactType, setContactType] = useState<'resident' | 'staff'>('resident');
  const [contactMrn, setContactMrn] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactRole, setContactRole] = useState('');
  const [contactUnit, setContactUnit] = useState('');
  const [exposureDate, setExposureDate] = useState(new Date().toISOString().slice(0, 10));
  const [exposureType, setExposureType] = useState('');
  const [contactNotes, setContactNotes] = useState('');

  const toggleOutbreakExpanded = (id: string) => {
    setExpandedOutbreaks(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreateOutbreak = () => {
    const finalName = outbreakNameType === 'Other' ? customOutbreakName.trim() : outbreakNameType;
    
    if (!finalName) {
      toast.error('Please enter an outbreak name');
      return;
    }

    const db = loadDB();
    createOutbreak(db, {
      name: finalName,
      type: newOutbreakType,
      startDate: outbreakStartDate,
      status: 'active',
      affectedUnits: [],
      notes: newOutbreakNotes
    });
    saveDB(db);

    toast.success(`Outbreak "${finalName}" created`);
    setShowNewOutbreakModal(false);
    setOutbreakNameType('COVID-19 Outbreak');
    setCustomOutbreakName('');
    setNewOutbreakNotes('');
    setOutbreakStartDate(new Date().toISOString().slice(0, 10));
    setRefreshKey(k => k + 1);
  };

  const handleAddCaseFromModal = (data: {
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
  }) => {
    if (!selectedOutbreak) return;
    
    if (!data.isStaffOrVisitor && !data.mrn) {
      toast.error('Please select a resident');
      return;
    }
    if (data.isStaffOrVisitor && !data.residentName) {
      toast.error('Please enter staff/visitor name');
      return;
    }

    const db = loadDB();
    addToLineListing(db, {
      mrn: data.mrn,
      residentName: data.residentName,
      unit: data.unit,
      room: data.room,
      outbreakId: selectedOutbreak.id,
      onsetDate: data.onsetDate,
      symptoms: data.symptoms,
      symptomCategory: selectedOutbreak.type,
      labResults: data.labResults,
      outcome: 'active',
      notes: data.notes,
      templateData: data.templateData
    });
    saveDB(db);

    toast.success(`${data.residentName} added to line listing`);
    setShowAddCaseModal(false);
    setRefreshKey(k => k + 1);
  };

  const handleUpdateCaseFromModal = (data: {
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
  }) => {
    if (!editingLineListing) return;
    
    const db = loadDB();
    const idx = db.records.line_listings.findIndex(l => l.id === editingLineListing.id);
    if (idx >= 0) {
      db.records.line_listings[idx] = {
        ...db.records.line_listings[idx],
        onsetDate: data.onsetDate,
        symptoms: data.symptoms,
        labResults: data.labResults,
        notes: data.notes,
        templateData: data.templateData,
        updatedAt: new Date().toISOString()
      };
      addAudit(db, 'line_listing_updated', `Updated: ${editingLineListing.residentName}`, 'ip');
      saveDB(db);
      toast.success(`${editingLineListing.residentName} updated`);
      setShowEditCaseModal(false);
      setEditingLineListing(null);
      setRefreshKey(k => k + 1);
    }
  };

  const handlePrintLineListing = (outbreak: Outbreak) => {
    const db = loadDB();
    const entries = getLineListingsByOutbreak(db, outbreak.id);
    const facility = db.settings.facilityName || 'Healthcare Facility';
    
    const doc = generateLineListingPdf({
      outbreak,
      entries,
      facility
    });
    
    doc.save(`${outbreak.name.replace(/\s+/g, '_')}_Line_List.pdf`);
    toast.success('Line listing PDF generated');
  };

  const handleAddCase = () => {
    if (!selectedOutbreak) return;
    
    if (!isStaffOrVisitor && !caseMrn) {
      toast.error('Please select a resident');
      return;
    }
    if (isStaffOrVisitor && !staffVisitorName.trim()) {
      toast.error('Please enter staff/visitor name');
      return;
    }

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
      if (!resident) {
        toast.error('Invalid resident');
        return;
      }
      residentName = resident.name;
      mrn = resident.mrn;
      unit = resident.unit;
      room = resident.room;
    }

    const db = loadDB();
    addToLineListing(db, {
      mrn,
      residentName,
      unit,
      room,
      outbreakId: selectedOutbreak.id,
      onsetDate: caseOnsetDate,
      symptoms: caseSymptoms,
      symptomCategory: selectedOutbreak.type,
      labResults: caseLabResults,
      outcome: 'active',
      notes: caseNotes
    });
    saveDB(db);

    toast.success(`${residentName} added to line listing`);
    setShowAddCaseModal(false);
    resetCaseForm();
    setRefreshKey(k => k + 1);
  };

  const handleEditCase = (entry: LineListingEntry) => {
    setEditingLineListing(entry);
    setCaseMrn(entry.mrn);
    setStaffVisitorName(entry.residentName.replace('[Staff/Visitor] ', ''));
    setIsStaffOrVisitor(entry.mrn.startsWith('staff_'));
    setCaseOnsetDate(entry.onsetDate);
    setCaseSymptoms(entry.symptoms);
    setCaseLabResults(entry.labResults || '');
    setCaseNotes(entry.notes || '');
    setShowEditCaseModal(true);
  };

  const handleUpdateCase = () => {
    if (!editingLineListing) return;
    
    const db = loadDB();
    const idx = db.records.line_listings.findIndex(l => l.id === editingLineListing.id);
    if (idx >= 0) {
      db.records.line_listings[idx] = {
        ...db.records.line_listings[idx],
        onsetDate: caseOnsetDate,
        symptoms: caseSymptoms,
        labResults: caseLabResults,
        notes: caseNotes,
        updatedAt: new Date().toISOString()
      };
      addAudit(db, 'line_listing_updated', `Updated: ${editingLineListing.residentName}`, 'ip');
      saveDB(db);
      toast.success(`${editingLineListing.residentName} updated`);
      setShowEditCaseModal(false);
      resetCaseForm();
      setEditingLineListing(null);
      setRefreshKey(k => k + 1);
    }
  };

  const handleDeleteCase = (entry: LineListingEntry) => {
    if (!confirm(`Delete ${entry.residentName} from line listing?`)) return;
    
    const db = loadDB();
    db.records.line_listings = db.records.line_listings.filter(l => l.id !== entry.id);
    // Also delete associated contacts
    db.records.contacts = db.records.contacts.filter(c => c.lineListingId !== entry.id);
    addAudit(db, 'line_listing_deleted', `Deleted: ${entry.residentName}`, 'ip');
    saveDB(db);
    toast.success(`${entry.residentName} removed from line listing`);
    setRefreshKey(k => k + 1);
  };

  const handleAddContact = () => {
    if (!selectedLineListing) return;
    
    if (contactType === 'resident' && !contactMrn) {
      toast.error('Please select a resident');
      return;
    }
    if (contactType === 'staff' && !contactName.trim()) {
      toast.error('Please enter staff name');
      return;
    }

    const db = loadDB();
    addContact(db, {
      lineListingId: selectedLineListing.id,
      contactType,
      contactName: contactType === 'resident' 
        ? residents.find(r => r.mrn === contactMrn)?.name || contactName
        : contactName,
      contactMrn: contactType === 'resident' ? contactMrn : undefined,
      contactRole: contactType === 'staff' ? contactRole : undefined,
      contactUnit,
      exposureDate,
      exposureType,
      notes: contactNotes,
      followUpStatus: 'pending'
    });
    saveDB(db);

    toast.success('Contact added');
    setShowContactModal(false);
    resetContactForm();
    setRefreshKey(k => k + 1);
  };

  const handleResolveCase = (entry: LineListingEntry) => {
    const db = loadDB();
    const idx = db.records.line_listings.findIndex(l => l.id === entry.id);
    if (idx >= 0) {
      db.records.line_listings[idx] = {
        ...db.records.line_listings[idx],
        outcome: 'resolved',
        resolutionDate: new Date().toISOString().slice(0, 10),
        updatedAt: new Date().toISOString()
      };
      addAudit(db, 'line_listing_resolved', `Resolved: ${entry.residentName}`, 'ip');
      saveDB(db);
      toast.success(`${entry.residentName} marked as resolved`);
      setRefreshKey(k => k + 1);
    }
  };

  const handleResolveOutbreak = (outbreak: Outbreak) => {
    if (!confirm(`Resolve outbreak "${outbreak.name}"? This will close the outbreak.`)) return;
    
    const db = loadDB();
    const idx = db.records.outbreaks.findIndex(o => o.id === outbreak.id);
    if (idx >= 0) {
      db.records.outbreaks[idx] = {
        ...db.records.outbreaks[idx],
        status: 'resolved',
        endDate: new Date().toISOString().slice(0, 10),
        updatedAt: new Date().toISOString()
      };
      addAudit(db, 'outbreak_resolved', `Resolved outbreak: ${outbreak.name}`, 'ip');
      saveDB(db);
      toast.success(`Outbreak "${outbreak.name}" resolved`);
      setRefreshKey(k => k + 1);
    }
  };

  const resetCaseForm = () => {
    setCaseMrn('');
    setStaffVisitorName('');
    setIsStaffOrVisitor(false);
    setCaseOnsetDate(new Date().toISOString().slice(0, 10));
    setCaseSymptoms([]);
    setCaseLabResults('');
    setCaseNotes('');
  };

  const resetContactForm = () => {
    setContactType('resident');
    setContactMrn('');
    setContactName('');
    setContactRole('');
    setContactUnit('');
    setExposureDate(new Date().toISOString().slice(0, 10));
    setExposureType('');
    setContactNotes('');
  };

  const getSymptomOptions = (category: SymptomCategory) => 
    SYMPTOM_OPTIONS.filter(s => s.category === category);

  const renderLineListingTable = (outbreak: Outbreak) => {
    const entries = getLineListingsByOutbreak(db, outbreak.id);
    
    if (entries.length === 0) {
      return (
        <div className="text-center py-6 text-muted-foreground">
          No cases added yet
        </div>
      );
    }

    return (
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Room</th>
              <th>Name</th>
              <th>Unit</th>
              <th>Onset Date</th>
              <th>Symptoms</th>
              <th>Lab Results</th>
              <th>Outcome</th>
              <th>Contacts</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {entries.map(entry => {
              const contacts = getContactsByLineListing(db, entry.id);
              return (
                <tr key={entry.id}>
                  <td className="font-medium">{entry.room}</td>
                  <td>{entry.residentName}</td>
                  <td>{entry.unit}</td>
                  <td>{new Date(entry.onsetDate).toLocaleDateString()}</td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {entry.symptoms.slice(0, 2).map(s => {
                        const symptom = SYMPTOM_OPTIONS.find(opt => opt.id === s);
                        return symptom ? (
                          <Badge key={s} variant="outline" className="text-xs">
                            {symptom.name}
                          </Badge>
                        ) : null;
                      })}
                      {entry.symptoms.length > 2 && (
                        <Badge variant="outline" className="text-xs">+{entry.symptoms.length - 2}</Badge>
                      )}
                    </div>
                  </td>
                  <td className="text-sm">{entry.labResults || '-'}</td>
                  <td>
                    <Badge className={
                      entry.outcome === 'active' ? 'bg-warning/20 text-warning' :
                      entry.outcome === 'resolved' ? 'bg-success/20 text-success' :
                      entry.outcome === 'hospitalized' ? 'bg-destructive/20 text-destructive' :
                      'bg-muted text-muted-foreground'
                    }>
                      {entry.outcome}
                    </Badge>
                  </td>
                  <td>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedLineListing(entry);
                        setShowContactModal(true);
                      }}
                    >
                      <Users className="h-4 w-4 mr-1" />
                      {contacts.length}
                    </Button>
                  </td>
                  <td>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditCase(entry)}
                        title="Edit"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      {entry.outcome === 'active' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleResolveCase(entry)}
                          title="Resolve"
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteCase(entry)}
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in" key={refreshKey}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Outbreak & Line Listing</h2>
          <p className="text-sm text-muted-foreground">Track outbreaks, cases, and contact tracing</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {activeOutbreaks.length > 0 && (
            <>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  if (activeOutbreaks.length === 1) {
                    setSelectedOutbreak(activeOutbreaks[0]);
                    setShowAddCaseModal(true);
                  } else {
                    // If multiple outbreaks, show a selection prompt
                    const outbreak = activeOutbreaks[0]; // Default to first
                    setSelectedOutbreak(outbreak);
                    setShowAddCaseModal(true);
                  }
                }}
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Add Resident Case
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  // Open contact modal - need to select a line listing first
                  const activeEntries = db.records.line_listings.filter(l => l.outcome === 'active');
                  if (activeEntries.length === 0) {
                    toast.error('Add a case to line listing first before adding contacts');
                    return;
                  }
                  setSelectedLineListing(activeEntries[0]);
                  setShowContactModal(true);
                }}
              >
                <UserRoundPlus className="w-4 h-4 mr-2" />
                Add Contact
              </Button>
            </>
          )}
          <Button size="sm" onClick={() => setShowNewOutbreakModal(true)}>
            <Plus className="w-4 h-4 mr-2" />
            New Outbreak
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="quick-stat">
          <div className="text-2xl font-bold text-destructive">{activeOutbreaks.length}</div>
          <div className="text-sm text-muted-foreground">Active Outbreaks</div>
        </div>
        <div className="quick-stat">
          <div className="text-2xl font-bold text-warning">
            {db.records.line_listings.filter(l => l.outcome === 'active').length}
          </div>
          <div className="text-sm text-muted-foreground">Active Cases</div>
        </div>
        <div className="quick-stat">
          <div className="text-2xl font-bold text-primary">
            {db.records.contacts.filter(c => c.followUpStatus === 'pending').length}
          </div>
          <div className="text-sm text-muted-foreground">Contacts Pending</div>
        </div>
        <div className="quick-stat">
          <div className="text-2xl font-bold text-success">{resolvedOutbreaks.length}</div>
          <div className="text-sm text-muted-foreground">Resolved Outbreaks</div>
        </div>
      </div>

      {/* Active Outbreaks */}
      {activeOutbreaks.length === 0 ? (
        <SectionCard title="Active Outbreaks">
          <div className="text-center py-12 text-muted-foreground">
            <AlertTriangle className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No active outbreaks</p>
            <Button 
              variant="outline" 
              className="mt-4"
              onClick={() => setShowNewOutbreakModal(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Outbreak
            </Button>
          </div>
        </SectionCard>
      ) : (
        activeOutbreaks.map(outbreak => (
          <Collapsible 
            key={outbreak.id} 
            open={expandedOutbreaks.has(outbreak.id)}
            onOpenChange={() => toggleOutbreakExpanded(outbreak.id)}
          >
            <SectionCard
              title={
                <div className="flex items-center gap-3">
                  <Badge className={CATEGORY_COLORS[outbreak.type]}>
                    {outbreak.type.toUpperCase()}
                  </Badge>
                  <span>{outbreak.name}</span>
                  <span className="text-sm text-muted-foreground">
                    ({outbreak.totalCases} cases)
                  </span>
                </div>
              }
              actions={
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePrintLineListing(outbreak);
                    }}
                    title="Print Line List"
                  >
                    <Printer className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedOutbreak(outbreak);
                      setShowAddCaseModal(true);
                    }}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Case
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleResolveOutbreak(outbreak);
                    }}
                  >
                    <Check className="h-4 w-4 mr-1" />
                    Resolve
                  </Button>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <ChevronDown className={`h-4 w-4 transition-transform ${
                        expandedOutbreaks.has(outbreak.id) ? '' : '-rotate-90'
                      }`} />
                    </Button>
                  </CollapsibleTrigger>
                </div>
              }
            >
              <CollapsibleContent>
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-4 text-sm">
                    <span><strong>Started:</strong> {new Date(outbreak.startDate).toLocaleDateString()}</span>
                    <span><strong>Units:</strong> {outbreak.affectedUnits.join(', ') || 'None yet'}</span>
                    {outbreak.notes && <span><strong>Notes:</strong> {outbreak.notes}</span>}
                  </div>
                  {renderLineListingTable(outbreak)}
                </div>
              </CollapsibleContent>
            </SectionCard>
          </Collapsible>
        ))
      )}

      {/* Resolved Outbreaks */}
      {resolvedOutbreaks.length > 0 && (
        <SectionCard title={`Resolved Outbreaks (${resolvedOutbreaks.length})`}>
          <div className="space-y-2">
            {resolvedOutbreaks.slice(0, 5).map(outbreak => (
              <div key={outbreak.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className={CATEGORY_COLORS[outbreak.type]}>
                    {outbreak.type.toUpperCase()}
                  </Badge>
                  <span>{outbreak.name}</span>
                  <span className="text-sm text-muted-foreground">
                    {outbreak.totalCases} cases
                  </span>
                </div>
                <span className="text-sm text-muted-foreground">
                  Resolved: {outbreak.endDate ? new Date(outbreak.endDate).toLocaleDateString() : 'N/A'}
                </span>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* New Outbreak Modal */}
      <Dialog open={showNewOutbreakModal} onOpenChange={setShowNewOutbreakModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Outbreak</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Outbreak Name</label>
              <Select value={outbreakNameType} onValueChange={setOutbreakNameType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select outbreak type..." />
                </SelectTrigger>
                <SelectContent>
                  {OUTBREAK_NAME_OPTIONS.map(opt => (
                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {outbreakNameType === 'Other' && (
                <Input
                  value={customOutbreakName}
                  onChange={(e) => setCustomOutbreakName(e.target.value)}
                  placeholder="Enter custom outbreak name..."
                  className="mt-2"
                />
              )}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Start Date</label>
              <Input 
                type="date" 
                value={outbreakStartDate} 
                onChange={(e) => setOutbreakStartDate(e.target.value)} 
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Type</label>
              <Select value={newOutbreakType} onValueChange={(v) => setNewOutbreakType(v as SymptomCategory)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="respiratory">Respiratory</SelectItem>
                  <SelectItem value="gi">GI</SelectItem>
                  <SelectItem value="skin">Skin</SelectItem>
                  <SelectItem value="uti">UTI</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Notes</label>
              <Textarea
                value={newOutbreakNotes}
                onChange={(e) => setNewOutbreakNotes(e.target.value)}
                placeholder="Additional details..."
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowNewOutbreakModal(false)}>Cancel</Button>
            <Button onClick={handleCreateOutbreak}>Create Outbreak</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Case Modal - Using new template-based modal */}
      <LineListingCaseModal
        open={showAddCaseModal}
        onOpenChange={setShowAddCaseModal}
        outbreak={selectedOutbreak}
        residents={residents}
        onSubmit={handleAddCaseFromModal}
        mode="add"
      />

      {/* Edit Case Modal - Using new template-based modal */}
      <LineListingCaseModal
        open={showEditCaseModal}
        onOpenChange={(open) => {
          setShowEditCaseModal(open);
          if (!open) setEditingLineListing(null);
        }}
        outbreak={selectedOutbreak || (editingLineListing ? activeOutbreaks.find(o => o.id === editingLineListing.outbreakId) || null : null)}
        residents={residents}
        onSubmit={handleUpdateCaseFromModal}
        editingEntry={editingLineListing}
        mode="edit"
      />


      {/* Contact Tracing Modal */}
      <Dialog open={showContactModal} onOpenChange={setShowContactModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Contact Tracing - {selectedLineListing?.residentName}
            </DialogTitle>
          </DialogHeader>
          
          {/* Existing Contacts */}
          {selectedLineListing && (
            <div className="space-y-3 max-h-40 overflow-y-auto">
              {getContactsByLineListing(db, selectedLineListing.id).map(contact => (
                <div key={contact.id} className="flex items-center gap-3 p-2 bg-muted/50 rounded-lg">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{contact.contactName}</p>
                    <p className="text-xs text-muted-foreground">
                      {contact.contactType} • {contact.exposureType} • {new Date(contact.exposureDate).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge className={
                    contact.followUpStatus === 'cleared' ? 'bg-success/20 text-success' :
                    contact.followUpStatus === 'symptomatic' ? 'bg-destructive/20 text-destructive' :
                    'bg-warning/20 text-warning'
                  }>
                    {contact.followUpStatus}
                  </Badge>
                </div>
              ))}
            </div>
          )}

          <div className="border-t pt-4 space-y-4">
            <h4 className="font-medium">Add New Contact</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Contact Type</label>
                <Select value={contactType} onValueChange={(v) => setContactType(v as 'resident' | 'staff')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="resident">Resident</SelectItem>
                    <SelectItem value="staff">Staff</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {contactType === 'resident' ? (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Resident</label>
                  <Select value={contactMrn} onValueChange={setContactMrn}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      {residents.filter(r => r.mrn !== selectedLineListing?.mrn).map(r => (
                        <SelectItem key={r.mrn} value={r.mrn}>
                          {r.name} - {r.room}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Staff Name</label>
                  <Input value={contactName} onChange={(e) => setContactName(e.target.value)} />
                </div>
              )}
            </div>

            {contactType === 'staff' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Role</label>
                  <Input 
                    value={contactRole} 
                    onChange={(e) => setContactRole(e.target.value)}
                    placeholder="e.g., CNA, RN, Dietary"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Unit</label>
                  <Input value={contactUnit} onChange={(e) => setContactUnit(e.target.value)} />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Exposure Date</label>
                <Input type="date" value={exposureDate} onChange={(e) => setExposureDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Exposure Type</label>
                <Select value={exposureType} onValueChange={setExposureType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Roommate">Roommate</SelectItem>
                    <SelectItem value="Dining">Dining Contact</SelectItem>
                    <SelectItem value="Activity">Activity/Group</SelectItem>
                    <SelectItem value="Care">Care Provided</SelectItem>
                    <SelectItem value="Transport">Transport</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Notes</label>
              <Textarea 
                value={contactNotes} 
                onChange={(e) => setContactNotes(e.target.value)}
                placeholder="Additional details..."
                rows={2}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setShowContactModal(false)}>Close</Button>
            <Button onClick={handleAddContact}>
              <Plus className="h-4 w-4 mr-1" />
              Add Contact
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OutbreakView;
