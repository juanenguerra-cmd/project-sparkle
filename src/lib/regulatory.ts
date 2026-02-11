export type RegulatoryFTag = 'F880' | 'F881' | 'F883' | 'F887';

export interface RegulatoryReference {
  ftag: RegulatoryFTag;
  title: string;
  citation: string;
  cmsTask: string;
  plainLanguage: string;
}

export const REGULATORY_REFERENCES: Record<RegulatoryFTag, RegulatoryReference> = {
  F880: {
    ftag: 'F880',
    title: 'Infection Prevention & Control Program',
    citation: '42 CFR §483.80; CMS Appendix PP',
    cmsTask: 'CMS-20054',
    plainLanguage: 'Facility-wide infection prevention and control program including EBP/precautions workflows.',
  },
  F881: {
    ftag: 'F881',
    title: 'Antibiotic Stewardship Program',
    citation: '42 CFR §483.80(a)(3); CMS Appendix PP',
    cmsTask: 'CMS-20054',
    plainLanguage: 'Antibiotic stewardship oversight including starts, review cadence, and utilization analysis.',
  },
  F883: {
    ftag: 'F883',
    title: 'Influenza and Pneumococcal Immunizations',
    citation: '42 CFR §483.80(d); CMS Appendix PP',
    cmsTask: 'CMS-20054',
    plainLanguage: 'Resident flu and pneumococcal offer, administration, declination, and education tracking.',
  },
  F887: {
    ftag: 'F887',
    title: 'COVID-19 Immunization',
    citation: 'CMS Appendix PP (updated F887 coverage summaries)',
    cmsTask: 'CMS-20054',
    plainLanguage: 'Resident-focused COVID immunization tracking, offers, education, and re-offer scheduling.',
  },
};

export const VACCINE_TYPES = ['COVID', 'Flu', 'Pneumo', 'RSV', 'HepB', 'Other'] as const;
export type VaccineType = typeof VACCINE_TYPES[number];

export const VACCINE_FTAG_MAP: Record<string, RegulatoryFTag> = {
  COVID: 'F887',
  Flu: 'F883',
  Pneumo: 'F883',
};

export const getVaccineFTag = (vaccine: string): RegulatoryFTag | undefined => {
  const normalized = vaccine.trim().toLowerCase();
  if (normalized.includes('covid')) return 'F887';
  if (normalized.includes('flu') || normalized.includes('influenza')) return 'F883';
  if (normalized.includes('pneumo') || normalized.includes('pneumococcal') || normalized.includes('pna')) return 'F883';
  return undefined;
};
