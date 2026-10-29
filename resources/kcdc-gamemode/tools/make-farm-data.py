"""Makes data/farm.json for the Agricultores (src/server/farm.ts and src/server/wild-horses.ts): the level's vegetable gardens and the open
meadows the wild horses graze on.

    python tools/make-farm-data.py [path to the game's Levels/kutnohorsko/level.pak]

**Gardens.** The level marks every bed its farmers hoe with a smart object of the farmer's profession
(`smartObject[profession/farmer/fieldN_<guid>]`, class `SmartObjectHolder`, linked to `+Soil[hoeing,5]` and to two `hoeingPoint` tag points,
the two ends of the row the farmer walks): 119 of them, behind the houses of the villages. A bed is the middle of its row, which way the row
runs and how long it is (`[x, y, z, yaw in degrees, metres]`, yaw 0 being +Y as the level's); beds less than `GARDEN_GAP_M` apart are one garden, named after the region its middle lies in (the boxes of `REGIONS` in src/server/properties.ts) or, out of
every box, after the place of the layer it was authored in (`Main/ksuc_suchdol/...` is Suchdol). The vineyards' hoeing (`profession/vineyard`)
is left out: vines, not vegetables.

**Meadows.** `tools/open-meadows.txt` is what a probe of the live server's navigation mesh found (2026-10-22): the game's own animal spawn
points (hares, deer, cattle...) from which a straight walk of 35 m on the mesh is free in at least 15 of 16 directions, which is how an open
field looks to the mesh (a wood is full of trunks, each a hole in it). A line is `x,y,z,free directions,animal,height change`. Kept are the
ones out of every village (`VILLAGE_MARGIN_M` round each region's box), far from the gardens, on gentle ground, and at least `MEADOW_GAP_M`
from each other.
"""
import json
import math
import re
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "farm.json"
MEADOWS_IN = Path(__file__).resolve().parent / "open-meadows.txt"
LEVEL = r"C:\Program Files (x86)\Steam\steamapps\common\KingdomComeDeliverance2\Data\Levels\kutnohorsko\level.pak"

GARDEN_GAP_M = 14
VILLAGE_MARGIN_M = 120
GARDEN_CLEAR_M = 250
MEADOW_GAP_M = 300
MEADOW_MAX_RISE_M = 6

# The places of the level's layers, for a garden out of every region's box.
LAYER_PLACES = {
    "ksuc": "Suchdol", "kvys": "Wysoka", "krat": "Raborsch", "kmal": "Malešov", "kbyl": "Bylany", "kboh": "Bohunowitz",
    "kkut": "Kuttenberg", "kmis": "Miskowitz", "kpri": "Pschitoky", "kgru": "Minas", "khor": "Horschan", "ksta": "Stará Kutná",
    "kvrc": "Vrchlicko", "kopa": "Opatowitz", "kdan": "Danemark", "krab": "Rabstein", "klho": "Stará Lhota",
}

# A garden keeps the id it was given when the place had another name (a planted bed is kept by it): Minas was filed as Grunta.
ID_STEMS = {"Minas": "grunta"}

ENTITY = re.compile(r'<Entity [^>]*?Name="([^"]*)" Pos="([^"]*)"[^>]*?EntityClass="([^"]*)" EntityId="(\d+)"[^>]*?EditorLayer="([^"]*)"[^>]*>(.*?)</Entity>', re.S)
LINK = re.compile(r'<Link TargetId="(\d+)"[^>]*Name="([^"]*)"')
REGION = re.compile(r'\{ id: "([^"]+)", name: "([^"]+)", minX: (-?[\d.]+), maxX: (-?[\d.]+), minY: (-?[\d.]+), maxY: (-?[\d.]+)')


def read_level(path: str) -> str:
    z = zipfile.ZipFile(path)
    info = z.getinfo("objects_mission0.xml")
    try:
        data = z.read(info)
    except zipfile.BadZipFile:
        info.orig_filename = info.filename.replace("/", "\\")
        data = z.read(info)
    return data.decode("utf-8", "replace")


def regions() -> list[tuple[str, str, float, float, float, float]]:
    text = (ROOT / "src" / "server" / "properties.ts").read_text(encoding="utf-8")
    return [(m[0], m[1], float(m[2]), float(m[3]), float(m[4]), float(m[5])) for m in REGION.findall(text)]


def region_of(x: float, y: float, boxes, margin: float = 0) -> str | None:
    for _id, name, min_x, max_x, min_y, max_y in boxes:
        if min_x - margin <= x <= max_x + margin and min_y - margin <= y <= max_y + margin:
            return name
    return None


