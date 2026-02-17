import { describe, expect, it } from 'vitest';
import { normalizeVaxRecordShape } from '@/lib/vaxRecordFields';

describe('normalizeVaxRecordShape', () => {
  it('maps duplicated VAX aliases into a centralized shape', () => {
    const normalized = normalizeVaxRecordShape({
      record_id: 'rec-1',
      mrn: '12345',
      name: 'Resident, Test',
      vaccine_type: 'Flu',
      date_given: '1/2/2026',
      due_date: '2/3/2026',
      offerDate: '3/4/2026',
      administeredBy: 'RN A',
      lotNumber: 'LOT-9',
      administrationSite: 'Left Deltoid',
    });

    expect(normalized.id).toBe('rec-1');
    expect(normalized.record_id).toBe('rec-1');
    expect(normalized.residentName).toBe('Resident, Test');
    expect(normalized.vaccine).toBe('Flu');
    expect(normalized.vaccine_type).toBe('Flu');
    expect(normalized.dateGiven).toBe('2026-01-02');
    expect(normalized.date_given).toBe('2026-01-02');
    expect(normalized.dueDate).toBe('2026-02-03');
    expect(normalized.due_date).toBe('2026-02-03');
    expect(normalized.dateOffered).toBe('2026-03-04');
    expect(normalized.administered_by).toBe('RN A');
    expect(normalized.givenBy).toBe('RN A');
    expect(normalized.lot).toBe('LOT-9');
    expect(normalized.site).toBe('Left Deltoid');
  });
});
