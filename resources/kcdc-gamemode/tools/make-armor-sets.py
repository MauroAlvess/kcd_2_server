"""Writes ARMADURAS.md (next to ITENS.md) and data/armor-sets.json: the game's own armour sets, by the town, village or lord whose men
wear them, each with a category, a description and the code of every piece, for `/conjunto` to hand out whole.

    python tools/make-armor-sets.py [game folder] [--server <KCDCServer binary>]

The user asked (2026-10-18) for "uma separação de armaduras por vilas e cidades e descrição, exemplo armadura comum, categoria
comum, e os sets separados para facilitar minha vida". A set is one of the game's clothing presets (`clothing_preset.xml`): the
outfits the game dresses its guards and soldiers in, named by place or lord and by level (`soldier_kh_4_02` is a Kuttenberg soldier
of level 4, `guard_raborsch_03` a guard of Raborsch). Presets that dress the same pieces in other colours are one set here, their
other codes listed. The pieces are named in Portuguese by `data/item-names.json`, through tools/make-items-doc.py.

Category is the set's price among all the sets, cut like the pieces of ITENS.md (básica, comum, boa, excelente, nobre); weight is
what its body is made of: plate or brigandine is pesada, mail média, padding leve, and no armour at all roupa. `--server` keeps
`vestir` for the presets the server's binary knows (it has about two thirds of the game's); without it every set may be worn.

At the end come the horses (2026-10-22): the game's own horse presets by place and house, for `/horse gear preset`, and the pieces in
each house's colours. They are in the document only: a horse is dressed on the horse, not by `/conjunto`.
"""

import importlib.util
import json
import re
import sys
import zipfile
from collections import defaultdict
from pathlib import Path

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("items_doc", HERE / "make-items-doc.py")
items_doc = importlib.util.module_from_spec(spec)
# It reads its own arguments as it loads: give it none, and read ours after.
_argv, sys.argv = sys.argv, sys.argv[:1]
spec.loader.exec_module(items_doc)
sys.argv = _argv

_server_at = sys.argv.index("--server") + 1 if "--server" in sys.argv else -1
SERVER = Path(sys.argv[_server_at]) if 0 < _server_at < len(sys.argv) else None
ARGS = [a for i, a in enumerate(sys.argv[1:], start=1) if not a.startswith("--") and i != _server_at]
GAME = Path(ARGS[0]) if ARGS else items_doc.GAME
OUT_DOC = HERE.parent.parent.parent / "ARMADURAS.md"
OUT_DATA = HERE.parent / "data" / "armor-sets.json"

# ---------------------------------------------------------------------------------------------------------------------
# Where a preset belongs: (place, who, pattern on its name). First match wins; the order is the document's.

PLACES = [
    ("Kuttenberg", "Soldado da cidade", r"^soldier_kh_(\d)"),
    ("Kuttenberg", "Comandante da cidade", r"^kkut_commander$"),
    ("Kuttenberg", "Guarda de loja", r"^kkut_zuzanek_civilArmor_shopGuard$"),
    ("Kuttenberg", "Torneio, leve", r"^khTournament_light"),
    ("Kuttenberg", "Torneio, pesado", r"^khTournament_heavy"),
    ("Suchdol", "Defensor (cerco de Suchdol)", r"^oblehaniSuchdole_(?!.*(?:pisek|prague|praguer|horse|injured|wounded|dead|villager|fake))"),
    ("Raborsch", "Guarda de Raborsch", r"^guard_raborsch_"),
    ("Raborsch", "Comandante (Ratboř)", r"^setkaniVRatbori_commander$"),
    ("Malešov", "Soldado de Malešov", r"^zachranaPtacka_malesov(?:Soldier|Captain)"),
    ("Malešov", "Vigia da vila", r"^utokNaMalesov_malesovVillageWatchman$"),
    ("Malešov", "Guarda de Bergow", r"^utokMalesov_bergovGuard_(\d)"),
    ("Malešov", "Soldado de Bergow", r"^(?:soldier_bergov_|utokMalesov_bergovSoldier_)(\d)"),
    ("Praga", "Soldado de Praga", r"^soldier_prague_(\d)"),
    ("Písek", "Soldado de Písek", r"^soldier_pisek_(\d)"),
    ("Semine", "Soldado de Semine", r"^soldier_semin_(\d)"),
    ("Semine", "Homem armado de Semine", r"^tsem_.*armou?red"),
    ("Nebakov", "Soldado de Nebakov", r"^soldier_nebak_(\d)"),
    ("Nebakov", "Homem armado de Nebakov", r"^tneb_.*armou?red"),
    ("Trosky", "Homem armado de Trosky", r"^ttro_.*armou?red"),
    ("Lípa", "Soldado dos senhores de Lípa", r"^soldier_lipa_(\d)"),
    ("Kunštát", "Soldado de Kunštát", r"^soldier_kunstat_(\d)"),
    ("Ruthard", "Soldado de Ruthard", r"^soldier_ruthard_(\d)"),
    ("Vavák", "Soldado de Vavák", r"^soldier_vavak_(\d)"),
    ("Polner", "Homem de Polner", r"^soldier_polner_"),
    ("Jobst", "Homem de Jobst", r"^soldier_jobst_(\d)"),
    ("Sigismundo", "Soldado do exército de Sigismundo", r"^soldier_sigi_(\d)"),
    ("Cumanos", "Guerreiro cumano", r"^soldier_cuman_(\d)"),
    ("Brabantinos", "Mercenário brabantino", r"^kcer_brabantSoldier_(\d)"),
    ("Soldados comuns", "Soldado", r"^soldier(?:Light)?_generic_(\d)"),
]

TIERS = ("básica", "comum", "boa", "excelente", "nobre")

# ---------------------------------------------------------------------------------------------------------------------
# The coats of arms (user, 2026-10-21: "coloque no pacote dos comandos juntos os casacos com o brasão de cada casa junto ao escudo dos
# cavaleiros de cada região que tem um brasão ... e espada do cavaleiro também"). The game dresses nobody in these as a set: each pack is
# put together here from the items of ITENS.md's "Brasões" section, for `/conjunto dar` only: the coats that carry the arms of the city,
# house or order, the knight's shield of that arms, and the knight's sword. A house the game gives no coat has the shield and the sword.
# The first code of each list is what `dar` hands out; the others are the same piece in the game's other versions of the arms.

ARMS_PLACE = "Brasões"
KNIGHT_SWORD = "shortswordHeavy"
ARMS_INTRO = (
    "Pacotes montados aqui, não vestimentas do jogo: para cada cidade, casa, ordem ou reino que tem um brasão no jogo, **o casaco (ou os casacos) com "
    "o brasão, o escudo de cavaleiro dele e a espada do cavaleiro** (`shortswordHeavy`). Só se dá (`/conjunto dar brasao-<nome> [jogador]`); "
    "cada peça tem outras versões do brasão (coluna *Outras cores*, para dar com `/give <código>`). Onde o jogo não tem casaco com o brasão (Skalitz, Radzig, Zimburg, "
    "Holohlavy, Zavish, Suchotlesky e a Ordem da Cruz) o pacote é o escudo e a espada. Onde o jogo só tem o escudo triangular (Polner, Holohlavy, "
    "Zavish, Suchotlesky), é ele. O Pavese de Suchdol e o de Trosky e as guildas ficam de fora: não são escudos de cavaleiro de uma região."
)

