// Carts that belong to players (src/server/carts.ts) over the real store and position helpers, with a fake game.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const dist = (name) => fs.readFileSync(path.join(__dirname, "../dist/server", name), "utf8");
const plain = (value) => JSON.parse(JSON.stringify(value));
const MAURO = "76561198000000001";
const HANS = "76561198000000002";
const WAGON_SEATS = ["driver", "bench", "rightFront", "leftFront", "rightBack", "leftBack"];

function fakeDisk(seed) {
    const files = new Map(seed === undefined ? [] : [["playerdata/carts.json", JSON.stringify(seed)]]);
    return {
        files,
        fs: {
            readFileSync(file) { if (!files.has(file)) throw new Error("ENOENT"); return files.get(file); },
            writeFileSync(file, data) { files.set(file, data); },
            mkdirSync() {},
            renameSync(from, to) { files.set(to, files.get(from)); files.delete(from); },
            existsSync: (file) => files.has(file),
        },
    };
}

function load({ seed, admins = [], refuseSeat = false } = {}) {
    const disk = fakeDisk(seed);
    const store = { exports: {}, require: () => disk.fs };
    vm.runInNewContext(dist("store.js"), store);
    const position = { exports: {}, require: () => disk.fs, console: { log() {} } };
    vm.runInNewContext(dist("position.js"), position);

    const handlers = new Map();
    const clientHandlers = new Map();
    const players = new Map();
    const carts = new Map();
    const chat = [];
    const logs = [];
    const dialogues = { opened: [], closed: [], next: 1 };
    const intervals = [];
    let nextId = 300;

    const fire = (name, ...args) => {
        let result;
        for (const fn of handlers.get(name) ?? []) result = fn(...args) ?? result;
        return result;
    };
    const makeCart = (blueprint = "wagon_b_covered", at = { x: 0, y: 0, z: 0 }, yaw = 0) => {
        const seats = blueprint === "cart_b" ? ["driver", "rightBack", "leftBack"] : WAGON_SEATS;
        const occupants = new Map();
        const cart = {
            id: nextId++, blueprint, seats, horseCount: blueprint === "cart_b" ? 1 : 2, virtualWorld: 0,
            position: { ...at }, rotation: { x: 0, y: 0, z: yaw },
            destroyed: false, teleports: [],
            getOccupant: (seat) => occupants.get(seat) ?? null,
            seatOf: (player) => [...occupants.entries()].find(([, who]) => who.id === player.id)?.[0] ?? null,
            putPlayer(player, seat) {
                if (refuseSeat || occupants.has(seat)) return false;
                for (const [other, who] of occupants) if (who.id === player.id) occupants.delete(other);
                occupants.set(seat, player);
                fire("cartEnter", cart, player, seat);
                return true;
            },
            removePlayer(player) {
                const seat = cart.seatOf(player);
                if (seat === null) return false;
                occupants.delete(seat);
                fire("cartExit", cart, player, seat);
                return true;
            },
            teleport(to, rotation) { cart.teleports.push({ to: { ...to }, rotation }); cart.position = { x: to.x, y: to.y, z: to.z }; return true; },
            destroy() { cart.destroyed = true; carts.delete(cart.id); fire("cartDestroy", cart); },
        };
        carts.set(cart.id, cart);
        return cart;
    };
    const context = {
        exports: {},
        require: (id) => {
            if (id === "./store.js") return store.exports;
            if (id === "./position.js") return position.exports;
            if (id === "./auth.js") return { isAdmin: (player) => admins.includes(player.steamId) };
            assert.fail(`unexpected require ${id}`);
        },
        console: { log: (line) => logs.push(line), error: (line) => logs.push(line) },
        setInterval: (fn, ms) => { intervals.push({ fn, ms }); return intervals.length; },
        clearInterval() {},
        Vector3: class { constructor(x, y, z) { Object.assign(this, { x, y, z }); } },
        Chat: { sendToPlayer: (player, text) => chat.push({ to: player.id, text }) },
        Events: { on: (name, fn) => handlers.set(name, [...(handlers.get(name) ?? []), fn]), onClient: (name, fn) => clientHandlers.set(name, fn) },
        Player: { all: () => [...players.values()], getById: (id) => players.get(id) ?? null },
        Dialogue: {
            open: (playerId, page) => { const session = dialogues.next++; dialogues.opened.push({ session, playerId, page }); return session; },
            close: (session) => dialogues.closed.push(session),
        },
        Cart: {
            spawn: (blueprint, position, rotation) => makeCart(blueprint, position, rotation.z),
            all: () => [...carts.values()],
            getById: (id) => carts.get(id) ?? null,
            blueprints: () => ["wagon_b_covered", "wagon_b_covered_empty", "cart_b"],
        },
    };
    vm.runInNewContext(dist("carts.js"), context);
    context.exports.installCarts();

    const emitted = [];
    const player = (steamId, nickname, id, at = { x: 0, y: 0, z: 0 }, yaw = 0) => {
        const made = { steamId, nickname, id, position: { ...at }, rotation: { x: 0, y: 0, z: yaw }, ready: true, alive: true, virtualWorld: 0, emit: (event, payload) => emitted.push({ to: id, event, payload: JSON.parse(payload) }) };
        players.set(id, made);
        return made;
    };
    return { api: context.exports, fire, clientHandlers, handlers, makeCart, player, carts, chat, logs, dialogues, emitted, intervals, disk };
}

