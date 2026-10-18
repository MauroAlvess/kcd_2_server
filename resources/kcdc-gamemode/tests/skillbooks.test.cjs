const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// ---------------------------------------------------------------------------------------------
// Skill books are read at the world's pace (src/server/skillbooks.ts), from the game's own table
// (src/server/skillbook-data.ts, made by tools/make-skillbooks.py).

const script = (name) => fs.readFileSync(path.join(__dirname, "../dist/server", name), "utf8");

function loadData() {
    const context = { exports: {} };
    vm.runInNewContext(script("skillbook-data.js"), context);
    return context.exports;
}

const DATA = loadData();
/** A book that wants 4 hours: the first level of the sword. */
const SWORD_I = "00cbcdca-e6ee-4fe6-bf87-2acd9f2b21aa";
/** A level-5 sword book (6 hours). */
const SWORD_II = "40d7047d-65c6-4e34-8ba0-ff8ca75d7f48";

/** What the sandbox handed over, as plain data of this realm. */
const plain = (value) => JSON.parse(JSON.stringify(value));

const itemUses = (() => {
    const context = { exports: {} };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/item-uses.js"), "utf8"), context);
    return context.exports;
})();

function load({ saved = { status: "missing" } } = {}) {
    const state = { writes: [], handlers: new Map(), clientHandlers: new Map(), intervals: [], logs: [], chat: [], clock: { now: 1_000_000 } };
    const players = new Map();
    const context = {
        exports: {},
        require: (id) => {
            if (id === "./skillbook-data.js") return DATA;
            if (id === "./item-uses.js") return itemUses;
            if (id === "./store.js") {
                return {
                    ensureDir() {},
                    read: () => saved,
                    write: (file, value) => state.writes.push({ file, value: plain(value) }),
                };
            }
            assert.fail(`unexpected require ${id}`);
        },
        console: { log: (line) => state.logs.push(line) },
        Date: { now: () => state.clock.now },
        World: { timeScale: 22.5 },
        Events: {
            on: (name, fn) => state.handlers.set(name, fn),
            onClient: (name, fn) => state.clientHandlers.set(name, fn),
        },
        setInterval: (fn, ms) => { state.intervals.push({ fn, ms }); return state.intervals.length; },
        clearInterval() {},
        Player: { getById: (id) => players.get(id) ?? null },
        Chat: { sendToPlayer: (player, text) => state.chat.push({ to: player.id, text }) },
        Inventory: { get: (player) => ({ items: player.items }) },
    };
    vm.runInNewContext(script("skillbooks.js"), context);

    let nextId = 1;
    const make = (over = {}) => {
        const player = {
            id: nextId++,
            steamId: `steam-${nextId}`,
            nickname: "Radovan",
            ready: true,
            alive: true,
            canAct: true,
            position: { x: 100, y: 100, z: 10 },
            levels: { weapon_sword: 0 },
            xp: [],
            emitted: [],
            items: [{ id: "row-1", item: SWORD_I, amount: 1 }],
            getTrack(track) {
                if (!(track in this.levels)) return { level: 0 };
                return { level: this.levels[track] };
            },
            addXp(track, xp) {
                this.xp.push([track, xp]);
                return true;
            },
            emit(event, payload) { this.emitted.push({ event, payload }); },
            ...over,
        };
        players.set(player.id, player);
        return player;
    };

    const told = [];
    const persisted = [];
    const opened = [];
    const closed = [];
    const deps = {
        now: () => state.clock.now,
        scale: () => context.World.timeScale,
        owns: (player, rowId, guid) => player.items.some((row) => row.item === guid && (rowId === "" || row.id === rowId)),
        tell: (player, text, loud) => told.push({ to: player.id, text, loud: loud === true }),
        open: (player, guid, pages) => opened.push({ to: player.id, guid, pages: Array.from(pages) }),
        close: (player) => closed.push(player.id),
        find: (id) => players.get(id) ?? null,
        persist: (saved_) => persisted.push(plain(saved_)),
        log: (line) => state.logs.push(line),
    };
    const reading = new context.exports.SkillReading(deps);
    /** Runs the reader's looks for `seconds` of real time. */
    const pass = (seconds) => {
        for (let spent = 0; spent < seconds; spent += 2) {
            state.clock.now += 2_000;
            reading.tick();
        }
    };
    return { api: context.exports, reading, make, state, told, persisted, opened, closed, deps, context, players, pass };
}

