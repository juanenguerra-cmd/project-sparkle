// Census & ABT Parsing Utilities
// Matches the original ICN Hub parsing logic

export const canonicalMRN = (raw: string): string => {
  const rawValue = String(raw || "");
  const parenMatch = rawValue.match(/\(([^)]+)\)/);
  const candidate = parenMatch ? parenMatch[1] : rawValue;
  return candidate
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase()
    .slice(0, 20);
};

export const mrnMatchKeys = (raw: string): string[] => {
  const canonical = canonicalMRN(raw);
  if (!canonical) return [];
  const digitsOnly = canonical.replace(/[^0-9]/g, "");
  const keys = new Set([canonical]);
  if (digitsOnly && digitsOnly !== canonical) {
    keys.add(digitsOnly);
  }
  return Array.from(keys);
};

export const pad2 = (n: number): string => String(n).padStart(2, '0');

export const nowISO = (): string => new Date().toISOString();

export const toLocalISODate = (d: Date): string =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

export const todayISO = (): string => toLocalISODate(new Date());

export const isoDateFromAny = (s: string | null | undefined): string => {
  if (!s) return "";
  let str = String(s).trim();
  if (!str) return "";
  
  // Clean up common noise
  str = str.replace(/^[:\s]+|[:\s]+$/g, '').trim();
  
  // Already ISO yyyy-mm-dd
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  
  // ISO with time: yyyy-mm-ddThh:mm:ss
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})T/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }
  
  // yyyymmdd (no separators)
  if (/^\d{8}$/.test(str)) {
    const yy = parseInt(str.slice(0, 4), 10);
    const mm = parseInt(str.slice(4, 6), 10);
    const dd = parseInt(str.slice(6, 8), 10);
    if (yy >= 1900 && yy <= 2100 && mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) {
      return `${yy}-${pad2(mm)}-${pad2(dd)}`;
    }
  }
  
  // mmddyyyy or mmddyy (no separators)
  if (/^\d{6,8}$/.test(str)) {
    const mm = parseInt(str.slice(0, 2), 10);
    const dd = parseInt(str.slice(2, 4), 10);
    let yy = parseInt(str.slice(4), 10);
    if (yy < 100) yy += 2000;
    if (yy >= 1900 && yy <= 2100 && mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) {
      return `${yy}-${pad2(mm)}-${pad2(dd)}`;
    }
  }
  
  // yyyy/m/d or yyyy-m-d or yyyy.m.d
  let m = str.match(/\b(\d{4})[\/\-.\s](\d{1,2})[\/\-.\s](\d{1,2})\b/);
  if (m) {
    const yy = parseInt(m[1], 10), mm = parseInt(m[2], 10), dd = parseInt(m[3], 10);
    if (yy >= 1900 && yy <= 2100 && mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) {
      return `${yy}-${pad2(mm)}-${pad2(dd)}`;
    }
  }
  
  // m/d/yy(yy) or m-d-yy(yy) or m.d.yy or m d yy (space separated)
  m = str.match(/\b(\d{1,2})[\/\-.\s](\d{1,2})[\/\-.\s](\d{2,4})\b/);
  if (m) {
    let mm = parseInt(m[1], 10), dd = parseInt(m[2], 10), yy = parseInt(m[3], 10);
    if (yy < 100) yy += 2000;
    if (yy >= 1900 && yy <= 2100 && mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) {
      return `${yy}-${pad2(mm)}-${pad2(dd)}`;
    }
  }
  
  // Handle "Jan 2, 2025" or "January 2 2025" or "2 Jan 2025" etc.
  const monthNames: Record<string, number> = {
    jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3,
    apr: 4, april: 4, may: 5, jun: 6, june: 6,
    jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9,
    oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12
  };
  
  // Month name first: "Jan 2, 2025" or "January 2 2025"
  m = str.match(/\b([a-z]+)[,.\s]+(\d{1,2})[,.\s]+(\d{2,4})\b/i);
  if (m) {
    const monthStr = m[1].toLowerCase();
    const mm = monthNames[monthStr];
    const dd = parseInt(m[2], 10);
    let yy = parseInt(m[3], 10);
    if (yy < 100) yy += 2000;
    if (mm && yy >= 1900 && yy <= 2100 && dd >= 1 && dd <= 31) {
      return `${yy}-${pad2(mm)}-${pad2(dd)}`;
    }
  }
  
  // Day first: "2 Jan 2025" or "02-Jan-2025"
  m = str.match(/\b(\d{1,2})[\/\-.\s]+([a-z]+)[\/\-.\s]+(\d{2,4})\b/i);
  if (m) {
    const dd = parseInt(m[1], 10);
    const monthStr = m[2].toLowerCase();
    const mm = monthNames[monthStr];
    let yy = parseInt(m[3], 10);
    if (yy < 100) yy += 2000;
    if (mm && yy >= 1900 && yy <= 2100 && dd >= 1 && dd <= 31) {
      return `${yy}-${pad2(mm)}-${pad2(dd)}`;
    }
  }
  
  // Fall back to Date parsing for other formats
  const d = new Date(str);
  if (isFinite(d.getTime())) {
    const yy = d.getFullYear();
    const mm = d.getMonth() + 1;
    const dd = d.getDate();
    if (yy >= 1900 && yy <= 2100) {
      return `${yy}-${pad2(mm)}-${pad2(dd)}`;
    }
  }
  
  return "";
};

