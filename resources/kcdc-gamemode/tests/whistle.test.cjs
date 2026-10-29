const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// X calls the player's horse (src/client/whistle.ts), and only while the player is in the world: not on a game screen,
// in a conversation, with a book open or with one of the mod's pages up.

function load() {
    const state = {
        now: 1_000_000, server: [], dialogue: false, controls: true, book: null, visible: new Set(), keys: new Map(), listeners: new Map(), played: [], triggers: new Set(["v_horse_whistle"]),
        bodies: new Map([[5, { local: false, entityId: 55 }], [6, { local: true, entityId: 66 }], [7, { local: false, entityId: 0 }]]),
    };
    const context = {
        exports: {},
        Date: { now: () => state.now },
        get LocalPlayer() { return { ready: true, alive: true }; },
        Key: { bind: (key, phase, fn) => { state.keys.set(key, fn); return true; } },
        Hud: { isInDialogue: () => state.dialogue },
        Controls: { isEnabled: () => state.controls },
        Book: { getOpenBook: () => state.book },
        NativeUI: { element: (name) => ({ visible: state.visible.has(name), valid: true }) },
        Events: { emitServer: (name) => state.server.push(name), on: (name, fn) => state.listeners.set(name, fn) },
        Audio: { hasTrigger: (trigger) => state.triggers.has(trigger), playOnEntity: (trigger, entity) => { state.played.push([trigger, entity]); return true; } },
        Player: class { constructor(id) { Object.assign(this, state.bodies.get(id) ?? { local: false, entityId: 0 }); } },
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/client/whistle.js"), "utf8"), context);
    context.exports.installWhistle();
    const press = () => {
        state.now += 3_000;
        state.keys.get("x")();
    };
    return { state, press, api: context.exports };
}

test("X calls the horse, once for a press held or repeated at once", () => {
    const sut = load();
    sut.press();
    assert.deepEqual(sut.state.server, ["kcdc-gamemode:horse.whistle"]);
    sut.state.keys.get("x")();
    assert.equal(sut.state.server.length, 1, "pressed again at once");
});

test("X confirming on one of the game's screens does not call the horse", () => {
    for (const screen of ["ItemSelection", "ItemTransfer", "SkipTime", "GeneralBook", "LockPicking", "HorseInspect"]) {
        const sut = load();
        sut.state.visible.add(screen);
        sut.press();
        assert.deepEqual(sut.state.server, [], screen);
        sut.state.visible.clear();
        sut.press();
        assert.equal(sut.state.server.length, 1, `${screen} closed: X calls again`);
    }
});

test("in the pause menu, or any menu, X calls nothing (user, 2026-10-18); a screen over the menu is no different", () => {
    const sut = load();
    sut.state.visible.add("Menu");
    sut.state.controls = false;
    sut.press();
    assert.deepEqual(sut.state.server, [], "the horse's bag is E at the horse now");
    sut.state.visible.add("ItemSelection");
    sut.press();
    assert.deepEqual(sut.state.server, []);
});

test("nor in a conversation, with a book open, or with one of the mod's pages holding the keyboard", () => {
    const talking = load();
    talking.state.dialogue = true;
    talking.press();
    const reading = load();
    reading.state.book = 41;
    reading.press();
    const panel = load();
    panel.state.controls = false;
    panel.press();
    assert.deepEqual([talking.state.server, reading.state.server, panel.state.server], [[], [], []]);
});

// 2026-10-22: "tem como colocar para os jogadores escutarem o assobio quando um jogador aperta X": the server tells those near a whistler,
// and the game's own horse whistle is played on that body.

test("somebody else's whistle is played on their body; never one's own, a body that is not there, or a sound this game does not have", () => {
    const sut = load();
    const heard = sut.state.listeners.get("kcdc-gamemode:whistle.heard");
    assert.equal(sut.api.WHISTLE_SOUND, "v_horse_whistle");
    heard(JSON.stringify({ id: 5 }));
    assert.deepEqual(sut.state.played, [["v_horse_whistle", 55]]);
    heard({ id: 5 });
    assert.equal(sut.state.played.length, 2, "a payload that is already an object");
    heard(JSON.stringify({ id: 6 }));
    heard(JSON.stringify({ id: 7 }));
    heard(JSON.stringify({ id: "5" }));
    heard("not json");
    heard(JSON.stringify({}));
    assert.equal(sut.state.played.length, 2, "not one's own (the game plays that), a body with no entity, nonsense");
    sut.state.triggers.clear();
    heard(JSON.stringify({ id: 5 }));
    assert.equal(sut.state.played.length, 2, "and nothing when the sound is not in this game's audio data");
});
