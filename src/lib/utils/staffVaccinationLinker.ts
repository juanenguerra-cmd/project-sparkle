import { getAllStaff } from '@/lib/stores/staffStore';

const DB_KEY = 'UNIFIED_DB_V1';

function loadUnifiedDb(): any {
  const raw = localStorage.getItem(DB_KEY);
  if (!raw) return {};

  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function saveUnifiedDb(db: any) {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
}

export function linkVaxRecordsToStaff() {
  const db = loadUnifiedDb();
  const vax = db.records?.vax || [];
  const staff = getAllStaff();

  const byEmployeeId = new Map(staff.filter((s) => s.employeeId).map((s) => [s.employeeId, s]));
  const byName = new Map(staff.map((s) => [s.fullName.toLowerCase(), s]));

  for (const rec of vax) {
    if (rec.subjectType && rec.subjectType !== 'staff') continue;

    const employeeId = rec.employeeId && String(rec.employeeId).trim();
    const subjectName = rec.subjectName && String(rec.subjectName).trim().toLowerCase();

    let matched;
    if (employeeId && byEmployeeId.has(employeeId)) {
      matched = byEmployeeId.get(employeeId);
    } else if (subjectName && byName.has(subjectName)) {
      matched = byName.get(subjectName);
    }

    if (matched) {
      rec.subjectType = 'staff';
      rec.subjectId = matched.id;
      rec.subjectName = matched.fullName;
      rec.employeeId = matched.employeeId;
    }
  }

  if (!db.records) db.records = {};
  db.records.vax = vax;
  saveUnifiedDb(db);
}
