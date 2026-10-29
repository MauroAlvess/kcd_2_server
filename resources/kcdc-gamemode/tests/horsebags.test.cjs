// The alforjes of a horse (src/server/horse-bags.ts) over the real horses module and a fake game.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const dist = (name) => fs.readFileSync(path.join(__dirname, "../dist/server", name), "utf8");
const MAURO = "76561198000000001";
const HANS = "76561198000000002";
const plain = (value) => JSON.parse(JSON.stringify(value));

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

function load({ admins = [], refuseOpen = false, inventoryFull = false, seed = null } = {}) {
    const disk = fakeDisk();
    if (seed !== null) disk.files.set("playerdata/horses.json", JSON.stringify(seed));
    const store = { exports: {}, require: () => disk.fs };
    vm.runInNewContext(dist("store.js"), store);

    const handlers = new Map();
    const timers = [];
    const players = new Map();
    const horses = new Map();
    const stashes = new Map();
    const chat = [];
    const grounded = [];
    const added = [];
    const logs = [];
    let nextId = 500;
    let nextStash = 900;

    const fire = (name, ...args) => handlers.get(name)?.(...args);
    const fakeStash = (world) => {
        let rows = [];
        let rowCounter = 0;
        let gone = false;
        const stash = {
            id: nextStash++,
            isVirtual: true,
            world,
            opened: [],
            destroyed: false,
            // The game took the container (the player left, lost the access, timed out): it reads null from then on.
            vanish() { gone = true; },
            setInventory({ items }) {
                if (items.some((row) => row.item === "not-an-item")) return { ok: false, code: "unknownItem" };
                rows = items.map((row) => ({ id: row.id ?? `r${++rowCounter}`, item: row.item, amount: row.amount, metadata: row.metadata ?? {} }));
                return { ok: true, code: "" };
            },
            getInventory: () => (gone ? null : { revision: 1, items: rows.map((row) => ({ ...row })) }),
            open(player) { if (refuseOpen) return false; stash.opened.push(player.id); return true; },
            destroy() { stash.destroyed = true; stashes.delete(stash.id); fire("stashDestroy", stash); },
            // What the transfer screen does when the player moves things.
            put(item, amount) { rows.push({ id: `r${++rowCounter}`, item, amount, metadata: {} }); fire("stashInventoryChanged", stash, null, { reason: "deposit" }); },
            take(item) { rows = rows.filter((row) => row.item !== item); fire("stashInventoryChanged", stash, null, { reason: "withdraw" }); },
        };
        stashes.set(stash.id, stash);
        return stash;
    };
    const makeHorse = ({ position = { x: 0, y: 0, z: 0 }, name = "" } = {}) => {
        const horse = {
            id: nextId++, soul: "soul-pebbles", name, gear: { saddle: null, head: null, torso: null, shoe: null }, position: { ...position }, rotation: { x: 0, y: 0, z: 0 },
            owner: null, ownerId: 0, alive: true, mounted: false, rider: null, riderId: 0, destroyWithOwner: true, virtualWorld: 0,
            giveTo(player) { this.owner = player; this.ownerId = player ? player.id : 0; fire("horseOwnerChanged", this, player); },
            destroy() { horses.delete(this.id); fire("horseDestroy", this); },
        };
        horses.set(horse.id, horse);
        return horse;
    };
    const exportsOf = {};
    const context = {
        exports: exportsOf,
        require: (id) => {
            if (id === "./store.js") return store.exports;
            if (id === "./auth.js") return { isAdmin: (player) => admins.includes(player.steamId) };
            if (id === "./position.js") return { yawOf: (rotation) => rotation.z };
            assert.fail(`unexpected require ${id}`);
        },
        console: { log: (line) => logs.push(line), error: (line) => logs.push(line) },
        setInterval: () => 1,
        clearInterval() {},
        Vector3: class { constructor(x, y, z) { Object.assign(this, { x, y, z }); } },
        Chat: { sendToPlayer: (player, text) => chat.push({ to: player.id, text }) },
        Events: { on: (name, fn) => handlers.set(name, fn), onClient: () => undefined },
        Navigation: { ready: false },
        Player: { getById: (id) => players.get(id) ?? null, all: () => [...players.values()] },
        Horse: { spawn: (position, rotation, soul, name) => makeHorse({ position, name }), all: () => [...horses.values()], getById: (id) => horses.get(id) ?? null },
    };
    vm.runInNewContext(dist("horses.js"), context);
    context.exports.installHorses();

    const bagsSandbox = {
        exports: {},
        require: (id) => (id === "./horses.js" ? context.exports : assert.fail(`unexpected require ${id}`)),
        console: { log: (line) => logs.push(line) },
        setTimeout: (fn) => { timers.push(fn); return timers.length; },
        Chat: context.Chat,
        Events: context.Events,
        Player: context.Player,
        Horse: context.Horse,
        Stash: { createVirtual: (world) => fakeStash(world) },
        Inventory: { add: (player, request) => { if (inventoryFull) return { ok: false, code: "inventoryCapacity" }; added.push({ to: player.id, ...request }); return { ok: true, code: "" }; } },
        GroundItem: { spawn: (item, position, rotation, amount, world) => { grounded.push({ item, position, amount, world }); return {}; } },
    };
    vm.runInNewContext(dist("horse-bags.js"), bagsSandbox);
    bagsSandbox.exports.installHorseBags();
    const flush = () => { for (const fn of timers.splice(0)) fn(); };

    const player = (steamId, nickname, id, position = { x: 0, y: 0, z: 0 }) => {
        const made = { steamId, nickname, id, position, ready: true, alive: true, virtualWorld: 0, connected: true, emit() {} };
        players.set(id, made);
        return made;
    };
    /** A horse that is somebody's: given to them, so the horses module files it. */
    const owned = (owner, over = {}) => {
        const horse = makeHorse(over);
        horse.giveTo(owner);
        return horse;
    };
    return { horses: context.exports, bags: bagsSandbox.exports, fire, flush, player, owned, makeHorse, stashes, chat, grounded, added, logs, disk, handlers };
}