const ask = (guid = SWORD_I, id = "row-1") => JSON.stringify({ item: guid, id, revision: 3 });

test("the table lists the game's skill books: each with a GUID, a level of the skill, XP and the hours the reading takes", () => {
    const books = Array.from(DATA.SKILLBOOKS);
    assert.ok(books.length >= 90 && books.length <= 100, `${books.length} books`);
    assert.equal(new Set(books.map((book) => book.guid)).size, books.length, "no GUID twice");
    for (const book of books) {
        assert.match(book.guid, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/, book.name);
        assert.ok([4, 6, 8, 10, 12].includes(book.hours), `${book.name}: ${book.hours} h`);
        assert.ok([0, 5, 10, 15].includes(book.level), `${book.name}: level ${book.level}`);
        assert.ok(book.xp >= 100 && book.xp <= 1000, `${book.name}: ${book.xp} XP`);
        assert.ok(book.name.length > 2 && !/[\r\n]/.test(book.name), "one plain line");
        assert.ok(book.track in DATA.TRACK_NAMES, `${book.name}: ${book.track}`);
    }
    const stats = ["strength", "agility", "vitality", "speech"];
    assert.deepEqual(books.filter((book) => book.guess).map((book) => book.track).sort(), stats.flatMap((stat) => [stat, stat, stat, stat]).sort(), "only the four stat books have a guessed XP, four steps each");
    assert.ok(books.filter((book) => !book.guess).every((book) => !stats.includes(book.track)), "the others come from the game's table");
    const sword = books.find((book) => book.guid === SWORD_I);
    assert.deepEqual(plain(sword), {
        guid: SWORD_I, name: "A arte da espada I", track: "weapon_sword", level: 0, xp: 100, hours: 4, guess: false,
        info: "Um livro de habilidades sobre combate com espadas.",
        text: ["A melhor defesa é um bom ataque, portanto, se você quiser sobreviver a uma luta, precisa acertar seu oponente antes que ele acerte você. Quem diria, não é?", "Escola germânica"],
    });
    assert.ok(books.every((book) => book.info.length > 0), "every book says what it is");
    assert.equal(DATA.TRACK_NAMES.weapon_sword, "Espadas");
    assert.equal(DATA.TRACK_NAMES.strength, "Força");
});

test("a book is read at the world's pace: 4 hours of the clock at 22.5 is a little under eleven minutes, and then the XP is given", () => {
    const sut = load();
    const player = sut.make();
    sut.reading.begin(player, ask());
    assert.ok(sut.reading.isReading(player.id));
    assert.match(sut.told[0].text, /Você abre "A arte da espada I" \(Espadas\): leva cerca de 11 min de leitura/);
    assert.equal(sut.told[0].loud, false, "said in the chat, not over the open book");
    assert.equal(sut.opened.length, 1, "the book opens in the player's hands");
    assert.equal(sut.opened[0].guid, SWORD_I);
    assert.match(sut.opened[0].pages[0], /<title>A arte da espada I<\/title><subtitle>Espadas<\/subtitle>/);

    sut.pass(630);
    assert.equal(player.xp.length, 0, "ten and a half minutes is not enough");
    assert.ok(sut.reading.isReading(player.id));
    sut.pass(20);
    assert.deepEqual(plain(player.xp), [["weapon_sword", 100]]);
    assert.equal(sut.reading.isReading(player.id), false);
    assert.match(sut.told.at(-1).text, /terminou "A arte da espada I" e aprendeu: \+100 de experiência em Espadas/);
    assert.deepEqual(plain(sut.persisted.at(-1).readers[player.steamId]), { [SWORD_I]: -1 });
    assert.deepEqual(plain(sut.closed), [player.id], "the book closes when the reading is done");
    assert.equal(sut.told.at(-1).loud, true, "and the news is on the notification line too");
    assert.ok(!sut.told.some((line) => /^Lendo/.test(line.text)), "no word while the book is open");
});

