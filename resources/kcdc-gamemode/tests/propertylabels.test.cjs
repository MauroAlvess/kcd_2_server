const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const RESOURCE = "kcdc-gamemode";

/** A client with a NativeUI that keeps what was drawn, a camera, a world to trace and a clock. */
function load({ ready = true } = {}) {
    const events = new Map();
    const emitted = [];
    const timers = [];
    const errors = [];
    const clock = { now: 1_000_000 };
    const logs = [];
    const state = { hits: [], ray: { origin: { x: 0, y: 0, z: 0 }, direction: { x: 1, y: 0, z: 0 }, target: { x: 2.8, y: 0, z: 0 } }, throwing: false, hintThrows: false, gameKeys: new Set(), promptThrows: false };
    const fields = [];
    const screens = [];
    const hints = [];
    const keys = new Map();
    const me = { ready, alive: true };

    const makeField = (options) => {
        const field = { options, style: null, text: "", visible: null, setTextStyle(style) { this.style = style; return true; }, setText(text) { this.text = text; return true; }, set(values) { if ("visible" in values) this.visible = values.visible; return true; } };
        fields.push(field);
        return field;
    };
    const context = {
        exports: {},
        console: { log: (line) => logs.push(line), error: (line) => errors.push(line) },
        Date: { now: () => clock.now },
        setInterval: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
        clearInterval() {},
        LocalPlayer: me,
        NoClip: { isActive: () => state.flying === true },
        Camera: { screenRay: () => { if (state.throwing) throw new Error("no view"); return state.ray; } },
        ActionHint: {
            create: (spec, fn) => {
                if (state.hintThrows) throw new Error("no such control");
                hints.push({ spec, fn, removed: false });
                return hints.length;
            },
            remove: (id) => { hints[id - 1].removed = true; return true; },
            isKeyInUse: (key) => { if (state.promptThrows) throw new Error("no such control"); return state.gameKeys.has(key); },
        },
        World: { raycastAll: () => state.hits },
        Key: { bind: (key, phase, fn) => keys.set(`${key}:${phase}`, fn) },
        Hud: { isInDialogue: () => state.inDialogue === true },
        Events: { on: (name, fn) => events.set(name, fn), emitServer: (name, payload) => emitted.push({ name, payload: JSON.parse(payload) }) },
        NativeUI: {
            createScreen: () => {
                const handlers = new Map();
                const screen = {
                    closed: false,
                    on: (name, fn) => handlers.set(name, fn),
                    stage: () => ({ width: 1920, height: 1080 }),
                    root: { createText: (options) => makeField(options) },
                    close() { this.closed = true; return true; },
                    fire: (name) => handlers.get(name)?.(),
                };
                screens.push(screen);
                return screen;
            },
        },
    };
    const interaction = {};
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/client/interaction.js"), "utf8"), { exports: interaction });
    context.require = (name) => { assert.equal(name, "./interaction.js"); return interaction; };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/client/property-labels.js"), "utf8"), context);
    context.exports.installPropertyLabels();

    const tick = () => timers[0].fn();
    const hit = (guid, over = {}) => ({ distance: 1.5, entityGuid: guid, entityClass: "AnimDoor", ...over });
    const answer = (guid, label) => events.get(`${RESOURCE}:props.label`)(JSON.stringify({ guid, label }));
    const body = (id, over = {}) => ({ distance: 1.8, entityGuid: "ffffffffffffffff", entityClass: "PlayerEntity", player: { id, local: false }, ...over });
    const named = (id, label) => events.get(`${RESOURCE}:players.label`)(JSON.stringify({ id, label }));
    const main = () => fields[fields.length - 1];
    const shadow = () => fields[fields.length - 2];
    const asked = (name) => emitted.filter((entry) => entry.name === `${RESOURCE}:${name}`);
    const pressE = () => keys.get("e:down")();
    return { events, emitted, timers, errors, logs, clock, state, fields, screens, hints, keys, me, interaction, tick, hit, answer, body, named, main, shadow, asked, pressE };
}

/** A frame: the movie composes the screen, and the next look draws. */
function openScreen(sut) {
    sut.tick();
    assert.equal(sut.screens.length, 1, "the screen is asked for on the first look");
    sut.screens[0].fire("ready");
}

