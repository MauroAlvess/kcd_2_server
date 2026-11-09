"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const { lowered, torch } = require("./torchstub.cjs");
const { profession } = require("./reachpatch.cjs");
// The tables' own XP and no day's limit: these tests are of the work and not of the pace the trades' XP is paid at (src/server/profession-xp.ts, the standard of 2026-11-03): the tests of the pace set it.
profession.useTables();

// The Agricultores' gardens (src/server/farm.ts, 2026-10-22): E at the soil of a village's bed opens the page of what can be sown; sowing
// digs the bed with a shovel and takes a seed; the bed grows in real time, shows its plant, and is harvested with E for the crop and seeds back.

const dist = (name) => fs.readFileSync(path.join(__dirname, `../dist/server/${name}.js`), "utf8");

function fakeDisk(seed = {}) {
    const files = new Map(Object.entries(seed));
    return {
        files,
        fs: {
            readFileSync(file) {
                if (!files.has(file)) throw new Error("ENOENT");
                return files.get(file);
            },
            writeFileSync(file, data) { files.set(file, data); },
            mkdirSync() {},
            renameSync(from, to) { files.set(to, files.get(from)); files.delete(from); },
            existsSync: (file) => files.has(file),
        },
    };
}

const craftData = { exports: {} };
vm.runInNewContext(dist("craft-data"), craftData);
const { FARM_CROPS, FARM_TOOLS, CRAFT_ITEMS } = craftData.exports;
const SHOVEL = FARM_TOOLS[0];
const ONION = FARM_CROPS.find((crop) => crop.id === "cebola");
const CABBAGE = FARM_CROPS.find((crop) => crop.id === "repolho");
const CARROT = FARM_CROPS.find((crop) => crop.id === "cenoura");
const seedOf = (crop) => `guid:${crop.seed}`;
const LINEN = "5c9aa2cf-0117-46cc-a7c7-1eb8bcc59dc6";
const WHEAT = "kcdc-craft:trigo";

class FakeVector3 {
    constructor(x, y, z) { this.x = x; this.y = y; this.z = z; }
}

/** Two gardens: Suchdol's, with a bed running north-south and one running east-west, and Wysoka's, with a short one. */
const BEDS = [
    { id: "suchdol-1:1", garden: "suchdol-1", x: 100, y: 100, z: 50, yaw: 0, length: 4 },
    { id: "suchdol-1:2", garden: "suchdol-1", x: 110, y: 100, z: 50, yaw: 90, length: 4 },
    { id: "wysoka-1:1", garden: "wysoka-1", x: 300, y: 300, z: 60, yaw: 0, length: 2 },
];
const GARDENS = [
    { id: "suchdol-1", name: "Horta de Suchdol", x: 105, y: 100, z: 50, beds: [BEDS[0], BEDS[1]] },
    { id: "wysoka-1", name: "Horta de Wysoka", x: 300, y: 300, z: 60, beds: [BEDS[2]] },
];

const T0 = 1_760_000_000_000;

/** What the sandbox hands out has the sandbox's own Array, which a strict deepEqual of this realm does not take for its own. */
const plain = (value) => JSON.parse(JSON.stringify(value));

function load({ farmers = ["hans", "greta", "boss"], free = [], disk = fakeDisk() } = {}) {
    const store = { exports: {} };
    vm.runInNewContext(dist("store"), { exports: store.exports, require: () => disk.fs });
    const state = {
        handlers: new Map(),
        client: new Map(),
        emitted: [],
        chat: [],
        props: new Map(),
        blips: new Map(),
        added: [],
        xp: [],
        played: [],
        worked: [],
        stopped: 0,
        logs: [],
        timers: [],
        intervals: [],
        bags: new Map(),
        random: 0.5,
        playFails: new Set(),
        clock: { now: T0 },
        online: [],
    };
    let nextProp = 1;
    let nextBlip = 1;
    const data = { gardens: [...GARDENS], beds: [...BEDS], meadows: [] };
    const FakeMath = Object.create(Math);
    FakeMath.random = () => state.random;
    const context = {
        exports: {},
        require: (id) => ({
            "./torch-down.js": torch,
            "./big-emit.js": { emitLarge: (player, name, json) => { player.emit(`kcdc-gamemode:${name}`, json); return 1; } },
            "./craft.js": { isWorking: (player) => state.working === player.id, batchOf: (value) => { const n = Math.floor(Number(value)); return Number.isFinite(n) ? Math.min(10, Math.max(1, n)) : 1; } },
            "./craft-data.js": craftData.exports,
            "./craft-items.js": {
                classOf: (item) => (item.startsWith("kcdc-craft:") ? `guid:${item}` : item).toLowerCase(),
                craftItemGuid: (item) => (item.startsWith("kcdc-craft:") ? `guid:${item}` : null),
            },
            "./craft-titles.js": { craftTitle: (station) => (station === "horta" ? "data:image/webp;base64,HORTA" : "") },
            "./farm-data.js": {
                farmData: () => data,
                addGarden: (garden) => { data.gardens = [...data.gardens, garden]; data.beds = [...data.beds, ...garden.beds]; },
                removeGarden: (id) => {
                    const had = data.gardens.some((garden) => garden.id === id);
                    data.gardens = data.gardens.filter((garden) => garden.id !== id);
                    data.beds = data.beds.filter((bed) => bed.garden !== id);
                    return had;
                },
            },
            "./position.js": { yawOf: (rotation) => rotation.z },
            "./gather.js": { isGathering: (player) => state.gathering === player.id },
            "./guild-crafts.js": {
                mayCraft: (player, craft) => farmers.includes(player.steamId) && ["horta", "domar"].includes(craft),
                usesFreeCrafts: (player) => free.includes(player.steamId),
            },
            "./language.js": { languageOf: () => "pt", translate: (text) => text },
            "./work-sound.js": { workBegins: (player, kind) => state.worked.push([player.nickname, kind]), workEnds: (player) => state.worked.push([player.nickname, "end"]) },
            "./status.js": { onGuildChange: (fn) => { state.guildListener = fn; } },
            "./store.js": store.exports,
        })[id] ?? assert.fail(`unexpected require ${id}`),
        console: { log: (line) => state.logs.push(line), error: (line) => state.logs.push(line) },
        Date: { now: () => state.clock.now },
        Math: FakeMath,
        JSON,
        Vector3: FakeVector3,
        setTimeout: (fn, ms) => { state.timers.push({ fn, ms, cleared: false }); return state.timers.length; },
        clearTimeout: (handle) => { if (state.timers[handle - 1]) state.timers[handle - 1].cleared = true; },
        setInterval: (fn, ms) => { state.intervals.push({ fn, ms }); return state.intervals.length; },
        clearInterval() {},
        Events: {
            on: (name, fn) => state.handlers.set(name, [...(state.handlers.get(name) ?? []), fn]),
            onClient: (name, fn) => state.client.set(name, fn),
        },
        Chat: { sendToPlayer: (player, text) => state.chat.push(text) },
        Player: { all: () => state.online },
        Prop: {
            spawn: (model, position, rotation, scale, physics) => {
                const prop = { id: nextProp++, model, position, rotation, scale, physics, destroyed: false, destroy() { this.destroyed = true; state.props.delete(this.id); } };
                state.props.set(prop.id, prop);
                return prop;
            },
            getById: (id) => state.props.get(id) ?? null,
        },
        Blip: {
            create: (options) => {
                const blip = { id: nextBlip++, ...options, removed: false, remove() { this.removed = true; state.blips.delete(this.id); } };
                state.blips.set(blip.id, blip);
                return blip;
            },
            getById: (id) => state.blips.get(id) ?? null,
        },
        Inventory: {
            get: (player) => ({ revision: 1, items: state.bags.get(player.id) ?? [] }),
            add: (player, request) => {
                if (state.full || (state.fullFor && String(request.item).toLowerCase() === state.fullFor)) return { ok: false, code: "inventoryCapacity" };
                state.added.push([player.nickname, request.item, request.amount]);
                const bag = state.bags.get(player.id) ?? [];
                const row = bag.find((one) => String(one.item).toLowerCase() === String(request.item).toLowerCase());
                if (row) row.amount += request.amount;
                else bag.push({ id: `n${bag.length}`, item: request.item, amount: request.amount });
                state.bags.set(player.id, bag);
                return { ok: true, code: "" };
            },
            remove: (player, request) => {
                const bag = state.bags.get(player.id) ?? [];
                for (const unit of request.units) {
                    const row = bag.find((one) => one.id === unit.id);
                    if (!row || row.amount < unit.amount) return { ok: false, code: "missing" };
                    row.amount -= unit.amount;
                }
                state.bags.set(player.id, bag.filter((one) => one.amount > 0));
                return { ok: true, code: "" };
            },
        },
    };
    vm.runInNewContext(dist("farm"), context);
    const api = context.exports;
    api.installFarm();
    let nextId = 1;
    const player = (steamId = "hans", { at = { x: 100, y: 99, z: 50 }, level = 0, gender = "male", bag = [], yaw = 0 } = {}) => {
        const body = {
            id: nextId++,
            steamId,
            nickname: steamId[0].toUpperCase() + steamId.slice(1),
            ready: true,
            alive: true,
            mounted: false,
            horse: null,
            appearance: { gender },
            position: { ...at },
            rotation: { x: 0, y: 0, z: yaw },
            getTrack: () => ({ level }),
            addXp: (track, amount) => state.xp.push([steamId, track, amount]),
            playAnimation: (fragment, options) => {
                if (options && options.props && state.playFails.has(options.props.item)) throw new Error(`prop ${options.props.item} unknown`);
                state.played.push([fragment, options ? { ...options, props: options.props ? { ...options.props } : undefined } : null]);
                return true;
            },
            stopAnimation: () => { state.stopped += 1; return true; },
            emit: (event, payload) => state.emitted.push({ to: steamId, event: event.replace("kcdc-gamemode:", ""), payload: JSON.parse(payload) }),
        };
        state.bags.set(body.id, bag.map((row, index) => ({ id: `r${index}`, ...row })));
        state.online.push(body);
        return body;
    };
    const timer = (ms) => state.timers.filter((one) => one.ms === ms && !one.cleared).at(-1);
    const sentTo = (who, event) => state.emitted.filter((one) => one.to === who && one.event === event);
    return { api, state, player, timer, sentTo, disk, context, data };
}

