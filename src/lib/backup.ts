// Automatic Backup System
// Exports database to JSON file daily

import type { AppDatabase } from './types';
import { format } from 'date-fns';

const BACKUP_KEY_PREFIX = 'icn_backup_';
const LAST_BACKUP_KEY = 'icn_last_backup_date';
const MAX_BACKUP_AGE_DAYS = 30;

export interface BackupMetadata {
  timestamp: string;
  facilityName: string;
  recordCounts: {
    residents: number;
    abt: number;
    ipCases: number;
    vaccinations: number;
    notes: number;
    outbreaks: number;
  };
  version: string;
}

export interface BackupFile {
  metadata: BackupMetadata;
  data: AppDatabase;
}

// Check if backup is due (once per day)
export function isBackupDue(): boolean {
  const lastBackup = localStorage.getItem(LAST_BACKUP_KEY);
  if (!lastBackup) return true;
  
  const today = format(new Date(), 'yyyy-MM-dd');
  return lastBackup !== today;
}

// Create backup metadata
function createMetadata(db: AppDatabase): BackupMetadata {
  return {
    timestamp: new Date().toISOString(),
    facilityName: db.settings?.facilityName || 'Unknown Facility',
    recordCounts: {
      residents: Object.keys(db.census?.residentsByMrn || {}).length,
      abt: db.records?.abx?.length || 0,
      ipCases: db.records?.ip_cases?.length || 0,
      vaccinations: db.records?.vax?.length || 0,
      notes: db.records?.notes?.length || 0,
      outbreaks: db.records?.outbreaks?.length || 0,
    },
    version: '1.0',
  };
}

// Generate backup filename
function getBackupFilename(facilityName: string): string {
  const timestamp = format(new Date(), 'yyyy-MM-dd_HHmmss');
  const safeName = facilityName.replace(/[^a-zA-Z0-9]/g, '_');
  return `sparkle_backup_${safeName}_${timestamp}.json`;
}

// Export database to JSON file
export function exportBackup(db: AppDatabase): void {
  try {
    const backup: BackupFile = {
      metadata: createMetadata(db),
      data: db,
    };
    
    const json = JSON.stringify(backup, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = getBackupFilename(db.settings?.facilityName || 'facility');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    // Update last backup date
    const today = format(new Date(), 'yyyy-MM-dd');
    localStorage.setItem(LAST_BACKUP_KEY, today);
    
    console.log('[Backup] Daily backup exported successfully');
  } catch (error) {
    console.error('[Backup] Failed to export backup:', error);
    throw error;
  }
}

// Import backup from JSON file
export async function importBackup(file: File): Promise<BackupFile> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const backup = JSON.parse(content) as BackupFile;
        
        // Validate backup structure
        if (!backup.metadata || !backup.data) {
          throw new Error('Invalid backup file structure');
        }
        
        console.log('[Backup] Imported backup from', backup.metadata.timestamp);
        resolve(backup);
      } catch (error) {
        reject(new Error(`Failed to parse backup file: ${error}`));
      }
    };
    
    reader.onerror = () => reject(new Error('Failed to read backup file'));
    reader.readAsText(file);
  });
}

// Store backup in localStorage (for quick restore)
export function storeLocalBackup(db: AppDatabase): void {
  try {
    const backup: BackupFile = {
      metadata: createMetadata(db),
      data: db,
    };
    
    const key = `${BACKUP_KEY_PREFIX}${format(new Date(), 'yyyy-MM-dd')}`;
    localStorage.setItem(key, JSON.stringify(backup));
    
    // Clean old backups
    cleanOldBackups();
  } catch (error) {
    console.error('[Backup] Failed to store local backup:', error);
  }
}

// Retrieve local backups
export function getLocalBackups(): BackupFile[] {
  const backups: BackupFile[] = [];
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(BACKUP_KEY_PREFIX)) {
      try {
        const value = localStorage.getItem(key);
        if (value) {
          backups.push(JSON.parse(value));
        }
      } catch (error) {
        console.error(`[Backup] Failed to parse backup ${key}:`, error);
      }
    }
  }
  
  return backups.sort((a, b) => 
    new Date(b.metadata.timestamp).getTime() - new Date(a.metadata.timestamp).getTime()
  );
}

// Clean backups older than MAX_BACKUP_AGE_DAYS
function cleanOldBackups(): void {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - MAX_BACKUP_AGE_DAYS);
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(BACKUP_KEY_PREFIX)) {
      try {
        const value = localStorage.getItem(key);
        if (value) {
          const backup = JSON.parse(value) as BackupFile;
          const backupDate = new Date(backup.metadata.timestamp);
          
          if (backupDate < cutoffDate) {
            localStorage.removeItem(key);
            console.log(`[Backup] Removed old backup from ${backup.metadata.timestamp}`);
          }
        }
      } catch (error) {
        console.error(`[Backup] Error cleaning backup ${key}:`, error);
      }
    }
  }
}

// Auto-backup on app load (if due)
export function initializeAutoBackup(db: AppDatabase): void {
  if (isBackupDue()) {
    console.log('[Backup] Daily backup is due, triggering export...');
    
    // Store local backup immediately
    storeLocalBackup(db);
    
    // Prompt user to download backup
    if (confirm('Daily backup is due. Download backup file now?')) {
      exportBackup(db);
    }
  } else {
    console.log('[Backup] Backup already performed today');
  }
}

// Manual backup trigger
export function triggerManualBackup(db: AppDatabase): void {
  storeLocalBackup(db);
  exportBackup(db);
}

// Get backup summary for display
export function getBackupSummary(): {
  lastBackupDate: string | null;
  localBackupCount: number;
  isDue: boolean;
} {
  const lastBackup = localStorage.getItem(LAST_BACKUP_KEY);
  const localBackups = getLocalBackups();
  
  return {
    lastBackupDate: lastBackup,
    localBackupCount: localBackups.length,
    isDue: isBackupDue(),
  };
}
