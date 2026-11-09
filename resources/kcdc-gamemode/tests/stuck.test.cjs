const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const RESOURCE = "kcdc-gamemode";
const dist = (name) => fs.readFileSync(path.join(__dirname, "../dist/server", name), "utf8");
const MINUTE = 60_000;

function load({ saved = null, carts = [], kuttenberg = true } = {}) {
    const files = new Map();
    if (saved !== null) files.set("playerdata/stuck.json", saved);
    const writes = [];
    const handlers = new Map();
    const logs = [];
    const notices = [];
    const socials = [];
    const payloads = [];
    const clock = { now: 10_000_000 };

    const respawn = { exports: {} };
    vm.runInNewContext(dist("respawn.js"), { exports: respawn.exports, require: (id) => (id === "./level.js" ? { onKuttenberg: () => kuttenberg } : { cure: () => true }), Navigation: { ready: false }, Events: { on() {} }, Chat: {}, Player: {}, Door: {} });
    const store = {
        ensureDir() {},
        read: (file) => (files.has(file) ? (files.get(file) === "corrupt" ? { status: "corrupt", reason: "bad" } : { status: "ok", value: JSON.parse(files.get(file)) }) : { status: "missing" }),
        write: (file, body) => { writes.push([file, JSON.parse(JSON.stringify(body))]); files.set(file, JSON.stringify(body)); },
    };
    const status = {
        addPayload: (fn) => payloads.push(fn),
        notice: (player, text) => notices.push([player.id, text]),
        sendSocial: (player) => socials.push(player.id),
    };
    const sandbox = {
        exports: {},
        require: (id) => ({ "./respawn.js": respawn.exports, "./status.js": status, "./store.js": store })[id],
        console: { log: (line) => logs.push(line) },
        Date: { now: () => clock.now },
        Events: { onClient: (name, fn) => handlers.set(name, fn) },
        Vector3: class { constructor(x, y, z) { Object.assign(this, { x, y, z }); } },
        Cart: { all: () => carts },
    };
    vm.runInNewContext(dist("stuck.js"), sandbox);
    sandbox.exports.stuckLog.now = () => clock.now;
    return { api: sandbox.exports, files, writes, handlers, logs, notices, socials, payloads, clock };
}

function body(id, x, y, over = {}) {
    const moves = [];
    const { teleport: works = true, ...rest } = over;
    return { id, nickname: `jogador${id}`, steamId: `7656119800000000${id}`, ready: true, alive: true, virtualWorld: 0, position: { x, y, z: 100 }, moves, teleport(point) { moves.push({ x: point.x, y: point.y, z: point.z }); return works; }, ...rest };
}

/** Moves with the height rounded to the centimetre: the box's spot is lifted by a float. */
const cm = (moves) => moves.map((move) => ({ x: move.x, y: move.y, z: Math.round(move.z * 100) / 100 }));

test("minutes are told as a player reads them, a started minute counting", () => {
    const { api } = load();
    assert.equal(api.minutesText(1), "1 minuto");
    assert.equal(api.minutesText(60_000), "1 minuto");
    assert.equal(api.minutesText(60_001), "2 minutos");
    assert.equal(api.minutesText(59 * MINUTE + 1), "60 minutos");
    assert.equal(api.STUCK_COOLDOWN_MS, 60 * MINUTE);
});

test("a stuck player is taken to the church nearest where they stand, and told which", () => {
    const sut = load();
    const player = body(1, 760, 3240); // beside Suchdol's church
    const outcome = sut.api.unstick(player);
    assert.equal(outcome.ok, true);
    assert.match(outcome.message, /igreja de Suchdol/);
    assert.deepEqual(cm(player.moves), [{ x: 747.97, y: 3246.3, z: 139.79 }], "the box's spot, a hair above, as no navigation mesh is up");

    const far = body(2, 3050, 700); // Kuttenberg
    sut.api.unstick(far);
    assert.deepEqual(cm(far.moves), [{ x: 3046.69, y: 683.8, z: 52.43 }]);
});

test("once every sixty minutes: asked again, it says how many minutes are left, and it is free again at the sixtieth", () => {
    const sut = load();
    const player = body(1, 760, 3240);
    assert.equal(sut.api.readyIn(player), 0);
    assert.equal(sut.api.unstick(player).ok, true);
    assert.equal(sut.api.readyIn(player), 3600);

    sut.clock.now += 17 * MINUTE;
    const again = sut.api.unstick(player);
    assert.equal(again.ok, false);
    assert.match(again.message, /uma vez a cada 60 minutos\. Disponível de novo em 43 minutos/);
    assert.equal(player.moves.length, 1, "not moved again");
    assert.equal(sut.api.readyIn(player), 43 * 60);

    sut.clock.now += 43 * MINUTE;
    assert.equal(sut.api.readyIn(player), 0);
    assert.equal(sut.api.unstick(player).ok, true);
    assert.equal(player.moves.length, 2);
});

