const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
require("./reachpatch.cjs");

// E at a horse (src/server/horse-menu.ts): the menu comes before the climb gets anywhere, the climb that does is refused, and
// Montar, Bolsa, Seguir (or Ficar) and Sair take its place.

function load({ mayRide = true } = {}) {
    const state = { handlers: new Map(), clients: new Map(), timers: [], intervals: [], opened: [], closed: [], chat: [], bags: [], mounts: [], busy: new Set(), emitted: [], now: 1_000_000, ride: mayRide, bagsOpen: new Set(), bagsClosed: [], following: new Set(), follows: [], stops: [] };
    const horse = { id: 7, name: "Carpiado", alive: true, rider: null, position: { x: 0, y: 0, z: 0 }, owner: null };
    state.horseRef = horse;
    const horses = new Map([[7, horse]]);
    state.horses = horses;
    const context = {
        exports: {},
        require: (id) => ({
            "./horse-bags.js": { openBags: (player, key) => { state.bags.push([player.id, key]); return { ok: true, message: "Alforjes de Carpiado." }; }, bagsBusy: (id) => state.bagsOpen.has(id), bagsClosed: state.bagsClosed },
            "./horse-follow.js": {
                isFollowing: (h) => state.following.has(h.id),
                startFollowing: (h, owner) => { state.following.add(h.id); state.follows.push([h.id, owner.id]); return { ok: true, message: "Carpiado vai seguir você." }; },
                stopFollowing: (h) => { state.stops.push(h.id); return state.following.delete(h.id); },
            },
            "./horses.js": { mayRide: () => state.ride, horsesOf: (steamId) => (steamId === "s1" ? [{ record: { key: "k7" }, horse: state.horseRef }] : []) },
        })[id] ?? assert.fail(`unexpected require ${id}`),
        Events: { on: (name, fn) => state.handlers.set(name, fn), onClient: (name, fn) => state.clients.set(name, fn) },
        setTimeout: (fn, ms) => { state.timers.push({ fn, ms }); return state.timers.length; },
        setInterval: (fn, ms) => { state.intervals.push({ fn, ms }); return state.intervals.length; },
        clearInterval() {},
        Date: { now: () => state.now },
        Chat: { sendToPlayer: (player, text) => state.chat.push(text) },
        Horse: { getById: (id) => horses.get(id) ?? null, all: () => [...horses.values()] },
        Player: { all: () => state.players ?? [] },
        Dialogue: {
            sessionOf: (id) => (state.busy.has(id) ? 5 : 0),
            open: (id, page) => { state.opened.push(page); return state.opened.length; },
            close: (session) => state.closed.push(session),
        },
        JSON,
        Math,
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/horse-menu.js"), "utf8"), context);
    context.exports.installHorseMenu();
    const player = (id = 1, extra = {}) => ({
        id, ready: true, alive: true, horse: null, position: { x: 2, y: 0, z: 0 },
        emit: (event, payload) => state.emitted.push({ event, payload }),
        mount: (h) => { state.mounts.push(h.id); return true; },
        dismount: () => { (state.dismounts ??= []).push(id); return null; },
        ...extra,
    });
    return { api: context.exports, state, horse, player };
}

const plain = (value) => JSON.parse(JSON.stringify(value));

test("a climb onto a kept horse is refused, the rider told to get off, and the menu comes at once: Montar, Bolsa, Sair", () => {
    const sut = load();
    const hans = sut.player();
    sut.horse.owner = hans;

    assert.equal(sut.state.handlers.get("horseMounting")(sut.horse, hans), false, "the game's own climb is refused");
    assert.deepEqual(plain(sut.state.dismounts), [1], "and the rider is told to get off");
    assert.equal(sut.state.opened.length, 1, "no wait: the list is up while the climb is still playing");
    assert.deepEqual(sut.state.timers.map((t) => t.ms), [sut.api.horseMenu.getOffMs], "and looked at again once the get-off is over");
    sut.state.timers[0].fn();
    assert.equal(sut.state.opened.length, 1, "still up then: no second list");
    const page = plain(sut.state.opened[0]);
    assert.match(page.line, /Carpiado/);
    assert.deepEqual(page.options.map((o) => [o.id, o.text, o.enabled]), [["mount", "Montar", true], ["bags", "Bolsa", true], ["follow", "Seguir", true], ["close", "Sair", true]]);
});

test("the player's own E asks for the menu before the climb: one list, and the refusal that follows does not open a second", () => {
    const sut = load();
    const hans = sut.player();
    sut.horse.owner = hans;

    sut.state.clients.get("kcdc-gamemode:horse.menu")(hans, JSON.stringify({ id: 7 }));
    assert.equal(sut.state.opened.length, 1);
    sut.state.now += 300;
    assert.equal(sut.state.handlers.get("horseMounting")(sut.horse, hans), false);
    assert.equal(sut.state.opened.length, 1, "the list is already up");

    const far = sut.player(2, { position: { x: 30, y: 0, z: 0 } });
    sut.state.clients.get("kcdc-gamemode:horse.menu")(far, { id: 7 });
    assert.equal(sut.state.opened.length, 1, "an E from far away is not believed");
    const riding = sut.player(3, { horse: { id: 9 } });
    sut.state.clients.get("kcdc-gamemode:horse.menu")(riding, { id: 7 });
    sut.state.clients.get("kcdc-gamemode:horse.menu")(sut.player(4), { id: 999 });
    sut.state.clients.get("kcdc-gamemode:horse.menu")(sut.player(5), "not json");
    assert.equal(sut.state.opened.length, 1, "nor from a rider, for a horse that is not there, or nonsense");
});

test("Montar chosen at once waits for the get-off of the refused climb; chosen later, or with no refusal, it mounts at once", () => {
    const sut = load();
    const hans = sut.player();
    sut.horse.owner = hans;
    sut.state.handlers.get("horseMounting")(sut.horse, hans);

    sut.state.now += 1_500;
    sut.state.handlers.get("dialogueChoice")(1, hans, "mount");
    assert.equal(sut.state.mounts.length, 0, "the get-off is still playing");
    const wait = sut.state.timers.find((t) => t.ms === sut.api.horseMenu.getOffMs - 1_500);
    assert.ok(wait, "it waits what is left of it");
    wait.fn();
    assert.deepEqual(plain(sut.state.mounts), [7]);
    assert.equal(sut.state.handlers.get("horseMounting")(sut.horse, hans), undefined, "the climb that follows goes through");

    const calm = load();
    const jan = calm.player();
    calm.horse.owner = jan;
    calm.api.openHorseMenu(jan, calm.horse);
    calm.state.now += 300;
    calm.state.handlers.get("dialogueChoice")(1, jan, "mount");
    assert.deepEqual(plain(calm.state.mounts), [7], "no refusal before it: no wait");
    assert.equal(calm.state.timers.length, 0);
});

test("Bolsa opens the alforjes, Sair only closes, and a stranger's horse has no Bolsa", () => {
    const sut = load();
    const hans = sut.player();
    sut.horse.owner = hans;
    sut.api.openHorseMenu(hans, sut.horse);
    sut.state.now += 300;
    sut.state.handlers.get("dialogueChoice")(1, hans, "bags");
    assert.deepEqual(plain(sut.state.bags), [[1, null]]);

    sut.api.openHorseMenu(hans, sut.horse);
    sut.state.now += 300;
    sut.state.handlers.get("dialogueChoice")(2, hans, "close");
    assert.equal(sut.state.mounts.length, 0, "Sair mounts nothing");

    const other = sut.player(2);
    const page = plain(sut.api.menuPage(other, sut.horse));
    assert.deepEqual(page.options.map((o) => [o.id, o.enabled]), [["mount", true], ["bags", false], ["follow", false], ["close", true]]);
});

test("a horse the player may not ride, or one that is not kept, is left to the game", () => {
    const sut = load({ mayRide: false });
    assert.equal(sut.state.handlers.get("horseMounting")(sut.horse, sut.player()), undefined, "horses.js refuses it with its own word");
    const free = load({ mayRide: null });
    assert.equal(free.state.handlers.get("horseMounting")(free.horse, free.player()), undefined);
    assert.equal(free.state.opened.length, 0);
    assert.equal(free.api.askMenu(free.player(), 7), false);
});

test("walking away from the horse before choosing does nothing", () => {
    const sut = load();
    const hans = sut.player();
    sut.horse.owner = hans;
    sut.api.openHorseMenu(hans, sut.horse);
    hans.position = { x: 50, y: 0, z: 0 };
    sut.state.now += 300;
    sut.state.handlers.get("dialogueChoice")(1, hans, "mount");
    assert.equal(sut.state.mounts.length, 0);
    assert.match(sut.state.chat.at(-1), /afastou/);
});

test("each client is told of the kept horse within its reach, once, and of none when it walks off or climbs on", () => {
    const sut = load();
    const hans = sut.player();
    sut.horse.owner = hans;
    sut.state.players = [hans];
    const tick = sut.state.intervals[0];
    assert.equal(tick.ms, sut.api.horseMenu.nearEveryMs);

    tick.fn();
    tick.fn();
    assert.equal(sut.state.emitted.length, 1, "told once");
    assert.equal(sut.state.emitted[0].event, "kcdc-gamemode:horse.near");
    assert.deepEqual(JSON.parse(sut.state.emitted[0].payload), { id: 7, x: 0, y: 0, z: 0 });

    hans.position = { x: 40, y: 0, z: 0 };
    tick.fn();
    assert.deepEqual(JSON.parse(sut.state.emitted[1].payload), { id: 0 }, "and told of none when it is out of reach");

    hans.position = { x: 1, y: 0, z: 0 };
    hans.horse = { id: 7 };
    tick.fn();
    assert.deepEqual(JSON.parse(sut.state.emitted.at(-1).payload), { id: 0 }, "nor on a horse");
});

test("with the alforjes open, an E on an item asks for no menu, and a climb it starts is refused without one", () => {
    const sut = load();
    const hans = sut.player();
    sut.horse.owner = hans;
    sut.state.bagsOpen.add(hans.id);
    sut.state.clients.get("kcdc-gamemode:horse.menu")(hans, JSON.stringify({ id: 7 }));
    assert.equal(sut.state.opened.length, 0, "no Montar under the player's E");
    assert.equal(sut.state.handlers.get("horseMounting")(sut.horse, hans), false, "the climb is refused all the same");
    assert.equal(sut.state.opened.length, 0, "and no menu comes with the refusal");
    sut.state.bagsOpen.delete(hans.id);
    sut.state.now += 10_000;
    sut.state.clients.get("kcdc-gamemode:horse.menu")(hans, JSON.stringify({ id: 7 }));
    assert.equal(sut.state.opened.length, 1, "the screen closed: E at the horse is the menu again");
});

test("closing the alforjes brings the horse's menu back by itself, so the next E is a choice and not the game's climb", () => {
    const sut = load();
    const hans = sut.player(1, { steamId: "s1" });
    sut.horse.owner = hans;
    assert.equal(sut.state.bagsClosed.length, 1, "the menu listens for the alforjes closing");
    sut.state.bagsClosed[0](hans, "k7");
    assert.equal(sut.state.opened.length, 0, "not while the screen is still going");
    const wait = sut.state.timers.at(-1);
    assert.equal(wait.ms, 400);
    wait.fn();
    assert.deepEqual(plain(sut.state.opened[0].options.map((o) => o.id)), ["mount", "bags", "follow", "close"]);
    // The climb an E set off meanwhile is refused and opens no second menu.
    sut.state.now += 200;
    assert.equal(sut.state.handlers.get("horseMounting")(sut.horse, hans), false);
    assert.equal(sut.state.opened.length, 1);
});

test("no menu comes back after the alforjes for a horse that is gone, mounted, far, or somebody else's", () => {
    const sut = load();
    const hans = sut.player(1, { steamId: "s1" });
    sut.horse.rider = { id: 2 };
    assert.equal(sut.api.menuAfterBags(hans, "k7"), false, "mounted");
    sut.horse.rider = null;
    assert.equal(sut.api.menuAfterBags(sut.player(1, { steamId: "s1", position: { x: 40, y: 0, z: 0 } }), "k7"), false, "far");
    assert.equal(sut.api.menuAfterBags(sut.player(3, { steamId: "s3" }), "k7"), false, "not theirs");
    assert.equal(sut.api.menuAfterBags(hans, "other"), false, "another horse");
    assert.equal(sut.api.menuAfterBags(hans, "k7"), true);
});

// 2026-10-19: "fui subir no meu cavalo, apertei E, ele subiu direto, depois desceu sem abrir o menu".

test("an E whose menu could not open (another list up) does not keep the refused climb from opening one", () => {
    const sut = load();
    const hans = sut.player();
    sut.horse.owner = hans;
    sut.state.busy.add(hans.id);
    sut.state.clients.get("kcdc-gamemode:horse.menu")(hans, JSON.stringify({ id: 7 }));
    assert.equal(sut.state.opened.length, 0, "the other list is up");
    sut.state.busy.delete(hans.id);
    sut.state.now += 300;
    assert.equal(sut.state.handlers.get("horseMounting")(sut.horse, hans), false);
    assert.equal(sut.state.opened.length, 1, "the refusal brings the menu");
});

test("a menu the climb took down is put back once the get-off is over", () => {
    const sut = load();
    const hans = sut.player();
    sut.horse.owner = hans;
    sut.state.clients.get("kcdc-gamemode:horse.menu")(hans, JSON.stringify({ id: 7 }));
    assert.equal(sut.state.opened.length, 1);
    sut.state.now += 200;
    assert.equal(sut.state.handlers.get("horseMounting")(sut.horse, hans), false);
    assert.equal(sut.state.opened.length, 1, "the first list stands for it");
    sut.state.handlers.get("dialogueClosed")(1);
    sut.state.timers.find((t) => t.ms === sut.api.horseMenu.getOffMs).fn();
    assert.equal(sut.state.opened.length, 2, "the list is back after the get-off");
    // Mounted or walked away by then: nothing.
    const other = load();
    const jan = other.player();
    other.horse.owner = jan;
    other.state.handlers.get("horseMounting")(other.horse, jan);
    other.state.handlers.get("dialogueClosed")(1);
    jan.position = { x: 40, y: 0, z: 0 };
    other.state.timers.find((t) => t.ms === other.api.horseMenu.getOffMs).fn();
    assert.equal(other.state.opened.length, 1);
});

test("the same E that asked for the menu does not choose Montar in it: the menu is put back up", () => {
    const sut = load();
    const hans = sut.player();
    sut.horse.owner = hans;
    sut.api.openHorseMenu(hans, sut.horse);
    sut.state.now += 100;
    sut.state.handlers.get("dialogueChoice")(1, hans, "mount");
    assert.equal(sut.state.mounts.length, 0);
    assert.equal(sut.state.opened.length, 2, "up again");
    sut.state.now += 400;
    sut.state.handlers.get("dialogueChoice")(2, hans, "mount");
    assert.deepEqual(plain(sut.state.mounts), [7], "a real choice mounts");
});

// 2026-10-22: "adicionamos uma nova opção no menu do cavalo: mandar seguir e mandar ficar. O mandar ficar só para de seguir e continua indo
// se usar o assobiar".

test("Seguir sends the owner's horse after them, then the menu offers Ficar, which only stops it; a stranger commands neither", () => {
    const sut = load();
    const hans = sut.player();
    sut.horse.owner = hans;
    sut.api.openHorseMenu(hans, sut.horse);
    sut.state.now += 300;
    sut.state.handlers.get("dialogueChoice")(1, hans, "follow");
    assert.deepEqual(plain(sut.state.follows), [[7, 1]], "the horse is sent after its owner");
    assert.match(sut.state.chat.at(-1), /vai seguir/);

    const page = plain(sut.api.menuPage(hans, sut.horse));
    assert.deepEqual(page.options.map((o) => [o.id, o.text, o.enabled]), [["mount", "Montar", true], ["bags", "Bolsa", true], ["stay", "Ficar", true], ["close", "Sair", true]], "a horse that follows offers Ficar in place of Seguir");

    sut.api.openHorseMenu(hans, sut.horse);
    sut.state.now += 300;
    sut.state.handlers.get("dialogueChoice")(2, hans, "stay");
    assert.deepEqual(plain(sut.state.stops), [7], "Ficar stops the following (and holds the horse where it is)");
    assert.match(sut.state.chat.at(-1), /fica onde está/);
    assert.match(sut.state.chat.at(-1), /assobio/, "and says that the whistle still calls it");

    const other = sut.player(2);
    sut.api.openHorseMenu(other, sut.horse);
    sut.state.now += 300;
    sut.state.handlers.get("dialogueChoice")(3, other, "follow");
    assert.equal(sut.state.follows.length, 1, "somebody else's order is not obeyed");
    assert.match(sut.state.chat.at(-1), /Só o dono/);
});

test("Seguir is not offered to a horse that is down or has a rider", () => {
    const sut = load();
    const hans = sut.player();
    sut.horse.owner = hans;
    sut.horse.unconscious = true;
    assert.equal(plain(sut.api.menuPage(hans, sut.horse)).options.find((o) => o.id === "follow").enabled, false, "knocked out");
    sut.horse.unconscious = false;
    sut.horse.rider = { id: 3 };
    assert.equal(plain(sut.api.menuPage(hans, sut.horse)).options.find((o) => o.id === "follow").enabled, false, "mounted");
});

// A wild horse is the Agricultores' to tame: wild-horses.ts hooks into the menu's near-horse look and its E.

test("a wild horse near a player is told to the client with a flag, nearer than a kept one it beats, and its E is that module's to answer", () => {
    const sut = load();
    const hans = sut.player();
    sut.horse.owner = hans;
    sut.state.players = [hans];
    const wild = { id: 8, name: "Cavalo selvagem", alive: true, rider: null, position: { x: 1, y: 0, z: 0 }, owner: null };
    sut.state.horses.set(8, wild);
    const asked = [];
    sut.api.nearExtras.push((who, reach) => (who.id === 1 && reach >= 1 ? { horse: wild, w: true } : null));
    sut.api.askExtras.push((who, horse) => { asked.push([who.id, horse.id]); return horse.id === 8 ? true : null; });

    const tick = sut.state.intervals[0];
    tick.fn();
    assert.deepEqual(JSON.parse(sut.state.emitted.at(-1).payload), { id: 8, x: 1, y: 0, z: 0, w: 1 }, "the wild one is nearer: it is the target, and flagged");

    assert.equal(sut.api.askMenu(hans, 8), true, "its E is answered by the other module");
    assert.deepEqual(asked, [[1, 8]]);
    assert.equal(sut.state.opened.length, 0, "and the kept horse's menu does not open");
    assert.equal(sut.api.askMenu(hans, 7), true, "a kept horse is still the menu's own (the module said nothing of it)");
    assert.equal(sut.state.opened.length, 1);
});
