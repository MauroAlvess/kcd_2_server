"""Writes src/server/combo-data.ts: the game's weapon combos, for the Esgrima section (`src/server/esgrima.ts`).

    python tools/make-combos.py [game folder]

A combo is a sequence of attacks (two or three set-up strikes and a finishing blow) that the game teaches a character as a combat technique, and a
combat technique is a perk of the game's own tables (`perk_combat_technique.xml` ties one to the other). The 51 weapon combos are the perks of
`perk__combat.xml` that `CombatCombos__generated.xml` gives a row: each has a name, the weapons it is done with, the weapon skill and the level at
which the game hands it over by itself, the shape of the sequence and its finisher, and its words in the game's texts (`text_ui_soul.xml`: the
name, what it does and the line of lore, in English and in Portuguese). `Ringenmeister` is a technique perk too, but a wrestler's perk of the
perk screen and no combo: it is left to the passives (`PASSIVAS.md`).
"""

import json
import re
import sys
import zipfile
from pathlib import Path

GAME = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(r"C:\Program Files (x86)\Steam\steamapps\common\KingdomComeDeliverance2")
OUT = Path(__file__).resolve().parent.parent / "src" / "server" / "combo-data.ts"

# The weapon groups of the combat table (`UIGroup`), in the order of the section, and what each is called: [id, Portuguese, English, the skill's track].
GROUPS = [
    ("Longsword", "longsword", "Montante", "Longsword", "weapon_sword"),
    ("Shortsword", "sword", "Espada", "Sword", "weapon_sword"),
    ("ShortswordShield", "sword_shield", "Espada e escudo", "Sword and shield", "weapon_sword"),
    ("Blunt", "blunt", "Maça ou machado", "Mace or axe", "weapon_sword"),
    ("BluntShield", "blunt_shield", "Maça ou machado e escudo", "Mace or axe and shield", "weapon_sword"),
    ("Halberd", "halberd", "Alabarda", "Halberd", "weapon_large"),
    ("Unarmed", "unarmed", "Corpo a corpo", "Unarmed", "weapon_unarmed"),
]
FINISHERS = {"slash": ("corte", "slash"), "stab": ("estocada", "thrust"), "hook": ("gancho", "hook"), "punch": ("soco", "punch"), "direct": ("soco direto", "straight punch"), "throw": ("arremesso", "throw")}


def attrs(text: str) -> dict:
    return dict(re.findall(r'(\w+)="([^"]*)"', text))


def unescape(text: str) -> str:
    return text.replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">").replace("&quot;", '"').replace("&apos;", "'")


def load() -> list[dict]:
    """The combos of the game, with their words and the shape of each sequence, in the order of the Esgrima section."""
    tables = zipfile.ZipFile(GAME / "Data" / "Tables.pak")
    link = {a["combat_technique_id"]: a["perk_id"] for a in map(attrs, re.findall(r"<perk_combat_technique ([^>]*)/>", tables.read("Libs/Tables/rpg/perk_combat_technique.xml").decode("utf-8", "replace")))}
    perks = {}
    for row in re.findall(r"<perk ([^>]*)/>", tables.read("Libs/Tables/rpg/perk__combat.xml").decode("utf-8", "replace")):
        a = attrs(row)
        perks[a["perk_id"]] = a
    texts: dict[str, tuple[str, str]] = {}
    with zipfile.ZipFile(GAME / "Localization" / "Portuguese_xml.pak") as pak:
        body = pak.read("text_ui_soul.xml").decode("utf-8", "replace")
    for key, english, portuguese in re.findall(r"<Row><Cell>([^<]*)</Cell><Cell>([^<]*)</Cell><Cell>([^<]*)</Cell></Row>", body):
        texts[key] = (unescape(portuguese).strip(), unescape(english).strip())

    combos = []
    text = tables.read("Libs/Tables/combat/CombatCombos__generated.xml").decode("utf-8", "replace")
    for header, inner in re.findall(r"<CombatCombo ([^>]*)>(.*?)</CombatCombo>", text, re.S):
        row = attrs(header)
        perk = perks.get(link.get(row["CombatTechniqueId"], ""))
        if perk is None:
            print(f"sem talento para o combo {row['Id']} ({row.get('UIGroup')})")
            continue
        steps = [attrs(step) for step in re.findall(r"<CombatComboStep ([^>]*)/>", inner)]
        last = steps[-1]
        group = next(g for g in GROUPS if g[0] == row["UIGroup"])
        name_key, desc_key, lore_key = perk.get("perk_ui_name", ""), perk.get("perk_ui_desc", ""), perk.get("perk_ui_lore_desc", "")
        pick = lambda key: texts.get(key, ("", ""))  # noqa: E731
        combos.append(
            {
                "perk": perk["perk_name"],
                "id": perk["perk_id"],
                "code": row["Id"],
                "group": group[1],
                "level": int(perk.get("level", "0")),
                "auto": perk.get("autolearnable") == "true",
                "finisher": last.get("AttackType", "slash"),
                "charged": last.get("IsCharged") == "1",
                "steps": len(steps),
                # What the review of the combos (tools/make-combos-doc.py) reads: where the strokes are made (the game's guard zone of each), what the finisher is aimed by.
                "zones": [step.get("GuardZone", "") for step in steps],
                "types": [step.get("AttackType", "") for step in steps],
                "solver": last.get("UseSolver") == "1",
                "left": row.get("LeftWeapon", ""),
                "right": row.get("RightWeapon", ""),
                "name": pick(name_key),
                "desc": pick(desc_key),
                "lore": pick(lore_key),
            }
        )
        if "" in pick(name_key) or "" in pick(desc_key):
            print(f"faltam textos de {perk['perk_name']}: {name_key} / {desc_key}")
    order = {g[1]: index for index, g in enumerate(GROUPS)}
    combos.sort(key=lambda c: (order[c["group"]], c["level"], c["code"]))
    return combos


