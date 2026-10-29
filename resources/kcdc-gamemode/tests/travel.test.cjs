const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// Fast travel by coach (src/server/travel.ts; user, 2026-10-19: "NPC de viagem rápida fixos nos locais junto à carroça ou cavalo
// deles ... quanto mais longe mais caro, e de noite o NPC vai para uma casa dormir").

/** What the module made, as plain data: its objects come from another realm, which deepStrictEqual tells apart. */
const plain = (value) => JSON.parse(JSON.stringify(value));

const FIRST_ANCHORS = {
    suchdol: { x: 757.1, y: 3353.9, z: 141.9 },
    raborsch: { x: 1436.4, y: 3842.6, z: 118.3 },
    malesov: { x: 560.5, y: 258.3, z: 109.6 },
    wysoka: { x: 440.0, y: 2497.2, z: 218.5 },
    kuttenberg: { x: 3114.3, y: 906.6, z: 61.6 },
    zikmundovo: { x: 1596.1, y: 2800.5, z: 193.0 },
    grunta: { x: 3197.2, y: 2183.5, z: 95.9 },
};

class Vector3 {
    constructor(x = 0, y = 0, z = 0) {
        this.x = x;
        this.y = y;
        this.z = z;
    }
}

/**
 * The module over fakes: the navigation mesh is an open plane at z 100, minus `nav.walls` (rectangles) and outside `nav.circle`
 * when one is given; money is a number per Steam id; the townsfolk posts are a fake handle.
 */
function load({ stored = undefined, fixed = false } = {}) {
    const nav = { ready: true, walls: [], circle: null, closest: 0 };
    const free = (p) => {
        if (nav.circle !== null && Math.hypot(p.x - nav.circle.x, p.y - nav.circle.y) > nav.circle.r) {
            return false;
        }
        return !nav.walls.some((w) => p.x >= w.x0 && p.x <= w.x1 && p.y >= w.y0 && p.y <= w.y1);
    };
    const Navigation = {
        get ready() {
            return nav.ready;
        },
        closestPoint(p) {
            nav.closest += 1;
            return nav.ready && free(p) ? new Vector3(p.x, p.y, 100) : null;
        },
        raycast(from, to) {
            const steps = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / 0.1));
            for (let i = 0; i <= steps; i += 1) {
                const t = i / steps;
                const p = { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
                if (!free(p)) {
                    return { hit: true, point: new Vector3(p.x, p.y, 100) };
                }
            }
            return { hit: false, point: new Vector3(to.x, to.y, 100) };
        },
    };

    // `ground(x, y)` is what a client's trace meets there (a hit, or null for nothing); `answers` false is a client that went quiet.
    const state = { hour: 12, restart: false, trading: new Set(), dice: new Set(), money: new Map(), file: stored, answers: true, ground: () => GRASS };
    const reads = [];
    const calls = { chat: [], emitted: [], logs: [], stored: [], dialogs: [], closedDialogs: [], spawned: [], destroyed: [], sleep: [], wake: [], posts: null, life: null };
    const handlers = new Map();
    const players = new Map();
    const carts = new Map();
    const queue = [];
    const clock = { now: 1_000_000 };
    const reservedCarts = new Map();
    const asleep = new Set();
    let sessions = 0;
    const openSessions = new Map();
    let cartIds = 500;

    const handle = {
        standing: () => new Map(),
        get posts() {
            return calls.posts;
        },
        sleep: (id) => {
            calls.sleep.push(id);
            asleep.add(id);
        },
        wake: (id, position, yaw) => {
            calls.wake.push({ id, position: { x: position.x, y: position.y, z: position.z }, yaw });
            asleep.delete(id);
            return {};
        },
        asleep: (id) => asleep.has(id),
    };

    const context = {
        exports: {},
        require: (id) => {
            switch (id) {
                case "./carts.js":
                    return { cartOf: (player) => (player.inCart ? {} : null), reservedCarts };
                case "./dice.js":
                    return { diceLobby: { seated: (player) => state.dice.has(player.id) } };
                case "./money.js":
                    return {
                        MONEY_UNIT: 10,
                        coins: (units) => `${units / 10} moedas`,
                        moneyOf: (player) => state.money.get(player.steamId) ?? 0,
                        takeMoney: (player, units) => {
                            const has = state.money.get(player.steamId) ?? 0;
                            if (has < units) return false;
                            state.money.set(player.steamId, has - units);
                            return true;
                        },
                        giveMoney: (player, units) => {
                            state.money.set(player.steamId, (state.money.get(player.steamId) ?? 0) + units);
                            return true;
                        },
                    };
                case "./position.js":
                    return { yawOf: (rotation) => rotation.z };
                case "./restart-notice.js":
                    return { restartPending: () => state.restart };
                case "./store.js":
                    return {
                        ensureDir() {},
                        read: () => (state.file === undefined ? { status: "missing" } : { status: "ok", value: JSON.parse(JSON.stringify(state.file)), fromBackup: false }),
                        write: (file, value) => {
                            calls.stored.push({ file, value: JSON.parse(JSON.stringify(value)) });
                            state.file = JSON.parse(JSON.stringify(value));
                        },
                    };
                case "./townsfolk.js":
                    return {
                        SPAWN_AFTER_MS: 15_000,
                        postLife: { open: 6, bed: 22, roamM: 12 },
                        installPosts: (label, posts, talk) => {
                            calls.posts = posts;
                            calls.talk = talk;
                            calls.label = label;
                            return handle;
                        },
                        installPostLife: (given, lines, settings) => {
                            calls.life = { given, lines, settings };
                        },
                    };
                case "./trade.js":
                    return { trades: { isTrading: (player) => state.trading.has(player.id) } };
                default:
                    return assert.fail(`unexpected require ${id}`);
            }
        },
        console: { log: (line) => calls.logs.push(line), error: (line) => calls.logs.push(line) },
        setTimeout: () => 0,
        setInterval: () => 1,
        clearInterval() {},
        Date: { now: () => clock.now },
        Vector3,
        Navigation,
        World: {
            get hour() {
                return state.hour;
            },
            resolveGround: async (player, position) => {
                reads.push({ by: player.steamId, x: position.x, y: position.y });
                if (!state.answers) return { answered: false, reason: "sem resposta", hit: null, hits: [] };
                const hit = state.ground(position.x, position.y);
                return { answered: true, reason: "", hit, hits: hit === null ? [] : [hit] };
            },
        },
        Chat: { sendToPlayer: (player, text) => calls.chat.push({ to: player.steamId, text }) },
        Events: { on: (name, fn) => handlers.set(name, fn), onClient() {} },
        Player: { getById: (id) => players.get(id) ?? null, all: () => [...players.values()] },
        Dialogue: {
            open: (playerId, page) => {
                sessions += 1;
                openSessions.set(sessions, playerId);
                calls.dialogs.push({ session: sessions, page: JSON.parse(JSON.stringify(page)) });
                return sessions;
            },
            update: (session, page) => {
                calls.dialogs.push({ session, page: JSON.parse(JSON.stringify(page)) });
                return openSessions.has(session);
            },
            close: (session) => {
                calls.closedDialogs.push(session);
                openSessions.delete(session);
                return true;
            },
            sessionOf: (playerId) => [...openSessions.entries()].find(([, owner]) => owner === playerId)?.[0] ?? 0,
        },
        Cart: {
            spawn: (blueprint, position, rotation) => {
                cartIds += 1;
                const cart = { id: cartIds, blueprint, position: { x: position.x, y: position.y, z: position.z }, yaw: rotation.z, destroy: () => calls.destroyed.push(cart.id) };
                carts.set(cart.id, cart);
                calls.spawned.push(cart);
                return cart;
            },
            getById: (id) => carts.get(id) ?? null,
        },
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/travel.js"), "utf8"), context);

    const coaches = new context.exports.Coaches(() => clock.now, (fn, ms) => queue.push({ fn, ms }));
    coaches.attach(handle);
    // Most of the tests below were written for the first seven stops with the first anchors (inside the villages) and no place chosen
    // (the ground read, or the mesh asked); the stops chosen by hand (2026-10-20) are checked on their own, with `fixed: true`.
    if (!fixed) {
        for (const id of [...coaches.stops.keys()]) {
            if (!(id in FIRST_ANCHORS)) {
                coaches.stops.delete(id);
            }
        }
        for (const [id, anchor] of Object.entries(FIRST_ANCHORS)) {
            const stop = coaches.stops.get(id);
            stop.anchor = anchor;
            stop.avoid = undefined;
            stop.fixed = undefined;
            stop.place = null;
        }
    }
    calls.posts = coaches.posts;
    let nextId = 1;
    const makePlayer = (steamId, position = { x: 758.5, y: 3354.5, z: 100 }, extra = {}) => {
        const player = {
            id: nextId++,
            steamId,
            nickname: steamId,
            ready: true,
            alive: true,
            position,
            rotation: { x: 0, y: 0, z: 0 },
            mounted: false,
            horse: null,
            carrying: null,
            carriedBy: null,
            carriedItem: null,
            spawnOk: true,
            teleportOk: true,
            moves: [],
            emit: (event, payload) => calls.emitted.push({ to: steamId, event, payload: JSON.parse(payload) }),
            spawn(at, rotation) {
                this.moves.push({ how: "spawn", x: at.x, y: at.y, z: at.z, yaw: rotation?.z });
                return this.spawnOk;
            },
            teleport(at) {
                this.moves.push({ how: "teleport", x: at.x, y: at.y, z: at.z });
                return this.teleportOk;
            },
            ...extra,
        };
        players.set(player.id, player);
        return player;
    };
    const told = (steamId) => calls.chat.filter((entry) => entry.to === steamId).map((entry) => entry.text);
    const fades = (steamId) => calls.emitted.filter((entry) => entry.to === steamId && entry.event === "kcdc-gamemode:travel.fade").map((entry) => entry.payload);
    const lastPage = () => calls.dialogs.at(-1).page;
    const run = () => {
        const next = queue.shift();
        assert.ok(next, "something is waiting");
        next.fn();
        return next.ms;
    };
    const coachOf = (id, at = undefined) => ({ id: 900, position: at ?? (() => { const place = coaches.stops.get(id).place.coach; return { x: place.x, y: place.y, z: place.z }; })() });
    return { api: context.exports, coaches, nav, state, calls, handlers, players, carts, queue, clock, reservedCarts, asleep, makePlayer, told, fades, lastPage, run, coachOf, openSessions, handle, reads };
}

