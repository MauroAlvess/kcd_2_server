"""Writes ITENS.md (next to COMANDOS.md): every piece of armour, clothing, weapon and accessory of the game, and the coats of arms
of its cities, houses and guilds, sorted by category and by quality, from the game's own tables.

    python tools/make-items-doc.py [game folder]

The rows are the `Armor`, `Helmet`, `Hood`, `MeleeWeapon` and `MissileWeapon` items of `Libs/Tables/item/` (the horse tack, the
tests and the deprecated rows are left out), named in Portuguese by `data/item-names.json`. What each of the game's variants of a
piece (the colours and the wear of the same garment) is called to `/give` is its table name, so a row lists them all.

How quality is told: the game has no word for it, so the base price stands for it, among the pieces of the same kind (an armour
against armours, a weapon against weapons). Each kind's price quantiles (20%, 50%, 80% and 95% of its pieces) cut it into five
tiers, basic to noble, and the cuts are printed in the document; a piece of the game's unique table, a quest piece or a reward is
"único" whatever it costs. Nothing here is a guess about what a piece is worth in play.
"""

import json
import re
import sys
import zipfile
from collections import defaultdict
from pathlib import Path

GAME = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(r"C:\Program Files (x86)\Steam\steamapps\common\KingdomComeDeliverance2")
HERE = Path(__file__).resolve().parent
NAMES = json.loads((HERE.parent / "data" / "item-names.json").read_text(encoding="utf-8"))
OUT = HERE.parent.parent.parent / "ITENS.md"
FILES = ("item.xml", "item__dlc.xml", "item__unique.xml", "item__rewards.xml", "item__aux.xml")
UNIQUE_FILES = ("item__unique.xml", "item__rewards.xml")

# ---------------------------------------------------------------------------------------------------------------------
# What kind of thing each row is: (category, part). Matched in order against the model name's first word.

KINDS = {
    "armadura": ("Armaduras", "f", "armadura"),
    "roupa": ("Roupas", "f", "roupa"),
    "arma": ("Armas", "f", "arma"),
    "escudo": ("Escudos", "m", "escudo"),
    "acessorio": ("Acessórios", "m", "acessório"),
}
TIERS = ("básic", "comum", "bo", "excelente", "nobre", "únic")
TIER_WORD = {"básic": ("básica", "básico"), "comum": ("comum", "comum"), "bo": ("boa", "bom"), "excelente": ("excelente", "excelente"), "nobre": ("nobre", "nobre"), "únic": ("única", "único")}

STEMS = [
    (r"(Bascinet|KettleHat|SkullCap|tarasMura)", "armadura", "Capacetes"),
    (r"Coif", "armadura", "Almofres"),
    (r"Collar", "armadura", "Golas"),
    (r"(ArmPlate|BrigandineArm|Gauntlets|Gloves)", "armadura", "Braços e mãos"),
    (r"Legs", "armadura", "Pernas"),
    (r"(NobleCaparison|Caparison|WarChanfron|EastSaddle|PaddedCaparison|BasicBridle|CartBridle|CaparisonBrunswig)", "acessorio", "Montaria"),
    (r"(Cuirass|Brigandine|Gambeson|Mail)", "armadura", "Tronco"),
    (r"(Cap|Hood|Wreath|Bonnet|Veil|HairDecor|poi|PlagueSuit)", "roupa", "Cabeça"),
    (r"(TunicShort|TunicLong|Coat|Caftan|Habit|Waffenrock|Cotehardie|Surcote|SimpleDress|prop)", "roupa", "Tronco e vestidos"),
    (r"Hose", "roupa", "Calças"),
    (r"(Boots|Shoes)", "roupa", "Calçados"),
    (r"HandWrap", "roupa", "Mãos"),
    (r"Ring", "acessorio", "Anéis"),
    (r"Necklace", "acessorio", "Colares e broches"),
    (r"Spectacles", "acessorio", "Óculos"),
    (r"Eyepatch", "acessorio", "Tapa-olho"),
    (r"Spurs", "acessorio", "Esporas"),
    (r"(HorseShoe|kovaniZavodniPodkovy)", "acessorio", "Ferraduras"),
]
WEAPON_PARTS = {
    "sword": "Espadas",
    "dagger": "Adagas",
    "mace": "Maças e martelos",
    "axe": "Machados",
    "halberd": "Armas de haste",
    "bow": "Arcos",
    "crossbow": "Bestas",
    "crossbowheavy": "Bestas",
    "pistala": "Armas de fogo",
    "torch": "Tochas",
}
PART_ORDER = ["Capacetes", "Almofres", "Golas", "Tronco", "Braços e mãos", "Pernas", "Cabeça", "Tronco e vestidos", "Calças", "Calçados", "Mãos",
              "Espadas", "Adagas", "Maças e martelos", "Machados", "Armas de haste", "Arcos", "Bestas", "Armas de fogo", "Tochas",
              "Anéis", "Colares e broches", "Óculos", "Tapa-olho", "Esporas", "Ferraduras", "Montaria"]

