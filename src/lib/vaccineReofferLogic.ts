/**
 * CDC-based Vaccine Re-offer Logic
 * 
 * References:
 * - CDC Influenza: Seasonal flu vaccine recommended annually, re-offer to decliners throughout season
 * - CDC COVID-19: Updated vaccine annually, re-offer per current recommendations
 * - CDC Pneumococcal: One-time or series depending on age/risk, annual re-offer for decliners
 * - CDC RSV: Seasonal, similar to influenza pattern
 */

import { VaxRecord, Outbreak } from './types';

export interface ReofferCandidate {
  record: VaxRecord;
  reason: string;
  priority: 'high' | 'medium' | 'low';
  daysSinceDecline: number;
  seasonalContext?: string;
  outbreakLinked?: boolean;
  outbreakName?: string;
}

// Flu season: October 1 through March 31
const isInFluSeason = (date: Date = new Date()): boolean => {
  const month = date.getMonth(); // 0-indexed
  return month >= 9 || month <= 2; // Oct-Dec (9-11) or Jan-Mar (0-2)
};

// Get current flu season year range
const getCurrentFluSeason = (date: Date = new Date()): { start: Date; end: Date } => {
  const year = date.getFullYear();
  const month = date.getMonth();
  
  // If Jan-Mar, we're in the season that started previous October
  if (month <= 2) {
    return {
      start: new Date(year - 1, 9, 1), // Oct 1 of previous year
      end: new Date(year, 2, 31) // Mar 31 of current year
    };
  }
  // If Oct-Dec, we're in the season starting this October
  if (month >= 9) {
    return {
      start: new Date(year, 9, 1), // Oct 1 of current year
      end: new Date(year + 1, 2, 31) // Mar 31 of next year
    };
  }
  // Apr-Sep: next season hasn't started yet, use upcoming
  return {
    start: new Date(year, 9, 1),
    end: new Date(year + 1, 2, 31)
  };
};

// Check if a vaccine was given in current flu season
const isVaccinatedThisFluSeason = (dateGiven: string | undefined, date: Date = new Date()): boolean => {
  if (!dateGiven) return false;
  const givenDate = new Date(dateGiven);
  const season = getCurrentFluSeason(date);
  return givenDate >= season.start && givenDate <= season.end;
};

// Calculate days since a date
const daysSince = (dateStr: string | undefined): number => {
  if (!dateStr) return Infinity;
  const date = new Date(dateStr);
  const now = new Date();
  return Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
};

/**
 * Re-offer cadence rules based on CDC guidance:
 * 
 * INFLUENZA (Seasonal):
 * - Re-offer if declined >= 30 days ago AND within flu season (Oct-Mar)
 * - High priority if in peak season (Dec-Feb)
 * - Check: no vaccine given this season
 * 
 * COVID-19:
 * - Re-offer if declined >= 60 days ago (updated CDC guidance 2024+)
 * - Annual updated vaccine recommended
 * 
 * PNEUMOCOCCAL (PNA/PPSV23/PCV):
 * - Re-offer annually (>= 365 days) for decliners
 * - One-time series for most adults 65+
 * 
 * RSV:
 * - Seasonal similar to flu (60+ recommended once, annual offer window)
 * - Re-offer if declined >= 30 days ago during season
 */

