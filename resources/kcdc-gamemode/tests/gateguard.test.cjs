"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

// The fortress gates drawn as two sets of leaves (src/server/gate-guard.ts): a player put right by one has it said again a
// little later, so the game's own shut leaves and barrier do not stay on over KCDC's open ones (2026-10-19, Raborsch). Saying
// it shuts and opens it in the same instant, so nobody sees it shut (user, 2026-10-19: "os portões só podem fechar se forem
// fechados manualmente pelo dono"; 2026-10-20: "continuam fechando": the 1.2 s blink was seen at every arrival). Since 2026-10-27
// ("os portões de Raborsch continuam fechando sozinhos") a player who comes up to the gate on foot or by horse is an arrival too.

function load() {
    const state = { timers: [], logs: [], now: 1_000_000, bodies: [] };
    const context = { exports: {}, Math, Date, console: { log: (line) => state.logs.push(line) } };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/gate-guard.js"), "utf8"), context);
    const gate = (guid, x, y, kind = "gate", cycle = "open") => {
        const made = { guid, kind, cycle, moving: false, position: { x, y }, toggles: [], toggle(open) { made.toggles.push(open); made.cycle = open ? "open" : "closed"; return { accepted: true }; } };
        return made;
    };
    const gates = [gate("486e35908c959192", 1430, 3840), gate("drawbridge1", 1450, 3850, "drawbridge"), gate("far", 5000, 5000)];
    const guard = new context.exports.GateGuard(() => gates, () => state.now, (fn, ms) => state.timers.push({ fn, ms, at: state.now }), (line) => state.logs.push(line), () => state.bodies);
    const body = (id, x, y, ready = true) => ({ id, nickname: `P${id}`, ready, position: { x, y } });
    const run = (ms) => {
        for (const timer of state.timers.filter((t) => t.ms === ms)) timer.fn();
    };
    // How many arrivals (or approaches) have been counted: each one asks for a first shot at 12 s.
    const shots = () => state.timers.filter((t) => t.ms === 12_000).length;
    return { api: context.exports, state, gates, guard, body, run, shots };
}

test("a player who appears by a fortress gate has it said again, 12 s and 28 s later: shut and open in the same instant each time", () => {
    const sut = load();
    const raborsch = sut.gates[0];
    const arrived = sut.body(1, 1431, 3857);
    sut.state.bodies = [arrived];
    sut.guard.look([arrived]);
    assert.deepEqual(sut.state.timers.map((t) => t.ms), [12_000, 28_000]);
    sut.run(12_000);
    assert.deepEqual(raborsch.toggles, [false, true], "shut and open again with no time between");
    sut.run(400);
    sut.run(800);
    assert.deepEqual(raborsch.toggles, [false, true], "nothing more: it is open");
    sut.state.now += 16_000;
    sut.run(28_000);
    assert.deepEqual(raborsch.toggles, [false, true, false, true], "and once more, the game having its own time to set the castle up");
    assert.equal(sut.gates[1].toggles.length, 0, "a drawbridge animates: it is left alone");
    assert.equal(sut.gates[2].toggles.length, 0, "a gate far away is left alone");
    assert.ok(sut.state.logs.some((line) => /486e35908c959192 foi dito aberto de novo \(P1: entrou no mundo\)/.test(line)));
});

test("with somebody else near the gate it is said again all the same: nobody sees it shut", () => {
    const sut = load();
    const raborsch = sut.gates[0];
    const arrived = sut.body(1, 1431, 3857);
    sut.state.bodies = [arrived, sut.body(2, 1440, 3880)];
    sut.guard.look([arrived]);
    sut.run(12_000);
    assert.deepEqual(raborsch.toggles, [false, true]);
});

