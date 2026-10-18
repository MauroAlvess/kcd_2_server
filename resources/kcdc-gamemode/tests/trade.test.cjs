const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const MONEY_GUID = "5ef63059-322e-4e1b-abe8-926e100c770e";

function fakeDisk(seed = {}) {
    const files = new Map(Object.entries(seed));
    return {
        files,
        fs: {
            readFileSync(file) {
                if (!files.has(file)) throw new Error("ENOENT");
                return files.get(file);
            },
            writeFileSync(file, data) { files.set(file, data); },
            mkdirSync() {},
            renameSync(from, to) { files.set(to, files.get(from)); files.delete(from); },
            existsSync: (file) => files.has(file),
        },
    };
}

/**
 * Two players with inventories (`rows`), virtual stashes that keep rows, and the game's dialogue list. `scriptEvents`
 * makes the stashes raise their change event for the module's own moves too, as the server may.
 */
function load({ seed = {}, scriptEvents = true } = {}) {
    const disk = fakeDisk(seed);
    const storeSandbox = { exports: {}, require: () => disk.fs };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/store.js"), "utf8"), storeSandbox);

    const handlers = new Map();
    const emit = (name, ...args) => {
        let answer;
        for (const fn of handlers.get(name) ?? []) {
            const result = fn(...args);
            if (result !== undefined) answer = result;
        }
        return answer;
    };
    const sessions = new Map();
    let nextSession = 1;
    let nextStash = 100;
    let nextRow = 1;
    const stashes = [];
    const intervals = [];
    const timeouts = [];
    const clock = { now: 1_000_000 };

    const rowsOf = (owner) => owner.rows;
    const addTo = (rows, item, amount, metadata) => {
        const same = rows.find((row) => row.item === item && JSON.stringify(row.metadata) === JSON.stringify(metadata ?? {}));
        if (same) same.amount += amount;
        else rows.push({ id: `r${nextRow++}`, item, name: item === MONEY_GUID || item === "money" ? "money" : item, amount, metadata: { ...(metadata ?? {}) }, equipped: 0 });
    };
    const takeFrom = (rows, units) => {
        for (const unit of units) {
            const row = rows.find((candidate) => candidate.id === unit.id);
            if (!row || row.amount < unit.amount) return false;
        }
        for (const unit of units) {
            const row = rows.find((candidate) => candidate.id === unit.id);
            row.amount -= unit.amount;
            if (row.amount === 0) rows.splice(rows.indexOf(row), 1);
        }
        return true;
    };

    const context = {
        exports: {},
        require: (id) => {
            if (id === "./store.js") return storeSandbox.exports;
            if (id === "./acquaintances.js") return { labelFor: (_viewer, target) => target.nickname };
            if (id === "./item-names.js") return { itemLine: (row) => (row.amount > 1 ? `${row.amount}x ${row.item}` : row.item) };
            assert.fail(`unexpected require ${id}`);
        },
        console: { log() {}, error() {} },
        Date: { now: () => clock.now },
        setInterval: (fn, ms) => { intervals.push({ fn, ms }); return intervals.length; },
        setTimeout: (fn, ms) => { timeouts.push({ fn, ms }); return timeouts.length; },
        clearInterval() {},
        Chat: { sendToPlayer: (player, text) => player.chat.push(text) },
        Events: { on: (name, fn) => handlers.set(name, [...(handlers.get(name) ?? []), fn]) },
        Inventory: {
            get: (player) => (player.gone ? null : { revision: 1, items: rowsOf(player) }),
            add: (player, request) => {
                if (player.gone || player.full) return { ok: false, code: "inventoryCapacity" };
                const item = request.item === "money" ? MONEY_GUID : request.item;
                addTo(player.rows, item, request.amount, request.metadata);
                return { ok: true, code: "" };
            },
            remove: (player, request) => (player.gone ? { ok: false, code: "inventoryUnavailable" } : { ok: takeFrom(player.rows, request.units), code: "" }),
        },
        Stash: {
            createVirtual: (world) => {
                const stash = {
                    id: nextStash++,
                    world,
                    rows: [],
                    opened: [],
                    destroyed: false,
                    getInventory() { return this.destroyed ? null : { revision: 1, items: this.rows }; },
                    addItem(request) {
                        addTo(this.rows, request.item, request.amount, request.metadata);
                        if (scriptEvents) emit("stashInventoryChanged", this, null, {});
                        return { ok: true, code: "" };
                    },
                    removeItem(request) {
                        const ok = takeFrom(this.rows, request.units);
                        if (ok && scriptEvents) emit("stashInventoryChanged", this, null, {});
                        return { ok, code: ok ? "" : "insufficientItems" };
                    },
                    open(player) { this.opened.push(player.id); return true; },
                    destroy() { this.destroyed = true; },
                };
                stashes.push(stash);
                return stash;
            },
        },
        Dialogue: {
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
                emit("dialogueClosed", session, players.find((p) => p.id === old.playerId), 0);
                return true;
            },
        },
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/trade.js"), "utf8"), context);
    context.exports.installTrades();

    const players = [];
    const makePlayer = (id, nickname, money = 0, items = []) => {
        const player = { id, steamId: `7656119800000000${id}`, nickname, ready: true, alive: true, virtualWorld: 0, position: { x: id, y: 0, z: 0 }, rows: [], chat: [], notices: [], emit(event, payload) { if (event === "kcdc-gamemode:notify") this.notices.push(JSON.parse(payload).text); } };
        if (money > 0) addTo(player.rows, MONEY_GUID, money, {});
        for (const [item, amount] of items) addTo(player.rows, item, amount, {});
        players.push(player);
        return player;
    };
    const sessionOf = (player) => [...sessions].find(([, value]) => value.playerId === player.id)?.[0] ?? 0;
    const pageOf = (player) => sessions.get(sessionOf(player))?.page;
    const texts = (player) => Array.from(pageOf(player)?.options ?? [], (option) => option.text);
    const choose = (player, option) => emit("dialogueChoice", sessionOf(player), player, option);
    const moneyOf = (player) => player.rows.filter((row) => row.item === MONEY_GUID).reduce((sum, row) => sum + row.amount, 0);
    const countOf = (player, item) => player.rows.filter((row) => row.item === item).reduce((sum, row) => sum + row.amount, 0);
    /** The owner drags `amount` of `item` from their inventory into their offer, on the transfer screen. */
    const put = (player, stash, item, amount) => {
        const row = player.rows.find((candidate) => candidate.item === item);
        assert.ok(takeFrom(player.rows, [{ id: row.id, amount }]));
        addTo(stash.rows, item, amount, row.metadata);
        emit("stashInventoryChanged", stash, player, {});
    };
    const escrow = () => JSON.parse(disk.files.get("playerdata/escrow.json") ?? "{}");
    /** Runs every timer that is due, those they start included (the list coming back, then drawn again). */
    const flush = () => {
        while (timeouts.length > 0) timeouts.shift().fn();
    };
    /** The player closes the transfer screen and waits for the list to come back. */
    const closeScreen = (stash, player) => {
        emit("stashClose", stash, player, "closed");
        flush();
    };
    /** The player presses Esc on their list. */
    const esc = (player) => {
        const session = sessionOf(player);
        sessions.delete(session);
        emit("dialogueClosed", session, player, 1);
    };
    return { api: context.exports, trades: context.exports.trades, emit, handlers, sessions, stashes, intervals, timeouts, clock, makePlayer, sessionOf, pageOf, texts, choose, moneyOf, countOf, put, escrow, disk, players, flush, closeScreen, esc };
}

