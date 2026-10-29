// The creator's server half (src/server/creator.ts) over the real name rules and the real catalog, with a fake game.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const plain = (value) => JSON.parse(JSON.stringify(value));
const dist = (name) => fs.readFileSync(path.join(__dirname, "../dist/server", name), "utf8");
const real = (name) => {
    const box = { exports: {} };
    vm.runInNewContext(dist(name), box);
    return box.exports;
};

const OPTIONS = {
    male: {
        head: ["henry", "m_head_000", "m_head_001", "m_head_drowner"],
        body: ["henry_body", "m_body_pale_01", "m_body_tan_01"],
        hair: [["x_hair_01", "m_hair_001_black"], ["x_hair_01", "m_hair_001_blonde"], ["x_hair_01", "x_hair_01"], ["m_hair_barber_01", "m_hair_barber_01"]],
        beards: { m_head_000: ["m_beard_00", "m_beard_01"], m_head_001: [] },
    },
    female: {
        head: ["f_head_000", "f_head_001"],
        body: ["f_body_pale_01", "f_roma_01"],
        hair: [["f_hair_001", "f_hair_001"], ["f_hair_001", "f_hair_001_black"], ["f_hair_001", "f_hair_001_ginger"]],
        beards: {},
    },
};
const appearances = {
    options: (part, gender = "male") => (part === "hair" ? OPTIONS[gender].hair.map(([group, name]) => ({ name, group })) : OPTIONS[gender][part].map((name) => ({ name, group: name }))),
    beards: (head, gender = "male") => (OPTIONS[gender].beards[head] ?? []).map((name) => ({ name })),
};

const HENRY = { gender: "male", head: "", hair: "", beard: "", body: "" };

const CLOTHES = {
    male: { top: [{ item: "TunicLong01_m01_C", name: "Túnica", icon: "data:image/webp;base64,AA" }], legs: [{ item: "HoseSeparate01_m01_E", name: "Calças simples", icon: "data:image/webp;base64,AB" }], feet: [{ item: "BootsAnkle01_m01_C", name: "Botas de trabalho", icon: "data:image/webp;base64,AC" }] },
    female: { top: [{ item: "F_SimpleDress01_m01_D", name: "Vestido de trabalho", icon: "data:image/webp;base64,AD" }], legs: [], feet: [{ item: "F_Shoes02_m01_B", name: "Sapatos", icon: "data:image/webp;base64,AE" }] },
};

/** The game's item list as `Inventory.classes()` gives it: a GUID per table name, and the category. */
const CLASS_LIST = [
    ...["TunicLong01_m01_C", "HoseSeparate01_m01_E", "BootsAnkle01_m01_C", "F_SimpleDress01_m01_D", "F_Shoes02_m01_B", "TunicShort02_m03_A", "HoseLoose01_m02_C", "Gloves01_m01_A"].map((name) => ({ id: `guid-${name}`, name, category: "Armor" })),
    { id: "guid-Hood01_m01_A", name: "Hood01_m01_A", category: "Hood" },
    { id: "guid-swordLong", name: "swordLong", category: "MeleeWeapon" },
    { id: "guid-bread", name: "bread", category: "Food" },
];
const guid = (name) => `guid-${name}`;

