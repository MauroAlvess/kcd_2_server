"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
require("./reachpatch.cjs");

// What the smith makes for the Coletores and of what they bring (2026-10-21, tools/make-craft-recipes.py): their tools ("a picareta deve virar
// ferramenta do ferreiro"), charcoal from their wood, and the silver of their rocks.

const context = { exports: {}, require: () => assert.fail("craft-data requires nothing") };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/craft-data.js"), "utf8"), context);
const { CRAFT_RECIPES, CRAFT_ITEMS, CUSTOM_ITEMS } = context.exports;
const plain = (value) => JSON.parse(JSON.stringify(value));
const byId = new Map(CRAFT_RECIPES.map((recipe) => [recipe.id, recipe]));
const nameOf = (item) => CRAFT_ITEMS[item][0];
const LENHA = "kcdc-craft:lenha";
const SILVER_BAR = "kcdc-craft:barra-prata";

test("the Coletores' finds are items of our own, each looking like one of the game's", () => {
    for (const id of [LENHA, "kcdc-craft:minerio-prata", "kcdc-craft:barra-prata", "kcdc-craft:lasca"]) {
        const [name, description, visual, weight, price] = CUSTOM_ITEMS[id];
        assert.ok(name && description, id);
        assert.match(visual, /^[0-9a-f-]{36}$/, `${id} borrows a game item's look`);
        assert.ok(weight > 0 && weight <= 1 && price >= 1, id);
    }
    assert.ok(CUSTOM_ITEMS["kcdc-craft:barra-prata"][4] > CUSTOM_ITEMS["kcdc-craft:minerio-prata"][4], "a bar is worth more than the ore");
    assert.equal(CUSTOM_ITEMS["kcdc-craft:lasca"][4], 1, "a chip of stone is worth nothing");
});

test("the smith makes the Coletores' tools, each with a wooden haft: the lumberjack's axe at the second level, the pick at the sixth", () => {
    const axe = byId.get("forja:r_axework01");
    const pick = byId.get("forja:r_axebattle03");
    assert.equal(axe.category, "Ferramentas");
    assert.equal(pick.category, "Ferramentas");
    assert.equal(axe.level, 2);
    assert.equal(pick.level, 6, "the knight's pick of the game's table was the twelfth");
    assert.equal(nameOf(pick.output), "Picareta do cavaleiro");
    assert.ok(axe.ingredients.some(([item, n]) => item === LENHA && n === 1));
    assert.ok(pick.ingredients.some(([item, n]) => item === LENHA && n === 2));
});

test("wood becomes the forge's charcoal, and the silver ore a bar and then the game's silver, up the levels", () => {
    const charcoal = byId.get("forja:carvao");
    assert.deepEqual(plain(charcoal.ingredients), [[LENHA, 2]]);
    assert.equal(charcoal.amount, 3);
    assert.equal(nameOf(charcoal.output), "Carvão");
    const bar = byId.get("forja:prata-barra");
    assert.equal(bar.output, "kcdc-craft:barra-prata");
    assert.ok(bar.ingredients.some(([item, n]) => item === "kcdc-craft:minerio-prata" && n === 1));
    const silver = CRAFT_RECIPES.filter((recipe) => recipe.station === "forja" && recipe.category === "Prata" && recipe.id !== "forja:prata-barra");
    assert.deepEqual(plain(silver.map((recipe) => nameOf(recipe.output))), ["Taça de prata", "Cálice de prata"], "the cup and the chalice: the rings and the brooch are the artisan's since 2026-10-22");
    assert.ok(silver.every((recipe) => recipe.ingredients.some(([item]) => item === "kcdc-craft:barra-prata") && recipe.level > bar.level));
});

test("everything the rocks and trees give is an item the server knows", () => {
    const gather = { exports: {} };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/gather.js"), "utf8"), {
        exports: gather.exports,
        require: () => ({}),
    });
    const ours = [gather.exports.LOG, gather.exports.SILVER_ORE, ...gather.exports.ROCK_FINDS.map((find) => find.item)].filter((item) => item.startsWith("kcdc-craft:"));
    for (const item of ours) assert.ok(CUSTOM_ITEMS[item], item);
});

test("the artisan makes the game's tailor's and cobbler's repair kits, for clothes and for shoes (2026-10-21)", () => {
    const kits = CRAFT_RECIPES.filter((recipe) => recipe.station === "costura" && recipe.category === "Kits de reparo");
    assert.deepEqual(plain(kits.map((recipe) => nameOf(recipe.output)).sort()), ["Kit de alfaiate", "Kit de sapateiro"]);
    assert.ok(kits.every((recipe) => recipe.level <= 3 && recipe.ingredients.some(([item]) => item === "kcdc-craft:linha")), "early, and sewn with thread");
});

test("the artisan makes the game's rings, necklaces and brooches of silver, copper, jasper, enamel and thread; nothing of gold, garnets or pearls (2026-10-22)", () => {
    const jewels = CRAFT_RECIPES.filter((recipe) => recipe.station === "costura" && (recipe.category === "Anéis" || recipe.category === "Colares e broches"));
    const rings = jewels.filter((recipe) => recipe.category === "Anéis").map((recipe) => nameOf(recipe.output));
    assert.deepEqual(plain(rings).sort(), ["Anel de pedra preciosa", "Anel de pedras preciosas", "Anel de prata com pedra preciosa", "Anel de prata gravado"]);
    assert.ok(jewels.length >= 14, "rings, necklaces and brooches");
    const names = jewels.map((recipe) => nameOf(recipe.output));
    assert.ok(names.includes("Broche de prata esmaltado") && names.includes("Cruz de estanho") && names.includes("Escapulário de santo"));
    assert.ok(!names.some((name) => /dourad|ouro|pérola|granate/i.test(name.replace("Cruz prateada com granate", ""))), "no gold, pearls or garnets of the game's");
    // Made of what the game sells or the Coletores bring: the silver bar, copper, jasper, enamel, hardware, thread, linen.
    const allowed = new Set([SILVER_BAR, "kcdc-craft:linha"]);
    for (const recipe of jewels) {
        assert.ok(recipe.ingredients.length >= 1 && recipe.ingredients.every(([item, n]) => n >= 1 && (allowed.has(item) || CRAFT_ITEMS[item] !== undefined)), recipe.id);
        assert.ok(recipe.level >= 2 && recipe.level <= 19, `${recipe.id}: ${recipe.level}`);
    }
    const bar = byId.get("forja:prata-barra");
    assert.ok(jewels.filter((recipe) => recipe.ingredients.some(([item]) => item === SILVER_BAR)).every((recipe) => recipe.level > bar.level), "silver work comes after the bar");
    assert.ok(!CRAFT_RECIPES.some((recipe) => recipe.station === "forja" && /Anel|Broche/.test(nameOf(recipe.output))), "the forge no longer makes them");
});
