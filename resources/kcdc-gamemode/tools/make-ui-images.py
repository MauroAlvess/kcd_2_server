"""Builds the images the status panel (ui-src/status.html, packed into ui/status.html) loads, from the original art.

    python tools/make-ui-images.py <folder with the original PNGs> [output folder] [--only name,name]

Why this exists: everything in ui/ travels to every player in ONE package, and a package
that grows past roughly half a megabyte (compressed) never finishes downloading -- the
joining player sits on the loading screen forever. Each image is therefore cut down to the
size the panel actually draws it at (about 1.2 to 1.5x its size on a 1920x1080 screen), not the
size it was painted at. tests/packagesize.test.cjs fails the build if the package gets
near the limit again.

`--only` rebuilds just the named files; the rest of ui/img is left as it is. Most of the panel's pictures are not files of ui/img any more
but entries of data/ui-images.json (see `LOCAL`).

Transparency is most of the weight of an ornament, and none of it can be told apart on the paper: the section titles,
the frame corners, the rope, the crests and the hierarchy tree went from alpha quality 40-80 to 12-30 on 2026-10-15 (14 KB, for
the character creator's page), compared side by side at twice their size. The crests are at quality 62: on the panel they cannot be told from 70, and that saved 33 KB
for the Apoiador page. The section titles are 280 px wide for a title drawn about 250 px wide (4.2rem tall): that
made room for the Animais section (2026-10-14), when the package had 9 KB left. The supporter's painting is drawn smaller than it is shown (265 px for
a 342 px slot, 21.4rem: the user had it made 10% and then 30% smaller) and encoded at a higher quality in exchange, which reads sharper than the
reverse for the same bytes, then softened by a third of a pixel to settle the compression
blocks that are left. The guild and faction crests' transparency went from 60-65 to 50 on 2026-10-16 (1.3 KB, for the free
camera's second round): their edges are the same at twice their size, and their size and quality stay.

Almost everything above was squeezed for the package, and the package is not where these pictures live any more
(2026-10-18 and 2026-10-20 moved them out, see `LOCAL` and `SERVER_CRESTS`): the panel scales itself to the screen
(`fit()` in ui-src/status.html multiplies its rem size by the screen's own resolution over 1920x1080, and since
2026-10-25 again by the player's own "Resolução da interface" choice, up to 125% more), so a picture cut down for a
250 px slot at 1x is soft on a 1440p screen and squashed on a 4K one at 110%, the way `tree-crest` was (see its own
note). 2026-10-25 (user: "agora que estamos usando as imagens baixando da vps, podemos devolver a qualidade delas,
já que eu aperfeiçoei todas; os KBs de cada uma são bem leves"): every picture the server sends is cut now to about
twice the pixels of its largest on-screen size (`.head-title`, `.crestwrap`, `.pd-crest`...), at a quality the
originals' own resolution has room for, measured against the pictures' real CSS sizes rather than guessed. The three
still in the package (`LOCAL`) keep a smaller margin: the package has about 250 KB to spare of its half-megabyte limit,
but a join that fails costs every player, not one page.

The Pix QR code is rebuilt module by module from the original: one pixel per module, black
and white, so it stays sharp at any size (the page scales it with `image-rendering:
pixelated`) and weighs half a kilobyte. The amount and the names the Apoiador page shows next
to it are in `PIX` in ui-src/status.html, and must change with a new code.

"titulo apoiador.png" (FAUTORES) was put together from the letters of "titulo facção.png"
and "titulo jogadores.png" on the ornament of the latter; a drawn one can replace it.

The font (ui/fonts/cinzel.woff2) is Cinzel at weight 600 only, the one weight the panel uses:
the variable font with every weight was 23 KB, this one is 13 KB.
"""

import base64
import io
import json
import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageFilter

