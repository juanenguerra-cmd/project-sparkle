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
  AuditEntry,
  AppSettings,
  LineListingEntry,
  Outbreak,
  ContactEntry,
  SymptomCategory,
  SYMPTOM_OPTIONS
} from './types';
import { nowISO, canonicalMRN } from './parsers';
import { storage, defaultSettings, defaultDatabase } from './storage';

export interface ICNDatabase {
  census: {
    residentsByMrn: Record<string, Resident>;
    meta: {
      imported_at: string | null;
    };
  };
  records: {
    abx: ABTRecord[];
    ip_cases: IPCase[];
    vax: VaxRecord[];
    notes: Note[];
    line_listings: LineListingEntry[];
    outbreaks: Outbreak[];
    contacts: ContactEntry[];
  };
  audit_log: AuditEntry[];
  settings: AppSettings & {
    last_import_at?: string;
    census_exclude_names?: string[];
    auto_close_on_census_drop?: boolean;
    auto_close_grace_days?: number;
  };
  cache?: Record<string, unknown>;
}

// Re-export for compatibility
export { defaultSettings };

// In-memory cache for synchronous access
// The storage adapter handles async persistence
let dbCache: ICNDatabase | null = null;

const createEmptyDB = (): ICNDatabase => defaultDatabase() as ICNDatabase;

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
        meta: parsed.census?.meta || { imported_at: null }
      },
      records: {
        abx: Array.isArray(parsed.records?.abx) ? parsed.records.abx : [],
        ip_cases: Array.isArray(parsed.records?.ip_cases) ? parsed.records.ip_cases : [],
        vax: Array.isArray(parsed.records?.vax) ? parsed.records.vax : [],
        notes: Array.isArray(parsed.records?.notes) ? parsed.records.notes : [],
        line_listings: Array.isArray(parsed.records?.line_listings) ? parsed.records.line_listings : [],
        outbreaks: Array.isArray(parsed.records?.outbreaks) ? parsed.records.outbreaks : [],
        contacts: Array.isArray(parsed.records?.contacts) ? parsed.records.contacts : []
      },
      audit_log: Array.isArray(parsed.audit_log) ? parsed.audit_log : [],
      settings: { ...defaultSettings, ...parsed.settings }
    };
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
export const saveDB = (db: ICNDatabase): void => {
  dbCache = db;
  
  // Async save - fire and forget for now
  // When migrating to D1, consider adding error handling UI
  storage.save(db).catch(e => {
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
  entityType: AuditEntry['entityType']
): void => {
  const entry: AuditEntry = {
    id: `audit_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    action,
    details,
    entityType,
    timestamp: nowISO()
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

export const importDBFromJSON = (jsonStr: string): { success: boolean; message: string } => {
  try {
    const data = JSON.parse(jsonStr);
    
    // Basic validation - support multiple backup schemas
    // Accept: census, records, residentsByMrn (direct), or any known record arrays
    const hasCensus = data.census?.residentsByMrn || data.residentsByMrn;
    const hasRecords = data.records || data.abx || data.ip_cases || data.vax || data.notes || 
                       data.abt_worklist || data.vax_due;
    
    if (!hasCensus && !hasRecords) {
      return { success: false, message: 'Invalid backup file: missing census or records data' };
    }
    
    // Normalize structure if data is in flat format
    const normalizedData = {
      census: data.census || (data.residentsByMrn ? { residentsByMrn: data.residentsByMrn, meta: data.meta } : undefined),
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
    
    const db = loadDB();
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
          end_date: r.endDate || r.end_date || r.end || '',
          endDate: r.endDate || r.end_date || r.end || '',
          status: r.isActive || r.status === 'Active' ? 'active' : 'completed',
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
    
    // Count what was imported
    const censusCount = Object.keys(db.census.residentsByMrn).length;
    const abxCount = db.records.abx.length;
    const vaxCount = db.records.vax.length;
    
    addAudit(db, 'db_import', `Imported: ${censusCount} residents, ${abxCount} ABX, ${vaxCount} VAX`, 'import');
    saveDB(db);
    
    return { success: true, message: `Imported ${censusCount} residents, ${abxCount} ABX records, ${vaxCount} VAX records` };
  } catch (e) {
    return { success: false, message: `Failed to parse JSON: ${e}` };
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
  return new Set(
    Object.values(db.census.residentsByMrn)
      .filter(r => r.active_on_census)
      .map(r => r.mrn)
  );
};

// ABT helpers - excludes discharged residents and discontinued treatments
// Status check is case-insensitive
export const getActiveABT = (db: ICNDatabase): ABTRecord[] => {
  const activeMrns = getActiveCensusMrns(db);
  return db.records.abx.filter(r => {
    const status = (r.status || '').toLowerCase();
    if (status === 'completed' || status === 'discontinued') return false;
    // Hard exclude discharged residents regardless of date
    if (r.mrn && !activeMrns.has(r.mrn)) return false;
    return true;
  });
};

// IP helpers - excludes discharged residents
// Status check is case-insensitive to handle both 'Active' and 'ACTIVE'
export const getActiveIPCases = (db: ICNDatabase): IPCase[] => {
  const activeMrns = getActiveCensusMrns(db);
  return db.records.ip_cases.filter(r => {
    const status = (r.status || '').toLowerCase();
    if (status !== 'active') return false;
    if (r.mrn && !activeMrns.has(r.mrn)) return false;
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
    if (r.mrn && !activeMrns.has(r.mrn)) return false;
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
  const today = new Date().toISOString().slice(0, 10);
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
