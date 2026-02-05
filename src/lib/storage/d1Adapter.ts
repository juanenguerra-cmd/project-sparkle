import type { StorageAdapter, StorageConfig } from './types';
import type { ICNDatabase } from '../database';
import { defaultDatabase } from './defaults';

const API_BASE_URL = 'https://your-worker.your-subdomain.workers.dev';

export class D1StorageAdapter implements StorageAdapter {
  readonly name = 'd1';
  private readonly apiBase: string;
  private readonly debug: boolean;

  constructor(config: StorageConfig & { apiBase?: string } = {}) {
    this.apiBase = config.apiBase || API_BASE_URL;
    this.debug = config.debug ?? false;
  }

  async load(): Promise<ICNDatabase> {
    try {
      const response = await fetch(`${this.apiBase}/api/db`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      this.log('Database loaded from D1');
      return data as ICNDatabase;
    } catch (e) {
      console.error('D1StorageAdapter: Failed to load:', e);
      return defaultDatabase() as ICNDatabase;
    }
  }

  async save(db: ICNDatabase): Promise<void> {
    try {
      const toSave = { ...db };
      delete toSave.cache;

      const response = await fetch(`${this.apiBase}/api/db`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(toSave),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      this.log('Database saved to D1');
    } catch (e) {
      console.error('D1StorageAdapter: Failed to save:', e);
      throw e;
    }
  }

  async clear(): Promise<void> {
    try {
      const response = await fetch(`${this.apiBase}/api/db`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      this.log('Database cleared in D1');
    } catch (e) {
      console.error('D1StorageAdapter: Failed to clear:', e);
      throw e;
    }
  }

  private log(message: string): void {
    if (this.debug) {
      console.log(`[D1StorageAdapter] ${message}`);
    }
  }
}
