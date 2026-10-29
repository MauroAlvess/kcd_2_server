"""Writes src/server/craft-data.ts: the recipes of the guilds' trades (user, 2026-10-18), made from the game's own tables.

    python tools/make-craft-recipes.py [game folder]

Six places, each a guild's:

    fogo        Tabernarii     the fire: what a raw food cooks into, breads and cakes, beer, mead and spirits, cheese, sauerkraut, and
                               (2026-10-20) soups: items of our own, eaten from the bag ("Comer"), which fill the stomach and quench a little thirst
    defumador   Venatores      the smokehouse: what a raw food smokes into, sausages, salami, bacon
    secador     Alchemistae    the drying rack: what a food or a herb dries into
    forja       Fabri Ferrarii the forge: the game's own smithing recipes (its swords, axes and horseshoes), the other metal weapons,
                               the metal armour (mail, plate, helmets), bows and arrows (user, 2026-10-19) and the repair kits
    costura     Artifices      sewing: clothes, hoods, hose, shoes and boots, gloves, padded and leather armour, the tailor's and the cobbler's
                               repair kits and (2026-10-22) jewellery: rings, necklaces and brooches
    alquimia    Alchemistae    the alchemy table: the game's own potion recipes (brewed in the game's own minigame)

What a recipe takes is the game's own: its smithing and alchemy tables say it for those; the others are written here from the
game's ingredients (eggs, milk, honey, salt, lard, spices, vegetables, fruit, meat, linen, hides, iron and steel), plus four
the game does not have and a kitchen or a tailor cannot do without, registered by the server as items of our own and sold by
the vendors: flour, malt, hops and thread, and (2026-10-19) seasoned bow wood for the bows and the arrow shafts. A piece of the game that is a quest's, unique, broken, or carries a house's arms is
left out. Jewellery was left out until 2026-10-22 ("depois de fazer isso tudo vamos adicionar receitas de anéis e colares para o artesão"): it is
the Artifices' now, of the silver the Coletores bring and the smith smelts, copper, jasper, enamel powder and thread; the game has no gold, no
garnets and no pearls for sale, so the pieces that need them are not made.

Each recipe has the level of the trade's skill it asks for (`level`, unlocked as the skill grows) and the XP it gives:

    fogo: survival (drinks: drinking)   defumador: survival   secador, alquimia: alchemy   forja, costura: craftsmanship

A piece's level follows its price among the pieces of its own kind, from 0 to 25; the forge's game recipes take theirs from the
quality the game asks of the product.
"""

import importlib.util
import json
import math
import re
import sys
import zipfile
from collections import defaultdict
from pathlib import Path

GAME = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(r"C:\Program Files (x86)\Steam\steamapps\common\KingdomComeDeliverance2")
HERE = Path(__file__).resolve().parent
NAMES = {k.lower(): v for k, v in json.loads((HERE.parent / "data" / "item-names.json").read_text(encoding="utf-8")).items()}
OUT = HERE.parent / "src" / "server" / "craft-data.ts"

spec = importlib.util.spec_from_file_location("items_doc", HERE / "make-items-doc.py")
items_doc = importlib.util.module_from_spec(spec)
sys.argv = sys.argv[:1] + ([str(GAME)] if len(sys.argv) > 1 else [])
spec.loader.exec_module(items_doc)

TABLES = zipfile.ZipFile(GAME / "Data" / "Tables.pak")
ITEM_FILES = ("item.xml", "item__dlc.xml", "item__alchemy.xml", "item__horse.xml")
TAG = re.compile(r"<(\w+)\s([^<>]*?)/?>", re.S)
ATTR = re.compile(r'(\w+)="([^"]*)"')

# ---------------------------------------------------------------------------------------------------------------------
# The game's items.

ITEMS = {}  # GUID -> row
BY_NAME = {}  # table name -> row
for file in ITEM_FILES:
    text = TABLES.read(f"Libs/Tables/item/{file}").decode("utf-8", "replace")
    for match in TAG.finditer(text):
        row = dict(ATTR.findall(match.group(2)))
        if "Id" in row and "Name" in row:
            row["_tag"] = match.group(1)
            row["_file"] = file
            row["Id"] = row["Id"].lower()
            row["pt"] = NAMES.get(row["Id"], "")
            ITEMS[row["Id"]] = row
            BY_NAME.setdefault(row["Name"], row)


def guid(name: str) -> str:
    row = BY_NAME.get(name)
    if row is None:
        raise SystemExit(f"no item called {name}")
    return row["Id"]


def price(row) -> float:
    return float(row.get("Price") or 0)


# ---------------------------------------------------------------------------------------------------------------------
# What the recipes are written in: the ids of our own items, and every item a recipe names, with its name and icon.

CUSTOM = {
    # id: (name, description, visual (a game item's table name), weight, price[, the action in the bag: "Comer" for a soup])
    "kcdc-craft:farinha": ("Farinha de trigo", "Farinha moída no moinho, para pães, bolos e kolaches.", "loot_salt", 0.5, 30),
    "kcdc-craft:malte": ("Malte de cevada", "Cevada germinada e seca, a base da cerveja.", "special_saltpeter", 0.5, 40),
    "kcdc-craft:lupulo": ("Lúpulo", "Flores secas de lúpulo, que dão o amargo e guardam a cerveja.", "special_olibanum", 0.2, 50),
    "kcdc-craft:linha": ("Linha de costura", "Um carretel de linha de linho encerada.", "nakaza_bastRope", 0.1, 20),
    "kcdc-craft:madeira": ("Madeira de arco", "Varas de freixo e de nogueira secas e retas, para os arcos e as hastes das flechas.", "bsmt_woodExotic", 0.5, 25),
    # What the Coletores bring (2026-10-21, src/server/gather.ts): the wood of the trees they cut, and what the rocks give them. The silver is
    # priced so that the bar is worth less than the cup, the chalice and the rings the smith makes of it; the chip of stone is the rocks' usual
    # nothing, light enough not to weigh a bag down.
    "kcdc-craft:lenha": ("Lenha", "Toras rachadas de árvore cortada, para o carvão da forja, os cabos das ferramentas e o fogo.", "bsmt_woodExotic", 1.0, 30),
    "kcdc-craft:minerio-prata": ("Minério de prata", "Pedra riscada de veios de prata, tirada a picareta. A forja a funde em barra.", "prepadeniVlasskehoDvora_silverBits", 0.8, 150),
    "kcdc-craft:barra-prata": ("Barra de prata", "Prata fundida e limpa, pronta para a taça, o cálice e o anel.", "poi_zasypanyDobrodruh_stolenSilver", 0.3, 300),
    "kcdc-craft:lasca": ("Lasca de pedra", "Um caco de rocha sem serventia: é o que a picareta mais tira.", "s201_debris", 0.2, 1),
    # What the Agricultores bring besides the vegetables (2026-10-27, SINERGIA.md): the grain the mill and the malt house take, and the grapes of the wine.
    "kcdc-craft:trigo": ("Trigo", "Grãos de trigo limpos e secos. Moídos, viram farinha.", "loot_salt", 0.5, 15),
    "kcdc-craft:cevada": ("Cevada", "Grãos de cevada. Germinados e secos, viram malte.", "loot_salt", 0.5, 15),
    "kcdc-craft:uva": ("Uvas", "Cachos de uva colhidos da parreira, para o vinho.", "special_olibanum", 0.4, 16),
}

# The soups (2026-10-20). The game has no soup to cook: its soups are the pot's, eaten at the fire, and three of one quest's (the shoe's, the
# stray dog's, the loyal friend's), so these are items of our own, registered with an action in the bag and handled by `src/server/soups.ts`:
# each fills the share of the stomach `nutrition` says, in the game's own scale (bread 19, a roast 26, the quest's best soup 30, of a stomach
# of a hundred), and quenches `thirst` points of the server's own thirst. A bowl looks like the game's copper plate and a broth like its mug.
# id suffix, name, verb, what it is, visual, price, portions a batch, [ingredients], level, seconds, nutrition, thirst
SOUPS = [
    ("repolho", "Sopa de repolho", "Comer", "Repolho e cebola fervidos em água e sal: rala e quente, o prato de quem tem pouco.", "loot_copperPlate", 70, 2, ["cabbage", "onion", "SALT", "WATER"], 3, 7, 0.22, 14),
    ("cebola", "Sopa de cebola", "Comer", "Cebola refogada na banha e cozida em água e sal, de colher grossa.", "loot_copperPlate", 60, 2, ["onion", "onion", "LARD", "SALT", "WATER"], 4, 7, 0.20, 14),
    ("alho", "Sopa de alho", "Comer", "Alho e pão amolecidos em água e sal: a sopa de taberna que esquenta o corpo e afasta o frio.", "loot_copperPlate", 75, 2, ["garlic", "garlic", "bread", "SALT", "WATER"], 5, 7, 0.24, 14),
    ("urtiga", "Sopa de urtiga", "Comer", "As primeiras urtigas do ano com cebola e sal: amarga e verde, de quem não tem pão.", "loot_copperPlate", 50, 2, ["herb_urticaria", "herb_urticaria", "onion", "SALT", "WATER"], 6, 7, 0.18, 16),
    ("legumes", "Sopa de legumes", "Comer", "Cenoura, pastinaca, nabo e alho-poró cozidos devagar, num caldo claro.", "loot_copperPlate", 90, 3, ["carrot", "parsnip", "turnip", "leek", "SALT", "WATER", "WATER"], 8, 8, 0.26, 18),
    ("ervilha", "Sopa de ervilha com bacon", "Comer", "Ervilhas, cebola e bacon: grossa, de ficar em pé a colher.", "loot_copperPlate", 150, 2, ["roastedPeas", "roastedPeas", "bacon", "onion", "SALT", "WATER"], 9, 8, 0.32, 12),
    ("cogumelos", "Sopa de cogumelos", "Comer", "Boletos e cebola num caldo com creme, como se faz depois da chuva.", "loot_copperPlate", 140, 2, ["boletus", "boletus", "onion", "cream", "SALT", "WATER"], 11, 8, 0.28, 14),
    ("cerveja", "Sopa de cerveja", "Comer", "Cerveja quente com pão e ovo batido: a sopa das manhãs frias da Boêmia.", "budovaniLazni_mug", 110, 2, ["beer", "bread", "egg", "SALT"], 12, 8, 0.24, 10),
    ("galinha", "Caldo de galinha", "Tomar", "Galinha cozida com cenoura e cebola, o caldo que se dá a quem está de cama.", "budovaniLazni_mug", 170, 3, ["chicken", "carrot", "onion", "SALT", "WATER", "WATER"], 13, 9, 0.30, 20),
    ("peixe", "Sopa de peixe", "Comer", "Truta com cebola, pastinaca e pimenta, no caldo do próprio peixe.", "loot_copperPlate", 190, 2, ["trout", "onion", "parsnip", "driedPepperSpice", "SALT", "WATER"], 15, 9, 0.30, 16),
    ("gulache", "Sopa gulache", "Comer", "Carne de boi, cebola e alho com pimenta, longamente cozida na banha: a sopa que sustenta um dia de estrada.", "loot_copperPlate", 260, 2, ["beef", "beef", "onion", "onion", "garlic", "driedPepperSpice", "LARD", "WATER", "WATER"], 17, 10, 0.38, 12),
    ("lagostim", "Sopa de lagostim", "Comer", "Lagostins do rio com cebola, creme e pimenta: a sopa das mesas ricas.", "loot_copperPlate", 280, 2, ["crayfish", "crayfish", "onion", "cream", "driedPepperSpice", "SALT", "WATER"], 19, 10, 0.34, 14),
]