// Valid units are only Unit 2, Unit 3, and Unit 4
const VALID_UNITS = new Set(['2', '3', '4']);

export const deriveUnitFromRoom = (room: string): string => {
  const s = String(room || "").trim();
  if (!s) return "";
  const m = s.match(/^([234])/);
  if (m && VALID_UNITS.has(m[1])) return `Unit ${m[1]}`;
  return "";
};

export const isValidUnit = (unit: string): boolean => {
  const normalized = String(unit || "").trim().toLowerCase();
  return /^unit\s*[234]$/i.test(normalized) || VALID_UNITS.has(normalized);
};

// Smart name parsing: handles "LASTNAME, FIRSTNAME MIDDLENAME" format
// Also handles 2 first names like "Mary Jane Smith" -> "Smith, Mary Jane"
export const parseResidentName = (rawName: string): string => {
  const name = String(rawName || "").trim();
  if (!name) return "";
  
  // Already in "LASTNAME, FIRSTNAME..." format
  if (name.includes(",")) {
    // Clean up: "SMITH, MARY JANE -" -> "SMITH, MARY JANE"
    return name.replace(/[-–—]\s*$/, "").trim();
  }
  
  // Space-separated: try to detect surname (usually last token or first token if all caps pattern)
  const tokens = name.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return "";
  if (tokens.length === 1) return tokens[0];
  
  // If last token looks like surname (could be "FIRSTNAME MIDDLENAME LASTNAME")
  // Return as "LASTNAME, FIRSTNAME MIDDLENAME"
  const lastName = tokens[tokens.length - 1];
  const firstNames = tokens.slice(0, -1).join(" ");
  return `${lastName}, ${firstNames}`;
};

export const normalizeRoute = (raw: string): string => {
  const s = (raw || "").toLowerCase();
  if (!s) return "";
  if (/top/i.test(s)) return "TOP";
  if (/mouth|po\b|oral/i.test(s)) return "PO";
  if (/iv|intraven/i.test(s)) return "IV";
  if (/g-?tube|enteral|ng\b/i.test(s)) return "ENT";
  if (/eye|oph/i.test(s)) return "OPH";
  if (/\bim\b|intramus/i.test(s)) return "IM";
  if (/\bsc\b|subcut/i.test(s)) return "SC";
  return raw.toUpperCase().slice(0, 8);
};

