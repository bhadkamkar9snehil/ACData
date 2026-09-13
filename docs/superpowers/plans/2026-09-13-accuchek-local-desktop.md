# AccuChek Local Desktop Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a private Windows Tauri desktop application around the hardened Roche USB importer with encrypted local storage, analytical charts, reading annotations, and PDF reports.

**Architecture:** Refactor the current binary into a reusable Rust library and a thin CLI, then add a Tauri 2 adapter whose commands open backend services per request. Build a React/shadcn frontend from focused pages and pure view-model helpers; keep all USB, encryption, persistence, analytics, and PDF work in Rust.

**Tech Stack:** Rust, rusb, rusqlite with bundled SQLCipher, Windows DPAPI, Tauri 2, React 19, TypeScript, Vite, Tailwind CSS, shadcn/ui patterns, Recharts, Vitest, Testing Library.

---

## Fixed implementation contracts

- Data directory: `%LOCALAPPDATA%\\AccuChek Local`; encrypted database: `accuchek.db`; DPAPI blob: `accuchek.key`; migration backup: `accuchek.plaintext.backup`.
- DPAPI scope: current Windows user through `windows` crate features `Win32_Foundation`, `Win32_Security_Cryptography`, and `Win32_System_Memory`. A missing, corrupt, or undecryptable key never creates a replacement beside an existing encrypted database; it returns a typed recovery error.
- Schema v3 reading columns: existing v2 columns plus `meter_record_id TEXT`, `utc_offset_minutes INTEGER`, `is_control INTEGER NOT NULL DEFAULT 0 CHECK(is_control IN (0,1))`, `source TEXT NOT NULL DEFAULT 'usb' CHECK(source IN ('usb','ble','manual'))`, and `meal_context TEXT CHECK(meal_context IN ('fasting','before_breakfast','after_breakfast','before_lunch','after_lunch','before_dinner','after_dinner','bedtime','other'))`.
- Identity: partial unique `(device_key,meter_record_id)` when a native ID exists; otherwise retain unique `(device_key,timestamp,raw_value,status,occurrence)`. Current Roche packets provide no proven native ID, UTC offset, control bit, or meal flag, so those fields remain `NULL`/false rather than inferred.
- Import audit table: `imports(id,device_key,source,started_at,completed_at,received_count,inserted_count,duplicate_count,outcome,error_summary)`; device upsert, reading inserts, and successful audit completion occur in one transaction.
- Analytics: include all non-control readings regardless of nonzero status until a status exclusion bit is proven; represent HI/LO separately and exclude their synthetic 601/9 display values from mean/median/SD; sample SD uses `n-1`; thresholds are low-exclusive/high-inclusive; group by meter-local wall clock; sort by timestamp then row ID.
- Sampled-range bands: `<54`, `54..<low`, `low..=high`, `high..<250`, and `>=250`. Distribution histogram: 20 mg/dL bins from 40 through 400 with explicit underflow/overflow bins. Time buckets: 00–06, 06–09, 09–12, 12–18, 18–21, 21–24. Weekdays use meter-local Monday through Sunday order.
- UI complexity: ESLint cyclomatic complexity maximum 8; page modules maximum 220 lines; leaf components maximum 160 lines; Rust command functions maximum 25 nonblank lines and delegate to one service operation.
- No frontend filesystem permission. PDF paths come only from the Tauri dialog plugin and are passed to a Rust report command after a user click.

## Chunk 1: Backend product core

### Task 1: Create a reusable backend library

**Files:**
- Create: `src/lib.rs`
- Create: `src/cli.rs`
- Modify: `src/main.rs`
- Modify: `Cargo.toml`
- Modify: `Cargo.lock`
- Delete: `src/gui.rs`

