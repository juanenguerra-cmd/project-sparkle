export async function onRequest({ request, env }: any) {
  const db = env.DB;
  if (!db) return new Response("Missing DB", { status: 500 });

  if (request.method === "GET") {
    const rows = await db
      .prepare("SELECT id, data, updated_at FROM items ORDER BY updated_at DESC")
      .all();
    return Response.json({ ok: true, items: rows.results ?? [] });
  }

  if (request.method === "POST") {
    const body = await request.json();
    const id = body.id ?? crypto.randomUUID();
    const data = JSON.stringify(body.data ?? body);

    await db
      .prepare("INSERT INTO items (id, data, updated_at) VALUES (?, ?, datetime('now'))")
      .bind(id, data)
      .run();

    return Response.json({ ok: true, id });
  }

  return new Response("Method Not Allowed", { status: 405 });
}
