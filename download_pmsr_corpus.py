#!/usr/bin/env python3
"""Download all 104 FIFA World Cup 2026 Post-Match Summary Report (PMSR) PDFs.

The remote filenames on the FIFA Training Centre hub are irregular (spaces,
trailing spaces, -V2/-V3/POST/ALT suffixes, mixed-case separators), so URLs
are NOT reconstructed from a pattern -- each REMOTE_FILES entry is the exact
href scraped from FIFA's Match Report Hub. Files are saved under normalized
local names (PMSR-MNN-HOME-V-AWAY.pdf) so the extraction pipeline sees a clean,
consistent corpus.

Stdlib only -- no third-party deps required.

Usage:
    python download_pmsr_corpus.py                 # download all, 6 workers
    python download_pmsr_corpus.py --limit 3       # first 3 only (smoke test)
    python download_pmsr_corpus.py --workers 8
    python download_pmsr_corpus.py --out D:\\some\\dir
"""
from __future__ import annotations

import argparse
import csv
import os
import re
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed

BASE_URL = "https://www.fifatrainingcentre.com/media/native/tournaments/fifa-world-cup/2026/"
DEFAULT_OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "pmsr-corpus")
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) pmsr-corpus-fetcher/1.0"
MIN_PDF_BYTES = 100_000  # a real report is multiple MB; anything tiny is an error page

