"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

// What an NPC says (src/server/npc-speech.ts, 2026-11-02), stood in for: said over the body as before, and recorded with its author.
const SPEECH = {
    speak: (npc, author, text, options = {}) => {
        if (typeof npc.say === "function") npc.say(text);
        (globalThis.__spoken ??= []).push({ npc: npc.id, author, text, to: (options.to ?? []).map((player) => player.id), radiusM: options.radiusM });
        return 1;
    },
    splitSpeaker: (line, fallback) => {
        const at = line.indexOf(": ");
        return at > 0 && at <= 60 && !/[.!?]/.test(line.slice(0, at)) ? { author: line.slice(0, at), text: line.slice(at + 2) } : { author: fallback, text: line };
    },
    turnBackAfterTalk: (npc, player, yaw) => { (globalThis.__turnBacks ??= []).push([npc.id, player.id, yaw]); },
    faceAhead: () => true,
};


const dist = (name) => fs.readFileSync(path.join(__dirname, "../dist/server", name), "utf8");
const plain = (value) => JSON.parse(JSON.stringify(value));

// The guild vendors (src/server/guild-vendors.ts, 2026-10-31): bodies near players, the E menu, a trade screen of one player's own, learning the trade, the tamer's horse.
const HANS = "76561198000000003";
const KAT = "76561198000000004";
const RUDI = "76561198000000005";
const ADMIN = "76561198000000009";
const DAY = 24 * 60 * 60_000;

const TOWNS = { suchdol: { id: "suchdol", name: "Suchdol", seat: null }, raborsch: { id: "raborsch", name: "Raborsch", seat: null }, wysoka: { id: "wysoka", name: "Wysoka", seat: "suchdol" } };
const GUILDS = [
    { id: "fabri-ferrarii", nameLatin: "Fabri Ferrarii", profession: "Ferreiro" },
    { id: "domitores", nameLatin: "Domitores", profession: "Domador" },
    { id: "tabernarii", nameLatin: "Tabernarii", profession: "Taberneiro" },
    { id: "venatores", nameLatin: "Venatores", profession: "Caçador" },
];
const POSTS = [
    ["ferreiro-suchdol", "fabri-ferrarii", "suchdol", 100, 100, 10, 0, "Shop:profession/blacksmith"],
    ["domador-suchdol", "domitores", "suchdol", 120, 100, 10, 90, "Horse:horse_"],
    ["ferreiro-raborsch", "fabri-ferrarii", "raborsch", 5000, 5000, 10, 0, "ring"],
];
// What the game says each item is worth (a price of the game, in its units); an item not here is one the server does not know.
const WORTH = {
    special_charcoal: 20, bsmt_ironBad: 40, bsmt_hardware: 30, bsmt_ironGood: 120, bsmt_steelBad: 100, bsmt_copper: 80, repairKit_armourSmall: 500, repairKit_weaponSmall: 500, repairKit_bowyerSmall: 500,
    "kcdc-craft:lenha": 10, bsmt_steelNormal: 600, carrot: 20, apple: 20, pear: 20, beet: 20, turnip: 20, parsnip: 20, bread: 30, horseshoeMilitary: 100,
    "guid-silver": 900,
};

function load({ citizens = {}, guilds = {}, money = {}, free = {}, crops = [], files = {}, clock = 1_000_000 } = {}) {
    // `ground` is what the players' games find under a point (null: no answer), `traces` what they were asked, `keeperLooks` what the keeper was shown (2026-11-01).
    const state = { clock, hour: 12, carts: [], npcs: new Map(), nextNpc: 100, looks: [], files: new Map(Object.entries(files)), writes: [], ground: null, traces: [], teleports: [], keeperLooks: [], logs: [] };
    const counters = [];
    const timers = [];
    const handlers = {};
    const clientHandlers = {};
    const emitted = [];
    const notices = [];
    const chats = [];
    const socials = [];
    const kits = [];
    const guildSets = [];
    const horses = [];
    const horseKeys = new Map();
    const dressed = [];
    const purse = new Map(Object.entries(money));
    const guildOf = new Map(Object.entries(guilds));
    const freeLeft = new Set(Object.entries(free).filter(([, v]) => v).map(([k]) => k));
    const dialogue = { next: 1, sessions: new Map() };
    const vendors = new Map();
    const vendorCalls = { opened: [], destroyed: [] };
    const trading = new Map();
    const players = [];
    const npcs = state.npcs;

    const player = (id, steamId, at, extra = {}) => {
        const body = { id, steamId, nickname: `j${id}`, ready: true, alive: true, position: { x: at[0], y: at[1], z: at[2] ?? 10 }, rotation: {}, ...extra };
        players.push(body);
        return body;
    };

    const shopsExports = (() => {
        const sandbox = { exports: {}, require: (id) => ({ "./craft-data.js": { FARM_CROPS: crops }, "./money.js": { MONEY_UNIT: 10 } })[id] ?? assert.fail(`shops: unexpected require ${id}`) };
        vm.runInNewContext(dist("guild-shops.js"), sandbox);
        return sandbox.exports;
    })();

    // The real ground module, over a fake game: `state.ground(from, to)` answers the trace.
    const groundExports = (() => {
        const sandbox = {
            exports: {},
            Vector3: function (x, y, z) { return { x, y, z }; },
            World: {
                raycastAll: async (reader, from, to, options) => {
                    state.traces.push({ reader: reader.id, from: plain(from), to: plain(to), options: plain(options) });
                    const hits = state.ground === null ? null : state.ground(from, to);
                    return hits === null ? { answered: false, reason: "timeout", hit: null, hits: [] } : { answered: true, reason: "", hit: hits[0] ?? null, hits };
                },
            },
        };
        vm.runInNewContext(dist("npc-ground.js"), sandbox);
        return sandbox.exports;
    })();

    // The vendors' answers (vendor-talk.ts) require nothing: the real module.
    const talkExports = (() => {
        const sandbox = { exports: {} };
        vm.runInNewContext(dist("vendor-talk.js"), sandbox);
        return sandbox.exports;
    })();

    const requires = {
        "./npc-ground.js": groundExports,
        "./vendor-talk.js": talkExports,
        "./auth.js": { isAdmin: (p) => p.steamId === ADMIN },
        "./big-emit.js": { emitLarge: (p, name, json) => { emitted.push([p.steamId, name, JSON.parse(json)]); return 1; } },
        "./change-fee.js": {
            // The price of learning another trade: never the free change (2026-10-31), 100 coins out of the bag.
            chargeChangePrice: (p) => {
                const have = purse.get(p.steamId) ?? 0;
                if (have < 1000) return { ok: false, free: false, message: `Aprender outro ofício custa 100 moedas e você tem ${have / 10} moedas.`, refund() {} };
                purse.set(p.steamId, have - 1000);
                return { ok: true, free: false, message: "", refund: () => purse.set(p.steamId, (purse.get(p.steamId) ?? 0) + 1000) };
            },
        },
        "./world-cycle.js": { isDay: (hour) => hour >= 6 && hour < 21 },
        "./citizenship.js": { townById: (id) => TOWNS[id] ?? null, townOf: (steamId) => (citizens[steamId] ? TOWNS[citizens[steamId]] : null), npcCounters: counters, TOWNS: Object.values(TOWNS) },
        "./craft-items.js": { craftItemGuid: (id) => (id.startsWith("kcdc-craft:") ? `guid:${id}` : null), classOf: (item) => (item.startsWith("kcdc-craft:") ? `guid:${item}` : item).toLowerCase() },
        "./guild-posts-data.js": { GUILD_POSTS: POSTS },
        "./guild-shops.js": shopsExports,
        // The classes of the game's names (src/server/item-guids.ts, 2026-11-03): none here, so a name is its own key.
        "./item-guids.js": { isGuid: (item) => /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(item), resolveItemGuids: () => new Map() },
        "./horses.js": { keyOfHorse: (horse) => horse.key ?? null, recordOf: (key) => (horseKeys.has(key) && horseKeys.get(key) ? { key } : null) },
        "./kits.js": { grantGuildKit: (p, guild) => { kits.push([p.steamId, guild]); return ["1 machado"]; }, guildKitHint: () => "Dica do ofício." },
        "./language.js": { languageOf: () => "pt", translate: (text) => text },
        "./money.js": {
            MONEY_UNIT: 10,
            coins: (units) => { const amount = units / 10; return `${Number.isInteger(amount) ? amount : amount.toFixed(1).replace(".", ",")} ${amount === 1 ? "moeda" : "moedas"}`; },
            moneyOf: (p) => purse.get(p.steamId) ?? 0,
            takeMoney: (p, units) => { if ((purse.get(p.steamId) ?? 0) < units) return false; purse.set(p.steamId, purse.get(p.steamId) - units); return true; },
            giveMoney: (p, units) => { purse.set(p.steamId, (purse.get(p.steamId) ?? 0) + units); return true; },
        },
        "./npc-keeper.js": { npcKeeper: { look: (...args) => { state.keeperLooks.push(plain(args)); return null; }, rescued() {}, forget() {} }, keeperNote: () => "" },
        "./npc-speech.js": SPEECH,
        // The barbers and the coachmen beside the vendors in the NPCs section, and the tamer's carts (2026-11-02).
        "./barbers.js": { barberListing: () => [] },
        "./carts.js": {
            cartsOf: (steamId) => state.carts.filter((cart) => cart.owner === steamId),
            giveCart: (p, blueprint) => {
                if (state.cartFails) return { ok: false, message: "o jogo não fez" };
                state.carts.push({ owner: p.steamId, blueprint });
                return { ok: true, message: "" };
            },
            MAX_CARTS: 2,
        },
        "./properties.js": { REGIONS: [] },
        "./travel.js": { coaches: { coachListing: () => [] } },
        "./place.js": { inFrontOf: () => ({ position: { x: 1, y: 2, z: 3 }, rotation: {} }) },
        "./status.js": {
            GUILDS,
            getGuildId: (steamId) => guildOf.get(steamId) ?? null,
            setGuildId: (steamId, guild) => { if (state.guildRefused) return false; guildSets.push([steamId, guild]); guildOf.set(steamId, guild); return true; },
            notice: (p, text) => notices.push([p.steamId, text]),
            sendSocial: (p) => socials.push(p.steamId),
        },
        "./store.js": {
            ensureDir() {},
            read: (file) => (state.files.has(file) ? { status: "ok", value: JSON.parse(state.files.get(file)) } : { status: "missing" }),
            write: (file, value) => { state.writes.push([file, plain(value)]); state.files.set(file, JSON.stringify(value)); },
        },
        "./townsfolk.js": {
            placeOf: (spot) => ({ x: spot.x, y: spot.y, z: spot.z }),
            townsperson: (soul, name, position, yaw, outfit, label) => {
                const npc = {
                    id: state.nextNpc++, soul, name, position, yaw, outfit, label, removed: false,
                    lookAt(who) { state.looks.push(who.id); },
                    teleport(at) { this.position = { x: at.x, y: at.y, z: at.z }; state.teleports.push([this.id, plain(at)]); return true; },
                    remove() { this.removed = true; npcs.delete(this.id); },
                };
                npcs.set(npc.id, npc);
                return npc;
            },
        },
        "./vendors.js": { buyNamesFor: (trade) => (trade === "ferreiro" ? ["bsmt_steelNormal", "guid-silver", "not-in-the-game"] : []) },
        "./wild-horses.js": { dress: (horse, where) => { dressed.push(where); return "uma sela"; } },
        "./free-changes.js": { CHANGE_PRICE_COINS: 100 },
    };

    const sandbox = {
        exports: {},
        require: (id) => requires[id] ?? assert.fail(`unexpected require ${id}`),
        console: { log: (line) => state.logs.push(line), error() {} },
        Vector3: function (x, y, z) { return { x, y, z }; },
        Date: { now: () => state.clock },
        Math,
        Object, Array, Set, Map, Number, JSON,
        setTimeout: (fn, ms) => { timers.push({ fn, ms, kind: "timeout" }); return timers.length; },
        setInterval: (fn, ms) => { timers.push({ fn, ms, kind: "interval" }); return timers.length; },
        clearTimeout() {},
        clearInterval() {},
        Chat: { sendToPlayer: (p, text) => chats.push([p.steamId, text]) },
        // The world's clock: noon unless a test moves it (the day is 06:00 to 21:00).
        World: { get hour() { return state.hour; } },
        Player: { all: () => players, getById: (id) => players.find((p) => p.id === id) ?? null },
        Npc: { getById: (id) => npcs.get(id) ?? null },
        Events: { on: (name, fn) => { handlers[name] = fn; }, onClient: (name, fn) => { clientHandlers[name] = fn; } },
        Inventory: { classes: () => [], getItemPrice: (item) => { const key = item.startsWith("guid:kcdc-craft:") ? item.slice(5) : item; const worth = WORTH[key]; return worth === undefined ? null : { pristine: worth, current: worth }; } },
        Dialogue: {
            open: (playerId, page) => { const id = dialogue.next++; dialogue.sessions.set(id, { playerId, page }); return id; },
            update: (session, page) => { const open = dialogue.sessions.get(session); if (!open) return false; open.page = page; return true; },
            close: (session) => dialogue.sessions.delete(session),
            sessionOf: (playerId) => [...dialogue.sessions].find(([, s]) => s.playerId === playerId)?.[0] ?? 0,
        },
        Vendor: {
            create: (options) => { const id = vendors.size + 1; vendors.set(id, { options, stock: [], buy: [], purse: options.purse ?? null }); return id; },
            destroy: (id) => { vendorCalls.destroyed.push(id); return true; },
            setStock: (id, rows) => { vendors.get(id).stock = plain(rows); return true; },
            setBuyPrices: (id, rows) => { vendors.get(id).buy = plain(rows); return true; },
            setPurse: (id, value) => { vendors.get(id).purse = value; return true; },
            getPurse: (id) => vendors.get(id).purse,
            open: (id, playerId, npcId) => { const session = 500 + vendorCalls.opened.length; vendorCalls.opened.push({ vendor: id, playerId, npcId }); trading.set(playerId, session); return session; },
            sessionOf: (playerId) => trading.get(playerId) ?? 0,
        },
        Horse: {
            breeds: () => ["pebbles", "bitterklee", "soldier"],
            spawn: (position, rotation, breed, name) => {
                if (state.horseFails) throw new Error("no room");
                const key = `h${horses.length + 1}`;
                horseKeys.set(key, true);
                const horse = { key, breed, name, position, given: null, destroyed: false, giveTo(p) { this.given = p.steamId; }, destroy() { this.destroyed = true; } };
                horses.push(horse);
                return horse;
            },
        },
    };
    vm.runInNewContext(dist("guild-vendors.js"), sandbox);
    sandbox.exports.installGuildVendors();
    const api = sandbox.exports;

    const talk = (p, postId) => {
        api.lookAtPosts(state.clock);
        const npc = [...npcs.values()].find((one) => one.name === (postId.startsWith("domador") ? "Mestre Domador" : "Mestre Ferreiro") && !one.removed && Math.abs(one.position.x - (postId.endsWith("suchdol") ? (postId.startsWith("domador") ? 120 : 100) : 5000)) < 1);
        handlers.npcInteract(npc, p);
        return { npc, session: [...dialogue.sessions].find(([, s]) => s.playerId === p.id)?.[0] ?? 0 };
    };
    const choose = (session, p, option) => handlers.dialogueChoice(session, p, option);
    const pageOf = (session) => dialogue.sessions.get(session)?.page;
    const lastTimeout = () => timers.filter((t) => t.kind === "timeout").at(-1);

    return { counters, api, state, timers, handlers, clientHandlers, emitted, notices, chats, socials, kits, guildSets, horses, horseKeys, dressed, purse, guildOf, freeLeft, dialogue, vendors, vendorCalls, trading, players, player, talk, choose, pageOf, lastTimeout, npcs, groundExports };
}

