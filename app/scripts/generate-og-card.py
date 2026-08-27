#!/usr/bin/env python3
"""Draw `public/og-card.png`, the one Open Graph / Twitter card asset (Story 3.3, AC1).

THIS IS AN AUTHORING TOOL AND IT IS **NOT** PART OF THE BUILD CHAIN.
====================================================================
`npm run build` does not invoke it and must never be made to. Netlify builds this
site from `app/` with `app/`'s Node install alone and has **no Python interpreter**
(AD-13, NFR-8) — a build step that shelled out to `python` would go green here and
red on the first deploy. The other three files in `scripts/` are all in the build
chain; this one is the exception, and that is why the docblock says so loudly.

It is committed for the same reason `download_pmsr_corpus.py` at the repo root is:
an uncommitted generator means the card can never be regenerated identically, and
"regenerate the card" then means "redesign the card".

Run it by hand, from `app/`, after a `next build` has populated `.next/`:

    python scripts/generate-og-card.py

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
this script unreproducible one build later. Selection is by name ID 4 (`Archivo
SemiBold Regular`, `Inter Regular`) narrowed to the subset that actually covers
every character this card draws — next/font emits ~10 subsets per build and most
of them are missing the digits or the accented vowels. If no candidate covers the
text, this **fails loudly** rather than substituting a system font: a card set in
Arial is a card that advertises a different product.

Both faces are variable (`fvar`, `wght`) and both are drawn at their DEFAULT
instance, which is what the browser renders too — Archivo's default is 600
(hence "SemiBold" in the name) and Inter's is 400.

THE COLOURS ARE THE CANONICAL DARK PALETTE, copied from `src/app/globals.css`'s
`:root` block. Dark is canonical there (`:root` and `.dark` carry the same
values), so the card matches what a no-JS visitor actually lands on.

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

import io
import sys
from pathlib import Path

from fontTools.ttLib import TTFont
from PIL import Image, ImageDraw, ImageFont

# --- geometry -------------------------------------------------------------
# 1200x630 is 1.91:1, which is what `summary_large_image` and every Open Graph
# unfurler expect. `og:image:width` / `og:image:height` in the metadata must
# agree with these two numbers.
WIDTH, HEIGHT = 1200, 630
MARGIN_X = 88

# --- palette (src/app/globals.css, :root === .dark) -----------------------
SURFACE_BASE = "#0e1114"
INK_PRIMARY = "#f2f5f7"
INK_SECONDARY = "#a7b0b8"
BORDER_HAIRLINE = "#2a3138"
ACCENT_LIME = "#c3f53c"
ACCENT_CYAN = "#3ddbe8"

# --- copy (canonical Spanish; the description is `es.meta.description`) ----
EYEBROW = "MUNDIAL 2026"
WORDMARK = "WC Stats"
DESCRIPTION = (
    "Análisis táctico y estadístico de los 104 partidos de la Copa Mundial 2026."
)

ARCHIVO = "Archivo SemiBold Regular"
INTER = "Inter Regular"

APP_DIR = Path(__file__).resolve().parent.parent
FONT_DIR = APP_DIR / ".next" / "static" / "media"
OUTPUT = APP_DIR / "public" / "og-card.png"


def load_face(face_name: str, required: str) -> io.BytesIO:
    """Return the subset named `face_name` that covers every char in `required`.

    Selection is by name ID 4 and by measured cmap coverage — never by filename,
    because the hashes change on every build. Among the covering candidates the
    one with the widest cmap wins, so the choice is stable across builds rather
    than dependent on directory order. Raises if nothing covers the text.
    """
    if not FONT_DIR.is_dir():
        raise SystemExit(
            f"{FONT_DIR} does not exist. Run `npx next build` first — this script "
            "reads the site's own typefaces out of the build output."
        )

    needed = {ord(character) for character in required}
    best: tuple[int, Path, TTFont] | None = None
    seen: list[str] = []

    for path in sorted(FONT_DIR.glob("*.woff2")):
        font = TTFont(path)
        name = font["name"].getDebugName(4)
        seen.append(f"{path.name}: {name}")
        if name != face_name:
            continue
        cmap = set(font.getBestCmap())
        if needed - cmap:
            continue
        if best is None or len(cmap) > best[0]:
            best = (len(cmap), path, font)

    if best is None:
        raise SystemExit(
            f'No subset of "{face_name}" in {FONT_DIR} covers the text this card '
            f"draws. Refusing to fall back to a system font — the card must be in "
            f"the site's own faces. Candidates found:\n  " + "\n  ".join(seen)
        )

    _, path, font = best
    print(f'  {face_name}: {path.name}')
    buffer = io.BytesIO()
    font.flavor = None  # woff2 -> bare TTF, which is what Pillow can read.
    font.save(buffer)
    buffer.seek(0)
    return buffer


def sized(buffer: io.BytesIO, size: int) -> ImageFont.FreeTypeFont:
    """A Pillow font at `size`, from an in-memory TTF, at the face's default instance."""
    buffer.seek(0)
    return ImageFont.truetype(buffer, size)


