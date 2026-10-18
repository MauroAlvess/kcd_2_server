const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const KEY = "kcdc-property:casa-03";
const CHEST_KEY = "kcdc-property:casa-03-bau-1";
const BACK_KEY = "kcdc-property:casa-03:door2";
const LOCKPICK = "8d76f58e-a521-4205-a7e8-9ac077eee5f0";
const DOOR = "aaaaaaaa11111111";
const BACK = "aaaaaaaa22222222";
const CHEST = "cccccccc11111111";

/**
 * The menu on its own, over a fake properties module: "Casa 03" with its entrance (and, with `twoDoors`, a back door)
 * and a chest, owned by "hans". `locks` is the server's lock of each part; `world` what the game holds locked.
 */
function load({ admin = new Set(), twoDoors = false, locked = {}, settings = undefined, sides = undefined } = {}) {
    const doors = twoDoors ? [DOOR, BACK] : [DOOR];
    const house = { id: "suchdol-casa-03", name: "Casa 03", kind: "house", keyItem: KEY, ownerSteamId: "hans", doors, stashGuid: "", doorKeys: { [BACK]: BACK_KEY } };
    const chest = { id: "suchdol-casa-03-bau-1", name: "Casa 03 · Baú 1", kind: "chest", keyItem: CHEST_KEY, ownerSteamId: "", parentId: house.id, doors: [], stashGuid: CHEST };
    const state = {
        locks: { [DOOR]: false, [BACK]: false, [CHEST]: false, ...locked },
        world: {},
        places: { [DOOR]: { x: 100, y: 100, z: 10 }, [BACK]: { x: 104, y: 100, z: 10 }, [CHEST]: { x: 101, y: 101, z: 10 } },
        inside: new Set(),
        noAreas: false,
        open: new Set(),
        gazeFails: false,
        pickable: true,
        viewOpens: true,
        stuckWait: 0,
    };
    const calls = { stuck: [], lock: [], doorLock: [], swing: [], unlockPart: [], hold: [], gaze: [], closed: [], chat: [], opened: [], timers: [], views: [], emitted: [], stored: [] };
    const handlers = new Map();
    const clientHandlers = new Map();
    const inventories = new Map();
    const players = new Map();
    let nextSession = 1;
    const clock = { now: 1_000_000 };

    const ownerOfPart = (property) => (property.parentId ? house : property);
    const fakeProperties = {
        propertyOfGuid: (guid) => (doors.includes(guid) ? house : guid === CHEST ? chest : null),
        placeOfGuid: (guid) => state.places[guid] ?? null,
        lockedNow: (guid) => (guid in state.locks && (doors.includes(guid) || guid === CHEST) ? state.locks[guid] : null),
        lockedInWorld: (guid) => (guid in state.world ? state.world[guid] : false),
        lockpickableOf: () => state.pickable,
        holdShut: (guid, shut) => { calls.hold.push({ guid, shut }); state.world[guid] = shut; return true; },
        unlockPart: (guid) => { calls.unlockPart.push(guid); state.locks[guid] = false; },
        setLocked: (id, value) => {
            calls.lock.push({ id, locked: value });
            for (const guid of id === house.id ? doors : [CHEST]) state.locks[guid] = value;
            return { ok: true, message: "ok" };
        },
        setDoorLocked: (id, index, value) => { calls.doorLock.push({ id, index, locked: value }); state.locks[doors[index]] = value; return { ok: true, message: "ok" }; },
        swingOpen: (guid) => { calls.swing.push(guid); return true; },
        holdGaze: (guid, shut) => { if (state.gazeFails) return false; calls.gaze.push({ guid, shut }); return true; },
        openInWorldNow: (guid) => state.open.has(guid),
        insideOf: (player) => (state.noAreas ? null : state.inside.has(player.steamId)),
        displayName: (property) => property.name,
        doorName: (property, index) => (index === 0 ? "Entrada" : `Porta ${index + 1}`),
        holdsKeyOf: (player, property, guid) => {
            const held = inventories.get(player.steamId) ?? [];
            return held.includes(property.keyItem) || (guid !== undefined && property.doorKeys?.[guid] !== undefined && held.includes(property.doorKeys[guid]));
        },
        ownerOf: (property) => { const top = ownerOfPart(property); return top.ownerSteamId === "" ? null : { steamId: top.ownerSteamId, name: "Hans" }; },
    };
    class FakeViews {
        constructor() { this.byPlayer = new Map(); this.busyGuids = new Map(); }
        busy(guid, playerId = -1) { const who = this.busyGuids.get(guid); return who !== undefined && who !== playerId; }
        isCopy(stash) { return stash.copy === true; }
        openBy(playerId) { return this.byPlayer.has(playerId); }
        open(player, stash) { calls.views.push({ player: player.steamId, stash: stash.levelGuid }); if (!state.viewOpens) return false; this.byPlayer.set(player.id, stash.levelGuid); this.busyGuids.set(stash.levelGuid, player.id); return true; }
        changed() {}
        closed() {}
        endAll() { calls.views.push("endAll"); }
    }
    const stashes = { [CHEST]: { levelGuid: CHEST, id: 77 } };
    const context = {
        exports: {},
        require: (id) => {
            if (id === "./auth.js") return { isAdmin: (player) => admin.has(player.steamId) };
            if (id === "./properties.js") return fakeProperties;
            if (id === "./chest-view.js") return { ChestViews: FakeViews };
            if (id === "./stuck.js") {
                return {
                    minutesText: (ms) => `${Math.ceil(ms / 60_000)} minutos`,
                    readyIn: () => state.stuckWait,
                    unstick: (player) => { calls.stuck.push(player.steamId); return { ok: true, message: "levado para a igreja" }; },
                };
            }
            if (id === "./store.js") {
                return {
                    ensureDir() {},
                    read: (file) => {
                        const value = file.endsWith("door-sides.json") ? sides : settings;
                        return value === undefined ? { status: "missing" } : { status: "ok", value, fromBackup: false };
                    },
                    write: (file, value) => calls.stored.push({ file, value }),
                };
            }
            return assert.fail(`unexpected require ${id}`);
        },
        console: { log: (line) => calls.chat.push({ log: line }), error() {} },
        setTimeout: (fn, ms) => { calls.timers.push({ fn, ms }); return calls.timers.length; },
        setInterval: () => 1,
        clearInterval() {},
        Date: { now: () => clock.now },
        Chat: { sendToPlayer: (player, text) => calls.chat.push({ to: player.steamId, text }) },
        Events: { on: (name, fn) => handlers.set(name, fn), onClient: (name, fn) => clientHandlers.set(name, fn) },
        Dialogue: {
            open: (playerId, page) => { const session = nextSession++; calls.opened.push({ session, playerId, page }); return session; },
            close: (session) => calls.closed.push(session),
        },
        Inventory: { get: (player) => ({ items: (inventories.get(player.steamId) ?? []).map((item, index) => ({ id: `r${index}`, item, amount: 1 })) }) },
        Stash: { find: (guid) => stashes[guid] ?? null },
        Player: { getById: (id) => players.get(id) ?? null, all: () => [...players.values()] },
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/property-menu.js"), "utf8"), context);

    // A clock and timers of the test's own: `run()` fires what was scheduled.
    const menus = new context.exports.PropertyMenus(new FakeViews(), () => clock.now, (fn, ms) => calls.timers.push({ fn, ms }));
    const run = () => { for (const timer of calls.timers.splice(0)) timer.fn(); };
    let nextId = 1;
    const makePlayer = (steamId, position = { x: 101, y: 100, z: 10 }) => {
        const player = { id: nextId++, steamId, nickname: steamId, ready: true, alive: true, position, emit: (event, payload) => calls.emitted.push({ to: steamId, event, payload: JSON.parse(payload) }) };
        players.set(player.id, player);
        return player;
    };
    const give = (steamId, ...items) => inventories.set(steamId, [...(inventories.get(steamId) ?? []), ...items]);
    const door = (guid = DOOR) => ({ guid });
    const lastPage = () => calls.opened.at(-1).page;
    const optionIds = () => Array.from(lastPage().options, (option) => option.id);
    const option = (id) => lastPage().options.find((candidate) => candidate.id === id);
    const told = (steamId) => calls.chat.filter((entry) => entry.to === steamId).map((entry) => entry.text);
    return { api: context.exports, menus, state, calls, handlers, clientHandlers, clock, run, makePlayer, give, door, stash: stashes[CHEST], lastPage, optionIds, option, told, players };
}

test("at an unlocked door a player without its key just opens it: no menu, the game does it", () => {
    const sut = load();
    const ana = sut.makePlayer("ana");
    assert.equal(sut.menus.door(ana, sut.door(), "open", true), undefined);
    sut.run();
    assert.equal(sut.calls.opened.length, 0);
    assert.equal(sut.menus.door(ana, sut.door(), "close", true), undefined, "closing is never stopped");
    assert.equal(sut.menus.door(ana, { guid: "ffff000000000000" }, "open", true), undefined, "a door that is no property is the game's");
});

test("a key holder's press is refused and the menu comes up: Abrir and Trancar at an unlocked door", () => {
    const sut = load();
    const hans = sut.makePlayer("hans");
    sut.give("hans", KEY);
    assert.equal(sut.menus.door(hans, sut.door(), "open", true), false, "the game puts the door back");
    sut.run();
    assert.deepEqual(sut.optionIds(), ["open", "lock", "leave"]);

    sut.menus.choose(sut.calls.opened.at(-1).session, hans, "open");
    assert.deepEqual(sut.calls.swing, [DOOR]);
});

test("at a locked door without key or lockpick: what it is, Destrancar and Arrombar greyed with the reason, and Sair", () => {
    const sut = load({ locked: { [DOOR]: true } });
    const ana = sut.makePlayer("ana");
    assert.equal(sut.menus.door(ana, sut.door(), "open", true), false);
    sut.run();
    assert.deepEqual(sut.optionIds(), ["info", "unlock", "pick", "stuck", "leave"]);
    assert.equal(sut.option("info").enabled, false);
    assert.match(sut.option("info").text, /Casa 03: trancada/);
    assert.equal(sut.option("unlock").enabled, false);
    assert.match(sut.option("unlock").text, /precisa da chave/);
    assert.equal(sut.option("pick").enabled, false);
    assert.match(sut.option("pick").text, /precisa de uma gazua/);
    assert.ok(!sut.optionIds().includes("open"), "Abrir only when it is not locked");
});

test("the owner without the key is no key holder; an administrator is", () => {
    const sut = load({ admin: new Set(["adm"]), locked: { [DOOR]: true } });
    sut.menus.door(sut.makePlayer("hans"), sut.door(), "open", true);
    sut.run();
    assert.equal(sut.option("unlock").enabled, false, "the owner takes a key from the panel first");

    const adm = sut.makePlayer("adm");
    sut.menus.door(adm, sut.door(), "open", true);
    sut.run();
    assert.equal(sut.option("unlock").enabled, true);
    assert.ok(!sut.optionIds().includes("pick"), "no lockpicking for somebody with the key");
});

test("Destrancar unlocks and opens the door; Trancar locks it; one door of several is worked on its own", () => {
    const sut = load({ twoDoors: true, locked: { [DOOR]: true, [BACK]: true } });
    const hans = sut.makePlayer("hans");
    sut.give("hans", KEY);
    sut.menus.door(hans, sut.door(), "open", true);
    sut.run();
    assert.deepEqual(sut.optionIds(), ["info", "unlock", "unlockAll", "leave"]);
    sut.menus.choose(sut.calls.opened.at(-1).session, hans, "unlock");
    assert.deepEqual(sut.calls.doorLock.at(-1), { id: "suchdol-casa-03", index: 0, locked: false });
    assert.deepEqual(sut.calls.swing, [DOOR]);
    assert.match(sut.told("hans").at(-1), /Entrada: destrancada/);

    sut.menus.door(hans, sut.door(BACK), "open", true);
    sut.run();
    assert.deepEqual(sut.optionIds(), ["info", "unlock", "unlockAll", "lockAll", "leave"], "one shut, one open: both of the whole");
    sut.menus.choose(sut.calls.opened.at(-1).session, hans, "lockAll");
    assert.deepEqual(sut.calls.lock.at(-1), { id: "suchdol-casa-03", locked: true });

    sut.menus.door(hans, sut.door(), "open", true);
    sut.run();
    sut.menus.choose(sut.calls.opened.at(-1).session, hans, "unlockAll");
    assert.deepEqual(sut.calls.lock.at(-1), { id: "suchdol-casa-03", locked: false });
    sut.menus.door(hans, sut.door(), "open", true);
    sut.run();
    sut.menus.choose(sut.calls.opened.at(-1).session, hans, "lock");
    assert.deepEqual(sut.calls.doorLock.at(-1), { id: "suchdol-casa-03", index: 0, locked: true });
});

test("from inside, as the game says (keySide false), a locked door is opened without a key, that door only, and the owner told", () => {
    const sut = load({ locked: { [DOOR]: true } });
    const ana = sut.makePlayer("ana");
    const hans = sut.makePlayer("hans");
    sut.menus.door(ana, sut.door(), "open", false);
    sut.run();
    assert.deepEqual(sut.optionIds(), ["info", "inside", "unlock", "leave"], "no lockpicking from inside");
    sut.menus.choose(sut.calls.opened.at(-1).session, ana, "inside");
    assert.deepEqual(sut.calls.unlockPart, [DOOR]);
    assert.deepEqual(sut.calls.swing, [DOOR]);
    assert.match(sut.told("ana").at(-1), /abriu Casa 03 por dentro/);
    assert.match(sut.told(hans.steamId).at(-1), /Alguém abriu Casa 03 por dentro/);
});

test("Arrombar needs a lockpick: it puts a real lock on for the game's minigame, and a pick that works unlocks it for good", () => {
    const sut = load({ locked: { [DOOR]: true } });
    const ana = sut.makePlayer("ana");
    sut.makePlayer("hans");
    sut.give("ana", LOCKPICK);
    sut.menus.door(ana, sut.door(), "open", true);
    sut.run();
    assert.equal(sut.option("pick").enabled, true);
    assert.equal(sut.option("pick").text, "Arrombar");

    sut.menus.choose(sut.calls.opened.at(-1).session, ana, "pick");
    assert.deepEqual(sut.calls.hold.at(-1), { guid: DOOR, shut: true });
    assert.match(sut.told("ana").at(-1), /Segure E na fechadura de Casa 03/);
    assert.match(sut.told("hans").at(-1), /tentando arrombar Casa 03/);

    assert.equal(sut.menus.door(ana, sut.door(), "lockpick", true), undefined, "the game's own lockpick is let through");
    sut.state.world[DOOR] = false;
    sut.menus.tick();
    assert.deepEqual(sut.calls.unlockPart, [DOOR]);
    assert.deepEqual(sut.calls.hold.at(-1), { guid: DOOR, shut: false });
    assert.match(sut.told("ana").at(-1), /Você arrombou Casa 03/);
    assert.match(sut.told("hans").at(-1), /Alguém arrombou Casa 03!/);
});

test("a lockpicking ends after two minutes, or when the picker walks off, and the lock goes back to the server's", () => {
    const sut = load({ locked: { [DOOR]: true } });
    const ana = sut.makePlayer("ana");
    sut.give("ana", LOCKPICK);
    sut.menus.door(ana, sut.door(), "open", true);
    sut.run();
    sut.menus.choose(sut.calls.opened.at(-1).session, ana, "pick");
    sut.clock.now += sut.api.PICK_WINDOW_MS + 1;
    sut.menus.tick();
    assert.deepEqual(sut.calls.hold.at(-1), { guid: DOOR, shut: false });
    assert.deepEqual(sut.calls.unlockPart, [], "not picked");
    assert.match(sut.told("ana").at(-1), /voltou a ficar como estava/);

    sut.menus.door(ana, sut.door(), "open", true);
    sut.run();
    sut.menus.choose(sut.calls.opened.at(-1).session, ana, "pick");
    ana.position = { x: 150, y: 100, z: 10 };
    sut.menus.tick();
    assert.deepEqual(sut.calls.hold.at(-1), { guid: DOOR, shut: false });
});

test("a second picker waits; a lock the level does not let be picked is said so", () => {
    const sut = load({ locked: { [DOOR]: true } });
    const ana = sut.makePlayer("ana");
    const bia = sut.makePlayer("bia");
    sut.give("ana", LOCKPICK);
    sut.give("bia", LOCKPICK);
    sut.menus.door(ana, sut.door(), "open", true);
    sut.run();
    sut.menus.choose(sut.calls.opened.at(-1).session, ana, "pick");
    sut.menus.door(bia, sut.door(), "open", true);
    sut.run();
    assert.equal(sut.option("pick").enabled, false);
    assert.match(sut.option("pick").text, /alguém já está tentando/);

    sut.state.pickable = false;
    sut.menus.left(ana);
    sut.menus.door(bia, sut.door(), "open", true);
    sut.run();
    assert.match(sut.option("pick").text, /não se arromba/);
});

test("Abrir chosen after the door got locked meanwhile is refused; a choice from too far closes the menu", () => {
    const sut = load();
    const hans = sut.makePlayer("hans");
    sut.give("hans", KEY);
    sut.menus.door(hans, sut.door(), "open", true);
    sut.run();
    sut.state.locks[DOOR] = true;
    sut.menus.choose(sut.calls.opened.at(-1).session, hans, "open");
    assert.deepEqual(sut.calls.swing, []);
    assert.match(sut.told("hans").at(-1), /está trancada/);

    sut.menus.door(hans, sut.door(), "open", true);
    sut.run();
    hans.position = { x: 200, y: 100, z: 10 };
    const session = sut.calls.opened.at(-1).session;
    sut.menus.choose(session, hans, "unlock");
    assert.ok(sut.calls.closed.includes(session));
    assert.equal(sut.calls.doorLock.length + sut.calls.lock.length, 0);
});

test("a chest: open to anybody when unlocked, the menu for a key holder or when locked, and Abrir opens it on a copy", () => {
    const sut = load();
    const ana = sut.makePlayer("ana");
    const hans = sut.makePlayer("hans");
    sut.give("hans", CHEST_KEY);
    assert.equal(sut.menus.chest(ana, sut.stash, "open"), undefined, "the game opens it");
    sut.run();
    assert.equal(sut.calls.opened.length, 0);

    assert.equal(sut.menus.chest(hans, sut.stash, "open"), false);
    sut.run();
    assert.deepEqual(sut.optionIds(), ["open", "lock", "leave"]);
    sut.menus.choose(sut.calls.opened.at(-1).session, hans, "open");
    assert.deepEqual(sut.calls.views.at(-1), { player: "hans", stash: CHEST });

    assert.equal(sut.menus.chest(ana, sut.stash, "open"), false, "somebody has it open on a copy");
    assert.match(sut.told("ana").at(-1), /Alguém está mexendo neste baú/);
});

test("a chest whose copy cannot be opened opens from its own prompt once, for a little while", () => {
    const sut = load({ locked: { [CHEST]: true } });
    const hans = sut.makePlayer("hans");
    sut.give("hans", CHEST_KEY);
    sut.state.viewOpens = false;
    assert.equal(sut.menus.chest(hans, sut.stash, "open"), false);
    sut.run();
    assert.deepEqual(sut.optionIds(), ["info", "unlock", "leave"]);
    sut.menus.choose(sut.calls.opened.at(-1).session, hans, "unlock");
    assert.deepEqual(sut.calls.lock.at(-1), { id: "suchdol-casa-03-bau-1", locked: false });
    assert.match(sut.told("hans").at(-1), /Aperte E no baú para abrir/);

    assert.equal(sut.menus.chest(hans, sut.stash, "open"), undefined, "the pass");
    sut.clock.now += 10;
    sut.state.locks[CHEST] = true;
    assert.equal(sut.menus.chest(hans, sut.stash, "open"), false, "used once");
});

test("a chest picked with the game's minigame is unlocked when its screen comes up for the picker", () => {
    const sut = load({ locked: { [CHEST]: true } });
    const ana = sut.makePlayer("ana");
    sut.give("ana", LOCKPICK);
    sut.menus.chest(ana, sut.stash, "open");
    sut.run();
    sut.menus.choose(sut.calls.opened.at(-1).session, ana, "pick");
    assert.deepEqual(sut.calls.hold.at(-1), { guid: CHEST, shut: true });
    assert.equal(sut.menus.chest(ana, sut.stash, "lockpick"), undefined, "the minigame starts");
    sut.menus.stashOpened(sut.stash, ana);
    assert.deepEqual(sut.calls.unlockPart, [CHEST]);
    assert.match(sut.told("ana").at(-1), /Você arrombou Casa 03 · Baú 1/);
});

test("E pressed where the game said nothing brings the menu up anyway, and not where it did", () => {
    const sut = load({ locked: { [DOOR]: true } });
    const ana = sut.makePlayer("ana");
    sut.menus.use(ana, DOOR);
    sut.clock.now += 400;
    sut.run();
    assert.equal(sut.calls.opened.length, 1, "a client out of step with the server still gets its menu");
    assert.ok(sut.calls.chat.some((entry) => entry.log && /o jogo não avisou/.test(entry.log)));
    sut.menus.closed(sut.calls.opened.at(-1).session);

    sut.menus.door(ana, sut.door(), "open", true);
    sut.menus.use(ana, DOOR);
    sut.run();
    assert.equal(sut.calls.opened.length, 2, "only the game's own press opened it, once");

    sut.menus.closed(sut.calls.opened.at(-1).session);
    sut.state.locks[DOOR] = false;
    sut.clock.now += 5_000;
    sut.menus.use(ana, DOOR);
    sut.run();
    assert.equal(sut.calls.opened.length, 2, "an unlocked door is nothing to ask about without a key");

    ana.position = { x: 110, y: 100, z: 10 };
    sut.state.locks[DOOR] = true;
    sut.clock.now += 5_000;
    sut.menus.use(ana, DOOR);
    sut.run();
    assert.equal(sut.calls.opened.length, 2, "too far for E");
});

test("a key turned in the game while a door was held for a lockpicking unlocks it by the key; the lockpicking ends quietly", () => {
    const sut = load({ locked: { [DOOR]: true } });
    const ana = sut.makePlayer("ana");
    const hans = sut.makePlayer("hans");
    sut.give("ana", LOCKPICK);
    sut.give("hans", KEY);
    sut.menus.door(ana, sut.door(), "open", true);
    sut.run();
    sut.menus.choose(sut.calls.opened.at(-1).session, ana, "pick");

    assert.equal(sut.menus.door(sut.makePlayer("bia"), sut.door(), "unlock", true), false, "no key, from outside: refused");
    assert.equal(sut.menus.door(hans, sut.door(), "unlock", true), undefined);
    sut.run();
    assert.deepEqual(sut.calls.hold.at(-1), { guid: DOOR, shut: false });
    assert.deepEqual(sut.calls.lock.at(-1), { id: "suchdol-casa-03", locked: false });
    sut.state.world[DOOR] = false;
    sut.menus.tick();
    assert.ok(!sut.told("ana").some((text) => /arrombou/.test(text)), "nobody picked it");
});

test("everything is wired: the game's door and chest events, the client's E, the menu's choices, and a stop that lets every lock go", () => {
    const sut = load();
    sut.api.installPropertyMenu();
    for (const name of ["doorInteract", "stashInteract", "stashOpen", "stashInventoryChanged", "stashClose", "dialogueChoice", "dialogueClosed", "playerDisconnect", "playerDied", "resourceStop"]) {
        assert.ok(sut.handlers.has(name), name);
    }
    assert.ok(sut.clientHandlers.has("kcdc-gamemode:props.use"));
    assert.doesNotThrow(() => sut.clientHandlers.get("kcdc-gamemode:props.use")(sut.makePlayer("x"), "not json"));
    sut.handlers.get("resourceStop")("kcdc-gamemode");
    assert.ok(sut.calls.views.includes("endAll"));
});

// ---------------------------------------------------------------------------------------------
// The look: a door the menu is about to come up at is held locked in the world while its player looks at it from outside.

/** hans holds the key of Casa 03 and stands a metre from its (unlocked) entrance, outside; the clock is the test's own. */
function gazer(options = {}) {
    const sut = load(options);
    const hans = sut.makePlayer("hans");
    sut.give("hans", KEY);
    const said = () => sut.calls.emitted.filter((entry) => entry.to === "hans" && entry.event === "kcdc-gamemode:props.gazed").map((entry) => entry.payload.guid);
    return { sut, hans, said };
}

test("a key holder's look holds the door locked for the game, tells the client, and lets it go when the look moves off", () => {
    const { sut, hans, said } = gazer();
    sut.menus.gaze(hans, DOOR);
    assert.deepEqual(sut.calls.gaze, [{ guid: DOOR, shut: true }]);
    assert.deepEqual(said(), [DOOR]);
    assert.deepEqual({ ...sut.menus.gazing() }, { doors: 1, holds: 1, leaks: 0, sides: 0, releases: 0 });

    sut.clock.now += 700;
    sut.menus.gaze(hans, DOOR);
    assert.equal(sut.calls.gaze.length, 1, "the same look said again holds nothing twice");
    assert.deepEqual(said(), [DOOR, DOOR], "but it is answered, so the client knows the hold is alive");

    sut.menus.gaze(hans, "");
    assert.deepEqual(sut.calls.gaze.at(-1), { guid: DOOR, shut: false });
    assert.deepEqual(said().at(-1), "");
    assert.equal(sut.menus.gazing().doors, 0);
});

test("a door meant locked is held for anybody who looks at it, key or not: the menu is what they get", () => {
    const sut = load({ locked: { [DOOR]: true } });
    const ana = sut.makePlayer("ana");
    sut.menus.gaze(ana, DOOR);
    assert.deepEqual(sut.calls.gaze, [{ guid: DOOR, shut: true }]);
});

test("nothing is held where a press would not bring the menu up", () => {
    const sut = load();
    const ana = sut.makePlayer("ana");
    sut.menus.gaze(ana, DOOR);
    assert.deepEqual(sut.calls.gaze, [], "an unlocked door and no key: the game just opens it");
    sut.players.delete(ana.id);

    const hans = sut.makePlayer("hans");
    sut.give("hans", KEY);
    sut.state.open.add(DOOR);
    sut.menus.gaze(hans, DOOR);
    assert.deepEqual(sut.calls.gaze, [], "a door that stands open is closed by the game's own prompt");
    sut.state.open.clear();

    hans.position = { x: 120, y: 100, z: 10 };
    sut.clock.now += 300;
    sut.menus.gaze(hans, DOOR);
    assert.deepEqual(sut.calls.gaze, [], "too far for the press to count");
    hans.position = { x: 101, y: 100, z: 10 };

    sut.clock.now += 300;
    sut.menus.gaze(hans, CHEST);
    sut.clock.now += 300;
    sut.menus.gaze(hans, "ffff000000000000");
    assert.deepEqual(sut.calls.gaze, [], "a chest, or something that is no property, is not a door of one");

    sut.clock.now += 300;
    sut.menus.gaze(hans, DOOR);
    assert.equal(sut.calls.gaze.length, 1, "and the door itself still is held");
});

test("from inside the door is not held; where no area claims it and nobody has used it yet, it is held from either side, said once", () => {
    const { sut, hans } = gazer();
    sut.state.inside.add("hans");
    sut.menus.gaze(hans, DOOR);
    assert.deepEqual(sut.calls.gaze, [], "from the manual side the game still offers Abrir at a locked door, and a lock would make it a refusal");
    sut.state.inside.clear();

    sut.state.noAreas = true;
    sut.clock.now += 300;
    sut.menus.gaze(hans, DOOR);
    assert.deepEqual(sut.calls.gaze, [{ guid: DOOR, shut: true }], "the client lets it go if this is the side without the keyhole");
    sut.clock.now += 300;
    sut.menus.gaze(hans, DOOR);
    const said = sut.calls.chat.filter((entry) => entry.log && /não tem área do jogo/.test(entry.log));
    assert.equal(said.length, 1, "written to the log once for the door, not at every look");
    assert.match(said[0].log, /Casa 03.*ninguém a usou ainda/);
});

test("a door no area claims learns its sides from the game's own word at each press, and keeps them", () => {
    const sut = load();
    sut.state.noAreas = true;
    const ana = sut.makePlayer("ana", { x: 101, y: 100.5, z: 10 });
    const bia = sut.makePlayer("bia", { x: 99, y: 100.5, z: 10 });
    const at = (x, y) => ({ ...sut.players.get(ana.id), position: { x, y, z: 10 } });
    assert.equal(sut.menus.sideOf(ana, DOOR), null, "nobody has used it yet");

    sut.menus.door(ana, sut.door(), "close", true);
    assert.ok(sut.calls.chat.some((entry) => entry.log && /Casa 03 não tem área do jogo; o lado dela foi aprendido agora, com ana do lado da fechadura/.test(entry.log)));
    assert.equal(sut.menus.sideOf(at(102, 100), DOOR), false, "the keyhole's side is outside");
    assert.equal(sut.menus.sideOf(at(98.5, 100), DOOR), true, "the other side is inside");
    assert.equal(sut.menus.sideOf(at(100.1, 100), DOOR), null, "at the door itself, neither");

    // a press from the other side, as far off to one side, takes the slant out
    sut.menus.door(bia, sut.door(), "close", false);
    assert.equal(sut.menus.sideOf(at(100.4, 102), DOOR), false);
    assert.equal(sut.menus.sideOf(at(99.6, 102), DOOR), true);
    assert.equal(sut.menus.gazing().sides, 1);

    // too far off to count
    const far = sut.makePlayer("cleo", { x: 95, y: 100, z: 10 });
    sut.menus.door(far, sut.door(), "close", true);
    assert.equal(sut.menus.sideOf(at(98.5, 100), DOOR), true, "a press 5 m off taught nothing");

    // written down on the beat, not more than every ten seconds, and read back
    sut.menus.tick();
    const stored = sut.calls.stored.filter((entry) => entry.file === "playerdata/door-sides.json");
    assert.equal(stored.length, 1);
    const kept = JSON.parse(JSON.stringify(stored[0].value));
    assert.deepEqual(Object.keys(kept), [DOOR]);
    assert.equal(kept[DOOR].n, 2);
    assert.ok(kept[DOOR].x > 1.7 && Math.abs(kept[DOOR].y) < 1e-9, JSON.stringify(kept));
    sut.menus.door(bia, sut.door(), "close", false);
    sut.menus.tick();
    assert.equal(sut.calls.stored.filter((entry) => entry.file === "playerdata/door-sides.json").length, 1, "not again within ten seconds");
    sut.clock.now += 10_000;
    sut.menus.tick();
    assert.equal(sut.calls.stored.filter((entry) => entry.file === "playerdata/door-sides.json").length, 2);

    const again = load({ sides: kept });
    again.state.noAreas = true;
    again.menus.loadSides();
    const dan = again.makePlayer("dan", { x: 98.5, y: 100, z: 10 });
    assert.equal(again.menus.sideOf(dan, DOOR), true, "what was learned before the restart still says the side");
    assert.equal(again.menus.gazing().sides, 1);
});

test("where the areas claim the door, they say the side, and a press teaches nothing", () => {
    const sut = load();
    const ana = sut.makePlayer("ana");
    sut.menus.door(ana, sut.door(), "close", false);
    assert.equal(sut.menus.gazing().sides, 0);
    assert.equal(sut.menus.sideOf(ana, DOOR), false);
    sut.state.inside.add("ana");
    assert.equal(sut.menus.sideOf(ana, DOOR), true);
});

test("a door whose sides were learned is held from outside only, for a bystander too", () => {
    const sut = load({ locked: { [DOOR]: true } });
    sut.state.noAreas = true;
    const ana = sut.makePlayer("ana", { x: 101.5, y: 100, z: 10 });
    sut.menus.door(ana, sut.door(), "open", true);
    sut.run();

    sut.clock.now += 300;
    sut.menus.gaze(ana, DOOR);
    assert.deepEqual(sut.calls.gaze, [{ guid: DOOR, shut: true }], "outside: held");
    sut.menus.gaze(ana, "");

    ana.position = { x: 98.8, y: 100, z: 10 };
    sut.clock.now += 300;
    sut.menus.gaze(ana, DOOR);
    assert.deepEqual(sut.calls.gaze.at(-1), { guid: DOOR, shut: false }, "inside: not held");
    assert.equal(sut.menus.gazing().doors, 0);

    // a bystander outside a door meant locked loses nothing; one inside would
    ana.position = { x: 101.5, y: 100, z: 10 };
    const bia = sut.makePlayer("bia", { x: 102.5, y: 100, z: 10 });
    sut.clock.now += 300;
    sut.menus.gaze(ana, DOOR);
    assert.equal(sut.menus.gazing().doors, 1);
    bia.position = { x: 98, y: 100, z: 10 };
    sut.clock.now += 300;
    sut.menus.gazeTick();
    assert.equal(sut.menus.gazing().doors, 0, "somebody inside would have lost the smooth way out");
});

test("a client that finds the game's Abrir still up under the lock lets the door go, and nobody there is held again for a while", () => {
    const sut = load({ locked: { [DOOR]: true } });
    sut.state.noAreas = true;
    const ana = sut.makePlayer("ana", { x: 99, y: 100, z: 10 });
    sut.menus.gaze(ana, DOOR);
    assert.equal(sut.menus.gazing().doors, 1);

    sut.menus.gaze(ana, "", DOOR);
    assert.deepEqual(sut.calls.gaze.at(-1), { guid: DOOR, shut: false });
    assert.equal(sut.menus.gazing().releases, 1);
    assert.ok(sut.calls.chat.some((entry) => entry.log && /o cliente de ana soltou a trava de Casa 03/.test(entry.log)));

    sut.clock.now += 300;
    sut.menus.gaze(ana, DOOR);
    assert.equal(sut.menus.gazing().doors, 0, "the same spot: not held again");
    ana.position = { x: 97.5, y: 100, z: 10 };
    sut.clock.now += 300;
    sut.menus.gaze(ana, DOOR);
    assert.equal(sut.menus.gazing().doors, 1, "a step and a half off, it is another spot");
    sut.menus.gaze(ana, "");
    ana.position = { x: 99, y: 100, z: 10 };
    sut.clock.now += 16 * 60_000;
    sut.menus.gaze(ana, DOOR);
    assert.equal(sut.menus.gazing().doors, 1, "a quarter of an hour later, the spot is forgotten");

    // a release for a door that is not held for this player is nothing
    const stray = load({ locked: { [DOOR]: true } });
    stray.state.noAreas = true;
    const bia = stray.makePlayer("bia", { x: 99, y: 100, z: 10 });
    stray.menus.gaze(bia, "", DOOR);
    assert.equal(stray.menus.gazing().releases, 0);
});

test("a release from outside, by the areas, keeps no spot: the lock did not silence the game there, and that is said", () => {
    const sut = load({ locked: { [DOOR]: true } });
    const ana = sut.makePlayer("ana");
    sut.menus.gaze(ana, DOOR);
    sut.menus.gaze(ana, "", DOOR);
    assert.ok(sut.calls.chat.some((entry) => entry.log && /do lado de fora com a trava ao olhar posta: a trava saiu/.test(entry.log)));
    sut.clock.now += 300;
    sut.menus.gaze(ana, DOOR);
    assert.equal(sut.menus.gazing().doors, 1, "held again: nothing was kept of the spot");
});

test("E at a held door with the game's own prompt still up lets the door go for that player, quietly, and the next press opens it", () => {
    const sut = load({ locked: { [DOOR]: true } });
    sut.state.noAreas = true;
    const ana = sut.makePlayer("ana", { x: 99, y: 100, z: 10 });
    sut.makePlayer("hans", { x: 150, y: 150, z: 10 });
    sut.menus.gaze(ana, DOOR);
    sut.menus.use(ana, DOOR, true);
    assert.deepEqual(sut.calls.timers, [], "no menu: it would only say the door is locked, to somebody inside");
    assert.deepEqual(sut.calls.gaze.at(-1), { guid: DOOR, shut: false });
    assert.ok(sut.calls.chat.some((entry) => entry.log && /ana apertou E em Casa 03 travada para o olhar com o "Abrir" do jogo na tela/.test(entry.log)));

    sut.clock.now += 300;
    sut.menus.gaze(ana, DOOR);
    assert.equal(sut.menus.gazing().doors, 0, "not held again for a while");

    assert.equal(sut.menus.door(ana, sut.door(), "open", false), undefined, "the game's own press from inside opens it");
    assert.deepEqual(sut.calls.unlockPart, [DOOR]);
    assert.match(sut.told("hans").at(-1), /Alguém abriu Casa 03 por dentro/);
    assert.equal(sut.menus.sideOf(ana, DOOR), true, "and the door has learned its inside");

    sut.clock.now += 15_000;
    sut.menus.gazeTick();
    ana.position = { x: 101.5, y: 100, z: 10 };
    sut.state.locks[DOOR] = true;
    sut.menus.gaze(ana, DOOR);
    assert.equal(sut.menus.gazing().doors, 1, "outside, after a while, it is held as before");
});

test("E at a held door with our own Abrir up, or outside by the areas, brings the menu as before", () => {
    const sut = load({ locked: { [DOOR]: true } });
    sut.state.noAreas = true;
    const ana = sut.makePlayer("ana", { x: 101, y: 100, z: 10 });
    sut.menus.gaze(ana, DOOR);
    sut.menus.use(ana, DOOR, false);
    assert.equal(sut.calls.timers.at(-1).ms, sut.api.GAZED_WAIT_MS);
    sut.run();
    assert.equal(sut.calls.opened.length, 1);

    const outside = load({ locked: { [DOOR]: true } });
    const bia = outside.makePlayer("bia");
    outside.menus.gaze(bia, DOOR);
    outside.menus.use(bia, DOOR, true);
    assert.equal(outside.calls.timers.at(-1).ms, outside.api.GAZED_WAIT_MS, "the areas say outside: the lock leaked, and the menu answers");
    outside.run();
    assert.equal(outside.calls.opened.length, 1);
});

test("from the side without the keyhole the door just opens, for a key holder too: no menu, nothing put back", () => {
    const sut = load();
    const hans = sut.makePlayer("hans");
    sut.give("hans", KEY);
    sut.state.inside.add("hans");
    assert.equal(sut.menus.door(hans, sut.door(), "open", false), undefined);
    sut.run();
    assert.equal(sut.calls.opened.length, 0);
    assert.deepEqual(sut.calls.unlockPart, [], "it was not locked: nothing to draw");
});

test("at a door open to all nobody else near may be shut out by a look; at one meant locked only somebody inside is", () => {
    const { sut, hans } = gazer();
    const bia = sut.makePlayer("bia", { x: 105, y: 100, z: 10 });
    sut.menus.gaze(hans, DOOR);
    assert.deepEqual(sut.calls.gaze, [], "bia, within eight metres, would find the door shut and nobody to blame");

    bia.position = { x: 150, y: 100, z: 10 };
    sut.clock.now += 300;
    sut.menus.gaze(hans, DOOR);
    assert.deepEqual(sut.calls.gaze, [{ guid: DOOR, shut: true }]);

    bia.position = { x: 105, y: 100, z: 10 };
    sut.clock.now += 300;
    sut.menus.gazeTick();
    assert.deepEqual(sut.calls.gaze.at(-1), { guid: DOOR, shut: false }, "she walked up: it is let go within a beat");

    // a door meant locked: everybody is sent to the menu anyway
    const locked = load({ locked: { [DOOR]: true } });
    const ana = locked.makePlayer("ana");
    const cleo = locked.makePlayer("cleo", { x: 104, y: 100, z: 10 });
    locked.menus.gaze(ana, DOOR);
    assert.deepEqual(locked.calls.gaze, [{ guid: DOOR, shut: true }], "a bystander outside loses nothing");
    locked.state.inside.add("cleo");
    locked.clock.now += 300;
    locked.menus.gazeTick();
    assert.deepEqual(locked.calls.gaze.at(-1), { guid: DOOR, shut: false }, "somebody inside would have lost the smooth way out");
    void cleo;
});

test("a look not said again lets the door go after two seconds; faster reports are ignored; another door moves the hold", () => {
    const { sut, hans } = gazer({ twoDoors: true });
    sut.menus.gaze(hans, DOOR);
    sut.clock.now += 100;
    sut.menus.gaze(hans, BACK);
    assert.deepEqual(sut.calls.gaze, [{ guid: DOOR, shut: true }], "a report within 250 ms of the last is not taken");

    sut.clock.now += 200;
    sut.menus.gaze(hans, BACK);
    assert.deepEqual(sut.calls.gaze.slice(1), [{ guid: DOOR, shut: false }, { guid: BACK, shut: true }], "one look at a time");

    sut.clock.now += sut.api.GAZE_TTL_MS - 1;
    sut.menus.gazeTick();
    assert.equal(sut.menus.gazing().doors, 1);
    sut.clock.now += 2;
    sut.menus.gazeTick();
    assert.deepEqual(sut.calls.gaze.at(-1), { guid: BACK, shut: false });
    assert.equal(sut.menus.gazing().doors, 0);
});

test("two players looking at one door share the hold, and it is let go with the last of them", () => {
    const sut = load({ locked: { [DOOR]: true } });
    const ana = sut.makePlayer("ana");
    const bia = sut.makePlayer("bia");
    sut.menus.gaze(ana, DOOR);
    sut.clock.now += 300;
    sut.menus.gaze(bia, DOOR);
    assert.deepEqual(sut.calls.gaze, [{ guid: DOOR, shut: true }], "one lock for both");
    assert.deepEqual(sut.calls.emitted.filter((entry) => entry.to === "bia").map((entry) => entry.payload.guid), [DOOR]);

    sut.menus.gaze(ana, "");
    assert.equal(sut.calls.gaze.length, 1, "bia still looks");
    sut.menus.gaze(bia, "");
    assert.deepEqual(sut.calls.gaze.at(-1), { guid: DOOR, shut: false });
});

test("a player who leaves, dies or is gone lets their door go", () => {
    const left = gazer();
    left.sut.menus.gaze(left.hans, DOOR);
    left.sut.menus.left(left.hans);
    assert.deepEqual(left.sut.calls.gaze.at(-1), { guid: DOOR, shut: false });
    assert.equal(left.sut.menus.gazing().doors, 0);

    const dead = gazer();
    dead.sut.menus.gaze(dead.hans, DOOR);
    dead.hans.alive = false;
    dead.sut.menus.gazeTick();
    assert.deepEqual(dead.sut.calls.gaze.at(-1), { guid: DOOR, shut: false }, "a dead body holds nothing");

    const gone = gazer();
    gone.sut.menus.gaze(gone.hans, DOOR);
    gone.sut.players.delete(gone.hans.id);
    gone.sut.menus.gazeTick();
    assert.deepEqual(gone.sut.calls.gaze.at(-1), { guid: DOOR, shut: false }, "nor does one the server no longer knows");
});

test("a lockpicking that begins at a held door keeps the lock, and the look lets go of its own part", () => {
    const sut = load({ locked: { [DOOR]: true } });
    const ana = sut.makePlayer("ana");
    sut.give("ana", LOCKPICK);
    sut.menus.gaze(ana, DOOR);
    sut.menus.door(ana, sut.door(), "open", true);
    sut.run();
    sut.menus.choose(sut.calls.opened.at(-1).session, ana, "pick");
    assert.deepEqual(sut.calls.hold.at(-1), { guid: DOOR, shut: true });

    sut.clock.now += 300;
    sut.menus.gazeTick();
    assert.deepEqual(sut.calls.gaze.at(-1), { guid: DOOR, shut: false }, "the look steps aside for the picking");
    sut.clock.now += 300;
    sut.menus.gaze(ana, DOOR);
    assert.equal(sut.calls.gaze.filter((call) => call.shut).length, 1, "and does not take the door again while it is being picked");
});

test("E at a held door brings the menu up after a short wait, with nothing said about the game missing it", () => {
    const sut = load({ locked: { [DOOR]: true } });
    const ana = sut.makePlayer("ana");
    sut.menus.gaze(ana, DOOR);
    sut.menus.use(ana, DOOR);
    assert.equal(sut.calls.timers.at(-1).ms, sut.api.GAZED_WAIT_MS);
    sut.run();
    assert.equal(sut.calls.opened.length, 1);
    assert.ok(!sut.calls.chat.some((entry) => entry.log && /o jogo não avisou/.test(entry.log)));

    // anywhere the lock is not held, the wait is the old one, and the log says the game was silent
    sut.menus.closed(sut.calls.opened.at(-1).session);
    sut.menus.gaze(ana, "");
    sut.menus.use(ana, DOOR);
    assert.equal(sut.calls.timers.at(-1).ms, sut.api.FALLBACK_WAIT_MS);
});

test("the game offering the door anyway at a held one is counted, and is still answered with the menu, once", () => {
    const sut = load({ locked: { [DOOR]: true } });
    const ana = sut.makePlayer("ana");
    sut.menus.gaze(ana, DOOR);
    sut.menus.use(ana, DOOR);
    assert.equal(sut.menus.door(ana, sut.door(), "open", true), false);
    sut.run();
    assert.equal(sut.calls.opened.length, 1, "the game's report and the E are one press");
    assert.equal(sut.menus.gazing().leaks, 1);
    const leak = sut.calls.chat.filter((entry) => entry.log && /o jogo ainda ofereceu Casa 03 a ana com a trava ao olhar posta \(1º caso\)/.test(entry.log));
    assert.equal(leak.length, 1);
});

test("from inside a locked house, as the game and the level's areas both say, the press is accepted and the door opens by hand", () => {
    const sut = load({ locked: { [DOOR]: true } });
    const ana = sut.makePlayer("ana");
    const hans = sut.makePlayer("hans");
    sut.state.inside.add("ana");
    assert.equal(sut.menus.door(ana, sut.door(), "open", false), undefined, "no refusal: the body is not made to take its opening back");
    sut.run();
    assert.equal(sut.calls.opened.length, 0, "and no menu");
    assert.deepEqual(sut.calls.unlockPart, [DOOR]);
    assert.match(sut.told(hans.steamId).at(-1), /Alguém abriu Casa 03 por dentro/);
    assert.ok(sut.calls.chat.some((entry) => entry.log && /ana abriu Casa 03 por dentro/.test(entry.log)));

    // a key holder inside is not a stranger: nobody is warned
    sut.state.locks[DOOR] = true;
    sut.give("hans", KEY);
    sut.state.inside.add("hans");
    const warned = sut.told(hans.steamId).length;
    assert.equal(sut.menus.door(hans, sut.door(), "open", false), undefined);
    assert.equal(sut.told(hans.steamId).length, warned);
});

test("from inside is believed unless the areas, or what the game said there before, say outside; the menu then, as before", () => {
    const sut = load({ locked: { [DOOR]: true } });
    const ana = sut.makePlayer("ana");
    assert.equal(sut.menus.door(ana, sut.door(), "open", false), false, "the game says inside, the areas say outside");
    sut.run();
    assert.deepEqual(sut.optionIds(), ["info", "inside", "unlock", "leave"], "Abrir por dentro is still there to choose");

    sut.state.noAreas = true;
    assert.equal(sut.menus.door(ana, sut.door(), "open", false), undefined, "no area claims the door: the game's word is enough");
    assert.deepEqual(sut.calls.unlockPart, [DOOR]);

    // the game said outside there before, from where ana stands now
    const learned = load({ locked: { [DOOR]: true } });
    learned.state.noAreas = true;
    const bia = learned.makePlayer("bia", { x: 101.5, y: 100, z: 10 });
    learned.menus.door(bia, learned.door(), "close", true);
    learned.menus.door(bia, learned.door(), "close", true);
    assert.equal(learned.menus.door(bia, learned.door(), "open", false), false, "a word against what was learned: the menu");
    learned.run();
    assert.ok(learned.optionIds().includes("inside"));

    sut.state.noAreas = false;
    sut.state.inside.add("ana");
    sut.state.locks[DOOR] = true;
    assert.equal(sut.menus.door(ana, sut.door(), "open", true), false, "the areas say inside, the game says it is the keyhole side: the menu");
    assert.equal(sut.menus.door(ana, { guid: BACK }, "open", false), undefined, "a door that is no property is the game's");
});

test("the game's own lockpick prompt at a held door is the menu's Arrombar, taken at once, for somebody who may and nobody else", () => {
    const sut = load({ locked: { [DOOR]: true } });
    const ana = sut.makePlayer("ana");
    const hans = sut.makePlayer("hans");
    const bia = sut.makePlayer("bia");
    sut.give("ana", LOCKPICK);
    sut.give("hans", KEY);
    sut.menus.gaze(ana, DOOR);
    sut.clock.now += 300;
    sut.menus.gaze(bia, DOOR);

    assert.equal(sut.menus.door(bia, sut.door(), "lockpick", true), false, "no lockpick in the bag");
    assert.equal(sut.menus.door(hans, sut.door(), "lockpick", true), false, "a key holder has no use for one");
    assert.equal(sut.menus.door(ana, sut.door(), "lockpick", true), undefined, "the minigame goes on");
    assert.deepEqual(sut.calls.hold.at(-1), { guid: DOOR, shut: true });
    assert.match(sut.told("hans").at(-1), /tentando arrombar Casa 03/);

    // it is a picking like the menu's: a pick that works is seen coming open
    sut.state.world[DOOR] = false;
    sut.menus.tick();
    assert.deepEqual(sut.calls.unlockPart, [DOOR]);
    assert.match(sut.told("ana").at(-1), /Você arrombou Casa 03/);

    const other = load({ locked: { [DOOR]: true } });
    const cleo = other.makePlayer("cleo");
    other.give("cleo", LOCKPICK);
    other.state.pickable = false;
    other.menus.gaze(cleo, DOOR);
    assert.equal(other.menus.door(cleo, other.door(), "lockpick", true), false, "a lock the level does not let be picked");
});

test("a lockpick reported at a door held only for a key holder's look is refused, and at one nobody looks at it goes on as before", () => {
    const { sut, hans } = gazer();
    sut.give("hans", LOCKPICK);
    sut.menus.gaze(hans, DOOR);
    assert.equal(sut.menus.door(hans, sut.door(), "lockpick", true), false, "an unlocked door held only for the look is nothing to pick");

    sut.menus.gaze(hans, "");
    assert.equal(sut.menus.door(hans, sut.door(), "lockpick", true), undefined, "no look, no say");
});

test("the switch: off lets every door go and holds nothing, it is kept, and it is read back; on is the default", () => {
    const { sut, hans } = gazer();
    sut.menus.gaze(hans, DOOR);
    assert.equal(sut.menus.gazeLockOn(), true);

    sut.menus.setGazeLock(false);
    assert.deepEqual(sut.calls.gaze.at(-1), { guid: DOOR, shut: false });
    assert.deepEqual(JSON.parse(JSON.stringify(sut.calls.stored.at(-1))), { file: "playerdata/property-menu.json", value: { gazeLock: false } });
    sut.clock.now += 300;
    sut.menus.gaze(hans, DOOR);
    assert.equal(sut.calls.gaze.filter((call) => call.shut).length, 1, "nothing is held while it is off");

    sut.menus.setGazeLock(true);
    sut.clock.now += 300;
    sut.menus.gaze(hans, DOOR);
    assert.equal(sut.calls.gaze.filter((call) => call.shut).length, 2);
    assert.deepEqual(JSON.parse(JSON.stringify(sut.calls.stored.at(-1).value)), { gazeLock: true });

    const kept = load({ settings: { gazeLock: false } });
    kept.menus.loadSettings();
    assert.equal(kept.menus.gazeLockOn(), false);
    const fresh = load();
    fresh.menus.loadSettings();
    assert.equal(fresh.menus.gazeLockOn(), true, "nothing stored: on");
    const odd = load({ settings: { gazeLock: "no" } });
    odd.menus.loadSettings();
    assert.equal(odd.menus.gazeLockOn(), true, "only an explicit false turns it off");
});

test("a door the level has not reported cannot be held, and nothing is told about it", () => {
    const { sut, hans, said } = gazer();
    sut.state.gazeFails = true;
    sut.menus.gaze(hans, DOOR);
    assert.deepEqual(said(), []);
    assert.equal(sut.menus.gazing().doors, 0);
});

test("the client's look is wired: the guid is checked, a stop lets every door go, and the lock is reported at start", () => {
    const sut = load();
    const logs = sut.calls.chat;
    sut.api.installPropertyMenu();
    assert.ok(sut.clientHandlers.has("kcdc-gamemode:props.gaze"));
    assert.ok(logs.some((entry) => entry.log && /trava ao olhar\): ligada/.test(entry.log)));

    const hans = sut.makePlayer("hans");
    sut.give("hans", KEY);
    const gaze = sut.clientHandlers.get("kcdc-gamemode:props.gaze");
    gaze(hans, "not json");
    gaze(hans, JSON.stringify({ guid: 7 }));
    gaze(hans, JSON.stringify({ guid: "../../etc/passwd" }));
    gaze(hans, JSON.stringify({}));
    assert.deepEqual(sut.calls.gaze, [], "anything that is not a level guid is dropped");

    gaze(hans, JSON.stringify({ guid: DOOR }));
    assert.deepEqual(sut.calls.gaze, [{ guid: DOOR, shut: true }]);
    gaze(hans, JSON.stringify({ guid: "" }));
    assert.deepEqual(sut.calls.gaze.at(-1), { guid: DOOR, shut: false }, "an empty guid is a look that moved off");

    sut.clock.now += 300;
    gaze(hans, JSON.stringify({ guid: DOOR }));
    sut.handlers.get("resourceStop")("kcdc-gamemode");
    assert.deepEqual(sut.calls.gaze.at(-1), { guid: DOOR, shut: false }, "a stop lets it go");
});

