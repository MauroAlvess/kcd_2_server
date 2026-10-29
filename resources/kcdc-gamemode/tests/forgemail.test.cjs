"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

// The forge makes coats of mail, collars and mail coifs (2026-10-21, the user: "aproveite e adicione para o ferreiro cotas de malha"). The game's
// sound for them is `armor_chainmail`, which the first selection never matched, so none had ever been forged.

const context = { exports: {}, require: () => assert.fail("craft-data requires nothing") };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/craft-data.js"), "utf8"), context);
const { CRAFT_RECIPES, CRAFT_ITEMS } = context.exports;
const plain = (value) => JSON.parse(JSON.stringify(value));
const nameOf = (recipe) => CRAFT_ITEMS[recipe.output][0];
const forge = CRAFT_RECIPES.filter((recipe) => recipe.station === "forja");

test("the smith forges the four coats of mail of the game, from the eighth level to the sixteenth, the dearer with the better metal", () => {
    const coats = forge.filter((recipe) => /^Cota de malha/.test(nameOf(recipe)));
    assert.deepEqual(plain(coats.map(nameOf).sort()), ["Cota de malha curta", "Cota de malha italiana", "Cota de malha longa", "Cota de malha saxônica"]);
    assert.ok(coats.every((recipe) => recipe.category === "Peitorais e cotas" && recipe.level >= 8 && recipe.level <= 16), "with the plate cuirasses, in a band of their own");
    const byLevel = coats.slice().sort((a, b) => a.level - b.level);
    assert.equal(new Set(byLevel.map((recipe) => recipe.level)).size, 4, "no two on a level");
    assert.deepEqual(plain(byLevel.map(nameOf)), ["Cota de malha italiana", "Cota de malha saxônica", "Cota de malha curta", "Cota de malha longa"], "dearest last");
    const metals = byLevel.map((recipe) => CRAFT_ITEMS[recipe.ingredients[0][0]][0]);
    assert.deepEqual(plain(metals), ["Ferro", "Ferro", "Aço", "Aço"]);
});

test("the smith forges the collar and the mail coif too, in the category of coifs and collars", () => {
    const pieces = forge.filter((recipe) => recipe.category === "Cotas e almofres");
    assert.deepEqual(plain(pieces.map(nameOf).sort()), ["Almofre de malha", "Gola de armadura"]);
    for (const recipe of pieces) {
        assert.ok(recipe.level >= 6 && recipe.level <= 9, nameOf(recipe));
        assert.ok(recipe.ingredients.length >= 3 && recipe.xp > 0 && recipe.seconds > 0);
    }
});

test("what was forged before is still there: the plate cuirasses and the helmets keep their places", () => {
    assert.ok(forge.some((recipe) => recipe.id === "forja:Cuirass09_m07_B4"), "the brigandine of plates");
    assert.ok(forge.filter((recipe) => recipe.category === "Capacetes").length >= 20);
    assert.ok(forge.every((recipe) => recipe.level >= 1 && recipe.level <= 24), "no level past the forge's own");
});

test("the smith forges the game's practice weapons of the Coletores' wood (2026-10-24: \"vamos add as armas de madeira\"), the first levels of the forge", () => {
    const wooden = forge.filter((recipe) => recipe.category === "Armas de madeira");
    assert.deepEqual(plain(wooden.map(nameOf).sort()), ["Bastão", "Clava de treino", "Escudo de treino", "Espada de treinamento", "Machado de treinamento", "Montante de treinamento"]);
    for (const recipe of wooden) {
        assert.ok(recipe.level >= 1 && recipe.level <= 3, nameOf(recipe));
        assert.equal(recipe.ingredients.length, 1, "wood and nothing else");
        assert.equal(recipe.ingredients[0][0], "kcdc-craft:lenha", "the Coletores' logs");
        assert.ok(recipe.ingredients[0][1] >= 2 && recipe.ingredients[0][1] <= 5 && recipe.xp > 0 && recipe.seconds > 0);
    }
});

test("the leaf-shaped plates are knee guards, not elbow guards (2026-10-24: players forged them for the arms): named and filed with the legs", () => {
    const plate = forge.find((recipe) => recipe.id === "forja:LegsPlate07_m01_E1");
    assert.equal(nameOf(plate), "Joelheiras em forma de folha");
    assert.equal(plate.category, "Pernas");
    assert.ok(!forge.some((recipe) => /Cotoveleiras em forma de folha/.test(nameOf(recipe))), "no elbow guards of that shape any more");
    assert.ok(forge.filter((recipe) => recipe.category === "Braços e manoplas").every((recipe) => !/folha/.test(nameOf(recipe))), "and nothing of that shape is left among the arms");
});

test("the smith bends lockpicks (2026-10-24: \"adicionar gazua para o ferreiro fazer\"): two to the batch, of scrap, hardware and coals, among the tools", () => {
    const pick = forge.find((recipe) => recipe.id === "forja:gazua");
    assert.ok(pick, "there is a recipe for it");
    assert.equal(nameOf(pick), "Gazua");
    assert.equal(pick.category, "Ferramentas");
    assert.equal(pick.amount, 2);
    assert.deepEqual(plain(pick.ingredients.map(([item, amount]) => amount)), [1, 1, 1], "one of each");
    assert.equal(pick.ingredients.length, 3, "a piece of scrap iron, a piece of hardware and a coal");
    assert.ok(pick.level >= 1 && pick.level <= 5 && pick.xp > 0 && pick.seconds > 0);
});
