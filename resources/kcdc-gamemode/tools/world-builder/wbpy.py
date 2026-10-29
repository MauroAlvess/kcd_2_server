"""A small Python client for World Builder's MCP endpoint (JSON-RPC over HTTP), the twin of wb.mjs, plus a top-down look with a
coordinate grid drawn over the capture:

    python wbpy.py look <out.png> <x> <y> [alt=110] [yaw=0] [fov=60] [half=70] [step=10]

`look` flies the editor camera straight down over (x, y), captures the viewport and draws the world grid over it (a line every `step`
metres, labelled with the world x/y every second line), so a spot can be read off the picture in world coordinates.
"""
import base64
import io
import json
import sys
import time
import urllib.request
import uuid

from PIL import Image, ImageDraw, ImageFont

URL = "http://127.0.0.1:7781/mcp"
HEADERS = {"Accept": "application/json, text/event-stream", "MCP-Protocol-Version": "2025-11-25", "Content-Type": "application/json"}
_initialized = False


def _post(body: dict, timeout: int = 90):
    request = urllib.request.Request(URL, data=json.dumps(body).encode("utf-8"), headers=HEADERS, method="POST")
    with urllib.request.urlopen(request, timeout=timeout) as response:
        text = response.read().decode("utf-8", "replace")
    if not text.strip():
        return None
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        for line in text.splitlines():
            if line.startswith("data:"):
                return json.loads(line[5:])
    return None


def rpc(method: str, params: dict | None = None):
    reply = _post({"jsonrpc": "2.0", "id": str(uuid.uuid4()), "method": method, "params": params or {}})
    if reply is None:
        return None
    if "error" in reply:
        raise RuntimeError(json.dumps(reply["error"]))
    return reply["result"]


def connect():
    global _initialized
    if _initialized:
        return
    rpc("initialize", {"protocolVersion": "2025-11-25", "capabilities": {}, "clientInfo": {"name": "claude-wb-py", "version": "1.0"}})
    _post({"jsonrpc": "2.0", "method": "notifications/initialized"})
    _initialized = True


def raw_call(name: str, args: dict | None = None):
    connect()
    return rpc("tools/call", {"name": name, "arguments": args or {}})


def call(name: str, args: dict | None = None):
    result = raw_call(name, args)
    if result.get("isError"):
        raise RuntimeError(f"{name}: {json.dumps(result.get('structuredContent') or result.get('content'))[:400]}")
    receipt = result.get("structuredContent") or result.get("content")
    deadline = time.time() + 60
    while isinstance(receipt, dict) and receipt.get("operationId") and receipt.get("status") == "queued":
        if time.time() > deadline:
            raise RuntimeError("still pending")
        time.sleep(max(0.05, receipt.get("pollAfterMs", 100) / 1000))
        polled = raw_call("wb_operation_get", {"operationId": receipt["operationId"]})
        receipt = polled.get("structuredContent") or polled.get("content")
    if isinstance(receipt, dict) and receipt.get("operationId") and receipt.get("status") and receipt["status"] != "completed":
        raise RuntimeError(f"{name}: {json.dumps(receipt)[:400]}")
    if isinstance(receipt, dict) and receipt.get("operationId") and "result" in receipt:
        return receipt["result"]
    return receipt


def edit(name: str, args: dict | None = None):
    state = call("wb_get_state")
    payload = {"expectedRevision": str(state["revision"]), "idempotencyKey": str(uuid.uuid4())}
    payload.update(args or {})
    return call(name, payload)


RUNGS = [330, 270, 210, 150, 100, 60, 20]


def ground(points):
    """The topmost surface under each (x, y): the probe reaches about 150 m down, so it is asked from a ladder of heights, highest first."""
    out = [None] * len(points)
    pending = list(range(len(points)))
    for rung in RUNGS:
        if not pending:
            break
        for start in range(0, len(pending), 256):
            chunk = pending[start:start + 256]
            result = call("wb_ground_probe", {"points": [[points[i][0], points[i][1], rung] for i in chunk]})
            for i, one in zip(chunk, result["points"]):
                if one.get("hit"):
                    out[i] = one["position"][2]
        pending = [i for i in pending if out[i] is None]
    return out