# output name, original file, final width in pixels, quality, crop to the visible art first, alpha quality
# (2026-10-18: the guild and faction crests went from 52/40 to 48/30, 6 KB for the trades' page; side by side at twice their size
# the two cannot be told apart)
IMAGES = [
    # Drawn at 4.2rem tall (.head-title): 300 px keeps title-personagem close to its eleven siblings below while it alone
    # still counts against the package (LOCAL); the others answer to no such limit any more.
    ("title-personagem.webp", "titulo personagem.png", 300, 62, True, 28),
    # 420 px (was 250, for the package): 4.2rem is 67 px at 1080p, up to 168 px on a 4K screen at the new 125% interface size.
    ("title-guildas.webp", "titulo guilda.png", 420, 80, True, 45),
    ("title-chaves.webp", "titulo chaves.png", 420, 80, True, 45),
    ("title-familia.webp", "titulo familia.png", 420, 80, True, 45),
    ("title-jogadores.webp", "titulo jogadores.png", 420, 80, True, 45),
    ("title-propriedades.webp", "titulo propriedades.png", 420, 80, True, 45),
    ("title-apoiador.webp", "titulo apoiador.png", 420, 80, True, 45),
    ("title-opcoes.webp", "titulo opções.png", 420, 80, True, 45),
    ("title-animais.webp", "titulo animais.png", 420, 80, True, 45),
    # The nominations section's title, "NOMINATIO": taller for its width than the others, so narrower for the same height.
    ("title-nomeacao.webp", "titulo nomeação.png", 420, 80, True, 45),
    # The administrator's NPCs section (2026-10-31): the user's "NON LUSOR PERSONA" lettering, the same size as its siblings.
    ("title-npcs.webp", "titulo npc.png", 420, 80, True, 45),
    # The Cartas section (2026-11-02): the user's "EPISTULAE" lettering, the same size as its siblings.
    ("title-cartas.webp", "titulo cartas.png", 420, 80, True, 45),
    # LOCAL, so still modest: .orn is 10rem (160 px at 1080p); 260 covers a 1440p screen without much of the package.
    ("frame-corner-tl.webp", "border superior esquerda.png", 260, 72, True, 40),
    ("frame-corner-br.webp", "border inferior direita.png", 260, 72, True, 40),
    # 380 px (was 300-320): .detail .crestwrap is 23rem, 368 px at 1080p. Kept narrower than a single-fetch picture's 2x
    # headroom (compare the pet-* pictures, below) because the Guildas gallery asks for every one of these at
    # once (one card each), so their weight multiplies by how many guilds exist, unlike a picture fetched on its own.
    ("guild-ferreiro.webp", "Brasão_do_Ferreiro_em_Fogo-removebg-preview.png", 380, 72, False, 48),
    ("guild-cacador.webp", "Brasão_Florestal_do_Cervo_Dourado-removebg-preview.png", 380, 72, False, 48),
    ("guild-taberneiro.webp", "Brasão_Medieval_da_Guilda_da_Cerveja-removebg-preview.png", 380, 72, False, 48),
    ("guild-alquimista.webp", "Emblema_Heráldico_da_Alquimia_Verde-removebg-preview.png", 380, 72, False, 48),
    ("guild-artesao.webp", "Brasão_do_Alfaiate_Dourado-removebg-preview.png", 380, 72, False, 48),
    # The Coletores (2026-10-21): the user's own art, a large square with a margin round it, cut to the figure first.
    ("guild-coletor.webp", "Brasão Coletor.png", 380, 72, True, 48),
    # The Agricultores (2026-10-22): the user's own art, painted on a checkerboard (see `CHECKERED`), cut to the figure once that is gone.
    ("guild-agricultor.webp", "brasão agricultor.png", 380, 72, True, 48),
    # The Domadores (user, 2026-10-25: "adicionei dentro da pasta img o brasão domador, vamos separar a mecânica de domar cavalo totalmente da
    # guilda dos agricultores e criar a guilda de domadores"): the user's own art, a navy and gold shield with horses, background removed.
    ("guild-domador.webp", "brasão domador.png", 380, 72, True, 48),
    # 240 px since 2026-10-25 (drawn 4.2rem wide, 67 px at 1080p and 134 at 4K; at 120 px it went soft and looked squashed), alpha 60.
    ("tree-crest.webp", "brasão arvore genealogica familia.png", 240, 72, True, 60),
    # The crests of the Animais section: one for the horses, one for the dog. Same slot as prop-crest (.pd-crest, 10.5rem).
    ("pet-cavalo.webp", "brasão cavalo.png", 320, 80, True, 50),
    ("pet-cachorro.webp", "brasão cachorro.png", 320, 80, True, 50),
    # The cart, the third animal-section crest (2026-10-17): the covered wagon and its horse, wider than tall.
    ("pet-carroca.webp", "brasão cavalo e carroça.png", 300, 78, True, 45),
    # The towns of the Cidadania section (2026-10-17): their coats of arms, from the user's own art (the folder `cidadani`, now in `img`).
    # 380 px, the same slot and the same reasoning as the guild crests above (.crestwrap, 23rem; the Cidadania gallery
    # shows every town at once): the five towns (see SERVER_CRESTS) read alike.
    ("town-suchdol.webp", "schudol.png", 380, 72, True, 48),
    ("town-raborsch.webp", "raborsch.png", 380, 72, True, 48),
    ("town-maleshov.webp", "maleshov.png", 380, 72, True, 48),
    # The tree of the realm's hierarchy, the drawing the Nomeação page shows until something is picked: .tree-art is 25rem
    # tall (400 px at 1080p); 130 px (314 tall) was soft even at that. 320 (87 KB) rather than a fuller 400 (144 KB): a
    # single picture, fetched once, but no reason to triple it for a placeholder nobody reads.
    ("hierarchy-tree.webp", "arvore hierarquica.png", 320, 68, True, 40),
]

