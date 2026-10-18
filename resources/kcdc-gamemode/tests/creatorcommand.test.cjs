// /creator (src/server/commands/creator.ts): the creator proper, the game's own stage, stop, and the camera's tuning.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const plain = (value) => JSON.parse(JSON.stringify(value));

function load({ saved = {}, admins = [], closeAnswers = [] } = {}) {
    const calls = { opened: [], closed: [], tuned: [], native: [], chat: [], usage: 0, emitted: [] };
    const handlers = new Map();
    const modules = {
        "../characters.js": { getCharacter: (steamId) => saved[steamId] ?? null, saveCharacter: () => {} },
        "../creator.js": {
            openCreatorFor: (player, genders) => calls.opened.push({ id: player.id, genders }),
            closeCreatorFor: (player) => {
                calls.closed.push(player.id);
                return closeAnswers.length ? closeAnswers.shift() : true;
            },
            tuneCreatorFor: (player, tuning) => calls.tuned.push({ id: player.id, tuning: plain(tuning) }),
        },
        "../auth.js": { isAdmin: (player) => admins.includes(player.steamId) },
        "../kits.js": { ensureStarter() {} },
    };
    const context = {
        exports: {},
        require: (id) => modules[id] ?? assert.fail(`unexpected require ${id}`),
        Chat: { sendToPlayer: (player, text) => calls.chat.push({ id: player.id, text }) },
        Events: { onClient: (name, fn) => handlers.set(name, fn), on: (name, fn) => handlers.set(name, fn) },
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/commands/creator.js"), "utf8"), context);
    const run = (player, ...args) => context.exports.creatorCommand.run({ player, args, usage: () => { calls.usage += 1; } });
    const player = (id, steamId) => ({ id, steamId, nickname: `P${id}`, emit: (event, payload) => calls.emitted.push({ id, event, payload: payload === undefined ? undefined : JSON.parse(payload) }) });
    return { calls, run, player, api: context.exports };
}

test("/creator opens the creator, for both genders or one", () => {
    const sut = load();
    const hans = sut.player(1, "765");
    sut.run(hans);
    sut.run(hans, "female");
    assert.deepEqual(sut.calls.opened, [{ id: 1, genders: "both" }, { id: 1, genders: "female" }]);
    sut.run(hans, "other");
    sut.run(hans, "male", "extra");
    assert.equal(sut.calls.usage, 2);
    assert.equal(sut.calls.opened.length, 2);
});

test("/creator nativo opens the game's own stage, which a newcomer cannot back out of and anybody else can", () => {
    const sut = load({ saved: { 765: { appearance: {} } } });
    const newcomer = sut.player(1, "764");
    const old = sut.player(2, "765");
    sut.run(newcomer, "nativo");
    sut.run(old, "nativo", "male");
    assert.deepEqual(sut.calls.emitted.map((entry) => [entry.id, entry.event, entry.payload]), [
        [1, "kcdc-gamemode:creator.open", { genders: "both", mandatory: true }],
        [2, "kcdc-gamemode:creator.open", { genders: "male", mandatory: false }],
    ]);
    assert.equal(sut.calls.opened.length, 0, "the page was not opened");
});

test("/creator stop closes both, unless a newcomer asks: the creator says no", () => {
    const sut = load({ closeAnswers: [true, false] });
    const hans = sut.player(1, "765");
    sut.run(hans, "stop");
    assert.deepEqual(sut.calls.emitted.map((entry) => entry.event), ["kcdc-gamemode:creator.close"], "the game's stage is told to close too");
    sut.run(hans, "stop");
    assert.equal(sut.calls.emitted.length, 1, "refused: nothing more is closed");
    assert.deepEqual(sut.calls.closed, [1, 1]);
});

test("/creator camera is the administrator's: numbers in order, each within its range, and nothing for anybody else", () => {
    const sut = load({ admins: ["764"] });
    const boss = sut.player(1, "764");
    const hans = sut.player(2, "765");

    sut.run(hans, "camera", "4");
    assert.deepEqual(sut.calls.tuned, []);
    assert.match(sut.calls.chat.at(-1).text, /só do administrador/);

    sut.run(boss, "camera", "4,5", "0.3", "40", "-0.1", "3");
    assert.deepEqual(sut.calls.tuned.at(-1), { id: 1, tuning: { distance: 4.5, figure: 0.3, fov: 40, aim: -0.1, light: 3 } }, "the comma is a decimal point too");
    sut.run(boss, "camera", "2");
    assert.deepEqual(sut.calls.tuned.at(-1).tuning, { distance: 2 }, "the numbers not given are left as they are");

    const tunedBefore = sut.calls.tuned.length;
    for (const bad of [["camera", "99"], ["camera", "3", "2"], ["camera", "3", "0.3", "10"], ["camera", "abc"], ["camera", "3", "0.3", "40", "0", "5", "6"]]) {
        sut.run(boss, ...bad);
    }
    assert.equal(sut.calls.tuned.length, tunedBefore, "a number out of range, or too many, sends nothing");
    assert.match(sut.calls.chat.at(-1).text, /números demais/);
    assert.match(sut.calls.chat.at(-3).text, /fov precisa estar entre 20 e 70/);

    sut.run(boss, "camera");
    assert.equal(sut.calls.tuned.length, tunedBefore, "no numbers: only the help, never a reset");
    assert.match(sut.calls.chat.at(-1).text, /a ordem é distancia, figura, fov, altura, luz/);
    sut.run(boss, "camera", "padrao");
    assert.deepEqual(sut.calls.tuned.at(-1), { id: 1, tuning: {} });
    assert.match(sut.calls.chat.at(-1).text, /voltou ao padrão/);
});
