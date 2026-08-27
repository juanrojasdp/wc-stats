#!/usr/bin/env python3
"""Draw the one Open Graph / Twitter card asset (Story 3.3, AC1).

THIS IS AN AUTHORING TOOL AND IT IS **NOT** PART OF THE BUILD CHAIN.
====================================================================
`npm run build` does not invoke it and must never be made to. Netlify builds this
site from `app/` with `app/`'s Node install alone and has **no Python interpreter**
(AD-13, NFR-8) — a build step that shelled out to `python` would go green here and
red on the first deploy. The other three files in `scripts/` are all in the build
chain; this one is the exception, and that is why the docblock says so loudly.

It is committed for the same reason `download_pmsr_corpus.py` at the repo root is:
an uncommitted generator means the card can never be regenerated, and "regenerate
the card" then means "redesign the card".

Run it by hand, from `app/`, after a `next build` has populated `.next/`:

    python scripts/generate-og-card.py

DEPENDENCIES, WHICH LIVE IN NO MANIFEST AND DELIBERATELY SO
-----------------------------------------------------------
    Pillow          (PIL)              — draws and writes the PNG
    fonttools       (fontTools)        — woff2 -> TTF, and the wght instancing
    brotli                             — REQUIRED by fontTools to open a .woff2

Install with `pip install Pillow fonttools brotli`. Verified against Pillow 12.2.0,
fontTools 4.62.1, brotli 1.2.0 (2026-08-27).

**Do NOT record these in `app/requirements.txt`.** `netlify.toml:7` sets
`base = "app"`, and a `requirements.txt` in the base directory can trigger
Netlify's Python dependency install on a deploy that must stay Node-only (AD-13,
NFR-8). The docblock IS the manifest, on purpose. `package.json` is untouched: none
of the three is a Node dependency and none ships to a reader.

WHAT "REPRODUCIBLE" MEANS HERE, AND WHAT IT DOES NOT
----------------------------------------------------
This script reproduces the card's **design**, not its **bytes**. `optimize=True`
output varies with the Pillow/zlib version, and the input faces are read out of
`.next/static/media/`, whose bytes move with the Next and next/font versions. Two
runs on one machine agree; two runs a year apart may not, and that is fine — what
is preserved is that the card can be rebuilt from source at all. The filename
carries a content hash precisely because the bytes are not promised to be stable.

WHY IT READS THE FONTS OUT OF `.next/static/media/`
---------------------------------------------------
The card has to be in the site's own typefaces or it looks like someone else's
site. `next/font` downloads Archivo and Inter at build time and emits subset
`.woff2` files there — which is the only copy of those faces this repo has, and
Pillow cannot read `.woff2`. So `fontTools` (with `brotli`) converts woff2 -> TTF
in memory and Pillow draws with the result. Nothing is downloaded; nothing is
added to `package.json`.

**Faces are selected by name, never by filename.** The hashes in
`.next/static/media/` change on every `next build`, so a hard-coded filename makes
this script unreproducible one build later. Selection is by name ID 4 narrowed to
the subset that actually covers every character this card draws — next/font emits
~10 subsets per build and most of them are missing the digits or the accented
vowels. Ties are broken on the candidate's own cmap and bytes, NEVER on directory
order, because directory order here IS filename-hash order and moves every build.
If no candidate covers the text, this **fails loudly** rather than substituting a
system font: a card set in Arial is a card that advertises a different product.

THE CARD IS SET ENTIRELY IN INTER, WHICH IS A CORRECTION (code review 2026-08-27)
---------------------------------------------------------------------------------
The first draft set the wordmark in Archivo because Archivo is `--font-display`
and a 132 px wordmark reads as a display element. But the SHIPPED wordmark is not
a display element: `SiteHeader.tsx` renders `t("app.siteName")` under `type-title`,
and `globals.css` defines `type-title` as `font-family: var(--font-sans)` — Inter —
at weight 600. A card whose wordmark is a different typeface from the site's own
wordmark is the exact failure this script's font handling exists to prevent, so it
was decided (Juan, 2026-08-27) in favour of matching the header literally.

Inter's subsets default to `wght: 400`; the header renders at 600. The face is
therefore INSTANTIATED at 600 through `fontTools`' instancer before conversion —
drawing it at the default instance would ship a visibly lighter wordmark and look
like a mistake rather than a decision. Archivo is consequently not loaded at all:
the wordmark was its only use on this card.

THE COLOURS AND THE COPY ARE CHECKED AGAINST THEIR SOURCES AT RUN TIME
-----------------------------------------------------------------------
The palette below is the canonical dark palette and the description below is
`es.meta.description`. Both used to be hand-copied constants asserted as fact by
this docblock and held together by nothing (code review 2026-08-27). They are now
verified on every run against `src/app/globals.css` and `src/locales/es.ts`, and a
drifted literal is a loud failure rather than a card that quietly says last
quarter's thing. Dark is canonical in `globals.css` (`:root` and `.dark` carry the
same values), so the card matches what a no-JS visitor actually lands on.

THE COPY IS CANONICAL SPANISH, and deliberately (§D11). A PNG cannot be
translated per reader, and every metadata string this export emits is already
canonical Spanish regardless of the reader's language toggle — `og:title`,
`og:description`, `twitter:title`, `twitter:description` all are. The card is
consistent with that, not a departure from it.

THE DOMAIN IS NOT WRITTEN HERE, IN CODE OR IN A COMMENT, AND THAT IS NOT
PEDANTRY. `src/lib/site-origin.test.ts` walks `scripts/**` with **no extension
filter** and reads every file it finds as UTF-8, so this file is scanned like any
`.mjs` beside it; it counts occurrences of the origin across `app/` and allows
exactly one, in `src/lib/site-origin.ts`. The card carries no URL text anyway —
an unfurled preview already shows the domain above the image.
"""

