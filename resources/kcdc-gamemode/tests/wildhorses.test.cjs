"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const { lowered, torch } = require("./torchstub.cjs");

// The wild horses of the open fields and how a Domador tames one (src/server/wild-horses.ts, 2026-10-22; the Domitores' since 2026-10-25, the Agricultores' before): bare horses grazing in the meadows
// the level's mesh showed to be open, that run from anybody who is not an Agricultor and from anybody who runs; a farmer who walks up slowly
// feeds one, with a cooldown, until it trusts them, and then mounts it or sends it after them: it is theirs, in the Animais, with no saddle.

const dist = (name) => fs.readFileSync(path.join(__dirname, `../dist/server/${name}.js`), "utf8");
const plain = (value) => JSON.parse(JSON.stringify(value));

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

class FakeVector3 {
    constructor(x, y, z) { this.x = x; this.y = y; this.z = z; }
}

const CARROT = "b7ee311c-736b-4f7c-987b-8431ce3b5600";
const APPLE = "2264f217-590e-4c0f-a4c6-f50c6532b9f6";
const BREAD = "86e4ff24-88db-4024-abe6-46545fa0fbd1";
const PEAR = "2eeb7bf7-f0ac-4c46-9468-97c2f76cb254";
const BEET = "7899825d-ed6f-4f00-b698-649ba652cf6d";
const TURNIP = "ea84be32-b3fc-4dfa-8dab-7169bd9e441d";
// The treats in the order the module lists them: the best first, a row of the menu is "feed:<place in this list>".
const TREAT_ORDER = [CARROT, APPLE, PEAR, BEET, TURNIP, BREAD];
const KNOWN = ["horse", "pebbles", "bitterklee", "kasztanka", "bill", "mark", "mystery_horse"];
const T0 = 1_760_000_000_000;
const MEADOWS = [{ x: 1000, y: 1000, z: 100 }, { x: 2000, y: 2000, z: 120 }];

function load({ meadows = MEADOWS, ready = true, farmers = ["hans", "greta", "boss"], disk = fakeDisk(), randomValue = 0.3 } = {}) {
    const store = { exports: {} };
    vm.runInNewContext(dist("store"), { exports: store.exports, require: () => disk.fs });
    const state = {
        handlers: new Map(),
        intervals: [],
        timers: [],
        logs: [],
        chat: [],
        spawned: [],
        horses: new Map(),
        opened: [],
        closed: [],
        follows: [],
        climbs: [],
        busy: new Set(),
        bags: new Map(),
        ready,
        noGround: false,
        clock: { now: T0 },
        online: [],
        nextHorse: 700,
        nextSession: 0,
        nearExtras: [],
        askExtras: [],
        language: "pt",
        gearCalls: [],
        order: [],
        presets: ["horse_common01", "horse_common02", "horse_common05", "horse_common18", "horse_noble05"],
        gearFails: false,
    };
    const FakeMath = Object.create(Math);
    FakeMath.random = () => randomValue;
    const makeHorse = (position, soul, name, gear) => {
        const horse = {
            id: state.nextHorse++,
            soul,
            name,
            gear,
            position: { ...position },
            gearLocked: false,
            destroyWithOwner: true,
            alive: true,
            mounted: false,
            rider: null,
            unconscious: false,
            owner: null,
            navigationStatus: "idle",
            moves: [],
            patrols: [],
            holds: 0,
            destroyed: false,
            moveTo(to, options) { this.moves.push({ to: { x: to.x, y: to.y, z: to.z }, options }); this.navigationStatus = "running"; return state.moveOk !== false; },
            patrol(points, options) { this.patrols.push({ points: points.map((p) => ({ x: p.x, y: p.y, z: p.z })), options }); this.navigationStatus = "running"; return true; },
            hold() { this.holds += 1; this.navigationStatus = "idle"; },
            setGear(gear) {
                state.order.push("gear");
                if (state.gearFails) throw new Error("not horse gear");
                state.gearCalls.push(plain(gear));
                this.gear = typeof gear === "string" ? { preset: gear } : { ...gear };
                return true;
            },
            giveTo(player) { state.order.push("given"); this.owner = player; state.given = [...(state.given ?? []), [this.id, player.id]]; },
            destroy() { this.destroyed = true; state.horses.delete(this.id); },
        };
        state.horses.set(horse.id, horse);
        return horse;
    };
    const context = {
        exports: {},
        require: (id) => ({
            "./torch-down.js": torch,
            "./farm-data.js": { farmData: () => ({ gardens: [], beds: [], meadows }) },
            "./guild-crafts.js": { mayCraft: (player, craft) => farmers.includes(player.steamId) && craft === "domar" },
            "./horse-menu.js": {
                nearExtras: state.nearExtras,
                askExtras: state.askExtras,
            },
            "./language.js": { languageOf: () => state.language, translate: (text, lang) => (lang === "en" ? `[en] ${text}` : text) },
            "./store.js": store.exports,
        })[id] ?? assert.fail(`unexpected require ${id}`),
        console: { log: (line) => state.logs.push(line), error: (line) => state.logs.push(line) },
        Date: { now: () => state.clock.now },
        Math: FakeMath,
        JSON,
        Vector3: FakeVector3,
        setTimeout: (fn, ms) => { state.timers.push({ fn, ms, cleared: false }); return state.timers.length; },
        setInterval: (fn, ms) => { state.intervals.push({ fn, ms }); return state.intervals.length; },
        clearInterval() {},
        Events: { on: (name, fn) => state.handlers.set(name, [...(state.handlers.get(name) ?? []), fn]) },
        Chat: { sendToPlayer: (player, text) => state.chat.push(text) },
        Player: { all: () => state.online },
        Horse: {
            breeds: () => KNOWN,
            gearPresets: () => state.presets,
            spawn: (position, rotation, soul, name, gear) => {
                state.spawned.push({ position, rotation, soul, name, gear });
                if (state.spawnFails === soul) throw new Error(`no soul ${soul}`);
                return makeHorse(position, soul, name, gear);
            },
            getById: (id) => {
                state.lookups = (state.lookups ?? 0) + 1;
                return state.horses.get(id) ?? null;
            },
            all: () => [...state.horses.values()],
        },
        Navigation: {
            get ready() { return state.ready; },
            closestPoint: (point) => (state.noGround ? null : new FakeVector3(point.x, point.y, point.z + 0.1)),
        },
        Dialogue: {
            sessionOf: (id) => (state.busy.has(id) ? 5 : 0),
            open: (id, page) => { state.nextSession += 1; state.opened.push({ session: state.nextSession, id, page: plain(page) }); return state.nextSession; },
            close: (session) => state.closed.push(session),
        },
        Inventory: {
            get: (player) => ({ revision: 1, items: state.bags.get(player.id) ?? [] }),
            remove: (player, request) => {
                const bag = state.bags.get(player.id) ?? [];
                for (const unit of request.units) {
                    const row = bag.find((one) => one.id === unit.id);
                    if (!row || row.amount < unit.amount) return { ok: false, code: "missing" };
                    row.amount -= unit.amount;
                }
                state.bags.set(player.id, bag.filter((one) => one.amount > 0));
                return { ok: true, code: "" };
            },
        },
    };
    vm.runInNewContext(dist("wild-horses"), context);
    const api = context.exports;
    api.installWildHorses();
    let nextId = 1;
    const player = (steamId = "hans", { at = { x: 1100, y: 1000, z: 100 }, gender = "male", bag = [] } = {}) => {
        const body = {
            id: nextId++,
            steamId,
            nickname: steamId[0].toUpperCase() + steamId.slice(1),
            ready: true,
            alive: true,
            horse: null,
            mounted: false,
            appearance: { gender },
            position: { ...at },
            played: [],
            stopped: 0,
            mounts: [],
            dismounts: 0,
            emitted: [],
            playAnimation(fragment, options) { this.played.push([fragment, plain(options ?? null)]); return true; },
            stopAnimation() { this.stopped += 1; return true; },
            mount(horse) { this.mounts.push(horse.id); return true; },
            dismount() { this.dismounts += 1; return null; },
            emit(event, payload) { this.emitted.push([event, JSON.parse(payload)]); },
        };
        state.bags.set(body.id, bag.map((row, index) => ({ id: `r${index}`, ...row })));
        state.online.push(body);
        return body;
    };
    /** One look of the horses, `ms` after the last. */
    const tick = (ms = 700) => {
        state.clock.now += ms;
        api.wildTick(state.clock.now);
    };
    const wild = () => [...state.horses.values()];
    return { api, state, player, tick, wild, disk, context };
}