const kit = [
    { item: SHOVEL, amount: 1 },
    { item: seedOf(ONION), amount: 5 },
    { item: seedOf(CABBAGE), amount: 2 },
    { item: seedOf(CARROT), amount: 1 },
];

test("a bed is a row: the distance to it is to the nearest point of the row, which runs the bed's way through its middle", () => {
    const sut = load();
    const [north, east] = BEDS;
    assert.equal(sut.api.distanceToBed(north, { x: 100, y: 100 }), 0);
    assert.equal(sut.api.distanceToBed(north, { x: 103, y: 100 }), 3, "beside the middle");
    assert.equal(sut.api.distanceToBed(north, { x: 100, y: 101.5 }), 0, "along the row");
    assert.equal(sut.api.distanceToBed(north, { x: 100, y: 110 }), 8, "past its end: to the end of it (2 m from the middle)");
    // Yaw 90 runs the row west to east through (110, 100).
    assert.ok(Math.abs(sut.api.distanceToBed(east, { x: 111.5, y: 100 })) < 1e-9, "along the east-west row");
    assert.ok(Math.abs(sut.api.distanceToBed(east, { x: 110, y: 103 }) - 3) < 1e-9, "beside it");
    assert.ok(Math.abs(sut.api.distanceToBed(east, { x: 116, y: 100 }) - 4) < 1e-9, "past its end");

    const spots = sut.api.plantSpots(north);
    assert.equal(spots.length, 3, "three plants along it");
    assert.deepEqual(plain(spots.map((spot) => [Math.round(spot.x * 10) / 10, Math.round(spot.y * 10) / 10])), [[100, 98.8], [100, 100], [100, 101.2]]);
});

test("a body is at a bed within the reach of the prompts (2.5 m of the row's soil) and a metre more for the press, and not up or down a storey", () => {
    const sut = load();
    const hans = sut.player("hans", { at: { x: 102.5, y: 100, z: 50 } });
    assert.equal(sut.api.nearBed(hans, BEDS[0]), true, "2.5 m beside the row");
    hans.position = { x: 103.4, y: 100, z: 50 };
    assert.equal(sut.api.nearBed(hans, BEDS[0]), true, "3.4 m: the press is allowed a metre over the prompt");
    hans.position = { x: 104, y: 100, z: 50 };
    assert.equal(sut.api.nearBed(hans, BEDS[0]), false);
    hans.position = { x: 100, y: 100, z: 56 };
    assert.equal(sut.api.nearBed(hans, BEDS[0]), false, "a floor above");
});

test("a harvest is a share of the crop's range, one more from level 15, and one seed back, two half the time; a bed keeps one farmer to a few beds that grow with the level", () => {
    const sut = load();
    assert.deepEqual({ ...sut.api.harvestOf(ONION, 0, 0, 0.9) }, { amount: 4, seeds: 1 });
    assert.deepEqual({ ...sut.api.harvestOf(ONION, 0, 0.99, 0.1) }, { amount: 6, seeds: 2 });
    assert.deepEqual({ ...sut.api.harvestOf(ONION, 15, 0, 0.9) }, { amount: 5, seeds: 1 }, "level 15: one more");
    assert.deepEqual({ ...sut.api.harvestOf(CABBAGE, 0, 0.99, 0.9) }, { amount: 3, seeds: 1 }, "a cabbage 2 to 3");
    // A row longer than the standard four metres gives in proportion, up to twice (2026-10-27: the fields were made longer).
    assert.equal(sut.api.rowFactor(4), 1);
    assert.equal(sut.api.rowFactor(2), 1, "never less");
    assert.equal(sut.api.rowFactor(6), 1.5);
    assert.equal(sut.api.rowFactor(8), 2);
    assert.equal(sut.api.rowFactor(30), 2, "never more than twice");
    assert.deepEqual({ ...sut.api.harvestOf(ONION, 0, 0, 0.9, 8) }, { amount: 8, seeds: 1 }, "four onions from a short row, eight from a long one");
    assert.deepEqual({ ...sut.api.harvestOf(ONION, 0, 0.99, 0.1, 6) }, { amount: 9, seeds: 2 }, "six, and half as many again");
    // Ten at the start and one more every two levels (2026-10-27, "as terras de plantações estão muito pequenas": it was four, and one more every five levels).
    assert.equal(sut.api.bedsAllowed(0), 10);
    assert.equal(sut.api.bedsAllowed(1), 10);
    assert.equal(sut.api.bedsAllowed(2), 11);
    assert.equal(sut.api.bedsAllowed(12), 16);
    assert.equal(sut.api.bedsAllowed(30), 25);
    assert.equal(sut.api.minutesText(20 * 60_000), "20 min");
    assert.equal(sut.api.minutesText(61 * 60_000), "1 h 01 min");
    assert.equal(sut.api.minutesText(1), "1 min", "never zero");
});