- [ ] Add `src/lib.rs` exports and run `cargo check --lib`; expect success.
- [ ] Add CLI parser tests for help, version, paths, sync dispatch, and an invalid device index; run `cargo test cli::tests`; expect failure before extraction.
- [ ] Move console attachment and command dispatch into `src/cli.rs`; keep no-argument behavior as guidance to launch the desktop app; make `src/main.rs` only call `accuchek::cli::run()`.
- [ ] Run `cargo test cli::tests`; expect all CLI tests to pass.
- [ ] Delete `src/gui.rs`, remove eframe, egui_plot, rfd, and `mod gui`, refresh `Cargo.lock`, then require `rg -n "eframe|egui|rfd|mod gui" src Cargo.toml` to return no matches.
- [ ] Run `cargo test --all-targets --locked` and `cargo clippy --all-targets --locked -- -D warnings`; expect zero failures and warnings.
- [ ] Commit as `refactor: expose reusable AccuChek backend`.

### Task 2: Add schema-v3 annotations and query contracts

**Files:**
- Create: `src/storage/models.rs`
- Create: `src/storage/queries.rs`
- Modify: `src/storage.rs`
- Modify: `src/storage_parts/schema.rs`
- Modify: `src/storage_parts/operations.rs`
- Modify: `src/device_parts/types.rs`
- Modify: `src/device_parts/messages.rs`
- Test: `src/storage_parts/helpers_tests.rs`

- [ ] Add `schema_v2_migrates_to_v3_without_loss`; assert every fixed-contract column/default/index and preserved v2 row; run `cargo test schema_v2_migrates`; expect failure.
- [ ] Add the exact v3 tables, checks, and partial indexes from the fixed contracts; rerun the migration test; expect pass.
- [ ] Add serializable `MealContext`, `ReadingSource`, `ReadingFilter { from, to, device_key, meal_context, query }`, read-only `is_control`, `ReadingPatch { note, meal_context }`, `DeviceRecord`, and `ImportRecord` in `src/storage/models.rs`.
- [ ] Extend `GlucoseReading` with `meter_record_id`, `utc_offset_minutes`, `is_control`, and `source`; initialize USB records to `None`, `None`, `false`, and `Usb`; update parser fixtures.
- [ ] Add failing tests for each filtered-read field and invalid patch enum; run `cargo test storage::tests`; expect named failures.
- [ ] Implement only parameterized filtered queries and validated patch updates in `src/storage/queries.rs`; rerun storage tests; expect pass.
- [ ] Add failing `sync_import_is_atomic_and_audited`; implement one `Storage::import_download(DownloadResult)` transaction covering device, readings, and audit; replace CLI call sequence; expect pass.
- [ ] Run `cargo test storage::tests` and strict Clippy; expect zero failures/warnings.
- [ ] Commit as `feat: add source-faithful reading metadata`.

### Task 3: Add encrypted Windows storage

**Files:**
- Create: `src/security.rs`
- Create: `src/security/windows_dpapi.rs`
- Create: `src/storage/encrypted.rs`
- Modify: `Cargo.toml`
- Modify: `Cargo.lock`
- Modify: `src/storage.rs`
- Modify: `src/storage_parts/schema.rs`
- Modify: `src/cli.rs`
- Test: `src/security/tests.rs`

