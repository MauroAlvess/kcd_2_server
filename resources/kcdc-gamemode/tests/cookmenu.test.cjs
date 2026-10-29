const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
require("./reachpatch.cjs");

// The menu of a trade's place (src/server/cook-menu.ts): "Cozinhar", "Secar", "Defumar" or "Forjar", and "Sair"; the first opens
// the trade's page (craft-menu.ts).

function load({ forge = false } = {}) {
    const state = { chat: [], handlers: new Map(), client: new Map(), opened: [], closed: [], emitted: [], session: 0, busy: new Set(), huds: [], refusals: [] };
    const guild = { mayCraft: (player, kind) => player.crafts === undefined || player.crafts.includes(kind), showRefusal: (player, kind) => state.refusals.push(kind) };
    const cooking = {
        // A fire at (10, 10, 100) and a smokehouse at (300, 300, 50), four metres' reach.
        stationsNear: (at) => [["fogo", 10, 10, 100], ["defumador", 300, 300, 50]].filter((s) => Math.hypot(s[1] - at.x, s[2] - at.y) <= 4 && Math.abs(s[3] - at.z) <= 3).map((s) => s[0]),
        stationPoints: (at, radius) => [["fogo", 10, 10, 100], ["defumador", 300, 300, 50]].filter((s) => Math.hypot(s[1] - at.x, s[2] - at.y) <= radius),
        // The fire's pot has a meal in it when a test says so (2026-10-28).
        hasMeal: (station) => station[0] === "fogo" && state.meal === true,
    };
    const forges = [{ id: "f1", kind: "smithing", position: { x: 500, y: 500, z: 20 } }];
    // An alchemy table of the level itself, at (700, 700, 30): the game's own, which is ours too since 2026-10-24.
    const levelTables = [{ id: "t1", kind: "alchemy", position: { x: 700, y: 700, z: 30 } }];
    const places = { exports: {}, Math };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/craft-places.js"), "utf8"), places);
    places.exports.setCraftPlaces([{ kind: "forja", name: "Forja", x: 1569.8, y: 3816.2, z: 114.3 }, { kind: "alquimia", name: "Mesa de alquimia", x: 1580.2, y: 3822.1, z: 114.3 }]);
    const intervals = [];
    const context = {
        exports: {},
        require: (id) => ({
            "./craft-places.js": places,
            "./cooking.js": cooking,
            "./craft.js": {
                forgeNear: (at) => forge || Math.hypot(at.x - 500, at.y - 500) <= 4,
                alchemyTableNear: (at) => places.exports.craftPlaceNear("alquimia", at) !== null || levelTables.some((s) => Math.hypot(s.position.x - at.x, s.position.y - at.y) <= 4 && Math.abs(s.position.z - at.z) <= 3),
            },
            "./craft-menu.js": { openCraftHud: (player, station) => { state.huds.push(station); return true; } },
            // The grindstones (repair.ts, 2026-10-27): one at (1621, 3804, 114), and one at (503, 500, 20) beside the forge when a test asks for it.
            "./repair.js": {
                grindstoneNear: (at) => Math.hypot(at.x - 1621, at.y - 3804) <= 4 || (state.stoneBesideForge === true && Math.hypot(at.x - 503, at.y - 500) <= 4),
                grindstonesWithin: (at, radius) => [[1621, 3804, 114]].filter((s) => Math.hypot(s[0] - at.x, s[1] - at.y) <= radius),
                openRepairPage: (player) => { state.repairs = [...(state.repairs ?? []), player.id]; return true; },
            },
            "./guild-crafts.js": guild,
            // The notice boards (mural.ts): a board at (3000, 3000, 50), and what the press of its prompt (kind 7) is given to.
            "./mural.js": {
                muralAsked: (payload) => { const f = typeof payload === "string" ? JSON.parse(payload) : payload; return f?.kind === 7 ? { haveArt: f.art === true } : null; },
                muralPointsWithin: (at, radius) => [[7, 3000, 3000, 50]].filter((s) => Math.hypot(s[1] - at.x, s[2] - at.y) <= radius),
                openMural: (player, haveArt) => { state.murals = [...(state.murals ?? []), { player: player.id, haveArt }]; return state.muralFails ? { ok: false, message: "Não há quadro de avisos por perto." } : { ok: true, message: "" }; },
            },
            "./furniture.js": {
                FURNITURE_KIND_INDEX: { cadeira: 5, cama: 6 },
                spotPointsWithin: (at, radius) => [[5, 2000, 2000, 100]].filter((s) => Math.hypot(s[1] - at.x, s[2] - at.y) <= radius),
                useSpot: (player, kind, aimed) => { state.seats = [...(state.seats ?? []), { kind, aimed }]; return { ok: kind === "cadeira", message: kind === "cadeira" ? "" : "Essa cama já está ocupada." }; },
            },
        })[id] ?? assert.fail(`unexpected require ${id}`),
        console: { log() {} },
        Math,
        JSON,
        Chat: { sendToPlayer: (player, text) => state.chat.push(text) },
        Events: { on: (name, fn) => state.handlers.set(name, fn), onClient: (name, fn) => state.client.set(name, fn) },
        setInterval: (fn, ms) => { intervals.push({ fn, ms }); return intervals.length; },
        clearInterval() {},
        Player: { all: () => state.players ?? [] },
        Crafting: { stations: (kind) => [...forges, ...levelTables].filter((station) => kind === undefined || station.kind === kind) },
        Dialogue: {
            sessionOf: (id) => (state.busy.has(id) ? 99 : 0),
            open: (id, page) => { state.session += 1; state.opened.push(JSON.parse(JSON.stringify(page))); return state.session; },
            close: (session) => state.closed.push(session),
        },
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/cook-menu.js"), "utf8"), context);
    context.exports.installCookMenu();
    const player = (x, y, z, extra = {}) => ({ id: 1, steamId: "7656", nickname: "Hans", ready: true, alive: true, position: { x, y, z }, emit: (event, payload) => state.emitted.push({ event, payload }), ...extra });
    return { api: context.exports, state, player, intervals };
}

test("at a fire the menu offers Cozinhar and Sair, and Cozinhar opens the kitchen's page", () => {
    const sut = load();
    const hans = sut.player(11, 10, 100);
    assert.equal(sut.api.openCookMenu(hans), true);
    assert.deepEqual(sut.state.opened[0].options.map((o) => [o.id, o.text, o.enabled]), [["cook", "Cozinhar", true], ["leave", "Sair", true]]);
    assert.match(sut.state.opened[0].line, /O fogo/);
    sut.state.handlers.get("dialogueChoice")(1, hans, "cook");
    assert.deepEqual(sut.state.huds, ["fogo"]);
    assert.deepEqual(sut.state.closed, [1]);
});

test("at a smithery the menu is Forjar and Sair, and opens the forge's page", () => {
    const sut = load();
    const hans = sut.player(501, 500, 20);
    assert.equal(sut.api.openCookMenu(hans), true);
    assert.deepEqual(sut.state.opened[0].options.map((o) => o.text), ["Forjar", "Sair"]);
    assert.match(sut.state.opened[0].line, /A forja/);
    sut.state.handlers.get("dialogueChoice")(1, hans, "cook");
    assert.deepEqual(sut.state.huds, ["forja"]);
});

test("Sair only closes, and walking away before choosing opens nothing", () => {
    const sut = load();
    const hans = sut.player(11, 10, 100);
    sut.api.openCookMenu(hans);
    sut.state.handlers.get("dialogueChoice")(1, hans, "leave");
    assert.deepEqual(sut.state.huds, []);
    sut.api.openCookMenu(hans);
    hans.position = { x: 60, y: 60, z: 100 };
    sut.state.handlers.get("dialogueChoice")(2, hans, "cook");
    assert.deepEqual(sut.state.huds, []);
    assert.match(sut.state.chat.at(-1), /afastou/);
});

test("away from every place there is no menu; a player of another guild is told whose place it is and gets none; nor one already talking", () => {
    const sut = load();
    assert.equal(sut.api.openCookMenu(sut.player(150, 150, 100)), false);
    assert.equal(sut.api.openCookMenu(sut.player(11, 10, 100, { crafts: ["defumador"] })), false);
    assert.deepEqual(sut.state.refusals, ["fogo"]);
    assert.equal(sut.api.openCookMenu(sut.player(501, 500, 20, { crafts: ["fogo"] })), false);
    assert.deepEqual(sut.state.refusals, ["fogo", "smithing"], "the forge is the smiths'");
    sut.state.busy.add(1);
    assert.equal(sut.api.openCookMenu(sut.player(11, 10, 100)), false);
    assert.equal(sut.state.opened.length, 0);
});

test("the client asks for the menu through cook.menu, and is told of the places about it, the forges among them, only when they change", () => {
    const sut = load();
    const hans = sut.player(20, 20, 100);
    sut.state.client.get("kcdc-gamemode:cook.menu")(sut.player(11, 10, 100));
    assert.equal(sut.state.opened.length, 1);

    sut.state.players = [hans];
    const tick = sut.intervals[0];
    tick.fn();
    tick.fn();
    assert.equal(sut.state.emitted.length, 1, "told once");
    assert.deepEqual(JSON.parse(sut.state.emitted[0].payload), [[0, 10, 10, 100]], "the fire within 120 m");
    hans.position = { x: 450, y: 450, z: 20 };
    tick.fn();
    assert.deepEqual(JSON.parse(sut.state.emitted[1].payload), [[3, 500, 500, 20]], "the forge, as kind 3");
});

test("what the client closed of the game's own screens is written to the log, once in a while per player, and nonsense is not", () => {
    const sut = load();
    const hans = sut.player(11, 10, 100);
    assert.equal(sut.api.noteNativeScreen(hans, JSON.stringify({ screen: "ItemSelection", kind: 0 }), 1_000), "cook-menu: Hans: a tela do jogo ItemSelection abriu com o nosso menu (fogo) e foi fechada");
    assert.equal(sut.api.noteNativeScreen(hans, JSON.stringify({ screen: "ItemTransfer", kind: 2 }), 5_000), null, "not twice in 10 s");
    assert.match(sut.api.noteNativeScreen(hans, { screen: "Item<b>Transfer</b>", kind: 3 }, 12_000), /tela do jogo ItembTransferb abriu com o nosso menu \(forja\)/);
    assert.equal(sut.api.noteNativeScreen(sut.player(1, 1, 1, { id: 2 }), "{ nope", 20_000), null);
    assert.equal(sut.api.noteNativeScreen(sut.player(1, 1, 1, { id: 3 }), JSON.stringify({ kind: 0 }), 20_000), null);
});

test("the game's own E at a fire (its picker, closed by the client) gets a note that cooking is on F, once in a while; a press of ours gets none", () => {
    const sut = load();
    const hans = sut.player(11, 10, 100);
    const own = JSON.stringify({ screen: "ItemSelection", kind: 0, own: false });
    assert.equal(sut.api.noteNativeScreen(hans, own, 1_000), "cook-menu: Hans: a tela do jogo ItemSelection abriu no fogo com o E do jogo, sem o nosso menu (que é no F), e foi fechada");
    assert.equal(sut.api.fireKeyNote(own), "No fogo, cozinhar é com a tecla F; o E é do jogo (comer da panela).");
    assert.equal(sut.api.fireKeyNote(JSON.stringify({ screen: "ItemSelection", kind: 0 })), null, "after a press of ours");
    assert.equal(sut.api.fireKeyNote(JSON.stringify({ screen: "ItemSelection", kind: 1, own: false })), null, "only the fire has the F");
    assert.equal(sut.api.fireKeyNote("{ nope"), null);

    const told = load();
    const joao = told.player(11, 10, 100, { id: 7, nickname: "João" });
    const handler = told.state.client.get("kcdc-gamemode:cook.native");
    handler(joao, own);
    handler(joao, own);
    assert.deepEqual(told.state.chat, ["No fogo, cozinhar é com a tecla F; o E é do jogo (comer da panela)."], "once in 10 s");
    assert.equal(told.state.emitted.filter((one) => one.event === "kcdc-gamemode:notify").length, 1);
    const ours = load();
    ours.state.client.get("kcdc-gamemode:cook.native")(ours.player(11, 10, 100), JSON.stringify({ screen: "ItemSelection", kind: 0 }));
    assert.deepEqual(ours.state.chat, []);
});

test("at the grindstone the client asks for our menu to close: the session goes, and nothing else is touched", () => {
    const sut = load();
    const hans = sut.player(501, 500, 20);
    assert.equal(sut.api.openCookMenu(hans), true);
    assert.equal(sut.state.opened[0].options[0].text, "Forjar");
    sut.state.client.get("kcdc-gamemode:cook.cancel")(hans, "{}");
    assert.deepEqual(sut.state.closed, [1]);
    assert.equal(sut.api.cancelCookMenu(hans), false, "nothing left to close");
    sut.state.handlers.get("dialogueChoice")(1, hans, "cook");
    assert.deepEqual(sut.state.huds, [], "a late choice in the closed menu opens no page");
});

test("at the village alchemy table the menu is Preparar and Sair, and opens the alchemy page; the client is told where it is", () => {
    const sut = load();
    const hans = sut.player(1580.6, 3821.2, 114.3, { crafts: ["alchemy"] });
    assert.equal(sut.api.openCookMenu(hans), true);
    assert.match(sut.state.opened.at(-1).line, /mesa de alquimia/);
    assert.deepEqual(sut.state.opened.at(-1).options.map((option) => option.text), ["Preparar", "Sair"]);
    sut.state.handlers.get("dialogueChoice")(1, hans, "cook");
    assert.deepEqual(sut.state.huds, ["alquimia"]);
    const smith = sut.player(1580.6, 3821.2, 114.3, { crafts: ["smithing"] });
    assert.equal(sut.api.openCookMenu(smith), false, "only an alchemist gets it");
    assert.deepEqual(sut.state.refusals.at(-1), "alchemy");
    sut.state.players = [sut.player(1575, 3820, 114.3)];
    for (const interval of sut.intervals) interval.fn();
    const told = JSON.parse(sut.state.emitted.find((entry) => entry.event === "kcdc-gamemode:cook.stations").payload);
    assert.ok(told.some(([kind, x, y]) => kind === 4 && Math.abs(x - 1580.2) < 0.1 && Math.abs(y - 3822.1) < 0.1), "the table, kind 4");
    assert.ok(told.some(([kind, x]) => kind === 3 && Math.abs(x - 1569.8) < 0.1), "and the village forge, kind 3");
});

test("the alchemy tables of the level itself get our Preparar too (2026-10-24: the game's own E there left the player stuck): the menu is Preparar and Sair, and the client is told the table as kind 4", () => {
    const sut = load();
    const hans = sut.player(701, 700, 30);
    assert.equal(sut.api.openCookMenu(hans), true);
    assert.deepEqual(sut.state.opened[0].options.map((o) => o.text), ["Preparar", "Sair"]);
    assert.match(sut.state.opened[0].line, /mesa de alquimia/);
    sut.state.handlers.get("dialogueChoice")(1, hans, "cook");
    assert.deepEqual(sut.state.huds, ["alquimia"]);
    const smith = sut.player(701, 700, 30, { crafts: ["smithing"] });
    assert.equal(sut.api.openCookMenu(smith), false, "only an alchemist gets it");
    assert.equal(sut.state.refusals.at(-1), "alchemy");

    sut.state.players = [sut.player(690, 700, 30)];
    for (const interval of sut.intervals) interval.fn();
    const told = JSON.parse(sut.state.emitted.find((entry) => entry.event === "kcdc-gamemode:cook.stations").payload);
    assert.deepEqual(told, [[4, 700, 700, 30]], "the level's table, kind 4, and nothing else within reach");
});

test("a press on a chair or a bed of the World Builder (kinds 5 and 6) is a seat, with the point it was on; they are told to the client too", () => {
    const sut = load();
    const anna = sut.player(2000.2, 2000.1, 100);
    sut.state.client.get("kcdc-gamemode:cook.menu")(anna, JSON.stringify({ kind: 5, x: 2000, y: 2000 }));
    assert.deepEqual(JSON.parse(JSON.stringify(sut.state.seats)), [{ kind: "cadeira", aimed: { x: 2000, y: 2000 } }]);
    assert.equal(sut.state.opened.length, 0, "no menu");
    sut.state.client.get("kcdc-gamemode:cook.menu")(anna, { kind: 6 });
    assert.deepEqual(JSON.parse(JSON.stringify(sut.state.seats[1])), { kind: "cama", aimed: null });
    assert.match(sut.state.chat.at(-1), /ocupada/);
    assert.equal(sut.api.furnitureAsked(JSON.stringify({ kind: 3 })), null, "the forge is not furniture");
    assert.equal(sut.api.furnitureAsked("{ nope"), null);

    sut.state.players = [anna];
    sut.intervals[0].fn();
    assert.deepEqual(JSON.parse(sut.state.emitted.at(-1).payload), [[5, 2000, 2000, 100]]);
});

test("a press on a notice board's prompt (kind 7) opens its page with whether the client has the pictures, never a trade's menu; a refusal is told in the chat; the boards are told to the client too", () => {
    const sut = load();
    const anna = sut.player(3000, 3000, 50);
    sut.state.client.get("kcdc-gamemode:cook.menu")(anna, JSON.stringify({ kind: 7, x: 3000, y: 3000, art: false }));
    sut.state.client.get("kcdc-gamemode:cook.menu")(anna, { kind: 7, art: true });
    assert.deepEqual(JSON.parse(JSON.stringify(sut.state.murals)), [{ player: 1, haveArt: false }, { player: 1, haveArt: true }]);
    assert.equal(sut.state.opened.length, 0, "no trade's menu");
    assert.equal(sut.state.seats, undefined, "and no seat");

    sut.state.muralFails = true;
    sut.state.client.get("kcdc-gamemode:cook.menu")(anna, { kind: 7 });
    assert.match(sut.state.chat.at(-1), /Não há quadro de avisos/);

    sut.state.players = [anna];
    sut.intervals[0].fn();
    assert.deepEqual(JSON.parse(sut.state.emitted.at(-1).payload), [[7, 3000, 3000, 50]]);
});

test("at a grindstone the menu is Reparar and Sair, only for a smith, and Reparar opens the repair bench's page, not a trade's (2026-10-27)", () => {
    const sut = load();
    const smith = sut.player(1621, 3804, 114, { crafts: ["smithing"] });
    assert.equal(sut.api.openCookMenu(smith), true);
    assert.deepEqual(sut.state.opened[0].options.map((o) => [o.id, o.text]), [["cook", "Reparar"], ["leave", "Sair"]]);
    assert.match(sut.state.opened[0].line, /A pedra de amolar/);
    sut.state.handlers.get("dialogueChoice")(1, smith, "cook");
    assert.deepEqual(sut.state.repairs, [1], "the bench's page");
    assert.deepEqual(sut.state.huds, [], "and no trade's");

    const hunter = sut.player(1621, 3804, 114, { crafts: ["abate"] });
    assert.equal(sut.api.openCookMenu(hunter), false, "a hunter gets no menu");
    assert.equal(sut.state.refusals.at(-1), "smithing", "and is told whose place it is");
    assert.equal(sut.state.opened.length, 1);
});

test("beside the forge the press says which place it was on: kind 8 is the grindstone, kind 3 the forge, and with no kind the forge keeps its old place (2026-10-27)", () => {
    const sut = load();
    sut.state.stoneBesideForge = true;
    const smith = sut.player(503, 500, 20, { crafts: ["smithing"] });
    assert.equal(sut.api.askedKind({ kind: 8, x: 503, y: 500 }), "amolar");
    assert.equal(sut.api.askedKind(JSON.stringify({ kind: 3 })), "forja");
    assert.equal(sut.api.askedKind({ kind: 99 }), null);
    assert.equal(sut.api.askedKind("not json"), null);

    sut.state.client.get("kcdc-gamemode:cook.menu")(smith, JSON.stringify({ kind: 8, x: 503, y: 500 }));
    assert.match(sut.state.opened.at(-1).line, /A pedra de amolar/);
    sut.state.client.get("kcdc-gamemode:cook.menu")(smith, JSON.stringify({ kind: 3, x: 500, y: 500 }));
    assert.match(sut.state.opened.at(-1).line, /A forja/);
    sut.api.openCookMenu(smith);
    assert.match(sut.state.opened.at(-1).line, /A forja/, "no kind: the first place that is theirs, as before");
});

test("the client is told of the level's grindstones about it, as kind 8", () => {
    const sut = load();
    sut.state.players = [sut.player(1615, 3800, 114)];
    for (const interval of sut.intervals) interval.fn();
    const told = JSON.parse(sut.state.emitted.find((entry) => entry.event === "kcdc-gamemode:cook.stations").payload);
    assert.ok(told.some(([kind, x, y, z]) => kind === 8 && x === 1621 && y === 3804 && z === 114), "the stone, kind 8, with the forge and the table of the village beside it");
});

test("a fire whose pot has a meal in it is told to the client with a fifth number, 1, and any other place with four (2026-10-28)", () => {
    const told = (meal) => {
        const sut = load();
        sut.state.meal = meal;
        sut.state.players = [sut.player(11, 10, 100)];
        for (const interval of sut.intervals) interval.fn();
        return JSON.parse(sut.state.emitted.find((entry) => entry.event === "kcdc-gamemode:cook.stations").payload);
    };
    assert.deepEqual(told(true).find(([kind]) => kind === 0), [0, 10, 10, 100, 1]);
    assert.deepEqual(told(false).find(([kind]) => kind === 0), [0, 10, 10, 100]);
    assert.ok(told(true).every((place) => place[0] === 0 || place.length === 4), "nothing else grows a number");
});
