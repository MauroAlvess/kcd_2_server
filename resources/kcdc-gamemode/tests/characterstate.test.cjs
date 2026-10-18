const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const STEAM = "76561198000000001";
const OTHER = "76561198000000002";

function fakeDisk() {
    const files = new Map();
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

/** What a character file looks like on disk. */
function record(over = {}) {
    return {
        v: 1,
        steamId: STEAM,
        nickname: "Mauro",
        savedAt: 1,
        inventory: {
            items: [
                { id: "r1", item: "guid-money", name: "money", amount: 100, metadata: {}, equipped: 0 },
                { id: "r2", item: "guid-shirt", name: "TunicShort01_m01_D", amount: 1, metadata: { quality: 2 }, equipped: 1 },
            ],
            quickslots: { weapons: [], items: [], activeWeapon: 0, activeItem: 0 },
        },
        held: [],
        progression: { tracks: { alchemy: { level: 3, xp: 10 } }, perks: ["p1"], perkPoints: { main: 1 } },
        knowledge: { 14: 536870911 },
        vitals: { health: 40, hunger: 55, exhaust: 70, stamina: 30 },
        kits: ["starter:money"],
        ...over,
    };
}

/**
 * The game as character-state.ts sees it. `inventories` maps player id -> the rows Inventory.get reports; `setRefuses`
 * decides, per attempt, whether Inventory.set says no (to model a custom type the server no longer registers).
 */
function load({ files = {} } = {}) {
    const disk = fakeDisk();
    for (const [name, value] of Object.entries(files)) disk.files.set(`playerdata/characters/${name}.json`, typeof value === "string" ? value : JSON.stringify(value));

    const storeSandbox = { exports: {}, require: (id) => { assert.equal(id, "node:fs"); return disk.fs; } };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/store.js"), "utf8"), storeSandbox);

    const handlers = new Map();
    const intervals = [];
    const timeouts = [];
    const online = new Map();
    const chat = [];
    const logs = [];
    const calls = { set: [], add: [], restoreProgression: [], setKnowledge: [], vitals: [] };
    const clock = { now: 1_000_000 };
    const state = { setRefuses: () => false, addOk: true, inventoryReady: true };
    const inventories = new Map();

    const perkGuardSandbox = { exports: {}, Progression: { blockPerks() {} }, console: { log() {} } };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/perk-guard.js"), "utf8"), perkGuardSandbox);
    const context = {
        exports: {},
        require: (id) => {
            if (id === "./perk-guard.js") return perkGuardSandbox.exports;
            assert.equal(id, "./store.js");
            return storeSandbox.exports;
        },
        console: { log: (line) => logs.push(line), error: (line) => logs.push(line) },
        Date: { now: () => clock.now },
        setInterval: (fn, ms) => { intervals.push({ fn, ms }); return intervals.length; },
        clearInterval: () => {},
        setTimeout: (fn, ms) => { timeouts.push({ fn, ms }); return timeouts.length; },
        Events: { on: (name, fn) => handlers.set(name, [...(handlers.get(name) ?? []), fn]) },
        Player: { getById: (id) => online.get(id) ?? null },
        Chat: { sendToPlayer: (player, text) => chat.push(text) },
        Inventory: {
            set: (player, request) => {
                calls.set.push(JSON.parse(JSON.stringify(request)));
                const refused = state.setRefuses(request);
                if (refused === "unavailable") return { ok: false, code: "inventoryUnavailable" };
                if (refused) return { ok: false, code: "unknownItem" };
                inventories.set(player.id, request.items.map((row) => ({ ...row, name: row.name ?? "" })));
                return { ok: true, code: "" };
            },
            get: (player) => ({ ready: state.inventoryReady, revision: 1, items: inventories.get(player.id) ?? [], harvested: undefined, quickslots: { weapons: [], items: [], activeWeapon: 0, activeItem: 0 } }),
            add: (player, request) => {
                calls.add.push(JSON.parse(JSON.stringify(request)));
                return { ok: state.addOk, code: state.addOk ? "" : "unknownItem" };
            },
        },
        Crafting: {
            knowledge: (player) => player.knowledge ?? {},
            setKnowledge: (player, recipe, mask) => { calls.setKnowledge.push([recipe, mask]); return true; },
        },
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/character-state.js"), "utf8"), context);
    context.exports.installCharacterState();

    const fire = (name, ...args) => (handlers.get(name) ?? []).forEach((fn) => fn(...args));
    return {
        api: context.exports,
        disk,
        chat,
        logs,
        calls,
        state,
        clock,
        inventories,
        fire,
        tick: () => intervals[0].fn(),
        flushTimeouts: () => { while (timeouts.length) timeouts.shift().fn(); },
        stored: (steamId = STEAM) => JSON.parse(disk.files.get(`playerdata/characters/${steamId}.json`)),
        has: (steamId = STEAM) => disk.files.has(`playerdata/characters/${steamId}.json`),
        join(over = {}) {
            const player = {
                id: over.id ?? 1,
                steamId: over.steamId ?? STEAM,
                nickname: over.nickname ?? "Mauro",
                ready: true,
                alive: true,
                progression: { tracks: {}, perks: [], perkPoints: {} },
                knowledge: {},
                stats: { health: 100, hunger: 100, exhaust: 100, stamina: 100 },
                restoreProgression(snapshot) { calls.restoreProgression.push(JSON.parse(JSON.stringify(snapshot))); return true; },
                setHealth(value) { calls.vitals.push(["health", value]); return true; },
                setHunger(value) { calls.vitals.push(["hunger", value]); return true; },
                setStat(stat, value) { calls.vitals.push([stat, value]); return true; },
                getStat(stat) { return this.stats[stat]; },
                ...over,
            };
            online.set(player.id, player);
            fire("playerConnect", player);
            return player;
        },
        leave(player) {
            fire("playerDisconnect", player);
            online.delete(player.id);
        },
    };
}

function bring(sut, player) {
    sut.fire("playerReady", player);
    sut.fire("playerInventoryReady", player);
}

// ---------------------------------------------------------------------------------------------

test("a returning character gets its inventory back at connect, then its levels, vitals and recipes as the game allows", () => {
    const sut = load({ files: { [STEAM]: record() } });
    const player = sut.join();

    assert.equal(sut.calls.set.length, 1);
    assert.deepEqual(sut.calls.set[0].items.map((row) => [row.id, row.item, row.amount, row.equipped]), [["r1", "guid-money", 100, 0], ["r2", "guid-shirt", 1, 1]]);
    assert.deepEqual(sut.calls.set[0].items[1].metadata, { quality: 2 }, "quality survives");
    assert.ok(sut.calls.set[0].quickslots, "and so do the quick slots");
    assert.equal(sut.calls.restoreProgression.length, 0, "levels wait for the game to be playable");

    sut.fire("playerReady", player);
    assert.equal(sut.calls.restoreProgression.length, 1);
    assert.deepEqual(sut.calls.restoreProgression[0].perks, ["p1"]);
    assert.deepEqual(sut.calls.vitals, [["health", 40], ["exhaust", 70], ["stamina", 30], ["hunger", 55]], "health and energy before stamina");

    assert.equal(sut.calls.setKnowledge.length, 0);
    sut.fire("playerInventoryReady", player);
    assert.deepEqual(sut.calls.setKnowledge, [["14", 536870911]]);
});

test("a brand new character is not given anything back, and is filed once there is something to file", () => {
    const sut = load();
    const player = sut.join();
    assert.equal(sut.calls.set.length, 0);
    bring(sut, player);
    sut.inventories.set(player.id, [{ id: "n1", item: "guid-bread", name: "bread", amount: 2, metadata: {}, equipped: 0 }]);

    sut.tick();
    assert.equal(sut.has(), true);
    const saved = sut.stored();
    assert.equal(saved.nickname, "Mauro");
    assert.equal(saved.inventory.items[0].item, "guid-bread");
    assert.equal(saved.inventory.items[0].name, "bread", "the name is kept so a custom row can be told apart later");
    assert.deepEqual(saved.vitals, { health: 100, hunger: 100, exhaust: 100, stamina: 100 });
});

test("nothing is written over what is saved until each part has been restored", () => {
    const sut = load({ files: { [STEAM]: record() } });
    const player = sut.join();
    // The player's game is still loading: no ready event yet, and live levels and recipes are blank.
    sut.tick();
    sut.leave(player);

    const saved = sut.stored();
    assert.deepEqual(saved.progression.perks, ["p1"], "levels are still the saved ones");
    assert.deepEqual(saved.knowledge, { 14: 536870911 }, "recipes are still the saved ones");
    assert.deepEqual(saved.vitals, { health: 40, hunger: 55, exhaust: 70, stamina: 30 });
    assert.equal(saved.inventory.items.length, 2);
});

test("a player who plays, learns and leaves is saved with all of it", () => {
    const sut = load({ files: { [STEAM]: record() } });
    const player = sut.join();
    bring(sut, player);
    player.progression = { tracks: { alchemy: { level: 5, xp: 1 } }, perks: ["p1", "p2"], perkPoints: { main: 0 } };
    player.knowledge = { 14: 536870911, 3: 536870911 };
    sut.inventories.set(player.id, [{ id: "r9", item: "guid-herb", name: "herb_mint", amount: 5, metadata: {}, equipped: 0 }]);
    sut.clock.now += 20_000;

    sut.leave(player);
    const saved = sut.stored();
    assert.equal(saved.progression.tracks.alchemy.level, 5);
    assert.deepEqual(saved.progression.perks, ["p1", "p2"]);
    assert.deepEqual(saved.knowledge, { 14: 536870911, 3: 536870911 });
    assert.deepEqual(saved.inventory.items.map((row) => row.item), ["guid-herb"]);
    assert.deepEqual(saved.kits, ["starter:money"], "the ledger comes along");
});

test("the health a player has right after the saved one was asked for is not written over it", () => {
    const sut = load({ files: { [STEAM]: record() } });
    const player = sut.join();
    sut.fire("playerReady", player);
    sut.fire("playerInventoryReady", player);
    // The body still reports a fresh Henry's numbers.
    player.stats = { health: 100, hunger: 100, exhaust: 100, stamina: 100 };

    sut.clock.now += 3_000;
    sut.leave(player);
    assert.equal(sut.stored().vitals.health, 40, "the saved vitals stand while the body catches up");
});

test("once the body has caught up its real vitals are saved", () => {
    const sut = load({ files: { [STEAM]: record() } });
    const player = sut.join();
    bring(sut, player);
    player.stats = { health: 33, hunger: 20, exhaust: 60, stamina: 10 };

    sut.clock.now += 60_000;
    sut.tick();
    assert.deepEqual(sut.stored().vitals, { health: 33, hunger: 20, exhaust: 60, stamina: 10 });
});

test("a dead or loading body never has its vitals saved", () => {
    const sut = load({ files: { [STEAM]: record() } });
    const player = sut.join();
    bring(sut, player);
    player.alive = false;
    player.stats = { health: 0, hunger: 0, exhaust: 0, stamina: 0 };
    sut.clock.now += 60_000;
    sut.tick();
    assert.equal(sut.stored().vitals.health, 40);
});

test("an empty inventory never replaces a full one", () => {
    const sut = load({ files: { [STEAM]: record() } });
    const player = sut.join();
    bring(sut, player);
    sut.inventories.set(player.id, []);

    sut.leave(player);
    assert.equal(sut.stored().inventory.items.length, 2);
    assert.ok(sut.logs.some((line) => /vazio/.test(line)));
});

test("a character file that cannot be read locks the session: nothing is written and the player is told", () => {
    const sut = load({ files: { [STEAM]: "{ this is not json" } });
    const player = sut.join();
    assert.equal(sut.api.canKeep(player), false);
    sut.fire("playerReady", player);
    assert.match(sut.chat.at(-1), /não pôde ser lido/);

    sut.inventories.set(player.id, [{ id: "x", item: "guid-x", name: "x", amount: 1, metadata: {}, equipped: 0 }]);
    sut.tick();
    sut.leave(player);
    assert.equal(sut.disk.files.get(`playerdata/characters/${STEAM}.json`), "{ this is not json", "the damaged file is left exactly as it was");
});

test("a damaged main file falls back to the backup copy and says so", () => {
    const sut = load({ files: { [STEAM]: "garbage", [`${STEAM}.json.bak`]: record() } });
    sut.disk.files.set(`playerdata/characters/${STEAM}.json.bak`, JSON.stringify(record()));
    const player = sut.join();
    assert.equal(sut.calls.set.length, 1, "the backup's inventory came back");
    assert.equal(sut.api.canKeep(player), true);
    assert.ok(sut.logs.some((line) => /cópia anterior/.test(line)));
});

test("when the game refuses the saved inventory outright, the session is locked and the file untouched", () => {
    const sut = load({ files: { [STEAM]: record() } });
    sut.state.setRefuses = () => true;
    const player = sut.join();

    assert.equal(sut.api.canKeep(player), false);
    sut.fire("playerReady", player);
    assert.match(sut.chat.at(-1), /não pôde ser devolvido/);
    assert.equal(sut.calls.restoreProgression.length, 0, "levels are not restored into a half-restored character");
    sut.leave(player);
    assert.equal(sut.stored().savedAt, 1, "not rewritten");
});

test("if the game has no inventory yet at connect the restore waits, nothing is written, and it is done as the join goes on", () => {
    const sut = load({ files: { [STEAM]: record() } });
    let available = false;
    const realSet = sut.state.setRefuses;
    sut.state.setRefuses = (request) => (available ? realSet(request) : "unavailable");
    const player = sut.join();

    assert.equal(sut.api.canKeep(player), false, "not kept until it is restored: no kit can be given");
    assert.ok(sut.logs.some((line) => /ainda não tem o inventário/.test(line)));
    sut.tick();
    sut.leave(player);
    assert.equal(sut.stored().savedAt, 1, "nothing was written over the saved character");

    // A second join, where the game catches up at the spawn.
    const again = sut.join({ id: 2 });
    assert.equal(sut.api.canKeep(again), false);
    available = true;
    sut.fire("playerSpawned", again);
    assert.equal(sut.api.canKeep(again), true);
    assert.ok(sut.logs.some((line) => /inventário devolvido \(2 item\(ns\)\)/.test(line)));
    sut.fire("playerSpawned", again);
    assert.equal(sut.calls.set.filter((call) => call.items.length === 2).length >= 1, true);
});

test("a restore that is refused for any other reason after waiting locks the session", () => {
    const sut = load({ files: { [STEAM]: record() } });
    let phase = "unavailable";
    sut.state.setRefuses = () => (phase === "unavailable" ? "unavailable" : true);
    const player = sut.join();
    assert.equal(sut.api.canKeep(player), false);

    phase = "refused";
    sut.fire("playerReady", player);
    assert.equal(sut.api.canKeep(player), false);
    assert.match(sut.chat.at(-1), /não pôde ser devolvido/);
    sut.leave(player);
    assert.equal(sut.stored().savedAt, 1);
});

test("a custom item the server no longer knows is set aside instead of costing the whole inventory", () => {
    const withBook = record();
    withBook.inventory.items.push({ id: "r3", item: "guid-old-key", name: "kcdc-property:gone", amount: 1, metadata: {}, equipped: 0 });
    const sut = load({ files: { [STEAM]: withBook } });
    sut.state.setRefuses = (request) => request.items.some((row) => row.item === "guid-old-key");
    sut.state.addOk = false; // a type the server no longer registers fails to add as well as to set
    const player = sut.join();

    assert.equal(sut.api.canKeep(player), true);
    assert.equal(sut.calls.set.length, 3, "full, without quick slots, without the unknown custom rows");
    assert.deepEqual(sut.calls.set[2].items.map((row) => row.id), ["r1", "r2"]);
    assert.ok(sut.logs.some((line) => /sem os itens personalizados/.test(line)));

    bring(sut, player);
    sut.clock.now += 60_000;
    sut.leave(player);
    const saved = sut.stored();
    assert.deepEqual(saved.held.map((row) => row.item), ["guid-old-key"], "kept for later");
    assert.equal(saved.inventory.items.length, 2);
});

test("rows set aside are offered again at the next join and dropped from the list once they fit", () => {
    const held = record({ held: [{ id: "r3", item: "guid-old-key", name: "kcdc-property:gone", amount: 1, metadata: {}, equipped: 0 }] });
    const sut = load({ files: { [STEAM]: held } });
    const player = sut.join();
    assert.deepEqual(sut.calls.add.map((call) => call.item), ["guid-old-key"]);

    sut.leave(player);
    assert.deepEqual(sut.stored().held, []);

    const again = load({ files: { [STEAM]: held } });
    again.state.addOk = false;
    const p2 = again.join();
    again.leave(p2);
    assert.equal(again.stored().held.length, 1, "still unknown, so still kept");
});

test("a player with no Steam id is not kept and cannot be given a kit", () => {
    const sut = load();
    const player = sut.join({ steamId: "" });
    assert.equal(sut.api.canKeep(player), false);
    sut.api.markKit(player, "starter:money");
    assert.equal(sut.api.hasKit(player, "starter:money"), false);

    sut.fire("playerReady", player);
    assert.match(sut.chat.at(-1), /não terá o seu personagem salvo|não será salvo/);
    sut.tick();
    sut.leave(player);
    assert.equal(sut.disk.files.size, 0);
});

test("a hostile Steam id cannot reach a file name", () => {
    const sut = load();
    const player = sut.join({ steamId: "../../etc/passwd" });
    assert.equal(sut.api.canKeep(player), false);
    sut.leave(player);
    assert.equal(sut.disk.files.size, 0);
});

test("the kit ledger is saved soon after a kit is marked, and remembered across a rejoin", () => {
    const sut = load({ files: { [STEAM]: record() } });
    const player = sut.join();
    bring(sut, player);
    assert.equal(sut.api.hasKit(player, "guild:venatores:0"), false);

    sut.api.markKit(player, "guild:venatores:0");
    assert.equal(sut.api.hasKit(player, "guild:venatores:0"), true);
    assert.equal(sut.stored().kits.includes("guild:venatores:0"), false, "the write is a moment away");
    sut.flushTimeouts();
    assert.deepEqual(sut.stored().kits, ["starter:money", "guild:venatores:0"]);

    sut.leave(player);
    const back = sut.join();
    assert.equal(sut.api.hasKit(back, "guild:venatores:0"), true);
    assert.deepEqual(Array.from(sut.api.kitsOf(back)), ["starter:money", "guild:venatores:0"]);
});

test("marking the same kit twice writes it once", () => {
    const sut = load({ files: { [STEAM]: record() } });
    const player = sut.join();
    bring(sut, player);
    sut.api.markKit(player, "x");
    sut.api.markKit(player, "x");
    sut.flushTimeouts();
    assert.equal(sut.stored().kits.filter((kit) => kit === "x").length, 1);
});

test("an older connection still being torn down does not write over the newer one", () => {
    const sut = load({ files: { [STEAM]: record() } });
    const first = sut.join({ id: 1 });
    bring(sut, first);
    sut.clock.now += 5_000;
    const second = sut.join({ id: 2 });
    bring(sut, second);
    sut.inventories.set(second.id, [{ id: "n", item: "guid-new", name: "new", amount: 1, metadata: {}, equipped: 0 }]);
    sut.clock.now += 60_000;
    sut.tick();
    assert.deepEqual(sut.stored().inventory.items.map((row) => row.item), ["guid-new"]);

    sut.inventories.set(first.id, [{ id: "stale", item: "guid-stale", name: "stale", amount: 1, metadata: {}, equipped: 0 }]);
    sut.leave(first);
    assert.deepEqual(sut.stored().inventory.items.map((row) => row.item), ["guid-new"], "the old session's leftovers are dropped");
});

test("two different players are kept in two files", () => {
    const sut = load();
    const a = sut.join({ id: 1, steamId: STEAM });
    const b = sut.join({ id: 2, steamId: OTHER, nickname: "Hans" });
    bring(sut, a);
    bring(sut, b);
    sut.inventories.set(a.id, [{ id: "a", item: "guid-a", name: "a", amount: 1, metadata: {}, equipped: 0 }]);
    sut.inventories.set(b.id, [{ id: "b", item: "guid-b", name: "b", amount: 1, metadata: {}, equipped: 0 }]);
    sut.tick();
    assert.equal(sut.stored(STEAM).inventory.items[0].item, "guid-a");
    assert.equal(sut.stored(OTHER).inventory.items[0].item, "guid-b");
    assert.equal(sut.stored(OTHER).nickname, "Hans");
});

test("stopping the resource saves everybody who is online", () => {
    const sut = load();
    const a = sut.join({ id: 1 });
    bring(sut, a);
    sut.inventories.set(a.id, [{ id: "a", item: "guid-a", name: "a", amount: 1, metadata: {}, equipped: 0 }]);
    sut.fire("resourceStop", "some-other-resource");
    assert.equal(sut.has(), false, "another resource stopping is none of our business");

    sut.fire("resourceStop", "kcdc-gamemode");
    assert.equal(sut.stored().inventory.items[0].item, "guid-a");
    assert.ok(sut.logs.some((line) => /1 personagem/.test(line)));
});

test("a record with junk in it is cleaned rather than trusted", () => {
    const junk = { v: 1, inventory: { items: [{ id: 5 }, null, { id: "ok", item: "g", amount: 2, metadata: {}, equipped: 0 }, { id: "neg", item: "g", amount: -1, metadata: {}, equipped: 0 }], quickslots: null }, knowledge: { 1: 3, 2: -4, 3: 99999999999, x: "no" }, vitals: { health: "full" }, kits: ["a", 7, "b"], progression: "lots" };
    const sut = load({ files: { [STEAM]: junk } });
    const player = sut.join();
    assert.deepEqual(sut.calls.set[0].items.map((row) => row.id), ["ok"]);
    bring(sut, player);
    assert.deepEqual(sut.calls.setKnowledge, [["1", 3]]);
    assert.equal(sut.calls.restoreProgression.length, 0, "a progression that is not an object is not passed on");
    assert.deepEqual(sut.calls.vitals, []);
    assert.deepEqual(Array.from(sut.api.kitsOf(player)), ["a", "b"]);
});

test("a saved character that holds a perk the alchemy tables cannot work with gets it taken out, its point back, and is told", () => {
    const base = record();
    const sut = load({ files: { [STEAM]: { ...base, progression: { tracks: {}, perks: ["Ascetic", "Secrets of matter I", "Secrets of matter II"], perkPoints: { alchemy: 1, main: 2 } } } } });
    const player = sut.join();
    bring(sut, player);
    assert.deepEqual(sut.calls.restoreProgression[0].perks, ["Ascetic"]);
    assert.deepEqual(sut.calls.restoreProgression[0].perkPoints, { alchemy: 3, main: 2 }, "a point each, in the alchemy tree");
    assert.ok(sut.chat.some((line) => /Secrets of matter I e Secrets of matter II.*mesas de alquimia/.test(line)), sut.chat.join("|"));
});

test("a character without those perks is restored exactly as it was saved", () => {
    const sut = load({ files: { [STEAM]: record() } });
    const player = sut.join();
    bring(sut, player);
    assert.deepEqual(sut.calls.restoreProgression[0].perks, ["p1"]);
    assert.ok(!sut.chat.some((line) => /alquimia/.test(line)));
});

