/**
 * D1 Storage Adapter Template
 * 
 * INSTRUCTIONS FOR CLOUDFLARE D1 MIGRATION:
 * 
 * 1. Rename this file to d1Adapter.ts
 * 2. Create a Cloudflare Worker with API endpoints
 * 3. Update the API_BASE_URL to your Worker URL
 * 4. Swap the adapter in storage/index.ts
 * 
 * Your Cloudflare Worker should expose:
 * - GET  /api/db       -> Returns full database JSON
 * - POST /api/db       -> Saves full database JSON
 * - DELETE /api/db     -> Clears database
 * 
 * Or for more granular control:
 * - GET/POST/DELETE /api/residents
 * - GET/POST/DELETE /api/abx
 * - GET/POST/DELETE /api/ip-cases
 * - GET/POST/DELETE /api/vax
 * - GET/POST/DELETE /api/notes
 * - GET/POST /api/settings
 */

import type { StorageAdapter, StorageConfig } from './types';
import type { ICNDatabase } from '../database';
import { defaultDatabase } from './defaults';

// Update this to your Cloudflare Worker URL
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
      // Remove cache before saving
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

/**
 * Example Cloudflare Worker code for D1:
 * 
 * ```typescript
 * // worker.ts
 * export default {
 *   async fetch(request: Request, env: Env): Promise<Response> {
 *     const url = new URL(request.url);
 *     
 *     // CORS headers
 *     const corsHeaders = {
 *       'Access-Control-Allow-Origin': '*',
 *       'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
 *       'Access-Control-Allow-Headers': 'Content-Type',
 *     };
 *     
 *     if (request.method === 'OPTIONS') {
 *       return new Response(null, { headers: corsHeaders });
 *     }
 *     
 *     if (url.pathname === '/api/db') {
 *       if (request.method === 'GET') {
 *         // Load from D1
 *         const result = await env.DB.prepare(
 *           'SELECT data FROM app_state WHERE id = 1'
 *         ).first();
 *         return new Response(result?.data || '{}', {
 *           headers: { ...corsHeaders, 'Content-Type': 'application/json' }
 *         });
 *       }
 *       
 *       if (request.method === 'POST') {
 *         // Save to D1
 *         const data = await request.text();
 *         await env.DB.prepare(
 *           'INSERT OR REPLACE INTO app_state (id, data) VALUES (1, ?)'
 *         ).bind(data).run();
 *         return new Response('OK', { headers: corsHeaders });
 *       }
 *       
 *       if (request.method === 'DELETE') {
 *         await env.DB.prepare('DELETE FROM app_state WHERE id = 1').run();
 *         return new Response('OK', { headers: corsHeaders });
 *       }
 *     }
 *     
 *     return new Response('Not Found', { status: 404 });
 *   }
 * };
 * 
 * // D1 Schema:
 * // CREATE TABLE app_state (id INTEGER PRIMARY KEY, data TEXT);
 * ```
 */
