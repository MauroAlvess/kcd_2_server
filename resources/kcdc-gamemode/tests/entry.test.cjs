// The door of the server (src/server/entry.ts, entry-quiz.ts, 2026-10-29): anyone comes in, and the list of approved players is a quiz of ten questions, (the trailer that came first was taken out on 2026-11-09).
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const dist = (name) => fs.readFileSync(path.join(__dirname, "../dist/server", name), "utf8");
const plain = (value) => JSON.parse(JSON.stringify(value));
const FILE = "playerdata/entry.json";
const HANS = "76561198000000001";
const KAT = "76561198000000002";
const ADMIN = "76561198000000003";

const quizBox = { exports: {} };
vm.runInNewContext(dist("entry-quiz.js"), quizBox);
const QUIZ = quizBox.exports;

// ------------------------------------------------------------------------------------------------ the questions

test("the bank: every question has four different options in both languages, a right answer among them, and an id of its own; there are more than ten", () => {
    assert.ok(QUIZ.BANK.length > QUIZ.QUESTIONS_PER_ATTEMPT, "more questions than one attempt asks");
    const ids = new Set();
    for (const question of QUIZ.BANK) {
        assert.ok(!ids.has(question.id), `repeated ${question.id}`);
        ids.add(question.id);
        for (const lang of ["pt", "en"]) {
            const text = question[lang];
            assert.ok(text.q.length > 5, `${question.id} ${lang}: a question`);
            assert.equal(text.options.length, 4, `${question.id} ${lang}`);
            assert.equal(new Set(text.options).size, 4, `${question.id} ${lang}: four different options`);
            assert.ok(text.options.every((option) => option.length > 0));
        }
        assert.ok([0, 1, 2, 3].includes(question.answer), question.id);
    }
    assert.equal(QUIZ.PASS_SCORE, 7);
    assert.equal(QUIZ.QUESTIONS_PER_ATTEMPT, 10);
});

test("an attempt draws ten different questions and shuffles the options of each; the page is sent no answer", () => {
    const attempt = QUIZ.draw(1_000);
    assert.equal(attempt.drawn.length, 10);
    assert.equal(new Set(attempt.drawn.map((one) => one.id)).size, 10);
    for (const one of attempt.drawn) assert.deepEqual([...one.order].sort(), [0, 1, 2, 3], "a permutation of the four");
    const shown = QUIZ.view(attempt);
    assert.equal(shown.length, 10);
    const text = JSON.stringify(shown);
    assert.ok(!/"answer"/.test(text), "no answer key goes to the page");
    for (const [at, one] of shown.entries()) {
        const question = QUIZ.BANK.find((candidate) => candidate.id === one.id);
        assert.deepEqual([...one.pt.options].sort(), [...question.pt.options].sort(), "the same options, shuffled");
        // Both languages in the same order: the place of the right option is the same in each.
        const right = attempt.drawn[at].order.indexOf(question.answer);
        assert.equal(one.pt.options[right], question.pt.options[question.answer]);
        assert.equal(one.en.options[right], question.en.options[question.answer]);
    }
    const again = QUIZ.draw(2_000);
    assert.notDeepEqual(plain(again.drawn.map((one) => one.id)), plain(attempt.drawn.map((one) => one.id)), "a second try is not the first one again (overwhelmingly likely)");
});

test("grading counts the places picked: the right ones all, none, and what is not a place of 0 to 3 is wrong", () => {
    const attempt = QUIZ.draw(1_000, 10, () => 0.5);
    const rightPicks = attempt.drawn.map((one) => one.order.indexOf(QUIZ.BANK.find((candidate) => candidate.id === one.id).answer));
    assert.equal(QUIZ.grade(attempt, rightPicks), 10);
    assert.equal(QUIZ.grade(attempt, rightPicks.map((pick) => (pick + 1) % 4)), 0);
    assert.equal(QUIZ.grade(attempt, [...rightPicks.slice(0, 7), 9, -1, "x"]), 7, "seven right, the rest are not places");
    assert.equal(QUIZ.grade(attempt, []), 0);
    assert.equal(QUIZ.grade(attempt, [1.5, null, undefined, {}, [], NaN, Infinity, "1", true, false]), 0);
    // A seeded shuffle is a permutation whatever the random numbers say.
    for (const fixed of [0, 0.999999, 0.5]) assert.deepEqual([...QUIZ.shuffled([1, 2, 3, 4, 5], () => fixed)].sort(), [1, 2, 3, 4, 5]);
});