test("the plants: fifty-nine of them, from the onion and the flax at level 0 to the pepper, vegetables, fibre, grain, herbs, fruit and spices, each with a seed of our own and a time to ripen", () => {
    // Nineteen more on 2026-11-02 ("vamos adicionar mais sementes e frutos para plantação").
    assert.equal(FARM_CROPS.length, 59);
    // The apothecaries' herbs the vendors sold and nobody sowed (2026-10-27): thirteen more with the elder's leaves, nineteen, so that the alchemists need no one to forage for them; the dill (2026-11-02).
    assert.equal(FARM_CROPS.filter((crop) => crop.category === "Ervas").length, 20);
    assert.equal(FARM_CROPS[0].id, "cebola");
    assert.equal(FARM_CROPS[0].level, 0);
    assert.equal(FARM_CROPS.at(-1).id, "pimenta", "the pepper (2026-10-24) is the last, the slowest and the rarest");
    assert.ok(FARM_CROPS.every((crop) => crop.minutes >= 25 && crop.minutes <= 90 && crop.least >= 1 && crop.most >= crop.least && crop.seed.startsWith("kcdc-craft:semente-")), "half an hour to an hour and a half");
    assert.deepEqual(Array.from(new Set(FARM_CROPS.map((crop) => crop.category))).sort(), ["Ervas", "Especiarias", "Fibras", "Frutas", "Grãos", "Legumes"]);
    // The trades that wait on the garden (2026-10-27, SINERGIA.md): flax for the Artifices, wheat and barley and hops for the Tabernarii, grapes for the wine.
    assert.deepEqual(plain(FARM_CROPS.filter((crop) => crop.category === "Fibras" || crop.category === "Grãos").map((crop) => [crop.id, CRAFT_ITEMS[crop.harvest][0]])), [["linho", "Linho"], ["trigo", "Trigo"], ["centeio", "Centeio"], ["cevada", "Cevada"], ["aveia", "Aveia"], ["lupulo", "Lúpulo"]]);
    assert.equal(FARM_CROPS.find((crop) => crop.id === "linho").level, 0, "a new farmer can sow flax at once: the Artifices' trade hangs on it");
    // The fruit (2026-10-24: "nas plantações do agricultor vamos colocar pimenta e frutas"): the game's own apple, pear, plums, peach and watermelon; the berries, the cherry, the quince,
    // the hazelnut (our own items) and the walnut (the game's) since 2026-11-02.
    assert.deepEqual(plain(FARM_CROPS.filter((crop) => crop.category === "Frutas").map((crop) => crop.id)), ["morango", "amora", "maca", "cereja", "pera", "framboesa", "mirtilo", "ameixa", "groselha", "marmelo", "pessego", "avela", "uva", "melancia", "noz"]);
    assert.deepEqual(plain(FARM_CROPS.filter((crop) => crop.category === "Frutas").map((crop) => CRAFT_ITEMS[crop.harvest][0])), ["Morangos", "Amoras", "Maçã", "Cerejas", "Pera", "Framboesas", "Mirtilos", "Ameixas", "Groselhas", "Marmelos", "Pêssego", "Avelãs", "Uvas", "Melancia", "Nozes"]);
    // The game's mustard (`estragonSpice`, "uma especiaria rara das terras do sul") and the pepper.
    assert.deepEqual(plain(FARM_CROPS.filter((crop) => crop.category === "Especiarias").map((crop) => [crop.id, CRAFT_ITEMS[crop.harvest][0]])), [["mostarda", "Mostarda"], ["pimenta", "Pimenta"]]);
    assert.equal(CRAFT_ITEMS[FARM_CROPS.at(-1).harvest][0], "Pimenta");
    const levels = plain(FARM_CROPS.map((crop) => crop.level));
    assert.deepEqual(levels, [...levels].sort((a, b) => a - b), "listed from the easiest");
    // Everything the kitchen's soups take that a garden grows is among them.
    for (const wanted of ["onion", "cabbage", "carrot", "garlic", "turnip", "parsnip", "leek", "herb_urticaria"]) {
        assert.ok(FARM_CROPS.some((crop) => CRAFT_ITEMS[crop.harvest] && CRAFT_ITEMS[crop.harvest][1] === wanted), `${wanted} is grown`);
    }
    assert.ok(CRAFT_ITEMS[SHOVEL], "the page knows the shovel's name and icon");
    assert.ok(FARM_CROPS.every((crop) => CRAFT_ITEMS[crop.seed] && CRAFT_ITEMS[crop.harvest]), "and every seed and every crop");
});

test("only an Agricultor is sent the beds, each with what it is to them: free, theirs growing, theirs ripe, another's", () => {
    const sut = load();
    const hans = sut.player("hans", { bag: kit });
    const stranger = sut.player("stranger");
    assert.deepEqual(Array.from(sut.api.bedsFor(stranger)), [], "a player who is nobody's farmer learns of no bed");
    const rows = sut.api.bedsFor(hans);
    assert.equal(rows.length, 3);
    assert.deepEqual(Array.from(rows[0]), [100, 100, 50, 0, 4, 0], "x, y, z, the row's yaw, its length and 0: free");

    sut.api.useBed(hans, 0, T0);
    sut.api.plantFromPage(hans, "horta:cebola");
    sut.timer(9_000).fn();
    assert.equal(sut.api.bedsFor(hans, T0)[0][5], 1, "theirs, growing");
    assert.equal(sut.api.bedsFor(hans, T0 + 31 * 60_000)[0][5], 2, "ripe after half an hour");
    const greta = sut.player("greta");
    assert.equal(sut.api.bedsFor(greta, T0)[0][5], 3, "another farmer's");
    assert.equal(sut.api.bedsFor(greta, T0)[1][5], 0);
});

test("E at a free bed opens the page of the plants: what each gives, takes and needs, with the seeds and the shovel counted, in the trades' page", () => {
    const sut = load();
    const hans = sut.player("hans", { bag: kit });
    assert.equal(sut.api.useBed(hans, 0, T0), "página");
    const [view] = sut.sentTo("hans", "craft.view");
    assert.equal(view.payload.station, "horta");
    assert.equal(view.payload.title, "Horta");
    assert.equal(view.payload.verb, "Plantar");
    assert.equal(view.payload.img, "data:image/webp;base64,HORTA", "its title image goes with it");
    assert.match(view.payload.sub, /Horta de Suchdol · 0 de 10 canteiros seus semeados · nível 0 de Sobrevivência/);
    assert.equal(view.payload.recipes.length, 59 + 4 + 59, "the plants, the four pieces of work on the harvest (the rye's milling since 2026-11-02), and a seed kept back from each plant (2026-10-27)");
    const spin = view.payload.recipes.find((row) => row.id === "beneficiar:fiar-linha");
    assert.equal(spin.cat, "Beneficiar");
    assert.equal(spin.v, "Fazer", "its button is not 'Plantar'");
    assert.equal(spin.n, 3);
    assert.deepEqual(plain(spin.ing), [[LINEN, 1, 0]]);
    assert.equal(spin.can, false, "no linen");
    assert.equal(spin.lock, false);
    assert.ok(view.payload.items[spin.out] && view.payload.items[LINEN], "the thread's and the linen's names and icons");
    assert.equal(view.payload.recipes.find((row) => row.id === "beneficiar:semente-uva").lock, true, "the seeds of a plant wait for its level");
    const onion = view.payload.recipes.find((row) => row.id === "horta:cebola");
    assert.equal(onion.cat, "Legumes");
    assert.equal(onion.out, ONION.harvest, "its icon and name are the crop's");
    assert.deepEqual(onion.ing, [[ONION.seed, 1, 5], [SHOVEL, 1, 1, 1]], "a seed, and the shovel as a tool (a fourth number) that is only looked for");
    assert.equal(onion.can, true);
    assert.equal(onion.lock, false);
    assert.match(onion.t, /colheita em 30 min · rende 4 a 6/);
    const cabbage = view.payload.recipes.find((row) => row.id === "horta:repolho");
    assert.equal(cabbage.can, true);
    const turnip = view.payload.recipes.find((row) => row.id === "horta:nabo");
    assert.equal(turnip.can, false, "no seed of it");
    assert.equal(turnip.lock, true, "and not before level 2");
    assert.ok(view.payload.items[SHOVEL] && view.payload.items[ONION.seed] && view.payload.items[ONION.harvest], "the names and icons of what is shown");
});

test("E at a bed in the world: far away nothing, a stranger is told whose the gardens are, another's bed is another's", () => {
    const sut = load();
    const stranger = sut.player("stranger", { bag: kit });
    assert.equal(sut.api.useBed(stranger, 0, T0), "não é da guilda");
    assert.match(sut.state.chat.at(-1), /Lavrar as hortas é ofício dos agricultores \(guilda Agricolae\)/);
    const hans = sut.player("hans", { at: { x: 200, y: 200, z: 50 }, bag: kit });
    assert.equal(sut.api.useBed(hans, 0, T0), "longe");
    assert.equal(sut.api.useBed(hans, 9, T0), "nenhum canteiro");
    assert.equal(sut.api.useBed(hans, "0", T0), "nenhum canteiro");
    assert.deepEqual(sut.sentTo("hans", "craft.view"), []);
});

