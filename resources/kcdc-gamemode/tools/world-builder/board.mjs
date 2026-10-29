// A notice board ("quadro de avisos") made of the game's own pieces, for the villages, towns and castles:
//   node board.mjs <name> <x> <y> <yawFront> [--clear]
// (x, y) is the middle of the board's foot on the ground, yawFront the direction its face looks (0 = +X, 90 = +Y, in degrees).
// Two panels of vertical planks on two posts, a rough plank as a roof and a few letters and parchments pinned to the face.
// What it places is written to boards.json (by name), so a board can be taken away again (--clear) or redone.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { call, edit } from "./wb.mjs";

const STORE = "boards.json";
const store = existsSync(STORE) ? JSON.parse(readFileSync(STORE, "utf8")) : {};
const save = () => writeFileSync(STORE, JSON.stringify(store, null, 1));

const MODELS = {
    panel: "objects/manmade/structures/logistical/fences/fence_planks_a_01.cgf",
    post: "objects/manmade/structures/logistical/fences/fence_rural_post_a.cgf",
    roof: "objects/manmade/task_specific_props/construction/plank_rough_a.cgf",
    // The one piece that tells the server a notice board stands here (`MURAL_MODEL` in src/server/mural-places.ts): buried at the board's foot, never seen.
    marker: "objects/manmade/task_specific_props/read_and_write/scrolls/scroll_c.cgf",
    parchment: "objects/manmade/task_specific_props/read_and_write/scrolls/parchment.cgf",
    paper_a: "objects/manmade/task_specific_props/read_and_write/scrolls/paper_a.cgf",
    paper_b: "objects/manmade/task_specific_props/read_and_write/scrolls/paper_b.cgf",
    letter: "objects/manmade/task_specific_props/read_and_write/scrolls/letter.cgf",
};

// Size [x, y, z] and the pivot's place from the box's min corner, at scale 1 (measure.mjs).
const BOX = {
    panel: { size: [0.16, 1.27, 3.21], pivot: [0.04, 0.08, 0.27] },
    post: { size: [0.11, 0.14, 1.38], pivot: [0.1, 0.11, 0.01] },
    roof: { size: [0.41, 2.12, 0.08], pivot: [0.2, 1.06, 0.01] },
    marker: { size: [0.1, 0.1, 0.1], pivot: [0.05, 0.05, 0.05] },
    parchment: { size: [0.28, 0.45, 0.01], pivot: [0.13, 0.23, 0] },
    paper_a: { size: [0.22, 0.33, 0.02], pivot: [0.11, 0.16, 0] },
    paper_b: { size: [0.22, 0.31, 0.05], pivot: [0.11, 0.14, 0] },
    letter: { size: [0.22, 0.31, 0.05], pivot: [0.11, 0.14, 0] },
};

/** Quaternion [x, y, z, w] of a rotation matrix given by its columns (the images of local X, Y and Z). */
function quatFromColumns(cx, cy, cz) {
    const m = [
        [cx[0], cy[0], cz[0]],
        [cx[1], cy[1], cz[1]],
        [cx[2], cy[2], cz[2]],
    ];
    const trace = m[0][0] + m[1][1] + m[2][2];
    let x, y, z, w;
    if (trace > 0) {
        const s = Math.sqrt(trace + 1) * 2;
        w = 0.25 * s;
        x = (m[2][1] - m[1][2]) / s;
        y = (m[0][2] - m[2][0]) / s;
        z = (m[1][0] - m[0][1]) / s;
    } else if (m[0][0] > m[1][1] && m[0][0] > m[2][2]) {
        const s = Math.sqrt(1 + m[0][0] - m[1][1] - m[2][2]) * 2;
        w = (m[2][1] - m[1][2]) / s;
        x = 0.25 * s;
        y = (m[0][1] + m[1][0]) / s;
        z = (m[0][2] + m[2][0]) / s;
    } else if (m[1][1] > m[2][2]) {
        const s = Math.sqrt(1 + m[1][1] - m[0][0] - m[2][2]) * 2;
        w = (m[0][2] - m[2][0]) / s;
        x = (m[0][1] + m[1][0]) / s;
        y = 0.25 * s;
        z = (m[1][2] + m[2][1]) / s;
    } else {
        const s = Math.sqrt(1 + m[2][2] - m[0][0] - m[1][1]) * 2;
        w = (m[1][0] - m[0][1]) / s;
        x = (m[0][2] + m[2][0]) / s;
        y = (m[1][2] + m[2][1]) / s;
        z = 0.25 * s;
    }
    return [x, y, z, w];
}