test("a body stands only while a player is near it: made when one comes within reach, taken away when none is, and kept while somebody is talking to it", () => {
    const w = load();
    const hans = w.player(1, HANS, [140, 100]);
    w.api.lookAtPosts(w.state.clock);
    assert.deepEqual([...w.npcs.values()].map((npc) => npc.name).sort(), ["Mestre Domador", "Mestre Ferreiro"], "the two of Suchdol, not the one of Raborsch");
    const smith = [...w.npcs.values()].find((npc) => npc.name === "Mestre Ferreiro");
    assert.equal(smith.soul, "townsman");
    assert.equal(smith.outfit, "12468c7d-7ab1-4afc-b102-b0e74c144e8c");
    assert.deepEqual(plain(smith.position), { x: 100, y: 100, z: 10 });
    w.api.lookAtPosts(w.state.clock);
    assert.equal(w.npcs.size, 2, "looking again makes no second body");

    // Somebody is talking to the smith: the body stays when everybody else has gone far away.
    const { session } = w.talk(hans, "ferreiro-suchdol");
    assert.ok(session > 0);
    hans.position = { x: 100, y: 100 + 160, z: 10 };
    w.api.lookAtPosts(w.state.clock);
    assert.equal(smith.removed, false, "the smith stays while he is spoken to");
    const tamer = [...w.npcs.values()].find((npc) => npc.name === "Mestre Domador");
    assert.equal(tamer, undefined, "the tamer, out of use, was taken away");
    // The talk ends, and he goes too.
    w.handlers.dialogueClosed(session);
    w.api.lookAtPosts(w.state.clock);
    assert.equal(smith.removed, true);
    assert.equal(w.npcs.size, 0);

    // Somebody who is not ready, or who is far, makes none.
    const w2 = load();
    w2.player(1, HANS, [100, 100], { ready: false });
    w2.api.lookAtPosts(w2.state.clock);
    assert.equal(w2.npcs.size, 0);
    w2.player(2, KAT, [4980, 5000]);
    w2.api.lookAtPosts(w2.state.clock);
    assert.deepEqual([...w2.npcs.values()].map((npc) => npc.name), ["Mestre Ferreiro"]);
    assert.deepEqual(plain([...w2.npcs.values()][0].position), { x: 5000, y: 5000, z: 10 });
});

test("E on a vendor opens the choice list: Comprar/Vender, Aprender Guilda, Sair; Sair closes it; a player in a talk already, or dead, opens none", () => {
    const w = load({ citizens: { [HANS]: "suchdol" } });
    const hans = w.player(1, HANS, [101, 100]);
    const { npc, session } = w.talk(hans, "ferreiro-suchdol");
    assert.ok(session > 0);
    assert.deepEqual(w.state.looks, [1], "he turns to look at who speaks to him");
    const page = w.pageOf(session);
    assert.match(page.line, /^Mestre Ferreiro de Suchdol: /);
    assert.deepEqual(plain(page.options.map((option) => [option.id, option.text])), [["trade", "Comprar/Vender"], ["learn", "Aprender Guilda: Ferreiro"], ["ask", "Tirar dúvidas"], ["leave", "Sair"]]);
    w.choose(session, hans, "leave");
    assert.equal(w.dialogue.sessions.size, 0);

    // Talking again while one is open does nothing more; a dead player opens none.
    const again = w.talk(hans, "ferreiro-suchdol");
    assert.ok(again.session > 0);
    w.handlers.npcInteract(npc, hans);
    assert.equal(w.dialogue.sessions.size, 1);
    const dead = w.player(2, KAT, [101, 100], { alive: false });
    w.handlers.npcInteract(npc, dead);
    assert.equal(w.dialogue.sessions.size, 1);
    // A choice from somebody else, or in a session that is not a vendor's, is nothing.
    w.choose(again.session, dead, "leave");
    assert.equal(w.dialogue.sessions.size, 1);
    w.choose(999, hans, "leave");
});