export const detectInfectionSource = (indication: string): string => {
  const s = (indication || "").toLowerCase();
  const has = (re: RegExp) => re.test(s);
  if (has(/uti|urine|urinary|cystitis|pyelo/)) return "Urinary";
  if (has(/pneum|resp|lung|bronch|copd|trach|aspirat|sinus/)) return "Respiratory";
  if (has(/gi|gastro|cdiff|c\.?\s*difficile|diarr|colitis|abd|bowel/)) return "GI";
  if (has(/cellulit|wound|skin|ssti|abscess|ulcer|decub|pressure/)) return "Skin/Soft Tissue";
  if (has(/blood|bacterem|sepsis|bsi/)) return "Bloodstream";
  return "Other";
};

export const computeTxDays = (startISO: string, endISO: string): number | null => {
  const s = isoDateFromAny(startISO);
  const e = isoDateFromAny(endISO) || todayISO();
  if (!s) return null;
  
  const startMs = new Date(s + "T00:00:00").getTime();
  const endMs = new Date(e + "T00:00:00").getTime();
  
  if (!isFinite(startMs) || !isFinite(endMs)) return null;
  return Math.max(1, Math.ceil((endMs - startMs) / (24 * 60 * 60 * 1000)) + 1);
};

// Non-resident name tokens to exclude
const NON_RESIDENT_NAMES = new Set([
  "MEDICAREONLY", "CONTINUED", "DISCHARGED", "HOSPITAL", 
  "BEDCERTIFICATION", "CERTIFICATION", "ALL", "UNIT", "MEDICARE"
]);

export interface ParsedCensusRow {
  mrn: string;
  name: string;
  unit: string;
  room: string;
  dob_raw: string;
  status: string;
  payor: string;
}

