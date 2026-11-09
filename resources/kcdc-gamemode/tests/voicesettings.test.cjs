"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

// How each player's microphone opens, and the radius of the three voices (src/server/voice-settings.ts, 2026-10-23): the client asks once it is
// in the world, says what it chose, and is answered with what the server keeps and how far a whisper, a word and a shout carry.

const GET = "kcdc-gamemode:voice.get";
const SET = "kcdc-gamemode:voice.set";
const STATE = "kcdc-gamemode:voice.state";

function load({ tiers = [3, 15, 25], throws = false } = {}) {
    const files = new Map();
    const disk = {
        readFileSync(file) {
            if (!files.has(file)) throw new Error("ENOENT");
            return files.get(file);
        },
        writeFileSync(file, data) { files.set(file, data); },
        mkdirSync() {},
        renameSync(from, to) { files.set(to, files.get(from)); files.delete(from); },
        existsSync: (file) => files.has(file),
    };
    const store = { exports: {}, require: () => disk };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/store.js"), "utf8"), store);
    const options = { exports: {}, require: () => store.exports, console, Events: { onClient() {} } };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/options.js"), "utf8"), options);

    const clients = new Map();
    const state = { tiers, throws };
    const context = {
        exports: {},
        require: (id) => (id === "./options.js" ? options.exports : assert.fail(`unexpected require ${id}`)),
        console,
        Number,
        Math,
        JSON,
        Events: { onClient: (name, fn) => clients.set(name, fn) },
        Voice: { getTierRange: (tier) => { if (state.throws) throw new Error("no voice"); return state.tiers[tier]; } },
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/voice-settings.js"), "utf8"), context);
    context.exports.installVoiceSettings();
    const player = (steamId) => ({ steamId, sent: [], emit(name, payload) { this.sent.push({ name, payload: JSON.parse(payload) }); } });
    const saved = () => JSON.parse(files.get("playerdata/options.json"));
    return { api: context.exports, clients, state, player, saved, files };
}

test("somebody who never chose is told the microphone is held (on H), at a middle sensitivity, and how far each voice carries", () => {
    const sut = load();
    const hans = sut.player("76561198000000001");
    sut.clients.get(GET)(hans);
    assert.deepEqual(hans.sent, [{ name: STATE, payload: { mic: "apertar", sensitivity: "media", ranges: [3, 15, 25] } }]);
});

test("a choice is kept by Steam id, answered with the whole of what is kept, and wrong or missing fields leave what was there", () => {
    const sut = load();
    const hans = sut.player("76561198000000001");
    sut.clients.get(SET)(hans, JSON.stringify({ mic: "aberto", sensitivity: "alta" }));
    assert.deepEqual(hans.sent.at(-1).payload, { mic: "aberto", sensitivity: "alta", ranges: [3, 15, 25] });
    assert.deepEqual(sut.saved()["76561198000000001"], { thirdPerson: false, view: "normal", mic: "aberto", sensitivity: "alta", ui: "100" });

    sut.clients.get(SET)(hans, { mic: "gritando", sensitivity: "baixa" });
    assert.deepEqual(hans.sent.at(-1).payload, { mic: "aberto", sensitivity: "baixa", ranges: [3, 15, 25] }, "the sensitivity changed, the mode nobody knows did not");
    sut.clients.get(SET)(hans, "not json");
    sut.clients.get(SET)(hans, "x".repeat(400));
    assert.deepEqual(hans.sent.at(-1).payload, { mic: "aberto", sensitivity: "baixa", ranges: [3, 15, 25] });

    const other = sut.player("76561198000000002");
    sut.clients.get(GET)(other);
    assert.equal(other.sent[0].payload.mic, "apertar", "one player's choice is theirs alone");
});

test("the radii are the server's own, rounded; one that is not a distance, or a server that cannot say, gives the framework's", () => {
    const sut = load({ tiers: [2.6, 12.4, 40] });
    const hans = sut.player("76561198000000001");
    sut.clients.get(GET)(hans);
    assert.deepEqual(hans.sent[0].payload.ranges, [3, 12, 40]);

    sut.state.tiers = [0, Number.NaN, -5];
    sut.clients.get(GET)(hans);
    assert.deepEqual(hans.sent[1].payload.ranges, [3, 15, 25]);

    sut.state.throws = true;
    sut.clients.get(GET)(hans);
    assert.deepEqual(hans.sent[2].payload.ranges, [3, 15, 25]);
});

test("somebody with no Steam id keeps nothing but is told what they chose, for as long as they are here", () => {
    const sut = load();
    const nobody = sut.player("");
    sut.clients.get(SET)(nobody, { mic: "aberto", sensitivity: "alta" });
    assert.deepEqual(nobody.sent.at(-1).payload, { mic: "aberto", sensitivity: "alta", ranges: [3, 15, 25] });
    assert.equal(sut.files.has("playerdata/options.json"), false);
    sut.clients.get(SET)(nobody, { mic: "turbo" });
    assert.equal(nobody.sent.at(-1).payload.mic, "apertar", "a wrong mode is the default for them");
});
