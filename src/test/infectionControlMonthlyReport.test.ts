import { describe, expect, it } from 'vitest';
import type { ICNDatabase } from '@/lib/database';
import { calculateInfectionControlMonthlyReportData } from '@/components/reports/InfectionControlMonthlyReport';

const buildDb = (): ICNDatabase => ({
  census: { residentsByMrn: {}, meta: { imported_at: null } },
  records: {
    abx: [],
    ip_cases: [
      {
        id: 'carry-active',
        mrn: 'MRN001',
        residentName: 'Carry Active',
        unit: 'A',
        room: '101',
        protocol: 'EBP',
        onsetDate: '2026-01-10',
        status: 'Active',
      },
      {
        id: 'new-feb',
        mrn: 'MRN002',
        residentName: 'New Feb',
        unit: 'A',
        room: '102',
        protocol: 'EBP',
        onsetDate: '2026-02-05',
        status: 'Active',
      },
      {
        id: 'resolved-feb',
        mrn: 'MRN003',
        residentName: 'Resolved Feb',
        unit: 'B',
        room: '201',
        protocol: 'Contact',
        onsetDate: '2026-01-20',
        resolutionDate: '2026-02-10',
        status: 'Resolved',
      },
      {
        id: 'old-resolved',
        mrn: 'MRN004',
        residentName: 'Old Resolved',
        unit: 'B',
        room: '202',
        protocol: 'Droplet',
        onsetDate: '2025-12-01',
        resolutionDate: '2026-01-05',
        status: 'Resolved',
      },
    ],
    vax: [],
    notes: [],
    line_listings: [],
    outbreaks: [],
    contacts: [],
  },
  audit_log: [],
  settings: {} as ICNDatabase['settings'],
});

describe('calculateInfectionControlMonthlyReportData', () => {
  it('calculates carryover, new, active, and resolved counts for the reporting month', () => {
    const data = calculateInfectionControlMonthlyReportData(buildDb(), 1, 2026); // February 2026

    expect(data.newCases).toBe(1);
    expect(data.resolvedCases).toBe(1);
    expect(data.totalCases).toBe(3);
    expect(data.activeCases).toBe(2);
    expect(data.previousMonthTotal).toBe(3);
    expect(data.percentChange).toBe(0);
  });
});
