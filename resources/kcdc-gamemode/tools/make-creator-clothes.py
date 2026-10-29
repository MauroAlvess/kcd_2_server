"""Writes data/creator-clothes.json: the plain clothes a new character may choose in the creator's "Roupas" tab (user, 2026-10-18:
"na criação de personagem, a aba roupas, onde o jogador pode trocar a parte de cima, as botas e as calças, escolhendo algumas
iniciais das básicas, mostrando o ícone para eles escolherem"), by gender and part, each with its Portuguese name and the game's own
icon as a data URL. The icons go from the server, not in the client package.

    python tools/make-creator-clothes.py [game folder]

The pieces are the cheapest of their part (the "básica" end of ITENS.md), one of each model first so that the choice is between
different clothes and not only colours, through tools/make-items-doc.py's reading of the game's tables.
"""

import base64
import importlib.util
import io
import json
import re
import sys
import zipfile
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("items_doc", HERE / "make-items-doc.py")
items_doc = importlib.util.module_from_spec(spec)
_argv, sys.argv = sys.argv, sys.argv[:1]
spec.loader.exec_module(items_doc)
sys.argv = _argv
GAME = Path(sys.argv[1]) if len(sys.argv) > 1 else items_doc.GAME
OUT = HERE.parent / "data" / "creator-clothes.json"

# The creator's parts: what each takes, by the model name's first word.
PARTS = {
    "top": re.compile(r"^(?:F_)?(TunicShort|TunicLong|SimpleDress)"),
    "legs": re.compile(r"^(?:F_)?Hose"),
    "feet": re.compile(r"^(?:F_)?(Shoes|Boots)"),
}
PER_PART = 8
ICON_PX = 64
# Not for a newcomer: anything torn, dirty, a beggar's, a jester's, a prisoner's, a monk's, a noble's, an apron.
LEFT_OUT = re.compile(r"ladr|punguista|capuz|rasgad|sujo|esfarrapad|mendig|bobo|avental|prisioneir|monge|frade|nobre|luxo|seda|bordad|veludo|festa", re.I)
# Only the game's numbered variants (TunicLong01_m02_C), not a character's own (TunicShort01_mHenry, F_SimpleDressMagdalena_m01).
PLAIN_VARIANT = re.compile(r"^(?:F_)?[A-Za-z]+\d\d_m\d\d(?:_[A-E]\d?)?$")


def model(name: str) -> str:
    """TunicShort01_m02_D -> TunicShort01: the cut, whatever its colour and quality."""
    return name.split("_m")[0]


def main() -> None:
    rows = items_doc.load()
    tables = zipfile.ZipFile(GAME / "Data" / "Tables.pak")
    icon_of = {}
    for name in tables.namelist():
        if name.startswith("Libs/Tables/item/item") and name.endswith(".xml"):
            text = tables.read(name).decode("utf-8", "replace")
            for match in re.finditer(r"<\w+\b([^>]*\bIconId=\"[^\"]+\"[^>]*)>", text):
                attrs = dict(re.findall(r'(\w+)="([^"]*)"', match.group(1)))
                if "Name" in attrs:
                    icon_of[attrs["Name"]] = attrs["IconId"]
    pak = zipfile.ZipFile(GAME / "Data" / "IPL_GameData.pak")
    files = {n.lower(): n for n in pak.namelist() if n.lower().startswith("libs/ui/textures/icons/items/")}

    def icon(name: str) -> str | None:
        found = files.get(f"libs/ui/textures/icons/items/{icon_of.get(name, '')}_icon.dds".lower())
        if found is None:
            return None
        image = Image.open(io.BytesIO(pak.read(found))).convert("RGBA").resize((ICON_PX, ICON_PX), Image.LANCZOS)
        buffer = io.BytesIO()
        image.save(buffer, format="WEBP", quality=80, method=6, alpha_quality=80)
        return "data:image/webp;base64," + base64.b64encode(buffer.getvalue()).decode("ascii")

    out = {"male": {}, "female": {}}
    total = 0
    for gender in out:
        for part, pattern in PARTS.items():
            fits = [
                row for row in rows
                if pattern.match(row["Name"]) and PLAIN_VARIANT.match(row["Name"]) and not row["_unique"] and not LEFT_OUT.search(row["pt"])
                and row["Name"].startswith("F_") == (gender == "female")
            ]
            fits.sort(key=lambda row: (float(row.get("Price") or 0), row["Name"]))
            chosen, models = [], set()
            for row in fits:
                if model(row["Name"]) not in models:
                    models.add(model(row["Name"]))
                    chosen.append(row)
            for row in fits:
                if len(chosen) >= PER_PART:
                    break
                if row not in chosen:
                    chosen.append(row)
            pieces = []
            for row in chosen[:PER_PART]:
                url = icon(row["Name"])
                if url is None:
                    continue
                pieces.append({"item": row["Name"], "name": row["pt"], "icon": url})
                total += len(url)
            out[gender][part] = pieces
            print(f"{gender:6} {part:4} " + ", ".join(f"{p['item']} ({p['name']})" for p in pieces))
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"{OUT.name}: {total / 1024:.1f} KB de ícones")


main()
