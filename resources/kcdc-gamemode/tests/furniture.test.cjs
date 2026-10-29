"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const { lowered, torch } = require("./torchstub.cjs");
require("./reachpatch.cjs");

// The chests, chairs and beds a World Builder export places (src/server/furniture.ts): chests become real containers that keep
// what is in them, chairs and beds take the player (user, 2026-10-19: "os baús, camas e cadeiras ... não tem como interagir").

class Vector3 {
    constructor(x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
    }
}

const plain = (value) => JSON.parse(JSON.stringify(value));

const CHAIR = "objects/manmade/common_furniture/chairs/high/chair_fancy_a.cgf";
const BED = "objects/manmade/common_furniture/beds/high/bed_double_royal_a.cgf";
const BED_ONE = "objects/manmade/common_furniture/beds/high/bed_royal_b.cgf";
const CHEST = "objects/manmade/common_furniture/chests/chest_fancy_d_big.cgf";
const TABLE = "objects/manmade/common_furniture/tables/table_fancy_a_long.cgf";

const quat = (degrees) => {
    const half = (degrees * Math.PI) / 360;
    return { x: 0, y: 0, z: Math.sin(half), w: Math.cos(half) };
};
const prop = (model, x, y, z = 125, degrees = 0) => {
    const made = { model, position: { x, y, z }, rotation: quat(degrees), destroyed: false, destroy() { made.destroyed = true; } };
    return made;
};

