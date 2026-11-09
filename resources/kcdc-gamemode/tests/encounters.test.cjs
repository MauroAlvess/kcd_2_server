const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
require("./reachpatch.cjs");

const RESOURCE = "kcdc-gamemode";

/** `tables` lists the pairs of player ids standing at one dice table; `trading` the ids already in a trade; `playing` those in a dice match; `dueling` those in a duel; `rows` the officer's rows arrest.ts would add. */
function load({ tables = [], trading = [], playing = [], dueling = [], rows = [] } = {}) {
    const handlers = new Map();
    const clients = new Map();
    const emit = (name, ...args) => {
        for (const fn of handlers.get(name) ?? []) fn(...args);
    };
    const sessions = new Map();
    let nextSession = 1;
    const players = [];
    const intervals = [];
    const clock = { now: 1_000_000 };
    const known = new Set();
    const arrested = [];
    const arrestChosen = [];
    const pairs = [];
    const started = [];
    const duelStarted = [];
    const state = { pairFails: null, startFails: false, apart: null, duelRefusal: null, duelFails: null };
    const logs = [];

    const context = {
        exports: {},
        require: (id) => {
            if (id === "./acquaintances.js") {
                return {
                    knows: (viewer, target) => viewer.id === target.id || known.has(`${viewer.id}>${target.id}`),
                    introduce: (speaker, listener) => {
                        const key = `${listener.id}>${speaker.id}`;
                        if (known.has(key)) return false;
                        known.add(key);
                        return true;
                    },
                    labelFor: (viewer, target) => (viewer.id === target.id || known.has(`${viewer.id}>${target.id}`) ? target.nickname : target.female ? "Desconhecida" : "Desconhecido"),
                    nameOf: (player) => player.nickname,
                };
            }
            if (id === "./arrest.js") {
                return {
                    isArrested: (player) => arrested.includes(player.id),
                    menuOptions: (speaker, target) => rows.filter((row) => (row.id === "release") === arrested.includes(target.id)).map((row) => ({ ...row })),
                    choose: (speaker, target, option) => {
                        arrestChosen.push([speaker.id, target.id, option]);
                        return `feito:${option}`;
                    },
                };
            }
            if (id === "./dice.js") {
                return {
                    diceLobby: {
                        sameTable: (a, b) => tables.some(([x, y]) => (x === a.id && y === b.id) || (x === b.id && y === a.id)),
                        playingNow: (player) => playing.includes(player.id),
                        explainApart: (a, b) => (state.apart ? `${a.nickname} e ${b.nickname}: ${state.apart}` : null),
                        pair: async (a, b) => {
                            if (state.pairFails) throw new Error(state.pairFails);
                            pairs.push([a.id, b.id]);
                        },
                    },
                };
            }
            if (id === "./duel.js") {
                return {
                    INVITATION_NOTES: ["Vai até um dos dois chegar a 20% da vida.", "Poções e efeitos saem do corpo."],
                    duels: {
                        busy: (player) => dueling.includes(player.id),
                        canChallenge: () => state.duelRefusal,
                        start: (from, to) => {
                            if (state.duelFails) return state.duelFails;
                            duelStarted.push([from.id, to.id]);
                            return null;
                        },
                    },
                };
            }
            if (id === "./titles.js") {
                return {
                    applyNametag: (player) => player.setNametagVisible(false),
                    restoreNametag: (player) => player.setNametagVisible(true),
                };
            }
            if (id === "./trade.js") {
                return {
                    trades: {
                        isTrading: (player) => trading.includes(player.id),
                        start: (a, b) => {
                            if (state.startFails) return false;
                            started.push([a.id, b.id]);
                            return true;
                        },
                    },
                };
            }
            assert.fail(`unexpected require ${id}`);
        },
        console: { log: (line) => logs.push(line), error: (line) => logs.push(line) },
        Date: { now: () => clock.now },
        setInterval: (fn, ms) => { intervals.push({ fn, ms }); return intervals.length; },
        clearInterval() {},
        Chat: { sendToPlayer: (player, text) => player.chat.push(text) },
        Events: {
            on: (name, fn) => handlers.set(name, [...(handlers.get(name) ?? []), fn]),
            onClient: (name, fn) => clients.set(name, fn),
        },
        Player: { all: () => players, getById: (id) => players.find((player) => player.id === id) ?? null },
        Dialogue: {
            sessionOf: (id) => [...sessions].find(([, value]) => value.playerId === id)?.[0] ?? 0,
            open: (playerId, page) => {
                const session = nextSession++;
                sessions.set(session, { playerId, page });
                return session;
            },
            update: (session, page) => {
                if (!sessions.has(session)) return false;
                sessions.get(session).page = page;
                return true;
            },
            close: (session) => {
                const old = sessions.get(session);
                if (!old) return false;
                sessions.delete(session);
                emit("dialogueClosed", session, players.find((player) => player.id === old.playerId), 0);
                return true;
            },
        },
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/encounters.js"), "utf8"), context);

    const makePlayer = (id, nickname, over = {}) => {
        const player = {
            id, nickname, steamId: `7656119800000000${id}`, ready: true, alive: true, virtualWorld: 0, position: { x: id, y: 0, z: 0 },
            chat: [], notices: [], labels: [], nametag: true,
            setNametagVisible(visible) { this.nametag = visible; },
            emit(event, payload) {
                const body = JSON.parse(payload);
                if (event === `${RESOURCE}:notify`) this.notices.push(body.text);
                if (event === `${RESOURCE}:players.label`) this.labels.push(body);
            },
            ...over,
        };
        players.push(player);
        return player;
    };
    const sessionOf = (player) => context.Dialogue.sessionOf(player.id);
    const page = (player) => sessions.get(sessionOf(player))?.page;
    const texts = (player) => Array.from(page(player)?.options ?? [], (option) => option.text);
    const choose = (player, option) => emit("dialogueChoice", sessionOf(player), player, option);
    const talk = (speaker, target) => clients.get(`${RESOURCE}:players.talk`)(speaker, JSON.stringify({ id: target.id }));
    const peek = (viewer, id) => clients.get(`${RESOURCE}:players.peek`)(viewer, { id });
    return { api: context.exports, emit, handlers, clients, sessions, players, intervals, clock, known, arrested, arrestChosen, pairs, started, duelStarted, dueling, state, logs, makePlayer, sessionOf, page, texts, choose, talk, peek };
}

test("nobody's name floats over their head, from the start and at every spawn; they come back when the resource stops", () => {
    const sut = load();
    const hans = sut.makePlayer(1, "Hans");
    sut.api.installEncounters();
    assert.equal(hans.nametag, false);
    const kat = sut.makePlayer(2, "Katerina");
    assert.equal(kat.nametag, true);
    sut.emit("playerSpawned", kat);
    assert.equal(kat.nametag, false);
    sut.emit("resourceStop", "kcdc-gamemode");
    assert.equal(hans.nametag, true);
    assert.equal(kat.nametag, true);
});

test("a player looked at is a stranger until introduced, in the gender of their body; nobody there is nothing", () => {
    const sut = load();
    sut.api.installEncounters();
    const hans = sut.makePlayer(1, "Hans");
    const kat = sut.makePlayer(2, "Katerina", { female: true });
    sut.peek(hans, kat.id);
    sut.peek(kat, hans.id);
    sut.peek(hans, 999);
    assert.deepEqual(hans.labels, [{ id: 2, label: "Desconhecida" }, { id: 999, label: "" }]);
    assert.deepEqual(kat.labels, [{ id: 1, label: "Desconhecido" }]);
    sut.clients.get(`${RESOURCE}:players.peek`)(hans, { id: "2" });
    sut.clients.get(`${RESOURCE}:players.peek`)(hans, "not json {");
    assert.equal(hans.labels.length, 2, "anything but a whole number is ignored");
});

test("the talk key on a close player opens the game's list: introduce, dice, trade, duel, leave", () => {
    const sut = load();
    sut.api.installEncounters();
    const hans = sut.makePlayer(1, "Hans");
    const kat = sut.makePlayer(2, "Katerina");
    sut.talk(hans, kat);
    assert.deepEqual(sut.texts(hans), ["Apresentar-se", "Jogar dados (só junto de uma mesa de dados)", "Negociar", "Desafiar para um duelo", "Sair"]);
    assert.equal(sut.page(hans).options[1].enabled, false, "dice needs a table");
    sut.choose(hans, "leave");
    assert.equal(sut.sessionOf(hans), 0);
});

test("dice is offered at a table both stand at", () => {
    const sut = load({ tables: [[1, 2]] });
    sut.api.installEncounters();
    const hans = sut.makePlayer(1, "Hans");
    const kat = sut.makePlayer(2, "Katerina");
    sut.talk(hans, kat);
    assert.deepEqual({ ...sut.page(hans).options[1] }, { id: "dice", text: "Jogar dados", enabled: true });
});

test("nobody far off, dead, in another world, or busy is talked to", () => {
    const sut = load({ trading: [3] });
    sut.api.installEncounters();
    const hans = sut.makePlayer(1, "Hans");
    const far = sut.makePlayer(2, "Longe", { position: { x: 40, y: 0, z: 0 } });
    const trader = sut.makePlayer(3, "Ocupado");
    const ghost = sut.makePlayer(4, "Morto", { alive: false });
    sut.talk(hans, far);
    sut.talk(hans, ghost);
    sut.talk(trader, hans);
    sut.talk(hans, hans);
    assert.equal(sut.sessions.size, 0);
    sut.clients.get(`${RESOURCE}:players.talk`)(hans, { id: "x" });
    assert.equal(sut.sessions.size, 0);
});

test("introducing yourself tells the other your name, once, and the option goes away", () => {
    const sut = load();
    sut.api.installEncounters();
    const hans = sut.makePlayer(1, "Hans");
    const kat = sut.makePlayer(2, "Katerina");
    sut.talk(hans, kat);
    sut.choose(hans, "introduce");
    assert.ok(sut.known.has("2>1"), "Katerina knows Hans now");
    assert.ok(!sut.known.has("1>2"), "and Hans still does not know her");
    assert.deepEqual(kat.notices, ["Hans se apresentou a você."]);
    assert.deepEqual(kat.labels, [{ id: 1, label: "Hans" }], "her screen shows his name at once");
    assert.deepEqual(hans.notices, ["Você se apresentou."]);
    assert.deepEqual(sut.texts(hans), ["Jogar dados (só junto de uma mesa de dados)", "Negociar", "Desafiar para um duelo", "Sair"], "the talk goes on without it");

    sut.choose(hans, "leave");
    sut.talk(hans, kat);
    assert.ok(!sut.texts(hans).includes("Apresentar-se"));
});

test("a trade is an invitation the other player answers in their own list; accepted, it opens", () => {
    const sut = load();
    sut.api.installEncounters();
    const hans = sut.makePlayer(1, "Hans");
    const kat = sut.makePlayer(2, "Katerina");
    sut.talk(hans, kat);
    sut.choose(hans, "trade");
    assert.equal(sut.sessionOf(hans), 0, "Hans's list closes");
    assert.deepEqual(sut.texts(kat), ["Desconhecido quer negociar com você.", "Aceitar", "Recusar"]);
    assert.equal(sut.page(kat).options[0].enabled, false);
    assert.ok(hans.notices.includes("Você chamou Desconhecida para negociar. Esperando a resposta.") || hans.notices.includes("Você chamou Desconhecido para negociar. Esperando a resposta."));
    sut.choose(kat, "accept");
    assert.deepEqual(sut.started, [[1, 2]]);
    assert.equal(sut.sessionOf(kat), 0);
});

test("a declined invitation, or one closed with Esc, is said to whoever sent it", () => {
    const sut = load();
    sut.api.installEncounters();
    const hans = sut.makePlayer(1, "Hans");
    const kat = sut.makePlayer(2, "Katerina");
    sut.known.add("1>2");
    sut.talk(hans, kat);
    sut.choose(hans, "trade");
    sut.choose(kat, "decline");
    assert.ok(hans.notices.includes("Katerina recusou a negociação."));
    assert.deepEqual(sut.started, []);

    sut.clock.now += 20_000;
    sut.talk(hans, kat);
    sut.choose(hans, "trade");
    const session = sut.sessionOf(kat);
    sut.sessions.delete(session);
    sut.emit("dialogueClosed", session, kat, 1);
    assert.ok(hans.notices.includes("Katerina não aceitou o convite."));
});

test("an invitation nobody answers lapses after half a minute", () => {
    const sut = load({ tables: [[1, 2]] });
    sut.api.installEncounters();
    const hans = sut.makePlayer(1, "Hans");
    const kat = sut.makePlayer(2, "Katerina");
    sut.talk(hans, kat);
    sut.choose(hans, "dice");
    sut.clock.now += sut.api.REQUEST_MS - 1;
    sut.intervals[0].fn();
    assert.notEqual(sut.sessionOf(kat), 0);
    sut.clock.now += 2;
    sut.intervals[0].fn();
    assert.equal(sut.sessionOf(kat), 0);
    assert.ok(hans.notices.some((line) => /não respondeu/.test(line)));
    sut.choose(kat, "accept");
    assert.deepEqual(sut.pairs, []);
});

test("dice accepted at the table seats both for the score; a failure is told to both", async () => {
    const sut = load({ tables: [[1, 2]] });
    sut.api.installEncounters();
    const hans = sut.makePlayer(1, "Hans");
    const kat = sut.makePlayer(2, "Katerina");
    sut.talk(hans, kat);
    sut.choose(hans, "dice");
    assert.deepEqual(sut.texts(kat)[0], "Desconhecido quer jogar dados com você.");
    sut.choose(kat, "accept");
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(sut.pairs, [[1, 2]]);

    sut.state.pairFails = "Essa mesa de dados está ocupada.";
    sut.clock.now += 20_000;
    sut.talk(hans, kat);
    sut.choose(hans, "dice");
    sut.choose(kat, "accept");
    await new Promise((resolve) => setImmediate(resolve));
    assert.ok(hans.notices.includes("Os dados não puderam começar: Essa mesa de dados está ocupada."));
    assert.ok(kat.notices.includes("Os dados não puderam começar: Essa mesa de dados está ocupada."));
});

test("a menu that greys out the dice says why in the server log, when somebody stands near a table", () => {
    const quiet = load();
    quiet.api.installEncounters();
    quiet.talk(quiet.makePlayer(1, "Hans"), quiet.makePlayer(2, "Katerina"));
    assert.ok(!quiet.logs.some((line) => /dados indisponíveis/.test(line)), "nobody near a table: nothing written");

    const near = load();
    near.state.apart = "Hans a 3.4 m da mesa t1";
    near.api.installEncounters();
    near.talk(near.makePlayer(1, "Hans"), near.makePlayer(2, "Katerina"));
    assert.ok(near.logs.some((line) => /dados indisponíveis no menu: Hans e Katerina: Hans a 3.4 m da mesa t1/.test(line)));
});

test("dice away from a table is explained, not sent", () => {
    const sut = load();
    sut.api.installEncounters();
    const hans = sut.makePlayer(1, "Hans");
    const kat = sut.makePlayer(2, "Katerina");
    sut.talk(hans, kat);
    sut.choose(hans, "dice");
    assert.equal(sut.sessionOf(kat), 0);
    assert.ok(hans.notices.some((line) => /mesma mesa de dados/.test(line)));
});

test("the same invitation cannot be sent again at once, and a busy player is not bothered", () => {
    const sut = load();
    sut.api.installEncounters();
    const hans = sut.makePlayer(1, "Hans");
    const kat = sut.makePlayer(2, "Katerina");
    const jan = sut.makePlayer(3, "Jan");
    sut.talk(hans, kat);
    sut.choose(hans, "trade");
    sut.choose(kat, "decline");
    sut.talk(hans, kat);
    sut.choose(hans, "trade");
    assert.ok(hans.notices.includes("Espere um pouco antes de chamar de novo."));
    assert.equal(sut.sessionOf(kat), 0);

    sut.talk(jan, kat);
    sut.choose(jan, "trade");
    sut.talk(hans, kat);
    assert.notEqual(sut.sessionOf(hans), 0, "Katerina's list is up, but Hans can still open his own");
    sut.clock.now += 20_000;
    sut.talk(hans, kat);
    sut.choose(hans, "trade");
    assert.ok(hans.notices.some((line) => /não pode agora/.test(line)));
});

test("whoever sent the invitation must still be near when it is accepted", () => {
    const sut = load();
    sut.api.installEncounters();
    const hans = sut.makePlayer(1, "Hans");
    const kat = sut.makePlayer(2, "Katerina");
    sut.talk(hans, kat);
    sut.choose(hans, "trade");
    hans.position = { x: 100, y: 0, z: 0 };
    sut.choose(kat, "accept");
    assert.deepEqual(sut.started, []);
    assert.ok(kat.notices.includes("Quem chamou não está mais por perto."));
});

test("a player who leaves takes their conversations and invitations with them", () => {
    const sut = load();
    sut.api.installEncounters();
    const hans = sut.makePlayer(1, "Hans");
    const kat = sut.makePlayer(2, "Katerina");
    sut.talk(hans, kat);
    sut.choose(hans, "trade");
    assert.notEqual(sut.sessionOf(kat), 0);
    sut.emit("playerDisconnect", hans);
    assert.equal(sut.sessionOf(kat), 0, "her list closes");
    assert.equal(sut.intervals[0].ms, 1000);
});

test("somebody in a dice match is nobody's to talk to, to invite or to look at by name; the players themselves have no talk key either (2026-10-20)", () => {
    const sut = load({ playing: [2, 3] });
    sut.api.installEncounters();
    const hans = sut.makePlayer(1, "Hans");
    const kat = sut.makePlayer(2, "Katerina", { female: true });
    const otto = sut.makePlayer(3, "Otto");
    const eva = sut.makePlayer(4, "Eva");

    sut.talk(hans, kat);
    assert.equal(sut.sessions.size, 0, "an outsider cannot open the talk list on a player of the match");
    assert.deepEqual(hans.chat, ["Desconhecida está jogando dados."]);
    assert.deepEqual(hans.notices, ["Desconhecida está jogando dados."]);

    sut.talk(kat, hans);
    assert.equal(sut.sessions.size, 0, "and a player of the match has no list on anybody (the keys are the table's)");
    assert.deepEqual(kat.chat, []);

    sut.talk(kat, otto);
    assert.equal(sut.sessions.size, 0, "not even the two of them");

    sut.peek(hans, kat.id);
    sut.peek(hans, eva.id);
    assert.deepEqual(hans.labels, [{ id: 2, label: "" }, { id: 4, label: "Desconhecido" }], "no name for the client to show a hint on");

    // After the match they are people again.
    const after = load();
    after.api.installEncounters();
    const a = after.makePlayer(1, "Hans");
    const b = after.makePlayer(2, "Katerina");
    after.talk(a, b);
    assert.equal(after.sessions.size, 1);
});

test("an invitation to a player whose dice match began after the list was opened is refused as busy", () => {
    const playing = [];
    const sut = load({ tables: [[1, 2]], playing });
    sut.api.installEncounters();
    const hans = sut.makePlayer(1, "Hans");
    const kat = sut.makePlayer(2, "Katerina", { female: true });
    sut.talk(hans, kat);
    assert.equal(sut.sessions.size, 1, "the list opens while nobody plays");
    playing.push(kat.id);
    sut.choose(hans, "trade");
    assert.deepEqual(hans.chat, ["Desconhecida não pode agora."]);
    assert.equal(sut.sessions.size, 0, "no invitation was sent to her");
    assert.equal(sut.started.length, 0);

    const dice = load({ tables: [[1, 2]], playing: [] });
    dice.api.installEncounters();
    const a = dice.makePlayer(1, "Hans");
    const b = dice.makePlayer(2, "Katerina");
    dice.talk(a, b);
    dice.choose(a, "dice");
    assert.equal(dice.sessions.size, 1, "outside a match the invitation goes as before");
});

const OFFICER_ROWS = [{ id: "arrest", text: "Prender", enabled: true }, { id: "release", text: "Soltar", enabled: true }];

test("an officer's list has Prender on someone free, between the duel and Sair; a player with no such power sees nothing more", () => {
    const sut = load({ rows: OFFICER_ROWS });
    sut.api.installEncounters();
    const guard = sut.makePlayer(1, "Guarda");
    const kat = sut.makePlayer(2, "Katerina");
    sut.talk(guard, kat);
    assert.deepEqual(sut.texts(guard), ["Apresentar-se", "Jogar dados (só junto de uma mesa de dados)", "Negociar", "Desafiar para um duelo", "Prender", "Sair"]);

    const bare = load();
    bare.api.installEncounters();
    const hans = bare.makePlayer(1, "Hans");
    const dora = bare.makePlayer(2, "Dorota");
    bare.talk(hans, dora);
    assert.ok(!bare.texts(hans).includes("Prender") && !bare.texts(hans).includes("Soltar"));
});

test("choosing Prender closes the list and hands the choice to the arrest, whose answer is told to the officer", () => {
    const sut = load({ rows: OFFICER_ROWS });
    sut.api.installEncounters();
    const guard = sut.makePlayer(1, "Guarda");
    const kat = sut.makePlayer(2, "Katerina");
    sut.talk(guard, kat);
    sut.choose(guard, "arrest");
    assert.equal(sut.sessionOf(guard), 0);
    assert.deepEqual(sut.arrestChosen, [[1, 2, "arrest"]]);
    assert.ok(guard.notices.includes("feito:arrest"));

    sut.talk(guard, kat);
    sut.choose(guard, "release");
    assert.deepEqual(sut.arrestChosen.at(-1), [1, 2, "release"], "the arrest decides whether it holds; the list passes it on");
});

test("somebody in handcuffs is a prisoner in the list: no dice, no trade, only the officer's Soltar and the way out", () => {
    const sut = load({ rows: OFFICER_ROWS });
    sut.api.installEncounters();
    const guard = sut.makePlayer(1, "Guarda");
    const kat = sut.makePlayer(2, "Katerina");
    sut.known.add("1>2");
    sut.arrested.push(2);
    sut.talk(guard, kat);
    assert.deepEqual(sut.texts(guard), ["Apresentar-se", "Soltar", "Sair"]);
    sut.choose(guard, "leave");

    const plain = load();
    plain.api.installEncounters();
    const hans = plain.makePlayer(1, "Hans");
    const dora = plain.makePlayer(2, "Dorota");
    plain.arrested.push(2);
    plain.talk(hans, dora);
    assert.deepEqual(plain.texts(hans), ["Apresentar-se", "Sair"], "a bystander has nothing to offer a prisoner but a name");
});

test("a prisoner opens no list; and an invitation sent before the cuffs went on is refused when it is answered or sent", () => {
    const sut = load({ rows: OFFICER_ROWS });
    sut.api.installEncounters();
    const hans = sut.makePlayer(1, "Hans");
    const kat = sut.makePlayer(2, "Katerina");
    sut.arrested.push(1);
    sut.talk(hans, kat);
    assert.equal(sut.sessionOf(hans), 0, "handcuffed hands open no list");
    sut.arrested.length = 0;

    sut.talk(hans, kat);
    sut.arrested.push(2);
    sut.choose(hans, "trade");
    assert.equal(sut.sessionOf(kat), 0, "no invitation reaches somebody who was arrested meanwhile");
    assert.ok(hans.notices.some((line) => /não pode agora/.test(line)));
});

test("a duel is an invitation that carries its rules; accepted, the duel is started for the pair", () => {
    const sut = load();
    sut.api.installEncounters();
    const hans = sut.makePlayer(1, "Hans");
    const kat = sut.makePlayer(2, "Katerina");
    sut.talk(hans, kat);
    assert.deepEqual({ ...sut.page(hans).options[3] }, { id: "duel", text: "Desafiar para um duelo", enabled: true });
    sut.choose(hans, "duel");
    assert.equal(sut.sessionOf(hans), 0, "Hans's list closes");
    assert.deepEqual(sut.texts(kat), ["Desconhecido quer duelar com você.", "Vai até um dos dois chegar a 20% da vida.", "Poções e efeitos saem do corpo.", "Aceitar", "Recusar"]);
    assert.ok(sut.page(kat).options.slice(0, 3).every((option) => option.enabled === false), "the rules are rows to read");
    assert.ok(hans.notices.some((line) => /para duelar\. Esperando a resposta\./.test(line)));
    sut.choose(kat, "accept");
    assert.deepEqual(sut.duelStarted, [[1, 2]]);
    assert.equal(sut.sessionOf(kat), 0);
});

test("a duel that cannot begin is said to whoever asked, before the other is bothered; one that fails on acceptance is said to both", () => {
    const sut = load();
    sut.api.installEncounters();
    const hans = sut.makePlayer(1, "Hans");
    const kat = sut.makePlayer(2, "Katerina");
    sut.state.duelRefusal = "Para duelar, a sua vida precisa estar acima de 80%.";
    sut.talk(hans, kat);
    sut.choose(hans, "duel");
    assert.equal(sut.sessionOf(kat), 0, "no invitation was sent");
    assert.ok(hans.notices.includes("Para duelar, a sua vida precisa estar acima de 80%."));

    sut.state.duelRefusal = null;
    sut.state.duelFails = "Desconhecido não está em condições de duelar agora.";
    sut.clock.now += 20_000;
    sut.talk(hans, kat);
    sut.choose(hans, "duel");
    sut.choose(kat, "accept");
    assert.deepEqual(sut.duelStarted, []);
    for (const player of [hans, kat]) {
        assert.ok(player.notices.includes("O duelo não pôde começar: Desconhecido não está em condições de duelar agora."));
    }
});

test("a declined duel is called a duel", () => {
    const sut = load();
    sut.api.installEncounters();
    const hans = sut.makePlayer(1, "Hans");
    const kat = sut.makePlayer(2, "Katerina");
    sut.known.add("1>2");
    sut.talk(hans, kat);
    sut.choose(hans, "duel");
    sut.choose(kat, "decline");
    assert.ok(hans.notices.includes("Katerina recusou o duelo."));
    assert.deepEqual(sut.duelStarted, []);
});

test("nobody in a duel is talked to, nor shows the talk hint, nor is invited to anything", () => {
    const sut = load({ dueling: [2] });
    sut.api.installEncounters();
    const hans = sut.makePlayer(1, "Hans");
    const kat = sut.makePlayer(2, "Katerina");
    const gus = sut.makePlayer(3, "Gustav");
    sut.talk(hans, kat);
    assert.equal(sut.sessionOf(hans), 0, "the one in a duel is not talked to");
    assert.ok(hans.notices.some((line) => /está em um duelo\./.test(line)));
    sut.talk(kat, gus);
    assert.equal(sut.sessionOf(kat), 0, "the one in a duel talks to nobody");
    sut.peek(hans, kat.id);
    sut.peek(kat, gus.id);
    assert.deepEqual(hans.labels, [{ id: 2, label: "" }]);
    assert.deepEqual(kat.labels, [{ id: 3, label: "" }]);

    // A duel that begins after the list was opened: no invitation of any kind reaches somebody in it.
    sut.dueling.length = 0;
    sut.talk(hans, gus);
    sut.dueling.push(3);
    sut.choose(hans, "trade");
    assert.equal(sut.sessionOf(gus), 0, "no invitation reaches somebody in a duel");
    assert.ok(hans.notices.some((line) => /não pode agora\./.test(line)));
});

test("the duel row is greyed while either of the two is in a duel", () => {
    const sut = load();
    sut.api.installEncounters();
    const hans = sut.makePlayer(1, "Hans");
    const kat = sut.makePlayer(2, "Katerina");
    sut.talk(hans, kat);
    assert.equal(sut.page(hans).options[3].enabled, true);
    sut.choose(hans, "leave");
    sut.dueling.push(1);
    // Built with Hans in a duel, the menu is never opened (the press does nothing), so the row's text is read off the class directly.
    const encounters = new sut.api.Encounters(() => sut.clock.now);
    const menu = encounters.menu(hans, kat);
    assert.deepEqual({ ...menu.options.find((option) => option.id === "duel") }, { id: "duel", text: "Desafiar para um duelo (já em duelo)", enabled: false });
});
