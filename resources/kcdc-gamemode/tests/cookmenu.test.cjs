const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// The cooking menu (src/server/cook-menu.ts): "Cozinhar" or "Sair" at a fire, then what the player carries that the place can make.

const itemUses = (() => {
    const context = { exports: {} };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/item-uses.js"), "utf8"), context);
    return context.exports;
})();

function load() {
    const state = { rows: [], revision: 1, chat: [], handlers: new Map(), client: new Map(), opened: [], updated: [], closed: [], emitted: [], session: 0, busy: new Set() };
    const guild = { mayCraft: (player, kind) => player.crafts === undefined || player.crafts.includes(kind), refusal: (kind) => `não é para você: ${kind}` };
    const shared = {
        console: { log() {} },
        Math,
        JSON,
        Chat: { sendToPlayer: (player, text) => state.chat.push(text) },
        Inventory: {
            get: () => ({ revision: state.revision, items: state.rows }),
            remove: (player, request) => {
                for (const unit of request.units) state.rows = state.rows.filter((row) => row.id !== unit.id);
                return { ok: true };
            },
            add: (player, request) => {
                state.rows.push({ id: `new-${request.item}`, item: request.item, amount: request.amount });
                return { ok: true };
            },
        },
        CookPot: { all: () => [] },
    };
    const cookingContext = {
        exports: {},
        require: (id) => ({
            "./cooking-data.js": { COOKED: { "raw-deer": "cooked-deer", "raw-egg": "cooked-egg" }, DRIED: {}, SMOKED: {}, MEATS: ["raw-deer"] },
            "./stations-data.js": { STATIONS: [["fogo", 10, 10, 100], ["defumador", 300, 300, 50]] },
            "./item-uses.js": itemUses,
            "./item-names.js": { itemLine: (row) => `${row.amount}x ${row.item}` },
            "./guild-crafts.js": guild,
            "./vendors.js": { CAMPS: [] },
        })[id] ?? assert.fail(`unexpected require ${id}`),
        Events: { on() {}, onClient() {} },
        ...shared,
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/cooking.js"), "utf8"), cookingContext);
    const intervals = [];
    const menuContext = {
        exports: {},
        require: (id) => ({ "./cooking.js": cookingContext.exports, "./guild-crafts.js": guild })[id] ?? assert.fail(`unexpected require ${id}`),
        Events: { on: (name, fn) => state.handlers.set(name, fn), onClient: (name, fn) => state.client.set(name, fn) },
        setInterval: (fn, ms) => { intervals.push({ fn, ms }); return intervals.length; },
        clearInterval() {},
        Player: { all: () => state.players ?? [] },
        Dialogue: {
            sessionOf: (id) => (state.busy.has(id) ? 99 : 0),
            open: (id, page) => { state.session += 1; state.opened.push(page); return state.session; },
            update: (session, page) => { state.updated.push(page); return true; },
            close: (session) => state.closed.push(session),
        },
        ...shared,
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/cook-menu.js"), "utf8"), menuContext);
    menuContext.exports.installCookMenu();
    const player = (x, y, z, extra = {}) => ({ id: 1, steamId: "7656", nickname: "Hans", ready: true, alive: true, position: { x, y, z }, emit: (event, payload) => state.emitted.push({ event, payload }), ...extra });
    return { api: menuContext.exports, state, player, intervals };
}

const plain = (value) => JSON.parse(JSON.stringify(value));
const ids = (page) => plain(page.options.map((option) => option.id));

test("at a fire the menu offers Cozinhar and Sair; Cozinhar lists the raw food, and a choice cooks that stack", () => {
    const sut = load();
    sut.state.rows = [{ id: "r1", item: "raw-deer", amount: 3 }, { id: "r2", item: "bread", amount: 2 }, { id: "r3", item: "raw-egg", amount: 1 }];
    const hans = sut.player(11, 10, 100);

    assert.equal(sut.api.openCookMenu(hans), true);
    const first = sut.state.opened[0];
    assert.match(first.line, /O fogo: o que vai ser\?/);
    assert.deepEqual(plain(first.options.map((o) => [o.id, o.text, o.enabled])), [["cook", "Cozinhar", true], ["leave", "Sair", true]]);

    sut.api.chooseCook(1, hans, "cook");
    const list = sut.state.updated[0];
    assert.deepEqual(plain(list.options.map((o) => o.text)), ["3x raw-deer", "1x raw-egg", "Tudo o que der", "Sair"], "bread is nobody's to cook");

    sut.api.chooseCook(1, hans, "food:0");
    assert.match(sut.state.chat.at(-1), /Você cozinhou no local: 3x cooked-deer\./);
    assert.ok(sut.state.rows.some((row) => row.item === "raw-egg"), "the egg was not asked for");
    assert.deepEqual(ids(sut.state.updated.at(-1)), ["cook", "leave"], "back to the first page");

    sut.api.chooseCook(1, hans, "cook");
    sut.api.chooseCook(1, hans, "all");
    assert.match(sut.state.chat.at(-1), /cooked-egg/);
    assert.equal(sut.state.updated.at(-1).options[0].enabled, false, "nothing left to cook: the choice is greyed out");
});

test("Sair closes the menu, and so does walking away from the fire", () => {
    const sut = load();
    sut.state.rows = [{ id: "r1", item: "raw-deer", amount: 1 }];
    const hans = sut.player(10, 11, 100);
    sut.api.openCookMenu(hans);
    sut.api.chooseCook(1, hans, "leave");
    assert.deepEqual(plain(sut.state.closed), [1]);

    sut.api.openCookMenu(hans);
    hans.position = { x: 80, y: 80, z: 100 };
    sut.api.chooseCook(2, hans, "cook");
    assert.deepEqual(plain(sut.state.closed), [1, 2]);
    assert.match(sut.state.chat.at(-1), /afastou/);
    assert.equal(sut.state.rows.length, 1, "nothing was cooked from afar");
});

test("away from every place there is no menu; a player of another guild is told whose place it is and gets none", () => {
    const sut = load();
    assert.equal(sut.api.openCookMenu(sut.player(500, 500, 100)), false);
    assert.equal(sut.state.opened.length, 0);

    const hunter = sut.player(10, 10, 100, { crafts: ["secador"] });
    assert.equal(sut.api.openCookMenu(hunter), false);
    assert.deepEqual(plain(sut.state.chat), ["não é para você: fogo"]);
    assert.equal(sut.state.opened.length, 0);

    const busy = sut.player(10, 10, 100, { id: 5 });
    sut.state.busy.add(5);
    assert.equal(sut.api.openCookMenu(busy), false, "someone already in a conversation is not given a second list");
});

test("the client is asked for the menu through cook.menu, and is told of the places about it only when they change", () => {
    const sut = load();
    sut.state.client.get("kcdc-gamemode:cook.menu")(sut.player(11, 10, 100));
    assert.equal(sut.state.opened.length, 1);

    const hans = sut.player(20, 20, 100);
    sut.state.players = [hans];
    sut.intervals[0].fn();
    sut.intervals[0].fn();
    assert.equal(sut.state.emitted.length, 1, "told once, the second time nothing changed");
    assert.equal(sut.state.emitted[0].event, "kcdc-gamemode:cook.stations");
    assert.deepEqual(JSON.parse(sut.state.emitted[0].payload), [[0, 10, 10, 100]], "the fire is near; the smoker 400 m off is not");
    hans.position = { x: 300, y: 300, z: 50 };
    sut.intervals[0].fn();
    assert.deepEqual(JSON.parse(sut.state.emitted[1].payload), [[2, 300, 300, 50]]);
});
