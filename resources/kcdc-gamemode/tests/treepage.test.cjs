"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

// The hierarchy tree of the Nomeação section (ui-src/status.html, 2026-10-30): a spouse (a lord's Lady) is a card of her own to the right of the holder's, joined by a bond, and every root of
// a region's tree stands in the row of its own level, counted from the highest root (the archbishop beside the King and a priest beside a lord were drawn in the first row).

const written = fs.readFileSync(path.join(__dirname, "..", "ui-src", "status.html"), "utf8");
const shipped = fs.readFileSync(path.join(__dirname, "..", "ui", "status.html"), "utf8");

test("a holder's spouse is drawn as a card of her own beside his, joined by a bond, and no longer as a line inside his", () => {
    assert.match(written, /make\("div", "ocouple"\)/);
    assert.match(written, /make\("i", "oband"\)/);
    assert.match(written, /"onode lady"/);
    assert.ok(!written.includes('make("span", "ospouse"'), "the line inside the card is gone");
    assert.match(written, /\.ocouple \{ display: flex; align-items: stretch; justify-content: center; \}/);
    for (const mark of ["ocouple", "oband", "onode lady"]) {
        assert.ok(shipped.includes(mark), `${mark} is in the packed page`);
    }
});

test("the roots of a region's tree are placed by their own level, from the highest of them", () => {
    assert.match(written, /const first = Math\.min\(\.\.\.roots\.map\(levelOfHolder\)\);/);
    assert.match(written, /roots\.forEach\(\(holder\) => list\.appendChild\(treeSlot\(holder, ctx, first - 1\)\)\);/);
    assert.ok(!written.includes("treeSlot(holder, ctx, levelOfHolder(holder) - 1)"), "the old call that put every root in the first row is gone");
});

test("a spouse who holds a title is drawn once, in the pair the tree made: no root and no branch of their own, and no second card beside their spouse (2026-10-30)", () => {
    assert.match(written, /const \{ partners, merged \} = hierarchyCouples\(children\);/);
    assert.match(written, /!merged\.has\(holder\.key\) && !include\.has\(parentOf\.get\(holder\.key\)\)/);
    assert.match(written, /\.filter\(\(consort\) => !consort\.key\)/);
    assert.match(written, /couple\.appendChild\(holderCard\(partner, ctx\)\);/);
    assert.match(written, /const ctx = \{ children, partners, include, branches, block \};/);
    assert.ok(shipped.includes("hierarchyCouples") && shipped.includes("holderCard"), "the packed page has them");
});

test("the blocks of the tree and the hanging of the holders use one rule of region, so a holder never hangs from somebody who is drawn in another block", () => {
    assert.match(written, /function regionIdOf\(holder\) \{/);
    assert.match(written, /for \(const holder of hierarchy\.holders\) at\(regionIdOf\(holder\)\)\.holders\.push\(holder\);/);
    assert.match(written, /const region = new Map\(hierarchy\.holders\.map\(\(h\) => \[h\.key, regionIdOf\(h\)\]\)\);/);
    assert.match(written, /region\.get\(chief\.key\) === region\.get\(holder\.key\) && above\(chief, holder\)/);
});
