// Local Storage Database for ICN Hub
// Uses StorageAdapter pattern for easy migration to D1/Cloudflare
// 
// TO MIGRATE TO D1:
// 1. Update src/lib/storage/index.ts to export D1StorageAdapter
// 2. Deploy your Cloudflare Worker with the D1 API endpoints
// 3. That's it! No changes needed here.

import { 
  Resident, 
  ABTRecord, 
  IPCase, 
  VaxRecord, 
  Note, 
  ClinicalNote,
  AuditEntry,
  AppSettings,
  LineListingEntry,
  LineListingRecommendation,
  Outbreak,
  ContactEntry,
  SymptomCategory,
  SYMPTOM_OPTIONS
} from './types';
import { isoDateFromAny, nowISO, canonicalMRN, mrnMatchKeys, todayISO } from './parsers';
import { storage, defaultSettings, defaultDatabase } from './storage';
import { migrateResidentIds } from './migrations';
import { deriveAbtStatus } from './abtStatus';

export interface ICNDatabase {
  census: {
    residentsByMrn: Record<string, Resident>;
    residentsById?: Record<string, Resident>;
    meta: {
      imported_at: string | null;
    };
  };
  records: {
    abx: ABTRecord[];
    ip_cases: IPCase[];
    vax: VaxRecord[];
    notes: Array<Note | ClinicalNote>;
    line_listings: LineListingEntry[];
    outbreaks: Outbreak[];
    contacts: ContactEntry[];
    history?: import('./types').HistoryEvent[];
  };
  audit_log: AuditEntry[];
  settings: AppSettings & {
    last_import_at?: string;
    census_exclude_names?: string[];
    auto_close_on_census_drop?: boolean;
    auto_close_grace_days?: number;
  };
  cache?: Record<string, unknown>;
  meta?: {
    schemaVersion?: number;
    residentIdByMrn?: Record<string, string>;
  };
}

// Re-export for compatibility
export { defaultSettings };

// In-memory cache for synchronous access
// The storage adapter handles async persistence
let dbCache: ICNDatabase | null = null;

const createEmptyDB = (): ICNDatabase => defaultDatabase() as ICNDatabase;

const isD1Storage = (): boolean => storage.name === 'd1';

const pickId = (value: unknown): string => {
  if (!value || typeof value !== 'object') return '';
  const obj = value as Record<string, unknown>;
  const id = obj.id ?? obj.record_id;
  return typeof id === 'string' ? id : '';
};

const mergeEntityList = <T extends Record<string, unknown>>(
  remoteList: T[],
  localList: T[]
): T[] => {
  const merged = new Map<string, T>();

  remoteList.forEach((item) => {
    const id = pickId(item);
    if (!id) return;
    merged.set(id, item);
  });

  localList.forEach((item) => {
    const id = pickId(item);
    if (!id) return;
    merged.set(id, item);
  });

  return Array.from(merged.values());
};

const mergeDatabases = (remoteDb: ICNDatabase, localDb: ICNDatabase): ICNDatabase => {
  const mergedResidents = {
    ...remoteDb.census.residentsByMrn,
    ...localDb.census.residentsByMrn,
  };

  const remoteAudit = Array.isArray(remoteDb.audit_log) ? remoteDb.audit_log : [];
  const localAudit = Array.isArray(localDb.audit_log) ? localDb.audit_log : [];
  const mergedAudit = mergeEntityList(remoteAudit, localAudit)
    .sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''))
    .slice(0, 1000);

  return {
    ...remoteDb,
    ...localDb,
    census: {
      ...remoteDb.census,
      ...localDb.census,
      residentsByMrn: mergedResidents,
      meta: {
        ...remoteDb.census.meta,
        ...localDb.census.meta,
      },
    },
    records: {
      ...remoteDb.records,
      ...localDb.records,
      abx: mergeEntityList(remoteDb.records.abx, localDb.records.abx),
      ip_cases: mergeEntityList(remoteDb.records.ip_cases, localDb.records.ip_cases),
      vax: mergeEntityList(remoteDb.records.vax, localDb.records.vax),
      notes: mergeEntityList(remoteDb.records.notes, localDb.records.notes),
      line_listings: mergeEntityList(remoteDb.records.line_listings, localDb.records.line_listings),
      outbreaks: mergeEntityList(remoteDb.records.outbreaks, localDb.records.outbreaks),
      contacts: mergeEntityList(remoteDb.records.contacts, localDb.records.contacts),
    },
    audit_log: mergedAudit,
    settings: {
      ...remoteDb.settings,
      ...localDb.settings,
    },
  };
};