test("a gate that did not open at once is told to open a moment later, and again, and never left shut", () => {
    const sut = load();
    const raborsch = sut.gates[0];
    let refuse = 1;
    raborsch.toggle = (open) => {
        raborsch.toggles.push(open);
        if (open && refuse > 0) {
            refuse -= 1;
            return { accepted: false };
        }
        raborsch.cycle = open ? "open" : "closed";
        return { accepted: true };
    };
    assert.equal(sut.guard.sayAgain(raborsch, "test"), true);
    assert.equal(raborsch.cycle, "closed", "the second order was not taken");
    sut.run(400);
    assert.equal(raborsch.cycle, "open");
    assert.deepEqual(raborsch.toggles, [false, true, true]);
    sut.run(800);
    assert.deepEqual(raborsch.toggles, [false, true, true], "once open, nothing more");
});

test("a shut gate, a moving one, or one said within ten seconds is not said again", () => {
    const sut = load();
    const raborsch = sut.gates[0];
    raborsch.cycle = "closed";
    assert.equal(sut.guard.sayAgain(raborsch, "test"), false, "a shut gate is what the game draws already");
    raborsch.cycle = "open";
    raborsch.moving = true;
    assert.equal(sut.guard.sayAgain(raborsch, "test"), false);
    raborsch.moving = false;
    assert.equal(sut.guard.sayAgain(raborsch, "test"), true);
    raborsch.cycle = "open";
    sut.state.now += 5_000;
    assert.equal(sut.guard.sayAgain(raborsch, "test"), false, "not twice in ten seconds: players who arrive together are served by one saying");
    sut.state.now += 6_000;
    assert.equal(sut.guard.sayAgain(raborsch, "test"), true);
});

test("a first sight, or a jump of 100 m, within 120 m of the gate is an arrival (a join, a respawn, a trip); a jump far from any gate, a body not ready, or a first sight 130 m off is not", () => {
    const sut = load();
    sut.guard.look([sut.body(1, 1380, 3840)]);
    assert.equal(sut.shots(), 1, "first sight 50 m from the gate: two sayings");
    sut.guard.look([sut.body(1, 2000, 3000)]);
    assert.equal(sut.shots(), 1, "a jump far from any gate");
    sut.guard.look([sut.body(1, 1440, 3850)]);
    assert.equal(sut.shots(), 2, "a jump to the castle");
    sut.guard.look([sut.body(3, 1330, 3840)]);
    assert.equal(sut.shots(), 3, "a first sight 100 m off: the castle is on its way up around them");
    sut.guard.look([sut.body(4, 1300, 3840)]);
    assert.equal(sut.shots(), 3, "a first sight 130 m off is too far");
    sut.guard.look([sut.body(2, 1440, 3850, false)]);
    assert.equal(sut.shots(), 3, "a body not ready yet is not looked at");
    assert.equal(sut.state.timers.filter((t) => t.ms === 28_000).length, 3);
});

test("coming up to the gate on foot or by horse from afar is an arrival: said again twice, and not once for every step", () => {
    const sut = load();
    const raborsch = sut.gates[0];
    // First seen far off (300 m), then coming in by 50 m a look (a galloping horse), never a jump.
    sut.guard.look([sut.body(1, 1730, 3840)]);
    assert.equal(sut.shots(), 0, "a first sight 300 m off is nothing");
    for (const x of [1680, 1630, 1580]) {
        sut.guard.look([sut.body(1, x, 3840)]);
    }
    assert.equal(sut.shots(), 0, "150 m off and nearer: still nothing");
    sut.guard.look([sut.body(1, 1530, 3840)]);
    assert.deepEqual(sut.state.timers.map((t) => t.ms), [12_000, 28_000], "within 120 m: twice");
    for (const x of [1480, 1430, 1425, 1420]) {
        sut.guard.look([sut.body(1, x, 3840)]);
    }
    assert.equal(sut.shots(), 1, "not at every step");
    sut.run(12_000);
    assert.deepEqual(raborsch.toggles, [false, true]);
    assert.ok(sut.state.logs.some((line) => /foi dito aberto de novo \(P1: chegou perto\)/.test(line)));
});