test("Comprar/Vender opens the game's trade screen on a vendor made for that player: the shelf of the day priced by rarity, a purse of 300 coins, and what it buys at 40%", () => {
    const w = load();
    const hans = w.player(1, HANS, [101, 100]);
    const { npc, session } = w.talk(hans, "ferreiro-suchdol");
    w.choose(session, hans, "trade");
    assert.equal(w.dialogue.sessions.size, 0, "the list is closed for the trade screen");
    assert.deepEqual(plain(w.vendorCalls.opened), [{ vendor: 1, playerId: 1, npcId: npc.id }]);
    const vendor = w.vendors.get(1);
    assert.deepEqual(plain(vendor.options), { name: "Mestre Ferreiro (Suchdol)", purse: 3000, buys: true });
    const row = (item) => vendor.stock.find((one) => one.item === item);
    assert.deepEqual(row("bsmt_ironBad"), { item: "bsmt_ironBad", amount: 20, price: 20 }, "a common thing: 2 coins");
    assert.deepEqual(row("bsmt_ironGood"), { item: "bsmt_ironGood", amount: 10, price: 60 }, "an uncommon one: 6 coins");
    assert.deepEqual(row("repairKit_armourSmall"), { item: "repairKit_armourSmall", amount: 2, price: 180 }, "a rare one: 18 coins");
    assert.equal(vendor.stock.length, 9, "the nine wares of the smith, all of them known to the server");
    assert.ok(vendor.stock.reduce((sum, one) => sum + one.amount * one.price, 0) <= 3000, "no more than 300 coins of wares");

    // What it buys: its own wares at 40% of their price, then the goods of its trade by what the game says they are worth (the realm's one price book, 2026-11-03); what the server does
    // not know is left out.
    const buy = (item) => vendor.buy.find((one) => one.item === item)?.price;
    assert.equal(buy("bsmt_ironBad"), 8);
    assert.equal(buy("repairKit_armourSmall"), 72);
    assert.equal(buy("bsmt_steelNormal"), 72, "worth 60 coins in the game: a rare thing");
    assert.equal(buy("guid-silver"), 200, "worth 90 coins: a very rare one");
    assert.equal(buy("not-in-the-game"), undefined);
    // One guild buys each thing (2026-11-03): the logs the smith also named are what the trees give, the Coletor's to buy.
    assert.equal(buy("guid:kcdc-craft:lenha"), undefined, "the logs are the Coletor's");
});

test("every player has a vendor of their own: what one buys and what the vendor pays one is gone for that player only, and is kept for the day", () => {
    const w = load({ money: { [HANS]: 99999 } });
    const hans = w.player(1, HANS, [101, 100]);
    const kat = w.player(2, KAT, [101, 100]);
    const trade = (p) => { const { session } = w.talk(p, "ferreiro-suchdol"); w.choose(session, p, "trade"); return w.vendorCalls.opened.at(-1).vendor; };

    const hansVendor = trade(hans);
    // Hans buys all the common iron, and the vendor has been paid: the game put his coins in its purse, which must not stay there.
    w.vendors.get(hansVendor).purse = 3000 + 400;
    w.handlers.vendorTrade(hansVendor, hans, [{ item: "guid-iron", name: "bsmt_ironBad", amount: 20, price: 20, metadata: {} }], [], 0);
    assert.equal(w.vendors.get(hansVendor).purse, 3000, "what he paid does not become the vendor's to pay out");
    // He then sells it 1,000 units of goods: the vendor pays them out of its purse.
    w.vendors.get(hansVendor).purse = 2000;
    w.handlers.vendorTrade(hansVendor, hans, [], [{ item: "guid-silver", name: "x", amount: 5, price: 200, metadata: {} }], 0);

    // Another player finds the shelf and the purse full.
    const katVendor = trade(kat);
    assert.notEqual(katVendor, hansVendor);
    assert.equal(w.vendors.get(katVendor).stock.find((one) => one.item === "bsmt_ironBad").amount, 20);
    assert.equal(w.vendors.get(katVendor).purse, 3000);
    // Hans, coming back, finds no iron on the shelf and 200 coins in the purse.
    const again = trade(hans);
    assert.equal(w.vendors.get(again).stock.some((one) => one.item === "bsmt_ironBad"), false);
    assert.equal(w.vendors.get(again).stock.find((one) => one.item === "bsmt_ironGood").amount, 10);
    assert.equal(w.vendors.get(again).purse, 2000);
    assert.ok(w.vendorCalls.destroyed.includes(hansVendor), "the vendor of the first trade is gone when the next is made");

    // Kept on disk (once the save timer runs): Hans's, not Kat's.
    for (const timer of w.timers.filter((t) => t.kind === "timeout" && t.ms === 3000)) timer.fn();
    const [file, saved] = w.state.writes.at(-1);
    assert.equal(file, "playerdata/guild-shops.json");
    assert.deepEqual(Object.keys(saved.records), [`${HANS}|fabri-ferrarii`], "one record for the guild, not for the vendor");
    assert.equal(saved.records[`${HANS}|fabri-ferrarii`].left.bsmt_ironBad, 0);
    assert.equal(saved.records[`${HANS}|fabri-ferrarii`].purse, 2000);

    // A day later, everything is full again.
    w.state.clock += DAY + 1;
    const next = trade(hans);
    assert.equal(w.vendors.get(next).stock.find((one) => one.item === "bsmt_ironBad").amount, 20);
    assert.equal(w.vendors.get(next).purse, 3000);
});

test("what was kept is read again at the next start, and a record a day old is not", () => {
    const clock = 10 * DAY;
    const left = { bsmt_ironBad: 0, special_charcoal: 20 };
    const w = load({ clock, money: {}, files: { "playerdata/guild-shops.json": JSON.stringify({ v: 1, records: {
        [`${HANS}|fabri-ferrarii`]: { since: clock - 3_600_000, left, purse: 1234 },
        [`${KAT}|fabri-ferrarii`]: { since: clock - 2 * DAY, left, purse: 5 },
        [`${KAT}|nowhere`]: { since: clock, left, purse: 5 },
    } }) } });
    const hans = w.player(1, HANS, [101, 100]);
    const kat = w.player(2, KAT, [101, 100]);
    const trade = (p) => { const { session } = w.talk(p, "ferreiro-suchdol"); w.choose(session, p, "trade"); return w.vendors.get(w.vendorCalls.opened.at(-1).vendor); };
    const kept = trade(hans);
    assert.equal(kept.stock.some((one) => one.item === "bsmt_ironBad"), false, "Hans bought the iron an hour ago");
    assert.equal(kept.purse, 1234);
    const old = trade(kat);
    assert.equal(old.stock.find((one) => one.item === "bsmt_ironBad").amount, 20, "Kat's record was two days old: a full shelf");
    assert.equal(old.purse, 3000);
});

test("the 300 coins are the guild's, not the vendor's: what a player bought or sold at the smith of one town is gone at the smith of every other town, and the other guild's vendors are untouched (2026-10-31)", () => {
    const w = load({ money: { [HANS]: 99999 } });
    const hans = w.player(1, HANS, [101, 100]);
    const trade = (postId) => { const { session } = w.talk(hans, postId); w.choose(session, hans, "trade"); return w.vendorCalls.opened.at(-1).vendor; };
    const first = trade("ferreiro-suchdol");
    w.vendors.get(first).purse = 3000 + 400;
    w.handlers.vendorTrade(first, hans, [{ item: "guid-iron", name: "bsmt_ironBad", amount: 20, price: 20, metadata: {} }], [], 0);
    w.vendors.get(first).purse = 1000;
    w.handlers.vendorTrade(first, hans, [], [{ item: "guid-silver", name: "x", amount: 5, price: 200, metadata: {} }], 0);

    // The smith of another town, on the other side of the map, has no iron for him and pays what is left of the same purse.
    hans.position = { x: 5001, y: 5000, z: 10 };
    const other = trade("ferreiro-raborsch");
    assert.equal(w.vendors.get(other).stock.some((one) => one.item === "bsmt_ironBad"), false, "the iron is gone for him everywhere");
    assert.equal(w.vendors.get(other).stock.find((one) => one.item === "bsmt_ironGood").amount, 10);
    assert.equal(w.vendors.get(other).purse, 1000, "and the purse is what was left at the first smith's");

    // What he does at the second smith counts at the first.
    w.vendors.get(other).purse = 400;
    w.handlers.vendorTrade(other, hans, [{ item: "guid-ironGood", name: "bsmt_ironGood", amount: 10, price: 60, metadata: {} }], [], 0);
    hans.position = { x: 101, y: 100, z: 10 };
    const back = trade("ferreiro-suchdol");
    assert.equal(w.vendors.get(back).stock.some((one) => one.item === "bsmt_ironGood"), false);
    assert.equal(w.vendors.get(back).purse, 400);

    // A tamer is another guild's: its shelf and purse are full.
    const { session } = w.talk(hans, "domador-suchdol");
    w.choose(session, hans, "trade");
    w.choose(session, hans, "wares");
    const tamer = w.vendorCalls.opened.at(-1).vendor;
    assert.notEqual(tamer, back);
    assert.equal(w.vendors.get(tamer).purse, 3000);
    assert.ok(w.vendors.get(tamer).stock.some((one) => one.item === "carrot"));
});

