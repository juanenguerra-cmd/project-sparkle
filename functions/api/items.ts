interface Env {
  DB?: D1Database;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  const db = env.DB;
  if (!db) return json({ ok: false, error: "Missing D1 binding: DB" }, 500);

  try {
    if (request.method === "GET") {
      const result = await db
        .prepare("SELECT id, data, updated_at FROM items ORDER BY updated_at DESC")
        .all<{ id: string; data: string; updated_at: string }>();

      const items = (result.results ?? []).map((r) => ({
        id: r.id,
        updated_at: r.updated_at,
        data: safeJsonParse(r.data),
      }));

      return json({ ok: true, items });
    }

    if (request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      const id = typeof body?.id === "string" ? body.id : crypto.randomUUID();
      const payload = body?.data ?? body; // allow either {data:{...}} or raw object
      const data = JSON.stringify(payload);

      await db
        .prepare("INSERT INTO items (id, data, updated_at) VALUES (?, ?, datetime('now'))")
        .bind(id, data)
        .run();

      return json({ ok: true, id });
    }

    return json({ ok: false, error: "Method Not Allowed" }, 405);
  } catch (err) {
    console.error("items endpoint failed:", err);
    return json({ ok: false, error: "Items endpoint failed" }, 500);
  }
};

function safeJsonParse(s: string) {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}