# A piece that is no use as it is: broken, a bit of a weapon, a thief's prop.
LEFT_OUT = re.compile(r"quebrad|Pedaço|bolsa suspeita|trein|Cor do touro|Corda do enforcado|perdido|^prop_|broken", re.I)


def attrs(text: str) -> dict:
    return dict(re.findall(r'(\w+)="([^"]*)"', text))


def load() -> list:
    tables = zipfile.ZipFile(GAME / "Data" / "Tables.pak")
    rows = []
    for name in FILES:
        text = tables.read(f"Libs/Tables/item/{name}").decode("utf-8", "replace")
        for match in re.finditer(r"<(Armor|Helmet|Hood|MeleeWeapon|MissileWeapon)\b([^>]*)>", text):
            row = attrs(match.group(2))
            row["_tag"] = match.group(1)
            row["_unique"] = name in UNIQUE_FILES or row.get("IsQuestItem") == "true"
            row["pt"] = NAMES.get(row["Id"].lower(), "")
            if row["pt"] and not LEFT_OUT.search(row["pt"]) and not LEFT_OUT.search(row["Name"]):
                rows.append(row)
    return rows


def classify(row: dict):
    """(kind, part) of a row, or None for one that is no use here."""
    sound = (row.get("UiSound") or "").replace("ui_inv_item_", "")
    if row["_tag"] in ("MeleeWeapon", "MissileWeapon"):
        if sound == "weapon_shield":
            return "escudo", "Escudos"
        part = WEAPON_PARTS.get(sound.replace("weapon_", ""))
        return ("arma", part) if part else None
    stem = re.match(r"(?:F_)?([A-Za-z]+)", row.get("Clothing") or row["Name"])
    stem = stem.group(1) if stem else ""
    if row["_tag"] == "Helmet":
        return "armadura", "Capacetes"
    if re.search(r"Mangas|Braçal|Cotoveleira|Ombreira", row["pt"]):
        return "armadura", "Braços e mãos"
    for pattern, kind, part in STEMS:
        if re.match(pattern, stem):
            return kind, part
    return None


# ---------------------------------------------------------------------------------------------------------------------
# Coats of arms: which pieces carry the arms of a city, a house, a guild or an order.

CITIES = ("Praga", "Kuttenberg", "Skalitz", "Suchdol", "Trosky")


def arms(pt: str):
    """(group, name) of the coat of arms a piece carries, or None."""
    guild = re.search(r"Guilda dos? (\w+)", pt)
    if guild:
        return "Guildas", f"Guilda dos {guild.group(1)}"
    if "Ordem da Cruz" in pt:
        return "Ordens e reinos", "Ordem da Cruz"
    if "teutônic" in pt and re.search(r"[Ee]scudo|Pavese", pt):
        return "Ordens e reinos", "Ordem Teutônica"
    if "húngar" in pt and re.search(r"[Ee]scudo|Pavese", pt):
        return "Ordens e reinos", "Reino da Hungria"
    if re.search(r"[Ee]scudo|Pavese|brasão|heráld|Caparazão", pt) or "insígnia" in pt:
        for city in CITIES:
            if city in pt:
                return "Cidades e vilas", city
        house = re.search(r"(?:[Ll]ordes?|Sir)\s+(?:de |do |dos )?([A-Z]\w+)|cores de (\w+)", pt)
        if house:
            return "Famílias e senhores", house.group(1) or house.group(2)
        if re.search(r"brasão|heráld|insígnia", pt):
            return "Peças com brasão ou insígnia, sem casa definida", "Brasão ou insígnia"
    return None


