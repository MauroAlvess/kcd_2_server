const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// The barbers (src/server/barbers.ts): a look tried on the body, kept for a price or put back.

const dist = (name) => fs.readFileSync(path.join(__dirname, `../dist/server/${name}.js`), "utf8");
const plain = (value) => JSON.parse(JSON.stringify(value));

const TONES = ["black", "blonde", "ginger"];
const STYLES = ["01", "02", "03", "04", "05", "06", "07"];

/** Seven styles in three colours, three faces, two with beards to grow: the part of the game's catalog the barber reads. */
const APPEARANCES = {
    options: (part, gender) => {
        if (gender !== "male") return [];
        if (part === "head") return ["m_head_001", "m_head_002", "m_head_003"].map((name) => ({ name, group: null }));
        if (part === "body") return [{ name: "m_body_pale_01", group: null }];
        return STYLES.flatMap((style) => TONES.map((tone) => ({ name: `x_hair_${style}_${tone}`, group: `x_hair_${style}` })));
    },
    beards: (head) => (head === "m_head_003" ? [] : [{ name: "m_beard_01" }, { name: "UC_beard_barber_02" }]),
};

const LOOK = { gender: "male", head: "m_head_001", hair: "x_hair_01_black", beard: "", body: "m_body_pale_01" };

function load({ saved = LOOK, money: coinsHeld = 1000 } = {}) {
    const state = { logs: [], chat: [], pages: [], closed: [], appearances: [], saves: [], removed: [], money: coinsHeld, sessionOf: 0, nextSession: 40, handlers: new Map(), players: new Map(), applyOk: true };
    const base = {
        exports: {},
        console: { log: (line) => state.logs.push(line), error: (line) => state.logs.push(line) },
        Appearances: APPEARANCES,
        Chat: { sendToPlayer: (player, text) => state.chat.push(text) },
        Events: { on: (name, fn) => state.handlers.set(name, fn) },
        setInterval: () => 1,
        Player: { getById: (id) => state.players.get(id) ?? null },
        Dialogue: {
            open: (id, page) => { state.pages.push(plain(page)); return state.nextSession++; },
            update: (session, page) => { state.pages.push(plain(page)); return true; },
            close: (session) => { state.closed.push(session); return true; },
            sessionOf: () => state.sessionOf,
        },
        Inventory: {
            get: () => ({ items: [{ id: "m1", item: "5ef63059-322e-4e1b-abe8-926e100c770e", name: "money", amount: state.money }] }),
            remove: (player, request) => {
                const taken = request.units.reduce((sum, unit) => sum + unit.amount, 0);
                state.removed.push(taken);
                state.money -= taken;
                return { ok: true };
            },
        },
    };
    const realm = (name, extra = {}) => {
        const context = { ...base, ...extra, exports: {} };
        vm.runInNewContext(dist(name), context);
        return context.exports;
    };
    const money = realm("money");
    const catalog = realm("creator-catalog");
    const context = {
        ...base,
        require: (id) => {
            if (id === "./characters.js") {
                return { getCharacter: () => (saved === null ? null : { appearance: saved }), saveCharacter: (steamId, look, nickname) => state.saves.push(plain({ steamId, look, nickname })) };
            }
            if (id === "./creator-catalog.js") return catalog;
            if (id === "./money.js") return money;
            if (id === "./townsfolk.js") return { installPosts: () => ({ standing: () => new Map() }) };
            assert.fail(`unexpected require ${id}`);
        },
    };
    vm.runInNewContext(dist("barbers"), context);
    const player = (id = 1, steamId = "7656") => {
        const entry = {
            id, steamId, nickname: "Hans", ready: true, alive: true, appearance: LOOK, position: { x: 10, y: 10, z: 0 },
            setAppearance(look) { state.appearances.push(plain(look)); return state.applyOk; },
        };
        state.players.set(id, entry);
        return entry;
    };
    const barber = { id: 900, position: { x: 12, y: 10, z: 0 } };
    return { api: context.exports, state, player, barber, post: context.exports.BARBERS[0] };
}

const ids = (page) => page.options.map((option) => option.id);
const last = (sut) => sut.state.pages.at(-1);

function sit(sut, options) {
    const barbering = new sut.api.Barbering();
    const player = sut.player();
    assert.equal(barbering.open(player, sut.post, sut.barber), true);
    return { barbering, player, session: 40 + 0, ...options };
}

test("a barber has a chair in Kuttenberg, where the level has one, and in the villages of the roleplay", () => {
    const sut = load();
    assert.equal(sut.api.BARBERS.length, 5);
    assert.equal(sut.api.BARBERS[0].id, "barbeiro-kuttenberg");
    assert.deepEqual(plain(sut.api.BARBERS.slice(1).map((post) => post.id)), ["barbeiro-suchdol", "barbeiro-wysoka", "barbeiro-raborsch", "barbeiro-malesov"]);
    assert.equal(sut.api.BARBER_PRICE, 20);
});