test("a file from before the limit was shared (one record for each vendor) is folded into the guild's: the most spent of each ware and of the purse, the later fill; a record a day old and one of a vendor that is gone are dropped (2026-10-31)", () => {
    const clock = 10 * DAY;
    const w = load({ clock, files: { "playerdata/guild-shops.json": JSON.stringify({ v: 1, records: {
        [`${HANS}|ferreiro-suchdol`]: { since: clock - 3 * 3_600_000, left: { bsmt_ironBad: 0, special_charcoal: 20, bsmt_ironGood: 10 }, purse: 2500 },
        [`${HANS}|ferreiro-raborsch`]: { since: clock - 3_600_000, left: { bsmt_ironBad: 7, special_charcoal: 5, bsmt_ironGood: 10 }, purse: 900 },
        [`${HANS}|domador-suchdol`]: { since: clock - 3_600_000, left: { carrot: 0 }, purse: 100 },
        [`${KAT}|ferreiro-raborsch`]: { since: clock - 2 * DAY, left: { bsmt_ironBad: 0 }, purse: 0 },
        [`${KAT}|ferreiro-gone`]: { since: clock - 3_600_000, left: { bsmt_ironBad: 0 }, purse: 0 },
    } }) } });
    const hans = w.player(1, HANS, [101, 100]);
    const kat = w.player(2, KAT, [101, 100]);
    const trade = (p) => { const { session } = w.talk(p, "ferreiro-suchdol"); w.choose(session, p, "trade"); return w.vendors.get(w.vendorCalls.opened.at(-1).vendor); };
    const folded = trade(hans);
    assert.equal(folded.stock.some((one) => one.item === "bsmt_ironBad"), false, "spent at the first");
    assert.equal(folded.stock.find((one) => one.item === "special_charcoal").amount, 5, "the less left of the two");
    assert.equal(folded.stock.find((one) => one.item === "bsmt_ironGood").amount, 10);
    assert.equal(folded.purse, 900, "the lower purse");
    const fresh = trade(kat);
    assert.equal(fresh.stock.find((one) => one.item === "bsmt_ironBad").amount, 20, "nothing kept for Kat");
    assert.equal(fresh.purse, 3000);
    // Saved again, it is one record for each guild.
    for (const timer of w.timers.filter((t) => t.kind === "timeout" && t.ms === 3000)) timer.fn();
    w.handlers.vendorTrade(w.vendorCalls.opened.at(-1).vendor, kat, [], [], 3000);
    for (const timer of w.timers.filter((t) => t.kind === "timeout" && t.ms === 3000)) timer.fn();
    const saved = w.state.writes.at(-1)[1];
    assert.deepEqual(Object.keys(saved.records).sort(), [`${HANS}|domitores`, `${HANS}|fabri-ferrarii`, `${KAT}|fabri-ferrarii`].sort());
});

test("learning the trade: a citizen of the town with no guild is offered it, with a few lines of talk, and takes it; the guild is theirs, with its kit", () => {
    const w = load({ citizens: { [HANS]: "suchdol" } });
    const hans = w.player(1, HANS, [101, 100]);
    const { session } = w.talk(hans, "ferreiro-suchdol");
    w.choose(session, hans, "learn");
    const offer = w.pageOf(session);
    assert.equal(offer.line, "Quer aprender o ofício de Ferreiro? Em Suchdol, quem é cidadão aprende comigo. É a sua primeira vez: o ofício é de graça. Depois, cada ofício novo custa 100 moedas.");
    assert.deepEqual(plain(offer.options.map((option) => option.id)), ["accept", "back"]);
    // Back is the first list again.
    w.choose(session, hans, "back");
    assert.deepEqual(plain(w.pageOf(session).options.map((option) => option.id)), ["trade", "learn", "ask", "leave"]);
    w.choose(session, hans, "learn");
    w.choose(session, hans, "accept");
    assert.deepEqual(plain(w.guildSets), [[HANS, "fabri-ferrarii"]]);
    assert.deepEqual(plain(w.kits), [[HANS, "fabri-ferrarii"]]);
    assert.equal(w.dialogue.sessions.size, 0);
    assert.deepEqual(w.notices.map(([, text]) => text), ["Kit da guilda entregue: 1 machado.", "Dica do ofício.", "Mestre Ferreiro de Suchdol lhe ensinou o ofício: você agora é Ferreiro (Fabri Ferrarii). Foi de graça, por ser a sua primeira vez: o próximo ofício custa 100 moedas."]);
    assert.ok(w.socials.includes(HANS));

    // Nobody can accept without the offer, and a second try says they are of the guild already.
    const second = w.talk(hans, "ferreiro-suchdol");
    w.choose(second.session, hans, "accept");
    assert.equal(w.guildSets.length, 1, "accept means nothing before the offer is on the screen");
    w.choose(second.session, hans, "learn");
    assert.equal(w.pageOf(second.session).line, "Você já é Ferreiro. Pratique o ofício: é só o que posso lhe dizer.");
});

test("the trade is taught only to the citizens of the town the vendor stands in: no citizenship, or another town's, is told so and refused", () => {
    const w = load({ citizens: { [KAT]: "raborsch" } });
    const hans = w.player(1, HANS, [101, 100]);
    const kat = w.player(2, KAT, [101, 100]);
    const rudi = w.player(3, RUDI, [101, 100], { steamId: "" });
    const asked = (p) => { const { session } = w.talk(p, "ferreiro-suchdol"); w.choose(session, p, "learn"); return w.pageOf(session); };
    const none = asked(hans);
    assert.match(none.line, /Só ensino o ofício a quem é cidadão de Suchdol\. Escolha a sua cidade na seção Cidadania do menu F2 e volte\./);
    assert.deepEqual(plain(none.options.map((option) => option.id)), ["back"], "nothing to accept");
    assert.match(asked(kat).line, /Você é cidadão de Raborsch\. Aqui em Suchdol só ensino a quem é daqui/);
    assert.match(asked(rudi).line, /identificação Steam/);
    assert.equal(w.guildSets.length, 0);
});

test("the first trade is free and every one after it costs 100 coins, the free change of the panel notwithstanding: told on the offer, charged at the end; no coins, no trade", () => {
    const w = load({ citizens: { [HANS]: "suchdol", [KAT]: "suchdol" }, guilds: { [HANS]: "tabernarii", [KAT]: "tabernarii" }, money: { [HANS]: 500, [KAT]: 1500 }, free: { [KAT]: true } });
    const hans = w.player(1, HANS, [101, 100]);
    const kat = w.player(2, KAT, [101, 100]);
    const offer = (p) => { const { session } = w.talk(p, "ferreiro-suchdol"); w.choose(session, p, "learn"); return { session, page: w.pageOf(session) }; };

    // Kat has the free change of the panel left, and a guild already: the vendor asks the price all the same.
    const dear = offer(kat);
    assert.match(dear.page.line, /Você deixaria Tabernarii: trocar de ofício custa 100 moedas\.$/);
    assert.doesNotMatch(dear.page.line, /gratuita|de graça/);
    w.choose(dear.session, kat, "accept");
    assert.equal(w.guildOf.get(KAT), "fabri-ferrarii");
    assert.equal(w.purse.get(KAT), 500, "100 coins paid, though she had the free change of the panel left");
    assert.match(w.notices.at(-1)[1], /Custou 100 moedas\.$/);

    // Hans has 50 coins: the price is said, and he cannot pay it.
    const short = offer(hans);
    w.choose(short.session, hans, "accept");
    assert.equal(w.guildOf.get(HANS), "tabernarii", "unchanged");
    assert.match(w.chats.at(-1)[1], /Aprender outro ofício custa 100 moedas e você tem 50 moedas\./);
    // With the coins he pays.
    w.purse.set(HANS, 1500);
    const paid = offer(hans);
    w.choose(paid.session, hans, "accept");
    assert.equal(w.guildOf.get(HANS), "fabri-ferrarii");
    assert.equal(w.purse.get(HANS), 500, "100 coins paid");
});

test("the first trade is free only once: a player who learned one and has none now (it was taken off) pays for the next; one who got a guild from a clerk pays for the first they learn here", () => {
    const w = load({ citizens: { [HANS]: "suchdol", [KAT]: "suchdol" }, guilds: { [KAT]: "venatores" }, money: { [HANS]: 3000, [KAT]: 3000 } });
    const hans = w.player(1, HANS, [101, 100]);
    const kat = w.player(2, KAT, [101, 100]);
    const learnFrom = (p, post) => { const { session } = w.talk(p, post); w.choose(session, p, "learn"); const line = w.pageOf(session).line; w.choose(session, p, "accept"); return line; };

    assert.match(learnFrom(hans, "ferreiro-suchdol"), /É a sua primeira vez: o ofício é de graça\./);
    assert.equal(w.purse.get(HANS), 3000, "the first one cost nothing");
    // The guild is taken off him (a clerk's remedy) and he asks the tamer for another: no guild, but not the first.
    w.guildOf.delete(HANS);
    const line = learnFrom(hans, "domador-suchdol");
    assert.match(line, /Aprender outro ofício custa 100 moedas\.$/);
    assert.equal(w.guildOf.get(HANS), "domitores");
    assert.equal(w.purse.get(HANS), 2000);

    // Kat's hunter's guild came from a clerk: she has a guild, so the first she learns here is a change, and costs.
    assert.match(learnFrom(kat, "ferreiro-suchdol"), /Você deixaria Venatores: trocar de ofício custa 100 moedas\./);
    assert.equal(w.purse.get(KAT), 2000);
});

