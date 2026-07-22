# Deferred Work

Items raised by reviews that were consciously deferred rather than fixed or dismissed.

## Deferred from: code review of 1-4-template-consistency-verification-across-the-venue-matchday-sample (2026-07-22)

- **Cover-line reconstruction thresholds are unvalidated at the boundary** — `pipeline/discover/probe.py:41-43` hard-codes `_LINE_TOLERANCE_PT = 3.0` and `_SPACE_GAP_PT = 1.0` with no fallback. A scoreline whose team-name spans and score digits differ in font size by more than 3.0pt splits into separate lines and the report dies with `"cover page has no scoreline"`; at a gap of exactly 1.0pt (`>` not `>=`) no space is inserted and the away team becomes `"SouthAfrica"`, which then propagates into every away anchor as a wrong-but-plausible team name. No test exercises either boundary — all synthetic covers use a single `fontsize=18` `insert_text` per line. Deferred: validating the thresholds requires the real 104-report corpus.

- **Zero-width and format characters survive `normalize`** — `pipeline/discover/text.py:26` collapses only `str.split` whitespace, so U+200B, U+00AD and the `ﬁ`/`ﬂ` ligatures that PDF text extraction commonly emits pass through on both sides of the anchor comparison. A cosmetic font change would therefore report as a template revision across the whole corpus. Deferred: cannot confirm the corpus exhibits this without the 104 PDFs. Related to the open decision on unicode normalization of stratification keys.
