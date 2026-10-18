const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const CHEST = "c000000000000001";
const OTHER = "c000000000000002";
const BARREL = "b000000000000001";

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
            renameSync(from, to) { files.set(to, files.get(from)); files.delete(from); },
            existsSync: (file) => files.has(file),
        },
    };
}

/**
 * `properties` are the catalog entries (kind and stash guid); `stashes` what the level has built, each with the rows it holds.
 * setOk decides whether setInventory is accepted.
 */
function load({ properties = [], stashes = [], seed = {}, setOk = true } = {}) {
    const disk = fakeDisk();
    for (const [guid, value] of Object.entries(seed)) disk.files.set(`playerdata/chests/${guid}.json`, typeof value === "string" ? value : JSON.stringify(value));
    const storeSandbox = { exports: {}, require: () => disk.fs };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/store.js"), "utf8"), storeSandbox);

    const handlers = new Map();
    const timeouts = [];
    const intervals = [];
    const cleared = [];
    const logs = [];
    const state = { setOk };
    const set = [];

    const stashOf = (guid) => stashes.find((stash) => stash.levelGuid === guid) ?? null;
    const propertiesModule = {
        listProperties: () => properties,
        propertyOfStash: (guid) => properties.find((property) => property.stashGuid === guid) ?? null,
    };
    const context = {
        exports: {},
        require: (id) => {
            if (id === "./store.js") return storeSandbox.exports;
            if (id === "./properties.js") return propertiesModule;
            assert.fail(`unexpected require ${id}`);
        },
        console: { log: (line) => logs.push(line), error: (line) => logs.push(line) },
        Date: { now: () => 5000 },
        setTimeout: (fn, ms) => { timeouts.push({ fn, ms }); return timeouts.length; },
        clearTimeout: (id) => { cleared.push(id); },
        setInterval: (fn, ms) => { intervals.push({ fn, ms }); return intervals.length; },
        clearInterval: () => {},
        Events: { on: (name, fn) => handlers.set(name, fn) },
        Stash: { find: (guid) => stashOf(guid) },
    };
    for (const stash of stashes) {
        stash.getInventory = () => ({ revision: 1, items: stash.rows });
        stash.setInventory = (request) => {
            set.push({ guid: stash.levelGuid, items: JSON.parse(JSON.stringify(request.items)) });
            if (!state.setOk) return { ok: false, code: "unknownItem" };
            stash.rows = request.items.map((row) => ({ ...row, name: "x" }));
            return { ok: true, code: "" };
        };
    }
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/chest-state.js"), "utf8"), context);
    context.exports.installChestState();
    return {
        disk, handlers, timeouts, intervals, cleared, logs, state, set,
        fire: (stash) => handlers.get("stashInventoryChanged")(stash, null, { reason: "deposit", items: [] }),
        flush: () => { while (timeouts.length) timeouts.shift().fn(); },
        stored: (guid = CHEST) => JSON.parse(disk.files.get(`playerdata/chests/${guid}.json`)),
    };
}

const chestProperty = (guid = CHEST) => ({ id: `suchdol-${guid}`, kind: "chest", stashGuid: guid, doors: [] });
const makeStash = (guid, rows = []) => ({ levelGuid: guid, rows });
const row = (id, item, amount, metadata = {}) => ({ id, item, name: item, amount, metadata });

test("what a player leaves in a property chest is written a moment after it changes, and only once for a burst of changes", () => {
    const stash = makeStash(CHEST);
    const sut = load({ properties: [chestProperty()], stashes: [stash] });

    stash.rows = [row("a", "guid-bread", 3, { quality: 2 })];
    sut.fire(stash);
    stash.rows = [row("a", "guid-bread", 3, { quality: 2 }), row("b", "guid-apple", 1)];
    sut.fire(stash);
    assert.equal(sut.timeouts.length, 1, "the second change joins the first one's write");
    assert.equal(sut.timeouts[0].ms, 3000);
    assert.equal(sut.disk.files.size, 0, "nothing yet");

    sut.flush();
    const saved = sut.stored();
    assert.equal(saved.guid, CHEST);
    assert.deepEqual(saved.items, [
        { id: "a", item: "guid-bread", amount: 3, metadata: { quality: 2 } },
        { id: "b", item: "guid-apple", amount: 1, metadata: {} },
    ]);
});

test("an emptied chest is saved empty, so what was taken out stays out", () => {
    const stash = makeStash(CHEST, [row("a", "guid-bread", 1)]);
    const sut = load({ properties: [chestProperty()], stashes: [stash], seed: { [CHEST]: { v: 1, guid: CHEST, savedAt: 1, items: [{ id: "a", item: "guid-bread", amount: 1, metadata: {} }] } } });
    stash.rows = [];
    sut.fire(stash);
    sut.flush();
    assert.deepEqual(sut.stored().items, []);
});

