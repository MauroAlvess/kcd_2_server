const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// "Apagar personagem" (src/server/character-reset.ts; "Recomeçar do zero" until 2026-10-25): everything of the character forgotten,
// then back to the mod's main menu; as often as the player wants since the 25th, and since the same day its horses, carts, support,
// houses and all the rest go with it ("o apagar realmente apaga").

function load({ stored = null, corrupt = false, owns = {}, throwing = "" } = {}) {
    const state = { calls: [], files: new Map(), timers: [], kicked: [], notices: [], chat: [], handlers: new Map(), payloads: [], logs: [] };
    const record = (name, result = true) => (...args) => {
        if (name === throwing) throw new Error("broken");
        state.calls.push([name, ...args.map((a) => (typeof a === "object" && a !== null ? "player" : a))]);
        return result;
    };
    const has = { horses: 2, carts: ["c1"], support: true, properties: { properties: 1, regions: 1, chests: ["g1", "g2"] }, rooms: ["r1"], plots: 3, tamed: 1, drops: 0, thief: true, combos: false, ...owns };
    const context = {
        exports: {},
        require: (id) => ({
            "./acquaintances.js": { forgetAcquaintances: record("acquaintances") },
            "./carts.js": { cartsOf: () => has.carts.map((key) => ({ record: { key }, cart: null })), removeCart: record("cart") },
            "./character-state.js": { discardCharacter: record("state") },
            "./characters.js": { forgetCharacter: record("character") },
            "./chest-state.js": { emptyChest: record("chest") },
            "./esgrima.js": { esgrima: { forget: record("combos", has.combos) } },
            "./citizenship.js": { setCitizenship: record("citizenship") },
            "./death-drop.js": { forgetDropOwner: record("drops", has.drops) },
            "./family.js": { forgetFamily: record("family") },
            "./farm.js": { clearPlotsOf: record("plots", has.plots) },
            "./free-changes.js": { forgetFreeChanges: record("free") },
            "./horses.js": { forgetHorsesOf: record("horses", has.horses) },
            "./position.js": { forgetPlace: record("place") },
            "./properties.js": { releaseAllOf: record("properties", has.properties) },
            "./restitution.js": { forgetOwed: record("owed") },
            "./rooms.js": { roomsHeldBy: () => has.rooms.map((id) => ({ id })), vacateRoom: (id, steamId) => { state.calls.push(["room", id, steamId]); return { ok: true }; } },
            "./skillbooks.js": { forgetReader: record("books") },
            "./status.js": { addPayload: (fn) => state.payloads.push(fn), notice: (player, text) => state.notices.push(text), resetRecord: record("social") },
            "./store.js": {
                ensureDir() {},
                read: () => (corrupt ? { status: "corrupt", reason: "bad json" } : stored === null ? { status: "missing" } : { status: "ok", value: stored }),
                write: (file, data) => state.files.set(file, JSON.parse(JSON.stringify(data))),
            },
            "./supporters.js": { supporters: { forgetSupport: record("support", has.support) } },
            "./thieves.js": { clearThief: record("thief", has.thief) },
            "./thirst.js": { forgetThirst: record("thirst") },
            "./titles.js": { forgetTitles: record("titles") },
            "./wild-horses.js": { forgetTamer: record("tamer", has.tamed) },
        })[id] ?? assert.fail(`unexpected require ${id}`),
        console: { log: (line) => state.logs.push(line) },
        setTimeout: (fn, ms) => { state.timers.push({ fn, ms }); return 1; },
        Events: { onClient: (name, fn) => state.handlers.set(name, fn) },
        Chat: { sendToPlayer: (player, text) => state.chat.push(text) },
        JSON,
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/character-reset.js"), "utf8"), context);
    context.exports.installCharacterReset();
    const player = (steamId = "76561198000000001") => ({ id: 1, steamId, nickname: "Hans", ready: true, kick: (reason) => state.kicked.push(reason) });
    return { api: context.exports, state, player };
}

const BODY = ["state", "character", "social", "citizenship", "family", "titles", "acquaintances", "place"];

test("the delete wipes every part of the character, writes when it was done, and puts the player out a moment later", () => {
    const sut = load();
    const hans = sut.player();
    const outcome = sut.api.resetCharacter(hans, 1_000);

    assert.equal(outcome.ok, true);
    assert.deepEqual(sut.state.calls.slice(0, BODY.length).map((call) => call[0]), BODY);
    assert.deepEqual(sut.state.files.get("playerdata/character-resets.json"), { "76561198000000001": 1_000 });
    assert.equal(sut.state.kicked.length, 0, "not at once: the player reads the answer first");
    assert.equal(sut.state.timers[0].ms, sut.api.KICK_AFTER_MS);
    sut.state.timers[0].fn();
    assert.match(sut.state.kicked[0], /personagem foi apagado/);
});

test("everything it had goes with it: horses, carts, support and dog, houses and their chests emptied, rooms, lands, gardens, the wild horses it was taming, its mark, its thirst, its books, its free changes, what it was owed (2026-10-25)", () => {
    const sut = load();
    sut.api.resetCharacter(sut.player(), 1_000);
    const names = sut.state.calls.map((call) => call[0]);
    for (const part of ["horses", "cart", "support", "properties", "chest", "room", "plots", "tamer", "drops", "thief", "thirst", "books", "free", "owed"]) {
        assert.ok(names.includes(part), `${part} is forgotten`);
    }
    assert.deepEqual(sut.state.calls.filter((call) => call[0] === "chest").map((call) => call[1]), ["g1", "g2"], "the chests of its houses are emptied");
    assert.deepEqual(sut.state.calls.find((call) => call[0] === "room"), ["room", "r1", "76561198000000001"]);
    assert.ok(
        sut.state.logs.some((line) => line === "reset: Hans apagou o personagem; foram junto 2 cavalos, 1 carroça, o apoio (benefícios e cão), 1 propriedade, 1 região, 2 baús esvaziados, 1 quarto, 3 canteiros, 1 cavalo selvagem em doma, a marca de ladrão; volta ao menu principal"),
        sut.state.logs.join("\n"),
    );
    assert.ok(sut.state.logs.every((line) => !/7656119/.test(line)), "no Steam id in the log");
});

test("a part that fails is written down and the rest still goes; with nothing besides the body, the log says only that", () => {
    const sut = load({ throwing: "horses" });
    assert.equal(sut.api.resetCharacter(sut.player(), 1).ok, true);
    assert.ok(sut.state.logs.some((line) => /^reset: os cavalos não foi apagado: (Error: )?broken$/.test(line)), sut.state.logs.join(" | "));
    assert.ok(sut.state.calls.some((call) => call[0] === "cart"), "the carts went all the same");

    const bare = load({ owns: { horses: 0, carts: [], support: false, properties: { properties: 0, regions: 0, chests: [] }, rooms: [], plots: 0, tamed: 0, drops: 0, thief: false } });
    bare.api.resetCharacter(bare.player(), 1);
    assert.ok(bare.state.logs.includes("reset: Hans apagou o personagem; volta ao menu principal"), bare.state.logs.join("\n"));
});

test("a second ask while the player is on the way out deletes nothing more; an account that deleted before may delete again", () => {
    const sut = load();
    const hans = sut.player();
    sut.api.resetCharacter(hans);
    sut.state.calls.length = 0;
    const again = sut.api.resetCharacter(hans);
    assert.equal(again.ok, false);
    assert.match(again.message, /já foi apagado/);
    assert.deepEqual(sut.state.calls, []);
    sut.state.timers[0].fn();
    assert.equal(sut.state.kicked[0], sut.api.DELETED_REASON, "back to the mod's main menu, with the reason shown there");

    const before = load({ stored: { "76561198000000001": 5 } });
    assert.equal(before.api.hasReset("76561198000000001"), true, "remembered from the file");
    assert.equal(before.api.resetCharacter(before.player(), 9).ok, true, "no longer once for each account");
    assert.deepEqual(before.state.files.get("playerdata/character-resets.json"), { "76561198000000001": 9 }, "the last time is kept");
});

test("a player with no Steam id, or a record that could not be read, is not deleted", () => {
    const none = load();
    assert.equal(none.api.resetCharacter(none.player("")).ok, false);
    assert.deepEqual(none.state.calls, []);
    const broken = load({ corrupt: true });
    assert.equal(broken.api.resetCharacter(broken.player()).ok, false);
    assert.deepEqual(broken.state.calls, []);
});

test("the page's event asks for it only with the confirmation, and the panel is told whether it was used", () => {
    const sut = load();
    const hans = sut.player();
    const ask = sut.state.handlers.get("kcdc-gamemode:status.resetCharacter");

    ask(hans, { confirm: 0 });
    ask(hans, "not json");
    assert.deepEqual(sut.state.calls, []);

    assert.deepEqual(JSON.parse(JSON.stringify(sut.state.payloads[0](hans))), { reset: { used: false } });
    ask(hans, JSON.stringify({ confirm: 1 }));
    assert.ok(sut.state.calls.length >= BODY.length);
    assert.match(sut.state.notices.at(-1), /Personagem apagado/);
    assert.deepEqual(JSON.parse(JSON.stringify(sut.state.payloads[0](hans))), { reset: { used: true } });
});

test("the combos of esgrima it was taught go with it, and the log says so (2026-10-26)", () => {
    const sut = load({ owns: { combos: true } });
    sut.api.resetCharacter(sut.player(), 1_000);
    assert.ok(sut.state.calls.some((call) => call[0] === "combos" && call[1] === "76561198000000001"), "the combos are forgotten by Steam id");
    assert.ok(sut.state.logs.some((line) => /, a marca de ladrão, os combos de esgrima; volta ao menu principal$/.test(line)), sut.state.logs.join("\n"));
});
