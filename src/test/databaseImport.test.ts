import { beforeEach, describe, expect, it } from 'vitest';
import { clearDB, importDBFromJSON, loadDB, saveDB } from '@/lib/database';

const makeBaseDb = () => ({
  census: {
    residentsByMrn: {},
    meta: { imported_at: null }
  },
  records: {
    abx: [],
    ip_cases: [],
    vax: [],
    notes: [],
    line_listings: [],
    outbreaks: [],
    contacts: [],
    history: []
  },
  audit_log: [],
  workflow_metrics: [],
  settings: {}
});

describe('importDBFromJSON ABX merge behavior', () => {
  beforeEach(() => {
    clearDB();
    localStorage.clear();
  });

  it('preserves frequency and computes treatment days for imported ABX records', async () => {
    const payload = {
      census: { residentsByMrn: { '12345': { mrn: '12345', name: 'Jane Doe' } } },
      records: {
        abx: [
          {
            id: 'abx_1',
            mrn: '12345',
            medication: 'Ceftriaxone',
            frequency: 'Q12H',
            startDate: '2026-01-01',
            endDate: '2026-01-04'
          }
        ]
      }
    };

    const result = await importDBFromJSON(JSON.stringify(payload));
    expect(result.success).toBe(true);

    const db = loadDB();
    expect(db.records.abx).toHaveLength(1);
    expect(db.records.abx[0].frequency).toBe('Q12H');
    expect(db.records.abx[0].tx_days).toBe(3);
    expect(db.records.abx[0].daysOfTherapy).toBe(3);
  });

  it('skips duplicate ABX during merge when id differs but clinical key matches', async () => {
    const db = makeBaseDb();
    db.records.abx.push({
      id: 'existing-1',
      record_id: 'existing-1',
      mrn: '12345',
      name: 'Jane Doe',
      residentName: 'Jane Doe',
      med_name: 'Ceftriaxone',
      medication: 'Ceftriaxone',
      dose: '1g',
      route: 'IV',
      startDate: '2026-01-01',
      start_date: '2026-01-01',
      endDate: '2026-01-04',
      end_date: '2026-01-04',
      status: 'completed',
      createdAt: '2026-01-01T00:00:00.000Z'
    });
    saveDB(db);

    const payload = {
      records: {
        abx: [
          {
            id: 'remote-abc',
            mrn: '12345',
            medication: 'Ceftriaxone',
            dose: '1g',
            route: 'IV',
            startDate: '2026-01-01',
            endDate: '2026-01-04'
          }
        ]
      }
    };

    const result = await importDBFromJSON(JSON.stringify(payload));
    expect(result.success).toBe(true);

    const merged = loadDB();
    expect(merged.records.abx).toHaveLength(1);
  });
});
