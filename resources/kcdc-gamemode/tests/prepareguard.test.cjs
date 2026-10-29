"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

// The game's own cooking, drying and smoking count from KCDC 1.7.0 (`playerPreparing`): refused to everybody since 2026-10-21, the work being
// done on the trades' page only (src/server/prepare-guard.ts; a hunter smoked meat on the smokehouse's own goods screen, "pelo inventário").

function load({ may = () => true } = {}) {
    const state = { handlers: new Map(), chat: [], logs: [] };
    const context = {
        exports: {},
        Date: { now: () => state.now },
        Infinity,
        console: { log: (line) => state.logs.push(line) },
        Chat: { sendToPlayer: (player, text) => state.chat.push([player.id, text]) },
        Events: { on: (name, fn) => state.handlers.set(name, fn) },
        require: (id) =>
            id === "./guild-crafts.js"
                ? { mayCraft: (player, craft) => may(player, craft), refusal: (craft) => `só os do ofício de ${craft}` }
                : assert.fail(`unexpected require ${id}`),
    };
    state.now = 1_000_000;
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/prepare-guard.js"), "utf8"), context);
    context.exports.installPrepareGuard();
    return { api: context.exports, state };
}

const prep = (kind) => ({ kind, station: "kutnohorsko:abc", items: [{ id: "r1", item: "meat", amount: 2, product: "cooked" }] });
const player = (id) => ({ id, nickname: `P${id}` });

test("the game's own cooking, drying and smoking are refused to everybody, the trade's own members too", () => {
    const sut = load();
    const handler = sut.state.handlers.get("playerPreparing");
    for (const kind of ["cook", "dry", "smoke"]) assert.equal(handler(player(1), prep(kind)), false, kind);
    assert.ok(sut.state.logs.some((line) => /P1 usou a tela do jogo \(fogo\): 1 linha\(s\) em kutnohorsko:abc ficam como estavam/.test(line)));
});

test("one of the trade is told where it is done; anybody else whose trade it is; once in a few seconds", () => {
    const sut = load({ may: (p) => p.id === 1 });
    const handler = sut.state.handlers.get("playerPreparing");
    handler(player(1), prep("smoke"));
    assert.match(sut.state.chat[0][1], /Isso se faz pela página de ofícios: no defumador, com a tecla E \(Defumar\)/);
    handler(player(1), prep("smoke"));
    assert.equal(sut.state.chat.length, 1, "not at every row");
    handler(player(2), prep("cook"));
    assert.match(sut.state.chat[1][1], /só os do ofício de fogo/);
    sut.state.now += sut.api.prepareGuard.tellEveryMs;
    handler(player(1), prep("dry"));
    assert.match(sut.state.chat[2][1], /no secador, com a tecla E \(Secar\)/);
});

test("a preparation the game adds one day that is not one of the three is not refused", () => {
    const sut = load({ may: () => false });
    assert.equal(sut.state.handlers.get("playerPreparing")(player(1), prep("boil")), undefined);
    assert.equal(sut.api.mayPrepare(player(1), "boil"), true);
    assert.equal(sut.api.mayPrepare(player(1), "smoke"), false);
});
