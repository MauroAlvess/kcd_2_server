"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

// The order the server's entry file wires things up in (src/server/index.ts). Every item type of ours must be registered with the game
// before anything puts a saved inventory back with it in, or the game refuses the class and the chest comes back empty ("recusou o
// conteúdo salvo (invalidItem)"): 2026-10-20 a tavern chest with malt in it (the craft items came after the chests), and 2026-10-21 two
// chests with recipe books (the books were registered one line after `installChestState()`).

const source = fs.readFileSync(path.join(__dirname, "../src/server/index.ts"), "utf8");

/**
 * Where a call stands in the entry file; fails when it is not called, or is called twice. A call is at the top level or one level in, under the `if (kuttenberg) {` that keeps what is put into the world at
 * Kuttenberg's coordinates off the other levels (`level.ts`, 2026-11-09).
 */
function at(call) {
    const found = [];
    for (const pattern of [`\n${call}();`, `\n    ${call}();`]) {
        for (let from = source.indexOf(pattern); from >= 0; from = source.indexOf(pattern, from + 1)) found.push(from);
    }
    assert.ok(found.length >= 1, `${call}() is called in the entry file`);
    assert.equal(found.length, 1, `${call}() is called once`);
    return found[0];
}

test("the craft items and the recipe books are registered before the properties, the chests and the vendors", () => {
    for (const registration of ["registerCraftItems", "registerBooks"]) {
        for (const user of ["installProperties", "installChestState", "installVendors"]) {
            assert.ok(at(registration) < at(user), `${registration}() comes before ${user}()`);
        }
    }
});

test("the keys of the properties are registered before the chests are put back", () => {
    assert.ok(at("installProperties") < at("installChestState"));
});
