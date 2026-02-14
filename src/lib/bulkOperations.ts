import {
  validateIPCase,
  validateVaxRecord,
  type ValidationResult,
} from './validators';
import { loadDB, saveDB } from './database';
import { createAuditLog } from './audit';
import { type IPCase, type VaxRecord } from './types';
import { requirePermission } from './auth';

export interface BulkOperationResult {
  success: boolean;
  successCount: number;
  failedCount: number;
  errors: Array<{ index: number; item: unknown; errors: string[] }>;
  createdIds: string[];
}

export const validateBulkIPCases = (cases: Partial<IPCase>[]): ValidationResult => {
  const allErrors: string[] = [];
  cases.forEach((ipCase, idx) => {
    const validation = validateIPCase(ipCase);
    if (!validation.valid) validation.errors.forEach((err) => allErrors.push(`Case ${idx + 1}: ${err}`));
  });

  const keys = cases.map((item) => `${item.mrn}:${item.organism}`);
  const duplicates = keys.filter((item, idx) => keys.indexOf(item) !== idx);
  if (duplicates.length > 0) allErrors.push(`Duplicate cases in batch: ${duplicates.join(', ')}`);

  return { valid: allErrors.length === 0, errors: allErrors };
};

export const validateBulkVaxRecords = (records: Partial<VaxRecord>[]): ValidationResult => {
  const allErrors: string[] = [];
  records.forEach((record, idx) => {
    const validation = validateVaxRecord(record);
    if (!validation.valid) {
      validation.errors.forEach((err) => allErrors.push(`Vaccine ${idx + 1} (${record.vaccine || 'unknown'}): ${err}`));
    }
  });

  const keys = records.map((item) => `${item.mrn}:${item.vaccine}:${item.dateGiven || item.date_given || ''}`);
  const duplicates = keys.filter((item, idx) => keys.indexOf(item) !== idx);
  if (duplicates.length > 0) allErrors.push(`Duplicate vaccines in batch: ${duplicates.join(', ')}`);

  return { valid: allErrors.length === 0, errors: allErrors };
};

export const bulkCreateIPCases = (cases: Partial<IPCase>[]): BulkOperationResult => {
  requirePermission('create_ip_cases');
  const validation = validateBulkIPCases(cases);
  if (!validation.valid) {
    return { success: false, successCount: 0, failedCount: cases.length, errors: [{ index: 0, item: null, errors: validation.errors }], createdIds: [] };
  }

  const db = loadDB();
  const originalDb = JSON.parse(JSON.stringify(db));
  const createdIds: string[] = [];

  try {
    cases.forEach((item, idx) => {
      const record: IPCase = {
        id: `ipcase_${Date.now()}_${idx}_${Math.random().toString(16).slice(2)}`,
        ...item,
        createdAt: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as IPCase;

      db.records.ip_cases.unshift(record);
      createdIds.push(record.id);
      createAuditLog('create', 'ip_case', record.id, record.residentName);
    });

    saveDB(db);
    return { success: true, successCount: cases.length, failedCount: 0, errors: [], createdIds };
  } catch (error) {
    saveDB(originalDb);
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      successCount: 0,
      failedCount: cases.length,
      errors: [{ index: 0, item: null, errors: [`Transaction failed: ${message}`] }],
      createdIds: [],
    };
  }
};

export const bulkCreateVaxRecords = (records: Partial<VaxRecord>[]): BulkOperationResult => {
  requirePermission('create_vax');
  const validation = validateBulkVaxRecords(records);
  if (!validation.valid) {
    return { success: false, successCount: 0, failedCount: records.length, errors: [{ index: 0, item: null, errors: validation.errors }], createdIds: [] };
  }

  const db = loadDB();
  const originalDb = JSON.parse(JSON.stringify(db));
  const createdIds: string[] = [];

  try {
    records.forEach((item, idx) => {
      const record: VaxRecord = {
        id: `vax_${Date.now()}_${idx}_${Math.random().toString(16).slice(2)}`,
        ...item,
        createdAt: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as VaxRecord;

      db.records.vax.unshift(record);
      createdIds.push(record.id);
      createAuditLog('create', 'vax', record.id, record.residentName);
    });

    saveDB(db);
    return { success: true, successCount: records.length, failedCount: 0, errors: [], createdIds };
  } catch (error) {
    saveDB(originalDb);
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      successCount: 0,
      failedCount: records.length,
      errors: [{ index: 0, item: null, errors: [`Transaction failed: ${message}`] }],
      createdIds: [],
    };
  }
};

export const bulkUpdateIPCaseStatus = (
  caseIds: string[],
  newStatus: IPCase['status'],
  resolutionDate?: string,
  resolutionReason?: string,
): BulkOperationResult => {
  requirePermission('edit_ip_cases');
  const db = loadDB();
  const originalDb = JSON.parse(JSON.stringify(db));

  try {
    caseIds.forEach((caseId) => {
      const index = db.records.ip_cases.findIndex((item) => item.id === caseId);
      if (index < 0) return;
      const record = db.records.ip_cases[index];
      const oldStatus = record.status;
      record.status = newStatus;
      if (resolutionDate) record.resolution_date = resolutionDate;
      if (resolutionReason) record.resolution_reason = resolutionReason;
      record.updated_at = new Date().toISOString();
      createAuditLog('update', 'ip_case', caseId, record.residentName, { status: { old: oldStatus, new: newStatus } });
    });

    saveDB(db);
    return { success: true, successCount: caseIds.length, failedCount: 0, errors: [], createdIds: [] };
  } catch (error) {
    saveDB(originalDb);
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      successCount: 0,
      failedCount: caseIds.length,
      errors: [{ index: 0, item: null, errors: [`Bulk update failed: ${message}`] }],
      createdIds: [],
    };
  }
};

export const bulkDeleteIPCases = (caseIds: string[]): BulkOperationResult => {
  requirePermission('delete_ip_cases');
  const db = loadDB();
  const originalDb = JSON.parse(JSON.stringify(db));

  try {
    caseIds.forEach((caseId) => {
      const index = db.records.ip_cases.findIndex((item) => item.id === caseId);
      if (index < 0) return;
      const deleted = db.records.ip_cases[index];
      createAuditLog('delete', 'ip_case', caseId, deleted.residentName);
      db.records.ip_cases.splice(index, 1);
    });

    saveDB(db);
    return { success: true, successCount: caseIds.length, failedCount: 0, errors: [], createdIds: [] };
  } catch (error) {
    saveDB(originalDb);
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      successCount: 0,
      failedCount: caseIds.length,
      errors: [{ index: 0, item: null, errors: [`Bulk delete failed: ${message}`] }],
      createdIds: [],
    };
  }
};