# What the game calls a shield is not always the house that bears it: said under the pack, in the document only.
ARMS_NOTES = {
    "brasao-leipa": "O escudo de cavaleiro de Leipa (`shieldKite_lipa`) aparece no inventário com o nome que o jogo lhe deu, *Escudo de cavaleiro do Lorde de Bergow*.",
    "brasao-pisek": "Os escudos de cavaleiro de Písek (`shieldKite_pisek_*`) aparecem no inventário como *Escudo de cavaleiro dos Lordes de Hradetz*, o nome que o jogo lhes deu.",
    "brasao-vavak": "Os escudos de cavaleiro de Vavák (`shieldKite_vavak_*`) aparecem no inventário como *Escudo de cavaleiro dos Lordes de Hradetz*, o nome que o jogo lhes deu.",
    "brasao-holohlavy": "Dos Holohlavy o jogo só tem o escudo triangular; `shieldHeater_pisek_C` e `_D` levam o mesmo brasão.",
}

# (id, who, kind, [coat versions...], [shield versions...])
HERALDRY = [
    ("kuttenberg", "Kuttenberg", "cidade",
     [["Coat02_mKuttenberg_D", "Coat02_mKuttenberg01_D", "Coat02_mKuttenberg02_D", "Coat02_mKuttenberg03_D"],
      ["Coat04_mKuttenberg_C", "Coat04_mKuttenberg01_C", "Coat04_mKuttenberg02_C", "Coat04_mKuttenberg03_C"]],
     ["shieldKite_kuttenberg_A", "shieldKite_kuttenberg_B"]),
    ("praga", "Praga", "cidade",
     [["Coat04_mPrague_C"]],
     ["shieldKite_prague_A", "shieldKite_prague_B", "shieldKite_prague_B_inverted", "shieldKite_prague_C", "shieldKite_prague_C_inverted"]),
    ("skalitz", "Skalitz", "cidade", [], ["shieldKite_skalitz"]),
    ("bergow", "Bergow", "casa", [["Coat02_mBergov_D"]], ["shieldKite_bergov_A", "shieldKite_bergov_B", "shieldHeater_bergov_A"]),
    ("holohlavy", "Holohlavy", "casa", [], ["shieldHeater_holohlav_A", "shieldHeater_pisek_C", "shieldHeater_pisek_D"]),
    ("leipa", "Leipa", "casa", [["Coat02_mLeipa_D"]], ["shieldKite_lipa", "shieldHeater_lipa_A", "shieldHeater_lipa_B"]),
    ("nebakov", "Nebakov", "casa", [["Coat02_mNebak_D"]], ["shieldKite_nebak_A", "shieldKite_nebak_B", "shieldKite_nebak_C", "shieldKite_nebak_C_inverted"]),
    ("pisek", "Písek", "casa", [["Coat02_mPisek_D"]], ["shieldKite_pisek_A", "shieldKite_pisek_B", "shieldKite_pisek_C", "shieldHeater_pisek_A", "shieldHeater_pisek_B"]),
    ("polner", "Polner", "casa", [["Coat02_mPolner_D"]], ["shieldHeater_polner"]),
    ("radzig", "Radzig", "casa", [], ["shieldKite_skalitz_02"]),
    ("ruthard", "Ruthard", "casa", [["Coat02_mRuthart_D"]], ["shieldKite_ruthard_A", "shieldKite_ruthard_A_inverted"]),
    ("semine", "Semine", "casa", [["Coat02_mSemin_D"]], ["shieldKite_semin_A"]),
    ("suchotlesky", "Suchotlesky", "casa", [], ["dvojityAgent_petrsShield"]),
    ("vavak", "Vavák", "casa", [["Coat02_mVavak_D"]], ["shieldKite_vavak_A", "shieldKite_vavak_B"]),
    ("zavish", "Zavish", "casa", [], ["shieldHeater_zavis", "shieldHeater_peony"]),
    ("zimburg", "Zimburg", "casa", [], ["shieldKite_cimburk"]),
    ("ordem-teutonica", "Ordem Teutônica", "ordem", [["Coat02_mTeuton"], ["Coat02_mTeuton02"]], ["shieldKite_teuton_01", "shieldKite_teuton_02", "shieldKite_teuton_03"]),
    ("ordem-da-cruz", "Ordem da Cruz", "ordem", [], ["shieldKite_redstar_A", "shieldKite_redstar_B"]),
    ("hungria", "Reino da Hungria", "reino",
     [["Coat02_mMagyar_D", "Coat02_mMagyar01_D"], ["Coat04_mMagyar_C"]],
     ["shieldKite_sigismund_A", "shieldKite_sigismund_B", "shieldKite_sigismund_C"]),
]


def heraldic_sets(rows: list) -> dict:
    """The packs of HERALDRY as `data` entries (the same shape as an armour set, with no preset: they are only given)."""
    by_code = {row["Name"].lower(): row for row in rows}

    def piece(part: str, codes: list) -> dict:
        found = [by_code.get(code.lower()) for code in codes]
        missing = [code for code, row in zip(codes, found) if row is None]
        if missing:
            raise SystemExit(f"brasões: o jogo não tem {', '.join(missing)}")
        return {"part": part, "name": found[0]["pt"], "code": found[0]["Name"], "colours": [row["Name"] for row in found[1:]], "price": float(found[0].get("Price") or 0)}

    out = {}
    for set_id, who, kind, coats, shields in HERALDRY:
        pieces = [piece("Por cima", codes) for codes in coats] + [piece("Escudo", shields), piece("Arma", [KNIGHT_SWORD])]
        names = []
        for p in pieces:
            if p["name"] not in names:
                names.append(p["name"])
        out[f"brasao-{set_id}"] = {
            "place": ARMS_PLACE,
            "name": f"{who} ({kind})",
            "category": "brasão",
            "weight": "casaco, escudo e espada" if coats else "escudo e espada",
            "description": (lambda text: text[0].upper() + text[1:])(", ".join(n[0].lower() + n[1:] for n in names)),
            "price": round(sum(p["price"] for p in pieces) / 10, 1),
            "preset": "",
            "presetGuid": "",
            "gender": "male",
            "pieces": pieces,
            "variants": [],
        }
    return out

