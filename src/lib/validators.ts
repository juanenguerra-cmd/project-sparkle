import { ABTRecord, IPCase, Resident, VaxRecord } from './types';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export const validateDate = (
  dateStr: string | undefined | null,
  fieldName: string,
  options: { required?: boolean; allowFuture?: boolean; minDate?: Date; maxDate?: Date } = {}
): string | null => {
  const { required = true, allowFuture = false, minDate, maxDate } = options;

  if (!dateStr) return required ? `${fieldName} is required` : null;

  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return `${fieldName} is not a valid date`;

  const effectiveMin = minDate || new Date('1900-01-01');
  if (date < effectiveMin) return `${fieldName} cannot be before ${effectiveMin.toLocaleDateString()}`;

  if (!allowFuture) {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (date > today) return `${fieldName} cannot be in the future`;
  }

  if (maxDate && date > maxDate) return `${fieldName} cannot be after ${maxDate.toLocaleDateString()}`;

  return null;
};

export const validateDateRange = (
  startDate: string | undefined | null,
  endDate: string | undefined | null,
  startLabel = 'Start date',
  endLabel = 'End date',
  options: { endRequired?: boolean } = {}
): string | null => {
  const startErr = validateDate(startDate, startLabel, { required: true, allowFuture: false });
  if (startErr) return startErr;

  if (endDate || options.endRequired) {
    const endErr = validateDate(endDate, endLabel, { required: !!options.endRequired, allowFuture: false });
    if (endErr) return endErr;

    if (endDate && startDate && new Date(endDate) < new Date(startDate)) {
      return `${endLabel} cannot be before ${startLabel}`;
    }
  }

  return null;
};

export const validateDateOfBirth = (dob: string | undefined | null): string | null => {
  if (!dob) return 'Date of birth is required';
  const birthDate = new Date(dob);
  if (Number.isNaN(birthDate.getTime())) return 'Date of birth is not a valid date';

  const today = new Date();
  const minDate = new Date();
  minDate.setFullYear(today.getFullYear() - 120);
  if (birthDate < minDate) return 'Date of birth indicates age over 120 years';
  if (birthDate >= today) return 'Date of birth must be in the past';
  return null;
};

export const validateResident = (resident: Partial<Resident>): ValidationResult => {
  const errors: string[] = [];

  if (!resident.mrn || resident.mrn.trim() === '') {
    errors.push('MRN is required');
  } else if (!/^[A-Za-z0-9-]{3,32}$/.test(resident.mrn)) {
    errors.push('MRN must be 3-32 alphanumeric characters');
  }

  if (!resident.name?.trim()) errors.push('Name is required');
  if (!resident.unit?.trim()) errors.push('Unit is required');
  if (!resident.room?.trim()) errors.push('Room number is required');

  if (resident.dob) {
    const dobError = validateDateOfBirth(resident.dob);
    if (dobError) errors.push(dobError);
  }

  if (resident.admitDate) {
    const err = validateDate(resident.admitDate, 'Admission date', { required: false });
    if (err) errors.push(err);
  }

  return { valid: errors.length === 0, errors };
};

export const validateIPCase = (ipCase: Partial<IPCase>): ValidationResult => {
  const errors: string[] = [];
  const precaution = ipCase.protocol;
  const organism = ipCase.infectionType || ipCase.infection_type || ipCase.suspectedOrConfirmedOrganism;
  const onset = ipCase.onsetDate || ipCase.onset_date;
  const resolution = ipCase.resolutionDate || ipCase.resolution_date;
  const status = ipCase.status;

  if (!ipCase.mrn) errors.push('MRN is required');
  if (!ipCase.residentName && !ipCase.name) errors.push('Resident name is required');
  if (!precaution) errors.push('Precaution type is required');
  if (!organism && precaution !== 'Standard Precautions') errors.push('Organism is required for this precaution type');

  if (!onset) errors.push('Onset date is required');
  else {
    const onsetErr = validateDate(onset, 'Onset date', { required: true });
    if (onsetErr) errors.push(onsetErr);
  }

  if (status === 'Resolved' || status === 'Discharged') {
    if (!resolution) errors.push('Resolution date is required for resolved/discharged cases');
    else {
      const rangeErr = validateDateRange(onset, resolution, 'Onset date', 'Resolution date');
      if (rangeErr) errors.push(rangeErr);
    }
  }

  return { valid: errors.length === 0, errors };
};

