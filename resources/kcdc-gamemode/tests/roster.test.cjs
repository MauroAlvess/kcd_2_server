"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const sandbox = { exports: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/roster.js"), "utf8"), sandbox);
const roster = sandbox.exports;
const plain = (value) => JSON.parse(JSON.stringify(value));

test("a request that is missing fields or has the wrong ones is the default one, never an error", () => {
    assert.deepEqual(plain(roster.parseQuery({})), { tag: "list", q: "", page: 0, filter: "all" });
    assert.deepEqual(plain(roster.parseQuery({ tag: "pick", q: "  Ivan   Zeman ", page: 2, filter: "noble" })), { tag: "pick", q: "Ivan Zeman", page: 2, filter: "noble" });
    assert.deepEqual(plain(roster.parseQuery({ tag: "admin", q: 5, page: -1, filter: "x" })), { tag: "list", q: "", page: 0, filter: "all" });
    assert.equal(roster.parseQuery({ page: 1.5 }).page, 0, "a page is a whole number");
    assert.equal(roster.parseQuery({ q: "x".repeat(500) }).q.length, roster.SEARCH_MAX);
    assert.equal(roster.parseQuery({ tag: "nom" }).tag, "nom");
});

test("folding takes the accents and the case off", () => {
    assert.equal(roster.fold("José ÁLVARO Šebesta"), "jose alvaro sebesta");
});

test("a search matches every word in the name, or the number of the player", () => {
    assert.equal(roster.matches("", 1, "Qualquer"), true);
    assert.equal(roster.matches("   ", 1, "Qualquer"), true);
    assert.equal(roster.matches("alv jo", 7, "José Álvaro"), true);
    assert.equal(roster.matches("alv xx", 7, "José Álvaro"), false);
    assert.equal(roster.matches("7", 7, "Ninguém"), true);
    assert.equal(roster.matches("#7", 7, "Ninguém"), true);
    assert.equal(roster.matches("#7", 8, "Ninguém"), false);
    assert.equal(roster.matches("7", 8, "Hans 27"), true, "a number is also looked for in the name");
});

test("a page is cut from the list, the last one when asked past the end, and an empty list has one empty page", () => {
    const rows = Array.from({ length: 25 }, (_, n) => n);
    const page = roster.paginate(rows, 1, 10);
    assert.deepEqual(plain(page), { rows: [10, 11, 12, 13, 14, 15, 16, 17, 18, 19], page: 1, pages: 3, total: 25 });
    assert.deepEqual(plain(roster.paginate(rows, 50, 10).rows), [20, 21, 22, 23, 24]);
    assert.equal(roster.paginate(rows, -4, 10).page, 0);
    assert.deepEqual(plain(roster.paginate([], 3, 10)), { rows: [], page: 0, pages: 1, total: 0 });
});

test("names are ordered as a reader looks for them: numbers as numbers, accents and case aside", () => {
    const sorted = ["Zé", "joão 10", "João 2", "Álvaro"].sort(roster.byName);
    assert.deepEqual(sorted, ["Álvaro", "João 2", "joão 10", "Zé"]);
});
