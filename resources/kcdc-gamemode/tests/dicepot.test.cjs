const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const MONEY_GUID = "5ef63059-322e-4e1b-abe8-926e100c770e";
const DIE = "65ccc0cd-de18-4305-9d64-42bb3c6d8d30";
const BADGE = "b26e6c86-2970-4106-a25b-9e4ffa181979";
const SWORD = "11111111-2222-3333-4444-555555555555";

/**
 * The pot over a fake inventory: rows by Steam id, money in units (ten to a coin), and a file the test can read and seed.
 * `full` holds the Steam ids whose inventory takes nothing more.
 */
function load({ file = undefined } = {}) {
    const inventories = new Map();
    const state = { full: new Set(), removeFails: new Set(), stored: file, logs: [], chat: [], notified: [] };
    let nextRow = 1;
    const context = {
        exports: {},
        require: (id) => {
            assert.equal(id, "./store.js");
            return {
                ensureDir() {},
                read: () => (state.stored === undefined ? { status: "missing" } : { status: "ok", value: JSON.parse(JSON.stringify(state.stored)), fromBackup: false }),
                write: (_file, value) => { state.stored = JSON.parse(JSON.stringify(value)); },
            };
        },
        console: { log: (line) => state.logs.push(line), error: (line) => state.logs.push(line) },
        Chat: { sendToPlayer: (player, text) => state.chat.push({ to: player.steamId, text }) },
        Inventory: {
            get: (player) => ({ items: (inventories.get(player.steamId) ?? []).map((row) => ({ ...row, metadata: { ...row.metadata } })) }),
            remove: (player, request) => {
                if (state.removeFails.has(player.steamId)) return { ok: false };
                const rows = inventories.get(player.steamId) ?? [];
                for (const unit of request.units) {
                    const row = rows.find((candidate) => candidate.id === unit.id);
                    if (row === undefined || row.amount < unit.amount) return { ok: false };
                }
                for (const unit of request.units) rows.find((candidate) => candidate.id === unit.id).amount -= unit.amount;
                inventories.set(player.steamId, rows.filter((row) => row.amount > 0));
                return { ok: true };
            },
            add: (player, request) => {
                if (state.full.has(player.steamId)) return { ok: false };
                const money = request.item === "money";
                const rows = inventories.get(player.steamId) ?? [];
                rows.push({ id: `r${nextRow++}`, item: money ? MONEY_GUID : request.item, name: money ? "money" : "thing", amount: request.amount, metadata: { ...(request.metadata ?? {}) } });
                inventories.set(player.steamId, rows);
                return { ok: true };
            },
        },
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/dice-pot.js"), "utf8"), context);
    const pots = new context.exports.DicePots();
    const player = (steamId, rows = []) => {
        inventories.set(steamId, rows.map((row) => ({ id: `r${nextRow++}`, name: row.item === MONEY_GUID ? "money" : "thing", metadata: {}, ...row })));
        return { steamId, nickname: steamId, emit: (_event, payload) => state.notified.push({ to: steamId, text: JSON.parse(payload).text }) };
    };
    const money = (coins) => ({ item: MONEY_GUID, amount: coins * 10 });
    const coins = (steamId) => (inventories.get(steamId) ?? []).filter((row) => row.item === MONEY_GUID).reduce((sum, row) => sum + row.amount, 0) / 10;
    const items = (steamId, item) => (inventories.get(steamId) ?? []).filter((row) => row.item === item).reduce((sum, row) => sum + row.amount, 0);
    return { api: context.exports, pots, state, player, money, coins, items, inventories };
}

test("the stake is taken from both, across money rows, and the dice and badges come out of the inventory; nothing else does", () => {
    const sut = load();
    const ana = sut.player("ana", [sut.money(3), sut.money(10), { item: DIE, amount: 6 }, { item: BADGE, amount: 1 }, { item: SWORD, amount: 1 }]);
    const bia = sut.player("bia", [sut.money(50)]);
    assert.equal(sut.pots.coinsOf(ana), 13);

    const pot = sut.pots.hold(ana, bia, 10);
    assert.ok(!("short" in pot));
    assert.equal(sut.coins("ana"), 3);
    assert.equal(sut.coins("bia"), 40);
    assert.equal(sut.items("ana", DIE), 0);
    assert.equal(sut.items("ana", BADGE), 0);
    assert.equal(sut.items("ana", SWORD), 1, "a sword is no die");
    assert.deepEqual(JSON.parse(JSON.stringify(pot.seats[0].items)).map((row) => [row.item, row.amount]), [[DIE, 6], [BADGE, 1]]);
    assert.deepEqual(JSON.parse(JSON.stringify(pot.seats[1].items)), []);

    const kept = sut.state.stored.pots[0];
    assert.deepEqual([kept.stake, kept.seats[0].coins, kept.seats[1].coins], [10, 10, 10], "written down before anything else happens");
    assert.equal(sut.pots.isDice(DIE), true);
    assert.equal(sut.pots.isDice(SWORD), false);
});

test("one who cannot pay stops it, and nothing is taken from anybody", () => {
    const sut = load();
    const ana = sut.player("ana", [sut.money(20), { item: DIE, amount: 6 }]);
    const bia = sut.player("bia", [sut.money(4)]);
    const result = sut.pots.hold(ana, bia, 5);
    assert.equal(result.short, bia);
    assert.equal(sut.coins("ana"), 20);
    assert.equal(sut.items("ana", DIE), 6);
    assert.equal(sut.state.stored, undefined, "nothing to write down");

    // the money would not come out of the second purse after all: the first gets theirs back
    const odd = load();
    const cleo = odd.player("cleo", [odd.money(20)]);
    const dan = odd.player("dan", [odd.money(20)]);
    odd.state.removeFails.add("dan");
    assert.equal(odd.pots.hold(cleo, dan, 5).short, dan);
    assert.equal(odd.coins("cleo"), 20);
});

test("no stake: nothing is taken but the dice", () => {
    const sut = load();
    const ana = sut.player("ana", [sut.money(20), { item: DIE, amount: 6 }]);
    const bia = sut.player("bia", []);
    const pot = sut.pots.hold(ana, bia, 0);
    assert.equal(pot.stake, 0);
    assert.equal(sut.coins("ana"), 20);
    assert.equal(sut.items("ana", DIE), 0);
});

test("the winner of a match that was played takes both stakes; the dice go back to each", () => {
    const sut = load();
    const ana = sut.player("ana", [sut.money(20), { item: DIE, amount: 6 }]);
    const bia = sut.player("bia", [sut.money(20), { item: DIE, amount: 6 }]);
    const pot = sut.pots.hold(ana, bia, 10);
    sut.pots.bind(pot, 7);
    assert.ok(sut.state.logs.some((line) => /dice: partida 7: aposta de 10 moedas de cada; dados guardados durante o jogo: ana 6, bia 6/.test(line)));
    sut.pots.rolled(7);
    sut.pots.rolled(7);
    assert.equal(sut.pots.rollsOf(7), 2);

    const settled = sut.pots.settle(7, ana, bia, 1, 450, 2000);
    assert.deepEqual(JSON.parse(JSON.stringify(settled)), { played: true, stake: 10, outcome: "won", winner: 1, pot: 20, itemsBack: [1, 1] });
    assert.equal(sut.coins("ana"), 10);
    assert.equal(sut.coins("bia"), 30);
    assert.equal(sut.items("ana", DIE), 6);
    assert.equal(sut.items("bia", DIE), 6);
    assert.deepEqual(sut.state.stored.pots, [], "nothing left open");
    assert.equal(sut.pots.settle(7, ana, bia, 1, 450, 2000), null, "settled once");
});

test("a match left before the first throw, or with nobody winning, gives each their own stake back", () => {
    for (const [winner, rolls, scores, why] of [[1, 0, [0, 0], "given up at 0 : 0, nobody threw"], [255, 3, [300, 150], "stopped, no winner"]]) {
        const sut = load();
        const ana = sut.player("ana", [sut.money(20)]);
        const bia = sut.player("bia", [sut.money(20)]);
        const pot = sut.pots.hold(ana, bia, 10);
        sut.pots.bind(pot, 3);
        for (let index = 0; index < rolls; index += 1) sut.pots.rolled(3);
        const settled = sut.pots.settle(3, ana, bia, winner, scores[0], scores[1]);
        assert.equal(settled.outcome, "refunded", why);
        assert.equal(settled.played, rolls > 0, why);
        assert.equal(sut.coins("ana"), 20, why);
        assert.equal(sut.coins("bia"), 20, why);
    }
});

test("a player who has gone, or whose inventory is full, is owed, and given it at the next entry", () => {
    const sut = load();
    const ana = sut.player("ana", [sut.money(20), { item: DIE, amount: 6 }]);
    const bia = sut.player("bia", [sut.money(20)]);
    const pot = sut.pots.hold(ana, bia, 10);
    sut.pots.bind(pot, 1);
    sut.pots.rolled(1);
    const settled = sut.pots.settle(1, null, bia, 0, 2000, 0);
    assert.equal(settled.outcome, "won");
    assert.deepEqual(Array.from(settled.itemsBack), [0, 0]);
    assert.equal(sut.coins("bia"), 10);
    const owed = JSON.parse(JSON.stringify(sut.pots.owes("ana")));
    assert.deepEqual(owed.map((row) => [row.item, row.amount]), [["money", 200], [DIE, 6]], "the pot and the dice, kept for ana");
    assert.deepEqual(sut.state.stored.owed.ana.length, 2);

    const back = sut.player("ana", []);
    sut.state.full.add("ana");
    assert.equal(sut.pots.deliver(back), 0, "a full inventory keeps it owed");
    assert.equal(sut.pots.owes("ana").length, 2);
    sut.state.full.delete("ana");
    assert.equal(sut.pots.deliver(back), 2);
    assert.equal(sut.coins("ana"), 20);
    assert.equal(sut.items("ana", DIE), 6);
    assert.equal(sut.pots.owes("ana").length, 0);
    assert.match(sut.state.chat.at(-1).text, /O que estava guardado num jogo de dados \(aposta e dados\) voltou para você/);
    assert.equal(sut.pots.deliver(back), 0, "nothing more");
});

test("a match the game would not start gives everything back at once", () => {
    const sut = load();
    const ana = sut.player("ana", [sut.money(20), { item: DIE, amount: 6 }]);
    const bia = sut.player("bia", [sut.money(20)]);
    const pot = sut.pots.hold(ana, bia, 5);
    sut.pots.release(pot, [ana, bia]);
    assert.equal(sut.coins("ana"), 20);
    assert.equal(sut.coins("bia"), 20);
    assert.equal(sut.items("ana", DIE), 6);
    assert.deepEqual(sut.state.stored.pots, []);
});

test("what a restart found open is owed back to each: their stake and their dice", () => {
    const file = {
        pots: [{ match: 4, stake: 10, seats: [{ steamId: "ana", name: "ana", coins: 10, items: [{ item: DIE, amount: 6, metadata: {} }] }, { steamId: "bia", name: "bia", coins: 10, items: [] }] }],
        owed: { cleo: [{ item: "money", amount: 50, metadata: {} }], bad: [{ item: 5 }] },
    };
    const sut = load({ file });
    sut.pots.load();
    assert.deepEqual(JSON.parse(JSON.stringify(sut.pots.owes("ana"))).map((row) => [row.item, row.amount]), [[DIE, 6], ["money", 100]]);
    assert.deepEqual(JSON.parse(JSON.stringify(sut.pots.owes("bia"))).map((row) => [row.item, row.amount]), [["money", 100]]);
    assert.equal(sut.pots.owes("cleo").length, 1, "what was owed before stays owed");
    assert.equal(sut.pots.owes("bad").length, 0, "a broken row is dropped");
    assert.deepEqual(sut.state.stored.pots, []);
    assert.ok(sut.state.logs.some((line) => /1 jogo\(s\) de dados estava\(m\) aberto\(s\) quando o servidor parou/.test(line)));
    assert.equal(sut.pots.settle(4, null, null, 0, 0, 0), null, "the old match number means nothing now");
});

test("dice that will not leave the inventory are left there, and the log says the game's own screen may come up", () => {
    const sut = load();
    const ana = sut.player("ana", [{ item: DIE, amount: 6 }]);
    const bia = sut.player("bia", []);
    sut.state.removeFails.add("ana");
    const pot = sut.pots.hold(ana, bia, 0);
    assert.deepEqual(JSON.parse(JSON.stringify(pot.seats[0].items)), []);
    assert.equal(sut.items("ana", DIE), 6);
    assert.ok(sut.state.logs.some((line) => /os dados de ana não saíram do inventário/.test(line)));
});
