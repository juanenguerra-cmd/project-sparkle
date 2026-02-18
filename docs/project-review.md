# Project Sparkle Review (Repository Baseline)

## Scope

This review documents the current repository state with a focus on architecture, code quality signals, and the lint baseline.

## High-level architecture

- **Framework/runtime**: Vite + React + TypeScript app with Tailwind and shadcn UI patterns.
- **Routing/auth shell**: `src/App.tsx` wraps app providers (React Query, tooltip/toast systems, error boundary) and routes users through protected routes based on auth state.
- **Domain organization**:
  - `src/components/*` for UI and feature-level presentation.
  - `src/lib/*` for business logic, storage, analytics, export/report logic, and typed models.
  - `src/pages/*` and `src/pages/reports/*` for top-level screens.
  - `src/__tests__` and `src/test` for integration/unit and focused report/metric tests.

## Lint baseline (explicit run)

Command run:

```bash
npm run lint
```

Outcome:

- Command exits non-zero because the repository currently has a large backlog of lint violations.
- Current ESLint totals: **932 errors** and **392 warnings** across **269 files**.

Top recurring rules by volume:

1. `curly` — 701
2. `@typescript-eslint/no-explicit-any` — 145
3. `@typescript-eslint/no-unused-vars` — 97
4. `@typescript-eslint/consistent-type-imports` — 82
5. `complexity` — 80
6. `max-len` — 59
7. `max-lines` — 44

## Observations

- The lint backlog is broad and systemic, not isolated to one feature area.
- The most dominant issue (`curly`) is largely autofixable and likely the fastest path to reducing hard errors.
- Type-quality rules (`no-explicit-any`, `consistent-type-imports`) indicate opportunities for stronger type guarantees over time.
- Complexity/size warnings suggest a subset of large components/functions that would benefit from decomposition.

## Suggested remediation strategy

1. **Stabilize CI posture**
   - Keep current lint run as informational until error volume is reduced.
   - Track baseline counts so progress can be measured per PR.
2. **Run safe autofixes first**
   - Apply `eslint --fix` in controlled batches and review behavior-preserving diffs.
3. **Rule-family cleanup in waves**
   - Wave 1: `curly`, `consistent-type-imports`, easy unused vars.
   - Wave 2: `no-explicit-any` for core/shared lib modules.
   - Wave 3: complexity/max-lines refactors for hotspots.
4. **Prevent regression**
   - Add/retain PR checks that prevent new violations above the moving baseline.

## Notes

- This review intentionally does not claim lint was fixed; it captures and documents the current baseline so clean-up can be executed incrementally.
