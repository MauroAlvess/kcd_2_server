const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// The posts of the townsfolk who only stand and talk (src/server/townsfolk.ts): the barbers and the teachers.

class FakeVector3 {
    constructor(x, y, z) { this.x = x; this.y = y; this.z = z; }
}

function load({ navigationReady = true } = {}) {
    const state = { timers: [], handlers: new Map(), npcs: new Map(), logs: [], talks: [], next: 500, intervals: [], clock: 10_000_000, hour: 12, players: [], cleared: [] };
    const context = {
        exports: {},
        console: { log: (line) => state.logs.push(line), error: (line) => state.logs.push(line) },
        Vector3: FakeVector3,
        setTimeout: (fn, ms) => { state.timers.push({ fn, ms, done: false }); return state.timers.length; },
        clearTimeout: (id) => { if (state.timers[id - 1]) state.timers[id - 1].done = true; },
        Navigation: { get ready() { return navigationReady; }, closestPoint: (point) => new FakeVector3(point.x, point.y, point.z + 0.5), randomPoint: (centre, radius) => new FakeVector3(centre.x + radius / 2, centre.y, centre.z) },
        setInterval: (fn, ms) => { state.intervals.push({ fn, ms }); return state.intervals.length; },
        clearInterval: (id) => state.cleared.push(id),
        World: { get hour() { return state.hour; } },
        Player: { all: () => state.players },
        Date: { now: () => state.clock },
        Math: Object.create(Math, { random: { value: () => 0.5 } }),
        Events: { on: (name, fn) => state.handlers.set(name, fn) },
        Npc: {
            create: (options) => {
                const npc = {
                    id: state.next++, options, looked: [], removed: false, alive: true, status: "idle", walks: [], said: [], anims: [], holds: 0, wearing: options.outfit ? ["x"] : [], outfits: [],
                    position: { ...options.position },
                    lookAt(target) { this.looked.push(target.id); },
                    setNametagHealthVisible(on) { this.health = on; },
                    moveTo(target, how) { this.walks.push({ x: target.x, y: target.y, how }); return true; },
                    hold() { this.holds += 1; },
                    playAnimation(fragment, how) { this.anims.push({ fragment, tags: how?.tags }); return true; },
                    say(text) { this.said.push(text); return true; },
                    setOutfit(preset) { this.outfits.push(preset); this.wearing = [preset]; return true; },
                    remove() { this.removed = true; state.npcs.delete(this.id); },
                };
                state.npcs.set(npc.id, npc);
                return npc;
            },
            getById: (id) => state.npcs.get(id) ?? null,
        },
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/townsfolk.js"), "utf8"), context);
    return { api: context.exports, state };
}

const POSTS = [
    { id: "a", name: "Barbeiro", soul: "townsman", x: 10, y: 20, z: 30 },
    { id: "b", name: "Mestra", soul: "townswoman", x: 40, y: 50, z: 60, yaw: 90 },
];

test("a post's body is made a little after the start, on the walkable ground by the spot, nobody's loot and with nothing over its head", () => {
    const sut = load();
    const posts = sut.api.installPosts("posts", POSTS, () => {});
    assert.equal(sut.state.npcs.size, 0, "the level is not up yet");
    assert.equal(sut.state.timers[0].ms, sut.api.SPAWN_AFTER_MS);
    sut.state.timers[0].fn();
    const bodies = [...sut.state.npcs.values()];
    assert.equal(bodies.length, 2);
    assert.deepEqual(bodies.map((npc) => [npc.options.name, npc.options.soul, npc.options.position.z, npc.options.rotation.z]), [["Barbeiro", "townsman", 30.5, 0], ["Mestra", "townswoman", 60.5, 90]]);
    assert.ok(bodies.every((npc) => npc.options.interactable && npc.options.invulnerable && npc.options.lootable === false && npc.options.nametag === false && npc.health === false));
    assert.deepEqual([...posts.standing().keys()], ["a", "b"]);
    assert.ok(sut.state.logs.some((line) => line === "posts: 2 de 2 no lugar"));
});

test("with no navigation mesh the body goes on the spot itself", () => {
    const sut = load({ navigationReady: false });
    sut.api.installPosts("posts", POSTS, () => {});
    sut.state.timers[0].fn();
    assert.equal([...sut.state.npcs.values()][0].options.position.z, 30);
});

test("the use key on a post's body looks at the player and calls what the post does; any other body is left alone", () => {
    const sut = load();
    const talks = [];
    sut.api.installPosts("posts", POSTS, (player, post, npc) => talks.push([player.id, post.id, npc.id]));
    sut.state.timers[0].fn();
    const [first] = [...sut.state.npcs.values()];
    sut.state.handlers.get("npcInteract")(first, { id: 7 });
    assert.deepEqual(talks, [[7, "a", first.id]]);
    assert.deepEqual(first.looked, [7]);
    sut.state.handlers.get("npcInteract")({ id: 9999, lookAt() { throw new Error("not ours"); } }, { id: 8 });
    assert.equal(talks.length, 1);
});

test("one brought down is made again a moment later, and stopping the resource takes every body away", () => {
    const sut = load();
    sut.api.installPosts("posts", POSTS, () => {});
    sut.state.timers[0].fn();
    const [first] = [...sut.state.npcs.values()];
    sut.state.handlers.get("npcDeath")(first);
    const revive = sut.state.timers.at(-1);
    assert.equal(revive.ms, sut.api.REVIVE_AFTER_MS);
    revive.fn();
    assert.equal(first.removed, true, "the body that fell is taken away");
    assert.equal(sut.state.npcs.size, 2, "and another stands in its place");

    sut.state.handlers.get("resourceStop")("another");
    assert.equal(sut.state.npcs.size, 2);
    sut.state.handlers.get("resourceStop")("kcdc-gamemode");
    assert.equal(sut.state.npcs.size, 0);
});

// ---------------------------------------------------------------------------------------------
// A post's day, and a body found bare.

const person = (id, x, y) => ({ id, ready: true, alive: true, virtualWorld: 0, position: { x, y, z: 30 } });

function started() {
    const sut = load();
    const handle = sut.api.installPosts("posts", POSTS, () => {});
    sut.state.timers[0].fn();
    sut.api.installPostLife(handle, ["Venha ver."]);
    const tick = () => sut.state.intervals.at(-1).fn();
    return { sut, handle, tick, bodies: [...sut.state.npcs.values()] };
}

test("a body made with no outfit that is found bare a moment later is dressed in a villager's, and one already dressed is left alone", () => {
    const sut = load();
    sut.api.installPosts("posts", POSTS, () => {});
    sut.state.timers[0].fn();
    const [man, woman] = [...sut.state.npcs.values()];
    man.wearing = [];
    woman.wearing = ["a-dress"];
    const dress = sut.state.timers.filter((timer) => timer.ms === sut.api.CLOTHE_AFTER_MS);
    assert.equal(dress.length, 2, "one look at each body");
    dress.forEach((timer) => timer.fn());
    assert.equal(man.outfits.length, 1);
    assert.ok(Array.from(sut.api.VILLAGER_OUTFITS.townsman).includes(man.outfits[0]), "one of the villagers' presets, by GUID");
    assert.match(man.outfits[0], /^[0-9a-f-]{36}$/, "a GUID: the game does not take a preset's name");
    assert.deepEqual(woman.outfits, [], "she wore something: nothing was done");

    woman.wearing = [];
    assert.equal(sut.api.clothe(woman, "townswoman", "x"), true);
    assert.deepEqual(woman.outfits, [sut.api.outfitFor("townswoman", "x")]);
    assert.equal(sut.api.clothe(woman, "townswoman"), false, "dressed now");
    assert.equal(sut.api.clothe({ id: 1, get wearing() { throw new Error("gone"); } }, "townsman"), false);
});

test("a body that was made with an outfit of its own is not looked at for clothes", () => {
    const sut = load();
    sut.api.townsperson("townsman", "Ferreiro", new FakeVector3(1, 2, 3), 0, "12468c7d-7ab1-4afc-b102-b0e74c144e8c");
    assert.equal(sut.state.timers.filter((timer) => timer.ms === sut.api.CLOTHE_AFTER_MS).length, 0);
});

test("by day a post looks at whoever comes near, greets them once with the hour's greeting and a line, and lets them be after", () => {
    const { sut, tick, bodies } = started();
    const [first] = bodies;
    sut.state.players.push(person(7, first.position.x + 3, first.position.y));
    tick();
    assert.deepEqual(first.looked.filter((id) => id === 7).length, 1);
    assert.deepEqual(first.said, ["Boa tarde! Venha ver."]);
    assert.equal(first.anims[0].fragment, "GreetingsUpperBody");
    tick();
    assert.equal(first.said.length, 1, "once, not every two seconds");
    sut.state.clock += 10 * 60_000 + 1;
    tick();
    assert.equal(first.said.length, 2, "a new greeting after ten minutes");

    sut.state.hour = 8;
    sut.state.clock += 11 * 60_000;
    tick();
    assert.equal(first.said.at(-1), "Bom dia! Venha ver.");
    sut.state.hour = 21;
    sut.state.clock += 11 * 60_000;
    tick();
    assert.equal(first.said.at(-1), "Boa noite! Venha ver.");
});

test("at night a post still turns to whoever is near, but says nothing and does not stroll", () => {
    const { sut, tick, bodies } = started();
    const [first] = bodies;
    sut.state.hour = 23;
    sut.state.players.push(person(7, first.position.x + 2, first.position.y));
    tick();
    assert.equal(first.looked.length, 1);
    assert.equal(first.said.length, 0);
    sut.state.players.length = 0;
    sut.state.clock += 10 * 60_000;
    tick();
    assert.equal(first.walks.length, 0);
});

test("by day, with nobody within twelve metres, a post takes a few steps about its place now and then; with somebody near, or walking, it does not", () => {
    const { sut, tick, bodies } = started();
    const [first, second] = bodies;
    tick();
    sut.state.clock += 60_000;
    tick();
    assert.equal(first.walks.length, 1);
    assert.equal(first.walks[0].how.pathfinding, "server");
    assert.ok(Math.abs(first.walks[0].x - (10 + sut.api.postLife.roamM / 2)) < 1e-9, "twelve metres' reach, the fake takes half of it");
    tick();
    assert.equal(first.walks.length, 1, "it stands a while first");

    sut.state.clock += 2 * 60_000;
    first.status = "running";
    second.status = "idle";
    sut.state.players.push(person(8, 52, 50));
    tick();
    assert.equal(first.walks.length, 1, "still on its way");
    assert.equal(second.walks.length, 1, "the second was left to stroll before");
    sut.state.clock += 2 * 60_000;
    second.position = { x: 40, y: 50, z: 60 };
    tick();
    assert.equal(second.walks.length, 1, "somebody within twelve metres: it stays for them");
});

test("a body that is not there or has fallen is left alone, a failure inside a tick is logged, and the day stops with the resource", () => {
    const sut = load();
    const handle = sut.api.installPosts("posts", POSTS, () => {});
    sut.api.installPostLife(handle, []);
    const tick = sut.state.intervals.at(-1).fn;
    assert.doesNotThrow(tick);
    sut.state.timers[0].fn();
    const [first] = [...sut.state.npcs.values()];
    first.alive = false;
    sut.state.players.push(person(7, first.position.x, first.position.y));
    tick();
    assert.equal(first.looked.length, 0);
    first.alive = true;
    sut.state.players.push({ ready: true, alive: true, virtualWorld: 0, get position() { throw new Error("no pose"); } });
    tick();
    assert.ok(sut.state.logs.some((line) => /o dia dos postos tropeçou: (Error: )?no pose/.test(line)));
    sut.state.handlers.get("resourceStop")("kcdc-gamemode");
    assert.equal(sut.state.cleared.length, 1);
});

test("a body made with no outfit is made dressed: a villager's preset by GUID, the same for the same name and place, and the pools vary", () => {
    const sut = load();
    const first = sut.api.townsperson("townsman", "Barbeiro", new FakeVector3(10.2, 20.4, 3), 0);
    const again = sut.api.townsperson("townsman", "Barbeiro", new FakeVector3(10.4, 20.1, 3), 0);
    assert.match(first.options.outfit, /^[0-9a-f-]{36}$/);
    assert.equal(first.options.outfit, again.options.outfit, "dressed as before when made again");
    const seen = new Set(Array.from({ length: 40 }, (_, n) => sut.api.outfitFor("townsman", `Mestre ${n}`)));
    assert.ok(seen.size >= 4, "not one man repeated");
    const women = new Set(Array.from({ length: 40 }, (_, n) => sut.api.outfitFor("townswoman", `Dona ${n}`)));
    assert.ok(women.size >= 4);
});
