const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const RESOURCE = "kcdc-gamemode";

/** `tables` lists the pairs of player ids standing at one dice table; `trading` the ids already in a trade. */
function load({ tables = [], trading = [] } = {}) {
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
    const pairs = [];
    const started = [];
    const state = { pairFails: null, startFails: false, apart: null };
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
            if (id === "./dice.js") {
                return {
                    diceLobby: {
                        sameTable: (a, b) => tables.some(([x, y]) => (x === a.id && y === b.id) || (x === b.id && y === a.id)),
                        explainApart: (a, b) => (state.apart ? `${a.nickname} e ${b.nickname}: ${state.apart}` : null),
                        pair: async (a, b) => {
                            if (state.pairFails) throw new Error(state.pairFails);
                            pairs.push([a.id, b.id]);
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
    return { api: context.exports, emit, handlers, clients, sessions, players, intervals, clock, known, pairs, started, state, logs, makePlayer, sessionOf, page, texts, choose, talk, peek };
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

test("the talk key on a close player opens the game's list: introduce, dice, trade, leave", () => {
    const sut = load();
    sut.api.installEncounters();
    const hans = sut.makePlayer(1, "Hans");
    const kat = sut.makePlayer(2, "Katerina");
    sut.talk(hans, kat);
    assert.deepEqual(sut.texts(hans), ["Apresentar-se", "Jogar dados (só junto de uma mesa de dados)", "Negociar", "Sair"]);
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
    assert.deepEqual(sut.texts(hans), ["Jogar dados (só junto de uma mesa de dados)", "Negociar", "Sair"], "the talk goes on without it");

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
