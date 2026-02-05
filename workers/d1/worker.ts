export interface Env {
  DB: D1Database;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const jsonHeaders = {
  ...corsHeaders,
  'Content-Type': 'application/json',
};

const ok = (body: string | null, headers: HeadersInit = corsHeaders) =>
  new Response(body, { headers });

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: jsonHeaders });

const badRequest = (message: string) => json({ error: message }, 400);

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return ok(null);
    }

    if (url.pathname !== '/api/db') {
      return new Response('Not Found', { status: 404, headers: corsHeaders });
    }

    if (request.method === 'GET') {
      const result = await env.DB.prepare(
        'SELECT data FROM app_state WHERE id = 1'
      ).first<{ data?: string }>();
      const data = result?.data ?? null;
      return ok(data ?? '{}', jsonHeaders);
    }

    if (request.method === 'POST') {
      const text = await request.text();
      if (!text) {
        return badRequest('Missing request body');
      }
      await env.DB.prepare(
        'INSERT OR REPLACE INTO app_state (id, data) VALUES (1, ?)' 
      ).bind(text).run();
      return ok(JSON.stringify({ status: 'ok' }), jsonHeaders);
    }

    if (request.method === 'DELETE') {
      await env.DB.prepare('DELETE FROM app_state WHERE id = 1').run();
      return ok(JSON.stringify({ status: 'ok' }), jsonHeaders);
    }

    return new Response('Method Not Allowed', {
      status: 405,
      headers: corsHeaders,
    });
  },
};
