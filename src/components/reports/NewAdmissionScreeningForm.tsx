import { useEffect, useMemo, useState } from 'react';
import { format, parseISO, differenceInDays, subDays } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Printer, AlertTriangle, CheckCircle, Clock, X, Edit, XCircle } from 'lucide-react';
import { loadDB } from '@/lib/database';
import { Resident } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import jsPDF from 'jspdf';
import { toast } from 'sonner';

interface ScreeningFormData {
  mrn: string;
  name: string;
  room: string;
  unit: string;
  admitDate: string;
  daysSinceAdmit: number;
  // Vaccination offers
  pneumoniaOffered: boolean;
  pneumoniaGiven: boolean;
  pneumoniaDeclined: boolean;
  influenzaOffered: boolean;
  influenzaGiven: boolean;
  influenzaDeclined: boolean;
  covidOffered: boolean;
  covidGiven: boolean;
  covidDeclined: boolean;
  rsvOffered: boolean;
  rsvGiven: boolean;
  rsvDeclined: boolean;
  // Clinical assessments
  hasPsychMeds: boolean;
  hasAntibiotics: boolean;
  hasEBP: boolean;
  hasIsolation: boolean;
  hasMDROHistory: boolean;
  hasWoundCare: boolean;
  hasIndwellingDevice: boolean;
  // Status
  screeningStatus: 'pending' | 'complete' | 'overdue' | 'excluded';
  screeningDate?: string;
  screenedBy?: string;
  notes?: string;
}

interface NewAdmissionScreeningFormProps {
  daysBack?: number;
  onPrintForm?: (resident: ScreeningFormData) => void;
}

// Persist excluded MRNs and date overrides in localStorage
const EXCLUDED_KEY = 'icn_screening_excluded';
const DATE_OVERRIDES_KEY = 'icn_screening_date_overrides';

const getExcludedMrns = (): Set<string> => {
  try {
    const data = localStorage.getItem(EXCLUDED_KEY);
    return data ? new Set(JSON.parse(data)) : new Set();
  } catch {
    return new Set();
  }
};

const saveExcludedMrns = (mrns: Set<string>) => {
  localStorage.setItem(EXCLUDED_KEY, JSON.stringify([...mrns]));
};

