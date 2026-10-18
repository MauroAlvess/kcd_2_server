"""Makes data/treasure-gear.json, the gear the world's chests may hold, from ITENS.md (which tools/make-items-doc.py made
from the game's own tables).

Each row of the catalog is one piece with its variants (colours, wear); the chest takes one code of the row, so the file
has one name per piece, grouped by what the catalog calls its quality ("básica", "comum", "boa", "excelente"). Nobles' and
unique pieces are left out on purpose: they are not found in a chest. The names are the codes `/give` takes.

    python tools/make-treasure.py            (from the gamemode folder)

The file is read by src/server/treasure.ts; a name the game does not know is skipped there, and logged.
"""
import json
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent
ITENS = HERE.parent.parent.parent / "ITENS.md"
OUT = HERE.parent / "data" / "treasure-gear.json"

# ITENS.md section, as it is titled there, to the group of the file.
GROUPS = {
    "1. Armaduras": "armor",
    "2. Roupas": "clothes",
    "Armas": "weapons",
}
QUALITIES = {"básica": "basic", "comum": "common", "boa": "good", "excelente": "excellent"}
# Types left out: the game's training gear is not treasure, a shield is carried with a coat of arms (the catalog files
# those apart), and the firearms are a supporters' gift.
SKIP_TYPES = {"Armas de fogo", "Bestas"}

# A quest's own gear, a tournament's and a named character's: not what a chest holds (the catalog files them by price, not by
# whether a quest hands them out). The quest layers' Czech prefixes, then the words that give the rest away.
QUEST_NAME = re.compile(
    r"^(artefakt|balatro|duels|hromovy|kovani|kovarsk|dvojity|poi_|stealth|sedm|zachrana|traskave|nemcu|korenarka|magicky|prepadeni|havirsky|uchazec|poustevnik|pomatenec|relikvie|dlc\d|test|ratibor|asi|nezname|kutnohor|rutina|cin_)"
    r"|Tournament|_Henry|_kunesh|Bavor|Radzig|Hanush|Jindra|Capon|Mikes|Apprentice|Training|Lilium|Alberich|Scaring|Calvaria|StGeorge|Bohuta|Istvan|Henry|Zizka|SedlakaMateje",
    re.I,
)

ROW = re.compile(r"^\|\s*(?P<name>[^|]+?)\s*\|\s*(?P<type>[^|]+?)\s*\|\s*(?P<codes>`[^|]+)\|")
HEADING = re.compile(r"^(#{2,4})\s+(?P<title>.+?)\s*(?:\(.*\))?\s*$")


def named_weapon(group: str, code: str) -> bool:
    """A weapon with an underscore in its code is a quest's or a character's, but for the bows (`bow_b`, `cuman_bow_a`)."""
    return group == "weapons" and "_" in code and not code.startswith(("bow_", "cuman_bow_"))


def main() -> None:
    text = ITENS.read_text(encoding="utf8")
    group = None
    quality = None
    found: dict[str, dict[str, list[str]]] = {}
    for line in text.splitlines():
        heading = HEADING.match(line)
        if heading:
            title = heading.group("title").strip()
            if title in GROUPS:
                group = GROUPS[title]
                quality = None
            elif re.match(r"^\d+\. ", title):
                group = GROUPS.get(title)
                quality = None
            else:
                match = re.match(r"^(?:Armadura|Roupa|Arma) (\w+)", title)
                quality = QUALITIES.get(match.group(1)) if match else None
            continue
        if group is None or quality is None:
            continue
        row = ROW.match(line)
        if not row or row.group("type") in SKIP_TYPES:
            continue
        codes = [code for code in re.findall(r"`([^`]+)`", row.group("codes")) if not QUEST_NAME.search(code) and not named_weapon(group, code)]
        if not codes:
            continue
        # The plainest variant (the first), one per piece.
        found.setdefault(group, {}).setdefault(quality, []).append(codes[0])
    for group_name, by_quality in found.items():
        for quality_name, codes in by_quality.items():
            by_quality[quality_name] = sorted(set(codes))
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(json.dumps(found, ensure_ascii=False, indent=1) + "\n", encoding="utf8", newline="\n")
    for group_name, by_quality in found.items():
        print(group_name, {quality_name: len(codes) for quality_name, codes in by_quality.items()})


if __name__ == "__main__":
    main()
