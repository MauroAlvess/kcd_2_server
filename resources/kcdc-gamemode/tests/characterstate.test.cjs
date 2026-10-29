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
    const calls = { set: [], add: [], restoreProgression: [], setKnowledge: [], vitals: [], combos: [] };
    const COMBOS = ["C01 (longsword)", "C02 (longsword)"];
    const clock = { now: 1_000_000 };
    const state = { setRefuses: () => false, addOk: true, inventoryReady: true };
    const inventories = new Map();

    const perkGuardSandbox = { exports: {}, Progression: { blockPerks() {} }, console: { log() {} } };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/perk-guard.js"), "utf8"), perkGuardSandbox);
    // The guard is off by default since 2026-10-19; these tests are of it switched on.
    perkGuardSandbox.exports.perkGuard.enabled = true;
    const context = {
        exports: {},
        require: (id) => {
            if (id === "./perk-guard.js") return perkGuardSandbox.exports;
            // The combos are the Esgrima's (esgrima.ts): taken out of what is restored, written down there. This stub takes out the ones of this test's list.
            if (id === "./esgrima.js") return { takeOutCombos: (steamId, snapshot) => { calls.combos.push([steamId, snapshot.perks.filter((perk) => COMBOS.includes(perk))]); return { ...snapshot, perks: snapshot.perks.filter((perk) => !COMBOS.includes(perk)) }; }, leaveOutCombos: (snapshot) => ({ ...snapshot, perks: snapshot.perks.filter((perk) => !COMBOS.includes(perk)) }) };
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
        timeouts,
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

// ---------------------------------------------------------------------------------------------
// Levels only climb (2026-10-23: a player's whole progression read as a fresh character's).

const CLIMBER = () =>
    record({
        progression: {
            tracks: { alchemy: { level: 20, xp: 0 }, weapon_sword: { level: 10, xp: 5 }, fencing: { level: 9, xp: 0 }, survival: { level: 5, xp: 0 } },
            perks: ["p1", "p2"],
            perkPoints: { alchemy: 2, main: 1 },
        },
    });
const FRESH = () => ({ tracks: { alchemy: { level: 5, xp: 0 }, weapon_sword: { level: 5, xp: 0 }, fencing: { level: 5, xp: 0 }, survival: { level: 5, xp: 0 } }, perks: [], perkPoints: {} });

test("keepClimbs puts back each track that reads lower than it was saved, and nothing else; the fencing, which the game computes, is not compared", () => {
    const sut = load();
    const saved = CLIMBER().progression;
    const live = { tracks: { alchemy: { level: 5, xp: 0 }, weapon_sword: { level: 10, xp: 5.5 }, fencing: { level: 5, xp: 0 }, survival: { level: 6, xp: 1 }, speech: { level: 7, xp: 0 } }, perks: ["x"], perkPoints: { main: 9 } };
    const kept = sut.api.keepClimbs(live, saved);
    assert.deepEqual(JSON.parse(JSON.stringify(kept.kept)), ["alchemy"], "only the alchemy fell behind; sword is higher in XP, fencing is derived, survival climbed");
    assert.deepEqual(JSON.parse(JSON.stringify(kept.snapshot.tracks)), { alchemy: { level: 20, xp: 0 }, weapon_sword: { level: 10, xp: 5.5 }, fencing: { level: 5, xp: 0 }, survival: { level: 6, xp: 1 }, speech: { level: 7, xp: 0 } });
    assert.deepEqual(JSON.parse(JSON.stringify(kept.snapshot.perks)), ["x"], "the live perks and points are the live ones");
    assert.equal(sut.api.keepClimbs(live, null).snapshot, live, "nothing saved, nothing to keep");
    const same = sut.api.keepClimbs(saved, saved);
    assert.deepEqual(JSON.parse(JSON.stringify(same.kept)), []);
    assert.equal(same.snapshot, saved);
    const missing = sut.api.keepClimbs({ tracks: {}, perks: [], perkPoints: {} }, saved);
    assert.deepEqual(JSON.parse(JSON.stringify(missing.kept)), ["alchemy", "weapon_sword", "survival"], "a track the live one has not even got is a track lost");
    const rounding = sut.api.keepClimbs({ ...saved, tracks: { ...saved.tracks, alchemy: { level: 20, xp: -0.5 } } }, saved);
    assert.deepEqual(JSON.parse(JSON.stringify(rounding.kept)), [], "a fraction of XP is rounding, not a loss");
});

test("a restore that did not hold: the file keeps the levels, and the game is asked again, whole, after five and twenty seconds, and the log says so", () => {
    const sut = load({ files: { [STEAM]: CLIMBER() } });
    const player = sut.join();
    player.progression = FRESH();
    bring(sut, player);
    assert.equal(sut.calls.restoreProgression.length, 1);
    sut.tick();
    sut.leave(player);
    const saved = sut.stored();
    assert.equal(saved.progression.tracks.alchemy.level, 20, "not written over by a fresh character's");
    assert.equal(saved.progression.tracks.weapon_sword.level, 10);
    assert.equal(saved.progression.tracks.fencing.level, 5, "the derived one is the live one's");

    const again = load({ files: { [STEAM]: CLIMBER() } });
    const second = again.join();
    second.progression = FRESH();
    bring(again, second);
    assert.deepEqual(again.calls.restoreProgression.length, 1);
    again.flushTimeouts();
    assert.equal(again.calls.restoreProgression.length, 3, "once at the start and once at each of the two looks");
    const repair = again.calls.restoreProgression[1];
    assert.deepEqual(repair.perks, ["p1", "p2"], "the perks of the file come back with the levels");
    assert.deepEqual(repair.perkPoints, { alchemy: 2, main: 1 });
    assert.equal(repair.tracks.alchemy.level, 20);
    assert.equal(repair.tracks.weapon_sword.level, 10);
    assert.ok(again.logs.some((line) => /Mauro: 2 trilha\(s\) abaixo do salvo \(alchemy 5 < 20, weapon_sword 5 < 10\); restaurei de novo \(5 s depois, vez 1\)/.test(line)), again.logs.join(" | "));
    assert.ok(again.logs.some((line) => /vez 2/.test(line) && /20 s depois/.test(line)));
});

test("a restore that holds the second time is not asked a third; a character that did not lag is never asked again", () => {
    const sut = load({ files: { [STEAM]: CLIMBER() } });
    let asks = 0;
    const player = sut.join({
        restoreProgression(snapshot) {
            sut.calls.restoreProgression.push(JSON.parse(JSON.stringify(snapshot)));
            asks += 1;
            if (asks >= 2) this.progression = JSON.parse(JSON.stringify(snapshot));
            return true;
        },
    });
    player.progression = FRESH();
    bring(sut, player);
    sut.flushTimeouts();
    assert.equal(sut.calls.restoreProgression.length, 2, "asked at the start, again at five seconds, and at twenty it held");
    assert.equal(player.progression.tracks.alchemy.level, 20);

    const fine = load({ files: { [STEAM]: CLIMBER() } });
    const kept = fine.join();
    kept.progression = JSON.parse(JSON.stringify(CLIMBER().progression));
    bring(fine, kept);
    fine.flushTimeouts();
    fine.tick();
    assert.equal(fine.calls.restoreProgression.length, 1, "it came back as saved: nothing to repeat");
});

test("at most three times in a session, and a track that lags later is put back alone, leaving the live perks as they are", () => {
    const sut = load({ files: { [STEAM]: CLIMBER() } });
    const player = sut.join();
    player.progression = FRESH();
    bring(sut, player);
    sut.flushTimeouts();
    assert.equal(sut.calls.restoreProgression.length, 3);
    // Later in the session the periodic look puts back the tracks alone: the live perks are what they are now.
    sut.clock.now += 60_000;
    player.progression = { tracks: { alchemy: { level: 20, xp: 0 }, weapon_sword: { level: 5, xp: 0 }, fencing: { level: 9, xp: 0 }, survival: { level: 5, xp: 0 } }, perks: ["p1", "p2", "bought"], perkPoints: { main: 0 } };
    sut.tick();
    assert.equal(sut.calls.restoreProgression.length, 4);
    const last = sut.calls.restoreProgression.at(-1);
    assert.equal(last.tracks.weapon_sword.level, 10);
    assert.equal(last.perks, undefined, "the perks are not sent back: a restore replaces the set and, since KCDC 1.7.2, leaves a blocked perk (a combo) out");
    assert.equal(last.perkPoints, undefined);
    sut.clock.now += 60_000;
    player.progression = FRESH();
    sut.tick();
    assert.equal(sut.calls.restoreProgression.length, 4, "three is the limit");
    assert.equal(sut.stored().progression.tracks.weapon_sword.level, 10, "and the file still has it");
});

test("a character who starts again is not given its levels back by the guard", () => {
    const sut = load({ files: { [STEAM]: CLIMBER() } });
    const player = sut.join();
    bring(sut, player);
    sut.api.discardCharacter(STEAM);
    player.progression = FRESH();
    sut.flushTimeouts();
    sut.tick();
    sut.leave(player);
    assert.equal(sut.stored().progression, null, "the record is the empty one the reset wrote");
});

test("an administrator raises a track in the file of a character who is not in: the track alone, with no XP into the next, and only upward; the rest of the file is as it was", () => {
    const sut = load({ files: { [STEAM]: CLIMBER() } });
    const before = sut.stored();
    assert.equal(sut.api.raiseSavedTrack(STEAM, "survival", 12), "feito");
    const after = sut.stored();
    assert.deepEqual(after.progression.tracks.survival, { level: 12, xp: 0 });
    assert.deepEqual(after.progression.tracks.alchemy, before.progression.tracks.alchemy, "the other tracks are as they were");
    assert.deepEqual(after.progression.perks, before.progression.perks);
    assert.deepEqual(after.inventory, before.inventory);
    assert.deepEqual(after.kits, before.kits);
    assert.equal(sut.api.raiseSavedTrack(STEAM, "survival", 12), "já está", "the same level");
    assert.equal(sut.api.raiseSavedTrack(STEAM, "alchemy", 7), "já está", "a lower one");
    assert.equal(sut.api.raiseSavedTrack(STEAM, "dancing", 7), "sem trilha");
    assert.equal(sut.api.raiseSavedTrack("12345678901234567", "survival", 7), "sem personagem", "no such file");
    assert.equal(sut.api.raiseSavedTrack("../../etc", "survival", 7), "sem personagem", "a hostile id");

    const levels = sut.api.savedProgression(STEAM);
    assert.equal(levels.tracks.survival.level, 12);
    assert.equal(sut.api.savedProgression("12345678901234567"), null);
    assert.equal(sut.api.savedProgression("../../etc"), null);
});

test("a level raised in the file is what the character gets back at the next entry, and the guard keeps it", () => {
    const sut = load({ files: { [STEAM]: CLIMBER() } });
    assert.equal(sut.api.raiseSavedTrack(STEAM, "survival", 12), "feito");
    const player = sut.join();
    player.progression = FRESH();
    bring(sut, player);
    assert.equal(sut.calls.restoreProgression[0].tracks.survival.level, 12);
    sut.tick();
    sut.leave(player);
    assert.equal(sut.stored().progression.tracks.survival.level, 12);
});

test("the combos of a saved character are left out of what the game is asked to restore, and handed to the Esgrima (2026-10-26)", () => {
    const base = record();
    const sut = load({ files: { [STEAM]: { ...base, progression: { tracks: {}, perks: ["Ascetic", "C01 (longsword)", "C02 (longsword)"], perkPoints: { main: 2 } } } } });
    const player = sut.join();
    bring(sut, player);
    assert.deepEqual(sut.calls.restoreProgression[0].perks, ["Ascetic"], "the game restores the other perks");
    assert.deepEqual(JSON.parse(JSON.stringify(sut.calls.combos)), [[STEAM, ["C01 (longsword)", "C02 (longsword)"]]], "the Esgrima is told which combos it held");
    assert.deepEqual(sut.calls.restoreProgression[0].perkPoints, { main: 2 }, "the points are as they were");
});

test("what is saved of a progression carries no combo: what the game holds of them is the Esgrima's or an administrator's loan, never the character file's (2026-10-26)", () => {
    const sut = load({ files: { [STEAM]: record() } });
    const player = sut.join();
    bring(sut, player);
    player.progression = { tracks: { alchemy: { level: 5, xp: 1 } }, perks: ["p1", "C01 (longsword)", "C02 (longsword)"], perkPoints: { main: 0 } };
    sut.clock.now += 20_000;
    sut.leave(player);
    const saved = sut.stored();
    assert.deepEqual(saved.progression.perks, ["p1"], "the other perks are saved as ever");
    assert.equal(saved.progression.tracks.alchemy.level, 5, "and the levels");
});

test("early saves of one player are at least eight seconds apart, and the leaving still saves at once (2026-10-26)", () => {
    const sut = load({ files: { [STEAM]: record() } });
    const player = sut.join();
    bring(sut, player);
    sut.flushTimeouts();
    sut.api.markKit(player, "kit-a");
    assert.equal(sut.timeouts.at(-1).ms, 2_500, "the first early save is at the usual delay");
    sut.flushTimeouts();
    assert.ok(sut.stored().kits.includes("kit-a"));

    sut.clock.now += 1_000;
    sut.api.markKit(player, "kit-b");
    assert.equal(sut.timeouts.at(-1).ms, 7_000, "the next waits for the gap since the last one");
    sut.api.markKit(player, "kit-c");
    assert.equal(sut.timeouts.length, 1, "and a change in the meantime joins the save that is waiting");
    sut.flushTimeouts();
    assert.ok(sut.stored().kits.includes("kit-b") && sut.stored().kits.includes("kit-c"));

    sut.clock.now += 100;
    sut.api.markKit(player, "kit-d");
    sut.leave(player);
    assert.ok(sut.stored().kits.includes("kit-d"), "leaving does not wait for the gap");
    const again = sut.join({ id: 5 });
    bring(sut, again);
    sut.api.markKit(again, "kit-e");
    assert.equal(sut.timeouts.at(-1).ms, 2_500, "a player who comes back has no gap to wait for");
});

// Two hundred players looked at in one breath would stop the server for a third of a second every half minute (a look is about a millisecond and a half,
// 17 at the worst, 2026-10-27, when the server was asked to be ready for two hundred): past four characters the looks are spread over the interval.

// Steam ids written out: seventeen digits do not survive being added to as numbers.
const steamOf = (i) => `7656119800000${String(i).padStart(4, "0")}`;

function crowd(sut, count) {
    const players = [];
    for (let i = 1; i <= count; i += 1) {
        const player = sut.join({ id: i, steamId: steamOf(i), nickname: `P${i}` });
        bring(sut, player);
        sut.inventories.set(player.id, [{ id: `n${i}`, item: "guid-bread", name: "bread", amount: i, metadata: {}, equipped: 0 }]);
        players.push(player);
    }
    sut.timeouts.length = 0;
    return players;
}

test("a few characters are all looked at in the tick itself", () => {
    const sut = load();
    crowd(sut, 4);
    sut.tick();
    assert.equal(sut.timeouts.length, 0, "no timer: everybody was looked at there and then");
    for (let i = 1; i <= 4; i += 1) assert.equal(sut.has(steamOf(i)), true, `character ${i} saved`);
});

test("past four characters the looks are spread over the interval, a quarter of a second apart at most, and every character is still looked at", () => {
    const sut = load();
    crowd(sut, 12);
    sut.tick();
    assert.deepEqual(sut.timeouts.map((timer) => timer.ms), Array.from({ length: 12 }, (_, i) => i * 250));
    assert.equal(sut.has(steamOf(1)), false, "nothing is written in the tick itself");

    sut.flushTimeouts();
    for (let i = 1; i <= 12; i += 1) assert.equal(sut.stored(steamOf(i)).inventory.items[0].amount, i, `character ${i} saved`);
});

test("two hundred characters are spread so that the last look still falls inside the interval", () => {
    const sut = load();
    crowd(sut, 200);
    sut.tick();
    const delays = sut.timeouts.map((timer) => timer.ms);
    assert.equal(delays.length, 200);
    assert.equal(delays[0], 0);
    assert.equal(delays[1], 120, "a hundred and twenty milliseconds apart: 24 s over 200");
    assert.ok(Math.max(...delays) < 30_000 * 0.8 + 1, "all within the first 80% of the half minute");
});

test("a character who left before its look came is not looked at, and nothing throws", () => {
    const sut = load();
    const players = crowd(sut, 6);
    sut.tick();
    sut.leave(players[3]);
    assert.doesNotThrow(() => sut.flushTimeouts());
});
