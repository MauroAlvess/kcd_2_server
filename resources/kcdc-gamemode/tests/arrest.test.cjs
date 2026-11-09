// Arrest and the pillory (src/server/arrest.ts), over the real nobility catalog and a fake game (2026-10-29).
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const dist = (name) => fs.readFileSync(path.join(__dirname, "../dist/server", name), "utf8");
const plain = (value) => JSON.parse(JSON.stringify(value));

const ADMIN = "76561198000000001";
const SOLDIER = "76561198000000002";
const GUARD = "76561198000000003";
const CAPTAIN = "76561198000000004";
const PEASANT = "76561198000000005";
const PEASANT2 = "76561198000000006";
const NOBLE = "76561198000000007";
const MINOR = "76561198000000008";
const LORD = "76561198000000009";

function fakeDisk() {
    const files = new Map();
    return {
        files,
        fs: {
            readFileSync(file) { if (!files.has(file)) throw new Error("ENOENT"); return files.get(file); },
            writeFileSync(file, data) { files.set(file, data); },
            mkdirSync() {},
            renameSync(from, to) { files.set(to, files.get(from)); files.delete(from); },
            existsSync: (file) => files.has(file),
        },
    };
}

function load({ saved = null, disk = fakeDisk(), bus = null } = {}) {
    if (saved !== null) disk.files.set("playerdata/arrests.json", JSON.stringify(saved));
    const store = { exports: {}, require: () => disk.fs };
    vm.runInNewContext(dist("store.js"), store);
    const nobility = { exports: {} };
    vm.runInNewContext(dist("nobility.js"), nobility);

    const titles = { [SOLDIER]: ["soldado"], [GUARD]: ["guarda-portoes"], [CAPTAIN]: ["capitao-guarda"], [LORD]: ["lorde"] };
    const statuses = { [NOBLE]: "nobilis", [MINOR]: "minor", [LORD]: "nobilis" };
    const admins = [ADMIN];
    const handlers = new Map();
    const clientHandlers = new Map();
    const intervals = [];
    const players = [];
    const logs = [];
    const sessions = new Map();
    let nextSession = 1;
    let nextId = 1;
    const modes = [];
    const teleports = [];
    const spawns = [];
    const animations = [];
    const commandGates = [];

    const sandbox = {
        exports: {},
        require: (id) => {
            switch (id) {
                case "./auth.js": return { isAdmin: (player) => admins.includes(player.steamId) };
                case "./command.js": return { addCommandGate: (gate) => commandGates.push(gate) };
                case "./acquaintances.js": return { nameOf: (player) => player.nickname };
                case "./nobility.js": return nobility.exports;
                case "./status.js": return { getSocialStatus: (steamId) => statuses[steamId] ?? "plebeius" };
                case "./store.js": return store.exports;
                case "./titles.js": return { titlesOf: (steamId) => titles[steamId] ?? [] };
                default: return assert.fail(`unexpected require ${id}`);
            }
        },
        console: { log: (line) => logs.push(line), error: (line) => logs.push(line) },
        Chat: { sendToPlayer: (player, text) => player.chat.push(text) },
        Events: bus ?? {
            on: (name, fn) => handlers.set(name, [...(handlers.get(name) ?? []), fn]),
            onClient: (name, fn) => clientHandlers.set(name, fn),
        },
        Player: { all: () => players, getById: (id) => players.find((player) => player.id === id) ?? null },
        Dialogue: {
            sessionOf: (id) => [...sessions].find(([, value]) => value.playerId === id)?.[0] ?? 0,
            open: (playerId, page) => { const session = nextSession++; sessions.set(session, { playerId, page }); return session; },
            update: (session, page) => { if (!sessions.has(session)) return false; sessions.get(session).page = page; return true; },
            close: (session) => sessions.delete(session),
        },
        setInterval: (fn, ms) => { intervals.push({ fn, ms }); return intervals.length; },
        clearInterval() {},
        Vector3: class { constructor(x, y, z) { this.x = x; this.y = y; this.z = z; } },
    };
    vm.runInNewContext(dist("arrest.js"), sandbox);

    const spawn = (steamId, nickname, position = { x: 0, y: 0, z: 0 }) => {
        const player = {
            id: nextId++, steamId, nickname, ready: true, alive: true, virtualWorld: 0, position: { ...position }, chat: [], emitted: [],
            emit(event, payload) { this.emitted.push({ event, payload: JSON.parse(payload) }); },
            setMovementMode(mode) { modes.push({ steamId, mode: { ...mode } }); return true; },
            dismount() { return null; },
            teleport(position) { teleports.push({ steamId, position: { x: position.x, y: position.y, z: position.z } }); this.position = { x: position.x, y: position.y, z: position.z }; return true; },
            spawn(position, rotation) {
                if (this.spawnRefused) return false;
                spawns.push({ steamId, position: { x: position.x, y: position.y, z: position.z }, heading: rotation.z });
                this.position = { x: position.x, y: position.y, z: position.z };
                return true;
            },
            playAnimation(fragment, options) { animations.push({ steamId, fragment, options: { ...options } }); return this.animationRefused !== true; },
            stopAnimation(options) { animations.push({ steamId, stop: true, options: { ...options } }); return true; },
        };
        players.push(player);
        return player;
    };
    const fire = (name, ...args) => (handlers.get(name) ?? []).forEach((fn) => fn(...args));
    return { api: sandbox.exports, nobility: nobility.exports, disk, titles, statuses, admins, players, spawn, fire, handlers, clientHandlers, intervals, logs, sessions, modes, teleports, spawns, animations, commandGates, sandbox };
}

/** The stocks of Suchdol (the level's `so_pillory`), and the spot beside them where its own event spawns the prisoner. */
const SPOT = { x: 573.1456, y: 3253.013, z: 148.7397 };
const SIDE = { x: 573.7242, y: 3254.482, z: 148.7397 };
/** The last word about the hold that went to a player's client (the notice that follows it is not it). */
const lastState = (player) => player.emitted.filter((entry) => entry.event === "kcdc-gamemode:arrest.state").at(-1);
const NOW = 1_000_000_000;

