import { nowISO } from './parsers';
import type { AuditEntry } from './types';

export type UserRole = 'admin' | 'ip_nurse' | 'don_adon' | 'read_only';
export type ExportProfile = 'internal' | 'surveyor' | 'qapi';

export interface SurveyorRedactionProfile {
  hideMRN: boolean;
  hideDOB: boolean;
  hidePhysician: boolean;
  hideNotes: boolean;
  initialsOnly: boolean;
}

export const DEFAULT_SURVEYOR_REDACTION_PROFILE: SurveyorRedactionProfile = {
  hideMRN: true,
  hideDOB: true,
  hidePhysician: true,
  hideNotes: true,
  initialsOnly: true,
};

export const canEditForRole = (role: UserRole): boolean => role !== 'read_only';

const toInitials = (name?: string): string => {
  if (!name) return '';
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => `${token[0]?.toUpperCase() ?? ''}.`)
    .join(' ');
};

export const redactExportRow = (
  row: Record<string, string | number | boolean | undefined>,
  profile: ExportProfile,
  redaction: SurveyorRedactionProfile = DEFAULT_SURVEYOR_REDACTION_PROFILE,
): Record<string, string | number | boolean | undefined> => {
  if (profile === 'internal') return row;

  const next = { ...row };

  if (profile === 'surveyor') {
    if (redaction.hideMRN) next.mrn = 'REDACTED';
    if (redaction.hideDOB) next.dob = 'REDACTED';
    if (redaction.hidePhysician) next.physician = 'REDACTED';
    if (redaction.hideNotes) next.notes = 'REDACTED';
    if (redaction.initialsOnly && typeof next.name === 'string') next.name = toInitials(next.name);
  }

  if (profile === 'qapi' && typeof next.name === 'string') {
    next.name = toInitials(next.name);
  }

  return next;
};

export const createExportAuditEntry = (
  entityType: AuditEntry['entityType'],
  profile: ExportProfile,
  filtersSummary: string,
  user: string,
): AuditEntry => ({
  id: `audit_export_${Date.now()}`,
  action: 'export_generated',
  details: `profile=${profile}; filters=${filtersSummary}`,
  entityType,
  timestamp: nowISO(),
  user,
  source: 'ui',
});