# 2026-10-21 (the user: "as imagens do f2 vamos deixar para vir do servidor assim o f2 fica mais leve"): every picture of the panel but the
# ones below stays OUT of the package (it was 305 KB of it) and goes in `data/ui-images.json` as a data URL under its name without the
# extension; the page asks for each by name when it draws it (`status.image`, src/server/ui-images.ts) and the client keeps what it was sent.
# These stay in ui/img because other pages or the first paint need them at once: the first section's title (the character creator uses it
# too), the frame's corners (the creator and the trades' page too), the photograph and the paper under everything, and the Pix code.
LOCAL = {"title-personagem.webp", "frame-corner-tl.webp", "frame-corner-br.webp"}

# Originals whose background was removed leaving dark specks around the figure: cleaned before they are cut down.
SPECKLED = {"brasão domador.png", "Brasão Coletor.png", "brasão cavalo.png", "brasão cachorro.png", "arvore hierarquica.png", "brasão cavalo e carroça.png", "schudol.png", "raborsch.png", "maleshov.png", "Brasão Medieval de Kuttenberg.png", "Brasão Pschitoky.png"}

# Originals whose "transparent" background is a painted checkerboard (white and light grey squares, fully opaque): it is taken away first
# (`drop_checker`). The Agricultores' crest of 2026-10-22 came so.
CHECKERED = {"brasão agricultor.png"}

# The photograph under the paper: drawn at 27 % and multiplied into the colour, so it can be small and rough.
# 700 px (was 560): stretched behind the whole panel (up to 1920 px wide), so even this bump is still an upscale; LOCAL,
# so kept modest against the package rather than matched to that width.
BACKGROUND = ("bg-hud.webp", "background hud H.jpg", 700, 46)

