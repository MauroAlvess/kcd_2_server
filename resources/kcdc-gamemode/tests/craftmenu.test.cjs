"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

// The trades' page put up and answered (src/server/craft-menu.ts): who gets it, the work asked of it, sewing from the panel, and
// the alchemy table's "Criar / Sair" first.

function load({ guilds = ["fogo", "alchemy", "costura"], granted = false } = {}) {
    const state = { counts: [], cancelCalls: [], processed: [], handlers: new Map(), client: new Map(), emitted: [], chat: [], made: [], chosen: [], opened: [], closed: [], session: 0, busy: new Set(), notices: [], planted: [], plantCancels: 0, pageClosed: [] };
    const craft = {
        STATIONS: { fogo: { title: "Cozinha", craft: "fogo" }, alquimia: { title: "Alquimia", craft: "alchemy" }, costura: { title: "Costura", craft: "costura" }, forja: { title: "Forja", craft: "smithing" } },
        viewFor: (player, station) => ({ station, recipes: [] }),
        batchOf: (value) => { const n = Math.floor(Number(value)); return Number.isFinite(n) ? Math.min(10, Math.max(1, n)) : 1; },
        make: (player, id, near, report, spot, count) => { state.counts.push(count); state.made.push({ id, forge: near(player, "forja"), fire: near(player, "fogo"), sew: near(player, "costura") }); report(player, { ok: true, message: "Feito." }); },
        chooseAlchemy: (player, id) => { state.chosen.push(id); return { ok: true, message: "Está no seu livro." }; },
        atOwnAlchemyTable: (player) => player.position.x > 1000,
        brew: (player, id, atTable, report, spot, count) => { state.counts.push(count); state.brewed = [...(state.brewed ?? []), { id, at: atTable(player) }]; report(player, { ok: true, message: "Preparando." }); },
        alchemyGranted: () => granted,
        recipeById: (id) => (id.startsWith("alquimia:atadura") ? { id } : { id, alchemy: 1 }),
        madeOnPage: (recipe) => recipe.alchemy === undefined,
        cancelWork: (player, say, onlyBatch) => { state.cancelCalls.push({ say: typeof say === "function", onlyBatch: onlyBatch === true }); return true; },
        isWorking: () => state.working === true,
        forgeNear: (at) => at.x > 400,
        forgetCraft() {},
        unlockedAt: (player, track, level) => (level === 4 ? [{ id: "fogo:bread", station: "fogo" }] : []),
    };
    const context = {
        exports: {},
        require: (id) => ({
            "./cooking.js": { stationsNear: (at) => (at.x < 20 ? ["fogo"] : []) },
            "./craft.js": craft,
            "./craft-titles.js": { craftTitle: (station) => (station === "fogo" ? "data:image/webp;base64,AAAA" : "") },
            "./craft-spot.js": { workSpot: () => ({ point: null, campfire: false, female: false }) },
            "./big-emit.js": { emitLarge: (player, name, json) => { player.emit(`kcdc-gamemode:${name}`, json); return 1; } },
            "./guild-crafts.js": { mayCraft: (player, kind) => guilds.includes(kind) },
            // The forge's and the sewing page's second tab (2026-10-27): the pieces to break apart.
            "./extract.js": {
                EXTRACT_PREFIX: "extrair:",
                MODES: [["fabricar", "Fabricar"], ["extrair", "Extrair"]],
                canExtractAt: (station) => station === "forja" || station === "costura",
                extractView: (player, station) => ({ station, mode: "extrair", recipes: [{ id: "extrair:a" }] }),
                extract: (player, id, station, near) => { state.extracted = [...(state.extracted ?? []), { id, station, near: near(player, station) }]; return { ok: true, message: "Extraído." }; },
            },
            // The gardens' page shares this one (2026-10-22): its "Plantar", its "Parar" and its closing go to farm.ts.
            "./repair.js": {
                REPAIR_PREFIX: "reparo:",
                repairFromPage: (player, id) => { state.repairsAsked = [...(state.repairsAsked ?? []), [player.id, id]]; },
                repairPageClosed: (player) => { state.repairClosed = [...(state.repairClosed ?? []), player.id]; },
            },
            "./farm.js": {
                RECIPE_PREFIX: "horta:",
                PROCESS_PREFIX: "beneficiar:",
                processFromPage: (player, id, count) => { state.processed.push([id, count]); return ""; },
                plantFromPage: (player, id) => { state.planted.push(id); return ""; },
                cancelPlanting: () => { state.plantCancels += 1; return true; },
                farmPageClosed: (player) => { state.pageClosed.push(player.id); },
            },
        })[id] ?? assert.fail(`unexpected require ${id}`),
        console: { log() {} },
        Date,
        JSON,
        Chat: { sendToPlayer: (player, text) => state.chat.push(text) },
        Events: { on: (name, fn) => state.handlers.set(name, fn), onClient: (name, fn) => state.client.set(name, fn) },
        Dialogue: {
            sessionOf: (id) => (state.busy.has(id) ? 9 : 0),
            open: (id, page) => { state.session += 1; state.opened.push(JSON.parse(JSON.stringify(page))); return state.session; },
            close: (session) => state.closed.push(session),
        },
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/craft-menu.js"), "utf8"), context);
    context.exports.installCraftMenu();
    const player = (x = 10) => ({ id: 1, nickname: "Hans", ready: true, alive: true, position: { x, y: 0, z: 0 }, emit: (event, payload) => state.emitted.push({ event, payload: JSON.parse(payload) }) });
    return { api: context.exports, state, player };
}

test("a trade's page goes up for a member of its guild, and not for anybody else", () => {
    const sut = load({ guilds: ["fogo"] });
    assert.equal(sut.api.openCraftHud(sut.player(), "fogo"), true);
    assert.deepEqual(sut.state.emitted[0], { event: "kcdc-gamemode:craft.view", payload: { station: "fogo", recipes: [], img: "data:image/webp;base64,AAAA" } }, "the title image goes with the page as it opens");
    assert.equal(sut.api.openCraftHud(sut.player(), "forja"), false);
    assert.equal(sut.state.emitted.length, 1);
});

test("the work asked of the page is done where the trade is worked, and the page is told how it went and sent again", () => {
    const sut = load();
    const hans = sut.player(10);
    sut.api.openCraftHud(hans, "fogo");
    sut.state.client.get("kcdc-gamemode:craft.make")(hans, JSON.stringify({ id: "fogo:pretzel" }));
    assert.deepEqual(sut.state.made, [{ id: "fogo:pretzel", forge: false, fire: true, sew: true }], "the fire by the stations, the forge by the smitheries, sewing anywhere");
    const [view, result, again] = sut.state.emitted;
    assert.equal(view.event, "kcdc-gamemode:craft.view");
    assert.deepEqual(result, { event: "kcdc-gamemode:craft.result", payload: { ok: true, text: "Feito." } });
    assert.equal(again.event, "kcdc-gamemode:craft.view");
    assert.equal(again.payload.img, undefined, "not again with each refresh: the page keeps it");
    sut.state.client.get("kcdc-gamemode:craft.make")(hans, "nonsense");
    sut.state.client.get("kcdc-gamemode:craft.make")(hans, JSON.stringify({ id: 5 }));
    assert.equal(sut.state.made.length, 1);
});

test("sewing opens from the panel for an artisan; anybody else is told whose it is", () => {
    const sut = load({ guilds: ["costura"] });
    sut.state.client.get("kcdc-gamemode:status.craftOpen")(sut.player(), JSON.stringify({ station: "costura" }));
    assert.equal(sut.state.emitted.at(-1).payload.station, "costura");
    const other = load({ guilds: ["fogo"] });
    other.state.client.get("kcdc-gamemode:status.craftOpen")(other.player(), { station: "costura" });
    assert.deepEqual(other.state.emitted, []);
    assert.match(other.state.chat.at(-1), /artesãos/);
    other.state.client.get("kcdc-gamemode:status.craftOpen")(other.player(), { station: "fogo" });
    assert.deepEqual(other.state.emitted, [], "only sewing opens from the panel");
});

test("at the alchemy table a member who has not chosen a potion is refused and shown Criar / Sair; Criar opens the page, where a choice teaches it", () => {
    const sut = load();
    const hans = sut.player();
    const starting = sut.state.handlers.get("craftingStarting");
    assert.equal(starting(hans, { kind: "alchemy" }), false);
    assert.deepEqual(sut.state.opened[0].options.map((o) => o.text), ["Criar", "Sair"]);
    assert.equal(starting(hans, { kind: "alchemy" }), false);
    assert.equal(sut.state.opened.length, 1, "not shown twice at once");
    assert.equal(starting(hans, { kind: "alchemy", continuationOf: "batch-1" }), undefined, "a next batch at the table it holds is let be");
    assert.equal(starting(hans, { kind: "smithing" }), undefined);

    sut.state.handlers.get("dialogueChoice")(1, hans, "craft:create");
    assert.equal(sut.state.emitted.at(-1).payload.station, "alquimia");
    sut.state.client.get("kcdc-gamemode:craft.make")(hans, { id: "alquimia:16" });
    assert.deepEqual(sut.state.chosen, ["alquimia:16"], "on the alchemy page a choice is a potion taught, not work done");
    assert.deepEqual(sut.state.made, []);

    const chosen = load({ granted: true });
    assert.equal(chosen.state.handlers.get("craftingStarting")(chosen.player(), { kind: "alchemy" }), undefined, "chosen a moment ago: the table opens");
    const stranger = load({ guilds: ["fogo"] });
    assert.equal(stranger.state.handlers.get("craftingStarting")(stranger.player(), { kind: "alchemy" }), undefined, "not a member: guild-crafts.ts refuses");
    assert.deepEqual(stranger.state.opened, []);
});

test("a level that unlocks recipes is told to the player", () => {
    const sut = load();
    const hans = sut.player();
    sut.state.handlers.get("playerLevelUp")(hans, "survival", 4, 1);
    assert.match(sut.state.chat.at(-1), /Novas receitas liberadas \(1\) no nível 4/);
    sut.state.handlers.get("playerLevelUp")(hans, "survival", 5, 1);
    assert.equal(sut.state.chat.length, 1);
});

test("the alchemists' bandages are made on the page, a potion is chosen for the table", () => {
    const sut = load();
    const hans = sut.player(10);
    sut.api.openCraftHud(hans, "alquimia");
    sut.state.client.get("kcdc-gamemode:craft.make")(hans, JSON.stringify({ id: "alquimia:atadura-comfrey" }));
    assert.deepEqual(Array.from(sut.state.chosen), [], "not taught to the recipe book");
    assert.equal(sut.state.made.at(-1).id, "alquimia:atadura-comfrey");
    sut.state.client.get("kcdc-gamemode:craft.make")(hans, JSON.stringify({ id: "alquimia:12" }));
    assert.deepEqual(Array.from(sut.state.chosen), ["alquimia:12"]);
});

test("a potion chosen on the page at the village table is brewed there; at the game's own table it is taught for its minigame", () => {
    const sut = load({ guilds: ["alchemy"] });
    const village = sut.player(1580);
    sut.api.openCraftHud(village, "alquimia");
    sut.state.client.get("kcdc-gamemode:craft.make")(village, JSON.stringify({ id: "alquimia:16" }));
    assert.deepEqual(sut.state.brewed, [{ id: "alquimia:16", at: true }]);
    assert.deepEqual(sut.state.chosen, []);
    const elsewhere = sut.player(10);
    sut.api.openCraftHud(elsewhere, "alquimia");
    sut.state.client.get("kcdc-gamemode:craft.make")(elsewhere, JSON.stringify({ id: "alquimia:16" }));
    assert.deepEqual(sut.state.chosen, ["alquimia:16"]);
    assert.equal(sut.state.brewed.length, 1);
});

// 2026-10-22: the Agricultores' gardens use this page too (src/server/farm.ts): their recipes are `horta:<crop>`.

test("the gardens' page shares the trades' events: a horta: recipe is farm.ts's to plant, and closing tells it", () => {
    const sut = load();
    const hans = sut.player();
    sut.state.client.get("kcdc-gamemode:craft.make")(hans, JSON.stringify({ id: "horta:cebola" }));
    assert.deepEqual(Array.from(sut.state.planted), ["horta:cebola"]);
    assert.deepEqual(sut.state.made, [], "no trade's work is started for it");

    sut.state.client.get("kcdc-gamemode:craft.closed")(hans);
    assert.deepEqual(Array.from(sut.state.pageClosed), [1]);

    // Parar stops a trade's work first (the fake always has one on); the planting is looked for only when there is none.
    sut.state.client.get("kcdc-gamemode:craft.cancel")(hans);
    assert.equal(sut.state.plantCancels, 0);
});

test("the forge's and the sewing page have two tabs: the recipes, and the pieces to break apart (2026-10-27)", () => {
    const sut = load({ guilds: ["smithing", "costura", "fogo"] });
    const hans = sut.player(500);
    sut.api.openCraftHud(hans, "forja");
    const opened = sut.state.emitted.at(-1).payload;
    assert.equal(opened.mode, "fabricar");
    assert.deepEqual(opened.modes, [["fabricar", "Fabricar"], ["extrair", "Extrair"]]);

    const mode = sut.state.client.get("kcdc-gamemode:craft.mode");
    mode(hans, JSON.stringify({ mode: "extrair" }));
    assert.deepEqual(sut.state.emitted.at(-1).payload, { station: "forja", mode: "extrair", recipes: [{ id: "extrair:a" }] }, "the list of pieces");

    // The work asked of that list is extract.ts's, at the station, and the page is answered with the list again.
    sut.state.client.get("kcdc-gamemode:craft.make")(hans, JSON.stringify({ id: "extrair:a" }));
    assert.deepEqual(sut.state.extracted, [{ id: "extrair:a", station: "forja", near: true }]);
    assert.deepEqual(sut.state.made, [], "not made like a recipe");
    assert.deepEqual(sut.state.emitted.at(-2).payload, { ok: true, text: "Extraído." });
    assert.equal(sut.state.emitted.at(-1).payload.mode, "extrair", "the tab stays where the player put it");
    assert.equal(sut.state.chat.at(-1), "Extraído.");

    mode(hans, JSON.stringify({ mode: "fabricar" }));
    assert.equal(sut.state.emitted.at(-1).payload.mode, "fabricar");

    // A page opened again starts on the recipes, whichever tab it was left on.
    mode(hans, JSON.stringify({ mode: "extrair" }));
    sut.api.openCraftHud(hans, "forja");
    assert.equal(sut.state.emitted.at(-1).payload.mode, "fabricar");
});

test("the tab is for the trades that have it, not while working, and only for the modes it knows; closing the page forgets it", () => {
    const sut = load({ guilds: ["smithing", "costura", "fogo"] });
    const hans = sut.player(500);
    const mode = sut.state.client.get("kcdc-gamemode:craft.mode");
    mode(hans, JSON.stringify({ mode: "extrair" }));
    assert.deepEqual(sut.state.emitted, [], "no page open");

    sut.api.openCraftHud(hans, "fogo");
    const before = sut.state.emitted.length;
    mode(hans, JSON.stringify({ mode: "extrair" }));
    assert.equal(sut.state.emitted.length, before, "the kitchen has none");
    sut.state.client.get("kcdc-gamemode:craft.make")(hans, JSON.stringify({ id: "extrair:a" }));
    assert.equal(sut.state.extracted, undefined);

    sut.api.openCraftHud(hans, "costura");
    sut.state.working = true;
    mode(hans, JSON.stringify({ mode: "extrair" }));
    sut.state.client.get("kcdc-gamemode:craft.make")(hans, JSON.stringify({ id: "extrair:a" }));
    assert.equal(sut.state.emitted.at(-2).payload.text, "Você já está trabalhando em algo.");
    assert.equal(sut.state.extracted, undefined, "nothing is broken while a piece of work goes on");
    sut.state.working = false;
    mode(hans, JSON.stringify({ mode: "outro" }));
    mode(hans, "nonsense");
    assert.equal(sut.state.emitted.at(-1).payload.mode, "fabricar");

    mode(hans, JSON.stringify({ mode: "extrair" }));
    sut.state.client.get("kcdc-gamemode:craft.closed")(hans);
    sut.state.client.get("kcdc-gamemode:craft.make")(hans, JSON.stringify({ id: "extrair:a" }));
    assert.equal(sut.state.extracted, undefined, "the page is closed: nothing to answer");
});

test("the page asks for a number of pieces at once, from one to ten (2026-10-27): the work gets the number, held to that, and the gardens' work on the harvest too", () => {
    const sut = load({ guilds: ["fogo", "alchemy"] });
    const hans = sut.player(10);
    sut.api.openCraftHud(hans, "fogo");
    const make = sut.state.client.get("kcdc-gamemode:craft.make");
    make(hans, JSON.stringify({ id: "fogo:pretzel" }));
    make(hans, JSON.stringify({ id: "fogo:pretzel", n: 4 }));
    make(hans, JSON.stringify({ id: "fogo:pretzel", n: 99 }));
    make(hans, JSON.stringify({ id: "fogo:pretzel", n: 0 }));
    make(hans, JSON.stringify({ id: "fogo:pretzel", n: "7" }));
    make(hans, JSON.stringify({ id: "fogo:pretzel", n: "many" }));
    make(hans, JSON.stringify({ id: "fogo:pretzel", n: 2.9 }));
    assert.deepEqual(Array.from(sut.state.counts), [1, 4, 10, 1, 7, 1, 2]);

    make(hans, JSON.stringify({ id: "beneficiar:fiar-linha", n: 6 }));
    make(hans, JSON.stringify({ id: "beneficiar:moer-trigo" }));
    assert.deepEqual(sut.state.processed.map(([id, count]) => [id, count]), [["beneficiar:fiar-linha", 6], ["beneficiar:moer-trigo", 1]]);
    assert.deepEqual(Array.from(sut.state.counts).length, 7, "the garden's work is not a trade's");
});

const plain = (value) => JSON.parse(JSON.stringify(value));

test("Parar tells the page how the work ended, and closing the page stops a work of several pieces and only that (2026-10-27)", () => {
    const sut = load();
    const hans = sut.player(10);
    sut.api.openCraftHud(hans, "fogo");
    sut.state.client.get("kcdc-gamemode:craft.cancel")(hans);
    assert.deepEqual(plain(sut.state.cancelCalls), [{ say: true, onlyBatch: false }], "the page's own reporter is handed over: the outcome (what was made, the XP) goes to the page and the chat");
    sut.state.client.get("kcdc-gamemode:craft.closed")(hans);
    assert.deepEqual(plain(sut.state.cancelCalls.at(-1)), { say: true, onlyBatch: true }, "closing the page ends a work of several, never a single piece's");
});