// ------------------------------------------------------------------------------------------------ the door

function load({ saved = null, diskCorrupt = false } = {}) {
    const files = new Map();
    if (saved !== null) files.set(FILE, JSON.stringify(saved));
    if (diskCorrupt) files.set(FILE, "{ not json");
    const disk = {
        readFileSync(file) { if (!files.has(file)) throw new Error("ENOENT"); return files.get(file); },
        writeFileSync(file, data) { files.set(file, data); },
        mkdirSync() {},
        renameSync(from, to) { files.set(to, files.get(from)); files.delete(from); },
        existsSync: (file) => files.has(file),
    };
    const store = { exports: {}, require: () => disk };
    vm.runInNewContext(dist("store.js"), store);
    const state = { logs: [], chat: [], players: [], handlers: new Map(), client: new Map(), intervals: [], timeouts: [], gates: [], titles: 0, lang: "pt", admins: new Set() };
    const context = {
        exports: {},
        require: (id) => ({
            "./store.js": store.exports,
            "./auth.js": { isAdmin: (player) => state.admins.has(player.steamId) },
            "./command.js": { addCommandGate: (gate) => state.gates.push(gate) },
            "./craft-titles.js": { craftTitle: (key) => (key === "boas-vindas" ? (state.titles += 1, "data:image/webp;base64,TITLE") : "") },
            "./language.js": { languageOf: () => state.lang },
            "./entry-quiz.js": QUIZ,
        })[id] ?? assert.fail(`unexpected require ${id}`),
        console: { log: (line) => state.logs.push(line) },
        Date, JSON, Object, Number, Set, Map, Math, Array,
        Chat: { sendToPlayer: (player, text) => state.chat.push([player.id, text]) },
        Player: { all: () => state.players, getById: (id) => state.players.find((player) => player.id === id) ?? null },
        Events: {
            on: (name, fn) => state.handlers.set(name, [...(state.handlers.get(name) ?? []), fn]),
            onClient: (name, fn) => state.client.set(name, fn),
        },
        setInterval: (fn, ms) => { state.intervals.push({ fn, ms }); return state.intervals.length; },
        clearInterval() {},
        setTimeout: (fn, ms) => { state.timeouts.push({ fn, ms }); return state.timeouts.length; },
        clearTimeout(id) { if (state.timeouts[id - 1]) state.timeouts[id - 1].cancelled = true; },
    };
    vm.runInNewContext(dist("entry.js"), context);
    let nextId = 1;
    const player = (steamId, nickname = "Hans") => {
        const made = { id: nextId++, steamId, nickname, ready: true, sent: [], emit(name, payload) { this.sent.push({ name, payload: JSON.parse(payload) }); } };
        state.players.push(made);
        return made;
    };
    const fire = (name, sender, payload) => state.client.get(`kcdc-gamemode:${name}`)(sender, payload === undefined ? undefined : JSON.stringify(payload));
    const last = (who, name) => who.sent.filter((entry) => entry.name === `kcdc-gamemode:${name}`).at(-1)?.payload;
    return { api: context.exports, state, files, player, fire, last, events: context.Events };
}

/** The places that make every question right, found from what the page was sent (the right option's text, in the order it was shown). */
function rightPicks(questions) {
    return questions.map((one) => {
        const question = QUIZ.BANK.find((candidate) => candidate.id === one.id);
        return one.pt.options.indexOf(question.pt.options[question.answer]);
    });
}

test("whoever has not passed is pending; whoever has, in the file, is not; a player with no Steam id is not held (the Steam gate refuses them anyway)", () => {
    const sut = load({ saved: { v: 1, players: { [KAT]: { passed: 5, trailer: 4, score: 8, attempts: 1, lastAt: 5, name: "Kat" } } } });
    sut.api.installEntry();
    const hans = sut.player(HANS);
    const kat = sut.player(KAT, "Kat");
    assert.equal(sut.api.isPending(hans), true);
    assert.equal(sut.api.isPending(kat), false);
    assert.equal(sut.api.hasPassed(kat), true);
    assert.equal(sut.api.isPending({ id: 99, steamId: "" }), false);
    assert.ok(sut.state.logs.some((line) => /entry: 1 jogador\(es\) já aprovado\(s\)/.test(line)), sut.state.logs.join("|"));
});