test("a title's level is its place on the ladder; a commoner is at 7, a noble with no title at 5, a lesser noble at 6", () => {
    const sut = load();
    assert.equal(sut.api.levelOfPlayer(SOLDIER), 6);
    assert.equal(sut.api.levelOfPlayer(GUARD), 6);
    assert.equal(sut.api.levelOfPlayer(CAPTAIN), 5);
    assert.equal(sut.api.levelOfPlayer(LORD), 3);
    assert.equal(sut.api.levelOfPlayer(PEASANT), 7);
    assert.equal(sut.api.levelOfPlayer(NOBLE), 5);
    assert.equal(sut.api.levelOfPlayer(MINOR), 6);
});

test("who may arrest whom: an officer's title and somebody below them, never the same level, an administrator or a prisoner; an administrator arrests anybody", () => {
    const sut = load();
    const soldier = sut.spawn(SOLDIER, "Soldier");
    const guard = sut.spawn(GUARD, "Guard");
    const captain = sut.spawn(CAPTAIN, "Captain");
    const peasant = sut.spawn(PEASANT, "Peasant");
    const noble = sut.spawn(NOBLE, "Noble");
    const minor = sut.spawn(MINOR, "Minor");
    const admin = sut.spawn(ADMIN, "Admin");

    assert.equal(sut.api.mayArrest(soldier, peasant).ok, true, "a soldier arrests a commoner");
    assert.equal(sut.api.mayArrest(soldier, soldier).ok, false);
    assert.match(sut.api.mayArrest(soldier, guard).reason, /abaixo de você/, "the same level");
    assert.match(sut.api.mayArrest(soldier, noble).reason, /abaixo de você/, "a noble with no title stands higher");
    assert.match(sut.api.mayArrest(soldier, minor).reason, /abaixo de você/);
    assert.equal(sut.api.mayArrest(captain, soldier).ok, true);
    assert.equal(sut.api.mayArrest(captain, minor).ok, true);
    assert.equal(sut.api.mayArrest(captain, noble).ok, false, "a captain is at 5, as a noble with no title is");
    assert.match(sut.api.mayArrest(peasant, soldier).reason, /não dá o poder/);
    assert.match(sut.api.mayArrest(captain, admin).reason, /não pode prender/);
    assert.equal(sut.api.mayArrest(admin, noble).ok, true);
    assert.equal(sut.api.mayArrest(admin, soldier).ok, true);
});

test("an arrest handcuffs: the pace is held to a walk, the client is told, the prisoner and the officer are told, and it is kept in a file", () => {
    const sut = load();
    const soldier = sut.spawn(SOLDIER, "Ivan");
    const peasant = sut.spawn(PEASANT, "Kath", { x: 2, y: 0, z: 0 });
    const done = sut.api.arrest(soldier, peasant, NOW);
    assert.equal(done.ok, true);
    assert.match(done.message, /Você prendeu Kath/);
    assert.equal(sut.api.isArrested(peasant), true);
    assert.deepEqual(plain(sut.modes.at(-1)), { steamId: PEASANT, mode: { walkEnforced: true, walkByDefault: true } });
    assert.deepEqual(plain(lastState(peasant)), { event: "kcdc-gamemode:arrest.state", payload: { on: true, kind: "cuffs", until: NOW + 30 * 60_000, still: true } }, "held still: nobody leads them (2026-11-01)");
    assert.match(peasant.chat.at(-1), /Ivan prendeu você\. As suas mãos estão amarradas e você fica parado/);
    const saved = JSON.parse(sut.disk.files.get("playerdata/arrests.json"));
    assert.equal(saved.arrests[PEASANT].kind, "cuffs");
    assert.equal(saved.arrests[PEASANT].by, SOLDIER);
    assert.equal(saved.arrests[PEASANT].byLevel, 6);

    assert.match(sut.api.arrest(soldier, peasant, NOW).message, /já está presa/);
    const far = sut.spawn(PEASANT2, "Hans", { x: 50, y: 0, z: 0 });
    assert.match(sut.api.arrest(soldier, far, NOW).message, /não está mais por perto/);
});

test("a prisoner is let go by whoever arrested them, by an officer above them who is no lower than the one who arrested, and by an administrator; not by a lower officer", () => {
    const sut = load();
    const soldier = sut.spawn(SOLDIER, "Ivan");
    const captain = sut.spawn(CAPTAIN, "Cap");
    const guard = sut.spawn(GUARD, "Guard");
    const peasant = sut.spawn(PEASANT, "Kath");
    const admin = sut.spawn(ADMIN, "Admin");

    sut.api.arrest(captain, peasant, NOW);
    assert.match(sut.api.release(soldier, peasant).message, /Quem o prendeu está acima de você|Só quem está acima/, "a soldier does not undo a captain's arrest");
    assert.match(sut.api.release(guard, peasant).message, /acima/);
    assert.equal(sut.api.isArrested(peasant), true);
    const lord = sut.spawn(LORD, "Lord");
    assert.equal(sut.api.release(lord, peasant).ok, true, "a lord is above the captain");

    sut.api.arrest(soldier, peasant, NOW);
    assert.equal(sut.api.release(soldier, peasant).ok, true, "the one who arrested");
    assert.deepEqual(plain(sut.modes.at(-1).mode), { walkEnforced: false, walkByDefault: false });
    assert.equal(lastState(peasant).payload.on, false);
    assert.match(peasant.chat.at(-1), /Ivan soltou você/);
    assert.equal(sut.api.isArrested(peasant), false);

    sut.api.arrest(captain, peasant, NOW);
    assert.equal(sut.api.release(admin, peasant).ok, true);
    assert.match(sut.api.release(admin, peasant).message, /não está presa/);
});

