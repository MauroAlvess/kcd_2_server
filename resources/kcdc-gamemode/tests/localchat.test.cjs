const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// The chat of T for the village or town (src/server/local-chat.ts, 2026-10-25)
// user: "as mensagens no T devem só chegar para a região, essa vila ou cidade; quem estiver mais longe não pode ver as mensagens"

const dist = (name) => fs.readFileSync(path.join(__dirname, "../dist/server", name), "utf8");

// Two villages, far apart; the open country between and around them.
const REGIONS = [
    { id: "suchdol", name: "Suchdol", minX: 0, maxX: 300, minY: 0, maxY: 300 },
    { id: "raborsch", name: "Raborsch", minX: 1000, maxX: 1300, minY: 0, maxY: 300 },
];

function body(id, x, y, over = {}) {
    return { id, nickname: `conta${id}`, ready: true, virtualWorld: 0, position: { x, y, z: 0 }, ...over };
}

function load({ regions = REGIONS, relayWorks = true, throwOnOff = false, mappedThrows = false } = {}) {
    const sent = [];
    const logs = [];
    const state = { relay: true, handlers: {}, mapped: 0, failFor: -1, everybody: [] };
    const Chat = {
        setDefaultRelay: (value) => {
            if (throwOnOff) throw new Error("sem relé");
            if (relayWorks) state.relay = value;
        },
        isDefaultRelay: () => state.relay,
        sendToPlayer: (player, text, options) => {
            if (player.id === state.failFor) throw new Error("saiu");
            sent.push({ to: player.id, text, author: options?.author, color: options?.color, options });
        },
    };
    const Events = { on: (name, fn) => { (state.handlers[name] ||= []).push(fn); } };
    const exportsOf = (file, extra, globals = {}) => {
        const exports = {};
        vm.runInNewContext(dist(file), { exports, require: (id) => extra[id] ?? {}, ...globals });
        return exports;
    };
    const place = exportsOf("place.js", {});
    const roleplay = exportsOf("roleplay.js", { "./acquaintances.js": { labelFor: () => "x" }, "./place.js": place });
    const properties = {
        mappedRegions: () => {
            state.mapped += 1;
            if (mappedThrows) throw new Error("mapa ilegível");
            return regions;
        },
    };
    const sut = exportsOf(
        "local-chat.js",
        { "./place.js": place, "./properties.js": properties, "./roleplay.js": roleplay },
        { Chat, Events, Player: { all: () => state.everybody }, console: { log: (line) => logs.push(line) } },
    );
    return { api: sut, sent, logs, state };
}

const idsOf = (players) => Array.from(players, (player) => player.id);

test("the framework's relay is switched off and the chat's handlers are put in", () => {
    const sut = load();
    assert.equal(sut.state.relay, true, "on until we take it");
    sut.api.installLocalChat();
    assert.equal(sut.state.relay, false);
    assert.deepEqual(Object.keys(sut.state.handlers).sort(), ["playerChat", "playerDisconnect", "resourceStop"]);
});

test("a relay that will not switch off, or throws, leaves the chat as it was: nothing is installed, nobody reads a line twice", () => {
    const stays = load({ relayWorks: false });
    stays.api.installLocalChat();
    assert.deepEqual(Object.keys(stays.state.handlers), []);
    assert.ok(stays.logs.some((line) => /relé do framework não se desligou/.test(line)), stays.logs.join("|"));

    const throws = load({ throwOnOff: true });
    throws.api.installLocalChat();
    assert.deepEqual(Object.keys(throws.state.handlers), []);
    assert.ok(throws.logs.some((line) => /não consegui desligar o relé/.test(line)), throws.logs.join("|"));
});

