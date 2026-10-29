"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

// Finding the player a command names (src/server/players.ts): by name, by the start of a name, by the player's number (the "Nº" of the
// Jogadores page, the network id: 2026-10-20, "o comando de carroça registrar deve usar o número do jogador, exemplo 4438"), by slot.

function load(players) {
    const context = { exports: {}, Number, Player: { all: () => players } };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/players.js"), "utf8"), context);
    return context.exports;
}

const who = (id, nickname, playerIndex) => ({ id, nickname, playerIndex });

test("a player is found by name, by the start of a name, and by number", () => {
    const players = [who(4436, "Radovan", 0), who(4438, "Jaromir o Justo", 1), who(4440, "Jana", 2)];
    const { findPlayer } = load(players);
    assert.equal(findPlayer("radovan").player.id, 4436);
    assert.equal(findPlayer("Jar").player.id, 4438, "a unique start of a name");
    assert.equal(findPlayer("4438").player.id, 4438, "the number the Jogadores page shows");
    assert.equal(findPlayer("4440").player.nickname, "Jana");
    assert.ok("error" in findPlayer("9999"));
    assert.match(findPlayer("9999").error, /the player's number/);
    assert.ok("error" in findPlayer("J"), "two names start with J: the name alone does not say");
});

test("a number names the player with that number before the one in that slot; a name that is a number still wins; a slot still works", () => {
    const players = [who(4436, "Radovan", 0), who(4438, "Jaromir", 1), who(1, "Ana", 7)];
    const { findPlayer } = load(players);
    assert.equal(findPlayer("1").player.nickname, "Ana", "the number 1 is Ana's, not the one in slot 1");
    assert.equal(findPlayer("0").player.nickname, "Radovan", "no player has the number 0: the slot answers");
    assert.equal(findPlayer("7").player.nickname, "Ana", "slot 7 is still reachable when no player has the number 7");
    const named = [who(4436, "4438", 0), who(4438, "Jaromir", 1)];
    assert.equal(load(named).findPlayer("4438").player.id, 4436, "a player named for a number still wins");
});

test("an empty query names nobody", () => {
    const { findPlayer } = load([who(0, "Radovan", 0)]);
    assert.ok("error" in findPlayer(""));
    assert.ok("error" in findPlayer("   "));
});
