// Antibiotic & Infection Surveillance Reports Module
import { ICNDatabase, getActiveIPCases, getActiveABT, getActiveResidents } from '../database';
import { IPCase, ABTRecord } from '../types';
import { 
  format, 
  parseISO, 
  startOfMonth, 
  endOfMonth, 
  startOfQuarter, 
  endOfQuarter, 
  eachMonthOfInterval,
  isWithinInterval,
  differenceInDays
} from 'date-fns';
import { ReportData } from '../reportGenerators';

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

// Classify an IP case into a category
const classifyInfection = (ipCase: IPCase): InfectionCategory => {
  const infectionType = (ipCase.infectionType || ipCase.infection_type || '').toLowerCase();
  const source = (ipCase.sourceOfInfection || ipCase.source_of_infection || '').toLowerCase();
  const combined = `${infectionType} ${source}`;
  
  if (combined.includes('uti') || combined.includes('urinary') || combined.includes('catheter')) {
    return 'UTI';
  }
  if (combined.includes('pneumo') || combined.includes('respiratory') || combined.includes('lung') || combined.includes('bronch')) {
    return 'Respiratory/Pneumonia';
  }
  if (combined.includes('skin') || combined.includes('wound') || combined.includes('surg') || combined.includes('cellul') || combined.includes('decub') || combined.includes('ulcer')) {
    return 'Skin/Wound';
  }
  if (combined.includes('gi') || combined.includes('diff') || combined.includes('diarr') || combined.includes('gastro') || combined.includes('noro')) {
    return 'GI/C.diff';
  }
  if (combined.includes('mdro') || combined.includes('mrsa') || combined.includes('vre') || combined.includes('esbl') || combined.includes('cre')) {
    return 'MDRO';
  }
  if (combined.includes('covid') || combined.includes('sars')) {
    return 'COVID-19';
  }
  if (combined.includes('flu') || combined.includes('influenza')) {
    return 'Influenza';
  }
  return 'Other';
};

// Classify an ABT record into a category based on indication
const classifyABTIndication = (abt: ABTRecord): InfectionCategory => {
  const indication = (abt.indication || '').toLowerCase();
  const source = (abt.infection_source || '').toLowerCase();
  const combined = `${indication} ${source}`;
  
  if (combined.includes('uti') || combined.includes('urinary') || combined.includes('catheter') || combined.includes('pyelo')) {
    return 'UTI';
  }
  if (combined.includes('pneumo') || combined.includes('respiratory') || combined.includes('lung') || combined.includes('bronch') || combined.includes('copd')) {
    return 'Respiratory/Pneumonia';
  }
  if (combined.includes('skin') || combined.includes('wound') || combined.includes('surg') || combined.includes('cellul') || combined.includes('ssti')) {
    return 'Skin/Wound';
  }
  if (combined.includes('gi') || combined.includes('diff') || combined.includes('diarr') || combined.includes('gastro')) {
    return 'GI/C.diff';
  }
  if (combined.includes('mdro') || combined.includes('mrsa') || combined.includes('vre')) {
    return 'MDRO';
  }
  if (combined.includes('covid') || combined.includes('sars')) {
    return 'COVID-19';
  }
  if (combined.includes('flu') || combined.includes('influenza')) {
    return 'Influenza';
  }
  return 'Other';
};

// Helper to get monthly census average (simplified - uses current census count)
const getMonthlyAverageCensus = (db: ICNDatabase, _month: Date): number => {
  // In a real implementation, this would query historical census data
  // For now, we use current active census as a proxy
  return Object.values(db.census.residentsByMrn).filter(r => r.active_on_census).length;
};

// Helper to calculate resident days for a month
const calculateResidentDays = (db: ICNDatabase, month: Date): number => {
  const avgCensus = getMonthlyAverageCensus(db, month);
  const daysInMonth = differenceInDays(endOfMonth(month), startOfMonth(month)) + 1;
  return avgCensus * daysInMonth;
};

// Get IP cases within a date range
const getIPCasesInRange = (db: ICNDatabase, startDate: Date, endDate: Date): IPCase[] => {
  return db.records.ip_cases.filter(ipCase => {
    const onsetDate = ipCase.onsetDate || ipCase.onset_date;
    if (!onsetDate) return false;
    try {
      const onset = parseISO(onsetDate);
      return isWithinInterval(onset, { start: startDate, end: endDate });
    } catch {
      return false;
    }
  });
};