test("Plantar digs the bed for nine seconds with the shovel in the right hand, then takes a seed and sows it: the plant stands along the row", () => {
    const sut = load();
    const hans = sut.player("hans", { bag: kit });
    sut.api.useBed(hans, 0, T0);
    const heldBefore = lowered.length;
    assert.equal(sut.api.plantFromPage(hans, "horta:cebola"), "");
    assert.equal(lowered.length - heldBefore, 1, "a torch in the hand is put away before the digging (2026-10-25)");
    assert.deepEqual(sut.state.played, [["Digging", { loop: true, lockMovement: true, props: { item: "shovel", hand: "right" } }]], "the gravedigger's digging, a shovel in the hand, the body held");
    const progress = sut.sentTo("hans", "craft.progress")[0].payload;
    assert.deepEqual(progress, { id: "horta:cebola", ms: 9_000, doing: "Cavando e semeando" });
    assert.equal(sut.state.props.size, 0, "nothing is sown yet");

    sut.timer(9_000).fn();
    assert.equal(sut.state.stopped, 1, "the animation ends");
    assert.deepEqual(sut.state.xp, [["hans", "survival", 2]], "a little experience for the sowing");
    const bag = sut.state.bags.get(hans.id);
    assert.equal(bag.find((row) => row.item === seedOf(ONION)).amount, 4, "one seed went in");
    assert.equal(bag.find((row) => row.item === SHOVEL).amount, 1, "the shovel is not used up");
    assert.equal(sut.state.props.size, 3, "three plants along the row");
    const first = [...sut.state.props.values()][0];
    assert.equal(first.model, ONION.plant);
    assert.equal(first.physics, "none", "nobody walks into them");
    assert.equal(first.scale, 0.35, "small at first");
    assert.deepEqual(plain(sut.api.plotsOf("hans").map((plot) => [plot.bed, plot.crop, plot.readyAt - plot.plantedAt])), [["suchdol-1:1", "cebola", 30 * 60_000]]);
    const result = sut.sentTo("hans", "craft.result").at(-1).payload;
    assert.equal(result.ok, true);
    assert.match(result.text, /Plantado: cebola na Horta de Suchdol\. Volte para colher em 30 min\./);
    const again = sut.sentTo("hans", "craft.view").at(-1).payload;
    assert.equal(again.recipes.find((row) => row.id === "horta:cebola").ing[0][2], 4, "and the page is sent again with what is left");
    assert.equal(again.recipes.find((row) => row.id === "horta:cebola").can, false, "the bed is taken now");
    assert.ok(sut.state.logs.some((line) => /farm: Digging com shovel na mão direita/.test(line)), "what was played is said once");
    assert.ok(sut.state.logs.some((line) => /Hans plantou Cebola em Horta de Suchdol/.test(line)));
});

test("the others are told who is digging or picking, so each keeps the sound of the shovel to those near; and when it ends", () => {
    const sut = load();
    const hans = sut.player("hans", { bag: kit });
    sut.api.useBed(hans, 0, T0);
    sut.api.plantFromPage(hans, "horta:cebola");
    assert.deepEqual(sut.state.worked, [["Hans", "horta"]]);
    sut.timer(9_000).fn();
    assert.deepEqual(sut.state.worked.at(-1), ["Hans", "end"], "the digging done");
    sut.api.tickFarm(T0 + 31 * 60_000);
    sut.state.clock.now = T0 + 31 * 60_000;
    const before = sut.state.worked.length;
    sut.api.useBed(hans, 0, T0 + 31 * 60_000);
    assert.deepEqual(sut.state.worked[before], ["Hans", "horta"], "and the picking, when it is ripe");
});

test("a woman, for whom the game has no digging, hoes with the hoe; a prop the catalog does not take is left out and the work still plays", () => {
    const sut = load();
    const greta = sut.player("greta", { gender: "female", bag: kit });
    sut.api.useBed(greta, 0, T0);
    sut.api.plantFromPage(greta, "horta:cebola");
    assert.deepEqual(sut.state.played, [["Hoeing", { loop: true, lockMovement: true, props: { item: "iron_hoe", hand: "right" } }]]);

    const other = load();
    const hans = other.player("hans", { bag: kit });
    other.state.playFails.add("shovel");
    other.api.useBed(hans, 0, T0);
    other.api.plantFromPage(hans, "horta:cebola");
    assert.deepEqual(other.state.played, [["Digging", { loop: true, lockMovement: true, props: undefined }]], "played without it");
    assert.ok(other.state.logs.some((line) => /shovel não foi aceito como objeto da mão/.test(line)));
});

test("a sowing is refused, with the reason, without a shovel, a seed, the level, a free bed, the page of a bed, or the guild; nothing is taken", () => {
    const sut = load({ free: [] });
    const refuse = (who, id, why) => {
        const before = sut.state.timers.length;
        const said = sut.state.chat.length;
        const returned = sut.api.plantFromPage(who, id);
        assert.ok(why.test(returned) || why.test(sut.state.chat.at(-1) ?? ""), `${why}: ${returned} / ${sut.state.chat.at(-1)}`);
        assert.ok(sut.state.chat.length > said || returned !== "", "something is said");
        assert.equal(sut.state.timers.length, before, "no work is started");
        assert.equal(sut.state.props.size, 0);
    };
    const bed = BEDS[0];
    const hans = sut.player("hans", { bag: [{ item: seedOf(ONION), amount: 3 }] });
    sut.api.openFarmPage(hans, bed);
    refuse(hans, "horta:cebola", /pá na bolsa/);

    const noSeed = sut.player("hans", { bag: [{ item: SHOVEL, amount: 1 }] });
    sut.api.openFarmPage(noSeed, bed);
    refuse(noSeed, "horta:cebola", /Falta: 1x Sementes de cebola \(tem 0\)/);

    const young = sut.player("hans", { bag: [{ item: SHOVEL, amount: 1 }, { item: seedOf(FARM_CROPS.find((crop) => crop.id === "alho")), amount: 3 }], level: 2 });
    sut.api.openFarmPage(young, bed);
    refuse(young, "horta:alho", /nível 6 de sobrevivência para plantar alho/);

    const nowhere = sut.player("hans", { bag: kit });
    refuse(nowhere, "horta:cebola", /Escolha um canteiro de horta/);
    refuse(nowhere, "horta:inexistente", /Escolha um canteiro de horta/);

    const stranger = sut.player("stranger", { bag: kit });
    sut.api.openFarmPage(stranger, bed);
    refuse(stranger, "horta:cebola", /ofício dos agricultores \(guilda Agricolae\)/);

    const far = sut.player("hans", { at: { x: 100, y: 99, z: 50 }, bag: kit });
    sut.api.openFarmPage(far, bed);
    far.position = { x: 150, y: 150, z: 50 };
    refuse(far, "horta:cebola", /Fique junto do canteiro/);

    const mounted = sut.player("hans", { bag: kit });
    sut.api.openFarmPage(mounted, bed);
    mounted.mounted = true;
    refuse(mounted, "horta:cebola", /Agora não dá/);

    const taken = sut.player("hans", { bag: kit });
    sut.api.openFarmPage(taken, bed);
    sut.api.plantFromPage(taken, "horta:cebola");
    sut.timer(9_000).fn();
    const other = sut.player("greta", { bag: kit, at: { x: 100, y: 99, z: 50 } });
    sut.api.openFarmPage(other, bed);
    const timers = sut.state.timers.length;
    assert.match(sut.api.plantFromPage(other, "horta:cebola"), /Este canteiro já está semeado/);
    assert.equal(sut.state.timers.length, timers, "a bed that has a plant is not dug again");
});

test("a farmer keeps a few beds at a time: so many at the start, one more every five levels of survival", () => {
    const sut = load();
    sut.api.farmSettings.baseBeds = 2;
    const hans = sut.player("hans", { bag: [{ item: SHOVEL, amount: 1 }, { item: seedOf(ONION), amount: 20 }] });
    const sow = (bedIndex, at) => {
        hans.position = at;
        sut.api.useBed(hans, bedIndex, T0);
        const why = sut.api.plantFromPage(hans, "horta:cebola");
        if (why === "") sut.timer(9_000).fn();
        return why;
    };
    assert.equal(sow(0, { x: 100, y: 99, z: 50 }), "");
    assert.equal(sow(1, { x: 110, y: 99, z: 50 }), "");
    assert.equal(sut.api.plotsOf("hans").length, 2);
    assert.match(sut.sentTo("hans", "craft.view").at(-1).payload.sub, /2 de 2 canteiros seus semeados/);
    const third = sut.sentTo("hans", "craft.view").at(-1).payload.recipes.find((row) => row.id === "horta:cebola");
    assert.equal(third.can, false, "the page says no to a third");
    assert.match(sow(2, { x: 300, y: 299, z: 60 }), /Você já cuida de 2 canteiros: colha um deles antes de semear outro/);

    // One more at level 5.
    const grown = sut.player("hans", { bag: [{ item: SHOVEL, amount: 1 }, { item: seedOf(ONION), amount: 20 }], level: 5, at: { x: 300, y: 299, z: 60 } });
    sut.api.useBed(grown, 2, T0);
    assert.equal(sut.api.plantFromPage(grown, "horta:cebola"), "");
    sut.api.farmSettings.baseBeds = 10;
});

