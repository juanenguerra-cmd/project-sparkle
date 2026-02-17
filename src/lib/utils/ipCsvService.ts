import { format } from 'date-fns';
import { addAudit, loadDB, saveDB } from '@/lib/database';
import { isoDateFromAny } from '@/lib/parsers';
import { convertToCSV, downloadCSV, parseCSV } from '@/lib/utils/csvUtils';

const IP_COLUMNS = [
  'id', 'residentName', 'mrn', 'unit', 'room', 'infectionType', 'sourceOfInfection', 'pathogen', 'organism',
  'onsetDate', 'precautionStartDate', 'resolutionDate', 'protocol', 'isolationType', 'requiredPPE',
  'collectionDateTime', 'cultureResult', 'notes', 'createdAt', 'updatedAt',
];

const REQUIRED_COLUMNS = ['residentName', 'infectionType', 'onsetDate'];

export const exportIPToCSV = (): void => {
  const records = loadDB().records.ip_cases as Array<Record<string, unknown>>;
  if (records.length === 0) {
    window.alert('No IP records to export.');
    return;
  }

  const csv = convertToCSV(records, IP_COLUMNS);
  downloadCSV(csv, `ip-tracker-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.csv`);
};

export const importIPFromCSV = async (file: File | null): Promise<{ newCount: number; updateCount: number }> => {
  if (!file) {
    return { newCount: 0, updateCount: 0 };
  }

  const rows = parseCSV(await file.text());
  if (rows.length === 0) throw new Error('CSV file is empty.');

  const missingColumns = REQUIRED_COLUMNS.filter((column) => !(column in rows[0]));
  if (missingColumns.length > 0) throw new Error(`Missing required columns: ${missingColumns.join(', ')}`);

  const db = loadDB();
  const existingIds = new Set(db.records.ip_cases.map((record) => record.id));
  const newCount = rows.filter((record) => !record.id || !existingIds.has(record.id)).length;
  const updateCount = rows.length - newCount;

  const confirmed = window.confirm(
    `Import ${rows.length} IP records?\n\n${newCount} new records\n${updateCount} updates\n\nThis will overwrite matching IDs. Continue?`,
  );
  if (!confirmed) {
    return { newCount: 0, updateCount: 0 };
  }

  return upsertIPRecords(rows);
};

const upsertIPRecords = (rows: Array<Record<string, string>>): { newCount: number; updateCount: number } => {
  const db = loadDB();
  const existing = db.records.ip_cases;
  const now = new Date().toISOString();

  let newCount = 0;
  let updateCount = 0;

  rows.forEach((row) => {
    const normalized = normalizeIPRecord(row);
    const idx = normalized.id ? existing.findIndex((record) => record.id === normalized.id) : -1;

    if (idx >= 0) {
      existing[idx] = { ...existing[idx], ...normalized, updatedAt: now };
      updateCount += 1;
      return;
    }

    existing.unshift({ ...normalized, id: normalized.id || generateId(), createdAt: now, updatedAt: now });
    newCount += 1;
  });

  addAudit(db, 'ip_import_csv', `Imported IP CSV (${newCount} new, ${updateCount} updated)`, 'ip');
  saveDB(db);
  return { newCount, updateCount };
};

const normalizeIPRecord = (row: Record<string, string>): Record<string, unknown> => ({
  ...row,
  id: row.id || '',
  residentName: row.residentName || row.name || '',
  infectionType: row.infectionType || row.infection_type || '',
  sourceOfInfection: row.sourceOfInfection || row.source_condition || row.sourceCondition || '',
  onsetDate: toISODate(row.onsetDate || row.onset_date),
  resolutionDate: toISODate(row.resolutionDate || row.resolution_date),
  precautionStartDate: toISODate(row.precautionStartDate),
});

const toISODate = (value?: string): string => {
  if (!value) {
    return '';
  }
  return isoDateFromAny(value) || '';
};

const generateId = (): string => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