test("the talk list offers Prender to an officer on somebody below, Soltar on a prisoner they may free, and nothing to everybody else", () => {
    const sut = load();
    const soldier = sut.spawn(SOLDIER, "Ivan");
    const guard = sut.spawn(GUARD, "Guard");
    const peasant = sut.spawn(PEASANT, "Kath");
    const second = sut.spawn(PEASANT2, "Hans");
    assert.deepEqual(plain(sut.api.menuOptions(soldier, peasant)), [{ id: "arrest", text: "Prender", enabled: true }]);
    assert.deepEqual(plain(sut.api.menuOptions(peasant, second)), []);
    assert.deepEqual(plain(sut.api.menuOptions(soldier, guard)), []);
    assert.equal(sut.api.choose(soldier, peasant, "arrest").startsWith("Você prendeu"), true);
    assert.deepEqual(plain(sut.api.menuOptions(second, peasant)), [], "nothing to a player with no power");
    const lead = { id: "escort", text: "Conduzir", enabled: true };
    assert.deepEqual(plain(sut.api.menuOptions(guard, peasant)), [{ id: "release", text: "Soltar", enabled: true }, lead], "a guard is at the soldier's level: no lower than the one who arrested");
    assert.deepEqual(plain(sut.api.menuOptions(soldier, peasant)), [{ id: "release", text: "Soltar", enabled: true }, lead]);
    assert.equal(sut.api.choose(soldier, peasant, "other"), null);
    assert.match(sut.api.choose(soldier, peasant, "release"), /Kath foi solto\./);
});

test("the pillory: an officer near one, with power, opens the list of the arrested standing near; they pick one and one of the four sentences; the prisoner is set at the pillory", () => {
    const sut = load();
    const soldier = sut.spawn(SOLDIER, "Ivan", { x: SPOT.x + 1, y: SPOT.y, z: SPOT.z });
    const peasant = sut.spawn(PEASANT, "Kath", { x: SPOT.x + 3, y: SPOT.y, z: SPOT.z });
    const free = sut.spawn(PEASANT2, "Hans", { x: SPOT.x + 2, y: SPOT.y, z: SPOT.z });
    sut.api.arrest(soldier, peasant, NOW);

    assert.equal(sut.api.openPillory(free, "suchdol"), false, "no power");
    assert.equal(sut.api.openPillory(soldier, "atlantis"), false);
    soldier.position = { x: 100, y: 100, z: 0 };
    assert.equal(sut.api.openPillory(soldier, "suchdol"), false, "too far from it");
    soldier.position = { x: SPOT.x + 1, y: SPOT.y, z: SPOT.z };
    assert.equal(sut.api.openPillory(soldier, "suchdol"), true);
    const [session, shown] = [...sut.sessions][0];
    assert.match(shown.page.line, /Pelourinho de Suchdol: quem será posto\?/);
    assert.deepEqual(plain(shown.page.options.map((option) => option.text)), ["Kath", "Sair"], "only the arrested, and only by name");

    assert.equal(sut.api.pageChoice(session, soldier, `p:${peasant.id}`), true);
    assert.match(sut.sessions.get(session).page.line, /Kath no pelourinho de Suchdol: por quanto tempo\?/);
    assert.deepEqual(plain(sut.sessions.get(session).page.options.map((option) => option.text)), ["15 minutos", "30 minutos", "1 hora", "2 horas", "Voltar", "Sair"]);
    assert.equal(sut.api.pageChoice(session, soldier, "back"), true);
    assert.match(sut.sessions.get(session).page.line, /quem será posto/);
    sut.api.pageChoice(session, soldier, `p:${peasant.id}`);

    assert.equal(sut.api.pageChoice(session, soldier, "t:60"), true);
    assert.equal(sut.sessions.size, 0, "the page is closed");
    const saved = JSON.parse(sut.disk.files.get("playerdata/arrests.json")).arrests[PEASANT];
    assert.equal(saved.kind, "pillory");
    assert.equal(saved.pillory, "suchdol");
    assert.ok(saved.until > Date.now() + 59 * 60_000 && saved.until < Date.now() + 61 * 60_000, "an hour");
    assert.deepEqual(plain(sut.spawns.at(-1)), { steamId: PEASANT, position: SPOT, heading: -160 }, "at the stocks, turned as they are");
    assert.match(peasant.chat.at(-1), /Ivan pôs você no pelourinho de Suchdol por 1 hora\. Você sai quando o tempo acabar, mesmo se sair do jogo e voltar/);
    assert.match(soldier.chat.at(-1), /Kath foi posto no pelourinho de Suchdol por 1 hora\./);
    assert.deepEqual(plain(sut.api.prisoners(Date.now()).map((one) => [one.name, one.kind, one.place, one.minutes])), [["Kath", "pillory", "Suchdol", 60]]);
});

test("a page for the pillory is closed when the officer leaves it, and a prisoner who went away is not offered", () => {
    const sut = load();
    const soldier = sut.spawn(SOLDIER, "Ivan", { x: SPOT.x, y: SPOT.y, z: SPOT.z });
    const peasant = sut.spawn(PEASANT, "Kath", { x: SPOT.x + 1, y: SPOT.y, z: SPOT.z });
    sut.api.arrest(soldier, peasant, NOW);
    sut.api.openPillory(soldier, "suchdol");
    const [session] = [...sut.sessions][0];
    peasant.position = { x: SPOT.x + 500, y: SPOT.y, z: SPOT.z };
    sut.api.pageChoice(session, soldier, `p:${peasant.id}`);
    assert.match(sut.sessions.get(session).page.line, /não há nenhum preso por perto|quem será posto/, "the list is made again");
    assert.match(soldier.chat.at(-1), /não está mais por perto/);
    soldier.position = { x: SPOT.x + 80, y: SPOT.y, z: SPOT.z };
    sut.api.pageChoice(session, soldier, "back");
    assert.match(soldier.chat.at(-1), /Você se afastou do pelourinho/);
    assert.equal(sut.sessions.size, 0);
});