# ---------------------------------------------------------------------------------------------------------------------

def money(tenth: float) -> str:
    """A price as the game shows it (a tenth of the table's number), written the Brazilian way: 1.100 and 82,1."""
    value = tenth / 10
    if value >= 100:
        return f"{value:,.0f}".replace(",", ".")
    return f"{value:.1f}".rstrip("0").rstrip(".").replace(".", ",")


def nice(value: float) -> float:
    """Two significant figures: the cuts read as numbers a person would say."""
    if value <= 0:
        return 0
    digits = len(str(int(value)))
    step = 10 ** max(digits - 2, 0)
    return float(round(value / step) * step)


def cuts(prices: list) -> list:
    ordered = sorted(prices)
    return [nice(ordered[int(p * (len(ordered) - 1))]) for p in (0.2, 0.5, 0.8, 0.95)]


def tier_of(row: dict, bounds: list) -> str:
    if row["_unique"]:
        return "únic"
    price = float(row.get("Price") or 0)
    for tier, limit in zip(TIERS, bounds):
        if price < limit:
            return tier
    return "nobre"


def span(values: list, fmt) -> str:
    low, high = min(values), max(values)
    return fmt(low) if low == high else f"{fmt(low)}–{fmt(high)}"


def number(value: float) -> str:
    return f"{value:g}".replace(".", ",")


def stats(kind: str, group: list) -> list:
    def column(key: str, fmt=lambda v: number(v)) -> str:
        values = [float(r.get(key) or 0) for r in group]
        return span(values, fmt)

    weight = column("Weight")
    if kind in ("armadura",):
        defense = " / ".join(column(k, lambda v: f"{v:g}") for k in ("DefenseSlash", "DefenseStab", "DefenseSmash"))
        return [weight, defense]
    if kind in ("arma", "escudo"):
        return [weight, column("Attack", lambda v: f"{v:g}") if kind == "arma" else "–", column("Defense", lambda v: f"{v:g}"), column("StrReq", lambda v: f"{v:g}")]
    return [weight, column("Charisma", lambda v: f"{v:g}")]


HEADERS = {
    "armadura": ["Peso (kg)", "Defesa corte / perf. / esm."],
    "roupa": ["Peso (kg)", "Carisma"],
    "acessorio": ["Peso (kg)", "Carisma"],
    "arma": ["Peso (kg)", "Ataque", "Defesa", "Força"],
    "escudo": ["Peso (kg)", "Ataque", "Defesa", "Força"],
}


def table(kind: str, entries: list) -> list:
    """Rows grouped by part and name: one line per name, with every variant's code."""
    out = ["| Peça | Tipo | Código (para `/give`) | Preço (g) | Q máx. | " + " | ".join(HEADERS[kind]) + " |", "|---|---|---|---|---|" + "---|" * len(HEADERS[kind])]
    groups = defaultdict(list)
    for part, row in entries:
        groups[(part, row["pt"])].append(row)
    order = lambda key: (PART_ORDER.index(key[0]) if key[0] in PART_ORDER else 99, min(float(r.get("Price") or 0) for r in groups[key]), key[1])
    for key in sorted(groups, key=order):
        group = groups[key]
        codes = ", ".join(f"`{name}`" for name in sorted({r["Name"] for r in group}))
        price = span([float(r.get("Price") or 0) for r in group], money)
        quality = span([float(r.get("MaxQuality") or 1) for r in group], lambda v: f"{v:g}")
        out.append(f"| {key[1]} | {key[0]} | {codes} | {price} | {quality} | " + " | ".join(stats(kind, group)) + " |")
    return out


