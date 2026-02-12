// Global Search System
// Search across residents, ABT, IP cases, vaccinations, notes, and outbreaks

import type { Resident, ABTRecord, IPCase, VaxRecord, Note, Outbreak, AppDatabase } from './types';

export type SearchableEntity = 'resident' | 'abt' | 'ip' | 'vaccination' | 'note' | 'outbreak';

export interface SearchResult {
  id: string;
  type: SearchableEntity;
  title: string;
  subtitle: string;
  description: string;
  url: string;
  score: number;
  matchedFields: string[];
  data: any;
}

export interface SearchOptions {
  entities?: SearchableEntity[];
  limit?: number;
  minScore?: number;
}

// Normalize text for searching
function normalizeText(text: string): string {
  return text.toLowerCase().trim();
}

// Calculate relevance score (0-100)
function calculateScore(text: string, query: string): number {
  const normalizedText = normalizeText(text);
  const normalizedQuery = normalizeText(query);
  
  // Exact match
  if (normalizedText === normalizedQuery) return 100;
  
  // Starts with query
  if (normalizedText.startsWith(normalizedQuery)) return 90;
  
  // Contains whole query
  if (normalizedText.includes(normalizedQuery)) return 70;
  
  // Contains all words from query
  const queryWords = normalizedQuery.split(/\s+/);
  const matchedWords = queryWords.filter(word => normalizedText.includes(word));
  if (matchedWords.length === queryWords.length) return 50;
  
  // Partial word match
  if (matchedWords.length > 0) return 30 * (matchedWords.length / queryWords.length);
  
  return 0;
}

// Search residents
function searchResidents(residents: Record<string, Resident>, query: string): SearchResult[] {
  const results: SearchResult[] = [];
  
  for (const resident of Object.values(residents)) {
    const fields = [
      { field: 'name', value: resident.name, weight: 3 },
      { field: 'mrn', value: resident.mrn, weight: 2 },
      { field: 'unit', value: resident.unit, weight: 1 },
      { field: 'room', value: resident.room, weight: 1 },
      { field: 'physician', value: resident.physician || '', weight: 1 },
    ];
    
    let maxScore = 0;
    const matchedFields: string[] = [];
    
    for (const { field, value, weight } of fields) {
      const score = calculateScore(value, query) * weight;
      if (score > 0) {
        matchedFields.push(field);
        maxScore = Math.max(maxScore, score);
      }
    }
    
    if (maxScore > 0) {
      results.push({
        id: resident.id,
        type: 'resident',
        title: resident.name,
        subtitle: `MRN: ${resident.mrn} | ${resident.unit}-${resident.room}`,
        description: resident.status || (resident.active_on_census ? 'Active' : 'Discharged'),
        url: `/resident/${resident.mrn}`,
        score: maxScore,
        matchedFields,
        data: resident,
      });
    }
  }
  
  return results;
}

// Search ABT records
function searchABT(records: ABTRecord[], query: string): SearchResult[] {
  const results: SearchResult[] = [];
  
  for (const record of records) {
    const medication = record.medication || record.med_name || '';
    const name = record.residentName || record.name || '';
    
    const fields = [
      { field: 'medication', value: medication, weight: 3 },
      { field: 'resident', value: name, weight: 2 },
      { field: 'indication', value: record.indication, weight: 2 },
      { field: 'mrn', value: record.mrn, weight: 1 },
    ];
    
    let maxScore = 0;
    const matchedFields: string[] = [];
    
    for (const { field, value, weight } of fields) {
      const score = calculateScore(value, query) * weight;
      if (score > 0) {
        matchedFields.push(field);
        maxScore = Math.max(maxScore, score);
      }
    }
    
    if (maxScore > 0) {
      results.push({
        id: record.id,
        type: 'abt',
        title: `${name} - ${medication}`,
        subtitle: record.indication,
        description: `${record.dose} ${record.route} | Status: ${record.status}`,
        url: `/abt?highlight=${record.id}`,
        score: maxScore,
        matchedFields,
        data: record,
      });
    }
  }
  
  return results;
}

// Search IP cases
function searchIPCases(cases: IPCase[], query: string): SearchResult[] {
  const results: SearchResult[] = [];
  
  for (const ipCase of cases) {
    const name = ipCase.residentName || ipCase.name || '';
    const infectionType = ipCase.infectionType || ipCase.infection_type || '';
    
    const fields = [
      { field: 'resident', value: name, weight: 2 },
      { field: 'infection', value: infectionType, weight: 3 },
      { field: 'organism', value: ipCase.suspectedOrConfirmedOrganism || '', weight: 2 },
      { field: 'mrn', value: ipCase.mrn, weight: 1 },
    ];
    
    let maxScore = 0;
    const matchedFields: string[] = [];
    
    for (const { field, value, weight } of fields) {
      const score = calculateScore(value, query) * weight;
      if (score > 0) {
        matchedFields.push(field);
        maxScore = Math.max(maxScore, score);
      }
    }
    
    if (maxScore > 0) {
      results.push({
        id: ipCase.id,
        type: 'ip',
        title: `${name} - ${infectionType}`,
        subtitle: ipCase.protocol,
        description: `Status: ${ipCase.status} | Onset: ${ipCase.onsetDate || ipCase.onset_date || 'N/A'}`,
        url: `/ip?highlight=${ipCase.id}`,
        score: maxScore,
        matchedFields,
        data: ipCase,
      });
    }
  }
  
  return results;
}