export const parseCensusRaw = (raw: string): ParsedCensusRow[] => {
  const lines = String(raw || "").split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const out: ParsedCensusRow[] = [];
  const mrnRe = /\(([^)]+)\)/;
  const dobRe = /(\b\d{1,2}\/\d{1,2}\/\d{2,4}\b)/;

  for (const ln of lines) {
    if (/EMPTY/i.test(ln)) continue;
    const mrnM = ln.match(mrnRe);
    if (!mrnM) continue;
    const mrn = canonicalMRN(mrnM[1]);
    if (!mrn) continue;

    const beforeMrn = ln.slice(0, mrnM.index).trim();
    const softTokens = beforeMrn.split(/\s+/);

    let unit = "", room = "", namePart = beforeMrn;
    
    if (softTokens.length >= 2) {
      // Some exports begin with ROOM then NAME (no explicit unit column)
      // Example: "361-A KLETTNER, FRANCES (MRN) ..."
      const tok0 = softTokens[0] || "";
      const tok1 = softTokens[1] || "";
      // Room pattern: digits optionally followed by letter suffix (e.g., 301, 301-A, 301A, 2A)
      const looksRoom = /^\d{1,4}(?:-?[A-Za-z])?$/.test(tok0);
      const looksLastComma = /,$/.test(tok1) || tok1.includes(",");
      
      if (looksRoom && looksLastComma) {
        // Format: "301-A SMITH, JOHN" - room followed by name with comma
        room = tok0;
        unit = deriveUnitFromRoom(room);
        namePart = softTokens.slice(1).join(" ");
      } else if (looksRoom && !looksLastComma && softTokens.length === 2) {
        // Format: "301 SMITHJOHN" - room followed by concatenated name (edge case)
        // First token is room, rest is name
        room = tok0;
        unit = deriveUnitFromRoom(room);
        namePart = softTokens.slice(1).join(" ");
      } else if (looksRoom && softTokens.length >= 3) {
        // Format: "301 SMITH JOHN" - room followed by space-separated name parts
        room = tok0;
        unit = deriveUnitFromRoom(room);
        namePart = softTokens.slice(1).join(" ");
      } else if (softTokens.length >= 3) {
        // Check if first token looks like a unit identifier
        const firstToken = softTokens[0].toLowerCase();
        const isUnitToken = /^unit$/i.test(firstToken) || /^[234]$/i.test(firstToken);
        
        if (isUnitToken) {
          // Handle "Unit 2 301 SMITH, JOHN" or "2 301 SMITH, JOHN"
          if (/^unit$/i.test(firstToken) && softTokens.length >= 4) {
            unit = `Unit ${softTokens[1]}`;
            room = softTokens[2];
            namePart = softTokens.slice(3).join(" ");
          } else if (/^[234]$/.test(softTokens[0])) {
            // Just the number "2 301 SMITH, JOHN"
            unit = `Unit ${softTokens[0]}`;
            room = softTokens[1];
            namePart = softTokens.slice(2).join(" ");
          } else {
            unit = `Unit ${softTokens[0]}`;
            room = softTokens[1];
            namePart = softTokens.slice(2).join(" ");
          }
        } else {
          // Check if first token is a room number (common format: "301 SMITH, JOHN")
          const firstLooksRoom = /^\d{1,4}(?:-?[A-Za-z])?$/.test(softTokens[0]);
          if (firstLooksRoom) {
            room = softTokens[0];
            unit = deriveUnitFromRoom(room);
            namePart = softTokens.slice(1).join(" ");
          } else {
            // Default legacy: UNIT ROOM NAME... (rare)
            unit = softTokens[0];
            room = softTokens[1];
            namePart = softTokens.slice(2).join(" ");
          }
        }
      }
    }
    
    // Use smart name parsing to handle multi-part names
    const name = parseResidentName(namePart);

    // Validate unit - only accept Unit 2, 3, 4
    if (unit && !isValidUnit(unit)) {
      // Try to derive from room number if unit is invalid
      const derivedUnit = deriveUnitFromRoom(room);
      unit = derivedUnit || ""; // Clear invalid unit
    }

    const after = ln.slice((mrnM.index || 0) + mrnM[0].length).trim();
    const dobM = after.match(dobRe);
    const dob_raw = dobM ? dobM[1] : "";
    
    // Exclude known non-resident rows when they have NO room and NO DOB
    const nameU = name.replace(/[\s,]/g, "").toUpperCase();
    if (NON_RESIDENT_NAMES.has(nameU) && !room.trim() && !dob_raw.trim()) {
      continue;
    }

    // Skip rows without a valid unit (only Unit 2, 3, 4 allowed)
    if (unit && !isValidUnit(unit)) {
      continue;
    }

    const rest = after.replace(dob_raw, "").trim();
    const restTokens = rest.split(/\s{2,}|\s+/).filter(Boolean);
    const status = restTokens.slice(0, 2).join(" ").trim();
    const payor = restTokens.slice(2).join(" ").trim();

    out.push({ mrn, name, unit, room, dob_raw, status, payor });
  }
  
  // Dedupe by MRN
  const by = new Map<string, ParsedCensusRow>();
  out.forEach(r => by.set(r.mrn, r));
  return Array.from(by.values());
};

export interface ParsedABTRow {
  record_id: string;
  mrn: string;
  name: string;
  unit: string;
  room: string;
  med_name: string;
  dose: string;
  route: string;
  route_raw: string;
  indication: string;
  infection_source: string;
  start_date: string;
  end_date: string;
  tx_days: number | null;
  updated_at: string;
  source: string;
  _include: boolean;
}

export const makeAbxRecordId = (r: Partial<ParsedABTRow>): string => {
  const parts = [
    canonicalMRN(r.mrn || ""),
    (r.med_name || "").toUpperCase().replace(/\s+/g, " ").trim(),
    r.start_date || "",
    r.end_date || "",
    (r.route || "").toUpperCase(),
    (r.indication || "").toUpperCase().replace(/\s+/g, " ").trim()
  ];
  return "abx_" + parts.join("|").replace(/[^A-Za-z0-9|_-]/g, "").slice(0, 220);
};

