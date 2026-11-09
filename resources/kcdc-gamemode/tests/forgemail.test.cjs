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
    // A colour of a town's set stands beside its piece, with the colour in its name (2026-11-03).
    const coats = forge.filter((recipe) => /^Cota de malha[^(]*$/.test(nameOf(recipe)));
    assert.deepEqual(plain(coats.map(nameOf).sort()), ["Cota de malha curta", "Cota de malha italiana", "Cota de malha longa", "Cota de malha saxônica"]);
    assert.ok(coats.every((recipe) => recipe.category === "Cotas de malha" && recipe.level >= 8 && recipe.level <= 16), "in the mail's category (2026-10-31: no longer with the plate), in a band of their own");
    const byLevel = coats.slice().sort((a, b) => a.level - b.level);
    assert.equal(new Set(byLevel.map((recipe) => recipe.level)).size, 4, "no two on a level");
    assert.deepEqual(plain(byLevel.map(nameOf)), ["Cota de malha italiana", "Cota de malha saxônica", "Cota de malha curta", "Cota de malha longa"], "dearest last");
    const metals = byLevel.map((recipe) => CRAFT_ITEMS[recipe.ingredients[0][0]][0]);
    assert.deepEqual(plain(metals), ["Ferro", "Ferro", "Aço", "Aço"]);
});

test("the smith forges the collar and the mail coif too, with the coats of mail", () => {
    const pieces = forge.filter((recipe) => recipe.category === "Cotas de malha" && /^(Almofre|Gola)/.test(nameOf(recipe)));
    assert.deepEqual(plain(pieces.map(nameOf).sort()), ["Almofre de malha", "Gola de armadura"]);
    for (const recipe of pieces) {
        assert.ok(recipe.level >= 6 && recipe.level <= 9, nameOf(recipe));
        assert.ok(recipe.ingredients.length >= 3 && recipe.xp > 0 && recipe.seconds > 0);
    }
});

test("what was forged before is still there: the plate cuirasses and the helmets keep their places", () => {
    assert.ok(forge.some((recipe) => nameOf(recipe) === "Brigandina de placas"), "the brigandine of plates");
    assert.ok(forge.filter((recipe) => ["Capacetes de chaleira", "Bacinetes e elmos", "Capacetes de calota"].includes(recipe.category)).length >= 30, "the helmets, by kind since 2026-10-31");
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
    assert.equal(plate.category, "Perneiras e joelheiras");
    assert.ok(!forge.some((recipe) => /Cotoveleiras em forma de folha/.test(nameOf(recipe))), "no elbow guards of that shape any more");
    assert.ok(forge.filter((recipe) => recipe.category === "Braços e manoplas").every((recipe) => !/folha/.test(nameOf(recipe))), "and nothing of that shape is left among the arms");
});

// The colours of a piece (2026-11-03, a smith's report: "tem item com mesmo nome e ícone, só cor diferente; seria legal fazer o esquema de cores igual do artesão").
test("a piece of the forge's armour is one recipe with its colours, as at the needle, and no colour is listed twice", () => {
    const dyed = forge.filter((recipe) => recipe.variants !== undefined);
    assert.ok(dyed.length >= 50, `${dyed.length} pieces with a picker`);
    const classes = new Set();
    for (const recipe of dyed) {
        assert.ok(recipe.variants.length >= 2, recipe.id);
        assert.equal(recipe.variants[0][0], recipe.output, `${recipe.id}: the first colour is the recipe's own`);
        const labels = recipe.variants.map(([, label]) => label);
        assert.equal(new Set(labels).size, labels.length, `${recipe.id}: a word is numbered when two colours share it`);
        for (const [output, label, icon, rich] of recipe.variants) {
            assert.ok(/^[0-9a-f-]{36}$/.test(output) && label !== "" && icon !== "" && (rich === 0 || rich === 1), `${recipe.id}: ${output}`);
            assert.ok(!/^cor \d/.test(label), `${recipe.id}: every colour has a word (${label})`);
            assert.ok(!classes.has(output), `${recipe.id}: ${output} is in another picker too`);
            classes.add(output);
        }
        assert.equal(recipe.noble === true && recipe.level < 22, recipe.variants.every((v) => v[3] === 1) && recipe.level < 22, `${recipe.id}: a noble's only when every colour is`);
    }
    assert.ok(!forge.some((recipe) => recipe.variants === undefined && classes.has(recipe.output)), "a colour of a picker is not a recipe of its own as well");
    assert.equal(dyed.filter((recipe) => ["Espadas", "Espadas de caça", "Sabres", "Montantes", "Machados", "Maças", "Adagas", "Escudos", "Arcos", "Bestas", "Flechas", "Virotes"].includes(recipe.category)).length, 0, "the armour only");
});

test("the game's darkened pieces, which weigh less, keep a recipe of their own beside the piece they darken", () => {
    const names = new Set(forge.map(nameOf));
    for (const dark of ["Couraça lisa: escurecida", "Couraça remendada: escura", "Couraça de equitação: escurecida", "Perneiras de placa de nobre: escuras"]) {
        assert.ok(names.has(dark), dark);
    }
    assert.equal(forge.find((recipe) => nameOf(recipe) === "Couraça lisa: escurecida").variants, undefined);
    assert.ok(forge.find((recipe) => nameOf(recipe) === "Couraça lisa").variants.length >= 2);
});

test("a colour in a town's set is that town's alone: a recipe of its own, with the colour in its name", () => {
    const own = forge.filter((recipe) => recipe.place !== undefined && / \(.+\)$/.test(nameOf(recipe)) && recipe.category !== "Escudos");
    assert.ok(own.length >= 10, `${own.length} town colours`);
    for (const recipe of own) {
        const piece = nameOf(recipe).replace(/ \(.+\)$/, "");
        const free = forge.find((other) => nameOf(other) === piece);
        assert.ok(free !== undefined, `${nameOf(recipe)} stands beside the piece`);
        assert.equal(free.level, recipe.level, `${nameOf(recipe)}: the same level as the piece`);
    }
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
