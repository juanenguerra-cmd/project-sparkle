// Antibiotic & Infection Surveillance Reports Module
import { ICNDatabase } from '../database';
import { IPCase } from '../types';
import {
  format,
  parseISO,
  startOfMonth,
  endOfMonth,
  eachMonthOfInterval,
  isWithinInterval,
  differenceInDays,
  startOfQuarter,
  endOfQuarter
} from 'date-fns';
import { ReportData } from '../reportGenerators';
import {
  calculateDaysOfTherapy,
  calculateResidentDays,
  type CensusSnapshot
} from '../metricsDefinitions';

// Infection categories for classification
export const INFECTION_CATEGORIES = [
  'UTI',
  'Respiratory/Pneumonia',
  'Skin/Wound',
  'GI/C.diff',
  'MDRO',
  'COVID-19',
  'Influenza',
  'Other'
] as const;

export type InfectionCategory = typeof INFECTION_CATEGORIES[number];

// --- Existing classification helpers (kept) ---
// Classify an IP case into a category
const classifyInfection = (ipCase: IPCase): InfectionCategory => {
  const infectionType = (ipCase.infectionType || ipCase.infection_type || '').toLowerCase();
  const source = (ipCase.sourceOfInfection || ipCase.source_of_infection || '').toLowerCase();
  const combined = `${infectionType} ${source}`;

  if (combined.includes('uti') || combined.includes('urinary') || combined.includes('catheter')) return 'UTI';
  if (combined.includes('pneumo') || combined.includes('respiratory') || combined.includes('lung') || combined.includes('bronch')) return 'Respiratory/Pneumonia';
  if (combined.includes('skin') || combined.includes('wound') || combined.includes('surg') || combined.includes('cellul') || combined.includes('decub') || combined.includes('ulcer')) return 'Skin/Wound';
  if (combined.includes('gi') || combined.includes('diff') || combined.includes('diarr') || combined.includes('gastro') || combined.includes('noro')) return 'GI/C.diff';
  if (combined.includes('mdro') || combined.includes('mrsa') || combined.includes('vre') || combined.includes('esbl') || combined.includes('cre')) return 'MDRO';
  if (combined.includes('covid') || combined.includes('sars')) return 'COVID-19';
  if (combined.includes('flu') || combined.includes('influenza')) return 'Influenza';
  return 'Other';
};

// --- Census helpers (kept) ---
const getMonthlyAverageCensus = (db: ICNDatabase, _month: Date): number => {
  return Object.values(db.census.residentsByMrn).filter((r) => r.active_on_census).length;
};

const buildMonthlySnapshots = (db: ICNDatabase, month: Date): CensusSnapshot[] => {
  const days = differenceInDays(endOfMonth(month), startOfMonth(month)) + 1;
  const census = getMonthlyAverageCensus(db, month);
  return Array.from({ length: days }, (_, i) => ({
    date: format(new Date(month.getFullYear(), month.getMonth(), i + 1), 'yyyy-MM-dd'),
    censusCount: census,
  }));
};

// --- Phase 1 Step 4 additions ---
export type IPDateField = 'onset' | 'specimen' | 'event_detected';

const getIPCaseDateByField = (ipCase: IPCase, field: IPDateField): string | undefined => {
  if (field === 'onset') return ipCase.onsetDate || ipCase.onset_date;
  if (field === 'specimen') {
    // support potential camel/snake variants
    // @ts-expect-error - some DB records may include these fields even if not in the strict type yet
    return ipCase.specimenCollectedDate || ipCase.specimen_collected_date;
  }
  // event_detected
  // @ts-expect-error - some DB records may include these fields even if not in the strict type yet
  return ipCase.eventDetectedDate || ipCase.event_detected_date;
};