# ---------------------------------------------------------------------------------------------------------------------
# Horses (user, 2026-10-22: "me dê o do cavalo de Trosky e dos brasões também das casas, coloque em armaduras"). A horse has no
# `/conjunto`: its gear goes on the horse itself with `/horse gear`, one of the game's presets at once or a piece at a time. The presets
# are the game's own (`clothing_preset.xml`, the ones of no gender), put here under the place or house whose riders the game dresses in
# them; the pieces in a house's colours are listed by house.

HORSE_PLACE = "Cavalos"
HORSE_PIECE = re.compile(r"Saddle|Yoke|Bridle|Chanfron|Caparison|Harness|horseshoe|Podkovy", re.I)
HORSE_SLOTS = (("Sela", re.compile(r"Saddle|Yoke", re.I)), ("Cabeça", re.compile(r"Bridle|Chanfron", re.I)), ("Corpo", re.compile(r"Caparison|Harness", re.I)), ("Ferraduras", re.compile(r"horseshoe|Podkovy", re.I)))
HORSE_INTRO = [
    "Os arreios que o próprio jogo põe nos cavalos dos senhores, cavaleiros e soldados de cada lugar, e as peças de cavalo nas cores de cada casa. "
    "Cavalo não entra no `/conjunto`: o arreio vai no próprio cavalo, com o `/horse gear` (só admin), montado nele ou a até 12 m dele.",
    "",
    "- `/horse gear preset <conjunto>` põe o conjunto inteiro: sela, cabeça, corpo e ferraduras (o que o conjunto não tem fica vazio). Exemplo: `/horse gear preset ttro_bergovHorse`.",
    "- `/horse gear <código>` põe uma peça só (o caparazão pede uma sela antes); `/horse gear off torso` tira a do corpo, `/horse gear bare` tira tudo, e `/horse gear` sozinho diz o que ele veste.",
    "- `/horse gear lock` não deixa quem monta trocar o arreio; `/horse gear unlock` libera.",
    "- No cavalo de um jogador o arreio fica guardado com o cavalo e volta depois de um reinício.",
    "- A peça também vai para a bolsa com `/give <código>`, mas vestir o cavalo pela tela do próprio jogo ainda não foi testado no servidor.",
]

# (heading, said under it, [(preset or pattern on its name, whose)], the preset an armour place points to: "" for the first listed).
HORSE_GROUPS = [
    ("Trosky", "O cavalo do senhor de Trosky, o Lorde von Bergow. O jogo não tem caparazão com o brasão de Bergow: o dele vai de arreio.",
     [("ttro_bergovHorse", "Lorde von Bergow"), ("horse_capontrosecko", "Capon, em Trosky")], ""),
    ("Malešov", "O jogo não tem cavalo de Malešov, e os soldados que ele põe lá são os de Bergow: use o do Lorde von Bergow, `/horse gear preset ttro_bergovHorse` (em [Cavalo de Trosky](#cavalo-de-trosky)).",
     [], "ttro_bergovHorse"),
    ("Raborsch", "A comitiva que o jogo põe em Ratboř (Raborsch) monta com as cores de Leipa; os cavaleiros de Leipa estão em [Cavalo de Lípa](#cavalo-de-lípa).",
     [(r"^setkaniVRatbori1_tempRatiborRetinueHorse\d*$", "comitiva em Ratboř")], ""),
    ("Suchdol", "", [(r"^oblehaniSuchdole_horse_suchdol\d+$", "defensor, no cerco de Suchdol")], ""),
    ("Praga", "", [(r"^oblehaniSuchdole_horse_prague\d+$", "de Praga, no cerco de Suchdol")], ""),
    ("Semine", "", [(r"^battle_semin_\d+$", "cavaleiro de Semine"), ("tsem_seminsrHorse", "o senhor de Semine"), ("tsem_jostHorse", "Jošt, nas missões de Semine"),
                    ("tsem_racekHorse", "Racek, nas missões de Semine"), ("tsem_sukHorse", "Suk, nas missões de Semine")], "battle_semin_08"),
    ("Nebakov", "", [(r"^utokNaNebakov_\w+Horse$", "no ataque a Nebakov")], ""),
    ("Lípa", "Os senhores de Leipa (Lípa).", [(r"^battle_leipa_\d+$", "cavaleiro de Leipa"), ("tsem_hanusHorse", "Hanuš de Leipa")], "battle_leipa_08"),
    ("Ruthard", "", [(r"^battle_ruthard_\d+$", "cavaleiro de Ruthard")], "battle_ruthard_06"),
    ("Aulitz", "", [("horse_markvart", "Markvart von Aulitz"), ("horse_markvart_dream", "Markvart von Aulitz")], ""),
    ("Holohlavy", "", [("kzik_horse_gringolet", "Gringolet, nas cores dos Lordes de Holohlavy")], ""),
    ("Skalitz", "", [("horse_pros", "nas cores de Skalitz")], ""),
    ("Outros cavaleiros", "Com caparazão próprio, de personagens do jogo, e o cavalo de guerra de nobre sem brasão.",
     [("horse_erik_battle", "Erik"), ("horse_brunswiq", "Brunswick"), ("horse_war_noble_01", "nobre, de guerra")], ""),
]

# (house, pattern on the piece's code): the pieces in that house's colours.
HORSE_ARMS = [
    ("Leipa", re.compile(r"_mLeipa\d*$")),
    ("Semine", re.compile(r"_mSemin\d*$")),
    ("Ruthard", re.compile(r"_mRut?hard\d*$")),
    ("Aulitz", re.compile(r"_mMarkvart$")),
    ("Holohlavy", re.compile(r"_mJezek$|^ztracenaCest_jezeksCaparison$")),
    ("Skalitz", re.compile(r"^Caparison01_mPros$")),
    ("Ordem Teutônica", re.compile(r"_mTeuton$")),
    ("Rattay", re.compile(r"^loot_rattay")),
    ("Brunswick", re.compile(r"Brunswig")),
    ("Erik", re.compile(r"_mErik$")),
]
HORSE_NO_ARMS = "Bergow, Kuttenberg, Praga, Nebakov, Písek, Vavák, Polner, Radzig, Zavish, Zimburg, Suchotlesky, a Ordem da Cruz e a Hungria não têm peça de cavalo com o brasão no jogo."
HORSE_NOTES = {"NobleCaparison04_mMarkvart": "o nome que o jogo lhe deu; é um caparazão"}
HORSE_FAMILIES = (
    "**Sem brasão:** o jogo tem ainda as famílias `horse_noble01` a `horse_noble20` (com `horse_noble_05` e `_06`), `horse_common01` a `horse_common20`, "
    "`horse_nomad01` a `horse_nomad20` (selas do leste, as dos cumanos) e `horse_draft` (de carroça). `/horse gear presets` lista todos, e a lista inteira "
    "com as peças de cada um está em `docs/guides/Resources/horse-gear.md`, na pasta do projeto."
)

