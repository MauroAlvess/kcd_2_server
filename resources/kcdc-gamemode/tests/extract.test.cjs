"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

// "Extrair" (src/server/extract.ts, 2026-10-27): a piece of the bag that the trade makes is broken for half of what its recipe took, with half of its condition left or more.

const SWORD = "11111111-0000-4000-8000-000000000001";
const TUNIC = "11111111-0000-4000-8000-000000000002";
const ARROW = "11111111-0000-4000-8000-000000000003";
const RING = "11111111-0000-4000-8000-000000000004";
const SWORD_VARIANT = "11111111-0000-4000-8000-000000000011";
const SWORD_CHEAP = "11111111-0000-4000-8000-000000000012";
const TUNIC_VARIANT = "11111111-0000-4000-8000-000000000013";
const GAUNTLET = "11111111-0000-4000-8000-000000000014";
const PADDED_COIF = "11111111-0000-4000-8000-000000000015";
const IRON = "22222222-0000-4000-8000-000000000001";
const STEEL = "22222222-0000-4000-8000-000000000002";
const LINEN = "22222222-0000-4000-8000-000000000003";
const SILVER = "22222222-0000-4000-8000-000000000004";
const CHARCOAL = "22222222-0000-4000-8000-000000000005";
const THREAD = "kcdc-craft:linha";
const THREAD_CLASS = "99999999-0000-4000-8000-000000000001";

const RECIPES = [
    { id: "forja:espada", station: "forja", category: "Espadas curtas", output: SWORD, amount: 1, ingredients: [[IRON, 5], [STEEL, 3], [THREAD, 1]], level: 4, xp: 10, seconds: 20 },
    { id: "forja:espada-cara", station: "forja", category: "Espadas curtas", output: SWORD, amount: 1, ingredients: [[IRON, 50]], level: 30, xp: 10, seconds: 20 },
    { id: "forja:flecha", station: "forja", category: "Flechas", output: ARROW, amount: 10, ingredients: [[IRON, 2]], level: 1, xp: 1, seconds: 5 },
    { id: "forja:anel", station: "forja", category: "Anéis", output: RING, amount: 1, ingredients: [[SILVER, 1]], level: 8, xp: 4, seconds: 10 },
    { id: "costura:tunica", station: "costura", category: "Túnicas lisas", output: TUNIC, amount: 1, ingredients: [[LINEN, 4], [THREAD, 7]], level: 1, xp: 3, seconds: 12 },
];

