import fitz
from collections import Counter

doc = fitz.open("mex_rsa.pdf")
page = doc[13]
draws = page.get_drawings()
print(f"total drawings: {len(draws)}\n")

# Largest 're' rectangle = candidate pitch frame
rects = []
for d in draws:
    for item in d["items"]:
        if item[0] == "re":
            r = item[1]
            rects.append((r.get_area(), r, d["type"]))
rects.sort(reverse=True, key=lambda t: t[0])
print("largest 're' rects (area, rect, type):")
for a, r, t in rects[:6]:
    print(f"  {a:10.0f}  {r}  {t}")

print("\nall drawings (idx, type, rect w x h, fill, stroke, item ops):")
for i, d in enumerate(draws):
    r = d["rect"]
    ops = Counter(item[0] for item in d["items"])
    print(f"{i:3} {d['type']:>3} w={r.width:7.2f} h={r.height:7.2f} "
          f"at({r.x0:7.2f},{r.y0:7.2f}) fill={d['fill']} stroke={d['color']} "
          f"ops={dict(ops)}")