function opened(sut) {
    const hans = sut.makePlayer(1, "Hans", 500, [["bread", 3], ["daggerCommon", 1]]);
    const kat = sut.makePlayer(2, "Katerina", 200, [["apple", 5]]);
    assert.equal(sut.trades.start(hans, kat), true);
    const [hansStash, katStash] = sut.stashes;
    return { hans, kat, hansStash, katStash };
}

test("a trade opens the dialogue list on both sides, with both offers and the choices", () => {
    const sut = load();
    const { hans, kat } = opened(sut);
    assert.deepEqual(sut.texts(hans), [
        "Você oferece: nada",
        "Katerina oferece: nada",
        "Mudar os meus itens",
        "Mudar o dinheiro (0 moedas)",
        "Ver o que Katerina oferece",
        "Aceitar a troca",
        "Cancelar a troca",
    ]);
    assert.equal(sut.pageOf(kat).options[1].text, "Hans oferece: nada");
    assert.equal(sut.pageOf(hans).options[0].enabled, false, "the two summaries are read, not picked");
    assert.equal(sut.trades.isTrading(hans), true);
    assert.equal(sut.trades.start(hans, kat), false, "one trade at a time");
    assert.equal(sut.stashes.length, 2);
});

test("an offer is filled on the game's own transfer screen, and the list comes back when it is closed", () => {
    const sut = load();
    const { hans, kat, hansStash } = opened(sut);
    sut.choose(hans, "items");
    assert.deepEqual(hansStash.opened, [hans.id], "the container opens on Hans's screen");
    assert.equal(sut.sessionOf(hans), 0, "the list makes way for it");
    assert.equal(sut.trades.isTrading(hans), true, "and closing it for that is not a cancellation");

    sut.put(hans, hansStash, "bread", 2);
    assert.equal(sut.countOf(hans, "bread"), 1);
    assert.deepEqual(sut.escrow().held[hans.steamId].map((row) => [row.item, row.amount]), [["bread", 2]], "what is in an offer is written down");
    assert.equal(sut.texts(kat)[1], "Hans oferece: 2 itens", "the other side sees it at once");

    sut.closeScreen(hansStash, hans);
    assert.equal(sut.texts(hans)[0], "Você oferece: 2 itens");
});