function load({ member = true, near = true, rows, addFails = null, removeFails = false, onAdd = null } = {}) {
    const state = { adds: [], removes: [], refusals: [], logs: [], revision: 3, nextRow: 100 };
    const bag = rows ?? [
        { id: "a", item: SWORD, name: "swordShort", amount: 1, quality: 2, equipped: 0, condition: 0.8, metadata: { condition: 0.8 } },
        { id: "b", item: SWORD, name: "swordShort", amount: 1, quality: 2, equipped: 0, condition: 0.3, metadata: { condition: 0.3 } },
        { id: "c", item: SWORD, name: "swordShort", amount: 1, quality: 2, equipped: 1, condition: 1, metadata: { condition: 1 } },
        { id: "d", item: TUNIC, name: "tunic", amount: 1, quality: 1, equipped: 0, condition: 0.5, metadata: { condition: 0.5 } },
        { id: "e", item: ARROW, name: "arrow", amount: 10, quality: 1, equipped: 0, condition: 1, metadata: {} },
        { id: "f", item: RING, name: "ring", amount: 1, quality: 1, equipped: 0, condition: 1, metadata: {} },
        { id: "g", item: "33333333-0000-4000-8000-000000000001", name: "bread", amount: 2, quality: 1, equipped: 0, condition: 1, metadata: {} },
    ];
    const context = {
        exports: {},
        require: (id) => ({
            "./craft-data.js": {
                CRAFT_RECIPES: RECIPES,
                // The other classes of a piece a recipe makes (with the share of its bill their price is worth) and the armour no recipe makes (2026-10-28).
                EXTRACT_ALIASES: { [SWORD_VARIANT]: [SWORD, 60], [SWORD_CHEAP]: [SWORD, 5], [TUNIC_VARIANT]: [TUNIC, 100] },
                EXTRACT_EXTRAS: [
                    [GAUNTLET, "forja", "Braços e manoplas", [[IRON, 4], [STEEL, 2], [LINEN, 1]]],
                    [PADDED_COIF, "costura", "Gibões e couraças de couro", [[LINEN, 3], [THREAD, 2]]],
                ],
                CRAFT_PRICES: { [IRON]: 48, [STEEL]: 50, [LINEN]: 85, [SILVER]: 300, [THREAD]: 20, [CHARCOAL]: 6 },
                CRAFT_ITEMS: {
                    [IRON]: ["Ferro", "icon-iron"], [STEEL]: ["Aço", "icon-steel"], [LINEN]: ["Linho", "icon-linen"], [SILVER]: ["Prata", "icon-silver"], [THREAD]: ["Linha de costura", "icon-thread"],
                    [SWORD]: ["Espada curta", "icon-sword"], [TUNIC]: ["Túnica lisa", "icon-tunic"],
                },
            },
            "./craft-items.js": { classOf: (item) => (item === THREAD ? THREAD_CLASS : item.toLowerCase()) },
            "./craft.js": {
                levelOf: () => 5,
                STATIONS: { forja: { title: "Forja", verb: "Forjar", track: "craftsmanship", craft: "smithing" }, costura: { title: "Costura", verb: "Costurar", track: "craftsmanship", craft: "costura" } },
            },
            "./guild-crafts.js": { mayCraft: () => member, showRefusal: (player, kind) => state.refusals.push(kind) },
            "./item-icons.js": { iconOf: (item) => `icon-of-${item.slice(-1)}` },
            "./item-names.js": { itemName: (row) => ({ [SWORD]: "Espada curta", [TUNIC]: "Túnica lisa" })[row.item] ?? "item" },
        })[id] ?? assert.fail(`unexpected require ${id}`),
        console: { log: (line) => state.logs.push(line) },
        Inventory: {
            get: () => ({ ready: true, revision: state.revision, items: bag }),
            add: (player, request) => {
                state.adds.push(request);
                onAdd?.(request, bag);
                if (addFails !== null && state.adds.length === addFails.at) {
                    return { ok: false, code: addFails.code, revision: 0, items: [] };
                }
                state.nextRow += 1;
                return { ok: true, code: "", revision: ++state.revision, items: [{ id: `new${state.nextRow}`, amount: request.amount }] };
            },
            remove: (player, request) => {
                state.removes.push(request);
                if (removeFails && request.revision !== undefined) {
                    return { ok: false, code: "staleRevision", revision: 0, items: [] };
                }
                for (const unit of request.units) {
                    const at = bag.findIndex((row) => row.id === unit.id);
                    if (at >= 0) {
                        bag.splice(at, 1);
                    }
                }
                return { ok: true, code: "", revision: ++state.revision, items: [] };
            },
        },
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/extract.js"), "utf8"), context);
    const player = { id: 1, nickname: "Hans", ready: true, alive: true, position: { x: 1, y: 1, z: 1 } };
    const nearCheck = () => near;
    return { api: context.exports, state, player, bag, nearCheck };
}

const plain = (value) => JSON.parse(JSON.stringify(value));

test("what comes back is half of the recipe, rounded down in all: the halves the rounding drops go to the dearest ingredients", () => {
    const sut = load();
    const sword = sut.api.recipeFor("forja", SWORD);
    assert.equal(sword.id, "forja:espada", "the first recipe that makes it, the lowest level");
    assert.deepEqual(plain(sut.api.returnsOf(sword)), [[IRON, 2], [STEEL, 2]], "5 -> 2, 3 -> 1, the single thread -> half a unit, and the three halves make one: the steel's, the dearest");
    const six = { ingredients: [[IRON, 1], [STEEL, 1], [LINEN, 1], [SILVER, 1], [THREAD, 1], [CHARCOAL, 1]] };
    assert.deepEqual(plain(sut.api.returnsOf(six)), [[STEEL, 1], [LINEN, 1], [SILVER, 1]], "six single pieces: the three dearest, in the recipe's order");
    assert.deepEqual(plain(sut.api.returnsOf({ ingredients: [[IRON, 1], [STEEL, 1]] })), [[STEEL, 1]], "two: the dearer");
    assert.deepEqual(plain(sut.api.returnsOf({ ingredients: [[IRON, 1]] })), [], "one piece gives nothing back");
    assert.deepEqual(plain(sut.api.returnsOf(sut.api.recipeFor("costura", TUNIC))), [[LINEN, 2], [THREAD, 3]]);
    assert.deepEqual(plain(sut.api.returnsOf(sut.api.recipeFor("forja", RING))), []);
    assert.equal(sut.api.recipeFor("forja", ARROW), undefined, "a recipe that makes ten at a time is not equipment");
    assert.equal(sut.api.recipeFor("costura", SWORD), undefined, "and each trade has only its own");
});

test("the tab lists the pieces of the trade in the bag and marks each one: ready, worn out, in use, nothing to give", () => {
    const sut = load();
    const view = sut.api.extractView(sut.player, "forja");
    assert.equal(view.mode, "extrair");
    assert.equal(view.verb, "Extrair");
    assert.deepEqual(plain(view.modes), [["fabricar", "Fabricar"], ["extrair", "Extrair"]]);
    assert.deepEqual(view.recipes.map((row) => row.id), ["extrair:a", "extrair:b", "extrair:c", "extrair:f"], "no tunic, no arrows, no bread");
    const [ready, spent, inUse, nothing] = view.recipes;
    assert.equal(ready.cat, "Espadas curtas");
    assert.equal(ready.can, true);
    assert.deepEqual(plain(ready.badge), ["ok", "Pronto"]);
    assert.equal(ready.t, "condição 80% · devolve 2 materiais");
    assert.deepEqual(plain(ready.ing), [[IRON, 2, 0], [STEEL, 2, 0]]);
    assert.deepEqual(plain(spent.badge), ["miss", "Gasto"]);
    assert.equal(spent.can, false);
    assert.match(spent.t, /condição 30% · só se extrai de 50% para cima/);
    assert.deepEqual(plain(inUse.badge), ["miss", "Em uso"]);
    assert.deepEqual(plain(nothing.badge), ["miss", "Nada"]);
    assert.deepEqual(plain(view.items["extrair:a"]), ["Espada curta", "icon-of-1"], "the name and the game's icon of the piece");
    assert.deepEqual(plain(view.items[IRON]), ["Ferro", "icon-iron"], "and those of what comes back");
    assert.equal(view.level, 5);
});

test("an extraction adds the materials, then takes the piece, and tells what came back (no XP, no chat of levels)", () => {
    const sut = load();
    const outcome = sut.api.extract(sut.player, "extrair:a", "forja", sut.nearCheck);
    assert.equal(outcome.ok, true);
    assert.equal(outcome.message, "Você extraiu Espada curta: voltaram 2x Ferro, 2x Aço.");
    assert.deepEqual(plain(sut.state.adds.map((add) => [add.item, add.amount, add.notify])), [[IRON, 2, false], [STEEL, 2, false]]);
    assert.equal(sut.state.removes.length, 1);
    assert.deepEqual(plain(sut.state.removes[0].units), [{ id: "a", amount: 1 }]);
    assert.equal(sut.state.removes[0].revision, 5, "the revision it read after the additions");
    assert.equal(sut.bag.some((row) => row.id === "a"), false, "the piece is gone");
    assert.ok(sut.state.logs.some((line) => /Hans extraiu Espada curta \(80%\): 2x Ferro, 2x Aço/.test(line)));
});

test("our own items come back as the class the game knows them by, and sewing is done anywhere", () => {
    const sut = load({ near: false });
    const outcome = sut.api.extract(sut.player, "extrair:d", "costura", sut.nearCheck);
    assert.equal(outcome.ok, true, "a condition of exactly half is enough");
    assert.deepEqual(plain(sut.state.adds.map((add) => [add.item, add.amount])), [[LINEN, 2], [THREAD_CLASS, 3]]);
});

test("a piece with less than half of its condition, one in use, one that gives nothing, or one that is not the trade's is turned down and nothing changes", () => {
    const sut = load();
    assert.match(sut.api.extract(sut.player, "extrair:b", "forja", sut.nearCheck).message, /gasto demais \(30%\).*50% de condição ou mais/);
    assert.match(sut.api.extract(sut.player, "extrair:c", "forja", sut.nearCheck).message, /em uso: tire-o antes/);
    assert.match(sut.api.extract(sut.player, "extrair:f", "forja", sut.nearCheck).message, /não rende material/);
    assert.match(sut.api.extract(sut.player, "extrair:e", "forja", sut.nearCheck).message, /não está mais na sua bolsa/, "arrows");
    assert.match(sut.api.extract(sut.player, "extrair:g", "forja", sut.nearCheck).message, /não está mais na sua bolsa/, "bread");
    assert.match(sut.api.extract(sut.player, "extrair:d", "forja", sut.nearCheck).message, /não está mais na sua bolsa/, "a tunic is not the forge's");
    assert.match(sut.api.extract(sut.player, "extrair:zz", "forja", sut.nearCheck).message, /não está mais na sua bolsa/);
    assert.equal(sut.api.extract(sut.player, "reparo:a", "forja", sut.nearCheck).message, "Escolha um equipamento.");
    assert.equal(sut.api.extract(sut.player, "extrair:a", "fogo", sut.nearCheck).message, "Escolha um equipamento.", "a station that has no tab");
    assert.equal(sut.state.adds.length, 0);
    assert.equal(sut.state.removes.length, 0);
});

test("only a member of the trade, alive, and at the forge for the forge's pieces", () => {
    const stranger = load({ member: false });
    assert.equal(stranger.api.extract(stranger.player, "extrair:a", "forja", stranger.nearCheck).ok, false);
    assert.deepEqual(stranger.state.refusals, ["smithing"]);

    const far = load({ near: false });
    assert.match(far.api.extract(far.player, "extrair:a", "forja", far.nearCheck).message, /junto da forja/);

    const dead = load();
    dead.player.alive = false;
    assert.match(dead.api.extract(dead.player, "extrair:a", "forja", dead.nearCheck).message, /não pode fazer isto/);
    assert.equal(dead.state.adds.length + far.state.adds.length + stranger.state.adds.length, 0);
});

test("when the bag has no room for every material, what was added is taken back and the piece stays", () => {
    const sut = load({ addFails: { at: 2, code: "inventoryCapacity" } });
    const outcome = sut.api.extract(sut.player, "extrair:a", "forja", sut.nearCheck);
    assert.equal(outcome.ok, false);
    assert.match(outcome.message, /não coube no seu inventário/);
    assert.equal(sut.state.removes.length, 1, "only the first addition is taken back");
    assert.deepEqual(plain(sut.state.removes[0].units), [{ id: "new101", amount: 2 }]);
    assert.equal(sut.bag.some((row) => row.id === "a"), true, "the piece is still there");
});

test("when the game turns a material down, or will not take the piece, nothing is kept: the materials go and the piece stays", () => {
    const refusedItem = load({ addFails: { at: 1, code: "unknownItem" } });
    const first = refusedItem.api.extract(refusedItem.player, "extrair:a", "forja", refusedItem.nearCheck);
    assert.match(first.message, /o jogo não aceitou o material/);
    assert.equal(refusedItem.state.removes.length, 0);

    const stale = load({ removeFails: true });
    const second = stale.api.extract(stale.player, "extrair:a", "forja", stale.nearCheck);
    assert.equal(second.ok, false);
    assert.match(second.message, /ficou com você/);
    assert.deepEqual(plain(stale.state.removes.slice(1).map((one) => one.units)), [[{ id: "new101", amount: 2 }], [{ id: "new102", amount: 2 }]], "both additions taken back");
    assert.equal(stale.bag.some((row) => row.id === "a"), true);
});

test("a piece worn in the middle of it (the bag changed under the call) is not taken: the materials are", () => {
    const sut = load({ onAdd: (request, bag) => { bag.find((row) => row.id === "a").equipped = 1; } });
    const outcome = sut.api.extract(sut.player, "extrair:a", "forja", sut.nearCheck);
    assert.equal(outcome.ok, false);
    assert.match(outcome.message, /mudou no meio do caminho/);
    assert.equal(sut.state.removes.length, 2, "both additions taken back, the piece never asked for");
    assert.ok(sut.state.removes.every((one) => one.units.every((unit) => unit.id.startsWith("new"))));
});

test("every class of a piece the trade makes is taken apart as that piece, for the share of its bill its own price is worth (2026-10-28: only what the player made could be broken)", () => {
    const sut = load();
    const variant = sut.api.recipeFor("forja", SWORD_VARIANT);
    assert.ok(variant, "a sword of another class, as the sword the recipe makes");
    assert.equal(variant.category, "Espadas curtas", "listed under the same category");
    assert.deepEqual(plain(variant.ingredients), [[IRON, 3], [STEEL, 2], [THREAD, 1]], "60% of 5, 3 and 1, rounded");
    assert.deepEqual(plain(sut.api.returnsOf(variant)), [[IRON, 2], [STEEL, 1]], "and half of it comes back, three of six units: 1 iron, 1 steel and half a thread, and the two halves that were dropped make one more unit of the dearest of them (the iron)");
    assert.equal(sut.api.recipeFor("forja", SWORD_VARIANT), variant, "made once, not at every look");
    const cheap = sut.api.recipeFor("forja", SWORD_CHEAP);
    assert.deepEqual(plain(cheap.ingredients), [], "5% of the bill is nothing: a piece worth a twentieth of the dearest gives nothing back");
    assert.deepEqual(plain(sut.api.returnsOf(cheap)), []);
    assert.equal(sut.api.recipeFor("forja", SWORD_VARIANT.toUpperCase()), variant, "the class is read in any case");
    assert.equal(sut.api.recipeFor("costura", SWORD_VARIANT), undefined, "the trade that makes the piece takes it apart, the other does not");
    assert.equal(sut.api.recipeFor("costura", TUNIC_VARIANT), sut.api.recipeFor("costura", TUNIC), "a variant worth the whole price is the recipe itself");
});

test("armour no recipe makes has a bill of its own, at the trade that works its material", () => {
    const sut = load();
    const gauntlet = sut.api.recipeFor("forja", GAUNTLET);
    assert.equal(gauntlet.category, "Braços e manoplas");
    assert.deepEqual(plain(sut.api.returnsOf(gauntlet)), [[IRON, 2], [STEEL, 1]], "half of 4, 2 and 1: the half of the linen is not a unit");
    assert.equal(sut.api.recipeFor("costura", GAUNTLET), undefined, "a gauntlet is the forge's");
    assert.deepEqual(plain(sut.api.returnsOf(sut.api.recipeFor("costura", PADDED_COIF))), [[LINEN, 1], [THREAD, 1]]);
    assert.equal(sut.api.recipeFor("forja", PADDED_COIF), undefined);
});

test("the tab lists those pieces too, and takes one apart: a piece found or bought, not only the one the player made", () => {
    const rows = [
        { id: "v", item: SWORD_VARIANT, name: "swordOther", amount: 1, quality: 2, equipped: 0, condition: 0.9, metadata: { condition: 0.9 } },
        { id: "g", item: GAUNTLET, name: "gauntlets", amount: 1, quality: 1, equipped: 0, condition: 1, metadata: {} },
        { id: "h", item: PADDED_COIF, name: "coif", amount: 1, quality: 1, equipped: 0, condition: 1, metadata: {} },
        { id: "c", item: SWORD_CHEAP, name: "swordCheap", amount: 1, quality: 1, equipped: 0, condition: 1, metadata: {} },
    ];
    const sut = load({ rows });
    const forge = sut.api.extractView(sut.player, "forja");
    assert.deepEqual(forge.recipes.map((row) => row.id), ["extrair:v", "extrair:g", "extrair:c"], "the coif is for sewing");
    assert.deepEqual(plain(forge.recipes[0].badge), ["ok", "Pronto"]);
    assert.equal(forge.recipes[1].cat, "Braços e manoplas");
    assert.deepEqual(plain(forge.recipes[2].badge), ["miss", "Nada"], "the cheap one gives nothing");
    assert.deepEqual(sut.api.extractView(sut.player, "costura").recipes.map((row) => row.id), ["extrair:h"]);

    const outcome = sut.api.extract(sut.player, "extrair:v", "forja", sut.nearCheck);
    assert.equal(outcome.ok, true);
    assert.deepEqual(plain(sut.state.adds.map((add) => [add.item, add.amount])), [[IRON, 2], [STEEL, 1]]);
    assert.equal(sut.bag.some((row) => row.id === "v"), false);
    assert.match(sut.api.extract(sut.player, "extrair:c", "forja", sut.nearCheck).message, /não rende material/);
});
