"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

// The invisible walls that stay where a door was taken out (src/server/wall-sites.ts, 2026-10-27: "mesmo removendo essas portas estáticas fica uma parede invisível, preciso que retire"):
// each brush a listed world export hides is a site; a player's game traces through it and what is only collision is taken out for everybody.

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

class Vector3 {
    constructor(x, y, z) { this.x = x; this.y = y; this.z = z; }
}

const DOORS = "portas-removidas";
const door = (name, at) => ({ kind: "brush", name, at, hidden: true });
const BARN = door("Objects/manmade/common_fixtures/doors/barn_door_a_right.cgf", [3081.9, 720.4, 53.9]);
const BARN_DOORWAY = door("Objects/characters/assets/doors/barn_doorway.cgf", [3082.3, 720.2, 53.9]);
const GATE = door("Objects/manmade/common_fixtures/doors/gate_a_doors.cgf", [3085.7, 681.9, 53.5]);
const FAR_GATE = door("Objects/manmade/common_fixtures/doors/gate_a_doors.cgf", [2962.8, 471.0, 30.8]);
const BARRIER = "levels/kutnohorsko/Brush/designer_8a3c1f10-52aa-4b0e-9d3b-0c7d4f5e6a77.cgf";

const hitOf = (fields) => ({ position: { x: 3082.5, y: 719.5, z: 54.8 }, kind: "brush", model: null, surface: "mat_stone", entityClass: null, entityGuid: null, entityName: null, distance: 2, levelObject: null, ...fields });
const barrierHit = (at = { x: 3083.1, y: 719.0, z: 54.0 }, fields = {}) => hitOf({ surface: "mat_level_barrier", levelObject: { kind: "brush", name: BARRIER, at }, ...fields });