test("only the owner may open an offer", () => {
    const sut = load();
    const { hans, kat, hansStash } = opened(sut);
    assert.equal(sut.emit("stashInteract", kat, hansStash, "open"), false);
    assert.equal(sut.emit("stashInteract", hans, hansStash, "open"), undefined);
});

test("money is chosen in the list, in coins as the game shows them, never more than the player has", () => {
    const sut = load();
    const { hans, kat } = opened(sut);
    sut.choose(kat, "money");
    assert.equal(sut.texts(kat)[0], "Dinheiro na sua oferta: 0 moedas (você tem 20 moedas)");
    sut.choose(kat, "money:+100");
    sut.choose(kat, "money:+100");
    assert.equal(sut.texts(kat)[0], "Dinheiro na sua oferta: 20 moedas (você tem 20 moedas)");
    sut.choose(kat, "money:+10");
    assert.equal(sut.texts(kat)[0], "Dinheiro na sua oferta: 20 moedas (você tem 20 moedas)", "not past what she has");
    assert.equal(sut.pageOf(kat).options[1].enabled, false, "and the row is drawn greyed");
    sut.choose(kat, "money:-100");
    sut.choose(kat, "back");
    assert.equal(sut.texts(kat)[0], "Você oferece: 10 moedas");
    assert.equal(sut.texts(hans)[1], "Katerina oferece: 10 moedas");
    assert.equal(sut.moneyOf(kat), 200, "nothing leaves before the deal is done");
});

test("the other side's offer is listed by name, with the money first", () => {
    const sut = load();
    const { hans, kat, hansStash } = opened(sut);
    sut.choose(hans, "items");
    sut.put(hans, hansStash, "bread", 3);
    sut.put(hans, hansStash, "daggerCommon", 1);
    sut.closeScreen(hansStash, hans);
    sut.choose(hans, "money");
    sut.choose(hans, "money:+500");
    sut.choose(kat, "theirs");
    assert.deepEqual(sut.texts(kat), ["Dinheiro: 50 moedas", "3x bread", "daggerCommon", "Voltar"]);
    assert.ok(sut.pageOf(kat).options.slice(0, 3).every((option) => option.enabled === false));
    sut.choose(kat, "back");
    assert.equal(sut.texts(kat)[1], "Hans oferece: 4 itens e 50 moedas");
});

test("when both accept, the items and the money cross over, and the offers are gone", () => {
    const sut = load();
    const { hans, kat, hansStash, katStash } = opened(sut);
    sut.choose(hans, "items");
    sut.put(hans, hansStash, "daggerCommon", 1);
    sut.closeScreen(hansStash, hans);
    sut.choose(kat, "items");
    sut.put(kat, katStash, "apple", 2);
    sut.closeScreen(katStash, kat);
    sut.choose(kat, "money");
    sut.choose(kat, "money:+100");
    sut.choose(kat, "back");

    sut.choose(hans, "accept");
    assert.equal(sut.texts(hans)[5], "Você aceitou; esperando Katerina");
    assert.equal(sut.texts(kat)[1], "Hans oferece: 1 item (aceitou)");
    assert.ok(kat.notices.includes("Hans aceitou a troca."));
    sut.choose(kat, "accept");

    assert.equal(sut.countOf(kat, "daggerCommon"), 1);
    assert.equal(sut.countOf(hans, "daggerCommon"), 0);
    assert.equal(sut.countOf(hans, "apple"), 2);
    assert.equal(sut.countOf(kat, "apple"), 3);
    assert.equal(sut.moneyOf(hans), 600);
    assert.equal(sut.moneyOf(kat), 100);
    assert.ok(hansStash.destroyed && katStash.destroyed);
    assert.equal(sut.sessions.size, 0, "both lists are closed");
    assert.equal(sut.trades.isTrading(hans), false);
    assert.deepEqual(sut.escrow(), { owed: {}, held: {} });
    assert.ok(hans.notices.includes("Troca feita.") && kat.notices.includes("Troca feita."));
});