- [ ] Add key-generation tests asserting two generated 32-byte keys differ and debug/error output omits key bytes; run `cargo test security::tests`; expect failure.
- [ ] Switch rusqlite to `bundled-sqlcipher-vendored-openssl`, add `rand`, `zeroize`, and the fixed Windows API features; refresh `Cargo.lock`; implement key generation.
- [ ] Add DPAPI round-trip and tampered-blob tests; implement `protect`/`unprotect` with `LocalFree` and zeroization; run the tests and expect pass on Windows.
- [ ] Implement key-file creation with `OpenOptions::create_new`, reject reparse points, and add missing/corrupt key tests. Existing DB plus unavailable key must return `RecoveryRequired`, never generate a replacement.
- [ ] Implement `EncryptedConnection::open`: unprotect key, apply `PRAGMA key` before any schema query, require nonempty `PRAGMA cipher_version`, then enable foreign keys, WAL, and FULL synchronous mode.
- [ ] Replace every production `Storage::new` path with the encrypted factory; add a source guard test rejecting bare `Connection::open` outside tests/migration and an integration test covering the CLI factory entry point. Test the later desktop entry point in Task 6.
- [ ] Add plaintext fixtures containing readings, notes, devices, and imports plus failure injection after copy and before replacement.
- [ ] Implement migration by checkpointing/closing plaintext WAL, copying through SQLCipher `ATTACH ... KEY` and `sqlcipher_export`, validating schema and per-table counts, renaming plaintext to the fixed backup, and atomically renaming encrypted temp; restore the original on failure.
- [ ] Add wrong-key, key-without-database, database-without-key, interrupted-migration, temp/WAL/SHM cleanup, backup-preservation, and encrypted-reopen tests; recovery errors are `RecoveryRequired { reason, backup_path }` with no secret material.
- [ ] Have the encryption test create `%TEMP%\\accuchek-test\\encrypted.db`, then run `python -c "import sqlite3; sqlite3.connect(r'%TEMP%\\accuchek-test\\encrypted.db').execute('select count(*) from readings').fetchone()"`; the PowerShell harness asserts nonzero `$LASTEXITCODE` and stderr containing `file is not a database`.
- [ ] Run `cargo test --all-features security::tests` and `cargo clippy --all-targets --all-features -- -D warnings`; expect zero failures/warnings.
- [ ] Commit as `feat: encrypt local glucose storage`.

### Task 4: Provide compact analytics and reporting services

**Files:**
- Create: `src/analytics.rs`
- Create: `src/analytics/models.rs`
- Create: `src/analytics/aggregate.rs`
- Create: `src/report.rs`
- Create: `src/report/layout.rs`
- Create: `src/report/pages.rs`
- Create: `src/report/service.rs`
- Modify: `src/export.rs`
- Test: `src/analytics/tests.rs`

- [ ] Define serializable `Dashboard`, `MetricSummary`, `TrendPoint`, `RangeBand`, `DistributionBin`, `TimeBucket`, and `DataQuality` in `analytics/models.rs`.
- [ ] Add fixture tests for empty, one value, HI/LO, nonzero status, control exclusion, custom thresholds, 20 mg/dL distribution bins, Monday–Sunday weekday order, multi-day ordering, and all fixed time buckets; run `cargo test analytics::tests`; expect failure.
- [ ] Implement pure functions in `aggregate.rs` exactly matching the fixed analytics contract and complexity limit; rerun focused tests; expect pass.
- [ ] Move reusable calculations out of `stats.rs`; keep `stats.rs` below 400 lines and each analytics module below 300 lines.
- [ ] Define `ReportRequest { filter, unit, thresholds, include_notes, include_meal_context }`; add failing PDF header and annotation-inclusion tests.
- [ ] Split `export.rs` into `report/layout.rs`, `report/pages.rs`, and `report/service.rs`, each below 400 lines; replace user-facing “time in range” with “sampled readings in range.”
- [ ] Run `cargo test analytics::tests` and `cargo test report::tests`; expect deterministic payloads and bytes beginning `%PDF`.
- [ ] Run full Rust tests and strict Clippy; expect zero failures/warnings.
- [ ] Commit as `feat: add sampled-reading analytics and reports`.

## Chunk 2: Tauri boundary and React application

### Task 5: Scaffold the Tauri 2 desktop shell

**Files:**
- Create: `desktop/package.json`
- Create: `desktop/package-lock.json`
- Create: `desktop/vite.config.ts`
- Create: `desktop/tsconfig.json`
- Create: `desktop/eslint.config.js`
- Create: `desktop/vitest.setup.ts`
- Create: `desktop/components.json`
- Create: `desktop/index.html`
- Create: `desktop/src/main.tsx`
- Create: `desktop/src/App.tsx`
- Create: `desktop/src-tauri/Cargo.toml`
- Create: `desktop/src-tauri/tauri.conf.json`
- Create: `desktop/src-tauri/capabilities/default.json`
- Create: `desktop/src-tauri/src/main.rs`
- Create: `desktop/src-tauri/src/lib.rs`