test("the door is put up for a ready pending player at the questions, with no trailer; again every few seconds until the page says it is there (2026-11-09)", () => {
    const sut = load();
    sut.api.installEntry();
    const hans = sut.player(HANS);
    const early = sut.player(KAT, "Kat");
    early.ready = false;
    sut.api.lookAtPlayers(100_000);
    const open = sut.last(hans, "entry.open");
    assert.equal(open.stage, undefined, "there is no step before the questions");
    assert.equal(open.trailer, undefined);
    assert.equal(open.only, undefined);
    assert.equal(open.need, 7);
    assert.equal(open.total, 10);
    assert.equal(open.lang, "pt");
    assert.equal(open.img, "data:image/webp;base64,TITLE", "the title picture goes with the first ask");
    assert.equal(early.sent.length, 0, "not before the body is ready");
    sut.api.lookAtPlayers(101_000);
    assert.equal(hans.sent.length, 1, "not asked again within the interval");
    sut.api.lookAtPlayers(106_000);
    assert.equal(hans.sent.length, 2);
    assert.equal(sut.last(hans, "entry.open").img, undefined, "and the picture only once");

    sut.fire("entry.shown", hans);
    sut.api.lookAtPlayers(200_000);
    assert.equal(hans.sent.length, 2, "the page is up: nothing more is sent");
    assert.equal(sut.api.entrySettings.trailerUrl, undefined, "and the setting of a trailer is gone");
});

test("somebody who has passed is never asked and nothing waits for them: no trailer at any entry, whatever the file of settings says (2026-11-09)", () => {
    const sut = load({ saved: { v: 1, players: { [KAT]: { passed: 5, trailer: 4, score: 8, attempts: 1, lastAt: 5, name: "Kat" } } } });
    sut.api.installEntry();
    const kat = sut.player(KAT, "Kat");
    let went = 0;
    sut.api.whenAdmitted(kat, () => { went += 1; });
    assert.equal(went, 1, "what waited for the door goes at once");
    sut.api.lookAtPlayers(100_000);
    sut.api.lookAtPlayers(900_000);
    assert.equal(kat.sent.length, 0, "nothing is put up for them");
    assert.equal(sut.api.approve(HANS, "Hans"), true);
    const past = sut.player(HANS, "Hans");
    sut.api.lookAtPlayers(900_000);
    assert.equal(past.sent.length, 0);
    // The old field of the file is read and dropped at the next save.
    assert.equal(sut.api.approve(KAT, "Kat"), true);
    assert.equal(JSON.parse(sut.files.get(FILE)).players[KAT].trailer, undefined);
});

test("ten questions are asked, with no answer in them; ten right open the door, and the page is told how many, never which", () => {
    const sut = load();
    sut.api.installEntry();
    const hans = sut.player(HANS);
    sut.fire("entry.start", hans);
    const asked = sut.last(hans, "entry.questions");
    assert.equal(asked.total, 10);
    assert.equal(asked.need, 7);
    assert.equal(asked.questions.length, 10);
    assert.ok(!/answer/.test(JSON.stringify(asked)), "the answers stay on the server");
    sut.fire("entry.answer", hans, { picks: rightPicks(asked.questions) });
    const result = sut.last(hans, "entry.result");
    assert.deepEqual(plain({ score: result.score, passed: result.passed, need: result.need }), { score: 10, passed: true, need: 7 });
    assert.equal(sut.api.hasPassed(hans), true);
    const saved = JSON.parse(sut.files.get(FILE)).players[HANS];
    assert.ok(saved.passed > 0 && saved.score === 10 && saved.attempts === 1);
    assert.ok(sut.state.logs.some((line) => /Hans acertou 10 de 10: aprovado/.test(line)));
});

