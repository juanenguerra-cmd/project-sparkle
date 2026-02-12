// Comprehensive Zod validation schemas for all data types
import { z } from 'zod';

// Utility validators
const isoDateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format');
const isoDateTimeString = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/, 'Must be ISO datetime');
const mrnFormat = z.string().min(1, 'MRN is required').max(50, 'MRN too long');

// Resident Schema
export const ResidentSchema = z.object({
  id: z.string(),
  residentId: z.string().optional(),
  mrn: mrnFormat,
  name: z.string().min(1, 'Name is required'),
  sex: z.enum(['M', 'F', 'Other', 'Unknown']).optional(),
  unit: z.string().min(1, 'Unit is required'),
  room: z.string().min(1, 'Room is required'),
  dob: isoDateString.optional(),
  dob_raw: z.string().optional(),
  admitDate: isoDateString.optional(),
  active_on_census: z.boolean(),
  physician: z.string().optional(),
  notes: z.string().optional(),
  status: z.string().optional(),
  payor: z.string().optional(),
  last_seen_census_at: z.string().optional(),
  last_missing_census_at: z.string().nullable().optional(),
}).refine(
  (data) => {
    if (data.dob && data.admitDate) {
      return new Date(data.dob) < new Date(data.admitDate);
    }
    return true;
  },
  { message: 'Date of birth must be before admit date', path: ['dob'] }
);

// ABT Record Schema
export const ABTRecordSchema = z.object({
  id: z.string(),
  residentId: z.string().optional(),
  abtCourseId: z.string().optional(),
  record_id: z.string().optional(),
  mrn: mrnFormat,
  residentName: z.string().optional(),
  name: z.string().optional(),
  unit: z.string().min(1, 'Unit is required'),
  room: z.string().min(1, 'Room is required'),
  medication: z.string().min(1, 'Medication is required').optional(),
  med_name: z.string().optional(),
  dose: z.string().min(1, 'Dose is required'),
  route: z.string().min(1, 'Route is required'),
  route_raw: z.string().optional(),
  frequency: z.string().optional(),
  indication: z.string().min(1, 'Indication is required'),
  infection_source: z.string().optional(),
  startDate: isoDateString.optional(),
  orderDate: isoDateString.optional(),
  start_date: isoDateString.optional(),
  endDate: isoDateString.optional(),
  end_date: isoDateString.optional(),
  plannedStopDate: isoDateString.optional(),
  status: z.enum(['active', 'completed', 'discontinued']),
  stopReason: z.string().optional(),
  daysOfTherapy: z.number().min(0).optional(),
  tx_days: z.number().min(0).nullable().optional(),
  nextReviewDate: isoDateString.optional(),
  notes: z.string().optional(),
  createdAt: z.string().optional(),
  updated_at: z.string().optional(),
  source: z.string().optional(),
  prescriber: z.string().optional(),
  symptomsChecklist: z.array(z.string()).optional(),
  cultureCollected: z.boolean().optional(),
  cultureResult: z.string().optional(),
  cultureReviewedDate: isoDateString.optional(),
  timeoutReviewDate: isoDateString.optional(),
  timeoutOutcome: z.enum(['continue', 'change', 'stop']).nullable().optional(),
  adverseEffects: z.string().optional(),
  cdiffRisk: z.enum(['low', 'medium', 'high']).optional(),
  stewardshipNotes: z.string().optional(),
}).refine(
  (data) => {
    const start = data.startDate || data.start_date;
    const end = data.endDate || data.end_date || data.plannedStopDate;
    if (start && end) {
      return new Date(start) <= new Date(end);
    }
    return true;
  },
  { message: 'Start date must be before or equal to end date', path: ['endDate'] }
);

