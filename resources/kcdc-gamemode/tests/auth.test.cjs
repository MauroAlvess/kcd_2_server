const { test } = require("node:test");
const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");

const FILE = "secrets/auth.json";
const ROOT = path.join(__dirname, "..");

/** A hash in the format scripts/auth.mjs writes, with N small enough to keep the tests quick. */
function hashed(secret) {
    const salt = crypto.randomBytes(16);
    const key = crypto.scryptSync(secret, salt, 32, { N: 1024, r: 8, p: 1 });
    return `scrypt$1024$8$1$${salt.toString("hex")}$${key.toString("hex")}`;
}

function config({ enforce, tickets }) {
    return JSON.stringify({
        version: 1,
        enforce,
        tickets: tickets.map(({ label, role, secret }) => ({ label, role, hash: hashed(secret) })),
    });
}

const PLAYER_SECRET = "abcdefghjkmnpqrstuvwxyz234";
const ADMIN_SECRET = "zyxwvutsrqpnmkjhgfedcba987";
const STANDARD = [
    { label: "jogador", role: "player", secret: PLAYER_SECRET },
    { label: "admin", role: "admin", secret: ADMIN_SECRET },
];

/** Every player a test has put on the server, by id, for `Player.getById`. */
const online = new Map();

function load(initial, readFile) {
    const files = new Map(initial === undefined ? [] : [[FILE, initial]]);
    const handlers = new Map();
    const lines = [];
    const counts = { scrypt: 0 };

    const fakeFs = {
        readFileSync(file) {
            if (readFile) return readFile(file);
            if (!files.has(file)) {
                const error = new Error("ENOENT");
                error.code = "ENOENT";
                throw error;
            }
            return files.get(file);
        },
    };
    const countingCrypto = {
        scrypt: (...args) => { counts.scrypt += 1; return crypto.scrypt(...args); },
        timingSafeEqual: (a, b) => crypto.timingSafeEqual(a, b),
    };
    const context = {
        exports: {},
        require: (id) => (id === "node:fs" ? fakeFs : id === "node:crypto" ? countingCrypto : assert.fail(`unexpected require ${id}`)),
        console: { log: (line) => lines.push(line), error: (line) => lines.push(`ERROR ${line}`) },
        Events: { on: (name, fn) => handlers.set(name, fn) },
        Player: { getById: (id) => online.get(id) ?? null },
    };
    vm.runInNewContext(fs.readFileSync(path.join(ROOT, "dist/server/auth.js"), "utf8"), context);
    context.exports.installAuth();
    return { api: context.exports, handlers, files, lines, counts };
}

function connection(over = {}) {
    const rejected = [];
    return { nickname: "Mauro", steamId: "76561198000000001", epicId: "", discordId: "", hardwareId: "hw-1", ticket: "", ip: "203.0.113.5", rejected, reject: (message) => rejected.push(message), ...over };
}

let nextId = 1;
function playerFor(who) {
    const player = { id: nextId++, nickname: who.nickname, steamId: who.steamId, epicId: who.epicId, discordId: who.discordId, hardwareId: who.hardwareId, ip: who.ip };
    online.set(player.id, player);
    return player;
}

/** Knocks as `who` and, if let in, shows up as the player they were admitted as. */
async function join(sut, who) {
    await sut.handlers.get("playerConnecting")(who);
    if (who.rejected.length > 0) return null;
    const player = playerFor(who);
    sut.handlers.get("playerConnect")(player);
    return player;
}

test("with no file nobody is checked and everyone is an administrator", async () => {
    const sut = load();
    const who = connection();
    const player = await join(sut, who);

    assert.deepEqual(who.rejected, []);
    assert.equal(sut.api.roleOf(player), "admin");
    assert.equal(sut.api.canRun(player, "give"), true);
    assert.ok(sut.lines.some((line) => line.includes("todos são administradores")));
});

test("a player ticket gets a player in, who may run only the common commands", async () => {
    const sut = load(config({ enforce: true, tickets: STANDARD }));
    const player = await join(sut, connection({ ticket: `jogador.${PLAYER_SECRET}` }));

    assert.notEqual(player, null);
    assert.equal(sut.api.roleOf(player), "player");
    for (const name of ["help", "camera", "mute", "unmute", "mutes", "dice", "anim", "face", "chave", "admin", "cavalo", "fome", "sede", "cachorro"]) {
        assert.equal(sut.api.canRun(player, name), true, `/${name} is for everyone`);
    }
    // `ui` opens the F4 debug panel, which is for administrators only.
    for (const name of ["ui", "creator", "give", "take", "tp", "world", "builder", "npc", "siege", "socialstatus", "appearance", "propriedade", "posicao", "vendedor", "bandidos", "clima", "horse", "some-future-command"]) {
        assert.equal(sut.api.canRun(player, name), false, `/${name} is for administrators`);
    }
});