// Get ABT records started within a date range
const getABTStartsInRange = (db: ICNDatabase, startDate: Date, endDate: Date): ABTRecord[] => {
  return db.records.abx.filter(abt => {
    const startDateStr = abt.startDate || abt.start_date;
    if (!startDateStr) return false;
    try {
      const start = parseISO(startDateStr);
      return isWithinInterval(start, { start: startDate, end: endDate });
    } catch {
      return false;
    }
  });
};

// Calculate days of therapy for ABT records in a month
const calculateDOTInMonth = (db: ICNDatabase, month: Date): number => {
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  
  let totalDOT = 0;
  
  db.records.abx.forEach(abt => {
    const startDateStr = abt.startDate || abt.start_date;
    const endDateStr = abt.endDate || abt.end_date;
    
    if (!startDateStr) return;
    
    try {
      const abtStart = parseISO(startDateStr);
      const abtEnd = endDateStr ? parseISO(endDateStr) : new Date();
      
      // Calculate overlap with the month
      const overlapStart = abtStart < monthStart ? monthStart : abtStart;
      const overlapEnd = abtEnd > monthEnd ? monthEnd : abtEnd;
      
      if (overlapStart <= overlapEnd) {
        totalDOT += differenceInDays(overlapEnd, overlapStart) + 1;
      }
    } catch {
      // Skip invalid dates
    }
  });
  
  return totalDOT;
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
  abtStarts: Record<InfectionCategory, number>;
  totalABTStarts: number;
  daysOfTherapy: number;
}

// Generate monthly metrics for the date range
export const generateMonthlyMetrics = (
  db: ICNDatabase,
  startDate: Date,
  endDate: Date
): MonthlyMetrics[] => {
  const months = eachMonthOfInterval({ start: startDate, end: endDate });
  
  return months.map(month => {
    const monthStart = startOfMonth(month);
    const monthEnd = endOfMonth(month);
    const monthLabel = format(month, 'MMM yyyy');
    const monthKey = format(month, 'yyyy-MM');
    
    const avgCensus = getMonthlyAverageCensus(db, month);
    const residentDays = calculateResidentDays(db, month);
    
    // Get infections for this month
    const ipCases = getIPCasesInRange(db, monthStart, monthEnd);
    const infections: Record<InfectionCategory, number> = {
      'UTI': 0,
      'Respiratory/Pneumonia': 0,
      'Skin/Wound': 0,
      'GI/C.diff': 0,
      'MDRO': 0,
      'COVID-19': 0,
      'Influenza': 0,
      'Other': 0
    };
    
    ipCases.forEach(ipCase => {
      const category = classifyInfection(ipCase);
      infections[category]++;
    });
    
    // Get ABT starts for this month
    const abtRecords = getABTStartsInRange(db, monthStart, monthEnd);
    const abtStarts: Record<InfectionCategory, number> = {
      'UTI': 0,
      'Respiratory/Pneumonia': 0,
      'Skin/Wound': 0,
      'GI/C.diff': 0,
      'MDRO': 0,
      'COVID-19': 0,
      'Influenza': 0,
      'Other': 0
    };
    
    abtRecords.forEach(abt => {
      const category = classifyABTIndication(abt);
      abtStarts[category]++;
    });
    
    const daysOfTherapy = calculateDOTInMonth(db, month);
    
    return {
      month: monthKey,
      monthLabel,
      avgCensus,
      residentDays,
      infections,
      totalInfections: Object.values(infections).reduce((sum, n) => sum + n, 0),
      abtStarts,
      totalABTStarts: Object.values(abtStarts).reduce((sum, n) => sum + n, 0),
      daysOfTherapy
    };
  });
};

