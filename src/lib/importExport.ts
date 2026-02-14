import {
  validateIPCase,
  validateABTRecord,
  validateVaxRecord,
  validateResident,
  formatValidationErrors,
} from './validators';
import { loadDB, saveDB, type ICNDatabase } from './database';
import { requirePermission } from './auth';
import { createAutomaticBackup } from './backup';
import { toast as sonnerToast } from 'sonner';

export interface ImportResult {
  success: boolean;
  errors: string[];
  warnings: string[];
  imported: {
    residents: number;
    ip_cases: number;
    abx: number;
    vax: number;
    notes: number;
  };
}

export const exportDatabase = (): void => {
  requirePermission('manage_settings');
  const db = loadDB();
  const json = JSON.stringify(db, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `sparkle_export_${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  sonnerToast.success('Database Exported', { description: 'Full database exported to file' });
};

export const exportEntity = (entityType: 'residents' | 'ip_cases' | 'abx' | 'vax' | 'notes'): void => {
  requirePermission('view_reports');
  const db = loadDB();
  const dataMap = {
    residents: Object.values(db.census.residentsByMrn),
    ip_cases: db.records.ip_cases,
    abx: db.records.abx,
    vax: db.records.vax,
    notes: db.records.notes,
  };
  const data = dataMap[entityType];
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${entityType}_export_${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  sonnerToast.success(`${entityType} Exported`, { description: `${data.length} records exported` });
};

const toCsv = (headers: string[], rows: unknown[][]): string =>
  [headers, ...rows].map((row) => row.map((cell) => `"${String(cell ?? '')}"`).join(',')).join('\n');

export const exportToCSV = (entityType: 'residents' | 'ip_cases' | 'abx' | 'vax'): void => {
  requirePermission('view_reports');
  const db = loadDB();

  const csvMap: Record<typeof entityType, { filename: string; csv: string }> = {
    residents: {
      filename: 'residents',
      csv: toCsv(
        ['MRN', 'Name', 'DOB', 'Gender', 'Unit', 'Room', 'Admit Date', 'Status'],
        Object.values(db.census.residentsByMrn).map((r) => [r.mrn, r.name, r.dob, r.sex, r.unit, r.room, r.admitDate, r.dischargeDate ? 'discharged' : 'active']),
      ),
    },
    ip_cases: {
      filename: 'ip_cases',
      csv: toCsv(
        ['ID', 'MRN', 'Resident Name', 'Precaution Type', 'Organism', 'Onset Date', 'Resolution Date', 'Status'],
        db.records.ip_cases.map((c) => [c.id, c.mrn, c.residentName, c.precaution_type, c.organism, c.onset_date, c.resolution_date, c.status]),
      ),
    },
    abx: {
      filename: 'abx',
      csv: toCsv(
        ['ID', 'MRN', 'Resident Name', 'Medication', 'Indication', 'Start Date', 'End Date', 'Status'],
        db.records.abx.map((a) => [a.id, a.mrn, a.residentName, a.medication, a.indication, a.startDate, a.endDate, a.status]),
      ),
    },
    vax: {
      filename: 'vax',
      csv: toCsv(
        ['ID', 'MRN', 'Resident Name', 'Vaccine', 'Status', 'Date Given', 'Lot', 'Site', 'Nurse'],
        db.records.vax.map((v) => [v.id, v.mrn, v.residentName, v.vaccine, v.status, v.dateGiven || v.date_given, v.lot, v.site, v.administered_by]),
      ),
    },
  };

  const result = csvMap[entityType];
  const blob = new Blob([result.csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${result.filename}_export_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  sonnerToast.success('CSV Exported');
};

export const importDatabase = async (jsonString: string): Promise<ImportResult> => {
  requirePermission('manage_settings');
  const result: ImportResult = {
    success: false,
    errors: [],
    warnings: [],
    imported: { residents: 0, ip_cases: 0, abx: 0, vax: 0, notes: 0 },
  };

  try {
    const imported = JSON.parse(jsonString) as ICNDatabase;
    if (!imported.records || !imported.census || !imported.settings) {
      result.errors.push('Invalid database structure');
      return result;
    }

    const residents = Object.values(imported.census.residentsByMrn || {});

    residents.forEach((resident, idx) => {
      const validation = validateResident(resident);
      if (!validation.valid) result.errors.push(`Resident ${idx + 1} (${resident.name}): ${formatValidationErrors(validation.errors)}`);
    });
    imported.records.ip_cases.forEach((ipCase, idx) => {
      const validation = validateIPCase(ipCase);
      if (!validation.valid) result.errors.push(`IP Case ${idx + 1}: ${formatValidationErrors(validation.errors)}`);
    });
    imported.records.abx.forEach((abt, idx) => {
      const validation = validateABTRecord(abt);
      if (!validation.valid) result.errors.push(`ABT ${idx + 1}: ${formatValidationErrors(validation.errors)}`);
    });
    imported.records.vax.forEach((vax, idx) => {
      const validation = validateVaxRecord(vax);
      if (!validation.valid) result.errors.push(`VAX ${idx + 1}: ${formatValidationErrors(validation.errors)}`);
    });

    const mrnSet = new Set(residents.map((resident) => resident.mrn));
    imported.records.ip_cases.forEach((ipCase, idx) => {
      if (!mrnSet.has(ipCase.mrn)) result.warnings.push(`IP Case ${idx + 1}: Resident MRN ${ipCase.mrn} not found in census`);
    });
    imported.records.abx.forEach((abt, idx) => {
      if (!mrnSet.has(abt.mrn)) result.warnings.push(`ABT ${idx + 1}: Resident MRN ${abt.mrn} not found in census`);
    });
    imported.records.vax.forEach((vax, idx) => {
      if (!mrnSet.has(vax.mrn)) result.warnings.push(`VAX ${idx + 1}: Resident MRN ${vax.mrn} not found in census`);
    });

    if (result.errors.length > 0) return result;

    createAutomaticBackup('pre-import');
    saveDB(imported);

    result.success = true;
    result.imported = {
      residents: residents.length,
      ip_cases: imported.records.ip_cases.length,
      abx: imported.records.abx.length,
      vax: imported.records.vax.length,
      notes: imported.records.notes.length,
    };

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    result.errors.push(`Import failed: ${message}`);
    return result;
  }
};
