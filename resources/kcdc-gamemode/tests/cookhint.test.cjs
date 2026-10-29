"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
require("./reachpatch.cjs");

// Our "Cozinhar"/"Forjar" hint (src/client/cook-hint.ts) shares E with the game's own prompt: the game's screens that come up with
// our press are closed, and at a forge the game's crafting menu is kept off.

function load() {
    const clock = { t: 1_000_000 };
    const state = { hints: [], removed: [], emitted: [], menus: [], actions: [], keys: [], screens: new Map(), handlers: new Map(), tick: null, rays: [], aimHit: null, smith: true };
    const screen = (name) => {
        if (!state.screens.has(name)) {
            const el = { visible: false, closes: 0, call(fn, args) { if (fn === "Close") { this.closes += 1; this.args = args; this.visible = false; } }, hide() { this.visible = false; } };
            state.screens.set(name, el);
        }
        return state.screens.get(name);
    };
    const me = { ready: true, alive: true, position: { x: 0, y: 0, z: 0 } };
    const context = {
        exports: {},
        require: (id) => (id === "./interaction.js" ? { getPersonInView: () => null, isInteractionTargetVisible: () => state.aimOff !== true } : id === "./furniture.js" ? { furnitureBusy: () => state.seated === true } : id === "./trade-rights.js" ? { mayForge: () => state.smith } : id === "./mural.js" ? { muralHasArt: () => state.haveArt === true, muralOpen: () => state.muralOpen === true, muralPressed: () => { state.muralPressed = (state.muralPressed ?? 0) + 1; } } : assert.fail(`unexpected require ${id}`)),
        console,
        Math,
        JSON,
        Number,
        Array,
        Date: { now: () => clock.t },
        LocalPlayer: me,
        ActionHint: {
            create: (options, handler) => { state.hints.push({ options, handler }); return state.hints.length; },
            setText: (hint, text) => { state.hints[hint - 1].options.text = text; return true; },
            remove: (hint) => { state.removed.push(hint); return true; },
            // The game's own prompts the HUD draws (2026-10-25): what the game's E at a fire would do, in the player's language.
            shown: () => state.shown ?? [],
        },
        Events: { on: (name, fn) => state.handlers.set(name, fn), emitServer: (name, payload) => state.emitted.push({ name, payload }) },
        // The game's own E, held back where ours stands in for it (2026-10-22), and the key that is then ours.
        Controls: { disableAction: (action) => state.actions.push(["off", action]), enableAction: (action) => state.actions.push(["on", action]), isEnabled: () => true },
        Hud: { isInDialogue: () => false },
        Key: { bind: (key, edge, fn) => state.keys.push({ key, edge, fn }) },
        NativeUI: { element: (name) => screen(name), setMenuEnabled: (menu, enabled) => state.menus.push([menu, enabled]) },
        // What the aim meets first: nothing unless a test puts something there.
        Camera: { screenRay: () => state.ray ?? { origin: { x: 0, y: 0, z: 1.7 }, direction: { x: 1, y: 0, z: 0 } } },
        World: { raycast: (from, to, options) => { if (state.aimThrows) throw new Error("no view"); state.rays.push(options); return state.aimHit; } },
        Vector3: function (x, y, z) { this.x = x; this.y = y; this.z = z; },
        setInterval: (fn) => { state.tick = fn; return 1; },
        clearInterval() {},
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/client/cook-hint.js"), "utf8"), context);
    context.exports.installCookHint();
    const places = (list) => state.handlers.get("kcdc-gamemode:cook.stations")(JSON.stringify(list));
    return { api: context.exports, state, me, clock, screen, places };
}

test("at a fire our hint is on F, the E being the game's (Comer da panela); the game's food picker is closed with or without a press of ours", () => {
    const sut = load();
    sut.places([[0, 10, 10, 100]]);
    sut.me.position = { x: 11, y: 10, z: 100 };
    sut.state.tick();
    assert.equal(sut.state.hints[0].options.text, "Cozinhar");
    assert.equal(sut.state.hints[0].options.key, "attack_special", "F: the E is the pot's, which nothing can move (2026-10-20)");
    assert.equal(sut.api.FIRE_KEY, "attack_special");

    // The game's own E at the fire: its picker comes up with no press of ours; ours is the cooking, so it is closed and the server says why.
    sut.screen("ItemSelection").visible = true;
    sut.state.tick();
    assert.equal(sut.screen("ItemSelection").closes, 1, "the game's own cooking is not the way to cook here");
    assert.deepEqual(JSON.parse(sut.state.emitted[0].payload), { screen: "ItemSelection", kind: 0, own: false });
    assert.equal(sut.state.emitted[0].name, "kcdc-gamemode:cook.native");

    sut.state.hints[0].handler();
    const asked = sut.state.emitted.find((one) => one.name === "kcdc-gamemode:cook.menu");
    assert.deepEqual(JSON.parse(JSON.stringify(asked)), { name: "kcdc-gamemode:cook.menu", payload: { kind: 0, x: 10, y: 10 } }, "the kind and the place the hint was on");
    sut.screen("ItemSelection").visible = true;
    sut.clock.t += 600;
    sut.state.tick();
    assert.equal(sut.screen("ItemSelection").closes, 2);
    assert.deepEqual(Array.from(sut.screen("ItemSelection").args), [true], "closed by force, as the game closes it");
    assert.deepEqual(JSON.parse(sut.state.emitted.at(-1).payload), { screen: "ItemSelection", kind: 0 }, "after a press of ours it is our menu's own");

    assert.deepEqual(sut.state.menus, [], "the crafting menu is a forge's business");
});

test("the game's screens beside a fire are left alone when the aim is not on it, and its goods screen is closed only after a press of ours", () => {
    const sut = load();
    sut.places([[0, 10, 10, 100]]);
    sut.me.position = { x: 11, y: 10, z: 100 };
    sut.state.tick();
    sut.screen("ItemTransfer").visible = true;
    sut.state.tick();
    assert.equal(sut.screen("ItemTransfer").closes, 0, "a chest beside the fire is the player's own screen");

    sut.state.hints[0].handler();
    sut.clock.t += 600;
    sut.state.tick();
    assert.equal(sut.screen("ItemTransfer").closes, 1, "after our press, as before");
    sut.clock.t += sut.api.NATIVE.watchMs;
    sut.screen("ItemTransfer").visible = true;
    sut.screen("ItemSelection").visible = true;
    sut.state.tick();
    assert.equal(sut.screen("ItemTransfer").closes, 1, "the watch is over");
    assert.equal(sut.screen("ItemSelection").closes, 1, "but the fire's picker is still the fire's alone while the hint is up");

    // Away from the fire, nothing of the game's is touched.
    const far = load();
    far.places([[0, 10, 10, 100]]);
    far.me.position = { x: 300, y: 300, z: 100 };
    far.state.tick();
    far.screen("ItemSelection").visible = true;
    far.state.tick();
    assert.equal(far.screen("ItemSelection").closes, 0);
});

test("every other place keeps E; a hint changes key when the place does, from the fire's F to a rack's E and back", () => {
    for (const [kind, text] of [[1, "Secar"], [2, "Defumar"], [3, "Forjar"], [4, "Preparar"], [5, "Sentar"], [6, "Deitar"]]) {
        const sut = load();
        sut.places([[kind, 10, 10, 100]]);
        sut.me.position = { x: 11, y: 10, z: 100 };
        sut.state.tick();
        assert.equal(sut.state.hints[0].options.text, text);
        assert.equal(sut.state.hints[0].options.key, "primary_action", text);
        // The game's picker without a press of ours is the player's own away from a fire.
        sut.screen("ItemSelection").visible = true;
        sut.state.tick();
        assert.equal(sut.screen("ItemSelection").closes, 0, text);
    }

    const sut = load();
    sut.places([[0, 10, 10, 100], [1, 40, 40, 100]]);
    sut.me.position = { x: 11, y: 10, z: 100 };
    sut.state.tick();
    assert.equal(sut.state.hints.length, 1);
    assert.equal(sut.state.hints[0].options.key, "attack_special");
    sut.me.position = { x: 41, y: 40, z: 100 };
    sut.state.tick();
    assert.deepEqual(sut.state.removed, [1], "the F hint goes");
    assert.equal(sut.state.hints.length, 2);
    assert.equal(sut.state.hints[1].options.key, "primary_action");
    assert.equal(sut.state.hints[1].options.text, "Secar");
    sut.me.position = { x: 11, y: 10, z: 100 };
    sut.state.tick();
    assert.equal(sut.state.hints.length, 3);
    assert.equal(sut.state.hints[2].options.key, "attack_special");
});

test("at a forge the game's crafting menu is kept off while our Forjar is up, and a moment after our press", () => {
    const sut = load();
    sut.places([[3, 50, 50, 20]]);
    sut.me.position = { x: 51, y: 50, z: 20 };
    sut.state.tick();
    assert.equal(sut.state.hints[0].options.text, "Forjar");
    assert.deepEqual(sut.state.menus, [["crafting", false]]);
    sut.state.tick();
    assert.equal(sut.state.menus.length, 1, "said once");

    sut.state.hints[0].handler();
    sut.me.position = { x: 200, y: 200, z: 20 };
    sut.state.tick();
    assert.equal(sut.state.menus.length, 1, "still off just after the press, though the hint went");
    sut.clock.t += sut.api.NATIVE.watchMs + 1;
    sut.state.tick();
    assert.deepEqual(sut.state.menus.at(-1), ["crafting", true], "given back");

    sut.state.handlers.get("resourceStop")("kcdc-gamemode");
    assert.deepEqual(sut.state.menus.at(-1), ["crafting", true]);
});

test("aimed at the grindstone beside a forge, our Forjar stays down and E is the game's sharpening alone", () => {
    const sut = load();
    sut.places([[3, 50, 50, 20]]);
    sut.me.position = { x: 51, y: 50, z: 20 };
    sut.state.aimHit = { kind: "entity", entityClass: "Grindstone", distance: 1.5 };
    sut.state.tick();
    assert.equal(sut.state.hints.length, 0, "no Forjar at the grindstone");
    assert.equal(sut.state.rays.at(-1).mode, "anything");
    assert.equal(sut.state.rays.at(-1).ignoreSelf, true);
    sut.state.aimHit = { kind: "entity", entityClass: "GeomEntity", distance: 1.5 };
    sut.state.tick();
    assert.equal(sut.state.hints[0].options.text, "Forjar", "the anvil beside it is still the forge");
    sut.state.aimHit = { kind: "entity", entityClass: "Grindstone", distance: 1.5 };
    sut.state.tick();
    assert.ok(sut.state.removed.includes(1), "turning to the grindstone takes Forjar down");
});

test("the game's blade picker after our Forjar is the grindstone's: it stays open and our menu is closed instead", () => {
    const sut = load();
    sut.places([[3, 50, 50, 20]]);
    sut.me.position = { x: 51, y: 50, z: 20 };
    sut.state.tick();
    sut.state.hints[0].handler();
    sut.screen("ItemSelection").visible = true;
    sut.state.tick();
    assert.equal(sut.screen("ItemSelection").closes, 0, "the sharpening screen is left alone");
    const cancel = sut.state.emitted.find((one) => one.name === "kcdc-gamemode:cook.cancel");
    assert.ok(cancel, "the server is asked to close our menu");
    assert.deepEqual(JSON.parse(cancel.payload), { screen: "ItemSelection", kind: 3 });
    sut.state.tick();
    assert.equal(sut.state.emitted.filter((one) => one.name === "kcdc-gamemode:cook.cancel").length, 1, "asked once");
});

test("a chair and a bed of the World Builder show Sentar and Deitar; while the body sits or lies no hint of this kind is up", () => {
    const sut = load();
    sut.places([[5, 10, 10, 100], [6, 30, 30, 100]]);
    sut.me.position = { x: 11, y: 10, z: 100 };
    sut.state.tick();
    assert.equal(sut.state.hints[0].options.text, "Sentar");
    sut.state.hints[0].handler();
    assert.deepEqual(JSON.parse(JSON.stringify(sut.state.emitted.at(-1))), { name: "kcdc-gamemode:cook.menu", payload: { kind: 5, x: 10, y: 10 } });
    sut.state.seated = true;
    sut.state.tick();
    assert.equal(sut.state.removed.length, 1, "seated: the hint goes");
    sut.state.seated = false;
    sut.me.position = { x: 31, y: 30, z: 100 };
    sut.state.tick();
    assert.equal(sut.state.hints.at(-1).options.text, "Deitar");
});

test("aimed at a chest or a door beside a bed or a chair, our Deitar and Sentar stay down: E opens the chest (2026-10-20)", () => {
    const sut = load();
    sut.places([[6, 50, 50, 20]]);
    sut.me.position = { x: 51, y: 50, z: 20 };
    sut.state.aimHit = { kind: "entity", entityClass: "Stash", distance: 1.2 };
    sut.state.tick();
    assert.equal(sut.state.hints.length, 0, "no Deitar on the chest at the foot of the bed");
    sut.state.aimHit = { kind: "entity", entityClass: "GeomEntity", distance: 1.2 };
    sut.state.tick();
    assert.equal(sut.state.hints[0].options.text, "Deitar", "the bed itself");
    sut.state.aimHit = { kind: "entity", entityClass: "AnimDoor", distance: 1.2 };
    sut.state.tick();
    assert.ok(sut.state.removed.includes(1), "a door takes it down too");
    const forge = load();
    forge.places([[3, 50, 50, 20]]);
    forge.me.position = { x: 51, y: 50, z: 20 };
    forge.state.aimHit = { kind: "entity", entityClass: "Stash", distance: 1.2 };
    forge.state.tick();
    assert.equal(forge.state.hints[0].options.text, "Forjar", "a chest by a forge does not take Forjar down");
});

test("at a forge the game's own E is held back while our Forjar is up, and E is read by the key: the menu, and nothing half begun by the game (2026-10-22)", () => {
    const sut = load();
    sut.places([[3, 50, 50, 20]]);
    sut.me.position = { x: 51, y: 50, z: 20 };
    sut.state.tick();
    assert.equal(sut.state.hints[0].options.text, "Forjar");
    assert.deepEqual(sut.state.actions, [["off", "use"], ["off", "trigger_use"]], "the game's use is off");
    sut.state.tick();
    assert.equal(sut.state.actions.length, 2, "held once, not at every look");

    const key = sut.state.keys.find((one) => one.key === "e");
    assert.ok(key, "E is bound by us");
    key.fn();
    assert.deepEqual(JSON.parse(JSON.stringify(sut.state.emitted.at(-1))), { name: "kcdc-gamemode:cook.menu", payload: { kind: 3, x: 50, y: 50 } });
    const asked = sut.state.emitted.length;
    key.fn();
    sut.state.hints[0].handler();
    assert.equal(sut.state.emitted.length, asked + 1, "the hint's own press and the key's are one press, not two");
    sut.clock.t += 800;

    // Away from the forge the game has its E back.
    sut.me.position = { x: 200, y: 200, z: 20 };
    sut.state.tick();
    assert.deepEqual(sut.state.actions.slice(-2), [["on", "use"], ["on", "trigger_use"]]);
    sut.clock.t += 800;
    key.fn();
    assert.equal(sut.state.emitted.length, asked + 1, "and E is not ours any more");
});

test("the other places keep the game's E: only the forge, the smokehouse, the rack, the alchemy table and a fire with no meal hold it back", () => {
    for (const place of [[0, 10, 10, 100, 1], [5, 10, 10, 100], [6, 10, 10, 100]]) {
        const sut = load();
        sut.places([place]);
        sut.me.position = { x: 11, y: 10, z: 100 };
        sut.state.tick();
        assert.equal(sut.state.hints.length, 1, `kind ${place[0]}`);
        assert.deepEqual(sut.state.actions, [], `kind ${place[0]}: the game's use is left alone`);
    }
});

test("at a smokehouse and at a rack the game's own E is held back while our Defumar and Secar are up, and E is read by the key (2026-10-23: the smokehouse trapped the players as the forge had)", () => {
    for (const [kind, text] of [[2, "Defumar"], [1, "Secar"]]) {
        const sut = load();
        sut.places([[kind, 70, 70, 30]]);
        sut.me.position = { x: 71, y: 70, z: 30 };
        sut.state.tick();
        assert.equal(sut.state.hints[0].options.text, text);
        assert.deepEqual(sut.state.actions, [["off", "use"], ["off", "trigger_use"]], `${text}: the game's use is off`);
        sut.state.tick();
        assert.equal(sut.state.actions.length, 2, "held once, not at every look");

        const key = sut.state.keys.find((one) => one.key === "e");
        key.fn();
        assert.deepEqual(JSON.parse(JSON.stringify(sut.state.emitted.at(-1))), { name: "kcdc-gamemode:cook.menu", payload: { kind, x: 70, y: 70 } }, "E asks the server for the trade's menu");
        const asked = sut.state.emitted.length;
        key.fn();
        sut.state.hints[0].handler();
        assert.equal(sut.state.emitted.length, asked + 1, "the hint's own press and the key's are one press, not two");

        // The game's goods screen a press opens is still shut, as before.
        sut.screen("ItemTransfer").visible = true;
        sut.state.tick();
        assert.equal(sut.screen("ItemTransfer").closes, 1);

        // Away from the place the game has its E back.
        sut.me.position = { x: 200, y: 200, z: 30 };
        sut.state.tick();
        assert.deepEqual(sut.state.actions.slice(-2), [["on", "use"], ["on", "trigger_use"]]);
    }
});

test("at an alchemy table the game's own E is held back while our Preparar is up, and the game's crafting menu is kept off (2026-10-24: the table trapped the players as the forge had)", () => {
    const sut = load();
    sut.places([[4, 90, 90, 40]]);
    sut.me.position = { x: 91, y: 90, z: 40 };
    sut.state.tick();
    assert.equal(sut.state.hints[0].options.text, "Preparar");
    assert.deepEqual(sut.state.actions, [["off", "use"], ["off", "trigger_use"]], "the game's use is off");
    assert.deepEqual(sut.state.menus.at(-1), ["crafting", false], "and its crafting menu is kept off while the hint is up");
    sut.state.tick();
    assert.equal(sut.state.actions.length, 2, "held once, not at every look");

    const key = sut.state.keys.find((one) => one.key === "e");
    key.fn();
    assert.deepEqual(JSON.parse(JSON.stringify(sut.state.emitted.at(-1))), { name: "kcdc-gamemode:cook.menu", payload: { kind: 4, x: 90, y: 90 } }, "E asks the server for the trade's menu");
    const asked = sut.state.emitted.length;
    key.fn();
    sut.state.hints[0].handler();
    assert.equal(sut.state.emitted.length, asked + 1, "the hint's own press and the key's are one press, not two");

    sut.me.position = { x: 200, y: 200, z: 40 };
    sut.state.tick();
    assert.deepEqual(sut.state.actions.slice(-2), [["on", "use"], ["on", "trigger_use"]], "away from the table the game has its E back");
});

test("aimed at a door or a chest by a smokehouse or a rack, our hint stays down and E is the game's: the hut's own door still opens", () => {
    for (const kind of [2, 1]) {
        const sut = load();
        sut.places([[kind, 70, 70, 30]]);
        sut.me.position = { x: 71, y: 70, z: 30 };
        sut.state.aimHit = { kind: "entity", entityClass: "AnimDoor", distance: 1.4 };
        sut.state.tick();
        assert.equal(sut.state.hints.length, 0, `kind ${kind}: no hint at the door`);
        assert.deepEqual(sut.state.actions, [], "and the game's use is not held back");
        sut.state.aimHit = { kind: "entity", entityClass: "Stash", distance: 1.4 };
        sut.state.tick();
        assert.equal(sut.state.hints.length, 0, "nor at a chest");
        sut.state.aimHit = null;
        sut.state.tick();
        assert.equal(sut.state.hints.length, 1, "turned back to the place itself, the hint is up");
        assert.deepEqual(sut.state.actions, [["off", "use"], ["off", "trigger_use"]]);
    }
});

test("the grindstone beside a forge is everybody's (2026-10-22: \"vamos deixar liberado para todo mundo mesmo\"): the game's E stays on at it for a player who is no smith, and ours says nothing", () => {
    const sut = load();
    sut.places([[3, 50, 50, 20]]);
    sut.me.position = { x: 51, y: 50, z: 20 };
    sut.state.aimHit = { kind: "entity", entityClass: "Grindstone", distance: 1.5 };
    sut.state.tick();
    assert.equal(sut.state.hints.length, 0, "no Forjar there");
    assert.deepEqual(sut.state.actions, [], "and the game's use is left on: its own sharpening answers the E, from any angle");
    const key = sut.state.keys.find((one) => one.key === "e");
    key.fn();
    assert.equal(sut.state.emitted.some((one) => one.name === "kcdc-gamemode:cook.grindstone"), false, "no word is sent about whose it is");

    // Turning to the forge itself holds the game's E back for its own menu, as before.
    sut.state.aimHit = { kind: "entity", entityClass: "GeomEntity", distance: 1.5 };
    sut.state.tick();
    assert.equal(sut.state.hints[0].options.text, "Forjar");
    assert.deepEqual(sut.state.actions, [["off", "use"], ["off", "trigger_use"]]);
});

test("whatever goes wrong while the aim is read, the game's own E is given back and not left off (2026-10-22)", () => {
    const sut = load();
    sut.places([[3, 50, 50, 20]]);
    sut.me.position = { x: 51, y: 50, z: 20 };
    sut.state.tick();
    assert.deepEqual(sut.state.actions, [["off", "use"], ["off", "trigger_use"]]);
    // The view cannot be read for a frame: the aim check throws.
    sut.me.position = { x: 52, y: 50, z: 20 };
    sut.state.aimThrows = true;
    sut.state.tick();
    assert.deepEqual(sut.state.actions.slice(-2), [["on", "use"], ["on", "trigger_use"]], "released");
});

test("a notice board (kind 7) shows its hint on F, like the fire's; the press tells the server the kind, the place and whether the pictures are there; the game's E stays the game's", () => {
    const sut = load();
    sut.places([[7, 583.3, 3254.1, 146.9]]);
    sut.me.position = { x: 583.3, y: 3256, z: 147 };
    sut.state.tick();
    assert.equal(sut.state.hints[0].options.text, "Quadro de avisos");
    assert.equal(sut.state.hints[0].options.key, "attack_special", "F, which the fire has too: no other place of ours is near a board");
    assert.deepEqual(sut.state.actions, [], "the game's use is not held back for a board");
    assert.equal(sut.api.OWN_E_KINDS.includes(7), false);

    sut.state.hints[0].handler();
    assert.deepEqual(JSON.parse(JSON.stringify(sut.state.emitted.at(-1))), { name: "kcdc-gamemode:cook.menu", payload: { kind: 7, x: 583.3, y: 3254.1, art: false } });
    assert.equal(sut.state.muralPressed, 1, "the page is told the next board is wanted");
    sut.state.haveArt = true;
    sut.state.hints[0].handler();
    assert.equal(sut.state.emitted.at(-1).payload.art, true, "once the pictures are in the client's hands, the server leaves them out");

    // Too far: no hint. Near but the page is up: none either.
    sut.me.position = { x: 583.3, y: 3270, z: 147 };
    sut.state.tick();
    assert.deepEqual(sut.state.removed, [1]);
});

test("while the board's page is on the screen its hint is down, and it comes back when the page is shut", () => {
    const sut = load();
    sut.places([[7, 583.3, 3254.1, 146.9]]);
    sut.me.position = { x: 583.3, y: 3256, z: 147 };
    sut.state.muralOpen = true;
    sut.state.tick();
    assert.deepEqual(sut.state.hints, []);
    sut.state.muralOpen = false;
    sut.state.tick();
    assert.equal(sut.state.hints.length, 1);
});

test("aimed at a fire with no meal in its pot the game's own E Cozinhar is held for as long as the aim is there, with no lapse (2026-10-28: \"o E de cozinhar item no fogo aparece ainda\")", () => {
    const sut = load();
    sut.places([[0, 10, 10, 100]]);
    sut.me.position = { x: 11, y: 10, z: 100 };
    sut.state.tick();
    assert.deepEqual(sut.state.actions, [["off", "use"], ["off", "trigger_use"]], "held before the game ever draws its prompt");
    assert.equal(sut.state.hints[0].options.key, "attack_special", "our Cozinhar stays on F");

    // Held back, the game takes its prompt down; until 2026-10-28 the hold lapsed then, the prompt came back, and an E in that moment opened the game's picker.
    sut.state.shown = [];
    for (let look = 0; look < 40; look += 1) {
        sut.clock.t += 150;
        sut.state.tick();
    }
    assert.equal(sut.state.actions.length, 2, "six seconds at the fire: held all along, never given back");
    sut.state.keys.find((k) => k.key === "e").fn();
    assert.equal(sut.state.emitted.filter((one) => one.name === "kcdc-gamemode:cook.menu").length, 0, "E opens nothing of ours at a fire");

    // A door or a chest before the fire in the aim: theirs is the E.
    sut.state.aimHit = { kind: "entity", entityClass: "Stash", distance: 1.2 };
    sut.state.tick();
    assert.deepEqual(sut.state.actions.slice(-2), [["on", "use"], ["on", "trigger_use"]], "the chest's E is the game's");
    sut.state.aimHit = null;
    sut.state.tick();
    assert.deepEqual(sut.state.actions.slice(-2), [["off", "use"], ["off", "trigger_use"]]);

    // Away from the fire the game has its E back.
    sut.me.position = { x: 20, y: 10, z: 100 };
    sut.state.tick();
    assert.deepEqual(sut.state.actions.slice(-2), [["on", "use"], ["on", "trigger_use"]]);
});

test("at a pot with a meal the pot's Comer keeps E, and the game's Cozinhar, once seen, is held until the aim turns or the body moves", () => {
    const sut = load();
    sut.places([[0, 10, 10, 100, 1]]);
    sut.me.position = { x: 11, y: 10, z: 100 };
    const held = () => sut.state.actions.filter(([on]) => on === "off").length;

    sut.state.shown = [{ key: "use", map: "player", text: "Comer" }, { key: "attack_special", map: "player", text: "Cozinhar" }];
    sut.state.tick();
    assert.equal(held(), 0, "aimed at the pot: E eats, as the game does; our own Cozinhar on F is not the game's");

    sut.state.shown = [{ key: "use", map: "player", text: "Cozinhar" }];
    sut.clock.t += 150;
    sut.state.tick();
    assert.deepEqual(sut.state.actions.slice(-2), [["off", "use"], ["off", "trigger_use"]], "the game's cooking is held back");

    // Held, the game takes its prompt down: the hold stays while the aim and the body do.
    sut.state.shown = [];
    for (let look = 0; look < 20; look += 1) {
        sut.clock.t += 150;
        sut.state.tick();
    }
    assert.equal(sut.state.actions.length, 2, "no lapse while the player stands and looks at the fire");
    const turn = (degrees) => ({ origin: { x: 0, y: 0, z: 1.7 }, direction: { x: Math.cos((degrees * Math.PI) / 180), y: Math.sin((degrees * Math.PI) / 180), z: 0 } });
    sut.state.ray = turn(sut.api.FIRE_HOLD.turnDeg / 2);
    sut.state.tick();
    assert.equal(sut.state.actions.length, 2, "a small turn keeps it");
    sut.state.ray = turn(sut.api.FIRE_HOLD.turnDeg * 2);
    sut.state.tick();
    assert.deepEqual(sut.state.actions.slice(-2), [["on", "use"], ["on", "trigger_use"]], "a turn gives it back, for the prompt to be looked at again");

    sut.state.shown = [{ key: "use", map: "player", text: "Cook" }];
    sut.state.tick();
    assert.deepEqual(sut.state.actions.slice(-2), [["off", "use"], ["off", "trigger_use"]], "in English too");
    sut.state.shown = [];
    const before = sut.state.actions.length;
    sut.me.position = { x: 11, y: 10.4, z: 100 };
    sut.state.tick();
    assert.equal(sut.state.actions.length, before, "a step shorter than FIRE_HOLD.moveM keeps it");
    sut.me.position = { x: 11, y: 10 + sut.api.FIRE_HOLD.moveM + 0.2, z: 100 };
    sut.state.tick();
    assert.deepEqual(sut.state.actions.slice(-2), [["on", "use"], ["on", "trigger_use"]], "a step gives it back");
    sut.state.shown = [{ key: "use", map: "player", text: "Eat" }];
    const given = sut.state.actions.length;
    sut.state.tick();
    assert.equal(sut.state.actions.length, given, "the meal leaves E alone");
});

test("beside a fire, out of our aim, the game's Cozinhar is held too (its prompt reaches farther than our hint), and farther off it is not", () => {
    const sut = load();
    sut.places([[0, 10, 10, 100]]);
    sut.me.position = { x: 12.5, y: 10, z: 100 };
    sut.state.aimOff = true;
    sut.state.shown = [{ key: "use", map: "player", text: "Cozinhar" }];
    sut.state.tick();
    assert.deepEqual(sut.state.hints, [], "our hint wants the aim on the fire");
    assert.deepEqual(sut.state.actions, [["off", "use"], ["off", "trigger_use"]], "the game's cooking is held back all the same");
    sut.state.shown = [];
    sut.state.tick();
    assert.equal(sut.state.actions.length, 2, "and stays held while the aim does");

    const far = load();
    far.places([[0, 10, 10, 100]]);
    far.me.position = { x: 10 + 2.6 + far.api.FIRE_HOLD.aroundM + 0.5, y: 10, z: 100 };
    far.state.aimOff = true;
    far.state.shown = [{ key: "use", map: "player", text: "Cozinhar" }];
    far.state.tick();
    assert.deepEqual(far.state.actions, [], "out of the fire's reach the game's prompt is some other fire's business, or none");

    const other = load();
    other.places([[0, 10, 10, 100]]);
    other.me.position = { x: 12.5, y: 10, z: 100 };
    other.state.aimOff = true;
    other.state.shown = [{ key: "use", map: "player", text: "Abrir" }];
    other.state.tick();
    assert.deepEqual(other.state.actions, [], "a door's Abrir beside the fire is left alone");
});

test("the aim turned or the body moved, by FIRE_HOLD", () => {
    const { api } = load();
    const aim = (deg, x = 0, y = 0) => ({ dx: Math.cos((deg * Math.PI) / 180), dy: Math.sin((deg * Math.PI) / 180), dz: 0, x, y, z: 0 });
    assert.equal(api.movedFrom(aim(0), aim(api.FIRE_HOLD.turnDeg - 1)), false);
    assert.equal(api.movedFrom(aim(0), aim(api.FIRE_HOLD.turnDeg + 1)), true);
    assert.equal(api.movedFrom(aim(0), aim(0, api.FIRE_HOLD.moveM - 0.1)), false);
    assert.equal(api.movedFrom(aim(0), aim(0, api.FIRE_HOLD.moveM + 0.1)), true);
    assert.equal(api.movedFrom(aim(0), { dx: 0, dy: 0, dz: 0, x: 0, y: 0, z: 0 }), true, "no aim to compare is a turn");
});

test("which of the game's prompts on its use key is the fire's cooking and which the pot's meal", () => {
    const { api } = load();
    assert.equal(api.nativeCookOnUse([{ key: "use", map: "player", text: "Cozinhar" }]), "cook");
    assert.equal(api.nativeCookOnUse([{ key: "use", map: "player", text: "Comer da panela" }, { key: "use", map: "player", text: "Cozinhar" }]), "eat");
    assert.equal(api.nativeCookOnUse([{ key: "attack_special", map: "player", text: "Cozinhar" }]), "", "ours on F is not the game's");
    assert.equal(api.nativeCookOnUse([{ key: "use", map: "apse", text: "Cozinhar" }]), "", "a menu screen's prompt is not the world's");
    assert.equal(api.nativeCookOnUse([{ key: "use", map: "player", text: "Abrir" }]), "");
    assert.equal(api.nativeCookOnUse([{ key: "use", map: "player", text: "Uvařit" }]), "cook");
});

test("the grindstone is ours since 2026-10-27: aimed at one with its point in reach, Reparar stands on E, the game's E is held back, and the press names the kind (8)", () => {
    const sut = load();
    sut.places([[8, 50, 50, 20]]);
    sut.me.position = { x: 51.5, y: 50, z: 20 };
    sut.state.aimHit = { kind: "entity", entityClass: "Grindstone", distance: 1.5 };
    sut.state.tick();
    assert.equal(sut.state.hints.length, 1);
    assert.equal(sut.state.hints[0].options.text, "Reparar");
    assert.equal(sut.state.hints[0].options.key, "primary_action", "on E");
    assert.deepEqual(sut.state.actions, [["off", "use"], ["off", "trigger_use"]], "the game's sharpening on E is held back");

    const key = sut.state.keys.find((one) => one.key === "e");
    key.fn();
    assert.deepEqual(JSON.parse(JSON.stringify(sut.state.emitted.at(-1))), { name: "kcdc-gamemode:cook.menu", payload: { kind: 8, x: 50, y: 50 } });
});

test("with the aim anywhere but on the grindstone there is no Reparar, however near it is; the aim on a GeomEntity beside it is not the stone", () => {
    const sut = load();
    sut.places([[8, 50, 50, 20]]);
    sut.me.position = { x: 51, y: 50, z: 20 };
    sut.state.aimHit = { kind: "entity", entityClass: "GeomEntity", distance: 1.5 };
    sut.state.tick();
    assert.equal(sut.state.hints.length, 0);
    assert.deepEqual(sut.state.actions, [], "and the game's E is the game's");
    sut.state.aimHit = null;
    sut.state.tick();
    assert.equal(sut.state.hints.length, 0);
});

test("the forge and the grindstone side by side: the aim on the stone puts Reparar up and takes Forjar down; the aim on the anvil is Forjar again", () => {
    const sut = load();
    sut.places([[3, 50, 50, 20], [8, 51.5, 50, 20]]);
    sut.me.position = { x: 51, y: 50, z: 20 };
    sut.state.aimHit = { kind: "entity", entityClass: "GeomEntity", distance: 1.5 };
    sut.state.tick();
    assert.equal(sut.state.hints[0].options.text, "Forjar");
    sut.state.aimHit = { kind: "entity", entityClass: "Grindstone", distance: 1.5 };
    sut.state.tick();
    assert.equal(sut.state.hints[0].options.text, "Reparar", "the same hint, its word changed");
    sut.state.aimHit = { kind: "entity", entityClass: "GeomEntity", distance: 1.5 };
    sut.state.tick();
    assert.equal(sut.state.hints[0].options.text, "Forjar");
});

test("a grindstone farther than its reach is not offered even with the aim on it", () => {
    const sut = load();
    sut.places([[8, 50, 50, 20]]);
    sut.me.position = { x: 58, y: 50, z: 20 };
    sut.state.aimHit = { kind: "entity", entityClass: "Grindstone", distance: 5 };
    sut.state.tick();
    assert.equal(sut.state.hints.length, 0);
});
