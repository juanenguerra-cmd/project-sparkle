# Implementation Prompts for Workflow Streamlining Plan

Use these prompts directly with your coding assistant (one prompt per sprint chunk). Each prompt is designed to produce shippable code with tests, acceptance criteria, and minimal rework.

## Prompt 0 — Baseline instrumentation (run first)

```text
You are implementing workflow-efficiency telemetry in Project Sparkle.

Goal:
Add lightweight instrumentation so we can measure click reduction and flow efficiency before/after UX changes.

Requirements:
1) Add a metrics helper in `src/lib/analytics/workflowMetrics.ts` to record:
   - `eventName`
   - `view`
   - `residentId or mrn` (optional)
   - timestamp
   - metadata (small object)
2) Persist metrics to local DB structure safely (non-breaking migration if needed).
3) Add instrumentation calls to:
   - IP/ABT/VAX modal open
   - resident selected
   - save success
   - report quick-run executed
4) Add a function to compute:
   - median clicks per completed case (IP/ABT/VAX)
   - median time from resident select -> save
5) Create unit tests for metrics calculation and persistence logic.
6) Keep UI unchanged except non-intrusive hooks.

Definition of done:
- `npm test` passes for new tests.
- No TypeScript errors in touched files.
- Existing behavior remains unchanged.
```

---

## Prompt 1 — Shared resident picker + dedupe removal

```text
Implement a reusable resident selection component and remove duplicated resident-selection logic from ABT/IP/VAX modals.

Current issue:
ABT/IP/VAX each implement separate resident search + selected resident state + demographic propagation.

Tasks:
1) Create `src/components/shared/ResidentContextPicker.tsx`:
   - search by name/mrn
   - emits selected resident
   - supports optional default resident
2) Create shared hook `src/hooks/useResidentContext.ts`:
   - selected resident state
   - helper to map resident fields (mrn, name, unit, room, dob)
3) Refactor:
   - `src/components/modals/ABTCaseModal.tsx`
   - `src/components/modals/IPCaseModal.tsx`
   - `src/components/modals/VAXCaseModal.tsx`
   to use shared picker/hook.
4) Preserve all existing validation and save behavior.
5) Add tests for hook behavior and one modal integration path.

Acceptance criteria:
- Resident selection behavior is identical or better.
- At least 30% reduction in duplicated resident-selection code lines across the 3 modals.
- No regressions in save/edit flow.
```

---

## Prompt 2 — Resident-first quick actions drawer

```text
Implement a resident-first Quick Actions drawer to reduce navigation and clicking.

Objective:
Allow user to pick a resident once and launch IP/ABT/VAX/Outbreak/Note tasks from one place.

Tasks:
1) Add `QuickActionsDrawer` component with:
   - resident selector (reuse ResidentContextPicker)
   - action chips/buttons: IP, ABT, VAX, Outbreak, Note
2) Add launcher button in app header and dashboard.
3) Integrate with existing navigation in `src/pages/Index.tsx`:
   - route to target view
   - open corresponding modal prefilled with selected resident context
4) Ensure mobile compatibility with existing `MobileNav`.
5) Track telemetry events (from Prompt 0 infra).

Acceptance criteria:
- User can complete resident selection once and open any action modal prefilled.
- End-to-end manual test: quick action to save IP case with no extra resident re-selection.
- No breaking changes to existing navigation.
```

---

## Prompt 3 — Case journey stepper (IP -> outbreak -> line listing)

```text
Implement a guided case journey for infection workflows.

Flow:
After saving an IP case, prompt user with a stepper:
1) link/create outbreak
2) add line listing row
3) schedule follow-up/review

Tasks:
1) Add `CaseJourneyStepper` modal/component.
2) Trigger it after successful IP case save (feature-flagged setting).
3) Add one-click actions:
   - "Create outbreak and link"
   - "Add to existing outbreak"
   - "Create line listing now"
   - "Skip for now"
4) Add audit events for each step choice.
5) Add tests for step transitions and data linkage integrity.

Acceptance criteria:
- New flow is optional and does not block core save.
- Outbreak linkage + line listing creation can be completed in one guided path.
- Audit entries clearly describe decisions.
```

---