def main() -> None:
    combos = load()

    def js(value) -> str:
        return json.dumps(value, ensure_ascii=False)

    lines = [
        "// Generated by tools/make-combos.py from the game's tables and texts. Do not edit by hand.",
        "",
        "/** The weapons a combo is done with, in the order of the Esgrima section: the id, its words [Portuguese, English], and the skill's track. */",
        "export const COMBO_GROUPS: ReadonlyArray<{ readonly id: string; readonly label: readonly [pt: string, en: string]; readonly track: string }> = [",
    ]
    for _ui, gid, pt, en, track in GROUPS:
        lines.append(f"    {{ id: {js(gid)}, label: [{js(pt)}, {js(en)}], track: {js(track)} }},")
    lines += [
        "];",
        "",
        "/** How a combo's finishing blow is called: [Portuguese, English]. */",
        "export const COMBO_FINISHERS: Readonly<Record<string, readonly [pt: string, en: string]>> = {",
    ]
    for key, (pt, en) in FINISHERS.items():
        lines.append(f"    {js(key)}: [{js(pt)}, {js(en)}],")
    lines += [
        "};",
        "",
        "export interface Combo {",
        "    /** The perk's name, which `player.perks`, `addPerk` and `removePerk` speak: \"C01 (longsword)\". */",
        "    readonly perk: string;",
        "    /** The perk's GUID. */",
        "    readonly id: string;",
        "    /** The combo's code in the game's table, the same for a few weapons: \"C01\". */",
        "    readonly code: string;",
        "    /** One of `COMBO_GROUPS`. */",
        "    readonly group: string;",
        "    /** The level of the weapon skill at which the game handed it over (0: none; a quest's). */",
        "    readonly level: number;",
        "    /** Whether the game handed it over by itself at that level (the others come from a lesson or a quest). */",
        "    readonly auto: boolean;",
        "    /** The finishing blow: a key of `COMBO_FINISHERS`. */",
        "    readonly finisher: string;",
        "    readonly charged: boolean;",
        "    /** How many strokes the sequence has, the finisher included. */",
        "    readonly steps: number;",
        "    readonly name: readonly [pt: string, en: string];",
        "    readonly desc: readonly [pt: string, en: string];",
        "    readonly lore: readonly [pt: string, en: string];",
        "}",
        "",
        "export const COMBOS: readonly Combo[] = [",
    ]
    for c in combos:
        lines.append(
            "    { "
            + ", ".join(
                [
                    f"perk: {js(c['perk'])}",
                    f"id: {js(c['id'])}",
                    f"code: {js(c['code'])}",
                    f"group: {js(c['group'])}",
                    f"level: {c['level']}",
                    f"auto: {js(c['auto'])}",
                    f"finisher: {js(c['finisher'])}",
                    f"charged: {js(c['charged'])}",
                    f"steps: {c['steps']}",
                    f"name: [{js(c['name'][0])}, {js(c['name'][1])}]",
                    f"desc: [{js(c['desc'][0])}, {js(c['desc'][1])}]",
                    f"lore: [{js(c['lore'][0])}, {js(c['lore'][1])}]",
                ]
            )
            + " },"
        )
    lines += ["];", ""]
    OUT.write_text("\n".join(lines), encoding="utf-8", newline="\n")
    by_group = {}
    for c in combos:
        by_group[c["group"]] = by_group.get(c["group"], 0) + 1
    print(f"{len(combos)} combos {by_group} -> {OUT}")


if __name__ == "__main__":
    main()