USED = {}  # id -> (name, icon)


def use(item: str) -> str:
    """Notes an item a recipe names (by GUID, or one of our own ids), so the page knows its name and icon."""
    if item in CUSTOM:
        name, _desc, visual, *_rest = CUSTOM[item]
        USED[item] = (name, BY_NAME[visual].get("IconId") or visual)
        return item
    row = ITEMS[item]
    USED[item] = (row["pt"] or row["Name"], row.get("IconId") or row["Name"])
    return item


RECIPES = []


def recipe(station, category, output, amount, ingredients, level, xp, seconds, recipe_id=None, **extra):
    rid = recipe_id or f"{station}:{ITEMS[output]['Name'] if output in ITEMS else output}"
    if any(r["id"] == rid for r in RECIPES):
        return
    RECIPES.append({
        "id": rid,
        "station": station,
        "category": category,
        "output": use(output),
        "amount": amount,
        "ingredients": [[use(item), n] for item, n in ingredients],
        "level": int(level),
        "xp": int(xp),
        "seconds": int(seconds),
        **extra,
    })


def levels_by_price(rows, top=25, low=0):
    """A level for each row: its price's rank among the rows, spread from `low` to `top`."""
    ordered = sorted(rows, key=price)
    out = {}
    for index, row in enumerate(ordered):
        share = index / max(1, len(ordered) - 1)
        out[row["Id"]] = round(low + share * (top - low))
    return out


def xp_for(level: int, base: int = 6) -> int:
    return base + round(level * 1.6)


G = lambda name: guid(name)  # noqa: E731
SALT, LARD, WATER, EGG, MILK, HONEY, CURD, CHEESE = (G(n) for n in ("loot_salt", "special_lard", "water", "egg", "milk", "honey", "curdCheese", "cheeseQuarter"))
WALNUTS, POPPY, PLUMS, PEAR, APPLE, CABBAGE, GARLIC = (G(n) for n in ("walnuts", "herb_dried_poppy", "plums", "pear", "apple", "cabbage", "garlic"))
PORK, BEEF, PORK_LOIN, PEPPER, CHARCOAL = (G(n) for n in ("pigMeat", "beef", "pigTenderloin", "driedPepperSpice", "special_charcoal"))
FLOUR, MALT, HOPS, THREAD, BOW_WOOD = "kcdc-craft:farinha", "kcdc-craft:malte", "kcdc-craft:lupulo", "kcdc-craft:linha", "kcdc-craft:madeira"
WHEAT, BARLEY, GRAPES, LOG = "kcdc-craft:trigo", "kcdc-craft:cevada", "kcdc-craft:uva", "kcdc-craft:lenha"
SCRAP, IRON, STEEL, STEEL_F, STEEL_T, COPPER, HARDWARE = (G(n) for n in ("bsmt_ironBad", "bsmt_ironGood", "bsmt_steelBad", "bsmt_steelNormal", "bsmt_steelGood", "bsmt_copper", "bsmt_hardware"))
COW, PIG_SKIN, DEER_SKIN, LINEN, SHEEP = (G(n) for n in ("special_cowSkin", "special_pigSkin", "special_deerSkin", "loot_cloth", "skin_sheep"))

QUEST = re.compile(r"^(poi_|svatba_|hladAZmar_|sedmStatecnych|klasterniTajemstvi|hostinaProChude|dlc3_wineSecret|prepadeni|ztratyANalezy|hledaniLichtenstejna|kettleFood_|spizovaciOddil_|poi$)", re.I)


def usable(row) -> bool:
    return row.get("IsQuestItem") != "true" and not QUEST.search(row["Name"]) and bool(row["pt"]) and row["pt"] != "Uma bolsa suspeita."


# ---------------------------------------------------------------------------------------------------------------------
# The fire, the smokehouse and the rack: what the game says a raw food becomes.

def transforms(attr: str):
    """(raw, made) pairs the game's tables name in `attr` (CookedItemId, SmokedItemId, DriedItemId)."""
    for row in ITEMS.values():
        made = (row.get(attr) or "").lower()
        if made and made in ITEMS and usable(row) and usable(ITEMS[made]) and "half_eaten" not in row["Name"]:
            yield row, ITEMS[made]


