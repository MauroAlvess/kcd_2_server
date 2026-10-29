"""Looks at each board from 7 m in front of its face: python verify.py name1 name2 ... -> ver_<name>.png"""
import json
import math
import sys
import wbpy

boards = json.load(open("boards.json", encoding="utf-8"))
for name in sys.argv[1:]:
    b = boards[name]
    yaw = math.radians(b["yaw"])
    fx, fy = math.cos(yaw), math.sin(yaw)
    dist = float(__import__('os').environ.get('DIST', '8.5'))
    cx, cy = b["x"] + fx * dist, b["y"] + fy * dist
    z = wbpy.ground([(cx, cy)])[0] or b["z"]
    cz = max(b["z"] + float(__import__('os').environ.get('RISE', '5.5')), z + 1.5)
    tx, ty, tz = b["x"], b["y"], b["z"] + 1.4
    dx, dy, dz = tx - cx, ty - cy, tz - cz
    cyaw = math.degrees(math.atan2(-dx, dy))
    pitch = math.degrees(math.atan2(dz, math.hypot(dx, dy)))
    wbpy.edit("wb_camera_set", {"position": [cx, cy, cz], "yaw": cyaw, "pitch": pitch, "fov": 63})
    image = wbpy.capture(3.5)
    image.thumbnail((900, 900))
    image.save(f"ver_{name}.png")
    print(name, "ok")
