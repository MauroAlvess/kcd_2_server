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
    };
    vm.runInNewContext(dist("arrest.js"), sandbox);

    const spawn = (steamId, nickname, position = { x: 0, y: 0, z: 0 }) => {
        const player = {
            id: nextId++, steamId, nickname, ready: true, alive: true, virtualWorld: 0, position: { ...position }, chat: [], emitted: [],
            emit(event, payload) { this.emitted.push({ event, payload: JSON.parse(payload) }); },
            setMovementMode(mode) { modes.push({ steamId, mode: { ...mode } }); return true; },
            dismount() { return null; },
            teleport(position) { teleports.push({ steamId, position: { ...position } }); this.position = { x: position.x, y: position.y, z: position.z }; return true; },
        };
        players.push(player);
        return player;
    };
    const fire = (name, ...args) => (handlers.get(name) ?? []).forEach((fn) => fn(...args));
    return { api: sandbox.exports, nobility: nobility.exports, disk, titles, statuses, admins, players, spawn, fire, handlers, clientHandlers, intervals, logs, sessions, modes, teleports, commandGates, sandbox };
}

const SPOT = { x: 573.72, y: 3254.48, z: 148.74 };
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
    assert.deepEqual(plain(lastState(peasant)), { event: "kcdc-gamemode:arrest.state", payload: { on: true, kind: "cuffs", until: NOW + 30 * 60_000 } });
    assert.match(peasant.chat.at(-1), /Ivan prendeu você\. As suas mãos estão algemadas: você só pode andar e falar/);
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
    assert.deepEqual(plain(sut.api.menuOptions(guard, peasant)), [{ id: "release", text: "Soltar", enabled: true }], "a guard is at the soldier's level: no lower than the one who arrested");
    assert.deepEqual(plain(sut.api.menuOptions(soldier, peasant)), [{ id: "release", text: "Soltar", enabled: true }]);
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
    assert.deepEqual(plain(sut.teleports.at(-1)), { steamId: PEASANT, position: SPOT });
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

    peasant.position = { x: SPOT.x + 9, y: SPOT.y, z: SPOT.z };
    sut.api.tick(Date.now());
    assert.deepEqual(plain(sut.teleports.at(-1)), { steamId: PEASANT, position: SPOT }, "put back at the pillory");

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
    assert.deepEqual(plain(second.teleports.at(-1)), { steamId: PEASANT, position: SPOT }, "set at the pillory again");
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
    assert.match(again.chat.at(-1), /Você continua preso, de mãos algemadas: faltam até 10 min/);
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
    assert.deepEqual(plain(asked(soldier).at(-1).payload.points[0]), { id: "suchdol", x: 573.72, y: 3254.48, z: 148.74 });
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
    for (const name of ["preso", "acordar", "cavalo", "carroca", "carroça", "anim", "face", "gesto", "dice", "levantar", "alforje", "cozinhar", "horta"]) {
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