test("an admin ticket makes an administrator who may run everything", async () => {
    const sut = load(config({ enforce: true, tickets: STANDARD }));
    const player = await join(sut, connection({ ticket: `admin.${ADMIN_SECRET}` }));

    assert.equal(sut.api.roleOf(player), "admin");
    assert.equal(sut.api.isAdmin(player), true);
    assert.equal(sut.api.canRun(player, "give"), true);
    assert.equal(sut.api.canRun(player, "some-future-command"), true);
});

test("when enforcing, a missing, malformed, unknown or wrong ticket is turned away", async () => {
    const sut = load(config({ enforce: true, tickets: STANDARD }));
    const wrong = "a".repeat(26);
    const cases = {
        missing: "",
        malformed: "not a ticket",
        "an unknown label": `ninguem.${PLAYER_SECRET}`,
        "the right label, a wrong secret": `jogador.${wrong}`,
        "a player secret on the admin label": `admin.${PLAYER_SECRET}`,
        "upper case": `jogador.${PLAYER_SECRET.toUpperCase()}`,
    };
    for (const [name, ticket] of Object.entries(cases)) {
        const who = connection({ ticket, ip: `198.51.100.${Math.floor(Math.random() * 200) + 1}` });
        assert.equal(await join(sut, who), null, name);
        assert.match(who.rejected[0], /Acesso restrito/, name);
    }
});

test("only a ticket with a known label costs a scrypt, so junk cannot be used to burn the CPU", async () => {
    const sut = load(config({ enforce: true, tickets: STANDARD }));
    await sut.handlers.get("playerConnecting")(connection({ ticket: "" }));
    await sut.handlers.get("playerConnecting")(connection({ ticket: "not a ticket" }));
    await sut.handlers.get("playerConnecting")(connection({ ticket: `ninguem.${PLAYER_SECRET}` }));
    const before = sut.counts.scrypt;
    await sut.handlers.get("playerConnecting")(connection({ ticket: `jogador.${"b".repeat(26)}` }));

    assert.equal(before, 1, "only the start-up self-test ran scrypt");
    assert.equal(sut.counts.scrypt, 2);
});

test("with enforcing off, a missing or wrong ticket is let in as a player and a good admin ticket still makes an admin", async () => {
    const sut = load(config({ enforce: false, tickets: STANDARD }));

    const nobody = await join(sut, connection({ ticket: "" }));
    assert.equal(sut.api.roleOf(nobody), "player");
    const wrong = await join(sut, connection({ ticket: `jogador.${"c".repeat(26)}`, hardwareId: "hw-2" }));
    assert.equal(sut.api.roleOf(wrong), "player");
    const admin = await join(sut, connection({ ticket: `admin.${ADMIN_SECRET}`, hardwareId: "hw-3" }));
    assert.equal(sut.api.roleOf(admin), "admin");
    assert.ok(sut.lines.some((line) => line.includes("o bloqueio está desligado")));
});

test("eight wrong tickets from one address shut it out, even with the right ticket, while others still get in", async () => {
    const sut = load(config({ enforce: true, tickets: STANDARD }));
    for (let attempt = 0; attempt < 8; attempt += 1) {
        const who = connection({ ticket: `jogador.${"d".repeat(26)}` });
        await sut.handlers.get("playerConnecting")(who);
        assert.match(who.rejected[0], /Acesso restrito/);
    }

    const good = connection({ ticket: `admin.${ADMIN_SECRET}` });
    await sut.handlers.get("playerConnecting")(good);
    assert.match(good.rejected[0], /Muitas tentativas/);

    const elsewhere = connection({ ticket: `admin.${ADMIN_SECRET}`, ip: "203.0.113.99", hardwareId: "hw-9" });
    assert.notEqual(await join(sut, elsewhere), null);
});