/** Bare grass, level, nothing on it. */
const GRASS = { position: { z: 100 }, normal: { z: 1 }, surface: "mat_grass", kind: "terrain" };
const ROAD = { position: { z: 100 }, normal: { z: 1 }, surface: "mat_road", kind: "terrain" };
const FIELD = { position: { z: 100 }, normal: { z: 1 }, surface: "mat_field", kind: "terrain" };
const TROUGH = { position: { z: 101 }, normal: { z: 1 }, surface: "mat_wood", kind: "entity" };

/** The stops put where the walkable mesh alone finds room, as the first versions did: what most of the tests below stand on. */
function placed(sut) {
    sut.coaches.place();
    for (const id of [...sut.coaches.stops.keys()]) {
        sut.coaches.researchMesh(id);
    }
}

/** A road along x at y 0..4 (five metres wide), grass either side: what a client reads near the first stop. */
const roadAlongX = (x, y) => (y >= 0 && y <= 4 ? ROAD : GRASS);

/** Lets the reading that was started run to its end (it is made of promises). */
const settle = async () => {
    for (let i = 0; i < 60; i += 1) await new Promise((resolve) => setImmediate(resolve));
};

/** Everything placed on the open plane, and a traveller at Suchdol with a hundred coins. */
function atSuchdol(options) {
    const sut = load(options);
    placed(sut);
    sut.coaches.spawnCarts();
    const ana = sut.makePlayer("ana");
    sut.state.money.set("ana", 1000);
    const post = sut.calls.posts.find((candidate) => candidate.id === "cocheiro-suchdol");
    const npc = sut.coachOf("suchdol");
    return { sut, ana, post, npc };
}

// ---------------------------------------------------------------------------------------------
// Where a stop goes.

test("on open ground the wagon stands at the village's spot itself, with the coachman beside it facing out and the arrivals further back facing it", () => {
    const sut = load();
    const found = sut.api.findRoom({ x: 0, y: 0, z: 100 });
    assert.equal(found.by, "busca");
    assert.equal(found.blueprint, "wagon_b_covered");
    assert.deepEqual(plain(found.cart), { x: 0, y: 0, z: 100, yaw: 0 });
    assert.deepEqual(plain(found.coach), { x: 2.3, y: 0.5, z: 100, yaw: -90 }, "on the wagon's right, a step ahead of the axle, looking away from it");
    assert.deepEqual(plain(found.arrive), { x: 3.4, y: -2.5, z: 100, yaw: 90 }, "further back on the same side, looking at the wagon");
});

test("a wall beside the spot moves the wagon off it: what is found fits clear of the wall, and the coachman and the arrivals too", () => {
    const sut = load();
    sut.nav.walls.push({ x0: 1, x1: 3, y0: -50, y1: 50 });
    const found = sut.api.findRoom({ x: 0, y: 0, z: 100 });
    assert.ok(found !== null);
    assert.equal(found.blueprint, "wagon_b_covered");
    assert.equal(sut.api.fits(found.cart, found.cart.yaw, sut.api.FOOTPRINTS[0]), true);
    for (const point of [found.cart, found.coach, found.arrive]) {
        assert.ok(point.x < 1 || point.x > 3, JSON.stringify(point));
    }
    assert.ok(Math.hypot(found.cart.x, found.cart.y) <= 25);
});

test("a courtyard too small for the wagon takes the two-wheeler; one too small for both, and no mesh at all, take nothing", () => {
    const sut = load();
    sut.nav.circle = { x: 0, y: 0, r: 4.5 };
    const small = sut.api.findRoom({ x: 0, y: 0, z: 100 });
    assert.equal(small.blueprint, "cart_b");
    sut.nav.circle = { x: 0, y: 0, r: 2 };
    assert.equal(sut.api.findRoom({ x: 0, y: 0, z: 100 }), null);
    sut.nav.circle = null;
    sut.nav.ready = false;
    assert.equal(sut.api.findRoom({ x: 0, y: 0, z: 100 }), null);
});

test("the price goes with the straight line: a base and so much a kilometre, never under a coin; distances read in metres or kilometres", () => {
    const sut = load();
    assert.equal(sut.api.fareOf(0), 5);
    assert.equal(sut.api.fareOf(1), 20);
    assert.equal(sut.api.fareOf(3.4), 56);
    assert.equal(sut.api.fareOf(0, { base: 0, perKm: 0 }), 1);
    assert.equal(sut.api.distanceText(0.8368), "840 m");
    assert.equal(sut.api.distanceText(3.3979), "3,4 km");
    assert.equal(sut.api.kmBetween({ x: 0, y: 0 }, { x: 300, y: 400 }), 0.5);
});