test("walking off while digging, or any hurt, stops the sowing with nothing taken", () => {
    const sut = load();
    const hans = sut.player("hans", { bag: kit });
    sut.api.useBed(hans, 0, T0);
    sut.api.plantFromPage(hans, "horta:cebola");
    hans.position = { x: 105, y: 99, z: 50 };
    sut.timer(9_000).fn();
    assert.equal(sut.api.plotsOf("hans").length, 0, "nothing was sown");
    assert.equal(sut.state.bags.get(hans.id).find((row) => row.item === seedOf(ONION)).amount, 5, "and no seed was taken");
    assert.match(sut.sentTo("hans", "craft.result").at(-1).payload.text, /saiu do canteiro/);

    hans.position = { x: 100, y: 99, z: 50 };
    sut.api.plantFromPage(hans, "horta:cebola");
    sut.state.handlers.get("playerDamage")[0](hans);
    assert.equal(sut.api.isFarming(hans), false, "a blow stops it");
    assert.match(sut.sentTo("hans", "craft.result").at(-1).payload.text, /Você foi interrompido/);
    assert.equal(sut.state.timers.filter((one) => one.ms === 9_000).at(-1).cleared, true, "and its timer is cancelled");

    sut.api.plantFromPage(hans, "horta:cebola");
    sut.state.handlers.get("playerAnimationEnd")[0](hans, "Digging", "interrupted");
    assert.equal(sut.api.isFarming(hans), false, "the game cutting the animation short too");
    sut.api.plantFromPage(hans, "horta:cebola");
    assert.equal(sut.api.cancelPlanting(hans), true, "the page's Parar");
    assert.match(sut.sentTo("hans", "craft.result").at(-1).payload.text, /Plantio interrompido: nada foi gasto/);
    assert.equal(sut.api.cancelPlanting(hans), false, "nothing to stop twice");

    sut.api.plantFromPage(hans, "horta:cebola");
    sut.api.farmPageClosed(hans);
    assert.equal(sut.api.isFarming(hans), false, "closing the page gives the sowing up, for the animation holds the body");
});

test("a player busy with a trade's work or at a tree is not given a second job", () => {
    const sut = load();
    const hans = sut.player("hans", { bag: kit });
    sut.api.useBed(hans, 0, T0);
    sut.state.working = hans.id;
    assert.equal(sut.api.plantFromPage(hans, "horta:cebola"), "ocupado");
    sut.state.working = 0;
    sut.state.gathering = hans.id;
    assert.equal(sut.api.plantFromPage(hans, "horta:cebola"), "ocupado");
    assert.match(sut.sentTo("hans", "craft.result").at(-1).payload.text, /já está trabalhando/);
});

/** A farmer with an onion sown in Suchdol's first bed at T0. */
function sown() {
    const sut = load();
    const hans = sut.player("hans", { bag: kit });
    sut.api.useBed(hans, 0, T0);
    sut.api.plantFromPage(hans, "horta:cebola");
    sut.timer(9_000).fn();
    sut.state.emitted.length = 0;
    sut.state.chat.length = 0;
    return { sut, hans };
}

test("the plant grows with the time: small, then bigger, then ripe with the crop at its foot; the sower is told, and a mark is put on their map", () => {
    const { sut, hans } = sown();
    sut.state.clock.now = T0 + 5 * 60_000;
    sut.api.tickFarm(T0 + 5 * 60_000);
    assert.equal([...sut.state.props.values()][0].scale, 0.35, "the first stage until two fifths of the time");

    sut.api.tickFarm(T0 + 13 * 60_000);
    const grown = [...sut.state.props.values()];
    assert.equal(grown.length, 3);
    assert.ok(grown.every((prop) => prop.scale === 0.7), "the second stage");
    assert.equal(sut.state.blips.size, 0, "no mark before it is ripe");

    sut.state.clock.now = T0 + 31 * 60_000;
    sut.api.tickFarm(T0 + 31 * 60_000);
    const ripe = [...sut.state.props.values()];
    assert.equal(ripe.length, 4, "three plants and the produce at their foot");
    assert.ok(ripe.slice(0, 3).every((prop) => prop.scale === 1));
    assert.equal(ripe[3].model, ONION.produce);
    assert.match(sut.state.chat.at(-1), /A sua plantação de cebola na Horta de Suchdol está pronta para colher\./);
    assert.equal(sut.state.blips.size, 1, "a mark on their map");
    const blip = [...sut.state.blips.values()][0];
    assert.equal(blip.type, "Herbalist");
    assert.match(blip.label, /Cebola: pronta/);
    assert.equal(blip.player, hans, "private to the sower");
    assert.equal(sut.sentTo("hans", "farm.beds").at(-1).payload[0][5], 2, "the client is told the bed is ripe");
    sut.state.chat.length = 0;
    sut.api.tickFarm(T0 + 32 * 60_000);
    assert.deepEqual(sut.state.chat, [], "the word is said once");
    assert.equal(sut.state.blips.size, 1, "and the mark is not put twice");
});

test("E at a ripe bed picks it for six seconds (the herb picking), then gives the crop and seeds back, takes the plants away and puts the XP", () => {
    const { sut, hans } = sown();
    sut.api.tickFarm(T0 + 31 * 60_000);
    sut.state.clock.now = T0 + 31 * 60_000;
    sut.state.played.length = 0;
    sut.state.random = 0.4;
    assert.equal(sut.api.useBed(hans, 0, T0 + 31 * 60_000), "colhendo");
    assert.deepEqual(sut.state.played, [["PickingHerbs", { loop: true, lockMovement: true, props: undefined }]]);
    assert.deepEqual(sut.sentTo("hans", "farm.state").at(-1).payload, { on: true }, "the client is told, to say Parar and to stop at a step");
    sut.timer(6_000).fn();
    assert.deepEqual(sut.sentTo("hans", "farm.state").at(-1).payload, { on: false });
    assert.deepEqual(sut.state.added.slice(-2), [["Hans", ONION.harvest, 5], ["Hans", `guid:${ONION.seed}`, 2]], "five onions (4 to 6, the middle) and two seeds (the roll was under half)");
    assert.deepEqual(sut.state.xp.at(-1), ["hans", "survival", 6]);
    assert.equal(sut.api.plotsOf("hans").length, 0);
    assert.equal(sut.state.props.size, 0, "the plants are gone");
    assert.equal(sut.state.blips.size, 0, "and the mark");
    assert.match(sut.state.chat.at(-1), /Colheita: 5x Cebola e 2 sementes para semear de novo \(\+6 XP\)\./);
    assert.equal(sut.api.bedsFor(hans)[0][5], 0, "the bed is free again");
});

test("a harvest that does not fit the bag is not taken, and the bed keeps it; walking off from it leaves it too", () => {
    const { sut, hans } = sown();
    sut.state.clock.now = T0 + 31 * 60_000;
    sut.api.tickFarm(T0 + 31 * 60_000);
    sut.api.useBed(hans, 0, T0 + 31 * 60_000);
    sut.state.full = true;
    sut.timer(6_000).fn();
    assert.equal(sut.api.plotsOf("hans").length, 1, "still there");
    assert.match(sut.state.chat.at(-1), /não coube na sua bolsa/);
    sut.state.full = false;

    sut.api.useBed(hans, 0, T0 + 31 * 60_000);
    hans.position = { x: 106, y: 99, z: 50 };
    sut.timer(6_000).fn();
    assert.equal(sut.api.plotsOf("hans").length, 1);
    assert.match(sut.state.chat.at(-1), /saiu do canteiro: nada foi colhido/);
});

test("E at a growing bed says how long is left; at one sown by somebody else, that it is theirs; the ripe one of another cannot be picked", () => {
    const { sut, hans } = sown();
    assert.equal(sut.api.useBed(hans, 0, T0 + 10 * 60_000), "crescendo");
    assert.match(sut.state.chat.at(-1), /Cebola: faltam 20 min para colher/);
    const greta = sut.player("greta", { at: { x: 100, y: 99, z: 50 } });
    assert.equal(sut.api.useBed(greta, 0, T0 + 40 * 60_000), "de outro");
    assert.match(sut.state.chat.at(-1), /já foi semeado por outra pessoa/);
});

test("E again while picking stops it, and nothing is given; the page's own stop goes the same way", () => {
    const { sut, hans } = sown();
    sut.api.tickFarm(T0 + 31 * 60_000);
    sut.api.useBed(hans, 0, T0 + 31 * 60_000);
    assert.equal(sut.api.isFarming(hans), true);
    assert.equal(sut.api.useBed(hans, 0, T0 + 31 * 60_000), "parou");
    assert.equal(sut.api.isFarming(hans), false);
    assert.equal(sut.api.plotsOf("hans").length, 1, "the crop is still in the bed");
    sut.state.client.get("kcdc-gamemode:farm.stop")(hans);
    sut.api.useBed(hans, 0, T0 + 31 * 60_000);
    sut.state.client.get("kcdc-gamemode:farm.stop")(hans);
    assert.equal(sut.api.isFarming(hans), false, "the client's Parar");
});

