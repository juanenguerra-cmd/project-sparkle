// QAPI Report Generator - Infection Control, IP, and VAX Reports
// Based on facility QAPI template with PDCA framework

import { ICNDatabase, getActiveIPCases, getActiveABT, getActiveResidents } from '../database';
import { IPCase, ABTRecord, VaxRecord } from '../types';
import { 
  format, 
  parseISO, 
  startOfMonth, 
  endOfMonth, 
  startOfQuarter, 
  endOfQuarter, 
  eachMonthOfInterval,
  isWithinInterval,
  differenceInDays,
  subQuarters
} from 'date-fns';
import { ReportData } from '../reportGenerators';
import { 
  generateMonthlyMetrics, 
  INFECTION_CATEGORIES, 
  InfectionCategory,
  getQuarterDates 
} from './surveillanceReports';

// QAPI Categories (simplified from 8 to 5 per template)
export const QAPI_CATEGORIES = ['Respiratory', 'Urinary', 'GI', 'Skin', 'Other'] as const;
export type QAPICategory = typeof QAPI_CATEGORIES[number];

// Map infection categories to QAPI categories
const mapToQAPICategory = (category: InfectionCategory): QAPICategory => {
  switch (category) {
    case 'Respiratory/Pneumonia':
    case 'Influenza':
      return 'Respiratory';
    case 'UTI':
      return 'Urinary';
    case 'GI/C.diff':
      return 'GI';
    case 'Skin/Wound':
      return 'Skin';
    default:
      return 'Other';
  }
};

// Classify IP case into QAPI category
const classifyIPToQAPI = (ipCase: IPCase): QAPICategory => {
  const infectionType = (ipCase.infectionType || ipCase.infection_type || '').toLowerCase();
  const source = (ipCase.sourceOfInfection || ipCase.source_of_infection || '').toLowerCase();
  const combined = `${infectionType} ${source}`;
  
  if (combined.includes('resp') || combined.includes('pneumo') || combined.includes('flu') || combined.includes('covid') || combined.includes('lung')) {
    return 'Respiratory';
  }
  if (combined.includes('uti') || combined.includes('urinary') || combined.includes('catheter')) {
    return 'Urinary';
  }
  if (combined.includes('gi') || combined.includes('diff') || combined.includes('diarr') || combined.includes('noro')) {
    return 'GI';
  }
  if (combined.includes('skin') || combined.includes('wound') || combined.includes('cellul') || combined.includes('ulcer')) {
    return 'Skin';
  }
  return 'Other';
};

// Classify ABT indication into QAPI category
const classifyABTToQAPI = (abt: ABTRecord): QAPICategory => {
  const indication = (abt.indication || '').toLowerCase();
  const source = (abt.infection_source || '').toLowerCase();
  const combined = `${indication} ${source}`;
  
  if (combined.includes('resp') || combined.includes('pneumo') || combined.includes('flu') || combined.includes('copd') || combined.includes('bronch')) {
    return 'Respiratory';
  }
  if (combined.includes('uti') || combined.includes('urinary') || combined.includes('pyelo')) {
    return 'Urinary';
  }
  if (combined.includes('gi') || combined.includes('diff') || combined.includes('diarr')) {
    return 'GI';
  }
  if (combined.includes('skin') || combined.includes('wound') || combined.includes('cellul') || combined.includes('ssti')) {
    return 'Skin';
  }
  return 'Other';
};

export interface QAPIMonthlyData {
  month: string;
  monthLabel: string;
  avgCensus: number;
  residentDays: number;
  newInfections: Record<QAPICategory, number>;
  totalInfections: number;
  abtStarts: Record<QAPICategory, number>;
  totalABTStarts: number;
  daysOfTherapy: Record<QAPICategory, number>;
  totalDOT: number;
}

export interface QAPIReportData {
  quarter: string;
  year: number;
  previousQuarter: string;
  previousYear: number;
  facilityName: string;
  sampleSize: number;
  periodRange: string;
  
