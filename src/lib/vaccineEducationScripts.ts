/**
 * Vaccine Education Scripts for Re-offer Documentation
 * 
 * Short, compliant education talking points for resident/family discussions.
 * Based on CDC recommendations and CMS F883/F887 requirements.
 */

export interface VaccineEducationScript {
  vaccineType: string;
  shortTitle: string;
  keyPoints: string[];
  benefitsStatement: string;
  riskStatement: string;
  fullScript: string;
}

export const VACCINE_EDUCATION_SCRIPTS: Record<string, VaccineEducationScript> = {
  INFLUENZA: {
    vaccineType: 'Influenza (Flu)',
    shortTitle: 'Flu Vaccine Education',
    keyPoints: [
      'Protects against seasonal influenza viruses',
      'Recommended annually for all adults, especially those 65+',
      'Reduces risk of flu-related hospitalization by 40-60%',
      'Can prevent serious complications like pneumonia'
    ],
    benefitsStatement: 'The flu vaccine significantly reduces your risk of getting sick, being hospitalized, or experiencing serious complications from influenza.',
    riskStatement: 'Common side effects are mild and include soreness at injection site, low-grade fever, or fatigue lasting 1-2 days.',
    fullScript: `The influenza vaccine is recommended annually for all residents, especially those 65 and older. It significantly reduces your risk of getting sick with the flu, being hospitalized, or experiencing serious complications like pneumonia. The vaccine is safe - common side effects are mild and include soreness at the injection site or low-grade fever lasting 1-2 days. Would you like to receive the flu vaccine today?`
  },
  
  COVID: {
    vaccineType: 'COVID-19',
    shortTitle: 'COVID-19 Vaccine Education',
    keyPoints: [
      'Updated vaccines target current circulating variants',
      'Recommended for all adults, especially immunocompromised',
      'Reduces severe illness, hospitalization, and death',
      'Can be given with flu vaccine'
    ],
    benefitsStatement: 'The updated COVID-19 vaccine provides protection against current variants and significantly reduces your risk of severe illness, hospitalization, and death.',
    riskStatement: 'Common side effects include soreness, fatigue, headache, or mild fever for 1-3 days. These are signs your immune system is responding.',
    fullScript: `The updated COVID-19 vaccine is recommended to protect against current circulating variants. It significantly reduces your risk of severe illness, hospitalization, and death from COVID-19. You can receive it at the same time as your flu vaccine. Common side effects like soreness or mild fatigue last only 1-3 days. Would you like to receive the COVID-19 vaccine?`
  },
  
  PNEUMOCOCCAL: {
    vaccineType: 'Pneumococcal (Pneumonia)',
    shortTitle: 'Pneumonia Vaccine Education',
    keyPoints: [
      'Protects against pneumococcal disease (pneumonia, meningitis)',
      'One-time or series vaccination for adults 65+',
      'Reduces risk of invasive pneumococcal disease',
      'Different from yearly flu vaccine'
    ],
    benefitsStatement: 'The pneumococcal vaccine protects against serious infections including pneumonia and meningitis caused by pneumococcal bacteria.',
    riskStatement: 'Side effects are typically mild - soreness at injection site, low-grade fever, or fatigue.',
    fullScript: `The pneumococcal vaccine protects you against serious infections including bacterial pneumonia and meningitis. For adults 65 and older, this is typically a one-time vaccination. It's different from the yearly flu shot. Side effects are mild and temporary. Would you like to receive the pneumonia vaccine?`
  },
  
  RSV: {
    vaccineType: 'RSV (Respiratory Syncytial Virus)',
    shortTitle: 'RSV Vaccine Education',
    keyPoints: [
      'Protects against RSV, a common respiratory virus',
      'Recommended for adults 60+ during RSV season',
      'Reduces risk of RSV-related lower respiratory disease',
      'One-time vaccination'
    ],
    benefitsStatement: 'The RSV vaccine reduces your risk of developing serious lower respiratory tract disease from RSV, which can be especially dangerous for older adults.',
    riskStatement: 'Common side effects include fatigue, headache, and muscle pain lasting 1-2 days.',
    fullScript: `RSV is a common respiratory virus that can cause serious illness in older adults. The RSV vaccine is recommended for adults 60 and older and significantly reduces your risk of severe RSV infection. Side effects are mild and temporary. Would you like to receive the RSV vaccine?`
  },
  
  TDAP: {
    vaccineType: 'Tdap (Tetanus, Diphtheria, Pertussis)',
    shortTitle: 'Tdap/Td Vaccine Education',
    keyPoints: [
      'Protects against tetanus, diphtheria, and whooping cough',
      'Booster recommended every 10 years',
      'Important for wound care and preventing infection spread',
      'One-time Tdap, then Td boosters'
    ],
    benefitsStatement: 'The Tdap vaccine protects you against tetanus (lockjaw), diphtheria, and pertussis (whooping cough).',
    riskStatement: 'Side effects are usually mild - soreness, redness, or swelling at injection site.',
    fullScript: `The Tdap vaccine protects against three serious diseases: tetanus (lockjaw), diphtheria, and pertussis (whooping cough). A booster is recommended every 10 years. Side effects are mild and temporary. Would you like to receive your Tdap booster?`
  },
  
  SHINGLES: {
    vaccineType: 'Shingrix (Shingles)',
    shortTitle: 'Shingles Vaccine Education',
    keyPoints: [
      'Prevents shingles (herpes zoster) reactivation',
      'Two-dose series for adults 50+',
      'Over 90% effective at preventing shingles',
      'Reduces risk of painful nerve complications'
    ],
    benefitsStatement: 'Shingrix is over 90% effective at preventing shingles and the painful nerve complications that can follow, like postherpetic neuralgia.',
    riskStatement: 'Side effects may include soreness, muscle pain, fatigue, headache, or fever for 2-3 days. This is a two-dose series.',
    fullScript: `The Shingrix vaccine is highly effective at preventing shingles, a painful rash caused by reactivation of the chickenpox virus. It's a two-dose series and is over 90% effective. While side effects like muscle pain or fatigue may occur for a few days, they're temporary. Would you like to start or complete your shingles vaccine series?`
  },
  
  OTHER: {
    vaccineType: 'General Vaccination',
    shortTitle: 'Vaccine Education',
    keyPoints: [
      'Vaccines are safe and effective',
      'Protect you and others around you',
      'Side effects are typically mild and temporary',
      'Ask questions if you have concerns'
    ],
    benefitsStatement: 'Vaccines are one of the most effective ways to prevent serious illness and protect your health.',
    riskStatement: 'Most vaccines have mild, temporary side effects that resolve within 1-2 days.',
    fullScript: `This vaccine is recommended to help protect your health. Vaccines are safe and effective, and any side effects are typically mild and temporary. Do you have any questions about this vaccine? Would you like to receive it today?`
  }
};