test("in a village everybody in it reads the line, wherever they stand in it, and nobody of another place", () => {
    const speaker = body(1, 10, 10);
    const sameSpot = body(2, 20, 10);
    const farCorner = body(3, 290, 290);
    const elsewhere = body(4, 1100, 100);
    const country = body(5, 600, 150);
    const sut = load();
    assert.deepEqual(idsOf(sut.api.readersOf(speaker, [speaker, sameSpot, farCorner, elsewhere, country])), [1, 2, 3], "the other village and the country between read nothing");
});

test("the gate of a village: a line is read within 30 m of the speaker whatever the regions, and not from 45 m", () => {
    const speaker = body(1, 290, 150);
    const outsideNear = body(2, 315, 150);
    const outsideFar = body(3, 335, 150);
    const sut = load();
    assert.deepEqual(idsOf(sut.api.readersOf(speaker, [speaker, outsideNear, outsideFar])), [1, 2]);
    // And the other way round: the one outside speaks, the one at the gate inside reads them from 25 m.
    const walker = body(4, 325, 150);
    const atGate = body(5, 300, 150);
    assert.deepEqual(idsOf(sut.api.readersOf(walker, [walker, atGate])), [4, 5]);
    // The edge of the near range itself is read.
    const edge = body(6, 150, 300);
    const thirty = body(7, 150, 330);
    const thirtyOne = body(8, 150, 331);
    assert.deepEqual(idsOf(sut.api.readersOf(edge, [edge, thirty, thirtyOne])), [6, 7]);
});

test("in the open country, both of them outside every village, a line carries 50 m and not farther", () => {
    const speaker = body(1, 600, 600);
    const fortyAway = body(2, 640, 600);
    const fiftyAway = body(3, 650, 600);
    const sixtyAway = body(4, 660, 600);
    const sut = load();
    assert.deepEqual(idsOf(sut.api.readersOf(speaker, [speaker, fortyAway, fiftyAway, sixtyAway])), [1, 2, 3]);
    assert.equal(sut.api.NEAR_M, 30);
    assert.equal(sut.api.OPEN_M, 50);
});

test("the open country does not reach into a village beyond the near range, nor does a village reach out into it", () => {
    const sut = load();
    const walker = body(1, 340, 150);
    const villager = body(2, 300, 150);
    assert.deepEqual(idsOf(sut.api.readersOf(walker, [walker, villager])), [1], "40 m apart, one in the village and one outside: not the village's, not the open country's");
    assert.deepEqual(idsOf(sut.api.readersOf(villager, [villager, walker])), [2]);
});

test("the speaker reads their own line even when the list leaves them out, first and once", () => {
    const speaker = body(1, 10, 10);
    const friend = body(2, 20, 20);
    const sut = load();
    assert.deepEqual(idsOf(sut.api.readersOf(speaker, [friend])), [1, 2]);
    assert.deepEqual(idsOf(sut.api.readersOf(speaker, [friend, speaker, speaker])), [1, 2]);
});

test("another world and a player still loading read nothing; a speaker whose body has not reported yet is read by nobody else", () => {
    const speaker = body(1, 10, 10);
    const otherWorld = body(2, 20, 10, { virtualWorld: 7 });
    const loading = body(3, 20, 10, { ready: false });
    const sut = load();
    assert.deepEqual(idsOf(sut.api.readersOf(speaker, [speaker, otherWorld, loading])), [1]);
    const early = body(4, 10, 10, { ready: false });
    assert.deepEqual(idsOf(sut.api.readersOf(early, [early, speaker])), [4]);
});

test("the global world, where the players are (never world 0), is one world", () => {
    const global = 4294967295;
    const speaker = body(1, 10, 10, { virtualWorld: global });
    const friend = body(2, 20, 10, { virtualWorld: global });
    const sut = load();
    assert.deepEqual(idsOf(sut.api.readersOf(speaker, [speaker, friend])), [1, 2]);
});