test("time: handcuffs end by themselves after half an hour, a sentence at its end, even for somebody who is away; death ends it too; a prisoner of the pillory drifting off is set back", () => {
    const sut = load();
    const soldier = sut.spawn(SOLDIER, "Ivan", { x: SPOT.x, y: SPOT.y, z: SPOT.z });
    const peasant = sut.spawn(PEASANT, "Kath", { x: SPOT.x + 1, y: SPOT.y, z: SPOT.z });
    const hans = sut.spawn(PEASANT2, "Hans", { x: SPOT.x - 1, y: SPOT.y, z: SPOT.z });
    sut.api.arrest(soldier, peasant, NOW);
    sut.api.arrest(soldier, hans, NOW);
    sut.api.openPillory(soldier, "suchdol");
    const [session] = [...sut.sessions][0];
    sut.api.pageChoice(session, soldier, `p:${peasant.id}`);
    sut.api.pageChoice(session, soldier, "t:15");
    const until = JSON.parse(sut.disk.files.get("playerdata/arrests.json")).arrests[PEASANT].until;

    sut.api.tick(Date.now());
    peasant.position = { x: SPOT.x + 9, y: SPOT.y, z: SPOT.z };
    const before = sut.spawns.length;
    sut.api.tick(Date.now());
    assert.equal(sut.spawns.length, before + 1);
    assert.deepEqual(plain(sut.spawns.at(-1)), { steamId: PEASANT, position: SPOT, heading: -160 }, "put back at the pillory");

    sut.api.tick(NOW + 31 * 60_000);
    assert.equal(sut.api.isArrested(hans), false, "the cuffs ran out");
    assert.match(hans.chat.at(-1), /As algemas foram tiradas: o tempo acabou/);
    assert.equal(sut.api.isArrested(peasant), true, "the sentence runs on the real clock, which is far past NOW: not over");
    sut.api.tick(until - 1);
    assert.equal(sut.api.isArrested(peasant), true, "not a moment before");
    sut.api.tick(until);
    assert.equal(sut.api.isArrested(peasant), false, "at its end");
    assert.match(peasant.chat.at(-1), /A sua pena acabou: você está livre/);
    assert.deepEqual(plain(sut.modes.at(-1).mode), { walkEnforced: false, walkByDefault: false });

    const again = load();
    const captain = again.spawn(CAPTAIN, "Cap");
    const mate = again.spawn(PEASANT, "Mate", { x: 1, y: 0, z: 0 });
    again.api.arrest(captain, mate, NOW);
    mate.alive = false;
    again.api.tick(NOW + 1000);
    assert.equal(again.api.isArrested(mate), false, "death frees");
});

test("a prisoner who logs out and in again is still held, to the minute, and is told how long is left; one whose time ran out while away is free at the entry", () => {
    const first = load();
    const soldier = first.spawn(SOLDIER, "Ivan", { x: SPOT.x, y: SPOT.y, z: SPOT.z });
    const peasant = first.spawn(PEASANT, "Kath", { x: SPOT.x + 1, y: SPOT.y, z: SPOT.z });
    first.api.arrest(soldier, peasant, Date.now());
    first.api.openPillory(soldier, "suchdol");
    const [session] = [...first.sessions][0];
    first.api.pageChoice(session, soldier, `p:${peasant.id}`);
    first.api.pageChoice(session, soldier, "t:30");
    const saved = JSON.parse(first.disk.files.get("playerdata/arrests.json"));

    // A restart, the prisoner comes back.
    const second = load({ saved });
    second.api.installArrest();
    const back = second.spawn(PEASANT, "Kath", { x: 10, y: 10, z: 10 });
    second.fire("playerSpawned", back);
    assert.equal(second.api.isArrested(back), true);
    assert.deepEqual(plain(second.modes.at(-1).mode), { walkEnforced: true, walkByDefault: true });
    assert.deepEqual(plain(second.spawns.at(-1)), { steamId: PEASANT, position: SPOT, heading: -160 }, "set at the pillory again");
    assert.match(back.chat.at(-1), /Você continua no pelourinho de Suchdol: faltam (29|30) min\./);

    // Too late.
    const expired = JSON.parse(JSON.stringify(saved));
    expired.arrests[PEASANT].until = Date.now() - 1000;
    const third = load({ saved: expired });
    third.api.installArrest();
    const late = third.spawn(PEASANT, "Kath");
    third.fire("playerSpawned", late);
    assert.equal(third.api.isArrested(late), false);
    assert.match(late.chat.at(-1), /A sua pena acabou: você está livre/);
    assert.equal(JSON.parse(third.disk.files.get("playerdata/arrests.json")).arrests[PEASANT], undefined);

    // Handcuffs too come back until their time.
    const cuffed = load({ saved: { v: 1, arrests: { [PEASANT]: { steamId: PEASANT, name: "Kath", kind: "cuffs", by: SOLDIER, byName: "Ivan", byLevel: 6, at: Date.now(), until: Date.now() + 10 * 60_000, pillory: "" } } } });
    cuffed.api.installArrest();
    const again = cuffed.spawn(PEASANT, "Kath");
    cuffed.fire("playerSpawned", again);
    assert.match(again.chat.at(-1), /Você continua preso, de mãos amarradas: faltam até 10 min/);
});

test("what an arrested player's client sends is dropped, but for the few messages that keep it in the game; the others go through", () => {
    const registered = new Map();
    const bus = { onClient: (name, fn) => registered.set(name, fn), on: () => undefined };
    const sut = load({ bus });
    sut.api.installRestraintGate();
    const got = [];
    bus.onClient("kcdc-gamemode:status.propLock", (sender) => got.push(`propLock:${sender.nickname}`));
    bus.onClient("kcdc-gamemode:players.peek", (sender) => got.push(`peek:${sender.nickname}`));
    assert.ok(sut.api.ALLOWED_WHILE_ARRESTED.has("players.peek"));
    assert.ok(!sut.api.ALLOWED_WHILE_ARRESTED.has("status.propLock"));
    assert.ok(!sut.api.ALLOWED_WHILE_ARRESTED.has("trade.accept"));

    const soldier = sut.spawn(SOLDIER, "Ivan");
    const peasant = sut.spawn(PEASANT, "Kath");
    registered.get("kcdc-gamemode:status.propLock")(peasant, {});
    assert.deepEqual(got, ["propLock:Kath"], "nobody is arrested: it passes");

    assert.equal(sut.api.arrest(soldier, peasant, NOW).ok, true);
    registered.get("kcdc-gamemode:status.propLock")(peasant, {});
    registered.get("kcdc-gamemode:players.peek")(peasant, {});
    registered.get("kcdc-gamemode:status.propLock")(soldier, {});
    assert.deepEqual(got, ["propLock:Kath", "peek:Kath", "propLock:Ivan"], "the prisoner's lock press is dropped; the peek and the officer's pass");
});

