import * as XLSX from 'xlsx';
import { ReofferCandidate } from '../vaccineReofferLogic';
import { format } from 'date-fns';

export interface ExportOptions {
  format: 'xlsx' | 'csv';
  includeHeaders: boolean;
  filters?: {
    priority?: string[];
    vaccines?: string[];
    units?: string[];
  };
}

export const exportReofferReport = (
  candidates: ReofferCandidate[],
  options: ExportOptions = { format: 'xlsx', includeHeaders: true }
): string => {
  let filteredCandidates = [...candidates];
  
  if (options.filters?.priority) {
    filteredCandidates = filteredCandidates.filter(c => 
      options.filters!.priority!.includes(c.priority)
    );
  }

  const exportData = filteredCandidates.map(candidate => ({
    'Priority': candidate.priority.toUpperCase(),
    'Resident': candidate.record.residentName,
    'MRN': candidate.record.mrn,
    'Unit': candidate.record.unit || '',
    'Room': candidate.record.room || '',
    'Vaccine': candidate.record.vaccine,
    'Days Since Decline': candidate.daysSinceDecline,
    'Notes': candidate.record.notes || ''
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Reoffer Candidates');

  const timestamp = format(new Date(), 'yyyyMMdd_HHmmss');
  const filename = `vaccine_reoffer_${timestamp}.${options.format}`;

  XLSX.writeFile(workbook, filename);
  return filename;
};
