import { 
  Resident, 
  ABTRecord, 
  IPCase, 
  VaxRecord, 
  Note, 
  AuditEntry,
  AppDatabase 
} from './types';
import { toLocalISODate } from './parsers';

// Helper to generate dates
const daysAgo = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return toLocalISODate(d);
};

const daysFromNow = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return toLocalISODate(d);
};

// Mock Residents
const mockResidents: Resident[] = [
  { id: 'r1', mrn: 'MRN001', name: 'Smith, John', unit: 'Unit A', room: '101', dob: '1945-03-15', admitDate: '2024-01-10', active_on_census: true },
  { id: 'r2', mrn: 'MRN002', name: 'Johnson, Mary', unit: 'Unit A', room: '102', dob: '1938-07-22', admitDate: '2023-11-05', active_on_census: true },
  { id: 'r3', mrn: 'MRN003', name: 'Williams, Robert', unit: 'Unit B', room: '201', dob: '1950-12-08', admitDate: '2024-02-14', active_on_census: true },
  { id: 'r4', mrn: 'MRN004', name: 'Brown, Patricia', unit: 'Unit B', room: '202', dob: '1942-09-30', admitDate: '2023-08-20', active_on_census: true },
  { id: 'r5', mrn: 'MRN005', name: 'Davis, Michael', unit: 'Unit C', room: '301', dob: '1955-01-17', admitDate: '2024-03-01', active_on_census: true },
  { id: 'r6', mrn: 'MRN006', name: 'Miller, Elizabeth', unit: 'Unit C', room: '302', dob: '1948-05-25', admitDate: '2023-12-12', active_on_census: true },
  { id: 'r7', mrn: 'MRN007', name: 'Wilson, James', unit: 'Unit A', room: '103', dob: '1940-11-03', admitDate: '2024-01-25', active_on_census: true },
  { id: 'r8', mrn: 'MRN008', name: 'Moore, Barbara', unit: 'Unit B', room: '203', dob: '1952-08-14', admitDate: '2023-10-30', active_on_census: true },
];

// Mock ABT Records
const mockABT: ABTRecord[] = [
  {
    id: 'abt1',
    mrn: 'MRN001',
    residentName: 'Smith, John',
    unit: 'Unit A',
    room: '101',
    medication: 'Amoxicillin',
    dose: '500mg',
    route: 'PO',
    frequency: 'TID',
    indication: 'UTI',
    startDate: daysAgo(5),
    status: 'active',
    daysOfTherapy: 5,
    nextReviewDate: daysFromNow(2),
    createdAt: daysAgo(5),
  },
  {
    id: 'abt2',
    mrn: 'MRN003',
    residentName: 'Williams, Robert',
    unit: 'Unit B',
    room: '201',
    medication: 'Ciprofloxacin',
    dose: '250mg',
    route: 'PO',
    frequency: 'BID',
    indication: 'Respiratory Infection',
    startDate: daysAgo(3),
    status: 'active',
    daysOfTherapy: 3,
    nextReviewDate: daysFromNow(4),
    createdAt: daysAgo(3),
  },
  {
    id: 'abt3',
    mrn: 'MRN005',
    residentName: 'Davis, Michael',
    unit: 'Unit C',
    room: '301',
    medication: 'Vancomycin',
    dose: '1g',
    route: 'IV',
    frequency: 'Q12H',
    indication: 'Cellulitis',
    startDate: daysAgo(7),
    status: 'active',
    daysOfTherapy: 7,
    nextReviewDate: daysAgo(1), // Overdue
    createdAt: daysAgo(7),
  },
  {
    id: 'abt4',
    mrn: 'MRN002',
    residentName: 'Johnson, Mary',
    unit: 'Unit A',
    room: '102',
    medication: 'Azithromycin',
    dose: '250mg',
    route: 'PO',
    frequency: 'QD',
    indication: 'Pneumonia',
    startDate: daysAgo(10),
    endDate: daysAgo(3),
    status: 'completed',
    daysOfTherapy: 7,
    createdAt: daysAgo(10),
  },
];

// Mock IP Cases
const mockIPCases: IPCase[] = [
  {
    id: 'ip1',
    mrn: 'MRN002',
    residentName: 'Johnson, Mary',
    unit: 'Unit A',
    room: '102',
    infectionType: 'C. diff',
    protocol: 'Isolation',
    isolationType: 'Contact',
    sourceOfInfection: 'GI',
    onsetDate: daysAgo(4),
    status: 'Active',
    nextReviewDate: daysFromNow(3),
    createdAt: daysAgo(4),
  },
  {
    id: 'ip2',
    mrn: 'MRN006',
    residentName: 'Miller, Elizabeth',
    unit: 'Unit C',
    room: '302',
    infectionType: 'MRSA',
    protocol: 'EBP',
    sourceOfInfection: 'Skin/Soft Tissue',
    onsetDate: daysAgo(14),
    status: 'Active',
    nextReviewDate: daysFromNow(7),
    createdAt: daysAgo(14),
  },
  {
    id: 'ip3',
    mrn: 'MRN004',
    residentName: 'Brown, Patricia',
    unit: 'Unit B',
    room: '202',
    infectionType: 'Influenza',
    protocol: 'Isolation',
    isolationType: 'Droplet',
    sourceOfInfection: 'Respiratory',
    onsetDate: daysAgo(6),
    status: 'Active',
    nextReviewDate: daysAgo(2), // Overdue
    createdAt: daysAgo(6),
  },
];