from __future__ import annotations

import hashlib
import io
import re
from pathlib import Path

try:
    import brotli  # noqa: F401  — imported for the check alone; fontTools uses it.
except ImportError:  # pragma: no cover - environment guard
    raise SystemExit(
        "brotli is not installed. fontTools cannot open a .woff2 without it, and "
        "every face this card draws is a .woff2. Run: pip install brotli"
    )

from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from PIL import Image, ImageDraw, ImageFont

# --- geometry -------------------------------------------------------------
# 1200x630 is 1.91:1, which is what `summary_large_image` and every Open Graph
# unfurler expect. `og:image:width` / `og:image:height` in the metadata must
# agree with these two numbers.
WIDTH, HEIGHT = 1200, 630
MARGIN_X = 88

# The pitch motif's left edge. The wordmark and the description are both checked
# against it before the card is written — text that runs under the motif is the
# overflow this composition can actually produce.
PITCH_LEFT = 700
PITCH_BOX = (PITCH_LEFT, 179, 1120, 451)

DESCRIPTION_TOP = 404
LINE_HEIGHT = 46
DESCRIPTION_MAX_WIDTH = 560

MAX_BYTES = 300_000

# --- palette --------------------------------------------------------------
# Each entry is (python constant, the globals.css custom property it copies).
# `verify_sources()` fails the run if any pair stops matching.
PALETTE: dict[str, str] = {
    "--surface-base": "#0e1114",
    "--ink-primary": "#f2f5f7",
    "--ink-secondary": "#a7b0b8",
    "--border-hairline": "#2a3138",
    "--accent-lime": "#c3f53c",
    "--accent-cyan": "#3ddbe8",
}
SURFACE_BASE = PALETTE["--surface-base"]
INK_PRIMARY = PALETTE["--ink-primary"]
INK_SECONDARY = PALETTE["--ink-secondary"]
BORDER_HAIRLINE = PALETTE["--border-hairline"]
ACCENT_LIME = PALETTE["--accent-lime"]
ACCENT_CYAN = PALETTE["--accent-cyan"]

# --- copy -----------------------------------------------------------------
# WORDMARK is `es.app.siteName` and DESCRIPTION is `es.meta.description`; both are
# verified against `src/locales/es.ts` at run time. EYEBROW is card-only copy with
# no counterpart in the locale layer — it labels the card, it is not site text.
EYEBROW = "MUNDIAL 2026"
WORDMARK = "WC Stats"
DESCRIPTION = (
    "Análisis táctico y estadístico de los 104 partidos de la Copa Mundial 2026."
)

