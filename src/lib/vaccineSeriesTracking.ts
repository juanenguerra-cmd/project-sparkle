// Vaccine Series Tracking System
// Automatic calculation of next due dates for multi-dose vaccines

import { addDays, addMonths, differenceInDays, format, parseISO } from 'date-fns';
import type { VaxRecord } from './types';

export interface VaccineSeriesDefinition {
  vaccine: string;
  totalDoses: number;
  intervalDays: number;
  windowStartDays?: number; // Minimum days before next dose
  windowEndDays?: number; // Maximum days before next dose
  boosterIntervalMonths?: number;
  requiresReoffer?: boolean; // F887 compliance
  reofferIntervalDays?: number;
}

export const VACCINE_SERIES: VaccineSeriesDefinition[] = [
  {
    vaccine: 'COVID-19',
    totalDoses: 2,
    intervalDays: 21,
    windowStartDays: 21,
    windowEndDays: 28,
    boosterIntervalMonths: 6,
    requiresReoffer: true,
    reofferIntervalDays: 90,
  },
  {
    vaccine: 'Shingrix',
    totalDoses: 2,
    intervalDays: 60, // 2 months
    windowStartDays: 60,
    windowEndDays: 180, // Up to 6 months
  },
  {
    vaccine: 'Pneumovax 23',
    totalDoses: 2,
    intervalDays: 1825, // 5 years
    windowStartDays: 1825,
    windowEndDays: 1825,
  },
  {
    vaccine: 'Prevnar 13',
    totalDoses: 1,
    intervalDays: 0,
  },
  {
    vaccine: 'Influenza',
    totalDoses: 1,
    intervalDays: 365, // Annual
    boosterIntervalMonths: 12,
  },
];

export interface SeriesStatus {
  vaccine: string;
  currentDose: number;
  totalDoses: number;
  isComplete: boolean;
  nextDueDate?: string;
  isOverdue: boolean;
  daysUntilDue?: number;
  lastDoseDate?: string;
  requiresReoffer: boolean;
}

// Get vaccine series definition
export function getSeriesDefinition(vaccine: string): VaccineSeriesDefinition | undefined {
  return VACCINE_SERIES.find(s => 
    vaccine.toLowerCase().includes(s.vaccine.toLowerCase()) ||
    s.vaccine.toLowerCase().includes(vaccine.toLowerCase())
  );
}

// Calculate next due date based on last dose
export function calculateNextDueDate(
  vaccine: string,
  lastDoseDate: string,
  doseNumber: number
): string | undefined {
  const series = getSeriesDefinition(vaccine);
  if (!series) return undefined;

  const lastDate = parseISO(lastDoseDate);
  
  // If this was the last dose in the series
  if (doseNumber >= series.totalDoses) {
    // Check for booster requirement
    if (series.boosterIntervalMonths) {
      return format(addMonths(lastDate, series.boosterIntervalMonths), 'yyyy-MM-dd');
    }
    return undefined; // Series complete, no booster
  }
  
  // Calculate next dose due date
  const intervalDays = series.windowStartDays || series.intervalDays;
  return format(addDays(lastDate, intervalDays), 'yyyy-MM-dd');
}

