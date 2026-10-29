"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

// What the artisan sews besides the clothes (2026-10-26, tools/make-craft-recipes.py): the belts and pouches that give a player their quick slots
// ("vamos add cintos e bolsas para o artesão poder fazer"), and the coats and tunics that carry the arms of a city or a house ("nas criações dos
// artesões vamos adicionar para ele poder criar os casacos com brasões de casas"). And the souls the supporters' dogs are drawn from.

const context = { exports: {}, require: () => assert.fail("craft-data requires nothing") };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/craft-data.js"), "utf8"), context);
const { CRAFT_RECIPES, CRAFT_ITEMS } = context.exports;
const plain = (value) => JSON.parse(JSON.stringify(value));
const nameOf = (item) => CRAFT_ITEMS[item][0];
const SILVER_BAR = "kcdc-craft:barra-prata";
const THREAD = "kcdc-craft:linha";
const sewing = CRAFT_RECIPES.filter((recipe) => recipe.station === "costura");

test("the artisan makes the game's three belts and four pouches, from the hunter's belt at the sixth level to the noble's pouch at the twentieth", () => {
    const belts = sewing.filter((recipe) => recipe.category === "Cintos").sort((a, b) => a.level - b.level);
    const pouches = sewing.filter((recipe) => recipe.category === "Bolsas").sort((a, b) => a.level - b.level);
    assert.deepEqual(plain(belts.map((recipe) => nameOf(recipe.output))), ["Cinto de caçador", "Cinto de cavaleiro", "Cinto de nobre"], "two, three and four slots");
    assert.deepEqual(plain(pouches.map((recipe) => nameOf(recipe.output))), ["Bolsilha de andarilho", "Bolsilha de caçador", "Bolsilha de cavaleiro", "Bolsilha de nobre"], "one to four slots");
    assert.deepEqual(plain(belts.map((recipe) => recipe.id)), ["costura:belt_2slot", "costura:belt_3slot", "costura:belt_4slot"]);
    assert.deepEqual(plain(pouches.map((recipe) => recipe.id)), ["costura:Pouch_test_1slot", "costura:Pouch_test_2slot", "costura:Pouch_test_3slot", "costura:Pouch_test_4slot"]);
    for (const recipe of [...belts, ...pouches]) {
        assert.equal(recipe.amount, 1, recipe.id);
        assert.ok(recipe.level >= 6 && recipe.level <= 20, `${recipe.id}: level ${recipe.level}`);
        assert.ok(recipe.seconds >= 10 && recipe.xp > 0, recipe.id);
        assert.ok(recipe.ingredients.some(([item]) => item === THREAD), `${recipe.id} is sewn with thread`);
        for (const [item, amount] of recipe.ingredients) {
            assert.ok(CRAFT_ITEMS[item] !== undefined && amount >= 1, `${recipe.id}: ${item}`);
        }
    }
    assert.equal(belts[0].level, 6);
    assert.equal(pouches.at(-1).level, 20);
    assert.ok(belts.every((recipe, index) => index === 0 || recipe.level > belts[index - 1].level), "dearer belts come later");
    assert.ok(pouches.every((recipe, index) => index === 0 || recipe.level > pouches[index - 1].level), "and dearer pouches");
    assert.deepEqual(plain([belts[2], pouches[3]].map((recipe) => recipe.ingredients.some(([item]) => item === SILVER_BAR))), [true, true], "the noble's carry the Coletores' silver");
    assert.ok([...belts.slice(0, 2), ...pouches.slice(0, 3)].every((recipe) => !recipe.ingredients.some(([item]) => item === SILVER_BAR)), "and no other does");
});

const HOUSES = ["Bergow", "Kuttenberg", "Leipa", "Nebakov", "Polner", "Praga", "Písek", "Ruthard", "Semine", "Vavák", "Zavish", "Zimburg"];
const TOKEN = /_m(?:Kuttenberg|Prague|Bergov|Leipa|Nebak|Pisek|Polner|Ruthart|Ruthard|Semin|Vavak|Zavis|Cimburk)/;