test("an administrator gives a player a cart in front of them, and it is theirs, kept in a file", () => {
    const sut = load();
    const hans = sut.player(HANS, "Hans", 2, { x: 100, y: 200, z: 10 }, 0);
    const outcome = sut.api.giveCart(hans);
    assert.equal(outcome.ok, true, outcome.message);
    assert.match(outcome.message, /Carroça coberta agora é de Hans/);
    const [owned] = sut.api.cartsOf(HANS);
    assert.ok(owned.cart !== null);
    // Facing +Y at yaw 0: seven metres ahead.
    assert.ok(Math.abs(owned.cart.position.x - 100) < 1e-6 && Math.abs(owned.cart.position.y - 207) < 1e-6);
    const saved = JSON.parse(sut.disk.files.get("playerdata/carts.json")).carts[0];
    assert.deepEqual([saved.owner, saved.blueprint, saved.name], [HANS, "wagon_b_covered", ""]);
    assert.equal(sut.api.recordOfCart(owned.cart).owner, HANS);
});

test("two carts at most, a model that exists, a player with a Steam id and a body in the world", () => {
    const sut = load();
    const hans = sut.player(HANS, "Hans", 2);
    assert.equal(sut.api.giveCart(hans, "carruagem").ok, false);
    assert.equal(sut.api.giveCart(sut.player("", "Sem Steam", 3)).ok, false);
    const loading = sut.player("76561198000000009", "Ondra", 4);
    loading.ready = false;
    assert.equal(sut.api.giveCart(loading).ok, false);
    assert.equal(sut.api.giveCart(hans, "cart_b").ok, true);
    assert.equal(sut.api.giveCart(hans).ok, true);
    const third = sut.api.giveCart(hans);
    assert.equal(third.ok, false);
    assert.match(third.message, /já tem 2 carroças/);
});

test("the cart beside a player that nobody owns can be registered as theirs, once", () => {
    const sut = load();
    const hans = sut.player(HANS, "Hans", 2, { x: 10, y: 10, z: 0 });
    assert.match(sut.api.registerCart(hans).message, /Nenhuma carroça sem dono/);
    const lone = sut.makeCart("wagon_b_covered", { x: 14, y: 10, z: 0 });
    const far = sut.makeCart("cart_b", { x: 500, y: 10, z: 0 });
    assert.equal(sut.api.registerCart(hans).ok, true);
    assert.equal(sut.api.recordOfCart(lone).owner, HANS);
    assert.equal(sut.api.recordOfCart(far), null);
    assert.match(sut.api.registerCart(hans).message, /Nenhuma carroça sem dono/, "the owned one is no longer a candidate");
});

test("the owner names a cart, within the limits; a stranger cannot, and an empty name takes the name away", () => {
    const sut = load();
    const hans = sut.player(HANS, "Hans", 2);
    sut.api.giveCart(hans);
    const key = sut.api.cartsOf(HANS)[0].record.key;
    assert.match(sut.api.renameCart(HANS, key, "Dourada").message, /se chama Dourada/);
    assert.equal(sut.api.cartsOf(HANS)[0].record.name, "Dourada");
    assert.equal(JSON.parse(sut.disk.files.get("playerdata/carts.json")).carts[0].name, "Dourada");
    assert.equal(sut.api.renameCart(HANS, key, "D").ok, false);
    assert.equal(sut.api.renameCart(HANS, key, "x".repeat(25)).ok, false);
    assert.equal(sut.api.renameCart(HANS, key, 7).ok, false);
    assert.equal(sut.api.renameCart(MAURO, key, "Minha").ok, false);
    assert.equal(sut.api.renameCart(HANS, "nao-existe", "Minha").ok, false);
    assert.equal(sut.api.renameCart(HANS, key, "  Rápida \n  Real ").ok, true);
    assert.equal(sut.api.cartsOf(HANS)[0].record.name, "Rápida Real");
    assert.equal(sut.api.renameCart(HANS, key, "").ok, true);
    assert.equal(sut.api.cartsOf(HANS)[0].record.name, "");
});