export const validateABTRecord = (
  abt: Partial<ABTRecord>,
  options: { allowEndDateOverride?: boolean } = {}
): ValidationResult => {
  const errors: string[] = [];
  const med = abt.medication || abt.med_name;
  const start = abt.startDate || abt.start_date || abt.orderDate;
  const end = abt.endDate || abt.end_date;
  const { allowEndDateOverride = false } = options;

  if (!abt.mrn) errors.push('MRN is required');
  if (!abt.residentName && !abt.name) errors.push('Resident name is required');
  if (!med) errors.push('Antibiotic name is required');
  if (!abt.indication) errors.push('Indication is required');

  if (!start) errors.push('Start date is required');
  else {
    const startErr = validateDate(start, 'Start date', { required: true, allowFuture: true });
    if (startErr) errors.push(startErr);
  }

  if ((abt.status === 'completed' || abt.status === 'discontinued') && !end) {
    errors.push('End date is required for completed/discontinued antibiotics');
  }

  if (start && end && !allowEndDateOverride) {
    const rangeErr = validateDateRange(start, end, 'Start date', 'End date');
    if (rangeErr) errors.push(rangeErr);
  }

  return { valid: errors.length === 0, errors };
};

export const validateVaxRecord = (vax: Partial<VaxRecord>): ValidationResult => {
  const errors: string[] = [];
  const dateGiven = vax.dateGiven || vax.date_given;

  if (!vax.mrn) errors.push('MRN is required');
  if (!vax.residentName && !vax.name) errors.push('Resident name is required');
  if (!vax.vaccine && !vax.vaccine_type) errors.push('Vaccine type is required');
  if (!vax.status) errors.push('Status is required');

  if (vax.status === 'given') {
    const err = validateDate(dateGiven, 'Date given', { required: true, allowFuture: false });
    if (err) errors.push(err);
  }

  return { valid: errors.length === 0, errors };
};

export const checkDuplicateMRN = (mrn: string, residents: Resident[]): boolean =>
  residents.some((r) => r.mrn === mrn);

export const checkDuplicateIPCase = (
  mrn: string,
  organism: string,
  existing: IPCase[],
  excludeId?: string
): IPCase | null => {
  const hit = existing.find((c) => {
    const cOrganism = c.infectionType || c.infection_type || c.suspectedOrConfirmedOrganism || '';
    return (
      c.mrn === mrn &&
      cOrganism.toLowerCase() === organism.toLowerCase() &&
      c.status !== 'Resolved' &&
      c.status !== 'Discharged' &&
      c.id !== excludeId
    );
  });
  return hit || null;
};

export const checkDuplicateABT = (
  mrn: string,
  antibiotic: string,
  existing: ABTRecord[],
  excludeId?: string
): ABTRecord | null => {
  const hit = existing.find((a) => {
    const med = a.medication || a.med_name || '';
    return a.mrn === mrn && med.toLowerCase() === antibiotic.toLowerCase() && a.status === 'active' && a.id !== excludeId;
  });
  return hit || null;
};

export const checkDuplicateVax = (
  mrn: string,
  vaccine: string,
  dateGiven: string,
  existing: VaxRecord[],
  excludeId?: string
): VaxRecord | null => {
  const base = new Date(dateGiven);
  const low = new Date(base);
  low.setDate(base.getDate() - 7);
  const high = new Date(base);
  high.setDate(base.getDate() + 7);

  const hit = existing.find((v) => {
    const vDate = v.dateGiven || v.date_given;
    return (
      v.mrn === mrn &&
      (v.vaccine || v.vaccine_type) === vaccine &&
      v.status === 'given' &&
      !!vDate &&
      new Date(vDate) >= low &&
      new Date(vDate) <= high &&
      v.id !== excludeId
    );
  });

  return hit || null;
};

export const combineValidationResults = (...results: ValidationResult[]): ValidationResult => {
  const errors = results.flatMap((r) => r.errors);
  return { valid: errors.length === 0, errors };
};

export const formatValidationErrors = (errors: string[]): string => {
  if (errors.length <= 1) return errors[0] || '';
  return errors.map((e, i) => `${i + 1}. ${e}`).join('\n');
};
