"use strict";

// The tests run each compiled module in a vm with a `require` that knows only what the test lists. `reach.js` (src/client/reach.ts and
// src/server/reach.ts, 2026-10-22) is a module of constants and two small functions that a dozen modules take their distances from, so
// every sandbox is given the real one instead of each test listing it: `require("./reachpatch.cjs")` at the top of a test file.
//
// `profession-xp.js` (src/server/profession-xp.ts, 2026-10-27) is the same kind of thing: a module with no dependencies, the pace the trades' XP is paid at, that the
// ones that give XP (craft, farm, gather, cows) take their numbers through. It is given to every sandbox that asks for it, as the real one, one copy for all.

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function exportsOf(side, name = "reach") {
    const sandbox = { exports: {}, Math };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, `../dist/${side}/${name}.js`), "utf8"), sandbox);
    return sandbox.exports;
}

const client = exportsOf("client");
const server = exportsOf("server");
/** Both halves in one: the constants agree (`tests/reach.test.cjs` says so), the functions are each side's own. */
const both = { ...client, ...server };
const profession = exportsOf("server", "profession-xp");

const injected = new Map([
    ['"./reach.js"', both],
    ['"./profession-xp.js"', profession],
]);

const original = vm.runInNewContext;
vm.runInNewContext = function runInNewContext(code, sandbox, options) {
    if (sandbox !== undefined && sandbox !== null && typeof code === "string") {
        const wanted = [...injected].filter(([needle]) => code.includes(needle));
        if (wanted.length > 0) {
            const inner = typeof sandbox.require === "function" ? sandbox.require : null;
            sandbox.require = (id) => {
                for (const [needle, module] of wanted) {
                    if (needle === `"${id}"`) {
                        return module;
                    }
                }
                return inner === null ? undefined : inner(id);
            };
        }
    }
    return original.call(this, code, sandbox, options);
};

module.exports = { both, profession };
