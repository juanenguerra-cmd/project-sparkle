import { describe, expect, it } from 'vitest';
import { calculateABTStarts, calculateAUR, calculateDaysOfTherapy, calculateInfectionRatePer1000ResidentDays, calculateResidentDays } from '@/lib/metricsDefinitions';
import { transitionOutbreakStatus } from '@/lib/outbreakLifecycle';
import { redactExportRow } from '@/lib/security';
import { migrateResidentIds } from '@/lib/migrations';

describe('metrics definitions', () => {
  it('calculates resident days using midnight census sum', () => {
    const total = calculateResidentDays(
      { startDate: '2026-01-01', endDate: '2026-01-03' },
      [
        { date: '2026-01-01', censusCount: 10 },
        { date: '2026-01-02', censusCount: 11 },
        { date: '2026-01-03', censusCount: 12 },
      ],
    );
    expect(total).toBe(33);
  });

  it('calculates ABT starts with restart rule', () => {
    const starts = calculateABTStarts([
      { id: '1', mrn: 'A', unit: 'U', room: '1', dose: '', route: '', indication: '', status: 'completed', startDate: '2026-01-01', endDate: '2026-01-03' },
      { id: '2', mrn: 'A', unit: 'U', room: '1', dose: '', route: '', indication: '', status: 'active', startDate: '2026-01-05' },
    ], { startDate: '2026-01-01', endDate: '2026-01-31' });
    expect(starts).toBe(2);
  });

  it('calculates DOT/AUR/infection rate', () => {
    const dot = calculateDaysOfTherapy({ id: '1', mrn: 'A', unit: 'U', room: '1', dose: '', route: '', indication: '', status: 'active', startDate: '2026-01-02', endDate: '2026-01-04' }, { startDate: '2026-01-01', endDate: '2026-01-31' });
    expect(dot).toBe(3);
    expect(calculateAUR(30, 300)).toBe(100);
    const rate = calculateInfectionRatePer1000ResidentDays([{ id: 'ip1', mrn: 'A', unit: 'U', room: '1', protocol: 'EBP', status: 'Active', onsetDate: '2026-01-03' }], { startDate: '2026-01-01', endDate: '2026-01-31' }, 100);
    expect(rate).toBe(10);
  });
});

describe('outbreak lifecycle', () => {
  it('transitions to resolved with timestamps', () => {
    const outbreak = transitionOutbreakStatus({ id: 'o1', name: 'Cluster', type: 'respiratory', startDate: '2026-01-01', status: 'active', affectedUnits: [], totalCases: 2, createdAt: '2026-01-01' }, 'resolved', '2026-01-10T00:00:00.000Z');
    expect(outbreak.status).toBe('resolved');
    expect(outbreak.resolvedAt).toBe('2026-01-10T00:00:00.000Z');
  });
});

describe('security redaction and migration', () => {
  it('applies surveyor redaction profile', () => {
    const row = redactExportRow({ mrn: '123', dob: '1940-01-01', name: 'Jane Doe', physician: 'Dr X', notes: 'private' }, 'surveyor');
    expect(row.mrn).toBe('REDACTED');
    expect(row.dob).toBe('REDACTED');
    expect(row.name).toBe('J. D.');
  });

  it('migrates MRN keyed data to residentId backbone idempotently', () => {
    const legacy: any = {
      census: { residentsByMrn: { '123': { id: '123', mrn: '123', name: 'Jane Doe', unit: 'A', room: '10', active_on_census: true } }, meta: { imported_at: null } },
      records: { abx: [{ id: 'a1', mrn: '123', unit: 'A', room: '10', dose: '', route: '', indication: '', status: 'active' }], ip_cases: [], vax: [], notes: [], line_listings: [], outbreaks: [], contacts: [] },
      audit_log: [], settings: {},
    };
    const first = migrateResidentIds(legacy);
    expect(first.migrated).toBe(true);
    expect(Object.keys(first.db.census.residentsById || {}).length).toBe(1);
    const second = migrateResidentIds(first.db);
    expect(second.migrated).toBe(false);
  });
});