export const getReofferCandidates = (
  vaxRecords: VaxRecord[],
  activeMrns: Set<string>,
  activeOutbreaks?: Outbreak[]
): ReofferCandidate[] => {
  const now = new Date();
  const inFluSeason = isInFluSeason(now);
  const month = now.getMonth();
  const isPeakFluSeason = month >= 11 || month <= 1; // Dec, Jan, Feb
  
  // Check for active respiratory or GI outbreaks to boost priority
  const hasRespiratoryOutbreak = activeOutbreaks?.some(o => 
    o.status === 'active' && o.type === 'respiratory'
  );
  const respiratoryOutbreakName = activeOutbreaks?.find(o => 
    o.status === 'active' && o.type === 'respiratory'
  )?.name;
  
  const candidates: ReofferCandidate[] = [];
  
  // Group records by MRN and vaccine type
  const declinedRecords = vaxRecords.filter(r => {
    // Must be declined status
    if (r.status !== 'declined') return false;
    // Must be active on census
    if (r.mrn && !activeMrns.has(r.mrn)) return false;
    return true;
  });
  
  for (const record of declinedRecords) {
    const vaccineType = (record.vaccine || record.vaccine_type || '').toUpperCase();
    const declineDate = record.dateGiven || record.date_given || record.createdAt;
    const days = daysSince(declineDate);
    
    // Check for any given record of same type for this resident this season
    const hasCurrentVaccine = vaxRecords.some(r => 
      r.mrn === record.mrn &&
      r.status === 'given' &&
      (r.vaccine || r.vaccine_type || '').toUpperCase() === vaccineType &&
      (vaccineType.includes('FLU') || vaccineType.includes('INFLUENZA') 
        ? isVaccinatedThisFluSeason(r.dateGiven || r.date_given)
        : daysSince(r.dateGiven || r.date_given) < 365)
    );
    
    if (hasCurrentVaccine) continue;
    
    // INFLUENZA / FLU
    if (vaccineType.includes('FLU') || vaccineType.includes('INFLUENZA')) {
      if (inFluSeason && days >= 30) {
        // Boost priority if respiratory outbreak is active
        const outbreakBoost = hasRespiratoryOutbreak;
        const basePriority = isPeakFluSeason || outbreakBoost ? 'high' : 'medium';
        
        candidates.push({
          record,
          reason: outbreakBoost 
            ? `URGENT: Active respiratory outbreak - prioritize flu re-offer`
            : isPeakFluSeason 
              ? 'Peak flu season - strongly recommend re-offer' 
              : 'Active flu season - recommend re-offer',
          priority: basePriority,
          daysSinceDecline: days,
          seasonalContext: `Flu Season ${getCurrentFluSeason().start.getFullYear()}-${getCurrentFluSeason().end.getFullYear()}`,
          outbreakLinked: outbreakBoost,
          outbreakName: outbreakBoost ? respiratoryOutbreakName : undefined
        });
      }
      continue;
    }
    
    // COVID-19
    if (vaccineType.includes('COVID')) {
      if (days >= 60) {
        // Boost priority if respiratory outbreak is active
        const outbreakBoost = hasRespiratoryOutbreak;
        const basePriority = days >= 180 || outbreakBoost ? 'high' : 'medium';
        
        candidates.push({
          record,
          reason: outbreakBoost 
            ? `URGENT: Active respiratory outbreak - prioritize COVID re-offer`
            : 'CDC recommends updated COVID vaccine annually',
          priority: basePriority,
          daysSinceDecline: days,
          outbreakLinked: outbreakBoost,
          outbreakName: outbreakBoost ? respiratoryOutbreakName : undefined
        });
      }
      continue;
    }
    
    // RSV
    if (vaccineType.includes('RSV')) {
      // RSV season overlaps with flu season
      if (inFluSeason && days >= 30) {
        candidates.push({
          record,
          reason: 'RSV season active - recommend re-offer for 60+ adults',
          priority: 'medium',
          daysSinceDecline: days,
          seasonalContext: 'RSV Season'
        });
      }
      continue;
    }
    
    // PNEUMOCOCCAL (PNA, PPSV23, PCV13, PCV15, PCV20)
    if (vaccineType.includes('PNA') || vaccineType.includes('PNEUMO') || 
        vaccineType.includes('PPSV') || vaccineType.includes('PCV')) {
      if (days >= 365) {
        candidates.push({
          record,
          reason: 'Annual re-offer recommended for pneumococcal vaccine decliners',
          priority: 'low',
          daysSinceDecline: days
        });
      }
      continue;
    }
    
    // TD / TDAP (every 10 years, but re-offer annually for decliners)
    if (vaccineType.includes('TD') || vaccineType.includes('TETANUS')) {
      if (days >= 365) {
        candidates.push({
          record,
          reason: 'Annual re-offer for Td/Tdap decliners',
          priority: 'low',
          daysSinceDecline: days
        });
      }
      continue;
    }
    
    // SHINGLES / ZOSTER (Shingrix)
    if (vaccineType.includes('ZOSTER') || vaccineType.includes('SHINGLES') || vaccineType.includes('SHINGRIX')) {
      if (days >= 180) {
        candidates.push({
          record,
          reason: 'Re-offer Shingrix for 50+ adults',
          priority: 'low',
          daysSinceDecline: days
        });
      }
      continue;
    }
    
    // Generic fallback for other vaccines
    if (days >= 180) {
      candidates.push({
        record,
        reason: 'Consider re-offering based on clinical judgment',
        priority: 'low',
        daysSinceDecline: days
      });
    }
  }
  
  // Sort by priority (high first) then by days since decline (longest first)
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  candidates.sort((a, b) => {
    const pDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (pDiff !== 0) return pDiff;
    return b.daysSinceDecline - a.daysSinceDecline;
  });
  
  return candidates;
};

// Get summary stats for re-offer candidates
export const getReofferSummary = (candidates: ReofferCandidate[]) => {
  const byVaccine: Record<string, number> = {};
  let highPriority = 0;
  let mediumPriority = 0;
  let lowPriority = 0;
  
  for (const c of candidates) {
    const vax = (c.record.vaccine || c.record.vaccine_type || 'Other').toUpperCase();
    byVaccine[vax] = (byVaccine[vax] || 0) + 1;
    
    if (c.priority === 'high') highPriority++;
    else if (c.priority === 'medium') mediumPriority++;
    else lowPriority++;
  }
  
  return {
    total: candidates.length,
    highPriority,
    mediumPriority,
    lowPriority,
    byVaccine
  };
};