// Search vaccinations
function searchVaccinations(records: VaxRecord[], query: string): SearchResult[] {
  const results: SearchResult[] = [];
  
  for (const record of records) {
    const name = record.residentName || record.name || '';
    const vaccine = record.vaccine || record.vaccine_type || '';
    
    const fields = [
      { field: 'vaccine', value: vaccine, weight: 3 },
      { field: 'resident', value: name, weight: 2 },
      { field: 'mrn', value: record.mrn, weight: 1 },
    ];
    
    let maxScore = 0;
    const matchedFields: string[] = [];
    
    for (const { field, value, weight } of fields) {
      const score = calculateScore(value, query) * weight;
      if (score > 0) {
        matchedFields.push(field);
        maxScore = Math.max(maxScore, score);
      }
    }
    
    if (maxScore > 0) {
      results.push({
        id: record.id,
        type: 'vaccination',
        title: `${name} - ${vaccine}`,
        subtitle: `Status: ${record.status}`,
        description: record.dateGiven || record.dueDate || 'No date recorded',
        url: `/vax?highlight=${record.id}`,
        score: maxScore,
        matchedFields,
        data: record,
      });
    }
  }
  
  return results;
}

// Search notes
function searchNotes(notes: Note[], query: string): SearchResult[] {
  const results: SearchResult[] = [];
  
  for (const note of notes) {
    const name = note.residentName || note.name || '';
    
    const fields = [
      { field: 'text', value: note.text, weight: 3 },
      { field: 'resident', value: name, weight: 2 },
      { field: 'category', value: note.category, weight: 1 },
      { field: 'mrn', value: note.mrn, weight: 1 },
    ];
    
    let maxScore = 0;
    const matchedFields: string[] = [];
    
    for (const { field, value, weight } of fields) {
      const score = calculateScore(value, query) * weight;
      if (score > 0) {
        matchedFields.push(field);
        maxScore = Math.max(maxScore, score);
      }
    }
    
    if (maxScore > 0) {
      const preview = note.text.length > 100 ? note.text.substring(0, 100) + '...' : note.text;
      results.push({
        id: note.id,
        type: 'note',
        title: `Note: ${name}`,
        subtitle: note.category,
        description: preview,
        url: `/notes?highlight=${note.id}`,
        score: maxScore,
        matchedFields,
        data: note,
      });
    }
  }
  
  return results;
}

// Search outbreaks
function searchOutbreaks(outbreaks: Outbreak[], query: string): SearchResult[] {
  const results: SearchResult[] = [];
  
  for (const outbreak of outbreaks) {
    const fields = [
      { field: 'name', value: outbreak.name, weight: 3 },
      { field: 'type', value: outbreak.type, weight: 2 },
      { field: 'units', value: outbreak.affectedUnits.join(' '), weight: 1 },
    ];
    
    let maxScore = 0;
    const matchedFields: string[] = [];
    
    for (const { field, value, weight } of fields) {
      const score = calculateScore(value, query) * weight;
      if (score > 0) {
        matchedFields.push(field);
        maxScore = Math.max(maxScore, score);
      }
    }
    
    if (maxScore > 0) {
      results.push({
        id: outbreak.id,
        type: 'outbreak',
        title: outbreak.name,
        subtitle: `${outbreak.type} | Status: ${outbreak.status}`,
        description: `${outbreak.totalCases} cases | Units: ${outbreak.affectedUnits.join(', ')}`,
        url: `/outbreak?id=${outbreak.id}`,
        score: maxScore,
        matchedFields,
        data: outbreak,
      });
    }
  }
  
  return results;
}

// Main search function
export function globalSearch(
  db: AppDatabase,
  query: string,
  options: SearchOptions = {}
): SearchResult[] {
  if (!query || query.trim().length === 0) {
    return [];
  }
  
  const {
    entities = ['resident', 'abt', 'ip', 'vaccination', 'note', 'outbreak'],
    limit = 50,
    minScore = 20,
  } = options;
  
  let allResults: SearchResult[] = [];
  
  // Search each entity type
  if (entities.includes('resident')) {
    allResults.push(...searchResidents(db.census?.residentsByMrn || {}, query));
  }
  
  if (entities.includes('abt')) {
    allResults.push(...searchABT(db.records?.abx || [], query));
  }
  
  if (entities.includes('ip')) {
    allResults.push(...searchIPCases(db.records?.ip_cases || [], query));
  }
  
  if (entities.includes('vaccination')) {
    allResults.push(...searchVaccinations(db.records?.vax || [], query));
  }
  
  if (entities.includes('note')) {
    allResults.push(...searchNotes(db.records?.notes || [], query));
  }
  
  if (entities.includes('outbreak')) {
    allResults.push(...searchOutbreaks(db.records?.outbreaks || [], query));
  }
  
  // Filter by minimum score and sort
  return allResults
    .filter(r => r.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

// Quick filters
export function searchByMedication(db: AppDatabase, medication: string): SearchResult[] {
  return globalSearch(db, medication, { entities: ['abt'], limit: 20 });
}

export function searchByResident(db: AppDatabase, residentName: string): SearchResult[] {
  return globalSearch(db, residentName, { entities: ['resident', 'abt', 'ip', 'vaccination'], limit: 20 });
}

export function searchByUnit(db: AppDatabase, unit: string): SearchResult[] {
  const results = globalSearch(db, unit, { limit: 100 });
  return results.filter(r => 
    r.data?.unit === unit || 
    r.data?.affectedUnits?.includes(unit)
  );
}
