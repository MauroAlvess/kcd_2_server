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

test("the Artesão's thread and linen come from the Agricultor: flax is sown at level 0, spun at the garden, and the thread is not in the Artesão's own recipes' outputs", () => {
    const flax = FARM_CROPS.find((crop) => crop.id === "linho");
    assert.equal(nameOf(flax.harvest), "Linho");
    assert.equal(flax.level, 0);
    const spin = FARM_PROCESSES.find((process) => process.id === "fiar-linha");
    assert.equal(nameOf(spin.output), "Linha de costura");
    assert.deepEqual(Array.from(spin.ingredients, ([item, n]) => [item, n]), [[flax.harvest, 1]]);
    assert.equal(spin.amount, 3);
    assert.ok(!CRAFT_RECIPES.some((recipe) => recipe.station === "costura" && recipe.output === spin.output), "no recipe of the needle makes thread");
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

test("the Cuman clothes are the tailor's, every dye of the four in a category of their own, at the level their name had (2026-10-27)", () => {
    const cuman = CRAFT_RECIPES.filter((recipe) => recipe.station === "costura" && recipe.category === "Roupas cumanas");
    const names = Array.from(cuman, (recipe) => nameOf(recipe.output));
    assert.equal(new Set(names).size, names.length, "no two with the same name: the dye tells them apart");
    const of = (start) => cuman.filter((recipe) => nameOf(recipe.output).startsWith(start));
    assert.equal(of("Chapéu cumano alto (").length, 10);
    assert.equal(of("Chapéu de couro cumano (").length, 10);
    assert.equal(of("Botas cumanas (").length, 9, "the game has nine dyes of the boots");
    assert.equal(of("Cafetã cumano (").length, 10);
    assert.equal(cuman.length, 39);
    assert.deepEqual(Array.from(new Set(of("Chapéu de couro cumano (").map((recipe) => recipe.level))), [3]);
    assert.deepEqual(Array.from(new Set(of("Chapéu cumano alto (").map((recipe) => recipe.level))), [4]);
    assert.deepEqual(Array.from(new Set(of("Botas cumanas (").map((recipe) => recipe.level))), [10]);
    assert.deepEqual(Array.from(new Set(of("Cafetã cumano (").map((recipe) => recipe.level))), [18]);
    assert.ok(cuman.every((recipe) => recipe.amount === 1 && recipe.ingredients.some(([item]) => nameOf(item) === "Linha de costura")), "sewn with thread, like the rest of the needle's work");
    // And not once more among the hats, the boots and the coats: the dearest dye of each used to be there alone.
    const elsewhere = CRAFT_RECIPES.filter((recipe) => recipe.station === "costura" && recipe.category !== "Roupas cumanas" && /cuman/i.test(nameOf(recipe.output)));
    assert.equal(elsewhere.length, 0);
    // A colour is a word where the icon gave one, and a number of the dye where not.
    assert.ok(names.every((name) => /\([a-zçãõáéíóúâêô -]+( \d+)?\)$/i.test(name)), names.find((name) => !/\([a-zçãõáéíóúâêô -]+( \d+)?\)$/i.test(name)));
});
