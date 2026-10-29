/**
 * Only the accounts the administration approved come in (user, 2026-10-16): a player fills in the server's form, the
 * administration approves them and puts their Steam id on the list. It is a second gate beside the world's password,
 * which everybody shares: the list names one account each, and a character is kept under the account it was made with
 * (`playerdata/characters/<steamId>.json`), so nobody else can play it.
 *
 * The list is `secrets/whitelist.json` in the server's folder, written by `scripts/whitelist.mjs` and read again on every
 * join request, so an approval counts at the player's next try, without a restart:
 *
 *   { "enforce": true, "accounts": [{ "steamId": "76561198…", "name": "Fulano", "addedAt": "2026-10-16" }] }
 *
 * - no file: everyone the password lets in comes in;
 * - "enforce": false: everyone comes in, and the log names who the list would have turned away;
 * - a file that cannot be read or understood: everybody is turned away, as in auth.ts, since failing open would hide it.
 *
 * Only Steam accounts can be approved: a character is saved under the Steam id, and a game bought on GOG reports no id at
 * all. An account from Epic is turned away like one not on the list, until the saves learn another key.
 */

import { readRequired } from "./steam-gate.js";

declare function require(id: string): unknown;

interface NodeFs {
    readFileSync(path: string, encoding: "utf8"): string;
}

const FILE = "secrets/whitelist.json";
const STEAM_ID = /^7656119\d{10}$/;

export const NOT_LISTED = "Sua conta ainda não foi aprovada no Kingdom RP Brasil. Faça a inscrição pelo formulário (no nosso Discord: discord.gg/p2wpuaGC3F) e aguarde a aprovação.";
export const UNAVAILABLE = "Servidor indisponível: a lista de jogadores aprovados não pôde ser lida. Avise a administração.";

export type List =
    | { readonly state: "open" }
    | { readonly state: "broken"; readonly problem: string }
    | { readonly state: "watch" | "enforce"; readonly ids: ReadonlySet<string> };

/** The list as the file says it now. */
export function readList(read: (path: string) => string): List {
    let text: string;
    try {
        text = read(FILE);
    } catch (error: unknown) {
        if ((error as { code?: string }).code === "ENOENT") {
            return { state: "open" };
        }
        return { state: "broken", problem: `não consegui ler ${FILE}: ${error instanceof Error ? error.message : String(error)}` };
    }
    let parsed: { enforce?: unknown; accounts?: unknown };
    try {
        parsed = JSON.parse(text) as { enforce?: unknown; accounts?: unknown };
    } catch (error: unknown) {
        return { state: "broken", problem: `${FILE} não é um JSON válido: ${error instanceof Error ? error.message : String(error)}` };
    }
    const accounts = Array.isArray(parsed.accounts) ? (parsed.accounts as unknown[]) : null;
    const ids = accounts?.map((account) => (account as { steamId?: unknown } | null)?.steamId);
    if (ids === undefined || ids.some((id) => typeof id !== "string" || !STEAM_ID.test(id))) {
        return { state: "broken", problem: `${FILE} tem uma conta que não é um Steam id` };
    }
    return { state: parsed.enforce === true ? "enforce" : "watch", ids: new Set(ids as string[]) };
}

function describeList(list: List): string {
    switch (list.state) {
    case "open":
        return `whitelist: sem ${FILE}; entra quem souber a senha`;
    case "broken":
        return `whitelist: ${list.problem}; ninguém entra até isso ser corrigido`;
    default:
        return `whitelist: ${list.ids.size} conta(s) aprovada(s); ${list.state === "enforce" ? "quem não está na lista é recusado" : "só observando (o bloqueio está desligado)"}`;
    }
}

export function installWhitelist(): void {
    let fs: NodeFs | null = null;
    try {
        fs = require("node:fs") as NodeFs;
    } catch {
        fs = null;
    }
    const read = (path: string): string => {
        if (fs === null) {
            throw new Error("o módulo fs não está disponível neste servidor");
        }
        return fs.readFileSync(path, "utf8");
    };
    const first = readList(read);
    (first.state === "broken" ? console.error : console.log)(describeList(first));

    Events.on("playerConnecting", (connection) => {
        const list = readList(read);
        if (list.state === "open" || (list.state !== "broken" && connection.steamId !== "" && list.ids.has(connection.steamId))) {
            return;
        }
        if (list.state === "broken") {
            console.error(describeList(list));
            connection.reject(UNAVAILABLE);
            return;
        }
        // A join that reports no Steam account at all is the Steam gate's to turn away, with the words that say what to do (steam-gate.ts): this list could only say
        // "not approved", which is not true of an account that is on it, and a player who read that (2026-10-29, lerolero, whose account was approved) went on being
        // told his Steam was refused. Only with the gate off does the list answer for a join with no Steam.
        if (connection.steamId === "" && readRequired(read).required) {
            return;
        }
        const who = `${connection.nickname} (${connection.steamId !== "" ? `Steam ${connection.steamId}` : connection.epicId !== "" ? "conta Epic, sem Steam" : "sem Steam"})`;
        if (list.state === "watch") {
            console.log(`whitelist: ${who} não está na lista; entrou porque o bloqueio está desligado`);
            return;
        }
        console.log(`whitelist: recusei ${who}: não está na lista`);
        connection.reject(NOT_LISTED);
    });
}
