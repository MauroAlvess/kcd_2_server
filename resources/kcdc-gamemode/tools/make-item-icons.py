"""Writes data/item-icons.json: the game's icon of every item class, by its GUID, for the pages that show a player's own items (the
trade between players, 2026-10-18). The icons themselves are drawn by the game (`src/client/craft-icons.ts` loads
`Libs/UI/Textures/Icons/Items/<IconId>_icon.dds`); this is only which one. Server-side data, not in the client package.

    python tools/make-item-icons.py [game folder]
"""

import json
import re
import sys
import zipfile
from pathlib import Path

GAME = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(r"C:\Program Files (x86)\Steam\steamapps\common\KingdomComeDeliverance2")
OUT = Path(__file__).resolve().parent.parent / "data" / "item-icons.json"


def main() -> None:
    tables = zipfile.ZipFile(GAME / "Data" / "Tables.pak")
    icons = {}
    for name in tables.namelist():
        if not (name.startswith("Libs/Tables/item/item") and name.endswith(".xml")):
            continue
        text = tables.read(name).decode("utf-8", "replace")
        for match in re.finditer(r"<\w+\b([^>]*\bIconId=\"[^\"]+\"[^>]*)>", text):
            attrs = dict(re.findall(r'(\w+)="([^"]*)"', match.group(1)))
            guid = attrs.get("Id", "").lower()
            icon = attrs.get("IconId", "")
            if re.fullmatch(r"[0-9a-f-]{36}", guid) and icon:
                icons.setdefault(guid, icon)
    OUT.write_text(json.dumps(icons, separators=(",", ":"), sort_keys=True) + "\n", encoding="utf-8")
    print(f"{OUT.name}: {len(icons)} itens com ícone")


main()
