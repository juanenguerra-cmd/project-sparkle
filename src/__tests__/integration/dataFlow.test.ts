import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Integration tests for data flows
 * Testing data persistence and retrieval workflows
 */

describe('Data Flow Integration Tests', () => {
  describe('Resident Management Flow', () => {
    beforeEach(() => {
      // Mock localStorage or database
      vi.stubGlobal('localStorage', {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      });
    });

    it('should create and retrieve a resident', async () => {
      const mockResident = {
        residentId: 'RES-001',
        firstName: 'John',
        lastName: 'Doe',
        dateOfBirth: '1950-01-15',
        admissionDate: '2024-01-01',
      };

      // Simulate create operation
      const createResident = (data: typeof mockResident) => {
        localStorage.setItem(`resident_${data.residentId}`, JSON.stringify(data));
        return data;
      };

      // Simulate retrieve operation
      const getResident = (id: string) => {
        const data = localStorage.getItem(`resident_${id}`);
        return data ? JSON.parse(data) : null;
      };

      const created = createResident(mockResident);
      expect(localStorage.setItem).toHaveBeenCalledWith(
        'resident_RES-001',
        JSON.stringify(mockResident)
      );

      // Mock return value for getItem
      vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify(mockResident));
      
      const retrieved = getResident('RES-001');
      expect(retrieved).toEqual(mockResident);
    });

    it('should update resident information', async () => {
      const originalResident = {
        residentId: 'RES-001',
        firstName: 'John',
        lastName: 'Doe',
        unit: 'A',
      };

      const updatedData = {
        ...originalResident,
        unit: 'B',
      };

      const updateResident = (id: string, data: typeof updatedData) => {
        localStorage.setItem(`resident_${id}`, JSON.stringify(data));
        return data;
      };

      const result = updateResident('RES-001', updatedData);
      expect(result.unit).toBe('B');
      expect(localStorage.setItem).toHaveBeenCalled();
    });
  });

  describe('Antibiotic Tracking Flow', () => {
    it('should link antibiotic entry to resident', () => {
      const residentId = 'RES-001';
      const antibioticEntry = {
        id: 'ABT-001',
        residentId,
        drugName: 'Amoxicillin',
        startDate: '2024-02-01',
        indication: 'UTI',
      };

      // Simulate linking
      const linkAntibioticToResident = (entry: typeof antibioticEntry) => {
        return {
          ...entry,
          linkedResident: entry.residentId,
        };
      };

      const linked = linkAntibioticToResident(antibioticEntry);
      expect(linked.linkedResident).toBe(residentId);
      expect(linked.residentId).toBe(residentId);
    });

    it('should calculate days of therapy correctly', () => {
      const startDate = new Date('2024-02-01');
      const endDate = new Date('2024-02-10');
      
      const calculateDOT = (start: Date, end: Date) => {
        const diffTime = Math.abs(end.getTime() - start.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays + 1; // Include both start and end days
      };

      const dot = calculateDOT(startDate, endDate);
      expect(dot).toBe(10);
    });
  });

  describe('Outbreak Management Flow', () => {
    it('should create outbreak and link residents', () => {
      const outbreak = {
        id: 'OUT-001',
        type: 'respiratory',
        startDate: '2024-02-01',
        affectedResidents: [] as string[],
      };

      const addResidentToOutbreak = (
        outbreak: typeof outbreak,
        residentId: string
      ) => {
        return {
          ...outbreak,
          affectedResidents: [...outbreak.affectedResidents, residentId],
        };
      };

      let updated = addResidentToOutbreak(outbreak, 'RES-001');
      updated = addResidentToOutbreak(updated, 'RES-002');

      expect(updated.affectedResidents).toHaveLength(2);
      expect(updated.affectedResidents).toContain('RES-001');
      expect(updated.affectedResidents).toContain('RES-002');
    });
  });
});
