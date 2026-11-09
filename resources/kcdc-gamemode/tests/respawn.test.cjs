const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function load({ kuttenberg = true, navigationReady = true, floor = (point) => ({ x: point.x + 1, y: point.y, z: point.z - 0.4 }), doors = [] } = {}) {
    const handlers = new Map();
    const timers = [];
    const cleared = [];
    const players = new Map();
    const logs = [];
    // The verses of the death screen: the real module, which needs nothing.
    const verses = (() => { const box = { exports: {}, Math }; vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/death-verses.js"), "utf8"), box); return box.exports; })();
    const modules = {
        "./heal.js": { cure: (player, what) => { player.cures.push(what); return true; } },
        "./language.js": { languageOf: (player) => player.language ?? "pt" },
        "./level.js": { onKuttenberg: () => kuttenberg },
        "./death-verses.js": verses,
    };
    const context = {
        exports: {},
        require: (id) => modules[id] ?? assert.fail(`unexpected require ${id}`),
        console: { log: (line) => logs.push(line), error: (line) => logs.push(line) },
        setTimeout: (fn, ms) => { timers.push({ fn, ms, done: false }); return timers.length; },
        clearTimeout: (id) => cleared.push(id),
        Events: { on: (name, fn) => handlers.set(name, fn) },
        Chat: { sendToPlayer: (player, text) => player.chat.push(text) },
        Navigation: { ready: navigationReady, closestPoint: (point) => floor(point) },
        Player: { getById: (id) => players.get(id) ?? null },
        Door: { all: () => doors },
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/respawn.js"), "utf8"), context);
    context.exports.installRespawn();

    const makePlayer = (id, steamId, position) => {
        const player = {
            id,
            steamId,
            nickname: `P${id}`,
            position,
            chat: [],
            notes: [],
            revived: 0,
            spawned: [],
            stats: [],
            cures: [],
            health: 100,
            maxHealth: 100,
            setStat(stat, value) { this.stats.push([stat, value]); return true; },
            reviveAnswer: true,
            order: [],
            revive() { this.revived += 1; this.order.push("revive"); return this.reviveAnswer; },
            spawn(point) { this.spawned.push({ ...point }); this.order.push("spawn"); return true; },
            emit(name, payload) { this.notes.push({ name, payload: JSON.parse(payload) }); this.order.push(name.replace("kcdc-gamemode:", "")); },
        };
        players.set(id, player);
        return player;
    };
    /** Runs the timers due now, in order: the revive first, then the move it schedules. */
    const runTimers = () => {
        for (let i = 0; i < timers.length; i++) {
            const timer = timers[i];
            if (!timer.done && !cleared.includes(i + 1)) {
                timer.done = true;
                timer.fn();
            }
        }
    };
    // The first timer is the churches' doors, a little after the start.
    timers[0].done = true;
    return { api: context.exports, verses, handlers, timers, cleared, players, logs, makePlayer, runTimers, die: (player) => handlers.get("playerDied")(player) };
}

test("the nearest church is the one whose donation box is nearest on the map", () => {
    const { api } = load();
    assert.equal(api.nearestChurch({ x: 760, y: 3260 }).id, "suchdol");
    assert.equal(api.nearestChurch({ x: 420, y: 2480 }).id, "wysoka");
    assert.equal(api.nearestChurch({ x: 1500, y: 3800 }).id, "raborsch");
    assert.equal(api.nearestChurch({ x: 3050, y: 690 }).id, "sao-tiago");
    assert.equal(api.nearestChurch({ x: 3200, y: 2200 }).id, "grunta");
    assert.equal(api.CHURCHES.length, 8);
});

test("a player who dies is told where they will wake, revived after a while, then moved to the church", () => {
    const sut = load();
    const hans = sut.makePlayer(4, "76561198000000001", { x: 700, y: 3300, z: 140 });
    sut.die(hans);

    assert.match(hans.chat[0], /Você caiu gravemente ferido\. Em 10 segundos você é levado para a igreja de Suchdol\./);
    assert.equal(sut.timers[1].ms, 10000, "ten seconds, the counter of the death screen");
    assert.equal(sut.api.RESPAWN_DELAY_MS, 10_000);
    assert.equal(hans.revived, 0, "the body stays down for the delay");

    sut.runTimers();
    assert.equal(hans.revived, 1);
    assert.equal(sut.timers[2].ms, 600);
    assert.equal(hans.spawned.length, 1, "moved once");
    const at = hans.spawned[0];
    assert.ok(Math.abs(at.x - 748.97) < 1e-6 && Math.abs(at.y - 3246.3) < 1e-6 && Math.abs(at.z - 139.09) < 1e-6, "on the floor the navigation found next to the box");
    assert.match(hans.chat.at(-1), /Você foi ferido e sobreviveu: foi arrastado até a igreja de Suchdol\. Procure um médico alquimista o mais rápido possível para curar as suas feridas\./);
    assert.ok(hans.notes.some((note) => /arrastado até a igreja/.test(note.payload.text)), "also on the game's notification line");
    assert.deepEqual(hans.stats, [["health", 30]], "and wakes hurt: 30% of the health");
    assert.deepEqual(hans.cures, ["sangramento"], "but not bleeding: one who died bleeding woke and died again (Garcia, 2026-10-19)");
});

test("the death screen: the player is sent the verse, its reference, the line over the counter and the ten seconds when the body falls, and told it is over once they are where they wake (2026-10-31)", () => {
    const sut = load();
    const hans = sut.makePlayer(4, "76561198000000001", { x: 700, y: 3300, z: 140 });
    sut.die(hans);
    const begin = hans.notes.find((note) => note.name === "kcdc-gamemode:death.begin");
    assert.ok(begin, "the client is asked for the screen");
    assert.equal(begin.payload.seconds, 10);
    assert.equal(begin.payload.label, "Você volta a si em");
    assert.ok(sut.verses.VERSES.some((verse) => verse.pt === begin.payload.text && verse.ref.pt === begin.payload.ref), "a verse of the list, with its own reference");
    assert.equal(hans.notes.filter((note) => note.name === "kcdc-gamemode:death.end").length, 0, "not over yet");

    sut.runTimers();
    assert.deepEqual(hans.order.filter((name) => ["death.begin", "revive", "spawn", "death.end"].includes(name)), ["death.begin", "revive", "spawn", "death.end"], "begin, the body raised, taken to the church, and then the end: the camera glides back to whoever stands there");
    assert.equal(hans.notes.filter((note) => note.name === "kcdc-gamemode:death.end").length, 1);
});

test("the death screen speaks the language the player chose, and a player who left in the meantime is sent nothing", () => {
    const sut = load();
    const kat = sut.makePlayer(5, "76561198000000002", { x: 700, y: 3300, z: 140 });
    kat.language = "en";
    sut.die(kat);
    const begin = kat.notes.find((note) => note.name === "kcdc-gamemode:death.begin");
    assert.equal(begin.payload.label, "You will rise again in");
    assert.ok(sut.verses.VERSES.some((verse) => verse.en === begin.payload.text && verse.ref.en === begin.payload.ref));

    const gone = sut.makePlayer(6, "76561198000000003", { x: 700, y: 3300, z: 140 });
    sut.die(gone);
    sut.handlers.get("playerDisconnect")(gone);
    sut.runTimers();
    assert.equal(gone.notes.filter((note) => note.name === "kcdc-gamemode:death.end").length, 0);
    // A client that cannot take the message does not stop the wake-up.
    const deaf = sut.makePlayer(7, "76561198000000004", { x: 700, y: 3300, z: 140 });
    const emitted = deaf.emit.bind(deaf);
    deaf.emit = (name, payload) => { if (name.includes("death.")) throw new Error("gone"); emitted(name, payload); };
    sut.die(deaf);
    sut.runTimers();
    assert.equal(deaf.revived, 1);
});

test("without a navigation mesh the player wakes just above the box's spot", () => {
    const sut = load({ navigationReady: false });
    const kat = sut.makePlayer(5, "76561198000000002", { x: 440, y: 2490, z: 218 });
    sut.die(kat);
    sut.runTimers();
    assert.ok(Math.abs(kat.spawned[0].z - 218.8) < 1e-6);
    assert.equal(kat.spawned[0].x, 440.04);
});

test("somebody already up (an administrator revived them) is not moved", () => {
    const sut = load();
    const hans = sut.makePlayer(4, "76561198000000001", { x: 700, y: 3300, z: 140 });
    sut.die(hans);
    hans.reviveAnswer = false;
    sut.runTimers();
    assert.deepEqual(hans.spawned, []);
    assert.equal(hans.notes.filter((note) => note.name === "kcdc-gamemode:death.end").length, 1, "but the death screen goes: somebody raised them");
});

test("a player who left is not revived, and their network id going to somebody else moves nobody", () => {
    const sut = load();
    const hans = sut.makePlayer(4, "76561198000000001", { x: 700, y: 3300, z: 140 });
    sut.die(hans);
    sut.handlers.get("playerDisconnect")(hans);
    assert.deepEqual(sut.cleared, [2]);

    const other = load();
    const first = other.makePlayer(4, "76561198000000001", { x: 700, y: 3300, z: 140 });
    other.die(first);
    const newcomer = other.makePlayer(4, "76561198000000099", { x: 10, y: 10, z: 10 });
    other.runTimers();
    assert.equal(newcomer.revived, 0);
    assert.deepEqual(newcomer.spawned, []);
});

test("dying twice before waking keeps one wake-up, the last one", () => {
    const sut = load();
    const hans = sut.makePlayer(4, "76561198000000001", { x: 700, y: 3300, z: 140 });
    sut.die(hans);
    sut.die(hans);
    assert.deepEqual(sut.cleared, [2]);
    sut.runTimers();
    assert.equal(hans.revived, 1);
    assert.equal(hans.spawned.length, 1);
});

test("a little after the start the church doors the level locked open; a house beside the church, and a script's lock, stay; the log lists what stands near", () => {
    const door = (name, x, y, z, locked, lockedByServer = false) => ({ name, position: { x, y, z }, locked, lockedByServer });
    const doors = [
        door("AnimDoor[structures/religious/churches/church_a1:Door/door_v1]", 742, 3226, 140, true),
        door("AnimDoor[structures/living/houses/house_2s_5r_a1:Door/door_v2]", 745, 3231, 140, true),
        door("AnimDoor[structures/religious/churches/church_a1:Door/held_for_a_look]", 750, 3250, 140, true, true),
        door("AnimDoor[structures/religious/churches/church_b1:Door/far]", 900, 3300, 140, true),
        door("AnimDoor[structures/religious/churches/church_a1:Door/cellar_below]", 748, 3246, 120, true),
    ];
    const sut = load({ doors });
    assert.equal(sut.timers[0].ms, 30_000);
    sut.timers[0].fn();
    assert.deepEqual(doors.map((entry) => entry.locked), [false, true, true, true, true]);
    assert.ok(sut.logs.some((line) => /^respawn: igreja de Suchdol: 3 porta\(s\) a 40 m, 1 de igreja destrancada\(s\) \(aberta AnimDoor\[structures\/religious\/churches\/church_a1:D; trancada AnimDoor\[structures\/living/.test(line)));
    assert.ok(sut.logs.some((line) => /^respawn: igreja de Wysoka: 0 porta\(s\) a 40 m, 0 de igreja destrancada\(s\)$/.test(line)));
});

test("a citizen wakes in their town, said so; somebody the resolver knows nothing of wakes in the church as before", () => {
    const sut = load();
    sut.api.setHomeResolver((steamId) => (steamId === "citizen" ? { place: "Raborsch", point: { x: 5, y: 6, z: 7 }, text: "Raborsch, a sua cidade" } : null));
    const citizen = sut.makePlayer(1, "citizen", { x: 749, y: 3247, z: 140 });
    const other = sut.makePlayer(2, "other", { x: 749, y: 3247, z: 140 });

    sut.die(citizen);
    assert.match(citizen.chat[0], /é levado para Raborsch, a sua cidade\./, "told where, before it happens");
    sut.runTimers();
    assert.deepEqual(citizen.spawned, [{ x: 5, y: 6, z: 7 }]);
    assert.match(citizen.chat.at(-1), /arrastado até Raborsch, a sua cidade\. Procure um médico alquimista/);

    sut.die(other);
    assert.match(other.chat[0], /levado para a igreja de Suchdol/);
    sut.runTimers();
    assert.match(other.chat.at(-1), /arrastado até a igreja de Suchdol/);
    assert.equal(other.spawned.length, 1);
});

// Another level (2026-11-09, "coloque nosso servidor do zero com o mapa 1 de kcd2"): the churches and the towns are Kuttenberg's coordinates, so on Trosky nobody is taken to them.

test("on another level there are no churches, and nobody is taken to one", () => {
    const { api } = load({ kuttenberg: false });
    assert.equal(api.CHURCHES.length, 0);
    assert.equal(api.nearestChurch({ x: 760, y: 3260 }), null);
    assert.equal(load().api.CHURCHES.length, 8, "Kuttenberg's eight are as they were");
});

test("on another level a player who dies is told they will get up where they fell, is revived, and is not moved: the screen goes, the wound comes", () => {
    const sut = load({ kuttenberg: false });
    const hans = sut.makePlayer(4, "76561198000000001", { x: 700, y: 3300, z: 140 });
    sut.die(hans);
    assert.match(hans.chat[0], /Você caiu gravemente ferido\. Em 10 segundos você se levanta onde caiu\./);
    sut.runTimers();
    assert.equal(hans.revived, 1);
    assert.deepEqual(hans.spawned, [], "no move to a church that is not there");
    assert.ok(hans.chat.some((line) => /levantou-se onde caiu/.test(line)), hans.chat.join(" | "));
    assert.ok(sut.logs.some((line) => /respawn: P4 acordou onde caiu/.test(line)), sut.logs.join(" | "));
    assert.ok(hans.notes.some((note) => note.name === "kcdc-gamemode:death.end"), "the death screen is taken off");
});