test("who has learned a trade from a vendor is kept, and read again at the next start", () => {
    const first = load({ citizens: { [HANS]: "suchdol" }, money: { [HANS]: 3000 } });
    const hans = first.player(1, HANS, [101, 100]);
    const { session } = first.talk(hans, "ferreiro-suchdol");
    first.choose(session, hans, "learn");
    first.choose(session, hans, "accept");
    const written = first.state.writes.filter(([file]) => file === "playerdata/guild-learned.json").at(-1);
    assert.deepEqual(written[1], { v: 1, learned: [HANS] });

    // The next start, with the file there and the guild taken off him meanwhile: not the first any more.
    const later = load({ citizens: { [HANS]: "suchdol" }, money: { [HANS]: 3000 }, files: { "playerdata/guild-learned.json": JSON.stringify({ v: 1, learned: [HANS, "", 7] }) } });
    const again = later.player(1, HANS, [121, 100]);
    const talk = later.talk(again, "domador-suchdol");
    later.choose(talk.session, again, "learn");
    assert.match(later.pageOf(talk.session).line, /Aprender outro ofício custa 100 moedas\.$/);
    // A file nobody can read is left alone: nothing is written over it.
    const broken = load({ citizens: { [KAT]: "suchdol" }, money: { [KAT]: 3000 } });
    broken.state.files.set("playerdata/guild-learned.json", "{ nope");
    assert.equal(broken.state.writes.filter(([file]) => file === "playerdata/guild-learned.json").length, 0);
});

test("an administrator learns without paying and without using up the first; a trade the guild list turns down after the price was taken gives the price back and is not counted as learned", () => {
    const w = load({ citizens: { [ADMIN]: "suchdol", [HANS]: "suchdol" }, guilds: { [ADMIN]: "tabernarii", [HANS]: "tabernarii" }, money: { [ADMIN]: 0, [HANS]: 3000 } });
    const admin = w.player(1, ADMIN, [101, 100]);
    const { session } = w.talk(admin, "ferreiro-suchdol");
    w.choose(session, admin, "learn");
    assert.doesNotMatch(w.pageOf(session).line, /troca|custa|de graça/);
    w.choose(session, admin, "accept");
    assert.equal(w.guildOf.get(ADMIN), "fabri-ferrarii");
    assert.equal(w.notices.at(-1)[1], "Mestre Ferreiro de Suchdol lhe ensinou o ofício: você agora é Ferreiro (Fabri Ferrarii).");
    assert.equal(w.state.writes.filter(([file]) => file === "playerdata/guild-learned.json").length, 0, "an administrator's is not written down");

    // The guild list turns the change down after the price was taken: the price comes back.
    const hans = w.player(2, HANS, [101, 100]);
    const second = w.talk(hans, "ferreiro-suchdol");
    w.choose(second.session, hans, "learn");
    w.state.guildRefused = true;
    w.choose(second.session, hans, "accept");
    w.state.guildRefused = false;
    assert.equal(w.guildOf.get(HANS), "tabernarii");
    assert.equal(w.purse.get(HANS), 3000, "nothing was kept");
    assert.match(w.chats.at(-1)[1], /Essa guilda não pôde ser aprendida agora\./);
    assert.equal(w.state.writes.filter(([file]) => file === "playerdata/guild-learned.json").length, 0, "and it was no learning");
});

test("by night the vendors are gone: no body is made, those that stand are taken away, one somebody is talking to goes when the talk ends, and they are made again at dawn", () => {
    const w = load({ citizens: { [HANS]: "suchdol" } });
    w.api.guildVendorSettings.byDayOnly = true; // the night rule is a setting now: off by default (2026-10-31, "deixe de dia também")
    const hans = w.player(1, HANS, [101, 100]);
    w.api.lookAtPosts(w.state.clock);
    assert.equal(w.npcs.size, 2, "by day they stand");
    assert.equal(w.api.isNight(), false);

    // Dusk: the world's clock crosses 21:00. The smith has somebody talking to him; the tamer has nobody.
    const { session } = w.talk(hans, "ferreiro-suchdol");
    w.state.hour = 21;
    assert.equal(w.api.isNight(), true);
    w.api.lookAtPosts(w.state.clock);
    const names = [...w.npcs.values()].map((npc) => npc.name);
    assert.deepEqual(names, ["Mestre Ferreiro"], "the tamer is gone, the smith stays for the talk");
    w.handlers.dialogueClosed(session);
    w.api.lookAtPosts(w.state.clock);
    assert.equal(w.npcs.size, 0, "the talk is over: he is gone too");

    // All night, none comes back, whoever is near.
    for (const hour of [23.5, 2, 5.9]) {
        w.state.hour = hour;
        w.api.lookAtPosts(w.state.clock);
        assert.equal(w.npcs.size, 0, `at ${hour}`);
    }
    assert.ok(w.api.describeGuildPosts("suchdol").every((line) => line.includes("ausente (é noite: só existem de dia)")));

    // Dawn: they are made again.
    w.state.hour = 6;
    w.api.lookAtPosts(w.state.clock);
    assert.deepEqual([...w.npcs.values()].map((npc) => npc.name).sort(), ["Mestre Domador", "Mestre Ferreiro"]);
    assert.ok(w.api.describeGuildPosts("suchdol").every((line) => line.includes("em pé")));
});

test("the tamer sells the three weakest horses, all at 400 coins (200 until 2026-11-02) and named for their breed, one to a player: the price is taken, the breed is given in the plain tack; the next only when that horse is dead; no coins, no horse; a horse that cannot come gives the coins back (2026-10-31)", () => {
    const w = load({ money: { [HANS]: 5000, [KAT]: 1500 } });
    const hans = w.player(1, HANS, [121, 100]);
    const kat = w.player(2, KAT, [121, 100]);
    const { session } = w.talk(hans, "domador-suchdol");
    w.choose(session, hans, "trade");
    const horses = w.pageOf(session);
    assert.deepEqual(plain(horses.options.map((option) => [option.id, option.text, option.enabled])), [
        ["horse:pebbles", "Pebbles - Pangaré: 400 moedas", true],
        ["horse:cavalo-comum", "Montaria - Pangaré: 400 moedas", true],
        ["horse:bitterklee", "Bitterklee - Pangaré: 400 moedas", true],
        ["carts", "Carroças (800 moedas)", true],
        ["wares", "Ver o que mais tenho (comprar e vender)", true],
        ["back", "Voltar", true],
    ]);
    w.choose(session, hans, "horse:bitterklee");
    assert.equal(w.purse.get(HANS), 1000, "400 coins taken");
    assert.equal(w.horses.length, 1);
    assert.equal(w.horses[0].given, HANS);
    assert.equal(w.horses[0].breed, "bitterklee");
    assert.deepEqual(plain(w.dressed), ["domador-suchdol"]);
    assert.match(w.chats.at(-1)[1], /Você comprou Bitterklee - Pangaré por 400 moedas: veja em Animais \(F2\) para mudar o nome\./);
    assert.equal(w.horses[0].name, "Bitterklee - Pangaré", "born with the name it was sold under");
    assert.ok(w.pageOf(session).options.slice(0, 3).every((option) => option.enabled === false && /já tem um cavalo do domador/.test(option.text)), "one of this kind at a time");
    // Not another of any price, whatever the page says.
    w.purse.set(HANS, 5000);
    w.choose(session, hans, "horse:pebbles");
    assert.equal(w.horses.length, 1);
    assert.equal(w.purse.get(HANS), 5000);
    assert.match(w.chats.at(-1)[1], /só pode comprar outro quando esse morrer/);

    // The horse dies (nobody keeps it any more): the next one may be bought.
    w.horseKeys.set(w.horses[0].key, false);
    w.choose(session, hans, "horse:pebbles");
    assert.equal(w.horses.length, 2);
    assert.equal(w.horses[1].breed, "pebbles");
    assert.equal(w.purse.get(HANS), 1000, "400 coins");
    // The plain riding horse has no breed.
    w.horseKeys.set(w.horses[1].key, false);
    w.purse.set(HANS, 5000);
    w.choose(session, hans, "horse:cavalo-comum");
    assert.equal(w.horses[2].breed, undefined);

    // Kat has 150 coins: not enough for any of the three.
    const other = w.talk(kat, "domador-suchdol");
    w.choose(other.session, kat, "trade");
    w.choose(other.session, kat, "horse:bitterklee");
    assert.equal(w.horses.length, 3);
    assert.match(w.chats.at(-1)[1], /custa 400 moedas e você não tem o bastante/);

    // A horse that cannot be made gives the coins back, and she may still buy.
    w.purse.set(KAT, 5000);
    w.state.horseFails = true;
    w.choose(other.session, kat, "horse:pebbles");
    assert.equal(w.purse.get(KAT), 5000);
    assert.match(w.chats.at(-1)[1], /O cavalo não pôde vir agora; o seu dinheiro foi devolvido/);
    w.state.horseFails = false;
    w.choose(other.session, kat, "horse:pebbles");
    assert.equal(w.purse.get(KAT), 1000);
    assert.equal(w.horses.length, 4);
});