- [ ] Create pinned React/Vite/TypeScript/Tailwind/shadcn/Radix/Recharts/Vitest/Testing Library/Tauri dependencies and generate `package-lock.json` with `npm install`.
- [ ] Add scripts `dev`, `build`, `typecheck`, `lint`, `test`, and `tauri`; configure strict TypeScript, Vitest jsdom, and ESLint complexity 8.
- [ ] Configure Tauri with no updater or remote URL, CSP `default-src 'self'; img-src 'self' asset: data:; style-src 'self' 'unsafe-inline'`, and dialog-only capability—no frontend filesystem/network permission.
- [ ] Add a local path dependency on the backend crate and register only the dialog plugin.
- [ ] Add a typed `AppError { code, message, recovery }`; test that key material and sensitive paths are redacted; implement conversions.
- [ ] Add a minimal `main.tsx`/`App.tsx` shell, then run `npm --prefix desktop run test -- --run`, `npm --prefix desktop run lint`, `npm --prefix desktop run typecheck`, and `npm --prefix desktop run tauri build -- --debug`; expect exit 0 for each.
- [ ] Commit as `feat: add private Tauri desktop shell`.

### Task 6: Add narrow Tauri commands

**Files:**
- Create: `desktop/src-tauri/src/commands/mod.rs`
- Create: `desktop/src-tauri/src/commands/dashboard.rs`
- Create: `desktop/src-tauri/src/commands/readings.rs`
- Create: `desktop/src-tauri/src/commands/sync.rs`
- Create: `desktop/src-tauri/src/commands/reports.rs`
- Create: `desktop/src-tauri/src/commands/settings.rs`
- Create: `src/app_service.rs`
- Create: `src/settings.rs`
- Modify: `src/lib.rs`
- Modify: `desktop/src-tauri/src/lib.rs`
- Modify: `desktop/src-tauri/Cargo.toml`
- Modify: `desktop/src-tauri/Cargo.lock`
- Test: `desktop/src-tauri/src/commands/tests.rs`

- [ ] Add failing command tests for bootstrap, dashboard, filter rejection, patch rejection, disconnected sync, safe error redaction, settings, and report path validation.
- [ ] Add backend `AppService` methods `bootstrap`, `dashboard`, `readings`, `update_reading`, `sync_and_import`, `load_settings`, `save_settings`, and `export_report`; cover each with backend service tests.
- [ ] Implement matching Tauri commands; every command stays under 25 nonblank lines and calls exactly one `AppService` method.
- [ ] Return `SyncOutcome { device, received, inserted, duplicates, warnings }`; never install, replace, or modify a Windows driver.
- [ ] Require an explicit path obtained by frontend dialog click for `export_report`; reject non-PDF extension and nonexistent parent directory.
- [ ] Register commands in `src-tauri/src/lib.rs` and refresh the Tauri lockfile.
- [ ] Run `cargo test --manifest-path desktop/src-tauri/Cargo.toml`; expect command tests pass.
- [ ] Run `cargo clippy --manifest-path desktop/src-tauri/Cargo.toml --all-targets -- -D warnings`; expect zero warnings.
- [ ] Commit as `feat: expose desktop application commands`.

### Task 7: Establish the shadcn design system and app frame

**Files:**
- Modify: `desktop/src/main.tsx`
- Modify: `desktop/src/App.tsx`
- Create: `desktop/src/styles.css`
- Create: `desktop/src/components/ui/Button.tsx`
- Create: `desktop/src/components/ui/Card.tsx`
- Create: `desktop/src/components/ui/Badge.tsx`
- Create: `desktop/src/components/ui/Input.tsx`
- Create: `desktop/src/components/ui/Select.tsx`
- Create: `desktop/src/components/ui/Dialog.tsx`
- Create: `desktop/src/components/ui/Table.tsx`
- Create: `desktop/src/components/ui/Tooltip.tsx`
- Create: `desktop/src/components/ui/Skeleton.tsx`
- Create: `desktop/src/components/ui/Toast.tsx`
- Create: `desktop/src/components/app-shell/AppShell.tsx`
- Create: `desktop/src/components/app-shell/Sidebar.tsx`
- Create: `desktop/src/components/app-shell/TopBar.tsx`
- Create: `desktop/src/components/app-shell/PrivacyIndicator.tsx`
- Create: `desktop/src/components/app-shell/UnitControl.tsx`
- Create: `desktop/src/lib/cn.ts`
- Create: `desktop/src/lib/format.ts`
- Create: `desktop/src/lib/contracts.ts`
- Create: `desktop/src/lib/navigation.ts`
- Create: `desktop/src/test/app-shell.test.tsx`
- Create: `scripts/check-module-size.ps1`