# Under a coat-of-arms pack: (a preset of that house's riders, the caparison alone).
HORSE_OF_PACK = {
    "brasao-leipa": ("battle_leipa_08", "NobleCaparison03_mLeipa"),
    "brasao-semine": ("battle_semin_08", "Caparison03_mSemin"),
    "brasao-ruthard": ("battle_ruthard_06", "Caparison03_mRuthard"),
    "brasao-holohlavy": ("kzik_horse_gringolet", "NobleCaparison01_mJezek"),
    "brasao-skalitz": ("horse_pros", "Caparison01_mPros"),
    "brasao-ordem-teutonica": ("", "Caparison02_mTeuton"),
    "brasao-bergow": ("ttro_bergovHorse", ""),
}


def horse_rows() -> dict:
    """Every piece a horse wears, by GUID: the game's horse table and the few kept in the others (unique, rewards, DLC)."""
    tables = zipfile.ZipFile(GAME / "Data" / "Tables.pak")
    out = {}
    for name in tables.namelist():
        if not (name.startswith("Libs/Tables/item/item") and name.endswith(".xml")) or "test" in name:
            continue
        text = tables.read(name).decode("utf-8", "replace")
        for match in re.finditer(r"<Armor\b([^>]*)>", text):
            row = items_doc.attrs(match.group(1))
            if "Id" in row and "Name" in row and (name.endswith("item__horse.xml") or HORSE_PIECE.search(row["Name"])):
                row["pt"] = items_doc.NAMES.get(row["Id"].lower(), row["Name"])
                out[row["Id"].lower()] = row
    return out


def horse_slot(code: str) -> str:
    for slot, pattern in HORSE_SLOTS:
        if pattern.search(code):
            return slot
    return "Corpo"


def natural(text: str) -> list:
    return [int(part) if part.isdigit() else part.lower() for part in re.split(r"(\d+)", text)]


def horse_section(binary: bytes | None) -> tuple:
    """The document's lines for the horses, the line each armour place and coat-of-arms pack gets about its horse, and how many presets."""
    pieces = horse_rows()
    by_code = {row["Name"].lower(): row for row in pieces.values()}
    presets_by_name = {p["name"]: p for p in presets() if p["gender"] == "NotDefined"}

    def piece_cell(row) -> str:
        return f"{row['pt']} `{row['Name']}`" if row else "–"

    groups = []
    whose = {}
    for heading, note, wanted, pointer in HORSE_GROUPS:
        listed = []
        for key, who in wanted:
            if key in presets_by_name:
                names = [key]
            else:
                names = sorted((n for n in presets_by_name if re.search(key, n)), key=natural)
                if not names:
                    raise SystemExit(f"cavalos: o jogo não tem conjunto de cavalo {key}")
            for name in names:
                listed.append((name, who))
                whose[name] = who
        groups.append((heading, note, listed, pointer or (listed[0][0] if listed else "")))

    for _, _, _, pointer in groups:
        if pointer and pointer not in presets_by_name:
            raise SystemExit(f"cavalos: o jogo não tem conjunto de cavalo {pointer}")

    lines = [f"## {HORSE_PLACE}", "", *HORSE_INTRO, ""]
    for heading, note, listed, pointer in groups:
        lines += [f"### Cavalo de {heading}" if heading != "Outros cavaleiros" else f"### {heading}", ""]
        if note:
            lines += [note, ""]
        if not listed:
            continue
        table = []
        for name, who in listed:
            worn = {slot: None for slot, _ in HORSE_SLOTS}
            total = 0.0
            for guid in presets_by_name[name]["items"]:
                row = pieces.get(guid)
                if row is not None:
                    worn[horse_slot(row["Name"])] = row
                    total += float(row.get("Price") or 0)
            missing = binary is not None and name.encode() not in binary
            table.append((name, f"{who}{' (o servidor não tem)' if missing else ''}", worn, total))
        # A slot no preset of the group fills (the horseshoes, mostly) gets no column.
        slots = [slot for slot, _ in HORSE_SLOTS if any(worn[slot] for _, _, worn, _ in table)]
        lines += ["| Conjunto | De quem | " + " | ".join(slots) + " | Preço (g) |", "|---|---|" + "---|" * len(slots) + "---|"]
        for name, who, worn, total in table:
            lines.append(f"| `{name}` | {who} | " + " | ".join(piece_cell(worn[slot]) for slot in slots) + f" | {items_doc.money(total)} |")
        lines += ["", f"Pôr: `/horse gear preset {pointer}`, montado no cavalo ou a até 12 m dele (troque pelo nome de outro conjunto da tabela).", ""]

    lines += ["### As peças nas cores de cada casa", "", f"Para pôr uma só: `/horse gear <código>`. {HORSE_NO_ARMS}", ""]
    arms_count = 0
    arms_found = {}
    for house, pattern in HORSE_ARMS:
        found = sorted((row for row in pieces.values() if pattern.search(row["Name"])), key=lambda row: (["Sela", "Cabeça", "Corpo", "Ferraduras"].index(horse_slot(row["Name"])), natural(row["Name"])))
        if not found:
            raise SystemExit(f"cavalos: nenhuma peça de {house}")
        arms_count += len(found)
        arms_found[house] = found
        lines += [f"#### {house}", "", "| Peça | Código | Parte | Preço (g) | Peso (kg) | Defesa corte / perf. / esm. |", "|---|---|---|---|---|---|"]
        for row in found:
            note = f" ({HORSE_NOTES[row['Name']]})" if row["Name"] in HORSE_NOTES else ""
            defense = " / ".join(f"{float(row.get(k) or 0):g}" for k in ("DefenseSlash", "DefenseStab", "DefenseSmash"))
            weight = f"{float(row.get('Weight') or 0):g}".replace(".", ",")
            lines.append(f"| {row['pt']}{note} | `{row['Name']}` | {horse_slot(row['Name'])} | {items_doc.money(float(row.get('Price') or 0))} | {weight} | {defense} |")
        lines.append("")
    lines += [HORSE_FAMILIES, ""]

    # The line under an armour place, and under a coat-of-arms pack.
    place_lines = {}
    for heading, _, listed, pointer in groups:
        if heading == "Outros cavaleiros":
            continue
        target = anchor(f"Cavalo de {heading}")
        if listed:
            more = "os outros em" if len(listed) > 1 else "veja"
            place_lines[heading] = f"**Cavalo:** `/horse gear preset {pointer}` ({whose[pointer]}); {more} [Cavalo de {heading}](#{target})."
        else:
            place_lines[heading] = f"**Cavalo:** o jogo não tem cavalo de {heading}; use o do {whose[pointer]}, `/horse gear preset {pointer}` ([Cavalo de {heading}](#{target}))."
    pack_lines = {}
    for set_id, (preset, code) in HORSE_OF_PACK.items():
        row = by_code.get(code.lower()) if code else None
        if (preset and preset not in presets_by_name) or (code and row is None):
            raise SystemExit(f"cavalos: o pacote {set_id} pede {preset or code}, que o jogo não tem")
        if preset and row:
            pack_lines[set_id] = f"**Cavalo:** `/horse gear preset {preset}` ({whose.get(preset, preset)}) ou só o caparazão, `/horse gear {row['Name']}` ({row['pt']}). Mais em [Cavalos](#cavalos)."
        elif preset:
            pack_lines[set_id] = f"**Cavalo:** o jogo não tem caparazão com este brasão; o cavalo do {whose.get(preset, preset)} é `/horse gear preset {preset}` (veja [Cavalos](#cavalos))."
        else:
            pack_lines[set_id] = f"**Cavalo:** o caparazão, `/horse gear {row['Name']}` ({row['pt']}); o jogo não tem conjunto de cavalo com este brasão."
    info = {"groups": {heading: {"listed": listed, "pointer": pointer} for heading, _, listed, pointer in groups}, "arms": arms_found, "who": whose, "presets": presets_by_name, "pieces": pieces, "horse_slot": horse_slot}
    return lines, place_lines, pack_lines, sum(len(listed) for _, _, listed, _ in groups), arms_count, info

