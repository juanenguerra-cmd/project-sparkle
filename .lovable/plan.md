
# Implementation Plan: Extended Reporting Suite for ICN Hub

## Overview

This plan adds **6 new specialized reports** based on your infection control workflow requirements, plus wiring verification to ensure all buttons and functionality work correctly.

---

## Reports to Implement

| # | Report Name | Purpose | Key Filters |
|---|-------------|---------|-------------|
| 1 | **Vaccination Snapshot Report** | Weekly snapshot of vaccinated residents (Pneumonia, Influenza, RSV, COVID) + smart logic for outdated flu vaccinations | Vaccine type, Date range |
| 2 | **Standard of Care Weekly Report** | Date-range based report combining ABT started, IP started, and VAX declinations | Date range (weekly) |
| 3 | **Follow-up/Overdue Notes Report** | Notes requiring follow-up with status and sign-off capability | Follow-up status filter |
| 4 | **Monthly ABT Report** | All residents on antibiotics for a given month | Month selection |
| 5 | **Medicare ABT Compliance Report** | ABT regimens with inappropriate/missing indications for bacterial infections | None (auto-flags issues) |
| 6 | **IP Tracker Review Report** | IP cases due for review based on protocol cadence (EBP: 7 days, Isolation: 3 days) + review notes | Date range, Protocol |

---

## Data Flow for Each Report

```text
+---------------------+     +----------------------+     +------------------+
|   Database Query    | --> | Report Generator     | --> | ReportPreview    |
|   (filter by date,  |     | (format rows/headers)|     | (table display)  |
|    status, type)    |     |                      |     | + PDF export     |
+---------------------+     +----------------------+     +------------------+
```

---

## Technical Implementation

### 1. New Report Generator Functions

Add to `src/lib/reportGenerators.ts`:

**Report 1: Vaccination Snapshot Report**
```text
generateVaxSnapshotReport(db, fromDate, toDate, vaccineType)
- Filters VAX records with dateGiven within date range
- Groups by vaccine type (Pneumonia, Influenza, RSV, COVID)
- Smart logic: flags influenza vaccinations older than current flu season (Oct-Mar cycle)
- Headers: Resident | Unit/Room | Vaccine | Date Given | Status | Notes
```

**Report 2: Standard of Care Weekly Report**
```text
generateStandardOfCareReport(db, fromDate, toDate)
- Section 1: ABT regimens with startDate in range
- Section 2: IP cases with onsetDate in range
- Section 3: VAX records with status='declined' in range
- Headers vary by section; combined into one output
```

**Report 3: Follow-up/Overdue Notes Report**
```text
generateFollowUpNotesReport(db, statusFilter)
- Filters notes where requiresFollowUp=true
- Sorts by followUpDate (overdue first)
- Includes sign-off status column
- Headers: Date | Resident | Unit/Room | Note | Follow-up Date | Status | Completed By
```

**Report 4: Monthly ABT Report**
```text
generateMonthlyABTReport(db, month, year)
- All ABT records active during the selected month
- Includes records where startDate <= month end AND (endDate >= month start OR endDate is null)
- Headers: Resident | Unit/Room | Medication | Dose | Route | Indication | Start | End | Days
```

**Report 5: Medicare ABT Compliance Report**
```text
generateMedicareABTComplianceReport(db)
- Flags ABT records with:
  - Missing indication
  - Indication containing "prophylaxis" without documented bacterial source
  - Duration > 14 days without documented reassessment
- Headers: Resident | Medication | Indication | Start | Duration | Compliance Issue
```

**Report 6: IP Tracker Review Report**
```text
generateIPReviewReport(db, fromDate, toDate)
- Calculates review due dates based on protocol:
  - EBP: every 7 days from onset
  - Isolation: every 3 days from onset
- Shows cases with nextReviewDate within date range
- Includes review notes column for input tracking
- Headers: Resident | Unit/Room | Protocol | Infection | Onset | Last Review | Next Due | Review Notes
```

### 2. Update ReportsView Component

Modifications to `src/components/views/ReportsView.tsx`:

