// src/lib/ipCaseFields.ts
import { IP_REQUIRED_COLUMN_GROUPS, IP_TRACKER_COLUMNS } from '@/lib/utils/trackerFieldMaps';

type Row = Record<string, unknown>;

export const IP_CENTRALIZED_COLUMNS = IP_TRACKER_COLUMNS;

const firstNonEmpty = (row: Row, keys: readonly string[]): string => {
  for (const k of keys) {
    const v = row[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
    if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  }
  return '';
};

/**
 * Row-level required data check (not just header presence).
 * Matches the same semantic groups used by IP_REQUIRED_COLUMN_GROUPS.
 */
export const hasRequiredIPFields = (row: Record<string, unknown>): boolean => {
  const residentName = firstNonEmpty(row, IP_REQUIRED_COLUMN_GROUPS[0]);
  const infectionType = firstNonEmpty(row, IP_REQUIRED_COLUMN_GROUPS[1]);
  const onsetDate = firstNonEmpty(row, IP_REQUIRED_COLUMN_GROUPS[2]);
  return Boolean(residentName && infectionType && onsetDate);
};

/**
 * Canonicalizes an incoming CSV row into the app's normalized shape.
 * Keeps all original fields (so you don't lose unexpected columns),
 * but also writes canonical keys used by the app/reports.
 */
export const canonicalizeIPRow = (
  row: Record<string, string>,
  toISODate: (v?: string) => string,
): Record<string, unknown> => {
  const onsetRaw = (row.onsetDate || row.onset_date || '') as string;

  const id = row.id || row.record_id || '';
  const record_id = row.record_id || row.id || '';

  const residentName = row.residentName || row.name || '';
  const infectionType = row.infectionType || row.infection_type || '';
  const sourceOfInfection = row.sourceOfInfection || row.source_of_infection || '';

  const onsetDate = toISODate(row.onsetDate || row.onset_date);
  const resolutionDate = toISODate(row.resolutionDate || row.resolution_date);
  const precautionStartDate = toISODate(row.precautionStartDate);

  // Preserve everything from the CSV row, then overwrite/add canonical keys.
  return {
    ...row,

    // identity
    id,
    record_id,

    // resident context
    mrn: row.mrn || '',
    residentName,
    unit: row.unit || '',
    room: row.room || '',

    // case fields
    status: row.status || row.case_status || '',
    case_status: row.case_status || row.status || '',
    infectionType,
    infection_type: row.infection_type || infectionType,
    protocol: row.protocol || '',
    isolationType: row.isolationType || row.isolation_type || '',
    isolation_type: row.isolation_type || row.isolationType || '',
    sourceOfInfection,
    source_of_infection: row.source_of_infection || sourceOfInfection,
    pathogen: row.pathogen || row.organism || '',
    organism: row.organism || row.pathogen || '',

    // dates
    onsetDate: onsetDate || (toISODate(onsetRaw) || ''),
    onset_date: row.onset_date || row.onsetDate || '',
    resolutionDate,
    resolution_date: row.resolution_date || row.resolutionDate || '',
    precautionStartDate,

    // common review fields (best-effort)
    nextReviewDate: toISODate(row.nextReviewDate || row.next_review_date),
    next_review_date: row.next_review_date || row.nextReviewDate || '',
    lastReviewDate: toISODate(row.lastReviewDate || ''),
    reviewNotes: row.reviewNotes || '',
    triggerReason: row.triggerReason || '',

    // timestamps if present
    createdAt: row.createdAt || '',
    updatedAt: row.updatedAt || row.updated_at || '',
    updated_at: row.updated_at || row.updatedAt || '',
  };
};
