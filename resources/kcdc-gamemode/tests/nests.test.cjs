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
        stash("h1", "Stash2[Stash/bee_hive3_9a1c77e0]", 1210, 905),
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
    const nests = new context.exports.Nests({ ...context.exports.EGGS, extra: undefined }, context.exports.nestSettings, () => state.now, random);
    const feathered = (dice) => {
        let at = 0;
        return new context.exports.Nests(context.exports.EGGS, context.exports.nestSettings, () => state.now, () => dice[at++ % dice.length]);
    };
    const traps = new context.exports.Nests(context.exports.FISH, context.exports.nestSettings, () => state.now, random);
    const hives = new context.exports.Nests(context.exports.HONEY, context.exports.nestSettings, () => state.now, random);
    return { api: context.exports, nests, feathered, traps, hives, state, stashes, context };
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

test("a beehive is a container named bee_hive and gets one or two honey, forty minutes apart; nests, traps and chests are not hives (and a hive is no nest)", () => {
    const sut = load();
    assert.equal(sut.hives.find(sut.stashes), 1, "only the hive box");
    assert.equal(sut.nests.find(sut.stashes), 3, "the nests do not take it");
    assert.equal(sut.traps.find(sut.stashes), 1, "nor the traps");
    assert.equal(sut.hives.fill([]), 1);
    const hive = sut.stashes[sut.stashes.length - 1];
    assert.deepEqual(hive.rows, [{ item: "cls:honey", amount: 2 }], "honey, one to two by the dice");
    assert.ok(sut.stashes.slice(0, 6).every((stash) => stash.rows.length === 0), "nothing else was touched");
    sut.state.now += 39 * 60_000;
    assert.equal(sut.hives.fill([]), 0, "not before forty minutes");
    sut.state.now += 2 * 60_000;
    assert.equal(sut.hives.fill([{ position: { x: 1215, y: 905 } }]), 0, "somebody beside the hive");
    assert.equal(sut.hives.fill([]), 1);
    assert.match(sut.hives.kinds()[0], /bee_hive/, "the log says what kind it found");
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
    assert.ok(sut.state.logs.some((line) => /hives: 1 colmeia\(s\) do nível ganham mel a cada 40 min; 1 já cheios/.test(line)));
    assert.equal(sut.state.intervals[0].ms, 60_000, "the due containers are filled every minute");
    assert.equal(sut.state.intervals[1].ms, 10 * 60_000, "and the level is looked through again, rarely");
});

/** Runs the timeouts that are waiting from `from` on, and those they schedule. */
function runTimeouts(sut, from) {
    let at = from;
    while (at < sut.state.timeouts.length) sut.state.timeouts[at++].fn();
}

test("the level's containers are read once for the three kinds, in slices, so that no look stalls the server (2026-10-26)", () => {
    const sut = load();
    for (let i = 0; i < 640; i += 1) {
        sut.stashes.push({ levelGuid: `chest-${i}`, name: `stash[Chest/chest${i}]`, position: { x: 0, y: 0, z: 0 }, isOpen: false, rows: [], setInventory() { return { ok: true, code: "" }; } });
    }
    let reads = 0;
    const real = sut.context.Stash.all;
    sut.context.Stash.all = () => { reads += 1; return real(); };
    sut.context.exports.installNests();
    sut.state.timeouts[0].fn();
    assert.equal(reads, 1, "one read of the level's containers for the eggs, the fish and the honey together");
    assert.equal(sut.state.timeouts.length, 2, "the rest of the look waits for its turn");
    assert.equal(sut.state.timeouts[1].ms, sut.api.nestSettings.scanGapMs);
    assert.ok(!sut.state.logs.some((line) => /^nests: /.test(line)), "nothing is said before the look is done");
    runTimeouts(sut, 1);
    assert.equal(sut.state.timeouts.length, 3, "647 containers in slices of 250 are three slices, the first read at once and two waited for");
    assert.ok(sut.state.logs.some((line) => /nests: 3 ninho\(s\) do nível ganham ovos a cada 40 min; 3 já cheios/.test(line)), sut.state.logs.join("|"));
    assert.ok(sut.state.logs.some((line) => /traps: 1 armadilha/.test(line)) && sut.state.logs.some((line) => /hives: 1 colmeia/.test(line)));
    assert.equal(reads, 1, "still one");
});

test("a container the level reports late joins the rest on the rare look, and the minute's look does not read the level at all", () => {
    const sut = load();
    let reads = 0;
    const real = sut.context.Stash.all;
    sut.context.Stash.all = () => { reads += 1; return real(); };
    sut.context.exports.installNests();
    sut.state.timeouts[0].fn();
    assert.equal(reads, 1);
    assert.equal(sut.api.nests.count(), 3);

    sut.stashes.push({ levelGuid: "n99", name: "Nest1[Stash/nest99_ab12]", position: { x: 700, y: 3100, z: 100 }, isOpen: false, rows: [], setInventory() { return { ok: true, code: "" }; } });
    sut.state.intervals[0].fn();
    assert.equal(reads, 1, "the minute's look only fills what is due");
    assert.equal(sut.api.nests.count(), 3);

    const before = sut.state.timeouts.length;
    sut.state.intervals[1].fn();
    runTimeouts(sut, before);
    assert.equal(reads, 2);
    assert.equal(sut.api.nests.count(), 4, "found by the rare look");
    sut.state.intervals[1].fn();
    assert.equal(sut.api.nests.count(), 4, "and found once");
});

test("a nest now and then holds a rooster's feather beside its eggs: the fletching of the arrows (2026-10-27)", () => {
    const sut = load();
    // Per nest: the egg pick, the egg count, the chance of a feather and, when it comes, how many.
    const nests = sut.feathered([0, 0.99, 0.1, 0.99, 0, 0, 0.9, 0, 0.5, 0.39, 0]);
    nests.find(sut.stashes);
    assert.equal(nests.fill([]), 3);
    assert.deepEqual(sut.stashes[0].rows, [{ item: "cls:egg", amount: 3 }, { item: "cls:special_featherRooster", amount: 2 }], "the chance came (under 40%): two feathers");
    assert.deepEqual(sut.stashes[1].rows, [{ item: "cls:egg", amount: 1 }], "it did not: eggs alone");
    assert.deepEqual(sut.stashes[2].rows, [{ item: "cls:egg", amount: 2 }, { item: "cls:special_featherRooster", amount: 1 }]);
    assert.equal(sut.api.EGGS.extra.chance, 0.4);
    assert.equal(sut.api.FISH.extra, undefined, "and only the nests: the traps and the hives have none");
    assert.equal(sut.api.HONEY.extra, undefined);
});
