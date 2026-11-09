"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

// The letters of the panel's Cartas section (src/server/letters.ts, 2026-11-02): written to anybody of the server, paid, carried by a courier who takes
// longer the farther the reader is, told of on arrival, read, answered, thrown away; and what the administrators see of them.

const FILE = "playerdata/letters.json";
const MIN = 60_000;
const DAY = 86_400_000;
const plain = (value) => JSON.parse(JSON.stringify(value));
const STEAM = { malak: "76561198000000501", jaromir: "76561198000000502", erik: "76561198000000503", banned: "76561198000000504", nobody: "76561198000000505" };

function run(file, requires, globals = {}) {
    const context = {
        exports: {},
        require: (id) => requires[id] ?? assert.fail(`unexpected require ${id} in ${file}`),
        console: { log: (line) => globals.logs?.push(line) },
        Date, JSON, Object, Number, Set, Map, Math, Array, String,
        ...globals,
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server", file), "utf8"), context);
    return context.exports;
}

function load({ saved = null, diskFails = false, wallets = {}, places = {} } = {}) {
    const files = new Map();
    if (saved !== null) files.set(FILE, JSON.stringify(saved));
    const state = { diskFails };
    const disk = {
        readFileSync(file) {
            if (!files.has(file)) throw new Error("ENOENT");
            return files.get(file);
        },
        writeFileSync(file, data) {
            if (state.diskFails && file.endsWith(".tmp")) throw new Error("disk full");
            files.set(file, data);
        },
        mkdirSync() {},
        renameSync(from, to) { files.set(to, files.get(from)); files.delete(from); },
        existsSync: (file) => files.has(file),
    };
    const logs = [];
    const store = run("store.js", { "node:fs": disk }, { logs });
    const textStyle = run("text-style.js", {});
    const players = [];
    const chats = [];
    const notices = [];
    const handlers = new Map();
    const events = new Map();
    const timers = [];
    const purse = { ...wallets };
    const characters = {
        [STEAM.malak]: { name: "Malak" },
        [STEAM.jaromir]: { name: "Jaromir" },
        [STEAM.erik]: { name: "Erik" },
        [STEAM.banned]: { name: "Banido" },
    };
    const names = { [STEAM.malak]: "Malak o Justo", [STEAM.jaromir]: "Jaromir o Justo Chevalier", [STEAM.erik]: "Erik von Raborsch", [STEAM.banned]: "Banido", [STEAM.nobody]: "Ninguém" };
    // The roster's account numbers: below zero, the same whether the owner is here or not.
    const accountIds = { [STEAM.malak]: -1, [STEAM.jaromir]: -2, [STEAM.erik]: -3, [STEAM.banned]: -4, [STEAM.nobody]: -5 };
    const citizens = { [STEAM.malak]: { id: "suchdol", name: "Suchdol", crest: "town-suchdol.webp" } };
    const guildOf = { [STEAM.malak]: "fabri-ferrarii" };
    const sent = [];
    const letters = run("letters.js", {
        "./acquaintances.js": { nameOf: (player) => names[player.steamId] ?? player.nickname },
        "./bans.js": { bans: { isBanned: (steamId) => steamId === STEAM.banned } },
        "./sentences.js": { sentences: { has: () => false } },
        "./big-emit.js": { emitLarge: (player, name, json) => player.large.push({ name, data: JSON.parse(json) }) },
        "./characters.js": { getCharacter: (steamId) => characters[steamId] ?? null },
        "./citizenship.js": {
            TOWNS: [{ id: "suchdol", name: "Suchdol", crest: "town-suchdol.webp" }, { id: "kuttenberg", name: "Kuttenberg", crest: "@town-kuttenberg" }],
            townOf: (steamId) => citizens[steamId] ?? null,
        },
        "./language.js": { languageOf: (player) => player.lang ?? "pt" },
        "./money.js": {
            MONEY_UNIT: 10,
            moneyOf: (holder) => purse[holder.steamId] ?? 0,
            takeMoney: (holder, units) => {
                if ((purse[holder.steamId] ?? 0) < units) return false;
                purse[holder.steamId] -= units;
                return true;
            },
            giveMoney: (holder, units) => {
                purse[holder.steamId] = (purse[holder.steamId] ?? 0) + units;
                return true;
            },
        },
        "./position.js": { getSavedPlace: (steamId) => places[steamId] ?? null },
        "./status.js": {
            GUILDS: [{ id: "fabri-ferrarii", nameLatin: "Fabri Ferrarii", profession: "Ferreiro", crest: "guild-ferreiro.webp" }, { id: "caupones", nameLatin: "Caupones", profession: "Taberneiro", crest: "guild-taberneiro.webp" }],
            getGuildId: (steamId) => guildOf[steamId] ?? null,
            addPayload: (fn) => { state.payload = fn; },
            notice: (player, text) => notices.push([player.nickname, text]),
            accountIdOf: (steamId) => accountIds[steamId] ?? null,
            accountOfTarget: (id) => {
                const steamId = Object.keys(accountIds).find((key) => accountIds[key] === id);
                if (steamId === undefined) return null;
                return { steamId, name: names[steamId], player: players.find((one) => one.steamId === steamId) ?? null };
            },
        },
        "./store.js": store,
        "./text-style.js": textStyle,
    }, {
        logs,
        Player: { all: () => players, getById: (id) => players.find((one) => one.id === id) ?? null },
        Chat: { sendToPlayer: (player, text) => chats.push([player.nickname, text]) },
        Events: {
            onClient: (name, fn) => handlers.set(name, fn),
            on: (name, fn) => events.set(name, fn),
        },
        setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
        clearTimeout: () => undefined,
        setInterval: () => 0,
        clearInterval: () => undefined,
    });
    let nextId = 1;
    const join = (who, at = { x: 0, y: 0 }, extra = {}) => {
        const player = { id: nextId++, steamId: STEAM[who], nickname: who, ready: true, position: { x: at.x, y: at.y, z: 0 }, large: [], emitted: [], emit(name, json) { this.emitted.push({ name, data: JSON.parse(json) }); }, ...extra };
        players.push(player);
        return player;
    };
    const runTimers = () => {
        const due = timers.splice(0, timers.length);
        due.forEach((timer) => timer.fn());
    };
    const onDisk = () => JSON.parse(files.get(FILE) ?? "null");
    return { letters, files, logs, players, chats, notices, handlers, events, purse, join, runTimers, disk: onDisk, state, accountIds };
}

const write = (to, more = {}) => ({ to, title: "Convite", body: "Venha ao banquete no domingo.", seal: "", anonymous: false, style: {}, ...more });

test("a letter is paid for and kept, and reaches its reader after the courier's ride: a minute, and two and a half for each kilometre between them", () => {
    const sut = load({ wallets: { [STEAM.malak]: 500 } });
    const malak = sut.join("malak", { x: 0, y: 0 });
    const jaromir = sut.join("jaromir", { x: 2000, y: 0 });
    const t0 = 1_800_000_000_000;
    const outcome = sut.letters.sendLetter(malak, write(sut.accountIds[STEAM.jaromir]), t0);
    assert.equal(outcome.ok, true, outcome.message);
    assert.match(outcome.message, /chega a Jaromir o Justo Chevalier em cerca de 6 minutos/);
    assert.equal(sut.purse[STEAM.malak], 400, "ten coins, a hundred of the money item");
    const kept = sut.disk().letters;
    assert.equal(kept.length, 1, "written at once: the coins depend on it");
    assert.equal(kept[0].arriveAt, t0 + MIN + 2 * 150_000);
    assert.equal(kept[0].km, 2);

    // On the way: the reader knows nothing of it; the writer sees it among the sent.
    assert.deepEqual(plain(sut.letters.viewFor(jaromir, t0 + 5 * MIN).inbox), []);
    assert.equal(sut.letters.unreadOf(STEAM.jaromir, t0 + 5 * MIN), 0);
    assert.equal(sut.letters.viewFor(malak, t0).sent.length, 1);
    assert.equal(sut.letters.deliver(t0 + 5 * MIN), 0);

    // Arrived: told in the chat, sent the list, and the dot.
    assert.equal(sut.letters.deliver(t0 + 6 * MIN), 1);
    assert.match(sut.chats.at(-1)[1], /^Chegou uma carta para você \(de Malak o Justo\): "Convite"\. Leia no painel \(F2\), em Cartas\.$/);
    assert.equal(jaromir.large.at(-1).name, "status.letters");
    assert.equal(sut.letters.unreadOf(STEAM.jaromir, t0 + 6 * MIN), 1);
    assert.equal(sut.letters.deliver(t0 + 7 * MIN), 0, "told once");
    const view = sut.letters.viewFor(jaromir, t0 + 6 * MIN);
    assert.deepEqual(plain(view.inbox.map((one) => [one.title, one.from, one.read])), [["Convite", "Malak o Justo", false]]);
    assert.equal(view.inbox[0].body, undefined, "the list carries no text");
});

test("the farther the reader, the longer: one away is looked for where they were last seen, one never seen is a kilometre and a half off, and nobody waits more than twelve minutes", () => {
    const sut = load({ wallets: { [STEAM.malak]: 1000 }, places: { [STEAM.erik]: { x: 50_000, y: 0, z: 0 } } });
    const malak = sut.join("malak", { x: 0, y: 0 });
    assert.equal(sut.letters.travelMs(0), MIN, "a minute at least");
    assert.equal(sut.letters.travelMs(1.5), MIN + 225_000);
    assert.equal(sut.letters.travelMs(80), 12 * MIN, "twelve at most");
    const quoteErik = sut.letters.quoteFor(malak, sut.accountIds[STEAM.erik]);
    assert.deepEqual(plain(quoteErik), { minutes: 12, km: 50 });
    const quoteJaromir = sut.letters.quoteFor(malak, sut.accountIds[STEAM.jaromir]);
    assert.deepEqual(plain(quoteJaromir), { minutes: 5, km: 1.5 }, "never seen: a kilometre and a half");
    assert.equal(sut.letters.quoteFor(malak, sut.accountIds[STEAM.banned]), null);
});

test("a letter opened is read, its text sent; an unsigned one never names its writer, a signed one says whom to answer; the writer reads their own without marking it", () => {
    const sut = load({ wallets: { [STEAM.malak]: 500 } });
    const malak = sut.join("malak");
    const jaromir = sut.join("jaromir");
    const t0 = 1_800_000_000_000;
    const signed = sut.letters.sendLetter(malak, write(sut.accountIds[STEAM.jaromir], { title: "Assinada", seal: "town:suchdol", style: { font: "bohemia", bold: true, spacing: "wide", align: "center" } }), t0);
    const unsigned = sut.letters.sendLetter(malak, write(sut.accountIds[STEAM.jaromir], { title: "Anônima", anonymous: true }), t0 + 20_000);
    assert.ok(signed.ok && unsigned.ok);
    const later = t0 + 30 * MIN;
    sut.letters.deliver(later);
    assert.match(sut.chats.at(-1)[1], /^Chegaram 2 cartas para você\./);

    const inbox = sut.letters.viewFor(jaromir, later).inbox;
    const anon = inbox.find((one) => one.title === "Anônima");
    assert.equal(anon.from, "", "no name in the list");
    assert.equal(anon.anon, true);
    assert.equal(sut.letters.openLetter(malak, anon.id, later).from, "Malak o Justo", "the writer sees their own name");
    assert.equal(sut.letters.unreadOf(STEAM.jaromir, later), 2, "the writer opening it marks nothing");

    const opened = sut.letters.openLetter(jaromir, anon.id, later);
    assert.equal(opened.from, "");
    assert.equal(opened.replyId, null, "nobody to answer");
    assert.equal(sut.letters.unreadOf(STEAM.jaromir, later), 1);
    const letter = sut.letters.openLetter(jaromir, inbox.find((one) => one.title === "Assinada").id, later);
    assert.deepEqual(plain(letter.style), { font: "bohemia", bold: true, spacing: "wide", align: "center" });
    assert.equal(letter.from, "Malak o Justo");
    assert.equal(letter.replyId, sut.accountIds[STEAM.malak]);
    assert.deepEqual(plain(letter.seal), { id: "town:suchdol", label: "Suchdol", sub: "brasão da cidadania", crest: "town-suchdol.webp" });
    assert.equal(sut.letters.unreadOf(STEAM.jaromir, later), 0);
    // Read marks wait a moment to be written.
    assert.equal(sut.disk().letters.every((one) => one.readAt === undefined), true);
    sut.runTimers();
    assert.equal(sut.disk().letters.every((one) => typeof one.readAt === "number"), true);
    // Nobody else opens it.
    const erik = sut.join("erik");
    assert.equal(sut.letters.openLetter(erik, anon.id, later), null);
});

test("what is refused, and that nothing is paid for it: no character, oneself, the banned, too poor, a seal that is not one's own, too quick, too many in a day", () => {
    const sut = load({ wallets: { [STEAM.malak]: 100_000, [STEAM.erik]: 50 } });
    const malak = sut.join("malak");
    const erik = sut.join("erik");
    const stranger = { id: 99, steamId: "", nickname: "x", position: { x: 0, y: 0, z: 0 } };
    const t0 = 1_800_000_000_000;
    const fails = (who, request, pattern, at = t0) => {
        const outcome = sut.letters.sendLetter(who, request, at);
        assert.equal(outcome.ok, false);
        assert.match(outcome.message, pattern);
    };
    fails(stranger, write(-2), /identificação Steam/);
    fails(malak, write(sut.accountIds[STEAM.malak]), /para você mesmo/);
    fails(malak, write(sut.accountIds[STEAM.banned]), /não está mais no reino/);
    fails(malak, write(12345), /Escolha para quem/);
    fails(malak, write(sut.accountIds[STEAM.jaromir], { body: "oi" }), /Escreva o texto/);
    fails(malak, write(sut.accountIds[STEAM.jaromir], { seal: "guild:caupones" }), /Esse selo não é seu/);
    fails(malak, write(sut.accountIds[STEAM.jaromir], { seal: "town:kuttenberg" }), /Esse selo não é seu/);
    fails(erik, write(sut.accountIds[STEAM.jaromir]), /precisa de 10 moedas/);
    assert.equal(sut.purse[STEAM.erik], 50, "nothing taken");
    assert.equal(sut.letters.sealsOf(STEAM.malak).map((seal) => seal.id).join(","), ",town:suchdol,guild:fabri-ferrarii");
    assert.equal(sut.letters.sealsOf(STEAM.erik).map((seal) => seal.id).join(","), "", "plain wax only");

    assert.equal(sut.letters.sendLetter(malak, write(sut.accountIds[STEAM.jaromir], { seal: "guild:fabri-ferrarii" }), t0).ok, true);
    fails(malak, write(sut.accountIds[STEAM.jaromir]), /uma carta de cada vez/, t0 + 5_000);
    for (let n = 1; n < 30; n += 1) {
        assert.equal(sut.letters.sendLetter(malak, write(sut.accountIds[n % 2 ? STEAM.erik : STEAM.jaromir]), t0 + n * 11_000).ok, true);
    }
    fails(malak, write(sut.accountIds[STEAM.jaromir]), /já mandou 30 cartas hoje/, t0 + 31 * 11_000);
    assert.equal(sut.letters.sendLetter(malak, write(sut.accountIds[STEAM.jaromir]), t0 + DAY + MIN).ok, true, "the next day");
});

test("a reader holds forty: a new letter pushes out their oldest read one, and with none read it does not go and nothing is paid", () => {
    const sut = load({ wallets: { [STEAM.malak]: 100_000 } });
    const malak = sut.join("malak");
    const jaromir = sut.join("jaromir");
    const t0 = 1_800_000_000_000;
    // Forty unread letters from several days (the day's limit is thirty).
    for (let n = 0; n < 40; n += 1) {
        assert.equal(sut.letters.sendLetter(malak, write(sut.accountIds[STEAM.jaromir], { title: `Carta ${n}` }), t0 + Math.floor(n / 20) * DAY + (n % 20) * 11_000).ok, true);
    }
    const now = t0 + 2 * DAY;
    const before = sut.purse[STEAM.malak];
    const refused = sut.letters.sendLetter(malak, write(sut.accountIds[STEAM.jaromir]), now);
    assert.equal(refused.ok, false);
    assert.match(refused.message, /tem cartas demais por ler/);
    assert.equal(sut.purse[STEAM.malak], before);
    // He reads the first two: the oldest read goes for the new one.
    const inbox = sut.letters.viewFor(jaromir, now).inbox;
    sut.letters.openLetter(jaromir, inbox.find((one) => one.title === "Carta 0").id, now);
    sut.letters.openLetter(jaromir, inbox.find((one) => one.title === "Carta 1").id, now);
    assert.equal(sut.letters.sendLetter(malak, write(sut.accountIds[STEAM.jaromir], { title: "Nova" }), now + 20_000).ok, true);
    const titles = sut.letters.viewFor(jaromir, now + DAY).inbox.map((one) => one.title);
    assert.equal(titles.length, 40);
    assert.ok(!titles.includes("Carta 0") && titles.includes("Carta 1") && titles.includes("Nova"));
});

test("the disk failing gives the coins back and keeps nothing", () => {
    const sut = load({ wallets: { [STEAM.malak]: 500 } });
    const malak = sut.join("malak");
    sut.state.diskFails = true;
    const outcome = sut.letters.sendLetter(malak, write(sut.accountIds[STEAM.jaromir]), 1_800_000_000_000);
    assert.equal(outcome.ok, false);
    assert.match(outcome.message, /dinheiro foi devolvido/);
    assert.equal(sut.purse[STEAM.malak], 500);
    assert.equal(sut.letters.allLetters().length, 0);
});

test("each side throws a letter away from their own list; once both have, or once it is old, it is gone for good", () => {
    const sut = load({ wallets: { [STEAM.malak]: 500 } });
    const malak = sut.join("malak");
    const jaromir = sut.join("jaromir");
    const t0 = 1_800_000_000_000;
    const { id } = sut.letters.sendLetter(malak, write(sut.accountIds[STEAM.jaromir]), t0);
    const later = t0 + 20 * MIN;
    assert.equal(sut.letters.dropLetter(jaromir, id, t0).ok, false, "not his before it arrives");
    assert.equal(sut.letters.dropLetter(jaromir, id, later).ok, true);
    assert.equal(sut.letters.viewFor(jaromir, later).inbox.length, 0);
    assert.equal(sut.letters.viewFor(malak, later).sent.length, 1, "the writer still has it");
    assert.equal(sut.letters.dropLetter(malak, id, later).ok, true);
    assert.equal(sut.letters.allLetters().length, 0);

    // Old: a read one after thirty days, an unread one after sixty.
    const read = sut.letters.sendLetter(malak, write(sut.accountIds[STEAM.jaromir], { title: "Lida" }), t0 + MIN);
    sut.letters.sendLetter(malak, write(sut.accountIds[STEAM.jaromir], { title: "Esquecida" }), t0 + 2 * MIN);
    sut.letters.openLetter(jaromir, read.id, later);
    sut.letters.sweep(t0 + 31 * DAY);
    assert.deepEqual(plain(sut.letters.allLetters().map((one) => one.title)), ["Esquecida"]);
    sut.letters.sweep(t0 + 61 * DAY);
    assert.equal(sut.letters.allLetters().length, 0);
});

test("the page's flat request is read as a letter; a letter on disk that does not make sense is dropped, and what had arrived before a start is not announced again", () => {
    const sut0 = load();
    assert.deepEqual(plain(sut0.letters.requestOf({ to: -2, title: "T", body: "B", seal: "", anon: 1, font: "bohemia", bold: 1, spacing: "wide", align: "center" })),
        { to: -2, title: "T", body: "B", seal: "", anonymous: true, style: { font: "bohemia", bold: true, spacing: "wide", align: "center" } });
    const t0 = Date.now() - 10 * MIN;
    const sut = load({
        saved: {
            letters: [
                { id: "a", from: STEAM.malak, fromName: "Malak", to: STEAM.jaromir, toName: "Jaromir", title: "", body: "Chegou antes.", sentAt: t0, arriveAt: t0 + MIN, km: 0 },
                { id: "b", from: STEAM.malak, to: STEAM.jaromir, body: "", sentAt: t0, arriveAt: t0 },
                { id: "c", from: STEAM.malak, fromName: "Malak", to: STEAM.jaromir, toName: "Jaromir", title: "A caminho", body: "Ainda vem.", sentAt: t0, arriveAt: Date.now() + 5 * MIN, km: 2 },
                "nonsense",
            ],
        },
    });
    sut.letters.loadLetters();
    assert.deepEqual(plain(sut.letters.allLetters().map((one) => [one.id, one.title])), [["a", "Carta"], ["c", "A caminho"]], "an empty heading reads as Carta");
    sut.join("jaromir");
    assert.equal(sut.letters.deliver(), 0, "the letter that had arrived is not told of again");
    assert.equal(sut.letters.deliver(Date.now() + 6 * MIN), 1);
});

test("the panel's events: asked, opened, sent (the result and the list), thrown away, quoted; and the dot in the player's payload", () => {
    const sut = load({ wallets: { [STEAM.malak]: 500 } });
    sut.letters.installLetters();
    const malak = sut.join("malak");
    const jaromir = sut.join("jaromir", { x: 1000, y: 0 });
    sut.handlers.get("kcdc-gamemode:status.letterQuote")(malak, JSON.stringify({ to: sut.accountIds[STEAM.jaromir] }));
    assert.deepEqual(plain(malak.emitted.at(-1)), { name: "kcdc-gamemode:status.letterQuote", data: { to: -2, minutes: 4, km: 1 } });
    sut.handlers.get("kcdc-gamemode:status.letterSend")(malak, JSON.stringify({ to: sut.accountIds[STEAM.jaromir], title: "Olá", body: "Uma carta de teste.", seal: "", anon: 0, font: "normal", bold: 0, spacing: "normal", align: "left" }));
    assert.match(sut.notices.at(-1)[1], /^Carta entregue ao mensageiro/);
    const result = malak.emitted.find((one) => one.name === "kcdc-gamemode:status.letterResult").data;
    assert.equal(result.ok, true);
    assert.equal(malak.large.at(-1).name, "status.letters");
    assert.equal(malak.large.at(-1).data.sent[0].id, result.id);
    assert.deepEqual(plain(sut.state.payload(jaromir)), { letters: { unread: 0 } });
    sut.letters.deliver(Date.now() + 10 * MIN);
    // (Delivered by the clock of the test: the list is read at the real time below, so the letter is moved to have arrived.)
    sut.letters.allLetters()[0].arriveAt = Date.now() - 1;
    assert.deepEqual(plain(sut.state.payload(jaromir)), { letters: { unread: 1 } });
    sut.handlers.get("kcdc-gamemode:status.letterOpen")(jaromir, JSON.stringify({ id: result.id }));
    assert.equal(jaromir.large.at(-2).name, "status.letter");
    assert.equal(jaromir.large.at(-2).data.body, "Uma carta de teste.");
    assert.deepEqual(plain(sut.state.payload(jaromir)), { letters: { unread: 0 } });
    sut.handlers.get("kcdc-gamemode:status.letterDrop")(jaromir, JSON.stringify({ id: result.id }));
    assert.equal(jaromir.large.at(-1).data.inbox.length, 0);
    sut.handlers.get("kcdc-gamemode:status.letterOpen")(jaromir, JSON.stringify({ id: result.id }));
    assert.match(sut.notices.at(-1)[1], /já não está com você/);
    // Somebody who comes in is told, a moment later, of what waits unread.
    const erik = sut.join("erik");
    // A second letter at once (the courier's ten seconds are another test's).
    sut.letters.lettersSettings.sendGapMs = 0;
    sut.handlers.get("kcdc-gamemode:status.letterSend")(malak, JSON.stringify({ to: sut.accountIds[STEAM.erik], title: "Para Erik", body: "Venha ver.", seal: "", anon: 1, font: "normal", bold: 0, spacing: "normal", align: "left" }));
    sut.letters.allLetters().find((one) => one.title === "Para Erik").arriveAt = Date.now() - 1;
    sut.events.get("playerSpawned")(erik);
    sut.runTimers();
    assert.ok(sut.chats.some(([who, text]) => who === "erik" && /^Há uma carta esperando por você/.test(text)));
});
