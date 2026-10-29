const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const inventoryAdd = require("./inventory-add-module.cjs");

const DAY = 24 * 60 * 60 * 1000;
const plainOf = (value) => JSON.parse(JSON.stringify(value));

function fakeStore(files) {
    return {
        ensureDir() {},
        read: (file) => (files.has(file) ? { status: "ok", value: JSON.parse(files.get(file)), fromBackup: false } : { status: "missing" }),
        write: (file, value) => files.set(file, JSON.stringify(value)),
    };
}

function loadThieves({ files = new Map(), players = [] } = {}) {
    const logs = [];
    const context = {
        exports: {},
        require: (id) => (id === "./store.js" ? fakeStore(files) : assert.fail(`unexpected require ${id}`)),
        console: { log: (line) => logs.push(line) },
        Date,
        Player: { all: () => players },
        setInterval: () => 1,
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/thieves.js"), "utf8"), context);
    return { api: context.exports, files, logs };
}

test("a thief is marked for a day, the mark is kept on disk and redrawn over the head, and a pardon takes it off", () => {
    const pufz = { steamId: "765", nickname: "Pufzilla" };
    const { api, files, logs } = loadThieves({ players: [pufz] });
    const redrawn = [];
    api.onThiefChange((player) => redrawn.push(player.nickname));
    const now = 1_800_000_000_000;
    assert.equal(api.thiefMark("765", now), null);
    api.markThief("765", "Pufzilla", "roubou o Baú 4 (de Radovan)", now);
    assert.equal(api.thiefMark("765", now + DAY - 1).reason, "roubou o Baú 4 (de Radovan)");
    assert.equal(api.thiefMark("765", now + DAY), null, "a day and it is gone");
    assert.equal(JSON.parse(files.get("playerdata/thieves.json"))["765"].until, now + DAY);
    assert.deepEqual(redrawn, ["Pufzilla"]);
    assert.ok(logs.some((line) => /thieves: Pufzilla marcado como ladrão/.test(line)));
    assert.equal(api.thieves(now).length, 1);

    // A restart reads it back.
    const again = loadThieves({ files });
    assert.equal(again.api.thiefMark("765", now + DAY / 2).name, "Pufzilla");

    assert.equal(api.clearThief("765"), true);
    assert.equal(api.thiefMark("765", now), null);
    assert.equal(api.clearThief("765"), false);
    assert.deepEqual(redrawn, ["Pufzilla", "Pufzilla"]);
    assert.equal(api.markThief("", "Ninguém", "x", now), null, "no Steam id, no mark");
});

function loadRestitution({ files = new Map(), refuse = [] } = {}) {
    const chat = [];
    const added = [];
    const handlers = new Map();
    const context = {
        exports: {},
        require: (id) => (id === "./store.js" ? fakeStore(files) : id === "./inventory-add.js" ? inventoryAdd(context) : assert.fail(`unexpected require ${id}`)),
        console: { log() {} },
        Inventory: { add: (player, row) => { if (refuse.includes(row.item)) return { ok: false }; added.push(row); return { ok: true }; } },
        Chat: { sendToPlayer: (player, text) => chat.push(text) },
        Events: { on: (name, fn) => handlers.set(name, fn) },
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/restitution.js"), "utf8"), context);
    return { api: context.exports, files, chat, added, handlers };
}

test("what is owed goes into the inventory when it is ready; what does not fit waits for the next entry", () => {
    const owed = { "906": { rows: [{ item: "sword", amount: 1, metadata: { quality: 3 } }, { item: "herb", amount: 285 }, { item: "helmet", amount: 1 }], reason: "Itens roubados" } };
    const files = new Map([["playerdata/restitution.json", JSON.stringify(owed)]]);
    const sut = loadRestitution({ files, refuse: ["helmet"] });
    sut.api.installRestitution();
    const radovan = { steamId: "906", nickname: "Radovan" };
    sut.handlers.get("playerInventoryReady")(radovan);
    assert.deepEqual(sut.added.map((row) => [row.item, row.amount]), [["sword", 1], ["herb", 285]]);
    assert.equal(sut.added[0].metadata.quality, 3, "the quality comes back with it");
    assert.match(sut.chat.at(-1), /Itens roubados: parte voltou/);
    assert.deepEqual(JSON.parse(files.get("playerdata/restitution.json"))["906"].rows.map((row) => row.item), ["helmet"]);

    const next = loadRestitution({ files });
    assert.equal(next.api.deliverOwed(radovan), 1);
    assert.match(next.chat.at(-1), /tudo voltou para o seu inventário \(1 item\)/);
    assert.equal(JSON.parse(files.get("playerdata/restitution.json"))["906"], undefined);
    assert.equal(next.api.deliverOwed(radovan), 0, "nothing twice");
});

test("more than three different chests robbed within the hour, and only then, mark the thief; the same chest twice counts once", () => {
    const { api } = loadThieves();
    const t0 = 1_800_000_000_000;
    const minute = 60_000;
    assert.deepEqual(plainOf(api.noteTheft("9", "Bruno", "c1", "roubou o Baú 1", t0)), { count: 1, mark: null });
    assert.equal(api.noteTheft("9", "Bruno", "c1", "roubou o Baú 1", t0 + minute).count, 1, "the same chest again");
    api.noteTheft("9", "Bruno", "c2", "roubou o Baú 2", t0 + 2 * minute);
    assert.equal(api.noteTheft("9", "Bruno", "c3", "roubou o Baú 3", t0 + 3 * minute).mark, null, "three chests: not yet");
    const fourth = api.noteTheft("9", "Bruno", "c4", "roubou o Baú 4", t0 + 4 * minute);
    assert.equal(fourth.count, 4);
    assert.match(fourth.mark.reason, /roubou o Baú 4 \(4 baús em menos de uma hora\)/);
    assert.equal(api.thiefMark("9", t0 + 4 * minute + DAY - 1).name, "Bruno");
    assert.equal(api.thiefMark("9", t0 + 4 * minute + DAY), null, "one day");

    // Slowly, an hour apart, nobody is marked.
    for (let n = 0; n < 6; n += 1) {
        assert.equal(api.noteTheft("8", "Lenta", `s${n}`, "roubou", t0 + n * 61 * minute).mark, null);
    }
    assert.equal(api.noteTheft("", "x", "c", "r", t0).count, 0);
});