test("the text is the game's own font, white, centred, with a dark shadow under it, and hidden until there is something to say", () => {
    const sut = load();
    openScreen(sut);
    assert.equal(sut.fields.length, 2);
    assert.equal(sut.main().style.font, "DefaultFont");
    assert.equal(sut.main().style.color, 0xffffff);
    assert.equal(sut.main().style.align, "center");
    assert.equal(sut.shadow().style.color, 0x000000);
    assert.equal(sut.main().options.width, 1920);
    assert.equal(sut.shadow().options.x, 2, "the shadow is a little off to the side");
    assert.equal(sut.main().visible, false);
    assert.equal(sut.timers[0].ms, 150);
});

test("looking at a door asks the server once, and shows the answer under the crosshair until the look moves off", () => {
    const sut = load();
    openScreen(sut);
    sut.state.hits = [sut.hit("a1b2c3d4e5f60718")];

    sut.tick();
    sut.tick();
    assert.deepEqual(sut.emitted, [{ name: `${RESOURCE}:props.peek`, payload: { guid: "a1b2c3d4e5f60718" } }], "asked once, not at every look");
    assert.equal(sut.main().visible, false, "nothing is written until the server says what it is");

    sut.answer("a1b2c3d4e5f60718", "Casa 03 - Hans");
    sut.tick();
    assert.equal(sut.main().text, "Casa 03 - Hans");
    assert.equal(sut.shadow().text, "Casa 03 - Hans");
    assert.equal(sut.main().visible, true);
    assert.equal(sut.shadow().visible, true);
    assert.equal(sut.emitted.length, 1, "and it is not asked again while it is known");

    sut.state.hits = [];
    sut.tick();
    assert.equal(sut.main().visible, false);
    assert.equal(sut.shadow().visible, false);
});

test("an object that is no property is remembered as nothing and writes nothing", () => {
    const sut = load();
    openScreen(sut);
    sut.state.hits = [sut.hit("0000000000000009")];
    sut.tick();
    sut.answer("0000000000000009", "");
    sut.tick();
    sut.tick();
    assert.equal(sut.main().visible, false);
    assert.equal(sut.emitted.length, 1);
});

test("living things, things beyond reach and things the level does not name are never asked about", () => {
    const sut = load();
    openScreen(sut);
    sut.state.hits = [sut.hit("1111111111111111", { entityClass: "NPC_NAI" }), sut.hit("2222222222222222", { entityClass: "PlayerEntity" }), sut.hit("3333333333333333", { distance: 3.5 }), sut.hit(null)];
    sut.tick();
    assert.deepEqual(sut.emitted, []);
    assert.equal(sut.main().visible, false);
});

test("an answer is kept for half a minute and then asked again, and a chest behind a door is found by the second hit", () => {
    const sut = load();
    openScreen(sut);
    sut.state.hits = [sut.hit("aaaaaaaaaaaaaaaa", { entityClass: "GeomEntity" }), sut.hit("bbbbbbbbbbbbbbbb")];
    sut.tick();
    assert.deepEqual(sut.emitted.map((entry) => entry.payload.guid), ["aaaaaaaaaaaaaaaa", "bbbbbbbbbbbbbbbb"], "each thing on the ray is asked about");
    sut.answer("aaaaaaaaaaaaaaaa", "");
    sut.answer("bbbbbbbbbbbbbbbb", "Casa 01 · Baú 1");
    sut.tick();
    assert.equal(sut.main().text, "Casa 01 · Baú 1", "the first thing that has a name wins");

    sut.clock.now += 31_000;
    sut.emitted.length = 0;
    sut.tick();
    assert.ok(sut.emitted.some((entry) => entry.payload.guid === "bbbbbbbbbbbbbbbb"), "an old answer is asked again");
    assert.equal(sut.main().text, "Casa 01 · Baú 1", "and the old one shows meanwhile");
});

test("nothing is drawn, asked or even opened while the player is not in the world yet", () => {
    const sut = load({ ready: false });
    sut.state.hits = [sut.hit("a1b2c3d4e5f60718")];
    sut.tick();
    sut.tick();
    assert.equal(sut.screens.length, 0, "no screen is asked for while the level is loading");
    assert.deepEqual(sut.emitted, []);
});

