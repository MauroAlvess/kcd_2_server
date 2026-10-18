"""Builds data/vendor-buys.json: what each trade's vendors buy from players, from the game's own tables.

    python tools/make-vendor-buys.py ["C:/Program Files (x86)/Steam/steamapps/common/KingdomComeDeliverance2"]

A vendor buys only the goods of its own trade (src/server/vendors.ts), and the game takes at most 128 rows of buy prices
per vendor, so each list is the trade's goods, the most useful first, cut at 128:

- ferreiro: smithing materials, what the forge makes, plain iron weapons and tools, horseshoes;
- alquimista: herbs, what the alchemy table makes, the other things alchemy takes, ointments and poisons;
- taberneiro: drink, bread, cheese, fruit and vegetables, then meat and fish, cooked, smoked, dried or raw;
- cacador: game meat and fish, hides, arrows and bolts, bows and crossbows;
- alfaiate: the clothes the shop sells and the supporters' and artisans' clothes, then what common folk, burghers and
  nobles wear in the game's own outfits, most worn first.

The prices are not here: the server pays a share of what the game says each item is worth. The file stays on the
server (data/ is not in mafiahub.files). Run it again after a game update that adds items.
"""

import json
import re
import sys
import zipfile
from collections import Counter
from html import unescape
from pathlib import Path

GAME = Path(sys.argv[1] if len(sys.argv) > 1 else r"C:\Program Files (x86)\Steam\steamapps\common\KingdomComeDeliverance2")
OUT = Path(__file__).resolve().parent.parent / "data" / "vendor-buys.json"
LIMIT = 128

# Names a quest, a scene or a unique piece goes by: never on a plain trader's list. Plain families of items have
# underscores of their own (`bsmt_iron`, `herb_mint`, `potion_bard`, `arrow_normal`, `TunicLong01_m01_C`), so it is the
# quests' own prefixes that are left out, and the few one-of-a-kind pieces by name.
SPECIAL = re.compile(
    r"^(svatba|hladAZmar|sedmStatecnych|poi|kovani|rutina|klaster|tvid|cin|dlc|naTroskach|ztracena|pracharna|taboryU|setkani|oblehani|"
    r"maliruvLek|spizovaci|kuttenberg(?!Bread|Bacon|Kielbasa))|test|dummy|quest|cutscene|henry|excalibur|durindan|replica|legend|unique",
    re.I,
)


def tables() -> zipfile.ZipFile:
    return zipfile.ZipFile(GAME / "Data" / "Tables.pak")


def load_items() -> dict:
    out = {}
    with tables() as z:
        for n in z.namelist():
            if n.startswith("Libs/Tables/item/item") and n.endswith(".xml") and "xsd" not in n:
                text = z.read(n).decode("utf-8", "replace")
                for m in re.finditer(r"<(\w+)\s+([^>]*?)/>", text):
                    a = dict(re.findall(r'(\w+)="([^"]*)"', m.group(2)))
                    if "Id" in a and "Name" in a:
                        out[a["Id"].lower()] = {"class": m.group(1), **a}
    return out


def portuguese() -> dict:
    texts = {}
    with zipfile.ZipFile(GAME / "Localization" / "Portuguese_xml.pak") as z:
        for name in z.namelist():
            if name.startswith("text_ui_items"):
                body = z.read(name).decode("utf-8", "replace")
                for m in re.finditer(r"<Row><Cell>([^<]*)</Cell><Cell>(.*?)</Cell><Cell>(.*?)</Cell>", body, re.S):
                    texts.setdefault(m.group(1), unescape(m.group(3)).strip())
    return texts


ITEMS = load_items()
PT = portuguese()
BY_NAME = {}
for item in ITEMS.values():
    BY_NAME.setdefault(item["Name"], item)


def price(item: dict) -> float:
    return float(item.get("Price", "0") or 0)


def known(item: dict) -> bool:
    """Priced, named in Portuguese, and no quest's or scene's own piece."""
    label = PT.get(item.get("UIName", ""), "")
    return price(item) > 0 and label != "" and "bolsa suspeita" not in label.lower() and not SPECIAL.search(item["Name"])


def products(table: str, attribute: str) -> list:
    with tables() as z:
        xml = z.read(table).decode("utf-8", "replace")
    out = []
    for guid in re.findall(rf'{attribute}="([^"]+)"', xml):
        item = ITEMS.get(guid.lower())
        if item is not None and item["Name"] not in out:
            out.append(item["Name"])
    return out


def take(*groups, limit: int = LIMIT) -> list:
    seen, out = set(), []
    for group in groups:
        for name in group:
            item = BY_NAME.get(name)
            if item is None or name in seen or not known(item):
                continue
            seen.add(name)
            out.append(name)
            if len(out) == limit:
                return out
    return out


ALL = list(ITEMS.values())
WEAPON = re.compile(r"(dagger|shortsword|longsword|huntingSword|sabre|saber|axe|mace|hammer|warhammer|halberd|spear|poleaxe|club|bastard|falchion|cleaver|messer)", re.I)
BROKEN = re.compile(r"broken", re.I)
cheapest = sorted(ALL, key=price)

