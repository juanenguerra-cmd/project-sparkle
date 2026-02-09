export async function onRequest({ request, env, params }: any) {
  const db = env.DB;
  if (!db) return new Response("Missing DB", { status: 500 });

  if (request.method !== "DELETE") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const id = params.id;
  await db.prepare("DELETE FROM items WHERE id = ?").bind(id).run();

  return Response.json({ ok: true, deleted: id });
}
