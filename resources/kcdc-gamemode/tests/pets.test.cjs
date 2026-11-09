"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

// The "Animais" section's server half (src/server/pets.ts): what it says of the supporter's dog, and the panel's "Mandar embora" (2026-10-30).

const OWNER = "76561198000000001";

function load({ record = { dogName: "Lobo" } } = {}) {
    const handlers = new Map();
    const chat = [];
    const emitted = [];
    const state = { record, sentAway: 0, called: 0, away: false, horses: [] };
    const supporters = {
        get: (steamId) => (steamId === OWNER ? state.record : null),
        sendAway: () => {
            state.sentAway += 1;
            state.record = { ...state.record, dogAway: true };
            return { ok: true, message: "Seu cão foi embora e some do mundo. Chame-o quando quiser: /cachorro, ou Chamar na seção Animais." };
        },
        call: () => {
            state.called += 1;
            const { dogAway, ...rest } = state.record;
            state.record = rest;
            return { ok: true, message: "Seu cão voltou ao mundo e veio para perto de você." };
        },
        rename: () => ({ ok: true, message: "ok" }),
    };
    const requires = {
        "./acquaintances.js": { nameOf: (player) => player.nickname },
        "./carts.js": { bringCart: () => ({ ok: false, message: "" }), CART_NAME_MAX: 24, CART_NAME_MIN: 2, cartName: () => "", cartsOf: () => [], giveCartTo: () => ({ ok: false, message: "" }), renameCart: () => ({ ok: false, message: "" }), setCartShared: () => ({ ok: false, message: "" }), whereIs: () => "" },
        "./horses.js": { compassDirection: () => "norte", giveHorseTo: () => ({ ok: false, message: "" }), HORSE_NAME_MAX: 24, HORSE_NAME_MIN: 2, callHorse: () => ({ ok: false, message: "" }), horsesOf: () => state.horses, letHorseGo: () => ({ ok: false, message: "" }), moodOf: (record) => (typeof record.mood === "number" ? record.mood : 100), moodWord: (mood) => (mood < 30 ? "de mau humor" : mood < 60 ? "irritado" : "calmo"), renameHorse: () => ({ ok: false, message: "" }), setActiveHorse: () => ({ ok: false, message: "" }), setHorseShared: () => ({ ok: false, message: "" }) },
        "./item-names.js": { itemName: () => "" },
        "./animal-stuck.js": { stuckIn: () => 0, unstickAnimal: () => ({ ok: false, message: "" }) },
        "./supporters.js": { DOG_NAME_MAX: 24, DOG_NAME_MIN: 2, supporters },
    };
    const context = {
        exports: {},
        require: (id) => requires[id] ?? assert.fail(`pets: unexpected require ${id}`),
        console: { log() {} },
        Events: { onClient: (name, fn) => handlers.set(name, fn) },
        Chat: { sendToPlayer: (player, text) => chat.push(text) },
        Player: { getById: () => null },
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/pets.js"), "utf8"), context);
    context.exports.installPets();
    const player = { id: 1, steamId: OWNER, nickname: "Hans", dog: null, position: { x: 0, y: 0, z: 0 }, emitted, emit(event, payload) { emitted.push({ event, payload: JSON.parse(payload) }); } };
    return { api: context.exports, handlers, chat, emitted, state, player };
}

const dogOf = (sut) => JSON.parse(JSON.stringify(sut.api.animalsOf(sut.player).dog));

test("a supporter's dog that is not in the world is far or sent away; the panel is told which", () => {
    const sut = load();
    assert.deepEqual(dogOf(sut), { name: "Lobo", here: false, away: false, order: "longe", doing: "", morale: null, stuckIn: 0 });
    sut.state.record = { dogName: "Lobo", dogAway: true };
    assert.deepEqual(dogOf(sut), { name: "Lobo", here: false, away: true, order: "embora", doing: "", morale: null, stuckIn: 0 }, "sent away: no longer 'far from you'");
    sut.player.dog = { name: "", mode: 1, objective: 4, morale: 40 };
    assert.equal(dogOf(sut).away, false, "a dog in the world is not away, whatever the record says");
    assert.equal(dogOf(sut).here, true);
    assert.equal(sut.api.animalsOf({ ...sut.player, steamId: "76561198000000999" }).dog, null, "somebody with no dog is told of none");
});

const gearless = { saddle: null, head: null, torso: null, shoe: null };
const horsesOfView = (sut) => JSON.parse(JSON.stringify(sut.api.animalsOf(sut.player).horses));

test("every horse's view carries its mood, in the world or not: the Humor bar of the Animais section (2026-11-04)", () => {
    const sut = load();
    // Not in the world: no body to read, but the record has the mood and the panel must still draw the bar.
    sut.state.horses = [{ record: { key: "h1", name: "Loki", gear: gearless, mood: 45 }, horse: null }];
    const away = horsesOfView(sut)[0];
    assert.deepEqual(away.mood, [45, 100]);
    assert.equal(away.moodWord, "irritado");
    assert.deepEqual(away.health, [0, 0], "no body: no health to show");
    // In the world: the body's numbers and the mood side by side.
    const body = { name: "", alive: true, health: 80, maxHealth: 100, stamina: 55, maxStamina: 100, position: { x: 3, y: 4, z: 0 }, rider: null };
    sut.state.horses = [{ record: { key: "h2", name: "Pardo", gear: gearless, mood: 12.4 }, horse: body }, { record: { key: "h3", name: "Brasa", gear: gearless }, horse: body }];
    const [sulking, calm] = horsesOfView(sut);
    assert.deepEqual(sulking.mood, [12, 100], "rounded to a whole point");
    assert.equal(sulking.moodWord, "de mau humor");
    assert.deepEqual(sulking.health, [80, 100]);
    assert.deepEqual(calm.mood, [100, 100], "a record that says nothing is in the best of moods");
    assert.equal(calm.moodWord, "calmo");
});

test("the panel's Mandar embora sends the dog away, tells the owner and answers with the new view; only for the dog", () => {
    const sut = load();
    const away = sut.handlers.get("kcdc-gamemode:status.animalAway");
    assert.ok(away, "the event is served");
    away(sut.player, JSON.stringify({ kind: "horse" }));
    assert.equal(sut.state.sentAway, 0, "a horse is not sent away by it");
    away(sut.player, JSON.stringify({ kind: "dog" }));
    assert.equal(sut.state.sentAway, 1);
    assert.match(sut.chat.at(-1), /Seu cão foi embora/);
    const notice = sut.emitted.find((entry) => entry.event === "kcdc-gamemode:status.notice");
    assert.match(notice.payload.text, /Seu cão foi embora/);
    const view = sut.emitted.filter((entry) => entry.event === "kcdc-gamemode:status.animals").at(-1);
    assert.equal(view.payload.dog.away, true, "the answer carries the new state");

    // Chamar is the way back: the same event the panel always sent for the dog.
    const call = sut.handlers.get("kcdc-gamemode:status.animalCall");
    call(sut.player, JSON.stringify({ kind: "dog" }));
    assert.equal(sut.state.called, 1);
    assert.equal(sut.emitted.filter((entry) => entry.event === "kcdc-gamemode:status.animals").at(-1).payload.dog.away, false);
});

test("a horse's view carries no alforjes, no weight, no hunger and no breed's degree any more (2026-11-09)", () => {
    const sut = load();
    sut.state.horses = [{ record: { key: "h1", name: "Pardo", gear: gearless, kg: 70, food: 10 }, horse: null }];
    const view = horsesOfView(sut)[0];
    for (const gone of ["bags", "bagsOpen", "load", "loadBand", "quality", "food", "hunger"]) assert.ok(!(gone in view), `${gone} is not in the view`);
    assert.equal(sut.handlers.get("kcdc-gamemode:status.horseBags"), undefined, "and the panel's alforjes are not asked for");
});

test("the panel's Soltar lets the horse go through the same rule as the menu's, and says what came of it", () => {
    const sut = load();
    const release = sut.handlers.get("kcdc-gamemode:status.horseRelease");
    assert.equal(typeof release, "function");
    release(sut.player, JSON.stringify({ key: 5 }));
    assert.equal(sut.chat.length, 0, "a key that is not text is ignored");
    release(sut.player, JSON.stringify({ key: "h1" }));
    assert.equal(sut.chat.length, 1, "the answer of the rule reaches the chat (and the panel's notice)");
});