test("the tamer sells four carts at 800 coins, two to a player at most; and every vendor, asked to sell, sends the buyer to the players first (2026-11-02)", () => {
    globalThis.__spoken = [];
    const w = load({ money: { [HANS]: 20000 } });
    const hans = w.player(1, HANS, [121, 100]);
    const { session } = w.talk(hans, "domador-suchdol");
    w.choose(session, hans, "trade");
    assert.ok(globalThis.__spoken.some((line) => /neg[oó]ci/i.test(line.text)), "the vendor's word when asked to buy");
    w.choose(session, hans, "carts");
    const page = w.pageOf(session);
    assert.deepEqual(plain(page.options.map((option) => [option.id, option.text, option.enabled])), [
        ["cart:cart_b", "Carro de duas rodas: 800 moedas", true],
        ["cart:wagon_b", "Carroça aberta: 800 moedas", true],
        ["cart:wagon_b_covered", "Carroça coberta: 800 moedas", true],
        ["cart:wagon_a_cloth_carpets", "Carroça de tapetes: 800 moedas", true],
        ["horses", "Voltar aos cavalos", true],
    ]);
    w.choose(session, hans, "cart:wagon_b_covered");
    assert.equal(w.purse.get(HANS), 12000, "800 coins taken");
    assert.match(w.chats.at(-1)[1], /Você comprou uma carroça coberta por 800 moedas: está à sua frente/);
    // A cart the game would not make gives the coins back.
    w.state.cartFails = true;
    w.choose(session, hans, "cart:cart_b");
    assert.equal(w.purse.get(HANS), 12000);
    assert.match(w.chats.at(-1)[1], /a carroça não pôde vir agora; o seu dinheiro foi devolvido/i);
    w.state.cartFails = false;
    w.choose(session, hans, "cart:cart_b");
    assert.equal(w.state.carts.length, 2);
    // Two kept: no third.
    assert.ok(w.pageOf(session).options.slice(0, 4).every((option) => option.enabled === false && /já tem 2 carroças/.test(option.text)));
    w.choose(session, hans, "cart:wagon_b");
    assert.equal(w.state.carts.length, 2);
    assert.equal(w.purse.get(HANS), 4000);
    w.choose(session, hans, "horses");
    assert.ok(w.pageOf(session).options.some((option) => option.id === "horse:pebbles"));
});

test("the horse a player bought is remembered across a restart: still alive, the next waits; a horse whose key never came is forgotten after a while (2026-10-31)", () => {
    const w = load({ money: { [HANS]: 5000 }, files: { "playerdata/guild-horses.json": JSON.stringify({ v: 1, bought: { [HANS]: { key: "old", at: 1 } } }) } });
    assert.equal(w.api.ownsVendorHorse(HANS), false, "its record is gone: it died");
    w.horseKeys.set("old", true);
    const w2 = load({ money: { [HANS]: 5000 }, files: { "playerdata/guild-horses.json": JSON.stringify({ v: 1, bought: { [HANS]: { key: "old", at: 1 } } }) } });
    w2.horseKeys.set("old", true);
    assert.equal(w2.api.ownsVendorHorse(HANS), true, "alive");
    const w3 = load({ files: { "playerdata/guild-horses.json": JSON.stringify({ v: 1, bought: { [HANS]: { key: null, at: 1_000_000 } } }) }, clock: 1_000_000 });
    assert.equal(w3.api.ownsVendorHorse(HANS), true, "the key may still come");
    w3.state.clock += 60_000;
    assert.equal(w3.api.ownsVendorHorse(HANS), false, "and when it never does, it holds nobody back");
});

test("the tamer also trades what a horse eats on the trade screen, with no horse among the rows", () => {
    const w = load();
    const hans = w.player(1, HANS, [121, 100]);
    const { session } = w.talk(hans, "domador-suchdol");
    w.choose(session, hans, "trade");
    w.choose(session, hans, "wares");
    const vendor = w.vendors.get(1);
    assert.deepEqual(plain(vendor.stock.map((one) => one.item)), ["carrot", "apple", "pear", "beet", "turnip"]);
    assert.ok(vendor.stock.every((one) => one.price === 20));
    assert.ok(vendor.buy.some((one) => one.item === "horseshoeMilitary"));
});

test("an administrator moves a vendor with /mercador: the new place is kept and the body is made again there; the original place comes back", () => {
    const w = load();
    w.player(1, HANS, [101, 100]);
    w.api.lookAtPosts(w.state.clock);
    assert.equal(w.api.isGuildPostId("ferreiro-suchdol"), true);
    assert.equal(w.api.isGuildPostId("ferreiro-narnia"), false);
    assert.equal(w.api.guildPostCount(), 3);
    const before = [...w.npcs.values()].find((npc) => npc.name === "Mestre Ferreiro");
    assert.equal(w.api.moveGuildPost("ferreiro-suchdol", { x: 110, y: 110, z: 11 }, 45), true);
    assert.equal(before.removed, true, "the old body is taken away");
    const moved = [...w.npcs.values()].find((npc) => npc.name === "Mestre Ferreiro");
    assert.deepEqual(plain(moved.position), { x: 110, y: 110, z: 11 });
    assert.equal(moved.yaw, 45);
    assert.deepEqual(w.state.writes.at(-1), ["playerdata/guild-posts.json", { "ferreiro-suchdol": { x: 110, y: 110, z: 11, yaw: 45 } }]);
    assert.equal(w.api.moveGuildPost("ferreiro-narnia", { x: 1, y: 1, z: 1 }, 0), false);
    assert.ok(w.api.describeGuildPosts("suchdol").some((line) => line.includes("ferreiro-suchdol") && line.includes("em 110, 110, 11") && line.includes("lugar escolhido")));
    assert.ok(w.api.describeGuildPosts("raborsch").some((line) => line.includes("em volta do meio da vila")));
    assert.match(w.api.describeGuildPosts("narnia")[0], /Nenhum vendedor em 'narnia'/);
    assert.equal(w.api.resetGuildPosts("ferreiro-raborsch"), 0, "nothing had been moved there");
    assert.equal(w.api.resetGuildPosts(), 1);
    const back = [...w.npcs.values()].find((npc) => npc.name === "Mestre Ferreiro");
    assert.deepEqual(plain(back.position), { x: 100, y: 100, z: 10 });
});

test("a talk is closed when the player walks off or dies; a trade screen closed and forgotten is cleaned up; a player who leaves takes none with them", () => {
    const w = load();
    const hans = w.player(1, HANS, [101, 100]);
    const kat = w.player(2, KAT, [101, 100]);
    const a = w.talk(hans, "ferreiro-suchdol");
    const b = w.talk(kat, "ferreiro-suchdol");
    hans.position = { x: 300, y: 100, z: 10 };
    w.api.tidy(w.state.clock);
    assert.equal(w.dialogue.sessions.has(a.session), false, "Hans walked off");
    assert.equal(w.dialogue.sessions.has(b.session), true);
    kat.alive = false;
    w.api.tidy(w.state.clock);
    assert.equal(w.dialogue.sessions.has(b.session), false, "Kat died");

    const rudi = w.player(3, RUDI, [101, 100]);
    const trade = w.talk(rudi, "ferreiro-suchdol");
    w.choose(trade.session, rudi, "trade");
    const vendor = w.vendorCalls.opened.at(-1).vendor;
    w.api.tidy(w.state.clock);
    assert.equal(w.vendorCalls.destroyed.includes(vendor), false, "the screen is open");
    w.trading.delete(rudi.id);
    w.api.tidy(w.state.clock + 5_000);
    assert.equal(w.vendorCalls.destroyed.includes(vendor), false, "closed a moment ago: it may be opening");
    w.api.tidy(w.state.clock + 60_000);
    assert.equal(w.vendorCalls.destroyed.includes(vendor), true, "and gone when it has been closed for a while");

    const again = w.talk(rudi, "ferreiro-suchdol");
    w.choose(again.session, rudi, "trade");
    const second = w.vendorCalls.opened.at(-1).vendor;
    w.handlers.playerDisconnect(rudi);
    assert.equal(w.vendorCalls.destroyed.includes(second), true);
});

test("the town pages count the vendors as people who live in the town", () => {
    const w = load();
    assert.equal(w.counters.length, 1);
    assert.equal(w.counters[0]({ id: "suchdol" }), 2);
    assert.equal(w.counters[0]({ id: "raborsch" }), 1);
    assert.equal(w.counters[0]({ id: "wysoka" }), 0);
});

test("each vendor wears its trade over its head, and keeps its own name for the talk and the clothes (2026-10-31)", () => {
    const w = load();
    w.player(1, HANS, [110, 100]);
    w.api.lookAtPosts(w.state.clock);
    const bodies = [...w.npcs.values()];
    assert.deepEqual(bodies.map((npc) => npc.label).sort(), ["Domador", "Ferreiro"]);
    assert.deepEqual(bodies.map((npc) => npc.name).sort(), ["Mestre Domador", "Mestre Ferreiro"], "the name that picks the clothes is the vendor's own");
    assert.equal(w.api.tradeLabel({ guild: "fabri-ferrarii" }), "Ferreiro");
    assert.equal(w.api.tradeLabel({ guild: "domitores" }), "Domador");
});

