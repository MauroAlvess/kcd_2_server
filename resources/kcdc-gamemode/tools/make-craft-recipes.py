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


# Names the game's Portuguese table lacks, or leaves as the word of its own tables (2026-10-31: the forge listed "torch_weapon", the fire "breadroll").
PT_FIX = {"torch_weapon": "Tocha", "breadroll": "Pãozinho", "bolt_enh_precise": "Virote de atirador aprimorado"}


def use(item: str) -> str:
    """Notes an item a recipe names (by GUID, or one of our own ids), so the page knows its name and icon."""
    if item in CUSTOM:
        name, _desc, visual, *_rest = CUSTOM[item]
        USED[item] = (name, BY_NAME[visual].get("IconId") or visual)
        return item
    row = ITEMS[item]
    USED[item] = (PT_FIX.get(row["Name"]) or row["pt"] or row["Name"], row.get("IconId") or row["Name"])
    return item


RECIPES = []

# Harder and more rewarding as the level climbs (2026-11-01, user: "nas receitas temos que dificultar um pouco a mais a cada nível e diminuir o XP por receitas fracas e fazer
# escala: quanto maior o nível do item mais XP ele dá"): every ingredient of a recipe asks `BILL_GROWTH` more for each of its levels, rounded half up and never under what
# the bill wrote (a piece of the 20th level asks 40% more of each), and the XP of every recipe is what it was worth (by its bill, its price, the game's own reward) times its
# level's share (`xp_at`): half of it at the first level, the whole at the fifteenth, half as much again at the thirtieth. A cheap piece stays worth less than a dear one of
# its level, the first recipes are worth half of what they were and the top ones more. A recipe far under the worker's own level gives less again, in `craft.ts` (`weakShare`).
# A potion keeps the game's own herbs: the game's table brews it from the game's recipe, which the page must not contradict, and its four qualities are its ladder already.
BILL_GROWTH = 0.02
XP_FIRST, XP_PER_LEVEL = 0.5, 1 / 30


def harder(ingredients, level, station):
    """The bill of a recipe of `level`: each amount grown by the level, rounded half up, never under the written one; a potion's as the game has it."""
    if station == "alquimia":
        return list(ingredients)
    return [(item, max(n, int(n * (1 + BILL_GROWTH * level) + 0.5))) for item, n in ingredients]


def xp_at(xp, level):
    """The XP of one piece of work worth `xp` at `level`: its level's share of it, rounded half up, at least 1."""
    return max(1, int(xp * (XP_FIRST + XP_PER_LEVEL * level) + 0.5))


