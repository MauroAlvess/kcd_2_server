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

test("the third lock of other players picked within three days, and only then, marks the thief: a gate, a chest and a door; the same lock twice counts once (2026-11-02)", () => {
    const { api, files } = loadThieves();
    const t0 = 1_800_000_000_000;
    const hour = 3_600_000;
    assert.deepEqual(plainOf(api.noteBreakIn("9", "Bruno", "gate", "Portão (de Radovan)", t0)), { count: 1, mark: null });
    assert.equal(api.noteBreakIn("9", "Bruno", "gate", "Portão (de Radovan)", t0 + hour).count, 1, "the same gate again");
    assert.equal(api.noteBreakIn("9", "Bruno", "chest", "Baú 2 (de Radovan)", t0 + 2 * hour).mark, null, "two: not yet");
    assert.equal(api.thiefMark("9", t0 + 2 * hour), null);
    assert.equal(api.breakInsOf("9", t0 + 2 * hour), 2);
    // Kept on disk: a restart does not wipe the count.
    assert.equal(JSON.parse(files.get("playerdata/thief-breakins.json"))["9"].length, 2);
    const third = api.noteBreakIn("9", "Bruno", "door", "Casa 03 · Porta 2 (de Hans)", t0 + 30 * hour);
    assert.equal(third.count, 3);
    assert.match(third.mark.reason, /^arrombou 3 fechaduras de outros jogadores: Portão \(de Radovan\), Baú 2 \(de Radovan\), Casa 03 · Porta 2 \(de Hans\)$/);
    assert.equal(api.thiefMark("9", t0 + 30 * hour + DAY - 1).name, "Bruno");
    assert.equal(api.thiefMark("9", t0 + 30 * hour + DAY), null, "one day");

    // Three days apart each, nobody is marked.
    for (let n = 0; n < 5; n += 1) {
        assert.equal(api.noteBreakIn("8", "Lenta", `s${n}`, "Baú", t0 + n * 73 * hour).mark, null);
    }
    assert.equal(api.noteBreakIn("", "x", "c", "r", t0).count, 0);

    // A pardon takes the mark off and the count with it.
    api.noteBreakIn("7", "Zeca", "a", "A", t0);
    api.noteBreakIn("7", "Zeca", "b", "B", t0);
    assert.ok(api.noteBreakIn("7", "Zeca", "c", "C", t0).mark !== null);
    assert.equal(api.clearThief("7"), true);
    assert.equal(api.breakInsOf("7", t0), 0);
    assert.equal(api.noteBreakIn("7", "Zeca", "d", "D", t0).mark, null, "counting starts again");
});

// A pardon that finds who it is for (2026-11-06, "remover título de ladrão do Shakran"): his mark had run out a day before, four break-ins were still counted (the next would mark him again)
// and the marks are filed under the account's nickname ("Player" for two of them), so the character's name found none.

test("a pardon also takes counted break-ins off when the mark has run out, and says so; `recorded` lists what is on file, run out or not", () => {
    const { api, files } = loadThieves();
    const t0 = 1_800_000_000_000;
    const hour = 3_600_000;
    for (const [part, at] of [["a", t0], ["b", t0 + hour], ["c", t0 + 2 * hour], ["d", t0 + 3 * hour]]) api.noteBreakIn("889", "Player", part, `Porta ${part}`, at);
    assert.ok(api.thiefMark("889", t0 + 3 * hour) !== null);
    const later = t0 + 2 * DAY; // the mark ran out a day after the last break-in; the four still count for three
    assert.equal(api.thiefMark("889", later), null, "run out");
    assert.equal(api.thieves(later).length, 0, "/ladrao no longer lists it");
    assert.deepEqual(plainOf(api.recorded(later)), [{ steamId: "889", name: "Player", breakIns: 4 }], "but it is on file");

    assert.equal(api.clearThief("889"), true, "something was taken off");
    assert.deepEqual(plainOf(api.recorded(later)), []);
    assert.equal(JSON.parse(files.get("playerdata/thief-breakins.json"))["889"], undefined);
    assert.equal(api.noteBreakIn("889", "Player", "e", "Porta e", later).mark, null, "counting starts again: the next one does not mark him");
    assert.equal(api.clearThief("889"), true, "one break-in counted is something too");
    assert.equal(api.clearThief("889"), false, "nothing left");
    assert.equal(api.clearThief("nobody"), false);
});

function loadLadrao({ characters = [], online = [] } = {}) {
    const files = new Map();
    const thievesBox = loadThieves({ files });
    const replies = [];
    const context = {
        exports: {},
        require: (id) =>
            ({
                "../characters.js": { allCharacters: () => characters },
                "../players.js": { findPlayer: (query) => { const hit = online.find((p) => p.nickname.toLowerCase() === query.toLowerCase()); return hit ? { player: hit } : { error: `no player '${query}'` }; } },
                "../roster.js": { fold: (text) => String(text).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase() },
                "../thieves.js": thievesBox.api,
            })[id] ?? assert.fail(`unexpected require ${id}`),
        console: { log() {} },
        Math,
        Number,
        Date,
        Array,
        String,
        Map,
        Set,
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/commands/ladrao.js"), "utf8"), context);
    const run = (who) => {
        replies.length = 0;
        context.exports.ladraoCommand.run({ player: { nickname: "Admin" }, args: ["perdoar", who], reply: { line: (text) => replies.push(text), lines: (list) => replies.push(...list) }, usage: () => replies.push("usage") });
        return [...replies];
    };
    return { api: thievesBox.api, files, run, recordedNamed: context.exports.recordedNamed };
}

test("/ladrao perdoar finds the character by the name made in the creator, offline and with the mark run out, and refuses two of the same name", () => {
    const characters = [
        { steamId: "889", name: "Shakran", epithet: "", nickname: "Player", named: true },
        { steamId: "671", name: "Gavrilo", epithet: "padre", nickname: "Player", named: true },
        { steamId: "413", name: "Aegon", epithet: "", nickname: "Aegon Storm", named: true },
    ];
    const sut = loadLadrao({ characters });
    const t0 = Date.now() - 2 * DAY;
    for (const [id, nick] of [["889", "Player"], ["671", "Player"]]) for (const part of ["a", "b", "c"]) sut.api.noteBreakIn(id, nick, `${id}${part}`, `Porta ${part}`, t0);
    assert.equal(sut.api.thieves().length, 0, "both marks ran out a day ago");

    assert.match(sut.run("shakran")[0], /^Shakran não é mais marcado como ladrão, e os arrombamentos contados contra ele foram zerados\.$/);
    assert.deepEqual(plainOf(sut.api.recorded().map((row) => row.steamId)), ["671"], "only his record went; the other 'Player' is untouched");

    // Two accounts both called Player: asking for 'player' names neither, it asks for more.
    sut.api.noteBreakIn("889", "Player", "z", "Porta z", Date.now());
    const both = sut.run("player");
    assert.match(both[0], /^Mais de um com 'player': /, both[0]);
    assert.equal(sut.api.recorded().length, 2, "nothing was cleared");
    assert.match(sut.run("gavrilo padre")[0], /^Gavrilo padre não é mais marcado/);

    assert.match(sut.run("ninguem")[0], /no player 'ninguem'/, "unknown: the error of the lookup");
});
