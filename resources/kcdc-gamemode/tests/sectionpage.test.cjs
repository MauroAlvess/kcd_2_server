"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

// The panel loads one section at a time (2026-10-31): the page and the server must agree on which sets of data each section reads.
const page = fs.readFileSync(path.join(__dirname, "../ui-src/status.html"), "utf8");
const client = fs.readFileSync(path.join(__dirname, "../src/client/status.ts"), "utf8");
const server = fs.readFileSync(path.join(__dirname, "../dist/server/status.js"), "utf8");

function pageSets() {
    const from = page.indexOf("const SECTION_SETS = {");
    assert.ok(from >= 0, "the page names the sets of its sections");
    const to = page.indexOf("\n};", from);
    return vm.runInNewContext("(" + page.slice(from + "const SECTION_SETS = ".length, to + 2) + ")");
}

test("the page's sets of data for each section are the server's (SECTION_NEEDS)", () => {
    const sandbox = { exports: {}, require: () => ({}) };
    // The status module needs more than this test gives it to run; its table is read out of the compiled source instead.
    const from = server.indexOf("exports.SECTION_NEEDS = {");
    assert.ok(from >= 0, "the server names the sets of its sections");
    const to = server.indexOf("\n};", from);
    const needs = vm.runInNewContext("(" + server.slice(from + "exports.SECTION_NEEDS = ".length, to + 2) + ")", sandbox);
    const here = pageSets();
    assert.deepEqual(JSON.parse(JSON.stringify(here)), JSON.parse(JSON.stringify(needs)));
});

test("every set a section needs is a set the server knows how to send, and every section named has a tab on the page", () => {
    const sets = ["citizenship", "family", "properties", "nobility"];
    for (const [section, needed] of Object.entries(pageSets())) {
        assert.ok(page.includes(`id="tab-${section}"`), `${section} has a tab`);
        for (const set of needed) assert.ok(sets.includes(set), `${section} needs ${set}`);
    }
});

test("the client tells the server which section opened, and the page waits for a section's data before it draws it", () => {
    assert.match(client, /Events\.emitServer\(`\$\{RESOURCE\}:status\.section`, JSON\.stringify\(\{ tab \}\)\)/);
    assert.match(page, /const waitsFor = \(name\) => loadedSets !== null && \(SECTION_SETS\[name\] \|\| \[\]\)\.some\(\(set\) => !loadedSets\.has\(set\)\);/);
    assert.match(page, /loadedSets = Array\.isArray\(detail\.sets\) \? new Set\(detail\.sets\) : null;/);
    assert.match(page, /if \(name === now && !waitsFor\(name\)\) drawSection\(name\);/);
    assert.match(page, /\.tab\.loading > \* \{ visibility: hidden; \}/);
});

test("leaving a section throws away what it kept for itself: the tree, the players (the Cidadania section left the panel, 2026-11-09)", () => {
    const from = page.indexOf("function dropSectionData(leaving) {");
    assert.ok(from >= 0);
    const body = page.slice(from, page.indexOf("\n}\n", from));
    for (const dropped of ["hierarchy = null;", "players = [];"]) assert.ok(body.includes(dropped), dropped);
    assert.ok(!body.includes("townCitizens"), "the list of citizens left with its section");
    assert.match(page, /if \(openSection !== "" && openSection !== name\) dropSectionData\(openSection\);/);
});

test("the client tells the server when the panel is put away, so that nothing of it is worked out while it is closed (2026-10-31)", () => {
    const from = client.indexOf("function hide(): void {");
    assert.ok(from >= 0);
    const body = client.slice(from, client.indexOf("\n}\n", from));
    assert.match(body, /Events\.emitServer\(`\$\{RESOURCE\}:status\.section`, JSON\.stringify\(\{ tab: "closed" \}\)\);/);
    assert.ok(body.indexOf("destroy();") < body.indexOf("status.section"), "after the page is put away");
});
