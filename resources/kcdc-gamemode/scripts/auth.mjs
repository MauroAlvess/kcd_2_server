#!/usr/bin/env node
// Manages the join tickets in secrets/auth.json. What the server does with them is in src/server/auth.ts.
//
//   node scripts/auth.mjs init                    make the file, with one 'jogador' and one 'admin' ticket
//   node scripts/auth.mjs add <player|admin> <label>
//   node scripts/auth.mjs revoke <label>
//   node scripts/auth.mjs list                    labels and roles; the secrets are not kept anywhere
//   node scripts/auth.mjs enforce <on|off>        off lets a missing or wrong ticket in as a player
//
// Run it from the server's working directory (the folder holding server.json), as the user the
// server runs as, or the server cannot read what it writes. The file is read on every join request,
// so none of this needs a restart.
//
// A ticket is `label.secret`. The secret is printed once, here, and never stored: the file keeps only
// a salted scrypt hash of it. Put the whole ticket in the join link:
//   kcdc://host?nickname=Name&ticket=label.secret

import { randomBytes, randomInt, scrypt } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const FILE = process.env.KCDC_AUTH_FILE ?? "secrets/auth.json";

// No 0, 1, i, l or o: a secret read off a screen and typed again must survive.
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
const SECRET_LENGTH = 26;
const PARAMS = { N: 16384, r: 8, p: 1 };
const LABEL = /^[a-z0-9-]{1,20}$/;

function fail(message) {
    console.error(message);
    process.exit(1);
}

function newSecret() {
    let secret = "";
    for (let index = 0; index < SECRET_LENGTH; index += 1) {
        secret += ALPHABET[randomInt(ALPHABET.length)];
    }
    return secret;
}

function hashSecret(secret) {
    const salt = randomBytes(16);
    return new Promise((resolve, reject) => {
        scrypt(secret, salt, 32, { ...PARAMS, maxmem: 256 * PARAMS.N * PARAMS.r }, (error, key) => {
            if (error) {
                reject(error);
            } else {
                resolve(`scrypt$${PARAMS.N}$${PARAMS.r}$${PARAMS.p}$${salt.toString("hex")}$${key.toString("hex")}`);
            }
        });
    });
}

function read() {
    try {
        return JSON.parse(fs.readFileSync(FILE, "utf8"));
    } catch (error) {
        if (error.code === "ENOENT") {
            return null;
        }
        return fail(`Cannot read ${FILE}: ${error.message}`);
    }
}

function write(config) {
    fs.mkdirSync(path.dirname(FILE), { recursive: true, mode: 0o700 });
    const scratch = `${FILE}.new`;
    fs.writeFileSync(scratch, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
    fs.renameSync(scratch, FILE);
}

async function issue(config, role, label) {
    if (!LABEL.test(label)) {
        fail(`The label must be 1 to 20 characters from a-z, 0-9 and '-': '${label}'`);
    }
    if (config.tickets.some((ticket) => ticket.label === label)) {
        fail(`There is already a ticket called '${label}'.`);
    }
    const secret = newSecret();
    config.tickets.push({ label, role, hash: await hashSecret(secret) });
    return `${label}.${secret}`;
}

const [command, ...args] = process.argv.slice(2);

if (command === "init") {
    if (read() !== null && !args.includes("--force")) {
        fail(`${FILE} already exists. Use 'add' or 'revoke', or pass --force to start over.`);
    }
    const config = { version: 1, enforce: false, tickets: [] };
    const player = await issue(config, "player", "jogador");
    const admin = await issue(config, "admin", "admin");
    write(config);
    console.log(`player ${player}`);
    console.log(`admin ${admin}`);
} else if (command === "add") {
    const [role, label] = args;
    if (role !== "player" && role !== "admin") {
        fail("Usage: add <player|admin> <label>");
    }
    const config = read() ?? fail(`No ${FILE} yet. Run 'init' first.`);
    const ticket = await issue(config, role, label ?? "");
    write(config);
    console.log(`${role} ${ticket}`);
} else if (command === "revoke") {
    const [label] = args;
    const config = read() ?? fail(`No ${FILE} yet.`);
    const kept = config.tickets.filter((ticket) => ticket.label !== label);
    if (kept.length === config.tickets.length) {
        fail(`No ticket called '${label}'.`);
    }
    config.tickets = kept;
    write(config);
    console.log(`Revoked '${label}'. ${kept.length} ticket(s) left.`);
} else if (command === "list") {
    const config = read() ?? fail(`No ${FILE} yet.`);
    console.log(`enforce: ${config.enforce === true ? "on" : "off"}`);
    for (const ticket of config.tickets) {
        console.log(`${ticket.role.padEnd(6)} ${ticket.label}`);
    }
} else if (command === "enforce") {
    const [state] = args;
    if (state !== "on" && state !== "off") {
        fail("Usage: enforce <on|off>");
    }
    const config = read() ?? fail(`No ${FILE} yet. Run 'init' first.`);
    config.enforce = state === "on";
    write(config);
    console.log(`enforce: ${state}`);
} else {
    fail("Usage: auth.mjs init | add <player|admin> <label> | revoke <label> | list | enforce <on|off>");
}