test("at the start every stop waits at its road point, with no wagon, for a player to come near; nothing guessed is written down", () => {
    const sut = load();
    sut.coaches.place();
    assert.equal(sut.calls.posts.length, 7);
    for (const stop of sut.coaches.stops.values()) {
        assert.equal(stop.place.by, "vila", stop.id);
        assert.equal(stop.place.cart, null, stop.id);
    }
    assert.equal(sut.calls.stored.length, 0, "a guess is not kept");
    assert.ok(sut.calls.logs.some((line) => /Suchdol, Raborsch, Malešov, Wysoka, Kuttenberg, Zikmundovo, Minas esperam um jogador por perto/.test(line)));
    assert.equal(sut.coaches.spawnCarts(), 0, "no wagon in the road before the ground has been read");
});

test("a place that was read or chosen is kept and read back at the next start, and looked for nothing", () => {
    const sut = load();
    placed(sut);
    const kept = sut.calls.stored.at(-1).value;
    assert.deepEqual(Object.keys(kept.places).sort(), ["grunta", "kuttenberg", "malesov", "raborsch", "suchdol", "wysoka", "zikmundovo"]);
    assert.equal(kept.places.suchdol.by, "busca");

    const again = load({ stored: kept });
    again.coaches.load();
    again.nav.walls.push({ x0: -10000, x1: 10000, y0: -10000, y1: 10000 }); // Were it looked for again, nothing would fit anywhere now.
    again.coaches.place();
    assert.deepEqual(plain(again.coaches.stops.get("suchdol").place), plain(sut.coaches.stops.get("suchdol").place), "the place kept is the place");
    assert.equal(again.coaches.stops.get("suchdol").place.by, "busca");
    assert.deepEqual(plain(again.calls.stored), [], "and nothing is written again");
});

test("with no mesh the stops stand at their spots without wagons, said so in the log, and nothing is written down", () => {
    const sut = load();
    sut.nav.ready = false;
    sut.coaches.place();
    assert.ok(sut.calls.logs.some((line) => /malha de navegação não está pronta/.test(line)));
    assert.ok([...sut.coaches.stops.values()].every((stop) => stop.place.by === "vila" && stop.place.cart === null));
    assert.equal(sut.coaches.spawnCarts(), 0);
    assert.deepEqual(sut.calls.stored.at(-1)?.value.places ?? {}, {});
});

test("the wagons are the service's: one per stop with room, reserved, telling whoever tries to get on to talk to the coachman, or that he went to bed", () => {
    const sut = load();
    placed(sut);
    assert.equal(sut.coaches.spawnCarts(), 7);
    const suchdol = sut.calls.spawned.find((cart) => cart.position.x === 757.1);
    assert.equal(suchdol.blueprint, "wagon_b_covered");
    assert.equal(suchdol.yaw, 0);
    const word = sut.reservedCarts.get(suchdol.id);
    assert.equal(word(), "Essa carroça é do cocheiro: fale com ele para viajar.");
    sut.asleep.add("cocheiro-suchdol");
    assert.equal(word(), "O cocheiro de Suchdol foi dormir: as viagens voltam de manhã.");

    // Taken out of the world: back a moment later, under a new id.
    sut.coaches.cartGone(suchdol);
    assert.equal(sut.reservedCarts.has(suchdol.id), false);
    assert.equal(sut.run(), 10_000);
    const back = sut.calls.spawned.at(-1);
    assert.equal(back.position.x, 757.1);
    assert.ok(sut.reservedCarts.has(back.id));

    // At the stop of the resource, all of them go, and none comes back.
    sut.coaches.stop();
    assert.equal(sut.reservedCarts.size, 0);
    sut.coaches.cartGone(back);
    assert.equal(sut.queue.length, 0);
});

// ---------------------------------------------------------------------------------------------
// The coachman.

test("E on the coachman lists the other stops, nearest first, with the price and the distance; five to a page", () => {
    const { sut, ana, post, npc } = atSuchdol();
    assert.equal(sut.coaches.open(ana, post, npc), true);
    const page = sut.lastPage();
    assert.match(page.line, /^Cocheiro: para onde vamos\?/);
    assert.deepEqual(
        page.options.map((option) => option.text),
        ["Raborsch: 18 moedas (840 m)", "Wysoka: 19 moedas (910 m)", "Zikmundovo: 20 moedas (1,0 km)", "Minas: 46 moedas (2,7 km)", "Malešov: 52 moedas (3,1 km)", "Mais destinos ›", "Agora não"],
    );
    const session = sut.calls.dialogs.at(-1).session;
    sut.coaches.choose(session, ana, "more");
    assert.deepEqual(sut.lastPage().options.map((option) => option.text), ["Kuttenberg: 56 moedas (3,4 km)", "‹ Destinos de antes", "Agora não"]);
    sut.coaches.choose(session, ana, "less");
    assert.equal(sut.lastPage().options[0].text, "Raborsch: 18 moedas (840 m)");
    sut.coaches.choose(session, ana, "leave");
    assert.deepEqual(sut.calls.closedDialogs, [session]);
    assert.equal(sut.coaches.talking(), 0);
});

test("a trip: the yes takes the coins, the screen goes dark, the traveller is put down beside the other wagon, and the screen comes back", () => {
    const { sut, ana, post, npc } = atSuchdol();
    sut.coaches.open(ana, post, npc);
    const session = sut.calls.dialogs.at(-1).session;
    sut.coaches.choose(session, ana, "go:raborsch");
    assert.equal(sut.lastPage().line, "Cocheiro: até Raborsch são 18 moedas. Partimos agora?");
    assert.deepEqual(sut.lastPage().options.map((option) => option.id), ["pay", "back", "leave"]);
    sut.coaches.choose(session, ana, "pay");

    assert.equal(sut.state.money.get("ana"), 820, "18 coins are 180 of the money item");
    assert.ok(sut.calls.closedDialogs.includes(session));
    assert.equal(sut.told("ana").at(-1), "Você paga 18 moedas ao cocheiro e sobe na carroça para Raborsch.");
    assert.deepEqual(sut.fades("ana"), [{ phase: "out", ms: 1500 }]);
    assert.equal(sut.coaches.travelling(), 1);
    assert.equal(sut.coaches.open(ana, post, npc), false, "nobody talks to a coachman on the way");

    assert.equal(sut.run(), 1700);
    assert.deepEqual(ana.moves, [{ how: "spawn", x: 1439.8, y: 3840.1, z: 100, yaw: 90 }], "beside Raborsch's wagon, facing it, held until the ground is there");
    assert.ok(sut.calls.logs.some((line) => line === "travel: ana viajou de Suchdol a Raborsch por 18 moedas"));
    assert.equal(sut.run(), 2500);
    assert.deepEqual(sut.fades("ana").at(-1), { phase: "in", ms: 2000 });
    assert.equal(sut.told("ana").at(-1), "Você chegou a Raborsch.");
    assert.equal(sut.coaches.travelling(), 0);
});

test("two who arrive one after the other are not put on the same spot", () => {
    const { sut, ana, post, npc } = atSuchdol();
    const bia = sut.makePlayer("bia");
    sut.state.money.set("bia", 1000);
    for (const player of [ana, bia]) {
        sut.coaches.open(player, post, npc);
        const session = sut.calls.dialogs.at(-1).session;
        sut.coaches.choose(session, player, "go:wysoka");
        sut.coaches.choose(session, player, "pay");
    }
    sut.run();
    sut.run();
    assert.notDeepEqual({ x: ana.moves[0].x, y: ana.moves[0].y }, { x: bia.moves[0].x, y: bia.moves[0].y });
});

