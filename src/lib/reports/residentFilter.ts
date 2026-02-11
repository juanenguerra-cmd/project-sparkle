import type { ICNDatabase } from '@/lib/database';
import type { ResidentFilterConfig, ResidentFilterMode, Resident } from '@/lib/types';

const getAllResidents = (db: ICNDatabase): Resident[] => Object.values(db.census.residentsByMrn);

export const getFilteredResidents = (
  db: ICNDatabase,
  config: ResidentFilterConfig
): Set<string> => {
  const allResidents = getAllResidents(db);

  switch (config.mode) {
    case 'active_only':
      return new Set(allResidents.filter((resident) => resident.active_on_census).map((resident) => resident.mrn));
    case 'active_in_period': {
      if (!config.dateRange) {
        return getFilteredResidents(db, { ...config, mode: 'active_only' });
      }

      return new Set(
        allResidents
          .filter((resident) => wasActiveInPeriod(resident, config.dateRange))
          .map((resident) => resident.mrn)
      );
    }
    case 'all':
      return new Set(allResidents.map((resident) => resident.mrn));
    default:
      return new Set(allResidents.filter((resident) => resident.active_on_census).map((resident) => resident.mrn));
  }
};

const wasActiveInPeriod = (
  resident: Resident,
  dateRange: { fromDate: string; toDate: string }
): boolean => {
  const admitDate = resident.admitDate || '';
  const dischargeDate = resident.last_missing_census_at || '';

  if (!admitDate) return resident.active_on_census;
  if (resident.active_on_census) return admitDate <= dateRange.toDate;
  if (!dischargeDate) return admitDate <= dateRange.toDate;

  return admitDate <= dateRange.toDate && dischargeDate >= dateRange.fromDate;
};

export const formatResidentNameForReport = (
  resident: Resident,
  config: ResidentFilterConfig
): string => {
  const name = resident.name || 'Unknown';
  const mrn = resident.mrn;

  let formattedName = `${name} (${mrn})`;
  if (config.showDischargedLabel && !resident.active_on_census) {
    const dischargeDate = resident.last_missing_census_at;
    if (dischargeDate) {
      const formatted = new Date(dischargeDate).toLocaleDateString('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: '2-digit',
      });
      formattedName += ` (D/C ${formatted})`;
    } else {
      formattedName += ' (D/C)';
    }
  }

  return formattedName;
};

export const getDefaultFilterMode = (reportTitle: string): ResidentFilterMode => {
  const title = reportTitle.toUpperCase();

  if (title.includes('DAILY') || title.includes('WORKLIST') || title.includes('DUE LIST')) {
    return 'active_only';
  }

  if (title.includes('MONTHLY') || title.includes('STANDARD OF CARE') || title.includes('INFECTION RATE') || title.includes('OUTBREAK')) {
    return 'active_in_period';
  }

  return 'active_only';
};