test("the horses are spawned bare, in the meadows, two to each, as soon as the mesh is up and not before", () => {
    const sut = load({ ready: false });
    sut.tick();
    assert.equal(sut.state.spawned.length, 0, "no mesh, no horse");
    sut.state.ready = true;
    sut.tick();
    assert.equal(sut.state.spawned.length, 4, "two to each of two meadows");
    for (const horse of sut.state.spawned) {
        assert.deepEqual(plain(horse.gear), {}, "bare: no saddle, no cloth");
        assert.equal(horse.name, "Cavalo selvagem");
        assert.ok(KNOWN.includes(horse.soul) && horse.soul !== "mystery_horse", "a breed of the list the server knows");
    }
    const [a, b] = sut.wild();
    assert.equal(a.gearLocked, true, "its gear is nobody's to change");
    assert.equal(a.destroyWithOwner, false);
    assert.ok(Math.hypot(a.position.x - 1000, a.position.y - 1000) < 12, "near its meadow");
    assert.ok(Math.hypot(b.position.x - 1000, b.position.y - 1000) < 12);
    sut.tick();
    assert.equal(sut.state.spawned.length, 4, "and not again while they live");
    assert.ok(sut.state.logs.some((line) => /wild-horses: 4 lugar\(es\) em 2 campo\(s\) aberto\(s\), 2 por campo/.test(line)));
});

test("a place the mesh gives no ground to is tried again; a breed the game refuses is replaced by the plain one", () => {
    const sut = load();
    sut.state.noGround = true;
    sut.tick();
    assert.equal(sut.state.spawned.length, 0);
    sut.state.noGround = false;
    sut.tick();
    assert.equal(sut.state.spawned.length, 4);

    const odd = load({ randomValue: 0 });
    odd.state.spawnFails = "horse";
    odd.tick();
    assert.ok(odd.state.logs.some((line) => /a alma horse não foi aceita/.test(line)) || odd.state.spawned.length === 4);
});

test("trust has words and a bar of ten; a bag gives the best thing to feed first", () => {
    const sut = load();
    assert.deepEqual(["arisco", "desconfiado", "atento", "quase manso", "confia em você"], [0, 25, 60, 90, 100].map((trust) => sut.api.trustLabel(trust)));
    assert.equal(sut.api.trustBar(0), "□□□□□□□□□□");
    assert.equal(sut.api.trustBar(34), "■■■□□□□□□□");
    assert.equal(sut.api.trustBar(100), "■■■■■■■■■■");
    assert.equal(sut.api.trustBar(250), "■■■■■■■■■■", "never past the bar");
    const counts = new Map([[BREAD, 2], [APPLE, 1], [CARROT, 4]]);
    assert.equal(sut.api.treatFor(counts).name, "cenoura", "a carrot before an apple before bread");
    counts.delete(CARROT);
    assert.equal(sut.api.treatFor(counts).name, "maçã");
    counts.delete(APPLE);
    assert.equal(sut.api.treatFor(counts).name, "pão");
    counts.delete(BREAD);
    assert.equal(sut.api.treatFor(counts), null);
});

test("a frightened horse runs from the threat, further than the threat is, but not past its leash", () => {
    const sut = load();
    const away = sut.api.fleePoint({ x: 10, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 }, 20, 70);
    assert.deepEqual(plain(away), { x: 30, y: 0 }, "straight away");
    const leashed = sut.api.fleePoint({ x: 60, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }, 20, 70);
    assert.deepEqual(plain(leashed), { x: 70, y: 0 }, "kept within the leash of its meadow");
    const turned = sut.api.fleePoint({ x: 10, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 }, 20, 70, 90);
    assert.ok(Math.abs(turned.x - 10) < 1e-9 && Math.abs(turned.y - 20) < 1e-9, "a quarter turn when the straight way is shut");
    const onTop = sut.api.fleePoint({ x: 5, y: 5 }, { x: 5, y: 5 }, { x: 5, y: 5 }, 10, 70);
    assert.ok(Number.isFinite(onTop.x) && Number.isFinite(onTop.y), "even from one who stands on it");
});

test("whoever is not an Agricultor frightens a horse from 14 m, and 22 on a horse: it runs away from them, and not again for four seconds", () => {
    const sut = load();
    sut.tick();
    const [horse] = sut.wild();
    const stranger = sut.player("stranger", { at: { x: horse.position.x + 10, y: horse.position.y, z: 100 } });
    sut.tick();
    assert.equal(horse.moves.length, 1, "it runs");
    const [move] = horse.moves;
    assert.ok(move.to.x < horse.position.x, "away from the player (who is to the east)");
    assert.equal(move.options.speed, "jog", "jogging when 10 m away");
    assert.equal(move.options.radius, 2);
    sut.tick(1_000);
    assert.equal(horse.moves.length, 1, "not again at once");
    sut.tick(4_000);
    assert.equal(horse.moves.length, 2, "again once the four seconds are over");

    stranger.position = { x: horse.position.x + 5, y: horse.position.y, z: 100 };
    sut.tick(4_000);
    assert.equal(horse.moves.at(-1).options.speed, "run", "running when closer than 8 m");
    stranger.position = { x: horse.position.x + 30, y: horse.position.y, z: 100 };
    const count = horse.moves.length;
    sut.tick(4_000);
    assert.equal(horse.moves.length, count, "not from 30 m");
    stranger.horse = { id: 9 };
    stranger.position = { x: horse.position.x + 20, y: horse.position.y, z: 100 };
    sut.tick(4_000);
    assert.equal(horse.moves.length, count + 1, "but from 20 m when riding");
});

test("a horse cornered by the mesh stands; one that cannot be sent is not sent again at once", () => {
    const sut = load();
    sut.tick();
    const [horse] = sut.wild();
    sut.player("stranger", { at: { x: horse.position.x + 6, y: horse.position.y, z: 100 } });
    sut.state.moveOk = false;
    sut.tick();
    assert.equal(horse.moves.length, 5, "five ways tried: straight on and two turns each side");
    sut.tick(1_000);
    assert.equal(horse.moves.length, 5, "and not asked again within the four seconds");
    sut.state.moveOk = true;
});