function load({ files = new Map(), worlds = [[DOORS, [BARN, BARN_DOORWAY, GATE, FAR_GATE]]], ready = true, players = [], hits = () => [], entities = [], answered = true, throws = false } = {}) {
    const disk = fakeDisk(files);
    const storeSandbox = { exports: {}, require: () => disk.fs };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/store.js"), "utf8"), storeSandbox);
    const state = { applied: [], logs: [], rays: [], intervals: [], now: 1_000_000 };
    const FakeDate = { now: () => state.now };
    const base = {
        console: { log: (line) => state.logs.push(line), error: (line) => state.logs.push(line) },
        Date: FakeDate,
        JSON,
        Math,
        Object,
        Number,
        Promise,
        Vector3,
        WorldResource: { ready, all: () => worlds.map(([name, edits]) => ({ name, levelEdits: edits.map((definition) => ({ toJSON: () => definition })) })) },
        LevelEdit: { apply: (definition) => { state.applied.push(JSON.parse(JSON.stringify(definition))); return { restore() {} }; } },
    };
    const levelEditsSandbox = { exports: {}, require: (id) => (id === "./store.js" ? storeSandbox.exports : assert.fail(`unexpected require ${id}`)), ...base };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/level-edits.js"), "utf8"), levelEditsSandbox);
    const context = {
        exports: {},
        require: (id) => (id === "./store.js" ? storeSandbox.exports : id === "./level-edits.js" ? levelEditsSandbox.exports : assert.fail(`unexpected require ${id}`)),
        ...base,
        World: {
            raycastAll: async (_player, from, to, options) => {
                if (throws) throw new Error("socket");
                state.rays.push({ from, to, options });
                return { answered, reason: answered ? "" : "sem mundo", hit: null, hits: state.rays.length % 36 === 1 ? hits() : [] };
            },
            entitiesInRadius: async () => ({ answered, reason: answered ? "" : "sem mundo", entities }),
        },
        Player: { all: () => players },
        setInterval: (fn, ms) => { state.intervals.push({ fn, ms }); return state.intervals.length; },
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/wall-sites.js"), "utf8"), context);
    return { api: context.exports, state, files: disk.files, saved: () => JSON.parse(disk.files.get("playerdata/wall-sites.json")), edits: () => JSON.parse(disk.files.get("playerdata/level-edits.json")) };
}

/** What a look took out of the map (a designer's box or a blocker entity), as against the pushes of what the exports took out (their own meshes). Both are put under the ground now. */
const taken = (applied) => applied.filter((definition) => definition.kind === "entity" || /designer_/i.test(definition.name));
const pushes = (applied) => applied.filter((definition) => definition.kind === "brush" && !/designer_/i.test(definition.name));
const sunkAt = (x, y, z) => ({ position: { x, y, z: z - 300 }, scale: { x: 0.01, y: 0.01, z: 0.01 } });

const player = (x, y, z, fields = {}) => ({ nickname: "Patrik", ready: true, alive: true, position: { x, y, z }, ...fields });

test("the sites are the brushes the listed world took out, one per door: a door and its doorway at one place are one site; entities, other worlds and a world not loaded yet give none", () => {
    const sut = load({ worlds: [[DOORS, [BARN, BARN_DOORWAY, GATE, { kind: "entity", guid: "47c17f8d1527d5f0", at: [1, 2, 3], hidden: true }, { kind: "brush", name: "x/shown.cgf", at: [5, 5, 5], hidden: false }]], ["raborsch", [door("x/hanger_wall_hook.cgf", [491.4, 397.5, 110.7])]]] });
    const sites = Array.from(sut.api.sites(), (site) => ({ label: site.label, at: Array.from(site.at) }));
    assert.deepEqual(sites, [
        { label: "barn_door_a_right", at: [3081.9, 720.4, 53.9] },
        { label: "gate_a_doors", at: [3085.7, 681.9, 53.5] },
        { label: "Portão de Raborsch", at: [1422.8, 3856.4, 118] },
        { label: "Portão de Malešov", at: [491.5, 398, 109.8] },
    ], "the doors of the listed world, then the two gates' places");
    assert.deepEqual(Array.from(load({ ready: false }).api.sites()), [], "nothing to say before the worlds have loaded");
    assert.deepEqual(Array.from(load({ worlds: [] }).api.sites(), (site) => site.label), ["Portão de Raborsch", "Portão de Malešov"], "the gates are looked at whatever the worlds hold");
});

test("a look runs rays through the door's place at three heights, each out both sides, and asks the game for the geometry entities near", async () => {
    const sut = load({ hits: () => [hitOf()] });
    const site = sut.api.sites()[0];
    await sut.api.lookAt(player(3080, 718, 53.9), site, "Patrik");
    assert.equal(sut.state.rays.length, 36, "12 headings over half a turn, at 3 heights");
    assert.ok(sut.state.rays.every((ray) => ray.options.mode === "anything" && ray.options.maxHits === 8));
    for (const ray of sut.state.rays) {
        assert.ok(Math.abs((ray.from.x + ray.to.x) / 2 - 3081.9) < 1e-6 && Math.abs((ray.from.y + ray.to.y) / 2 - 720.4) < 1e-6, "every ray runs through the door's place");
        assert.ok(Math.abs(Math.hypot(ray.to.x - ray.from.x, ray.to.y - ray.from.y) - 8) < 1e-6, "four metres to each side");
        assert.equal(ray.from.z, ray.to.z, "level");
    }
    assert.deepEqual([...new Set(sut.state.rays.map((ray) => +(ray.from.z - 53.9).toFixed(2)))].sort(), [0.5, 1.4, 2.3]);
});

test("what is only collision near the door is taken out for everybody and kept in the list; what has a picture, and what is far from the door, is left", async () => {
    const hits = () => [
        barrierHit(),
        hitOf({ levelObject: { kind: "brush", name: "objects/manmade/structures/defensive/wall_a.cgf", at: { x: 3082, y: 720, z: 53.9 } }, distance: 1.5 }),
        barrierHit({ x: 3100.0, y: 740.0, z: 54.0 }, { position: { x: 3100.0, y: 740.0, z: 54.2 } }),
        hitOf({ kind: "terrain", surface: "mat_grass", distance: 3 }),
        hitOf({ kind: "static", surface: "mat_stone", position: { x: 3081.0, y: 721.0, z: 54.0 }, distance: 1 }),
    ];
    const sut = load({ hits, entities: [{ position: { x: 3080.5, y: 719.8, z: 54 }, distance: 1.6, guid: "a28649d65e054906", name: "designer_760d6cd0", class: "GeomEntity", physicalized: true }, { position: { x: 3083, y: 720.6, z: 53.9 }, distance: 1, guid: "1111222233334444", name: "barrel_12", class: "GeomEntity", physicalized: true }] });
    const site = sut.api.sites()[0];
    const look = await sut.api.lookAt(player(3080, 718, 53.9), site, "servidor");
    assert.equal(look.answered, true);
    assert.deepEqual(taken(sut.state.applied), [
        { kind: "brush", name: BARRIER, at: { x: 3083.1, y: 719, z: 54 }, hidden: true, ...sunkAt(3083.1, 719, 54) },
        { kind: "entity", guid: "a28649d65e054906", at: { x: 3080.5, y: 719.8, z: 54 }, hidden: true },
    ], "the box (under the ground, tiny), and the blocker entity; not the wall with a picture, not the box 25 m away, not a barrel");
    assert.equal(look.hidden.length, 2);
    assert.deepEqual(Array.from(look.notes), ["mat_level_barrier", "?"], "what the game said the box was made of; an entity of the geometry query has no hit to say");
    assert.deepEqual(Array.from(look.near, (one) => one.text), ["wall_a.cgf [3082.0 720.0 53.9] (mat_stone) a 2.0 m".replace(" a 2.0 m", look.near[0].text.slice(look.near[0].text.indexOf(" a ")))], "what was left, with its pivot and how far it is from the door's place");
    assert.equal(look.near[0].still, false);
    assert.equal(look.unnamed.length, 1);
    assert.match(look.unnamed[0], /^3081\.0 721\.0 54\.0 \(mat_stone\)$/);
    const edits = sut.edits();
    assert.equal(edits.length, 3, "Malešov's left leaf of the default list and the two walls");
    assert.equal(edits[1].by, "servidor");
    assert.match(edits[1].label, /^Parede invisível designer_8a3c1f10/);
    const line = sut.api.describe(site, look);
    assert.match(line, /^barn_door_a_right em 3081\.9 720\.4 53\.9: tirei 2 parede\(s\) invisível\(is\): designer_8a3c1f10-52aa-4b0e-9d3b-0c7d4f5e6a77\.cgf \[mat_level_barrier\], /);
    assert.match(line, /perto da porta, com desenho \(deixei\): wall_a\.cgf \[3082\.0 720\.0 53\.9\] \(mat_stone\) a \d\.\d m/);
    assert.match(line, /sem nome no mapa .*3081\.0 721\.0 54\.0/);
});

test("a surface that is never drawn is a wall whatever the mesh is called: the designers' two collision materials are told", async () => {
    const mat = (surface) => hitOf({ surface, levelObject: { kind: "brush", name: "objects/intermediates/blocker_x.cgf", at: { x: 3083, y: 719, z: 54 } } });
    for (const [surface, hides] of [["mat_level_barrier", true], ["mat_nodraw_designer", true], ["mat_collision_proxy", true], ["mat_rock", false], ["mat_stone", false]]) {
        const sut = load({ hits: () => [mat(surface)] });
        const look = await sut.api.lookAt(player(3080, 718, 53.9), sut.api.sites()[0], "servidor");
        assert.equal(look.hidden.length, hides ? 1 : 0, surface);
    }
});

test("more collision-only things than a doorway can hold are not taken out, and the look says why", async () => {
    const many = Array.from({ length: 8 }, (_, index) => barrierHit({ x: 3082 + index * 0.1, y: 719, z: 54 }));
    const sut = load({ hits: () => many });
    const look = await sut.api.lookAt(player(3080, 718, 53.9), sut.api.sites()[0], "servidor");
    assert.equal(look.hidden.length, 0);
    assert.match(look.refused, /^8 coisas só de colisão/);
    assert.deepEqual(sut.state.applied, []);
    assert.match(sut.api.describe(sut.api.sites()[0], look), /parece demais para uma porta/);
});

test("a sweep looks at the first site a player who can answer is near, once, and remembers it across restarts", async () => {
    const files = new Map();
    const here = player(3081, 740, 54);
    const sut = load({ files, players: [player(10, 10, 10), player(3081, 740, 54, { ready: false }), player(3081, 740, 54, { alive: false }), here], hits: () => [barrierHit()] });
    assert.equal(sut.state.intervals.length, 0);
    sut.api.installWallSites();
    assert.equal(sut.state.intervals.length, 1);
    assert.equal(sut.state.intervals[0].ms, 10_000);

    await sut.api.sweep();
    assert.equal(taken(sut.state.applied).length, 1);
    assert.ok(sut.state.logs.some((line) => /^wall-sites: Patrik estava perto: barn_door_a_right em .*tirei 1 parede\(s\) invisível\(is\)/.test(line)), sut.state.logs.join(" | "));
    assert.deepEqual(Object.keys(sut.saved().done), ["barn_door_a_right@3081.9,720.4,53.9"]);
    assert.equal(sut.saved().done["barn_door_a_right@3081.9,720.4,53.9"].hidden, 1);

    const rays = sut.state.rays.length;
    await sut.api.sweep();
    assert.equal(sut.state.rays.length, rays, "the same site is not looked at again");

    const again = load({ files, players: [here], hits: () => [barrierHit()] });
    await again.api.sweep();
    assert.equal(again.state.rays.length, 0, "nor after a restart");
    assert.deepEqual(Array.from(again.api.listSites()), [
        "1. barn_door_a_right em 3081.9 720.4 53.9: olhada, 1 parede(s) tirada(s)",
        "2. gate_a_doors em 3085.7 681.9 53.5: ainda não olhada",
        "3. gate_a_doors em 2962.8 471.0 30.8: ainda não olhada",
        "4. Portão de Raborsch em 1422.8 3856.4 118.0: ainda não olhada",
        "5. Portão de Malešov em 491.5 398.0 109.8: ainda não olhada",
    ]);
});

test("a player too far, too high or too low is no reason to look; one at the second site looks at that one", async () => {
    const sut = load({ players: [player(3081, 718, 90), player(3081, 770, 53.9)], hits: () => [hitOf()] });
    await sut.api.sweep();
    assert.equal(sut.state.rays.length, 0, "50 m away and 36 m up are not near");
    const second = load({ players: [player(3084, 684, 53.5)], hits: () => [hitOf()] });
    await second.api.sweep();
    assert.ok(second.state.logs.some((line) => /gate_a_doors em 3085\.7 681\.9 53\.5: nenhuma parede invisível por aqui/.test(line)), second.state.logs.join(" | "));
    assert.deepEqual(Object.keys(second.saved().done), ["gate_a_doors@3085.7,681.9,53.5"], "found nothing to take out: it counts all the same");
    assert.equal(second.saved().done["gate_a_doors@3085.7,681.9,53.5"].hidden, 0);
});

test("a look that the game did not answer, or that had nothing to trace, does not count: the site waits a minute and is tried again", async () => {
    const deaf = load({ players: [player(3081, 740, 54)], answered: false });
    await deaf.api.sweep();
    assert.equal(deaf.files.has("playerdata/wall-sites.json"), false, "nothing remembered");
    assert.ok(deaf.state.logs.some((line) => /não conta, vai tentar de novo.*o jogo não respondeu/.test(line)), deaf.state.logs.join(" | "));
    const rays = deaf.state.rays.length;
    await deaf.api.sweep();
    assert.equal(deaf.state.rays.length, rays, "not before the minute is out");
    deaf.state.now += 61_000;
    await deaf.api.sweep();
    assert.ok(deaf.state.rays.length > rays, "after it");

    const empty = load({ players: [player(3081, 740, 54)], hits: () => [] });
    await empty.api.sweep();
    assert.ok(empty.state.logs.some((line) => /o jogo não tinha nada para traçar aqui/.test(line)), empty.state.logs.join(" | "));
    assert.equal(empty.files.has("playerdata/wall-sites.json"), false);
});

test("only one look at a time, and a look that throws is told in the log and tried again later", async () => {
    const sut = load({ players: [player(3081, 740, 54), player(3085, 683, 53.5)], hits: () => [hitOf()] });
    const first = sut.api.sweep();
    const second = sut.api.sweep();
    await Promise.all([first, second]);
    assert.equal(sut.state.logs.filter((line) => /^wall-sites: Patrik estava perto/.test(line)).length, 1, "the second sweep found a look already under way");

    const broken = load({ players: [player(3081, 740, 54)], throws: true });
    await broken.api.sweep();
    assert.ok(broken.state.logs.some((line) => /^wall-sites: não consegui olhar barn_door_a_right: (Error: )?socket$/.test(line)), broken.state.logs.join(" | "));
    assert.equal(broken.files.has("playerdata/wall-sites.json"), false, "nothing remembered");
    await broken.api.sweep();
    assert.equal(broken.state.logs.filter((line) => /não consegui olhar/.test(line)).length, 1, "and not again before the minute is out");
});

test("/objeto portas looks at the sites around an administrator, nearest first, whatever was remembered, and tells each", async () => {
    const files = new Map();
    const sut = load({ files, players: [], hits: () => [barrierHit()] });
    const lines = await sut.api.lookAround(player(3083, 700, 53.7), 60);
    assert.equal(lines.length, 2, "the barn door 20 m away and the gate 18 m away; the third site is 230 m off");
    assert.match(lines[0], /^gate_a_doors em 3085\.7 681\.9 53\.5: /, "the nearest first");
    assert.match(lines[1], /^barn_door_a_right em 3081\.9 720\.4 53\.9: tirei 1 parede/);
    assert.deepEqual(Object.keys(sut.saved().done).sort(), ["barn_door_a_right@3081.9,720.4,53.9", "gate_a_doors@3085.7,681.9,53.5"]);
    assert.ok(sut.state.logs.some((line) => /^wall-sites: Patrik pediu: gate_a_doors/.test(line)));

    const rays = sut.state.rays.length;
    const again = await sut.api.lookAround(player(3083, 700, 53.7), 60);
    assert.equal(again.length, 2);
    assert.ok(sut.state.rays.length > rays, "asked again, it looks again");

    const none = await sut.api.lookAround(player(100, 100, 50), 40);
    assert.match(none[0], /^Nenhuma porta tirada do mapa a até 40 m de você \(a mais perto está a \d+ m\)\.$/);
    assert.match((await load({ ready: false }).api.lookAround(player(0, 0, 0), 40))[0], /^Nenhuma porta tirada do mapa por um mundo exportado \(ainda carregando\?\)/, "before the worlds have loaded");
});

test("what the export took out and the game still hits at its own place is told as AINDA LÁ, and is pushed aside again", async () => {
    const sut = load({
        hits: () => [
            hitOf({ surface: "mat_wood", levelObject: { kind: "brush", name: "objects/manmade/common_fixtures/doors/barn_door_a_right.cgf", at: { x: 3081.9, y: 720.4, z: 53.9 } }, position: { x: 3081.9, y: 720.5, z: 54.5 }, distance: 0.6 }),
            hitOf({ surface: "mat_wood", levelObject: { kind: "brush", name: "objects/manmade/common_fixtures/doors/barn_door_a_right.cgf", at: { x: 3095.0, y: 720.4, z: 53.9 } }, position: { x: 3082.9, y: 720.5, z: 54.5 }, distance: 1.6 }),
        ],
    });
    const site = sut.api.sites()[0];
    const look = await sut.api.lookAt(player(3081, 740, 54), site, "servidor");
    assert.equal(look.still, 1, "the same mesh a long way off is another door");
    assert.equal(look.pushed, 1);
    assert.deepEqual(Array.from(look.near, (one) => one.still), [true, false]);
    assert.match(look.near[0].text, /^barn_door_a_right\.cgf \[3081\.9 720\.4 53\.9\] \(mat_wood\) a 0\.\d m AINDA LÁ$/);
    assert.deepEqual(pushes(sut.state.applied), [{ kind: "brush", name: "Objects/manmade/common_fixtures/doors/barn_door_a_right.cgf", at: { x: 3081.9, y: 720.4, z: 53.9 }, hidden: true, position: { x: 3081.9, y: 720.4, z: -246.1 }, scale: { x: 0.01, y: 0.01, z: 0.01 } }], "named as the export names it, 300 m under its place, tiny");
    const line = sut.api.describe(site, look);
    assert.match(line, /^barn_door_a_right em 3081\.9 720\.4 53\.9: ATENÇÃO: 1 objeto\(s\) que o mundo tirou ainda é\(são\) acertado\(s\) aqui, no mesmo lugar \(empurrei de novo para baixo da terra: 1\)/);
});

test("at the first sweep of a boot every object the export took out is pushed under the ground, once; a throwing edit is told in the log", async () => {
    const sut = load({ players: [] });
    await sut.api.sweep();
    const moved = pushes(sut.state.applied);
    assert.equal(moved.length, 4, "the barn door, its doorway, the two gates");
    assert.ok(moved.every((definition) => definition.hidden === true && definition.scale.x === 0.01 && definition.position.z === definition.at.z - 300));
    assert.ok(sut.state.logs.some((line) => /^wall-sites: 4 de 4 objeto\(s\) que os mundos exportados tiraram foram postos 300 m abaixo da terra/.test(line)), sut.state.logs.join(" | "));
    await sut.api.sweep();
    assert.equal(pushes(sut.state.applied).length, 4, "not again in the same boot");

    const before = load({ ready: false });
    await before.api.sweep();
    assert.equal(pushes(before.state.applied).length, 0, "nothing before the worlds have loaded");
});

test("every brush any world export hides is pushed under the ground at the first sweep, not only the doors' world: Raborsch's furniture and Malešov's hooks too; an entity is not", async () => {
    const hook = door("Objects/manmade/common_furniture/hangers/hanger_wall_hook.cgf", [491.4, 397.5, 110.7]);
    const barrel = door("Objects/manmade/task_specific_props/barrel_b.cgf", [1440.2, 3830.1, 112.4]);
    const lamp = { kind: "entity", guid: "47c17f8d1527d5f0", at: [1, 2, 3], hidden: true };
    const sut = load({ worlds: [[DOORS, [BARN]], ["raborsch", [hook, barrel, lamp]]] });
    await sut.api.sweep();
    assert.deepEqual(pushes(sut.state.applied).map((definition) => definition.name), [BARN.name, hook.name, barrel.name]);
    assert.deepEqual(pushes(sut.state.applied)[1].position, { x: 491.4, y: 397.5, z: 110.7 - 300 });
    assert.ok(sut.state.logs.some((line) => /^wall-sites: 3 de 3 objeto\(s\) que os mundos exportados tiraram foram postos 300 m abaixo da terra/.test(line)), sut.state.logs.join(" | "));
    assert.deepEqual(Array.from(sut.api.sites(), (site) => site.label), ["barn_door_a_right", "Portão de Raborsch", "Portão de Malešov"], "only the listed world's doors are places to look at");
});

test("the gates of Raborsch and Malešov are looked at like a door: a designer's invisible box near the gate is taken out and put under the ground, whoever is near", async () => {
    const box = barrierHit({ x: 1421.85, y: 3856.33, z: 118.02 }, { position: { x: 1422.0, y: 3856.4, z: 119.0 } });
    const sut = load({ players: [player(1415, 3860, 118)], hits: () => [box] });
    await sut.api.sweep();
    assert.ok(sut.state.logs.some((line) => /^wall-sites: Patrik estava perto: Portão de Raborsch em 1422\.8 3856\.4 118\.0: tirei 1 parede\(s\) invisível\(is\): designer_8a3c1f10/.test(line)), sut.state.logs.join(" | "));
    assert.deepEqual(taken(sut.state.applied), [{ kind: "brush", name: BARRIER, at: { x: 1421.85, y: 3856.33, z: 118.02 }, hidden: true, ...sunkAt(1421.85, 3856.33, 118.02) }]);
    assert.ok(Object.keys(sut.saved().done).includes("portao-de-raborsch"), "remembered by its own key");
    const malesov = load({ players: [player(500, 400, 110)], hits: () => [hitOf({ position: { x: 491.0, y: 398.0, z: 110.5 } })] });
    await malesov.api.sweep();
    assert.ok(malesov.state.logs.some((line) => /Portão de Malešov em 491\.5 398\.0 109\.8: nenhuma parede invisível por aqui/.test(line)), malesov.state.logs.join(" | "));
});