def main() -> None:
    rows = load()
    heraldic = []
    plain = []
    for row in rows:
        found = classify(row)
        if found is None:
            continue
        kind, part = found
        coat = arms(row["pt"])
        (heraldic if coat else plain).append((kind, part, row, coat))

    # The cuts of each kind come from every piece of it, heraldic or not, and never from the unique ones.
    bounds = {}
    for kind in KINDS:
        prices = [float(r.get("Price") or 0) for k, _, r, _ in heraldic + plain if k == kind and not r["_unique"]]
        bounds[kind] = cuts(prices)

    lines = [
        "# Itens do servidor: armaduras, armas, roupas, acessórios e brasões",
        "",
        "Todas as peças de equipamento do jogo, tiradas das tabelas do próprio jogo (`Tables.pak`) e com os nomes em português do jogo, separadas por **categoria** e, dentro de cada uma, por **qualidade**. Gerado por `resources/kcdc-gamemode/tools/make-items-doc.py`; rode de novo se o jogo atualizar.",
        "",
        "## Índice",
        "",
        "@@INDEX@@",
        "",
        "## Como usar",
        "",
        "- **Para dar um item** (admin): `/give <código> [quantidade] [qualidade 1-4]`, com o código da coluna *Código* entre aspas se tiver espaço (os códigos aqui não têm). Exemplo: `/give Cap03_m03_E 1 4`. Cada peça tem **variantes** (cores, desgaste) com um código cada; a linha lista todas.",
        "- **Q máx.** é a maior qualidade (de 1 a 4) em que a peça existe; peças únicas e joias costumam ter só 1.",
        "- **Preço** é o que o jogo mostra, em grosches (o número da tabela dividido por 10). Faixa `a–b` quando as variantes diferem.",
        "- **Defesa** de armaduras: corte / perfuração / esmagamento. **Carisma**, nas roupas e acessórios, é o que o jogo chama de *Charisma*. **Ataque**, **Defesa** e **Força** das armas são os da tabela do jogo.",
        "- O que não entra: peças quebradas, pedaços de arma, equipamento de treino, adereços de cena e itens de teste. Os escudos e as peças que levam brasão ou insígnia estão **só na seção Brasões**, não repetidos nas outras; as selas, caparazões e ferraduras ficam em Acessórios, em *Montaria*.",
        "",
        "## Como a qualidade foi separada",
        "",
        "O jogo não dá um nome de qualidade às peças, então aqui vale o **preço base do jogo**, comparando cada peça com as do **mesmo tipo** (armadura com armadura, arma com arma). As faixas abaixo são os cortes de 20%, 50%, 80% e 95% do preço das peças de cada tipo; uma peça das tabelas de **itens únicos**, de **missão** ou de **recompensa** é *única*, custe o que custar.",
        "",
        "| Tipo | Básica | Comum | Boa | Excelente | Nobre | Única |",
        "|---|---|---|---|---|---|---|",
    ]
    for kind, (label, gender, noun) in KINDS.items():
        b = bounds[kind]
        excellent = f"até {money(b[3])} g" if b[3] > b[2] else "–"
        lines.append(f"| {label} | até {money(b[0])} g | até {money(b[1])} g | até {money(b[2])} g | {excellent} | acima | tabela de únicos |")
    lines += ["", "(Para os de gênero masculino, acessório e escudo, os nomes são básico, comum, bom, excelente, nobre e único.)", ""]

    def tier_title(kind: str, tier: str, last: bool = False) -> str:
        label, gender, noun = KINDS[kind]
        word = TIER_WORD[tier][0 if gender == "f" else 1]
        b = bounds[kind]
        index = TIERS.index(tier)
        if tier == "únic":
            span_text = "itens únicos, de missão e de recompensa"
        elif index == 0:
            span_text = f"até {money(b[0])} g"
        elif tier == "nobre":
            span_text = f"acima de {money(b[3])} g"
        else:
            span_text = f"{money(b[index - 1])} a {money(b[index])} g"
        return f"{noun.capitalize()} {word} ({span_text})"

    counts = {}
    # --- the four categories
    section = 0
    for category, kinds in (("Armaduras", ("armadura",)), ("Roupas", ("roupa",)), ("Armas", ("arma", "escudo")), ("Acessórios", ("acessorio",))):
        section += 1
        lines += [f"## {section}. {category}", ""]
        for kind in kinds:
            mine = [(part, row) for k, part, row, _ in plain if k == kind]
            counts[kind] = len({r["Name"] for _, r in mine})
            if len(kinds) > 1:
                lines += [f"### {KINDS[kind][0]}", ""]
            for tier in TIERS:
                entries = [(part, row) for part, row in mine if tier_of(row, bounds[kind]) == tier]
                if not entries:
                    continue
                lines += [f"{'####' if len(kinds) > 1 else '###'} {tier_title(kind, tier)}", ""] + table(kind, entries) + [""]

    # --- coats of arms
    section += 1
    lines += [
        f"## {section}. Brasões: cidades, famílias, guildas e ordens",
        "",
        "Escudos, pavieses, sobretudos e caparazões que levam o brasão de um lugar ou de uma casa, agrupados pelo dono do brasão. Dentro de cada um, as peças vêm separadas pela mesma qualidade das tabelas acima.",
        "",
    ]
    groups = defaultdict(lambda: defaultdict(list))
    for kind, part, row, coat in heraldic:
        groups[coat[0]][coat[1]].append((kind, part, row))
    for group in ("Cidades e vilas", "Famílias e senhores", "Guildas", "Ordens e reinos", "Peças com brasão ou insígnia, sem casa definida"):
        if group not in groups:
            continue
        lines += [f"### {group}", ""]
        for owner in sorted(groups[group]):
            lines += [f"#### {owner}", "", "| Peça | Tipo | Código (para `/give`) | Qualidade | Preço (g) | Q máx. |", "|---|---|---|---|---|---|"]
            bucket = defaultdict(list)
            for kind, part, row in groups[group][owner]:
                bucket[(row["pt"], kind, TIERS.index(tier_of(row, bounds[kind])))].append(row)
            for (name, kind, tier) in sorted(bucket, key=lambda k: (k[2], k[0])):
                rows_ = bucket[(name, kind, tier)]
                codes = ", ".join(f"`{n}`" for n in sorted({r["Name"] for r in rows_}))
                word = TIER_WORD[TIERS[tier]][0 if KINDS[kind][1] == "f" else 1]
                lines.append(f"| {name} | {KINDS[kind][2]} | {codes} | {word} | {span([float(r.get('Price') or 0) for r in rows_], money)} | {span([float(r.get('MaxQuality') or 1) for r in rows_], lambda v: f'{v:g}')} |")
            lines.append("")

    index = [
        f"1. [Armaduras](#1-armaduras): {counts['armadura']} códigos, de capacetes a perneiras",
        f"2. [Roupas](#2-roupas): {counts['roupa']} códigos, de chapéus e vestidos a botas",
        f"3. [Armas](#3-armas): {counts['arma']} armas e {counts['escudo']} escudos",
        f"4. [Acessórios](#4-acessórios): {counts['acessorio']} códigos, de anéis e óculos à montaria",
        f"5. [Brasões](#5-brasões-cidades-famílias-guildas-e-ordens): {len({r['Name'] for _, _, r, _ in heraldic})} códigos com o brasão de cidades, famílias, guildas e ordens",
    ]
    lines[lines.index("@@INDEX@@")] = "\n".join(index)
    total_codes = len({r["Name"] for _, _, r, _ in plain + heraldic})
    lines += ["---", "", f"{total_codes} códigos de peças em {len({r['pt'] for _, _, r, _ in plain + heraldic})} nomes."]
    OUT.write_bytes(("\n".join(lines) + "\n").encode("utf-8"))
    print(f"{OUT}: {len(lines)} linhas, {total_codes} códigos; cortes: " + "; ".join(f"{k} {bounds[k]}" for k in KINDS))


main()
