"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
require("./reachpatch.cjs");

function load({ guilds = {}, admins = [] } = {}) {
    const handlers = new Map();
    const guildListeners = [];
    const online = [];
    const chat = [];
    const properties = [];
    const dialogues = [];
    const clock = { now: 1_000_000 };
    const logs = [];
    const trimmed = [];
    const sandbox = {
        console: { log: (line) => logs.push(line) },
        exports: {},
        require: (id) => ({
            "./auth.js": { isAdmin: (player) => admins.includes(player.steamId) },
            "./status.js": { getGuildId: (steamId) => guilds[steamId] ?? null, onGuildChange: (listener) => guildListeners.push(listener) },
            "./carcass.js": { trimCarcass: (npc) => { trimmed.push(npc.id); return { before: 6, after: 3 }; } },
        })[id] ?? assert.fail(`unexpected require ${id}`),
        Events: { on: (name, fn) => handlers.set(name, fn), onClient: (name, fn) => handlers.set(name, fn) },
        Player: { all: () => online },
        Chat: { sendToPlayer: (player, text) => chat.push([player.id, text]) },
        Dialogue: { sessionOf: () => 0, open: (id, page) => { dialogues.push({ id, page: JSON.parse(JSON.stringify(page)) }); return dialogues.length; }, close() {} },
        Inventory: {
            setProperties: (player, request) => { properties.push([player.id, request]); return { ok: true, code: "" }; },
            set: (owner, request) => { properties.push(["set", owner.id, JSON.parse(JSON.stringify(request))]); return { ok: true, code: "" }; },
        },
        Date: { now: () => clock.now },
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/guild-crafts.js"), "utf8"), sandbox);
    sandbox.exports.installGuildCrafts();
    return { api: sandbox.exports, handlers, chat, clock, properties, dialogues, logs, guildListeners, online, guilds, trimmed };
}

const body = (id, steamId) => ({ id, steamId, nickname: `P${id}` });

test("each trade owns its place: the forge, the alchemy tables, the fire, the rack and the smoker, the trees and rocks, the gardens and the wild horses", () => {
    const { api } = load();
    assert.deepEqual(JSON.parse(JSON.stringify(api.CRAFT_GUILD)), { smithing: "fabri-ferrarii", alchemy: "alchemistae", fogo: "tabernarii", secador: "alchemistae", defumador: "venatores", costura: "artifices", abate: "venatores", lenha: "collectores", mineracao: "collectores", horta: "agricolae", domar: "domitores" });
});

test("only a member of the trade's guild, or an administrator, may use its place", () => {
    const { api } = load({ guilds: { smith: "fabri-ferrarii", hunter: "venatores", host: "tabernarii", brewer: "alchemistae", tailor: "artifices" }, admins: ["boss"] });
    assert.equal(api.mayCraft(body(1, "smith"), "smithing"), true);
    assert.equal(api.mayCraft(body(1, "smith"), "alchemy"), false);
    assert.equal(api.mayCraft(body(2, "hunter"), "defumador"), true);
    assert.equal(api.mayCraft(body(2, "hunter"), "secador"), false, "the drying rack is the alchemists'");
    assert.equal(api.mayCraft(body(4, "brewer"), "secador"), true);
    assert.equal(api.mayCraft(body(2, "hunter"), "fogo"), false);
    assert.equal(api.mayCraft(body(3, "host"), "fogo"), true);
    assert.equal(api.mayCraft(body(3, "host"), "defumador"), false);
    assert.equal(api.mayCraft(body(4, "brewer"), "alchemy"), true);
    assert.equal(api.mayCraft(body(5, "tailor"), "smithing"), false, "tailors have nothing here");
    assert.equal(api.mayCraft(body(6, "nobody"), "fogo"), false, "no guild");
    assert.equal(api.mayCraft(body(7, ""), "fogo"), false, "no Steam id");
    for (const craft of ["smithing", "alchemy", "fogo", "secador", "defumador"]) assert.equal(api.mayCraft(body(8, "boss"), craft), true);
});

test("an administrator with a guild keeps to its trade like a player, until they ask for every tool; one without a guild uses them all", () => {
    const { api, handlers, dialogues, logs } = load({ guilds: { captain: "venatores", smith: "fabri-ferrarii" }, admins: ["boss", "captain"] });
    const hunter = body(9, "captain");
    assert.equal(api.mayCraft(hunter, "defumador"), true, "his own trade");
    assert.equal(api.mayCraft(hunter, "alchemy"), false, "an administrator and a hunter: not the alchemy tables");
    assert.equal(api.mayCraft(hunter, "smithing"), false);
    assert.equal(api.mayCraft(body(8, "boss"), "alchemy"), true, "an administrator with no guild has no trade to keep to");

    const starting = handlers.get("craftingStarting");
    assert.equal(starting(hunter, { kind: "alchemy" }), false, "the table does not open for him");
    assert.equal(dialogues.length, 1);
    assert.ok(logs.some((line) => /P9 \(venatores\) barrado em alchemy; é de alchemistae/.test(line)), logs.join("|"));

    api.setFreeCrafts(hunter, true);
    assert.equal(api.usesFreeCrafts(hunter), true);
    assert.equal(api.mayCraft(hunter, "alchemy"), true, "he asked for every tool");
    assert.equal(starting(hunter, { kind: "alchemy" }), undefined);
    assert.ok(logs.some((line) => /P9 usa alchemy \(administrador com \/oficios livre\)/.test(line)), logs.join("|"));

    handlers.get("playerDisconnect")(hunter);
    assert.equal(api.usesFreeCrafts(hunter), false, "it lasts until he leaves");
    assert.equal(api.mayCraft(hunter, "alchemy"), false);

    // A player who is not an administrator cannot ask.
    api.setFreeCrafts(body(1, "smith"), true);
    assert.equal(api.mayCraft(body(1, "smith"), "alchemy"), false);
    assert.equal(api.craftReason(body(1, "smith"), "smithing"), "da guilda");
});

test("the refusal says whose place it is and where to choose the guild", () => {
    const { api } = load();
    assert.match(api.refusal("smithing"), /Só os ferreiros \(guilda Fabri Ferrarii\) usam a forja\./);
    assert.match(api.refusal("alchemy"), /alquimistas.*mesas de alquimia/);
    assert.match(api.refusal("fogo"), /taberneiros.*fogo de cozinha/);
    assert.match(api.refusal("defumador"), /caçadores.*defumador/);
    assert.match(api.refusal("horta"), /agricultores \(guilda Agricolae\) usam as hortas/);
    assert.match(api.refusal("domar"), /domadores \(guilda Domitores\).*doma dos cavalos selvagens/, "the taming is the Domitores' since 2026-10-25, not the Agricultores'");
    assert.match(api.refusal("smithing"), /F2/);
});

test("a smithery or an alchemy table is refused to whoever is not of the trade, with a word, said once every ten seconds", () => {
    const { handlers, chat, clock, dialogues } = load({ guilds: { smith: "fabri-ferrarii", brewer: "alchemistae" } });
    const starting = handlers.get("craftingStarting");
    const smith = body(1, "smith");
    const brewer = body(2, "brewer");

    assert.equal(starting(smith, { kind: "smithing" }), undefined, "the smith forges");
    assert.equal(starting(brewer, { kind: "alchemy" }), undefined, "the alchemist brews");
    assert.deepEqual(chat, []);

    assert.equal(starting(smith, { kind: "alchemy" }), false);
    assert.equal(dialogues.length, 1, "the game's own list, not a chat line");
    assert.match(dialogues[0].page.line, /alquimistas/);
    assert.deepEqual(dialogues[0].page.options.map((o) => [o.text, o.enabled]), [["Criar", false], ["Sair", true]], "the work greyed out, and a way out");
    assert.equal(starting(smith, { kind: "alchemy" }), false);
    assert.equal(dialogues.length, 1, "not told again at once");
    clock.now += 11_000;
    assert.equal(starting(smith, { kind: "alchemy" }), false);
    assert.equal(dialogues.length, 2);

    assert.equal(starting(smith, { kind: "repair" }), undefined, "a kind that is nobody's is left alone");
    assert.equal(starting(smith, {}), undefined);
});

test("the grindstone is everybody's: nothing is undone after a sharpening, whoever sharpens (2026-10-22: \"vamos deixar liberado para todo mundo mesmo\")", () => {
    const { handlers, dialogues } = load({ guilds: { smith: "fabri-ferrarii", hunter: "venatores" } });
    assert.equal(handlers.get("playerInventoryChanged"), undefined, "the sharpening is not watched any more");
    assert.equal(handlers.get("kcdc-gamemode:cook.grindstone"), undefined, "nor is there an E at the grindstone to answer");
    assert.deepEqual(dialogues, []);
});

test("butchering game is the hunters': a carcass butchered by anybody else is emptied, and they are told why; a hunter's is left alone", () => {
    const sut = load({ guilds: { "1": "venatores", "2": "tabernarii" } });
    const harvested = sut.handlers.get("npcHarvested");
    harvested({ id: 900 }, body(1, "1"));
    assert.deepEqual(sut.properties, [], "the hunter keeps the meat and the hide");
    assert.deepEqual(sut.trimmed, [900], "but less meat than the game authored (2026-10-22)");
    assert.ok(sut.logs.some((line) => /abate: P1 abateu um animal: carne 6 -> 3/.test(line)));

    harvested({ id: 901 }, body(2, "2"));
    assert.deepEqual(sut.properties, [["set", 901, { items: [], harvested: true }]]);
    assert.deepEqual(sut.trimmed, [900], "the emptied carcass is not trimmed as well");
    assert.equal(sut.dialogues.at(-1).page.options[0].text, "Abater");
    assert.equal(sut.dialogues.at(-1).page.options[0].enabled, false);
    assert.match(sut.dialogues.at(-1).page.line, /Só os caçadores \(guilda Venatores\) sabem abater animais/);
    assert.ok(sut.logs.some((line) => /P2 abateu um animal sem ser caçador; carcaça esvaziada/.test(line)));
});

test("the client is told what the player's guild lets their own game do: butchering for the hunters, the axe and the pick for the Coletores (2026-10-21)", () => {
    const sut = load({ guilds: { hunter: "venatores", gatherer: "collectores", tailor: "artifices", farmer: "agricolae", tamer: "domitores" }, admins: ["boss", "tailor"] });
    const sent = [];
    const body = (id, steamId) => ({ id, steamId, nickname: `P${id}`, emit: (event, payload) => sent.push([id, event, JSON.parse(payload)]) });
    const hunter = body(1, "hunter");
    const gatherer = body(2, "gatherer");
    const tailor = body(3, "tailor");
    const boss = body(4, "boss");
    const farmer = body(5, "farmer");
    const tamer = body(6, "tamer");
    assert.deepEqual({ ...sut.api.rightsOf(hunter) }, { abate: true, lenha: false, mina: false, horta: false, domar: false });
    assert.deepEqual({ ...sut.api.rightsOf(gatherer) }, { abate: false, lenha: true, mina: true, horta: false, domar: false });
    assert.deepEqual({ ...sut.api.rightsOf(tailor) }, { abate: false, lenha: false, mina: false, horta: false, domar: false }, "an administrator with a guild keeps to it");
    assert.deepEqual({ ...sut.api.rightsOf(boss) }, { abate: true, lenha: true, mina: true, horta: true, domar: true }, "one without a guild uses them all");
    assert.deepEqual({ ...sut.api.rightsOf(farmer) }, { abate: false, lenha: false, mina: false, horta: true, domar: false }, "the Agricultores have the gardens' beds, and since 2026-10-25 no longer the wild horses");
    assert.deepEqual({ ...sut.api.rightsOf(tamer) }, { abate: false, lenha: false, mina: false, horta: false, domar: true }, "the Domitores have the wild horses and nothing of the gardens (2026-10-25)");

    sut.handlers.get("kcdc-gamemode:crafts.ask")(gatherer);
    sut.handlers.get("playerSpawned")(hunter);
    assert.deepEqual(sent.map(([id, event, rights]) => [id, event, rights.abate]), [[2, "kcdc-gamemode:crafts.rights", false], [1, "kcdc-gamemode:crafts.rights", true]]);

    sut.api.setFreeCrafts(tailor, true);
    assert.deepEqual(sent.at(-1), [3, "kcdc-gamemode:crafts.rights", { abate: true, lenha: true, mina: true, horta: true, domar: true }], "/oficios livre is told at once");

    sut.online.push(gatherer);
    sut.guilds.gatherer = "venatores";
    for (const listener of sut.guildListeners) listener("gatherer");
    assert.deepEqual(sent.at(-1), [2, "kcdc-gamemode:crafts.rights", { abate: true, lenha: false, mina: false, horta: false, domar: false }], "and so is a change of guild");
});
