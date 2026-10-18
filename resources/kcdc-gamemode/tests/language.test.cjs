"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const dist = (name) => fs.readFileSync(path.join(__dirname, "../dist/server", name), "utf8");
const plain = (value) => JSON.parse(JSON.stringify(value));

function module_(name, requires, globals = {}) {
    const sandbox = { exports: {}, require: (id) => requires[id] ?? assert.fail(`${name}: unexpected require ${id}`), console: { log() {} }, ...globals };
    vm.runInNewContext(dist(name), sandbox);
    return sandbox.exports;
}

const panelData = module_("lang-en-panel.js", {});
const messageData = module_("lang-en-messages.js", {});

function load({ saved = null } = {}) {
    const files = new Map();
    if (saved !== null) files.set("playerdata/language.json", saved);
    const writes = [];
    const store = {
        ensureDir() {},
        read: (file) => (files.has(file) ? (files.get(file) === "corrupt" ? { status: "corrupt", reason: "bad" } : { status: "ok", value: JSON.parse(files.get(file)) }) : { status: "missing" }),
        write: (file, body) => { writes.push(plain(body)); files.set(file, JSON.stringify(body)); },
    };
    const sent = [];
    const original = (player, text, options) => sent.push({ to: player.id, text, options });
    const Chat = { sendToPlayer: original };
    const api = module_("language.js", { "./store.js": store, "./lang-en-panel.js": panelData, "./lang-en-messages.js": messageData }, { Chat });
    return { api, files, writes, sent, Chat, original };
}

const body = (id, steamId) => ({ id, steamId });

test("a text the dictionary knows is said in English, a sentence with a name in it too, and what it does not know is left as it is", () => {
    const { api } = load();
    assert.equal(api.translate("Fechar", "en"), "Close");
    assert.equal(api.translate("Fechar", "pt"), "Fechar", "Portuguese is never touched");
    assert.equal(api.translate("Apoiador desde 14/10/2026 · obrigado!", "en"), "Supporter since 14/10/2026 · thank you!");
    assert.equal(api.translate("Hans (você)", "en"), "Hans (you)");
    assert.equal(api.translate("Isto não está no dicionário.", "en"), "Isto não está no dicionário.");
    assert.equal(api.translate("", "en"), "");
});

test("a line made of parts is translated part by part, and a command's line keeps its name and its dashes", () => {
    const { api } = load();
    assert.equal(api.translate("Jogador · Caçador · vivo", "en"), "Player · Hunter · alive");
    assert.equal(api.translate("Jogador · Desconhecido · vivo", "en"), "Player · Desconhecido · alive");
    assert.equal(api.translate("Desconhecido · Outro", "en"), "Desconhecido · Outro", "nothing known: unchanged");
    assert.equal(api.translate("  /preso -- Fiquei preso: leva você à igreja mais próxima, uma vez a cada 60 minutos.", "en"), "  /preso -- I'm stuck: takes you to the nearest church, once every 60 minutes.");
    assert.equal(api.translate("  /xyz -- nada disto existe", "en"), "  /xyz -- nada disto existe");
});

test("the sentences of the actions say what they caught: names, places and numbers", () => {
    const { api } = load();
    assert.equal(api.translate("Você foi levado para a igreja de Suchdol. Só poderá usar isto de novo daqui a 60 minutos.", "en"), "You were taken to the church of Suchdol. You can use this again in 60 minutes.");
    assert.equal(api.translate("Fiquei preso só pode ser usado uma vez a cada 60 minutos. Disponível de novo em 43 minutos.", "en"), "I'm stuck can only be used once every 60 minutes. Available again in 43 minutes.");
    assert.equal(api.translate("Hans entregou a você uma chave de uma porta. Fique perto da porta ou do baú e digite /chave para usá-la.", "en"), "Hans handed you a key to one door. Stay near the door or the chest and type /chave to use it.");
    assert.equal(api.translate("Você já faz parte de Venatores.", "en"), "You are already part of Venatores.");
    assert.equal(api.translate("1 minuto", "en"), "1 minute");
    assert.equal(api.translate("43 minutos", "en"), "43 minutes");
});

test("the language of a player is kept by Steam id, read again at the next start, and Portuguese is not written down", () => {
    const first = load();
    const hans = body(1, "76561198000000001");
    assert.equal(first.api.languageOf(hans), "pt", "Portuguese until chosen");
    first.api.setLanguage(hans, "en");
    assert.equal(first.api.languageOf(hans), "en");
    assert.deepEqual(first.writes.at(-1), { "76561198000000001": "en" });
    first.api.setLanguage(hans, "pt");
    assert.deepEqual(first.writes.at(-1), {}, "back to the default: nothing to keep");

    const second = load({ saved: JSON.stringify({ "76561198000000002": "en", "76561198000000003": "klingon" }) });
    second.api.installLanguage();
    assert.equal(second.api.languageOf(body(2, "76561198000000002")), "en");
    assert.equal(second.api.languageOf(body(3, "76561198000000003")), "pt", "a value that is no language is dropped");
});

