// Line Listing Template Configuration
// These templates define the fields available for each outbreak type

export interface LineListingFieldConfig {
  id: string;
  label: string;
  shortLabel?: string; // For PDF column headers
  type: 'text' | 'checkbox' | 'select' | 'date' | 'number';
  options?: string[]; // For select type
  category?: 'demographics' | 'vaccines' | 'predisposing' | 'symptoms' | 'outcomes' | 'other';
  defaultEnabled: boolean;
}

export interface LineListingTemplate {
  id: string;
  name: string;
  outbreakType: 'respiratory' | 'gi' | 'skin' | 'uti' | 'other';
  fields: LineListingFieldConfig[];
}

// Default ILI (Influenza-Like Illness) template mapped to the standard paper line list layout
export const ILI_TEMPLATE: LineListingTemplate = {
  id: 'ili',
  name: 'Influenza-Like Illness (ILI)',
  outbreakType: 'respiratory',
  fields: [
    // Demographics (paper template order)
    { id: 'age', label: 'Age', shortLabel: 'Age', type: 'number', category: 'demographics', defaultEnabled: true },
    { id: 'sex', label: 'Sex', shortLabel: 'Sex', type: 'select', options: ['M', 'F'], category: 'demographics', defaultEnabled: true },
    
    // Vaccinations
    { id: 'influenzaVaccine', label: 'Influenza Vaccine', shortLabel: 'Flu Vax', type: 'select', options: ['Y', 'N'], category: 'vaccines', defaultEnabled: true },
    { id: 'pneumoniaVaccine', label: 'Pneum. Vaccine', shortLabel: 'Pneum Vax', type: 'select', options: ['Y', 'N'], category: 'vaccines', defaultEnabled: true },
    
    // Predisposing Factors
    { id: 'cvd', label: 'CVD', shortLabel: 'CVD', type: 'checkbox', category: 'predisposing', defaultEnabled: true },
    { id: 'copd', label: 'COPD', shortLabel: 'COPD', type: 'checkbox', category: 'predisposing', defaultEnabled: true },
    { id: 'dm', label: 'Diabetes Mellitus', shortLabel: 'DM', type: 'checkbox', category: 'predisposing', defaultEnabled: true },
    { id: 'anemia', label: 'Anemia', shortLabel: 'Anemia', type: 'checkbox', category: 'predisposing', defaultEnabled: true },
    { id: 'renal', label: 'Renal Disease', shortLabel: 'Renal', type: 'checkbox', category: 'predisposing', defaultEnabled: true },
    { id: 'ca', label: 'Cancer', shortLabel: 'CA', type: 'checkbox', category: 'predisposing', defaultEnabled: true },
    { id: 'steroids', label: 'Steroids', shortLabel: 'Steroids', type: 'checkbox', category: 'predisposing', defaultEnabled: true },
    
    // Symptoms
    { id: 'highestTemp', label: 'Highest Temp (°F)', shortLabel: 'Temp°F', type: 'text', category: 'symptoms', defaultEnabled: true },
    { id: 'cough', label: 'Cough', shortLabel: 'Cough', type: 'checkbox', category: 'symptoms', defaultEnabled: true },
    { id: 'congestion', label: 'Congestion', shortLabel: 'Congest', type: 'checkbox', category: 'symptoms', defaultEnabled: true },
    { id: 'pharyngitis', label: 'Pharyngitis', shortLabel: 'Pharyng', type: 'checkbox', category: 'symptoms', defaultEnabled: true },
    { id: 'rhinitis', label: 'Rhinitis', shortLabel: 'Rhinitis', type: 'checkbox', category: 'symptoms', defaultEnabled: true },
    { id: 'headache', label: 'Headache', shortLabel: 'H/A', type: 'checkbox', category: 'symptoms', defaultEnabled: true },
    
    // Outcomes
    { id: 'feverDuration', label: 'Duration of Fever (days)', shortLabel: 'Fev Dur', type: 'text', category: 'outcomes', defaultEnabled: true },
    { id: 'hospDate', label: 'Hosp. Date', shortLabel: 'Hosp Dt', type: 'date', category: 'outcomes', defaultEnabled: true },
    { id: 'dateDied', label: 'Date Died', shortLabel: 'Died', type: 'date', category: 'outcomes', defaultEnabled: true },
    { id: 'labResults', label: 'Lab Results', shortLabel: 'Lab', type: 'text', category: 'outcomes', defaultEnabled: true },
    { id: 'antibiotic', label: 'Antibiotic', shortLabel: 'ABT', type: 'text', category: 'outcomes', defaultEnabled: true },
    { id: 'xray', label: 'X-Ray', shortLabel: 'X-Ray', type: 'text', category: 'outcomes', defaultEnabled: true },
    { id: 'pneumonia', label: 'Pneumonia', shortLabel: 'Pneum', type: 'checkbox', category: 'outcomes', defaultEnabled: true },
  ]
};

