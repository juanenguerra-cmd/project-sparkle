import { isoDateFromAny } from '@/lib/parsers';

export const VAX_PREFERRED_COLUMNS = [
  'id', 'mrn', 'residentName', 'name', 'unit', 'room',
  'vaccine', 'vaccine_type', 'dose', 'status',
  'dateGiven', 'date_given', 'dueDate', 'due_date', 'nextDueDate',
  'offerDate', 'dateOffered', 'dateDeclined',
  'educationDate', 'educationProvided', 'educationOutcome',
  'administered_by', 'administeredBy', 'givenBy',
  'manufacturer', 'lot', 'lotNumber', 'site', 'administrationSite',
  'declineReason', 'consentStatus', 'consentFormAttached',
  'nextEligibleDate', 'lastOfferedDate', 'reofferDueDate',
  'outbreakTriggered', 'outbreakTriggerDate', 'outbreakName',
  'seasonOverrideCurrent', 'seasonOverrideAt',
  'source', 'notes', 'createdAt', 'updatedAt', 'record_id', 'residentId',
] as const;

export const toISODate = (value?: string): string => {
  if (!value) {
    return '';
  }
  return isoDateFromAny(value) || value;
};

export const normalizeVaxRecordShape = <T extends Record<string, unknown>>(row: T): T & Record<string, unknown> => {
  const normalized = {
    ...row,
    id: String(row.id || row.record_id || ''),
    record_id: String(row.record_id || row.id || ''),
    residentId: String(row.residentId || ''),
    residentName: String(row.residentName || row.name || ''),
    name: String(row.name || row.residentName || ''),
    vaccine: String(row.vaccine || row.vaccine_type || ''),
    vaccine_type: String(row.vaccine_type || row.vaccine || ''),
    status: String(row.status || 'due'),
    dateGiven: toISODate(String(row.dateGiven || row.date_given || '')),
    date_given: toISODate(String(row.date_given || row.dateGiven || '')),
    dueDate: toISODate(String(row.dueDate || row.due_date || '')),
    due_date: toISODate(String(row.due_date || row.dueDate || '')),
    offerDate: toISODate(String(row.offerDate || row.dateOffered || '')),
    dateOffered: toISODate(String(row.dateOffered || row.offerDate || '')),
    dateDeclined: toISODate(String(row.dateDeclined || '')),
    educationDate: toISODate(String(row.educationDate || '')),
    administered_by: String(row.administered_by || row.administeredBy || row.givenBy || ''),
    administeredBy: String(row.administeredBy || row.administered_by || row.givenBy || ''),
    givenBy: String(row.givenBy || row.administeredBy || row.administered_by || ''),
    lot: String(row.lot || row.lotNumber || ''),
    lotNumber: String(row.lotNumber || row.lot || ''),
    site: String(row.site || row.administrationSite || ''),
    administrationSite: String(row.administrationSite || row.site || ''),
  } as T & Record<string, unknown>;

  return normalized;
};
