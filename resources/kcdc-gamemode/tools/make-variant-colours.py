"""Writes tools/variant-colours.json: what colour each dye of a garment is, in a Portuguese word (2026-10-31, the colour picker of the artisan's page).

    python tools/make-variant-colours.py [game folder]

The game names a garment once for all its dyes ("Túnica simples", "Capuz simples") and numbers the dyes (`Waffenrock02_m01_D`, `_m02_D` ...). The artisan's page lets
the player pick the colour of what they sew, and the numbers say nothing, so the word is read off the item's own icon (`Libs/UI/Textures/Icons/Items/<IconId>_icon.dds`
of `IPL_GameData.pak`): the average colour of what is opaque in it, the shaded and saturated parts counting more than the grey shadows, put into one of a couple of dozen
words. The words are a help to the eye, not a fact of the game: the picker also shows the icon. `make-craft-recipes.py` reads the result (and numbers a word that two dyes
of one garment share).

The words are the colour as a noun, in the masculine ("Cor: preto", "Cor: marrom escuro"), so that one word fits a hat, a coat and a pair of boots alike.

The forge's pieces (2026-11-03, when its armour got the same picker): what changes from one class of a piece of metal to the next is the cloth and the trim on it and how dark the metal
is, and the steel takes most of the icon, so the average says "cinza" of them all. For them the word comes from the game's own table instead: `Libs/Tables/Character/CharacterComponent.xml`
of `Tables.pak` gives each class the material of each of its parts (`HelmetStrap=Nubuck_red`, `HelmetBase=Iron_dark`), inherited down the tree, and `metal_word` names the colour of the
cloth and the leather, and otherwise the tone of the steel. Some parts are out of sight (the lining of a cuirass), so a colour counts only when the piece's icon shows it, and the page shows
that icon beside the word.

Needs Pillow, which `make-craft-recipes.py` does not: that is why the words are kept in a file. It replaces `make-tunic-colours.py`, which read only the plain tunics
and the Cuman clothes.
"""

import colorsys
import importlib.util
import io
import json
import os
import re
import sys
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
GAME = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(r"C:\Program Files (x86)\Steam\steamapps\common\KingdomComeDeliverance2")
OUT = HERE / "variant-colours.json"

spec = importlib.util.spec_from_file_location("items_doc", HERE / "make-items-doc.py")
items_doc = importlib.util.module_from_spec(spec)
sys.argv = sys.argv[:1] + ([str(GAME)] if len(sys.argv) > 1 else [])
spec.loader.exec_module(items_doc)

DYED = re.compile(r"_m\d+(_|$)")
# The forge's armour, by the game's sound for it (the same pattern as `make-craft-recipes.py`), and any class of it with a mark after `_m`: the numbered ones and `_mAlberich`.
METAL = re.compile(r"armor_(mail|chainmail|plate|helmet|metal|gauntlets)", re.I)
MARKED = re.compile(r"_m[A-Za-z0-9]+(_|$)")
# The colours in the names of the game's materials, the first found: a material of bare metal says nothing of them.
MATERIAL_COLOURS = (
    ("burgundy", "bordô"), ("wine", "bordô"), ("crimson", "vermelho"), ("red", "vermelho"), ("green", "verde"), ("teal", "turquesa"), ("blue", "azul"),
    ("yellow", "amarelo"), ("gold", "dourado"), ("purple", "roxo"), ("violet", "roxo"),
)
# The colours an icon can show, as the words of the materials: what of the opaque part of the icon has to have that colour for it to count. A brown is no colour here: most pieces have straps.
SHOWN_SHARE = 0.01
ICON_SHARE = 0.02
ICON_WORD = {"red": "vermelho", "yellow": "dourado", "green": "verde", "teal": "turquesa", "blue": "azul", "purple": "roxo"}
WORD_FAMILY = {"bordô": "red", "vermelho": "red", "verde": "green", "turquesa": "teal", "azul": "blue", "amarelo": "yellow", "dourado": "yellow", "roxo": "purple"}
BARE_METAL = re.compile(r"iron|polished|pewter|scratched|hammered|chainmail|steel|dull|rust|nodraw|placeholder", re.I)
# The parts of a piece that show most: the cloth over the metal counts more than a strap or a seam. The far-away models (`Uberlod...`) and the seams count for nothing.
UNSEEN_PART = re.compile(r"^uberlod|stitch|rivet|buckle", re.I)
BIG_PART = re.compile(r"fabric|base|cloth|garment|coif|cape|tabard|enforcement|strap", re.I)
# The tone of the steel, by the material of its main part.
DARK_METAL = re.compile(r"dark|darker|black", re.I)
BRIGHT_METAL = re.compile(r"bright|polished$", re.I)


def word(rgb) -> str:
    r, g, b = (c / 255 for c in rgb)
    hue, sat, value = colorsys.rgb_to_hsv(r, g, b)
    hue *= 360
    if value < 0.26:
        return "preto"
    if sat < 0.13:
        return "cinza escuro" if value < 0.42 else "cinza" if value < 0.62 else "cinza claro"
    if hue < 14 or hue >= 340:
        return "bordô" if value < 0.42 else "vermelho"
    if hue < 38:
        if value < 0.40:
            return "marrom escuro"
        return "ferrugem" if sat > 0.52 else "marrom"
    if hue < 52:
        return "ocre" if sat > 0.50 else "bege" if value > 0.5 else "marrom"
    if hue < 70:
        return "amarelo" if sat > 0.55 and value > 0.5 else "oliva"
    if hue < 165:
        return "verde escuro" if value < 0.4 else "verde" if sat > 0.35 else "oliva"
    if hue < 200:
        return "turquesa"
    if hue < 255:
        return "azul-marinho" if value < 0.38 else "azul acinzentado" if sat < 0.3 else "azul"
    if hue < 300:
        return "roxo" if value >= 0.34 else "ameixa"
    return "vinho"


