"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

// The smith's horse tack (tools/make-craft-recipes.py, 2026-10-23: "coloque para o ferreiro poder forjar selas e coisas de cavalo"): saddles,
// bridles and chanfrons, harnesses and caparisons, and the game's five horseshoes, at the forge.

const data = { exports: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/craft-data.js"), "utf8"), data);
const { CRAFT_RECIPES, CRAFT_ITEMS } = data.exports;
const plain = (value) => JSON.parse(JSON.stringify(value));
const forge = CRAFT_RECIPES.filter((recipe) => recipe.station === "forja");
const named = (recipe) => CRAFT_ITEMS[recipe.output][0];
const inCategory = (category) => forge.filter((recipe) => recipe.category === category);

test("the forge forges eleven saddles, nine bridles and chanfrons, ten harnesses and caparisons, and the game's five horseshoes", () => {
    assert.equal(inCategory("Selas").length, 11);
    assert.equal(inCategory("Rédeas e chanfros").length, 9);
    assert.equal(inCategory("Arreios e caparazões").length, 10);
    assert.deepEqual(plain(inCategory("Ferraduras").map(named).sort()), ["Ferraduras de Lovarian", "Ferraduras de corrida", "Ferraduras de fazendeiro", "Ferraduras do cavaleiro", "Ferraduras do nobre"]);
});

test("the saddles run from the Prague saddle at the second level to the dragon saddle at the twenty-second, and take leather, seasoned wood, iron, fittings, thread and linen", () => {
    const saddles = inCategory("Selas").sort((a, b) => a.level - b.level);
    assert.equal(named(saddles[0]), "Sela de Praga");
    assert.equal(saddles[0].level, 2);
    assert.equal(named(saddles.at(-1)), "Sela de dragão");
    assert.equal(saddles.at(-1).level, 22);
    assert.ok(saddles.every((recipe, index) => index === 0 || recipe.level >= saddles[index - 1].level), "later levels for dearer saddles");
    for (const recipe of saddles) {
        const names = recipe.ingredients.map(([id]) => CRAFT_ITEMS[id][0]);
        assert.ok(names.some((name) => /^Pele de /.test(name)), `${named(recipe)}: leather`);
        assert.ok(names.includes("Madeira de arco"), "wood for the tree");
        assert.ok(names.includes("Ferro") && names.includes("Material de fixação") && names.includes("Linha de costura") && names.includes("Linho"));
        assert.equal(recipe.amount, 1);
        assert.ok(recipe.seconds >= 12);
    }
    const dearest = saddles.at(-1).ingredients.map(([id, n]) => [CRAFT_ITEMS[id][0], n]);
    assert.deepEqual(plain(dearest.find(([name]) => /^Pele de /.test(name))), ["Pele de cervo", 6], "deer hide at the top, by the saddle's weight");
});

test("the tack has the icon of the game's piece, and the pieces a tamed horse is dressed in by name are among them", () => {
    const icons = new Set(inCategory("Selas").concat(inCategory("Rédeas e chanfros")).map((recipe) => CRAFT_ITEMS[recipe.output][1]));
    assert.ok(icons.has("BasicSaddle01_m03"), "the Prague saddle a tamed horse wears");
    assert.ok(icons.has("BasicBridle01_m01"), "and its soft leather reins");
    assert.ok([...icons].every((icon) => /Saddle|Bridle|Chanfron/.test(icon)), [...icons].join(", "));
});

test("no piece of the tack carries a house's arms, the chanfrons are plate and the horseshoes are iron", () => {
    for (const recipe of [...inCategory("Selas"), ...inCategory("Rédeas e chanfros"), ...inCategory("Arreios e caparazões")]) {
        assert.doesNotMatch(named(recipe), /Leipa|Skalitz|Ruthard|Semine|Teut|Jezek|Pros\b/, named(recipe));
    }
    for (const recipe of inCategory("Rédeas e chanfros").filter((one) => /^Chanfron/.test(named(one)))) {
        const names = recipe.ingredients.map(([id]) => CRAFT_ITEMS[id][0]);
        assert.ok(names.some((name) => /^Aço/.test(name)), `${named(recipe)}: steel`);
    }
    for (const recipe of inCategory("Ferraduras")) {
        const names = recipe.ingredients.map(([id]) => CRAFT_ITEMS[id][0]);
        assert.ok(names.some((name) => /Ferro|Sucata/.test(name)), `${named(recipe)}: iron or scrap`);
        assert.ok(names.includes("Carvão"));
    }
});

test("every ingredient of the tack is an item with a name and an icon", () => {
    for (const recipe of [...inCategory("Selas"), ...inCategory("Rédeas e chanfros"), ...inCategory("Arreios e caparazões"), ...inCategory("Ferraduras")]) {
        for (const [id, amount] of recipe.ingredients) {
            assert.ok(CRAFT_ITEMS[id] && CRAFT_ITEMS[id][0] && CRAFT_ITEMS[id][1], `${named(recipe)}: ${id}`);
            assert.ok(Number.isInteger(amount) && amount >= 1);
        }
    }
});
