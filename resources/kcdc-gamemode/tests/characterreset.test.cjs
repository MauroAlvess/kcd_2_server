const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// "Apagar personagem" (src/server/character-reset.ts; "Recomeçar do zero" until 2026-10-25): everything of the character forgotten,
// then back to the mod's main menu; as often as the player wants since the 25th, and since the same day its horses, carts, support,
// houses and all the rest go with it ("o apagar realmente apaga").

function load({ stored = null, corrupt = false, owns = {}, throwing = "", pending = null, pendingCorrupt = false, props = {} } = {}) {
    const state = { calls: [], files: new Map(), timers: [], kicked: [], notices: [], chat: [], handlers: new Map(), payloads: [], logs: [] };
    const record = (name, result = true) => (...args) => {
        if (name === throwing) throw new Error("broken");
        state.calls.push([name, ...args.map((a) => (typeof a === "object" && a !== null ? "player" : a))]);
        return result;
    };
    const has = { horses: 2, carts: ["c1"], support: true, properties: { properties: 1, regions: 1, chests: ["g1", "g2"], kept: 0 }, rooms: ["r1"], plots: 3, tamed: 1, drops: 0, thief: true, combos: false, ...owns };
    const context = {
        exports: {},
        require: (id) => ({
            "./acquaintances.js": { forgetAcquaintances: record("acquaintances") },
            "./carts.js": { cartsOf: () => has.carts.map((key) => ({ record: { key }, cart: null })), removeCart: record("cart") },
            "./character-state.js": { discardCharacter: record("state") },
            "./characters.js": { forgetCharacter: record("character") },
            "./chest-state.js": { emptyChest: record("chest") },
            "./citizenship.js": { setCitizenship: record("citizenship") },
            "./death-drop.js": { forgetDropOwner: record("drops", has.drops) },
            "./family.js": { forgetFamily: record("family") },
            "./farm.js": { clearPlotsOf: record("plots", has.plots) },
            "./free-changes.js": { forgetFreeChanges: record("free") },
            "./horses.js": { forgetHorsesOf: record("horses", has.horses) },
            "./position.js": { forgetPlace: record("place"), forgetPlaceOf: record("place") },
            "./properties.js": { releaseAllOf: record("properties", has.properties), getProperty: (id) => props[id] ?? null, listProperties: () => Object.values(props) },
            "./restitution.js": { forgetOwed: record("owed") },
            "./rooms.js": { roomsHeldBy: () => has.rooms.map((id) => ({ id })), vacateRoom: (id, steamId) => { state.calls.push(["room", id, steamId]); return { ok: true }; } },
            "./skillbooks.js": { forgetReader: record("books") },
            "./status.js": { addPayload: (fn) => state.payloads.push(fn), notice: (player, text) => state.notices.push(text), resetRecord: record("social") },
            "./store.js": {
                ensureDir() {},
                read: (file) => (file.endsWith("erase-pending.json")
                    ? (pendingCorrupt ? { status: "corrupt", reason: "bad json" } : pending === null ? { status: "missing" } : { status: "ok", value: pending })
                    : corrupt ? { status: "corrupt", reason: "bad json" } : stored === null ? { status: "missing" } : { status: "ok", value: stored }),
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

    const bare = load({ owns: { horses: 0, carts: [], support: false, properties: { properties: 0, regions: 0, chests: [], kept: 0 }, rooms: [], plots: 0, tamed: 0, drops: 0, thief: false } });
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


test("the chests of a lord's lands and of a house others had access to are not emptied: they are said to keep what they hold (2026-10-31)", () => {
    const sut = load({ owns: { properties: { properties: 3, regions: 2, chests: ["g1"], kept: 4 } } });
    sut.api.resetCharacter(sut.player(), 1_000);
    assert.deepEqual(sut.state.calls.filter((call) => call[0] === "chest").map((call) => call[1]), ["g1"], "only the chest of a house nobody else used is emptied");
    assert.ok(sut.state.logs.some((line) => /1 baú esvaziado, 4 baús ficaram com o que têm \(eram de todos\)/.test(line)), sut.state.logs.join("\n"));
});

// Accounts and houses left to be cleaned while the server was stopped (2026-11-01).
const GUNTHER = "76561199131111121";
const house = (id, extra = {}) => ({ id, kind: "house", parentId: "", ownerSteamId: "", ownerName: "", stashGuid: "", ...extra });
const chest = (id, parentId, stashGuid, extra = {}) => ({ id, kind: "chest", parentId, ownerSteamId: "", ownerName: "", stashGuid, ...extra });

test("an account left in the pending file is wiped exactly as when its player deletes it, with no kick; the day is kept, and the file says it is done (2026-11-01)", () => {
    const sut = load({ pending: { v: 1, characters: [GUNTHER, GUNTHER, "not a steam id", 7], houses: [] } });
    sut.api.runPendingErasures(5_000);

    assert.deepEqual(sut.state.calls.slice(0, BODY.length).map((call) => call[0]), BODY, "the same parts, in the same order");
    assert.ok(sut.state.calls.slice(0, BODY.length).every((call) => call[1] === GUNTHER || call[0] === "place"), "by Steam id");
    for (const part of ["horses", "cart", "support", "properties", "chest", "room", "plots", "tamer", "drops", "thief", "thirst", "books", "free", "owed"]) {
        assert.ok(sut.state.calls.some((call) => call[0] === part && call[1] !== undefined || call[0] === part), `${part} is forgotten`);
    }
    assert.equal(sut.state.calls.filter((call) => call[0] === "state").length, 1, "once: it was listed twice");
    assert.equal(sut.state.kicked.length, 0);
    assert.equal(sut.state.timers.length, 0, "nobody to put out");
    assert.deepEqual(sut.state.files.get("playerdata/character-resets.json"), { [GUNTHER]: 5_000 });
    assert.deepEqual(sut.state.files.get("playerdata/erase-pending.json"), { v: 1, characters: [], houses: [], done: { at: 5_000, characters: ["1121"], houses: [] } });
    assert.ok(sut.state.logs.some((line) => /^reset: personagem …1121 apagado pela administração; foram junto 2 cavalos/.test(line)), sut.state.logs.join("\n"));
    assert.ok(sut.state.logs.every((line) => !/7656119/.test(line)), "no Steam id in the log");
});

test("a second start finds nothing to do, no file is nothing to do, and a file that cannot be read is left as it is (2026-11-01)", () => {
    const first = load({ pending: { v: 1, characters: [GUNTHER], houses: [] } });
    first.api.runPendingErasures(1);
    const again = load({ pending: first.state.files.get("playerdata/erase-pending.json") });
    again.api.runPendingErasures(2);
    assert.deepEqual(again.state.calls, []);
    assert.equal(again.state.files.size, 0, "and nothing is written");

    const none = load();
    none.api.runPendingErasures(1);
    assert.deepEqual(none.state.calls, []);
    assert.equal(none.state.files.size, 0);

    const broken = load({ pendingCorrupt: true });
    broken.api.runPendingErasures(1);
    assert.deepEqual(broken.state.calls, []);
    assert.equal(broken.state.files.size, 0);
    assert.ok(broken.state.logs.some((line) => /erase-pending.json está ilegível e foi deixado como está/.test(line)));
});

test("while the record of the deleted cannot be read, no account is deleted by the file, and it stays in the file for the next start (2026-11-01)", () => {
    const sut = load({ corrupt: true, pending: { v: 1, characters: [GUNTHER], houses: [] } });
    sut.api.runPendingErasures(1);
    assert.deepEqual(sut.state.calls, []);
    assert.ok(sut.state.logs.some((line) => /nenhum personagem foi apagado/.test(line)));
    assert.deepEqual(sut.state.files.get("playerdata/erase-pending.json").characters, [GUNTHER]);
});

test("an account that cannot be wiped does not stop the start: it is said, kept in the file for the next one, and the others go on (2026-11-01)", () => {
    const other = "76561198000000077";
    const sut = load({ throwing: "state", pending: { v: 1, characters: [GUNTHER, other], houses: [] } });
    assert.doesNotThrow(() => sut.api.runPendingErasures(3));
    assert.ok(sut.state.logs.some((line) => /…1121 não foi apagado por inteiro \(fica para a próxima subida\)/.test(line)), sut.state.logs.join("\n"));
    assert.deepEqual(sut.state.files.get("playerdata/erase-pending.json").characters, [GUNTHER, other], "both were asked for the state first and both failed: both stay");
    const fine = load({ pending: { v: 1, characters: [GUNTHER], houses: [] } });
    fine.api.runPendingErasures(3);
    assert.deepEqual(fine.state.files.get("playerdata/erase-pending.json").characters, [], "nothing stays when all went");
});

test("a house in the pending file has its chests emptied only when nobody owns it and nobody was let into it; a chest filed in someone's house is left to that house (2026-11-01)", () => {
    const props = {
        "raborsch-casa-02": house("raborsch-casa-02"),
        "raborsch-c2-1": chest("raborsch-c2-1", "raborsch-casa-02", "aaaaaaaaaaaaaaa1"),
        "raborsch-c2-2": chest("raborsch-c2-2", "raborsch-casa-02", "aaaaaaaaaaaaaaa2"),
        "raborsch-c2-owned": chest("raborsch-c2-owned", "raborsch-casa-02", "aaaaaaaaaaaaaaa3", { ownerSteamId: "76561198000000009" }),
        "raborsch-casa-03": house("raborsch-casa-03", { ownerSteamId: "76561198000000002", ownerName: "Patrik" }),
        "raborsch-bau-09": chest("raborsch-bau-09", "raborsch-casa-03", "bbbbbbbbbbbbbbb1"),
        "raborsch-casa-05": house("raborsch-casa-05", { access: [{ steamId: "76561198000000003", name: "Lev", at: 1 }] }),
        "raborsch-c5-1": chest("raborsch-c5-1", "raborsch-casa-05", "ccccccccccccccc1"),
        "raborsch-bau-12": chest("raborsch-bau-12", "raborsch-casa-05", "ddddddddddddddd1"),
        "castelo": house("castelo"),
        "castelo-1": chest("castelo-1", "castelo", "eeeeeeeeeeeeeee1"),
    };
    const sut = load({ props, pending: { v: 1, characters: [], houses: ["raborsch-casa-02", "raborsch-bau-09", "raborsch-casa-05", "castelo", "nao-existe"] } });
    sut.api.runPendingErasures(9);

    assert.deepEqual(sut.state.calls.filter((call) => call[0] === "chest").map((call) => call[1]).sort(), ["aaaaaaaaaaaaaaa1", "aaaaaaaaaaaaaaa2", "eeeeeeeeeeeeeee1"], "the idle houses' own chests, and no other");
    const log = sut.state.logs.join("\n");
    assert.match(log, /raborsch-casa-02: 2 baú\(s\) esvaziado\(s\)/);
    assert.match(log, /raborsch-bau-09: os baús ficaram como estavam \(tem dono\)/, "it stands in a house that has an owner");
    assert.match(log, /raborsch-casa-05: os baús ficaram como estavam \(deixa outras pessoas entrarem\)/);
    assert.match(log, /castelo: 1 baú\(s\) esvaziado\(s\)/);
    assert.match(log, /nao-existe: os baús ficaram como estavam \(não existe\)/);
    assert.deepEqual(sut.state.calls.filter((call) => call[0] === "state"), [], "no character was asked for");
    assert.deepEqual(sut.state.files.get("playerdata/erase-pending.json").done.houses.length, 5);
});