test("the owner opens the alforjes of a horse beside them on the transfer screen, and it is a stash the server filled", () => {
    const sut = load();
    const mauro = sut.player(MAURO, "Mauro", 1);
    sut.owned(mauro, { position: { x: 3, y: 4, z: 0 }, name: "Pardo" });
    const outcome = sut.bags.openBags(mauro, null);
    assert.equal(outcome.ok, true, outcome.message);
    assert.match(outcome.message, /Alforjes de Pardo/);
    assert.equal(sut.stashes.size, 1);
    const stash = [...sut.stashes.values()][0];
    assert.deepEqual(stash.opened, [1]);
    assert.equal(stash.world, 0, "in the player's world");
});

test("what is put in is kept with the horse, written to its file at once; what is taken out is gone from it", () => {
    const sut = load();
    const mauro = sut.player(MAURO, "Mauro", 1);
    const horse = sut.owned(mauro, { name: "Pardo" });
    sut.bags.openBags(mauro, null);
    const stash = [...sut.stashes.values()][0];
    stash.put("bread", 3);
    stash.put("apple", 5);
    const key = sut.horses.horsesOf(MAURO)[0].record.key;
    assert.deepEqual(plain(sut.horses.bagsOf(key)).map((row) => [row.item, row.amount]), [["bread", 3], ["apple", 5]]);
    const saved = JSON.parse(sut.disk.files.get("playerdata/horses.json")).horses[0];
    assert.deepEqual(saved.bags.map((row) => [row.item, row.amount]), [["bread", 3], ["apple", 5]]);

    stash.take("bread");
    assert.deepEqual(plain(sut.horses.bagsOf(key)).map((row) => row.item), ["apple"]);
    stash.take("apple");
    assert.deepEqual(plain(sut.horses.bagsOf(key)), []);
    assert.equal(JSON.parse(sut.disk.files.get("playerdata/horses.json")).horses[0].bags, undefined, "an empty bag leaves no trace");
    assert.ok(horse.alive);
});

test("closing the screen writes it once more and throws the stash away; the next opening shows what the horse carries", () => {
    const sut = load();
    const mauro = sut.player(MAURO, "Mauro", 1);
    sut.owned(mauro);
    sut.bags.openBags(mauro, null);
    const first = [...sut.stashes.values()][0];
    first.put("bread", 2);
    const closedBy = [];
    sut.bags.bagsClosed.push((player, key) => closedBy.push([player.id, key]));
    sut.fire("stashClose", first, mauro, "closed");
    sut.flush();
    assert.equal(first.destroyed, true);
    assert.equal(sut.stashes.size, 0);
    assert.equal(closedBy.length, 1, "the horse's menu is told the player closed it themselves");
    assert.equal(closedBy[0][0], mauro.id);

    sut.bags.openBags(mauro, null);
    const second = [...sut.stashes.values()][0];
    assert.deepEqual(plain(second.getInventory().items).map((row) => [row.item, row.amount]), [["bread", 2]]);
});

