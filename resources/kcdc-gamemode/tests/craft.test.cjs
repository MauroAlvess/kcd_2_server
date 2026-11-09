"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const { profession } = require("./reachpatch.cjs");
// The tables' own XP and no day's limit: these tests are of the work and not of the pace the trades' XP is paid at (src/server/profession-xp.ts, the standard of 2026-11-03): the tests of the pace set it.
profession.useTables();

// The guilds' trades (src/server/craft.ts) over the real recipes (craft-data.js) and a fake game: the page's view, the work,
// what it takes and gives, the XP, and alchemy's chosen potion.

const dist = (name) => fs.readFileSync(path.join(__dirname, "../dist/server", name), "utf8");
const plain = (value) => JSON.parse(JSON.stringify(value));

const SALT = "b9ed56a7-7965-48e3-ab35-78aec6733f3d";
const WATER = "0cb47176-06c5-42a9-8d70-969e917eb999";
const PRETZEL = "c352d8ae-4021-4f9b-b49c-b1f087f2cd2c";
const FLOUR_GUID = "aaaa0000-0000-0000-0000-00000000f10e";
// What one piece of work is worth since 2026-11-01: the recipe's old worth times its level's share (`tools/make-craft-recipes.py`): the pretzel (level 1) was 8, the thread (level 0) 3.
const PRETZEL_XP = 4;
// Thread is a first step of a chain: a quarter of its recipe's 2 XP, never less than 1 (2026-11-03, craft.ts `CONVERSION_SHARE`).
const THREAD_XP = 1;

function load({ guilds = ["fogo", "alchemy", "smithing"], free = false, alchemyStations = [] } = {}) {
    // The body's own water (src/server/thirst.ts, 2026-10-30), as the real pace reads and spends it: never to under 10 points, all of a batch while thirst is off.
    const body = { enabled: true, value: 100, spent: [] };
    const thirstStub = {
        thirstPace: {
            pieces: (player, each, most) => (body.enabled ? Math.max(0, Math.min(most, Math.floor((body.value - 10) / each))) : most),
            spend: (player, amount) => {
                if (body.enabled && amount > 0) {
                    body.value = Math.max(0, body.value - amount);
                    body.spent.push(amount);
                }
                return body.value;
            },
        },
    };
    const state = { rows: [], revision: 1, nextRow: 1, timers: [], xp: [], emitted: [], knowledge: [], played: [], playedMs: [], stopped: 0, addRefuses: false, refuseQuality: false, adds: [], logs: [] };
    const dataSandbox = { exports: {} };
    vm.runInNewContext(dist("craft-data.js"), dataSandbox);
    const itemsSandbox = {
        exports: {},
        require: (id) => (id === "./craft-data.js" ? dataSandbox.exports : assert.fail(`unexpected require ${id}`)),
        console: { log: (line) => state.logs.push(line) },
        Items: { register: (id) => (id === "kcdc-craft:farinha" ? FLOUR_GUID : `guid-${id}`) },
    };
    vm.runInNewContext(dist("craft-items.js"), itemsSandbox);
    itemsSandbox.exports.registerCraftItems();
    const decaySandbox = { exports: {} };
    vm.runInNewContext(dist("food-decay-data.js"), decaySandbox);
    const placesSandbox = { exports: {}, Math };
    vm.runInNewContext(dist("craft-places.js"), placesSandbox);
    // The village of Raborsch as the World Builder export placed it: the stone forge, and the alchemist's frame and furnace.
    placesSandbox.exports.setCraftPlaces(placesSandbox.exports.placesOf([
        { model: "objects/manmade/structures/industrial/smitheries/forge_big_a.cgf", position: { x: 1569.8, y: 3816.2, z: 114.3 } },
        { model: "objects/manmade/task_specific_props/alchemy/alchemy_table_a/alchemy_table_a.cgf", position: { x: 1580.2, y: 3822.1, z: 114.3 } },
        { model: "objects/manmade/common_furniture/beds/high/bed_double_royal_a.cgf", position: { x: 1442.1, y: 3825.0, z: 125.1 } },
    ]));
    const context = {
        exports: {},
        require: (id) => ({
            "./craft-places.js": placesSandbox.exports,
            "./craft-data.js": dataSandbox.exports,
            "./craft-items.js": itemsSandbox.exports,
            "./food-decay-data.js": decaySandbox.exports,
            "./craft-animation.js": { playWork: (player, trade, options) => { state.played.push(trade); state.playedMs.push(options?.ms); return true; }, stopWork: () => { state.stopped += 1; } },
            "./guild-crafts.js": { mayCraft: (player, craft) => guilds.includes(craft), usesFreeCrafts: () => free },
            // The cauldron cooked at is lit (pot-fires.ts, 2026-11-02): recorded.
            "./pot-fires.js": { litForCooking: (player) => { (globalThis.__potsLit ??= []).push(player.id); return ""; } },
            "./thirst.js": thirstStub,
        })[id] ?? assert.fail(`unexpected require ${id}`),
        console: { log: (line) => state.logs.push(line) },
        Date,
        Math,
        JSON,
        setTimeout: (fn, ms) => { state.timers.push({ fn, ms }); return state.timers.length; },
        clearTimeout: (id) => { if (state.timers[id - 1]) state.timers[id - 1].fn = () => {}; },
        Inventory: {
            get: () => ({ revision: state.revision, items: state.rows.map((row) => ({ ...row })) }),
            remove: (player, request) => {
                if (request.revision !== state.revision) return { ok: false };
                for (const unit of request.units) {
                    const row = state.rows.find((r) => r.id === unit.id);
                    if (!row || row.amount < unit.amount) return { ok: false };
                }
                for (const unit of request.units) state.rows.find((r) => r.id === unit.id).amount -= unit.amount;
                state.rows = state.rows.filter((row) => row.amount > 0);
                state.revision += 1;
                return { ok: true };
            },
            add: (player, request) => {
                if (state.addRefuses && (state.addRefuses === true || request.item === PRETZEL)) return state.addRefuses === true ? { ok: false } : { ok: false, code: state.addRefuses };
                // A tier the class is not made in (2026-10-31): the game says so, and the work asks again for the plain piece.
                if (state.refuseQuality && request.metadata?.quality > 1) return { ok: false, code: "invalidQuality" };
                state.adds.push(request);
                state.rows.push({ id: `r${state.nextRow++}`, item: request.item, amount: request.amount, ...(request.metadata ? { metadata: request.metadata } : {}) });
                state.revision += 1;
                return { ok: true };
            },
        },
        Crafting: {
            stations: (kind) => [{ id: "s1", kind: "smithing", position: { x: 50, y: 50, z: 10 } }, ...alchemyStations].filter((station) => kind === undefined || station.kind === kind),
            setKnowledge: (player, recipe, mask) => { state.knowledge.push([recipe, mask]); return true; },
        },
    };
    vm.runInNewContext(dist("craft.js"), context);
    // The chance of a better piece is the test's: never, unless a test says so.
    context.exports.craftSettings.random = () => 0.9999;
    const player = (levels = {}) => ({
        id: 1,
        nickname: "Hans",
        ready: true,
        alive: true,
        position: { x: 0, y: 0, z: 0 },
        getTrack: (track) => ({ level: levels[track] ?? 0, xp: 0, perkPoints: 0 }),
        addXp: (track, xp) => { state.xp.push([track, xp]); return true; },
        emit: (event, payload) => state.emitted.push({ event, payload: JSON.parse(payload) }),
    });
    const give = (item, amount) => state.rows.push({ id: `r${state.nextRow++}`, item, amount });
    const has = (item) => state.rows.filter((row) => row.item === item).reduce((sum, row) => sum + row.amount, 0);
    const reports = [];
    const report = (p, outcome) => reports.push(plain(outcome));
    return { api: context.exports, state, player, give, has, reports, report, body };
}

const near = () => true;
const far = () => false;

test("the page lists the trade's recipes with what the player has: locked above their level, makeable only with all of it", () => {
    const sut = load();
    const hans = sut.player({ survival: 1 });
    sut.give(FLOUR_GUID, 2);
    sut.give(SALT, 1);
    sut.give(WATER, 1);
    const view = plain(sut.api.viewFor(hans, "fogo"));
    assert.equal(view.title, "Cozinha");
    assert.equal(view.verb, "Cozinhar");
    assert.equal(view.level, 1);
    const pretzel = view.recipes.find((r) => r.id === "fogo:pretzel");
    assert.deepEqual(pretzel.ing, [["kcdc-craft:farinha", 1, 2], [SALT, 1, 1], [WATER, 1, 1]]);
    assert.equal(pretzel.can, true);
    assert.equal(pretzel.lock, false);
    const bread = view.recipes.find((r) => r.id === "fogo:bread");
    assert.equal(bread.lock, true, "bread is level 4");
    assert.equal(bread.can, false);
    assert.equal(view.recipes.find((r) => r.id === "fogo:beer").trk, "drinking", "the drinks train drinking");
    assert.deepEqual(view.items["kcdc-craft:farinha"], ["Farinha de trigo", "loot_salt"], "our flour looks like the game's salt bag");
    assert.ok(view.items[PRETZEL][0].length > 0);
    assert.ok(view.recipes.every((r) => r.id.startsWith("fogo:")));
    assert.ok(view.recipes.length > 50);
});