test("the administrator's list: the vendors by region and village, each with the number /mercador aqui takes, and whether it stands (2026-10-31)", () => {
    const w = load();
    // Nobody near, by day: all away.
    let listing = plain(w.api.npcListing());
    assert.equal(listing.total, 3);
    assert.deepEqual(listing.groups.map((group) => [group.id, group.name, group.towns.map((town) => town.id)]), [["suchdol", "Suchdol e as suas terras", ["suchdol"]], ["raborsch", "Raborsch e as suas terras", ["raborsch"]]], "a town with no vendor (Wysoka) is not listed");
    assert.deepEqual(listing.groups[0].towns[0].posts.map((post) => [post.id, post.trade, post.name, post.state, post.place, post.at]), [
        ["ferreiro-suchdol", "Ferreiro", "Mestre Ferreiro", "away", "game", [100, 100, 10]],
        ["domador-suchdol", "Domador", "Mestre Domador", "away", "game", [120, 100, 10]],
    ], "in the order of the trades, with the id the command takes");
    assert.deepEqual(listing.groups[1].towns[0].posts.map((post) => [post.id, post.state, post.place]), [["ferreiro-raborsch", "away", "ring"]], "a place made round the middle of the village says so");

    // A player near Suchdol: its two stand.
    w.player(1, HANS, [110, 100]);
    w.api.lookAtPosts(w.state.clock);
    listing = plain(w.api.npcListing());
    assert.deepEqual(listing.groups[0].towns[0].posts.map((post) => post.state), ["up", "up"]);
    assert.equal(listing.groups[1].towns[0].posts[0].state, "away");

    // By night they are gone, and the list says why.
    w.api.guildVendorSettings.byDayOnly = true;
    w.state.hour = 23;
    w.api.lookAtPosts(w.state.clock);
    listing = plain(w.api.npcListing());
    assert.deepEqual(listing.groups[0].towns[0].posts.map((post) => post.state), ["night", "night"]);

    // One the administrator put somewhere else is told as chosen, at its new place.
    w.state.hour = 12;
    assert.equal(w.api.moveGuildPost("ferreiro-suchdol", { x: 7.4, y: 8.6, z: 9 }, 0), true);
    listing = plain(w.api.npcListing());
    const moved = listing.groups[0].towns[0].posts[0];
    assert.deepEqual([moved.place, moved.at], ["chosen", [7, 9, 9]]);
});

test("the F3 page asks for the list when it opens: an administrator is answered (in pieces if it is big), a player is not (2026-10-31)", () => {
    const w = load();
    const ask = w.clientHandlers["kcdc-gamemode:status.npcs"];
    assert.equal(typeof ask, "function");
    const hans = w.player(1, HANS, [0, 0]);
    const admin = w.player(2, ADMIN, [0, 0]);
    ask(hans);
    assert.deepEqual(w.emitted, [], "a player gets nothing");
    ask(admin);
    assert.equal(w.emitted.length, 1);
    assert.deepEqual([w.emitted[0][0], w.emitted[0][1], w.emitted[0][2].total], [ADMIN, "status.npcs", 3]);
    assert.equal(w.emitted[0][2].groups.length, 2);
});

test("by default the vendors are gone at night (2026-10-31: \"deixar os NPC só no dia mesmo\"), and the setting brings them back for the night (2026-10-31)", () => {
    const w = load();
    w.player(1, HANS, [110, 100]);
    w.state.hour = 23;
    w.api.lookAtPosts(w.state.clock);
    assert.equal(w.api.isNight(), true);
    assert.equal(w.npcs.size, 0, "none at night");
    w.api.guildVendorSettings.byDayOnly = false;
    w.api.lookAtPosts(w.state.clock);
    assert.equal(w.npcs.size, 2, "day and night when the rule is off");
});

test("an administrator switches a vendor off and on from the NPCs page: it is taken away and kept off across a restart, listed as off, and nobody else may (2026-10-31)", () => {
    const w = load();
    const admin = w.player(2, ADMIN, [110, 100]);
    const hans = w.player(1, HANS, [110, 100]);
    w.api.lookAtPosts(w.state.clock);
    assert.equal(w.npcs.size, 2);
    const ask = w.clientHandlers["kcdc-gamemode:status.npcDisable"];
    ask(hans, JSON.stringify({ id: "ferreiro-suchdol", off: 1 }));
    assert.equal(w.npcs.size, 2, "a player cannot");
    ask(admin, JSON.stringify({ id: "ferreiro-suchdol", off: 1 }));
    assert.deepEqual([...w.npcs.values()].map((npc) => npc.name), ["Mestre Domador"], "gone at once");
    w.api.lookAtPosts(w.state.clock);
    assert.equal(w.npcs.size, 1, "and not made again");
    const row = (listing, id) => listing.groups.flatMap((g) => g.towns.flatMap((town) => town.posts)).find((post) => post.id === id);
    assert.equal(row(w.emitted.at(-1)[2], "ferreiro-suchdol").state, "off", "the answer is the list as it is now");
    assert.deepEqual(plain(w.state.files.get("playerdata/guild-disabled.json") && JSON.parse(w.state.files.get("playerdata/guild-disabled.json"))), { v: 1, off: ["ferreiro-suchdol"] });
    ask(admin, JSON.stringify({ id: "nao-existe", off: 1 }));
    ask(admin, JSON.stringify({ id: "domador-suchdol", off: "sim" }));
    assert.equal(w.npcs.size, 1, "an unknown id or a bad flag changes nothing");

    const again = load({ files: { "playerdata/guild-disabled.json": w.state.files.get("playerdata/guild-disabled.json") } });
    again.player(1, HANS, [110, 100]);
    again.api.lookAtPosts(again.state.clock);
    assert.deepEqual([...again.npcs.values()].map((npc) => npc.name), ["Mestre Domador"], "still off after a restart");

    ask(admin, JSON.stringify({ id: "ferreiro-suchdol", off: 0 }));
    w.api.lookAtPosts(w.state.clock);
    assert.equal(w.npcs.size, 2, "on again");
});

test("a vendor switched off is not counted among the people of the town, and is again once it is on (2026-11-01)", () => {
    const w = load();
    const admin = w.player(2, ADMIN, [110, 100]);
    const ask = w.clientHandlers["kcdc-gamemode:status.npcDisable"];
    assert.equal(w.counters[0]({ id: "suchdol" }), 2);
    ask(admin, JSON.stringify({ id: "ferreiro-suchdol", off: 1 }));
    assert.equal(w.counters[0]({ id: "suchdol" }), 1, "the smith is gone from the count");
    assert.equal(w.counters[0]({ id: "raborsch" }), 1, "the other towns keep theirs");
    ask(admin, JSON.stringify({ id: "ferreiro-suchdol", off: 0 }));
    assert.equal(w.counters[0]({ id: "suchdol" }), 2, "and back when it is on");
});

test("opening the trade screen says what the vendor still buys of this player, that the account is theirs alone and the guild's, and when it fills again (2026-11-01)", () => {
    const w = load({ money: { [HANS]: 99999 } });
    const hans = w.player(1, HANS, [101, 100]);
    const trade = () => { const { session } = w.talk(hans, "ferreiro-suchdol"); w.choose(session, hans, "trade"); return w.vendorCalls.opened.at(-1).vendor; };
    const first = trade();
    assert.match(w.chats.at(-1)[1], /^Mestre Ferreiro: compra até 300 moedas de você\. A conta é só sua e vale para todos os vendedores desse ofício no reino; enche de novo 24 h depois do primeiro negócio\.$/);
    // He sells it goods worth 100 coins: the purse is down to 200 for him, and fills again a day after that first deal.
    w.vendors.get(first).purse = 2000;
    w.handlers.vendorTrade(first, hans, [], [{ item: "guid-silver", name: "x", amount: 5, price: 200, metadata: {} }], 0);
    w.state.clock += 5 * 60 * 60_000;
    trade();
    assert.match(w.chats.at(-1)[1], /ainda compra até 200 moedas de você\. .* enche de novo em 19 h\.$/);
    assert.equal(w.chats.filter(([who]) => who === HANS).length >= 2, true);
    // Another player is told of a full purse.
    const kat = w.player(2, KAT, [101, 100]);
    const { session } = w.talk(kat, "ferreiro-suchdol");
    w.choose(session, kat, "trade");
    assert.match(w.chats.at(-1)[1], /compra até 300 moedas de você/);
    assert.equal(w.chats.at(-1)[0], KAT);
});

// Lets the promises of the ground traces settle.
const settleTraces = () => new Promise((resolve) => setImmediate(resolve));

