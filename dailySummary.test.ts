import { describe, expect, it } from "vitest";
import {
  deriveDailyMetrics,
  deriveMetricsRange,
  aggregateMetrics,
  toISODate,
  isActiveOnDate,
  inferStartDate,
  inferEndDate,
  normalizeUnit,
  getUnitFromRecord,
  normalizeIPCase,
  normalizeABX,
  normalizeVax,
} from "./dailySummary";

const TEST_DATE = "2026-02-16";

type AnyObj = Record<string, any>;

const makeDB = (overrides: AnyObj = {}) => ({
  schema: "UNIFIED_DB_V1",
  records: {
    ip_cases: [],
    abx: [],
    vax: [],
    outbreaks: [],
    line_listings: [],
    ip_daily_metrics: [],
    ...(overrides.records || {}),
  },
  ...(overrides.census ? { census: overrides.census } : {}),
  ...overrides,
});

const ipCase = (fields: AnyObj = {}) => ({
  unit: "Unit 2",
  onsetDate: "2026-02-15",
  ...fields,
});

const abx = (fields: AnyObj = {}) => ({
  unit: "Unit 2",
  startDate: "2026-02-15",
  ...fields,
});

const vax = (fields: AnyObj = {}) => ({
  unit: "Unit 2",
  status: "due",
  ...fields,
});

const outbreak = (fields: AnyObj = {}) => ({
  status: "active",
  ...fields,
});

const line = (fields: AnyObj = {}) => ({
  unit: "Unit 2",
  onsetDate: TEST_DATE,
  ...fields,
});

const censusRow = (fields: AnyObj = {}) => ({
  unit: "Unit 2",
  censusCount: 1,
  ...fields,
});

describe("dailySummary - date helpers", () => {
  it.each([
    ["2026-02-16", "2026-02-16"],
    ["02/16/2026", "2026-02-16"],
    [new Date("2026-02-16T12:00:00Z"), "2026-02-16"],
    ["not-a-date", null],
  ])("toISODate(%p) => %p", (input, expected) => {
    expect(toISODate(input)).toBe(expected);
  });

  it.each([
    ["2026-02-15", null, "2026-02-16", true],
    ["2026-02-17", null, "2026-02-16", false],
    ["2026-02-16", "2026-02-16", "2026-02-16", true],
    [null, null, "2026-02-16", false],
  ])("isActiveOnDate(%p,%p,%p) => %p", (startISO, endISO, targetISO, expected) => {
    expect(isActiveOnDate(startISO, endISO, targetISO)).toBe(expected);
  });

  it("inferStartDate/inferEndDate support flexible keys", () => {
    expect(inferStartDate({ beginDate: TEST_DATE })).toBe(TEST_DATE);
    expect(inferEndDate({ stopDate: TEST_DATE })).toBe(TEST_DATE);
  });
});

describe("dailySummary - unit normalization and filtering", () => {
  const aliases = { "2N": "Unit 2", "unit ii": "Unit 2" };

  it("normalizeUnit applies aliases", () => {
    expect(normalizeUnit("2N", aliases)).toBe("Unit 2");
    expect(normalizeUnit(" Unit II ", aliases)).toBe("Unit 2");
  });

  it.each([
    [{ unit: "Unit 2" }, "Unit 2"],
    [{ unitId: "Unit 2" }, "Unit 2"],
    [{ locationUnit: "Unit 2" }, "Unit 2"],
    [{ floor: "Unit 2" }, "Unit 2"],
    [{ wing: "Unit 2" }, "Unit 2"],
  ])("getUnitFromRecord detects unit key %p", (rec, expected) => {
    expect(getUnitFromRecord(rec)).toBe(expected);
  });

  it("deriveDailyMetrics filters Unit vs facility", () => {
    const db = makeDB({
      records: {
        ip_cases: [
          ipCase({ unit: "Unit 2", onsetDate: TEST_DATE }),
          ipCase({ unit: "Unit 3", onsetDate: TEST_DATE }),
        ],
      },
    });

    const u2 = deriveDailyMetrics(db, TEST_DATE, "Unit 2");
    const facility = deriveDailyMetrics(db, TEST_DATE, "facility");

    expect(u2.newInfections).toBe(1);
    expect(facility.newInfections).toBe(2);
  });
});

