# Agent guide for AccuChek Local

This repository contains private health-data software. Work locally and do not add GitHub Actions, telemetry, remote fonts, CDNs, crash reporting, or automatic network requests.

## Stable data interface

Use the application CLI, never SQLite directly:

```powershell
cargo run -- data --period yesterday
cargo run -- analyze --period last-week
cargo run -- events --period 30d
```

Add `--json` for machine-readable output. Output includes a `schema_version`; consumers must reject unsupported major versions. Treat timestamps as meter-local unless an explicit offset is present.

## Analysis rules

- Say “sampled readings in range,” not “time in range.”
- Preserve all raw readings and raw status values.
- Separate clinical threshold flags from statistical outliers.
- Compare meals only when readings are explicitly linked or fall within the documented pairing window.
- For medication changes, report dates, matched sample counts, medians, spread, and association only.
- Never recommend medication or insulin doses. Escalate urgent clinical concerns to the user and their clinician.
- State when data coverage is sparse or biased toward symptom-driven testing.

## Development checks

Run locally:

```powershell
cargo test
cargo clippy --all-targets --all-features -- -D warnings
npm --prefix desktop run build
cargo test --manifest-path desktop/src-tauri/Cargo.toml
```

No GitHub workflow files are permitted.