test("the officers are told of the pillories, and a prisoner is told again of the hold; a player with no power is told of none", () => {
    const sut = load();
    sut.api.installArrest();
    const tellTimer = sut.intervals.find((entry) => entry.ms === 4_000);
    const soldier = sut.spawn(SOLDIER, "Ivan");
    const peasant = sut.spawn(PEASANT, "Kath");
    tellTimer.fn();
    const asked = (player) => player.emitted.filter((entry) => entry.event === "kcdc-gamemode:arrest.officer");
    assert.equal(asked(soldier).at(-1).payload.on, true);
    assert.equal(asked(soldier).at(-1).payload.points.length, 6);
    assert.deepEqual(plain(asked(soldier).at(-1).payload.points[0]), { id: "suchdol", ...SPOT }, "the hint stands at the stocks");
    assert.equal(asked(peasant).at(-1).payload.on, false);
    assert.deepEqual(plain(asked(peasant).at(-1).payload.points), []);
    const before = asked(soldier).length;
    tellTimer.fn();
    assert.equal(asked(soldier).length, before, "only when it changes");
    sut.api.arrest(soldier, peasant, NOW);
    const states = () => peasant.emitted.filter((entry) => entry.event === "kcdc-gamemode:arrest.state").length;
    const had = states();
    tellTimer.fn();
    assert.equal(states(), had + 1, "the hold is said again to the prisoner");
});

test("an administrator frees by name, and sees who is held", () => {
    const sut = load();
    const soldier = sut.spawn(SOLDIER, "Ivan");
    const peasant = sut.spawn(PEASANT, "Kath da Silva");
    sut.api.arrest(soldier, peasant, NOW);
    assert.deepEqual(plain(sut.api.prisoners(NOW).map((one) => [one.name, one.kind, one.by, one.online, one.minutes])), [["Kath da Silva", "cuffs", "Ivan", true, 30]]);
    assert.equal(sut.api.releaseByName("   "), 0);
    assert.equal(sut.api.releaseByName("silva"), 1);
    assert.equal(sut.api.isArrested(peasant), false);
    assert.match(peasant.chat.at(-1), /Você está livre\./);
    assert.equal(sut.api.releaseByName("silva"), 0);
});

test("a file that cannot be read is left alone; bad rows are skipped", () => {
    const disk = fakeDisk();
    disk.files.set("playerdata/arrests.json", "x");
    const sut = load({ disk });
    sut.api.installArrest();
    assert.ok(sut.logs.some((line) => /está ilegível e foi deixado como está/.test(line)));
    const soldier = sut.spawn(SOLDIER, "Ivan");
    const peasant = sut.spawn(PEASANT, "Kath");
    sut.api.arrest(soldier, peasant, NOW);
    assert.equal(disk.files.get("playerdata/arrests.json"), "x", "nothing is written over it");

    const odd = load({ saved: { v: 1, arrests: { "": { until: 5 }, [PEASANT]: { steamId: PEASANT, until: "x" }, [PEASANT2]: { steamId: PEASANT2, name: 7, until: NOW + 100, kind: "bogus" } } } });
    odd.api.installArrest();
    assert.deepEqual(plain(odd.api.prisoners(NOW).map((one) => [one.name, one.kind])), [["", "cuffs"]]);
});

test("an arrested player may only speak: the chat commands that move, call, make a gesture or take them to a church answer that they are held; an administrator is never held", () => {
    const sut = load();
    sut.api.installArrest();
    assert.equal(sut.commandGates.length, 1);
    const gate = sut.commandGates[0];
    const soldier = sut.spawn(SOLDIER, "Ivan");
    const peasant = sut.spawn(PEASANT, "Kath");
    const admin = sut.spawn(ADMIN, "Mauro");
    assert.equal(gate(peasant, "preso"), null, "nobody is arrested: every command goes");
    assert.equal(sut.api.arrest(soldier, peasant, NOW).ok, true);
    for (const name of ["preso", "acordar", "cavalo", "carroca", "carroça", "anim", "face", "gesto", "dice", "levantar", "cozinhar", "horta"]) {
        assert.equal(gate(peasant, name), "Você está preso: só pode falar.", `/${name} is refused to a prisoner`);
    }
    for (const name of ["help", "me", "do", "try", "mute", "unmute", "mutes", "idioma", "language", "camera", "admin"]) {
        assert.equal(gate(peasant, name), null, `/${name} is only speaking or reading`);
    }
    assert.equal(gate(soldier, "preso"), null, "the officer is not held");
    sut.api.arrest(admin, soldier, NOW);
    assert.equal(sut.api.isArrested(soldier), true);
    assert.equal(gate(admin, "preso"), null, "an administrator is never held, even if somebody arrested them");
    sut.api.release(admin, peasant);
    assert.equal(gate(peasant, "preso"), null, "freed, the commands are back");
});

// ---------------------------------------------------------------------------------------------
// In the stocks (2026-11-01, user: "tentei colocar um jogador no pelourinho, ele não ficou na posição e preso ao pelourinho").

