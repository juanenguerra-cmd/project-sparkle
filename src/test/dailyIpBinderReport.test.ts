import { describe, expect, it } from 'vitest';
import { getDailyIpBinderData } from '@/lib/reports/useDailyIpBinderData';
import { generateDailyIpBinderReport } from '@/lib/reportGenerators';
import type { ICNDatabase } from '@/lib/database';

const createDb = (): ICNDatabase => ({
  census: {
    residentsByMrn: {
      '100': {
        mrn: '100',
        name: 'DOE, JOHN',
        room: '101',
        unit: 'Unit A',
        active_on_census: true,
        admitDate: '2026-03-09',
      },
      '200': {
        mrn: '200',
        name: 'SMITH, JANE',
        room: '201',
        unit: 'Unit B',
        active_on_census: true,
      },
    },
    meta: { imported_at: null },
  },
  records: {
    abx: [
      {
        id: 'abx-1',
        mrn: '100',
        medication: 'Oseltamivir',
        indication: 'Outbreak prophylaxis',
        status: 'active',
        unit: 'Unit A',
        room: '101',
      },
    ],
    ip_cases: [
      {
        id: 'ip-1',
        mrn: '100',
        residentName: 'DOE, JOHN',
        unit: 'Unit A',
        room: '101',
        protocol: 'Isolation',
        status: 'Active',
        onsetDate: '2026-03-10',
        suspectedOrConfirmedOrganism: 'MRSA',
      },
      {
        id: 'ip-2',
        mrn: '200',
        residentName: 'SMITH, JANE',
        unit: 'Unit B',
        room: '201',
        protocol: 'Isolation',
        status: 'Active',
        onsetDate: '2026-03-10',
      },
    ],
    vax: [
      {
        id: 'vax-1',
        mrn: '100',
        residentName: 'DOE, JOHN',
        unit: 'Unit A',
        room: '101',
        vaccine: 'Influenza',
        status: 'declined',
        dateDeclined: '2026-03-10',
      } as any,
    ],
    notes: [],
    line_listings: [
      {
        id: 'line-1',
        outbreakId: 'out-1',
        mrn: '100',
        residentName: 'DOE, JOHN',
        room: '101',
        onsetDate: '2026-03-10',
      },
    ],
    outbreaks: [
      {
        id: 'out-1',
        name: 'Flu Cluster',
        type: 'Influenza',
        status: 'active',
        affectedUnits: ['Unit A'],
        startDate: '2026-03-08',
      },
    ],
    contacts: [],
  },
  audit_log: [],
  settings: {
    darkMode: false,
    compactMode: false,
    autoSave: true,
    alertsEnabled: true,
    reminderInterval: 24,
    exportFormat: 'pdf',
    defaultUnit: 'all',
    last_import_at: '',
    census_exclude_names: [],
    auto_close_on_census_drop: false,
    auto_close_grace_days: 0,
  },
});

describe('daily ip binder data', () => {
  it('filters data to selected unit and date and resolves declined vaccine date', () => {
    const db = createDb();
    const result = getDailyIpBinderData(db, { date: '2026-03-10', unitId: 'Unit A' });

    expect(result.unit.name).toBe('Unit A');
    expect(result.census).toHaveLength(1);
    expect(result.infections).toHaveLength(1);
    expect(result.infections[0].residentName).toBe('DOE, JOHN');
    expect(result.vaccines[0].declinedDate).toBe('2026-03-10');
    expect(result.outbreaks).toHaveLength(1);
    expect(result.outbreakCases).toHaveLength(1);
    expect(result.prophylaxis).toHaveLength(1);
  });

  it('generates all 10 report sections for the binder export payload', () => {
    const db = createDb();
    const report = generateDailyIpBinderReport(db, '2026-03-10', 'Unit A');

    expect(report.reportType).toBe('daily-ip-binder');
    expect(report.sections).toHaveLength(10);
    expect(report.sections?.[0].title).toBe('1. Census & Risk Overview');
    expect(report.sections?.[9].title).toBe('10. Action Items & IP Notes');
  });

  it('handles malformed outbreak affectedUnits without throwing', () => {
    const db = createDb();
    const malformedOutbreak = {
      id: 'out-2',
      name: 'Malformed outbreak',
      type: 'Influenza',
      status: 'active',
      affectedUnits: undefined,
      startDate: '2026-03-10',
    } as unknown as (typeof db.records.outbreaks)[number];

    db.records.outbreaks.push(malformedOutbreak);

    expect(() => getDailyIpBinderData(db, { date: '2026-03-10', unitId: 'all' })).not.toThrow();
  });

  it('falls back to raw filter date when binder report date is invalid', () => {
    const db = createDb();

    expect(() => generateDailyIpBinderReport(db, 'not-a-date', 'Unit A')).not.toThrow();
    const report = generateDailyIpBinderReport(db, 'not-a-date', 'Unit A');
    expect(report.filters.date).toBe('not-a-date');
  });

});
