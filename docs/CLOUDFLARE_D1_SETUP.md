# Cloudflare D1 Database Setup Guide

This guide explains how to migrate from localStorage to Cloudflare D1 for persistent, cloud-based storage.

## Overview

The ICN Hub uses a storage abstraction layer that makes it easy to switch between storage backends. Currently, data is stored in localStorage. This guide shows how to migrate to Cloudflare D1.

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   ICN Hub App   │────▶│  D1 Adapter     │────▶│ Cloudflare      │
│   (Frontend)    │     │  (API Client)   │     │ Worker + D1     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

## Prerequisites

1. **Cloudflare Account** - Sign up at https://dash.cloudflare.com
2. **Wrangler CLI** - Install with `npm install -g wrangler`
3. **Node.js 18+**

## Step 1: Create Cloudflare Worker Project

```bash
# Create a new worker project
mkdir icn-hub-api
cd icn-hub-api
npm init -y

# Install wrangler
npm install wrangler --save-dev

# Login to Cloudflare
npx wrangler login
```

## Step 2: Create D1 Database

```bash
# Create the D1 database
npx wrangler d1 create icn-hub-db

# Note the database_id from the output - you'll need it for wrangler.toml
```

## Step 3: Configure wrangler.toml

Create `wrangler.toml` in your worker project:

```toml
name = "icn-hub-api"
main = "src/worker.ts"
compatibility_date = "2024-01-01"

[[d1_databases]]
binding = "DB"
database_name = "icn-hub-db"
database_id = "YOUR_DATABASE_ID_HERE"  # Replace with actual ID from Step 2
```

## Step 4: Create Database Schema

Create `schema.sql`:

```sql
-- Main application state table
CREATE TABLE IF NOT EXISTS app_state (
  id INTEGER PRIMARY KEY,
  data TEXT NOT NULL,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Initialize with empty state
INSERT OR IGNORE INTO app_state (id, data) VALUES (1, '{}');

-- Optional: Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_app_state_updated ON app_state(updated_at);
```

Apply the schema:

```bash
npx wrangler d1 execute icn-hub-db --file=./schema.sql
```

## Step 5: Create the Worker

Create `src/worker.ts`:

```typescript
export interface Env {
  DB: D1Database;
}

// CORS headers for cross-origin requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // API routes
    if (url.pathname === '/api/db') {
      try {
        // GET - Load database
        if (request.method === 'GET') {
          const result = await env.DB.prepare(
            'SELECT data FROM app_state WHERE id = 1'
          ).first<{ data: string }>();
          
          return new Response(result?.data || '{}', {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // POST - Save database
        if (request.method === 'POST') {
          const data = await request.text();
          
          // Validate JSON
          try {
            JSON.parse(data);
          } catch {
            return new Response('Invalid JSON', { 
              status: 400, 
              headers: corsHeaders 
            });
          }

          await env.DB.prepare(
            'UPDATE app_state SET data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1'
          ).bind(data).run();

          return new Response('OK', { headers: corsHeaders });
        }

        // DELETE - Clear database
        if (request.method === 'DELETE') {
          await env.DB.prepare(
            'UPDATE app_state SET data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1'
          ).bind('{}').run();

          return new Response('OK', { headers: corsHeaders });
        }
      } catch (error) {
        console.error('D1 error:', error);
        return new Response('Internal Server Error', { 
          status: 500, 
          headers: corsHeaders 
        });
      }
    }

    // Health check
    if (url.pathname === '/health') {
      return new Response('OK', { headers: corsHeaders });
    }

    return new Response('Not Found', { status: 404, headers: corsHeaders });
  },
};
```

## Step 6: Deploy the Worker

```bash
# Deploy to Cloudflare
npx wrangler deploy

# Note the worker URL (e.g., https://icn-hub-api.your-subdomain.workers.dev)
```

## Step 7: Update ICN Hub to Use D1

### 7a. Rename the adapter template

```bash
# In your ICN Hub project
mv src/lib/storage/d1Adapter.template.ts src/lib/storage/d1Adapter.ts
```

### 7b. Update the API URL in d1Adapter.ts

```typescript
// Change this line:
const API_BASE_URL = 'https://your-worker.your-subdomain.workers.dev';

// To your actual worker URL:
const API_BASE_URL = 'https://icn-hub-api.your-subdomain.workers.dev';
```

### 7c. Switch the adapter in storage/index.ts

```typescript
// Comment out localStorage:
// import { LocalStorageAdapter } from './localStorageAdapter';

// Import D1 adapter:
import { D1StorageAdapter } from './d1Adapter';

// Change the export:
export const storage = new D1StorageAdapter({ 
  apiBase: 'https://icn-hub-api.your-subdomain.workers.dev',
  debug: true  // Set to false in production
});
```

## Step 8: Test the Integration

1. Open the ICN Hub application
2. Check the browser console for D1StorageAdapter logs
3. Add some data (census import, ABT records, etc.)
4. Refresh the page - data should persist
5. Open in a different browser - data should be shared

## Data Migration (Optional)

To migrate existing localStorage data to D1:

1. Export your current data from Settings > Data Management > Export Backup
2. Clear the localStorage
3. Switch to D1 adapter
4. Import the backup file from Settings > Data Management > Import Backup

## Security Considerations

### Add Authentication (Recommended for Production)

Update the worker to require an API key:

```typescript
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Check API key
    const apiKey = request.headers.get('X-API-Key');
    if (apiKey !== env.API_KEY) {
      return new Response('Unauthorized', { status: 401 });
    }
    
    // ... rest of the handler
  },
};
```

Add the secret to wrangler.toml:

```toml
[vars]
API_KEY = "your-secret-api-key"
```

Update the D1 adapter to send the key:

```typescript
const response = await fetch(`${this.apiBase}/api/db`, {
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': 'your-secret-api-key',
  },
});
```

### Enable Access Controls

Consider using Cloudflare Access to restrict who can reach your API.

## Troubleshooting

### "Failed to load" error
- Check the worker URL is correct
- Verify CORS headers are set
- Check browser console for network errors

### "Failed to save" error
- Verify the worker is deployed and running
- Check D1 database exists and has the schema applied
- Review worker logs: `npx wrangler tail`

### Data not persisting
- Ensure you're using the D1 adapter (check console for "[D1StorageAdapter]" logs)
- Verify the database has data: `npx wrangler d1 execute icn-hub-db --command "SELECT * FROM app_state"`

## Monitoring

View worker logs in real-time:

```bash
npx wrangler tail
```

Check D1 metrics in the Cloudflare dashboard under Workers & Pages > D1.

## Costs

- **Workers Free Tier**: 100,000 requests/day
- **D1 Free Tier**: 5 million rows read/day, 100,000 rows written/day, 5GB storage

For a typical single-facility deployment, the free tier should be more than sufficient.

## Support

For issues with:
- **Cloudflare/Wrangler**: https://developers.cloudflare.com/d1/
- **ICN Hub**: Check the project documentation or contact support
