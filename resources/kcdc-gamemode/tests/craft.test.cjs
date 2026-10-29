"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const { profession } = require("./reachpatch.cjs");
// The tables' own pace: these tests are of the work and not of the pace the trades' XP is paid at (src/server/profession-xp.ts, 4 times in play): the tests of the pace set it.
profession.professionXp.rate = 1;

// The guilds' trades (src/server/craft.ts) over the real recipes (craft-data.js) and a fake game: the page's view, the work,
// what it takes and gives, the XP, and alchemy's chosen potion.

const dist = (name) => fs.readFileSync(path.join(__dirname, "../dist/server", name), "utf8");
const plain = (value) => JSON.parse(JSON.stringify(value));

const SALT = "b9ed56a7-7965-48e3-ab35-78aec6733f3d";
const WATER = "0cb47176-06c5-42a9-8d70-969e917eb999";
const PRETZEL = "c352d8ae-4021-4f9b-b49c-b1f087f2cd2c";
const FLOUR_GUID = "aaaa0000-0000-0000-0000-00000000f10e";

function load({ guilds = ["fogo", "alchemy", "smithing"], free = false, alchemyStations = [] } = {}) {
    const state = { rows: [], revision: 1, nextRow: 1, timers: [], xp: [], emitted: [], knowledge: [], played: [], playedMs: [], stopped: 0, addRefuses: false, logs: [] };
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
                state.rows.push({ id: `r${state.nextRow++}`, item: request.item, amount: request.amount });
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
    return { api: context.exports, state, player, give, has, reports, report };
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
    assert.deepEqual(sut.state.xp, [["survival", 8]]);
    assert.equal(sut.reports.at(-1).ok, true);
    assert.match(sut.reports.at(-1).message, /2x .*\+8 XP/);
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
    assert.deepEqual(sut.state.xp, [["survival", 8]], "the XP of each piece, as it is made");
    assert.deepEqual(sut.reports, [], "nothing said yet");
    assert.equal(sut.api.isWorking(hans), true);
    assert.equal(sut.state.stopped, 0, "and the animation goes on");
    assert.deepEqual(sut.state.emitted.at(-1).payload, { id: "fogo:pretzel", ms: 6000, doing: "Cozinhando", i: 2, n: 3 });

    sut.state.timers[1].fn();
    sut.state.timers[2].fn();
    assert.equal(sut.has(PRETZEL), 6);
    assert.equal(sut.has(FLOUR_GUID), 0);
    assert.deepEqual(sut.state.xp, [["survival", 8], ["survival", 8], ["survival", 8]]);
    assert.equal(sut.api.isWorking(hans), false);
    assert.equal(sut.state.stopped, 1);
    assert.equal(sut.reports.length, 1, "told once");
    assert.equal(sut.reports[0].ok, true);
    assert.match(sut.reports[0].message, /^Feito: 6x .* \(\+24 XP\)\.$/);
});

test("a piece of one is as it was: no number on the bar, and the piece's own word at the end", () => {
    const sut = load();
    const hans = sut.player({ survival: 2 });
    stock(sut, 1);
    sut.api.make(hans, "fogo:pretzel", near, sut.report);
    assert.deepEqual(sut.state.emitted[0].payload, { id: "fogo:pretzel", ms: 6000, doing: "Cozinhando" });
    assert.deepEqual(sut.state.playedMs, [6000]);
    sut.state.timers[0].fn();
    assert.match(sut.reports.at(-1).message, /^Feito: 2x .* \(\+8 XP\)\.$/);
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
    assert.match(sut.reports[0].message, /^Feito 1 de 3: 2x .* \(\+8 XP\)\. Nada foi feito\. Falta: 1x Sal \(tem 0\)\.$/);
    assert.equal(sut.has(PRETZEL), 2);
    assert.deepEqual(sut.state.xp, [["survival", 8]]);

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
    assert.match(sut.reports.at(-1).message, /^Trabalho interrompido: 1 de 3 feitos \(2x .*, \+8 XP\)\.$/);
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

test("the trades' XP is paid at the pace the administrators chose: four times the recipe's, in the page, in the chat and in the game (2026-10-27)", () => {
    profession.professionXp.rate = 4;
    try {
        const sut = load();
        const hans = sut.player({ survival: 2 });
        sut.give(FLOUR_GUID, 2);
        sut.give(SALT, 1);
        sut.give(WATER, 1);
        sut.api.make(hans, "fogo:pretzel", near, sut.report);
        sut.state.timers[0].fn();
        assert.deepEqual(sut.state.xp, [["survival", 32]], "8 of the table, four times");
        assert.match(sut.reports.at(-1).message, /2x .*\+32 XP/);
        // What the page says a piece gives is what it gives.
        const view = sut.api.viewFor(hans, "fogo");
        const row = view.recipes.find((recipe) => recipe.id === "fogo:pretzel");
        assert.equal(row.xp, 32, "the page says what one piece of work gives: the recipe's 8, four times");
    } finally {
        profession.professionXp.rate = 1;
    }
});
