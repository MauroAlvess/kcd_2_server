const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

/** The dice handlers over a stand-in lobby and pot: what each player is told when a match ends, and what goes to the log. */
function load({ settled = null, rolls = 0 } = {}) {
    const handlers = new Map();
    const chat = [];
    const logs = [];
    const calls = { load: 0, rolled: [], delivered: [], settle: [] };
    let rollCount = 0;
    const dicePots = {
        load: () => { calls.load += 1; },
        rolled: (match) => { calls.rolled.push(match); rollCount += 1; return rollCount; },
        rollsOf: () => rolls,
        deliver: (player) => calls.delivered.push(player.steamId),
        settle: (...args) => { calls.settle.push(args.slice(0, 4).map((value) => (value && typeof value === "object" ? value.steamId : value))); return settled; },
    };
    const context = {
        exports: {},
        require: (id) => {
            if (id === "../acquaintances.js") return { labelFor: (_viewer, target) => target.nickname };
            if (id === "../dice-pot.js") return { dicePots, coinsText: (coins) => `${coins} ${coins === 1 ? "moeda" : "moedas"}` };
            if (id === "../dice.js") return { diceLobby: { install() {} } };
            if (id === "../players.js") return { findPlayer: () => ({ error: "no" }) };
            return assert.fail(`unexpected require ${id}`);
        },
        console: { log: (line) => logs.push(line) },
        Chat: { sendToPlayer: (player, text) => chat.push({ to: player.steamId, text }) },
        Events: { on: (name, fn) => handlers.set(name, fn) },
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/commands/dice.js"), "utf8"), context);
    context.exports.installDiceHandlers();
    const ana = { id: 1, steamId: "ana", nickname: "Ana" };
    const bia = { id: 2, steamId: "bia", nickname: "Bia" };
    const told = (steamId) => chat.filter((entry) => entry.to === steamId).map((entry) => entry.text);
    return { handlers, chat, logs, calls, ana, bia, told };
}

test("a match won with a stake: the winner is told they took it, the loser what they lost, and both of their dice", () => {
    const sut = load({ settled: { played: true, stake: 10, outcome: "won", winner: 0, pot: 20, itemsBack: [1, 0] }, rolls: 9 });
    assert.equal(sut.calls.load, 1, "what a restart left open is read at start");
    sut.handlers.get("diceMatchEnd")(5, sut.ana, sut.bia, 0, "won", 2000, 850);
    assert.deepEqual(sut.calls.settle, [[5, "ana", "bia", 0]]);
    assert.deepEqual(sut.told("ana"), ["Você venceu o jogo de dados, 2000 a 850.", "Você levou a aposta: 20 moedas.", "Seus dados voltaram para o inventário."]);
    assert.deepEqual(sut.told("bia"), ["Ana venceu o jogo de dados, 2000 a 850.", "Você perdeu a aposta (10 moedas)."]);
    assert.ok(sut.logs.includes("diceMatchEnd: match 5 won, seat 0 won, 2000 : 850, 9 lance(s)"));
});

test("a match left before the first throw says so, and the stake comes back", () => {
    const sut = load({ settled: { played: false, stake: 5, outcome: "refunded", winner: 1, pot: 0, itemsBack: [0, 0] } });
    sut.handlers.get("diceMatchEnd")(2, sut.ana, sut.bia, 1, "gaveUp", 0, 0);
    for (const steamId of ["ana", "bia"]) {
        assert.deepEqual(sut.told(steamId), ["O jogo de dados acabou antes do primeiro lance (alguém saiu da mesa).", "Ninguém chegou a jogar: a sua aposta voltou para você."]);
    }
});

test("no winner after play gives the stake back; a match with nothing held says only how it ended; a player gone is skipped", () => {
    const stopped = load({ settled: { played: true, stake: 5, outcome: "refunded", winner: null, pot: 0, itemsBack: [0, 0] } });
    stopped.handlers.get("diceMatchEnd")(3, stopped.ana, null, 255, "stopped", 300, 200);
    assert.deepEqual(stopped.told("ana"), ["O jogo de dados acabou sem vencedor (o jogo foi interrompido).", "Sem vencedor: a sua aposta voltou para você."]);

    const plain = load({ settled: null });
    plain.handlers.get("diceMatchEnd")(4, plain.ana, plain.bia, 1, "won", 100, 2000);
    assert.deepEqual(plain.told("ana"), ["Bia venceu o jogo de dados, 100 a 2000."]);
    assert.deepEqual(plain.told("bia"), ["Você venceu o jogo de dados, 100 a 2000."]);
});

test("the first turn and the first throw of a match go to the log; the dice owed are handed back when the inventory is ready", () => {
    const sut = load();
    sut.handlers.get("diceTurnStart")({ match: 6, turn: 1, seat: 1 });
    sut.handlers.get("diceTurnStart")({ match: 6, turn: 2, seat: 0 });
    sut.handlers.get("diceRoll")({ match: 6, seat: 1, faces: [1, 5, 3, 3, 6, 2] });
    sut.handlers.get("diceRoll")({ match: 6, seat: 1, faces: [4, 4] });
    assert.deepEqual(sut.logs.filter((line) => line.startsWith("dice: partida 6")), ["dice: partida 6: a primeira vez é do assento 1", "dice: partida 6: primeiro lance, do assento 1 (1 5 3 3 6 2)"]);
    assert.deepEqual(sut.calls.rolled, [6, 6]);
    sut.handlers.get("playerInventoryReady")(sut.ana);
    assert.deepEqual(sut.calls.delivered, ["ana"]);
});