INTER = "Inter Regular"
# `type-title` in globals.css — the weight the shipped wordmark renders at.
WORDMARK_WEIGHT = 600

APP_DIR = Path(__file__).resolve().parent.parent
FONT_DIR = APP_DIR / ".next" / "static" / "media"
PUBLIC_DIR = APP_DIR / "public"
GLOBALS_CSS = APP_DIR / "src" / "app" / "globals.css"
ES_LOCALE = APP_DIR / "src" / "locales" / "es.ts"
CONSTANT_FILE = APP_DIR / "src" / "lib" / "og-card.ts"

# The card's filename carries a content hash so a redesign is a NEW URL
# (code review 2026-08-27, decision 2b). WhatsApp, Slack, Facebook and X cache an
# unfurled image per URL for long, uncontrollable periods; under a stable filename
# every already-shared link would keep the old picture forever. `CARD_STEM` is also
# the glob used to sweep superseded cards out of `public/`.
CARD_STEM = "og-card"
HASH_LENGTH = 8


def verify_sources() -> None:
    """Fail loudly if this card's copy or palette has drifted from its source.

    Everything drawn here is duplicated from TypeScript or CSS that no Python tool
    can import. Rather than assert the equality in a comment and hope, the run
    re-reads both files and matches the literals. A reworded description or a
    retuned palette token now stops the generator instead of silently shipping a
    card that contradicts the site.
    """
    problems: list[str] = []

    css = GLOBALS_CSS.read_text(encoding="utf-8")
    for token, value in PALETTE.items():
        if not re.search(rf"{re.escape(token)}:\s*{re.escape(value)};", css):
            problems.append(
                f"{GLOBALS_CSS.name}: `{token}` is no longer `{value}`. The card's "
                f"palette is a copy of that block and has drifted."
            )

    locale = ES_LOCALE.read_text(encoding="utf-8")
    for label, literal in (("es.app.siteName", WORDMARK), ("es.meta.description", DESCRIPTION)):
        if f'"{literal}"' not in locale:
            problems.append(
                f"{ES_LOCALE.name}: `{label}` no longer reads `{literal}`. The card "
                f"draws that string and has drifted from the locale layer."
            )

    if problems:
        raise SystemExit(
            "The card's sources have moved under it. Fix the constants in this "
            "script (or revert the source change), then re-run:\n  "
            + "\n  ".join(problems)
        )
    print("Sources verified: palette matches globals.css, copy matches es.ts.")


def load_face(face_name: str, required: str, weight: int | None = None) -> io.BytesIO:
    """Return the subset named `face_name` that covers every char in `required`.

    Selection is by name ID 4 and by measured cmap coverage — never by filename,
    because the hashes change on every build. Among the covering candidates the
    one with the widest cmap wins; ties break on the cmap's own contents and then
    on the file's bytes, so the choice is a function of the FONT rather than of
    directory order (which is filename-hash order, and moves every build).

    `weight`, when given, instantiates the variable face at that `wght` before
    conversion. Pillow draws a variable font at its default instance, which for
    Inter is 400 — the wordmark needs 600 to match `type-title`.
    """
    if not FONT_DIR.is_dir():
        raise SystemExit(
            f"{FONT_DIR} does not exist. Run `npx next build` first — this script "
            "reads the site's own typefaces out of the build output."
        )

    needed = {ord(character) for character in required}
    candidates: list[tuple[int, list[int], bytes, Path, TTFont]] = []
    seen: list[str] = []
    unreadable: list[str] = []

    for path in sorted(FONT_DIR.glob("*.woff2")):
        raw = path.read_bytes()
        try:
            font = TTFont(io.BytesIO(raw))
            name = font["name"].getDebugName(4)
        except Exception as error:  # a truncated or non-font file, not a fatal run
            unreadable.append(f"{path.name}: {type(error).__name__}: {error}")
            continue
        seen.append(f"{path.name}: {name}")
        if name != face_name:
            continue
        cmap = set(font.getBestCmap())
        if needed - cmap:
            continue
        candidates.append((len(cmap), sorted(cmap), raw, path, font))

    if unreadable:
        # Not fatal: one corrupt subset left by an interrupted build must not stop
        # the run reaching the nine valid ones. It is reported so it is not silent.
        print("  (skipped unreadable candidates: " + "; ".join(unreadable) + ")")

    if not candidates:
        raise SystemExit(
            f'No subset of "{face_name}" in {FONT_DIR} covers the text this card '
            f"draws. Refusing to fall back to a system font — the card must be in "
            f"the site's own faces. Candidates found:\n  " + "\n  ".join(seen or unreadable)
        )

    _, _, _, path, font = max(candidates, key=lambda entry: (entry[0], entry[1], entry[2]))
    detail = path.name
    if weight is not None:
        if "fvar" not in font:
            raise SystemExit(
                f'"{face_name}" ({path.name}) has no `fvar` axis, so it cannot be '
                f"instantiated at wght={weight}. The card would ship at the wrong "
                f"weight and look like a mistake."
            )
        font = instantiateVariableFont(font, {"wght": weight}, inplace=False)
        detail = f"{path.name} @ wght={weight}"

    print(f"  {face_name}: {detail}")
    buffer = io.BytesIO()
    font.flavor = None  # woff2 -> bare TTF, which is what Pillow can read.
    font.save(buffer)
    buffer.seek(0)
    return buffer