smith = take(
    [i["Name"] for i in ALL if re.match(r"bsmt_(iron|steel|copper|hardware|guard|pommel)", i["Name"])],
    # The everyday iron first: what bandits, starters and the poor carry, cheapest first (no broken scene props).
    [i["Name"] for i in cheapest if WEAPON.match(i["Name"]) and not BROKEN.search(i["Name"]) and price(i) < 1500],
    [i["Name"] for i in ALL if re.match(r"horseshoe", i["Name"], re.I)],
    [n for n in products("Libs/Tables/minigame/BlacksmithRecipes.xml", "BlacksmithRecipeProduct ItemClassId") if price(BY_NAME[n]) < 6000 and not BROKEN.search(n)],
    [i["Name"] for i in cheapest if WEAPON.match(i["Name"]) and not BROKEN.search(i["Name"]) and price(i) < 3000],
)

alchemist = take(
    [i["Name"] for i in ALL if i["class"] == "Herb"],
    [i["Name"] for i in ALL if i["Name"].startswith("special_")],
    [n for n in products("Libs/Tables/minigame/AlchemyRecipe.xml", "ProductItemId")],
    [i["Name"] for i in ALL if i["class"] in ("Ointment", "Poison")],
)

FOOD = [i for i in ALL if i["class"] == "Food" and i.get("Type", "") != "1"]
inn = take(
    [i["Name"] for i in FOOD if i.get("Type") == "3"],                     # drink
    [i["Name"] for i in FOOD if i.get("Type") in ("8", "9")],              # bread, cheese and milk
    [i["Name"] for i in FOOD if i.get("Type") in ("0", "6", "7")],         # fruit, vegetables, mushrooms
    [i["Name"] for i in sorted(FOOD, key=price) if i.get("Type") in ("2", "5")],  # meat and fish, the plainest first
)

GAME_MEAT = re.compile(r"^(deer|roeDeer|boar|hare|rabbit|wolf|fox|bear|duck|pheasant|partridge|perch|trout|herring|crayfish)", re.I)
hunter = take(
    [i["Name"] for i in FOOD if GAME_MEAT.match(i["Name"])],
    [i["Name"] for i in ALL if re.search(r"hide|pelt|skin|fur|antler|tusk|feather|teeth", i["Name"], re.I) and i["class"] in ("MiscItem", "CraftingMaterial")],
    [i["Name"] for i in ALL if i["class"] == "Ammo" and re.match(r"(arrow|bolt)", i["Name"], re.I)],
    [i["Name"] for i in ALL if i["class"] == "MissileWeapon" and re.match(r"(bow|crossbow)", i["Name"], re.I)],
)

with tables() as z:
    presets = z.read("Libs/Tables/item/clothing_preset.xml").decode("utf-8", "replace")
worn = Counter()
for m in re.finditer(r'clothing_preset_name="([^"]+)" gender="\w+"[^>]*?(?:/>|>(.*?)</clothing_preset>)', presets, re.S):
    if not re.match(r"(f_)?(villager|labourer|burgher|noble|peasant|townsman|townswoman|merchant|craftsman|innkeeper|beggar)", m.group(1), re.I):
        continue
    for guid in re.findall(r"<Guid>([^<]+)</Guid>", m.group(2) or ""):
        item = ITEMS.get(guid.lower())
        if item is not None and item["class"] in ("Armor", "Hood") and re.match(r"(F_)?(Tunic|Hose|Shoes|Boots|Coat|Cap|Hood|Habit|Cotehardie|SimpleDress|Veil|Bonnet|HairDecor|Gloves|Surcote)", item["Name"]):
            worn[item["Name"]] += 1
SOLD_AND_GIVEN = [
    # What the clothier sells (vendors.ts), the supporters' clothes (supporters.ts) and the artisans' kit (kits.ts).
    "TunicLong01_m01_C", "TunicShort01_m01_D", "TunicLong04_m01_D", "TunicLong02_m01_C", "TunicLong03_m01_D", "TunicShort03_m01_D", "TunicShort06_m01_D",
    "TunicShort08_m01_C", "HoseSeparate01_m01_E", "HoseSeparate05_m01_D", "HoseLoose01_m01_C", "HoseJoined01_m01_C", "Shoes01_m01_D", "BootsKnee05_m01_C",
    "Coat04_m01_C", "Coat02_m01_D", "Coat05_m01_C", "Cap03_m01_E", "Cap27_m01_D", "Cap12_m01_D", "Cap01_m01_C", "Cap11_m01_D", "Hood01_m01_D",
    "F_SimpleDress01_m01_D", "F_SimpleDress03_m01_C", "F_SimpleDress04_m01_C", "F_SimpleDress05_m01_C", "F_Shoes02_m01_B", "F_Hood01_m01_C", "F_Veil05_m01_D",
    "Cap16_m01_E", "TunicLong05_m01_E", "Hood04_m01_E", "TunicShort04_m07_A", "HoseJoined02_m12_B", "BootsKnee01_m06_C", "Gloves06_m02_A2", "Cap18_m07_A",
    "Hood03_m03_A", "F_Cotehardie01_m06_B", "F_Cotehardie03_m09_A", "F_Shoes01_m10_A", "F_Veil01_m01_B", "F_HairDecor04_m02_B",
]
tailor = take(SOLD_AND_GIVEN, [name for name, _ in worn.most_common()])

lists = {"ferreiro": smith, "alquimista": alchemist, "taberneiro": inn, "cacador": hunter, "alfaiate": tailor}
OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(json.dumps(lists, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
for trade, names in lists.items():
    print(f"{trade:11} {len(names):3}  {', '.join(PT.get(BY_NAME[n].get('UIName', ''), n) for n in names[:8])} ...")
print(OUT)
