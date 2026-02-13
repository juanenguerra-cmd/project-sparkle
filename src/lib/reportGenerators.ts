// Report Generation Functions for ICN Hub
import { ICNDatabase, loadDB, getActiveIPCases, getActiveABT, getVaxDue, getActiveResidents, getNotesRequiringFollowUp, getActiveOutbreaks, normalizeIPStatus } from './database';
import { IPCase, ABTRecord, VaxRecord, Resident, Note, SYMPTOM_OPTIONS } from './types';
import { isoDateFromAny } from './parsers';
import { differenceInDays, format, isWithinInterval, startOfMonth, endOfMonth, parseISO, isBefore, isAfter, addDays, subDays, isSameDay } from 'date-fns';
import { inferMedicationClassFromRecord } from './medicationClass';
import { getFilteredResidents, formatResidentNameForReport as formatResidentNameWithStatus } from './reports/residentFilter';
import type { ResidentFilterConfig } from './types';

export interface ReportSection {
  title: string;
  headers: string[];
  rows: string[][];
}

export interface ReportData {
  title: string;
  subtitle?: string;
  generatedAt: string;
  filters: Record<string, string>;
  headers: string[];
  rows: string[][];
  sections?: ReportSection[];
  reportType?: string;
  footer?: {
    preparedBy?: string;
    signature?: string;
    title?: string;
    dateTime?: string;
    disclaimer?: string;
  };
}

// Helper to calculate duration
const calculateDuration = (startDate: string | undefined): string => {
  if (!startDate) return 'N/A';
  const start = new Date(startDate);
  const today = new Date();
  const days = differenceInDays(today, start);
  if (days < 0) return 'Future';
  if (days === 0) return '1 day and ongoing';
  return `${days + 1} days and ongoing`;
};

// Get precaution/isolation type display - matches template format
const getPrecautionDisplay = (ipCase: IPCase): string => {
  const protocol = ipCase.protocol || 'Standard Precautions';
  const isolationTypeValue = ipCase.isolationType || ipCase.isolation_type || '';
  const isolationType = isolationTypeValue.replace('+', ' + ');

  if (protocol === 'EBP') return 'EBP';
  if (protocol === 'Isolation') {
    if (isolationType.toLowerCase() === 'ebp') return 'EBP';
    return isolationType || 'Isolation';
  }
  return protocol;
};

// Helper to format name as "LASTNAME, FIRSTNAME Active (MRN)" exactly per template
const formatResidentNameForReport = (name: string, mrn: string, status: string = 'Active'): string => {
  if (!name || name === 'Unknown') return `UNKNOWN (${mrn})`;
  
  let formattedName = name.toUpperCase();
  
  // If already in "LAST, FIRST" format, use as-is
  if (!name.includes(',')) {
    // Convert "First Last" to "LAST, FIRST"
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      const lastName = parts[parts.length - 1];
      const firstNames = parts.slice(0, -1).join(' ');
      formattedName = `${lastName.toUpperCase()}, ${firstNames.toUpperCase()}`;
    }
  }
  
  // Template format: "LASTNAME, FIRSTNAME Active (MRN)"
  return `${formattedName} ${status} (${mrn})`;
};

const formatDateValue = (value?: string): string => {
  if (!value) return '';
  const parsed = parseISO(value);
  if (!Number.isNaN(parsed.getTime())) {
    return format(parsed, 'MM/dd/yyyy');
  }
  const fallback = new Date(value);
  if (!Number.isNaN(fallback.getTime())) {
    return format(fallback, 'MM/dd/yyyy');
  }
  return value;
};

const parseDateValue = (value?: string): Date | null => {
  if (!value) return null;
  const isoDate = isoDateFromAny(value);
  if (isoDate) {
    const normalized = new Date(`${isoDate}T00:00:00`);
    if (!Number.isNaN(normalized.getTime())) {
      return normalized;
    }
  }
  const parsed = parseISO(value);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed;
  }
  const fallback = new Date(value);
  if (!Number.isNaN(fallback.getTime())) {
    return fallback;
  }
  return null;
};

const isDateInRange = (value: string | undefined, fromDate: string, toDate: string): boolean => {
  const parsedValue = parseDateValue(value);
  const parsedFrom = parseDateValue(fromDate);
  const parsedTo = parseDateValue(toDate);

  if (!parsedValue || !parsedFrom || !parsedTo) {
    return false;
  }

  const valueDay = format(parsedValue, 'yyyy-MM-dd');
  const fromDay = format(parsedFrom, 'yyyy-MM-dd');
  const toDay = format(parsedTo, 'yyyy-MM-dd');

  return valueDay >= fromDay && valueDay <= toDay;
};

const getSymptomNames = (symptoms?: string[]): string => {
  if (!symptoms || symptoms.length === 0) return '';
  return symptoms
    .map(symptomId => SYMPTOM_OPTIONS.find(option => option.id === symptomId)?.name || symptomId)
    .join(', ');
};

const getABTRoute = (record: ABTRecord): string => {
  return record.route || record.route_raw || '';
};

const getABTFrequency = (record: ABTRecord): string => {
  return record.frequency || '';
};

const getVaxStartDate = (record: VaxRecord): string | undefined => {
  const status = (record.status || '').toLowerCase();

  if (status === 'given') {
    return record.dateGiven || record.date_given;
  }

  if (status === 'due' || status === 'overdue') {
    return record.dueDate || record.due_date;
  }

  if (status === 'declined') {
    return record.educationDate
      || record.offerDate
      || record.dateGiven
      || record.date_given
      || record.createdAt;
  }

  return undefined;
};

// Daily Precaution List Report
export const generateDailyPrecautionList = (
  db: ICNDatabase,
  unitFilter: string = 'all',
  shift: string = 'Day'
): ReportData => {
  const activeCases = getActiveIPCases(db);
  
  // Filter by unit if specified
  const filtered = unitFilter === 'all' 
    ? activeCases 
    : activeCases.filter(c => c.unit.toLowerCase() === unitFilter.toLowerCase());
  
  // Sort by room number
  const sorted = [...filtered].sort((a, b) => a.room.localeCompare(b.room, undefined, { numeric: true }));
  
  const rows = sorted.map(ipCase => {
    const resident = db.census.residentsByMrn[ipCase.mrn];
    const residentName = ipCase.residentName || ipCase.name || resident?.name || 'Unknown';
    const room = ipCase.room || resident?.room || '';
    const mrn = ipCase.mrn;
    const precaution = getPrecautionDisplay(ipCase);
    const source = ipCase.sourceOfInfection || ipCase.source_of_infection || '';
    const onsetDate = ipCase.onsetDate || ipCase.onset_date || '';
    const duration = calculateDuration(onsetDate);
    
    // Format source with onset date in parentheses per template
    // e.g., "Influenza A (1/21/2026)" or "Covid (+) 1/16/2026"
    let sourceDisplay = source;
    if (onsetDate) {
      const formattedDate = format(new Date(onsetDate), 'M/d/yyyy');
      if (source) {
        sourceDisplay = `${source} (${formattedDate})`;
      } else {
        sourceDisplay = `(${formattedDate})`;
      }
    }
    
    return [
      room,
      formatResidentNameForReport(residentName, mrn, 'Active'),
      precaution,
      sourceDisplay,
      duration
    ];
  });
  
  return {
    title: 'RESIDENTS ON PRECAUTIONS OR ISOLATION',
    generatedAt: new Date().toISOString(),
    filters: {
      unit: unitFilter === 'all' ? 'All Units' : unitFilter,
      date: format(new Date(), 'MM/dd/yyyy'),
      shift
    },
    headers: ['RM. #', "RESIDENT'S NAME", 'PRECAUTION/ISOLATION', 'INFECTED SOURCE', 'DURATION'],
    rows,
    footer: {
      preparedBy: '',
      signature: '',
      title: '',
      dateTime: '',
      disclaimer: 'If the patient is known to have an MRSA, VRE or any Multidrug resistant infection or colonization, the health care worker should wear disposable gloves. Depending on the type of contact, a gown should also be worn. Patients must also wash their hands to avoid spreading the bacteria to others.'
    }
  };
};

// Daily IP Worklist Report
export const generateDailyIPWorklist = (
  db: ICNDatabase,
  unitFilter: string = 'all'
): ReportData => {
  const activeCases = getActiveIPCases(db);
  
  const filtered = unitFilter === 'all' 
    ? activeCases 
    : activeCases.filter(c => c.unit.toLowerCase() === unitFilter.toLowerCase());
  
  const sorted = [...filtered].sort((a, b) => {
    const dateA = a.nextReviewDate || a.next_review_date || '';
    const dateB = b.nextReviewDate || b.next_review_date || '';
    return dateA.localeCompare(dateB);
  });
  
  const rows = sorted.map(ipCase => {
    const resident = db.census.residentsByMrn[ipCase.mrn];
    const residentName = ipCase.residentName || ipCase.name || resident?.name || 'Unknown';
    const reviewDate = ipCase.nextReviewDate || ipCase.next_review_date || 'Not set';
    
    return [
      ipCase.room,
      residentName,
      ipCase.mrn,
      ipCase.protocol,
      ipCase.infectionType || ipCase.infection_type || '',
      ipCase.sourceOfInfection || ipCase.source_of_infection || '',
      reviewDate,
      ipCase.notes || ''
    ];
  });
  
  return {
    title: 'DAILY IP WORKLIST',
    subtitle: 'Active Isolation Precautions and EBP Cases',
    generatedAt: new Date().toISOString(),
    filters: {
      unit: unitFilter === 'all' ? 'All Units' : unitFilter,
      date: format(new Date(), 'MM/dd/yyyy')
    },
    headers: ['Room', 'Resident', 'MRN', 'Protocol', 'Infection Type', 'Source', 'Next Review', 'Notes'],
    rows
  };
};

// ABT Review Worklist Report
export const generateABTWorklist = (
  db: ICNDatabase,
  unitFilter: string = 'all'
): ReportData => {
  const activeABT = getActiveABT(db);
  
  const filtered = unitFilter === 'all' 
    ? activeABT 
    : activeABT.filter(r => r.unit.toLowerCase() === unitFilter.toLowerCase());
  
  const sorted = [...filtered].sort((a, b) => {
    const dateA = a.nextReviewDate || '';
    const dateB = b.nextReviewDate || '';
    return dateA.localeCompare(dateB);
  });
  
  const rows = sorted.map(record => {
    const resident = db.census.residentsByMrn[record.mrn];
    const residentName = record.residentName || record.name || resident?.name || 'Unknown';
    const startDate = record.startDate || record.start_date || '';
    const endDate = record.endDate || record.end_date || 'Ongoing';
    const medication = record.medication || record.med_name || '';
    
    return [
      record.room,
      residentName,
      record.mrn,
      medication,
      record.dose,
      getABTFrequency(record),
      getABTRoute(record),
      record.indication,
      startDate,
      endDate,
      record.notes || ''
    ];
  });
  
  return {
    title: 'ABT REVIEW WORKLIST',
    subtitle: 'Antibiotic Courses Requiring Review',
    generatedAt: new Date().toISOString(),
    filters: {
      unit: unitFilter === 'all' ? 'All Units' : unitFilter,
      date: format(new Date(), 'MM/dd/yyyy')
    },
    headers: ['Room', 'Resident', 'MRN', 'Medication', 'Dose', 'Frequency', 'Route', 'Indication', 'Start', 'End', 'Notes'],
    rows
  };
};

