"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

// What is over a head is read only by who knows the one it is over (src/server/head-labels.ts, 2026-11-04), and death forgets (acquaintances.ts): the real two modules over a fake disk.

const RESOURCE = "kcdc-gamemode";

function fakeDisk() {
    const files = new Map();
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

const NAMES = (() => {
    const box = { exports: {} };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/character-name.js"), "utf8"), box);
    return box.exports;
})();

function load() {
    const disk = fakeDisk();
    const storeSandbox = { exports: {}, require: () => disk.fs };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/store.js"), "utf8"), storeSandbox);
    const logs = [];
    const chats = [];
    const handlers = new Map();
    const clientHandlers = new Map();
    const timers = [];
    const players = [];
    // What each player wears over the head: the title or mark `titles.ts` would say, by Steam id.
    const heads = new Map();
    const headListeners = [];
    const accounts = { exports: {} };
    const common = {
        console: { log: (line) => logs.push(line), error: (line) => logs.push(line) },
        Date,
        Events: { on: (name, fn) => handlers.set(name, fn), onClient: (name, fn) => clientHandlers.set(name, fn) },
        Chat: { sendToPlayer: (player, text) => chats.push([player.nickname, text]) },
        Player: { all: () => players.filter((player) => !player.gone) },
        setTimeout: (fn, ms) => { timers.push({ fn, ms, ran: false }); return timers.length; },
        clearTimeout: (id) => { if (timers[id - 1]) timers[id - 1].ran = true; },
    };
    accounts.require = (id) => {
        if (id === "./store.js") return storeSandbox.exports;
        if (id === "./family.js") return { getSurname: () => null };
        if (id === "./character-name.js") return NAMES;
        if (id === "./characters.js") return { getCharacter: () => null };
        assert.fail(`unexpected require ${id}`);
    };
    Object.assign(accounts, common);
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/acquaintances.js"), "utf8"), accounts);

    const labels = { exports: {}, ...common };
    labels.require = (id) => {
        if (id === "./acquaintances.js") return accounts.exports;
        if (id === "./titles.js") return { headOf: (player) => heads.get(player.steamId) ?? null, onHeadChange: (fn) => headListeners.push(fn) };
        assert.fail(`unexpected require ${id}`);
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/head-labels.js"), "utf8"), labels);
    accounts.exports.installAcquaintances();
    labels.exports.installHeadLabels();

    let nextId = 100;
    const emitted = [];
    const player = (nickname, steamId = `7656119800000${String(nextId).padStart(4, "0")}`) => {
        const body = {
            id: nextId++, nickname, steamId, ready: true, gone: false, appearance: { gender: "male" },
            emit(event, payload) { emitted.push({ to: this.nickname, event, payload: JSON.parse(payload) }); },
        };
        players.push(body);
        return body;
    };
    /** Runs the pending telling, as the clock reaching its time would. */
    const flush = () => {
        for (const timer of timers) {
            if (!timer.ran) {
                timer.ran = true;
                timer.fn();
            }
        }
    };
    const lastFor = (nickname) => emitted.filter((entry) => entry.to === nickname && entry.event === `${RESOURCE}:head.labels`).at(-1)?.payload.labels;
    return { acq: accounts.exports, labels: labels.exports, logs, chats, handlers, clientHandlers, timers, players, heads, headListeners, emitted, player, flush, lastFor };
}

const KNIGHT = { text: "Cavaleiro de Suchdol", colour: 0xffd5a156 };
const THIEF = { text: "Ladrão", colour: 0xffd23c32 };

test("a stranger reads nothing over a head; whoever has been introduced to the wearer, either way, reads it; nobody reads their own", () => {
    const sut = load();
    const hans = sut.player("Hans");
    const kat = sut.player("Katerina");
    const stranger = sut.player("Ota");
    sut.heads.set(hans.steamId, KNIGHT);
    const readable = (viewer) => JSON.parse(JSON.stringify(sut.labels.labelsFor(viewer, sut.players)));
    assert.deepEqual(readable(kat), [], "nobody has been told anything");
    sut.acq.introduce(hans, kat);
    assert.deepEqual(readable(kat), [{ id: hans.id, text: "Cavaleiro de Suchdol", colour: 0xffd5a156 }], "Hans told Katerina his name: she reads his title");
    assert.deepEqual(readable(stranger), [], "Ota was told nothing");
    assert.deepEqual(readable(hans), [], "never their own: they know themselves, and that is not what the label is for");
    // An introduction is read both ways: Hans told Katerina his name, so Hans has been introduced to her too, and reads her mark.
    sut.heads.set(kat.steamId, THIEF);
    assert.deepEqual(readable(hans), [{ id: kat.id, text: "Ladrão", colour: 0xffd23c32 }], "introduced, whichever way");
    assert.deepEqual(readable(stranger), [], "and a stranger to both still reads nothing");
});

test("a player with nothing over the head, or with no Steam id, has no label", () => {
    const sut = load();
    const hans = sut.player("Hans");
    const kat = sut.player("Katerina");
    const ghost = sut.player("Sem Steam", "");
    sut.acq.introduce(hans, kat);
    assert.deepEqual(JSON.parse(JSON.stringify(sut.labels.labelsFor(kat, sut.players))), [], "Hans wears nothing");
    sut.heads.set(ghost.steamId, KNIGHT);
    assert.deepEqual(JSON.parse(JSON.stringify(sut.labels.labelsFor(kat, sut.players))), [], "no Steam id, nobody can know them");
});

test("a title put on, a mark, an introduction or a player coming in is told to everybody a moment later, once, and only to those whose list changed", () => {
    const sut = load();
    const hans = sut.player("Hans");
    const kat = sut.player("Katerina");
    sut.heads.set(hans.steamId, KNIGHT);
    sut.acq.introduce(hans, kat);
    sut.flush();
    assert.deepEqual(JSON.parse(JSON.stringify(sut.lastFor("Katerina"))), [{ id: hans.id, text: "Cavaleiro de Suchdol", colour: 0xffd5a156 }]);
    assert.deepEqual(JSON.parse(JSON.stringify(sut.lastFor("Hans"))), [], "Hans has an empty list to start");
    const before = sut.emitted.length;
    sut.flush();
    assert.equal(sut.emitted.length, before, "nothing changed: nobody is told again");

    // The title taken off: a head change, told after a moment; only Katerina's list changes.
    sut.heads.delete(hans.steamId);
    sut.headListeners[0](hans);
    sut.headListeners[0](hans);
    assert.equal(sut.timers.filter((timer) => !timer.ran).length, 1, "two changes in a burst wait for one telling");
    assert.equal(sut.timers.at(-1).ms, sut.labels.TELL_AFTER_MS);
    sut.flush();
    assert.deepEqual(JSON.parse(JSON.stringify(sut.lastFor("Katerina"))), [], "taken off for her");
    assert.equal(sut.emitted.filter((entry) => entry.to === "Hans").length, 1, "Hans's list did not change: he was not told again");
});

test("the client's ask is answered at once with the whole list, even a list it was already told; one who is not in the game yet is not told", () => {
    const sut = load();
    const hans = sut.player("Hans");
    const kat = sut.player("Katerina");
    sut.heads.set(hans.steamId, KNIGHT);
    sut.acq.introduce(hans, kat);
    kat.ready = false;
    sut.flush();
    assert.equal(sut.lastFor("Katerina"), undefined, "still loading: nothing sent to a client that cannot use it");
    kat.ready = true;
    sut.clientHandlers.get(`${RESOURCE}:head.ask`)(kat);
    assert.equal(sut.lastFor("Katerina").length, 1);
    const count = sut.emitted.length;
    sut.clientHandlers.get(`${RESOURCE}:head.ask`)(kat);
    assert.equal(sut.emitted.length, count + 1, "asked again: told again");
});

test("somebody who leaves drops out of everybody's list, and a new body is told its own", () => {
    const sut = load();
    const hans = sut.player("Hans");
    const kat = sut.player("Katerina");
    sut.heads.set(hans.steamId, KNIGHT);
    sut.acq.introduce(hans, kat);
    sut.flush();
    assert.equal(sut.lastFor("Katerina").length, 1);
    hans.gone = true;
    sut.handlers.get("playerDisconnect")(hans);
    sut.flush();
    assert.deepEqual(JSON.parse(JSON.stringify(sut.lastFor("Katerina"))), []);
    const ota = sut.player("Ota");
    sut.handlers.get("playerSpawned")(ota);
    sut.flush();
    assert.deepEqual(JSON.parse(JSON.stringify(sut.lastFor("Ota"))), []);
});

test("death forgets, both ways: the one who died is a stranger to everybody and knows nobody, the others keep knowing each other; the one who died is told", () => {
    const sut = load();
    const hans = sut.player("Hans");
    const kat = sut.player("Katerina");
    const ota = sut.player("Ota");
    sut.heads.set(hans.steamId, KNIGHT);
    sut.heads.set(ota.steamId, THIEF);
    sut.acq.introduce(hans, kat); // Katerina knows Hans
    sut.acq.introduce(hans, ota);
    sut.acq.introduce(kat, hans); // Hans knows Katerina
    sut.acq.introduce(kat, ota); // Ota knows Katerina
    sut.acq.introduce(ota, kat); // Katerina knows Ota
    sut.flush();
    assert.deepEqual(JSON.parse(JSON.stringify(sut.lastFor("Katerina").map((label) => label.text))).sort(), ["Cavaleiro de Suchdol", "Ladrão"]);

    sut.handlers.get("playerDied")(hans, null, "combat");
    assert.equal(sut.acq.knows(kat, hans), false, "Katerina no longer knows Hans");
    assert.equal(sut.acq.knows(ota, hans), false);
    assert.equal(sut.acq.knows(hans, kat), false, "Hans no longer knows Katerina");
    assert.equal(sut.acq.knows(kat, ota), true, "the others keep knowing each other");
    assert.equal(sut.acq.knows(ota, kat), true);
    assert.deepEqual(sut.chats, [["Hans", sut.acq.DEATH_FORGETS]], "only the one who died is told");
    assert.ok(sut.logs.some((line) => /Hans morreu: ninguém o conhece mais/.test(line)));

    sut.flush();
    assert.deepEqual(JSON.parse(JSON.stringify(sut.lastFor("Katerina"))), [{ id: ota.id, text: "Ladrão", colour: 0xffd23c32 }], "Hans's title is gone from her head, the thief's stays");
    assert.deepEqual(JSON.parse(JSON.stringify(sut.lastFor("Ota"))), [], "Ota knew Hans, not himself: he reads nothing now");

    // Dying again, with nobody to forget, says nothing.
    sut.handlers.get("playerDied")(hans, null, "combat");
    assert.equal(sut.chats.length, 1);
    // They are introduced again, and the title is read again.
    sut.acq.introduce(hans, kat);
    sut.flush();
    assert.equal(sut.lastFor("Katerina").length, 2);
});

test("forgetOnDeath is for a player with a Steam id and something to forget; the file keeps what is forgotten", () => {
    const sut = load();
    const hans = sut.player("Hans");
    const kat = sut.player("Katerina");
    assert.equal(sut.acq.forgetOnDeath(""), false);
    assert.equal(sut.acq.forgetOnDeath(hans.steamId), false, "nobody knows him and he knows nobody");
    sut.acq.introduce(hans, kat);
    assert.equal(sut.acq.forgetOnDeath(hans.steamId), true);
    assert.equal(sut.acq.knows(kat, hans), false);
    assert.equal(sut.acq.forgetOnDeath(hans.steamId), false, "nothing left");
});
