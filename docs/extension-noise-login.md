# /login Chrome Extension Noise Audit & Hardening

## Phase 0 — Capability Check (mandatory)

### Repository search commands used
- `rg -n "chrome-extension://|web_accessible_resources|manifest\.json|import\(|webpackIgnore|createElement\(['\" ]script|appendChild\(.*script|localStorage|sessionStorage" src public docs index.html vite.config.ts`
- `rg -n "chrome-extension://|moz-extension://|safari-extension://|Failed to fetch dynamically imported module|webpackIgnore" src public`

### Findings
- No application source files reference `chrome-extension://`, `web_accessible_resources`, or extension `manifest.json` loading.
- No app-side dynamic `import(/* webpackIgnore */ url)` patterns were found.
- Script injection exists in analytics bootstrap (`src/lib/analytics.ts`) for Google Analytics, but URL is static and not extension-scheme based.

### Conclusion
**Not caused by app; caused by external Chrome extension injection.**

The `/login` console errors are consistent with externally injected extension scripts failing to load their own `chrome-extension://.../assets/*.js` files.

## Hardening implemented
- Added global `window` listeners for `error` and `unhandledrejection` to capture extension-noise signatures and suppress crash behavior from those events.
- Added development-only diagnostics panel on `/login` with:
  - user agent
  - extension context check
  - last 10 captured extension-noise errors
- Added `isSafeModuleUrl(url)` helper that blocks extension schemes and allows only same-origin `http(s)` URLs for module safety checks.

## Repro / validation procedure
1. Open `/login` in regular Chrome profile with extensions enabled.
2. Trigger page load and inspect DevTools console.
3. If extension injection is present, diagnostics panel (DEV mode) will show captured extension-related errors.
4. Open Incognito window with extensions disabled.
5. Load `/login` again; extension-related console noise should be absent.

> These errors disappear in Incognito with extensions disabled.