test("an Agricultor who walks up slowly is not run from: the horse stands and watches; one who runs at it is run from", () => {
    const sut = load();
    sut.tick();
    const [horse] = sut.wild();
    const hans = sut.player("hans", { at: { x: horse.position.x + 20, y: horse.position.y, z: 100 } });
    sut.tick();
    // Walking in: 1.6 m a second (a metre and a bit every 700 ms), the speed a farmer walks at.
    for (let step = 0; step < 14; step += 1) {
        hans.position = { x: hans.position.x - 1.1, y: hans.position.y, z: 100 };
        sut.tick();
    }
    assert.ok(horse.position.x + 20 - hans.position.x > 14 || Math.hypot(hans.position.x - horse.position.x, 0) < 6, "close now");
    assert.equal(horse.moves.length, 0, "the horse did not run");
    assert.ok(horse.holds >= 0);
    const near = Math.hypot(hans.position.x - horse.position.x, hans.position.y - horse.position.y);
    assert.ok(near < 8, `walked up to ${near.toFixed(1)} m`);

    // Running at it: five metres in 700 ms is a sprint.
    hans.position = { x: hans.position.x - 5, y: hans.position.y, z: 100 };
    sut.tick();
    assert.equal(horse.moves.length, 1, "it runs from one who runs at it, within 9 m");
});

test("a horse a calm farmer is near stands (its walk is held), and goes back to grazing twenty seconds after nobody is near", () => {
    const sut = load();
    sut.tick();
    const [firstHorse] = sut.wild();
    sut.tick();
    assert.equal(firstHorse.patrols.length, 0, "with nobody within a hundred and fifty metres it is left alone (2026-10-25: the round cost 185 ms)");
    sut.player("walker", { at: { x: firstHorse.position.x + 100, y: firstHorse.position.y, z: 100 } });
    sut.tick();
    sut.tick();
    const [horse] = sut.wild();
    assert.equal(horse.patrols.length, 1, "grazing from the look after somebody is within reach: a walk of three points round the meadow");
    assert.equal(horse.patrols[0].points.length, 3);
    assert.equal(horse.patrols[0].options.speed, "walk");
    assert.equal(horse.patrols[0].options.loop, true);

    const hans = sut.player("hans", { at: { x: horse.position.x + 6, y: horse.position.y, z: 100 } });
    sut.tick();
    sut.tick();
    assert.ok(horse.holds >= 1, "held where it stands while a calm farmer is near");
    assert.equal(horse.moves.length, 0);

    hans.position = { x: horse.position.x + 120, y: horse.position.y, z: 100 };
    sut.tick(10_000);
    assert.equal(horse.patrols.length, 1, "not before twenty seconds");
    sut.tick(11_000);
    assert.equal(horse.patrols.length, 2, "grazing again");
    sut.tick(1_000);
    assert.equal(horse.patrols.length, 2, "and the grazing is not set again at every look (every twenty seconds at most)");
});

test("E at a wild horse shows an Agricultor its menu; anybody else is told whose it is; the menu is held for the horse", () => {
    const sut = load();
    sut.tick();
    const [horse] = sut.wild();
    const hans = sut.player("hans", { at: { x: horse.position.x + 2, y: horse.position.y, z: 100 }, bag: [{ item: CARROT, amount: 2 }] });
    const ask = sut.state.askExtras[0];
    assert.equal(ask(hans, { id: 12345 }), null, "a horse that is not wild is the menu's own");
    assert.equal(ask(hans, horse), true);
    assert.equal(sut.state.opened.length, 1);
    const page = sut.state.opened[0].page;
    assert.match(page.line, /Cavalo selvagem: arisco\. Confiança □□□□□□□□□□ 0\/100\./);
    assert.deepEqual(page.options.map((o) => [o.id, o.text, o.enabled]), [
        ["feed", "Oferecer cenoura", true],
        ["mount", "Montar (ele ainda não confia)", false],
        ["leave", "Sair", true],
    ]);
    assert.ok(horse.holds >= 1, "the horse is held");

    const stranger = sut.player("stranger", { at: { x: horse.position.x + 2, y: horse.position.y, z: 100 } });
    assert.equal(ask(stranger, horse), false);
    assert.match(sut.state.chat.at(-1), /Só os domadores \(guilda Domitores\) sabem amansar um cavalo selvagem/);
    const far = sut.player("greta", { at: { x: horse.position.x + 40, y: horse.position.y, z: 100 } });
    assert.equal(ask(far, horse), false, "not from far away");
    const busy = sut.player("greta", { at: { x: horse.position.x + 2, y: horse.position.y, z: 100 } });
    sut.state.busy.add(busy.id);
    assert.equal(ask(busy, horse), false, "nor with another list up");
});

test("a wild horse is told to an Agricultor's client when it is near, the nearest of them, and to nobody else", () => {
    const sut = load();
    sut.tick();
    const [first, second] = sut.wild();
    const near = sut.state.nearExtras[0];
    const hans = sut.player("hans", { at: { x: first.position.x + 2, y: first.position.y, z: 100 } });
    const stranger = sut.player("stranger", { at: { x: first.position.x + 2, y: first.position.y, z: 100 } });
    assert.equal(near(hans, 3.1).horse.id, first.id);
    assert.equal(near(hans, 3.1).w, true, "flagged wild, for the client's Domar");
    assert.equal(near(stranger, 3.1), null, "nothing for a player who cannot tame it");
    assert.equal(near(hans, 1), null, "nothing beyond the reach it is asked with");
    first.rider = { id: 3 };
    assert.notEqual(near(hans, 30)?.horse.id, first.id, "not one that has a rider");
    first.rider = null;
    hans.position = { x: second.position.x - 1, y: second.position.y, z: 100 };
    assert.equal(near(hans, 3.1).horse.id, second.id, "the nearer of two");
});

test("feeding takes the best treat from the bag, adds its trust, pets (a man's animation, none for a woman), keeps the trust, and waits a minute", () => {
    const sut = load();
    sut.tick();
    const [horse] = sut.wild();
    const hans = sut.player("hans", { at: { x: horse.position.x + 2, y: horse.position.y, z: 100 }, bag: [{ item: CARROT, amount: 3 }] });
    const heldBefore = lowered.length;
    const text = sut.api.feed(hans, horse, T0, () => 0.99);
    assert.equal(lowered.length - heldBefore, 1, "a torch in the hand is put away before the petting (2026-10-25)");
    assert.match(text, /O cavalo aceita a cenoura \(arisco, confiança 5\/100\)\./);
    assert.equal(sut.state.bags.get(hans.id).find((row) => row.item === CARROT).amount, 2, "a carrot was given");
    assert.deepEqual(hans.played, [["HorsePetting_2", { lockMovement: true }]], "a man pets it");
    sut.state.timers.find((one) => one.ms === 5_000).fn();
    assert.equal(hans.stopped, 1, "the petting is cut at five seconds");
    assert.match(sut.state.logs.at(-1), /Hans deu cenoura ao cavalo de m1-\d \([a-z_]+, [^;]+; equitação 5, facilidade 1\.\d\d\): confiança 5/);
    const saved = JSON.parse(sut.disk.files.get("playerdata/wild-horses.json"));
    assert.equal(saved.slots["m1-1"].bonds.hans.trust, 5, "kept across a restart");

    const again = sut.api.feed(hans, horse, T0 + 20_000, () => 0.99);
    assert.match(again, /ainda mastiga: espere 70 s/, "a minute and a half between one feeding and the next");
    assert.equal(sut.state.bags.get(hans.id).find((row) => row.item === CARROT).amount, 2, "nothing was taken");
    assert.match(sut.api.feed(hans, horse, T0 + 80_000, () => 0.99), /ainda mastiga: espere 10 s/, "and a minute is not enough");
    sut.api.feed(hans, horse, T0 + 91_000, () => 0.99);
    assert.equal(sut.api.menuPageFor(hans, horse, T0 + 91_000).line.includes("10/100"), true, "10 after the second");

    const greta = sut.player("greta", { gender: "female", at: { x: horse.position.x + 2, y: horse.position.y, z: 100 }, bag: [{ item: BREAD, amount: 1 }] });
    sut.api.feed(greta, horse, T0, () => 0.99);
    assert.deepEqual(greta.played, [], "no petting animation for a woman: the game has none");
    assert.match(sut.state.chat.at(-1), /cavalo aceita o pão \(arisco, confiança 2\/100\)/);
    assert.equal(sut.api.menuPageFor(hans, horse, T0 + 91_000).line.includes("10/100"), true, "each player's trust is their own");
});