/** An officer and a prisoner at Suchdol, the prisoner put in the pillory for 15 minutes; `body` adds to the prisoner. */
function sentenced(body = {}) {
    const sut = load();
    const soldier = sut.spawn(SOLDIER, "Ivan", { x: SPOT.x + 1, y: SPOT.y, z: SPOT.z });
    const peasant = sut.spawn(PEASANT, "Kath", { x: SPOT.x + 2, y: SPOT.y, z: SPOT.z });
    Object.assign(peasant, body);
    sut.api.installArrest();
    sut.api.arrest(soldier, peasant, NOW);
    sut.api.openPillory(soldier, "suchdol");
    const [session] = [...sut.sessions][0];
    sut.api.pageChoice(session, soldier, `p:${peasant.id}`);
    sut.api.pageChoice(session, soldier, "t:15");
    return { sut, soldier, peasant };
}
const played = (sut) => plain(sut.animations.filter((entry) => !entry.stop));

test("a man is set at the stocks' own origin, turned as they are, and once his body is there the game's own pose plays in a loop with his movement held", () => {
    const { sut, peasant } = sentenced();
    assert.deepEqual(plain(sut.spawns.at(-1)), { steamId: PEASANT, position: SPOT, heading: -160 });
    assert.deepEqual(played(sut), [], "nothing is played before the body is there");
    assert.deepEqual(plain(sut.api.poseOf(peasant)), { pose: "stocks", phase: "placing" });
    sut.api.tick(Date.now());
    assert.deepEqual(played(sut), [{ steamId: PEASANT, fragment: "Pillory", options: { loop: true, lockMovement: true } }]);
    assert.deepEqual(plain(sut.api.poseOf(peasant)), { pose: "stocks", phase: "on" });
    assert.ok(sut.logs.some((line) => /Kath no pelourinho de Suchdol: preso no tronco \(Pillory; a 0\.00 m do lugar\)/.test(line)), sut.logs.join("\n"));
    sut.api.tick(Date.now());
    assert.equal(played(sut).length, 1, "played once, not at every beat");
    assert.equal(sut.spawns.length, 1, "and not set again while it stays");
});

test("a body that does not come to the stocks is set again after a while, and played where it is once the game has kept it off four times", () => {
    const { sut, peasant } = sentenced();
    const at = Date.now();
    peasant.position = { x: SPOT.x + 3, y: SPOT.y, z: SPOT.z };
    sut.api.tick(at + 1_000);
    assert.equal(sut.spawns.length, 1, "it is given time to arrive");
    sut.api.tick(at + sut.api.ARRIVE_MS + 10);
    assert.equal(sut.spawns.length, 2, "set again");
    for (let n = 1; n <= 6; n += 1) {
        peasant.position = { x: SPOT.x + 3, y: SPOT.y, z: SPOT.z };
        sut.api.tick(at + sut.api.ARRIVE_MS * (n + 1) + 20);
    }
    assert.equal(sut.spawns.length, sut.api.SETTINGS_PER_MINUTE, "four settings in the minute at most");
    assert.deepEqual(played(sut).map((entry) => entry.fragment), ["Pillory"], "the pose holds it where the game left it");
});

test("pushed off the stocks by a blow, the body is set again and the pose played again; a pose cut short is played again at the next beat", () => {
    const { sut, peasant } = sentenced();
    const at = Date.now();
    sut.api.tick(at);
    peasant.position = { x: SPOT.x + 0.8, y: SPOT.y, z: SPOT.z };
    sut.api.tick(at + 1_000);
    assert.equal(sut.spawns.length, 2);
    assert.ok(sut.logs.some((line) => /Kath saiu do lugar no pelourinho de Suchdol \(0\.80 m\): posto de novo/.test(line)));
    sut.api.tick(at + 2_000);
    assert.equal(played(sut).length, 2, "played again once the body is back");

    sut.fire("playerAnimationEnd", peasant, "Pillory", "interrupted");
    assert.deepEqual(plain(sut.api.poseOf(peasant)), { pose: "stocks", phase: "placing" });
    sut.api.tick(at + 3_000);
    assert.equal(played(sut).length, 3, "played again where the body stands");
    sut.fire("playerAnimationEnd", peasant, "Pillory", "replaced");
    sut.fire("playerAnimationEnd", peasant, "SomethingElse", "interrupted");
    sut.fire("playerAnimationEnd", peasant, "Pillory", "stopped");
    assert.deepEqual(plain(sut.api.poseOf(peasant)), { pose: "stocks", phase: "on" }, "a replacement, another fragment or our own stop change nothing");
});

