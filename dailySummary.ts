export interface UnifiedDBv1 {
  schema?: string;
  schemaVersion?: string;
  capabilities?: Record<string, any>;
  census?: any[];
  records?: {
    ip_cases?: any[];
    abx?: any[];
    vax?: any[];
    outbreaks?: any[];
    line_listings?: any[];
    ip_daily_metrics?: any[];
  };
  settings?: Record<string, any>;
  audit_log?: any[];
}

export type UnitScope = string | "facility";

export interface DailyIPSummaryMetricsV1 {
  schema: "DAILY_IP_METRICS_V1";
  date: string;
  unitId: UnitScope;

  censusCount: number | null;
  residentDays: number | null;

  newInfections: number;
  activeIPCases: number;
  residentsOnEBP: number;
  newPrecautionsInitiated: number;
  precautionsDiscontinued: number;
  mdroActive: number;
  culturesCollectedToday: number;
  culturesPendingFollowup: number;

  newABTStarts: number;
  activeABTCourses: number;
  abxWithIndicationPct: number;
  abxTimeoutsDueToday: number;
  abxTimeoutsCompletedToday: number;

  vaccinesGivenToday: number;
  vaxDeclinesToday: number;
  vaxDueCount: number;
  vaxOverdueCount: number;

  outbreaksActiveToday: number;
  outbreakCasesToday: number;
}

export interface DeriveOptions {
  timeoutHours?: number;
  mdroKeywords?: string[];
  ebpKeywords?: string[];
  unitAliases?: Record<string, string>;
}

export interface WeeklyAggregate {
  unitId: UnitScope;
  startISO: string;
  endISO: string;
  residentDays: number | null;
  totals: Omit<
    DailyIPSummaryMetricsV1,
    "schema" | "date" | "unitId" | "censusCount" | "residentDays"
  >;
  ratesPer1000ResidentDays?: {
    newInfections?: number;
    newABTStarts?: number;
  };
}

const DEFAULT_TIMEOUT_HOURS = 72;
const DEFAULT_MDRO_KEYWORDS = ["MRSA", "VRE", "ESBL", "CRE", "C. diff", "MDR", "MDRO"];
const DEFAULT_EBP_KEYWORDS = ["EBP", "Enhanced Barrier"];

const DAY_MS = 24 * 60 * 60 * 1000;

function safeObject(input: unknown): Record<string, unknown> {
  if (input && typeof input === "object") {
    return input as Record<string, unknown>;
  }
  return {};
}

function getArray<T = any>(input: unknown): readonly T[] {
  return Array.isArray(input) ? (input as T[]) : [];
}

