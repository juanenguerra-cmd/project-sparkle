const DATE_FIELDS = new Set([
  'onsetDate',
  'onset_date',
  'onset',
  'event_date',
  'precautionStartDate',
  'resolutionDate',
  'resolution_date',
  'nextReviewDate',
  'next_review_date',
  'next_review',
  'nextReview',
  'lastReviewDate',
  'roomCheckDate',
]);

export const IP_CENTRALIZED_COLUMNS = [
  'id', 'mrn', 'residentName', 'name', 'unit', 'room', 'status', 'case_status',
  'infectionType', 'infection_type', 'protocol', 'isolationType', 'isolation_type',
  'sourceOfInfection', 'source_of_infection', 'pathogen', 'organism',
  'onsetDate', 'onset_date', 'precautionStartDate', 'resolutionDate', 'resolution_date',
  'nextReviewDate', 'next_review_date', 'lastReviewDate', 'reviewNotes',
  'triggerReason', 'highContactCare', 'signagePosted', 'suppliesStocked', 'roomCheckDate',
  'exposureLinked', 'outbreakId', 'requiredPPE', 'nhsnPathogenCode', 'vaccineStatus',
  'staffAssignments', 'closeContacts', 'commonAreasVisited', 'sharedEquipment', 'otherEquipment',
  '_autoClosed', '_autoClosedReason', 'notes', 'createdAt', 'updatedAt',
  'precautionType', 'isolationStatus', 'isolationActive', 'sourceCondition', 'caseStatus',
  'onset', 'record_id', 'next_review', 'nextReview', 'event_date', 'residentId',
] as const;

export const IP_FIELD_ALIASES: Record<string, string[]> = {
  id: ['id', 'record_id'],
  record_id: ['record_id', 'id'],
  residentId: ['residentId'],
  residentName: ['residentName', 'name'],
  name: ['name', 'residentName'],
  infectionType: ['infectionType', 'infection_type', 'pathogen', 'organism'],
  infection_type: ['infection_type', 'infectionType', 'pathogen', 'organism'],
  pathogen: ['pathogen', 'organism', 'infectionType', 'infection_type'],
  organism: ['organism', 'pathogen', 'infectionType', 'infection_type'],
  sourceOfInfection: ['sourceOfInfection', 'source_of_infection', 'sourceCondition'],
  source_of_infection: ['source_of_infection', 'sourceOfInfection', 'sourceCondition'],
  sourceCondition: ['sourceCondition', 'sourceOfInfection', 'source_of_infection'],
  status: ['status', 'case_status', 'caseStatus', 'isolationStatus'],
  case_status: ['case_status', 'status', 'caseStatus', 'isolationStatus'],
  caseStatus: ['caseStatus', 'status', 'case_status', 'isolationStatus'],
  onsetDate: ['onsetDate', 'onset_date', 'onset', 'event_date'],
  onset_date: ['onset_date', 'onsetDate', 'onset', 'event_date'],
  onset: ['onset', 'onsetDate', 'onset_date', 'event_date'],
  event_date: ['event_date', 'onsetDate', 'onset_date', 'onset'],
  nextReviewDate: ['nextReviewDate', 'next_review_date', 'next_review', 'nextReview'],
  next_review_date: ['next_review_date', 'nextReviewDate', 'next_review', 'nextReview'],
  next_review: ['next_review', 'nextReviewDate', 'next_review_date', 'nextReview'],
  nextReview: ['nextReview', 'nextReviewDate', 'next_review_date', 'next_review'],
};

const readAlias = (row: Record<string, unknown>, aliases: string[]): unknown => {
  for (const key of aliases) {
    const value = row[key];
    if (value !== undefined && value !== null && `${value}`.trim() !== '') return value;
  }
  return undefined;
};

export const getIPFieldValue = (row: Record<string, unknown>, field: string): unknown => {
  const aliases = IP_FIELD_ALIASES[field] || [field];
  return readAlias(row, aliases);
};

export const hasRequiredIPFields = (row: Record<string, unknown>): boolean => {
  const hasResident = !!getIPFieldValue(row, 'residentName');
  const hasInfection = !!getIPFieldValue(row, 'infectionType');
  const hasOnset = !!getIPFieldValue(row, 'onsetDate');
  return hasResident && hasInfection && hasOnset;
};

export const canonicalizeIPRow = (
  row: Record<string, unknown>,
  normalizeDate: (value?: string) => string,
): Record<string, unknown> => {
  const normalized: Record<string, unknown> = { ...row };

  for (const field of IP_CENTRALIZED_COLUMNS) {
    const raw = getIPFieldValue(row, field);
    if (raw === undefined) continue;
    normalized[field] = DATE_FIELDS.has(field) ? normalizeDate(String(raw || '')) : raw;
  }

  const canonicalId = String(getIPFieldValue(row, 'id') || '').trim();
  if (canonicalId) {
    normalized.id = canonicalId;
    normalized.record_id = canonicalId;
  }

  const residentName = String(getIPFieldValue(row, 'residentName') || '').trim();
  if (residentName) {
    normalized.residentName = residentName;
    normalized.name = residentName;
  }

  const infectionType = String(getIPFieldValue(row, 'infectionType') || '').trim();
  if (infectionType) {
    normalized.infectionType = infectionType;
    normalized.infection_type = infectionType;
    if (!normalized.pathogen) normalized.pathogen = infectionType;
    if (!normalized.organism) normalized.organism = infectionType;
  }

  const source = String(getIPFieldValue(row, 'sourceOfInfection') || '').trim();
  if (source) {
    normalized.sourceOfInfection = source;
    normalized.source_of_infection = source;
    if (!normalized.sourceCondition) normalized.sourceCondition = source;
  }

  const onset = normalizeDate(String(getIPFieldValue(row, 'onsetDate') || ''));
  if (onset) {
    normalized.onsetDate = onset;
    normalized.onset_date = onset;
    normalized.onset = onset;
    if (!normalized.event_date) normalized.event_date = onset;
  }

  const nextReview = normalizeDate(String(getIPFieldValue(row, 'nextReviewDate') || ''));
  if (nextReview) {
    normalized.nextReviewDate = nextReview;
    normalized.next_review_date = nextReview;
    normalized.next_review = nextReview;
    normalized.nextReview = nextReview;
  }

  return normalized;
};