test("the owner's empty cart is brought to the front of them, no oftener than every two minutes, and not while somebody is on it", () => {
    const sut = load();
    const hans = sut.player(HANS, "Hans", 2, { x: 0, y: 0, z: 0 }, 0);
    sut.api.giveCart(hans);
    const { cart, record } = sut.api.cartsOf(HANS)[0];
    cart.position = { x: 900, y: 900, z: 0 };
    const t0 = 1_000_000;
    const brought = sut.api.bringCart(hans, null, t0);
    assert.equal(brought.ok, true, brought.message);
    assert.ok(Math.abs(cart.position.y - 9) < 1e-6, "nine metres ahead");
    assert.equal(sut.api.bringCart(hans, null, t0 + 60_000).ok, false);
    assert.match(sut.api.bringCart(hans, null, t0 + 60_000).message, /de novo em 1 min/);
    cart.position = { x: 900, y: 900, z: 0 };
    assert.equal(sut.api.bringCart(hans, record.key, t0 + 121_000).ok, true);

    cart.putPlayer(sut.player(MAURO, "Mauro", 3), "bench");
    assert.match(sut.api.bringCart(hans, null, t0 + 600_000).message, /está com gente/);
    assert.match(sut.api.bringCart(sut.player("76561198000000007", "Kat", 5), null, t0).message, /não tem uma carroça no mundo/);
});

test("a cart that has an owner is locked to the owner and an administrator, in every seat, until the owner leaves it free; a cart nobody owns takes anybody", () => {
    const sut = load({ admins: ["76561198000000099"] });
    const hans = sut.player(HANS, "Hans", 2);
    const mauro = sut.player(MAURO, "Mauro", 3);
    const admin = sut.player("76561198000000099", "Adm", 4);
    sut.api.giveCart(hans);
    const { cart, record } = sut.api.cartsOf(HANS)[0];
    assert.equal(sut.api.mayDrive(hans, cart), true);
    assert.equal(sut.api.mayDrive(admin, cart), true);
    assert.equal(sut.api.mayDrive(mauro, cart), false);
    assert.equal(sut.fire("cartEntering", cart, mauro, "driver"), false, "the game's own prompt at the reins reaches the same rule");
    assert.ok(sut.chat.some((line) => line.to === 3 && /trancada: só o dono sobe nela/.test(line.text)));
    assert.equal(sut.fire("cartEntering", cart, mauro, "bench"), false, "no seat is anybody's while it is locked");
    assert.equal(sut.fire("cartEntering", cart, hans, "driver"), undefined);

    // Left free: anybody gets on and drives; only the owner changes it.
    assert.equal(sut.api.setCartShared(MAURO, record.key, true).ok, false, "not his cart");
    const freed = sut.api.setCartShared(HANS, record.key, true);
    assert.equal(freed.ok, true);
    assert.match(freed.message, /está livre/);
    assert.equal(sut.api.mayDrive(mauro, cart), true);
    assert.equal(sut.fire("cartEntering", cart, mauro, "driver"), undefined);
    assert.equal(sut.fire("cartEntering", cart, mauro, "bench"), undefined);
    assert.equal(sut.api.cartsOf(HANS)[0].record.shared, true, "kept with the cart");
    assert.match(sut.api.setCartShared(HANS, record.key, false).message, /está trancada: só você sobe/);
    assert.equal(sut.api.mayDrive(mauro, cart), false);
    assert.equal(sut.api.cartsOf(HANS)[0].record.shared, undefined);

    const lone = sut.makeCart();
    assert.equal(sut.api.mayDrive(mauro, lone), true);
    assert.equal(sut.fire("cartEntering", lone, mauro, "driver"), undefined);
});

