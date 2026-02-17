import { describe, expect, it } from 'vitest';
import {
  ABT_REQUIRED_COLUMN_GROUPS,
  ABT_TRACKER_COLUMNS,
  IP_REQUIRED_COLUMN_GROUPS,
  getMissingColumnGroups,
} from '@/lib/utils/trackerFieldMaps';

describe('trackerFieldMaps', () => {
  it('includes centralized ABT tracker columns required by import/export', () => {
    expect(ABT_TRACKER_COLUMNS).toContain('record_id');
    expect(ABT_TRACKER_COLUMNS).toContain('route_raw');
    expect(ABT_TRACKER_COLUMNS).toContain('startDate');
    expect(ABT_TRACKER_COLUMNS).toContain('start_date');
    expect(ABT_TRACKER_COLUMNS).toContain('endDate');
    expect(ABT_TRACKER_COLUMNS).toContain('end_date');
  });

  it('accepts canonical or legacy aliases for required ABT and IP fields', () => {
    const abtLegacyRow = { name: 'Resident', med_name: 'Drug', start_date: '2026-01-01' };
    const ipLegacyRow = { name: 'Resident', infection_type: 'UTI', onset_date: '2026-01-01' };

    expect(getMissingColumnGroups(abtLegacyRow, ABT_REQUIRED_COLUMN_GROUPS)).toEqual([]);
    expect(getMissingColumnGroups(ipLegacyRow, IP_REQUIRED_COLUMN_GROUPS)).toEqual([]);
  });

  it('reports missing grouped requirements with readable aliases', () => {
    expect(getMissingColumnGroups({}, ABT_REQUIRED_COLUMN_GROUPS)).toEqual([
      'residentName / name',
      'medication / med_name',
      'startDate / start_date',
    ]);
  });
});
