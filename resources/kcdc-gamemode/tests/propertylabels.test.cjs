const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
require("./reachpatch.cjs");

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
    // The player's body at the origin: a hit is as far from it as its `distance` says (2026-10-22: the reach is the body's, not the camera's).
    const me = { ready, alive: true, position: { x: 0, y: 0, z: 0 } };

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
            setText: (id, text) => { hints[id - 1].spec = { ...hints[id - 1].spec, text }; return true; },
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
    // The cart beside the player, as src/client/carts.ts says it (the E is then the cart's).
    const carts = { cartIsNear: () => state.cartNear === true };
    // The players of a dice match, as src/client/dice-quiet.ts says it (nobody's to talk to).
    const dice = { playingDice: (id) => state.dicePlayers?.has(id) === true };
    context.require = (name) => (name === "./interaction.js" ? interaction : name === "./carts.js" ? carts : name === "./dice-quiet.js" ? dice : assert.fail(`unexpected ${name}`));
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/client/property-labels.js"), "utf8"), context);
    context.exports.installPropertyLabels();

    const tick = () => timers[0].fn();
    const hit = (guid, over = {}) => ({ distance: over.distance ?? 1.5, position: { x: over.distance ?? 1.5, y: 0, z: 0 }, entityGuid: guid, entityClass: "AnimDoor", ...over });
    const answer = (guid, label) => events.get(`${RESOURCE}:props.label`)(JSON.stringify({ guid, label }));
    const body = (id, over = {}) => ({ distance: over.distance ?? 1.8, position: { x: over.distance ?? 1.8, y: 0, z: 0 }, entityGuid: "ffffffffffffffff", entityClass: "PlayerEntity", player: { id, local: false }, ...over });
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

