const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const MAURO = "76561198000000001";
const HANS = "76561198000000002";

function fakeDisk(seed) {
    const files = new Map(seed === undefined ? [] : [["playerdata/horses.json", JSON.stringify(seed)]]);
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

/** A tiny horse world: Horse.spawn makes one, giveTo raises horseOwnerChanged like the framework does. */
function load({ seed, admins = [] } = {}) {
    const disk = fakeDisk(seed);
    const storeSandbox = { exports: {}, require: () => disk.fs };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/store.js"), "utf8"), storeSandbox);

    const handlers = new Map();
    const clientHandlers = new Map();
    const players = new Map();
    const horses = new Map();
    const intervals = [];
    const timeouts = [];
    const chat = [];
    const logs = [];
    let nextId = 500;

    const fire = (name, ...args) => handlers.get(name)?.(...args);
    const makeHorse = ({ position = { x: 0, y: 0, z: 0 }, soul = "soul-pebbles", name = "", gear = { saddle: null, head: null, torso: null, shoe: null }, yaw = 0 } = {}) => {
        const horse = {
            id: nextId++,
            soul,
            name,
            gear: { ...gear },
            position: { ...position },
            rotation: { x: 0, y: 0, z: yaw },
            owner: null,
            ownerId: 0,
            alive: true,
            /** KCDC 1.7.0: a player's own horse is knocked out where a death would be; `immortal` makes the stub's kill do that too. */
            unconscious: false,
            immortal: false,
            killed: 0,
            mounted: false,
            rider: null,
            riderId: 0,
            destroyWithOwner: true,
            moves: [],
            kill() {
                if (!this.alive) return false;
                this.killed += 1;
                if (this.immortal) { this.unconscious = true; return true; }
                this.alive = false;
                fire("horseDeath", this, null, "scripted");
                return true;
            },
            revive() {
                if (this.alive) return false;
                this.alive = true;
                this.unconscious = false;
                return true;
            },
            giveTo(player) {
                if (player !== null && player.connected === false) throw new Error("not connected");
                this.owner = player;
                this.ownerId = player ? player.id : 0;
                fire("horseOwnerChanged", this, player);
            },
            moveTo(target, options) { this.moves.push({ target, options }); return true; },
            destroy() { horses.delete(this.id); fire("horseDestroy", this); },
        };
        horses.set(horse.id, horse);
        return horse;
    };
    const spawned = [];
    const context = {
        exports: {},
        require: (id) => {
            if (id === "./store.js") return storeSandbox.exports;
            if (id === "./auth.js" || id === "../auth.js") return { isAdmin: (player) => admins.includes(player.steamId) };
            if (id === "./position.js") return { yawOf: (rotation) => rotation.z };
            if (id === "../horses.js") return context.exports;
            assert.fail(`unexpected require ${id}`);
        },
        console: { log: (line) => logs.push(line), error: (line) => logs.push(line) },
        setInterval: (fn, ms) => { intervals.push({ fn, ms }); return intervals.length; },
        clearInterval() {},
        setTimeout: (fn, ms) => { timeouts.push({ fn, ms }); return timeouts.length; },
        Vector3: class { constructor(x, y, z) { this.x = x; this.y = y; this.z = z; } },
        Chat: { sendToPlayer: (player, text) => chat.push(text) },
        Events: { on: (name, fn) => handlers.set(name, fn), onClient: (name, fn) => clientHandlers.set(name, fn) },
        Navigation: {
            ready: true,
            findPath: (from, to) => ({ points: [from, { x: (from.x + to.x) / 2, y: from.y, z: from.z }, to], complete: true, length: Math.hypot(to.x - from.x, to.y - from.y) }),
        },
        Player: { getById: (id) => players.get(id) ?? null, all: () => [...players.values()] },
        Horse: {
            spawn: (position, rotation, soul, name, gear) => {
                spawned.push({ position, rotation, soul, name, gear });
                const horse = makeHorse({ position, soul, name, gear: { saddle: null, head: null, torso: null, shoe: null, ...gear }, yaw: rotation.z });
                return horse;
            },
            all: () => [...horses.values()],
            getById: (id) => horses.get(id) ?? null,
        },
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/horses.js"), "utf8"), context);
    context.exports.installHorses();

    const notices = [];
    /** Who was told of somebody's whistle (2026-10-22): [listener id, whistler id]. */
    const heard = [];
    const player = (steamId, nickname, id, position = { x: 0, y: 0, z: 0 }) => {
        const made = {
            steamId, nickname, id, position, connected: true, ready: true, virtualWorld: 0,
            emit: (event, payload) => {
                if (event === "kcdc-gamemode:whistle.heard") heard.push([id, JSON.parse(payload).id]);
                else notices.push({ to: id, event, text: JSON.parse(payload).text });
            },
        };
        players.set(id, made);
        return made;
    };
    return {
        api: context.exports, context, disk, handlers, clientHandlers, horses, intervals, timeouts, chat, logs, notices, heard, spawned, fire, makeHorse, player,
        saved: () => JSON.parse(disk.files.get("playerdata/horses.json")).horses,
    };
}

function loadCommand(sut) {
    const sandbox = { exports: {}, require: sut.context.require, console: { log() {} } };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/commands/cavalo.js"), "utf8"), sandbox);
    return (player, args) => {
        const replies = [];
        let usage = 0;
        sandbox.exports.cavaloCommand.run({ player, args, reply: { line: (t) => replies.push(t), lines: (ls) => replies.push(...ls) }, usage: () => { usage += 1; } });
        return { replies, usage };
    };
}

test("a horse given to a player is filed, with its breed, name, gear and place, and stays when they leave", () => {
    const sut = load();
    const mauro = sut.player(MAURO, "Mauro", 1);
    const horse = sut.makeHorse({ position: { x: 10, y: 20, z: 30 }, name: "Trovão", gear: { saddle: "saddle_a", head: null, torso: null, shoe: "shoe_a" }, yaw: 90 });
    horse.giveTo(mauro);

    assert.equal(horse.destroyWithOwner, false, "it waits for its owner instead of going with them");
    const [record] = sut.saved();
    assert.equal(record.owner, MAURO);
    assert.equal(record.ownerName, "Mauro");
    assert.equal(record.soul, "soul-pebbles");
    assert.equal(record.name, "Trovão");
    assert.deepEqual(record.gear, { saddle: "saddle_a", head: null, torso: null, shoe: "shoe_a" });
    assert.deepEqual([record.x, record.y, record.z, record.yaw], [10, 20, 30, 90]);

    // The owner leaves: the framework hands the horse to nobody, and the record stays.
    horse.giveTo(null);
    assert.equal(sut.saved().length, 1);
    assert.equal(sut.saved()[0].owner, MAURO);
});

test("after a restart every saved horse is back where it was left, and is its owner's again when they come in", () => {
    const first = load();
    const mauro = first.player(MAURO, "Mauro", 1);
    const horse = first.makeHorse({ position: { x: 5, y: 6, z: 7 }, name: "Trovão", gear: { saddle: "saddle_a", head: "bridle_a", torso: null, shoe: null }, yaw: 45 });
    horse.giveTo(mauro);
    const seed = JSON.parse(first.disk.files.get("playerdata/horses.json"));

    const sut = load({ seed });
    assert.equal(sut.spawned.length, 1);
    const [made] = sut.spawned;
    assert.deepEqual([made.position.x, made.position.y, made.position.z], [5, 6, 7]);
    assert.equal(made.rotation.z, 45);
    assert.equal(made.soul, "soul-pebbles");
    assert.equal(made.name, "Trovão");
    assert.deepEqual(JSON.parse(JSON.stringify(made.gear)), { saddle: "saddle_a", head: "bridle_a" }, "an empty slot is left out");
    const live = [...sut.horses.values()][0];
    assert.equal(live.destroyWithOwner, false);
    assert.equal(live.owner, null, "nobody's until the owner comes in");
    assert.ok(sut.logs.some((line) => /1 cavalo\(s\) com dono guardado\(s\); 1 de volta ao mundo/.test(line)));

    const back = sut.player(MAURO, "Mauro", 9);
    sut.fire("playerSpawned", back);
    assert.equal(live.owner, back);
    assert.equal(sut.saved().length, 1, "the same horse, not a second one");
});

test("nobody but the owner (or an administrator) may ride a kept horse; a free horse is free", () => {
    const sut = load({ admins: ["76561198000000099"] });
    const mauro = sut.player(MAURO, "Mauro", 1);
    const hans = sut.player(HANS, "Hans", 2);
    const admin = sut.player("76561198000000099", "Admin", 3);
    const horse = sut.makeHorse();
    horse.giveTo(mauro);

    assert.equal(sut.fire("horseMounting", horse, hans), false);
    assert.match(sut.chat.at(-1), /pertence a Mauro/);
    assert.equal(sut.fire("horseMounting", horse, mauro), undefined);
    assert.equal(sut.fire("horseMounting", horse, admin), undefined);

    const wild = sut.makeHorse();
    assert.equal(sut.fire("horseMounting", wild, hans), undefined);
});

test("where it was left is written when its rider gets off, and when its gear changes", () => {
    const sut = load();
    const horse = sut.makeHorse();
    horse.giveTo(sut.player(MAURO, "Mauro", 1));
    horse.position = { x: 100, y: 200, z: 3 };
    sut.fire("horseDismount", horse, null);
    assert.deepEqual([sut.saved()[0].x, sut.saved()[0].y], [100, 200]);

    horse.gear = { saddle: "saddle_b", head: null, torso: null, shoe: null };
    sut.fire("horseGearChanged", horse, null, horse.gear);
    assert.equal(sut.saved()[0].gear.saddle, "saddle_b");
});

test("a horse that dies is forgotten, as in the game", () => {
    const sut = load();
    const horse = sut.makeHorse({ name: "Trovão" });
    horse.giveTo(sut.player(MAURO, "Mauro", 1));
    sut.fire("horseDeath", horse, null, "combat");
    assert.deepEqual(sut.saved(), []);
    assert.ok(sut.logs.some((line) => /Trovão de Mauro morreu/.test(line)));
});

test("a kept horse that is knocked out is dead for good after two looks: gone from its owner's animals, its alforjes lost, made nobody's and killed (2026-10-25)", () => {
    const sut = load();
    const lost = [];
    sut.api.horseLost.push((record, horse) => lost.push([record.name, horse.id]));
    const mauro = sut.player(MAURO, "Mauro", 1);
    const horse = sut.makeHorse({ name: "Trovão" });
    horse.giveTo(mauro);
    assert.equal(sut.intervals[1].ms, sut.api.KNOCKOUT_LOOK_MS, "looked at once a second");

    horse.unconscious = true;
    sut.intervals[1].fn();
    assert.equal(sut.saved().length, 1, "one look is not enough");
    assert.equal(horse.killed, 0);

    sut.intervals[1].fn();
    assert.deepEqual(sut.saved(), [], "the record is gone, so is the line in Animais");
    assert.deepEqual(lost, [["Trovão", horse.id]], "its alforjes are handled like a dead horse's");
    assert.equal(horse.owner, null, "nobody's from now on");
    assert.equal(horse.killed, 1);
    assert.equal(horse.alive, false);
    assert.ok(sut.logs.some((line) => /o cavalo Trovão de Mauro ficou desacordado e morre de vez/.test(line)));
    assert.equal(sut.logs.filter((line) => /de Mauro morreu/.test(line)).length, 0, "and the death that follows its own kill is not handled twice");
    assert.ok(sut.notices.some((notice) => notice.to === 1 && /Seu cavalo Trovão morreu/.test(notice.text)), "the owner is told");

    sut.timeouts[0].fn();
    assert.ok(sut.horses.has(horse.id), "a horse that died stays where it fell");
    sut.intervals[1].fn();
    assert.equal(horse.killed, 1, "and is not killed again");
});

test("a horse the game keeps alive when it is killed is taken out of the world a few seconds later, and is not filed again meanwhile", () => {
    const sut = load();
    const horse = sut.makeHorse({ name: "Relâmpago" });
    horse.giveTo(sut.player(MAURO, "Mauro", 1));
    horse.immortal = true;
    horse.unconscious = true;
    // The owner's connection is gone: the horse stays his in the game's eyes.
    horse.giveTo = () => { throw new Error("not connected"); };
    horse.owner = sut.player(MAURO, "Mauro", 1);
    sut.intervals[1].fn();
    sut.intervals[1].fn();
    assert.deepEqual(sut.saved(), []);
    assert.equal(horse.alive, true, "the game would not let it die");
    assert.equal(sut.timeouts.at(-1).ms, sut.api.KNOCKOUT_FINISH_MS);

    sut.intervals[0].fn();
    assert.deepEqual(sut.saved(), [], "the minute tick does not file it again while it is being finished");

    sut.timeouts.at(-1).fn();
    assert.equal(sut.horses.has(horse.id), false, "taken out of the world");
    assert.ok(sut.logs.some((line) => /o jogo manteve Relâmpago vivo/.test(line)));
});

test("a horse that gets up before the second look is not lost, and a horse nobody keeps is left to the game", () => {
    const sut = load();
    const kept = sut.makeHorse({ name: "Trovão" });
    kept.giveTo(sut.player(MAURO, "Mauro", 1));
    const stray = sut.makeHorse({ name: "Solto" });
    kept.unconscious = true;
    stray.unconscious = true;
    sut.intervals[1].fn();
    kept.unconscious = false;
    sut.intervals[1].fn();
    kept.unconscious = true;
    sut.intervals[1].fn();
    assert.equal(sut.saved().length, 1, "the count starts again when it is up");
    assert.equal(kept.killed, 0);
    assert.equal(stray.killed, 0, "nobody keeps it");
    sut.intervals[1].fn();
    sut.intervals[1].fn();
    assert.equal(stray.killed, 0);
    assert.equal(stray.alive, true);
    assert.deepEqual(sut.saved(), []);
});

test("a horse removed for good is forgotten, but stopping the resource keeps every record", () => {
    const sut = load();
    const a = sut.makeHorse({ name: "A" });
    a.giveTo(sut.player(MAURO, "Mauro", 1));
    const b = sut.makeHorse({ name: "B" });
    b.giveTo(sut.player(HANS, "Hans", 2));

    a.destroy();
    assert.deepEqual(sut.saved().map((r) => r.name), ["B"]);

    sut.fire("resourceStop", "kcdc-gamemode");
    assert.deepEqual(sut.saved().map((r) => r.name), ["B"], "the horse was taken away for the restart, its record stays");
    assert.equal(sut.horses.size, 0);
});

test("giving a kept horse to someone else moves it to them", () => {
    const sut = load();
    const horse = sut.makeHorse();
    horse.giveTo(sut.player(MAURO, "Mauro", 1));
    horse.giveTo(sut.player(HANS, "Hans", 2));
    assert.equal(sut.saved().length, 1);
    assert.equal(sut.saved()[0].owner, HANS);
    assert.equal(sut.saved()[0].ownerName, "Hans");
});

test("a player without a Steam id is not filed", () => {
    const sut = load();
    const horse = sut.makeHorse();
    horse.giveTo(sut.player("", "Ninguem", 1));
    assert.equal(sut.disk.files.has("playerdata/horses.json"), false);
});

test("the minute tick files an owned horse that slipped past the event, and keeps positions current", () => {
    const sut = load();
    const horse = sut.makeHorse({ name: "Revivido" });
    horse.owner = sut.player(MAURO, "Mauro", 1);
    horse.ownerId = 1;
    sut.intervals[0].fn();
    assert.equal(sut.saved()[0].name, "Revivido");
    assert.equal(horse.destroyWithOwner, false);

    horse.position = { x: 9, y: 9, z: 9 };
    sut.intervals[0].fn();
    assert.equal(sut.saved()[0].x, 9);
});

test("/cavalo tells the owner where their horse is, and calls it when it is near enough", () => {
    const sut = load();
    const run = loadCommand(sut);
    const mauro = sut.player(MAURO, "Mauro", 1, { x: 0, y: 0, z: 0 });
    const horse = sut.makeHorse({ position: { x: 0, y: 120, z: 0 }, name: "Trovão" });
    horse.giveTo(mauro);

    assert.match(run(mauro, []).replies[0], /Trovão: a 120 m, a norte/);
    const called = run(mauro, ["chamar"]);
    assert.match(called.replies[0], /vem correndo \(120 m\)/);
    assert.equal(horse.moves.at(-1).options.speed, "run");

    horse.position = { x: 500, y: 0, z: 0 };
    assert.match(run(mauro, ["chamar"]).replies[0], /longe demais.*a leste/);

    const hans = sut.player(HANS, "Hans", 2);
    assert.match(run(hans, []).replies[0], /não tem cavalo/);
});

test("a call is written to the log with its route, and how it ended", () => {
    const sut = load();
    const mauro = sut.player(MAURO, "Mauro", 1, { x: 0, y: 0, z: 0 });
    const horse = sut.makeHorse({ position: { x: 0, y: 80, z: 0 }, name: "Carpiado" });
    horse.giveTo(mauro);

    assert.equal(sut.api.callHorse(mauro, null).ok, true);
    assert.ok(sut.logs.some((line) => /Mauro chamou Carpiado a 80 m; rota de 3 cantos, 80 m/.test(line)), sut.logs.join(" | "));

    sut.api.callEnded(horse, "reached");
    assert.ok(sut.logs.some((line) => /Carpiado terminou o chamado \(reached\)/.test(line)));
    sut.api.callEnded(horse, "blocked");
    assert.equal(horse.moves.length, 1, "a call already over is not sent on again");
});

test("a horse stuck on the way is sent on again from where it stands, twice, and then the owner is told to fetch it", () => {
    const sut = load();
    const mauro = sut.player(MAURO, "Mauro", 1, { x: 0, y: 0, z: 0 });
    const horse = sut.makeHorse({ position: { x: 0, y: 80, z: 0 }, name: "Carpiado" });
    horse.giveTo(mauro);
    const later = [];
    const schedule = (fn, ms) => later.push({ fn, ms });

    sut.api.callHorse(mauro, null);
    for (let attempt = 1; attempt <= 2; attempt += 1) {
        horse.position = { x: 0, y: 80 - attempt * 10, z: 0 };
        sut.api.callEnded(horse, "blocked", schedule);
        assert.equal(later.length, attempt);
        mauro.position = { x: attempt, y: 0, z: 0 };
        later.at(-1).fn();
        assert.equal(horse.moves.length, 1 + attempt);
        assert.deepEqual({ ...horse.moves.at(-1).target }, { x: attempt, y: 0, z: 0 }, "to where the owner is now");
    }

    sut.api.callEnded(horse, "failed", schedule);
    assert.equal(later.length, 2, "no third try");
    assert.match(sut.notices.at(-1).text, /Carpiado ficou preso no caminho, a norte\. Vá até ele\./);
});

test("X, the game's whistle, calls the nearest horse; a rider, or a player with no horse, hears nothing back", () => {
    const sut = load();
    const whistle = sut.clientHandlers.get("kcdc-gamemode:horse.whistle");
    const mauro = sut.player(MAURO, "Mauro", 1, { x: 0, y: 0, z: 0 });
    const hans = sut.player(HANS, "Hans", 2, { x: 5, y: 0, z: 0 });
    const horse = sut.makeHorse({ position: { x: 0, y: 40, z: 0 }, name: "Carpiado" });
    horse.giveTo(mauro);

    whistle(mauro);
    assert.equal(horse.moves.length, 1);
    assert.match(sut.notices.at(-1).text, /Carpiado vem correndo \(40 m\)/);

    whistle(hans);
    assert.equal(sut.notices.filter((notice) => notice.to === 2).length, 0, "no horse of his: only the game's whistle");

    sut.api.whistle(mauro, Date.now() + 10_000);
    assert.equal(horse.moves.length, 2);
    sut.api.whistle(mauro, Date.now() + 10_500);
    assert.equal(horse.moves.length, 2, "one whistle every two seconds");

    horse.riderId = 1;
    horse.mounted = true;
    const before = sut.notices.length;
    sut.api.whistle(mauro, Date.now() + 20_000);
    assert.equal(sut.notices.length, before, "riding his own horse: nothing to call");

    // Another horse, or a cart's seat: the key is only the game's.
    horse.riderId = 0;
    horse.mounted = false;
    mauro.horse = { id: 99 };
    sut.api.whistle(mauro, Date.now() + 30_000);
    assert.equal(sut.notices.length, before, "on somebody else's horse: nothing to call");
    mauro.horse = null;
    sut.api.whistle(mauro, Date.now() + 40_000);
    assert.equal(sut.notices.length, before + 1, "on foot again: the horse comes");
});

// 2026-10-22: "tem como colocar para os jogadores escutarem o assobio quando um jogador aperta X".

test("a whistle is told to the players near the whistler, whether the whistler has a horse or not, and to nobody far, in another world, or riding", () => {
    const sut = load();
    const whistle = sut.clientHandlers.get("kcdc-gamemode:horse.whistle");
    const mauro = sut.player(MAURO, "Mauro", 1, { x: 0, y: 0, z: 0 });
    const hans = sut.player(HANS, "Hans", 2, { x: 12, y: 0, z: 0 });
    sut.player("76561198000000005", "Longe", 3, { x: 80, y: 0, z: 0 });
    const other = sut.player("76561198000000006", "Outro mundo", 4, { x: 3, y: 0, z: 0 });
    other.virtualWorld = 7;

    whistle(hans);
    assert.deepEqual(sut.heard, [[1, 2]], "Hans has no horse, and Mauro, near him, hears the whistle all the same; the far one and the one in another world do not, nor does the whistler");
    sut.heard.length = 0;

    const horse = sut.makeHorse({ position: { x: 0, y: 40, z: 0 }, name: "Carpiado" });
    horse.giveTo(mauro);
    sut.api.whistle(mauro, Date.now() + 10_000);
    assert.deepEqual(sut.heard, [[2, 1]], "and the owner's whistle is heard by Hans, who is 12 m off");
    assert.equal(horse.moves.length, 1, "the horse still comes");
    assert.equal(sut.api.WHISTLE_HEARD_M, 30);

    // Not twice within the two seconds, and not from a saddle.
    sut.heard.length = 0;
    sut.api.whistle(mauro, Date.now() + 10_500);
    assert.deepEqual(sut.heard, []);
    mauro.horse = { id: 99 };
    sut.api.whistle(mauro, Date.now() + 30_000);
    assert.deepEqual(sut.heard, [], "on a horse the key is only the game's");
});

test("/cavalo listar and liberar are for administrators, and a released horse is nobody's", () => {
    const sut = load({ admins: ["76561198000000099"] });
    const run = loadCommand(sut);
    const admin = sut.player("76561198000000099", "Admin", 3);
    const mauro = sut.player(MAURO, "Mauro", 1);
    const horse = sut.makeHorse({ name: "Trovão" });
    horse.giveTo(mauro);

    assert.match(run(mauro, ["listar"]).replies[0], /Só administradores/);
    assert.match(run(admin, ["listar"]).replies[0], /1\. Trovão de Mauro, vivo/);
    assert.match(run(admin, ["liberar", "1"]).replies[0], /agora é de ninguém/);
    assert.deepEqual(sut.saved(), []);
    assert.equal(horse.owner, null);
    assert.equal(run(admin, ["liberar", "7"]).usage, 1);
});

test("an owner may leave a horse free for anybody to mount, and lock it again; nobody else may change it", () => {
    const sut = load();
    const mauro = sut.player(MAURO, "Mauro", 1);
    const hans = sut.player(HANS, "Hans", 2);
    const horse = sut.makeHorse();
    horse.giveTo(mauro);
    const key = sut.api.horsesOf(MAURO)[0].record.key;

    assert.equal(sut.fire("horseMounting", horse, hans), false, "locked at first");
    assert.equal(sut.api.setHorseShared(HANS, key, true).ok, false, "not his horse");
    assert.equal(sut.fire("horseMounting", horse, hans), false);

    const freed = sut.api.setHorseShared(MAURO, key, true);
    assert.equal(freed.ok, true);
    assert.match(freed.message, /está livre: qualquer jogador pode montar/);
    assert.equal(sut.fire("horseMounting", horse, hans), undefined);
    assert.equal(sut.api.horsesOf(MAURO)[0].record.shared, true);

    assert.match(sut.api.setHorseShared(MAURO, key, false).message, /está trancado: só você monta/);
    assert.equal(sut.fire("horseMounting", horse, hans), false);
    assert.equal(sut.api.horsesOf(MAURO)[0].record.shared, undefined);
});

test("of several horses, the one chosen for X comes; the others no longer are; when it cannot come, the nearest does", () => {
    const sut = load();
    const whistle = (at) => sut.api.whistle(mauro, at);
    const mauro = sut.player(MAURO, "Mauro", 1, { x: 0, y: 0, z: 0 });
    const near = sut.makeHorse({ position: { x: 0, y: 20, z: 0 }, name: "Perto" });
    const far = sut.makeHorse({ position: { x: 0, y: 90, z: 0 }, name: "Longe" });
    near.giveTo(mauro);
    far.giveTo(mauro);
    const [first, second] = sut.api.horsesOf(MAURO).map((owned) => owned.record.key);
    whistle(Date.now());
    assert.equal(near.moves.length, 1, "with none chosen, the nearest");

    const nope = sut.api.setActiveHorse(HANS, second);
    assert.equal(nope.ok, false, "only the owner chooses");
    const chosen = sut.api.setActiveHorse(MAURO, second);
    assert.equal(chosen.ok, true);
    assert.match(chosen.message, /Longe é o cavalo que vem quando você aperta X/);
    assert.equal(sut.api.activeHorseOf(MAURO), second);
    whistle(Date.now() + 5_000);
    assert.equal(far.moves.length, 1, "the chosen one comes, though the other is nearer");
    assert.equal(near.moves.length, 1);

    sut.api.setActiveHorse(MAURO, first);
    assert.equal(sut.api.activeHorseOf(MAURO), first, "one at a time");
    assert.deepEqual(Array.from(sut.api.horsesOf(MAURO).map((owned) => owned.record.active === true)), [true, false]);

    near.mounted = true;
    near.riderId = 77;
    whistle(Date.now() + 10_000);
    assert.equal(far.moves.length, 2, "the chosen one is ridden by somebody: the nearest that can come does");

    for (const interval of sut.intervals) interval.fn();
    const back = load({ seed: JSON.parse(sut.disk.files.get("playerdata/horses.json")) });
    assert.equal(back.api.activeHorseOf(MAURO), first, "kept across a restart");
});

test("a kept horse dies for real only while its owner is in the game: with the owner away it is brought back where it lies, and kept (2026-10-26)", () => {
    const sut = load();
    const mauro = sut.player(MAURO, "Mauro", 1);
    const horse = sut.makeHorse({ name: "Trovão" });
    horse.giveTo(mauro);
    mauro.ready = false;

    horse.kill();
    assert.equal(horse.alive, false, "the game killed it");
    assert.equal(sut.saved().length, 1, "but nothing was forgotten: the record is still there");
    assert.ok(sut.logs.some((line) => /o cavalo Trovão de Mauro morreu com o dono fora do jogo: volta à vida/.test(line)));

    const revive = sut.timeouts.find((timer) => timer.ms === sut.api.REVIVE_AFTER_MS);
    assert.ok(revive, "it is brought back a moment later, not inside the engine's own death");
    revive.fn();
    assert.equal(horse.alive, true);
    assert.equal(sut.saved().length, 1);
    assert.equal(sut.logs.filter((line) => /de Mauro morreu$/.test(line)).length, 0, "never logged as lost");
});

test("the same horse dies for real when its owner is there", () => {
    const sut = load();
    const mauro = sut.player(MAURO, "Mauro", 1);
    const horse = sut.makeHorse({ name: "Trovão" });
    horse.giveTo(mauro);
    horse.kill();
    assert.deepEqual(sut.saved(), []);
    assert.equal(sut.timeouts.filter((timer) => timer.ms === sut.api.REVIVE_AFTER_MS).length, 0);
});

test("a kept horse knocked out while its owner is away gets up by itself: it is not given up for dead (2026-10-26)", () => {
    const sut = load();
    const mauro = sut.player(MAURO, "Mauro", 1);
    const horse = sut.makeHorse({ name: "Trovão" });
    horse.giveTo(mauro);
    mauro.ready = false;
    horse.unconscious = true;
    for (let looks = 0; looks < 4; looks += 1) {
        sut.intervals[1].fn();
    }
    assert.equal(sut.saved().length, 1);
    assert.equal(horse.killed, 0);
    assert.equal(horse.owner, mauro, "still the owner's");

    mauro.ready = true;
    sut.intervals[1].fn();
    sut.intervals[1].fn();
    assert.deepEqual(sut.saved(), [], "with the owner back in the game the knockout is the death again");
});
