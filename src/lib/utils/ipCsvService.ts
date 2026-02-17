import { format } from 'date-fns';
import { addAudit, loadDB, saveDB } from '@/lib/database';
import { isoDateFromAny } from '@/lib/parsers';
import { collectColumns, convertToCSV, downloadCSV, parseCSV } from '@/lib/utils/csvUtils';
import { getMissingColumnGroups, IP_REQUIRED_COLUMN_GROUPS, IP_TRACKER_COLUMNS } from '@/lib/utils/trackerFieldMaps';
const ARRAY_FIELDS = ['highContactCare', 'commonAreasVisited', 'sharedEquipment'];

export const exportIPToCSV = (): void => {
  const records = loadDB().records.ip_cases as Array<Record<string, unknown>>;
  if (records.length === 0) {
    window.alert('No IP records to export.');
    return;
  }

  const columns = collectColumns(records, [...IP_TRACKER_COLUMNS]);
  const csv = convertToCSV(records, columns);
  downloadCSV(csv, `ip-tracker-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.csv`);
};

export const importIPFromCSV = async (file: File | null): Promise<{ newCount: number; updateCount: number }> => {
  if (!file) {
    return { newCount: 0, updateCount: 0 };
  }

  const rows = parseCSV(await file.text());
  if (rows.length === 0) {
    throw new Error('CSV file is empty.');
  }

  const missingColumns = getMissingColumnGroups(rows[0], IP_REQUIRED_COLUMN_GROUPS);
  if (missingColumns.length > 0) {
    throw new Error(`Missing required columns: ${missingColumns.join(', ')}`);
  }

  const db = loadDB();
  const existing = db.records.ip_cases as Array<Record<string, unknown>>;
  const preview = summarizeIPChanges(rows, existing);

  const confirmed = window.confirm(
    `Import ${rows.length} IP records?\n\n${preview.newCount} new records\n${preview.updateCount} updates\n\nMatching records are updated (not duplicated). Continue?`,
  );
  if (!confirmed) {
    return { newCount: 0, updateCount: 0 };
  }

  return upsertIPRecords(rows);
};

const summarizeIPChanges = (
  rows: Array<Record<string, string>>,
  existing: Array<Record<string, unknown>>,
): { newCount: number; updateCount: number } => {
  let newCount = 0;
  let updateCount = 0;

  rows.forEach((row) => {
    const normalized = normalizeIPRecord(row);
    const idx = findIPMatchIndex(existing, normalized);
    if (idx >= 0) {
      updateCount += 1;
    } else {
      newCount += 1;
    }
  });

  return { newCount, updateCount };
};

const upsertIPRecords = (rows: Array<Record<string, string>>): { newCount: number; updateCount: number } => {
  const db = loadDB();
  const existing = db.records.ip_cases as Array<Record<string, unknown>>;
  const now = new Date().toISOString();

  let newCount = 0;
  let updateCount = 0;

  rows.forEach((row) => {
    const normalized = normalizeIPRecord(row);
    const idx = findIPMatchIndex(existing, normalized);

    if (idx >= 0) {
      const current = existing[idx];
      existing[idx] = { ...current, ...normalized, id: String(current.id || normalized.id || generateId()), updatedAt: now };
      updateCount += 1;
      return;
    }

    existing.unshift({ ...normalized, id: String(normalized.id || generateId()), createdAt: now, updatedAt: now });
    newCount += 1;
  });

  addAudit(db, 'ip_import_csv', `Imported IP CSV (${newCount} new, ${updateCount} updated)`, 'ip');
  saveDB(db);
  return { newCount, updateCount };
};

const findIPMatchIndex = (existing: Array<Record<string, unknown>>, candidate: Record<string, unknown>): number => {
  const candidateId = String(candidate.id || '').trim();
  if (candidateId) {
    const byId = existing.findIndex((record) => String(record.id || '') === candidateId);
    if (byId >= 0) {
      return byId;
    }
  }

  const signature = buildIPSignature(candidate);
  if (!signature) {
    return -1;
  }

  return existing.findIndex((record) => buildIPSignature(record) === signature);
};

const buildIPSignature = (record: Record<string, unknown>): string => {
  const mrn = String(record.mrn || '').trim().toLowerCase();
  const infectionType = String(record.infectionType || record.infection_type || '').trim().toLowerCase();
  const onsetDate = toISODate(String(record.onsetDate || record.onset_date || ''));

  if (!mrn || !infectionType || !onsetDate) {
    return '';
  }

  return `${mrn}|${infectionType}|${onsetDate}`;
};

const normalizeIPRecord = (row: Record<string, string>): Record<string, unknown> => {
  const normalized: Record<string, unknown> = {
    ...row,
    id: row.id || '',
    record_id: row.record_id || row.id || '',
    residentName: row.residentName || row.name || '',
    infectionType: row.infectionType || row.infection_type || '',
    sourceOfInfection: row.sourceOfInfection || row.source_of_infection || '',
    onsetDate: toISODate(row.onsetDate || row.onset_date),
    resolutionDate: toISODate(row.resolutionDate || row.resolution_date),
    precautionStartDate: toISODate(row.precautionStartDate),
  };

  ARRAY_FIELDS.forEach((field) => {
    const value = row[field];
    if (value && typeof value === 'string') {
      normalized[field] = value.split(';').map((item) => item.trim()).filter(Boolean);
    }
  });

  return normalized;
};

const toISODate = (value?: string): string => {
  if (!value) {
    return '';
  }
  return isoDateFromAny(value) || value;
};

const generateId = (): string => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