test("nobody travels by night: the coachman says so, and a yes kept from the day is refused when night has come", () => {
    const { sut, ana, post, npc } = atSuchdol();
    sut.state.hour = 23;
    sut.coaches.open(ana, post, npc);
    assert.match(sut.lastPage().line, /já é noite, e os cavalos descansam\. Partimos de manhã cedo, a partir das 6 horas/);
    assert.deepEqual(sut.lastPage().options.map((option) => option.text), ["Até amanhã"]);
    sut.coaches.choose(sut.calls.dialogs.at(-1).session, ana, "leave");

    sut.state.hour = 21.5;
    sut.coaches.open(ana, post, npc);
    const session = sut.calls.dialogs.at(-1).session;
    sut.coaches.choose(session, ana, "go:raborsch");
    sut.state.hour = 22;
    sut.coaches.choose(session, ana, "pay");
    assert.match(sut.lastPage().line, /já é noite/);
    assert.equal(sut.state.money.get("ana"), 1000);
    sut.state.hour = 5.9;
    assert.equal(sut.coaches.night(), true);
    sut.state.hour = 6;
    assert.equal(sut.coaches.night(), false);
});

test("nobody on a horse, in a cart, carrying, trading, at the dice, in a fight or with a restart coming sets off, and nothing is paid", () => {
    const cases = [
        ["mounted", (p) => (p.mounted = true), "Desça do cavalo antes de subir na carroça."],
        ["in a cart", (p) => (p.inCart = true), "Desça da carroça em que você está antes."],
        ["carrying", (p) => (p.carrying = {}), "Não dá para viajar carregando alguém ou alguma coisa nos braços."],
        ["an item in the arms", (p) => (p.carriedItem = "log"), "Não dá para viajar carregando alguém ou alguma coisa nos braços."],
        ["trading", (p, sut) => sut.state.trading.add(p.id), "Termine a troca antes de viajar."],
        ["dice", (p, sut) => sut.state.dice.add(p.id), "Saia da mesa de dados antes de viajar."],
        ["a fight", (p, sut) => sut.coaches.hit(p), "Não dá para viajar no meio de uma briga."],
        ["a restart", (_p, sut) => (sut.state.restart = true), "O servidor vai reiniciar em instantes: a viagem fica para depois."],
        ["far", (p) => (p.position = { x: 790, y: 3354, z: 100 }), "Você se afastou do cocheiro."],
    ];
    for (const [what, setUp, text] of cases) {
        const { sut, ana, post, npc } = atSuchdol();
        sut.coaches.open(ana, post, npc);
        const session = sut.calls.dialogs.at(-1).session;
        sut.coaches.choose(session, ana, "go:raborsch");
        setUp(ana, sut);
        sut.coaches.choose(session, ana, "pay");
        assert.equal(sut.told("ana").at(-1), text, what);
        assert.equal(sut.state.money.get("ana"), 1000, what);
        assert.equal(sut.fades("ana").length, 0, what);
    }
});

test("a fight is forgotten after half a minute; somebody short of coins is told the price and keeps the choice open", () => {
    const { sut, ana, post, npc } = atSuchdol();
    sut.coaches.hit(ana);
    sut.clock.now += 30_001;
    sut.coaches.tick();
    assert.equal(sut.coaches.refusal(ana, npc), "");
    sut.state.money.set("ana", 170);
    sut.coaches.open(ana, post, npc);
    const session = sut.calls.dialogs.at(-1).session;
    sut.coaches.choose(session, ana, "go:raborsch");
    sut.coaches.choose(session, ana, "pay");
    assert.equal(sut.told("ana").at(-1), "A viagem até Raborsch custa 18 moedas e você não tem o bastante.");
    assert.equal(sut.state.money.get("ana"), 170);
    assert.equal(sut.calls.closedDialogs.includes(session), false);
});

test("a move the game refuses pays the traveller back; one who left on the way is only written down", () => {
    const { sut, ana, post, npc } = atSuchdol();
    ana.spawnOk = false;
    ana.teleportOk = false;
    sut.coaches.open(ana, post, npc);
    let session = sut.calls.dialogs.at(-1).session;
    sut.coaches.choose(session, ana, "go:grunta");
    sut.coaches.choose(session, ana, "pay");
    assert.equal(sut.state.money.get("ana"), 540);
    sut.run();
    assert.equal(sut.state.money.get("ana"), 1000, "paid back");
    assert.equal(sut.told("ana").at(-1), "Não deu para viajar agora; o dinheiro foi devolvido.");
    assert.deepEqual(sut.fades("ana").at(-1), { phase: "in", ms: 800 });
    assert.ok(sut.calls.logs.some((line) => /a viagem de ana de Suchdol a Minas não saiu; 46 moedas devolvidas/.test(line)));

    ana.spawnOk = true;
    sut.coaches.open(ana, post, npc);
    session = sut.calls.dialogs.at(-1).session;
    sut.coaches.choose(session, ana, "go:grunta");
    sut.coaches.choose(session, ana, "pay");
    sut.players.delete(ana.id);
    sut.run();
    assert.ok(sut.calls.logs.some((line) => /travel: ana saiu no meio da viagem de Suchdol a Minas \(pagou 46 moedas\)/.test(line)));
    assert.equal(sut.coaches.travelling(), 0);
});

test("a teleport is the second way when the spawn is refused", () => {
    const { sut, ana, post, npc } = atSuchdol();
    ana.spawnOk = false;
    sut.coaches.open(ana, post, npc);
    const session = sut.calls.dialogs.at(-1).session;
    sut.coaches.choose(session, ana, "go:raborsch");
    sut.coaches.choose(session, ana, "pay");
    sut.run();
    assert.deepEqual(ana.moves.map((move) => move.how), ["spawn", "teleport"]);
    assert.equal(sut.state.money.get("ana"), 820);
});

test("walking off, dying, leaving or the coachman going in ends the conversation", () => {
    const { sut, ana, post, npc } = atSuchdol();
    sut.coaches.open(ana, post, npc);
    ana.position = { x: 770, y: 3354, z: 100 };
    sut.coaches.tick();
    assert.equal(sut.told("ana").at(-1), "Você se afastou do cocheiro.");
    assert.equal(sut.coaches.talking(), 0);

    ana.position = { x: 758.5, y: 3354.5, z: 100 };
    const gone = { id: 901, get position() { throw new Error("Entity handle is not valid"); } };
    sut.coaches.open(ana, post, gone);
    sut.coaches.tick();
    assert.equal(sut.told("ana").at(-1), "O cocheiro foi embora.");

    sut.coaches.open(ana, post, npc);
    ana.alive = false;
    sut.coaches.tick();
    assert.equal(sut.coaches.talking(), 0);
    ana.alive = true;
    sut.coaches.open(ana, post, npc);
    sut.coaches.left(ana);
    assert.equal(sut.coaches.talking(), 0);
});

// ---------------------------------------------------------------------------------------------
// The administrator.