function load({ saved = {}, admins = [], online = [], broken = false } = {}) {
    const clientHandlers = new Map();
    const serverHandlers = new Map();
    const timers = new Map();
    const state = { now: 1_000_000, nextTimer: 1, chat: [], logs: [], starter: [], saves: [], players: new Map(), failed: [], large: [], dressed: [], outfits: [] };
    const characters = {
        saved: { ...saved },
        allCharacters: () => Object.entries(characters.saved).map(([steamId, c]) => ({ steamId, name: c.name ?? c.nickname, epithet: c.epithet ?? "", nickname: c.nickname, named: Boolean(c.name) })),
        getCharacter: (steamId) => characters.saved[steamId] ?? null,
        getIdentity: (steamId) => (characters.saved[steamId]?.name ? { name: characters.saved[steamId].name, epithet: characters.saved[steamId].epithet ?? "" } : null),
        saveCharacter: (steamId, appearance, nickname, identity) => {
            state.saves.push({ steamId, appearance, nickname, identity });
            const given = characters.saved[steamId]?.clothesGiven;
            characters.saved[steamId] = { appearance, nickname, ...(identity ?? {}), ...(given ? { clothesGiven: given } : {}) };
        },
        clothesGivenTo: (steamId) => characters.saved[steamId]?.clothesGiven ?? [],
        noteClothesGiven: (steamId, items) => {
            if (characters.saved[steamId] && items.length > 0) characters.saved[steamId].clothesGiven = [...new Set([...(characters.saved[steamId].clothesGiven ?? []), ...items])];
        },
    };
    const modules = {
        "./auth.js": { isAdmin: (player) => admins.includes(player.steamId) },
        "./character-name.js": real("character-name.js"),
        "./creator-catalog.js": real("creator-catalog.js"),
        "./creator-space.js": real("creator-space.js"),
        "./characters.js": characters,
        "./kits.js": { ensureStarter: (player) => state.starter.push(player.id), markStarterOutfit: (player) => state.outfits.push(player.id) },
        "./big-emit.js": { emitLarge: (player, name, json) => { state.large.push({ player: player.id, name, value: JSON.parse(json) }); return 1; } },
        "./creator-clothes.js": {
            CLOTHES_PARTS: ["top", "legs", "feet"],
            hasClothes: () => true,
            pageClothes: (given = new Set()) => ({ male: { top: [{ name: "Túnica", icon: "x", ...(given.has("TunicLong01_m01_C") ? { got: true } : {}) }] }, female: {} }),
            piecesFor: (gender, picks) => ["top", "legs", "feet"].map((part) => CLOTHES[gender][part][picks[part]]).filter(Boolean).map((piece) => piece.item),
        },
    };
    const context = {
        exports: {},
        require: (id) => modules[id] ?? assert.fail(`unexpected require ${id}`),
        console: { log: (line) => state.logs.push(line) },
        Date: { now: () => state.now },
        Inventory: {
            classes: () => CLASS_LIST,
            get: () => state.inventory ?? null,
            set: (player, request) => { state.dressed.push({ player: player.id, items: request.items, quickslots: request.quickslots }); return { ok: true, code: "" }; },
            add: (player, request) => { (state.added ??= []).push({ player: player.id, item: request.item, amount: request.amount }); return { ok: state.addRefused !== request.item, code: "" }; },
        },
        Appearances: broken ? { options: () => { throw new Error("the game has no catalog yet"); }, beards: () => [] } : appearances,
        Chat: { sendToPlayer: (player, text) => state.chat.push({ player: player.id, text }) },
        Events: { onClient: (name, fn) => clientHandlers.set(name, fn), on: (name, fn) => serverHandlers.set(name, fn) },
        Player: { all: () => [...state.players.values()], getById: (id) => state.players.get(id) ?? null },
        Navigation: { get ready() { return state.navReady !== false; }, closestPoint: (spot) => (state.ground ? state.ground(spot) : { x: spot.x, y: spot.y, z: spot.z }) },
        Vector3: class { constructor(x, y, z) { Object.assign(this, { x, y, z }); } },
        setInterval: (fn) => { const id = state.nextTimer++; timers.set(id, { fn, every: 1000, due: state.now + 1000 }); return id; },
        setTimeout: (fn, ms) => { const id = state.nextTimer++; timers.set(id, { fn, every: 0, due: state.now + ms }); return id; },
        clearTimeout: (id) => timers.delete(id),
        clearInterval: (id) => timers.delete(id),
    };
    vm.runInNewContext(dist("creator.js"), context);
    context.exports.installCreator((player, reason, mandatory) => state.failed.push({ player: player.id, reason, mandatory }));
    const advance = (ms) => {
        const until = state.now + ms;
        for (;;) {
            const next = [...timers.entries()].filter(([, t]) => t.due <= until).sort((a, b) => a[1].due - b[1].due)[0];
            if (next === undefined) break;
            const [id, timer] = next;
            state.now = Math.max(state.now, timer.due);
            if (timer.every > 0) timer.due += timer.every;
            else timers.delete(id);
            timer.fn();
        }
        state.now = until;
    };
    const player = (id, nickname, steamId = `7656119800000000${id}`, appearance = HENRY) => {
        const p = {
            id, nickname, steamId, appearance: { ...appearance }, sent: [], applied: [], refuse: false,
            ready: false, alive: true, virtualWorld: 0, position: { x: 0, y: 0, z: 0 }, teleports: [],
            teleport: (spot) => { p.teleports.push({ x: spot.x, y: spot.y, z: spot.z }); p.position = { x: spot.x, y: spot.y, z: spot.z }; return true; },
            emit: (event, payload) => p.sent.push({ event, payload: JSON.parse(payload) }),
            setAppearance: (look) => { p.applied.push({ ...look }); return !p.refuse; },
        };
        state.players.set(id, p);
        return p;
    };
    for (const entry of online) player(...entry);
    const fire = (event, p, payload) => clientHandlers.get(`kcdc-gamemode:creator.${event}`)(p, typeof payload === "string" ? payload : JSON.stringify(payload ?? {}));
    return { api: context.exports, state, characters, player, advance, fire, serverHandlers };
}

const lastOf = (p, event) => [...p.sent].reverse().find((entry) => entry.event === `kcdc-gamemode:creator.${event}`)?.payload;
const LOOK = { gender: "male", head: 0, hair: 1, tone: 1, beard: 1, skin: 1 };

test("opening sends the page the catalog as counts, a look to start from, the alcunhas and the rules", () => {
    const sut = load();
    const hans = sut.player(1, "Hans");
    sut.api.openCreatorFor(hans);
    const open = lastOf(hans, "begin");
    assert.equal(open.genders, "both");
    assert.deepEqual(plain(open.catalog.male), { heads: 2, skins: 2, hairs: [[], ["black", "blonde"]], beards: [2, 0] });
    assert.deepEqual(plain(open.catalog.female), { heads: 2, skins: 2, hairs: [["black", "ginger"]], beards: [0, 0] });
    assert.doesNotMatch(JSON.stringify(open.catalog), /m_head|m_hair|x_hair|m_body|m_beard/, "never a name of the game's");
    assert.equal(open.mandatory, true, "nobody has made a character yet, so there is no way out");
    assert.deepEqual(open.identity, { name: "", epithet: "", locked: false, suggestion: "Hans" });
    assert.deepEqual(open.rules, { min: 2, max: 16 });
    assert.ok(open.epithets.list.some((e) => e.label === "II") && open.epithets.list.some((e) => e.label === "Júnior"));
    assert.equal(open.look.gender, "male");
    assert.equal(hans.applied.length, 0, "nothing is put on the body before the player picks");
});

test("a look picked is put on the body at once, and never oftener than every 120 ms; the last one wins", () => {
    const sut = load();
    const hans = sut.player(1, "Hans");
    sut.api.openCreatorFor(hans);
    sut.fire("preview", hans, { look: LOOK });
    assert.deepEqual(hans.applied, [{ gender: "male", head: "m_head_000", hair: "m_hair_001_blonde", beard: "m_beard_01", body: "m_body_tan_01" }]);
    sut.fire("preview", hans, { look: { ...LOOK, hair: 0, tone: -1, head: 1, beard: -1 } });
    sut.fire("preview", hans, { look: { ...LOOK, hair: 1, tone: 0, head: 1, beard: -1 } });
    assert.equal(hans.applied.length, 1, "too soon");
    sut.advance(150);
    assert.equal(hans.applied.length, 2);
    assert.equal(hans.applied[1].hair, "m_hair_001_black", "the last look asked for, in the style's own 0th colour");
    assert.equal(hans.applied[1].head, "m_head_001");
});