# The Apoiador painting: output, original, width, quality, alpha quality, blur. The painting fades out into transparency
# at its own edges. The art of 2026-10-17 (a noble with a musket, horse, dog and hand cannon) is landscape and had specks
# around it from the background removal: they are cleaned and the figure cropped before it is cut to a width. It is drawn
# 24rem tall (384 px on a 1080 screen, 472 px wide), so it is encoded at that size: the previous painting (411 px square,
# 44.9 KB) was kept at a higher quality than size for sharpness, and this one keeps to the same weight.
# 560 px (was 472), quality and transparency restored now that it is the server's to send, not the package's: .pd-art
# caps at 17rem (272 px) tall, so this is already above a 2x screen there.
SUPPORTER = ("supporter.webp", "apoiador.png", 560, 76, 50, 0.0)
# 2026-10-18: out of the package (40 KB of it), sent by the server when the Apoiador section opens (src/server/ui-images.ts), as
# "supporter" in data/ui-images.json, which is where any picture a page needs only when it is open belongs.
UI_IMAGES_FILE = Path(__file__).resolve().parent.parent / "data" / "ui-images.json"

# Crests the package has no room for (2026-10-20: 14 KB of the 21 that were left): sent by the server when the Cidadania section draws
# them, as data URLs in `data/ui-images.json` (src/server/ui-images.ts, asked for by the page as `status.image`), the way the
# Apoiador painting is. A town whose crest is one of these has `@<name>` for its crest in src/server/citizenship.ts. Name, original,
# width, quality, alpha quality. Kuttenberg's: "dentro de IMG temos os brasões de Kuttenberg e já adicione a cidadania de Kuttenberg".
# Pschitoky's (2026-10-25: "adicione a cidadania de Pschitoky por favor, o brasão está na pasta img").
SERVER_CRESTS = [
    ("town-kuttenberg", "Brasão Medieval de Kuttenberg.png", 380, 72, 48),
    ("town-pschitoky", "Brasão Pschitoky.png", 380, 72, 48),
    # The letters of the Cartas section (2026-11-02, the user's "carta fechada" and "carta aberta"): the closed one, tied with twine, is drawn up to 17rem
    # tall in the detail (272 px at 1080p) with the seal on its knot, and small on the rows of letters not yet read; the open page beside a letter that
    # was read and on the rows of those. Both are fine illuminations that cost much at full quality (460 px of the closed one was 120 KB): about 1.5x
    # their largest size, at a quality their detail still reads at.
    ("carta-fechada", "carta fechada.png", 400, 70, 40),
    ("carta-aberta", "carta aberta.png", 360, 72, 50),
]

# The Pix QR code: output, original.
PIX_QR = ("pix-qr.png", "qrcode-pix.png")

# The titles of the trades' page (ui-src/craft.html), 2026-10-18: NOT in ui/img. The client package had no room for them (30 KB at
# the panel's title size, 5 KB left), so they live on the server, in data/craft-titles.json as data URLs, and go with the page
# when it opens (src/server/craft-titles.ts); being out of the package they can be sharper than the panel's titles. Drawn
# 3.6rem tall (58 px at 1080p, 77 px at 1440p, about 280 px wide): 330 px wide, quality 55, alpha 30. `--only craft-titles`.
# trade (the page's station id), original, width, quality, alpha quality
CRAFT_TITLES = [
    # 420 px (was 330): the trades' own .head-title is 3.6rem, 58 px at 1080p; 420 matches the panel's titles above.
    ("fogo", "titulo cozinhar.png", 420, 80, 45),
    ("defumador", "titulo defumador.png", 420, 80, 45),
    ("secador", "titulo secador.png", 420, 80, 45),
    ("forja", "titulo ferreiro.png", 420, 80, 45),
    # The grindstone's page (2026-10-27, src/server/repair.ts): "REPARO".
    ("reparo", "titulo reparo.png", 420, 80, 45),
    ("alquimia", "titulo alquimia.png", 420, 80, 45),
    ("costura", "titulo costurar.png", 420, 80, 45),
    # The gardens' page of the Agricultores (2026-10-22): "AGRICOLA".
    ("horta", "titulo agricultor.png", 420, 80, 45),
    # The trade between players on the same page (2026-10-18): src/server/trade.ts sends it with a trade's first page.
    ("negociacao", "titulo negociação.png", 420, 80, 45),
    # The entry door's title (2026-10-24 for the welcome form, now the door's: src/server/entry.ts): "BENE ADVENISTI", its own .head-title 5.2rem: fetched on its own, so the same 2x headroom as the panel's titles.
    ("boas-vindas", "titulo boas vindas.png", 460, 78, 42),
    # The mural's page (src/server/mural.ts): "MURALIS", 3.7rem (59 px), AND the three posters below travel together in one
    # message, the first time a player opens any board (`mural.ts` artJson, cached after): tests/mural.test.cjs holds each
    # under 24,000 characters of data URL (one piece, src/server/big-emit.ts) so that first open stays one round trip, not
    # the Guildas-gallery kind of picture that is fine to split into several.
    ("mural", "titulo mural.png", 350, 74, 40),
    # The three kinds of letter (user, 2026-10-24: "cartas de procurado, cartaz de solicitações de recursos e cartaz de avisos"):
    # drawn only 6rem wide in the list (96 px at 1080p), so 190 is still ample; held to the same one-message budget as "mural".
    ("cartaz-procurado", "cartaz procurado.png", 190, 66, 40),
    ("cartaz-recursos", "cartaz solicitação recursos.png", 190, 66, 40),
    ("cartaz-avisos", "cartaz avisos.png", 190, 66, 40),
]
CRAFT_TITLES_FILE = Path(__file__).resolve().parent.parent / "data" / "craft-titles.json"


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