test("a level load that takes the movie away is followed by a new screen, a moment later", () => {
    const sut = load();
    openScreen(sut);
    sut.screens[0].fire("unload");
    sut.tick();
    assert.equal(sut.screens.length, 1, "not at once");
    sut.clock.now += 2_500;
    sut.tick();
    assert.equal(sut.screens.length, 2);
    sut.screens[1].fire("ready");
    assert.equal(sut.fields.length, 4);
});

test("a look that cannot be made is a pause, said once, and never an exception", () => {
    const sut = load();
    openScreen(sut);
    sut.state.throwing = true;
    assert.doesNotThrow(() => sut.tick());
    assert.doesNotThrow(() => sut.tick());
    assert.equal(sut.errors.length, 1, "said once, however often it happens");
    assert.match(sut.errors[0], /^property labels: .*no view/);
});

test("another player close by is asked about once, named under the crosshair, and offered the talk key", () => {
    const sut = load();
    openScreen(sut);
    sut.state.hits = [sut.body(7)];
    sut.tick();
    sut.tick();
    assert.deepEqual(sut.emitted, [{ name: `${RESOURCE}:players.peek`, payload: { id: 7 } }], "asked once, by network id, not by the body's GUID");
    assert.equal(sut.main().visible, false, "nothing is written until the server says what they are called here");
    assert.equal(sut.hints.length, 0, "and no key is offered yet");

    sut.named(7, "Desconhecido");
    sut.tick();
    assert.equal(sut.main().text, "Desconhecido");
    assert.equal(sut.main().visible, true);
    assert.equal(sut.hints.length, 1);
    assert.deepEqual({ ...sut.hints[0].spec }, { key: "primary_action", text: "Conversar" }, "the game's own interaction key, whatever it is bound to");

    sut.hints[0].fn();
    assert.deepEqual(sut.emitted[sut.emitted.length - 1], { name: `${RESOURCE}:players.talk`, payload: { id: 7 } });
    sut.tick();
    assert.equal(sut.hints.length, 1, "one hint for as long as the look stays");

    sut.state.hits = [];
    sut.tick();
    assert.equal(sut.hints[0].removed, true, "the key goes with the look");
    assert.equal(sut.main().visible, false);
});

test("while the talk key is up for somebody, the dice table's key gives way to it", () => {
    const sut = load();
    openScreen(sut);
    assert.equal(sut.interaction.getPersonInView(), 0);
    sut.state.hits = [sut.body(7)];
    sut.tick();
    assert.equal(sut.interaction.getPersonInView(), 0, "not before the hint is up");
    sut.named(7, "Desconhecido");
    sut.tick();
    assert.equal(sut.interaction.getPersonInView(), 7);
    sut.state.hits = [];
    sut.tick();
    assert.equal(sut.interaction.getPersonInView(), 0);

    const broken = load();
    openScreen(broken);
    broken.state.hintThrows = true;
    broken.state.hits = [broken.body(7)];
    broken.named(7, "Desconhecido");
    broken.tick();
    assert.equal(broken.interaction.getPersonInView(), 0, "a hint that could not be put up takes nothing from the table");
});

test("an introduction pushed by the server renames the player at once, without asking again", () => {
    const sut = load();
    openScreen(sut);
    sut.state.hits = [sut.body(7)];
    sut.tick();
    sut.named(7, "Desconhecida");
    sut.tick();
    sut.named(7, "Katerina Capon");
    sut.tick();
    assert.equal(sut.main().text, "Katerina Capon");
    assert.equal(sut.asked("players.peek").length, 1);
});

test("the key follows the look from one player to the next", () => {
    const sut = load();
    openScreen(sut);
    sut.named(7, "Desconhecido");
    sut.named(8, "Hans");
    sut.state.hits = [sut.body(7)];
    sut.tick();
    sut.state.hits = [sut.body(8)];
    sut.tick();
    assert.equal(sut.main().text, "Hans");
    sut.hints[sut.hints.length - 1].fn();
    assert.deepEqual(sut.asked("players.talk").map((entry) => entry.payload.id), [8], "the press is for whoever is looked at now");
});

