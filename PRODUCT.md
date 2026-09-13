# AccuChek Local

AccuChek Local is a private Windows application for downloading finger-stick glucose readings from an Accu-Chek Instant, understanding patterns, recording treatment context, and preparing concise reports for a clinician.

## Product principles

- Local first: no telemetry, remote assets, cloud storage, or background network calls.
- Source faithful: retain the meter-local timestamp, raw glucose word, raw status, device identity, and import provenance.
- Clinically honest: describe sampled readings, never imply continuous glucose coverage or automatic treatment advice.
- Fast to interpret: lead with safety-relevant findings, supporting sample counts, and comparable contexts.
- Agent accessible: expose stable, read-only JSON through a documented CLI; agents do not query or mutate SQLite directly.

## Core workflows

1. Reconnect the meter, wait for USB transfer mode, download records, and show an auditable import result.
2. Review yesterday, last week, or a custom range by time of day and meal context.
3. Record meal events, medication changes, and insulin doses without changing the original meter record.
4. Detect repeated patterns and unusual readings while retaining every measurement.
5. Export a doctor-first PDF with urgent signals, context summaries, treatment timeline, and source readings.

## Safety boundaries

- Do not calculate or recommend insulin or medication doses.
- Do not claim that a medicine caused a change. Compare matched periods and label the result as an association.
- Do not classify sparse finger-stick readings as CGM time in range. Use “percentage of sampled readings in range.”
- Statistical outliers remain in calculations unless the user explicitly marks a documented measurement issue.
