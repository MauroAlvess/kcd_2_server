"""python sheet.py out.png name1 name2 ...: ver_<name>.png side by side, two a row, with the names written on them."""
import sys
from PIL import Image, ImageDraw

out = sys.argv[1]
names = sys.argv[2:]
W, H = 700, 394
cols = 2
rows = (len(names) + cols - 1) // cols
sheet = Image.new("RGB", (W * cols, H * rows), (20, 20, 20))
d = ImageDraw.Draw(sheet)
for i, name in enumerate(names):
    im = Image.open(f"ver_{name}.png").convert("RGB")
    im = im.resize((W, H))
    x, y = (i % cols) * W, (i // cols) * H
    sheet.paste(im, (x, y))
    d.rectangle([x, y, x + 260, y + 22], fill=(0, 0, 0))
    d.text((x + 6, y + 4), name, fill=(255, 255, 0))
sheet.save(out)
print(out, sheet.size)