def gardens(text: str, boxes) -> list[dict]:
    by_id = {}
    beds = []
    for name, pos, cls, entity_id, layer, body in ENTITY.findall(text):
        x, y, z = (float(v) for v in pos.split(","))
        by_id[entity_id] = (x, y, z)
        if cls == "SmartObjectHolder" and "profession/farmer/field" in name:
            beds.append((entity_id, (x, y, z), layer, [target for target, link in LINK.findall(body) if link.startswith("hoeingPoint")]))
    rows = []
    for entity_id, at, layer, points in beds:
        ends = [by_id[p] for p in points if p in by_id]
        middle = [sum(v) / len(v) for v in zip(*ends)] if ends else list(at)
        # The row: from the first hoeing point to the second, which way it runs (degrees, the level's yaw: 0 is +Y) and how long it is.
        if len(ends) >= 2:
            dx, dy = ends[1][0] - ends[0][0], ends[1][1] - ends[0][1]
            yaw = math.degrees(math.atan2(-dx, dy)) % 360
            length = max(1.2, min(4.0, math.hypot(dx, dy)))
        else:
            yaw, length = 0.0, 1.6
        code = layer.split("/")[1].split("_")[0] if layer.count("/") >= 1 else ""
        rows.append({"at": [round(middle[0], 2), round(middle[1], 2), round(middle[2], 2), round(yaw, 1), round(length, 2)], "place": LAYER_PLACES.get(code, "")})
    # Beds near each other are one garden.
    groups: list[list[dict]] = []
    for row in sorted(rows, key=lambda r: (r["at"][0], r["at"][1])):
        home = next((g for g in groups if any(math.dist(row["at"][:2], other["at"][:2]) <= GARDEN_GAP_M for other in g)), None)
        if home is None:
            groups.append([row])
        else:
            home.append(row)
    # Two groups a later bed joined to each other's reach are merged.
    merged = True
    while merged:
        merged = False
        for i in range(len(groups)):
            for j in range(i + 1, len(groups)):
                if any(math.dist(a["at"][:2], b["at"][:2]) <= GARDEN_GAP_M for a in groups[i] for b in groups[j]):
                    groups[i].extend(groups.pop(j))
                    merged = True
                    break
            if merged:
                break
    out = []
    count = {}
    for group in sorted(groups, key=lambda g: (-len(g), g[0]["at"][0])):
        cx = sum(r["at"][0] for r in group) / len(group)
        cy = sum(r["at"][1] for r in group) / len(group)
        cz = sum(r["at"][2] for r in group) / len(group)
        place = region_of(cx, cy, boxes, 60) or next((r["place"] for r in group if r["place"]), "") or "campo"
        count[place] = count.get(place, 0) + 1
        out.append({"place": place, "x": round(cx, 2), "y": round(cy, 2), "z": round(cz, 2), "beds": [r["at"] for r in sorted(group, key=lambda r: (r["at"][0], r["at"][1]))]})
    # A name of their own, numbered where a place has several: "Horta de Suchdol 2".
    seen = {}
    for garden in sorted(out, key=lambda g: (g["place"], g["x"], g["y"])):
        place = garden["place"]
        seen[place] = seen.get(place, 0) + 1
        slug = ID_STEMS.get(place) or re.sub(r"[^a-z0-9]+", "-", place.lower().replace("š", "s").replace("á", "a").replace("ř", "r")).strip("-")
        garden["id"] = f"{slug}-{seen[place]}" if count[place] > 1 else slug
        garden["name"] = f"Horta de {place}" + (f" {seen[place]}" if count[place] > 1 else "")
    return sorted(out, key=lambda g: g["id"])


def meadows(boxes, garden_rows) -> list[list[float]]:
    found = []
    for line in MEADOWS_IN.read_text(encoding="utf-8").splitlines():
        parts = line.strip().split(",")
        if len(parts) < 6:
            continue
        x, y, z, free, _animal, rise = float(parts[0]), float(parts[1]), float(parts[2]), int(parts[3]), parts[4], float(parts[5])
        if rise > MEADOW_MAX_RISE_M or region_of(x, y, boxes, VILLAGE_MARGIN_M) is not None:
            continue
        if any(math.dist((x, y), (g["x"], g["y"])) < GARDEN_CLEAR_M for g in garden_rows):
            continue
        found.append((free, -rise, x, y, z))
    found.sort(reverse=True)
    kept = []
    for _free, _rise, x, y, z in found:
        if all(math.dist((x, y), (k[0], k[1])) >= MEADOW_GAP_M for k in kept):
            kept.append([round(x, 1), round(y, 1), round(z, 1)])
    return sorted(kept)


def main() -> None:
    level = sys.argv[1] if len(sys.argv) > 1 else LEVEL
    boxes = regions()
    garden_rows = gardens(read_level(level), boxes)
    meadow_rows = meadows(boxes, garden_rows)
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(json.dumps({"gardens": garden_rows, "meadows": meadow_rows}, ensure_ascii=False, indent=1) + "\n", encoding="utf8", newline="\n")
    print(f"{len(garden_rows)} hortas, {sum(len(g['beds']) for g in garden_rows)} canteiros; {len(meadow_rows)} campos abertos")
    for g in garden_rows:
        print(f"  {g['id']:24} {g['name']:28} {len(g['beds']):2} canteiro(s) em {g['x']:.0f}, {g['y']:.0f}")


if __name__ == "__main__":
    main()