def sized(buffer: io.BytesIO, size: int) -> ImageFont.FreeTypeFont:
    """A Pillow font at `size`, from an in-memory TTF."""
    buffer.seek(0)
    return ImageFont.truetype(buffer, size)


def draw_tracked(
    draw: ImageDraw.ImageDraw,
    origin: tuple[int, int],
    text: str,
    font: ImageFont.FreeTypeFont,
    fill: str,
    tracking: int,
) -> float:
    """Draw `text` one glyph at a time so the eyebrow can carry letter-spacing.

    Pillow has no tracking parameter; the eyebrow needs it because a short
    all-caps label set solid reads as a typo rather than as a label. Returns the
    x the run ended at, so the caller can bounds-check it.
    """
    x, y = origin
    for character in text:
        draw.text((x, y), character, font=font, fill=fill)
        x += draw.textlength(character, font=font) + tracking
    return x - tracking


def wrap(
    draw: ImageDraw.ImageDraw, text: str, font: ImageFont.FreeTypeFont, max_width: int
) -> list[str]:
    """Greedy word wrap measured in real glyph widths, not in characters.

    A single word wider than `max_width` cannot be broken and is emitted on its own
    over-long line rather than silently dropped. `check_fits()` is what turns that
    into a failure — this function's job is to wrap, not to judge.
    """
    lines: list[str] = []
    current = ""
    for word in text.split(" "):
        candidate = f"{current} {word}".strip()
        if current and draw.textlength(candidate, font=font) > max_width:
            lines.append(current)
            current = word
        else:
            current = candidate
    if current:
        lines.append(current)
    return lines


def check_fits(
    draw: ImageDraw.ImageDraw,
    wordmark_font: ImageFont.FreeTypeFont,
    body_font: ImageFont.FreeTypeFont,
    eyebrow_end: float,
    lines: list[str],
) -> None:
    """Refuse to write a card whose text runs off the canvas or under the motif.

    The post-write assertions this script used to rely on — pixel dimensions and
    byte size — are constant no matter what the copy does, so neither could ever
    catch an overflow (code review 2026-08-27). These four can. Every bound is
    measured in real glyph widths against the geometry constants above.
    """
    problems: list[str] = []

    wordmark_right = MARGIN_X + draw.textlength(WORDMARK, font=wordmark_font)
    if wordmark_right > PITCH_LEFT:
        problems.append(
            f"the wordmark ends at x={wordmark_right:.0f} and runs into the pitch "
            f"motif at x={PITCH_LEFT}"
        )
    if eyebrow_end > PITCH_LEFT:
        problems.append(
            f"the eyebrow ends at x={eyebrow_end:.0f} and runs into the pitch motif "
            f"at x={PITCH_LEFT}"
        )

    for line in lines:
        width = draw.textlength(line, font=body_font)
        if width > DESCRIPTION_MAX_WIDTH:
            problems.append(
                f'"{line}" measures {width:.0f}px against a {DESCRIPTION_MAX_WIDTH}px '
                f"column — it is one unbreakable word and cannot be wrapped"
            )

    bottom = DESCRIPTION_TOP + len(lines) * LINE_HEIGHT
    if bottom > HEIGHT:
        problems.append(
            f"the description needs {len(lines)} lines and ends at y={bottom}, past "
            f"the {HEIGHT}px canvas"
        )

    if problems:
        raise SystemExit(
            "The composition does not fit, and nothing was written. Shorten the copy "
            "or move the geometry:\n  " + "\n  ".join(problems)
        )


