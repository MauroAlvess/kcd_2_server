"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

// A horse sent to follow its owner (src/server/horse-follow.ts, 2026-10-22: "mandar seguir e mandar ficar; o mandar ficar só para de seguir e
// continua indo se usar o assobiar"): the framework gives a horse only `moveTo`, so the server walks it after the owner.

const plain = (value) => JSON.parse(JSON.stringify(value));

function load() {
    const state = { handlers: new Map(), intervals: [], chat: [], horses: new Map(), players: new Map(), moveOk: true, notices: [], language: "pt" };
    const context = {
        exports: {},
        require: (id) => (id === "./language.js" ? { languageOf: () => state.language, translate: (text, lang) => (lang === "en" ? `[en] ${text}` : text) } : assert.fail(`unexpected require ${id}`)),
        console: { log() {} },
        Date,
        setInterval: (fn, ms) => { state.intervals.push({ fn, ms }); return state.intervals.length; },
        clearInterval() {},
        Events: { on: (name, fn) => state.handlers.set(name, [...(state.handlers.get(name) ?? []), fn]) },
        Chat: { sendToPlayer: (player, text) => state.chat.push(text) },
        Horse: { getById: (id) => state.horses.get(id) ?? null },
        Player: { getById: (id) => state.players.get(id) ?? null },
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/horse-follow.js"), "utf8"), context);
    context.exports.installHorseFollow();
    let next = 10;
    const horse = (x = 30, y = 0) => {
        const made = {
            id: next++,
            name: "Carpiado",
            alive: true,
            mounted: false,
            unconscious: false,
            position: { x, y, z: 0 },
            navigationStatus: "idle",
            moves: [],
            holds: 0,
            moveTo(to, options) { this.moves.push({ to: { x: to.x, y: to.y }, options: plain(options) }); if (state.moveOk) this.navigationStatus = "running"; return state.moveOk; },
            hold() { this.holds += 1; this.navigationStatus = "idle"; },
        };
        state.horses.set(made.id, made);
        return made;
    };
    const owner = (x = 0, y = 0) => {
        const made = { id: 1, ready: true, alive: true, horse: null, position: { x, y, z: 0 }, emit: (event, payload) => state.notices.push(JSON.parse(payload).text) };
        state.players.set(made.id, made);
        return made;
    };
    const tick = () => context.exports.followTick();
    return { api: context.exports, state, horse, owner, tick };
}

test("a horse sent to follow starts at once, running when far behind, jogging when not so far, walking when near; it stops a few steps short", () => {
    const sut = load();
    const hans = sut.owner(0, 0);
    const far = sut.horse(30, 0);
    const result = sut.api.startFollowing(far, hans);
    assert.equal(result.ok, true);
    assert.match(result.message, /Carpiado vai seguir você\. Em "Ficar" ele para; o assobio \(X\) continua chamando\./);
    assert.deepEqual(far.moves, [{ to: { x: 0, y: 0 }, options: { speed: "run", radius: 3 } }], "sent at once, not at the next look");
    assert.equal(sut.api.isFollowing(far), true);

    assert.equal(sut.api.speedFor(20), "run");
    assert.equal(sut.api.speedFor(10), "jog");
    assert.equal(sut.api.speedFor(5), "walk");
    assert.equal(sut.api.speedFor(14), "jog", "not further than 14");
    assert.equal(sut.api.speedFor(7), "walk", "not further than 7");
});

test("a horse near its owner is left where it is; one far behind is sent, and not again while it runs and the owner stays near where it was sent", () => {
    const sut = load();
    const hans = sut.owner(0, 0);
    const near = sut.horse(3, 0);
    sut.api.startFollowing(near, hans);
    sut.tick();
    assert.deepEqual(near.moves, [], "within three and a half metres: nothing");

    const horse = sut.horse(20, 0);
    sut.api.startFollowing(horse, hans);
    assert.equal(horse.moves.length, 1);
    sut.tick();
    sut.tick();
    assert.equal(horse.moves.length, 1, "it is running to where the owner was");
    hans.position = { x: 2, y: 0, z: 0 };
    sut.tick();
    assert.equal(horse.moves.length, 1, "the owner moved only two metres: still the same order");
    hans.position = { x: 8, y: 0, z: 0 };
    sut.tick();
    assert.equal(horse.moves.length, 2, "six metres on: a new order, to where they are");
    assert.deepEqual(horse.moves[1].to, { x: 8, y: 0 });

    horse.navigationStatus = "reached";
    horse.position = { x: 20, y: 0, z: 0 };
    sut.tick();
    assert.equal(horse.moves.length, 3, "an order that ended with the owner far off is given again");
});

test("it follows an owner who is riding another horse, and stops when they get on this one", () => {
    const sut = load();
    const hans = sut.owner(0, 0);
    const horse = sut.horse(20, 0);
    sut.api.startFollowing(horse, hans);
    hans.horse = { id: 999 };
    hans.position = { x: 40, y: 0, z: 0 };
    sut.tick();
    assert.equal(horse.moves.length, 2, "after them, trailing");
    hans.horse = horse;
    const before = horse.moves.length;
    sut.tick();
    assert.equal(sut.api.isFollowing(horse), false, "the owner is in its saddle: there is nothing to follow");
    assert.equal(horse.moves.length, before);
    assert.equal(horse.holds, 0, "and it is not held: the owner rides it");
});

test("Ficar holds the horse where it stands and stops the following; a horse that was not following is not held", () => {
    const sut = load();
    const hans = sut.owner(0, 0);
    const horse = sut.horse(20, 0);
    sut.api.startFollowing(horse, hans);
    assert.equal(sut.api.stopFollowing(horse), true);
    assert.equal(horse.holds, 1);
    assert.equal(sut.api.isFollowing(horse), false);
    const count = horse.moves.length;
    sut.tick();
    assert.equal(horse.moves.length, count, "no more orders");
    assert.equal(sut.api.stopFollowing(horse), false);
    assert.equal(horse.holds, 1, "not held a second time");
    sut.api.startFollowing(horse, hans);
    assert.equal(sut.api.stopFollowing(horse.id, false), true, "by id, without holding it");
    assert.equal(horse.holds, 1);
});

test("a horse that is dead, ridden, knocked out or not the owner's to send is not sent, and says why", () => {
    const sut = load();
    const hans = sut.owner(0, 0);
    const dead = sut.horse();
    dead.alive = false;
    assert.equal(sut.api.startFollowing(dead, hans).ok, false);
    const ridden = sut.horse();
    ridden.mounted = true;
    assert.equal(sut.api.startFollowing(ridden, hans).ok, false);
    const down = sut.horse();
    down.unconscious = true;
    assert.match(sut.api.startFollowing(down, hans).message, /Carpiado não pode seguir agora\./);
    const under = sut.horse();
    hans.horse = under;
    assert.match(sut.api.startFollowing(under, hans).message, /Você está montado nele: desça para mandá-lo seguir\./);
    for (const one of [dead, ridden, down, under]) assert.equal(sut.api.isFollowing(one), false);
});

test("the following ends, quietly, for a horse that dies, is mounted by somebody, is knocked out or is taken away", () => {
    const sut = load();
    const hans = sut.owner(0, 0);
    const a = sut.horse(20, 0);
    const b = sut.horse(20, 5);
    const c = sut.horse(20, 10);
    const d = sut.horse(20, 15);
    for (const one of [a, b, c, d]) sut.api.startFollowing(one, hans);
    a.alive = false;
    b.mounted = true;
    c.unconscious = true;
    sut.state.horses.delete(d.id);
    sut.tick();
    for (const one of [a, b, c, d]) assert.equal(sut.api.isFollowing(one), false);
    assert.deepEqual(sut.state.chat, [], "nothing is said");
    // A saddle taken by the game's own mount event, and a destroyed horse, end it too.
    const e = sut.horse(20, 20);
    sut.api.startFollowing(e, hans);
    sut.state.handlers.get("horseMount")[0](e);
    assert.equal(sut.api.isFollowing(e), false);
    const f = sut.horse(20, 25);
    sut.api.startFollowing(f, hans);
    sut.state.handlers.get("horseDestroy")[0](f);
    assert.equal(sut.api.isFollowing(f), false);
});

test("the owner dying, not being in the world or leaving ends the following and holds the horse", () => {
    const sut = load();
    const hans = sut.owner(0, 0);
    const a = sut.horse(20, 0);
    sut.api.startFollowing(a, hans);
    hans.alive = false;
    sut.tick();
    assert.equal(sut.api.isFollowing(a), false);
    assert.equal(a.holds, 1);

    hans.alive = true;
    const b = sut.horse(20, 5);
    sut.api.startFollowing(b, hans);
    sut.state.handlers.get("playerDisconnect")[0](hans);
    assert.equal(sut.api.isFollowing(b), false);
    assert.equal(b.holds, 1);
});

test("a horse left behind by more than a hundred and twenty metres is held, and the owner told to whistle", () => {
    const sut = load();
    const hans = sut.owner(0, 0);
    const horse = sut.horse(20, 0);
    sut.api.startFollowing(horse, hans);
    hans.position = { x: 200, y: 0, z: 0 };
    sut.tick();
    assert.equal(sut.api.isFollowing(horse), false);
    assert.equal(horse.holds, 1);
    assert.match(sut.state.notices.at(-1), /Carpiado ficou para trás, longe demais\. Assobie \(X\) para chamá-lo\./);
    assert.match(sut.state.chat.at(-1), /longe demais/);
});

test("the toast of an owner who chose English goes through the translation, as the chat does", () => {
    const sut = load();
    sut.state.language = "en";
    const hans = sut.owner(0, 0);
    const horse = sut.horse(20, 0);
    sut.api.startFollowing(horse, hans);
    hans.position = { x: 200, y: 0, z: 0 };
    sut.tick();
    assert.match(sut.state.notices.at(-1), /^\[en\] Carpiado ficou para trás, longe demais\./);
});

test("a horse the mesh gives no way for three orders in a row is let be, and the owner told to whistle", () => {
    const sut = load();
    const hans = sut.owner(0, 0);
    sut.state.moveOk = false;
    const horse = sut.horse(30, 0);
    sut.api.startFollowing(horse, hans);
    sut.tick();
    sut.tick();
    assert.equal(sut.api.isFollowing(horse), true, "two failed orders: still trying");
    sut.tick();
    sut.tick();
    assert.equal(sut.api.isFollowing(horse), false);
    assert.match(sut.state.notices.at(-1), /Carpiado não achou caminho até você e parou\. Assobie \(X\) para chamá-lo\./);
    assert.equal(horse.holds, 1);
});

test("orders that end blocked count against it unless the horse got nearer, and arriving starts the count again", () => {
    const sut = load();
    const hans = sut.owner(0, 0);
    const horse = sut.horse(30, 0);
    sut.api.startFollowing(horse, hans);
    const done = sut.state.handlers.get("horseIntentDone")[0];
    done(horse, "blocked");
    sut.tick();
    assert.equal(horse.moves.length, 2, "sent again after a blocked order");
    done(horse, "blocked");
    horse.position = { x: 22, y: 0, z: 0 };
    sut.tick();
    assert.equal(sut.api.isFollowing(horse), true, "it had got eight metres nearer: the count starts again");
    done(horse, "failed");
    done(horse, "blocked");
    done(horse, "blocked");
    sut.tick();
    assert.equal(sut.api.isFollowing(horse), false, "three in a row with no progress: let be");

    const other = sut.horse(30, 40);
    sut.api.startFollowing(other, hans);
    done(other, "blocked");
    done(other, "blocked");
    done(other, "reached");
    done(other, "blocked");
    sut.tick();
    assert.equal(sut.api.isFollowing(other), true, "arriving once wiped the count");
    done(sut.horse(), "blocked");
});

test("stopping the resource clears every following and the look that runs them", () => {
    const sut = load();
    const hans = sut.owner(0, 0);
    const horse = sut.horse(20, 0);
    sut.api.startFollowing(horse, hans);
    assert.equal(sut.state.intervals[0].ms, 1_200);
    for (const fn of sut.state.handlers.get("resourceStop")) fn("other");
    assert.equal(sut.api.isFollowing(horse), true);
    for (const fn of sut.state.handlers.get("resourceStop")) fn("kcdc-gamemode");
    assert.equal(sut.api.isFollowing(horse), false);
});