test("a look with a number out of range, or from somebody who has no creator open, changes nothing", () => {
    const sut = load();
    const hans = sut.player(1, "Hans");
    sut.fire("preview", hans, { look: LOOK });
    assert.equal(hans.applied.length, 0, "no creator open");
    sut.api.openCreatorFor(hans);
    for (const bad of [{ ...LOOK, head: 9 }, { ...LOOK, tone: 7 }, { ...LOOK, gender: "other" }, "nonsense", null, { look: "x" }]) {
        sut.fire("preview", hans, bad === LOOK ? bad : { look: bad });
    }
    sut.fire("preview", hans, "{ not json");
    assert.equal(hans.applied.length, 0);
});

test("a creator opened for women takes no man's look", () => {
    const sut = load();
    const hans = sut.player(1, "Hans");
    sut.api.openCreatorFor(hans, "female");
    sut.fire("preview", hans, { look: LOOK });
    assert.equal(hans.applied.length, 0);
    assert.equal(lastOf(hans, "begin").look.gender, "female");
    sut.fire("preview", hans, { look: { gender: "female", head: 1, hair: 0, tone: 1, beard: -1, skin: 1 } });
    assert.deepEqual(hans.applied[0], { gender: "female", head: "f_head_001", hair: "f_hair_001_ginger", beard: "", body: "f_roma_01" });
});

test("a look the body does not wear is put on again, no oftener than every 1.5 s, and left alone once it is on", () => {
    const sut = load();
    const hans = sut.player(1, "Hans");
    sut.api.openCreatorFor(hans);
    sut.fire("preview", hans, { look: LOOK });
    assert.equal(hans.applied.length, 1);
    sut.advance(1000);
    assert.equal(hans.applied.length, 1, "not yet");
    sut.advance(1000);
    assert.equal(hans.applied.length, 2, "the game dressed its default over it");
    hans.appearance = { ...hans.applied[1] };
    sut.advance(10_000);
    assert.equal(hans.applied.length, 2, "it holds");
});

test("a name is checked for letters, for the alcunha, and for being taken by another character or another player on now", () => {
    const sut = load({
        saved: { 765: { appearance: HENRY, nickname: "Ivan" }, 766: { appearance: HENRY, nickname: "Mauro", name: "Henry", epithet: "ii" } },
        online: [[2, "Katerina", "767"]],
    });
    const hans = sut.player(1, "Hans", "768");
    sut.api.openCreatorFor(hans);
    const answer = (name, epithet = "") => {
        sut.fire("check", hans, { name, epithet });
        const reply = lastOf(hans, "name");
        assert.deepEqual({ name: reply.name, epithet: reply.epithet }, { name, epithet }, "what was asked comes back with the answer");
        const { name: _name, epithet: _epithet, ...rest } = reply;
        return rest;
    };
    assert.deepEqual(answer("Henry", "iii"), { ok: true, full: "Henry III" });
    assert.deepEqual(answer("henry"), { ok: true, full: "Henry" }, "the first Henry is free: only Henry II is taken");
    assert.match(answer("Henry", "ii").message, /Já existe um Henry II/);
    assert.match(answer("HENRY", "II".toLowerCase()).message, /Já existe um Henry II/);
    assert.match(answer("Ivan").message, /Já existe um Ivan\. Escolha uma alcunha/, "a character made before the names goes by its nickname");
    assert.match(answer("Katerina").message, /Já existe um Katerina/, "somebody on now with no saved character");
    assert.match(answer("Hen ry").message, /sem espaços/);
    assert.match(answer("Henry7").message, /números/);
    assert.match(answer("Henry!").message, /Só letras/);
    assert.match(answer("Henry", "o-mais-lindo").message, /alcunha não existe/);
    assert.deepEqual(answer("Matyáš", "ruivo"), { ok: true, full: "Matyáš o Ruivo" });
    sut.fire("check", hans, { name: 7 });
    assert.deepEqual({ name: lastOf(hans, "name").name, epithet: lastOf(hans, "name").epithet }, { name: "", epithet: "" }, "what is not text comes back as nothing");
    assert.equal(answer("Hans").ok, true, "a player's own nickname is no obstacle to themselves");
});

test("accepting saves the look and the name, puts the look on, dresses the newcomer and welcomes them", () => {
    const sut = load();
    const hans = sut.player(1, "Hans");
    sut.api.openCreatorFor(hans);
    sut.fire("accept", hans, { look: LOOK, name: "jindřich", epithet: "junior" });
    assert.deepEqual(plain(sut.state.saves), [{ steamId: hans.steamId, appearance: { gender: "male", head: "m_head_000", hair: "m_hair_001_blonde", beard: "m_beard_01", body: "m_body_tan_01" }, nickname: "Hans", identity: { name: "Jindřich", epithet: "junior" } }]);
    assert.equal(hans.applied.at(-1).hair, "m_hair_001_blonde");
    assert.deepEqual(sut.state.starter, [1]);
    assert.match(sut.state.chat[0].text, /Bem-vindo a Kuttenberg, Jindřich Júnior/);
    assert.deepEqual(lastOf(hans, "done"), { full: "Jindřich Júnior" });
    sut.fire("accept", hans, { look: LOOK, name: "Outro" });
    assert.equal(sut.state.saves.length, 1, "once: the creator is closed");
});

test("accepting with a bad name or a bad look saves nothing and says why, and the creator stays open", () => {
    const sut = load({ saved: { 766: { appearance: HENRY, nickname: "X", name: "Henry", epithet: "" } } });
    const hans = sut.player(1, "Hans");
    sut.api.openCreatorFor(hans);
    sut.fire("accept", hans, { look: LOOK, name: "Henry" });
    assert.deepEqual(lastOf(hans, "refused"), { message: "Já existe um Henry. Escolha uma alcunha (como II ou o Ruivo) ou outro nome.", field: "name" });
    sut.fire("accept", hans, { look: { ...LOOK, head: 99 }, name: "Jan" });
    assert.match(lastOf(hans, "refused").message, /visual não é válido/);
    sut.fire("accept", hans, { look: LOOK, name: "Henry", epithet: "ii" });
    assert.equal(sut.state.saves.length, 1, "Henry II is free");
    assert.equal(sut.state.starter.length, 1);
});

