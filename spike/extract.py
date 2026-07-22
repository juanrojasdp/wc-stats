import fitz
from collections import Counter
from PIL import Image, ImageDraw

DPI = 200
SCALE = DPI / 72.0

# legend color -> outcome (matches page legend order: Goal, On Target,
# Off Target, Blocked, Incomplete)
def classify(fill):
    r, g, b = fill
    key = (round(r, 2), round(g, 2), round(b, 2))
    return {
        (0.00, 0.50, 0.00): "goal",
        (0.36, 0.61, 0.84): "on_target",
        (0.96, 0.74, 0.00): "off_target",
        (0.70, 0.53, 1.00): "blocked",
        (0.18, 0.30, 1.00): "incomplete",
    }.get(key, f"unknown{key}")

doc = fitz.open("mex_rsa.pdf")
page = doc[13]
draws = page.get_drawings()

# --- pitch frame: largest stroked 're' that fits within page width and is
# not the full-page border ---
page_area = page.rect.get_area()
candidates = []
for d in draws:
    for item in d["items"]:
        if item[0] == "re":
            r = fitz.Rect(item[1])
            if r.get_area() < 0.8 * page_area and r.get_area() > 10000:
                candidates.append(r)
pitch = max(candidates, key=lambda r: r.get_area())
print("pitch frame:", pitch)

# --- candidate circles: small filled circle drawings inside the pitch ---
def is_circle(d, wmin=8, wmax=15):
    r = d["rect"]
    if d["fill"] is None:
        return False
    if not (wmin <= r.width <= wmax and wmin <= r.height <= wmax):
        return False
    if not all(item[0] == "c" for item in d["items"]):
        return False
    return pitch.contains(fitz.Point((r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2))

cands = []
for d in draws:
    if is_circle(d):
        r = d["rect"]
        cands.append(((r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2, d["fill"]))

# --- legend row: circles sharing one y that together show >=4 distinct
# colors (data shots at one identical y with 4+ colors is implausible) ---
from itertools import groupby
legend_ys = set()
for cy, grp in groupby(sorted(cands, key=lambda c: round(c[1], 1)),
                       key=lambda c: round(c[1], 1)):
    grp = list(grp)
    if len(grp) >= 4 and len({classify(c[2]) for c in grp}) >= 4:
        legend_ys.add(cy)
print(f"legend row(s) at y: {sorted(legend_ys)}")

markers = []
for cx, cy, fill in cands:
    if round(cy, 1) in legend_ys:
        continue
    # normalize: x across pitch width, y along pitch length (attack up)
    nx = 100 * (cx - pitch.x0) / pitch.width
    ny = 100 * (cy - pitch.y0) / pitch.height
    markers.append((cx, cy, nx, ny, classify(fill)))

print(f"\nextracted markers: {len(markers)}")
counts = Counter(m[4] for m in markers)
for k in ("goal", "on_target", "off_target", "blocked", "incomplete"):
    print(f"  {k:<11} {counts.get(k, 0)}")
extra = {k: v for k, v in counts.items() if k.startswith("unknown")}
if extra:
    print("  UNKNOWN COLORS:", extra)

print("\nnormalized coordinates (0-100, pitch frame ref):")
for cx, cy, nx, ny, outcome in sorted(markers, key=lambda m: m[3]):
    print(f"  ({nx:5.1f}, {ny:5.1f})  {outcome:<11} [pdf pt: {cx:.1f},{cy:.1f}]")

# --- overlay on the 200-dpi reference render ---
img = Image.open("shots_ref.png").convert("RGB")
drw = ImageDraw.Draw(img)
R = 14
for cx, cy, *_ in markers:
    px, py = cx * SCALE, cy * SCALE
    drw.ellipse([px - R, py - R, px + R, py + R], outline=(255, 0, 0), width=4)
# draw the pitch frame too, for sanity
drw.rectangle([pitch.x0 * SCALE, pitch.y0 * SCALE,
               pitch.x1 * SCALE, pitch.y1 * SCALE],
              outline=(255, 0, 0), width=2)
img.save("shots_overlay.png")
print("\nsaved shots_overlay.png")