// Mock VAX Records
const mockVax: VaxRecord[] = [
  { id: 'vax1', mrn: 'MRN001', residentName: 'Smith, John', unit: 'Unit A', room: '101', vaccine: 'Influenza', dose: '1', status: 'given', dateGiven: daysAgo(30), createdAt: daysAgo(30) },
  { id: 'vax2', mrn: 'MRN002', residentName: 'Johnson, Mary', unit: 'Unit A', room: '102', vaccine: 'Influenza', dose: '1', status: 'due', dueDate: daysFromNow(5), createdAt: daysAgo(60) },
  { id: 'vax3', mrn: 'MRN003', residentName: 'Williams, Robert', unit: 'Unit B', room: '201', vaccine: 'COVID-19', dose: 'Booster', status: 'overdue', dueDate: daysAgo(10), createdAt: daysAgo(120) },
  { id: 'vax4', mrn: 'MRN004', residentName: 'Brown, Patricia', unit: 'Unit B', room: '202', vaccine: 'Pneumococcal', dose: '1', status: 'given', dateGiven: daysAgo(45), createdAt: daysAgo(45) },
  { id: 'vax5', mrn: 'MRN005', residentName: 'Davis, Michael', unit: 'Unit C', room: '301', vaccine: 'Influenza', dose: '1', status: 'declined', createdAt: daysAgo(20) },
  { id: 'vax6', mrn: 'MRN006', residentName: 'Miller, Elizabeth', unit: 'Unit C', room: '302', vaccine: 'COVID-19', dose: 'Booster', status: 'due', dueDate: daysFromNow(14), createdAt: daysAgo(90) },
];

// Mock Notes
const mockNotes: Note[] = [
  { id: 'n1', mrn: 'MRN001', residentName: 'Smith, John', unit: 'Unit A', room: '101', category: 'Clinical', text: 'Patient responding well to antibiotic therapy. No adverse reactions noted.', createdAt: daysAgo(1) },
  { id: 'n2', mrn: 'MRN002', residentName: 'Johnson, Mary', unit: 'Unit A', room: '102', category: 'Isolation', text: 'Contact precautions in place. Staff reminded of PPE requirements.', createdAt: daysAgo(2) },
  { id: 'n3', mrn: 'MRN003', residentName: 'Williams, Robert', unit: 'Unit B', room: '201', category: 'Follow-up', text: 'COVID booster overdue. Family contacted, consent pending.', createdAt: daysAgo(1) },
];

// Mock Audit Log
const mockAudit: AuditEntry[] = [
  { id: 'a1', action: 'census_import', details: 'Imported 8 residents from census file', entityType: 'census', timestamp: daysAgo(0) + 'T09:15:00' },
  { id: 'a2', action: 'abt_added', details: 'Added Amoxicillin for Smith, John', entityType: 'abt', timestamp: daysAgo(0) + 'T10:30:00' },
  { id: 'a3', action: 'ip_case_added', details: 'Added C. diff case for Johnson, Mary', entityType: 'ip', timestamp: daysAgo(1) + 'T14:20:00' },
  { id: 'a4', action: 'vax_given', details: 'Marked Influenza given for Smith, John', entityType: 'vax', timestamp: daysAgo(2) + 'T11:00:00' },
  { id: 'a5', action: 'note_added', details: 'Note added for Williams, Robert', entityType: 'notes', timestamp: daysAgo(1) + 'T16:45:00' },
];

// Create the full mock database
export const mockDatabase: AppDatabase = {
  census: {
    residentsByMrn: mockResidents.reduce((acc, r) => {
      acc[r.mrn] = r;
      return acc;
    }, {} as Record<string, Resident>),
    lastImportAt: new Date().toISOString(),
  },
  records: {
    abx: mockABT,
    ip_cases: mockIPCases,
    vax: mockVax,
    notes: mockNotes,
    line_listings: [],
    outbreaks: [],
    contacts: [],
  },
  audit_log: mockAudit,
  settings: {
    facilityName: 'Sunrise Care Center',
    abtReviewCadence: 72,
    autoCloseCensus: true,
    autoCloseGraceDays: 2,
    ipRules: {
      ebpReviewDays: 7,
      isolationReviewDays: 3,
    },
    vaxRules: {
      FLU: { windowStartMmdd: '08-01', windowEndMmdd: '03-31' },
      COVID: { intervalDays: 180 },
      PNA: { intervalDays: 365 * 5 },
    },
    oneDriveBackup: {
      enabled: false,
      folderPath: '',
    },
  },
};

// Helper functions for statistics
export const getActiveResidents = () => 
  Object.values(mockDatabase.census.residentsByMrn).filter(r => r.active_on_census);

export const getActiveABT = () => 
  mockDatabase.records.abx.filter(r => r.status === 'active');

export const getActiveIPCases = () => 
  mockDatabase.records.ip_cases.filter(r => r.status === 'Active');

export const getVaxDue = () => 
  mockDatabase.records.vax.filter(r => r.status === 'due' || r.status === 'overdue');

export const getRecentNotes = (days: number = 3) => {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return mockDatabase.records.notes.filter(n => new Date(n.createdAt) >= cutoff);
};

export const getRecentAudit = (limit: number = 10) => 
  mockDatabase.audit_log.slice(0, limit);