test("leaving without accepting puts the old look back; nothing is put back when nothing was tried", () => {
    const saved = { gender: "male", head: "m_head_001", hair: "m_hair_001_black", beard: "", body: "m_body_pale_01" };
    const sut = load({ saved: { 765: { appearance: saved, nickname: "Hans", name: "Hans", epithet: "" } } });
    const hans = sut.player(1, "Hans", "765", saved);
    sut.api.openCreatorFor(hans);
    sut.fire("cancel", hans);
    assert.equal(hans.applied.length, 0, "nothing was tried on");

    sut.api.openCreatorFor(hans);
    sut.fire("preview", hans, { look: LOOK });
    sut.fire("cancel", hans);
    assert.deepEqual(hans.applied.at(-1), saved);
    sut.fire("accept", hans, { look: LOOK, name: "Hans" });
    assert.equal(sut.state.saves.length, 0, "the session is over");

    // starting over keeps the look the first start would have put back
    sut.api.openCreatorFor(hans);
    sut.fire("preview", hans, { look: LOOK });
    hans.appearance = { ...hans.applied.at(-1) };
    sut.api.openCreatorFor(hans);
    sut.fire("cancel", hans);
    assert.deepEqual(hans.applied.at(-1), saved);
});

test("a name already chosen cannot be changed by the player; an administrator may", () => {
    const named = { appearance: { gender: "male", head: "m_head_000", hair: "m_hair_001_black", beard: "", body: "m_body_pale_01" }, nickname: "Mauro", name: "Radovan", epithet: "velho" };
    const sut = load({ saved: { 765: named }, admins: ["764"] });
    const mauro = sut.player(1, "Mauro", "765", named.appearance);
    sut.api.openCreatorFor(mauro);
    assert.deepEqual(lastOf(mauro, "begin").identity, { name: "Radovan", epithet: "velho", locked: true, suggestion: "" });
    sut.fire("accept", mauro, { look: LOOK, name: "Outro", epithet: "ii" });
    assert.deepEqual(plain(sut.state.saves[0].identity), { name: "Radovan", epithet: "velho" }, "what was typed is ignored");

    const boss = sut.player(2, "Boss", "764");
    sut.characters.saved["764"] = { ...named, nickname: "Boss", name: "Wenzel", epithet: "" };
    sut.api.openCreatorFor(boss);
    assert.equal(lastOf(boss, "begin").identity.locked, false);
    sut.fire("accept", boss, { look: LOOK, name: "Wilhelm", epithet: "" });
    assert.deepEqual(plain(sut.state.saves[1].identity), { name: "Wilhelm", epithet: "" });
});

test("a character made before the names are asked for is offered its nickname's first word, when that can be a name", () => {
    const old = { appearance: HENRY, nickname: "Kath Otvazzy" };
    const sut = load({ saved: { 765: old } });
    const kath = sut.player(1, "Kath Otvazzy", "765");
    sut.api.openCreatorFor(kath);
    assert.deepEqual(lastOf(kath, "begin").identity, { name: "", epithet: "", locked: false, suggestion: "Kath" });
    assert.equal(lastOf(kath, "begin").mandatory, false, "a character that exists may leave the creator");
    const digits = sut.player(2, "xX_Slayer_Xx", "766");
    sut.api.openCreatorFor(digits);
    assert.equal(lastOf(digits, "begin").identity.suggestion, "");
});

const RETURNING = { appearance: { gender: "male", head: "m_head_001", hair: "m_hair_001_black", beard: "", body: "m_body_pale_01" }, nickname: "Hans", name: "Hans", epithet: "" };

test("a creator nobody touches for fifteen minutes is closed and the look put back", () => {
    const sut = load({ saved: { 765: RETURNING } });
    const hans = sut.player(1, "Hans", "765", RETURNING.appearance);
    sut.api.openCreatorFor(hans);
    sut.fire("preview", hans, { look: LOOK });
    sut.advance(14 * 60_000);
    assert.equal(lastOf(hans, "end"), undefined);
    sut.fire("preview", hans, { look: { ...LOOK, head: 1, beard: -1 } });
    sut.advance(14 * 60_000);
    assert.equal(lastOf(hans, "end"), undefined, "a preview is a touch");
    sut.advance(2 * 60_000);
    assert.deepEqual(lastOf(hans, "end"), {});
    assert.deepEqual(hans.applied.at(-1), RETURNING.appearance);
});

test("a player who leaves has no creator any more", () => {
    const sut = load();
    const hans = sut.player(1, "Hans");
    sut.api.openCreatorFor(hans);
    sut.serverHandlers.get("playerDisconnect")(hans);
    sut.fire("accept", hans, { look: LOOK, name: "Hans" });
    assert.equal(sut.state.saves.length, 0);
});

test("a page that could not open is asked for again twice, four seconds apart, and then the game's own stage takes over", () => {
    const sut = load({ saved: { 765: RETURNING } });
    const hans = sut.player(1, "Hans", "765", RETURNING.appearance);
    sut.api.openCreatorFor(hans);
    const begins = () => hans.sent.filter((entry) => entry.event === "kcdc-gamemode:creator.begin").length;
    assert.equal(begins(), 1);

    sut.fire("failed", hans, { reason: "createView threw" });
    assert.deepEqual(sut.state.failed, []);
    sut.advance(3_000);
    assert.equal(begins(), 1, "not yet");
    sut.advance(1_500);
    assert.equal(begins(), 2, "the same page asked for again");
    sut.fire("failed", hans, { reason: "again" });
    sut.advance(4_100);
    assert.equal(begins(), 3);
    assert.match(sut.state.logs.join("\n"), /outra tentativa em 4 s \(2 de 2\)/);

    sut.fire("failed", hans, { reason: "a third time" });
    assert.deepEqual(sut.state.failed, [{ player: 1, reason: "a third time", mandatory: false }]);
    sut.advance(10_000);
    assert.equal(begins(), 3, "no more tries");
    sut.fire("accept", hans, { look: LOOK, name: "Hans" });
    assert.equal(sut.state.saves.length, 0, "and the creator page is closed");
    sut.fire("failed", hans, { reason: "late" });
    assert.equal(sut.state.failed.length, 1, "only while a creator is open");
});