test("your own body is looked through, and a body beyond talking range is neither named nor talked to", () => {
    const sut = load();
    openScreen(sut);
    sut.state.hits = [sut.body(1, { distance: 0.2, player: { id: 1, local: true } }), sut.hit("a1b2c3d4e5f60718")];
    sut.tick();
    assert.deepEqual(sut.emitted, [{ name: `${RESOURCE}:props.peek`, payload: { guid: "a1b2c3d4e5f60718" } }], "the door behind your own shoulder is still read");

    sut.emitted.length = 0;
    sut.named(7, "Hans");
    sut.state.hits = [sut.body(7, { distance: 3.5 })];
    sut.tick();
    assert.deepEqual(sut.emitted, []);
    assert.equal(sut.main().visible, false);
    assert.equal(sut.hints.length, 0);
});

test("a player the server does not name gets neither a name nor the talk key", () => {
    const sut = load();
    openScreen(sut);
    sut.state.hits = [sut.body(9)];
    sut.tick();
    sut.named(9, "");
    sut.tick();
    sut.tick();
    assert.equal(sut.main().visible, false);
    assert.equal(sut.hints.length, 0);
    assert.equal(sut.asked("players.peek").length, 1, "and the empty answer is remembered too");
});

test("a game without the talk control still names players, and says so once", () => {
    const sut = load();
    openScreen(sut);
    sut.state.hintThrows = true;
    sut.state.hits = [sut.body(7)];
    sut.named(7, "Desconhecido");
    sut.tick();
    sut.tick();
    sut.tick();
    assert.equal(sut.main().text, "Desconhecido");
    assert.equal(sut.errors.length, 1);
    assert.match(sut.errors[0], /talk hint could not be put up: .*no such control/);
});

test("the talk key is taken down when the player leaves the world, and with the resource", () => {
    const sut = load();
    openScreen(sut);
    sut.state.hits = [sut.body(7)];
    sut.named(7, "Desconhecido");
    sut.tick();
    assert.equal(sut.hints.length, 1);
    sut.me.ready = false;
    sut.tick();
    assert.equal(sut.hints[0].removed, true, "a level load takes it down");

    sut.me.ready = true;
    sut.tick();
    assert.equal(sut.hints.length, 2);
    sut.events.get("resourceStop")(RESOURCE);
    assert.equal(sut.hints[1].removed, true);
});

test("a garbled player answer is ignored", () => {
    const sut = load();
    openScreen(sut);
    const label = sut.events.get(`${RESOURCE}:players.label`);
    assert.doesNotThrow(() => label("not json {"));
    assert.doesNotThrow(() => label(JSON.stringify({ id: "7", label: "x" })));
    assert.doesNotThrow(() => label(JSON.stringify({ id: 7, label: 3 })));
    sut.state.hits = [sut.body(7)];
    sut.tick();
    assert.equal(sut.asked("players.peek").length, 1, "nothing was taken from those");
});

test("a garbled answer is ignored, and the screen is closed with the resource", () => {
    const sut = load();
    openScreen(sut);
    const label = sut.events.get(`${RESOURCE}:props.label`);
    assert.doesNotThrow(() => label("not json {"));
    assert.doesNotThrow(() => label(JSON.stringify({ guid: 7, label: "x" })));
    assert.doesNotThrow(() => label(null));

    sut.events.get("resourceStop")(RESOURCE);
    assert.equal(sut.screens[0].closed, true);
});

test("a door or chest of a property gets no hint of ours: the game's own Abrir is the one thing on offer there", () => {
    const sut = load();
    openScreen(sut);
    sut.state.hits = [sut.hit("a1b2c3d4e5f60718")];
    sut.tick();
    sut.events.get(`${RESOURCE}:props.label`)(JSON.stringify({ guid: "a1b2c3d4e5f60718", label: "Casa 03", use: true }));
    sut.tick();

    assert.equal(sut.main().text, "Casa 03", "the name is still written under the crosshair");
    assert.equal(sut.hints.length, 0, "no [E] of ours beside the game's own");
});

test("E pressed at a property in reach is told to the server, for a client whose door the game does not report", () => {
    const sut = load();
    openScreen(sut);
    sut.state.hits = [sut.hit("a1b2c3d4e5f60718")];
    sut.tick();
    sut.events.get(`${RESOURCE}:props.label`)(JSON.stringify({ guid: "a1b2c3d4e5f60718", label: "Casa 03", use: true }));
    sut.tick();

    sut.pressE();
    assert.deepEqual(sut.asked("props.use"), [{ name: `${RESOURCE}:props.use`, payload: { guid: "a1b2c3d4e5f60718", prompt: false } }]);
    sut.pressE();
    assert.equal(sut.asked("props.use").length, 1, "a second press at once is the same one");
    sut.clock.now += 700;
    sut.pressE();
    assert.equal(sut.asked("props.use").length, 2);
});