def materials_of(path) -> dict:
    """{the name of a man's piece of clothing: {its part: the material of it}}, with what each one inherits from the components it is derived from."""
    tables = zipfile.ZipFile(path)
    root = ET.fromstring(tables.read("Libs/Tables/Character/CharacterComponent.xml").decode("utf-8-sig"))
    male = next(node for node in root.iter("Component") if node.get("Name") == "Male")
    found = {}

    def walk(node, inherited):
        mine = dict(inherited)
        block = node.find("Features")
        for feature in block.findall("Feature") if block is not None else ():
            if feature.get("Material"):
                mine[feature.get("Name")] = feature.get("Material")
        if node.get("Name"):
            found[node.get("Name")] = mine
        derived = node.find("DerivedComponents")
        for child in derived if derived is not None else ():
            walk(child, mine)

    walk(next(node for node in male.find("DerivedComponents") if node.get("Name") == "Clothing"), {})
    return found


def icon_colours(image) -> dict:
    """{a colour: the share of the opaque part of the icon that has it}."""
    counts = {}
    opaque = 0
    for red, green, blue, alpha in image.getdata():
        if alpha <= 200:
            continue
        opaque += 1
        hue, sat, value = colorsys.rgb_to_hsv(red / 255, green / 255, blue / 255)
        hue *= 360
        if sat < 0.38 or value < 0.2 or 14 <= hue < 38:
            continue
        family = "red" if hue < 14 or hue >= 340 else "yellow" if hue < 70 else "green" if hue < 165 else "teal" if hue < 200 else "blue" if hue < 255 else "purple"
        counts[family] = counts.get(family, 0) + 1
    return {family: count / max(1, opaque) for family, count in counts.items()}


def metal_word(parts: dict, image) -> str:
    """The word for a piece of metal: the colour most of its cloth and leather has and its icon shows, what else its icon shows, and otherwise the tone of its steel."""
    votes = {}
    for part, material in parts.items():
        if UNSEEN_PART.search(part) or BARE_METAL.search(material):
            continue
        lowered = material.lower()
        colour = next((word_of for token, word_of in MATERIAL_COLOURS if token in lowered), None)
        if colour is None:
            continue
        if "dark" in lowered and colour in ("vermelho", "verde", "azul", "amarelo"):
            colour += " escuro"
        votes[colour] = votes.get(colour, 0) + (3 if BIG_PART.search(part) else 1)
    shown = icon_colours(image) if image is not None else {}
    for colour in sorted(votes, key=lambda word_of: (-votes[word_of], word_of)):
        if shown.get(WORD_FAMILY[colour.split()[0]], 0) >= SHOWN_SHARE:
            return colour
    if shown:
        family = max(sorted(shown), key=shown.get)
        if shown[family] >= ICON_SHARE:
            return ICON_WORD[family]
    bases = [material for part, material in parts.items() if re.search(r"base$", part, re.I) and BARE_METAL.search(material)] or [material for part, material in parts.items() if BARE_METAL.search(material) and not UNSEEN_PART.search(part)]
    if not bases:
        return "aço"
    return "aço escuro" if DARK_METAL.search(bases[0]) else "aço claro" if BRIGHT_METAL.search(bases[0]) else "aço"


def main() -> None:
    pak = zipfile.ZipFile(os.path.join(GAME, "Data", "IPL_GameData.pak"))
    materials = materials_of(os.path.join(GAME, "Data", "Tables.pak"))
    icons = {n.lower(): n for n in pak.namelist() if "/icons/items/" in n.lower()}
    found = {}
    missing = 0
    for row in items_doc.load():
        if row["_unique"]:
            continue
        kind = items_doc.classify(row)
        if kind is None or kind[0] not in ("roupa", "armadura"):
            continue
        # The garments and the cloth and leather armour by their dyes' numbers, and the metal (helmets, plate, mail) by `metal_word`.
        metal = kind[0] == "armadura" and METAL.search(row.get("UiSound") or "") is not None
        if not (MARKED.search(row["Name"]) if metal else DYED.search(row["Name"]) and kind[1] != "Capacetes"):
            continue
        icon = row.get("IconId") or row["Name"]
        key = f"libs/ui/textures/icons/items/{icon}_icon.dds".lower()
        if key not in icons:
            missing += 1
            continue
        image = Image.open(io.BytesIO(pak.read(icons[key]))).convert("RGBA")
        if metal:
            found[row["Name"]] = metal_word(materials.get(row.get("Clothing") or "", {}), image)
            continue
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
        if weight > 0:
            found[row["Name"]] = word(tuple(round(c / weight) for c in total))
    OUT.write_text(json.dumps(dict(sorted(found.items())), ensure_ascii=False, indent=1) + "\n", encoding="utf-8", newline="\n")
    print(f"{len(found)} tinturas -> {OUT} ({missing} sem ícone)")


main()