test("/viagem aqui: the wagon in front of the administrator, broadside, the coachman between them and it; kept, and the body moved", () => {
    const sut = load();
    placed(sut);
    sut.coaches.spawnCarts();
    const admin = sut.makePlayer("mauro", { x: 100, y: 100, z: 100 });
    const answer = sut.coaches.placeHere(admin, "Suchdol");
    assert.match(answer, /Suchdol: a carroça está na sua frente, de lado, e o cocheiro do seu lado dela/);
    const place = sut.coaches.stops.get("suchdol").place;
    assert.deepEqual(plain(place.cart), { x: 100, y: 106, z: 100, yaw: 90 });
    assert.deepEqual(plain(place.coach), { x: 99.5, y: 103.7, z: 100, yaw: 180 }, "facing the administrator");
    assert.deepEqual(plain(place.arrive), { x: 102.5, y: 102.6, z: 100, yaw: 0 });
    assert.equal(place.by, "admin");
    assert.equal(sut.calls.stored.at(-1).value.places.suchdol.by, "admin");
    assert.deepEqual(sut.calls.spawned.at(-1).position, { x: 100, y: 106, z: 100 });
    assert.deepEqual(sut.calls.sleep.at(-1), "cocheiro-suchdol");
    assert.deepEqual(sut.calls.wake.at(-1), { id: "cocheiro-suchdol", position: { x: 99.5, y: 103.7, z: 100 }, yaw: 180 });
    assert.equal(sut.calls.posts.find((post) => post.id === "cocheiro-suchdol").x, 99.5, "made again there after a death too");
    assert.match(sut.coaches.placeHere(admin, "praga"), /Não há parada "praga"\. As paradas: suchdol, raborsch/);
});

test("/viagem cocheiro, malha, preco, ir, nova and remover", () => {
    const sut = load();
    placed(sut);
    sut.coaches.spawnCarts();
    const admin = sut.makePlayer("mauro", { x: 200, y: 300, z: 100 }, { rotation: { x: 0, y: 0, z: 45 } });

    assert.match(sut.coaches.coachHere(admin, "raborsch"), /Raborsch: o cocheiro fica onde você está/);
    assert.deepEqual(plain(sut.coaches.stops.get("raborsch").place.coach), { x: 200, y: 300, z: 100, yaw: 45 });
    assert.equal(sut.coaches.stops.get("raborsch").place.cart.x, 1436.4, "the wagon stays");

    assert.match(sut.coaches.researchMesh("raborsch"), /Raborsch: carroça posta em x 1436\.4, y 3842\.6 \(só pela malha: pode estar sobre a estrada\)/);
    assert.equal(sut.coaches.stops.get("raborsch").place.by, "busca");

    assert.match(sut.coaches.setPrices(10, 20), /^Preço das viagens: 10 moedas mais 20 por km\. De Suchdol a Raborsch: 27 moedas\.$/);
    assert.deepEqual(sut.calls.stored.at(-1).value.prices, { base: 10, perKm: 20 });
    assert.match(sut.coaches.setPrices(-1, 5), /de 0 a 1000/);
    assert.match(sut.coaches.setPrices(Number.NaN, 5), /de 0 a 1000/);

    assert.equal(sut.coaches.goTo(admin, "grunta"), "Você foi até a parada de Minas.");
    assert.deepEqual(admin.moves.at(-1), { how: "teleport", x: 3200.6, y: 2181, z: 100 });

    assert.match(sut.coaches.addStop(admin, "Sedletz", "Sedletz"), /^Parada Sedletz criada\. Sedletz: a carroça está na sua frente/);
    assert.ok(sut.calls.posts.some((post) => post.id === "cocheiro-sedletz"));
    assert.deepEqual(sut.calls.stored.at(-1).value.added.map((spec) => spec.id), ["sedletz"]);
    assert.match(sut.coaches.addStop(admin, "sedletz", "Outra"), /Já existe a parada sedletz/);
    assert.match(sut.coaches.addStop(admin, "x", "Curta"), /letras minúsculas/);

    assert.match(sut.coaches.removeStop("wysoka"), /A parada de Wysoka foi tirada/);
    assert.equal(sut.coaches.stops.has("wysoka"), false);
    assert.equal(sut.calls.posts.some((post) => post.id === "cocheiro-wysoka"), false);
    assert.deepEqual(sut.calls.stored.at(-1).value.removed, ["wysoka"]);
    sut.coaches.removeStop("sedletz");
    assert.deepEqual(sut.calls.stored.at(-1).value.added, [], "a stop added and taken out leaves nothing behind");

    // The next start: the prices, the removal and the places as they were left.
    const again = load({ stored: sut.state.file });
    again.coaches.load();
    again.coaches.place();
    assert.deepEqual(plain(again.coaches.prices), { base: 10, perKm: 20 });
    assert.equal(again.coaches.stops.has("wysoka"), false);
    assert.deepEqual(plain(again.coaches.stops.get("raborsch").place), plain(sut.coaches.stops.get("raborsch").place));

    const lines = sut.coaches.lines();
    assert.match(lines[0], /^6 parada\(s\); preço: 10 moedas mais 20 por km; agora é dia\.$/);
    assert.ok(lines.some((line) => /^  suchdol \(Suchdol\): carroça em x 757\.1, y 3353\.9, giro 0°; cocheiro acordado; lugar achado só pela malha$/.test(line)), lines.join("\n"));
});

test("a move made before the bodies are up only changes where they will be made", () => {
    const sut = load();
    placed(sut);
    const admin = sut.makePlayer("mauro", { x: 100, y: 100, z: 100 });
    sut.coaches.placeHere(admin, "suchdol");
    assert.equal(sut.calls.wake.length, 0);
    assert.equal(sut.calls.spawned.length, 0);
    assert.equal(sut.calls.posts.find((post) => post.id === "cocheiro-suchdol").x, 99.5);
});

test("installed: the posts and their day (a coachman keeps by his wagon), the dialogue, the hits, the carts, the leaving and the stop", () => {
    const sut = load();
    sut.api.installTravel();
    assert.equal(sut.calls.label, "travel");
    assert.equal(sut.calls.life.settings.roamM, 1.5);
    assert.equal(sut.calls.life.settings.open, 6);
    assert.ok(sut.calls.life.lines.length >= 3);
    for (const name of ["dialogueChoice", "dialogueClosed", "playerDamage", "cartDestroy", "playerDisconnect", "resourceStop"]) {
        assert.ok(sut.handlers.has(name), name);
    }
    assert.ok(sut.calls.logs.some((line) => /travel: 13 parada\(s\) de viagem de carroça \(Suchdol, Raborsch, Malešov, Wysoka, Kuttenberg, Zikmundovo, Minas, Bylany, Bohunowitz, Miskowitz, Pschitoky, Stará Kutná, Horschan\); preço 5 moedas mais 15 por km/.test(line)), sut.calls.logs.join("\n"));
    const singleton = sut.api.coaches;
    const ana = sut.makePlayer("ana");
    sut.handlers.get("playerDamage")(ana, null, 5, null, "fall");
    assert.equal(singleton.refusal(ana, null).includes("briga"), false, "a fall is no fight");
    sut.handlers.get("playerDamage")(ana, { id: 7 }, 5, "torso", "combat");
    assert.match(singleton.refusal(ana, null), /briga/);
});

