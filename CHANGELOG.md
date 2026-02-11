## 2026-02-11

- Added regulatory mapping constants for F880, F881, F883, and F887 with CMS-20054/42 CFR references.
- Introduced data-model backbone migration from MRN-keyed resident records to canonical residentId mapping with idempotent migration audit.
- Added centralized surveillance metrics definitions and shared calculation helpers (resident-days, ABT starts, DOT, AUR, infection rate/1000).
- Added outbreak lifecycle transitions (watch/active/resolved), export redaction profiles, and role-aware security helpers.
- Updated Settings with a collapsed Regulatory References panel and refreshed vaccine labeling for Flu/COVID/Pneumo.
- Added unit/integration tests for metrics, migration, outbreak transitions, and surveyor redaction behavior.