test("/creator stop closes the page, puts the look back and forgets the session", () => {
    const sut = load({ saved: { 765: RETURNING } });
    const hans = sut.player(1, "Hans", "765", RETURNING.appearance);
    sut.api.openCreatorFor(hans);
    sut.fire("preview", hans, { look: LOOK });
    assert.equal(sut.api.closeCreatorFor(hans), true);
    assert.deepEqual(hans.applied.at(-1), RETURNING.appearance);
    assert.deepEqual(lastOf(hans, "end"), {});
    sut.fire("accept", hans, { look: LOOK, name: "Hans" });
    assert.equal(sut.state.saves.length, 0);
});

test("the first time, the creator is not optional: the page is told so, and a leave is ignored", () => {
    const sut = load();
    const hans = sut.player(1, "Hans");
    sut.api.openCreatorFor(hans);
    assert.equal(lastOf(hans, "begin").mandatory, true);
    sut.fire("preview", hans, { look: LOOK });
    sut.fire("cancel", hans);
    assert.equal(hans.applied.length, 1, "the look was not taken off");
    assert.match(sut.state.logs.join("\n"), /tentou sair do criador sem ter criado o personagem/);
    sut.fire("accept", hans, { look: LOOK, name: "Hans" });
    assert.equal(sut.state.saves.length, 1, "the session was still there to accept");
});

test("somebody who already has a character is told they may leave", () => {
    const sut = load({ saved: { 765: RETURNING } });
    const hans = sut.player(1, "Hans", "765", RETURNING.appearance);
    sut.api.openCreatorFor(hans);
    assert.equal(lastOf(hans, "begin").mandatory, false);
});

test("a newcomer's creator is never closed for being idle", () => {
    const sut = load();
    const hans = sut.player(1, "Hans");
    sut.api.openCreatorFor(hans);
    sut.fire("preview", hans, { look: LOOK });
    sut.advance(3 * 60 * 60_000);
    assert.equal(lastOf(hans, "end"), undefined);
    sut.fire("accept", hans, { look: LOOK, name: "Hans" });
    assert.equal(sut.state.saves.length, 1);
});

test("what the client does because it has to, when the body dies, ends a newcomer's creator, and the next spawn opens it again", () => {
    const sut = load();
    const hans = sut.player(1, "Hans");
    sut.api.openCreatorFor(hans);
    sut.fire("preview", hans, { look: LOOK });
    sut.fire("cancel", hans, { forced: true });
    assert.deepEqual(hans.applied.at(-1), HENRY, "the look is put back");
    sut.fire("accept", hans, { look: LOOK, name: "Hans" });
    assert.equal(sut.state.saves.length, 0, "no creator open");
    sut.api.openCreatorFor(hans);
    assert.equal(hans.sent.filter((entry) => entry.event === "kcdc-gamemode:creator.begin").length, 2);
});

test("/creator stop is not for a newcomer, but an administrator can", () => {
    const sut = load({ admins: ["764"] });
    const hans = sut.player(1, "Hans");
    sut.api.openCreatorFor(hans);
    assert.equal(sut.api.closeCreatorFor(hans), false);
    assert.equal(lastOf(hans, "end"), undefined);
    assert.match(sut.state.chat.at(-1).text, /crie o seu personagem e dê um nome/);

    const boss = sut.player(2, "Boss", "764");
    sut.api.openCreatorFor(boss);
    assert.equal(sut.api.closeCreatorFor(boss), true);
    assert.deepEqual(lastOf(boss, "end"), {});
});

test("a newcomer whose page cannot open at all gets the game's stage, which they cannot back out of either", () => {
    const sut = load();
    const hans = sut.player(1, "Hans");
    sut.api.openCreatorFor(hans);
    for (let i = 0; i < 3; i++) {
        sut.fire("failed", hans, { reason: "no browser" });
        sut.advance(4_100);
    }
    assert.deepEqual(sut.state.failed, [{ player: 1, reason: "no browser", mandatory: true }]);
    assert.match(sut.state.logs.join("\n"), /que não se pode deixar sem criar o personagem/);
});

test("the log says what the catalog holds, once", () => {
    const sut = load();
    const hans = sut.player(1, "Hans");
    sut.api.openCreatorFor(hans);
    sut.api.openCreatorFor(hans);
    assert.equal(sut.state.logs.filter((line) => line.startsWith("creator: catálogo")).length, 1);
    assert.match(sut.state.logs[0], /homens 2 rostos, 2 cabelos, 2 peles/);
});

test("the catalog is read when the server starts, so that a catalog the game does not give shows in the log then", () => {
    const sut = load();
    assert.match(sut.state.logs[0], /creator: catálogo dos homens 2 rostos, 2 cabelos, 2 peles/, "before anybody has joined");

    const broken = load({ broken: true });
    assert.match(broken.state.logs[0], /o catálogo de aparências não pôde ser lido agora: .*the game has no catalog yet/);
});

test("a catalog the game will not give leaves nobody without a creator: the game's own stage opens, and a newcomer cannot back out of it", () => {
    const sut = load({ broken: true, saved: { 765: RETURNING } });
    const newcomer = sut.player(1, "Hans");
    sut.api.openCreatorFor(newcomer);
    assert.deepEqual(sut.state.failed, [{ player: 1, reason: "sem catálogo de aparências", mandatory: true }]);
    assert.equal(newcomer.sent.length, 0, "no page was asked for");
    assert.match(sut.state.logs.join("\n"), /sem o catálogo de aparências .*vai o criador do jogo/);

    const old = sut.player(2, "Hans", "765", RETURNING.appearance);
    sut.api.openCreatorFor(old);
    assert.deepEqual(sut.state.failed.at(-1), { player: 2, reason: "sem catálogo de aparências", mandatory: false });
});

