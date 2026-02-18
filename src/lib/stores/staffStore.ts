import type { StaffMember } from '@/lib/types/staff';

const DB_KEY = 'UNIFIED_DB_V1';

export interface UnifiedDbV1 {
  records?: {
    ip_cases?: unknown[];
    abx?: unknown[];
    vax?: unknown[];
    outbreaks?: unknown[];
    line_listings?: unknown[];
  };
  census?: unknown[];
  staff?: StaffMember[];
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

function saveUnifiedDb(db: UnifiedDbV1) {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
}

export function getAllStaff(): StaffMember[] {
  const db = loadUnifiedDb();
  return db.staff || [];
}

export function saveStaffList(list: StaffMember[]): void {
  const db = loadUnifiedDb();
  db.staff = list;
  saveUnifiedDb(db);
}

export function upsertStaff(staffMember: StaffMember): void {
  const current = getAllStaff();
  const index = current.findIndex((staff) => staff.id === staffMember.id);
  if (index >= 0) {
    current[index] = staffMember;
  } else {
    current.unshift(staffMember);
  }
  saveStaffList(current);
}