test("the artisan makes the coats and tunics with the arms of the cities and houses, a category for each", () => {
    const categories = [...new Set(sewing.filter((recipe) => recipe.category.startsWith("Brasão: ")).map((recipe) => recipe.category))].sort();
    assert.deepEqual(plain(categories), HOUSES.map((house) => `Brasão: ${house}`).sort());
    const coats = sewing.filter((recipe) => recipe.category.startsWith("Brasão: "));
    assert.ok(coats.length >= 40, `${coats.length} pieces`);
    for (const recipe of coats) {
        const house = recipe.category.slice("Brasão: ".length);
        assert.match(recipe.id, /^costura:(Coat|Waffenrock)[0-9]+_m/, `${recipe.id} is a coat or a tunic`);
        assert.match(recipe.id, TOKEN, `${recipe.id} carries a house's token`);
        assert.ok(recipe.level >= 6 && recipe.level <= 18, `${recipe.id}: level ${recipe.level}`);
        assert.ok(recipe.seconds >= 12 && recipe.xp > 0, recipe.id);
        const thread = recipe.ingredients.filter(([item]) => item === THREAD).reduce((sum, [, amount]) => sum + amount, 0);
        assert.ok(thread >= 3, `${recipe.id}: the arms are embroidered, with thread enough (${thread})`);
        // The list tells the houses apart: the name says the house, or the game's own name already does.
        assert.ok(nameOf(recipe.output).includes(house) || /Praga|Garbow/.test(nameOf(recipe.output)), `${recipe.id}: "${nameOf(recipe.output)}" in ${house}`);
        assert.ok(!/Henry/.test(nameOf(recipe.output)), "Henry's own clothes are not a house's");
    }
    const kuttenberg = coats.filter((recipe) => recipe.category === "Brasão: Kuttenberg").map((recipe) => nameOf(recipe.output));
    assert.ok(kuttenberg.includes("Sobretudo de brasão (Kuttenberg)") && kuttenberg.includes("Casaco comum com brasão (Kuttenberg)") && kuttenberg.includes("Casaco quente bordado (Kuttenberg)"), "the coats");
    assert.ok(kuttenberg.includes("Túnica para cavaleiro (Kuttenberg)"), "and the tunics");
    assert.equal(coats.filter((recipe) => recipe.category === "Brasão: Leipa").length, 3);
    assert.ok(coats.filter((recipe) => /^costura:Coat02_m/.test(recipe.id)).length >= 8, "the surcoat of each house");
});

test("the house coats are made nowhere else: not under the plain names of the tunics, and the unique ones, the orders' and Henry's are not theirs", () => {
    const elsewhere = sewing.filter((recipe) => !recipe.category.startsWith("Brasão: ") && /^costura:(Coat|Waffenrock)[0-9]+_/.test(recipe.id) && TOKEN.test(recipe.id));
    assert.deepEqual(plain(elsewhere.map((recipe) => recipe.id)), [], "no tunic of a house under a name that hides the house");
    const ids = CRAFT_RECIPES.map((recipe) => recipe.id);
    assert.equal(new Set(ids).size, ids.length, "no recipe twice");
    assert.ok(!sewing.some((recipe) => recipe.category.startsWith("Brasão: ") && /Coat11_mBergov|Coat08_mPisek|Gloves06|Hood03|CuirassCapon|Gauntlets|Caparison/.test(recipe.id)), "nothing unique, nothing of armour or of a horse");
    for (const recipe of CRAFT_RECIPES) {
        for (const [item] of [[recipe.output], ...recipe.ingredients]) assert.ok(CRAFT_ITEMS[item] !== undefined, `${recipe.id}: ${item} has a name and an icon`);
    }
});

