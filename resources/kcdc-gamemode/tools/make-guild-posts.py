"""Writes src/server/guild-posts-data.ts: where each town's guild NPC stands (2026-10-31, user: "vamos posicionar eles de forma bem objetiva onde devia ficar no jogo").

    python tools/make-guild-posts.py [game folder] [census json]

One post for each of the eight guilds in each of the sixteen towns of the Cidadania. A post stands where the game itself puts that trade: the smith at the counter of a
blacksmith's shop (or the smithery, or a grindstone), the apothecary at an alchemy table, the tavern keeper at a tavern's counter (or its barrels), the hunter at the tanner's or
the butcher's racks, the Coletor at the lumberjacks' sawing places or the miners' faces, the farmer at the fields, the tamer where the level has a horse for sale, and the
artisan at the tailor's, the shoemaker's or a general store. All of it is read from the level's own entities (`Data/Levels/kutnohorsko/level.pak`: `objects_mission0.xml` and the
layers). The anchor is looked for round the middle of the town (the census of the property catalog: the middle of its houses, or the town's church or square when it has few), no further
than the town's reach. A trade with no anchor in reach stands round the middle of the town, on a ring, and the data says so (`ring`): those are the ones an administrator moves
with `/mercador aqui <id>`. Run it again after the census or the towns change.
"""

import json
import math
import re
import struct
import sys
import zipfile
import zlib
from pathlib import Path

GAME = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(r"C:\Program Files (x86)\Steam\steamapps\common\KingdomComeDeliverance2")
CENSUS = Path(sys.argv[2]) if len(sys.argv) > 2 else Path(r"C:\Users\mauro\AppData\Local\Temp\kcdc-work\props-live.json")
HERE = Path(__file__).resolve().parent.parent
OUT = HERE / "src" / "server" / "guild-posts-data.ts"
PAK = GAME / "Data" / "Levels" / "kutnohorsko" / "level.pak"

# The sixteen towns of src/server/citizenship.ts: id, the census region, and where the town is when the census has too few houses to say (its church or its square).
TOWNS = [
    ("suchdol", "Suchdol", None),
    ("wysoka", "Wysoka", None),
    ("opatowitz", "Opatowitz", (1886.71, 2992.22)),
    ("raborsch", "Raborsch", None),
    ("bohunowitz", "Bohunowitz", (1913.53, 3451.07)),
    ("horschan", "Horschan", (2669.5, 2672.6)),
    ("malesov", "Malešov", (560.5, 258.3)),
    ("bylany", "Bylany", (1716.6, 974.5)),
    ("rabstein", "Rabstein", (982.01, 1051.63)),
    ("stara-lhota", "Stará Lhota", (680.93, 922.71)),
    ("kuttenberg", "Kuttenberg", None),
    ("stara-kutna", "Stará Kutná", None),
    ("danemark", "Danemark", (1561.14, 222.37)),
    ("pschitoky", "Pschitoky", (2307.0, 1821.5)),
    ("miskowitz", "Miskowitz", (1689.88, 1901.07)),
    ("minas", "Minas", None),
]

# What the guilds are called in the posts' ids, in the order the ring uses.
GUILDS = [
    ("fabri-ferrarii", "ferreiro"),
    ("alchemistae", "alquimista"),
    ("tabernarii", "taberneiro"),
    ("venatores", "cacador"),
    ("artifices", "artesao"),
    ("collectores", "coletor"),
    ("agricolae", "agricultor"),
    ("domitores", "domador"),
]

# How far from the middle of a town an anchor is still the town's: by the size of its census (houses), within these bounds.
REACH_MIN = 70.0
REACH_MAX = 330.0

# The kinds of entity a person can stand beside: not the lights, the audio and the trigger volumes that fill a building.
STANDABLE = {"NPC", "NPC_Female", "Shop", "TagPoint", "SchedulerHub", "SmartObjectHolder", "ItemSlot", "ItemSlotPile", "AlchemyTable", "Smithery", "Grindstone", "Horse", "FoodProcessingTrigger", "Stash"}

