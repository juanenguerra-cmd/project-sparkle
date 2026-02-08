interface Env {
  DB?: D1Database;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export const onRequest: PagesFunction<Env> = async (context) => {
  const db = context.env.DB;

  if (!db) {
    const message = 'Missing D1 binding: DB';
    console.error(message);
    return json({ ok: false, error: message }, 500);
  }

  try {
    await db.prepare('SELECT 1').first();

    const table = await db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='healthcheck'"
      )
      .first<{ name?: string }>();

    if (table?.name) {
      await db
        .prepare('INSERT INTO healthcheck (note) VALUES (?)')
        .bind('pages-healthcheck')
        .run();
    }

    return json({ ok: true, source: 'd1' });
  } catch (error) {
    console.error('D1 healthcheck failed', error);
    return json({ ok: false, error: 'D1 healthcheck failed' }, 500);
  }
};
