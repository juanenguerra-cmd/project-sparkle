export type VaccineSubjectType = 'resident' | 'staff';

export interface VaccinationRecord {
  id: string;
  subjectType: VaccineSubjectType;
  subjectId: string;
  subjectName: string;
  employeeId?: string;
  mrn?: string;
  vaccineType: 'influenza' | 'pneumococcal' | 'covid19' | string;
  status: 'vaccinated' | 'declined';
  location: 'in-house' | 'outside';
  dateGiven?: string;
  dateDeclined?: string;
  seasonTag?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}
