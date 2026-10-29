"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

// Events too big for one message (src/server/big-emit.ts, src/client/big-events.ts): the client took about 29 KB in one piece
// and the forge's 79 KB page arrived cut at byte 29,280, so "Forjar" opened nothing (2026-10-18).

function server() {
    const context = { exports: {}, JSON, Math };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/big-emit.js"), "utf8"), context);
    return context.exports;
}

function client() {
    const handlers = new Map();
    const clock = { t: 1_000 };
    const context = { exports: {}, JSON, Array, console: { log() {} }, Date: { now: () => clock.t }, Events: { on: (name, fn) => handlers.set(name, fn) } };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/client/big-events.js"), "utf8"), context);
    context.exports.installBigEvents();
    return { api: context.exports, handlers, clock };
}

const forgeLike = () => JSON.stringify({ station: "forja", recipes: Array.from({ length: 900 }, (_, i) => ({ id: `forja:${i}`, out: `Espada de treino nº ${i} — ç ã é`, ing: [["guid-a", 1, 0], ["guid-b", 2, 1]] })), img: "data:image/webp;base64," + "A".repeat(15_000) });

test("a payload under the limit goes whole on its own event; a big one in pieces, each well under the limit", () => {
    const api = server();
    const sent = [];
    const player = { emit: (event, payload) => sent.push({ event, payload }) };
    assert.equal(api.emitLarge(player, "craft.view", JSON.stringify({ small: true })), 1);
    assert.deepEqual(sent[0], { event: "kcdc-gamemode:craft.view", payload: '{"small":true}' });

    const big = forgeLike();
    assert.ok(api.utf8Length(big) > 60_000);
    const pieces = api.emitLarge(player, "craft.view", big);
    assert.ok(pieces >= 3);
    const parts = sent.slice(1);
    assert.equal(parts.length, pieces);
    for (const part of parts) {
        assert.equal(part.event, "kcdc-gamemode:big");
        assert.ok(api.utf8Length(part.payload) <= api.PIECE_BYTES, "every message under the limit, its envelope included");
    }
    assert.equal(parts.map((part) => JSON.parse(part.payload).d).join(""), big, "and they make the whole again");
});

test("the client puts the pieces back together, in any order and once, and hears a small event whole", () => {
    const api = server();
    const sent = [];
    api.emitLarge({ emit: (event, payload) => sent.push(payload) }, "craft.view", forgeLike());
    const sut = client();
    const got = [];
    sut.api.onLarge("craft.view", (payload) => got.push(payload));
    const big = sut.handlers.get("kcdc-gamemode:big");
    for (const payload of [...sent].reverse()) big(payload);
    big(sent[0]);
    assert.equal(got.length, 1);
    assert.deepEqual(got[0], JSON.parse(forgeLike()), "parsed, as the framework hands over a whole event");
    assert.equal(typeof got[0], "object");

    // A whole event comes parsed from the framework, and goes on as it came.
    sut.handlers.get("kcdc-gamemode:craft.view")({ small: true });
    assert.deepEqual(got.at(-1), { small: true });
    big("nonsense");
    big(JSON.stringify({ i: 9, p: 5, n: 2, e: "craft.view", d: "x" }));
    assert.equal(got.length, 2, "a broken piece is no event");
});

test("pieces of a whole that never completes are forgotten", () => {
    const sut = client();
    const got = [];
    sut.api.onLarge("craft.view", (payload) => got.push(payload));
    const big = sut.handlers.get("kcdc-gamemode:big");
    big(JSON.stringify({ i: 1, p: 0, n: 2, e: "craft.view", d: "{\"a\":" }));
    sut.clock.t += 20_000;
    big(JSON.stringify({ i: 2, p: 0, n: 1, e: "craft.view", d: "{}" }));
    big(JSON.stringify({ i: 1, p: 1, n: 2, e: "craft.view", d: "1}" }));
    assert.deepEqual(got, [{}], "the stale half was dropped, so its late other half starts a new whole");
});
