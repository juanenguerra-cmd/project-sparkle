import { describe, it, expect } from "vitest";
import {
  parseCensusRaw,
  parseResidentName,
  deriveUnitFromRoom,
  isValidUnit,
  canonicalMRN,
  computeTxDays,
} from "@/lib/parsers";


describe("computeTxDays", () => {
  it("excludes the end date from the treatment day count", () => {
    expect(computeTxDays("2026-02-12", "2026-02-19")).toBe(7);
    expect(computeTxDays("2026-02-11", "2026-02-18")).toBe(7);
  });

  it("returns 0 when start and end are the same day", () => {
    expect(computeTxDays("2026-02-12", "2026-02-12")).toBe(0);
  });
});

describe("canonicalMRN", () => {
  it("keeps alphanumeric MRNs and strips punctuation", () => {
    expect(canonicalMRN("123456")).toBe("123456");
    expect(canonicalMRN("LON202238")).toBe("202238");
    expect(canonicalMRN("abc123")).toBe("ABC123");
    expect(canonicalMRN("12-34-56")).toBe("123456");
    expect(canonicalMRN("MRN: 654321")).toBe("654321");
    expect(canonicalMRN("(MRN 7654321)")).toBe("7654321");
  });

  it("handles empty or null input", () => {
    expect(canonicalMRN("")).toBe("");
    expect(canonicalMRN(null as any)).toBe("");
  });

  it("truncates to 20 characters", () => {
    expect(canonicalMRN("123456789012345678901234567890")).toBe("12345678901234567890");
  });
});

describe("isValidUnit", () => {
  it("accepts Unit 2, 3, 4", () => {
    expect(isValidUnit("Unit 2")).toBe(true);
    expect(isValidUnit("Unit 3")).toBe(true);
    expect(isValidUnit("Unit 4")).toBe(true);
    expect(isValidUnit("unit 2")).toBe(true);
    expect(isValidUnit("UNIT 3")).toBe(true);
  });

  it("accepts just the number", () => {
    expect(isValidUnit("2")).toBe(true);
    expect(isValidUnit("3")).toBe(true);
    expect(isValidUnit("4")).toBe(true);
  });

  it("rejects invalid units", () => {
    expect(isValidUnit("Unit 1")).toBe(false);
    expect(isValidUnit("Unit 5")).toBe(false);
    expect(isValidUnit("1")).toBe(false);
    expect(isValidUnit("")).toBe(false);
    expect(isValidUnit("Unit")).toBe(false);
  });
});

describe("deriveUnitFromRoom", () => {
  it("derives unit from room starting with 2, 3, 4", () => {
    expect(deriveUnitFromRoom("201")).toBe("Unit 2");
    expect(deriveUnitFromRoom("301-A")).toBe("Unit 3");
    expect(deriveUnitFromRoom("412B")).toBe("Unit 4");
  });

  it("returns empty for rooms starting with 1 or other numbers", () => {
    expect(deriveUnitFromRoom("101")).toBe("");
    expect(deriveUnitFromRoom("501")).toBe("");
    expect(deriveUnitFromRoom("601-A")).toBe("");
  });

  it("handles empty input", () => {
    expect(deriveUnitFromRoom("")).toBe("");
    expect(deriveUnitFromRoom(null as any)).toBe("");
  });
});

describe("parseResidentName", () => {
  it("handles LASTNAME, FIRSTNAME format", () => {
    expect(parseResidentName("SMITH, JOHN")).toBe("SMITH, JOHN");
    expect(parseResidentName("JONES, MARY")).toBe("JONES, MARY");
  });

  it("handles LASTNAME, FIRSTNAME MIDDLENAME format", () => {
    expect(parseResidentName("SMITH, MARY JANE")).toBe("SMITH, MARY JANE");
    expect(parseResidentName("DOE, JOHN WILLIAM")).toBe("DOE, JOHN WILLIAM");
  });

  it("cleans trailing dashes", () => {
    expect(parseResidentName("SMITH, JOHN -")).toBe("SMITH, JOHN");
    expect(parseResidentName("JONES, MARY –")).toBe("JONES, MARY");
  });

  it("converts space-separated names to LASTNAME, FIRSTNAME format", () => {
    expect(parseResidentName("JOHN SMITH")).toBe("SMITH, JOHN");
    expect(parseResidentName("MARY JANE SMITH")).toBe("SMITH, MARY JANE");
  });

  it("handles single name", () => {
    expect(parseResidentName("SMITH")).toBe("SMITH");
  });

  it("handles empty input", () => {
    expect(parseResidentName("")).toBe("");
    expect(parseResidentName(null as any)).toBe("");
  });
});

