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

## Step 1: Login to Cloudflare

```bash
npx wrangler login
```

## Step 2: Create D1 Database

```bash
# Create the D1 database
npx wrangler d1 create project-sparkle-db

# Note the database_id from the output - you'll need it for wrangler.toml
```

## Step 3: Configure wrangler.toml

This repo already ships with `wrangler.toml`. Update the `database_id` value:

```toml
name = "project-sparkle-db"
main = "workers/d1/worker.ts"
compatibility_date = "2024-11-01"
migrations_dir = "workers/d1/migrations"

[[d1_databases]]
binding = "DB"
database_name = "project-sparkle-db"
database_id = "YOUR_DATABASE_ID_HERE"  # Replace with actual ID from Step 2
```

## Step 4: Apply Database Migrations

The initial schema lives in `workers/d1/migrations/0001_init.sql`. Apply it locally or remotely:

```bash
# Local dev database
npx wrangler d1 migrations apply project-sparkle-db --local

# Cloudflare-hosted database
npx wrangler d1 migrations apply project-sparkle-db --remote
```

## Step 5: Review the Worker

The worker implementation already lives at `workers/d1/worker.ts` and exposes:

- `GET /api/db` (load JSON)
- `POST /api/db` (save JSON)
- `DELETE /api/db` (clear JSON)

## Step 6: Deploy the Worker

```bash
# Deploy to Cloudflare
npx wrangler deploy

# Note the worker URL (e.g., https://icn-hub-api.your-subdomain.workers.dev)
```

## Step 7: Configure the Frontend

Set the API base URL for the D1 worker via Vite env vars:

```bash
# .env
VITE_D1_API_BASE_URL="https://project-sparkle-db.your-subdomain.workers.dev"
```

The app now uses the D1 adapter by default.

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
- Verify the database has data: `npx wrangler d1 execute project-sparkle-db --command "SELECT * FROM app_state"`

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