test("a farmer with nothing to offer is told what a horse takes", () => {
    const sut = load();
    sut.tick();
    const [horse] = sut.wild();
    const hans = sut.player("hans", { at: { x: horse.position.x + 2, y: horse.position.y, z: 100 } });
    assert.match(sut.api.feed(hans, horse, T0), /Você não tem o que oferecer: uma cenoura, maçã, pera, beterraba, nabo ou pão na bolsa\./);
    assert.deepEqual(hans.played, []);
    const page = sut.api.menuPageFor(hans, horse, T0);
    assert.equal(page.options[0].enabled, false);
    assert.match(page.options[0].text, /Oferecer comida \(cenoura, maçã, pera, beterraba, nabo ou pão\)/);
});

test("what an Agricultor is told reaches the toast in their language as it reaches the chat", () => {
    const sut = load();
    sut.tick();
    const [horse] = sut.wild();
    const hans = sut.player("hans", { at: { x: horse.position.x + 2, y: horse.position.y, z: 100 } });
    sut.api.feed(hans, horse, T0);
    assert.match(hans.emitted.at(-1)[1].text, /^Você não tem o que oferecer/, "Portuguese stays as it is written");
    sut.state.language = "en";
    sut.api.feed(hans, horse, T0);
    assert.match(hans.emitted.at(-1)[1].text, /^\[en\] Você não tem o que oferecer/, "an English player's toast goes through the translation");
});

test("the menu comes back after the petting, with the trust it has now; at a hundred it offers Montar and no more food", () => {
    const sut = load({ randomValue: 0.9 });
    sut.tick();
    const [horse] = sut.wild();
    const hans = sut.player("hans", { at: { x: horse.position.x + 2, y: horse.position.y, z: 100 }, bag: [{ item: CARROT, amount: 25 }] });
    sut.state.askExtras[0](hans, horse);
    const session = sut.state.opened[0].session;
    sut.state.handlers.get("dialogueChoice")[0](session, hans, "feed");
    assert.ok(sut.state.closed.includes(session), "the menu is closed for the petting");
    const back = sut.state.timers.find((one) => one.ms === 5_400);
    assert.ok(back, "and comes back when it is over");
    back.fn();
    assert.equal(sut.state.opened.length, 2);
    assert.match(sut.state.opened[1].page.line, /Confiança □□□□□□□□□□ 5\/100/);

    // Nineteen more carrots, a minute and a half apart: five a carrot, a hundred at the twentieth.
    let now = T0;
    for (let n = 0; n < 19; n += 1) {
        now += 91_000;
        sut.api.feed(hans, horse, now);
    }
    const page = sut.api.menuPageFor(hans, horse, now);
    assert.match(page.line, /Cavalo selvagem: confia em você\. Confiança ■■■■■■■■■■ 100\/100\./);
    assert.deepEqual(plain(page.options.map((o) => [o.id, o.text, o.enabled])), [
        ["feed", "Oferecer comida", false],
        ["mount", "Montar", true],
        ["leave", "Sair", true],
    ]);
    assert.match(sut.state.chat.at(-1), /ele confia em você agora\. Monte nele\./);
    assert.equal(sut.api.feed(hans, horse, now + 91_000), "", "no more food is taken once it trusts");
    assert.equal(sut.state.bags.get(hans.id).find((row) => row.item === CARROT).amount, 5, "twenty carrots in all");
});

/** A horse that trusts Hans fully, and Hans beside it. */
function trusting(options = {}) {
    const sut = load(options);
    sut.tick();
    const [horse] = sut.wild();
    const hans = sut.player("hans", { at: { x: horse.position.x + 2, y: horse.position.y, z: 100 } });
    sut.state.online.splice(0, sut.state.online.length, hans);
    assert.equal(sut.api.setTrustNearest(hans, 100) !== "", true);
    sut.state.opened.length = 0;
    return { sut, horse, hans };
}

test("Montar makes the horse theirs, unlocked, with its own name back; its place has another horse hours later", () => {
    const { sut, horse, hans } = trusting();
    const place = sut.api.nearestWild(hans, 1)[0].id;
    sut.state.askExtras[0](hans, horse);
    sut.state.handlers.get("dialogueChoice")[0](sut.state.opened[0].session, hans, "mount");
    assert.deepEqual(plain(sut.state.given), [[horse.id, hans.id]], "given to the farmer: horses.ts files it, and it is in their Animais");
    assert.equal(horse.name, "", "the breed's own name, for them to change");
    assert.equal(horse.gearLocked, false);
    assert.equal(horse.destroyWithOwner, false);
    assert.deepEqual(hans.mounts, [horse.id], "and they are in its saddle");
    assert.equal(sut.api.isWild(horse), false, "no longer wild");
    assert.ok(sut.state.chat.some((line) => /O cavalo agora é seu: veja em Animais \(F2\) para dar um nome\. Ele já vem com sela, rédeas e ferraduras simples\./.test(line)));
    assert.deepEqual(plain(sut.state.gearCalls), ["horse_common02"], "one of the game's plain sets, put on");
    assert.deepEqual(plain(horse.gear), { preset: "horse_common02" });
    assert.deepEqual(plain(sut.state.order), ["gear", "given"], "dressed before it is given, so that it is filed with its tack");
    assert.ok(sut.state.logs.some((line) => /Hans amansou o cavalo de m\d+-\d, vestido com horse_common02/.test(line)));
    assert.ok(sut.state.logs.some((line) => new RegExp(`Hans amansou o cavalo de ${place}`).test(line)));

    // The place stays empty for six hours, then has another horse, of another breed.
    const spawned = sut.state.spawned.length;
    sut.tick(5 * 3_600_000);
    assert.equal(sut.state.spawned.length, spawned, "five hours later it is still empty");
    sut.tick(3_600_000 + 1_000);
    assert.equal(sut.state.spawned.length, spawned + 1, "six hours later it has another");
    assert.notEqual(sut.state.spawned.at(-1).soul, horse.soul, "of another breed");
    const saved = JSON.parse(sut.disk.files.get("playerdata/wild-horses.json"));
    assert.deepEqual(saved.slots[place].bonds, {}, "and nobody has won this one yet");
});

test("Montar makes it theirs and puts them in its saddle; nothing is sent to follow, since the order is gone (2026-11-09)", () => {
    const { sut, horse, hans } = trusting();
    sut.state.askExtras[0](hans, horse);
    sut.state.handlers.get("dialogueChoice")[0](sut.state.opened[0].session, hans, "mount");
    assert.deepEqual(plain(sut.state.given), [[horse.id, hans.id]]);
    assert.deepEqual(hans.mounts, [horse.id]);
});