// 1. Resident Infection Surveillance Trend
export const generateInfectionSurveillanceTrend = (
  db: ICNDatabase,
  startDate: Date,
  endDate: Date
): SurveillanceReportData => {
  const metrics = generateMonthlyMetrics(db, startDate, endDate);
  
  const rows: string[][] = [];
  
  // Header row with months
  const headerRow = ['Category', ...metrics.map(m => m.monthLabel), 'Total'];
  
  // Add rows for each category
  INFECTION_CATEGORIES.forEach(category => {
    const monthValues = metrics.map(m => m.infections[category]);
    const total = monthValues.reduce((sum, n) => sum + n, 0);
    rows.push([category, ...monthValues.map(String), total.toString()]);
  });
  
  // Total row
  const totalByMonth = metrics.map(m => m.totalInfections);
  const grandTotal = totalByMonth.reduce((sum, n) => sum + n, 0);
  rows.push(['TOTAL', ...totalByMonth.map(String), grandTotal.toString()]);
  
  return {
    reportType: 'surveillance',
    title: 'RESIDENT INFECTION SURVEILLANCE TREND',
    subtitle: `${format(startDate, 'MMM d, yyyy')} - ${format(endDate, 'MMM d, yyyy')}`,
    generatedAt: new Date().toISOString(),
    dateRange: {
      startDate: format(startDate, 'yyyy-MM-dd'),
      endDate: format(endDate, 'yyyy-MM-dd'),
      periodType: 'range'
    },
    filters: {
      date: format(new Date(), 'MM/dd/yyyy'),
      period: `${format(startDate, 'MM/dd/yyyy')} - ${format(endDate, 'MM/dd/yyyy')}`
    },
    headers: headerRow,
    rows,
    summaryMetrics: {
      totalInfections: grandTotal,
      monthsCovered: metrics.length,
      avgPerMonth: metrics.length > 0 ? (grandTotal / metrics.length).toFixed(1) : '0'
    }
  };
};

// 2. Resident Infection Acquired (new infections during stay)
export const generateInfectionAcquired = (
  db: ICNDatabase,
  startDate: Date,
  endDate: Date
): SurveillanceReportData => {
  const metrics = generateMonthlyMetrics(db, startDate, endDate);
  
  // For this report, we show infections that were likely facility-acquired
  // (onset > 3 days after admission - simplified to just show all tracked infections)
  const ipCases = getIPCasesInRange(db, startDate, endDate);
  
  const rows: string[][] = ipCases.map(ipCase => {
    const resident = db.census.residentsByMrn[ipCase.mrn];
    const residentName = ipCase.residentName || ipCase.name || resident?.name || 'Unknown';
    const onsetDate = ipCase.onsetDate || ipCase.onset_date || '';
    const category = classifyInfection(ipCase);
    
    return [
      format(parseISO(onsetDate), 'MM/dd/yyyy'),
      residentName,
      ipCase.room || resident?.room || '',
      ipCase.unit,
      category,
      ipCase.infectionType || ipCase.infection_type || '',
      ipCase.sourceOfInfection || ipCase.source_of_infection || '',
      ipCase.status
    ];
  }).sort((a, b) => a[0].localeCompare(b[0]));
  
  // Summary by category
  const categoryCounts: Record<InfectionCategory, number> = {
    'UTI': 0,
    'Respiratory/Pneumonia': 0,
    'Skin/Wound': 0,
    'GI/C.diff': 0,
    'MDRO': 0,
    'COVID-19': 0,
    'Influenza': 0,
    'Other': 0
  };
  
  ipCases.forEach(ipCase => {
    const category = classifyInfection(ipCase);
    categoryCounts[category]++;
  });
  
  return {
    reportType: 'surveillance',
    title: 'RESIDENT INFECTIONS ACQUIRED',
    subtitle: `Facility-Acquired Infections: ${format(startDate, 'MMM d, yyyy')} - ${format(endDate, 'MMM d, yyyy')}`,
    generatedAt: new Date().toISOString(),
    dateRange: {
      startDate: format(startDate, 'yyyy-MM-dd'),
      endDate: format(endDate, 'yyyy-MM-dd'),
      periodType: 'range'
    },
    filters: {
      date: format(new Date(), 'MM/dd/yyyy'),
      period: `${format(startDate, 'MM/dd/yyyy')} - ${format(endDate, 'MM/dd/yyyy')}`
    },
    headers: ['Onset Date', 'Resident', 'Room', 'Unit', 'Category', 'Infection Type', 'Source', 'Status'],
    rows,
    summaryMetrics: {
      totalInfections: ipCases.length,
      ...categoryCounts
    }
  };
};