test("every stop is a spot chosen by hand outside its village and outside the castles' walls, facing away from the village (2026-10-20)", () => {
    const sut = load({ fixed: true });
    const castle = { minX: 1400, maxX: 1460, minY: 3805, maxY: 3870 };
    const fortress = { minX: 440, maxX: 500, minY: 344, maxY: 402 };
    const inside = (box, p) => p.x >= box.minX && p.x <= box.maxX && p.y >= box.minY && p.y <= box.maxY;
    assert.equal(sut.api.STOPS.length, 13);
    assert.deepEqual(plain(sut.api.STOPS.map((spec) => spec.id)), ["suchdol", "raborsch", "malesov", "wysoka", "kuttenberg", "zikmundovo", "grunta", "bylany", "bohunowitz", "miskowitz", "pschitoky", "old-kutna", "horschan"]);
    assert.equal(new Set(sut.api.STOPS.map((spec) => spec.id)).size, 13);
    const degrees = (a, b) => Math.abs((((a - b + 180) % 360) + 360) % 360 - 180);
    for (const spec of sut.api.STOPS) {
        const fixed = spec.fixed;
        assert.ok(fixed !== undefined, `${spec.id}: has a place`);
        assert.ok(!inside(castle, fixed.cart) && !inside(fortress, fixed.cart), `${spec.id}: not in a castle`);
        assert.deepEqual(plain({ x: spec.anchor.x, y: spec.anchor.y, z: spec.anchor.z }), { x: fixed.cart.x, y: fixed.cart.y, z: fixed.cart.z }, `${spec.id}: the anchor is the wagon's axle`);
        assert.ok(spec.center && [spec.center.x, spec.center.y, fixed.cart.x, fixed.cart.y, fixed.cart.z].every(Number.isFinite), `${spec.id}: has a village`);
        const away = Math.hypot(fixed.cart.x - spec.center.x, fixed.cart.y - spec.center.y);
        assert.ok(away >= 60 && away <= 400, `${spec.id}: ${Math.round(away)} m from the heart of the village is outside it, and not far`);
        // Facing away from the village, as a cart that is leaving: its ahead (-sin, cos) points from the village to the wagon.
        const r = (fixed.cart.yaw * Math.PI) / 180;
        const outward = -Math.sin(r) * (fixed.cart.x - spec.center.x) + Math.cos(r) * (fixed.cart.y - spec.center.y);
        assert.ok(outward > 0, `${spec.id}: faces away from the village`);
        // The coachman stands on a side of the wagon, 2.3 m out and half a metre ahead of the axle, looking out; a traveller 3.4 m out and
        // 2.5 m back, looking at it (what `beside` makes): the same geometry in both.
        const side = Math.sign(Math.cos(r) * (fixed.coach.x - fixed.cart.x) + Math.sin(r) * (fixed.coach.y - fixed.cart.y));
        assert.ok(side === 1 || side === -1, `${spec.id}: a side`);
        const want = (out, along) => ({ x: fixed.cart.x + Math.cos(r) * side * out - Math.sin(r) * along, y: fixed.cart.y + Math.sin(r) * side * out + Math.cos(r) * along });
        const coach = want(2.3, 0.5);
        const arrive = want(3.4, -2.5);
        assert.ok(Math.hypot(coach.x - fixed.coach.x, coach.y - fixed.coach.y) < 0.02, `${spec.id}: the coachman's place`);
        assert.ok(Math.hypot(arrive.x - fixed.arrive.x, arrive.y - fixed.arrive.y) < 0.02, `${spec.id}: the traveller's place`);
        assert.ok(degrees(fixed.coach.yaw, fixed.cart.yaw - 90 * side) < 0.2, `${spec.id}: the coachman looks out`);
        assert.ok(degrees(fixed.arrive.yaw, fixed.coach.yaw + 180) < 0.2, `${spec.id}: the traveller looks at the wagon`);
        assert.ok(Math.abs(fixed.coach.z - fixed.cart.z) < 1.5 && Math.abs(fixed.arrive.z - fixed.cart.z) < 1.5, `${spec.id}: on the same ground`);
    }
    assert.ok(sut.api.STOPS.find((spec) => spec.id === "raborsch").avoid && sut.api.STOPS.find((spec) => spec.id === "malesov").avoid, "the castles are kept out of the search");
});

test("a stop with a place chosen by hand has it from the start: the wagon is made at once, no ground is read, and nothing is written down", async () => {
    const sut = load({ fixed: true });
    sut.coaches.place();
    assert.equal(sut.calls.posts.length, 13);
    for (const stop of sut.coaches.stops.values()) {
        assert.equal(stop.place.by, "fixo", stop.id);
        assert.ok(stop.place.cart !== null, stop.id);
        assert.equal(stop.place.blueprint, "wagon_b_covered", stop.id);
    }
    const suchdol = sut.calls.posts.find((post) => post.id === "cocheiro-suchdol");
    assert.deepEqual([suchdol.x, suchdol.y, suchdol.z, suchdol.yaw], [665.65, 3388.81, 141.93, 107], "the coachman where he was put");
    assert.equal(sut.coaches.spawnCarts(), 13, "every wagon in the world at once");
    assert.deepEqual(sut.calls.spawned.find((cart) => cart.position.x === 668).position, { x: 668, y: 3389, z: 142 });
    assert.equal(sut.calls.spawned.find((cart) => cart.position.x === 668).yaw, 17);
    assert.ok(!sut.calls.logs.some((line) => /esperam um jogador por perto/.test(line)), "nobody is waited for");

    // A player standing beside one lends nothing: the place is already known.
    sut.makePlayer("ana", { x: 670, y: 3389, z: 142 });
    sut.coaches.roadsideTick(sut.clock.now + 60 * 60_000);
    await settle();
    assert.equal(sut.reads.length, 0);
    assert.deepEqual(plain(sut.calls.stored), [], "what was chosen by hand is in the code, not in the saved file");
    sut.coaches.persist();
    assert.deepEqual(plain(sut.calls.stored.at(-1).value.places), {});
});

test("an older reading of the ground saved for a stop chosen by hand is ignored; an administrator's own move is kept, and /viagem original brings the chosen place back", () => {
    const first = load({ fixed: true });
    first.coaches.place();
    const saved = {
        prices: { base: 7, perKm: 16 },
        places: {
            suchdol: { cart: { x: 634, y: 3394, z: 144.11, yaw: 22.4 }, blueprint: "wagon_b_covered", coach: { x: 635.94, y: 3395.34, z: 143.69, yaw: -67.6 }, arrive: { x: 638.1, y: 3392.98, z: 143.59, yaw: 112.4 }, by: "estrada" },
            raborsch: { cart: { x: 1636.2, y: 3640.2, z: 88.49, yaw: 60 }, blueprint: "wagon_b_covered", coach: { x: 1636.92, y: 3642.44, z: 88.56, yaw: -30 }, arrive: { x: 1640.07, y: 3641.89, z: 88.53, yaw: 150 }, by: "busca" },
            wysoka: { cart: { x: 400, y: 2480, z: 218, yaw: 10 }, blueprint: "wagon_b_covered", coach: { x: 402, y: 2480, z: 218, yaw: -80 }, arrive: { x: 404, y: 2478, z: 218, yaw: 100 }, by: "admin" },
        },
        added: [],
        removed: [],
    };
    const sut = load({ fixed: true, stored: saved });
    sut.coaches.load();
    sut.coaches.place();
    assert.equal(sut.coaches.prices.base, 7, "the prices are still read");
    assert.equal(sut.coaches.stops.get("suchdol").place.by, "fixo", "the reading of the morning is not the place");
    assert.equal(sut.coaches.stops.get("suchdol").place.cart.x, 668);
    assert.equal(sut.coaches.stops.get("raborsch").place.by, "fixo");
    assert.equal(sut.coaches.stops.get("raborsch").place.cart.x, 1716);
    assert.equal(sut.coaches.stops.get("wysoka").place.by, "admin", "what an administrator did with `/viagem aqui` holds");
    assert.equal(sut.coaches.stops.get("wysoka").place.cart.x, 400);

    assert.match(sut.coaches.restore("wysoka"), /^Wysoka: a carroça e o cocheiro voltaram ao lugar escolhido à mão \(x 534, y 2536\)\.$/);
    assert.equal(sut.coaches.stops.get("wysoka").place.by, "fixo");
    assert.deepEqual(plain(sut.coaches.stops.get("wysoka").place.coach), { x: 535.29, y: 2534.03, z: 219.06, yaw: -159 });
    assert.deepEqual(plain(sut.calls.stored.at(-1).value.places), {}, "nothing of it is kept in the saved file any more");
    assert.match(sut.coaches.restore("praga"), /Não há parada "praga"/);

    // Then an administrator's move: kept, and honoured at the next start.
    const admin = sut.makePlayer("mauro", { x: 100, y: 100, z: 100 });
    sut.coaches.placeHere(admin, "suchdol");
    assert.equal(sut.coaches.stops.get("suchdol").place.by, "admin");
    const again = load({ fixed: true, stored: sut.state.file });
    again.coaches.load();
    again.coaches.place();
    assert.equal(again.coaches.stops.get("suchdol").place.by, "admin");
    assert.equal(again.coaches.stops.get("suchdol").place.cart.y, 106);
    assert.equal(again.coaches.stops.get("kuttenberg").place.by, "fixo");

    // A stop an administrator made has no place to go back to.
    sut.coaches.addStop(admin, "sedletz", "Sedletz");
    assert.match(sut.coaches.restore("sedletz"), /não tem um lugar escolhido à mão para voltar/);
});