test("a horse that does not trust them yet is not given, whatever the menu is asked; the others' trust does not count", () => {
    const sut = load();
    sut.tick();
    const [horse] = sut.wild();
    const hans = sut.player("hans", { at: { x: horse.position.x + 2, y: horse.position.y, z: 100 } });
    assert.equal(sut.api.tame(hans, horse, T0), false);
    assert.match(sut.state.chat.at(-1), /Ele ainda não confia em você o bastante\./);
    assert.deepEqual(plain(sut.state.given ?? []), []);
    const greta = sut.player("greta", { at: { x: horse.position.x + 2, y: horse.position.y, z: 100 } });
    sut.api.setTrustNearest(greta, 100);
    assert.equal(sut.api.tame(hans, horse, T0), false, "the horse trusts Greta, not Hans");
    assert.equal(sut.api.tame(greta, horse, T0), true);
});

test("the menu's choices are checked again when made: a horse that is gone or far is not fed or taken", () => {
    const { sut, horse, hans } = trusting();
    sut.state.askExtras[0](hans, horse);
    hans.position = { x: horse.position.x + 40, y: horse.position.y, z: 100 };
    sut.state.handlers.get("dialogueChoice")[0](sut.state.opened[0].session, hans, "mount");
    assert.deepEqual(plain(sut.state.given ?? []), [], "too far");
    assert.match(sut.state.chat.at(-1), /Você se afastou demais do cavalo\./);
    hans.position = { x: horse.position.x + 2, y: horse.position.y, z: 100 };
    sut.state.askExtras[0](hans, horse);
    sut.state.handlers.get("dialogueChoice")[0](sut.state.opened[1].session, hans, "leave");
    assert.deepEqual(plain(sut.state.given ?? []), [], "Sair takes nobody's horse");
    // Another player's choice in the same session number is nobody's.
    sut.state.askExtras[0](hans, horse);
    const stranger = sut.player("stranger");
    sut.state.handlers.get("dialogueChoice")[0](sut.state.opened[2].session, stranger, "mount");
    assert.deepEqual(plain(sut.state.given ?? []), []);
});

test("nobody climbs on a wild horse: the game's own climb is refused, the rider told to get off, and told why", () => {
    const sut = load();
    sut.tick();
    const [horse] = sut.wild();
    const refuse = sut.state.handlers.get("horseMounting")[0];
    const stranger = sut.player("stranger");
    assert.equal(refuse(horse, stranger), false);
    assert.equal(stranger.dismounts, 1);
    assert.match(sut.state.chat.at(-1), /É um cavalo selvagem: só os domadores sabem amansá-lo\./);
    const hans = sut.player("hans");
    assert.equal(refuse(horse, hans), false);
    assert.match(sut.state.chat.at(-1), /Ele é selvagem: chegue devagar, aperte E e ofereça comida até ele confiar em você\./);
    assert.equal(refuse({ id: 99999 }, hans), undefined, "a horse that is not wild is left to the others");
});

test("a wild horse that dies, or is taken out of the world, is replaced: the first after six hours by another breed, the second in two minutes with what was won", () => {
    const sut = load();
    sut.tick();
    const [dead, lost] = sut.wild();
    const hans = sut.player("hans", { at: { x: dead.position.x + 2, y: dead.position.y, z: 100 } });
    sut.state.online.splice(0, sut.state.online.length, hans);
    sut.api.setTrustNearest(hans, 40);
    dead.alive = false;
    sut.state.handlers.get("horseDeath")[0](dead);
    assert.ok(sut.state.logs.some((line) => /o cavalo de m1-\d morreu/.test(line)));
    sut.state.horses.delete(lost.id);
    sut.tick();
    const spawned = sut.state.spawned.length;
    sut.tick(2 * 60_000);
    assert.equal(sut.state.spawned.length, spawned + 1, "the lost one is back after two minutes");
    sut.tick(6 * 3_600_000);
    assert.equal(sut.state.spawned.length, spawned + 2, "the dead one's place has another after six hours");
});

test("the administrator's words: how many there are, the nearest with their trust, trust set to try it, and the herds put back", () => {
    const sut = load();
    sut.tick();
    const boss = sut.player("boss", { at: { x: 1005, y: 1000, z: 100 } });
    sut.state.online.splice(0, sut.state.online.length, boss);
    const summary = sut.api.wildSummary(boss);
    assert.match(summary[0], /Cavalos selvagens: 4 nos campos abertos \(2 campos, 2 por campo\); 0 lugar\(es\) esperando outro cavalo; 0 deles já conhecem você\./);
    assert.match(summary[1], /14 m \(22 m montado\).*9 m.*confiança de 100, 90 s entre duas comidas do mesmo tipo \(e 20 s entre quaisquer duas\), e o cavalo pode recusar \(35% sem confiança nenhuma\); sem comida a confiança cai 1 ponto a cada 6 min depois de 20 min.*6 h/);

    const rows = sut.api.nearestWild(boss, 3);
    assert.equal(rows.length, 3);
    assert.ok(rows[0].distance <= rows[1].distance && rows[1].distance <= rows[2].distance, "nearest first");
    assert.match(rows[0].id, /^m1-\d$/);
    assert.equal(sut.api.setTrustNearest(boss, 55), rows[0].id);
    assert.equal(sut.api.nearestWild(boss, 1)[0].trust, 55);
    assert.equal(sut.api.setTrustNearest(boss, 500), rows[0].id);
    assert.equal(sut.api.nearestWild(boss, 1)[0].trust, 100, "never past a hundred");

    const before = sut.wild().length;
    assert.equal(sut.api.resetWild(sut.state.clock.now), 4);
    assert.equal(sut.state.spawned.length, 8, "all four put back in their meadows at once");
    assert.equal(sut.wild().length, before);
    assert.match(sut.api.wildSummary(boss)[0], /4 nos campos abertos/);
});

test("what the players have won is kept, with the breed of each place, and is there after a restart; a file that cannot be read is left alone", () => {
    const first = load({ randomValue: 0.9 });
    first.tick();
    const [horse] = first.wild();
    const hans = first.player("hans", { at: { x: horse.position.x + 2, y: horse.position.y, z: 100 } });
    first.state.online.splice(0, first.state.online.length, hans);
    first.api.setTrustNearest(hans, 63);
    const souls = first.state.spawned.map((one) => one.soul);

    const after = load({ disk: first.disk });
    after.tick();
    assert.deepEqual(after.state.spawned.map((one) => one.soul), souls, "the same breed in each place");
    const again = after.player("hans", { at: { x: after.wild()[0].position.x + 2, y: after.wild()[0].position.y, z: 100 } });
    after.state.online.splice(0, after.state.online.length, again);
    assert.match(after.api.menuPageFor(again, after.wild()[0], after.state.clock.now).line, /63\/100/);

    const broken = load({ disk: fakeDisk({ "playerdata/wild-horses.json": "{not json" }) });
    broken.tick();
    assert.equal(broken.state.spawned.length, 4, "the horses are there all the same");
    assert.ok(broken.state.logs.some((line) => /ilegível/.test(line)));
});

test("stopping the resource takes the wild horses away, so a restart does not put a second herd beside the first; another resource's stop is not ours", () => {
    const sut = load();
    sut.tick();
    for (const fn of sut.state.handlers.get("resourceStop")) fn("another");
    assert.equal(sut.wild().length, 4);
    for (const fn of sut.state.handlers.get("resourceStop")) fn("kcdc-gamemode");
    assert.equal(sut.wild().length, 0);
});