// Vaccination Due List Report
export const generateVaxDueList = (
  db: ICNDatabase,
  unitFilter: string = 'all',
  vaccineType: string = 'all'
): ReportData => {
  const vaxDue = getVaxDue(db);
  
  let filtered = unitFilter === 'all' 
    ? vaxDue 
    : vaxDue.filter(r => r.unit.toLowerCase() === unitFilter.toLowerCase());
  
  if (vaccineType !== 'all') {
    filtered = filtered.filter(r => 
      (r.vaccine || r.vaccine_type || '').toLowerCase().includes(vaccineType.toLowerCase())
    );
  }
  
  const sorted = [...filtered].sort((a, b) => {
    const dateA = a.dueDate || a.due_date || '';
    const dateB = b.dueDate || b.due_date || '';
    return dateA.localeCompare(dateB);
  });
  
  const rows = sorted.map(record => {
    const resident = db.census.residentsByMrn[record.mrn];
    const residentName = record.residentName || record.name || resident?.name || 'Unknown';
    const vaccine = record.vaccine || record.vaccine_type || '';
    const dueDate = record.dueDate || record.due_date || '';
    const lastGiven = record.dateGiven || record.date_given || 'N/A';
    
    return [
      record.room,
      residentName,
      record.mrn,
      vaccine,
      record.status.toUpperCase(),
      dueDate,
      lastGiven,
      record.notes || ''
    ];
  });
  
  return {
    title: 'VACCINATION DUE LIST',
    subtitle: 'Residents with Upcoming or Overdue Vaccinations',
    generatedAt: new Date().toISOString(),
    filters: {
      unit: unitFilter === 'all' ? 'All Units' : unitFilter,
      vaccineType: vaccineType === 'all' ? 'All Types' : vaccineType,
      date: format(new Date(), 'MM/dd/yyyy')
    },
    headers: ['Room', 'Resident', 'MRN', 'Vaccine', 'Status', 'Due Date', 'Last Given', 'Notes'],
    rows
  };
};

// Active Precautions by Unit Report
export const generateActivePrecautionsByUnit = (db: ICNDatabase): ReportData => {
  const activeCases = getActiveIPCases(db);
  
  // Group by unit
  const byUnit = activeCases.reduce((acc, ipCase) => {
    const unit = ipCase.unit || 'Unknown';
    if (!acc[unit]) acc[unit] = [];
    acc[unit].push(ipCase);
    return acc;
  }, {} as Record<string, IPCase[]>);
  
  const rows: string[][] = [];
  Object.entries(byUnit).sort().forEach(([unit, cases]) => {
    cases.forEach((ipCase, idx) => {
      const resident = db.census.residentsByMrn[ipCase.mrn];
      const residentName = ipCase.residentName || ipCase.name || resident?.name || 'Unknown';
      
      rows.push([
        idx === 0 ? unit : '',
        ipCase.room,
        residentName,
        ipCase.protocol,
        ipCase.infectionType || ipCase.infection_type || '',
        ipCase.sourceOfInfection || ipCase.source_of_infection || ''
      ]);
    });
  });
  
  return {
    title: 'ACTIVE PRECAUTIONS BY UNIT',
    subtitle: 'Current Isolation Precautions Summary',
    generatedAt: new Date().toISOString(),
    filters: {
      date: format(new Date(), 'MM/dd/yyyy')
    },
    headers: ['Unit', 'Room', 'Resident', 'Protocol', 'Infection Type', 'Source'],
    rows
  };
};

// Exposure Tracking Log
export const generateExposureLog = (
  db: ICNDatabase,
  fromDate?: string,
  toDate?: string
): ReportData => {
  const allCases = db.records.ip_cases;
  
  // Filter by date range if provided
  let filtered = allCases;
  if (fromDate) {
    filtered = filtered.filter(c => {
      const onset = c.onsetDate || c.onset_date || '';
      return onset >= fromDate;
    });
  }
  if (toDate) {
    filtered = filtered.filter(c => {
      const onset = c.onsetDate || c.onset_date || '';
      return onset <= toDate;
    });
  }
  
  const sorted = [...filtered].sort((a, b) => {
    const dateA = a.onsetDate || a.onset_date || '';
    const dateB = b.onsetDate || b.onset_date || '';
    return dateB.localeCompare(dateA); // Most recent first
  });
  
  const rows = sorted.map(ipCase => {
    const resident = db.census.residentsByMrn[ipCase.mrn];
    const residentName = ipCase.residentName || ipCase.name || resident?.name || 'Unknown';
    const onsetDate = ipCase.onsetDate || ipCase.onset_date || '';
    const resolutionDate = ipCase.resolutionDate || ipCase.resolution_date || 'Ongoing';
    
    return [
      onsetDate,
      ipCase.room,
      residentName,
      ipCase.infectionType || ipCase.infection_type || '',
      ipCase.sourceOfInfection || ipCase.source_of_infection || '',
      ipCase.protocol,
      ipCase.status,
      resolutionDate
    ];
  });
  
  return {
    title: 'EXPOSURE TRACKING LOG',
    subtitle: 'Infection Cases and Follow-ups',
    generatedAt: new Date().toISOString(),
    filters: {
      fromDate: fromDate || 'All time',
      toDate: toDate || 'Present',
      date: format(new Date(), 'MM/dd/yyyy')
    },
    headers: ['Onset Date', 'Room', 'Resident', 'Infection', 'Source', 'Protocol', 'Status', 'Resolution'],
    rows
  };
};

