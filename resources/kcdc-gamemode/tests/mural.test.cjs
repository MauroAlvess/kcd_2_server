"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

// The notice boards (src/server/mural.ts and mural-places.ts, 2026-10-24): the frames the World Builder put in the villages and towns that have a coach, and the letters
// pinned to them for ten coins and seven days.

const FILE = "playerdata/mural.json";
const PUBLISH = "kcdc-gamemode:mural.publish";
const REMOVE = "kcdc-gamemode:mural.remove";
const CLOSED = "kcdc-gamemode:mural.closed";
const RESULT = "kcdc-gamemode:mural.result";
const CLOSE = "kcdc-gamemode:mural.close";
const plain = (value) => JSON.parse(JSON.stringify(value));
const DAY = 86_400_000;
const STEAM = "76561198000000001";
const OTHER = "76561198000000002";
const THIRD = "76561198000000003";

/** The directory of compiled modules, loaded one by one with the requires they need. */
function run(file, requires, extra = {}) {
    const context = {
        exports: {},
        require: (id) => requires[id] ?? assert.fail(`unexpected require ${id} in ${file}`),
        console: { log: (line) => extra.logs?.push(line) },
        Date, JSON, Object, Number, Set, Map, Math, Array, String,
        ...extra.globals,
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server", file), "utf8"), context);
    return context.exports;
}

/** The towns the board tests know (the real list is `citizenship.ts`'s): the id of a board's place is its town's. */
const TOWNS_FOR_TESTS = [
    { id: "suchdol", name: "Suchdol", crest: "town-suchdol.webp", crestUrl: "", lord: "Gunther", family: "Von Capon", consort: { label: "Lady", name: "Ludmilla", courtesy: true, text: "" }, seatName: null, lands: ["Wysoka"], citizens: 3, npcs: 7 },
    { id: "raborsch", name: "Raborsch", crest: "", crestUrl: "https://exemplo.com/brasao.png", lord: null, family: null, consort: null, seatName: null, lands: [], citizens: 0, npcs: 4 },
    { id: "minas", name: "Minas", crest: "town-suchdol.webp", crestUrl: "", lord: null, family: null, consort: null, seatName: "Pschitoky", lands: [], citizens: 1, npcs: 2 },
];

function load({ saved = null, characters = {}, wallets = {}, diskFails = false, lang = "pt", admins = [], towns = TOWNS_FOR_TESTS, citizen = {}, closed = [], wars = {}, free = true, chooseResult = { ok: true, message: "Você agora é cidadão de Suchdol: quando morrer, é lá que você acorda." }, lords = [] } = {}) {
    const files = new Map();
    if (saved !== null) files.set(FILE, typeof saved === "string" ? saved : JSON.stringify(saved));
    const disk = {
        readFileSync(file) {
            if (!files.has(file)) throw new Error("ENOENT");
            return files.get(file);
        },
        writeFileSync(file, data) {
            if (diskFails && file.endsWith(".tmp")) throw new Error("disk full");
            files.set(file, data);
        },
        mkdirSync() {},
        renameSync(from, to) { files.set(to, files.get(from)); files.delete(from); },
        existsSync: (file) => files.has(file),
    };
    const logs = [];
    const store = run("store.js", { "node:fs": disk }, { logs });
    // The real reach table and the real boards' module.
    const reach = run("reach.js", {});
    const places = run("mural-places.js", { "./reach.js": reach, "./level.js": { onKuttenberg: () => true } }, { logs, globals: { WorldResource: { ready: true, all: () => [] }, Events: { once() {} } } });
    const state = { logs, players: [], handlers: new Map(), client: new Map(), intervals: [], characters, wallets: { ...wallets }, art: 0, chat: [], towns, citizen: { ...citizen }, closed: [...closed], wars, free, chooseResult, chosen: [], social: [], lords: [...lords] };
    const money = {
        MONEY_UNIT: 10,
        moneyOf: (player) => state.wallets[player.id] ?? 0,
        takeMoney: (player, units) => {
            if ((state.wallets[player.id] ?? 0) < units) return false;
            state.wallets[player.id] -= units;
            return true;
        },
        giveMoney: (player, units) => { state.wallets[player.id] = (state.wallets[player.id] ?? 0) + units; return true; },
    };
    const mural = run("mural.js", {
        "./acquaintances.js": { nameOf: (player) => player.charName ?? player.nickname },
        "./auth.js": { isAdmin: (player) => admins.includes(player.id) },
        "./big-emit.js": { emitLarge: (player, name, json) => player.large.push({ name, data: JSON.parse(json) }) },
        "./characters.js": { getCharacter: (steamId) => state.characters[steamId] ?? null },
        "./craft-titles.js": { craftTitle: (key) => { state.art += 1; return key === "cartaz-recursos" ? "" : `data:image/webp;base64,${key}`; } },
        // The towns (`citizenship.ts`, tested on its own): what a town's card holds, who is a citizen of which, who may depose (a lord, an administrator) and what `choose` answers.
        "./citizenship.js": {
            townById: (id) => state.towns.find((town) => town.id === id) ?? null,
            townOf: (steamId) => state.citizen[steamId] ?? null,
            isClosed: (town) => state.closed.includes(town.id),
            mayDepose: (player, town) => admins.includes(player.id) || state.lords.includes(player.id),
            choose: (player, id) => { state.chosen.push([player.id, id]); return state.chooseResult; },
            townView: (town) => ({ ...town, closed: state.closed.includes(town.id) }),
        },
        "./free-changes.js": { CHANGE_PRICE_COINS: 100, freeChangeLeft: () => state.free },
        "./status.js": { sendSocial: (player) => state.social.push(player.id) },
        "./wars.js": { opponentsOf: (id) => state.wars[id] ?? [] },
        "./language.js": { languageOf: () => lang, translate: (text, to) => (to === "en" ? `EN:${text}` : text) },
        "./money.js": money,
        "./mural-places.js": places,
        "./store.js": store,
        // The text rules shared with the letters (2026-11-02): the real ones.
        "./text-style.js": run("text-style.js", {}),
    }, {
        logs,
        globals: {
            Player: { all: () => state.players },
            Events: { on: (name, fn) => state.handlers.set(name, fn), onClient: (name, fn) => state.client.set(name, fn) },
            setInterval: (fn, ms) => { state.intervals.push({ fn, ms }); return state.intervals.length; },
            clearInterval() {},
        },
    });
    const player = (id, steamId, extra = {}) => {
        const sent = [];
        const large = [];
        const made = { id, steamId, nickname: `Jogador${id}`, ready: true, alive: true, position: { x: 583.3, y: 3256, z: 147.2 }, sent, large, emit(name, payload) { sent.push({ name, payload: JSON.parse(payload) }); }, ...extra };
        state.players.push(made);
        return made;
    };
    return { mural, places, reach, state, files, player };
}

/** A marker as the export has it: a scroll under the ground, a hand's breadth below the surface. */
const marker = (x, y, z) => ({ model: "objects/manmade/task_specific_props/read_and_write/scrolls/scroll_c.cgf", position: { x, y, z } });
// Suchdol's, Kuttenberg's and Raborsch's, where the user left them.
const BOARDS = [marker(583.3, 3254.1, 146.45), marker(3157.6, 701.2, 52.85), marker(1578.1, 3821.5, 113.55)];
const made = (createdAt = 1000) => ({ appearance: {}, nickname: "x", createdAt, updatedAt: createdAt });
const poster = (over = {}) => ({ board: "suchdol", category: "avisos", title: "Feira no sábado", body: "Haverá feira na praça no sábado.", anonymous: false, style: {}, ...over });

/** A load with the boards in place, a player at Suchdol's with a character and plenty of coins, the module installed. */
function ready(over = {}) {
    const sut = load({ characters: { [STEAM]: made(), [OTHER]: made(), [THIRD]: made() }, wallets: { 1: 5000, 2: 5000, 3: 5000 }, ...over });
    sut.places.setBoards(sut.places.boardsOf(BOARDS));
    sut.mural.installMural();
    const hans = sut.player(1, STEAM, { charName: "Hans Capon" });
    return { sut, hans };
}

const send = (sut, name, player, payload) => sut.state.client.get(name)(player, JSON.stringify(payload));
const answers = (player) => player.sent.filter((entry) => entry.name === RESULT).map((entry) => entry.payload);

// ---------------------------------------------------------------------------------------------
// The boards the export gives.

test("a marker is a board, named after the place it stands in: the village or town, its castle's walls and gate included; two in one place are one list", () => {
    const { places } = load();
    const boards = places.boardsOf([
        ...BOARDS,
        marker(576.9, 312.6, 109.95), // Malešov's village, where the user moved what had been the castle's
        marker(582.5, 247.2, 108.65), // and its own
        marker(500, 360, 110), // inside the castle's walls: the village's, not a castle's of its own
        marker(1431, 3878.9, 116.75), // the gate of Raborsch's castle, where the first board stood
        marker(1006.3, 1102, 88.05), // two metres outside Rabstein's ground, still Rabstein's
        marker(3000, 3000, 100), // nowhere
    ]);
    assert.deepEqual(plain(boards.map((board) => [board.id, board.name])), [
        ["suchdol", "Suchdol"],
        ["kuttenberg", "Kuttenberg"],
        ["raborsch", "Raborsch"],
        ["malesov", "Malešov"],
        ["malesov", "Malešov"],
        ["malesov", "Malešov"],
        ["raborsch", "Raborsch"],
        ["rabstein", "Rabstein"],
        ["quadro-3000-3000", "Quadro de avisos"],
    ]);
    assert.ok(Math.abs(boards[0].z - 146.9) < 1e-9, "the ground over the marker: where it was buried");
    assert.deepEqual(plain(places.boardsOf([{ model: "objects/manmade/structures/logistical/fences/fence_rural_post_a.cgf", position: { x: 585, y: 3255, z: 147 } }])), [], "any other piece is not a board");
});

test("a board is within reach of a player standing in front of it, not of one who is far or on another floor", () => {
    const { places, reach } = load();
    places.setBoards(places.boardsOf(BOARDS));
    assert.equal(places.boardNear({ x: 583.3, y: 3257, z: 147 })?.id, "suchdol");
    assert.equal(places.boardNear({ x: 583.3, y: 3258.2, z: 147 })?.id, "suchdol", "up to the reach the server allows");
    assert.equal(places.boardNear({ x: 583.3, y: 3262, z: 147 }), null);
    assert.equal(places.boardNear({ x: 583.3, y: 3255, z: 157 }), null, "ten metres above");
    assert.equal(places.MURAL_REACH_M, reach.allowedTo(reach.EDGE_M.mural));
    assert.equal(places.PROMPT_M, reach.reachTo(reach.EDGE_M.mural));
    assert.equal(places.boardsWithin({ x: 590, y: 3250 }, 50).length, 1);
    assert.equal(places.boardsWithin({ x: 590, y: 3250 }, 5000).length, 3);
});

test("the places are the villages and the towns, no castle among them; no two share an id, and every board of the user's export is in one", () => {
    const { places } = load();
    const ids = places.PLACES.map((one) => one.id);
    assert.equal(new Set(ids).size, ids.length);
    assert.ok(places.PLACES.every((one) => one.castle === undefined), "a castle is no place of its own (user, 2026-10-24: no boards in the castles)");
    for (const id of ["suchdol", "raborsch", "malesov", "kuttenberg"]) assert.ok(ids.includes(id), id);
    assert.equal(ids.length, 17);
    assert.ok(ids.includes("zikmundovo"), "Sigismund's camp, mapped by the user on 2026-10-25");
    // The 13 boards as the user left them (the export's markers, 2026-10-25: the castles' and the coachless villages' taken out, Malešov's two made one at the
    // spot the user chose for the castle's, and one put up in Zikmundovo at the crossing of its camp).
    const exported = [
        [583.3, 3254.1, "suchdol"], [1578.1, 3821.5, "raborsch"], [576.9, 312.6, "malesov"], [3221.9, 2271.8, "grunta"], [1986.0, 3433.2, "bohunowitz"],
        [1559.0, 1982.5, "miskowitz"], [2303.9, 1821.5, "pschitoky"], [2583.8, 2617.1, "horschan"], [3157.6, 701.2, "kuttenberg"], [3073.8, 1360.7, "stara-kutna"],
        [1609.4, 2793.2, "zikmundovo"], [1743.8, 1081.6, "bylany"], [378.9, 2445.9, "wysoka"],
    ];
    for (const [x, y, id] of exported) assert.equal(places.placeOf(x, y)?.id, id, `${x}, ${y}`);
    // The old castle boards' spots are the villages' ground now.
    assert.equal(places.placeOf(791.4, 3345.4)?.id, "suchdol");
    assert.equal(places.placeOf(1431.0, 3878.9)?.id, "raborsch");
    assert.equal(places.placeOf(3000, 3000), null);
});

test("on Trosky the places of the boards are the grounds of the catalog's regions, and each one's id is its town's (user, 2026-11-09: a board in every place)", () => {
    const reach = run("reach.js", {});
    const places = run("mural-places.js", { "./reach.js": reach, "./level.js": { onKuttenberg: () => false } }, { globals: { WorldResource: { ready: true, all: () => [] }, Events: { once() {} } } });
    const catalog = fs.readFileSync(path.join(__dirname, "../src/server/properties.ts"), "utf8");
    const towns = fs.readFileSync(path.join(__dirname, "../src/server/citizenship.ts"), "utf8");
    const ids = places.PLACES.map((one) => one.id);
    assert.equal(new Set(ids).size, ids.length);
    assert.deepEqual(plain(ids), ["semine", "nebakov", "trosky", "acampamento-nomade", "zhelejov", "troskowitz", "tachov", "apolonia", "slatego", "schdiar", "vidlak"]);
    const block = catalog.slice(catalog.indexOf("export const TROSKY_REGIONS"), catalog.indexOf("\n];", catalog.indexOf("export const TROSKY_REGIONS")));
    const starts = ids.map((id) => block.indexOf(`id: "${id}",`));
    assert.ok(starts.every((at, index) => at >= 0 && (index === 0 || at > starts[index - 1])), "the regions are in the catalog in the places' order");
    for (const [index, place] of places.PLACES.entries()) {
        // the box is the one round the catalog's region and its compounds (mills, inn, farms), so a region moved there moves its board's place too
        const text = block.slice(starts[index], index + 1 < starts.length ? starts[index + 1] : block.length);
        const found = text.match(/name: "[^"]+",\s*minX: (\d+),\s*maxX: (\d+),\s*minY: (\d+),\s*maxY: (\d+)/);
        assert.ok(found, `${place.id} is a region of the catalog`);
        const boxes = [{ minX: Number(found[1]), maxX: Number(found[2]), minY: Number(found[3]), maxY: Number(found[4]) }];
        for (const compound of text.matchAll(/box: \{ minX: (\d+), maxX: (\d+), minY: (\d+), maxY: (\d+) \}/g)) boxes.push({ minX: Number(compound[1]), maxX: Number(compound[2]), minY: Number(compound[3]), maxY: Number(compound[4]) });
        const round = { minX: Math.min(...boxes.map((box) => box.minX)), maxX: Math.max(...boxes.map((box) => box.maxX)), minY: Math.min(...boxes.map((box) => box.minY)), maxY: Math.max(...boxes.map((box) => box.maxY)) };
        assert.deepEqual(plain(place.box), round, place.id);
        const middle = { x: (place.box.minX + place.box.maxX) / 2, y: (place.box.minY + place.box.maxY) / 2 };
        assert.equal(places.placeOf(middle.x, middle.y)?.id, place.id, `${place.id}: a point in its middle is its`);
    }
    // the eight towns of Trosky's citizenship are all places (so their boards' decrees are theirs); the three that are no town (Slatego, Schdiar, Vidlak) have a board but no decree
    const trosky = towns.slice(towns.indexOf("export const TROSKY_TOWNS"));
    const townIds = [...trosky.slice(0, trosky.indexOf("\n];")).matchAll(/\{ id: "([a-z-]+)", region:/g)].map((match) => match[1]);
    assert.ok(townIds.length >= 8, "the towns were read");
    assert.equal(townIds.length, 8);
    for (const id of townIds) assert.ok(ids.includes(id), `${id} is a town of Trosky and has a place for its board`);
    assert.equal(places.placeOf(100, 100), null);
});

test("the user's boards of Trosky (worlds/quadros-trosky.world.json): one in each of the 11 places, each named by the place it stands in (2026-11-09)", (context) => {
    const file = path.join(__dirname, "../../../worlds/quadros-trosky.world.json");
    if (!fs.existsSync(file)) {
        context.skip("the worlds folder is not beside the gamemode (the staging copy)");
        return;
    }
    const reach = run("reach.js", {});
    const places = run("mural-places.js", { "./reach.js": reach, "./level.js": { onKuttenberg: () => false } }, { globals: { WorldResource: { ready: true, all: () => [] }, Events: { once() {} } } });
    const world = JSON.parse(fs.readFileSync(file, "utf8"));
    assert.equal(world.level, "trosecko");
    const boards = places.boardsOf(world.objects.map((one) => ({ model: one.model, position: { x: one.position[0], y: one.position[1], z: one.position[2] } })));
    assert.deepEqual(plain(boards.map((board) => board.id).sort()), plain(places.PLACES.map((place) => place.id).sort()), "one board in each place, none outside them");
    for (const board of boards) assert.ok(board.z > 0, `${board.id}: a ground height`);
});

test("the boards the world file puts up stand only in villages and towns that have a coach stop, never in a castle (user, 2026-10-24)", (context) => {
    const file = path.join(__dirname, "../../../worlds/quadros-de-aviso.world.json");
    if (!fs.existsSync(file)) {
        context.skip("the worlds folder is not beside the gamemode (the staging copy)");
        return;
    }
    const { places } = load();
    const world = JSON.parse(fs.readFileSync(file, "utf8"));
    const boards = places.boardsOf(world.objects.map((one) => ({ model: one.model, position: { x: one.position[0], y: one.position[1], z: one.position[2] } })));

    const travel = fs.readFileSync(path.join(__dirname, "../src/server/travel.ts"), "utf8");
    const start = travel.indexOf("export const STOPS");
    const block = travel.slice(start, travel.indexOf("\n];", start));
    const stops = new Set([...block.matchAll(/^ {8}id: "([a-z-]+)",/gm)].map((match) => (match[1] === "old-kutna" ? "stara-kutna" : match[1])));
    assert.ok(stops.size >= 13, "the coach stops were read");

    assert.equal(boards.length, 13);
    for (const board of boards) {
        assert.ok(stops.has(board.id), `${board.id} has no coach stop (or is a castle): its board does not belong`);
        assert.ok(places.PLACES.some((one) => one.id === board.id), `${board.id} is not a mapped place`);
    }
    assert.deepEqual(plain(boards.map((board) => board.id).sort()), ["bohunowitz", "bylany", "grunta", "horschan", "kuttenberg", "malesov", "miskowitz", "pschitoky", "raborsch", "stara-kutna", "suchdol", "wysoka", "zikmundovo"], "one board for each of thirteen places");
});

// ---------------------------------------------------------------------------------------------
// Opening a board.

test("a player at a board is sent the pictures once and the board's letters, newest first, each with whether it is theirs", () => {
    const { sut, hans } = ready();
    const other = sut.player(2, OTHER, { charName: "Radovan" });
    assert.equal(sut.mural.publish(hans, poster({ title: "Primeiro" }), 1_000_000).ok, true);
    assert.equal(sut.mural.publish(other, poster({ title: "Segundo", anonymous: true }), 1_100_000).ok, true);
    other.large.length = 0;
    hans.large.length = 0;

    assert.deepEqual(plain(sut.mural.openMural(hans, false, 1_200_000)), { ok: true, message: "" });
    assert.deepEqual(hans.large.map((one) => one.name), ["mural.art", "mural.view"]);
    assert.deepEqual(Object.keys(hans.large[0].data).sort(), ["avisos", "mural", "procurado"], "the kind with no picture is left out; the page draws its name");
    const view = hans.large[1].data;
    assert.deepEqual(plain(view.board), { id: "suchdol", name: "Suchdol" });
    assert.equal(view.fee, 10);
    assert.equal(view.days, 7);
    assert.equal(view.coins, 500 - 10 - 0, "the screen's coins: a tenth of the item");
    assert.equal(view.admin, false);
    assert.equal(view.lang, "pt");
    assert.deepEqual(view.posters.map((one) => [one.t, one.mine, one.an, one.n]), [["Segundo", false, true, ""], ["Primeiro", true, false, "Hans Capon"]], "newest first; the anonymous one has no name in it");
    assert.ok(!JSON.stringify(view).includes(STEAM) && !JSON.stringify(view).includes(OTHER), "no account ever goes to a page");

    // With the pictures already there, only the board.
    hans.large.length = 0;
    sut.mural.openMural(hans, true, 1_200_000);
    assert.deepEqual(hans.large.map((one) => one.name), ["mural.view"]);
});

test("far from every board, or dead, nothing opens, and the player is told why", () => {
    const { sut, hans } = ready();
    hans.position = { x: 600, y: 3300, z: 147 };
    assert.deepEqual(plain(sut.mural.openMural(hans)), { ok: false, message: "Não há quadro de avisos por perto." });
    assert.deepEqual(hans.large, []);
    hans.position = { x: 583.3, y: 3256, z: 147 };
    hans.alive = false;
    assert.deepEqual(plain(sut.mural.openMural(hans)), { ok: false, message: "" });
});

test("the prompt's press carries the board's kind and says whether the client has the pictures", () => {
    const { sut } = ready();
    assert.equal(sut.mural.MURAL_KIND, 7);
    assert.deepEqual(plain(sut.mural.muralAsked({ kind: 7, x: 1, y: 2, art: true })), { haveArt: true });
    assert.deepEqual(plain(sut.mural.muralAsked(JSON.stringify({ kind: 7 }))), { haveArt: false });
    assert.equal(sut.mural.muralAsked({ kind: 3 }), null);
    assert.equal(sut.mural.muralAsked("not json"), null);
    assert.equal(sut.mural.muralAsked(null), null);
    const points = sut.mural.muralPointsWithin({ x: 590, y: 3250 }, 100);
    assert.deepEqual(plain(points).map((point) => point.map((value) => Math.round(value * 10) / 10)), [[7, 583.3, 3254.1, 146.9]]);
});

// ---------------------------------------------------------------------------------------------
// Putting a letter up.

test("a letter costs ten coins, is kept for seven days with the style asked, and is announced to everybody who has the board open", () => {
    const { sut, hans } = ready();
    const watcher = sut.player(2, OTHER);
    sut.mural.openMural(watcher, true, 900_000);
    watcher.large.length = 0;

    const outcome = sut.mural.publish(hans, poster({ category: "procurado", title: "  Procura-se   o ladrão  ", body: "Linha um\r\n\r\n\r\n\r\nLinha   dois", style: { font: "bohemia", bold: true, spacing: "wide", align: "center", evil: "<script>" } }), 1_000_000);
    assert.equal(outcome.ok, true);
    assert.match(outcome.message, /fica 7 dias/);
    assert.equal(sut.state.wallets[1], 5000 - 100, "ten coins, a tenth of the item");

    const kept = JSON.parse(sut.files.get(FILE)).posters;
    assert.equal(kept.length, 1);
    assert.equal(kept[0].title, "Procura-se o ladrão");
    assert.equal(kept[0].body, "Linha um\n\nLinha dois");
    assert.deepEqual(plain(kept[0].style), { font: "bohemia", bold: true, spacing: "wide", align: "center" }, "only what the page can draw");
    assert.equal(kept[0].author, "Hans Capon");
    assert.equal(kept[0].owner, STEAM);
    assert.equal(kept[0].until - kept[0].at, 7 * DAY);
    assert.equal(kept[0].id, outcome.id);

    assert.deepEqual(watcher.large.map((one) => one.name), ["mural.view"], "the open board is sent again");
    assert.equal(watcher.large[0].data.posters[0].t, "Procura-se o ladrão");
    assert.ok(sut.state.logs.some((line) => /Jogador1 afixou um cartaz de procurado em Suchdol/.test(line)));
});

test("a letter without a heading is given its kind's own; an anonymous one is marked, and its name is not shown", () => {
    const { sut, hans } = ready();
    sut.mural.publish(hans, poster({ category: "recursos", title: "", anonymous: true }), 1_000_000);
    hans.large.length = 0;
    sut.mural.openMural(hans, true, 1_000_100);
    const first = hans.large[0].data.posters[0];
    assert.equal(first.t, "Preciso de recursos");
    assert.equal(first.an, true);
    assert.equal(first.n, "");
    assert.equal(first.mine, true, "still theirs to take down");
});

test("the refusals take no money and keep nothing: away from the board, wrong board, no kind, no text, no character, no coins", () => {
    const { sut, hans } = ready();
    const refuse = (request, expect, player = hans) => {
        const before = sut.state.wallets[player.id];
        const outcome = sut.mural.publish(player, request, 5_000_000);
        assert.equal(outcome.ok, false, JSON.stringify(request));
        assert.match(outcome.message, expect);
        assert.equal(sut.state.wallets[player.id], before, "no money taken");
        assert.equal(sut.mural.allPosters().length, 0);
    };
    refuse(poster({ board: "raborsch" }), /se afastou/);
    refuse(poster({ category: "nenhum" }), /Escolha o tipo/);
    refuse(poster({ body: "curto" }), /Escreva o texto/);
    refuse(poster({ body: "   \n\n  " }), /Escreva o texto/);
    refuse(null, /se afastou/);
    const noCharacter = sut.player(4, "76561198000000004");
    sut.state.wallets[4] = 5000;
    refuse(poster(), /Crie o seu personagem/, noCharacter);
    const noAccount = sut.player(5, "");
    sut.state.wallets[5] = 5000;
    refuse(poster(), /identificação Steam/, noAccount);
    const poor = sut.player(6, THIRD);
    sut.state.wallets[6] = 99;
    refuse(poster(), /precisa de 10 moedas/, poor);
    hans.position = { x: 700, y: 3300, z: 147 };
    refuse(poster(), /se afastou/);
});

test("a player has a few letters on a board, a board holds a number of them, and letters come one at a time", () => {
    const { sut, hans } = ready();
    let now = 1_000_000;
    for (let index = 0; index < 4; index += 1) {
        assert.equal(sut.mural.publish(hans, poster({ title: `Cartaz ${index}` }), now).ok, true);
        now += 5_000;
    }
    const fifth = sut.mural.publish(hans, poster({ title: "Quinto" }), now);
    assert.equal(fifth.ok, false);
    assert.match(fifth.message, /já tem 4 cartazes/);
    assert.equal(sut.state.wallets[1], 5000 - 400);

    // One at a time.
    const other = sut.player(2, OTHER);
    assert.equal(sut.mural.publish(other, poster(), now).ok, true);
    const quick = sut.mural.publish(other, poster(), now + 1_000);
    assert.equal(quick.ok, false);
    assert.match(quick.message, /Com calma/);

    // A full board: sixty letters, from people each with four.
    const full = ready();
    for (let index = 0; index < 15; index += 1) {
        const steam = `7656119800000${String(index).padStart(4, "0")}`;
        full.sut.state.characters[steam] = made();
        const one = full.sut.player(100 + index, steam);
        full.sut.state.wallets[one.id] = 5000;
        for (let n = 0; n < 4; n += 1) assert.equal(full.sut.mural.publish(one, poster({ title: `${index}-${n}` }), 2_000_000 + index * 100_000 + n * 5_000).ok, true);
    }
    const last = full.sut.player(300, "76561198000009999");
    full.sut.state.characters["76561198000009999"] = made();
    full.sut.state.wallets[300] = 5000;
    const refused = full.sut.mural.publish(last, poster(), 9_000_000);
    assert.equal(refused.ok, false);
    assert.match(refused.message, /quadro está cheio/);
    assert.equal(full.sut.state.wallets[300], 5000);
});

test("a disk that fails gives the money back and keeps nothing; a file that could not be read is not written over", () => {
    const bad = ready({ diskFails: true });
    const outcome = bad.sut.mural.publish(bad.hans, poster(), 1_000_000);
    assert.equal(outcome.ok, false);
    assert.match(outcome.message, /dinheiro foi devolvido/);
    assert.equal(bad.sut.state.wallets[1], 5000);
    assert.equal(bad.sut.mural.allPosters().length, 0);

    const corrupt = ready({ saved: "{ not json" });
    assert.ok(corrupt.sut.state.logs.some((line) => /não pôde ser lido/.test(line)));
    const refused = corrupt.sut.mural.publish(corrupt.hans, poster(), 1_000_000);
    assert.equal(refused.ok, false);
    assert.match(refused.message, /fora do ar/);
    assert.equal(corrupt.sut.state.wallets[1], 5000);
    assert.equal(corrupt.sut.files.get(FILE), "{ not json", "left as it was");
});

// ---------------------------------------------------------------------------------------------
// Seven days.

test("a letter leaves the board after seven days: not in the view, taken down by the sweep, and the open board is sent anew", () => {
    const { sut, hans } = ready();
    const watcher = sut.player(2, OTHER);
    sut.mural.publish(hans, poster({ title: "Dura sete dias" }), 1_000_000);
    sut.mural.openMural(watcher, true, 1_000_100);
    watcher.large.length = 0;

    const view = (now) => JSON.parse(sut.mural.viewOf(watcher, sut.places.boardById("suchdol"), now)).posters.length;
    assert.equal(view(1_000_000 + 7 * DAY - 1), 1);
    assert.equal(view(1_000_000 + 7 * DAY), 0, "to the millisecond");

    // The sweep runs by itself every ten minutes.
    assert.equal(sut.mural.purge(1_000_000 + 6 * DAY), 0);
    assert.equal(sut.mural.allPosters().length, 1);
    // The interval takes the clock of the process: a letter written eight days ago is still on the walls until the next sweep.
    const purger = sut.state.intervals[0];
    assert.equal(purger.ms, 10 * 60_000);
    assert.equal(sut.mural.publish(hans, poster({ title: "Já velho" }), Date.now() - 8 * DAY).ok, true);
    assert.equal(sut.mural.allPosters().some((one) => one.title === "Já velho"), true);
    watcher.large.length = 0;
    purger.fn();
    assert.equal(sut.mural.allPosters().some((one) => one.title === "Já velho"), false, "the one written eight days ago is gone");
    assert.equal(JSON.parse(sut.files.get(FILE)).posters.some((one) => one.title === "Já velho"), false);
    assert.ok(sut.state.logs.some((line) => /cartaz\(es\) saíram do quadro depois de 7 dias/.test(line)));
    assert.deepEqual(watcher.large.map((one) => one.name), ["mural.view"], "the watcher is sent the board again");
});

test("the letters are read back at the next start, and what is not a letter in the file is left out", () => {
    const good = { id: "x1", board: "suchdol", category: "avisos", title: "Velho", body: "Texto bom e comprido.", style: { font: "bohemia" }, anonymous: false, author: "Hans", owner: STEAM, at: 5, until: 9_999_999_999_999 };
    const sut = load({ saved: { posters: [good, { ...good, id: "x2", category: "nada" }, { ...good, id: "x3", body: "" }, 7, null, { ...good, id: "x4", title: "Com\u0007controle" }] } });
    sut.places.setBoards(sut.places.boardsOf(BOARDS));
    sut.mural.installMural();
    assert.deepEqual(plain(sut.mural.allPosters().map((one) => [one.id, one.title])), [["x1", "Velho"], ["x4", "Comcontrole"]]);
    assert.deepEqual(plain(sut.mural.allPosters("suchdol").map((one) => one.style)), [{ font: "bohemia", bold: false, spacing: "normal", align: "left" }, { font: "bohemia", bold: false, spacing: "normal", align: "left" }]);
    assert.ok(sut.state.logs.some((line) => /2 cartaz\(es\) nos quadros; 10 moedas por cartaz, 7 dias/.test(line)));
});

// ---------------------------------------------------------------------------------------------
// Taking a letter down.

test("the one who put a letter up takes it down; another player cannot, an administrator can; always from the board it hangs on", () => {
    const { sut, hans } = ready({ admins: [3] });
    const other = sut.player(2, OTHER);
    const admin = sut.player(3, THIRD);
    const id = sut.mural.publish(hans, poster({ anonymous: true }), 1_000_000).id;

    assert.match(sut.mural.removePoster(other, id).message, /Só quem afixou/);
    assert.equal(sut.mural.allPosters().length, 1);
    assert.match(sut.mural.removePoster(other, "nao-existe").message, /já não está/);

    const far = sut.player(4, STEAM, { position: { x: 700, y: 3300, z: 147 } });
    assert.match(sut.mural.removePoster(far, id).message, /se afastou/);

    assert.deepEqual(plain(sut.mural.removePoster(hans, id)), { ok: true, message: "Cartaz retirado." }, "even an anonymous letter is its owner's to take down");
    assert.equal(sut.mural.allPosters().length, 0);
    assert.equal(JSON.parse(sut.files.get(FILE)).posters.length, 0);

    const again = sut.mural.publish(hans, poster(), 2_000_000).id;
    assert.equal(sut.mural.removePoster(admin, again).ok, true);
    assert.ok(sut.state.logs.some((line) => /Jogador3 retirou um cartaz de avisos de Suchdol/.test(line)));
});

test("the page's requests are answered in the player's language, and an English player reads the messages in English", () => {
    const { sut, hans } = ready({ lang: "en" });
    send(sut, PUBLISH, hans, poster({ body: "curto" }));
    assert.deepEqual(plain(answers(hans)), [{ what: "publish", ok: false, message: "EN:Escreva o texto do cartaz." }]);
    hans.sent.length = 0;
    send(sut, PUBLISH, hans, poster());
    const reply = answers(hans)[0];
    assert.equal(reply.ok, true);
    assert.equal(reply.what, "publish");
    assert.ok(typeof reply.id === "string" && reply.id.length > 3);
    hans.sent.length = 0;
    send(sut, REMOVE, hans, { id: reply.id });
    assert.deepEqual(plain(answers(hans)), [{ what: "remove", ok: true, message: "EN:Cartaz retirado." }]);

    // Garbage from a client does nothing and says what it can.
    hans.sent.length = 0;
    sut.state.client.get(PUBLISH)(hans, "{broken");
    sut.state.client.get(REMOVE)(hans, 12345);
    sut.state.client.get(PUBLISH)(hans, "x".repeat(20_000));
    assert.equal(sut.mural.allPosters().length, 0);
});

// ---------------------------------------------------------------------------------------------
// Walking away.

test("whoever walks away from a board with its page open has it closed, once; closing the page stops the updates", () => {
    const { sut, hans } = ready();
    const other = sut.player(2, OTHER);
    sut.mural.openMural(hans, true, 1_000_000);
    sut.mural.openMural(other, true, 1_000_000);
    const watcher = sut.state.intervals[1];
    assert.equal(watcher.ms, 2_000);

    watcher.fn();
    assert.deepEqual(hans.sent.filter((entry) => entry.name === CLOSE), [], "still there");

    hans.position = { x: 620, y: 3300, z: 147 };
    watcher.fn();
    assert.equal(hans.sent.filter((entry) => entry.name === CLOSE).length, 1);
    watcher.fn();
    assert.equal(hans.sent.filter((entry) => entry.name === CLOSE).length, 1, "told once");

    // The other closes its page by itself: no more boards sent to it.
    sut.state.client.get(CLOSED)(other);
    other.large.length = 0;
    sut.mural.publish(sut.player(3, THIRD), poster(), 3_000_000);
    assert.deepEqual(other.large, []);
    assert.deepEqual(hans.large.slice(1), [], "nor to the one who walked off");
});

test("a player who leaves is forgotten", () => {
    const { sut, hans } = ready();
    sut.mural.openMural(hans, true, 1_000_000);
    sut.state.handlers.get("playerDisconnect")(hans);
    sut.state.players.length = 0;
    assert.doesNotThrow(() => sut.mural.refreshViewers("suchdol"));
});

// ---------------------------------------------------------------------------------------------
// The text of a letter.

test("the text is cleaned: control and invisible characters out, lines kept, a few at most, the lengths cut", () => {
    const { mural } = load();
    assert.equal(mural.cleanTitle("  Um \t\n  título​ com‮ controles  "), "Um título com controles");
    assert.equal(mural.cleanTitle("a".repeat(100)).length, 48);
    assert.equal(mural.cleanTitle(42), "");
    assert.equal(mural.cleanBody("\n\n  um  \r\n\r\n\r\n\r\ndois\u0000‏ \n\n\n"), "um\n\ndois");
    assert.equal(mural.cleanBody("linha\n".repeat(60)).split("\n").length, 22);
    assert.equal(mural.cleanBody("x".repeat(2000)).length, 900);
    assert.equal(mural.cleanBody("ação, ç, ü, “aspas” — e 𝒜"), "ação, ç, ü, “aspas” — e 𝒜", "letters, accents and astral characters stay");
    assert.equal(mural.cleanBody("a\ud800b"), "ab", "a lone surrogate goes");
    assert.deepEqual(plain(mural.cleanStyle({ font: "gothic", bold: "yes", spacing: "huge", align: "right" })), { font: "normal", bold: false, spacing: "normal", align: "left" });
    assert.deepEqual(plain(mural.cleanStyle(undefined)), plain(mural.DEFAULT_STYLE));
});

test("three kinds of letter, with the keys of their pictures in the server's file", () => {
    const { mural } = load();
    assert.deepEqual(plain(mural.CATEGORIES.map((one) => one.id)), ["procurado", "recursos", "avisos"]);
    assert.deepEqual(plain(mural.CATEGORIES.map((one) => one.art)), ["cartaz-procurado", "cartaz-recursos", "cartaz-avisos"]);
    const titles = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/craft-titles.json"), "utf8"));
    for (const key of ["mural", "cartaz-procurado", "cartaz-recursos", "cartaz-avisos"]) {
        assert.match(titles[key], /^data:image\/webp;base64,/, key);
        assert.ok(titles[key].length < 24_000, `${key} fits a message (${titles[key].length})`);
    }
});

// ---------------------------------------------------------------------------------------------
// The administrators' side.

test("an administrator takes letters down by id or by board, from anywhere", () => {
    const { sut, hans } = ready();
    const other = sut.player(2, OTHER);
    sut.mural.publish(hans, poster({ title: "A" }), 1_000_000);
    const second = sut.mural.publish(other, poster({ title: "B" }), 1_000_000);
    sut.mural.publish(hans, poster({ title: "C" }), 1_010_000);
    assert.equal(sut.mural.adminRemove(second.id, "admin retirou"), 1);
    assert.deepEqual(plain(sut.mural.allPosters().map((one) => one.title)), ["A", "C"]);
    assert.equal(sut.mural.adminRemove("suchdol", "admin retirou"), 2);
    assert.equal(sut.mural.allPosters().length, 0);
    assert.equal(sut.mural.adminRemove("nada", "admin retirou"), 0);
});

// ---------------------------------------------------------------------------------------------
// The Cidadania tab (2026-11-09): the town the board stands in, and the button that makes the player its citizen. (The information of the region, of 2026-11-04, left the boards the same night.)

const CITIZEN = "kcdc-gamemode:mural.citizen";
const KUTTENBERG_BOARD_AT = { x: 3157.6, y: 703, z: 54 };

test("the view has the card of the board's town: crest, lord, family, Lady, how many citizens, the wars, the NPCs; and the player's own standing", () => {
    const { sut, hans } = ready({ wars: { suchdol: ["raborsch", "minas"] } });
    sut.mural.openMural(hans, true, 1_000_000);
    const view = hans.large.at(-1).data;
    assert.deepEqual(plain(view.town), {
        id: "suchdol", name: "Suchdol", crest: "town-suchdol.webp", crestUrl: "", lord: "Gunther", family: "Von Capon", consort: { label: "Lady", name: "Ludmilla", courtesy: true, text: "" }, seatName: null,
        lands: ["Wysoka"], citizens: 3, closed: false, npcs: 7, wars: ["Raborsch", "Minas"], mine: null, kind: "first", price: 100,
    });
    assert.equal(view.decrees, undefined, "the information of the region is gone");
    assert.equal(view.decree, undefined);
    assert.ok(!JSON.stringify(view).includes(STEAM), "no account goes to a page");
});

test("a board in a place that is no town has no Cidadania tab: the view says so (null), and the citizenship cannot be asked for from it", () => {
    const { sut } = ready();
    const far = sut.player(4, OTHER, { position: KUTTENBERG_BOARD_AT, charName: "Radovan" });
    sut.mural.openMural(far, true, 1_000_000);
    assert.equal(far.large.at(-1).data.town, null, "Kuttenberg is no town of the test's list");
    assert.equal(far.large.at(-1).data.board.id, "kuttenberg");
    const outcome = sut.mural.becomeCitizen(far, { board: "kuttenberg" });
    assert.equal(outcome.ok, false);
    assert.match(outcome.message, /não é uma cidade/);
    assert.deepEqual(plain(sut.state.chosen), []);
    assert.equal(sut.mural.townOfBoard("zikmundovo"), null);
    assert.equal(sut.mural.townOfBoard("grunta").id, "minas", "the board of Minas is called grunta");
    assert.equal(sut.mural.townOfBoard("suchdol").name, "Suchdol");
});

test("the button of the tab says what the change is: a first choice, the free change, a paid one, an administrator's, or that the player is a citizen already, or that the lord closed the town", () => {
    const kindFor = (over, extra = {}) => {
        const { sut, hans } = ready(over);
        sut.mural.openMural(hans, true, 1_000_000);
        return hans.large.at(-1).data.town;
    };
    const SUCHDOL = TOWNS_FOR_TESTS[0];
    const RABORSCH = TOWNS_FOR_TESTS[1];
    assert.equal(kindFor({}).kind, "first", "nobody's citizen yet");
    assert.equal(kindFor({ citizen: { [STEAM]: RABORSCH }, free: true }).kind, "free");
    assert.deepEqual([kindFor({ citizen: { [STEAM]: RABORSCH }, free: false }).kind, kindFor({ citizen: { [STEAM]: RABORSCH }, free: false }).price], ["paid", 100]);
    assert.equal(kindFor({ citizen: { [STEAM]: RABORSCH }, admins: [1] }).kind, "admin", "an administrator changes at will");
    const here = kindFor({ citizen: { [STEAM]: SUCHDOL } });
    assert.deepEqual([here.kind, here.mine], ["here", "Suchdol"]);
    assert.equal(kindFor({ closed: ["suchdol"] }).kind, "closed", "a town whose lord closed the citizenship takes nobody new");
    assert.equal(kindFor({ closed: ["suchdol"], lords: [1] }).kind, "first", "the lord of the lands (and an administrator) may still choose it");
    const closedFor = kindFor({ closed: ["suchdol"] });
    assert.equal(closedFor.closed, true);
});

test("asking for the citizenship at the board makes the player a citizen of its town, tells the panel, and sends the board again; the page is answered in the player's language", () => {
    const { sut, hans } = ready();
    sut.mural.openMural(hans, true, 1_000_000);
    hans.large.length = 0;
    send(sut, CITIZEN, hans, { board: "suchdol" });
    assert.deepEqual(plain(sut.state.chosen), [[1, "suchdol"]], "the town is the board's own");
    assert.deepEqual(plain(sut.state.social), [1], "the F2 panel is told");
    assert.deepEqual(answers(hans).map((a) => [a.what, a.ok]), [["citizen", true]]);
    assert.match(answers(hans)[0].message, /Você agora é cidadão de Suchdol/);
    assert.equal(hans.large.length, 1, "the board is sent again, with the new standing");
    const english = ready({ lang: "en" });
    english.sut.mural.openMural(english.hans, true, 1_000_000);
    send(english.sut, CITIZEN, english.hans, { board: "suchdol" });
    assert.match(answers(english.hans)[0].message, /^EN:Você agora é cidadão/);
});

test("a refusal of the citizenship (the town closed, a price not paid) is told to the page and changes nothing else; and it is asked only at the board, for the board", () => {
    const { sut, hans } = ready({ chooseResult: { ok: false, message: "A cidadania de Suchdol está fechada pelo senhor das terras: ninguém novo pode se tornar cidadão por enquanto." } });
    sut.mural.openMural(hans, true, 1_000_000);
    send(sut, CITIZEN, hans, { board: "suchdol" });
    assert.deepEqual(answers(hans).map((a) => [a.what, a.ok]), [["citizen", false]]);
    assert.deepEqual(plain(sut.state.social), [], "nothing changed: the panel is not touched");
    // Another board's id, or none: refused before the town is asked.
    assert.match(sut.mural.becomeCitizen(hans, { board: "raborsch" }).message, /se afastou/);
    assert.match(sut.mural.becomeCitizen(hans, {}).message, /se afastou/);
    assert.match(sut.mural.becomeCitizen(hans, null).message, /se afastou/);
    const away = sut.player(4, OTHER, { position: { x: 100, y: 100, z: 10 } });
    assert.match(sut.mural.becomeCitizen(away, { board: "suchdol" }).message, /se afastou/);
    assert.equal(sut.state.chosen.length, 1, "only the first one reached the town");
});

test("what the file holds of the information of the region (kind decreto) is let go at the next start, and the posters stay", () => {
    const old = { id: "d1", board: "suchdol", category: "decreto", title: "Regras", body: "O senhor manda e o povo cumpre.", style: {}, anonymous: false, author: "Hans", owner: STEAM, at: 5, until: 8_640_000_000_000_000, role: "Lorde de Suchdol" };
    const letter = { id: "p1", board: "suchdol", category: "avisos", title: "Velho", body: "Um aviso comum e comprido.", style: {}, anonymous: false, author: "Hans", owner: STEAM, at: 5, until: 9_999_999_999_999 };
    const sut = load({ saved: { posters: [old, letter] } });
    sut.places.setBoards(sut.places.boardsOf(BOARDS));
    sut.mural.installMural();
    assert.deepEqual(plain(sut.mural.allPosters().map((one) => one.id)), ["p1"]);
    assert.equal(sut.mural.DECREE, undefined);
    assert.equal(sut.mural.decreeSettings, undefined);
});

test("the page has the two tabs and asks the server for the citizenship with the board it is at; nothing of the information of the region is left in it", () => {
    const page = fs.readFileSync(path.join(__dirname, "../ui-src/mural.html"), "utf8");
    assert.match(page, /\["town", t\.tabTown\]/);
    assert.match(page, /send\("mural:citizen", \{ board: data\.board\.id \}\)/);
    for (const text of ["tabTown", "btnFirst", "btnFree", "btnAdmin", "btnHere", "noteShut", "tWarWith", "townFoot"]) {
        assert.equal(page.split(`${text}:`).length - 1, 2, `${text} in both languages`);
    }
    for (const gone of ["decreto", "decreeBtn", "tabDecrees", "draftDecree", "data.decree", "noExpiry", "Informações da região"]) {
        assert.ok(!page.includes(gone), `${gone} is gone from the page`);
    }
    const server = fs.readFileSync(path.join(__dirname, "../src/server/mural.ts"), "utf8");
    assert.ok(!/decree/i.test(server.replace(/the information of the region|decreto/g, "")), "the server's side has no decree code left");
    assert.ok(!fs.existsSync(path.join(__dirname, "../src/server/decrees.ts")), "the rights module is gone");
});