/**
 * Load database synchronously (uses cache, falls back to sync localStorage)
 * For async D1, call initDB() first at app startup
 */
export const loadDB = (): ICNDatabase => {
  if (dbCache) return dbCache;
  
  // Synchronous fallback for localStorage
  try {
    const raw = localStorage.getItem('icn_hub_db');
    if (!raw) {
      dbCache = createEmptyDB();
      return dbCache;
    }
    
    const parsed = JSON.parse(raw);
    dbCache = {
      census: {
        residentsByMrn: parsed.census?.residentsByMrn || {},
        residentsById: parsed.census?.residentsById || {},
        meta: parsed.census?.meta || { imported_at: null }
      },
      records: {
        abx: Array.isArray(parsed.records?.abx) ? parsed.records.abx : [],
        ip_cases: Array.isArray(parsed.records?.ip_cases) ? parsed.records.ip_cases : [],
        vax: Array.isArray(parsed.records?.vax) ? parsed.records.vax : [],
        notes: Array.isArray(parsed.records?.notes) ? parsed.records.notes : [],
        line_listings: Array.isArray(parsed.records?.line_listings) ? parsed.records.line_listings : [],
        outbreaks: Array.isArray(parsed.records?.outbreaks) ? parsed.records.outbreaks : [],
        contacts: Array.isArray(parsed.records?.contacts) ? parsed.records.contacts : [],
        history: Array.isArray(parsed.records?.history) ? parsed.records.history : []
      },
      audit_log: Array.isArray(parsed.audit_log) ? parsed.audit_log : [],
      settings: { ...defaultSettings, ...parsed.settings },
      meta: parsed.meta || { schemaVersion: 1, residentIdByMrn: {} }
    };
    const migrated = migrateResidentIds(dbCache as unknown as import('./types').AppDatabase);
    dbCache = migrated.db as unknown as ICNDatabase;
    if (migrated.migrated) {
      localStorage.setItem('icn_hub_db', JSON.stringify(dbCache));
    }
    return dbCache;
  } catch (e) {
    console.error('Failed to load DB:', e);
    dbCache = createEmptyDB();
    return dbCache;
  }
};

/**
 * Initialize database asynchronously (required for D1)
 * Call this at app startup
 */
export const initDB = async (): Promise<ICNDatabase> => {
  try {
    dbCache = await storage.load() as ICNDatabase;
    const migrated = migrateResidentIds(dbCache as unknown as import('./types').AppDatabase);
    dbCache = migrated.db as unknown as ICNDatabase;
    if (migrated.migrated) {
      await storage.save(dbCache);
    }
    return dbCache;
  } catch (e) {
    console.error('Failed to init DB:', e);
    dbCache = createEmptyDB();
    return dbCache;
  }
};

/**
 * Save database (updates cache and persists)
 */
export const saveDBAsync = async (
  db: ICNDatabase,
  opts: { optimistic?: boolean } = {}
): Promise<void> => {
  const optimistic = opts.optimistic ?? true;
  if (optimistic) dbCache = db;

  const persistPayload = isD1Storage()
    ? mergeDatabases((await storage.load()) as ICNDatabase, db)
    : db;

  await storage.save(persistPayload);
  dbCache = persistPayload;
};

export const saveDB = (db: ICNDatabase): void => {
  // Async save - fire and forget for now
  // When migrating to D1, consider adding error handling UI
  saveDBAsync(db, { optimistic: true }).catch(e => {
    console.error('Failed to save DB:', e);
  });
};

/**
 * Get current storage adapter name
 */
export const getStorageType = (): string => storage.name;

