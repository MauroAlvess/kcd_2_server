const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
require("./reachpatch.cjs");

// The forges and alchemy tables placed with the World Builder (src/server/craft-places.ts): learnt from the exports by their
// model, wherever the builder put them (user, 2026-10-19: "deixe que eu mesmo monto o mundo").

function load({ ready = true, worlds = [] } = {}) {
    const state = { logs: [], once: new Map() };
    const context = {
        exports: {},
        Math,
        console: { log: (line) => state.logs.push(line) },
        WorldResource: { ready, all: () => worlds },
        Events: { once: (name, fn) => state.once.set(name, fn) },
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/craft-places.js"), "utf8"), context);
    return { api: context.exports, state };
}

const prop = (model, x, y, z = 100) => ({ model, position: { x, y, z } });
// What the module's own realm built, as plain values.
const plain = (value) => JSON.parse(JSON.stringify(value));

test("a forge or an alchemy table in any export is a place of work, wherever it stands; nothing else is", () => {
    const worlds = [
        { props: [prop("objects/manmade/structures/industrial/smitheries/forge_big_a.cgf", 10, 10), prop("objects/manmade/common_furniture/beds/high/bed_royal_b.cgf", 0, 0)] },
        { props: [prop("Objects/manmade/task_specific_props/metal_industry/smithing/forge_small_b.cgf", 500, 500), prop("objects/manmade/task_specific_props/alchemy/alchemy_table_b/alchemy_table_b.cgf", 30, 30), prop("objects/manmade/structures/industrial/smitheries/coal_forge.cgf", 60, 60)] },
    ];
    const sut = load({ worlds });
    sut.api.installCraftPlaces();
    assert.deepEqual(plain(sut.api.craftPlaces().map((place) => [place.kind, place.x])), [["forja", 10], ["forja", 500], ["alquimia", 30]], "the coal bed of a smithery and a bed are no places");
    assert.ok(sut.state.logs.some((line) => /2 forja\(s\) e 1 mesa\(s\) de alquimia/.test(line)));
    assert.equal(sut.api.craftPlaceNear("forja", { x: 12, y: 12, z: 101 })?.x, 10);
    assert.equal(sut.api.craftPlaceNear("forja", { x: 12, y: 12, z: 120 }), null, "not from far above");
    assert.equal(sut.api.craftPlaceNear("alquimia", { x: 12, y: 12, z: 100 }), null);
    assert.deepEqual(plain(sut.api.craftPlacesWithin({ x: 20, y: 20 }, 20).map((place) => place.kind)), ["forja", "alquimia"]);
});

test("the exports load after the scripts start: the places are learnt when they are ready", () => {
    const worlds = [];
    const sut = load({ ready: false, worlds });
    sut.api.installCraftPlaces();
    assert.equal(sut.api.craftPlaces().length, 0);
    worlds.push({ props: [prop("objects/manmade/task_specific_props/alchemy/alchemy_table_master/alchemy_table_master.cgf", 1, 2)] });
    sut.state.once.get("worldResourcesReady")();
    assert.deepEqual(plain(sut.api.craftPlaces().map((place) => place.kind)), ["alquimia"]);
});