test("work is played for the recipe's time; then what it takes is taken, what it makes given, and its XP granted", () => {
    const sut = load();
    const hans = sut.player({ survival: 2 });
    sut.give(FLOUR_GUID, 2);
    sut.give(SALT, 1);
    sut.give(WATER, 1);
    sut.api.make(hans, "fogo:pretzel", near, sut.report);
    assert.deepEqual(sut.state.played, ["fogo"]);
    assert.deepEqual(sut.reports, [], "nothing to say yet");
    assert.equal(sut.state.emitted[0].event, "kcdc-gamemode:craft.progress");
    assert.deepEqual(sut.state.emitted[0].payload, { id: "fogo:pretzel", ms: 6000, doing: "Cozinhando" });
    assert.equal(sut.api.isWorking(hans), true);
    sut.api.make(hans, "fogo:pretzel", near, sut.report);
    assert.match(sut.reports[0].message, /já está trabalhando/);

    sut.state.timers[0].fn();
    assert.equal(sut.api.isWorking(hans), false);
    assert.equal(sut.state.stopped, 1);
    assert.equal(sut.has(FLOUR_GUID), 1);
    assert.equal(sut.has(SALT), 0);
    assert.equal(sut.has(WATER), 0);
    assert.equal(sut.has(PRETZEL), 2);
    assert.deepEqual(sut.state.xp, [["survival", PRETZEL_XP]]);
    assert.equal(sut.reports.at(-1).ok, true);
    assert.match(sut.reports.at(-1).message, new RegExp(`2x .*\\+${PRETZEL_XP} XP`));
});

test("another trade's recipe, one above the level, away from the place, or with something missing is refused at once, saying why", () => {
    const sut = load({ guilds: ["fogo"] });
    const hans = sut.player({ survival: 0, craftsmanship: 30 });
    sut.api.make(hans, "forja:r_axework01", near, sut.report);
    assert.match(sut.reports.at(-1).message, /não é do seu ofício/);
    sut.api.make(hans, "fogo:bread", near, sut.report);
    assert.match(sut.reports.at(-1).message, /nível 4/);
    sut.api.make(hans, "fogo:pretzel", near, sut.report);
    assert.match(sut.reports.at(-1).message, /nível 1/);
    const cook = sut.player({ survival: 5 });
    sut.api.make(cook, "fogo:pretzel", far, sut.report);
    assert.match(sut.reports.at(-1).message, /junto do fogo/);
    sut.api.make(cook, "fogo:pretzel", near, sut.report);
    assert.match(sut.reports.at(-1).message, /Falta: 1x Farinha de trigo \(tem 0\)/);
    sut.api.make(cook, "nope", near, sut.report);
    assert.match(sut.reports.at(-1).message, /desconhecida/);
    assert.deepEqual(sut.state.timers, [], "none of it started");

    const free = load({ guilds: ["fogo"], free: true });
    const admin = free.player({ survival: 0 });
    free.give(FLOUR_GUID, 2);
    free.give(SALT, 1);
    free.give(WATER, 2);
    free.give(FLOUR_GUID, 1);
    free.api.make(admin, "fogo:bread", near, free.report);
    assert.equal(free.state.timers.length, 1, "an administrator with every tool is not held to the level");
});

test("what was gone by the end makes nothing and takes nothing; what does not fit is given back", () => {
    const sut = load();
    const hans = sut.player({ survival: 5 });
    sut.give(FLOUR_GUID, 1);
    sut.give(SALT, 1);
    sut.give(WATER, 1);
    sut.api.make(hans, "fogo:pretzel", near, sut.report);
    sut.state.rows = sut.state.rows.filter((row) => row.item !== SALT);
    sut.state.timers[0].fn();
    assert.equal(sut.reports.at(-1).ok, false);
    assert.match(sut.reports.at(-1).message, /Nada foi feito\. Falta: 1x/);
    assert.equal(sut.has(FLOUR_GUID), 1, "nothing taken");

    sut.give(SALT, 1);
    sut.state.addRefuses = true;
    sut.api.make(hans, "fogo:pretzel", near, sut.report);
    sut.state.timers[1].fn();
    assert.match(sut.reports.at(-1).message, /não coube/);
    sut.state.addRefuses = false;
    // The game turning the item down (not a full bag) is told otherwise and logged, and nothing is spent either way. (The full-bag refusal above turns every
    // add away, the ingredients' coming back too: the bag is stocked again.)
    sut.give(FLOUR_GUID, 1);
    sut.give(WATER, 1);
    sut.give(SALT, 1);
    sut.state.addRefuses = "invalidItem";
    const flourBefore = sut.has(FLOUR_GUID);
    sut.api.make(hans, "fogo:pretzel", near, sut.report);
    sut.state.timers[2].fn();
    assert.match(sut.reports.at(-1).message, /o jogo não aceitou este item, e nada foi gasto/);
    assert.ok(sut.state.logs.some((line) => /craft: o jogo não aceitou .+ \(fogo:pretzel\) para .+: invalidItem/.test(line)), sut.state.logs.join("|"));
    assert.equal(sut.has(FLOUR_GUID), flourBefore, "what the work took came back");
    sut.state.addRefuses = false;
    assert.equal(sut.has(PRETZEL), 0);
});

test("work that is stopped takes nothing", () => {
    const sut = load();
    const hans = sut.player({ survival: 5 });
    sut.give(FLOUR_GUID, 1);
    sut.give(SALT, 1);
    sut.give(WATER, 1);
    sut.api.make(hans, "fogo:pretzel", near, sut.report);
    assert.equal(sut.api.cancelWork(hans), true);
    assert.equal(sut.api.cancelWork(hans), false);
    sut.state.timers[0].fn();
    assert.equal(sut.has(FLOUR_GUID), 1);
    assert.equal(sut.has(PRETZEL), 0);
    assert.deepEqual(sut.reports, []);
});

test("the forge is worked within reach of a smithery", () => {
    const sut = load();
    assert.equal(sut.api.forgeNear({ x: 52, y: 50, z: 10 }), true);
    assert.equal(sut.api.forgeNear({ x: 60, y: 50, z: 10 }), false);
    assert.equal(sut.api.forgeNear({ x: 52, y: 50, z: 30 }), false, "a floor above");
});

test("alchemy: the chosen potion is taught to the recipe book with every step, and the table may be used for three minutes", () => {
    const sut = load();
    const hans = sut.player({ alchemy: 0 });
    const now = 1_000_000;
    const outcome = plain(sut.api.chooseAlchemy(hans, "alquimia:16", now));
    assert.equal(outcome.ok, true);
    assert.match(outcome.message, /está no seu livro/);
    assert.deepEqual(sut.state.knowledge, [[16, 536870911]]);
    assert.equal(sut.api.alchemyGranted(hans, now + 60_000), true);
    assert.equal(sut.api.alchemyGranted(hans, now + 181_000), false);

    assert.match(sut.api.chooseAlchemy(hans, "alquimia:49", now).message, /nível 1 de alquimia/);
    assert.match(sut.api.chooseAlchemy(hans, "fogo:pretzel", now).message, /desconhecida/);
    const cook = load({ guilds: ["fogo"] });
    assert.match(cook.api.chooseAlchemy(cook.player(), "alquimia:16", now).message, /não é do seu ofício/);
    assert.equal(sut.api.make.length >= 3, true);
    sut.api.make(hans, "alquimia:16", near, sut.report);
    assert.match(sut.reports.at(-1).message, /desconhecida/, "a potion is not made by the page");
});

test("a level reached unlocks the recipes of that level in the player's trades, by the skill they ask", () => {
    const sut = load({ guilds: ["fogo"] });
    const hans = sut.player();
    const at4 = Array.from(sut.api.unlockedAt(hans, "survival", 4), (recipe) => recipe.id);
    assert.ok(at4.includes("fogo:bread"));
    assert.ok(!at4.includes("fogo:mead"), "mead is drinking's");
    assert.ok(Array.from(sut.api.unlockedAt(hans, "drinking", 4), (recipe) => recipe.id).includes("fogo:mead"));
    assert.deepEqual(Array.from(sut.api.unlockedAt(hans, "craftsmanship", 2)), [], "not a smith");
});

