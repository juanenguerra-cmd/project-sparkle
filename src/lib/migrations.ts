import { nowISO } from './parsers';
import type { AppDatabase, Resident } from './types';

const genId = (prefix: string): string =>
  `${prefix}_${Math.random().toString(16).slice(2, 10)}_${Date.now().toString(36)}`;

export const migrateResidentIds = (db: AppDatabase): { db: AppDatabase; migrated: boolean } => {
  if (db.meta?.schemaVersion && db.meta.schemaVersion >= 2) {
    return { db, migrated: false };
  }

  const residentIdByMrn: Record<string, string> = { ...(db.meta?.residentIdByMrn || {}) };
  const residentsById: Record<string, Resident> = { ...(db.census.residentsById || {}) };

  Object.entries(db.census.residentsByMrn).forEach(([mrn, resident]) => {
    const residentId = resident.residentId || resident.id || residentIdByMrn[mrn] || genId('resident');
    residentIdByMrn[mrn] = residentId;
    residentsById[residentId] = {
      ...resident,
      id: residentId,
      residentId,
      mrn,
    };
  });

  const withResident = <T extends { mrn: string; residentId?: string }>(entries: T[]): T[] =>
    entries.map((entry) => ({ ...entry, residentId: entry.residentId || residentIdByMrn[entry.mrn] }));

  const migratedDb: AppDatabase = {
    ...db,
    census: {
      ...db.census,
      residentsById,
    },
    records: {
      ...db.records,
      abx: withResident(db.records.abx),
      ip_cases: withResident(db.records.ip_cases),
      vax: withResident(db.records.vax),
      notes: withResident(db.records.notes),
      line_listings: withResident(db.records.line_listings),
    },
    meta: {
      ...(db.meta || {}),
      schemaVersion: 2,
      residentIdByMrn,
    },
  };

  migratedDb.audit_log = [
    {
      id: genId('audit'),
      action: 'migration_resident_ids',
      details: `Migrated ${Object.keys(residentIdByMrn).length} residents from MRN-keyed schema to residentId backbone.`,
      entityType: 'settings',
      timestamp: nowISO(),
      source: 'migration',
    },
    ...migratedDb.audit_log,
  ];

  return { db: migratedDb, migrated: true };
};


export const migrateWorkflowMetrics = (db: AppDatabase): { db: AppDatabase; migrated: boolean } => {
  const hasMetrics = Array.isArray((db as AppDatabase & { workflow_metrics?: unknown[] }).workflow_metrics);
  if (hasMetrics) {
    return { db, migrated: false };
  }

  const migratedDb = {
    ...db,
    workflow_metrics: [],
    meta: {
      ...(db.meta || {}),
      schemaVersion: Math.max(db.meta?.schemaVersion || 0, 3),
    },
  } as AppDatabase;

  migratedDb.audit_log = [
    {
      id: genId('audit'),
      action: 'migration_workflow_metrics',
      details: 'Initialized workflow metrics telemetry store.',
      entityType: 'settings',
      timestamp: nowISO(),
      source: 'migration',
    },
    ...migratedDb.audit_log,
  ];

  return { db: migratedDb, migrated: true };
};
