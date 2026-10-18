const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const FULL = 536870911;

/**
 * The game as books.ts sees it. `smithing` lists the recipes the server offers as [id, perk]; `known` is the set of perks the
 * player owns, `knowledge` their alchemy book. `removeOk` / `addOk` decide whether the inventory takes the book away / back.
 */
function load({ smithing = [], known = [], knowledge = {}, removeOk = true, teachFails = false } = {}) {
    const calls = { registered: [], removed: [], added: [], perks: [], taught: [] };
    const chat = [];
    const logs = [];
    const handlers = new Map();
    const perks = new Set(known);
    const alchemy = { ...knowledge };

    const context = {
        exports: {},
        console: { log: (line) => logs.push(line) },
        Items: {
            register: (id, definition) => {
                calls.registered.push({ id, definition });
                return `guid:${id}`;
            },
        },
        Events: { on: (name, fn) => handlers.set(name, fn) },
        Chat: { sendToPlayer: (player, text) => chat.push(text) },
        Crafting: {
            recipes: () => smithing.map(([id, perk]) => ({ key: { kind: "smithing", id }, perk })),
            knowledge: () => alchemy,
            setKnowledge: (player, recipe, mask) => {
                if (teachFails) return false;
                calls.taught.push([recipe, mask]);
                alchemy[String(recipe)] = mask;
                return true;
            },
        },
        Inventory: {
            remove: (player, request) => {
                calls.removed.push(JSON.parse(JSON.stringify(request)));
                return { ok: removeOk, code: removeOk ? "" : "staleRevision" };
            },
            add: (player, request) => {
                calls.added.push(JSON.parse(JSON.stringify(request)));
                return { ok: true, code: "" };
            },
        },
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/books.js"), "utf8"), context);
    context.exports.registerBooks();
    context.exports.installBooks();

    const player = {
        nickname: "Mauro",
        hasPerk: (perk) => perks.has(perk),
        addPerk: (perk) => {
            if (teachFails) return false;
            calls.perks.push(perk);
            perks.add(perk);
            return true;
        },
    };
    const row = (name, over = {}) => ({ id: "row1", item: `guid:${name}`, name, amount: 1, metadata: {}, equipped: 0, ...over });
    return { api: context.exports, calls, chat, logs, player, row, use: (name, revision = 7, over = {}) => handlers.get("playerCustomItemUse")(player, row(name, over), revision) };
}

const SMITH = [
    ["r_axework01", "perk-axework01"],
    ["r_axework02", "perk-axework02"],
    ["r_horseshoe", "perk-horseshoe"],
    ["r_kovarTrainingSword", "perk-training"],
    ["r_huntingSwordBasic", "perk-hunting"],
];

test("every book is registered as a readable item with a price, so a shop can sell it", () => {
    const sut = load();
    assert.equal(sut.calls.registered.length, sut.api.BOOKS.length);
    for (const { id, definition } of sut.calls.registered) {
        assert.match(id, /^kcdc:book:/);
        assert.equal(definition.usable, true, `${id} can be read`);
        assert.equal(definition.useLabel, "Ler");
        assert.ok(definition.price > 0, `${id} has a positive base price, or a native shop hides it`);
        assert.ok(definition.name.length > 0 && definition.description.length > 0);
        assert.match(definition.visual, /^recipe_/, "borrowing the look of the game's own recipe documents");
    }
    assert.equal(sut.api.bookGuid("kcdc:book:ferreiro-ferramentas"), "guid:kcdc:book:ferreiro-ferramentas");
    assert.equal(sut.api.bookGuid("kcdc:book:nope"), null);
});

test("the books are consistent: unique ids and titles, no recipe twice in one book, none empty", () => {
    const books = load().api.BOOKS;
    assert.equal(new Set(books.map((book) => book.id)).size, books.length);
    assert.equal(new Set(books.map((book) => book.title)).size, books.length);
    for (const book of books) {
        assert.ok(book.recipes.length > 0);
        assert.equal(new Set(book.recipes.map((recipe) => recipe.id)).size, book.recipes.length, `${book.id} repeats a recipe`);
        assert.ok(["smithing", "alchemy"].includes(book.trade));
    }
    const alchemyIds = books.filter((book) => book.trade === "alchemy").flatMap((book) => book.recipes.map((recipe) => recipe.id));
    assert.equal(new Set(alchemyIds).size, alchemyIds.length, "no alchemy recipe is taught by two books");
    const smithIds = books.filter((book) => book.trade === "smithing").flatMap((book) => book.recipes.map((recipe) => recipe.id));
    assert.equal(new Set(smithIds).size, smithIds.length, "no smithing recipe is taught by two books");
});

test("reading a smithing book takes it and gives the perk of every recipe in it", () => {
    const sut = load({ smithing: SMITH });
    sut.use("kcdc:book:ferreiro-ferramentas", 7);

    assert.deepEqual(sut.calls.removed, [{ units: [{ id: "row1", amount: 1 }], revision: 7, notify: false }]);
    assert.deepEqual(sut.calls.perks, ["perk-axework01", "perk-axework02", "perk-horseshoe"]);
    assert.match(sut.chat.at(-1), /Manual do Ferreiro I/);
    assert.match(sut.chat.at(-1), /Machado de trabalho, Machado de carpinteiro, Ferraduras de fazenda/);
});

test("a book whose recipes are all known stays in the bag", () => {
    const sut = load({ smithing: SMITH, known: ["perk-training", "perk-hunting"] });
    sut.use("kcdc:book:ferreiro-aprendiz");
    assert.equal(sut.calls.removed.length, 0);
    assert.equal(sut.calls.perks.length, 0);
    assert.match(sut.chat.at(-1), /já conhece tudo/);
});

test("a book with some recipes known teaches only the rest", () => {
    const sut = load({ smithing: SMITH, known: ["perk-axework01"] });
    sut.use("kcdc:book:ferreiro-ferramentas");
    assert.deepEqual(sut.calls.perks, ["perk-axework02", "perk-horseshoe"]);
    assert.doesNotMatch(sut.chat.at(-1), /Machado de trabalho/);
    assert.equal(sut.calls.removed.length, 1);
});

test("an alchemy book writes whole recipes into the recipe book, skipping those already complete", () => {
    const sut = load({ knowledge: { 14: FULL, 3: 12345 } });
    sut.use("kcdc:book:alquimia-aprendiz");
    assert.deepEqual(sut.calls.taught, [[3, FULL], [30, FULL]], "a half-known recipe is completed, a whole one left alone");
    assert.match(sut.chat.at(-1), /Poção digestiva, Aqua Vitalis/);
});

test("when the inventory will not give the book up nothing is taught", () => {
    const sut = load({ smithing: SMITH, removeOk: false });
    sut.use("kcdc:book:ferreiro-ferramentas");
    assert.equal(sut.calls.perks.length, 0);
    assert.match(sut.chat.at(-1), /Tente de novo/);
});

test("when nothing can be taught after the book was taken, it is given back", () => {
    const sut = load({ smithing: SMITH, teachFails: true });
    sut.use("kcdc:book:ferreiro-ferramentas", 3, { metadata: { custom: { name: "x" } } });
    assert.equal(sut.calls.removed.length, 1);
    assert.deepEqual(sut.calls.added, [{ item: "guid:kcdc:book:ferreiro-ferramentas", amount: 1, metadata: { custom: { name: "x" } }, notify: false }]);
    assert.match(sut.chat.at(-1), /devolvido/);
});

test("a smithing recipe the server does not know is skipped without losing the others", () => {
    const sut = load({ smithing: SMITH.filter(([id]) => id !== "r_horseshoe") });
    sut.use("kcdc:book:ferreiro-ferramentas");
    assert.deepEqual(sut.calls.perks, ["perk-axework01", "perk-axework02"]);
    assert.ok(sut.logs.some((line) => /r_horseshoe/.test(line)));
});

test("a custom item that is not a book is none of its business", () => {
    const sut = load({ smithing: SMITH });
    sut.use("kcdc-property:casa-01");
    assert.equal(sut.calls.removed.length, 0);
    assert.equal(sut.chat.length, 0);
});
