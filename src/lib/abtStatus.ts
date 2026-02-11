import { isoDateFromAny, todayISO } from './parsers';
import type { ABTRecord } from './types';

export type AbtStatus = ABTRecord['status'];

export const deriveAbtStatus = (
  requestedStatus: AbtStatus,
  endDate?: string,
  today: string = todayISO(),
): AbtStatus => {
  if (requestedStatus === 'discontinued') return 'discontinued';

  const endIso = endDate ? isoDateFromAny(endDate) : '';
  if (endIso && endIso <= today) return 'completed';

  // Prevent future-dated or missing end dates from being marked completed.
  return 'active';
};