describe("parseCensusRaw", () => {
  it("parses basic census row with MRN in parentheses", () => {
    const input = "301-A SMITH, JOHN (123456) 01/15/1945 Active Medicare";
    const result = parseCensusRaw(input);
    
    expect(result).toHaveLength(1);
    expect(result[0].mrn).toBe("123456");
    expect(result[0].name).toBe("SMITH, JOHN");
    expect(result[0].room).toBe("301-A");
    expect(result[0].unit).toBe("Unit 3");
    expect(result[0].dob_raw).toBe("01/15/1945");
  });

  it("parses DOB when date appears before MRN", () => {
    const input = "301-A SMITH, JOHN 01/15/1945 (123456) Active Medicare";
    const result = parseCensusRaw(input);

    expect(result).toHaveLength(1);
    expect(result[0].dob_raw).toBe("01/15/1945");
  });

  it("parses DOB with dash-separated format", () => {
    const input = "301-A SMITH, JOHN (123456) 1945-01-15 Active Medicare";
    const result = parseCensusRaw(input);

    expect(result).toHaveLength(1);
    expect(result[0].dob_raw).toBe("1945-01-15");
  });


  it("keeps alphanumeric MRNs from parentheses", () => {
    const input = "305 DOE, JANE (LON202238) 02/20/1950 Active";
    const result = parseCensusRaw(input);

    expect(result).toHaveLength(1);
    expect(result[0].mrn).toBe("202238");
    expect(result[0].name).toBe("DOE, JANE");
  });

  it("parses all rows but only assigns valid units (2, 3, 4)", () => {
    const input = `
      201 JONES, MARY (111111) 02/20/1950 Active
      301 SMITH, JOHN (222222) 03/15/1945 Active
      401 DOE, JANE (333333) 04/10/1960 Active
      101 BROWN, BOB (444444) 05/05/1970 Active
    `;
    const result = parseCensusRaw(input);
    
    // All rows are parsed, but only valid units are assigned
    expect(result).toHaveLength(4);
    
    // Check that valid units are correctly assigned
    const unitMap = Object.fromEntries(result.map(r => [r.mrn, r.unit]));
    expect(unitMap['111111']).toBe("Unit 2");
    expect(unitMap['222222']).toBe("Unit 3");
    expect(unitMap['333333']).toBe("Unit 4");
    expect(unitMap['444444']).toBe(""); // Room 101 -> no valid unit
  });

  it("handles multi-part first names", () => {
    const input = "302 SMITH, MARY JANE (123456) 01/15/1945 Active";
    const result = parseCensusRaw(input);
    
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("SMITH, MARY JANE");
  });

  it("deduplicates by MRN", () => {
    const input = `
      301 SMITH, JOHN (123456) 01/15/1945 Active
      302 SMITH, JOHN (123456) 01/15/1945 Active
    `;
    const result = parseCensusRaw(input);
    
    expect(result).toHaveLength(1);
  });

  it("skips EMPTY rows", () => {
    const input = `
      301 SMITH, JOHN (123456) 01/15/1945 Active
      302 EMPTY (000000) - -
    `;
    const result = parseCensusRaw(input);
    
    expect(result).toHaveLength(1);
  });

  it("skips non-resident names without room/DOB", () => {
    const input = `
      MEDICAREONLY (999999)
      301 SMITH, JOHN (123456) 01/15/1945 Active
    `;
    const result = parseCensusRaw(input);
    
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("SMITH, JOHN");
  });

  it("handles Unit X Room format", () => {
    const input = "Unit 3 305 JOHNSON, WILLIAM (789012) 06/20/1955 Active";
    const result = parseCensusRaw(input);
    
    expect(result).toHaveLength(1);
    expect(result[0].unit).toBe("Unit 3");
    expect(result[0].room).toBe("305");
    expect(result[0].name).toBe("JOHNSON, WILLIAM");
  });

  it("handles room followed by name without comma", () => {
    // Edge case: "301 SMITHJOHN" or "301 SMITH JOHN" without comma
    const input = "302 SMITH JOHN (123456) 01/15/1945 Active";
    const result = parseCensusRaw(input);
    
    expect(result).toHaveLength(1);
    expect(result[0].room).toBe("302");
    expect(result[0].unit).toBe("Unit 3");
    expect(result[0].name).toBe("JOHN, SMITH"); // Parsed as LASTNAME, FIRSTNAME
  });

  it("handles room-letter format followed by name without comma", () => {
    const input = "301-A JONES MARY (654321) 02/20/1950 Active";
    const result = parseCensusRaw(input);
    
    expect(result).toHaveLength(1);
    expect(result[0].room).toBe("301-A");
    expect(result[0].unit).toBe("Unit 3");
    expect(result[0].name).toBe("MARY, JONES");
  });

  it("returns empty array for invalid input", () => {
    expect(parseCensusRaw("")).toEqual([]);
    expect(parseCensusRaw("no mrn here")).toEqual([]);
    expect(parseCensusRaw(null as any)).toEqual([]);
  });
});
