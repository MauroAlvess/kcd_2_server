"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

// What the death screen reads (src/server/death-verses.ts, 2026-10-31).

const box = { exports: {}, Math };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/death-verses.js"), "utf8"), box);
const verses = box.exports;
const plain = (value) => JSON.parse(JSON.stringify(value));

test("there are nine verses, each with its reference and in both languages, none repeated and none too long for the screen", () => {
    assert.equal(verses.VERSES.length, 9);
    const texts = new Set();
    for (const verse of verses.VERSES) {
        for (const lang of ["pt", "en"]) {
            assert.ok(verse[lang].length > 40 && verse[lang].length < 230, `${verse.ref[lang]}: ${verse[lang].length} letters`);
            assert.match(verse.ref[lang], /\d+:\d+/);
            texts.add(verse[lang]);
        }
    }
    assert.equal(texts.size, 18);
    assert.ok(verses.VERSES.some((verse) => verse.ref.pt.startsWith("Salmo 23")), "the shepherd's psalm");
    assert.ok(verses.VERSES.some((verse) => verse.ref.pt.startsWith("Mateus 6")), "the Our Father");
    assert.ok(verses.VERSES.some((verse) => verse.ref.pt === "João 11:25"), "the resurrection and the life");
});

test("a roll in [0, 1) draws a verse, the whole list is reachable, and a roll outside it is held to the ends", () => {
    const seen = new Set();
    for (let i = 0; i < 90; i += 1) seen.add(verses.verseAt(i / 90).pt);
    assert.equal(seen.size, 9, "every verse comes up");
    assert.equal(verses.verseAt(0).ref.pt, verses.VERSES[0].ref.pt);
    assert.equal(verses.verseAt(0.999999).ref.pt, verses.VERSES[8].ref.pt);
    assert.equal(verses.verseAt(-3).ref.pt, verses.VERSES[0].ref.pt);
    assert.equal(verses.verseAt(7).ref.pt, verses.VERSES[8].ref.pt);
});

test("the page is sent the verse in the player's own language, its reference, the line over the counter and the seconds", () => {
    assert.deepEqual(plain(verses.screenFor("pt", 10, 0)), { seconds: 10, text: verses.VERSES[0].pt, ref: "Salmo 23:1,4", label: "Você volta a si em" });
    assert.deepEqual(plain(verses.screenFor("en", 10, 0)), { seconds: 10, text: verses.VERSES[0].en, ref: "Psalm 23:1,4", label: "You will rise again in" });
    const drawn = verses.screenFor("pt", 8);
    assert.equal(drawn.seconds, 8);
    assert.ok(verses.VERSES.some((verse) => verse.pt === drawn.text));
});
