export const ABT_TRACKER_COLUMNS = [
  'id', 'mrn', 'residentName', 'name', 'unit', 'room', 'status',
  'medication', 'med_name', 'dose', 'route', 'frequency', 'indication', 'infection_source',
  'startDate', 'start_date', 'endDate', 'end_date', 'plannedStopDate',
  'tx_days', 'daysOfTherapy', 'nextReviewDate', 'prescriber',
  'cultureCollected', 'cultureResult', 'cultureReviewedDate',
  'timeoutReviewDate', 'timeoutOutcome', 'adverseEffects', 'cdiffRisk',
  'stewardshipNotes', 'source', 'notes', 'createdAt', 'updated_at',
  'record_id', 'route_raw',
] as const;

export const ABT_REQUIRED_COLUMN_GROUPS = [
  ['residentName', 'name'],
  ['medication', 'med_name'],
  ['startDate', 'start_date'],
] as const;

export const IP_TRACKER_COLUMNS = [
  'id', 'record_id', 'mrn', 'residentName', 'name', 'unit', 'room', 'status', 'case_status',
  'infectionType', 'infection_type', 'protocol', 'isolationType', 'isolation_type',
  'sourceOfInfection', 'source_of_infection', 'pathogen', 'organism',
  'onsetDate', 'onset_date', 'precautionStartDate', 'resolutionDate', 'resolution_date',
  'nextReviewDate', 'next_review_date', 'lastReviewDate', 'reviewNotes',
  'triggerReason', 'highContactCare', 'signagePosted', 'suppliesStocked', 'roomCheckDate',
  'exposureLinked', 'outbreakId', 'requiredPPE', 'nhsnPathogenCode', 'vaccineStatus',
  'staffAssignments', 'closeContacts', 'commonAreasVisited', 'sharedEquipment', 'otherEquipment',
  '_autoClosed', '_autoClosedReason', 'notes', 'createdAt', 'updatedAt', 'updated_at',
] as const;

export const IP_REQUIRED_COLUMN_GROUPS = [
  ['residentName', 'name'],
  ['infectionType', 'infection_type'],
  ['onsetDate', 'onset_date'],
] as const;

export const hasAnyColumn = (row: Record<string, unknown>, columns: readonly string[]): boolean => {
  return columns.some((column) => column in row);
};

export const getMissingColumnGroups = (
  row: Record<string, unknown>,
  groups: ReadonlyArray<readonly string[]>,
): string[] => {
  return groups
    .filter((group) => !hasAnyColumn(row, group))
    .map((group) => group.join(' / '));
};