// Summary Statistics for Dashboard/QAPI
export const generateQAPISummary = (db: ICNDatabase): ReportData => {
  const activeCases = getActiveIPCases(db);
  const activeABT = getActiveABT(db);
  const vaxDue = getVaxDue(db);
  const totalResidents = Object.values(db.census.residentsByMrn).filter(r => r.active_on_census).length;
  
  // Count by protocol
  const ebpCount = activeCases.filter(c => c.protocol === 'EBP').length;
  const isolationCount = activeCases.filter(c => c.protocol === 'Isolation').length;
  
  // Count by infection type
  const infectionTypes = activeCases.reduce((acc, c) => {
    const type = c.infectionType || c.infection_type || 'Unknown';
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const rows = [
    ['Total Active Residents', totalResidents.toString(), '', ''],
    ['Active IP Cases', activeCases.length.toString(), 'Rate per 100', ((activeCases.length / totalResidents) * 100).toFixed(1)],
    ['  - EBP Cases', ebpCount.toString(), '', ''],
    ['  - Isolation Cases', isolationCount.toString(), '', ''],
    ['Active ABT Courses', activeABT.length.toString(), 'Rate per 100', ((activeABT.length / totalResidents) * 100).toFixed(1)],
    ['Vaccinations Due/Overdue', vaxDue.length.toString(), '', ''],
    ['', '', '', ''],
    ['INFECTION TYPES', 'Count', 'Percentage', ''],
    ...Object.entries(infectionTypes).map(([type, count]) => [
      type,
      count.toString(),
      `${((count / activeCases.length) * 100).toFixed(1)}%`,
      ''
    ])
  ];
  
  return {
    title: 'QAPI SUMMARY REPORT',
    subtitle: 'Quality Metrics and Performance Indicators',
    generatedAt: new Date().toISOString(),
    filters: {
      date: format(new Date(), 'MM/dd/yyyy')
    },
    headers: ['Metric', 'Value', 'Rate Type', 'Rate Value'],
    rows
  };
};

// Survey Readiness Packet - Comprehensive Compliance Documentation
export const generateSurveyReadinessPacket = (db: ICNDatabase): ReportData => {
  const activeCases = getActiveIPCases(db);
  const activeABT = getActiveABT(db);
  const vaxDue = getVaxDue(db);
  const allVax = db.records.vax;
  const totalResidents = Object.values(db.census.residentsByMrn).filter(r => r.active_on_census).length;
  
  // Compliance calculations
  const isolationCompliance = activeCases.filter(c => c.protocol === 'Isolation' || c.protocol === 'EBP').length;
  const abtWithIndication = activeABT.filter(r => r.indication && r.indication.length > 0).length;
  const abtIndicationRate = activeABT.length > 0 ? ((abtWithIndication / activeABT.length) * 100).toFixed(1) : '100.0';
  
  // Vaccination compliance
  const fluVax = allVax.filter(v => (v.vaccine || v.vaccine_type || '').toLowerCase().includes('flu'));
  const fluGiven = fluVax.filter(v => v.status === 'given').length;
  const fluRate = fluVax.length > 0 ? ((fluGiven / fluVax.length) * 100).toFixed(1) : 'N/A';
  
  const pneumoVax = allVax.filter(v => (v.vaccine || v.vaccine_type || '').toLowerCase().includes('pneumo'));
  const pneumoGiven = pneumoVax.filter(v => v.status === 'given').length;
  const pneumoRate = pneumoVax.length > 0 ? ((pneumoGiven / pneumoVax.length) * 100).toFixed(1) : 'N/A';
  
  const covidVax = allVax.filter(v => (v.vaccine || v.vaccine_type || '').toLowerCase().includes('covid'));
  const covidGiven = covidVax.filter(v => v.status === 'given').length;
  const covidRate = covidVax.length > 0 ? ((covidGiven / covidVax.length) * 100).toFixed(1) : 'N/A';
  
  const rows = [
    ['CENSUS SUMMARY', '', '', ''],
    ['Total Active Residents', totalResidents.toString(), '', 'Current'],
    ['', '', '', ''],
    ['INFECTION CONTROL METRICS', '', '', ''],
    ['Active Infection Cases', activeCases.length.toString(), `${((activeCases.length / totalResidents) * 100).toFixed(2)}%`, 'Rate'],
    ['Residents on Isolation', isolationCompliance.toString(), '', 'Count'],
    ['Active ABT Courses', activeABT.length.toString(), `${((activeABT.length / totalResidents) * 100).toFixed(2)}%`, 'Rate'],
    ['ABT with Documented Indication', abtWithIndication.toString(), `${abtIndicationRate}%`, 'Compliance'],
    ['', '', '', ''],
    ['VACCINATION COMPLIANCE', '', '', ''],
    ['Influenza Vaccination Rate (F883)', `${fluGiven}/${fluVax.length}`, `${fluRate}%`, fluRate !== 'N/A' && parseFloat(fluRate) >= 85 ? 'COMPLIANT' : 'REVIEW'],
    ['Pneumococcal Vaccination Rate (F883)', `${pneumoGiven}/${pneumoVax.length}`, `${pneumoRate}%`, pneumoRate !== 'N/A' && parseFloat(pneumoRate) >= 85 ? 'COMPLIANT' : 'REVIEW'],
    ['COVID-19 Vaccination Rate (F887)', `${covidGiven}/${covidVax.length}`, `${covidRate}%`, covidRate !== 'N/A' && parseFloat(covidRate) >= 85 ? 'COMPLIANT' : 'REVIEW'],
    ['Vaccinations Due/Overdue', vaxDue.length.toString(), '', 'Action Required'],
    ['', '', '', ''],
    ['DOCUMENTATION STATUS', '', '', ''],
    ['IP Cases with Notes', activeCases.filter(c => c.notes && c.notes.length > 0).length.toString(), '', ''],
    ['ABT Courses with End Dates', activeABT.filter(r => r.endDate || r.end_date).length.toString(), '', ''],
  ];
  
  return {
    title: 'SURVEY READINESS PACKET',
    subtitle: 'Comprehensive Compliance Documentation for CMS Surveys',
    generatedAt: new Date().toISOString(),
    filters: {
      date: format(new Date(), 'MM/dd/yyyy'),
      preparedFor: 'Survey Team Review'
    },
    headers: ['Category / Metric', 'Value', 'Rate/Percentage', 'Status'],
    rows,
    footer: {
      disclaimer: 'This report provides a snapshot of current compliance status. All data should be verified against primary source documentation before survey presentation.'
    }
  };
};

// Infection Rate Trends - Monthly analysis with chart data
export interface TrendDataPoint {
  month: string;
  ipCases: number;
  abtCourses: number;
  residents: number;
  ipRate: number;
  abtRate: number;
}

export interface InfectionTrendReport extends ReportData {
  chartData: TrendDataPoint[];
}

export const generateInfectionTrends = (db: ICNDatabase): InfectionTrendReport => {
  const allIPCases = db.records.ip_cases;
  const allABT = db.records.abx;
  const totalResidents = Object.values(db.census.residentsByMrn).filter(r => r.active_on_census).length;
  
  // Generate last 6 months of data
  const months: TrendDataPoint[] = [];
  const today = new Date();
  
  for (let i = 5; i >= 0; i--) {
    const monthDate = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() - i + 1, 0);
    const monthKey = format(monthDate, 'MMM yyyy');
    
    // Count cases that started in this month
    const ipInMonth = allIPCases.filter(c => {
      const onset = c.onsetDate || c.onset_date || '';
      if (!onset) return false;
      const onsetDate = new Date(onset);
      return onsetDate >= monthDate && onsetDate <= monthEnd;
    }).length;
    
    const abtInMonth = allABT.filter(r => {
      const start = r.startDate || r.start_date || '';
      if (!start) return false;
      const startDate = new Date(start);
      return startDate >= monthDate && startDate <= monthEnd;
    }).length;
    
    months.push({
      month: monthKey,
      ipCases: ipInMonth,
      abtCourses: abtInMonth,
      residents: totalResidents,
      ipRate: totalResidents > 0 ? (ipInMonth / totalResidents) * 100 : 0,
      abtRate: totalResidents > 0 ? (abtInMonth / totalResidents) * 100 : 0
    });
  }
  
  // Calculate averages and trends
  const avgIP = months.reduce((sum, m) => sum + m.ipCases, 0) / months.length;
  const avgABT = months.reduce((sum, m) => sum + m.abtCourses, 0) / months.length;
  const lastMonth = months[months.length - 1];
  const prevMonth = months[months.length - 2];
  
  const ipTrend = lastMonth && prevMonth 
    ? lastMonth.ipCases > prevMonth.ipCases ? '↑ Increasing' : lastMonth.ipCases < prevMonth.ipCases ? '↓ Decreasing' : '→ Stable'
    : '→ Stable';
  const abtTrend = lastMonth && prevMonth
    ? lastMonth.abtCourses > prevMonth.abtCourses ? '↑ Increasing' : lastMonth.abtCourses < prevMonth.abtCourses ? '↓ Decreasing' : '→ Stable'
    : '→ Stable';
  
  const rows = [
    ['MONTHLY SUMMARY', '', '', ''],
    ...months.map(m => [m.month, m.ipCases.toString(), m.abtCourses.toString(), `${m.ipRate.toFixed(1)}%`]),
    ['', '', '', ''],
    ['TREND ANALYSIS', '', '', ''],
    ['Average IP Cases/Month', avgIP.toFixed(1), ipTrend, ''],
    ['Average ABT Courses/Month', avgABT.toFixed(1), abtTrend, ''],
    ['Current Month IP Rate', `${lastMonth?.ipRate.toFixed(2) || 0}%`, '', ''],
    ['Current Month ABT Rate', `${lastMonth?.abtRate.toFixed(2) || 0}%`, '', ''],
  ];
  
  return {
    title: 'INFECTION RATE TRENDS',
    subtitle: '6-Month Infection Rate Analysis',
    generatedAt: new Date().toISOString(),
    filters: {
      period: `${months[0]?.month || ''} - ${lastMonth?.month || ''}`,
      date: format(new Date(), 'MM/dd/yyyy')
    },
    headers: ['Period', 'IP Cases', 'ABT Courses', 'IP Rate'],
    rows,
    chartData: months,
    footer: {
      disclaimer: 'Rates calculated per 100 residents based on current census. Historical resident counts may vary.'
    }
  };
};

// Compliance Crosswalk - Regulatory compliance status
export const generateComplianceCrosswalk = (db: ICNDatabase): ReportData => {
  const activeCases = getActiveIPCases(db);
  const activeABT = getActiveABT(db);
  const vaxDue = getVaxDue(db);
  const allVax = db.records.vax;
  const totalResidents = Object.values(db.census.residentsByMrn).filter(r => r.active_on_census).length;
  
  // F-Tag compliance checks
  const complianceChecks = [
    {
      ftag: 'F880',
      description: 'Infection Prevention & Control Program',
      status: activeCases.every(c => c.protocol) ? 'COMPLIANT' : 'REVIEW',
      details: `${activeCases.length} active cases with documented protocols`
    },
    {
      ftag: 'F881',
      description: 'Antibiotic Stewardship Program',
      status: activeABT.every(r => r.indication && r.indication.length > 0) ? 'COMPLIANT' : 'REVIEW',
      details: `${activeABT.length} active courses, ${activeABT.filter(r => r.indication).length} with indications`
    },
    {
      ftag: 'F883',
      description: 'Influenza Immunization',
      status: (() => {
        const flu = allVax.filter(v => (v.vaccine || '').toLowerCase().includes('flu'));
        const given = flu.filter(v => v.status === 'given').length;
        return flu.length > 0 && (given / flu.length) >= 0.85 ? 'COMPLIANT' : 'REVIEW';
      })(),
      details: `${allVax.filter(v => (v.vaccine || '').toLowerCase().includes('flu') && v.status === 'given').length} residents vaccinated`
    },
    {
      ftag: 'F884',
      description: 'Pneumococcal Immunization',
      status: (() => {
        const pneumo = allVax.filter(v => (v.vaccine || '').toLowerCase().includes('pneumo'));
        const given = pneumo.filter(v => v.status === 'given').length;
        return pneumo.length > 0 && (given / pneumo.length) >= 0.85 ? 'COMPLIANT' : 'REVIEW';
      })(),
      details: `${allVax.filter(v => (v.vaccine || '').toLowerCase().includes('pneumo') && v.status === 'given').length} residents vaccinated`
    },
    {
      ftag: 'F885',
      description: 'COVID-19 Immunization',
      status: (() => {
        const covid = allVax.filter(v => (v.vaccine || '').toLowerCase().includes('covid'));
        const given = covid.filter(v => v.status === 'given').length;
        return covid.length > 0 && (given / covid.length) >= 0.85 ? 'COMPLIANT' : 'REVIEW';
      })(),
      details: `${allVax.filter(v => (v.vaccine || '').toLowerCase().includes('covid') && v.status === 'given').length} residents vaccinated`
    },
    {
      ftag: 'F886',
      description: 'COVID-19 Testing',
      status: 'COMPLIANT',
      details: 'Testing protocols in place per facility policy'
    },
    {
      ftag: 'F887',
      description: 'COVID-19 Reporting',
      status: 'COMPLIANT',
      details: 'Weekly reporting to NHSN maintained'
    }
  ];
  
  const compliantCount = complianceChecks.filter(c => c.status === 'COMPLIANT').length;
  const reviewCount = complianceChecks.filter(c => c.status === 'REVIEW').length;
  
  const rows = [
    ['COMPLIANCE SUMMARY', '', '', ''],
    ['Total F-Tags Reviewed', complianceChecks.length.toString(), '', ''],
    ['Compliant', compliantCount.toString(), `${((compliantCount / complianceChecks.length) * 100).toFixed(0)}%`, 'PASS'],
    ['Requiring Review', reviewCount.toString(), `${((reviewCount / complianceChecks.length) * 100).toFixed(0)}%`, reviewCount > 0 ? 'ACTION' : 'PASS'],
    ['', '', '', ''],
    ['F-TAG DETAIL', '', '', ''],
    ...complianceChecks.map(c => [c.ftag, c.description, c.details, c.status])
  ];
  
  return {
    title: 'COMPLIANCE CROSSWALK',
    subtitle: 'Regulatory Compliance Status Overview - Infection Control F-Tags',
    generatedAt: new Date().toISOString(),
    filters: {
      date: format(new Date(), 'MM/dd/yyyy'),
      regulation: 'CMS F-Tags (Infection Control)'
    },
    headers: ['F-Tag / Category', 'Description', 'Details', 'Status'],
    rows,
    footer: {
      disclaimer: 'Compliance status is based on current data in the system. Manual verification of documentation is recommended before survey.'
    }
  };
};

// ============ NEW REPORTS ============

// Helper: Check if influenza vaccination is outdated (not in current flu season)
const isInfluenzaOutdated = (dateGiven: string): boolean => {
  if (!dateGiven) return true;
  const given = new Date(dateGiven);
  const now = new Date();
  // Flu season: October 1 - March 31
  // If we're in Oct-Dec, current season started this Oct
  // If we're in Jan-Sep, current season started last Oct
  const currentSeasonStart = now.getMonth() >= 9 
    ? new Date(now.getFullYear(), 9, 1)  // Oct 1 of current year
    : new Date(now.getFullYear() - 1, 9, 1); // Oct 1 of previous year
  
  return given < currentSeasonStart;
};

// Helper: Get flu season display string
const getFluSeasonDisplay = (dateGiven: string): string => {
  if (!dateGiven) return 'Not vaccinated';
  const given = new Date(dateGiven);
  // Determine which season the vaccination belongs to
  const year = given.getMonth() >= 9 ? given.getFullYear() : given.getFullYear() - 1;
  return `${year}-${year + 1} Season`;
};

// Report 1: Vaccination Snapshot Report
// Shows COUNT of vaccines given to ACTIVE residents only (excluding discharged)
export const generateVaxSnapshotReport = (
  db: ICNDatabase,
  fromDate?: string,
  toDate?: string,
  vaccineType: string = 'all'
): ReportData => {
  const allVax = db.records.vax;
  const activeResidents = Object.values(db.census.residentsByMrn).filter(r => r.active_on_census);
  const activeResidentMrns = new Set(activeResidents.map(r => r.mrn));
  
  // Filter vaccinations: only active residents, only given status
  let filtered = allVax.filter(v => {
    const dateGiven = v.dateGiven || v.date_given;
    if (!dateGiven) return false;
    
    // Only include given vaccinations
    if (v.status !== 'given') return false;
    
    // CRITICAL: Only include active residents (exclude discharged)
    if (!activeResidentMrns.has(v.mrn)) return false;
    
    // Filter by date range if provided
    if (fromDate && dateGiven < fromDate) return false;
    if (toDate && dateGiven > toDate) return false;
    
    return true;
  });
  
  // Filter by vaccine type
  if (vaccineType !== 'all') {
    filtered = filtered.filter(v => {
      const vaccine = (v.vaccine || v.vaccine_type || '').toLowerCase();
      return vaccine.includes(vaccineType.toLowerCase());
    });
  }
  
  // Count by vaccine type for summary
  const vaccineCounts: Record<string, number> = {};
  filtered.forEach(v => {
    const vaccine = (v.vaccine || v.vaccine_type || 'Unknown').toUpperCase();
    const category = vaccine.includes('FLU') || vaccine.includes('INFLUENZA') ? 'Influenza'
      : vaccine.includes('PNEUMO') ? 'Pneumonia'
      : vaccine.includes('RSV') ? 'RSV'
      : vaccine.includes('COVID') ? 'COVID-19'
      : 'Other';
    vaccineCounts[category] = (vaccineCounts[category] || 0) + 1;
  });
  
  // Sort by date given (most recent first)
  const sorted = [...filtered].sort((a, b) => {
    const dateA = a.dateGiven || a.date_given || '';
    const dateB = b.dateGiven || b.date_given || '';
    return dateB.localeCompare(dateA);
  });
  
  const rows = sorted.map(record => {
    const resident = db.census.residentsByMrn[record.mrn];
    const residentName = record.residentName || record.name || resident?.name || 'Unknown';
    const vaccine = record.vaccine || record.vaccine_type || '';
    const dateGiven = record.dateGiven || record.date_given || '';
    const isOutdated = vaccine.toLowerCase().includes('flu') && !record.seasonOverrideCurrent && isInfluenzaOutdated(dateGiven);
    const seasonInfo = vaccine.toLowerCase().includes('flu') ? getFluSeasonDisplay(dateGiven) : '';
    
    return [
      residentName,
      `${record.unit} / ${record.room}`,
      vaccine,
      dateGiven ? format(new Date(dateGiven), 'MM/dd/yyyy') : 'N/A',
      isOutdated ? 'OUTDATED' : record.status.toUpperCase(),
      seasonInfo || record.notes || ''
    ];
  });
  
  // Count outdated flu vaccinations for active residents
  const fluVax = allVax.filter(v => 
    (v.vaccine || v.vaccine_type || '').toLowerCase().includes('flu') && 
    v.status === 'given' &&
    activeResidentMrns.has(v.mrn)
  );
  const outdatedFlu = fluVax.filter(v => !v.seasonOverrideCurrent && isInfluenzaOutdated(v.dateGiven || v.date_given || ''));
  
  // Build summary string
  const summaryParts = Object.entries(vaccineCounts).map(([type, count]) => `${type}: ${count}`);
  const summaryString = summaryParts.join(' | ');
  
  return {
    title: 'VACCINATION SNAPSHOT REPORT',
    subtitle: `Active Residents Vaccination Count (Excludes Discharged)`,
    generatedAt: new Date().toISOString(),
    filters: {
      fromDate: fromDate || 'All time',
      toDate: toDate || 'Present',
      vaccineType: vaccineType === 'all' ? 'All Types' : vaccineType,
      date: format(new Date(), 'MM/dd/yyyy'),
      summary: summaryString || 'No vaccinations',
      note: outdatedFlu.length > 0 ? `⚠️ ${outdatedFlu.length} active residents need flu offer for current season` : ''
    },
    headers: ['Resident', 'Unit/Room', 'Vaccine', 'Date Given', 'Status', 'Notes'],
    rows,
    footer: {
      disclaimer: `Snapshot shows ${filtered.length} vaccinations for ${activeResidents.length} active residents. Influenza marked OUTDATED if before current flu season (Oct-Mar). Discharged residents excluded.`
    }
  };
};

// Report: Vaccine Re-offer List
// Logic: Flu - re-offer if declined within 30 days AND within flu season; COVID - re-offer if declined within 180 days
export const generateVaxReofferReport = (
  db: ICNDatabase,
  vaccineType: string = 'all'
): ReportData => {
  const allVax = db.records.vax;
  const activeResidents = Object.values(db.census.residentsByMrn).filter(r => r.active_on_census);
  const activeResidentMrns = new Set(activeResidents.map(r => r.mrn));
  const now = new Date();
  
  // Check if we're in flu season (Oct 1 - Mar 31)
  const isInFluSeason = now.getMonth() >= 9 || now.getMonth() <= 2; // Oct=9, Mar=2
  
  const reofferList: Array<{
    mrn: string;
    name: string;
    unit: string;
    room: string;
    vaccine: string;
    declinedDate: string;
    daysSinceDecline: number;
    reason: string;
  }> = [];
  
  // Group declinations by resident and vaccine type
  const declinedVax = allVax.filter(v => 
    v.status === 'declined' && 
    activeResidentMrns.has(v.mrn)
  );
  
  declinedVax.forEach(v => {
    const vaccine = (v.vaccine || v.vaccine_type || '').toLowerCase();
    const declineDate = v.dateGiven || v.date_given || v.dueDate || v.due_date || '';
    if (!declineDate) return;
    
    const declinedOn = new Date(declineDate);
    const daysSince = differenceInDays(now, declinedOn);
    const resident = db.census.residentsByMrn[v.mrn];
    const residentName = v.residentName || v.name || resident?.name || 'Unknown';
    
    let shouldReoffer = false;
    let reason = '';
    
    // Influenza: Re-offer if declined within 30 days AND we're in flu season
    if (vaccine.includes('flu') || vaccine.includes('influenza')) {
      if (isInFluSeason && daysSince >= 30) {
        shouldReoffer = true;
        reason = `Flu season active, ${daysSince} days since decline (re-offer after 30 days per CDC)`;
      } else if (isInFluSeason && daysSince < 30) {
        // Too soon to re-offer
        shouldReoffer = false;
      } else if (!isInFluSeason) {
        // Not flu season, mark for upcoming season if declined recently
        if (daysSince <= 365) {
          shouldReoffer = true;
          reason = `Offer when flu season begins (Oct 1)`;
        }
      }
    }
    
    // COVID: Re-offer if declined within 180 days
    if (vaccine.includes('covid')) {
      if (daysSince >= 180) {
        shouldReoffer = true;
        reason = `${daysSince} days since decline (re-offer after 180 days per CDC guidelines)`;
      }
    }
    
    // RSV and Pneumonia - annual re-offer
    if (vaccine.includes('rsv') || vaccine.includes('pneumo')) {
      if (daysSince >= 365) {
        shouldReoffer = true;
        reason = `${daysSince} days since decline (annual re-offer)`;
      }
    }
    
    if (shouldReoffer) {
      reofferList.push({
        mrn: v.mrn,
        name: residentName,
        unit: v.unit,
        room: v.room,
        vaccine: v.vaccine || v.vaccine_type || '',
        declinedDate: declineDate,
        daysSinceDecline: daysSince,
        reason
      });
    }
  });
  
  // Filter by vaccine type if specified
  let filtered = reofferList;
  if (vaccineType !== 'all') {
    filtered = reofferList.filter(r => 
      r.vaccine.toLowerCase().includes(vaccineType.toLowerCase())
    );
  }
  
  // Sort alphabetically by name
  const sorted = [...filtered].sort((a, b) => a.name.localeCompare(b.name));
  
  const rows = sorted.map(r => [
    r.name,
    `${r.unit} / ${r.room}`,
    r.vaccine,
    format(new Date(r.declinedDate), 'MM/dd/yyyy'),
    r.daysSinceDecline.toString(),
    r.reason
  ]);
  
  return {
    title: 'VACCINE RE-OFFER LIST',
    subtitle: 'Residents Eligible for Vaccine Re-offer Based on CDC Guidelines',
    generatedAt: new Date().toISOString(),
    filters: {
      vaccineType: vaccineType === 'all' ? 'All Types' : vaccineType,
      date: format(new Date(), 'MM/dd/yyyy'),
      fluSeason: isInFluSeason ? 'Active (Oct-Mar)' : 'Off-season',
      total: `${sorted.length} residents eligible for re-offer`
    },
    headers: ['Resident', 'Unit/Room', 'Vaccine', 'Declined Date', 'Days Since', 'Re-offer Reason'],
    rows,
    footer: {
      disclaimer: 'Re-offer guidelines: Influenza - 30 days after decline during flu season (Oct-Mar). COVID-19 - 180 days after decline. RSV/Pneumonia - annually. Document re-offer attempts and resident response.'
    }
  };
};

// Report: Surveyor Packet - Active Residents with ABT/IP Status
export const generateSurveyorPacket = (
  db: ICNDatabase,
  includeABT: boolean = true,
  includeIP: boolean = true
): ReportData => {
  const activeResidents = Object.values(db.census.residentsByMrn)
    .filter(r => r.active_on_census)
    .sort((a, b) => a.name.localeCompare(b.name)); // Alphabetical order
  
  const activeABT = db.records.abx.filter(r => r.status === 'active');
  // FIX: Include BOTH EBP and Isolation cases - check status === 'Active' 
  // (both protocols should have Active status when currently on precautions)
  const activeIP = db.records.ip_cases.filter(c => normalizeIPStatus(c.status || c.case_status) === 'active');
  
  // Build lookup maps
  const abtByMrn: Record<string, typeof activeABT> = {};
  activeABT.forEach(r => {
    if (!abtByMrn[r.mrn]) abtByMrn[r.mrn] = [];
    abtByMrn[r.mrn].push(r);
  });
  
  const ipByMrn: Record<string, typeof activeIP> = {};
  activeIP.forEach(c => {
    if (!ipByMrn[c.mrn]) ipByMrn[c.mrn] = [];
    ipByMrn[c.mrn].push(c);
  });
  
  const rows = activeResidents.map(resident => {
    const residentABT = abtByMrn[resident.mrn] || [];
    const residentIP = ipByMrn[resident.mrn] || [];
    
    let abtDetails = '—';
    let ipDetails = '—';
    
    if (includeABT && residentABT.length > 0) {
      abtDetails = residentABT.map(r => {
        const med = r.medication || r.med_name || 'Unknown';
        const indication = r.indication || 'No indication';
        const frequency = getABTFrequency(r);
        const route = getABTRoute(r);
        const regimen = [med, frequency, route].filter(Boolean).join(' ');
        return `${regimen || med} (${indication})`;
      }).join('; ');
    } else if (residentABT.length > 0) {
      abtDetails = '✓';
    }
    
    if (includeIP && residentIP.length > 0) {
      ipDetails = residentIP.map(c => {
        const protocol = c.protocol;
        const infection = c.infectionType || c.infection_type || '';
        const source = c.sourceOfInfection || c.source_of_infection || '';
        return `${protocol}${infection ? ` - ${infection}` : ''}${source ? ` (${source})` : ''}`;
      }).join('; ');
    } else if (residentIP.length > 0) {
      ipDetails = '✓';
    }
    
    return [
      resident.name,
      resident.room,
      resident.unit,
      residentABT.length > 0 ? (includeABT ? abtDetails : '✓') : '—',
      residentIP.length > 0 ? (includeIP ? ipDetails : '✓') : '—'
    ];
  });
  
  // Summary counts
  const residentsWithABT = activeResidents.filter(r => abtByMrn[r.mrn]?.length > 0).length;
  const residentsWithIP = activeResidents.filter(r => ipByMrn[r.mrn]?.length > 0).length;
  
  // Count by protocol type for footer detail
  const ebpCount = activeIP.filter(c => c.protocol === 'EBP').length;
  const isolationCount = activeIP.filter(c => c.protocol === 'Isolation').length;
  
  return {
    title: 'SURVEYOR PACKET - ACTIVE RESIDENT LIST',
    subtitle: 'Current Census with Active ABT and IP Status',
    generatedAt: new Date().toISOString(),
    filters: {
      unit: '', // For PDF header compatibility
      date: format(new Date(), 'MM/dd/yyyy'),
      shift: '—',
      totalResidents: activeResidents.length.toString(),
      residentsOnABT: residentsWithABT.toString(),
      residentsOnIP: residentsWithIP.toString(),
      showABTDetails: includeABT ? 'Yes' : 'Checkbox Only',
      showIPDetails: includeIP ? 'Yes' : 'Checkbox Only'
    },
    headers: ['Resident Name', 'Room', 'Unit', 'Active ABT', 'Active IP/Precautions'],
    rows
    // NO footer for surveyor packet per user request
  };
};

// Report 2: Standard of Care Weekly Report
export const generateStandardOfCareReport = (
  db: ICNDatabase,
  fromDate: string,
  toDate: string,
  residentFilterConfig: ResidentFilterConfig = {
    mode: 'active_in_period',
    dateRange: { fromDate, toDate },
    showDischargedLabel: true,
  }
): ReportData => {
  const sections: ReportSection[] = [];
  const allowedMrns = getFilteredResidents(db, { ...residentFilterConfig, dateRange: { fromDate, toDate } });
  
  // Section 1: ABT regimens started within date range
  const abtStarted = db.records.abx.filter(r => {
    if (!allowedMrns.has(r.mrn)) return false;
    const start = r.startDate || r.start_date;
    return isDateInRange(start, fromDate, toDate);
  });
  
  const abtRows = abtStarted.length === 0
    ? [['No new antibiotic regimens in this period', '', '', '', '', '', '', '', '', '']]
    : abtStarted.map(record => {
      const resident = db.census.residentsByMrn[record.mrn];
      const residentName = record.residentName || record.name || resident?.name || 'Unknown';
      const medication = record.medication || record.med_name || '';
      const route = getABTRoute(record);
      const frequency = getABTFrequency(record);
      const startDate = formatDateValue(record.startDate || record.start_date || '');
      const endDate = formatDateValue(record.endDate || record.end_date || '');
      const indication = record.indication || '';
      const source = record.infection_source || record.sourceOfInfection || record.source_of_infection || '';
      
      return [
        record.unit,
        record.room,
        residentName,
        medication,
        record.dose || '',
        frequency,
        indication,
        source,
        route,
        startDate,
        endDate
      ];
    });
  
  sections.push({
    title: 'Antibiotic Review',
    headers: ['Unit', 'Room', 'Name', 'Medication', 'Dose', 'Frequency', 'Indication', 'Source', 'Route', 'Start', 'End'],
    rows: abtRows
  });
  
  // Section 2: IP cases started within date range
  const ipStarted = db.records.ip_cases.filter(c => {
    if (!allowedMrns.has(c.mrn)) return false;
    const initiationDate = c.onsetDate || c.onset_date;
    return isDateInRange(initiationDate, fromDate, toDate);
  });
  
  const ipRows: string[][] = ipStarted.length === 0
    ? [['No new precaution starts in this period', '', '', '', '', '', '']]
    : ipStarted.map(ipCase => {
      const resident = db.census.residentsByMrn[ipCase.mrn];
      const residentName = ipCase.residentName || ipCase.name || resident?.name || 'Unknown';
      const precautionType = getPrecautionDisplay(ipCase);
      const isolationType = ipCase.isolationType || ipCase.isolation_type || '';
      const source = ipCase.sourceOfInfection || ipCase.source_of_infection || '';
      const startDate = formatDateValue(ipCase.onsetDate || ipCase.onset_date || '');
      
      return [
        ipCase.unit,
        ipCase.room,
        residentName,
        precautionType,
        isolationType,
        source,
        startDate
      ];
    });
  
  sections.push({
    title: 'Precaution List Review',
    headers: ['Unit', 'Room', 'Name', 'Precaution Type', 'Isolation Type', 'Source', 'Onset Date'],
    rows: ipRows
  });
  
  // Section 3: VAX records within date range
  const vaxInRange = db.records.vax.filter(v => {
    if (!allowedMrns.has(v.mrn)) return false;
    const startDate = getVaxStartDate(v);
    return isDateInRange(startDate, fromDate, toDate);
  });
  
  const vaxRows = vaxInRange.length === 0
    ? [['No vaccination activity in this period', '', '', '', '', '']]
    : vaxInRange.map(record => {
      const resident = db.census.residentsByMrn[record.mrn];
      const residentName = record.residentName || record.name || resident?.name || 'Unknown';
      const vaccine = record.vaccine || record.vaccine_type || '';
      const date = formatDateValue(getVaxStartDate(record) || '');
      
      return [
        record.unit,
        record.room,
        residentName,
        vaccine,
        (record.status || '').toUpperCase(),
        date
      ];
    });
  
  sections.push({
    title: 'Vaccination Review',
    headers: ['Unit', 'Room', 'Name', 'Vaccine', 'Status', 'Date'],
    rows: vaxRows
  });
  
  return {
    title: 'STANDARD OF CARE WEEKLY REPORT',
    subtitle: 'Those started on the date range selected',
    generatedAt: new Date().toISOString(),
    filters: {
      fromDate: formatDateValue(fromDate),
      toDate: formatDateValue(toDate),
      date: format(new Date(), 'MM/dd/yyyy')
    },
    headers: [],
    rows: [],
    sections,
    reportType: 'standard_of_care',
    footer: {
      disclaimer: 'Weekly standard of care documentation for quality assurance and regulatory compliance.'
    }
  };
};

// Report 3: Follow-up/Overdue Notes Report
export const generateFollowUpNotesReport = (
  db: ICNDatabase,
  statusFilter: string = 'all'
): ReportData => {
  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');
  
  // Filter notes that require follow-up
  let followUpNotes = db.records.notes.filter(n => n.requiresFollowUp === true);
  
  // Apply status filter
  if (statusFilter !== 'all') {
    followUpNotes = followUpNotes.filter(n => n.followUpStatus === statusFilter);
  }
  
  // Sort by follow-up date (overdue first, then by date)
  const sorted = [...followUpNotes].sort((a, b) => {
    const dateA = a.followUpDate || '';
    const dateB = b.followUpDate || '';
    
    // Overdue items first
    const aOverdue = dateA && dateA < todayStr;
    const bOverdue = dateB && dateB < todayStr;
    
    if (aOverdue && !bOverdue) return -1;
    if (!aOverdue && bOverdue) return 1;
    
    return dateA.localeCompare(dateB);
  });
  
  const rows = sorted.map(note => {
    const resident = db.census.residentsByMrn[note.mrn];
    const residentName = note.residentName || note.name || resident?.name || 'Unknown';
    const noteDate = note.createdAt || note.created_at || '';
    const followUpDate = note.followUpDate || '';
    const isOverdue = followUpDate && followUpDate < todayStr && note.followUpStatus !== 'completed';
    const daysOverdue = followUpDate && isOverdue 
      ? differenceInDays(today, new Date(followUpDate))
      : 0;
    
    const statusDisplay = note.followUpStatus === 'completed' 
      ? '✓ COMPLETED' 
      : note.followUpStatus === 'escalated'
        ? '⚠️ ESCALATED'
        : isOverdue 
          ? `🔴 OVERDUE (${daysOverdue}d)`
          : '⏳ PENDING';
    
    return [
      noteDate ? format(new Date(noteDate), 'MM/dd/yyyy') : '',
      residentName,
      `${note.unit} / ${note.room}`,
      note.text.length > 50 ? note.text.substring(0, 50) + '...' : note.text,
      followUpDate ? format(new Date(followUpDate), 'MM/dd/yyyy') : 'No date set',
      statusDisplay,
      note.followUpNotes || ''
    ];
  });
  
  // Count summaries
  const overdue = sorted.filter(n => n.followUpDate && n.followUpDate < todayStr && n.followUpStatus !== 'completed').length;
  const pending = sorted.filter(n => n.followUpStatus === 'pending' || !n.followUpStatus).length;
  const completed = sorted.filter(n => n.followUpStatus === 'completed').length;
  
  return {
    title: 'FOLLOW-UP NOTES REPORT',
    subtitle: `Overdue: ${overdue} | Pending: ${pending} | Completed: ${completed}`,
    generatedAt: new Date().toISOString(),
    filters: {
      status: statusFilter === 'all' ? 'All Statuses' : statusFilter.toUpperCase(),
      date: format(new Date(), 'MM/dd/yyyy')
    },
    headers: ['Note Date', 'Resident', 'Unit/Room', 'Note Summary', 'Follow-up Date', 'Status', 'Sign-off Notes'],
    rows,
    footer: {
      disclaimer: 'Items marked as OVERDUE require immediate attention. Sign-off notes should document completion of follow-up actions.'
    }
  };
};

// Report 4: Monthly ABT Report
export const generateMonthlyABTReport = (
  db: ICNDatabase,
  month: number,
  year: number,
  residentFilterConfig: ResidentFilterConfig = {
    mode: 'active_in_period',
    showDischargedLabel: true,
  }
): ReportData => {
  const monthStart = startOfMonth(new Date(year, month));
  const monthEnd = endOfMonth(new Date(year, month));
  const monthStartStr = format(monthStart, 'yyyy-MM-dd');
  const monthEndStr = format(monthEnd, 'yyyy-MM-dd');
  
  const allowedMrns = getFilteredResidents(db, {
    ...residentFilterConfig,
    dateRange: residentFilterConfig.dateRange || { fromDate: monthStartStr, toDate: monthEndStr },
  });

  // Find all ABT records active during the selected month
  // Active means: startDate <= month end AND (endDate >= month start OR endDate is null/ongoing)
  const activeInMonth = db.records.abx.filter(r => {
    if (!allowedMrns.has(r.mrn)) return false;
    const startDate = r.startDate || r.start_date || '';
    const endDate = r.endDate || r.end_date || '';
    
    if (!startDate) return false;
    
    // Started before or during the month
    if (startDate > monthEndStr) return false;
    
    // Still active during the month (no end date or end date >= month start)
    if (endDate && endDate < monthStartStr) return false;
    
    return true;
  });
  
  // Sort by start date
  const sorted = [...activeInMonth].sort((a, b) => {
    const dateA = a.startDate || a.start_date || '';
    const dateB = b.startDate || b.start_date || '';
    return dateA.localeCompare(dateB);
  });
  
  const rows = sorted.map(record => {
    const resident = db.census.residentsByMrn[record.mrn];
    const residentName = record.residentName || record.name || resident?.name || 'Unknown';
    const medication = record.medication || record.med_name || '';
    const startDate = record.startDate || record.start_date || '';
    const endDate = record.endDate || record.end_date || '';
    const days = record.daysOfTherapy || record.tx_days || 
      (startDate ? differenceInDays(endDate ? new Date(endDate) : new Date(), new Date(startDate)) + 1 : 'N/A');
    const medicationClass = inferMedicationClassFromRecord(record);

    return [
      residentName,
      `${record.unit} / ${record.room}`,
      medication,
      medicationClass,
      record.dose,
      getABTFrequency(record),
      getABTRoute(record),
      record.indication || '',
      startDate ? format(new Date(startDate), 'MM/dd/yyyy') : '',
      endDate ? format(new Date(endDate), 'MM/dd/yyyy') : 'Ongoing',
      days.toString()
    ];
  });
  
  return {
    title: 'MONTHLY ANTIBIOTIC REPORT',
    subtitle: `Residents on Antibiotics - ${format(monthStart, 'MMMM yyyy')}`,
    generatedAt: new Date().toISOString(),
    filters: {
      month: format(monthStart, 'MMMM yyyy'),
      totalCourses: sorted.length.toString(),
      date: format(new Date(), 'MM/dd/yyyy')
    },
    headers: ['Resident', 'Unit/Room', 'Medication', 'Medication Class', 'Dose', 'Frequency', 'Route', 'Indication', 'Start', 'End', 'Days'],
    rows,
    footer: {
      disclaimer: 'Report includes all antibiotic courses that were active at any point during the selected month.'
    }
  };
};

// Report 5: Medicare ABT Compliance Report
export const generateMedicareABTComplianceReport = (db: ICNDatabase): ReportData => {
  const allABT = db.records.abx;
  const today = new Date();
  
  // Flag records with compliance issues
  const flaggedRecords: Array<{ record: ABTRecord; issues: string[] }> = [];
  
  allABT.forEach(record => {
    const issues: string[] = [];
    const indication = (record.indication || '').toLowerCase();
    const startDate = record.startDate || record.start_date || '';
    const endDate = record.endDate || record.end_date || '';
    
    // Issue 1: Missing indication
    if (!indication || indication.trim() === '') {
      issues.push('Missing indication');
    }
    
    // Issue 2: Prophylaxis without documented bacterial source
    if (indication.includes('prophylaxis') && !indication.includes('surg') && !indication.includes('peri')) {
      const hasSource = indication.includes('uti') || indication.includes('wound') || 
                       indication.includes('pneumonia') || indication.includes('cellulitis') ||
                       indication.includes('sepsis');
      if (!hasSource) {
        issues.push('Prophylaxis without documented bacterial source');
      }
    }
    
    // Issue 3: Duration > 14 days without reassessment
    if (startDate) {
      const durationDays = endDate 
        ? differenceInDays(new Date(endDate), new Date(startDate))
        : differenceInDays(today, new Date(startDate));
      
      if (durationDays > 14) {
        // Check if there are review notes indicating reassessment
        const hasReassessment = record.notes && (
          record.notes.toLowerCase().includes('reassess') ||
          record.notes.toLowerCase().includes('reviewed') ||
          record.notes.toLowerCase().includes('continue per') ||
          record.notes.toLowerCase().includes('extended')
        );
        
        if (!hasReassessment) {
          issues.push(`Duration ${durationDays} days - needs documented reassessment`);
        }
      }
    }
    
    // Issue 4: Vague or inappropriate indications
    const vagueTerms = ['infection', 'prophylaxis', 'prevention', 'other'];
    if (vagueTerms.some(term => indication === term)) {
      issues.push('Vague indication - needs specific diagnosis');
    }
    
    if (issues.length > 0) {
      flaggedRecords.push({ record, issues });
    }
  });
  
  const rows = flaggedRecords.map(({ record, issues }) => {
    const resident = db.census.residentsByMrn[record.mrn];
    const residentName = record.residentName || record.name || resident?.name || 'Unknown';
    const medication = record.medication || record.med_name || '';
    const startDate = record.startDate || record.start_date || '';
    const endDate = record.endDate || record.end_date || '';
    const durationDays = startDate 
      ? (endDate 
          ? differenceInDays(new Date(endDate), new Date(startDate))
          : differenceInDays(today, new Date(startDate)))
      : 'N/A';
    
    return [
      residentName,
      medication,
      record.dose || '',
      getABTFrequency(record),
      getABTRoute(record),
      record.indication || 'MISSING',
      startDate ? format(new Date(startDate), 'MM/dd/yyyy') : '',
      durationDays.toString(),
      issues.join('; ')
    ];
  });
  
  return {
    title: 'MEDICARE ABT COMPLIANCE REPORT',
    subtitle: `Antibiotic Regimens with Compliance Issues - ${flaggedRecords.length} flagged`,
    generatedAt: new Date().toISOString(),
    filters: {
      totalCourses: allABT.length.toString(),
      flaggedCourses: flaggedRecords.length.toString(),
      complianceRate: allABT.length > 0 
        ? `${(((allABT.length - flaggedRecords.length) / allABT.length) * 100).toFixed(1)}%`
        : '100%',
      date: format(new Date(), 'MM/dd/yyyy')
    },
    headers: ['Resident', 'Medication', 'Dose', 'Frequency', 'Route', 'Indication', 'Start Date', 'Duration (Days)', 'Compliance Issues'],
    rows,
    footer: {
      disclaimer: 'This report identifies antibiotic regimens that may not meet Medicare documentation requirements. Issues include missing indications, prophylaxis without bacterial source documentation, and prolonged therapy without documented reassessment.'
    }
  };
};

// Report 6: IP Tracker Review Report
export const generateIPReviewReport = (
  db: ICNDatabase,
  fromDate?: string,
  toDate?: string,
  protocolFilter: string = 'all'
): ReportData => {
  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');
  
  // Get active IP cases
  let activeCases = getActiveIPCases(db);
  
  // Filter by protocol if specified
  if (protocolFilter !== 'all') {
    activeCases = activeCases.filter(c => c.protocol === protocolFilter);
  }
  
  // Calculate review due dates based on protocol cadence
  const casesWithReview = activeCases.map(ipCase => {
    const onsetDate = ipCase.onsetDate || ipCase.onset_date || '';
    const lastReview = ipCase.lastReviewDate || onsetDate;
    const protocol = ipCase.protocol;
    
    // Review cadence: EBP = 7 days, Isolation = 3 days
    const reviewDays = protocol === 'EBP' ? 7 : protocol === 'Isolation' ? 3 : 7;
    
    let nextReviewDue = '';
    if (lastReview) {
      const lastReviewDate = new Date(lastReview);
      const nextReview = addDays(lastReviewDate, reviewDays);
      nextReviewDue = format(nextReview, 'yyyy-MM-dd');
    }
    
    const isOverdue = nextReviewDue && nextReviewDue < todayStr;
    const daysOverdue = isOverdue ? differenceInDays(today, new Date(nextReviewDue)) : 0;
    
    return {
      ...ipCase,
      lastReview,
      nextReviewDue,
      isOverdue,
      daysOverdue,
      reviewDays
    };
  });
  
  // Filter by date range if provided (based on next review date)
  let filtered = casesWithReview;
  if (fromDate) {
    filtered = filtered.filter(c => c.nextReviewDue >= fromDate);
  }
  if (toDate) {
    filtered = filtered.filter(c => c.nextReviewDue <= toDate);
  }
  
  // Sort by review due date (overdue first, then by next due)
  const sorted = [...filtered].sort((a, b) => {
    if (a.isOverdue && !b.isOverdue) return -1;
    if (!a.isOverdue && b.isOverdue) return 1;
    return a.nextReviewDue.localeCompare(b.nextReviewDue);
  });
  
  const rows = sorted.map(ipCase => {
    const resident = db.census.residentsByMrn[ipCase.mrn];
    const residentName = ipCase.residentName || ipCase.name || resident?.name || 'Unknown';
    const onsetDate = ipCase.onsetDate || ipCase.onset_date || '';
    
    const statusDisplay = ipCase.isOverdue 
      ? `🔴 OVERDUE (${ipCase.daysOverdue}d)`
      : ipCase.nextReviewDue === todayStr 
        ? '⚠️ DUE TODAY'
        : '⏳ SCHEDULED';
    
    return [
      residentName,
      `${ipCase.unit} / ${ipCase.room}`,
      `${ipCase.protocol} (${ipCase.reviewDays}d cycle)`,
      ipCase.infectionType || ipCase.infection_type || '',
      onsetDate ? format(new Date(onsetDate), 'MM/dd/yyyy') : '',
      ipCase.lastReview ? format(new Date(ipCase.lastReview), 'MM/dd/yyyy') : 'Initial',
      ipCase.nextReviewDue ? format(new Date(ipCase.nextReviewDue), 'MM/dd/yyyy') : '',
      statusDisplay,
      ipCase.reviewNotes || ''
    ];
  });
  
  // Summary counts
  const overdue = sorted.filter(c => c.isOverdue).length;
  const dueToday = sorted.filter(c => c.nextReviewDue === todayStr).length;
  const upcoming = sorted.length - overdue - dueToday;
  
  return {
    title: 'IP TRACKER REVIEW REPORT',
    subtitle: `Review Worklist - Overdue: ${overdue} | Due Today: ${dueToday} | Upcoming: ${upcoming}`,
    generatedAt: new Date().toISOString(),
    filters: {
      protocol: protocolFilter === 'all' ? 'All Protocols' : protocolFilter,
      fromDate: fromDate || 'All time',
      toDate: toDate || 'Present',
      date: format(new Date(), 'MM/dd/yyyy')
    },
    headers: ['Resident', 'Unit/Room', 'Protocol', 'Infection', 'Onset', 'Last Review', 'Next Due', 'Status', 'Review Notes'],
    rows,
    footer: {
      disclaimer: 'Review cadence: EBP = every 7 days, Isolation = every 3 days. Overdue items require immediate attention. Document review notes when completing assessments.'
    }
  };
};

// Hand Hygiene Compliance Report
export const generateHandHygieneReport = (
  db: ICNDatabase,
  fromDate?: string,
  toDate?: string
): ReportData => {
  const today = format(new Date(), 'yyyy-MM-dd');
  const defaultFrom = fromDate || format(subDays(new Date(), 30), 'yyyy-MM-dd');
  const defaultTo = toDate || today;
  
  // Get active units for observation tracking
  const units = [...new Set(
    Object.values(db.census.residentsByMrn)
      .filter(r => r.active_on_census && r.unit)
      .map(r => r.unit)
  )].sort();
  
  // Generate template rows for hand hygiene auditing
  // In a real implementation, this would pull from an audits table
  const rows = units.map(unit => {
    const residentsInUnit = Object.values(db.census.residentsByMrn)
      .filter(r => r.active_on_census && r.unit === unit).length;
    
    return [
      unit,
      residentsInUnit.toString(),
      '', // Total Opportunities - to be filled
      '', // Observed Compliance
      '', // Compliance Rate %
      '', // Before Patient Contact
      '', // After Patient Contact
      '', // After Body Fluid Exposure
      '', // After Touching Surroundings
      '', // Gel/Foam vs Soap %
      '' // Notes
    ];
  });
  
  // Add summary row
  const totalResidents = Object.values(db.census.residentsByMrn)
    .filter(r => r.active_on_census).length;
  
  rows.push([
    'FACILITY TOTAL',
    totalResidents.toString(),
    '', '', '', '', '', '', '', '', ''
  ]);
  
  return {
    title: 'HAND HYGIENE COMPLIANCE AUDIT REPORT',
    subtitle: 'CDC 5 Moments of Hand Hygiene Monitoring',
    generatedAt: new Date().toISOString(),
    filters: {
      fromDate: defaultFrom,
      toDate: defaultTo,
      date: format(new Date(), 'MM/dd/yyyy')
    },
    headers: [
      'Unit',
      'Census',
      'Opportunities',
      'Compliant',
      'Rate %',
      'Before Contact',
      'After Contact',
      'After Fluid',
      'After Surround',
      'Gel vs Soap',
      'Notes'
    ],
    rows,
    footer: {
      disclaimer: 'Hand hygiene compliance based on WHO/CDC 5 Moments: (1) Before patient contact, (2) Before aseptic task, (3) After body fluid exposure, (4) After patient contact, (5) After touching patient surroundings. Target compliance: ≥85%. Record observations during routine care activities across all shifts.'
    }
  };
};

// PPE Usage Tracking Report
export const generatePPEUsageReport = (
  db: ICNDatabase,
  fromDate?: string,
  toDate?: string
): ReportData => {
  const today = format(new Date(), 'yyyy-MM-dd');
  const defaultFrom = fromDate || format(subDays(new Date(), 30), 'yyyy-MM-dd');
  const defaultTo = toDate || today;
  
  // Get units with active precautions
  const activeIPCases = getActiveIPCases(db);
  const unitIPCounts = activeIPCases.reduce((acc, c) => {
    const unit = c.unit || 'Unknown';
    acc[unit] = (acc[unit] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const units = [...new Set(
    Object.values(db.census.residentsByMrn)
      .filter(r => r.active_on_census && r.unit)
      .map(r => r.unit)
  )].sort();
  
  // Generate template rows for PPE tracking
  const rows = units.map(unit => {
    const residentsInUnit = Object.values(db.census.residentsByMrn)
      .filter(r => r.active_on_census && r.unit === unit).length;
    const ipCasesInUnit = unitIPCounts[unit] || 0;
    
    return [
      unit,
      residentsInUnit.toString(),
      ipCasesInUnit.toString(),
      '', // Gloves Used
      '', // Gowns Used
      '', // Masks Used
      '', // N95s Used
      '', // Eye Protection
      '', // Compliance Observations
      '', // Compliance Rate
      '' // Notes
    ];
  });
  
  // Summary row
  const totalResidents = Object.values(db.census.residentsByMrn)
    .filter(r => r.active_on_census).length;
  const totalIPCases = activeIPCases.length;
  
  rows.push([
    'FACILITY TOTAL',
    totalResidents.toString(),
    totalIPCases.toString(),
    '', '', '', '', '', '', '', ''
  ]);
  
  // Add PPE by precaution type summary
  const ebpCases = activeIPCases.filter(c => c.protocol === 'EBP').length;
  const isolationCases = activeIPCases.filter(c => c.protocol === 'Isolation').length;
  const contactCases = activeIPCases.filter(c => c.isolationType === 'Contact' || c.isolation_type === 'Contact').length;
  const dropletCases = activeIPCases.filter(c => c.isolationType === 'Droplet' || c.isolation_type === 'Droplet').length;
  const airborneCases = activeIPCases.filter(c => c.isolationType === 'Airborne' || c.isolation_type === 'Airborne').length;
  
  rows.push(
    ['', '', '', '', '', '', '', '', '', '', ''],
    ['PRECAUTION SUMMARY', '', '', '', '', '', '', '', '', '', ''],
    ['EBP Cases', ebpCases.toString(), 'Gloves + Gown for high-contact care', '', '', '', '', '', '', '', ''],
    ['Contact Isolation', contactCases.toString(), 'Gloves + Gown required', '', '', '', '', '', '', '', ''],
    ['Droplet Isolation', dropletCases.toString(), 'Surgical Mask + Gloves + Gown', '', '', '', '', '', '', '', ''],
    ['Airborne Isolation', airborneCases.toString(), 'N95 + Gloves + Gown + Eye Protection', '', '', '', '', '', '', '', '']
  );
  
  return {
    title: 'PPE USAGE & COMPLIANCE TRACKING REPORT',
    subtitle: 'Personal Protective Equipment Monitoring by Unit',
    generatedAt: new Date().toISOString(),
    filters: {
      fromDate: defaultFrom,
      toDate: defaultTo,
      date: format(new Date(), 'MM/dd/yyyy')
    },
    headers: [
      'Unit',
      'Census',
      'IP Cases',
      'Gloves',
      'Gowns',
      'Masks',
      'N95s',
      'Eye Prot.',
      'Observations',
      'Compliance',
      'Notes'
    ],
    rows,
    footer: {
      disclaimer: 'PPE requirements: EBP (gloves + gown for high-contact activities), Contact (gloves + gown), Droplet (surgical mask + gloves + gown), Airborne (N95 + eye protection + gloves + gown). Document donning/doffing observations and any breaks in technique. Target compliance: ≥95%.'
    }
  };
};

// Combined Hand Hygiene and PPE Audit Summary (for surveyors)
export const generateHHPPEAuditSummary = (
  db: ICNDatabase,
  fromDate?: string,
  toDate?: string
): ReportData => {
  const today = format(new Date(), 'yyyy-MM-dd');
  const defaultFrom = fromDate || format(subDays(new Date(), 30), 'yyyy-MM-dd');
  const defaultTo = toDate || today;
  
  const totalResidents = Object.values(db.census.residentsByMrn)
    .filter(r => r.active_on_census).length;
  const activeIPCases = getActiveIPCases(db);
  
  const rows = [
    ['HAND HYGIENE METRICS', '', '', ''],
    ['Total Observation Opportunities', '', '', 'Fill in from audits'],
    ['Compliant Observations', '', '', 'Fill in from audits'],
    ['Overall Compliance Rate', '', '', 'Target: ≥85%'],
    ['', '', '', ''],
    ['BREAKDOWN BY 5 MOMENTS', '', '', ''],
    ['1. Before Patient Contact', '', '', ''],
    ['2. Before Aseptic Task', '', '', ''],
    ['3. After Body Fluid Exposure Risk', '', '', ''],
    ['4. After Patient Contact', '', '', ''],
    ['5. After Touching Patient Surroundings', '', '', ''],
    ['', '', '', ''],
    ['PPE COMPLIANCE METRICS', '', '', ''],
    ['Total Observations', '', '', 'Fill in from audits'],
    ['Correct Donning Observed', '', '', ''],
    ['Correct Doffing Observed', '', '', ''],
    ['Overall PPE Compliance', '', '', 'Target: ≥95%'],
    ['', '', '', ''],
    ['CURRENT PRECAUTION STATUS', '', '', ''],
    ['Active IP Cases', activeIPCases.length.toString(), `${((activeIPCases.length / totalResidents) * 100).toFixed(1)}%`, 'of census'],
    ['EBP Cases', activeIPCases.filter(c => c.protocol === 'EBP').length.toString(), '', ''],
    ['Isolation Cases', activeIPCases.filter(c => c.protocol === 'Isolation').length.toString(), '', ''],
    ['', '', '', ''],
    ['TRAINING & COMPETENCY', '', '', ''],
    ['Staff Trained This Period', '', '', 'Fill in from records'],
    ['Competency Validations', '', '', 'Fill in from records'],
    ['Remediation Required', '', '', 'Fill in from records'],
  ];
  
  return {
    title: 'HAND HYGIENE & PPE AUDIT SUMMARY',
    subtitle: 'Compliance Documentation for Surveyor Review',
    generatedAt: new Date().toISOString(),
    filters: {
      fromDate: defaultFrom,
      toDate: defaultTo,
      date: format(new Date(), 'MM/dd/yyyy')
    },
    headers: ['Metric', 'Count', 'Rate', 'Notes'],
    rows,
    footer: {
      disclaimer: 'This report provides a template for documenting hand hygiene and PPE compliance as required by CMS F-Tag 880 (Infection Prevention and Control). Complete audit data should be entered from direct observation records. National benchmark for hand hygiene: 85%+; PPE compliance: 95%+.'
    }
  };
};

// ============ NEW HIGH-VALUE REPORTS ============

// 1. Antibiotic Duration Analysis Report
// Tracks prolonged antibiotic courses that may need stewardship review
export const generateAntibioticDurationReport = (
  db: ICNDatabase,
  thresholdDays: number = 7
): ReportData => {
  const allABT = db.records.abx;
  const today = new Date();
  
  // Find courses that are active or recently completed with duration >= threshold
  const longCourses = allABT.filter(abt => {
    const startDate = abt.startDate || abt.start_date;
    if (!startDate) return false;
    
    const start = parseISO(startDate);
    const end = abt.endDate || abt.end_date ? parseISO(abt.endDate || abt.end_date || '') : today;
    const duration = differenceInDays(end, start) + 1;
    
    return duration >= thresholdDays;
  }).sort((a, b) => {
    const startA = parseISO(a.startDate || a.start_date || '');
    const startB = parseISO(b.startDate || b.start_date || '');
    return startB.getTime() - startA.getTime();
  });
  
  const rows = longCourses.map(abt => {
    const resident = db.census.residentsByMrn[abt.mrn];
    const residentName = abt.residentName || abt.name || resident?.name || 'Unknown';
    const startDate = abt.startDate || abt.start_date || '';
    const endDate = abt.endDate || abt.end_date || 'Ongoing';
    const start = startDate ? parseISO(startDate) : today;
    const end = endDate !== 'Ongoing' ? parseISO(endDate) : today;
    const duration = differenceInDays(end, start) + 1;
    const medication = abt.medication || abt.med_name || '';
    
    // Flag if > 14 days (high priority for review)
    const priority = duration > 14 ? '⚠️ HIGH' : duration > 10 ? 'MEDIUM' : 'STANDARD';
    
    return [
      abt.room || resident?.room || '',
      residentName,
      abt.mrn,
      medication,
      abt.dose || '',
      getABTFrequency(abt),
      getABTRoute(abt),
      abt.indication || '',
      format(start, 'MM/dd/yyyy'),
      endDate !== 'Ongoing' ? format(end, 'MM/dd/yyyy') : 'Ongoing',
      `${duration} days`,
      priority
    ];
  });
  
  // Summary statistics
  const totalLongCourses = longCourses.length;
  const avgDuration = longCourses.length > 0 
    ? longCourses.reduce((sum, abt) => {
        const start = parseISO(abt.startDate || abt.start_date || '');
        const end = (abt.endDate || abt.end_date) ? parseISO(abt.endDate || abt.end_date || '') : today;
        return sum + differenceInDays(end, start) + 1;
      }, 0) / longCourses.length
    : 0;
  const highPriorityCount = rows.filter(r => r[11] === '⚠️ HIGH').length;
  
  return {
    title: 'ANTIBIOTIC DURATION ANALYSIS',
    subtitle: `Courses ≥ ${thresholdDays} Days - Stewardship Review Required`,
    generatedAt: new Date().toISOString(),
    filters: {
      threshold: `${thresholdDays}+ days`,
      date: format(new Date(), 'MM/dd/yyyy')
    },
    headers: ['Room', 'Resident', 'MRN', 'Antibiotic', 'Dose', 'Frequency', 'Route', 'Indication', 'Start', 'End', 'Duration', 'Priority'],
    rows,
    footer: {
      preparedBy: '',
      signature: '',
      title: '',
      dateTime: '',
      disclaimer: `Total courses ≥${thresholdDays} days: ${totalLongCourses} | Average duration: ${avgDuration.toFixed(1)} days | High priority (>14 days): ${highPriorityCount}. Per CMS F881 Antibiotic Stewardship, prolonged courses require documented clinical justification and periodic review.`
    }
  };
};

// 2. New Admission IP Screening Report
// Tracks residents admitted within specified days who need infection screening
export const generateNewAdmissionScreeningReport = (
  db: ICNDatabase,
  daysBack: number = 14
): ReportData => {
  const today = new Date();
  const cutoffDate = subDays(today, daysBack);
  
  // Find recent admissions
  const recentAdmissions = Object.values(db.census.residentsByMrn)
    .filter(r => {
      if (!r.active_on_census) return false;
      const admitDate = r.admitDate;
      if (!admitDate) return false;
      try {
        const admit = parseISO(admitDate);
        return admit >= cutoffDate;
      } catch {
        return false;
      }
    })
    .sort((a, b) => {
      const dateA = parseISO(a.admitDate || '');
      const dateB = parseISO(b.admitDate || '');
      return dateB.getTime() - dateA.getTime();
    });
  
  // Only include census-detected new admissions that do not already exist in IP screening/cases.
  const rows = recentAdmissions
    .filter((resident) => !db.records.ip_cases.some((c) => c.mrn === resident.mrn))
    .map(resident => {
      const admitDate = resident.admitDate || '';
      const daysSinceAdmit = differenceInDays(today, parseISO(admitDate));

      const screeningStatus = daysSinceAdmit > 3 ? '⚠️ OVERDUE' : 'PENDING';
      const screeningNotes = daysSinceAdmit > 3
        ? 'Screening overdue - review needed'
        : 'Needs admission screening';

      return [
        resident.room,
        resident.name,
        resident.mrn,
        resident.unit,
        format(parseISO(admitDate), 'MM/dd/yyyy'),
        `${daysSinceAdmit} days`,
        screeningStatus,
        screeningNotes
      ];
    });
  
  const pendingCount = rows.filter(r => r[6] === 'PENDING' || r[6] === '⚠️ OVERDUE').length;
  const overdueCount = rows.filter(r => r[6] === '⚠️ OVERDUE').length;
  
  return {
    title: 'NEW ADMISSION IP SCREENING',
    subtitle: `Admissions in Last ${daysBack} Days - Infection Prevention Review`,
    generatedAt: new Date().toISOString(),
    filters: {
      period: `Last ${daysBack} days`,
      date: format(new Date(), 'MM/dd/yyyy')
    },
    headers: ['Room', 'Resident', 'MRN', 'Unit', 'Admit Date', 'Days', 'Status', 'Notes'],
    rows,
    footer: {
      preparedBy: '',
      signature: '',
      title: '',
      dateTime: '',
      disclaimer: `Total new admissions needing screening: ${rows.length} | Pending screening: ${pendingCount} | Overdue (>3 days): ${overdueCount}. Per CMS guidelines, new admissions should be screened for MDRO history, current infections, and vaccination status within 72 hours.`
    }
  };
};

// 3. Outbreak Summary Report
// Tracks potential outbreak patterns by infection type and unit
export const generateOutbreakSummaryReport = (
  db: ICNDatabase,
  daysBack: number = 30
): ReportData => {
  const today = new Date();
  const cutoffDate = subDays(today, daysBack);
  
  // Get IP cases in the period
  const recentCases = db.records.ip_cases.filter(c => {
    const onsetDate = c.onsetDate || c.onset_date;
    if (!onsetDate) return false;
    try {
      const onset = parseISO(onsetDate);
      return onset >= cutoffDate;
    } catch {
      return false;
    }
  });
  
  // Group by infection type
  const byInfectionType: Record<string, IPCase[]> = {};
  recentCases.forEach(c => {
    const type = c.infectionType || c.infection_type || 'Unknown';
    if (!byInfectionType[type]) byInfectionType[type] = [];
    byInfectionType[type].push(c);
  });
  
  // Group by unit
  const byUnit: Record<string, IPCase[]> = {};
  recentCases.forEach(c => {
    const unit = c.unit || 'Unknown';
    if (!byUnit[unit]) byUnit[unit] = [];
    byUnit[unit].push(c);
  });
  
  // Identify potential outbreaks (>=3 cases of same type or >=5 cases on same unit)
  const outbreakAlerts: { type: string; count: number; unit?: string; alert: string }[] = [];
  
  Object.entries(byInfectionType).forEach(([type, cases]) => {
    if (cases.length >= 3) {
      outbreakAlerts.push({
        type,
        count: cases.length,
        alert: `⚠️ POTENTIAL OUTBREAK: ${cases.length} ${type} cases in ${daysBack} days`
      });
    }
  });
  
  Object.entries(byUnit).forEach(([unit, cases]) => {
    if (cases.length >= 5) {
      outbreakAlerts.push({
        type: 'Unit Cluster',
        count: cases.length,
        unit,
        alert: `⚠️ UNIT CLUSTER: ${cases.length} cases on ${unit} in ${daysBack} days`
      });
    }
  });
  
  const rows: string[][] = [];
  
  // Section 1: Alerts
  rows.push(['OUTBREAK ALERTS', '', '', '']);
  if (outbreakAlerts.length > 0) {
    outbreakAlerts.forEach(alert => {
      rows.push([alert.alert, alert.count.toString(), alert.unit || 'Facility-wide', 'INVESTIGATE']);
    });
  } else {
    rows.push(['No outbreak patterns detected', '', '', 'CLEAR']);
  }
  
  rows.push(['', '', '', '']);
  rows.push(['CASES BY INFECTION TYPE', '', '', '']);
  Object.entries(byInfectionType)
    .sort((a, b) => b[1].length - a[1].length)
    .forEach(([type, cases]) => {
      const status = cases.length >= 3 ? '⚠️ ALERT' : 'MONITOR';
      rows.push([type, cases.length.toString(), '', status]);
    });
  
  rows.push(['', '', '', '']);
  rows.push(['CASES BY UNIT', '', '', '']);
  Object.entries(byUnit)
    .sort((a, b) => b[1].length - a[1].length)
    .forEach(([unit, cases]) => {
      const status = cases.length >= 5 ? '⚠️ CLUSTER' : 'NORMAL';
      rows.push([unit, cases.length.toString(), '', status]);
    });
  
  rows.push(['', '', '', '']);
  rows.push(['RECENT CASE DETAIL', '', '', '']);
  recentCases
    .sort((a, b) => {
      const dateA = parseISO(a.onsetDate || a.onset_date || '');
      const dateB = parseISO(b.onsetDate || b.onset_date || '');
      return dateB.getTime() - dateA.getTime();
    })
    .slice(0, 15) // Show last 15 cases
    .forEach(c => {
      const resident = db.census.residentsByMrn[c.mrn];
      const name = c.residentName || c.name || resident?.name || 'Unknown';
      const onset = c.onsetDate || c.onset_date || '';
      rows.push([
        onset ? format(parseISO(onset), 'MM/dd/yyyy') : '',
        name,
        c.unit,
        c.infectionType || c.infection_type || ''
      ]);
    });
  
  return {
    title: 'OUTBREAK SUMMARY REPORT',
    subtitle: `Infection Pattern Analysis - Last ${daysBack} Days`,
    generatedAt: new Date().toISOString(),
    filters: {
      period: `Last ${daysBack} days`,
      date: format(new Date(), 'MM/dd/yyyy')
    },
    headers: ['Category / Date', 'Count / Resident', 'Unit', 'Status / Type'],
    rows,
    footer: {
      preparedBy: '',
      signature: '',
      title: '',
      dateTime: '',
      disclaimer: `Total cases in period: ${recentCases.length} | Active alerts: ${outbreakAlerts.length}. Outbreak threshold: ≥3 cases of same infection type OR ≥5 cases on same unit within ${daysBack} days. Per CDC guidelines, clusters should be investigated within 24 hours of identification.`
    }
  };
};

export const generateIPDailyMorningReport = (db: ICNDatabase): ReportData => {
  const activeCases = getActiveIPCases(db);
  const activeABT = getActiveABT(db);
  const vaxDue = getVaxDue(db);
  const today = new Date();
  const todayLabel = format(today, 'MM/dd/yyyy');
  const activeOutbreakIds = new Set(getActiveOutbreaks(db).map(outbreak => outbreak.id));

  const isolationCases = activeCases.filter(caseItem => (caseItem.protocol || '').toLowerCase() === 'isolation');
  const ebpCases = activeCases.filter(caseItem => {
    const protocol = (caseItem.protocol || '').toLowerCase();
    return protocol === 'ebp' || protocol === 'edp';
  });

  const buildIpRows = (cases: IPCase[]) => {
    return cases.map(caseItem => {
      const resident = db.census.residentsByMrn[caseItem.mrn];
      const unit = caseItem.unit || resident?.unit || '';
      const room = caseItem.room || resident?.room || '';
      const residentName = caseItem.residentName || caseItem.name || resident?.name || 'Unknown';
      const precaution = getPrecautionDisplay(caseItem);
      const source = caseItem.sourceOfInfection || caseItem.source_of_infection || '';
      return [unit, room, residentName, precaution, source];
    });
  };

  const lineListingRows = db.records.line_listings
    .filter(entry => entry.outcome === 'active' && activeOutbreakIds.has(entry.outbreakId))
    .map(entry => {
      const residentName = entry.residentName || 'Unknown';
      const outbreakName = db.records.outbreaks.find(outbreak => outbreak.id === entry.outbreakId)?.name;
      const symptoms = getSymptomNames(entry.symptoms);
      const descriptionParts = [
        outbreakName ? `Outbreak: ${outbreakName}` : '',
        symptoms ? `Symptoms: ${symptoms}` : '',
        entry.notes ? `Notes: ${entry.notes}` : ''
      ].filter(Boolean);
      return [entry.unit, entry.room, residentName, descriptionParts.join(' | ')];
    });

  const abtRows = activeABT.map(record => {
    const resident = db.census.residentsByMrn[record.mrn];
    const residentName = record.residentName || record.name || resident?.name || 'Unknown';
    const unit = record.unit || resident?.unit || '';
    const room = record.room || resident?.room || '';
    const medication = record.medication || record.med_name || '';
    const frequency = getABTFrequency(record);
    const route = getABTRoute(record);
    const startDate = formatDateValue(record.startDate || record.start_date || '');
    const endDate = formatDateValue(record.endDate || record.end_date || '');
    const indication = record.indication || '';
    return [unit, room, residentName, medication, record.dose || '', frequency, route, startDate, endDate, indication];
  });

  const vaxDueTodayRows = vaxDue
    .filter(record => {
      const dueDateValue = record.dueDate || record.due_date || '';
      const parsed = parseDateValue(dueDateValue);
      return parsed ? isSameDay(parsed, today) : false;
    })
    .map(record => {
      const resident = db.census.residentsByMrn[record.mrn];
      const residentName = record.residentName || record.name || resident?.name || 'Unknown';
      const unit = record.unit || resident?.unit || '';
      const room = record.room || resident?.room || '';
      const vaccine = record.vaccine || record.vaccine_type || '';
      const dateValue = record.dateGiven || record.date_given || record.dueDate || record.due_date || '';
      const dateLabel = formatDateValue(dateValue);
      let consentStatus = 'Consented';
      if (record.educationOutcome === 'declined') {
        consentStatus = 'Declined';
      } else if (record.educationOutcome === 'deferred') {
        consentStatus = 'Refused';
      } else if (record.educationOutcome === 'accepted') {
        consentStatus = 'Consented';
      } else if (record.status === 'given') {
        consentStatus = 'Vaccinated';
      } else if (record.status === 'declined') {
        consentStatus = 'Declined';
      } else if (record.status === 'overdue') {
        consentStatus = 'Refused';
      }
      return [unit, room, residentName, vaccine, dateLabel, consentStatus];
    });

  const followUpNotes = getNotesRequiringFollowUp(db);
  const followUpRows = followUpNotes.map(note => {
    const resident = db.census.residentsByMrn[note.mrn];
    const residentName = note.residentName || note.name || resident?.name || 'Unknown';
    const unit = note.unit || resident?.unit || '';
    const room = note.room || resident?.room || '';
    const followUpDate = formatDateValue(note.followUpDate || '');
    const descriptionParts = [
      note.text,
      note.followUpNotes ? `Follow-up: ${note.followUpNotes}` : '',
      followUpDate ? `Due: ${followUpDate}` : ''
    ].filter(Boolean);
    return [unit, room, residentName, descriptionParts.join(' | ')];
  });

  return {
    title: 'IP Daily Morning Report',
    generatedAt: new Date().toISOString(),
    filters: {
      date: todayLabel
    },
    headers: [],
    rows: [],
    reportType: 'ip_daily_morning',
    sections: [
      {
        title: 'Active IP Precaution List - Isolation',
        headers: ['Unit', 'Room', "Resident's Name", 'Type of Precaution', 'Source of Infection'],
        rows: buildIpRows(isolationCases)
      },
      {
        title: 'Active IP Precaution List - EBP (EDP)',
        headers: ['Unit', 'Room', "Resident's Name", 'Type of Precaution', 'Source of Infection'],
        rows: buildIpRows(ebpCases)
      },
      {
        title: 'Active Symptoms / Line Listing Follow-ups',
        headers: ['Unit', 'Room', "Resident's Name", 'Symptoms / Line Listing'],
        rows: lineListingRows
      },
      {
        title: 'Active Antibiotics (ABT)',
        headers: ['Unit', 'Room', "Resident's Name", 'Medication', 'Dose', 'Frequency', 'Route', 'Start Date', 'End Date', 'Indication'],
        rows: abtRows
      },
      {
        title: 'Vaccinations Due Today',
        headers: ['Unit', 'Room', "Resident's Name", 'Vaccine', 'Date Due/Admin', 'Consent Status'],
        rows: vaxDueTodayRows
      },
      {
        title: 'Follow-up Notes',
        headers: ['Unit', 'Room', "Resident's Name", 'Description'],
        rows: followUpRows
      }
    ]
  };
};

export const isIPDailyMorningReport = (report: ReportData): boolean => {
  return report.reportType === 'ip_daily_morning';
};
