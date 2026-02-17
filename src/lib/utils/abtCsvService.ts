import { format } from 'date-fns';
import { addAudit, loadDB, saveDB } from '@/lib/database';
import { isoDateFromAny } from '@/lib/parsers';
import { collectColumns, convertToCSV, downloadCSV, parseCSV } from '@/lib/utils/csvUtils';
import { ABT_REQUIRED_COLUMN_GROUPS, ABT_TRACKER_COLUMNS, getMissingColumnGroups } from '@/lib/utils/trackerFieldMaps';

export const exportABTToCSV = (): void => {
  const records = loadDB().records.abx as Array<Record<string, unknown>>;
  if (records.length === 0) {
    window.alert('No ABT records to export.');
    return;
  }

  const columns = collectColumns(records, [...ABT_TRACKER_COLUMNS]);
  const csv = convertToCSV(records, columns);
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

  const missingColumns = getMissingColumnGroups(rows[0], ABT_REQUIRED_COLUMN_GROUPS);
  if (missingColumns.length > 0) {
    throw new Error(`Missing required columns: ${missingColumns.join(', ')}`);
  }

  const db = loadDB();
  const existing = db.records.abx;
  const preview = summarizeABTChanges(rows, existing as Array<Record<string, unknown>>);

  const confirmed = window.confirm(
    `Import ${rows.length} ABT records?\n\n${preview.newCount} new records\n${preview.updateCount} updates\n\nMatching records are updated (not duplicated). Continue?`,
  );
  if (!confirmed) {
    return { newCount: 0, updateCount: 0 };
  }

  return upsertABTRecords(rows);
};

const summarizeABTChanges = (
  rows: Array<Record<string, string>>,
  existing: Array<Record<string, unknown>>,
): { newCount: number; updateCount: number } => {
  let newCount = 0;
  let updateCount = 0;

  rows.forEach((row) => {
    const normalized = normalizeABTRecord(row);
    const idx = findABTMatchIndex(existing, normalized);
    if (idx >= 0) {
      updateCount += 1;
    } else {
      newCount += 1;
    }
  });

  return { newCount, updateCount };
};

const upsertABTRecords = (rows: Array<Record<string, string>>): { newCount: number; updateCount: number } => {
  const db = loadDB();
  const existing = db.records.abx as Array<Record<string, unknown>>;
  const now = new Date().toISOString();

  let newCount = 0;
  let updateCount = 0;

  rows.forEach((row) => {
    const normalized = normalizeABTRecord(row);
    const idx = findABTMatchIndex(existing, normalized);

    if (idx >= 0) {
      const current = existing[idx];
      existing[idx] = { ...current, ...normalized, id: String(current.id || normalized.id || generateId()), updated_at: now };
      updateCount += 1;
      return;
    }

    existing.unshift({ ...normalized, id: String(normalized.id || generateId()), createdAt: now, updated_at: now });
    newCount += 1;
  });

  addAudit(db, 'abx_import_csv', `Imported ABT CSV (${newCount} new, ${updateCount} updated)`, 'abt');
  saveDB(db);
  return { newCount, updateCount };
};

const findABTMatchIndex = (existing: Array<Record<string, unknown>>, candidate: Record<string, unknown>): number => {
  const candidateId = String(candidate.id || '').trim();
  if (candidateId) {
    const byId = existing.findIndex((record) => String(record.id || '') === candidateId);
    if (byId >= 0) {
      return byId;
    }
  }

  const signature = buildABTSignature(candidate);
  if (!signature) {
    return -1;
  }

  return existing.findIndex((record) => buildABTSignature(record) === signature);
};

const buildABTSignature = (record: Record<string, unknown>): string => {
  const mrn = String(record.mrn || '').trim().toLowerCase();
  const medication = String(record.medication || record.med_name || '').trim().toLowerCase();
  const startDate = toISODate(String(record.startDate || record.start_date || ''));

  if (!mrn || !medication || !startDate) {
    return '';
  }

  return `${mrn}|${medication}|${startDate}`;
};

const normalizeABTRecord = (row: Record<string, string>): Record<string, unknown> => ({
  ...row,
  id: row.id || '',
  record_id: row.record_id || row.id || '',
  residentName: row.residentName || row.name || '',
  medication: row.medication || row.med_name || '',
  route_raw: row.route_raw || row.route || '',
  startDate: toISODate(row.startDate || row.start_date),
  endDate: toISODate(row.endDate || row.end_date),
  timeoutReviewDate: toISODate(row.timeoutReviewDate),
});

const toISODate = (value?: string): string => {
  if (!value) {
    return '';
  }
  return isoDateFromAny(value) || value;
};

const generateId = (): string => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