# ---------------------------------------------------------------------------------------------------------------------
# The houses and the towns with arms, each with everything of it in one place (user, 2026-10-22: "existe casacos com brasões de casas e
# cavaleiros por região? se sim coloque em uma lista separada, junto ao escudo e armadura e roupa dos cavalos, para eu poder equipar cavalos com
# essas cores e pegar os itens"). The pieces that carry the arms are found by the house's token in the item codes (`Coat02_mLeipa_D`,
# `Waffenrock03_mLeipa_A`: what follows `_m`), the shield and the sword by the Brasões pack, the armour by the places of ARMADURAS, the
# horse by the presets and the caparisons of the Cavalos section.

HOUSES_PLACE = "Casas e cidades"
# (pack id, title, kind, tokens of the item codes, the places of its armour, the horses of its place, the house of its caparisons, a word)
HOUSES = [
    ("kuttenberg", "Kuttenberg", "cidade", ["Kuttenberg"], ["Kuttenberg"], [], [], ""),
    ("praga", "Praga", "cidade", ["Prague"], ["Praga"], ["Praga"], [], ""),
    ("skalitz", "Skalitz", "cidade", ["Pros"], [], ["Skalitz"], ["Skalitz"], ""),
    ("bergow", "Bergow: Trosky e Malešov", "casa", ["Bergov", "BergovCaptured"], ["Malešov", "Trosky"], ["Trosky", "Malešov"], [], "O jogo não tem caparazão com o brasão de Bergow: o cavalo do senhor é o do Lorde von Bergow, de arreio."),
    ("leipa", "Leipa (Lípa): Raborsch", "casa", ["Leipa"], ["Lípa", "Raborsch"], ["Lípa", "Raborsch"], ["Leipa"], "Os cavaleiros de Raborsch (Ratboř) montam com as cores de Leipa."),
    ("nebakov", "Nebakov", "casa", ["Nebak"], ["Nebakov"], ["Nebakov"], [], ""),
    ("pisek", "Písek", "casa", ["Pisek"], ["Písek"], [], [], ""),
    ("polner", "Polner", "casa", ["Polner"], ["Polner"], [], [], ""),
    ("ruthard", "Ruthard", "casa", ["Ruthart", "Ruthard"], ["Ruthard"], ["Ruthard"], ["Ruthard"], ""),
    ("semine", "Semine", "casa", ["Semin"], ["Semine"], ["Semine"], ["Semine"], ""),
    ("vavak", "Vavák", "casa", ["Vavak"], ["Vavák"], [], [], ""),
    ("zavish", "Zavish", "casa", ["Zavis"], [], [], [], ""),
    ("zimburg", "Zimburg", "casa", ["Cimburk"], [], [], [], ""),
    ("radzig", "Radzig", "casa", ["Radzig"], [], [], [], ""),
    ("holohlavy", "Holohlavy", "casa", ["Jezek"], [], ["Holohlavy"], ["Holohlavy"], ""),
    ("aulitz", "Aulitz", "casa", ["Aulitz", "Markvart"], [], ["Aulitz"], ["Aulitz"], ""),
    ("ordem-teutonica", "Ordem Teutônica", "ordem", ["Teuton"], [], [], ["Ordem Teutônica"], ""),
    ("ordem-da-cruz", "Ordem da Cruz", "ordem", ["Krizovnik"], [], [], [], ""),
    ("hungria", "Reino da Hungria", "reino", ["Magyar"], ["Sigismundo"], [], [], ""),
]
# Pieces that name their house some other way than by a token.
HOUSE_EXTRA_CODES = {"bergow": ["shortswordBergov"]}
# What each part of the clothes is called in a list of one house's pieces.
HOUSE_PARTS = {
    "Tronco e vestidos": "Casacos, túnicas e vestidos", "Cabeça": "Capuzes e chapéus", "Capacetes": "Capacetes", "Almofres": "Almofres", "Golas": "Golas",
    "Tronco": "Tronco (armadura)", "Braços e mãos": "Braços e mãos", "Mãos": "Mãos", "Pernas": "Pernas (armadura)", "Calças": "Calças", "Calçados": "Calçados",
    "Espadas": "Armas", "Machados": "Armas", "Maças e martelos": "Armas", "Adagas": "Armas", "Armas de haste": "Armas", "Arcos": "Armas", "Bestas": "Armas",
}
HOUSE_PART_ORDER = ["Casacos, túnicas e vestidos", "Capuzes e chapéus", "Capacetes", "Almofres", "Golas", "Tronco (armadura)", "Braços e mãos", "Mãos", "Pernas (armadura)", "Calças", "Calçados", "Armas", "Outras"]