  // Table 1: Infection Rate per 1000 Resident Days
  infectionRatePer1000: {
    months: QAPIMonthlyData[];
    quarterTotal: Record<QAPICategory, { count: number; rate: number }>;
    previousQuarterTotal: number;
  };
  
  // Table 2: Infection Rate by Census
  infectionRateByCensus: {
    months: QAPIMonthlyData[];
    quarterTotal: Record<QAPICategory, { count: number; rate: number }>;
    previousQuarterRate: number;
  };
  
  // Table 3: HAI vs Prior to Admission split
  haiSplit: {
    hai: { months: number[]; total: number };
    priorToAdmit: { months: number[]; total: number };
    previousHAI: number;
    previousPriorToAdmit: number;
  };
  
  // Table 4: ABT Starts per 1000 Resident Days  
  abtStartsPer1000: {
    months: QAPIMonthlyData[];
    quarterTotal: Record<QAPICategory, { count: number; rate: number }>;
    previousQuarterTotal: number;
  };
  
  // Table 5: Antibiotic Utilization Ratio (AUR)
  aur: {
    months: Array<{
      month: string;
      dot: Record<QAPICategory, number>;
      aur: Record<QAPICategory, number>;
      totalDOT: number;
      totalAUR: number;
    }>;
    quarterTotal: {
      dot: Record<QAPICategory, number>;
      aur: Record<QAPICategory, number>;
      totalDOT: number;
      totalAUR: number;
    };
    previousQuarterDOT: number;
  };
  
  // Executive Summary data
  executiveSummary: {
    totalNewInfections: number;
    previousTotalInfections: number;
    infectionRateByCensus: number;
    previousInfectionRate: number;
    totalHAI: number;
    previousHAI: number;
    totalPriorToAdmit: number;
    previousPriorToAdmit: number;
    totalABTStarts: number;
    previousABTStarts: number;
    totalDOT: number;
    previousDOT: number;
  };
}

// Generate monthly QAPI metrics
const generateQAPIMonthlyData = (
  db: ICNDatabase,
  startDate: Date,
  endDate: Date
): QAPIMonthlyData[] => {
  const months = eachMonthOfInterval({ start: startDate, end: endDate });
  
  return months.map(month => {
    const monthStart = startOfMonth(month);
    const monthEnd = endOfMonth(month);
    const monthLabel = format(month, 'MMMM yyyy');
    const monthKey = format(month, 'yyyy-MM');
    
    // Calculate census and resident days
    const activeResidents = Object.values(db.census.residentsByMrn).filter(r => r.active_on_census);
    const avgCensus = activeResidents.length;
    const daysInMonth = differenceInDays(monthEnd, monthStart) + 1;
    const residentDays = avgCensus * daysInMonth;
    
    // Initialize category counts
    const newInfections: Record<QAPICategory, number> = {
      Respiratory: 0, Urinary: 0, GI: 0, Skin: 0, Other: 0
    };
    const abtStarts: Record<QAPICategory, number> = {
      Respiratory: 0, Urinary: 0, GI: 0, Skin: 0, Other: 0
    };
    const daysOfTherapy: Record<QAPICategory, number> = {
      Respiratory: 0, Urinary: 0, GI: 0, Skin: 0, Other: 0
    };
    
    // Count infections in this month
    db.records.ip_cases.forEach(ipCase => {
      const onsetDate = ipCase.onsetDate || ipCase.onset_date;
      if (!onsetDate) return;
      try {
        const onset = parseISO(onsetDate);
        if (isWithinInterval(onset, { start: monthStart, end: monthEnd })) {
          const category = classifyIPToQAPI(ipCase);
          newInfections[category]++;
        }
      } catch { /* skip invalid dates */ }
    });
    
    // Count ABT starts in this month
    db.records.abx.forEach(abt => {
      const startDateStr = abt.startDate || abt.start_date;
      if (!startDateStr) return;
      try {
        const start = parseISO(startDateStr);
        if (isWithinInterval(start, { start: monthStart, end: monthEnd })) {
          const category = classifyABTToQAPI(abt);
          abtStarts[category]++;
        }
      } catch { /* skip invalid dates */ }
    });
    
    // Calculate DOT in this month
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
          const days = differenceInDays(overlapEnd, overlapStart) + 1;
          const category = classifyABTToQAPI(abt);
          daysOfTherapy[category] += days;
        }
      } catch { /* skip invalid dates */ }
    });
    
    return {
      month: monthKey,
      monthLabel,
      avgCensus,
      residentDays,
      newInfections,
      totalInfections: Object.values(newInfections).reduce((sum, n) => sum + n, 0),
      abtStarts,
      totalABTStarts: Object.values(abtStarts).reduce((sum, n) => sum + n, 0),
      daysOfTherapy,
      totalDOT: Object.values(daysOfTherapy).reduce((sum, n) => sum + n, 0)
    };
  });
};