// Get series status for a resident
export function getVaccineSeriesStatus(
  vaccine: string,
  residentVaxHistory: VaxRecord[]
): SeriesStatus {
  const series = getSeriesDefinition(vaccine);
  
  if (!series) {
    return {
      vaccine,
      currentDose: 0,
      totalDoses: 1,
      isComplete: false,
      isOverdue: false,
      requiresReoffer: false,
    };
  }
  
  // Filter records for this vaccine
  const vaccineRecords = residentVaxHistory
    .filter(r => {
      const vaxName = r.vaccine || r.vaccine_type || '';
      return vaxName.toLowerCase().includes(vaccine.toLowerCase()) ||
             vaccine.toLowerCase().includes(vaxName.toLowerCase());
    })
    .filter(r => r.status === 'given')
    .sort((a, b) => {
      const dateA = a.dateGiven || a.date_given || '';
      const dateB = b.dateGiven || b.date_given || '';
      return dateA.localeCompare(dateB);
    });
  
  const currentDose = vaccineRecords.length;
  const isComplete = currentDose >= series.totalDoses;
  
  let nextDueDate: string | undefined;
  let lastDoseDate: string | undefined;
  let isOverdue = false;
  let daysUntilDue: number | undefined;
  
  if (vaccineRecords.length > 0) {
    const lastRecord = vaccineRecords[vaccineRecords.length - 1];
    lastDoseDate = lastRecord.dateGiven || lastRecord.date_given;
    
    if (lastDoseDate) {
      nextDueDate = calculateNextDueDate(vaccine, lastDoseDate, currentDose);
      
      if (nextDueDate) {
        const today = new Date();
        const dueDate = parseISO(nextDueDate);
        daysUntilDue = differenceInDays(dueDate, today);
        isOverdue = daysUntilDue < 0;
      }
    }
  } else {
    // No doses given yet, considered overdue if resident is active
    isOverdue = true;
  }
  
  return {
    vaccine,
    currentDose,
    totalDoses: series.totalDoses,
    isComplete,
    nextDueDate,
    isOverdue,
    daysUntilDue,
    lastDoseDate,
    requiresReoffer: series.requiresReoffer || false,
  };
}

// Check if reoffer is due (F887)
export function isReofferDue(
  vaccine: string,
  declineDate: string
): boolean {
  const series = getSeriesDefinition(vaccine);
  if (!series || !series.requiresReoffer) return false;
  
  const declined = parseISO(declineDate);
  const today = new Date();
  const daysSinceDecline = differenceInDays(today, declined);
  
  return daysSinceDecline >= (series.reofferIntervalDays || 90);
}

// Get all residents needing vaccine attention
export function getResidentsNeedingVaccines(
  allVaxRecords: VaxRecord[],
  vaccineType?: string
): Array<{
  mrn: string;
  residentName: string;
  vaccine: string;
  status: SeriesStatus;
  action: 'initial_dose' | 'next_dose' | 'booster' | 'reoffer';
}> {
  const results: Array<any> = [];
  
  // Group by resident
  const byResident: Record<string, VaxRecord[]> = {};
  for (const record of allVaxRecords) {
    if (!byResident[record.mrn]) byResident[record.mrn] = [];
    byResident[record.mrn].push(record);
  }
  
  // Check each resident's vaccine status
  for (const [mrn, records] of Object.entries(byResident)) {
    const residentName = records[0]?.residentName || records[0]?.name || 'Unknown';
    
    const vaccinesToCheck = vaccineType 
      ? [vaccineType] 
      : VACCINE_SERIES.map(s => s.vaccine);
    
    for (const vaccine of vaccinesToCheck) {
      const status = getVaccineSeriesStatus(vaccine, records);
      
      if (!status.isComplete) {
        if (status.currentDose === 0) {
          results.push({
            mrn,
            residentName,
            vaccine,
            status,
            action: 'initial_dose',
          });
        } else if (status.isOverdue && status.nextDueDate) {
          results.push({
            mrn,
            residentName,
            vaccine,
            status,
            action: 'next_dose',
          });
        }
      } else if (status.nextDueDate && status.isOverdue) {
        // Booster due
        results.push({
          mrn,
          residentName,
          vaccine,
          status,
          action: 'booster',
        });
      }
      
      // Check for reoffer
      const declinedRecords = records.filter(r => 
        r.status === 'declined' && 
        (r.vaccine || '').toLowerCase().includes(vaccine.toLowerCase())
      );
      
      for (const declined of declinedRecords) {
        const declineDate = declined.offerDate || declined.createdAt;
        if (declineDate && isReofferDue(vaccine, declineDate)) {
          results.push({
            mrn,
            residentName,
            vaccine,
            status,
            action: 'reoffer',
          });
        }
      }
    }
  }
  
  return results;
}

// Auto-update due dates on new vaccination
export function updateSeriesDueDates(
  newVaxRecord: VaxRecord,
  allResidentVaxRecords: VaxRecord[]
): string | undefined {
  const vaccine = newVaxRecord.vaccine || newVaxRecord.vaccine_type || '';
  const dateGiven = newVaxRecord.dateGiven || newVaxRecord.date_given;
  
  if (!dateGiven) return undefined;
  
  const status = getVaccineSeriesStatus(vaccine, allResidentVaxRecords);
  return status.nextDueDate;
}
