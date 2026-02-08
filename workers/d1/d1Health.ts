export type HardCheckResult = {
  ok: boolean;
  envTag: string;
  insertedId?: number;
  readBackId?: number;
  error?: string;
};

const resolveEnvValue = (
  key: string,
  env?: Record<string, string | undefined>,
  processEnv?: Record<string, string | undefined>
) => processEnv?.[key] ?? env?.[key];

export const resolveEnvTag = (
  env?: Record<string, string | undefined>,
  processEnv: Record<string, string | undefined> =
    globalThis.process?.env ?? {}
) =>
  resolveEnvValue('ENV_TAG', env, processEnv) ??
  resolveEnvValue('CF_PAGES_BRANCH', env, processEnv) ??
  resolveEnvValue('NODE_ENV', env, processEnv) ??
  'unknown';

const formatError = (error: unknown) => {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
};

const parseLastRowId = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
};

export const runHardSyncCheck = async (
  db: D1Database | undefined,
  env?: Record<string, string | undefined>
): Promise<HardCheckResult> => {
  const envTag = resolveEnvTag(env);

  if (!db) {
    return {
      ok: false,
      envTag,
      error: 'Missing D1 binding: DB',
    };
  }

  try {
    const insertResult = await db
      .prepare('INSERT INTO __sync_probe (env) VALUES (?)')
      .bind(envTag)
      .run();
    const insertedId = parseLastRowId(insertResult.meta?.last_row_id);

    const readBack = await db
      .prepare('SELECT id, env FROM __sync_probe ORDER BY id DESC LIMIT 1')
      .first<{ id: number; env: string }>();

    if (!readBack) {
      return {
        ok: false,
        envTag,
        insertedId,
        error: 'No row read back from __sync_probe',
      };
    }

    const ok = insertedId === readBack.id && readBack.env === envTag;

    return {
      ok,
      envTag,
      insertedId,
      readBackId: readBack.id,
      error: ok ? undefined : 'Read-back mismatch for __sync_probe',
    };
  } catch (error) {
    return {
      ok: false,
      envTag,
      error: formatError(error),
    };
  }
};

export const getSqliteVersion = async (db: D1Database | undefined) => {
  if (!db) {
    return { value: null, error: 'Missing D1 binding: DB' };
  }

  try {
    const result = await db
      .prepare('SELECT sqlite_version() as version')
      .first<{ version: string }>();
    return { value: result?.version ?? null };
  } catch (error) {
    return { value: null, error: formatError(error) };
  }
};

export const listTables = async (db: D1Database | undefined, limit = 50) => {
  if (!db) {
    return { tables: [], error: 'Missing D1 binding: DB' };
  }

  try {
    const result = await db
      .prepare(
        'SELECT name FROM sqlite_master WHERE type = ? ORDER BY name LIMIT ?'
      )
      .bind('table', limit)
      .all<{ name: string }>();
    return { tables: result.results?.map((row) => row.name) ?? [] };
  } catch (error) {
    return { tables: [], error: formatError(error) };
  }
};

export const getMigrationStatus = async (db: D1Database | undefined) => {
  if (!db) {
    return {
      ok: false,
      message: 'Missing D1 binding: DB',
      migrations: [],
    };
  }

  try {
    const result = await db
      .prepare('SELECT * FROM d1_migrations ORDER BY id')
      .all<Record<string, unknown>>();
    return { ok: true, migrations: result.results ?? [] };
  } catch (error) {
    const message = formatError(error);
    if (message.toLowerCase().includes('no such table')) {
      return {
        ok: false,
        message: 'd1_migrations table is missing',
        migrations: [],
      };
    }
    return { ok: false, message, migrations: [] };
  }
};
