import { loadDB, saveDB } from './database';
import { getCurrentUser } from './auth';
import { AuditEntry } from './types';

export interface AuditLog {
  id: string;
  timestamp: string;
  user: string;
  userId: string;
  action: 'create' | 'update' | 'delete';
  entity_type: 'resident' | 'ip_case' | 'abt' | 'vax' | 'note';
  entity_id: string;
  entity_name?: string;
  changes?: Record<string, { old: any; new: any }>;
}

export const createAuditLog = (
  action: AuditLog['action'],
  entityType: AuditLog['entity_type'],
  entityId: string,
  entityName?: string,
  changes?: Record<string, { old: any; new: any }>
): void => {
  const user = getCurrentUser();
  const db = loadDB();

  const entry: AuditEntry = {
    id: `audit_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    action: `${entityType}_${action}`,
    details: `${action} ${entityType}${entityName ? `: ${entityName}` : ''}`,
    entityType: entityType === 'ip_case' ? 'ip' : (entityType === 'note' ? 'notes' : entityType),
    entityId,
    user: user?.displayName || 'System',
    timestamp: new Date().toISOString(),
    before: action === 'update' ? Object.fromEntries(Object.entries(changes || {}).map(([k, v]) => [k, v.old])) : undefined,
    after: action !== 'delete' ? Object.fromEntries(Object.entries(changes || {}).map(([k, v]) => [k, v.new])) : undefined,
    source: 'ui',
  };

  db.audit_log.unshift(entry);
  if (db.audit_log.length > 10000) db.audit_log = db.audit_log.slice(0, 10000);
  saveDB(db);
};

export const detectChanges = (
  oldData: Record<string, any>,
  newData: Record<string, any>
): Record<string, { old: any; new: any }> => {
  const changes: Record<string, { old: any; new: any }> = {};
  Object.keys(newData).forEach((key) => {
    if (oldData[key] !== newData[key]) changes[key] = { old: oldData[key], new: newData[key] };
  });
  return changes;
};

export const exportAuditLogs = (logs: AuditLog[]): string => {
  const headers = ['id', 'timestamp', 'user', 'action', 'entity_type', 'entity_id', 'entity_name', 'changes'];

  const escapeCsv = (value: unknown): string => {
    const stringValue = value == null ? '' : String(value);
    if (/[",\n]/.test(stringValue)) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
  };

  const rows = logs.map((log) => [
    log.id,
    log.timestamp,
    log.user,
    log.action,
    log.entity_type,
    log.entity_id,
    log.entity_name || '',
    log.changes ? JSON.stringify(log.changes) : '',
  ].map(escapeCsv).join(','));

  return [headers.join(','), ...rows].join('\n');
};
