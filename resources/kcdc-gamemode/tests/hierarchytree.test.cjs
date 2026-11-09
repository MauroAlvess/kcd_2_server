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

/** The page's rules of who hangs from whom (`hierarchyChildren`) and of who stands beside whom (`hierarchyCouples`), over a hierarchy and the towns of the citizenship. */
function run(hierarchy, towns = []) {
    const source = [
        slice("const collator = ", ";\n"),
        slice("const natural = ", ";\n"),
        slice("function titleRanker() {", "\n}\n"),
        slice("const placeOf = ", ";\n"),
        slice("function regionIdOf(holder) {", "\n}\n"),
        slice("function branchOfTitle() {", "\n}\n"),
        slice("const holderCat = ", "\n};\n"),
        slice("function hierarchyChildren() {", "\n    return children;\n}\n"),
        slice("function hierarchyCouples(children) {", "\n    return { partners, merged };\n}\n"),
        slice("const levelOfHolder = ", ";\n"),
        "exports.children = hierarchyChildren();",
        "exports.couples = hierarchyCouples(exports.children);",
    ].join("\n");
    const context = { exports: {}, hierarchy, citizenship: { towns }, Map, Set, Math, String, Array, Number };
    vm.runInNewContext(source, context);
    return context.exports;
}

/** Each holder's parent, by name, once the pairs are made ("" for a root; a spouse drawn at somebody's side has none). */
function tree(hierarchy, towns = []) {
    const parentOf = new Map();
    const { children } = run(hierarchy, towns);
    for (const [parent, list] of children) for (const holder of list) parentOf.set(holder.name, parent === "" ? "" : hierarchy.holders.find((h) => h.key === parent).name);
    return parentOf;
}

const LEVEL = { rei: 1, lorde: 3, burgomestre: 3, conselheiro: 4, burgrave: 4, "capitao-guarda": 5, "capitao-milicia": 5, escrivao: 5, "guarda-portoes": 6, cavaleiro: 4, escudeiro: 4, "mestre-guilda": 4, "mestre-oficio": 5 };
const SERVES = { "guarda-portoes": ["capitao-milicia", "capitao-guarda"], "capitao-milicia": ["burgomestre"], conselheiro: ["burgomestre"], escrivao: ["burgomestre"], "capitao-guarda": ["burgrave"], "mestre-oficio": ["mestre-guilda", "burgomestre"] };
const ORDER = ["rei", "lorde", "cavaleiro", "escudeiro", "burgrave", "capitao-guarda", "burgomestre", "conselheiro", "capitao-milicia", "escrivao", "guarda-portoes", "mestre-guilda", "mestre-oficio"];

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
        slice("function regionIdOf(holder) {", "\n}\n"),
        slice("const placeOf = ", ";\n"),
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

// Who hangs from the lord of the land, and the pairs (2026-10-30: "a árvore hierárquica tá toda gaga, repetindo pessoas e jogadores fora da árvore; todo mundo precisa seguir a lógica de nomeação
// do lorde das terras"): the live realm had knights the Crown named and a soldier a lord of another land named standing in the air beside the lord of their land, and a lord and his wife who
// were both lords drawn twice, each as a card and as the other's spouse.
const REGIONS = [
    { id: "suchdol", name: "Suchdol", seat: null },
    { id: "wysoka", name: "Wysoka", seat: "suchdol" },
    { id: "raborsch", name: "Raborsch", seat: null },
];
const CATALOG = [
    { id: "great", titles: [{ id: "lorde" }] },
    { id: "lesser", titles: [{ id: "cavaleiro" }, { id: "escudeiro" }, { id: "capitao-guarda" }, { id: "soldado" }, { id: "guarda-portoes" }] },
    { id: "church", titles: [{ id: "bispo" }, { id: "padre" }] },
];
const RUNG = { lorde: 3, bispo: 3, cavaleiro: 4, escudeiro: 4, padre: 4, "capitao-guarda": 5, soldado: 6, "guarda-portoes": 6 };
const SERVES_UNDER = { "guarda-portoes": ["capitao-guarda"], soldado: ["capitao-guarda"] };

