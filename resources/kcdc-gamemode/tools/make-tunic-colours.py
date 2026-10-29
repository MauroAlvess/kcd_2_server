"""Writes tools/tunic-colours.json: what colour each plain tunic of the tailor's "Túnicas lisas" is, and (2026-10-27) each dye of his Cuman clothes, in a Portuguese word.

    python tools/make-tunic-colours.py [game folder]

The game names a tunic once for all its dyes ("Túnica simples") and numbers the dyes (`Waffenrock02_m01_D`, `_m02_D` ...). The tailor's list must tell them
apart, and the numbers say nothing, so the word is read off the item's own icon (`Libs/UI/Textures/Icons/Items/<IconId>_icon.dds` of `IPL_GameData.pak`): the
average colour of what is opaque in it, the shaded and saturated parts counting more than the grey shadows, put into one of a dozen words. The words are a
help to the eye, not a fact of the game: the list also shows the icon. `make-craft-recipes.py` reads the result (and numbers a word that two dyes share).

Needs Pillow, which `make-craft-recipes.py` does not: that is why the words are kept in a file.
"""

import colorsys
import io
import json
import os
import re
import sys
import zipfile
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
GAME = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(r"C:\Program Files (x86)\Steam\steamapps\common\KingdomComeDeliverance2")
OUT = HERE / "tunic-colours.json"

# The names of the plain surcoats: the ones the game dyes in numbered colours and also makes with a house's arms (the arms are made under "Brasão: <casa>").
SURCOATS = ["Túnica simples", "Túnica com bainha", "Túnica para cavaleiro", "Túnica de montaria", "Túnica ornamentada", "Túnica com fecho"]


def word(rgb) -> str:
    r, g, b = (c / 255 for c in rgb)
    hue, sat, value = colorsys.rgb_to_hsv(r, g, b)
    hue *= 360
    if value < 0.26:
        return "preta"
    if sat < 0.13:
        return "cinza escura" if value < 0.42 else "cinza" if value < 0.62 else "cinza clara"
    if hue < 14 or hue >= 340:
        return "bordô" if value < 0.42 else "vermelha"
    if hue < 38:
        if value < 0.40:
            return "marrom escura"
        return "ferrugem" if sat > 0.52 else "marrom"
    if hue < 52:
        return "ocre" if sat > 0.50 else "bege" if value > 0.5 else "marrom"
    if hue < 70:
        return "amarela" if sat > 0.55 and value > 0.5 else "oliva"
    if hue < 165:
        return "verde escura" if value < 0.4 else "verde" if sat > 0.35 else "oliva"
    if hue < 200:
        return "turquesa"
    if hue < 255:
        return "azul-marinho" if value < 0.38 else "azul-acinzentada" if sat < 0.3 else "azul"
    if hue < 300:
        return "roxa" if value >= 0.34 else "ameixa"
    return "vinho"


def main() -> None:
    source = (HERE / "make-craft-recipes.py").read_text(encoding="utf-8")
    namespace = {"__name__": "generator", "__file__": str(HERE / "make-craft-recipes.py")}
    sys.argv = [str(HERE / "make-craft-recipes.py")] + ([str(GAME)] if len(sys.argv) > 1 else [])
    # The generator up to the point where it sorts what it made: its tables of items and the classification of each piece, and nothing written.
    exec(compile(source[: source.index("RECIPES.sort(")], "make-craft-recipes.py", "exec"), namespace)
    pieces, items, items_doc, house_ids = namespace["pieces"], namespace["ITEMS"], namespace["items_doc"], namespace["HOUSE_IDS"]

    pak = zipfile.ZipFile(os.path.join(GAME, "Data", "IPL_GameData.pak"))
    icons = {n.lower(): n for n in pak.namelist() if "/icons/items/" in n.lower()}
    found = {}
    for row in pieces:
        if row["_unique"] or row["Id"].lower() not in items or row["Id"].lower() in house_ids or not re.search(r"_m\d+(_|$)", row["Name"]):
            continue
        kind = items_doc.classify(row)
        # The six plain surcoats, and the Cuman hats, boots and caftan: every dye of them.
        if not ((row["pt"] in SURCOATS and kind == ("roupa", "Tronco e vestidos")) or (re.search(r"cuman", row["pt"], re.I) and kind is not None and kind[0] == "roupa")):
            continue
        icon = row.get("IconId") or row["Name"]
        key = f"libs/ui/textures/icons/items/{icon}_icon.dds".lower()
        if key not in icons:
            print("sem ícone:", row["Name"])
            continue
        image = Image.open(io.BytesIO(pak.read(icons[key]))).convert("RGBA")
        total, weight = [0.0, 0.0, 0.0], 0.0
        for red, green, blue, alpha in image.getdata():
            if alpha <= 200:
                continue
            _h, sat, value = colorsys.rgb_to_hsv(red / 255, green / 255, blue / 255)
            share = 0.15 + sat * value
            total[0] += red * share
            total[1] += green * share
            total[2] += blue * share
            weight += share
        found[row["Name"]] = word(tuple(round(c / weight) for c in total))
    OUT.write_text(json.dumps(dict(sorted(found.items())), ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(f"{len(found)} túnicas lisas e roupas cumanas -> {OUT}")


main()