def capture(settle: float = 3.0) -> Image.Image:
    time.sleep(settle)
    first = raw_call("wb_capture_viewport", {"includeOverlays": False})
    capture_id = first["structuredContent"]["captureId"]
    for _ in range(40):
        time.sleep(0.6)
        second = raw_call("wb_capture_viewport", {"captureId": capture_id})
        images = [c for c in second.get("content", []) if c.get("type") == "image"]
        if images:
            return Image.open(io.BytesIO(base64.b64decode(images[0]["data"]))).convert("RGB")
    raise RuntimeError("no capture")


def project(points):
    out = []
    for start in range(0, len(points), 256):
        chunk = points[start:start + 256]
        result = call("wb_project_points", {"points": [list(p) for p in chunk]})
        out.extend(result["points"])
    return out


def look(out: str, x: float, y: float, alt: float = 110, yaw: float = 0, fov: float = 60, half: float = 70, step: float = 10, settle: float = 3.5):
    z = ground([(x, y)])[0] or 0
    edit("wb_camera_set", {"position": [x, y, z + alt], "yaw": yaw, "pitch": -89, "fov": fov})
    image = capture(settle)
    # The grid, in the world's own axes, projected through whatever the camera really is.
    xs = [x + i * step for i in range(-int(half / step), int(half / step) + 1)]
    ys = [y + j * step for j in range(-int(half / step), int(half / step) + 1)]
    cells = [(gx, gy) for gy in ys for gx in xs]
    heights = ground(cells)
    pts = project([(gx, gy, (h if h is not None else z)) for (gx, gy), h in zip(cells, heights)])
    width, height = image.size
    draw = ImageDraw.Draw(image, "RGBA")
    try:
        font = ImageFont.truetype("arial.ttf", 15)
    except OSError:
        font = ImageFont.load_default()
    grid = {}
    for (gx, gy), p in zip(cells, pts):
        grid[(gx, gy)] = (p["x"] * width, p["y"] * height, p["onScreen"])
    for gy in ys:
        row = [grid[(gx, gy)] for gx in xs]
        for a, b in zip(row, row[1:]):
            draw.line([a[:2], b[:2]], fill=(255, 255, 255, 70), width=1)
    for gx in xs:
        col = [grid[(gx, gy)] for gy in ys]
        for a, b in zip(col, col[1:]):
            draw.line([a[:2], b[:2]], fill=(255, 255, 255, 70), width=1)
    for ix, gx in enumerate(xs):
        for iy, gy in enumerate(ys):
            px, py, on = grid[(gx, gy)]
            if on and ix % 2 == 0 and iy % 2 == 0:
                draw.ellipse([px - 2, py - 2, px + 2, py + 2], fill=(255, 220, 0, 230))
                draw.text((px + 3, py + 1), f"{gx:.0f},{gy:.0f}", fill=(255, 255, 0, 255), font=font, stroke_width=2, stroke_fill=(0, 0, 0, 255))
    image.thumbnail((1150, 650))
    image.save(out)
    print(out, image.size, "ground z", round(z, 1))
    return image


def main():
    verb = sys.argv[1]
    if verb == "look":
        out = sys.argv[2]
        x, y = float(sys.argv[3]), float(sys.argv[4])
        alt = float(sys.argv[5]) if len(sys.argv) > 5 else 110
        yaw = float(sys.argv[6]) if len(sys.argv) > 6 else 0
        fov = float(sys.argv[7]) if len(sys.argv) > 7 else 60
        half = float(sys.argv[8]) if len(sys.argv) > 8 else 70
        step = float(sys.argv[9]) if len(sys.argv) > 9 else 10
        look(out, x, y, alt, yaw, fov, half, step)
    elif verb == "ground":
        pts = json.loads(sys.argv[2])
        print(json.dumps(ground([tuple(p) for p in pts])))
    else:
        print(__doc__)


if __name__ == "__main__":
    main()
