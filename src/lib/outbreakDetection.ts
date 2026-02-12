// Enhanced Outbreak Detection System
// Automatic detection based on case clustering

import { differenceInHours, format, parseISO, subHours } from 'date-fns';
import type { IPCase, Resident, Outbreak, SymptomCategory } from './types';

export interface OutbreakThreshold {
  category: SymptomCategory;
  minCases: number;
  timeWindowHours: number;
  requireUnitClustering?: boolean;
  minCasesPerUnit?: number;
}

export const OUTBREAK_THRESHOLDS: OutbreakThreshold[] = [
  {
    category: 'respiratory',
    minCases: 3,
    timeWindowHours: 72,
    requireUnitClustering: false,
  },
  {
    category: 'gi',
    minCases: 3,
    timeWindowHours: 48,
    requireUnitClustering: false,
  },
  {
    category: 'skin',
    minCases: 2,
    timeWindowHours: 72,
    requireUnitClustering: true,
    minCasesPerUnit: 2,
  },
  {
    category: 'uti',
    minCases: 3,
    timeWindowHours: 168, // 1 week
    requireUnitClustering: false,
  },
];

export interface OutbreakDetection {
  category: SymptomCategory;
  caseCount: number;
  timeWindow: number;
  cases: IPCase[];
  affectedUnits: string[];
  unitCounts: Record<string, number>;
  recommendation: 'declare_watch' | 'declare_active' | 'monitor';
  reasoning: string[];
  suggestedName: string;
}

// Detect potential outbreaks
export function detectPotentialOutbreaks(
  ipCases: IPCase[],
  residents: Record<string, Resident>,
  existingOutbreaks: Outbreak[]
): OutbreakDetection[] {
  const detections: OutbreakDetection[] = [];
  const now = new Date();
  
  for (const threshold of OUTBREAK_THRESHOLDS) {
    const cutoffTime = subHours(now, threshold.timeWindowHours);
    
    // Get recent cases for this category
    const recentCases = ipCases.filter(c => {
      if (c.syndromeCategory !== threshold.category) return false;
      
      const onset = c.onsetDate || c.onset_date;
      if (!onset) return false;
      
      const onsetDate = parseISO(onset);
      return onsetDate >= cutoffTime;
    });
    
    if (recentCases.length < threshold.minCases) continue;
    
    // Check if outbreak already exists
    const existing = existingOutbreaks.find(
      o => o.type === threshold.category && 
      (o.status === 'watch' || o.status === 'active')
    );
    
    if (existing) continue; // Already declared
    
    // Analyze unit distribution
    const unitCounts: Record<string, number> = {};
    for (const ipCase of recentCases) {
      const unit = ipCase.unit;
      unitCounts[unit] = (unitCounts[unit] || 0) + 1;
    }
    
    const affectedUnits = Object.keys(unitCounts);
    let meetsUnitCriteria = true;
    
    if (threshold.requireUnitClustering && threshold.minCasesPerUnit) {
      // At least one unit must have minimum cases
      meetsUnitCriteria = Object.values(unitCounts).some(
        count => count >= threshold.minCasesPerUnit
      );
    }
    
    if (!meetsUnitCriteria) continue;
    
    // Determine recommendation
    const reasoning: string[] = [];
    let recommendation: 'declare_watch' | 'declare_active' | 'monitor' = 'monitor';
    
    if (recentCases.length >= threshold.minCases * 2) {
      recommendation = 'declare_active';
      reasoning.push(`${recentCases.length} cases exceeds 2x threshold`);
    } else if (recentCases.length >= threshold.minCases) {
      recommendation = 'declare_watch';
      reasoning.push(`${recentCases.length} cases meets threshold`);
    }
    
    if (affectedUnits.length > 1) {
      reasoning.push(`Multiple units affected: ${affectedUnits.join(', ')}`);
      if (recommendation === 'declare_watch') {
        recommendation = 'declare_active';
      }
    }
    
    const suggestedName = `${threshold.category.toUpperCase()} - ${format(now, 'MMM yyyy')}`;
    
    detections.push({
      category: threshold.category,
      caseCount: recentCases.length,
      timeWindow: threshold.timeWindowHours,
      cases: recentCases,
      affectedUnits,
      unitCounts,
      recommendation,
      reasoning,
      suggestedName,
    });
  }
  
  return detections;
}

// Auto-create watch outbreak
export function createWatchOutbreak(detection: OutbreakDetection): Outbreak {
  return {
    id: `outbreak_${Date.now()}_${detection.category}`,
    name: detection.suggestedName,
    type: detection.category,
    startDate: format(new Date(), 'yyyy-MM-dd'),
    status: 'watch',
    affectedUnits: detection.affectedUnits,
    totalCases: detection.caseCount,
    notes: `Auto-detected: ${detection.reasoning.join('. ')}`,
    createdAt: new Date().toISOString(),
  };
}

// Suggest line listing residents
export function suggestLineListingCandidates(
  detection: OutbreakDetection
): Array<{ mrn: string; residentName: string; reason: string }> {
  return detection.cases.map(ipCase => ({
    mrn: ipCase.mrn,
    residentName: ipCase.residentName || ipCase.name || 'Unknown',
    reason: `${ipCase.infectionType || ipCase.infection_type} onset ${ipCase.onsetDate || ipCase.onset_date}`,
  }));
}

// Check if outbreak should be escalated from watch to active
export function shouldEscalateOutbreak(
  outbreak: Outbreak,
  ipCases: IPCase[]
): { shouldEscalate: boolean; reason?: string } {
  if (outbreak.status !== 'watch') {
    return { shouldEscalate: false };
  }
  
  const outbreakStart = parseISO(outbreak.startDate);
  const hoursSinceStart = differenceInHours(new Date(), outbreakStart);
  
  // Count new cases since outbreak start
  const outbreakCases = ipCases.filter(c => {
    if (c.syndromeCategory !== outbreak.type) return false;
    const onset = c.onsetDate || c.onset_date;
    if (!onset) return false;
    const onsetDate = parseISO(onset);
    return onsetDate >= outbreakStart;
  });
  
  // Escalate if cases doubled in 48 hours
  if (hoursSinceStart >= 48 && outbreakCases.length >= outbreak.totalCases * 2) {
    return {
      shouldEscalate: true,
      reason: `Cases doubled from ${outbreak.totalCases} to ${outbreakCases.length} in ${Math.round(hoursSinceStart)} hours`,
    };
  }
  
  // Escalate if spread to new units
  const newUnits = new Set<string>();
  for (const ipCase of outbreakCases) {
    if (!outbreak.affectedUnits.includes(ipCase.unit)) {
      newUnits.add(ipCase.unit);
    }
  }
  
  if (newUnits.size > 0) {
    return {
      shouldEscalate: true,
      reason: `Spread to new units: ${Array.from(newUnits).join(', ')}`,
    };
  }
  
  return { shouldEscalate: false };
}
