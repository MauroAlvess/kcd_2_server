"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const dist = (name) => fs.readFileSync(path.join(__dirname, "../dist/server", name), "utf8");
const plain = (value) => JSON.parse(JSON.stringify(value));

// What the guild vendors sell, buy and charge (src/server/guild-shops.ts, 2026-10-31).
const CROPS = [
    { id: "cebola", seed: "kcdc-craft:semente-cebola", harvest: "guid-cebola", category: "Legumes" },
    { id: "repolho", seed: "kcdc-craft:semente-repolho", harvest: "guid-repolho", category: "Legumes" },
    { id: "linho", seed: "kcdc-craft:semente-linho", harvest: "guid-linho", category: "Fibras" },
    { id: "trigo", seed: "kcdc-craft:semente-trigo", harvest: "kcdc-craft:trigo", category: "Grãos" },
    { id: "salvia", seed: "kcdc-craft:semente-salvia", harvest: "guid-salvia", category: "Ervas" },
    { id: "maca", seed: "kcdc-craft:semente-maca", harvest: "guid-maca", category: "Frutas" },
];

function load(crops = CROPS) {
    const sandbox = {
        exports: {},
        require: (id) => ({ "./craft-data.js": { FARM_CROPS: crops }, "./money.js": { MONEY_UNIT: 10 } })[id] ?? assert.fail(`unexpected require ${id}`),
    };
    vm.runInNewContext(dist("guild-shops.js"), sandbox);
    return sandbox.exports;
}

const GUILDS = ["fabri-ferrarii", "venatores", "tabernarii", "alchemistae", "artifices", "collectores", "agricolae", "domitores"];

test("the farmer's shelf with the real plants is a day's worth that fits the purse whole: 15 carrots, 15 apples, 3 of each plain seed, 2 of each new fruit's (2026-11-02)", () => {
    const real = { exports: {} };
    vm.runInNewContext(dist("craft-data.js"), real);
    const s = load(real.exports.FARM_CROPS);
    const farmer = s.shopOfGuild("agricolae");
    assert.ok(s.shelfCoins(farmer.sells) <= s.BUDGET_COINS, `worth ${s.shelfCoins(farmer.sells)} coins`);
    assert.deepEqual(plain(s.nominalShelf(farmer)), plain(farmer.sells), "nothing is cut down");
    const of = (item) => farmer.sells.find((one) => one.item === item);
    const harvest = (id) => real.exports.FARM_CROPS.find((crop) => crop.id === id).harvest;
    // By the class the harvest is bought back under: a name beside it was a second row of one class, and the game refused the whole buying list (2026-11-02).
    assert.deepEqual([of(harvest("cenoura")).amount, of(harvest("maca")).amount, of(harvest("cenoura")).rarity], [15, 15, "comum"]);
    assert.equal(of("carrot"), undefined, "not by the game's name");
    assert.ok(farmer.buys.includes(harvest("cenoura")) && farmer.buys.includes(harvest("maca")), "the same class it buys back");
    assert.equal(of("kcdc-craft:semente-rabanete").amount, 3);
    assert.deepEqual([of("kcdc-craft:semente-cereja").amount, of("kcdc-craft:semente-cereja").rarity], [2, "incomum"]);
    assert.equal(of("kcdc-craft:semente-salvia"), undefined, "the herbs are the apothecary's");
    assert.ok(farmer.sells.length <= s.MAX_ROWS);
});

test("a price is its rarity's and nothing else: five rarities, each dearer than the last, and a vendor pays less than it asks (40%)", () => {
    const s = load();
    assert.deepEqual(plain(s.RARITY_COINS), { comum: 2, incomum: 6, raro: 18, "muito-raro": 50, excepcional: 150 });
    const order = ["comum", "incomum", "raro", "muito-raro", "excepcional"];
    for (let at = 1; at < order.length; at += 1) {
        assert.ok(s.RARITY_COINS[order[at]] > s.RARITY_COINS[order[at - 1]], `${order[at]} costs more than ${order[at - 1]}`);
    }
    assert.equal(s.priceUnits("comum"), 20, "the game's units are a tenth of a coin");
    assert.equal(s.priceUnits("excepcional"), 1500);
    assert.equal(s.buyUnits("comum"), 8);
    assert.equal(s.buyUnits("raro"), 72);
    for (const rarity of order) assert.ok(s.buyUnits(rarity) < s.priceUnits(rarity), `${rarity}: it pays less than it asks`);
});

test("the rarity of what a vendor only buys comes from what the game says it is worth, in bands", () => {
    const s = load();
    assert.equal(s.rarityFromWorth(0), "comum");
    assert.equal(s.rarityFromWorth(4), "comum");
    assert.equal(s.rarityFromWorth(4.1), "incomum");
    assert.equal(s.rarityFromWorth(15), "incomum");
    assert.equal(s.rarityFromWorth(40), "raro");
    assert.equal(s.rarityFromWorth(61), "muito-raro");
    assert.equal(s.rarityFromWorth(200), "muito-raro");
    assert.equal(s.rarityFromWorth(500), "excepcional");
});