test("the village forge of Raborsch counts as a smithery, and only near it", () => {
    const sut = load();
    assert.equal(sut.api.forgeNear({ x: 1570.5, y: 3815.0, z: 114.4 }), true);
    assert.equal(sut.api.forgeNear({ x: 1580.2, y: 3822.1, z: 114.3 }), false, "the alchemy table across the path is no forge");
    assert.equal(sut.api.forgeNear({ x: 1569.8, y: 3816.2, z: 125 }), false, "nor somewhere far above it");
});

test("at the village alchemy table a potion is brewed on the page: twenty seconds, its ingredients taken, the potion and its XP given", () => {
    const sut = load({ guilds: ["alchemy"] });
    const recipe = sut.api.recipeById("alquimia:16");
    const hans = { ...sut.player({ alchemy: 0 }), position: { x: 1580.5, y: 3821.0, z: 114.3 } };
    for (const [item, amount] of recipe.ingredients) sut.give(item, amount);
    sut.api.brew(hans, "alquimia:16", sut.api.atOwnAlchemyTable, sut.report);
    assert.deepEqual(sut.state.emitted.at(-1).payload, { id: "alquimia:16", ms: 20_000, doing: "Preparando" });
    assert.equal(sut.state.timers.at(-1).ms, 20_000);
    sut.state.timers.at(-1).fn();
    assert.equal(sut.reports.at(-1).ok, true, JSON.stringify(sut.reports));
    assert.equal(sut.has(recipe.output.toLowerCase()), 1);
    for (const [item] of recipe.ingredients) assert.equal(sut.has(item), 0);
    assert.deepEqual(sut.state.xp.at(-1), ["alchemy", recipe.xp]);
    assert.deepEqual(sut.state.knowledge, [], "nothing is taught for the game's table");
});

test("the game's own alchemy tables are ours too (2026-10-24): the level's station is a table, the page says Fazer and twenty seconds there, and the potion is brewed on the page", () => {
    const sut = load({ guilds: ["alchemy"], alchemyStations: [{ id: "a1", kind: "alchemy", position: { x: 300, y: 400, z: 20 } }] });
    const recipe = sut.api.recipeById("alquimia:16");
    const hans = { ...sut.player({ alchemy: 0 }), position: { x: 301, y: 400, z: 20.5 } };
    assert.equal(sut.api.atOwnAlchemyTable(hans), true);
    assert.equal(sut.api.alchemyTableNear({ x: 301, y: 400, z: 40 }), false, "not from the floor above");
    assert.equal(sut.api.alchemyTableNear({ x: 50, y: 50, z: 10 }), false, "a smithery is no alchemy table");

    const at = plain(sut.api.viewFor(hans, "alquimia")).recipes.find((r) => r.id === "alquimia:16");
    assert.equal(at.v, "Fazer");
    assert.equal(at.s, 20, "the seconds it takes there, not the game's minigame's");
    const away = plain(sut.api.viewFor({ ...hans, position: { x: 0, y: 0, z: 0 } }, "alquimia")).recipes.find((r) => r.id === "alquimia:16");
    assert.equal(away.v, undefined, "away from a table the page only chooses, as before");

    for (const [item, amount] of recipe.ingredients) sut.give(item, amount);
    sut.api.brew(hans, "alquimia:16", sut.api.atOwnAlchemyTable, sut.report);
    assert.deepEqual(sut.state.emitted.at(-1).payload, { id: "alquimia:16", ms: 20_000, doing: "Preparando" });
    sut.state.timers.at(-1).fn();
    assert.equal(sut.reports.at(-1).ok, true, JSON.stringify(sut.reports));
    assert.equal(sut.has(recipe.output.toLowerCase()), 1);
    assert.deepEqual(sut.state.played, ["alquimia"], "with the table's own animation");
});

test("away from the village table nothing is brewed, and walking off before it is done makes nothing and takes nothing", () => {
    const sut = load({ guilds: ["alchemy"] });
    const recipe = sut.api.recipeById("alquimia:16");
    const hans = { ...sut.player({ alchemy: 0 }), position: { x: 0, y: 0, z: 0 } };
    for (const [item, amount] of recipe.ingredients) sut.give(item, amount);
    sut.api.brew(hans, "alquimia:16", sut.api.atOwnAlchemyTable, sut.report);
    assert.match(sut.reports.at(-1).message, /Fique junto da mesa de alquimia/);
    assert.equal(sut.state.timers.length, 0);
    hans.position = { x: 1580.5, y: 3821.0, z: 114.3 };
    sut.api.brew(hans, "alquimia:16", sut.api.atOwnAlchemyTable, sut.report);
    hans.position = { x: 1600, y: 3821, z: 114.3 };
    sut.state.timers.at(-1).fn();
    assert.equal(sut.reports.at(-1).ok, false);
    assert.match(sut.reports.at(-1).message, /Nada foi feito/);
    for (const [item, amount] of recipe.ingredients) assert.equal(sut.has(item), amount, "nothing taken");
    sut.api.brew(hans, "fogo:pretzel", () => true, sut.report);
    assert.match(sut.reports.at(-1).message, /Receita desconhecida/, "only the game's potions are brewed there");
});

test("the forge makes bows and arrows (user, 2026-10-19): five arrows a batch from a shaft, a feather and a head; the bows are the village's and the hunters', never a quest's", () => {
    const sut = load();
    const box = { exports: {} };
    vm.runInNewContext(dist("craft-data.js"), box);
    const data = box.exports;
    const bows = data.CRAFT_RECIPES.filter((r) => r.station === "forja" && r.category === "Arcos");
    const arrows = data.CRAFT_RECIPES.filter((r) => r.station === "forja" && r.category === "Flechas");
    assert.equal(bows.length, 15);
    assert.equal(arrows.length, 10);
    assert.ok(bows.every((r) => r.amount === 1 && r.ingredients.some(([item]) => item === "kcdc-craft:madeira") && r.ingredients.some(([item]) => item === "kcdc-craft:linha")), "wood and a string");
    assert.ok(arrows.every((r) => r.amount === 5 && r.ingredients[0][0] === "kcdc-craft:madeira"), "five to the batch, from a shaft");
    assert.ok(!bows.some((r) => /prepadeni|poi_|reward|sedmStatecnych/i.test(r.id)), "no quest bows");
    assert.ok(!bows.some((r) => /_empty$/.test(r.id)), "the bow without its arrow is no recipe");
    assert.deepEqual(plain(data.CUSTOM_ITEMS["kcdc-craft:madeira"]).slice(0, 1), ["Madeira de arco"]);

    const normal = arrows.find((r) => r.id === "forja:arrow_normal");
    const hans = sut.player({ craftsmanship: normal.level });
    sut.give("guid-kcdc-craft:madeira", 1);
    sut.give(normal.ingredients[1][0], 1);
    sut.give(normal.ingredients[2][0], 1);
    sut.api.make(hans, normal.id, near, sut.report);
    sut.state.timers[0].fn();
    assert.equal(sut.has(normal.output), 5, "five arrows");
    assert.equal(sut.has("guid-kcdc-craft:madeira"), 0, "the shaft is gone");
    assert.deepEqual(sut.state.xp, [["craftsmanship", normal.xp]]);
});

test("spoiled food is no ingredient: it is not counted, not taken, and the refusal says so; fresh rows of the same food still serve", () => {
    const decay = { exports: {} };
    vm.runInNewContext(dist("food-decay-data.js"), decay);
    const data = { exports: {} };
    vm.runInNewContext(dist("craft-data.js"), data);
    const perishable = (item) => decay.exports.FOOD_DECAY[String(item).toLowerCase()] !== undefined;
    const recipe = data.exports.CRAFT_RECIPES.find((r) => r.station === "fogo" && r.ingredients.length === 1 && perishable(r.ingredients[0][0]));
    assert.ok(recipe, "a fire recipe of one perishable food");
    const [food, need] = recipe.ingredients[0];

    const sut = load();
    const cook = sut.player({ survival: 30, drinking: 30 });
    assert.equal(sut.api.spoiledRow({ item: food, metadata: { condition: 0.1 } }), true);
    assert.equal(sut.api.spoiledRow({ item: food, metadata: { condition: 0.5 } }), false);
    assert.equal(sut.api.spoiledRow({ item: food, condition: 0.19 }), true, "the row's own condition first");
    assert.equal(sut.api.spoiledRow({ item: "not-a-food", metadata: { condition: 0 } }), false, "only food spoils");

    sut.state.rows.push({ id: "bad", item: food, amount: need, metadata: { condition: 0.05 } });
    sut.api.make(cook, recipe.id, near, sut.report);
    assert.match(sut.reports.at(-1).message, /Falta: .*\(tem 0\)\. Comida estragada não serve\./);
    assert.deepEqual(sut.state.timers, [], "nothing started");

    sut.state.rows.push({ id: "good", item: food, amount: need, metadata: { condition: 0.9 } });
    sut.api.make(cook, recipe.id, near, sut.report);
    assert.equal(sut.state.timers.length, 1);
    sut.state.timers[0].fn();
    assert.equal(sut.state.rows.find((row) => row.id === "bad")?.amount, need, "the spoiled row is left as it was");
    assert.equal(sut.state.rows.find((row) => row.id === "good"), undefined, "the fresh one was cooked");
});

