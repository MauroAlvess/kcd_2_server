const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const plain = (value) => JSON.parse(JSON.stringify(value));

/** A container as the framework has it: rows with an identity, a class, an amount and what is known of each unit. */
function makeStash(id, { levelGuid = "", rows = [], holderId = 0, refuseIds = false, opens = true } = {}) {
    const stash = {
        id,
        levelGuid,
        holderId,
        destroyed: false,
        opened: [],
        writes: 0,
        rows: rows.map((row) => ({ ...row })),
        getInventory() {
            return this.destroyed ? null : { revision: 1, items: this.rows.map((row) => ({ ...row, name: row.item, quality: 1, health: 1, condition: 1, equipped: 0 })) };
        },
        setInventory({ items }) {
            if (refuseIds && items.some((row) => row.id !== undefined)) {
                return { ok: false, code: "invalidItems", revision: 0, items: [] };
            }
            this.writes += 1;
            this.rows = items.map((row, index) => ({ id: row.id ?? `new${index}`, item: row.item, amount: row.amount, metadata: { ...row.metadata } }));
            return { ok: true, code: "", revision: 2, items: [] };
        },
        open(player) {
            this.opened.push(player.id);
            return opens;
        },
        destroy() {
            this.destroyed = true;
        },
    };
    return stash;
}

function load(copyOptions = {}) {
    const made = [];
    const logs = [];
    const context = { exports: {}, console: { log: (line) => logs.push(line) } };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/chest-view.js"), "utf8"), context);
    const views = new context.exports.ChestViews(() => {
        const copy = makeStash(900 + made.length, copyOptions);
        made.push(copy);
        return copy;
    });
    return { views, made, logs };
}

const ROWS = [
    { id: "r1", item: "apple", amount: 3, metadata: { quality: 2 } },
    { id: "r2", item: "kcdc-property:casa-03", amount: 1, metadata: { custom: { name: "Chave" } } },
];
const player = (id) => ({ id, virtualWorld: 0 });

test("Abrir copies the chest into a stash of its own and shows it on the game's transfer screen", () => {
    const { views, made } = load();
    const chest = makeStash(1, { levelGuid: "c1", rows: ROWS });
    assert.equal(views.open(player(7), chest), true);

    assert.equal(made.length, 1);
    assert.deepEqual(plain(made[0].rows), plain(ROWS), "the same rows, identity and all");
    assert.deepEqual(made[0].opened, [7]);
    assert.equal(views.isCopy(made[0]), true);
    assert.equal(views.isCopy(chest), false);
    assert.equal(views.busy("c1", 8), true, "nobody else opens it meanwhile");
    assert.equal(views.busy("c1", 7), false);
    assert.equal(views.openBy(7), true);
});

test("every move on the copy is in the chest at once, and closing writes it once more and throws the copy away", () => {
    const { views, made } = load();
    const chest = makeStash(1, { levelGuid: "c1", rows: ROWS });
    views.open(player(7), chest);
    const copy = made[0];

    copy.rows = copy.rows.filter((row) => row.item !== "apple");
    views.changed(copy);
    assert.deepEqual(plain(chest.rows).map((row) => row.item), ["kcdc-property:casa-03"], "taken out of the chest too");

    copy.rows.push({ id: "r9", item: "bread", amount: 1, metadata: {} });
    views.closed(copy);
    assert.deepEqual(plain(chest.rows).map((row) => row.item), ["kcdc-property:casa-03", "bread"]);
    assert.equal(copy.destroyed, true);
    assert.equal(views.busy("c1", 8), false, "free again");
    assert.equal(views.openBy(7), false);

    views.changed(chest);
    views.closed(chest);
    assert.equal(chest.writes, 2, "a container that is no copy is nobody's business here");
});

test("a chest already open by somebody, from its prompt or a copy, is not opened again", () => {
    const { views, made } = load();
    const held = makeStash(1, { levelGuid: "c1", rows: ROWS, holderId: 3 });
    assert.equal(views.open(player(7), held), false);
    assert.equal(made.length, 0);

    const chest = makeStash(2, { levelGuid: "c2", rows: ROWS });
    views.open(player(7), chest);
    assert.equal(views.open(player(8), chest), false);
    assert.equal(made.length, 1);
});

test("a container that wants its own identities gets the rows without them; one that will not open is thrown away", () => {
    const picky = load({ refuseIds: true });
    const chest = makeStash(1, { levelGuid: "c1", rows: ROWS });
    assert.equal(picky.views.open(player(7), chest), true);
    assert.deepEqual(plain(picky.made[0].rows).map((row) => row.item), ["apple", "kcdc-property:casa-03"]);

    const stuck = load({ opens: false });
    const other = makeStash(2, { levelGuid: "c2", rows: ROWS });
    assert.equal(stuck.views.open(player(7), other), false);
    assert.equal(stuck.made[0].destroyed, true);
    assert.equal(stuck.views.busy("c2", 8), false);
    assert.deepEqual(plain(other.rows), plain(ROWS), "the chest is as it was");
});

test("a stop writes every open copy back and throws it away", () => {
    const { views, made } = load();
    const chest = makeStash(1, { levelGuid: "c1", rows: ROWS });
    views.open(player(7), chest);
    made[0].rows = [];
    views.endAll();
    assert.deepEqual(plain(chest.rows), []);
    assert.equal(made[0].destroyed, true);
});
