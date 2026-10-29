"""Writes data/weapons.json: which of the game's items are weapons for blows, by item class GUID -> kind, for the grindstone's repairs (`src/server/repair.ts`).

    python tools/make-weapons.py [game folder]

The rows are the `MeleeWeapon` items of `Libs/Tables/item/` whose `UiSound` names a sword, a dagger, a mace or hammer, an axe or a halberd (the game's own
sorting of its weapons, the one `make-items-doc.py` uses for ITENS.md). Shields, torches, bows, crossbows, firearms and arrows are not in it: the grindstone
repairs swords and the weapons for close fighting (user, 2026-10-27: "só aparece armas, menos arco e flecha ... só espada e armas de combate").
"""

import json
import re
import sys
import zipfile
from pathlib import Path

GAME = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(r"C:\Program Files (x86)\Steam\steamapps\common\KingdomComeDeliverance2")
OUT = Path(__file__).resolve().parent.parent / "data" / "weapons.json"
FILES = ("item.xml", "item__dlc.xml", "item__unique.xml", "item__rewards.xml", "item__aux.xml")
KINDS = {
    "weapon_sword": "sword",
    "weapon_dagger": "dagger",
    "weapon_mace": "mace",
    "weapon_axe": "axe",
    "weapon_halberd": "halberd",
}
# A prop, a test or a broken piece is no weapon to mend.
LEFT_OUT = re.compile(r"broken|test|trein|^prop_|quebrad", re.I)


def attrs(text: str) -> dict:
    return dict(re.findall(r'(\w+)="([^"]*)"', text))


def main() -> None:
    tables = zipfile.ZipFile(GAME / "Data" / "Tables.pak")
    found = {}
    for name in FILES:
        text = tables.read(f"Libs/Tables/item/{name}").decode("utf-8", "replace")
        for match in re.finditer(r"<MeleeWeapon\b([^>]*)>", text):
            row = attrs(match.group(1))
            sound = (row.get("UiSound") or "").replace("ui_inv_item_", "")
            kind = KINDS.get(sound)
            if kind is None or "Id" not in row or LEFT_OUT.search(row.get("Name", "")):
                continue
            found[row["Id"].lower()] = kind
    OUT.write_text(json.dumps(dict(sorted(found.items())), indent=0) + "\n", encoding="utf-8")
    counts = {kind: sum(1 for value in found.values() if value == kind) for kind in KINDS.values()}
    print(f"{OUT.name}: {len(found)} weapons {counts}")


main()