const stock = (sut, units) => {
    sut.give(FLOUR_GUID, units);
    sut.give(SALT, units);
    sut.give(WATER, units);
};

test("a number of pieces at once (2026-10-27): the animation is laid over all the time, each piece is made, taken and paid in XP when its own time is up, and the page is told once, at the end", () => {
    const sut = load();
    const hans = sut.player({ survival: 2 });
    stock(sut, 3);
    sut.api.make(hans, "fogo:pretzel", near, sut.report, undefined, 3);
    assert.deepEqual(sut.state.played, ["fogo"], "one animation");
    assert.deepEqual(sut.state.playedMs, [18000], "over three times the recipe's six seconds");
    assert.deepEqual(sut.state.emitted[0].payload, { id: "fogo:pretzel", ms: 6000, doing: "Cozinhando", i: 1, n: 3 }, "the bar is for one piece, and says which");
    assert.equal(sut.state.timers[0].ms, 6000);

    sut.state.timers[0].fn();
    assert.equal(sut.has(PRETZEL), 2);
    assert.deepEqual(sut.state.xp, [["survival", PRETZEL_XP]], "the XP of each piece, as it is made");
    assert.deepEqual(sut.reports, [], "nothing said yet");
    assert.equal(sut.api.isWorking(hans), true);
    assert.equal(sut.state.stopped, 0, "and the animation goes on");
    assert.deepEqual(sut.state.emitted.at(-1).payload, { id: "fogo:pretzel", ms: 6000, doing: "Cozinhando", i: 2, n: 3 });

    sut.state.timers[1].fn();
    sut.state.timers[2].fn();
    assert.equal(sut.has(PRETZEL), 6);
    assert.equal(sut.has(FLOUR_GUID), 0);
    assert.deepEqual(sut.state.xp, [["survival", PRETZEL_XP], ["survival", PRETZEL_XP], ["survival", PRETZEL_XP]]);
    assert.equal(sut.api.isWorking(hans), false);
    assert.equal(sut.state.stopped, 1);
    assert.equal(sut.reports.length, 1, "told once");
    assert.equal(sut.reports[0].ok, true);
    assert.match(sut.reports[0].message, new RegExp(`^Feito: 6x .* \\(\\+${3 * PRETZEL_XP} XP\\)\\.$`));
});

test("a piece of one is as it was: no number on the bar, and the piece's own word at the end", () => {
    const sut = load();
    const hans = sut.player({ survival: 2 });
    stock(sut, 1);
    sut.api.make(hans, "fogo:pretzel", near, sut.report);
    assert.deepEqual(sut.state.emitted[0].payload, { id: "fogo:pretzel", ms: 6000, doing: "Cozinhando" });
    assert.deepEqual(sut.state.playedMs, [6000]);
    sut.state.timers[0].fn();
    assert.match(sut.reports.at(-1).message, new RegExp(`^Feito: 2x .* \\(\\+${PRETZEL_XP} XP\\)\\.$`));
});

test("the whole order is asked for at the start (nothing is half begun), the number is held to ten, and whatever is not a number is one", () => {
    const sut = load();
    const hans = sut.player({ survival: 2 });
    stock(sut, 2);
    sut.api.make(hans, "fogo:pretzel", near, sut.report, undefined, 3);
    assert.match(sut.reports.at(-1).message, /^Falta: 3x Farinha de trigo \(tem 2\), 3x Sal \(tem 2\), 3x Água potável \(tem 2\)\.$/);
    assert.deepEqual(sut.state.timers, [], "none of it started");

    const many = load();
    const cook = many.player({ survival: 2 });
    stock(many, 12);
    many.api.make(cook, "fogo:pretzel", near, many.report, undefined, 99);
    assert.deepEqual(many.state.playedMs, [60000], "ten of them");
    assert.equal(many.state.emitted[0].payload.n, 10);
    for (const odd of [0, -3, Number.NaN, "x", undefined, null]) {
        const one = load();
        const body = one.player({ survival: 2 });
        stock(one, 2);
        one.api.make(body, "fogo:pretzel", near, one.report, undefined, odd);
        assert.equal(one.state.emitted[0].payload.n, undefined, `${String(odd)} is one piece`);
        assert.deepEqual(one.state.playedMs, [6000]);
    }
    assert.equal(many.api.batchOf(4.9), 4);
    assert.equal(many.api.batchOf("7"), 7);
    assert.equal(many.api.MAX_BATCH, 10);
});

test("what runs out in the middle ends the work there: what was made stays made, is paid, and the rest is said", () => {
    const sut = load();
    const hans = sut.player({ survival: 2 });
    stock(sut, 3);
    sut.api.make(hans, "fogo:pretzel", near, sut.report, undefined, 3);
    sut.state.timers[0].fn();
    sut.state.rows = sut.state.rows.filter((row) => row.item !== SALT);
    sut.state.timers[1].fn();
    assert.equal(sut.state.timers.length, 2, "no third piece is begun");
    assert.equal(sut.api.isWorking(hans), false);
    assert.equal(sut.state.stopped, 1);
    assert.equal(sut.reports.length, 1);
    assert.equal(sut.reports[0].ok, false);
    assert.match(sut.reports[0].message, new RegExp(`^Feito 1 de 3: 2x .* \\(\\+${PRETZEL_XP} XP\\)\\. Nada foi feito\\. Falta: 1x Sal \\(tem 0\\)\\.$`));
    assert.equal(sut.has(PRETZEL), 2);
    assert.deepEqual(sut.state.xp, [["survival", PRETZEL_XP]]);

    // A bag with no room for the next piece is the same: the ones before are kept.
    const full = load();
    const cook = full.player({ survival: 2 });
    stock(full, 2);
    full.api.make(cook, "fogo:pretzel", near, full.report, undefined, 2);
    full.state.timers[0].fn();
    full.state.addRefuses = true;
    full.state.timers[1].fn();
    assert.match(full.reports.at(-1).message, /^Feito 1 de 2: 2x .*\. Nada foi feito: não coube no seu inventário\.$/);
});

test("stopping in the middle keeps what was made and says so; the piece in the making takes nothing; closing the page stops a work of several and not of one", () => {
    const sut = load();
    const hans = sut.player({ survival: 2 });
    stock(sut, 3);
    sut.api.make(hans, "fogo:pretzel", near, sut.report, undefined, 3);
    sut.state.timers[0].fn();
    assert.equal(sut.api.cancelWork(hans, sut.report), true);
    assert.equal(sut.api.isWorking(hans), false);
    assert.equal(sut.state.stopped, 1);
    assert.deepEqual(sut.reports.at(-1), { ok: false, message: sut.reports.at(-1).message });
    assert.match(sut.reports.at(-1).message, new RegExp(`^Trabalho interrompido: 1 de 3 feitos \\(2x .*, \\+${PRETZEL_XP} XP\\)\\.$`));
    sut.state.timers[1].fn();
    assert.equal(sut.has(PRETZEL), 2, "the piece that was being made is not made");
    assert.equal(sut.has(FLOUR_GUID), 2);

    const early = load();
    const cook = early.player({ survival: 2 });
    stock(early, 2);
    early.api.make(cook, "fogo:pretzel", near, early.report, undefined, 2);
    early.api.cancelWork(cook, early.report);
    assert.equal(early.reports.at(-1).message, "Trabalho interrompido: nada foi gasto.");

    // The page is closed: a work of several is stopped (so that nobody stays held in a long animation), a single piece's is let be.
    const several = load();
    const a = several.player({ survival: 2 });
    stock(several, 2);
    several.api.make(a, "fogo:pretzel", near, several.report, undefined, 2);
    assert.equal(several.api.cancelWork(a, several.report, true), true);
    const single = load();
    const b = single.player({ survival: 2 });
    stock(single, 1);
    single.api.make(b, "fogo:pretzel", near, single.report);
    assert.equal(single.api.cancelWork(b, single.report, true), false);
    assert.equal(single.api.isWorking(b), true, "it goes on");
    assert.equal(single.api.cancelWork(b), true);
});

test("the page marks the rows that may be made a number at a time: every one made on the page, and not the potions the game's own table brews", () => {
    const sut = load();
    const hans = sut.player({ survival: 5, alchemy: 20 });
    const fire = plain(sut.api.viewFor(hans, "fogo"));
    assert.ok(fire.recipes.every((row) => row.batch === true));
    const alchemy = plain(sut.api.viewFor(hans, "alquimia"));
    assert.equal(alchemy.recipes.find((row) => row.id === "alquimia:atadura-comfrey").batch, true, "the bandages are made on the page");
    assert.equal(alchemy.recipes.find((row) => row.id === "alquimia:16").batch, undefined, "a potion of the game's table is chosen, and brewed at its own table");
    const forge = plain(sut.api.viewFor(hans, "forja"));
    assert.ok(forge.recipes.every((row) => row.batch === true));
});

