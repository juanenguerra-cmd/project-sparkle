import { loadDB, saveDB, type ICNDatabase } from './database';
import { encryptObject, decryptObject } from './encryption';
import { requirePermission, getCurrentUser } from './auth';
import { toast as sonnerToast } from 'sonner';

export interface Backup {
  id: string;
  timestamp: string;
  createdBy: string;
  type: 'automatic' | 'manual' | 'pre-import' | 'pre-archive';
  version: string;
  recordCount: {
    residents: number;
    ip_cases: number;
    abx: number;
    vax: number;
    notes: number;
  };
  size: number;
  data: ICNDatabase;
}

const MAX_BACKUPS = 10;
const AUTO_BACKUP_INTERVAL = 10;

const getResidentCount = (db: ICNDatabase): number => Object.keys(db.census.residentsByMrn || {}).length;

const buildBackup = (type: Backup['type'], createdBy: string): Backup => {
  const db = loadDB();
  return {
    id: `backup_${type}_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    timestamp: new Date().toISOString(),
    createdBy,
    type,
    version: String(db.meta?.schemaVersion || '1.0.0'),
    recordCount: {
      residents: getResidentCount(db),
      ip_cases: db.records.ip_cases.length,
      abx: db.records.abx.length,
      vax: db.records.vax.length,
      notes: db.records.notes.length,
    },
    size: JSON.stringify(db).length,
    data: db,
  };
};

const saveBackup = (backup: Backup): void => {
  const backups = getBackups();
  backups.unshift(backup);
  if (backups.length > MAX_BACKUPS) backups.splice(MAX_BACKUPS);
  localStorage.setItem('icn_backups', encryptObject(backups));
};

export const createManualBackup = (): string => {
  requirePermission('manage_settings');
  const user = getCurrentUser();
  const backup = buildBackup('manual', user?.displayName || 'Unknown');
  saveBackup(backup);
  sonnerToast.success('Backup Created', {
    description: `Backup created at ${new Date(backup.timestamp).toLocaleString()}`,
  });
  return backup.id;
};

export const createAutomaticBackup = (type: Backup['type'] = 'automatic'): void => {
  try {
    const user = getCurrentUser();
    saveBackup(buildBackup(type, user?.displayName || 'System'));
  } catch (error) {
    console.error('Failed to create automatic backup:', error);
  }
};

export const getBackups = (): Backup[] => {
  try {
    const encrypted = localStorage.getItem('icn_backups');
    if (!encrypted) return [];
    return decryptObject<Backup[]>(encrypted);
  } catch (error) {
    console.error('Failed to load backups:', error);
    return [];
  }
};

export const getBackupById = (backupId: string): Backup | null =>
  getBackups().find((backup) => backup.id === backupId) || null;

export const listBackups = (): Array<{
  id: string;
  timestamp: string;
  createdBy: string;
  type: string;
  totalRecords: number;
  sizeMB: number;
}> => getBackups().map((backup) => ({
  id: backup.id,
  timestamp: backup.timestamp,
  createdBy: backup.createdBy,
  type: backup.type,
  totalRecords: Object.values(backup.recordCount).reduce((a, b) => a + b, 0),
  sizeMB: backup.size / 1024 / 1024,
}));

export const restoreFromBackup = (backupId: string): void => {
  requirePermission('manage_settings');
  const backup = getBackupById(backupId);
  if (!backup) throw new Error('Backup not found');

  createAutomaticBackup('pre-import');
  saveDB(backup.data);

  sonnerToast.success('Backup Restored', {
    description: `Restored from ${new Date(backup.timestamp).toLocaleString()}`,
    duration: 5000,
  });

  setTimeout(() => window.location.reload(), 1000);
};

export const deleteBackup = (backupId: string): void => {
  requirePermission('manage_settings');
  const backups = getBackups();
  const filtered = backups.filter((backup) => backup.id !== backupId);
  if (filtered.length === backups.length) throw new Error('Backup not found');
  localStorage.setItem('icn_backups', encryptObject(filtered));
  sonnerToast.success('Backup Deleted');
};

export const exportBackupToFile = (backupId: string): void => {
  requirePermission('manage_settings');
  const backup = getBackupById(backupId);
  if (!backup) throw new Error('Backup not found');

  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `sparkle_backup_${new Date(backup.timestamp).toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);

  sonnerToast.success('Backup Exported', { description: 'Backup file downloaded' });
};

export const importBackupFromFile = (fileContent: string): void => {
  requirePermission('manage_settings');

  try {
    const backup: Backup = JSON.parse(fileContent);
    if (!backup.data || !backup.timestamp || !backup.recordCount) {
      throw new Error('Invalid backup file format');
    }
    saveBackup(backup);
    sonnerToast.success('Backup Imported', {
      description: 'Backup added to backup list',
      action: { label: 'Restore Now', onClick: () => restoreFromBackup(backup.id) },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to import backup: ${message}`);
  }
};

let saveCounter = 0;

export const checkAutoBackup = (): void => {
  saveCounter += 1;
  if (saveCounter >= AUTO_BACKUP_INTERVAL) {
    createAutomaticBackup();
    saveCounter = 0;
  }
};

export const getBackupStats = (): {
  totalBackups: number;
  totalSizeMB: number;
  oldestBackup: string;
  newestBackup: string;
} => {
  const backups = getBackups();
  if (backups.length === 0) {
    return { totalBackups: 0, totalSizeMB: 0, oldestBackup: 'N/A', newestBackup: 'N/A' };
  }

  const totalSizeMB = backups.reduce((sum, backup) => sum + backup.size / 1024 / 1024, 0);
  const sorted = [...backups].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  return {
    totalBackups: backups.length,
    totalSizeMB: Number(totalSizeMB.toFixed(2)),
    oldestBackup: new Date(sorted[0].timestamp).toLocaleString(),
    newestBackup: new Date(sorted[sorted.length - 1].timestamp).toLocaleString(),
  };
};
