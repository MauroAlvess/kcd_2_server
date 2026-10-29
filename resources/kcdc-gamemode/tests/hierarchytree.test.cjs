const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// The tree of the hierarchy as the panel draws it (`hierarchyChildren` in ui-src/status.html): each holder under whoever named
// them, and, inside one command, under whom their title serves (user, 2026-10-19: "nomeei um guarda do portão e ele ficou na
// hierarquia errada ... um guarda não é abaixo de capitão?").

const page = fs.readFileSync(path.join(__dirname, "../ui-src/status.html"), "utf8");

function slice(start, end) {
    const from = page.indexOf(start);
    assert.ok(from >= 0, `${start} is in the page`);
    const to = page.indexOf(end, from);
    assert.ok(to > from, `${start} ends`);
    return page.slice(from, to + end.length);
}

function tree(hierarchy) {
    const source = [
        slice("const collator = ", ";\n"),
        slice("const natural = ", ";\n"),
        slice("function hierarchyChildren() {", "\n    return children;\n}\n"),
        slice("const levelOfHolder = ", ";\n"),
        "exports.children = hierarchyChildren();",
    ].join("\n");
    const context = { exports: {}, hierarchy, Map, Set, Math, String, Array };
    vm.runInNewContext(source, context);
    const children = context.exports.children;
    const parentOf = new Map();
    for (const [parent, list] of children) for (const holder of list) parentOf.set(holder.name, parent === "" ? "" : hierarchy.holders.find((h) => h.key === parent).name);
    return parentOf;
}

const LEVEL = { rei: 1, lorde: 3, burgomestre: 3, conselheiro: 4, burgrave: 4, "capitao-guarda": 5, "capitao-milicia": 5, escrivao: 5, "guarda-portoes": 6, cavaleiro: 4, escudeiro: 4 };
const SERVES = { "guarda-portoes": ["capitao-milicia", "capitao-guarda"], "capitao-milicia": ["burgomestre"], conselheiro: ["burgomestre"], escrivao: ["burgomestre"], "capitao-guarda": ["burgrave"] };
const ORDER = ["rei", "lorde", "cavaleiro", "escudeiro", "burgrave", "capitao-guarda", "burgomestre", "conselheiro", "capitao-milicia", "escrivao", "guarda-portoes"];

function realm(people) {
    return {
        branches: [{ id: "all", titles: ORDER.map((id) => ({ id })) }],
        holders: people.map(([key, title, by]) => ({
            key, name: key, self: false, lands: [],
            titles: [{ id: title, label: title, byKey: by === "crown" ? "" : by, crown: by === "crown", level: LEVEL[title], reportsTo: SERVES[title] ?? [] }],
        })),
    };
}

test("a gate guard named by a lord hangs from the militia's captain that lord named, and the captain from the burgomaster", () => {
    const parents = tree(realm([
        ["Lorde", "lorde", "crown"],
        ["Burgo", "burgomestre", "Lorde"],
        ["Capitao", "capitao-milicia", "Lorde"],
        ["Guarda", "guarda-portoes", "Lorde"],
        ["Conselheiro", "conselheiro", "Lorde"],
    ]));
    assert.equal(parents.get("Lorde"), "");
    assert.equal(parents.get("Burgo"), "Lorde");
    assert.equal(parents.get("Capitao"), "Burgo");
    assert.equal(parents.get("Guarda"), "Capitao", "the guard is under the captain");
    assert.equal(parents.get("Conselheiro"), "Burgo");
});

test("with no captain the guard stays under whoever named him; a captain of another lord's command is not his", () => {
    const alone = tree(realm([["Lorde", "lorde", "crown"], ["Guarda", "guarda-portoes", "Lorde"]]));
    assert.equal(alone.get("Guarda"), "Lorde");
    const other = tree(realm([
        ["Lorde A", "lorde", "crown"],
        ["Lorde B", "lorde", "crown"],
        ["Capitao B", "capitao-milicia", "Lorde B"],
        ["Guarda A", "guarda-portoes", "Lorde A"],
    ]));
    assert.equal(other.get("Guarda A"), "Lorde A", "another lord's captain does not command him");
    assert.equal(other.get("Capitao B"), "Lorde B");
});

test("named by the Crown, the guard hangs from a captain all the same; a castle's captain will do when the town has none", () => {
    const crown = tree(realm([["Capitao", "capitao-guarda", "crown"], ["Guarda", "guarda-portoes", "crown"]]));
    assert.equal(crown.get("Guarda"), "Capitao");
    assert.equal(crown.get("Capitao"), "");
    const castle = tree(realm([
        ["Lorde", "lorde", "crown"],
        ["Burgrave", "burgrave", "Lorde"],
        ["Capitao", "capitao-guarda", "Lorde"],
        ["Guarda", "guarda-portoes", "Lorde"],
    ]));
    assert.equal(castle.get("Capitao"), "Burgrave");
    assert.equal(castle.get("Guarda"), "Capitao");
});

