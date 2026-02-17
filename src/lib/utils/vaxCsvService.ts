import { format } from 'date-fns';
import { addAudit, loadDB, saveDB } from '@/lib/database';
import { isoDateFromAny } from '@/lib/parsers';
import { convertToCSV, downloadCSV, parseCSV } from '@/lib/utils/csvUtils';

const VAX_COLUMNS = [
  'id', 'residentName', 'mrn', 'unit', 'room', 'vaccine', 'status', 'dateGiven', 'dateOffered', 'dateDeclined',
  'lot', 'site', 'administeredBy', 'declineReason', 'educationProvided', 'outbreakTriggered', 'notes',
  'createdAt', 'updatedAt',
];

const REQUIRED_COLUMNS = ['residentName', 'vaccine', 'status'];

export const exportVaxToCSV = (): void => {
  const records = loadDB().records.vax as Array<Record<string, unknown>>;
  if (records.length === 0) {
    window.alert('No vaccination records to export.');
    return;
  }

  const csv = convertToCSV(records, VAX_COLUMNS);
  downloadCSV(csv, `vaccination-tracker-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.csv`);
};

export const importVaxFromCSV = async (file: File | null): Promise<{ newCount: number; updateCount: number }> => {
  if (!file) {
    return { newCount: 0, updateCount: 0 };
  }

  const rows = parseCSV(await file.text());
  if (rows.length === 0) throw new Error('CSV file is empty.');

  const missingColumns = REQUIRED_COLUMNS.filter((column) => !(column in rows[0]));
  if (missingColumns.length > 0) throw new Error(`Missing required columns: ${missingColumns.join(', ')}`);

  const db = loadDB();
  const existingIds = new Set(db.records.vax.map((record) => record.id));
  const newCount = rows.filter((record) => !record.id || !existingIds.has(record.id)).length;
  const updateCount = rows.length - newCount;

  const confirmed = window.confirm(
    `Import ${rows.length} vaccination records?\n\n${newCount} new records\n${updateCount} updates\n\nThis will overwrite matching IDs. Continue?`,
  );
  if (!confirmed) {
    return { newCount: 0, updateCount: 0 };
  }

  return upsertVaxRecords(rows);
};

const upsertVaxRecords = (rows: Array<Record<string, string>>): { newCount: number; updateCount: number } => {
  const db = loadDB();
  const existing = db.records.vax;
  const now = new Date().toISOString();

  let newCount = 0;
  let updateCount = 0;

  rows.forEach((row) => {
    const normalized = normalizeVaxRecord(row);
    const idx = normalized.id ? existing.findIndex((record) => record.id === normalized.id) : -1;

    if (idx >= 0) {
      existing[idx] = { ...existing[idx], ...normalized, updatedAt: now };
      updateCount += 1;
      return;
    }

    existing.unshift({ ...normalized, id: normalized.id || generateId(), createdAt: now, updatedAt: now });
    newCount += 1;
  });

  addAudit(db, 'vax_import_csv', `Imported VAX CSV (${newCount} new, ${updateCount} updated)`, 'vax');
  saveDB(db);
  return { newCount, updateCount };
};

const normalizeVaxRecord = (row: Record<string, string>): Record<string, unknown> => ({
  ...row,
  id: row.id || '',
  residentName: row.residentName || row.name || '',
  vaccine: row.vaccine || row.vaccine_type || '',
  status: row.status || 'due',
  dateGiven: toISODate(row.dateGiven || row.date_given),
  dateOffered: toISODate(row.dateOffered || row.offerDate),
  dateDeclined: toISODate(row.dateDeclined),
});

const toISODate = (value?: string): string => {
  if (!value) {
    return '';
  }
  return isoDateFromAny(value) || '';
};

const generateId = (): string => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