// GI Outbreak template - comprehensive fields
export const GI_TEMPLATE: LineListingTemplate = {
  id: 'gi',
  name: 'Gastrointestinal Illness',
  outbreakType: 'gi',
  fields: [
    // Demographics
    { id: 'age', label: 'Age', shortLabel: 'Age', type: 'number', category: 'demographics', defaultEnabled: true },
    { id: 'sex', label: 'Sex', shortLabel: 'Sex', type: 'select', options: ['M', 'F'], category: 'demographics', defaultEnabled: true },
    { id: 'unit', label: 'Unit/Floor', shortLabel: 'Unit', type: 'text', category: 'demographics', defaultEnabled: false },
    
    // Predisposing Factors
    { id: 'recentAbx', label: 'Recent Antibiotics', shortLabel: 'Abx', type: 'checkbox', category: 'predisposing', defaultEnabled: false },
    { id: 'ppi', label: 'PPI Use', shortLabel: 'PPI', type: 'checkbox', category: 'predisposing', defaultEnabled: false },
    { id: 'tubeFeeding', label: 'Tube Feeding', shortLabel: 'Tube', type: 'checkbox', category: 'predisposing', defaultEnabled: false },
    
    // Symptoms - detailed
    { id: 'nausea', label: 'Nausea', shortLabel: 'Nausea', type: 'checkbox', category: 'symptoms', defaultEnabled: true },
    { id: 'vomiting', label: 'Vomiting', shortLabel: 'Vomit', type: 'checkbox', category: 'symptoms', defaultEnabled: true },
    { id: 'vomitEpisodes', label: 'Vomit Episodes/24h', shortLabel: '# Vomit', type: 'number', category: 'symptoms', defaultEnabled: true },
    { id: 'vomitOnset', label: 'Vomit Onset Date', shortLabel: 'Vom Dt', type: 'date', category: 'symptoms', defaultEnabled: false },
    { id: 'diarrhea', label: 'Diarrhea', shortLabel: 'Diarr', type: 'checkbox', category: 'symptoms', defaultEnabled: true },
    { id: 'diarrheaEpisodes', label: 'Diarrhea Episodes/24h', shortLabel: '# BMs', type: 'number', category: 'symptoms', defaultEnabled: true },
    { id: 'diarrheaOnset', label: 'Diarrhea Onset Date', shortLabel: 'Diarr Dt', type: 'date', category: 'symptoms', defaultEnabled: false },
    { id: 'bloodyStool', label: 'Bloody Stool', shortLabel: 'Blood', type: 'checkbox', category: 'symptoms', defaultEnabled: true },
    { id: 'fever', label: 'Fever', shortLabel: 'Fever', type: 'checkbox', category: 'symptoms', defaultEnabled: true },
    { id: 'highestTemp', label: 'Highest Temp (°F)', shortLabel: 'Temp°F', type: 'text', category: 'symptoms', defaultEnabled: false },
    { id: 'abdominalPain', label: 'Abdominal Pain', shortLabel: 'Abd Pain', type: 'checkbox', category: 'symptoms', defaultEnabled: true },
    { id: 'bodyAches', label: 'Body Aches', shortLabel: 'Aches', type: 'checkbox', category: 'symptoms', defaultEnabled: true },
    { id: 'chills', label: 'Chills', shortLabel: 'Chills', type: 'checkbox', category: 'symptoms', defaultEnabled: false },
    { id: 'headache', label: 'Headache', shortLabel: 'H/A', type: 'checkbox', category: 'symptoms', defaultEnabled: false },
    
    // Outcomes/Treatment
    { id: 'ivFluids', label: 'IV Fluids', shortLabel: 'IV', type: 'checkbox', category: 'outcomes', defaultEnabled: true },
    { id: 'antiemetics', label: 'Antiemetics Given', shortLabel: 'Antiemt', type: 'checkbox', category: 'outcomes', defaultEnabled: false },
    { id: 'stoolSpecimen', label: 'Stool Specimen', shortLabel: 'Stool', type: 'select', options: ['Pending', 'Positive', 'Negative', 'Not Done'], category: 'outcomes', defaultEnabled: true },
    { id: 'stoolDate', label: 'Stool Collection Date', shortLabel: 'Stool Dt', type: 'date', category: 'outcomes', defaultEnabled: false },
    { id: 'labResults', label: 'Lab Results', shortLabel: 'Lab', type: 'text', category: 'outcomes', defaultEnabled: true },
    { id: 'pathogen', label: 'Pathogen Identified', shortLabel: 'Pathogen', type: 'text', category: 'outcomes', defaultEnabled: true },
    { id: 'hospDate', label: 'Hospitalization Date', shortLabel: 'Hosp Dt', type: 'date', category: 'outcomes', defaultEnabled: true },
    { id: 'dateDied', label: 'Date Died', shortLabel: 'Died', type: 'date', category: 'outcomes', defaultEnabled: true },
    { id: 'resolved', label: 'Resolved', shortLabel: 'Resolvd', type: 'checkbox', category: 'outcomes', defaultEnabled: false },
    { id: 'resolvedDate', label: 'Resolution Date', shortLabel: 'Res Dt', type: 'date', category: 'outcomes', defaultEnabled: false },
  ]
};