test("the knight and the squire he named keep their place, and nothing that names nobody moves", () => {
    const parents = tree(realm([["Cavaleiro", "cavaleiro", "crown"], ["Escudeiro", "escudeiro", "Cavaleiro"]]));
    assert.equal(parents.get("Escudeiro"), "Cavaleiro");
    assert.equal(parents.get("Cavaleiro"), "");
});

// The tree is cut by region (2026-10-29: "dividir por região, assim ficará uma árvore fácil de ser lida"): `treeBlocks` in ui-src/status.html.
function blocks(hierarchy, towns) {
    const source = [
        slice("const levelOfHolder = ", ";\n"),
        slice("function treeBlocks() {", "\n    return blocks;\n}\n"),
        "exports.blocks = treeBlocks();",
    ].join("\n");
    const context = { exports: {}, hierarchy, citizenship: { towns }, Map, Set, Math, Array };
    vm.runInNewContext(source, context);
    return context.exports.blocks;
}

const TOWNS = [
    { id: "suchdol", name: "Suchdol", seat: null, lands: ["Wysoka"] },
    { id: "wysoka", name: "Wysoka", seat: "suchdol", lands: [] },
    { id: "raborsch", name: "Raborsch", seat: null, lands: [] },
];

function holder(key, title, level, townId) {
    return { key, name: key, self: false, lands: [], townId, titles: [{ id: title, label: title, byKey: "", crown: true, level, reportsTo: [] }] };
}

test("the Crown holds whoever stands on the first two rows, wherever they live; each seat holds its own citizens and those of its lands; the rest have no city", () => {
    const list = blocks({
        holders: [
            holder("rei", "rei", 1, "suchdol"),
            holder("marques", "marques", 2, null),
            holder("lorde", "lorde", 3, "suchdol"),
            holder("cavaleiro", "cavaleiro", 4, "wysoka"),
            holder("soldado", "soldado", 6, "raborsch"),
            holder("padre", "padre", 4, null),
            holder("estranho", "burgomestre", 3, "lugar-que-nao-existe"),
        ],
        trades: [],
    }, TOWNS);
    assert.deepEqual(Array.from(list, (block) => block.id), ["crown", "suchdol", "raborsch", "none"], "the Crown, each seat in the catalog's order, then those with no city");
    const at = (id) => Array.from(list.find((block) => block.id === id).holders, (one) => one.key);
    assert.deepEqual(at("crown"), ["rei", "marques"]);
    assert.deepEqual(at("suchdol"), ["lorde", "cavaleiro"], "a citizen of Wysoka stands with the house of Suchdol, whose land it is");
    assert.deepEqual(at("raborsch"), ["soldado"]);
    assert.deepEqual(at("none"), ["padre", "estranho"], "no city, or one the catalog does not know");
    assert.equal(list.find((block) => block.id === "suchdol").kind, "house");
    assert.equal(list[0].kind, "crown");
});

test("the tradesmen stand in the region they are citizens of, whoever holds no title; a land counts for its seat", () => {
    const list = blocks({
        holders: [holder("lorde", "lorde", 3, "suchdol")],
        trades: [
            { key: "t1", name: "Hans", guildId: "venatores", townId: "wysoka", town: "Wysoka", byKey: "", self: false },
            { key: "t2", name: "Dorota", guildId: "tabernarii", townId: "suchdol", town: "Suchdol", byKey: "", self: false },
            { key: "t3", name: "Agnes", guildId: "agricolae", townId: "raborsch", town: "Raborsch", byKey: "", self: false },
            { key: "t4", name: "Wenzel", guildId: "alchemistae", townId: null, town: null, byKey: "", self: false },
        ],
    }, TOWNS);
    const trades = (id) => Array.from(list.find((block) => block.id === id).trades, (one) => one.name);
    assert.deepEqual(trades("suchdol"), ["Hans", "Dorota"]);
    assert.deepEqual(trades("raborsch"), ["Agnes"]);
    assert.deepEqual(trades("none"), ["Wenzel"]);
    assert.deepEqual(trades("crown"), []);
});

test("with no trades in the answer (an older server) the tree is still cut, and with no towns every holder but the Crown's has no city", () => {
    const older = blocks({ holders: [holder("lorde", "lorde", 3, "suchdol")] }, TOWNS);
    assert.deepEqual(Array.from(older.find((block) => block.id === "suchdol").trades), []);
    const none = blocks({ holders: [holder("rei", "rei", 1, null), holder("lorde", "lorde", 3, "suchdol")], trades: [] }, []);
    assert.deepEqual(Array.from(none, (block) => block.id), ["crown", "none"]);
    assert.deepEqual(Array.from(none[1].holders, (one) => one.key), ["lorde"]);
});