# Each trade's anchors, best first: (entity class or None for any of the STANDABLE ones, a fragment of the entity's name). The name carries the profession folder of the level's prefab, or the
# name the level's designers gave a person or a place (`kbyl_innkeeper`, `krab_homeHuntsman0Hub_1`, `kmal_horseForSale_5`).
ANCHORS = {
    "ferreiro": [("Shop", "profession/blacksmith"), (None, "BlacksmithHub"), ("Smithery", ""), (None, "profession/blacksmith"), ("Grindstone", "")],
    "alquimista": [(None, "alchemist"), (None, "profession/apothecary"), (None, "herbalist")],
    "taberneiro": [("NPC", "innkeeper"), ("NPC_Female", "innkeeper"), ("Shop", "profession/tavern"), (None, "innkeeper_talkSpot"), ("ItemSlot", "tavernBarrel")],
    "cacador": [(None, "huntsman"), (None, "profession/tanner"), ("FoodProcessingTrigger", "profession/butcher")],
    "coletor": [("NPC", "woodcutter"), (None, "lumberjack"), ("SmartObjectHolder", "profession/lumberjack/sawingWood"), ("SmartObjectHolder", "profession/miner/miner_mining"), ("SmartObjectHolder", "profession/coalman")],
    "agricultor": [("NPC", "gardener"), ("NPC", "farmer"), ("SmartObjectHolder", "profession/farmer/field"), ("TagPoint", "profession/farmer/field")],
    "domador": [("Horse", "horseForSale"), ("Horse", "horse_")],
    "artesao": [(None, "tailor"), (None, "profession/shoemaker"), ("Shop", "profession/seller")],
}

# Suchdol's five were placed by hand in the first vendors, at the level's own people (the smith's and the tavern keeper's are the Shop entities the anchors find too).
KNOWN = {
    "ferreiro-suchdol": (662.34, 3258.94, 145.39, "npc do nível"),
    "alquimista-suchdol": (612.3, 3285.57, 146.02, "npc do nível"),
    "taberneiro-suchdol": (604.01, 3277.69, 146.74, "npc do nível"),
    "cacador-suchdol": (577.06, 3275.52, 147.28, "npc do nível"),
    "artesao-suchdol": (590.5, 3276.6, 147.0, "npc do nível"),
}


def read_member(f, zi) -> bytes:
    """The pak's names carry backslashes that Python's zipfile refuses, so the entry is read by hand."""
    f.seek(zi.header_offset)
    header = f.read(30)
    method = struct.unpack("<H", header[8:10])[0]
    size = struct.unpack("<I", header[18:22])[0]
    name_len, extra_len = struct.unpack("<HH", header[26:30])
    f.seek(name_len + extra_len, 1)
    raw = f.read(size if size else zi.compress_size)
    return raw if method == 0 else zlib.decompress(raw, -15)


def level_entities():
    rows = []
    with zipfile.ZipFile(PAK) as z, open(PAK, "rb") as f:
        for zi in z.infolist():
            if not (zi.filename == "objects_mission0.xml" or (zi.filename.startswith("layers/") and zi.filename.endswith(".xml"))):
                continue
            text = read_member(f, zi).decode("utf-8", "replace")
            for match in re.finditer(r"<Entity\b([^>]*)>", text):
                row = dict(re.findall(r'([\w.]+)="([^"]*)"', match.group(1)))
                if not row.get("Pos"):
                    continue
                x, y, z_ = (float(v) for v in row["Pos"].split(","))
                rows.append((row.get("EntityClass", "?"), row.get("Name", ""), x, y, z_))
    return rows


def median(values):
    ordered = sorted(values)
    mid = len(ordered) // 2
    return ordered[mid] if len(ordered) % 2 else (ordered[mid - 1] + ordered[mid]) / 2


def towns_from_census():
    census = json.loads(CENSUS.read_text(encoding="utf-8"))
    by_region = {}
    for prop in census.values():
        if prop.get("parentId", "") == "" and prop.get("kind") == "house":
            by_region.setdefault(prop["region"], []).append((prop["x"], prop["y"]))
    found = {}
    for town_id, region, fallback in TOWNS:
        houses = by_region.get(region, [])
        if len(houses) >= 3:
            cx = median([h[0] for h in houses])
            cy = median([h[1] for h in houses])
            near = sorted(math.hypot(h[0] - cx, h[1] - cy) for h in houses)
            # Four fifths of the houses decide the size, so a farm far out does not stretch the town.
            edge = near[max(0, int(len(near) * 0.8) - 1)]
            reach = min(REACH_MAX, max(REACH_MIN, edge + 45))
            found[town_id] = (cx, cy, reach, f"{len(houses)} casas")
        elif fallback is not None:
            found[town_id] = (fallback[0], fallback[1], REACH_MIN + 20, "praça")
        elif houses:
            found[town_id] = (sum(h[0] for h in houses) / len(houses), sum(h[1] for h in houses) / len(houses), REACH_MIN + 20, f"{len(houses)} casas")
    return found


