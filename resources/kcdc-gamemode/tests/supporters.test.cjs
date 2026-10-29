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

/** The list of dog souls the module draws from: GUID-shaped, as the generated one is. */
const SOULS = [["kaaa_dog_1", "11111111-0000-4000-8000-000000000001"], ["kaaa_dog_2", "11111111-0000-4000-8000-000000000002"], ["kaaa_dog_3", "11111111-0000-4000-8000-000000000003"]];
const SOUL_IDS = SOULS.map(([, guid]) => guid);

/** looks maps steamId -> saved gender; refuse names items the inventory turns down. */
function load({ seed = {}, looks = {}, souls = SOULS } = {}) {
    const disk = fakeDisk(seed);
    const storeSandbox = { exports: {}, require: () => disk.fs };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/store.js"), "utf8"), storeSandbox);
    const logs = [];
    const chat = [];
    const added = [];
    const spawned = [];
    const horses = [];
    const handlers = new Map();
    const timers = [];
    const online = [];
    const state = { refuse: new Set(), refuseSouls: new Set(), spawnThrows: false, now: 1_760_400_000_000, refuseRemove: new Set(), horseGone: false };
    const bags = new Map();
    const removedHorses = [];
    const removedItems = [];
    let nextDog = 100;
    const context = {
        exports: {},
        require: (id) => {
            if (id === "./store.js") return storeSandbox.exports;
            if (id === "./dog-souls.js") return { DOG_SOULS: souls };
            if (id === "./characters.js") return { getCharacter: (steamId) => (looks[steamId] ? { appearance: { gender: looks[steamId] } } : null) };
            if (id === "./horses.js") {
                return {
                    keyOfHorse: (horse) => horse.key ?? null,
                    removeHorse: (key, steamId) => {
                        removedHorses.push([key, steamId]);
                        return !state.horseGone;
                    },
                };
            }
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
            get: (player) => ({ ready: true, items: bags.get(player.steamId) ?? [] }),
            remove: (player, request) => {
                const rows = bags.get(player.steamId) ?? [];
                for (const unit of request.units) {
                    const row = rows.find((one) => one.id === unit.id);
                    if (!row || state.refuseRemove.has(row.name)) return { ok: false, code: "unknownItem" };
                    row.amount -= unit.amount;
                    removedItems.push([row.name, unit.amount]);
                }
                bags.set(player.steamId, rows.filter((row) => row.amount > 0));
                return { ok: true, code: "" };
            },
        },
        Dog: {
            spawn: (owner, position, rotation, soul, name) => {
                if (state.spawnThrows) throw new Error("no ground under it");
                if (soul !== undefined && state.refuseSouls.has(soul)) throw new Error("no such soul");
                const dog = { id: nextDog++, owner, position, rotation, soul, name: name ?? "", mode: 1, destroyed: false, destroy() { this.destroyed = true; owner.dog = null; } };
                owner.dog = dog;
                spawned.push(dog);
                return dog;
            },
        },
        Horse: {
            gearPresets: () => ["horse_common01", "horse_noble05"],
            spawn: (position, rotation, soul, name, gear) => {
                const horse = { position, soul, name, gear, owner: null, giveTo(player) { this.owner = player; } };
                horses.push(horse);
                return horse;
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
    /** What the bag of a player holds, as rows of the game: { name: amount }. */
    const stock = (steamId, items) => bags.set(steamId, Object.entries(items).map(([name, amount], index) => ({ id: `r${index}`, name, amount })));
    return { api, disk, logs, chat, added, spawned, horses, handlers, timers, online, state, player, stock, bags, removedHorses, removedItems };
}

/** A fresh module with the clock in reach (the exported instance is made at load, with Date.now). */
function withClock(sut, random = () => 0) {
    const s = new sut.api.Supporters(() => sut.state.now, random);
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
    assert.match(outcome.message, /Benefícios entregues a Katerina: 5 de 5 peças de roupa nobre, uma bombarda de mão \(a píšťala, a primeira arma de fogo da Boêmia\) e 10 balas, o cavalo e o cão\./);
    assert.deepEqual(sut.added.map((entry) => entry.item), [...Array.from(sut.api.NOBLE_CLOTHES.female, (piece) => piece.item), "handgonneNormal01", "shot_ball"]);
    assert.equal(sut.horses.length, 1, "a horse too");
    assert.equal(sut.horses[0].owner, kat, "given to her");
    assert.equal(sut.horses[0].gear, "horse_noble05", "in noble tack");
    assert.ok(sut.added.every((entry) => entry.to === "Katerina"));
    assert.deepEqual(sut.added.slice(-2).map((entry) => entry.amount), [1, 10], "one hand cannon, ten balls");
    assert.equal(sut.spawned.length, 1);
    assert.equal(sut.spawned[0].owner, kat);
    assert.deepEqual({ ...sut.spawned[0].position }, { x: 10, y: 21.6, z: 0 }, "a little in front of her");
    assert.equal(sut.spawned[0].soul, SOUL_IDS[0], "a soul drawn from the list (the first, with this draw), not the game's generic dog");
    assert.ok(sut.chat.some((line) => line.to === "Katerina" && /trajes de nobre \(5 peças, no inventário\), uma bombarda de mão \(a píšťala, a primeira arma de fogo da Boêmia\) e 10 balas, um cavalo, e um cão fiel/.test(line.text)));

    const saved = JSON.parse(sut.disk.files.get(FILE));
    assert.deepEqual(saved["76561198000000002"], { since: sut.state.now, last: sut.state.now, times: 1, by: "Mauro", name: "Katerina", dogName: "", dogSoul: SOUL_IDS[0] });
    assert.deepEqual({ ...supporters.summary("76561198000000002") }, { since: new Date(sut.state.now).toLocaleDateString("pt-BR"), last: new Date(sut.state.now).toLocaleDateString("pt-BR"), times: 1 });
});

test("a man gets the man's set, and a second hand-over another set, the same dog, and the first date kept", () => {
    const sut = load();
    const supporters = withClock(sut);
    const admin = sut.player("76561198000000001", "Mauro");
    const hans = sut.player("76561198000000003", "Hans");
    supporters.grant(admin, hans);
    assert.deepEqual(sut.added.map((entry) => entry.item), ["TunicShort04_m07_A", "HoseJoined02_m12_B", "BootsKnee01_m06_C", "Gloves06_m02_A2", "Cap18_m07_A", "Hood03_m03_A", "handgonneNormal01", "shot_ball"]);

    const first = sut.state.now;
    sut.state.now += 30 * 24 * 3600 * 1000;
    supporters.grant(admin, hans);
    assert.equal(sut.added.length, 16, "a second set, and the arms again");
    assert.equal(sut.horses.length, 2, "and a second horse");
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
    assert.match(outcome.message, /5 de 6 peças de roupa nobre, uma bombarda de mão \(a píšťala, a primeira arma de fogo da Boêmia\) e 10 balas, o cavalo e o cão\. O jogo recusou um item \(luvas de nobre\)\./);
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
    assert.match(outcome.message, /6 de 6 peças de roupa nobre, parte das armas \(faltou: bombarda de mão \(píšťala\)\), o cavalo e o cão\. O jogo recusou um item/);
    assert.deepEqual(sut.added.map((entry) => entry.item).slice(-1), ["shot_ball"], "the balls still went in");
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
    assert.equal(supporters.order(hans, "sentar").message, "Seu cão senta e fica aqui até você chamar.");
    assert.equal(hans.dog.mode, 0, "sitting is the game's Wait");
    supporters.order(hans, "solto");
    assert.equal(hans.dog.mode, 2);
    supporters.order(hans, "seguir");
    for (const word of ["atacar", "toString", "constructor"]) {
        assert.match(supporters.order(hans, word).message, /^Ordens: seguir, esperar, sentar, solto\.$/);
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

test("the gift horse's key is written down once the horses module has filed it, and kept in the record", () => {
    const sut = load();
    const supporters = withClock(sut);
    const admin = sut.player("76561198000000001", "Mauro");
    const hans = sut.player("76561198000000003", "Hans");
    supporters.grant(admin, hans);
    const note = () => {
        const timer = sut.timers.shift();
        assert.ok(timer, "a timer to look again");
        timer.fn();
    };
    note();
    assert.equal(supporters.get(hans.steamId).horseKeys, undefined, "not filed yet: it looks again");
    sut.horses[0].key = "cavalo-7";
    note();
    assert.deepEqual(Array.from(supporters.get(hans.steamId).horseKeys), ["cavalo-7"]);
    assert.deepEqual(JSON.parse(sut.disk.files.get(FILE))[hans.steamId].horseKeys, ["cavalo-7"], "and on disk");
    assert.equal(sut.timers.length, 0, "and no more looking");

    // A second hand-over adds its own horse to the same record.
    supporters.grant(admin, hans);
    sut.horses[1].key = "cavalo-9";
    note();
    assert.deepEqual(Array.from(supporters.get(hans.steamId).horseKeys), ["cavalo-7", "cavalo-9"]);
});

test("a horse the horses module never files is looked for a few times and then let be", () => {
    const sut = load();
    const supporters = withClock(sut);
    const admin = sut.player("76561198000000001", "Mauro");
    const hans = sut.player("76561198000000003", "Hans");
    supporters.grant(admin, hans);
    let looks = 0;
    while (sut.timers.length > 0 && looks < 20) {
        sut.timers.shift().fn();
        looks += 1;
    }
    assert.ok(looks > 1 && looks < 20, `looked ${looks} times`);
    assert.equal(supporters.get(hans.steamId).horseKeys, undefined);
});

test("taking the benefits back (a hand-over given by mistake): the clothes and the arms still in the bag, the gift horse, the dog and the record, and the player is told", () => {
    const sut = load();
    const supporters = withClock(sut);
    const admin = sut.player("76561198000000001", "Mauro");
    const hans = sut.player("76561198000000003", "Hans");
    supporters.grant(admin, hans);
    sut.horses[0].key = "cavalo-7";
    sut.timers.shift().fn();
    sut.timers.length = 0;
    const clothes = Object.fromEntries(Array.from(sut.api.NOBLE_CLOTHES.male, (piece) => [piece.item, 1]));
    // He gave away the gloves and still has all the rest, and a pair of balls less than he was given, and something of his own.
    delete clothes[sut.api.NOBLE_CLOTHES.male[3].item];
    sut.stock(hans.steamId, { ...clothes, handgonneNormal01: 1, shot_ball: 8, apple: 5 });
    const dogBefore = hans.dog;
    assert.ok(dogBefore, "the dog came with the benefits");

    const outcome = supporters.revoke(admin, hans);
    assert.equal(outcome.ok, true);
    assert.match(outcome.message, /^Benefícios retirados de Hans: 7 item\(ns\) \(.*bombarda de mão \(píšťala\).*10 balas\), 1 cavalo\(s\) entregue\(s\), o cão e o registro de apoiador\.$/);
    assert.deepEqual(sut.removedItems.map(([name]) => name), [...Array.from(sut.api.NOBLE_CLOTHES.male, (piece) => piece.item).filter((name) => name in clothes), "handgonneNormal01", "shot_ball"]);
    assert.deepEqual(sut.removedItems.at(-1), ["shot_ball", 8], "the balls he still has, not ten he does not");
    assert.deepEqual(sut.bags.get(hans.steamId).map((row) => row.name), ["apple"], "what was his own stays");
    assert.deepEqual(sut.removedHorses, [["cavalo-7", hans.steamId]]);
    assert.equal(dogBefore.destroyed, true);
    assert.equal(supporters.get(hans.steamId), null);
    assert.equal(JSON.parse(sut.disk.files.get(FILE))[hans.steamId], undefined, "off the disk too");
    assert.equal(sut.chat.at(-1).to, "Hans");
    assert.match(sut.chat.at(-1).text, /benefícios de apoiador foram retirados por um administrador/);
    assert.ok(sut.logs.some((line) => /supporters: Mauro retirou os benefícios de Hans: 7 item\(ns\), 1 cavalo\(s\), o cão e o registro/.test(line)), sut.logs.join("|"));
    assert.equal(supporters.bringDog(hans), null, "no dog comes back at the next entry");
});

test("each hand-over given counts: two sets of clothes and arms are asked back; a bag that refuses one piece does not stop the rest", () => {
    const sut = load();
    const supporters = withClock(sut);
    const admin = sut.player("76561198000000001", "Mauro");
    const hans = sut.player("76561198000000003", "Hans");
    supporters.grant(admin, hans);
    supporters.grant(admin, hans);
    assert.equal(supporters.get(hans.steamId).times, 2);
    sut.stock(hans.steamId, { [sut.api.NOBLE_CLOTHES.male[0].item]: 2, [sut.api.NOBLE_CLOTHES.male[1].item]: 3, shot_ball: 25 });
    sut.state.refuseRemove.add(sut.api.NOBLE_CLOTHES.male[1].item);
    const outcome = supporters.revoke(admin, hans);
    assert.equal(outcome.ok, true);
    assert.deepEqual(sut.removedItems, [[sut.api.NOBLE_CLOTHES.male[0].item, 2], ["shot_ball", 20]], "two of each, no more than two sets");
    assert.ok(sut.logs.some((line) => /o jogo não deixou tirar .* de Hans/.test(line)));
    assert.match(outcome.message, /2 item\(ns\)/);
});

test("a hand-over from before the horses were written down leaves the horse, and says so; nobody who is no supporter has anything taken", () => {
    const old = { "76561198000000003": { since: 1, last: 1, times: 1, by: "Mauro", name: "Hans", dogName: "" } };
    const sut = load({ seed: { [FILE]: JSON.stringify(old) } });
    const supporters = withClock(sut);
    const admin = sut.player("76561198000000001", "Mauro");
    const hans = sut.player("76561198000000003", "Hans");
    const zeca = sut.player("76561198000000004", "Zeca");
    const outcome = supporters.revoke(admin, hans);
    assert.equal(outcome.ok, true);
    assert.match(outcome.message, /o cavalo ficou \(a entrega é anterior ao registro dos cavalos/);
    assert.deepEqual(sut.removedHorses, []);

    const none = supporters.revoke(admin, zeca);
    assert.equal(none.ok, false);
    assert.match(none.message, /Zeca não é apoiador: não há benefícios para retirar/);
    assert.equal(sut.chat.filter((line) => line.to === "Zeca").length, 0, "and nobody is told");
});

test("a horse that was already gone from its owner is told as such, and a file that cannot be read keeps everything as it is", () => {
    const sut = load();
    const supporters = withClock(sut);
    const admin = sut.player("76561198000000001", "Mauro");
    const hans = sut.player("76561198000000003", "Hans");
    supporters.grant(admin, hans);
    sut.horses[0].key = "cavalo-7";
    sut.timers.shift().fn();
    sut.state.horseGone = true;
    const outcome = supporters.revoke(admin, hans);
    assert.match(outcome.message, /o cavalo entregue já não era dele/);

    const broken = load({ seed: { [FILE]: "{ not json" } });
    const locked = withClock(broken);
    const boss = broken.player("76561198000000001", "Mauro");
    const kat = broken.player("76561198000000005", "Kat");
    const refused = locked.revoke(boss, kat);
    assert.equal(refused.ok, false);
    assert.match(refused.message, /não é apoiador|não pôde ser lido/);
});

test("each supporter's dog is a soul drawn from the village dogs', a different one for each while any is left, and the record keeps it (2026-10-26)", () => {
    const sut = load();
    const supporters = withClock(sut, () => 0.99); // the draw always asks for the last of what is open
    const admin = sut.player("76561198000000001", "Mauro");
    const people = ["Hans", "Jan", "Eva"].map((name, index) => sut.player(`7656119800000010${index}`, name));
    for (const person of people) supporters.grant(admin, person);
    const souls = people.map((person) => person.dog.soul);
    assert.ok(souls.every((soul) => SOUL_IDS.includes(soul)), "all from the list");
    assert.equal(new Set(souls).size, 3, "three supporters, three different dogs");

    // The list is used up: the next dog wears a soul one other already wears, the least worn.
    const ondra = sut.player("76561198000000199", "Ondra");
    supporters.grant(admin, ondra);
    const worn = new Map();
    for (const soul of [...souls, ondra.dog.soul]) worn.set(soul, (worn.get(soul) ?? 0) + 1);
    assert.deepEqual([...worn.values()].sort(), [1, 1, 2], "no soul worn three times while another is worn once");

    // The same dog at every entry, a call anew and a second hand-over.
    const kept = people[0].dog.soul;
    people[0].dog.destroy();
    assert.equal(supporters.bringDog(people[0]).soul, kept, "it comes back with its soul");
    supporters.call(people[0]);
    assert.equal(people[0].dog.soul, kept, "and a call anew brings the same dog");
    supporters.grant(admin, people[0]);
    assert.equal(people[0].dog.soul, kept, "and so does a second hand-over");
    assert.equal(JSON.parse(sut.disk.files.get(FILE))[people[0].steamId].dogSoul, kept, "written in the record");
    assert.ok(sut.logs.some((line) => /o cão de Hans é a alma kaaa_dog_[123]/.test(line)), "and said in the log, by the soul's name");
});

test("a supporter from before the draw gets a soul at the next coming, and keeps the name the dog had; the file's odd souls are ignored", () => {
    const seed = {
        [FILE]: JSON.stringify({
            "76561198000000003": { since: 1, last: 1, times: 1, by: "Mauro", name: "Hans", dogName: "Rex" },
            "76561198000000004": { since: 1, last: 1, times: 1, by: "Mauro", name: "Jan", dogName: "", dogSoul: "not a guid" },
            "76561198000000005": { since: 1, last: 1, times: 1, by: "Mauro", name: "Eva", dogName: "", dogSoul: SOUL_IDS[1] },
        }),
    };
    const sut = load({ seed });
    const supporters = withClock(sut);
    assert.equal(supporters.get("76561198000000004").dogSoul, undefined, "something that is no GUID is not a soul");
    assert.equal(supporters.get("76561198000000005").dogSoul, SOUL_IDS[1]);
    const hans = sut.player("76561198000000003", "Hans");
    const dog = supporters.bringDog(hans);
    assert.ok(SOUL_IDS.includes(dog.soul));
    assert.notEqual(dog.soul, SOUL_IDS[1], "not the soul Eva's dog wears while others are free");
    assert.equal(dog.name, "Rex");
    assert.equal(JSON.parse(sut.disk.files.get(FILE))["76561198000000003"].dogSoul, dog.soul, "kept from then on");
    const eva = sut.player("76561198000000005", "Eva");
    assert.equal(supporters.bringDog(eva).soul, SOUL_IDS[1], "and Eva's dog is the one she had");
});

test("a soul the game turns down is let go for another, and the generic dog comes when none is accepted", () => {
    const sut = load();
    const supporters = withClock(sut, () => 0.99);
    const admin = sut.player("76561198000000001", "Mauro");
    sut.state.refuseSouls.add(SOUL_IDS[2]); // the first the draw asks for
    const hans = sut.player("76561198000000003", "Hans");
    supporters.grant(admin, hans);
    assert.equal(hans.dog.soul, SOUL_IDS[1], "the next draw");
    assert.ok(sut.logs.some((line) => /o cão de Hans não veio com a alma kaaa_dog_3: (Error: )?no such soul/.test(line)));
    assert.equal(JSON.parse(sut.disk.files.get(FILE))["76561198000000003"].dogSoul, SOUL_IDS[1], "and that is the one kept");

    for (const soul of SOUL_IDS) sut.state.refuseSouls.add(soul);
    const jan = sut.player("76561198000000004", "Jan");
    supporters.grant(admin, jan);
    assert.ok(jan.dog, "a dog all the same");
    assert.equal(jan.dog.soul, undefined, "the game's generic dog");
    assert.equal(JSON.parse(sut.disk.files.get(FILE))["76561198000000004"].dogSoul, undefined, "and no soul is written down for it");
    assert.equal(sut.spawned.filter((dog) => dog.owner === jan).length, 1, "tried with the souls, then once with none");
});

test("benefits reserved for somebody who is not in the game are done when they come in, and written down until then (2026-10-27)", () => {
    const sut = load({ looks: { "76561198000000042": "male" } });
    const supporters = withClock(sut);
    const queued = supporters.queue("grant", "76561198000000042", "Urik", "Mauro");
    assert.equal(queued.ok, true);
    assert.match(queued.message, /Urik não está no jogo: os benefícios ficam reservados/);
    assert.deepEqual(JSON.parse(sut.disk.files.get("playerdata/supporters-pending.json")), { "76561198000000042": { action: "grant", by: "Mauro", at: sut.state.now } });
    assert.equal(supporters.pendingFor("76561198000000042").action, "grant");
    assert.equal(sut.added.length, 0, "nothing handed yet");

    // after a restart the reservation is still there
    const later = withClock(sut);
    assert.equal(later.pendingFor("76561198000000042").by, "Mauro");

    const urik = sut.player("76561198000000042", "Urik");
    const done = later.applyPending(urik);
    assert.equal(done.ok, true);
    assert.ok(sut.added.length >= 5, "the clothes are handed now");
    assert.equal(later.get("76561198000000042").by, "Mauro", "by the administrator who reserved it");
    assert.equal(later.pendingFor("76561198000000042"), null, "and it is not done twice");
    assert.deepEqual(JSON.parse(sut.disk.files.get("playerdata/supporters-pending.json")), {});
    assert.equal(later.applyPending(urik), null);
});

test("a taking-back reserved for somebody who is not in the game needs a record to take back, and replaces what was reserved before", () => {
    const sut = load({ looks: { "76561198000000042": "male" } });
    const supporters = withClock(sut);
    assert.equal(supporters.queue("revoke", "76561198000000042", "Urik", "Mauro").ok, false, "not a supporter: nothing to take back");
    assert.equal(supporters.queue("grant", "not-a-steam-id", "Estranho", "Mauro").ok, false);

    const urik = sut.player("76561198000000042", "Urik");
    supporters.grant({ nickname: "Mauro" }, urik);
    urik.ready = false;
    assert.equal(supporters.queue("grant", "76561198000000042", "Urik", "Mauro").ok, true);
    assert.equal(supporters.queue("revoke", "76561198000000042", "Urik", "Hans").ok, true);
    assert.equal(supporters.pendingFor("76561198000000042").action, "revoke", "the last one wins");

    urik.ready = true;
    const done = supporters.applyPending(urik);
    assert.equal(done.ok, true);
    assert.equal(supporters.get("76561198000000042"), null, "the record is gone");
    assert.equal(supporters.pendingFor("76561198000000042"), null);
});

test("a reserved hand-over that cannot be made yet because the body is not in the world stays reserved; the entry runs it after the dog's delay", () => {
    const sut = load();
    const supporters = sut.api.supporters;
    supporters.load();
    sut.api.installSupporters();
    supporters.queue("grant", "76561198000000043", "Hans", "Mauro");
    const hans = sut.player("76561198000000043", "Hans");
    hans.ready = false;
    assert.equal(supporters.applyPending(hans).ok, false);
    assert.equal(supporters.pendingFor("76561198000000043").action, "grant", "still reserved");

    hans.ready = true;
    sut.handlers.get("playerSpawned")(hans);
    assert.equal(sut.timers.length > 0, true, "the entry sets the delayed work, for a reservation too");
    sut.timers.at(-1).fn();
    assert.equal(supporters.pendingFor("76561198000000043"), null);
    assert.ok(sut.added.length >= 5);
});