// 3. Infection Rate By Census
export const generateInfectionRateByCensus = (
  db: ICNDatabase,
  startDate: Date,
  endDate: Date
): SurveillanceReportData => {
  const metrics = generateMonthlyMetrics(db, startDate, endDate);
  
  const rows: string[][] = [];
  
  // For each category, calculate rate per average census
  INFECTION_CATEGORIES.forEach(category => {
    const categoryRow: string[] = [category];
    let totalInfections = 0;
    let totalCensus = 0;
    
    metrics.forEach(m => {
      const infections = m.infections[category];
      const rate = m.avgCensus > 0 ? ((infections / m.avgCensus) * 100).toFixed(2) : '0.00';
      categoryRow.push(`${infections} (${rate}%)`);
      totalInfections += infections;
      totalCensus += m.avgCensus;
    });
    
    // Overall rate
    const avgCensus = metrics.length > 0 ? totalCensus / metrics.length : 0;
    const overallRate = avgCensus > 0 ? ((totalInfections / metrics.length / avgCensus) * 100).toFixed(2) : '0.00';
    categoryRow.push(`${totalInfections} (${overallRate}%)`);
    
    rows.push(categoryRow);
  });
  
  // Total row
  const totalRow: string[] = ['ALL INFECTIONS'];
  let grandTotal = 0;
  let grandCensus = 0;
  
  metrics.forEach(m => {
    const rate = m.avgCensus > 0 ? ((m.totalInfections / m.avgCensus) * 100).toFixed(2) : '0.00';
    totalRow.push(`${m.totalInfections} (${rate}%)`);
    grandTotal += m.totalInfections;
    grandCensus += m.avgCensus;
  });
  
  const avgCensus = metrics.length > 0 ? grandCensus / metrics.length : 0;
  const overallRate = avgCensus > 0 ? ((grandTotal / metrics.length / avgCensus) * 100).toFixed(2) : '0.00';
  totalRow.push(`${grandTotal} (${overallRate}%)`);
  
  rows.push(totalRow);
  
  // Add census row for reference
  rows.push(['Avg Census', ...metrics.map(m => m.avgCensus.toString()), Math.round(avgCensus).toString()]);
  
  return {
    reportType: 'surveillance',
    title: 'INFECTION RATE BY CENSUS',
    subtitle: `Infection Rates per Average Monthly Census: ${format(startDate, 'MMM d, yyyy')} - ${format(endDate, 'MMM d, yyyy')}`,
    generatedAt: new Date().toISOString(),
    dateRange: {
      startDate: format(startDate, 'yyyy-MM-dd'),
      endDate: format(endDate, 'yyyy-MM-dd'),
      periodType: 'range'
    },
    filters: {
      date: format(new Date(), 'MM/dd/yyyy'),
      period: `${format(startDate, 'MM/dd/yyyy')} - ${format(endDate, 'MM/dd/yyyy')}`
    },
    headers: ['Category', ...metrics.map(m => m.monthLabel), 'Total/Avg'],
    rows,
    summaryMetrics: {
      totalInfections: grandTotal,
      averageCensus: Math.round(avgCensus),
      overallRate: `${overallRate}%`
    }
  };
};