def main() -> None:
    towns = towns_from_census()
    # The towns with a church the census could not place (Wysoka, Raborsch, Kuttenberg's, Stará Kutná, Minas have houses: the middle of those is used).
    rows = level_entities()
    print(f"{len(rows)} entities with a place")
    posts = []
    missing = []
    for town_id, region, fallback in TOWNS:
        if town_id not in towns:
            missing.append(town_id)
            continue
        cx, cy, reach, how = towns[town_id]
        taken = []
        for index, (guild, trade) in enumerate(GUILDS):
            best = None
            known = KNOWN.get(f"{trade}-{town_id}")
            if known is not None:
                best = (0.0, known[0], known[1], known[2], known[3])
                source = known[3]
            for cls, fragment in ([] if known is not None else ANCHORS[trade]):
                candidates = [(math.hypot(x - cx, y - cy), x, y, z, name) for (c, name, x, y, z) in rows if (c == cls if cls is not None else c in STANDABLE) and fragment.lower() in name.lower() and math.hypot(x - cx, y - cy) <= reach]
                # Not on top of another post of the town: two trades never share a spot.
                candidates = [c for c in candidates if all(math.hypot(c[1] - tx, c[2] - ty) >= 3.0 for tx, ty in taken)]
                if candidates:
                    best = min(candidates)
                    source = f"{cls or '*'}:{fragment}"
                    break
            if best is not None:
                _, x, y, z, _name = best
                # Faces the middle of the town, as a seller faces the street.
                yaw = math.degrees(math.atan2(-(cx - x), cy - y))
                posts.append((f"{trade}-{town_id}", guild, town_id, round(x, 2), round(y, 2), round(z, 2), round(yaw, 1), source))
                taken.append((x, y))
            else:
                # A ring round the middle of the town, six metres out, one slot to each trade.
                angle = (index / len(GUILDS)) * 2 * math.pi
                x = cx + math.cos(angle) * 6.0
                y = cy + math.sin(angle) * 6.0
                yaw = math.degrees(math.atan2(-(cx - x), cy - y))
                posts.append((f"{trade}-{town_id}", guild, town_id, round(x, 2), round(y, 2), round(towns_z(rows, x, y), 2), round(yaw, 1), "ring"))
                taken.append((x, y))
    lines = [
        "// Generated by tools/make-guild-posts.py from the level's entities and the census. Do not edit by hand.",
        "",
        "/** One guild NPC's place: id (`<trade>-<town>`), guild, town, x, y, z, the way it faces (degrees) and what the place was taken from (`ring`: round the middle of the town, for an administrator to move). */",
        "export const GUILD_POSTS: ReadonlyArray<readonly [id: string, guild: string, town: string, x: number, y: number, z: number, yaw: number, source: string]> = [",
    ]
    for post in posts:
        lines.append("    [" + ", ".join(json.dumps(v, ensure_ascii=False) if isinstance(v, str) else repr(v) for v in post) + "],")
    lines += ["];", ""]
    OUT.write_bytes("\n".join(lines).encode("utf-8"))
    anchored = sum(1 for p in posts if p[7] != "ring")
    print(f"{OUT.name}: {len(posts)} posts, {anchored} at the game's own places, {len(posts) - anchored} on a ring; towns without a place: {missing}")
    by_town = {}
    for p in posts:
        by_town.setdefault(p[2], []).append(p[7] != "ring")
    for town_id, flags in by_town.items():
        print(f"  {town_id:12s} {sum(flags)}/{len(flags)} at the game's places  ({towns[town_id][3]}, reach {towns[town_id][2]:.0f} m)")


def towns_z(rows, x, y):
    """The height of the nearest entity, for a ring spot (the server snaps the spot to the walkable ground anyway)."""
    best = None
    for (c, name, ex, ey, ez) in rows:
        d = math.hypot(ex - x, ey - y)
        if d < 40 and (best is None or d < best[0]):
            best = (d, ez)
    return best[1] if best else 100.0


main()
