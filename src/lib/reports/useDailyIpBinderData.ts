import { useMemo } from 'react';
import type { AppDatabase, IPCase, Outbreak, Resident, VaxRecord } from '@/lib/types';
import { loadDB, normalizeIPStatus } from '@/lib/database';

export interface DailyIpBinderParams {
  date: string;
  unitId: string;
}

interface UnitSummary {
  id: string;
  name: string;
}

interface CensusRow {
  room: string;
  residentName: string;
  mrn: string;
  admissionDate: string;
  riskFlags: string;
  newAdmissionReadmission: string;
  primaryDiagnosis: string;
  notes: string;
}

interface InfectionRow {
  room: string;
  residentName: string;
  infectionDiagnosis: string;
  organism: string;
  site: string;
  onsetDate: string;
  haiVsCommunity: string;
  precautionType: string;
  precautionStartDate: string;
  targetReviewEndDate: string;
  cohortingNotes: string;
}

interface OutbreakRow {
  outbreakType: string;
  status: string;
  unitsAffected: string;
  dateDeclared: string;
  casesToday: number;
  totalCases: number;
  controlMeasures: string;
  notes: string;
}

interface OutbreakCaseRow {
  outbreakId: string;
  residentName: string;
  room: string;
  onsetDate: string;
  status: string;
  notes: string;
}

interface DeviceRow {
  room: string;
  residentName: string;
  deviceType: string;
  insertionDate: string;
  indication: string;
  lastDeviceReviewDate: string;
  reviewToday: string;
  plannedRemovalDate: string;
  notes: string;
}

interface VaccineRow {
  room: string;
  residentName: string;
  vaccine: string;
  lastDoseDate: string;
  declinedDate: string;
  declineReason: string;
  educationProvided: string;
  dueOverdueStatus: string;
  outbreakTriggeredOffer: string;
  notes: string;
}

interface ProphylaxisRow {
  room: string;
  residentName: string;
  prophylaxisType: string;
  startDate: string;
  status: string;
  notes: string;
}

interface CleaningTaskRow {
  room: string;
  residentName: string;
  reason: string;
  status: string;
  requiredCleaningType: string;
  productMethod: string;
  completionStatus: string;
  completedByTime: string;
  notes: string;
}

interface SharedEquipmentRow {
  room: string;
  residentName: string;
  equipment: string;
  cleaningStatus: string;
  notes: string;
}

interface LabRow {
  room: string;
  residentName: string;
  specimenType: string;
  collectionDateTime: string;
  status: string;
  organisms: string;
  susceptibilityMdroFlag: string;
  requiredAction: string;
  actionCompleted: string;
  notes: string;
}

interface HandHygieneRow {
  metric: string;
  value: string;
  notes: string;
}

interface PpeFocusRow {
  focusArea: string;
  reminder: string;
  owner: string;
}

interface EducationRow {
  topic: string;
  targetStaff: string;
  format: string;
  materialsNeeded: string;
  completed: string;
  notes: string;
}

interface ActionItemRow {
  priority: string;
  category: string;
  description: string;
  responsibleRole: string;
  dueDateTime: string;
  status: string;
  ipNotes: string;
}

export interface DailyIpBinderData {
  unit: UnitSummary;
  census: CensusRow[];
  infections: InfectionRow[];
  outbreaks: OutbreakRow[];
  outbreakCases: OutbreakCaseRow[];
  devices: DeviceRow[];
  vaccines: VaccineRow[];
  prophylaxis: ProphylaxisRow[];
  cleaningTasks: CleaningTaskRow[];
  sharedEquipment: SharedEquipmentRow[];
  labs: LabRow[];
  handHygiene: HandHygieneRow[];
  ppeFocus: PpeFocusRow[];
  education: EducationRow[];
  actionItems: ActionItemRow[];
}

const asOfDate = (date: string): string => date || new Date().toISOString().slice(0, 10);

const residentName = (resident: Resident): string => resident.name || 'Unknown';

const isResidentInScope = (resident: Resident, unitId: string): boolean => (
  resident.active_on_census && (unitId === 'all' || resident.unit === unitId)
);

const mdroPattern = /mrsa|vre|mdro|c\.?\s*difficile|c\.diff|cre/i;

const getRiskFlags = (resident: Resident, activeCases: IPCase[]): string => {
  const flags: string[] = [];
  if ((resident.notes || '').toLowerCase().includes('wound')) flags.push('Wound');
  if (activeCases.some((ipCase) => mdroPattern.test(ipCase.suspectedOrConfirmedOrganism || ''))) flags.push('MDRO');
  if (activeCases.some((ipCase) => (ipCase.protocol || '').toLowerCase() === 'isolation')) flags.push('Isolation');
  return flags.join(', ');
};

