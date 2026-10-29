// Places props from a JSON list and remembers their ids in placed.json, so a design can be redone.
//   node place.mjs <design.json>       -> places every entry not yet placed (by its "key")
//   node place.mjs --clear <prefix>     -> deletes the placed props whose key starts with prefix
// An entry: { "key": "hall.table", "model": "objects/...cgf", "at": [x, y, z], "yaw": degrees, "scale": 1, "physics": "static" }
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { call, edit } from "./wb.mjs";

const STORE = "placed.json";
const placed = existsSync(STORE) ? JSON.parse(readFileSync(STORE, "utf8")) : {};
const save = () => writeFileSync(STORE, JSON.stringify(placed, null, 1));

export function quat(yawDeg) {
    const half = (yawDeg * Math.PI) / 360;
    return [0, 0, Math.sin(half), Math.cos(half)];
}

const [first, second] = process.argv.slice(2);
if (first === "--clear") {
    const ids = Object.entries(placed).filter(([key]) => key.startsWith(second ?? "")).map(([, id]) => id);
    if (ids.length > 0) {
        await edit("wb_objects_delete", { ids });
        for (const [key, id] of Object.entries(placed)) if (ids.includes(id)) delete placed[key];
        save();
    }
    console.log(`removed ${ids.length}`);
} else {
    const design = JSON.parse(readFileSync(first, "utf8"));
    for (const entry of design) {
        // "ground": the height of the ground under it, plus "lift" (metres), found by a ray from above.
        if (entry.ground && !placed[entry.key]) {
            const down = await call("wb_raycast", { origin: [entry.at[0], entry.at[1], entry.at[2] + 20], direction: [0, 0, -1], distance: 40 });
            if (down.hit) entry.at = [entry.at[0], entry.at[1], down.position[2] + (entry.lift ?? 0)];
            console.log(`${entry.key}: ground ${down.hit ? down.position[2].toFixed(2) + " (" + down.name + ")" : "not found"}`);
        }
        if (placed[entry.key]) {
            await edit("wb_objects_transform", { objects: [{ id: placed[entry.key], position: entry.at, rotation: quat(entry.yaw ?? 0), scale: [entry.scale ?? 1, entry.scale ?? 1, entry.scale ?? 1] }] });
            console.log(`moved ${entry.key}`);
            continue;
        }
        const result = await edit("wb_props_create", { model: entry.model, position: entry.at, rotation: quat(entry.yaw ?? 0), scale: [entry.scale ?? 1, entry.scale ?? 1, entry.scale ?? 1], physics: entry.physics ?? "static", group: entry.group ?? "castelo-raborsch" });
        const id = result.id ?? result.objectId ?? result.ids?.[0] ?? result.object?.id;
        if (!id) {
            console.log(`no id for ${entry.key}: ${JSON.stringify(result).slice(0, 300)}`);
            continue;
        }
        placed[entry.key] = id;
        save();
        console.log(`placed ${entry.key} -> ${id}`);
    }
}
