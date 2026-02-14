import { describe, it, expect, beforeEach } from 'vitest';
import { login, logout } from '@/lib/auth';
import { loadDB, saveDB } from '@/lib/database';
import { defaultDatabase } from '@/lib/storage';

describe('Complete Workflow Integration Tests', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    saveDB(defaultDatabase() as any);
  });

  describe('Authentication Flow', () => {
    it('should login successfully with valid credentials', () => {
      const user = login('admin', 'admin123');
      expect(user).not.toBeNull();
      expect(user?.username).toBe('admin');
    });

    it('should reject invalid credentials', () => {
      const user = login('admin', 'wrongpassword');
      expect(user).toBeNull();
    });

    it('should maintain session after login', () => {
      login('admin', 'admin123');
      const sessionUser = sessionStorage.getItem('icn_current_user');
      expect(sessionUser).not.toBeNull();
    });

    it('should clear session on logout', () => {
      login('admin', 'admin123');
      logout();
      const sessionUser = sessionStorage.getItem('icn_current_user');
      expect(sessionUser).toBeNull();
    });
  });

  describe('Data Persistence Flow', () => {
    it('should save and load data correctly', () => {
      const db = loadDB();

      const testResident = {
        id: 'resident_test001',
        mrn: 'TEST001',
        name: 'Test Patient',
        unit: 'A',
        room: '101',
        active_on_census: true,
      };

      db.census.residentsByMrn[testResident.mrn] = testResident as any;

      saveDB(db);

      const loadedDb = loadDB();
      const residents = Object.values(loadedDb.census.residentsByMrn);
      expect(residents.length).toBe(1);
      expect(residents[0].mrn).toBe('TEST001');
    });

    it('should encrypt data in localStorage', () => {
      const db = loadDB();
      db.census.residentsByMrn.SECRET001 = {
        id: 'resident_secret001',
        mrn: 'SECRET001',
        name: 'Secret Patient',
        unit: 'A',
        room: '101',
        active_on_census: true,
      } as any;

      saveDB(db);

      const rawData = localStorage.getItem('icn_hub_db_encrypted');
      expect(rawData).not.toBeNull();
      expect(rawData).not.toContain('SECRET001');
    });
  });

  describe('Backup and Recovery Flow', () => {
    it('should create backup and restore correctly', async () => {
      const { createManualBackup, getBackups } = await import('@/lib/backup');

      login('admin', 'admin123');

      const db = loadDB();
      db.census.residentsByMrn.BACKUP001 = {
        id: 'resident_backup001',
        mrn: 'BACKUP001',
        name: 'Backup Test',
        unit: 'A',
        room: '101',
        active_on_census: true,
      } as any;
      saveDB(db);

      const backupId = createManualBackup();

      const db2 = loadDB();
      db2.census.residentsByMrn = {};
      saveDB(db2);

      const emptyDb = loadDB();
      expect(Object.values(emptyDb.census.residentsByMrn).length).toBe(0);

      const backups = getBackups();
      expect(backups.length).toBeGreaterThan(0);
      expect(backups[0].id).toBe(backupId);
    });
  });
});