test("a vendor standing on air is set on what the players' games have under it, once a player is near enough, and made there again after (2026-11-01: \"ficam no ar voando\")", async () => {
    const w = load();
    // The game has the ground of Suchdol's smith 1.6 m under the mesh's point (a stall the mesh was baked with is not in the players' games).
    w.state.ground = (from) => [{ position: { x: from.x, y: from.y, z: 8.4 }, kind: "terrain", category: null, entityClass: null }];
    const hans = w.player(1, HANS, [100, 160]);
    w.api.lookAtPosts(w.state.clock);
    const smith = () => [...w.npcs.values()].find((one) => one.name === "Mestre Ferreiro" && !one.removed && Math.abs(one.position.x - 100) < 1);
    assert.equal(smith().position.z, 10, "made on the mesh's point");
    w.api.lookAtPosts(w.state.clock);
    assert.equal(w.state.traces.filter((t) => t.from.x === 100).length, 0, "60 m away: his game is not asked yet");

    hans.position = { x: 100, y: 125, z: 10 };
    w.api.lookAtPosts(w.state.clock);
    assert.equal(w.state.traces.filter((t) => t.from.x === 100).length, 1, "25 m away: asked once");
    assert.deepEqual(w.state.traces.filter((t) => t.from.x === 100)[0].from, { x: 100, y: 100, z: 10.6 });
    assert.deepEqual(w.state.traces.filter((t) => t.from.x === 100)[0].to, { x: 100, y: 100, z: -2 });
    assert.deepEqual(w.state.traces.filter((t) => t.from.x === 100)[0].options, { mode: "ground", maxHits: 4 });
    w.api.lookAtPosts(w.state.clock);
    assert.equal(w.state.traces.filter((t) => t.from.x === 100).length, 1, "not asked twice while the first is out");
    await settleTraces();
    assert.equal(smith().position.z, 8.4, "set on the ground");
    assert.ok(w.state.logs.some((line) => /Mestre Ferreiro \(ferreiro-suchdol\) estava 1\.60 m acima do chão em \(100, 100\): posto no chão, a 8\.40/.test(line)), w.state.logs.join(" | "));

    // The keeper looks at it from there, and not against the mesh.
    w.api.lookAtPosts(w.state.clock);
    const look = w.state.keeperLooks.filter((args) => args[0] === "ferreiro-suchdol").at(-1);
    assert.deepEqual([look[2].z, look[6]], [8.4, true]);
    assert.equal(w.state.traces.filter((t) => t.from.x === 100).length, 1, "known: not asked again");

    // Gone with the player, and made again on the ground when he comes back.
    hans.position = { x: 1000, y: 1000, z: 10 };
    w.api.lookAtPosts(w.state.clock);
    assert.equal(smith(), undefined);
    hans.position = { x: 100, y: 125, z: 10 };
    w.api.lookAtPosts(w.state.clock);
    assert.equal(smith().position.z, 8.4, "straight to where it was set");
    w.api.lookAtPosts(w.state.clock);
    assert.equal(w.state.traces.filter((t) => t.from.x === 100).length, 1);

    // The log sums the reads up now and then, so it shows they are made and answered.
    w.state.clock += 5 * 60_000;
    w.api.lookAtPosts(w.state.clock);
    assert.ok(w.state.logs.some((line) => /chão lido pelo jogo dos jogadores desde o início: \d+ já no chão, \d+ posto\(s\) no chão, 0 sem chão confiável, 0 sem resposta, 0 com erro/.test(line)), w.state.logs.join(" | "));

    // Moved by an administrator: the new spot is the mesh's again, and asked again.
    w.api.moveGuildPost("ferreiro-suchdol", { x: 100, y: 101, z: 10 }, 0);
    assert.equal(smith().position.z, 10);
    w.api.lookAtPosts(w.state.clock);
    assert.equal(w.state.traces.filter((t) => t.from.x === 100).length, 2);
});

test("a vendor on the ground is left as it is; the body itself, a tree's crown or a bush is no floor; a game that does not answer is asked again later, and a gap too great is not trusted", async () => {
    const { judgeGround } = load().groundExports;
    const hit = (z, extra = {}) => ({ z, kind: "terrain", category: null, entityClass: null, ...extra });
    assert.equal(judgeGround(10, [hit(9.85)]).kind, "right", "15 cm over: standing");
    assert.equal(judgeGround(10, [hit(10.1)]).kind, "right", "10 cm in: standing");
    assert.deepEqual(plain(judgeGround(10, [hit(10.4)])), { kind: "move", gap: -0.40000000000000036, z: 10.4 }, "sunk 40 cm: lifted");
    assert.equal(judgeGround(10, [hit(10.5, { kind: "entity", entityClass: "NPC" }), hit(8, { kind: "brush" })]).z, 8, "its own body is skipped");
    assert.equal(judgeGround(10, [hit(9, { kind: "vegetation", category: "tree" }), hit(7)]).z, 7, "a crown is skipped");
    assert.equal(judgeGround(10, [hit(9.9, { kind: "vegetation", category: "rock" })]).kind, "right", "a rock is ground");
    assert.equal(judgeGround(30, [hit(10)]).kind, "far");
    assert.equal(judgeGround(10, []).kind, "nothing");

    const w = load();
    const hans = w.player(1, HANS, [100, 110]);
    w.api.lookAtPosts(w.state.clock);
    w.api.lookAtPosts(w.state.clock);
    await settleTraces();
    assert.equal(w.state.traces.filter((t) => t.from.x === 100).length, 1, "no answer (state.ground is null)");
    w.api.lookAtPosts(w.state.clock);
    assert.equal(w.state.traces.filter((t) => t.from.x === 100).length, 1, "not asked again at once");
    w.state.clock += 30_001;
    w.state.ground = (from) => [{ position: { x: from.x, y: from.y, z: 9.9 }, kind: "terrain", category: null, entityClass: null }];
    w.api.lookAtPosts(w.state.clock);
    assert.equal(w.state.traces.filter((t) => t.from.x === 100).length, 2, "asked again after a while");
    await settleTraces();
    assert.deepEqual(w.state.teleports.filter(([id]) => w.npcs.get(id)?.name === "Mestre Ferreiro"), [], "10 cm over the ground: left");
    w.api.lookAtPosts(w.state.clock);
    const look = w.state.keeperLooks.filter((args) => args[0] === "ferreiro-suchdol").at(-1);
    assert.deepEqual([look[2].z, look[6]], [10, false], "and the keeper looks at it as before");
    assert.equal(hans.id, 1);
});

test("Tirar dúvidas: a vendor answers the trade's questions and the three every vendor answers, an answer in parts with Continuar, then back to the questions (2026-11-01)", () => {
    const w = load();
    const hans = w.player(1, HANS, [101, 100]);
    const { session } = w.talk(hans, "ferreiro-suchdol");
    assert.ok(w.pageOf(session).options.some((option) => option.id === "ask" && option.text === "Tirar dúvidas"), "a row of the list");
    w.choose(session, hans, "ask");
    const questions = plain(w.pageOf(session).options).map((option) => option.text);
    assert.deepEqual(questions, ["O que eu posso fazer sendo ferreiro?", "Onde eu trabalho e como começo?", "De onde vêm os materiais?", "Como subo de nível no ofício?", "O que você compra e vende?", "Como eu entro na guilda?", "Voltar", "Sair"], "eight rows: what the game's list takes");
    w.choose(session, hans, "q:what");
    let page = w.pageOf(session);
    assert.match(page.line, /^Mestre Ferreiro: Na forja se faz quase tudo de metal/);
    assert.deepEqual(plain(page.options).map((option) => option.id), ["next", "questions", "back", "leave"]);
    w.choose(session, hans, "next");
    page = w.pageOf(session);
    assert.match(page.line, /ferraduras, selas e arreios/);
    assert.deepEqual(plain(page.options).map((option) => option.id), ["questions", "back", "leave"], "the last part: no Continuar");
    w.choose(session, hans, "questions");
    w.choose(session, hans, "q:level");
    assert.match(w.pageOf(session).line, /XP de Artesanato/);
    w.choose(session, hans, "questions");
    w.choose(session, hans, "q:shop");
    assert.match(w.pageOf(session).line, /todos os ferreiros do reino/);
    w.choose(session, hans, "back");
    assert.ok(w.pageOf(session).options.some((option) => option.id === "trade"), "back to the vendor's list");
});

test("every guild's vendor has its own questions, answered in lines the game's dialogue can show (2026-11-01)", () => {
    const sandbox = { exports: {} };
    vm.runInNewContext(dist("vendor-talk.js"), sandbox);
    const { topicsOf } = sandbox.exports;
    const guilds = { "fabri-ferrarii": "Ferreiro", artifices: "Artesão", alchemistae: "Alquimista", tabernarii: "Taberneiro", venatores: "Caçador", collectores: "Coletor", agricolae: "Agricultor", domitores: "Domador" };
    for (const [id, profession] of Object.entries(guilds)) {
        const topics = topicsOf(id, profession);
        assert.equal(topics.length, 6, `${id}: three of the trade, three of every vendor`);
        assert.equal(new Set(topics.map((topic) => topic.id)).size, 6);
        for (const topic of topics) {
            assert.ok(topic.question.endsWith("?"), topic.question);
            assert.ok(topic.answer.length >= 1 && topic.answer.every((line) => line.length > 20 && line.length <= 260), `${id} ${topic.id}: ${topic.answer.map((line) => line.length)}`);
        }
    }
    assert.match(topicsOf("venatores", "Caçador").find((topic) => topic.id === "shop").answer[0], /todos os caçadores do reino/);
    assert.match(topicsOf("domitores", "Domador").find((topic) => topic.id === "shop").answer[0], /Três cavalos mansos/);
});

test("the vendor says each page's line in the player's chat card as the talk goes on, turned to them, and turns back to its own way when it is over (2026-11-02)", () => {
    globalThis.__spoken = [];
    globalThis.__turnBacks = [];
    const w = load({ citizens: { [HANS]: "suchdol" } });
    const hans = w.player(1, HANS, [101, 100]);
    const { npc, session } = w.talk(hans, "ferreiro-suchdol");
    assert.equal(globalThis.__spoken.length, 1);
    const [greeting] = globalThis.__spoken;
    assert.equal(greeting.author, "Mestre Ferreiro de Suchdol");
    assert.equal(greeting.text, "O ferro não espera. Kits de reparo e metal de forja, é o que tenho.");
    assert.deepEqual(Array.from(greeting.to), [1], "to the one it talks to");
    assert.equal(globalThis.__turnBacks.length, 1);
    assert.deepEqual(globalThis.__turnBacks[0].slice(0, 2), [npc.id, 1]);
    assert.equal(typeof globalThis.__turnBacks[0][2], "number", "back to its post's way");
    w.choose(session, hans, "ask");
    assert.equal(globalThis.__spoken.length, 2);
    assert.deepEqual([globalThis.__spoken[1].author, globalThis.__spoken[1].text], ["Mestre Ferreiro", "pergunte o que quiser sobre o ofício."]);
});
