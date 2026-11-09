"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const { profession } = require("./reachpatch.cjs");
// The tables' own XP and no day's limit: these tests are of the work and not of the pace the trades' XP is paid at (src/server/profession-xp.ts, the standard of 2026-11-03): the tests of the pace set it.
profession.useTables();

// The Coletores' work (src/server/gather.ts, 2026-10-21): E at a tree with an axe in the bag, or at a rock with the pick, starts the game's own
// work; every so many seconds a log, or a strike of the pick rolled; the tool wears a little; E again, moving off or being hurt stops it.

const AXE = "1fc42528-2bef-4dde-bf8a-04febeef41c8"; // axeWork01
const BARBED = "53612e76-76fd-4dca-84b6-7905b986dc3b"; // axeBattle01
const PICK = "0f0164d5-3746-4d07-a1ed-0f138225a6d9"; // axeBattle03
const OAK = "objects/natural/vegetation/trees/normal_trees/quercus_robur/quercus_a.cgf";
const PINE = "objects/natural/vegetation/trees/normal_trees/pinus_sylvestris/pinus_sylvestris_a.cgf";
const BOULDER = "objects/natural/rocks/rocks_big/rocks_big_a.cgf";
const CLIFF_KH = "objects/natural/rocks/kutnohorsko_rocks/rock_cliff_kh_a.cgf";

