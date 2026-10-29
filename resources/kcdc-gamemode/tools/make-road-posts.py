"""Makes data/road-posts.json for the bandits of the roads (src/server/bandits.ts, `addRoads`).

    python tools/make-road-posts.py [path to the game's Levels/kutnohorsko/level.pak]

The level has no layer of roads (the tracks are painted into the terrain), but the game's own road events and caravans are placed on them by
hand: the `RandomEventPlace`s of the level whose names say road (the crossroads, junctions, forest roads, field roads and inn roads where the game
stages its encounters) and the places where the caravans of `karavanyVeSvete` set out (68 in all), and the bandit places of the "road bandit" scenes of the quest
of the seven (`sedmStatecnych*_eventPlace_road*_bandit_*`). They are what stands in for a road here: the script keeps the ones that are far
from every place with people and from every camp, and puts a small gang on each (2026-10-24: "coloque alguns bandidos pelas estradas já que o
sistema de emboscada não funciona").
"""
import json
import re
import sys
import zipfile
from pathlib import Path

LEVEL = r"C:\Program Files (x86)\Steam\steamapps\common\KingdomComeDeliverance2\Data\Levels\kutnohorsko\level.pak"
OUT = Path(__file__).resolve().parent.parent / "data" / "road-posts.json"
ENTITY = re.compile(r'<Entity [^>]*?Name="([^"]*)" Pos="([^"]*)"[^>]*?EntityClass="([^"]*)"')
# Two places closer than this are one.
MERGE_M = 40


def read_level(path: str) -> str:
    z = zipfile.ZipFile(path)
    info = z.getinfo("objects_mission0.xml")
    try:
        data = z.read(info)
    except zipfile.BadZipFile:
        info.orig_filename = info.filename.replace("/", "\\")
        data = z.read(info)
    return data.decode("utf-8", "replace")


def main() -> None:
    level = sys.argv[1] if len(sys.argv) > 1 else LEVEL
    text = read_level(level)
    found = []
    for name, pos, cls in ENTITY.findall(text):
        short = re.sub(r"\[([^\]]*?)(?:_[0-9a-f]{8}-[0-9a-f-]{27})?\]", r"[\1]", name)
        road_event = cls == "RandomEventPlace" and re.search(r"road|junction|karavanyVeSvete", name, re.I) is not None
        road_bandit = cls == "TagPoint" and re.search(r"sedmStatecnych\d*_eventPlace_road\d*_bandit_", name) is not None
        if not (road_event or road_bandit):
            continue
        x, y, z = (float(v) for v in pos.split(","))
        found.append({"id": short[:80], "x": round(x, 1), "y": round(y, 1), "z": round(z, 1)})
    found.sort(key=lambda row: (row["x"], row["y"]))
    posts = []
    for row in found:
        if all(((row["x"] - other["x"]) ** 2 + (row["y"] - other["y"]) ** 2) ** 0.5 >= MERGE_M for other in posts):
            posts.append(row)
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(json.dumps({"posts": posts}, ensure_ascii=False, indent=1) + "\n", encoding="utf-8", newline="\n")
    print(f"{len(found)} places read, {len(posts)} kept (none closer than {MERGE_M} m to another): {OUT}")


if __name__ == "__main__":
    main()