test("any change to either offer takes both acceptances back", () => {
    const sut = load();
    const { hans, kat, katStash } = opened(sut);
    sut.choose(hans, "accept");
    sut.choose(kat, "items");
    sut.put(kat, katStash, "apple", 1);
    assert.equal(sut.texts(hans)[5], "Aceitar a troca", "Hans has to look again");
    assert.ok(hans.notices.includes("A oferta mudou: os dois precisam aceitar de novo."));
    sut.closeScreen(katStash, kat);
    sut.choose(kat, "accept");
    assert.equal(sut.trades.isTrading(hans), true, "one acceptance is not a deal");
});

test("cancelling gives every item back, and the other side is told", () => {
    const sut = load();
    const { hans, kat, hansStash, katStash } = opened(sut);
    sut.choose(hans, "items");
    sut.put(hans, hansStash, "bread", 3);
    sut.closeScreen(hansStash, hans);
    sut.choose(kat, "items");
    sut.put(kat, katStash, "apple", 5);
    sut.closeScreen(katStash, kat);

    sut.choose(kat, "cancel");
    assert.equal(sut.countOf(hans, "bread"), 3);
    assert.equal(sut.countOf(kat, "apple"), 5);
    assert.ok(hans.notices.includes("Katerina cancelou a troca."));
    assert.ok(kat.notices.includes("Você cancelou a troca. Seus itens voltaram."));
    assert.equal(sut.sessions.size, 0);
    assert.deepEqual(sut.escrow(), { owed: {}, held: {} });
});

test("Esc on the list is leaving the trade", () => {
    const sut = load();
    const { hans, kat, hansStash } = opened(sut);
    sut.choose(hans, "items");
    sut.put(hans, hansStash, "bread", 1);
    sut.closeScreen(hansStash, hans);
    sut.clock.now += 5_000;
    sut.esc(hans);
    assert.equal(sut.trades.isTrading(kat), false);
    assert.equal(sut.countOf(hans, "bread"), 3);
    assert.ok(kat.notices.includes("Hans saiu da negociação."));
});

test("what the other side cannot carry goes back to whoever offered it", () => {
    const sut = load();
    const { hans, kat, hansStash } = opened(sut);
    sut.choose(hans, "items");
    sut.put(hans, hansStash, "bread", 2);
    sut.closeScreen(hansStash, hans);
    kat.full = true;
    sut.choose(hans, "accept");
    sut.choose(kat, "accept");
    assert.equal(sut.countOf(kat, "bread"), 0);
    assert.equal(sut.countOf(hans, "bread"), 3, "the bread came back");
    assert.ok(hans.notices.some((line) => /O que não coube/.test(line)));
});

test("an offer its owner cannot take back is owed, kept on disk, and given at their next entry", () => {
    const sut = load();
    const { hans, kat, hansStash } = opened(sut);
    sut.choose(hans, "items");
    sut.put(hans, hansStash, "bread", 2);
    sut.closeScreen(hansStash, hans);
    hans.gone = true;
    sut.emit("playerDisconnect", hans);
    assert.equal(sut.trades.isTrading(kat), false);
    assert.ok(kat.notices.includes("A troca foi desfeita: a outra pessoa saiu."));
    assert.deepEqual(sut.escrow().owed[hans.steamId].map((row) => [row.item, row.amount]), [["bread", 2]]);

    hans.gone = false;
    sut.emit("playerInventoryReady", hans);
    assert.equal(sut.countOf(hans, "bread"), 3);
    assert.deepEqual(sut.escrow().owed, {});
});

test("a restart in the middle of a trade gives the offers back to their owners", () => {
    const first = load();
    const { hans, hansStash } = opened(first);
    first.choose(hans, "items");
    first.put(hans, hansStash, "daggerCommon", 1);
    const file = first.disk.files.get("playerdata/escrow.json");

    const sut = load({ seed: { "playerdata/escrow.json": file } });
    assert.deepEqual(sut.escrow().held, {});
    assert.deepEqual(sut.escrow().owed[hans.steamId].map((row) => [row.item, row.amount]), [["daggerCommon", 1]]);
    const back = sut.makePlayer(1, "Hans", 0, []);
    sut.emit("playerInventoryReady", back);
    assert.equal(sut.countOf(back, "daggerCommon"), 1);
    assert.ok(back.notices.some((line) => /voltou para o seu inventário/.test(line)));
});