test("after a restart the alforjes are as they were: they come back with the horse's record", () => {
    const sut = load();
    const mauro = sut.player(MAURO, "Mauro", 1);
    sut.owned(mauro, { name: "Pardo" });
    sut.bags.openBags(mauro, null);
    [...sut.stashes.values()][0].put("arrow_normal", 20);
    const seed = JSON.parse(sut.disk.files.get("playerdata/horses.json"));
    assert.deepEqual(seed.horses[0].bags.map((row) => [row.item, row.amount]), [["arrow_normal", 20]]);

    const again = load({ seed });
    const back = again.player(MAURO, "Mauro", 1);
    again.fire("playerSpawned", back);
    const [pardo] = again.horses.horsesOf(MAURO);
    assert.equal(pardo.record.name, "Pardo");
    assert.deepEqual(plain(again.horses.bagsOf(pardo.record.key)).map((row) => [row.item, row.amount]), [["arrow_normal", 20]]);
    assert.equal(again.bags.openBags(back, null).ok, true);
    assert.deepEqual(plain([...again.stashes.values()][0].getInventory().items).map((row) => [row.item, row.amount]), [["arrow_normal", 20]], "and the screen shows them");
});

test("a stored bag is cleaned when read: no row without a class or a whole positive amount, no more than the limit", () => {
    const sut = load();
    const rows = sut.horses.cleanBags([
        { item: "bread", amount: 2 },
        { item: "", amount: 2 },
        { item: "apple", amount: 0 },
        { item: "pear", amount: 1.5 },
        { item: "plum", amount: -1 },
        null,
        "bread",
        { item: "axe", amount: 1, id: "ok-1", metadata: { quality: 2 } },
        { item: "axe", amount: 1, id: "bad id!", metadata: [] },
    ]);
    assert.deepEqual(plain(rows), [{ item: "bread", amount: 2 }, { item: "axe", amount: 1, id: "ok-1", metadata: { quality: 2 } }, { item: "axe", amount: 1 }]);
    const many = Array.from({ length: 200 }, (_, n) => ({ item: `i${n}`, amount: 1 }));
    assert.equal(sut.horses.cleanBags(many).length, sut.horses.MAX_BAG_ROWS);
    assert.deepEqual(plain(sut.horses.cleanBags("nope")), []);
});

test("only the owner's horse that is near, alive and free opens; each reason is told", () => {
    const sut = load();
    const mauro = sut.player(MAURO, "Mauro", 1);
    const hans = sut.player(HANS, "Hans", 2);
    assert.match(sut.bags.openBags(mauro, null).message, /não tem um cavalo por perto/);

    const horse = sut.owned(mauro, { position: { x: 20, y: 0, z: 0 }, name: "Pardo" });
    assert.match(sut.bags.openBags(mauro, null).message, /longe demais.*menos de 8 m/);
    assert.match(sut.bags.openBags(hans, null).message, /não tem um cavalo/, "somebody else's horse is not his");

    horse.position = { x: 2, y: 0, z: 0 };
    horse.rider = { id: 2 };
    assert.match(sut.bags.openBags(mauro, null).message, /montado/);
    horse.rider = null;

    mauro.alive = false;
    assert.match(sut.bags.openBags(mauro, null).message, /não pode abrir/);
    mauro.alive = true;
    assert.equal(sut.bags.openBags(mauro, null).ok, true);
    assert.match(sut.bags.openBags(mauro, null).message, /já está com um inventário aberto/);
    assert.equal(sut.stashes.size, 1);
});

test("the nearest of two horses is the one opened, or the one asked for by its key", () => {
    const sut = load();
    const mauro = sut.player(MAURO, "Mauro", 1);
    sut.owned(mauro, { position: { x: 6, y: 0, z: 0 }, name: "Longe" });
    sut.owned(mauro, { position: { x: 1, y: 0, z: 0 }, name: "Perto" });
    assert.match(sut.bags.openBags(mauro, null).message, /Alforjes de Perto/);
    sut.fire("playerDisconnect", mauro);
    sut.flush();
    const far = sut.horses.horsesOf(MAURO).find((owned) => owned.record.name === "Longe");
    assert.match(sut.bags.openBags(mauro, far.record.key).message, /Alforjes de Longe/);
});

