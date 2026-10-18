const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// Eggs in the level's nests, back every forty minutes (src/server/nests.ts).

function load({ eggKnown = true } = {}) {
    const state = { now: 1_000_000, logs: [], timeouts: [], intervals: [], players: [] };
    const stash = (guid, name, x, y) => ({
        levelGuid: guid, name, position: { x, y, z: 100 }, isOpen: false, rows: [],
        setInventory(request) { this.rows = JSON.parse(JSON.stringify(request.items)); return { ok: true, code: "" }; },
    });
    const stashes = [
        stash("n1", "Nest1[Stash/nest62_ef861b89]", 629, 3070),
        stash("n2", "Nest1[Stash/nest3_ed892ea0]", 1158, 1032),
        stash("n3", "Stash2[animalcare/henCare6:henCare_coop1[animalcare/henCare6]_45a0bc67]", 797, 3386),
        stash("t1", "Stash4[Stash/fish_trap_cage1_95edaad2]", 1898, 3783),
        stash("c1", "stash[Chest/chest3_x]", 629, 3071),
        stash("", "Nest_spawned", 0, 0),
    ];
    const context = {
        exports: {},
        require: (id) => {
            if (id === "./bandits.js") return { resolveItems: (names) => new Map(eggKnown ? names.map((name) => [name, `cls:${name}`]) : []) };
            assert.fail(`unexpected require ${id}`);
        },
        console: { log: (line) => state.logs.push(line) },
        Date: { now: () => state.now },
        Math,
        setTimeout: (fn, ms) => { state.timeouts.push({ fn, ms }); return state.timeouts.length; },
        clearTimeout() {},
        setInterval: (fn, ms) => { state.intervals.push({ fn, ms }); return state.intervals.length; },
        clearInterval() {},
        Events: { on() {} },
        Player: { all: () => state.players },
        Stash: { all: () => stashes, find: (guid) => stashes.find((entry) => entry.levelGuid === guid) ?? null },
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/nests.js"), "utf8"), context);
    let r = 0;
    const random = () => [0, 0.99, 0.5][r++ % 3];
    const nests = new context.exports.Nests(context.exports.EGGS, context.exports.nestSettings, () => state.now, random);
    const traps = new context.exports.Nests(context.exports.FISH, context.exports.nestSettings, () => state.now, random);
    return { api: context.exports, nests, traps, state, stashes, context };
}

test("the level's nests are its containers named so; a chest or a spawned bag is not one", () => {
    const sut = load();
    assert.equal(sut.nests.find(sut.stashes), 3, "two bird's nests and a hen coop");
    assert.equal(sut.nests.find(sut.stashes), 3, "found once");
});

test("each nest gets one to three eggs, and again forty minutes later, not before", () => {
    const sut = load();
    sut.nests.find(sut.stashes);
    assert.equal(sut.nests.fill([]), 3);
    assert.deepEqual(sut.stashes.slice(0, 3).map((stash) => stash.rows[0].amount), [3, 1, 2], "one to three each, by the dice");
    assert.ok(sut.stashes.slice(0, 3).every((stash) => stash.rows.length === 1 && stash.rows[0].item === "cls:egg"), "the hen coop too");
    assert.deepEqual(sut.stashes[4].rows, [], "the chest is left alone");
    assert.deepEqual(sut.stashes[3].rows, [], "and the fishing trap is not a nest");
    sut.state.now += 39 * 60_000;
    assert.equal(sut.nests.fill([]), 0);
    sut.state.now += 2 * 60_000;
    assert.equal(sut.nests.fill([]), 3);
});

test("a fishing trap is filled with two to four of one fish, on the same forty minutes, and a nest is not taken for one", () => {
    const sut = load();
    assert.equal(sut.traps.find(sut.stashes), 1);
    assert.equal(sut.traps.fill([]), 1);
    assert.deepEqual(sut.stashes[3].rows, [{ item: "cls:perch", amount: 4 }], "first pick of the three fish, then the largest count");
    assert.deepEqual(sut.stashes[0].rows, [], "no egg nest is touched by the traps");
    sut.state.now += 41 * 60_000;
    assert.equal(sut.traps.fill([{ position: { x: 1900, y: 3790 } }]), 0, "somebody within 25 m of the trap");
    assert.equal(sut.traps.fill([]), 1);
    assert.equal(sut.traps.kinds().length, 1);
});

test("a nest with somebody near or open is filled later, when nobody is about", () => {
    const sut = load();
    sut.nests.find(sut.stashes);
    sut.stashes[1].isOpen = true;
    assert.equal(sut.nests.fill([{ position: { x: 640, y: 3070 } }, { position: { x: 800, y: 3386 } }]), 0, "one has a player 11 m off, one is open, one has a player at the door");
    sut.stashes[1].isOpen = false;
    assert.equal(sut.nests.fill([{ position: { x: 680, y: 3070 } }]), 3, "51 m is far enough");
});

test("with no egg in the game's tables nothing is filled, and the log says so", () => {
    const sut = load({ eggKnown: false });
    sut.nests.find(sut.stashes);
    assert.equal(sut.nests.fill([]), 0);
    assert.equal(sut.nests.ready(), false);
});

test("installed, it looks for the nests a little after the start, says how many, and looks every minute", () => {
    const sut = load();
    sut.context.exports.installNests();
    assert.equal(sut.state.timeouts[0].ms, 30_000);
    sut.state.timeouts[0].fn();
    assert.ok(sut.state.logs.some((line) => /nests: 3 ninho\(s\) do nível ganham ovos a cada 40 min; 3 já cheios/.test(line)));
    assert.ok(sut.state.logs.some((line) => /traps: 1 armadilha\(s\) de pesca do nível ganham peixes a cada 40 min; 1 já cheios/.test(line)));
    assert.equal(sut.state.intervals[0].ms, 60_000);
});