test("a key to one door opens that door and nothing else: not the house's other door, not 'the whole property'", () => {
    const sut = load({ twoDoors: true, locked: { [DOOR]: true, [BACK]: true } });
    const ana = sut.makePlayer("ana");
    sut.give("ana", BACK_KEY);

    sut.menus.door(ana, sut.door(BACK), "open", true);
    sut.run();
    assert.ok(sut.optionIds().includes("unlock"), "at the back door the key works");
    assert.equal(sut.option("unlock").enabled, true);
    assert.ok(!sut.optionIds().includes("unlockAll"), "a door key is no key to the whole house");

    sut.menus.door(ana, sut.door(), "open", true);
    sut.run();
    assert.equal(sut.option("unlock").enabled, false, "the entrance stays shut to it");
    assert.match(sut.option("unlock").text, /precisa da chave/);
});

test("a door key locks and unlocks its own door only, and the house key still does them all", () => {
    const sut = load({ twoDoors: true, locked: { [DOOR]: true, [BACK]: true } });
    const ana = sut.makePlayer("ana");
    sut.give("ana", BACK_KEY);
    sut.menus.door(ana, sut.door(BACK), "open", true);
    sut.run();
    const session = sut.calls.opened.at(-1).session;
    sut.menus.choose(session, ana, "unlockAll");
    assert.equal(sut.calls.lock.length, 0, "refused: it is not the house's key");
    sut.menus.choose(session, ana, "unlock");
    assert.deepEqual(sut.calls.doorLock, [{ id: "suchdol-casa-03", index: 1, locked: false }]);

    const hans = sut.makePlayer("hans");
    sut.give("hans", KEY);
    sut.menus.door(hans, sut.door(BACK), "open", true);
    sut.run();
    assert.ok(sut.optionIds().includes("lockAll") || sut.optionIds().includes("unlockAll"), "the house key reaches all of it");
});