test("the trades' XP is paid at the trades' standard: the fire twice the recipe's, in the page, in the chat and in the game (2026-11-03; four times since 2026-10-27)", () => {
    profession.useStandard();
    try {
        const sut = load();
        const hans = sut.player({ survival: 2 });
        sut.give(FLOUR_GUID, 2);
        sut.give(SALT, 1);
        sut.give(WATER, 1);
        sut.api.make(hans, "fogo:pretzel", near, sut.report);
        sut.state.timers[0].fn();
        assert.deepEqual(sut.state.xp, [["survival", 2 * PRETZEL_XP]], "the recipe's, twice");
        assert.match(sut.reports.at(-1).message, new RegExp(`2x .*\\+${2 * PRETZEL_XP} XP`));
        // What the page says a piece gives is what it gives.
        const view = sut.api.viewFor(hans, "fogo");
        const row = view.recipes.find((recipe) => recipe.id === "fogo:pretzel");
        assert.equal(row.xp, 2 * PRETZEL_XP, "the page says what one piece of work gives: the recipe's, twice");
    } finally {
        profession.useTables();
    }
});

// Thread of the trades' own (2026-10-30, user: "adiciona a receita de linha que o artesão precisa para ele mesmo poder fabricar com linho e água potável; o taverneiro e alquimista podem
// fazer usando a própria água do corpo, quanto mais ele faz mais sede ele fica"): the Artesão pays a flax and a flask of water, the fire's and the rack's workers a flax and the water of
// their own bodies, a little with each piece.
const FLAX = "5c9aa2cf-0117-46cc-a7c7-1eb8bcc59dc6";
const THREAD = "guid-kcdc-craft:linha";

test("the Artesão spins thread at the needle of a flax and a flask of potable water, three spools a piece, and his body pays nothing", () => {
    const sut = load({ guilds: ["costura"] });
    const maria = sut.player({ craftsmanship: 0 });
    const view = plain(sut.api.viewFor(maria, "costura")).recipes.find((r) => r.id === "costura:linha");
    assert.equal(view.cat, "Fios");
    assert.equal(view.n, 3);
    assert.deepEqual(view.ing, [[FLAX, 1, 0], [WATER, 1, 0]]);
    assert.equal(view.th, undefined, "no water of the body on this one");
    assert.equal(view.can, false);

    sut.api.make(maria, "costura:linha", near, sut.report);
    assert.match(sut.reports.at(-1).message, /Falta: 1x Linho \(tem 0\), 1x Água potável \(tem 0\)/);

    sut.give(FLAX, 2);
    sut.give(WATER, 2);
    sut.api.make(maria, "costura:linha", near, sut.report, undefined, 2);
    sut.state.timers[0].fn();
    sut.state.timers[1].fn();
    assert.equal(sut.has(THREAD), 6, "two pieces, three spools each");
    assert.equal(sut.has(FLAX), 0);
    assert.equal(sut.has(WATER), 0);
    assert.deepEqual(sut.body.spent, [], "the flask was the water");
    assert.equal(sut.body.value, 100);
    assert.deepEqual(sut.state.xp, [["craftsmanship", THREAD_XP], ["craftsmanship", THREAD_XP]]);
});

test("the fire's and the rack's workers spin thread of a flax and their own water: each piece takes a little of the body's, the more they make the thirstier they get (2026-10-30)", () => {
    for (const [guild, station, track] of [["fogo", "fogo", "survival"], ["secador", "secador", "alchemy"]]) {
        const sut = load({ guilds: [guild] });
        const hans = sut.player({ [track]: 0 });
        sut.give(FLAX, 5);
        const view = plain(sut.api.viewFor(hans, station)).recipes.find((r) => r.id === `${station}:linha`);
        assert.deepEqual(view.ing, [[FLAX, 1, 5]], "no flask asked for");
        assert.deepEqual(view.th, [8, 10], "eight points of water a piece, and a full body pays the whole batch of ten (80 of its 100)");
        assert.equal(view.can, true);

        sut.api.make(hans, `${station}:linha`, near, sut.report, undefined, 3);
        sut.state.timers[0].fn();
        sut.state.timers[1].fn();
        assert.equal(sut.body.value, 100 - 16, "two pieces made, two payments");
        sut.state.timers[2].fn();
        assert.equal(sut.has(THREAD), 9);
        assert.equal(sut.has(FLAX), 2);
        assert.equal(sut.body.value, 100 - 24, "three pieces, the body is thirstier by each one");
        assert.deepEqual(sut.body.spent, [8, 8, 8]);
        assert.match(sut.reports.at(-1).message, new RegExp(`^Feito: 9x .* \\(\\+${3 * THREAD_XP} XP\\)\\.$`));
        assert.deepEqual(plain(sut.api.viewFor(hans, station)).recipes.find((r) => r.id === `${station}:linha`).th, [8, 8], "and it pays one fewer now");
    }
});

test("a body that is already dry cannot spin more: it is held to the pieces it can pay, never taken under the point where Desidratação begins, and nothing is taken for what is refused", () => {
    const sut = load({ guilds: ["fogo"] });
    const hans = sut.player({ survival: 0 });
    sut.give(FLAX, 10);
    sut.body.value = 30;
    assert.deepEqual(plain(sut.api.viewFor(hans, "fogo")).recipes.find((r) => r.id === "fogo:linha").th, [8, 2]);
    sut.api.make(hans, "fogo:linha", near, sut.report, undefined, 3);
    assert.match(sut.reports.at(-1).message, /só tem água para 2 peças/);
    assert.deepEqual(sut.state.timers, [], "none of it started");
    assert.equal(sut.has(FLAX), 10);

    sut.api.make(hans, "fogo:linha", near, sut.report, undefined, 2);
    sut.state.timers[0].fn();
    sut.state.timers[1].fn();
    assert.equal(sut.body.value, 14, "thirsty, not parched");
    assert.equal(sut.has(THREAD), 6);

    // At 14 the body pays one more piece (14 - 8 = 6 is under the floor): none.
    assert.deepEqual(plain(sut.api.viewFor(hans, "fogo")).recipes.find((r) => r.id === "fogo:linha").th, [8, 0]);
    assert.equal(plain(sut.api.viewFor(hans, "fogo")).recipes.find((r) => r.id === "fogo:linha").can, false, "the button is off, flax or no flax");
    sut.api.make(hans, "fogo:linha", near, sut.report);
    assert.match(sut.reports.at(-1).message, /seco demais.*mate a sede/);
});

test("what the body runs out of in the middle ends the batch there: what was made stays made and is paid, and the rest is said", () => {
    const sut = load({ guilds: ["secador"] });
    const hans = sut.player({ alchemy: 0 });
    sut.give(FLAX, 5);
    sut.body.value = 27;
    sut.api.make(hans, "secador:linha", near, sut.report, undefined, 2);
    sut.state.timers[0].fn();
    assert.equal(sut.body.value, 19);
    sut.body.value = 12;
    sut.state.timers[1].fn();
    assert.equal(sut.has(THREAD), 3, "the first piece stays made");
    assert.equal(sut.reports.at(-1).ok, false);
    assert.match(sut.reports.at(-1).message, /Feito 1 de 2.*seco demais/);
    assert.equal(sut.api.isWorking(hans), false);
});

test("with thirst off the body has water for the whole batch and none is spent", () => {
    const sut = load({ guilds: ["fogo"] });
    const hans = sut.player({ survival: 0 });
    sut.give(FLAX, 10);
    sut.body.enabled = false;
    sut.body.value = 0;
    assert.deepEqual(plain(sut.api.viewFor(hans, "fogo")).recipes.find((r) => r.id === "fogo:linha").th, [8, 10]);
    sut.api.make(hans, "fogo:linha", near, sut.report, undefined, 10);
    for (let index = 0; index < 10; index += 1) sut.state.timers[index].fn();
    assert.equal(sut.has(THREAD), 30);
    assert.deepEqual(sut.body.spent, []);
});

test("thread is the trades' to spin, each at its own place: the Artesão's recipe is no one else's, and a trade that is not theirs is refused (2026-10-30)", () => {
    const smith = load({ guilds: ["smithing"] });
    const hans = smith.player({ craftsmanship: 5, survival: 5, alchemy: 5 });
    smith.give(FLAX, 3);
    smith.give(WATER, 3);
    for (const id of ["costura:linha", "fogo:linha", "secador:linha"]) {
        smith.api.make(hans, id, near, smith.report);
        assert.match(smith.reports.at(-1).message, /não é do seu ofício/, id);
    }
    const cook = load({ guilds: ["fogo"] });
    const anna = cook.player({ survival: 5 });
    cook.give(FLAX, 1);
    cook.api.make(anna, "fogo:linha", far, cook.report);
    assert.match(cook.reports.at(-1).message, /junto do fogo/, "the fire's thread is spun at the fire");
});

