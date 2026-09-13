# Clinical analytics contract

This document defines interpretation rules, not medical advice.

## Evidence foundation

- ADA Standards of Care 2026, Glycemic Goals and Hypoglycemia: <https://doi.org/10.2337/dc26-s006>
- ADA Standards of Care 2026, Diabetes Technology: <https://doi.org/10.2337/dc26-s007>
- ADA Standards of Care 2026, Pharmacologic Approaches: <https://doi.org/10.2337/dc26-s009>
- Structured Testing Program trial: <https://pmc.ncbi.nlm.nih.gov/articles/PMC3024331/>
- Structured SMBG in insulin-treated diabetes: <https://pmc.ncbi.nlm.nih.gov/articles/PMC4025113/>
- International SMBG consensus: <https://pmc.ncbi.nlm.nih.gov/articles/PMC2769823/>
- Ambulatory Glucose Profile report principles: <https://www.agpreport.org/agp/about>

Structured profiles commonly pair fasting, before-meal, approximately two-hour post-meal, and bedtime measurements. The application borrows the rapid-reading hierarchy of an AGP report, but never renders an AGP curve or CGM-derived time-in-range metric from sparse finger-stick data.

## Context model

Time-of-day buckets are configurable and independent of meal context. The default buckets are overnight (00:00-05:59), morning (06:00-10:59), midday (11:00-15:59), evening (16:00-20:59), and night (21:00-23:59).

Meal contexts are fasting, before breakfast, after breakfast, before lunch, after lunch, before dinner, after dinner, bedtime, and other. A paired meal excursion uses an explicit meal link when possible; otherwise it requires the same meal label and a post reading 90-180 minutes after its preceding pre reading. The report shows the delta, elapsed minutes, sample count, median, and interquartile range.

## Outliers and patterns

Clinical flags use configured low/high thresholds. Statistical unusualness uses a robust median absolute deviation score within a comparable context and requires at least seven observations. If MAD is zero, the interquartile-range fence is used. A statistical flag is descriptive, never proof of an error, and never excludes a reading.

Pattern findings must include their date range, context, sample count, magnitude, and confidence label. Recurrent meal or time-of-day patterns require at least three comparable observations; fewer observations are shown as individual events rather than a pattern.

## Treatment context

Medication changes record effective time, medicine, previous/new dose, unit, frequency, reason, and notes. Insulin events record time, product, basal/prandial/correction type, units, optional meal link, and notes. The application never calculates a dose.

Treatment comparisons use equal pre/post windows and matched contexts. They show counts, median, IQR, and the observed difference. Copy must say “readings were higher/lower after this change,” not “the medicine worked,” and must disclose sparse or unequal sampling.

## Doctor report order

1. Patient-selected date range, device identity, data coverage, and threshold configuration.
2. Urgent low/high events and recurrent safety signals.
3. Sampled range composition, median, mean, IQR, variability, minimum, maximum, and count.
4. Fasting, meal-paired, bedtime-to-next-morning, and time-of-day summaries.
5. Medication-change and insulin timeline with matched before/after comparisons.
6. Evidence-backed pattern cards and limitations.
7. Source-reading appendix with raw status and annotations.