test("going out of reach (170 m) and coming back is another approach; wandering about the edge (120 to 170 m) is not", () => {
    const sut = load();
    sut.guard.look([sut.body(1, 1730, 3840)]);
    for (const x of [1680, 1630, 1580, 1530]) {
        sut.guard.look([sut.body(1, x, 3840)]);
    }
    assert.equal(sut.shots(), 1);
    // To 160 m and back to 110 m: the player never left.
    for (const x of [1590, 1540, 1585, 1545]) {
        sut.guard.look([sut.body(1, x, 3840)]);
    }
    assert.equal(sut.shots(), 1, "at the edge it is the same visit");
    // Out to 210 m, back to 150 m (not near enough to count), then to 110 m.
    for (const x of [1640, 1700, 1580]) {
        sut.guard.look([sut.body(1, x, 3840)]);
    }
    assert.equal(sut.shots(), 1, "gone past 170 m and back to 150 m: not yet");
    sut.guard.look([sut.body(1, 1540, 3840)]);
    assert.equal(sut.shots(), 2, "gone past 170 m and back within 120 m: said again twice more");
});

test("two players coming up together are served by one saying, and a player who rode off before the shot falls due is not why the gate is said again", () => {
    const sut = load();
    const raborsch = sut.gates[0];
    const walker = sut.body(1, 1730, 3840);
    const other = sut.body(2, 1730, 3840);
    sut.guard.look([walker, other]);
    for (const x of [1680, 1630, 1580, 1530]) {
        walker.position = { x, y: 3840 };
        other.position = { x, y: 3840 };
        sut.guard.look([walker, other]);
    }
    assert.equal(sut.shots(), 2, "each of them has asked for the shots");
    walker.position = { x: 3000, y: 3840 };
    other.position = { x: 1500, y: 3840 };
    sut.run(12_000);
    assert.deepEqual(raborsch.toggles, [false, true], "said once: the other was still there, the gap keeps the second out");
    assert.equal(sut.state.logs.filter((line) => /foi dito aberto de novo/.test(line)).length, 1);
    assert.ok(sut.state.logs.some((line) => /\(P2: chegou perto\)/.test(line)), "and it is the one who stayed");
});

test("a player who rode off before the shots fall due leaves the gate alone; a drawbridge is never approached", () => {
    const sut = load();
    const raborsch = sut.gates[0];
    const walker = sut.body(1, 1730, 3840);
    sut.guard.look([walker]);
    for (const x of [1680, 1630, 1580, 1530]) {
        walker.position = { x, y: 3840 };
        sut.guard.look([walker]);
    }
    assert.equal(sut.shots(), 1);
    walker.position = { x: 3000, y: 3840 };
    sut.run(12_000);
    sut.run(28_000);
    assert.equal(raborsch.toggles.length, 0, "the shots of a body that is out of reach are not taken");
    // The drawbridge stands by the gate and animates on its own.
    const rider = sut.body(2, 1900, 3850);
    sut.guard.look([rider]);
    for (const x of [1850, 1800, 1750, 1700, 1650, 1600, 1550, 1500, 1460]) {
        rider.position = { x, y: 3850 };
        sut.guard.look([rider]);
    }
    sut.run(12_000);
    sut.state.now += 16_000;
    sut.run(28_000);
    assert.equal(sut.gates[1].toggles.length, 0);
    assert.deepEqual(raborsch.toggles, [false, true, false, true], "the gate itself, yes, twice: the rider is by it");
});

test("a player who left is forgotten, and comes back as a first sight", () => {
    const sut = load();
    sut.guard.look([sut.body(1, 1431, 3857)]);
    sut.guard.look([]);
    sut.guard.look([sut.body(1, 1431, 3857)]);
    assert.equal(sut.shots(), 2);
});
