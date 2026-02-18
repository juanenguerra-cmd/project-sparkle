import { describe, it, expect } from 'vitest';
import {
  validateDate,
  validateDateRange,
  validateIPCase,
  validateResident,
  checkDuplicateMRN,
  checkDuplicateIPCase,
  validateABTRecord,
  validateVaxRecord
} from '../validators';

describe('Date Validation', () => {
  it('should reject future dates when allowFuture is false', () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 10);
    const result = validateDate(
      futureDate.toISOString().split('T')[0],
      'Test date',
      { allowFuture: false }
    );
    expect(result).toContain('cannot be in the future');
  });

  it('should accept past dates', () => {
    const pastDate = new Date('2024-01-01');
    const result = validateDate(
      pastDate.toISOString().split('T')[0],
      'Test date'
    );
    expect(result).toBeNull();
  });

  it('should reject invalid date strings', () => {
    const result = validateDate('invalid-date', 'Test date');
    expect(result).toContain('not a valid date');
  });

  it('should validate date ranges correctly', () => {
    const start = '2024-01-01';
    const end = '2023-12-01';
    const result = validateDateRange(start, end);
    expect(result).toContain('cannot be before');
  });
});

describe('IP Case Validation', () => {
  it('should require MRN', () => {
    const invalidCase = {
      residentName: 'Test Patient',
      protocol: 'Isolation',
      onset_date: '2024-01-01'
    };
    const result = validateIPCase(invalidCase as any);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('MRN is required');
  });

  it('should validate complete IP case', () => {
    const validCase = {
      mrn: 'TEST001',
      residentName: 'Test Patient',
      protocol: 'Isolation',
      infection_type: 'MRSA',
      onset_date: '2024-01-01',
      status: 'Active'
    };
    const result = validateIPCase(validCase as any);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should require resolution details for resolved cases', () => {
    const resolvedCase = {
      mrn: 'TEST001',
      residentName: 'Test Patient',
      protocol: 'Isolation',
      infection_type: 'MRSA',
      onset_date: '2024-01-01',
      status: 'Resolved'
    };
    const result = validateIPCase(resolvedCase as any);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('Resolution date'))).toBe(true);
  });
});

describe('Duplicate Detection', () => {
  it('should detect duplicate MRNs', () => {
    const residents = [
      { mrn: 'TEST001', name: 'Test 1' },
      { mrn: 'TEST002', name: 'Test 2' }
    ];
    expect(checkDuplicateMRN('TEST001', residents as any)).toBe(true);
    expect(checkDuplicateMRN('TEST003', residents as any)).toBe(false);
  });

  it('should detect duplicate active IP cases', () => {
    const cases = [
      {
        id: 'case1',
        mrn: 'TEST001',
        infection_type: 'MRSA',
        status: 'Active'
      },
      {
        id: 'case2',
        mrn: 'TEST002',
        infection_type: 'VRE',
        status: 'Active'
      }
    ];

    const duplicate = checkDuplicateIPCase('TEST001', 'MRSA', cases as any);
    expect(duplicate).not.toBeNull();
    expect(duplicate?.id).toBe('case1');

    const noDuplicate = checkDuplicateIPCase('TEST001', 'VRE', cases as any);
    expect(noDuplicate).toBeNull();
  });
});

describe('Resident Validation', () => {
  it('should validate MRN format', () => {
    const resident = {
      mrn: 'AB',
      name: 'Test Patient',
      unit: 'A',
      room: '101',
      dob: '1950-01-01'
    };
    const result = validateResident(resident as any);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('3-32 alphanumeric'))).toBe(true);
  });

  it('should validate complete resident', () => {
    const resident = {
      mrn: 'TEST001',
      name: 'Test Patient',
      unit: 'A',
      room: '101',
      dob: '1950-01-01',
      admitDate: '2024-01-01'
    };
    const result = validateResident(resident as any);
    expect(result.valid).toBe(true);
  });
});


describe('ABT Validation', () => {
  it('should block end date before start date by default', () => {
    const result = validateABTRecord({
      mrn: 'TEST001',
      residentName: 'Test Patient',
      medication: 'Amoxicillin',
      indication: 'UTI',
      startDate: '2024-05-10',
      endDate: '2024-05-01',
      status: 'active'
    } as any);

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('End date cannot be before Start date'))).toBe(true);
  });

  it('should allow end date override for edited ABT records', () => {
    const result = validateABTRecord(
      {
        mrn: 'TEST001',
        residentName: 'Test Patient',
        medication: 'Amoxicillin',
        indication: 'UTI',
        startDate: '2024-05-10',
        endDate: '2024-05-01',
        status: 'active'
      } as any,
      { allowEndDateOverride: true }
    );

    expect(result.valid).toBe(true);
  });
});


describe('VAX Validation', () => {
  it('should allow declined vaccines without a decline reason override', () => {
    const result = validateVaxRecord({
      mrn: 'TEST001',
      residentName: 'Test Patient',
      vaccine: 'Flu',
      status: 'declined',
      dateGiven: '2024-05-10'
    } as any);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});