test("the clothes that were there before keep their levels: the house coats were moved out of the tunics without shifting the rest", () => {
    const tunics = sewing.filter((recipe) => recipe.category === "Túnicas e vestidos");
    assert.ok(tunics.length >= 60, `${tunics.length} tunics and dresses are still made`);
    const levels = new Set(tunics.map((recipe) => recipe.level));
    assert.ok(levels.has(0) && Math.max(...levels) >= 20, "from the first level to the top, as before");
});

const SURCOATS = ["Túnica simples", "Túnica com bainha", "Túnica para cavaleiro", "Túnica de montaria", "Túnica ornamentada", "Túnica com fecho"];

test("the artisan makes the plain tunics, every dye of the six surcoats, in a category of their own and at the level each name had (2026-10-26)", () => {
    const tunics = sewing.filter((recipe) => recipe.category === "Túnicas lisas");
    assert.equal(tunics.length, 38, "the dyes of the six names the game numbers");
    for (const recipe of tunics) {
        assert.match(recipe.id, /^costura:Waffenrock0[1-9]_m[0-9]+_[A-Z]$/, `${recipe.id}: a surcoat in one of the game's numbered dyes`);
        assert.doesNotMatch(recipe.id, TOKEN, `${recipe.id}: not a house's`);
        assert.equal(recipe.amount, 1);
        assert.ok(recipe.ingredients.some(([item]) => item === THREAD) && recipe.seconds >= 8 && recipe.xp > 0, recipe.id);
    }
    const byName = {};
    for (const recipe of tunics) {
        const label = nameOf(recipe.output);
        const name = SURCOATS.find((candidate) => label.startsWith(`${candidate} (`));
        assert.ok(name !== undefined, `${label}: one of the six names with its colour after it`);
        (byName[name] ??= []).push({ label, level: recipe.level });
    }
    assert.deepEqual(plain(Object.fromEntries(Object.entries(byName).map(([name, list]) => [name, [list.length, [...new Set(list.map((one) => one.level))]]]))), {
        "Túnica simples": [5, [10]],
        "Túnica com bainha": [3, [12]],
        "Túnica de montaria": [15, [15]],
        "Túnica para cavaleiro": [6, [16]],
        "Túnica com fecho": [4, [18]],
        "Túnica ornamentada": [5, [19]],
    }, "every dye of a name at the level the name had; the three whose plain piece went to a house keep the house piece's level");
    const labels = tunics.map((recipe) => nameOf(recipe.output));
    assert.equal(new Set(labels).size, labels.length, "no two of them have the same name in the list");
    assert.ok(labels.includes("Túnica de montaria (ocre 1)") && labels.includes("Túnica de montaria (ocre 4)") && labels.includes("Túnica de montaria (vermelha)"), "a colour two dyes share is numbered from one, one that is alone is not");
    assert.ok(!labels.some((label) => /\(ocre\)/.test(label) && label.startsWith("Túnica de montaria")), "and then every one of them is");
    // Not in the general list as well, and the other tunics stay where they were.
    const general = sewing.filter((recipe) => recipe.category === "Túnicas e vestidos").map((recipe) => nameOf(recipe.output));
    assert.ok(!general.some((name) => SURCOATS.includes(name)), "the six names are only here");
    assert.ok(general.includes("Túnica") && general.includes("Túnica curta") && general.includes("Camisa de estalajadeiro"), "the peasants' tunics and shirts are as they were");
});

test("the souls the supporters' dogs are drawn from: the village dogs the game files, each name and each soul once", () => {
    const souls = { exports: {} };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/dog-souls.js"), "utf8"), souls);
    const list = souls.exports.DOG_SOULS;
    assert.ok(list.length >= 40, `${list.length} souls`);
    assert.equal(new Set(list.map(([name]) => name)).size, list.length, "each name once");
    assert.equal(new Set(list.map(([, guid]) => guid)).size, list.length, "each soul once");
    for (const [name, guid] of list) {
        assert.match(name, /^[kt][a-z]{2,3}_dog_?[0-9]+$/, "a village's dog");
        assert.match(guid, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    }
});