// Quality, nobles and towns (2026-10-31).
const LINHO = "5c9aa2cf-0117-46cc-a7c7-1eb8bcc59dc6";
const THREAD_CLASS = "guid-kcdc-craft:linha";
/** Puts in the bag what a recipe takes, `times` over (our own items are known to the game by the class the harness gives them). */
const stockFor = (sut, id, times = 1) => {
    for (const [item, need] of sut.api.recipeById(id).ingredients) sut.give(item.startsWith("kcdc-craft:") ? `guid-${item}` : item, need * times);
};

test("the better the worker's level over the recipe's, the better the tier a piece can come out in: nothing at the recipe's own level, the best at fifteen levels over it", () => {
    const sut = load();
    const { expectedQuality, rollQuality, QUALITY_SPAN } = sut.api;
    assert.equal(QUALITY_SPAN, 15);
    assert.equal(expectedQuality(4, 4, 4), 1, "at the recipe's own level a piece is plain");
    assert.equal(expectedQuality(0, 4, 4), 1, "under it the same (a level can be skipped by an administrator)");
    assert.equal(expectedQuality(9, 4, 4), 2, "five levels over: the second tier");
    assert.equal(expectedQuality(14, 4, 4), 3);
    assert.equal(expectedQuality(19, 4, 4), 4, "fifteen over: the best");
    assert.equal(expectedQuality(30, 4, 4), 4, "and no more");
    assert.equal(expectedQuality(30, 4, 1), 1, "a class with one tier has no more to give");
    // The fraction is the chance of one more.
    assert.ok(Math.abs(expectedQuality(7, 4, 4) - 1.6) < 1e-9);
    assert.equal(rollQuality(7, 4, 4, 0.5), 2, "a roll under the fraction takes the better tier");
    assert.equal(rollQuality(7, 4, 4, 0.7), 1, "over it, the plainer");
    assert.equal(rollQuality(19, 4, 4, 0), 4, "never past the best");
    assert.equal(rollQuality(9, 4, 4, 0), 2, "a whole tier has no fraction to roll");
    assert.deepEqual([1, 2, 3, 4].map((tier) => sut.api.romanOf(tier)), ["I", "II", "III", "IV"]);
});

test("a piece is made in the tier the level allows and the game is asked for it; the message and the batch say it; a class the game will not make so is given plain", () => {
    const sut = load({ guilds: ["costura"] });
    const hans = sut.player({ craftsmanship: 19 });
    sut.give(LINHO, 5);
    sut.give(THREAD_CLASS, 5);
    // Level 4 recipe, level 19 worker: the best tier, whatever the roll.
    sut.api.make(hans, "costura:HoseSeparate01_m21_D", near, sut.report, undefined, 2);
    sut.state.timers[0].fn();
    assert.deepEqual(plain(sut.state.adds.at(-1).metadata), { quality: 4 }, "the quality is asked of the game");
    sut.state.timers[1].fn();
    assert.match(sut.reports.at(-1).message, /^Feito: 2x .* \(\+\d+ XP\)\. Qualidade: 2x IV\.$/);
    assert.ok(sut.state.logs.some((line) => /fez 1x .*, qualidade IV\)/.test(line)));

    // A single piece says it in its own word.
    sut.api.make(hans, "costura:HoseSeparate01_m21_D", near, sut.report);
    sut.state.timers[2].fn();
    assert.match(sut.reports.at(-1).message, /^Feito: 1x .* \(\+\d+ XP\), qualidade IV\.$/);

    // The game turns the tier down: the plain piece, once, and nothing is lost.
    sut.state.refuseQuality = true;
    sut.api.make(hans, "costura:HoseSeparate01_m21_D", near, sut.report);
    sut.state.timers[3].fn();
    assert.equal(sut.reports.at(-1).ok, true);
    assert.equal(sut.state.adds.at(-1).metadata, undefined, "asked again with no tier");
    assert.match(sut.reports.at(-1).message, /^Feito: 1x .* \(\+\d+ XP\)\.$/);
    assert.ok(sut.state.logs.some((line) => /o jogo não aceitou a qualidade 4 .*invalidQuality; saiu a comum/.test(line)));
});

test("at the recipe's own level a piece is plain and asks nothing of the game; a class with one tier never does", () => {
    const sut = load({ guilds: ["costura", "fogo"] });
    const novice = sut.player({ craftsmanship: 4, survival: 2 });
    sut.give(LINHO, 1);
    sut.give(THREAD_CLASS, 1);
    sut.api.make(novice, "costura:HoseSeparate01_m21_D", near, sut.report);
    sut.state.timers[0].fn();
    assert.equal(sut.state.adds.at(-1).metadata, undefined, "no tier asked: the game's own plain piece");
    assert.match(sut.reports.at(-1).message, /^Feito: 1x .* \(\+\d+ XP\)\.$/);

    // A chance of one more, with the roll in its favour: level 7 over a level 4 recipe has 0.6 of a tier extra.
    const lucky = load({ guilds: ["costura"] });
    lucky.api.craftSettings.random = () => 0;
    const one = lucky.player({ craftsmanship: 7 });
    lucky.give(LINHO, 1);
    lucky.give(THREAD_CLASS, 1);
    lucky.api.make(one, "costura:HoseSeparate01_m21_D", near, lucky.report);
    lucky.state.timers[0].fn();
    assert.deepEqual(plain(lucky.state.adds.at(-1).metadata), { quality: 2 });

    // Food has one tier: the work never asks for one.
    sut.give(FLOUR_GUID, 1);
    sut.give(SALT, 1);
    sut.give(WATER, 1);
    sut.api.craftSettings.random = () => 0;
    sut.api.make(sut.player({ survival: 30 }), "fogo:pretzel", near, sut.report);
    sut.state.timers.at(-1).fn();
    assert.equal(sut.state.adds.at(-1).metadata, undefined);
});

test("the page is told the tiers a piece may come out in for this worker, and the best the class is made in", () => {
    const sut = load({ guilds: ["costura"] });
    const view = (level) => plain(sut.api.viewFor(sut.player({ craftsmanship: level }), "costura")).recipes.find((recipe) => recipe.id === "costura:HoseSeparate01_m21_D");
    assert.deepEqual(view(4).q, [1, 1, 4], "plain at the recipe's level");
    assert.deepEqual(view(7).q, [1, 2, 4], "a fraction of a tier over: it may come out in either");
    assert.deepEqual(view(9).q, [2, 2, 4]);
    assert.deepEqual(view(30).q, [4, 4, 4]);
    assert.equal(plain(sut.api.viewFor(sut.player({ craftsmanship: 30 }), "costura")).recipes.find((recipe) => recipe.id === "costura:ring_silver_engraved").q, undefined, "a ring has one tier: nothing to say");
});

