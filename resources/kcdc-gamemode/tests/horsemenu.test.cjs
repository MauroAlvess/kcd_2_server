const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
require("./reachpatch.cjs");

// E at a wild horse (src/server/horse-menu.ts): what is left of the menu of 2026-10-18 after 2026-11-09 (user: "vai ficar sem menu interativo o cavalo total ao apertar E, só monta direto
// nele"). A horse a player keeps has no menu of ours: E at it is the game's own "Montar". The wild horses (src/server/wild-horses.ts) hook in to tell a tamer's client which wild horse
// is near, and to answer its E.

function load() {
    const state = { handlers: new Map(), clients: new Map(), intervals: [], emitted: [], players: [], cleared: 0 };
    const horses = new Map();
    const context = {
        exports: {},
        Events: { on: (name, fn) => state.handlers.set(name, fn), onClient: (name, fn) => state.clients.set(name, fn) },
        setInterval: (fn, ms) => { state.intervals.push({ fn, ms }); return state.intervals.length; },
        clearInterval: () => { state.cleared += 1; },
        Horse: { getById: (id) => horses.get(id) ?? null },
        Player: { all: () => state.players },
        JSON,
        Math,
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/horse-menu.js"), "utf8"), context);
    context.exports.installHorseMenu();
    const player = (id = 1, extra = {}) => ({
        id, ready: true, alive: true, horse: null, position: { x: 2, y: 0, z: 0 },
        emit: (event, payload) => state.emitted.push({ id, event, payload }),
        ...extra,
    });
    const horse = (id, at, name = "Cavalo") => {
        const one = { id, name, alive: true, rider: null, position: at, owner: null };
        horses.set(id, one);
        return one;
    };
    return { api: context.exports, state, player, horse };
}

test("nothing is looked for while no module has a menu for any horse, and the look is on its own timer", () => {
    const sut = load();
    const hans = sut.player();
    sut.state.players = [hans];
    assert.equal(sut.state.intervals.length, 1);
    assert.equal(sut.state.intervals[0].ms, sut.api.horseMenu.nearEveryMs);
    sut.state.intervals[0].fn();
    assert.deepEqual(sut.state.emitted, [], "a kept horse is told of to nobody: its E is the game's own");
});

test("a wild horse near a tamer is told to their client with a flag, once, and of none when it is out of reach or the player climbs on", () => {
    const sut = load();
    const hans = sut.player();
    sut.state.players = [hans, sut.player(2)];
    const wild = sut.horse(8, { x: 1, y: 0, z: 0 }, "Cavalo selvagem");
    sut.api.nearExtras.push((who, reach) => (who.id === 1 && reach >= 1 ? { horse: wild, w: true, x: 1, y: 0, z: 0, distance: 1 } : null));

    const tick = sut.state.intervals[0].fn;
    tick();
    tick();
    assert.equal(sut.state.emitted.length, 1, "told once, and to the one who may only");
    assert.equal(sut.state.emitted[0].id, 1);
    assert.equal(sut.state.emitted[0].event, "kcdc-gamemode:horse.near");
    assert.deepEqual(JSON.parse(sut.state.emitted[0].payload), { id: 8, x: 1, y: 0, z: 0, w: 1 });

    sut.api.nearExtras.length = 0;
    sut.api.nearExtras.push(() => null);
    tick();
    assert.deepEqual(JSON.parse(sut.state.emitted[1].payload), { id: 0 }, "and told of none when it is out of reach");

    sut.api.nearExtras.length = 0;
    sut.api.nearExtras.push((who) => (who.id === 1 ? { horse: wild, w: true, x: 1, y: 0, z: 0, distance: 1 } : null));
    hans.horse = { id: 7 };
    tick();
    assert.deepEqual(JSON.parse(sut.state.emitted.at(-1).payload), { id: 0 }, "nor on a horse");
});

test("a player who is gone is forgotten, so that the next with the same number is told again; one who is not ready is not looked at", () => {
    const sut = load();
    const hans = sut.player();
    sut.state.players = [hans];
    const wild = sut.horse(8, { x: 1, y: 0, z: 0 });
    sut.api.nearExtras.push(() => ({ horse: wild, w: true, x: 1, y: 0, z: 0, distance: 1 }));
    const tick = sut.state.intervals[0].fn;
    tick();
    assert.equal(sut.state.emitted.length, 1);
    sut.state.handlers.get("playerDisconnect")(hans);
    tick();
    assert.equal(sut.state.emitted.length, 2, "told again after a disconnect");
    hans.ready = false;
    sut.state.handlers.get("playerDisconnect")(hans);
    tick();
    assert.equal(sut.state.emitted.length, 2, "and nothing for one who is not ready");
});

test("the E of the client is answered by the module that has a menu for that horse, and a horse nobody has a menu for gets none", () => {
    const sut = load();
    const hans = sut.player();
    const wild = sut.horse(8, { x: 1, y: 0, z: 0 });
    sut.horse(7, { x: 0, y: 0, z: 0 }, "Carpiado");
    const asked = [];
    sut.api.askExtras.push((who, horse) => { asked.push([who.id, horse.id]); return horse.id === 8 ? true : null; });

    assert.equal(sut.api.askMenu(hans, 8), true, "answered by the other module");
    assert.equal(sut.api.askMenu(hans, 7), false, "a horse a player keeps: no menu, the game's own climb");
    assert.deepEqual(asked, [[1, 8], [1, 7]]);
    assert.equal(sut.api.askMenu(hans, 99), false, "no such horse");
    assert.equal(sut.api.askMenu(hans, "8"), false, "no number");
    hans.horse = { id: 7 };
    assert.equal(sut.api.askMenu(hans, 8), false, "nobody on a horse is asked about another");
    assert.equal(wild.id, 8);
});

test("the client's word reaches the module in either shape the framework hands it, and a broken one is ignored", () => {
    const sut = load();
    const hans = sut.player();
    sut.horse(8, { x: 1, y: 0, z: 0 });
    const asked = [];
    sut.api.askExtras.push((who, horse) => { asked.push([who.id, horse.id]); return true; });
    const ask = sut.state.clients.get("kcdc-gamemode:horse.menu");
    ask(hans, JSON.stringify({ id: 8 }));
    ask(hans, { id: 8 });
    ask(hans, "{");
    ask(hans, null);
    assert.deepEqual(asked, [[1, 8], [1, 8]]);
});

test("the look stops with the resource", () => {
    const sut = load();
    sut.state.handlers.get("resourceStop")("outro-recurso");
    assert.equal(sut.state.cleared, 0);
    sut.state.handlers.get("resourceStop")("kcdc-gamemode");
    assert.equal(sut.state.cleared, 1);
});