test("sitting down offers the haircut, the dye and, for a face that grows one, the beard; a face that cannot grow one is told so", () => {
    const sut = load();
    const { barbering } = sit(sut);
    const menu = last(sut);
    assert.deepEqual(ids(menu), ["hair", "tone", "beard", "leave"]);
    assert.ok(menu.options.every((option) => option.enabled));
    assert.match(menu.line, /Cada serviço custa 20 moedas/);

    const bald = load({ saved: { ...LOOK, head: "m_head_003" } });
    sit(bald);
    assert.deepEqual(last(bald).options.map((option) => [option.id, option.enabled]), [["hair", true], ["tone", true], ["beard", false], ["leave", true]]);
    assert.match(last(bald).options[2].text, /o seu rosto não deixa/);
    assert.equal(barbering.sitting(), 1);
});

test("nobody sits who has no saved account, is busy in another talk, or is not there", () => {
    const sut = load();
    const barbering = new sut.api.Barbering();
    assert.equal(barbering.open(sut.player(1, ""), sut.post, sut.barber), false, "no Steam id: nothing could be kept");
    sut.state.sessionOf = 3;
    assert.equal(barbering.open(sut.player(2), sut.post, sut.barber), false);
    sut.state.sessionOf = 0;
    const dead = sut.player(3);
    dead.alive = false;
    assert.equal(barbering.open(dead, sut.post, sut.barber), false);
});

test("the haircuts are listed five at a time, with the player's own marked, and a pick is tried on the body at once, in the same colour", () => {
    const sut = load();
    const { barbering, player } = sit(sut);
    barbering.choose(40, player, "hair");
    let page = last(sut);
    assert.deepEqual(page.options.map((option) => option.text), ["Corte 1 (o seu)", "Corte 2", "Corte 3", "Corte 4", "Corte 5", "Mais ›", "Voltar"]);
    assert.match(page.line, /1 a 5 de 7/);
    barbering.choose(40, player, "more");
    page = last(sut);
    assert.deepEqual(page.options.map((option) => option.text), ["Corte 6", "Corte 7", "‹ Os de antes", "Voltar"]);
    assert.match(page.line, /6 a 7 de 7/);
    barbering.choose(40, player, "less");
    assert.equal(last(sut).options[0].text, "Corte 1 (o seu)");

    sut.state.appearances.length = 0;
    barbering.choose(40, player, "pick:3");
    assert.deepEqual(sut.state.appearances, [{ ...LOOK, hair: "x_hair_04_black" }], "style 4 in the colour the player wears");
    assert.deepEqual(ids(last(sut)), ["accept", "other", "undo"]);
    assert.match(last(sut).options[0].text, /Ficar assim \(20 moedas\)/);
});

test("a yes costs the price, is saved as the character's look and becomes the one the barber puts back to; a no, or leaving, puts the old look back", () => {
    const sut = load();
    const { barbering, player } = sit(sut);
    barbering.choose(40, player, "hair");
    barbering.choose(40, player, "pick:3");
    barbering.choose(40, player, "accept");
    assert.deepEqual(sut.state.removed, [200], "twenty coins are two hundred units");
    assert.deepEqual(sut.state.saves, [{ steamId: "7656", look: { ...LOOK, hair: "x_hair_04_black" }, nickname: "Hans" }]);
    assert.deepEqual(ids(last(sut)), ["hair", "tone", "beard", "leave"], "back to the menu");
    assert.ok(sut.state.chat.some((line) => /Pronto\. São 20 moedas\./.test(line)));

    sut.state.appearances.length = 0;
    barbering.choose(40, player, "hair");
    barbering.choose(40, player, "pick:5");
    barbering.choose(40, player, "undo");
    assert.deepEqual(sut.state.appearances.at(-1), { ...LOOK, hair: "x_hair_04_black" }, "what they paid for, not the first look");
    assert.equal(sut.state.saves.length, 1);

    barbering.choose(40, player, "hair");
    barbering.choose(40, player, "pick:0");
    barbering.choose(40, player, "leave");
    assert.deepEqual(sut.state.appearances.at(-1), { ...LOOK, hair: "x_hair_04_black" });
    assert.deepEqual(sut.state.closed, [40]);
    assert.equal(barbering.sitting(), 0);
});

