import { describe, expect, it } from 'vitest';
import {
  CORE_LINE_LISTING_FIELD_IDS,
  filterTemplateManagedFields,
  stripCoreFieldsFromTemplateData,
} from '@/lib/lineListingFieldFlow';

describe('line listing field flow helpers', () => {
  it('filters template fields managed by core record inputs', () => {
    const fields: any[] = [
      { id: 'age', label: 'Age' },
      { id: 'unit', label: 'Unit/Floor' },
      { id: 'labResults', label: 'Lab Results' },
      { id: 'testType', label: 'Test Type' },
    ];

    const filtered = filterTemplateManagedFields(fields as any);
    expect(filtered.map((field) => field.id)).toEqual(['age', 'testType']);
    expect(CORE_LINE_LISTING_FIELD_IDS.has('unit')).toBe(true);
    expect(CORE_LINE_LISTING_FIELD_IDS.has('labResults')).toBe(true);
  });

  it('removes core-managed keys from template data payload', () => {
    const payload = {
      age: 88,
      unit: 'A',
      labResults: 'PCR+',
      notes: 'persist',
      testDate: '2026-01-01',
    };

    expect(stripCoreFieldsFromTemplateData(payload)).toEqual({
      age: 88,
      notes: 'persist',
      testDate: '2026-01-01',
    });
  });
});