/** A holder named `key` (also their name) with one title, named by `by` ("crown" or another holder's key), living in `townId`. */
function person(key, title, by, townId, extra = {}) {
    return {
        key, name: key, self: false, lands: [], townId, consorts: [], female: false, ...extra,
        titles: [{ id: title, label: title, byKey: by === "crown" ? "" : by, crown: by === "crown", level: RUNG[title], reportsTo: SERVES_UNDER[title] ?? [] }],
    };
}
const spouseOf = (key, female) => ({ label: female ? "Lady" : "Esposo", name: key, courtesy: female, text: key, key });
const realmOf = (holders) => ({ branches: CATALOG, holders });
const seatOf = (townId) => (REGIONS.find((town) => town.id === townId)?.seat) ?? townId;

test("whoever the Crown named, and whoever a lord of another land named, hangs from the lord of the land they live in; a parent is always in the holder's own region", () => {
    const holders = [
        person("Erik", "lorde", "crown", "suchdol"),
        person("Gunther", "lorde", "crown", "raborsch"),
        person("Alaric", "cavaleiro", "crown", "suchdol"),
        person("Kael", "soldado", "Erik", "raborsch"),
        person("Wylk", "escudeiro", "Alaric", "wysoka"),
        person("Alustin", "capitao-guarda", "crown", "suchdol"),
        person("Vladimir", "guarda-portoes", "crown", "suchdol"),
    ];
    const parents = tree(realmOf(holders), REGIONS);
    assert.equal(parents.get("Erik"), "", "a lord is a root of his region");
    assert.equal(parents.get("Gunther"), "");
    assert.equal(parents.get("Alaric"), "Erik", "named by the Crown: under the lord of Suchdol, not in the air beside him");
    assert.equal(parents.get("Kael"), "Gunther", "named by the lord of another land: under the lord of Raborsch, where he lives");
    assert.equal(parents.get("Wylk"), "Alaric", "the squire a knight named stays under him; Wysoka is a land of Suchdol");
    assert.equal(parents.get("Alustin"), "Erik");
    assert.equal(parents.get("Vladimir"), "Alustin", "the guard hangs from the captain of his own land");
    for (const holder of holders) {
        const parent = parents.get(holder.name);
        if (parent === "") continue;
        const chief = holders.find((one) => one.name === parent);
        assert.equal(seatOf(chief.townId), seatOf(holder.townId), `${holder.name} hangs from somebody in their own region`);
    }
});

test("where nobody holds the lordship, and for the Church, and between lords, nobody is hung from a lord who is not theirs: the roots stay roots", () => {
    const parents = tree(realmOf([
        person("Cav", "cavaleiro", "crown", "raborsch"),
        person("Padre", "padre", "crown", "suchdol"),
        person("Bispo", "bispo", "crown", "suchdol"),
        person("Erik", "lorde", "crown", "suchdol"),
        person("Outro", "lorde", "crown", "suchdol"),
        person("Sem cidade", "cavaleiro", "crown", null),
    ]), REGIONS);
    assert.equal(parents.get("Cav"), "", "Raborsch has no lord here");
    assert.equal(parents.get("Padre"), "", "the Church has its own chain of nomination, not the lord's");
    assert.equal(parents.get("Bispo"), "");
    assert.equal(parents.get("Outro"), "", "a lord is not below another lord");
    assert.equal(parents.get("Sem cidade"), "", "no city, no lord");
});