describe("dailySummary - IP case metrics", () => {
  it("derives required IP metrics with mixed field names", () => {
    const db = makeDB({
      records: {
        ip_cases: [
          ipCase({ onsetDate: TEST_DATE }),
          ipCase({ onsetDate: "2026-02-10" }),
          ipCase({ onsetDate: "2026-02-10", resolutionDate: TEST_DATE }),
          ipCase({ onsetDate: "2026-02-12", isolationType: "Enhanced Barrier Precautions" }),
          ipCase({ onsetDate: "2026-02-11", suspectedOrConfirmedOrganism: "mRsA colonization" }),
          ipCase({
            precautionStartDate: "2026-02-12",
            collectionDateTime: TEST_DATE,
            cultureResult: "",
          }),
          ipCase({
            onsetDate: null,
            initiationDate: TEST_DATE,
            pathogen: "VRE",
            cultureCollectionDate: TEST_DATE,
            labResults: "negative",
          }),
        ],
      },
    });

    const out = deriveDailyMetrics(db, TEST_DATE, "Unit 2");

    expect(out.newInfections).toBe(2);
    expect(out.activeIPCases).toBe(7);
    expect(out.residentsOnEBP).toBe(1);
    expect(out.precautionsDiscontinued).toBe(1);
    expect(out.mdroActive).toBe(2);
    expect(out.culturesCollectedToday).toBe(2);
    expect(out.culturesPendingFollowup).toBe(1);
    expect(out.newPrecautionsInitiated).toBe(2);
  });

  it("ignores records with invalid dates", () => {
    const db = makeDB({
      records: {
        ip_cases: [ipCase({ onsetDate: "bad-date" })],
      },
    });
    const out = deriveDailyMetrics(db, TEST_DATE, "Unit 2");
    expect(out.newInfections).toBe(0);
    expect(out.activeIPCases).toBe(0);
  });
});

describe("dailySummary - ABX metrics", () => {
  it("derives ABX counts, pct, and timeout metrics with default 72h", () => {
    const db = makeDB({
      records: {
        abx: [
          abx({ startDate: "2026-02-16", indication: "PNA" }),
          abx({ startDate: "2026-02-13", indication: "", timeoutReviewDate: TEST_DATE }),
          abx({ startDate: "2026-02-14", indication: "UTI", endDate: "2026-02-15" }),
        ],
      },
    });

    const out = deriveDailyMetrics(db, TEST_DATE, "Unit 2");

    expect(out.newABTStarts).toBe(1);
    expect(out.activeABTCourses).toBe(2);
    expect(out.abxWithIndicationPct).toBe(50.0);
    expect(out.abxTimeoutsDueToday).toBe(1);
    expect(out.abxTimeoutsCompletedToday).toBe(1);
  });

  it("supports custom timeoutHours", () => {
    const db = makeDB({
      records: {
        abx: [abx({ startDate: "2026-02-14" })],
      },
    });

    const out = deriveDailyMetrics(db, TEST_DATE, "Unit 2", { timeoutHours: 48 });
    expect(out.abxTimeoutsDueToday).toBe(1);
  });

  it("treats null/empty indication as missing", () => {
    const db = makeDB({
      records: {
        abx: [abx({ startDate: TEST_DATE, indication: "" }), abx({ startDate: TEST_DATE, indication: null })],
      },
    });
    const out = deriveDailyMetrics(db, TEST_DATE, "Unit 2");
    expect(out.activeABTCourses).toBe(2);
    expect(out.abxWithIndicationPct).toBe(0);
  });
});

describe("dailySummary - VAX metrics", () => {
  it("derives vaccine metrics with case-insensitive status", () => {
    const db = makeDB({
      records: {
        vax: [
          vax({ status: "GIVEN", dateGiven: TEST_DATE }),
          vax({ status: "Declined", educationDate: TEST_DATE }),
          vax({ status: "due" }),
          vax({ status: "OVERDUE" }),
        ],
      },
    });

    const out = deriveDailyMetrics(db, TEST_DATE, "Unit 2");

    expect(out.vaccinesGivenToday).toBe(1);
    expect(out.vaxDeclinesToday).toBe(1);
    expect(out.vaxDueCount).toBe(1);
    expect(out.vaxOverdueCount).toBe(1);
  });
});