test("a locked door with no way out for the one who stands there offers 'Estou preso', and it is the panel's cooldown that rules", () => {
    const sut = load({ locked: { [DOOR]: true } });
    const ana = sut.makePlayer("ana");
    sut.menus.door(ana, sut.door(), "open", true);
    sut.run();
    assert.ok(sut.optionIds().includes("stuck"));
    assert.equal(sut.option("stuck").enabled, true);
    assert.match(sut.option("stuck").text, /igreja mais próxima/);
    sut.menus.choose(sut.calls.opened.at(-1).session, ana, "stuck");
    assert.deepEqual(sut.calls.stuck, ["ana"]);
    assert.ok(sut.told("ana").includes("levado para a igreja"));

    sut.state.stuckWait = 45 * 60;
    sut.menus.door(ana, sut.door(), "open", true);
    sut.run();
    assert.equal(sut.option("stuck").enabled, false);
    assert.match(sut.option("stuck").text, /de novo em 45 minutos/);
});

test("'Estou preso' is not offered to a key holder, nor from inside (where the door opens by hand), nor at an open door", () => {
    const sut = load({ locked: { [DOOR]: true } });
    const hans = sut.makePlayer("hans");
    sut.give("hans", KEY);
    sut.menus.door(hans, sut.door(), "open", true);
    sut.run();
    assert.ok(!sut.optionIds().includes("stuck"));

    const open = load();
    const ana = open.makePlayer("ana");
    open.menus.door(ana, open.door(), "open", true);
    open.run();
    assert.equal(open.calls.opened.length, 0, "an unlocked door has no menu at all for a stranger");
});
