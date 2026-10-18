"""Makes data/village-pets.json: where the level puts the village dogs and cats (its `Dog` and `CatHolder` entities), for
src/server/village-pets.ts.

The level's entities are read out of `level.pak` by a scan that is not in this repository (it keeps every entity's header in
one JSON, as `level_entities.json`); give that file as the argument:

    python tools/make-village-pets.py path/to/level_entities.json

A dog's entity is named for its soul (`ksuc_dog_4` is the soul `ksuc_dog_4`), so the name is kept as the soul. Quest dogs
(`hladAZmar_strayDog`), wild dogs and the dead (`slaughteredDog`) are left out: only a village's own, `k<place>_dog...`.
"""
import json
import re
import sys
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "data" / "village-pets.json"
VILLAGE_DOG = re.compile(r"^k[a-z]{2,3}_dog_?\d+$")
VILLAGE_CAT = re.compile(r"^k[a-z]{2,3}_cat(?:[A-Za-z]*)_?\d+(?:_todo)?$|^CatHolder\d+$")


def main(path: str) -> None:
    rows = json.loads(Path(path).read_text(encoding="utf8"))
    found = {"dogs": [], "cats": []}
    for row in rows:
        name = row.get("n") or ""
        if row["c"] == "Dog" and VILLAGE_DOG.match(name):
            kind = "dogs"
        elif row["c"] == "CatHolder" and VILLAGE_CAT.match(name):
            kind = "cats"
        else:
            continue
        x, y, z = (float(value) for value in row["p"].split(","))
        found[kind].append({"name": name, "x": round(x, 2), "y": round(y, 2), "z": round(z, 2)})
    for kind in found:
        found[kind].sort(key=lambda entry: entry["name"])
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(json.dumps(found, ensure_ascii=False, indent=1) + "\n", encoding="utf8", newline="\n")
    print({kind: len(entries) for kind, entries in found.items()})


if __name__ == "__main__":
    main(sys.argv[1])