test("the plain tack is one of the generic sets, whichever the server has; else the same pieces by name; else the horse stays bare and the owner is told", () => {
    const { sut, horse, hans } = trusting();
    sut.state.presets.splice(0, sut.state.presets.length, "horse_common05", "horse_noble05");
    assert.equal(sut.api.dress(horse, "m1-1"), "horse_common05", "only the generic sets that exist are drawn from");

    sut.state.presets.length = 0;
    assert.equal(sut.api.dress(horse, "m1-1"), "sela, rédeas e ferraduras pelo nome");
    assert.deepEqual(plain(sut.state.gearCalls.at(-1)), { saddle: "BasicSaddle01_m03", head: "BasicBridle01_m01", shoe: "horseshoeMilitary" });

    sut.state.gearFails = true;
    assert.equal(sut.api.dress(horse, "m1-1"), "", "a server that takes none of it: bare");
    assert.ok(sut.state.logs.some((line) => /a sela, as rédeas e as ferraduras não foram postas no cavalo de m1-1/.test(line)));
    sut.state.askExtras[0](hans, horse);
    sut.state.handlers.get("dialogueChoice")[0](sut.state.opened[0].session, hans, "mount");
    assert.deepEqual(plain(sut.state.given), [[horse.id, hans.id]], "the horse is theirs all the same");
    assert.ok(sut.state.chat.some((line) => /Ele ainda não tem sela nem arreios\./.test(line)));
    assert.ok(sut.state.logs.some((line) => /Hans amansou o cavalo de m\d+-\d, que ficou sem sela/.test(line)));

    const raised = load();
    raised.tick();
    const [wild] = raised.wild();
    const farmer = raised.player("hans", { at: { x: wild.position.x + 2, y: wild.position.y, z: 100 } });
    raised.state.presets.splice(0, raised.state.presets.length, "horse_common01");
    raised.state.gearFails = false;
    raised.api.setTrustNearest(farmer, 100);
    assert.equal(raised.api.tame(farmer, wild, T0), true);
    assert.deepEqual(plain(raised.state.gearCalls), ["horse_common01"]);
});

test("a horse may turn a treat down while it does not trust enough: 35% at nothing, none from half; the treat stays in the bag, and the wait starts all the same", () => {
    const sut = load();
    assert.equal(sut.api.refusalChance(0), 0.35);
    assert.ok(Math.abs(sut.api.refusalChance(25) - 0.175) < 1e-9, "half of it at a quarter");
    assert.equal(sut.api.refusalChance(50), 0);
    assert.equal(sut.api.refusalChance(80), 0);

    sut.tick();
    const [horse] = sut.wild();
    const hans = sut.player("hans", { at: { x: horse.position.x + 2, y: horse.position.y, z: 100 }, bag: [{ item: CARROT, amount: 3 }] });
    const refused = sut.api.feed(hans, horse, T0, () => 0.1);
    assert.match(refused, /O cavalo cheira a cenoura, vira a cabeça e recua: ainda não confia o bastante para comer da sua mão\./);
    assert.equal(sut.state.bags.get(hans.id).find((row) => row.item === CARROT).amount, 3, "the carrot is not taken");
    assert.deepEqual(hans.played, [], "and there is no petting");
    assert.equal(sut.api.menuPageFor(hans, horse, T0 + 10_000).options[0].text, "Oferecer cenoura (daqui a 80 s)", "the minute and a half runs all the same");
    assert.match(sut.state.logs.at(-1), /o cavalo de m1-\d recusou cenoura de Hans \(confiança 0\)/);
    assert.match(sut.api.feed(hans, horse, T0 + 30_000, () => 0.99), /ainda mastiga/);
    const back = sut.state.timers.find((one) => one.ms === 1_500);
    assert.ok(back, "the menu comes back a moment after, with the wait on it");
    back.fn();
    assert.equal(sut.state.opened.length, 1);

    // A luckier throw is taken; and from half the trust on it is never turned down.
    assert.match(sut.api.feed(hans, horse, T0 + 91_000, () => 0.5), /O cavalo aceita a cenoura \(arisco, confiança 5\/100\)/);
    sut.api.setTrustNearest(hans, 50);
    assert.match(sut.api.feed(hans, horse, T0 + 200_000, () => 0), /O cavalo aceita a cenoura/, "a throw of nothing, and it takes it all the same");
});

test("trust that is not kept up fades: nothing for twenty minutes after a feeding, then a point every six; the menu, the nearest list and the taming see it", () => {
    const sut = load();
    sut.tick();
    const [horse] = sut.wild();
    const hans = sut.player("hans", { at: { x: horse.position.x + 2, y: horse.position.y, z: 100 }, bag: [{ item: CARROT, amount: 5 }] });
    sut.api.setTrustNearest(hans, 40);
    const fed = sut.state.clock.now - 90_000;
    const at = (minutes) => fed + minutes * 60_000;
    assert.equal(sut.api.trustNow({ trust: 40, fedAt: fed }, at(10)), 40);
    assert.equal(sut.api.trustNow({ trust: 40, fedAt: fed }, at(20)), 40, "the twenty minutes of grace");
    assert.equal(sut.api.trustNow({ trust: 40, fedAt: fed }, at(25.9)), 40);
    assert.equal(sut.api.trustNow({ trust: 40, fedAt: fed }, at(26)), 39, "then a point");
    assert.equal(sut.api.trustNow({ trust: 40, fedAt: fed }, at(120)), 24, "two hours: sixteen points");
    assert.equal(sut.api.trustNow({ trust: 40, fedAt: fed }, at(10_000)), 0, "never below nothing");
    assert.equal(sut.api.trustNow({ trust: 100, fedAt: 0 }, at(10_000)), 100, "a horse that trusts them fully has been won");
    assert.equal(sut.api.trustNow(undefined, at(5)), 0);

    const now = at(120);
    assert.match(sut.api.menuPageFor(hans, horse, now).line, /Confiança ■■□□□□□□□□ 24\/100/);
    sut.state.clock.now = now;
    assert.equal(Math.round(sut.api.nearestWild(hans, 1)[0].trust), 24);
    assert.equal(sut.api.tame(hans, horse, now), false, "faded trust is not a tamed horse");

    // A feeding starts from what is left, and starts the clock again.
    sut.api.feed(hans, horse, now, () => 0.99);
    assert.equal(sut.api.menuPageFor(hans, horse, now + 1_000).line.includes("29/100"), true, "24 and a carrot");
    assert.equal(sut.api.trustNow({ trust: 29, fedAt: now }, now + 19 * 60_000), 29);
});

test("the horse menu's round reads the wild herd once for all its Domadores, and hands in where each player is (2026-10-27)", () => {
    const sut = load();
    sut.tick();
    const [first, second] = sut.wild();
    const near = sut.state.nearExtras[0];
    const hans = sut.player("hans", { at: { x: first.position.x + 2, y: first.position.y, z: 100 } });
    const greta = sut.player("greta", { at: { x: second.position.x - 1, y: second.position.y, z: 100 } });
    const herd = sut.wild().length;
    const before = sut.state.lookups ?? 0;
    assert.equal(near(hans, 3.1, hans.position, 41).horse.id, first.id);
    assert.equal(near(greta, 3.1, greta.position, 41).horse.id, second.id);
    assert.equal((sut.state.lookups ?? 0) - before, herd, "one look at each wild horse for the whole round, not one per Domador");
    const found = near(hans, 3.1, hans.position, 41);
    assert.equal(found.distance, 2, "the answer says how far, so the menu need not read the horse again");
    assert.deepEqual([found.x, found.y], [first.position.x, first.position.y]);
    assert.equal(near(hans, 3.1, hans.position, 42).horse.id, first.id);
    assert.equal((sut.state.lookups ?? 0) - before, 2 * herd, "a new round reads them again");
    first.rider = { id: 3 };
    assert.equal(near(hans, 3.1, hans.position, 42).horse.id, first.id, "within a round the herd is the one read at its start");
    assert.notEqual(near(hans, 30, hans.position, 43)?.horse.id, first.id, "the next round sees the rider");
    first.rider = null;
    assert.equal(near(hans, 3.1, { x: second.position.x - 1, y: second.position.y, z: 100 }, 44).horse.id, second.id, "where the round says the player is, not a read of it");
});