const isNewAdmission = (admitDate?: string, reportDate?: string): string => {
  if (!admitDate || !reportDate) return 'No';
  const deltaMs = new Date(reportDate).getTime() - new Date(admitDate).getTime();
  if (Number.isNaN(deltaMs)) return 'No';
  const deltaDays = Math.floor(deltaMs / (1000 * 60 * 60 * 24));
  return deltaDays >= 0 && deltaDays <= 3 ? 'Yes' : 'No';
};

const mapOutbreak = (outbreak: Outbreak, lineListingsToday: number): OutbreakRow => ({
  outbreakType: outbreak.name || outbreak.type,
  status: outbreak.status,
  unitsAffected: outbreak.affectedUnits.join(', '),
  dateDeclared: outbreak.declaredAt || outbreak.startDate,
  casesToday: lineListingsToday,
  totalCases: outbreak.totalCases || 0,
  controlMeasures: outbreak.status === 'active' ? 'Enhanced monitoring, cohorting, and PPE audits' : '',
  notes: outbreak.notes || '',
});

export const getDailyIpBinderData = (
  db: AppDatabase,
  { date, unitId }: DailyIpBinderParams,
): DailyIpBinderData => {
  const reportDate = asOfDate(date);
  const residents = Object.values(db.census.residentsByMrn || {});
  const residentsInScope = residents.filter((resident) => isResidentInScope(resident, unitId));
  const residentsByMrn = new Map(residentsInScope.map((resident) => [resident.mrn, resident]));

  const activeIpCases = (db.records.ip_cases || []).filter((ipCase) => {
    const normalizedStatus = normalizeIPStatus(ipCase.status || ipCase.case_status);
    if (normalizedStatus !== 'active') return false;
    if (!residentsByMrn.has(ipCase.mrn)) return false;
    const onsetDate = ipCase.onsetDate || ipCase.onset_date;
    return !onsetDate || onsetDate <= reportDate;
  });

  const outbreaksForUnit = (db.records.outbreaks || []).filter((outbreak) => (
    unitId === 'all' || outbreak.affectedUnits.includes(unitId)
  ));

  const outbreakCases = (db.records.line_listings || []).filter((entry) => {
    const resident = residentsByMrn.get(entry.mrn);
    return Boolean(resident) && (entry.onsetDate || '') <= reportDate;
  });

  const vaccines = (db.records.vax || []).filter((record) => residentsByMrn.has(record.mrn));

  const prophylaxis = (db.records.abx || [])
    .filter((record) => residentsByMrn.has(record.mrn))
    .filter((record) => /prophy/i.test(record.indication || ''));

  const actionItems = (db.records.notes || [])
    .filter((note) => 'followUpStatus' in note && (note.followUpStatus === 'pending' || note.followUpStatus === 'escalated'))
    .filter((note) => residentsByMrn.has(note.mrn));

  return {
    unit: {
      id: unitId,
      name: unitId === 'all' ? 'All Units' : unitId,
    },
    census: residentsInScope.map((resident) => {
      const residentCases = activeIpCases.filter((item) => item.mrn === resident.mrn);
      return {
        room: resident.room,
        residentName: residentName(resident),
        mrn: resident.mrn,
        admissionDate: resident.admitDate || '',
        riskFlags: getRiskFlags(resident, residentCases),
        newAdmissionReadmission: isNewAdmission(resident.admitDate, reportDate),
        primaryDiagnosis: resident.context || '',
        notes: resident.notes || '',
      };
    }),
    infections: activeIpCases.map((ipCase) => ({
      room: ipCase.room,
      residentName: ipCase.residentName || ipCase.name || residentsByMrn.get(ipCase.mrn)?.name || 'Unknown',
      infectionDiagnosis: ipCase.infectionType || ipCase.infection_type || '',
      organism: ipCase.suspectedOrConfirmedOrganism || '',
      site: ipCase.sourceOfInfection || ipCase.source_of_infection || '',
      onsetDate: ipCase.onsetDate || ipCase.onset_date || '',
      haiVsCommunity: 'Needs review',
      precautionType: ipCase.protocol || ipCase.isolationType || ipCase.isolation_type || '',
      precautionStartDate: ipCase.onsetDate || ipCase.onset_date || '',
      targetReviewEndDate: ipCase.nextReviewDate || ipCase.next_review_date || '',
      cohortingNotes: ipCase.staffAssignments || ipCase.notes || '',
    })),
    outbreaks: outbreaksForUnit.map((outbreak) => {
      const casesToday = outbreakCases.filter((entry) => entry.outbreakId === outbreak.id && (entry.onsetDate || '') === reportDate).length;
      return mapOutbreak(outbreak, casesToday);
    }),
    outbreakCases: outbreakCases.map((entry) => ({
      outbreakId: entry.outbreakId,
      residentName: entry.residentName,
      room: entry.room,
      onsetDate: entry.onsetDate,
      status: entry.outcome || 'active',
      notes: entry.notes || '',
    })),
    devices: [],
    vaccines: vaccines.map((record: VaxRecord) => ({
      room: record.room,
      residentName: record.residentName || record.name || residentsByMrn.get(record.mrn)?.name || 'Unknown',
      vaccine: record.vaccine || record.vaccine_type || '',
      lastDoseDate: record.dateGiven || record.date_given || '',
      declinedDate: record.status === 'declined' ? (record.offerDate || record.educationDate || '') : '',
      declineReason: record.declineReason || record.decline_reason || '',
      educationProvided: record.educationProvided ? 'Yes' : 'No',
      dueOverdueStatus: record.status,
      outbreakTriggeredOffer: record.seasonOverrideCurrent ? 'Yes' : 'No',
      notes: record.notes || '',
    })),
    prophylaxis: prophylaxis.map((record) => ({
      room: record.room,
      residentName: record.residentName || record.name || residentsByMrn.get(record.mrn)?.name || 'Unknown',
      prophylaxisType: record.medication || record.med_name || '',
      startDate: record.startDate || record.start_date || '',
      status: record.status,
      notes: record.notes || '',
    })),
    cleaningTasks: activeIpCases
      .filter((ipCase) => mdroPattern.test(ipCase.suspectedOrConfirmedOrganism || ''))
      .map((ipCase) => ({
        room: ipCase.room,
        residentName: ipCase.residentName || ipCase.name || residentsByMrn.get(ipCase.mrn)?.name || 'Unknown',
        reason: ipCase.suspectedOrConfirmedOrganism || ipCase.infectionType || 'Enhanced cleaning',
        status: 'Open',
        requiredCleaningType: 'Terminal / Enhanced',
        productMethod: 'EPA List K product',
        completionStatus: 'Pending',
        completedByTime: '',
        notes: ipCase.notes || '',
      })),
    sharedEquipment: activeIpCases
      .filter((ipCase) => Array.isArray(ipCase.sharedEquipment) && ipCase.sharedEquipment.length > 0)
      .map((ipCase) => ({
        room: ipCase.room,
        residentName: ipCase.residentName || ipCase.name || residentsByMrn.get(ipCase.mrn)?.name || 'Unknown',
        equipment: (ipCase.sharedEquipment || []).join(', '),
        cleaningStatus: 'Needs confirmation',
        notes: ipCase.otherEquipment || '',
      })),
    labs: outbreakCases.map((entry) => ({
      room: entry.room,
      residentName: entry.residentName,
      specimenType: entry.symptomCategory || '',
      collectionDateTime: entry.onsetDate,
      status: entry.outcome || 'active',
      organisms: entry.labResults || '',
      susceptibilityMdroFlag: mdroPattern.test(entry.labResults || '') ? 'MDRO flag' : '',
      requiredAction: entry.labResults ? 'Review susceptibility and isolation plan' : 'Awaiting result',
      actionCompleted: 'No',
      notes: entry.notes || '',
    })),
    handHygiene: [
      {
        metric: 'Observations logged',
        value: 'No source configured',
        notes: 'Add audit source to populate daily summary.',
      },
    ],
    ppeFocus: [
      {
        focusArea: 'Isolation room entry/exit',
        reminder: 'Confirm donning/doffing signage and supplies before rounds.',
        owner: 'Charge Nurse/IP',
      },
    ],
    education: [],
    actionItems: actionItems.map((item) => ({
      priority: item.followUpStatus === 'escalated' ? 'High' : 'Medium',
      category: item.category || 'Follow-up',
      description: item.text,
      responsibleRole: 'IP Nurse',
      dueDateTime: item.followUpDate || '',
      status: item.followUpStatus || 'pending',
      ipNotes: item.followUpNotes || '',
    })),
  };
};

export const useDailyIpBinderData = (params: DailyIpBinderParams): DailyIpBinderData => {
  return useMemo(() => {
    const db = loadDB();
    return getDailyIpBinderData(db, params);
  }, [params.date, params.unitId]);
};
