interface Env {
  DB?: D1Database;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export const onRequest: PagesFunction<Env> = async ({ request, env, params }) => {
  const db = env.DB;
  if (!db) return json({ ok: false, error: "Missing D1 binding: DB" }, 500);

  if (request.method !== "DELETE") {
    return json({ ok: false, error: "Method Not Allowed" }, 405);
  }

  try {
    const id = String(params.id || "");
    if (!id) return json({ ok: false, error: "Missing id" }, 400);

    await db.prepare("DELETE FROM items WHERE id = ?").bind(id).run();
    return json({ ok: true, deleted: id });
  } catch (err) {
    console.error("delete item failed:", err);
    return json({ ok: false, error: "Delete failed" }, 500);
  }
};