// Scabies/Skin Outbreak template
export const SKIN_TEMPLATE: LineListingTemplate = {
  id: 'skin',
  name: 'Skin/Scabies',
  outbreakType: 'skin',
  fields: [
    // Demographics
    { id: 'age', label: 'Age', shortLabel: 'Age', type: 'number', category: 'demographics', defaultEnabled: true },
    { id: 'sex', label: 'Sex', shortLabel: 'Sex', type: 'select', options: ['M', 'F'], category: 'demographics', defaultEnabled: true },
    
    // Symptoms
    { id: 'rash', label: 'Rash', shortLabel: 'Rash', type: 'checkbox', category: 'symptoms', defaultEnabled: true },
    { id: 'itching', label: 'Itching', shortLabel: 'Itch', type: 'checkbox', category: 'symptoms', defaultEnabled: true },
    { id: 'burrows', label: 'Burrows', shortLabel: 'Burrows', type: 'checkbox', category: 'symptoms', defaultEnabled: true },
    { id: 'location', label: 'Location', shortLabel: 'Location', type: 'text', category: 'symptoms', defaultEnabled: true },
    
    // Treatment
    { id: 'treatmentDate', label: 'Treatment Date', shortLabel: 'Tx Date', type: 'date', category: 'outcomes', defaultEnabled: true },
    { id: 'treatment', label: 'Treatment Given', shortLabel: 'Treatment', type: 'text', category: 'outcomes', defaultEnabled: true },
    { id: 'retreatment', label: 'Retreatment Date', shortLabel: 'Re-Tx', type: 'date', category: 'outcomes', defaultEnabled: true },
    { id: 'skinScraping', label: 'Skin Scraping', shortLabel: 'Scraping', type: 'select', options: ['Pending', 'Positive', 'Negative', 'Not Done'], category: 'outcomes', defaultEnabled: true },
  ]
};

