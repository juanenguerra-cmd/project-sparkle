import { describe, expect, it } from 'vitest';
import { redactExportRow } from '@/lib/security';

describe('integration: surveyor export redaction', () => {
  it('redacts MRN and DOB from surveyor packet rows', () => {
    const censusImport = [
      { name: 'Jane Doe', mrn: 'MRN001', dob: '1941-08-01', physician: 'Dr House', notes: 'sensitive' },
    ];

    const output = censusImport.map((row) => redactExportRow(row, 'surveyor'));
    expect(output[0].mrn).toBe('REDACTED');
    expect(output[0].dob).toBe('REDACTED');
    expect(String(output[0].name)).toBe('J. D.');
    expect(JSON.stringify(output)).not.toContain('MRN001');
    expect(JSON.stringify(output)).not.toContain('1941-08-01');
  });
});