function load({ allowed = true, busy = false } = {}) {
    const handlers = new Map();
    const added = [];
    const properties = [];
    const logs = [];
    const played = [];
    const worked = [];
    const stopped = [];
    const timers = [];
    const clock = { now: 1_000_000 };
    const state = { allowed, busy, addFails: false, removeFails: false };
    const bags = new Map();
    const removed = [];
    const context = {
        exports: {},
        console: { log: (line) => logs.push(line) },
        setInterval: () => 1,
        Math: Object.assign(Object.create(Math), { random: () => 0.5 }),
        setTimeout: (fn, ms) => { timers.push({ fn, ms, cleared: false }); return timers.length; },
        clearTimeout: (id) => { if (timers[id - 1]) timers[id - 1].cleared = true; },
        Date: { now: () => clock.now },
        require: (id) => ({
            "./craft.js": { isWorking: () => state.busy },
            "./craft-animation.js": { playWork: (player, trade) => { played.push([player.nickname, trade]); return true; }, stopWork: (player) => stopped.push(player.nickname) },
            "./craft-items.js": { craftItemGuid: (item) => (item.startsWith("kcdc-craft:") ? `guid:${item}` : null) },
            "./guild-crafts.js": { mayCraft: (player, craft) => state.allowed && ["lenha", "mineracao"].includes(craft) },
            "./language.js": { languageOf: () => "pt", translate: (text) => text },
            "./work-sound.js": { workBegins: (player, kind) => worked.push([player.nickname, kind]), workEnds: (player) => worked.push([player.nickname, "end"]) },
        })[id] ?? assert.fail(`unexpected require ${id}`),
        Events: { on: (name, fn) => handlers.set(name, fn), onClient: (name, fn) => handlers.set(name, fn) },
        Inventory: {
            get: (player) => ({ revision: 1, items: bags.get(player.id) ?? [] }),
            add: (player, request) => {
                added.push([player.nickname, request.item, request.amount]);
                if (state.addFails && request.metadata) return { ok: false, code: "inventoryCapacity", items: [] };
                const rows = bags.get(player.id) ?? [];
                let id;
                if (request.metadata) {
                    // A tool with properties of its own: a row of its own, as the game keeps it.
                    id = `n${rows.length + 1}`;
                    rows.push({ id, item: request.item, name: "tool", amount: request.amount, equipped: 0, condition: request.metadata.condition ?? 1, health: 1, quality: 1, metadata: JSON.parse(JSON.stringify(request.metadata)) });
                }
                return { ok: true, code: "", items: id === undefined ? [] : [{ id }] };
            },
            remove: (player, request) => {
                removed.push([player.nickname, JSON.parse(JSON.stringify(request.units))]);
                if (state.removeFails) { state.removeFails = false; return { ok: false, code: "unknownItem" }; } // the first removal only: the rollback is another
                const rows = bags.get(player.id) ?? [];
                for (const unit of request.units) {
                    const row = rows.find((one) => one.id === unit.id);
                    if (!row || row.amount < unit.amount) return { ok: false, code: "insufficientItems" };
                    row.amount -= unit.amount;
                    if (row.amount === 0) rows.splice(rows.indexOf(row), 1);
                }
                return { ok: true, code: "" };
            },
            setProperties: (player, request) => {
                properties.push([player.nickname, JSON.parse(JSON.stringify(request))]);
                const row = (bags.get(player.id) ?? []).find((one) => one.id === request.id);
                if (row) { row.metadata = request.metadata; row.condition = request.metadata.condition; }
                return { ok: true, code: "" };
            },
        },
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/gather.js"), "utf8"), context);
    context.exports.installGather();
    let nextId = 1;
    const player = (nickname = "Jan", tools = [AXE], level = 0) => {
        const xp = [];
        const told = [];
        const states = [];
        const body = {
            id: nextId++,
            nickname,
            steamId: nickname,
            ready: true,
            alive: true,
            mounted: false,
            position: { x: 0, y: 0, z: 100 },
            getTrack: () => ({ level }),
            addXp: (track, amount) => xp.push([track, amount]),
            emit: (event, payload) => (event.endsWith("gather.state") ? states.push(JSON.parse(payload)) : told.push(JSON.parse(payload).text)),
            xp,
            told,
            states,
        };
        // A tool is its class, or { item, amount } for a stack of them (tools of one class and one condition are one row of the bag).
        bags.set(body.id, tools.map((tool, index) => ({ id: `t${index}`, item: typeof tool === "string" ? tool : tool.item, name: "tool", amount: typeof tool === "string" ? 1 : tool.amount, equipped: 0, condition: 1, health: 1, quality: 1, metadata: { quality: 1 } })));
        return body;
    };
    /** Runs the work's pending timer, as the clock reaching it would. */
    const tick = () => {
        const timer = timers.filter((one) => !one.cleared && !one.ran).at(-1);
        assert.ok(timer, "a timer to run");
        timer.ran = true;
        clock.now += timer.ms;
        timer.fn();
        return timer.ms;
    };
    return { api: context.exports, handlers, added, removed, properties, logs, played, worked, stopped, timers, clock, state, bags, player, tick };
}

const aim = (m, x = 1, y = 0.5, z = 101, k = m.includes("/rocks/") || m.includes("/stones/") ? "rock" : "tree") => ({ k, m, x, y, z });

test("E at a tree with an axe in the bag starts the woodcutter's work: every ten seconds a log, survival XP, the axe a little worn; an oak gives four and rests", () => {
    const sut = load();
    const jan = sut.player();
    const started = sut.api.startGather(jan, aim(OAK), sut.clock.now);
    assert.deepEqual({ ...started }, { started: true, ms: 10_000 });
    assert.deepEqual(sut.played, [["Jan", "lenha"]], "the woodcutter's animation, with the lumberjack's axe in hand");
    assert.deepEqual(jan.states, [{ on: true, k: "tree" }]);
    assert.equal(sut.tick(), 10_000);
    assert.deepEqual(sut.added, [["Jan", "guid:kcdc-craft:lenha", 1]]);
    assert.deepEqual(jan.xp, [["survival", 4]]);
    const [, wear] = sut.properties[0];
    assert.equal(wear.id, "t0");
    assert.ok(Math.abs(wear.metadata.condition - 0.991) < 1e-9, "0.9% of the axe");
    assert.equal(wear.metadata.health, undefined, "the condition, not the health");
    sut.tick();
    sut.tick();
    sut.tick();
    assert.equal(sut.added.length, 4);
    assert.deepEqual(jan.states.at(-1), { on: false }, "spent: the work stops by itself");
    assert.deepEqual(sut.stopped, ["Jan"]);
    assert.match(jan.told.at(-1), /Esta árvore já deu a lenha que tinha/);
    assert.ok(sut.logs.some((line) => /coleta: Jan cortou lenha \(quercus_a\.cgf, resta 0\)/.test(line)));
    assert.equal(sut.api.startGather(jan, aim(OAK, 1.5, 0.2), sut.clock.now).why, "descansando", "the same tree, a step round the trunk");
    assert.equal(sut.api.startGather(jan, aim(OAK, 2.8, -0.6), sut.clock.now).started, true, "an oak a few metres off is another");
    sut.api.stopGather(jan);
    assert.equal(sut.api.startGather(jan, aim(OAK), sut.clock.now + 61 * 60_000).started, true, "and the first gives again after an hour");
});

test("a second E stops the work; so do moving off, being hurt and the game cutting it short", () => {
    const sut = load();
    const jan = sut.player();
    sut.api.startGather(jan, aim(PINE), sut.clock.now);
    assert.deepEqual({ ...sut.api.startGather(jan, aim(PINE), sut.clock.now) }, { started: false, why: "parou" });
    assert.equal(sut.api.isGathering(jan), false);
    assert.equal(sut.timers.at(-1).cleared, true, "the next log will not come");

    sut.api.startGather(jan, aim(PINE), sut.clock.now);
    jan.position = { x: 2, y: 0, z: 100 };
    sut.tick();
    assert.equal(sut.added.length, 0);
    assert.match(jan.told.at(-1), /Você saiu do lugar e parou de trabalhar/);
    jan.position = { x: 0, y: 0, z: 100 };

    sut.api.startGather(jan, aim(PINE), sut.clock.now);
    sut.handlers.get("playerDamage")(jan, null, 5, null, "fall");
    assert.equal(sut.api.isGathering(jan), false);
    assert.match(jan.told.at(-1), /Você foi interrompido/);

    sut.api.startGather(jan, aim(PINE), sut.clock.now);
    sut.handlers.get("playerAnimationEnd")(jan, "LumberJackCuttingTree", "stopped");
    assert.equal(sut.api.isGathering(jan), true, "our own stop is not an interruption");
    sut.handlers.get("playerAnimationEnd")(jan, "LumberJackCuttingTree", "interrupted");
    assert.equal(sut.api.isGathering(jan), false);

    sut.api.startGather(jan, aim(PINE), sut.clock.now);
    sut.handlers.get("kcdc-gamemode:gather.stop")(jan);
    assert.equal(sut.api.isGathering(jan), false, "the client's stop");
});

test("without an axe in the bag, with a worn one, of another guild, busy at a trade, at a dead tree or too far: told why, and nothing starts", () => {
    const sut = load();
    const empty = sut.player("Ota", []);
    assert.equal(sut.api.startGather(empty, aim(OAK), sut.clock.now).why, "sem ferramenta");
    assert.match(empty.told.at(-1), /Você precisa de um machado na bolsa para cortar lenha/);
    const miner = sut.player("Kuba", [PICK]);
    assert.equal(sut.api.startGather(miner, aim(OAK), sut.clock.now).why, "sem ferramenta", "a pick does not cut wood");
    // An axe left at nothing (tools stopped at 2% until 2026-11-04) breaks at the first try and leaves the bag; one at 1% still works.
    const worn = sut.player("Vit");
    sut.bags.get(worn.id)[0].condition = 0;
    assert.equal(sut.api.startGather(worn, aim(OAK), sut.clock.now).why, "ferramenta quebrou");
    assert.match(worn.told.at(-1), /O seu machado quebrou de tanto uso e sumiu do inventário/);
    assert.deepEqual(sut.bags.get(worn.id), [], "and it is gone (one with a little left still works: the last test)");
    const any = sut.player("Rad", [BARBED]);
    assert.equal(sut.api.startGather(any, aim(PINE), sut.clock.now).started, true, "any axe of the game");
    const jan = sut.player();
    assert.equal(sut.api.startGather(jan, aim(OAK, 9, 0), sut.clock.now).why, "longe demais");
    assert.equal(sut.api.startGather(jan, aim("objects/natural/vegetation/trees/stumps/stump_fagus_a.cgf"), sut.clock.now).why, "não é árvore nem pedra que se trabalhe");
    jan.mounted = true;
    assert.equal(sut.api.startGather(jan, aim(OAK), sut.clock.now).why, "agora não");
    jan.mounted = false;
    sut.state.busy = true;
    assert.equal(sut.api.startGather(jan, aim(OAK), sut.clock.now).why, "ocupado");
    sut.state.busy = false;
    sut.state.allowed = false;
    assert.equal(sut.api.startGather(jan, aim(OAK), sut.clock.now).why, "não é da guilda");
    assert.match(jan.told.at(-1), /ofício dos Coletores \(guilda Collectores\)/);
    sut.api.startGather(jan, aim(OAK), sut.clock.now + 1000);
    assert.equal(jan.told.filter((line) => /Coletores/.test(line)).length, 1, "not at every press");
    assert.deepEqual(sut.played.map(([name]) => name), ["Rad"], "only the one who started played the work");
});

test("the pick at a rock: each strike is rolled, with strength XP; a boulder gives twelve and rests half an hour", () => {
    const sut = load();
    const kuba = sut.player("Kuba", [PICK]);
    const rolls = [0.5, 0.5, 0.5, 0.05];
    let at = 0;
    const random = () => rolls[at++ % rolls.length];
    const started = sut.api.startGather(kuba, aim(BOULDER), sut.clock.now, random);
    assert.deepEqual({ ...started }, { started: true, ms: 8_000 });
    assert.deepEqual(sut.played, [["Kuba", "mina"]], "the stonemason's pick");
    sut.tick();
    assert.deepEqual(sut.added, [["Kuba", "bsmt_ironBad", 1]]);
    assert.deepEqual(kuba.xp, [["strength", 2]]);
    sut.tick();
    assert.equal(sut.added.length, 1, "the second strike brought nothing");
    assert.equal(kuba.xp.length, 2, "and still the XP of the work");
    for (let n = 2; n < 12; n += 1) sut.tick();
    assert.equal(sut.api.isGathering(kuba), false);
    assert.match(kuba.told.at(-1), /Esta pedra está esgotada por ora/);
    assert.equal(sut.api.startGather(kuba, aim(BOULDER), sut.clock.now + 31 * 60_000, random).started, true);
});

test("a strike: silver very seldom (more in the rocks of Kuttenberg), now and then scrap, nails or iron, mostly a useless chip", () => {
    const sut = load();
    const roll = (model, silver, other) => sut.api.rollRock(model, silver, other).item;
    assert.equal(roll(BOULDER, 0.005, 0.5), "kcdc-craft:minerio-prata");
    assert.equal(roll(BOULDER, 0.02, 0.2), "kcdc-craft:lasca", "1% in an ordinary rock");
    assert.equal(roll(CLIFF_KH, 0.02, 0.5), "kcdc-craft:minerio-prata", "3% in Kuttenberg's");
    assert.equal(roll(BOULDER, 0.5, 0.05), "", "nothing at all");
    assert.equal(roll(BOULDER, 0.5, 0.2), "kcdc-craft:lasca");
    assert.equal(roll(BOULDER, 0.5, 0.4), "loot_salt", "salt, one strike in twelve (2026-10-22)");
    assert.equal(roll(BOULDER, 0.5, 0.5), "bsmt_ironBad");
    assert.equal(roll(BOULDER, 0.5, 0.6), "bsmt_hardware");
    assert.equal(roll(BOULDER, 0.5, 0.7), "bsmt_ironGood");
    // What the vendors of the smiths, the apothecaries and the artisans sold and nobody dug (2026-10-27, SINERGIA.md).
    assert.equal(roll(BOULDER, 0.5, 0.85), "bsmt_copper");
    assert.equal(roll(BOULDER, 0.5, 0.87), "bsmt_jaspis");
    assert.equal(roll(BOULDER, 0.5, 0.9), "bsmt_emailPowder");
    assert.equal(roll(BOULDER, 0.5, 0.93), "special_sulfur");
    assert.equal(roll(BOULDER, 0.5, 0.97), "special_saltpeter");
    assert.equal(roll(BOULDER, 0.5, 0.995), "special_cobweb");
    assert.equal(sut.api.ROCK_FINDS.reduce((sum, find) => sum + find.weight, 0), 100, "the weights are shares of a hundred");
});

test("the higher the track, the faster the work: survival for the trees, strength for the rocks", () => {
    const sut = load();
    assert.deepEqual([0, 5, 6, 12, 24, 30].map((level) => sut.api.workMsFor("tree", level)), [10_000, 10_000, 9_000, 8_000, 6_000, 5_000]);
    assert.deepEqual([0, 6, 12, 24, 30].map((level) => sut.api.workMsFor("rock", level)), [8_000, 7_000, 6_000, 4_000, 4_000]);
    const old = sut.player("Hana", [AXE], 24);
    assert.equal(sut.api.startGather(old, aim(PINE), sut.clock.now).ms, 6_000);
});

test("what a client sends is read only when it is a tree or a rock with a mesh and a place; the press arrives by its event", () => {
    const sut = load();
    assert.deepEqual({ ...sut.api.readReport(JSON.stringify({ k: "tree", m: "Objects\\Natural\\X.cgf", x: 1, y: 2, z: 3 })) }, { k: "tree", m: "objects/natural/x.cgf", x: 1, y: 2, z: 3 });
    for (const bad of [null, "nope", "{}", { k: "bush", m: "a", x: 1, y: 2, z: 3 }, { k: "rock", m: "", x: 1, y: 2, z: 3 }, { k: "rock", m: "a", x: "1", y: 2, z: 3 }]) {
        assert.equal(sut.api.readReport(bad), null, JSON.stringify(bad));
    }
    const jan = sut.player();
    sut.handlers.get("kcdc-gamemode:gather.start")(jan, JSON.stringify(aim(PINE)));
    assert.equal(sut.api.isGathering(jan), true);
    const ota = sut.player("Ota", []);
    sut.handlers.get("kcdc-gamemode:gather.start")(ota, JSON.stringify(aim(PINE)));
    assert.match(sut.logs.at(-1), /coleta: Ota não começou a cortar lenha: sem ferramenta \(pinus_sylvestris_a\.cgf\)/);
});

test("the living trees of the level's woods and its rocks and stones, from the meshes the game has", () => {
    const sut = load();
    for (const yes of [PINE, OAK, "objects/natural/vegetation/trees/normal_trees/fagus_sylvatica/fagus_sylvatica_e.cgf", "objects/natural/vegetation/trees/normal_trees/abies_alba/abies_alba_forest_a.cgf", "objects/natural/vegetation/trees/normal_trees/marsh_trees/marsh_salix_alba_a.cgf"]) {
        assert.equal(sut.api.isTree(yes), true, yes);
    }
    for (const no of ["objects/natural/vegetation/trees/normal_trees/abies_alba/abies_alba_small_a.cgf", "objects/natural/vegetation/trees/normal_trees/betula_pendula/betula_pendula_sick_a.cgf", "objects/natural/vegetation/trees/normal_trees/fagus_sylvatica_dry/fagus_sylvatica_dry_coppiced_a.cgf", "objects/natural/vegetation/trees/normal_trees/malus/malus_sylvestris_a.cgf", "objects/natural/vegetation/trees/normal_trees/mistletoe/mistletoe_fagus_a.cgf", BOULDER]) {
        assert.equal(sut.api.isTree(no), false, no);
    }
    for (const yes of [BOULDER, CLIFF_KH, "objects/natural/stones/gneiss_stone_a.cgf"]) assert.equal(sut.api.isRock(yes), true, yes);
    for (const no of ["objects/natural/rocks/apolena_rocks/visual_target/moss_f_veg.cgf", "objects/natural/landslips/landslip_rocks/landslip_rocks_a.cgf", OAK]) assert.equal(sut.api.isRock(no), false, no);
    assert.deepEqual([OAK, PINE, "objects/natural/vegetation/trees/normal_trees/betula_pendula/betula_pendula_a.cgf"].map(sut.api.logsOf), [4, 3, 2]);
    assert.deepEqual([CLIFF_KH, BOULDER, "objects/natural/stones/gneiss_stone_a.cgf", "objects/natural/rocks/rocks_forest/rock_forest_mossy_a.cgf"].map(sut.api.strikesOf), [12, 12, 3, 6]);
});

test("/coleta says the rules and what is being worked; descansar lets every tree and rock give again; a player who leaves is forgotten", () => {
    const sut = load();
    const jan = sut.player();
    sut.api.startGather(jan, aim(PINE), sut.clock.now);
    assert.match(sut.api.gatherSummary(sut.clock.now).join("\n"), /1 árvore\(s\) e 0 pedra\(s\) em trabalho, 0 descansando; 1 jogador\(es\) trabalhando/);
    sut.handlers.get("playerDisconnect")(jan);
    assert.equal(sut.api.isGathering(jan), false);
    assert.equal(sut.api.restAll(), 1);
    assert.match(sut.api.gatherSummary(sut.clock.now).join("\n"), /0 árvore\(s\) e 0 pedra\(s\)/);
});

test("the others are told who is at the blows, so each keeps the sound to those near: the felling as lenha, the mining as mina, and the end of either", () => {
    const sut = load();
    const jan = sut.player();
    sut.api.startGather(jan, aim(OAK), sut.clock.now);
    assert.deepEqual(sut.worked, [["Jan", "lenha"]]);
    sut.api.stopGather(jan);
    assert.deepEqual(sut.worked, [["Jan", "lenha"], ["Jan", "end"]]);
    const kuba = sut.player("Kuba", [PICK]);
    sut.api.startGather(kuba, aim(BOULDER), sut.clock.now);
    assert.deepEqual(sut.worked.at(-1), ["Kuba", "mina"]);
});

test("two axes of one class are one row of the bag, and a log wears ONE of them: the other stays whole (user, 2026-10-25: com 2 machados os dois se quebram juntos)", () => {
    const sut = load();
    const jan = sut.player("Jan", [{ item: AXE, amount: 2 }]);
    sut.api.startGather(jan, aim(OAK), sut.clock.now);
    sut.tick();
    const rows = () => sut.bags.get(jan.id).map((row) => [row.id, row.amount, Math.round(row.condition * 1000) / 1000]);
    assert.deepEqual(rows(), [["t0", 1, 1], ["n2", 1, 0.991]], "one axe whole, one worn: not two worn");
    assert.equal(sut.properties.length, 0, "the stack's own properties were not touched");
    assert.deepEqual(sut.removed, [["Jan", [{ id: "t0", amount: 1 }]]]);
    // The next log wears the best one, which is the whole axe: they take turns, each wearing half as fast.
    sut.tick();
    assert.deepEqual(rows(), [["t0", 1, 0.991], ["n2", 1, 0.991]]);
    assert.equal(sut.properties.length, 1, "a lone tool is worn in place, as before");
});

test("a worn axe that does not fit in the bag leaves the stack as it was, a failed removal takes the added axe out again, and the work goes on", () => {
    const sut = load();
    const jan = sut.player("Jan", [{ item: AXE, amount: 2 }]);
    sut.api.startGather(jan, aim(OAK), sut.clock.now);
    sut.state.addFails = true;
    sut.tick();
    assert.deepEqual(sut.bags.get(jan.id).map((row) => [row.id, row.amount, row.condition]), [["t0", 2, 1]]);
    assert.equal(sut.removed.length, 0, "nothing was taken out");
    assert.ok(sut.logs.some((line) => /coleta: Jan: a ferramenta gasta não coube na bolsa \(inventoryCapacity\)/.test(line)), sut.logs.join("|"));
    assert.equal(sut.api.isGathering(jan), true, "the work goes on");
    assert.equal(sut.added.at(-1)[1], "guid:kcdc-craft:lenha", "and the log was given");

    sut.state.addFails = false;
    sut.state.removeFails = true;
    sut.tick();
    assert.deepEqual(sut.bags.get(jan.id).map((row) => [row.id, row.amount, row.condition]), [["t0", 2, 1]], "a second axe is not left over");
    assert.equal(sut.removed.length, 2, "the removal that failed, and the one that took the added axe back");
});

test("a cut of the axe is a log, and now and then the straight wood of the bows or, very rarely, an exotic wood (2026-10-27)", () => {
    const sut = load();
    const cut = (roll) => sut.api.rollTree(roll).item;
    assert.equal(cut(0), "kcdc-craft:lenha");
    assert.equal(cut(0.5), "kcdc-craft:lenha");
    assert.equal(cut(0.86), "kcdc-craft:lenha");
    assert.equal(cut(0.9), "kcdc-craft:madeira");
    assert.equal(cut(0.96), "kcdc-craft:madeira");
    assert.equal(cut(0.98), "walnuts");
    assert.equal(cut(0.995), "bsmt_woodExotic");
    assert.equal(sut.api.TREE_FINDS.reduce((sum, find) => sum + find.weight, 0), 100);

    // The one cut in the work: whatever was rolled is what is given, and the log line says it.
    const jan = sut.player();
    sut.api.startGather(jan, aim(OAK), sut.clock.now, () => 0.93);
    sut.tick();
    assert.deepEqual(sut.added, [["Jan", "guid:kcdc-craft:madeira", 1]]);
    assert.ok(sut.logs.some((line) => /coleta: Jan cortou madeira de arco/.test(line)));
});

test("a log is paid at the trades' standard: the table's own XP since 2026-11-03 (four times it from 2026-10-27, when the felling paid four times what the gardens do)", () => {
    profession.useStandard();
    try {
        const sut = load();
        const jan = sut.player();
        sut.api.startGather(jan, aim(OAK), sut.clock.now);
        sut.tick();
        assert.deepEqual(jan.xp, [["survival", 4]]);
    } finally {
        profession.useTables();
    }
});

test("an axe with half a percent left still works (2% stopped it before 2026-11-04); worn to nothing by a log it breaks: one of the stack leaves the bag, the player is told, and the work stops at the next log for want of an axe (2026-11-04)", () => {
    const sut = load();
    const jan = sut.player("Jan", [{ item: AXE, amount: 2 }]);
    // Both axes of the stack at 0.5% (one row, one condition): the next log takes 0.9% and breaks the one in use.
    sut.bags.get(jan.id)[0].condition = 0.005;
    assert.equal(sut.api.startGather(jan, aim(OAK), sut.clock.now).started, true);
    sut.tick();
    assert.deepEqual(sut.removed.at(-1), ["Jan", [{ id: "t0", amount: 1 }]], "one axe out of the stack");
    assert.match(jan.told.at(-1), /O seu machado quebrou de tanto uso e sumiu do inventário\. Faça outro no ferreiro\./);
    assert.ok(sut.logs.some((line) => /coleta: Jan: o machado quebrou com o uso e saiu do inventário/.test(line)));
    assert.equal(sut.bags.get(jan.id)[0].amount, 1, "the other axe of the stack is still there");
    assert.ok(jan.xp.length >= 1, "the log was worked all the same");
});
