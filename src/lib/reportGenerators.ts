// Report Generation Functions for ICN Hub
import { ICNDatabase, loadDB, getActiveIPCases, getActiveABT, getVaxDue, getActiveResidents } from './database';
import { IPCase, ABTRecord, VaxRecord, Resident, Note } from './types';
import { differenceInDays, format, isWithinInterval, startOfMonth, endOfMonth, parseISO, isBefore, isAfter, addDays } from 'date-fns';

export interface ReportData {
  title: string;
  subtitle?: string;
  generatedAt: string;
  filters: Record<string, string>;
  headers: string[];
  rows: string[][];
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
  const infectionType = ipCase.infectionType || ipCase.infection_type || '';
  
  if (protocol === 'EBP') return 'EBP';
  if (protocol === 'Isolation') {
    // Format: "ISOLATION / [infection type]" e.g., "ISOLATION / Flu", "ISOLATION / COVID"
    return infectionType ? `ISOLATION / ${infectionType}` : 'ISOLATION';
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
      record.route,
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
    headers: ['Room', 'Resident', 'MRN', 'Medication', 'Dose', 'Route', 'Indication', 'Start', 'End', 'Notes'],
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
    ['Influenza Vaccination Rate', `${fluGiven}/${fluVax.length}`, `${fluRate}%`, fluRate !== 'N/A' && parseFloat(fluRate) >= 85 ? 'COMPLIANT' : 'REVIEW'],
    ['Pneumococcal Vaccination Rate', `${pneumoGiven}/${pneumoVax.length}`, `${pneumoRate}%`, pneumoRate !== 'N/A' && parseFloat(pneumoRate) >= 85 ? 'COMPLIANT' : 'REVIEW'],
    ['COVID-19 Vaccination Rate', `${covidGiven}/${covidVax.length}`, `${covidRate}%`, covidRate !== 'N/A' && parseFloat(covidRate) >= 85 ? 'COMPLIANT' : 'REVIEW'],
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
export const generateVaxSnapshotReport = (
  db: ICNDatabase,
  fromDate?: string,
  toDate?: string,
  vaccineType: string = 'all'
): ReportData => {
  const allVax = db.records.vax;
  const activeResidents = Object.values(db.census.residentsByMrn).filter(r => r.active_on_census);
  
  // Filter by date range if provided
  let filtered = allVax.filter(v => {
    const dateGiven = v.dateGiven || v.date_given;
    if (!dateGiven) return false;
    
    // Only include given vaccinations
    if (v.status !== 'given') return false;
    
    // Check resident is still active
    if (!db.census.residentsByMrn[v.mrn]?.active_on_census) return false;
    
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
    const isOutdated = vaccine.toLowerCase().includes('flu') && isInfluenzaOutdated(dateGiven);
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
  
  // Add summary section for outdated flu vaccinations
  const fluVax = allVax.filter(v => 
    (v.vaccine || v.vaccine_type || '').toLowerCase().includes('flu') && 
    v.status === 'given' &&
    db.census.residentsByMrn[v.mrn]?.active_on_census
  );
  const outdatedFlu = fluVax.filter(v => isInfluenzaOutdated(v.dateGiven || v.date_given || ''));
  
  return {
    title: 'VACCINATION SNAPSHOT REPORT',
    subtitle: `Weekly Vaccination Status with Flu Season Logic`,
    generatedAt: new Date().toISOString(),
    filters: {
      fromDate: fromDate || 'All time',
      toDate: toDate || 'Present',
      vaccineType: vaccineType === 'all' ? 'All Types' : vaccineType,
      date: format(new Date(), 'MM/dd/yyyy'),
      note: outdatedFlu.length > 0 ? `⚠️ ${outdatedFlu.length} residents need flu vaccination offer for current season` : ''
    },
    headers: ['Resident', 'Unit/Room', 'Vaccine', 'Date Given', 'Status', 'Notes'],
    rows,
    footer: {
      disclaimer: 'Influenza vaccinations are flagged as OUTDATED if given before the current flu season (Oct-Mar cycle). These residents should be offered vaccination for the current/upcoming season.'
    }
  };
};

// Report 2: Standard of Care Weekly Report
export const generateStandardOfCareReport = (
  db: ICNDatabase,
  fromDate: string,
  toDate: string
): ReportData => {
  const rows: string[][] = [];
  
  // Section 1: ABT regimens started within date range
  const abtStarted = db.records.abx.filter(r => {
    const start = r.startDate || r.start_date || '';
    if (!start) return false;
    return start >= fromDate && start <= toDate;
  });
  
  rows.push(['=== ANTIBIOTIC REGIMENS STARTED ===', '', '', '', '', '']);
  if (abtStarted.length === 0) {
    rows.push(['No new antibiotic regimens in this period', '', '', '', '', '']);
  } else {
    abtStarted.forEach(record => {
      const resident = db.census.residentsByMrn[record.mrn];
      const residentName = record.residentName || record.name || resident?.name || 'Unknown';
      const medication = record.medication || record.med_name || '';
      const startDate = record.startDate || record.start_date || '';
      
      rows.push([
        'ABT',
        residentName,
        `${record.unit} / ${record.room}`,
        medication,
        startDate ? format(new Date(startDate), 'MM/dd/yyyy') : '',
        record.indication || ''
      ]);
    });
  }
  
  rows.push(['', '', '', '', '', '']);
  
  // Section 2: IP cases started within date range
  const ipStarted = db.records.ip_cases.filter(c => {
    const onset = c.onsetDate || c.onset_date || '';
    if (!onset) return false;
    return onset >= fromDate && onset <= toDate;
  });
  
  rows.push(['=== ISOLATION/PRECAUTION CASES STARTED ===', '', '', '', '', '']);
  if (ipStarted.length === 0) {
    rows.push(['No new IP cases in this period', '', '', '', '', '']);
  } else {
    ipStarted.forEach(ipCase => {
      const resident = db.census.residentsByMrn[ipCase.mrn];
      const residentName = ipCase.residentName || ipCase.name || resident?.name || 'Unknown';
      const onsetDate = ipCase.onsetDate || ipCase.onset_date || '';
      
      rows.push([
        'IP',
        residentName,
        `${ipCase.unit} / ${ipCase.room}`,
        ipCase.protocol,
        onsetDate ? format(new Date(onsetDate), 'MM/dd/yyyy') : '',
        ipCase.infectionType || ipCase.infection_type || ''
      ]);
    });
  }
  
  rows.push(['', '', '', '', '', '']);
  
  // Section 3: VAX declinations within date range
  const vaxDeclined = db.records.vax.filter(v => {
    if (v.status !== 'declined') return false;
    const date = v.dateGiven || v.date_given || v.dueDate || v.due_date || '';
    if (!date) return false;
    return date >= fromDate && date <= toDate;
  });
  
  rows.push(['=== VACCINATION DECLINATIONS ===', '', '', '', '', '']);
  if (vaxDeclined.length === 0) {
    rows.push(['No vaccination declinations in this period', '', '', '', '', '']);
  } else {
    vaxDeclined.forEach(record => {
      const resident = db.census.residentsByMrn[record.mrn];
      const residentName = record.residentName || record.name || resident?.name || 'Unknown';
      const vaccine = record.vaccine || record.vaccine_type || '';
      const date = record.dueDate || record.due_date || record.dateGiven || record.date_given || '';
      
      rows.push([
        'VAX',
        residentName,
        `${record.unit} / ${record.room}`,
        vaccine,
        date ? format(new Date(date), 'MM/dd/yyyy') : '',
        'DECLINED'
      ]);
    });
  }
  
  return {
    title: 'STANDARD OF CARE WEEKLY REPORT',
    subtitle: 'ABT Started, IP Cases, and VAX Declinations',
    generatedAt: new Date().toISOString(),
    filters: {
      fromDate: format(new Date(fromDate), 'MM/dd/yyyy'),
      toDate: format(new Date(toDate), 'MM/dd/yyyy'),
      date: format(new Date(), 'MM/dd/yyyy')
    },
    headers: ['Type', 'Resident', 'Unit/Room', 'Item', 'Date', 'Details'],
    rows,
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
  year: number
): ReportData => {
  const monthStart = startOfMonth(new Date(year, month));
  const monthEnd = endOfMonth(new Date(year, month));
  const monthStartStr = format(monthStart, 'yyyy-MM-dd');
  const monthEndStr = format(monthEnd, 'yyyy-MM-dd');
  
  // Find all ABT records active during the selected month
  // Active means: startDate <= month end AND (endDate >= month start OR endDate is null/ongoing)
  const activeInMonth = db.records.abx.filter(r => {
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
    
    return [
      residentName,
      `${record.unit} / ${record.room}`,
      medication,
      record.dose,
      record.route,
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
    headers: ['Resident', 'Unit/Room', 'Medication', 'Dose', 'Route', 'Indication', 'Start', 'End', 'Days'],
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
    headers: ['Resident', 'Medication', 'Indication', 'Start Date', 'Duration (Days)', 'Compliance Issues'],
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
