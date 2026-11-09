"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

// The guilds supply one another (SINERGIA.md, 2026-10-27): the NPC vendors that sold every raw ingredient are going, so every ingredient of every recipe has to be
// made by a recipe, grown in a garden, found by a Coletor, taken from a hunted animal or put in the world by the server.

const sandbox = { exports: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/craft-data.js"), "utf8"), sandbox);
const { CRAFT_ITEMS, CRAFT_RECIPES, FARM_CROPS, FARM_PROCESSES } = sandbox.exports;
const nameOf = (id) => CRAFT_ITEMS[id][0];

/** What the Coletores bring: the rocks' and the trees' finds (`gather.ts`). */
const COLETOR = ["Lenha", "Sucata", "Ferro", "Material de fixação", "Cobre", "Jaspe", "Pó de esmalte", "Enxofre", "Salitre", "Sal", "Madeira de arco", "Madeira exótica", "Minério de prata", "Nozes", "Teia de aranha"];
/** What a hunter takes from a carcass: hides, tusks, horn, and (by `MEAT`) every cut and organ. */
const CACADOR = ["Pele de carneiro", "Pele de cervo", "Pele de vaca", "Pele de porco", "Presa de javali", "Fragmentos de chifre"];
const MEAT = /^(Carne|Lombo|Coxa|Costelas|Coração|Rins|Fígado|Língua|Estômago|Cordeiro|Frango|Comida de cachorro)/;
/** What the server puts in the world to be taken: eggs and feathers in the nests, honey in the hives, fish in the traps, and the cows' milk (`cows.ts`). */
const MUNDO = ["Pena de cauda de galo", "Ovo", "Mel", "Truta", "Perca", "Lagostim", "Lagostim azul", "Leite"];

test("every ingredient of every recipe is made, grown, found, hunted or put in the world: none is left to a vendor", () => {
    const produced = new Set([...CRAFT_RECIPES.map((recipe) => recipe.output), ...FARM_PROCESSES.map((process) => process.output), ...FARM_CROPS.map((crop) => crop.harvest)]);
    const known = new Set([...COLETOR, ...CACADOR, ...MUNDO]);
    const stranded = new Map();
    for (const recipe of CRAFT_RECIPES) {
        for (const [item] of recipe.ingredients) {
            const name = nameOf(item);
            if (!produced.has(item) && !known.has(name) && !MEAT.test(name)) {
                stranded.set(name, [...(stranded.get(name) ?? []), recipe.id]);
            }
        }
    }
    assert.deepEqual([...stranded].map(([name, ids]) => `${name} (${ids.length}: ${ids.slice(0, 2).join(", ")})`), [], "an ingredient with no source: make it, plant it, or say where it is found");
});

test("the Artesão's linen comes from the Agricultor, who sows it at level 0 and spins it at the garden; the Artesão (with water), the Taberneiro and the Alquimista (with their own water) spin it too (2026-10-30)", () => {
    const flax = FARM_CROPS.find((crop) => crop.id === "linho");
    assert.equal(nameOf(flax.harvest), "Linho");
    assert.equal(flax.level, 0);
    const spin = FARM_PROCESSES.find((process) => process.id === "fiar-linha");
    assert.equal(nameOf(spin.output), "Linha de costura");
    assert.deepEqual(Array.from(spin.ingredients, ([item, n]) => [item, n]), [[flax.harvest, 1]]);
    assert.equal(spin.amount, 3);
    // 2026-10-30 (user: "adiciona a receita de linha que o artesão precisa para ele mesmo poder fabricar com linho e água potável; o taverneiro e alquimista podem fazer usando a própria
    // água do corpo, quanto mais ele faz mais sede ele fica"): the needle makes thread of a flax and a flask of water, the fire and the rack make it of a flax and the body's own water.
    const made = CRAFT_RECIPES.filter((recipe) => recipe.output === spin.output);
    assert.deepEqual(Array.from(made, (recipe) => recipe.id).sort(), ["costura:linha", "fogo:linha", "secador:linha"]);
    const names = (recipe) => Array.from(recipe.ingredients, ([item, n]) => `${n} ${nameOf(item)}`);
    const needle = made.find((recipe) => recipe.station === "costura");
    assert.deepEqual(names(needle), ["1 Linho", "1 Água potável"], "the Artesão pays with a flask of potable water");
    assert.equal(needle.thirst, undefined, "and nothing of his body");
    assert.equal(needle.amount, 3);
    for (const station of ["fogo", "secador"]) {
        const wet = made.find((recipe) => recipe.station === station);
        assert.deepEqual(names(wet), ["1 Linho"], `${station}: no flask`);
        assert.ok(wet.thirst > 0, `${station}: the body's own water is what it pays`);
        assert.equal(wet.amount, 3);
        assert.equal(wet.level, 0);
    }
    assert.ok(made.every((recipe) => recipe.category === "Fios" && recipe.seconds > 0), "worked for a time, under their own heading");
});

test("the mushrooms, the rare root, the pearl and the leached charcoal are the alchemists' recipes, made on the page like the bandages, of what the other guilds bring (2026-10-27)", () => {
    const made = CRAFT_RECIPES.filter((recipe) => recipe.station === "alquimia" && recipe.alchemy === undefined && ["Cogumelos", "Raridades", "Preparos"].includes(recipe.category));
    assert.deepEqual(Array.from(made, (recipe) => nameOf(recipe.output)).sort(), ["Amanita muscaria", "Boletus edulis", "Carvão lixiviado", "Lepiota", "Pérolas de água-doce", "Raiz de mandrágora"]);
    assert.ok(made.every((recipe) => recipe.seconds > 0 && recipe.level >= 1), "worked for a time, from a level");
    const mushrooms = made.filter((recipe) => recipe.category === "Cogumelos");
    assert.ok(mushrooms.every((recipe) => recipe.ingredients.some(([item]) => nameOf(item) === "Lenha")), "grown on the Coletores' logs");
});

test("the half-eaten apple of the game is no ingredient: the dried and cooked apples are made of the whole one the gardens grow", () => {
    const apples = CRAFT_RECIPES.filter((recipe) => recipe.ingredients.some(([item]) => nameOf(item) === "Maçã"));
    assert.ok(apples.length >= 2);
    const grown = new Set(FARM_CROPS.map((crop) => crop.harvest));
    assert.ok(apples.every((recipe) => recipe.ingredients.filter(([item]) => nameOf(item) === "Maçã").every(([item]) => grown.has(item))), "every apple a recipe takes is the garden's");
});

test("the Cuman clothes are the tailor's: the four of them, each with its dyes in a picker, in a category of their own, at the level their name had (2026-10-27; a picker since 2026-10-31)", () => {
    const cuman = CRAFT_RECIPES.filter((recipe) => recipe.station === "costura" && recipe.category === "Roupas cumanas");
    const names = Array.from(cuman, (recipe) => nameOf(recipe.output));
    assert.deepEqual(names.slice().sort(), ["Botas cumanas", "Cafetã cumano", "Chapéu cumano alto", "Chapéu de couro cumano"], "one recipe for each, the dye is picked");
    const of = (name) => cuman.find((recipe) => nameOf(recipe.output) === name);
    assert.equal(of("Chapéu cumano alto").variants.length, 10);
    assert.equal(of("Chapéu de couro cumano").variants.length, 10);
    assert.equal(of("Botas cumanas").variants.length, 9, "the game has nine dyes of the boots");
    assert.equal(of("Cafetã cumano").variants.length, 10);
    assert.equal(of("Chapéu de couro cumano").level, 4, "a level over what it had: the quest and test hats left the ladder (2026-11-01)");
    assert.equal(of("Chapéu cumano alto").level, 5);
    assert.equal(of("Botas cumanas").level, 10);
    assert.equal(of("Cafetã cumano").level, 18);
    assert.ok(cuman.every((recipe) => recipe.amount === 1 && recipe.ingredients.some(([item]) => nameOf(item) === "Linha de costura")), "sewn with thread, like the rest of the needle's work");
    // And not once more among the hats, the boots and the coats.
    const elsewhere = CRAFT_RECIPES.filter((recipe) => recipe.station === "costura" && recipe.category !== "Roupas cumanas" && /cuman/i.test(nameOf(recipe.output)));
    assert.equal(elsewhere.length, 0);
    // A colour is a word where the icon gave one, and a number of the dye where not.
    for (const recipe of cuman) {
        for (const [, label] of recipe.variants) {
            assert.match(label, /^[a-zçãõáéíóúâêô -]+( \d+)?$/i, label);
        }
    }
});