test("a file that cannot be understood turns everybody away rather than letting them in", async () => {
    const broken = {
        "not JSON": "{ nope",
        "no ticket list": JSON.stringify({ enforce: true }),
        "a ticket with no hash": JSON.stringify({ enforce: true, tickets: [{ label: "x", role: "admin" }] }),
        "a role nobody has": JSON.stringify({ enforce: true, tickets: [{ label: "x", role: "god", hash: hashed("y".repeat(20)) }] }),
        "a hash in another format": JSON.stringify({ enforce: true, tickets: [{ label: "x", role: "admin", hash: "md5$abc" }] }),
        "a label twice": JSON.stringify({ enforce: true, tickets: [{ label: "x", role: "player", hash: hashed("a".repeat(20)) }, { label: "x", role: "admin", hash: hashed("b".repeat(20)) }] }),
    };
    for (const [name, text] of Object.entries(broken)) {
        const sut = load(text);
        const who = connection({ ticket: `admin.${ADMIN_SECRET}` });
        assert.equal(await join(sut, who), null, name);
        assert.match(who.rejected[0], /indisponível/, name);
        assert.ok(sut.lines.some((line) => line.startsWith("ERROR")), `${name} is reported`);
    }

    const unreadable = load(undefined, () => { throw new Error("EACCES: permission denied"); });
    const who = connection();
    assert.equal(await join(unreadable, who), null);
    assert.match(who.rejected[0], /indisponível/);
});

test("the file is read on every join, so a revoked ticket stops working without a restart", async () => {
    const sut = load(config({ enforce: true, tickets: STANDARD }));
    assert.notEqual(await join(sut, connection({ ticket: `admin.${ADMIN_SECRET}` })), null);

    sut.files.set(FILE, config({ enforce: true, tickets: [STANDARD[0]] }));
    const who = connection({ ticket: `admin.${ADMIN_SECRET}`, hardwareId: "hw-4" });
    assert.equal(await join(sut, who), null);
    assert.match(who.rejected[0], /Acesso restrito/);

    sut.files.delete(FILE);
    assert.notEqual(await join(sut, connection({ hardwareId: "hw-5" })), null, "no file means open again");
});

test("an administrator who leaves is not an administrator if the same slot comes back without a ticket", async () => {
    const sut = load(config({ enforce: false, tickets: STANDARD }));
    const admin = await join(sut, connection({ ticket: `admin.${ADMIN_SECRET}` }));
    assert.equal(sut.api.roleOf(admin), "admin");

    sut.handlers.get("playerDisconnect")(admin);
    assert.equal(sut.api.roleOf(admin), "player");
});

test("two players who join at once each keep the role their own ticket gave", async () => {
    const sut = load(config({ enforce: true, tickets: STANDARD }));
    const first = connection({ nickname: "Ana", steamId: "1", hardwareId: "hw-a", ticket: `admin.${ADMIN_SECRET}` });
    const second = connection({ nickname: "Bia", steamId: "2", hardwareId: "hw-b", ticket: `jogador.${PLAYER_SECRET}` });
    await Promise.all([sut.handlers.get("playerConnecting")(first), sut.handlers.get("playerConnecting")(second)]);

    const bia = playerFor(second);
    const ana = playerFor(first);
    sut.handlers.get("playerConnect")(bia);
    sut.handlers.get("playerConnect")(ana);
    assert.equal(sut.api.roleOf(ana), "admin");
    assert.equal(sut.api.roleOf(bia), "player");
});

test("the command dispatcher refuses an admin command for a player, and runs it for an admin", async () => {
    const sut = load(config({ enforce: true, tickets: STANDARD }));
    const player = await join(sut, connection({ ticket: `jogador.${PLAYER_SECRET}` }));
    const admin = await join(sut, connection({ ticket: `admin.${ADMIN_SECRET}`, hardwareId: "hw-6", steamId: "9" }));

    const chat = [];
    const ran = [];
    const context = {
        exports: {},
        require: (id) => (id === "./auth.js" ? sut.api : assert.fail(`unexpected require ${id}`)),
        console: { error() {} },
        Chat: { sendToPlayer: (target, text) => chat.push({ target, text }) },
    };
    vm.runInNewContext(fs.readFileSync(path.join(ROOT, "dist/server/command.js"), "utf8"), context);
    const registry = new context.exports.CommandRegistry();
    registry.add(
        { name: "give", summary: "", usage: [], run: () => ran.push("give") },
        { name: "help", summary: "", usage: [], run: () => ran.push("help") },
    );

    assert.equal(registry.dispatch(player, "give", []), true, "it is answered, not 'unknown'");
    assert.deepEqual(ran, []);
    assert.match(chat.at(-1).text, /administrador/);
    assert.equal(chat.at(-1).target, player);

    registry.dispatch(player, "help", []);
    registry.dispatch(admin, "give", []);
    assert.deepEqual(ran, ["help", "give"]);
});

