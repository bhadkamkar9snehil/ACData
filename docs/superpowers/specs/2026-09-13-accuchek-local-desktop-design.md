# AccuChek Local Desktop Design

## Product goal

Build a private Windows desktop application that reads an Accu-Chek Instant over USB, preserves source-faithful measurements, stores them locally with encryption, provides useful spot-reading analysis, and exports user-initiated PDF reports. The application has no network runtime features.

## Architecture

The existing IEEE-11073 and Roche USB implementation becomes a reusable Rust backend library. A Tauri 2 shell exposes a small command boundary to a React, TypeScript, Tailwind, and shadcn-based interface. SQLite access, SQLCipher keying, Windows DPAPI key protection, USB access, analytics, validation, and PDF generation remain in Rust.

The initial desktop release targets Windows. No driver is installed or replaced by the application. The app first uses the existing Windows driver and gives diagnostic guidance when WinUSB-compatible access is unavailable.

## Data and privacy

- Preserve raw glucose word, normalized value, HI/LO state, full raw status, meter-local timestamp, model/serial identity, stable device key, import timestamp, occurrence, notes, and meal context.
- Treat readings as finger-stick samples. Labels say “sampled readings in range,” never continuous “time in range.”
- Schema v3 adds source, control-test state, optional meter record identity, optional UTC offset, and meal context without guessing unavailable meter semantics.
- Encrypt the database with SQLCipher. Generate a random database key once and protect it with Windows DPAPI. Never store plaintext key material.
- No telemetry, updater, CDN, Google Fonts, remote assets, analytics, cloud sync, or background network requests.
- Exports are explicit local actions initiated by the user.

## Application surfaces

- Overview: sampled-range distribution, average, median, variability, recent reading, trend, and data-quality context.
- Explore: date filtering, trend chart, distribution histogram, sampled-range composition, weekday and time-of-day patterns.
- Readings: searchable table, raw provenance details, notes, and meal-context editing.
- Import: device state, read-only sync, identified meter details, import summary, and driver diagnostics.
- Reports: date range, unit, included annotations, preview summary, and native local PDF export.
- Settings: display unit and personal thresholds, local data location, privacy guarantees, and app information.

## Visual language

The product should feel like a beautifully made personal instrument, not a hospital portal. Use a warm paper canvas, dark ink navigation, tactile cards, strong numeric typography, restrained teal/coral status colors, subtle grid/measurement motifs, and deliberate micro-interactions. Use local/system fonts only. Keep charts legible, keyboard accessible, and responsive down to a compact desktop window.

## Complexity boundaries

- One responsibility per Rust and React module.
- Tauri commands delegate immediately to backend services.
- Analytics are pure functions with fixture tests.
- UI pages compose small presentational components and hooks; no page owns USB, persistence, or report logic.
- Prefer lookup tables and data-driven rendering over large conditional branches.
- Enforce Clippy with warnings denied and ESLint complexity limits.

## Release gates

- Rust tests, Clippy, frontend tests, TypeScript build, and Tauri build pass locally.
- Runtime inspection confirms no network client or remote asset.
- A real Accu-Chek Instant hardware sync is reconciled against meter records before release.
- Encryption is verified by proving a normal SQLite connection cannot read the produced database.

