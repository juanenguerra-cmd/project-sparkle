# IP Tracker Review (Automation + Reliability)

Scope: static code review only (no behavior changes). Focused on IP Tracker workflows, data flow, reporting, persistence, and safety controls.

## A) IP Tracker Map

### Entry points and components
- `src/pages/Index.tsx` routes the `ip` view to `IPView` and passes optional status filters.  
- `src/components/views/IPView.tsx` is the main IP Tracker page (filters, table, add/edit/discharge/delete, CSV export, print filtered list, review modal launch).  
- `src/components/modals/IPCaseModal.tsx` handles IP case create/edit UI and save behavior.  
- `src/components/modals/IPReviewNoteModal.tsx` generates/saves review notes and can auto-resolve a case when review decision is discontinue.  
- `src/components/views/OutbreakView.tsx` owns outbreak line listing and contact tracing workflows (not directly embedded in IPView).

### Data model and storage
- Primary app DB shape includes `records.ip_cases`, `records.line_listings`, `records.contacts`, `records.outbreaks`, and `audit_log` in one local database object.  
- `src/lib/storage/index.ts` currently hard-wires localStorage adapter and comments that D1 has been removed.  
- `src/lib/database.ts` still contains D1-aware merge paths (`isD1Storage`, merge logic), but active adapter name is localStorage.

### IP-related APIs / D1 utilities
- No IP-specific Pages Functions route found. Only health endpoint exists at `functions/api/health/health.ts`.  
- D1 utility file exists (`workers/d1/d1Health.ts`) but is generic health/migration probing, not IP-specific persistence.

## B) Must-Fix Issues (bugs/data loss/security)

1. **Contact tracing fields in IP case modal are not persisted**  
   - Break: `staffAssignments`, `closeContacts`, `commonAreasVisited`, `sharedEquipment`, and `otherEquipment` are collected in UI but not written into `caseData` on save, causing silent data loss.  
   - Where: `src/components/modals/IPCaseModal.tsx` (form fields exist; `caseData` omits them).  
   - Fix direction: add typed fields to `IPCase` (or a linked table), persist in `caseData`, and include in export/report templates.

2. **No robust server-side source-of-truth for PHI data**  
   - Break: all IP records/audit data are persisted to browser localStorage by default; device loss/cache clear can remove documentation and PHI handling controls are browser-dependent.  
   - Where: `src/lib/storage/index.ts`, `src/lib/storage/localStorageAdapter.ts`.  
   - Fix direction: implement a real remote storage adapter for Cloudflare (Pages Functions + D1) with auth/session controls and encrypted transport.

3. **Review modal can only close (resolve) but lacks explicit reopen controls/workflow guardrails**  
   - Break: nurse can discontinue/resolve in review modal, but no explicit reopen action path in IP UI creates charting ambiguity and likely workaround edits.  
   - Where: `src/components/modals/IPReviewNoteModal.tsx`, `src/components/views/IPView.tsx`.  
   - Fix direction: add dedicated reopen action with required reason + audit metadata.

4. **Health endpoint can give false confidence for data path**  
   - Break: Pages Function returns static “OK” and does not validate app storage path, schema readiness, or write/read for IP data.  
   - Where: `functions/api/health/health.ts`.  
   - Fix direction: add storage-mode aware health checks and hard-fail when configured backend is unavailable.

## C) Workflow Friction (nurse experience)

- IP and outbreak/contact workflows are split across separate views (IPView vs OutbreakView), increasing context switching for “case-first” daily work.  
- IP modal requires manual “Apply PPE Rules” click instead of auto-deriving when precaution/isolation changes.  
- Important filter dimensions requested for practice use (organism, isolation type, outbreak) are not first-class filters in IPView; they’re only partially searchable free-text.  
- No explicit quick actions for close/reopen in one place with required rationale prompts.

## D) Missing Automation (highest impact)

### Auto-fill / derived fields
- Persist and auto-derive contact tracing payloads from IP case save event.
- Auto-apply PPE text whenever precaution/isolation changes (with nurse override).
- Derive outbreak suggestion linkage directly from IP case + date/unit clustering and offer one-click “Start outbreak + add line listing row”.

### Smart prompts / guardrails
- On resolve/discharge, require rationale and follow-up checks (terminal clean done, signage removed date, family/provider notification status).
- On duplicate active MRN + organism + close onset date, prompt merge/confirm to prevent duplicate case noise.

### One-click outputs
- One-click “IP packet” from IP screen (line listing + unit summary + active precautions + signatures).
- One-click “handoff print” that uses purpose-built print template, not generic table dump.

### Bulk actions
- Unit-level bulk updates for precaution defaults during an outbreak wave.
- Bulk review-date rescheduling and closure workflows with audit reasons.

## E) Reporting & Printing Gaps

- IPView print uses ad-hoc HTML `window.print()` table output, closer to screen export than formal template packet.
- Line listing generation is located in Reports/Outbreak flows, not directly case-first from IP tracker.
- Signature blocks (`Prepared by / Acknowledged by`) exist in report data types, but not uniformly surfaced from IPView one-click print/export paths.
- Line listing retrieval by outbreak currently returns all rows for outbreak id without visible de-dup logic in helper function.

## F) Compliance & Safety

- PHI at rest is localStorage by default; no role separation, no explicit auth boundaries in reviewed IP paths.
- Audit log exists and records many actions (`ip_add`, `ip_update`, `ip_delete`, `ip_review`, etc.), but user identity is generally optional and often not populated.
- Generated review note text includes strong clinical/regulatory assertions; app should clearly label as documentation support and require nurse verification before finalization.
- Add explicit UI disclaimer near automation outputs: “Clinical decision support only; nurse judgment required.”

## G) Quick Wins (≤2 hours)

1. Add missing persistence for IP contact tracing fields and show them in detail/exports.  
2. Auto-trigger PPE recommendation on precaution/isolation selection change.  
3. Add outbreak and isolation-type dropdown filters to IPView toolbar.  
4. Add explicit “Reopen Case” action with required reason and audit entry.

## H) Next Sprint Plan (1–2 weeks)

### Sprint group 1: Data integrity + source of truth
- Implement Cloudflare-backed storage adapter and API contracts for core records (`ip_cases`, `line_listings`, `contacts`, `audit_log`).
- Definition of Done: read/write parity tests vs local mode; migration toggle; recovery behavior documented.
- Regression risk: conflict resolution between cached local and remote state.

### Sprint group 2: Nurse workflow automation
- Merge case-first flow: from IP case -> optional outbreak create/select -> line listing row -> contacts in one guided stepper.
- Definition of Done: complete workflow in <= 1 modal path, fewer clicks, required data captured.
- Regression risk: over-constraining optional data entry for atypical scenarios.

### Sprint group 3: Reporting/printing readiness
- Add formal print templates for IP packet and line listing with signatures/date/time and filter metadata.
- Definition of Done: printable PDFs pass stakeholder checklist; no dependence on screen-layout print.
- Regression risk: formatting drift across browsers.

### Sprint group 4: Testing + health reliability
- Add unit tests for active counts/date math/filtering/dedupe/reopen logic.
- Add Playwright coverage for create/edit/resolve/reopen/filter/export/line listing/contact flows.
- Upgrade health checks to verify configured storage mode and write-read probes.
- Definition of Done: tests green in CI; health endpoint reflects real backend status.
- Regression risk: flaky e2e around async initialization if startup synchronization not stabilized.
