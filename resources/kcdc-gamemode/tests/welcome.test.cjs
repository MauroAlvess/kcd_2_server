"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

// The welcome form's agreement (src/server/welcome.ts, 2026-10-24): whoever has made a character is asked to agree to the rules and the lore, at once and
// at every entry until they do; the agreement is kept for the character it was made for, so that a player who starts over is asked again.

const OPEN = "kcdc-gamemode:welcome.open";
const DONE = "kcdc-gamemode:welcome.done";
const ACCEPT = "kcdc-gamemode:welcome.accept";
const FAILED = "kcdc-gamemode:welcome.failed";
const FILE = "playerdata/welcome.json";
const plain = (value) => JSON.parse(JSON.stringify(value));

function load({ characters = {}, saved = null, lang = "pt", diskFails = false } = {}) {
    const files = new Map();
    if (saved !== null) files.set(FILE, typeof saved === "string" ? saved : JSON.stringify(saved));
    const disk = {
        readFileSync(file) {
            if (!files.has(file)) throw new Error("ENOENT");
            return files.get(file);
        },
        writeFileSync(file, data) {
            if (diskFails && file.endsWith(".tmp")) throw new Error("disk full");
            files.set(file, data);
        },
        mkdirSync() {},
        renameSync(from, to) { files.set(to, files.get(from)); files.delete(from); },
        existsSync: (file) => files.has(file),
    };
    const store = { exports: {}, require: () => disk };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/store.js"), "utf8"), store);
    const state = { logs: [], chat: [], players: [], handlers: new Map(), client: new Map(), intervals: [], titles: 0, characters };
    const context = {
        exports: {},
        require: (id) => ({
            "./store.js": store.exports,
            "./characters.js": { getCharacter: (steamId) => state.characters[steamId] ?? null },
            "./craft-titles.js": { craftTitle: (key) => (key === "boas-vindas" ? (state.titles += 1, "data:image/webp;base64,TITLE") : "") },
            "./language.js": { languageOf: () => lang },
        })[id] ?? assert.fail(`unexpected require ${id}`),
        console: { log: (line) => state.logs.push(line) },
        Date,
        JSON,
        Object,
        Number,
        Set,
        Map,
        Math,
        Chat: { sendToPlayer: (player, text) => state.chat.push([player.id, text]) },
        Player: { all: () => state.players },
        Events: {
            on: (name, fn) => state.handlers.set(name, fn),
            onClient: (name, fn) => state.client.set(name, fn),
        },
        setInterval: (fn, ms) => { state.intervals.push({ fn, ms }); return state.intervals.length; },
        clearInterval() {},
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/welcome.js"), "utf8"), context);
    const player = (id, steamId, extra = {}) => {
        const sent = [];
        const made = { id, steamId, nickname: `Jogador${id}`, ready: true, alive: true, sent, emit(name, payload) { sent.push({ name, payload: JSON.parse(payload) }); }, ...extra };
        state.players.push(made);
        return made;
    };
    return { api: context.exports, state, files, player };
}

const STEAM = "76561198000000001";
const OTHER = "76561198000000002";
const made = (createdAt) => ({ appearance: {}, nickname: "x", createdAt, updatedAt: createdAt });

test("whoever has made a character and has not agreed is asked, with the title picture the first time only; nobody else is", () => {
    const sut = load({ characters: { [STEAM]: made(1000) } });
    const hans = sut.player(1, STEAM);
    const newcomer = sut.player(2, OTHER);
    sut.api.lookAtPlayers(100_000);
    assert.deepEqual(plain(hans.sent), [{ name: OPEN, payload: { lang: "pt", img: "data:image/webp;base64,TITLE" } }]);
    assert.deepEqual(newcomer.sent, [], "no character yet: the creator's turn first");

    // Twenty seconds on, again, without the picture.
    sut.api.lookAtPlayers(110_000);
    assert.equal(hans.sent.length, 1, "not before the time");
    sut.api.lookAtPlayers(120_500);
    assert.deepEqual(plain(hans.sent.at(-1)), { name: OPEN, payload: { lang: "pt" } });
    assert.equal(sut.state.titles, 1, "the picture was read once");
});

test("a player who is not in the world yet, or has no Steam id to keep it under, is not asked", () => {
    const sut = load({ characters: { [STEAM]: made(1000) } });
    const loading = sut.player(1, STEAM, { ready: false });
    const nobody = sut.player(2, "");
    sut.api.lookAtPlayers(100_000);
    assert.deepEqual(loading.sent, []);
    assert.deepEqual(nobody.sent, []);
    assert.equal(sut.api.needsAsking(nobody), false);
});

test("the language of the player goes with the ask", () => {
    const sut = load({ characters: { [STEAM]: made(1000) }, lang: "en" });
    const hans = sut.player(1, STEAM);
    sut.api.lookAtPlayers(100_000);
    assert.equal(hans.sent[0].payload.lang, "en");
});

test("agreeing is kept by Steam id for the character it was made for; the page is told it is done, and the player thanked once", () => {
    const sut = load({ characters: { [STEAM]: made(1000) } });
    sut.api.installWelcome();
    const hans = sut.player(1, STEAM);
    assert.equal(sut.api.hasAgreed(hans), false);
    sut.state.client.get(ACCEPT)(hans);
    assert.equal(sut.api.hasAgreed(hans), true);
    assert.deepEqual(plain(JSON.parse(sut.files.get("playerdata/welcome.json"))[STEAM]).character, 1000);
    assert.equal(hans.sent.some((entry) => entry.name === DONE), true);
    assert.equal(sut.state.chat.length, 1);
    assert.match(sut.state.chat[0][1], /Que a sorte lhe acompanhe/);
    assert.ok(sut.state.logs.some((line) => /Jogador1 concordou/.test(line)));

    // The button pressed again changes nothing, and thanks nobody twice.
    sut.state.client.get(ACCEPT)(hans);
    assert.equal(sut.state.chat.length, 1);
    sut.api.lookAtPlayers(500_000);
    assert.equal(hans.sent.filter((entry) => entry.name === OPEN).length, 0, "and he is not asked again");
});

test("a new character, after a restart from zero, is asked again; the same one, asked to redo its creator, is not", () => {
    const sut = load({ characters: { [STEAM]: made(1000) } });
    const hans = sut.player(1, STEAM);
    sut.api.agree(hans);
    assert.equal(sut.api.needsAsking(hans), false);

    // The creator asked for again (`askRedo`): the same character, the same time of creation.
    sut.state.characters[STEAM] = { ...made(1000), updatedAt: 5000 };
    assert.equal(sut.api.needsAsking(hans), false);

    // A restart from zero: the character is forgotten, then made anew.
    delete sut.state.characters[STEAM];
    assert.equal(sut.api.needsAsking(hans), false, "no character: nothing to ask");
    sut.state.characters[STEAM] = made(9000);
    assert.equal(sut.api.needsAsking(hans), true);
    assert.equal(sut.api.hasAgreed(hans), false);
    sut.api.agree(hans);
    assert.equal(sut.api.hasAgreed(hans), true);
});

test("somebody with no character made cannot agree, and a disk that fails keeps nothing and says so", () => {
    const sut = load({ characters: {} });
    const hans = sut.player(1, STEAM);
    assert.equal(sut.api.agree(hans).ok, false);
    assert.match(sut.api.agree(hans).message, /criar o personagem/);

    const broken = load({ characters: { [STEAM]: made(1000) }, diskFails: true });
    const greta = broken.player(1, STEAM);
    const outcome = broken.api.agree(greta);
    assert.equal(outcome.ok, false);
    assert.match(outcome.message, /não consegui guardar/i);
    assert.equal(broken.api.hasAgreed(greta), false);
    assert.equal(broken.files.has(FILE), false);
});

test("what was kept is read at the start: the entries that make sense stay, the rest is dropped; a file that cannot be read is not written over", () => {
    const kept = load({ characters: { [STEAM]: made(1000) }, saved: { [STEAM]: { at: 5, character: 1000 }, junk: { at: 1, character: 1 }, [OTHER]: { at: "x" } } });
    kept.api.installWelcome();
    const hans = kept.player(1, STEAM);
    assert.equal(kept.api.hasAgreed(hans), true);
    assert.ok(kept.state.logs.some((line) => /1 concordância\(s\) guardada\(s\)/.test(line)), kept.state.logs.join("|"));

    const corrupt = load({ characters: { [STEAM]: made(1000) }, saved: "{ not json" });
    corrupt.api.installWelcome();
    const greta = corrupt.player(1, STEAM);
    assert.equal(corrupt.api.agree(greta).ok, true, "agreed for this session");
    assert.equal(corrupt.api.hasAgreed(greta), true);
    assert.equal(corrupt.files.get(FILE), "{ not json", "the file nobody could read is left as it was");
});

test("a page that cannot open is told how to agree in the chat, and the player is not asked by page again", () => {
    const sut = load({ characters: { [STEAM]: made(1000) } });
    sut.api.installWelcome();
    const hans = sut.player(1, STEAM);
    sut.state.client.get(FAILED)(hans, JSON.stringify({ why: "a página não abriu" }));
    assert.match(sut.state.chat.at(-1)[1], /\/aceitar/);
    sut.state.client.get(FAILED)(hans, "again");
    assert.equal(sut.state.chat.length, 1, "told once");
    sut.api.lookAtPlayers(100_000);
    assert.deepEqual(hans.sent, [], "no ask by page any more");
    assert.ok(sut.state.logs.some((line) => /não abriu/.test(line)));
});

test("a player who leaves is forgotten: a new entry is asked at once, with the picture again", () => {
    const sut = load({ characters: { [STEAM]: made(1000) } });
    sut.api.installWelcome();
    const hans = sut.player(1, STEAM);
    sut.api.lookAtPlayers(100_000);
    assert.equal(hans.sent.length, 1);
    sut.state.handlers.get("playerDisconnect")(hans);
    sut.api.lookAtPlayers(101_000);
    assert.equal(hans.sent.length, 2, "asked at once, as at a new entry");
    assert.ok(hans.sent[1].payload.img, "with the picture");
});

test("the administrator's preview opens the page for somebody who agreed already, and its button changes nothing", () => {
    const sut = load({ characters: { [STEAM]: made(1000) } });
    sut.api.installWelcome();
    const hans = sut.player(1, STEAM);
    sut.api.agree(hans);
    hans.sent.length = 0;
    sut.api.showTo(hans);
    assert.equal(hans.sent[0].name, OPEN);
    assert.ok(hans.sent[0].payload.img);
    sut.state.client.get(ACCEPT)(hans);
    assert.equal(hans.sent.at(-1).name, DONE);
    assert.equal(sut.state.chat.length, 0, "an agreement already kept is not thanked again");
});
