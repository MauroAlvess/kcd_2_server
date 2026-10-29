const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const inventoryAdd = require("./inventory-add-module.cjs");

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
 * Two players with inventories (`rows`), virtual stashes that keep rows, and the trades' page each side is sent (`views`, and the
 * words to put it away, `said`). `scriptEvents` makes the stashes raise their change event for the module's own moves too, as the
 * server may.
 */
function load({ seed = {}, scriptEvents = true } = {}) {
    const settlers = [];
    const disk = fakeDisk(seed);
    const storeSandbox = { exports: {}, require: () => disk.fs };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/store.js"), "utf8"), storeSandbox);

    const handlers = new Map();
    const clientHandlers = new Map();
    const emit = (name, ...args) => {
        let answer;
        for (const fn of handlers.get(name) ?? []) {
            const result = fn(...args);
            if (result !== undefined) answer = result;
        }
        return answer;
    };
    let nextStash = 100;
    let nextRow = 1;
    const stashes = [];
    const intervals = [];
    const timeouts = [];
    const clock = { now: 1_000_000 };
    /** The amount of every call the module made to `Inventory.add`. */
    const calls = [];

    const rowsOf = (owner) => owner.rows;
    const addTo = (rows, item, amount, metadata) => {
        const same = rows.find((row) => row.item === item && JSON.stringify(row.metadata) === JSON.stringify(metadata ?? {}));
        if (same) same.amount += amount;
        else rows.push({ id: `r${nextRow++}`, item, name: item === MONEY_GUID || item === "money" ? "money" : item, amount, metadata: { ...(metadata ?? {}) }, equipped: 0 });
        return same ?? rows.at(-1);
    };
    /** What the real game does: `Inventory.add` and `Stash.addItem` take 1 to 10,000 units of a class per call, and refuse more (`invalidAmount`). */
    const ADD_LIMIT = 10_000;
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
            if (id === "./inventory-add.js") return inventoryAdd(context);
            if (id === "./acquaintances.js") return { labelFor: (_viewer, target) => target.nickname };
            if (id === "./item-names.js") return { itemName: (row) => row.item };
            if (id === "./item-icons.js") return { iconOf: (item) => `icon_${item}` };
            if (id === "./restart-notice.js") return { restartPending: () => false, onRestartSettle: (fn) => settlers.push(fn) };
            if (id === "./craft-titles.js") return { craftTitle: (key) => (key === "negociacao" ? "data:image/webp;base64,TITLE" : "") };
            if (id === "./big-emit.js") return { emitLarge: (player, name, json) => { player.views.push(JSON.parse(json)); return 1; } };
            assert.fail(`unexpected require ${id}`);
        },
        console: { log() {}, error() {} },
        Date: { now: () => clock.now },
        setInterval: (fn, ms) => { intervals.push({ fn, ms }); return intervals.length; },
        setTimeout: (fn, ms) => { timeouts.push({ fn, ms }); return timeouts.length; },
        clearInterval() {},
        Chat: { sendToPlayer: (player, text) => player.chat.push(text) },
        Events: { on: (name, fn) => handlers.set(name, [...(handlers.get(name) ?? []), fn]), onClient: (name, fn) => clientHandlers.set(name, fn) },
        Inventory: {
            get: (player) => (player.gone ? null : { revision: 1, items: rowsOf(player) }),
            add: (player, request) => {
                if (player.gone || player.full) return { ok: false, code: "inventoryCapacity" };
                if (!(request.amount >= 1 && request.amount <= ADD_LIMIT)) return { ok: false, code: "invalidAmount" };
                const item = request.item === "money" ? MONEY_GUID : request.item;
                const row = addTo(player.rows, item, request.amount, request.metadata);
                calls.push(request.amount);
                return { ok: true, code: "", revision: 1, items: [{ id: row.id, amount: request.amount }] };
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
                        if (!(request.amount >= 1 && request.amount <= ADD_LIMIT)) return { ok: false, code: "invalidAmount" };
                        const row = addTo(this.rows, request.item, request.amount, request.metadata);
                        if (scriptEvents) emit("stashInventoryChanged", this, null, {});
                        return { ok: true, code: "", revision: 1, items: [{ id: row.id, amount: request.amount }] };
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
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/trade.js"), "utf8"), context);
    context.exports.installTrades();

    const players = [];
    const makePlayer = (id, nickname, money = 0, items = []) => {
        const player = {
            id, steamId: `7656119800000000${id}`, nickname, ready: true, alive: true, virtualWorld: 0, position: { x: id, y: 0, z: 0 }, rows: [], chat: [], notices: [], views: [], said: [],
            emit(event, payload) {
                if (event === "kcdc-gamemode:notify") this.notices.push(JSON.parse(payload).text);
                else this.said.push(event.replace("kcdc-gamemode:", ""));
            },
        };
        if (money > 0) addTo(player.rows, MONEY_GUID, money, {});
        for (const [item, amount] of items) addTo(player.rows, item, amount, {});
        players.push(player);
        return player;
    };
    /** The last page this side was sent. */
    const viewOf = (player) => player.views.at(-1);
    /** A button on the page: `items`, `money` (coins), `accept` or `cancel`. */
    const act = (player, action, value) => clientHandlers.get(`kcdc-gamemode:trade.${action}`)(player, JSON.stringify(value === undefined ? {} : { value }));
    const moneyOf = (player) => player.rows.filter((row) => row.item === MONEY_GUID).reduce((sum, row) => sum + row.amount, 0);
    const countOf = (player, item) => player.rows.filter((row) => row.item === item).reduce((sum, row) => sum + row.amount, 0);
    /** The owner drags `amount` of `item` from their inventory into their offer, on the transfer screen. */
    /** Lets the pause that gathers a burst of changes to an offer pass: the pages are drawn then, once. */
    const settleOffer = () => {
        for (const timer of timeouts.filter((one) => one.ms === context.exports.TRADE_REFRESH_MS)) {
            timeouts.splice(timeouts.indexOf(timer), 1);
            timer.fn();
        }
    };
    const put = (player, stash, item, amount) => {
        const row = player.rows.find((candidate) => candidate.item === item);
        assert.ok(takeFrom(player.rows, [{ id: row.id, amount }]));
        addTo(stash.rows, item, amount, row.metadata);
        emit("stashInventoryChanged", stash, player, {});
        settleOffer();
    };
    /** The same move without the pause passing: a burst. */
    const putQuick = (player, stash, item, amount) => {
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
    /** The player asks for their items: the page goes away and the transfer screen opens a moment later. */
    const openItems = (player) => {
        act(player, "items");
        flush();
    };
    /** The player closes the transfer screen and waits for the page to come back. */
    const closeScreen = (stash, player) => {
        emit("stashClose", stash, player, "closed");
        flush();
    };
    return { calls, api: context.exports, trades: context.exports.trades, emit, handlers, clientHandlers, stashes, intervals, timeouts, clock, makePlayer, viewOf, act, moneyOf, countOf, put, putQuick, settleOffer, escrow, disk, players, flush, openItems, closeScreen };
}

function opened(sut) {
    const hans = sut.makePlayer(1, "Hans", 500, [["bread", 3], ["daggerCommon", 1]]);
    const kat = sut.makePlayer(2, "Katerina", 200, [["apple", 5]]);
    assert.equal(sut.trades.start(hans, kat), true);
    const [hansStash, katStash] = sut.stashes;
    return { hans, kat, hansStash, katStash };
}

test("a trade puts the trades' page up on both sides, with both offers and the other's name", () => {
    const sut = load();
    const { hans, kat } = opened(sut);
    const page = sut.viewOf(hans);
    assert.equal(page.mode, "trade");
    assert.equal(page.partner, "Katerina");
    assert.deepEqual(page.mine, { items: [], accepted: false });
    assert.deepEqual(page.theirs, { items: [], accepted: false });
    assert.equal(page.has, undefined, "no money field on the page (2026-10-21)");
    assert.equal(sut.viewOf(kat).partner, "Hans");
    assert.equal(page.img, "data:image/webp;base64,TITLE", "the title image with the first page");
    sut.act(hans, "accept");
    assert.equal(sut.viewOf(hans).img, undefined, "and not again: the page keeps it");
    assert.equal(sut.trades.isTrading(hans), true);
    assert.equal(sut.trades.start(hans, kat), false, "one trade at a time");
    assert.equal(sut.stashes.length, 2);
});

test("an offer is filled on the game's own transfer screen, the page put away meanwhile, and it comes back with the icons", () => {
    const sut = load();
    const { hans, kat, hansStash } = opened(sut);
    sut.act(hans, "items");
    assert.deepEqual(hans.said, ["trade.hide"], "the page makes way");
    assert.deepEqual(hansStash.opened, [], "the screen opens a moment after");
    assert.equal(sut.timeouts[0].ms, 250);
    sut.flush();
    assert.deepEqual(hansStash.opened, [hans.id], "the container opens on Hans's screen");
    assert.equal(sut.trades.isTrading(hans), true, "and putting the page away is not a cancellation");

    const before = hans.views.length;
    sut.put(hans, hansStash, "bread", 2);
    assert.equal(sut.countOf(hans, "bread"), 1);
    assert.deepEqual(sut.escrow().held[hans.steamId].map((row) => [row.item, row.amount]), [["bread", 2]], "what is in an offer is written down");
    assert.deepEqual(sut.viewOf(kat).theirs.items, [{ name: "bread", n: 2, icon: "icon_bread" }], "the other side sees it at once");
    assert.equal(hans.views.length, before, "not on Hans's page while his screen is up");

    sut.closeScreen(hansStash, hans);
    assert.deepEqual(sut.viewOf(hans).mine.items, [{ name: "bread", n: 2, icon: "icon_bread" }]);
});

test("only the owner may open an offer", () => {
    const sut = load();
    const { hans, kat, hansStash } = opened(sut);
    assert.equal(sut.emit("stashInteract", kat, hansStash, "open"), false);
    assert.equal(sut.emit("stashInteract", hans, hansStash, "open"), undefined);
});

test("the page has no money action: a button that is not the page's is ignored, and money is put on the table on the transfer screen like any item (2026-10-21)", () => {
    const sut = load();
    const { hans, kat, katStash } = opened(sut);
    assert.equal(sut.clientHandlers.has("kcdc-gamemode:trade.money"), false, "no handler for it");
    sut.openItems(kat);
    sut.put(kat, katStash, MONEY_GUID, 100);
    sut.closeScreen(katStash, kat);
    assert.deepEqual(JSON.parse(JSON.stringify(sut.viewOf(hans).theirs.items)).map((item) => [item.n]), [[100]], "the other side sees the coins as an item of the offer");
    assert.equal(sut.moneyOf(kat), 100, "what is on the table is out of her purse");
    sut.act(hans, "accept");
    sut.act(kat, "accept");
    assert.equal(sut.moneyOf(hans), 600, "and it crosses over like the rest");
    assert.equal(sut.moneyOf(kat), 100);
});

test("when both accept, the items cross over, and the pages close", () => {
    const sut = load();
    const { hans, kat, hansStash, katStash } = opened(sut);
    sut.openItems(hans);
    sut.put(hans, hansStash, "daggerCommon", 1);
    sut.closeScreen(hansStash, hans);
    sut.openItems(kat);
    sut.put(kat, katStash, "apple", 2);
    sut.closeScreen(katStash, kat);

    sut.act(hans, "accept");
    assert.equal(sut.viewOf(hans).mine.accepted, true);
    assert.equal(sut.viewOf(kat).theirs.accepted, true);
    assert.ok(kat.notices.includes("Hans aceitou a troca."));
    sut.act(kat, "accept");

    assert.equal(sut.countOf(kat, "daggerCommon"), 1);
    assert.equal(sut.countOf(hans, "daggerCommon"), 0);
    assert.equal(sut.countOf(hans, "apple"), 2);
    assert.equal(sut.countOf(kat, "apple"), 3);
    assert.ok(hansStash.destroyed && katStash.destroyed);
    assert.ok(hans.said.includes("trade.end") && kat.said.includes("trade.end"), "both pages are closed");
    assert.equal(sut.trades.isTrading(hans), false);
    assert.deepEqual(sut.escrow(), { owed: {}, held: {} });
    assert.ok(hans.notices.includes("Troca feita.") && kat.notices.includes("Troca feita."));
});

test("any change to either offer takes both acceptances back", () => {
    const sut = load();
    const { hans, kat, katStash } = opened(sut);
    sut.act(hans, "accept");
    sut.openItems(kat);
    sut.put(kat, katStash, "apple", 1);
    assert.equal(sut.viewOf(hans).mine.accepted, false, "Hans has to look again");
    assert.ok(hans.notices.includes("A oferta mudou: os dois precisam aceitar de novo."));
    sut.closeScreen(katStash, kat);
    sut.act(kat, "accept");
    assert.equal(sut.trades.isTrading(hans), true, "one acceptance is not a deal");
});

test("cancelling (the page's button, its X or Esc) gives every item back, and the other side is told", () => {
    const sut = load();
    const { hans, kat, hansStash, katStash } = opened(sut);
    sut.openItems(hans);
    sut.put(hans, hansStash, "bread", 3);
    sut.closeScreen(hansStash, hans);
    sut.openItems(kat);
    sut.put(kat, katStash, "apple", 5);
    sut.closeScreen(katStash, kat);

    sut.act(kat, "cancel");
    assert.equal(sut.countOf(hans, "bread"), 3);
    assert.equal(sut.countOf(kat, "apple"), 5);
    assert.ok(hans.notices.includes("Katerina cancelou a troca."));
    assert.ok(kat.notices.includes("Você cancelou a troca. Seus itens voltaram."));
    assert.ok(hans.said.includes("trade.end"));
    assert.deepEqual(sut.escrow(), { owed: {}, held: {} });
    sut.act(kat, "accept");
    assert.equal(sut.trades.isTrading(kat), false, "a button after the end does nothing");
});

test("a pile of coins bigger than one game call takes comes back whole when the trade is cancelled (2026-10-25: Kael de Borova put 2,438 coins on the table and got 28 back)", () => {
    const sut = load();
    const { hans, kat, hansStash } = opened(sut);
    // 24,380 units of the money item are 2,438 coins; the game's `Inventory.add` takes 10,000 at a time.
    const rich = sut.makePlayer(7, "Kael", 24_380, []);
    assert.equal(sut.trades.start(rich, sut.makePlayer(8, "Goran", 0, [])), true);
    const stash = sut.stashes.at(-2);
    sut.openItems(rich);
    sut.put(rich, stash, MONEY_GUID, 24_102);
    sut.closeScreen(stash, rich);
    assert.equal(sut.moneyOf(rich), 278, "28 coins stayed in the purse, the rest is on the table");
    sut.calls.length = 0;

    sut.act(rich, "cancel");
    assert.equal(sut.moneyOf(rich), 24_380, "all of it is back");
    assert.deepEqual(sut.calls, [10_000, 10_000, 4_102], "in calls the game accepts");
    assert.deepEqual(sut.escrow(), { owed: {}, held: {} }, "and nothing is owed");
    assert.equal(rich.notices.some((line) => /não coube/.test(line)), false);
    assert.ok(hans && kat && hansStash);
});

test("the same pile crossing over to the other side in a deal is carried in the same calls", () => {
    const sut = load();
    const first = sut.makePlayer(7, "Kael", 24_380, []);
    const second = sut.makePlayer(8, "Goran", 0, []);
    assert.equal(sut.trades.start(first, second), true);
    const [stash] = sut.stashes.slice(-2);
    sut.openItems(first);
    sut.put(first, stash, MONEY_GUID, 24_102);
    sut.closeScreen(stash, first);
    sut.act(first, "accept");
    sut.act(second, "accept");
    assert.equal(sut.moneyOf(second), 24_102);
    assert.equal(sut.moneyOf(first), 278);
    assert.deepEqual(sut.escrow(), { owed: {}, held: {} });
});

test("what a refused call left owed (24,102 units of money, over the game's 10,000) is paid at the owner's next entry, and only once", () => {
    const debt = { owed: { "76561198000000007": [{ item: MONEY_GUID, amount: 24_102, metadata: { condition: 1, health: 1, quality: 1 } }] }, held: {} };
    const sut = load({ seed: { "playerdata/escrow.json": JSON.stringify(debt) } });
    const kael = sut.makePlayer(7, "Kael", 280, []);
    kael.steamId = "76561198000000007";
    sut.emit("playerInventoryReady", kael);
    assert.equal(sut.moneyOf(kael), 24_382);
    assert.deepEqual(sut.escrow(), { owed: {}, held: {} });
    sut.emit("playerInventoryReady", kael);
    assert.equal(sut.moneyOf(kael), 24_382, "a second entry pays nothing more");
});

test("what the other side cannot carry goes back to whoever offered it", () => {
    const sut = load();
    const { hans, kat, hansStash } = opened(sut);
    sut.openItems(hans);
    sut.put(hans, hansStash, "bread", 2);
    sut.closeScreen(hansStash, hans);
    kat.full = true;
    sut.act(hans, "accept");
    sut.act(kat, "accept");
    assert.equal(sut.countOf(kat, "bread"), 0);
    assert.equal(sut.countOf(hans, "bread"), 3, "the bread came back");
    assert.ok(hans.notices.some((line) => /O que não coube/.test(line)));
});

test("an offer its owner cannot take back is owed, kept on disk, and given at their next entry", () => {
    const sut = load();
    const { hans, kat, hansStash } = opened(sut);
    sut.openItems(hans);
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
    first.openItems(hans);
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

test("walking apart or leaving the trade alone calls it off", () => {
    const sut = load();
    const { hans, kat, hansStash } = opened(sut);
    sut.openItems(hans);
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
    sut.openItems(hans);
    sut.put(hans, hansStash, "bread", 1);
    sut.closeScreen(hansStash, hans);
    sut.act(hans, "accept");
    const pages = hans.views.length;
    sut.act(kat, "accept");
    assert.equal(sut.countOf(kat, "bread"), 1);
    assert.ok(!hans.notices.includes("A oferta mudou: os dois precisam aceitar de novo."));
    assert.equal(hans.views.length, pages, "no page comes back after the deal");
});

test("after the transfer screen closes, the page comes back a moment later, not at once", () => {
    const sut = load();
    const { hans, hansStash } = opened(sut);
    sut.openItems(hans);
    sut.put(hans, hansStash, "bread", 2);
    const pages = hans.views.length;
    sut.emit("stashClose", hansStash, hans, "closed");
    assert.equal(hans.views.length, pages, "not while the game is still closing the screen");
    assert.equal(sut.timeouts[0].ms, 700);
    sut.flush();
    assert.equal(sut.viewOf(hans).mine.items.length, 1);
});

test("the other side changing their offer meanwhile does not bring the page back before its time", () => {
    const sut = load();
    const { hans, kat, hansStash, katStash } = opened(sut);
    sut.openItems(hans);
    sut.emit("stashClose", hansStash, hans, "closed");
    const pages = hans.views.length;

    sut.act(kat, "items");
    sut.put(kat, katStash, "apple", 2);
    assert.equal(hans.views.length, pages, "still waiting");

    sut.flush();
    assert.deepEqual(sut.viewOf(hans).theirs.items, [{ name: "apple", n: 2, icon: "icon_apple" }], "and it comes back with what is on the table now");
});

test("a burst of changes to an offer is drawn once, a moment after the last, and the escrow is written once; the acceptances go at once (2026-10-26)", () => {
    const sut = load();
    const { hans, kat, hansStash } = opened(sut);
    sut.openItems(hans);
    sut.act(kat, "accept");
    const written = JSON.stringify(sut.escrow());
    const katDrawn = kat.views.length;
    sut.putQuick(hans, hansStash, "bread", 1);
    sut.putQuick(hans, hansStash, "bread", 1);
    sut.putQuick(hans, hansStash, "daggerCommon", 1);
    assert.equal(kat.views.length, katDrawn, "nothing is drawn while the burst goes on");
    assert.equal(JSON.stringify(sut.escrow()), written, "and nothing is written");
    assert.ok(kat.notices.concat(kat.chat).some((line) => /A oferta mudou/.test(line)), "but the other is told the acceptance is gone, at once");
    assert.equal(sut.timeouts.filter((timer) => timer.ms === sut.api.TRADE_REFRESH_MS).length, 1, "one drawing waits for its time, not three");
    sut.settleOffer();
    assert.equal(kat.views.length, katDrawn + 1, "drawn once");
    assert.deepEqual(sut.viewOf(kat).theirs.items.map((row) => [row.name, row.n]), [["bread", 2], ["daggerCommon", 1]]);
    assert.equal(sut.viewOf(kat).mine.accepted, false, "her acceptance went with the change");
    assert.deepEqual(sut.escrow().held[hans.steamId].map((row) => [row.item, row.amount]), [["bread", 2], ["daggerCommon", 1]], "the escrow has the offer as it stands");
});

test("an accept pressed while the page is behind the offer is not taken: nobody accepts what is no longer on the table (2026-10-26)", () => {
    const sut = load();
    const { hans, kat, hansStash } = opened(sut);
    sut.openItems(hans);
    sut.putQuick(hans, hansStash, "bread", 1);
    sut.act(kat, "accept");
    assert.ok(kat.notices.concat(kat.chat).some((line) => /A oferta acabou de mudar: confira a tela e aceite de novo/.test(line)), "told to look again");
    assert.equal(sut.viewOf(kat).mine.accepted, false);
    sut.settleOffer();
    sut.act(kat, "accept");
    assert.equal(sut.viewOf(kat).mine.accepted, true, "and once the page is drawn the accept counts");
});
