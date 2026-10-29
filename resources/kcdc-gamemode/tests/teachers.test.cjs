const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const inventoryAdd = require("./inventory-add-module.cjs");

// The skill teachers (src/server/teachers.ts): a lesson up to the next step of the game's table, for its price.

const dist = (name) => fs.readFileSync(path.join(__dirname, `../dist/server/${name}.js`), "utf8");
const plain = (value) => JSON.parse(JSON.stringify(value));

const DATA = {
    LESSON_PRICES: [[5, 75], [10, 200], [15, 500], [20, 1000]],
    TEACHERS: [
        { id: "kmaster", name: "Mestre Espadeiro", female: false, x: 100, y: 100, z: 10, lessons: [["weapon_sword", 15], ["marksmanship", 5]] },
        { id: "kmaid", name: "Rosa", female: true, x: 300, y: 300, z: 10, lessons: [["scholarship", 10]] },
    ],
};

function load({ money = 100_000, levels = { weapon_sword: 0, marksmanship: 0, scholarship: 3 }, setLevelOk = true } = {}) {
    const state = { logs: [], chat: [], pages: [], closed: [], removed: [], added: [], raised: [], money, levels: { ...levels }, sessionOf: 0, nextSession: 70, players: new Map(), setLevelOk };
    const base = {
        exports: {},
        console: { log: (line) => state.logs.push(line), error: (line) => state.logs.push(line) },
        Chat: { sendToPlayer: (player, text) => state.chat.push(text) },
        Events: { on() {} },
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
            add: (player, request) => {
                state.added.push(request.amount);
                state.money += request.amount;
                return { ok: true };
            },
        },
    };
    const money_ = (() => {
        const context = { ...base, require: (id) => (id === "./inventory-add.js" ? inventoryAdd(context) : assert.fail(`unexpected require ${id}`)), exports: {} };
        vm.runInNewContext(dist("money"), context);
        return context.exports;
    })();
    const context = {
        ...base,
        require: (id) => {
            if (id === "./teachers-data.js") return DATA;
            if (id === "./money.js") return money_;
            if (id === "./townsfolk.js") return { installPosts: () => ({ standing: () => new Map() }) };
            assert.fail(`unexpected require ${id}`);
        },
    };
    vm.runInNewContext(dist("teachers"), context);
    const player = (id = 1, steamId = "7656") => {
        const entry = {
            id, steamId, nickname: "Hans", ready: true, alive: true, position: { x: 100, y: 102, z: 10 },
            getTrack: (track) => (state.levels[track] === undefined ? null : { level: state.levels[track] }),
            setLevel(track, level) { if (!state.setLevelOk) return false; state.raised.push([track, level]); return true; },
        };
        state.players.set(id, entry);
        return entry;
    };
    return { api: context.exports, state, player, npc: { id: 900, position: { x: 100, y: 100, z: 10 } } };
}

const last = (sut) => sut.state.pages.at(-1);
const texts = (page) => page.options.map((option) => option.text);

function lecture(sut, teacher = "kmaster") {
    const teaching = new sut.api.Teaching();
    const player = sut.player();
    assert.equal(teaching.open(player, teacher, sut.npc), true);
    return { teaching, player };
}

test("the next step of the lesson table above a level, up to what the teacher teaches", () => {
    const { api } = load();
    assert.deepEqual(plain(api.nextLesson(0, 15)), { level: 5, price: 75 });
    assert.deepEqual(plain(api.nextLesson(4, 15)), { level: 5, price: 75 });
    assert.deepEqual(plain(api.nextLesson(5, 15)), { level: 10, price: 200 });
    assert.deepEqual(plain(api.nextLesson(12, 15)), { level: 15, price: 500 });
    assert.equal(api.nextLesson(15, 15), null, "nothing above what he teaches");
    assert.equal(api.nextLesson(7, 5), null);
    assert.deepEqual(plain(api.nextLesson(15, 20)), { level: 20, price: 1000 });
});

test("a teacher stands for each one the data names, a woman as a woman, and the skills are told in Portuguese", () => {
    const { api } = load();
    assert.deepEqual(plain(api.POSTS.map((post) => [post.id, post.name, post.soul])), [["kmaster", "Mestre Espadeiro", "townsman"], ["kmaid", "Rosa", "townswoman"]]);
    assert.equal(api.SKILL_LABELS.weapon_sword, "Espadas (esgrima)");
    assert.match(api.SKILL_LABELS.marksmanship, /arco e besta, caça/);
});

test("the list says, for each skill, the pupil's level, the step the lesson takes them to and what it costs", () => {
    const sut = load({ levels: { weapon_sword: 6, marksmanship: 5, scholarship: 3 } });
    lecture(sut);
    const page = last(sut);
    assert.match(page.line, /Mestre Espadeiro: o que quer aprender\?/);
    assert.deepEqual(texts(page), ["Espadas (esgrima): do nível 6 ao 10, por 200 moedas", "Pontaria (arco e besta, caça): nível 5; não tenho mais o que lhe ensinar", "Sair"]);
    assert.deepEqual(page.options.map((option) => option.enabled), [true, false, true]);
});

