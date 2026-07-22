# wc-stats — World Cup 2026 Match Analytics

A free, open, fully static web app that turns FIFA's public **Post-Match Summary
Report (PMSR)** PDFs from the 2026 World Cup — 104 dense infographic reports,
~52 pages each — into clean, layered, accessible dashboards.

The project has two decoupled halves with a hard data/presentation boundary:

1. **Offline extraction & precompute pipeline** (Python) — parses all 104 PMSR
   PDFs, both tabular and vector/positional data, into a normalized dataset and
   precomputes per-match bundles plus tournament-wide aggregations to static JSON.
2. **Static web app** (Next.js / React) — renders match dashboards, a tournament
   hub, and player/team profiles from that JSON, with all filtering, sorting, and
   comparison done client-side. No backend, no database, zero infra cost.

See [`project-brief-wc2026-analytics.md`](project-brief-wc2026-analytics.md) for
the full brief, and `_bmad-output/planning-artifacts/` for the PRD, UX, and
architecture.

## The source PDF corpus

The FIFA PMSR PDFs are **not** committed to this repo — they are copyrighted
material (~570 MB), and republishing them is a form of redistribution this
project deliberately avoids. Fetch them locally instead:

```bash
python download_pmsr_corpus.py
```

This downloads all 104 reports into `pmsr-corpus/` (from FIFA's Match Report Hub,
using the exact published URLs) and writes `pmsr-corpus/manifest.csv` — the
match-number → team-code mapping the pipeline consumes. Already-downloaded files
are skipped, so re-runs only fetch what's missing.

## Data & attribution

Source data is FIFA's, published on the
[FIFA Training Centre Match Report Hub](https://www.fifatrainingcentre.com/en/fifa-world-cup-2026/match-report-hub.php).
This project reads and displays that data with attribution; it does not
redistribute the original reports. "Public" does not mean "freely reusable
commercially" — review FIFA's Terms of Use before any commercial use.

## License

Code is MIT-licensed (see [LICENSE](LICENSE)). The license covers this project's
own source, not the FIFA source data.