test("a look just accepted is kept on the body for twenty seconds: the game may dress its default over it at the end of loading", () => {
    const sut = load();
    const hans = sut.player(1, "Hans");
    sut.api.openCreatorFor(hans);
    sut.fire("accept", hans, { look: LOOK, name: "Hans" });
    const accepted = hans.applied.length;
    assert.equal(accepted, 1);

    sut.advance(1_000);
    assert.equal(hans.applied.length, accepted, "not before a second and a half");
    sut.advance(1_000);
    assert.equal(hans.applied.length, accepted + 1, "the body still wears the old look: it is put on again");
    sut.advance(1_000);
    assert.equal(hans.applied.length, accepted + 1, "a second after is too soon");
    sut.advance(1_000);
    assert.equal(hans.applied.length, accepted + 2, "and again, on the next beat");

    hans.appearance = { ...hans.applied.at(-1) };
    sut.advance(10_000);
    assert.equal(hans.applied.length, accepted + 2, "once the body wears it, nothing more");

    hans.appearance = { ...HENRY };
    sut.advance(7_000);
    const kept = hans.applied.length;
    assert.ok(kept > accepted + 2, "the game dressed its default again: it is put back until the twenty seconds are over");
    sut.advance(10_000);
    assert.equal(hans.applied.length, kept, "and after them the game has the last word");
});

test("somebody who opens the creator again, or leaves the server, stops being kept in the look they accepted", () => {
    const sut = load();
    const hans = sut.player(1, "Hans");
    sut.api.openCreatorFor(hans);
    sut.fire("accept", hans, { look: LOOK, name: "Hans" });
    const count = hans.applied.length;
    sut.api.openCreatorFor(hans);
    sut.advance(10_000);
    assert.equal(hans.applied.length, count, "the new creator is the one to say what the body wears");

    const bye = sut.player(2, "Bye");
    sut.api.openCreatorFor(bye);
    sut.fire("accept", bye, { look: LOOK, name: "Bye" });
    const byes = bye.applied.length;
    sut.serverHandlers.get("playerDisconnect")(bye);
    sut.advance(10_000);
    assert.equal(bye.applied.length, byes);
});

test("an administrator's framing numbers go to their client as sent", () => {
    const sut = load();
    const boss = sut.player(1, "Boss");
    sut.api.tuneCreatorFor(boss, { distance: 4.2, light: 3 });
    assert.deepEqual(lastOf(boss, "tune"), { distance: 4.2, light: 3 });
    sut.api.tuneCreatorFor(boss, {});
    assert.deepEqual(lastOf(boss, "tune"), {});
});


// ---------------------------------------------------------------------------------------------
// Room for each creator.

const standAt = (p, x, y, z = 100) => { p.ready = true; p.position = { x, y, z }; };
const apart = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

test("a creator with nobody near stays where they are", () => {
    const sut = load();
    const hans = sut.player(1, "Hans");
    standAt(hans, 700, 3200);
    sut.api.openCreatorFor(hans);
    sut.advance(2_000);
    assert.deepEqual(hans.teleports, []);
});

test("two newcomers at the spawn are not left on top of each other: the second one is taken at least 30 m from the first", () => {
    const sut = load();
    const first = sut.player(1, "Hans");
    const second = sut.player(2, "Jan");
    standAt(first, 700, 3200);
    sut.api.openCreatorFor(first);
    sut.advance(2_000);
    assert.deepEqual(first.teleports, [], "nobody was near the first");

    standAt(second, 701, 3201);
    sut.api.openCreatorFor(second);
    sut.advance(2_000);
    assert.equal(second.teleports.length, 1);
    assert.ok(apart(second.position, first.position) >= 30, `moved ${apart(second.position, first.position)} m from the first`);
    assert.deepEqual(first.teleports, [], "the first is not disturbed");
    assert.ok(sut.state.logs.some((line) => /Jan tinha alguém a menos de 30 m/.test(line)));

    sut.advance(10_000);
    assert.equal(second.teleports.length, 1, "once per creator, not at every look at them");
});

test("a third finds ground clear of both, ring by ring", () => {
    const sut = load();
    const players = [1, 2, 3].map((id) => sut.player(id, `Jogador${id}`));
    for (const p of players) {
        standAt(p, 700, 3200);
        sut.api.openCreatorFor(p);
        sut.advance(2_000);
    }
    for (const [a, b] of [[0, 1], [0, 2], [1, 2]]) {
        assert.ok(apart(players[a].position, players[b].position) >= 30, `${a} and ${b} are apart`);
    }
});

test("a somebody who is only standing there counts too, in the same world only", () => {
    const sut = load();
    const bystander = sut.player(9, "Passante", "7656119800000000099", { gender: "male", head: "", hair: "", beard: "", body: "" });
    standAt(bystander, 700, 3205);
    const elsewhere = sut.player(8, "Outro mundo");
    standAt(elsewhere, 700, 3200);
    elsewhere.virtualWorld = 7;
    const newcomer = sut.player(1, "Hans");
    standAt(newcomer, 700, 3200);
    sut.api.openCreatorFor(newcomer);
    sut.advance(2_000);
    assert.equal(newcomer.teleports.length, 1, "the passer-by is in the picture");

    const alone = sut.player(2, "Jan");
    standAt(alone, 2000, 500);
    sut.api.openCreatorFor(alone);
    elsewhere.position = { x: 2000, y: 500, z: 100 };
    sut.advance(2_000);
    assert.deepEqual(alone.teleports, [], "somebody in another world is nobody's picture");
});

