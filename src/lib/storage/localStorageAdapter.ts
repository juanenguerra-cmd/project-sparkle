// LocalStorage Implementation of StorageAdapter
// This is the current implementation - will be swapped for D1Adapter later

import type { StorageAdapter, StorageConfig } from './types';
import type { ICNDatabase } from '../database';
import { defaultDatabase } from './defaults';

const DEFAULT_KEY = 'icn_hub_db';

export class LocalStorageAdapter implements StorageAdapter {
  readonly name = 'localStorage';
  private readonly key: string;
  private readonly debug: boolean;

  constructor(config: StorageConfig = {}) {
    this.key = config.keyPrefix ? `${config.keyPrefix}_db` : DEFAULT_KEY;
    this.debug = config.debug ?? false;
  }

  async load(): Promise<ICNDatabase> {
    try {
      const raw = localStorage.getItem(this.key);
      if (!raw) {
        this.log('No existing data, returning default database');
        return defaultDatabase();
      }
      
      const parsed = JSON.parse(raw);
      const db = this.ensureStructure(parsed);
      this.log(`Loaded database with ${Object.keys(db.census.residentsByMrn).length} residents`);
      return db;
    } catch (e) {
      console.error('LocalStorageAdapter: Failed to load:', e);
      return defaultDatabase();
    }
  }

  async save(db: ICNDatabase): Promise<void> {
    try {
      // Remove cache before saving
      const toSave = { ...db };
      delete toSave.cache;
      localStorage.setItem(this.key, JSON.stringify(toSave));
      this.log('Database saved successfully');
    } catch (e) {
      console.error('LocalStorageAdapter: Failed to save:', e);
      throw e;
    }
  }

  async clear(): Promise<void> {
    localStorage.removeItem(this.key);
    this.log('Database cleared');
  }

  private ensureStructure(parsed: any): ICNDatabase {
    const defaults = defaultDatabase();
    return {
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
      settings: { ...defaults.settings, ...parsed.settings }
    };
  }

  private log(message: string): void {
    if (this.debug) {
      console.log(`[LocalStorageAdapter] ${message}`);
    }
  }
}
