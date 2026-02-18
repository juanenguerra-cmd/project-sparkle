import type { VaccinationRecord } from '@/lib/types/vaccination';

const DB_KEY = 'UNIFIED_DB_V1';

interface UnifiedDbV1 {
  records?: {
    vax?: VaccinationRecord[];
  };
}

function loadUnifiedDb(): UnifiedDbV1 {
  const raw = localStorage.getItem(DB_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as UnifiedDbV1;
  } catch {
    return {};
  }
}

export function getAllVaccinationRecords(): VaccinationRecord[] {
  const db = loadUnifiedDb();
  return db.records?.vax || [];
}