## Prompt 4 — Quick-run reports in operational views

```text
Add one-click report generation directly from IP/ABT/Outbreak views.

Objective:
Reduce context switch to full Reports page for common outputs.

Tasks:
1) Add "Quick Run Reports" section to:
   - IPView
   - ABTView
   - OutbreakView
2) Include context-aware presets:
   - IP: Daily Precaution List, IP Worklist, Active Precautions by Unit
   - ABT: ABT Worklist, Antibiotic Duration Summary
   - Outbreak: Line Listing Packet, Exposure Log
3) Reuse existing report generator functions and export handler.
4) Pre-apply current view filters where relevant.
5) Emit telemetry for each quick-run action.

Acceptance criteria:
- Report generation works without opening ReportsView.
- Output data matches ReportsView equivalent with same filters.
- No duplicated report logic (reuse existing generators).
```

---

## Prompt 5 — Closure/reopen guardrails + completeness checker

```text
Implement stronger safety guardrails for case closure/reopen.

Tasks:
1) Add required rationale modal for:
   - resolve/close
   - reopen
   - delete/discontinue actions
2) Add `completenessCheck` utility for IP/ABT/VAX with configurable required fields.
3) Before close/resolve, show checklist summary:
   - missing critical fields
   - optional warnings
4) Write rationale + checklist outcome into audit log entries.
5) Add tests for:
   - blocked close when critical fields missing
   - successful close with rationale
   - reopen with rationale recorded

Acceptance criteria:
- Sensitive lifecycle actions always include rationale.
- Audit trail captures who/what/why and checklist status.
- Minimal extra clicks (single modal with checklist + rationale).
```

---

## Prompt 6 — Storage reliability upgrade (remote adapter)

```text
Implement a remote-backed storage adapter while preserving local fallback.

Tasks:
1) Create storage abstraction extension:
   - local adapter (existing)
   - remote adapter (Cloudflare/D1 API-backed)
   - sync status state (online/offline/pending)
2) Add queue for offline writes and replay on reconnect.
3) Add health probe endpoint checks for read/write readiness.
4) Add conflict strategy (last-write-wins + audit note, or explicit merge prompt).
5) Add integration tests for:
   - offline write then replay
   - adapter switch
   - write/read parity for core records

Acceptance criteria:
- App remains usable offline.
- Sync state visible in UI.
- No data loss during adapter transitions in tested paths.
```

---

## Prompt 7 — Survey “one-click packet” mode

```text
Implement Survey Now mode for rapid readiness output.

Tasks:
1) Add "Survey Now" action in header.
2) Generate packet bundle in one flow:
   - surveyor packet
   - active IP/ABT/VAX snapshots
   - line listing
   - last 7 days activity log
3) Apply redaction profile toggle (internal/surveyor/qapi).
4) Add readiness checklist panel showing missing data gaps.
5) Add tests for packet generation and profile redaction correctness.

Acceptance criteria:
- Survey packet generation is executable in <= 2 user actions.
- Redaction profile output matches policy definitions.
- Readiness checklist accurately flags missing prerequisites.
```

---

## Prompt 8 — Hardening and rollout

```text
Prepare workflow streamlining features for staged rollout.

Tasks:
1) Add feature flags for major additions:
   - quick actions drawer
   - case journey stepper
   - quick-run reports
   - closure checklist
2) Add migration notes and admin settings toggles.
3) Add regression suite for:
   - create/edit/delete across IP/ABT/VAX
   - quick action launch flows
   - report parity checks
4) Add release notes section and short in-app training tips.

Acceptance criteria:
- Each feature can be enabled/disabled independently.
- Core workflows stable with flags off.
- Rollout plan documented.
```

---

## Recommended execution order
1. Prompt 0 (instrumentation baseline)
2. Prompt 1 (shared picker dedupe)
3. Prompt 2 (quick actions drawer)
4. Prompt 4 (quick-run reports)
5. Prompt 5 (guardrails)
6. Prompt 3 (case journey stepper)
7. Prompt 6 (remote adapter)
8. Prompt 7 (survey now)
9. Prompt 8 (rollout hardening)

This order gives early UX wins, measurable impact, then deeper architecture work.
