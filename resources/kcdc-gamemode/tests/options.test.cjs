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

test("somebody who never chose gets first person, at the normal distance", () => {
    const sut = load();
    const hans = sut.player("76561198000000001");
    sut.clients.get(GET)(hans);
    assert.deepEqual(hans.sent, [{ name: STATE, payload: { thirdPerson: false, view: "normal" } }]);
});

test("a choice is kept by Steam id and is what that player gets back, then and at the next join", () => {
    const sut = load();
    const hans = sut.player("76561198000000001");
    sut.clients.get(SET)(hans, JSON.stringify({ thirdPerson: true, view: "longe" }));
    assert.deepEqual(hans.sent.at(-1), { name: STATE, payload: { thirdPerson: true, view: "longe" } });
    assert.deepEqual(sut.saved(), { "76561198000000001": { thirdPerson: true, view: "longe" } });

    const again = load(JSON.stringify(sut.saved()));
    const back = again.player("76561198000000001");
    again.clients.get(GET)(back);
    assert.deepEqual(back.sent, [{ name: STATE, payload: { thirdPerson: true, view: "longe" } }]);
    const other = again.player("76561198000000002");
    again.clients.get(GET)(other);
    assert.deepEqual(other.sent[0].payload, { thirdPerson: false, view: "normal" }, "one player's choice is theirs alone");
});

test("a field that is wrong or missing keeps what was there; 1 and 0 are understood as on and off", () => {
    const sut = load();
    const hans = sut.player("76561198000000001");
    sut.clients.get(SET)(hans, { thirdPerson: 1, view: "perto" });
    sut.clients.get(SET)(hans, { thirdPerson: "sim", view: "atrás" });
    assert.deepEqual(hans.sent.at(-1).payload, { thirdPerson: true, view: "perto" });
    sut.clients.get(SET)(hans, { view: "longe" });
    assert.deepEqual(hans.sent.at(-1).payload, { thirdPerson: true, view: "longe" });
    sut.clients.get(SET)(hans, { thirdPerson: 0 });
    assert.deepEqual(hans.sent.at(-1).payload, { thirdPerson: false, view: "longe" });
    sut.clients.get(SET)(hans, "not json");
    sut.clients.get(SET)(hans, "x".repeat(5000));
    assert.deepEqual(hans.sent.at(-1).payload, { thirdPerson: false, view: "longe" });
});

test("nothing is written when nothing changed, nor for a player with no Steam id", () => {
    const sut = load();
    const hans = sut.player("76561198000000001");
    sut.clients.get(SET)(hans, { thirdPerson: false, view: "normal" });
    assert.equal(sut.disk.files.has("playerdata/options.json"), false, "the defaults need no file");

    const nobody = sut.player("");
    sut.clients.get(SET)(nobody, { thirdPerson: true, view: "longe" });
    assert.deepEqual(nobody.sent.at(-1).payload, { thirdPerson: false, view: "normal" });
    assert.equal(sut.disk.files.has("playerdata/options.json"), false);
});

test("an unreadable file is said in the log and left as it is until a choice is made", () => {
    const sut = load("{ broken");
    const hans = sut.player("76561198000000001");
    sut.clients.get(GET)(hans);
    assert.deepEqual(hans.sent[0].payload, { thirdPerson: false, view: "normal" });
    assert.ok(sut.errors.some((line) => /ilegível/.test(line)));
    assert.equal(sut.disk.files.get("playerdata/options.json"), "{ broken");
});
