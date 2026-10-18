const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

/** A fake disk; `failRenameOf` makes the swap fail for one target, to model a crash between the two renames. */
function load() {
    const files = new Map();
    const state = { failRenameTo: null };
    const disk = {
        readFileSync(file) {
            if (!files.has(file)) throw new Error("ENOENT");
            return files.get(file);
        },
        writeFileSync(file, data) { files.set(file, data); },
        mkdirSync() {},
        renameSync(from, to) {
            if (state.failRenameTo === to) throw new Error("disk full");
            files.set(to, files.get(from));
            files.delete(from);
        },
        existsSync: (file) => files.has(file),
    };
    const sandbox = { exports: {}, require: (id) => { assert.equal(id, "node:fs"); return disk; } };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/store.js"), "utf8"), sandbox);
    return { api: sandbox.exports, files, state };
}

test("a file nobody wrote is missing, not corrupt", () => {
    const { api } = load();
    assert.deepEqual({ ...api.read("a.json") }, { status: "missing" });
});

test("what is written is read back, and the previous version is kept beside it", () => {
    const { api, files } = load();
    api.write("a.json", { n: 1 });
    assert.equal(files.has("a.json.bak"), false, "nothing to back up the first time");
    api.write("a.json", { n: 2 });

    const read = api.read("a.json");
    assert.equal(read.status, "ok");
    assert.equal(read.value.n, 2);
    assert.equal(read.fromBackup, false);
    assert.equal(JSON.parse(files.get("a.json.bak")).n, 1);
    assert.equal(files.has("a.json.tmp"), false, "the temporary file is gone");
});

test("a main file that no longer parses is read from the backup instead", () => {
    const { api, files } = load();
    api.write("a.json", { n: 1 });
    api.write("a.json", { n: 2 });
    files.set("a.json", "{ half a fi");

    const read = api.read("a.json");
    assert.equal(read.status, "ok");
    assert.equal(read.value.n, 1);
    assert.equal(read.fromBackup, true);
});

test("when neither the file nor its backup can be read, the answer is corrupt and never missing", () => {
    const { api, files } = load();
    files.set("a.json", "not json");
    const read = api.read("a.json");
    assert.equal(read.status, "corrupt");
    assert.match(read.reason, /a\.json/);

    files.set("a.json.bak", "also not json");
    assert.equal(api.read("a.json").status, "corrupt");
});

test("a damaged main file is set aside on the next write rather than replacing the good backup", () => {
    const { api, files } = load();
    api.write("a.json", { n: 1 });
    api.write("a.json", { n: 2 });
    files.set("a.json", "garbage");

    api.write("a.json", { n: 3 });
    assert.equal(JSON.parse(files.get("a.json.bak")).n, 1, "the last good copy is still the backup");
    assert.equal(JSON.parse(files.get("a.json")).n, 3);
    assert.ok([...files.keys()].some((name) => name.startsWith("a.json.corrupt-")), "the damaged file is kept for a look");
});

test("a write that dies between the two renames leaves the old content readable", () => {
    const { api, files, state } = load();
    api.write("a.json", { n: 1 });

    state.failRenameTo = "a.json";
    assert.throws(() => api.write("a.json", { n: 2 }), /disk full/);
    state.failRenameTo = null;

    // The main name is gone but the backup holds the last good copy.
    const read = api.read("a.json");
    assert.equal(read.status, "ok");
    assert.equal(read.value.n, 1);
    assert.equal(read.fromBackup, true);
    assert.ok(files.has("a.json.tmp"), "the new content was written, just never swapped in");
});
