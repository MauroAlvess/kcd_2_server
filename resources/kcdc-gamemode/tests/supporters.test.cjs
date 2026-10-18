const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

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

const FILE = "playerdata/supporters.json";

/** looks maps steamId -> saved gender; refuse names items the inventory turns down. */
function load({ seed = {}, looks = {} } = {}) {
    const disk = fakeDisk(seed);
    const storeSandbox = { exports: {}, require: () => disk.fs };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/store.js"), "utf8"), storeSandbox);
    const logs = [];
    const chat = [];
    const added = [];
    const spawned = [];
    const handlers = new Map();
    const timers = [];
    const online = [];
    const state = { refuse: new Set(), spawnThrows: false, now: 1_760_400_000_000 };
    let nextDog = 100;
    const context = {
        exports: {},
        require: (id) => {
            if (id === "./store.js") return storeSandbox.exports;
            if (id === "./characters.js") return { getCharacter: (steamId) => (looks[steamId] ? { appearance: { gender: looks[steamId] } } : null) };
            if (id === "./place.js") return { inFrontOf: (player, distance) => ({ position: { x: player.position.x, y: player.position.y + distance, z: 0 }, rotation: "facing back" }) };
            assert.fail(`unexpected require ${id}`);
        },
        console: { log: (line) => logs.push(line) },
        Date,
        setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
        Chat: { sendToPlayer: (player, text) => chat.push({ to: player.nickname, text }) },
        Inventory: {
            add: (player, request) => {
                if (state.refuse.has(request.item)) return { ok: false, code: "invalidItem" };
                added.push({ to: player.nickname, ...request });
                return { ok: true, code: "" };
            },
        },
        Dog: {
            spawn: (owner, position, rotation, soul, name) => {
                if (state.spawnThrows) throw new Error("no ground under it");
                const dog = { id: nextDog++, owner, position, rotation, soul, name: name ?? "", mode: 1, destroyed: false, destroy() { this.destroyed = true; owner.dog = null; } };
                owner.dog = dog;
                spawned.push(dog);
                return dog;
            },
        },
        Events: { on: (name, fn) => handlers.set(name, fn) },
        Player: { getById: (id) => online.find((player) => player.id === id) ?? null },
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/supporters.js"), "utf8"), context);
    const api = context.exports;
    api.supporters.now = () => state.now;
    let nextId = 1;
    const player = (steamId, nickname, gender = "male") => {
        const made = { id: nextId++, steamId, nickname, ready: true, alive: true, dog: null, position: { x: 10, y: 20, z: 0 }, appearance: { gender } };
        online.push(made);
        return made;
    };
    return { api, disk, logs, chat, added, spawned, handlers, timers, online, state, player };
}

/** A fresh module with the clock in reach (the exported instance is made at load, with Date.now). */
function withClock(sut) {
    const s = new sut.api.Supporters(() => sut.state.now);
    s.load();
    return s;
}

test("the benefits are a noble's clothes for the body the player chose, a dog brought at once, and a record by Steam id", () => {
    const sut = load({ looks: { "76561198000000002": "female" } });
    const supporters = withClock(sut);
    const admin = sut.player("76561198000000001", "Mauro");
    const kat = sut.player("76561198000000002", "Katerina", "male"); // her client still reports the default body

    const outcome = supporters.grant(admin, kat);
    assert.equal(outcome.ok, true);
    assert.match(outcome.message, /Benefícios entregues a Katerina: 5 de 5 peças de roupa nobre, um mosquete, um canhão de mão e 10 balas e o cão\./);
    assert.deepEqual(sut.added.map((entry) => entry.item), [...Array.from(sut.api.NOBLE_CLOTHES.female, (piece) => piece.item), "hookgunNormal01", "handgonneNormal01", "shot_ball"]);
    assert.ok(sut.added.every((entry) => entry.to === "Katerina"));
    assert.deepEqual(sut.added.slice(-3).map((entry) => entry.amount), [1, 1, 10], "one musket, one hand cannon, ten balls");
    assert.equal(sut.spawned.length, 1);
    assert.equal(sut.spawned[0].owner, kat);
    assert.deepEqual({ ...sut.spawned[0].position }, { x: 10, y: 21.6, z: 0 }, "a little in front of her");
    assert.equal(sut.spawned[0].soul, undefined, "the game's generic dog");
    assert.ok(sut.chat.some((line) => line.to === "Katerina" && /trajes de nobre \(5 peças, no inventário\), um mosquete, um canhão de mão e 10 balas e um cão fiel/.test(line.text)));

    const saved = JSON.parse(sut.disk.files.get(FILE));
    assert.deepEqual(saved["76561198000000002"], { since: sut.state.now, last: sut.state.now, times: 1, by: "Mauro", name: "Katerina", dogName: "" });
    assert.deepEqual({ ...supporters.summary("76561198000000002") }, { since: new Date(sut.state.now).toLocaleDateString("pt-BR"), last: new Date(sut.state.now).toLocaleDateString("pt-BR"), times: 1 });
});

test("a man gets the man's set, and a second hand-over another set, the same dog, and the first date kept", () => {
    const sut = load();
    const supporters = withClock(sut);
    const admin = sut.player("76561198000000001", "Mauro");
    const hans = sut.player("76561198000000003", "Hans");
    supporters.grant(admin, hans);
    assert.deepEqual(sut.added.map((entry) => entry.item), ["TunicShort04_m07_A", "HoseJoined02_m12_B", "BootsKnee01_m06_C", "Gloves06_m02_A2", "Cap18_m07_A", "Hood03_m03_A", "hookgunNormal01", "handgonneNormal01", "shot_ball"]);

    const first = sut.state.now;
    sut.state.now += 30 * 24 * 3600 * 1000;
    supporters.grant(admin, hans);
    assert.equal(sut.added.length, 18, "a second set, and the arms again");
    assert.equal(sut.spawned.length, 1, "the dog he has is the dog he keeps");
    const record = JSON.parse(sut.disk.files.get(FILE))["76561198000000003"];
    assert.equal(record.since, first);
    assert.equal(record.last, sut.state.now);
    assert.equal(record.times, 2);
});

test("a piece the game refuses is named to the administrator; the rest and the dog still come", () => {
    const sut = load();
    const supporters = withClock(sut);
    sut.state.refuse.add("Gloves06_m02_A2");
    const outcome = supporters.grant(sut.player("76561198000000001", "Mauro"), sut.player("76561198000000004", "Jan"));
    assert.equal(outcome.ok, true);
    assert.match(outcome.message, /5 de 6 peças de roupa nobre, um mosquete, um canhão de mão e 10 balas e o cão\. O jogo recusou um item \(luvas de nobre\)\./);
    assert.ok(sut.logs.some((line) => /recusou Gloves06_m02_A2 para Jan/.test(line)));
    assert.equal(sut.spawned.length, 1);
});

test("an arm the game refuses is named, and what came with it is still told", () => {
    const sut = load();
    const supporters = withClock(sut);
    sut.state.refuse.add("handgonneNormal01");
    const hans = sut.player("76561198000000006", "Hans");
    const outcome = supporters.grant(sut.player("76561198000000001", "Mauro"), hans);
    assert.equal(outcome.ok, true);
    assert.match(outcome.message, /6 de 6 peças de roupa nobre, parte das armas \(faltou: canhão de mão \(bombarda de mão\)\) e o cão\. O jogo recusou um item/);
    assert.deepEqual(sut.added.map((entry) => entry.item).slice(-2), ["hookgunNormal01", "shot_ball"], "the musket and the balls still went in");
    assert.ok(sut.chat.some((line) => line.to === "Hans" && /parte das armas/.test(line.text)));
});

test("nothing is handed to a player without a Steam id, to one still loading, or over a file that could not be read", () => {
    const sut = load();
    const supporters = withClock(sut);
    const admin = sut.player("76561198000000001", "Mauro");
    assert.match(supporters.grant(admin, sut.player("", "Sem Steam")).message, /sem identificação Steam/);
    const loading = sut.player("76561198000000005", "Ondra");
    loading.ready = false;
    assert.match(supporters.grant(admin, loading).message, /ainda está entrando/);
    assert.equal(sut.added.length, 0);

    const broken = load({ seed: { [FILE]: "{ not json" } });
    const theirs = withClock(broken);
    assert.ok(broken.logs.some((line) => /ilegível/.test(line)));
    const outcome = theirs.grant(broken.player("76561198000000001", "Mauro"), broken.player("76561198000000006", "Vašek"));
    assert.equal(outcome.ok, false);
    assert.equal(broken.disk.files.get(FILE), "{ not json", "left as it was");
    assert.equal(broken.added.length, 0);
});

test("the dog comes back a few seconds after its owner's every entry, and only a supporter's", () => {
    const record = { since: 1, last: 1, times: 1, by: "Mauro", name: "Hans", dogName: "Pes" };
    const sut = load({ seed: { [FILE]: JSON.stringify({ "76561198000000003": record }) } });
    sut.api.installSupporters();
    assert.ok(sut.logs.some((line) => /1 apoiador\(es\)/.test(line)));

    const hans = sut.player("76561198000000003", "Hans");
    const other = sut.player("76561198000000007", "Ondra");
    sut.handlers.get("playerSpawned")(other);
    assert.equal(sut.timers.length, 0, "nobody else is waited on");
    sut.handlers.get("playerSpawned")(hans);
    assert.equal(sut.timers.length, 1);
    assert.equal(sut.timers[0].ms, sut.api.DOG_DELAY_MS);
    sut.timers[0].fn();
    assert.equal(sut.spawned.length, 1);
    assert.equal(sut.spawned[0].name, "Pes", "under the name it was given");

    // A respawn after death finds the dog still there.
    sut.handlers.get("playerSpawned")(hans);
    sut.timers[1].fn();
    assert.equal(sut.spawned.length, 1);

    // Gone before the wait was over.
    hans.dog = null;
    sut.handlers.get("playerSpawned")(hans);
    sut.online.splice(sut.online.indexOf(hans), 1);
    sut.timers[2].fn();
    assert.equal(sut.spawned.length, 1);
});

test("/cachorro calls the dog anew beside its owner, not too often, and only for a supporter", () => {
    const sut = load({ seed: { [FILE]: JSON.stringify({ "76561198000000003": { since: 1, last: 1, times: 1, by: "Mauro", name: "Hans", dogName: "" } }) } });
    const supporters = withClock(sut);
    const hans = sut.player("76561198000000003", "Hans");
    const ondra = sut.player("76561198000000007", "Ondra");

    assert.match(supporters.call(ondra).message, /presente para quem apoia o servidor/);
    assert.equal(supporters.call(hans).message, "Seu cão veio para perto de você.");
    const first = sut.spawned[0];
    assert.match(supporters.call(hans).message, /já está vindo/);
    sut.state.now += sut.api.CALL_COOLDOWN_MS;
    supporters.call(hans);
    assert.equal(first.destroyed, true, "the old one goes");
    assert.equal(sut.spawned.length, 2);
    assert.equal(hans.dog, sut.spawned[1]);

    sut.state.now += sut.api.CALL_COOLDOWN_MS;
    hans.alive = false;
    assert.match(supporters.call(hans).message, /de pé no mundo/);
    hans.alive = true;
    sut.state.spawnThrows = true;
    hans.dog = null;
    assert.match(supporters.call(hans).message, /não pôde vir agora/);
    assert.ok(sut.logs.some((line) => /não pôde vir: .*no ground under it/.test(line)));
});

test("/cachorro nome names the dog now and at every entry; an empty name gives back the game's own", () => {
    const sut = load({ seed: { [FILE]: JSON.stringify({ "76561198000000003": { since: 1, last: 1, times: 1, by: "Mauro", name: "Hans", dogName: "" } }) } });
    const supporters = withClock(sut);
    const hans = sut.player("76561198000000003", "Hans");
    supporters.bringDog(hans);

    assert.match(supporters.rename(hans, "P").message, /entre 2 e 24 letras/);
    assert.match(supporters.rename(hans, "x".repeat(25)).message, /entre 2 e 24 letras/);
    assert.equal(supporters.rename(hans, "  Toulec   do  Moinho ").message, "Seu cão agora se chama Toulec do Moinho.");
    assert.equal(hans.dog.name, "Toulec do Moinho");
    assert.equal(JSON.parse(sut.disk.files.get(FILE))["76561198000000003"].dogName, "Toulec do Moinho");

    assert.equal(supporters.rename(hans, "").message, "Seu cão voltou a usar o nome de antes.");
    assert.equal(hans.dog.name, "");
    assert.match(supporters.rename(sut.player("76561198000000007", "Ondra"), "Rex").message, /Só quem apoia/);
});

test("/cachorro seguir and esperar set the game's companion mode; anything else is listed, not obeyed", () => {
    const sut = load({ seed: { [FILE]: JSON.stringify({ "76561198000000003": { since: 1, last: 1, times: 1, by: "Mauro", name: "Hans", dogName: "" } }) } });
    const supporters = withClock(sut);
    const hans = sut.player("76561198000000003", "Hans");
    assert.match(supporters.order(hans, "esperar").message, /não tem um cão por perto/);
    supporters.bringDog(hans);
    assert.equal(supporters.order(hans, "esperar").message, "Seu cão vai esperar aqui.");
    assert.equal(hans.dog.mode, 0);
    assert.equal(supporters.order(hans, "seguir").message, "Seu cão vai seguir você.");
    assert.equal(hans.dog.mode, 1);
    for (const word of ["atacar", "toString", "constructor"]) {
        assert.match(supporters.order(hans, word).message, /^Ordens: seguir, esperar\.$/);
    }
    assert.equal(hans.dog.mode, 1);
});

test("a file with odd entries keeps what makes sense", () => {
    const sut = load({ seed: { [FILE]: JSON.stringify({ "76561198000000003": { since: 5, dogName: "y".repeat(40) }, "not-a-steam-id": { since: 1 }, "76561198000000009": "x" }) } });
    const supporters = withClock(sut);
    assert.equal(supporters.count(), 1);
    const record = supporters.get("76561198000000003");
    assert.deepEqual({ ...record }, { since: 5, last: 5, times: 1, by: "", name: "", dogName: "y".repeat(24) });
    assert.equal(supporters.get(""), null);
});
