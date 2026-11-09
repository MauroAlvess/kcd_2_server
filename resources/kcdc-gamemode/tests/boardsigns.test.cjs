"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

// The picture over each notice board (src/server/board-signs.ts, the shipped mesh and texture of stream/, tools/make-board-sign.py; 2026-11-09): where it stands, how it is put up, and that the files the game is to
// load are the ones the tool says (their chunks, the material's name, the texture's header).

const plain = (value) => JSON.parse(JSON.stringify(value));
const GM = path.join(__dirname, "..");
const MODEL = "objects/kcdc/kcdc-gamemode/quadro_aviso.cgf";

function run(file, requires, globals = {}) {
    const context = { exports: {}, require: (id) => requires[id] ?? assert.fail(`unexpected require ${id} in ${file}`), console: { log: (line) => globals.logs?.push(line) }, Date, JSON, Object, Number, Set, Map, Math, Array, String, ...globals.extra };
    vm.runInNewContext(fs.readFileSync(path.join(GM, "dist/server", file), "utf8"), context);
    return context.exports;
}

class Vector3 {
    constructor(x, y, z) { this.x = x; this.y = y; this.z = z; }
}

function load({ ready = true, refuse = 0 } = {}) {
    const logs = [];
    const state = { spawned: [], destroyed: 0, timers: [], cleared: 0, once: new Map(), on: new Map(), refuse };
    const reach = run("reach.js", {});
    const places = run("mural-places.js", { "./reach.js": reach, "./level.js": { onKuttenberg: () => false } }, { logs, extra: { WorldResource: { ready: true, all: () => [] }, Events: { once() {} } } });
    const signs = run("board-signs.js", { "./mural-places.js": places }, {
        logs,
        extra: {
            Vector3,
            Prop: {
                spawn: (model, position, rotation, scale, physics) => {
                    if (state.refuse > 0) {
                        state.refuse -= 1;
                        throw new Error("the model is not in the catalog");
                    }
                    const prop = { model, position, rotation, scale, physics, destroy() { state.destroyed += 1; } };
                    state.spawned.push(prop);
                    return prop;
                },
            },
            WorldResource: { ready },
            Events: { once: (name, fn) => state.once.set(name, fn), on: (name, fn) => state.on.set(name, fn) },
            setTimeout: (fn, ms) => { state.timers.push({ fn, ms }); return state.timers.length; },
            clearTimeout: () => { state.cleared += 1; },
        },
    });
    return { signs, places, state, logs };
}

const marker = (x, y, z, yawDeg = 0) => {
    const half = (yawDeg * Math.PI) / 360;
    return { model: "objects/manmade/task_specific_props/read_and_write/scrolls/scroll_c.cgf", position: { x, y, z }, rotation: { w: Math.cos(half), x: 0, y: 0, z: Math.sin(half) } };
};
const plank = (x, y, z) => ({ model: "objects/manmade/task_specific_props/construction/plank_rough_a.cgf", position: { x, y, z }, rotation: { w: 1, x: 0, y: 0, z: 0 } });

test("a board knows the way it faces (its marker's turn) and where its top is (its highest plank), and the picture stands over its middle, turned as it is", () => {
    const { signs, places } = load();
    // A board at Semine facing +Y (a quarter turn): its marker is 0.66 m in front of the face, so the middle of the board is 0.66 m back, on -Y.
    const props = [marker(1500, 1580, 70, 90), plank(1500, 1579.34, 71), plank(1500.2, 1579.3, 72.3), plank(1500, 1579.3, 72.7), plank(2000, 1580, 99)];
    const [board] = places.boardsOf(props);
    assert.equal(board.id, "semine");
    assert.ok(Math.abs(board.yaw - Math.PI / 2) < 1e-9);
    assert.ok(Math.abs(board.top - 72.75) < 1e-9, "the highest plank near the marker, and its thickness; the plank 500 m away is no part of it");
    const pose = signs.signPose(board);
    assert.ok(Math.abs(pose.x - 1500) < 1e-9 && Math.abs(pose.y - (1580 - 0.66)) < 1e-9, "over the board's middle");
    assert.ok(Math.abs(pose.yawDeg - 90) < 1e-9);
    assert.ok(Math.abs(pose.z - (72.75 + 0.3 + 1.1)) < 1e-9, "its bottom edge a hand above the top, half its height up to the middle");
});