test("containers that are not property chests are left alone", () => {
    const barrel = makeStash(BARREL, [row("a", "guid-arrow", 10)]);
    const sut = load({ properties: [chestProperty()], stashes: [barrel] });
    sut.fire(barrel);
    sut.fire(makeStash("", [row("a", "x", 1)]));
    assert.equal(sut.timeouts.length, 0);
    sut.fire({ levelGuid: "c0000000000000ff", rows: [] });
    assert.equal(sut.timeouts.length, 0, "a chest the catalog does not know is not kept either");
});

test("a house is not a chest, even if it has a stash guid", () => {
    const stash = makeStash(CHEST);
    const sut = load({ properties: [{ id: "casa", kind: "house", stashGuid: CHEST, doors: ["d"] }], stashes: [stash] });
    sut.fire(stash);
    assert.equal(sut.timeouts.length, 0);
});

test("at start the saved contents go back into the chest", () => {
    const stash = makeStash(CHEST);
    const seed = { [CHEST]: { v: 1, guid: CHEST, savedAt: 1, items: [{ id: "a", item: "guid-bread", amount: 3, metadata: { quality: 2 } }] } };
    const sut = load({ properties: [chestProperty()], stashes: [stash], seed });

    assert.equal(sut.set.length, 1);
    assert.deepEqual(sut.set[0].items, [{ id: "a", item: "guid-bread", amount: 3, metadata: { quality: 2 } }]);
    assert.equal(stash.rows.length, 1);
    assert.ok(sut.logs.some((line) => /1 baú\(s\) no catálogo; 1 com conteúdo devolvido/.test(line)));
});

test("a chest nobody ever used has nothing to restore", () => {
    const stash = makeStash(CHEST);
    const sut = load({ properties: [chestProperty()], stashes: [stash] });
    assert.equal(sut.set.length, 0);
});

test("a chest the level has not built yet is tried again until it is there", () => {
    const stashes = [];
    const seed = { [CHEST]: { v: 1, guid: CHEST, savedAt: 1, items: [{ id: "a", item: "guid-bread", amount: 1, metadata: {} }] } };
    const sut = load({ properties: [chestProperty()], stashes, seed });
    assert.equal(sut.intervals.length, 1);
    assert.ok(sut.logs.some((line) => /1 esperando o nível/.test(line)));

    sut.intervals[0].fn();
    assert.equal(sut.set.length, 0);
});

test("a saved file that cannot be read is never restored and never overwritten", () => {
    const stash = makeStash(CHEST, []);
    const sut = load({ properties: [chestProperty()], stashes: [stash], seed: { [CHEST]: "{ not json" } });
    assert.equal(sut.set.length, 0);
    assert.ok(sut.logs.some((line) => /ilegível/.test(line)));

    stash.rows = [row("a", "guid-x", 1)];
    sut.fire(stash);
    sut.flush();
    assert.equal(sut.disk.files.get(`playerdata/chests/${CHEST}.json`), "{ not json");
});

test("contents the game refuses leave the file as it was, and later changes do not overwrite it", () => {
    const stash = makeStash(CHEST);
    const seed = { [CHEST]: { v: 1, guid: CHEST, savedAt: 1, items: [{ id: "a", item: "guid-gone", amount: 1, metadata: {} }] } };
    const sut = load({ properties: [chestProperty()], stashes: [stash], seed, setOk: false });

    assert.equal(sut.set.length, 1, "it was offered");
    assert.ok(sut.logs.some((line) => /recusou o conteúdo salvo/.test(line)));

    stash.rows = [row("n", "guid-new", 1)];
    sut.fire(stash);
    sut.flush();
    assert.deepEqual(sut.stored().items.map((entry) => entry.item), ["guid-gone"], "the saved file is exactly as it was");
});

test("a junk row in a saved chest is dropped, not passed to the game", () => {
    const stash = makeStash(CHEST);
    const seed = { [CHEST]: { v: 1, guid: CHEST, savedAt: 1, items: [{ id: 5 }, null, { id: "a", item: "guid", amount: 2, metadata: {} }, { id: "b", item: "g", amount: -1, metadata: {} }] } };
    const sut = load({ properties: [chestProperty()], stashes: [stash], seed });
    assert.deepEqual(sut.set[0].items.map((entry) => entry.id), ["a"]);
});

test("stopping the resource writes whatever was waiting, and another resource stopping does nothing", () => {
    const stash = makeStash(CHEST);
    const sut = load({ properties: [chestProperty()], stashes: [stash] });
    stash.rows = [row("a", "guid-bread", 1)];
    sut.fire(stash);

    sut.handlers.get("resourceStop")("other");
    assert.equal(sut.disk.files.size, 0);
    sut.handlers.get("resourceStop")("kcdc-gamemode");
    assert.equal(sut.stored().items.length, 1);
    assert.equal(sut.cleared.length, 1, "the timer that was waiting is cancelled");
});

test("a stash guid that is not sixteen hex digits never reaches a file name", () => {
    const evil = "../../etc/passwd";
    const stash = makeStash(evil);
    const sut = load({ properties: [{ id: "x", kind: "chest", stashGuid: evil, doors: [] }], stashes: [stash] });
    sut.fire(stash);
    sut.flush();
    assert.equal(sut.disk.files.size, 0);
});
