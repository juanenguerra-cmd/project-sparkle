// Force observable movement in D1 on every request
await db.prepare(
  "CREATE TABLE IF NOT EXISTS __ping (ts TEXT, note TEXT);"
).run();

await db.prepare(
  "INSERT INTO __ping (ts, note) VALUES (datetime('now'), ?);"
).bind("pages-healthcheck").run();

const row = await db.prepare(
  "SELECT COUNT(*) AS c FROM __ping;"
).first<{ c: number }>();