describe("dailySummary - outbreak metrics", () => {
  it("derives outbreak active and line listing counts", () => {
    const db = makeDB({
      records: {
        outbreaks: [outbreak({ status: "active" })],
        line_listings: [line({ onsetDate: TEST_DATE }), line({ symptomOnsetDate: TEST_DATE })],
      },
    });

    const out = deriveDailyMetrics(db, TEST_DATE, "Unit 2");
    expect(out.outbreaksActiveToday).toBe(1);
    expect(out.outbreakCasesToday).toBe(2);
  });

  it("returns zeros when outbreaks arrays are missing", () => {
    const db = { schema: "UNIFIED_DB_V1", records: { ip_cases: [], abx: [], vax: [] } };
    const out = deriveDailyMetrics(db, TEST_DATE, "Unit 2");
    expect(out.outbreaksActiveToday).toBe(0);
    expect(out.outbreakCasesToday).toBe(0);
  });
});

describe("dailySummary - census/resident-days", () => {
  it("computes censusCount and residentDays by unit and facility", () => {
    const db = makeDB({
      census: [
        censusRow({ unit: "Unit 2", censusCount: 10 }),
        censusRow({ unit: "Unit 3", censusCount: 10 }),
      ],
    });

    const unit = deriveDailyMetrics(db, TEST_DATE, "Unit 2");
    const facility = deriveDailyMetrics(db, TEST_DATE, "facility");

    expect(unit.censusCount).toBe(10);
    expect(unit.residentDays).toBe(10);
    expect(facility.censusCount).toBe(20);
    expect(facility.residentDays).toBe(20);
  });
});

describe("dailySummary - range + aggregate", () => {
  const round2 = (n: number) => Number(n.toFixed(2));

  it("derives 7-day range and aggregates sums/rates", () => {
    const db = makeDB({
      census: [censusRow({ unit: "Unit 2", censusCount: 10 })],
      records: {
        ip_cases: Array.from({ length: 7 }, (_, i) => ipCase({ onsetDate: `2026-02-${String(10 + i).padStart(2, "0")}` })),
        abx: Array.from({ length: 7 }, (_, i) => abx({ startDate: `2026-02-${String(10 + i).padStart(2, "0")}`, indication: "ind" })),
      },
    });

    const daily = deriveMetricsRange(db, "2026-02-10", "2026-02-16", "Unit 2");
    expect(daily).toHaveLength(7);
    expect(daily[0].date).toBe("2026-02-10");
    expect(daily[6].date).toBe("2026-02-16");

    const agg = aggregateMetrics(daily, "Unit 2", "2026-02-10", "2026-02-16");

    expect(agg.totals.newInfections).toBe(7);
    expect(agg.totals.newABTStarts).toBe(7);
    expect(agg.residentDays).toBe(70);

    const expectedRate = round2((7 / 70) * 1000);
    expect(round2(agg.ratesPer1000ResidentDays?.newInfections ?? 0)).toBe(expectedRate);
    expect(round2(agg.ratesPer1000ResidentDays?.newABTStarts ?? 0)).toBe(expectedRate);
  });
});

describe("dailySummary - normalizer outputs", () => {
  it("normalizeIPCase/normalizeABX/normalizeVax map canonical fields", () => {
    const ip = normalizeIPCase({ unitId: "Unit 2", onsetDate: TEST_DATE, organism: "MRSA" });
    const a = normalizeABX({ locationUnit: "Unit 2", startDate: TEST_DATE, timeoutReviewDate: TEST_DATE });
    const v = normalizeVax({ wing: "Unit 2", status: "given", givenDate: TEST_DATE });

    expect(ip.unitId).toBe("Unit 2");
    expect(ip.startISO).toBe(TEST_DATE);
    expect(a.timeoutReviewISO).toBe(TEST_DATE);
    expect(v.givenISO).toBe(TEST_DATE);
    expect(v.status).toBe("given");
  });
});

describe("dailySummary - robustness", () => {
  it("handles missing db.records without crashing", () => {
    const out = deriveDailyMetrics({ schema: "UNIFIED_DB_V1" }, TEST_DATE, "Unit 2");
    expect(out.newInfections).toBe(0);
    expect(out.activeABTCourses).toBe(0);
    expect(out.vaccinesGivenToday).toBe(0);
    expect(out.censusCount).toBeNull();
  });
});