test("money that is no longer there when both accept stops the deal and takes the acceptances back", () => {
    const sut = load();
    const { hans, kat } = opened(sut);
    sut.choose(hans, "money");
    sut.choose(hans, "money:+500");
    sut.choose(hans, "back");
    sut.choose(hans, "accept");
    hans.rows.find((row) => row.item === MONEY_GUID).amount = 100; // spent elsewhere meanwhile
    sut.choose(kat, "accept");
    assert.equal(sut.trades.isTrading(hans), true);
    assert.equal(sut.moneyOf(kat), 200);
    assert.equal(sut.texts(hans)[0], "Você oferece: 10 moedas", "the offer comes down to what he has");
    assert.equal(sut.texts(hans)[5], "Aceitar a troca");
});

test("walking apart or leaving the trade alone calls it off", () => {
    const sut = load();
    const { hans, kat, hansStash } = opened(sut);
    sut.choose(hans, "items");
    sut.put(hans, hansStash, "bread", 1);
    kat.position = { x: 50, y: 0, z: 0 };
    sut.intervals[0].fn();
    assert.equal(sut.trades.isTrading(hans), false);
    assert.equal(sut.countOf(hans, "bread"), 3);
    assert.ok(hans.notices.includes("A troca foi desfeita: vocês se afastaram."));

    const again = load();
    const pair = opened(again);
    again.clock.now += again.api.TRADE_IDLE_MS + 1;
    again.intervals[0].fn();
    assert.equal(again.trades.isTrading(pair.hans), false);
});

test("the module's own moves out of an offer are not taken for the player changing it", () => {
    const sut = load({ scriptEvents: true });
    const { hans, kat, hansStash } = opened(sut);
    sut.choose(hans, "items");
    sut.put(hans, hansStash, "bread", 1);
    sut.closeScreen(hansStash, hans);
    sut.choose(hans, "accept");
    sut.choose(kat, "accept");
    assert.equal(sut.countOf(kat, "bread"), 1);
    assert.ok(!hans.notices.includes("A oferta mudou: os dois precisam aceitar de novo."));
    assert.equal(sut.sessions.size, 0, "no list reopens after the deal");
});

test("after the transfer screen closes, the list comes back a moment later, and is drawn once more after that", () => {
    const sut = load();
    const { hans, hansStash } = opened(sut);
    sut.choose(hans, "items");
    sut.put(hans, hansStash, "bread", 2);
    sut.emit("stashClose", hansStash, hans, "closed");

    assert.equal(sut.sessionOf(hans), 0, "not while the game is still closing the screen");
    assert.equal(sut.timeouts[0].ms, 700);

    sut.timeouts.shift().fn();
    const session = sut.sessionOf(hans);
    assert.notEqual(session, 0);
    assert.equal(sut.texts(hans)[0], "Você oferece: 2 itens");
    assert.equal(sut.timeouts[0].ms, 400, "and drawn again a moment later");
    sut.sessions.get(session).page = { options: [] };
    sut.timeouts.shift().fn();
    assert.equal(sut.texts(hans)[0], "Você oferece: 2 itens", "a lost drawing is put back");
});

test("the other side changing their offer meanwhile does not bring the list back before its time", () => {
    const sut = load();
    const { hans, kat, hansStash, katStash } = opened(sut);
    sut.choose(hans, "items");
    sut.emit("stashClose", hansStash, hans, "closed");

    sut.choose(kat, "items");
    sut.put(kat, katStash, "apple", 2);
    assert.equal(sut.sessionOf(hans), 0, "still waiting");

    sut.flush();
    assert.equal(sut.texts(hans)[1], "Katerina oferece: 2 itens", "and it comes back with what is on the table now");
});

test("an Esc just after the list came back shows it again, once, saying how to leave; the next Esc leaves", () => {
    const sut = load();
    const { hans, kat, hansStash } = opened(sut);
    sut.choose(hans, "items");
    sut.closeScreen(hansStash, hans);

    sut.esc(hans);
    assert.equal(sut.trades.isTrading(kat), true, "the trade goes on");
    assert.ok(hans.notices.some((line) => /aperte Esc de novo/.test(line)));
    sut.flush();
    assert.notEqual(sut.sessionOf(hans), 0, "the list is back");

    sut.esc(hans);
    assert.equal(sut.trades.isTrading(kat), false, "a second Esc is leaving");
    assert.ok(kat.notices.includes("Hans saiu da negociação."));
});
