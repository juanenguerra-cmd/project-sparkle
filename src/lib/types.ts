// ICN Hub Data Types

export interface Resident {
  id: string;
  mrn: string;
  name: string;
  unit: string;
  room: string;
  dob?: string;
  dob_raw?: string;
  admitDate?: string;
  active_on_census: boolean;
  physician?: string;
  notes?: string;
  status?: string;
  payor?: string;
  last_seen_census_at?: string;
  last_missing_census_at?: string | null;
}

export interface ABTRecord {
  id: string;
  record_id?: string;
  mrn: string;
  residentName?: string;
  name?: string;
  unit: string;
  room: string;
  medication?: string;
  med_name?: string;
  dose: string;
  route: string;
  route_raw?: string;
  frequency?: string;
  indication: string;
  infection_source?: string;
  startDate?: string;
  start_date?: string;
  endDate?: string;
  end_date?: string;
  status: 'active' | 'completed' | 'discontinued';
  daysOfTherapy?: number;
  tx_days?: number | null;
  nextReviewDate?: string;
  notes?: string;
  createdAt?: string;
  updated_at?: string;
  source?: string;
}

export interface IPCase {
  id: string;
  record_id?: string;
  mrn: string;
  residentName?: string;
  name?: string;
  unit: string;
  room: string;
  infectionType?: string;
  infection_type?: string;
  protocol: 'EBP' | 'Isolation' | 'Standard Precautions';
  isolationType?: 'Contact' | 'Droplet' | 'Airborne';
  isolation_type?: string;
  sourceOfInfection?: string;
  source_of_infection?: string;
  onsetDate?: string;
  onset_date?: string;
  resolutionDate?: string;
  resolution_date?: string;
  status: 'Active' | 'Resolved' | 'Discharged';
  case_status?: string;
  nextReviewDate?: string;
  next_review_date?: string;
  notes?: string;
  createdAt?: string;
  _autoClosed?: boolean;
  _autoClosedReason?: string;
  // Review tracking fields
  lastReviewDate?: string;
  reviewNotes?: string;
}

export interface VaxRecord {
  id: string;
  record_id?: string;
  mrn: string;
  residentName?: string;
  name?: string;
  unit: string;
  room: string;
  vaccine: string;
  vaccine_type?: string;
  dose?: string;
  status: 'given' | 'due' | 'overdue' | 'declined';
  dateGiven?: string;
  date_given?: string;
  dueDate?: string;
  due_date?: string;
  notes?: string;
  createdAt?: string;
}

// Symptom types for auto-classification
export type SymptomCategory = 'respiratory' | 'gi' | 'skin' | 'uti' | 'other';

export interface SymptomEntry {
  id: string;
  name: string;
  category: SymptomCategory;
}

// Predefined symptoms with auto-classification
export const SYMPTOM_OPTIONS: SymptomEntry[] = [
  // Respiratory
  { id: 'fever', name: 'Fever', category: 'respiratory' },
  { id: 'cough', name: 'Cough', category: 'respiratory' },
  { id: 'sob', name: 'Shortness of Breath', category: 'respiratory' },
  { id: 'sore_throat', name: 'Sore Throat', category: 'respiratory' },
  { id: 'congestion', name: 'Congestion', category: 'respiratory' },
  { id: 'runny_nose', name: 'Runny Nose', category: 'respiratory' },
  { id: 'headache', name: 'Headache', category: 'respiratory' },
  { id: 'body_aches', name: 'Body Aches', category: 'respiratory' },
  // GI
  { id: 'nausea', name: 'Nausea', category: 'gi' },
  { id: 'vomiting', name: 'Vomiting', category: 'gi' },
  { id: 'diarrhea', name: 'Diarrhea', category: 'gi' },
  { id: 'abdominal_pain', name: 'Abdominal Pain', category: 'gi' },
  { id: 'loss_appetite', name: 'Loss of Appetite', category: 'gi' },
  // Skin
  { id: 'rash', name: 'Rash', category: 'skin' },
  { id: 'wound_drainage', name: 'Wound Drainage', category: 'skin' },
  { id: 'redness', name: 'Redness/Erythema', category: 'skin' },
  { id: 'swelling', name: 'Swelling', category: 'skin' },
  // UTI
  { id: 'dysuria', name: 'Dysuria', category: 'uti' },
  { id: 'frequency', name: 'Urinary Frequency', category: 'uti' },
  { id: 'urgency', name: 'Urinary Urgency', category: 'uti' },
  { id: 'cloudy_urine', name: 'Cloudy Urine', category: 'uti' },
  // Other
  { id: 'fatigue', name: 'Fatigue', category: 'other' },
  { id: 'confusion', name: 'Confusion/AMS', category: 'other' },
  { id: 'other', name: 'Other', category: 'other' },
];

