"""Builds the images the status panel (ui-src/status.html, packed into ui/status.html) loads, from the original art.

    python tools/make-ui-images.py <folder with the original PNGs> [output folder] [--only name,name]

Why this exists: everything in ui/ travels to every player in ONE package, and a package
that grows past roughly half a megabyte (compressed) never finishes downloading -- the
joining player sits on the loading screen forever. Each image is therefore cut down to the
size the panel actually draws it at (about 1.2 to 1.5x its size on a 1920x1080 screen), not the
size it was painted at. tests/packagesize.test.cjs fails the build if the package gets
near the limit again.

`--only` rebuilds just the named files; the rest of ui/img is left as it is.

Transparency is most of the weight of an ornament, and none of it can be told apart on the paper: the section titles,
the frame corners, the rope, the crests and the hierarchy tree went from alpha quality 40-80 to 12-30 on 2026-10-15 (14 KB, for
the character creator's page), compared side by side at twice their size. The crests are at quality 62: on the panel they cannot be told from 70, and that saved 33 KB
for the Apoiador page. The section titles are 280 px wide for a title drawn about 250 px wide (4.2rem tall): that
made room for the Animais section (2026-10-14), when the package had 9 KB left. The supporter's painting is drawn smaller than it is shown (265 px for
a 342 px slot, 21.4rem: the user had it made 10% and then 30% smaller) and encoded at a higher quality in exchange, which reads sharper than the
reverse for the same bytes, then softened by a third of a pixel to settle the compression
blocks that are left. The guild and faction crests' transparency went from 60-65 to 50 on 2026-10-16 (1.3 KB, for the free
camera's second round): their edges are the same at twice their size, and their size and quality stay.

The Pix QR code is rebuilt module by module from the original: one pixel per module, black
and white, so it stays sharp at any size (the page scales it with `image-rendering:
pixelated`) and weighs half a kilobyte. The amount and the names the Apoiador page shows next
to it are in `PIX` in ui-src/status.html, and must change with a new code.

"titulo apoiador.png" (FAUTORES) was put together from the letters of "titulo facção.png"
and "titulo jogadores.png" on the ornament of the latter; a drawn one can replace it.

The font (ui/fonts/cinzel.woff2) is Cinzel at weight 600 only, the one weight the panel uses:
the variable font with every weight was 23 KB, this one is 13 KB.
"""

import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageFilter

# output name, original file, final width in pixels, quality, crop to the visible art first, alpha quality
IMAGES = [
    ("title-personagem.webp", "titulo personagem.png", 250, 36, True, 8),
    ("title-guildas.webp", "titulo guilda.png", 250, 36, True, 8),
    ("title-faccoes.webp", "titulo facção.png", 250, 36, True, 8),
    ("title-chaves.webp", "titulo chaves.png", 250, 36, True, 8),
    ("title-familia.webp", "titulo familia.png", 250, 36, True, 8),
    ("title-jogadores.webp", "titulo jogadores.png", 250, 36, True, 8),
    ("title-propriedades.webp", "titulo propriedades.png", 250, 36, True, 8),
    ("title-apoiador.webp", "titulo apoiador.png", 250, 36, True, 8),
    ("title-opcoes.webp", "titulo opções.png", 250, 36, True, 8),
    ("title-animais.webp", "titulo animais.png", 250, 36, True, 8),
    # The nominations section's title, "NOMINATIO": taller for its width than the others, so narrower for the same 67 px.
    ("title-nomeacao.webp", "titulo nomeação.png", 250, 36, True, 8),
    ("frame-corner-tl.webp", "border superior esquerda.png", 220, 64, True, 30),
    ("frame-corner-br.webp", "border inferior direita.png", 220, 64, True, 30),
    ("card-top-rope.webp", "borda superior trançada card.png", 480, 76, True, 30),
    ("faction-leao.webp", "Brasão_Régio_com_Leão_Dourado-removebg-preview.png", 320, 60, False, 50),
    ("faction-corvo.webp", "Brasão_Gótico_do_Corvo_Dourado-removebg-preview.png", 320, 60, False, 50),
    ("guild-ferreiro.webp", "Brasão_do_Ferreiro_em_Fogo-removebg-preview.png", 320, 60, False, 50),
    ("guild-cacador.webp", "Brasão_Florestal_do_Cervo_Dourado-removebg-preview.png", 320, 60, False, 50),
    ("guild-taberneiro.webp", "Brasão_Medieval_da_Guilda_da_Cerveja-removebg-preview.png", 320, 60, False, 50),
    ("guild-alquimista.webp", "Emblema_Heráldico_da_Alquimia_Verde-removebg-preview.png", 320, 60, False, 50),
    ("guild-artesao.webp", "Brasão_do_Alfaiate_Dourado-removebg-preview.png", 300, 60, False, 50),
    ("logo-leao-corvo.webp", "Brasão_Medieval_do_Leão_e_Corvo-removebg-preview.png", 260, 60, False, 30),
    # The castle above the texts of a property (Chaves and Propriedades), and the ornament above each card of the family tree.
    ("prop-crest.webp", "brasão propriedades e chaves.png", 170, 58, True, 26),
    ("tree-crest.webp", "brasão arvore genealogica familia.png", 120, 66, True, 30),
    # The crests of the Animais section: one for the horses, one for the dog.
    ("pet-cavalo.webp", "brasão cavalo.png", 170, 62, True, 30),
    ("pet-cachorro.webp", "brasão cachorro.png", 170, 62, True, 30),
    # The cart, the third animal-section crest (2026-10-17): the covered wagon and its horse, wider than tall.
    ("pet-carroca.webp", "brasão cavalo e carroça.png", 170, 60, True, 20),
    # The towns of the Cidadania section (2026-10-17): their coats of arms, from the user's own folder `cidadani` beside `img`.
    ("town-suchdol.webp", "../cidadani/schudol.png", 120, 55, True, 20),
    ("town-raborsch.webp", "../cidadani/raborsch.png", 120, 55, True, 20),
    ("town-maleshov.webp", "../cidadani/maleshov.png", 120, 55, True, 20),
    # The tree of the realm's hierarchy, the drawing the Nomeação page shows until something is picked: 400 px tall (25rem).
    # Cleaned of the specks around it, which also trims it to the figure; the embroidery barely compresses, so it is the
    # heaviest picture after the supporter's painting (24 KB at this size, 30 KB at 446 px and quality 60).
    ("hierarchy-tree.webp", "arvore hierarquica.png", 130, 45, True, 10),
]