test("/viagem procurar and malha leave a stop chosen by hand alone, and say so; a stop made by an administrator is still read", async () => {
    const sut = load({ fixed: true });
    sut.coaches.place();
    const admin = sut.makePlayer("mauro", { x: 670, y: 3389, z: 142 });
    assert.match(sut.coaches.research(admin, "suchdol"), /foi posta à mão \(vista do alto no World Builder\): não há o que ler\. \/viagem aqui suchdol a muda de lugar\./);
    assert.match(sut.coaches.researchMesh("suchdol"), /foi posta à mão .*a malha não a muda/);
    assert.equal(sut.reads.length, 0);
    assert.equal(sut.coaches.stops.get("suchdol").place.by, "fixo");

    sut.coaches.addStop(admin, "sedletz", "Sedletz");
    sut.coaches.stops.get("sedletz").place = null;
    sut.coaches.place();
    assert.match(sut.coaches.research(admin, "sedletz"), /Lendo o chão ao redor da parada de Sedletz pelo seu jogo/);
    await settle();
    assert.ok(sut.reads.length > 0);
});

test("the list says the stops chosen by hand were", () => {
    const sut = load({ fixed: true });
    sut.coaches.place();
    const lines = sut.coaches.lines();
    assert.match(lines[0], /^13 parada\(s\); preço: 5 moedas mais 15 por km/);
    assert.ok(lines.some((line) => /^  suchdol \(Suchdol\): carroça em x 668, y 3389, giro 17° \(fora do mundo agora\); cocheiro acordado; posta à mão, vista no World Builder$/.test(line)), lines.join("\n"));
});

test("by the road: the wagon goes off it, along it, its outline clear of it, with the coachman toward it", () => {
    const sut = load();
    const api = sut.api;
    // A road along x at y 0..4 (5 m wide), ground everywhere else; the stop's spot is on the road.
    const samples = [];
    for (const p of api.probePoints({ x: 0, y: 0 })) {
        samples.push({ x: p.x, y: p.y, z: 100, road: p.y >= 0 && p.y <= 4, usable: !(p.y >= 0 && p.y <= 4) });
    }
    const spots = plain(api.roadsideSpots({ x: 0, y: 2 }, samples, api.FOOTPRINTS[0]));
    assert.ok(spots.length > 0);
    const best = spots[0];
    assert.ok(best.fromRoad >= 3 && best.fromRoad <= 7, `off the road: ${best.fromRoad} m`);
    assert.ok(best.axle.y > 4 || best.axle.y < 0, "not on it");
    assert.ok(Math.abs(Math.abs(best.yaw) - 90) < 1, `along the road (x): ${best.yaw}`);
    const right = api.rightOf(best.yaw);
    const toward = (best.axle.y > 4 ? -1 : 1) * right.y * best.side;
    assert.ok(toward > 0, "the coachman's side faces the road");
    // A castle box over one side leaves the other.
    const barred = plain(api.roadsideSpots({ x: 0, y: 2 }, samples, api.FOOTPRINTS[0], api.roadside, { minX: -50, maxX: 50, minY: 4.5, maxY: 50 }));
    assert.ok(barred.length > 0 && barred.every((spot) => spot.axle.y < 0));
    // No road read: nothing.
    assert.deepEqual(plain(api.roadsideSpots({ x: 0, y: 0 }, samples.map((one) => ({ ...one, road: false })), api.FOOTPRINTS[0])), []);
});

test("the wagon faces away from the village, whichever way the road is read", () => {
    const sut = load();
    const api = sut.api;
    const samples = [];
    for (const p of api.probePoints({ x: 0, y: 0 })) {
        samples.push({ x: p.x, y: p.y, z: 100, road: p.y >= 0 && p.y <= 4, usable: !(p.y >= 0 && p.y <= 4) });
    }
    for (const [village, wantsEast] of [[{ x: -300, y: 2 }, true], [{ x: 300, y: 2 }, false]]) {
        const spots = plain(api.roadsideSpots({ x: 0, y: 2 }, samples, api.FOOTPRINTS[0], api.roadside, undefined, village));
        assert.ok(spots.length > 0);
        for (const spot of spots.slice(0, 30)) {
            const f = api.ahead(spot.yaw);
            assert.ok(wantsEast ? f.x > 0.9 : f.x < -0.9, `village at x ${village.x}: ahead ${JSON.stringify(f)}`);
        }
    }
});

test("what is not bare ground is in the wagon's way: a trough in the grass, a plowed field and a wall keep it a clear distance off, and what could not be read counts too", () => {
    const sut = load();
    const api = sut.api;
    const base = [];
    for (const p of api.probePoints({ x: 0, y: 0 })) {
        base.push({ x: p.x, y: p.y, z: 100, road: p.y >= 0 && p.y <= 4, usable: !(p.y >= 0 && p.y <= 4) });
    }
    const clear = plain(api.roadsideSpots({ x: 0, y: 2 }, base, api.FOOTPRINTS[0]));
    assert.ok(clear.length > 0);
    // The best place of the clear ground is where a trough is put: the wagon is moved off it, and kept away from it.
    const at = clear[0].axle;
    const withTrough = base.map((one) => (Math.hypot(one.x - at.x, one.y - at.y) <= 2.5 ? { ...one, usable: false } : one));
    const moved = plain(api.roadsideSpots({ x: 0, y: 2 }, withTrough, api.FOOTPRINTS[0]));
    assert.ok(moved.length > 0);
    for (const spot of moved) {
        const f = api.ahead(spot.yaw);
        const r = api.rightOf(spot.yaw);
        for (let along = -4.5; along <= 6; along += 1.5) {
            for (const off of [-1.25, 0, 1.25]) {
                const x = spot.axle.x + f.x * along + r.x * off;
                const y = spot.axle.y + f.y * along + r.y * off;
                assert.ok(Math.hypot(x - at.x, y - at.y) > 1.7, "clear of the trough");
            }
        }
    }
    // A whole verge that is field or water: no place at all.
    assert.deepEqual(plain(api.roadsideSpots({ x: 0, y: 2 }, base.map((one) => (one.road ? one : { ...one, usable: false })), api.FOOTPRINTS[0])), []);
    // A road with no ground read beside it either.
    assert.deepEqual(plain(api.roadsideSpots({ x: 0, y: 2 }, base.filter((one) => one.road), api.FOOTPRINTS[0])), []);
});