test("E near a cart asks for the seats, each shown free, taken, or the owner's (all of them while it is locked), and 'Descer' when already on", () => {
    const sut = load();
    const hans = sut.player(HANS, "Hans", 2, { x: 0, y: 0, z: 0 });
    const mauro = sut.player(MAURO, "Mauro", 3, { x: 2, y: 0, z: 0 });
    sut.api.giveCart(hans);
    const { cart, record } = sut.api.cartsOf(HANS)[0];
    cart.position = { x: 3, y: 1, z: 0 };
    sut.api.renameCart(HANS, record.key, "Dourada");
    cart.putPlayer(hans, "bench");

    sut.clientHandlers.get("kcdc-gamemode:cart.use")(mauro);
    const locked = sut.dialogues.opened.at(-1).page;
    assert.ok(locked.options.filter((option) => option.id.startsWith("seat:") && option.id !== "seat:bench").every((option) => option.enabled === false && /só o dono/.test(option.text)), "locked: no seat is a stranger's");

    sut.api.setCartShared(HANS, record.key, true);
    sut.clientHandlers.get("kcdc-gamemode:cart.use")(mauro);
    const page = sut.dialogues.opened.at(-1).page;
    assert.match(page.line, /Dourada, de Hans: onde você quer ficar\?/);
    const text = (id) => page.options.find((option) => option.id === id);
    assert.equal(text("seat:driver").enabled, true, "left free, the reins too");
    assert.equal(text("seat:bench").enabled, false);
    assert.match(text("seat:bench").text, /Banco, ao lado do condutor \(ocupado\)/);
    assert.equal(text("seat:rightBack").enabled, true);
    assert.equal(text("leave"), undefined, "he is not on it");
    assert.ok(text("close"));
    assert.ok(page.options.length <= 8);

    sut.clientHandlers.get("kcdc-gamemode:cart.use")(hans);
    const own = sut.dialogues.opened.at(-1).page;
    assert.match(own.options.find((option) => option.id === "seat:bench").text, /você está aqui/);
    assert.equal(own.options.find((option) => option.id === "seat:driver").enabled, true, "the owner may take the reins");
    assert.ok(own.options.find((option) => option.id === "leave"));
});

test("choosing a seat sits the player there; a locked cart, a taken seat, a long way off and a nonsense choice are refused", () => {
    const sut = load();
    const hans = sut.player(HANS, "Hans", 2, { x: 0, y: 0, z: 0 });
    const mauro = sut.player(MAURO, "Mauro", 3, { x: 2, y: 0, z: 0 });
    sut.api.giveCart(hans);
    const { cart, record } = sut.api.cartsOf(HANS)[0];
    cart.position = { x: 3, y: 1, z: 0 };

    const open = (player) => { sut.clientHandlers.get("kcdc-gamemode:cart.use")(player); return sut.dialogues.opened.at(-1).session; };
    sut.fire("dialogueChoice", open(mauro), mauro, "seat:rightBack");
    assert.equal(cart.seatOf(mauro), null, "locked: the owner's alone");
    assert.ok(sut.chat.some((line) => line.to === 3 && /trancada: só o dono sobe nela/.test(line.text)));

    sut.api.setCartShared(HANS, record.key, true);
    sut.fire("dialogueChoice", open(mauro), mauro, "seat:rightBack");
    assert.equal(cart.seatOf(mauro), "rightBack");

    sut.fire("dialogueChoice", open(mauro), mauro, "leave");
    assert.equal(cart.seatOf(mauro), null);

    const session = open(mauro);
    cart.putPlayer(hans, "leftBack");
    sut.fire("dialogueChoice", session, mauro, "seat:leftBack");
    assert.equal(cart.seatOf(mauro), null);
    assert.ok(sut.chat.some((line) => line.to === 3 && /já tem alguém/.test(line.text)));

    const far = open(mauro);
    mauro.position = { x: 400, y: 0, z: 0 };
    sut.fire("dialogueChoice", far, mauro, "seat:bench");
    assert.equal(cart.seatOf(mauro), null);
    assert.ok(sut.chat.some((line) => line.to === 3 && /afastou demais/.test(line.text)));

    mauro.position = { x: 2, y: 0, z: 0 };
    const odd = open(mauro);
    sut.fire("dialogueChoice", odd, mauro, "seat:wheelbarrow");
    assert.equal(cart.seatOf(mauro), null);
    sut.fire("dialogueChoice", 999, mauro, "seat:bench");
    sut.fire("dialogueChoice", open(hans), mauro, "seat:bench");
    assert.equal(cart.seatOf(mauro), null, "somebody else's menu is not his");

    const closing = open(mauro);
    sut.fire("dialogueChoice", closing, mauro, "close");
    assert.ok(sut.dialogues.closed.includes(closing));
});

