"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

// The level's own objects taken out of the world (src/server/level-edits.ts): Malešov's front gate on a fresh server, what
// /objeto takes out or puts back, kept on disk and applied again at every boot.

function fakeDisk(files = new Map()) {
    return {
        files,
        fs: {
            readFileSync(file) {
                if (!files.has(file)) throw new Error("ENOENT");
                return files.get(file);
            },
            writeFileSync(file, data) { files.set(file, data); },
            mkdirSync() {},
            renameSync(from, to) {
                files.set(to, files.get(from));
                files.delete(from);
            },
            existsSync: (file) => files.has(file),
        },
    };
}

/** A brush taken out is hidden and put 300 m under its place, tiny (2026-10-27: the game kept the collision of a hidden brush; "essa ideia de jogar embaixo da terra foi top"). */
const sunk = (definition) => ({ ...definition, position: { x: definition.at.x, y: definition.at.y, z: definition.at.z - 300 }, scale: { x: 0.01, y: 0.01, z: 0.01 } });

/** What the server takes out for good wherever the list stands (the invisible walls of the gates): not what the tests below count. */
const walls = (applied) => applied.filter((definition) => /clipvolume/.test(definition.name));
const others = (applied) => applied.filter((definition) => !/clipvolume/.test(definition.name));

function load(files = new Map(), worlds = [], worldApi = undefined) {
    const disk = fakeDisk(files);
    const storeSandbox = { exports: {}, require: () => disk.fs };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/store.js"), "utf8"), storeSandbox);
    const state = { applied: [], restored: [], logs: [], refuse: false };
    class Vector3 {
        constructor(x, y, z) { this.x = x; this.y = y; this.z = z; }
    }
    const context = {
        exports: {},
        require: (id) => (id === "./store.js" ? storeSandbox.exports : assert.fail(`unexpected require ${id}`)),
        console: { log: (line) => state.logs.push(line), error: (line) => state.logs.push(line) },
        Date,
        JSON,
        Vector3,
        World: worldApi,
        // The world exports the server has loaded, each with the level edits it holds (`LevelEdit.toJSON`).
        WorldResource: { ready: true, all: () => worlds.map((levelEdits) => ({ levelEdits: levelEdits.map((definition) => ({ toJSON: () => definition })) })) },
        LevelEdit: {
            apply: (definition) => {
                if (state.refuse) throw new Error("no");
                const edit = { definition: JSON.parse(JSON.stringify(definition)), restore() { state.restored.push(this.definition); } };
                state.applied.push(edit.definition);
                return edit;
            },
        },
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/level-edits.js"), "utf8"), context);
    return { api: context.exports, state, files: disk.files, saved: () => JSON.parse(disk.files.get("playerdata/level-edits.json")) };
}

test("a server with no list takes out the left leaf of Malešov's front gate, where the KCDC guide puts it, and keeps the list", () => {
    const sut = load();
    sut.api.installLevelEdits();
    assert.deepEqual(others(sut.state.applied), [sunk({ kind: "brush", name: "objects/manmade/structures/logistical/gate/gate_beams_a_door_left.cgf", at: { x: 490.09, y: 398.59, z: 109.8 }, hidden: true })], "Malešov's leaf is hidden and put under the ground");
    assert.equal(sut.saved().length, 1);
    assert.ok(sut.state.logs.some((line) => /1 de 1 objeto\(s\) do mapa tirado\(s\) do mundo: Portão de Malešov, folha esquerda/.test(line)));
});

test("the World Builder's copied line, or a mesh and three numbers, names a brush; sixteen hex digits name an entity", () => {
    const sut = load();
    const pasted = 'LevelEdit.apply({ name: "objects/manmade/structures/logistical/gate/gate_beams_a_door_right.cgf", at: new Vector3(492.31, 396.2, 109.8), hidden: true });';
    assert.deepEqual(JSON.parse(JSON.stringify(sut.api.parseObject(pasted))), { name: "objects/manmade/structures/logistical/gate/gate_beams_a_door_right.cgf", guid: "", at: [492.31, 396.2, 109.8] });
    assert.deepEqual(JSON.parse(JSON.stringify(sut.api.parseObject("Objects/Manmade/Fence.CGF 1 -2.5 3"))).at, [1, -2.5, 3]);
    assert.equal(sut.api.parseObject("objects/fence.cgf 1 2"), null, "three numbers or nothing");
    assert.deepEqual(JSON.parse(JSON.stringify(sut.api.parseObject("a28649d6-5e05-4906"))), { name: "", guid: "a28649d65e054906", at: [0, 0, 0] });
    assert.equal(sut.api.parseObject("portão"), null);
});

test("/objeto esconder takes an object out for everybody and keeps it for the next boot; devolver puts it back", () => {
    const sut = load();
    sut.api.installLevelEdits();
    const hidden = sut.api.hideObject("objects/manmade/structures/logistical/gate/gate_beams_a_door_right.cgf 492.31 396.2 109.8", "", "Radovan");
    assert.equal(hidden.ok, true);
    assert.match(hidden.message, /gate_beams_a_door_right\.cgf saiu do mapa para todos \(nº 2\)/);
    assert.equal(others(sut.state.applied).length, 2);
    assert.equal(sut.api.hideObject("objects/manmade/structures/logistical/gate/gate_beams_a_door_right.cgf 492.31 396.20 109.80", "", "Radovan").message.includes("já estava"), true, "the same object twice is one edit");
    assert.equal(sut.api.listObjects().length, 2);

    const reboot = load(sut.files);
    reboot.api.installLevelEdits();
    assert.equal(others(reboot.state.applied).length, 2, "both again after a restart");

    const back = reboot.api.restoreObject(1, "Radovan");
    assert.equal(back.ok, true);
    assert.equal(reboot.state.restored.length, 1);
    assert.deepEqual(Array.from(reboot.saved(), (edit) => edit.name), ["objects/manmade/structures/logistical/gate/gate_beams_a_door_right.cgf"]);
    assert.equal(reboot.api.restoreObject(5, "Radovan").ok, false);
});

test("a list that cannot be read applies nothing and is not written over", () => {
    const files = new Map([["playerdata/level-edits.json", "{ nope"]]);
    const sut = load(files);
    sut.api.installLevelEdits();
    assert.deepEqual(others(sut.state.applied), []);
    assert.equal(files.get("playerdata/level-edits.json"), "{ nope");
});

test("the invisible wall of Raborsch's gate is taken out on every boot, by its short and its long path, and is not in the list", () => {
    const sut = load();
    sut.api.installLevelEdits();
    assert.deepEqual(walls(sut.state.applied), [
        sunk({ kind: "brush", name: "brush/clipvolume_381.cgf", at: { x: 1421.851, y: 3856.331, z: 118.024 }, hidden: true }),
        sunk({ kind: "brush", name: "levels/kutnohorsko/brush/clipvolume_381.cgf", at: { x: 1421.851, y: 3856.331, z: 118.024 }, hidden: true }),
    ]);
    assert.equal(sut.saved().some((edit) => /clipvolume/.test(edit.name)), false, "the walls are the server's, not an administrator's line");
    assert.ok(sut.state.logs.some((line) => /parede\(s\) invisível\(is\) de portão tirada\(s\)/.test(line)));
    assert.equal(sut.api.applyEnsured(), 0, "asked again, nothing is applied twice");
});

test("a world export that already takes the wall out keeps it, and the server leaves it alone (two resources on one object stop the server)", () => {
    const held = { kind: "brush", name: "brush/clipvolume_381.cgf", at: [1421.86, 3856.33, 118.02], hidden: true };
    const sut = load(new Map(), [[held]]);
    sut.api.installLevelEdits();
    assert.deepEqual(walls(sut.state.applied), []);
    assert.ok(sut.state.logs.some((line) => /já sai do mapa por um mundo exportado/.test(line)));

    const elsewhere = load(new Map(), [[{ kind: "brush", name: "brush/clipvolume_381.cgf", at: [10, 20, 30], hidden: true }]]);
    elsewhere.api.installLevelEdits();
    assert.equal(walls(elsewhere.state.applied).length, 2, "the same mesh somewhere else is another object");
});

test("a hit of a probe reads as a line: what it is, its names, the distance and the place", () => {
    const sut = load();
    const line = sut.api.describeHit({ kind: "entity", model: null, entityGuid: "a28649d65e054906", entityName: "designer_760d6cd0", entityClass: "GeomEntity", surface: "mat_nodraw_designer", distance: 3.04, position: { x: 1421.9, y: 3856.3, z: 119.1 } });
    assert.match(line, /^entity \(mat_nodraw_designer\): GeomEntity · designer_760d6cd0 · guid a28649d65e054906 · a 3\.0 m, em 1421\.90 3856\.30 119\.10$/);
    const bare = sut.api.describeHit({ kind: "static", model: null, entityGuid: null, entityName: null, entityClass: null, surface: "", distance: 1, position: { x: 0, y: 0, z: 0 } });
    assert.equal(bare, "static (?): sem nome · a 1.0 m, em 0.00 0.00 0.00");
});

// The wall hunt (/objeto parede, 2026-10-27: "na entrada do castelo de Malešov há uma parede invisível"): the player's own game traces a
// ring of rays and lists the entities near, and what is only collision is taken out for everybody.

const DESIGNER = "levels/kutnohorsko/Brush/designer_8a3c1f10-52aa-4b0e-9d3b-0c7d4f5e6a77.cgf";
const hitOf = (fields) => ({ position: { x: 497.2, y: 403.8, z: 108.9 }, kind: "brush", model: null, surface: "mat_rock", entityClass: null, entityGuid: null, entityName: null, distance: 1.2, levelObject: null, ...fields });
const brushObject = (name, at = { x: 497.6, y: 404.0, z: 108.7 }) => ({ kind: "brush", name, at });

test("a hit is judged for a wall hunt: collision-only brushes and blocker entities go, anything with a picture or a use stays", () => {
    const sut = load();
    const judge = (fields) => JSON.parse(JSON.stringify(sut.api.judgeHit(hitOf(fields))));
    assert.deepEqual(judge({ levelObject: brushObject(DESIGNER) }), { act: "hide", object: { kind: "brush", name: DESIGNER, guid: "", at: [497.6, 404, 108.7] } });
    assert.equal(judge({ levelObject: brushObject("brush/clipvolume_465.cgf") }).act, "hide");
    assert.equal(judge({ levelObject: brushObject("objects/manmade/structures/defensive/wall_a.cgf") }).act, "leave", "a wall with a picture is not hidden");
    assert.equal(judge({ levelObject: brushObject("objects/manmade/structures/defensive/wall_a.cgf"), surface: "mat_nodraw" }).act, "hide", "a surface that is never drawn is");
    for (const surface of ["mat_level_barrier", "mat_nodraw_designer"]) {
        assert.equal(judge({ levelObject: brushObject("objects/manmade/structures/defensive/wall_a.cgf"), surface }).act, "hide", `${surface} is what the designers' two collision materials are made of (read out of the game's materials, 2026-10-27)`);
    }
    assert.equal(judge({ kind: "vegetation", levelObject: brushObject("objects/natural/vegetation/trees/oak.cgf") }).act, "leave");
    const blocker = { kind: "entity", name: "designer_760d6cd0", guid: "a28649d65e054906", class: "GeomEntity", at: { x: 1, y: 2, z: 3 } };
    assert.deepEqual(judge({ kind: "entity", entityClass: "GeomEntity", levelObject: blocker }), { act: "hide", object: { kind: "entity", name: "designer_760d6cd0", guid: "a28649d65e054906", at: [1, 2, 3] } });
    assert.equal(judge({ kind: "entity", entityClass: "AnimDoor", levelObject: { ...blocker, name: "designer_door" } }).act, "leave", "a door is never a wall");
    assert.equal(judge({ kind: "entity", entityClass: "GeomEntity", levelObject: { ...blocker, name: "barrel_12" } }).act, "leave");
    assert.equal(judge({ kind: "entity", entityClass: "GeomEntity", levelObject: { ...blocker, guid: "" } }).act, "leave", "no guid, nothing to find it by");
    assert.equal(judge({ kind: "static" }).act, "unnamed");
    assert.equal(judge({ kind: "terrain" }).act, "leave");
});

function wallWorld({ hits = [], entities = [], answered = true } = {}) {
    const rays = [];
    return {
        rays,
        raycastAll: async (_player, from, to, options) => {
            rays.push({ from, to, options });
            return { answered, reason: answered ? "" : "sem mundo", hit: null, hits: rays.length === 1 ? hits : [] };
        },
        entitiesInRadius: async () => ({ answered, reason: answered ? "" : "sem mundo", entities }),
    };
}

const standing = { nickname: "Patrik", position: { x: 497.0, y: 403.0, z: 108.7 }, lookDirection: { x: 0.6, y: 0.8, z: 0 } };

test("/objeto parede takes out the collision-only things around the player, keeps them in the list, and leaves what has a picture", async () => {
    const world = wallWorld({
        hits: [hitOf({ levelObject: brushObject(DESIGNER) }), hitOf({ levelObject: brushObject("objects/manmade/structures/defensive/wall_a.cgf"), distance: 2 }), hitOf({ kind: "static", position: { x: 495.55, y: 402.1, z: 109.3 }, distance: 2.6 })],
        entities: [{ position: { x: 496.0, y: 401.0, z: 109 }, distance: 2.1, guid: "a28649d65e054906", name: "designer_760d6cd0", class: "GeomEntity", physicalized: true }, { position: { x: 498, y: 403, z: 108.8 }, distance: 1, guid: "1111222233334444", name: "barrel_12", class: "GeomEntity", physicalized: true }],
    });
    const sut = load(new Map(), [], world);
    sut.api.installLevelEdits();
    const before = sut.state.applied.length;
    const lines = await sut.api.hideWallsAround(standing, "Patrik");
    const hidden = sut.state.applied.slice(before).map((definition) => definition);
    assert.deepEqual(hidden, [
        sunk({ kind: "brush", name: DESIGNER, at: { x: 497.6, y: 404, z: 108.7 }, hidden: true }),
        { kind: "entity", guid: "a28649d65e054906", at: { x: 496, y: 401, z: 109 }, hidden: true },
    ]);
    assert.match(lines[0], /^Tirei 2 parede\(s\) invisível\(is\) do mapa/);
    assert.ok(lines.some((line) => /Geometria sem nome no mapa .*495\.55 402\.10 109\.30/.test(line)));
    assert.ok(lines.some((line) => /Deixei 1 coisa\(s\) com desenho/.test(line)));
    const saved = sut.saved();
    assert.equal(saved.length, 3, "the left leaf of the default list and the two walls");
    assert.deepEqual([saved[1].name, saved[1].guid, saved[2].name, saved[2].guid], [DESIGNER, "", "", "a28649d65e054906"]);
    assert.equal(saved[1].by, "Patrik");
    assert.match(saved[1].label, /^Parede invisível designer_8a3c1f10/);
    // 12 directions at two heights and the way the player looks, each asked for the things along it.
    assert.equal(world.rays.length, 25);
    assert.ok(world.rays.every((ray) => ray.options.mode === "anything" && ray.options.maxHits === 8));

    // Again: nothing is taken twice.
    const again = await sut.api.hideWallsAround(standing, "Patrik");
    assert.equal(sut.saved().length, 3);
    assert.ok(again.some((line) => /já estava fora do mapa/.test(line)));
});

test("/objeto parede tells when it found nothing, when the game did not answer, and leaves a wall a world export already takes out", async () => {
    const empty = load(new Map(), [], wallWorld({ hits: [hitOf({ levelObject: brushObject("objects/manmade/houses/wall_b.cgf") })], entities: [{ position: { x: 498, y: 403, z: 108.8 }, distance: 1, guid: "1111222233334444", name: "barrel_12", class: "GeomEntity", physicalized: true }] }));
    empty.api.installLevelEdits();
    const none = await empty.api.hideWallsAround(standing, "Patrik", 4);
    assert.match(none[0], /^Não achei parede invisível a até 4 m de você/);
    assert.ok(none.some((line) => /^As mais perto: houses\/wall_b\.cgf \(brush, mat_rock\) a 1\.2 m$/.test(line)), "what was seen is named, so the next try says which was the wall: " + none.join(" | "));
    assert.ok(none.some((line) => /para tirar uma: \/objeto esconder <guid>.*barrel_12 · guid 1111222233334444/.test(line)), "the geometry near is named so one can be taken out by guid");
    assert.equal(empty.saved().length, 1, "nothing was added");

    const deaf = load(new Map(), [], wallWorld({ answered: false }));
    deaf.api.installLevelEdits();
    assert.deepEqual(Array.from(await deaf.api.hideWallsAround(standing, "Patrik")), ["O seu jogo não respondeu (sem mundo)."]);

    const held = { kind: "brush", name: "levels/kutnohorsko/Brush/designer_8a3c1f10-52aa-4b0e-9d3b-0c7d4f5e6a77.cgf", at: [497.6, 404, 108.7], hidden: true };
    const exported = load(new Map(), [[held]], wallWorld({ hits: [hitOf({ levelObject: brushObject(DESIGNER) })] }));
    exported.api.installLevelEdits();
    const before = exported.state.applied.length;
    const lines = await exported.api.hideWallsAround(standing, "Patrik");
    assert.equal(exported.state.applied.length, before, "two resources on one object stop the server: it is not asked twice");
    assert.ok(lines.some((line) => /já sai do mapa por um mundo exportado/.test(line)));
    assert.equal(exported.saved().length, 1);
});

test("the left leaf and the two designer blockers of Malešov's gate, kept in the list, are all put under the ground at every boot; an entity of the list is only hidden", () => {
    const files = new Map([["playerdata/level-edits.json", JSON.stringify([
        { name: "objects/manmade/structures/logistical/gate/gate_beams_a_door_right.cgf", guid: "", at: [492.485, 396.493, 109.767], label: "Portão de Malešov, folha direita", by: "servidor", when: 0 },
        { name: "levels/kutnohorsko/Brush/designer_760d6cd0-4b3d-4c4d-8e55-4cdfd4e763fd.cgf", guid: "", at: [489.592, 399.944, 109.708], label: "Portão de Malešov, bloqueio invisível (esquerda)", by: "servidor", when: 0 },
        { name: "", guid: "a28649d65e054906", at: [1, 2, 3], label: "uma entidade", by: "Radovan", when: 0 },
    ])]]);
    const sut = load(files);
    sut.api.installLevelEdits();
    const [leaf, blocker, entity] = others(sut.state.applied);
    assert.deepEqual(leaf, sunk({ kind: "brush", name: "objects/manmade/structures/logistical/gate/gate_beams_a_door_right.cgf", at: { x: 492.485, y: 396.493, z: 109.767 }, hidden: true }));
    assert.deepEqual(blocker.position, { x: 489.592, y: 399.944, z: 109.708 - 300 });
    assert.deepEqual(blocker.scale, { x: 0.01, y: 0.01, z: 0.01 });
    assert.deepEqual(entity, { kind: "entity", guid: "a28649d65e054906", at: { x: 1, y: 2, z: 3 }, hidden: true }, "no entity has been seen to keep a collision: it stays as it was");
});