test("a harvest forgotten for two days spoils: the bed is free again and the sower, if in, is told", () => {
    const { sut, hans } = sown();
    sut.api.tickFarm(T0 + 31 * 60_000);
    assert.equal(sut.api.tickFarm(T0 + 30 * 60_000 + 47 * 3_600_000), 0, "still good at 47 hours");
    assert.equal(sut.api.tickFarm(T0 + 30 * 60_000 + 49 * 3_600_000), 1);
    assert.equal(sut.api.plotsOf("hans").length, 0);
    assert.equal(sut.state.props.size, 0);
    assert.equal(sut.state.blips.size, 0);
    assert.match(sut.state.chat.at(-1), /A sua plantação de cebola na Horta de Suchdol passou do ponto e se perdeu\./);
    assert.ok(hans.ready);
});

test("the plantings are kept by Steam id and are there after a restart, shown again, ripening by the clock", () => {
    const { sut } = sown();
    const saved = JSON.parse(sut.disk.files.get("playerdata/farm.json"));
    assert.equal(saved.plots.length, 1);
    assert.equal(saved.plots[0].bed, "suchdol-1:1");
    assert.equal(saved.plots[0].owner, "hans");
    assert.equal(saved.plots[0].crop, "cebola");

    const after = load({ disk: sut.disk });
    assert.equal(after.api.plotsOf("hans").length, 1, "restored");
    assert.equal(after.state.props.size, 3, "the plants shown again");
    assert.ok(after.state.logs.some((line) => /farm: 2 horta\(s\) com 3 canteiro\(s\); 1 semeado\(s\)/.test(line)));

    const bad = fakeDisk({ "playerdata/farm.json": "{not json" });
    const broken = load({ disk: bad });
    assert.equal(broken.api.plotsOf("hans").length, 0, "a file that cannot be read is left alone, and nothing is planted from it");
    assert.ok(broken.state.logs.some((line) => /ilegível/.test(line)));
});

test("a returning player is sent the beds, and has the marks of what ripened while they were away; a change of guild is told at once", () => {
    const { sut, hans } = sown();
    sut.state.clock.now = T0 + 31 * 60_000;
    sut.api.tickFarm(T0 + 31 * 60_000);
    assert.equal(sut.state.blips.size, 1);
    sut.state.handlers.get("playerDisconnect")[0](hans);
    assert.equal(sut.state.blips.size, 0, "the marks go with the player");
    sut.state.online.length = 0;

    const back = sut.player("hans");
    sut.state.handlers.get("playerSpawned")[0](back);
    assert.equal(sut.sentTo("hans", "farm.beds").at(-1).payload[0][5], 2, "the bed is told ripe");
    assert.equal(sut.state.blips.size, 1, "and marked on the map again");
    const before = sut.sentTo("hans", "farm.beds").length;
    sut.state.guildListener("hans");
    assert.equal(sut.sentTo("hans", "farm.beds").length, before + 1, "a change of guild is told at once");
    sut.state.client.get("kcdc-gamemode:farm.ask")(back);
    assert.equal(sut.sentTo("hans", "farm.beds").length, before + 2, "and a client that starts late asks for them");
    const other = sut.player("stranger");
    sut.state.client.get("kcdc-gamemode:farm.ask")(other);
    assert.deepEqual(sut.sentTo("stranger", "farm.beds").at(-1).payload, [], "somebody who is nobody's farmer is sent none");
});

test("/horta: what the player has sown and when it is ready, the nearest gardens, and the administrator's ripening and clearing", () => {
    const { sut, hans } = sown();
    const mine = sut.api.farmSummary(hans, T0 + 10 * 60_000);
    assert.match(mine[0], /Hortas: 2 com 3 canteiros nas aldeias; 1 semeado\(s\) agora\./);
    assert.match(mine[0], /48 h depois de pronta/);
    assert.equal(mine[1], "Cebola na Horta de Suchdol: colheita em 20 min.");
    const empty = sut.api.farmSummary(sut.player("greta"), T0);
    assert.equal(empty[1], "Você não tem nada plantado.");

    const near = sut.api.nearestGardens(hans, 5);
    assert.equal(near.length, 2);
    assert.match(near[0], /^Horta de Suchdol: \d+ m a [a-z]+, 1 de 2 canteiro\(s\) livre\(s\)\.$/);
    assert.match(near[1], /^Horta de Wysoka: \d+ m a [a-z]+, 1 de 1 canteiro\(s\) livre\(s\)\.$/);

    assert.equal(sut.api.ripenAll(T0 + 1_000), 1);
    assert.equal(sut.api.bedsFor(hans, T0 + 2_000)[0][5], 2, "ripe at once");
    assert.equal(sut.api.clearAll(), 1);
    assert.equal(sut.api.plotsOf("hans").length, 0);
    assert.equal(sut.state.props.size, 0);
});

test("stopping the resource saves the plantings and takes the plants and the marks away, so a restart does not double them", () => {
    const { sut } = sown();
    sut.api.tickFarm(T0 + 31 * 60_000);
    assert.ok(sut.state.props.size > 0 && sut.state.blips.size === 1);
    for (const fn of sut.state.handlers.get("resourceStop")) fn("another-resource");
    assert.ok(sut.state.props.size > 0, "another resource's stop is not ours");
    for (const fn of sut.state.handlers.get("resourceStop")) fn("kcdc-gamemode");
    assert.equal(sut.state.props.size, 0);
    assert.equal(sut.state.blips.size, 0);
    assert.equal(JSON.parse(sut.disk.files.get("playerdata/farm.json")).plots.length, 1, "the planting itself stays");
});

test("an administrator marks a bed where they stand, its row running the way they look: a garden of its own, numbered after the nearest, seen at once by the farmers, kept on disk", () => {
    const sut = load();
    const hans = sut.player("hans", { bag: kit });
    const boss = sut.player("boss", { at: { x: 200, y: 200, z: 50 }, yaw: 90 });
    assert.equal(sut.api.bedsFor(hans).length, 3);
    const result = sut.api.markBed(boss, 3);
    assert.deepEqual(plain(result), { ok: true, name: "Horta de Suchdol 2", bed: "suchdol-2:1" }, "the nearest garden within 400 m gives the place and the next number");
    assert.equal(sut.data.beds.length, 4);
    const rows = plain(sut.sentTo("hans", "farm.beds").at(-1).payload);
    assert.equal(rows.length, 4, "the farmers are sent the list again");
    assert.deepEqual(rows[3], [200, 200, 50, 90, 3, 0], "its middle, the way it runs, its length, and free");
    const saved = JSON.parse(sut.disk.files.get("playerdata/farm-extra.json"));
    assert.deepEqual(saved.gardens, [{ id: "suchdol-2", name: "Horta de Suchdol 2", x: 200, y: 200, z: 50, yaw: 90, length: 3 }]);
    assert.ok(sut.state.logs.some((line) => /farm: Boss marcou o canteiro suchdol-2:1 \(Horta de Suchdol 2\) em 200 200, fileira de 3 m a 90 graus/.test(line)));

    // The same row a second time, or a length that makes no row, or a body not in the world.
    assert.match(sut.api.markBed(boss, 3).why, /Aqui já há um canteiro \(Horta de Suchdol 2\)/);
    boss.position = { x: 230, y: 200, z: 50 };
    assert.match(sut.api.markBed(boss, 1).why, /de 1,5 a 8 m/);
    assert.match(sut.api.markBed(boss, 9).why, /de 1,5 a 8 m/);
    boss.alive = false;
    assert.equal(sut.api.markBed(boss, 3).why, "Agora não dá.");
    boss.alive = true;
    assert.equal(sut.api.markBed(boss).ok, true, "three metres when no length is said");
    assert.equal(sut.data.gardens.at(-1).id, "suchdol-3");
    assert.equal(sut.data.beds.at(-1).length, 3);

    // A garden far from every other is "marcada".
    boss.position = { x: 5000, y: 5000, z: 10 };
    assert.deepEqual(plain(sut.api.markBed(boss, 2)), { ok: true, name: "Horta marcada 1", bed: "marcada-1:1" });
});

