import type { StaffMember, StaffRole } from '@/lib/types/staff';
import { getAllStaff, saveStaffList } from '@/lib/stores/staffStore';
import { linkVaxRecordsToStaff } from '@/lib/utils/staffVaccinationLinker';

export interface RawStaffRow {
  Name?: string;
  Position?: string;
  'Payroll No.'?: string;
  Center?: string;
  Department?: string;
  'Emp Type'?: string;
  'Date Hired'?: string;
  [key: string]: string | undefined;
}

const STAFF_ROLE_OPTIONS: StaffRole[] = ['RN', 'LPN', 'CNA', 'MD', 'NP', 'PA', 'Therapy', 'EVS', 'Admin', 'Other'];

function toISODate(value: unknown): string | undefined {
  if (!value) return undefined;
  const s = String(value).trim();
  if (!s) return undefined;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString().substring(0, 10);
}

function getCaseInsensitiveValue(raw: RawStaffRow, key: string): string {
  const direct = raw[key];
  if (typeof direct === 'string') return direct;
  const matchedKey = Object.keys(raw).find((k) => k.toLowerCase() === key.toLowerCase());
  return matchedKey ? String(raw[matchedKey] || '') : '';
}

function normalizeStaffRow(raw: RawStaffRow) {
  const employeeId = getCaseInsensitiveValue(raw, 'Payroll No.').toString().trim();
  if (!employeeId) return null;

  const name = getCaseInsensitiveValue(raw, 'Name').trim();
  let firstName = '';
  let lastName = '';

  if (name.includes(',')) {
    const [last, first] = name.split(',');
    lastName = last.trim();
    firstName = (first || '').trim();
  } else {
    const parts = name.split(' ').filter(Boolean);
    firstName = parts.slice(0, -1).join(' ').trim();
    lastName = parts.slice(-1).join(' ').trim();
  }

  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();

  const rawPosition = getCaseInsensitiveValue(raw, 'Position').trim();
  const position = rawPosition.toUpperCase();
  let role: StaffRole | string = 'Other';

  if (position.includes('R.N') || /\bRN\b/.test(position)) role = 'RN';
  else if (position.includes('L.P.N') || /\bLPN\b/.test(position)) role = 'LPN';
  else if (position.includes('C.N.A') || /\bCNA\b/.test(position) || position.includes('AIDE')) role = 'CNA';
  else if (position.includes('THERAP')) role = 'Therapy';
  else if (position.includes('EVS') || position.includes('HOUSEKEEP')) role = 'EVS';
  else if (position.includes('PHYSICIAN') || /\bMD\b/.test(position)) role = 'MD';
  else if (/\bNP\b/.test(position)) role = 'NP';
  else if (/\bPA\b/.test(position)) role = 'PA';
  else if (position.includes('ADMIN')) role = 'Admin';
  else if (rawPosition) role = rawPosition;

  const department = getCaseInsensitiveValue(raw, 'Department').trim() || undefined;
  const hireDate = toISODate(getCaseInsensitiveValue(raw, 'Date Hired'));
  const empType = getCaseInsensitiveValue(raw, 'Emp Type').trim();

  const normalizedRole = STAFF_ROLE_OPTIONS.includes(role as StaffRole) ? role : rawPosition || role;

  return {
    employeeId,
    firstName,
    lastName,
    fullName,
    role: normalizedRole,
    department,
    hireDate,
    empType,
  };
}

export function importStaffFromCSVRows(rows: RawStaffRow[]) {
  const existing = getAllStaff();
  const existingByEmployeeId = new Map(existing.map((s) => [s.employeeId, s]));

  const newIds = new Set<string>();
  let newCount = 0;
  let updatedCount = 0;

  for (const row of rows) {
    const normalized = normalizeStaffRow(row);
    if (!normalized) continue;

    newIds.add(normalized.employeeId);
    const now = new Date().toISOString();

    const existingStaff = existingByEmployeeId.get(normalized.employeeId);
    if (existingStaff) {
      Object.assign(existingStaff, {
        ...existingStaff,
        firstName: normalized.firstName,
        lastName: normalized.lastName,
        fullName: normalized.fullName,
        department: normalized.department,
        role: normalized.role,
        hireDate: normalized.hireDate || existingStaff.hireDate,
        status: 'active',
        notes: normalized.empType ? `EmpType: ${normalized.empType}` : existingStaff.notes,
        updatedAt: now,
      });
      updatedCount += 1;
    } else {
      const newStaff: StaffMember = {
        id: crypto.randomUUID(),
        employeeId: normalized.employeeId,
        firstName: normalized.firstName,
        lastName: normalized.lastName,
        fullName: normalized.fullName,
        department: normalized.department,
        role: normalized.role,
        status: 'active',
        hireDate: normalized.hireDate,
        notes: normalized.empType ? `EmpType: ${normalized.empType}` : '',
        createdAt: now,
        updatedAt: now,
      };
      existing.push(newStaff);
      newCount += 1;
    }
  }

  let inactivatedCount = 0;
  const nowISO = new Date().toISOString();

  for (const staff of existing) {
    if (!newIds.has(staff.employeeId) && staff.status !== 'inactive') {
      staff.status = 'inactive';
      staff.updatedAt = nowISO;
      inactivatedCount += 1;
    }
  }

  const ok = window.confirm(
    `Staff import summary:\n\n` +
      `${newCount} new staff will be added (active)\n` +
      `${updatedCount} existing staff will be updated (active)\n` +
      `${inactivatedCount} staff will be marked as inactive (not in new list)\n\n` +
      'Continue?'
  );

  if (!ok) return;

  saveStaffList(existing);
  linkVaxRecordsToStaff();

  return { newCount, updatedCount, inactivatedCount };
}