def draw_pitch(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int]) -> None:
    """A hairline pitch outline — the one decorative element, and it is on-subject.

    Drawn in `--border-hairline`, the repo's only divider weight, so it reads as
    texture behind the wordmark rather than as a second focal point.
    """
    left, top, right, bottom = box
    middle_y = (top + bottom) // 2
    middle_x = (left + right) // 2
    box_depth = (right - left) // 6
    box_height = (bottom - top) // 2
    radius = (bottom - top) // 6

    draw.rectangle(box, outline=BORDER_HAIRLINE, width=3)
    draw.line([(middle_x, top), (middle_x, bottom)], fill=BORDER_HAIRLINE, width=3)
    draw.ellipse(
        [middle_x - radius, middle_y - radius, middle_x + radius, middle_y + radius],
        outline=BORDER_HAIRLINE,
        width=3,
    )
    for x_edge, direction in ((left, 1), (right, -1)):
        draw.rectangle(
            [
                min(x_edge, x_edge + direction * box_depth),
                middle_y - box_height // 2,
                max(x_edge, x_edge + direction * box_depth),
                middle_y + box_height // 2,
            ],
            outline=BORDER_HAIRLINE,
            width=3,
        )
    # The lime kickoff spot is the one warm pixel on the right half; it ties the
    # motif to the accent used under the wordmark.
    draw.ellipse(
        [middle_x - 7, middle_y - 7, middle_x + 7, middle_y + 7], fill=ACCENT_LIME
    )


def publish(image: Image.Image) -> Path:
    """Validate, then name by content hash, then sweep the superseded card.

    ORDER IS THE POINT. The previous version wrote straight to the live filename
    and validated afterwards, so a rejected card had already replaced the good one
    by the time the run exited non-zero (code review 2026-08-27). Everything here
    happens in a temporary file; `public/` is only touched once the bytes have
    passed, and the old card is removed only after the new one is in place.
    """
    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)
    staging = PUBLIC_DIR / f".{CARD_STEM}.staging.png"
    try:
        image.save(staging, format="PNG", optimize=True)

        written = Image.open(staging)
        size = staging.stat().st_size
        if (written.width, written.height) != (WIDTH, HEIGHT):
            raise SystemExit(
                f"Written file is {written.width}x{written.height}, not {WIDTH}x{HEIGHT}. "
                f"Nothing was published; the previous card is untouched."
            )
        if size > MAX_BYTES:
            raise SystemExit(
                f"{size:,} bytes is over the {MAX_BYTES:,} ceiling — WhatsApp is the "
                f"binding constraint here. Nothing was published; the previous card "
                f"is untouched."
            )
        written.close()

        digest = hashlib.sha256(staging.read_bytes()).hexdigest()[:HASH_LENGTH]
        final = PUBLIC_DIR / f"{CARD_STEM}-{digest}.png"
        staging.replace(final)
    finally:
        staging.unlink(missing_ok=True)

    for stale in sorted(PUBLIC_DIR.glob(f"{CARD_STEM}-*.png")) + sorted(
        PUBLIC_DIR.glob(f"{CARD_STEM}.png")
    ):
        if stale != final:
            stale.unlink()
            print(f"  swept superseded card: {stale.name}")

    return final