test("a noble's piece and a town's piece are refused to whoever is neither, with the reason; the page marks them; an administrator with every tool is never barred (2026-10-31)", () => {
    const sut = load({ guilds: ["costura", "smithing"] });
    // A noble's boots: the game gives them a wealth of 10 or more, and they are among the dearest of their kind (2026-10-31: both; wealth alone made a beggar's tunic a noble's).
    const own = { exports: {} };
    vm.runInNewContext(dist("craft-data.js"), own);
    const NOBLE_BOOTS = own.exports.CRAFT_RECIPES.find((recipe) => recipe.station === "costura" && recipe.category === "Calçados" && recipe.noble === true && recipe.place === undefined).id;
    let noble = false;
    let town = "suchdol";
    sut.api.setCraftGates({
        isNoble: () => noble,
        citizenOf: (player, towns) => towns.includes(town),
        townName: (id) => ({ malesov: "Malešov", kuttenberg: "Kuttenberg", suchdol: "Suchdol" })[id] ?? id,
    });
    const hans = sut.player({ craftsmanship: 30 });
    sut.give(LINHO, 20);
    sut.give(THREAD_CLASS, 20);
    // A noble's boots (a wealth level of 10 or more in the tables).
    sut.api.make(hans, NOBLE_BOOTS, near, sut.report);
    assert.equal(sut.reports.at(-1).message, "Apenas nobres e mestres do ofício fazem esta peça.");
    assert.deepEqual(sut.state.timers, [], "none of it started");
    // A coat of arms of Bergow: Malešov's.
    sut.api.make(hans, "costura:Coat02_mBergov_D", near, sut.report);
    assert.equal(sut.reports.at(-1).message, "Só cidadãos de Malešov fazem esta peça.");
    const view = plain(sut.api.viewFor(hans, "costura")).recipes;
    const boots = view.find((recipe) => recipe.id === NOBLE_BOOTS);
    assert.deepEqual([boots.nb, boots.no, boots.can], [true, "Apenas nobres e mestres do ofício fazem esta peça.", false]);
    const coat = view.find((recipe) => recipe.id === "costura:Coat02_mBergov_D");
    assert.deepEqual([coat.pl, coat.no, coat.can], [["Malešov"], "Só cidadãos de Malešov fazem esta peça.", false]);
    const plainHose = view.find((recipe) => recipe.id === "costura:HoseSeparate01_m21_D");
    assert.deepEqual([plainHose.nb, plainHose.pl, plainHose.no], [undefined, undefined, undefined], "a plain piece carries none of it");

    // The noble who lives in Malešov may make both (when they have what they take).
    noble = true;
    town = "malesov";
    const lord = sut.player({ craftsmanship: 30 });
    stockFor(sut, NOBLE_BOOTS, 2);
    stockFor(sut, "costura:Coat02_mBergov_D");
    sut.api.make(lord, NOBLE_BOOTS, near, sut.report);
    assert.equal(sut.state.timers.length, 1, "the boots are begun");
    const view2 = plain(sut.api.viewFor(lord, "costura")).recipes;
    assert.equal(view2.find((recipe) => recipe.id === "costura:Coat02_mBergov_D").no, undefined);
    assert.equal(view2.find((recipe) => recipe.id === NOBLE_BOOTS).no, undefined);

    // The same checks when the work ends: a noble made a commoner in the meantime makes nothing and loses nothing.
    const bagBefore = sut.state.rows.map((row) => `${row.item}:${row.amount}`).sort();
    noble = false;
    sut.state.timers[0].fn();
    assert.match(sut.reports.at(-1).message, /Nada foi feito\. Apenas nobres e mestres do ofício fazem esta peça\./);
    assert.deepEqual(sut.state.rows.map((row) => `${row.item}:${row.amount}`).sort(), bagBefore, "and what it takes is still in the bag");

    // An administrator who asked for every tool is not held to either.
    const free = load({ guilds: ["costura"], free: true });
    free.api.setCraftGates({ isNoble: () => false, citizenOf: () => false, townName: (id) => id });
    const admin = free.player({ craftsmanship: 0 });
    stockFor(free, NOBLE_BOOTS);
    free.api.make(admin, NOBLE_BOOTS, near, free.report);
    assert.equal(free.state.timers.length, 1);
});

test("a garment is one recipe with its dyes: the page is told each dye's word and icon and whether a noble's; the dye picked is the one given, and a noble's dye is refused to a commoner (2026-10-31)", () => {
    const sut = load({ guilds: ["costura"] });
    let noble = false;
    sut.api.setCraftGates({ isNoble: () => noble, citizenOf: () => true, townName: (id) => id });
    const data = { exports: {} };
    vm.runInNewContext(dist("craft-data.js"), data);
    // A garment anybody makes, some of whose dyes are a noble's.
    const mixed = data.exports.CRAFT_RECIPES.find((recipe) => recipe.station === "costura" && recipe.noble !== true && recipe.place === undefined && recipe.variants !== undefined && recipe.variants.some((v) => v[3] === 1) && recipe.variants.some((v) => v[3] === 0));
    assert.ok(mixed !== undefined, "such a garment exists");
    assert.equal(mixed.variants[0][3], 0, "the first dye is the least rich: the page opens on one anybody makes");
    assert.equal(mixed.variants[0][0], mixed.output);
    const rich = mixed.variants.findIndex((v) => v[3] === 1);
    const free = mixed.variants.findIndex((v, at) => at > 0 && v[3] === 0);
    assert.ok(rich > 0 && free > 0);

    const hans = sut.player({ craftsmanship: 30 });
    const row = (view) => plain(view).recipes.find((recipe) => recipe.id === mixed.id);
    const told = row(sut.api.viewFor(hans, "costura"));
    assert.equal(told.vs.length, mixed.variants.length);
    assert.deepEqual(told.vs[0], [mixed.variants[0][1], mixed.variants[0][2], 0], "[colour, icon, 0 for anybody's]");
    assert.equal(told.vs[rich][2], 2, "a noble's dye this worker may not make");
    assert.equal(told.variants, undefined, "the classes stay on the server: the page sends back the number");
    noble = true;
    assert.equal(row(sut.api.viewFor(hans, "costura")).vs[rich][2], 1, "a noble's dye the worker may make");
    noble = false;

    // The dye picked is the one given.
    stockFor(sut, mixed.id, 3);
    sut.api.make(hans, mixed.id, near, sut.report, undefined, 1, free);
    sut.state.timers.at(-1).fn();
    assert.equal(sut.reports.at(-1).ok, true, sut.reports.at(-1).message);
    assert.equal(sut.state.adds.at(-1).item, mixed.variants[free][0], "the class of the dye picked");
    assert.match(sut.reports.at(-1).message, new RegExp(`\\(${mixed.variants[free][1]}\\)`), "and the message names the colour");
    // The first dye when none is picked, and when the number is not one the garment has.
    sut.api.make(hans, mixed.id, near, sut.report);
    sut.state.timers.at(-1).fn();
    assert.equal(sut.state.adds.at(-1).item, mixed.output);
    sut.api.make(hans, mixed.id, near, sut.report, undefined, 1, 999);
    sut.state.timers.at(-1).fn();
    assert.equal(sut.state.adds.at(-1).item, mixed.output, "an unknown number is the first dye");

    // A noble's dye is refused to a commoner, with the reason, and nothing starts; a noble makes it.
    const timers = sut.state.timers.length;
    sut.api.make(hans, mixed.id, near, sut.report, undefined, 1, rich);
    assert.equal(sut.reports.at(-1).message, "Apenas nobres e mestres do ofício fazem esta peça.");
    assert.equal(sut.state.timers.length, timers, "none of it started");
    noble = true;
    stockFor(sut, mixed.id, 1);
    sut.api.make(hans, mixed.id, near, sut.report, undefined, 1, rich);
    sut.state.timers.at(-1).fn();
    assert.equal(sut.reports.at(-1).ok, true, sut.reports.at(-1).message);
    assert.equal(sut.state.adds.at(-1).item, mixed.variants[rich][0]);

    // What a page may send as the dye.
    assert.deepEqual([undefined, null, "x", -1, 1.5, 0, 2, "3"].map((value) => sut.api.variantOf(value)), [0, 0, 0, 0, 0, 0, 2, 3]);
});

test("the garments in dyes are a recipe each, the dyes of a town's set are that town's alone, and no dye is listed twice (2026-10-31)", () => {
    const data = { exports: {} };
    vm.runInNewContext(dist("craft-data.js"), data);
    const sewing = data.exports.CRAFT_RECIPES.filter((recipe) => recipe.station === "costura");
    const dyed = sewing.filter((recipe) => recipe.variants !== undefined);
    assert.ok(dyed.length >= 100 && dyed.every((recipe) => recipe.variants.length >= 2), `${dyed.length} garments with a picker`);
    const classes = new Set();
    for (const recipe of dyed) {
        assert.equal(recipe.variants[0][0], recipe.output, `${recipe.id}: the first dye is the recipe's own`);
        assert.ok(recipe.variants.every(([output, label, icon, rich]) => /^[0-9a-f-]{36}$/.test(output) && label !== "" && icon !== "" && (rich === 0 || rich === 1)), recipe.id);
        for (const [output] of recipe.variants) {
            assert.ok(!classes.has(output), `${recipe.id}: ${output} is in another picker too`);
            classes.add(output);
        }
        assert.equal(recipe.place, undefined, `${recipe.id}: a town's piece is not in a picker for everybody`);
        // A recipe is a noble's only when every dye is.
        assert.equal(recipe.noble === true && recipe.level < 22, recipe.variants.every((v) => v[3] === 1) && recipe.level < 22, recipe.id);
    }
    assert.ok(!sewing.some((recipe) => recipe.variants === undefined && classes.has(recipe.output)), "a dye of a picker is not a recipe of its own as well");
    // The crossbows and their bolts were the needle's (2026-10-31) and are the smith's since 2026-11-01 ("besta deve ser receita só do ferreiro e não do artesão"; "faltou no
    // ferreiro o craft das setas, os dardos da besta").
    assert.equal(sewing.filter((recipe) => recipe.category === "Bestas" || recipe.category === "Virotes" || /crossbow|^costura:bolt_/i.test(recipe.id)).length, 0, "no crossbow nor bolt at the needle");
    const crossbows = data.exports.CRAFT_RECIPES.filter((recipe) => recipe.category === "Bestas");
    assert.ok(crossbows.length >= 8 && crossbows.every((recipe) => recipe.station === "forja" && /^forja:crossbow/.test(recipe.id)), "the crossbows at the forge");
    const bolts = data.exports.CRAFT_RECIPES.filter((recipe) => recipe.category === "Virotes");
    assert.ok(bolts.length >= 10 && bolts.every((recipe) => recipe.station === "forja" && /^forja:bolt_/.test(recipe.id) && recipe.amount === 5), "the bolts at the forge, five to the batch");
});

