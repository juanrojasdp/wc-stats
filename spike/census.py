import fitz

doc = fitz.open("mex_rsa.pdf")
print(f"{'page':>4} {'drawings':>9} {'images':>7}  first text snippet")
shots_page = None
for i, page in enumerate(doc):
    n_draw = len(page.get_drawings())
    n_img = len(page.get_image_info())
    text = page.get_text()
    snippet = " ".join(text.split())[:70]
    norm = " ".join(text.split())
    if "Attempts at Goal Mexico" in norm and shots_page is None:
        shots_page = i
    print(f"{i:>4} {n_draw:>9} {n_img:>7}  {snippet}")

print("\nShots page (contains 'Attempts at Goal Mexico'):", shots_page)

if shots_page is not None:
    page = doc[shots_page]
    pix = page.get_pixmap(dpi=200)
    pix.save("shots_ref.png")
    print("Saved shots_ref.png", pix.width, "x", pix.height,
          "| page rect:", page.rect)
