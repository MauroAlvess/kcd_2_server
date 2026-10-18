"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

function load({ guilds = {}, admins = [] } = {}) {
    const handlers = new Map();
    const chat = [];
    const properties = [];
    const clock = { now: 1_000_000 };
    const sandbox = {
        exports: {},
        require: (id) => ({
            "./auth.js": { isAdmin: (player) => admins.includes(player.steamId) },
            "./status.js": { getGuildId: (steamId) => guilds[steamId] ?? null },
        })[id] ?? assert.fail(`unexpected require ${id}`),
        Events: { on: (name, fn) => handlers.set(name, fn) },
        Chat: { sendToPlayer: (player, text) => chat.push([player.id, text]) },
        Inventory: { setProperties: (player, request) => { properties.push([player.id, request]); return { ok: true, code: "" }; } },
        Date: { now: () => clock.now },
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/guild-crafts.js"), "utf8"), sandbox);
    sandbox.exports.installGuildCrafts();
    return { api: sandbox.exports, handlers, chat, clock, properties };
}

const body = (id, steamId) => ({ id, steamId });

test("each trade owns its place: the forge, the alchemy tables, the fire, and the rack and the smoker", () => {
    const { api } = load();
    assert.deepEqual(JSON.parse(JSON.stringify(api.CRAFT_GUILD)), { smithing: "fabri-ferrarii", alchemy: "alchemistae", fogo: "tabernarii", secador: "venatores", defumador: "venatores" });
});

test("only a member of the trade's guild, or an administrator, may use its place", () => {
    const { api } = load({ guilds: { smith: "fabri-ferrarii", hunter: "venatores", host: "tabernarii", brewer: "alchemistae", tailor: "artifices" }, admins: ["boss"] });
    assert.equal(api.mayCraft(body(1, "smith"), "smithing"), true);
    assert.equal(api.mayCraft(body(1, "smith"), "alchemy"), false);
    assert.equal(api.mayCraft(body(2, "hunter"), "defumador"), true);
    assert.equal(api.mayCraft(body(2, "hunter"), "secador"), true);
    assert.equal(api.mayCraft(body(2, "hunter"), "fogo"), false);
    assert.equal(api.mayCraft(body(3, "host"), "fogo"), true);
    assert.equal(api.mayCraft(body(3, "host"), "defumador"), false);
    assert.equal(api.mayCraft(body(4, "brewer"), "alchemy"), true);
    assert.equal(api.mayCraft(body(5, "tailor"), "smithing"), false, "tailors have nothing here");
    assert.equal(api.mayCraft(body(6, "nobody"), "fogo"), false, "no guild");
    assert.equal(api.mayCraft(body(7, ""), "fogo"), false, "no Steam id");
    for (const craft of ["smithing", "alchemy", "fogo", "secador", "defumador"]) assert.equal(api.mayCraft(body(8, "boss"), craft), true);
});

test("the refusal says whose place it is and where to choose the guild", () => {
    const { api } = load();
    assert.match(api.refusal("smithing"), /Só os ferreiros \(guilda Fabri Ferrarii\) usam a forja\./);
    assert.match(api.refusal("alchemy"), /alquimistas.*mesas de alquimia/);
    assert.match(api.refusal("fogo"), /taberneiros.*fogo de cozinha/);
    assert.match(api.refusal("defumador"), /caçadores.*defumador/);
    assert.match(api.refusal("smithing"), /F2/);
});

test("a smithery or an alchemy table is refused to whoever is not of the trade, with a word, said once every ten seconds", () => {
    const { handlers, chat, clock } = load({ guilds: { smith: "fabri-ferrarii", brewer: "alchemistae" } });
    const starting = handlers.get("craftingStarting");
    const smith = body(1, "smith");
    const brewer = body(2, "brewer");

    assert.equal(starting(smith, { kind: "smithing" }), undefined, "the smith forges");
    assert.equal(starting(brewer, { kind: "alchemy" }), undefined, "the alchemist brews");
    assert.deepEqual(chat, []);

    assert.equal(starting(smith, { kind: "alchemy" }), false);
    assert.equal(chat.length, 1);
    assert.match(chat[0][1], /alquimistas/);
    assert.equal(starting(smith, { kind: "alchemy" }), false);
    assert.equal(chat.length, 1, "not told again at once");
    clock.now += 11_000;
    assert.equal(starting(smith, { kind: "alchemy" }), false);
    assert.equal(chat.length, 2);

    assert.equal(starting(smith, { kind: "repair" }), undefined, "a kind that is nobody's is left alone");
    assert.equal(starting(smith, {}), undefined);
});

test("sharpening at the grindstone, which the game does on its own, is undone for whoever is not a smith", () => {
    const { handlers, chat, properties } = load({ guilds: { smith: "fabri-ferrarii", hunter: "venatores" }, admins: ["boss"] });
    const changed = handlers.get("playerInventoryChanged");
    const sharpen = {
        reason: "sharpen",
        items: [
            { id: "blade", before: { health: 40, condition: 0.4, metadata: { quality: 2, condition: 0.4 } }, after: { health: 90, condition: 0.9, metadata: { quality: 2, condition: 0.9 } } },
            { id: "gone", before: null, after: { health: 10, metadata: {} } },
            { id: "same", before: { health: 50, metadata: {} }, after: { health: 50, metadata: {} } },
        ],
    };

    changed(body(1, "smith"), sharpen);
    changed(body(9, "boss"), sharpen);
    assert.deepEqual(properties, [], "a smith, and an administrator, sharpen as they like");

    changed(body(2, "hunter"), sharpen);
    assert.equal(properties.length, 1, "only the blade that got better is put back");
    assert.deepEqual(JSON.parse(JSON.stringify(properties[0])), [2, { id: "blade", metadata: { quality: 2, health: 40 } }], "its old health, and not the contradicting condition");
    assert.match(chat[0][1], /pedra de amolar.*desfeita/);

    changed(body(2, "hunter"), { ...sharpen, reason: "repair" });
    assert.equal(properties.length, 1, "a repair kit is nobody's trade");
});
