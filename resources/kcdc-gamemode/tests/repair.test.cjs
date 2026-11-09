"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

// The grindstone as the smiths' repair bench (src/server/repair.ts, 2026-10-27): the weapons of the bag, three repairs for each, the mark on the weapon.

const SWORD = "11111111-0000-4000-8000-000000000001";
const AXE = "11111111-0000-4000-8000-000000000002";
const BOW = "11111111-0000-4000-8000-000000000003";
const BREAD = "11111111-0000-4000-8000-000000000004";

function load({ smith = true, near = true, rows } = {}) {
    const state = { emitted: [], chat: [], refusals: [], properties: [], customs: [], failProperties: false, failCustom: false, revision: 7 };
    const bag = rows ?? [
        { id: "r1", item: SWORD, name: "swordMilitary01", amount: 1, quality: 2, health: 40, condition: 0.4, equipped: 1, metadata: { quality: 2, health: 40, condition: 0.4 } },
        { id: "r2", item: AXE, name: "axeWork01", amount: 1, quality: 1, health: 30, condition: 0.6, equipped: 0, metadata: { quality: 1, health: 30, condition: 0.6, custom: { data: { repairs: 2, kept: "yes" } } } },
        { id: "r3", item: BOW, name: "bowHunter01", amount: 1, quality: 1, health: 10, condition: 0.2, equipped: 0, metadata: { quality: 1, health: 10, condition: 0.2 } },
        { id: "r4", item: BREAD, name: "bread", amount: 3, quality: 1, health: 100, condition: 1, equipped: 0, metadata: { quality: 1, health: 100, condition: 1 } },
    ];
    const context = {
        exports: {},
        require: (id) => ({
            "./big-emit.js": { emitLarge: (player, name, json) => { state.emitted.push({ name, view: JSON.parse(json) }); return 1; } },
            "./craft-titles.js": { craftTitle: (station) => (station === "reparo" ? "data:image/webp;base64,AAAA" : "") },
            "./craft.js": { levelOf: () => 9 },
            "./guild-crafts.js": { mayCraft: () => smith, showRefusal: (player, kind) => state.refusals.push(kind) },
            "./item-icons.js": { iconOf: (item) => `icon-${item.slice(-1)}` },
            "./item-names.js": { itemName: (row) => ({ [SWORD]: "Espada militar", [AXE]: "Machado de trabalho" })[row.item] ?? "item" },
            "./reach.js": { allowedTo: (edge) => 3 + edge, EDGE_M: { grindstone: 0.8 } },
            "./stations-data.js": { GRINDSTONES: [[100, 100, 10], [500, 500, 20]] },
        })[id] ?? assert.fail(`unexpected require ${id}`),
        console: { log() {} },
        Chat: { sendToPlayer: (player, text) => state.chat.push(text) },
        Inventory: {
            // `ready` is false from each change until the player's game shows it (`state.shown`), as the server's own is.
            get: () => ({ ready: (state.shown ?? state.revision) === state.revision, revision: state.revision, items: bag }),
            setProperties: (player, request) => {
                if (state.failProperties) return { ok: false, code: "revisionMismatch" };
                state.properties.push(request);
                const row = bag.find((each) => each.id === request.id);
                row.metadata = request.metadata;
                row.condition = request.metadata.condition;
                return { ok: true, code: "" };
            },
            updateCustom: (player, request) => {
                if (state.failCustom) return { ok: false, code: "invalid" };
                state.customs.push(request);
                const row = bag.find((each) => each.id === request.id);
                row.metadata = { ...row.metadata, custom: { ...(row.metadata.custom ?? {}), description: request.description, data: request.data } };
                return { ok: true, code: "" };
            },
        },
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/repair.js"), "utf8"), context);
    context.exports.useWeapons({ [SWORD]: "sword", [AXE]: "axe" });
    const player = { id: 1, nickname: "Hans", ready: true, alive: true, position: near ? { x: 101, y: 100, z: 10 } : { x: 300, y: 300, z: 10 }, emit: (event, payload) => state.emitted.push({ event, payload: JSON.parse(payload) }) };
    return { api: context.exports, state, player, bag };
}

test("the bench lists the swords, daggers, maces, axes and halberds in the bag, and nothing else: no bow, no bread", () => {
    const sut = load();
    const view = sut.api.repairView(sut.player);
    assert.equal(view.station, "reparo");
    assert.equal(view.title, "Reparo");
    assert.equal(view.verb, "Reparar");
    assert.equal(view.img, "data:image/webp;base64,AAAA", "the user's title picture");
    assert.deepEqual(view.recipes.map((row) => [row.id, row.cat]), [["reparo:r1", "Espadas"], ["reparo:r2", "Machados"]]);
    const sword = view.recipes[0];
    assert.equal(sword.t, "condição 40% · 0 de 3 reparos usados");
    assert.equal(sword.can, true);
    assert.deepEqual(JSON.parse(JSON.stringify(sword.badge)), ["ok", "Pronto"]);
    assert.deepEqual(JSON.parse(JSON.stringify(sword.ing)), []);
    assert.deepEqual(JSON.parse(JSON.stringify(view.items["reparo:r1"])), ["Espada militar", "icon-1"], "the name and the game's icon of the item");
    assert.equal(view.level, 9);
});

test("the list after a repair has the weapons, though the player's game has not caught up yet (2026-11-03, as the extraction's list)", () => {
    const sut = load();
    sut.state.shown = sut.state.revision - 1;
    assert.deepEqual(sut.api.repairView(sut.player).recipes.map((row) => row.id), ["reparo:r1", "reparo:r2"], "the bag is the server's, and it is right at once");
    assert.equal(sut.api.repair(sut.player, "reparo:r1").ok, true, "and a weapon may be repaired at once");
});

test("a repair brings the condition to the full, keeps what else the row had, and writes the count on the weapon with a description (2026-10-27)", () => {
    const sut = load();
    const outcome = sut.api.repair(sut.player, "reparo:r1");
    assert.equal(outcome.ok, true);
    assert.match(outcome.message, /Espada militar foi reparada \(1 de 3 reparos usados\)/);
    const set = sut.state.properties[0];
    assert.equal(set.id, "r1");
    assert.equal(set.revision, 7, "the revision read is the one passed");
    assert.equal(set.metadata.condition, 1);
    assert.equal(set.metadata.health, undefined, "not both condition and health");
    assert.equal(set.metadata.quality, 2, "and the quality is kept");
    assert.deepEqual(JSON.parse(JSON.stringify(sut.state.customs[0])), { id: "r1", description: "Reparada 1 de 3 vezes.", data: { repairs: 1 } });
    assert.equal(sut.api.repairsOf(sut.bag[0]), 1);
    assert.equal(sut.api.repair(sut.player, "reparo:r1").message, "Espada militar já está inteira.");
});

test("the third repair is the last: the weapon is marked 'sem material no objeto suficiente', the bench turns it down, and the page says so", () => {
    const sut = load();
    const outcome = sut.api.repair(sut.player, "reparo:r2");
    assert.equal(outcome.ok, true);
    assert.match(outcome.message, /Machado de trabalho foi reparada pela última vez: sem material no objeto suficiente para outro reparo/);
    assert.deepEqual(JSON.parse(JSON.stringify(sut.state.customs[0])), { id: "r2", description: "Sem material no objeto suficiente: não pode mais ser reparada.", data: { repairs: 3, kept: "yes" } }, "other custom data is carried over");

    sut.bag[1].condition = 0.3;
    sut.bag[1].metadata.condition = 0.3;
    const again = sut.api.repair(sut.player, "reparo:r2");
    assert.equal(again.ok, false);
    assert.match(again.message, /sem material no objeto suficiente/);
    assert.equal(sut.state.properties.length, 1, "nothing was written for the refused one");
    const row = sut.api.repairView(sut.player).recipes.find((each) => each.id === "reparo:r2");
    assert.equal(row.can, false);
    assert.deepEqual(JSON.parse(JSON.stringify(row.badge)), ["miss", "Sem material"]);
    assert.equal(row.t, "sem material no objeto suficiente");
});

test("only a smith, at a grindstone, with a weapon the bag still holds; a bow or bread is never mended", () => {
    const hunter = load({ smith: false });
    assert.equal(hunter.api.repair(hunter.player, "reparo:r1").ok, false);
    assert.deepEqual(hunter.state.refusals, ["smithing"]);
    assert.equal(hunter.api.openRepairPage(hunter.player), false, "and the page does not open for them");

    const far = load({ near: false });
    assert.match(far.api.repair(far.player, "reparo:r1").message, /junto da pedra de amolar/);

    const sut = load();
    assert.match(sut.api.repair(sut.player, "reparo:r3").message, /não está mais na sua bolsa/, "a bow");
    assert.match(sut.api.repair(sut.player, "reparo:r4").message, /não está mais na sua bolsa/, "bread");
    assert.match(sut.api.repair(sut.player, "reparo:nope").message, /não está mais na sua bolsa/);
    assert.equal(sut.api.repair(sut.player, "other:r1").message, "Escolha uma arma.");
    sut.player.alive = false;
    assert.match(sut.api.repair(sut.player, "reparo:r1").message, /não pode fazer isto/);
    assert.equal(sut.state.properties.length, 0);
});

test("when the game refuses the repair nothing is marked, and when it refuses the mark the repair still stands", () => {
    const refused = load();
    refused.state.failProperties = true;
    const outcome = refused.api.repair(refused.player, "reparo:r1");
    assert.equal(outcome.ok, false);
    assert.match(outcome.message, /O jogo não aceitou o reparo/);
    assert.equal(refused.state.customs.length, 0);

    const unmarked = load();
    unmarked.state.failCustom = true;
    assert.equal(unmarked.api.repair(unmarked.player, "reparo:r1").ok, true);
    assert.equal(unmarked.state.properties.length, 1);
});

test("the page is opened for a smith, kept while it is open, answered with the outcome and the bag as it is now, and let go when closed", () => {
    const sut = load();
    assert.equal(sut.api.openRepairPage(sut.player), true);
    assert.equal(sut.api.repairPageOpen(sut.player), true);
    assert.equal(sut.state.emitted.at(-1).name, "craft.view");
    sut.state.emitted.length = 0;
    sut.api.repairFromPage(sut.player, "reparo:r1");
    const result = sut.state.emitted.find((one) => one.event === "kcdc-gamemode:craft.result");
    assert.equal(result.payload.ok, true);
    const view = sut.state.emitted.find((one) => one.name === "craft.view").view;
    assert.equal(view.recipes.find((row) => row.id === "reparo:r1").t, "condição 100% · 1 de 3 reparos usados");
    assert.match(sut.state.chat.at(-1), /foi reparada/);

    sut.api.repairPageClosed(sut.player);
    assert.equal(sut.api.repairPageOpen(sut.player), false);
    sut.state.emitted.length = 0;
    sut.api.repairFromPage(sut.player, "reparo:r2");
    assert.equal(sut.state.emitted.some((one) => one.name === "craft.view"), false, "a page that is closed is not drawn again");
});

test("the grindstones: near enough to the foot of one, and the ones about a point for the client", () => {
    const sut = load();
    assert.equal(sut.api.grindstoneNear({ x: 101, y: 100, z: 10 }), true);
    assert.equal(sut.api.grindstoneNear({ x: 101, y: 100, z: 40 }), false, "not on another floor");
    assert.equal(sut.api.grindstoneNear({ x: 140, y: 100, z: 10 }), false);
    assert.deepEqual(Array.from(sut.api.grindstonesWithin({ x: 90, y: 90 }, 50), (stone) => Array.from(stone)), [[100, 100, 10]]);
});