// 4. Infection Rate Per 1000 Resident Days
export const generateInfectionRatePer1000Days = (
  db: ICNDatabase,
  startDate: Date,
  endDate: Date
): SurveillanceReportData => {
  const metrics = generateMonthlyMetrics(db, startDate, endDate);
  
  const rows: string[][] = [];
  
  // For each category, calculate rate per 1000 resident days
  INFECTION_CATEGORIES.forEach(category => {
    const categoryRow: string[] = [category];
    let totalInfections = 0;
    let totalResidentDays = 0;
    
    metrics.forEach(m => {
      const infections = m.infections[category];
      const rate = m.residentDays > 0 ? ((infections / m.residentDays) * 1000).toFixed(2) : '0.00';
      categoryRow.push(rate);
      totalInfections += infections;
      totalResidentDays += m.residentDays;
    });
    
    // Overall rate
    const overallRate = totalResidentDays > 0 ? ((totalInfections / totalResidentDays) * 1000).toFixed(2) : '0.00';
    categoryRow.push(overallRate);
    
    rows.push(categoryRow);
  });
  
  // Total row
  const totalRow: string[] = ['ALL INFECTIONS'];
  let grandTotal = 0;
  let grandResidentDays = 0;
  
  metrics.forEach(m => {
    const rate = m.residentDays > 0 ? ((m.totalInfections / m.residentDays) * 1000).toFixed(2) : '0.00';
    totalRow.push(rate);
    grandTotal += m.totalInfections;
    grandResidentDays += m.residentDays;
  });
  
  const overallRate = grandResidentDays > 0 ? ((grandTotal / grandResidentDays) * 1000).toFixed(2) : '0.00';
  totalRow.push(overallRate);
  
  rows.push(totalRow);
  
  // Add resident days row for reference
  rows.push(['Resident Days', ...metrics.map(m => m.residentDays.toLocaleString()), grandResidentDays.toLocaleString()]);
  
  return {
    reportType: 'surveillance',
    title: 'INFECTION RATE PER 1,000 RESIDENT DAYS',
    subtitle: `${format(startDate, 'MMM d, yyyy')} - ${format(endDate, 'MMM d, yyyy')}`,
    generatedAt: new Date().toISOString(),
    dateRange: {
      startDate: format(startDate, 'yyyy-MM-dd'),
      endDate: format(endDate, 'yyyy-MM-dd'),
      periodType: 'range'
    },
    filters: {
      date: format(new Date(), 'MM/dd/yyyy'),
      period: `${format(startDate, 'MM/dd/yyyy')} - ${format(endDate, 'MM/dd/yyyy')}`
    },
    headers: ['Category', ...metrics.map(m => m.monthLabel), 'Overall'],
    rows,
    summaryMetrics: {
      totalInfections: grandTotal,
      totalResidentDays: grandResidentDays,
      overallRate: `${overallRate} per 1,000 days`
    }
  };
};

// 5. Antibiotic Starts Per 1000 Resident Days
export const generateABTStartsPer1000Days = (
  db: ICNDatabase,
  startDate: Date,
  endDate: Date
): SurveillanceReportData => {
  const metrics = generateMonthlyMetrics(db, startDate, endDate);
  
  const rows: string[][] = [];
  
  // For each category, calculate ABT starts rate per 1000 resident days
  INFECTION_CATEGORIES.forEach(category => {
    const categoryRow: string[] = [category];
    let totalStarts = 0;
    let totalResidentDays = 0;
    
    metrics.forEach(m => {
      const starts = m.abtStarts[category];
      const rate = m.residentDays > 0 ? ((starts / m.residentDays) * 1000).toFixed(2) : '0.00';
      categoryRow.push(rate);
      totalStarts += starts;
      totalResidentDays += m.residentDays;
    });
    
    // Overall rate
    const overallRate = totalResidentDays > 0 ? ((totalStarts / totalResidentDays) * 1000).toFixed(2) : '0.00';
    categoryRow.push(overallRate);
    
    rows.push(categoryRow);
  });
  
  // Total row
  const totalRow: string[] = ['ALL ABT STARTS'];
  let grandTotal = 0;
  let grandResidentDays = 0;
  
  metrics.forEach(m => {
    const rate = m.residentDays > 0 ? ((m.totalABTStarts / m.residentDays) * 1000).toFixed(2) : '0.00';
    totalRow.push(rate);
    grandTotal += m.totalABTStarts;
    grandResidentDays += m.residentDays;
  });
  
  const overallRate = grandResidentDays > 0 ? ((grandTotal / grandResidentDays) * 1000).toFixed(2) : '0.00';
  totalRow.push(overallRate);
  
  rows.push(totalRow);
  
  // Add counts row
  rows.push(['Total Starts', ...metrics.map(m => m.totalABTStarts.toString()), grandTotal.toString()]);
  rows.push(['Resident Days', ...metrics.map(m => m.residentDays.toLocaleString()), grandResidentDays.toLocaleString()]);
  
  return {
    reportType: 'surveillance',
    title: 'ANTIBIOTIC STARTS PER 1,000 RESIDENT DAYS',
    subtitle: `${format(startDate, 'MMM d, yyyy')} - ${format(endDate, 'MMM d, yyyy')}`,
    generatedAt: new Date().toISOString(),
    dateRange: {
      startDate: format(startDate, 'yyyy-MM-dd'),
      endDate: format(endDate, 'yyyy-MM-dd'),
      periodType: 'range'
    },
    filters: {
      date: format(new Date(), 'MM/dd/yyyy'),
      period: `${format(startDate, 'MM/dd/yyyy')} - ${format(endDate, 'MM/dd/yyyy')}`
    },
    headers: ['Category', ...metrics.map(m => m.monthLabel), 'Overall'],
    rows,
    summaryMetrics: {
      totalABTStarts: grandTotal,
      totalResidentDays: grandResidentDays,
      overallRate: `${overallRate} per 1,000 days`
    }
  };
};

