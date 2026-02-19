# Infection Prevention & Stewardship Reports Audit

## 1) EXISTING FEATURES

### Navigation / report access points (existing)
- Main app routes are view-based (`activeView`) and already include `ip`, `abt`, `vax`, `outbreak`, and `reports`, so there is an existing Reports entry point to extend (no new top-level route required).  
  - Files: `src/pages/Index.tsx`, `src/components/layout/Sidebar.tsx`, `src/components/layout/MobileNav.tsx`

### Existing data-entry surfaces
- **Infection Prevention (IP) case entry/edit** exists via modal and tracker page. Includes core infection metadata, precaution type, organism, NHSN code, and HAI flags (`CAUTI`, `CLABSI`, `MDRO`) with device-associated toggles and dates.  
  - Files: `src/components/views/IPView.tsx`, `src/components/modals/IPCaseModal.tsx`, `src/lib/types.ts`
- **Outbreak + line listing + contact tracing** exists with outbreak creation, outbreak case entry, and contact entry workflows.  
  - Files: `src/components/views/OutbreakView.tsx`, `src/components/modals/LineListingCaseModal.tsx`, `src/lib/types.ts`
- **Antibiotic stewardship entry** exists via ABT management, with stewardship fields (prescriber, indication, culture-reviewed metadata, timeout fields, risk notes).  
  - Files: `src/components/views/ABTView.tsx`, `src/lib/types.ts`
- **Vaccination entry** exists for residents, with due/given/declined tracking, education/offer workflow, and re-offer helpers. Staff vaccination has dedicated page and helpers.  
  - Files: `src/components/views/VAXView.tsx`, `src/pages/StaffVaccinationTrackerPage.tsx`, `src/lib/reports/staffVaccinationRows.ts`, `src/lib/types.ts`

### Existing report generation capabilities
- Existing report generator module already provides many report outputs (daily precaution list, IP worklist, outbreak summary, ABT monthly/compliance, vax snapshot/re-offer, survey packets, binder report, hand hygiene/PPE, etc.).  
  - File: `src/lib/reportGenerators.ts`
- Existing surveillance report module includes infection surveillance trend/rates and device-associated tracking calculations with date windows and metric helpers.  
  - File: `src/lib/reports/surveillanceReports.ts`
- Existing Daily IP Binder page/report is implemented and already sections surveillance-like operational data into printable format.  
  - Files: `src/pages/reports/DailyIpBinderReport.tsx`, `src/lib/reports/useDailyIpBinderData.ts`

### Existing export / print / packet utilities
- CSV utility layer exists (`convertToCSV`, `downloadCSV`, parser) and domain-specific CSV services already exist for IP and VAX import/export.  
  - Files: `src/lib/utils/csvUtils.ts`, `src/lib/utils/ipCsvService.ts`, `src/lib/utils/vaxCsvService.ts`, `src/lib/utils/exportReofferReport.ts`
- PDF generation utilities already exist for report output and packets (line listing, daily precautions, survey packet, binder, universal PDF).  
  - Files: `src/lib/pdf/lineListingPdf.ts`, `src/lib/pdf/surveyorPacketPdf.ts`, `src/lib/pdf/dailyPrecautionListPdf.ts`, `src/lib/pdf/binderPdf.ts`, `src/lib/pdf/universalPdfGenerator.ts`
- DOCX export utilities exist for QAPI reporting.  
  - File: `src/lib/docx/qapiDocx.ts`

### Existing reusable UI components/patterns
- Reports list/preview components and filter controls exist and should be reused.  
  - Files: `src/components/views/ReportsView.tsx`, `src/components/reports/ReportListItem.tsx`, `src/components/reports/ReportPreview.tsx`
- Existing filter widgets and standard controls (`Input type=date`, `Select`, `Checkbox`, etc.) are already in use across report and tracker views.  
  - Files: `src/components/views/ReportsView.tsx`, `src/components/views/IPView.tsx`, `src/components/views/ABTView.tsx`, `src/components/views/VAXView.tsx`

## 2) PARTIALLY IMPLEMENTED FEATURES

1. **Reports Hub exists but is incomplete for current objective**
   - What exists: a Reports view with surveillance list scaffolding and preview/export infrastructure.
   - Missing: comprehensive sectioned hub for all required domains (Surveillance, Outbreak Management, Stewardship, Immunization, Communication Logs) with explicit “Enter Data” and “Help: How to Extract” links per report.
   - File: `src/components/views/ReportsView.tsx`

2. **Surveillance reporting is present but unevenly wired**
   - What exists: surveillance generators include trends/rates/device-associated calculations.
   - Missing: complete in-UI generation wiring for all listed surveillance report types and consistent resident/unit/date filtering pattern on every required report.
   - Files: `src/lib/reports/surveillanceReports.ts`, `src/components/views/ReportsView.tsx`

3. **Device-associated capture exists but not full CAUTI/CLABSI domain completeness**
   - What exists: HAI type, device-associated boolean, device type, event/specimen dates, lab-confirmed status.
   - Missing: insertion/removal date pair, indication, maintenance audits, criteria-met flag, attribution notes as first-class structured fields.
   - Files: `src/components/modals/IPCaseModal.tsx`, `src/lib/types.ts`

4. **Outbreak management exists but lacks structured process artifacts**
   - What exists: outbreak creation, line listing, contact tracing, statuses.
   - Missing: structured testing logs (staff+resident), cohorting plan record, escalation action log, clearance criteria documentation, after-action review (AAR) model/report.
   - Files: `src/components/views/OutbreakView.tsx`, `src/lib/types.ts`