test("a marked bed is sown and harvested as any other, and is there after a restart with what was sown in it", () => {
    const disk = fakeDisk();
    const first = load({ disk });
    const hans = first.player("hans", { bag: kit });
    const boss = first.player("boss", { at: { x: 200, y: 200, z: 50 }, yaw: 90 });
    first.api.markBed(boss, 3);
    hans.position = { x: 200, y: 201, z: 50 };
    assert.equal(first.api.useBed(hans, 3, T0), "página", "the page of the plants opens at the marked bed");
    first.api.plantFromPage(hans, "horta:cebola");
    first.timer(9_000).fn();
    assert.equal(first.api.plotOf("suchdol-2:1").crop, "cebola");
    assert.match(first.state.chat.at(-1), /Plantado: cebola na Horta de Suchdol 2\./);

    const second = load({ disk });
    assert.equal(second.data.beds.length, 4, "the marked bed is read before the plantings");
    assert.equal(second.api.plotOf("suchdol-2:1").crop, "cebola", "and what was sown in it is not dropped for want of a bed");
    assert.equal(second.api.bedById("suchdol-2:1").yaw, 90);
});

test("a marked bed is taken away with what is sown in it; the level's own rows are not taken, and nothing near is said so", () => {
    const sut = load();
    const hans = sut.player("hans", { bag: kit });
    const boss = sut.player("boss", { at: { x: 200, y: 200, z: 50 } });
    sut.api.markBed(boss, 3);
    hans.position = { x: 200, y: 201, z: 50 };
    sut.api.useBed(hans, 3, T0);
    sut.api.plantFromPage(hans, "horta:cebola");
    sut.timer(9_000).fn();
    assert.equal(sut.state.props.size, 3, "the sprouts stand on the marked bed");

    boss.position = { x: 100, y: 100, z: 50 };
    assert.match(sut.api.unmarkBed(boss).why, /Nenhum canteiro marcado a até 4 m/, "beside a row of the level, which is not to be taken");
    boss.position = { x: 202, y: 200, z: 50 };
    assert.deepEqual(plain(sut.api.unmarkBed(boss)), { ok: true, name: "Horta de Suchdol 2", lost: "Hans" });
    assert.equal(sut.data.beds.length, 3);
    assert.equal(sut.state.props.size, 0, "its plants are taken down");
    assert.equal(sut.api.plotOf("suchdol-2:1"), null);
    assert.deepEqual(JSON.parse(sut.disk.files.get("playerdata/farm-extra.json")).gardens, []);
    assert.equal(sut.sentTo("hans", "farm.beds").at(-1).payload.length, 3, "the farmers are sent the shorter list");
    assert.match(sut.api.unmarkBed(boss).why, /Nenhum canteiro marcado/, "and a second time there is none");
});

function atGarden(bag, level = 0) {
    const sut = load();
    const hans = sut.player("hans", { bag, level });
    sut.api.useBed(hans, 0, T0);
    sut.state.emitted.length = 0;
    sut.state.chat.length = 0;
    return { sut, hans };
}

test("the work on the harvest: flax is spun into thread, grain milled and malted, two of a harvest kept as a seed -- at the garden, at once, with XP (2026-10-27)", () => {
    const { sut, hans } = atGarden([{ item: LINEN, amount: 5 }, { item: `guid:${WHEAT}`, amount: 3 }, { item: `guid:kcdc-craft:cevada`, amount: 1 }, { item: ONION.harvest, amount: 4 }], 3);
    assert.equal(sut.api.processFromPage(hans, "beneficiar:fiar-linha"), "");
    assert.deepEqual(sut.state.added.at(-1), ["Hans", "guid:kcdc-craft:linha", 3], "three reels of thread from one linen");
    assert.equal(sut.state.bags.get(hans.id).find((row) => row.item === LINEN).amount, 4);
    assert.deepEqual(sut.state.xp.at(-1), ["hans", "survival", 3]);
    assert.match(sut.state.chat.at(-1), /Feito: 3x Linha de costura \(\+3 XP\)\./);
    assert.equal(sut.sentTo("hans", "craft.result").at(-1).payload.ok, true);
    assert.equal(sut.sentTo("hans", "craft.view").length > 0, true, "and the page is sent again with what the bag holds now");

    // The next one waits a moment, so the game's view of the bag keeps up (2026-11-01: flour and malt made eleven times in three seconds could not be taken out of the bag).
    const added = sut.state.added.length;
    assert.equal(sut.api.processFromPage(hans, "beneficiar:moer-trigo"), "cedo");
    assert.match(sut.state.chat.at(-1), /Espere um instante/);
    assert.equal(sut.state.added.length, added, "nothing taken, nothing given");
    assert.equal(sut.state.bags.get(hans.id).find((row) => row.item === `guid:${WHEAT}`).amount, 3);
    sut.state.clock.now += sut.api.farmSettings.processGapMs;
    assert.equal(sut.api.processFromPage(hans, "beneficiar:moer-trigo"), "");
    assert.deepEqual(sut.state.added.at(-1), ["Hans", "guid:kcdc-craft:farinha", 1]);
    sut.state.clock.now += sut.api.farmSettings.processGapMs;
    assert.equal(sut.api.processFromPage(hans, "beneficiar:maltear-cevada"), "");
    assert.deepEqual(sut.state.added.at(-1), ["Hans", "guid:kcdc-craft:malte", 1]);
    sut.state.clock.now += sut.api.farmSettings.processGapMs;
    assert.equal(sut.api.processFromPage(hans, "beneficiar:semente-cebola"), "");
    assert.deepEqual(sut.state.added.at(-1), ["Hans", "guid:kcdc-craft:semente-cebola", 1], "two onions for a seed: a farmer needs no vendor for one");
    assert.equal(sut.state.bags.get(hans.id).find((row) => row.item === ONION.harvest).amount, 2);
});

test("the work on the harvest is the farmers' and asks for the level, the garden at hand and all it takes; a full bag gives the ingredients back", () => {
    const stranger = atGarden([{ item: LINEN, amount: 5 }]);
    stranger.hans.steamId = "stranger";
    assert.match(stranger.sut.api.whyNotProcess(stranger.hans, { ingredients: [[LINEN, 1]], level: 0 }), /dos agricultores/);

    const low = atGarden([{ item: `guid:${WHEAT}`, amount: 2 }], 0);
    assert.match(low.sut.api.processFromPage(low.hans, "beneficiar:moer-trigo"), /nível 1/, "milling asks for the first level");
    assert.deepEqual(low.sut.state.added, []);

    const empty = atGarden([]);
    assert.match(empty.sut.api.processFromPage(empty.hans, "beneficiar:fiar-linha"), /^Falta: 1x Linho \(tem 0\)\./);

    const away = atGarden([{ item: LINEN, amount: 2 }]);
    away.hans.position = { x: 200, y: 200, z: 50 };
    assert.match(away.sut.api.processFromPage(away.hans, "beneficiar:fiar-linha"), /junto do canteiro/);
    const noPage = load();
    const walker = noPage.player("hans", { bag: [{ item: LINEN, amount: 2 }] });
    assert.match(noPage.api.processFromPage(walker, "beneficiar:fiar-linha"), /junto do canteiro/, "no page was opened at a garden");

    const busy = atGarden([{ item: LINEN, amount: 2 }]);
    busy.sut.state.working = busy.hans.id;
    assert.equal(busy.sut.api.processFromPage(busy.hans, "beneficiar:fiar-linha"), "ocupado");
    assert.equal(busy.sut.api.processFromPage(busy.hans, "beneficiar:nada"), "desconhecido");

    const full = atGarden([{ item: LINEN, amount: 2 }]);
    full.sut.state.fullFor = "guid:kcdc-craft:linha";
    assert.equal(full.sut.api.processFromPage(full.hans, "beneficiar:fiar-linha"), "sem lugar");
    assert.equal(full.sut.state.bags.get(full.hans.id).find((row) => row.item === LINEN).amount, 2, "the linen is back: nothing was spent");
    assert.match(full.sut.state.chat.at(-1), /não coube no seu inventário/);
    assert.deepEqual(full.sut.state.xp, [], "and no XP");
});