export const parseABTMedlistRaw = (raw: string): ParsedABTRow[] => {
  const lines = String(raw || "").split(/\r?\n/);
  const rows: ParsedABTRow[] = [];
  let current: { mrn: string; name: string } | null = null;
  
  // Multiple MRN patterns to support different formats
  const mrnPatterns = [
    /\(([^)]+)\)/,                           // (MRN) in parentheses
    /\bMRN[:\s#]*(\d+)/i,                    // MRN: 12345 or MRN#12345
    /\b(\d{6,10})\b/                         // standalone 6-10 digit number (likely MRN)
  ];

  // Medication name patterns - generic/brand names typically contain these
  const medNamePattern = /\b(tablet|tab|capsule|cap|solution|susp|suspension|injection|inj|cream|oint|ointment|powder|liquid|drops|spray|syrup|elixir|gel|lotion|patch|suppository|aerosol|inhaler|nebulizer)\b/i;
  
  // Comprehensive antibiotic/antimicrobial name patterns
  const antibioticPattern = /\b(amoxicillin|augmentin|amox|azithromycin|zithromax|z-?pack|ciprofloxacin|cipro|levofloxacin|levaquin|metronidazole|flagyl|doxycycline|doxy|cephalexin|keflex|sulfamethoxazole|bactrim|septra|clindamycin|cleocin|nitrofurantoin|macrobid|macrodantin|penicillin|pen-?vk|ampicillin|amoxil|vancomycin|vancocin|ceftriaxone|rocephin|hydroxychloroquine|plaquenil|moxifloxacin|avelox|cefdinir|omnicef|cefuroxime|ceftin|zinacef|trimethoprim|fluconazole|diflucan|nystatin|mycostatin|gentamicin|garamycin|tobramycin|tobrex|erythromycin|ery-?tab|clarithromycin|biaxin|cefazolin|ancef|kefzol|ceftazidime|fortaz|tazicef|cefepime|maxipime|piperacillin|zosyn|tazobactam|meropenem|merrem|imipenem|primaxin|ertapenem|invanz|linezolid|zyvox|daptomycin|cubicin|tigecycline|tygacil|colistin|polymyxin|rifampin|rifadin|rifabutin|isoniazid|inh|pyrazinamide|ethambutol|myambutol|minocycline|minocin|tetracycline|sumycin|mupirocin|bactroban|neomycin|bacitracin|neosporin|silver sulfadiazine|silvadene|acyclovir|valacyclovir|valtrex|famciclovir|famvir|oseltamivir|tamiflu|caspofungin|cancidas|micafungin|mycamine|anidulafungin|eraxis|amphotericin|ambisome|voriconazole|vfend|posaconazole|noxafil|itraconazole|sporanox|terbinafine|lamisil|ketoconazole|nizoral|methenamine|hiprex|urex|fosfomycin|monurol|cefpodoxime|vantin|cefixime|suprax|cefaclor|ceclor|cefotaxime|claforan|cefoxitin|mefoxin|ceftaroline|teflaro|aztreonam|azactam|nafcillin|oxacillin|dicloxacillin|amikacin|amikin|streptomycin|kanamycin|norfloxacin|noroxin|ofloxacin|floxin|gatifloxacin|gemifloxacin|factive|fidaxomicin|dificid|telavancin|vibativ|oritavancin|orbactiv|dalbavancin|dalvance|ceftolozane|zerbaxa|ceftazidime|avycaz|meropenem|vabomere|plazomicin|zemdri|eravacycline|xerava|omadacycline|nuzyra|lefamulin|xenleta|delafloxacin|baxdela|metronidazole|flagyl|tinidazole|tindamax|secnidazole|solosec|pentamidine|atovaquone|mepron|primaquine|dapsone|sulfadiazine|pyrimethamine|daraprim)\b/i;

  // Helper to extract MRN from a line - preserve alphanumeric MRNs like LON202238
  const extractMRN = (line: string): string | null => {
    // First try parentheses pattern and preserve alphanumeric content
    const parenMatch = line.match(/\(([A-Za-z0-9]+)\)/);
    if (parenMatch) {
      const rawMrn = parenMatch[1].trim();
      // Accept alphanumeric MRNs (e.g., LON202238) or pure numeric
      if (rawMrn.length >= 4) return rawMrn;
    }
    // Fall back to other patterns
    for (const pattern of mrnPatterns.slice(1)) {
      const match = line.match(pattern);
      if (match) {
        const mrn = canonicalMRN(match[1]);
        if (mrn && mrn.length >= 4) return mrn;
      }
    }
    return null;
  };

  // Helper to check if line looks like a resident header
  const isResidentHeader = (line: string): boolean => {
    // Has comma (name format), has MRN, no medication keywords
    const hasMRN = extractMRN(line) !== null;
    const hasComma = /,/.test(line);
    const hasMedKeyword = medNamePattern.test(line) || antibioticPattern.test(line);
    const hasDate = /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/.test(line);
    
    // Resident headers typically have name with comma and MRN but no medication or date
    return hasMRN && hasComma && !hasMedKeyword && !hasDate;
  };

  // Helper to check if line contains medication data
  const isMedicationLine = (line: string): boolean => {
    const hasDate = /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/.test(line);
    const hasMedKeyword = medNamePattern.test(line) || antibioticPattern.test(line);
    return hasDate || hasMedKeyword;
  };

  console.log('[ABT Parse] Starting parse, total lines:', lines.length);

  for (const line0 of lines) {
    const line = String(line0 || "").replace(/\u00A0/g, " ").trim();
    if (!line) continue;

    // Skip report/header noise lines commonly present in Order Listing Report exports
    if (
      /^facility\s*#/i.test(line) ||
      /^facility\s*code/i.test(line) ||
      /^order\s+listing\s+report/i.test(line) ||
      /^user:/i.test(line) ||
      /^time:/i.test(line) ||
      /^date:/i.test(line) ||
      /^medication\s+class:/i.test(line) ||
      (/resident:\s*all/i.test(line) && /order\s+date\s+range/i.test(line)) ||
      (/^resident\s*name/i.test(line) && /order\s*summary/i.test(line))
    ) {
      continue;
    }

    // Many exports place Resident+MRN+Medication on the SAME line, with no separators:
    // "LAST, FIRST (LON202238)Cefpodoxime ... 01/24/2026 01/31/2026 by mouth Pneumonia"
    // Also handle: "Foster, Brian (148831)Cipro Oral Tablet..." (mixed case names)
    // Detect this and set current per-line so MRN/Name do not remain stuck on "All".
    let lineForParsing = line;
    
    // Pattern: "LASTNAME, FIRSTNAME (MRN)MedicationText..." or "LASTNAME, FIRSTNAME M (MRN)..."
    // MRN can be alphanumeric like LON202238 or numeric like 148831
    const inlineResident = line.match(/^\s*([A-Za-z][A-Za-z\-\'\.]+(?:\s+[A-Za-z][A-Za-z\-\'\.]*)*,\s*[A-Za-z][A-Za-z\-\'\.\s]*?)\s*\(([A-Za-z0-9]+)\)\s*(.*)$/);
    if (inlineResident) {
      const inlineName = inlineResident[1].trim().replace(/\s+/g, " ");
      const inlineMrn = inlineResident[2].trim(); // Preserve alphanumeric MRN
      current = { mrn: inlineMrn, name: inlineName };
      lineForParsing = inlineResident[3].trim();
      console.log('[ABT Parse] Inline resident:', current.name, '| MRN:', current.mrn);
    }

    // Check if this is a resident header
    if (isResidentHeader(line)) {
      const mrn = extractMRN(line);
      if (mrn) {
        // Extract name - everything before the MRN pattern
        let name = line;
        for (const pattern of mrnPatterns) {
          const match = line.match(pattern);
          if (match && match.index !== undefined) {
            name = line.slice(0, match.index).trim();
            break;
          }
        }
        current = { mrn, name };
        console.log('[ABT Parse] Found resident:', current);
        continue;
      }
    }
    
    // If no current resident but line has medication, try to create inline record
    if (!current && isMedicationLine(lineForParsing)) {
      // Try to extract MRN from the line itself
      const mrn = extractMRN(lineForParsing);
      if (mrn) {
        current = { mrn, name: '' };
        console.log('[ABT Parse] Created inline resident from MRN:', mrn);
      } else {
        // Create a placeholder so we can still parse the medication
        current = { mrn: '', name: '' };
        console.log('[ABT Parse] Created placeholder for medication line');
      }
    }
    
    if (!current) continue;

    // Must have at least one date OR medication keyword to be a medication line
    const dateM = lineForParsing.match(/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g);
    const hasMedKeyword = medNamePattern.test(lineForParsing) || antibioticPattern.test(lineForParsing);
    
    if (!dateM?.length && !hasMedKeyword) continue;

    // ========== EXTRACT MEDICATION NAME ==========
    // Look for known antibiotic/medication patterns first
    let med_name = "";
    const abxMatch = lineForParsing.match(antibioticPattern);
    const medMatch = lineForParsing.match(medNamePattern);
    
    if (abxMatch) {
      // Get the full medication name - find word boundaries around the match
      // Look for "MedicationName Formulation Strength" pattern
      // e.g., "Cefpodoxime Proxetil Tablet 200 MG" or "CefTRIAXone Sodium Solution Reconstituted 1 GM"
      const abxPos = lineForParsing.indexOf(abxMatch[0]);
      // Extract from start of med name to just before dosing instructions (Give/Use/Apply)
      const beforeInstructions = lineForParsing.slice(abxPos).split(/\s+(Give|Use|Apply|Take)\s+/i)[0];
      // Clean up: take medication name + form + strength
      const medParts = beforeInstructions.match(/^([A-Za-z\-]+(?:\s+[A-Za-z\-]+)*\s+(?:Tablet|Tab|Capsule|Cap|Solution|Suspension|Susp|Cream|Ointment|Oint|Injection|Inj|Powder|External|Oral|Reconstituted|Delayed Release)?(?:\s+(?:Oral|External|Reconstituted))?(?:\s+\d+[\d\-\.]*\s*(?:MG|MCG|G|ML|GM|UNIT[S]?(?:\/ML)?)?)?)/i);
      if (medParts) {
        med_name = medParts[1].trim();
      } else {
        // Fallback: just get the antibiotic name and next few words
        const words = beforeInstructions.split(/\s+/).slice(0, 6);
        med_name = words.join(' ').replace(/\s+(Give|Use|Apply|Take).*$/i, '').trim();
      }
    } else if (medMatch) {
      // No known antibiotic, but has medication form word
      // Extract backwards to get medication name
      const medPos = lineForParsing.search(medNamePattern);
      const beforeForm = lineForParsing.slice(0, medPos + medMatch[0].length + 15); // include some context after
      const cleanedMed = beforeForm.split(/\s+(Give|Use|Apply|Take)\s+/i)[0];
      med_name = cleanedMed.split(/\s{2,}/).pop()?.trim() || cleanedMed.trim();
    }

    // ========== EXTRACT DOSE ==========
    // Look for dose patterns: "200 MG", "1 GM", "500 UNIT/ML", "3-0.375 GM", etc.
    let dose = "";
    const dosePatterns = [
      /\b(\d+[\-\.]\d+(?:\.\d+)?)\s*(MG|MCG|G|GM|ML|UNIT[S]?(?:\/ML)?)\b/i,  // compound doses like "3-0.375 GM"
      /\b(\d+(?:\.\d+)?)\s*(MG|MCG|G|GM|ML|UNIT[S]?(?:\/ML)?)\b/i,            // simple doses like "200 MG"
    ];
    for (const dp of dosePatterns) {
      const dm = lineForParsing.match(dp);
      if (dm) {
        dose = dm[0];
        break;
      }
    }

    // ========== EXTRACT ROUTE ==========
    const routeMatch = lineForParsing.match(/\b(by\s*mouth|po\b|oral|topical(ly)?|intravenous(ly)?|intravenously|iv\b|g-?tube|enteral|oph(th)?|in\s*eyes|im\b|subcut|sc\b|via\s+g-?tube)\b/i);
    const route_raw = routeMatch ? routeMatch[0] : "";
    
    // ========== EXTRACT INDICATION ==========
    // Look for "for [condition]" pattern
    let indication = "";
    const forMatch = lineForParsing.match(/\bfor\s+([A-Za-z][A-Za-z\s\-\/]+?)(?:\s+for\s+\d+\s+Days?|\s*$)/i);
    if (forMatch) {
      indication = forMatch[1].trim();
      // Clean up trailing numbers or day counts
      indication = indication.replace(/\s+\d+\s*$/, '').trim();
    }
    
    // Also try "indication:" explicit pattern
    if (!indication) {
      const indMatch = lineForParsing.match(/indication[:\s]+([A-Za-z][A-Za-z\s\-\/]+)/i);
      if (indMatch) {
        indication = indMatch[1].trim();
      }
    }

    // ========== EXTRACT MRN/NAME FROM LINE IF MISSING ==========
    // Check if this line has resident info (e.g., "Resident: LASTNAME, FIRSTNAME" or name with MRN)
    const residentMatch = lineForParsing.match(/Resident[:\s]+([A-Z][A-Za-z\-]+(?:,\s*[A-Z][A-Za-z\-\s]+)?)/i);
    if (residentMatch && !current.name) {
      const n = residentMatch[1].trim();
      if (!/^all$/i.test(n)) {
        current = { ...current, name: n };
      }
    }
    
    // Try to extract MRN if it's embedded in the line
    if (!current.mrn) {
      const inlineMRN = extractMRN(lineForParsing);
      if (inlineMRN) {
        current = { ...current, mrn: inlineMRN };
      }
    }

    const start_date = isoDateFromAny(dateM?.[0] || "");
    const end_date = isoDateFromAny(dateM?.[1] || "");
    const route = normalizeRoute(route_raw);
    const tx_days = computeTxDays(start_date, end_date);
    const infection_source = detectInfectionSource(indication || med_name);

    const rec: ParsedABTRow = {
      record_id: "",
      mrn: current.mrn,
      name: current.name,
      unit: "",
      room: "",
      med_name,
      dose,
      route,
      route_raw,
      indication,
      infection_source,
      start_date,
      end_date,
      tx_days,
      updated_at: nowISO(),
      source: "order_listing_rawtext",
      _include: route !== "TOP"
    };
    rec.record_id = makeAbxRecordId(rec);
    rows.push(rec);
    console.log('[ABT Parse] Added row:', rec.med_name, '| MRN:', rec.mrn, '| Dose:', rec.dose, '| Indication:', rec.indication);
  }
  
  console.log('[ABT Parse] Total rows parsed:', rows.length);
  return rows;
};

// Date formatting helpers
export const formatMDY = (iso: string): string => {
  if (!iso) return '';
  const d = new Date(String(iso).slice(0, 10) + 'T00:00:00');
  if (!isFinite(d.getTime())) return String(iso);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yy = d.getFullYear();
  return `${mm}/${dd}/${yy}`;
};
