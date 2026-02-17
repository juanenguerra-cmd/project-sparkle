import { format } from 'date-fns';
import { addAudit, loadDB, saveDB } from '@/lib/database';
import { isoDateFromAny } from '@/lib/parsers';
import { collectColumns, convertToCSV, downloadCSV, parseCSV } from '@/lib/utils/csvUtils';

const VAX_PREFERRED_COLUMNS = [
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
  'source', 'notes', 'createdAt', 'updatedAt',
];

const REQUIRED_COLUMNS = ['residentName', 'vaccine', 'status'];

export const exportVaxToCSV = (): void => {
  const records = loadDB().records.vax as Array<Record<string, unknown>>;
  if (records.length === 0) {
    window.alert('No vaccination records to export.');
    return;
  }

  const columns = collectColumns(records, VAX_PREFERRED_COLUMNS);
  const csv = convertToCSV(records, columns);
  downloadCSV(csv, `vaccination-tracker-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.csv`);
};

export const importVaxFromCSV = async (file: File | null): Promise<{ newCount: number; updateCount: number }> => {
  if (!file) {
    return { newCount: 0, updateCount: 0 };
  }

  const rows = parseCSV(await file.text());
  if (rows.length === 0) {
    throw new Error('CSV file is empty.');
  }

  const missingColumns = REQUIRED_COLUMNS.filter((column) => !(column in rows[0]));
  if (missingColumns.length > 0) {
    throw new Error(`Missing required columns: ${missingColumns.join(', ')}`);
  }

  const db = loadDB();
  const existing = db.records.vax as Array<Record<string, unknown>>;
  const preview = summarizeVaxChanges(rows, existing);

  const confirmed = window.confirm(
    `Import ${rows.length} vaccination records?\n\n${preview.newCount} new records\n${preview.updateCount} updates\n\nMatching records are updated (not duplicated). Continue?`,
  );
  if (!confirmed) {
    return { newCount: 0, updateCount: 0 };
  }

  return upsertVaxRecords(rows);
};

const summarizeVaxChanges = (
  rows: Array<Record<string, string>>,
  existing: Array<Record<string, unknown>>,
): { newCount: number; updateCount: number } => {
  let newCount = 0;
  let updateCount = 0;

  rows.forEach((row) => {
    const normalized = normalizeVaxRecord(row);
    const idx = findVaxMatchIndex(existing, normalized);
    if (idx >= 0) {
      updateCount += 1;
    } else {
      newCount += 1;
    }
  });

  return { newCount, updateCount };
};

const upsertVaxRecords = (rows: Array<Record<string, string>>): { newCount: number; updateCount: number } => {
  const db = loadDB();
  const existing = db.records.vax as Array<Record<string, unknown>>;
  const now = new Date().toISOString();

  let newCount = 0;
  let updateCount = 0;

  rows.forEach((row) => {
    const normalized = normalizeVaxRecord(row);
    const idx = findVaxMatchIndex(existing, normalized);

    if (idx >= 0) {
      const current = existing[idx];
      existing[idx] = { ...current, ...normalized, id: String(current.id || normalized.id || generateId()), updatedAt: now };
      updateCount += 1;
      return;
    }

    existing.unshift({ ...normalized, id: String(normalized.id || generateId()), createdAt: now, updatedAt: now });
    newCount += 1;
  });

  addAudit(db, 'vax_import_csv', `Imported VAX CSV (${newCount} new, ${updateCount} updated)`, 'vax');
  saveDB(db);
  return { newCount, updateCount };
};

const findVaxMatchIndex = (existing: Array<Record<string, unknown>>, candidate: Record<string, unknown>): number => {
  const candidateId = String(candidate.id || '').trim();
  if (candidateId) {
    const byId = existing.findIndex((record) => String(record.id || '') === candidateId);
    if (byId >= 0) {
      return byId;
    }
  }

  const signature = buildVaxSignature(candidate);
  if (!signature) {
    return -1;
  }

  return existing.findIndex((record) => buildVaxSignature(record) === signature);
};

const buildVaxSignature = (record: Record<string, unknown>): string => {
  const mrn = String(record.mrn || '').trim().toLowerCase();
  const vaccine = String(record.vaccine || record.vaccine_type || '').trim().toLowerCase();
  const anchorDate = toISODate(
    String(record.dateGiven || record.date_given || record.dueDate || record.due_date || record.offerDate || ''),
  );

  if (!mrn || !vaccine || !anchorDate) {
    return '';
  }

  return `${mrn}|${vaccine}|${anchorDate}`;
};

const normalizeVaxRecord = (row: Record<string, string>): Record<string, unknown> => ({
  ...row,
  id: row.id || '',
  residentName: row.residentName || row.name || '',
  vaccine: row.vaccine || row.vaccine_type || '',
  status: row.status || 'due',
  dateGiven: toISODate(row.dateGiven || row.date_given),
  dueDate: toISODate(row.dueDate || row.due_date),
  dateOffered: toISODate(row.dateOffered || row.offerDate),
  dateDeclined: toISODate(row.dateDeclined),
});

const toISODate = (value?: string): string => {
  if (!value) {
    return '';
  }
  return isoDateFromAny(value) || value;
};

const generateId = (): string => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
