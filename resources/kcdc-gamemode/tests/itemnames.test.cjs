const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function load(files) {
    const reads = [];
    const logs = [];
    const context = {
        exports: {},
        require: (id) => {
            assert.equal(id, "node:fs");
            return {
                readFileSync: (file) => {
                    reads.push(file);
                    const hit = Object.keys(files).find((name) => file.endsWith(name));
                    if (hit === undefined) throw new Error("ENOENT");
                    return files[hit];
                },
            };
        },
        console: { log: (line) => logs.push(line) },
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/item-names.js"), "utf8"), context);
    return { api: context.exports, reads, logs };
}

test("an item is named as the game names it in Portuguese, by its class GUID", () => {
    const sut = load({ "data/item-names.json": JSON.stringify({ "3a640e5d-d8bd-4e8b-b61d-8cd5180e79e7": "Adaga", "abc": "Pão" }) });
    assert.equal(sut.api.itemName({ item: "3A640E5D-D8BD-4E8B-B61D-8CD5180E79E7", name: "daggerCommon" }), "Adaga");
    assert.equal(sut.api.itemLine({ item: "abc", amount: 3 }), "3x Pão");
    assert.equal(sut.api.itemLine({ item: "abc", amount: 1 }), "Pão");
});

test("quality shows as the game shows it, and a custom item keeps its own name", () => {
    const sut = load({ "data/item-names.json": JSON.stringify({ abc: "Adaga" }) });
    assert.equal(sut.api.itemName({ item: "abc", metadata: { quality: 3 } }), "Adaga (qualidade III)");
    assert.equal(sut.api.itemName({ item: "abc", metadata: { quality: 1 } }), "Adaga");
    assert.equal(sut.api.itemName({ item: "kcdc-property:casa", metadata: { custom: { name: "Chave: Casa 03" } } }), "Chave: Casa 03");
});

test("without the table, the table name is used, and the file is looked for once", () => {
    const sut = load({});
    assert.equal(sut.api.itemName({ item: "x", name: "bread" }), "bread");
    assert.equal(sut.api.itemName({ item: "y" }), "item");
    const reads = sut.reads.length;
    sut.api.itemName({ item: "z", name: "apple" });
    assert.equal(sut.reads.length, reads, "not read again");
    assert.ok(sut.logs.some((line) => /não foi encontrado/.test(line)));
});

test("the shipped table names the starter items", () => {
    const table = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/item-names.json"), "utf8"));
    assert.equal(table["3a640e5d-d8bd-4e8b-b61d-8cd5180e79e7"], "Adaga");
    assert.equal(table["65ccc0cd-de18-4305-9d64-42bb3c6d8d30"], "Dado comum");
    assert.ok(Object.keys(table).length > 4000);
});
