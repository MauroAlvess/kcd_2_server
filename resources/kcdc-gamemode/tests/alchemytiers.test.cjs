"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

// The potions in their four qualities (2026-11-01, the user: "vamos add as poções melhores nas receitas por nível de alquimista"). The game brews every potion as the weak one
// (Fraca), the plain, the strong (Forte) and Henry's, each an item of its own; the page used to know only the weak one.

const context = { exports: {}, require: () => assert.fail("craft-data requires nothing") };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/craft-data.js"), "utf8"), context);
const { CRAFT_RECIPES, CRAFT_ITEMS } = context.exports;
const plain = (value) => JSON.parse(JSON.stringify(value));
const nameOf = (recipe) => CRAFT_ITEMS[recipe.output][0];
const alchemy = CRAFT_RECIPES.filter((recipe) => recipe.station === "alquimia");
const gameRecipes = alchemy.filter((recipe) => recipe.alchemy !== undefined);
const tiersOf = (number) => gameRecipes.filter((recipe) => recipe.alchemy === number).sort((a, b) => a.level - b.level);

test("a potion of four qualities has four recipes, from the weak one to Henry's, each further up the ladder and rewarding more", () => {
    const marigold = tiersOf(14);
    assert.deepEqual(plain(marigold.map(nameOf)), ["Mistura de Cravo-de-defunto Fraca", "Mistura de Cravo-de-defunto", "Mistura de Cravo-de-defunto Forte", "Mistura de Cravo-de-defunto do Henry"]);
    assert.deepEqual(plain(marigold.map((recipe) => recipe.id)), ["alquimia:14", "alquimia:14:2", "alquimia:14:3", "alquimia:14:4"], "the weak one keeps the id it always had");
    assert.equal(marigold[0].level, 3, "and its level");
    assert.deepEqual(plain(marigold.map((recipe) => recipe.level)), [3, 12, 21, 30]);
    assert.deepEqual(plain(marigold.map((recipe) => recipe.xp)), [11, 21, 35, 51], "30% more worth at each step, and the level's share of it (2026-11-01: half at the first level, half as much again at the thirtieth)");
    for (const recipe of marigold) {
        assert.deepEqual(plain(recipe.ingredients), plain(marigold[0].ingredients), "as in the game, the same herbs make the four");
        assert.equal(recipe.category, "Poções");
        assert.equal(recipe.amount, 1);
        assert.equal(recipe.seconds, 0);
        assert.equal(recipe.alchemy, 14, "the game's recipe it teaches is the same");
    }
});

test("the best of every potion opens at the top of the skill, and the dearer a potion the closer together its tiers are", () => {
    const ladders = new Set(gameRecipes.map((recipe) => recipe.alchemy));
    assert.ok(ladders.size >= 25);
    let upgraded = 0;
    for (const number of ladders) {
        const tiers = tiersOf(number);
        if (tiers.length === 1) continue;
        upgraded += 1;
        assert.equal(tiers.length, 4, `recipe ${number} has four qualities`);
        assert.equal(tiers[3].level, 30, `the best of recipe ${number} opens at the top`);
        assert.ok(tiers.every((tier, index) => index === 0 || tier.level > tiers[index - 1].level), `recipe ${number}: each tier opens above the one before`);
        assert.ok(tiers.every((tier) => tier.level <= 30));
    }
    assert.equal(upgraded, 25, "twenty-five potions have four qualities");
    const early = plain(tiersOf(13).map((recipe) => recipe.level));
    const late = plain(tiersOf(57).map((recipe) => recipe.level));
    assert.deepEqual(early, [1, 11, 20, 30]);
    assert.deepEqual(late, [20, 23, 27, 30]);
});

test("a potion whose qualities are one and the same item has the one recipe, as it always had", () => {
    for (const number of [16, 43, 51, 54, 55, 56]) {
        assert.equal(tiersOf(number).length, 1, `recipe ${number}`);
    }
    assert.equal(tiersOf(16)[0].id, "alquimia:16");
    assert.equal(tiersOf(16)[0].level, 0);
});

test("poisons and oils get their tiers in their own categories, and the list is ordered by level inside each", () => {
    const aconite = tiersOf(5);
    assert.deepEqual(plain(aconite.map(nameOf)), ["Acônito Fraca", "Acônito", "Acônito Forte", "Acônito de Henry"]);
    assert.ok(aconite.every((recipe) => recipe.category === "Venenos"));
    const embrocation = tiersOf(52);
    assert.ok(embrocation.every((recipe) => recipe.category === "Óleos e pomadas"), plain(embrocation.map(nameOf)).join(", "));
    for (const category of ["Poções", "Venenos", "Óleos e pomadas"]) {
        const levels = CRAFT_RECIPES.filter((recipe) => recipe.station === "alquimia" && recipe.category === category).map((recipe) => recipe.level);
        assert.deepEqual(levels, levels.slice().sort((a, b) => a - b), `${category} is listed by level`);
    }
});

test("every recipe id of the alchemist's is unique, and no tier names an item the page cannot show", () => {
    const ids = alchemy.map((recipe) => recipe.id);
    assert.equal(new Set(ids).size, ids.length);
    for (const recipe of alchemy) {
        assert.ok(CRAFT_ITEMS[recipe.output], `${recipe.id} has a name and an icon`);
        for (const [item] of recipe.ingredients) assert.ok(CRAFT_ITEMS[item], `${recipe.id}: ${item}`);
    }
    assert.equal(alchemy.length, 114);
});