- [ ] Add failing tests for keyboard navigation, current-page indication, unit switching, privacy text, and 44px primary targets.
- [ ] Define local CSS variables for warm paper, ink, teal, coral, amber, borders, tactile shadows, radii, and chart series; use system/local fonts only and no `url(http...)`.
- [ ] Implement the ten named shadcn-style primitives with visible focus and disabled/loading states.
- [ ] Implement data-driven navigation in `navigation.ts` and compose the four named shell components; use strong tabular numeric typography, a subtle CSS measurement grid, tactile press transforms, CSS grid breakpoints, and reduced-motion media query.
- [ ] Run `npm --prefix desktop run test -- --run src/test/app-shell.test.tsx`; expect pass.
- [ ] Run `npm --prefix desktop run lint`, `npm --prefix desktop run typecheck`, and `powershell -File scripts/check-module-size.ps1`; expect exit 0 and no limit violations.
- [ ] Commit as `feat: establish AccuChek Local design system`.

### Task 8: Build analytical pages and charts

**Files:**
- Create: `desktop/src/pages/OverviewPage.tsx`
- Create: `desktop/src/pages/ExplorePage.tsx`
- Create: `desktop/src/features/analytics/MetricCard.tsx`
- Create: `desktop/src/features/analytics/TrendChart.tsx`
- Create: `desktop/src/features/analytics/DistributionChart.tsx`
- Create: `desktop/src/features/analytics/RangeComposition.tsx`
- Create: `desktop/src/features/analytics/WeekdayChart.tsx`
- Create: `desktop/src/features/analytics/TimeOfDayChart.tsx`
- Create: `desktop/src/features/analytics/ChartTooltip.tsx`
- Create: `desktop/src/features/analytics/DataQualityNote.tsx`
- Create: `desktop/src/hooks/useDashboard.ts`
- Create: `desktop/src/hooks/useReadingFilter.ts`
- Test: `desktop/src/features/analytics/analytics.test.tsx`

- [ ] Add failing tests for average, median, variability, latest reading, sampled-range wording, accessible chart summaries, unit conversion, shared date filters, HI/LO markers, and empty state.
- [ ] Implement `useReadingFilter` as the single URL-free query-state owner and `useDashboard` as one typed Tauri call with loading/error/data states.
- [ ] Implement the eight named analytics components with Recharts; trend uses points and thin connecting lines but labels the samples as intermittent, and HI/LO use explicit markers rather than synthetic numeric statistics.
- [ ] Compose Overview with average, median, sample SD, recent reading, sampled-range composition, trend, and data-quality note.
- [ ] Compose Explore with presets/custom dates plus trend, sampled-range composition, distribution, weekday, and time-of-day charts sharing one filter.
- [ ] Run `npm --prefix desktop run test -- --run src/features/analytics/analytics.test.tsx`, `npm --prefix desktop run lint`, and `npm --prefix desktop run typecheck`; expect exit 0.
- [ ] Commit as `feat: add glucose analysis workspace`.

### Task 9: Build readings, import, reports, and settings workflows

