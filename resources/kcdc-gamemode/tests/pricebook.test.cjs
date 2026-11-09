"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

// The realm's one price book (src/server/guild-shops.ts `makePriceBook`, 2026-11-03): one price for each thing at every vendor, one guild that buys it, and what the trades make worth
// what goes into it. Read with the real vendors, recipes and gardens, and the game's own worth of every item they name (tests/fixtures/game-worth.json, made from the game's tables).
const dist = (name) => fs.readFileSync(path.join(__dirname, "../dist/server", name), "utf8");

const data = (() => {
    const sandbox = { exports: {} };
    vm.runInNewContext(dist("craft-data.js"), sandbox);
    return sandbox.exports;
})();

function shopsWith(craftData) {
    const sandbox = { exports: {}, require: (id) => ({ "./craft-data.js": craftData, "./money.js": { MONEY_UNIT: 10 } })[id] ?? assert.fail(`unexpected require ${id}`) };
    vm.runInNewContext(dist("guild-shops.js"), sandbox);
    return sandbox.exports;
}

const shops = shopsWith(data);
const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures/game-worth.json"), "utf8"));
const tradeLists = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/vendor-buys.json"), "utf8"));
const gear = new Set(fixture.gear);
const key = (item) => fixture.names[item.toLowerCase()] ?? item.toLowerCase();
const known = (item) => fixture.worth[key(item)] !== undefined;
const book = shops.makePriceBook({
    key,
    worth: (item) => (known(item) ? fixture.worth[key(item)] / 10 : null),
    gear: (item) => gear.has(key(item)),
    tradeList: (trade) => tradeLists[trade] ?? [],
});
const coinsPaid = (item) => book.buyUnits(item) / 10;
const sellers = new Map();
for (const shop of shops.SHOPS) {
    for (const one of shop.sells.filter((ware) => !ware.item.startsWith("horse:"))) {
        sellers.set(key(one.item), [...(sellers.get(key(one.item)) ?? []), [shop.guild, one.rarity]]);
    }
}

test("one price for every thing: a ware two vendors sell has one rarity, and no vendor pays for a thing what any vendor asks for it (2026-11-03: the cow's hide, the copper, the salt, the linen and the hops were bought dearer than sold)", () => {
    for (const [item, list] of sellers) {
        assert.equal(new Set(list.map(([, rarity]) => rarity)).size, 1, `${item} is sold at one rarity: ${JSON.stringify(list)}`);
        const asked = shops.RARITY_COINS[list[0][1]];
        assert.ok(coinsPaid(item) < asked, `${item}: paid ${coinsPaid(item)}, asked ${asked}`);
    }
    assert.deepEqual([coinsPaid("special_cowSkin"), book.home("special_cowSkin")], [2.4, "venatores"], "the hide: 6 coins on the shelf, 2.4 back, at the hunter's only (the apothecary paid 7.2)");
    assert.deepEqual([coinsPaid("bsmt_copper"), book.home("bsmt_copper")], [2.4, "fabri-ferrarii"], "the copper: 6 on the smith's shelf, 2.4 back (the Coletor paid 7.2)");
    assert.deepEqual([coinsPaid("loot_salt"), book.home("loot_salt")], [0.8, "tabernarii"], "the salt (the Coletor paid 2.4 for the tavern's 2)");
    assert.deepEqual([coinsPaid("loot_cloth"), book.home("loot_cloth")], [0.8, "artifices"], "the linen (the farmer paid 2.4 for the seamstress's 2)");
    assert.deepEqual([coinsPaid("kcdc-craft:lupulo"), book.home("kcdc-craft:lupulo")], [0.8, "tabernarii"], "the hops (the farmer paid 2.4 for the tavern's 2)");
});

test("each thing is bought by the vendors of one guild only: the seller buys back, the herbs are the apothecary's, the harvest the farmer's, the trees' and rocks' finds the Coletor's, the rest the station's that makes it", () => {
    const owners = new Map();
    for (const shop of shops.SHOPS) {
        for (const item of book.buyList(shop.guild)) {
            owners.set(key(item), [...(owners.get(key(item)) ?? []), shop.guild]);
        }
    }
    const twice = [...owners].filter(([, guilds]) => guilds.length > 1);
    assert.deepEqual(twice, [], "84 things were bought by two or three guilds");
    const home = (item) => book.home(item);
    assert.deepEqual(["special_deerSkin", "skin_sheep", "deerMeat", "deerMeatSmoked"].map(home), ["venatores", "venatores", "venatores", "venatores"]);
    assert.deepEqual(["bsmt_ironGood", "bsmt_steelBad", "special_charcoal", "horseshoeMilitary", "bow_b", "shortswordCommon"].map(home), Array(6).fill("fabri-ferrarii"));
    assert.deepEqual(["kcdc-craft:lenha", "kcdc-craft:minerio-prata", "special_sulfur"].map(home), ["collectores", "collectores", "collectores"]);
    assert.deepEqual(["carrot", "apple", "kcdc-craft:trigo", "walnuts"].map(home), ["agricolae", "agricolae", "agricolae", "agricolae"]);
    assert.deepEqual(["herb_marigold", "herb_belladona", "potion_marigold", "potion_aquaVitalis_best"].map(home), Array(4).fill("alchemistae"));
    assert.deepEqual(["water", "bread", "kcdc-craft:farinha"].map(home), ["tabernarii", "tabernarii", "tabernarii"]);
    assert.equal(home("kcdc-craft:lasca"), null, "the chip of stone is the rocks' nothing: nobody buys it");
    for (const shop of shops.SHOPS) {
        assert.ok(book.buyList(shop.guild).every((item) => book.home(item) === shop.guild), `${shop.guild} buys only its own`);
    }
});

