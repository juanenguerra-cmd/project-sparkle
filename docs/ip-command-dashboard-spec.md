# IP Command Dashboard Spec

## Objective
Implement an **IP Command Dashboard** that assembles binder-ready packets by reusing existing report renderers and packet utilities.

## Reuse-first architecture
- **Existing report sources**: `src/lib/reportGenerators.ts`, `src/lib/reports/surveillanceReports.ts`
- **Existing packet/PDF assembly**: `src/lib/pdf/surveyPackPdf.ts`, `src/lib/pdf/surveyorPacketPdf.ts`, `src/lib/pdf/binderPdf.ts`, `src/lib/pdf/universalPdfGenerator.ts`
- **Existing report shell**: `src/components/views/ReportsView.tsx`

No duplicate report pages/components should be introduced; the dashboard is an orchestration layer over the current report stack.

## Core modules

### 1) Packet Builder
Packet presets:
- Survey Entrance
- Monthly
- Outbreak
- Unit Pull
- Custom

Each preset resolves to a list of evidence object IDs plus filters:
- date range
- unit
- optional resident

### 2) Readiness Check Engine
Runs preflight validation before packet build:
- hard errors (missing required denominator/date window)
- warnings (incomplete optional fields)

Outputs:
- readiness score
- validation list
- generated **Data Gaps** section page for packet inclusion

### 3) Packet Assembly
Assemble sections in this order:
1. Cover
2. Table of Contents
3. Section dividers (domain)
4. Evidence report pages
5. Data Gaps page
6. Appendices

### 4) Audit Trail
Persist packet build history with:
- `packet_id`
- timestamp
- actor/user
- filter payload
- included evidence object IDs + versions
- readiness results summary

Recommended persistence target: existing app DB/audit layer (`src/lib/audit.ts` + `src/lib/types.ts`) with backward-compatible additions.

## Evidence-object contract

```ts
interface EvidenceObject {
  id: string;                // stable ID (e.g., "surv_trend")
  title: string;
  domain: 'surveillance' | 'outbreak' | 'stewardship' | 'immunization' | 'communication';
  generator: (filters: EvidenceFilters) => Promise<ReportOutput> | ReportOutput;
  supports: {
    dateRange: boolean;
    unit: boolean;
    residentOptional: boolean;
    print: boolean;
    exportCsv: boolean;
  };
  requiredFields?: string[]; // readiness validation
  version: string;           // contract version for audit trail
}

interface EvidenceFilters {
  fromDate?: string;
  toDate?: string;
  unit?: string;
  residentId?: string;
}
```

## Readiness issue contract

```ts
interface ReadinessIssue {
  severity: 'error' | 'warning';
  code: string;
  message: string;
  evidenceId?: string;
  hint?: string;
}
```

## Packet audit contract

```ts
interface PacketAuditTrail {
  packet_id: string;
  created_at: string;
  actor: string;
  preset: 'survey_entrance' | 'monthly' | 'outbreak' | 'unit_pull' | 'custom';
  filters: EvidenceFilters;
  included_evidence: Array<{ id: string; version: string }>;
  readiness: { errors: number; warnings: number };
}
```

## Process flow
1. User opens Reports > IP Command Dashboard.
2. Select preset and filters.
3. Run readiness check.
4. Review data gaps and fix/continue.
5. Build packet (cover/TOC/dividers/evidence/appendices).
6. Print/export and write audit trail record.

## Non-goals
- No duplicate data-entry pages.
- No separate report renderer stack.
- No replacement of existing report generation functions.
