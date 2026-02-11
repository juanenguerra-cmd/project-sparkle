import { addDays, differenceInCalendarDays, format, isAfter, isBefore, parseISO } from 'date-fns';
import type { ABTRecord, IPCase } from './types';

export type ResidentDaysMethod = 'midnight_census_sum' | 'adc_x_days';

export interface DateRange {
  startDate: string;
  endDate: string;
}

export interface CensusSnapshot {
  date: string;
  censusCount: number;
}

export const METRICS_DEFINITIONS = {
  residentDays: 'Default denominator is sum of daily midnight census counts. Optional method uses average daily census (ADC) × days in range.',
  abtStarts: 'Count of new antibiotic courses with startDate in range. Edits do not create starts. Restarts count only when prior course ended/discontinued before restart.',
  dot: 'Days of therapy are inclusive days from startDate through end/planned stop; ongoing courses are capped at report end date.',
  aur: 'Antibiotic Utilization Ratio = (DOT / resident-days) × 1000.',
  infectionRate: 'Infection rate per 1000 resident-days = new infection onsets in range / resident-days × 1000.',
} as const;

const toDate = (isoLike: string): Date => parseISO(isoLike.length === 10 ? `${isoLike}T00:00:00` : isoLike);

const enumerateDays = (startDate: string, endDate: string): string[] => {
  const start = toDate(startDate);
  const end = toDate(endDate);
  const days: string[] = [];
  for (let cursor = start; !isAfter(cursor, end); cursor = addDays(cursor, 1)) {
    days.push(format(cursor, 'yyyy-MM-dd'));
  }
  return days;
};

export const calculateResidentDays = (
  range: DateRange,
  snapshots: CensusSnapshot[],
  method: ResidentDaysMethod = 'midnight_census_sum',
  adcValue?: number,
): number => {
  const daysInRange = differenceInCalendarDays(toDate(range.endDate), toDate(range.startDate)) + 1;
  if (daysInRange <= 0) return 0;

  if (method === 'adc_x_days') {
    const adc = adcValue ?? 0;
    return Math.max(0, Math.round(adc * daysInRange));
  }

  const byDate = new Map(snapshots.map((entry) => [entry.date, entry.censusCount]));
  return enumerateDays(range.startDate, range.endDate).reduce((total, day) => total + (byDate.get(day) ?? 0), 0);
};

const getAbtStartDate = (record: ABTRecord): string | undefined => record.startDate || record.start_date;
const getAbtEndDate = (record: ABTRecord): string | undefined => record.endDate || record.end_date || record.plannedStopDate;

export const calculateABTStarts = (records: ABTRecord[], range: DateRange): number => {
  const start = toDate(range.startDate);
  const end = toDate(range.endDate);

  const sorted = [...records].sort((a, b) => (getAbtStartDate(a) || '').localeCompare(getAbtStartDate(b) || ''));
  let starts = 0;

  for (const record of sorted) {
    const startDate = getAbtStartDate(record);
    if (!startDate) continue;
    const currentStart = toDate(startDate);
    if (isBefore(currentStart, start) || isAfter(currentStart, end)) continue;

    const priorForResident = sorted.filter((item) => item.mrn === record.mrn && (getAbtStartDate(item) || '') < startDate);
    if (priorForResident.length === 0) {
      starts += 1;
      continue;
    }

    const immediatePrior = priorForResident[priorForResident.length - 1];
    const priorEnded = immediatePrior.status === 'completed' || immediatePrior.status === 'discontinued' || Boolean(getAbtEndDate(immediatePrior));
    if (priorEnded) starts += 1;
  }

  return starts;
};

export const calculateDaysOfTherapy = (record: ABTRecord, range: DateRange): number => {
  const startDateRaw = getAbtStartDate(record);
  if (!startDateRaw) return 0;

  const therapyStart = toDate(startDateRaw);
  const rangeStart = toDate(range.startDate);
  const rangeEnd = toDate(range.endDate);
  const therapyStopRaw = getAbtEndDate(record);
  const therapyStop = therapyStopRaw ? toDate(therapyStopRaw) : rangeEnd;

  const effectiveStart = isBefore(therapyStart, rangeStart) ? rangeStart : therapyStart;
  const effectiveStop = isAfter(therapyStop, rangeEnd) ? rangeEnd : therapyStop;

  if (isAfter(effectiveStart, effectiveStop)) return 0;
  return differenceInCalendarDays(effectiveStop, effectiveStart) + 1;
};

export const calculateAUR = (dot: number, residentDays: number): number => {
  if (residentDays <= 0) return 0;
  return (dot / residentDays) * 1000;
};

export const calculateInfectionRatePer1000ResidentDays = (
  ipCases: IPCase[],
  range: DateRange,
  residentDays: number,
): number => {
  if (residentDays <= 0) return 0;
  const start = toDate(range.startDate);
  const end = toDate(range.endDate);
  const newCases = ipCases.filter((entry) => {
    const onset = entry.onsetDate || entry.onset_date;
    if (!onset) return false;
    const onsetDate = toDate(onset);
    return !isBefore(onsetDate, start) && !isAfter(onsetDate, end);
  }).length;
  return (newCases / residentDays) * 1000;
};