// Main QAPI Report Generator
export const generateQAPIInfectionControlReport = (
  db: ICNDatabase,
  quarter: 1 | 2 | 3 | 4,
  year: number
): QAPIReportData => {
  const facilityName = db.settings.facilityName || 'Healthcare Facility';
  
  // Current quarter dates
  const { start: quarterStart, end: quarterEnd } = getQuarterDates(quarter, year);
  
  // Previous quarter dates
  const prevQuarterDate = subQuarters(quarterStart, 1);
  const prevQuarter = (Math.floor(prevQuarterDate.getMonth() / 3) + 1) as 1 | 2 | 3 | 4;
  const prevYear = prevQuarterDate.getFullYear();
  const { start: prevStart, end: prevEnd } = getQuarterDates(prevQuarter, prevYear);
  
  // Generate monthly data for current quarter
  const currentMonths = generateQAPIMonthlyData(db, quarterStart, quarterEnd);
  
  // Generate monthly data for previous quarter (for comparison)
  const prevMonths = generateQAPIMonthlyData(db, prevStart, prevEnd);
  
  // Calculate quarter totals
  const calcQuarterTotals = (months: QAPIMonthlyData[]) => {
    const totals: Record<QAPICategory, { count: number; rate: number }> = {
      Respiratory: { count: 0, rate: 0 },
      Urinary: { count: 0, rate: 0 },
      GI: { count: 0, rate: 0 },
      Skin: { count: 0, rate: 0 },
      Other: { count: 0, rate: 0 }
    };
    
    let totalResidentDays = 0;
    months.forEach(m => {
      totalResidentDays += m.residentDays;
      QAPI_CATEGORIES.forEach(cat => {
        totals[cat].count += m.newInfections[cat];
      });
    });
    
    // Calculate rates per 1000 resident days
    QAPI_CATEGORIES.forEach(cat => {
      totals[cat].rate = totalResidentDays > 0 
        ? (totals[cat].count / totalResidentDays) * 1000 
        : 0;
    });
    
    return totals;
  };
  
  const currentTotals = calcQuarterTotals(currentMonths);
  const prevTotals = calcQuarterTotals(prevMonths);
  
  // Calculate average census
  const avgCensus = currentMonths.length > 0 
    ? Math.round(currentMonths.reduce((sum, m) => sum + m.avgCensus, 0) / currentMonths.length)
    : 0;
  
  // Total resident days
  const totalResidentDays = currentMonths.reduce((sum, m) => sum + m.residentDays, 0);
  const prevTotalResidentDays = prevMonths.reduce((sum, m) => sum + m.residentDays, 0);
  
  // Total infections
  const totalInfections = currentMonths.reduce((sum, m) => sum + m.totalInfections, 0);
  const prevTotalInfections = prevMonths.reduce((sum, m) => sum + m.totalInfections, 0);
  
  // Total ABT starts
  const totalABTStarts = currentMonths.reduce((sum, m) => sum + m.totalABTStarts, 0);
  const prevTotalABTStarts = prevMonths.reduce((sum, m) => sum + m.totalABTStarts, 0);
  
  // Total DOT
  const totalDOT = currentMonths.reduce((sum, m) => sum + m.totalDOT, 0);
  const prevTotalDOT = prevMonths.reduce((sum, m) => sum + m.totalDOT, 0);
  
  // ABT totals by category
  const abtTotals: Record<QAPICategory, { count: number; rate: number }> = {
    Respiratory: { count: 0, rate: 0 },
    Urinary: { count: 0, rate: 0 },
    GI: { count: 0, rate: 0 },
    Skin: { count: 0, rate: 0 },
    Other: { count: 0, rate: 0 }
  };
  
  currentMonths.forEach(m => {
    QAPI_CATEGORIES.forEach(cat => {
      abtTotals[cat].count += m.abtStarts[cat];
    });
  });
  
  QAPI_CATEGORIES.forEach(cat => {
    abtTotals[cat].rate = totalResidentDays > 0 
      ? (abtTotals[cat].count / totalResidentDays) * 1000 
      : 0;
  });
  
  // AUR by category
  const aurTotals: Record<QAPICategory, number> = {
    Respiratory: 0, Urinary: 0, GI: 0, Skin: 0, Other: 0
  };
  const dotTotals: Record<QAPICategory, number> = {
    Respiratory: 0, Urinary: 0, GI: 0, Skin: 0, Other: 0
  };
  
  currentMonths.forEach(m => {
    QAPI_CATEGORIES.forEach(cat => {
      dotTotals[cat] += m.daysOfTherapy[cat];
    });
  });
  
  QAPI_CATEGORIES.forEach(cat => {
    aurTotals[cat] = totalResidentDays > 0 
      ? (dotTotals[cat] / totalResidentDays) * 1000 
      : 0;
  });
  
  return {
    quarter: `Q${quarter}`,
    year,
    previousQuarter: `Q${prevQuarter}`,
    previousYear: prevYear,
    facilityName,
    sampleSize: avgCensus,
    periodRange: `${format(quarterStart, 'MMMM yyyy')} - ${format(quarterEnd, 'MMMM yyyy')}`,
    
    infectionRatePer1000: {
      months: currentMonths,
      quarterTotal: currentTotals,
      previousQuarterTotal: prevTotalInfections
    },
    
    infectionRateByCensus: {
      months: currentMonths,
      quarterTotal: currentTotals,
      previousQuarterRate: prevTotalResidentDays > 0 
        ? (prevTotalInfections / prevTotalResidentDays) * 1000 
        : 0
    },
    
    haiSplit: {
      hai: { 
        months: currentMonths.map(m => m.totalInfections), // Simplified: all counted as HAI
        total: totalInfections 
      },
      priorToAdmit: { 
        months: currentMonths.map(() => 0), // Would need admission date tracking
        total: 0 
      },
      previousHAI: prevTotalInfections,
      previousPriorToAdmit: 0
    },
    
    abtStartsPer1000: {
      months: currentMonths,
      quarterTotal: abtTotals,
      previousQuarterTotal: prevTotalABTStarts
    },
    
    aur: {
      months: currentMonths.map(m => ({
        month: m.monthLabel,
        dot: m.daysOfTherapy,
        aur: QAPI_CATEGORIES.reduce((acc, cat) => {
          acc[cat] = m.residentDays > 0 ? (m.daysOfTherapy[cat] / m.residentDays) * 1000 : 0;
          return acc;
        }, {} as Record<QAPICategory, number>),
        totalDOT: m.totalDOT,
        totalAUR: m.residentDays > 0 ? (m.totalDOT / m.residentDays) * 1000 : 0
      })),
      quarterTotal: {
        dot: dotTotals,
        aur: aurTotals,
        totalDOT,
        totalAUR: totalResidentDays > 0 ? (totalDOT / totalResidentDays) * 1000 : 0
      },
      previousQuarterDOT: prevTotalDOT
    },
    
    executiveSummary: {
      totalNewInfections: totalInfections,
      previousTotalInfections: prevTotalInfections,
      infectionRateByCensus: totalResidentDays > 0 ? (totalInfections / totalResidentDays) * 1000 : 0,
      previousInfectionRate: prevTotalResidentDays > 0 ? (prevTotalInfections / prevTotalResidentDays) * 1000 : 0,
      totalHAI: totalInfections,
      previousHAI: prevTotalInfections,
      totalPriorToAdmit: 0,
      previousPriorToAdmit: 0,
      totalABTStarts,
      previousABTStarts: prevTotalABTStarts,
      totalDOT,
      previousDOT: prevTotalDOT
    }
  };
};

