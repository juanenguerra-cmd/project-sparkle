import { describe, it, expect } from 'vitest';
import { z } from 'zod';

/**
 * Unit tests for data validation schemas
 * Testing Zod schemas for form validation
 */

describe('Data Validation', () => {
  describe('Resident Data Validation', () => {
    const residentSchema = z.object({
      residentId: z.string().min(1, 'Resident ID is required'),
      mrn: z.string().optional(),
      firstName: z.string().min(1, 'First name is required'),
      lastName: z.string().min(1, 'Last name is required'),
      dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
      admissionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
    });

    it('should validate correct resident data', () => {
      const validData = {
        residentId: 'RES-001',
        mrn: 'MRN-12345',
        firstName: 'John',
        lastName: 'Doe',
        dateOfBirth: '1950-01-15',
        admissionDate: '2024-01-01',
      };

      const result = residentSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject missing required fields', () => {
      const invalidData = {
        residentId: '',
        firstName: 'John',
        lastName: '',
        dateOfBirth: '1950-01-15',
        admissionDate: '2024-01-01',
      };

      const result = residentSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues).toHaveLength(2);
      }
    });

    it('should reject invalid date formats', () => {
      const invalidData = {
        residentId: 'RES-001',
        firstName: 'John',
        lastName: 'Doe',
        dateOfBirth: '01/15/1950',
        admissionDate: '2024-01-01',
      };

      const result = residentSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('Antibiotic Entry Validation', () => {
    const antibioticSchema = z.object({
      residentId: z.string().min(1),
      drugName: z.string().min(1, 'Drug name is required'),
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      indication: z.string().min(1, 'Indication is required'),
      route: z.enum(['oral', 'iv', 'im', 'topical', 'other']),
    });

    it('should validate antibiotic entry with all fields', () => {
      const validData = {
        residentId: 'RES-001',
        drugName: 'Amoxicillin',
        startDate: '2024-02-01',
        endDate: '2024-02-10',
        indication: 'UTI',
        route: 'oral' as const,
      };

      const result = antibioticSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject invalid route', () => {
      const invalidData = {
        residentId: 'RES-001',
        drugName: 'Amoxicillin',
        startDate: '2024-02-01',
        indication: 'UTI',
        route: 'injection',
      };

      const result = antibioticSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });
});