function load({ props = [], saved = null, corrupt = false, spawnFails = false, startsReady = true } = {}) {
    const state = {
        logs: [],
        errors: [],
        files: new Map(),
        holds: [],
        chat: [],
        timers: [],
        spawned: [],
        client: new Map(),
        handlers: new Map(),
        once: new Map(),
        stashes: new Map(),
        players: [],
        nextStash: 1,
    };
    if (saved !== null) state.files.set("playerdata/world-chests.json", saved);
    const fatigue = { fatiguePace: { hold: (id, posture) => state.holds.push([id, posture]) } };
    const store = {
        ensureDir() {},
        read: (file) => {
            if (corrupt && file === "playerdata/world-chests.json") return { status: "corrupt", reason: "broken" };
            return state.files.has(file) ? { status: "ok", value: JSON.parse(JSON.stringify(state.files.get(file))), fromBackup: false } : { status: "missing" };
        },
        write: (file, value) => state.files.set(file, JSON.parse(JSON.stringify(value))),
    };
    const context = {
        exports: {},
        Math,
        JSON,
        Date,
        Vector3,
        console: { log: (line) => state.logs.push(line), error: (line) => state.errors.push(line) },
        require: (id) => ({ "./fatigue.js": fatigue, "./store.js": store, "./torch-down.js": torch })[id] ?? assert.fail(`unexpected require ${id}`),
        setTimeout: (fn, ms) => { state.timers.push({ fn, ms, live: true }); return state.timers.length; },
        clearTimeout: (id) => { if (state.timers[id - 1]) state.timers[id - 1].live = false; },
        Chat: { sendToPlayer: (player, text) => state.chat.push(text) },
        Animations: { list: (name) => (name === "Sitting" || name === "Lying" ? [{ fragment: name }] : []) },
        Player: { all: () => state.players },
        Stash: {
            spawn: (position, rotation, world, options) => {
                if (spawnFails) throw new Error("no such model");
                const stash = { id: state.nextStash++, position, rotation, options, rows: [], setInventory({ items }) { stash.rows = items.map((row) => ({ ...row })); return { ok: true }; }, getInventory() { return { revision: 1, items: stash.rows.map((row, index) => ({ id: `r${index}`, ...row })) }; } };
                state.spawned.push(stash);
                state.stashes.set(stash.id, stash);
                return stash;
            },
            getById: (id) => state.stashes.get(id) ?? null,
        },
        WorldResource: { ready: startsReady, all: () => [{ props }] },
        Events: {
            on: (name, fn) => state.handlers.set(name, fn),
            once: (name, fn) => state.once.set(name, fn),
            onClient: (name, fn) => state.client.set(name, fn),
        },
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/furniture.js"), "utf8"), context);
    const api = context.exports;
    const player = (id = 1, x = 0, y = 0, z = 125) => {
        const made = {
            id,
            nickname: `P${id}`,
            steamId: `s${id}`,
            ready: true,
            alive: true,
            position: { x, y, z },
            emitted: [],
            animations: [],
            stops: [],
            spawns: [],
            teleports: [],
            spawnWorks: true,
            teleportWorks: true,
            spawn(at, rotation) { made.spawns.push({ at: plain(at), rotation: plain(rotation) }); return made.spawnWorks; },
            teleport(at) { made.teleports.push(plain(at)); return made.teleportWorks; },
            emit(event, payload) { made.emitted.push({ event, payload: JSON.parse(payload) }); },
            playAnimation(fragment, options) { made.animations.push({ fragment, options }); return true; },
            stopAnimation(options) { made.stops.push(options); return true; },
        };
        state.players.push(made);
        return made;
    };
    return { api, state, player, context };
}

const near = (a, b, tolerance = 1e-6) => Math.abs(a - b) <= tolerance;

test("a chair, a stool, a bed and a chest are told by their models; a double bed is two places, a table is nothing", () => {
    const sut = load();
    const spots = sut.api.spotsOf([prop(CHAIR, 1, 1), prop(BED, 5, 5), prop(BED_ONE, 9, 9), prop(CHEST, 12, 12), prop(TABLE, 20, 20), prop("objects/manmade/common_furniture/stools/stool_a.cgf", 30, 30)]);
    assert.deepEqual(plain(spots.map((spot) => [spot.kind, spot.side])), [["cadeira", 0], ["cama", -1], ["cama", 1], ["cama", 0], ["cadeira", 0]]);
    assert.ok(sut.api.CHEST_MODEL.test(CHEST) && !sut.api.CHEST_MODEL.test(TABLE));
    assert.equal(new Set(spots.map((spot) => spot.id)).size, spots.length, "every place has an id of its own");
});

test("the heading of a prop is read from a quaternion or from Euler degrees", () => {
    const sut = load();
    assert.ok(near(sut.api.yawOf(quat(13)), (13 * Math.PI) / 180, 1e-9));
    assert.ok(near(sut.api.yawOf(quat(193)), ((193 - 360) * Math.PI) / 180, 1e-9), "past half a turn it wraps to the other side");
    assert.ok(near(sut.api.yawOf({ x: 0, y: 0, z: 90 }), Math.PI / 2, 1e-9));
    assert.equal(sut.api.yawOf(undefined), 0);
});

test("a sitter on a chair is on its seat, a hand behind the pivot's front edge, facing where the chair's front looks (user's chairs face the table by their -Y)", () => {
    const sut = load();
    // The hall's north-side chairs: 13 degrees, their front (-Y) toward the table.
    const [chair] = sut.api.spotsOf([prop(CHAIR, 1425.9, 3820.7, 125.06, 13)]);
    const pose = sut.api.poseFor(chair);
    const yaw = (13 * Math.PI) / 180;
    // The seat is 0.3 m along the chair's +Y (its back), which is the sitter's -0.3 along the heading.
    assert.ok(near(pose.x, 1425.9 + -Math.sin(yaw) * 0.3, 1e-9) && near(pose.y, 3820.7 + Math.cos(yaw) * 0.3, 1e-9));
    assert.ok(near(pose.z, 125.06));
    // The body faces the chair's -Y: heading 13 + 180 = -167 degrees.
    assert.ok(near(pose.heading, -167, 1e-9), String(pose.heading));
});

test("a bed lays the body on the mattress, a double bed's two sleepers on either side of its middle, and getting up puts the player beside it", () => {
    const sut = load();
    const spots = sut.api.spotsOf([prop(BED, 1000, 2000, 125, -77)]);
    const left = sut.api.poseFor(spots[0]);
    const right = sut.api.poseFor(spots[1]);
    assert.ok(near(left.z, 125.62) && near(right.z, 125.62), "up on the mattress");
    assert.ok(near(Math.hypot(left.x - right.x, left.y - right.y), 0.8, 1e-9), "0.8 m apart");
    assert.ok(near((left.x + right.x) / 2, 1000, 1e-9) && near((left.y + right.y) / 2, 2000, 1e-9));
    const off = sut.api.getOffPoint(spots[1]);
    assert.ok(near(off.z, 125.05));
    assert.ok(near(Math.hypot(off.x - 1000, off.y - 2000), 1.3, 1e-9), "past the edge of the widest bed");
    assert.ok(Math.hypot(off.x - left.x, off.y - left.y) > Math.hypot(off.x - right.x, off.y - right.y), "on the sleeper's own side");
});

test("the pieces within a radius are told to the client once each, with the kind numbers 5 and 6", () => {
    const sut = load();
    sut.api.setSpots(sut.api.spotsOf([prop(CHAIR, 10, 10), prop(BED, 12, 12), prop(CHAIR, 500, 500)]));
    assert.deepEqual(plain(sut.api.spotPointsWithin({ x: 0, y: 0 }, 100)), [[5, 10, 10, 125], [6, 12, 12, 125]], "a double bed is one point");
});

test("a chest prop becomes a real container of the same mesh in the same place, and the bare prop goes; a refused one stays", () => {
    const chest = prop(CHEST, 1441, 3823.9, 125.06, 193);
    const sut = load({ props: [chest, prop(CHAIR, 1, 1)] });
    sut.api.installFurniture();
    assert.equal(sut.state.spawned.length, 1);
    const [stash] = sut.state.spawned;
    assert.deepEqual(plain(stash.position), { x: 1441, y: 3823.9, z: 125.06 });
    assert.equal(stash.options.model, CHEST);
    assert.equal(stash.rotation, chest.rotation, "the same rotation");
    assert.equal(chest.destroyed, true);
    assert.ok(sut.state.logs.some((line) => /1 cadeira\(s\), 0 lugar\(es\) de cama e 1 baú\(s\)/.test(line)));

    const refused = prop(CHEST, 5, 5);
    const sut2 = load({ props: [refused], spawnFails: true });
    sut2.api.installFurniture();
    assert.equal(refused.destroyed, false, "the model is left as it was");
    assert.ok(sut2.state.logs.some((line) => /não consegui fazer um baú/.test(line)));
});

test("what is left in a chest is kept after a change and put back at the next start", () => {
    const first = load({ props: [prop(CHEST, 1441, 3823.9, 125.06)] });
    first.api.installFurniture();
    const [stash] = first.state.spawned;
    stash.setInventory({ items: [{ item: "bread", amount: 3, metadata: {} }] });
    first.state.handlers.get("stashInventoryChanged")(stash);
    assert.equal(first.state.files.has("playerdata/world-chests.json"), false, "not at once");
    first.state.timers.at(-1).fn();
    const file = first.state.files.get("playerdata/world-chests.json");
    assert.deepEqual(plain(file.chests), { "chest_fancy_d_big@1441.0,3823.9,125.1": [{ item: "bread", amount: 3, metadata: {} }] });

    const second = load({ props: [prop(CHEST, 1441, 3823.9, 125.06)], saved: file });
    second.api.installFurniture();
    assert.deepEqual(plain(second.state.spawned[0].rows), [{ item: "bread", amount: 3, metadata: {} }]);

    // Emptied, it leaves the file.
    stash.setInventory({ items: [] });
    first.state.handlers.get("stashInventoryChanged")(stash);
    first.state.timers.at(-1).fn();
    assert.deepEqual(plain(first.state.files.get("playerdata/world-chests.json").chests), {});
});

test("a file of chests that cannot be read is never written over", () => {
    const sut = load({ props: [prop(CHEST, 1, 1)], corrupt: true });
    sut.api.installFurniture();
    const [stash] = sut.state.spawned;
    stash.setInventory({ items: [{ item: "bread", amount: 1, metadata: {} }] });
    sut.state.handlers.get("stashInventoryChanged")(stash);
    sut.state.timers.at(-1).fn();
    assert.equal(sut.state.files.has("playerdata/world-chests.json"), false);
    assert.ok(sut.state.errors.some((line) => /não pôde ser lido/.test(line)));
});

test("the exports load after the scripts: nothing is learnt until they are ready", () => {
    const sut = load({ props: [prop(CHAIR, 1, 1)], startsReady: false });
    sut.api.installFurniture();
    assert.equal(sut.api.allSpots().length, 0);
    sut.state.once.get("worldResourcesReady")();
    assert.equal(sut.api.allSpots().length, 1);
});

test("sitting: the server puts the body there and the client is told, then the animation is played looped with the legs held, and the tiredness counts it", () => {
    const sut = load({ props: [prop(CHAIR, 10, 10, 125, 13)] });
    sut.api.installFurniture();
    const anna = sut.player(1, 10.3, 10.2, 125);
    assert.deepEqual(plain(sut.api.useSpot(anna, "cadeira", null)), { ok: true, message: "" });
    assert.equal(anna.emitted[0].event, "kcdc-gamemode:furniture.pose");
    assert.equal(anna.emitted[0].payload.kind, "cadeira");
    assert.equal(anna.spawns.length, 1, "the game's own spawn moves the body, not the client");
    const pose = anna.emitted[0].payload;
    assert.deepEqual(anna.spawns[0].at, { x: pose.x, y: pose.y, z: pose.z });
    assert.deepEqual(anna.spawns[0].rotation, { x: 0, y: 0, z: pose.heading });
    assert.equal(anna.teleports.length, 0);
    assert.equal(anna.animations.length, 0, "not before the body is on the seat");
    assert.equal(sut.api.sessionOf(1).phase, "placing");

    const heldBefore = lowered.length;
    sut.state.client.get("kcdc-gamemode:furniture.posed")(anna);
    assert.equal(lowered.length - heldBefore, 1, "a torch in the hand is put away before the body sits (2026-10-25)");
    assert.deepEqual(plain(anna.animations), [{ fragment: "Sitting", options: { loop: true, lockMovement: true } }]);
    assert.deepEqual(sut.state.holds.at(-1), [1, "sitting"]);
    assert.deepEqual(anna.emitted.at(-1), { event: "kcdc-gamemode:furniture.state", payload: { on: true, kind: "cadeira" } });
    assert.equal(sut.api.sessionOf(1).phase, "on");
});

test("a place has one sitter: the next player is told it is taken, and a place whose sitter went away is free again", () => {
    const sut = load({ props: [prop(CHAIR, 10, 10)] });
    sut.api.installFurniture();
    const anna = sut.player(1, 10.3, 10.2);
    const bruno = sut.player(2, 10.5, 10.4);
    sut.api.useSpot(anna, "cadeira", null);
    sut.state.client.get("kcdc-gamemode:furniture.posed")(anna);
    const refused = plain(sut.api.useSpot(bruno, "cadeira", null));
    assert.equal(refused.ok, false);
    assert.match(refused.message, /ocupada/);
    sut.state.players.splice(sut.state.players.indexOf(anna), 1);
    assert.equal(sut.api.useSpot(bruno, "cadeira", null).ok, true, "her seat is free: she is not online");
});

test("a double bed takes two, one on each side, and a third is told it is taken", () => {
    const sut = load({ props: [prop(BED, 10, 10)] });
    sut.api.installFurniture();
    const players = [sut.player(1, 10.5, 10.5), sut.player(2, 10.6, 10.4), sut.player(3, 10.4, 10.6)];
    const results = players.map((p) => sut.api.useSpot(p, "cama", null));
    assert.deepEqual(results.map((r) => r.ok), [true, true, false]);
    assert.notEqual(sut.api.sessionOf(1).spot.side, sut.api.sessionOf(2).spot.side);
});

test("the point the hint was on picks the chair among those side by side; far from any, nothing is taken", () => {
    const sut = load({ props: [prop(CHAIR, 10, 10), prop(CHAIR, 10.8, 10)] });
    sut.api.installFurniture();
    const anna = sut.player(1, 10.4, 10.9);
    sut.api.useSpot(anna, "cadeira", { x: 10.8, y: 10 });
    assert.equal(sut.api.sessionOf(1).spot.x, 10.8);
    const bruno = sut.player(2, 10.4, 10.9);
    const nowhere = sut.api.useSpot(bruno, "cadeira", { x: 50, y: 50 });
    assert.equal(nowhere.ok, false);
    const far = sut.player(3, 40, 40);
    assert.equal(sut.api.useSpot(far, "cadeira", null).ok, false, "too far from every chair");
});

test("getting up ends the animation, gives the tiredness back, and from a bed puts the player on the floor beside it", () => {
    const sut = load({ props: [prop(BED_ONE, 10, 10, 125)] });
    sut.api.installFurniture();
    const anna = sut.player(1, 10.9, 10.2);
    sut.api.useSpot(anna, "cama", null);
    sut.state.client.get("kcdc-gamemode:furniture.posed")(anna);
    assert.deepEqual(sut.state.holds.at(-1), [1, "lying"]);
    assert.equal(sut.api.standUp(anna, "teste"), true);
    assert.deepEqual(plain(anna.stops), [{ standUp: true }]);
    assert.deepEqual(sut.state.holds.at(-1), [1, null]);
    assert.deepEqual(anna.emitted.at(-1), { event: "kcdc-gamemode:furniture.state", payload: { on: false, kind: "cama" } });
    assert.equal(anna.teleports.length, 1, "the server puts the body on the floor beside the bed");
    assert.ok(Math.abs(anna.teleports[0].x - 10) > 1 || Math.abs(anna.teleports[0].y - 10) > 1, "beside it, not on it");
    assert.equal(sut.api.sessionOf(1), null);
    assert.equal(sut.api.standUp(anna, "de novo"), false, "nothing to get up from");
    assert.equal(sut.api.useSpot(anna, "cama", null).ok, true, "and the bed is free");
});

test("the client asks to stand, and a press right after lying down is not read as that", () => {
    const sut = load({ props: [prop(CHAIR, 10, 10)] });
    sut.api.installFurniture();
    const anna = sut.player(1, 10.2, 10.2);
    sut.api.useSpot(anna, "cadeira", null, 1000);
    sut.api.placed(anna, 1000);
    sut.api.useSpot(anna, "cadeira", null, 1100);
    assert.notEqual(sut.api.sessionOf(1), null, "the key again so soon is held over from the press that sat");
    sut.api.useSpot(anna, "cadeira", null, 2000);
    assert.equal(sut.api.sessionOf(1), null, "later it is 'get up'");
    sut.api.useSpot(anna, "cadeira", null, 3000);
    sut.api.placed(anna, 3000);
    sut.state.client.get("kcdc-gamemode:furniture.stand")(anna);
    assert.equal(sut.api.sessionOf(1), null);
});

test("if the client never places the body the use is given up and the place freed", () => {
    const sut = load({ props: [prop(CHAIR, 10, 10)] });
    sut.api.installFurniture();
    const anna = sut.player(1, 10.2, 10.2);
    sut.api.useSpot(anna, "cadeira", null);
    const timer = sut.state.timers.find((t) => t.ms === sut.api.PLACE_WAIT_MS && t.live);
    assert.ok(timer);
    timer.fn();
    assert.equal(sut.api.sessionOf(1), null);
    assert.equal(sut.api.useSpot(sut.player(2, 10.2, 10.2), "cadeira", null).ok, true);
});

test("a refused animation puts the player back up and says so; one cut by the game ends the sit, one we stopped is not counted twice", () => {
    const sut = load({ props: [prop(CHAIR, 10, 10)] });
    sut.api.installFurniture();
    const anna = sut.player(1, 10.2, 10.2);
    anna.playAnimation = () => false;
    sut.api.useSpot(anna, "cadeira", null);
    sut.api.placed(anna);
    assert.equal(sut.api.sessionOf(1), null);
    assert.ok(sut.state.chat.some((line) => /não deixou/.test(line)));

    const bruno = sut.player(2, 10.2, 10.2);
    sut.api.useSpot(bruno, "cadeira", null);
    sut.api.placed(bruno);
    sut.state.handlers.get("playerAnimationEnd")(bruno, "Sitting", "interrupted");
    assert.equal(sut.api.sessionOf(2), null);
    assert.deepEqual(sut.state.holds.at(-1), [2, null]);
    assert.deepEqual(bruno.emitted.at(-1), { event: "kcdc-gamemode:furniture.state", payload: { on: false, kind: "cadeira" } });
});

test("a player who dies or leaves is taken off the seat", () => {
    const sut = load({ props: [prop(CHAIR, 10, 10), prop(CHAIR, 12, 10)] });
    sut.api.installFurniture();
    const anna = sut.player(1, 10.2, 10.2);
    const bruno = sut.player(2, 12.2, 10.2);
    for (const p of [anna, bruno]) {
        sut.api.useSpot(p, "cadeira", null);
        sut.api.placed(p);
    }
    sut.state.handlers.get("playerDied")(anna);
    sut.state.handlers.get("playerDisconnect")(bruno);
    assert.equal(sut.api.sessionOf(1), null);
    assert.equal(sut.api.sessionOf(2), null);
    assert.equal(sut.api.occupantOf(sut.api.allSpots()[0].id), null);
});

test("the tuning moves the seat and is kept; a field or a value that is not one is refused", () => {
    const sut = load({ props: [prop(CHAIR, 10, 10, 125, 0)] });
    sut.api.installFurniture();
    const [spot] = sut.api.spotsOf([prop(CHAIR, 10, 10, 125, 0)]);
    assert.match(sut.api.setTuning("cadeira-frente", -0.4), /cadeira-frente = -0.4/);
    assert.ok(near(sut.api.poseFor(spot).y, 10.4, 1e-9), "0.4 m along the chair's back");
    assert.deepEqual(plain(sut.state.files.get("playerdata/furniture-tuning.json").chair), { forward: -0.4, up: 0, turn: 180 });
    assert.match(sut.api.setTuning("cadeira-frente", Number("x")), /número/);
    assert.match(sut.api.setTuning("sofá", 1), /Não conheço/);
    const again = load({ props: [] });
    again.state.files.set("playerdata/furniture-tuning.json", { chair: { forward: -0.1 }, bed: { up: 0.5 } });
    again.api.installFurniture();
    assert.match(again.api.tuningLines().join(" "), /cadeira-frente = -0.1/);
    assert.match(again.api.tuningLines().join(" "), /cama-altura = 0.5/);
});

test("the sitting and lying fragments are looked for in the catalog and written to the log once", () => {
    const sut = load();
    assert.equal(sut.api.fragmentFor("cadeira"), "Sitting");
    assert.equal(sut.api.fragmentFor("cama"), "Lying");
    sut.api.fragmentFor("cadeira");
    assert.equal(sut.state.logs.filter((line) => /sentado toca 'Sitting'/.test(line)).length, 1);
});

test("a spawn the game refuses falls back to a teleport; when both are refused nothing is played and the place stays free", () => {
    const sut = load({ props: [prop(CHAIR, 10, 10)] });
    sut.api.installFurniture();
    const anna = sut.player(1, 10.2, 10.2);
    anna.spawnWorks = false;
    assert.equal(sut.api.useSpot(anna, "cadeira", null).ok, true);
    assert.equal(anna.teleports.length, 1, "the second way");
    sut.api.release(1);

    const bruno = sut.player(2, 10.2, 10.2);
    bruno.spawnWorks = false;
    bruno.teleportWorks = false;
    const refused = plain(sut.api.useSpot(bruno, "cadeira", null));
    assert.equal(refused.ok, false);
    assert.match(refused.message, /Não consegui/);
    assert.equal(sut.api.sessionOf(2), null);
    assert.equal(bruno.emitted.length, 0, "the client is not told to wait for a body that is not coming");
    assert.equal(sut.api.useSpot(sut.player(3, 10.2, 10.2), "cadeira", null).ok, true, "and the seat is free");
});

test("a body that does not arrive is given up by the client's word, the seat freed and the player told; one that arrived is not", () => {
    const sut = load({ props: [prop(CHAIR, 10, 10)] });
    sut.api.installFurniture();
    const anna = sut.player(1, 10.2, 10.2);
    sut.api.useSpot(anna, "cadeira", null);
    sut.state.client.get("kcdc-gamemode:furniture.failed")(anna);
    assert.equal(sut.api.sessionOf(1), null);
    assert.ok(sut.state.chat.some((line) => /Não consegui acomodar/.test(line)));
    assert.equal(anna.animations.length, 0);

    const bruno = sut.player(2, 10.2, 10.2);
    sut.api.useSpot(bruno, "cadeira", null);
    sut.api.placed(bruno);
    sut.state.client.get("kcdc-gamemode:furniture.failed")(bruno);
    assert.notEqual(sut.api.sessionOf(2), null, "once sitting, a late 'failed' changes nothing");
});

test("a body the game moved off the seat after the animation began is put back, three times at most", () => {
    const sut = load({ props: [prop(CHAIR, 10, 10)] });
    sut.api.installFurniture();
    const anna = sut.player(1, 10.2, 10.2);
    sut.api.useSpot(anna, "cadeira", null);
    const drift = sut.state.client.get("kcdc-gamemode:furniture.drift");
    drift(anna);
    assert.equal(anna.spawns.length, 1, "nothing is put back before the animation has begun");
    sut.api.placed(anna);
    for (let i = 0; i < 5; i += 1) drift(anna);
    assert.equal(anna.spawns.length, 1 + sut.api.MAX_DRIFTS);
    assert.ok(sut.state.logs.some((line) => /saiu do assento/.test(line)));
});
