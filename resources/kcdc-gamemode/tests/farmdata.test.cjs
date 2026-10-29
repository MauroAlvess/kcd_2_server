"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

// The level's gardens and open meadows (src/server/farm-data.ts, data/farm.json by tools/make-farm-data.py, 2026-10-22).

const plain = (value) => JSON.parse(JSON.stringify(value));
const FILE = path.join(__dirname, "../data/farm.json");

function load(files = {}) {
    const sandbox = {
        exports: {},
        console: { log() {} },
        require: (id) => (id === "node:fs" ? { readFileSync: (file) => { for (const [pattern, text] of Object.entries(files)) if (file.endsWith(pattern)) return text; throw new Error("ENOENT"); } } : assert.fail(`unexpected require ${id}`)),
        __dirname: "/gm/dist/server",
        JSON,
        Number,
        Array,
        Math,
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/farm-data.js"), "utf8"), sandbox);
    return sandbox.exports;
}

test("a file's rows are read into gardens, beds with ids of their own, and meadows; a row that makes no sense is left out", () => {
    const sut = load();
    const data = sut.readFarmData({
        gardens: [
            { id: "a", name: "Horta de A", x: 1, y: 2, z: 3, beds: [[10, 20, 30, 90, 3], [11, 21, 31], ["x", 1, 2], "no", [12, 22, 32, 45, -4]] },
            { id: "b", name: "Horta de B", x: 5, y: 6, z: 7, beds: [] },
            { id: "c", name: 5, x: 1, y: 2, z: 3, beds: [[1, 2, 3]] },
            "nonsense",
        ],
        meadows: [[100, 200, 300], [1, 2], "x", [1, 2, "y"]],
    });
    assert.equal(data.gardens.length, 1, "a garden with no bed, or no name, is no garden");
    const [garden] = plain(data.gardens);
    assert.equal(garden.id, "a");
    assert.deepEqual(garden.beds.map((bed) => [bed.id, bed.garden, bed.x, bed.y, bed.z, bed.yaw, bed.length]), [
        ["a:1", "a", 10, 20, 30, 90, 3],
        ["a:2", "a", 11, 21, 31, 0, 1.6],
        ["a:3", "a", 12, 22, 32, 45, 1.6],
    ], "a bed with no yaw or length gets north and a row of 1.6 m; a length that is not positive too");
    assert.equal(data.beds.length, 3);
    assert.deepEqual(plain(data.meadows), [{ x: 100, y: 200, z: 300 }]);
    assert.deepEqual(plain(sut.readFarmData(null)), { gardens: [], beds: [], meadows: [] });
    assert.deepEqual(plain(sut.readFarmData("x")), { gardens: [], beds: [], meadows: [] });
    assert.deepEqual(plain(sut.readFarmData({ gardens: 5, meadows: 5 })), { gardens: [], beds: [], meadows: [] });
});

test("the data is read from the folder next to the compiled code once, and an empty world is made when there is no file", () => {
    const text = JSON.stringify({ gardens: [{ id: "a", name: "Horta de A", x: 1, y: 2, z: 3, beds: [[10, 20, 30, 0, 2]] }], meadows: [[1, 2, 3]] });
    const sut = load({ "data/farm.json": text });
    const data = sut.farmData();
    assert.equal(data.gardens.length, 1);
    assert.equal(sut.farmData(), data, "read once");
    sut.setFarmData({ gardens: [], beds: [], meadows: [] });
    assert.equal(sut.farmData().gardens.length, 0, "a test may say what the file held");

    const none = load();
    assert.deepEqual(plain(none.farmData()), { gardens: [], beds: [], meadows: [] });
});

test("the real file: sixty-seven gardens with a hundred and eighteen beds, in the map, each named for a place and numbered, and twenty-one open meadows", () => {
    const data = load({ "data/farm.json": fs.readFileSync(FILE, "utf8") }).farmData();
    assert.equal(data.gardens.length, 67);
    assert.equal(data.beds.length, 118);
    assert.equal(data.meadows.length, 21);
    const ids = new Set(data.gardens.map((garden) => garden.id));
    assert.equal(ids.size, 67, "every garden has an id of its own");
    assert.equal(new Set(data.beds.map((bed) => bed.id)).size, 118, "and every bed");
    for (const garden of data.gardens) {
        assert.match(garden.name, /^Horta de /);
        assert.match(garden.id, /^[a-z0-9-]+$/);
        assert.ok(garden.beds.length >= 1 && garden.beds.length <= 6);
        for (const bed of garden.beds) {
            assert.ok(bed.x > 0 && bed.x < 4096 && bed.y > 0 && bed.y < 4096, `${bed.id} is on the map`);
            assert.ok(bed.z > -50 && bed.z < 400, `${bed.id}'s height`);
            // The rows the level has are four metres or less; read, they are made twice as long, up to eight (2026-10-27: "precisamos estender os campos de arado").
            assert.ok(bed.length >= 2.4 && bed.length <= 8, `${bed.id}'s row is a believable length`);
            assert.ok(bed.yaw >= 0 && bed.yaw < 360);
            assert.ok(Math.hypot(bed.x - garden.x, bed.y - garden.y) < 60, `${bed.id} is in its garden`);
        }
    }
    // The villages with gardens: the ones the players live in among them.
    for (const wanted of ["suchdol", "raborsch", "wysoka", "malesov", "kuttenberg"]) {
        assert.ok(data.gardens.some((garden) => garden.id.startsWith(wanted)), `${wanted} has a garden`);
    }
    // The meadows: apart from each other and from the gardens, so a horse is not wild in a village's yard.
    for (let i = 0; i < data.meadows.length; i += 1) {
        const a = data.meadows[i];
        for (const b of data.meadows.slice(i + 1)) {
            assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= 299, "meadows 300 m apart at least");
        }
        for (const garden of data.gardens) {
            assert.ok(Math.hypot(a.x - garden.x, a.y - garden.y) >= 249, `a meadow at ${a.x}, ${a.y} is 250 m from every garden`);
        }
    }
});
