"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

// "Refazer aparência" (src/server/look-remake.ts, 2026-10-25): once for each account, spent when the new look is saved.

const MAN = { appearance: { gender: "male", head: "m_head_000" }, nickname: "Hans" };
const WOMAN = { appearance: { gender: "female", head: "f_head_000" }, nickname: "Eva" };

function load({ stored = null, corrupt = false, characters = { "76561198000000001": MAN, "76561198000000002": WOMAN } } = {}) {
    const state = { files: new Map(), opened: [], notices: [], chat: [], handlers: new Map(), payloads: [], logs: [] };
    const context = {
        exports: {},
        require: (id) => ({
            "./characters.js": { getCharacter: (steamId) => characters[steamId] ?? null },
            "./creator.js": { openCreatorFor: (player, genders, options) => state.opened.push({ player: player.id, genders, remake: options.remake }) },
            "./status.js": { addPayload: (fn) => state.payloads.push(fn), notice: (player, text) => state.notices.push(text) },
            "./store.js": {
                ensureDir() {},
                read: () => (corrupt ? { status: "corrupt", reason: "bad json" } : stored === null ? { status: "missing" } : { status: "ok", value: stored }),
                write: (file, data) => state.files.set(file, JSON.parse(JSON.stringify(data))),
            },
        })[id] ?? assert.fail(`unexpected require ${id}`),
        console: { log: (line) => state.logs.push(line) },
        Events: { onClient: (name, fn) => state.handlers.set(name, fn) },
        Chat: { sendToPlayer: (player, text) => state.chat.push(text) },
        JSON,
        Date,
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/look-remake.js"), "utf8"), context);
    context.exports.installLookRemake();
    const player = (id = 1, steamId = "76561198000000001") => ({ id, steamId, nickname: id === 1 ? "Hans" : "Eva", ready: true, alive: true });
    return { api: context.exports, state, player };
}

test("the creator opens for the character's own body, and the remake is spent only when the new look is saved", () => {
    const sut = load();
    const hans = sut.player();
    const first = sut.api.startRemake(hans, 1_000);
    assert.equal(first.ok, true);
    assert.equal(sut.state.opened.length, 1);
    assert.equal(sut.state.opened[0].genders, "male", "a man stays a man");
    assert.equal(sut.api.remakeUsed(hans.steamId), false, "opened, not saved: not spent");

    // Left without saving: asked again, the creator opens again.
    assert.equal(sut.api.startRemake(hans, 2_000).ok, true);
    sut.state.opened.at(-1).remake(hans);
    assert.equal(sut.api.remakeUsed(hans.steamId), true);
    assert.deepEqual(sut.state.files.get("playerdata/look-remakes.json"), { "76561198000000001": 2_000 });
    assert.ok(sut.state.logs.some((line) => /look-remake: Hans refez a aparência/.test(line)));

    const again = sut.api.startRemake(hans, 3_000);
    assert.equal(again.ok, false);
    assert.match(again.message, /já refez a aparência/);
    assert.equal(sut.state.opened.length, 2, "once for each account");

    const eva = sut.player(2, "76561198000000002");
    assert.equal(sut.api.startRemake(eva).ok, true);
    assert.equal(sut.state.opened.at(-1).genders, "female");
});

test("nobody without a Steam id, without a character, or not standing in the world; and a record that cannot be read lets nobody", () => {
    const sut = load();
    assert.equal(sut.api.startRemake(sut.player(1, "")).ok, false);
    assert.equal(sut.api.startRemake(sut.player(3, "76561198000000009")).ok, false, "no character yet");
    assert.equal(sut.api.startRemake({ ...sut.player(), ready: false }).ok, false);
    assert.equal(sut.state.opened.length, 0);

    const broken = load({ corrupt: true });
    assert.equal(broken.api.startRemake(broken.player()).ok, false);
    assert.equal(broken.state.opened.length, 0);

    const used = load({ stored: { "76561198000000001": 5 } });
    assert.equal(used.api.remakeUsed("76561198000000001"), true, "remembered from the file");
    assert.equal(used.api.startRemake(used.player()).ok, false);
});

test("the page asks only with the confirmation, a refusal is told on the page and in the chat, and the panel knows whether it was used", () => {
    const sut = load({ stored: { "76561198000000001": 5 } });
    const hans = sut.player();
    const ask = sut.state.handlers.get("kcdc-gamemode:status.remakeLook");
    ask(hans, { confirm: 0 });
    ask(hans, "not json");
    assert.equal(sut.state.chat.length, 0);
    ask(hans, JSON.stringify({ confirm: 1 }));
    assert.match(sut.state.notices.at(-1), /já refez a aparência/);
    assert.match(sut.state.chat.at(-1), /já refez a aparência/);
    assert.deepEqual(JSON.parse(JSON.stringify(sut.state.payloads[0](hans))), { remake: { used: true } });
    assert.deepEqual(JSON.parse(JSON.stringify(sut.state.payloads[0](sut.player(2, "76561198000000002")))), { remake: { used: false } });
});
