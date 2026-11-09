"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

// What an NPC says and the way it stands (src/server/npc-speech.ts, 2026-11-02: "quando falar com um NPC ele deve se virar para o jogador e após sair deve voltar à orientação dele;
// as frases dele e dos NPCs não estão saindo nem aparecendo; o correto devia ser uma sequência de diálogo").

function load() {
    const state = { chat: [], timers: [], now: 1_000_000, dialogues: new Map(), vendors: new Map() };
    const npcs = new Map();
    const players = [];
    const context = {
        exports: {},
        Date: { now: () => state.now },
        setTimeout: (fn, ms) => { state.timers.push({ fn, ms, at: state.now + ms }); return state.timers.length; },
        Chat: { sendToPlayer: (player, text, options) => state.chat.push([player.id, text, options?.author, options?.color]) },
        Player: { all: () => players },
        Npc: { getById: (id) => npcs.get(id) ?? null },
        Dialogue: { sessionOf: (id) => state.dialogues.get(id) ?? 0 },
        Vendor: { sessionOf: (id) => state.vendors.get(id) ?? 0 },
        Math,
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/npc-speech.js"), "utf8"), context);
    const npc = (id, at, over = {}) => {
        const one = { id, alive: true, position: at, said: [], talking: [], looked: [], say(text) { this.said.push(text); return true; }, setTalking(on) { this.talking.push(on); return true; }, lookAt(target) { this.looked.push(target); return true; }, ...over };
        npcs.set(id, one);
        return one;
    };
    const player = (id, at, over = {}) => {
        const one = { id, ready: true, position: at, ...over };
        players.push(one);
        return one;
    };
    // Runs the timers due by now, in order (a timer may set another).
    const run = () => {
        for (let guard = 0; guard < 500; guard += 1) {
            const due = state.timers.filter((timer) => timer.at <= state.now && !timer.done).sort((a, b) => a.at - b.at)[0];
            if (due === undefined) return;
            due.done = true;
            due.fn();
        }
    };
    return { api: context.exports, state, npc, player, run };
}

test("a line is said over the body and in the chat card of every player within earshot, with the NPC as its author; nobody further, nor on another floor", () => {
    const sut = load();
    const ferreiro = sut.npc(5, { x: 0, y: 0, z: 10 });
    sut.player(1, { x: 3, y: 4, z: 10 });
    sut.player(2, { x: 30, y: 0, z: 10 });
    sut.player(3, { x: 1, y: 1, z: 25 });
    sut.player(4, { x: 2, y: 2, z: 10 }, { ready: false });
    assert.equal(sut.api.speak(ferreiro, "Mestre Ferreiro", "  O ferro não espera.  "), 1);
    assert.deepEqual(ferreiro.said, ["O ferro não espera."]);
    assert.deepEqual(sut.state.chat, [[1, "O ferro não espera.", "Mestre Ferreiro", sut.api.speechSettings.color]]);
    // A bandit's shout carries further.
    assert.equal(sut.api.speak(ferreiro, "Bandido", "Peguem ele!", { radiusM: 45 }), 2);
    // A conversation's line goes to its player only.
    sut.state.chat = [];
    const far = { id: 9, ready: true, position: { x: 500, y: 0, z: 0 } };
    assert.equal(sut.api.speak(ferreiro, "Mestre Ferreiro", "Volte quando quiser.", { to: [far] }), 1);
    assert.deepEqual(sut.state.chat.map(([id]) => id), [9]);
    assert.equal(sut.api.speak(ferreiro, "Mestre Ferreiro", "   "), 0, "nothing to say, nothing said");
});

test("the mouth moves for as long as the line takes to say, and a second line keeps it moving to the end of the second", () => {
    const sut = load();
    const ferreiro = sut.npc(5, { x: 0, y: 0, z: 10 });
    const line = "Kits de reparo e metal de forja, é o que tenho.";
    assert.equal(sut.api.speechMs(line), line.length * 55);
    assert.equal(sut.api.speechMs("Oi."), 1_500, "never shorter than a breath");
    assert.equal(sut.api.speechMs("x".repeat(400)), 6_000);
    sut.api.speak(ferreiro, "Mestre Ferreiro", line, {}, sut.state.now);
    assert.deepEqual(ferreiro.talking, [true]);
    sut.state.now += 1_000;
    sut.api.speak(ferreiro, "Mestre Ferreiro", line, {}, sut.state.now);
    assert.deepEqual(ferreiro.talking, [true], "already talking");
    // When the first line's time is up, the second has a second left.
    sut.state.now += line.length * 55 - 1_000 + 1;
    sut.run();
    assert.deepEqual(ferreiro.talking, [true], "the second line is not over yet");
    sut.state.now += 1_000;
    sut.run();
    assert.deepEqual(ferreiro.talking, [true, false]);
});

test("a page's line is said by its speaker: 'Mestre Ferreiro de Suchdol: ...' by the vendor, a line with no speaker whole", () => {
    const sut = load();
    const split = (line) => JSON.parse(JSON.stringify(sut.api.splitSpeaker(line, "Mestre Ferreiro")));
    assert.deepEqual(split("Mestre Ferreiro de Suchdol: O ferro não espera."), { author: "Mestre Ferreiro de Suchdol", text: "O ferro não espera." });
    assert.deepEqual(split("Quer aprender o ofício de ferreiro? Em Suchdol, quem é cidadão aprende comigo."), { author: "Mestre Ferreiro", text: "Quer aprender o ofício de ferreiro? Em Suchdol, quem é cidadão aprende comigo." });
    assert.deepEqual(split("Atenção: isso custa."), { author: "Atenção", text: "isso custa." }, "a short word before a colon reads as a speaker: the vendors' pages always name theirs");
});

test("after a talk the NPC turns back to its own way once the player has no conversation nor trade open; another player's talk takes the turning over", () => {
    const sut = load();
    const ferreiro = sut.npc(5, { x: 100, y: 200, z: 10 });
    const hans = sut.player(1, { x: 101, y: 200, z: 10 });
    const jan = sut.player(2, { x: 99, y: 200, z: 10 });
    sut.state.dialogues.set(1, 7);
    sut.api.turnBackAfterTalk(ferreiro, hans, 90, sut.state.now);
    sut.state.now += 1_500;
    sut.run();
    assert.deepEqual(ferreiro.looked, [], "still talking");
    // The talk ends in the trade screen: still busy.
    sut.state.dialogues.delete(1);
    sut.state.vendors.set(1, 3);
    sut.state.now += 1_000;
    sut.run();
    assert.deepEqual(ferreiro.looked, []);
    sut.state.vendors.delete(1);
    sut.state.now += 1_000;
    sut.run();
    // Yaw 90 is -X (0 is +Y, as the level's): ten metres that way, at a face's height.
    assert.equal(ferreiro.looked.length, 1);
    const [point] = ferreiro.looked;
    assert.ok(Math.abs(point.x - 90) < 1e-9 && Math.abs(point.y - 200) < 1e-9 && Math.abs(point.z - 11.6) < 1e-9, JSON.stringify(point));

    // Jan talks to it while Hans's talk is open: Hans's end does not turn it, Jan's does.
    sut.state.dialogues.set(1, 8);
    sut.state.dialogues.set(2, 9);
    sut.api.turnBackAfterTalk(ferreiro, hans, 0, sut.state.now);
    sut.api.turnBackAfterTalk(ferreiro, jan, 0, sut.state.now);
    sut.state.dialogues.delete(1);
    sut.state.now += 2_000;
    sut.run();
    assert.equal(ferreiro.looked.length, 1, "Jan is still talking");
    sut.state.dialogues.delete(2);
    sut.state.now += 1_000;
    sut.run();
    assert.equal(ferreiro.looked.length, 2);
    assert.ok(Math.abs(ferreiro.looked[1].y - 210) < 1e-9, "yaw 0 is +Y");

    // A talk left open for more than two minutes turns it anyway.
    sut.state.dialogues.set(1, 10);
    sut.api.turnBackAfterTalk(ferreiro, hans, 0, sut.state.now);
    sut.state.now += 125_000;
    for (let at = 0; at < 130; at += 1) sut.run();
    assert.equal(ferreiro.looked.length, 3);
});
