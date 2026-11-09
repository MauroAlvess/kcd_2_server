"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

// Seeds from the plants picked in the wild (src/server/wild-seeds.ts, 2026-10-30: "ao coletar plantas deve vir sementes também, senão o agricultor nunca vai plantar").

const dist = (name) => fs.readFileSync(path.join(__dirname, "../dist/server", name), "utf8");
const dataBox = { exports: {} };
vm.runInNewContext(dist("craft-data.js"), dataBox);
const { FARM_CROPS } = dataBox.exports;
const NETTLE = FARM_CROPS.find((crop) => crop.id === "urtiga");
const ONION = FARM_CROPS.find((crop) => crop.id === "cebola");

function load() {
    const state = { handlers: new Map(), added: [], logs: [], refuse: false, registered: new Map([[NETTLE.seed, "guid-of-nettle-seed"]]) };
    const context = {
        exports: {},
        require: (id) =>
            ({
                "./craft-data.js": dataBox.exports,
                "./craft-items.js": { craftItemGuid: (item) => state.registered.get(item) ?? null },
            })[id] ?? assert.fail(`unexpected require ${id}`),
        console: { log: (line) => state.logs.push(line) },
        Events: { on: (name, fn) => state.handlers.set(name, fn) },
        Inventory: {
            add: (player, request) => {
                state.added.push([player.nickname, request.item, request.amount]);
                return state.refuse ? { ok: false, code: "full" } : { ok: true, code: "" };
            },
        },
        Math,
        Map,
    };
    vm.runInNewContext(dist("wild-seeds.js"), context);
    return { api: context.exports, state };
}

test("a plant a garden grows brings a seed of it, one, or two from a good pick; one no garden grows brings none", () => {
    const { api } = load();
    assert.deepEqual({ ...api.seedsFor(NETTLE.harvest, 2, 0.1) }, { seed: NETTLE.seed, name: "Urtiga", amount: 1 });
    assert.equal(api.seedsFor(NETTLE.harvest, api.wildSeedSettings.goodPick, 0.1).amount, 2);
    assert.equal(api.seedsFor(NETTLE.harvest.toUpperCase(), 2, 0.1).seed, NETTLE.seed, "a class GUID in either case");
    assert.equal(api.seedsFor(NETTLE.harvest, 2, 0.6), null, "the roll says none");
    assert.equal(api.seedsFor(NETTLE.harvest, 2, 0.99), null);
    assert.equal(api.seedsFor("00000000-0000-0000-0000-000000000000", 3, 0), null);
    assert.ok(FARM_CROPS.every((crop) => api.seedsFor(crop.harvest, 1, 0) !== null), "every crop of the gardens gives its seed");
});

test("a harvest in the wild hands the seed over, under the GUID ours is registered with when it has one; a refusal is logged and nothing more", () => {
    const { api, state } = load();
    api.installWildSeeds(() => 0.2);
    assert.ok(state.logs.some((line) => /plantas das hortas dão semente/.test(line)));
    const harvested = state.handlers.get("gatheringHarvested");
    harvested({ nickname: "Hans" }, { item: NETTLE.harvest, amount: 3, kind: 1, position: [0, 0, 0], virtualWorld: 0 });
    harvested({ nickname: "Hans" }, { item: ONION.harvest, amount: 5, kind: 1, position: [0, 0, 0], virtualWorld: 0 });
    harvested({ nickname: "Hans" }, { item: "not-a-crop", amount: 5, kind: 1, position: [0, 0, 0], virtualWorld: 0 });
    assert.deepEqual(state.added, [["Hans", "guid-of-nettle-seed", 1], ["Hans", ONION.seed, 2]]);
    assert.ok(state.logs.some((line) => /Hans colheu not-a-crop \(5\), que nenhuma horta cultiva/.test(line)), "an unknown plant is told once");

    state.refuse = true;
    harvested({ nickname: "Jan" }, { item: NETTLE.harvest, amount: 1, kind: 1, position: [0, 0, 0], virtualWorld: 0 });
    assert.ok(state.logs.some((line) => /Jan: a semente de Urtiga não foi entregue \(full\)/.test(line)));

    const none = load();
    none.api.installWildSeeds(() => 0.9);
    none.state.handlers.get("gatheringHarvested")({ nickname: "Eva" }, { item: NETTLE.harvest, amount: 9, kind: 1, position: [0, 0, 0], virtualWorld: 0 });
    assert.deepEqual(none.state.added, []);
});