test("a learnt book teaches once; another copy of it is no use", () => {
    const sut = load();
    const player = sut.make();
    sut.reading.begin(player, ask());
    sut.pass(660);
    assert.equal(player.xp.length, 1);
    sut.reading.begin(player, ask());
    assert.match(sut.told.at(-1).text, /já aprendeu o que "A arte da espada I" ensina/);
    assert.equal(sut.reading.isReading(player.id), false);
});

test("the pace follows the clock: by night, at 13.5, the same book takes longer", () => {
    const sut = load();
    sut.context.World.timeScale = 13.5;
    const player = sut.make();
    sut.reading.begin(player, ask());
    assert.match(sut.told[0].text, /leva cerca de 18 min/);
    sut.pass(1_000);
    assert.equal(player.xp.length, 0, "4 hours at 13.5 are 1067 seconds");
    sut.pass(100);
    assert.equal(player.xp.length, 1);
});

test("with the clock stopped the game's own pace is used, and a stall of the server is not counted as reading", () => {
    const sut = load();
    sut.context.World.timeScale = 0;
    const player = sut.make();
    sut.reading.begin(player, ask());
    assert.match(sut.told[0].text, /leva cerca de 16 min/, "15 game seconds per second");

    const stall = load();
    const reader = stall.make();
    stall.reading.begin(reader, ask());
    stall.state.clock.now += 3_600_000;
    stall.reading.tick();
    assert.equal(reader.xp.length, 0, "an hour of silence is ten seconds of reading at most");
    assert.ok(stall.reading.isReading(reader.id));
});

test("walking away, a blow or dying puts the book down; what was read is kept and the next reading goes on from there", () => {
    const sut = load();
    const player = sut.make();
    sut.reading.begin(player, ask());
    sut.pass(320);
    player.position = { x: 100, y: 104.5, z: 10 };
    sut.pass(2);
    assert.equal(sut.reading.isReading(player.id), false);
    assert.match(sut.told.at(-1).text, /Você se afastou e largou o livro\. O que você leu fica guardado \(4\d%\)/);
    const kept = sut.persisted.at(-1).readers[player.steamId][SWORD_I];
    assert.ok(kept > 1.9 && kept < 2.1, `about two hours of the four: ${kept}`);

    player.position = { x: 100, y: 100, z: 10 };
    sut.reading.begin(player, ask());
    assert.match(sut.told.at(-1).text, /leva cerca de 5 min/, "only half is left");
    sut.pass(100);
    sut.reading.hurt(player);
    assert.match(sut.told.at(-1).text, /Você foi interrompido/);
    sut.reading.begin(player, ask());
    sut.reading.left(player);
    assert.equal(sut.reading.isReading(player.id), false);
    assert.ok(sut.persisted.length >= 3, "saved each time");
});

test("closing the book puts it down and keeps what was read; a book that cannot be opened says why", () => {
    const sut = load();
    const player = sut.make();
    sut.reading.begin(player, ask());
    sut.pass(160);
    sut.reading.shut(player, "{}");
    assert.equal(sut.reading.isReading(player.id), false);
    assert.match(sut.told.at(-1).text, /Você fechou o livro\. O que você leu fica guardado \(2\d%\)/);
    assert.ok(sut.persisted.at(-1).readers[player.steamId][SWORD_I] > 0.9);
    sut.reading.shut(player, "{}");
    assert.equal(sut.told.filter((line) => /fechou o livro/.test(line.text)).length, 1, "a second close says nothing");

    sut.reading.begin(player, ask());
    sut.reading.shut(player, JSON.stringify({ failed: "em combate" }));
    assert.match(sut.told.at(-1).text, /O livro não abriu agora \(em combate\)/);
    assert.equal(sut.reading.isReading(player.id), false);
});

test("walking away closes the book for the reader", () => {
    const sut = load();
    const player = sut.make();
    sut.reading.begin(player, ask());
    player.position = { x: 100, y: 105, z: 10 };
    sut.pass(2);
    assert.deepEqual(plain(sut.closed), [player.id]);
});

