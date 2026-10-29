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

function load({ saved = null, characters = {}, wallets = {}, diskFails = false, lang = "pt", admins = [] } = {}) {
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
    const places = run("mural-places.js", { "./reach.js": reach }, { logs, globals: { WorldResource: { ready: true, all: () => [] }, Events: { once() {} } } });
    const state = { logs, players: [], handlers: new Map(), client: new Map(), intervals: [], characters, wallets: { ...wallets }, art: 0, chat: [] };
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
        "./language.js": { languageOf: () => lang, translate: (text, to) => (to === "en" ? `EN:${text}` : text) },
        "./money.js": money,
        "./mural-places.js": places,
        "./store.js": store,
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