test("E is not told to the server at what is no property, behind somebody, while talking, or with nothing in view", () => {
    const sut = load();
    openScreen(sut);
    const label = (guid, use) => sut.events.get(`${RESOURCE}:props.label`)(JSON.stringify({ guid, label: "Algo", use }));

    sut.state.hits = [sut.hit("0000000000000009")];
    sut.tick();
    label("0000000000000009", false);
    sut.tick();
    sut.pressE();

    sut.state.hits = [sut.hit("1111111111111111", { entityClass: "NPC_NAI" }), sut.hit("a1b2c3d4e5f60718")];
    label("a1b2c3d4e5f60718", true);
    sut.tick();
    sut.clock.now += 700;
    sut.pressE();

    sut.state.hits = [sut.hit("a1b2c3d4e5f60718")];
    sut.tick();
    sut.state.inDialogue = true;
    sut.clock.now += 700;
    sut.pressE();

    sut.state.inDialogue = false;
    sut.state.hits = [];
    sut.tick();
    sut.clock.now += 700;
    sut.pressE();

    assert.deepEqual(sut.asked("props.use"), [], "an NPC in a doorway, a menu on screen, or nothing in view");
});

test("while the free camera flies, nothing is written and no hint is up", () => {
    const sut = load();
    openScreen(sut);
    sut.state.hits = [sut.hit("a1b2c3d4e5f60718")];
    sut.tick();
    sut.events.get(`${RESOURCE}:props.label`)(JSON.stringify({ guid: "a1b2c3d4e5f60718", label: "Casa 03", use: true }));
    sut.tick();
    assert.equal(sut.main().visible, true);

    sut.state.flying = true;
    sut.tick();
    assert.equal(sut.main().visible, false);
    assert.ok(sut.hints.every((entry) => entry.removed));

    sut.state.flying = false;
    sut.tick();
    assert.equal(sut.main().visible, true, "back when the flight ends");
});

// ---------------------------------------------------------------------------------------------
// The look: the door of a property under the crosshair is told to the server, and where the server holds it locked
// (and the game offers nothing) our own "Abrir" takes the game's place.

const DOOR_GUID = "a1b2c3d4e5f60718";

/** The player looks at a door of a property that the server has named, and the first beat has been. */
function atDoor(options) {
    const sut = load(options);
    openScreen(sut);
    sut.state.hits = [sut.hit(DOOR_GUID)];
    sut.tick();
    sut.events.get(`${RESOURCE}:props.label`)(JSON.stringify({ guid: DOOR_GUID, label: "Casa 03", use: true, door: true }));
    sut.tick();
    const held = (guid) => sut.events.get(`${RESOURCE}:props.gazed`)(JSON.stringify({ guid }));
    return { sut, held };
}

test("the door under the crosshair is told to the server, again every 700 ms while the look lasts, and told when it moves off", () => {
    const { sut } = atDoor();
    assert.deepEqual(sut.asked("props.gaze").map((entry) => entry.payload), [{ guid: DOOR_GUID }]);

    sut.clock.now += 150;
    sut.tick();
    sut.clock.now += 150;
    sut.tick();
    assert.equal(sut.asked("props.gaze").length, 1, "not at every beat");

    sut.clock.now += 450;
    sut.tick();
    assert.equal(sut.asked("props.gaze").length, 2, "said again, so that the server does not let the door go");

    sut.state.hits = [];
    sut.tick();
    assert.deepEqual(sut.asked("props.gaze").at(-1).payload, { guid: "" });
    sut.tick();
    sut.clock.now += 5_000;
    sut.tick();
    assert.equal(sut.asked("props.gaze").length, 3, "and nothing more once it has been said");
});