test("looking at a door asks the server once and writes its name under the crosshair, with a shadow, until the look moves off", () => {
    const sut = load();
    openScreen(sut);
    sut.state.hits = [sut.hit("a1b2c3d4e5f60718")];

    sut.tick();
    sut.tick();
    assert.deepEqual(sut.emitted, [{ name: `${RESOURCE}:props.peek`, payload: { guid: "a1b2c3d4e5f60718" } }], "asked once, not at every look");
    assert.equal(sut.main().visible, false, "nothing is written until the server says what it is");

    sut.answer("a1b2c3d4e5f60718", "Casa 03 - Hans");
    sut.tick();
    assert.equal(sut.main().visible, true, "the name of a door is back (user, 2026-10-19)");
    assert.equal(sut.main().text, "Casa 03 - Hans");
    assert.equal(sut.shadow().visible, true);
    assert.equal(sut.shadow().text, "Casa 03 - Hans");
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
    assert.equal(sut.main().text, "Casa 01 · Baú 1", "a chest's name is written too");
    assert.equal(sut.main().visible, true);

    sut.clock.now += 31_000;
    sut.emitted.length = 0;
    sut.tick();
    assert.ok(sut.emitted.some((entry) => entry.payload.guid === "bbbbbbbbbbbbbbbb"), "an old answer is asked again");
    assert.equal(sut.main().text, "Casa 01 · Baú 1", "the old name stays up while the new answer comes");
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

test("a player in a dice match has neither a name nor the talk key, nor is asked about, while the others keep both (2026-10-20)", () => {
    const sut = load();
    openScreen(sut);
    sut.named(7, "Desconhecido");
    sut.named(8, "Desconhecido");
    sut.state.hits = [sut.body(7)];
    sut.tick();
    assert.equal(sut.hints.length, 1, "before the match, the hint");
    assert.equal(sut.main().text, "Desconhecido");

    sut.state.dicePlayers = new Set([7]);
    sut.tick();
    assert.equal(sut.hints[0].removed, true, "the key goes the moment the server says they play");
    assert.equal(sut.main().visible, false, "and so does the name");
    sut.tick();
    assert.equal(sut.hints.length, 1, "no new one");
    assert.equal(sut.asked("players.peek").length, 0, "the player of a match is not even asked about");

    sut.state.hits = [sut.body(8)];
    sut.tick();
    assert.equal(sut.hints.length, 2, "somebody else under the crosshair is still talked to");
    assert.equal(sut.main().text, "Desconhecido");

    assert.equal(sut.interaction.getPersonInView(), 8);
    sut.state.dicePlayers = new Set();
    sut.state.hits = [sut.body(7)];
    sut.tick();
    assert.equal(sut.interaction.getPersonInView(), 7, "the match over, they are people again");
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

test("a door or chest of a property gets its name under the crosshair, and no hint of ours until the server says F may work it", () => {
    const sut = load();
    openScreen(sut);
    sut.state.hits = [sut.hit("a1b2c3d4e5f60718")];
    sut.tick();
    sut.events.get(`${RESOURCE}:props.label`)(JSON.stringify({ guid: "a1b2c3d4e5f60718", label: "Casa 03", use: true }));
    sut.tick();

    assert.equal(sut.main().text, "Casa 03", "the name under the crosshair");
    assert.equal(sut.main().visible, true);
    assert.equal(sut.hints.length, 0, "no [E] of ours beside the game's own, and no [F] without the server's word");
});

test("E pressed at a property in reach is told to the server, for a client whose door the game does not report", () => {
    const sut = load();
    openScreen(sut);
    sut.state.hits = [sut.hit("a1b2c3d4e5f60718")];
    sut.tick();
    sut.events.get(`${RESOURCE}:props.label`)(JSON.stringify({ guid: "a1b2c3d4e5f60718", label: "Casa 03", use: true }));
    sut.tick();

    sut.pressE();
    assert.deepEqual(sut.asked("props.use"), [{ name: `${RESOURCE}:props.use`, payload: { guid: "a1b2c3d4e5f60718", use: false } }]);
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
    sut.state.hits = [sut.body(7)];
    sut.tick();
    sut.named(7, "Desconhecido");
    sut.tick();
    assert.equal(sut.main().visible, true, "a person under the crosshair is named");

    sut.state.flying = true;
    sut.tick();
    assert.equal(sut.main().visible, false);
    assert.ok(sut.hints.every((entry) => entry.removed));

    sut.state.flying = false;
    sut.tick();
    assert.equal(sut.main().visible, true, "back when the flight ends");
});

// ---------------------------------------------------------------------------------------------
// The look: the door or chest of a property under the crosshair is told to the server, which says what F does there
// (user, 2026-10-19: "o E é apenas abrir, o F destrancar ou trancar").

const DOOR_GUID = "a1b2c3d4e5f60718";
const CHEST_GUID = "c0c0c0c0c0c0c0c0";

/** The player looks at a door of a property that the server has named, and the first beat has been. */
function atDoor(options) {
    const sut = load(options);
    openScreen(sut);
    sut.state.hits = [sut.hit(DOOR_GUID)];
    sut.tick();
    sut.events.get(`${RESOURCE}:props.label`)(JSON.stringify({ guid: DOOR_GUID, label: "Casa 03", use: true, door: true }));
    sut.tick();
    const can = (guid, lock) => sut.events.get(`${RESOURCE}:props.can`)(JSON.stringify({ guid, lock }));
    const lockHints = () => sut.hints.filter((one) => one.spec.key === "attack_special" && !one.removed);
    return { sut, can, lockHints };
}

test("the part under the crosshair, door or chest, is told to the server, again every 700 ms while the look lasts, and once when it moves off", () => {
    const { sut } = atDoor();
    const looks = () => sut.asked("props.look").map((entry) => entry.payload.guid);
    assert.deepEqual(looks(), [DOOR_GUID]);
    sut.clock.now += 300;
    sut.tick();
    assert.deepEqual(looks(), [DOOR_GUID], "not again so soon");
    sut.clock.now += 500;
    sut.tick();
    assert.deepEqual(looks(), [DOOR_GUID, DOOR_GUID], "again while it lasts");

    sut.state.hits = [sut.hit(CHEST_GUID, { entityClass: "Stash" })];
    sut.tick();
    sut.events.get(`${RESOURCE}:props.label`)(JSON.stringify({ guid: CHEST_GUID, label: "Baú 1", use: true }));
    sut.clock.now += 400;
    sut.tick();
    assert.equal(looks().at(-1), CHEST_GUID, "a chest too");

    sut.state.hits = [];
    sut.clock.now += 100;
    sut.tick();
    sut.tick();
    assert.deepEqual(looks().slice(looks().lastIndexOf(CHEST_GUID) + 1), [""], "the end of a look is told once");
});

test("the server's word puts [F] Trancar or [F] Destrancar up at that part only; its press asks to work it, and it goes with the look", () => {
    const { sut, can, lockHints } = atDoor();
    assert.equal(lockHints().length, 0, "nothing of ours before the server says so");
    can(DOOR_GUID, "lock");
    sut.tick();
    assert.equal(lockHints().length, 1);
    assert.equal(lockHints()[0].spec.text, "Trancar", "on F (attack_special): the E stays the door's");
    lockHints()[0].fn();
    assert.deepEqual(sut.asked("props.toggle").map((entry) => entry.payload), [{ guid: DOOR_GUID }]);

    can(DOOR_GUID, "unlock");
    sut.tick();
    assert.equal(lockHints().length, 1, "the same hint");
    assert.equal(lockHints()[0].spec.text, "Destrancar", "with the other word");

    sut.state.hits = [];
    sut.tick();
    assert.equal(lockHints().length, 0, "the look moved off");
    sut.state.hits = [sut.hit(DOOR_GUID)];
    sut.tick();
    assert.equal(lockHints().length, 1, "back at the part, back up");
    can(DOOR_GUID, "");
    sut.tick();
    assert.equal(lockHints().length, 0, "the server took it back (no key any more)");
    can("c0c0c0c0c0c0c0c0", "lock");
    sut.tick();
    assert.equal(lockHints().length, 0, "a word about another part is not this one's");
});

test("a word from the server that is not a part's guid, or not lock or unlock, changes nothing", () => {
    const { sut, can, lockHints } = atDoor();
    can("not-a-guid", "lock");
    can(DOOR_GUID, "open");
    sut.tick();
    assert.equal(lockHints().length, 0);
});

test("E with the game's own Abrir on the screen says so to the server (that is how inside is told, where nothing else says)", () => {
    const { sut } = atDoor();
    sut.state.gameKeys.add("use");
    sut.pressE();
    assert.deepEqual(sut.asked("props.use").map((entry) => entry.payload), [{ guid: DOOR_GUID, use: true }]);
    sut.state.promptThrows = true;
    sut.clock.now += 700;
    sut.pressE();
    assert.deepEqual(sut.asked("props.use").at(-1).payload, { guid: DOOR_GUID, use: false }, "a game that cannot say counts as no prompt");
});

test("a game without the F control still works the E, and says so once", () => {
    const { sut, can } = atDoor();
    sut.state.hintThrows = true;
    can(DOOR_GUID, "lock");
    sut.tick();
    sut.tick();
    assert.equal(sut.errors.filter((line) => /lock hint could not be put up/.test(line)).length, 1);
    sut.pressE();
    assert.equal(sut.asked("props.use").length, 1);
});

test("with the resource the lock hint comes down", () => {
    const { sut, can, lockHints } = atDoor();
    can(DOOR_GUID, "unlock");
    sut.tick();
    assert.equal(lockHints().length, 1);
    sut.events.get("resourceStop")(RESOURCE);
    assert.equal(lockHints().length, 0);
});

test("beside a cart the talk key stays down, so the E is the cart's; it comes back once the cart is left behind", () => {
    const sut = load();
    openScreen(sut);
    sut.state.hits = [sut.body(7)];
    sut.tick();
    sut.named(7, "Desconhecido");
    sut.state.cartNear = true;
    sut.tick();
    assert.equal(sut.main().text, "Desconhecido", "the name is still written");
    assert.equal(sut.hints.length, 0, "but no talk key over \"Subir na carroça\"");

    sut.state.cartNear = false;
    sut.tick();
    assert.equal(sut.hints.length, 1);
    sut.state.cartNear = true;
    sut.tick();
    assert.equal(sut.hints[0].removed, true, "taken down when a cart comes near");
});

test("a door, a chest or a person is read within two metres of the BODY, the one reach of our prompts; the camera's own distance does not count (2026-10-22)", () => {
    const sut = load();
    openScreen(sut);
    // In the mod's third person the camera is 3.5 m behind the body: the ray starts there, and the door is 5.3 m along it, 1.8 m from the player.
    sut.state.ray = { origin: { x: -3.5, y: 0, z: 1.6 }, direction: { x: 1, y: 0, z: 0 }, target: { x: 6.5, y: 0, z: 1.6 } };
    sut.state.hits = [sut.hit("a1b2c3d4e5f60718", { distance: 5.3, position: { x: 1.8, y: 0, z: 1 } })];
    sut.tick();
    assert.deepEqual(sut.emitted.map((entry) => entry.payload.guid), ["a1b2c3d4e5f60718"], "read from behind, as in first person");

    const far = load();
    openScreen(far);
    far.state.hits = [far.hit("9999999999999999", { distance: 2.4 })];
    far.tick();
    assert.deepEqual(far.emitted, [], "2.4 m from the body is out of reach (it was 2.8 from the camera)");
    far.state.hits = [far.hit("9999999999999999", { distance: 1.95 })];
    far.tick();
    assert.equal(far.emitted.length, 1, "inside two metres it is read");

    const person = load();
    openScreen(person);
    person.named(5, "Radovan");
    person.state.hits = [person.body(5, { distance: 2.4 })];
    person.tick();
    assert.equal(person.hints.length, 0, "no [E] Conversar at 2.4 m (it was 3)");
    person.state.hits = [person.body(5, { distance: 1.8 })];
    person.tick();
    assert.equal(person.hints.length, 1, "at 1.8 m, there it is");
});