test("E far from every cart, or from a dead body, asks nothing; the client is told which cart is near, once per change", () => {
    const sut = load();
    const hans = sut.player(HANS, "Hans", 2, { x: 0, y: 0, z: 0 });
    const cart = sut.makeCart("wagon_b_covered", { x: 4, y: 0, z: 0 });
    sut.api.useCart(sut.player(MAURO, "Mauro", 3, { x: 300, y: 0, z: 0 }));
    assert.equal(sut.dialogues.opened.length, 0);
    hans.alive = false;
    sut.api.useCart(hans);
    assert.equal(sut.dialogues.opened.length, 0);
    hans.alive = true;

    const near = sut.intervals.find((interval) => interval.ms === 1_000);
    near.fn();
    near.fn();
    const told = sut.emitted.filter((entry) => entry.to === 2 && entry.event === "kcdc-gamemode:cart.near");
    assert.deepEqual(told.map((entry) => entry.payload.id), [cart.id], "once, not every second");
    hans.position = { x: 200, y: 0, z: 0 };
    near.fn();
    assert.deepEqual(sut.emitted.filter((entry) => entry.to === 2).map((entry) => entry.payload.id), [cart.id, 0]);
    assert.ok(sut.emitted.some((entry) => entry.to === 3 && entry.payload.id === 0) === false, "nothing said to somebody who was never near");
});

test("a saved cart is brought back where it was left, with its owner and name, after a restart, and a cart removed from the world is forgotten", () => {
    const sut = load();
    const hans = sut.player(HANS, "Hans", 2, { x: 50, y: 60, z: 7 }, 0);
    sut.api.giveCart(hans, "cart_b");
    const { cart, record } = sut.api.cartsOf(HANS)[0];
    sut.api.renameCart(HANS, record.key, "Vaivém");
    cart.position = { x: 123, y: 456, z: 78 };
    cart.rotation = { x: 0, y: 0, z: 90 };
    sut.fire("cartExit", cart, hans, "driver");
    const seed = JSON.parse(sut.disk.files.get("playerdata/carts.json"));
    assert.deepEqual([seed.carts[0].x, seed.carts[0].y, seed.carts[0].z, seed.carts[0].yaw], [123, 456, 78, 90]);

    const again = load({ seed });
    const [back] = again.api.cartsOf(HANS);
    assert.equal(back.record.name, "Vaivém");
    assert.ok(back.cart !== null);
    assert.equal(back.cart.blueprint, "cart_b");
    assert.deepEqual([back.cart.position.x, back.cart.position.y], [123, 456]);
    assert.ok(again.logs.some((line) => /1 carroça\(s\) com dono guardada\(s\); 1 de volta ao mundo/.test(line)));

    back.cart.destroy();
    assert.deepEqual(plain(again.api.cartsOf(HANS)), [], "an administrator removed it: it is no longer kept");
    assert.deepEqual(JSON.parse(again.disk.files.get("playerdata/carts.json")).carts, []);
});

test("an administrator can let a cart go, and a stored file with bad rows loads only the good ones", () => {
    const sut = load({ seed: { v: 1, carts: [{ key: "ok", owner: HANS, ownerName: "Hans", blueprint: "wagon_b_covered", name: "", x: 1, y: 2, z: 3, yaw: 0 }, { key: "bad" }, "nope", { key: "nan", owner: HANS, blueprint: "cart_b", name: "", x: "1", y: 2, z: 3, yaw: 0 }] } });
    assert.equal(sut.api.allCarts().length, 1);
    assert.equal(sut.api.releaseCart("ok"), true);
    assert.equal(sut.api.releaseCart("ok"), false);
    assert.equal(sut.api.allCarts().length, 0);
    assert.equal(sut.carts.size, 1, "it stays in the world, ownerless");
});

test("the names of the seats and of the models are the player's words", () => {
    const sut = load();
    assert.equal(sut.api.cartName("wagon_b_covered"), "Carroça coberta");
    assert.equal(sut.api.cartName("cart_b"), "Carro de duas rodas");
    assert.equal(sut.api.cartName("wagon_x"), "wagon_x");
    for (const seat of WAGON_SEATS) assert.ok(sut.api.SEAT_NAMES[seat], seat);
});
