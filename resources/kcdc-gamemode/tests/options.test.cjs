const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

/** A fake disk with the handful of calls store.js makes, so a write can be followed back into a read. */
function fakeDisk(seed) {
    const files = new Map(seed === undefined ? [] : [["playerdata/options.json", seed]]);
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
                if (!files.has(from)) throw new Error("ENOENT");
                files.set(to, files.get(from));
                files.delete(from);
            },
            existsSync: (file) => files.has(file),
        },
    };
}

function load(seed) {
    const disk = fakeDisk(seed);
    const store = { exports: {}, require: (id) => { assert.equal(id, "node:fs"); return disk.fs; } };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/store.js"), "utf8"), store);
    const clients = new Map();
    const errors = [];
    const context = {
        exports: {},
        require: (id) => { assert.equal(id, "./store.js"); return store.exports; },
        console: { log: (line) => errors.push(line), error: (line) => errors.push(line) },
        Events: { onClient: (name, fn) => clients.set(name, fn) },
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/options.js"), "utf8"), context);
    context.exports.installOptions();
    const player = (steamId) => ({ steamId, sent: [], emit(name, payload) { this.sent.push({ name, payload: JSON.parse(payload) }); } });
    const saved = () => JSON.parse(disk.files.get("playerdata/options.json"));
    return { api: context.exports, clients, errors, disk, player, saved };
}

const GET = "kcdc-gamemode:options.get";
const SET = "kcdc-gamemode:options.set";
const STATE = "kcdc-gamemode:options.state";
const plainOf = (value) => JSON.parse(JSON.stringify(value));

test("somebody who never chose gets first person, at the normal distance", () => {
    const sut = load();
    const hans = sut.player("76561198000000001");
    sut.clients.get(GET)(hans);
    assert.deepEqual(hans.sent, [{ name: STATE, payload: { thirdPerson: false, view: "normal", mic: "apertar", sensitivity: "media", ui: "100" } }]);
});

test("a choice is kept by Steam id and is what that player gets back, then and at the next join", () => {
    const sut = load();
    const hans = sut.player("76561198000000001");
    sut.clients.get(SET)(hans, JSON.stringify({ thirdPerson: true, view: "longe" }));
    assert.deepEqual(hans.sent.at(-1), { name: STATE, payload: { thirdPerson: true, view: "longe", mic: "apertar", sensitivity: "media", ui: "100" } });
    assert.deepEqual(sut.saved(), { "76561198000000001": { thirdPerson: true, view: "longe", mic: "apertar", sensitivity: "media", ui: "100" } });

    const again = load(JSON.stringify(sut.saved()));
    const back = again.player("76561198000000001");
    again.clients.get(GET)(back);
    assert.deepEqual(back.sent, [{ name: STATE, payload: { thirdPerson: true, view: "longe", mic: "apertar", sensitivity: "media", ui: "100" } }]);
    const other = again.player("76561198000000002");
    again.clients.get(GET)(other);
    assert.deepEqual(other.sent[0].payload, { thirdPerson: false, view: "normal", mic: "apertar", sensitivity: "media", ui: "100" }, "one player's choice is theirs alone");
});

test("a field that is wrong or missing keeps what was there; 1 and 0 are understood as on and off", () => {
    const sut = load();
    const hans = sut.player("76561198000000001");
    sut.clients.get(SET)(hans, { thirdPerson: 1, view: "perto" });
    sut.clients.get(SET)(hans, { thirdPerson: "sim", view: "atrás" });
    assert.deepEqual(hans.sent.at(-1).payload, { thirdPerson: true, view: "perto", mic: "apertar", sensitivity: "media", ui: "100" });
    sut.clients.get(SET)(hans, { view: "longe" });
    assert.deepEqual(hans.sent.at(-1).payload, { thirdPerson: true, view: "longe", mic: "apertar", sensitivity: "media", ui: "100" });
    sut.clients.get(SET)(hans, { thirdPerson: 0 });
    assert.deepEqual(hans.sent.at(-1).payload, { thirdPerson: false, view: "longe", mic: "apertar", sensitivity: "media", ui: "100" });
    sut.clients.get(SET)(hans, "not json");
    sut.clients.get(SET)(hans, "x".repeat(5000));
    assert.deepEqual(hans.sent.at(-1).payload, { thirdPerson: false, view: "longe", mic: "apertar", sensitivity: "media", ui: "100" });
});

test("nothing is written when nothing changed, nor for a player with no Steam id", () => {
    const sut = load();
    const hans = sut.player("76561198000000001");
    sut.clients.get(SET)(hans, { thirdPerson: false, view: "normal" });
    assert.equal(sut.disk.files.has("playerdata/options.json"), false, "the defaults need no file");

    const nobody = sut.player("");
    sut.clients.get(SET)(nobody, { thirdPerson: true, view: "longe" });
    assert.deepEqual(nobody.sent.at(-1).payload, { thirdPerson: false, view: "normal", mic: "apertar", sensitivity: "media", ui: "100" });
    assert.equal(sut.disk.files.has("playerdata/options.json"), false);
});

test("an unreadable file is said in the log and left as it is until a choice is made", () => {
    const sut = load("{ broken");
    const hans = sut.player("76561198000000001");
    sut.clients.get(GET)(hans);
    assert.deepEqual(hans.sent[0].payload, { thirdPerson: false, view: "normal", mic: "apertar", sensitivity: "media", ui: "100" });
    assert.ok(sut.errors.some((line) => /ilegível/.test(line)));
    assert.equal(sut.disk.files.get("playerdata/options.json"), "{ broken");
});

test("the microphone is held (on H), at a middle sensitivity, for somebody who never chose; a choice is kept with the camera's and does not disturb it", () => {
    const sut = load();
    const hans = sut.player("76561198000000001");
    sut.clients.get(SET)(hans, { thirdPerson: true, view: "perto" });
    sut.clients.get(SET)(hans, { mic: "aberto", sensitivity: "baixa" });
    assert.deepEqual(hans.sent.at(-1).payload, { thirdPerson: true, view: "perto", mic: "aberto", sensitivity: "baixa", ui: "100" }, "the camera is as it was");
    assert.deepEqual(sut.saved()["76561198000000001"], { thirdPerson: true, view: "perto", mic: "aberto", sensitivity: "baixa", ui: "100" });
    sut.clients.get(SET)(hans, { thirdPerson: false, view: "longe" });
    assert.deepEqual(hans.sent.at(-1).payload, { thirdPerson: false, view: "longe", mic: "aberto", sensitivity: "baixa", ui: "100" }, "and a camera choice leaves the microphone alone");

    sut.clients.get(SET)(hans, { mic: "gritando", sensitivity: 7 });
    assert.deepEqual(hans.sent.at(-1).payload.mic, "aberto", "a mode nobody knows keeps the one there was");
    assert.deepEqual(hans.sent.at(-1).payload.sensitivity, "baixa");
    assert.deepEqual(plainOf(sut.api.optionsOf("76561198000000009")), { thirdPerson: false, view: "normal", mic: "apertar", sensitivity: "media", ui: "100" });
});

test("a file written before the microphone existed is read with the one held (on H)", () => {
    const sut = load(JSON.stringify({ "76561198000000001": { thirdPerson: true, view: "longe" } }));
    assert.deepEqual(plainOf(sut.api.optionsOf("76561198000000001")), { thirdPerson: true, view: "longe", mic: "apertar", sensitivity: "media", ui: "100" });
});

test("the size of the server's pages is kept with the rest: one of the steps, anything else left as it was (2026-10-25)", () => {
    const sut = load();
    const hans = sut.player("76561198000000001");
    const set = (player, change) => sut.clients.get(SET)(player, JSON.stringify(change));
    set(hans, { ui: "125" });
    assert.deepEqual(hans.sent.at(-1).payload, { thirdPerson: false, view: "normal", mic: "apertar", sensitivity: "media", ui: "125" });
    set(hans, { ui: "300" });
    set(hans, { ui: 90 });
    assert.equal(hans.sent.at(-1).payload.ui, "125", "not a step: kept as it was");
    assert.equal(sut.saved()["76561198000000001"].ui, "125");
});
