import { ABTRecord } from './types';

interface MedicationClassRule {
  className: string;
  pattern: RegExp;
}

const MEDICATION_CLASS_RULES: MedicationClassRule[] = [
  {
    className: 'Penicillins / Beta-lactams',
    pattern: /\b(amoxicillin|amoxil|augmentin|ampicillin|penicillin|pen\s?-?vk|nafcillin|oxacillin|dicloxacillin|piperacillin|tazobactam|zosyn)\b/i,
  },
  {
    className: 'Cephalosporins / Beta-lactams',
    pattern: /\b(ceftriaxone|rocephin|cephalexin|keflex|cefazolin|ancef|kefzol|cefdinir|omnicef|cefuroxime|ceftin|cefixime|suprax|cefaclor|ceclor|cefotaxime|claforan|cefoxitin|mefoxin|ceftazidime|fortaz|tazicef|cefepime|maxipime|ceftaroline|teflaro|ceftolozane|cefpodoxime|vantin)\b/i,
  },
  {
    className: 'Carbapenems',
    pattern: /\b(meropenem|merrem|imipenem|primaxin|ertapenem|invanz|vabomere)\b/i,
  },
  {
    className: 'Monobactams',
    pattern: /\b(aztreonam|azactam)\b/i,
  },
  {
    className: 'Fluoroquinolones',
    pattern: /\b(ciprofloxacin|cipro|levofloxacin|levaquin|moxifloxacin|avelox|norfloxacin|noroxin|ofloxacin|floxin|delafloxacin|baxdela|gatifloxacin|gemifloxacin|factive)\b/i,
  },
  {
    className: 'Macrolides',
    pattern: /\b(azithromycin|zithromax|z-?pack|erythromycin|ery-?tab|clarithromycin|biaxin)\b/i,
  },
  {
    className: 'Tetracyclines',
    pattern: /\b(doxycycline|doxy|minocycline|minocin|tetracycline|sumycin|tigecycline|tygacil|eravacycline|xerava|omadacycline|nuzyra)\b/i,
  },
  {
    className: 'Sulfonamides / Folate antagonists',
    pattern: /\b(sulfamethoxazole|bactrim|septra|trimethoprim|sulfadiazine|dapsone|pyrimethamine|daraprim)\b/i,
  },
  {
    className: 'Nitrofurans / Urinary antibiotics',
    pattern: /\b(nitrofurantoin|macrobid|macrodantin|fosfomycin|monurol|methenamine|hiprex|urex)\b/i,
  },
  {
    className: 'Glycopeptides / Lipoglycopeptides',
    pattern: /\b(vancomycin|vancocin|telavancin|vibativ|oritavancin|orbactiv|dalbavancin|dalvance)\b/i,
  },
  {
    className: 'Oxazolidinones',
    pattern: /\b(linezolid|zyvox)\b/i,
  },
  {
    className: 'Lipopeptides',
    pattern: /\b(daptomycin|cubicin)\b/i,
  },
  {
    className: 'Aminoglycosides',
    pattern: /\b(gentamicin|garamycin|tobramycin|tobrex|amikacin|amikin|streptomycin|kanamycin|plazomicin|zemdri|neomycin)\b/i,
  },
  {
    className: 'Nitroimidazoles',
    pattern: /\b(metronidazole|flagyl|tinidazole|tindamax|secnidazole|solosec)\b/i,
  },
  {
    className: 'Lincosamides',
    pattern: /\b(clindamycin|cleocin)\b/i,
  },
  {
    className: 'Rifamycins',
    pattern: /\b(rifampin|rifadin|rifabutin)\b/i,
  },
  {
    className: 'Anti-TB agents',
    pattern: /\b(isoniazid|\binh\b|pyrazinamide|ethambutol|myambutol)\b/i,
  },
  {
    className: 'Antifungals',
    pattern: /\b(fluconazole|diflucan|nystatin|mycostatin|caspofungin|cancidas|micafungin|mycamine|anidulafungin|eraxis|amphotericin|ambisome|voriconazole|vfend|posaconazole|noxafil|itraconazole|sporanox|terbinafine|lamisil|ketoconazole|nizoral)\b/i,
  },
  {
    className: 'Antivirals',
    pattern: /\b(acyclovir|valacyclovir|valtrex|famciclovir|famvir|oseltamivir|tamiflu)\b/i,
  },
  {
    className: 'Topical antibacterials',
    pattern: /\b(mupirocin|bactroban|bacitracin|neosporin|silver sulfadiazine|silvadene)\b/i,
  },
  {
    className: 'Other anti-infectives',
    pattern: /\b(fidaxomicin|dificid|colistin|polymyxin|pentamidine|atovaquone|mepron|primaquine|lefamulin|xenleta)\b/i,
  },
];

const INDICATION_HINTS: MedicationClassRule[] = [
  {
    className: 'Urinary antibiotics',
    pattern: /\b(uti|urinary|cystitis|pyelonephritis)\b/i,
  },
  {
    className: 'Respiratory anti-infectives',
    pattern: /\b(pneumonia|respiratory|bronchitis|copd|sinusitis)\b/i,
  },
  {
    className: 'Skin/soft tissue anti-infectives',
    pattern: /\b(cellulitis|wound|skin|ssti|abscess)\b/i,
  },
  {
    className: 'GI/anaerobic anti-infectives',
    pattern: /\b(c\.?\s?diff|colitis|abdominal|intra-?abdominal|anaerobic)\b/i,
  },
];

export const inferMedicationClass = (medicationName: string, indication?: string): string => {
  const value = medicationName.trim();
  if (value) {
    const match = MEDICATION_CLASS_RULES.find((rule) => rule.pattern.test(value));
    if (match) return match.className;

    // Fallback for common class suffixes when exact brand/generic mapping is unavailable.
    if (/\bcillin\b|\bpenem\b|\bcef\w*/i.test(value)) return 'Beta-lactam antibiotics';
    if (/floxacin\b/i.test(value)) return 'Fluoroquinolones';
    if (/\bcycline\b/i.test(value)) return 'Tetracyclines';
    if (/\bmycin\b/i.test(value)) return 'Other mycin-class anti-infectives';
  }

  if (indication) {
    const hint = INDICATION_HINTS.find((rule) => rule.pattern.test(indication));
    if (hint) return hint.className;
  }

  return 'Unclassified';
};

export const inferMedicationClassFromRecord = (record: Pick<ABTRecord, 'medication' | 'med_name' | 'indication'>): string => {
  const medicationName = record.medication || record.med_name || '';
  return inferMedicationClass(medicationName, record.indication || '');
};