test("two players cannot have the same horse's alforjes open, and a screen the game will not show leaves nothing behind", () => {
    const sut = load();
    const mauro = sut.player(MAURO, "Mauro", 1);
    sut.owned(mauro);
    assert.equal(sut.bags.openBags(mauro, null).ok, true);
    const key = sut.horses.horsesOf(MAURO)[0].record.key;
    mauro.alive = true;
    assert.match(sut.bags.openBags(mauro, key).message, /já está com um inventário aberto|já estão abertas/);

    const refused = load({ refuseOpen: true });
    const jan = refused.player(MAURO, "Mauro", 1);
    refused.owned(jan);
    assert.match(refused.bags.openBags(jan, null).message, /não abriu as alforjes agora/);
    refused.flush();
    assert.equal(refused.stashes.size, 0, "the stash made for it is thrown away");
    assert.equal(refused.bags.openBags(jan, null).ok === false, true);
});

test("a player who leaves with the screen open leaves the horse with what was in it", () => {
    const sut = load();
    const mauro = sut.player(MAURO, "Mauro", 1);
    sut.owned(mauro);
    sut.bags.openBags(mauro, null);
    [...sut.stashes.values()][0].put("bread", 4);
    sut.fire("playerDisconnect", mauro);
    sut.flush();
    assert.equal(sut.stashes.size, 0);
    assert.deepEqual(plain(sut.horses.bagsOf(sut.horses.horsesOf(MAURO)[0].record.key)).map((row) => [row.item, row.amount]), [["bread", 4]]);
});

test("a horse that dies gives its alforjes to its owner, or to the ground where it fell when they are full or away", () => {
    const sut = load();
    const mauro = sut.player(MAURO, "Mauro", 1);
    const horse = sut.owned(mauro, { position: { x: 7, y: 8, z: 9 } });
    const key = sut.horses.horsesOf(MAURO)[0].record.key;
    sut.horses.saveBags(key, [{ item: "bread", amount: 3 }, { item: "apple", amount: 2 }]);
    horse.alive = false;
    sut.fire("horseDeath", horse, null, "combat");
    assert.deepEqual(plain(sut.added), [{ to: 1, item: "bread", amount: 3 }, { to: 1, item: "apple", amount: 2 }]);
    assert.equal(sut.grounded.length, 0);
    assert.ok(sut.chat.some((line) => /o que ele levava nas alforjes/.test(line.text)));
    assert.deepEqual(plain(sut.horses.horsesOf(MAURO)), [], "the horse is forgotten");

    const full = load({ inventoryFull: true });
    const hans = full.player(HANS, "Hans", 2);
    const other = full.owned(hans, { position: { x: 7, y: 8, z: 9 } });
    full.horses.saveBags(full.horses.horsesOf(HANS)[0].record.key, [{ item: "bread", amount: 3 }]);
    other.alive = false;
    full.fire("horseDeath", other, null, "combat");
    assert.deepEqual(plain(full.grounded).map((row) => [row.item, row.amount]), [["bread", 3]]);
    assert.deepEqual(plain(full.grounded[0].position), { x: 7, y: 8, z: 9 });
});

test("a horse that is not kept has no alforjes to save", () => {
    const sut = load();
    assert.equal(sut.horses.saveBags("nao-existe", [{ item: "bread", amount: 1 }]), false);
    assert.deepEqual(plain(sut.horses.bagsOf("nao-existe")), []);
    assert.equal(sut.horses.recordOf("nao-existe"), null);
});

test("while the alforjes are open, and a moment after they close, the player's E is the screen's and not the horse's menu", () => {
    const sut = load();
    const mauro = sut.player(MAURO, "Mauro", 1);
    sut.owned(mauro);
    assert.equal(sut.bags.bagsBusy(mauro.id), false);
    sut.bags.openBags(mauro, null);
    assert.equal(sut.bags.bagsBusy(mauro.id), true);
    sut.fire("stashClose", [...sut.stashes.values()][0], mauro, "closed");
    sut.flush();
    assert.equal(sut.bags.bagsBusy(mauro.id), true, "the last E of the screen may still be on its way");
    assert.equal(sut.bags.bagsBusy(mauro.id, Date.now() + 2_000), false);
});