test("a new door is not told faster than the server takes a look, and a look that ends is told at once", () => {
    const { sut } = atDoor();
    const OTHER = "b2c3d4e5f6071829";
    sut.events.get(`${RESOURCE}:props.label`)(JSON.stringify({ guid: OTHER, label: "Casa 04", use: true, door: true }));
    sut.clock.now += 150;
    sut.state.hits = [sut.hit(OTHER)];
    sut.tick();
    assert.equal(sut.asked("props.gaze").length, 1, "150 ms after the last: it waits for the next beat");
    sut.clock.now += 150;
    sut.tick();
    assert.deepEqual(sut.asked("props.gaze").at(-1).payload, { guid: OTHER });

    sut.clock.now += 50;
    sut.state.hits = [];
    sut.tick();
    assert.deepEqual(sut.asked("props.gaze").at(-1).payload, { guid: "" }, "a release does not wait");
});

test("a chest, a property that is not a door, a person or the free camera are no look at a door", () => {
    const sut = load();
    openScreen(sut);
    const label = (guid, door) => sut.events.get(`${RESOURCE}:props.label`)(JSON.stringify({ guid, label: "Casa 01 · Baú 1", use: true, door }));

    sut.state.hits = [sut.hit("cccccccccccccccc")];
    sut.tick();
    label("cccccccccccccccc", false);
    sut.tick();
    sut.clock.now += 1_000;
    sut.tick();
    assert.deepEqual(sut.asked("props.gaze"), [], "a chest is not held for a look");

    sut.state.hits = [sut.body(7), sut.hit(DOOR_GUID)];
    label(DOOR_GUID, true);
    sut.named(7, "Desconhecido");
    sut.clock.now += 1_000;
    sut.tick();
    assert.deepEqual(sut.asked("props.gaze"), [], "a person in front of the door comes first");

    sut.state.hits = [sut.hit(DOOR_GUID, { distance: 1.5 })];
    sut.clock.now += 1_000;
    sut.tick();
    assert.deepEqual(sut.asked("props.gaze").at(-1).payload, { guid: DOOR_GUID });
    sut.state.flying = true;
    sut.tick();
    assert.deepEqual(sut.asked("props.gaze").at(-1).payload, { guid: "" }, "a flight is no look");
});

test("a door the server holds gets our own Abrir once the game's prompt is gone, never beside it, and it goes with the look", () => {
    const { sut, held } = atDoor();
    held(DOOR_GUID);
    sut.state.gameKeys.add("use");
    sut.tick();
    assert.equal(sut.hints.length, 0, "the game's own prompt is still up: the lock has not reached its door");

    sut.state.gameKeys.clear();
    sut.tick();
    assert.equal(sut.hints.length, 1);
    assert.deepEqual({ ...sut.hints[0].spec }, { key: "primary_action", text: "Abrir" }, "the game's own key and its own word");
    assert.ok(sut.logs.some((line) => /a dica "Abrir" própria subiu na porta a1b2c3d4e5f60718/.test(line)));

    // its own presence is not taken for the game's: no flapping while the look lasts
    sut.state.gameKeys.add("primary_action");
    sut.tick();
    sut.tick();
    assert.equal(sut.hints.length, 1);
    assert.equal(sut.hints[0].removed, false);

    sut.state.hits = [];
    sut.tick();
    assert.equal(sut.hints[0].removed, true);
});

test("the press of our Abrir is the E told to the server, and the hint and the key are one press", () => {
    const { sut, held } = atDoor();
    held(DOOR_GUID);
    sut.tick();
    sut.state.gameKeys.add("primary_action");
    sut.hints[0].fn();
    assert.deepEqual(sut.asked("props.use"), [{ name: `${RESOURCE}:props.use`, payload: { guid: DOOR_GUID, prompt: false } }], "our own Abrir on the key is not the game's prompt");
    sut.pressE();
    assert.equal(sut.asked("props.use").length, 1, "the key pressed with it is the same press");
    sut.state.inDialogue = true;
    sut.clock.now += 700;
    sut.hints[0].fn();
    assert.equal(sut.asked("props.use").length, 1, "not with a menu on screen");
});

test("no hint of ours where the server does not hold the door: no word, another door, an old word, or a door let go", () => {
    const { sut, held } = atDoor();
    sut.tick();
    assert.equal(sut.hints.length, 0, "the server said nothing");

    held("b2c3d4e5f6071829");
    sut.tick();
    assert.equal(sut.hints.length, 0, "it holds another door");

    held(DOOR_GUID);
    sut.tick();
    assert.equal(sut.hints.length, 1);
    held("");
    sut.tick();
    assert.equal(sut.hints[0].removed, true, "let go: the game's own prompt is back");

    held(DOOR_GUID);
    sut.tick();
    assert.equal(sut.hints.length, 2);
    sut.clock.now += 2_600;
    sut.tick();
    assert.equal(sut.hints[1].removed, true, "a word not said again is not believed for ever");
});