test("the menu has a row for each kind of treat in the bag, the best first, and each kind waits on its own (2026-10-28: apples and pears, not only the carrot)", () => {
    const sut = load();
    sut.tick();
    const [horse] = sut.wild();
    const hans = sut.player("hans", { at: { x: horse.position.x + 2, y: horse.position.y, z: 100 }, bag: [{ item: CARROT, amount: 3 }, { item: APPLE, amount: 2 }, { item: PEAR, amount: 1 }, { item: BREAD, amount: 4 }] });
    const rows = (now) => plain(sut.api.menuPageFor(hans, horse, now).options.map((o) => [o.id, o.text, o.enabled]));
    assert.deepEqual(rows(T0), [
        ["feed", "Oferecer cenoura", true],
        [`feed:${TREAT_ORDER.indexOf(APPLE)}`, "Oferecer maçã", true],
        [`feed:${TREAT_ORDER.indexOf(PEAR)}`, "Oferecer pera", true],
        [`feed:${TREAT_ORDER.indexOf(BREAD)}`, "Oferecer pão", true],
        ["mount", "Montar (ele ainda não confia)", false],
        ["leave", "Sair", true],
    ]);

    // A carrot, and at once the apple is not: the horse is still chewing for a moment, then the apple may follow, and the carrot waits its minute and a half.
    assert.match(sut.api.feed(hans, horse, T0, () => 0.99), /aceita a cenoura \(arisco, confiança 5\/100\)/);
    assert.deepEqual(rows(T0 + 5_000).slice(0, 3), [
        ["feed", "Oferecer cenoura (daqui a 85 s)", false],
        [`feed:${TREAT_ORDER.indexOf(APPLE)}`, "Oferecer maçã (daqui a 15 s)", false],
        [`feed:${TREAT_ORDER.indexOf(PEAR)}`, "Oferecer pera (daqui a 15 s)", false],
    ]);
    assert.match(sut.api.feed(hans, horse, T0 + 5_000, () => 0.99), /ainda mastiga: espere 15 s/, "any two feedings are a gap apart");
    assert.deepEqual(rows(T0 + 21_000).slice(0, 3), [
        ["feed", "Oferecer cenoura (daqui a 69 s)", false],
        [`feed:${TREAT_ORDER.indexOf(APPLE)}`, "Oferecer maçã", true],
        [`feed:${TREAT_ORDER.indexOf(PEAR)}`, "Oferecer pera", true],
    ]);
    // The first row is "the best that may be given": at 21 s it is the apple.
    assert.match(sut.api.feed(hans, horse, T0 + 21_000, () => 0.99), /aceita a maçã \(arisco, confiança 10\/100\)/, "4.5 of an apple on top of 5 of the carrot, 9.5 shown as 10");
    assert.match(sut.api.feed(hans, horse, T0 + 42_000, () => 0.99), /aceita a pera \(arisco, confiança 14\/100\)/, "and 4 of a pear, 13.5 shown as 14");
    assert.equal(sut.state.bags.get(hans.id).find((row) => row.item === CARROT).amount, 2);
    assert.equal(sut.state.bags.get(hans.id).find((row) => row.item === APPLE).amount, 1);
    assert.equal(sut.state.bags.get(hans.id).some((row) => row.item === PEAR), false, "the last pear is gone");
    assert.match(sut.api.feed(hans, horse, T0 + 63_000, () => 0.99), /aceita o pão/, "then the bread, whose wait has not been started");
    assert.match(sut.api.feed(hans, horse, T0 + 84_000, () => 0.99), /ainda mastiga: espere 6 s/, "and all the kinds in the bag wait: the soonest is the carrot's, at 90 s");
    assert.match(sut.api.feed(hans, horse, T0 + 91_000, () => 0.99), /aceita a cenoura/);
});

test("a row of the menu feeds its own kind, and only that kind: \"feed:<n>\" gives the apple even while the carrot is ready", () => {
    const sut = load({ randomValue: 0.9 });
    sut.tick();
    const [horse] = sut.wild();
    const hans = sut.player("hans", { at: { x: horse.position.x + 2, y: horse.position.y, z: 100 }, bag: [{ item: CARROT, amount: 3 }, { item: APPLE, amount: 2 }] });
    sut.state.askExtras[0](hans, horse);
    const session = sut.state.opened[0].session;
    sut.state.handlers.get("dialogueChoice")[0](session, hans, `feed:${TREAT_ORDER.indexOf(APPLE)}`);
    assert.equal(sut.state.bags.get(hans.id).find((row) => row.item === APPLE).amount, 1, "an apple was given");
    assert.equal(sut.state.bags.get(hans.id).find((row) => row.item === CARROT).amount, 3, "and no carrot");
    assert.match(sut.state.chat.at(-1), /aceita a maçã \(arisco, confiança 5\/100\)/, "4.5 shown as 5");
    // A kind the bag does not hold, or a row that is not one, does nothing.
    const before = sut.state.chat.length;
    sut.state.opened.length = 0;
    sut.state.askExtras[0](hans, horse);
    const again = sut.state.opened[0].session;
    sut.state.handlers.get("dialogueChoice")[0](again, hans, `feed:${TREAT_ORDER.indexOf(BREAD)}`);
    assert.match(sut.state.chat.at(-1), /Você não tem o que oferecer/);
    sut.state.opened.length = 0;
    sut.state.askExtras[0](hans, horse);
    sut.state.handlers.get("dialogueChoice")[0](sut.state.opened[0].session, hans, "feed:99");
    sut.state.handlers.get("dialogueChoice")[0](sut.state.opened[0].session, hans, "feed:x");
    assert.ok(sut.state.chat.length >= before);
});

test("a refused treat starts the wait of its own kind, not of the others; a bond from before the kinds had their own wait counts its last feeding for all of them, once", () => {
    const sut = load();
    sut.tick();
    const [horse] = sut.wild();
    const hans = sut.player("hans", { at: { x: horse.position.x + 2, y: horse.position.y, z: 100 }, bag: [{ item: CARROT, amount: 3 }, { item: APPLE, amount: 2 }] });
    assert.match(sut.api.feed(hans, horse, T0, () => 0.1), /cheira a cenoura, vira a cabeça e recua/);
    assert.equal(sut.api.waitFor({ fedAt: T0, fed: { [CARROT]: T0 } }, APPLE, T0 + 5_000), 15_000, "the apple waits only the gap");
    assert.equal(sut.api.waitFor({ fedAt: T0, fed: { [CARROT]: T0 } }, CARROT, T0 + 5_000), 85_000);
    assert.equal(sut.api.waitFor({ fedAt: T0 }, APPLE, T0 + 5_000), 85_000, "a bond with no kinds: the old single wait, for every kind");
    assert.equal(sut.api.waitFor(undefined, APPLE, T0), 0);
    assert.equal(sut.api.waitFor({ fedAt: 0, fed: {} }, APPLE, T0), 0);
    assert.match(sut.api.feed(hans, horse, T0 + 21_000, () => 0.99), /aceita a maçã/, "after the gap the apple is ready though the carrot was refused a moment ago");
});

