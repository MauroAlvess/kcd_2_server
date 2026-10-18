const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const MONEY = "5ef63059-322e-4e1b-abe8-926e100c770e";

function fakeDisk(seed = {}) {
    const files = new Map(Object.entries(seed));
    return {
        files,
        fs: {
            readFileSync(file) {
                if (!files.has(file)) throw new Error("ENOENT");
                return files.get(file);
            },
            writeFileSync(file, data) { files.set(file, data); },
            mkdirSync() {},
            renameSync(from, to) { files.set(to, files.get(from)); files.delete(from); },
            existsSync: (file) => files.has(file),
        },
    };
}

class Vector3 {
    constructor(x, y, z) { this.x = x; this.y = y; this.z = z; }
}

function load({ seed = {}, camps = [], navigation = true } = {}) {
    const disk = fakeDisk(seed);
    const storeSandbox = { exports: {}, require: () => disk.fs };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/store.js"), "utf8"), storeSandbox);

    const state = { now: 1_000_000, rolls: [], areas: [], sessions: new Map(), nextSession: 1, trading: new Set(), dice: new Set(), navigation, nextNpc: 500 };
    const players = [];
    const npcs = new Map();
    const chat = [];
    const notices = [];
    const logs = [];
    const dressed = [];
    const handlers = new Map();
    const inventories = new Map();
    const timers = [];

    const inventory = (holder) => {
        if (!inventories.has(holder)) inventories.set(holder, []);
        return inventories.get(holder);
    };
    const money = (holder) => inventory(holder).filter((row) => row.item === MONEY).reduce((sum, row) => sum + row.amount, 0);
    let nextRow = 1;

    const moneySandbox = {
        exports: {},
        Inventory: {
            get: (holder) => ({ items: inventory(holder).map((row) => ({ ...row })) }),
            remove: (holder, request) => {
                const rows = inventory(holder);
                for (const unit of request.units) {
                    const row = rows.find((candidate) => candidate.id === unit.id);
                    if (!row || row.amount < unit.amount) return { ok: false, code: "missing" };
                }
                for (const unit of request.units) {
                    const row = rows.find((candidate) => candidate.id === unit.id);
                    row.amount -= unit.amount;
                }
                inventories.set(holder, rows.filter((row) => row.amount > 0));
                return { ok: true, code: "" };
            },
            add: (holder, request) => {
                assert.equal(request.item, "money");
                inventory(holder).push({ id: nextRow++, item: MONEY, name: "money", amount: request.amount });
                return { ok: true, code: "" };
            },
        },
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/money.js"), "utf8"), moneySandbox);

    const makeNpc = (options) => {
        const npc = {
            id: state.nextNpc++,
            options,
            position: { ...options.position },
            alive: true,
            status: "running",
            orders: [],
            said: [],
            removed: false,
            follow(target, how) { this.orders.push(["follow", target.id, how.speed]); return true; },
            hold() { this.orders.push(["hold"]); },
            lookAt(target) { this.orders.push(["lookAt", target.id]); return true; },
            say(text) { this.said.push(text); return true; },
            attack(target) { this.orders.push(["attack", target.id]); return true; },
            flee(from) { this.orders.push(["flee"]); return true; },
            remove() { this.removed = true; npcs.delete(this.id); for (const fn of handlers.get("npcDestroy") ?? []) fn(this); },
        };
        npcs.set(npc.id, npc);
        return npc;
    };

    const context = {
        exports: {},
        require: (id) => {
            if (id === "./store.js") return storeSandbox.exports;
            if (id === "./money.js") return moneySandbox.exports;
            if (id === "./trade.js") return { trades: { isTrading: (player) => state.trading.has(player.id) } };
            if (id === "./bandits.js") {
                return {
                    banditSettings: { health: 180, damageMultiplier: 1.6 },
                    banditCamps: { camps, souls: () => ["soul-a", "soul-b"], dress: (npc, archer) => dressed.push({ id: npc.id, archer }) },
                };
            }
            if (id === "./place.js") {
                return {
                    distanceBetween: (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z),
                    // Every player faces +Y in these tests.
                    groundForward: () => new Vector3(0, 1, 0),
                    yawTowards: (x, y) => ({ yaw: [x, y] }),
                };
            }
            assert.fail(`unexpected require ${id}`);
        },
        console: { log: (line) => logs.push(line) },
        Date,
        Math,
        Promise,
        Vector3,
        setInterval: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
        clearInterval() {},
        Chat: { sendToPlayer: (player, text) => chat.push({ to: player.nickname, text }) },
        Player: { all: () => players, getById: (id) => players.find((player) => player.id === id) ?? null },
        Npc: { create: (options) => makeNpc(options), getById: (id) => npcs.get(id) ?? null },
        Navigation: {
            get ready() { return state.navigation; },
            closestPoint: (point) => (state.navigation ? new Vector3(point.x, point.y, point.z) : null),
        },
        Area: { nearby: (position, radius) => state.areas.filter((area) => Math.hypot(area.x - position.x, area.y - position.y) <= radius) },
        Dice: { matchOf: (id) => (state.dice.has(id) ? 1 : 0) },
        Dialogue: {
            sessionOf: (id) => [...state.sessions].find(([, entry]) => entry.player === id)?.[0] ?? 0,
            open: (id, page) => { const session = state.nextSession++; state.sessions.set(session, { player: id, page }); return session; },
            close: (session) => {
                const entry = state.sessions.get(session);
                state.sessions.delete(session);
                if (entry) for (const fn of handlers.get("dialogueClosed") ?? []) fn(session, players.find((p) => p.id === entry.player), 0);
            },
        },
        Events: { on: (name, fn) => handlers.set(name, [...(handlers.get(name) ?? []), fn]) },
        World: { resolveGround: async () => ({ answered: true, hit: { surface: "mat_road" } }) },
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/ambush.js"), "utf8"), context);

    const roll = () => (state.rolls.length > 0 ? state.rolls.shift() : 0.5);
    const surface = { value: "mat_road" };
    const make = (probe = async () => surface.value) => {
        const sut = new context.exports.Ambushes(context.exports.ambushSettings, () => state.now, roll, probe);
        return sut;
    };
    let nextPlayer = 1;
    const player = (nickname, coins = 0, at = { x: 0, y: 0, z: 0 }) => {
        const made = { id: nextPlayer++, nickname, ready: true, alive: true, virtualWorld: 0, position: { ...at }, rotation: {}, emit: (name, payload) => notices.push({ to: nickname, name, text: JSON.parse(payload).text }) };
        if (coins > 0) inventory(made).push({ id: nextRow++, item: MONEY, name: "money", amount: coins * 10 });
        players.push(made);
        return made;
    };
    const page = (victim) => [...state.sessions.values()].find((entry) => entry.player === victim.id)?.page ?? null;
    const sessionOf = (victim) => context.Dialogue.sessionOf(victim.id);
    return { api: context.exports, state, players, npcs, chat, notices, logs, dressed, handlers, timers, disk, money, inventory, make, player, page, sessionOf, surface, context };
}

/** A gang sent at `victim`, walked up to them, demanding. */
function demanding(sut, ambushes, victim) {
    assert.equal(ambushes.start(victim), true);
    const gang = [...sut.npcs.values()];
    for (const npc of gang) npc.position = { x: victim.position.x, y: victim.position.y - 5, z: 0 };
    ambushes.tick();
    return gang;
}

test("they ask for a share of the purse, in whole coins, between ten and two hundred", () => {
    const sut = load();
    const ambushes = sut.make();
    assert.equal(ambushes.demandFor(1000), 300, "30 of 100 coins");
    assert.equal(ambushes.demandFor(155), 100, "never less than 10 coins");
    assert.equal(ambushes.demandFor(0), 100);
    assert.equal(ambushes.demandFor(99_990), 2000, "never more than 200");
    assert.equal(ambushes.demandFor(1234) % 10, 0);
});

test("only a traveller between villages may be stopped", () => {
    const sut = load({ camps: [{ center: { x: 1000, y: 0, z: 0 } }] });
    const ambushes = sut.make();
    const hans = sut.player("Hans", 50);
    assert.equal(ambushes.reasonNotTo(hans, 100), "");
    assert.equal(ambushes.reasonNotTo(hans, 10), "parado");
    ambushes.arrived(hans);
    assert.equal(ambushes.reasonNotTo(hans, 100), "ainda não", "a newcomer is left alone a while");
    sut.state.now += 15 * 60_000;
    assert.equal(ambushes.reasonNotTo(hans, 100), "");

    sut.state.trading.add(hans.id);
    assert.equal(ambushes.reasonNotTo(hans, 100), "ocupado");
    sut.state.trading.clear();
    sut.state.dice.add(hans.id);
    assert.equal(ambushes.reasonNotTo(hans, 100), "ocupado");
    sut.state.dice.clear();

    sut.state.areas = [{ x: 60, y: 0, location: "Suchdol", labels: [] }];
    assert.equal(ambushes.reasonNotTo(hans, 100), "perto de um povoado");
    sut.state.areas = [{ x: 20, y: 0, location: "", labels: ["private"] }];
    assert.equal(ambushes.reasonNotTo(hans, 100), "entre casas");
    sut.state.areas = [];
    hans.position = { x: 900, y: 0, z: 0 };
    assert.equal(ambushes.reasonNotTo(hans, 100), "perto de um acampamento", "the camps have bandits of their own");
    hans.position = { x: 0, y: 0, z: 0 };
    hans.virtualWorld = 3;
    assert.equal(ambushes.reasonNotTo(hans, 100), "fora do mundo");
});

test("a gang comes from behind the player, dressed as the camps' bandits, and runs at them", () => {
    const sut = load();
    const ambushes = sut.make();
    const hans = sut.player("Hans", 50);
    sut.state.rolls = [0.99]; // three of them
    assert.equal(ambushes.start(hans), true);
    const gang = [...sut.npcs.values()];
    assert.equal(gang.length, 3);
    for (const npc of gang) {
        assert.ok(npc.position.y < -20, "behind: the player faces +Y");
        assert.equal(npc.options.nametag, false);
        assert.equal(npc.options.lootable, true);
        assert.equal(npc.options.health, 180);
        assert.ok(["soul-a", "soul-b"].includes(npc.options.soul));
        assert.deepEqual(npc.orders[0], ["follow", hans.id, "run"]);
    }
    assert.deepEqual(sut.dressed.map((entry) => entry.archer), [false, false, false]);
    assert.equal(ambushes.status().active, 1);
    assert.equal(ambushes.reasonNotTo(hans, 100), "ainda não", "nobody twice in half an hour");

    const nowhere = load({ navigation: false });
    assert.equal(nowhere.make().start(nowhere.player("Ondra")), false);
});

test("the leader makes his demand on the game's list; paid, the coins go to his pocket and the gang goes", () => {
    const sut = load();
    const ambushes = sut.make();
    const hans = sut.player("Hans", 100);
    const gang = demanding(sut, ambushes, hans);
    const leader = gang[0];
    assert.deepEqual(leader.said, ["A bolsa ou a vida!"]);
    assert.ok(gang.every((npc) => npc.orders.some((order) => order[0] === "hold")));

    ambushes.tick();
    const options = Array.from(sut.page(hans).options, (option) => ({ ...option }));
    assert.deepEqual(options.map((option) => [option.id, option.enabled]), [["info:who", false], ["info:ask", false], ["pay", true], ["fight", true]]);
    assert.match(options[1].text, /A bolsa ou a vida! Passa 30 moedas/);

    ambushes.choose(sut.sessionOf(hans), hans, "pay");
    assert.equal(sut.money(hans), 700, "70 coins left of 100");
    assert.equal(sut.money(leader), 300, "and the 30 are on him");
    assert.equal(sut.sessionOf(hans), 0, "the list is closed");
    assert.ok(sut.chat.some((line) => /levaram 30 moedas/.test(line.text)));
    assert.ok(gang.every((npc) => npc.orders.at(-1)[0] === "flee"));

    // Nobody near: they are taken off.
    hans.position = { x: 500, y: 500, z: 0 };
    ambushes.tick();
    assert.ok(gang.every((npc) => npc.removed));
    assert.equal(ambushes.status().active, 0);
});

test("refused, they attack the victim; somebody who strikes one of them is fought by that one", () => {
    const sut = load();
    const ambushes = sut.make();
    const hans = sut.player("Hans", 100);
    const jan = sut.player("Jan", 0, { x: 3, y: 0, z: 0 });
    const gang = demanding(sut, ambushes, hans);
    ambushes.tick();
    ambushes.choose(sut.sessionOf(hans), hans, "fight");
    assert.ok(sut.chat.some((line) => /recusou a pagar/.test(line.text)));
    ambushes.tick();
    assert.ok(gang.every((npc) => npc.orders.at(-1)[0] === "attack" && npc.orders.at(-1)[1] === hans.id));
    assert.equal(sut.money(hans), 1000, "nothing taken");

    ambushes.hit(gang[1].id, jan);
    ambushes.tick();
    assert.deepEqual(gang[1].orders.at(-1), ["attack", jan.id]);
});

test("Esc, or no answer in time, is a refusal", () => {
    const sut = load();
    const ambushes = sut.make();
    const hans = sut.player("Hans", 100);
    demanding(sut, ambushes, hans);
    ambushes.tick();
    ambushes.closed(sut.sessionOf(hans), 1);
    assert.ok(sut.chat.some((line) => /Sem resposta/.test(line.text)));

    const other = load();
    const theirs = other.make();
    const jan = other.player("Jan", 100);
    const gang = demanding(other, theirs, jan);
    theirs.tick();
    other.state.now += 25_000;
    theirs.tick();
    assert.equal(other.sessionOf(jan), 0);
    theirs.tick();
    assert.ok(gang.every((npc) => npc.orders.at(-1)[0] === "attack"));
});

test("a thin purse can be handed over whole; an empty one is let go, or pays in blood", () => {
    const sut = load();
    const ambushes = sut.make();
    const hans = sut.player("Hans", 6);
    const gang = demanding(sut, ambushes, hans);
    ambushes.tick();
    const options = Array.from(sut.page(hans).options, (option) => option.id);
    assert.deepEqual(options, ["info:who", "info:ask", "all", "fight"]);
    ambushes.choose(sut.sessionOf(hans), hans, "all");
    assert.equal(sut.money(hans), 0);
    assert.equal(sut.money(gang[0]), 60);
    assert.deepEqual(gang[0].said.at(-1), "Só isso? Some daqui!");

    for (const [mercy, expected] of [[0.1, "flee"], [0.9, "attack"]]) {
        const other = load();
        const theirs = other.make();
        const broke = other.player("Ondra", 0);
        const crew = demanding(other, theirs, broke);
        theirs.tick();
        assert.deepEqual(Array.from(other.page(broke).options, (option) => option.id), ["info:who", "info:ask", "broke", "fight"]);
        other.state.rolls = [mercy];
        theirs.choose(other.sessionOf(broke), broke, "broke");
        theirs.tick();
        assert.equal(crew[0].orders.at(-1)[0], expected);
    }
});

test("money that is gone by the time of paying is a refusal", () => {
    const sut = load();
    const ambushes = sut.make();
    const hans = sut.player("Hans", 100);
    demanding(sut, ambushes, hans);
    ambushes.tick();
    sut.inventory(hans).length = 0;
    ambushes.choose(sut.sessionOf(hans), hans, "pay");
    assert.ok(sut.chat.some((line) => /não estava lá/.test(line.text)));
});

test("a victim who gets away is let go, and a gang that cannot catch up gives up", () => {
    const sut = load();
    const ambushes = sut.make();
    const hans = sut.player("Hans", 100);
    const gang = demanding(sut, ambushes, hans);
    ambushes.tick();
    ambushes.choose(sut.sessionOf(hans), hans, "fight");
    ambushes.tick();
    hans.position = { x: 0, y: 300, z: 0 };
    ambushes.tick();
    sut.state.now += 30_000;
    ambushes.tick();
    assert.ok(sut.chat.some((line) => /despistou/.test(line.text)));
    assert.ok(gang.every((npc) => npc.orders.at(-1)[0] === "flee"));

    const other = load();
    const theirs = other.make();
    const rider = other.player("Jan", 100);
    theirs.start(rider);
    other.state.now += 75_000;
    theirs.tick();
    assert.equal(theirs.status().active, 1, "leaving, still on the road");
    rider.position = { x: 5000, y: 0, z: 0 };
    theirs.tick();
    assert.equal(theirs.status().active, 0);
});

test("the beaten lie for ten minutes for their pockets, then go when nobody is near", () => {
    const sut = load();
    const ambushes = sut.make();
    const hans = sut.player("Hans", 100);
    const gang = demanding(sut, ambushes, hans);
    ambushes.tick();
    ambushes.choose(sut.sessionOf(hans), hans, "fight");
    for (const npc of gang) {
        npc.alive = false;
        ambushes.died(npc.id);
    }
    ambushes.tick();
    assert.ok(sut.chat.some((line) => /Os salteadores caíram/.test(line.text)));
    assert.equal(ambushes.status().active, 0, "bodies do not hold the roads");
    sut.state.now += 10 * 60_000;
    ambushes.tick();
    assert.ok(gang.every((npc) => !npc.removed), "not while the victim stands over them");
    hans.position = { x: 400, y: 0, z: 0 };
    ambushes.tick();
    assert.ok(gang.every((npc) => npc.removed));
});

test("on a road the chance is the full one; off it, a quarter; and only one gang starts per look", async () => {
    const sut = load();
    const ambushes = sut.make();
    const hans = sut.player("Hans", 100);
    ambushes.look(); // where everybody is
    hans.position = { x: 0, y: 100, z: 0 };
    sut.state.rolls = [0, 0.07];
    ambushes.look();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(ambushes.status().started, 1);
    assert.deepEqual(JSON.parse(JSON.stringify(ambushes.status().surfaces)), [["mat_road", 1]]);

    const off = load();
    const theirs = off.make();
    const jan = off.player("Jan", 100);
    off.surface.value = "mat_grass";
    theirs.look();
    jan.position = { x: 0, y: 100, z: 0 };
    off.state.rolls = [0, 0.07, 0.5];
    theirs.look();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(theirs.status().started, 0, "0.5 is over a quarter");
    jan.position = { x: 0, y: 200, z: 0 };
    off.state.rolls = [0, 0.07, 0.2];
    theirs.look();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(theirs.status().started, 1);
});

test("every traveller has the chance of their own: with several on the road, the one who rolled low is the one stopped", async () => {
    const sut = load();
    const ambushes = sut.make();
    const hans = sut.player("Hans", 100);
    const jan = sut.player("Jan", 100);
    const ota = sut.player("Ota", 100);
    ambushes.look(); // where everybody is
    for (const [index, body] of [hans, jan, ota].entries()) body.position = { x: 0, y: 100 + index * 5, z: 0 };
    // Hans and Jan roll over the chance (0.2); Ota rolls under it; then the pick among those who rolled under.
    sut.state.rolls = [0.9, 0.9, 0.05, 0];
    ambushes.look();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(ambushes.status().started, 1);
    const gang = [...sut.npcs.values()];
    assert.ok(gang.length >= 2);
    assert.deepEqual(gang[0].orders[0].slice(0, 2), ["follow", ota.id], "it was Ota, who got the chance, that they ran at");
});

test("switched off, no gang starts and those on the road go; the choice is kept", () => {
    const sut = load();
    const ambushes = sut.make();
    const hans = sut.player("Hans", 100);
    const gang = demanding(sut, ambushes, hans);
    ambushes.setEnabled(false);
    assert.ok(gang.every((npc) => npc.orders.at(-1)[0] === "flee"));
    assert.deepEqual(JSON.parse(sut.disk.files.get("playerdata/ambush.json")), { enabled: false });
    const again = load({ seed: { "playerdata/ambush.json": JSON.stringify({ enabled: false }) } });
    const theirs = again.make();
    theirs.load();
    assert.equal(theirs.enabled, false);
});

test("their blows weigh what the camps' bandits' do, and nobody else's change", () => {
    const sut = load();
    sut.api.installAmbushes();
    const hans = sut.player("Hans", 100);
    sut.api.ambushes.start(hans);
    const bandit = [...sut.npcs.values()][0];
    const hit = { damage: 10 };
    for (const fn of sut.handlers.get("playerHit")) fn(hans, bandit, hit);
    assert.equal(hit.damage, 16);
    const other = { damage: 10 };
    for (const fn of sut.handlers.get("playerHit")) fn(hans, { id: 99999 }, other);
    assert.equal(other.damage, 10);
    assert.ok(sut.logs.some((line) => /salteadores nas estradas ligados/.test(line)));
});