// IP Case Schema
export const IPCaseSchema = z.object({
  id: z.string(),
  residentId: z.string().optional(),
  ipCaseId: z.string().optional(),
  record_id: z.string().optional(),
  mrn: mrnFormat,
  residentName: z.string().optional(),
  name: z.string().optional(),
  unit: z.string().min(1, 'Unit is required'),
  room: z.string().min(1, 'Room is required'),
  infectionType: z.string().optional(),
  syndromeCategory: z.enum(['respiratory', 'gi', 'skin', 'uti', 'other']).optional(),
  suspectedOrConfirmedOrganism: z.string().optional(),
  infection_type: z.string().optional(),
  protocol: z.enum(['EBP', 'Isolation', 'Standard Precautions']),
  isolationType: z.enum(['Contact', 'Droplet', 'Airborne']).optional(),
  isolation_type: z.string().optional(),
  sourceOfInfection: z.string().optional(),
  source_of_infection: z.string().optional(),
  onsetDate: isoDateString.optional(),
  onset_date: isoDateString.optional(),
  resolutionDate: isoDateString.optional(),
  resolution_date: isoDateString.optional(),
  status: z.enum(['Active', 'Resolved', 'Discharged']),
  case_status: z.string().optional(),
  nextReviewDate: isoDateString.optional(),
  next_review_date: isoDateString.optional(),
  notes: z.string().optional(),
  createdAt: z.string().optional(),
  _autoClosed: z.boolean().optional(),
  _autoClosedReason: z.string().optional(),
  lastReviewDate: isoDateString.optional(),
  reviewNotes: z.string().optional(),
  triggerReason: z.string().optional(),
  highContactCare: z.array(z.string()).optional(),
  signagePosted: z.boolean().optional(),
  suppliesStocked: z.boolean().optional(),
  roomCheckDate: isoDateString.optional(),
  exposureLinked: z.boolean().optional(),
  outbreakId: z.string().optional(),
  requiredPPE: z.string().optional(),
  dob: isoDateString.optional(),
}).refine(
  (data) => {
    const onset = data.onsetDate || data.onset_date;
    const resolution = data.resolutionDate || data.resolution_date;
    if (onset && resolution) {
      return new Date(onset) <= new Date(resolution);
    }
    return true;
  },
  { message: 'Onset date must be before or equal to resolution date', path: ['resolutionDate'] }
);

// Vaccination Record Schema
export const VaxRecordSchema = z.object({
  id: z.string(),
  residentId: z.string().optional(),
  record_id: z.string().optional(),
  mrn: mrnFormat,
  residentName: z.string().optional(),
  name: z.string().optional(),
  unit: z.string().min(1, 'Unit is required'),
  room: z.string().min(1, 'Room is required'),
  vaccine: z.string().min(1, 'Vaccine type is required'),
  vaccine_type: z.string().optional(),
  dose: z.string().optional(),
  status: z.enum(['given', 'due', 'overdue', 'declined']),
  dateGiven: isoDateString.optional(),
  date_given: isoDateString.optional(),
  dueDate: isoDateString.optional(),
  due_date: isoDateString.optional(),
  notes: z.string().optional(),
  createdAt: z.string().optional(),
  administrationSource: z.enum(['historical', 'in_house']).optional(),
  offerDate: isoDateString.optional(),
  educationProvided: z.boolean().optional(),
  educationDate: isoDateString.optional(),
  educationOutcome: z.enum(['accepted', 'declined', 'deferred']).optional(),
  manufacturer: z.string().optional(),
  lotNumber: z.string().optional(),
  administrationSite: z.string().optional(),
  declineReason: z.string().optional(),
  medicalExemption: z.boolean().optional(),
  contraindication: z.string().optional(),
  consentFormAttached: z.boolean().optional(),
  nextDueDate: isoDateString.optional(),
});

// Note Schema
export const NoteSchema = z.object({
  id: z.string(),
  residentId: z.string().optional(),
  noteId: z.string().optional(),
  mrn: mrnFormat,
  residentName: z.string().optional(),
  name: z.string().optional(),
  unit: z.string().min(1, 'Unit is required'),
  room: z.string().min(1, 'Room is required'),
  category: z.string().min(1, 'Category is required'),
  text: z.string().min(1, 'Note text is required'),
  createdAt: z.string(),
  created_at: z.string().optional(),
  updatedAt: z.string().optional(),
  updated_at: z.string().optional(),
  symptoms: z.array(z.string()).optional(),
  symptomCategory: z.enum(['respiratory', 'gi', 'skin', 'uti', 'other']).optional(),
  requiresFollowUp: z.boolean().optional(),
  followUpDate: isoDateString.optional(),
  followUpStatus: z.enum(['pending', 'completed', 'escalated']).optional(),
  followUpNotes: z.string().optional(),
  linkedLineListingId: z.string().optional(),
  linkedEntityIds: z.object({
    abtCourseIds: z.array(z.string()).optional(),
    ipCaseIds: z.array(z.string()).optional(),
    outbreakIds: z.array(z.string()).optional(),
    lineListingRowIds: z.array(z.string()).optional(),
  }).optional(),
  providerNotified: z.boolean().optional(),
  providerNotifiedAt: z.string().optional(),
  providerResponse: z.string().optional(),
  familyNotified: z.boolean().optional(),
  familyNotifiedAt: z.string().optional(),
});

