# IP Reports Capability Audit (Phase 0)

## Scope and method
This audit was completed before implementation to prevent duplication. The codebase was scanned for routes/pages, models, report generators, and print/export flows.

### Search commands used
- `rg -n "reports|surveillance|line list|line-list|outbreak|antibiotic|\babx\b|vaccin|nhsn|mdro|device|cauti|clabsi|heatmap|epi curve|export|print|packet" src docs public`
- `rg -n "activeView|ReportsView|generate.*Report|downloadCSV|jsPDF|Docx|survey|binder" src`

## Already exists
- Reports entry surface (`activeView='reports'`) and reports shell in `ReportsView`.  
  Evidence: `src/pages/Index.tsx`, `src/components/views/ReportsView.tsx`
- Data-entry domains for IP, ABT, VAX, Outbreak, line listings, and staff vaccination.  
  Evidence: `src/components/views/IPView.tsx`, `src/components/views/ABTView.tsx`, `src/components/views/VAXView.tsx`, `src/components/views/OutbreakView.tsx`, `src/pages/StaffVaccinationTrackerPage.tsx`
- Report generators and surveillance calculators already present.  
  Evidence: `src/lib/reportGenerators.ts`, `src/lib/reports/surveillanceReports.ts`
- Existing print/export stack for CSV/PDF/DOCX.  
  Evidence: `src/lib/utils/csvUtils.ts`, `src/lib/pdf/*.ts`, `src/lib/docx/qapiDocx.ts`

## Partially exists
- Reports hub sections are present but not fully mapped to every requested report package.
- Some report variants exist in generators but are not fully surfaced with consistent filter + print + CSV parity.
- Outbreak/testing/cohorting/communication/clearance/AAR structured models are incomplete as dedicated first-class entities.

## Missing
- Fully normalized communication log model + dedicated public-health communication reporting view.
- Complete outbreak readiness artifacts (testing logs, cohorting plan report, clearance criteria, AAR) surfaced end-to-end.
- Explicit NHSN submission tracking report workflow (if enabled by org config).

## Duplication prevention plan
- Reuse existing `ReportsView` (do not create duplicate report hub page).
- Extend existing record stores in `src/lib/types.ts` and existing view/modals in-place.
- Reuse existing report generator/export primitives (`reportGenerators`, CSV utils, PDF builders).
- Do not create duplicate route/page/component for report types that already exist.

## Capability Check Table (mandatory)

| Capability / Report Name | Requirement Status | Evidence (file paths, route, symbols) | Notes |
|---|---|---|---|
| Reports hub entry | DONE (existing) | `src/pages/Index.tsx` (`activeView='reports'`), `src/components/views/ReportsView.tsx` | Extend in-place only if needed. |
| Infection surveillance trend/rates | EXTEND (existing) | `src/lib/reports/surveillanceReports.ts` (`generateInfectionSurveillanceTrend`, `generateInfectionRatePer1000Days`) | Generators exist; parity wiring/UX can be extended. |
| Device-associated infection report | DONE (existing) | `generateDeviceAssociatedInfectionReport` in `src/lib/reports/surveillanceReports.ts`; rendered from `ReportsView` | Already implemented and wired. |
| Outbreak line listing | EXTEND (existing) | `src/components/views/OutbreakView.tsx`, `src/components/modals/LineListingCaseModal.tsx`, `src/lib/pdf/lineListingPdf.ts` | Data + PDF exist; broader report variants can extend current pipeline. |
| ABT stewardship reports | EXTEND (existing) | `src/lib/reportGenerators.ts` (`generateMonthlyABTReport`, `generateMedicareABTComplianceReport`) | Add any missing slices in existing generator module. |
| Vaccination reports (resident/staff/declination) | EXTEND (existing) | `src/components/views/VAXView.tsx`, `src/pages/StaffVaccinationTrackerPage.tsx`, `src/lib/reports/staffVaccinationRows.ts` | Existing foundations; ensure parity filters/export on all required variants. |
| Print support | DONE (existing) | `src/lib/pdf/*`, `src/components/reports/ReportPreview.tsx`, jsPDF usage in `ReportsView` | Reuse existing print/PDF primitives. |
| CSV export support | DONE (existing) | `src/lib/utils/csvUtils.ts`, domain CSV utilities in `src/lib/utils/` | Reuse existing CSV exporter. |
| Packet generation (survey/binder) | DONE (existing) | `src/lib/pdf/surveyPackPdf.ts`, `src/lib/pdf/surveyorPacketPdf.ts`, `src/lib/pdf/binderPdf.ts` | Reuse existing packet assembly pieces. |
| Communication logs report | BUILD (new) | Existing notes only (`src/components/views/NotesView.tsx`) | No dedicated structured communication report domain found. |