test("the pages: the book's name, its skill and description first, then its own lines, headings before paragraphs", () => {
    const { api } = load();
    const sword = Array.from(DATA.SKILLBOOKS).find((book) => book.guid === SWORD_I);
    const pages = Array.from(api.pagesOf(sword));
    assert.equal(pages.length, 2);
    assert.equal(pages[0], "<title>A arte da espada I</title><subtitle>Espadas</subtitle><br/><paragraph>Um livro de habilidades sobre combate com espadas.</paragraph>");
    assert.match(pages[1], /^<heading>Escola germânica<\/heading><paragraph>A melhor defesa é um bom ataque/);
    const bare = { ...sword, text: [], info: "Fala de <ferro> & aço" };
    assert.deepEqual(Array.from(api.pagesOf(bare)), ["<title>A arte da espada I</title><subtitle>Espadas</subtitle><br/><paragraph>Fala de &lt;ferro&gt; &amp; aço</paragraph>"], "markup in a text is escaped");
});

test("a player who cannot act, one already reading, one without the book, or without the level are told why", () => {
    const sut = load();
    const down = sut.make({ canAct: false });
    sut.reading.begin(down, ask());
    assert.match(sut.told.at(-1).text, /não está em condições de ler/);

    const reader = sut.make();
    sut.reading.begin(reader, ask());
    sut.reading.begin(reader, ask());
    assert.match(sut.told.at(-1).text, /Você já está lendo/);

    const empty = sut.make({ items: [] });
    sut.reading.begin(empty, ask());
    assert.match(sut.told.at(-1).text, /Esse livro não está mais com você/);

    const wrongRow = sut.make();
    sut.reading.begin(wrongRow, ask(SWORD_I, "somebody-else's-row"));
    assert.match(sut.told.at(-1).text, /não está mais com você/);

    const novice = sut.make({ items: [{ id: "row-9", item: SWORD_II, amount: 1 }], levels: { weapon_sword: 3 } });
    sut.reading.begin(novice, ask(SWORD_II, "row-9"));
    assert.match(sut.told.at(-1).text, /difícil demais para você: pede nível 5 em Espadas, e você tem 3/);
    assert.equal(sut.reading.isReading(novice.id), false);

    const skilled = sut.make({ items: [{ id: "row-9", item: SWORD_II, amount: 1 }], levels: { weapon_sword: 5 } });
    sut.reading.begin(skilled, ask(SWORD_II, "row-9"));
    assert.equal(sut.reading.isReading(skilled.id), true);

    const before = sut.told.length;
    sut.reading.begin(reader, ask("00000000-0000-0000-0000-000000000000"));
    sut.reading.begin(reader, "not json");
    assert.equal(sut.told.length, before, "a thing that is no skill book is none of this module's business");
});

test("however the game spells the class GUID, the book is found", () => {
    for (const spelling of [SWORD_I.toUpperCase(), SWORD_I.replace(/-/g, ""), `{${SWORD_I}}`]) {
        const sut = load();
        const player = sut.make();
        sut.reading.begin(player, ask(spelling));
        assert.equal(sut.reading.isReading(player.id), true, spelling);
    }
});

test("the reading ends when the body can no longer act", () => {
    const sut = load();
    const player = sut.make();
    sut.reading.begin(player, ask());
    sut.pass(100);
    player.canAct = false;
    sut.pass(2);
    assert.equal(sut.reading.isReading(player.id), false);
    assert.match(sut.told.at(-1).text, /Você largou o livro/);

    const gone = sut.make();
    sut.reading.begin(gone, ask());
    sut.players.delete(gone.id);
    sut.pass(2);
    assert.equal(sut.reading.isReading(gone.id), false);
});

test("the XP the game would not take leaves the reading done: the next try ends at once", () => {
    const sut = load();
    const player = sut.make({ addXp() { return false; } });
    sut.reading.begin(player, ask());
    sut.pass(660);
    assert.match(sut.told.at(-1).text, /o jogo não aceitou a experiência agora/);
    assert.equal(sut.reading.isReading(player.id), false);
    assert.ok(sut.persisted.at(-1).readers[player.steamId][SWORD_I] >= 4);

    player.addXp = function (track, xp) { this.xp.push([track, xp]); return true; };
    sut.reading.begin(player, ask());
    sut.pass(2);
    assert.deepEqual(plain(player.xp), [["weapon_sword", 100]]);

    const throws = load();
    const broken = throws.make({ addXp() { throw new Error("no such track"); } });
    throws.reading.begin(broken, ask());
    throws.pass(660);
    assert.ok(throws.state.logs.some((line) => /não consegui dar 100 de XP em weapon_sword a Radovan: (Error: )?no such track/.test(line)));
});