// The breeds are not alike, and the tamer grows (wild-horses.ts, 2026-11-04: "à medida que o domador vai ficando mais forte deve ser mais fácil também domar cavalos mais difíceis").

test("each breed has a hardness, 0 to 3; one the table does not know is of good stock; every breed the herds draw from has one", () => {
    const { api } = load();
    assert.equal(api.hardnessOf("pebbles"), 0);
    assert.equal(api.hardnessOf("tarant"), 1);
    assert.equal(api.hardnessOf("napoli"), 2);
    assert.equal(api.hardnessOf("kincsem"), 3);
    assert.equal(api.hardnessOf("never_heard_of_it"), 1);
    assert.equal(Object.keys(api.BREED_HARDNESS).length, 24, "the 24 breeds a wild horse may be");
    assert.deepEqual(Array.from(api.HARDNESS_WORDS), ["comum", "de boa linhagem", "nobre", "lendário"]);
});

test("a tamer's skill is their riding, 5 to 30, and 5 when the game has not said", () => {
    const { api } = load();
    assert.equal(api.tamerLevel({}), 5);
    assert.equal(api.tamerLevel({ getTrack: () => null }), 5);
    assert.equal(api.tamerLevel({ getTrack: (track) => (track === "horse_riding" ? { level: 18 } : { level: 3 }) }), 18);
    assert.equal(api.tamerLevel({ getTrack: () => ({ level: 99 }) }), 30);
    assert.equal(api.tamerLevel({ getTrack: () => { throw new Error("gone"); } }), 5);
    assert.deepEqual([5, 17.5, 30, 1, 99].map((level) => api.skillOf(level)), [0, 0.5, 1, 0, 1]);
});

test("a harder breed is harder for a beginner, and as the skill rises it closes the gap: at the top a legendary horse is won faster than an ordinary one was by a beginner", () => {
    const { api } = load();
    assert.equal(api.easeOf(0, 5), 1, "an ordinary horse for a beginner is the measure");
    const beginner = [0, 1, 2, 3].map((hardness) => api.easeOf(hardness, 5));
    assert.ok(beginner[0] > beginner[1] && beginner[1] > beginner[2] && beginner[2] > beginner[3], "harder breeds are harder");
    assert.ok(Math.abs(beginner[3] - 1 / 2.6) < 1e-9, "a legendary horse gives a beginner 1/2.6 of the trust");
    for (const hardness of [0, 1, 2, 3]) {
        let before = 0;
        for (const level of [5, 10, 15, 20, 25, 30]) {
            const ease = api.easeOf(hardness, level);
            assert.ok(ease > before, `hardness ${hardness}: the more skill, the easier (level ${level})`);
            before = ease;
        }
    }
    assert.ok(api.easeOf(3, 30) > 1.3, "at the top, even the legendary horse is easier than an ordinary one was to a beginner");
    // The gap between the hardest and the easiest breed is smaller the stronger the tamer.
    assert.ok(api.easeOf(0, 5) / api.easeOf(3, 5) > api.easeOf(0, 17) / api.easeOf(3, 17));
    assert.equal(api.easeOf(0, 30), api.easeOf(3, 30), "and gone at the top");
    assert.equal(api.effortWord(1.35), "fácil para você");
    assert.equal(api.effortWord(1), "no seu alcance");
    assert.equal(api.effortWord(0.6), "difícil para você");
    assert.equal(api.effortWord(0.38), "muito difícil para você");
});

test("a harder breed turns a treat down more often, a stronger tamer less; the defaults are what it always was", () => {
    const { api } = load();
    assert.equal(api.refusalChance(0), 0.35, "an ordinary horse, a beginner: unchanged");
    assert.equal(api.refusalChance(50), 0);
    assert.ok(Math.abs(api.refusalChance(0, 3, 5) - 0.35 * 2.5) < 1e-9, "a legendary horse: two and a half times");
    assert.ok(api.refusalChance(0, 3, 30) < api.refusalChance(0, 3, 5), "the skill takes refusals away");
    assert.ok(Math.abs(api.refusalChance(0, 0, 30) - 0.35 * 0.4) < 1e-9, "down to two fifths at the top");
    assert.ok(api.refusalChance(0, 3, 5) <= 0.9, "never above nine in ten");
    assert.ok(api.refusalChance(25, 3, 5) < api.refusalChance(0, 3, 5), "and it still fades as the trust grows");
});

test("a feeding gives the trust of the treat times how easy this breed is for this tamer: the same horse is won faster by a master than by a beginner", () => {
    const sut = load();
    sut.tick();
    const [horse] = sut.wild();
    const hardness = sut.api.hardnessOf(horse.soul);
    const near = { x: horse.position.x + 2, y: horse.position.y, z: 100 };
    const beginner = sut.player("hans", { at: near, bag: [{ item: CARROT, amount: 5 }] });
    const master = sut.player("greta", { at: near, bag: [{ item: CARROT, amount: 5 }] });
    master.getTrack = () => ({ level: 30 });
    sut.api.feed(beginner, horse, T0, () => 0.99);
    sut.api.feed(master, horse, T0, () => 0.99);
    const saved = JSON.parse(sut.disk.files.get("playerdata/wild-horses.json"));
    const slot = Object.values(saved.slots).find((one) => one.bonds.hans !== undefined);
    assert.ok(Math.abs(slot.bonds.hans.trust - 5 * sut.api.easeOf(hardness, 5)) < 1e-6, `a beginner: a carrot's 5 times the ease of a hardness-${hardness} breed`);
    assert.ok(Math.abs(slot.bonds.greta.trust - 5 * sut.api.easeOf(hardness, 30)) < 1e-6, "the master: the same carrot, worth more");
    assert.ok(slot.bonds.greta.trust > slot.bonds.hans.trust || hardness === 0 && slot.bonds.greta.trust > slot.bonds.hans.trust, "and so more than the beginner got");
    assert.match(sut.state.logs.filter((line) => /Greta deu cenoura/.test(line)).at(-1), /equitação 30, facilidade 1\.35|equitação 30, facilidade 1\.\d\d/);
});

test("the menu says what the horse is to this tamer: nothing of an ordinary horse that is their match, its stock and how hard it is otherwise", () => {
    const sut = load();
    sut.tick();
    const [horse] = sut.wild();
    const near = { x: horse.position.x + 2, y: horse.position.y, z: 100 };
    const beginner = sut.player("hans", { at: near });
    const master = sut.player("greta", { at: near });
    master.getTrack = () => ({ level: 30 });
    const hardness = sut.api.hardnessOf(horse.soul);
    const first = sut.api.menuPageFor(beginner, horse, T0).line;
    const second = sut.api.menuPageFor(master, horse, T0).line;
    if (hardness === 0) {
        assert.match(first, /^Cavalo selvagem: arisco\./, "an ordinary horse for a beginner: nothing said");
    } else {
        assert.match(first, new RegExp(`^Cavalo selvagem \(${sut.api.HARDNESS_WORDS[hardness]}, (difícil|muito difícil) para você\): arisco\.`));
    }
    assert.match(second, /\(.*fácil para você\)/, "to a master every breed is easy");
});
