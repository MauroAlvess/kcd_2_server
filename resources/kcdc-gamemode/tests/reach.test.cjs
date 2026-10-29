"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

// The one reach of every E and F prompt of ours (src/client/reach.ts and src/server/reach.ts, 2026-10-22, the user: "a distância das
// interações do E e F que fizemos personalizada em tudo devem ter o mesmo padrão de distância, exemplo 1 m a 2 m"): two metres from the body
// to the edge of the thing; for a big thing the game gives one point for, that point is its edge away; the server allows a metre more.

function load(side, extra = {}) {
    const sandbox = { exports: {}, Math, ...extra };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, `../dist/${side}/reach.js`), "utf8"), sandbox);
    return sandbox.exports;
}

const client = load("client");
const server = load("server");

test("the standard is two metres, and the server allows a metre more for the time a press takes", () => {
    assert.equal(client.REACH_M, 2);
    assert.equal(server.REACH_M, 2);
    assert.equal(server.SLACK_M, 1);
    assert.equal(client.reachTo(), 2);
    assert.equal(server.reachTo(), 2);
    assert.equal(server.allowedTo(), 3);
});

test("the client and the server keep one table of how far each point is from the edge of its thing", () => {
    assert.deepEqual(JSON.parse(JSON.stringify(client.EDGE_M)), JSON.parse(JSON.stringify(server.EDGE_M)));
    for (const [name, edge] of Object.entries(server.EDGE_M)) {
        assert.ok(edge >= 0 && edge <= 2.5, `${name}: a point is never more than the half of a hut from its edge`);
    }
    assert.equal(server.EDGE_M.surface, 0, "a point on the surface itself (a trunk, a door, the water) is its own edge");
});

test("the reach to a point is the standard plus its edge: 2.6 m to a horse's middle, 3.5 to a forge's, 4.5 to a smokehouse's, and a metre more for the press", () => {
    const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} is not ${b}`);
    near(client.reachTo(client.EDGE_M.horse), 2.6);
    near(client.reachTo(client.EDGE_M.forge), 3.5);
    near(client.reachTo(client.EDGE_M.hut), 4.5);
    near(client.reachTo(client.EDGE_M.fire), 2.6);
    near(client.reachTo(client.EDGE_M.chair), 2.4);
    near(server.allowedTo(server.EDGE_M.horse), 3.6);
    near(server.allowedTo(server.EDGE_M.forge), 4.5);
    near(server.allowedTo(server.EDGE_M.hut), 5.5);
    near(server.allowedTo(server.EDGE_M.door), 3.5);
    near(server.allowedTo(server.EDGE_M.person), 3);
});

test("the body's distance to a point is read from the local player, flat and up or down, and is nobody's until the player is in the world", () => {
    const me = { ready: true, position: { x: 10, y: 20, z: 100 } };
    const reach = load("client", { LocalPlayer: me });
    const far = reach.bodyDistance({ x: 13, y: 24, z: 98 });
    assert.equal(far.flat, 5);
    assert.equal(far.up, 2);
    me.ready = false;
    assert.equal(reach.bodyDistance({ x: 13, y: 24, z: 98 }), null);
});