async function groundAt(x, y) {
    const high = await call("wb_raycast", { origin: [x, y, 400], direction: [0, 0, -1], distance: 500 });
    if (!high.hit) throw new Error(`no ground at ${x},${y}`);
    // From just above what the first ray found, so that a roof or a crown above does not count.
    const low = await call("wb_raycast", { origin: [x, y, high.position[2] + 1.2], direction: [0, 0, -1], distance: 6 });
    return { z: low.hit ? low.position[2] : high.position[2], name: low.hit ? low.name : high.name };
}

export async function placeBoard(name, x, y, yawDeg, options = {}) {
    const yaw = (yawDeg * Math.PI) / 180;
    const F = [Math.cos(yaw), Math.sin(yaw), 0];
    const L = [-Math.sin(yaw), Math.cos(yaw), 0];
    const at = (u, v) => [x + L[0] * u + F[0] * v, y + L[1] * u + F[1] * v];
    // The ground under the board's four corners and its middle.
    const samples = [];
    for (const [u, v] of [[0, 0], [-1.1, 0], [1.1, 0], [-1.1, 0.5], [1.1, 0.5], [0, 0.7]]) {
        const [sx, sy] = at(u, v);
        samples.push(await groundAt(sx, sy));
    }
    const zs = samples.map((one) => one.z);
    const lo = Math.min(...zs);
    const hi = Math.max(...zs);
    const names = [...new Set(samples.map((one) => one.name))];
    console.log(`${name}: ground ${lo.toFixed(2)}..${hi.toFixed(2)} (${names.join(",")})`);

    const group = `quadro-${name}`;
    const parts = [];
    const quatYaw = quatFromColumns(F, L, [0, 0, 1]);
    // `centre` is where the piece's box middle goes (local u across, v out, w above the ground's highest point `hi`).
    const piece = (kind, u, v, wAbs, scale, physics, rotation = quatYaw, local = null) => {
        const box = BOX[kind];
        const s = scale;
        // From the pivot to the box middle, in the piece's own axes.
        const cxl = (box.size[0] / 2 - box.pivot[0]) * s;
        const cyl = (box.size[1] / 2 - box.pivot[1]) * s;
        const czl = (box.size[2] / 2 - box.pivot[2]) * s;
        const [bx, by] = at(u, v);
        // The piece's local X goes to F and Y to L when it is turned by `quatYaw`; a pinned paper has its own turn (`local` = its columns).
        const colX = local ? local[0] : F;
        const colY = local ? local[1] : L;
        const colZ = local ? local[2] : [0, 0, 1];
        const px = bx - (colX[0] * cxl + colY[0] * cyl + colZ[0] * czl);
        const py = by - (colX[1] * cxl + colY[1] * cyl + colZ[1] * czl);
        const pz = wAbs - (colX[2] * cxl + colY[2] * cyl + colZ[2] * czl);
        parts.push({ model: MODELS[kind], position: [px, py, pz], rotation, scale: [s, s, s], physics });
    };

    // The board: horizontal rough planks stacked, each turned so that its wide face looks out (X up, Y across, Z into the board), a hair staggered.
    const plankScale = options.plankScale ?? 0.9;
    const plankW = BOX.roof.size[1] * plankScale;
    const plankH = BOX.roof.size[0] * plankScale * 0.93;
    const planks = options.planks ?? 4;
    const panelW = plankW;
    const panelH = plankH * planks + BOX.roof.size[0] * plankScale * 0.07;
    const panelBottom = hi + 0.55;
    const plankCols = [[0, 0, 1], L, [-F[0], -F[1], 0]];
    const plankQuat = quatFromColumns(plankCols[0], plankCols[1], plankCols[2]);
    for (let index = 0; index < planks; index += 1) {
        const stagger = index % 2 === 0 ? 0.03 : -0.03;
        piece("roof", stagger, 0, panelBottom + plankH * (index + 0.5) + 0.02, plankScale, "static", plankQuat, plankCols);
    }
    // The posts at the sides, a little behind the face; from under the lowest ground to above the panels.
    const postTop = panelBottom + panelH + 0.25;
    const postBottom = lo - 0.3;
    const postScale = (postTop - postBottom) / BOX.post.size[2];
    for (const side of [-1, 1]) {
        piece("post", side * (panelW / 2 + 0.14), -0.02, (postTop + postBottom) / 2, postScale, "static");
    }
    // A rough plank across the top as a little roof.
    const roofScale = 1.25;
    piece("roof", 0, 0.02, postTop + (BOX.roof.size[2] * roofScale) / 2, roofScale, "static");

    // The face: letters and parchments pinned on, a little turned. Columns of a paper's rotation: its X across, Y up, Z out of the board.
    const panelFront = (BOX.roof.size[2] * plankScale) / 2;
    const wTop = panelBottom + panelH;
    // [kind, u across, centre this far below the top of the panels, roll in degrees]
    const pins = [
        ["parchment", -0.62, 0.27, 4],
        ["paper_a", -0.2, 0.22, -3],
        ["letter", 0.26, 0.28, 6],
        ["parchment", 0.66, 0.3, -5],
        ["letter", -0.55, 0.78, -4],
        ["parchment", -0.02, 0.8, 3],
        ["paper_b", 0.5, 0.84, -6],
        ["paper_a", -0.28, 1.12, 5],
    ];
    for (const [kind, u, below, rollDeg] of pins) {
        const roll = (rollDeg * Math.PI) / 180;
        const across = [L[0] * Math.cos(roll), L[1] * Math.cos(roll), Math.sin(roll)];
        const up = [-L[0] * Math.sin(roll), -L[1] * Math.sin(roll), Math.cos(roll)];
        const out = F;
        // The paper's back lies a hair off the planks.
        piece(kind, u, panelFront + 0.004 + BOX[kind].size[2] / 2, wTop - below, 1, "none", quatFromColumns(across, up, out), [across, up, out]);
    }

    // The marker, a little in front of the board's foot and under the ground.
    {
        const [mx, my] = at(0, 0.7);
        const under = await groundAt(mx, my);
        parts.push({ model: MODELS.marker, position: [mx, my, under.z - 0.45], rotation: quatYaw, scale: [1, 1, 1], physics: "none" });
    }

    const ids = [];
    for (const part of parts) {
        const made = await edit("wb_props_create", { ...part, group });
        ids.push(made.id ?? made.objectId ?? made.ids?.[0]);
    }
    store[name] = { x, y, yaw: yawDeg, z: hi, ids };
    save();
    console.log(`${name}: ${ids.length} pieces, ground ${hi.toFixed(2)}`);
}

export async function clearBoard(name) {
    const entry = store[name];
    if (!entry) return console.log(`${name}: nothing to clear`);
    await edit("wb_objects_delete", { ids: entry.ids });
    delete store[name];
    save();
    console.log(`${name}: cleared`);
}

if (process.argv[1] && process.argv[1].endsWith("board.mjs")) {
    const [name, x, y, yaw, flag] = process.argv.slice(2);
    if (flag === "--clear" || x === "--clear") {
        await clearBoard(name);
    } else {
        if (store[name]) await clearBoard(name);
        await placeBoard(name, Number(x), Number(y), Number(yaw));
    }
}