test("a holder and a spouse who holds a title too are one pair: the husband leads, what hangs from either hangs from him, and the wife is a card of no tree of her own", () => {
    const holders = [
        person("Gunther", "lorde", "crown", "raborsch", { consorts: [spouseOf("Elisabeth", true)] }),
        person("Elisabeth", "lorde", "crown", "raborsch", { female: true, consorts: [spouseOf("Gunther", false)] }),
        person("Tristan", "cavaleiro", "Elisabeth", "raborsch"),
        person("Urik", "cavaleiro", "Gunther", "raborsch"),
    ];
    const done = run(realmOf(holders), REGIONS);
    assert.deepEqual(Array.from(done.couples.partners, ([lead, spouses]) => [lead, Array.from(spouses, (spouse) => spouse.name)]), [["Gunther", ["Elisabeth"]]]);
    assert.deepEqual(Array.from(done.couples.merged), ["Elisabeth"]);
    assert.deepEqual(Array.from(done.children.get("Gunther"), (one) => one.name).sort(), ["Tristan", "Urik"], "her knight and his knight hang from the pair");
    const placed = Array.from(done.children.values()).flatMap((list) => Array.from(list, (one) => one.name));
    assert.ok(!placed.includes("Elisabeth"), "she is at his side, in no list of children, so no root and no branch of her own");
    assert.equal(placed.filter((name) => name === "Gunther").length, 1, "and he is there once");
});

test("the one who named the other leads the pair, whoever is the husband; a spouse in another region, or named by somebody else, keeps their own place and is not paired", () => {
    const lady = run(realmOf([
        person("Lady", "lorde", "crown", "raborsch", { female: true, consorts: [spouseOf("Knight", false)] }),
        person("Knight", "cavaleiro", "Lady", "raborsch", { consorts: [spouseOf("Lady", true)] }),
    ]), REGIONS);
    assert.deepEqual(Array.from(lady.couples.partners.keys()), ["Lady"], "she named him: she leads");
    assert.deepEqual(Array.from(lady.couples.merged), ["Knight"]);

    const apart = run(realmOf([
        person("A", "lorde", "crown", "suchdol", { consorts: [spouseOf("B", true)] }),
        person("B", "lorde", "crown", "raborsch", { female: true, consorts: [spouseOf("A", false)] }),
    ]), REGIONS);
    assert.equal(apart.couples.partners.size, 0, "two regions are two trees");

    const strangers = run(realmOf([
        person("Erik", "lorde", "crown", "suchdol"),
        person("Cav", "cavaleiro", "Erik", "suchdol"),
        person("K1", "cavaleiro", "Erik", "suchdol", { consorts: [spouseOf("K2", true)] }),
        person("K2", "escudeiro", "Cav", "suchdol", { female: true, consorts: [spouseOf("K1", false)] }),
    ]), REGIONS);
    assert.equal(strangers.couples.partners.size, 0, "one is under Erik and the other under Cav: each keeps the place their nominator gave");
});

// Pschitoky (2026-11-06, "corrija a árvore hierárquica de Pschitoky colocando cada um certinho igual Suchdol"): its four craft masters with no other title hung from the lord in one wide row, as
// the catalog said they answer to a guild master and nobody holds that title. They answer to the burgomaster of the town when there is no guild master, as the clerk and the militia captain do.

test("a craft master with no guild master above answers to the burgomaster, and to the lord when the town has none", () => {
    const people = [["Lorde", "lorde", "crown"], ["Burgo", "burgomestre", "Lorde"], ["Mestre A", "mestre-oficio", "Lorde"], ["Mestre B", "mestre-oficio", "crown"], ["Escrivao", "escrivao", "Lorde"]];
    const parents = tree(realm(people));
    assert.equal(parents.get("Mestre A"), "Burgo", "named by the lord, under his burgomaster");
    assert.equal(parents.get("Mestre B"), "Burgo", "named by the Crown, the same");
    assert.equal(parents.get("Escrivao"), "Burgo", "as the clerk already was");
    assert.equal(parents.get("Burgo"), "Lorde");

    const none = tree(realm(people.filter(([key]) => key !== "Burgo")));
    assert.equal(none.get("Mestre A"), "Lorde", "no burgomaster: under whoever named them");
});

test("a guild master comes before the burgomaster for a craft master", () => {
    const withGuild = tree(realm([["Lorde", "lorde", "crown"], ["Burgo", "burgomestre", "Lorde"], ["Guilda", "mestre-guilda", "Lorde"], ["Mestre", "mestre-oficio", "Lorde"]]));
    assert.equal(withGuild.get("Mestre"), "Guilda", "the guild master first");
    assert.equal(withGuild.get("Guilda"), "Lorde");
});
