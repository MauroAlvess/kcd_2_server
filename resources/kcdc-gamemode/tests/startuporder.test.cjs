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

/** Where a top-level call stands in the entry file; fails when it is not called, or is called twice. */
function at(call) {
    const pattern = `\n${call}();`;
    const first = source.indexOf(pattern);
    assert.ok(first >= 0, `${call}() is called at the top level of the entry file`);
    assert.equal(source.indexOf(pattern, first + 1), -1, `${call}() is called once`);
    return first;
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