test("a point stands in the regions whose box holds it, edges included, and in none in the open country", () => {
    const sut = load();
    assert.deepEqual(Array.from(sut.api.regionsAt({ x: 0, y: 0 }), (zone) => zone.id), ["suchdol"]);
    assert.deepEqual(Array.from(sut.api.regionsAt({ x: 300, y: 300 }), (zone) => zone.id), ["suchdol"]);
    assert.deepEqual(Array.from(sut.api.regionsAt({ x: 1150, y: 20 }), (zone) => zone.name), ["Raborsch"]);
    assert.deepEqual(Array.from(sut.api.regionsAt({ x: 301, y: 100 })), []);
    assert.deepEqual(Array.from(sut.api.regionsAt({ x: -1, y: 100 })), []);
});

test("two villages whose outlines touch are both a place of whoever stands in the overlap, and a player there reads either", () => {
    const overlapping = [
        { id: "a", name: "Aldeia A", minX: 0, maxX: 120, minY: 0, maxY: 100 },
        { id: "b", name: "Aldeia B", minX: 100, maxX: 220, minY: 0, maxY: 100 },
    ];
    const sut = load({ regions: overlapping });
    const inA = body(1, 5, 50);
    const inB = body(2, 215, 50);
    const between = body(3, 110, 50);
    assert.deepEqual(idsOf(sut.api.readersOf(inA, [inA, inB, between])), [1, 3], "A reads the one between, not B's far end");
    assert.deepEqual(idsOf(sut.api.readersOf(between, [between, inA, inB])), [3, 1, 2], "the one between reads both villages");
});

test("a line goes out under the account's nickname, as one clean line, with no colour of ours", () => {
    const speaker = body(1, 10, 10);
    const friend = body(2, 20, 10);
    const sut = load();
    sut.state.everybody = [speaker, friend];
    assert.equal(sut.api.speak(speaker, "  bom   dia,\n\u0007 amigos  "), 2);
    const lines = sut.sent.filter((line) => line.text !== sut.api.NOTICE);
    assert.deepEqual(lines.map((line) => [line.to, line.text, line.author, line.color]), [[1, "bom dia, amigos", "conta1", undefined], [2, "bom dia, amigos", "conta1", undefined]]);
});

test("a line of only spaces is not sent to anybody and does not use up the notice", () => {
    const speaker = body(1, 10, 10);
    const sut = load();
    sut.state.everybody = [speaker];
    assert.equal(sut.api.speak(speaker, "   \n\t "), 0);
    assert.equal(sut.sent.length, 0);
    assert.equal(sut.logs.length, 0);
    sut.api.speak(speaker, "oi");
    assert.ok(sut.sent.some((line) => line.text === sut.api.NOTICE), "the first real line gets it");
});

test("a line longer than the page allows is refused to its writer alone, as the roleplay lines are, and nobody else reads it", () => {
    const speaker = body(1, 10, 10);
    const friend = body(2, 20, 10);
    const sut = load();
    sut.state.everybody = [speaker, friend];
    assert.equal(sut.api.CHAT_MAX, 400);
    assert.equal(sut.api.speak(speaker, "a".repeat(400)), 2, "the limit itself is read");
    assert.equal(sut.api.speak(speaker, `${"b".repeat(200)}   ${"c".repeat(202)}`), 0, "counted after the spaces are folded: 200 + 1 + 202");
    const refusals = sut.sent.filter((line) => /^Muito longo/.test(line.text));
    assert.deepEqual(refusals.map((line) => [line.to, line.text, line.author]), [[1, "Muito longo: no máximo 400 letras (você escreveu 403).", undefined]]);
    assert.ok(!sut.sent.some((line) => line.to === 2 && /b{200}/.test(line.text)));
    assert.equal(sut.logs.filter((line) => /^chat:/.test(line)).length, 1, "only the line that went out is logged");
});