test("there is one vendor for each of the eight guilds; none sells more than a purse's worth (300 coins), and all say how they greet", () => {
    const s = load();
    assert.deepEqual(plain(s.SHOPS.map((shop) => shop.guild)).sort(), [...GUILDS].sort());
    assert.equal(new Set(s.SHOPS.map((shop) => shop.trade)).size, 8, "the trades the posts' ids carry are all different");
    for (const shop of s.SHOPS) {
        const worth = s.shelfCoins(s.nominalShelf(shop));
        assert.ok(worth > 0 && worth <= s.BUDGET_COINS, `${shop.trade}: its shelf is worth ${worth} coins`);
        assert.equal(new Set(shop.sells.map((one) => one.item)).size, shop.sells.length, `${shop.trade}: no ware twice`);
        assert.ok(shop.greeting.length > 10 && shop.greeting.length < 140, `${shop.trade}: a line to say`);
        for (const one of shop.sells) {
            assert.ok(one.rarity in s.RARITY_COINS && one.amount > 0, `${shop.trade}: ${one.item}`);
        }
        assert.ok(shop.buys.length > 0 || shop.buysOf !== "", `${shop.trade}: buys the goods of its trade`);
    }
});

test("each vendor sells only the basic things of its own trade, as the order says", () => {
    const s = load();
    const sells = (guild) => plain(s.shopOfGuild(guild).sells.map((one) => one.item));
    // The smith: repair kits and the metal of the forge.
    const smith = sells("fabri-ferrarii");
    assert.ok(smith.filter((item) => item.startsWith("repairKit_")).length >= 3, "repair kits");
    assert.ok(smith.every((item) => item.startsWith("repairKit_") || item.startsWith("bsmt_") || item === "special_charcoal"), "and only forge things");
    // The hunter: skins and arrows.
    assert.ok(sells("venatores").every((item) => /Skin|skin_|^arrow_/.test(item)), "the hunter sells skins and arrows");
    assert.ok(sells("venatores").some((item) => item.startsWith("arrow_")) && sells("venatores").some((item) => /Skin|skin_/.test(item)));
    // The Coletor: an axe and a pick.
    assert.deepEqual(sells("collectores"), [s.AXE_ITEM, s.PICK_ITEM]);
    // The tavern keeper: ingredients.
    assert.ok(sells("tabernarii").includes("kcdc-craft:farinha") && sells("tabernarii").includes("egg") && sells("tabernarii").includes("water"));
    // The farmer: the horses' carrots and apples (2026-11-02), by the class of the garden's harvest when there is one (the apple here; no carrot is grown in this list), and the seeds
    // of the plain crops (vegetables, grains, flax), none of the herbs nor of the older fruit.
    assert.deepEqual(sells("agricolae"), ["carrot", "guid-maca", "kcdc-craft:semente-cebola", "kcdc-craft:semente-repolho", "kcdc-craft:semente-linho", "kcdc-craft:semente-trigo"]);
    // The apothecary: flowers and drinking water.
    assert.ok(sells("alchemistae").every((item) => item.startsWith("herb_") || item === "water") && sells("alchemistae").includes("water"));
    assert.ok(!sells("alchemistae").some((item) => /belladona|nightshade|paris/.test(item)), "no poison on a plain shelf");
    // The tamer: a plain horse, and what a horse is fed.
    assert.ok(sells("domitores").every((item) => ["carrot", "apple", "pear", "beet", "turnip"].includes(item)), "the horses are no row of the shelf");
    // The artisan: thread, linen and hides.
    assert.ok(sells("artifices").includes("kcdc-craft:linha") && sells("artifices").includes("loot_cloth"));
    // What a vendor buys is its own trade's: the farmer the crops, the Coletor the finds of the trees and the rocks, the tamer the feed.
    const buys = (guild) => plain(s.shopOfGuild(guild).buys);
    assert.ok(buys("agricolae").includes("guid-cebola") && buys("agricolae").includes("kcdc-craft:trigo"));
    assert.ok(buys("collectores").includes("kcdc-craft:lenha"));
    assert.ok(buys("domitores").includes("carrot") && !buys("domitores").includes("bsmt_ironBad"));
});

test("the tamer's three weakest horses all cost 400 coins (200 until 2026-11-02), sold under their breed and 'Pangaré', and are no row of the trade screen (2026-10-31)", () => {
    const s = load();
    assert.deepEqual(plain(s.HORSES.map((horse) => [horse.id, horse.breed, horse.coins])), [["pebbles", "pebbles", 400], ["cavalo-comum", "", 400], ["bitterklee", "bitterklee", 400]]);
    assert.deepEqual(plain(s.HORSES.map((horse) => horse.label)), ["Pebbles - Pangaré", "Montaria - Pangaré", "Bitterklee - Pangaré"]);
    // And four carts at 800 (2026-11-02).
    assert.equal(s.CART_COINS, 800);
    assert.deepEqual(plain(s.CARTS.map((cart) => cart.id)), ["cart_b", "wagon_b", "wagon_b_covered", "wagon_a_cloth_carpets"]);
    assert.ok(s.TRADE_NUDGES.length >= 2 && s.TRADE_NUDGES.every((line) => /neg[oó]ci/i.test(line)), "every vendor sends the buyer to the players first");
    assert.equal(s.isHorseKey("horse:cavalo-comum"), true);
    assert.equal(s.isHorseKey("carrot"), false);
    assert.equal(s.horseOf("horse:pebbles").label, "Pebbles - Pangaré");
    assert.equal(s.horseOf("carrot"), undefined);
    const tamer = s.shopOfGuild("domitores");
    assert.ok(!s.nominalShelf(tamer).some((one) => one.item.startsWith("horse:")));
    assert.ok(s.shelfCoins(tamer.sells) <= s.BUDGET_COINS);
});