test("a marker with no turn and no planks is a board facing +X with the picture a fixed height over the ground in front of it", () => {
    const { signs, places } = load();
    const [board] = places.boardsOf([{ model: "objects/manmade/task_specific_props/read_and_write/scrolls/scroll_c.cgf", position: { x: 1500, y: 1580, z: 70 } }]);
    assert.equal(board.yaw, 0);
    assert.equal(board.top, undefined);
    const pose = signs.signPose(board);
    assert.ok(Math.abs(pose.x - (1500 - 0.66)) < 1e-9 && pose.y === 1580);
    assert.ok(Math.abs(pose.z - (70.45 + 2.4 + 0.3 + 1.1)) < 1e-9);
    // A prop whose turn is Euler degrees (a Vector3) is read too.
    const [euler] = places.boardsOf([{ model: "objects/manmade/task_specific_props/read_and_write/scrolls/scroll_c.cgf", position: { x: 1500, y: 1580, z: 70 }, rotation: { x: 0, y: 0, z: 180 } }]);
    assert.ok(Math.abs(euler.yaw - Math.PI) < 1e-9);
});

test("the pictures are put up as props of the shipped mesh: no physics, the size as the scale, one over each board, and the old ones taken down first", () => {
    const { signs, places, state } = load();
    const boards = places.boardsOf([marker(1500, 1580, 70, 90), marker(1760, 1960, 41, 0)]);
    const first = signs.placeSigns(boards);
    assert.deepEqual(plain(first), { placed: 2, refused: 0 });
    assert.equal(state.spawned.length, 2);
    for (const prop of state.spawned) {
        assert.equal(prop.model, MODEL);
        assert.equal(prop.physics, "none");
        assert.equal(prop.scale, signs.signSettings.sizeM);
    }
    assert.ok(Math.abs(state.spawned[0].rotation.z - 90) < 1e-9, "turned as the board is, in Euler degrees about the vertical");
    assert.equal(state.spawned[0].rotation.x, 0);
    signs.placeSigns(boards);
    assert.equal(state.destroyed, 2, "the earlier two were taken down");
    assert.equal(state.spawned.length, 4);
    assert.equal(signs.clearSigns(), 2);
    assert.equal(state.destroyed, 4);
});

test("a model the game does not accept (the assets not built yet) is counted, logged once, and tried again later, a few times", () => {
    const { signs, places, state, logs } = load({ ready: true, refuse: 2 });
    const boards = places.boardsOf([marker(1500, 1580, 70), marker(1760, 1960, 41)]);
    places.setBoards(boards);
    signs.installBoardSigns();
    assert.equal(state.timers.length, 1, "waits for the assets to be built");
    assert.equal(state.timers[0].ms, signs.signSettings.delayMs);
    state.timers.shift().fn();
    assert.equal(state.spawned.length, 0);
    assert.equal(logs.filter((line) => /não aceitou/.test(line)).length, 1, "said once");
    assert.ok(logs.some((line) => /0 figura\(s\).*sobre 2 quadro\(s\); 2 recusada/.test(line)));
    assert.equal(state.timers.length, 1, "and tried again");
    assert.equal(state.timers[0].ms, signs.signSettings.retryMs);
    state.timers.shift().fn();
    assert.equal(state.spawned.length, 2, "the second time they went up");
    assert.equal(state.timers.length, 0, "and no more tries");
});

test("with no board known nothing is put up and the log says so; the pictures go with the resource; when the exports are not loaded yet it waits for them", () => {
    const empty = load();
    empty.signs.installBoardSigns();
    empty.state.timers.shift().fn();
    assert.equal(empty.state.spawned.length, 0);
    assert.ok(empty.logs.some((line) => /nenhum quadro de avisos conhecido/.test(line)));

    const waiting = load({ ready: false });
    waiting.places.setBoards(waiting.places.boardsOf([marker(1500, 1580, 70)]));
    waiting.signs.installBoardSigns();
    assert.equal(waiting.state.timers.length, 0, "nothing before the exports are loaded");
    waiting.state.once.get("worldResourcesReady")();
    waiting.state.timers.shift().fn();
    assert.equal(waiting.state.spawned.length, 1);
    waiting.state.on.get("resourceStop")("outro-recurso");
    assert.equal(waiting.state.destroyed, 0, "another resource's stop leaves them");
    waiting.state.on.get("resourceStop")("kcdc-gamemode");
    assert.equal(waiting.state.destroyed, 1);
});

