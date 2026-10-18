const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");

/** `emptyAtStart`: the level lists no table until `revealTables()`, as a level not loaded yet would. */
function setup({ emptyAtStart = false } = {}) {
    let tablesHidden = emptyAtStart;
    const timeouts = [];
    const logs = [];
    const handlers = new Map();
    const clients = new Map();
    const sessions = new Map();
    const players = [];
    const starts = [];
    const matches = new Map();
    const messages = new Map();
    const areas = [];
    let now = 1000;
    let nextSession = 1;
    let tick;
    let containsCalls = 0;
    let failOpen = false;
    let failStart = false;
    // The pot (dice-pot.js): what each carries, and what was held, bound and given back.
    const purses = new Map();
    const pot = { holds: [], binds: [], releases: [] };
    const dicePots = {
        coinsOf: (player) => purses.get(player.id) ?? 1000,
        hold: (first, second, stake) => {
            for (const player of [first, second]) if ((purses.get(player.id) ?? 1000) < stake) return { short: player };
            const held = { match: 0, stake, seats: [first, second].map((player) => ({ steamId: `s${player.id}`, name: player.nickname, coins: stake, items: player.dice ? [{ item: "die", amount: 6, metadata: {} }] : [] })) };
            pot.holds.push({ first: first.id, second: second.id, stake });
            return held;
        },
        bind: (held, match) => { held.match = match; pot.binds.push({ match, stake: held.stake }); },
        release: (held, players) => pot.releases.push({ stake: held.stake, players: Array.from(players, (player) => player.id) }),
    };
    const emit = (name, ...args) => {
        for (const handler of handlers.get(name) ?? []) handler(...args);
    };
    // The server raises areaEnter/areaExit from its own tick, before scripts run.
    const crossings = () => {
        for (const area of areas) {
            for (const player of players) {
                const inside = area.exists && area.enabled && area.contains(player);
                if (inside === area.occupants.has(player)) continue;
                if (inside) area.occupants.add(player); else area.occupants.delete(player);
                emit(inside ? "areaEnter" : "areaExit", area, player, true);
            }
        }
    };
    class Player {
        static all() { return players; }
        static getById(id) { return players.find((player) => player.id === id) ?? null; }
    }
    const context = {
        exports: {},
        // Names as the other player knows them; here everybody knows everybody.
        require: (name) => {
            if (name === "./dice-pot.js") return { dicePots, STAKE_STEPS: [0, 5, 10, 20, 50, 100, 200, 500, 1000], coinsText: (coins) => `${coins} ${coins === 1 ? "moeda" : "moedas"}` };
            assert.equal(name, "./acquaintances.js");
            return { labelFor: (_viewer, target) => target.nickname };
        },
        console: { log: (line) => logs.push(line), error: (line) => logs.push(line) },
        Date: { now: () => now },
        setTimeout: (handler, ms) => { timeouts.push({ handler, ms }); return timeouts.length; },
        setInterval: (handler) => { tick = () => { crossings(); handler(); }; return 1; },
        clearInterval: () => { tick = undefined; },
        Vector3: class { constructor(x, y, z) { Object.assign(this, { x, y, z }); } },
        Player,
        Messages: { handle: (name, handler) => messages.set(name, handler) },
        Navigation: { ready: false },
        Crafting: { session: () => null },
        World: { entitiesInRadius: async () => ({ answered: true, entities: [{ guid: "table1" }, { guid: "table2" }] }) },
        Chat: { sendToPlayer: (player, line) => player.chat.push(line) },
        Events: {
            on: (name, handler) => handlers.set(name, [...(handlers.get(name) ?? []), handler]),
            onClient: (name, handler) => clients.set(name, handler),
        },
        Area: { create: (definition) => {
            const contains = (player) => Math.hypot(player.position.x - definition.position.x, player.position.y - definition.position.y, player.position.z - definition.position.z) <= definition.radius;
            const area = { ...definition, occupants: new Set(), exists: true, enabled: true, contains, containsPlayer: (player) => { containsCalls++; return contains(player); }, destroy: () => { area.exists = false; for (const player of [...area.occupants]) { area.occupants.delete(player); emit("areaExit", area, player, true); } } };
            areas.push(area);
            return area;
        } },
        Dice: {
            // table1quest is table1 again on a quest layer: same chairs, another GUID.
            tables: () => (tablesHidden ? [] : [{ id: "table1", position: { x: 0, y: 0, z: 0 }, seats: ["seat1", "seat2"] }, { id: "table2", position: { x: 20, y: 0, z: 0 }, seats: ["seat3", "seat4"] }, { id: "table1quest", position: { x: 0.3, y: 0, z: 0 }, seats: ["seat5", "seat6"] }]),
            matchOf: (id) => matches.get(id) ?? 0,
            start: (first, second, options) => {
                if (failStart) throw new Error("Native start refused");
                starts.push({ first, second, score: options.targetScore, firstName: options.firstName, secondName: options.secondName });
                matches.set(first, starts.length);
                matches.set(second, starts.length);
                emit("diceMatchStart", starts.length, players.find((p) => p.id === first), players.find((p) => p.id === second));
                return starts.length;
            },
            stop: (match) => {
                for (const [id, current] of matches) if (current === match) matches.delete(id);
                emit("diceMatchEnd", match);
            },
        },
        Dialogue: {
            sessionOf: (id) => [...sessions].find(([, value]) => value.player.id === id)?.[0] ?? 0,
            open: (id, page) => {
                if (failOpen) return 0;
                const session = nextSession++;
                sessions.set(session, { player: players.find((player) => player.id === id), page });
                return session;
            },
            update: (session, page) => {
                if (!sessions.has(session)) return false;
                sessions.get(session).page = page;
                return true;
            },
            close: (session) => {
                const old = sessions.get(session);
                sessions.delete(session);
                if (old) emit("dialogueClosed", session, old.player, 0);
            },
        },
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/dice.js"), "utf8"), context);
    const lobby = context.exports.diceLobby;
    lobby.install();
    const add = (id, seat = id === 1 ? "seat1" : "seat2", world = 0) => {
        const player = Object.assign(new Player(), { id, nickname: `Player ${id}`, ready: true, alive: true, mounted: false, health: 100, virtualWorld: world, position: { x: seat === "seat3" || seat === "seat4" ? 20 : 0, y: 0, z: 0 }, messages: [], chat: [], emit: (...args) => player.messages.push(args), teleport: (position) => { player.position = position; return true; } });
        players.push(player);
        return player;
    };
    const a = add(1);
    const b = add(2);
    tick();
    const choose = (player, option) => emit("dialogueChoice", context.Dialogue.sessionOf(player.id), player, option);
    const pageOf = (player) => sessions.get(context.Dialogue.sessionOf(player.id))?.page;
    const optionOf = (player, id) => pageOf(player)?.options.find((option) => option.id === id);
    return {
        a, b, add, lobby, starts, sessions, areas, emit, choose, context, players, timeouts, logs, purses, pot, pageOf, optionOf,
        revealTables: () => { tablesHidden = false; },
        freeDice: (player) => { let result; messages.get("playground:freeDice")({ player: player.id }, (value) => result = value); return result; },
        containsCalls: () => containsCalls,
        interactWith: (player, table) => clients.get("kcdc-gamemode:dice.interact")(player, { token: JSON.parse(player.messages.at(-1)[1]).token, table }),
        tick: () => tick?.(),
        advance: (ms) => { now += ms; tick?.(); },
        interact: (player, token = JSON.parse(player.messages.at(-1)[1]).token) => clients.get("kcdc-gamemode:dice.interact")(player, { token, table: JSON.parse(player.messages.at(-1)[1]).tables[0]?.id }),
        pair: () => { clients.get("kcdc-gamemode:dice.interact")(a, { token: JSON.parse(a.messages.at(-1)[1]).token, table: JSON.parse(a.messages.at(-1)[1]).tables[0]?.id }); clients.get("kcdc-gamemode:dice.interact")(b, { token: JSON.parse(b.messages.at(-1)[1]).token, table: JSON.parse(b.messages.at(-1)[1]).tables[0]?.id }); },
        failOpen: () => { failOpen = true; },
        failStart: () => { failStart = true; },
    };
}

test("approaching alone does not join; leaving range revokes an unacknowledged interaction", () => {
    const h = setup();
    assert.equal(h.sessions.size, 0);
    assert.equal(JSON.parse(h.a.messages.at(-1)[1]).joined, false);
    const token = JSON.parse(h.a.messages.at(-1)[1]).token;
    h.a.position.y = 4;
    h.interact(h.a, token);
    assert.equal(JSON.parse(h.a.messages.at(-1)[1]).tables.length, 0);
    h.interact(h.b);
    assert.equal(h.sessions.size, 0);
});

test("standing players join by interaction, can leave, and both must agree before being seated", () => {
    const h = setup();
    h.interact(h.b);
    h.interact(h.b);
    h.interact(h.a);
    assert.equal(h.sessions.size, 0);
    h.interact(h.b);
    assert.equal(h.sessions.size, 2);
    h.choose(h.b, "agree"); // Waiting player cannot agree or edit.
    h.choose(h.b, "raise");
    assert.equal(h.starts.length, 0);
    h.choose(h.a, "agree");
    assert.equal(h.starts.length, 0);
    h.choose(h.b, "agree");
    assert.deepEqual(h.starts, [{ first: 1, second: 2, score: 2000, firstName: "Player 1", secondName: "Player 2" }]);
    assert.equal(h.sessions.size, 0);
});

test("the stake goes up and down a step at a time with the score, both agree to it, and it is held when the match starts", () => {
    const h = setup();
    h.pair();
    assert.match(h.optionOf(h.a, "agree").text, /^Propor: até 2000 pontos, sem aposta\.$/);
    assert.equal(h.optionOf(h.a, "stakeDown").enabled, false, "nothing to lower");
    assert.match(h.optionOf(h.a, "stakeUp").text, /^Apostar 5 moedas cada\.$/);
    h.choose(h.a, "stakeUp");
    h.choose(h.a, "stakeUp");
    assert.match(h.optionOf(h.a, "agree").text, /apostando 10 moedas cada/);
    assert.match(h.optionOf(h.a, "stakeDown").text, /^Apostar só 5 moedas cada\.$/);
    assert.ok(h.pageOf(h.b).options.some((option) => option.id === "waiting" && /apostando 10 moedas cada/.test(option.text)), "the other sees it");
    h.choose(h.b, "stakeUp");
    assert.match(h.optionOf(h.a, "agree").text, /apostando 10 moedas cada/, "the one waiting cannot change it");

    h.choose(h.a, "agree");
    assert.match(h.optionOf(h.b, "agree").text, /^Aceitar: até 2000 pontos, apostando 10 moedas cada\.$/);
    h.choose(h.b, "agree");
    assert.equal(h.starts.length, 1);
    assert.deepEqual(h.pot.holds, [{ first: 1, second: 2, stake: 10 }]);
    assert.deepEqual(h.pot.binds, [{ match: 1, stake: 10 }]);
    for (const player of [h.a, h.b]) {
        assert.ok(player.chat.some((line) => /Aposta: 10 moedas de cada um, guardadas até o fim; quem vencer leva 20 moedas/.test(line)));
        assert.ok(player.chat.some((line) => /Teclas padrão da mesa: E marca um dado, F pontua e joga o resto, Q pontua e passa a vez; segure Esc para desistir/.test(line)));
    }
});

test("a change of stake takes back an agreement, as a change of score does", () => {
    const h = setup();
    h.pair();
    h.choose(h.a, "agree");
    h.choose(h.b, "stakeUp");
    h.choose(h.b, "agree");
    assert.equal(h.starts.length, 0, "a only agreed to no stake");
    h.choose(h.a, "agree");
    assert.equal(h.starts.length, 1);
    assert.deepEqual(h.pot.holds, [{ first: 1, second: 2, stake: 5 }]);
});

test("a stake is raised only to what the one raising it carries, and one the other cannot pay stops the match before it starts", () => {
    const h = setup();
    h.purses.set(1, 7);
    h.pair();
    h.choose(h.a, "stakeUp");
    assert.equal(h.optionOf(h.a, "stakeUp").enabled, false);
    assert.match(h.optionOf(h.a, "stakeUp").text, /^Apostar 10 moedas cada \(você não tem\)\.$/);
    h.choose(h.a, "stakeUp");
    assert.match(h.optionOf(h.a, "agree").text, /apostando 5 moedas cada/, "the greyed step does nothing");

    const poor = setup();
    poor.purses.set(2, 3);
    poor.pair();
    poor.choose(poor.a, "stakeUp");
    poor.choose(poor.a, "agree");
    poor.choose(poor.b, "agree");
    assert.equal(poor.starts.length, 0);
    assert.equal(poor.sessions.size, 0);
    assert.match(poor.b.chat.at(-1), /^Você não tem 5 moedas para a aposta\.$/);
    assert.match(poor.a.chat.at(-1), /^Player 2 não tem 5 moedas para a aposta\.$/);
});

test("a match the game will not start gives the stake and the dice back", () => {
    const h = setup();
    h.failStart();
    h.pair();
    h.choose(h.a, "stakeUp");
    h.choose(h.a, "agree");
    h.choose(h.b, "agree");
    assert.equal(h.starts.length, 0);
    assert.deepEqual(h.pot.releases, [{ stake: 5, players: [1, 2] }]);
    assert.deepEqual(h.pot.binds, []);
});

test("whoever carries dice is told they are kept for the match; with no stake nothing is said of one", () => {
    const h = setup();
    h.a.dice = true;
    h.pair();
    h.choose(h.a, "agree");
    h.choose(h.b, "agree");
    assert.ok(h.a.chat.some((line) => /Seus dados ficam guardados durante o jogo/.test(line)));
    assert.ok(!h.b.chat.some((line) => /Seus dados ficam guardados/.test(line)));
    assert.ok(![...h.a.chat, ...h.b.chat].some((line) => /Aposta:/.test(line)));
});

test("a counteroffer invalidates prior consent and returns to the other player", () => {
    const h = setup();
    h.pair();
    h.choose(h.a, "agree");
    h.choose(h.b, "raise");
    h.choose(h.b, "agree");
    assert.equal(h.starts.length, 0);
    h.choose(h.a, "lower");
    h.choose(h.a, "agree");
    assert.equal(h.starts.length, 0);
    h.choose(h.b, "agree");
    assert.equal(h.starts[0].score, 2000);
});

for (const action of ["quit", "escape", "disconnect", "death", "leave area", "world", "timeout", "replacement"]) {
    test(`waiting player can cancel through ${action}; stale choices cannot start a match`, () => {
        const h = setup();
        h.pair();
        const oldSession = h.context.Dialogue.sessionOf(h.a.id);
        if (action === "quit") h.choose(h.b, "quit");
        if (action === "escape" || action === "replacement") h.context.Dialogue.close(h.context.Dialogue.sessionOf(h.b.id));
        if (action === "disconnect") { h.emit("playerDisconnect", h.b); h.players.splice(1, 1); }
        if (action === "death") h.emit("playerDied", h.b);
        if (action === "leave area") h.b.position.x = 50;
        if (action === "world") h.b.virtualWorld = 1;
        if (action === "timeout") h.advance(60_001);
        h.tick();
        h.emit("dialogueChoice", oldSession, h.a, "agree");
        assert.equal(h.starts.length, 0);
        assert.equal(h.sessions.size, 0);
        h.tick();
        assert.equal(h.sessions.size, 0);
    });
}

test("different tables and worlds do not share a lobby", () => {
    for (const change of [(p) => { p.virtualWorld = 1; }, (p) => { p.position.x = 20; }]) {
        const h = setup();
        change(h.b);
        h.tick();
        h.pair();
        assert.equal(h.sessions.size, 0);
        assert.equal(h.starts.length, 0);
    }
});

test("a third nearby player cannot join or cancel another pair's negotiation", () => {
    const h = setup();
    const c = h.add(3, "seat1");
    h.tick();
    h.pair();
    h.interact(c);
    h.lobby.cancelFor(c);
    h.tick();
    assert.equal(h.sessions.size, 2);
    h.choose(h.a, "agree");
    h.choose(h.b, "agree");
    assert.equal(h.starts.length, 1);
});

test("old interaction tokens cannot join after walking away or reopen cancelled setup", () => {
    const h = setup();
    const oldToken = JSON.parse(h.a.messages.at(-1)[1]).token;
    h.a.position.x = 50;
    h.tick();
    h.interact(h.a, oldToken);
    h.a.position.x = 0;
    h.tick();
    h.interact(h.a, oldToken);
    h.interact(h.b);
    assert.equal(h.sessions.size, 0);
    const current = JSON.parse(h.a.messages.at(-1)[1]).token;
    h.interact(h.a);
    h.choose(h.b, "quit");
    h.interact(h.a, current);
    h.tick();
    assert.equal(h.sessions.size, 0);
});

test("one table on two quest layers is one lobby, whichever row each player joins through", () => {
    const h = setup();
    h.interactWith(h.a, "table1");
    h.interactWith(h.b, "table1quest");
    assert.equal(h.sessions.size, 2);
    h.choose(h.a, "agree");
    h.choose(h.b, "agree");
    assert.equal(h.starts.length, 1);
    const c = h.add(3);
    const d = h.add(4);
    h.tick();
    h.interactWith(c, "table1quest");
    h.interactWith(d, "table1");
    assert.equal(h.starts.length, 1);
    assert.equal(h.sessions.size, 0);
});

test("an unanswered invitation does not hold the table, and the tick skips players away from tables", async () => {
    const h = setup();
    await h.lobby.invite(h.a, h.b, 2000);
    const c = h.add(3);
    const d = h.add(4);
    h.tick();
    h.interact(c);
    h.interact(d);
    assert.equal(h.sessions.size, 2);
    assert.throws(() => h.lobby.accept(h.b), /ocupada|termine/);
    // Crossings are the engine's; the lobby only asks about players at a table.
    const ticks = () => { const before = h.containsCalls(); for (let i = 0; i < 10; i++) h.tick(); return h.containsCalls() - before; };
    const baseline = ticks();
    for (let id = 10; id < 30; id++) h.add(id).position.x = 500;
    h.tick();
    assert.equal(ticks(), baseline);
});

test("invitations reserve players, expire, and acceptance only opens negotiation", async () => {
    const h = setup();
    await h.lobby.invite(h.a, h.b, 4000);
    await assert.rejects(h.lobby.invite(h.a, h.b, 5000), /já está esperando/);
    h.interact(h.a);
    assert.equal(h.sessions.size, 0);
    h.advance(60_001);
    assert.throws(() => h.lobby.accept(h.b), /Ninguém/);
    await h.lobby.invite(h.a, h.b, 4000);
    h.lobby.accept(h.b);
    assert.equal(h.starts.length, 0);
    h.choose(h.a, "agree");
    h.choose(h.b, "agree");
    assert.equal(h.starts[0].score, 4000);
});

test("invitations reject unloaded tables and recheck player state after the client query", async () => {
    const h = setup();
    h.context.World.entitiesInRadius = async () => ({ answered: true, entities: [] });
    await assert.rejects(h.lobby.invite(h.a, h.b, 2000), /mesma mesa de dados/);
    h.context.World.entitiesInRadius = async () => ({ answered: false, entities: [] });
    await assert.rejects(h.lobby.invite(h.a, h.b, 2000), /Tente de novo/);
    h.context.World.entitiesInRadius = async () => {
        h.b.virtualWorld = 1;
        return { answered: true, entities: [{ guid: "table1" }] };
    };
    await assert.rejects(h.lobby.invite(h.a, h.b, 2000), /mesma mesa de dados/);
    assert.equal(h.sessions.size, 0);
    assert.throws(() => h.lobby.accept(h.b), /Ninguém/);
});

test("the talk menu asks whether two players share a table, on whichever quest layer", () => {
    const h = setup();
    assert.equal(h.lobby.sameTable(h.a, h.b), true);
    const across = h.add(3, "seat3");
    const away = h.add(4);
    away.position = { x: 500, y: 0, z: 0 };
    h.tick();
    assert.equal(h.lobby.sameTable(h.a, across), false, "another table is not the same table");
    assert.equal(h.lobby.sameTable(h.a, away), false, "nor is no table at all");
    assert.equal(h.lobby.sameTable(away, away), false);
    h.b.position.x = 50;
    h.tick();
    assert.equal(h.lobby.sameTable(h.a, h.b), false, "and it follows players walking off");
});

test("a pair agreed in the talk menu goes straight to the score, without the chat commands", async () => {
    const h = setup();
    await h.lobby.pair(h.a, h.b);
    assert.equal(h.sessions.size, 2, "both are asked about the score at once");
    for (const player of [h.a, h.b]) {
        assert.ok(!player.chat.some((line) => /\/dice/.test(line)), "nobody is told to type /dice accept for a game already accepted");
    }
    h.choose(h.a, "agree");
    h.choose(h.b, "agree");
    assert.equal(h.starts.length, 1);
    assert.equal(h.starts[0].score, 2000);

    const c = h.add(3);
    const d = h.add(4);
    h.tick();
    await assert.rejects(h.lobby.pair(c, d), /ocupada/);
    assert.throws(() => h.lobby.accept(d), /Ninguém/, "a refused pair leaves no invitation behind");
    const across = h.add(5, "seat3");
    h.tick();
    await assert.rejects(h.lobby.pair(c, across), /mesma mesa de dados/);
});

test("somebody already waiting at the table can still be paired from the talk menu", async () => {
    const h = setup();
    h.interact(h.a);
    assert.match(h.a.chat.at(-1), /Esperando outra pessoa/);
    await h.lobby.pair(h.b, h.a);
    assert.equal(h.sessions.size, 2, "the wait gives way to the game they agreed on");
    h.choose(h.b, "agree");
    h.choose(h.a, "agree");
    assert.equal(h.starts.length, 1);

    const busy = setup();
    busy.pair();
    await assert.rejects(busy.lobby.pair(busy.a, busy.b), /já está esperando|ocupada/, "a score already being agreed is not thrown away");
    assert.equal(busy.sessions.size, 2);
});

test("score boundaries, dialogue failure, and native start failure leave no pending setup", async () => {
    for (const [score, option] of [[100, "lower"], [100000, "raise"]]) {
        const h = setup();
        await h.lobby.invite(h.a, h.b, score);
        h.lobby.accept(h.b);
        h.choose(h.a, option);
        h.choose(h.a, "agree");
        h.choose(h.b, "agree");
        assert.equal(h.starts[0].score, score);
    }
    const failedDialogue = setup();
    failedDialogue.failOpen();
    failedDialogue.pair();
    assert.equal(failedDialogue.sessions.size, 0);
    const failedStart = setup();
    failedStart.failStart();
    failedStart.pair();
    failedStart.choose(failedStart.a, "agree");
    failedStart.choose(failedStart.b, "agree");
    assert.equal(failedStart.sessions.size, 0);
    assert.equal(failedStart.starts.length, 0);
    assert.match(failedStart.b.chat.at(-1), /Native start refused/);
});

test("match end requires fresh readiness and resource stop removes areas and dialogues", () => {
    const h = setup();
    h.pair();
    h.choose(h.a, "agree");
    h.choose(h.b, "agree");
    h.context.Dice.stop(1);
    h.tick();
    assert.equal(h.sessions.size, 0);
    h.pair();
    h.emit("resourceStop", "kcdc-gamemode");
    assert.equal(h.sessions.size, 0);
    assert.ok(h.areas.every((area) => !area.exists));
});

test("client Interact hint requires proximity, aim and a loaded station; joining needs no Space toggle", () => {
    const handlers = new Map();
    const hints = new Map();
    const requests = [];
    let nextHint = 1;
    let tick;
    let loaded = true;
    let hit = null;
    let raycasts = 0;
    let direction = { x: 0, y: 1, z: 0 };
    const context = {
        exports: {},
        setInterval: (handler) => { tick = handler; return 1; },
        clearInterval: () => { tick = undefined; },
        Vector3: class { constructor(x, y, z) { Object.assign(this, { x, y, z }); } },
        LocalPlayer: { ready: true, alive: true, virtualWorld: 0, position: { x: 0, y: -2, z: 0 } },
        Camera: { screenRay: () => ({ origin: { x: 0, y: -2, z: 1 }, direction }) },
        World: { raycast: () => { raycasts++; return hit; }, entitiesInRadius: () => loaded ? [{ guid: "table1" }, { guid: "farther" }] : [] },
        Events: { on: (name, handler) => handlers.set(name, handler), emitServer: (...args) => requests.push(args) },
        ActionHint: {
            create: (options, handler) => { const id = nextHint++; hints.set(id, { ...options, handler }); return id; },
            remove: (id) => hints.delete(id),
            setText: (id, text) => { hints.get(id).text = text; },
        },
    };
    const interaction = {};
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/client/interaction.js"), "utf8"), { ...context, exports: interaction });
    context.require = (name) => { assert.equal(name, "./interaction.js"); return interaction; };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/client/dice.js"), "utf8"), context);
    context.exports.installDice();
    assert.equal(requests[0][0], "kcdc-gamemode:dice.sync");
    // The owner's client world can differ from the server's default-world sentinel.
    const receive = (token, joined, available = true) => handlers.get("kcdc-gamemode:dice.state")(JSON.stringify({ token, joined, world: 4294967295, tables: available ? [{ id: "farther", position: { x: 0, y: 0.5, z: 0 } }, { id: "inactive", position: { x: 0, y: -0.5, z: 0 } }, { id: "table1", position: { x: 0, y: 0, z: 0 } }] : [] }));
    receive(1, false);
    assert.equal(raycasts, 2); // Stop at the nearest valid table; do not trace the farther one.
    let hint = [...hints.values()][0];
    assert.equal(hint.key, "primary_action");
    assert.match(hint.text, /Jogar dados/);
    direction = { x: 0, y: -1, z: 0 };
    raycasts = 0;
    hint.handler(); // Recheck the current aim even before the next tick.
    assert.equal(requests.length, 1);
    tick();
    assert.equal(hints.size, 0);
    assert.equal(raycasts, 0); // Looking away never reaches the physics query.
    direction = { x: 0, y: 1, z: 0 };
    tick();
    hint = [...hints.values()][0];
    hint.handler();
    assert.equal(hints.size, 0);
    assert.equal(requests.at(-1)[0], "kcdc-gamemode:dice.interact");
    assert.equal(requests.at(-1)[1].token, 1);
    assert.equal(requests.at(-1)[1].table, "table1");
    hint.handler();
    assert.equal(requests.length, 2);
    receive(2, true);
    assert.match([...hints.values()][0].text, /Sair da mesa de dados/);
    for (const [invalidate, restore] of [
        [() => { loaded = false; }, () => { loaded = true; }],
        [() => { hit = { distance: 0.2 }; }, () => { hit = null; }],
        [() => { context.LocalPlayer.position.y = -4; }, () => { context.LocalPlayer.position.y = -2; }],
        // Somebody under the crosshair has "[E] Conversar" up: one key, one action.
        [() => { interaction.setPersonInView(7); }, () => { interaction.setPersonInView(0); }],
    ]) {
        invalidate(); tick(); assert.equal(hints.size, 0);
        restore(); tick(); assert.equal(hints.size, 1);
    }
    const before = requests.length;
    interaction.setPersonInView(7);
    [...hints.values()][0].handler();
    assert.equal(requests.length, before, "a press in the moment both hints are up goes to the person");
    interaction.setPersonInView(0);
    receive(3, true, false);
    assert.equal(hints.size, 0);
    context.LocalPlayer.position.y = -4;
    raycasts = 0;
    receive(4, false);
    tick();
    assert.equal(raycasts, 0); // Distant targets never reach the physics query either.
    context.LocalPlayer.position.y = -2;
    receive(4, false);
    handlers.get("resourceStop")("kcdc-gamemode");
    assert.equal(hints.size, 0);
    assert.equal(tick, undefined);
});

test("playground skips occupied physical tables and quest-layer duplicates", () => {
    const h = setup();
    h.a.position.x = 8;
    const result = h.freeDice(h.a);
    assert.equal(result.error, undefined);
    assert.equal(h.a.position.x, 22);
});

test("playground excludes waiting lobbies and keeps virtual worlds separate", () => {
    const h = setup();
    h.interact(h.b);
    h.a.position.x = 8;
    h.b.position.x = 100; // Lobby still owns its place until the next tick.
    assert.equal(h.freeDice(h.a).error, undefined);
    assert.equal(h.a.position.x, 22);
    const other = h.add(3, "seat1", 9);
    other.position.x = 8;
    assert.equal(h.freeDice(other).error, undefined);
    assert.equal(other.position.x, 2);
});

test("playground refuses movement while mounted or with every table occupied", () => {
    const h = setup();
    h.a.position.x = 8;
    h.a.mounted = true;
    assert.match(h.freeDice(h.a).error, /activity/);
    h.a.mounted = false;
    h.add(3, "seat3");
    assert.match(h.freeDice(h.a).error, /unoccupied/);
    assert.equal(h.a.position.x, 8);
});

test("two players at a table share it even when the area's crossing was never reported", () => {
    const h = setup();
    // Added and never ticked: the engine has said nothing about these two entering the area.
    const c = h.add(3);
    const d = h.add(4);
    assert.equal(h.lobby.sameTable(c, d), true);
    d.position = { x: 3.6, y: 0, z: 0 };
    assert.equal(h.lobby.sameTable(c, d), false, "a step past the table's reach is too far");
    d.virtualWorld = 7;
    d.position = { x: 0, y: 0, z: 0 };
    assert.equal(h.lobby.sameTable(c, d), false, "another world is another table");
});

test("the server log says how far each player stood when the talk menu found no table they share", () => {
    const h = setup();
    h.b.position = { x: 3.4, y: 0, z: 0 };
    h.tick();
    assert.equal(h.lobby.sameTable(h.a, h.b), false);
    const why = h.lobby.explainApart(h.a, h.b);
    assert.match(why, /Player 1 a 0\.0 m da mesa table1 \(dentro da área\)/);
    assert.match(why, /Player 2 a 3\.1 m da mesa table1quest/);
    assert.match(why, /alcance 3 m/);

    h.a.position = { x: 500, y: 0, z: 0 };
    h.b.position = { x: -500, y: 0, z: 0 };
    assert.equal(h.lobby.explainApart(h.a, h.b), null, "nobody near a table: nothing to say");
});

test("a level that lists no table at start is asked again later, and says so", () => {
    const h = setup({ emptyAtStart: true });
    assert.ok(h.logs.some((line) => /nenhuma mesa de dados/.test(line)));
    assert.equal(h.areas.length, 0);
    assert.equal(h.lobby.sameTable(h.a, h.b), false);
    assert.match(h.lobby.explainApart(h.a, h.b), /nenhuma mesa/);

    h.revealTables();
    h.timeouts[0].handler();
    assert.equal(h.areas.length, 3);
    assert.ok(h.logs.some((line) => /2 mesas de dados no nível \(3 contando as camadas de missão\)/.test(line)));
    assert.equal(h.lobby.sameTable(h.a, h.b), true);
    h.timeouts[1].handler();
    assert.equal(h.areas.length, 3, "a later retry adds nothing twice");
});
