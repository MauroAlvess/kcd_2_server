"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

// What a change of guild or of citizenship costs (src/server/change-fee.ts, 2026-10-26: "tanto as guildas como a cidadania, o jogador pode
// alterar uma vez grátis; depois custa 100 moedas"): the free change first, then 100 coins out of the bag.

function load({ coinsOf = {} } = {}) {
    const state = { free: new Set(), purse: new Map(Object.entries(coinsOf).map(([steamId, coins]) => [steamId, coins * 10])), takeFails: false };
    const context = {
        exports: {},
        require: (id) => ({
            "./free-changes.js": {
                CHANGE_PRICE_COINS: 100,
                freeChangeLeft: (steamId, kind) => state.free.has(`${steamId}:${kind}`),
                useFreeChange: (steamId, kind) => state.free.delete(`${steamId}:${kind}`),
            },
            "./money.js": {
                MONEY_UNIT: 10,
                coins: (units) => `${units / 10} ${units / 10 === 1 ? "moeda" : "moedas"}`,
                moneyOf: (player) => state.purse.get(player.steamId) ?? 0,
                takeMoney: (player, units) => {
                    if (state.takeFails) return false;
                    state.purse.set(player.steamId, (state.purse.get(player.steamId) ?? 0) - units);
                    return true;
                },
                giveMoney: (player, units) => {
                    state.purse.set(player.steamId, (state.purse.get(player.steamId) ?? 0) + units);
                    return true;
                },
            },
        })[id] ?? assert.fail(`unexpected require ${id}`),
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/change-fee.js"), "utf8"), context);
    return { api: context.exports, state };
}

const HANS = { steamId: "76561198000000002" };

test("the price is a hundred of the coins the player reads, which is a thousand units of the money item (the game shows a tenth)", () => {
    assert.equal(load().api.CHANGE_PRICE_UNITS, 1000);
});

test("the free change is the first payment: it is spent, nothing is taken, and a refund of it gives nothing back", () => {
    const sut = load({ coinsOf: { [HANS.steamId]: 500 } });
    sut.state.free.add(`${HANS.steamId}:guild`);
    const fee = sut.api.chargeForChange(HANS, "guild");
    assert.equal(fee.ok, true);
    assert.equal(fee.free, true);
    assert.equal(sut.state.free.has(`${HANS.steamId}:guild`), false, "spent");
    assert.equal(sut.state.purse.get(HANS.steamId), 5000, "no coins taken");
    fee.refund();
    assert.equal(sut.state.purse.get(HANS.steamId), 5000);
});

test("the free change of one kind does not pay for the other kind", () => {
    const sut = load({ coinsOf: { [HANS.steamId]: 0 } });
    sut.state.free.add(`${HANS.steamId}:guild`);
    const fee = sut.api.chargeForChange(HANS, "citizenship");
    assert.equal(fee.ok, false);
    assert.equal(sut.state.free.has(`${HANS.steamId}:guild`), true, "the guild's free change is still there");
});

test("after it every change costs 100 coins: refused with the price and what the player has when short, taken when not, and handed back by a refund", () => {
    const poor = load({ coinsOf: { [HANS.steamId]: 99.9 } });
    const refused = poor.api.chargeForChange(HANS, "guild");
    assert.equal(refused.ok, false);
    assert.equal(refused.message, "Trocar custa 100 moedas (a sua troca gratuita já foi usada) e você tem 99.9 moedas.");
    assert.equal(poor.state.purse.get(HANS.steamId), 999, "nothing taken from a purse that is short");

    const rich = load({ coinsOf: { [HANS.steamId]: 130 } });
    const paid = rich.api.chargeForChange(HANS, "citizenship");
    assert.deepEqual([paid.ok, paid.free, paid.message], [true, false, ""]);
    assert.equal(rich.state.purse.get(HANS.steamId), 300, "100 coins taken");
    paid.refund();
    assert.equal(rich.state.purse.get(HANS.steamId), 1300, "a change that failed after all gives them back");

    const exact = load({ coinsOf: { [HANS.steamId]: 100 } });
    assert.equal(exact.api.chargeForChange(HANS, "guild").ok, true, "exactly the price is enough");
    assert.equal(exact.state.purse.get(HANS.steamId), 0);
});

test("a purse the game will not take from, and a player with no Steam id, are refused with the reason", () => {
    const sut = load({ coinsOf: { [HANS.steamId]: 500 } });
    sut.state.takeFails = true;
    const fee = sut.api.chargeForChange(HANS, "guild");
    assert.equal(fee.ok, false);
    assert.match(fee.message, /As moedas não puderam ser cobradas agora/);
    assert.equal(sut.state.purse.get(HANS.steamId), 5000);
    const nobody = sut.api.chargeForChange({ steamId: "" }, "guild");
    assert.equal(nobody.ok, false);
    assert.match(nobody.message, /identificação Steam/);
});