test("on the user's boards of Trosky the picture stands over each board: over the middle of its pieces, above its top, facing the way the board does", (context) => {
    const file = path.join(GM, "../../worlds/quadros-trosky.world.json");
    if (!fs.existsSync(file)) {
        context.skip("the worlds folder is not beside the gamemode (the staging copy)");
        return;
    }
    const { signs, places } = load();
    const world = JSON.parse(fs.readFileSync(file, "utf8"));
    const props = world.objects.map((one) => ({ model: one.model, position: { x: one.position[0], y: one.position[1], z: one.position[2] }, rotation: { x: one.rotation[0], y: one.rotation[1], z: one.rotation[2], w: one.rotation[3] } }));
    const boards = places.boardsOf(props);
    assert.equal(boards.length, 11);
    for (const board of boards) {
        const pose = signs.signPose(board);
        const pieces = props.filter((one) => /plank_rough_a|fence_rural_post_a/.test(one.model) && Math.hypot(one.position.x - board.x, one.position.y - board.y) < 4);
        assert.equal(pieces.length, 7, `${board.id}: the board's seven posts and planks`);
        const cx = pieces.reduce((sum, one) => sum + one.position.x, 0) / pieces.length;
        const cy = pieces.reduce((sum, one) => sum + one.position.y, 0) / pieces.length;
        assert.ok(Math.hypot(pose.x - cx, pose.y - cy) < 0.25, `${board.id}: over the middle of the board (${Math.hypot(pose.x - cx, pose.y - cy).toFixed(2)} m off)`);
        const highest = Math.max(...pieces.filter((one) => /plank/.test(one.model)).map((one) => one.position.z));
        assert.ok(pose.z - signs.signSettings.sizeM / 2 > highest + 0.2, `${board.id}: the picture's bottom is above the board's top`);
        assert.ok(pose.z - signs.signSettings.sizeM / 2 < highest + 0.5, `${board.id}: and not far above it`);
        assert.ok(board.top !== undefined && Math.abs(board.top - (highest + 0.05)) < 1e-9, `${board.id}: the top is the highest plank's`);
    }
});

// ---------------------------------------------------------------------------------------------
// The files the game is to load.

const STREAM = path.join(GM, "stream");
const OBJECTS = path.join(STREAM, "objects", "kcdc", "kcdc-gamemode");
const TEXTURES = path.join(STREAM, "textures", "kcdc", "kcdc-gamemode");

function chunks(data) {
    assert.equal(data.subarray(0, 4).toString("latin1"), "CrCh");
    assert.equal(data.readUInt32LE(4), 0x746);
    const count = data.readUInt32LE(8);
    const table = data.readUInt32LE(12);
    return Array.from({ length: count }, (_, n) => {
        const at = table + 16 * n;
        return { type: data.readUInt16LE(at), version: data.readUInt16LE(at + 2), id: data.readUInt32LE(at + 4), size: data.readUInt32LE(at + 8), offset: data.readUInt32LE(at + 12) };
    });
}

test("the shipped mesh is the game's plane with our four corners: a metre square standing up, its front toward +X, the name of our material in both files, every chunk where its table says", () => {
    for (const name of ["quadro_aviso.cgf", "quadro_aviso.cgfm"]) {
        const data = fs.readFileSync(path.join(OBJECTS, name));
        const list = chunks(data);
        for (const c of list) assert.ok(c.offset + c.size <= data.length, `${name}: chunk ${c.id} inside the file`);
        const material = list.find((c) => c.type === 0x1014);
        assert.equal(data.subarray(material.offset, material.offset + 128).toString("latin1").replace(/\0+$/, ""), "objects/kcdc/kcdc-gamemode/quadro_aviso", name);
        const mesh = list.find((c) => c.type === 0x1000);
        const body = data.subarray(mesh.offset, mesh.offset + mesh.size);
        const box = Buffer.alloc(24);
        [0, -0.5, -0.5, 0, 0.5, 0.5].forEach((value, n) => box.writeFloatLE(value, n * 4));
        assert.ok(body.includes(box), `${name}: the bounding box is the square's`);
    }
    const mesh = fs.readFileSync(path.join(OBJECTS, "quadro_aviso.cgfm"));
    const streams = chunks(mesh).filter((c) => c.type === 0x1016);
    const vertices = streams.find((c) => mesh.readUInt32LE(c.offset + 4) === 15);
    assert.equal(mesh.readUInt32LE(vertices.offset + 8), 4);
    const half = (at) => {
        const bits = mesh.readUInt16LE(at);
        const sign = bits & 0x8000 ? -1 : 1;
        const exponent = (bits >> 10) & 31;
        const fraction = bits & 1023;
        return exponent === 0 ? sign * 2 ** -14 * (fraction / 1024) : sign * 2 ** (exponent - 15) * (1 + fraction / 1024);
    };
    const corners = [0, 1, 2, 3].map((n) => { const at = vertices.offset + 24 + n * 16; return { x: half(at), y: half(at + 2), z: half(at + 4), w: half(at + 6), u: half(at + 12), v: half(at + 14) }; });
    assert.deepEqual(corners, [{ x: 0, y: -0.5, z: -0.5, w: 1, u: 0, v: 1 }, { x: 0, y: 0.5, z: -0.5, w: 1, u: 1, v: 1 }, { x: 0, y: 0.5, z: 0.5, w: 1, u: 1, v: 0 }, { x: 0, y: -0.5, z: 0.5, w: 1, u: 0, v: 0 }]);
    // Seen from +X (the front) the corners run counter-clockwise: right is +Y, up is +Z.
    const [a, b, c2] = corners;
    const cross = (b.y - a.y) * (c2.z - a.z) - (b.z - a.z) * (c2.y - a.y);
    assert.ok(cross > 0, "counter-clockwise from the front");
});