test("with no navigation mesh, or no ground within reach, the creator stays: better in the picture than in the sea", () => {
    const noMesh = load();
    noMesh.state.navReady = false;
    const a = noMesh.player(1, "Hans");
    const b = noMesh.player(2, "Jan");
    standAt(a, 700, 3200);
    standAt(b, 700, 3200);
    noMesh.api.openCreatorFor(b);
    noMesh.advance(2_000);
    assert.deepEqual(b.teleports, []);

    const sea = load();
    sea.state.ground = () => null;
    const c = sea.player(1, "Hans");
    const d = sea.player(2, "Jan");
    standAt(c, 700, 3200);
    standAt(d, 700, 3200);
    sea.api.openCreatorFor(d);
    sea.advance(2_000);
    assert.deepEqual(d.teleports, []);

    const cliff = load();
    cliff.state.ground = (spot) => ({ x: spot.x, y: spot.y, z: spot.z + 200 });
    const e = cliff.player(1, "Hans");
    const f = cliff.player(2, "Jan");
    standAt(e, 700, 3200);
    standAt(f, 700, 3200);
    cliff.api.openCreatorFor(f);
    cliff.advance(2_000);
    assert.deepEqual(f.teleports, [], "a mountain top is no booth");
});

test("a creator is taken back to where they stood when the look is accepted, or the creator is left, if it is free", () => {
    const sut = load({ saved: { "76561198000000001": { appearance: HENRY, nickname: "Hans", name: "Hans", epithet: "" } } });
    const blocker = sut.player(9, "Passante");
    standAt(blocker, 700, 3200);
    const hans = sut.player(1, "Hans", "76561198000000001");
    standAt(hans, 701, 3200);
    sut.api.openCreatorFor(hans, "both");
    sut.advance(2_000);
    assert.equal(hans.teleports.length, 1);

    sut.fire("cancel", hans, {});
    sut.advance(1_000);
    assert.equal(hans.teleports.length, 1, "not yet: the page is still going");
    blocker.position = { x: 5000, y: 5000, z: 0 };
    sut.advance(1_000);
    assert.equal(hans.teleports.length, 2, "back at the spot the creator found them at");
    assert.deepEqual({ x: hans.position.x, y: hans.position.y }, { x: 701, y: 3200 });
});

test("a creator whose place was taken meanwhile stays where they are, and one who never moved is never moved back", () => {
    const sut = load({ saved: { "76561198000000001": { appearance: HENRY, nickname: "Hans", name: "Hans", epithet: "" } } });
    const hans = sut.player(1, "Hans", "76561198000000001");
    standAt(hans, 700, 3200);
    const other = sut.player(2, "Jan");
    standAt(other, 702, 3200);
    sut.api.openCreatorFor(hans, "both");
    sut.advance(2_000);
    assert.equal(hans.teleports.length, 1);
    sut.fire("cancel", hans, {});
    sut.advance(5_000);
    assert.equal(hans.teleports.length, 1, "Jan is still standing in the spot");

    const calm = sut.player(3, "Calma", "76561198000000003");
    standAt(calm, 4000, 100);
    sut.api.openCreatorFor(calm, "both");
    sut.advance(2_000);
    sut.fire("cancel", calm, {});
    sut.advance(5_000);
    assert.deepEqual(calm.teleports, []);
});

test("a character asked to be made again (/creator refazer) cannot leave the creator, and may keep or change the name", () => {
    const named = { appearance: { gender: "male", head: "m_head_000", hair: "m_hair_001_black", beard: "", body: "m_body_pale_01" }, nickname: "Garcia", name: "Vavřinec", epithet: "", redo: true };
    const sut = load({ saved: { 765: named } });
    const garcia = sut.player(1, "Garcia", "765", named.appearance);
    sut.api.openCreatorFor(garcia);
    const open = lastOf(garcia, "begin");
    assert.equal(open.mandatory, true, "no way out until it is done");
    assert.deepEqual(open.identity, { name: "Vavřinec", epithet: "", locked: false, suggestion: "" }, "the old name is offered and may be changed");
    sut.fire("cancel", garcia);
    assert.match(sut.state.logs.join("\n"), /tentou sair do criador/);
    sut.fire("accept", garcia, { look: LOOK, name: "Vavřinec", epithet: "ii" });
    assert.deepEqual(plain(sut.state.saves[0].identity), { name: "Vavřinec", epithet: "ii" });
    assert.equal(sut.characters.saved["765"].redo, undefined, "saving the character drops the request");
});

test("a newcomer is sent clothes to choose, is dressed in each pick, and keeps them: the starter outfit is not put over them", () => {
    const sut = load();
    const hans = sut.player(1, "Hans");
    sut.api.openCreatorFor(hans);
    assert.equal(sut.state.large.length, 1, "the clothes, with their icons, in pieces");
    assert.equal(sut.state.large[0].name, "creator.clothes");

    sut.fire("dress", hans, { gender: "male", top: 0, legs: 0, feet: 0 });
    // By GUID: the table names were refused by the game, and no newcomer was ever dressed by the tab until 2026-10-25.
    assert.deepEqual(plain(sut.state.dressed.at(-1).items), [
        { item: guid("TunicLong01_m01_C"), amount: 1, equipped: 1 },
        { item: guid("HoseSeparate01_m01_E"), amount: 1, equipped: 1 },
        { item: guid("BootsAnkle01_m01_C"), amount: 1, equipped: 1 },
    ]);
    sut.fire("dress", hans, { gender: "male", top: 0, legs: 7, feet: 0 });
    assert.equal(sut.state.dressed.at(-1).items.length, 2, "a number out of range is no piece");
    sut.fire("accept", hans, { look: LOOK, name: "Hans" });
    assert.deepEqual(sut.state.outfits, [1], "dressed for this body's gender: the starter outfit is left off");
    assert.deepEqual(sut.state.starter, [1]);
});

const kept = (id, name, equipped) => ({ id, item: guid(name), name, amount: 1, quality: 1, health: 10, condition: 1, equipped, metadata: { quality: 1 } });