const getDateOverrides = (): Record<string, string> => {
  try {
    const data = localStorage.getItem(DATE_OVERRIDES_KEY);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
};

const saveDateOverrides = (overrides: Record<string, string>) => {
  localStorage.setItem(DATE_OVERRIDES_KEY, JSON.stringify(overrides));
};

const NewAdmissionScreeningForm = ({ daysBack = 14, onPrintForm }: NewAdmissionScreeningFormProps) => {
  const [selectedMrn, setSelectedMrn] = useState<string | null>(null);
  const [excludedMrns, setExcludedMrns] = useState<Set<string>>(() => getExcludedMrns());
  const [dateOverrides, setDateOverrides] = useState<Record<string, string>>(() => getDateOverrides());
  const [editingDate, setEditingDate] = useState<{ mrn: string; date: string } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;
  
  const db = loadDB();
  const today = new Date();
  const cutoffDate = subDays(today, daysBack);
  
  // Find new admissions - residents whose admitDate is after cutoff OR 
  // residents who appear in current census but weren't in previous (detected on import)
  const screeningList = useMemo(() => {
    const allResidents = Object.values(db.census.residentsByMrn);
    const recentAdmissions: ScreeningFormData[] = [];
    
    allResidents.forEach((resident: Resident) => {
      if (!resident.active_on_census) return;
      
      // Skip excluded residents
      if (excludedMrns.has(resident.mrn)) return;
      
      // Use date override if available
      let admitDate = dateOverrides[resident.mrn] || resident.admitDate;
      let isNewAdmission = false;
      
      // Check if resident has a valid admit date within the period
      if (admitDate) {
        try {
          const admit = parseISO(admitDate);
          if (admit >= cutoffDate) {
            isNewAdmission = true;
          }
        } catch {
          // Invalid date
        }
      }
      
      // Also check last_seen_census_at - if recently added to census
      const lastSeen = resident.last_seen_census_at;
      if (lastSeen && !isNewAdmission) {
        try {
          const seenDate = parseISO(lastSeen);
          if (seenDate >= cutoffDate && !admitDate) {
            // New to census without admit date - likely new admission
            isNewAdmission = true;
            admitDate = lastSeen; // Use census date as proxy
          }
        } catch {
          // Invalid date
        }
      }
      
      if (!isNewAdmission) return;
      
      const daysSinceAdmit = admitDate ? differenceInDays(today, parseISO(admitDate)) : 0;
      
      // Check for existing clinical records
      const ipCases = db.records.ip_cases.filter(c => c.mrn === resident.mrn);
      const hasActiveIP = ipCases.some(c => (c.status || '').toLowerCase() === 'active');
      const hasEBP = ipCases.some(c => c.protocol === 'EBP' && (c.status || '').toLowerCase() === 'active');
      const hasIsolation = ipCases.some(c => c.protocol === 'Isolation' && (c.status || '').toLowerCase() === 'active');
      
      const abtRecords = db.records.abx.filter(r => r.mrn === resident.mrn);
      const hasActiveABT = abtRecords.some(r => (r.status || '').toLowerCase() === 'active');
      
      // Determine screening status
      let screeningStatus: 'pending' | 'complete' | 'overdue' = 'pending';
      if (hasActiveIP) {
        screeningStatus = 'complete'; // Has IP case = screened
      } else if (daysSinceAdmit > 3) {
        screeningStatus = 'overdue';
      }
      
      // Check vaccination records
      const vaxRecords = db.records.vax.filter(v => v.mrn === resident.mrn);
      const hasVax = (type: string): { given: boolean; declined: boolean } => {
        const record = vaxRecords.find(v => 
          (v.vaccine || v.vaccine_type || '').toLowerCase().includes(type)
        );
        return {
          given: record?.status === 'given',
          declined: record?.status === 'declined'
        };
      };
      
      const pneumonia = hasVax('pneumo');
      const influenza = hasVax('flu') || hasVax('influenza');
      const covid = hasVax('covid');
      const rsv = hasVax('rsv');
      
      recentAdmissions.push({
        mrn: resident.mrn,
        name: resident.name,
        room: resident.room,
        unit: resident.unit,
        admitDate: admitDate || '',
        daysSinceAdmit,
        // Vaccination status from records
        pneumoniaOffered: pneumonia.given || pneumonia.declined,
        pneumoniaGiven: pneumonia.given,
        pneumoniaDeclined: pneumonia.declined,
        influenzaOffered: influenza.given || influenza.declined,
        influenzaGiven: influenza.given,
        influenzaDeclined: influenza.declined,
        covidOffered: covid.given || covid.declined,
        covidGiven: covid.given,
        covidDeclined: covid.declined,
        rsvOffered: rsv.given || rsv.declined,
        rsvGiven: rsv.given,
        rsvDeclined: rsv.declined,
        // Clinical status
        hasPsychMeds: false, // Not tracked in current schema
        hasAntibiotics: hasActiveABT,
        hasEBP,
        hasIsolation,
        hasMDROHistory: ipCases.some(c => 
          (c.infectionType || c.infection_type || '').toLowerCase().includes('mdro') ||
          (c.sourceOfInfection || c.source_of_infection || '').toLowerCase().includes('mrsa') ||
          (c.sourceOfInfection || c.source_of_infection || '').toLowerCase().includes('vre')
        ),
        hasWoundCare: false,
        hasIndwellingDevice: false,
        screeningStatus,
      });
    });
    
    // Sort by admit date (newest first)
    return recentAdmissions.sort((a, b) => {
      if (!a.admitDate) return 1;
      if (!b.admitDate) return -1;
      return parseISO(b.admitDate).getTime() - parseISO(a.admitDate).getTime();
    });
  }, [db, cutoffDate, today, excludedMrns, dateOverrides, refreshKey]);
  
  const pendingCount = screeningList.filter(s => s.screeningStatus === 'pending').length;
  const overdueCount = screeningList.filter(s => s.screeningStatus === 'overdue').length;
  const completeCount = screeningList.filter(s => s.screeningStatus === 'complete').length;

  const filteredScreeningList = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return screeningList;
    return screeningList.filter(item => {
      const searchable = [
        item.name,
        item.mrn,
        item.room,
        item.unit,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return searchable.includes(query);
    });
  }, [screeningList, searchQuery]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, screeningList.length]);

  const totalPages = Math.max(1, Math.ceil(filteredScreeningList.length / pageSize));
  const clampedPage = Math.min(currentPage, totalPages);
  const startIndex = (clampedPage - 1) * pageSize;
  const pagedScreeningList = filteredScreeningList.slice(startIndex, startIndex + pageSize);
  const rangeStart = filteredScreeningList.length === 0 ? 0 : startIndex + 1;
  const rangeEnd = Math.min(startIndex + pageSize, filteredScreeningList.length);
  
  const handleExclude = (mrn: string, name: string) => {
    const newExcluded = new Set(excludedMrns);
    newExcluded.add(mrn);
    setExcludedMrns(newExcluded);
    saveExcludedMrns(newExcluded);
    toast.success(`${name} excluded from screening list`);
    setRefreshKey(k => k + 1);
  };
  
  const handleEditDate = (mrn: string, currentDate: string) => {
    setEditingDate({ mrn, date: currentDate });
  };
  
  const handleSaveDate = () => {
    if (!editingDate) return;
    const newOverrides = { ...dateOverrides, [editingDate.mrn]: editingDate.date };
    setDateOverrides(newOverrides);
    saveDateOverrides(newOverrides);
    toast.success('Admission date updated');
    setEditingDate(null);
    setRefreshKey(k => k + 1);
  };
  
  const generatePDF = (formData: ScreeningFormData) => {
    const doc = new jsPDF();
    const facility = db.settings.facilityName || 'Healthcare Facility';
    
    // Header
    doc.setFontSize(16);
    doc.text(facility, 105, 15, { align: 'center' });
    doc.setFontSize(12);
    doc.text('NEW ADMISSION IP SCREENING FORM', 105, 22, { align: 'center' });
    
    // Resident info
    doc.setFontSize(10);
    let y = 35;
    doc.text(`Resident: ${formData.name}`, 15, y);
    doc.text(`MRN: ${formData.mrn}`, 120, y);
    y += 7;
    doc.text(`Room: ${formData.room}`, 15, y);
    doc.text(`Unit: ${formData.unit}`, 80, y);
    doc.text(`Admit Date: ${formData.admitDate ? format(parseISO(formData.admitDate), 'MM/dd/yyyy') : 'N/A'}`, 120, y);
    
    // Vaccination section
    y += 15;
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text('VACCINATION OFFERS', 15, y);
    doc.setFont(undefined, 'normal');
    doc.setFontSize(10);
    
    y += 8;
    const vaccines = [
      { name: 'Pneumococcal (PPSV23/PCV)', offered: formData.pneumoniaOffered, given: formData.pneumoniaGiven, declined: formData.pneumoniaDeclined },
      { name: 'Influenza (Flu)', offered: formData.influenzaOffered, given: formData.influenzaGiven, declined: formData.influenzaDeclined },
      { name: 'COVID-19', offered: formData.covidOffered, given: formData.covidGiven, declined: formData.covidDeclined },
      { name: 'RSV', offered: formData.rsvOffered, given: formData.rsvGiven, declined: formData.rsvDeclined },
    ];
    
    vaccines.forEach(vax => {
      doc.rect(15, y - 3, 4, 4);
      if (vax.offered) doc.text('X', 15.5, y);
      doc.text(`Offered: ${vax.name}`, 22, y);
      
      doc.rect(100, y - 3, 4, 4);
      if (vax.given) doc.text('X', 100.5, y);
      doc.text('Given', 107, y);
      
      doc.rect(130, y - 3, 4, 4);
      if (vax.declined) doc.text('X', 130.5, y);
      doc.text('Declined', 137, y);
      
      y += 7;
    });
    
    // Clinical Assessment section
    y += 10;
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text('CLINICAL ASSESSMENT ON ADMISSION', 15, y);
    doc.setFont(undefined, 'normal');
    doc.setFontSize(10);
    
    y += 8;
    const clinicalItems = [
      { label: 'Psychotropic Medications', checked: formData.hasPsychMeds },
      { label: 'Active Antibiotic Therapy', checked: formData.hasAntibiotics },
      { label: 'Enhanced Barrier Precautions (EBP)', checked: formData.hasEBP },
      { label: 'Isolation Precautions', checked: formData.hasIsolation },
      { label: 'MDRO History (MRSA/VRE/CRE)', checked: formData.hasMDROHistory },
      { label: 'Active Wound Care', checked: formData.hasWoundCare },
      { label: 'Indwelling Device (Foley/PICC/G-tube)', checked: formData.hasIndwellingDevice },
    ];
    
    const col1 = clinicalItems.slice(0, 4);
    const col2 = clinicalItems.slice(4);
    
    col1.forEach((item, i) => {
      const itemY = y + (i * 7);
      doc.rect(15, itemY - 3, 4, 4);
      if (item.checked) doc.text('X', 15.5, itemY);
      doc.text(item.label, 22, itemY);
    });
    
    col2.forEach((item, i) => {
      const itemY = y + (i * 7);
      doc.rect(105, itemY - 3, 4, 4);
      if (item.checked) doc.text('X', 105.5, itemY);
      doc.text(item.label, 112, itemY);
    });
    
    y += 35;
    
    // Notes section
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text('SCREENING NOTES', 15, y);
    doc.setFont(undefined, 'normal');
    y += 5;
    doc.rect(15, y, 180, 30);
    
    y += 40;
    
    // Signature section
    doc.text('Screened By: _____________________________', 15, y);
    doc.text('Date/Time: _____________________________', 110, y);
    
    y += 10;
    doc.text('Title: _____________________________', 15, y);
    doc.text('Signature: _____________________________', 110, y);
    
    // Footer
    doc.setFontSize(8);
    doc.text('Per CMS F880/F881/F883: New admissions must be screened for infection status, MDRO history, and vaccination status within 72 hours.', 15, 280);
    
    // Save/Print
    doc.autoPrint();
    const blobUrl = doc.output('bloburl');
    window.open(blobUrl.toString(), '_blank');
  };
  
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'complete':
        return <CheckCircle className="w-4 h-4 text-success" />;
      case 'overdue':
        return <AlertTriangle className="w-4 h-4 text-destructive" />;
      default:
        return <Clock className="w-4 h-4 text-warning" />;
    }
  };
  
  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="stat-card text-center">
          <div className="text-2xl font-bold text-foreground">{screeningList.length}</div>
          <div className="text-sm text-muted-foreground">New Admissions</div>
        </div>
        <div className="stat-card text-center">
          <div className="text-2xl font-bold text-warning">{pendingCount}</div>
          <div className="text-sm text-muted-foreground">Pending</div>
        </div>
        <div className="stat-card text-center">
          <div className="text-2xl font-bold text-destructive">{overdueCount}</div>
          <div className="text-sm text-muted-foreground">Overdue (&gt;3 days)</div>
        </div>
      </div>
      
      {/* Alert for overdue */}
      {overdueCount > 0 && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0" />
          <div>
            <p className="font-medium text-destructive">Screening Overdue</p>
            <p className="text-sm text-muted-foreground">
              {overdueCount} admission(s) have not been screened within 72 hours per CMS guidelines
            </p>
          </div>
        </div>
      )}
      
      {/* Screening List */}
      <div className="border rounded-lg overflow-hidden">
        <div className="border-b bg-muted/30 px-3 py-2">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="text-xs text-muted-foreground">
              Showing {rangeStart}-{rangeEnd} of {filteredScreeningList.length} admissions
            </div>
            <div className="w-full md:w-64">
              <Input
                placeholder="Search by name, MRN, room, unit..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </div>
          </div>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Status</th>
              <th>Room</th>
              <th>Resident</th>
              <th>Admit Date</th>
              <th>Days</th>
              <th>Vaccines</th>
              <th>Clinical Flags</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredScreeningList.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-8 text-muted-foreground">
                  No matching admissions found for the last {daysBack} days
                </td>
              </tr>
            ) : (
              pagedScreeningList.map((item) => (
                <tr key={item.mrn} className={item.screeningStatus === 'overdue' ? 'bg-destructive/5' : ''}>
                  <td>{getStatusIcon(item.screeningStatus)}</td>
                  <td className="font-medium">{item.room}</td>
                  <td>
                    <div>{item.name}</div>
                    <div className="text-xs text-muted-foreground">{item.mrn}</div>
                  </td>
                  <td>{item.admitDate ? format(parseISO(item.admitDate), 'MM/dd/yyyy') : '—'}</td>
                  <td>
                    <span className={item.daysSinceAdmit > 3 ? 'text-destructive font-medium' : ''}>
                      {item.daysSinceAdmit}
                    </span>
                  </td>
                  <td>
                    <div className="flex gap-1 flex-wrap">
                      {item.pneumoniaGiven && <span className="badge-status badge-ok text-xs">Pneumo</span>}
                      {item.influenzaGiven && <span className="badge-status badge-ok text-xs">Flu</span>}
                      {item.covidGiven && <span className="badge-status badge-ok text-xs">COVID</span>}
                      {item.rsvGiven && <span className="badge-status badge-ok text-xs">RSV</span>}
                      {!item.pneumoniaGiven && !item.influenzaGiven && !item.covidGiven && !item.rsvGiven && (
                        <span className="text-xs text-muted-foreground">Needs offer</span>
                      )}
                    </div>
                  </td>
                  <td>
                    <div className="flex gap-1 flex-wrap">
                      {item.hasAntibiotics && <span className="badge-status badge-warn text-xs">ABT</span>}
                      {item.hasEBP && <span className="badge-status badge-info text-xs">EBP</span>}
                      {item.hasIsolation && <span className="badge-status badge-ip text-xs">ISO</span>}
                      {item.hasMDROHistory && <span className="badge-status badge-ip text-xs">MDRO</span>}
                      {!item.hasAntibiotics && !item.hasEBP && !item.hasIsolation && !item.hasMDROHistory && (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </div>
                  </td>
                  <td>
                    <div className="flex items-center gap-1">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => generatePDF(item)}
                        title="Print Form"
                      >
                        <Printer className="w-3 h-3" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleEditDate(item.mrn, item.admitDate)}
                        title="Edit Admission Date"
                      >
                        <Edit className="w-3 h-3" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleExclude(item.mrn, item.name)}
                        title="Exclude from Screening"
                      >
                        <XCircle className="w-3 h-3" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {filteredScreeningList.length > pageSize && (
          <div className="border-t bg-muted/20 px-3 py-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs text-muted-foreground">
              Page {clampedPage} of {totalPages}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(page => Math.max(1, page - 1))}
                disabled={clampedPage === 1}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(page => Math.min(totalPages, page + 1))}
                disabled={clampedPage === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
      
      {/* Footer info */}
      <div className="text-xs text-muted-foreground">
        <p>Per CMS F880/F881/F883: New admissions must be screened for infection status, MDRO history, and vaccination status within 72 hours.</p>
        <p className="mt-1">Vaccination offers include: Pneumococcal, Influenza, COVID-19, and RSV per F883/F887 requirements.</p>
      </div>
      
      {/* Edit Date Modal */}
      <Dialog open={!!editingDate} onOpenChange={(open) => !open && setEditingDate(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit Admission Date</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Admission Date</Label>
              <Input 
                type="date" 
                value={editingDate?.date || ''} 
                onChange={(e) => setEditingDate(prev => prev ? { ...prev, date: e.target.value } : null)}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditingDate(null)}>Cancel</Button>
            <Button onClick={handleSaveDate}>Save</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default NewAdmissionScreeningForm;