test("a crop of ours is harvested as the class the game knows it by (the wheat), with its seeds", () => {
    const sut = load();
    const hans = sut.player("hans", { bag: [{ item: SHOVEL, amount: 1 }, { item: `guid:${WHEAT.replace("trigo", "semente-trigo")}`, amount: 2 }], level: 1 });
    sut.api.useBed(hans, 0, T0);
    assert.equal(sut.api.plantFromPage(hans, "horta:trigo"), "");
    sut.timer(9_000).fn();
    assert.equal(sut.api.plotsOf("hans").length, 1);
    sut.state.clock.now = T0 + 46 * 60_000;
    sut.api.tickFarm(T0 + 46 * 60_000);
    sut.state.random = 0.4;
    assert.equal(sut.api.useBed(hans, 0, T0 + 46 * 60_000), "colhendo");
    sut.timer(6_000).fn();
    assert.deepEqual(sut.state.added.slice(-2), [["Hans", "guid:kcdc-craft:trigo", 5], ["Hans", "guid:kcdc-craft:semente-trigo", 2]], "five wheat (4 to 6, the middle) and two seeds");
});

test("the work on the harvest may be done up to ten times at once (2026-10-27): the ingredients, the product and the XP are each that many times over, and the page's row says it can", () => {
    const { sut, hans } = atGarden([{ item: LINEN, amount: 7 }], 3);
    assert.equal(sut.api.processFromPage(hans, "beneficiar:fiar-linha", 4), "");
    assert.deepEqual(sut.state.added.at(-1), ["Hans", "guid:kcdc-craft:linha", 12], "four linens, twelve reels of thread");
    assert.equal(sut.state.bags.get(hans.id).find((one) => one.item === LINEN).amount, 3);
    assert.deepEqual(sut.state.xp.at(-1), ["hans", "survival", 12], "three XP each");
    assert.match(sut.state.chat.at(-1), /Feito: 12x Linha de costura \(\+12 XP\)\./);

    assert.match(sut.api.processFromPage(hans, "beneficiar:fiar-linha", 5), /^Falta: 5x Linho \(tem 3\)\./, "the whole order is asked for at the start: nothing is half done");
    assert.equal(sut.state.bags.get(hans.id).find((one) => one.item === LINEN).amount, 3);
    assert.match(sut.api.processFromPage(hans, "beneficiar:fiar-linha", 99), /^Falta: 10x Linho \(tem 3\)\./, "a number past ten is ten");

    const view = plain(sut.sentTo("hans", "craft.view").at(-1).payload);
    assert.equal(view.recipes.find((one) => one.id === "beneficiar:fiar-linha").batch, true, "its row is one the page may ask a number of");
    assert.equal(view.recipes.find((one) => one.id === "horta:cebola").batch, undefined, "and a crop's is not");
});

test("a long row shows five plants and a short one three, spread along it (2026-10-27: the fields were made longer)", () => {
    const sut = load();
    const long = { id: "x:1", garden: "x", x: 100, y: 100, z: 50, yaw: 0, length: 8 };
    const spots = sut.api.plantSpots(long);
    assert.equal(spots.length, 5);
    assert.deepEqual(plain(spots.map((spot) => Math.round(spot.y * 10) / 10)), [96.8, 98.4, 100, 101.6, 103.2], "over six and a half metres of the eight");
    const short = { ...long, length: 5 };
    assert.equal(sut.api.plantSpots(short).length, 3, "five metres is still a short row");
});

test("the harvest of a long bed is more, the pace of the trades is paid in the garden too: four times the crop's XP on the harvest, and the sowing's (the standard of 2026-11-03)", () => {
    profession.useStandard();
    try {
        const { sut, hans } = sown();
        sut.api.tickFarm(T0 + 31 * 60_000);
        sut.state.clock.now = T0 + 31 * 60_000;
        sut.state.random = 0.4;
        sut.api.useBed(hans, 0, T0 + 31 * 60_000);
        sut.timer(6_000).fn();
        assert.deepEqual(sut.state.xp.at(-1), ["hans", "survival", 24], "the onion's 6, four times");
        assert.match(sut.state.chat.at(-1), /\(\+24 XP\)\./);
        assert.ok(sut.state.xp.some((row) => row[2] === 8), "and the sowing's 2, four times, before it");
        sut.api.useBed(hans, 0, T0 + 32 * 60_000);
        const planting = sut.sentTo("hans", "craft.view").at(-1).payload.recipes.find((row) => row.id === "horta:cebola");
        assert.equal(planting.xp, 24, "the page says what the harvest will give");
    } finally {
        profession.useTables();
    }
});

test("an administrator marks a field: rows side by side, a row and a half metres apart, the first where they stand and the others to their right, none on a bed already there (2026-10-27)", () => {
    const sut = load();
    const hans = sut.player("hans", { bag: kit });
    const boss = sut.player("boss", { at: { x: 200, y: 200, z: 50 }, yaw: 90 });
    assert.equal(sut.api.bedsFor(hans).length, 3);
    const field = sut.api.markField(boss, 3, 8);
    assert.deepEqual(plain(field), { ok: true, made: 3, skipped: 0, first: "Horta de Suchdol 2", last: "Horta de Suchdol 4" });
    assert.equal(sut.data.beds.length, 6);
    const rows = plain(sut.sentTo("hans", "farm.beds").at(-1).payload);
    assert.equal(rows.length, 6, "the farmers are sent the list once, after the last row");
    assert.deepEqual(rows.slice(3), [[200, 200, 50, 90, 8, 0], [200, 201.6, 50, 90, 8, 0], [200, 203.2, 50, 90, 8, 0]], "to the right of a way that points to yaw 90 is +y");
    const saved = JSON.parse(sut.disk.files.get("playerdata/farm-extra.json"));
    assert.equal(saved.gardens.length, 3);
    assert.equal(sut.sentTo("hans", "farm.beds").length, 1, "one list for the whole field, not one for each row");

    // The same field again lies on the first: nothing is made and the administrator is told.
    assert.deepEqual(plain(sut.api.markField(boss, 3, 8)), { ok: false, why: "Aqui já há canteiros: ande para um chão livre." });
    // Moved along the rows, half of it is new.
    boss.position = { x: 200, y: 203.2, z: 50 };
    const more = sut.api.markField(boss, 3, 8);
    assert.equal(more.ok, true);
    assert.equal(more.made, 2);
    assert.equal(more.skipped, 1, "the first of them lay on the last of the other field");
});

test("a field has two to twelve rows, each of the length of a row, and an administrator in the world (2026-10-27)", () => {
    const sut = load();
    const boss = sut.player("boss", { at: { x: 5000, y: 5000, z: 10 }, yaw: 0 });
    assert.match(sut.api.markField(boss, 1, 8).why, /de 2 a 12 fileiras/);
    assert.match(sut.api.markField(boss, 13, 8).why, /de 2 a 12 fileiras/);
    assert.match(sut.api.markField(boss, 2.5, 8).why, /de 2 a 12 fileiras/);
    assert.match(sut.api.markField(boss, 4, 9).why, /de 1,5 a 8 m/);
    boss.alive = false;
    assert.equal(sut.api.markField(boss, 4, 8).why, "Agora não dá.");
    boss.alive = true;
    const field = sut.api.markField(boss);
    assert.equal(field.ok, true);
    assert.equal(field.made, 6, "six rows of eight metres when nothing is said");
    assert.equal(sut.data.beds.at(-1).length, 8);
    assert.equal(sut.data.gardens.at(-1).id, "marcada-6");
});

test("the level's own rows are made longer when the file is read: twice, up to eight metres; a row that is long already is left", () => {
    const { stretched, FIELD } = require("node:vm").runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/farm-data.js"), "utf8").replace(/^"use strict";/, "") + ";({ stretched: exports.stretched, FIELD: exports.FIELD })", { exports: {}, require });
    assert.deepEqual(plain(FIELD), { stretch: 2, maxM: 8 });
    const data = { gardens: [{ id: "g-1", name: "G", x: 0, y: 0, z: 0, beds: [{ id: "g-1:1", garden: "g-1", x: 0, y: 0, z: 0, yaw: 0, length: 4 }, { id: "g-1:2", garden: "g-1", x: 1, y: 0, z: 0, yaw: 0, length: 6 }, { id: "g-1:3", garden: "g-1", x: 2, y: 0, z: 0, yaw: 0, length: 1.6 }] }], beds: [], meadows: [{ x: 1, y: 2, z: 3 }] };
    const out = stretched(data);
    assert.deepEqual(plain(out.gardens[0].beds.map((bed) => bed.length)), [8, 8, 3.2], "four becomes eight, six is held at eight, a short one doubles");
    assert.equal(out.beds.length, 3, "the flat list follows");
    assert.deepEqual(plain(out.beds.map((bed) => bed.id)), ["g-1:1", "g-1:2", "g-1:3"], "and the ids are the same: what was sown is still there");
    assert.deepEqual(plain(out.meadows), [{ x: 1, y: 2, z: 3 }]);
});
