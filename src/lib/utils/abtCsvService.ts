import { format } from 'date-fns';
import { addAudit, loadDB, saveDB } from '@/lib/database';
import { isoDateFromAny } from '@/lib/parsers';
import { convertToCSV, downloadCSV, parseCSV } from '@/lib/utils/csvUtils';

const ABT_COLUMNS = [
  'id', 'residentName', 'mrn', 'unit', 'room', 'medication', 'indication', 'startDate', 'endDate',
  'prescriber', 'route', 'frequency', 'dose', 'timeoutReviewDate', 'timeoutOutcome', 'notes',
  'createdAt', 'updated_at',
];

const REQUIRED_COLUMNS = ['residentName', 'medication', 'startDate'];

export const exportABTToCSV = (): void => {
  const records = loadDB().records.abx as Array<Record<string, unknown>>;
  if (records.length === 0) {
    window.alert('No ABT records to export.');
    return;
  }

  const csv = convertToCSV(records, ABT_COLUMNS);
  downloadCSV(csv, `abt-tracker-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.csv`);
};

export const importABTFromCSV = async (file: File | null): Promise<{ newCount: number; updateCount: number }> => {
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
  const existing = db.records.abx;
  const existingIds = new Set(existing.map((record) => record.id));
  const newCount = rows.filter((record) => !record.id || !existingIds.has(record.id)).length;
  const updateCount = rows.length - newCount;

  const confirmed = window.confirm(
    `Import ${rows.length} ABT records?\n\n${newCount} new records\n${updateCount} updates\n\nThis will overwrite matching IDs. Continue?`,
  );
  if (!confirmed) {
    return { newCount: 0, updateCount: 0 };
  }

  const result = upsertABTRecords(rows);
  return result;
};

const upsertABTRecords = (rows: Array<Record<string, string>>): { newCount: number; updateCount: number } => {
  const db = loadDB();
  const existing = db.records.abx;
  const now = new Date().toISOString();

  let newCount = 0;
  let updateCount = 0;

  rows.forEach((row) => {
    const normalized = normalizeABTRecord(row);
    const idx = normalized.id ? existing.findIndex((record) => record.id === normalized.id) : -1;

    if (idx >= 0) {
      existing[idx] = { ...existing[idx], ...normalized, updated_at: now };
      updateCount += 1;
      return;
    }

    existing.unshift({ ...normalized, id: normalized.id || generateId(), createdAt: now, updated_at: now });
    newCount += 1;
  });

  addAudit(db, 'abx_import_csv', `Imported ABT CSV (${newCount} new, ${updateCount} updated)`, 'abt');
  saveDB(db);
  return { newCount, updateCount };
};

const normalizeABTRecord = (row: Record<string, string>): Record<string, unknown> => ({
  ...row,
  id: row.id || '',
  residentName: row.residentName || row.name || '',
  medication: row.medication || row.med_name || '',
  startDate: toISODate(row.startDate || row.start_date),
  endDate: toISODate(row.endDate || row.end_date),
  timeoutReviewDate: toISODate(row.timeoutReviewDate),
});

const toISODate = (value?: string): string => {
  if (!value) {
    return '';
  }
  return isoDateFromAny(value) || '';
};

const generateId = (): string => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