test("a player near a stop lends their game: the ground is read, and the wagon and the coachman go by the road, kept as 'estrada'", async () => {
    const sut = load();
    sut.coaches.place();
    sut.coaches.spawnCarts();
    assert.equal(sut.calls.spawned.length, 0, "no wagon yet");
    const suchdol = sut.coaches.stops.get("suchdol");
    sut.state.ground = (x, y) => roadAlongX(x - suchdol.anchor.x, y - suchdol.anchor.y + 2);
    const ana = sut.makePlayer("ana", { x: suchdol.anchor.x + 30, y: suchdol.anchor.y, z: 100 });
    sut.coaches.roadsideTick();
    await settle();

    const place = suchdol.place;
    assert.equal(place.by, "estrada");
    assert.equal(place.blueprint, "wagon_b_covered");
    assert.ok(Math.abs(place.cart.y - suchdol.anchor.y) >= 1, "off the road");
    assert.ok(Math.abs(Math.abs(place.cart.yaw) - 90) < 1, `along the road: ${place.cart.yaw}`);
    assert.deepEqual(sut.calls.spawned.at(-1).position, { x: place.cart.x, y: place.cart.y, z: place.cart.z }, "the wagon is made there");
    assert.deepEqual(plain(sut.calls.wake.at(-1).position), { x: place.coach.x, y: place.coach.y, z: place.coach.z }, "and the coachman made again there");
    assert.equal(sut.calls.stored.at(-1).value.places.suchdol.by, "estrada");
    assert.ok(sut.calls.logs.some((line) => /Suchdol: carroça posta na beira da estrada em .* pelo jogo de ana/.test(line)), sut.calls.logs.join("\n"));
    assert.equal(sut.reads.length > 800 && sut.reads.every((read) => read.by === "ana"), true, "about a thousand points, all through the near player's game");

    // Read, it is not read again; and the other stops, with nobody near them, are left alone.
    const before = sut.reads.length;
    sut.coaches.roadsideTick(sut.clock.now + 60 * 60_000);
    await settle();
    assert.equal(sut.reads.length, before);
    assert.equal(sut.coaches.stops.get("kuttenberg").place.by, "vila");
});

test("with nobody near no ground is read; a client that goes quiet, or no road in sight, or no room by it, leaves the stop as it is and tries again in a while", async () => {
    const sut = load();
    sut.coaches.place();
    sut.coaches.spawnCarts();
    const suchdol = sut.coaches.stops.get("suchdol");
    sut.makePlayer("far", { x: suchdol.anchor.x + 400, y: suchdol.anchor.y, z: 100 });
    sut.coaches.roadsideTick();
    await settle();
    assert.equal(sut.reads.length, 0, "400 m is too far to lend a game");

    const ana = sut.makePlayer("ana", { x: suchdol.anchor.x + 20, y: suchdol.anchor.y, z: 100 });
    sut.state.answers = false;
    sut.coaches.roadsideTick();
    await settle();
    assert.equal(suchdol.place.by, "vila");
    assert.ok(sut.calls.logs.some((line) => /O jogo de ana parou de responder na leitura do chão de Suchdol/.test(line)));

    sut.state.answers = true;
    sut.coaches.roadsideTick(sut.clock.now + 1_000);
    await settle();
    assert.equal(sut.reads.length < 100, true, "tried again only after a while");

    sut.coaches.roadsideTick(sut.clock.now + 4 * 60_000);
    await settle();
    assert.equal(suchdol.place.by, "vila");
    assert.ok(sut.calls.logs.some((line) => /Nenhum chão de estrada a 40 m do ponto de Suchdol/.test(line)), "plain grass all round: no road");

    // A road, but a field all along it and water on the other side: the road is found, and no room beside it.
    sut.state.ground = (x, y) => (y - suchdol.anchor.y >= -2 && y - suchdol.anchor.y <= 2 ? ROAD : FIELD);
    sut.coaches.roadsideTick(sut.clock.now + 9 * 60_000);
    await settle();
    assert.equal(suchdol.place.by, "vila");
    assert.ok(sut.calls.logs.some((line) => /Suchdol: \d+ pontos de estrada e 0 de grama, mas nenhum lugar livre na beira/.test(line)), sut.calls.logs.slice(-3).join("\n"));
    void ana;
});

test("after four readings that found nothing the walkable mesh alone chooses, so there is a wagon at all, and a reading is still welcome later", async () => {
    const sut = load();
    sut.coaches.place();
    sut.coaches.spawnCarts();
    const suchdol = sut.coaches.stops.get("suchdol");
    sut.makePlayer("ana", { x: suchdol.anchor.x + 20, y: suchdol.anchor.y, z: 100 });
    for (let k = 1; k <= 4; k += 1) {
        sut.coaches.roadsideTick(sut.clock.now + k * 10 * 60_000);
        await settle();
    }
    assert.equal(suchdol.place.by, "busca");
    assert.ok(suchdol.place.cart !== null);
    assert.ok(sut.calls.logs.some((line) => /Suchdol: o chão da estrada não foi lido a contento; a carroça ficou onde a malha achou lugar/.test(line)));
    assert.equal(sut.calls.stored.at(-1).value.places.suchdol.by, "busca");

    const reads = sut.reads.length;
    sut.coaches.roadsideTick(sut.clock.now + 100 * 60_000);
    await settle();
    assert.equal(sut.reads.length > reads, false, "this run is done with it; the next start tries again");
});

test("/viagem procurar: the administrator's own game reads the ground, if they stand near the stop; far away they are told where to go", async () => {
    const sut = load();
    sut.coaches.place();
    sut.coaches.spawnCarts();
    const suchdol = sut.coaches.stops.get("suchdol");
    sut.state.ground = (x, y) => roadAlongX(x - suchdol.anchor.x, y - suchdol.anchor.y + 2);
    const far = sut.makePlayer("mauro", { x: 5000, y: 5000, z: 100 });
    assert.match(sut.coaches.research(far, "suchdol"), /Vá até perto da parada de Suchdol \(a menos de 150 m de x 757, y 3354; você está a \d+ m\)/);
    assert.equal(sut.reads.length, 0);

    const near = sut.makePlayer("radovan", { x: suchdol.anchor.x + 10, y: suchdol.anchor.y, z: 100 });
    assert.match(sut.coaches.research(near, "suchdol"), /Lendo o chão ao redor da parada de Suchdol pelo seu jogo/);
    assert.match(sut.coaches.research(near, "suchdol"), /Uma leitura do chão já está em curso/);
    await settle();
    assert.equal(suchdol.place.by, "estrada");
    assert.ok(sut.told("radovan").some((line) => /Suchdol: carroça posta na beira da estrada/.test(line)), sut.told("radovan").join("\n"));
    assert.match(sut.coaches.research(near, "praga"), /Não há parada "praga"/);
});

test("the list says how each stop was placed", () => {
    const sut = load();
    sut.coaches.place();
    const lines = sut.coaches.lines();
    assert.ok(lines.some((line) => /suchdol \(Suchdol\): sem carroça; cocheiro acordado; esperando um jogador chegar perto para ler o chão$/.test(line)), lines.join("\n"));
    sut.coaches.stops.get("suchdol").place = { ...sut.coaches.stops.get("suchdol").place, cart: { x: 1, y: 2, z: 3, yaw: 90 }, by: "estrada" };
    assert.ok(sut.coaches.lines().some((line) => /suchdol \(Suchdol\): carroça em x 1, y 2, giro 90°.*; posta na beira da estrada, lida pelo jogo$/.test(line)));
});