// =====================================================
// IP (PRECAUTIONS) SECTION - Separate Report
// =====================================================

export interface QAPIIPReportData {
  quarter: string;
  year: number;
  periodRange: string;
  facilityName: string;
  
  // Active precautions summary
  precautionsSummary: {
    ebpCount: number;
    isolationCount: number;
    contactCount: number;
    dropletCount: number;
    airborneCount: number;
    totalActive: number;
  };
  
  // Monthly precaution trends
  monthlyTrends: Array<{
    month: string;
    newCases: number;
    resolvedCases: number;
    activeCases: number;
    avgDaysOnPrecaution: number;
  }>;
  
  // By infection type
  byInfectionType: Record<string, number>;
  
  // Resolution rates
  resolutionRate: {
    resolved: number;
    active: number;
    rate: number;
  };
  
  // Room checks compliance
  roomChecks: {
    signageCompliance: number;
    suppliesCompliance: number;
    ppeCompliance: number;
  };
}

export const generateQAPIIPReport = (
  db: ICNDatabase,
  quarter: 1 | 2 | 3 | 4,
  year: number
): QAPIIPReportData => {
  const facilityName = db.settings.facilityName || 'Healthcare Facility';
  const { start: quarterStart, end: quarterEnd } = getQuarterDates(quarter, year);
  
  const allIPCases = db.records.ip_cases;
  const activeCases = allIPCases.filter(c => c.status === 'Active');
  
  // Cases in quarter
  const casesInQuarter = allIPCases.filter(ipCase => {
    const onsetDate = ipCase.onsetDate || ipCase.onset_date;
    if (!onsetDate) return false;
    try {
      const onset = parseISO(onsetDate);
      return isWithinInterval(onset, { start: quarterStart, end: quarterEnd });
    } catch {
      return false;
    }
  });
  
  // Precautions summary
  const precautionsSummary = {
    ebpCount: activeCases.filter(c => c.protocol === 'EBP').length,
    isolationCount: activeCases.filter(c => c.protocol === 'Isolation').length,
    contactCount: activeCases.filter(c => c.isolationType === 'Contact' || c.isolation_type?.toLowerCase().includes('contact')).length,
    dropletCount: activeCases.filter(c => c.isolationType === 'Droplet' || c.isolation_type?.toLowerCase().includes('droplet')).length,
    airborneCount: activeCases.filter(c => c.isolationType === 'Airborne' || c.isolation_type?.toLowerCase().includes('airborne')).length,
    totalActive: activeCases.length
  };
  
  // By infection type
  const byInfectionType: Record<string, number> = {};
  casesInQuarter.forEach(ipCase => {
    const type = ipCase.infectionType || ipCase.infection_type || 'Unknown';
    byInfectionType[type] = (byInfectionType[type] || 0) + 1;
  });
  
  // Resolution rates
  const resolvedInQuarter = casesInQuarter.filter(c => c.status === 'Resolved').length;
  const resolutionRate = {
    resolved: resolvedInQuarter,
    active: casesInQuarter.length - resolvedInQuarter,
    rate: casesInQuarter.length > 0 ? (resolvedInQuarter / casesInQuarter.length) * 100 : 0
  };
  
  // Room checks (would need actual audit data - using placeholder)
  const roomChecks = {
    signageCompliance: activeCases.filter(c => c.signagePosted).length / Math.max(activeCases.length, 1) * 100,
    suppliesCompliance: activeCases.filter(c => c.suppliesStocked).length / Math.max(activeCases.length, 1) * 100,
    ppeCompliance: 95 // Placeholder
  };
  
  // Monthly trends
  const months = eachMonthOfInterval({ start: quarterStart, end: quarterEnd });
  const monthlyTrends = months.map(month => {
    const monthStart = startOfMonth(month);
    const monthEnd = endOfMonth(month);
    
    const newCases = allIPCases.filter(c => {
      const onset = c.onsetDate || c.onset_date;
      if (!onset) return false;
      try {
        return isWithinInterval(parseISO(onset), { start: monthStart, end: monthEnd });
      } catch { return false; }
    }).length;
    
    const resolvedCases = allIPCases.filter(c => {
      const resolution = c.resolutionDate || c.resolution_date;
      if (!resolution) return false;
      try {
        return isWithinInterval(parseISO(resolution), { start: monthStart, end: monthEnd });
      } catch { return false; }
    }).length;
    
    return {
      month: format(month, 'MMMM yyyy'),
      newCases,
      resolvedCases,
      activeCases: newCases - resolvedCases, // Simplified
      avgDaysOnPrecaution: 7 // Placeholder
    };
  });
  
  return {
    quarter: `Q${quarter}`,
    year,
    periodRange: `${format(quarterStart, 'MMMM yyyy')} - ${format(quarterEnd, 'MMMM yyyy')}`,
    facilityName,
    precautionsSummary,
    monthlyTrends,
    byInfectionType,
    resolutionRate,
    roomChecks
  };
};

