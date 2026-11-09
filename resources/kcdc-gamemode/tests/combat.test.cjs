const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");

function setup(timeout) {
    const handlers = new Map();
    const clients = new Map();
    const cancelled = [];
    const logs = [];
    let now = 1000;
    let tick;
    const emit = (name, ...args) => { for (const fn of handlers.get(name) ?? []) fn(...args); };
    let all = [];
    const context = {
        exports: {}, Date: { now: () => now }, console: { log: (line) => logs.push(line) },
        setInterval: (fn) => { tick = fn; return 1; }, clearInterval: () => { tick = undefined; },
        Player: { all: () => all },
        Events: {
            on: (name, fn) => handlers.set(name, [...(handlers.get(name) ?? []), fn]),
            onClient: (name, fn) => clients.set(name, fn),
        },
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/combat.js"), "utf8"), context);
    context.exports.installCombat(timeout);
    const player = (id) => ({
        id, nickname: `Player${id}`, ready: true, canAct: true, virtualWorld: 0, state: [], position: { x: id * 10, y: 0, z: 0 }, released: [],
        emit(name, data) { if (name === "kcdc-gamemode:combat.release") this.released.push(JSON.parse(data)); else this.state = JSON.parse(data); },
        cancelCombat(other) { cancelled.push([id, other.id]); emit("playerCombatCancelled", this, other); return true; },
    });
    const players = [player(1), player(2), player(3)];
    all = players;
    // The native event transport parses JSON before dispatching onClient.
    const vote = (player, offer = player.state[0]) => clients.get("kcdc-gamemode:combat.vote")(player, { opponent: offer.opponent, token: offer.token });
    return { api: context.exports, players, cancelled, logs, emit, vote, clients, advance: (ms) => { now += ms; tick?.(); }, stopped: () => !tick };
}

test("45 seconds of inactivity from either player; a missed swing renews the deadline", () => {
    const s = setup(); const [a, b] = s.players;
    s.emit("playerAttack", a, b);
    s.advance(44999); assert.equal(s.cancelled.length, 0);
    s.emit("playerAttack", b, a);
    s.advance(44999); assert.equal(s.cancelled.length, 0);
    s.advance(1); assert.deepEqual(s.cancelled, [[a.id, b.id]]);
    assert.equal(a.state.length, 0); assert.equal(b.state.length, 0);
});

test("zero disables the timer but leaves mutual consent available", () => {
    const s = setup(0); const [a, b] = s.players;
    s.emit("playerAttack", a, b); s.advance(1_000_000);
    assert.equal(s.cancelled.length, 0);
    s.vote(a); s.vote(a);
    assert.equal(s.cancelled.length, 0);
    assert.equal(a.state[0].voted, true); assert.equal(b.state[0].offered, true);
    s.vote(b); assert.equal(s.cancelled.length, 1);
});

test("an attack withdraws the offer and makes in-flight accept requests stale", () => {
    const s = setup(); const [a, b] = s.players;
    s.emit("playerAttack", a, b); s.vote(a);
    const old = b.state[0];
    s.emit("playerAttack", b, a); s.vote(b, old);
    assert.equal(s.cancelled.length, 0);
    assert.equal(a.state[0].voted, false); assert.equal(b.state[0].offered, false);
    s.vote(b); assert.equal(s.cancelled.length, 0);
    s.vote(a); assert.equal(s.cancelled.length, 1);
});

test("a third player cannot vote for a pair and its own fight survives cancellation", () => {
    const s = setup(); const [a, b, c] = s.players;
    s.emit("playerAttack", a, b); s.emit("playerAttack", a, c);
    s.vote(c, { ...a.state.find((fight) => fight.opponent === b.id), opponent: a.id });
    assert.equal(b.state[0].offered, false);
    s.vote(a, a.state.find((fight) => fight.opponent === b.id)); s.vote(b);
    assert.deepEqual(s.cancelled, [[a.id, b.id]]);
    assert.equal(a.state[0].opponent, c.id); assert.equal(c.state[0].opponent, a.id);
});

test("death, disconnect, spawn and world changes retire consent even without a timer", () => {
    for (const event of ["playerDied", "playerDisconnect", "playerSpawning", "world"] ) {
        const s = setup(0); const [a, b] = s.players;
        s.emit("playerAttack", a, b); s.vote(a);
        const old = b.state[0];
        if (event === "world") { a.virtualWorld = 1; s.advance(250); }
        else s.emit(event, a);
        assert.equal(b.state.length, 0);
        s.vote(b, old); assert.equal(s.cancelled.length, 1);
    }
});

test("contacts with a different victim start their own pair; missile hits do not", () => {
    const s = setup(); const [a, b, c] = s.players;
    s.emit("playerAttack", a, b);
    s.emit("playerHit", c, a, { source: "missile" }); assert.equal(c.state.length, 0);
    s.emit("playerHit", c, a, { source: "melee" }); assert.equal(c.state[0].opponent, a.id);
});

test("manual API cancellation and resource stop clear hints and timers", () => {
    const s = setup(); const [a, b, c] = s.players;
    s.emit("playerAttack", a, b); a.cancelCombat(b);
    assert.equal(b.state.length, 0);
    s.emit("playerAttack", a, c); s.emit("resourceStop", "another-resource");
    assert.equal(s.stopped(), false);
    s.emit("resourceStop", "kcdc-gamemode");
    assert.equal(s.stopped(), true); assert.equal(c.state.length, 0);
});

test("malformed requests cannot create fights or consent", () => {
    const s = setup(); const [a, b] = s.players;
    s.emit("playerAttack", a, b);
    for (const payload of ["{", "null", "[]", '{"opponent":2,"token":"1"}', "x".repeat(129)]) s.clients.get("kcdc-gamemode:combat.vote")(a, payload);
    assert.equal(a.state[0].voted, false); assert.equal(s.cancelled.length, 0);
});

test("hold U displays the vote and an old hold cannot accept a new opponent", () => {
    const handlers = new Map(); const hints = new Map(); const requests = [];
    let tick; let nextHint = 1;
    const players = new Map([[1, { position: { x: 0, y: 0, z: 0 }, canAct: true }], [2, { ready: true, position: { x: 2, y: 0, z: 0 } }], [3, { ready: true, position: { x: 1, y: 0, z: 0 } }]]);
    const context = {
        exports: {}, LocalPlayer: players.get(1), Player: function(id) { return players.get(id); },
        Events: { on: (name, fn) => handlers.set(name, fn), emitServer: (...args) => requests.push(args) },
        setInterval: (fn) => { tick = fn; return 1; }, clearInterval() {}, setTimeout: () => 1, clearTimeout() {},
        ActionHint: {
            create: (options, fn) => { const id = nextHint++; hints.set(id, { options, fn }); return id; },
            remove: (id) => hints.delete(id), setText: (id, text) => { hints.get(id).options.text = text; },
            setEnabled: (id, enabled) => { hints.get(id).options.enabled = enabled; },
        },
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/client/combat.js"), "utf8"), context);
    context.exports.installCombat();
    const state = (fights) => handlers.get("kcdc-gamemode:combat.state")(JSON.stringify(fights));
    const fight = { opponent: 2, name: "Player2", token: 1, voted: false, offered: false };
    state([fight]); const old = [...hints.values()][0];
    assert.equal(old.options.key, "kcdc_end_combat"); assert.equal(old.options.holdDuration, 1);
    old.fn(); assert.deepEqual(JSON.parse(JSON.stringify(requests.at(-1)[1])), { opponent: 2, token: 1 });
    state([{ ...fight, voted: true }]);
    assert.match([...hints.values()][0].options.text, /waiting \(1\/2\)/);
    assert.equal([...hints.values()][0].options.enabled, false);
    state([{ ...fight, offered: true }]); assert.match([...hints.values()][0].options.text, /Accept peace/);
    state([{ ...fight, opponent: 3, token: 2 }]); const count = requests.length;
    old.fn(); assert.equal(requests.length, count);
    state([]); tick(); assert.equal(hints.size, 0);
});

test("NPC hits do not open a player truce offer", () => {
    const s = setup(); const [victim] = s.players;
    s.emit("playerHit", victim, { id: 40, name: "Hunter" }, { source: "melee" });
    assert.equal(victim.state.length, 0);
    s.advance(20000);
    assert.equal(s.cancelled.length, 0);
});

test("peace offered and five quiet seconds end the fight without the other's hold; a blow withdraws the offer", () => {
    const s = setup(); const [a, b] = s.players;
    s.emit("playerAttack", a, b); s.vote(a);
    s.advance(4999); assert.equal(s.cancelled.length, 0);
    s.emit("playerAttack", b, a);
    s.advance(9000); assert.equal(s.cancelled.length, 0, "the blow took the offer back");
    s.vote(b);
    s.advance(5000); assert.deepEqual(s.cancelled, [[a.id, b.id]]);
    assert.ok(s.logs.some((line) => /acabou \(paz oferecida e 5 s sem golpes\)/.test(line)));
    assert.ok(s.logs.some((line) => /Player1 e Player2 começaram a lutar/.test(line)));
});

test("/paz ends a duel quiet for five seconds, and not one in the middle of an exchange", () => {
    const s = setup(0); const [a, b, c] = s.players;
    s.emit("playerAttack", a, b);
    s.advance(1000);
    assert.deepEqual(JSON.parse(JSON.stringify(s.api.endQuietFights(a))), { ended: [], busy: ["Player2"] });
    assert.equal(s.cancelled.length, 0);
    s.advance(4000);
    assert.deepEqual(JSON.parse(JSON.stringify(s.api.endQuietFights(a))), { ended: ["Player2"], busy: [] });
    assert.deepEqual(s.cancelled, [[a.id, b.id]]);
    assert.equal(a.state.length, 0);
    assert.deepEqual(JSON.parse(JSON.stringify(s.api.endQuietFights(c))), { ended: [], busy: [] });
});

test("an accept for an offer a blow already replaced is said in the log, and the new offer is shown again", () => {
    const s = setup(); const [a, b] = s.players;
    s.emit("playerAttack", a, b); s.vote(a);
    const old = b.state[0];
    s.emit("playerAttack", a, b);
    s.vote(b, old);
    assert.equal(s.cancelled.length, 0);
    assert.ok(s.logs.some((line) => /Player2 segurou U por um pedido de paz que um golpe já tinha trocado/.test(line)));
    assert.notEqual(b.state[0].token, old.token);
});

function clientSetup() {
    const handlers = new Map(); const requests = []; const targetable = [];
    let now = 0; let nextTimer = 1; const timers = new Map();
    const body = (id) => ({ id, ready: true, position: { x: id, y: 0, z: 0 }, canAct: true, setTargetable(on) { targetable.push([id, on]); } });
    const players = new Map([[1, { ...body(1), fistsUp: false, guard: 0, rightHandItem: "a".repeat(32), leftHandItem: "" }], [2, body(2)], [3, body(3)]]);
    const context = {
        exports: {}, LocalPlayer: players.get(1), Player: function(id) { return players.get(id); },
        Events: { on: (name, fn) => handlers.set(name, fn), emitServer: (...args) => requests.push(args) },
        setInterval: () => 1, clearInterval() {},
        setTimeout: (fn, ms) => { const id = nextTimer++; timers.set(id, { fn, at: now + ms }); return id; },
        clearTimeout: (id) => timers.delete(id),
        NativeUI: { isMenuEnabled: () => true },
        ActionHint: { create: () => 1, remove() {}, setText() { return true; }, setEnabled() {} },
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/client/combat.js"), "utf8"), context);
    context.exports.installCombat();
    const advance = (ms) => {
        now += ms;
        for (const [id, timer] of [...timers].sort((a, b) => a[1].at - b[1].at)) {
            if (timer.at <= now && timers.has(id)) { timers.delete(id); timer.fn(); }
        }
    };
    const state = (fights) => handlers.get("kcdc-gamemode:combat.state")(JSON.stringify(fights));
    return { handlers, requests, targetable, advance, state };
}

test("after a fight ends the opponent stays out of the lock-on for five seconds, and the hands and menus are reported", () => {
    const c = clientSetup();
    const fight = { opponent: 2, name: "Player2", token: 1, voted: false, offered: false };
    c.state([fight]);
    assert.deepEqual(c.targetable, []);
    c.state([]);
    assert.deepEqual(c.targetable, [[2, false]]);
    c.advance(2500);
    const report = c.requests.find((request) => request[0] === "kcdc-gamemode:combat.after");
    assert.ok(report, "the client reports after the release");
    assert.deepEqual(JSON.parse(report[1]), { why: "fim da luta", fistsUp: false, guard: 0, right: "a".repeat(32), left: "", inventory: true, map: true });
    c.advance(2499); assert.equal(c.targetable.length, 1);
    c.advance(1); assert.deepEqual(c.targetable, [[2, false], [2, true]]);
});

test("a new blow lets the two lock on each other again at once; /paz names the bodies to let go of", () => {
    const c = clientSetup();
    const fight = { opponent: 2, name: "Player2", token: 1, voted: false, offered: false };
    c.state([fight]); c.state([]);
    c.state([{ ...fight, token: 2 }]);
    assert.deepEqual(c.targetable, [[2, false], [2, true]]);
    c.advance(10000); assert.equal(c.targetable.length, 2, "the cancelled timer does not fire");
    c.handlers.get("kcdc-gamemode:combat.release")(JSON.stringify({ opponents: [2, 3, "x"] }));
    assert.deepEqual(c.targetable.slice(2), [[2, false], [3, false]]);
    c.advance(5000);
    assert.deepEqual(c.targetable.slice(4), [[2, true], [3, true]]);
    assert.equal(JSON.parse(c.requests.filter((request) => request[0] === "kcdc-gamemode:combat.after").at(-1)[1]).why, "/paz");
});

test("/paz with no fight names the players within 30 metres in the same world, and the client report is logged once in two seconds", () => {
    const s = setup(); const [a, b, c] = s.players;
    c.position = { x: 50, y: 0, z: 0 };
    assert.equal(s.api.releaseNearby(a), 1);
    assert.deepEqual(a.released, [{ opponents: [b.id] }]);
    b.virtualWorld = 7;
    assert.equal(s.api.releaseNearby(a), 0);
    assert.ok(s.logs.some((line) => /Player1 usou \/paz sem luta; 1 jogador\(es\) por perto/.test(line)));
    const after = s.clients.get("kcdc-gamemode:combat.after");
    after(a, JSON.stringify({ why: "fim da luta", fistsUp: true, guard: 1, right: "a".repeat(32), left: "", inventory: false, map: true }));
    after(a, JSON.stringify({ why: "fim da luta", fistsUp: true, guard: 1, right: "", left: "", inventory: true, map: true }));
    const lines = s.logs.filter((line) => /depois da paz/.test(line));
    assert.equal(lines.length, 1);
    assert.match(lines[0], /Player1: mão direita com algo \(aaaaaaaa\), esquerda vazia, punhos erguidos, guarda 1; inventário fechado por um recurso, mapa permitido/);
    s.advance(2000);
    after(a, "x".repeat(600));
    assert.equal(s.logs.filter((line) => /depois da paz/.test(line)).length, 1);
});

test("NPCs first: while the server says an enemy NPC is about, the players it names stay out of the lock-on, and are let back in when none is (2026-10-25)", () => {
    const c = clientSetup();
    const priority = (on, ids) => c.handlers.get("kcdc-gamemode:combat.priority")(JSON.stringify({ on, ids }));
    priority(true, [2, 3]);
    assert.deepEqual(c.targetable, [[2, false], [3, false]]);
    priority(true, [3]);
    assert.deepEqual(c.targetable.slice(2), [[2, true], [3, false]], "one who is no longer near comes back");
    priority(false, []);
    assert.deepEqual(c.targetable.slice(4), [[3, true]]);
    const before = c.targetable.length;
    c.handlers.get("kcdc-gamemode:combat.priority")("not json");
    c.handlers.get("kcdc-gamemode:combat.priority")(JSON.stringify({ on: true }));
    assert.equal(c.targetable.length, before, "what is not understood changes nothing");
    c.handlers.get("kcdc-gamemode:combat.priority")(JSON.stringify({ on: true, ids: ["x", 2.5, null, 3] }));
    assert.deepEqual(c.targetable.slice(before), [[3, false]], "only whole numbers are bodies");
});

test("the end of a fight does not let a player back in while an enemy NPC is about, and a blow between two players does not either", () => {
    const c = clientSetup();
    const fight = { opponent: 2, name: "Player2", token: 1, voted: false, offered: false };
    c.handlers.get("kcdc-gamemode:combat.priority")(JSON.stringify({ on: true, ids: [2] }));
    c.state([fight]);
    c.state([]);
    c.advance(5000);
    assert.ok(c.targetable.every(([, on]) => on === false), "never targetable while the bandit is about");
    c.state([{ ...fight, token: 2 }]);
    assert.ok(c.targetable.every(([, on]) => on === false), "a new blow with him changes nothing");
    c.handlers.get("kcdc-gamemode:combat.priority")(JSON.stringify({ on: false, ids: [] }));
    assert.deepEqual(c.targetable.at(-1), [2, true], "once the bandit is gone he can be locked on");
});

test("when the resource stops everybody is let back into the lock-on", () => {
    const c = clientSetup();
    c.handlers.get("kcdc-gamemode:combat.priority")(JSON.stringify({ on: true, ids: [2, 3] }));
    c.handlers.get("resourceStop")("kcdc-gamemode");
    assert.deepEqual(c.targetable.slice(2).sort(), [[2, true], [3, true]]);
});

test("endFightBetween ends the fight of one pair at once, whatever its age, and leaves the others; with no fight it does nothing", () => {
    const s = setup(); const [a, b, c] = s.players;
    s.emit("playerAttack", a, b); s.emit("playerAttack", a, c);
    s.api.endFightBetween(a, b, "duelo: teste");
    assert.deepEqual(s.cancelled, [[a.id, b.id]]);
    assert.equal(b.state.length, 0);
    assert.equal(a.state.length, 1); assert.equal(a.state[0].opponent, c.id);
    assert.ok(s.logs.some((line) => /acabou \(duelo: teste\)/.test(line)));
    s.api.endFightBetween(b, c, "sem luta");
    assert.equal(s.cancelled.length, 1);
    s.api.endFightBetween(a, b, "de novo");
    assert.equal(s.cancelled.length, 1);
});