test("a shelf worth more than a purse is scaled down together; one worth less is left as written", () => {
    const s = load();
    const rich = { guild: "x", trade: "x", npcName: "x", female: false, outfit: "", greeting: "x", buysOf: "", buys: [], sells: [{ item: "a", rarity: "raro", amount: 20 }, { item: "b", rarity: "comum", amount: 100 }] };
    assert.equal(s.shelfCoins(rich.sells), 20 * 18 + 100 * 2);
    const scaled = plain(s.nominalShelf(rich));
    assert.ok(s.shelfCoins(scaled) <= s.BUDGET_COINS && s.shelfCoins(scaled) > 250, "close under the purse");
    assert.ok(scaled.find((one) => one.item === "a").amount < 20 && scaled.find((one) => one.item === "b").amount < 100);
    const poor = { ...rich, sells: [{ item: "a", rarity: "comum", amount: 5 }] };
    assert.deepEqual(plain(s.nominalShelf(poor)), plain(poor.sells));
    // A ware scaled to nothing is left off.
    const lopsided = { ...rich, sells: [{ item: "a", rarity: "excepcional", amount: 1 }, { item: "b", rarity: "comum", amount: 400 }] };
    assert.ok(!s.nominalShelf(lopsided).some((one) => one.item === "a"));
});

test("what a player has with a vendor: a full shelf and purse at first, what was bought is gone, the purse never grows, and a day later it is all full again", () => {
    const s = load();
    const smith = s.shopOfGuild("fabri-ferrarii");
    const day = 24 * 60 * 60_000;
    const fresh = s.freshRecord(smith, 1000);
    assert.equal(fresh.purse, 3000, "300 coins, in the game's units");
    assert.equal(fresh.left.bsmt_ironBad, 20);
    assert.equal(s.isUntouched(smith, fresh), true);

    const after = s.afterDeal(fresh, [{ item: "bsmt_ironBad", amount: 5 }, { item: "repairKit_armourSmall", amount: 2 }, { item: "not-a-ware", amount: 9 }], 2500);
    assert.equal(after.left.bsmt_ironBad, 15);
    assert.equal(after.left.repairKit_armourSmall, 0);
    assert.equal(after.purse, 2500);
    assert.equal(s.isUntouched(smith, after), false);
    // What the player paid went into the vendor's purse, and does not stay there: the purse is only ever the smaller.
    assert.equal(s.afterDeal(after, [], 2900).purse, 2500);
    assert.equal(s.afterDeal(after, [{ item: "bsmt_ironBad", amount: 99 }], null).left.bsmt_ironBad, 0, "never below nothing");

    // Kept inside the day; fresh after it; nothing kept is a fresh one.
    assert.deepEqual(plain(s.currentRecord(smith, after, 1000 + day - 1)), plain(after));
    const next = s.currentRecord(smith, after, 1000 + day);
    assert.equal(next.since, 1000 + day);
    assert.equal(next.left.bsmt_ironBad, 20);
    assert.equal(next.purse, 3000);
    assert.equal(s.currentRecord(smith, undefined, 5000).since, 5000);
    // A clock gone back, and a record with nonsense in it, are met with a fresh one or put right.
    assert.equal(s.currentRecord(smith, after, 500).since, 500);
    const garbled = s.currentRecord(smith, { since: 1000, left: { bsmt_ironBad: 9999, special_charcoal: "x", gone: 4 }, purse: -5 }, 2000);
    assert.equal(garbled.left.bsmt_ironBad, 20, "no more than the shelf had");
    assert.equal(garbled.left.special_charcoal, 20, "nonsense is the full shelf");
    assert.equal(garbled.left.gone, undefined);
    assert.equal(garbled.purse, 0);
});

test("the farmer's shelf follows the crops of the realm: a plain crop added is a seed on it", () => {
    const s = load([...CROPS, { id: "nabo", seed: "kcdc-craft:semente-nabo", harvest: "guid-nabo", category: "Legumes" }]);
    assert.ok(s.shopOfGuild("agricolae").sells.some((one) => one.item === "kcdc-craft:semente-nabo"));
    assert.ok(s.shopOfGuild("agricolae").buys.includes("guid-nabo"));
    for (const one of s.shopOfGuild("agricolae").sells) assert.equal(one.rarity, "comum");
});