// =====================================================
// VAX (VACCINATION) SECTION - Separate Report
// =====================================================

export interface QAPIVaxReportData {
  quarter: string;
  year: number;
  periodRange: string;
  facilityName: string;
  activeCensus: number;
  
  // Coverage by vaccine type
  coverage: {
    influenza: { given: number; total: number; rate: number };
    pneumococcal: { given: number; total: number; rate: number };
    covid: { given: number; total: number; rate: number };
    tdap: { given: number; total: number; rate: number };
    other: { given: number; total: number; rate: number };
  };
  
  // Due/Overdue
  dueOverdue: {
    due: number;
    overdue: number;
    total: number;
  };
  
  // Declinations
  declinations: {
    total: number;
    byVaccine: Record<string, number>;
    byReason: Record<string, number>;
  };
  
  // Re-offer tracking
  reofferTracking: {
    dueForReoffer: number;
    reofferedThisQuarter: number;
    acceptedAfterReoffer: number;
  };
  
  // Monthly administration
  monthlyAdministration: Array<{
    month: string;
    given: number;
    declined: number;
    dueCount: number;
  }>;
}

export const generateQAPIVaxReport = (
  db: ICNDatabase,
  quarter: 1 | 2 | 3 | 4,
  year: number
): QAPIVaxReportData => {
  const facilityName = db.settings.facilityName || 'Healthcare Facility';
  const { start: quarterStart, end: quarterEnd } = getQuarterDates(quarter, year);
  
  const allVax = db.records.vax;
  const activeResidents = Object.values(db.census.residentsByMrn).filter(r => r.active_on_census);
  const activeCensus = activeResidents.length;
  
  // Helper to categorize vaccine
  const categorizeVaccine = (v: VaxRecord): string => {
    const vaccine = (v.vaccine || v.vaccine_type || '').toLowerCase();
    if (vaccine.includes('flu') || vaccine.includes('influenza')) return 'influenza';
    if (vaccine.includes('pneumo') || vaccine.includes('pcv') || vaccine.includes('ppsv')) return 'pneumococcal';
    if (vaccine.includes('covid')) return 'covid';
    if (vaccine.includes('tdap') || vaccine.includes('tetanus')) return 'tdap';
    return 'other';
  };
  
  // Coverage calculation
  const coverageCalc = (type: string) => {
    const typeVax = allVax.filter(v => categorizeVaccine(v) === type);
    const given = typeVax.filter(v => v.status === 'given').length;
    const total = typeVax.length || activeCensus; // Use census if no records
    return { given, total, rate: total > 0 ? (given / total) * 100 : 0 };
  };
  
  const coverage = {
    influenza: coverageCalc('influenza'),
    pneumococcal: coverageCalc('pneumococcal'),
    covid: coverageCalc('covid'),
    tdap: coverageCalc('tdap'),
    other: coverageCalc('other')
  };
  
  // Due/Overdue
  const dueVax = allVax.filter(v => v.status === 'due');
  const overdueVax = allVax.filter(v => v.status === 'overdue');
  const dueOverdue = {
    due: dueVax.length,
    overdue: overdueVax.length,
    total: dueVax.length + overdueVax.length
  };
  
  // Declinations
  const declinedVax = allVax.filter(v => v.status === 'declined');
  const byVaccine: Record<string, number> = {};
  const byReason: Record<string, number> = {};
  
  declinedVax.forEach(v => {
    const vaccine = v.vaccine || v.vaccine_type || 'Unknown';
    byVaccine[vaccine] = (byVaccine[vaccine] || 0) + 1;
    
    const reason = v.declineReason || 'Not specified';
    byReason[reason] = (byReason[reason] || 0) + 1;
  });
  
  const declinations = {
    total: declinedVax.length,
    byVaccine,
    byReason
  };
  
  // Re-offer tracking (simplified)
  const reofferTracking = {
    dueForReoffer: declinedVax.filter(v => {
      const offerDate = v.offerDate;
      if (!offerDate) return true;
      const days = differenceInDays(new Date(), parseISO(offerDate));
      const vaccine = (v.vaccine || v.vaccine_type || '').toLowerCase();
      return vaccine.includes('flu') ? days >= 30 : days >= 180;
    }).length,
    reofferedThisQuarter: 0, // Would need tracking
    acceptedAfterReoffer: 0 // Would need tracking
  };
  
  // Monthly administration
  const months = eachMonthOfInterval({ start: quarterStart, end: quarterEnd });
  const monthlyAdministration = months.map(month => {
    const monthStart = startOfMonth(month);
    const monthEnd = endOfMonth(month);
    
    const givenThisMonth = allVax.filter(v => {
      const dateGiven = v.dateGiven || v.date_given;
      if (!dateGiven || v.status !== 'given') return false;
      try {
        return isWithinInterval(parseISO(dateGiven), { start: monthStart, end: monthEnd });
      } catch { return false; }
    }).length;
    
    const declinedThisMonth = allVax.filter(v => {
      const offerDate = v.offerDate;
      if (!offerDate || v.status !== 'declined') return false;
      try {
        return isWithinInterval(parseISO(offerDate), { start: monthStart, end: monthEnd });
      } catch { return false; }
    }).length;
    
    return {
      month: format(month, 'MMMM yyyy'),
      given: givenThisMonth,
      declined: declinedThisMonth,
      dueCount: dueOverdue.total // Simplified
    };
  });
  
  return {
    quarter: `Q${quarter}`,
    year,
    periodRange: `${format(quarterStart, 'MMMM yyyy')} - ${format(quarterEnd, 'MMMM yyyy')}`,
    facilityName,
    activeCensus,
    coverage,
    dueOverdue,
    declinations,
    reofferTracking,
    monthlyAdministration
  };
};