test("what the trades make is worth what goes into it: no vendor pays for a piece more than its recipe's things cost on the vendors' shelves, so buying them to make it and selling it back never pays", () => {
    const shelf = new Map([...sellers].map(([item, list]) => [item, shops.RARITY_COINS[list[0][1]]]));
    let checked = 0;
    for (const recipe of data.CRAFT_RECIPES) {
        if (book.home(recipe.output) === null || !recipe.ingredients.every(([item]) => shelf.has(key(item)))) {
            continue;
        }
        const cost = recipe.ingredients.reduce((sum, [item, amount]) => sum + shelf.get(key(item)) * amount, 0) / recipe.amount;
        assert.ok(coinsPaid(recipe.output) <= cost + 0.1, `${recipe.id}: costs ${cost.toFixed(2)} on the shelves, a vendor pays ${coinsPaid(recipe.output)}`);
        checked += 1;
    }
    assert.ok(checked > 300, `${checked} recipes of things bought on the shelves`);
});

test("the old money: a potion of the best quality of a coin's worth of herbs paid 20 coins, any sword, bow or crossbow 60; now what goes into them, with the level's premium", () => {
    assert.equal(coinsPaid("potion_aquaVitalis_best"), 8, "Aqua Vitalis do Henry: 2 dandelions, a marigold and water, at the 30th level");
    assert.equal(coinsPaid("potion_aquaVitalis"), 4, "the weak one, at the 3rd");
    assert.ok(coinsPaid("shortswordCommon") < 20, `the military sword: ${coinsPaid("shortswordCommon")}`);
    assert.ok(coinsPaid("huntingSwordBasic") < 10, `the bandits' hunting sword: ${coinsPaid("huntingSwordBasic")}`);
    assert.ok(coinsPaid("bow_b") < 10, `the village bow: ${coinsPaid("bow_b")}`);
    assert.ok(coinsPaid("crossbowLightCheap01") < 20, `the old hunting crossbow: ${coinsPaid("crossbowLightCheap01")}`);
});

test("gear no trade of the realm makes is at most a rare thing's price, however much the game says it is worth", () => {
    const made = new Set(data.CRAFT_RECIPES.flatMap((recipe) => [recipe.output, ...(recipe.variants ?? []).map(([variant]) => variant)]).map(key));
    const loot = shops.SHOPS.flatMap((shop) => book.buyList(shop.guild)).filter((item) => gear.has(key(item)) && !made.has(key(item)) && !sellers.has(key(item)) && known(item));
    assert.ok(loot.length > 5, `${loot.length} pieces of loot gear are bought`);
    for (const item of loot) {
        assert.ok(coinsPaid(item) <= 7.2, `${item}: ${coinsPaid(item)}`);
    }
});

test("a recipe's worth: its raw things, the steps of the chain undone, and a twentieth more for each of its levels, never more than its rarity; a loop of recipes ends; an unknown thing is common", () => {
    const tiny = shopsWith({ FARM_CROPS: [] });
    const shop = (guild, sells, buys = []) => ({ guild, trade: guild, npcName: "", female: false, outfit: "", greeting: "", sells, buys, buysOf: "" });
    const recipe = (id, output, ingredients, level, amount = 1, station = "forja") => ({ id, station, category: "", output, amount, ingredients, level, xp: 1, seconds: 1 });
    const worth = { ore: 1, ingot: 10, blade: 500, ring: 20, a: 1, b: 1, cheap: 1 };
    const prices = tiny.makePriceBook(
        { key: (item) => item, worth: (item) => worth[item] ?? null, gear: (item) => item === "blade", tradeList: () => [] },
        {
            shops: [shop("smith", [{ item: "ore", rarity: "comum", amount: 1 }], ["ingot", "blade", "ring", "a"])],
            recipes: [
                recipe("r1", "ingot", [["ore", 2]], 0),
                recipe("r2", "blade", [["ingot", 3], ["ore", 1]], 20),
                recipe("r3", "a", [["b", 1]], 0),
                recipe("r4", "b", [["a", 1]], 0),
                recipe("r5", "cheap", [["ore", 3]], 0),
            ],
            processes: [],
            crops: [],
        },
    );
    assert.equal(prices.coins("ingot"), 4, "two ores of 2 coins, at the level 0");
    assert.equal(prices.coins("blade"), 28, "(3 ingots of 4 and an ore of 2) x (1 + 20/20)");
    assert.equal(prices.buyUnits("blade"), 112, "a vendor pays 40%: 11.2 coins, the raw things on the shelf would cost 14");
    assert.equal(prices.coins("cheap"), 2, "three ores go into it, but the game says it is worth a coin: never more than its rarity");
    assert.equal(prices.coins("ring"), 18, "no recipe, worth 20 coins: a rare thing");
    assert.ok(Number.isFinite(prices.coins("a")), "a loop of recipes ends");
    assert.equal(prices.coins("nothing-known"), 2, "a thing the game does not know is common");
    assert.equal(prices.home("blade"), "fabri-ferrarii", "what the forge makes is the smiths' to buy, whoever else names it");
    assert.equal(prices.home("ring"), "smith", "what no station makes, the vendor that names it");
    assert.equal(prices.home("ore"), "smith", "what a vendor sells, that vendor buys back");
});