test("the material is the game's two-sided alpha-tested one with our texture (as diffuse and as the glow), named by the path the engine looks it up by", () => {
    const text = fs.readFileSync(path.join(OBJECTS, "quadro_aviso.mtl"), "latin1");
    assert.match(text, /<Material [^>]*AlphaTest="0\.5"/);
    assert.match(text, /MtlFlags="524290"/, "two-sided, as the game's");
    assert.match(text, /Shader="Illum"/);
    const paths = [...text.matchAll(/<Texture File="([^"]+)" Map="([A-Za-z]+)"/g)].map((match) => [match[1], match[2]]);
    assert.deepEqual(paths, [["textures/kcdc/kcdc-gamemode/quadro_aviso_diff.dds", "Diffuse"], ["textures/kcdc/kcdc-gamemode/quadro_aviso_diff.dds", "Emittance"]]);
    assert.ok(fs.existsSync(path.join(STREAM, paths[0][0])), "the texture the material names is shipped");
});

test("the texture is made as the game's own: a DX10 DDS of BC3 (sRGB) with the CryEngine extension, the four smallest mips in the main file and one split file for each bigger one", () => {
    const main = fs.readFileSync(path.join(TEXTURES, "quadro_aviso_diff.dds"));
    assert.equal(main.subarray(0, 4).toString("latin1"), "DDS ");
    const word = (at) => main.readUInt32LE(at);
    assert.deepEqual([word(4), word(8), word(12), word(16), word(28)], [124, 0x21007, 512, 512, 8], "size, flags, height, width, mips");
    assert.equal(word(36), 0x200800, "the game's flags: read as sRGB");
    assert.equal(main.subarray(84, 88).toString("latin1"), "DX10");
    assert.deepEqual([word(108), word(116), word(124)], [0x401008, 4, 0x43525946], "caps, the four persistent mips, CRYF");
    assert.deepEqual([word(128), word(132)], [78, 3], "BC3_UNORM_SRGB, a 2D texture");
    assert.equal(main.length, 148 + 1024 + 256 + 64 + 16, "the mips of 32, 16, 8 and 4 texels");
    for (const [number, side] of [[1, 64], [2, 128], [3, 256], [4, 512]]) {
        const split = fs.readFileSync(path.join(TEXTURES, `quadro_aviso_diff.dds.${number}`));
        assert.equal(split.length, (side / 4) * (side / 4) * 16, `.${number} is the ${side} texel mip`);
    }
    assert.ok(!fs.existsSync(path.join(TEXTURES, "quadro_aviso_diff.dds.5")), "no more than the four");
});

test("the assets sit where the server ships them from: under stream/<kind>/kcdc/<the resource's own name>/, lowercase, no dots in a folder name, a name the manifest agrees with", () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(GM, "package.json"), "utf8"));
    assert.equal(manifest.name, "kcdc-gamemode");
    assert.match(manifest.name, /^[a-z0-9_-]{1,64}$/);
    const files = [];
    const walk = (dir) => { for (const entry of fs.readdirSync(dir, { withFileTypes: true })) { const full = path.join(dir, entry.name); if (entry.isDirectory()) walk(full); else files.push(path.relative(STREAM, full).split(path.sep).join("/")); } };
    walk(STREAM);
    assert.equal(files.length, 8);
    for (const file of files) {
        assert.match(file, /^(objects|textures)\/kcdc\/kcdc-gamemode\/[a-z0-9_]+\.(cgf|cgfm|mtl|dds(\.[1-4])?)$/, file);
        assert.ok(file.length <= 240);
    }
    const listed = (manifest.mafiahub && manifest.mafiahub.files) || [];
    assert.ok(!listed.some((glob) => /stream/.test(glob)), "the asset folders travel on their own: they are not in mafiahub.files");
});
