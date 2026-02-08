interface Env {
  DB?: D1Database;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export const onRequest: PagesFunction<Env> = async ({ env }) => {
  const db = env.DB;

  if (!db) {
    const msg = "Missing D1 binding: DB";
    console.error(msg);
    return json({ ok: false, error: msg }, 500);
  }

  try {
    // Connectivity check
    await db.prepare("SELECT 1 AS ok").first();

    // Guaranteed write (schema already exists via migrations)
    await db
      .prepare("INSERT INTO __ping (ts, note) VALUES (datetime('now'), ?);")
      .bind("pages-healthcheck")
      .run();

    const row = await db
      .prepare("SELECT COUNT(*) AS c FROM __ping;")
      .first<{ c: number }>();

    return json({
      ok: true,
      source: "d1",
      wrote: true,
      rows: row?.c ?? 0,
      route: "/api/health/d1",
    });
  } catch (err: unknown) {
    // Log full details privately
    console.error("D1 healthcheck failed:", err);

    // Keep response clean (no internal error leakage)
    return json({ ok: false, error: "D1 healthcheck failed" }, 500);
  }
};