def draw_tracked(
    draw: ImageDraw.ImageDraw,
    origin: tuple[int, int],
    text: str,
    font: ImageFont.FreeTypeFont,
    fill: str,
    tracking: int,
) -> None:
    """Draw `text` one glyph at a time so the eyebrow can carry letter-spacing.

    Pillow has no tracking parameter; the eyebrow needs it because a short
    all-caps label set solid reads as a typo rather than as a label.
    """
    x, y = origin
    for character in text:
        draw.text((x, y), character, font=font, fill=fill)
        x += draw.textlength(character, font=font) + tracking


def wrap(
    draw: ImageDraw.ImageDraw, text: str, font: ImageFont.FreeTypeFont, max_width: int
) -> list[str]:
    """Greedy word wrap measured in real glyph widths, not in characters."""
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


def main() -> None:
    print("Loading the site's own typefaces from the build output:")
    archivo = load_face(ARCHIVO, WORDMARK)
    inter = load_face(INTER, EYEBROW + DESCRIPTION)

    eyebrow_font = sized(inter, 30)
    wordmark_font = sized(archivo, 132)
    body_font = sized(inter, 34)

    image = Image.new("RGB", (WIDTH, HEIGHT), SURFACE_BASE)
    draw = ImageDraw.Draw(image)

    # The pitch goes down first so every piece of text sits above it.
    draw_pitch(draw, (700, 179, 1120, 451))

    # A cyan rule down the left edge — the site's own header accent, and it
    # gives the composition a hard left margin at unfurl thumbnail sizes.
    draw.rectangle([0, 0, 10, HEIGHT], fill=ACCENT_CYAN)

    draw_tracked(draw, (MARGIN_X, 118), EYEBROW, eyebrow_font, ACCENT_CYAN, tracking=5)
    draw.text((MARGIN_X, 168), WORDMARK, font=wordmark_font, fill=INK_PRIMARY)
    draw.rectangle([MARGIN_X, 348, MARGIN_X + 132, 358], fill=ACCENT_LIME)

    y = 404
    for line in wrap(draw, DESCRIPTION, body_font, max_width=560):
        draw.text((MARGIN_X, y), line, font=body_font, fill=INK_SECONDARY)
        y += 46

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    image.save(OUTPUT, format="PNG", optimize=True)

    written = Image.open(OUTPUT)
    print(f"\nWrote {OUTPUT.relative_to(APP_DIR)}")
    print(f"  {written.width}x{written.height}  {OUTPUT.stat().st_size:,} bytes")
    if (written.width, written.height) != (WIDTH, HEIGHT):
        raise SystemExit("Written file is not 1200x630.")
    if OUTPUT.stat().st_size > 300_000:
        raise SystemExit("Over 300 KB — WhatsApp is the binding constraint here.")


if __name__ == "__main__":
    sys.exit(main())