def recipe(station, category, output, amount, ingredients, level, xp, seconds, recipe_id=None, **extra):
    """`xp` is what the recipe was worth before 2026-11-01; its level's share of it is given now (`xp_at`), and the bill grows with the level (`harder`)."""
    rid = recipe_id or f"{station}:{ITEMS[output]['Name'] if output in ITEMS else output}"
    if any(r["id"] == rid for r in RECIPES):
        return
    RECIPES.append({
        "id": rid,
        "station": station,
        "category": category,
        "output": use(output),
        "amount": amount,
        "ingredients": [[use(item), n] for item, n in harder(ingredients, level, station)],
        "level": int(level),
        "xp": xp_at(xp, int(level)),
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


def piece_seconds(level: int) -> int:
    """How long a finished piece takes, the same ladder at the forge and at the needle (2026-11-04, a player's report through the user: "o artesão faz as peças mais difíceis em 10 s, o ferreiro as mais difíceis levam até 10 min, seria legal padronizar"):
    the forge's own, 12 seconds at the first level to 24 at the last, which is what the needle took 8 to 16 for. Every weapon, armour, garment, jewel and piece of tack goes by it (the game's own
    sword recipes took a flat 14, the crossbows 14 and more, the tack less); the materials (smelting, charcoal), the tools and the kits keep theirs."""
    return 12 + level // 2


G = lambda name: guid(name)  # noqa: E731
SALT, LARD, WATER, EGG, MILK, HONEY, CURD, CHEESE = (G(n) for n in ("loot_salt", "special_lard", "water", "egg", "milk", "honey", "curdCheese", "cheeseQuarter"))
WALNUTS, POPPY, PLUMS, PEAR, APPLE, CABBAGE, GARLIC = (G(n) for n in ("walnuts", "herb_dried_poppy", "plums", "pear", "apple", "cabbage", "garlic"))
PORK, BEEF, PORK_LOIN, PEPPER, CHARCOAL = (G(n) for n in ("pigMeat", "beef", "pigTenderloin", "driedPepperSpice", "special_charcoal"))
FLOUR, MALT, HOPS, THREAD, BOW_WOOD = "kcdc-craft:farinha", "kcdc-craft:malte", "kcdc-craft:lupulo", "kcdc-craft:linha", "kcdc-craft:madeira"
WHEAT, BARLEY, GRAPES, LOG = "kcdc-craft:trigo", "kcdc-craft:cevada", "kcdc-craft:uva", "kcdc-craft:lenha"
SCRAP, IRON, STEEL, STEEL_F, STEEL_T, COPPER, HARDWARE = (G(n) for n in ("bsmt_ironBad", "bsmt_ironGood", "bsmt_steelBad", "bsmt_steelNormal", "bsmt_steelGood", "bsmt_copper", "bsmt_hardware"))
COW, PIG_SKIN, DEER_SKIN, LINEN, SHEEP = (G(n) for n in ("special_cowSkin", "special_pigSkin", "special_deerSkin", "loot_cloth", "skin_sheep"))

QUEST = re.compile(r"^(poi_|svatba_|hladAZmar_|sedmStatecnych|klasterniTajemstvi|hostinaProChude|dlc3_wineSecret|prepadeni|ztratyANalezy|hledaniLichtenstejna|kettleFood_|spizovaciOddil_|zbranePanaSemina_|poi$)", re.I)


PLACEHOLDER_ICON = re.compile(r"^(trafficCone|default|placeholder|missing)", re.I)


def real_icon(row) -> bool:
    """Whether the piece has an icon of its own. The game's test pieces and one-off quest pieces wear a traffic cone (2026-11-01, user: "o almofre do ferreiro tá bugando: se faz
    e vem outros": the forge's "Almofre de malha" was CoifMailSuk_m01, a cone, chosen as the dearest piece of that name over the real coif, CoifMail01)."""
    return not PLACEHOLDER_ICON.search(row.get("IconId") or "")


def usable(row) -> bool:
    return row.get("IsQuestItem") != "true" and not QUEST.search(row["Name"]) and bool(row["pt"]) and row["pt"] != "Uma bolsa suspeita." and real_icon(row)


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
    ("Cervejas e hidromel", "mead", 2, [(HONEY, 2), (WATER, 2)], 4, 10, "drinking"),
    ("Cervejas e hidromel", "beer", 3, [(MALT, 2), (HOPS, 1), (WATER, 2)], 5, 10, "drinking"),
    ("Cervejas e hidromel", "beerTroskovice", 3, [(MALT, 2), (HOPS, 2), (WATER, 2)], 10, 10, "drinking"),
    ("Vinhos e destilados", "hooch", 1, [(PLUMS, 3), (WATER, 1)], 12, 10, "drinking"),
    ("Cervejas e hidromel", "dlc3_beer", 3, [(MALT, 3), (HOPS, 2), (HONEY, 1), (WATER, 2)], 16, 12, "drinking"),
    ("Vinhos e destilados", "spirits", 1, [(PLUMS, 2), (PEAR, 2), (HONEY, 1)], 18, 12, "drinking"),
    # More of the game's own food and drink (2026-10-31, user: "vamos adicionar novas comidas, se existir no jogo, para o taberneiro fazer"): what the tables have as an item of
    # their own and no recipe made: Henry's three beers (the forge's DLC), the four beers of the weddings, the cheap, the good and Loretz's wines and the cellar wine, the Cuman
    # kumis, the Roma flatbread, the roast duck and the herring. The weddings' beers are the dearest of the kitchen's beers, by the game's price (30 to 80); the wines take the
    # Agricultores' grapes, as the wine that was there.
    ("Cervejas e hidromel", "henrysBitter", 3, [(MALT, 2), (HOPS, 2), (WATER, 2)], 6, 10, "drinking"),
    ("Cervejas e hidromel", "henrysLarger", 3, [(MALT, 2), (HOPS, 1), (WATER, 2)], 7, 10, "drinking"),
    ("Cervejas e hidromel", "henrysDark", 3, [(MALT, 3), (HOPS, 1), (WATER, 2)], 8, 10, "drinking"),
    ("Cervejas e hidromel", "wedding_beer1", 3, [(MALT, 3), (HOPS, 2), (HONEY, 1), (WATER, 2)], 13, 12, "drinking"),
    ("Cervejas e hidromel", "wedding_beer3", 3, [(MALT, 3), (HOPS, 2), (HONEY, 1), (WATER, 2)], 14, 12, "drinking"),
    ("Cervejas e hidromel", "wedding_beer2", 3, [(MALT, 4), (HOPS, 2), (HONEY, 1), (WATER, 2)], 17, 13, "drinking"),
    ("Cervejas e hidromel", "wedding_beer4", 3, [(MALT, 4), (HOPS, 3), (HONEY, 2), (WATER, 2)], 19, 14, "drinking"),
    ("Vinhos e destilados", "wineCheap", 2, [(GRAPES, 3), (WATER, 1)], 6, 12, "drinking"),
    ("Vinhos e destilados", "dlc3_wineZdik", 2, [(GRAPES, 4), (HONEY, 1), (WATER, 1)], 9, 14, "drinking"),
    ("Vinhos e destilados", "wineGood", 2, [(GRAPES, 5), (HONEY, 1), (WATER, 1)], 12, 14, "drinking"),
    ("Vinhos e destilados", "wineLorec", 2, [(GRAPES, 6), (HONEY, 1), (WATER, 1)], 14, 16, "drinking"),
    ("Bebidas", "hadkaKonaru_kumis", 2, [(MILK, 3), (HONEY, 1)], 9, 12, "drinking"),
    ("Pães e massas", "griddlecakeRomani", 2, [(FLOUR, 1), (WATER, 1), (SALT, 1)], 7, 8, "survival"),
    ("Pratos", "herring", 2, [(G("trout"), 1), (SALT, 1)], 5, 7, "survival"),
    ("Pratos", "duck", 1, [(G("chicken"), 2), (GARLIC, 1), (SALT, 1)], 15, 12, "survival"),
    # What the vendors sold the kitchen and the apothecary and nobody made (2026-10-27, SINERGIA.md): water boiled over the Coletores' logs, wine of the
    # Agricultores' grapes, and lard rendered from pork.
    ("Bebidas", "water", 4, [(LOG, 1)], 0, 8, "survival"),
    ("Vinhos e destilados", "wine", 2, [(GRAPES, 4), (WATER, 1)], 10, 14, "drinking"),
    ("Pratos", "special_lard", 1, [(PORK, 2)], 2, 7, "survival"),
]
for category, output, amount, ingredients, level, seconds, track in KITCHEN:
    if output not in BY_NAME or BY_NAME[output].get("IsQuestItem") == "true":
        print(f"cozinha: o jogo não tem {output}; ficou de fora")
        continue
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
    recipe("forja", category, products[0][0], 1, ingredients + [(CHARCOAL, 1)], level, 12 + level * 2, piece_seconds(level), recipe_id=f"forja:{meta['Id']}")

# The other metal weapons (maces, hammers, daggers, polearms, shields, the swords and axes the smithing table lacks), and the
# metal armour, from the game's catalog of pieces: one recipe for each piece by its name (the best-kept variant of it).
pieces = [row for row in items_doc.load() if real_icon(row) and not QUEST.search(row["Name"])]
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
METAL_SOUND = re.compile(r"armor_(mail|chainmail|plate|helmet|metal|gauntlets)|weapon_", re.I)
GAUNTLET_SOUND = re.compile(r"armor_gauntlets", re.I)
CHAIN_SOUND = re.compile(r"armor_chainmail", re.I)
TEXTILE_SOUND = re.compile(r"clothes|armor_(gambeson|leather|cloth)", re.I)
FORGE_PARTS = {"Espadas": "Espadas curtas", "Adagas": "Adagas", "Maças e martelos": "Maças e martelos", "Machados": "Machados", "Armas de haste": "Lanças e machados", "Escudos": "Escudos",
               "Capacetes": "Capacetes", "Almofres": "Cotas e almofres", "Golas": "Cotas e almofres", "Tronco": "Peitorais e cotas", "Braços e mãos": "Braços e manoplas", "Pernas": "Pernas",
               "Manoplas": "Braços e manoplas"}
SEW_PARTS = {"Cabeça": "Chapéus e capuzes", "Tronco e vestidos": "Túnicas e vestidos", "Calças": "Calças", "Calçados": "Calçados", "Mãos": "Luvas", "Tronco": "Gibões e couraças de couro",
             "Almofres": "Gibões e couraças de couro", "Braços e mãos": "Luvas", "Pernas": "Calças", "Golas": "Gibões e couraças de couro"}

forge_rows = []
sew_rows = []
for (kind, part, _pt), row in best.items():
    sound = row.get("UiSound") or ""
    if kind in ("arma", "escudo") and part in FORGE_PARTS:
        if row["Id"] not in forged and part not in ("Arcos", "Bestas", "Armas de fogo", "Tochas"):
            forge_rows.append((part, row))
    elif kind == "armadura" and part in FORGE_PARTS and METAL_SOUND.search(sound):
        # The gauntlets (2026-10-31) are a part of their own, ranked among themselves, so that no other piece changes its level.
        forge_rows.append(("Manoplas" if GAUNTLET_SOUND.search(sound) else part, row))
    elif kind in ("roupa", "armadura") and part in SEW_PARTS and (kind == "roupa" or TEXTILE_SOUND.search(sound)):
        sew_rows.append((part, row))

forge_levels = {}
chain_rows = [(p, r) for p, r in forge_rows if CHAIN_SOUND.search(r.get("UiSound") or "")]
plain_rows = [(p, r) for p, r in forge_rows if not CHAIN_SOUND.search(r.get("UiSound") or "")]
for part in {p for p, _ in plain_rows}:
    forge_levels.update(levels_by_price([r for p, r in plain_rows if p == part], top=24, low=8 if part == "Manoplas" else 2))

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
    if part in ("Almofres", "Golas", "Tronco", "Braços e mãos", "Manoplas", "Pernas", "Capacetes"):
        bill.append((COW if level < 12 else DEER_SKIN, 1))
    if level >= 16:
        bill.append((COPPER, 1))
    return bill


for part, row in forge_rows:
    level = forge_levels[row["Id"]]
    recipe("forja", FORGE_PARTS[part], row["Id"], 1, metal_bill(part, row, level), level, xp_for(level, 14), piece_seconds(level))

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
    recipe("forja", "Arcos", row["Id"], 1, bill, level, xp_for(level, 14), piece_seconds(level))

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
        # A training piece the metal pass made as well is the wood's alone (2026-11-01: the training polearm had two recipes at the forge).
        RECIPES[:] = [r for r in RECIPES if not (r["station"] == "forja" and r["output"] == G(name))]
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
    recipe("forja", category, row["Id"], 1, tack_bill(kind, row, level), level, xp_for(level, 14), piece_seconds(level))

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

# The dyes (2026-10-31, user: "na fabricação do artesão, ao selecionar um item para fabricar, abre um quadradinho para escolher a cor da roupa e o tipo, se a roupa tem variável de
# cor"). The game names a garment once for all its dyes and numbers them (`Waffenrock02_m01_D`, `_m02_D` ...); the page has ONE recipe for the garment and a little square to pick
# the dye, each shown by the game's own icon of it and a word for its colour (`make-variant-colours.py` reads the word off the icon). The dyes are those of the dearest numbered
# model of the name (the house's tokens, `_mBergov`, and the tournament's are not dyes); two dyes with the very same icon are one; the dyes the game gives a wealth level of
# 10 or more (the dear ones: scarlet, the best black) are a noble's, the others anybody's: the first dye of a recipe is the least rich, and a recipe is a noble's only when all are.
NOBLE_WEALTH, NOBLE_LEVEL = 10, 22
# What makes a piece a noble's (2026-10-31): the game's `WealthLevel` says only how rich a dye or a model is meant to look, and 423 of the 1,300 garments have 10 or more (a beggar's
# tunic among them: price 16). A noble's piece is one that is both of that wealth and among the dearest fifth of its kind (the tiers "excelente" and "nobre" of ITENS.md).
KIND_PRICES = defaultdict(list)
for _row in pieces:
    _found = items_doc.classify(_row)
    if _found is not None and not _row["_unique"]:
        KIND_PRICES[_found[0]].append(float(_row.get("Price") or 0))
NOBLE_PRICE = {kind: items_doc.cuts(prices)[2] for kind, prices in KIND_PRICES.items()}


def is_rich(row) -> bool:
    """Whether a piece is a noble's by what the game says of it: the wealth of its look and a price among the dearest of its kind."""
    found = items_doc.classify(row)
    return int(row.get("WealthLevel") or 0) >= NOBLE_WEALTH and found is not None and float(row.get("Price") or 0) >= NOBLE_PRICE.get(found[0], 0)


SET_PLACES = json.loads((HERE.parent / "data" / "set-places.json").read_text(encoding="utf-8"))
ARMOR_SETS = json.loads((HERE.parent / "data" / "armor-sets.json").read_text(encoding="utf-8"))
SET_CODE_PLACES = defaultdict(set)
for _set in ARMOR_SETS.values():
    for _piece in _set["pieces"]:
        SET_CODE_PLACES[_piece["code"]].add(_set["place"])


def towns_of(row) -> frozenset:
    """The towns whose citizens make a piece: the towns of the armour presets (data/armor-sets.json) it is in, or a word of its own name that says whose it is (a coat "mKuttenberg")."""
    places = SET_CODE_PLACES.get(row["Name"], set())
    towns = set()
    if places and all(place in SET_PLACES["places"] for place in places):
        towns = {SET_PLACES["places"][place] for place in places}
    for marker, town in SET_PLACES["markers"].items():
        if marker in row["Name"].lower():
            towns = {town}
    return frozenset(towns)


DYED = re.compile(r"^(.*?)_m(\d+)(?:_|$)")
VARIANT_COLOURS = json.loads((HERE / "variant-colours.json").read_text(encoding="utf-8")) if (HERE / "variant-colours.json").exists() else {}


def model_of(row) -> str:
    return DYED.match(row["Name"]).group(1)


def dye_of(row) -> int:
    return int(DYED.match(row["Name"]).group(2))


def dyes_of(rows):
    """([the dyes of a garment, the least rich first], [the dyes that are a town's own]): the numbered rows of the dearest numbered model of `rows`, the very same icon once.
    The dyes of the biggest company of towns (the free ones, when there are) are the picker's; the rest are pieces of a town's set, each a recipe of its own for that town's citizens."""
    numbered = [row for row in rows if DYED.match(row["Name"]) and row["Id"].lower() in ITEMS and row["Id"].lower() not in HOUSE_IDS]
    if not numbered:
        return [], []
    model = model_of(max(numbered, key=price))
    mine = sorted((row for row in numbered if model_of(row) == model), key=lambda row: (is_rich(row), dye_of(row), row["Name"]))
    seen, out = set(), []
    for row in mine:
        icon = row.get("IconId") or row["Name"]
        if icon not in seen:
            seen.add(icon)
            out.append(row)
    by_towns = defaultdict(list)
    for row in out:
        by_towns[towns_of(row)].append(row)
    home = frozenset() if frozenset() in by_towns else max(by_towns, key=lambda towns: len(by_towns[towns]))
    return by_towns[home], [row for towns, list_ in by_towns.items() if towns != home for row in list_]


def variants_of(dyes):
    """[[class, colour word, icon], ...] of the dyes: a word that two of them share is numbered from one."""
    words = [VARIANT_COLOURS.get(row["Name"]) or f"cor {dye_of(row)}" for row in dyes]
    sharing = {word: words.count(word) for word in words}
    counted = defaultdict(int)
    out = []
    for row, word in zip(dyes, words):
        counted[word] += 1
        out.append([row["Id"].lower(), word if sharing[word] == 1 else f"{word} {counted[word]}", row.get("IconId") or row["Name"]])
    return out


def town_dye_recipes(station, others, category_of, bill_of, level, xp, seconds):
    """The dyes of a town's set (the surcoat of Kuttenberg's, Malešov's) are that town's alone: a recipe of their own each, the colour after the name."""
    words = [VARIANT_COLOURS.get(other["Name"]) or f"cor {dye_of(other)}" for other in others]
    counted = defaultdict(int)
    for other, word in zip(others, words):
        counted[word] += 1
        recipe(station, category_of(other), other["Id"], 1, bill_of(other), level, xp, seconds)
        label = word if words.count(word) == 1 else f"{word} {counted[word]}"
        USED[other["Id"].lower()] = (f"{USED[other['Id'].lower()][0]} ({label})", USED[other["Id"].lower()][1])


# The colours of the forge's armour (2026-11-03, a smith's report through the user: "tem item com mesmo nome e ícone, só cor diferente; seria legal fazer o esquema de cores igual do
# artesão"). The game has one piece in several colours of its cloth and its trim under one name (`Cuirass01_m01_C2`, `_m02_C2` ...), and the forge made only the dearest of them. A piece is
# now ONE recipe with the little square, as at the needle: the level, the bill and the time stay what they were. A colour is a class of the same model and grade (`BascinetVisor04_m02_A5`,
# and not its `_A5_noVisor`) with the same protection, wear, requirements and weight (`PIECE_NUMBERS`): the other numbers the game moves with the colour are how much it shows and how noble
# it looks. The darkened pieces, which weigh less, have a name of their own in the game ("Couraça lisa: escurecida") and stay recipes of their own. A piece that was forged and is not a
# numbered one (`ArmPlate04_mAlberich`) stays as the last colour of its square, so that nothing that could be forged is lost.
PIECE_NUMBERS = ("DefenseStab", "DefenseSlash", "DefenseSmash", "MaxStatus", "StrReq", "AgiReq", "Weight")


def same_piece(one, other) -> bool:
    return all(one.get(key) == other.get(key) for key in PIECE_NUMBERS)


def grade_of(row) -> str:
    """What comes after the dye's number in the name of a class."""
    return row["Name"][DYED.match(row["Name"]).end():]


for part, row in forge_rows:
    found = items_doc.classify(row)
    if found[0] != "armadura":
        continue
    numbered = [other for other in by_name[(found[0], found[1], row["pt"])] if DYED.match(other["Name"])]
    if not numbered:
        continue
    top = max(numbered, key=price)
    dyes, town_dyes = dyes_of([other for other in numbered if model_of(other) == model_of(top) and grade_of(other) == grade_of(top) and same_piece(other, top)])
    if len(dyes) + len(town_dyes) < 2:
        continue
    level = forge_levels[row["Id"]]
    made = next(r for r in RECIPES if r["id"] == f"forja:{row['Name']}")
    USED.pop(made["output"], None)
    made["id"] = f"forja:{dyes[0]['Name']}"
    made["output"] = use(dyes[0]["Id"])
    colours = variants_of(dyes)
    if not DYED.match(row["Name"]) and same_piece(row, top):
        colours.append([row["Id"], VARIANT_COLOURS.get(row["Name"]) or "outra cor", row.get("IconId") or row["Name"]])
    if len(colours) > 1:
        made["variants"] = colours
    town_dye_recipes("forja", town_dyes, lambda _other, part=part: FORGE_PARTS[part], lambda other, part=part, level=level: metal_bill(part, other, level), level, xp_for(level, 14), piece_seconds(level))


def stem_of(row) -> str:
    found = re.match(r"(?:F_)?([A-Za-z]+)", row.get("Clothing") or row["Name"])
    return found.group(1) if found else ""


def sew_category(part: str, row) -> str:
    """Where a garment is listed (2026-10-31): by what it is, not by the part of the body alone."""
    stem, pt = stem_of(row), row["pt"]
    if re.search(r"cuman", pt, re.I) and part in ("Cabeça", "Calçados", "Tronco e vestidos"):
        return "Roupas cumanas"
    if part == "Cabeça":
        if stem in ("Bonnet", "Veil", "VeilMagdalena", "HairDecor", "Wreath") or re.search(r"Lenço|Véu|Touca|Faixa", pt):
            return "Toucas, véus e adornos"
        if stem.startswith("Hood") or stem == "PlagueSuit" or re.search(r"Capuz|Chaperon", pt):
            return "Capuzes e chaperons"
        return "Chapéus e gorros"
    if part == "Tronco e vestidos":
        if stem.startswith("SimpleDress") or stem == "Cotehardie":
            return "Vestidos"
        if stem.startswith("Coat") or stem in ("Caftan", "Habit", "Surcote", "WaffenrockScaring"):
            return "Casacos e cafetãs"
        return "Túnicas e camisas"
    if part in ("Calças", "Pernas") and stem != "LegsBrigandine":
        return "Calças e meias" if part == "Calças" else "Calças acolchoadas"
    if stem == "LegsBrigandine":
        return "Perneiras de brigandina"
    if part == "Calçados":
        return "Calçados"
    if part in ("Mãos", "Braços e mãos") and not stem.startswith("Brigandine"):
        return "Luvas"
    if stem.startswith("Brigandine") and part == "Braços e mãos":
        return "Mangas de brigandina"
    if part == "Tronco":
        return "Brigandinas" if stem == "Brigandine" else "Gibões e jaquetões"
    return "Almofres e coifas"


for part, row in sew_rows:
    kind = items_doc.classify(row)[0]
    dyes, town_dyes = dyes_of(by_name[(kind, part, row["pt"])])
    if row["Id"].lower() in HOUSE_IDS and not dyes and not town_dyes:
        continue
    base = dyes[0] if dyes else town_dyes[0] if town_dyes else row
    level = sew_levels[row["Id"]]
    extra = {"variants": variants_of(dyes)} if len(dyes) > 1 else {}
    recipe("costura", sew_category(part, base), base["Id"], 1, cloth_bill(part, base, level), level, xp_for(level, 8), piece_seconds(level), **extra)
    town_dye_recipes("costura", [d for d in town_dyes if d is not base], lambda other, part=part: sew_category(part, other), lambda other, part=part, level=level: cloth_bill(part, other, level), level, xp_for(level, 8), piece_seconds(level))

# Crossbows and their bolts (2026-10-31, user: "mais armas para o artesão"): the nine plain crossbows of the game (the light, the medium and the heavy, the cheap, the plain and the
# fancy), of the same seasoned wood as the bows, thread for the cord and the smith's fittings; the bolts as the arrows, five to the batch, a shaft, a feather and a head.
# The crossbows are the smith's since 2026-11-01 (user: "besta deve ser receita só do ferreiro e não do artesão"), at the forge beside the bows, and their bolts with them, beside the
# arrows (user, the same evening: "faltou no ferreiro o craft das setas, os dardos da besta").
CROSSBOWS = [row for row in best.values() if row["_tag"] == "MissileWeapon" and re.match(r"^crossbow(Light|Medium|Heavy)(Cheap|Normal|Fancy)01$", row["Name"])]
crossbow_levels = levels_by_price(CROSSBOWS, top=22, low=6)
for row in CROSSBOWS:
    level = crossbow_levels[row["Id"]]
    weight = float(row.get("Weight") or 3)
    bill = [(BOW_WOOD, max(3, min(8, round(weight * 1.2)))), (THREAD, 3), (HARDWARE, 2 + level // 6), (IRON, 1 + level // 8)]
    if level >= 16:
        bill.append((STEEL, 1))
    recipe("forja", "Bestas", row["Id"], 1, bill, level, xp_for(level, 12), piece_seconds(level))
BOLTS = ["bolt_crude", "bolt_normal", "bolt_cutting", "bolt_hunting", "bolt_precise", "bolt_piercing", "bolt_fine", "bolt_enh_cutting", "bolt_enh_hunting", "bolt_enh_piercing", "bolt_enh_precise"]
bolt_rows = [ITEMS[G(name)] for name in BOLTS if name in BY_NAME]
bolt_levels = levels_by_price(bolt_rows, top=20, low=3)
for row in bolt_rows:
    level = bolt_levels[row["Id"]]
    head = None if row["Name"] == "bolt_crude" else [SCRAP, IRON, STEEL, STEEL_F][0 if level < 8 else 1 if level < 13 else 2 if level < 18 else 3]
    recipe("forja", "Virotes", row["Id"], 5, [(BOW_WOOD, 1), (FEATHER, 1)] + ([(head, 1)] if head else []), level, xp_for(level, 8), 8 + level // 3)

# The tailor's and the cobbler's repair kits (2026-10-21: "vamos adicionar no artesão o kit de reparos de botas e roupas, se existir"): the game
# has both, for clothes and for shoes and boots, as the smith has the armourer's and the weaponsmith's.
SEW_REPAIR = [
    ("repairKit_tailorsSmall", [(LINEN, 1), (THREAD, 2)], 2),
    ("repairKit_cobblersSmall", [(COW, 1), (THREAD, 1)], 3),
    # The armourer's kit (2026-11-04, a player's report through the user: the artisan makes brigandines and the pieces of metal and leather the smith makes, and could make no kit to mend them): the
    # same piece the forge makes, at the same level, of the leather and the thread of the needle and the smith's fittings.
    ("repairKit_armourSmall", [(COW, 1), (THREAD, 2), (HARDWARE, 1)], 5),
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
        recipe("costura", category, G(output), 1, ingredients, level, xp_for(level, 8), piece_seconds(level))
    else:
        print(f"joias: o jogo não tem {output}; ficou de fora")

# The house coats themselves: a category for each house, a recipe for each coat and tunic it has. They are the cloth's bill (the linen, or the wool of the dearer) with
# two more spools of thread for the embroidery of the arms, from the sixth level to the eighteenth by the game's price, and slower to sew than a plain tunic.
house_levels = levels_by_price([row for _, row in HOUSE_PIECES], top=18, low=6)
for house, row in HOUSE_PIECES:
    gid = row["Id"].lower()
    level = house_levels[row["Id"]]
    bill = [(item, n + 2 if item == THREAD else n) for item, n in cloth_bill("Tronco e vestidos", row, level)]
    recipe("costura", f"Brasão: {house}", gid, 1, bill, level, xp_for(level, 8), piece_seconds(level))
    name, icon = USED[gid]
    # Four houses wear a "Sobretudo de brasão": the list tells them apart by the house, unless the game's own name says it already.
    if house.lower() not in name.lower():
        USED[gid] = (f"{name} ({house})", icon)

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
        recipe("costura", category, G(output), 1, ingredients, level, xp_for(level, 8), piece_seconds(level))
    else:
        print(f"cintos: o jogo não tem {output}; ficou de fora")

# ---------------------------------------------------------------------------------------------------------------------
# Alchemy: the game's own recipes, brewed in its own minigame; the page only chooses which one the player is taught.

ALCH_TEXT = TABLES.read("Libs/Tables/minigame/AlchemyRecipe.xml").decode("utf-8", "replace")
BASES = {"Water": G("water"), "Wine": G("wine")}

# The game brews every potion in four qualities, each its own item (Fraca, the plain one, Forte, "do Henry": the bad brew, the fair, the good and the best of the minigame, with prices
# that climb 350, 450, 550, 700). Until 2026-11-01 the page knew only the first, the weak one. User, 2026-11-01: "vamos add as poções melhores nas receitas por nível de alquimista":
# every quality now has a recipe of its own, the same bill (as in the game, where only the hands change), each opening further up the alchemist's ladder. The weak one keeps the level
# and the id it always had; the others are spread from there to the top of the skill (30) so the best of every potion opens at the top, the dearer a potion the later its tiers:
# a recipe at 0 has them at 10, 20 and 30; one at 19 at 23, 26 and 30. The XP grows 30% a tier. A potion whose four qualities are one and the same item (the hooch, the water of
# Lethe, the fever tonic, the lead ball, the shot, the soap) has just the one recipe.
ALCHEMY_TOP = 30
TIER_XP_GROWTH = 0.3


def tier_level(base: int, tier: int, tiers: int) -> int:
    """The level at which the `tier`-th quality (0 is the weak one) of a potion opens, `tiers` being how many distinct ones it has."""
    if tier == 0 or tiers < 2:
        return base
    return min(ALCHEMY_TOP, base + round(tier * (ALCHEMY_TOP - base) / (tiers - 1)))


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
    # The qualities in order, each an item the game has and the page can show; one repeated from a lower quality is not another potion.
    tiers = []
    for quality, item in sorted((int(q), i.lower()) for q, i in products):
        if item in ITEMS and usable(ITEMS[item]) and item not in [seen for _, seen in tiers]:
            tiers.append((quality, item))
    alch.append((meta, product, ingredients, steps, tiers))
alch.sort(key=lambda entry: (entry[3], price(ITEMS[entry[1]])))
for index, (meta, product, ingredients, steps, tiers) in enumerate(alch):
    level = round(index / max(1, len(alch) - 1) * 20)
    base = meta.get("BaseMaterial", "Water")
    bill = ingredients + ([(BASES[base], 1)] if base in BASES else [])
    reward = int(meta.get("BaseQualityRewardXP") or 10)
    for tier, (quality, item) in enumerate(tiers):
        kind = ITEMS[item]["_tag"]
        category = "Venenos" if kind == "Poison" else "Óleos e pomadas" if kind == "Ointment" else "Poções"
        rid = f"alquimia:{meta['RecipeId']}" if tier == 0 else f"alquimia:{meta['RecipeId']}:{quality}"
        recipe("alquimia", category, item, 1, bill, tier_level(level, tier, len(tiers)), round(reward * (1 + TIER_XP_GROWTH * tier)), 0, recipe_id=rid, alchemy=int(meta["RecipeId"]))

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
    # More to plant (2026-11-02, user: "vamos adicionar mais sementes e frutos para plantação"): what a Bohemian garden of 1403 grew and the game has no item of, so these are items of our own
    # (`PRODUCE`), as the wheat and the grapes are; the walnut and the mustard (the game's `estragonSpice`, "uma especiaria rara das terras do sul") are the game's. Nothing of the New World (no potato, tomato, maize or pumpkin). The berries and the
    # nuts are among the fruit by level, the roots and leaves among the vegetables, the rye and the oats among the grain. The farmer's vendor sells the plain seeds and the berries'.
    ("rabanete", "Rabanete", "Sementes de rabanete", "kcdc-craft:rabanete", (4, 6), 25, 1, 6, "Legumes", PLANT + "plantago_a.cgf", VEG + "turnip_black.cgf", 2),
    ("alface", "Alface", "Sementes de alface", "kcdc-craft:alface", (3, 5), 25, 2, 6, "Legumes", PLANT + "atriplex_hortensis.cgf", "", 2),
    ("centeio", "Centeio", "Sementes de centeio", "kcdc-craft:centeio", (4, 6), 45, 2, 6, "Grãos", PLANT + "rumex_acetosa.cgf", "", 3),
    ("morango", "Morango", "Sementes de morango", "kcdc-craft:morango", (4, 6), 35, 3, 7, "Frutas", PLANT + "taraxacum_officinale.cgf", "", 4),
    ("espinafre", "Espinafre", "Sementes de espinafre", "kcdc-craft:espinafre", (3, 5), 30, 4, 7, "Legumes", PLANT + "atriplex_hortensis.cgf", "", 3),
    ("aveia", "Aveia", "Sementes de aveia", "kcdc-craft:aveia", (4, 6), 45, 4, 7, "Grãos", PLANT + "atriplex_hortensis.cgf", "", 3),
    ("fava", "Fava", "Sementes de fava", "kcdc-craft:fava", (4, 6), 40, 5, 8, "Legumes", PLANT + "rumex_acetosa.cgf", "", 3),
    ("amora", "Amora", "Mudas de amoreira", "kcdc-craft:amora", (4, 6), 50, 6, 9, "Frutas", BUSH + "blackberry_bush_a.cgf", "", 5),
    ("aipo", "Aipo", "Sementes de aipo", "kcdc-craft:aipo", (3, 4), 40, 6, 8, "Legumes", PLANT + "symphytum_officinale.cgf", "", 3),
    ("lentilha", "Lentilha", "Sementes de lentilha", "kcdc-craft:lentilha", (4, 6), 45, 7, 9, "Legumes", PLANT + "plantago_a.cgf", "", 3),
    ("cereja", "Cereja", "Mudas de cerejeira", "kcdc-craft:cereja", (3, 5), 60, 8, 10, "Frutas", SAPLING + "fraxinus_saplings_a.cgf", "", 8),
    ("endro", "Endro", "Sementes de endro", "kcdc-craft:endro", (3, 5), 40, 8, 9, "Ervas", PLANT + "mentha.cgf", "", 3),
    ("framboesa", "Framboesa", "Mudas de framboeseira", "kcdc-craft:framboesa", (3, 5), 55, 9, 10, "Frutas", BUSH + "blackberry_bush_a.cgf", "", 6),
    ("mirtilo", "Mirtilo", "Mudas de mirtilo", "kcdc-craft:mirtilo", (3, 5), 55, 10, 10, "Frutas", BUSH + "blueberry_bush_a.cgf", "", 6),
    ("groselha", "Groselha", "Mudas de groselheira", "kcdc-craft:groselha", (4, 6), 55, 11, 11, "Frutas", BUSH + "blueberry_bush_a.cgf", "", 6),
    ("marmelo", "Marmelo", "Mudas de marmeleiro", "kcdc-craft:marmelo", (2, 4), 70, 12, 12, "Frutas", SAPLING + "quercus_saplings_a.cgf", "", 8),
    ("avela", "Avelã", "Mudas de aveleira", "kcdc-craft:avela", (3, 5), 75, 13, 12, "Frutas", SAPLING + "fagus_saplings_a.cgf", "", 9),
    ("noz", "Noz", "Mudas de nogueira", "walnuts", (3, 5), 85, 16, 13, "Frutas", SAPLING + "quercus_saplings_a.cgf", "", 11),
    ("mostarda", "Mostarda", "Sementes de mostarda", "estragonSpice", (2, 3), 70, 18, 13, "Especiarias", PLANT + "calendula_officinalis.cgf", "", 20),
]

# The produce of our own that those plants give (2026-11-02): id, name, what it is, weight, price, the action in the bag ("Comer", or None for what is cooked, ground or sold), and for what is eaten
# the share of the stomach it fills (the game's scale: bread 19, an apple about 5) and the points of thirst it quenches. Eaten as the soups are (`src/server/soups.ts`). The look of the item
# is a sack for what is eaten and ground, and the incense's resin for the herb: the only looks the server takes for an item of ours (a food is refused).
PRODUCE = {
    "morango": ("Morangos", "Morangos silvestres colhidos da horta, doces e frescos.", 0.1, 12, "Comer", 0.05, 6),
    "amora": ("Amoras", "Amoras escuras e doces, colhidas da sebe.", 0.1, 10, "Comer", 0.05, 6),
    "cereja": ("Cerejas", "Cerejas vermelhas e firmes, colhidas da cerejeira.", 0.1, 18, "Comer", 0.06, 5),
    "framboesa": ("Framboesas", "Framboesas macias e perfumadas, que não aguentam muito tempo.", 0.1, 14, "Comer", 0.05, 6),
    "mirtilo": ("Mirtilos", "Mirtilos azuis da mata, colhidos do arbusto.", 0.1, 14, "Comer", 0.05, 6),
    "groselha": ("Groselhas", "Groselhas ácidas em cachos, boas para a sede.", 0.1, 12, "Comer", 0.04, 9),
    "marmelo": ("Marmelos", "Marmelos amarelos e duros, que perfumam a casa.", 0.3, 20, "Comer", 0.06, 3),
    "avela": ("Avelãs", "Avelãs secas na casca, que guardam o inverno todo.", 0.2, 16, "Comer", 0.07, 0),
    "rabanete": ("Rabanetes", "Rabanetes vermelhos e picantes, de colheita rápida.", 0.1, 6, "Comer", 0.03, 3),
    "alface": ("Alface", "Folhas tenras de alface, colhidas com o orvalho.", 0.1, 6, "Comer", 0.03, 5),
    "espinafre": ("Espinafre", "Folhas de espinafre da horta, verdes e carnudas.", 0.1, 8, "Comer", 0.03, 3),
    "aipo": ("Aipo", "Talos de aipo, de cheiro forte, para caldos e para comer cru.", 0.2, 8, "Comer", 0.03, 3),
    "fava": ("Favas", "Favas secas, o feijão de sempre da Boêmia.", 0.4, 10, None, 0, 0),
    "lentilha": ("Lentilhas", "Lentilhas secas, que viram sopa e ensopado.", 0.4, 10, None, 0, 0),
    "centeio": ("Centeio", "Grãos de centeio, o pão escuro do povo da Boêmia. Moídos, viram farinha.", 0.5, 15, None, 0, 0),
    "aveia": ("Aveia", "Grãos de aveia, o mingau do povo da Boêmia.", 0.5, 14, None, 0, 0),
    "endro": ("Endro", "Ramos de endro, ervas de cheiro para conservas e peixe.", 0.1, 12, None, 0, 0),
}
PRODUCE_EFFECTS = {}
for _key, (_name, _what, _weight, _price, _verb, _nutrition, _thirst) in PRODUCE.items():
    _id = f"kcdc-craft:{_key}"
    if _verb:
        _what = f"{_what} Sacia {round(_nutrition * 100)}% da fome{' e um pouco da sede' if _thirst > 0 else ''}."
        PRODUCE_EFFECTS[_id] = (_nutrition, _thirst)
    CUSTOM[_id] = (_name, _what, "special_olibanum" if _key == "endro" else "loot_salt", _weight, _price, *([_verb] if _verb else []))
# Listed from the easiest (the page and the vendors' shelves follow this order): the plants added later go in among the others by their level, in the order they were added within one.
CROPS.sort(key=lambda crop: crop[6])
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
    # The rye, the staple of the Bohemian loaf (2026-11-02): ground in the same mill, the same flour (a dark one in the story, one item in the game).
    ("moer-centeio", "Beneficiar", FLOUR, 1, [("kcdc-craft:centeio", 1)], 2, 3),
]
for key, name, _seed_name, item, _yield, _minutes, level, *_rest in CROPS:
    PROCESSES.append((f"semente-{key}", "Sementes", f"kcdc-craft:semente-{key}", 1, [(item if item in CUSTOM else guid(item), 2)], level, 1))
for _id, _category, _output, _amount, _ingredients, _level, _xp in PROCESSES:
    use(_output)
    for _item, _n in _ingredients:
        use(_item)

# Thread made by the trades themselves (2026-10-30, user: "adiciona a receita de linha que o artesão precisa para ele mesmo poder fabricar com linho e água potável; o taverneiro e
# alquimista podem fazer usando a própria água do corpo, quanto mais ele faz mais sede ele fica"): the Artifices spin it at their sewing, a flax and a flask of potable water for three
# spools (the Agricultores' "Fiar linha" is the same with no water, at their garden); the Tabernarii at the fire and the Alchemistae at the rack wet the flax with their own mouth,
# which costs the body `THREAD_THIRST` points of its water (of a hundred) for each piece made: `thirst` on the recipe, paid by `src/server/craft.ts` out of the server's own thirst, and
# a body already dry cannot make more (it is never taken under the point where the game's Desidratação begins).
THREAD_THIRST = 8
recipe("costura", "Fios", THREAD, 3, [(LINEN, 1), (WATER, 1)], 0, 3, 6, recipe_id="costura:linha")
recipe("fogo", "Fios", THREAD, 3, [(LINEN, 1)], 0, 3, 6, recipe_id="fogo:linha", thirst=THREAD_THIRST)
recipe("secador", "Fios", THREAD, 3, [(LINEN, 1)], 0, 3, 6, recipe_id="secador:linha", thirst=THREAD_THIRST)

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
        # The names the lists have since 2026-10-31 (the mail coifs and collars stand with the coats of mail).
        category = {"Cotas e almofres": "Cotas de malha", "Gibões e couraças de couro": "Almofres e coifas"}.get(category, category)
        EXTRACT_EXTRAS.append((row["Id"], station, category, [(use(item), n) for item, n in bill]))

# The pieces the passes above leave out (2026-11-04, user: "o ferreiro não consegue extrair capuz de malha"): those that carry the arms of a house, a city, a guild or an order ("Capuz de malha com
# brasão", "Gola de armadura com insígnia", the shields and surcoats of the houses), which `by_name` drops because the recipes do not make them. They are taken apart at the station of their kind,
# by the bill the same kind of piece of their weight and price takes (levels by price among those of their kind, as the loose armour above).
already = {item for item, *_rest in EXTRACT_EXTRAS}
leftover = defaultdict(list)
for row in items_doc.load():
    found = items_doc.classify(row)
    if found is None or row["_unique"] or found[0] not in ("armadura", "escudo", "roupa") or not usable(row):
        continue
    if row["Id"] in made or row["Id"] in EXTRACT_ALIASES or row["Id"] in already:
        continue
    leftover[(found[0], found[1])].append(row)
for (kind, part), rows in sorted(leftover.items()):
    levels = levels_by_price(rows, top=24, low=2)
    for row in rows:
        sound = row.get("UiSound") or ""
        station = "forja" if kind == "escudo" or not (TEXTILE_SOUND.search(sound) and not METAL_SOUND.search(sound)) else "costura"
        if kind == "roupa":
            station = "costura"
        level = levels[row["Id"]]
        bill = metal_bill(part, row, level) if station == "forja" else cloth_bill(part, row, level)
        if kind == "escudo":
            category = "Escudos"
        elif station == "costura" and kind == "roupa":
            category = sew_category(part, row)
        else:
            category = (FORGE_PARTS if station == "forja" else SEW_PARTS).get(part, part)
            category = {"Cotas e almofres": "Cotas de malha", "Gibões e couraças de couro": "Almofres e coifas"}.get(category, category)
        EXTRACT_EXTRAS.append((row["Id"], station, category, [(use(item), n) for item, n in bill]))

# ---------------------------------------------------------------------------------------------------------------------
# What a piece asks of whoever makes it (2026-10-31): the quality it can be made in, whether only a noble makes it, and which town's citizens make it.
#
#   maxq    the game's own `MaxQuality` of the class (clothes, armour and weapons are made in four): the worker's level decides how much of it a piece gets (src/server/craft.ts).
#   noble   "os itens nobres, roupas, joias, armas e armaduras, só podem ser fabricados por nobres": every ring, necklace and brooch; every piece the game gives a `WealthLevel` of
#           10 or more AND a price among the dearest fifth of its kind (`is_rich`: the clothes and armour of the rich; the wealth alone made a beggar's tunic a noble's, 2026-10-31);
#           and the dearest of the pieces of the forge and of the needle (the top of the price ladder, from the 22nd level). A garment in dyes has the noble's dyes marked one by one.
#   place   "só um cidadão de Suchdol pode fabricar armaduras de Suchdol e armas, e só um artesão pode fabricar os casacos e coisas de Suchdol": a piece that is in the game's armour
#           presets (data/armor-sets.json) of the places data/set-places.json gives to a town of the server, and in no preset of any other place, is that town's: it stays in its kind
#           (until 2026-10-31 it stood under "<town> · <kind>") and only a citizen of the town (a land counts for its seat) makes it; so are the coats of arms of the houses that file maps to a town.
JEWEL_CATEGORIES = ("Anéis", "Colares e broches")
WEARABLE_TAGS = ("Armor", "Helmet", "Hood", "MeleeWeapon", "MissileWeapon")
NOBLE_WEALTH, NOBLE_LEVEL = 10, 22
HORSE_CATEGORIES = ("Ferraduras", "Arreios e caparazões", "Rédeas e chanfros", "Selas")
for r in RECIPES:
    if r["station"] not in ("forja", "costura"):
        continue
    row = ITEMS.get(r["output"])
    if r["category"] in JEWEL_CATEGORIES:
        r["noble"] = True
    if row is None or row["_tag"] not in WEARABLE_TAGS:
        continue
    if int(row.get("MaxQuality") or 1) > 1:
        r["maxq"] = int(row["MaxQuality"])
    # The horses' gear carries a wealth level in the tables too (a horseshoe has 10), but a horseshoe is no noble's: only the price ladder makes the trappings noble.
    rich = is_rich(row) and r["category"] not in HORSE_CATEGORIES
    if (rich or r["level"] >= NOBLE_LEVEL) and r["category"] != "Ferraduras":
        r["noble"] = True
    towns = set(towns_of(row))
    house = r["category"][len("Brasão: "):] if r["category"].startswith("Brasão: ") else ""
    if house in SET_PLACES["houses"]:
        towns = {SET_PLACES["houses"][house]}
    if towns:
        r["place"] = ",".join(sorted(towns))

for r in RECIPES:
    for variant in r.get("variants", []):
        variant.append(1 if is_rich(ITEMS[variant[0]]) else 0)

# Where the forge's pieces are listed (2026-10-31, user: "acredito que estejam desorganizados"): by the game's own class of the weapon and the kind of the armour, not by the table the
# recipe came from (its "short swords" held the hunting swords, the sabres, the longswords and an axe; its "breastplates and mail" the mail and the plate).
WEAPON_CLASSES = {"0": "Adagas", "1": "Espadas", "16": "Espadas de caça", "2": "Sabres", "4": "Montantes", "3": "Machados", "7": "Lanças e armas de haste"}
FROM_TABLES = ("Espadas curtas", "Montantes", "Machados", "Maças e martelos", "Lanças e machados", "Adagas")
for r in RECIPES:
    if r["station"] != "forja":
        continue
    row = ITEMS.get(r["output"])
    if row is None:
        continue
    if row["_tag"] == "MeleeWeapon" and r["category"] in FROM_TABLES:
        weapon_class = row.get("Class")
        if weapon_class == "5":
            r["category"] = "Martelos de guerra" if "war_hammers" in (row.get("Model") or "") else "Maças"
        elif weapon_class in WEAPON_CLASSES:
            r["category"] = WEAPON_CLASSES[weapon_class]
    elif row["_tag"] == "Helmet":
        stem = stem_of(row)
        r["category"] = "Capacetes de chaleira" if stem == "KettleHat" else "Bacinetes e elmos" if stem.startswith("Bascinet") else "Capacetes de calota"
    elif r["category"] in ("Peitorais e cotas", "Cotas e almofres"):
        r["category"] = "Cotas de malha" if CHAIN_SOUND.search(row.get("UiSound") or "") else "Couraças e placas"
    elif r["category"] == "Pernas":
        r["category"] = "Perneiras e joelheiras"

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
    "    /** Points of the server's own thirst (of a hundred) the body pays for each piece, in place of an ingredient: thread wetted with the worker's own water (2026-10-30). */",
    "    readonly thirst?: number;",
    "    /** The highest quality tier the piece can be made in (the game's `MaxQuality`); the level of the worker decides how much of it a piece gets (2026-10-31). Left out for what has one tier. */",
    "    readonly maxq?: number;",
    "    /** Only a noble makes it (2026-10-31): jewellery, what the game gives a wealth level of 10 or more, and the dearest pieces of the forge and of the needle. */",
    "    readonly noble?: boolean;",
    "    /** The towns whose citizens make it, their ids joined by commas (a land counts for its seat): the armour and clothes of a town's own sets and the coats of arms of its houses (2026-10-31). */",
    "    readonly place?: string;",
    "    /** The garment in its dyes (2026-10-31): [the class, the colour in a word, the game's icon, 1 when only a noble makes that dye]; the first is the recipe's own `output`. The page picks one. */",
    "    readonly variants?: ReadonlyArray<readonly [output: string, label: string, icon: string, noble: number]>;",
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
lines.append("/** What eating the garden's produce of our own does (2026-11-02), raw from the bag: the same as `SOUP_EFFECTS`, a little of it. */")
lines.append("export const PRODUCE_EFFECTS: Readonly<Record<string, readonly [nutrition: number, thirst: number]>> = {")
for key, (nutrition, thirst) in PRODUCE_EFFECTS.items():
    lines.append(f"    {js(key)}: [{nutrition}, {thirst}],")
lines.append("};")
lines.append("")
lines.append("/** Every item a recipe names: id -> [name, icon (the game's IconId)]. */")
# What a potion, a poison, a perfume or an ointment of the alchemists does (2026-11-02, user: "nas poções de alquimia é bom ter descrição do que cada poção e veneno faz"): the
# game's own description of the item (its UIInfo, in Portuguese: "Cura 15 pontos de Vida por um minuto..."), shown on the trades' page under the recipe's name. The markup a few
# carry is taken out; and where the game promises what the server does not do, the server's truth is said instead: the Saviour Schnapps saves nothing here (the server keeps
# every character by itself), so only the rest of what it does is told.
def portuguese_texts() -> dict:
    texts = {}
    for pak_path in sorted((GAME / "Localization").glob("portuguese*.pak")):
        with zipfile.ZipFile(pak_path) as pak:
            for name in pak.namelist():
                body = pak.read(name).decode("utf-8", "replace")
                for match in re.finditer(r"<Row><Cell>([^<]*)</Cell><Cell>[^<]*</Cell><Cell>([^<]*)</Cell>", body):
                    texts.setdefault(match.group(1), match.group(2))
    return texts


def clean_info(text: str) -> str:
    text = text.replace("&lt;", "<").replace("&gt;", ">").replace("&amp;", "&").replace("&quot;", '"')
    text = re.sub(r"</?body>", " ", text)
    text = re.sub(r"<[^>]+>", "", text)
    return re.sub(r"\s+", " ", text).strip()


SAVIOUR_NOTE = "Não salva o jogo: aqui o servidor guarda tudo sozinho."


def server_truth(name: str, text: str) -> str:
    if name.startswith("potion_saviourSchnapps"):
        rest = re.sub(r"^Salva o jogo[,.]?\s*", "", text)
        return f"{rest[:1].upper()}{rest[1:]} {SAVIOUR_NOTE}".strip() if rest else f"Sem efeito no servidor. {SAVIOUR_NOTE}"
    return text


TEXTS = portuguese_texts()
ITEM_INFO = {}
for _recipe in RECIPES:
    if _recipe["station"] != "alquimia" or _recipe["output"] in ITEM_INFO:
        continue
    _row = ITEMS.get(_recipe["output"])
    if _row is None or _row.get("_tag") not in ("Food", "Poison", "Ointment"):
        continue
    _info = clean_info(TEXTS.get(_row.get("UIInfo", ""), ""))
    if _info:
        ITEM_INFO[_recipe["output"]] = server_truth(_row["Name"], _info)
print(f"craft-data.ts: {len(ITEM_INFO)} poções, venenos e unguentos com a descrição do que fazem")
lines.append("/** What a potion, a poison or an ointment made by the alchemists does, in the game's own words (2026-11-02): by the output of its recipe. */")
lines.append("export const ITEM_INFO: Readonly<Record<string, string>> = {")
for key, value in ITEM_INFO.items():
    lines.append(f"    {js(key)}: {js(value)},")
lines.append("};")
lines.append("")
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
    extra = "".join(f", {k}: {js(r[k])}" for k in ("track", "alchemy", "thirst", "maxq", "noble", "place", "variants") if k in r)
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