test("scripts/auth.mjs writes tickets the server accepts, and nothing it keeps reveals them", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kcdc-auth-"));
    const run = (...args) => {
        const result = childProcess.spawnSync(process.execPath, [path.join(ROOT, "scripts/auth.mjs"), ...args], { cwd: dir, encoding: "utf8" });
        assert.equal(result.status, 0, result.stderr);
        return result.stdout;
    };

    const created = Object.fromEntries(run("init").trim().split("\n").map((line) => line.split(" ")));
    assert.match(created.player, /^jogador\.[a-z2-9]{26}$/);
    assert.match(created.admin, /^admin\.[a-z2-9]{26}$/);

    const stored = fs.readFileSync(path.join(dir, FILE), "utf8");
    assert.ok(!stored.includes(created.player.split(".")[1]) && !stored.includes(created.admin.split(".")[1]), "the secrets are not in the file");
    if (process.platform !== "win32") {
        assert.equal(fs.statSync(path.join(dir, FILE)).mode & 0o777, 0o600);
    }

    const read = (file) => fs.readFileSync(path.join(dir, file), "utf8");
    const sut = load(undefined, read);
    const asAdmin = await join(sut, connection({ ticket: created.admin }));
    assert.equal(sut.api.roleOf(asAdmin), "admin");
    const asPlayer = await join(sut, connection({ ticket: created.player, hardwareId: "hw-7" }));
    assert.equal(sut.api.roleOf(asPlayer), "player");

    run("enforce", "on");
    const refused = connection({ ticket: `jogador.${"e".repeat(26)}`, hardwareId: "hw-8" });
    assert.equal(await join(sut, refused), null);

    const friend = run("add", "player", "amigo").trim().split(" ")[1];
    assert.notEqual(await join(sut, connection({ ticket: friend, hardwareId: "hw-10", ip: "203.0.113.50" })), null);
    assert.match(run("list"), /player\s+amigo/);
    assert.ok(!run("list").includes(friend.split(".")[1]));

    run("revoke", "amigo");
    assert.equal(await join(sut, connection({ ticket: friend, hardwareId: "hw-11", ip: "203.0.113.51" })), null);
    fs.rmSync(dir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------------------------
// /admin <ticket>: presenting a ticket after joining, for a player who came in without one.

/** Joins as a plain player, the way somebody coming in from the launcher's own menu does. */
async function joinWithoutTicket(sut, over = {}) {
    const player = await join(sut, connection(over));
    assert.notEqual(player, null, "the join was refused");
    assert.equal(sut.api.roleOf(player), "player");
    return player;
}

test("a player who joined without a ticket becomes an administrator by presenting the admin one", async () => {
    const sut = load(config({ enforce: false, tickets: STANDARD }));
    const player = await joinWithoutTicket(sut);
    assert.equal(sut.api.canRun(player, "give"), false);

    const result = await sut.api.promote(player, `admin.${ADMIN_SECRET}`);
    assert.equal(result.ok, true);
    assert.match(result.message, /administrador/);
    assert.equal(sut.api.roleOf(player), "admin");
    assert.equal(sut.api.canRun(player, "give"), true);
    assert.ok(sut.lines.some((line) => line.includes("virou administrador com o ticket 'admin'")));
});

test("the promotion lasts only until the player leaves", async () => {
    const sut = load(config({ enforce: false, tickets: STANDARD }));
    const player = await joinWithoutTicket(sut);
    await sut.api.promote(player, `admin.${ADMIN_SECRET}`);

    sut.handlers.get("playerDisconnect")(player);
    assert.equal(sut.api.roleOf(player), "player");
});

test("when joins are enforced, a player who came in with the player ticket can still step up with the admin one", async () => {
    const sut = load(config({ enforce: true, tickets: STANDARD }));
    const player = await join(sut, connection({ ticket: `jogador.${PLAYER_SECRET}` }));
    assert.equal(sut.api.roleOf(player), "player");

    assert.equal((await sut.api.promote(player, `admin.${ADMIN_SECRET}`)).ok, true);
    assert.equal(sut.api.roleOf(player), "admin");
});

test("a wrong, malformed or unknown ticket changes nothing and says so", async () => {
    const sut = load(config({ enforce: false, tickets: STANDARD }));
    const bad = ["", "x", "admin", "admin.", `admin.${"z".repeat(26)}`, `ninguem.${ADMIN_SECRET}`, `ADMIN.${ADMIN_SECRET}`, `admin.${ADMIN_SECRET.toUpperCase()}`, "a.b.c"];

    // One address each: eight misses from a single address lock it out, which is its own test below.
    for (const [index, ticket] of bad.entries()) {
        const player = await joinWithoutTicket(sut, { ip: `198.51.100.${index + 10}`, hardwareId: `hw-bad-${index}` });
        const result = await sut.api.promote(player, ticket);
        assert.equal(result.ok, false, JSON.stringify(ticket));
        assert.match(result.message, /Ticket inválido/);
        assert.equal(sut.api.roleOf(player), "player");
    }
});

test("only a ticket with a known label costs a scrypt, so guesses cannot be used to burn the CPU", async () => {
    const sut = load(config({ enforce: false, tickets: STANDARD }));
    const player = await joinWithoutTicket(sut);
    const before = sut.counts.scrypt;

    for (const junk of ["", "x", "nope.nope", `ninguem.${ADMIN_SECRET}`]) await sut.api.promote(player, junk);
    assert.equal(sut.counts.scrypt, before);

    await sut.api.promote(player, `admin.${"b".repeat(26)}`);
    assert.equal(sut.counts.scrypt, before + 1);
});

test("eight wrong tickets from one address, joins and /admin counted together, lock that address out of /admin", async () => {
    const sut = load(config({ enforce: true, tickets: STANDARD }));
    const player = await join(sut, connection({ ticket: `jogador.${PLAYER_SECRET}`, ip: "198.51.100.7" }));

    // Four wrong tries at the door and four more at the chat.
    for (let attempt = 0; attempt < 4; attempt += 1) {
        await sut.handlers.get("playerConnecting")(connection({ ticket: `jogador.${"d".repeat(26)}`, ip: "198.51.100.7", hardwareId: `hw-${attempt}` }));
        assert.match((await sut.api.promote(player, `admin.${"d".repeat(26)}`)).message, /Ticket inválido/);
    }

    const locked = await sut.api.promote(player, `admin.${ADMIN_SECRET}`);
    assert.equal(locked.ok, false);
    assert.match(locked.message, /Muitas tentativas/);
    assert.equal(sut.api.roleOf(player), "player");

    const elsewhere = await join(sut, connection({ ticket: `jogador.${PLAYER_SECRET}`, ip: "203.0.113.200", hardwareId: "hw-else" }));
    assert.equal((await sut.api.promote(elsewhere, `admin.${ADMIN_SECRET}`)).ok, true, "another address is not locked out");
});

test("the player ticket through /admin is recognised but gives nothing", async () => {
    const sut = load(config({ enforce: false, tickets: STANDARD }));
    const player = await joinWithoutTicket(sut);

    const result = await sut.api.promote(player, `jogador.${PLAYER_SECRET}`);
    assert.equal(result.ok, true);
    assert.match(result.message, /de jogador/);
    assert.equal(sut.api.roleOf(player), "player");
});

test("somebody who is already an administrator is told so without a check", async () => {
    const sut = load(config({ enforce: false, tickets: STANDARD }));
    const player = await join(sut, connection({ ticket: `admin.${ADMIN_SECRET}` }));
    const before = sut.counts.scrypt;

    const result = await sut.api.promote(player, "qualquer coisa");
    assert.equal(result.ok, true);
    assert.match(result.message, /já é administrador/);
    assert.equal(sut.counts.scrypt, before);
});

test("with no file everybody is already an administrator, and /admin says so", async () => {
    const sut = load();
    const player = await join(sut, connection());
    const result = await sut.api.promote(player, `admin.${ADMIN_SECRET}`);
    assert.equal(result.ok, true);
    assert.match(result.message, /sem bloqueio/);
});

test("with a file that cannot be understood /admin refuses rather than guess", async () => {
    const sut = load("{ nope");
    const player = playerFor(connection());
    const result = await sut.api.promote(player, `admin.${ADMIN_SECRET}`);
    assert.equal(result.ok, false);
    assert.match(result.message, /indisponível/);
    assert.equal(sut.api.roleOf(player), "player");
});

test("a player who leaves while the ticket is being checked is not left holding a role", async () => {
    const sut = load(config({ enforce: false, tickets: STANDARD }));
    const player = await joinWithoutTicket(sut);

    const checking = sut.api.promote(player, `admin.${ADMIN_SECRET}`);
    online.delete(player.id);
    const result = await checking;

    assert.equal(result.ok, false);
    assert.match(result.message, /saiu/);
    assert.equal(sut.api.roleOf(player), "player");
});

test("a revoked admin ticket stops working for /admin without a restart", async () => {
    const sut = load(config({ enforce: false, tickets: STANDARD }));
    const player = await joinWithoutTicket(sut);

    sut.files.set(FILE, config({ enforce: false, tickets: [STANDARD[0]] }));
    const result = await sut.api.promote(player, `admin.${ADMIN_SECRET}`);
    assert.equal(result.ok, false);
    assert.equal(sut.api.roleOf(player), "player");
});

test("/admin is one of the commands a plain player may run, and takes exactly one argument", async () => {
    const sut = load(config({ enforce: false, tickets: STANDARD }));
    const player = await joinWithoutTicket(sut);
    assert.equal(sut.api.canRun(player, "admin"), true);

    const replies = [];
    const usages = [];
    const refreshed = [];
    const changed = [];
    const status = { sendSocial: (target) => refreshed.push(target.id) };
    // The weapon combos follow the role (esgrima.ts): all of them for an administrator, only their own for a player.
    const esgrima = { esgrima: { roleChanged: (target) => changed.push(target.id) } };
    const context = {
        exports: {},
        require: (id) => (id === "../auth.js" ? sut.api : id === "../status.js" ? status : id === "../esgrima.js" ? esgrima : assert.fail(`unexpected require ${id}`)),
    };
    vm.runInNewContext(fs.readFileSync(path.join(ROOT, "dist/server/commands/admin.js"), "utf8"), context);
    const run = (args) => context.exports.adminCommand.run({ player, args, reply: { line: (text) => replies.push(text) }, usage: () => usages.push("usage") });

    await run([]);
    await run(["a", "b"]);
    assert.equal(usages.length, 2);
    assert.deepEqual(replies, []);

    assert.deepEqual(refreshed, [], "nothing to tell the panel while nothing changed");
    assert.deepEqual(changed, [], "nor the combos");

    await run([`admin.${ADMIN_SECRET}`]);
    assert.match(replies.at(-1), /agora é administrador/);
    assert.equal(sut.api.roleOf(player), "admin");
    assert.deepEqual(refreshed, [player.id], "the panel hears the new role at once, so F3 opens without F2 first");
    assert.deepEqual(changed, [player.id], "and the weapon combos are given at once (2026-10-26)");

    await run(["sair"]);
    assert.equal(sut.api.roleOf(player), "player");
    assert.deepEqual(changed, [player.id, player.id], "and taken out of the game again when the role goes");
});

test("/admin sair turns an administrator back into a common player until they leave, and the ticket makes them one again", async () => {
    const sut = load(config({ enforce: false, tickets: STANDARD }));
    const player = await join(sut, connection({ ticket: `admin.${ADMIN_SECRET}` }));
    assert.equal(sut.api.roleOf(player), "admin");

    const back = sut.api.demote(player);
    assert.equal(back.ok, true);
    assert.match(back.message, /jogador comum/);
    assert.equal(sut.api.roleOf(player), "player");
    assert.equal(sut.api.canRun(player, "give"), false);
    assert.equal(sut.api.canRun(player, "admin"), true, "the way back stays open");
    assert.ok(sut.lines.some((line) => line.includes("voltou a ser jogador comum")));

    assert.match(sut.api.demote(player).message, /já é um jogador comum/);
    assert.equal((await sut.api.promote(player, `admin.${ADMIN_SECRET}`)).ok, true);
    assert.equal(sut.api.roleOf(player), "admin");
});

test("with no file everybody is an administrator, and nobody stops being one", async () => {
    const sut = load();
    const player = await join(sut, connection());
    const result = sut.api.demote(player);
    assert.equal(result.ok, false);
    assert.equal(sut.api.roleOf(player), "admin");
});