test("a character already made tries the pieces on: what it wore in those parts and its hood come off, the rest stays, and all of it comes back when it leaves (2026-10-25)", () => {
    const sut = load({ saved: { 765: RETURNING } });
    const back = sut.player(2, "Back", "765", RETURNING.appearance);
    sut.state.inventory = {
        ready: true,
        revision: 3,
        quickslots: { slots: ["r-sword"] },
        items: [kept("r-tunic", "TunicShort02_m03_A", 1), kept("r-hose", "HoseLoose01_m02_C", 1), kept("r-hood", "Hood01_m01_A", 1), kept("r-gloves", "Gloves01_m01_A", 1), kept("r-sword", "swordLong", 1), kept("r-bread", "bread", 0)],
    };
    sut.api.openCreatorFor(back);
    assert.equal(sut.state.large.length, 1, "the tab is there for somebody with a character too");
    assert.equal(sut.state.large[0].value.mode, "give");
    sut.fire("dress", back, { gender: "male", top: 0, legs: -1, feet: -1 });
    const tried = plain(sut.state.dressed.at(-1));
    const wearing = Object.fromEntries(tried.items.map((row) => [row.id ?? row.item, row.equipped]));
    assert.deepEqual(wearing, { "r-tunic": 0, "r-hose": 1, "r-hood": 0, "r-gloves": 1, "r-sword": 1, "r-bread": 0, [guid("TunicLong01_m01_C")]: 1 }, "the tunic tried on in place of the one worn, the hood off for the face; the hose, the gloves and the sword stay");
    assert.deepEqual(tried.quickslots, { slots: ["r-sword"] }, "the quick slots as they were");

    sut.fire("cancel", back);
    const back_ = plain(sut.state.dressed.at(-1));
    assert.deepEqual(back_.items.map((row) => [row.id, row.equipped]), [["r-tunic", 1], ["r-hose", 1], ["r-hood", 1], ["r-gloves", 1], ["r-sword", 1], ["r-bread", 0]], "everything back as it was, the piece tried on gone");
    assert.deepEqual(back_.quickslots, { slots: ["r-sword"] });

    const eva = sut.player(3, "Eva");
    sut.api.openCreatorFor(eva);
    sut.fire("dress", eva, { gender: "female", top: 0, feet: 0 });
    sut.fire("accept", eva, { look: LOOK, name: "Evald" });
    assert.deepEqual(sut.state.outfits, [], "dressed as a woman, accepted as a man: the outfit kit decides");
});

test("a piece is told by the part it covers: the torso's layers, the legs, the feet, the head; anything else is none", () => {
    const sut = load();
    assert.deepEqual(["TunicLong04_m02_D", "F_SimpleDress01_m01_D", "Gambeson03_m01_A", "HoseLoose01_m02_C", "LegsPlate07_m01", "BootsAnkle02_m01_B", "F_Shoes02_m01_B", "Hood01_m01_A", "Bascinet02_m01", "Gloves01_m01_A", "Caparison01"].map((name) => sut.api.partWorn(name)), ["top", "top", "top", "legs", "legs", "feet", "feet", "head", "head", null, null]);
});

test("a remake of the look (\"Refazer aparência\") lets the name change, may be left, and is spent only by saving (2026-10-25)", () => {
    const sut = load({ saved: { 765: RETURNING } });
    const back = sut.player(2, "Back", "765", RETURNING.appearance);
    const spent = [];
    sut.api.openCreatorFor(back, "male", { remake: (player) => spent.push(player.id) });
    const open = lastOf(back, "begin");
    assert.equal(open.mandatory, false, "it may be left");
    assert.deepEqual(open.identity, { name: "Hans", epithet: "", locked: false, suggestion: "" }, "the name is free to change");
    sut.fire("cancel", back);
    assert.deepEqual(spent, [], "left without saving: not spent");

    sut.api.openCreatorFor(back, "male", { remake: (player) => spent.push(player.id) });
    sut.fire("accept", back, { look: LOOK, name: "Henrique", epithet: "" });
    assert.deepEqual(spent, [2]);
    assert.deepEqual(plain(sut.state.saves.at(-1).identity), { name: "Henrique", epithet: "" });
    assert.ok(sut.state.chat.some((entry) => entry.player === 2 && /^Aparência refeita: agora você é Henrique\./.test(entry.text)));
});

test("the pieces a character already made marks go to its inventory when it saves, each piece once, and the tab says which it has", () => {
    const sut = load({ saved: { 765: RETURNING } });
    const back = sut.player(2, "Back", "765", RETURNING.appearance);
    sut.api.openCreatorFor(back);
    sut.fire("accept", back, { look: LOOK, clothes: { gender: "male", top: 0, legs: -1, feet: 0 } });
    assert.deepEqual(plain(sut.state.added), [{ player: 2, item: "TunicLong01_m01_C", amount: 1 }, { player: 2, item: "BootsAnkle01_m01_C", amount: 1 }]);
    assert.ok(sut.state.chat.some((entry) => entry.player === 2 && /As 2 peças de roupa escolhidas foram para o seu inventário/.test(entry.text)));
    assert.deepEqual(plain(sut.characters.saved["765"].clothesGiven), ["TunicLong01_m01_C", "BootsAnkle01_m01_C"]);

    sut.api.openCreatorFor(back);
    assert.equal(sut.state.large.at(-1).value.male.top[0].got, true, "a piece already given is marked on the page");
    sut.fire("accept", back, { look: LOOK, clothes: { gender: "male", top: 0, legs: 0, feet: 0 } });
    assert.deepEqual(plain(sut.state.added.slice(2)), [{ player: 2, item: "HoseSeparate01_m01_E", amount: 1 }], "only the piece never given");

    sut.api.openCreatorFor(back);
    sut.fire("accept", back, { look: LOOK, clothes: { gender: "female", top: 0 } });
    assert.equal(sut.state.added.length, 3, "picks for the other gender than the look saved give nothing");
    sut.state.addRefused = "HoseSeparate01_m01_E";
    assert.deepEqual(plain(sut.api.giveClothes(back, "male", { gender: "male", top: 0, legs: 0, feet: 0 })), [], "everything given already");
});
