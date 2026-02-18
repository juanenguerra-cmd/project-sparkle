export type StaffRole =
  | 'RN'
  | 'LPN'
  | 'CNA'
  | 'MD'
  | 'NP'
  | 'PA'
  | 'Therapy'
  | 'EVS'
  | 'Admin'
  | 'Other';

export type ComplianceBinaryStatus = 'vaccinated' | 'declined';
export type FaceFitStatus = 'pass' | 'failed' | 'declined';

export interface StaffMember {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  center?: string;
  department?: string;
  empType?: string;
  role?: StaffRole | string;
  status: 'active' | 'inactive';
  hireDate?: string;

  // Compliance tracking
  faceFitTestStatus?: FaceFitStatus;
  faceFitTestDate?: string;
  influenzaStatus?: ComplianceBinaryStatus;
  influenzaDate?: string;
  pneumoniaStatus?: ComplianceBinaryStatus;
  pneumoniaDate?: string;
  covidStatus?: ComplianceBinaryStatus;
  covidDate?: string;

  notes?: string;
  createdAt: string;
  updatedAt: string;
}
