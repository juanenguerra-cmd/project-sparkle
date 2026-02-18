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
  faceFitTestDate?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}