// 6. Antibiotic Utilization Ratio (AUR)
export const generateAntibioticUtilizationRatio = (
  db: ICNDatabase,
  startDate: Date,
  endDate: Date
): SurveillanceReportData => {
  const metrics = generateMonthlyMetrics(db, startDate, endDate);
  
  const rows: string[][] = [];
  
  // Main metrics rows
  const dotRow = ['Days of Therapy (DOT)'];
  const residentDaysRow = ['Resident Days'];
  const aurRow = ['AUR (DOT/1000 RD)'];
  
  let totalDOT = 0;
  let totalResidentDays = 0;
  
  metrics.forEach(m => {
    dotRow.push(m.daysOfTherapy.toString());
    residentDaysRow.push(m.residentDays.toLocaleString());
    
    const aur = m.residentDays > 0 ? ((m.daysOfTherapy / m.residentDays) * 1000).toFixed(2) : '0.00';
    aurRow.push(aur);
    
    totalDOT += m.daysOfTherapy;
    totalResidentDays += m.residentDays;
  });
  
  // Totals
  const overallAUR = totalResidentDays > 0 ? ((totalDOT / totalResidentDays) * 1000).toFixed(2) : '0.00';
  
  dotRow.push(totalDOT.toString());
  residentDaysRow.push(totalResidentDays.toLocaleString());
  aurRow.push(overallAUR);
  
  rows.push(dotRow);
  rows.push(residentDaysRow);
  rows.push(aurRow);
  
  // Add benchmark comparison
  rows.push(['', '', '', '', '', '', '']);
  rows.push(['BENCHMARK COMPARISON', '', '', '', '', '', '']);
  rows.push(['National Median AUR', '71.0', '', '', '', '', '']);
  rows.push(['Your Facility AUR', overallAUR, '', '', '', '', '']);
  
  const benchmark = 71.0;
  const aurNum = parseFloat(overallAUR);
  const comparison = aurNum > benchmark 
    ? `Above benchmark by ${(aurNum - benchmark).toFixed(1)}` 
    : aurNum < benchmark 
      ? `Below benchmark by ${(benchmark - aurNum).toFixed(1)}`
      : 'At benchmark';
  rows.push(['Status', comparison, '', '', '', '', '']);
  
  return {
    reportType: 'surveillance',
    title: 'ANTIBIOTIC UTILIZATION RATIO (AUR)',
    subtitle: `${format(startDate, 'MMM d, yyyy')} - ${format(endDate, 'MMM d, yyyy')}`,
    generatedAt: new Date().toISOString(),
    dateRange: {
      startDate: format(startDate, 'yyyy-MM-dd'),
      endDate: format(endDate, 'yyyy-MM-dd'),
      periodType: 'range'
    },
    filters: {
      date: format(new Date(), 'MM/dd/yyyy'),
      period: `${format(startDate, 'MM/dd/yyyy')} - ${format(endDate, 'MM/dd/yyyy')}`
    },
    headers: ['Metric', ...metrics.map(m => m.monthLabel), 'Total/Overall'],
    rows,
    summaryMetrics: {
      totalDOT: totalDOT,
      totalResidentDays: totalResidentDays,
      overallAUR: overallAUR,
      benchmark: '71.0',
      status: comparison
    }
  };
};

// Helper to get quarter dates
export const getQuarterDates = (quarter: 1 | 2 | 3 | 4, year: number): { start: Date; end: Date } => {
  const quarterStartMonth = (quarter - 1) * 3;
  const start = startOfQuarter(new Date(year, quarterStartMonth, 1));
  const end = endOfQuarter(start);
  return { start, end };
};

// Get quarter label
export const getQuarterLabel = (quarter: 1 | 2 | 3 | 4, year: number): string => {
  return `Q${quarter} ${year}`;
};
