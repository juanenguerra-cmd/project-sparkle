
# Survey Mode - One-Click Printable Packs

## Overview

This implementation adds a dedicated **Survey Mode Panel** that provides one-click generation of comprehensive surveyor documentation packs. When activated, surveyors or infection control nurses can instantly generate pre-bundled PDF packets containing all required compliance documentation.

---

## Feature Design

### Survey Mode Panel Location
The Survey Mode Panel will be added to the **Reports View** as a prominent, collapsible section at the top. When "Surveyor Mode" is toggled ON in the header, this panel will be visually highlighted.

### One-Click Pack Buttons

| Pack Name | Contents | Time Period |
|-----------|----------|-------------|
| **Audit & Compliance Pack** | Hand Hygiene Report + PPE/EBP Audits + Room Check Template + Corrections Log | Last 14 days |
| **Active ABT Pack** | Active Antibiotics List + Time-out Reviews Due + Stewardship Summary | Current |
| **Precautions Roster Pack** | Active Precautions by Unit + Daily Precaution List + IP Worklist | Current |
| **Vaccination Pack** | Vaccination Coverage by Type + Due/Overdue List + Declination Summary | Current |
| **Complete Survey Pack** | All of the above combined | Mixed |

---

## Technical Implementation

### New Components

**`src/components/reports/SurveyModePanel.tsx`**
- Dedicated panel for survey pack generation
- Date range selector defaulting to last 14 days
- One-click buttons for each pack type
- Visual feedback during generation (loading state)
- Downloads combined PDF or opens print dialog

### Report Generator Updates

**`src/lib/reportGenerators.ts`** - New functions:
- `generateActiveABTList()` - Current active antibiotics with all stewardship fields
- `generateTimeoutDueList()` - ABT courses needing 48-72h review
- `generateRoomCheckTemplate()` - Printable unit room-by-room checklist
- `generateCorrectionsLog()` - Template for documenting audit corrections

### PDF Bundle Builder

**`src/lib/pdf/surveyPackPdf.ts`** - New file:
- `buildSurveyAuditPack()` - Combines HH + PPE + Room Check reports
- `buildActiveABTPack()` - Combines ABT list + timeout due
- `buildPrecautionsPack()` - Combines precautions roster + daily list
- `buildVaccinationPack()` - Combines coverage + due list
- `buildCompleteSurveyPack()` - All reports in one PDF with section dividers

---

## UI Changes

### Reports View Updates

```text
+--------------------------------------------------+
| SURVEY MODE QUICK PACKS                          |
| Last 14 days: [Date Picker] to [Today]           |
+--------------------------------------------------+
|                                                  |
| [Audit Pack]  [ABT Pack]  [Precautions]  [VAX]   |
|                                                  |
| [Complete Survey Pack - All Reports]             |
|                                                  |
+--------------------------------------------------+
```

### Pack Contents Preview

Each button shows a tooltip or expandable list of included reports:

**Audit & Compliance Pack:**
- Hand Hygiene Compliance Report (CDC 5 Moments)
- PPE Usage & Compliance Tracking
- Room Check Template by Unit
- Audit Corrections Log Template

**Active ABT Pack:**
- Active Antibiotics List (current)
- ABT Time-out Review Due List
- Missing Indications Report
- Missing Stop Dates Report

**Precautions Roster Pack:**
- Active Precautions by Unit
- Daily Precaution List
- Daily IP Worklist
- EBP Eligibility Review

**Vaccination Pack:**
- Vaccination Coverage Summary
- Due/Overdue List
- Declination Summary
- Re-offer List (30/180 day cadence)

---

## File Changes Summary

```text
NEW FILES:
- src/components/reports/SurveyModePanel.tsx  - Survey pack UI component
- src/lib/pdf/surveyPackPdf.ts               - Multi-report PDF bundler

MODIFIED FILES:
- src/components/views/ReportsView.tsx       - Add SurveyModePanel at top
- src/lib/reportGenerators.ts               - Add new report generators
- src/lib/reportDescriptions.ts             - Add descriptions for new reports
```

---

## Implementation Details

### SurveyModePanel Component

```typescript
// Key features:
- Date range defaulting to last 14 days (subDays(new Date(), 14))
- Loading state management for each pack button
- Toast notifications on generation completion
- Auto-download PDF with timestamped filename
- Responsive grid layout for pack buttons
```

### PDF Bundle Structure

Each bundled PDF includes:
1. **Cover Page** - Pack title, date range, facility name
2. **Table of Contents** - List of included reports
3. **Section Dividers** - Color-coded for easy navigation
4. **Individual Reports** - Full content with headers repeated on page breaks
5. **Page Numbering** - "Page X of Y" footer

### New Report Generators

**generateActiveABTList():**
- All active ABT records with complete stewardship data
- Sorted by start date (newest first)
- Columns: Resident, Medication, Dose, Route, Indication, Start, Planned Stop, Days, Notes

**generateTimeoutDueList():**
- ABT courses where startDate + 72h < today and no timeout review documented
- Columns: Resident, Medication, Start, Review Due, Days Overdue, Status

**generateRoomCheckTemplate():**
- Grid layout by unit with room numbers
- Checkboxes for: Signage Posted, Supplies Stocked, PPE Available
- Signature/date lines

**generateCorrectionsLog():**
- Template for documenting audit findings and corrective actions
- Columns: Date, Finding, Correction, Responsible Party, Due Date, Status

---

## User Experience Flow

1. User toggles "Surveyor: On" in app header (visual indicator)
2. Navigates to Reports view
3. Survey Mode Quick Packs section is prominently displayed
4. User selects date range (defaults to last 14 days)
5. Clicks desired pack button (e.g., "Complete Survey Pack")
6. Loading spinner shows during generation
7. PDF downloads automatically with filename like `Survey_Complete_Pack_2026-01-29.pdf`
8. Toast confirms: "Survey pack generated with 12 reports"

---

## Testing Checklist

After implementation:
- [ ] Generate each pack type individually
- [ ] Verify all reports included in Complete Survey Pack
- [ ] Confirm page breaks work correctly with repeated headers
- [ ] Test date range filter affects relevant reports (audits)
- [ ] Verify PDF downloads with correct filename
- [ ] Check pack generation with empty data (no active ABT, etc.)
- [ ] Test print dialog opens correctly for each pack