5. **Stewardship tracking exists but not complete for requested audits**
   - What exists: ABT course + indication + start/stop + prescriber + route + culture/timeout fields.
   - Missing: explicit culture linkage entity references and dedicated indication-audit/time-out report surfaces.
   - Files: `src/components/views/ABTView.tsx`, `src/lib/types.ts`, `src/lib/reportGenerators.ts`

6. **Immunization tracking exists but requested program-level slices are incomplete**
   - What exists: resident vaccination and staff-vaccination support, declines and education workflows.
   - Missing: explicit consented/vaccinated report variant, annual flu campaign summary report workflow (single destination report with extraction instructions).
   - Files: `src/components/views/VAXView.tsx`, `src/pages/StaffVaccinationTrackerPage.tsx`, `src/lib/reportGenerators.ts`

7. **Communication logging not modeled as dedicated domain**
   - What exists: general notes and audit log records.
   - Missing: communication log schema with category/contact/method/summary/linked outbreak and dedicated public-health communication report.
   - Files: `src/lib/types.ts`, `src/components/views/NotesView.tsx`, `src/lib/reportGenerators.ts`

## 3) MISSING FEATURES

- Dedicated structured data models + entry surfaces for:
  - Device event detail fields (insertion/removal, indication, maintenance audit, criteria-met, attribution notes)
  - MDRO-specific structured tracking fields (specimen date, site, colonization vs infection, precaution status, clearance status)
  - Outbreak testing logs, cohorting plan, escalation actions, clearance criteria doc, AAR
  - Communication logs (public health/family/provider/internal)
- Required report pages/outputs not currently explicit end-to-end in hub:
  - Monthly infection surveillance logs
  - Active + historical line listing report variants
  - Outbreak epidemic curves and testing log reports
  - Cohorting plan/map report
  - Isolation expansion strategy action-log report
  - Clearance criteria and AAR reports
  - Public-health communication report
  - Benchmark comparison report and NHSN submission tracking report (if feature-flag enabled)
- Per-report parity requirements not yet universal:
  - date range filter
  - unit filter
  - optional resident filter
  - print view
  - CSV export

## 4) DUPLICATION PREVENTION PLAN

### Reuse-first strategy (explicit)
1. **Reuse existing Reports entry point** (`src/components/views/ReportsView.tsx`) and extend sections; do **not** create a second reports shell/page.
2. **Reuse existing DB record collections and types** (`ip_cases`, `abx`, `vax`, `outbreaks`, `line_listings`, `contacts`, `notes`) and add backward-compatible fields/interfaces only.
3. **Reuse existing export/print toolchain** (`csvUtils`, existing CSV services, PDF generators, `ReportPreview`) and extend it for missing report types.
4. **Reuse existing tracker pages/modals** (`IPView`, `ABTView`, `VAXView`, `OutbreakView`) by extending forms where required, instead of creating duplicate entry pages.
5. **Reuse existing filtering control patterns** (date inputs + select + in-memory filters) so new reports match current UX.

### Explicit no-duplication statement
- No duplicate pages, routes, tables, data models, or report components will be created. Missing capability will be delivered by extending current modules and adding only minimal new domain models where no equivalent structure currently exists.

---

## 5) PHASE 1 REUSE & EXTENSION MAPPING

| Required report/domain | Current status | Action |
|---|---|---|
| Monthly infection surveillance logs | Partial (surveillance generators exist) | Extend existing surveillance generator + ReportsView wiring |
| Line listings (active + historical) | Partial (line listing data exists) | Add dedicated active/historical report outputs using existing line_listings |
| Infection rate reports (monthly/quarterly) | Partial | Reuse surveillance metrics and add UI/report variants |
| Trend analyses and graphs | Existing | Reuse `generateInfectionTrends` + chart components |
| Device-associated infection tracking | Existing/Partial | Reuse current report and extend fields/filters |
| MDRO tracking log | Partial | Extend IP/MDRO schema and add MDRO-specific report |
| NHSN submission tracking (if enabled) | Missing | New report module (feature-gated) reusing existing report framework |
| Benchmark comparisons | Partial | Extend surveillance metrics output with benchmark sections |
| Active/recent outbreak documentation | Partial | Extend outbreak summary output |
| Outbreak line listings | Existing/Partial | Reuse line listing dataset + add report variants |
| Epidemic curves | Missing | New report visualization using outbreak/line-list data |
| Testing logs | Missing | Add outbreak testing log model + report |
| Cohorting plans/maps | Missing/Partial | Add cohorting model + report; reuse heatmap/chart components where possible |
| Isolation expansion strategy action logs | Missing | Add structured outbreak action-log model + report |
| Communication with health authorities | Missing | Add communication log model + report |
| Clearance criteria documentation | Missing | Add outbreak clearance-criteria model + report |
| After-Action Review reports | Missing | Add AAR model + report |
| Stewardship summary | Existing/Partial | Reuse ABT reports; extend summary content |
| Utilization reports | Existing/Partial | Reuse monthly ABT + AUR; add missing views |
| Active antibiotics list | Existing | Reuse ABT worklist/report |
| Culture & sensitivity tracking | Partial | Extend ABT linkage/reporting fields |
| Indication audits | Partial | Add dedicated indication audit report from ABT data |
| Antibiotic time-out documentation | Partial | Add dedicated timeout report from existing timeout fields |
| Resident vaccination rates | Existing/Partial | Reuse VAX data + add focused report view |
| Staff vaccination rates | Existing/Partial | Reuse staff vaccination rows + add report output |
| Declination reports | Existing/Partial | Reuse VAX declined + reoffer data |
| Consented/vaccinated reports | Missing/Partial | Add report variant; reuse vax education/offer data |
| Annual influenza summary | Partial | Add annual rollup report from VAX + staff vax data |
| Public health authority communication report | Missing | New report based on new communication log domain |

