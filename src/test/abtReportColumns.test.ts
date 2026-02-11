import { describe, expect, it } from 'vitest';
import {
  generateABTWorklist,
  generateMonthlyABTReport,
  generateMedicareABTComplianceReport,
  generateAntibioticDurationReport,
  generateIPDailyMorningReport,
  generateStandardOfCareReport,
} from '@/lib/reportGenerators';
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
    abx: [
      {
        id: 'abt-1',
        mrn: '123',
        residentName: 'DOE, JANE',
        medication: 'Levofloxacin',
        dose: '500 mg',
        frequency: 'BID',
        route: 'PO',
        indication: 'Pneumonia',
        startDate: '2026-03-01',
        endDate: '2026-03-07',
        unit: 'Unit 3',
        room: '301',
        status: 'active',
      },
    ],
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

describe('ABT report column completeness', () => {
  it('includes both Dose and Frequency in ABT-focused report headers', () => {
    const db = createDb();

    const reports = [
      generateABTWorklist(db),
      generateMonthlyABTReport(db, 2, 2026),
      generateMedicareABTComplianceReport(db),
      generateAntibioticDurationReport(db, 1),
    ];

    reports.forEach((report) => {
      expect(report.headers).toContain('Dose');
      expect(report.headers).toContain('Frequency');
    });
  });

  it('includes both Dose and Frequency in ABT sections for composite reports', () => {
    const db = createDb();

    const standardOfCare = generateStandardOfCareReport(db, '2026-03-01', '2026-03-10');
    const antibioticSection = standardOfCare.sections?.find((section) => section.title === 'Antibiotic Review');
    expect(antibioticSection?.headers).toContain('Dose');
    expect(antibioticSection?.headers).toContain('Frequency');

    const morningReport = generateIPDailyMorningReport(db);
    const activeAbtSection = morningReport.sections?.find((section) => section.title === 'Active Antibiotics (ABT)');
    expect(activeAbtSection?.headers).toContain('Dose');
    expect(activeAbtSection?.headers).toContain('Frequency');
  });
});
