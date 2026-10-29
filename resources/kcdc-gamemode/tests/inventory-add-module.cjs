"use strict";

// The real src/server/inventory-add.ts for the harnesses of the modules that import it (trade, death drops, the dice pot, thieves' restitution, money): it is loaded
// into a realm of its own, with the harness's own `Inventory` and `Stash`, which is what its `addUnits` and `addUnitsToStash` reach for when they are called.
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

module.exports = function inventoryAdd(globals) {
    const sandbox = { exports: {}, Inventory: globals.Inventory, Stash: globals.Stash };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/inventory-add.js"), "utf8"), sandbox);
    return sandbox.exports;
};