function parseNumber(input: unknown): number | null {
  if (typeof input === "number" && Number.isFinite(input)) {
    return input;
  }
  if (typeof input === "string" && input.trim() !== "") {
    const parsed = Number(input);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function addHoursToISODate(startISO: string, hours: number): string {
  const [y, m, d] = startISO.split("-").map((part) => Number(part));
  const safeHours = Number.isFinite(hours) ? hours : 0;
  const ts = Date.UTC(y, (m || 1) - 1, d || 1) + safeHours * 60 * 60 * 1000;
  const date = new Date(ts);
  const yy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function clampTimeoutHours(input: unknown): number {
  const parsed = parseNumber(input);
  if (parsed === null) {
    return DEFAULT_TIMEOUT_HOURS;
  }
  return Math.max(0, Math.floor(parsed));
}

function normalizeForCompare(value: string): string {
  return value.trim().toLowerCase();
}

export function getStringField(rec: any, keys: string[]): string {
  const obj = safeObject(rec);
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "string" && value.trim() !== "") {
      return value.trim();
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }
  return "";
}

export function toISODate(input: unknown): string | null {
  if (input === null || input === undefined || input === "") {
    return null;
  }

  if (input instanceof Date) {
    if (Number.isNaN(input.getTime())) {
      return null;
    }
    const y = input.getFullYear();
    const m = String(input.getMonth() + 1).padStart(2, "0");
    const d = String(input.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  if (typeof input === "number" && Number.isFinite(input)) {
    const date = new Date(input);
    if (Number.isNaN(date.getTime())) {
      return null;
    }
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  if (typeof input !== "string") {
    return null;
  }

  const raw = input.trim();
  if (!raw) {
    return null;
  }

  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/);
  if (isoMatch) {
    const y = Number(isoMatch[1]);
    const m = Number(isoMatch[2]);
    const d = Number(isoMatch[3]);
    const dt = new Date(Date.UTC(y, m - 1, d));
    if (dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d) {
      return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
    }
  }

  const mdYMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdYMatch) {
    const m = Number(mdYMatch[1]);
    const d = Number(mdYMatch[2]);
    const y = Number(mdYMatch[3]);
    const dt = new Date(Date.UTC(y, m - 1, d));
    if (dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d) {
      return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
  }

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function normalizeUnit(
  raw: unknown,
  unitAliases?: Record<string, string>
): string | null {
  if (raw === null || raw === undefined) {
    return null;
  }
  const value = String(raw).trim();
  if (!value) {
    return null;
  }
  const normalized = value.replace(/\s+/g, " ");
  const aliasMap = unitAliases || {};
  const aliasKey = normalizeForCompare(normalized);

  const aliasEntries = Object.entries(aliasMap);
  const direct = aliasMap[normalized] ?? aliasMap[aliasKey];
  if (typeof direct === "string" && direct.trim()) {
    return direct.trim();
  }

  for (const [key, aliasValue] of aliasEntries) {
    if (normalizeForCompare(key) === aliasKey && aliasValue.trim()) {
      return aliasValue.trim();
    }
  }

  return normalized;
}

export function getUnitFromRecord(rec: any, unitAliases?: Record<string, string>): string | null {
  const raw = getStringField(rec, ["unit", "unitId", "locationUnit", "floor", "wing"]);
  return normalizeUnit(raw || null, unitAliases);
}

export function matchesUnit(
  rec: any,
  selectedUnit: UnitScope,
  unitAliases?: Record<string, string>
): boolean {
  if (selectedUnit === "facility") {
    return true;
  }
  const recUnit = getUnitFromRecord(rec, unitAliases);
  const target = normalizeUnit(selectedUnit, unitAliases);
  if (!target) {
    return false;
  }
  return recUnit === target;
}

export function inferStartDate(rec: any): string | null {
  return toISODate(
    getStringField(rec, ["onsetDate", "precautionStartDate", "initiationDate", "startDate", "beginDate"])
  );
}

export function inferEndDate(rec: any): string | null {
  return toISODate(
    getStringField(rec, ["resolutionDate", "precautionEndDate", "dischargeDate", "endDate", "stopDate"])
  );
}

export function isActiveOnDate(
  startISO: string | null,
  endISO: string | null,
  targetISO: string
): boolean {
  if (!startISO || !targetISO) {
    return false;
  }
  if (startISO > targetISO) {
    return false;
  }
  if (!endISO) {
    return true;
  }
  return endISO >= targetISO;
}

export function normalizeIPCase(
  rec: any,
  unitAliases?: Record<string, string>
): {
  unitId: string | null;
  startISO: string | null;
  endISO: string | null;
  protocol: string;
  infectionType: string;
  pathogen: string;
  cultureDateISO: string | null;
  cultureResult: string;
} {
  return {
    unitId: getUnitFromRecord(rec, unitAliases),
    startISO: inferStartDate(rec),
    endISO: inferEndDate(rec),
    protocol: getStringField(rec, ["protocol", "isolationType", "precautionType"]),
    infectionType: getStringField(rec, ["infectionType", "sourceCondition", "sourceOfInfection"]),
    pathogen: getStringField(rec, ["pathogen", "organism", "suspectedOrConfirmedOrganism"]),
    cultureDateISO: toISODate(getStringField(rec, ["collectionDateTime", "cultureCollectionDate", "cultureDate"])),
    cultureResult: getStringField(rec, ["cultureResult", "labResults"]),
  };
}

export function normalizeABX(
  rec: any,
  unitAliases?: Record<string, string>
): {
  unitId: string | null;
  startISO: string | null;
  endISO: string | null;
  indication: string;
  timeoutReviewISO: string | null;
  timeoutOutcomeISO: string | null;
} {
  return {
    unitId: getUnitFromRecord(rec, unitAliases),
    startISO: toISODate(getStringField(rec, ["startDate", "beginDate", "initiationDate"])),
    endISO: toISODate(getStringField(rec, ["endDate", "stopDate", "discontinueDate"])),
    indication: getStringField(rec, ["indication"]),
    timeoutReviewISO: toISODate(getStringField(rec, ["timeoutReviewDate", "reviewDate", "nextReviewDate"])),
    timeoutOutcomeISO: toISODate(getStringField(rec, ["timeoutOutcomeDate", "reviewOutcomeDate"])),
  };
}

export function normalizeVax(
  rec: any,
  unitAliases?: Record<string, string>
): {
  unitId: string | null;
  status: string;
  givenISO: string | null;
  offerISO: string | null;
  dueISO: string | null;
} {
  return {
    unitId: getUnitFromRecord(rec, unitAliases),
    status: getStringField(rec, ["status"]).toLowerCase(),
    givenISO: toISODate(getStringField(rec, ["dateGiven", "givenDate"])),
    offerISO: toISODate(getStringField(rec, ["offerDate", "educationDate"])),
    dueISO: toISODate(getStringField(rec, ["dueDate"])),
  };
}

export function normalizeOutbreak(rec: any): {
  status: string;
  startISO: string | null;
  endISO: string | null;
} {
  return {
    status: getStringField(rec, ["status"]).toLowerCase(),
    startISO: toISODate(getStringField(rec, ["startDate", "dateStart", "onsetDate"])),
    endISO: toISODate(getStringField(rec, ["endDate", "dateEnd", "resolvedDate"])),
  };
}

export function normalizeLineListing(
  rec: any,
  unitAliases?: Record<string, string>
): { unitId: string | null; onsetISO: string | null; outbreakId?: string } {
  const outbreakId = getStringField(rec, ["outbreakId", "outbreak_id", "outbreakUUID"]);
  return {
    unitId: getUnitFromRecord(rec, unitAliases),
    onsetISO: toISODate(getStringField(rec, ["onsetDate", "symptomOnsetDate"])),
    ...(outbreakId ? { outbreakId } : {}),
  };
}

function censusCountFor(
  db: UnifiedDBv1,
  targetUnit: UnitScope,
  unitAliases?: Record<string, string>
): number | null {
  const census = getArray(db.census);
  if (!census.length) {
    return null;
  }

  const values = census
    .filter((rec) => (targetUnit === "facility" ? true : matchesUnit(rec, targetUnit, unitAliases)))
    .map((rec) => {
      const direct = parseNumber(safeObject(rec).censusCount);
      const count = parseNumber(safeObject(rec).count);
      const residents = parseNumber(safeObject(rec).residents);
      const censusValue = parseNumber(safeObject(rec).census);
      return direct ?? count ?? residents ?? censusValue;
    })
    .filter((n): n is number => n !== null);

  if (!values.length) {
    const residentRows = census.filter((rec) =>
      targetUnit === "facility" ? true : matchesUnit(rec, targetUnit, unitAliases)
    );
    return residentRows.length ? residentRows.length : null;
  }

  return values.reduce((sum, n) => sum + n, 0);
}

function sanitizeDateISO(input: string): string {
  return toISODate(input) || input;
}

function lowerIncludesAny(haystack: string, needles: readonly string[]): boolean {
  const source = haystack.toLowerCase();
  return needles.some((needle) => source.includes(needle.toLowerCase()));
}

function normalizeOptions(options?: DeriveOptions): Required<Omit<DeriveOptions, "unitAliases">> & {
  unitAliases: Record<string, string>;
} {
  return {
    timeoutHours: clampTimeoutHours(options?.timeoutHours),
    mdroKeywords: (options?.mdroKeywords?.length ? options.mdroKeywords : DEFAULT_MDRO_KEYWORDS).slice(),
    ebpKeywords: (options?.ebpKeywords?.length ? options.ebpKeywords : DEFAULT_EBP_KEYWORDS).slice(),
    unitAliases: { ...(options?.unitAliases || {}) },
  };
}

export function deriveDailyMetrics(
  db: UnifiedDBv1,
  dateISO: string,
  unitId: UnitScope,
  options?: DeriveOptions
): DailyIPSummaryMetricsV1 {
  const safeDB = safeObject(db) as UnifiedDBv1;
  const records = safeObject(safeDB.records);
  const opts = normalizeOptions(options);
  const targetDate = sanitizeDateISO(dateISO);
  const targetUnit = unitId === "facility" ? "facility" : normalizeUnit(unitId, opts.unitAliases) || unitId;

  const ipNormalized = getArray(records.ip_cases)
    .filter((rec) => matchesUnit(rec, targetUnit, opts.unitAliases))
    .map((rec) => ({ raw: rec, norm: normalizeIPCase(rec, opts.unitAliases) }));

  const abxNormalized = getArray(records.abx)
    .filter((rec) => matchesUnit(rec, targetUnit, opts.unitAliases))
    .map((rec) => normalizeABX(rec, opts.unitAliases));

  const vaxNormalized = getArray(records.vax)
    .filter((rec) => matchesUnit(rec, targetUnit, opts.unitAliases))
    .map((rec) => normalizeVax(rec, opts.unitAliases));

  const outbreaksNormalized = getArray(records.outbreaks).map((rec) => normalizeOutbreak(rec));

  const lineNormalized = getArray(records.line_listings)
    .filter((rec) => matchesUnit(rec, targetUnit, opts.unitAliases))
    .map((rec) => normalizeLineListing(rec, opts.unitAliases));

  const newInfections = ipNormalized.filter((x) => x.norm.startISO === targetDate).length;
  const activeIPCases = ipNormalized.filter((x) => isActiveOnDate(x.norm.startISO, x.norm.endISO, targetDate)).length;

  const residentsOnEBP = ipNormalized.filter((x) => {
    if (!isActiveOnDate(x.norm.startISO, x.norm.endISO, targetDate)) {
      return false;
    }
    return lowerIncludesAny(x.norm.protocol, opts.ebpKeywords);
  }).length;

  const newPrecautionsInitiated = ipNormalized.filter((x) => {
    const explicitPrecautionStart = toISODate(getStringField(x.raw, ["precautionStartDate"]));
    if (explicitPrecautionStart) {
      return explicitPrecautionStart === targetDate;
    }
    return x.norm.startISO === targetDate;
  }).length;

  const precautionsDiscontinued = ipNormalized.filter((x) => x.norm.endISO === targetDate).length;

  const mdroActive = ipNormalized.filter((x) => {
    if (!isActiveOnDate(x.norm.startISO, x.norm.endISO, targetDate)) {
      return false;
    }
    return lowerIncludesAny(x.norm.pathogen, opts.mdroKeywords);
  }).length;

  const culturesCollectedToday = ipNormalized.filter((x) => x.norm.cultureDateISO === targetDate).length;
  const culturesPendingFollowup = ipNormalized.filter(
    (x) => !!x.norm.cultureDateISO && x.norm.cultureResult.trim() === ""
  ).length;

  const newABTStarts = abxNormalized.filter((x) => x.startISO === targetDate).length;

  const activeABXRows = abxNormalized.filter((x) => isActiveOnDate(x.startISO, x.endISO, targetDate));
  const activeABTCourses = activeABXRows.length;

  const abxWithIndicationCount = activeABXRows.filter((x) => x.indication.trim() !== "").length;
  const abxWithIndicationPct = activeABTCourses
    ? Number(((abxWithIndicationCount / activeABTCourses) * 100).toFixed(1))
    : 0;

  const abxTimeoutsDueToday = activeABXRows.filter((x) => {
    if (!x.startISO) {
      return false;
    }
    return addHoursToISODate(x.startISO, opts.timeoutHours) === targetDate;
  }).length;

  const abxTimeoutsCompletedToday = abxNormalized.filter(
    (x) => x.timeoutReviewISO === targetDate || x.timeoutOutcomeISO === targetDate
  ).length;

  const vaccinesGivenToday = vaxNormalized.filter(
    (x) => x.status === "given" && x.givenISO === targetDate
  ).length;

  const vaxDeclinesToday = vaxNormalized.filter(
    (x) => x.status === "declined" && x.offerISO === targetDate
  ).length;

  const vaxDueCount = vaxNormalized.filter((x) => x.status === "due").length;
  const vaxOverdueCount = vaxNormalized.filter((x) => x.status === "overdue").length;

  const outbreaksActiveToday = outbreaksNormalized.filter((x) => {
    if (x.status === "active") {
      return true;
    }
    return isActiveOnDate(x.startISO, x.endISO, targetDate);
  }).length;

  const outbreakCasesToday = lineNormalized.filter((x) => x.onsetISO === targetDate).length;

  const censusCount = censusCountFor(safeDB, targetUnit, opts.unitAliases);

  return {
    schema: "DAILY_IP_METRICS_V1",
    date: targetDate,
    unitId: targetUnit,
    censusCount,
    residentDays: censusCount,
    newInfections,
    activeIPCases,
    residentsOnEBP,
    newPrecautionsInitiated,
    precautionsDiscontinued,
    mdroActive,
    culturesCollectedToday,
    culturesPendingFollowup,
    newABTStarts,
    activeABTCourses,
    abxWithIndicationPct,
    abxTimeoutsDueToday,
    abxTimeoutsCompletedToday,
    vaccinesGivenToday,
    vaxDeclinesToday,
    vaxDueCount,
    vaxOverdueCount,
    outbreaksActiveToday,
    outbreakCasesToday,
  };
}

function incrementISODate(iso: string): string {
  const [y, m, d] = iso.split("-").map((part) => Number(part));
  const base = Date.UTC(y, (m || 1) - 1, d || 1);
  const next = new Date(base + DAY_MS);
  const yy = next.getUTCFullYear();
  const mm = String(next.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(next.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export function deriveMetricsRange(
  db: UnifiedDBv1,
  startISO: string,
  endISO: string,
  unitId: UnitScope,
  options?: DeriveOptions
): DailyIPSummaryMetricsV1[] {
  const start = sanitizeDateISO(startISO);
  const end = sanitizeDateISO(endISO);

  if (start > end) {
    return [];
  }

  const out: DailyIPSummaryMetricsV1[] = [];
  let cursor = start;
  while (cursor <= end) {
    out.push(deriveDailyMetrics(db, cursor, unitId, options));
    cursor = incrementISODate(cursor);
  }
  return out;
}

function round1(value: number): number {
  return Number(value.toFixed(1));
}

function emptyTotals(): WeeklyAggregate["totals"] {
  return {
    newInfections: 0,
    activeIPCases: 0,
    residentsOnEBP: 0,
    newPrecautionsInitiated: 0,
    precautionsDiscontinued: 0,
    mdroActive: 0,
    culturesCollectedToday: 0,
    culturesPendingFollowup: 0,
    newABTStarts: 0,
    activeABTCourses: 0,
    abxWithIndicationPct: 0,
    abxTimeoutsDueToday: 0,
    abxTimeoutsCompletedToday: 0,
    vaccinesGivenToday: 0,
    vaxDeclinesToday: 0,
    vaxDueCount: 0,
    vaxOverdueCount: 0,
    outbreaksActiveToday: 0,
    outbreakCasesToday: 0,
  };
}

export function aggregateMetrics(
  daily: DailyIPSummaryMetricsV1[],
  unitId: UnitScope,
  startISO: string,
  endISO: string
): WeeklyAggregate {
  const filtered = getArray(daily).filter((row) => row.date >= startISO && row.date <= endISO);
  const totals = emptyTotals();

  let residentDaysSum = 0;
  let hasResidentDays = false;
  let weightedPctNumerator = 0;
  let weightedPctDenominator = 0;
  let simplePctSum = 0;
  let pctDays = 0;

  for (const row of filtered) {
    totals.newInfections += row.newInfections || 0;
    totals.activeIPCases += row.activeIPCases || 0;
    totals.residentsOnEBP += row.residentsOnEBP || 0;
    totals.newPrecautionsInitiated += row.newPrecautionsInitiated || 0;
    totals.precautionsDiscontinued += row.precautionsDiscontinued || 0;
    totals.mdroActive += row.mdroActive || 0;
    totals.culturesCollectedToday += row.culturesCollectedToday || 0;
    totals.culturesPendingFollowup += row.culturesPendingFollowup || 0;
    totals.newABTStarts += row.newABTStarts || 0;
    totals.activeABTCourses += row.activeABTCourses || 0;
    totals.abxTimeoutsDueToday += row.abxTimeoutsDueToday || 0;
    totals.abxTimeoutsCompletedToday += row.abxTimeoutsCompletedToday || 0;
    totals.vaccinesGivenToday += row.vaccinesGivenToday || 0;
    totals.vaxDeclinesToday += row.vaxDeclinesToday || 0;
    totals.vaxDueCount += row.vaxDueCount || 0;
    totals.vaxOverdueCount += row.vaxOverdueCount || 0;
    totals.outbreaksActiveToday += row.outbreaksActiveToday || 0;
    totals.outbreakCasesToday += row.outbreakCasesToday || 0;

    if (row.residentDays !== null && row.residentDays !== undefined) {
      residentDaysSum += row.residentDays;
      hasResidentDays = true;
    }

    const activeCourses = row.activeABTCourses || 0;
    if (activeCourses > 0) {
      weightedPctNumerator += row.abxWithIndicationPct * activeCourses;
      weightedPctDenominator += activeCourses;
    }

    simplePctSum += row.abxWithIndicationPct || 0;
    pctDays += 1;
  }

  if (weightedPctDenominator > 0) {
    totals.abxWithIndicationPct = round1(weightedPctNumerator / weightedPctDenominator);
  } else {
    totals.abxWithIndicationPct = pctDays > 0 ? round1(simplePctSum / pctDays) : 0;
  }

  const residentDays = hasResidentDays ? residentDaysSum : null;

  const aggregate: WeeklyAggregate = {
    unitId,
    startISO,
    endISO,
    residentDays,
    totals,
  };

  if (residentDays && residentDays > 0) {
    aggregate.ratesPer1000ResidentDays = {
      newInfections: round1((totals.newInfections / residentDays) * 1000),
      newABTStarts: round1((totals.newABTStarts / residentDays) * 1000),
    };
  }

  return aggregate;
}

/*
Example fixture:

const db: UnifiedDBv1 = {
  schema: "UNIFIED_DB_V1",
  census: [{ unit: "Unit 2", censusCount: 30 }],
  records: {
    ip_cases: [{ unit: "Unit 2", onsetDate: "2026-02-17", protocol: "EBP", organism: "MRSA" }],
    abx: [{ unit: "Unit 2", startDate: "2026-02-17", indication: "PNA" }],
    vax: [{ unit: "Unit 2", status: "given", dateGiven: "2026-02-17" }],
  },
};

const out = deriveDailyMetrics(db, "2026-02-17", "Unit 2");
// Expected highlights:
// out.newInfections === 1
// out.activeIPCases === 1
// out.residentsOnEBP === 1
// out.mdroActive === 1
// out.newABTStarts === 1
// out.vaccinesGivenToday === 1
*/