test("seven right is enough, six is not; a failed attempt waits before the next, and a new one asks other questions", () => {
    const sut = load();
    sut.api.installEntry();
    const hans = sut.player(HANS);
    sut.fire("entry.start", hans);
    const first = sut.last(hans, "entry.questions");
    const right = rightPicks(first.questions);
    sut.fire("entry.answer", hans, { picks: [...right.slice(0, 6), ...right.slice(6).map((pick) => (pick + 1) % 4)] });
    const failed = sut.last(hans, "entry.result");
    assert.equal(failed.score, 6);
    assert.equal(failed.passed, false);
    assert.equal(failed.wait, 30_000);
    assert.equal(sut.api.hasPassed(hans), false);

    sut.fire("entry.start", hans);
    const waiting = sut.last(hans, "entry.questions");
    assert.ok(waiting.wait > 0 && waiting.wait <= 30_000, "too soon: the page is told how long");
    assert.equal(waiting.questions, undefined);

    // Time passes: the record's own clock is the real one, so move the failure back.
    const record = JSON.parse(sut.files.get(FILE));
    record.players[HANS].lastAt = Date.now() - 31_000;
    sut.files.set(FILE, JSON.stringify(record));
    sut.api.loadEntry();
    sut.fire("entry.start", hans);
    const second = sut.last(hans, "entry.questions");
    assert.equal(second.questions.length, 10);
    sut.fire("entry.answer", hans, { picks: [...rightPicks(second.questions).slice(0, 7), 9, 9, 9] });
    assert.equal(sut.last(hans, "entry.result").passed, true, "seven right");
});

test("answers that were never asked for, from a player who has passed, or that are not a list, change nothing", () => {
    const sut = load();
    sut.api.installEntry();
    const hans = sut.player(HANS);
    sut.fire("entry.answer", hans, { picks: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] });
    assert.equal(hans.sent.length, 0, "no attempt, no answer");
    sut.fire("entry.start", hans);
    sut.fire("entry.answer", hans, "not json {");
    assert.equal(sut.last(hans, "entry.result").score, 0, "garbage grades as nothing right");
    sut.fire("entry.answer", hans, { picks: [0] });
    assert.equal(hans.sent.filter((entry) => entry.name.endsWith("entry.result")).length, 1, "an attempt is graded once");
});

test("a pass opens the door when the page says it is done, or after thirty seconds if it never does; what waited for it runs once", () => {
    const sut = load();
    sut.api.installEntry();
    const hans = sut.player(HANS);
    let opened = 0;
    sut.api.whenAdmitted(hans, () => { opened += 1; });
    assert.equal(opened, 0, "behind the door: it waits");
    sut.fire("entry.start", hans);
    sut.fire("entry.answer", hans, { picks: rightPicks(sut.last(hans, "entry.questions").questions) });
    assert.equal(opened, 0, "passed, but the page is still showing the result");
    sut.fire("entry.finish", hans);
    assert.equal(opened, 1);
    assert.ok(hans.sent.some((entry) => entry.name.endsWith("entry.close")));
    sut.fire("entry.finish", hans);
    assert.equal(opened, 1, "once");

    const slow = sut.player(KAT, "Kat");
    let late = 0;
    sut.api.whenAdmitted(slow, () => { late += 1; });
    sut.fire("entry.start", slow);
    sut.fire("entry.answer", slow, { picks: rightPicks(sut.last(slow, "entry.questions").questions) });
    const timer = sut.state.timeouts.find((one) => one.ms === 30_000 && !one.cancelled);
    assert.ok(timer, "thirty seconds");
    timer.fn();
    assert.equal(late, 1, "a page that never says it is done does not keep the player out");

    let now = 0;
    sut.api.whenAdmitted(hans, () => { now += 1; });
    assert.equal(now, 1, "somebody past the door is let through at once");
    sut.fire("entry.finish", sut.player(HANS, "outro"));
});

