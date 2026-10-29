// An announced restart (src/server/restart-notice.ts): warnings, no new games, the games settled and everybody saved first.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const FILE = "playerdata/restart-notice.json";

function load() {
    const files = new Map();
    const timeouts = [];
    const logs = [];
    const players = [{ nickname: "Erik", chat: [], emit() {} }, { nickname: "Elisabeth", chat: [], emit() {} }];
    const context = {
        exports: {},
        require: (id) => {
            assert.equal(id, "./store.js");
            return { read: (file) => (files.has(file) ? { status: "ok", value: JSON.parse(files.get(file)), fromBackup: false } : { status: "missing" }) };
        },
        console: { log: (line) => logs.push(line) },
        Date,
        setInterval: () => 1,
        clearInterval() {},
        setTimeout: (fn, ms) => timeouts.push({ fn, ms }),
        Events: { on() {} },
        Player: { all: () => players },
        Chat: { sendToPlayer: (player, text) => player.chat.push(text) },
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/restart-notice.js"), "utf8"), context);
    context.exports.installRestartNotice();
    return { api: context.exports, files, timeouts, logs, players, announce: (at) => files.set(FILE, JSON.stringify({ at })) };
}

test("a restart a minute away is told to everybody at 60, 30 and 10 seconds, and nothing new starts meanwhile", () => {
    const sut = load();
    const T = 10_000_000;
    sut.api.look(T - 70_000);
    assert.equal(sut.api.restartPending(T - 70_000), false, "no notice, nothing pending");
    sut.announce(T);
    sut.api.look(T - 60_000);
    assert.equal(sut.api.restartPending(T - 60_000), true);
    assert.deepEqual(sut.players[0].chat, [sut.api.warningText(60)]);
    assert.match(sut.players[0].chat[0], /reiniciar em 1 minuto/);
    sut.api.look(T - 58_000);
    assert.equal(sut.players[0].chat.length, 1, "said once per mark");
    sut.api.look(T - 29_000);
    sut.api.look(T - 10_000);
    assert.deepEqual(sut.players[1].chat.slice(1), [sut.api.warningText(29), sut.api.warningText(10)]);
});

test("a notice found late is one warning, not three", () => {
    const sut = load();
    const T = 10_000_000;
    sut.announce(T);
    sut.api.look(T - 9_500);
    assert.deepEqual(sut.players[0].chat, [sut.api.warningText(10)]);
});

test("eight seconds before, the games are settled, and a moment later everybody is saved", () => {
    const sut = load();
    const T = 10_000_000;
    const done = [];
    sut.api.onRestartSettle(() => { done.push("dados"); return "1 partida"; });
    sut.api.onRestartSettle(() => { throw new Error("quebrou"); });
    sut.api.onRestartSave(() => { done.push("salvar"); return "2 personagens"; });
    sut.announce(T);
    sut.api.look(T - 20_000);
    assert.deepEqual(done, []);
    sut.api.look(T - 8_000);
    assert.deepEqual(done, ["dados"], "one that fails does not keep the others from running");
    assert.equal(sut.timeouts[0].ms, sut.api.SAVE_AFTER_SETTLE_MS);
    sut.timeouts[0].fn();
    assert.deepEqual(done, ["dados", "salvar"]);
    sut.api.look(T - 6_000);
    assert.equal(done.length, 2, "settled once");
    assert.ok(sut.logs.some((line) => /um preparo falhou: .*quebrou/.test(line)));
});

test("a notice whose moment passed long ago is stale: nothing is pending any more", () => {
    const sut = load();
    const T = 10_000_000;
    sut.announce(T);
    sut.api.look(T - 30_000);
    assert.equal(sut.api.restartPending(T + 60_000), true);
    assert.equal(sut.api.restartPending(T + 3 * 60_000), false);
});

test("a note in the notice file goes on the end of every warning, so a deploy can say what the players must do after", () => {
    const sut = load();
    const T = 10_000_000;
    sut.files.set(FILE, JSON.stringify({ at: T, note: "Depois, feche o jogo e abra o launcher." }));
    sut.api.look(T - 60_000);
    assert.equal(sut.players[0].chat[0], sut.api.warningText(60, "Depois, feche o jogo e abra o launcher."));
    assert.match(sut.players[0].chat[0], /o que estiver em jogo volta para cada um\. Depois, feche o jogo/);
    sut.files.set(FILE, JSON.stringify({ at: T, note: 5 }));
    sut.api.look(T - 29_000);
    assert.equal(sut.players[0].chat.at(-1), sut.api.warningText(29), "a note that is not text is ignored");
});