def write_constant(filename: str) -> None:
    """Rewrite the single source of truth the five metadata sites import.

    The card's URL appears in exactly ONE place in `src/`. Five hand-kept copies
    were the highest-severity finding of this story's code review: the whole-export
    gate checked the URL's ORIGIN and never its VALUE, so renaming the asset in one
    of five files shipped 1,405 documents pointing at a 404, green.
    """
    body = f'''/*
 * THE OG / TWITTER CARD'S FILENAME — the ONE place it is written (Story 3.3,
 * code review 2026-08-27).
 *
 * GENERATED BY `scripts/generate-og-card.py`. Edit the card, not this file: the
 * generator rewrites the line below with the hash of the bytes it just wrote.
 *
 * THE HASH IS NOT DECORATION. WhatsApp, Slack, Facebook and X cache an unfurled
 * image per URL for long, uncontrollable periods, so under a stable filename every
 * link already shared would keep the old picture forever. A redesign changes the
 * hash, which changes the URL, which is what makes the new card reachable.
 *
 * WHY A CONSTANT AND NOT FIVE LITERALS. `openGraph` is replaced wholesale by any
 * child that declares it, so the images object genuinely must appear at all five
 * metadata sites — but the URL inside it does not. Importing it is what stops the
 * five copies drifting; before this existed, the export gate asserted the URL's
 * origin and never its value.
 *
 * WHY THE URL AND NOT THE WHOLE IMAGES OBJECT (§D8, and it was checked against the
 * rule rather than the prose). `eslint.config.mjs`'s metadata selector keys on
 * `title|description|default|template|absolute|alt|siteName`. `url` is NOT among
 * them, so moving it here costs nothing — while `alt: t("meta.ogImageAlt")` stays
 * inline at all five sites, inside the only AST scope that rule can reach. Lifting
 * the whole object would take `alt` out of that scope and silently disable AC4.
 */
export const OG_CARD_FILENAME = "{filename}";

export const OG_CARD_PATH = `/${{OG_CARD_FILENAME}}`;
'''
    CONSTANT_FILE.parent.mkdir(parents=True, exist_ok=True)
    # newline="\\n" explicitly: this repo is LF everywhere, source and artifacts.
    with CONSTANT_FILE.open("w", encoding="utf-8", newline="\n") as handle:
        handle.write(body)
    print(f"  {CONSTANT_FILE.relative_to(APP_DIR)} -> {filename}")


def main() -> None:
    verify_sources()

    print("Loading the site's own typefaces from the build output:")
    inter = load_face(INTER, EYEBROW + DESCRIPTION)
    inter_semibold = load_face(INTER, WORDMARK, weight=WORDMARK_WEIGHT)

    eyebrow_font = sized(inter, 30)
    body_font = sized(inter, 34)
    wordmark_font = sized(inter_semibold, 132)

    image = Image.new("RGB", (WIDTH, HEIGHT), SURFACE_BASE)
    draw = ImageDraw.Draw(image)

    # Measure everything BEFORE a pixel is committed, so an overflow is a failure
    # rather than a card that ships clipped.
    lines = wrap(draw, DESCRIPTION, body_font, max_width=DESCRIPTION_MAX_WIDTH)
    eyebrow_end = MARGIN_X + sum(
        draw.textlength(character, font=eyebrow_font) + 5 for character in EYEBROW
    ) - 5
    check_fits(draw, wordmark_font, body_font, eyebrow_end, lines)

    # The pitch goes down first so every piece of text sits above it.
    draw_pitch(draw, PITCH_BOX)

    # A cyan rule down the left edge — the site's own header accent, and it
    # gives the composition a hard left margin at unfurl thumbnail sizes.
    draw.rectangle([0, 0, 10, HEIGHT], fill=ACCENT_CYAN)

    draw_tracked(draw, (MARGIN_X, 118), EYEBROW, eyebrow_font, ACCENT_CYAN, tracking=5)
    draw.text((MARGIN_X, 168), WORDMARK, font=wordmark_font, fill=INK_PRIMARY)
    draw.rectangle([MARGIN_X, 348, MARGIN_X + 132, 358], fill=ACCENT_LIME)

    y = DESCRIPTION_TOP
    for line in lines:
        draw.text((MARGIN_X, y), line, font=body_font, fill=INK_SECONDARY)
        y += LINE_HEIGHT

    final = publish(image)
    print(f"\nWrote {final.relative_to(APP_DIR)}")
    print(f"  {WIDTH}x{HEIGHT}  {final.stat().st_size:,} bytes")
    write_constant(final.name)
    print("\nRun `npm run build` to copy the card into `out/` and re-emit the tags.")


if __name__ == "__main__":
    main()