test("a lesson costs the step's price, takes the skill up to it with the game's own advance, and the list moves on at once, before the game reports the new level", () => {
    const sut = load();
    const { teaching, player } = lecture(sut);
    teaching.choose(70, player, "learn:weapon_sword");
    assert.deepEqual(sut.state.removed, [750], "seventy-five coins are seven hundred and fifty units");
    assert.deepEqual(sut.state.raised, [["weapon_sword", 5]]);
    assert.ok(sut.state.chat.some((line) => /Mestre Espadeiro lhe ensinou: Espadas \(esgrima\) agora no nível 5 \(75 moedas\)/.test(line)));
    assert.equal(texts(last(sut))[0], "Espadas (esgrima): do nível 5 ao 10, por 200 moedas", "the level the game has not yet reported is not paid for twice");
    teaching.choose(70, player, "learn:weapon_sword");
    assert.deepEqual(sut.state.raised.at(-1), ["weapon_sword", 10]);
    assert.deepEqual(sut.state.removed, [750, 2000]);
    assert.ok(sut.state.logs.some((line) => /teachers: Hans aprendeu weapon_sword até o nível 10 com kmaster por 200 moedas/.test(line)));
});

test("without the money, or with nothing left to teach, or a skill the teacher does not teach, nothing is taken", () => {
    const poor = load({ money: 500 });
    const a = lecture(poor);
    a.teaching.choose(70, a.player, "learn:weapon_sword");
    assert.deepEqual([poor.state.removed, poor.state.raised], [[], []]);
    assert.ok(poor.state.chat.some((line) => /A lição custa 75 moedas e você não tem o bastante/.test(line)));

    const done = load({ levels: { weapon_sword: 15, marksmanship: 0, scholarship: 0 } });
    const b = lecture(done);
    b.teaching.choose(70, b.player, "learn:weapon_sword");
    assert.ok(done.state.chat.some((line) => /Não tenho mais o que lhe ensinar nisso/.test(line)));
    b.teaching.choose(70, b.player, "learn:scholarship");
    assert.deepEqual([done.state.removed, done.state.raised], [[], []], "he teaches no scholarship");
});

test("a lesson the game will not take is paid back; a level the game has not reported cannot be bought", () => {
    const refused = load({ setLevelOk: false });
    const a = lecture(refused);
    a.teaching.choose(70, a.player, "learn:weapon_sword");
    assert.deepEqual([refused.state.removed, refused.state.added], [[750], [750]]);
    assert.equal(refused.state.money, 100_000, "the same money as before");
    assert.ok(refused.state.chat.some((line) => /seu dinheiro foi devolvido/.test(line)));
    assert.equal(texts(last(refused))[0], "Espadas (esgrima): do nível 0 ao 5, por 75 moedas", "and no step was counted");

    const unread = load({ levels: {} });
    const b = lecture(unread);
    assert.match(texts(last(unread))[0], /o jogo ainda não leu o seu nível/);
    b.teaching.choose(70, b.player, "learn:weapon_sword");
    assert.deepEqual(unread.state.removed, []);
});

test("nobody sits who has no saved account or is busy in a talk; only the pupil answers; leaving closes it", () => {
    const sut = load();
    const teaching = new sut.api.Teaching();
    assert.equal(teaching.open(sut.player(1, ""), "kmaster", sut.npc), false);
    sut.state.sessionOf = 5;
    assert.equal(teaching.open(sut.player(2), "kmaster", sut.npc), false);
    sut.state.sessionOf = 0;
    assert.equal(teaching.open(sut.player(3), "nobody", sut.npc), false);

    const pupil = sut.player(4);
    assert.equal(teaching.open(pupil, "kmaid", sut.npc), true);
    teaching.choose(70, sut.player(5), "learn:scholarship");
    assert.deepEqual(sut.state.raised, [], "somebody else's talk");
    teaching.choose(70, pupil, "leave");
    assert.deepEqual(sut.state.closed, [70]);
    assert.equal(teaching.sitting(), 0);
});

test("a lecture ends when the pupil walks off, dies or leaves, or the talk is closed", () => {
    const sut = load();
    const { teaching, player } = lecture(sut);
    teaching.tick();
    assert.equal(teaching.sitting(), 1);
    player.position = { x: 200, y: 100, z: 10 };
    teaching.tick();
    assert.deepEqual(sut.state.closed, [70]);

    const dead = lecture(load());
    dead.player.alive = false;
    dead.teaching.tick();
    assert.equal(dead.teaching.sitting(), 0);

    const closed = lecture(load());
    closed.teaching.closed(70);
    assert.equal(closed.teaching.sitting(), 0);
});