test("without the money nothing is taken or saved, and the choice stays on the body to pick another or put back", () => {
    const sut = load({ money: 150 });
    const { barbering, player } = sit(sut);
    barbering.choose(40, player, "hair");
    barbering.choose(40, player, "pick:2");
    barbering.choose(40, player, "accept");
    assert.deepEqual(sut.state.removed, []);
    assert.deepEqual(sut.state.saves, []);
    assert.ok(sut.state.chat.some((line) => /custa 20 moedas e você não tem o bastante/.test(line)));
    assert.deepEqual(ids(last(sut)), ["accept", "other", "undo"], "still asking");
    barbering.choose(40, player, "other");
    assert.deepEqual(ids(last(sut)).slice(-1), ["back"]);
    barbering.choose(40, player, "back");
    assert.deepEqual(sut.state.appearances.at(-1), LOOK, "the old look is back on the body, since nothing was kept");
});

test("the dye lists the colours of the style worn, and a new style keeps the colour", () => {
    const sut = load({ saved: { ...LOOK, hair: "x_hair_02_blonde" } });
    const { barbering, player } = sit(sut);
    barbering.choose(40, player, "tone");
    assert.deepEqual(last(sut).options.map((option) => option.text), ["Preto", "Ruivo", "Louro (o seu)", "Voltar"], "in the order the game's colours go");
    barbering.choose(40, player, "pick:1");
    assert.deepEqual(sut.state.appearances.at(-1), { ...LOOK, hair: "x_hair_02_ginger" });
    barbering.choose(40, player, "undo");
    barbering.choose(40, player, "hair");
    barbering.choose(40, player, "pick:4");
    assert.deepEqual(sut.state.appearances.at(-1), { ...LOOK, hair: "x_hair_05_blonde" }, "style 5, blonde as before");
});

test("the beard lists none and what this face can grow; none shaves", () => {
    const sut = load({ saved: { ...LOOK, beard: "m_beard_01" } });
    const { barbering, player } = sit(sut);
    barbering.choose(40, player, "beard");
    assert.deepEqual(last(sut).options.map((option) => option.text), ["Sem barba", "Barba 1", "Barba 2 (a sua)", "Voltar"], "the game's names in order: the barber's before the plain ones");
    barbering.choose(40, player, "pick:-1");
    assert.deepEqual(sut.state.appearances.at(-1), { ...LOOK, beard: "" });
    barbering.choose(40, player, "accept");
    assert.deepEqual(sut.state.saves[0].look.beard, "");
    barbering.choose(40, player, "beard");
    barbering.choose(40, player, "pick:0");
    assert.deepEqual(sut.state.appearances.at(-1), { ...LOOK, beard: "UC_beard_barber_02" });
});

test("a look the game will not put on is told, and the old one stays", () => {
    const sut = load();
    const { barbering, player } = sit(sut);
    sut.state.applyOk = false;
    barbering.choose(40, player, "hair");
    barbering.choose(40, player, "pick:1");
    assert.ok(sut.state.chat.some((line) => /O jogo não aceitou esse visual agora/.test(line)));
    assert.deepEqual(ids(last(sut)).slice(-1), ["back"], "back on the list");
    assert.deepEqual(sut.state.appearances.at(-1), LOOK);
});

test("a talk that ends any way, or a player who walks off, dies or leaves, puts back what was only tried", () => {
    const ended = load();
    const a = sit(ended);
    a.barbering.choose(40, a.player, "hair");
    a.barbering.choose(40, a.player, "pick:1");
    ended.state.appearances.length = 0;
    a.barbering.closed(40);
    assert.deepEqual(ended.state.appearances, [LOOK]);
    assert.equal(a.barbering.sitting(), 0);
    a.barbering.choose(40, a.player, "hair");
    assert.equal(ended.state.appearances.length, 1, "a chair that is gone answers nothing");

    const away = load();
    const b = sit(away);
    b.barbering.choose(40, b.player, "hair");
    b.barbering.choose(40, b.player, "pick:1");
    b.barbering.tick();
    assert.equal(b.barbering.sitting(), 1, "near enough");
    b.player.position = { x: 50, y: 10, z: 0 };
    away.state.appearances.length = 0;
    b.barbering.tick();
    assert.deepEqual(away.state.appearances, [LOOK]);
    assert.deepEqual(away.state.closed, [40]);
    assert.ok(away.state.chat.some((line) => /Você se afastou do barbeiro/.test(line)));

    const gone = load();
    const c = sit(gone);
    gone.state.players.delete(c.player.id);
    c.barbering.tick();
    assert.equal(c.barbering.sitting(), 0);
    assert.deepEqual(gone.state.closed, [40]);
});

test("only the one in the chair answers it", () => {
    const sut = load();
    const { barbering } = sit(sut);
    const other = sut.player(2);
    barbering.choose(40, other, "hair");
    assert.deepEqual(ids(last(sut)), ["hair", "tone", "beard", "leave"], "unchanged");
    barbering.choose(99, other, "hair");
    assert.equal(sut.state.pages.length, 1);
});