def simple(station, category_of, attr, xp=3, seconds=5):
    pairs = list(transforms(attr))
    # A raw food cooked, smoked or dried is the trade's first work: level 0 to 3, the dearer the later.
    levels = levels_by_price([made for _raw, made in pairs], top=3)
    for raw, made in pairs:
        recipe(station, category_of(raw), made["Id"], 1, [(raw["Id"], 1)], levels[made["Id"]], xp + levels[made["Id"]] // 3, seconds)


def food_category(row) -> str:
    kind = row.get("Type", "")
    if row["_tag"] == "Herb":
        return "Ervas"
    return {"0": "Frutas", "2": "Carnes e peixes", "5": "Miúdos", "6": "Legumes", "7": "Cogumelos", "9": "Laticínios e ovos"}.get(kind, "Outros")


simple("fogo", lambda raw: "Assados e cozidos", "CookedItemId")
simple("defumador", food_category, "SmokedItemId", seconds=6)
simple("secador", food_category, "DriedItemId", seconds=6)

# Breads and cakes (survival), drinks (drinking), and the rest of the kitchen.
KITCHEN = [
    # (category, output, amount, [(item, n)], level, seconds, track)
    ("Pães e massas", "pretzel", 2, [(FLOUR, 1), (SALT, 1), (WATER, 1)], 1, 6, "survival"),
    ("Pães e massas", "breadroll", 2, [(FLOUR, 1), (MILK, 1)], 2, 6, "survival"),
    ("Pães e massas", "bagel", 2, [(FLOUR, 1), (WATER, 1), (HONEY, 1)], 3, 6, "survival"),
    ("Pães e massas", "bread", 2, [(FLOUR, 2), (WATER, 1), (SALT, 1)], 4, 8, "survival"),
    ("Pães e massas", "jewishBread", 2, [(FLOUR, 2), (WATER, 1), (EGG, 1)], 5, 8, "survival"),
    ("Pães e massas", "griddlecake", 2, [(FLOUR, 1), (EGG, 1), (MILK, 1), (HONEY, 1)], 6, 8, "survival"),
    ("Pães e massas", "kuttenbergBread", 2, [(FLOUR, 2), (WATER, 1), (SALT, 1), (HONEY, 1)], 8, 9, "survival"),
    ("Pães e massas", "cheeseCake", 2, [(FLOUR, 1), (CURD, 1), (EGG, 1), (HONEY, 1)], 10, 9, "survival"),
    ("Pães e massas", "poppyseedCake", 2, [(FLOUR, 1), (POPPY, 2), (EGG, 1), (HONEY, 1)], 12, 9, "survival"),
    ("Pães e massas", "walnutCake", 2, [(FLOUR, 1), (WALNUTS, 1), (EGG, 1), (HONEY, 1)], 14, 9, "survival"),
    ("Laticínios", "cream", 1, [(MILK, 2)], 2, 6, "survival"),
    ("Laticínios", "curdCheese", 1, [(MILK, 2), (SALT, 1)], 5, 7, "survival"),
    ("Laticínios", "cheeseQuarter", 1, [(MILK, 3), (SALT, 1)], 11, 9, "survival"),
    ("Pratos", "cracklings", 2, [(LARD, 1), (SALT, 1)], 3, 6, "survival"),
    ("Pratos", "sauerkraut", 2, [(CABBAGE, 2), (SALT, 1)], 6, 7, "survival"),
    ("Bebidas", "mead", 2, [(HONEY, 2), (WATER, 2)], 4, 10, "drinking"),
    ("Bebidas", "beer", 3, [(MALT, 2), (HOPS, 1), (WATER, 2)], 5, 10, "drinking"),
    ("Bebidas", "beerTroskovice", 3, [(MALT, 2), (HOPS, 2), (WATER, 2)], 10, 10, "drinking"),
    ("Bebidas", "hooch", 1, [(PLUMS, 3), (WATER, 1)], 12, 10, "drinking"),
    ("Bebidas", "dlc3_beer", 3, [(MALT, 3), (HOPS, 2), (HONEY, 1), (WATER, 2)], 16, 12, "drinking"),
    ("Bebidas", "spirits", 1, [(PLUMS, 2), (PEAR, 2), (HONEY, 1)], 18, 12, "drinking"),
    # What the vendors sold the kitchen and the apothecary and nobody made (2026-10-27, SINERGIA.md): water boiled over the Coletores' logs, wine of the
    # Agricultores' grapes, and lard rendered from pork.
    ("Bebidas", "water", 4, [(LOG, 1)], 0, 8, "survival"),
    ("Bebidas", "wine", 2, [(GRAPES, 4), (WATER, 1)], 10, 14, "drinking"),
    ("Pratos", "special_lard", 1, [(PORK, 2)], 2, 7, "survival"),
]
for category, output, amount, ingredients, level, seconds, track in KITCHEN:
    recipe("fogo", category, G(output), amount, ingredients, level, xp_for(level), seconds, track=track)

# The soups: ingredients named by table name, or by the constants of the kitchen (SALT, LARD, WATER).
SOUP_EFFECTS = {}
KITCHEN_CONSTANTS = {"SALT": SALT, "LARD": LARD, "WATER": WATER}
for key, name, verb, what, visual, cost, portions, ingredients, level, seconds, nutrition, thirst in SOUPS:
    item = f"kcdc-craft:sopa-{key}"
    description = f"{what} Sacia {round(nutrition * 100)}% da fome e mata um pouco da sede."
    CUSTOM[item] = (name, description, visual, 0.5, cost, verb)
    SOUP_EFFECTS[item] = (nutrition, thirst)
    bill = []
    for token in ingredients:
        found = KITCHEN_CONSTANTS.get(token) or G(token)
        for at, (known, count) in enumerate(bill):
            if known == found:
                bill[at] = (known, count + 1)
                break
        else:
            bill.append((found, 1))
    recipe("fogo", "Sopas", item, portions, bill, level, xp_for(level), seconds, recipe_id=f"fogo:sopa-{key}", track="survival")

SMOKEHOUSE = [
    ("Embutidos", "bacon", 1, [(PORK, 1), (SALT, 1)], 3, 6),
    ("Embutidos", "kielbasaSmoked", 2, [(PORK, 2), (SALT, 1), (GARLIC, 1)], 6, 8),
    ("Embutidos", "salami", 1, [(PORK, 2), (SALT, 1), (PEPPER, 1)], 8, 8),
    ("Embutidos", "kuttenbergBacon", 1, [(PORK_LOIN, 1), (SALT, 1), (PEPPER, 1)], 10, 8),
    ("Embutidos", "kuttenbergKielbasaSmoked", 2, [(PORK, 2), (BEEF, 1), (SALT, 1), (PEPPER, 1)], 12, 9),
]
for category, output, amount, ingredients, level, seconds in SMOKEHOUSE:
    recipe("defumador", category, G(output), amount, ingredients, level, xp_for(level), seconds)

# ---------------------------------------------------------------------------------------------------------------------
# The forge.

# The Coletores' tools and what the smith makes of their finds (2026-10-21: "a picareta deve virar ferramenta do ferreiro"). Written before the
# game's own recipes, so the two tools the game's smithing table has keep these: the lumberjack's axe and the game's only pick, a knight's war
# pick its table forges at the twelfth level, which is the Coletores' tool here at the sixth, of plain iron. Both take a haft of wood.
LENHA, SILVER_ORE, SILVER_BAR = "kcdc-craft:lenha", "kcdc-craft:minerio-prata", "kcdc-craft:barra-prata"
recipe("forja", "Ferramentas", G("axeWork01"), 1, [(SCRAP, 2), (LENHA, 1), (CHARCOAL, 1)], 2, 16, 14, recipe_id="forja:r_axework01")
recipe("forja", "Ferramentas", G("axeBattle03"), 1, [(IRON, 2), (SCRAP, 2), (LENHA, 2), (CHARCOAL, 1)], 6, 30, 16, recipe_id="forja:r_axebattle03")
# The forge's fuel from the Coletores' wood.
recipe("forja", "Carvão", G("special_charcoal"), 3, [(LENHA, 2)], 1, 8, 10, recipe_id="forja:carvao")
# Silver: the ore smelted into a bar, and the bar into the silver the game has, each worth more than what goes into it.
recipe("forja", "Prata", SILVER_BAR, 1, [(SILVER_ORE, 1), (CHARCOAL, 1)], 4, 20, 12, recipe_id="forja:prata-barra")
recipe("forja", "Prata", G("loot_silverCup"), 1, [(SILVER_BAR, 1), (CHARCOAL, 1)], 6, 24, 14)
recipe("forja", "Prata", G("loot_silverChalice"), 1, [(SILVER_BAR, 2), (CHARCOAL, 1)], 9, 30, 16)
# (The silver rings and the enamelled brooch the forge made from 2026-10-21 are the artisan's from 2026-10-22: see JEWELS below.)

# The smelting and the parts (2026-10-27, SINERGIA.md: "todas guildas tenham sinergia ... essa semana vamos retirar os npc"). The smiths' vendors sold iron, steel,
# fittings, guards and pommels; the forge makes them now of what the Coletores bring (scrap, iron, copper) and charcoal. Every step is worth a little more than what
# goes into it, by the game's own prices (scrap 25, iron 48, steel 50, Frankfurt 200, Toledo 350, fittings 15).
recipe("forja", "Fundição", HARDWARE, 3, [(SCRAP, 1)], 1, 4, 6, recipe_id="forja:fixacao")
recipe("forja", "Fundição", IRON, 1, [(SCRAP, 2), (CHARCOAL, 1)], 2, 10, 10, recipe_id="forja:ferro-refinado")
recipe("forja", "Fundição", STEEL, 1, [(IRON, 1), (CHARCOAL, 1)], 5, 14, 12, recipe_id="forja:aco")
recipe("forja", "Fundição", STEEL_F, 1, [(STEEL, 2), (CHARCOAL, 2)], 10, 22, 14, recipe_id="forja:aco-frankfurt")
recipe("forja", "Fundição", STEEL_T, 1, [(STEEL_F, 1), (STEEL, 1), (CHARCOAL, 3)], 16, 30, 16, recipe_id="forja:aco-toledo")
recipe("forja", "Peças de espada", G("bsmt_guardSimple"), 1, [(IRON, 2)], 3, 12, 10, recipe_id="forja:guarda-comum")
recipe("forja", "Peças de espada", G("bsmt_guardStraight"), 1, [(IRON, 2), (COPPER, 1)], 6, 16, 10, recipe_id="forja:guarda-reta")
recipe("forja", "Peças de espada", G("bsmt_guardStrong"), 1, [(STEEL, 2), (CHARCOAL, 1)], 10, 22, 12, recipe_id="forja:guarda-reforcada")
recipe("forja", "Peças de espada", G("bsmt_guardSpecial"), 1, [(STEEL, 2), (COPPER, 2), (CHARCOAL, 1)], 14, 28, 14, recipe_id="forja:guarda-chifres")
recipe("forja", "Peças de espada", G("bsmt_pommelCoin"), 1, [(COPPER, 2)], 3, 12, 10, recipe_id="forja:pomo-moeda")
recipe("forja", "Peças de espada", G("bsmt_pommelPear"), 1, [(COPPER, 2), (IRON, 1)], 6, 16, 10, recipe_id="forja:pomo-pera")
recipe("forja", "Peças de espada", G("bsmt_pommelEight"), 1, [(COPPER, 2), (STEEL, 1)], 9, 20, 12, recipe_id="forja:pomo-octogonal")
recipe("forja", "Peças de espada", G("bsmt_pommelDecorated"), 1, [(COPPER, 1), (STEEL, 1), (SILVER_BAR, 1)], 13, 26, 14, recipe_id="forja:pomo-decorado")
# The Agricultores' shovel, the game's own, which the smiths' vendors sold: iron on a haft of wood.
recipe("forja", "Ferramentas", G("player_shovel"), 1, [(IRON, 2), (LENHA, 1), (CHARCOAL, 1)], 3, 14, 12, recipe_id="forja:pa")

SMITH_TEXT = TABLES.read("Libs/Tables/minigame/BlacksmithRecipes.xml").decode("utf-8", "replace")
SMITH_LEFT_OUT = re.compile(r"artefakt|kovani|kovarske|transmise|poustevnik|pomatenec|uchazec|reforged|Calvaria|Lilium|StGeorge|LionHead|phantom|basic_|TrainingSword", re.I)
SMITH_CATEGORY = {"ShortSword": "Espadas curtas", "LongSword": "Montantes", "Axe": "Machados", "Other": "Ferraduras"}
for attrs_text, body in re.findall(r"<BlacksmithRecipe ([^>]*)>(.*?)</BlacksmithRecipe>", SMITH_TEXT, re.S):
    meta = dict(ATTR.findall(attrs_text))
    if SMITH_LEFT_OUT.search(meta["Id"]):
        continue
    ingredients = [(i.lower(), int(n)) for i, n in re.findall(r'ItemClassId="([^"]+)" Amount="(\d+)"', body)]
    products = [(p.lower(), int(q)) for p, q in re.findall(r'BlacksmithRecipeProduct ItemClassId="([^"]+)" MinimalQuality="(\d+)"', body)]
    if not products or any(i not in ITEMS for i, _ in ingredients) or products[0][0] not in ITEMS:
        continue
    quality = products[0][1]
    level = max(1, min(22, round((quality - 36) * 0.6)))
    category = "Lanças e machados" if meta["Id"] == "r_polearmBruncvik" else SMITH_CATEGORY.get(meta.get("Category", ""), "Outros")
    recipe("forja", category, products[0][0], 1, ingredients + [(CHARCOAL, 1)], level, 12 + level * 2, 14, recipe_id=f"forja:{meta['Id']}")

# The other metal weapons (maces, hammers, daggers, polearms, shields, the swords and axes the smithing table lacks), and the
# metal armour, from the game's catalog of pieces: one recipe for each piece by its name (the best-kept variant of it).
pieces = items_doc.load()
forged = {r["output"] for r in RECIPES if r["station"] == "forja"}
by_name = defaultdict(list)
for row in pieces:
    found = items_doc.classify(row)
    if found is None or row["_unique"] or items_doc.arms(row["pt"]):
        continue
    kind, part = found
    by_name[(kind, part, row["pt"])].append(row)
best = {key: max(rows, key=price) for key, rows in by_name.items()}

# The game's sound for a coat of mail is `armor_chainmail`, which the first pattern (`armor_mail`) never matched: no mail coat, collar or coif was
# ever forged (2026-10-21: "adicione para o ferreiro cotas de malha"). The gauntlets (`armor_gauntlets`) are still left out.
METAL_SOUND = re.compile(r"armor_(mail|chainmail|plate|helmet|metal)|weapon_", re.I)
CHAIN_SOUND = re.compile(r"armor_chainmail", re.I)
TEXTILE_SOUND = re.compile(r"clothes|armor_(gambeson|leather|cloth)", re.I)
FORGE_PARTS = {"Espadas": "Espadas curtas", "Adagas": "Adagas", "Maças e martelos": "Maças e martelos", "Machados": "Machados", "Armas de haste": "Lanças e machados", "Escudos": "Escudos",
               "Capacetes": "Capacetes", "Almofres": "Cotas e almofres", "Golas": "Cotas e almofres", "Tronco": "Peitorais e cotas", "Braços e mãos": "Braços e manoplas", "Pernas": "Pernas"}
SEW_PARTS = {"Cabeça": "Chapéus e capuzes", "Tronco e vestidos": "Túnicas e vestidos", "Calças": "Calças", "Calçados": "Calçados", "Mãos": "Luvas", "Tronco": "Gibões e couraças de couro",
             "Almofres": "Gibões e couraças de couro", "Braços e mãos": "Luvas", "Pernas": "Calças"}

forge_rows = []
sew_rows = []
for (kind, part, _pt), row in best.items():
    sound = row.get("UiSound") or ""
    if kind in ("arma", "escudo") and part in FORGE_PARTS:
        if row["Id"] not in forged and part not in ("Arcos", "Bestas", "Armas de fogo", "Tochas"):
            forge_rows.append((part, row))
    elif kind == "armadura" and part in FORGE_PARTS and METAL_SOUND.search(sound):
        forge_rows.append((part, row))
    elif kind in ("roupa", "armadura") and part in SEW_PARTS and (kind == "roupa" or TEXTILE_SOUND.search(sound)):
        sew_rows.append((part, row))

forge_levels = {}
chain_rows = [(p, r) for p, r in forge_rows if CHAIN_SOUND.search(r.get("UiSound") or "")]
plain_rows = [(p, r) for p, r in forge_rows if not CHAIN_SOUND.search(r.get("UiSound") or "")]
for part in {p for p, _ in plain_rows}:
    forge_levels.update(levels_by_price([r for p, r in plain_rows if p == part], top=24, low=2))

# Mail (2026-10-21) has a band of its own, by its price among the mail: the game prices a coat of mail below plate, and by that price alone a
# hauberk of 19 kg would be forged from scrap at the second level. The coats run from the eighth level to the sixteenth, a collar is the sixth
# and a mail coif the ninth. Nothing that was forged before changes its level.
MAIL_BAND = {"Tronco": (8, 16), "Golas": (6, 6), "Almofres": (9, 9)}
for part in {p for p, _ in chain_rows}:
    mine = sorted((r for p, r in chain_rows if p == part), key=price)
    low, high = MAIL_BAND[part]
    for index, row in enumerate(mine):
        forge_levels[row["Id"]] = round(low + (high - low) * index / max(1, len(mine) - 1))


def metal_bill(part: str, row, level: int):
    """What a piece of the forge takes: more and better metal the dearer it is."""
    weight = max(0.5, float(row.get("Weight") or 1))
    units = max(1, min(8, round(weight * 0.8)))
    metal = [SCRAP, IRON, STEEL, STEEL_F, STEEL_T][min(4, level // 6)]
    bill = [(metal, units), (HARDWARE, 1 + level // 10), (CHARCOAL, 1)]
    if part in ("Almofres", "Golas", "Tronco", "Braços e mãos", "Pernas", "Capacetes"):
        bill.append((COW if level < 12 else DEER_SKIN, 1))
    if level >= 16:
        bill.append((COPPER, 1))
    return bill


for part, row in forge_rows:
    level = forge_levels[row["Id"]]
    recipe("forja", FORGE_PARTS[part], row["Id"], 1, metal_bill(part, row, level), level, xp_for(level, 14), 12 + level // 2)

# Bows and arrows (user, 2026-10-19: "coloque para o ferreiro fabricar arco e flecha também"). The game's bows and arrows are bought
# or looted, never forged, so these are written here. A bow takes seasoned wood by its weight, thread for the string and, from
# level 14, one piece of the exotic wood; the plain village bows are the first level 2, the hunting bows of ash and yew the last.
# Arrows come five to the batch: a shaft, a feather and a head of the metal their level asks for (the crudest are only fire-hardened).
FEATHER, EXOTIC_WOOD = G("special_featherRooster"), G("bsmt_woodExotic")
bow_rows = [row for (kind, part, _pt), row in best.items() if kind == "arma" and part == "Arcos" and not row["Name"].endswith("_empty") and not QUEST.search(row["Name"]) and "reward" not in row["Name"].lower()]
bow_levels = levels_by_price(bow_rows, top=24, low=2)
for row in bow_rows:
    level = bow_levels[row["Id"]]
    bill = [(BOW_WOOD, max(2, min(6, round(float(row.get("Weight") or 1) * 2)))), (THREAD, 2)]
    if level >= 14:
        bill.append((EXOTIC_WOOD, 1))
    recipe("forja", "Arcos", row["Id"], 1, bill, level, xp_for(level, 14), 12 + level // 2)

ARROWS = ["arrow_crude", "arrow_normal", "arrow_cutting", "arrow_precise", "arrow_hunting", "arrow_piercing", "arrow_enh_precise", "arrow_enh_hunting", "arrow_enh_cutting", "arrow_enh_piercing"]
arrow_rows = [ITEMS[G(name)] for name in ARROWS]
arrow_levels = levels_by_price(arrow_rows, top=20, low=1)
for row in arrow_rows:
    level = arrow_levels[row["Id"]]
    head = None if row["Name"] == "arrow_crude" else [SCRAP, IRON, STEEL, STEEL_F][0 if level < 6 else 1 if level < 12 else 2 if level < 17 else 3]
    recipe("forja", "Flechas", row["Id"], 5, [(BOW_WOOD, 1), (FEATHER, 1)] + ([(head, 1)] if head else []), level, xp_for(level, 8), 8 + level // 3)

REPAIR = [
    ("repairKit_weaponSmall", [(IRON, 1), (HARDWARE, 1), (CHARCOAL, 1)], 3),
    ("repairKit_armourSmall", [(IRON, 1), (HARDWARE, 1), (COW, 1)], 5),
    ("repairKit_bowyerSmall", [(BOW_WOOD, 1), (THREAD, 1)], 4),
    ("repairKit_rifleSmall", [(STEEL, 1), (HARDWARE, 1)], 9),
]
for output, ingredients, level in REPAIR:
    if output in BY_NAME:
        recipe("forja", "Kits de reparo", G(output), 1, ingredients, level, xp_for(level, 10), 8)

# The lockpick (user, 2026-10-24: "adicionar gazua para o ferreiro fazer"): the game's own `player_lockpick`, which the smith bends of a bit of scrap iron
# and a piece of hardware over the coals; two to the batch, since a clumsy hand breaks them. It is what a door's or a chest's "arrombar" (hold E) takes.
recipe("forja", "Ferramentas", G("player_lockpick"), 2, [(SCRAP, 1), (HARDWARE, 1), (CHARCOAL, 1)], 3, xp_for(3, 10), 10, recipe_id="forja:gazua")

# The torch (user, 2026-10-28: "adicionar receita de tochas para o ferreiro"): the game's own `torch_weapon`, the one the player draws in the dark and carries lit, a
# piece of firewood wrapped in a rag and soaked in lard; two to the batch, from the first level (the game sells it for 60 groschen).
recipe("forja", "Ferramentas", G("torch_weapon"), 2, [(LENHA, 1), (LINEN, 1), (LARD, 1)], 1, xp_for(1, 8), 8, recipe_id="forja:tocha")

# Wooden weapons (user, 2026-10-24: "nas receitas do ferreiro vamos add as armas de madeira"): the game's practice weapons, the ones its fencing
# masters and its tournaments' sparring use, worked of the Coletores' wood (`LENHA`). They were left out of the forge with the other training
# gear; now they are its first work, from the club of the first level to the practice shield.
# table name, level, pieces of wood, seconds
WOODEN = [
    ("maceClubTraining", 1, 2, 8),
    ("shortswordTraining", 1, 3, 10),
    ("axeTraining", 1, 3, 10),
    ("polearmTraining", 2, 3, 10),
    ("longswordTraining", 2, 4, 12),
    ("shieldKiteTraining", 3, 5, 12),
]
for name, level, wood, seconds in WOODEN:
    if name in BY_NAME:
        recipe("forja", "Armas de madeira", G(name), 1, [(LENHA, wood)], level, xp_for(level, 8), seconds, recipe_id=f"forja:madeira-{name}")

# ---------------------------------------------------------------------------------------------------------------------
# Horse tack (2026-10-23: "coloque para o ferreiro poder forjar selas e coisas de cavalo"). A horse wears a saddle (the saddlebags are part of it),
# a bridle or a chanfron, a harness or a caparison over the saddle, and horseshoes. The game's table `item__horse.xml` holds five hundred pieces:
# a few dozen kinds in a dozen colours each, and the heraldic ones. Here, one piece of each plain kind, in a colour the game's own sets of tack use
# (so the name is surely horse gear): forged of leather, seasoned wood for the saddle tree, iron for the stirrups and the bits, hardware for the
# buckles, thread and linen. The dearer the kind, the later the level, from the Prague saddle at the second to the dragon saddle at the twenty-second.
# The horseshoes are the game's own smithing recipes (five of them: the farmer's, the knight's, the noble's, the Lovarian's and the racing ones),
# which are read now that its horse items are.
TACK = [
    ("Selas", "sela", "BasicSaddle01_m03"),
    ("Selas", "sela", "BasicSaddle02_m06"),
    ("Selas", "sela", "BasicSaddle03_m05"),
    ("Selas", "sela", "EastSaddle02_m08"),
    ("Selas", "sela", "EastSaddle01_m06"),
    ("Selas", "sela", "WarSaddle01_m06"),
    ("Selas", "sela", "WarSaddle02_m09"),
    ("Selas", "sela", "NobleSaddle02_m15"),
    ("Selas", "sela", "NobleSaddle01_m04"),
    ("Selas", "sela", "WarSaddle03_m13"),
    ("Selas", "sela", "NobleSaddle03_m04"),
    ("Rédeas e chanfros", "rédea", "BasicBridle01_m01"),
    ("Rédeas e chanfros", "rédea", "BasicBridle03_m01"),
    ("Rédeas e chanfros", "rédea", "BasicBridle02_m06"),
    ("Rédeas e chanfros", "rédea", "EastBridle02_m01"),
    ("Rédeas e chanfros", "rédea", "NobleBridle01_m01"),
    ("Rédeas e chanfros", "rédea", "NobleBridle02_m01"),
    ("Rédeas e chanfros", "chanfron", "WarChanfron02_m06"),
    ("Rédeas e chanfros", "chanfron", "WarChanfron03_m07"),
    ("Rédeas e chanfros", "chanfron", "WarChanfron01_m05"),
    ("Arreios e caparazões", "arreio", "BasicHarness02_m02"),
    ("Arreios e caparazões", "arreio", "BasicHarness01_m05"),
    ("Arreios e caparazões", "arreio", "BasicHarness03_m11"),
    ("Arreios e caparazões", "caparazão", "Caparison01_m08"),
    ("Arreios e caparazões", "caparazão", "PaddedCaparison02_m03"),
    ("Arreios e caparazões", "caparazão", "PaddedCaparison03_m10"),
    ("Arreios e caparazões", "caparazão", "NobleCaparison03_m12"),
    ("Arreios e caparazões", "caparazão", "NobleCaparison01_m11"),
    ("Arreios e caparazões", "caparazão", "NobleCaparison04_m08"),
    ("Arreios e caparazões", "caparazão", "NobleCaparison06_m04"),
]
missing = [name for _category, _kind, name in TACK if name not in BY_NAME]
if missing:
    raise SystemExit(f"no horse item called {', '.join(missing)}")
tack_levels = {}
for category in {c for c, _k, _n in TACK}:
    tack_levels.update(levels_by_price([BY_NAME[n] for c, _k, n in TACK if c == category], top=22, low=2))


def tack_bill(kind: str, row, level: int):
    """What a piece of tack takes: leather by its weight, and the fittings the kind has."""
    weight = max(0.5, float(row.get("Weight") or 1))
    hide = COW if level < 8 else PIG_SKIN if level < 16 else DEER_SKIN
    if kind == "sela":
        return [(hide, max(2, min(6, round(weight / 4)))), (BOW_WOOD, 2 + level // 10), (IRON, 1 + level // 9), (HARDWARE, 1 + level // 8), (THREAD, 2 + level // 8), (LINEN, 1)]
    if kind == "rédea":
        return [(hide, 1 + level // 10), (IRON, 1), (HARDWARE, 1 + level // 10), (THREAD, 1)]
    if kind == "chanfron":
        return metal_bill("Capacetes", row, level)
    if kind == "arreio":
        return [(hide, max(2, min(5, round(weight / 2.5)))), (HARDWARE, 1 + level // 8), (THREAD, 2 + level // 8)]
    bill = [(LINEN, max(3, min(8, round(weight / 2)))), (THREAD, 2 + level // 6), (HARDWARE, 1)]
    return bill + [(SHEEP, 1)] if level >= 14 else bill


for category, kind, name in TACK:
    row = BY_NAME[name]
    level = tack_levels[row["Id"]]
    recipe("forja", category, row["Id"], 1, tack_bill(kind, row, level), level, xp_for(level, 14), 12 + level // 3)

# ---------------------------------------------------------------------------------------------------------------------
# Sewing.

sew_levels = {}
for part in {p for p, _ in sew_rows}:
    sew_levels.update(levels_by_price([r for p, r in sew_rows if p == part], top=24, low=0))
LEATHERY = re.compile(r"Boots|Shoes|Gloves|HandWrap|Leather|armor_leather", re.I)


def cloth_bill(part: str, row, level: int):
    weight = max(0.3, float(row.get("Weight") or 1))
    units = max(1, min(6, round(weight * 0.9)))
    leather = bool(LEATHERY.search((row.get("Clothing") or "") + " " + (row.get("UiSound") or "")))
    if leather:
        bill = [(COW if level < 8 else PIG_SKIN if level < 16 else DEER_SKIN, units), (THREAD, 1 + level // 8)]
    else:
        bill = [(LINEN, units), (THREAD, 1 + level // 8)]
    if level >= 14 and not leather:
        bill.append((SHEEP, 1))
    return bill


# House coats (2026-10-26: "nas criações dos artesões vamos adicionar para ele poder criar os casacos com brasões de casas"). The clothes that carry the arms of a
# city or a house -- the coats and tunics of ARMADURAS.md's "Casas e cidades", `Coat02_mLeipa_D` or `Waffenrock09_mPisek_B`, the house's token after `_m` in the
# code -- are made below, one category for each house. The pass that follows took the dearest piece of every name, which for "Túnica simples" or "Túnica de
# montaria" was whichever house's it happened to be: those pieces are left to the houses (every colour of them), and the levels of the rest do not move.
HOUSE_COATS = [
    ("Kuttenberg", ["Kuttenberg"]),
    ("Praga", ["Prague"]),
    ("Bergow", ["Bergov"]),
    ("Leipa", ["Leipa"]),
    ("Nebakov", ["Nebak"]),
    ("Písek", ["Pisek"]),
    ("Polner", ["Polner"]),
    ("Ruthard", ["Ruthart", "Ruthard"]),
    ("Semine", ["Semin"]),
    ("Vavák", ["Vavak"]),
    ("Zavish", ["Zavis"]),
    ("Zimburg", ["Cimburk"]),
]


def house_pieces():
    """([(house, row)], ids): for each house one piece for each name of its coats and tunics (the plain colours of it, not the numbered), and every id of them."""
    found = []
    ids = set()
    for house, tokens in HOUSE_COATS:
        token = re.compile("_m(?:" + "|".join(tokens) + ")([0-9]*)(?:_|$)")
        by_pt = defaultdict(list)
        for row in pieces:
            if row["_unique"] or row["Id"].lower() not in ITEMS or items_doc.classify(row) != ("roupa", "Tronco e vestidos"):
                continue
            hit = token.search(row["Name"])
            if hit:
                ids.add(row["Id"].lower())
                by_pt[row["pt"]].append((hit.group(1) != "", row["Name"], row))
        for options in by_pt.values():
            found.append((house, min(options, key=lambda option: option[:2])[2]))
    return found, ids


HOUSE_PIECES, HOUSE_IDS = house_pieces()

# Plain tunics (2026-10-26: "vamos add túnicas lisas para o artesão"). Six names of the game's surcoats come in numbered dyes (`Waffenrock02_m01_D`, `_m02_D`, ...) as well
# as with a house's arms. The pass below made one recipe for each name, of its dearest piece, which for three of them (the simple tunic, the riding tunic, the knight's
# tunic) was a house's and went to the house when the arms were given their own categories: those three had no plain recipe left. Every dye of the six is made now, in
# a category of its own, at the level its name had (the three that lost theirs keep the level of the house piece that was theirs), with the colour after the name (a
# word read off the item's icon by `make-tunic-colours.py`, and a number after one that two dyes of a name share).
SURCOATS = ["Túnica simples", "Túnica com bainha", "Túnica para cavaleiro", "Túnica de montaria", "Túnica ornamentada", "Túnica com fecho"]
TUNIC_COLOURS = json.loads((HERE / "tunic-colours.json").read_text(encoding="utf-8")) if (HERE / "tunic-colours.json").exists() else {}
PLAIN_TUNICS = defaultdict(list)
for row in pieces:
    if (
        row["pt"] in SURCOATS
        and not row["_unique"]
        and row["Id"].lower() in ITEMS
        and row["Id"].lower() not in HOUSE_IDS
        and items_doc.classify(row) == ("roupa", "Tronco e vestidos")
        and re.search(r"_m\d+(_|$)", row["Name"])
    ):
        PLAIN_TUNICS[row["pt"]].append(row)
SURCOAT_LEVEL = {key[2]: sew_levels[row["Id"]] for key, row in best.items() if key[:2] == ("roupa", "Tronco e vestidos") and key[2] in SURCOATS}

# The Cuman clothes (2026-10-27: "adicione roupas cumanas na fabricação do artesão"). The game has four, each in ten dyes: the tall hat, the leather hat, the boots and the caftan.
# The pass below made one recipe for each name, of its dearest dye, scattered among the hats, the boots and the coats; every dye of them is made now, together, in a category
# of their own, at the level their name had, with the colour after the name as the plain tunics' (words read off the icons by `make-tunic-colours.py`, numbered where two dyes share one).
CUMAN = defaultdict(list)
for row in pieces:
    kind = items_doc.classify(row)
    if (
        re.search(r"cuman", row["pt"], re.I)
        and kind is not None
        and kind[0] == "roupa"
        and not row["_unique"]
        and row["Id"].lower() in ITEMS
        and row["Id"].lower() not in HOUSE_IDS
        and re.search(r"_m\d+(_|$)", row["Name"])
    ):
        CUMAN[row["pt"]].append(row)
CUMAN_LEVEL = {key[2]: sew_levels[row["Id"]] for key, row in best.items() if key[0] == "roupa" and key[2] in CUMAN}

for part, row in sew_rows:
    if row["Id"].lower() in HOUSE_IDS or (part == "Tronco e vestidos" and row["pt"] in SURCOATS) or (row["pt"] in CUMAN and row["pt"] in CUMAN_LEVEL):
        continue
    level = sew_levels[row["Id"]]
    recipe("costura", SEW_PARTS[part], row["Id"], 1, cloth_bill(part, row, level), level, xp_for(level, 8), 8 + level // 3)

# The tailor's and the cobbler's repair kits (2026-10-21: "vamos adicionar no artesão o kit de reparos de botas e roupas, se existir"): the game
# has both, for clothes and for shoes and boots, as the smith has the armourer's and the weaponsmith's.
SEW_REPAIR = [
    ("repairKit_tailorsSmall", [(LINEN, 1), (THREAD, 2)], 2),
    ("repairKit_cobblersSmall", [(COW, 1), (THREAD, 1)], 3),
]
for output, ingredients, level in SEW_REPAIR:
    if output in BY_NAME:
        recipe("costura", "Kits de reparo", G(output), 1, ingredients, level, xp_for(level, 8), 8)

# Jewellery (2026-10-22: "adicionar receitas de anéis e colares para o artesão"). Every ring, necklace and brooch of the game that is neither a quest's
# nor made of what is not for sale: the silver of the Coletores (a bar from the forge), the copper, the jasper and the enamel powder of the
# smith's vendor, thread and linen of the tailor's. The ones of gold, of garnets and of pearls are left out: the game gives nothing to make them of.
# A level follows the price, from the brass brooch at the second to the dearest silver at the nineteenth; what a piece takes is a little more
# than the metal and the stone it is made of, and the cord. (The silver rings and the enamelled brooch were the forge's until this day.)
JASPER, ENAMEL = G("bsmt_jaspis"), G("bsmt_emailPowder")
JEWELS = [
    ("Colares e broches", "brooch_brass_inscription", [(COPPER, 1), (HARDWARE, 1)], 2),
    ("Colares e broches", "necklace_tin_cross", [(COPPER, 2), (THREAD, 1)], 4),
    ("Colares e broches", "brooch_silver", [(SILVER_BAR, 1), (HARDWARE, 1)], 5),
    ("Colares e broches", "loot_necklace_jasperBeads", [(JASPER, 2), (THREAD, 1)], 7),
    ("Colares e broches", "necklace_scapular_saint", [(LINEN, 1), (THREAD, 2), (COPPER, 1)], 8),
    ("Colares e broches", "necklace_scapular_window", [(LINEN, 1), (THREAD, 2), (COPPER, 1), (JASPER, 1)], 11),
    ("Anéis", "ring_silver_engraved", [(SILVER_BAR, 2), (HARDWARE, 1)], 12),
    ("Colares e broches", "brooch_inlaid", [(COPPER, 2), (JASPER, 1), (THREAD, 1)], 13),
    ("Anéis", "ring_silver_gem", [(SILVER_BAR, 2), (JASPER, 1)], 14),
    ("Colares e broches", "loot_necklace_gem", [(JASPER, 3), (SILVER_BAR, 1), (THREAD, 1)], 14),
    ("Colares e broches", "necklace_scapular_letter", [(LINEN, 1), (THREAD, 2), (SILVER_BAR, 1), (ENAMEL, 1)], 15),
    ("Colares e broches", "brooch_silver_enamel", [(SILVER_BAR, 2), (ENAMEL, 1)], 16),
    ("Colares e broches", "necklace_silver_cross_insignia", [(SILVER_BAR, 2), (ENAMEL, 1), (THREAD, 1)], 17),
    ("Colares e broches", "necklace_silver_cross_garnet", [(SILVER_BAR, 2), (JASPER, 1), (THREAD, 1)], 17),
    ("Anéis", "ring_gem", [(SILVER_BAR, 3), (JASPER, 2)], 18),
    ("Anéis", "ring_engraved_gem", [(SILVER_BAR, 3), (JASPER, 2), (HARDWARE, 1)], 19),
]
for category, output, ingredients, level in JEWELS:
    if output in BY_NAME:
        recipe("costura", category, G(output), 1, ingredients, level, xp_for(level, 8), 10 + level // 2)
    else:
        print(f"joias: o jogo não tem {output}; ficou de fora")

# The house coats themselves: a category for each house, a recipe for each coat and tunic it has. They are the cloth's bill (the linen, or the wool of the dearer) with
# two more spools of thread for the embroidery of the arms, from the sixth level to the eighteenth by the game's price, and slower to sew than a plain tunic.
house_levels = levels_by_price([row for _, row in HOUSE_PIECES], top=18, low=6)
for house, row in HOUSE_PIECES:
    gid = row["Id"].lower()
    level = house_levels[row["Id"]]
    bill = [(item, n + 2 if item == THREAD else n) for item, n in cloth_bill("Tronco e vestidos", row, level)]
    recipe("costura", f"Brasão: {house}", gid, 1, bill, level, xp_for(level, 8), 12 + level // 2)
    name, icon = USED[gid]
    # Four houses wear a "Sobretudo de brasão": the list tells them apart by the house, unless the game's own name says it already.
    if house.lower() not in name.lower():
        USED[gid] = (f"{name} ({house})", icon)

# The plain tunics themselves: a recipe for each dye of the six surcoats, by the game's number of the dye.
for name in SURCOATS:
    dyes = sorted(PLAIN_TUNICS.get(name, []), key=lambda row: (int(re.search(r"_m(\d+)", row["Name"]).group(1)), row["Name"]))
    level = SURCOAT_LEVEL[name]
    colours = [TUNIC_COLOURS.get(row["Name"]) or "cor " + re.search(r"_m(\d+)", row["Name"]).group(1) for row in dyes]
    sharing = {colour: colours.count(colour) for colour in colours}
    counted = defaultdict(int)
    for row, colour in zip(dyes, colours):
        gid = row["Id"].lower()
        counted[colour] += 1
        recipe("costura", "Túnicas lisas", gid, 1, cloth_bill("Tronco e vestidos", row, level), level, xp_for(level, 8), 8 + level // 3)
        icon = USED[gid][1]
        # A word two dyes share is numbered from one (so that "ocre 1" sorts before "ocre 2", and both before "ocre escura").
        USED[gid] = (f"{name} ({colour if sharing[colour] == 1 else f'{colour} {counted[colour]}'})", icon)

# The Cuman clothes themselves: a recipe for each dye of the four, by the game's number of the dye, the bill and the level of the piece's own kind.
for name in sorted(CUMAN_LEVEL, key=lambda n: (CUMAN_LEVEL[n], n)):
    dyes = sorted(CUMAN[name], key=lambda row: (int(re.search(r"_m(\d+)", row["Name"]).group(1)), row["Name"]))
    level = CUMAN_LEVEL[name]
    colours = [TUNIC_COLOURS.get(row["Name"]) or "cor " + re.search(r"_m(\d+)", row["Name"]).group(1) for row in dyes]
    sharing = {colour: colours.count(colour) for colour in colours}
    counted = defaultdict(int)
    for row, colour in zip(dyes, colours):
        gid = row["Id"].lower()
        counted[colour] += 1
        recipe("costura", "Roupas cumanas", gid, 1, cloth_bill(items_doc.classify(row)[1], row, level), level, xp_for(level, 8), 8 + level // 3)
        icon = USED[gid][1]
        USED[gid] = (f"{name} ({colour if sharing[colour] == 1 else f'{colour} {counted[colour]}'})", icon)

# Belts and pouches (2026-10-26: "vamos add cintos e bolsas para o artesão poder fazer"). What gives a player their quick slots: the hunter's, the knight's and the
# noble's belt (two, three and four slots) and the four pouches (one to four), which the game calls "bolsilhas" and files as `Pouch_test_*`. Leather by the same steps
# as the clothes (cow, pig, deer), thread, the smith's fittings for the buckles and the clasps; the noble's pieces carry the Coletores' silver. The level follows
# the price, from the hunter's belt at the sixth to the noble's pouch at the twentieth.
BELTS = [
    ("Cintos", "belt_2slot", [(COW, 2), (THREAD, 2), (HARDWARE, 1)], 6),
    ("Bolsas", "Pouch_test_1slot", [(COW, 1), (THREAD, 2)], 8),
    ("Bolsas", "Pouch_test_2slot", [(PIG_SKIN, 1), (THREAD, 2), (HARDWARE, 1)], 11),
    ("Cintos", "belt_3slot", [(PIG_SKIN, 2), (THREAD, 3), (HARDWARE, 2)], 14),
    ("Bolsas", "Pouch_test_3slot", [(DEER_SKIN, 1), (LINEN, 1), (THREAD, 3), (HARDWARE, 1)], 16),
    ("Cintos", "belt_4slot", [(DEER_SKIN, 2), (THREAD, 3), (HARDWARE, 2), (SILVER_BAR, 1)], 19),
    ("Bolsas", "Pouch_test_4slot", [(DEER_SKIN, 2), (LINEN, 1), (THREAD, 3), (SILVER_BAR, 1)], 20),
]
for category, output, ingredients, level in BELTS:
    if output in BY_NAME:
        recipe("costura", category, G(output), 1, ingredients, level, xp_for(level, 8), 10 + level // 2)
    else:
        print(f"cintos: o jogo não tem {output}; ficou de fora")

# ---------------------------------------------------------------------------------------------------------------------
# Alchemy: the game's own recipes, brewed in its own minigame; the page only chooses which one the player is taught.

ALCH_TEXT = TABLES.read("Libs/Tables/minigame/AlchemyRecipe.xml").decode("utf-8", "replace")
BASES = {"Water": G("water"), "Wine": G("wine")}
alch = []
for attrs_text, body in re.findall(r"<AlchemyRecipe ([^>]*)>(.*?)</AlchemyRecipe>", ALCH_TEXT, re.S):
    meta = dict(ATTR.findall(attrs_text))
    products = re.findall(r'<AlchemyProduct Quality="(\d+)" ProductItemId="([^"]+)"', body)
    if not products:
        continue
    product = products[0][1].lower()
    if product not in ITEMS or not usable(ITEMS[product]):
        continue
    ingredients = [(i.lower(), int(n)) for i, n in re.findall(r'IngredientItemId="([^"]+)" Quantity="(\d+)"', body)]
    if any(i not in ITEMS for i, _ in ingredients):
        continue
    steps = len(re.findall(r"<AlchemyRecipeStep ", body))
    alch.append((meta, product, ingredients, steps))
alch.sort(key=lambda entry: (entry[3], price(ITEMS[entry[1]])))
for index, (meta, product, ingredients, steps) in enumerate(alch):
    level = round(index / max(1, len(alch) - 1) * 20)
    base = meta.get("BaseMaterial", "Water")
    bill = ingredients + ([(BASES[base], 1)] if base in BASES else [])
    kind = ITEMS[product]["_tag"]
    category = "Venenos" if kind == "Poison" else "Óleos e pomadas" if kind == "Ointment" else "Poções"
    recipe("alquimia", category, product, 1, bill, level, int(meta.get("BaseQualityRewardXP") or 10), 0, recipe_id=f"alquimia:{meta['RecipeId']}", alchemy=int(meta["RecipeId"]))

# Bandages, the alchemists' (user, 2026-10-18: "alquimista precisa poder fazer ataduras, ou ferreiro, ou artesão, o que fizer mais
# sentido": the apothecary is the one who dresses wounds). Made on the page itself, like sewing, not at the game's table (no
# `alchemy`): a strip of linen and a healing herb, two bandages.
for herb in ("herb_comfrey", "herb_marigold"):
    recipe("alquimia", "Medicina", guid("bandage_classic"), 2, [(guid("loot_cloth"), 1), (guid(herb), 1)], 0, 6, 6, recipe_id=f"alquimia:atadura-{herb.split('_')[1]}")

# What the world has no way to give (2026-10-27, user: "uns cogumelos e raros que não tem no jogo coloque como receita de alquimista"): the mushrooms, the rare root and pearl
# and the leached charcoal that the apothecaries' vendor sold. The alchemist grows, steeps and prepares them on the page, as the bandages (no `alchemy`), of what the other
# guilds bring: the Coletores' logs, the water, the garden's herbs, the miners' enamel powder and cobwebs.
LEACHED = "55be7c8b-7ef1-4e45-820d-d04a2497f016"
recipe("alquimia", "Preparos", LEACHED, 2, [(CHARCOAL, 3), (WATER, 2)], 2, xp_for(2), 8, recipe_id="alquimia:carvao-lixiviado")
recipe("alquimia", "Cogumelos", G("boletus"), 2, [(LOG, 1), (WATER, 1)], 4, xp_for(4), 10, recipe_id="alquimia:cultivo-boletos")
recipe("alquimia", "Cogumelos", G("lepiota"), 2, [(LOG, 1), (WATER, 1), (G("herb_chamomile"), 1)], 7, xp_for(7), 10, recipe_id="alquimia:cultivo-lepiotas")
recipe("alquimia", "Cogumelos", G("special_mushroomAmanita"), 1, [(LOG, 1), (WATER, 1), (G("herb_nightshade"), 1)], 11, xp_for(11), 12, recipe_id="alquimia:cultivo-amanitas")
recipe("alquimia", "Raridades", G("maliruvLek_freshwaterPearl"), 1, [(G("bsmt_emailPowder"), 2), (G("special_cobweb"), 1), (SALT, 1), (WATER, 1)], 14, xp_for(14), 14, recipe_id="alquimia:perola-cultivada")
recipe("alquimia", "Raridades", G("maliruvLek_mandrakeRoot"), 1, [(G("herb_belladona"), 2), (G("herb_nightshade"), 2), (WATER, 1)], 17, xp_for(17), 16, recipe_id="alquimia:mandragora-cultivada")

# ---------------------------------------------------------------------------------------------------------------------
# The gardens of the Agricultores (2026-10-22, src/server/farm.ts: "ele interage com a horta ... e abre um menu na direita falando o que ele
# pode plantar, o que precisa para plantar e em quanto tempo ele pode vir colher ... seria legal ele poder plantar ingredientes que o
# cozinheiro precisa"). What the kitchen's soups and the fire take (the roots, the cabbage, the onion and the garlic, the nettles), and the
# alchemists' garden herbs higher up. A bed takes a handful of seeds (our own item: the game sells none) and a shovel in the bag; what it
# gives comes up after `minutes` of real time, with a seed or two to sow again. Levels are of survival, the XP is given at the harvest.
# The models are what the bed shows while it grows (the plant, small, then grown) and, ripe, what lies at its foot: meshes of the game's
# catalog a probe of the live server spawned as props on 2026-10-22.
# id, name, the seed's name, the game item it gives, (least, most), minutes, level, xp, category, plant, produce at the foot ("" for none), seed price
PLANT = "objects/natural/vegetation/field/plants/"
VEG = "objects/manmade/food/food/vegetable/"
FRUIT = "objects/manmade/food/food/fruits/"
SAPLING = "objects/natural/vegetation/forest_undergrowth/"
BUSH = "objects/natural/vegetation/bushes/berries/"
CROPS = [
    # The textile and the grain crops (2026-10-27, SINERGIA.md): flax is what the Artifices' linen and thread are made of (the biggest need of all the trades), wheat and
    # barley what the Tabernarii's flour and malt are, hops their beer's bitter, and grapes their wine. The meshes are the nearest of the catalog's.
    ("cebola", "Cebola", "Sementes de cebola", "onion", (4, 6), 30, 0, 6, "Legumes", PLANT + "plantago_a.cgf", VEG + "onion_2.cgf", 3),
    ("repolho", "Repolho", "Sementes de repolho", "cabbage", (2, 3), 40, 0, 8, "Legumes", PLANT + "symphytum_officinale.cgf", VEG + "cabbage.cgf", 6),
    ("linho", "Linho", "Sementes de linho", "loot_cloth", (3, 5), 40, 0, 6, "Fibras", PLANT + "salvia_officinalis.cgf", "", 4),
    ("trigo", "Trigo", "Sementes de trigo", "kcdc-craft:trigo", (4, 6), 45, 1, 6, "Grãos", PLANT + "rumex_acetosa.cgf", "", 3),
    ("nabo", "Nabo", "Sementes de nabo", "turnip", (4, 6), 30, 2, 6, "Legumes", PLANT + "atriplex_hortensis.cgf", VEG + "turnip.cgf", 3),
    ("cenoura", "Cenoura", "Sementes de cenoura", "carrot", (4, 6), 35, 3, 7, "Legumes", PLANT + "taraxacum_officinale.cgf", VEG + "carrot_c.cgf", 3),
    ("cevada", "Cevada", "Sementes de cevada", "kcdc-craft:cevada", (4, 6), 45, 3, 7, "Grãos", PLANT + "atriplex_hortensis.cgf", "", 3),
    ("urtiga", "Urtiga", "Sementes de urtiga", "herb_urticaria", (5, 8), 25, 4, 6, "Ervas", PLANT + "urtica_dioica.cgf", "", 2),
    ("beterraba", "Beterraba", "Sementes de beterraba", "beet", (3, 5), 40, 5, 8, "Legumes", PLANT + "rumex_acetosa.cgf", VEG + "turnip_black.cgf", 3),
    ("dente-de-leao", "Dente-de-leão", "Sementes de dente-de-leão", "herb_dandelion", (4, 6), 30, 5, 8, "Ervas", PLANT + "taraxacum_officinale.cgf", "", 2),
    ("alho", "Alho", "Alho-semente", "garlic", (3, 5), 45, 6, 9, "Legumes", PLANT + "plantago_a.cgf", VEG + "garlic_bundle.cgf", 6),
    ("maca", "Maçã", "Mudas de macieira", "apple", (3, 5), 55, 7, 10, "Frutas", SAPLING + "quercus_saplings_a.cgf", FRUIT + "apple.cgf", 8),
    ("cardo", "Cardo", "Sementes de cardo", "herb_thistle", (3, 5), 40, 7, 9, "Ervas", PLANT + "atriplex_hortensis.cgf", "", 3),
    ("pastinaca", "Pastinaca", "Sementes de pastinaca", "parsnip", (3, 4), 45, 8, 9, "Legumes", PLANT + "taraxacum_officinale.cgf", VEG + "parsnip_bundle.cgf", 3),
    ("pera", "Pera", "Mudas de pereira", "pear", (3, 5), 60, 9, 10, "Frutas", SAPLING + "fraxinus_saplings_a.cgf", "objects/manmade/food/food/pear_a.cgf", 8),
    ("lupulo", "Lúpulo", "Mudas de lúpulo", "kcdc-craft:lupulo", (3, 5), 60, 9, 10, "Grãos", PLANT + "urtica_dioica.cgf", "", 8),
    ("confrei", "Confrei", "Mudas de confrei", "herb_comfrey", (3, 5), 45, 9, 10, "Ervas", PLANT + "symphytum_officinale.cgf", "", 4),
    ("alho-poro", "Alho-poró", "Sementes de alho-poró", "leek", (3, 4), 50, 10, 10, "Legumes", PLANT + "plantago_a.cgf", VEG + "leek_bundle.cgf", 2),
    ("sabugueiro", "Sabugueiro", "Mudas de sabugueiro", "herb_elderberrry", (3, 5), 55, 10, 11, "Ervas", BUSH + "blackberry_bush_a.cgf", "", 6),
    ("ameixa", "Ameixa", "Mudas de ameixeira", "plums", (4, 6), 65, 11, 11, "Frutas", BUSH + "blackberry_bush_a.cgf", FRUIT + "plums_basket_c.cgf", 7),
    ("absinto", "Absinto", "Sementes de absinto", "herb_wormwood", (3, 5), 50, 11, 11, "Ervas", PLANT + "salvia_officinalis.cgf", "", 5),
    ("raiz-forte", "Raiz-forte", "Mudas de raiz-forte", "horseradish", (2, 3), 60, 12, 12, "Legumes", PLANT + "symphytum_officinale.cgf", "", 7),
    ("ervilha", "Ervilha", "Sementes de ervilha", "roastedPeas", (3, 5), 45, 12, 10, "Legumes", PLANT + "plantago_a.cgf", "", 3),
    ("pessego", "Pêssego", "Mudas de pessegueiro", "peaches", (3, 4), 70, 13, 12, "Frutas", SAPLING + "fagus_saplings_a.cgf", FRUIT + "peach.cgf", 9),
    ("valeriana", "Valeriana", "Sementes de valeriana", "herb_valerian", (3, 5), 50, 13, 11, "Ervas", PLANT + "plantago_a.cgf", "", 5),
    ("hortela", "Hortelã", "Mudas de hortelã", "herb_mint", (4, 6), 40, 14, 10, "Ervas", PLANT + "mentha.cgf", "", 4),
    ("uva", "Uva", "Mudas de videira", "kcdc-craft:uva", (3, 5), 75, 14, 12, "Frutas", SAPLING + "fagus_saplings_a.cgf", "", 10),
    ("melancia", "Melancia", "Sementes de melancia", "watermelon", (1, 2), 80, 15, 13, "Frutas", VEG + "watermelon_plant.cgf", VEG + "watermelon.cgf", 10),
    ("hiperico", "Erva-de-são-joão", "Sementes de erva-de-são-joão", "herb_hypericum", (3, 5), 55, 15, 12, "Ervas", PLANT + "calendula_officinalis.cgf", "", 5),
    ("salvia", "Sálvia", "Sementes de sálvia", "herb_salvia", (4, 6), 45, 16, 11, "Ervas", PLANT + "salvia_officinalis.cgf", "", 5),
    ("eufrasia", "Eufrásia", "Sementes de eufrásia", "herb_eyewort", (3, 5), 50, 17, 11, "Ervas", PLANT + "rumex_acetosa.cgf", "", 5),
    ("camomila", "Camomila", "Sementes de camomila", "herb_chamomile", (4, 6), 45, 18, 12, "Ervas", PLANT + "matricaria_chamomilla.cgf", "", 5),
    ("tanaceto", "Tanaceto", "Sementes de tanaceto", "herb_feverfew", (3, 5), 50, 19, 12, "Ervas", PLANT + "matricaria_chamomilla.cgf", "", 5),
    ("calendula", "Calêndula", "Sementes de calêndula", "herb_marigold", (4, 6), 50, 20, 12, "Ervas", PLANT + "calendula_officinalis.cgf", "", 5),
    ("beladona", "Beladona", "Sementes de beladona", "herb_belladona", (2, 4), 65, 21, 14, "Ervas", PLANT + "papaver_somniferum_a.cgf", "", 8),
    ("papoula", "Papoula", "Sementes de papoula", "herb_poppy", (3, 5), 60, 22, 14, "Ervas", PLANT + "papaver_somniferum_a.cgf", "", 6),
    ("meimendro", "Meimendro", "Sementes de meimendro", "herb_nightshade", (2, 4), 65, 22, 14, "Ervas", PLANT + "urtica_dioica.cgf", "", 8),
    ("paris", "Paris quadrifolia", "Sementes de paris quadrifolia", "herb_paris", (2, 4), 70, 23, 15, "Ervas", PLANT + "mentha.cgf", "", 9),
    ("gengibre", "Gengibre", "Mudas de gengibre", "herb_ginger", (2, 3), 80, 24, 16, "Ervas", PLANT + "mentha.cgf", "", 12),
    # Pepper (user, 2026-10-24: "nas plantações do agricultor vamos colocar pimenta e frutas"): the dearest spice there is, so it is the last, the
    # slowest and the rarest. The fruit are among the others by level: the game's own, from saplings and bushes that grow slowly and give little.
    ("pimenta", "Pimenta", "Sementes de pimenta", "driedPepperSpice", (2, 3), 90, 24, 16, "Especiarias", BUSH + "blueberry_bush_a.cgf", "", 40),
]
# The shovels a bed is dug with: the game's own, the one it gives for its treasures, and Wolfram's of its quest.
FARM_TOOLS = ["player_shovel", "player_shovel_wolfram"]
for key, name, seed_name, item, _yield, minutes, *_rest in CROPS:
    seed_price = _rest[-1]
    # The server takes only a miscellaneous item, a crafting material or a document as the look of an item of ours ("Unsupported custom item
    # visual" for the first try, a food, which left all fifteen unregistered): a sack for the vegetables, the incense's resin for the herbs.
    seed_visual = "special_olibanum" if _rest[2] in ("Ervas", "Fibras") else "loot_salt"
    CUSTOM[f"kcdc-craft:semente-{key}"] = (seed_name, f"Para semear um canteiro de horta: {name.lower()} em {minutes} minutos, com uma pá na bolsa.", seed_visual, 0.05, seed_price)
    use(f"kcdc-craft:semente-{key}")
    use(item if item in CUSTOM else guid(item))
for tool in FARM_TOOLS:
    use(guid(tool))

# What the Agricultores make of their harvest at the garden (2026-10-27, SINERGIA.md; user: "o artesão precisa de linho, o agricultor pode plantar linho e fazer
# linha"): the flax spun into thread for the Artifices, the grain milled into flour and malted for the Tabernarii, and the seeds kept back from any crop, so that a
# farmer needs no vendor for a seed. Done on the gardens' page (src/server/farm.ts); the level of a seed is its crop's.
# id, category, output, amount, [(item, n)], level, xp
PROCESSES = [
    ("fiar-linha", "Beneficiar", THREAD, 3, [(LINEN, 1)], 0, 3),
    ("moer-trigo", "Beneficiar", FLOUR, 1, [(WHEAT, 1)], 1, 3),
    ("maltear-cevada", "Beneficiar", MALT, 1, [(BARLEY, 1)], 3, 4),
]
for key, name, _seed_name, item, _yield, _minutes, level, *_rest in CROPS:
    PROCESSES.append((f"semente-{key}", "Sementes", f"kcdc-craft:semente-{key}", 1, [(item if item in CUSTOM else guid(item), 2)], level, 1))
for _id, _category, _output, _amount, _ingredients, _level, _xp in PROCESSES:
    use(_output)
    for _item, _n in _ingredients:
        use(_item)

# ---------------------------------------------------------------------------------------------------------------------
# Taking a piece apart (user, 2026-10-28: "jogador falou que não consegue desmontar roupas e armaduras diversas, só as que ele mesmo produz"). The extraction of the
# forge and of sewing (src/server/extract.ts) knew a piece by the class its recipe makes; but a recipe makes ONE class of each name (the dearest, `best`), and the game
# has many classes of the same piece (the same hood in a dozen colours, the same helmet in several states, the same coat of mail): of 2,100 pieces of clothing and
# armour, 400 were the ones with a recipe, and a player could take apart only those. Now every class of a piece takes apart as the piece the recipe makes, in
# proportion to its own price (EXTRACT_ALIASES: class -> [the class of the recipe, the same kind, part and name; the share of the recipe's bill its price is worth, in
# hundredths]: a felt hat of 16 groschen is not worth the 311 of the dearest one, and gives nothing back), and the armour no recipe makes (the gauntlets, the padded
# collars and coifs) has a bill of its own, of the same metal or cloth a forged or sewn piece of that weight takes (EXTRACT_EXTRAS).
made = {r["output"] for r in RECIPES if r["station"] in ("forja", "costura") and r["amount"] == 1}
EXTRACT_ALIASES = {}
for (kind, part, _pt), rows in by_name.items():
    owners = [row for row in rows if row["Id"] in made]
    if not owners:
        continue
    owner = max(owners, key=price)
    for row in rows:
        if row["Id"] not in made:
            share = min(1.0, price(row) / price(owner)) if price(owner) > 0 else 1.0
            EXTRACT_ALIASES[row["Id"]] = (owner["Id"], round(share * 100))

EXTRACT_EXTRAS = []
loose = defaultdict(list)
for (kind, part, _pt), rows in by_name.items():
    if kind == "armadura" and not any(row["Id"] in made for row in rows):
        loose[part].extend(rows)
for part, rows in sorted(loose.items()):
    levels = levels_by_price(rows, top=24, low=2)
    for row in rows:
        sound = row.get("UiSound") or ""
        station = "costura" if TEXTILE_SOUND.search(sound) and not METAL_SOUND.search(sound) else "forja"
        level = levels[row["Id"]]
        bill = metal_bill(part, row, level) if station == "forja" else cloth_bill(part, row, level)
        category = (FORGE_PARTS if station == "forja" else SEW_PARTS).get(part, part)
        EXTRACT_EXTRAS.append((row["Id"], station, category, [(use(item), n) for item, n in bill]))

STATIONS = ["fogo", "defumador", "secador", "forja", "costura", "alquimia"]
RECIPES.sort(key=lambda r: (STATIONS.index(r["station"]), r["category"], r["level"], USED[r["output"]][0]))


def js(value) -> str:
    return json.dumps(value, ensure_ascii=False)


lines = [
    "// Generated by tools/make-craft-recipes.py from the game's tables. Do not edit by hand.",
    "",
    'export type CraftStation = "fogo" | "defumador" | "secador" | "forja" | "costura" | "alquimia";',
    "",
    "export interface CraftRecipe {",
    "    readonly id: string;",
    "    readonly station: CraftStation;",
    "    readonly category: string;",
    "    /** A game item's class GUID, or one of `CUSTOM_ITEMS`. */",
    "    readonly output: string;",
    "    readonly amount: number;",
    "    readonly ingredients: ReadonlyArray<readonly [item: string, amount: number]>;",
    "    /** The level of the trade's skill it asks for. */",
    "    readonly level: number;",
    "    readonly xp: number;",
    "    /** How long the work takes, in seconds (0 for alchemy: the game's own minigame). */",
    "    readonly seconds: number;",
    "    /** The fire's drinks train drinking, not survival. */",
    "    readonly track?: string;",
    "    /** The game's alchemy recipe this one teaches. */",
    "    readonly alchemy?: number;",
    "}",
    "",
    "/** Our own items: id -> [name, description, the game item they look like (GUID), weight, price, and the action they have in the bag (a soup's \"Comer\")]. */",
    "export const CUSTOM_ITEMS: Readonly<Record<string, readonly [name: string, description: string, visual: string, weight: number, price: number, useLabel?: string]>> = {",
]
for key, (name, desc, visual, weight, cost, *action) in CUSTOM.items():
    label = f", {js(action[0])}" if action else ""
    lines.append(f"    {js(key)}: [{js(name)}, {js(desc)}, {js(BY_NAME[visual]['Id'])}, {weight}, {cost}{label}],")
lines.append("};")
lines.append("")
lines.append("/** What eating one of our soups does: [the share of the stomach it fills (the game's own scale: a hundred is full), the points of thirst it quenches]. */")
lines.append("export const SOUP_EFFECTS: Readonly<Record<string, readonly [nutrition: number, thirst: number]>> = {")
for key, (nutrition, thirst) in SOUP_EFFECTS.items():
    lines.append(f"    {js(key)}: [{nutrition}, {thirst}],")
lines.append("};")
lines.append("")
lines.append("/** Every item a recipe names: id -> [name, icon (the game's IconId)]. */")
lines.append("export const CRAFT_ITEMS: Readonly<Record<string, readonly [string, string]>> = {")
for key in sorted(USED):
    name, icon = USED[key]
    lines.append(f"    {js(key)}: [{js(name)}, {js(icon)}],")
lines.append("};")
lines.append("")
lines.append("/** What each item of `CRAFT_ITEMS` is worth, in groschen (the game's price, or the one of ours): the extraction (src/server/extract.ts) gives the dearer ingredient back first when it has a unit to spare. */")
lines.append("export const CRAFT_PRICES: Readonly<Record<string, number>> = {")
for key in sorted(USED):
    worth = CUSTOM[key][4] if key in CUSTOM else price(ITEMS[key])
    lines.append(f"    {js(key)}: {round(worth)},")
lines.append("};")
lines.append("")
lines.append("export const CRAFT_RECIPES: readonly CraftRecipe[] = [")
for r in RECIPES:
    extra = "".join(f", {k}: {js(r[k])}" for k in ("track", "alchemy") if k in r)
    ingredients = ", ".join(f"[{js(i)}, {n}]" for i, n in r["ingredients"])
    lines.append(f"    {{ id: {js(r['id'])}, station: {js(r['station'])}, category: {js(r['category'])}, output: {js(r['output'])}, amount: {r['amount']}, ingredients: [{ingredients}], level: {r['level']}, xp: {r['xp']}, seconds: {r['seconds']}{extra} }},")
lines.append("];")
lines.append("")
lines.append("/** Every other class of a piece a recipe makes (the same hood in another colour, the same helmet in another state) -> [the class the recipe makes, the share of its bill the variant's own price is worth, 0 to 100]: the extraction (src/server/extract.ts) takes them apart as that piece. */")
lines.append("export const EXTRACT_ALIASES: Readonly<Record<string, readonly [owner: string, share: number]>> = {")
for variant, (owner, share) in sorted(EXTRACT_ALIASES.items()):
    lines.append(f"    {js(variant)}: [{js(owner)}, {share}],")
lines.append("};")
lines.append("")
lines.append("/** The armour no recipe makes (gauntlets, padded collars and coifs): class, the trade that takes it apart, the category it is listed under, and what comes back of its bill. */")
lines.append("export const EXTRACT_EXTRAS: ReadonlyArray<readonly [item: string, station: CraftStation, category: string, ingredients: ReadonlyArray<readonly [item: string, amount: number]>]> = [")
for item, station, category, bill in EXTRACT_EXTRAS:
    lines.append(f"    [{js(item)}, {js(station)}, {js(category)}, [{', '.join(f'[{js(i)}, {n}]' for i, n in bill)}]],")
lines.append("];")
lines.append("")
lines.append("/** What the gardens' beds grow (src/server/farm.ts): the seed (ours), what it gives (a game item's GUID), how many, in how many minutes, from")
lines.append(" * which level of survival, the XP of the harvest, and the meshes the bed shows (the plant; ripe, the produce at its foot, \"\" for none). */")
lines.append("export interface FarmCrop {")
lines.append("    readonly id: string;")
lines.append("    readonly name: string;")
lines.append("    readonly seed: string;")
lines.append("    readonly harvest: string;")
lines.append("    readonly least: number;")
lines.append("    readonly most: number;")
lines.append("    readonly minutes: number;")
lines.append("    readonly level: number;")
lines.append("    readonly xp: number;")
lines.append("    readonly category: string;")
lines.append("    readonly plant: string;")
lines.append("    readonly produce: string;")
lines.append("}")
lines.append("")
lines.append("export const FARM_CROPS: readonly FarmCrop[] = [")
for key, name, _seed_name, item, (least, most), minutes, level, xp, category, plant, produce, _price in CROPS:
    lines.append(f"    {{ id: {js(key)}, name: {js(name)}, seed: {js('kcdc-craft:semente-' + key)}, harvest: {js(item if item in CUSTOM else guid(item))}, least: {least}, most: {most}, minutes: {minutes}, level: {level}, xp: {xp}, category: {js(category)}, plant: {js(plant)}, produce: {js(produce)} }},")
lines.append("];")
lines.append("")
lines.append("/** What the Agricultores make of their harvest at a garden (src/server/farm.ts): a piece of work on the gardens' page, done where the player stands, with its XP. */")
lines.append("export interface FarmProcess {")
lines.append("    readonly id: string;")
lines.append("    readonly category: string;")
lines.append("    readonly output: string;")
lines.append("    readonly amount: number;")
lines.append("    readonly ingredients: ReadonlyArray<readonly [item: string, amount: number]>;")
lines.append("    readonly level: number;")
lines.append("    readonly xp: number;")
lines.append("}")
lines.append("")
lines.append("export const FARM_PROCESSES: readonly FarmProcess[] = [")
for pid, category, output, amount, ingredients, level, xp in PROCESSES:
    bill = ", ".join(f"[{js(i)}, {n}]" for i, n in ingredients)
    lines.append(f"    {{ id: {js(pid)}, category: {js(category)}, output: {js(output)}, amount: {amount}, ingredients: [{bill}], level: {level}, xp: {xp} }},")
lines.append("];")
lines.append("")
lines.append("/** The shovels a bed is dug with (the class GUIDs of the game's own). */")
lines.append(f"export const FARM_TOOLS: readonly string[] = [{', '.join(js(guid(tool)) for tool in FARM_TOOLS)}];")
OUT.write_text("\n".join(lines) + "\n", encoding="utf-8")

counts = defaultdict(int)
for r in RECIPES:
    counts[r["station"]] += 1
print(f"{OUT.name}: {len(RECIPES)} recipes ({', '.join(f'{s} {counts[s]}' for s in STATIONS)}), {len(USED)} items, {len(EXTRACT_ALIASES)} other classes taken apart as a recipe's piece, {len(EXTRACT_EXTRAS)} pieces with a bill of their own")