const safeParseISO = (value: string): Date | null => {
  try {
    const parsed = parseISO(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed;
  } catch {
    return null;
  }
};

const getIPCasesInRangeByField = (
  db: ICNDatabase,
  startDate: Date,
  endDate: Date,
  field: IPDateField
): { cases: IPCase[]; missingDateCount: number } => {
  let missingDateCount = 0;
  const cases = db.records.ip_cases.filter((ipCase) => {
    const dateStr = getIPCaseDateByField(ipCase, field);
    if (!dateStr) {
      missingDateCount += 1;
      return false;
    }
    const parsed = safeParseISO(dateStr);
    if (!parsed) {
      missingDateCount += 1;
      return false;
    }
    return isWithinInterval(parsed, { start: startDate, end: endDate });
  });
  return { cases, missingDateCount };
};

export interface SurveillanceReportData extends ReportData {
  reportType: 'surveillance';
  dateRange: {
    startDate: string;
    endDate: string;
    periodType: 'range' | 'quarter';
  };
  summaryMetrics?: Record<string, number | string>;
}

export interface MonthlyMetrics {
  month: string;
  monthLabel: string;
  avgCensus: number;
  residentDays: number;
  infections: Record<InfectionCategory, number>;
  totalInfections: number;
  daysOfTherapy: number;
}

const calculateDOTInMonth = (db: ICNDatabase, month: Date): number => {
  const range = {
    startDate: format(startOfMonth(month), 'yyyy-MM-dd'),
    endDate: format(endOfMonth(month), 'yyyy-MM-dd'),
  };
  // ABX dataset exists in db.records.abx; keep parity with prior implementation
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (db as any).records.abx.reduce(
    (sum: number, record: any) => sum + calculateDaysOfTherapy(record, range),
    0
  );
};

// Generate monthly metrics for the date range
export const generateMonthlyMetrics = (db: ICNDatabase, startDate: Date, endDate: Date): MonthlyMetrics[] => {
  const months = eachMonthOfInterval({ start: startDate, end: endDate });

  return months.map((month) => {
    const monthStart = startOfMonth(month);
    const monthEnd = endOfMonth(month);
    const monthLabel = format(month, 'MMM yyyy');
    const monthKey = format(month, 'yyyy-MM');

    const avgCensus = getMonthlyAverageCensus(db, month);
    const residentDays = calculateResidentDays(
      { startDate: format(monthStart, 'yyyy-MM-dd'), endDate: format(monthEnd, 'yyyy-MM-dd') },
      buildMonthlySnapshots(db, month),
      db.settings.residentDaysMethod || 'midnight_census_sum',
      db.settings.averageDailyCensus
    );

    const { cases: ipCases } = getIPCasesInRangeByField(db, monthStart, monthEnd, 'onset');
    const infections: Record<InfectionCategory, number> = {
      UTI: 0,
      'Respiratory/Pneumonia': 0,
      'Skin/Wound': 0,
      'GI/C.diff': 0,
      MDRO: 0,
      'COVID-19': 0,
      Influenza: 0,
      Other: 0,
    };

    ipCases.forEach((ipCase) => {
      const category = classifyInfection(ipCase);
      infections[category] += 1;
    });

    const daysOfTherapy = calculateDOTInMonth(db, month);

    return {
      month: monthKey,
      monthLabel,
      avgCensus,
      residentDays,
      infections,
      totalInfections: Object.values(infections).reduce((sum, n) => sum + n, 0),
      daysOfTherapy,
    };
  });
};

// 7. Device-Associated Infection Tracking (Phase 1 Step 4)
export const generateDeviceAssociatedInfectionReport = (
  db: ICNDatabase,
  startDate: Date,
  endDate: Date,
  dateField: IPDateField = 'onset'
): SurveillanceReportData => {
  const { cases, missingDateCount } = getIPCasesInRangeByField(db, startDate, endDate, dateField);

  const deviceCases = cases.filter((ipCase) => Boolean((ipCase as any).deviceAssociated));

  const rows: string[][] = deviceCases
    .map((ipCase) => {
      const resident = db.census.residentsByMrn[ipCase.mrn];
      const residentName = ipCase.residentName || ipCase.name || resident?.name || 'Unknown';

      const onset = ipCase.onsetDate || ipCase.onset_date || '';
      const onsetLabel = onset ? format(parseISO(onset), 'MM/dd/yyyy') : '—';

      const haiType = (ipCase as any).haiType || (ipCase as any).hai_type || '—';
      const deviceType = (ipCase as any).deviceType || (ipCase as any).device_type || '—';
      const labConfirmedRaw = (ipCase as any).labConfirmed ?? (ipCase as any).lab_confirmed;
      const labConfirmed = labConfirmedRaw === true ? 'Yes' : labConfirmedRaw === false ? 'No' : '—';

      const specimenDateStr = (ipCase as any).specimenCollectedDate || (ipCase as any).specimen_collected_date;
      const specimenLabel = specimenDateStr ? format(parseISO(specimenDateStr), 'MM/dd/yyyy') : '—';

      const eventDetectedStr = (ipCase as any).eventDetectedDate || (ipCase as any).event_detected_date;
      const eventDetectedLabel = eventDetectedStr ? format(parseISO(eventDetectedStr), 'MM/dd/yyyy') : '—';

      return [
        onsetLabel,
        residentName,
        ipCase.mrn,
        ipCase.room || resident?.room || '',
        ipCase.unit || resident?.unit || '',
        haiType,
        deviceType,
        labConfirmed,
        specimenLabel,
        eventDetectedLabel,
        ipCase.status || '—',
      ];
    })
    .sort((a, b) => a[0].localeCompare(b[0]));

  const dateFieldLabel =
    dateField === 'onset' ? 'Onset Date' : dateField === 'specimen' ? 'Specimen Collected Date' : 'Event Detected Date';

  return {
    reportType: 'surveillance',
    title: 'DEVICE-ASSOCIATED INFECTION TRACKING',
    subtitle: `${format(startDate, 'MMM d, yyyy')} - ${format(endDate, 'MMM d, yyyy')} (Filtered by ${dateFieldLabel})`,
    generatedAt: new Date().toISOString(),
    dateRange: {
      startDate: format(startDate, 'yyyy-MM-dd'),
      endDate: format(endDate, 'yyyy-MM-dd'),
      periodType: 'range',
    },
    filters: {
      date: format(new Date(), 'MM/dd/yyyy'),
      period: `${format(startDate, 'MM/dd/yyyy')} - ${format(endDate, 'MM/dd/yyyy')}`,
      dateField: dateFieldLabel,
      deviceAssociatedOnly: 'Yes',
    },
    headers: [
      'Onset Date',
      'Resident',
      'MRN',
      'Room',
      'Unit',
      'HAI Type',
      'Device Type',
      'Lab Confirmed',
      'Specimen Collected',
      'Event Detected',
      'Status',
    ],
    rows,
    summaryMetrics: {
      totalDeviceAssociatedCases: rows.length,
      filteredBy: dateFieldLabel,
      missingDateFieldCount: missingDateCount,
    },
  };
};

// Helper to get quarter dates
export const getQuarterDates = (quarter: 1 | 2 | 3 | 4, year: number): { start: Date; end: Date } => {
  const quarterStartMonth = (quarter - 1) * 3;
  const start = startOfQuarter(new Date(year, quarterStartMonth, 1));
  const end = endOfQuarter(start);
  return { start, end };
};
