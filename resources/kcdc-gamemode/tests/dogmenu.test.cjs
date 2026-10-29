const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
require("./reachpatch.cjs");

// E at the player's dog (src/server/dog-menu.ts, 2026-10-26: "permitir apertar E no cachorro; ao apertar E no cachorro abre o menu: fazer carinho,
// mandar ficar / mandar seguir e sair, estilo do cavalo"): the client is told of the dog within reach, its E asks for the menu, and Fazer carinho,
// Mandar ficar (or Mandar seguir) and Sair take its place.

function load() {
    const state = { handlers: new Map(), clients: new Map(), timers: [], intervals: [], opened: [], closed: [], chat: [], emitted: [], busy: new Set(), played: [], orders: [], now: 1_000_000, players: [], supporters: new Set(["s1"]) };
    const context = {
        exports: {},
        require: (id) => ({
            "./emotes.js": { DOG_PETTING: 201, emotes: { play: (player, gesture, fromMenu) => { state.played.push([player.id, gesture, fromMenu]); return true; } } },
            "./supporters.js": {
                supporters: {
                    get: (steamId) => (state.supporters.has(steamId) ? { dogName: "" } : null),
                    order: (player, word) => {
                        state.orders.push([player.id, word]);
                        return { ok: true, message: word === "sentar" ? "Seu cão senta e fica aqui até você chamar." : "Seu cão vai seguir você." };
                    },
                },
            },
        })[id] ?? assert.fail(`unexpected require ${id}`),
        Events: { on: (name, fn) => state.handlers.set(name, fn), onClient: (name, fn) => state.clients.set(name, fn) },
        setTimeout: (fn, ms) => { state.timers.push({ fn, ms }); return state.timers.length; },
        setInterval: (fn, ms) => { state.intervals.push({ fn, ms }); return state.intervals.length; },
        clearInterval() {},
        Date: { now: () => state.now },
        Chat: { sendToPlayer: (player, text) => state.chat.push(text) },
        Player: { all: () => state.players },
        Dialogue: {
            sessionOf: (id) => (state.busy.has(id) ? 5 : 0),
            open: (id, page) => { state.opened.push(page); return state.opened.length; },
            close: (session) => state.closed.push(session),
        },
        JSON,
        Math,
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/dog-menu.js"), "utf8"), context);
    context.exports.installDogMenu();
    const dog = { id: 55, name: "Rex", mode: 1, position: { x: 1, y: 0, z: 0 } };
    const player = (id = 1, extra = {}) => {
        const made = {
            id, steamId: `s${id}`, ready: true, alive: true, mounted: false, horse: null, dog, position: { x: 0, y: 0, z: 0 },
            emit: (event, payload) => state.emitted.push({ event, payload }),
            ...extra,
        };
        state.players.push(made);
        return made;
    };
    const ask = (who, payload = { id: 55 }) => state.clients.get("kcdc-gamemode:dog.menu")(who, payload);
    const choose = (session, who, option) => state.handlers.get("dialogueChoice")(session, who, option);
    return { api: context.exports, state, dog, player, ask, choose };
}

const plain = (value) => JSON.parse(JSON.stringify(value));

test("the player's E at their dog opens the list: Fazer carinho, Mandar ficar while it follows, Mandar seguir when it does not, and Sair", () => {
    const sut = load();
    const hans = sut.player();
    sut.ask(hans);
    assert.equal(sut.state.opened.length, 1);
    const page = plain(sut.state.opened[0]);
    assert.match(page.line, /^Rex: /);
    assert.deepEqual(page.options.map((o) => [o.id, o.text, o.enabled]), [["pet", "Fazer carinho", true], ["stay", "Mandar ficar", true], ["close", "Sair", true]]);

    const again = load();
    again.dog.mode = 0;
    again.dog.name = "";
    again.ask(again.player());
    const sitting = plain(again.state.opened[0]);
    assert.equal(sitting.line, "Seu cão: o que você quer fazer?", "a dog with no name of its own is just the dog");
    assert.deepEqual(sitting.options.map((o) => [o.id, o.text]), [["pet", "Fazer carinho"], ["follow", "Mandar seguir"], ["close", "Sair"]]);

    const loose = load();
    loose.dog.mode = 2;
    loose.ask(loose.player());
    assert.equal(plain(loose.state.opened[0]).options[1].id, "follow", "a dog that runs loose is told to follow");
});

test("only the owner's E, with the dog in reach, on foot, with no other list up and as a supporter, is answered", () => {
    const sut = load();
    const hans = sut.player();
    sut.ask(sut.player(2, { dog: null }), { id: 55 });
    sut.ask(sut.player(3), { id: 999 });
    sut.ask(sut.player(4), "not json");
    sut.ask(sut.player(5), JSON.stringify({ id: "55" }));
    assert.equal(sut.state.opened.length, 0, "somebody else's dog, a dog that is not there, nonsense");

    const far = sut.player(6, { position: { x: 30, y: 0, z: 0 } });
    sut.ask(far);
    sut.ask(sut.player(7, { mounted: true }));
    sut.ask(sut.player(8, { horse: { id: 9 } }));
    const busy = sut.player(9);
    sut.state.busy.add(9);
    sut.ask(busy);
    const stranger = sut.player(10);
    sut.state.supporters.delete("s10");
    sut.ask(stranger);
    assert.equal(sut.state.opened.length, 0, "far away, riding, with another list up, or no longer a supporter");

    sut.ask(hans, JSON.stringify({ id: 55 }));
    assert.equal(sut.state.opened.length, 1, "and the owner's, as the text the client sends");
});

test("Fazer carinho plays the caress and says so, not twice in a row; the E that opened the list does not choose; Sair does nothing", () => {
    const sut = load();
    const hans = sut.player();
    sut.ask(hans);
    sut.state.now += 100;
    sut.choose(1, hans, "pet");
    assert.equal(sut.state.opened.length, 2, "the same E that opened it is not a choice: the list comes back");
    assert.deepEqual(sut.state.played, []);

    sut.state.now += 1_000;
    sut.choose(2, hans, "pet");
    assert.deepEqual(plain(sut.state.played), [[1, 201, true]], "the caress, asked for by a menu of the server's");
    assert.deepEqual(sut.state.chat, ["Você faz carinho em Rex."]);
    assert.ok(sut.state.emitted.some((entry) => entry.event === "kcdc-gamemode:notify" && /Você faz carinho em Rex\./.test(entry.payload)), "on the screen too");

    sut.state.now += 500;
    sut.ask(hans);
    sut.state.now += 1_000;
    sut.choose(3, hans, "pet");
    assert.equal(sut.state.played.length, 1, "not again within the three seconds of the animation");

    sut.state.now += 3_000;
    sut.ask(hans);
    sut.state.now += 1_000;
    sut.choose(4, hans, "pet");
    assert.equal(sut.state.played.length, 2, "and again after it");

    sut.state.now += 1_000;
    sut.ask(hans);
    const before = sut.state.chat.length;
    sut.state.now += 1_000;
    sut.choose(5, hans, "close");
    assert.equal(sut.state.chat.length, before, "Sair says nothing");
    assert.ok(sut.state.closed.includes(5), "and closes the list");
    sut.dog.name = "";
    sut.state.now += 5_000;
    sut.ask(hans);
    sut.state.now += 1_000;
    sut.choose(6, hans, "pet");
    assert.equal(sut.state.chat.at(-1), "Você faz carinho em seu cão.", "a dog with no name is the dog");
});

test("Mandar ficar sits the dog where it is, Mandar seguir has it follow; both through the supporter's own orders", () => {
    const sut = load();
    const hans = sut.player();
    sut.ask(hans);
    sut.state.now += 1_000;
    sut.choose(1, hans, "stay");
    assert.deepEqual(plain(sut.state.orders), [[1, "sentar"]]);
    assert.equal(sut.state.chat.at(-1), "Seu cão senta e fica aqui até você chamar.");

    sut.state.now += 1_000;
    sut.ask(hans);
    sut.state.now += 1_000;
    sut.choose(2, hans, "follow");
    assert.deepEqual(plain(sut.state.orders), [[1, "sentar"], [1, "seguir"]]);
    assert.equal(sut.state.chat.at(-1), "Seu cão vai seguir você.");
});

test("a dog that is gone or has moved too far by the time of the choice is not obeyed, and the player is told when it is far", () => {
    const sut = load();
    const hans = sut.player();
    sut.ask(hans);
    sut.state.now += 1_000;
    sut.dog.position = { x: 20, y: 0, z: 0 };
    sut.choose(1, hans, "pet");
    assert.deepEqual(sut.state.played, []);
    assert.equal(sut.state.chat.at(-1), "Você se afastou demais do seu cão.");

    const gone = load();
    const eva = gone.player();
    gone.ask(eva);
    gone.state.now += 1_000;
    eva.dog = null;
    gone.choose(1, eva, "stay");
    assert.deepEqual(gone.state.orders, [], "a dog sent away (called anew) leaves nothing to order");
    assert.deepEqual(gone.state.chat, []);

    const other = load();
    const jan = other.player();
    other.ask(jan);
    other.state.now += 1_000;
    other.choose(1, other.player(2), "stay");
    assert.deepEqual(other.state.orders, [], "somebody else's choice of the list is not taken");
});

test("the client is told of the dog while it is within reach, again when it moves on, and that it is gone when it leaves or is not the player's to open", () => {
    const sut = load();
    const hans = sut.player();
    const tell = sut.state.intervals[0].fn;
    assert.equal(sut.state.intervals[0].ms, sut.api.dogMenu.nearEveryMs);
    tell();
    assert.deepEqual(plain(sut.state.emitted), [{ event: "kcdc-gamemode:dog.near", payload: JSON.stringify({ id: 55, x: 1, y: 0, z: 0 }) }]);
    tell();
    assert.equal(sut.state.emitted.length, 1, "the same place is not told twice");

    sut.dog.position = { x: 2.2, y: 0, z: 0 };
    tell();
    assert.equal(JSON.parse(sut.state.emitted[1].payload).x, 2.25, "a quarter of a metre is as fine as it is told");
    sut.dog.position = { x: 6, y: 0, z: 0 };
    tell();
    assert.equal(sut.state.emitted[2].payload, JSON.stringify({ id: 0 }), "out of reach: the client is told there is no dog to aim at");
    tell();
    assert.equal(sut.state.emitted.length, 3);

    sut.dog.position = { x: 1, y: 0, z: 5 };
    tell();
    assert.equal(sut.state.emitted.length, 3, "a dog on another floor is out of reach too");
    sut.dog.position = { x: 1, y: 0, z: 0 };
    hans.mounted = false;
    hans.horse = { id: 3 };
    tell();
    assert.equal(sut.state.emitted.length, 3, "nothing for a rider (it was already cleared)");
    hans.horse = null;
    tell();
    assert.equal(sut.state.emitted.length, 4, "and told again when they get down");

    sut.state.supporters.delete("s1");
    tell();
    assert.equal(sut.state.emitted.at(-1).payload, JSON.stringify({ id: 0 }), "nobody who is no supporter is told of a dog");
    sut.player(2, { dog: null });
    tell();
    assert.equal(sut.state.emitted.length, 5, "a player with no dog is told nothing");
    sut.player(3, { alive: false });
    sut.state.supporters.add("s3");
    sut.player(4, { ready: false });
    sut.state.supporters.add("s4");
    tell();
    assert.equal(sut.state.emitted.length, 5, "the dead and the ones still loading are told nothing either");
});

test("a list left up when the player goes, or closed by the game, is forgotten", () => {
    const sut = load();
    const hans = sut.player();
    sut.ask(hans);
    sut.state.handlers.get("dialogueClosed")(1);
    sut.state.now += 1_000;
    sut.choose(1, hans, "stay");
    assert.deepEqual(sut.state.orders, [], "a list the game closed has no choice left");

    sut.state.now += 1_000;
    sut.ask(hans);
    sut.state.handlers.get("playerDisconnect")(hans);
    assert.ok(sut.state.closed.includes(2), "a list left up is closed when they go");
    sut.state.now += 1_000;
    sut.choose(2, hans, "stay");
    assert.deepEqual(sut.state.orders, []);
});
