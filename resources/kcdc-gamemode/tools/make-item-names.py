"""Builds data/item-names.json: every item class the game has, by GUID, with the name the game shows in Portuguese.

    python tools/make-item-names.py ["C:/Program Files (x86)/Steam/steamapps/common/KingdomComeDeliverance2"]

The server knows an item's GUID and table name but not the text the game shows, and the trade view in the dialogue
list (src/server/trade.ts) lists offers by name. The file stays on the server (data/ is not in mafiahub.files), so
it costs players nothing to download. Run it again after a game update that adds items.
"""

import json
import re
import sys
import zipfile
from html import unescape
from pathlib import Path

GAME = Path(sys.argv[1] if len(sys.argv) > 1 else r"C:\Program Files (x86)\Steam\steamapps\common\KingdomComeDeliverance2")
OUT = Path(__file__).resolve().parent.parent / "data" / "item-names.json"

# Classes nobody carries or hands over.
SKIP_CLASSES = {"NPCTool", "QuestItem", "ItemAlias", "DiceBadge"}

# Names the game's own texts get wrong, by the text's key (user, 2026-10-24: "as cotoveleiras em forma de folha na real são de joelhos e não
# braço; esse erro fez jogadores fabricarem errado"). `LegsPlate07` is a piece of the leg armour -- the game's English calls it "Leaf-shaped
# couters", elbow guards, and the Portuguese follows -- and it was listed, and forged, with the arms.
NAME_FIXES = {
    "ui_nm_legsplate07_m01": "Joelheiras em forma de folha",
}


def translated(language: str) -> dict[str, str]:
    """Key -> the translated cell of the game's item texts (the second cell is the English source, the third the translation)."""
    texts: dict[str, str] = {}
    with zipfile.ZipFile(GAME / "Localization" / f"{language}_xml.pak") as pak:
        for name in pak.namelist():
            if not name.startswith("text_ui_items"):
                continue
            body = pak.read(name).decode("utf-8", "replace")
            for row in re.finditer(r"<Row>(.*?)</Row>", body, re.S):
                cells = re.findall(r"<Cell>(.*?)</Cell>", row.group(1), re.S)
                if len(cells) >= 3 and cells[2].strip():
                    texts.setdefault(cells[0], unescape(cells[2]).strip())
    return texts


def items() -> dict[str, dict[str, str]]:
    out: dict[str, dict[str, str]] = {}
    with zipfile.ZipFile(GAME / "Data" / "Tables.pak") as pak:
        for name in pak.namelist():
            if name.startswith("Libs/Tables/item/item") and name.endswith(".xml") and "xsd" not in name:
                text = pak.read(name).decode("utf-8", "replace")
                for match in re.finditer(r"<(\w+)\s+([^>]*?)/>", text):
                    attributes = dict(re.findall(r'(\w+)="([^"]*)"', match.group(2)))
                    if "Id" in attributes and "Name" in attributes:
                        out[attributes["Id"].lower()] = {"class": match.group(1), "ui": attributes.get("UIName", "")}
    return out


def main() -> None:
    names = translated("Portuguese")
    table = {}
    for guid, item in items().items():
        if item["class"] in SKIP_CLASSES:
            continue
        name = NAME_FIXES.get(item["ui"].lower(), names.get(item["ui"], ""))
        if name and not name.startswith("@"):
            table[guid] = name
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(json.dumps(table, ensure_ascii=False, separators=(",", ":"), sort_keys=True), encoding="utf-8")
    print(f"{len(table)} item names written to {OUT} ({OUT.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