export interface Note {
  id: string;
  mrn: string;
  residentName?: string;
  name?: string;
  unit: string;
  room: string;
  category: string;
  text: string;
  createdAt: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
  // Symptom tracking fields
  symptoms?: string[];
  symptomCategory?: SymptomCategory;
  requiresFollowUp?: boolean;
  followUpDate?: string;
  followUpStatus?: 'pending' | 'completed' | 'escalated';
  followUpNotes?: string;
  linkedLineListingId?: string;
}

// Line Listing for outbreak tracking
export interface LineListingEntry {
  id: string;
  mrn: string;
  residentName: string;
  unit: string;
  room: string;
  outbreakId: string;
  onsetDate: string;
  symptoms: string[];
  symptomCategory: SymptomCategory;
  labResults?: string;
  outcome?: 'active' | 'resolved' | 'hospitalized' | 'deceased';
  resolutionDate?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
  linkedNoteIds?: string[];
  contacts?: ContactEntry[];
}

// Contact tracing
export interface ContactEntry {
  id: string;
  lineListingId: string;
  contactType: 'resident' | 'staff';
  contactName: string;
  contactMrn?: string; // For residents
  contactRole?: string; // For staff
  contactUnit?: string;
  exposureDate: string;
  exposureType: string; // e.g., "Roommate", "Dining", "Care provided"
  notes?: string;
  followUpStatus?: 'pending' | 'cleared' | 'symptomatic';
  createdAt: string;
}

// Outbreak definition
export interface Outbreak {
  id: string;
  name: string;
  type: SymptomCategory;
  startDate: string;
  endDate?: string;
  status: 'active' | 'resolved';
  affectedUnits: string[];
  totalCases: number;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface AuditEntry {
  id: string;
  action: string;
  details: string;
  entityType: 'census' | 'abt' | 'ip' | 'vax' | 'notes' | 'settings' | 'export' | 'import' | 'abx';
  timestamp: string;
  user?: string;
}

export interface AppSettings {
  facilityName: string;
  abtReviewCadence: number;
  autoCloseCensus: boolean;
  autoCloseGraceDays: number;
  ipRules: {
    ebpReviewDays: number;
    isolationReviewDays: number;
  };
  vaxRules: Record<string, {
    intervalDays?: number;
    windowStartMmdd?: string;
    windowEndMmdd?: string;
  }>;
}

export interface AppDatabase {
  census: {
    residentsByMrn: Record<string, Resident>;
    lastImportAt?: string;
    meta?: {
      imported_at: string | null;
    };
  };
  records: {
    abx: ABTRecord[];
    ip_cases: IPCase[];
    vax: VaxRecord[];
    notes: Note[];
    line_listings: LineListingEntry[];
    outbreaks: Outbreak[];
    contacts: ContactEntry[];
  };
  audit_log: AuditEntry[];
  settings: AppSettings;
}

export type ViewType = 
  | 'dashboard' 
  | 'abt' 
  | 'census' 
  | 'resident_overview'
  | 'ip' 
  | 'vax' 
  | 'notes' 
  | 'outbreak'
  | 'reports' 
  | 'audit' 
  | 'settings';

export interface NavItem {
  id: ViewType;
  label: string;
  icon: string;
}