test("an administrator can scale the hours a book asks for, within limits, and it is kept", () => {
    const sut = load();
    assert.equal(sut.reading.setFactor(0.25), true);
    assert.equal(sut.persisted.at(-1).factor, 0.25);
    assert.equal(sut.reading.setFactor(0), false);
    assert.equal(sut.reading.setFactor(5), false);
    assert.equal(sut.reading.setFactor(Number.NaN), false);
    assert.equal(sut.reading.factor, 0.25);

    const player = sut.make();
    sut.reading.begin(player, ask());
    assert.match(sut.told.at(-1).text, /leva cerca de 3 min/);
    sut.pass(170);
    assert.equal(player.xp.length, 1, "a quarter of 4 hours at 22.5 is 160 seconds");
    assert.match(sut.reading.pace(), /25% das horas do livro/);
});

test("what a reader has done is written down by Steam id and comes back after a restart", () => {
    const first = load();
    const player = first.make();
    first.reading.begin(player, ask());
    first.pass(100);
    first.reading.left(player);
    const saved = first.persisted.at(-1);
    assert.ok(saved.readers[player.steamId][SWORD_I] > 0.5);

    const second = load();
    second.reading.load(saved);
    const same = second.make({ steamId: player.steamId });
    second.reading.begin(same, ask());
    assert.match(second.told.at(-1).text, /Você abre "A arte da espada I"/);
    assert.ok(second.state.logs.some((line) => /já lidas 0\.\d+ h/.test(line)));
    assert.ok(second.reading.describe(same).some((line) => /Lendo "A arte da espada I"/.test(line)));

    second.reading.load({ factor: 0.5, readers: { "x": { [SWORD_I]: -1 } } });
    assert.equal(second.reading.factor, 0.5);
    second.reading.load({ factor: 99 });
    assert.equal(second.reading.factor, 0.5, "a factor out of range in the file is ignored");
});

test("/leitura says what is being read, what is started, what is learnt and the pace", () => {
    const sut = load();
    const player = sut.make();
    assert.match(sut.reading.describe(player)[0], /Você não está lendo/);
    sut.reading.begin(player, ask());
    sut.pass(100);
    const reading = sut.reading.describe(player);
    assert.match(reading[0], /Lendo "A arte da espada I": \d+%, faltam cerca de \d+ min\. \/leitura parar larga o livro/);
    sut.reading.drop(player);
    const started = sut.reading.describe(player);
    assert.ok(started.some((line) => /Começado: "A arte da espada I", \d+%/.test(line)));
    assert.equal(sut.reading.drop(player), false, "nothing left to put down");
    sut.reading.begin(player, ask());
    sut.pass(660);
    assert.ok(sut.reading.describe(player).some((line) => /Livros de habilidade já aprendidos: 1/.test(line)));
    assert.ok(sut.reading.describe(player).at(-1).startsWith("Ritmo da leitura"));
});