**Add to `operationalReports` array:**
```typescript
{ id: 'vax_snapshot', name: 'Vaccination Snapshot', description: 'Weekly vaccination status with flu season logic' },
{ id: 'standard_of_care', name: 'Standard of Care Report', description: 'Weekly ABT, IP, VAX declinations by date range' },
{ id: 'followup_notes', name: 'Follow-up Notes Report', description: 'Overdue and pending follow-up items' },
{ id: 'monthly_abt', name: 'Monthly ABT Report', description: 'Residents on antibiotics for selected month' },
{ id: 'medicare_compliance', name: 'Medicare ABT Compliance', description: 'Flag inappropriate antibiotic indications' },
{ id: 'ip_review', name: 'IP Review Worklist', description: 'Cases due for review by protocol cadence' },
```

**Update `handleGenerateReport()` switch statement:**
- Add cases for each new report ID
- Wire to corresponding generator functions

**Add new filter controls:**
- Month/Year selector for Monthly ABT Report
- Follow-up status dropdown for Notes Report
- Vaccine type selector for Vaccination Snapshot

### 3. Flu Season Smart Logic

Add helper function for outdated influenza detection:
```typescript
const isInfluenzaOutdated = (dateGiven: string): boolean => {
  // Flu season: October 1 - March 31
  const given = new Date(dateGiven);
  const now = new Date();
  const currentSeasonStart = now.getMonth() >= 9 
    ? new Date(now.getFullYear(), 9, 1)  // Oct of current year
    : new Date(now.getFullYear() - 1, 9, 1); // Oct of previous year
  
  return given < currentSeasonStart;
};
```

### 4. IP Review Notes Integration

Extend IPCase type to support review tracking:
- Add `lastReviewDate` and `reviewNotes` fields
- Update IP Review Report to display/edit review notes inline

---

## File Changes Summary

| File | Changes |
|------|---------|
| `src/lib/reportGenerators.ts` | Add 6 new generator functions (~350 lines) |
| `src/components/views/ReportsView.tsx` | Add new reports to arrays, update switch, add filter UI (~120 lines) |
| `src/lib/types.ts` | Add optional `lastReviewDate`, `reviewNotes` to IPCase (4 lines) |

---

## Wiring Verification Checklist

After implementation, the following will be tested:

1. **Report Generation Buttons** - Each "Generate" button produces correct output
2. **Export Buttons** - PDF, CSV, JSON, HTML exports work for all reports
3. **Print Button** - Opens print dialog with correct formatting
4. **Filter Controls** - Unit, Date range, Vaccine type filters work correctly
5. **Quick Stats** - Clicking dashboard stats generates corresponding report
6. **Report Preview** - Table renders correctly with proper headers and data

---

## Implementation Order

1. **Add report generators** to `reportGenerators.ts`
2. **Update ReportsView** with new reports and handlers
3. **Add filter UI components** (month selector, vaccine type, follow-up status)
4. **Test each report** with sample data
5. **Verify all button wiring** and export functionality

---

## Example: Monthly ABT Report Output

| Resident | Unit/Room | Medication | Dose | Route | Indication | Start | End | Days |
|----------|-----------|------------|------|-------|------------|-------|-----|------|
| SMITH, JOHN | Unit 2 / 201 | Amoxicillin | 500mg | PO | UTI | 01/15/26 | 01/22/26 | 7 |
| DOE, JANE | Unit 3 / 305 | Levofloxacin | 750mg | IV | Pneumonia | 01/20/26 | Ongoing | 8 |

---

## Example: IP Review Worklist Output

| Resident | Unit/Room | Protocol | Infection | Onset | Last Review | Next Due | Review Notes |
|----------|-----------|----------|-----------|-------|-------------|----------|--------------|
| JONES, MARY | Unit 2 / 210 | Isolation | COVID | 01/25/26 | 01/25/26 | 01/28/26 | Initial precautions in place |
| BROWN, BOB | Unit 4 / 401 | EBP | Flu A | 01/21/26 | 01/21/26 | 01/28/26 | Continue monitoring |
