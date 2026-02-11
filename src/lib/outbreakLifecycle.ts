import { nowISO } from './parsers';
import type { Outbreak } from './types';

export type OutbreakStatus = 'watch' | 'active' | 'resolved';

export const transitionOutbreakStatus = (
  outbreak: Outbreak,
  nextStatus: OutbreakStatus,
  at: string = nowISO(),
): Outbreak => {
  if (outbreak.status === nextStatus) {
    return outbreak;
  }

  if (outbreak.status === 'resolved' && nextStatus !== 'resolved') {
    throw new Error('Resolved outbreaks cannot transition back to watch/active.');
  }

  const updated: Outbreak = {
    ...outbreak,
    status: nextStatus,
    updatedAt: at,
    declaredAt: outbreak.declaredAt ?? outbreak.startDate,
  };

  if (nextStatus === 'resolved') {
    updated.resolvedAt = at;
    updated.endDate = at.slice(0, 10);
  }

  return updated;
};