test("the wait is each player's own, and survives a restart", () => {
    const sut = load();
    const first = body(1, 760, 3240);
    const second = body(2, 760, 3240);
    sut.api.unstick(first);
    assert.equal(sut.api.unstick(second).ok, true, "the other player is not limited by it");

    const saved = JSON.parse(sut.files.get("playerdata/stuck.json"));
    assert.deepEqual(Object.keys(saved).sort(), [first.steamId, second.steamId].sort());

    const again = load({ saved: JSON.stringify(saved) });
    again.clock.now = sut.clock.now + 10 * MINUTE;
    again.api.installStuck();
    assert.equal(again.api.unstick(first).ok, false, "a restart does not give it back");
});

test("uses long past are not kept in the file, and an unreadable file is never written over", () => {
    const sut = load();
    sut.api.stuckLog.load({ old: sut.clock.now - 3 * 3600_000, fresh: sut.clock.now - 10 * MINUTE, bad: "x", zero: 0 });
    assert.deepEqual(Object.keys(sut.api.stuckLog.toJSON()), ["fresh"]);

    const broken = load({ saved: "corrupt" });
    broken.api.installStuck();
    assert.ok(broken.logs.some((line) => /ilegível/.test(line)));
    broken.api.unstick(body(1, 760, 3240));
    assert.equal(broken.writes.length, 0);
});

test("the dead, a body not in the world and a client that cannot be moved are refused, and nothing is spent", () => {
    const sut = load();
    const dead = body(1, 760, 3240, { alive: false });
    assert.match(sut.api.unstick(dead).message, /morto/);
    const loading = body(2, 760, 3240, { ready: false });
    assert.match(sut.api.unstick(loading).message, /ainda não entrou/);
    const cut = body(3, 760, 3240, { teleport: false });
    assert.match(sut.api.unstick(cut).message, /Não consegui falar/);
    assert.equal(sut.api.readyIn(cut), 0, "a failed move costs nothing");
    assert.equal(sut.api.unstick(body(3, 760, 3240)).ok, true);
});

test("a player with no Steam id is limited for as long as the server runs, and nothing is written for them", () => {
    const sut = load();
    const player = body(1, 760, 3240, { steamId: "" });
    assert.equal(sut.api.unstick(player).ok, true);
    assert.equal(sut.api.unstick(player).ok, false);
    assert.equal(sut.writes.length, 0);
});

test("a seated player is taken out of the cart before they are moved", () => {
    const left = [];
    const cart = { seatOf: (player) => (player.id === 1 ? "bench" : null), removePlayer: (player) => { left.push(player.id); return true; } };
    const sut = load({ carts: [cart] });
    const player = body(1, 760, 3240);
    sut.api.unstick(player);
    assert.deepEqual(left, [1]);
    assert.equal(player.moves.length, 1);
});

test("the panel's event answers with a notice and the new state, and the status payload carries the wait", () => {
    const sut = load();
    sut.api.installStuck();
    const player = body(1, 760, 3240);
    sut.handlers.get(`${RESOURCE}:status.unstick`)(player);
    assert.equal(sut.notices.length, 1);
    assert.match(sut.notices[0][1], /igreja de Suchdol/);
    assert.deepEqual(sut.socials, [1]);

    assert.equal(sut.payloads.length, 1);
    assert.deepEqual(JSON.parse(JSON.stringify(sut.payloads[0](player))), { stuck: { readyIn: 3600 } });
    assert.deepEqual(JSON.parse(JSON.stringify(sut.payloads[0](body(2, 0, 0)))), { stuck: { readyIn: 0 } });
});

test("Fiquei preso on a level with no churches takes nobody anywhere, says why, and does not use up the hour (2026-11-09)", () => {
    const sut = load({ kuttenberg: false });
    const player = body(1, 760, 3240);
    const outcome = sut.api.unstick(player);
    assert.equal(outcome.ok, false);
    assert.match(outcome.message, /Este mapa não tem igrejas/);
    assert.deepEqual(player.moves, [], "no teleport to a place of another level");
    assert.equal(sut.api.stuckLog.remaining(`7656119800000000${1}`), 0, "the hour is not started: asking again is not refused for it");
    assert.equal(sut.writes.length, 0, "and nothing is written");
});
