import { beforeEach, describe, expect, it, vi } from 'vitest';
import { importStaffFromCSVRows } from '@/lib/utils/staffImport';
import { getAllStaff } from '@/lib/stores/staffStore';

const DB_KEY = 'UNIFIED_DB_V1';

describe('importStaffFromCSVRows', () => {
  beforeEach(() => {
    localStorage.clear();
    window.confirm = vi.fn(() => true);
  });

  it('imports staff rows without Payroll No by creating fallback employee IDs and maps new fields', () => {
    const result = importStaffFromCSVRows([
      {
        Name: 'Abraham, Jerryka',
        Position: 'R.N.',
        Center: 'Long Beach',
        Department: 'Nursing',
        'Emp Type': 'APT',
        'Date Hired': '5/16/2023',
      },
    ]);

    expect(result).toEqual({ newCount: 1, skippedExistingCount: 0 });

    const staff = getAllStaff();
    expect(staff).toHaveLength(1);
    expect(staff[0].employeeId).toBe('NAME_ABRAHAM_JERRYKA');
    expect(staff[0].fullName).toBe('Jerryka Abraham');
    expect(staff[0].role).toBe('RN');
    expect(staff[0].center).toBe('Long Beach');
    expect(staff[0].department).toBe('Nursing');
    expect(staff[0].empType).toBe('APT');
    expect(staff[0].hireDate).toBe('2023-05-16');
  });

  it('skips existing staff records and does not overwrite current directory data', () => {
    localStorage.setItem(
      DB_KEY,
      JSON.stringify({
        staff: [
          {
            id: 'staff-1',
            employeeId: 'NAME_ANTOINE_ROLANDE',
            firstName: 'Rolande',
            lastName: 'Antoine',
            fullName: 'Rolande Antoine',
            role: 'RN',
            center: 'Original Center',
            department: 'Original Department',
            empType: 'FT',
            hireDate: '2026-01-01',
            status: 'active',
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      })
    );

    const result = importStaffFromCSVRows([
      {
        Name: 'Antoine, Rolande',
        Position: 'L.P.N.',
        Center: 'Long Beach',
        Department: 'Nursing',
        'Emp Type': 'APT',
        'Date Hired': '2/3/2026',
      },
    ]);

    expect(result).toEqual({ newCount: 0, skippedExistingCount: 1 });

    const staff = getAllStaff();
    expect(staff).toHaveLength(1);
    expect(staff[0].center).toBe('Original Center');
    expect(staff[0].department).toBe('Original Department');
    expect(staff[0].empType).toBe('FT');
    expect(staff[0].hireDate).toBe('2026-01-01');
    expect(staff[0].role).toBe('RN');
  });
});
