"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

// The players of the animals' round filed by squares (src/server/animals.ts `PlayerGrid`, 2026-10-27, thirty players online): every player within the grid's
// side of a point must be found among the nine squares round it, none twice, wherever the point and the players are.

function load() {
    const context = {
        exports: {},
        require: (id) => (id === "./place.js" ? { distanceBetween: () => 0 } : id === "./npc-spawn.js" ? { spawnNpc: () => null } : assert.fail(`unexpected require ${id}`)),
        Math,
        Date,
        console,
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/animals.js"), "utf8"), context);
    return context.exports;
}

test("the grid finds every player within its side of a point, the same as measuring them all, and none twice", () => {
    const { PlayerGrid } = load();
    let seed = 7;
    const random = () => {
        seed = (seed * 1103515245 + 12345) % 2147483648;
        return seed / 2147483648;
    };
    const players = [];
    for (let i = 0; i < 300; i += 1) {
        // Crowded in a town, spread over the map, and on the squares' edges.
        const x = i % 3 === 0 ? 2950 + random() * 40 : i % 3 === 1 ? random() * 4000 : Math.round(random() * 20) * 200;
        const y = i % 3 === 0 ? 900 + random() * 40 : i % 3 === 1 ? random() * 4000 : Math.round(random() * 20) * 200;
        players.push({ id: i, position: { x, y, z: 0 } });
    }
    const grid = new PlayerGrid(200, players);
    for (let k = 0; k < 400; k += 1) {
        const x = k % 2 === 0 ? random() * 4000 : 2960 + random() * 20;
        const y = k % 2 === 0 ? random() * 4000 : 910 + random() * 20;
        for (const radius of [18, 60, 120, 150, 200]) {
            const all = players.filter((one) => Math.hypot(one.position.x - x, one.position.y - y) <= radius).map((one) => one.id).sort((a, b) => a - b);
            const found = Array.from(grid.around(x, y)).filter((one) => Math.hypot(one.position.x - x, one.position.y - y) <= radius).map((one) => one.id).sort((a, b) => a - b);
            assert.deepEqual(found, all, `at ${x.toFixed(1)} ${y.toFixed(1)} within ${radius} m`);
        }
        const around = Array.from(grid.around(x, y)).map((one) => one.id);
        assert.equal(new Set(around).size, around.length, "nobody twice");
        assert.equal(grid.some(x, y, (one) => Math.hypot(one.position.x - x, one.position.y - y) <= 60), players.some((one) => Math.hypot(one.position.x - x, one.position.y - y) <= 60));
    }
});