test("a piece made in a town's own set stands in its own kind and says whose it is, and the data keeps the rules it was made with (2026-10-31)", () => {
    const sut = load({ guilds: ["costura", "smithing"] });
    const data = { exports: {} };
    vm.runInNewContext(dist("craft-data.js"), data);
    const recipes = data.exports.CRAFT_RECIPES;
    const rules = recipes.filter((recipe) => recipe.station === "forja" || recipe.station === "costura");
    assert.ok(rules.every((recipe) => recipe.maxq === undefined || (recipe.maxq > 1 && recipe.maxq <= 6)), "a tier count only where there is more than one");
    // Every ring, necklace and brooch of the needle is a noble's.
    const jewels = rules.filter((recipe) => recipe.category === "Anéis" || recipe.category === "Colares e broches");
    assert.ok(jewels.length >= 12 && jewels.every((recipe) => recipe.noble === true));
    // A horseshoe is no noble's, whatever wealth the tables give it.
    assert.ok(rules.filter((recipe) => recipe.category === "Ferraduras").every((recipe) => recipe.noble !== true));
    // The plain pieces of a trade stay open: most of what the trades make is nobody's alone.
    assert.ok(rules.filter((recipe) => recipe.noble !== true && recipe.place === undefined).length > rules.length * 0.6);
    const placed = rules.filter((recipe) => recipe.place !== undefined);
    assert.ok(placed.length >= 20, `${placed.length} pieces belong to a town`);
    const names = { kuttenberg: "Kuttenberg", malesov: "Malešov", raborsch: "Raborsch", suchdol: "Suchdol", pschitoky: "Pschitoky" };
    for (const recipe of placed) {
        const towns = recipe.place.split(",");
        assert.ok(towns.every((id) => names[id] !== undefined), `${recipe.id}: ${recipe.place} are the towns of the file`);
        // A town's piece stays in its kind (2026-10-31: no more "<town> · <kind>"): the page says whose it is on the piece.
        assert.ok(!recipe.category.includes(" · "), `${recipe.id}: ${recipe.category}`);
    }
    assert.equal(sut.api.recipeById("forja:shortswordBergov").place, "malesov");
    assert.equal(sut.api.recipeById("costura:Coat02_mBergov_D").place, "malesov");
    assert.equal(sut.api.recipeById("costura:Coat02_mBergov_D").category, "Brasão: Bergow", "a coat of arms keeps its house for a category");
});

test("a recipe far under the worker's level gives less XP: the whole of it up to three levels under, 12% less for each level more, never under a tenth (2026-11-01)", () => {
    const sut = load();
    const { weakShare, xpFor, recipeById } = sut.api;
    assert.equal(weakShare(0, 0), 1);
    assert.equal(weakShare(4, 1), 1, "three levels over the recipe: all of it");
    assert.equal(Math.round(weakShare(5, 1) * 100), 88);
    assert.equal(Math.round(weakShare(9, 1) * 100), 40);
    assert.equal(weakShare(30, 0), 0.1, "never under a tenth");
    assert.equal(weakShare(0, 10), 1, "a recipe over the worker is never cut");
    const pretzel = recipeById("fogo:pretzel");
    assert.equal(xpFor(pretzel, 2), PRETZEL_XP);
    assert.equal(xpFor(pretzel, 30), 1, "at least one");

    const master = sut.player({ survival: 9 });
    stock(sut, 1);
    const row = plain(sut.api.viewFor(master, "fogo")).recipes.find((recipe) => recipe.id === "fogo:pretzel");
    const paid = Math.max(1, Math.round(PRETZEL_XP * 0.4));
    assert.equal(row.xp, paid, "the page says what this worker gets");
    sut.api.make(master, "fogo:pretzel", near, sut.report);
    sut.state.timers[0].fn();
    assert.deepEqual(sut.state.xp, [["survival", paid]], "and the game is given that");
    assert.match(sut.reports.at(-1).message, new RegExp(`\\(\\+${paid} XP\\)`));
});

test("a master of a guild or of a trade makes the nobles' pieces of their trade, the nobles' dyes too, without being a noble (2026-11-01)", () => {
    const sut = load({ guilds: ["costura"] });
    const own = { exports: {} };
    vm.runInNewContext(dist("craft-data.js"), own);
    const NOBLE_BOOTS = own.exports.CRAFT_RECIPES.find((recipe) => recipe.station === "costura" && recipe.category === "Calçados" && recipe.noble === true && recipe.place === undefined).id;
    const mixed = own.exports.CRAFT_RECIPES.find((recipe) => recipe.station === "costura" && recipe.noble !== true && recipe.variants !== undefined && recipe.variants.some((v) => v[3] === 1));
    const rich = mixed.variants.findIndex((v) => v[3] === 1);
    let master = false;
    sut.api.setCraftGates({ isNoble: () => false, isMaster: () => master, citizenOf: () => true, townName: (id) => id });
    const hans = sut.player({ craftsmanship: 30 });
    const row = () => plain(sut.api.viewFor(hans, "costura")).recipes.find((recipe) => recipe.id === NOBLE_BOOTS);
    assert.equal(row().no, "Apenas nobres e mestres do ofício fazem esta peça.", "a commoner is barred, and told who may");
    assert.equal(plain(sut.api.viewFor(hans, "costura")).recipes.find((recipe) => recipe.id === mixed.id).vs[rich][2], 2, "a noble's dye he may not make");
    master = true;
    assert.equal(row().no, undefined, "a master is not");
    assert.equal(row().nb, true, "the piece is still marked as the nobles'");
    assert.equal(plain(sut.api.viewFor(hans, "costura")).recipes.find((recipe) => recipe.id === mixed.id).vs[rich][2], 1, "and the nobles' dyes are his to make");
    stockFor(sut, NOBLE_BOOTS, 1);
    sut.api.make(hans, NOBLE_BOOTS, near, sut.report);
    assert.equal(sut.state.timers.length, 1, "the boots are begun");
    sut.state.timers[0].fn();
    assert.equal(sut.reports.at(-1).ok, true, sut.reports.at(-1).message);
    assert.equal(sut.api.mayMakeNoble(hans), true);
    // Without the gate a server gives (the tests, a module that did not start), nobody is a master.
    sut.api.setCraftGates({ isNoble: () => false, citizenOf: () => true, townName: (id) => id });
    assert.equal(sut.api.mayMakeNoble(hans), false);
});

test("every potion, poison and ointment of the alchemists says what it does, in the game's own words, on its recipe (2026-11-02); the Saviour Schnapps says it saves nothing here", () => {
    const sut = load({ guilds: ["alchemy"] });
    const hans = sut.player({ alchemy: 30 });
    const view = plain(sut.api.viewFor(hans, "alquimia"));
    const named = (pattern) => view.recipes.find((recipe) => pattern.test(view.items[recipe.out]?.[0] ?? ""));
    const marigold = named(/^Mistura de Cravo-de-defunto Fraca$/);
    assert.equal(marigold.d, "Cura 15 pontos de Vida por um minuto e cura ressaca 50% mais rápido.");
    assert.match(named(/^Acônito Fraca$/).d, /^Reduz a Vida em -110 em 60 segundos\./, "a poison says what it does too");
    assert.match(named(/^Poção de mandrágora fraca$/).d, /^Acalma os pensamentos assustadores e as vozes ameaçadoras\. Cura 50 pontos de Vida/, "no markup");
    assert.equal(named(/^Schnapps Salvador Fraco$/).d, "Sem efeito no servidor. Não salva o jogo: aqui o servidor guarda tudo sozinho.");
    assert.match(named(/^Schnapps Salvador do Henry$/).d, /^Cura 30 pontos de Vida e ganha \+3 de Força.*Não salva o jogo/);
    const potions = view.recipes.filter((recipe) => /^(Poção|Mistura|Bebida|Artemísia|Linimento|Raposa|Esopo|Galo|Sangue de Gamo|Aqua|Acônito|Cantiga|Infusão)/.test(view.items[recipe.out]?.[0] ?? ""));
    assert.ok(potions.length >= 60, String(potions.length));
    for (const recipe of potions) {
        assert.ok(typeof recipe.d === "string" && recipe.d.length > 10 && !/[<>]|&lt;/.test(recipe.d), `${view.items[recipe.out][0]}: ${recipe.d}`);
    }
    // Elsewhere only what the alchemists make too says it (the tavern's aguardente): a roast says nothing.
    const fire = plain(sut.api.viewFor(hans, "fogo"));
    assert.ok(fire.recipes.filter((recipe) => recipe.d !== undefined).every((recipe) => /Aguardente/.test(fire.items[recipe.out]?.[0] ?? "")), JSON.stringify(fire.recipes.filter((recipe) => recipe.d !== undefined).map((recipe) => fire.items[recipe.out]?.[0])));
});
