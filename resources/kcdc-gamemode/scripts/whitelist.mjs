#!/usr/bin/env node
// Manages the approved accounts in secrets/whitelist.json. What the server does with them is in src/server/whitelist.ts.
//
//   node scripts/whitelist.mjs add <steamId ou link do perfil> [nome]
//   node scripts/whitelist.mjs remove <steamId>
//   node scripts/whitelist.mjs list
//   node scripts/whitelist.mjs enforce <on|off>     off lets everyone in and only logs who is not listed
//
// Run it from the server's working directory (the folder holding server.json), as the user the server runs as, or the
// server cannot read what it writes. The file is read on every join request, so none of this needs a restart.
//
// The Steam id is the 17-digit SteamID64 (7656119...). A profile link of the form steamcommunity.com/profiles/<id> works
// too; a link with a chosen name (steamcommunity.com/id/<name>) does not say the id, so ask for the number.

import fs from "node:fs";
import path from "node:path";

const FILE = process.env.KCDC_WHITELIST_FILE ?? "secrets/whitelist.json";
const STEAM_ID = /7656119\d{10}/;

function fail(message) {
    console.error(message);
    process.exit(1);
}

function read() {
    try {
        return JSON.parse(fs.readFileSync(FILE, "utf8"));
    } catch (error) {
        if (error.code === "ENOENT") {
            return { enforce: false, accounts: [] };
        }
        return fail(`Não consegui ler ${FILE}: ${error.message}`);
    }
}

function write(list) {
    fs.mkdirSync(path.dirname(FILE), { recursive: true, mode: 0o700 });
    const scratch = `${FILE}.new`;
    fs.writeFileSync(scratch, `${JSON.stringify(list, null, 2)}\n`, { mode: 0o600 });
    fs.renameSync(scratch, FILE);
}

function idOf(text) {
    return STEAM_ID.exec(text ?? "")?.[0] ?? fail(`Não achei um Steam id (17 dígitos, começa com 7656119) em '${text ?? ""}'.`);
}

const [command, ...args] = process.argv.slice(2);
const list = read();

if (command === "add") {
    const steamId = idOf(args[0]);
    const name = args.slice(1).join(" ").trim();
    const known = list.accounts.find((account) => account.steamId === steamId);
    if (known !== undefined) {
        known.name = name || known.name;
    } else {
        list.accounts.push({ steamId, name, addedAt: new Date().toISOString().slice(0, 10) });
    }
    write(list);
    console.log(`${known !== undefined ? "Já estava na lista" : "Aprovado"}: ${steamId}${name ? ` (${name})` : ""}. ${list.accounts.length} conta(s) na lista; bloqueio ${list.enforce === true ? "ligado" : "desligado"}.`);
} else if (command === "remove") {
    const steamId = idOf(args[0]);
    const kept = list.accounts.filter((account) => account.steamId !== steamId);
    if (kept.length === list.accounts.length) {
        fail(`${steamId} não está na lista.`);
    }
    list.accounts = kept;
    write(list);
    console.log(`Removido: ${steamId}. ${kept.length} conta(s) na lista.`);
} else if (command === "list") {
    console.log(`bloqueio: ${list.enforce === true ? "ligado" : "desligado"}; ${list.accounts.length} conta(s)`);
    for (const account of list.accounts) {
        console.log(`${account.steamId}  ${account.addedAt ?? ""}  ${account.name ?? ""}`);
    }
} else if (command === "enforce") {
    const [state] = args;
    if (state !== "on" && state !== "off") {
        fail("Uso: enforce <on|off>");
    }
    list.enforce = state === "on";
    write(list);
    console.log(`Bloqueio ${state === "on" ? "ligado: só entra quem está na lista" : "desligado: todos entram, e o log diz quem não está na lista"} (${list.accounts.length} conta(s)).`);
} else {
    fail("Uso: whitelist.mjs add <steamId|link> [nome] | remove <steamId> | list | enforce <on|off>");
}
