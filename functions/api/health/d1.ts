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
    // 1) Read check (connectivity)
    await db.prepare("SELECT 1 AS ok").first();

    // 2) Ensure table exists (minimal, safe schema)
    await db.prepare("CREATE TABLE IF NOT EXISTS __ping (ts TEXT);").run();

    // 3) Ensure 'note' column exists (schema drift fix) — with re-check after ALTER
    let cols = await db
      .prepare("PRAGMA table_info(__ping);")
      .all<{ name: string }>();

    let hasNote = (cols.results ?? []).some((c) => c.name === "note");

    if (!hasNote) {
      await db.prepare("ALTER TABLE __ping ADD COLUMN note TEXT;").run();

      // Re-check after altering schema so response is accurate
      cols = await db
        .prepare("PRAGMA table_info(__ping);")
        .all<{ name: string }>();

      hasNote = (cols.results ?? []).some((c) => c.name === "note");
    }

    // 4) Force observable movement on EVERY request
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
      hasNote,
      columns: (cols.results ?? []).map((c) => c.name),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);

    console.error("D1 healthcheck failed:", err);

    // Keep detail for now; remove later once stable
    return json(
      { ok: false, error: "D1 healthcheck failed", detail: message },
      500
    );
  }
};