test("a word from the server that is not a door's guid or empty changes nothing", () => {
    const { sut } = atDoor();
    const said = (payload) => sut.events.get(`${RESOURCE}:props.gazed`)(payload);
    said("not json");
    said(JSON.stringify({ guid: 5 }));
    said(JSON.stringify({ guid: "../../etc" }));
    said(JSON.stringify({}));
    sut.tick();
    assert.equal(sut.hints.length, 0);
});

test("a game prompt that stays up at a held door lets the hold go for that look: the server is told which door, and it is not told again until the look leaves", () => {
    const { sut, held } = atDoor();
    held(DOOR_GUID);
    sut.state.gameKeys.add("use");
    sut.tick();
    assert.equal(sut.asked("props.gaze").filter((entry) => entry.payload.released).length, 0, "a moment is allowed for the lock to arrive");
    sut.clock.now += 700;
    held(DOOR_GUID);
    sut.tick();
    assert.equal(sut.asked("props.gaze").filter((entry) => entry.payload.released).length, 0, "still within it");

    sut.clock.now += 150;
    sut.tick();
    assert.deepEqual(sut.asked("props.gaze").at(-1).payload, { guid: "", released: DOOR_GUID });
    const said = sut.logs.filter((line) => /o "Abrir" do jogo continua na tela .*a trava foi solta/.test(line));
    assert.equal(said.length, 1);
    assert.match(said[0], /a1b2c3d4e5f60718/);
    assert.equal(sut.hints.length, 0, "no hint of ours beside the game's");

    // the look stays: the door is not told again, nothing more is said
    const count = sut.asked("props.gaze").length;
    held("");
    for (let beat = 0; beat < 10; beat += 1) {
        sut.clock.now += 150;
        sut.tick();
    }
    assert.equal(sut.asked("props.gaze").length, count);

    // the look leaves and comes back: told again, and the log does not repeat itself
    sut.state.hits = [];
    sut.tick();
    sut.state.hits = [sut.hit(DOOR_GUID)];
    sut.clock.now += 400;
    sut.tick();
    assert.deepEqual(sut.asked("props.gaze").at(-1).payload, { guid: DOOR_GUID });
    held(DOOR_GUID);
    sut.clock.now += 900;
    sut.tick();
    assert.deepEqual(sut.asked("props.gaze").at(-1).payload, { guid: "", released: DOOR_GUID });
    assert.equal(sut.logs.filter((line) => /a trava foi solta/.test(line)).length, 1);
});

test("E with the game's own prompt on the screen says so to the server", () => {
    const { sut, held } = atDoor();
    held(DOOR_GUID);
    sut.state.gameKeys.add("use");
    sut.tick();
    sut.pressE();
    assert.deepEqual(sut.asked("props.use").at(-1).payload, { guid: DOOR_GUID, prompt: true });
});

test("a game that cannot say what prompts are up lets the hold go rather than guess, and one without the control is told once", () => {
    const blind = atDoor();
    blind.sut.state.promptThrows = true;
    blind.held(DOOR_GUID);
    blind.sut.tick();
    assert.equal(blind.sut.hints.length, 0, "no hint of ours: the game's own prompt may be up");
    blind.sut.clock.now += 900;
    blind.sut.tick();
    assert.deepEqual(blind.sut.asked("props.gaze").at(-1).payload, { guid: "", released: DOOR_GUID }, "the door works the old way, nobody shut in");

    const broken = atDoor();
    broken.sut.state.hintThrows = true;
    broken.held(DOOR_GUID);
    broken.sut.tick();
    broken.sut.tick();
    broken.sut.tick();
    assert.equal(broken.sut.hints.length, 0);
    assert.equal(broken.sut.errors.length, 1);
    assert.match(broken.sut.errors[0], /door hint could not be put up: .*no such control/);
});

test("with the resource the door hint comes down", () => {
    const { sut, held } = atDoor();
    held(DOOR_GUID);
    sut.tick();
    assert.equal(sut.hints.length, 1);
    sut.events.get("resourceStop")(RESOURCE);
    assert.equal(sut.hints[0].removed, true);
});
