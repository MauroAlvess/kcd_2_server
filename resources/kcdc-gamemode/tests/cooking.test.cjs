const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// Cooking, drying and smoking by the places the level makes them at (src/server/cooking.ts): the raw taken, the made handed over.

const itemUses = (() => {
    const context = { exports: {} };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/item-uses.js"), "utf8"), context);
    return context.exports;
})();

function load({ refuse = new Set(), removeOk = true } = {}) {
    const state = { rows: [], revision: 7, removed: null, added: [], logs: [], chat: [], handlers: new Map(), client: new Map(), emitted: [] };
    const context = {
        exports: {},
        require: (id) => {
            if (id === "./cooking-data.js") {
                return {
                    COOKED: { "raw-deer": "cooked-deer", "raw-egg": "cooked-egg" },
                    DRIED: { "raw-deer": "dried-deer" },
                    SMOKED: { "raw-deer": "smoked-deer", "raw-fish": "smoked-fish" },
                    MEATS: ["raw-deer", "raw-fish"],
                };
            }
            if (id === "./stations-data.js") return { STATIONS: [["fogo", 10, 10, 100], ["secador", 200, 200, 50], ["defumador", 300, 300, 50]] };
            if (id === "./item-uses.js") return itemUses;
            if (id === "./item-names.js") return { itemLine: (row) => `${row.amount}x ${row.item}` };
            if (id === "./guild-crafts.js") return { mayCraft: (player, kind) => player.crafts === undefined || player.crafts.includes(kind), refusal: (kind) => `não é para você: ${kind}` };
            if (id === "./vendors.js") return { CAMPS: [{ place: "estrada", fire: { x: 1000, y: 1000, z: 50 } }] };
            assert.fail(`unexpected require ${id}`);
        },
        console: { log: (line) => state.logs.push(line) },
        Math,
        Chat: { sendToPlayer: (player, text) => state.chat.push(text) },
        Events: {
            on: (name, fn) => state.handlers.set(name, fn),
            onClient: (name, fn) => state.client.set(name, fn),
        },
        CookPot: { all: () => [{ guid: "pot", position: { x: 60, y: 60, z: 70 } }] },
        Inventory: {
            get: () => ({ revision: state.revision, items: state.rows }),
            remove: (player, request) => {
                state.removed = JSON.parse(JSON.stringify(request));
                return { ok: removeOk };
            },
            add: (player, request) => {
                state.added.push(JSON.parse(JSON.stringify(request)));
                return { ok: !refuse.has(request.item) };
            },
        },
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/cooking.js"), "utf8"), context);
    const player = (x, y, z) => ({ nickname: "Hans", alive: true, position: { x, y, z }, emit: (event, payload) => state.emitted.push({ event, payload: JSON.parse(payload) }) });
    return { api: context.exports, state, player };
}

test("at a fire every raw food carried becomes the cooked one, as many as there were; the rest stays", () => {
    const sut = load();
    sut.state.rows = [
        { id: "r1", item: "raw-deer", amount: 3 },
        { id: "r2", item: "bread", amount: 2 },
        { id: "r3", item: "raw-egg", amount: 1 },
    ];
    const said = sut.api.cook(sut.player(12, 11, 100.5));
    assert.deepEqual(sut.state.removed, { units: [{ id: "r1", amount: 3 }, { id: "r3", amount: 1 }], revision: 7 });
    assert.deepEqual(sut.state.added, [{ item: "cooked-deer", amount: 3 }, { item: "cooked-egg", amount: 1 }]);
    assert.equal(said, "Você cozinhou no local: 3x cooked-deer, 1x cooked-egg.");
    assert.ok(sut.state.logs.some((line) => line === "cooking: Hans cozinhou 3x cooked-deer, 1x cooked-egg"));
});

test("a butcher's rack dries, a smokehouse smokes, each only what is its own; a stew pot and a roadside camp are fires", () => {
    const rack = load();
    rack.state.rows = [{ id: "r1", item: "raw-deer", amount: 2 }, { id: "r3", item: "raw-egg", amount: 1 }, { id: "r4", item: "raw-fish", amount: 3 }];
    assert.equal(rack.api.cook(rack.player(201, 200, 50)), "Você secou no local: 2x dried-deer.");
    assert.deepEqual(rack.state.removed, { units: [{ id: "r1", amount: 2 }], revision: 7 });

    const house = load();
    house.state.rows = [{ id: "r1", item: "raw-deer", amount: 2 }, { id: "r3", item: "raw-egg", amount: 1 }, { id: "r4", item: "raw-fish", amount: 3 }];
    assert.equal(house.api.cook(house.player(300, 302, 51)), "Você defumou no local: 2x smoked-deer, 3x smoked-fish.");

    const pot = load();
    pot.state.rows = [{ id: "r1", item: "raw-deer", amount: 1 }];
    assert.match(pot.api.cook(pot.player(60, 61, 70)), /^Você cozinhou/);
    const camp = load();
    camp.state.rows = [{ id: "r1", item: "raw-deer", amount: 1 }];
    assert.match(camp.api.cook(camp.player(1002, 1001, 50)), /^Você cozinhou/);
});

test("away from every place, or a floor above, nothing is taken; at a place that makes nothing of what is carried, nothing is taken either", () => {
    const sut = load();
    sut.state.rows = [{ id: "r1", item: "raw-deer", amount: 1 }];
    assert.match(sut.api.cook(sut.player(30, 10, 100)), /Não há fogo, secador nem defumador aqui perto/);
    assert.match(sut.api.cook(sut.player(10, 10, 106)), /Não há fogo, secador nem defumador aqui perto/);
    assert.equal(sut.state.removed, null);

    sut.state.rows = [{ id: "r2", item: "bread", amount: 2 }, { id: "r3", item: "raw-egg", amount: 1 }];
    assert.match(sut.api.cook(sut.player(200, 200, 50)), /Você não leva nada que se possa fazer aqui/, "an egg is cooked, not dried");
    assert.equal(sut.state.removed, null);
});

test("the inventory's Usar on one row does that row only, and says so when the place cannot", () => {
    const sut = load();
    sut.state.rows = [{ id: "r1", item: "raw-deer", amount: 2 }, { id: "r4", item: "raw-fish", amount: 3 }];
    assert.equal(sut.api.cook(sut.player(10, 10, 100), "r1"), "Você cozinhou no local: 2x cooked-deer.");
    assert.deepEqual(sut.state.removed, { units: [{ id: "r1", amount: 2 }], revision: 7 });
    assert.match(sut.api.cook(sut.player(10, 10, 100), "r4"), /Isto não se faz aqui/, "this fish has no cooked form in the test's table");
    assert.match(sut.api.cook(sut.player(10, 10, 100), "nobody"), /Isto não se faz aqui/);
});

test("nothing is lost: a refused take makes nothing, and what cannot be added goes back as it was", () => {
    const stale = load({ removeOk: false });
    stale.state.rows = [{ id: "r1", item: "raw-deer", amount: 1 }];
    assert.match(stale.api.cook(stale.player(10, 10, 100)), /Não consegui fazer isso/);
    assert.deepEqual(stale.state.added, []);

    const full = load({ refuse: new Set(["cooked-egg"]) });
    full.state.rows = [{ id: "r1", item: "raw-deer", amount: 2 }, { id: "r3", item: "raw-egg", amount: 4, metadata: { quality: 1 } }];
    assert.equal(full.api.cook(full.player(10, 10, 100)), "Você cozinhou no local: 2x cooked-deer. Parte não coube e ficou como estava.");
    assert.deepEqual(full.state.added.at(-1), { item: "raw-egg", amount: 4, metadata: { quality: 1 }, notify: false });
});

test("installed, each player who arrives is told which items the server takes over, and the client's use is answered in the chat and on the notification line", () => {
    const sut = load();
    sut.api.installCooking();
    const player = sut.player(10, 10, 100);
    sut.state.handlers.get("playerReady")(player);
    assert.deepEqual(sut.state.emitted.map((entry) => entry.payload), [{ use: "cook.use", items: ["raw-deer", "raw-fish"] }]);
    assert.equal(sut.state.emitted[0].event, "kcdc-gamemode:itemuses");

    sut.state.rows = [{ id: "r1", item: "raw-deer", amount: 1 }];
    sut.state.client.get("kcdc-gamemode:cook.use")(player, JSON.stringify({ item: "raw-deer", id: "r1", revision: 7 }));
    assert.deepEqual(sut.state.chat, ["Você cozinhou no local: 1x cooked-deer."]);
    assert.deepEqual(sut.state.emitted.at(-1), { event: "kcdc-gamemode:notify", payload: { text: "Você cozinhou no local: 1x cooked-deer." } });

    sut.state.client.get("kcdc-gamemode:cook.use")(player, "not json");
    sut.state.client.get("kcdc-gamemode:cook.use")(player, JSON.stringify({ id: 5 }));
    sut.state.client.get("kcdc-gamemode:cook.use")({ ...player, alive: false }, JSON.stringify({ id: "r1" }));
    assert.equal(sut.state.chat.length, 1, "nothing for a bad ask or a dead body");
});

test("each place is its trade's: a player of another guild is refused and nothing is taken or made; one who may use the smoker does not get the fire", () => {
    const sut = load();
    sut.state.rows = [{ id: "r1", item: "raw-deer", amount: 3 }];
    const stranger = { ...sut.player(12, 11, 100.5), crafts: [] };
    assert.equal(sut.api.cook(stranger), "não é para você: fogo");
    assert.equal(sut.state.removed, null);
    assert.deepEqual(sut.state.added, []);

    const hunter = { ...sut.player(12, 11, 100.5), crafts: ["secador", "defumador"] };
    assert.equal(sut.api.cook(hunter), "não é para você: fogo", "the fire is the innkeepers'");
    const atRack = { ...sut.player(201, 200, 50.5), crafts: ["secador", "defumador"] };
    assert.match(sut.api.cook(atRack), /secou/);
});
