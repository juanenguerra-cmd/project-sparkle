
# Additional Reporting Implementation Plan

## Overview

Based on analysis of the existing ICN Hub codebase and inference from traditional infection control nursing tools, this plan adds **6 new operational reports** and **2 new executive reports** that align with common infection control workflows and regulatory requirements.

---

## New Reports to Implement

### Operational Reports (Day-to-Day Clinical Use)

| Report | Purpose | Key Data |
|--------|---------|----------|
| **ABT Days of Therapy (DOT) Summary** | Antibiotic stewardship metric tracking | Medication, DOT by unit, trends |
| **Overdue Review Worklist** | Consolidated view of all items needing attention | ABT, IP, and VAX overdue reviews |
| **Unit Census & Precaution Summary** | Per-unit snapshot for charge nurses | Resident count, active precautions, pending vaccinations |
| **Symptom Surveillance Log** | Track symptom patterns for early outbreak detection | Notes with symptoms, categorized by type |
| **Contact Tracing Report** | Outbreak contact documentation | Exposure details, follow-up status |
| **Line Listing Export** | Standard outbreak documentation format | CDC-style line listing for outbreak cases |

### Executive Reports (Management & Regulatory)

| Report | Purpose | Key Data |
|--------|---------|----------|
| **Antibiotic Utilization Report** | Stewardship program metrics for QAPI | Usage rates, indication distribution, DOT trends |
| **Monthly Infection Summary** | High-level infection metrics | New cases, resolved, rates by category |

---

## Technical Implementation

### 1. New Report Generator Functions

Add to `src/lib/reportGenerators.ts`:

```text
+-------------------------------+
|  generateABTDOTSummary()      |  Aggregates days of therapy by medication, unit, and route
+-------------------------------+
|  generateOverdueReviewWorklist() |  Combines overdue ABT, IP, and VAX items
+-------------------------------+
|  generateUnitSummary()        |  Per-unit census with precaution counts
+-------------------------------+
|  generateSymptomSurveillance() |  Notes with symptoms filtered by date range
+-------------------------------+
|  generateContactTracingReport() |  Contact entries linked to line listings
+-------------------------------+
|  generateLineListingExport()  |  CDC-format outbreak documentation
+-------------------------------+
|  generateABTUtilization()     |  Monthly/quarterly ABT metrics with charts
+-------------------------------+
|  generateMonthlyInfectionSummary() |  Aggregated infection data with trends
+-------------------------------+
```

### 2. Update ReportsView Component

Modifications to `src/components/views/ReportsView.tsx`:

- Add new reports to `operationalReports` array
- Add new reports to `executiveReports` array
- Add handler cases in `handleGenerateReport()` switch statement
- Create chart data structures for utilization reports (similar to existing `InfectionTrendReport`)

### 3. New PDF Templates (Optional Enhancement)

Create specialized PDF builders for high-priority operational reports:
- `src/lib/pdf/lineListingPdf.ts` - CDC-style line listing format
- `src/lib/pdf/overdueWorklistPdf.ts` - Action-oriented overdue items list

---

## Report Specifications

### ABT Days of Therapy Summary

**Purpose**: Track antibiotic stewardship metrics

**Headers**: Medication | Route | Active Courses | Total DOT | Avg DOT | Most Common Indication

**Data Source**: `db.records.abx` aggregated by medication

**Filters**: Date range, Unit

---

### Overdue Review Worklist

**Purpose**: Single consolidated view of all items requiring immediate attention

**Headers**: Type | Resident | Unit/Room | Item | Due Date | Days Overdue | Priority

**Data Sources**:
- ABT records with `nextReviewDate` < today
- IP cases with `nextReviewDate` < today  
- VAX records with status 'overdue'

**Sorting**: Priority (most overdue first)

---

### Unit Census & Precaution Summary

**Purpose**: Quick reference for charge nurses on unit status

**Headers**: Unit | Active Residents | On Precautions | On ABT | VAX Due | Notes (24h)

**Data Source**: Aggregated from census, IP cases, ABT, VAX, and notes

**Output**: One row per unit with counts

---

### Symptom Surveillance Log

**Purpose**: Early outbreak detection through symptom pattern tracking

**Headers**: Date | Resident | Unit/Room | Category | Symptoms | Notes | Follow-up Status

**Data Source**: `db.records.notes` with `symptoms` array

**Filters**: Date range, Symptom category (respiratory, GI, skin, UTI)

---

### Contact Tracing Report

**Purpose**: Document exposure tracking for outbreak investigation

**Headers**: Case Resident | Outbreak | Contact Name | Type | Exposure Date | Exposure Type | Follow-up Status

**Data Source**: `db.records.contacts` joined with `db.records.line_listings`

**Filters**: Outbreak selection, Date range

---

### Line Listing Export

**Purpose**: CDC-standard outbreak documentation

**Headers**: Case # | Room | Name | Unit | Onset Date | Symptoms | Lab Results | Outcome | Resolution Date

**Data Source**: `db.records.line_listings` filtered by outbreak

**Format**: Follows CDC line listing template structure

---

### Antibiotic Utilization Report

**Purpose**: QAPI/stewardship program metrics

**Sections**:
1. Summary metrics (total courses, DOT, rate per 100 residents)
2. Top 5 medications by usage
3. Indication distribution (pie chart data)
4. Route breakdown (IV vs PO)
5. Monthly trend data (line chart)

**Chart Data**: Similar to existing `TrendDataPoint` structure

---

### Monthly Infection Summary

**Purpose**: Executive overview of infection control program

**Sections**:
1. New infections this month vs previous
2. Infection rate per 100 residents
3. Breakdown by infection type
4. Resolution rate
5. Average days on precautions

**Chart Data**: Month-over-month comparison data

---

## File Changes Summary

| File | Changes |
|------|---------|
| `src/lib/reportGenerators.ts` | Add 8 new generator functions (~400 lines) |
| `src/components/views/ReportsView.tsx` | Add new reports to arrays, update switch statement (~80 lines) |
| `src/lib/pdf/lineListingPdf.ts` | New file - CDC line listing PDF template (~150 lines) |

---

## Implementation Order

1. **Core report generators** - Add all 8 new functions to `reportGenerators.ts`
2. **ReportsView integration** - Wire up new reports in the UI
3. **Testing** - Verify each report generates correctly with sample data
4. **PDF templates** - Add specialized PDF builders for line listing

---

## Technical Notes

- All new reports follow the existing `ReportData` interface structure
- Chart-based reports extend `InfectionTrendReport` pattern with `chartData` array
- Date filtering uses existing `date-fns` utilities already imported
- Unit filtering reuses existing pattern from `generateDailyPrecautionList`
- PDF generation uses existing jspdf/autotable infrastructure