def houses_section(rows: list, data: dict, info: dict) -> tuple:
    """The document's lines for the houses, the index line, and how many houses and pieces. Every sentence is built from the game's own data."""
    horse_pieces = info["pieces"]
    by_name = {row["Name"].lower(): row for row in rows}
    by_name.update({code.lower(): row for code, row in ((r["Name"], r) for r in horse_pieces.values())})
    packs = {set_id: entry for set_id, entry in data.items() if entry["place"] == ARMS_PLACE}
    lines = [
        f"## {HOUSES_PLACE}",
        "",
        "Para cada cidade, casa, ordem e reino que tem brasão no jogo, **tudo dele num lugar só**: as peças que levam o brasão (casacos, túnicas, capuzes, almofres...), o escudo de cavaleiro e a espada, as armaduras dos soldados do lugar e a **roupa do cavalo** (o conjunto do jogo e o caparazão). Cada bloco diz o comando: `/conjunto dar` para o pacote e as armaduras, `/give <código>` para uma peça, `/horse gear preset <nome>` para vestir o cavalo (só admin, montado nele ou a até 12 m).",
        "",
        "Na ordem: " + ", ".join(f"[{title}](#{anchor(title)})" for _, title, *_ in HOUSES) + ".",
        "",
    ]
    total_pieces = 0
    for house_id, title, kind, tokens, places, horse_places, caparison_houses, note in HOUSES:
        pattern = re.compile(r"_m(?:" + "|".join(re.escape(t) for t in tokens) + r")(?:\d+)?(?:_|$)")
        found = [row for row in rows if pattern.search(row["Name"]) or row["Name"] in HOUSE_EXTRA_CODES.get(house_id, [])]
        lines += [f"### {title}", "", f"*{kind}*" + (f" · {note}" if note else ""), ""]
        pack = packs.get(f"brasao-{house_id}")
        if pack is not None:
            lines += [f"**Pacote pronto** (casaco com o brasão, escudo de cavaleiro e espada do cavaleiro): `/conjunto dar brasao-{house_id} [jogador]`. Veja o [pacote](#{anchor('`brasao-' + house_id + '` — ' + pack['name'])}).", ""]
        groups = defaultdict(lambda: defaultdict(list))
        shields = []
        for row in found:
            kind_part = items_doc.classify(row)
            if kind_part is not None and kind_part[0] == "escudo":
                shields.append(row)
                continue
            label = HOUSE_PARTS.get(kind_part[1], "Outras") if kind_part is not None else "Outras"
            groups[label][row["pt"]].append(row)
        # The shields of the pack (the ones whose codes name no house) come with their Portuguese names.
        for pack_piece in (pack["pieces"] if pack is not None else []):
            if pack_piece["part"] == "Escudo":
                for code in [pack_piece["code"]] + list(pack_piece.get("colours", [])):
                    row = by_name.get(code.lower())
                    if row is not None and all(row["Name"] != other["Name"] for other in shields):
                        shields.append(row)
        for entry in HERALDRY:
            if entry[0] == house_id:
                for code in entry[4]:
                    row = by_name.get(code.lower())
                    if row is not None and all(row["Name"] != other["Name"] for other in shields):
                        shields.append(row)
        if shields:
            lines += ["**Escudos:**", "", "| Escudo | Código | Preço (g) |", "|---|---|---|"]
            named = defaultdict(list)
            for row in shields:
                named[row["pt"]].append(row)
            for name, group in sorted(named.items(), key=lambda kv: (min(float(r.get("Price") or 0) for r in kv[1]), kv[0])):
                lines.append(f"| {name} | " + ", ".join(f"`{r['Name']}`" for r in sorted(group, key=lambda r: r["Name"])) + f" | {span_of(group)} |")
            lines.append("")
        if groups:
            lines += ["**Peças com o brasão:**", "", "| Parte | Peça | Código | Preço (g) |", "|---|---|---|---|"]
            for label in sorted(groups, key=lambda l: HOUSE_PART_ORDER.index(l) if l in HOUSE_PART_ORDER else 99):
                for name, group in sorted(groups[label].items(), key=lambda kv: (min(float(r.get("Price") or 0) for r in kv[1]), kv[0])):
                    total_pieces += len(group)
                    lines.append(f"| {label} | {name} | " + ", ".join(f"`{r['Name']}`" for r in sorted(group, key=lambda r: r["Name"])) + f" | {span_of(group)} |")
            lines.append("")
        elif not shields:
            lines += ["O jogo não tem peça de roupa com este brasão, só o que está no pacote.", ""]
        sword = by_name.get(KNIGHT_SWORD.lower())
        if pack is not None and sword is not None:
            lines += [f"**Espada do cavaleiro:** {sword['pt']} `{KNIGHT_SWORD}` (`/give {KNIGHT_SWORD}`)." + (" **A do senhor:** Espada do Lorde von Bergow `shortswordBergov`." if house_id == "bergow" else ""), ""]
        elif house_id == "bergow":
            lines += ["**A espada do senhor:** Espada do Lorde von Bergow `shortswordBergov` (`/give shortswordBergov`).", ""]
        # The armour of the place.
        if places:
            lines += ["**Armaduras dos soldados do lugar** (cada uma é um conjunto inteiro: `/conjunto dar <id> [jogador]`, ou `/conjunto vestir <id>` num corpo masculino):", ""]
            for place in places:
                mine = [(set_id, entry) for set_id, entry in data.items() if entry["place"] == place]
                if not mine:
                    continue
                lines += [f"*{place}* ([ver todas](#{anchor(place)})):", "", "| Conjunto | Quem | Categoria | Peso | Preço (g) |", "|---|---|---|---|---|"]
                for set_id, entry in mine:
                    lines.append(f"| `{set_id}` | {entry['name']} | {entry['category']} | {entry['weight']} | {items_doc.money(entry['price'] * 10)} |")
                lines.append("")
        # The horse.
        horse_lines = []
        for heading in horse_places:
            group = info["groups"].get(heading)
            if group is None:
                continue
            if group["listed"]:
                names = [name for name, _ in group["listed"]]
                horse_lines.append(f"- **Conjuntos do jogo** de {heading}: " + ", ".join(f"`{name}`" for name in names[:12]) + (f" e mais {len(names) - 12} em [Cavalo de {heading}](#{anchor('Cavalo de ' + heading)})" if len(names) > 12 else f" ([detalhes](#{anchor('Cavalo de ' + heading)}))") + f". Para pôr: `/horse gear preset {group['pointer']}`.")
            else:
                horse_lines.append(f"- {heading}: o jogo não tem cavalo próprio; o do Lorde von Bergow é `/horse gear preset {group['pointer']}`.")
        for caparison_house in caparison_houses:
            pieces = info["arms"].get(caparison_house, [])
            if pieces:
                by_pt = defaultdict(list)
                for r in pieces:
                    by_pt[r["pt"]].append(r["Name"])
                horse_lines.append(f"- **Caparazões nas cores de {caparison_house}** (`/horse gear <código>`; os detalhes em [As peças nas cores de cada casa](#as-peças-nas-cores-de-cada-casa)): " + "; ".join(f"{name}: " + ", ".join(f"`{code}`" for code in codes) for name, codes in by_pt.items()) + ".")
        if horse_lines:
            lines += ["**Roupa do cavalo:**", ""] + horse_lines + [""]
        else:
            lines += ["**Roupa do cavalo:** o jogo não tem nenhuma com as cores deste lugar.", ""]
    return lines, len(HOUSES), total_pieces


def span_of(group: list) -> str:
    prices = [float(r.get("Price") or 0) for r in group]
    low, high = min(prices), max(prices)
    return items_doc.money(low) if low == high else f"{items_doc.money(low)}–{items_doc.money(high)}"

# How many sets of one kind and level a place keeps.
MAX_PER_KIND = 3


def anchor(text: str) -> str:
    """The target of a link to a heading, as the markdown viewers make it: the accents stay (`#malešov`, `#cavalo-de-lípa`)."""
    kept = re.sub(r"[^\w\s-]", "", text.lower(), flags=re.UNICODE)
    return re.sub(r"\s", "-", kept.strip())


