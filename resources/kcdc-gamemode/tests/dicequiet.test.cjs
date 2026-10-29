"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

// The other players' dice matches, seen from this machine (src/client/dice-quiet.ts): the server says who plays and where; the
// dice sounds of the two bodies and of the table's own entity are stopped here, unless this machine is at that table.

function load({ me = { ready: true, id: 50 }, entities = { 1: 101, 2: 102 } } = {}) {
    const state = { handlers: new Map(), tick: null, stopped: [], stoppedAll: [], radius: [], failTable: false, timer: null };
    class Player {
        constructor(id) {
            if (!(id in entities)) throw new Error("no such player here");
            this.id = id;
            this.entityId = entities[id];
        }
    }
    const context = {
        exports: {},
        console,
        Math,
        JSON,
        Number,
        Array,
        LocalPlayer: me,
        Player,
        Vector3: function (x, y, z) { this.x = x; this.y = y; this.z = z; },
        Audio: {
            stopOnEntity: (trigger, entity) => { state.stopped.push([trigger, entity]); return true; },
            stopAllOnEntity: (entity) => { state.stoppedAll.push(entity); return true; },
        },
        World: {
            entitiesInRadius: (centre, radius, options) => {
                if (state.failTable) throw new Error("not streamed");
                state.radius.push([centre.x, centre.y, centre.z, radius, options.class]);
                return [{ entityId: 900, class: "SmartObjectHolder" }];
            },
        },
        Events: { on: (name, fn) => state.handlers.set(name, fn) },
        setInterval: (fn, ms) => { state.tick = fn; state.timer = ms; return 1; },
        clearInterval() { state.tick = null; },
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/client/dice-quiet.js"), "utf8"), context);
    context.exports.installDiceQuiet();
    const busy = (matches) => state.handlers.get("kcdc-gamemode:dice.busy")(typeof matches === "string" ? matches : JSON.stringify({ matches }));
    return { api: context.exports, state, me, busy };
}

const MATCH = { ids: [1, 2], at: { x: 10, y: 20, z: 30 } };

test("the server says who plays: those two are not to be talked to, nobody else is, and the list is replaced as a whole", () => {
    const sut = load();
    assert.equal(sut.api.playingDice(1), false);
    sut.busy([MATCH]);
    assert.equal(sut.api.playingDice(1), true);
    assert.equal(sut.api.playingDice(2), true);
    assert.equal(sut.api.playingDice(3), false);
    sut.busy([]);
    assert.equal(sut.api.playingDice(1), false, "the match over");
    sut.busy([MATCH]);
    sut.busy("not json");
    assert.equal(sut.api.playingDice(1), false, "a message that cannot be read says nobody plays");
    sut.busy([{ ids: ["x"], at: MATCH.at }, { ids: [], at: MATCH.at }, { ids: [3], at: { x: 1, y: 2 } }, { ids: [4], at: { x: 1, y: 2, z: 3 } }]);
    assert.deepEqual(Array.from(sut.api.diceMatches(), (match) => Array.from(match.ids)), [[4]], "only whole entries are kept");
});

test("this machine stops every dice sound on the two bodies and on the table's entity, many times a second", () => {
    const sut = load();
    sut.busy([MATCH]);
    sut.state.tick();
    const triggers = Array.from(sut.api.DICE_SOUNDS);
    assert.ok(triggers.includes("dice_table") && triggers.includes("dice_shake") && triggers.includes("dice_foley1"));
    assert.deepEqual(sut.state.stopped.filter(([, entity]) => entity === 101).map(([trigger]) => trigger), triggers);
    assert.deepEqual(sut.state.stopped.filter(([, entity]) => entity === 102).map(([trigger]) => trigger), triggers);
    assert.equal(sut.state.stopped.length, triggers.length * 2);
    assert.deepEqual(sut.state.stoppedAll, [900], "the table itself, whatever it plays");
    assert.deepEqual(sut.state.radius, [[10, 20, 30, sut.api.TABLE_ENTITY_M, "SmartObjectHolder"]]);
    assert.ok(sut.state.timer <= 100, "often enough that what leaks is a click, not the fall of the dice");
});

test("the table's own players hear their game; nothing is stopped before the match, or after, or while the player is not in the world", () => {
    const player = load({ me: { ready: true, id: 1 } });
    player.busy([MATCH]);
    player.state.tick();
    assert.deepEqual(player.state.stopped, []);
    assert.deepEqual(player.state.stoppedAll, []);

    const sut = load();
    sut.state.tick();
    assert.deepEqual(sut.state.stopped, [], "no match, no work");
    sut.busy([MATCH]);
    sut.busy([]);
    sut.state.tick();
    assert.deepEqual(sut.state.stopped, []);

    const loading = load({ me: { ready: false, id: 50 } });
    loading.busy([MATCH]);
    loading.state.tick();
    assert.deepEqual(loading.state.stopped, []);
});

test("a body this machine does not have, or a table not streamed in, is skipped without an error; the other body is still silenced", () => {
    const sut = load({ entities: { 2: 102 } });
    sut.busy([MATCH]);
    sut.state.failTable = true;
    assert.doesNotThrow(() => sut.state.tick());
    assert.deepEqual(new Set(sut.state.stopped.map(([, entity]) => entity)), new Set([102]));
    assert.deepEqual(sut.state.stoppedAll, []);

    const gone = load({ entities: { 1: 0, 2: 0 } });
    gone.busy([MATCH]);
    gone.state.tick();
    assert.deepEqual(gone.state.stopped, [], "an entity id of 0 is no body");
});

test("the resource stopping ends the work", () => {
    const sut = load();
    sut.busy([MATCH]);
    sut.state.handlers.get("resourceStop")("other");
    assert.ok(sut.state.tick);
    sut.state.handlers.get("resourceStop")("kcdc-gamemode");
    assert.equal(sut.state.tick, null);
    assert.equal(sut.api.playingDice(1), false);
});
