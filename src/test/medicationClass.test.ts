import { describe, expect, it } from 'vitest';
import { inferMedicationClass, inferMedicationClassFromRecord } from '@/lib/medicationClass';

describe('medication class inference', () => {
  it('maps known antibiotics to their class', () => {
    expect(inferMedicationClass('Ceftriaxone 1g IV')).toBe('Cephalosporins / Beta-lactams');
    expect(inferMedicationClass('Levofloxacin')).toBe('Fluoroquinolones');
    expect(inferMedicationClass('Vancomycin')).toBe('Glycopeptides / Lipoglycopeptides');
  });

  it('uses suffix fallback when medication is uncommon', () => {
    expect(inferMedicationClass('Unknownfloxacin')).toBe('Fluoroquinolones');
  });

  it('uses indication hints when medication is missing', () => {
    expect(inferMedicationClass('', 'Treatment for UTI')).toBe('Urinary antibiotics');
    expect(inferMedicationClassFromRecord({ medication: '', med_name: '', indication: 'Cellulitis' })).toBe('Skin/soft tissue anti-infectives');
  });
});