def slug(text: str) -> str:
    folded = text.lower()
    for a, b in (("á", "a"), ("à", "a"), ("â", "a"), ("ã", "a"), ("é", "e"), ("ê", "e"), ("í", "i"), ("ó", "o"), ("ô", "o"), ("õ", "o"), ("ú", "u"), ("ç", "c"), ("š", "s"), ("ř", "r"), ("ž", "z"), ("č", "c"), ("ě", "e"), ("ý", "y")):
        folded = folded.replace(a, b)
    return re.sub(r"[^a-z0-9]+", "-", folded).strip("-")


def presets() -> list:
    body = zipfile.ZipFile(GAME / "Data" / "Tables.pak").read("Libs/Tables/item/clothing_preset.xml").decode("utf-8", "replace")
    out = []
    # Ten presets are empty, written `<clothing_preset ... />`: read as an opening tag, each swallowed the preset after it (2026-10-22).
    for match in re.finditer(r"<clothing_preset ([^>]*?)(?:/>|>(.*?)</clothing_preset>)", body, re.S):
        fields = items_doc.attrs(match.group(1))
        guids = [g.lower() for g in re.findall(r"<Guid>([^<]+)</Guid>", match.group(2) or "")]
        out.append({"guid": fields["clothing_preset_id"].lower(), "name": fields["clothing_preset_name"], "gender": fields["gender"], "items": guids})
    return out


def known_to_server() -> set | None:
    if SERVER is None or not SERVER.exists():
        return None
    data = SERVER.read_bytes()
    return {"present"} | {g for g in re.findall(rb"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}", data)}


PART_ORDER = ["Capacetes", "Almofres", "Golas", "Cabeça", "Tronco", "Tronco e vestidos", "Braços e mãos", "Mãos", "Pernas", "Calças", "Calçados"]
PART_WORD = {"Capacetes": "Cabeça", "Almofres": "Pescoço", "Golas": "Pescoço", "Cabeça": "Cabeça", "Tronco": "Tronco", "Tronco e vestidos": "Por cima", "Braços e mãos": "Braços", "Mãos": "Mãos", "Pernas": "Pernas", "Calças": "Pernas", "Calçados": "Pés"}


def weight_of(pieces: list) -> str:
    stems = " ".join(p["code"] for p in pieces if p["part"] == "Tronco")
    if re.search(r"Cuirass|Brigandine|Plate", stems):
        return "pesada"
    if re.search(r"Mail|Hauberk", stems):
        return "média"
    if any(p["kind"] == "armadura" for p in pieces):
        return "leve"
    return "roupa"


def describe(pieces: list) -> str:
    names = []
    for part in PART_ORDER:
        for p in pieces:
            if p["part"] == part and p["pt"] not in names:
                names.append(p["pt"])
    text = ", ".join(n[0].lower() + n[1:] for n in names)
    return text[0].upper() + text[1:] if text else ""