// Outbreak Schema
export const OutbreakSchema = z.object({
  id: z.string(),
  outbreakId: z.string().optional(),
  name: z.string().min(1, 'Outbreak name is required'),
  type: z.enum(['respiratory', 'gi', 'skin', 'uti', 'other']),
  startDate: isoDateString,
  endDate: isoDateString.optional(),
  status: z.enum(['watch', 'active', 'resolved']),
  declaredAt: z.string().optional(),
  resolvedAt: z.string().optional(),
  affectedUnits: z.array(z.string()).min(1, 'At least one unit must be affected'),
  totalCases: z.number().min(0),
  notes: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string().optional(),
}).refine(
  (data) => {
    if (data.startDate && data.endDate) {
      return new Date(data.startDate) <= new Date(data.endDate);
    }
    return true;
  },
  { message: 'Start date must be before or equal to end date', path: ['endDate'] }
);

// Census Snapshot Schema
export const CensusSnapshotSchema = z.object({
  date: isoDateString,
  censusCount: z.number().min(0, 'Census count must be non-negative'),
});

// Validation helper with override option
export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: string[];
  canOverride: boolean;
}

export function validateWithOverride<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  allowOverride: boolean = true
): ValidationResult<T> {
  const result = schema.safeParse(data);
  
  if (result.success) {
    return {
      success: true,
      data: result.data,
      errors: [],
      canOverride: false,
    };
  }
  
  const errors = result.error.errors.map(
    (err) => `${err.path.join('.')}: ${err.message}`
  );
  
  return {
    success: false,
    errors,
    canOverride: allowOverride,
  };
}

// Duplicate detection
export function checkDuplicateMRN(
  mrn: string,
  residentsByMrn: Record<string, any>,
  excludeId?: string
): { isDuplicate: boolean; existingResident?: any } {
  const existing = residentsByMrn[mrn];
  
  if (!existing) {
    return { isDuplicate: false };
  }
  
  if (excludeId && existing.id === excludeId) {
    return { isDuplicate: false };
  }
  
  return {
    isDuplicate: true,
    existingResident: existing,
  };
}

// Census validation
export function validateCensusImport(
  snapshots: Array<{ date: string; censusCount: number }>,
  existingDates: Set<string>
): {
  valid: boolean;
  duplicates: string[];
  gaps: string[];
  invalidEntries: string[];
} {
  const duplicates: string[] = [];
  const invalidEntries: string[] = [];
  const dates = snapshots.map(s => s.date).sort();
  const gaps: string[] = [];
  
  // Check for duplicates
  for (const snapshot of snapshots) {
    if (existingDates.has(snapshot.date)) {
      duplicates.push(snapshot.date);
    }
    
    const validation = CensusSnapshotSchema.safeParse(snapshot);
    if (!validation.success) {
      invalidEntries.push(`${snapshot.date}: ${validation.error.message}`);
    }
  }
  
  // Check for gaps (more than 1 day between consecutive dates)
  for (let i = 1; i < dates.length; i++) {
    const prev = new Date(dates[i - 1]);
    const curr = new Date(dates[i]);
    const daysDiff = Math.floor((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysDiff > 1) {
      gaps.push(`Gap between ${dates[i - 1]} and ${dates[i]} (${daysDiff - 1} days)`);
    }
  }
  
  return {
    valid: duplicates.length === 0 && invalidEntries.length === 0,
    duplicates,
    gaps,
    invalidEntries,
  };
}