**Files:**
- Create: `desktop/src/pages/ReadingsPage.tsx`
- Create: `desktop/src/pages/ImportPage.tsx`
- Create: `desktop/src/pages/ReportsPage.tsx`
- Create: `desktop/src/pages/SettingsPage.tsx`
- Create: `desktop/src/features/readings/ReadingsTable.tsx`
- Create: `desktop/src/features/readings/ReadingDetailDialog.tsx`
- Create: `desktop/src/features/readings/MealContextSelect.tsx`
- Create: `desktop/src/features/import/DevicePanel.tsx`
- Create: `desktop/src/features/import/SyncResult.tsx`
- Create: `desktop/src/features/import/DriverGuidance.tsx`
- Create: `desktop/src/features/reports/ReportForm.tsx`
- Create: `desktop/src/features/reports/ReportPreview.tsx`
- Create: `desktop/src/features/settings/ThresholdForm.tsx`
- Create: `desktop/src/features/settings/PrivacyPanel.tsx`
- Create: `desktop/src/hooks/useReadings.ts`
- Create: `desktop/src/hooks/useSync.ts`
- Create: `desktop/src/hooks/useReportExport.ts`
- Create: `desktop/src/hooks/useSettings.ts`
- Test: `desktop/src/test/workflows.test.tsx`

- [ ] Add mocked-command tests for search, provenance dialog, annotation save/error, disconnected sync, unsupported driver, successful dedup summary, canceled report, successful report, threshold validation, and settings persistence.
- [ ] Implement `useReadings`; build searchable table and detail dialog showing raw word, status, device, source, import time, occurrence, note, meal context, and control flag.
- [ ] Implement `useSync`; build idle/connecting/success/error states, identified meter detail, and existing-driver-first guidance that never offers automatic driver installation.
- [ ] Implement `useReportExport`; build report form with date range, unit, thresholds, include-notes, and include-meal-context controls plus a preview summary; open native dialog only from Export click.
- [ ] Implement `useSettings`; build settings for unit, thresholds, encrypted data location, privacy guarantees, version, license, and standards attribution.
- [ ] Run `npm --prefix desktop run test -- --run src/test/workflows.test.tsx`, lint, typecheck, and `powershell -File scripts/check-module-size.ps1`; expect exit 0.
- [ ] Commit as `feat: complete local glucose workflows`.

## Chunk 3: Local release hardening

### Task 10: Add deterministic demo data and full local verification

**Files:**
- Create: `desktop/src/lib/demo-data.ts`
- Create: `desktop/src/lib/runtime-mode.ts`
- Create: `desktop/playwright.config.ts`
- Create: `desktop/e2e/navigation.spec.ts`
- Create: `desktop/e2e/workflows.spec.ts`
- Create: `desktop/src/lib/runtime-mode.test.ts`
- Create: `desktop/scripts/assert-production-no-demo.mjs`
- Create: `scripts/verify-local.ps1`
- Create: `docs/release/local-verification.json`
- Modify: `desktop/package.json`
- Modify: `desktop/package-lock.json`
- Modify: `desktop/src/App.tsx`
- Modify: `src/config.rs`
- Modify: `README.md`