test("while pending, what the client sends is dropped but for the door's and the creator's; an administrator and a passed player are not held; commands the same", () => {
    const sut = load();
    // The gate wraps the bus before anybody registers a handler: the way index.ts does it.
    sut.api.installEntryGate();
    sut.api.installEntry();
    const got = [];
    sut.events.onClient("kcdc-gamemode:status.propLock", (sender) => got.push(sender.nickname));
    sut.events.onClient("kcdc-gamemode:creator.preview", (sender) => got.push(`preview:${sender.nickname}`));
    const hans = sut.player(HANS, "Hans");
    const kat = sut.player(KAT, "Kat");
    const boss = sut.player(ADMIN, "Boss");
    sut.state.admins.add(ADMIN);
    sut.api.approve(KAT, "Kat");
    const call = (name, who) => sut.state.client.get(`kcdc-gamemode:${name}`)(who, "{}");
    call("status.propLock", hans);
    call("status.propLock", kat);
    call("status.propLock", boss);
    call("creator.preview", hans);
    assert.deepEqual(got, ["Kat", "Boss", "preview:Hans"], "the pending player's panel press is dropped; the creator's message, the approved player and the administrator go through");

    // The door's own messages work for somebody pending: they are how the door is passed.
    call("entry.start", hans);
    assert.ok(hans.sent.some((entry) => entry.name.endsWith("entry.questions")));

    const gate = sut.state.gates[0];
    assert.equal(gate(hans, "me"), "Antes de jogar, responda às perguntas de entrada.");
    assert.equal(gate(hans, "preso"), "Antes de jogar, responda às perguntas de entrada.");
    for (const name of ["help", "idioma", "language", "admin"]) assert.equal(gate(hans, name), null, `/${name} is kept`);
    assert.equal(gate(kat, "me"), null, "past the door");
    assert.equal(gate(boss, "me"), null, "an administrator is never held");
});

test("an administrator approves and resets: approved, nobody is asked; reset, the questions come again", () => {
    const sut = load();
    sut.api.installEntry();
    assert.equal(sut.api.approve("not-a-steam-id", "x"), false);
    assert.equal(sut.api.approve(HANS, "Hans"), true);
    const hans = sut.player(HANS);
    assert.equal(sut.api.isPending(hans), false);
    assert.equal(sut.api.entryStats().passed, 1);
    assert.equal(sut.api.reset(KAT), false, "nobody of that name");
    assert.equal(sut.api.reset(HANS), true);
    assert.equal(sut.api.isPending(hans), true);
    assert.equal(JSON.parse(sut.files.get(FILE)).players[HANS].passed, 0);
});

test("a file that cannot be read is never written over: a pass then lasts the session, and the next entry asks again", () => {
    const sut = load({ diskCorrupt: true });
    sut.api.installEntry();
    assert.ok(sut.state.logs.some((line) => /não pôde ser lido/.test(line)));
    const hans = sut.player(HANS);
    sut.fire("entry.start", hans);
    sut.fire("entry.answer", hans, { picks: rightPicks(sut.last(hans, "entry.questions").questions) });
    assert.equal(sut.last(hans, "entry.result").passed, true);
    assert.equal(sut.files.get(FILE), "{ not json", "the file nobody could read is left as it was");
    assert.equal(sut.api.approve(KAT, "Kat"), true, "kept in memory");
    assert.equal(sut.files.get(FILE), "{ not json");
});

test("a page that cannot come up is counted: after three the player is told to restart the game, and the door is no longer put up again", () => {
    const sut = load();
    sut.api.installEntry();
    const hans = sut.player(HANS);
    for (let n = 0; n < 3; n += 1) sut.fire("entry.failed", hans, { why: "a página não abriu" });
    assert.ok(sut.state.chat.some(([id, text]) => id === hans.id && /Feche o jogo e abra de novo/.test(text)));
    sut.api.lookAtPlayers(500_000);
    assert.equal(hans.sent.length, 0, "not put up again this session");
    assert.ok(sut.state.logs.some((line) => /não abriu \(3 de 3\)/.test(line)));
});

test("a player who leaves is forgotten: the next one with the same slot is asked at once", () => {
    const sut = load();
    sut.api.installEntry();
    const hans = sut.player(HANS);
    sut.api.lookAtPlayers(100_000);
    sut.fire("entry.shown", hans);
    for (const fn of sut.state.handlers.get("playerDisconnect") ?? []) fn(hans);
    hans.shownBefore = true;
    const back = sut.player(HANS, "Hans");
    sut.api.lookAtPlayers(100_001);
    assert.equal(back.sent.length, 1);
});
