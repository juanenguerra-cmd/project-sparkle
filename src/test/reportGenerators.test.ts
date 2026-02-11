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
    expect(abtSection?.rows[0][5]).toBe('BID');
    expect(abtSection?.rows[0][8]).toBe('PO');
  });

  it('filters IP by initiation date only and requires a valid start date when date filters are used', () => {
    const db = createDb();
    db.records.ip_cases = [
      {
        id: 'ip-in-range',
        mrn: '123',
        residentName: 'DOE, JANE',
        unit: 'Unit 3',
        room: '301',
        protocol: 'Isolation',
        status: 'active',
        onsetDate: '2026-03-03',
      },
      {
        id: 'ip-missing-start',
        mrn: '123',
        residentName: 'DOE, JANE',
        unit: 'Unit 3',
        room: '301',
        protocol: 'Isolation',
        status: 'active',
      },
      {
        id: 'ip-out-of-range',
        mrn: '123',
        residentName: 'DOE, JANE',
        unit: 'Unit 3',
        room: '301',
        protocol: 'Isolation',
        status: 'active',
        onsetDate: '2026-02-25',
      },
    ];

    const report = generateStandardOfCareReport(db, '2026-03-01', '2026-03-07');
    const ipSection = report.sections?.[1];

    expect(ipSection?.title).toBe('Precaution List Review');
    expect(ipSection?.rows).toHaveLength(1);
    expect(ipSection?.rows[0][6]).toBe('03/03/2026');
  });

  it('filters VAX by given/due/decline start date based on status and excludes rows without a valid start date', () => {
    const db = createDb();
    db.records.vax = [
      {
        id: 'vax-given',
        mrn: '123',
        residentName: 'DOE, JANE',
        unit: 'Unit 3',
        room: '301',
        vaccine: 'Influenza',
        status: 'given',
        dateGiven: '2026-03-02',
      },
      {
        id: 'vax-due',
        mrn: '123',
        residentName: 'DOE, JANE',
        unit: 'Unit 3',
        room: '301',
        vaccine: 'COVID-19',
        status: 'due',
        dueDate: '2026-03-04',
      },
      {
        id: 'vax-declined',
        mrn: '123',
        residentName: 'DOE, JANE',
        unit: 'Unit 3',
        room: '301',
        vaccine: 'RSV',
        status: 'declined',
        educationDate: '2026-03-05',
      },
      {
        id: 'vax-missing-start',
        mrn: '123',
        residentName: 'DOE, JANE',
        unit: 'Unit 3',
        room: '301',
        vaccine: 'Pneumococcal',
        status: 'declined',
      },
      {
        id: 'vax-out-of-range',
        mrn: '123',
        residentName: 'DOE, JANE',
        unit: 'Unit 3',
        room: '301',
        vaccine: 'Tdap',
        status: 'given',
        dateGiven: '2026-02-20',
      },
    ];

    const report = generateStandardOfCareReport(db, '2026-03-01', '2026-03-07');
    const vaxSection = report.sections?.[2];

    expect(vaxSection?.title).toBe('Vaccination Review');
    expect(vaxSection?.rows).toHaveLength(3);
    expect(vaxSection?.rows.map(row => row[3])).toEqual(['Influenza', 'COVID-19', 'RSV']);
    expect(vaxSection?.rows.map(row => row[5])).toEqual(['03/02/2026', '03/04/2026', '03/05/2026']);
  });
});