// ---------------------------------------------------------------------------------------------
// 2026-10-29: "o Alustin colocou itens no cavalo e ao voltar perdeu". `getInventory` answers null once the container is gone, and the last write took that for an empty horse.

test("a screen that closes after the game already took the container leaves the horse with what it carried, whichever way it ends", () => {
    for (const ending of ["closed", "disconnected", "destroyed", "lostAccess", "timeout"]) {
        const sut = load();
        const mauro = sut.player(MAURO, "Mauro", 1);
        sut.owned(mauro);
        sut.bags.openBags(mauro, null);
        const stash = [...sut.stashes.values()][0];
        stash.put("bread", 4);
        stash.put("apple", 2);
        const key = sut.horses.horsesOf(MAURO)[0].record.key;
        stash.vanish();
        sut.fire("stashClose", stash, mauro, ending);
        sut.flush();
        assert.deepEqual(plain(sut.horses.bagsOf(key)).map((row) => [row.item, row.amount]), [["bread", 4], ["apple", 2]], ending);
        assert.ok(sut.logs.some((line) => /já tinham sumido do jogo/.test(line)), `${ending}: the log says the container was gone`);
    }
});

test("a player who leaves, or a server that stops, after the container is gone does not empty the horse either", () => {
    const sut = load();
    const mauro = sut.player(MAURO, "Mauro", 1);
    sut.owned(mauro);
    sut.bags.openBags(mauro, null);
    const stash = [...sut.stashes.values()][0];
    stash.put("bread", 4);
    const key = sut.horses.horsesOf(MAURO)[0].record.key;
    stash.vanish();
    sut.fire("stashInventoryChanged", stash, null, { reason: "deposit" });
    sut.fire("resourceStop", "kcdc-gamemode");
    sut.fire("playerDisconnect", mauro);
    sut.flush();
    assert.deepEqual(plain(sut.horses.bagsOf(key)).map((row) => [row.item, row.amount]), [["bread", 4]]);
});

test("a container that throws when read is not an empty horse", () => {
    const sut = load();
    const mauro = sut.player(MAURO, "Mauro", 1);
    sut.owned(mauro);
    sut.bags.openBags(mauro, null);
    const stash = [...sut.stashes.values()][0];
    stash.put("bread", 4);
    const key = sut.horses.horsesOf(MAURO)[0].record.key;
    stash.getInventory = () => { throw new Error("stash 900 is gone"); };
    sut.fire("playerDisconnect", mauro);
    sut.flush();
    assert.deepEqual(plain(sut.horses.bagsOf(key)).map((row) => [row.item, row.amount]), [["bread", 4]]);
});

test("a screen emptied by the player does empty the horse, and the container's whole 128 rows are kept", () => {
    const sut = load();
    const mauro = sut.player(MAURO, "Mauro", 1);
    sut.owned(mauro);
    sut.bags.openBags(mauro, null);
    const stash = [...sut.stashes.values()][0];
    const key = sut.horses.horsesOf(MAURO)[0].record.key;
    assert.equal(sut.horses.MAX_BAG_ROWS, 128, "the game's container takes 128 rows");
    for (let n = 0; n < 128; n += 1) stash.put(`i${n}`, 1);
    assert.equal(sut.horses.bagsOf(key).length, 128, "a full container is kept whole");
    for (let n = 0; n < 128; n += 1) stash.take(`i${n}`);
    sut.fire("stashClose", stash, mauro, "closed");
    sut.flush();
    assert.equal(sut.horses.bagsOf(key).length, 0, "taking everything out is an empty horse");
});

test("rows that cannot be kept are said in the log, not dropped in silence", () => {
    const sut = load();
    const mauro = sut.player(MAURO, "Mauro", 1);
    sut.owned(mauro);
    const key = sut.horses.horsesOf(MAURO)[0].record.key;
    sut.horses.saveBags(key, [{ item: "bread", amount: 2 }, { item: "pear", amount: 1.5 }, { item: "", amount: 1 }]);
    assert.ok(sut.logs.some((line) => /2 linha\(s\) de 3 não puderam ser guardadas/.test(line)), sut.logs.join(" | "));
    assert.deepEqual(plain(sut.horses.bagsOf(key)).map((row) => row.item), ["bread"]);
});