def main() -> None:
    rows = items_doc.load()
    by_guid = {}
    for row in rows:
        found = items_doc.classify(row)
        if found is None or found[0] not in ("armadura", "roupa"):
            continue
        by_guid[row["Id"].lower()] = {"code": row["Name"], "pt": row["pt"], "kind": found[0], "part": found[1], "price": float(row.get("Price") or 0)}
    server = known_to_server()
    # The server knows a horse preset by its name, not its GUID.
    binary = SERVER.read_bytes() if SERVER is not None and SERVER.exists() else None
    horse_lines, horse_place_lines, horse_pack_lines, horse_count, horse_arms, horse_info = horse_section(binary)

    sets = defaultdict(list)  # (place, who) -> list of {preset, pieces, level}
    for preset in presets():
        if preset["gender"] != "Male" and preset["gender"] != "Female":
            continue
        for place, who, pattern in PLACES:
            m = re.search(pattern, preset["name"])
            if not m:
                continue
            pieces = [by_guid[g] for g in preset["items"] if g in by_guid]
            if not any(p["kind"] == "armadura" for p in pieces):
                break
            level = int(m.group(1)) if m.groups() and m.group(1) else None
            sets[(place, who)].append({"preset": preset, "pieces": pieces, "level": level})
            break

    # One set per distinct list of pieces (by name and part); the others are the same in other colours.
    merged = []
    for (place, who), found in sets.items():
        groups = {}
        for entry in sorted(found, key=lambda e: (e["level"] if e["level"] is not None else 0, e["preset"]["name"])):
            key = tuple(sorted((p["part"], p["pt"]) for p in entry["pieces"]))
            if key in groups:
                groups[key]["variants"].append(entry)
            else:
                groups[key] = {"place": place, "who": who, "first": entry, "variants": [entry]}
        merged.extend(groups.values())

    # At most three of each kind and level in a place (the cheapest, the middle one and the dearest): the game has up to twenty
    # of some, a piece apart, and the list is for choosing (user: "para facilitar minha vida").
    by_kind = defaultdict(list)
    for group in merged:
        by_kind[(group["place"], group["who"], group["first"]["level"])].append(group)
    kept = []
    for groups in by_kind.values():
        groups.sort(key=lambda g: sum(p["price"] for p in g["first"]["pieces"]))
        picks = [groups[0], groups[len(groups) // 2], groups[-1]] if len(groups) > MAX_PER_KIND else groups
        kept.extend({id(g): g for g in picks}.values())
    merged = kept

    totals = sorted(sum(p["price"] for p in g["first"]["pieces"]) for g in merged)
    bounds = [totals[int(q * (len(totals) - 1))] for q in (0.2, 0.5, 0.8, 0.95)]

    def category(total: float) -> str:
        for tier, limit in zip(TIERS, bounds):
            if total < limit:
                return tier
        return "nobre"

    data = {}
    order = []
    counters = defaultdict(int)
    for group in sorted(merged, key=lambda g: ([p for p, _, _ in PLACES].index(g["place"]), [w for _, w, _ in PLACES].index(g["who"]), g["first"]["level"] or 0, sum(p["price"] for p in g["first"]["pieces"]))):
        place, who, first = group["place"], group["who"], group["first"]
        counters[place] += 1
        set_id = f"{slug(place)}-{counters[place]}"
        pieces = sorted(first["pieces"], key=lambda p: (PART_ORDER.index(p["part"]) if p["part"] in PART_ORDER else 99, p["pt"]))
        # The other colours of each piece, from the variants.
        alt = defaultdict(set)
        for entry in group["variants"]:
            for p in entry["pieces"]:
                alt[(p["part"], p["pt"])].add(p["code"])
        total = sum(p["price"] for p in pieces)
        level = first["level"]
        name = f"{who}{f', nível {level}' if level else ''}"
        wearable = server is None or first["preset"]["guid"].encode() in server
        data[set_id] = {
            "place": place,
            "name": name,
            "category": category(total),
            "weight": weight_of(pieces),
            "description": describe(pieces),
            "price": round(total / 10, 1),
            "preset": first["preset"]["name"],
            "presetGuid": first["preset"]["guid"] if wearable else "",
            "gender": first["preset"]["gender"].lower(),
            "pieces": [{"part": PART_WORD.get(p["part"], p["part"]), "name": p["pt"], "code": p["code"], "colours": sorted(alt[(p["part"], p["pt"])] - {p["code"]})} for p in pieces],
            "variants": [entry["preset"]["name"] for entry in group["variants"][1:]],
        }
        order.append(set_id)

    for set_id, entry in heraldic_sets(rows).items():
        data[set_id] = entry
        order.append(set_id)

    OUT_DATA.parent.mkdir(parents=True, exist_ok=True)
    # The server needs the pieces' codes and the preset, not the other colours.
    slim = {k: {**v, "pieces": [{key: piece[key] for key in ("part", "name", "code")} for piece in v["pieces"]]} for k, v in data.items()}
    for v in slim.values():
        v.pop("variants", None)
    OUT_DATA.write_text(json.dumps(slim, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")

    lines = [
        "# Armaduras por lugar: os conjuntos completos",
        "",
        "Os conjuntos de armadura que o próprio jogo veste nos guardas e soldados de cada cidade, vila ou senhor, peça por peça, com a **categoria** (pelo preço, como no [ITENS.md](ITENS.md)), o **peso** e uma descrição. Gerado por `resources/kcdc-gamemode/tools/make-armor-sets.py` a partir das tabelas do jogo; rode de novo se o jogo atualizar.",
        "",
        "## Como dar um conjunto",
        "",
        "- `/conjunto` lista os lugares; `/conjunto <lugar>` lista os conjuntos dele (por exemplo `/conjunto raborsch`).",
        "- `/conjunto dar <id> [jogador]` põe **todas as peças** do conjunto no inventário (o seu, ou o do jogador citado). Exemplo: `/conjunto dar raborsch-1 Radovan`.",
        "- `/conjunto vestir <id> [jogador]` **veste** o conjunto na hora (as roupas de antes vão para o inventário). Só para corpo masculino: os conjuntos dos soldados são do jogo para homens; num corpo feminino use `dar`.",
        "- Uma peça avulsa continua com `/give <código>`. Cada peça tem outras cores (códigos na coluna *Outras cores*).",
        "- Os **[Brasões](#brasões)**, no fim, não são trajes do jogo: cada pacote junta o **casaco com o brasão** da cidade, da casa ou da ordem, o **escudo de cavaleiro** dela e a **espada do cavaleiro**. Só `dar`: `/conjunto dar brasao-kuttenberg Radovan`.",
        "- As **[Casas e cidades](#casas-e-cidades)**, no fim de tudo: para cada uma que tem brasão, **uma lista só** com as peças dele, o escudo e a espada, as armaduras do lugar e a roupa do cavalo, com o comando de cada coisa.",
        "- Os **[Cavalos](#cavalos)**, depois dos brasões: os arreios que o jogo põe nos cavalos de cada lugar e casa, e as peças de cavalo nas cores de cada casa. Vão direto no cavalo, com `/horse gear preset <conjunto>` (por exemplo `/horse gear preset ttro_bergovHorse`, o cavalo do senhor de Trosky).",
        "",
        "## Categorias",
        "",
        "| Categoria | Preço do conjunto |",
        "|---|---|",
        f"| básica | até {items_doc.money(bounds[0])} g |",
        f"| comum | {items_doc.money(bounds[0])} a {items_doc.money(bounds[1])} g |",
        f"| boa | {items_doc.money(bounds[1])} a {items_doc.money(bounds[2])} g |",
        f"| excelente | {items_doc.money(bounds[2])} a {items_doc.money(bounds[3])} g |",
        f"| nobre | acima de {items_doc.money(bounds[3])} g |",
        "",
        "**Peso:** *pesada* tem placas ou brigantina no tronco, *média* cota de malha, *leve* só acolchoado e couro.",
        "",
        "## Índice",
        "",
    ]
    places = []
    for set_id in order:
        place = data[set_id]["place"]
        if place not in places:
            places.append(place)
    for place in places:
        count = sum(1 for s in order if data[s]["place"] == place)
        lines.append(f"- [{place}](#{anchor(place)}) ({count} conjunto{'s' if count != 1 else ''})")
    lines.append(f"- [{HORSE_PLACE}](#{anchor(HORSE_PLACE)}) ({horse_count} conjuntos de cavalo, {horse_arms} peças nas cores de uma casa)")
    lines.append(f"- [{HOUSES_PLACE}](#{anchor(HOUSES_PLACE)}) ({len(HOUSES)} casas, cidades, ordens e reinos com tudo junto: as peças com o brasão, o escudo e a espada, as armaduras do lugar e a roupa do cavalo)")
    lines.append("")
    for place in places:
        lines += [f"## {place}", ""]
        if place == ARMS_PLACE:
            lines += [ARMS_INTRO, ""]
        if place in horse_place_lines:
            lines += [horse_place_lines[place], ""]
        for set_id in [s for s in order if data[s]["place"] == place]:
            entry = data[set_id]
            facts = (
                f"**Traz:** {entry['weight']} · **Preço:** {items_doc.money(entry['price'] * 10)} g"
                if place == ARMS_PLACE
                else f"**Categoria:** {entry['category']} · **Peso:** {entry['weight']} · **Preço:** {items_doc.money(entry['price'] * 10)} g"
            )
            lines += [
                f"### `{set_id}` — {entry['name']}",
                "",
                facts,
                "",
                f"{entry['description']}.",
                "",
                "| Parte | Peça | Código | Outras cores |",
                "|---|---|---|---|",
            ]
            for piece in entry["pieces"]:
                colours = ", ".join(f"`{c}`" for c in piece["colours"][:6]) + (" ..." if len(piece["colours"]) > 6 else "")
                lines.append(f"| {piece['part']} | {piece['name']} | `{piece['code']}` | {colours or '–'} |")
            lines += ["", f"Dar: `/conjunto dar {set_id}`" + (f" · Vestir: `/conjunto vestir {set_id}`" if entry["presetGuid"] else ""), ""]
            if set_id in ARMS_NOTES:
                lines += [ARMS_NOTES[set_id], ""]
            if set_id in horse_pack_lines:
                lines += [horse_pack_lines[set_id], ""]
    lines += horse_lines
    houses_lines, houses_count, houses_pieces = houses_section(rows, data, horse_info)
    lines += houses_lines
    OUT_DOC.write_text("\n".join(lines), encoding="utf-8")
    print(f"{OUT_DOC.name}: {len(order)} conjuntos em {len(places)} lugares, {horse_count} de cavalo e {horse_arms} peças de cavalo com brasão, {houses_count} casas com {houses_pieces} peças; {OUT_DATA.name}: {sum(1 for s in order if data[s]['presetGuid'])} para vestir")
    for place in places:
        print(f"  {place}: {sum(1 for s in order if data[s]['place'] == place)}")


main()