test("a woman kneels beside the stocks, weeping: the game has their pose for men only", () => {
    const { sut, peasant } = sentenced({ appearance: { gender: "female" } });
    assert.deepEqual(plain(sut.spawns.at(-1)), { steamId: PEASANT, position: SIDE, heading: -38 });
    sut.api.tick(Date.now());
    assert.deepEqual(played(sut), [{ steamId: PEASANT, fragment: "CryingKneeling", options: { loop: true, lockMovement: true } }]);
    assert.ok(sut.logs.some((line) => /de joelhos ao lado \(CryingKneeling/.test(line)));
    assert.deepEqual(plain(sut.api.poseOf(peasant)), { pose: "kneel", phase: "on" });
});

test("a pose the game refuses gives way to the beggar's kneel beside the stocks, and that to the old leash", () => {
    const { sut, peasant } = sentenced();
    sut.api.tick(Date.now());
    sut.fire("playerAnimationEnd", peasant, "Pillory", "refused");
    assert.deepEqual(plain(sut.api.poseOf(peasant)), { pose: "beg", phase: "placing" });
    assert.deepEqual(plain(sut.spawns.at(-1)), { steamId: PEASANT, position: SIDE, heading: -38 }, "out of the stocks, beside them");
    assert.ok(sut.logs.some((line) => /o jogo recusou a pose \(Pillory\); fica de joelhos, como um mendigo/.test(line)));
    sut.api.tick(Date.now());
    assert.deepEqual(played(sut).at(-1), { steamId: PEASANT, fragment: "Beggar", options: { tags: "beggarKneel", loop: true, lockMovement: true } });

    peasant.animationRefused = true;
    sut.fire("playerAnimationEnd", peasant, "Beggar", "refused");
    assert.deepEqual(plain(sut.api.poseOf(peasant)), { pose: "leash", phase: "placing" });
    sut.api.tick(Date.now());
    assert.deepEqual(plain(sut.api.poseOf(peasant)), { pose: "leash", phase: "on" });
    peasant.position = { x: SIDE.x + 5, y: SIDE.y, z: SIDE.z };
    const before = sut.spawns.length;
    sut.api.tick(Date.now());
    assert.equal(sut.spawns.length, before + 1, "the leash pulls the body back as before, with no limit");

    const refusing = sentenced({ animationRefused: true });
    refusing.sut.api.tick(Date.now());
    assert.deepEqual(plain(refusing.sut.api.poseOf(refusing.peasant)), { pose: "beg", phase: "placing" }, "a request that does not go out gives way at once");
});

test("let out, the pose ends and the body steps out of the stocks beside them; a prisoner freed while away steps out at the entry", () => {
    const { sut, soldier, peasant } = sentenced();
    sut.api.tick(Date.now());
    assert.match(sut.api.release(soldier, peasant).message, /Kath foi solto do pelourinho\./);
    assert.deepEqual(plain(sut.animations.at(-1)), { steamId: PEASANT, stop: true, options: { standUp: true } });
    assert.deepEqual(plain(sut.spawns.at(-1)), { steamId: PEASANT, position: SIDE, heading: -38 });
    assert.equal(sut.api.poseOf(peasant), null);
    const settled = sut.spawns.length;
    sut.api.tick(Date.now());
    assert.equal(sut.spawns.length, settled, "nothing holds a free body");

    // Freed while away, back at the stocks where they logged out.
    const saved = { v: 1, arrests: { [PEASANT]: { steamId: PEASANT, name: "Kath", kind: "pillory", by: SOLDIER, byName: "Ivan", byLevel: 6, at: Date.now() - 60_000, until: Date.now() - 1_000, pillory: "suchdol" } } };
    const later = load({ saved });
    later.api.installArrest();
    const back = later.spawn(PEASANT, "Kath", { ...SPOT });
    later.fire("playerSpawned", back);
    assert.equal(later.api.isArrested(back), false);
    assert.deepEqual(plain(later.spawns.at(-1)), { steamId: PEASANT, position: SIDE, heading: -38 }, "stepped out of the stocks");
});

test("a body the game will not spawn there is teleported instead; a player who leaves takes their hold with them", () => {
    const { sut, peasant } = sentenced({ spawnRefused: true });
    assert.deepEqual(plain(sut.teleports.at(-1)), { steamId: PEASANT, position: SPOT });
    sut.fire("playerDisconnect", peasant);
    assert.equal(sut.api.poseOf(peasant), null);
});

test("every pillory is the level's stocks, with a heading, and a spot on its own ground beside them, two metres or so away", () => {
    const sut = load();
    assert.equal(sut.api.PILLORIES.length, 6);
    for (const place of sut.api.PILLORIES) {
        assert.ok(Number.isFinite(place.heading) && Math.abs(place.heading) <= 180, place.id);
        const apart = Math.hypot(place.side.x - place.x, place.side.y - place.y);
        assert.ok(apart >= 1.3 && apart <= 2.4, `${place.id}: ${apart.toFixed(2)} m`);
        assert.ok(Math.abs(place.side.z - place.z) < 0.5, place.id);
    }
});

test("handcuffs hold the body in the game's tied pose, still: a man stands with his hands tied behind him, a woman sits tied; a pose ended is asked again, a refused one is not (2026-11-01)", () => {
    const sut = load();
    const soldier = sut.spawn(SOLDIER, "Ivan");
    const peasant = sut.spawn(PEASANT, "Kath", { x: 2, y: 0, z: 0 });
    sut.api.arrest(soldier, peasant, NOW);
    sut.api.tick(NOW + 1_000);
    assert.deepEqual(plain(sut.animations.filter((entry) => !entry.stop).at(-1)), { steamId: PEASANT, fragment: "Tied", options: { loop: true, lockMovement: true } });
    const count = sut.animations.filter((entry) => !entry.stop).length;
    sut.api.tick(NOW + 5_000);
    assert.equal(sut.animations.filter((entry) => !entry.stop).length, count, "not again while it plays");
    sut.api.animationEnded(peasant, "Tied", "interrupted", NOW + 5_000);
    sut.api.tick(NOW + 6_500);
    assert.equal(sut.animations.filter((entry) => !entry.stop).length, count + 1, "played again once it ended");
    sut.api.animationEnded(peasant, "Tied", "refused", NOW + 7_000);
    sut.api.tick(NOW + 20_000);
    assert.equal(sut.animations.filter((entry) => !entry.stop).length, count + 1, "a refused pose is not asked again");
    assert.deepEqual(plain(sut.api.cuffsPose({ appearance: { gender: "female" } })), { fragment: "TiedUpIdle_Slave", tags: "sit" });
});

test("an officer leads a prisoner in handcuffs: the tied pose ends, the walk keys come back, and one who falls behind is brought to his side; Parar de conduzir holds him still again (2026-11-01)", () => {
    const sut = load();
    const soldier = sut.spawn(SOLDIER, "Ivan");
    const peasant = sut.spawn(PEASANT, "Kath", { x: 2, y: 0, z: 0 });
    sut.api.arrest(soldier, peasant, NOW);
    sut.api.tick(NOW + 1_000);
    assert.match(sut.api.choose(soldier, peasant, "escort"), /Você está conduzindo Kath/);
    assert.equal(sut.api.isEscorted(peasant), true);
    assert.deepEqual(plain(sut.api.menuOptions(soldier, peasant)).map((option) => option.id), ["release", "unescort"]);
    assert.equal(plain(lastState(peasant)).payload.still, false, "his walk keys come back");
    assert.ok(sut.animations.some((entry) => entry.stop && entry.steamId === PEASANT), "the tied pose ends");
    // He falls behind: brought to the officer's side.
    peasant.position = { x: 20, y: 0, z: 0 };
    sut.api.tick(NOW + 2_000);
    const put = plain(sut.spawns.at(-1));
    assert.equal(put.steamId, PEASANT);
    assert.ok(Math.abs(Math.hypot(put.position.x - soldier.position.x, put.position.y - soldier.position.y) - 1.5) < 1e-6, "a step and a half from him");
    // Let go: still again, and the pose comes back at the next beat.
    assert.match(sut.api.choose(soldier, peasant, "unescort"), /Você parou de conduzir Kath/);
    assert.equal(plain(lastState(peasant)).payload.still, true);
    const before = sut.animations.filter((entry) => !entry.stop).length;
    sut.api.tick(NOW + 3_000);
    assert.equal(plain(sut.animations.filter((entry) => !entry.stop).at(-1)).fragment, "Tied");
    assert.equal(sut.animations.filter((entry) => !entry.stop).length, before + 1);
});

test("in the pillory, a body that walked off its place is put back every time, whatever the count of the minute (2026-11-01: \"o jogador consegue sair andando\")", () => {
    const { sut, peasant } = sentenced();
    const place = { x: SPOT.x, y: SPOT.y, z: SPOT.z };
    const start = Date.now();
    peasant.position = { x: place.x, y: place.y, z: place.z };
    sut.api.tick(start);
    assert.equal(sut.api.poseOf(peasant).phase, "on");
    let t = start + 1_000;
    let puts = 0;
    for (let walk = 0; walk < 8; walk += 1) {
        // He walks five metres off; the server puts him back; the pose is played again.
        peasant.position = { x: place.x + 5, y: place.y, z: place.z };
        const before = sut.spawns.length;
        sut.api.tick(t);
        puts += sut.spawns.length - before;
        peasant.position = { x: place.x, y: place.y, z: place.z };
        t += 1_000;
        sut.api.tick(t);
        t += 1_000;
    }
    assert.equal(puts, 8, "eight walks in less than a minute, eight times put back");
    assert.equal(sut.api.WALKED_OFF_M, 1.2);
});

// Sytzigan o Velho (2026-11-06, "ficou bugado algemado infinito"): the tied pose is a loop with the body locked; the game starts it again by itself when it cuts it short, while the module's `playing`
// was false until the next beat, so a prisoner freed in that second was never told to stop. Marek Havran arrested, led and freed him in seconds, over and over.

test("a prisoner freed while the module thinks the tied pose is not playing (it was cut short a moment ago) is told to stop all the same, and once more a moment later", () => {
    const sut = load();
    const soldier = sut.spawn(SOLDIER, "Marek");
    const peasant = sut.spawn(PEASANT, "Sytzigan", { x: 2, y: 0, z: 0 });
    sut.api.arrest(soldier, peasant, NOW);
    sut.api.tick(NOW + 1_000);
    const stops = () => sut.animations.filter((entry) => entry.stop && entry.steamId === PEASANT).length;
    assert.equal(stops(), 0);
    // The game cuts the pose short; it starts the loop again by itself, and the module waits for its next beat to ask.
    sut.api.animationEnded(peasant, "Tied", "interrupted", NOW + 1_500);
    // Freed in that second.
    assert.match(sut.api.release(soldier, peasant).message, /foi solto/);
    assert.equal(stops(), 1, "told to stop although `playing` was false");
    assert.equal(plain(lastState(peasant)).payload.on, false, "and the client told it is free");
    sut.api.tick(NOW + 2_000);
    assert.equal(stops(), 1, "not yet");
    // The module counts the moment by the real clock, as everything it does at the release (`Date.now`); the beat is given a time after it.
    sut.api.tick(Date.now() + sut.api.STOP_AGAIN_MS + 100);
    assert.equal(stops(), 2, "once more a moment later, for a pose the game had not started when the first came");
    sut.api.tick(Date.now() + 60_000);
    assert.equal(stops(), 2, "and no more");
});

test("the second stop is not sent to somebody arrested again in the meantime, and a pillory prisoner's release is as it was", () => {
    const sut = load();
    const soldier = sut.spawn(SOLDIER, "Marek");
    const peasant = sut.spawn(PEASANT, "Sytzigan", { x: 2, y: 0, z: 0 });
    sut.api.arrest(soldier, peasant, NOW);
    sut.api.tick(NOW + 1_000);
    sut.api.release(soldier, peasant);
    const stops = () => sut.animations.filter((entry) => entry.stop && entry.steamId === PEASANT).length;
    const first = stops();
    sut.api.arrest(soldier, peasant, NOW + 1_200);
    sut.api.tick(Date.now() + sut.api.STOP_AGAIN_MS + 100);
    assert.equal(stops(), first, "arrested again: the pending stop is dropped, the pose is not cut");
});

test("an administrator unsticks a player the server does not hold but whose game does: /presos soltar finds them by the character's name or the account's", () => {
    const sut = load();
    const stuck = sut.spawn(PEASANT, "Ludmilla", { x: 2, y: 0, z: 0 });
    const before = sut.animations.length;
    assert.deepEqual(plain(sut.api.unstickByName("ludm")), ["Ludmilla"]);
    assert.ok(sut.animations.slice(before).some((entry) => entry.stop && entry.steamId === PEASANT), "the pose is stopped");
    assert.equal(plain(lastState(stuck)).payload.on, false, "the client is told it is free");
    assert.ok(sut.modes.some((entry) => entry.steamId === PEASANT && entry.mode.walkEnforced === false), "the walking pace is given back");
    assert.deepEqual(plain(sut.api.unstickByName("ninguem")), []);
    assert.deepEqual(plain(sut.api.unstickByName("  ")), [], "nothing for an empty query");

    // Somebody the server does hold is not 'unstuck': the plain release is for them.
    const soldier = sut.spawn(SOLDIER, "Marek");
    const held = sut.spawn(PEASANT2, "Pavel", { x: 1, y: 0, z: 0 });
    assert.equal(sut.api.arrest(soldier, held, NOW).ok, true);
    assert.deepEqual(plain(sut.api.unstickByName("pavel")), [], "a prisoner is freed by releaseByName, not unstuck");
    assert.equal(sut.api.releaseByName("pavel"), 1);
});
