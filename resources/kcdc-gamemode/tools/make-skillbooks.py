"""Writes src/server/skillbook-data.ts: the game's skill books, from the game's own tables.

    python tools/make-skillbooks.py [game folder]

A skill book is a Document of class 3 in `Libs/Tables/item/item*.xml`; what reading it gives is in
`Libs/Tables/rpg/document_required_skill.xml` (the skill, the level the player must have, the XP) and how long the reading
takes, in game hours, is the item's own `LengthInGameHours`. The book's name in Portuguese comes from the game's
localization (`Localization/Portuguese_xml.pak`). The four stat books (strength, agility, vitality, speech) have no row in
that table: their ladder is the skills' (100, 200, 350 and 500 XP, from level 0, 5, 10 and 15), which is a guess, and
they are marked so. What the reader sees in the book is the item's description and, where the game has them, the book's
own lines (the localization keys `<book>_part_*`).

Why it exists: the game's own reading fast-forwards the clock and hangs here (the clock is the server's), so the reading is
done by this gamemode instead (`src/server/skillbooks.ts`) and needs what the game would have done.
"""

import html
import re
import sys
import zipfile
from pathlib import Path

GAME = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(r"C:\Program Files (x86)\Steam\steamapps\common\KingdomComeDeliverance2")
OUT = Path(__file__).resolve().parent.parent / "src" / "server" / "skillbook-data.ts"

# Stat books: their name carries the stat and the step.
STATS = {"strength": "strength", "agility": "agility", "vitality": "vitality", "speech": "speech"}
LADDER = {"I": (0, 100), "II": (5, 200), "III": (10, 350), "IV": (15, 500)}

# A quest's book and a recipe book are not skill books to read for a skill.
LEFT_OUT = {"lovNaBanditu_rareBook", "recipesbook_alchemy"}


def attrs(text: str) -> dict:
    return dict(re.findall(r'(\w+)="([^"]*)"', text))


def main() -> None:
    tables = zipfile.ZipFile(GAME / "Data" / "Tables.pak")
    rows = {}
    text = tables.read("Libs/Tables/rpg/document_required_skill.xml").decode("utf-8", "replace")
    for match in re.finditer(r"<document_required_skill\b([^>]*)/>", text):
        row = attrs(match.group(1))
        rows[row["item_id"]] = row
    skills = {}
    labels = {}
    text = tables.read("Libs/Tables/rpg/skill.xml").decode("utf-8", "replace")
    for match in re.finditer(r"<skill\b([^>]*)/>", text):
        row = attrs(match.group(1))
        skills[row["skill_id"]] = row["skill_name"]
        labels[row["skill_name"]] = row.get("ui_string_name", "")

    documents = []
    for name in ("Libs/Tables/item/item.xml", "Libs/Tables/item/item__dlc.xml", "Libs/Tables/item/item__system.xml"):
        text = tables.read(name).decode("utf-8", "replace")
        for match in re.finditer(r"<Document\b([^>]*)>", text):
            row = attrs(match.group(1))
            if row.get("Type") == "3" and row.get("Name") not in LEFT_OUT:
                documents.append(row)

    names = {}
    pt = zipfile.ZipFile(GAME / "Localization" / "Portuguese_xml.pak")
    for member in pt.namelist():
        data = pt.read(member).decode("utf-8", "replace")
        for match in re.finditer(r"<Row><Cell>([^<]*)</Cell><Cell>([^<]*)</Cell><Cell>([^<]*)</Cell></Row>", data):
            names[match.group(1)] = match.group(3)

    def plain(text):
        # A text can carry line breaks, markup and XML entities; what is kept is plain text on one line.
        return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", html.unescape(text))).strip()

    def lines_of(document):
        stem = re.sub(r"_(uin|uii)_[A-Za-z0-9]+$", "", document.get("UIInfo", ""))
        own = [plain(text) for key, text in names.items() if stem and key.startswith(stem + "_part_")]
        return [line for line in own if line]

    entries = []
    for document in documents:
        guid = document["Id"]
        hours = int(document.get("LengthInGameHours", "4"))
        title = plain(names.get(document.get("UIName", ""), document["Name"]))
        info = plain(names.get(document.get("UIInfo", ""), ""))
        text = lines_of(document)
        row = rows.get(guid)
        if row is not None:
            track = skills.get(row["skill_id"])
            if track is None:
                continue
            entries.append((guid, document["Name"], title, track, int(row["skill_level_required"]), int(row["skill_xp_gained"]), hours, False, info, text))
            continue
        stat = next((value for key, value in STATS.items() if f"skillbook_{key}_" in document["Name"]), None)
        step = re.search(r"_(I|II|III|IV)_kcd2$", document["Name"])
        if stat is not None and step is not None:
            level, xp = LADDER[step.group(1)]
            entries.append((guid, document["Name"], title, stat, level, xp, hours, True, info, text))
    entries.sort(key=lambda entry: (entry[3], entry[4], entry[1]))
    # What the player reads for each track: the skill's name in the game's own Portuguese, and the stats' names.
    tracks = {}
    for entry in entries:
        track = entry[3]
        tracks[track] = names.get(f"ui_stat_{track}", track) if track in STATS else names.get(labels.get(track, ""), track)

    lines = [
        "/**",
        " * The game's skill books: what reading each gives and asks, from its own tables (`tools/make-skillbooks.py`; do not edit",
        " * by hand). `track` is the skill or stat the XP goes to, `level` the level the reader must have, `xp` the XP, `hours` how",
        " * long the reading takes in game hours, and `guess` marks the stat books, whose XP the tables do not give. `info` is the",
        " * item's description and `text` the book's own lines, where the game has any: what the reader sees on the page.",
        " */",
        "",
        "export interface SkillBook {",
        "    readonly guid: string;",
        "    readonly name: string;",
        "    readonly track: string;",
        "    readonly level: number;",
        "    readonly xp: number;",
        "    readonly hours: number;",
        "    readonly guess: boolean;",
        "    readonly info: string;",
        "    readonly text: readonly string[];",
        "}",
        "",
        "export const SKILLBOOKS: readonly SkillBook[] = [",
    ]
    quote = lambda text: '"' + text.replace("\\", "\\\\").replace('"', '\\"') + '"'
    for guid, _item, title, track, level, xp, hours, guess, info, text in entries:
        parts = ", ".join(quote(line) for line in text)
        lines.append(f'    {{ guid: "{guid}", name: {quote(title)}, track: "{track}", level: {level}, xp: {xp}, hours: {hours}, guess: {"true" if guess else "false"}, info: {quote(info)}, text: [{parts}] }},')
    lines += [
        "];",
        "",
        "/** The skill or stat each track is, in the game's own Portuguese. */",
        "export const TRACK_NAMES: Readonly<Record<string, string>> = {",
    ]
    for track in sorted(tracks):
        label = tracks[track].replace("\\", "\\\\").replace('"', '\\"')
        lines.append(f'    {track}: "{label}",')
    lines += ["};", ""]
    OUT.write_bytes("\n".join(lines).encode("utf-8"))
    print(f"{OUT}: {len(entries)} livros ({sum(1 for entry in entries if entry[7])} com XP estimado)")


if __name__ == "__main__":
    main()
