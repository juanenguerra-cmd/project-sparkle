interface Env {
  DB?: D1Database;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export const onRequest: PagesFunction<Env> = async (context) => {
  const db = context.env.DB;

  // Helpful "same path" signals
  const url = new URL(context.request.url);
  const host = url.host;

  // Very simple heuristic: preview URLs often contain extra dots/subdomains
  // (keep it as "best effort", not a promise)
  const envKind = host.endsWith(".pages.dev") && host.split(".").length > 3 ? "preview-ish" : "production-ish";

  if (!db) {
    const msg = "Missing D1 binding: DB";
    console.error(msg);
    return json(
      {
        ok: false,
        status: "INACTIVE",
        sync: "NOT_SYNCED",
        indicator: "🔴 INACTIVE · NOT SYNCED",
        error: msg,
        host,
        envKind,
        route: "/api/health/d1",
        checkedAt: new Date().toISOString(),
      },
      500
    );
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

    // === DB fingerprint: proves both devices hit the SAME D1 DB ===
    // Create meta table if needed (safe)
    await db.prepare("CREATE TABLE IF NOT EXISTS __meta (k TEXT PRIMARY KEY, v TEXT);").run();

    // Insert fingerprint once (safe)
    await db
      .prepare(
        "INSERT OR IGNORE INTO __meta (k, v) VALUES ('db_fingerprint', lower(hex(randomblob(16))));"
      )
      .run();

    const fp = await db
      .prepare("SELECT v FROM __meta WHERE k='db_fingerprint';")
      .first<{ v: string }>();

    return json({
      ok: true,
      source: "d1",
      status: "ACTIVE",
      sync: "COMPLETE",
      indicator: "🟢 ACTIVE · SYNCED",
      wrote: true,
      rows: row?.c ?? 0,
      host,
      envKind,
      dbFingerprint: fp?.v ?? null,
      route: "/api/health/d1",
      checkedAt: new Date().toISOString(),
    });
  } catch (err: unknown) {
    console.error("D1 healthcheck failed:", err);

    return json(
      {
        ok: false,
        status: "ACTIVE",
        sync: "FAILED",
        indicator: "🟡 ACTIVE · SYNC FAILED",
        error: "D1 healthcheck failed",
        host,
        envKind,
        route: "/api/health/d1",
        checkedAt: new Date().toISOString(),
      },
      500
    );
  }
};