test("installed, it sends the books to each player who arrives, listens for the client's request and keeps the file", () => {
    const sut = load({ saved: { status: "ok", value: { factor: 0.5, readers: {} }, fromBackup: false } });
    sut.api.installSkillBooks();
    assert.ok(sut.state.logs.some((line) => /skillbooks: \d+ livros de habilidade lidos em tempo real \(fator 0\.5\)/.test(line)));
    for (const name of ["playerReady", "playerDamage", "playerDied", "playerDisconnect", "resourceStop"]) assert.ok(sut.state.handlers.has(name), name);
    assert.ok(sut.state.clientHandlers.has("kcdc-gamemode:skillbook.read"));
    assert.ok(sut.state.clientHandlers.has("kcdc-gamemode:skillbook.shut"));

    const player = sut.make();
    sut.state.handlers.get("playerReady")(player);
    const sent = player.emitted.map((entry) => JSON.parse(entry.payload));
    assert.ok(player.emitted.every((entry) => entry.event === "kcdc-gamemode:itemuses"));
    assert.ok(sent.every((chunk) => chunk.use === "skillbook.read" && chunk.items.length <= 20), "small messages, naming the action");
    assert.deepEqual(sent.flatMap((chunk) => chunk.items).sort(), Array.from(DATA.SKILLBOOKS, (book) => book.guid).sort());

    sut.state.clientHandlers.get("kcdc-gamemode:skillbook.read")(player, ask());
    assert.ok(sut.state.chat.some((line) => /Você abre "A arte da espada I"/.test(line.text)));
    const open = player.emitted.find((entry) => entry.event === "kcdc-gamemode:skillbook.open");
    assert.ok(open, "the client is asked to open the book");
    assert.equal(JSON.parse(open.payload).guid, SWORD_I);
    assert.ok(JSON.parse(open.payload).pages.length >= 1);
    sut.state.clientHandlers.get("kcdc-gamemode:skillbook.shut")(player, "{}");
    assert.ok(sut.state.chat.some((line) => /Você fechou o livro/.test(line.text)));
    assert.ok(player.emitted.some((entry) => entry.event === "kcdc-gamemode:skillbook.close"));

    assert.equal(sut.state.intervals[0].ms, 2000);
    sut.state.clientHandlers.get("kcdc-gamemode:skillbook.read")(player, ask());
    sut.state.handlers.get("playerDisconnect")(player);
    assert.ok(sut.state.writes.some((write) => write.file === "playerdata/skillbooks.json" && write.value.readers[player.steamId]), "written when the reader leaves");
});

test("a damaged file is said in the log and does not stop the server", () => {
    const sut = load({ saved: { status: "corrupt", reason: "playerdata/skillbooks.json: Unexpected token" } });
    sut.api.installSkillBooks();
    assert.ok(sut.state.logs.some((line) => /skillbooks\.json está ilegível/.test(line)));
});

// ---------------------------------------------------------------------------------------------
// The command.

function loadCommand({ admin = false, reading } = {}) {
    const context = {
        exports: {},
        require: (id) => {
            if (id === "../auth.js") return { isAdmin: () => admin };
            if (id === "../skillbooks.js") return { skillReading: () => reading, FACTOR_MIN: 0.02, FACTOR_MAX: 2 };
            assert.fail(`unexpected require ${id}`);
        },
    };
    vm.runInNewContext(script("commands/leitura.js"), context);
    const lines = [];
    const reply = { line: (text) => lines.push(text), lines: (texts) => texts.forEach((text) => lines.push(text)) };
    let usages = 0;
    const run = (args, player = { id: 1 }) => context.exports.leituraCommand.run({ player, name: "leitura", args, reply, usage: () => { usages += 1; } });
    return { run, lines, usages: () => usages, command: context.exports.leituraCommand };
}

test("/leitura shows, puts the book down, and lets only administrators scale the pace", () => {
    const calls = [];
    const reading = {
        describe: () => ["a", "b"],
        drop: () => { calls.push("drop"); return false; },
        setFactor: (factor) => { calls.push(["factor", factor]); return factor >= 0.02 && factor <= 2; },
        pace: () => "ritmo",
    };
    const player = loadCommand({ reading });
    player.run([]);
    assert.deepEqual(plain(player.lines), ["a", "b"]);
    player.run(["parar"]);
    assert.equal(player.lines.at(-1), "Você não está lendo.");
    player.run(["fator", "0.5"]);
    assert.equal(player.lines.at(-1), "Só administradores mudam o ritmo da leitura.");
    assert.ok(!calls.some((call) => call[0] === "factor"));

    const admin = loadCommand({ admin: true, reading });
    admin.run(["fator", "0,5"]);
    assert.equal(admin.lines.at(-1), "ritmo");
    assert.deepEqual(plain(calls.at(-1)), ["factor", 0.5]);
    admin.run(["fator", "9"]);
    admin.run(["fator"]);
    admin.run(["bobagem"]);
    assert.equal(admin.usages(), 3);
    assert.match(admin.command.usage.join(" "), /fator <0\.02-2>/);

    const early = loadCommand({ reading: null });
    early.run([]);
    assert.match(early.lines[0], /ainda não está pronta/);
});