test("a player with no Steam id keeps the language only while connected, and nothing is written for them", () => {
    const { api, writes } = load();
    const guest = body(7, "");
    api.setLanguage(guest, "en");
    assert.equal(api.languageOf(guest), "en");
    assert.equal(writes.length, 0);
    assert.equal(api.languageOf(body(8, "")), "pt", "another connection is its own");
});

test("a file that cannot be read is left alone: nothing is written over it", () => {
    const { api, writes, files } = load({ saved: "corrupt" });
    api.installLanguage();
    api.setLanguage(body(1, "76561198000000001"), "en");
    assert.equal(writes.length, 0);
    assert.equal(files.get("playerdata/language.json"), "corrupt");
});

test("the chat is put through the translation: an English player is told in English, the others as written, and the options go along", () => {
    const sut = load({ saved: JSON.stringify({ "76561198000000011": "en" }) });
    sut.api.installLanguage();
    assert.notEqual(sut.Chat.sendToPlayer, sut.original, "wrapped");
    sut.Chat.sendToPlayer(body(1, "76561198000000011"), "Esse jogador não está mais no servidor.", { author: "x" });
    sut.Chat.sendToPlayer(body(2, "76561198000000012"), "Esse jogador não está mais no servidor.");
    assert.equal(sut.sent[0].text, "That player is no longer on the server.");
    assert.deepEqual(plain(sut.sent[0].options), { author: "x" });
    assert.equal(sut.sent[1].text, "Esse jogador não está mais no servidor.");
});

test("a chat that cannot be wrapped is no reason to fail: the server says so and goes on", () => {
    const logs = [];
    const store = { ensureDir() {}, read: () => ({ status: "missing" }), write() {} };
    const Chat = Object.freeze({ sendToPlayer() {} });
    const sandbox = { exports: {}, require: (id) => ({ "./store.js": store, "./lang-en-panel.js": panelData, "./lang-en-messages.js": messageData })[id], console: { log: (line) => logs.push(line) }, Chat };
    vm.runInNewContext(dist("language.js"), sandbox);
    sandbox.exports.installLanguage();
    assert.ok(logs.some((line) => /não aceitou|não consegui traduzir/.test(line)), logs.join("|"));
});

test("the dictionary of the page comes in pieces that stay under the size asked, and put together are all of it", () => {
    const { api } = load();
    const parts = plain(api.dictionaryParts(4000));
    assert.ok(parts.length > 3);
    const sizes = parts.map((part) => JSON.stringify(part).length);
    assert.ok(Math.max(...sizes) < 6000, sizes.join(","));
    const flat = parts.flat();
    assert.equal(flat.filter(([kind]) => kind === 0).length, Object.keys(panelData.PANEL).length);
    assert.equal(flat.filter(([kind]) => kind === 1).length, panelData.PANEL_PATTERNS.length);
    for (const [kind, key] of flat) {
        if (kind === 1) new RegExp(key);
    }
});

test("every pattern is a valid regular expression, and every English text keeps the $1... that its sentence catches", () => {
    for (const [source, say] of [...panelData.PANEL_PATTERNS, ...messageData.MESSAGE_PATTERNS]) {
        const found = new RegExp(source);
        const groups = new RegExp(`${source}|`).exec("").length - 1;
        const used = [...say.matchAll(/\$(\d)/g)].map((one) => Number(one[1]));
        assert.ok(used.every((n) => n >= 1 && n <= groups), `${source} -> ${say}`);
        assert.ok(found instanceof RegExp);
    }
});

test("the catalogs the panel shows are all in the dictionary: guilds, houses, titles, relatives, branches", () => {
    const nobility = module_("nobility.js", {});
    const missing = [];
    const LATIN = new Set(["Caelebs"]);
    const need = (text) => {
        if (typeof text === "string" && text !== "" && !LATIN.has(text) && panelData.PANEL[text] === undefined) missing.push(text);
    };
    for (const title of nobility.TITLES) {
        [title.male, title.female, title.gloss].forEach(need);
    }
    for (const branch of nobility.BRANCHES) {
        [branch.label, branch.note].forEach(need);
    }
    const family = fs.readFileSync(path.join(__dirname, "../src/server/family.ts"), "utf8");
    for (const match of family.matchAll(/label: "([^"]+)"/g)) need(match[1]);
    for (const match of family.matchAll(/title: "([^"]+)"/g)) need(match[1]);
    const status = fs.readFileSync(path.join(__dirname, "../src/server/status.ts"), "utf8");
    for (const match of status.matchAll(/(?:profession|name|motto): "([^"]+)"/g)) need(match[1]);
    for (const match of status.matchAll(/description:\s*((?:\s*"[^"]*"\s*\+?)+),/g)) need([...match[1].matchAll(/"([^"]*)"/g)].map((one) => one[1]).join(""));
    assert.deepEqual(missing, []);
});