- [ ] Add `runtime-mode.test.ts` proving the adapter requires both development mode and `VITE_DEMO_MODE=1`; run `npm --prefix desktop run test -- --run src/lib/runtime-mode.test.ts`; expect pass.
- [ ] Add `assert-production-no-demo.mjs` to scan `desktop/dist` for the demo fixture marker after `npm --prefix desktop run build`; expect marker absent and exit 0.
- [ ] Add deterministic multi-week demo readings spanning every range/context and inject the demo adapter at App bootstrap only through `runtime-mode.ts`.
- [ ] Configure Playwright webServer as `npm --prefix desktop run dev -- --host 127.0.0.1`; add navigation/chart checks in `navigation.spec.ts` and annotation/sync/report state checks in `workflows.spec.ts`.
- [ ] Run `npm --prefix desktop exec playwright test`; expect all Chromium tests pass without a meter.
- [ ] Document existing-driver-first behavior and mark Zadig as a manual last resort after driver inspection; state that the app never changes drivers.
- [ ] Implement `verify-local.ps1` from repository root with fail-fast exact calls: `cargo test --all-targets --all-features --locked`; `cargo clippy --all-targets --all-features --locked -- -D warnings`; the same two commands with `--manifest-path desktop/src-tauri/Cargo.toml`; `npm --prefix desktop run test -- --run`; `npm --prefix desktop run lint`; `npm --prefix desktop run typecheck`; `npm --prefix desktop run build`; `npm --prefix desktop exec playwright test`; `npm --prefix desktop run tauri build`; every nonzero exit aborts.
- [ ] Scan only `src`, `desktop/src`, `desktop/src-tauri/src`, `desktop/dist`, and Tauri config for `http://`, `https://`, `ws://`, `wss://`, and updater entries with an explicit allowlist limited to standards/license text; separately reject reqwest, hyper, axios, node-fetch, and websocket packages in Cargo/npm dependency names.
- [ ] Add a production-safe verification override: `src/config.rs` honors `ACCUCHEK_DATA_DIR` only when `ACCUCHEK_VERIFY_LOCAL=1` and the canonical directory is beneath `$env:TEMP\\accuchek-local-verification`; otherwise it rejects the override. Add tests for every guard.
- [ ] In `verify-local.ps1`, create one unique child directory under `$env:TEMP\\accuchek-local-verification`, seed it through the backend encrypted-storage API so it receives its own DPAPI key, set both variables only for the packaged process, and remove that exact canonical child directory in `finally`; never open the normal user data path.
- [ ] Launch the packaged production executable against a temporary seeded encrypted database, exercise every page without demo mode, recursively collect the process tree from `Win32_Process.ParentProcessId`, and sample `Get-NetTCPConnection` for every PID for five minutes; acceptance is zero owned TCP endpoints. Record command, PIDs, duration, and result.
- [ ] Run `scripts/verify-local.ps1`; write executable path, byte size, SHA-256, test counts, tool versions, and network result to `docs/release/local-verification.json`.
- [ ] Commit as `build: add local Windows release verification`.

### Task 11: Perform rendered UI quality assurance

**Files:**
- Create: `docs/release/ui-qa.md`
- Modify: each exact source file named in `ui-qa.md` beside a reproduced defect before editing.

- [ ] Inspect every page at 1440×900, 1024×768, and 800×700; record each defect, reproduction, and exact implicated file in `ui-qa.md` before changing code.
- [ ] Correct recorded clipping, overflow, chart-label, focus-order, contrast, and touch-target defects one at a time; mark each verification in `ui-qa.md`.
- [ ] Exercise every action’s pressed/loading/success/empty/error state; record the state matrix and corrections in `ui-qa.md`.
- [ ] Re-run `scripts/verify-local.ps1`; expect exit 0 and refreshed verification JSON.
- [ ] Update `docs/release/local-verification.json` with `uiQa: passed`, the post-polish executable hash, and the `ui-qa.md` evidence path.
- [ ] Commit as `fix: polish desktop interaction and responsive layout`.

### Task 12: Reconcile real hardware before release

**Files:**
- Create: `docs/release/hardware-reconciliation.md`
- Modify: only files implicated by a reproduced hardware discrepancy.

- [ ] With the user’s Accu-Chek Instant connected, record Windows VID/PID, active driver/service, model, serial, meter clock, and displayed record count without changing the driver.
- [ ] Run one read-only sync and record received/inserted/duplicate counts plus representative first/last/raw/status values.
- [ ] Compare every downloaded meter timestamp/value against the meter or an authoritative meter export; acceptance is no missing, invented, or altered source record.
- [ ] Repeat sync; acceptance is zero new rows with identical total count and one additional successful import audit entry.
- [ ] Run `scripts/verify-local.ps1` after any hardware fix; expect exit 0.
- [ ] Refresh the executable hash and set `hardwareReconciliation: passed` plus its evidence path in `local-verification.json`.
- [ ] Mark the build release-ready only when `hardware-reconciliation.md` contains completed evidence and both UI-QA and hardware fields in the final verification JSON are `passed`.
