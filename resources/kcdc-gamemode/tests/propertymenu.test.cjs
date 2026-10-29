const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
require("./reachpatch.cjs");

// The doors and chests of the properties, the game's own way (src/server/property-menu.ts; user, 2026-10-19: "o E é apenas abrir, o F
// destrancar ou trancar (caso tenha a chave ou seja o dono da propriedade) ... o mesmo vale para baús").

const KEY = "kcdc-property:casa-03";
const CHEST_KEY = "kcdc-property:casa-03-bau-1";
const BACK_KEY = "kcdc-property:casa-03:door2";
const DOOR = "aaaaaaaa11111111";
const BACK = "aaaaaaaa22222222";
const CHEST = "cccccccc11111111";

/**
 * The module on its own, over a fake properties module: "Casa 03" with its entrance (and, with `twoDoors`, a back door) and a chest,
 * owned by "hans". `locked` is each part's lock; `lockSet` whether the house was locked on purpose (else the level's lock).
 */
function load({ admin = new Set(), twoDoors = false, locked = {}, lockSet = true, sides = undefined } = {}) {
    const doors = twoDoors ? [DOOR, BACK] : [DOOR];
    const house = { id: "suchdol-casa-03", name: "Casa 03", kind: "house", keyItem: KEY, ownerSteamId: "hans", doors, stashGuid: "", doorKeys: { [BACK]: BACK_KEY }, lockSet };
    const chest = { id: "suchdol-casa-03-bau-1", name: "Casa 03 · Baú 1", kind: "chest", keyItem: CHEST_KEY, ownerSteamId: "", parentId: house.id, doors: [], stashGuid: CHEST, lockSet };
    const state = {
        locks: { [DOOR]: false, [BACK]: false, [CHEST]: false, ...locked },
        places: { [DOOR]: { x: 100, y: 100, z: 10 }, [BACK]: { x: 104, y: 100, z: 10 }, [CHEST]: { x: 101, y: 101, z: 10 } },
        inside: new Set(),
        open: new Set(),
        noAreas: false,
        rooms: {},
        family: [],
    };
    const calls = { lock: [], doorLock: [], swing: [], unlockPart: [], chat: [], emitted: [], stored: [], marks: [], logs: [] };
    const handlers = new Map();
    const clientHandlers = new Map();
    const inventories = new Map();
    const players = new Map();
    const lockPicked = [];
    const clock = { now: 1_000_000 };

    const ownerOfPart = (property) => (property.parentId ? house : property);
    const fakeProperties = {
        propertyOfGuid: (guid) => (doors.includes(guid) ? house : guid === CHEST ? chest : null),
        placeOfGuid: (guid) => state.places[guid] ?? null,
        lockedNow: (guid) => (guid in state.locks && (doors.includes(guid) || guid === CHEST) ? state.locks[guid] : null),
        unlockPart: (guid) => { calls.unlockPart.push(guid); state.locks[guid] = false; },
        setLocked: (id, value) => {
            calls.lock.push({ id, locked: value });
            for (const guid of id === house.id ? doors : [CHEST]) state.locks[guid] = value;
            return { ok: true, message: "ok" };
        },
        setDoorLocked: (id, index, value) => { calls.doorLock.push({ id, index, locked: value }); state.locks[doors[index]] = value; return { ok: true, message: "ok" }; },
        swingOpen: (guid) => { calls.swing.push(guid); return true; },
        doorStandsOpen: (guid) => state.open.has(guid),
        insideOf: (player) => (state.noAreas ? null : state.inside.has(player.steamId)),
        displayName: (property) => property.name,
        doorName: (property, index) => (index === 0 ? "Entrada" : `Porta ${index + 1}`),
        // As the real one: the part's own key, a chest's house key, a door's own key.
        holdsKeyOf: (player, property, guid) => {
            const held = inventories.get(player.steamId) ?? [];
            if (held.includes(property.keyItem) || (property.kind === "chest" && property.parentId !== "" && held.includes(house.keyItem))) {
                return true;
            }
            const own = guid === undefined ? undefined : property.doorKeys?.[guid];
            return own !== undefined && held.includes(own);
        },
        ownerOf: (property) => { const top = ownerOfPart(property); return top.ownerSteamId === "" ? null : { steamId: top.ownerSteamId, name: "Hans" }; },
        isOwner: (player, property) => ownerOfPart(property).ownerSteamId !== "" && ownerOfPart(property).ownerSteamId === player.steamId,
        npcOf: () => null,
        lockPicked,
    };
    const context = {
        exports: {},
        require: (id) => {
            if (id === "./auth.js") return { isAdmin: (player) => admin.has(player.steamId) };
            if (id === "./properties.js") return fakeProperties;
            if (id === "./item-names.js") return { itemLine: (row) => `${row.amount}x ${row.name ?? row.item}` };
            if (id === "./rooms.js") return { holdsRoomPart: (player, guid) => (state.rooms[guid] ?? []).includes(player.steamId) };
            if (id === "./thieves.js") return { noteTheft: (steamId, name, chestGuid, reason) => { calls.marks.push({ steamId, name, chest: chestGuid, reason }); return { count: 1, mark: null }; } };
            if (id === "./family.js") return { sameFamily: (a, b) => state.family.some((pair) => pair.includes(a) && pair.includes(b) && a !== b) };
            if (id === "./store.js") {
                return {
                    ensureDir() {},
                    read: (file) => (file.endsWith("door-sides.json") && sides !== undefined ? { status: "ok", value: sides, fromBackup: false } : { status: "missing" }),
                    write: (file, value) => calls.stored.push({ file, value }),
                };
            }
            return assert.fail(`unexpected require ${id}`);
        },
        console: { log: (line) => calls.logs.push(line), error() {} },
        setInterval: () => 1,
        clearInterval() {},
        Date: { now: () => clock.now },
        Chat: { sendToPlayer: (player, text) => calls.chat.push({ to: player.steamId, text }) },
        Events: { on: (name, fn) => handlers.set(name, fn), onClient: (name, fn) => clientHandlers.set(name, fn) },
        Player: { getById: (id) => players.get(id) ?? null, all: () => [...players.values()] },
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/property-menu.js"), "utf8"), context);

    const locks = new context.exports.PropertyLocks(() => clock.now);
    let nextId = 1;
    const makePlayer = (steamId, position = { x: 101, y: 100, z: 10 }) => {
        const player = { id: nextId++, steamId, nickname: steamId, ready: true, alive: true, position, emit: (event, payload) => calls.emitted.push({ to: steamId, event, payload: JSON.parse(payload) }) };
        players.set(player.id, player);
        return player;
    };
    const give = (steamId, ...items) => inventories.set(steamId, [...(inventories.get(steamId) ?? []), ...items]);
    const told = (steamId) => calls.chat.filter((entry) => entry.to === steamId).map((entry) => entry.text);
    const can = (steamId) => calls.emitted.filter((entry) => entry.to === steamId && entry.event === "kcdc-gamemode:props.can").map((entry) => entry.payload);
    return { api: context.exports, locks, state, calls, handlers, clientHandlers, clock, makePlayer, give, told, can, players, house, chest, lockPicked };
}

// ---------------------------------------------------------------------------------------------
// F.

test("F is offered to the key holder, the owner, a room's holder and an administrator: Trancar at an open part, Destrancar at a locked one", () => {
    const sut = load({ admin: new Set(["mauro"]), locked: { [CHEST]: true } });
    const keyHolder = sut.makePlayer("ana");
    sut.give("ana", KEY);
    const owner = sut.makePlayer("hans");
    const roomer = sut.makePlayer("rui");
    sut.state.rooms[DOOR] = ["rui"];
    const admin = sut.makePlayer("mauro");
    const stranger = sut.makePlayer("zeca");

    for (const player of [keyHolder, owner, roomer, admin]) {
        assert.equal(sut.locks.stateFor(player, DOOR), "lock", player.steamId);
    }
    assert.equal(sut.locks.stateFor(stranger, DOOR), "", "nobody else");
    assert.equal(sut.locks.stateFor(keyHolder, CHEST), "unlock", "a house key opens the house's chests");
    assert.equal(sut.locks.stateFor(owner, CHEST), "unlock", "and the owner may");
    assert.equal(sut.locks.stateFor(roomer, CHEST), "", "a room's holder only for the room's parts");
});

test("a door's own key works that door alone; the house key works them all", () => {
    const sut = load({ twoDoors: true });
    const ana = sut.makePlayer("ana", { x: 103, y: 100, z: 10 });
    sut.give("ana", BACK_KEY);
    assert.equal(sut.locks.stateFor(ana, BACK), "lock");
    assert.equal(sut.locks.stateFor(ana, DOOR), "", "not the entrance");
    assert.equal(sut.locks.stateFor(ana, CHEST), "", "nor the chest");
});

test("F locks an open door and unlocks it again: a house of one door whole, told and logged, and the client told the new state", () => {
    const sut = load();
    const hans = sut.makePlayer("hans");
    sut.locks.look(hans, DOOR);
    assert.deepEqual(sut.can("hans").at(-1), { guid: DOOR, lock: "lock" });

    assert.equal(sut.locks.toggle(hans, DOOR), true);
    assert.deepEqual(sut.calls.lock.at(-1), { id: "suchdol-casa-03", locked: true });
    assert.match(sut.told("hans").at(-1), /Casa 03: trancada\./);
    assert.ok(sut.calls.logs.some((line) => /hans trancou Casa 03 com F/.test(line)));
    assert.deepEqual(sut.can("hans").at(-1), { guid: DOOR, lock: "unlock" }, "F now unlocks");

    sut.locks.toggle(hans, DOOR);
    assert.equal(sut.state.locks[DOOR], false);
    assert.match(sut.told("hans").at(-1), /Casa 03: destrancada\./);
});

test("one door of several is worked on its own, and a chest is told as a chest", () => {
    const sut = load({ twoDoors: true });
    const hans = sut.makePlayer("hans", { x: 103, y: 100, z: 10 });
    sut.locks.toggle(hans, BACK);
    assert.deepEqual(sut.calls.doorLock, [{ id: "suchdol-casa-03", index: 1, locked: true }]);
    assert.equal(sut.state.locks[DOOR], false, "the entrance stays as it was");
    assert.match(sut.told("hans").at(-1), /Casa 03 · Porta 2: trancada/);
    sut.locks.toggle(hans, CHEST);
    assert.deepEqual(sut.calls.lock.at(-1), { id: "suchdol-casa-03-bau-1", locked: true });
    assert.match(sut.told("hans").at(-1), /Casa 03 · Baú 1: trancado\./);
});

test("nobody without the right works anything with F, from afar nothing is offered, and a forged press changes nothing", () => {
    const sut = load();
    const zeca = sut.makePlayer("zeca");
    assert.equal(sut.locks.toggle(zeca, DOOR), false);
    assert.equal(sut.calls.lock.length, 0);
    assert.deepEqual(sut.can("zeca").at(-1), { guid: DOOR, lock: "" }, "the client is put right");
    const far = sut.makePlayer("hans", { x: 130, y: 100, z: 10 });
    assert.equal(sut.locks.stateFor(far, DOOR), "", "too far");
    assert.equal(sut.locks.toggle(far, DOOR), false);
    assert.equal(sut.locks.toggle(far, "ffff000000000000"), false, "no property");
});

test("the client is told what F does only when it changes: the same answer is not repeated, another part or a new state is", () => {
    const sut = load();
    const hans = sut.makePlayer("hans");
    sut.locks.look(hans, DOOR);
    sut.locks.look(hans, DOOR);
    assert.equal(sut.can("hans").length, 1);
    sut.locks.look(hans, CHEST);
    sut.locks.look(hans, "");
    assert.deepEqual(sut.can("hans"), [{ guid: DOOR, lock: "lock" }, { guid: CHEST, lock: "lock" }, { guid: "", lock: "" }]);
    sut.state.locks[CHEST] = true;
    sut.locks.look(hans, CHEST);
    assert.deepEqual(sut.can("hans").at(-1), { guid: CHEST, lock: "unlock" }, "locked meanwhile by somebody else");
});

// ---------------------------------------------------------------------------------------------
// E.

test("E at an open part does nothing here: the game opens it", () => {
    const sut = load();
    const zeca = sut.makePlayer("zeca");
    sut.locks.use(zeca, DOOR, true);
    sut.locks.use(zeca, CHEST, false);
    assert.equal(sut.calls.chat.length, 0);
    assert.equal(sut.calls.swing.length, 0);
});

test("from inside, as the level's areas say, a locked door is opened by E: its bolt drawn, the door swung, the owner told when it was no key holder", () => {
    const sut = load({ locked: { [DOOR]: true } });
    const hans = sut.makePlayer("hans");
    const zeca = sut.makePlayer("zeca");
    sut.state.inside.add("zeca");
    sut.locks.use(zeca, DOOR, false);
    assert.deepEqual(sut.calls.unlockPart, [DOOR]);
    assert.deepEqual(sut.calls.swing, [DOOR]);
    assert.match(sut.told("zeca").at(-1), /Você abriu Casa 03 por dentro\./);
    assert.match(sut.told("hans").at(-1), /Alguém abriu Casa 03 por dentro\./);
    assert.ok(sut.calls.logs.some((line) => /zeca abriu Casa 03 por dentro/.test(line)));

    // The owner from inside: no word to themselves.
    sut.state.locks[DOOR] = true;
    sut.state.inside.add("hans");
    const before = sut.told("hans").length;
    sut.locks.use(hans, DOOR, false);
    assert.equal(sut.told("hans").length, before + 1, "only their own line");
});

test("where no area says the side, what the game said there before says it, else the game's own Abrir on the screen (it is offered only from inside)", () => {
    const sut = load({ locked: { [DOOR]: true } });
    sut.state.noAreas = true;
    const zeca = sut.makePlayer("zeca", { x: 99, y: 100, z: 10 });
    sut.locks.use(zeca, DOOR, false);
    assert.equal(sut.calls.swing.length, 0, "no word on the side, no Abrir on the screen: outside");
    assert.match(sut.told("zeca").at(-1), /Casa 03 está trancada\./);
    sut.clock.now += 5_000;
    sut.locks.use(zeca, DOOR, true);
    assert.deepEqual(sut.calls.swing, [DOOR], "the game's own Abrir was up: inside");

    // Learned: a press from this side was on the keyhole's side, so this is outside, Abrir on the screen or not.
    const again = load({ locked: { [DOOR]: true } });
    again.state.noAreas = true;
    const ana = again.makePlayer("ana", { x: 101, y: 100, z: 10 });
    again.locks.door(ana, { guid: DOOR }, "close", true);
    again.locks.use(ana, DOOR, true);
    assert.equal(again.calls.swing.length, 0, "the keyhole's side is outside");
});

test("E from outside at a locked part is told it is locked, with F for whoever may; not again within three seconds", () => {
    const sut = load({ locked: { [DOOR]: true, [CHEST]: true } });
    const zeca = sut.makePlayer("zeca");
    const hans = sut.makePlayer("hans");
    sut.locks.use(zeca, DOOR, false);
    assert.equal(sut.told("zeca").at(-1), "Casa 03 está trancada.");
    sut.locks.use(zeca, DOOR, false);
    assert.equal(sut.told("zeca").length, 1, "not again so soon");
    sut.clock.now += 3_000;
    sut.locks.use(zeca, DOOR, false);
    assert.equal(sut.told("zeca").length, 2);
    sut.locks.use(hans, DOOR, false);
    assert.equal(sut.told("hans").at(-1), "Casa 03 está trancada: aperte F para destrancar.");
    sut.locks.use(hans, CHEST, false);
    assert.equal(sut.told("hans").at(-1), "Casa 03 · Baú 1 está trancado: aperte F para destrancar.");
    assert.equal(sut.calls.swing.length, 0);
});

test("a door the level locked (nobody locked it on purpose) is the game's: from inside it opens it itself, and nothing is said", () => {
    const sut = load({ locked: { [DOOR]: true }, lockSet: false });
    const zeca = sut.makePlayer("zeca");
    sut.state.inside.add("zeca");
    sut.locks.use(zeca, DOOR, true);
    assert.equal(sut.calls.swing.length, 0);
    assert.equal(sut.calls.unlockPart.length, 0);
    assert.equal(sut.told("zeca").length, 0);
});

test("an E from afar, at what is no property, or by somebody not in the world is not heard", () => {
    const sut = load({ locked: { [DOOR]: true } });
    const far = sut.makePlayer("zeca", { x: 120, y: 100, z: 10 });
    sut.state.inside.add("zeca");
    sut.locks.use(far, DOOR, true);
    sut.locks.use(sut.makePlayer("bia"), "ffff000000000000", true);
    const ghost = sut.makePlayer("ana");
    ghost.ready = false;
    sut.locks.use(ghost, DOOR, true);
    assert.equal(sut.calls.chat.length, 0);
    assert.equal(sut.calls.swing.length, 0);
});

// ---------------------------------------------------------------------------------------------
// Lockpicks, sides, thefts.

test("a lockpick begun at a door or chest warns the owner; the sweep finding it picked tells the picker and the owner", () => {
    const sut = load({ locked: { [DOOR]: true } });
    const hans = sut.makePlayer("hans");
    const zeca = sut.makePlayer("zeca");
    assert.equal(sut.locks.door(zeca, { guid: DOOR }, "lockpick", true), undefined, "never refused");
    assert.match(sut.told("hans").at(-1), /Alguém está tentando arrombar Casa 03\./);
    sut.locks.picked(DOOR);
    assert.match(sut.told("zeca").at(-1), /Você arrombou Casa 03\./);
    assert.match(sut.told("hans").at(-1), /Alguém arrombou Casa 03!/);
    assert.ok(sut.calls.logs.some((line) => /zeca arrombou Casa 03/.test(line)));

    sut.locks.chest(zeca, { levelGuid: CHEST }, "lockpick");
    assert.match(sut.told("hans").at(-1), /tentando arrombar Casa 03 · Baú 1/);
    sut.clock.now += 200_000;
    sut.locks.picked(CHEST);
    assert.equal(sut.told("zeca").filter((text) => /Baú 1/.test(text)).length, 0, "a picker of long ago is not named");
    assert.ok(sut.calls.logs.some((line) => /alguém arrombou Casa 03 · Baú 1/.test(line)));
    assert.equal(sut.locks.chest(zeca, { levelGuid: CHEST }, "open"), undefined, "an opening is never refused");
});

test("a door no area claims learns its sides from the game's own word at each press, and keeps them", () => {
    const sut = load();
    sut.state.noAreas = true;
    const ana = sut.makePlayer("ana", { x: 101, y: 100.5, z: 10 });
    const bia = sut.makePlayer("bia", { x: 99, y: 100.5, z: 10 });
    const at = (x, y) => ({ ...sut.players.get(ana.id), position: { x, y, z: 10 } });
    assert.equal(sut.locks.sideOf(ana, DOOR), null, "nobody has used it yet");

    sut.locks.door(ana, { guid: DOOR }, "close", true);
    assert.ok(sut.calls.logs.some((line) => /Casa 03 não tem área do jogo; o lado dela foi aprendido agora, com ana do lado da fechadura/.test(line)));
    assert.equal(sut.locks.sideOf(at(102, 100), DOOR), false, "the keyhole's side is outside");
    assert.equal(sut.locks.sideOf(at(98.5, 100), DOOR), true, "the other side is inside");
    assert.equal(sut.locks.sideOf(at(100.1, 100), DOOR), null, "at the door itself, neither");
    sut.locks.door(bia, { guid: DOOR }, "close", false);
    assert.equal(sut.locks.learnedSides(), 1);

    sut.locks.tick();
    const stored = sut.calls.stored.filter((entry) => entry.file === "playerdata/door-sides.json");
    assert.equal(stored.length, 1);
    const kept = JSON.parse(JSON.stringify(stored[0].value));
    const again = load({ sides: kept });
    again.state.noAreas = true;
    again.locks.loadSides();
    assert.equal(again.locks.sideOf(again.makePlayer("dan", { x: 98.5, y: 100, z: 10 }), DOOR), true, "what was learned before the restart still says the side");
});

test("what is taken from somebody else's chest is a theft; the owner, a key holder and a relative are free, and putting in is only written down", () => {
    const sut = load();
    const change = (before, after) => ({ items: [{ before: before === null ? null : { item: "bread", amount: before, name: "Pão" }, after: after === null ? null : { item: "bread", amount: after, name: "Pão" } }] });
    const stash = { levelGuid: CHEST };
    const zeca = sut.makePlayer("zeca");
    sut.locks.taken(stash, zeca, change(3, 1));
    assert.equal(sut.calls.marks.length, 1);
    assert.match(sut.calls.marks[0].reason, /tirou itens de Casa 03 · Baú 1 \(de Hans\)/);
    assert.ok(sut.calls.logs.some((line) => /baús: zeca em Casa 03 · Baú 1 \(de Hans\): tirou 2x Pão/.test(line)));

    sut.locks.taken(stash, zeca, change(1, 4));
    assert.equal(sut.calls.marks.length, 1, "putting in is no theft");
    sut.locks.taken(stash, sut.makePlayer("hans"), change(4, 0));
    const ana = sut.makePlayer("ana");
    sut.give("ana", KEY);
    sut.locks.taken(stash, ana, change(4, 0));
    sut.state.family.push(["hans", "rui"]);
    sut.locks.taken(stash, sut.makePlayer("rui"), change(4, 0));
    assert.equal(sut.calls.marks.length, 1, "the owner, a key holder and a relative take freely");
    sut.locks.taken(stash, null, change(4, 0));
    sut.locks.taken({ levelGuid: "ffff000000000000" }, zeca, change(4, 0));
    assert.equal(sut.calls.marks.length, 1);
});

test("everything is wired: the game's door and chest events, the client's E, look and F, the sweep's picks, and the stop", () => {
    const sut = load({ locked: { [DOOR]: true } });
    sut.api.installPropertyMenu();
    for (const name of ["doorInteract", "stashInteract", "stashInventoryChanged", "playerDisconnect", "playerDied", "resourceStop"]) {
        assert.ok(sut.handlers.has(name), name);
    }
    assert.equal(sut.lockPicked.length, 1);
    const hans = sut.makePlayer("hans");
    const global = sut.api.propertyMenus;
    sut.clientHandlers.get("kcdc-gamemode:props.look")(hans, JSON.stringify({ guid: DOOR }));
    assert.deepEqual(sut.can("hans").at(-1), { guid: DOOR, lock: "unlock" });
    sut.clientHandlers.get("kcdc-gamemode:props.toggle")(hans, JSON.stringify({ guid: DOOR }));
    assert.equal(sut.state.locks[DOOR], false);
    sut.clientHandlers.get("kcdc-gamemode:props.toggle")(hans, JSON.stringify({ guid: "not a guid" }));
    sut.clientHandlers.get("kcdc-gamemode:props.look")(hans, JSON.stringify({ guid: 7 }));
    sut.state.locks[DOOR] = true;
    sut.clientHandlers.get("kcdc-gamemode:props.use")(hans, JSON.stringify({ guid: DOOR, use: false }));
    assert.equal(sut.told("hans").at(-1), "Casa 03 está trancada: aperte F para destrancar.");
    assert.equal(typeof global.picked, "function");
    assert.ok(sut.calls.logs.some((line) => /property-menu: portas e baús das propriedades pelo jogo/.test(line)));
});

test("F locks a door that is SHUT: an open door is offered nothing, a locked one keeps Destrancar, and a chest is not a door (user, 2026-10-25)", () => {
    const sut = load({ locked: { [BACK]: true }, twoDoors: true });
    const owner = sut.makePlayer("hans", { x: 102, y: 100, z: 10 });

    assert.equal(sut.locks.stateFor(owner, DOOR), "lock", "shut and unlocked: Trancar");
    sut.state.open.add(DOOR);
    assert.equal(sut.locks.stateFor(owner, DOOR), "", "standing open: no F, it would only shut by itself");
    assert.equal(sut.locks.stateFor(owner, BACK), "unlock", "locked: Destrancar, as ever");
    sut.state.open.add(BACK);
    assert.equal(sut.locks.stateFor(owner, BACK), "unlock", "a locked door the world still reports open keeps its Destrancar");
    assert.equal(sut.locks.stateFor(owner, CHEST), "lock", "a chest has no open door");
    sut.state.open.add(CHEST);
    assert.equal(sut.locks.stateFor(owner, CHEST), "lock", "and what is not a door is never asked");

    // The client is told: the hint goes when the door is opened, and comes back when it is shut.
    sut.state.open.delete(DOOR);
    sut.locks.look(owner, DOOR);
    sut.state.open.add(DOOR);
    sut.locks.look(owner, DOOR);
    sut.state.open.delete(DOOR);
    sut.locks.look(owner, DOOR);
    assert.deepEqual(sut.can("hans").map((entry) => entry.lock), ["lock", "", "lock"]);

    // A press that comes after the door was opened locks nothing and shuts nothing.
    sut.state.open.add(DOOR);
    assert.equal(sut.locks.toggle(owner, DOOR), false);
    assert.deepEqual(sut.calls.lock, []);
    assert.deepEqual(sut.calls.doorLock, []);
    assert.equal(sut.state.locks[DOOR], false);
});
