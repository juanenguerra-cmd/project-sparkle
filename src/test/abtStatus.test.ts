import { describe, expect, it } from 'vitest';
import { deriveAbtStatus } from '@/lib/abtStatus';

describe('deriveAbtStatus', () => {
  it('keeps future end dates as active even if completed was requested', () => {
    expect(deriveAbtStatus('completed', '2026-02-18', '2026-02-11')).toBe('active');
  });

  it('marks completed only when end date is today or in the past', () => {
    expect(deriveAbtStatus('active', '2026-02-11', '2026-02-11')).toBe('completed');
    expect(deriveAbtStatus('active', '2026-02-10', '2026-02-11')).toBe('completed');
  });

  it('always respects discontinued status', () => {
    expect(deriveAbtStatus('discontinued', '2026-02-18', '2026-02-11')).toBe('discontinued');
  });
});
