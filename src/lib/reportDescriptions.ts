// Editable Report Descriptions
// These can be customized per facility and are saved to the database

import { loadDB, saveDB } from './database';

export interface ReportDescription {
  id: string;
  name: string;
  defaultDescription: string;
  customDescription?: string;
}

// Default descriptions for all reports
export const defaultReportDescriptions: Record<string, string> = {
  // Executive Reports
  survey_readiness: 'Comprehensive compliance documentation for CMS surveys including infection rates, antibiotic stewardship metrics, and vaccination coverage.',
  surveyor_packet: 'Alphabetical list of active residents with room, unit, and optional ABT/IP status columns for surveyor reference during facility surveys.',
  qapi: 'Quality Assurance Performance Improvement metrics including infection trends, antibiotic utilization, and compliance indicators.',
  infection_trends: 'Monthly and quarterly infection rate analysis with visual charts comparing IP vs ABT rates against national benchmarks.',
  compliance: 'Regulatory compliance status overview mapping facility performance to CMS, NYSDOH, and CDC requirements.',
  medicare_compliance: 'Flags inappropriate antibiotic indications per Medicare guidelines. Identifies prescriptions that may not meet reimbursement criteria.',
  hh_ppe_summary: 'Combined Hand Hygiene and PPE compliance audit summary designed for surveyor review and regulatory documentation.',
  
  // Operational Reports
  daily_ip: 'Daily worklist of active isolation precautions and Enhanced Barrier Precautions (EBP) cases requiring attention.',
  abt_review: 'Antibiotic courses requiring clinical review based on configured cadence (72-hour, weekly, or custom).',
  vax_due: 'Residents with upcoming or overdue vaccinations including flu, pneumonia, COVID-19, and RSV immunizations.',
  vax_reoffer: 'Residents eligible for vaccine re-offer per CDC guidelines: Influenza (30 days, flu season), COVID-19 (180 days).',
  precautions_list: 'Current isolation and transmission-based precautions organized by unit for daily rounds and handoffs.',
  exposure_log: 'Log of potential exposure events and required follow-up actions for infection control tracking.',
  vax_snapshot: 'Point-in-time vaccination count for active residents only (excludes discharged). Summarizes by vaccine category.',
  standard_of_care: 'Weekly summary of ABT starts, IP cases, and vaccination declinations for standard of care documentation.',
  followup_notes: 'Clinical notes requiring follow-up organized by status (pending, overdue) with sign-off tracking.',
  monthly_abt: 'All residents who received antibiotics during the selected month with start/end dates and indications.',
  ip_review: 'IP cases due for protocol-based review. Tracks review cadence compliance and identifies overdue assessments.',
  hand_hygiene: 'CDC 5 Moments of Hand Hygiene audit template with opportunity tracking and compliance rate calculation.',
  ppe_usage: 'Personal protective equipment monitoring by unit and precaution type (EBP, Contact, Droplet, Airborne).',
  
  // Surveillance Reports
  surv_trend: 'Monthly infection counts by category (UTI, Respiratory, Skin/Wound, GI, MDRO, COVID, Flu) with trending analysis.',
  surv_acquired: 'Facility-acquired infections with onset dates, classification, and outcome tracking for surveillance.',
  surv_rate_census: 'Infection rates calculated as a percentage of average monthly census by infection category.',
  surv_rate_1000: 'Infection rates per 1,000 resident days by category - standard NHSN surveillance metric.',
  surv_abt_1000: 'Antibiotic prescription starts per 1,000 resident days - key antibiotic stewardship metric.',
  surv_aur: 'Antibiotic Utilization Ratio: Days of therapy (DOT) per 1,000 resident days with national benchmark comparison.',
  
  // NEW High-Value Reports
  abt_duration: 'Flags antibiotic courses exceeding threshold duration (default 7 days) for stewardship review. Highlights high-priority cases >14 days.',
  new_admit_screening: 'Tracks new admissions requiring infection prevention screening. Flags overdue screenings (>3 days post-admission).',
  outbreak_summary: 'Identifies potential outbreak patterns by analyzing infection clusters by type and unit. Alerts when thresholds exceeded.',
};

/**
 * Get the description for a report, checking for custom descriptions first
 */
export const getReportDescription = (reportId: string): string => {
  const db = loadDB();
  const customDescriptions = db.settings.customReportDescriptions || {};
  
  return customDescriptions[reportId] || defaultReportDescriptions[reportId] || '';
};

/**
 * Save a custom description for a report
 */
export const saveReportDescription = (reportId: string, description: string): void => {
  const db = loadDB();
  
  if (!db.settings.customReportDescriptions) {
    db.settings.customReportDescriptions = {};
  }
  
  // If the description matches the default, remove the custom one
  if (description === defaultReportDescriptions[reportId]) {
    delete db.settings.customReportDescriptions[reportId];
  } else {
    db.settings.customReportDescriptions[reportId] = description;
  }
  
  saveDB(db);
};

/**
 * Reset a report description to its default
 */
export const resetReportDescription = (reportId: string): string => {
  const db = loadDB();
  
  if (db.settings.customReportDescriptions) {
    delete db.settings.customReportDescriptions[reportId];
    saveDB(db);
  }
  
  return defaultReportDescriptions[reportId] || '';
};

/**
 * Get all report descriptions (for export/backup)
 */
export const getAllReportDescriptions = (): Record<string, string> => {
  const db = loadDB();
  const customDescriptions = db.settings.customReportDescriptions || {};
  
  return {
    ...defaultReportDescriptions,
    ...customDescriptions,
  };
};