export const addAudit = (
  db: ICNDatabase, 
  action: string, 
  details: string, 
  entityType: AuditEntry['entityType'],
  options: { user?: string; entityId?: string; before?: Record<string, unknown>; after?: Record<string, unknown>; source?: AuditEntry['source'] } = {}
): void => {
  const entry: AuditEntry = {
    id: `audit_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    action,
    details,
    entityType,
    timestamp: nowISO(),
    user: options.user,
    entityId: options.entityId,
    before: options.before,
    after: options.after,
    source: options.source || 'ui'
  };
  db.audit_log.unshift(entry);
  
  // Keep only last 1000 entries
  if (db.audit_log.length > 1000) {
    db.audit_log = db.audit_log.slice(0, 1000);
  }
};

export const exportDBToJSON = (): string => {
  const db = loadDB();
  const exportData = {
    exported_at: nowISO(),
    version: '1.0',
    ...db
  };
  return JSON.stringify(exportData, null, 2);
};

const cloneDeep = <T,>(value: T): T => {
  // structuredClone is available in modern browsers; fallback for older ones
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sc = (globalThis as any).structuredClone as undefined | ((v: T) => T);
  if (typeof sc === 'function') return sc(value);
  return JSON.parse(JSON.stringify(value)) as T;
};

const formatImportError = (e: unknown): string => {
  // QuotaExceededError is the most common “import looks successful but nothing saved” failure.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyErr = e as any;
  const name = typeof anyErr?.name === 'string' ? anyErr.name : '';
  const message = typeof anyErr?.message === 'string' ? anyErr.message : '';
  if (name === 'QuotaExceededError') {
    return 'Browser storage is full (QuotaExceededError).';
  }
  return message || String(e);
};

export const importDBFromJSON = async (
  jsonStr: string
): Promise<{ success: boolean; message: string }> => {
  try {
    const data = JSON.parse(jsonStr);

    const residentsFromArray = (residents: any[] | undefined): Record<string, any> => {
      if (!Array.isArray(residents)) return {};
      return residents.reduce((acc, resident, index) => {
        const rawMrn = resident?.mrn ?? resident?.MRN ?? resident?.medicalRecordNumber;
        const canonical = canonicalMRN(String(rawMrn ?? ''));
        if (!canonical) return acc;
        acc[canonical] = {
          ...resident,
          mrn: canonical,
          id: resident?.id || `res_${canonical}`,
        };
        return acc;
      }, {} as Record<string, any>);
    };

    const legacyResidentArray = data.census?.residents || data.residents;
    const legacyResidentsByMrn = residentsFromArray(legacyResidentArray);

    // Basic validation - support multiple backup schemas
    // Accept: census, records, residentsByMrn (direct), or any known record arrays
    const hasCensus =
      data.census?.residentsByMrn ||
      data.residentsByMrn ||
      (Array.isArray(legacyResidentArray) && legacyResidentArray.length > 0);
    const hasRecords =
      data.records ||
      data.abx ||
      data.ip_cases ||
      data.vax ||
      data.notes ||
      data.abt_worklist ||
      data.vax_due ||
      data.line_listings ||
      data.outbreaks ||
      data.contacts;
    
    if (!hasCensus && !hasRecords) {
      return { success: false, message: 'Invalid backup file: missing census or records data' };
    }
    
    // Normalize structure if data is in flat format
    const normalizedData = {
      census:
        data.census ||
        (data.residentsByMrn
          ? { residentsByMrn: data.residentsByMrn, meta: data.meta }
          : legacyResidentsByMrn && Object.keys(legacyResidentsByMrn).length > 0
            ? { residentsByMrn: legacyResidentsByMrn }
            : undefined),
      records: data.records || {
        abx: data.abx || data.abt_worklist || [],
        ip_cases: data.ip_cases || [],
        vax: data.vax || data.vax_due || [],
        notes: data.notes || [],
        line_listings: data.line_listings || [],
        outbreaks: data.outbreaks || [],
        contacts: data.contacts || []
      },
      settings: data.settings,
      audit_log: data.audit_log
    };
    
    const baseDb = loadDB();
    const before = {
      census: Object.keys(baseDb.census.residentsByMrn).length,
      abx: baseDb.records.abx.length,
      ip: baseDb.records.ip_cases.length,
      vax: baseDb.records.vax.length,
      notes: baseDb.records.notes.length,
      lineListings: baseDb.records.line_listings.length,
      outbreaks: baseDb.records.outbreaks.length,
      contacts: baseDb.records.contacts.length,
    };

    // Work on a clone so a failed persist doesn’t mutate the in-memory DB.
    const db = cloneDeep(baseDb);
    const now = nowISO();
    
    // Merge census - handle UNIFIED_DB_V1 schema format
    if (normalizedData.census?.residentsByMrn) {
      Object.entries(normalizedData.census.residentsByMrn).forEach(([mrn, resident]: [string, any]) => {
        const canonical = canonicalMRN(mrn);
        db.census.residentsByMrn[canonical] = {
          id: resident.id || `res_${canonical}`,
          mrn: canonical,
          name: resident.name || '',
          unit: resident.unit || '',
          room: resident.room || '',
          dob: resident.dob || '',
          dob_raw: resident.dob || '',
          status: resident.status || '',
          active_on_census: resident.active_on_census !== false,
          last_seen_census_at: now
        };
      });
    }
    if (normalizedData.census?.meta) {
      db.census.meta = {
        imported_at: normalizedData.census.meta.updatedAt 
          ? new Date(normalizedData.census.meta.updatedAt).toISOString() 
          : normalizedData.census.meta.imported_at
      };
    }
    
    // Merge ABX records
    const abxSource = normalizedData.records?.abx || [];
    if (Array.isArray(abxSource)) {
      const existingIds = new Set(db.records.abx.map(r => r.record_id || r.id));
      abxSource.forEach((r: any) => {
        const id = r.id || r.record_id || `abx_${r.mrn}_${r.antibiotic || r.medication}_${r.startDate || r.start_date}`;
        if (existingIds.has(id)) return;
        
        const endDate = r.endDate || r.end_date || r.end || '';
        const rawStatus = String(r.status || '').toLowerCase();
        const importedStatus = rawStatus.includes('discont')
          ? 'discontinued'
          : (r.isActive || rawStatus === 'active' ? 'active' : 'completed');

        db.records.abx.push({
          id,
          record_id: id,
          mrn: canonicalMRN(r.mrn || ''),
          name: r.name || r.patientName || '',
          residentName: r.name || r.patientName || '',
          unit: r.unit || '',
          room: r.room || '',
          med_name: r.antibiotic || r.medication || r.drug || r.med_name || '',
          medication: r.antibiotic || r.medication || r.drug || r.med_name || '',
          dose: r.dose || '',
          route: r.route || '',
          indication: r.indication || '',
          infection_source: r.infectionSource || r.infection_source || 'Other',
          start_date: r.startDate || r.start_date || r.start || '',
          startDate: r.startDate || r.start_date || r.start || '',
          end_date: endDate,
          endDate,
          status: deriveAbtStatus(importedStatus, endDate),
          createdAt: now,
          source: 'json_import'
        });
        existingIds.add(id);
      });
    }
    
    // Merge IP cases
    const ipSource = normalizedData.records?.ip_cases || [];
    if (Array.isArray(ipSource)) {
      const existingIds = new Set(db.records.ip_cases.map(r => r.id));
      ipSource.forEach((r: any) => {
        if (!existingIds.has(r.id)) {
          db.records.ip_cases.push(r);
        }
      });
    }
    
    // Merge VAX records
    const vaxSource = normalizedData.records?.vax || [];
    if (Array.isArray(vaxSource)) {
      const existingIds = new Set(db.records.vax.map(r => r.record_id || r.id));
      vaxSource.forEach((r: any) => {
        const id = r.id || r.record_id || `vax_${r.mrn}_${r.vaccine || r.vaccineType}`;
        if (existingIds.has(id)) return;
        
        db.records.vax.push({
          id,
          record_id: id,
          mrn: canonicalMRN(r.mrn || ''),
          name: r.name || r.patientName || r.residentName || '',
          residentName: r.name || r.patientName || r.residentName || '',
          unit: r.unit || '',
          room: r.room || '',
          vaccine: r.vaccine || r.vaccineType || '',
          vaccine_type: r.vaccine || r.vaccineType || '',
          status: r.status || 'due',
          dateGiven: r.dateGiven || r.date_given || r.date || '',
          dueDate: r.dueDate || r.due_date || '',
          createdAt: now
        });
        existingIds.add(id);
      });
    }
    
    // Merge notes
    if (Array.isArray(normalizedData.records?.notes)) {
      const existingIds = new Set(db.records.notes.map(r => r.id));
      normalizedData.records.notes.forEach((r: Note) => {
        if (!existingIds.has(r.id)) {
          db.records.notes.push(r);
        }
      });
    }
    
    // Merge line listings
    if (Array.isArray(normalizedData.records?.line_listings)) {
      const existingIds = new Set(db.records.line_listings.map(r => r.id));
      normalizedData.records.line_listings.forEach((r: any) => {
        if (!existingIds.has(r.id)) {
          db.records.line_listings.push(r);
        }
      });
    }
    
    // Merge outbreaks
    if (Array.isArray(normalizedData.records?.outbreaks)) {
      const existingIds = new Set(db.records.outbreaks.map(r => r.id));
      normalizedData.records.outbreaks.forEach((r: any) => {
        if (!existingIds.has(r.id)) {
          db.records.outbreaks.push(r);
        }
      });
    }
    
    // Merge contacts
    if (Array.isArray(normalizedData.records?.contacts)) {
      const existingIds = new Set(db.records.contacts.map(r => r.id));
      normalizedData.records.contacts.forEach((r: any) => {
        if (!existingIds.has(r.id)) {
          db.records.contacts.push(r);
        }
      });
    }
    
    // Merge settings
    if (normalizedData.settings) {
      db.settings = { ...db.settings, ...normalizedData.settings };
    }
    
    const after = {
      census: Object.keys(db.census.residentsByMrn).length,
      abx: db.records.abx.length,
      ip: db.records.ip_cases.length,
      vax: db.records.vax.length,
      notes: db.records.notes.length,
      lineListings: db.records.line_listings.length,
      outbreaks: db.records.outbreaks.length,
      contacts: db.records.contacts.length,
    };

    const delta = {
      census: after.census - before.census,
      abx: after.abx - before.abx,
      ip: after.ip - before.ip,
      vax: after.vax - before.vax,
      notes: after.notes - before.notes,
      lineListings: after.lineListings - before.lineListings,
      outbreaks: after.outbreaks - before.outbreaks,
      contacts: after.contacts - before.contacts,
    };

    addAudit(
      db,
      'db_import',
      `Backup import: +${delta.census} residents, +${delta.abx} ABX, +${delta.ip} IP, +${delta.vax} VAX`,
      'import'
    );

    try {
      // Important: don't optimistically swap the in-memory DB until persistence succeeds.
      await saveDBAsync(db, { optimistic: false });
    } catch (e) {
      const err = formatImportError(e);
      return {
        success: false,
        message:
          err.includes('QuotaExceededError')
            ? `Import parsed, but could not be saved: ${err} Try “Clear All Data” then import, or reduce the backup size.`
            : `Import parsed, but could not be saved: ${err}`,
      };
    }

    return {
      success: true,
      message: `Imported +${delta.census} residents, +${delta.abx} ABX, +${delta.ip} IP, +${delta.vax} VAX (totals: ${after.census} residents, ${after.abx} ABX, ${after.ip} IP, ${after.vax} VAX).`,
    };
  } catch (e) {
    return { success: false, message: `Failed to import backup: ${formatImportError(e)}` };
  }
};

export const clearDB = (): void => {
  dbCache = null;
  storage.clear().catch(e => console.error('Failed to clear DB:', e));
};

// Resident helpers
export const getActiveResidents = (db: ICNDatabase): Resident[] => {
  return Object.values(db.census.residentsByMrn).filter(r => r.active_on_census);
};

export const getResidentByMRN = (db: ICNDatabase, mrn: string): Resident | undefined => {
  return db.census.residentsByMrn[canonicalMRN(mrn)];
};

// Get active resident MRNs from census
const getActiveCensusMrns = (db: ICNDatabase): Set<string> => {
  const activeMrns = new Set<string>();
  Object.values(db.census.residentsByMrn)
    .filter(r => r.active_on_census)
    .forEach(r => {
      mrnMatchKeys(r.mrn).forEach(key => activeMrns.add(key));
    });
  return activeMrns;
};

// ABT helpers - excludes discharged residents
// Matches ABT View logic: exclude discontinued, and treat a course as active if:
// - no end date or end date is today/in the future
// - status is explicitly active (still requires end date not in the past)
export const getActiveABT = (db: ICNDatabase): ABTRecord[] => {
  const activeMrns = getActiveCensusMrns(db);
  const today = todayISO();
  return db.records.abx.filter(r => {
    const status = (r.status || '').toLowerCase();
    if (status === 'discontinued') return false;
    // Hard exclude discharged residents regardless of date
    if (r.mrn) {
      const matchKeys = mrnMatchKeys(r.mrn);
      if (matchKeys.length > 0 && !matchKeys.some(key => activeMrns.has(key))) return false;
    }
    const endDate = r.endDate || r.end_date;
    const endIso = endDate ? isoDateFromAny(endDate) : '';
    const isWithinCourse = !endIso || endIso >= today;
    if (status === 'active') return isWithinCourse;
    return isWithinCourse;
  });
};

const normalizeInfectionSource = (source?: string): string => (source || '').toLowerCase().trim();

const getLineListingRecommendationKey = (record: ABTRecord): string => {
  return record.id || record.record_id || `${record.mrn}_${record.medication || record.med_name || ''}_${record.startDate || record.start_date || ''}`;
};

const mapInfectionSourceToCategory = (source?: string): SymptomCategory | null => {
  const normalized = normalizeInfectionSource(source);
  if (normalized === 'respiratory') return 'respiratory';
  if (normalized === 'gi') return 'gi';
  return null;
};

export const getLineListingRecommendations = (db: ICNDatabase): LineListingRecommendation[] => {
  const dismissals = new Set(db.settings.lineListingRecommendationDismissals || []);
  const activeLineListingMrns = new Set(
    db.records.line_listings
      .filter(entry => entry.outcome === 'active')
      .map(entry => entry.mrn)
  );
  const activeABT = getActiveABT(db);

  return activeABT
    .map(record => {
      const category = mapInfectionSourceToCategory(record.infection_source);
      if (!category) return null;
      const key = getLineListingRecommendationKey(record);
      if (!record.mrn || dismissals.has(key) || activeLineListingMrns.has(record.mrn)) return null;
      const resident = db.census.residentsByMrn[record.mrn];
      return {
        id: key,
        abtRecordId: key,
        mrn: record.mrn,
        residentName: record.residentName || record.name || resident?.name || 'Unknown',
        unit: record.unit || resident?.unit || '',
        room: record.room || resident?.room || '',
        infectionSource: record.infection_source || 'Other',
        category,
        startDate: record.startDate || record.start_date || '',
        createdAt: record.createdAt || nowISO()
      } satisfies LineListingRecommendation;
    })
    .filter((rec): rec is LineListingRecommendation => Boolean(rec));
};

export const dismissLineListingRecommendation = (db: ICNDatabase, recommendationId: string): void => {
  if (!db.settings.lineListingRecommendationDismissals) {
    db.settings.lineListingRecommendationDismissals = [];
  }
  if (!db.settings.lineListingRecommendationDismissals.includes(recommendationId)) {
    db.settings.lineListingRecommendationDismissals.push(recommendationId);
    addAudit(db, 'line_listing_recommendation_dismissed', `Dismissed recommendation ${recommendationId}`, 'settings');
  }
};

// IP helpers - excludes discharged residents
// Status check is case-insensitive and handles common variants (e.g., "Active Case")
export const normalizeIPStatus = (status?: string): string => {
  const normalized = (status || '').trim().toLowerCase();
  if (!normalized) return '';
  if (normalized.includes('discharge')) return 'discharged';
  if (normalized.includes('resolve')) return 'resolved';
  if (normalized.includes('active') || normalized.includes('open')) return 'active';
  return normalized;
};

export const getActiveIPCases = (db: ICNDatabase): IPCase[] => {
  const activeMrns = getActiveCensusMrns(db);
  return db.records.ip_cases.filter(r => {
    const status = normalizeIPStatus(r.status || r.case_status);
    if (status !== 'active') return false;
    const mrn = canonicalMRN(r.mrn || '');
    if (mrn) {
      const matchKeys = mrnMatchKeys(mrn);
      if (matchKeys.length > 0 && !matchKeys.some(key => activeMrns.has(key))) return false;
    }
    return true;
  });
};

// VAX helpers - excludes discharged residents
// Status check is case-insensitive
export const getVaxDue = (db: ICNDatabase): VaxRecord[] => {
  const activeMrns = getActiveCensusMrns(db);
  return db.records.vax.filter(r => {
    const status = (r.status || '').toLowerCase();
    if (status !== 'due' && status !== 'overdue') return false;
    if (r.mrn) {
      const matchKeys = mrnMatchKeys(r.mrn);
      if (matchKeys.length > 0 && !matchKeys.some(key => activeMrns.has(key))) return false;
    }
    return true;
  });
};

// Notes helpers
export const getRecentNotes = (db: ICNDatabase, days: number = 3): Note[] => {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return db.records.notes.filter(n => new Date(n.createdAt) >= cutoff);
};

// Symptom follow-up helpers
export const getNotesRequiringFollowUp = (db: ICNDatabase): Note[] => {
  const today = todayISO();
  return db.records.notes.filter(n => 
    n.requiresFollowUp && 
    n.followUpStatus !== 'completed' &&
    (!n.followUpDate || n.followUpDate <= today)
  );
};

export const classifySymptoms = (symptoms: string[]): SymptomCategory => {
  const counts: Record<SymptomCategory, number> = {
    respiratory: 0,
    gi: 0,
    skin: 0,
    uti: 0,
    other: 0
  };
  
  symptoms.forEach(symptomId => {
    const symptom = SYMPTOM_OPTIONS.find(s => s.id === symptomId);
    if (symptom) {
      counts[symptom.category]++;
    }
  });
  
  // Return the category with most symptoms
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return sorted[0][1] > 0 ? sorted[0][0] as SymptomCategory : 'other';
};

// Line listing helpers
export const getActiveOutbreaks = (db: ICNDatabase): Outbreak[] => {
  return db.records.outbreaks.filter(o => o.status === 'active');
};

export const getLineListingsByOutbreak = (db: ICNDatabase, outbreakId: string): LineListingEntry[] => {
  return db.records.line_listings.filter(l => l.outbreakId === outbreakId);
};

export const getResidentLineListing = (db: ICNDatabase, mrn: string): LineListingEntry | undefined => {
  // Get most recent active line listing for a resident
  return db.records.line_listings
    .filter(l => l.mrn === mrn && l.outcome === 'active')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
};

export const addToLineListing = (
  db: ICNDatabase,
  entry: Omit<LineListingEntry, 'id' | 'createdAt'>
): LineListingEntry => {
  const newEntry: LineListingEntry = {
    ...entry,
    id: `ll_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    createdAt: nowISO()
  };
  db.records.line_listings.push(newEntry);
  
  // Update outbreak case count
  const outbreak = db.records.outbreaks.find(o => o.id === entry.outbreakId);
  if (outbreak) {
    outbreak.totalCases = db.records.line_listings.filter(l => l.outbreakId === entry.outbreakId).length;
    outbreak.updatedAt = nowISO();
    if (!outbreak.affectedUnits.includes(entry.unit)) {
      outbreak.affectedUnits.push(entry.unit);
    }
  }
  
  return newEntry;
};

export const createOutbreak = (
  db: ICNDatabase,
  outbreak: Omit<Outbreak, 'id' | 'createdAt' | 'totalCases'>
): Outbreak => {
  const newOutbreak: Outbreak = {
    ...outbreak,
    id: `outbreak_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    totalCases: 0,
    createdAt: nowISO()
  };
  db.records.outbreaks.push(newOutbreak);
  addAudit(db, 'outbreak_created', `Created outbreak: ${outbreak.name}`, 'ip');
  return newOutbreak;
};

// Contact tracing helpers
export const addContact = (
  db: ICNDatabase,
  contact: Omit<ContactEntry, 'id' | 'createdAt'>
): ContactEntry => {
  const newContact: ContactEntry = {
    ...contact,
    id: `contact_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    createdAt: nowISO()
  };
  db.records.contacts.push(newContact);
  return newContact;
};

export const getContactsByLineListing = (db: ICNDatabase, lineListingId: string): ContactEntry[] => {
  return db.records.contacts.filter(c => c.lineListingId === lineListingId);
};