// COVID-19 template
export const COVID_TEMPLATE: LineListingTemplate = {
  id: 'covid',
  name: 'COVID-19',
  outbreakType: 'respiratory',
  fields: [
    // Demographics
    { id: 'age', label: 'Age', shortLabel: 'Age', type: 'number', category: 'demographics', defaultEnabled: true },
    { id: 'sex', label: 'Sex', shortLabel: 'Sex', type: 'select', options: ['M', 'F'], category: 'demographics', defaultEnabled: true },
    
    // Vaccinations
    { id: 'covidVaccine', label: 'COVID Vaccine', shortLabel: 'COVID Vax', type: 'select', options: ['Up to date', 'Partial', 'None', 'Unk'], category: 'vaccines', defaultEnabled: true },
    { id: 'lastCovidVaxDate', label: 'Last COVID Vax Date', shortLabel: 'Vax Date', type: 'date', category: 'vaccines', defaultEnabled: true },
    
    // Symptoms
    { id: 'fever', label: 'Fever', shortLabel: 'Fever', type: 'checkbox', category: 'symptoms', defaultEnabled: true },
    { id: 'cough', label: 'Cough', shortLabel: 'Cough', type: 'checkbox', category: 'symptoms', defaultEnabled: true },
    { id: 'sob', label: 'Shortness of Breath', shortLabel: 'SOB', type: 'checkbox', category: 'symptoms', defaultEnabled: true },
    { id: 'fatigue', label: 'Fatigue', shortLabel: 'Fatigue', type: 'checkbox', category: 'symptoms', defaultEnabled: true },
    { id: 'lossOfTaste', label: 'Loss of Taste/Smell', shortLabel: 'Taste/Smell', type: 'checkbox', category: 'symptoms', defaultEnabled: true },
    { id: 'soreThroat', label: 'Sore Throat', shortLabel: 'Sore Thr', type: 'checkbox', category: 'symptoms', defaultEnabled: true },
    { id: 'o2Requirement', label: 'O2 Requirement', shortLabel: 'O2', type: 'checkbox', category: 'symptoms', defaultEnabled: true },
    
    // Testing/Outcomes
    { id: 'testType', label: 'Test Type', shortLabel: 'Test', type: 'select', options: ['PCR', 'Antigen', 'Both'], category: 'outcomes', defaultEnabled: true },
    { id: 'testDate', label: 'Test Date', shortLabel: 'Test Date', type: 'date', category: 'outcomes', defaultEnabled: true },
    { id: 'paxlovid', label: 'Paxlovid', shortLabel: 'Paxlovid', type: 'checkbox', category: 'outcomes', defaultEnabled: true },
    { id: 'hospDate', label: 'Hosp. Date', shortLabel: 'Hosp Date', type: 'date', category: 'outcomes', defaultEnabled: true },
    { id: 'dateDied', label: 'Date Died', shortLabel: 'Died', type: 'date', category: 'outcomes', defaultEnabled: true },
  ]
};

// Generic template for "Other" type outbreaks
export const GENERIC_TEMPLATE: LineListingTemplate = {
  id: 'generic',
  name: 'Generic Line Listing',
  outbreakType: 'other',
  fields: [
    { id: 'age', label: 'Age', shortLabel: 'Age', type: 'number', category: 'demographics', defaultEnabled: true },
    { id: 'sex', label: 'Sex', shortLabel: 'Sex', type: 'select', options: ['M', 'F'], category: 'demographics', defaultEnabled: true },
    { id: 'symptomDescription', label: 'Symptom Description', shortLabel: 'Symptoms', type: 'text', category: 'symptoms', defaultEnabled: true },
    { id: 'labResults', label: 'Lab Results', shortLabel: 'Lab', type: 'text', category: 'outcomes', defaultEnabled: true },
    { id: 'treatment', label: 'Treatment', shortLabel: 'Treatment', type: 'text', category: 'outcomes', defaultEnabled: true },
    { id: 'hospDate', label: 'Hosp. Date', shortLabel: 'Hosp Date', type: 'date', category: 'outcomes', defaultEnabled: true },
  ]
};

// Map outbreak names to templates
export const getTemplateForOutbreak = (outbreakName: string, outbreakType: string): LineListingTemplate => {
  const nameLower = outbreakName.toLowerCase();
  
  if (nameLower.includes('covid')) {
    return COVID_TEMPLATE;
  }
  if (nameLower.includes('influenza') || nameLower.includes('ili') || nameLower.includes('flu')) {
    return ILI_TEMPLATE;
  }
  if (nameLower.includes('noro') || nameLower.includes('gi') || nameLower.includes('gastro')) {
    return GI_TEMPLATE;
  }
  if (nameLower.includes('scabies') || nameLower.includes('skin') || nameLower.includes('mrsa')) {
    return SKIN_TEMPLATE;
  }
  
  // Fall back to type
  switch (outbreakType) {
    case 'respiratory':
      return ILI_TEMPLATE;
    case 'gi':
      return GI_TEMPLATE;
    case 'skin':
      return SKIN_TEMPLATE;
    default:
      return GENERIC_TEMPLATE;
  }
};

// All templates for settings customization
export const ALL_TEMPLATES: LineListingTemplate[] = [
  ILI_TEMPLATE,
  GI_TEMPLATE,
  SKIN_TEMPLATE,
  COVID_TEMPLATE,
  GENERIC_TEMPLATE,
];

// Type for storing custom field configurations in settings
export interface CustomLineListingConfig {
  templateId: string;
  enabledFields: string[]; // List of field IDs that are enabled
  customFields?: LineListingFieldConfig[]; // User-added custom fields
}