test("the speaker is told how far the chat carries once per connection, without an author so that it is translated, and again after a disconnect", () => {
    const speaker = body(1, 10, 10);
    const friend = body(2, 20, 10);
    const sut = load();
    sut.api.installLocalChat();
    sut.state.everybody = [speaker, friend];
    const say = (text) => sut.state.handlers.playerChat[0](speaker, text);
    const notices = () => sut.sent.filter((line) => line.text === sut.api.NOTICE);
    say("primeira");
    assert.equal(notices().length, 1);
    assert.equal(notices()[0].to, 1, "only the speaker");
    assert.equal(notices()[0].author, undefined, "a system line, so the English player reads it in English");
    say("segunda");
    say("terceira");
    assert.equal(notices().length, 1);
    sut.state.handlers.playerDisconnect[0](speaker);
    say("de novo");
    assert.equal(notices().length, 2);
    assert.match(sut.api.NOTICE, /30 metros/);
    assert.match(sut.api.NOTICE, /50 metros/);
});

test("a reader who cannot be reached does not stop the others", () => {
    const speaker = body(1, 10, 10);
    const gone = body(2, 20, 10);
    const stays = body(3, 30, 10);
    const sut = load();
    sut.state.everybody = [speaker, gone, stays];
    sut.state.failFor = 2;
    sut.api.speak(speaker, "alguém?");
    assert.deepEqual(sut.sent.filter((line) => line.text === "alguém?").map((line) => line.to), [1, 3]);
});

test("a failure in a delivery is logged and never thrown at the framework", () => {
    const speaker = body(1, 10, 10);
    const sut = load();
    sut.api.installLocalChat();
    sut.state.everybody = null;
    assert.doesNotThrow(() => sut.state.handlers.playerChat[0](speaker, "oi"));
    assert.ok(sut.logs.some((line) => /falhou ao entregar uma linha de conta1/.test(line)), sut.logs.join("|"));
});

test("the log says where it was said and how many read it, never what was said", () => {
    const speaker = body(1, 10, 10);
    const near = body(2, 20, 10);
    const far = body(3, 1100, 100);
    const other = body(4, 20, 10, { virtualWorld: 5 });
    const sut = load();
    sut.state.everybody = [speaker, near, far, other];
    sut.api.speak(speaker, "segredo do ferreiro");
    const line = sut.logs.find((one) => /^chat:/.test(one));
    assert.equal(line, "chat: conta1 em Suchdol: lido por 1 de 2");
    assert.ok(!sut.logs.some((one) => /segredo/.test(one)));
    const lost = body(9, 600, 600);
    sut.state.everybody = [lost];
    sut.api.speak(lost, "sozinho");
    assert.ok(sut.logs.some((one) => one === "chat: conta9 em campo aberto: lido por 0 de 0"), sut.logs.join("|"));
});

test("the map is read once however many lines are said, and a map that cannot be read leaves only the distance", () => {
    const speaker = body(1, 10, 10);
    const friend = body(2, 20, 10);
    const sut = load();
    sut.state.everybody = [speaker, friend];
    for (let i = 0; i < 5; i += 1) sut.api.speak(speaker, `linha ${i}`);
    assert.equal(sut.state.mapped, 1);

    const broken = load({ mappedThrows: true });
    broken.state.everybody = [speaker, friend, body(3, 1100, 100)];
    assert.equal(broken.api.speak(speaker, "oi"), 2, "the one 1000 m away reads nothing; the one 10 m away does");
    assert.equal(broken.logs.filter((line) => /não consegui ler as regiões do mapa/.test(line)).length, 1);
    broken.api.speak(speaker, "de novo");
    assert.equal(broken.state.mapped, 1, "not asked again");
    assert.equal(broken.logs.filter((line) => /não consegui ler as regiões do mapa/.test(line)).length, 1, "and not said again");
});

test("when the resource stops alone the chat goes back to the framework, and another resource stopping changes nothing", () => {
    const sut = load();
    sut.api.installLocalChat();
    assert.equal(sut.state.relay, false);
    sut.state.handlers.resourceStop[0]("outro-recurso");
    assert.equal(sut.state.relay, false);
    sut.state.handlers.resourceStop[0]("kcdc-gamemode");
    assert.equal(sut.state.relay, true);
});
