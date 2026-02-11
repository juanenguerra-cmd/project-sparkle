import { describe, expect, it } from 'vitest';
import { generateStandardOfCareReport } from '@/lib/reportGenerators';
import type { ICNDatabase } from '@/lib/database';

const createDb = (): ICNDatabase => ({
  census: {
    residentsByMrn: {
      '123': {
        mrn: '123',
        name: 'DOE, JANE',
        room: '301',
        unit: 'Unit 3',
        active_on_census: true,
      },
    },
    meta: { imported_at: null },
  },
  records: {
    abx: [],
    ip_cases: [],
    vax: [],
    notes: [],
    line_listings: [],
    outbreaks: [],
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

describe('generateStandardOfCareReport', () => {
  it('includes ABT starts in compact yyyyMMdd format when in selected date range', () => {
    const db = createDb();
    db.records.abx = [
      {
        id: 'abt-1',
        mrn: '123',
        medication: 'Levofloxacin',
        frequency: 'BID',
        route_raw: 'PO',
        start_date: '20260301',
        unit: 'Unit 3',
        room: '301',
        status: 'active',
      },
      {
        id: 'abt-2',
        mrn: '123',
        medication: 'Amoxicillin',
        start_date: '20260225',
        unit: 'Unit 3',
        room: '301',
        status: 'active',
      },
    ];

    const report = generateStandardOfCareReport(db, '2026-03-01', '2026-03-07');
    const abtSection = report.sections?.[0];

    expect(abtSection?.title).toBe('Antibiotic Review');
    expect(abtSection?.rows).toHaveLength(1);
    expect(abtSection?.rows[0][3]).toBe('Levofloxacin');
    expect(abtSection?.rows[0][4]).toBe('BID');
    expect(abtSection?.rows[0][7]).toBe('PO');
  });
});