/**
 * Get education script for a vaccine type
 */
export const getEducationScript = (vaccineType: string): VaccineEducationScript => {
  const normalized = (vaccineType || '').toUpperCase();
  
  if (normalized.includes('FLU') || normalized.includes('INFLUENZA')) {
    return VACCINE_EDUCATION_SCRIPTS.INFLUENZA;
  }
  if (normalized.includes('COVID')) {
    return VACCINE_EDUCATION_SCRIPTS.COVID;
  }
  if (normalized.includes('PNA') || normalized.includes('PNEUMO') || 
      normalized.includes('PPSV') || normalized.includes('PCV')) {
    return VACCINE_EDUCATION_SCRIPTS.PNEUMOCOCCAL;
  }
  if (normalized.includes('RSV')) {
    return VACCINE_EDUCATION_SCRIPTS.RSV;
  }
  if (normalized.includes('TD') || normalized.includes('TETANUS')) {
    return VACCINE_EDUCATION_SCRIPTS.TDAP;
  }
  if (normalized.includes('ZOSTER') || normalized.includes('SHINGLES') || normalized.includes('SHINGRIX')) {
    return VACCINE_EDUCATION_SCRIPTS.SHINGLES;
  }
  
  return VACCINE_EDUCATION_SCRIPTS.OTHER;
};

/**
 * Generate note text for education provided
 */
export const generateEducationNote = (
  vaccineType: string,
  residentName: string,
  educationDate: string,
  outcome: 'accepted' | 'declined' | 'deferred' = 'declined'
): string => {
  const script = getEducationScript(vaccineType);
  const outcomeText = {
    accepted: 'Resident accepted vaccination after education.',
    declined: 'Resident declined vaccination after education provided.',
    deferred: 'Resident deferred decision; will follow up.'
  }[outcome];
  
  return `**${script.shortTitle} Provided**

Date: ${educationDate}
Resident: ${residentName}

**Key Points Discussed:**
${script.keyPoints.map(p => `• ${p}`).join('\n')}

**Benefits:** ${script.benefitsStatement}

**Risks Discussed:** ${script.riskStatement}

**Outcome:** ${outcomeText}

---
Education documented per F883/F887 requirements.`;
};
