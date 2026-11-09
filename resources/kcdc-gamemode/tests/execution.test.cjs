"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

// The administrators' execution (src/server/execution.ts and sentences.ts, 2026-11-04): the death screen for a player who is in the game, a sentence written down for one who is not, the character deleted
// when the screen's counter ends, a pardon for a sentence that waits.

const HANS = "76561198000000001";
const GRETA = "76561198000000002";
const ADMIN = "76561198000000003";

function fakeDisk(seed) {
    const files = new Map(seed === undefined ? [] : [["playerdata/executions.json", typeof seed === "string" ? seed : JSON.stringify(seed)]]);
    return {
        files,
        fs: {
            readFileSync(file) {
                if (!files.has(file)) {
                    const error = new Error("ENOENT");
                    error.code = "ENOENT";
                    throw error;
                }
                return files.get(file);
            },
            writeFileSync(file, data) { files.set(file, data); },
            mkdirSync() {},
            renameSync(from, to) { files.set(to, files.get(from)); files.delete(from); },
            existsSync: (file) => files.has(file),
        },
    };
}

function load({ seed, admin = true, resetOk = true, language = "pt" } = {}) {
    const disk = fakeDisk(seed);
    const storeSandbox = { exports: {}, require: () => disk.fs };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/store.js"), "utf8"), storeSandbox);
    const logs = [];
    const sentSandbox = { exports: {}, require: (id) => (id === "./store.js" ? storeSandbox.exports : assert.fail(`unexpected require ${id}`)), console: { log: (line) => logs.push(line) }, Date };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/sentences.js"), "utf8"), sentSandbox);
    const state = { handlers: new Map(), client: new Map(), timers: [], intervals: [], resets: [], notices: [], rosters: 0, now: 1_000_000, players: [], logs };
    const accounts = new Map();
    const context = {
        exports: {},
        require: (id) => ({
            "./auth.js": { isAdmin: (player) => admin && player.steamId === ADMIN },
            "./character-reset.js": { resetCharacter: (player, now, options) => { state.resets.push({ steamId: player.steamId, options: { ...options } }); return resetOk ? { ok: true, message: "ok" } : { ok: false, message: "nada foi apagado" }; } },
            "./language.js": { languageOf: () => language },
            "./sentences.js": sentSandbox.exports,
            "./status.js": {
                accountOfTarget: (id) => accounts.get(id) ?? null,
                goneText: () => "Esse jogador não foi encontrado.",
                notice: (player, text) => state.notices.push(text),
                sendRoster: () => { state.rosters += 1; },
            },
        })[id] ?? assert.fail(`unexpected require ${id}`),
        console: { log: (line) => logs.push(line) },
        Date: { now: () => state.now },
        JSON,
        Player: { all: () => state.players },
        Events: { on: (name, fn) => state.handlers.set(name, fn), onClient: (name, fn) => state.client.set(name, fn) },
        setTimeout: (fn, ms) => { state.timers.push({ fn, ms, cleared: false }); return state.timers.length; },
        clearTimeout: (handle) => { if (state.timers[handle - 1]) state.timers[handle - 1].cleared = true; },
        setInterval: (fn, ms) => { state.intervals.push({ fn, ms, cleared: false }); return state.intervals.length; },
        clearInterval: (handle) => { if (state.intervals[handle - 1]) state.intervals[handle - 1].cleared = true; },
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/execution.js"), "utf8"), context);
    let nextId = 1;
    const emitted = [];
    const player = (name, steamId, extra = {}) => {
        const body = { id: nextId++, nickname: name, steamId, ready: true, alive: true, emit: (event, payload) => emitted.push({ to: name, event: event.replace("kcdc-gamemode:", ""), payload: JSON.parse(payload) }), ...extra };
        state.players.push(body);
        return body;
    };
    const account = (id, steamId, name, body = null) => accounts.set(id, { steamId, name, player: body });
    const file = () => (disk.files.has("playerdata/executions.json") ? JSON.parse(disk.files.get("playerdata/executions.json")) : null);
    return { api: context.exports, sentences: sentSandbox.exports.sentences, state, player, account, emitted, file, logs, disk };
}

const plain = (value) => JSON.parse(JSON.stringify(value));

test("a sentence is written down with who gave it, read back, taken out, and a file that cannot be read is left alone", () => {
    const sut = load();
    sut.sentences.load();
    assert.equal(sut.sentences.count(), 0);
    assert.equal(sut.sentences.add(HANS, "Hans", "Mauro"), true);
    assert.equal(sut.sentences.add(HANS, "Hans", "Mauro"), false, "once");
    assert.equal(sut.sentences.add("not-a-steam-id", "x", "y"), false);
    assert.equal(sut.sentences.has(HANS), true);
    assert.deepEqual(Object.keys(sut.file().pending), [HANS]);
    assert.equal(sut.file().pending[HANS].by, "Mauro");

    const again = load({ seed: { v: 1, pending: { [GRETA]: { name: "Greta", by: "Mauro", at: 5 }, bad: { name: "x" } } } });
    again.sentences.load();
    assert.equal(again.sentences.count(), 1, "what is not an account is left out");
    assert.equal(again.sentences.remove(GRETA), true);
    assert.equal(again.sentences.remove(GRETA), false);
    assert.deepEqual(again.file().pending, {});

    const broken = load({ seed: "{ not json" });
    broken.sentences.load();
    assert.equal(broken.sentences.canWrite, false);
    assert.equal(broken.sentences.add(HANS, "Hans", "Mauro"), false);
    assert.equal(broken.disk.files.get("playerdata/executions.json"), "{ not json", "not written over");
});

test("the screen is the death screen, standing, with the line in the player's language and the counter of nine seconds", () => {
    assert.deepEqual(plain(load().api.screenFor("pt")), { text: "Você foi executado.", ref: "Por ordem da administração do reino", label: "De volta ao menu principal em" });
    assert.equal(load().api.screenFor("en").text, "You have been executed.");
    assert.equal(load().api.EXECUTION_SECONDS, 9);
});

test("a sentence on somebody in the game puts the screen up at once, and the character is deleted when its counter ends, with the reason for the menu", () => {
    const sut = load();
    sut.sentences.load();
    const hans = sut.player("Hans", HANS);
    sut.account(11, HANS, "Hans", hans);
    const outcome = sut.api.sentence({ steamId: HANS, name: "Hans", player: hans }, "Mauro");
    assert.equal(outcome.ok, true);
    assert.match(outcome.message, /a tela da execução aparece para ele\(a\) agora/);
    assert.equal(sut.emitted.length, 1);
    assert.equal(sut.emitted[0].event, "death.begin");
    assert.deepEqual(plain(sut.emitted[0].payload), { seconds: 9, standing: true, text: "Você foi executado.", ref: "Por ordem da administração do reino", label: "De volta ao menu principal em" });
    assert.equal(sut.api.isBeingExecuted(hans), true);
    assert.deepEqual(sut.state.resets, [], "nothing is deleted while the screen counts");
    assert.equal(sut.sentences.has(HANS), true);
    const timer = sut.state.timers.at(-1);
    assert.equal(timer.ms, 9_000);
    timer.fn();
    assert.equal(sut.state.resets.length, 1);
    assert.equal(sut.state.resets[0].steamId, HANS);
    assert.match(sut.state.resets[0].options.reason, /Você foi executado\. Entre de novo no servidor para criar um novo personagem/);
    assert.equal(sut.state.resets[0].options.kickAfterMs, 1_200);
    assert.equal(sut.sentences.has(HANS), false, "carried out: taken out of the file");
    assert.deepEqual(sut.file().pending, {});
    assert.equal(sut.api.isBeingExecuted(hans), false);
    assert.ok(sut.logs.some((line) => /execution: Hans foi executado \(sentença de Mauro\)/.test(line)));
});

test("somebody who is not in the game is sentenced for when they come in: the screen starts a few seconds after the body is in the world, from the look every three seconds", () => {
    const sut = load();
    sut.sentences.load();
    sut.api.installExecution();
    const outcome = sut.api.sentence({ steamId: HANS, name: "Hans", player: null }, "Mauro");
    assert.equal(outcome.ok, true);
    assert.match(outcome.message, /não está no jogo: a execução será cumprida quando entrar/);
    assert.equal(sut.sentences.has(HANS), true);
    assert.equal(sut.state.intervals.find((one) => one.ms === 3_000) !== undefined, true, "the look");
    const hans = sut.player("Hans", HANS);
    sut.state.handlers.get("playerSpawned")(hans);
    assert.equal(sut.api.look(sut.state.now + 1_000), 0, "a moment first: the client has to have its page");
    assert.equal(sut.emitted.length, 0);
    assert.equal(sut.api.look(sut.state.now + 6_000), 1);
    assert.equal(sut.emitted[0].event, "death.begin");
    assert.equal(sut.api.look(sut.state.now + 9_000), 0, "once");
    // The player who is dead or not ready waits.
    const greta = sut.player("Greta", GRETA, { alive: false });
    sut.sentences.add(GRETA, "Greta", "Mauro");
    sut.state.handlers.get("playerSpawned")(greta);
    assert.equal(sut.api.look(sut.state.now + 20_000), 0);
    greta.alive = true;
    assert.equal(sut.api.look(sut.state.now + 20_000), 1);
});

test("a player who leaves in the middle of the screen is not executed, and the sentence waits for the next entry", () => {
    const sut = load();
    sut.sentences.load();
    sut.api.installExecution();
    const hans = sut.player("Hans", HANS);
    sut.sentences.add(HANS, "Hans", "Mauro");
    assert.equal(sut.api.beginExecution(hans), true);
    sut.state.handlers.get("playerDisconnect")(hans);
    assert.equal(sut.state.timers.at(-1).cleared, true);
    assert.equal(sut.api.isBeingExecuted(hans), false);
    assert.deepEqual(sut.state.resets, []);
    assert.equal(sut.sentences.has(HANS), true);
    // The id passes to somebody else before the timer would have fired: it is the account that is executed.
    const sut2 = load();
    sut2.sentences.load();
    const first = sut2.player("Hans", HANS);
    sut2.sentences.add(HANS, "Hans", "Mauro");
    sut2.api.beginExecution(first);
    first.steamId = GRETA;
    sut2.state.timers.at(-1).fn();
    assert.deepEqual(sut2.state.resets, []);
});

test("the sentence is refused twice, for an unreadable file, and the screen is not put up on a body that is not ready", () => {
    const sut = load();
    sut.sentences.load();
    const hans = sut.player("Hans", HANS);
    assert.equal(sut.api.sentence({ steamId: HANS, name: "Hans", player: hans }, "Mauro").ok, true);
    assert.match(sut.api.sentence({ steamId: HANS, name: "Hans", player: hans }, "Mauro").message, /já está condenado/);
    const broken = load({ seed: "{ nope" });
    broken.sentences.load();
    assert.match(broken.api.sentence({ steamId: HANS, name: "Hans", player: null }, "Mauro").message, /ninguém foi condenado/);
    const sleeping = load();
    sleeping.sentences.load();
    const dead = sleeping.player("Hans", HANS, { alive: false });
    sleeping.sentences.add(HANS, "Hans", "Mauro");
    assert.equal(sleeping.api.beginExecution(dead), false);
    assert.equal(sleeping.api.beginExecution(sleeping.player("Greta", GRETA)), false, "nobody sentenced");
});

test("a pardon takes back a sentence that waits, and none whose screen is up", () => {
    const sut = load();
    sut.sentences.load();
    sut.sentences.add(HANS, "Hans", "Mauro");
    assert.match(sut.api.pardon({ steamId: HANS, name: "Hans", player: null }, "Mauro").message, /foi perdoado/);
    assert.equal(sut.sentences.has(HANS), false);
    assert.match(sut.api.pardon({ steamId: HANS, name: "Hans", player: null }, "Mauro").message, /não está condenado/);
    const hans = sut.player("Hans", HANS);
    sut.sentences.add(HANS, "Hans", "Mauro");
    sut.api.beginExecution(hans);
    const late = sut.api.pardon({ steamId: HANS, name: "Hans", player: hans }, "Mauro");
    assert.equal(late.ok, false);
    assert.match(late.message, /já começou e não pode ser cancelada/);
    assert.equal(sut.sentences.has(HANS), true);
});

test("the page's events: only an administrator, never on oneself, and the answer goes to the administrator with the roster again", () => {
    const sut = load();
    sut.sentences.load();
    sut.api.installExecution();
    const admin = sut.player("Mauro", ADMIN);
    const hans = sut.player("Hans", HANS);
    sut.account(11, HANS, "Hans", hans);
    sut.account(12, ADMIN, "Mauro", admin);
    const execute = sut.state.client.get("kcdc-gamemode:status.execute");
    execute(hans, JSON.stringify({ targetId: 11 }));
    assert.equal(sut.sentences.has(HANS), false, "a player may not");
    assert.deepEqual(sut.state.notices, []);
    execute(admin, JSON.stringify({ targetId: 12 }));
    assert.deepEqual(sut.state.notices, ["Você não pode executar a si mesmo."]);
    execute(admin, JSON.stringify({ targetId: 999 }));
    assert.equal(sut.state.notices.at(-1), "Esse jogador não foi encontrado.");
    execute(admin, { targetId: 11 });
    assert.equal(sut.sentences.has(HANS), true);
    assert.match(sut.state.notices.at(-1), /Hans foi condenado/);
    assert.ok(sut.state.rosters >= 1);
    const pardon = sut.state.client.get("kcdc-gamemode:status.pardon");
    pardon(hans, JSON.stringify({ targetId: 11 }));
    assert.equal(sut.sentences.has(HANS), true, "a player may not pardon either");
    sut.api.beginExecution(hans);
    pardon(admin, JSON.stringify({ targetId: 11 }));
    assert.match(sut.state.notices.at(-1), /já começou/);
});

test("the English screen for a player who plays in English", () => {
    const sut = load({ language: "en" });
    sut.sentences.load();
    const hans = sut.player("Hans", HANS);
    sut.sentences.add(HANS, "Hans", "Mauro");
    sut.api.beginExecution(hans);
    assert.equal(sut.emitted[0].payload.text, "You have been executed.");
    assert.equal(sut.emitted[0].payload.label, "Back to the main menu in");
});