# Exact remote filenames, verbatim from FIFA's Match Report Hub (group + knockout).
REMOTE_FILES = [
    # --- Group stage (M1-M72) ---
    "PMSR-M01 MEX V RSA.pdf",
    "PMSR-M02 KOR V CZE .pdf",
    "PMSR-M03-CAN-V-BIH-V2.pdf",
    "PMSR-M04-USA-V-PAR.pdf",
    "PMSR-M05-HAI-V-SCO.pdf",
    "PMSR-M06-AUS-V-TUR.pdf",
    "PMSR-M07-BRA-V-MAR POST-V2.pdf",
    "PMSR-M08-QAT-V-SUI.pdf",
    "PMSR-M09-CIV-V-ECU.pdf",
    "PMSR-M10-GER-V-CUW-V2.pdf",
    "PMSR-M11-NED-V-JPN.pdf",
    "PMSR-M12-SWE-V-TUN.pdf",
    "PMSR-M13-KSA-V-URU.pdf",
    "PMSR-M14-ESP-V-CPV.pdf",
    "PMSR-M15-IRN-V-NZL.pdf",
    "PMSR-M16-BEL-V-EGY.pdf",
    "PMSR-M17-FRA-V-SEN.pdf",
    "PMSR-M18-IRQ-V-NOR.pdf",
    "PMSR-M19-ARG-V-ALG.pdf",
    "PMSR-M20-AUT-V-JOR-V3.pdf",
    "PMSR-M21-GHA-V-PAN-V2.pdf",
    "PMSR-M22-ENG-V-CRO.pdf",
    "PMSR-M23-POR-V-COD.pdf",
    "PMSR-M24-UZB-V-COL-V2.pdf",
    "PMSR-M25-CZE-V-RSA.pdf",
    "PMSR-M26-SUI-V-BIH.pdf",
    "PMSR-M27-CAN-V-QAT.pdf",
    "PMSR-M28-MEX-V-KOR.pdf",
    "PMSR-M29-BRA-V-HAI.pdf",
    "PMSR-M30-SCO-V-MAR.pdf",
    "PMSR-M31-TUR-V-PAR.pdf",
    "PMSR-M32-USA-V-AUS.pdf",
    "PMSR-M33-GER-V-CIV.pdf",
    "PMSR-M34-ECU-V-CUW.pdf",
    "PMSR-M35-NED-V-SWE.pdf",
    "PMSR-M36-TUN-V-JPN.pdf",
    "PMSR-M37-URU-V-CPV.pdf",
    "PMSR-M38-ESP-V-KSA.pdf",
    "PMSR-M39-BEL-V-IRN.pdf",
    "PMSR-M40-NZL-V-EGY.pdf",
    "PMSR-M41-NOR-V-SEN.pdf",
    "PMSR-M42-FRA-V-IRQ.pdf",
    "PMSR-M43-ARG-V-AUT.pdf",
    "PMSR-M44-JOR-V-ALG.pdf",
    "PMSR-M45-ENG-V-GHA.pdf",
    "PMSR-M46-PAN-V-CRO.pdf",
    "PMSR-M47-POR-V-UZB-v2.pdf",
    "PMSR-M48-COL-V-COD-V2.pdf",
    "PMSR-M49-SCO-V-BRA.pdf",
    "PMSR-M50-MAR-V-HAI-V2.pdf",
    "PMSR-M51-SUI-V-CAN.pdf",
    "PMSR-M52-BIH-V-QAT.pdf",
    "PMSR-M53-CZE-V-MEX.pdf",
    "PMSR-M54-RSA-V-KOR.pdf",
    "PMSR-M55-CUW-V-CIV.pdf",
    "PMSR-M56-ECU-V-GER.pdf",
    "PMSR-M57-JPN-V-SWE.pdf",
    "PMSR-M58-TUN-V-NED.pdf",
    "PMSR-M59-TUR-v-USA.pdf",
    "PMSR-M60-PAR-V-AUS.pdf",
    "PMSR-M61-NOR-V-FRA.pdf",
    "PMSR-M62-SEN-V-IRQ.pdf",
    "PMSR-M63-EGY-V-IRN.pdf",
    "PMSR-M64-NZL-V-BEL.pdf",
    "PMSR-M65-CPV-V-KSA.pdf",
    "PMSR-M66-URU-V-ESP.pdf",
    "PMSR-M67-PAN-V-ENG.pdf",
    "PMSR-M68-CRO-V-GHA.pdf",
    "PMSR-M69-ALG-V-AUT.pdf",
    "PMSR-M70-JOR-V-ARG.pdf",
    "PMSR-M71-COL-V-POR.pdf",
    "PMSR-M72-COD-V-UZB-v2.pdf",
    # --- Knockout stage (M73-M104) ---
    "PMSR-M73-RSA-V-CAN.pdf",
    "PMSR-M74-GER-V-PAR-V2.pdf",
    "PMSR-M75-NED-V-MAR.pdf",
    "PMSR-M76-BRA-V-JPN.pdf",
    "PMSR-M77-FRA-V-SWE.pdf",
    "PMSR-M78-CIV-V-NOR.pdf",
    "PMSR-M79-MEX-V-ECU.pdf",
    "PMSR-M80-ENG-V-COD.pdf",
    "PMSR-M81-USA-V-BIH.pdf",
    "PMSR-M82-BEL-V-SEN.pdf",
    "PMSR-M83-POR-V-CRO.pdf",
    "PMSR-M84-ESP-V-AUT.pdf",
    "PMSR-M85-SUI-V-ALG.pdf",
    "PMSR-M86-ARG-V-CPV.pdf",
    "PMSR-M87-COL-V-GHA.pdf",
    "PMSR-M88-AUS-V-EGY.pdf",
    "PMSR-M89-PAR-V-FRA.pdf",
    "PMSR-M90-CAN-V-MAR.pdf",
    "PMSR-M91-BRA-V-NOR.pdf",
    "PMSR-M92-MEX-V-ENG.pdf",
    "PMSR-M93-POR-V-ESP.pdf",
    "PMSR-M94-USA-V-BEL.pdf",
    "PMSR-M95-ARG-V-EGY.pdf",
    "PMSR-M96-SUI-V-COL.pdf",
    "PMSR-M97-FRA-V-MAR.pdf",
    "PMSR-M98-ESP-V-BEL-ALT.pdf",
    "PMSR-M99-NOR-V-ENG.pdf",
    "PMSR-M100-ARG-V-SUI.pdf",
    "PMSR-M101-FRA-V-ESP.pdf",
    "PMSR-M102-ENG-V-ARG.pdf",
    "PMSR-M103-FRA-V-ENG.pdf",
    "PMSR-M104-ESP-V-ARG.pdf",
]

# PMSR-<sep>M<num><sep><HOME><sep><v|V><sep><AWAY> ; trailing suffixes ignored.
_PARSE_RE = re.compile(r"PMSR[ \-]M(\d+)[ \-]([A-Za-z]{3})[ \-][vV][ \-]([A-Za-z]{3})")


def parse_match(remote_name: str):
    m = _PARSE_RE.search(remote_name)
    if not m:
        raise ValueError(f"cannot parse match/teams from: {remote_name!r}")
    num = int(m.group(1))
    home = m.group(2).upper()
    away = m.group(3).upper()
    return num, home, away


def local_name(num: int, home: str, away: str) -> str:
    return f"PMSR-M{num:02d}-{home}-V-{away}.pdf"