# Originals whose background was removed leaving dark specks around the figure: cleaned before they are cut down.
SPECKLED = {"brasão cavalo.png", "brasão cachorro.png", "arvore hierarquica.png", "brasão cavalo e carroça.png", "../cidadani/schudol.png", "../cidadani/raborsch.png", "../cidadani/maleshov.png"}

# The photograph under the paper: drawn at 27 % and multiplied into the colour, so it can be small and rough.
BACKGROUND = ("bg-hud.webp", "background hud H.jpg", 560, 34)

# The Apoiador painting: output, original, width, quality, alpha quality, blur. The painting fades out into transparency
# at its own edges. The art of 2026-10-17 (a noble with a musket, horse, dog and hand cannon) is landscape and had specks
# around it from the background removal: they are cleaned and the figure cropped before it is cut to a width. It is drawn
# 24rem tall (384 px on a 1080 screen, 472 px wide), so it is encoded at that size: the previous painting (411 px square,
# 44.9 KB) was kept at a higher quality than size for sharpness, and this one keeps to the same weight.
SUPPORTER = ("supporter.webp", "apoiador.png", 472, 72, 45, 0.0)

# The Pix QR code: output, original.
PIX_QR = ("pix-qr.png", "qrcode-pix.png")


def drop_specks(image: Image.Image, keep_share: float = 0.02) -> Image.Image:
    """Clears the specks a background removal left around a figure.

    The visible pixels are grouped into patches that touch (on a half-size copy, slightly grown so a thin gold line
    still joins what it joins); a patch smaller than `keep_share` of the largest is a speck and goes transparent.
    Thin ornaments that belong to the figure touch it, so they stay, which an erosion would not leave.
    """
    alpha = image.getchannel("A")
    width, height = alpha.size
    small = alpha.point(lambda value: 255 if value > 16 else 0).filter(ImageFilter.MaxFilter(3)).resize((width // 2, height // 2), Image.NEAREST)
    sw, sh = small.size
    pixels = small.load()
    label = [0] * (sw * sh)
    sizes = [0]
    for y in range(sh):
        for x in range(sw):
            if not pixels[x, y] or label[y * sw + x]:
                continue
            current = len(sizes)
            label[y * sw + x] = current
            stack = [(x, y)]
            count = 0
            while stack:
                cx, cy = stack.pop()
                count += 1
                for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
                    if 0 <= nx < sw and 0 <= ny < sh and pixels[nx, ny] and not label[ny * sw + nx]:
                        label[ny * sw + nx] = current
                        stack.append((nx, ny))
            sizes.append(count)
    largest = max(sizes[1:], default=0)
    keep = {index for index in range(1, len(sizes)) if sizes[index] >= largest * keep_share}
    mask = Image.new("L", (sw, sh), 0)
    marks = mask.load()
    for y in range(sh):
        for x in range(sw):
            if label[y * sw + x] in keep:
                marks[x, y] = 255
    mask = mask.resize((width, height), Image.NEAREST).filter(ImageFilter.MaxFilter(5))
    cleaned = image.copy()
    cleaned.putalpha(ImageChops.darker(alpha, mask))
    return cleaned


def visible_box(image: Image.Image, pad: int) -> tuple[int, int, int, int]:
    left, top, right, bottom = image.getbbox()
    width, height = image.size
    return max(0, left - pad), max(0, top - pad), min(width, right + pad), min(height, bottom + pad)


def qr_modules(path: Path) -> Image.Image:
    """The QR code as one pixel per module, with the four-module quiet zone the standard asks for."""
    gray = Image.open(path).convert("L")
    dark = gray.point(lambda value: 255 if value < 128 else 0)
    left, top, right, bottom = dark.getbbox()
    # The top-left finder pattern is seven modules wide: its first row is one dark run.
    run = 0
    while left + run < right and gray.getpixel((left + run, top)) < 128:
        run += 1
    module = run / 7
    count = round((right - left) / module)
    module = (right - left) / count
    quiet = 4
    out = Image.new("1", (count + 2 * quiet, count + 2 * quiet), 1)
    for row in range(count):
        for column in range(count):
            x = int(left + (column + 0.5) * module)
            y = int(top + (row + 0.5) * module)
            if gray.getpixel((x, y)) < 128:
                out.putpixel((column + quiet, row + quiet), 0)
    return out


def main() -> None:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    only = None
    if "--only" in sys.argv:
        only = set(sys.argv[sys.argv.index("--only") + 1].split(","))
        args = [a for a in args if a not in only and "," not in a]
    if not args:
        sys.exit(__doc__)
    source = Path(args[0])
    target = Path(args[1]) if len(args) > 1 else Path(__file__).resolve().parent.parent / "ui" / "img"
    target.mkdir(parents=True, exist_ok=True)
    wanted = lambda name: only is None or name in only  # noqa: E731

    total = 0
    for name, original, width, quality, crop, alpha_quality in IMAGES:
        if not wanted(name):
            continue
        image = Image.open(source / original).convert("RGBA")
        if original in SPECKLED:
            image = drop_specks(image)
        if crop:
            image = image.crop(visible_box(image, 5))
        image = image.resize((width, round(width * image.height / image.width)), Image.LANCZOS)
        out = target / name
        image.save(out, format="WEBP", quality=quality, method=6, alpha_quality=alpha_quality)
        size = out.stat().st_size
        total += size
        print(f"{name:26} {image.width:4}x{image.height:<4} {size / 1024:6.1f} KB")

    name, original, width, quality = BACKGROUND
    if wanted(name):
        photo = Image.open(source / original).convert("RGB")
        photo = photo.resize((width, round(width * photo.height / photo.width)), Image.LANCZOS)
        out = target / name
        photo.save(out, format="WEBP", quality=quality, method=6)
        total += out.stat().st_size
        print(f"{name:26} {photo.width:4}x{photo.height:<4} {out.stat().st_size / 1024:6.1f} KB")

    name, original, width, quality, alpha_quality, blur = SUPPORTER
    if wanted(name):
        art = drop_specks(Image.open(source / original).convert("RGBA"))
        art = art.crop(visible_box(art, 5))
        art = art.resize((width, round(width * art.height / art.width)), Image.LANCZOS)
        if blur:
            art = art.filter(ImageFilter.GaussianBlur(blur))
        out = target / name
        art.save(out, format="WEBP", quality=quality, method=6, alpha_quality=alpha_quality)
        total += out.stat().st_size
        print(f"{name:26} {art.width:4}x{art.height:<4} {out.stat().st_size / 1024:6.1f} KB")

    name, original = PIX_QR
    if wanted(name) and not (source / original).exists():
        print(f"{name:26} kept as it is: the original {original} is not in {source}")
    elif wanted(name):
        code = qr_modules(source / original)
        out = target / name
        code.save(out, format="PNG", optimize=True)
        total += out.stat().st_size
        print(f"{name:26} {code.width:4}x{code.height:<4} {out.stat().st_size / 1024:6.1f} KB  (one pixel per module)")
    print(f"{'total':26} {total / 1024:17.1f} KB")


if __name__ == "__main__":
    main()