def drop_checker(image: Image.Image, light: int = 200, neutral: int = 12, rim_passes: int = 2) -> Image.Image:
    """Takes away a background painted as a checkerboard (the look of transparency, but opaque pixels).

    From every pixel of the border, a fill runs through the light, grey ones (all three channels at `light` or more and within `neutral` of
    each other): that is the board, and it goes transparent. The figure's own whites are not reached, being inside its outline; its warm
    creams are not grey. Then the light grey rim the antialiasing left round the figure goes too, `rim_passes` pixels deep.
    """
    image = image.convert("RGBA")
    width, height = image.size
    pixels = image.load()

    def board(x: int, y: int) -> bool:
        r, g, b, _a = pixels[x, y]
        return min(r, g, b) >= light and max(r, g, b) - min(r, g, b) <= neutral

    seen = bytearray(width * height)
    stack = [(x, y) for x in range(width) for y in (0, height - 1)] + [(x, y) for y in range(height) for x in (0, width - 1)]
    stack = [(x, y) for x, y in stack if board(x, y)]
    for x, y in stack:
        seen[y * width + x] = 1
    while stack:
        x, y = stack.pop()
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < width and 0 <= ny < height and not seen[ny * width + nx] and board(nx, ny):
                seen[ny * width + nx] = 1
                stack.append((nx, ny))
    for y in range(height):
        for x in range(width):
            if seen[y * width + x]:
                r, g, b, _a = pixels[x, y]
                pixels[x, y] = (r, g, b, 0)
    for _ in range(rim_passes):
        rim = []
        for y in range(1, height - 1):
            for x in range(1, width - 1):
                r, g, b, a = pixels[x, y]
                if a == 0 or min(r, g, b) < 150 or max(r, g, b) - min(r, g, b) > 30:
                    continue
                if any(pixels[nx, ny][3] == 0 for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1))):
                    rim.append((x, y))
        for x, y in rim:
            r, g, b, _a = pixels[x, y]
            pixels[x, y] = (r, g, b, 0)
    return image


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
        if original in CHECKERED:
            image = drop_checker(image)
        if original in SPECKLED:
            image = drop_specks(image)
        if crop:
            image = image.crop(visible_box(image, 5))
        image = image.resize((width, round(width * image.height / image.width)), Image.LANCZOS)
        if name not in LOCAL:
            buffer = io.BytesIO()
            image.save(buffer, format="WEBP", quality=quality, method=6, alpha_quality=alpha_quality)
            served = json.loads(UI_IMAGES_FILE.read_text(encoding="utf-8")) if UI_IMAGES_FILE.exists() else {}
            served[name.rsplit(".", 1)[0]] = "data:image/webp;base64," + base64.b64encode(buffer.getvalue()).decode("ascii")
            UI_IMAGES_FILE.parent.mkdir(parents=True, exist_ok=True)
            UI_IMAGES_FILE.write_text(json.dumps(served, indent=1) + chr(10), encoding="utf-8")
            print(f"{name:26} {image.width:4}x{image.height:<4} {len(buffer.getvalue()) / 1024:6.1f} KB  (server, not in the package)")
            continue
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
        buffer = io.BytesIO()
        art.save(buffer, format="WEBP", quality=quality, method=6, alpha_quality=alpha_quality)
        served = json.loads(UI_IMAGES_FILE.read_text(encoding="utf-8")) if UI_IMAGES_FILE.exists() else {}
        served["supporter"] = "data:image/webp;base64," + base64.b64encode(buffer.getvalue()).decode("ascii")
        UI_IMAGES_FILE.parent.mkdir(parents=True, exist_ok=True)
        UI_IMAGES_FILE.write_text(json.dumps(served, indent=1) + chr(10), encoding="utf-8")
        print(f"{name:26} {art.width:4}x{art.height:<4} {len(buffer.getvalue()) / 1024:6.1f} KB  (server, not in the package)")

    for name, original, width, quality, alpha_quality in SERVER_CRESTS:
        if not wanted(name):
            continue
        crest = drop_specks(Image.open(source / original).convert("RGBA"))
        crest = crest.crop(visible_box(crest, 5))
        crest = crest.resize((width, round(width * crest.height / crest.width)), Image.LANCZOS)
        buffer = io.BytesIO()
        crest.save(buffer, format="WEBP", quality=quality, method=6, alpha_quality=alpha_quality)
        served = json.loads(UI_IMAGES_FILE.read_text(encoding="utf-8")) if UI_IMAGES_FILE.exists() else {}
        served[name] = "data:image/webp;base64," + base64.b64encode(buffer.getvalue()).decode("ascii")
        UI_IMAGES_FILE.parent.mkdir(parents=True, exist_ok=True)
        UI_IMAGES_FILE.write_text(json.dumps(served, indent=1) + chr(10), encoding="utf-8")
        print(f"{name:26} {crest.width:4}x{crest.height:<4} {len(buffer.getvalue()) / 1024:6.1f} KB  (server, not in the package)")

    name, original = PIX_QR
    if wanted(name) and not (source / original).exists():
        print(f"{name:26} kept as it is: the original {original} is not in {source}")
    elif wanted(name):
        code = qr_modules(source / original)
        out = target / name
        code.save(out, format="PNG", optimize=True)
        total += out.stat().st_size
        print(f"{name:26} {code.width:4}x{code.height:<4} {out.stat().st_size / 1024:6.1f} KB  (one pixel per module)")
    if wanted("craft-titles"):
        urls = {}
        for station, original, width, quality, alpha_quality in CRAFT_TITLES:
            image = Image.open(source / original).convert("RGBA")
            image = image.crop(visible_box(image, 5))
            image = image.resize((width, round(width * image.height / image.width)), Image.LANCZOS)
            buffer = io.BytesIO()
            image.save(buffer, format="WEBP", quality=quality, method=6, alpha_quality=alpha_quality)
            urls[station] = "data:image/webp;base64," + base64.b64encode(buffer.getvalue()).decode("ascii")
            print(f"{'craft title ' + station:26} {image.width:4}x{image.height:<4} {len(buffer.getvalue()) / 1024:6.1f} KB  (server, not in the package)")
        CRAFT_TITLES_FILE.parent.mkdir(parents=True, exist_ok=True)
        CRAFT_TITLES_FILE.write_text(json.dumps(urls, indent=1) + chr(10), encoding="utf-8")
    print(f"{'total':26} {total / 1024:17.1f} KB")


if __name__ == "__main__":
    main()