def build_manifest():
    """Return list of dicts: match, home, away, local, remote_url."""
    rows = []
    seen = set()
    for remote in REMOTE_FILES:
        num, home, away = parse_match(remote)
        if num in seen:
            raise ValueError(f"duplicate match number M{num}")
        seen.add(num)
        rows.append({
            "match": num,
            "home": home,
            "away": away,
            "local": local_name(num, home, away),
            "remote_url": BASE_URL + urllib.parse.quote(remote),
        })
    rows.sort(key=lambda r: r["match"])
    return rows


def is_valid_pdf(path: str) -> bool:
    try:
        if os.path.getsize(path) < MIN_PDF_BYTES:
            return False
        with open(path, "rb") as fh:
            return fh.read(5) == b"%PDF-"
    except OSError:
        return False


def download_one(row: dict, out_dir: str, retries: int, timeout: int) -> tuple[str, str]:
    """Return (status, detail). status in {downloaded, skipped, failed}."""
    dest = os.path.join(out_dir, row["local"])
    if is_valid_pdf(dest):
        return "skipped", f"already present ({os.path.getsize(dest) // 1024} KB)"

    req = urllib.request.Request(row["remote_url"], headers={"User-Agent": USER_AGENT})
    last_err = ""
    for attempt in range(1, retries + 1):
        tmp_fd, tmp_path = tempfile.mkstemp(suffix=".part", dir=out_dir)
        os.close(tmp_fd)
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp, open(tmp_path, "wb") as out:
                while True:
                    chunk = resp.read(65536)
                    if not chunk:
                        break
                    out.write(chunk)
            if not is_valid_pdf(tmp_path):
                size = os.path.getsize(tmp_path)
                raise ValueError(f"invalid/short response ({size} bytes, not a PDF)")
            os.replace(tmp_path, dest)
            return "downloaded", f"{os.path.getsize(dest) // 1024} KB"
        except (urllib.error.URLError, ValueError, TimeoutError, OSError) as exc:
            last_err = str(exc)
            if os.path.exists(tmp_path):
                try:
                    os.remove(tmp_path)
                except OSError:
                    pass
            if attempt < retries:
                time.sleep(2 * attempt)  # linear backoff
    return "failed", last_err


def main() -> int:
    ap = argparse.ArgumentParser(description="Download all 104 FIFA WC 2026 PMSR PDFs.")
    ap.add_argument("--out", default=DEFAULT_OUT, help="output directory")
    ap.add_argument("--workers", type=int, default=6, help="concurrent downloads")
    ap.add_argument("--retries", type=int, default=3, help="attempts per file")
    ap.add_argument("--timeout", type=int, default=120, help="per-request timeout (s)")
    ap.add_argument("--limit", type=int, default=0, help="download only first N (0 = all)")
    args = ap.parse_args()

    os.makedirs(args.out, exist_ok=True)
    rows = build_manifest()

    # Always (re)write the manifest -- useful for the extraction pipeline.
    manifest_path = os.path.join(args.out, "manifest.csv")
    with open(manifest_path, "w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=["match", "home", "away", "local", "remote_url"])
        writer.writeheader()
        writer.writerows(rows)

    work = rows[: args.limit] if args.limit else rows
    print(f"Corpus: {args.out}")
    print(f"Manifest: {manifest_path} ({len(rows)} matches)")
    print(f"Downloading {len(work)} file(s) with {args.workers} worker(s)...\n")

    results = {"downloaded": [], "skipped": [], "failed": []}
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = {
            pool.submit(download_one, row, args.out, args.retries, args.timeout): row
            for row in work
        }
        for fut in as_completed(futures):
            row = futures[fut]
            status, detail = fut.result()
            results[status].append((row, detail))
            tag = {"downloaded": "OK ", "skipped": "-- ", "failed": "ERR"}[status]
            print(f"[{tag}] M{row['match']:<3} {row['home']}-V-{row['away']:<4} {detail}")

    print("\n" + "=" * 60)
    print(f"downloaded: {len(results['downloaded'])}  "
          f"skipped: {len(results['skipped'])}  "
          f"failed: {len(results['failed'])}")

    if results["failed"]:
        fail_log = os.path.join(args.out, "failures.txt")
        with open(fail_log, "w", encoding="utf-8") as fh:
            for row, detail in sorted(results["failed"], key=lambda x: x[0]["match"]):
                fh.write(f"M{row['match']}\t{row['local']}\t{row['remote_url']}\t{detail}\n")
        print(f"\nFailures written to {fail_log} -- re-run the script to retry them "
              f"(valid files are skipped).")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
